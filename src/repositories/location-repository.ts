import { supabase } from '@/lib/supabase';
import type { RepositoryError } from '@/repositories/types';

export type LiveLocation = {
  userId: string;
  lat: number;
  lng: number;
  heading: number | null;
  updatedAt: string;
};

type LiveLocationRow = {
  user_id: string;
  lat: number;
  lng: number;
  heading: number | null;
  updated_at: string;
};

type LiveLocationsResult = { data: LiveLocation[] | null; error: RepositoryError | null };

function toRepositoryError(error: { code?: string | null; message: string }): RepositoryError {
  return { code: error.code ?? 'unknown', message: error.message };
}

function toLiveLocation(row: LiveLocationRow): LiveLocation {
  return { userId: row.user_id, lat: row.lat, lng: row.lng, heading: row.heading, updatedAt: row.updated_at };
}

async function getLiveLocations(voyageId: string): Promise<LiveLocationsResult> {
  // get_live_locations() is table-returning, same PostgREST array shape as
  // this project's other set-returning RPCs -- an empty array is a valid "no
  // one has a location yet" result, not an error.
  const { data, error } = await supabase.rpc('get_live_locations', { p_voyage_id: voyageId });

  if (error) {
    return { data: null, error: toRepositoryError(error) };
  }

  const rows = (data as LiveLocationRow[] | null) ?? [];
  return { data: rows.map(toLiveLocation), error: null };
}

async function upsertLocation(
  voyageId: string,
  position: { lat: number; lng: number; heading: number | null },
): Promise<{ error: RepositoryError | null }> {
  // upsert_location() enforces active-membership authorization and the
  // conditional-upsert (a stale write can't clobber a newer one, AD-3)
  // server-side -- see its migration for the full rationale.
  const { error } = await supabase.rpc('upsert_location', {
    p_voyage_id: voyageId,
    p_lat: position.lat,
    p_lng: position.lng,
    p_heading: position.heading,
  });

  if (error) {
    return { error: toRepositoryError(error) };
  }

  return { error: null };
}

const BROADCAST_EVENT = 'location';

function channelName(voyageId: string): string {
  return `voyage:${voyageId}`;
}

// Channel lifecycle lives here, not scattered across hooks/screens (AD-2:
// "managed through the repository layer"). `{ config: { private: true } }`
// is required for this migration's Realtime-authorization RLS policies to
// be consulted at all -- an un-flagged channel bypasses that authorization
// entirely, so this must never be omitted.
//
// `broadcast: { self: true }` is required here too: our own device's
// position is broadcast from a *separate* channel instance (see
// createBroadcastChannel/broadcastLocationOnce below, used by the
// background location task, which has no access to this hook-owned
// listening channel). Realtime does not echo a client's own broadcasts back
// to it by default, so without this flag our own marker would only ever
// reflect the one-time cold-load position from getLiveLocations() and never
// update live for the rest of the session, even though every other
// Voyager's marker updates fine.
//
// onStatusChange (Story 3.5) surfaces the channel's own connection health --
// this is "can we reach the server" for AC1's reconnecting-note purposes,
// more accurate than a generic device-network check since it reflects this
// app's actual backend reachability, not just the device's network
// interface state.
function subscribeToLocations(
  voyageId: string,
  onLocation: (location: LiveLocation) => void,
  onStatusChange?: (status: 'connected' | 'disconnected') => void,
): { unsubscribe: () => void } {
  const channel = supabase
    .channel(channelName(voyageId), { config: { private: true, broadcast: { self: true } } })
    .on('broadcast', { event: BROADCAST_EVENT }, (message: { payload: unknown }) => {
      onLocation(toLiveLocation(message.payload as LiveLocationRow));
    })
    .subscribe((status: string) => {
      // Diagnosed and fixed: the "Reconnecting..." note stuck permanently
      // because broadcastLocationOnce (below) was tearing this exact
      // channel down every ~5s on a device that was also driving -- not a
      // server-side rejection. See broadcastLocationOnce's own comment.
      if (status === 'SUBSCRIBED') {
        onStatusChange?.('connected');
      } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
        onStatusChange?.('disconnected');
      }
    });

  return {
    unsubscribe: () => {
      supabase.removeChannel(channel);
    },
  };
}

// Sending needs its own subscribed channel handle to call .send() on,
// reused across repeated calls (e.g. from a location-watch callback firing
// every few seconds) rather than re-created per call. `isReady` guards
// against sending before the channel's subscribe handshake actually
// completes -- Supabase's own guidance is that .send() is only reliable
// after the subscribe callback reports 'SUBSCRIBED'; a send attempted
// before that is simply dropped here rather than queued, since the next
// watch callback a few seconds later will succeed once ready.
function createBroadcastChannel(voyageId: string): {
  send: (location: LiveLocation) => void;
  unsubscribe: () => void;
} {
  let isReady = false;
  const channel = supabase.channel(channelName(voyageId), { config: { private: true } }).subscribe((status: string) => {
    isReady = status === 'SUBSCRIBED';
  });

  return {
    send: (location) => {
      if (!isReady) return;
      channel.send({
        type: 'broadcast',
        event: BROADCAST_EVENT,
        payload: {
          user_id: location.userId,
          lat: location.lat,
          lng: location.lng,
          heading: location.heading,
          updated_at: location.updatedAt,
        },
      });
    },
    unsubscribe: () => {
      isReady = false;
      supabase.removeChannel(channel);
    },
  };
}

// Bounds broadcastLocationOnce's subscribe handshake below -- without this,
// a status that's never SUBSCRIBED/CHANNEL_ERROR/TIMED_OUT/CLOSED (or a
// connection that never calls back at all) would leave that promise
// unresolved and its channel un-torn-down forever. Called from a background
// task on every tick, so a hang here is a real leak, not just a slow
// response (Story 3.3 code review finding).
const BROADCAST_ONCE_TIMEOUT_MS = 10000;

// A single fire-and-forget broadcast, for callers that can't hold a
// persistent channel reference the way a hook's closure/ref can -- namely
// background-location-task.ts's module-scope task callback (Story 3.3),
// which has no stable place to keep a long-lived channel between
// invocations. Opens a channel, waits for the subscribe handshake (unlike
// createBroadcastChannel's send(), which drops a too-early call), sends
// once, tears the channel down, and resolves either way -- a failed/timed-
// out subscribe fails open (resolves without throwing) rather than
// rejecting, matching this app's established best-effort-broadcast
// discipline elsewhere.
//
// CONFIRMED PRODUCTION BUG, FIXED: supabase-js's RealtimeClient.channel()
// dedupes by topic name -- calling supabase.channel() for a topic that's
// already open (e.g. this same device's own live map, whose
// subscribeToLocations channel above uses the identical `voyage:{id}`
// topic) silently hands back that *same* channel object instead of
// creating a second one. This function used to then unconditionally
// supabase.removeChannel() whatever `.channel()` gave it once its own send
// completed -- on a device that was both driving (this function, firing
// every ~5s) and viewing the live map (subscribeToLocations' long-lived
// listening channel) at the same time, that meant every single location
// tick tore down the map's own receiving channel moments after it
// (re)connected: markers never moved, and the map showed "Reconnecting..."
// continuously, because nothing ever re-subscribed after the ambient
// teardown. Now: if a channel for this topic already exists, reuse it to
// send without touching its lifecycle at all -- it isn't this call's to
// subscribe or tear down. Only create-subscribe-send-teardown a fresh
// channel when this call is genuinely the first/only thing open on this
// topic (true background-task delivery with no live map mounted, the
// scenario this function was originally built for).
function broadcastLocationOnce(voyageId: string, location: LiveLocation): Promise<void> {
  const topic = channelName(voyageId);
  const message = {
    type: 'broadcast' as const,
    event: BROADCAST_EVENT,
    payload: {
      user_id: location.userId,
      lat: location.lat,
      lng: location.lng,
      heading: location.heading,
      updated_at: location.updatedAt,
    },
  };

  const existing = supabase.getChannels().find((channel) => channel.topic === `realtime:${topic}`);
  if (existing) {
    // Only send if it's actually joined -- a channel mid (re)connect can't
    // reliably push yet, and dropping this tick's send is preferable to
    // touching a channel this call doesn't own. Whoever does own it (the
    // live map's own subscribeToLocations) recovers its own subscription on
    // its own schedule; the next location tick a few seconds later tries
    // again.
    if (existing.state === 'joined') {
      existing.send(message);
    }
    return Promise.resolve();
  }

  return new Promise((resolve) => {
    let settled = false;
    // `channel` must be assigned before .subscribe() is called, not chained
    // off it -- a callback that fires synchronously (some SDKs do this for
    // an already-resolved/cached status) would otherwise reference `channel`
    // before its own assignment completes.
    const channel = supabase.channel(topic, { config: { private: true } });

    // Guards against acting twice: an unrecognized status, or a stale
    // duplicate callback invocation after this call already settled, would
    // otherwise re-remove an already-removed channel or resolve twice.
    const finish = () => {
      if (settled) return;
      settled = true;
      clearTimeout(timeoutId);
      supabase.removeChannel(channel);
      resolve();
    };

    const timeoutId = setTimeout(finish, BROADCAST_ONCE_TIMEOUT_MS);

    channel.subscribe((status: string) => {
      if (status === 'SUBSCRIBED') {
        channel.send(message);
        finish();
      } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
        finish();
      }
    });
  });
}

export const locationRepository = {
  getLiveLocations,
  upsertLocation,
  subscribeToLocations,
  createBroadcastChannel,
  broadcastLocationOnce,
};

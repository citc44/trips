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
function subscribeToLocations(voyageId: string, onLocation: (location: LiveLocation) => void): { unsubscribe: () => void } {
  const channel = supabase
    .channel(channelName(voyageId), { config: { private: true } })
    .on('broadcast', { event: BROADCAST_EVENT }, (message: { payload: unknown }) => {
      onLocation(toLiveLocation(message.payload as LiveLocationRow));
    })
    .subscribe();

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
function broadcastLocationOnce(voyageId: string, location: LiveLocation): Promise<void> {
  return new Promise((resolve) => {
    // `channel` must be assigned before .subscribe() is called, not chained
    // off it -- a callback that fires synchronously (some SDKs do this for
    // an already-resolved/cached status) would otherwise reference `channel`
    // before its own assignment completes.
    const channel = supabase.channel(channelName(voyageId), { config: { private: true } });
    channel.subscribe((status: string) => {
      if (status === 'SUBSCRIBED') {
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
        supabase.removeChannel(channel);
        resolve();
      } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
        supabase.removeChannel(channel);
        resolve();
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

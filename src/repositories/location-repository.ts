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

const LOCATION_EVENT = 'location';
const ROSTER_EVENT = 'roster_changed';
const CLOSED_CHANNEL_RETRY_MS = 1000;

function channelName(voyageId: string): string {
  return `voyage:${voyageId}`;
}

// Channel lifecycle lives here, not scattered across hooks/screens. The
// server-side upsert_location() RPC is now the only broadcaster, so this
// channel is receive-only: clients cannot construct/spoof location payloads
// and no separate sender channel can accidentally tear this listener down.
//
// A CLOSED channel is terminal rather than a transient socket hiccup. Rebuild
// it after a short delay so a map left open for a long drive can recover
// without requiring a remount. CHANNEL_ERROR/TIMED_OUT are left to the
// Supabase channel's own rejoin timer; their later SUBSCRIBED callback still
// flows through onStatusChange and triggers snapshot recovery in the hook.
function subscribeToLocations(
  voyageId: string,
  onLocation: (location: LiveLocation) => void,
  onStatusChange?: (status: 'connected' | 'disconnected') => void,
  onRosterChange?: () => void,
): { unsubscribe: () => void } {
  let isDisposed = false;
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  let currentChannel: ReturnType<typeof supabase.channel> | null = null;

  const connect = () => {
    if (isDisposed) return;

    const channel = supabase
      .channel(channelName(voyageId), { config: { private: true } })
      .on('broadcast', { event: LOCATION_EVENT }, (message: { payload: unknown }) => {
        onLocation(toLiveLocation(message.payload as LiveLocationRow));
      })
      .on('broadcast', { event: ROSTER_EVENT }, () => {
        onRosterChange?.();
      });

    currentChannel = channel;
    channel.subscribe((status: string) => {
      if (isDisposed || currentChannel !== channel) return;

      if (status === 'SUBSCRIBED') {
        onStatusChange?.('connected');
        return;
      }

      if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
        onStatusChange?.('disconnected');
      }

      if (status === 'CLOSED' && reconnectTimer === null) {
        // Detach the terminal channel before creating its replacement. Set
        // currentChannel to null first because removeChannel() can itself
        // synchronously surface CLOSED in test/native implementations.
        currentChannel = null;
        void supabase.removeChannel(channel);
        reconnectTimer = setTimeout(() => {
          reconnectTimer = null;
          connect();
        }, CLOSED_CHANNEL_RETRY_MS);
      }
    });
  };

  connect();

  return {
    unsubscribe: () => {
      isDisposed = true;
      if (reconnectTimer !== null) {
        clearTimeout(reconnectTimer);
        reconnectTimer = null;
      }
      if (currentChannel) {
        const channel = currentChannel;
        currentChannel = null;
        void supabase.removeChannel(channel);
      }
    },
  };
}

export const locationRepository = {
  getLiveLocations,
  upsertLocation,
  subscribeToLocations,
};

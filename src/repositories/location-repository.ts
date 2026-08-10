import { supabase } from '@/lib/supabase';
import type { RepositoryError } from '@/repositories/types';
import { isJourneyEventSignal, isLocationSignal, type JourneyEventSignal, type LocationSignal } from '@/shared/types/voyage-message';

export type LiveLocation = {
  userId: string;
  lat: number;
  lng: number;
  heading: number | null;
  updatedAt: string;
  capturedAt?: string;
  speedMps?: number | null;
  accuracyM?: number | null;
  senderSessionId?: string;
  sequence?: number;
};

export type RosterChange = {
  userId: string | null;
  isActive: boolean | null;
};

export type VoyageStatusChange = {
  status: 'active' | 'ended' | null;
};

type LiveLocationRow = {
  user_id: string;
  lat: number;
  lng: number;
  heading: number | null;
  updated_at: string;
  captured_at?: string | null;
  speed_mps?: number | null;
  accuracy_m?: number | null;
  sender_session_id?: string | null;
  sequence?: number | null;
};

type LiveLocationsResult = { data: LiveLocation[] | null; error: RepositoryError | null };

function toRepositoryError(error: { code?: string | null; message: string }): RepositoryError {
  return { code: error.code ?? 'unknown', message: error.message };
}

function toLiveLocation(row: LiveLocationRow): LiveLocation {
  const location: LiveLocation = { userId: row.user_id, lat: row.lat, lng: row.lng, heading: row.heading, updatedAt: row.updated_at };
  if (row.captured_at != null) location.capturedAt = row.captured_at;
  if (row.speed_mps !== undefined) location.speedMps = row.speed_mps;
  if (row.accuracy_m !== undefined) location.accuracyM = row.accuracy_m;
  if (row.sender_session_id != null) location.senderSessionId = row.sender_session_id;
  if (row.sequence != null) location.sequence = row.sequence;
  return location;
}

function signalToLiveLocation(signal: LocationSignal): LiveLocation {
  return {
    userId: signal.senderUserId, ...signal.payload, updatedAt: signal.sentAt,
    capturedAt: signal.capturedAt, senderSessionId: signal.senderSessionId, sequence: signal.sequence,
  };
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

async function upsertLocationSnapshot(voyageId: string, signal: LocationSignal): Promise<{ error: RepositoryError | null }> {
  const { error } = await supabase.rpc('upsert_location_snapshot', {
    p_voyage_id: voyageId,
    p_lat: signal.payload.lat,
    p_lng: signal.payload.lng,
    p_heading: signal.payload.heading,
    p_speed_mps: signal.payload.speedMps,
    p_accuracy_m: signal.payload.accuracyM,
    p_captured_at: signal.capturedAt,
    p_sender_session_id: signal.senderSessionId,
    p_sequence: signal.sequence,
  });
  return { error: error ? toRepositoryError(error) : null };
}

const ROSTER_EVENT = 'roster_changed';
const VOYAGE_STATUS_EVENT = 'voyage_status_changed';
const CLOSED_CHANNEL_RETRY_MS = 1000;
const activePublishers = new Map<string, (signal: LocationSignal) => Promise<boolean>>();
const localListeners = new Map<string, Set<(location: LiveLocation) => void>>();

async function publishLocationSignal(voyageId: string, signal: LocationSignal): Promise<boolean> {
  localListeners.get(voyageId)?.forEach((listener) => listener(signalToLiveLocation(signal)));
  const publisher = activePublishers.get(voyageId);
  return publisher ? publisher(signal) : false;
}

function subscribeToLocalLocations(voyageId: string, listener: (location: LiveLocation) => void): () => void {
  const listeners = localListeners.get(voyageId) ?? new Set();
  listeners.add(listener);
  localListeners.set(voyageId, listeners);
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) localListeners.delete(voyageId);
  };
}

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
  onRosterChange?: (change: RosterChange) => void,
  onVoyageStatusChange?: (change: VoyageStatusChange) => void,
  currentUserId?: string | null,
  onPresenceChange?: (presentUserIds: Set<string>) => void,
  onJourneyEvent?: (event: JourneyEventSignal) => void,
): { unsubscribe: () => void } {
  let isDisposed = false;
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  let currentChannel: ReturnType<typeof supabase.channel> | null = null;

  const connect = () => {
    if (isDisposed) return;

    const channel = supabase
      .channel(channelName(voyageId), { config: { private: true, presence: currentUserId ? { key: currentUserId } : undefined } })
      .on('broadcast', { event: 'voyage_message' }, (message: { payload: unknown }) => {
        if (isLocationSignal(message.payload) && message.payload.voyageId === voyageId) {
          onLocation(signalToLiveLocation(message.payload));
        } else if (isJourneyEventSignal(message.payload) && message.payload.voyageId === voyageId) {
          onJourneyEvent?.(message.payload);
        }
      })
      .on('broadcast', { event: ROSTER_EVENT }, (message: { payload: unknown }) => {
        const payload = message.payload as { user_id?: unknown; is_active?: unknown } | null;
        onRosterChange?.({
          userId: typeof payload?.user_id === 'string' ? payload.user_id : null,
          isActive: typeof payload?.is_active === 'boolean' ? payload.is_active : null,
        });
      })
      .on('broadcast', { event: VOYAGE_STATUS_EVENT }, (message: { payload: unknown }) => {
        const payload = message.payload as { status?: unknown } | null;
        onVoyageStatusChange?.({ status: payload?.status === 'active' || payload?.status === 'ended' ? payload.status : null });
      })
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState() as Record<string, unknown[]>;
        onPresenceChange?.(new Set(Object.keys(state)));
      });

    currentChannel = channel;
    activePublishers.set(voyageId, async (signal) => {
      if (currentChannel !== channel) return false;
      try {
        return (await channel.send({ type: 'broadcast', event: 'voyage_message', payload: signal })) === 'ok';
      } catch {
        return false;
      }
    });
    channel.subscribe((status: string) => {
      if (isDisposed || currentChannel !== channel) return;

      if (status === 'SUBSCRIBED') {
        onStatusChange?.('connected');
        if (currentUserId) void channel.track({ userId: currentUserId, onlineAt: new Date().toISOString() });
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
      activePublishers.delete(voyageId);
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
  upsertLocationSnapshot,
  publishLocationSignal,
  subscribeToLocalLocations,
  subscribeToLocations,
};

import AsyncStorage from '@react-native-async-storage/async-storage';
import * as TaskManager from 'expo-task-manager';

import { locationRepository } from '@/repositories/location-repository';
import { createMessageId, VOYAGE_PROTOCOL_VERSION, type LocationSignal } from '@/shared/types/voyage-message';

export const BACKGROUND_LOCATION_TASK = 'voylo-background-location';

export type BackgroundLocationContext = {
  voyageId: string;
  userId?: string;
  // Identifies the native hook effect that owns the shared Expo task. The
  // task callback itself only needs voyageId, but cleanup needs this token so
  // an obsolete effect cannot clear a newer effect's in-memory or persisted
  // context.
  ownerGeneration?: number;
};

// The only way to bridge React-managed state (which Voyage/user is
// currently active) into a task defined at module scope -- defineTask()
// below must run once, at import time, before any component ever mounts,
// so it has no access to hooks/context. use-location-tracking.tsx keeps
// this in sync via this setter whenever tracking starts/stops. Deliberately
// narrow (just the Voyage id the task needs) -- not a general-purpose global
// state pattern to reach for elsewhere in this app.
let currentContext: BackgroundLocationContext | null = null;
let hasExplicitlyResolvedContext = false;

// Also persisted (Story 3.3 code review finding): the OS can terminate a
// backgrounded app under memory pressure and later relaunch it headlessly
// solely to deliver a due background-location task -- no screen mounts in
// that relaunch, so the in-memory currentContext above would otherwise stay
// null forever and every location update would silently no-op, defeating
// the entire point of background tracking. AsyncStorage is already used
// for Supabase session persistence (src/lib/supabase.ts); reused here for
// the same "survive a process restart" reason.
const CONTEXT_STORAGE_KEY = 'voylo:background-location-context';

// AsyncStorage writes are asynchronous and are not guaranteed to finish in
// invocation order. Serializing them prevents an old removeItem() from
// winning the race against a newer setItem() during a rapid Voyage handoff.
let contextStorageQueue: Promise<void> = Promise.resolve();

function enqueueContextStorageMutation(mutation: () => Promise<unknown>): Promise<void> {
  const result = contextStorageQueue
    .catch(() => {})
    .then(mutation)
    .then(() => undefined)
    .catch(() => {
      // Context persistence is best effort. The in-memory owner is still
      // authoritative for the current process when storage is unavailable.
    });
  contextStorageQueue = result;
  return result;
}

type PendingLocationFix = {
  voyageId: string;
  signal: LocationSignal;
};

// At navigation cadence a new GPS fix can arrive while the previous RPC is
// still crossing a slow mobile network. Keep exactly one request in flight
// and replace any queued value with the newest fix. This preserves ordering,
// prevents an unbounded request backlog, and still guarantees the latest
// known position is the next value sent when connectivity recovers.
let pendingFix: PendingLocationFix | null = null;
let drainPromise: Promise<void> | null = null;
let sequence = 0;
const senderSessionId = createMessageId();
let lastSnapshotAt = 0;
const SNAPSHOT_INTERVAL_MS = 10_000;
// Operational kill switch: setting this public build/update variable to
// "false" disables client Broadcast while retaining snapshot recovery.
const FAST_PATH_ENABLED = process.env.EXPO_PUBLIC_LIVE_JOURNEY_FAST_PATH !== 'false';

export function setBackgroundLocationContext(context: BackgroundLocationContext | null): Promise<void> {
  hasExplicitlyResolvedContext = true;
  currentContext = context;
  if (context) {
    return enqueueContextStorageMutation(() => AsyncStorage.setItem(CONTEXT_STORAGE_KEY, JSON.stringify(context)));
  } else {
    pendingFix = null;
    return enqueueContextStorageMutation(() => AsyncStorage.removeItem(CONTEXT_STORAGE_KEY));
  }
}

/**
 * Clear context only when it still belongs to the supplied native tracking
 * generation. This is the ownership barrier that makes delayed cleanup safe:
 * once a newer generation installs its context, an older generation becomes
 * incapable of removing it from memory or AsyncStorage.
 */
export function clearBackgroundLocationContext(ownerGeneration: number): Promise<boolean> {
  if (currentContext?.ownerGeneration !== ownerGeneration) return Promise.resolve(false);

  hasExplicitlyResolvedContext = true;
  currentContext = null;
  pendingFix = null;
  return enqueueContextStorageMutation(() => AsyncStorage.removeItem(CONTEXT_STORAGE_KEY)).then(() => true);
}

// Shared by both the native background-task callback below and web's
// foreground watchPositionAsync path. upsert_location() now performs the
// durable write and authoritative Realtime broadcast atomically, so every
// accepted fix uses that one path instead of racing a throttled RPC against
// an unrelated best-effort client channel.send().
export async function reportLocationFix(
  voyageId: string,
  lat: number,
  lng: number,
  heading: number | null,
  options: { userId?: string; speedMps?: number | null; accuracyM?: number | null; capturedAt?: string } = {},
): Promise<void> {
  const now = new Date().toISOString();
  const signal: LocationSignal = {
    protocolVersion: VOYAGE_PROTOCOL_VERSION,
    messageId: createMessageId(),
    voyageId,
    senderUserId: options.userId ?? '',
    senderSessionId,
    sequence: ++sequence,
    type: 'location.updated',
    capturedAt: options.capturedAt ?? now,
    sentAt: now,
    payload: { lat, lng, heading, speedMps: options.speedMps ?? null, accuracyM: options.accuracyM ?? null },
  };

  const sentLive = FAST_PATH_ENABLED && options.userId && locationRepository.publishLocationSignal
    ? await locationRepository.publishLocationSignal(voyageId, signal)
    : false;
  if (sentLive && Date.now() - lastSnapshotAt < SNAPSHOT_INTERVAL_MS) return;

  pendingFix = { voyageId, signal };

  if (!drainPromise) {
    drainPromise = (async () => {
      while (pendingFix) {
        const fix: PendingLocationFix = pendingFix;
        pendingFix = null;

        try {
          // Repository errors are returned rather than thrown. No special
          // retry loop is needed here: the next GPS callback is itself the
          // retry and pendingFix coalescing ensures it carries fresh data.
          const result = locationRepository.upsertLocationSnapshot
            ? await locationRepository.upsertLocationSnapshot(fix.voyageId, fix.signal)
            : await locationRepository.upsertLocation(fix.voyageId, {
                lat: fix.signal.payload.lat, lng: fix.signal.payload.lng, heading: fix.signal.payload.heading,
              });
          if (!result.error) lastSnapshotAt = Date.now();
          else pendingFix = fix;
        } catch {
          // A real network exception must not crash Expo's background task.
          pendingFix = fix;
        }
        if (pendingFix === fix) break;
      }
    })().finally(() => {
      drainPromise = null;
    });
  }

  await drainPromise;
}

type BackgroundLocationCoords = {
  latitude: number; longitude: number; heading: number | null;
  speed?: number | null; accuracy?: number | null;
};
type BackgroundLocationObject = { coords: BackgroundLocationCoords; timestamp: number };
type BackgroundLocationTaskData = { locations: BackgroundLocationObject[] };

// Must run at module scope, not inside a component or hook -- a hard Expo
// requirement (registers the task once, before any navigation happens).
// Imported for this side effect at the very top of _layout.tsx.
TaskManager.defineTask<BackgroundLocationTaskData>(BACKGROUND_LOCATION_TASK, async ({ data, error }) => {
  if (error) return;

  if (!currentContext && !hasExplicitlyResolvedContext) {
    // Rehydrate from disk on the first callback of a freshly (re)started
    // process -- covers the OS-terminated-then-relaunched-headlessly case
    // above. An explicit clear marks the context as resolved even while its
    // removeItem() is still in flight, preventing that stale stored value
    // from being resurrected by a concurrent task callback.
    try {
      const stored = await AsyncStorage.getItem(CONTEXT_STORAGE_KEY);
      if (stored && !hasExplicitlyResolvedContext) {
        currentContext = JSON.parse(stored) as BackgroundLocationContext;
        hasExplicitlyResolvedContext = true;
      }
    } catch {
      // Fails open -- if storage can't be read, just skip this tick; the
      // next one will try again.
    }
  }
  if (!currentContext) return;

  const locations = data?.locations ?? [];
  // Background delivery can batch multiple fixes per callback -- only the
  // most recent one matters, same "latest wins" discipline as everywhere
  // else this app handles location (AD-3's conditional upsert, the
  // foreground path's client-side merge).
  const latest = locations[locations.length - 1];
  if (!latest) return;

  const { voyageId, userId } = currentContext;
  const lat = latest.coords.latitude;
  const lng = latest.coords.longitude;
  // Same platform heading-sentinel normalization the foreground path
  // applies (Story 3.2 code review finding) -- some platforms report -1 as
  // "undetermined" rather than null.
  const rawHeading = latest.coords.heading;
  const heading = rawHeading != null && rawHeading >= 0 ? rawHeading : null;
  await reportLocationFix(voyageId, lat, lng, heading, {
    userId,
    speedMps: latest.coords.speed,
    accuracyM: latest.coords.accuracy,
    capturedAt: new Date(latest.timestamp).toISOString(),
  });
});

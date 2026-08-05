import AsyncStorage from '@react-native-async-storage/async-storage';
import * as TaskManager from 'expo-task-manager';

import { locationRepository } from '@/repositories/location-repository';

export const BACKGROUND_LOCATION_TASK = 'voylo-background-location';

type BackgroundLocationContext = { voyageId: string };

// The only way to bridge React-managed state (which Voyage/user is
// currently active) into a task defined at module scope -- defineTask()
// below must run once, at import time, before any component ever mounts,
// so it has no access to hooks/context. use-location-tracking.tsx keeps
// this in sync via this setter whenever tracking starts/stops. Deliberately
// narrow (just the Voyage id the task needs) -- not a general-purpose global
// state pattern to reach for elsewhere in this app.
let currentContext: BackgroundLocationContext | null = null;

// Also persisted (Story 3.3 code review finding): the OS can terminate a
// backgrounded app under memory pressure and later relaunch it headlessly
// solely to deliver a due background-location task -- no screen mounts in
// that relaunch, so the in-memory currentContext above would otherwise stay
// null forever and every location update would silently no-op, defeating
// the entire point of background tracking. AsyncStorage is already used
// for Supabase session persistence (src/lib/supabase.ts); reused here for
// the same "survive a process restart" reason.
const CONTEXT_STORAGE_KEY = 'voylo:background-location-context';

type PendingLocationFix = {
  voyageId: string;
  lat: number;
  lng: number;
  heading: number | null;
};

// At navigation cadence a new GPS fix can arrive while the previous RPC is
// still crossing a slow mobile network. Keep exactly one request in flight
// and replace any queued value with the newest fix. This preserves ordering,
// prevents an unbounded request backlog, and still guarantees the latest
// known position is the next value sent when connectivity recovers.
let pendingFix: PendingLocationFix | null = null;
let drainPromise: Promise<void> | null = null;

export function setBackgroundLocationContext(context: BackgroundLocationContext | null): void {
  currentContext = context;
  if (context) {
    AsyncStorage.setItem(CONTEXT_STORAGE_KEY, JSON.stringify(context)).catch(() => {});
  } else {
    pendingFix = null;
    AsyncStorage.removeItem(CONTEXT_STORAGE_KEY).catch(() => {});
  }
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
): Promise<void> {
  pendingFix = { voyageId, lat, lng, heading };

  if (!drainPromise) {
    drainPromise = (async () => {
      while (pendingFix) {
        const fix = pendingFix;
        pendingFix = null;

        try {
          // Repository errors are returned rather than thrown. No special
          // retry loop is needed here: the next GPS callback is itself the
          // retry and pendingFix coalescing ensures it carries fresh data.
          await locationRepository.upsertLocation(fix.voyageId, {
            lat: fix.lat,
            lng: fix.lng,
            heading: fix.heading,
          });
        } catch {
          // A real network exception must not crash Expo's background task.
        }
      }
    })().finally(() => {
      drainPromise = null;
    });
  }

  await drainPromise;
}

type BackgroundLocationCoords = { latitude: number; longitude: number; heading: number | null };
type BackgroundLocationObject = { coords: BackgroundLocationCoords; timestamp: number };
type BackgroundLocationTaskData = { locations: BackgroundLocationObject[] };

// Must run at module scope, not inside a component or hook -- a hard Expo
// requirement (registers the task once, before any navigation happens).
// Imported for this side effect at the very top of _layout.tsx.
TaskManager.defineTask<BackgroundLocationTaskData>(BACKGROUND_LOCATION_TASK, async ({ data, error }) => {
  if (error) return;

  if (!currentContext) {
    // Rehydrate from disk on the first callback of a freshly (re)started
    // process -- covers the OS-terminated-then-relaunched-headlessly case
    // above. Only attempted when nothing is in memory yet; once rehydrated,
    // later ticks in the same process use the fast in-memory path.
    try {
      const stored = await AsyncStorage.getItem(CONTEXT_STORAGE_KEY);
      if (stored) currentContext = JSON.parse(stored) as BackgroundLocationContext;
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

  const { voyageId } = currentContext;
  const lat = latest.coords.latitude;
  const lng = latest.coords.longitude;
  // Same platform heading-sentinel normalization the foreground path
  // applies (Story 3.2 code review finding) -- some platforms report -1 as
  // "undetermined" rather than null.
  const rawHeading = latest.coords.heading;
  const heading = rawHeading != null && rawHeading >= 0 ? rawHeading : null;
  await reportLocationFix(voyageId, lat, lng, heading);
});

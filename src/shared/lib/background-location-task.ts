import AsyncStorage from '@react-native-async-storage/async-storage';
import * as TaskManager from 'expo-task-manager';

import { locationRepository } from '@/repositories/location-repository';

export const BACKGROUND_LOCATION_TASK = 'voylo-background-location';

type BackgroundLocationContext = { voyageId: string; userId: string };

// The only way to bridge React-managed state (which Voyage/user is
// currently active) into a task defined at module scope -- defineTask()
// below must run once, at import time, before any component ever mounts,
// so it has no access to hooks/context. use-location-tracking.tsx keeps
// this in sync via this setter whenever tracking starts/stops. Deliberately
// narrow (just the two ids the task needs) -- not a general-purpose global
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

// Throttles persisted writes the same way Story 3.2's foreground hook did
// (UPSERT_THROTTLE_MS) -- the ephemeral broadcast carries the "near-real-
// time" feel every tick; the persisted row only needs to be fresh enough to
// serve a reconnect/cold load. Module-scope, not a React ref, for the same
// reason currentContext is: this callback has no component instance to hold
// state in.
const UPSERT_THROTTLE_MS = 30000;
let lastUpsertAt = 0;

export function setBackgroundLocationContext(context: BackgroundLocationContext | null): void {
  currentContext = context;
  if (context) {
    // Fresh tracking session -- always write the first fix immediately
    // rather than waiting up to 30s, same as the foreground hook resetting
    // its throttle ref on every new effect mount.
    lastUpsertAt = 0;
    AsyncStorage.setItem(CONTEXT_STORAGE_KEY, JSON.stringify(context)).catch(() => {});
  } else {
    AsyncStorage.removeItem(CONTEXT_STORAGE_KEY).catch(() => {});
  }
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

  const { voyageId, userId } = currentContext;
  const lat = latest.coords.latitude;
  const lng = latest.coords.longitude;
  // Same platform heading-sentinel normalization the foreground path
  // applies (Story 3.2 code review finding) -- some platforms report -1 as
  // "undetermined" rather than null.
  const rawHeading = latest.coords.heading;
  const heading = rawHeading != null && rawHeading >= 0 ? rawHeading : null;
  const updatedAt = new Date(latest.timestamp).toISOString();

  const now = Date.now();
  if (now - lastUpsertAt >= UPSERT_THROTTLE_MS) {
    lastUpsertAt = now;
    try {
      await locationRepository.upsertLocation(voyageId, { lat, lng, heading });
    } catch {
      // Fails open -- a real network exception here (not unlikely mid-road-
      // trip) shouldn't crash the task; the next tick tries again.
    }
  }

  // Best-effort only, and never lets a broadcast failure surface past this
  // task -- the upsert above is the guaranteed-correct path regardless of
  // whether this succeeds (see this story's own Dev Notes on the AD-8/
  // Broadcast architecture-doc drift this is deliberately papering over,
  // not resolving).
  try {
    await locationRepository.broadcastLocationOnce(voyageId, { userId, lat, lng, heading, updatedAt });
  } catch {
    // Swallowed on purpose -- fails open.
  }
});

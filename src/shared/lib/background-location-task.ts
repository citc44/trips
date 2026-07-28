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

export function setBackgroundLocationContext(context: BackgroundLocationContext | null): void {
  currentContext = context;
}

type BackgroundLocationCoords = { latitude: number; longitude: number; heading: number | null };
type BackgroundLocationObject = { coords: BackgroundLocationCoords; timestamp: number };
type BackgroundLocationTaskData = { locations: BackgroundLocationObject[] };

// Must run at module scope, not inside a component or hook -- a hard Expo
// requirement (registers the task once, before any navigation happens).
// Imported for this side effect at the very top of _layout.tsx.
TaskManager.defineTask<BackgroundLocationTaskData>(BACKGROUND_LOCATION_TASK, async ({ data, error }) => {
  if (error) return;
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

  await locationRepository.upsertLocation(voyageId, { lat, lng, heading });

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

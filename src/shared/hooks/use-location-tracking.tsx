import * as Location from 'expo-location';
import { useEffect } from 'react';
import { Platform } from 'react-native';

import {
  BACKGROUND_LOCATION_TASK,
  clearBackgroundLocationContext,
  reportLocationFix,
  setBackgroundLocationContext,
} from '@/shared/lib/background-location-task';
import { useAuth } from '@/shared/hooks/use-auth';
import { useLocationPermission } from '@/shared/hooks/use-location-permission';

// Navigation-grade acquisition. The old Balanced/5s/20m settings could be
// roughly 100m inaccurate and guaranteed multi-second jumps (at 60 mph, a
// five-second sample gap is about 134m). One-second fixes plus a small
// distance filter provide the raw cadence needed for smooth interpolation;
// outgoing RPCs are latest-value coalesced in background-location-task.ts so
// slow mobile networks cannot build an unbounded queue.
const WATCH_TIME_INTERVAL_MS = 1000;
const WATCH_DISTANCE_INTERVAL_M = 3;

// First-draft copy -- no existing DESIGN.md/EXPERIENCE.md text to draw from
// (confirmed absent by this story's own research). Flagged for eventual
// PM/UX sign-off, not treated as final.
const FOREGROUND_SERVICE_NOTIFICATION_TITLE = 'Voylo is sharing your location';
const FOREGROUND_SERVICE_NOTIFICATION_BODY = 'Your Voyage group can see you on the map.';

// Rebuilt on expo-location's background-capable startLocationUpdatesAsync/
// stopLocationUpdatesAsync (Story 3.3) -- replaces, not supplements, Story
// 3.2's watchPositionAsync-based useForegroundLocationBroadcast, which
// stopped the instant the app backgrounded. A single mechanism now works
// correctly in both states; running both would double-send. The actual
// upsert/broadcast sending logic lives in background-location-task.ts's
// module-scope task callback, not here -- this hook's job narrows to
// starting and stopping tracking correctly, and keeping the task's
// module-level context (which Voyage/user to report for) in sync.
//
// No background-permission-specific gate: startLocationUpdatesAsync is safe
// to call with only foreground ("While Using") permission granted -- the OS
// itself simply stops delivering updates once the app is actually
// backgrounded in that case, with no error and no crash. Story 3.1's
// existing foreground-status gate is already sufficient.
//
// Web is a genuine third path, not a variant of the above: verified via a
// real browser session that startLocationUpdatesAsync silently no-ops on
// web (TaskManager has no web implementation -- the .catch(() => {}) below
// swallows the rejection, "fails open" exactly as commented, but the net
// effect was that literally nobody's own location was ever tracked on web,
// including the Organizer's own marker). Browsers have no background-task
// concept at all, so there's no web equivalent of startLocationUpdatesAsync
// to reach for -- watchPositionAsync (foreground-only, backed by the
// browser's real Geolocation API) is the actual ceiling on web, same as
// this app's own pre-Story-3.3 native behavior. Calls the same
// reportLocationFix() the native task callback uses, so both platforms
// share the same authenticated server-reporting behavior.
function normalizeHeading(rawHeading: number | null | undefined): number | null {
  return rawHeading != null && rawHeading >= 0 ? rawHeading : null;
}

type NativeTrackingLease = {
  generation: number;
  voyageId: string;
};

let nextNativeTrackingGeneration = 0;
let desiredNativeTrackingLease: NativeTrackingLease | null = null;
let runningNativeTrackingLease: NativeTrackingLease | null = null;
let nativeTrackingLifecycleQueue: Promise<void> = Promise.resolve();

function isSameLease(left: NativeTrackingLease | null, right: NativeTrackingLease): boolean {
  return left?.generation === right.generation;
}

function enqueueNativeTrackingLifecycle(operation: () => Promise<void>): void {
  const result = nativeTrackingLifecycleQueue
    .catch(() => {})
    .then(operation)
    .catch(() => {
      // Native tracking remains best effort. Keeping the queue fulfilled is
      // important: one native-module failure must not prevent a later Voyage
      // from taking ownership of the shared task.
    });
  nativeTrackingLifecycleQueue = result;
}

async function stopNativeTrackingOwnedBy(lease: NativeTrackingLease): Promise<void> {
  if (isSameLease(runningNativeTrackingLease, lease)) {
    try {
      await Location.stopLocationUpdatesAsync(BACKGROUND_LOCATION_TASK);
    } catch {
      // Continue clearing this generation's context. If stop failed because
      // the task was already absent, retaining stale routing context is worse.
    }

    if (isSameLease(runningNativeTrackingLease, lease)) {
      runningNativeTrackingLease = null;
    }
  }

  // Conditional in the background-task module: this is a no-op if a newer
  // generation has already installed its context.
  await clearBackgroundLocationContext(lease.generation);
}

async function activateNativeTracking(lease: NativeTrackingLease): Promise<void> {
  if (!isSameLease(desiredNativeTrackingLease, lease)) return;

  const previousLease = runningNativeTrackingLease;
  if (previousLease && !isSameLease(previousLease, lease)) {
    // There is only one Expo task name. Finish the prior stop before changing
    // context or issuing the next start, so native calls cannot overtake one
    // another across a Voyage switch.
    await stopNativeTrackingOwnedBy(previousLease);
  }

  if (!isSameLease(desiredNativeTrackingLease, lease)) return;

  await setBackgroundLocationContext({
    voyageId: lease.voyageId,
    ownerGeneration: lease.generation,
  });

  if (!isSameLease(desiredNativeTrackingLease, lease)) {
    await clearBackgroundLocationContext(lease.generation);
    return;
  }

  // Claim ownership before awaiting start. If start resolves after cleanup
  // was requested, the queued cleanup can then identify and stop exactly this
  // generation, never whichever generation happens to be newest.
  runningNativeTrackingLease = lease;

  try {
    await Location.startLocationUpdatesAsync(BACKGROUND_LOCATION_TASK, {
      accuracy: Location.Accuracy.BestForNavigation,
      timeInterval: WATCH_TIME_INTERVAL_MS,
      distanceInterval: WATCH_DISTANCE_INTERVAL_M,
      // Explicit zeroes prevent iOS background delivery from batching fixes;
      // Expo documents zero as immediate delivery, which is what a live
      // shared map requires.
      deferredUpdatesDistance: 0,
      deferredUpdatesInterval: 0,
      // CoreLocation must remain tuned for a moving car and must not
      // automatically pause fixes at a stop light or in slow traffic.
      activityType: Location.LocationActivityType.AutomotiveNavigation,
      pausesUpdatesAutomatically: false,
      foregroundService: {
        notificationTitle: FOREGROUND_SERVICE_NOTIFICATION_TITLE,
        notificationBody: FOREGROUND_SERVICE_NOTIFICATION_BODY,
      },
    });
  } catch {
    await stopNativeTrackingOwnedBy(lease);
    return;
  }

  if (!isSameLease(desiredNativeTrackingLease, lease)) {
    // A cleanup or replacement arrived while start was in flight. Because all
    // lifecycle work is serialized, no newer start/context can exist yet.
    await stopNativeTrackingOwnedBy(lease);
  }
}

function acquireNativeTracking(voyageId: string): () => void {
  const lease: NativeTrackingLease = {
    generation: ++nextNativeTrackingGeneration,
    voyageId,
  };
  desiredNativeTrackingLease = lease;
  enqueueNativeTrackingLifecycle(() => activateNativeTracking(lease));

  return () => {
    if (isSameLease(desiredNativeTrackingLease, lease)) {
      desiredNativeTrackingLease = null;
    }

    enqueueNativeTrackingLifecycle(() => stopNativeTrackingOwnedBy(lease));
  };
}

export function useLocationTracking(voyageId: string | null): void {
  const { session } = useAuth();
  const { status } = useLocationPermission();
  const userId = session?.user.id ?? null;

  useEffect(() => {
    if (!voyageId || !userId || status !== 'granted') return;

    if (Platform.OS === 'web') {
      let subscription: Location.LocationSubscription | null = null;
      let cancelled = false;

      Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.BestForNavigation,
          timeInterval: WATCH_TIME_INTERVAL_MS,
          distanceInterval: WATCH_DISTANCE_INTERVAL_M,
        },
        (position) => {
          const { latitude, longitude, heading } = position.coords;
          void reportLocationFix(voyageId, latitude, longitude, normalizeHeading(heading));
        },
      )
        .then((sub) => {
          if (cancelled) {
            sub.remove();
            return;
          }
          subscription = sub;
        })
        .catch(() => {
          // Fails open -- same discipline as the native path below.
        });

      return () => {
        cancelled = true;
        subscription?.remove();
      };
    }

    return acquireNativeTracking(voyageId);
  }, [voyageId, userId, status]);
}

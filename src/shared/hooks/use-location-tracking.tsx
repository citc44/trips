import * as Location from 'expo-location';
import { useEffect } from 'react';
import { Platform } from 'react-native';

import { BACKGROUND_LOCATION_TASK, reportLocationFix, setBackgroundLocationContext } from '@/shared/lib/background-location-task';
import { useAuth } from '@/shared/hooks/use-auth';
import { useLocationPermission } from '@/shared/hooks/use-location-permission';

// Documented assumption (PRD's own open question, "needs engineering
// input" -- not settled fact): balances live-feel against the battery-drain
// risk market research flagged as high-severity. Kept identical to Story
// 3.2's own foreground-only cadence rather than introducing a second,
// different background-specific interval without a clear mandate to do so.
const WATCH_TIME_INTERVAL_MS = 5000;
const WATCH_DISTANCE_INTERVAL_M = 20;

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
// share identical throttled-upsert + broadcast behavior.
function normalizeHeading(rawHeading: number | null | undefined): number | null {
  return rawHeading != null && rawHeading >= 0 ? rawHeading : null;
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
        { accuracy: Location.Accuracy.Balanced, timeInterval: WATCH_TIME_INTERVAL_MS, distanceInterval: WATCH_DISTANCE_INTERVAL_M },
        (position) => {
          const { latitude, longitude, heading } = position.coords;
          reportLocationFix(voyageId, userId, latitude, longitude, normalizeHeading(heading), new Date(position.timestamp).toISOString());
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

    // Restores the old watchPositionAsync-based hook's isCancelled guard,
    // adapted to startLocationUpdatesAsync/stopLocationUpdatesAsync's
    // shape: unlike a per-call subscription object, both calls target the
    // same constant task name and are independent, unawaited native calls.
    // Without this, a start() that resolves after this same effect
    // instance's own cleanup already ran would re-arm tracking for a
    // context that's already been torn down (Story 3.3 code review
    // finding). This does not fully serialize start/stop calls *across*
    // different effect instances (e.g. a very fast back-to-back Voyage
    // transition) -- that narrower residual race is deferred, since this
    // app's routing doesn't let voyageId flip directly between two active
    // Voyages without an intervening unmount.
    let cancelled = false;

    setBackgroundLocationContext({ voyageId, userId });

    Location.startLocationUpdatesAsync(BACKGROUND_LOCATION_TASK, {
      accuracy: Location.Accuracy.Balanced,
      timeInterval: WATCH_TIME_INTERVAL_MS,
      distanceInterval: WATCH_DISTANCE_INTERVAL_M,
      foregroundService: {
        notificationTitle: FOREGROUND_SERVICE_NOTIFICATION_TITLE,
        notificationBody: FOREGROUND_SERVICE_NOTIFICATION_BODY,
      },
    })
      .then(() => {
        if (!cancelled) return;
        // Cleanup already ran before this resolved -- correct the native
        // state rather than leaving tracking running for a superseded
        // context.
        setBackgroundLocationContext(null);
        Location.stopLocationUpdatesAsync(BACKGROUND_LOCATION_TASK).catch(() => {});
      })
      .catch(() => {
        // Swallowed on purpose -- fails open, matching this app's
        // established best-effort discipline for background/native-module
        // operations.
      });

    return () => {
      cancelled = true;
      // Context is always cleared, even if stopLocationUpdatesAsync itself
      // fails, so a stray task callback firing after cleanup has nothing
      // stale to report against.
      setBackgroundLocationContext(null);
      Location.stopLocationUpdatesAsync(BACKGROUND_LOCATION_TASK).catch(() => {});
    };
  }, [voyageId, userId, status]);
}

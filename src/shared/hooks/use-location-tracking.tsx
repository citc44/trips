import * as Location from 'expo-location';
import { useEffect } from 'react';

import { BACKGROUND_LOCATION_TASK, setBackgroundLocationContext } from '@/shared/lib/background-location-task';
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
export function useLocationTracking(voyageId: string | null): void {
  const { session } = useAuth();
  const { status } = useLocationPermission();
  const userId = session?.user.id ?? null;

  useEffect(() => {
    if (!voyageId || !userId || status !== 'granted') return;

    setBackgroundLocationContext({ voyageId, userId });

    Location.startLocationUpdatesAsync(BACKGROUND_LOCATION_TASK, {
      accuracy: Location.Accuracy.Balanced,
      timeInterval: WATCH_TIME_INTERVAL_MS,
      distanceInterval: WATCH_DISTANCE_INTERVAL_M,
      foregroundService: {
        notificationTitle: FOREGROUND_SERVICE_NOTIFICATION_TITLE,
        notificationBody: FOREGROUND_SERVICE_NOTIFICATION_BODY,
      },
    }).catch(() => {
      // Swallowed on purpose -- fails open, matching this app's established
      // best-effort discipline for background/native-module operations.
    });

    return () => {
      // Context is always cleared, even if stopLocationUpdatesAsync itself
      // fails, so a stray task callback firing after cleanup has nothing
      // stale to report against.
      setBackgroundLocationContext(null);
      Location.stopLocationUpdatesAsync(BACKGROUND_LOCATION_TASK).catch(() => {});
    };
  }, [voyageId, userId, status]);
}

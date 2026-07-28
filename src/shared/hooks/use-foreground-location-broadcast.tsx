import * as Location from 'expo-location';
import { useEffect, useRef } from 'react';

import { locationRepository } from '@/repositories/location-repository';
import { useAuth } from '@/shared/hooks/use-auth';
import { useLocationPermission } from '@/shared/hooks/use-location-permission';

// Documented assumption (PRD's own open question, "needs engineering
// input" -- not settled fact): balances live-feel against the battery-drain
// risk market research flagged as high-severity. Revisit with real
// battery-usage data before treating this as final.
const WATCH_TIME_INTERVAL_MS = 5000;
const WATCH_DISTANCE_INTERVAL_M = 20;
// Persisted cold-load row is written far less often than the live broadcast
// -- the ephemeral broadcast carries the "near-real-time" feel (AC #2), the
// persisted row only needs to be fresh enough to serve a reconnect/cold load.
const UPSERT_THROTTLE_MS = 30000;

// Fire-and-forget: no return value. Foreground-only by design (this story's
// own interim-scope decision) -- background-mode sending is Story 3.3's job
// (expo-task-manager, not built here). A Voyager whose OS permission isn't
// granted simply never calls watchPositionAsync at all, which is the entire
// mechanism behind Story 3.1's "marker doesn't render for others until
// resolved": there is no separate suppression flag anywhere in the data
// model, no data in means no marker out.
export function useForegroundLocationBroadcast(voyageId: string | null): void {
  const { session } = useAuth();
  const { status } = useLocationPermission();
  const userId = session?.user.id ?? null;
  const lastUpsertAtRef = useRef(0);

  useEffect(() => {
    if (!voyageId || !userId || status !== 'granted') return;

    let isCancelled = false;
    let subscription: { remove: () => void } | null = null;
    const broadcastChannel = locationRepository.createBroadcastChannel(voyageId);
    lastUpsertAtRef.current = 0;

    Location.watchPositionAsync(
      { accuracy: Location.Accuracy.Balanced, timeInterval: WATCH_TIME_INTERVAL_MS, distanceInterval: WATCH_DISTANCE_INTERVAL_M },
      (position) => {
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;
        // Some platforms report -1 as an "undetermined heading" sentinel
        // rather than null (code review finding) -- normalized here so a
        // stationary device's marker hides its chevron instead of rendering
        // it rotated to an invalid -1deg angle.
        const rawHeading = position.coords.heading;
        const heading = rawHeading != null && rawHeading >= 0 ? rawHeading : null;
        const updatedAt = new Date(position.timestamp).toISOString();

        broadcastChannel.send({ userId, lat, lng, heading, updatedAt });

        const now = Date.now();
        if (now - lastUpsertAtRef.current >= UPSERT_THROTTLE_MS) {
          lastUpsertAtRef.current = now;
          locationRepository.upsertLocation(voyageId, { lat, lng, heading });
        }
      },
    ).then((sub) => {
      if (isCancelled) {
        sub.remove();
        return;
      }
      subscription = sub;
    });

    return () => {
      isCancelled = true;
      subscription?.remove();
      broadcastChannel.unsubscribe();
    };
  }, [voyageId, userId, status]);
}

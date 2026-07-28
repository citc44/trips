import { useEffect, useState } from 'react';

import { locationRepository, type LiveLocation } from '@/repositories/location-repository';

type LiveLocationsState = {
  locations: Record<string, LiveLocation>;
  isLoading: boolean;
  hasError: boolean;
};

// Not a Context/Provider like use-active-voyage.tsx/use-profile.tsx -- this
// is a purely local concern of the one screen that renders a map, not an
// app-wide routing/onboarding input _layout.tsx needs, so a plain
// parameterized hook (voyageId in, live locations out) is the right shape.
export function useLiveLocations(voyageId: string | null): LiveLocationsState {
  const [locations, setLocations] = useState<Record<string, LiveLocation>>({});
  const [hasError, setHasError] = useState(false);
  // Derived isLoading (compared against the live voyageId), same pattern
  // use-active-voyage.tsx/use-profile.tsx established -- avoids ever needing
  // a synchronous setIsLoading(true) reset at the top of the effect body,
  // which would otherwise trip the react-hooks/set-state-in-effect rule.
  const [resolvedForVoyageId, setResolvedForVoyageId] = useState<string | null | undefined>(undefined);
  const isLoading = resolvedForVoyageId !== voyageId;

  useEffect(() => {
    if (!voyageId) {
      // Resolved via a microtask (not called synchronously in the effect
      // body) so this stays inside a promise callback, matching this
      // codebase's other hooks' established pattern and satisfying the
      // react-hooks/set-state-in-effect rule.
      let isEffectMounted = true;
      Promise.resolve().then(() => {
        if (!isEffectMounted) return;
        setLocations({});
        setHasError(false);
        setResolvedForVoyageId(null);
      });
      return () => {
        isEffectMounted = false;
      };
    }

    let isMounted = true;

    locationRepository.getLiveLocations(voyageId).then(({ data, error }) => {
      if (!isMounted) return;
      if (error || !data) {
        setHasError(true);
        setResolvedForVoyageId(voyageId);
        return;
      }
      const initial: Record<string, LiveLocation> = {};
      for (const location of data) {
        initial[location.userId] = location;
      }
      setLocations(initial);
      setHasError(false);
      setResolvedForVoyageId(voyageId);
    });

    const { unsubscribe } = locationRepository.subscribeToLocations(voyageId, (location) => {
      if (!isMounted) return;
      setLocations((prev) => {
        const existing = prev[location.userId];
        // A stale/delayed broadcast can't regress a fresher one already
        // rendered -- same conditional-upsert discipline the DB itself
        // applies (AD-3), mirrored here for the client-side merge.
        if (existing && existing.updatedAt >= location.updatedAt) {
          return prev;
        }
        return { ...prev, [location.userId]: location };
      });
    });

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, [voyageId]);

  return { locations, isLoading, hasError };
}

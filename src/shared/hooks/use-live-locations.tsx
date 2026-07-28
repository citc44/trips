import { useEffect, useState } from 'react';

import { MapMarker } from '@/constants/design-tokens';
import { locationRepository, type LiveLocation } from '@/repositories/location-repository';

export type TrailPoint = { lat: number; lng: number; updatedAt: string };

type LiveLocationsState = {
  locations: Record<string, LiveLocation>;
  // Recent positions per Voyager, newest last, pruned to MapMarker.trailLengthMs
  // -- the comet-trail's data source (AC1). Rendering the fading line itself
  // is the map screen's job; this hook only owns accumulating the points.
  trails: Record<string, TrailPoint[]>;
  isLoading: boolean;
  hasError: boolean;
};

// Not a Context/Provider like use-active-voyage.tsx/use-profile.tsx -- this
// is a purely local concern of the one screen that renders a map, not an
// app-wide routing/onboarding input _layout.tsx needs, so a plain
// parameterized hook (voyageId in, live locations out) is the right shape.
export function useLiveLocations(voyageId: string | null): LiveLocationsState {
  const [locations, setLocations] = useState<Record<string, LiveLocation>>({});
  const [trails, setTrails] = useState<Record<string, TrailPoint[]>>({});
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
        setTrails({});
        setHasError(false);
        setResolvedForVoyageId(null);
      });
      return () => {
        isEffectMounted = false;
      };
    }

    let isMounted = true;
    // Closure-local accumulators, not React state read via a functional
    // setState(prev => ...) updater -- scoped fresh to this exact effect run
    // (i.e. reset on every voyageId change), so they can never leak a
    // previous Voyage's positions into this one. Both the cold-load and
    // every broadcast merge through this same function (code review
    // finding: the cold-load previously called setLocations(initial)
    // unconditionally, discarding a broadcast that had already arrived and
    // was fresher than the cold-load's own snapshot).
    let current: Record<string, LiveLocation> = {};
    let currentTrails: Record<string, TrailPoint[]> = {};

    function mergeIn(location: LiveLocation) {
      const existing = current[location.userId];
      // A stale/delayed value can't regress a fresher one already rendered
      // -- same conditional-upsert discipline the DB itself applies (AD-3).
      if (existing && existing.updatedAt >= location.updatedAt) return;
      current = { ...current, [location.userId]: location };
      setLocations(current);

      const cutoff = new Date(location.updatedAt).getTime() - MapMarker.trailLengthMs;
      const priorTrail = currentTrails[location.userId] ?? [];
      const nextTrail = [...priorTrail, { lat: location.lat, lng: location.lng, updatedAt: location.updatedAt }].filter(
        (point) => new Date(point.updatedAt).getTime() >= cutoff,
      );
      currentTrails = { ...currentTrails, [location.userId]: nextTrail };
      setTrails(currentTrails);
    }

    locationRepository.getLiveLocations(voyageId).then(({ data, error }) => {
      if (!isMounted) return;
      if (error || !data) {
        setHasError(true);
        setResolvedForVoyageId(voyageId);
        return;
      }
      for (const location of data) {
        mergeIn(location);
      }
      setHasError(false);
      setResolvedForVoyageId(voyageId);
    });

    const { unsubscribe } = locationRepository.subscribeToLocations(voyageId, (location) => {
      if (!isMounted) return;
      mergeIn(location);
    });

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, [voyageId]);

  return { locations, trails, isLoading, hasError };
}

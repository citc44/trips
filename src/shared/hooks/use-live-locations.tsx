import { useEffect, useState } from 'react';
import { AppState } from 'react-native';

import { MapMarker } from '@/constants/design-tokens';
import { locationRepository, type LiveLocation } from '@/repositories/location-repository';
import { getLocationFreshness, type VoyagerFreshness } from '@/shared/lib/location-freshness';
import type { JourneyEventSignal } from '@/shared/types/voyage-message';

export type TrailPoint = { lat: number; lng: number; updatedAt: string };

// Code review finding: unlike trails (pruned by MapMarker.trailLengthMs),
// journeyEvents had no bound at all -- a multi-hour Voyage generating many
// automatic stop/manual-spotting events would grow this indefinitely. No
// per-Voyage retention policy is specified yet (that's Epic 6's job once a
// real consumer exists), so this is a safety cap, not a designed limit --
// same "keep only the newest N" discipline stop-monitor.ts already applies
// to its own pending-candidate queue.
const MAX_JOURNEY_EVENTS = 200;

type LiveLocationsState = {
  locations: Record<string, LiveLocation>;
  // Recent positions per Voyager, newest last, pruned to MapMarker.trailLengthMs
  // -- the comet-trail's data source (AC1). Rendering the fading line itself
  // is the map screen's job; this hook only owns accumulating the points.
  trails: Record<string, TrailPoint[]>;
  isLoading: boolean;
  hasError: boolean;
  // Story 3.5 AC1: the Realtime channel's own live connection health -- "can
  // we reach the server," not the device's generic network state. Starts
  // `true` (optimistic) so the normal, near-instant subscribe handshake on
  // every mount never flashes a false "reconnecting" note; only flips to
  // `false` on an actual CHANNEL_ERROR/TIMED_OUT/CLOSED signal.
  isConnected: boolean;
  // Incremented when the server reports a membership change, and whenever
  // reconnect/foreground recovery may have missed one. The map screen uses
  // it to refresh display names, roles, colors, joins, and removals without
  // coupling this location hook to voyageRepository.
  rosterRevision: number;
  // Incremented when this device must reconcile its own membership or the
  // parent Voyage lifecycle, rather than only refreshing marker metadata.
  lifecycleRevision?: number;
  freshness?: Record<string, VoyagerFreshness>;
  // Story 5.1 AC2: received journey.event.created broadcasts, deduplicated by
  // JourneyEventPayload.eventId (stable across a reconnect re-delivery).
  // Rendering/consuming these is Epic 6's job -- this hook only exposes them.
  journeyEvents: JourneyEventSignal[];
};

// Not a Context/Provider like use-active-voyage.tsx/use-profile.tsx -- this
// is a purely local concern of the one screen that renders a map, not an
// app-wide routing/onboarding input _layout.tsx needs, so a plain
// parameterized hook (voyageId in, live locations out) is the right shape.
export function useLiveLocations(voyageId: string | null, currentUserId: string | null = null): LiveLocationsState {
  const [locations, setLocations] = useState<Record<string, LiveLocation>>({});
  const [trails, setTrails] = useState<Record<string, TrailPoint[]>>({});
  const [journeyEvents, setJourneyEvents] = useState<JourneyEventSignal[]>([]);
  const [hasError, setHasError] = useState(false);
  const [isConnected, setIsConnected] = useState(true);
  const [rosterRevision, setRosterRevision] = useState(0);
  const [lifecycleRevision, setLifecycleRevision] = useState(0);
  const [presentUserIds, setPresentUserIds] = useState<Set<string>>(new Set());
  const [freshnessNow, setFreshnessNow] = useState(() => Date.now());
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
        setJourneyEvents([]);
        setHasError(false);
        setIsConnected(true);
        setRosterRevision(0);
        setLifecycleRevision(0);
        setPresentUserIds(new Set());
        setResolvedForVoyageId(null);
      });
      return () => {
        isEffectMounted = false;
      };
    }

    let isMounted = true;
    // Captured once as a local `string` -- TS's narrowing of the `voyageId`
    // parameter (via the `if (!voyageId) return` above) doesn't carry into
    // performRefresh()'s own function-declaration body below, since it's a
    // separate closure invoked later, not inline code right after the
    // narrowing check. Safe regardless: this whole effect re-runs from
    // scratch on every `voyageId` change (it's the effect's only dependency).
    const activeVoyageId = voyageId;
    let current: Record<string, LiveLocation> = {};
    let currentTrails: Record<string, TrailPoint[]> = {};
    let currentJourneyEvents: Record<string, JourneyEventSignal> = {};
    let refreshInFlight: Promise<void> | null = null;
    let refreshQueued = false;
    let wasDisconnected = false;

    // Reset for this Voyage -- otherwise a previous Voyage's disconnected
    // state, marker positions, or trails could carry over until the first
    // successful snapshot. Deferred via a microtask (not called
    // synchronously in the effect body), matching this codebase's
    // react-hooks/set-state-in-effect convention.
    Promise.resolve().then(() => {
      if (!isMounted) return;
      setLocations(current);
      setTrails(currentTrails);
      setJourneyEvents(Object.values(currentJourneyEvents));
      setHasError(false);
      setIsConnected(true);
      setRosterRevision(0);
      setLifecycleRevision(0);
    });

    // Story 5.1 AC2: keyed by eventId so a reconnect re-delivery of the same
    // durable journey event (AD-14) merges instead of duplicating -- same
    // discipline mergeIn already applies to locations.
    function mergeInJourneyEvent(event: JourneyEventSignal) {
      const merged = { ...currentJourneyEvents, [event.payload.eventId]: event };
      const entries = Object.entries(merged);
      // Object key insertion order is preserved for string keys (eventId is
      // a UUID, never a numeric-looking string), so slicing from the front
      // drops the oldest entries -- same intent as stop-monitor.ts's
      // `pending.slice(-10)`.
      currentJourneyEvents =
        entries.length > MAX_JOURNEY_EVENTS ? Object.fromEntries(entries.slice(entries.length - MAX_JOURNEY_EVENTS)) : merged;
      setJourneyEvents(Object.values(currentJourneyEvents));
    }
    // Closure-local accumulators, not React state read via a functional
    // setState(prev => ...) updater -- scoped fresh to this exact effect run
    // (i.e. reset on every voyageId change), so they can never leak a
    // previous Voyage's positions into this one. Both the cold-load and
    // every broadcast merge through this same function (code review
    // finding: the cold-load previously called setLocations(initial)
    // unconditionally, discarding a broadcast that had already arrived and
    // was fresher than the cold-load's own snapshot).
    function mergeIn(location: LiveLocation) {
      const existing = current[location.userId];
      // A stale/delayed value can't regress a fresher one already rendered
      // -- same conditional-upsert discipline the DB itself applies (AD-3).
      if (existing) {
        const sameSession = existing.senderSessionId && existing.senderSessionId === location.senderSessionId;
        if (sameSession && existing.sequence != null && location.sequence != null && existing.sequence >= location.sequence) return;
        const existingCapturedAt = existing.capturedAt ?? existing.updatedAt;
        const nextCapturedAt = location.capturedAt ?? location.updatedAt;
        if (!sameSession && existingCapturedAt >= nextCapturedAt) return;
      }
      current = { ...current, [location.userId]: location };
      setLocations(current);

      const pointTime = location.capturedAt ?? location.updatedAt;
      const cutoff = new Date(pointTime).getTime() - MapMarker.trailLengthMs;
      const priorTrail = currentTrails[location.userId] ?? [];
      const nextTrail = [...priorTrail, { lat: location.lat, lng: location.lng, updatedAt: pointTime }].filter(
        (point) => new Date(point.updatedAt).getTime() >= cutoff,
      );
      currentTrails = { ...currentTrails, [location.userId]: nextTrail };
      setTrails(currentTrails);
    }

    async function performRefresh(): Promise<void> {
      try {
        const { data, error } = await locationRepository.getLiveLocations(activeVoyageId);
        if (!isMounted) return;
        if (error || !data) {
          setHasError(true);
          setResolvedForVoyageId(activeVoyageId);
          return;
        }
        for (const location of data) {
          mergeIn(location);
        }
        setHasError(false);
        setResolvedForVoyageId(activeVoyageId);
      } catch {
        if (!isMounted) return;
        setHasError(true);
        setResolvedForVoyageId(activeVoyageId);
      }
    }

    // Coalesce repeated connectivity/AppState signals. If one arrives while
    // a snapshot is already in flight, perform exactly one follow-up read
    // after it settles; that follow-up is important because the first query
    // may have started before the reconnect/foreground transition.
    function refreshLocations(): Promise<void> {
      if (refreshInFlight) {
        refreshQueued = true;
        return refreshInFlight;
      }

      refreshInFlight = performRefresh().finally(() => {
        refreshInFlight = null;
        if (refreshQueued && isMounted) {
          refreshQueued = false;
          void refreshLocations();
        }
      });
      return refreshInFlight;
    }

    void refreshLocations();

    // The sender's own marker must never wait for a network round trip.
    // reportLocationFix publishes every accepted GPS fix to this process-local
    // listener before attempting WebSocket/snapshot delivery.
    const unsubscribeLocal = locationRepository.subscribeToLocalLocations?.(activeVoyageId, (location) => {
      if (isMounted) mergeIn(location);
    }) ?? (() => {});

    const { unsubscribe } = locationRepository.subscribeToLocations(
      voyageId,
      (location) => {
        if (!isMounted) return;
        mergeIn(location);
      },
      (status) => {
        if (!isMounted) return;
        if (status === 'disconnected') {
          const firstDisconnectedSignal = !wasDisconnected;
          wasDisconnected = true;
          setIsConnected(false);
          // A private-channel authorization loss looks like a connection
          // failure. Reconcile active membership immediately so a departed
          // user cannot sit on a cached map waiting for a future reconnect.
          if (firstDisconnectedSignal) {
            setLifecycleRevision((revision) => revision + 1);
          }
          return;
        }

        setIsConnected(true);
        if (wasDisconnected) {
          wasDisconnected = false;
          void refreshLocations();
          setRosterRevision((revision) => revision + 1);
          setLifecycleRevision((revision) => revision + 1);
        }
      },
      (change) => {
        if (!isMounted) return;
        setRosterRevision((revision) => revision + 1);
        if (currentUserId && change.userId === currentUserId && change.isActive === false) {
          setLifecycleRevision((revision) => revision + 1);
        }
      },
      (change) => {
        if (!isMounted || change.status !== 'ended') return;
        setLifecycleRevision((revision) => revision + 1);
      },
      currentUserId,
      setPresentUserIds,
      (event) => {
        if (!isMounted) return;
        mergeInJourneyEvent(event);
      },
    );

    const freshnessTimer = setInterval(() => setFreshnessNow(Date.now()), 1000);

    let previousAppState = AppState.currentState;
    const appStateSubscription = AppState.addEventListener('change', (nextAppState) => {
      const becameActive = nextAppState === 'active' && previousAppState !== 'active';
      previousAppState = nextAppState;
      if (!isMounted || !becameActive) return;
      void refreshLocations();
      setRosterRevision((revision) => revision + 1);
      setLifecycleRevision((revision) => revision + 1);
    });

    return () => {
      isMounted = false;
      appStateSubscription.remove();
      clearInterval(freshnessTimer);
      unsubscribeLocal();
      unsubscribe();
    };
  }, [voyageId, currentUserId]);

  const freshness = Object.fromEntries(
    Object.entries(locations).map(([userId, location]) => [userId, getLocationFreshness(location, presentUserIds.has(userId), freshnessNow)]),
  );
  return { locations, trails, isLoading, hasError, isConnected, rosterRevision, lifecycleRevision, freshness, journeyEvents };
}

import Mapbox, { Camera, LineLayer, MapView, MarkerView, ShapeSource } from '@rnmapbox/maps';
import { router } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  ActionDrawer as ActionDrawerTokens,
  CutToGameplayMotion,
  Hamburger,
  HudBar,
  MapBanner,
  MapMarker,
  PlayerColors,
  Rounded,
  Spacing,
  StatusPill,
  Typography,
  WayfinderColors,
} from '@/constants/design-tokens';
import { initMapbox } from '@/lib/mapbox';
import type { LiveLocation } from '@/repositories/location-repository';
import { voyageRepository, type VoyageMember } from '@/repositories/voyage-repository';
import { ActionDrawer } from '@/shared/components/action-drawer';
import { IgnitionButton } from '@/shared/components/ignition-button';
import { Toast } from '@/shared/components/toast';
import { useActiveVoyage } from '@/shared/hooks/use-active-voyage';
import { useAuth } from '@/shared/hooks/use-auth';
import { useJustStartedVoyage } from '@/shared/hooks/use-just-started-voyage';
import { useLiveLocations, type TrailPoint } from '@/shared/hooks/use-live-locations';
import { useLocationTracking } from '@/shared/hooks/use-location-tracking';
import { usePendingEntryTransition } from '@/shared/hooks/use-pending-entry-transition';
import { formatDistanceMiles, haversineMiles } from '@/shared/lib/geo';
import { outbox } from '@/shared/services/outbox/outbox';

const GENERIC_ERROR = 'Something went wrong. Please try again.';
const DEFAULT_ZOOM = 13;

// Wayfinder v2 (Story 4.3): switched from Mapbox.StyleURL.Dark to .Street.
// A prior headless-browser investigation (see this file's git history)
// confirmed .Dark was *missing* from @rnmapbox/maps' web shim and that
// .Street/.Satellite were the ones actually defined there -- that's the
// basis for using .Street here too, not a fresh re-verification of this
// specific switch. If that assumption turns out stale, this no longer
// needs the separate literal-URL/Platform branch the old Dark style did.
// DESIGN.md's
// `map-*` tokens describe a literal stylized-flat-terrain look that would
// need a custom Mapbox Studio style asset -- out of this repo's reach, so
// Street is the closest built-in approximation, not a pixel-match of the
// mockup's flat CSS terrain (Story 4.3's own Scope decision).
const MAP_STYLE_URL = Mapbox.StyleURL.Street;

// None of endVoyage/grantOrganizerStatus/removeVoyager's own RPCs ever
// legitimately return this code themselves -- every real business/conflict
// error carries a specific errcode (END03, ORG01, REM02, etc.). `'unknown'`
// only appears via toRepositoryError()'s own fallback, which fires when
// supabase-js didn't have a real Postgres error to report -- exactly what a
// genuine network-level failure looks like. Same classifier the outbox
// service itself uses (src/shared/services/outbox/outbox.ts) -- kept in
// sync deliberately, not by import, since this is a one-line check.
function isNetworkFailure(error: { code: string }): boolean {
  return error.code === 'unknown';
}

function formatElapsed(createdAt: string, now: number): string {
  const totalSeconds = Math.max(0, Math.floor((now - new Date(createdAt).getTime()) / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
}

function VoyagerMarker({
  member,
  location,
  reduceMotion,
  onPress,
}: {
  member: VoyageMember;
  location: LiveLocation;
  reduceMotion: boolean;
  onPress: () => void;
}) {
  // useState's lazy initializer (not useRef(...).current) -- same "create
  // once, stable across re-renders" semantic, but reading a plain state
  // variable during render (rather than a ref's .current) doesn't trip
  // react-hooks/refs the way sign-in.tsx's pre-existing Animated.Value ref
  // does.
  const [pulseValue] = useState(() => new Animated.Value(0));
  const ringColor = member.playerColor ? PlayerColors[member.playerColor] : WayfinderColors.inkSecondary;

  useEffect(() => {
    if (reduceMotion) return;
    const loop = Animated.loop(
      Animated.timing(pulseValue, { toValue: 1, duration: 1600, easing: Easing.out(Easing.ease), useNativeDriver: true }),
    );
    loop.start();
    return () => {
      loop.stop();
      pulseValue.setValue(0);
    };
  }, [reduceMotion, pulseValue]);

  const initial = (member.displayName ?? '?').charAt(0).toUpperCase();

  return (
    <MarkerView coordinate={[location.lng, location.lat]} anchor={{ x: 0.5, y: 0.5 }}>
      <Pressable
        testID={`voyager-marker-${member.userId}`}
        accessibilityRole="button"
        accessibilityLabel={`${member.displayName ?? 'Voyager'}, riding${member.playerColor ? `, ${member.playerColor} marker` : ''}`}
        onPress={onPress}
        style={styles.markerHitRegion}
      >
        {reduceMotion ? (
          // Accessibility floor: live state is never color-only. Under
          // Reduce Motion, a filled-vs-hollow ring distinction replaces the
          // pulse animation rather than just omitting the "live" signal.
          <View style={[styles.markerReduceMotionRing, { borderColor: ringColor }]} />
        ) : (
          <Animated.View
            style={[
              styles.markerPulse,
              {
                borderColor: ringColor,
                opacity: pulseValue.interpolate({ inputRange: [0, 1], outputRange: [0.6, 0] }),
                transform: [{ scale: pulseValue.interpolate({ inputRange: [0, 1], outputRange: [1, 1.8] }) }],
              },
            ]}
          />
        )}
        <View style={[styles.markerDot, { backgroundColor: ringColor }]}>
          <Text style={styles.markerInitial}>{initial}</Text>
        </View>
        {location.heading != null ? (
          <View
            style={[styles.markerChevron, { borderBottomColor: MapMarker.chevronColor, transform: [{ rotate: `${location.heading}deg` }] }]}
          />
        ) : null}
        <Text style={styles.markerLabel}>{member.userId === location.userId && member.displayName ? member.displayName : ''}</Text>
      </Pressable>
    </MarkerView>
  );
}

// AC1's "comet-trail" (code review finding: the trail tokens existed in
// design-tokens.ts but were never actually rendered). A real Mapbox
// ShapeSource + LineLayer, not an approximation within MarkerView -- a
// multi-point geographic trail needs to pan/zoom with the map itself, which
// only a real map layer can do. Rendered as one fixed-opacity line per
// Voyager (a deliberate simplification of the token's per-point fade --
// Mapbox GL line-gradient expressions would be the fuller version, left for
// a follow-up rather than guessed at without live testing).
function VoyagerTrail({ userId, color, points }: { userId: string; color: string; points: TrailPoint[] }) {
  if (points.length < 2) return null;

  const shape: GeoJSON.Feature = {
    type: 'Feature',
    properties: {},
    geometry: { type: 'LineString', coordinates: points.map((point) => [point.lng, point.lat]) },
  };

  return (
    <ShapeSource id={`trail-source-${userId}`} shape={shape}>
      <LineLayer
        id={`trail-layer-${userId}`}
        style={{ lineColor: color, lineWidth: 3, lineOpacity: 0.4, lineCap: 'round', lineJoin: 'round' }}
      />
    </ShapeSource>
  );
}

// action-drawer row (Story 4.2, DESIGN.md#components) -- plain
// Pressable+Text, not IgnitionButton (which is still Night-Drive-styled
// and would look broken against the drawer's new white panel; re-skinning
// IgnitionButton itself is Story 4.3/4.4's job, not this one's).
function DrawerRow({
  testID,
  label,
  onPress,
  disabled = false,
  variant = 'default',
}: {
  testID: string;
  label: string;
  onPress: () => void;
  disabled?: boolean;
  variant?: 'default' | 'primary' | 'danger';
}) {
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={[
        styles.drawerRow,
        variant === 'primary' && styles.drawerRowPrimary,
        variant === 'danger' && styles.drawerRowDanger,
        disabled && styles.drawerRowDisabled,
      ]}
    >
      <Text
        style={[
          styles.drawerRowLabel,
          variant === 'primary' && styles.drawerRowLabelPrimary,
          variant === 'danger' && styles.drawerRowLabelDanger,
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

// The real Live Map (Story 3.2). Reached via _layout.tsx's
// `route === 'home' && hasActiveVoyage && !needsLocationPermission` guard,
// so `activeVoyage` should always be populated when this renders. Organizer
// actions (End Voyage, Grant Organizer, Remove Voyager) that used to be this
// screen's entire default view now live behind the HUD's "..." control
// (`showOrganizerMenu`) -- functional relocation only, their own internal
// logic/copy is unchanged from Story 2.6.
export default function ActiveVoyageScreen() {
  const { activeVoyage, refetch } = useActiveVoyage();
  const { session } = useAuth();
  const voyageId = activeVoyage?.voyage.id ?? null;

  const { locations, trails, hasError: hasLocationsError, isConnected } = useLiveLocations(voyageId);
  useLocationTracking(voyageId);
  // Feeds map-banner's/hud-bar's own top/bottom padding directly (Story
  // 4.3) -- react-native-safe-area-context's web polyfill always reports
  // insets.top/bottom: 0 (no notch to simulate), which is correct there;
  // native reports the real device inset. No separate masking strip is
  // needed now that the banner/hud-bar are themselves opaque, non-floating,
  // full-width bars painting through their own inset padding.
  const insets = useSafeAreaInsets();

  // "Cut to gameplay" entry transition (EXPERIENCE.md#Motion & Transitions,
  // Story 4.3) -- fires only when this mount was reached via join-code.tsx's
  // or voyage-joined.tsx's own Continue button (both call
  // triggerEntryTransition() right before the navigation that lands here),
  // never on a cold relaunch mid-Voyage. Captured once via a lazy
  // initializer, not read fresh on every render: consumeEntryTransition()
  // below flips the context's own value back to false almost immediately
  // after mount, and re-reading it later would incorrectly look like no
  // transition was ever pending.
  const { hasPendingEntryTransition, consumeEntryTransition } = usePendingEntryTransition();
  const [showEntryTransition] = useState(() => hasPendingEntryTransition);
  const [flashProgress] = useState(() => new Animated.Value(0));
  const [entryProgress] = useState(() => new Animated.Value(0));
  // "Invite More Voyagers" (below, in the drawer) re-enters join-code.tsx
  // mid-Voyage -- that screen's own Stack.Protected guard (_layout.tsx) is
  // keyed on this same flag, so this push needs it marked too, exactly like
  // destination-picker.tsx's original entry does (code review finding: this
  // second call site was missed when Task 7 first wired the flag through,
  // silently breaking the mid-Voyage re-invite feature).
  const { markVoyageStarted } = useJustStartedVoyage();

  useEffect(() => {
    if (!hasPendingEntryTransition) return;
    // Deferred via microtask, not called synchronously in the effect body --
    // same react-hooks/set-state-in-effect workaround this codebase already
    // uses elsewhere (use-live-locations.tsx, action-drawer.tsx). Updates
    // PendingEntryTransitionProvider's own state, not this component's --
    // consumed once so a later remount (e.g. a genuine second Voyage
    // started in the same session) doesn't replay a stale flag.
    Promise.resolve().then(() => consumeEntryTransition());
  }, [hasPendingEntryTransition, consumeEntryTransition]);

  const [showConfirm, setShowConfirm] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [members, setMembers] = useState<VoyageMember[]>([]);
  const [membersError, setMembersError] = useState<string | null>(null);
  const [grantingUserIds, setGrantingUserIds] = useState<Set<string>>(new Set());
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [removeTarget, setRemoveTarget] = useState<VoyageMember | null>(null);
  const [isRemoving, setIsRemoving] = useState(false);
  const [removeError, setRemoveError] = useState<string | null>(null);
  const [showOrganizerMenu, setShowOrganizerMenu] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [isTogglingRole, setIsTogglingRole] = useState(false);
  const [roleError, setRoleError] = useState<string | null>(null);
  const [reduceMotion, setReduceMotion] = useState(false);
  // Distinct from `reduceMotion` itself (code review finding): that value
  // defaults to `false` until `AccessibilityInfo.isReduceMotionEnabled()`
  // resolves, so gating the entry transition on `!reduceMotion` alone let a
  // Reduce-Motion user see a blank/transitioning first frame before the
  // real value landed and corrected it -- a real violation of
  // EXPERIENCE.md's "Live Map simply appears" requirement. Until this
  // flips true, the transition doesn't start at all (content renders at
  // its normal, fully-visible rest state); this delay is a native async
  // bridge call, not a network request, so in practice it resolves well
  // under a frame and isn't perceptible as a startup delay in the common
  // (non-Reduce-Motion) case.
  const [reduceMotionResolved, setReduceMotionResolved] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const isMounted = useRef(true);
  const cameraRef = useRef<Camera>(null);
  // Guards against Animated.timing().start() firing more than once if
  // `reduceMotion` itself changes again later (the OS setting toggling
  // mid-session, via reduceMotionChanged) after the transition has already
  // started -- the transition is a one-shot entrance, not a state to
  // continuously resync.
  const hasStartedEntryTransitionRef = useRef(false);

  useEffect(() => {
    if (!showEntryTransition || !reduceMotionResolved || reduceMotion || hasStartedEntryTransitionRef.current) return;
    hasStartedEntryTransitionRef.current = true;
    Animated.timing(flashProgress, {
      toValue: 1,
      duration: CutToGameplayMotion.flashDurationMs,
      easing: Easing.bezier(...CutToGameplayMotion.flashEasing),
      useNativeDriver: true,
    }).start();
    Animated.timing(entryProgress, {
      toValue: 1,
      duration: CutToGameplayMotion.mapEnterDurationMs,
      delay: CutToGameplayMotion.mapEnterDelayMs,
      easing: Easing.bezier(...CutToGameplayMotion.mapEnterEasing),
      useNativeDriver: true,
    }).start();
  }, [showEntryTransition, reduceMotionResolved, reduceMotion, flashProgress, entryProgress]);

  useEffect(() => {
    return () => {
      isMounted.current = false;
    };
  }, []);

  // Scoped to this screen's own mount, not module scope (code review
  // finding: the previous module-scope call contradicted mapbox.ts's own
  // documented design intent -- Expo Router's file-based route registration
  // may import this module eagerly at app startup regardless of whether the
  // user ever reaches an active Voyage, which would turn a missing token
  // into an app-wide crash instead of one confined to Live Map).
  //
  // A useState lazy initializer, not a useEffect: verified via a headless
  // browser that on web, MapView's componentDidMount constructs the
  // underlying mapbox-gl Map synchronously and requires the access token to
  // already be set at that exact moment -- a plain useEffect in this parent
  // fires *after* the child's own mount, so the token was still unset when
  // MapView tried to initialize ("An API access token is required to use
  // Mapbox GL"). A lazy initializer runs synchronously during this
  // component's own first render, before any child mounts, closing that
  // ordering gap. Native never hit this (its token isn't consulted until an
  // actual network request, well after any mount ordering), which is why
  // this went unnoticed until web testing.
  useState(() => {
    initMapbox();
    return null;
  });

  useEffect(() => {
    let isEffectMounted = true;
    AccessibilityInfo.isReduceMotionEnabled().then((enabled) => {
      if (isEffectMounted) {
        setReduceMotion(enabled);
        setReduceMotionResolved(true);
      }
    });
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    return () => {
      isEffectMounted = false;
      subscription.remove();
    };
  }, []);

  // Only ticks while the elapsed text isn't covered by the action drawer's
  // opaque scrim (code review finding: this previously ran unconditionally,
  // causing a once-a-second re-render even while it was covered). Story 4.2:
  // showConfirm/removeTarget no longer independently unmount the HUD -- they're
  // just internal drawer steps while showOrganizerMenu is still true -- so
  // showOrganizerMenu alone is now the correct (and sufficient) gate.
  useEffect(() => {
    if (showOrganizerMenu) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [showOrganizerMenu]);

  const loadMembers = useRef(async (id: string) => {
    const { data, error: fetchError } = await voyageRepository.getVoyageMembers(id);
    if (!isMounted.current) return;
    if (fetchError || !data) {
      setMembersError(fetchError?.message ?? GENERIC_ERROR);
      return;
    }
    setMembers(data);
  });

  useEffect(() => {
    if (!voyageId) return;
    loadMembers.current(voyageId);
  }, [voyageId]);

  // Reassigned after every render (in an effect with no dependency array, not
  // synchronously during render -- react-hooks/refs forbids writing a ref's
  // .current during render, the same rule this file's own marker-pulse
  // Animated.Value already had to work around) so it always closes over the
  // latest `members`/`voyageId`. The separate effect below only calls this
  // stable ref, so it doesn't need those values in its own dependency array.
  const flushOutbox = useRef(async () => {});
  useEffect(() => {
    flushOutbox.current = async () => {
      const result = await outbox.flush();
      if (!isMounted.current) return;

      // Accumulated, not set per-iteration -- a single flush pass can
      // process more than one item, and setToastMessage overwriting itself
      // in a loop would silently lose every message but the last (code
      // review finding). A joined single toast is a minimal, correct fix,
      // not a full multi-toast queue -- this Toast component only ever
      // shows one message at a time.
      const messages: string[] = [];

      for (const { item, data } of result.succeeded) {
        if (!isMounted.current) return;
        if (item.kind === 'end_voyage') {
          const endedData = data as { destination: string; createdAt: string; endedAt: string | null; voyagerCount: number };
          await refetch();
          if (!isMounted.current) return;
          resetDrawerState();
          router.push({
            pathname: '/voyage-ended',
            params: {
              destination: endedData.destination,
              createdAt: endedData.createdAt,
              endedAt: endedData.endedAt ?? '',
              voyagerCount: String(endedData.voyagerCount),
            },
          });
          // The Voyage session just ended and this screen is navigating
          // away -- any other queued items for it (a narrow, already-
          // disclosed duplicate-enqueue scenario) are no longer meaningful
          // to keep processing against a now-defunct roster.
          return;
        } else if (item.kind === 'grant_organizer_status') {
          // The outbox only carries the target user's id, not their display
          // name -- look it up from the (possibly stale, pre-refresh) members
          // list, falling back gracefully if they've since fallen out of it.
          const grantedMember = members.find((m) => m.userId === item.payload.targetUserId);
          messages.push(`${grantedMember?.displayName ?? 'A Voyager'} is now an Organizer`);
          if (voyageId) await loadMembers.current(voyageId);
          if (!isMounted.current) return;
        } else if (item.kind === 'remove_voyager') {
          messages.push('A queued Voyager removal finished.');
          if (voyageId) await loadMembers.current(voyageId);
          if (!isMounted.current) return;
        }
      }

      for (const { message } of result.conflicts) {
        messages.push(message);
      }

      if (messages.length > 0) {
        setToastMessage(messages.join(' • '));
      }
    };
  });

  // Unconditional on mount -- covers items persisted from a previous app
  // session, regardless of what isConnected happens to read at that exact
  // instant (flush() itself degrades gracefully if genuinely offline, same
  // as any other attempt). In the common case (isConnected starts `true`)
  // this overlaps with the effect below and briefly double-attempts a
  // flush -- harmless, since a flush on an already-empty/already-flushed
  // queue is a cheap no-op.
  useEffect(() => {
    flushOutbox.current();
  }, []);

  // Fires on every reconnect (AC2: "flushes... on reconnect").
  useEffect(() => {
    if (isConnected) {
      flushOutbox.current();
    }
  }, [isConnected]);

  const markers = useMemo(
    () => members.filter((member) => locations[member.userId]).map((member) => ({ member, location: locations[member.userId] })),
    [members, locations],
  );

  // Camera's `defaultSettings` prop (below) only ever sets the zoom, never a
  // center, so the very first render always starts at whatever Mapbox's own
  // default camera position is -- fine on native, where a later
  // location/marker update was assumed to naturally recenter things, but
  // verified via a headless browser that @rnmapbox/maps' web shim's Camera
  // doesn't read `defaultSettings` at all (only flat `centerCoordinate`/
  // `zoomLevel` props, which this screen never sets), so on web the map
  // silently stayed on Mapbox's global default view forever. Fixed the same
  // way for both platforms: once real marker positions first arrive, center
  // on them exactly once -- reusing handleRecenter's own averaging math, not
  // duplicating it. Once-only via the ref (not every markers change) so
  // this never fights a user's own subsequent pan/zoom/manual recenter.
  const hasAutoCenteredRef = useRef(false);
  useEffect(() => {
    if (hasAutoCenteredRef.current || markers.length === 0 || !cameraRef.current) return;
    hasAutoCenteredRef.current = true;
    const avgLng = markers.reduce((sum, m) => sum + m.location.lng, 0) / markers.length;
    const avgLat = markers.reduce((sum, m) => sum + m.location.lat, 0) / markers.length;
    cameraRef.current.moveTo([avgLng, avgLat], 0);
  }, [markers]);

  if (!activeVoyage) {
    return null;
  }

  const isOrganizer = activeVoyage.role === 'organizer';

  // Null whenever this Voyage's destination has no picked coordinates (a
  // free-text destination from before search existed, or one this Voyage
  // was started with by manual entry) -- callers treat null as "omit the
  // distance readout entirely," not an error or a zero distance.
  const destinationCoords =
    activeVoyage.voyage.destinationLat != null && activeVoyage.voyage.destinationLng != null
      ? { lat: activeVoyage.voyage.destinationLat, lng: activeVoyage.voyage.destinationLng }
      : null;

  function getDistanceLabel(userId: string): string | null {
    if (!destinationCoords) return null;
    const location = locations[userId];
    if (!location) return null;
    return formatDistanceMiles(haversineMiles({ lat: location.lat, lng: location.lng }, destinationCoords));
  }

  async function handleEndVoyage() {
    setIsSubmitting(true);
    setError(null);

    try {
      const { data, error: endError } = await voyageRepository.endVoyage(activeVoyage!.voyage.id);
      if (endError) {
        if (isNetworkFailure(endError)) {
          // Enqueue unconditionally -- must happen whether or not this
          // component is still mounted by the time the RPC resolves (code
          // review finding: an isMounted check gating the enqueue itself,
          // not just the state updates after it, would silently drop the
          // write on an unmount racing a network failure -- exactly the
          // scenario this outbox exists to survive). Only the subsequent
          // React state updates are guarded.
          await outbox.enqueue({ kind: 'end_voyage', payload: { voyageId: activeVoyage!.voyage.id } });
          if (!isMounted.current) return;
          setError("Queued -- this will finish once you're back online.");
          setIsSubmitting(false);
          return;
        }
        if (!isMounted.current) return;
        setError(endError.message);
        setIsSubmitting(false);
        return;
      }
      if (!data) {
        if (!isMounted.current) return;
        setError(GENERIC_ERROR);
        setIsSubmitting(false);
        return;
      }
      await refetch();
      if (!isMounted.current) return;
      // Defensive: real navigation unmounts this screen anyway, but resetting
      // the drawer's own state keeps it consistent if that ever changes.
      resetDrawerState();
      router.push({
        pathname: '/voyage-ended',
        params: {
          destination: data.destination,
          createdAt: data.createdAt,
          endedAt: data.endedAt ?? '',
          voyagerCount: String(data.voyagerCount),
        },
      });
    } catch {
      await outbox.enqueue({ kind: 'end_voyage', payload: { voyageId: activeVoyage!.voyage.id } });
      if (!isMounted.current) return;
      setError("Queued -- this will finish once you're back online.");
      setIsSubmitting(false);
    }
  }

  async function handleGrantOrganizer(member: VoyageMember) {
    setGrantingUserIds((prev) => new Set(prev).add(member.userId));
    setMembersError(null);

    try {
      const { error: grantError } = await voyageRepository.grantOrganizerStatus(activeVoyage!.voyage.id, member.userId);
      if (grantError) {
        if (isNetworkFailure(grantError)) {
          // Enqueue before the isMounted check -- see handleEndVoyage's note.
          await outbox.enqueue({
            kind: 'grant_organizer_status',
            payload: { voyageId: activeVoyage!.voyage.id, targetUserId: member.userId },
          });
          if (!isMounted.current) return;
          setMembersError(`Queued -- ${member.displayName ?? 'they'} will be granted Organizer status once you're back online.`);
          return;
        }
        if (!isMounted.current) return;
        setMembersError(grantError.message);
        return;
      }
      if (!isMounted.current) return;
      setToastMessage(`${member.displayName ?? 'They'} is now an Organizer`);
      await loadMembers.current(activeVoyage!.voyage.id);
    } catch {
      await outbox.enqueue({
        kind: 'grant_organizer_status',
        payload: { voyageId: activeVoyage!.voyage.id, targetUserId: member.userId },
      });
      if (!isMounted.current) return;
      setMembersError(`Queued -- ${member.displayName ?? 'they'} will be granted Organizer status once you're back online.`);
    } finally {
      if (isMounted.current) {
        setGrantingUserIds((prev) => {
          const next = new Set(prev);
          next.delete(member.userId);
          return next;
        });
      }
    }
  }

  function handleRetryMembers() {
    if (voyageId) {
      setMembersError(null);
      loadMembers.current(voyageId);
    }
  }

  async function handleRemoveVoyager() {
    if (!removeTarget) return;
    const target = removeTarget;
    setIsRemoving(true);
    setRemoveError(null);

    try {
      const { error: removeErr } = await voyageRepository.removeVoyager(activeVoyage!.voyage.id, target.userId);
      if (removeErr) {
        if (isNetworkFailure(removeErr)) {
          // Enqueue before the isMounted check -- see handleEndVoyage's note.
          await outbox.enqueue({
            kind: 'remove_voyager',
            payload: { voyageId: activeVoyage!.voyage.id, targetUserId: target.userId },
          });
          if (!isMounted.current) return;
          setRemoveTarget(null);
          setMembersError(`Queued -- ${target.displayName ?? 'they'} will be removed once you're back online.`);
          return;
        }
        if (!isMounted.current) return;
        setRemoveError(removeErr.message);
        return;
      }
      if (!isMounted.current) return;
      setRemoveTarget(null);
      await loadMembers.current(activeVoyage!.voyage.id);
    } catch {
      await outbox.enqueue({
        kind: 'remove_voyager',
        payload: { voyageId: activeVoyage!.voyage.id, targetUserId: target.userId },
      });
      if (!isMounted.current) return;
      setRemoveTarget(null);
      setMembersError(`Queued -- ${target.displayName ?? 'they'} will be removed once you're back online.`);
    } finally {
      if (isMounted.current) {
        setIsRemoving(false);
      }
    }
  }

  // Full reset of every piece of drawer step-state (which confirm step, and
  // any error left over from a failed attempt) back to the drawer's default
  // (menu) step, nothing stale carried forward.
  function resetDrawerState() {
    setShowOrganizerMenu(false);
    setShowConfirm(false);
    setRemoveTarget(null);
    setError(null);
    setRemoveError(null);
  }

  // Fires the instant a close is requested (tap, scrim, Android back) --
  // only flips `showOrganizerMenu`, which is what actually starts the
  // drawer's close animation. Deliberately does NOT reset showConfirm/
  // removeTarget here (code review finding): drawerStep is derived from
  // those on every render, so resetting them synchronously would recompute
  // ActionDrawer's children mid-animation, visibly flashing back to the
  // menu step while the panel is still sliding out. handleDrawerClosed
  // (below) does that reset once the animation has actually finished.
  function handleCloseDrawer() {
    setShowOrganizerMenu(false);
  }

  // Fires once the drawer's close animation has actually finished (right
  // before its content unmounts) -- safe to reset step-level state now,
  // since nothing is visibly animating anymore. Ensures re-opening always
  // lands back on the menu step, not whatever confirm step (or its error)
  // was showing when it was last dismissed.
  function handleDrawerClosed() {
    resetDrawerState();
  }

  function handleRecenter() {
    if (markers.length === 0 || !cameraRef.current) return;
    const avgLng = markers.reduce((sum, m) => sum + m.location.lng, 0) / markers.length;
    const avgLat = markers.reduce((sum, m) => sum + m.location.lat, 0) / markers.length;
    cameraRef.current.moveTo([avgLng, avgLat], 500);
  }

  // Serves both the first-landing role prompt's choice and every later
  // status-pill tap -- same "call RPC, then re-fetch the roster" pattern as
  // handleGrantOrganizer/handleRemoveVoyager. Once members refreshes,
  // myMember.travelRole is non-null, so the prompt disappears on its own --
  // no separate dismiss flag needed.
  async function handleSetTravelRole(role: 'riding' | 'driving') {
    setIsTogglingRole(true);
    setRoleError(null);

    try {
      const { error: setRoleErr } = await voyageRepository.setTravelRole(activeVoyage!.voyage.id, role);
      if (!isMounted.current) return;
      if (setRoleErr) {
        setRoleError(setRoleErr.message);
        return;
      }
      await loadMembers.current(activeVoyage!.voyage.id);
    } finally {
      if (isMounted.current) {
        setIsTogglingRole(false);
      }
    }
  }

  const isSelf = (memberId: string) => memberId === session?.user.id;

  const drawerStep: 'menu' | 'end-voyage-confirm' | 'remove-confirm' = removeTarget
    ? 'remove-confirm'
    : showConfirm
      ? 'end-voyage-confirm'
      : 'menu';

  const selectedMember = selectedUserId ? members.find((m) => m.userId === selectedUserId) : null;

  // `myMember` stays `undefined` until `members` has loaded at least once
  // (it starts as `[]`), so `showRolePrompt` is correctly `false` before the
  // roster fetch resolves -- no separate "members loaded" flag needed.
  const myMember = members.find((m) => m.userId === session?.user.id);
  const myTravelRole = myMember?.travelRole ?? null;
  const showRolePrompt = !!myMember && myTravelRole === null;

  // "Cut to gameplay" entry transition -- only meaningful while it's
  // actually playing; harmless (and never rendered) once
  // showEntryTransition/reduceMotion say it shouldn't be, per the effect
  // above that gates whether these Animated.Values ever move at all.
  const flashOpacity = flashProgress.interpolate({
    inputRange: [...CutToGameplayMotion.flashKeyframeStops],
    outputRange: [...CutToGameplayMotion.flashOpacityStops],
  });
  const flashScale = flashProgress.interpolate({
    inputRange: [...CutToGameplayMotion.flashKeyframeStops],
    outputRange: [...CutToGameplayMotion.flashScaleStops],
  });
  const mapEnterScale = entryProgress.interpolate({ inputRange: [0, 1], outputRange: [CutToGameplayMotion.mapEnterScaleFrom, 1] });
  const isEntryTransitionActive = showEntryTransition && reduceMotionResolved && !reduceMotion;

  return (
    // Not screenStyles.container -- that's a shared style whose dark
    // (Night Drive) background still backs every screen Story 4.4 hasn't
    // re-skinned yet. This screen's own root needs a Wayfinder-family
    // background instead (matches hud-bar's own surface-secondary fog, the
    // most likely color to briefly show through before map tiles/content
    // finish laying out).
    <View style={styles.rootContainer}>
      {/* This group wraps the map/HUD together with the drawer itself, kept
          separate from the toast below -- the drawer's own root carries
          accessibilityViewIsModal (see action-drawer.tsx), which per iOS/
          RNTL's modal semantics hides every *host sibling* of that node from
          assistive tech. The map/HUD are meant to be hidden that way while
          the drawer is open (reinforced explicitly below too); the toast is
          not -- it announces the result of actions taken from inside the
          drawer (e.g. Grant Organizer) and must stay reachable regardless of
          drawer state, so it lives outside this group entirely rather than
          as the drawer's direct sibling (code review finding). */}
      <Animated.View
        style={[
          styles.mainContentGroup,
          isEntryTransitionActive ? { opacity: entryProgress, transform: [{ scale: mapEnterScale }] } : null,
        ]}
        // Code review finding: without this, a tap on the hamburger/status-
        // pill/recenter/a marker could land while the screen is still
        // fading/scaling in from the "cut to gameplay" transition -- the
        // content underneath isn't meant to be interactive until it's
        // actually settled at rest.
        pointerEvents={isEntryTransitionActive ? 'none' : 'auto'}
      >
      {/* The map/HUD/overlays below stay mounted while the action drawer is
          open (that's the whole point of Story 4.2), so they need to be
          explicitly hidden from assistive tech while it's up -- otherwise a
          screen-reader user can navigate into content that's visually
          covered by the drawer's opaque scrim (code review finding).
          importantForAccessibility is Android's mechanism for this;
          accessibilityElementsHidden is iOS's. */}
      <View
        style={styles.mainContent}
        importantForAccessibility={showOrganizerMenu ? 'no-hide-descendants' : 'auto'}
        accessibilityElementsHidden={showOrganizerMenu}
      >
      {/* map-banner (DESIGN.md#components, Wayfinder v2 -- Story 4.3): solid,
          non-floating, docked to the very top -- replaces the old floating
          hud-top HudCard. Its own top padding (not a separate skyStrip mask)
          absorbs the notch/status-bar inset, the same way action-drawer.tsx
          handles its panel's paddingTop, so the banner's solid background
          paints all the way to the physical top edge. */}
      <View testID="hud-top" style={[styles.mapBanner, { paddingTop: insets.top + Spacing['3'] }]}>
        <View style={styles.mapBannerRow}>
          <Pressable
            testID="organizer-menu-button"
            accessibilityRole="button"
            accessibilityLabel="Organizer menu"
            onPress={() => setShowOrganizerMenu(true)}
            style={({ pressed }) => [styles.hamburgerButton, pressed && styles.pressedScale]}
          >
            <Text style={styles.hamburgerIcon}>{'☰'}</Text>
          </Pressable>
          <View style={styles.mapBannerDestWrap}>
            <Text style={styles.mapBannerEyebrow}>Voyage destination</Text>
            <View style={styles.mapBannerDestRow}>
              <View style={styles.mapBannerPinIcon}>
                <Text style={styles.mapBannerPinIconLabel}>{'📍'}</Text>
              </View>
              <Text style={styles.mapBannerDestName} numberOfLines={1}>
                {activeVoyage.voyage.destination}
              </Text>
            </View>
          </View>
          {/* Replaces the old "{n} Voyager(s) riding with you" subtext with
              the mockup's count badge -- accessibilityLabel keeps the words
              a screen reader needs, since the rendered glyph alone doesn't
              (code review-style fidelity note, same reasoning Story 4.2
              applied to its own icon-only controls). */}
          <View
            testID="voyager-count-badge"
            accessible
            accessibilityLabel={`${markers.length} ${markers.length === 1 ? 'Voyager' : 'Voyagers'} riding with you`}
            style={styles.mapBannerCount}
          >
            {/* ☺ matches mockups/key-live-map.html's .voyagers-count content
                exactly ("3☺") -- code review finding: this was previously
                just the bare number. */}
            <Text style={styles.mapBannerCountLabel}>{markers.length}☺</Text>
          </View>
        </View>
        {/* Subtle, not a blocking banner (AC1) -- deliberately not an
            alarm-red treatment; a calm status note, not an error. Markers
            keep rendering whatever `locations` last held -- useLiveLocations
            simply stops receiving new broadcasts while disconnected, it
            never clears them, so no extra logic is needed here to preserve
            last-known positions. Neither state appears in the static
            mockup, but both are binding EXPERIENCE.md behavior (State
            Patterns: "Connectivity loss mid-drive") -- not dropped, only
            restyled for the new banner. */}
        {!isConnected ? (
          <Text testID="reconnecting-note" style={styles.mapBannerReconnecting}>
            Reconnecting…
          </Text>
        ) : null}
        {hasLocationsError ? (
          <Text testID="locations-error" style={styles.mapBannerError}>
            Couldn&apos;t load everyone&apos;s position. Pull down or reopen the trip to try again.
          </Text>
        ) : null}
      </View>

      <View style={styles.mapWrapper}>
        <MapView testID="live-map" style={styles.map} styleURL={MAP_STYLE_URL}>
          <Camera ref={cameraRef} defaultSettings={{ zoomLevel: DEFAULT_ZOOM }} />
          {markers.map(({ member }) => (
            <VoyagerTrail
              key={`trail-${member.userId}`}
              userId={member.userId}
              color={member.playerColor ? PlayerColors[member.playerColor] : WayfinderColors.inkSecondary}
              points={trails[member.userId] ?? []}
            />
          ))}
          {markers.map(({ member, location }) => (
            <VoyagerMarker
              key={member.userId}
              member={member}
              location={location}
              reduceMotion={reduceMotion}
              onPress={() => setSelectedUserId(member.userId)}
            />
          ))}
        </MapView>

        {/* No mockup shows this control (key-live-map.html omits it
            entirely) -- kept in its established top-right-of-the-map
            placement, re-skinned to the new tokens, per DESIGN.md's
            status-pill spec (still a required, binding component; the
            mockup gap is a mockup omission, not an instruction to remove
            it). */}
        <View style={styles.statusPillWrapper} pointerEvents="box-none">
          <Pressable
            testID="status-pill"
            accessibilityRole="button"
            // Describes current state, not the destination of the next tap --
            // a screen reader user must be able to hear their actual travel
            // role from this control, the same way a sighted user reads it at
            // a glance (DESIGN.md: "the single most safety-critical control").
            // The "switch to X" framing lives in accessibilityHint instead,
            // which doesn't override the accessible name the way
            // accessibilityLabel would (code review finding).
            accessibilityLabel={myTravelRole === 'driving' ? 'Driving' : 'Riding'}
            accessibilityHint={myTravelRole === 'driving' ? 'Switches to Riding' : 'Switches to Driving'}
            disabled={isTogglingRole}
            onPress={() => handleSetTravelRole(myTravelRole === 'driving' ? 'riding' : 'driving')}
            style={[styles.statusPill, myTravelRole === 'driving' ? styles.statusPillDriving : styles.statusPillRiding]}
          >
            <Text style={[styles.statusPillLabel, { color: myTravelRole === 'driving' ? StatusPill.driving.foreground : StatusPill.riding.foreground }]}>
              {myTravelRole === 'driving' ? 'Driving' : 'Riding'}
            </Text>
          </Pressable>
          {roleError && !showRolePrompt ? (
            <Text testID="status-pill-error" style={styles.statusPillErrorText}>
              {roleError}
            </Text>
          ) : null}
        </View>
      </View>

      {/* hud-bar (DESIGN.md#components, Wayfinder v2 -- Story 4.3): solid,
          non-floating, docked to the bottom edge -- replaces the old
          floating hud-bottom HudCard and its always-visible per-Voyager
          roster (Story 4.3's own Scope decision: that roster is dropped,
          not relocated, to match mockups/key-live-map.html exactly --
          names/roles stay reachable via the Action Drawer's member list,
          distance via the marker peek card below). */}
      <View testID="hud-bottom" style={[styles.hudBar, { paddingBottom: insets.bottom + Spacing['3'] }]}>
        <View style={styles.hudBarStatChip}>
          <Text style={styles.hudBarStatLabel}>Elapsed</Text>
          <Text style={styles.hudBarStatValue}>{formatElapsed(activeVoyage.voyage.createdAt, now)}</Text>
        </View>
        <Pressable
          testID="recenter-button"
          accessibilityRole="button"
          accessibilityLabel="Recenter"
          onPress={handleRecenter}
          style={({ pressed }) => [styles.recenterButton, pressed && styles.pressedScale]}
        >
          <Text style={styles.recenterButtonIcon}>{'◎'}</Text>
        </Pressable>
      </View>

      {selectedMember ? (
        <View testID="marker-peek-card" style={styles.peekScrim}>
          <View style={styles.peekCard}>
            <View style={styles.peekHeaderRow}>
              <View style={styles.peekNameRow}>
                <View
                  testID="marker-peek-color-swatch"
                  style={[
                    styles.peekColorSwatch,
                    { backgroundColor: selectedMember.playerColor ? PlayerColors[selectedMember.playerColor] : WayfinderColors.inkSecondary },
                  ]}
                />
                <Text style={styles.peekName}>{selectedMember.displayName ?? 'Voyager'}</Text>
              </View>
              <Text
                testID="marker-peek-close-button"
                accessibilityRole="button"
                onPress={() => setSelectedUserId(null)}
                style={styles.peekClose}
              >
                {'✕'}
              </Text>
            </View>
            <Text style={styles.peekStatus}>
              {selectedMember.role === 'organizer' ? 'Organizer' : selectedMember.travelRole === 'driving' ? 'Driving' : 'Riding'}
            </Text>
            {getDistanceLabel(selectedMember.userId) ? (
              <Text testID="marker-peek-distance" style={styles.peekStatus}>
                {`${getDistanceLabel(selectedMember.userId)} from ${activeVoyage.voyage.destination}`}
              </Text>
            ) : null}
          </View>
        </View>
      ) : null}

      {showRolePrompt ? (
        <View testID="role-prompt" style={styles.peekScrim}>
          <View style={styles.peekCard}>
            <Text style={styles.confirmTitle}>Riding or driving?</Text>
            <Text style={styles.confirmSub}>
              Pick one — you can switch anytime with your status pill, no need to ask again.
            </Text>
            <IgnitionButton
              testID="role-prompt-riding-button"
              label="Riding"
              disabled={isTogglingRole}
              onPress={() => handleSetTravelRole('riding')}
            />
            <IgnitionButton
              testID="role-prompt-driving-button"
              label="Driving"
              disabled={isTogglingRole}
              onPress={() => handleSetTravelRole('driving')}
            />
            {roleError ? (
              <Text testID="role-prompt-error" style={styles.peekError}>
                {roleError}
              </Text>
            ) : null}
          </View>
        </View>
      ) : null}
      </View>

      <ActionDrawer
        visible={showOrganizerMenu}
        onClose={handleCloseDrawer}
        onClosed={handleDrawerClosed}
        reduceMotion={reduceMotion}
        closeButtonTestID="organizer-menu-close-button"
      >
        {drawerStep === 'menu' ? (
          <>
            <Text style={styles.drawerTitle}>Voyage actions</Text>
            <Text style={styles.drawerSubtitle}>You&apos;re on your way to {activeVoyage.voyage.destination}.</Text>
            {activeVoyage.voyage.joinCode ? (
              <DrawerRow
                testID="invite-more-voyagers-button"
                label="Invite More Voyagers"
                onPress={() => {
                  markVoyageStarted();
                  router.push({
                    pathname: '/join-code',
                    params: { destination: activeVoyage.voyage.destination, joinCode: activeVoyage.voyage.joinCode! },
                  });
                }}
              />
            ) : null}
            {isOrganizer ? <DrawerRow testID="end-voyage-button" label="End Voyage" variant="danger" onPress={() => setShowConfirm(true)} /> : null}

            <View testID="drawer-member-list" style={styles.drawerMemberList}>
              {members.map((member) => (
                <View key={member.userId} style={styles.drawerMemberRow}>
                  <Text style={styles.drawerMemberName}>{member.displayName ?? 'Voyager'}</Text>
                  <View style={styles.drawerMemberRowActions}>
                    {/* Code review finding: this was Organizer-only before,
                        silently dropping the only remaining UI surface for
                        a member's Driving/Riding status once hud-bottom's
                        roster was removed -- mirrors marker-peek-card's own
                        existing role/travelRole precedent. */}
                    <Text testID={`drawer-member-role-${member.userId}`} style={styles.drawerMemberRoleLabel}>
                      {member.role === 'organizer' ? 'Organizer' : member.travelRole === 'driving' ? 'Driving' : 'Riding'}
                    </Text>
                    {member.role !== 'organizer' && isOrganizer ? (
                      <Pressable
                        testID={`grant-organizer-button-${member.userId}`}
                        accessibilityRole="button"
                        accessibilityState={{ disabled: grantingUserIds.has(member.userId) }}
                        disabled={grantingUserIds.has(member.userId)}
                        onPress={() => handleGrantOrganizer(member)}
                        style={[styles.drawerGrantButton, grantingUserIds.has(member.userId) && styles.drawerRowDisabled]}
                      >
                        <Text style={styles.drawerGrantButtonLabel}>Grant Organizer</Text>
                      </Pressable>
                    ) : null}
                    {isOrganizer && !isSelf(member.userId) ? (
                      <Text
                        testID={`remove-voyager-button-${member.userId}`}
                        accessibilityRole="button"
                        accessibilityState={{ disabled: false }}
                        onPress={() => setRemoveTarget(member)}
                        style={styles.drawerRemoveLabel}
                      >
                        Remove
                      </Text>
                    ) : null}
                  </View>
                </View>
              ))}
            </View>
            {membersError ? (
              <Text testID="voyager-list-error" style={styles.drawerError}>
                {membersError}
              </Text>
            ) : null}
            {membersError && members.length === 0 ? (
              <DrawerRow testID="voyager-list-retry-button" label="Retry" onPress={handleRetryMembers} />
            ) : null}
            <Text style={styles.drawerFooter}>Every journey tells a story.</Text>
          </>
        ) : null}

        {drawerStep === 'end-voyage-confirm' ? (
          <>
            <Text style={styles.drawerEyebrow}>End Voyage</Text>
            <Text style={styles.drawerConfirmTitle}>Ready to close out the trip?</Text>
            <Text style={styles.drawerConfirmSub}>
              New recording stops right away. Anything already in progress finishes normally and makes it into the story.
            </Text>
            {/* variant="primary" (not "danger") -- this is the ceremonial,
                primary confirm action; EXPERIENCE.md UJ-4 explicitly
                contrasts it with Remove Voyager's destructive treatment
                below (code review finding). */}
            <DrawerRow testID="confirm-end-voyage-button" label="End Voyage" variant="primary" disabled={isSubmitting} onPress={handleEndVoyage} />
            <DrawerRow
              testID="keep-going-button"
              label="Keep going"
              disabled={isSubmitting}
              onPress={() => {
                setShowConfirm(false);
                setError(null);
              }}
            />
            {error ? (
              <Text testID="end-voyage-error" style={styles.drawerError}>
                {error}
              </Text>
            ) : null}
          </>
        ) : null}

        {drawerStep === 'remove-confirm' && removeTarget ? (
          <>
            <Text style={styles.drawerConfirmTitle}>Remove {removeTarget.displayName ?? 'them'} from this Voyage?</Text>
            <DrawerRow testID="confirm-remove-voyager-button" label="Remove" variant="danger" disabled={isRemoving} onPress={handleRemoveVoyager} />
            <DrawerRow
              testID="keep-voyager-button"
              label="Never mind"
              disabled={isRemoving}
              onPress={() => {
                setRemoveTarget(null);
                setRemoveError(null);
              }}
            />
            {removeError ? (
              <Text testID="remove-voyager-error" style={styles.drawerError}>
                {removeError}
              </Text>
            ) : null}
          </>
        ) : null}
      </ActionDrawer>
      </Animated.View>

      {/* Single toast for both synchronous handler successes (e.g. Grant
          Organizer) and async flush-triggered results (Story 3.5) -- the
          action drawer is now an overlay within this same persistent tree
          (not a separate full-screen), so one render site covers both,
          replacing the old organizer-menu's own separate copy. Grant
          Organizer's toast in particular fires almost exclusively while the
          drawer is open (it's the only place to trigger it), so this needs
          an explicit zIndex above the drawer's own (scrim 20 / panel 21) --
          without it, the toast has no stacking guarantee and can render
          invisibly behind the open drawer (code review finding). */}
      {toastMessage ? (
        <View style={styles.toastWrapper} pointerEvents="box-none">
          <Toast testID="outbox-toast" message={toastMessage} onDismiss={() => setToastMessage(null)} />
        </View>
      ) : null}

      {/* "Cut to gameplay" flash (EXPERIENCE.md#Motion & Transitions, Story
          4.3) -- the topmost layer while playing, above the toast's own
          zIndex 30. pointerEvents="none": nothing here is interactive, and
          it must never block a tap on what's revealed underneath as it
          fades. Not conditionally unmounted once its own animation finishes
          -- flashOpacity's own keyframe stops (0, 1, 0) already end at fully
          transparent, so it simply sits inert afterward, the same way
          action-drawer.tsx's scrim/panel don't need special-case cleanup
          once settled at rest. */}
      {isEntryTransitionActive ? (
        <Animated.View
          testID="cut-to-gameplay-flash"
          pointerEvents="none"
          style={[styles.cutToGameplayFlash, { opacity: flashOpacity, transform: [{ scale: flashScale }] }]}
        >
          <Text style={styles.cutToGameplayFlashLabel} numberOfLines={1}>
            {activeVoyage.voyage.destination}
          </Text>
        </Animated.View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  // Still used by role-prompt (untouched by this story's behavior). Colors
  // switched to WayfinderColors as part of Task 6's peekCard re-skin --
  // role-prompt renders inside peekCard, which is now a solid white
  // (surface-primary) card; the old Colors.inkPrimary/inkSecondary are
  // Night Drive's light-on-dark text tones and would be nearly invisible on
  // a white background. The old showConfirm/showOrganizerMenu screens' own
  // use of these two (plus the removed `eyebrow` style, which role-prompt
  // never referenced) moved into the new drawer's own drawer*-prefixed
  // styles below instead (code review finding: an earlier version of this
  // comment incorrectly attributed eyebrow's continued use to role-prompt).
  confirmTitle: {
    marginTop: Spacing['3'],
    color: WayfinderColors.inkPrimary,
    fontFamily: Typography.display.fontFamily,
    fontSize: Typography.display.fontSize,
    fontWeight: Typography.display.fontWeight,
    lineHeight: Typography.display.lineHeight,
  },
  confirmSub: {
    marginTop: Spacing['4'],
    color: WayfinderColors.inkSecondary,
    fontFamily: Typography.body.fontFamily,
    fontSize: Typography.body.fontSize,
    lineHeight: Typography.body.lineHeight,
  },
  pressedScale: {
    transform: [{ scale: 0.9 }],
  },
  hamburgerButton: {
    width: Hamburger.size,
    height: Hamburger.size,
    borderRadius: Hamburger.radius,
    backgroundColor: Hamburger.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hamburgerIcon: {
    color: Hamburger.iconColor,
    fontSize: 18,
    fontWeight: '700',
  },
  drawerTitle: {
    color: ActionDrawerTokens.ink,
    fontFamily: Typography.headline.fontFamily,
    fontSize: 19,
    fontWeight: '700',
    marginBottom: 4,
  },
  drawerSubtitle: {
    color: ActionDrawerTokens.inkSecondary,
    fontFamily: Typography.body.fontFamily,
    fontSize: 12,
    marginBottom: 18,
  },
  drawerEyebrow: {
    color: ActionDrawerTokens.inkSecondary,
    fontFamily: Typography.label.fontFamily,
    fontSize: Typography.label.fontSize,
    fontWeight: Typography.label.fontWeight,
    letterSpacing: Typography.label.letterSpacing,
    textTransform: 'uppercase',
  },
  drawerConfirmTitle: {
    marginTop: Spacing['2'],
    color: ActionDrawerTokens.ink,
    fontFamily: Typography.headline.fontFamily,
    fontSize: Typography.headline.fontSize,
    fontWeight: Typography.headline.fontWeight,
  },
  drawerConfirmSub: {
    marginTop: Spacing['3'],
    marginBottom: Spacing['3'],
    color: ActionDrawerTokens.inkSecondary,
    fontFamily: Typography.body.fontFamily,
    fontSize: Typography.body.fontSize,
  },
  drawerMemberList: {
    width: '100%',
    gap: Spacing['3'],
    marginTop: Spacing['3'],
  },
  drawerMemberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing['2'],
  },
  drawerMemberName: {
    flexShrink: 1,
    color: ActionDrawerTokens.ink,
    fontFamily: Typography.body.fontFamily,
    fontSize: 14,
  },
  drawerMemberRowActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing['2'],
  },
  drawerMemberRoleLabel: {
    color: ActionDrawerTokens.inkSecondary,
    fontFamily: Typography.label.fontFamily,
    fontSize: 11,
    fontWeight: Typography.label.fontWeight,
    textTransform: 'uppercase',
  },
  drawerRemoveLabel: {
    color: ActionDrawerTokens.rowBackgroundDangerText,
    fontFamily: Typography.body.fontFamily,
    fontSize: 13,
    // Restored to Spacing['3'] (was shrunk to Spacing['1'] -- a real
    // touch-target regression against EXPERIENCE.md's Accessibility Floor
    // for a destructive, hard-to-undo action; code review finding).
    padding: Spacing['3'],
  },
  drawerError: {
    marginTop: Spacing['2'],
    color: ActionDrawerTokens.rowBackgroundDangerText,
    fontFamily: Typography.body.fontFamily,
    fontSize: Typography.body.fontSize,
  },
  drawerFooter: {
    marginTop: Spacing['6'],
    color: ActionDrawerTokens.footerText,
    fontSize: 11,
    fontStyle: 'italic',
  },
  // Values transcribed directly from the mockup's real .drawer-row CSS, not
  // approximated to the Rounded/Spacing scale (code review finding -- see
  // ActionDrawer token's own comment in design-tokens.ts).
  drawerRow: {
    borderRadius: ActionDrawerTokens.rowRadius,
    backgroundColor: ActionDrawerTokens.rowBackground,
    paddingVertical: ActionDrawerTokens.rowPaddingVertical,
    paddingHorizontal: ActionDrawerTokens.rowPaddingHorizontal,
    marginBottom: ActionDrawerTokens.rowMarginBottom,
  },
  drawerRowPrimary: {
    backgroundColor: ActionDrawerTokens.rowBackgroundPrimary,
  },
  drawerRowDanger: {
    backgroundColor: ActionDrawerTokens.rowBackgroundDanger,
  },
  drawerRowDisabled: {
    opacity: 0.5,
  },
  drawerRowLabel: {
    color: ActionDrawerTokens.ink,
    fontFamily: Typography.body.fontFamily,
    fontSize: ActionDrawerTokens.rowFontSize,
    fontWeight: '600',
  },
  drawerRowLabelPrimary: {
    color: ActionDrawerTokens.rowBackgroundPrimaryText,
  },
  drawerRowLabelDanger: {
    color: ActionDrawerTokens.rowBackgroundDangerText,
  },
  drawerGrantButton: {
    borderRadius: ActionDrawerTokens.rowRadius,
    backgroundColor: ActionDrawerTokens.rowBackgroundPrimary,
    paddingVertical: Spacing['1'],
    paddingHorizontal: Spacing['2'],
  },
  drawerGrantButtonLabel: {
    color: ActionDrawerTokens.rowBackgroundPrimaryText,
    fontFamily: Typography.label.fontFamily,
    fontSize: 11,
    fontWeight: '700',
  },
  rootContainer: {
    flex: 1,
    backgroundColor: WayfinderColors.surfaceSecondary,
  },
  mainContentGroup: {
    flex: 1,
  },
  cutToGameplayFlash: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 40,
    backgroundColor: WayfinderColors.accentPrimary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cutToGameplayFlashLabel: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 3,
    textTransform: 'uppercase',
    opacity: 0.9,
  },
  mainContent: {
    flex: 1,
  },
  toastWrapper: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 30,
    justifyContent: 'flex-end',
    padding: Spacing.gutter,
  },
  mapWrapper: {
    flex: 1,
    position: 'relative',
  },
  map: {
    flex: 1,
  },
  statusPillWrapper: {
    position: 'absolute',
    top: Spacing.gutter,
    right: Spacing.gutter,
    alignItems: 'flex-end',
    gap: Spacing['1'],
  },
  statusPill: {
    minHeight: StatusPill.minHeight,
    minWidth: StatusPill.minWidth,
    borderRadius: StatusPill.radius,
    paddingHorizontal: Spacing['4'],
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
  },
  statusPillRiding: {
    backgroundColor: StatusPill.riding.background,
    borderColor: StatusPill.riding.borderColor,
  },
  // No glow -- Wayfinder has no glow treatment anywhere (DESIGN.md#Elevation
  // & Depth); the old shadow*/elevation glow properties are gone, not
  // re-colored.
  statusPillDriving: {
    backgroundColor: StatusPill.driving.background,
    borderColor: StatusPill.driving.background,
  },
  statusPillLabel: {
    fontFamily: Typography.label.fontFamily,
    fontSize: Typography.label.fontSize,
    fontWeight: Typography.label.fontWeight,
  },
  statusPillErrorText: {
    maxWidth: 140,
    textAlign: 'right',
    color: WayfinderColors.error,
    fontFamily: Typography.label.fontFamily,
    fontSize: Typography.label.fontSize,
  },
  // map-banner (mockups/key-live-map.html .banner) -- solid, non-floating,
  // docked to the top. paddingTop is set inline (insets.top + Spacing['3']).
  mapBanner: {
    minHeight: MapBanner.height,
    backgroundColor: MapBanner.background,
    justifyContent: 'center',
    paddingHorizontal: Spacing['4'],
    paddingBottom: Spacing['3'],
    gap: Spacing['1'],
  },
  mapBannerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing['3'],
  },
  mapBannerDestWrap: {
    flex: 1,
  },
  mapBannerEyebrow: {
    color: MapBanner.eyebrowColor,
    fontFamily: Typography.label.fontFamily,
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  mapBannerDestRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing['2'],
  },
  mapBannerPinIcon: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: MapBanner.pinIconBackground,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mapBannerPinIconLabel: {
    fontSize: 12,
  },
  mapBannerDestName: {
    flex: 1,
    color: MapBanner.destNameColor,
    fontFamily: Typography.headline.fontFamily,
    fontSize: 24,
    fontWeight: '700',
  },
  // Reuses Hamburger.size/radius, not a coincidence -- the mockup's
  // .voyagers-count measures identically to .hamburger (42x42, 12px radius),
  // so this borrows those dimension fields rather than duplicating the same
  // two literals in a new token.
  mapBannerCount: {
    width: Hamburger.size,
    height: Hamburger.size,
    borderRadius: Hamburger.radius,
    backgroundColor: MapBanner.voyagerCountBackground,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mapBannerCountLabel: {
    color: '#FFFFFF',
    fontFamily: Typography.label.fontFamily,
    fontSize: 13,
    fontWeight: '700',
  },
  mapBannerReconnecting: {
    color: MapBanner.eyebrowColor,
    fontFamily: Typography.label.fontFamily,
    fontSize: Typography.label.fontSize,
  },
  mapBannerError: {
    color: '#FFFFFF',
    fontFamily: Typography.label.fontFamily,
    fontSize: Typography.label.fontSize,
  },
  // hud-bar (mockups/key-live-map.html .hud) -- solid, non-floating, docked
  // to the bottom. paddingBottom is set inline (insets.bottom + Spacing['3']).
  hudBar: {
    minHeight: HudBar.height,
    backgroundColor: HudBar.background,
    borderTopWidth: 1,
    borderTopColor: HudBar.borderTopColor,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.gutter,
    paddingTop: Spacing['3'],
  },
  hudBarStatChip: {
    gap: Spacing['1'],
  },
  hudBarStatLabel: {
    color: WayfinderColors.inkSecondary,
    fontFamily: Typography.label.fontFamily,
    fontSize: 10.5,
    fontWeight: '700',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  hudBarStatValue: {
    color: WayfinderColors.inkPrimary,
    fontFamily: Typography.statNumeral.fontFamily,
    fontSize: 26,
    fontWeight: '700',
  },
  recenterButton: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: HudBar.recenterBackground,
    alignItems: 'center',
    justifyContent: 'center',
  },
  recenterButtonIcon: {
    color: '#FFFFFF',
    fontSize: 22,
  },
  markerHitRegion: {
    width: MapMarker.hitRegion,
    height: MapMarker.hitRegion,
    alignItems: 'center',
    justifyContent: 'center',
  },
  markerPulse: {
    position: 'absolute',
    width: MapMarker.size,
    height: MapMarker.size,
    borderRadius: MapMarker.radius,
    borderWidth: MapMarker.ringWidth,
  },
  markerReduceMotionRing: {
    position: 'absolute',
    width: MapMarker.size,
    height: MapMarker.size,
    borderRadius: MapMarker.radius,
    borderWidth: MapMarker.ringWidth,
    backgroundColor: 'transparent',
  },
  // Fill is the per-Voyager player color itself, passed inline
  // (backgroundColor) -- a structural inversion from Night Drive's neutral-
  // fill/colored-ring treatment (see design-tokens.ts's MapMarker comment).
  // shadowRadius/shadowOpacity below are a literal transcription of the
  // mockup's `.avatar` box-shadow (`0 2px 4px 0 #10182833`) -- a soft,
  // blurred shadow, which reads as in tension with DESIGN.md's Elevation &
  // Depth section ("flat offset shadows... not soft drop shadows"). Per
  // this story's own fidelity rule, the mockup wins on *how it looks*; this
  // is the same class of DESIGN.md/mockup drift already flagged for
  // MapMarker.size (40px token vs. the mockup's real 44px).
  markerDot: {
    width: MapMarker.size,
    height: MapMarker.size,
    borderRadius: MapMarker.radius,
    borderWidth: MapMarker.ringWidth,
    borderColor: MapMarker.ringBorderColor,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: WayfinderColors.inkPrimary,
    shadowOpacity: 0.2,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  markerInitial: {
    color: '#FFFFFF',
    fontFamily: Typography.label.fontFamily,
    fontSize: Typography.label.fontSize,
    fontWeight: Typography.label.fontWeight,
  },
  // Always ink-primary, not per-player (mockups/key-live-map.html .chevron
  // is a fixed dark triangle regardless of marker color).
  // Dimensions match the mockup's real .chevron exactly (6/6/10px,
  // top:-12px) -- corrected from the Night Drive original's 5/5/8px/-6px
  // approximation as part of this story's re-skin, not just its color.
  markerChevron: {
    position: 'absolute',
    top: -12,
    width: 0,
    height: 0,
    borderLeftWidth: 6,
    borderRightWidth: 6,
    borderBottomWidth: 10,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
  },
  markerLabel: {
    position: 'absolute',
    bottom: -18,
    backgroundColor: MapMarker.chevronColor,
    color: '#FFFFFF',
    fontSize: 10.5,
    fontWeight: '700',
    paddingHorizontal: Spacing['2'],
    paddingVertical: 2,
    borderRadius: 8,
    overflow: 'hidden',
  },
  // Solid navy scrim (reusing action-drawer's own scrim value), not a
  // translucent overlay -- Wayfinder has no transparency anywhere (Story
  // 4.3's Scope decision; no mockup exists for this overlay, re-skinned by
  // analogy to action-drawer's established solid-scrim pattern).
  peekScrim: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: ActionDrawerTokens.scrimColor,
    justifyContent: 'flex-end',
  },
  // shadow* below is DESIGN.md's `card` token's flat offset shadow
  // (`0 2px 0 border-hairline`) -- code review finding: this was missing
  // entirely despite Task 6's own explicit "flat shadow, no blur/glow"
  // instruction. Direction flipped to -2 (upward), not the token's literal
  // +2: unlike a normal card, peekCard is anchored to the bottom screen
  // edge with only its top edge exposed (rounded corners are top-only), so
  // the shadow needs to read at that exposed edge, not the hidden bottom
  // one.
  peekCard: {
    backgroundColor: WayfinderColors.surfacePrimary,
    borderTopLeftRadius: Rounded.lg,
    borderTopRightRadius: Rounded.lg,
    borderTopWidth: 1,
    borderColor: WayfinderColors.borderHairline,
    padding: Spacing['5'],
    gap: Spacing['2'],
    shadowColor: WayfinderColors.borderHairline,
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 2,
  },
  peekHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  peekNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing['2'],
  },
  peekColorSwatch: {
    width: 14,
    height: 14,
    borderRadius: 7,
  },
  peekName: {
    color: WayfinderColors.inkPrimary,
    fontFamily: Typography.headline.fontFamily,
    fontSize: Typography.headline.fontSize,
    fontWeight: Typography.headline.fontWeight,
  },
  peekClose: {
    color: WayfinderColors.inkSecondary,
    fontSize: Typography.headline.fontSize,
    padding: Spacing['2'],
  },
  peekStatus: {
    color: WayfinderColors.inkSecondary,
    fontFamily: Typography.label.fontFamily,
    fontSize: Typography.label.fontSize,
  },
  peekError: {
    color: WayfinderColors.error,
    fontFamily: Typography.body.fontFamily,
    fontSize: Typography.body.fontSize,
  },
});

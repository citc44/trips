import Mapbox, { Camera, LineLayer, MapView, MarkerView, ShapeSource } from '@rnmapbox/maps';
import { router } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Colors, HudCard, MapMarker, PlayerColors, Spacing, StatusPill, Typography } from '@/constants/design-tokens';
import { initMapbox } from '@/lib/mapbox';
import type { LiveLocation } from '@/repositories/location-repository';
import { voyageRepository, type VoyageMember } from '@/repositories/voyage-repository';
import { IgnitionButton } from '@/shared/components/ignition-button';
import { Toast } from '@/shared/components/toast';
import { useActiveVoyage } from '@/shared/hooks/use-active-voyage';
import { useAuth } from '@/shared/hooks/use-auth';
import { useLiveLocations, type TrailPoint } from '@/shared/hooks/use-live-locations';
import { useLocationTracking } from '@/shared/hooks/use-location-tracking';
import { formatDistanceMiles, haversineMiles } from '@/shared/lib/geo';
import { outbox } from '@/shared/services/outbox/outbox';
import { screenStyles } from '@/shared/styles/screen';

const GENERIC_ERROR = 'Something went wrong. Please try again.';
const DEFAULT_ZOOM = 13;

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
  const ringColor = member.playerColor ? PlayerColors[member.playerColor] : Colors.inkSecondary;

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
        <View style={[styles.markerDot, { borderColor: ringColor }]}>
          <Text style={styles.markerInitial}>{initial}</Text>
        </View>
        {location.heading != null ? (
          <View style={[styles.markerChevron, { borderBottomColor: ringColor, transform: [{ rotate: `${location.heading}deg` }] }]} />
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
  const [now, setNow] = useState(() => Date.now());
  const isMounted = useRef(true);
  const cameraRef = useRef<Camera>(null);

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
  useEffect(() => {
    initMapbox();
  }, []);

  useEffect(() => {
    let isEffectMounted = true;
    AccessibilityInfo.isReduceMotionEnabled().then((enabled) => {
      if (isEffectMounted) setReduceMotion(enabled);
    });
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    return () => {
      isEffectMounted = false;
      subscription.remove();
    };
  }, []);

  // Only ticks while the default map view is actually showing the elapsed
  // text (code review finding: this previously ran unconditionally, causing
  // a once-a-second re-render even while a sub-view like the Organizer menu
  // or a confirm screen -- where the elapsed text isn't rendered at all --
  // was up).
  useEffect(() => {
    if (showOrganizerMenu || showConfirm || removeTarget) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [showOrganizerMenu, showConfirm, removeTarget]);

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

  if (removeTarget) {
    return (
      <View style={screenStyles.container}>
        <SafeAreaView style={screenStyles.safeArea}>
          <Text style={styles.confirmTitle}>Remove {removeTarget.displayName ?? 'them'} from this Voyage?</Text>
          <IgnitionButton
            testID="confirm-remove-voyager-button"
            label="Remove"
            disabled={isRemoving}
            onPress={handleRemoveVoyager}
            variant="destructive"
          />
          <IgnitionButton
            testID="keep-voyager-button"
            label="Never mind"
            disabled={isRemoving}
            onPress={() => {
              setRemoveTarget(null);
              setRemoveError(null);
            }}
            variant="secondary"
          />
          {removeError ? (
            <Text testID="remove-voyager-error" style={screenStyles.error}>
              {removeError}
            </Text>
          ) : null}
        </SafeAreaView>
      </View>
    );
  }

  if (showConfirm) {
    return (
      <View style={screenStyles.container}>
        <SafeAreaView style={screenStyles.safeArea}>
          <Text style={styles.eyebrow}>End Voyage</Text>
          <Text style={styles.confirmTitle}>Ready to close out the trip?</Text>
          <Text style={styles.confirmSub}>
            New recording stops right away. Anything already in progress finishes normally and makes it into the story.
          </Text>
          <IgnitionButton testID="confirm-end-voyage-button" label="End Voyage" disabled={isSubmitting} onPress={handleEndVoyage} />
          <IgnitionButton
            testID="keep-going-button"
            label="Keep going"
            disabled={isSubmitting}
            onPress={() => setShowConfirm(false)}
            variant="secondary"
          />
          {error ? (
            <Text testID="end-voyage-error" style={screenStyles.error}>
              {error}
            </Text>
          ) : null}
        </SafeAreaView>
      </View>
    );
  }

  if (showOrganizerMenu) {
    return (
      <View style={screenStyles.container}>
        <SafeAreaView style={screenStyles.safeArea}>
          <Text
            testID="organizer-menu-close-button"
            accessibilityRole="button"
            onPress={() => setShowOrganizerMenu(false)}
            style={styles.removeLabel}
          >
            Close
          </Text>
          <Text style={screenStyles.headline}>You&apos;re on your way to {activeVoyage.voyage.destination}.</Text>
          {isOrganizer ? (
            <IgnitionButton
              testID="end-voyage-button"
              label="End Voyage"
              disabled={false}
              onPress={() => setShowConfirm(true)}
              variant="secondary"
            />
          ) : null}

          <View style={styles.memberList}>
            {members.map((member) => {
              const isSelf = member.userId === session?.user.id;
              return (
                <View key={member.userId} style={styles.memberRow}>
                  <Text style={styles.memberName}>{member.displayName ?? 'Voyager'}</Text>
                  <View style={styles.memberRowActions}>
                    {member.role === 'organizer' ? <Text style={styles.memberRoleLabel}>Organizer</Text> : null}
                    {member.role !== 'organizer' && isOrganizer ? (
                      <IgnitionButton
                        testID={`grant-organizer-button-${member.userId}`}
                        label="Grant Organizer"
                        disabled={grantingUserIds.has(member.userId)}
                        onPress={() => handleGrantOrganizer(member)}
                        variant="secondary"
                      />
                    ) : null}
                    {isOrganizer && !isSelf ? (
                      <Text
                        testID={`remove-voyager-button-${member.userId}`}
                        accessibilityRole="button"
                        accessibilityState={{ disabled: false }}
                        onPress={() => setRemoveTarget(member)}
                        style={styles.removeLabel}
                      >
                        Remove
                      </Text>
                    ) : null}
                  </View>
                </View>
              );
            })}
          </View>
          {membersError ? (
            <Text testID="voyager-list-error" style={screenStyles.error}>
              {membersError}
            </Text>
          ) : null}
          {membersError && members.length === 0 ? (
            <IgnitionButton
              testID="voyager-list-retry-button"
              label="Retry"
              disabled={false}
              onPress={handleRetryMembers}
              variant="secondary"
            />
          ) : null}
          {toastMessage ? (
            <Toast testID="grant-organizer-toast" message={toastMessage} onDismiss={() => setToastMessage(null)} />
          ) : null}
        </SafeAreaView>
      </View>
    );
  }

  const selectedMember = selectedUserId ? members.find((m) => m.userId === selectedUserId) : null;

  // `myMember` stays `undefined` until `members` has loaded at least once
  // (it starts as `[]`), so `showRolePrompt` is correctly `false` before the
  // roster fetch resolves -- no separate "members loaded" flag needed.
  const myMember = members.find((m) => m.userId === session?.user.id);
  const myTravelRole = myMember?.travelRole ?? null;
  const showRolePrompt = !!myMember && myTravelRole === null;

  return (
    <View style={screenStyles.container}>
      <View style={styles.skyStrip} />
      <MapView testID="live-map" style={styles.map} styleURL={Mapbox.StyleURL.Dark}>
        <Camera ref={cameraRef} defaultSettings={{ zoomLevel: DEFAULT_ZOOM }} />
        {markers.map(({ member }) => (
          <VoyagerTrail
            key={`trail-${member.userId}`}
            userId={member.userId}
            color={member.playerColor ? PlayerColors[member.playerColor] : Colors.inkSecondary}
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

      <SafeAreaView style={styles.hudOverlay} pointerEvents="box-none">
        <View style={styles.statusPillWrapper}>
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

        <View testID="hud-top" style={styles.hudTop}>
          <View style={styles.hudTopRow}>
            <View>
              <Text style={styles.hudDestination}>{activeVoyage.voyage.destination}</Text>
              <Text style={styles.hudSubtext}>
                {markers.length} {markers.length === 1 ? 'Voyager' : 'Voyagers'} riding with you
              </Text>
            </View>
            <Text
              testID="organizer-menu-button"
              accessibilityRole="button"
              accessibilityLabel="Organizer menu"
              onPress={() => setShowOrganizerMenu(true)}
              style={styles.organizerMenuButton}
            >
              {'⋯'}
            </Text>
          </View>
          <Text style={styles.hudElapsed}>{formatElapsed(activeVoyage.voyage.createdAt, now)}</Text>
          {/* Subtle, not a blocking banner (AC1) -- deliberately not
              hudError's alarm-red treatment; a calm status note, not an
              error. Markers keep rendering whatever `locations` last held --
              useLiveLocations simply stops receiving new broadcasts while
              disconnected, it never clears them, so no extra logic is needed
              here to preserve last-known positions. */}
          {!isConnected ? (
            <Text testID="reconnecting-note" style={styles.hudReconnecting}>
              Reconnecting…
            </Text>
          ) : null}
          {hasLocationsError ? (
            <Text testID="locations-error" style={styles.hudError}>
              Couldn&apos;t load everyone&apos;s position. Pull down or reopen the trip to try again.
            </Text>
          ) : null}
        </View>

        <View testID="hud-bottom" style={styles.hudBottom}>
          {members.map((member) => {
            const distanceLabel = getDistanceLabel(member.userId);
            return (
              <View key={member.userId} style={styles.hudBottomRow}>
                <Text style={styles.hudBottomName}>{member.displayName ?? 'Voyager'}</Text>
                <View style={styles.hudBottomMeta}>
                  <Text style={styles.hudBottomRole}>
                    {member.role === 'organizer' ? 'Organizer' : member.travelRole === 'driving' ? 'Driving' : 'Riding'}
                  </Text>
                  {distanceLabel ? (
                    <Text testID={`hud-bottom-distance-${member.userId}`} style={styles.hudBottomDistance}>
                      {distanceLabel}
                    </Text>
                  ) : null}
                </View>
              </View>
            );
          })}
        </View>

        <Text testID="recenter-button" accessibilityRole="button" accessibilityLabel="Recenter" onPress={handleRecenter} style={styles.recenterButton}>
          {'◎'}
        </Text>
      </SafeAreaView>

      {selectedMember ? (
        <View testID="marker-peek-card" style={styles.peekScrim}>
          <View style={styles.peekCard}>
            <View style={styles.peekHeaderRow}>
              <View style={styles.peekNameRow}>
                <View
                  testID="marker-peek-color-swatch"
                  style={[
                    styles.peekColorSwatch,
                    { backgroundColor: selectedMember.playerColor ? PlayerColors[selectedMember.playerColor] : Colors.inkSecondary },
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
              <Text testID="role-prompt-error" style={screenStyles.error}>
                {roleError}
              </Text>
            ) : null}
          </View>
        </View>
      ) : null}

      {/* A flush-triggered success/conflict toast (Story 3.5) can legitimately
          fire while the user is looking at the map, not just from within the
          Organizer menu -- the organizer-menu block above keeps its own copy
          of this for its existing synchronous-action toasts. */}
      {toastMessage ? (
        <Toast testID="outbox-toast" message={toastMessage} onDismiss={() => setToastMessage(null)} />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  eyebrow: {
    color: Colors.inkSecondary,
    fontFamily: Typography.label.fontFamily,
    fontSize: Typography.label.fontSize,
    fontWeight: Typography.label.fontWeight,
    lineHeight: Typography.label.lineHeight,
    letterSpacing: Typography.label.letterSpacing,
    textTransform: 'uppercase',
  },
  confirmTitle: {
    marginTop: Spacing['3'],
    color: Colors.inkPrimary,
    fontFamily: Typography.display.fontFamily,
    fontSize: Typography.display.fontSize,
    fontWeight: Typography.display.fontWeight,
    lineHeight: Typography.display.lineHeight,
  },
  confirmSub: {
    marginTop: Spacing['4'],
    color: Colors.inkSecondary,
    fontFamily: Typography.body.fontFamily,
    fontSize: Typography.body.fontSize,
    lineHeight: Typography.body.lineHeight,
  },
  memberList: {
    width: '100%',
    gap: Spacing['3'],
  },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing['3'],
  },
  memberName: {
    color: Colors.inkPrimary,
    fontFamily: Typography.body.fontFamily,
    fontSize: Typography.body.fontSize,
  },
  memberRowActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing['3'],
  },
  memberRoleLabel: {
    color: Colors.inkSecondary,
    fontFamily: Typography.label.fontFamily,
    fontSize: Typography.label.fontSize,
    fontWeight: Typography.label.fontWeight,
    letterSpacing: Typography.label.letterSpacing,
    textTransform: 'uppercase',
  },
  removeLabel: {
    color: Colors.error,
    fontFamily: Typography.body.fontFamily,
    fontSize: Typography.body.fontSize,
    padding: Spacing['3'],
  },
  map: {
    flex: 1,
  },
  skyStrip: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 54,
    backgroundColor: Colors.surfaceMidnight,
    zIndex: 1,
  },
  hudOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'space-between',
    padding: Spacing.gutter,
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
    borderWidth: 1,
  },
  statusPillRiding: {
    backgroundColor: StatusPill.riding.background,
    borderColor: StatusPill.riding.borderColor,
  },
  statusPillDriving: {
    backgroundColor: StatusPill.driving.background,
    borderColor: StatusPill.driving.background,
    shadowColor: StatusPill.driving.glowColor,
    shadowOpacity: 1,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 0 },
    elevation: 8,
  },
  statusPillLabel: {
    fontFamily: Typography.label.fontFamily,
    fontSize: Typography.label.fontSize,
    fontWeight: Typography.label.fontWeight,
  },
  statusPillErrorText: {
    maxWidth: 140,
    textAlign: 'right',
    color: Colors.error,
    fontFamily: Typography.label.fontFamily,
    fontSize: Typography.label.fontSize,
  },
  hudTop: {
    backgroundColor: HudCard.background,
    borderRadius: HudCard.radius,
    borderWidth: 1,
    borderColor: HudCard.borderColor,
    padding: Spacing['4'],
    gap: Spacing['2'],
  },
  hudTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  hudDestination: {
    color: Colors.inkPrimary,
    fontFamily: Typography.headline.fontFamily,
    fontSize: Typography.headline.fontSize,
    fontWeight: Typography.headline.fontWeight,
  },
  hudSubtext: {
    color: Colors.inkSecondary,
    fontFamily: Typography.body.fontFamily,
    fontSize: Typography.label.fontSize,
  },
  organizerMenuButton: {
    color: Colors.inkPrimary,
    fontSize: Typography.headline.fontSize,
    padding: Spacing['2'],
  },
  hudElapsed: {
    color: Colors.inkPrimary,
    fontFamily: Typography.statNumeral.fontFamily,
    fontSize: Typography.statNumeral.fontSize * 0.5,
    fontWeight: Typography.statNumeral.fontWeight,
  },
  hudError: {
    color: Colors.error,
    fontFamily: Typography.label.fontFamily,
    fontSize: Typography.label.fontSize,
  },
  hudReconnecting: {
    color: Colors.inkSecondary,
    fontFamily: Typography.label.fontFamily,
    fontSize: Typography.label.fontSize,
  },
  hudBottom: {
    backgroundColor: HudCard.background,
    borderRadius: HudCard.radius,
    borderWidth: 1,
    borderColor: HudCard.borderColor,
    padding: Spacing['4'],
    gap: Spacing['2'],
  },
  hudBottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: Spacing['1'],
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: HudCard.borderColor,
  },
  hudBottomName: {
    color: Colors.inkPrimary,
    fontFamily: Typography.body.fontFamily,
    fontSize: Typography.label.fontSize,
  },
  hudBottomMeta: {
    alignItems: 'flex-end',
  },
  hudBottomRole: {
    color: Colors.inkSecondary,
    fontFamily: Typography.label.fontFamily,
    fontSize: Typography.label.fontSize,
  },
  hudBottomDistance: {
    color: Colors.inkSecondary,
    fontFamily: Typography.label.fontFamily,
    fontSize: 11,
  },
  recenterButton: {
    alignSelf: 'flex-end',
    minHeight: 48,
    minWidth: 48,
    borderRadius: 24,
    textAlign: 'center',
    textAlignVertical: 'center',
    backgroundColor: HudCard.background,
    borderWidth: 1,
    borderColor: HudCard.borderColor,
    color: Colors.inkPrimary,
    fontSize: Typography.headline.fontSize,
    overflow: 'hidden',
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
  markerDot: {
    width: MapMarker.size,
    height: MapMarker.size,
    borderRadius: MapMarker.radius,
    borderWidth: MapMarker.ringWidth,
    backgroundColor: MapMarker.fill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  markerInitial: {
    color: Colors.inkPrimary,
    fontFamily: Typography.label.fontFamily,
    fontSize: Typography.label.fontSize,
    fontWeight: Typography.label.fontWeight,
  },
  markerChevron: {
    position: 'absolute',
    top: -6,
    width: 0,
    height: 0,
    borderLeftWidth: 5,
    borderRightWidth: 5,
    borderBottomWidth: 8,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
  },
  markerLabel: {
    position: 'absolute',
    bottom: -16,
    color: Colors.inkPrimary,
    fontSize: 10,
  },
  peekScrim: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: `${Colors.surfaceMidnight}8C`,
    justifyContent: 'flex-end',
  },
  peekCard: {
    backgroundColor: HudCard.background,
    borderTopLeftRadius: HudCard.radius,
    borderTopRightRadius: HudCard.radius,
    padding: Spacing['5'],
    gap: Spacing['2'],
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
    color: Colors.inkPrimary,
    fontFamily: Typography.headline.fontFamily,
    fontSize: Typography.headline.fontSize,
    fontWeight: Typography.headline.fontWeight,
  },
  peekClose: {
    color: Colors.inkSecondary,
    fontSize: Typography.headline.fontSize,
    padding: Spacing['2'],
  },
  peekStatus: {
    color: Colors.inkSecondary,
    fontFamily: Typography.label.fontFamily,
    fontSize: Typography.label.fontSize,
  },
});

import Mapbox, { Camera, LineLayer, MapView, MarkerView, ShapeSource } from '@rnmapbox/maps';
import * as Clipboard from 'expo-clipboard';
import { router } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, Linking, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  ActionDrawer as ActionDrawerTokens,
  CutToGameplayMotion,
  Hamburger,
  HudBar,
  MapBanner,
  MapMarker,
  MarkerPeekCardMotion,
  PlayerColors,
  Rounded,
  Spacing,
  StatusPill,
  Typography,
  WayfinderColors,
} from '@/constants/design-tokens';
import { initMapbox } from '@/lib/mapbox';
import { journeyEventRepository } from '@/repositories/journey-event-repository';
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
import { useSmoothedLocation } from '@/shared/hooks/use-smoothed-location';
import { formatCoordinate, formatDistanceMiles, haversineMiles } from '@/shared/lib/geo';
import { outbox } from '@/shared/services/outbox/outbox';
import { createMessageId, type JourneyEventType } from '@/shared/types/voyage-message';

const COPIED_LABEL_DURATION_MS = 1100;
// DESIGN.md copyButton.copiedIconMorph: "~250ms crossfade".
const COPY_ICON_MORPH_MS = 250;

const GENERIC_ERROR = 'Something went wrong. Please try again.';
const DEFAULT_ZOOM = 13;

// User-reported bug, fixed: both the first-load auto-center and the
// recenter button used to average every marker's lat/lng into one point,
// then move to it at a *fixed* zoom (DEFAULT_ZOOM). For Voyagers spread out
// by more than a couple miles, that midpoint can land on empty road between
// everyone at that zoom level -- nobody actually visible, reading as "some
// random place," not a recognizable view of the group. fitBounds computes
// the zoom that actually shows every marker, instead of assuming one.
// [top, right, bottom, left] -- accounts for the map banner/HUD bar chrome
// overlaying the map's top/bottom edges, so a marker can't end up hidden
// underneath either.
const CAMERA_FIT_PADDING: [number, number, number, number] = [
  MapBanner.height + Spacing['4'],
  Spacing['5'],
  HudBar.height + Spacing['4'],
  Spacing['5'],
];

function fitCameraToMarkers(camera: Camera, markers: { location: LiveLocation }[], duration: number) {
  if (markers.length === 0) return;
  if (markers.length === 1) {
    // fitBounds needs two distinct corners -- a single marker is just a
    // point to center on, not a box to fit, so this keeps DEFAULT_ZOOM
    // rather than fitBounds zooming in to its own arbitrary minimum.
    camera.moveTo([markers[0].location.lng, markers[0].location.lat], duration);
    return;
  }
  const lats = markers.map((m) => m.location.lat);
  const lngs = markers.map((m) => m.location.lng);
  const ne: [number, number] = [Math.max(...lngs), Math.max(...lats)];
  const sw: [number, number] = [Math.min(...lngs), Math.min(...lats)];
  camera.fitBounds(ne, sw, CAMERA_FIT_PADDING, duration);
}

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

// Get Directions (Story 4.6): no existing code in this repo opens an
// external maps app. Deliberately simple, no `canOpenURL` pre-check -- no
// similar external-action call site in this codebase guards one either (see
// join-code.tsx's handleShare), and adding one here would be inconsistent.
function buildDirectionsUrl(lat: number, lng: number): string {
  return Platform.OS === 'ios' ? `maps://?daddr=${lat},${lng}&dirflg=d` : `google.navigation:q=${lat},${lng}`;
}

// One-shot amber spark, radiating outward from the marker on peek-card open
// ("Pop & Bounce", DESIGN.md#marker-peek-card). Fires once on mount --
// remounting (via a changing `key` on the caller's side) is how a later open
// replays the burst, rather than a loop.
function MarkerSpark({ angleDeg }: { angleDeg: number }) {
  const [progress] = useState(() => new Animated.Value(0));

  useEffect(() => {
    Animated.timing(progress, {
      toValue: 1,
      duration: MarkerPeekCardMotion.sparkBurstDurationMs,
      easing: Easing.out(Easing.ease),
      useNativeDriver: true,
    }).start();
  }, [progress]);

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.markerSpark,
        {
          opacity: progress.interpolate({ inputRange: [0, 0.25, 1], outputRange: [0, 1, 0] }),
          transform: [
            { rotate: `${angleDeg}deg` },
            { translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [-6, -34] }) },
            { scale: progress.interpolate({ inputRange: [0, 0.25, 1], outputRange: [0.4, 1, 1] }) },
          ],
        },
      ]}
    />
  );
}

function VoyagerMarker({
  member,
  location,
  reduceMotion,
  isSelf,
  isSelected,
  distanceLabel,
  destinationLabel,
  destinationName,
  onPress,
  onClose,
}: {
  member: VoyageMember;
  location: LiveLocation;
  reduceMotion: boolean;
  isSelf: boolean;
  isSelected: boolean;
  distanceLabel: string | null;
  destinationLabel: string | null;
  destinationName: string;
  onPress: () => void;
  onClose: () => void;
}) {
  // useState's lazy initializer (not useRef(...).current) -- same "create
  // once, stable across re-renders" semantic, but reading a plain state
  // variable during render (rather than a ref's .current) doesn't trip
  // react-hooks/refs the way sign-in.tsx's pre-existing Animated.Value ref
  // does.
  const [pulseValue] = useState(() => new Animated.Value(0));
  const ringColor = member.playerColor ? PlayerColors[member.playerColor] : WayfinderColors.inkSecondary;
  const displayedLocation = useSmoothedLocation(location, reduceMotion);

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

  // Story 4.6 "Pop & Bounce": the card keeps rendering for its own close
  // animation's duration after `isSelected` flips false, rather than
  // unmounting the instant the parent's selection state changes -- that's
  // what makes a real close animation possible (see EXPERIENCE.md#Motion &
  // Transitions).
  const [isRendering, setIsRendering] = useState(isSelected);
  const [copied, setCopied] = useState(false);
  const [sparkKey, setSparkKey] = useState(0);
  // Code review finding (Story 4.6): a single bezier-eased Animated.timing
  // cannot reproduce a curve that overshoots past 1 and dips back below it --
  // open and close each get their own 0->1 progress value, interpolated
  // through the real keyframe stops (same technique as hopProgress below and
  // CutToGameplayMotion's flashProgress), rather than animating scale/opacity
  // directly to a single target value.
  const [cardOpenProgress] = useState(() => new Animated.Value(isSelected ? 1 : 0));
  const [cardCloseProgress] = useState(() => new Animated.Value(0));
  const [hopProgress] = useState(() => new Animated.Value(0));
  const [copyIconProgress] = useState(() => new Animated.Value(0));
  const isMountedRef = useRef(true);
  const copiedTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const closeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      if (copiedTimeoutRef.current) clearTimeout(copiedTimeoutRef.current);
      if (closeTimeoutRef.current) clearTimeout(closeTimeoutRef.current);
    };
  }, []);

  useEffect(() => {
    if (isSelected) {
      if (closeTimeoutRef.current) {
        clearTimeout(closeTimeoutRef.current);
        closeTimeoutRef.current = null;
      }
      // Deferred via a microtask, not called synchronously in the effect
      // body -- this codebase's established react-hooks/set-state-in-effect
      // workaround (see use-live-locations.tsx's own Promise.resolve().then()
      // resets). Also resets any stale "copied" checkmark left over from a
      // previous open (code review finding: copying, closing, and reopening
      // the same marker within COPIED_LABEL_DURATION_MS used to show a
      // checkmark with no new copy action behind it).
      if (copiedTimeoutRef.current) {
        clearTimeout(copiedTimeoutRef.current);
        copiedTimeoutRef.current = null;
      }
      copyIconProgress.setValue(0);
      Promise.resolve().then(() => {
        if (isMountedRef.current) {
          setIsRendering(true);
          setCopied(false);
        }
      });

      if (reduceMotion) {
        cardOpenProgress.setValue(1);
        hopProgress.setValue(0);
      } else {
        cardOpenProgress.setValue(0);
        hopProgress.setValue(0);
        Animated.timing(cardOpenProgress, {
          toValue: 1,
          duration: MarkerPeekCardMotion.openDurationMs,
          easing: Easing.bezier(...MarkerPeekCardMotion.openEasing),
          useNativeDriver: true,
        }).start();
        Animated.timing(hopProgress, {
          toValue: 1,
          duration: MarkerPeekCardMotion.markerHopDurationMs,
          easing: Easing.bezier(...MarkerPeekCardMotion.markerHopEasing),
          useNativeDriver: true,
        }).start();
        Promise.resolve().then(() => {
          if (isMountedRef.current) setSparkKey((key) => key + 1);
        });
      }

      // Accessibility floor: the card announces its full content on open,
      // not just individual fields on demand -- built from whichever
      // labels are actually present, mirroring the visual self-card/null-
      // destination omissions rather than a fixed template. Self case gets
      // an explicit "this is you" (code review finding: the visible "This
      // is you." text had no spoken equivalent).
      const speechParts = [member.displayName ?? 'Voyager'];
      if (isSelf) {
        speechParts.push('this is you');
      } else {
        speechParts.push(member.role === 'organizer' ? 'Organizer' : member.travelRole === 'driving' ? 'Driving' : 'Riding');
        if (distanceLabel) speechParts.push(`${distanceLabel} from you`);
      }
      if (destinationLabel) speechParts.push(`${destinationLabel} to ${destinationName}`);
      const latDir = displayedLocation.lat >= 0 ? 'north' : 'south';
      const lngDir = displayedLocation.lng >= 0 ? 'east' : 'west';
      speechParts.push(`coordinates ${Math.abs(displayedLocation.lat).toFixed(4)} ${latDir}, ${Math.abs(displayedLocation.lng).toFixed(4)} ${lngDir}`);
      AccessibilityInfo.announceForAccessibility(speechParts.join(', '));
    } else {
      if (reduceMotion) {
        Promise.resolve().then(() => {
          if (isMountedRef.current) setIsRendering(false);
        });
      } else {
        cardCloseProgress.setValue(0);
        Animated.timing(cardCloseProgress, {
          toValue: 1,
          duration: MarkerPeekCardMotion.closeDurationMs,
          easing: Easing.bezier(...MarkerPeekCardMotion.closeEasing),
          useNativeDriver: true,
        }).start();
        closeTimeoutRef.current = setTimeout(() => {
          if (isMountedRef.current) setIsRendering(false);
        }, MarkerPeekCardMotion.closeDurationMs);
      }
    }
    // member/isSelf/distanceLabel/destinationLabel/destinationName/displayedLocation below are read for the open-announcement's speech string,
    // not state this effect should re-run for on their own -- it's gated on the isSelected/reduceMotion transition itself, same narrow-deps
    // precedent as this file's own hasStartedEntryTransitionRef effect.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSelected, reduceMotion, cardOpenProgress, cardCloseProgress, hopProgress, copyIconProgress]);

  // Code review finding (Story 4.6): open and close each get their own
  // progress value (see cardOpenProgress/cardCloseProgress above) so open's
  // real overshoot-then-undershoot keyframe shape and close's plain 2-point
  // shrink don't have to share one curve. Only one is ever "live" at once --
  // `isSelected` (not `isRendering`) picks which, since isRendering stays
  // true through the tail end of a close.
  const cardScale = isSelected
    ? cardOpenProgress.interpolate({
        inputRange: [...MarkerPeekCardMotion.cardScaleKeyframeStops],
        outputRange: [...MarkerPeekCardMotion.cardScaleStops],
      })
    : cardCloseProgress.interpolate({ inputRange: [0, 1], outputRange: [1, MarkerPeekCardMotion.cardScaleFrom] });
  const cardOpacity = isSelected
    ? cardOpenProgress.interpolate({ inputRange: [0, 1], outputRange: [0, 1] })
    : cardCloseProgress.interpolate({ inputRange: [0, 1], outputRange: [1, 0] });

  async function handleCopy() {
    try {
      await Clipboard.setStringAsync(formatCoordinate(displayedLocation.lat, displayedLocation.lng));
      if (!isMountedRef.current) return;
      setCopied(true);
      Animated.timing(copyIconProgress, { toValue: 1, duration: COPY_ICON_MORPH_MS, useNativeDriver: true }).start();
      AccessibilityInfo.announceForAccessibility('Copied');
      if (copiedTimeoutRef.current) clearTimeout(copiedTimeoutRef.current);
      copiedTimeoutRef.current = setTimeout(() => {
        if (!isMountedRef.current) return;
        setCopied(false);
        Animated.timing(copyIconProgress, { toValue: 0, duration: COPY_ICON_MORPH_MS, useNativeDriver: true }).start();
      }, COPIED_LABEL_DURATION_MS);
    } catch {
      // Clipboard write failed silently -- no confirmation shown is the correct feedback.
    }
  }

  function handleGetDirections() {
    Linking.openURL(buildDirectionsUrl(displayedLocation.lat, displayedLocation.lng)).catch(() => {
      // User has no maps app that resolves the scheme, or the OS rejected it -- nothing actionable to surface.
    });
  }

  return (
    <MarkerView
      coordinate={[displayedLocation.lng, displayedLocation.lat]}
      anchor={{ x: 0.5, y: 0.5 }}
      allowOverlap
      allowOverlapWithPuck
      isSelected={isSelected}
    >
      {/* MarkerView only accepts a single child element -- this wraps the
          tooltip and the marker itself together, since both need to be
          inside it. */}
      <View>
        {/* User-reported redesign: was a full-width bottom sheet behind a
            dimming scrim; now a small Waze-style callout anchored directly
            above this marker, with the map still fully visible/interactive
            behind it. Lives inside the same MarkerView as the marker itself
            so it tracks the map's pan/zoom for free, no separate screen-
            coordinate math needed. Stays mounted through `isRendering`
            (not `isSelected` directly) so the close animation above can
            finish before this unmounts (Story 4.6). */}
        {isRendering ? (
          <Animated.View
            testID="marker-peek-card"
            style={[styles.markerTooltipWrap, { opacity: cardOpacity, transform: [{ scale: cardScale }] }]}
            pointerEvents="box-none"
          >
            <View style={styles.markerTooltip}>
              <View style={styles.markerTooltipHeader}>
                <View style={styles.markerTooltipNameRow}>
                  <View testID="marker-peek-color-swatch" style={[styles.markerTooltipSwatch, { backgroundColor: ringColor }]} />
                  <Text style={styles.markerTooltipName}>{member.displayName ?? 'Voyager'}</Text>
                </View>
                <Text testID="marker-peek-close-button" accessibilityRole="button" onPress={onClose} style={styles.markerTooltipClose}>
                  {'✕'}
                </Text>
              </View>
              {!isSelf ? (
                <Text style={styles.markerTooltipRole}>
                  {member.role === 'organizer' ? 'Organizer' : member.travelRole === 'driving' ? 'Driving' : 'Riding'}
                </Text>
              ) : null}

              <View style={styles.markerTooltipCoordRow}>
                <Text testID="marker-peek-coordinates" style={styles.markerTooltipCoordText}>
                  {formatCoordinate(displayedLocation.lat, displayedLocation.lng)}
                </Text>
                <View style={styles.markerTooltipCoordActions}>
                  <Pressable
                    testID="marker-peek-copy-button"
                    accessibilityRole="button"
                    accessibilityLabel="Copy coordinates"
                    onPress={handleCopy}
                    // 26px visual, 44pt/48dp hit-region via invisible hit-slop
                    // padding -- same visual-vs-hit-region split map-marker
                    // itself already uses (code review finding).
                    hitSlop={9}
                    style={[styles.markerTooltipCopyButton, copied && styles.markerTooltipCopyButtonActive]}
                  >
                    {/* Crossfade, not an instant swap (DESIGN.md
                        copyButton.copiedIconMorph, code review finding) --
                        both icons stacked, opacity driven in opposite
                        directions by the same progress value. */}
                    <Animated.Text
                      style={[styles.markerTooltipCopyIcon, { opacity: copyIconProgress.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }) }]}
                    >
                      {'⧉'}
                    </Animated.Text>
                    <Animated.Text
                      style={[
                        styles.markerTooltipCopyIcon,
                        styles.markerTooltipCopyIconActive,
                        styles.markerTooltipCopyIconOverlay,
                        { opacity: copyIconProgress.interpolate({ inputRange: [0, 1], outputRange: [0, 1] }) },
                      ]}
                    >
                      {'✓'}
                    </Animated.Text>
                  </Pressable>
                  {!isSelf ? (
                    <Pressable
                      testID="marker-peek-navigate-button"
                      accessibilityRole="button"
                      accessibilityLabel={`Get directions to ${member.displayName ?? 'Voyager'}`}
                      onPress={handleGetDirections}
                      hitSlop={9}
                      style={styles.markerTooltipNavButton}
                    >
                      <Text style={styles.markerTooltipNavIcon}>{'➤'}</Text>
                    </Pressable>
                  ) : null}
                </View>
              </View>

              {isSelf ? (
                // "How far are you from yourself" / "navigate to yourself"
                // aren't real questions -- role, distance-from-you, and Get
                // Directions are dropped entirely (Waze's own convention for
                // your own car), but distance-to-destination is meaningful
                // even for your own marker.
                <Text style={styles.markerTooltipSelfNote}>This is you.</Text>
              ) : null}

              {(!isSelf && distanceLabel) || destinationLabel ? (
                <View style={styles.markerTooltipStatPair}>
                  {!isSelf && distanceLabel ? (
                    <View testID="marker-peek-distance-you" style={styles.markerTooltipStatCell}>
                      <Text style={[styles.markerTooltipStatNum, { color: WayfinderColors.accentTeal }]}>{distanceLabel}</Text>
                      <Text style={styles.markerTooltipStatCap}>From you</Text>
                    </View>
                  ) : null}
                  {destinationLabel ? (
                    <View
                      testID="marker-peek-distance-destination"
                      style={[styles.markerTooltipStatCell, !isSelf && distanceLabel && styles.markerTooltipStatCellBordered]}
                    >
                      <Text style={[styles.markerTooltipStatNum, { color: WayfinderColors.warning }]}>{destinationLabel}</Text>
                      <Text style={styles.markerTooltipStatCap}>{`To ${destinationName}`}</Text>
                    </View>
                  ) : null}
                </View>
              ) : null}
            </View>
            <View style={styles.markerTooltipTail} />
          </Animated.View>
        ) : null}
        <Pressable
          testID={`voyager-marker-${member.userId}`}
          accessibilityRole="button"
          accessibilityLabel={`${member.displayName ?? 'Voyager'}, riding${member.playerColor ? `, ${member.playerColor} marker` : ''}`}
          onPress={onPress}
          style={styles.markerHitRegion}
        >
          {/* Always visible on your own marker, not just while its tooltip
              is open -- same "this is you" convention Waze/Google Maps use,
              so you can find yourself on the map at a glance. */}
          {isSelf ? <View testID="marker-you-ring" style={styles.markerYouRing} /> : null}
          {reduceMotion ? (
            // Accessibility floor: live state is never color-only. Under
            // Reduce Motion, a filled-vs-hollow ring distinction replaces
            // the pulse animation rather than just omitting the "live"
            // signal.
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
          {!reduceMotion && isSelected ? (
            <View style={styles.markerSparkWrap} pointerEvents="none">
              {Array.from({ length: MarkerPeekCardMotion.sparkCount }, (_, i) => (
                <MarkerSpark key={`${sparkKey}-${i}`} angleDeg={(360 / MarkerPeekCardMotion.sparkCount) * i} />
              ))}
            </View>
          ) : null}
          {/* Wrapped together (not just the dot alone) so the chevron hops
              in lockstep with the avatar on peek-card open -- the name
              label stays put (a sibling below, absolute-positioned off the
              hit region itself), matching a video-game character "hop"
              without the nameplate jumping too. */}
          <Animated.View
            style={{
              transform: [
                {
                  translateY: hopProgress.interpolate({
                    inputRange: [...MarkerPeekCardMotion.hopKeyframeStops],
                    outputRange: [...MarkerPeekCardMotion.hopTranslateY],
                  }),
                },
              ],
            }}
          >
            <View style={[styles.markerDot, { backgroundColor: ringColor }]}>
              <Text style={styles.markerInitial}>{initial}</Text>
            </View>
            {displayedLocation.heading != null ? (
              <View
                style={[
                  styles.markerChevron,
                  { borderBottomColor: MapMarker.chevronColor, transform: [{ rotate: `${displayedLocation.heading}deg` }] },
                ]}
              />
            ) : null}
          </Animated.View>
          <Text style={styles.markerLabel}>{member.userId === location.userId && member.displayName ? member.displayName : ''}</Text>
        </Pressable>
      </View>
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
  icon,
}: {
  testID: string;
  label: string;
  onPress: () => void;
  disabled?: boolean;
  variant?: 'default' | 'primary' | 'danger';
  // User-reported bug, fixed: mockups/key-live-map.html's own .drawer-row
  // markup pairs every row with a .row-icon glyph, but this component never
  // had an icon slot at all -- dropped somewhere between the mockup and
  // this component's first implementation, not a deliberate omission.
  // Optional (not every row needs one -- the confirm-step buttons below
  // never showed icons in the mockup either) rather than required, so
  // existing callers that don't pass one are unaffected.
  icon?: string;
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
      {icon ? <Text style={styles.drawerRowIcon}>{icon}</Text> : null}
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
  const { activeVoyage, refetch, clearActiveVoyage } = useActiveVoyage();
  const { session } = useAuth();
  const voyageId = activeVoyage?.voyage.id ?? null;

  const {
    locations,
    trails,
    hasError: hasLocationsError,
    isConnected,
    rosterRevision,
    lifecycleRevision = 0,
  } = useLiveLocations(voyageId, session?.user.id ?? null);
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
  const [membersResolvedForVoyageId, setMembersResolvedForVoyageId] = useState<string | null>(null);
  const [grantingUserIds, setGrantingUserIds] = useState<Set<string>>(new Set());
  const [loggingSpotTypes, setLoggingSpotTypes] = useState<Set<JourneyEventType>>(new Set());
  // A rapid double-tap dispatches both press events within the same React
  // batch, before any re-render -- the second call's handleLogSpotting
  // closure would still read loggingSpotTypes' stale (pre-update) value if
  // that state alone were the guard. A ref mutates synchronously and is
  // immune to batching, so it's the actual re-entrancy guard; the state
  // above stays in sync purely to drive the disabled/pressed styling.
  const loggingSpotTypesRef = useRef<Set<JourneyEventType>>(new Set());
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [removeTarget, setRemoveTarget] = useState<VoyageMember | null>(null);
  const [isRemoving, setIsRemoving] = useState(false);
  const [removeError, setRemoveError] = useState<string | null>(null);
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);
  const [isLeaving, setIsLeaving] = useState(false);
  const [leaveError, setLeaveError] = useState<string | null>(null);
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

  const memberRequestSequence = useRef(0);
  const memberVoyageId = useRef<string | null>(voyageId);
  const loadMembers = useRef(async (id: string) => {
    const requestSequence = ++memberRequestSequence.current;

    try {
      const { data, error: fetchError } = await voyageRepository.getVoyageMembers(id);
      if (!isMounted.current || memberVoyageId.current !== id || requestSequence !== memberRequestSequence.current) return;
      setMembersResolvedForVoyageId(id);
      if (fetchError || !data) {
        setMembersError(fetchError?.message ?? GENERIC_ERROR);
        return;
      }
      setMembers(data);
      setMembersError(null);
    } catch {
      if (!isMounted.current || memberVoyageId.current !== id || requestSequence !== memberRequestSequence.current) return;
      setMembersResolvedForVoyageId(id);
      setMembersError(GENERIC_ERROR);
    }
  });

  useEffect(() => {
    memberVoyageId.current = voyageId;
    if (!voyageId) return;
    void loadMembers.current(voyageId);
  }, [voyageId]);

  // A location can be delivered moments after a person joins, before this
  // screen's original roster read knows that person exists. Markers are
  // intentionally joined to active member metadata, so use an unknown
  // location id as a recovery signal instead of silently filtering it until
  // the app is restarted. The server's roster_changed broadcast below is the
  // primary path; this is also a fallback for an event missed offline.
  const unknownLocationUserIds = useMemo(() => {
    if (membersResolvedForVoyageId !== voyageId || membersError) return '';
    const knownUserIds = new Set(members.map((member) => member.userId));
    return Object.keys(locations)
      .filter((userId) => !knownUserIds.has(userId))
      .sort()
      .join(',');
  }, [locations, members, membersError, membersResolvedForVoyageId, voyageId]);

  useEffect(() => {
    if (!voyageId || !unknownLocationUserIds) return;
    void loadMembers.current(voyageId);
  }, [unknownLocationUserIds, voyageId]);

  useEffect(() => {
    if (!voyageId || rosterRevision === 0) return;
    void loadMembers.current(voyageId);
  }, [rosterRevision, voyageId]);

  // Membership/status broadcasts, authorization failures, reconnects, and
  // foreground recovery all mean this device may have missed a terminal
  // lifecycle change. Reconcile the routing source of truth as well as the
  // roster so another device's Leave/sign-out/End cannot leave this map
  // mounted until an app restart.
  useEffect(() => {
    if (!voyageId || lifecycleRevision === 0) return;
    void refetch();
  }, [lifecycleRevision, refetch, voyageId]);

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

      for (const { item } of result.succeeded) {
        if (!isMounted.current) return;
        if (item.kind === 'end_voyage') {
          await refetch();
          if (!isMounted.current) return;
          resetDrawerState();
          // Story 6.3: supersedes the v1 '/voyage-ended' summary screen --
          // see EXPERIENCE.md's "version seam, not a typo" note. The new
          // screen fetches its own data by id (see memory-lane/[voyageId].tsx),
          // so only voyageId is passed, not the full param bag voyage-ended
          // used -- item.payload.voyageId is the reliable source here.
          router.push({ pathname: '/memory-lane/[voyageId]', params: { voyageId: item.payload.voyageId } });
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
        } else if (item.kind === 'journey_event') {
          // Code review finding (Story 5.1): this kind had no success
          // branch at all -- the RPC still succeeded (nothing was lost),
          // but a queued spotting log flushed with zero user-visible
          // confirmation, unlike every other outbox kind.
          messages.push('A queued spotting log was saved.');
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
  // way for both platforms: once real marker positions first arrive, fit
  // them all in view exactly once -- reusing handleRecenter's own
  // fitCameraToMarkers helper, not duplicating it. Once-only via the ref
  // (not every markers change) so this never fights a user's own subsequent
  // pan/zoom/manual recenter.
  const hasAutoCenteredRef = useRef(false);
  useEffect(() => {
    if (hasAutoCenteredRef.current || markers.length === 0 || !cameraRef.current) return;
    hasAutoCenteredRef.current = true;
    fitCameraToMarkers(cameraRef.current, markers, 0);
  }, [markers]);

  if (!activeVoyage) {
    return null;
  }

  const isOrganizer = activeVoyage.role === 'organizer';
  const canLeaveVoyage = !!session?.user.id && session.user.id !== activeVoyage.voyage.createdBy;

  // User-reported change: the peek tooltip's distance reading is now "how
  // far is this Voyager from me right now" (Waze's own popup convention),
  // not "how far from the shared destination" -- the question you actually
  // have mid-drive. Null whenever this device doesn't have its own live
  // location yet (a brief window right after mount, or if location
  // permission/tracking never resolved) -- callers treat null as "omit the
  // distance readout entirely," not an error or a zero distance.
  const myLocation = session?.user.id ? locations[session.user.id] : undefined;

  function getDistanceFromMeLabel(userId: string): string | null {
    if (!myLocation) return null;
    const location = locations[userId];
    if (!location) return null;
    return formatDistanceMiles(haversineMiles({ lat: location.lat, lng: location.lng }, myLocation));
  }

  // Story 4.6: unlike distance-from-me, this is meaningful for every
  // marker including your own. A Voyage started via free-text/no place
  // selected has both destination coordinates null (Voyage type's own doc
  // comment) -- degrade gracefully (omit the readout), never "NaN"/throw.
  function getDistanceToDestinationLabel(userId: string): string | null {
    const { destinationLat, destinationLng } = activeVoyage!.voyage;
    if (destinationLat == null || destinationLng == null) return null;
    const location = locations[userId];
    if (!location) return null;
    return formatDistanceMiles(haversineMiles({ lat: location.lat, lng: location.lng }, { lat: destinationLat, lng: destinationLng }));
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
      // Story 6.3: supersedes the v1 '/voyage-ended' summary screen -- see
      // EXPERIENCE.md's "version seam, not a typo" note and the outbox
      // flush handler's identical navigation above. The new screen fetches
      // its own data by id (memory-lane/[voyageId].tsx), so only voyageId
      // is passed, not the full param bag voyage-ended used.
      router.push({ pathname: '/memory-lane/[voyageId]', params: { voyageId: data.id } });
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

  async function handleLeaveVoyage() {
    setIsLeaving(true);
    setLeaveError(null);

    try {
      const { error: leaveErr } = await voyageRepository.leaveVoyage(activeVoyage!.voyage.id);
      if (!isMounted.current) return;
      if (leaveErr) {
        setLeaveError(leaveErr.message);
        return;
      }

      // The RPC response is authoritative. Clear the routing source locally
      // instead of depending on a second network request that could fail
      // after the departure already committed. The protected route then
      // evicts this screen into Home after the state commit.
      clearActiveVoyage();
      resetDrawerState();
    } catch {
      if (!isMounted.current) return;
      setLeaveError(GENERIC_ERROR);
    } finally {
      if (isMounted.current) {
        setIsLeaving(false);
      }
    }
  }

  // Full reset of every piece of drawer step-state (which confirm step, and
  // any error left over from a failed attempt) back to the drawer's default
  // (menu) step, nothing stale carried forward.
  function resetDrawerState() {
    setShowOrganizerMenu(false);
    setShowConfirm(false);
    setShowLeaveConfirm(false);
    setRemoveTarget(null);
    setError(null);
    setRemoveError(null);
    setLeaveError(null);
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
    if (!cameraRef.current) return;
    fitCameraToMarkers(cameraRef.current, markers, 500);
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

  // Story 5.1 AC3: minimal manual spotting log (police/deer/construction),
  // reusing the already-built journeyEventRepository/create_journey_event
  // path. Same enqueue-on-network-failure discipline as
  // handleEndVoyage/handleGrantOrganizer/handleRemoveVoyager above -- an
  // offline tap must be queued, not silently dropped.
  async function handleLogSpotting(eventType: JourneyEventType) {
    // Code review finding: without this guard, a rapid double-tap fires two
    // independent requests with two different generated ids, creating two
    // journey_events rows for one real sighting -- same in-flight discipline
    // handleGrantOrganizer's grantingUserIds already applies.
    if (loggingSpotTypesRef.current.has(eventType)) return;
    loggingSpotTypesRef.current.add(eventType);
    setLoggingSpotTypes(new Set(loggingSpotTypesRef.current));

    const id = createMessageId();
    const occurredAt = new Date().toISOString();

    try {
      const { error: logError } = await journeyEventRepository.createEvent(activeVoyage!.voyage.id, {
        id,
        type: eventType,
        occurredAt,
      });
      if (logError) {
        if (isNetworkFailure(logError)) {
          await outbox.enqueue({
            kind: 'journey_event',
            payload: { voyageId: activeVoyage!.voyage.id, eventId: id, eventType, occurredAt, metadata: {} },
          });
          if (!isMounted.current) return;
          setToastMessage("Queued -- this will finish once you're back online.");
          return;
        }
        if (!isMounted.current) return;
        setToastMessage(logError.message);
        return;
      }
      if (!isMounted.current) return;
      setToastMessage('Logged.');
    } catch {
      await outbox.enqueue({
        kind: 'journey_event',
        payload: { voyageId: activeVoyage!.voyage.id, eventId: id, eventType, occurredAt, metadata: {} },
      });
      if (!isMounted.current) return;
      setToastMessage("Queued -- this will finish once you're back online.");
    } finally {
      loggingSpotTypesRef.current.delete(eventType);
      if (isMounted.current) {
        setLoggingSpotTypes(new Set(loggingSpotTypesRef.current));
      }
    }
  }

  const isSelf = (memberId: string) => memberId === session?.user.id;

  const drawerStep: 'menu' | 'end-voyage-confirm' | 'remove-confirm' | 'leave-confirm' = removeTarget
    ? 'remove-confirm'
    : showConfirm
      ? 'end-voyage-confirm'
      : showLeaveConfirm
        ? 'leave-confirm'
      : 'menu';

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
            accessibilityLabel="Voyage actions"
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
              applied to its own icon-only controls). User-reported bug,
              fixed: this rendered as a plain, non-interactive View -- tapping
              it visibly did nothing. Opens the same Organizer/member drawer
              as the hamburger button, since that's where the actual roster
              lives; a count badge that does nothing when tapped reads as
              broken, not decorative. */}
          <Pressable
            testID="voyager-count-badge"
            accessibilityRole="button"
            accessibilityLabel={`${markers.length} ${markers.length === 1 ? 'Voyager' : 'Voyagers'} riding with you`}
            onPress={() => setShowOrganizerMenu(true)}
            style={({ pressed }) => [styles.mapBannerCount, pressed && styles.pressedScale]}
          >
            {/* ☺ matches mockups/key-live-map.html's .voyagers-count content
                exactly ("3☺") -- code review finding: this was previously
                just the bare number. */}
            <Text style={styles.mapBannerCountLabel}>{markers.length}☺</Text>
          </Pressable>
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
              isSelf={isSelf(member.userId)}
              isSelected={selectedUserId === member.userId}
              distanceLabel={getDistanceFromMeLabel(member.userId)}
              destinationLabel={getDistanceToDestinationLabel(member.userId)}
              destinationName={activeVoyage.voyage.destination}
              // Tapping the already-open marker again closes it (toggle),
              // matching the explicit close X's own behavior -- same
              // "tap it again to dismiss" affordance Waze's own popups use.
              onPress={() => setSelectedUserId((current) => (current === member.userId ? null : member.userId))}
              onClose={() => setSelectedUserId(null)}
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
        {/* Story 5.1 AC3/AC4: minimal manual spotting log. Absent (not
            disabled) for a Driving-role Voyager, matching UX-DR25's existing
            precedent for manual Fun Fact/photo controls -- no design pass
            for this story, so styling deliberately mirrors recenterButton's
            existing small-circular-icon-button treatment rather than
            inventing a new visual language. */}
        {myTravelRole !== 'driving' ? (
          <View testID="spotting-controls" style={styles.spottingRow}>
            <Pressable
              testID="spot-police-button"
              accessibilityRole="button"
              accessibilityLabel="Log a police sighting"
              accessibilityState={{ disabled: loggingSpotTypes.has('police') }}
              disabled={loggingSpotTypes.has('police')}
              onPress={() => handleLogSpotting('police')}
              style={({ pressed }) => [styles.spottingButton, pressed && styles.pressedScale, loggingSpotTypes.has('police') && styles.drawerRowDisabled]}
            >
              <Text style={styles.spottingButtonIcon}>{'🚓'}</Text>
            </Pressable>
            <Pressable
              testID="spot-deer-button"
              accessibilityRole="button"
              accessibilityLabel="Log a deer sighting"
              accessibilityState={{ disabled: loggingSpotTypes.has('deer') }}
              disabled={loggingSpotTypes.has('deer')}
              onPress={() => handleLogSpotting('deer')}
              style={({ pressed }) => [styles.spottingButton, pressed && styles.pressedScale, loggingSpotTypes.has('deer') && styles.drawerRowDisabled]}
            >
              <Text style={styles.spottingButtonIcon}>{'🦌'}</Text>
            </Pressable>
            <Pressable
              testID="spot-construction-button"
              accessibilityRole="button"
              accessibilityLabel="Log construction"
              accessibilityState={{ disabled: loggingSpotTypes.has('construction') }}
              disabled={loggingSpotTypes.has('construction')}
              onPress={() => handleLogSpotting('construction')}
              style={({ pressed }) => [styles.spottingButton, pressed && styles.pressedScale, loggingSpotTypes.has('construction') && styles.drawerRowDisabled]}
            >
              <Text style={styles.spottingButtonIcon}>{'🚧'}</Text>
            </Pressable>
          </View>
        ) : null}
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
                icon="💬"
                onPress={() => {
                  markVoyageStarted();
                  router.push({
                    pathname: '/join-code',
                    params: { destination: activeVoyage.voyage.destination, joinCode: activeVoyage.voyage.joinCode! },
                  });
                }}
              />
            ) : null}
            <DrawerRow
              testID="join-another-voyage-button"
              label="Join another Voyage"
              icon="＋"
              onPress={() => {
                resetDrawerState();
                router.push('/join');
              }}
            />
            <DrawerRow
              testID="voyage-settings-button"
              label="Settings"
              icon="⚙"
              onPress={() => {
                resetDrawerState();
                router.push('/settings');
              }}
            />
            {isOrganizer ? (
              <DrawerRow testID="end-voyage-button" label="End Voyage" icon="🚫" variant="danger" onPress={() => setShowConfirm(true)} />
            ) : null}
            {canLeaveVoyage ? (
              <DrawerRow
                testID="leave-voyage-button"
                label="Leave Voyage"
                icon="↩"
                variant="danger"
                onPress={() => setShowLeaveConfirm(true)}
              />
            ) : null}

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

        {drawerStep === 'leave-confirm' ? (
          <>
            <Text style={styles.drawerEyebrow}>Leave Voyage</Text>
            <Text style={styles.drawerConfirmTitle}>Leave this Voyage?</Text>
            <Text style={styles.drawerConfirmSub}>
              {isOrganizer
                ? "Your marker disappears right away. If you're the last Organizer, this Voyage will end for everyone. You can join again later unless an Organizer removes you."
                : 'Your marker disappears right away. You can join again later unless an Organizer removes you.'}
            </Text>
            <DrawerRow
              testID="confirm-leave-voyage-button"
              label="Leave Voyage"
              variant="danger"
              disabled={isLeaving}
              onPress={handleLeaveVoyage}
            />
            <DrawerRow
              testID="keep-riding-button"
              label="Keep riding"
              disabled={isLeaving}
              onPress={() => {
                setShowLeaveConfirm(false);
                setLeaveError(null);
              }}
            />
            {leaveError ? (
              <Text testID="leave-voyage-error" style={styles.drawerError}>
                {leaveError}
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
    fontFamily: 'GeneralSans-Bold',
    fontSize: 18,
    fontWeight: '700',
  },
  drawerTitle: {
    color: ActionDrawerTokens.ink,
    // 700 (Bold), not Typography.headline's own 600 (Semibold).
    fontFamily: 'GeneralSans-Bold',
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
    // The only italic usage anywhere in this codebase -- needs its own
    // dedicated loaded italic face, not a synthetic OS-level slant applied
    // to GeneralSans-Regular.
    fontFamily: 'GeneralSans-Italic',
    fontSize: 11,
    fontStyle: 'italic',
  },
  // Values transcribed directly from the mockup's real .drawer-row CSS, not
  // approximated to the Rounded/Spacing scale (code review finding -- see
  // ActionDrawer token's own comment in design-tokens.ts).
  drawerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing['2'],
    borderRadius: ActionDrawerTokens.rowRadius,
    backgroundColor: ActionDrawerTokens.rowBackground,
    paddingVertical: ActionDrawerTokens.rowPaddingVertical,
    paddingHorizontal: ActionDrawerTokens.rowPaddingHorizontal,
    marginBottom: ActionDrawerTokens.rowMarginBottom,
  },
  // Matches mockups/key-live-map.html's own literal .row-icon font-size.
  drawerRowIcon: {
    fontSize: 15,
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
    // 600 (Semibold), not Typography.body's own 400 (Regular).
    fontFamily: 'GeneralSans-Semibold',
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
    // 700 (Bold), not Typography.label's own 600 (Semibold).
    fontFamily: 'GeneralSans-Bold',
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
    // No loaded General Sans weight goes past Bold (700) -- the requested
    // 800 doesn't exist as a static file, so this collapses to 700/Bold
    // rather than requesting a heavier weight than what's loaded (which
    // would trigger OS-level faux/synthetic bolding on top of it).
    fontFamily: 'GeneralSans-Bold',
    fontSize: 15,
    fontWeight: '700',
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
    // 700 (Bold), not Typography.headline's own 600 (Semibold).
    fontFamily: 'GeneralSans-Bold',
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
    // 700 (Bold), not Typography.label's own 600 (Semibold).
    fontFamily: 'GeneralSans-Bold',
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
    // 700 (Bold), not Typography.label's own 600 (Semibold).
    fontFamily: 'GeneralSans-Bold',
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
  spottingRow: {
    flexDirection: 'row',
    gap: Spacing['2'],
  },
  // NFR7: manual Fun Fact-family capture controls need a >=60pt/dp tap
  // target (stricter than the general 44pt/48dp floor) -- sized explicitly
  // rather than reusing recenterButton's 56x56.
  spottingButton: {
    width: 60,
    height: 60,
    borderRadius: 16,
    backgroundColor: HudBar.recenterBackground,
    alignItems: 'center',
    justifyContent: 'center',
  },
  spottingButtonIcon: {
    fontSize: 22,
  },
  markerHitRegion: {
    width: MapMarker.hitRegion,
    height: MapMarker.hitRegion,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Always visible on your own marker (not gated on isSelected) -- same
  // "this is you" convention Waze/Google Maps use. 8px wider than the dot
  // itself (MapMarker.size), matching the mockup's own 4px-per-side inset,
  // centered within markerHitRegion.
  markerYouRing: {
    position: 'absolute',
    top: (MapMarker.hitRegion - (MapMarker.size + 8)) / 2,
    left: (MapMarker.hitRegion - (MapMarker.size + 8)) / 2,
    width: MapMarker.size + 8,
    height: MapMarker.size + 8,
    borderRadius: (MapMarker.size + 8) / 2,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: WayfinderColors.accentPrimary,
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
  // One-shot amber spark burst on peek-card open (Story 4.6, "Pop &
  // Bounce") -- centered on the marker the same way markerPulse/
  // markerReduceMotionRing already are (absolute + MapMarker.size, relying
  // on markerHitRegion's own alignItems/justifyContent centering).
  markerSparkWrap: {
    position: 'absolute',
    width: MapMarker.size,
    height: MapMarker.size,
    alignItems: 'center',
    justifyContent: 'center',
  },
  markerSpark: {
    position: 'absolute',
    width: 4,
    height: 10,
    borderRadius: 2,
    backgroundColor: MarkerPeekCardMotion.sparkColor,
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
    fontFamily: 'GeneralSans-Bold',
    fontSize: 10.5,
    fontWeight: '700',
    paddingHorizontal: Spacing['2'],
    paddingVertical: 2,
    borderRadius: 8,
    overflow: 'hidden',
  },
  // Waze-style callout anchored above the marker (mockups/key-marker-peek-
  // card.html) -- replaces the old full-width bottom-sheet peek card.
  // Positioned within the same MarkerView as the marker itself, so it pans/
  // zooms with the map for free; no separate screen-coordinate tracking.
  markerTooltipWrap: {
    position: 'absolute',
    bottom: MapMarker.hitRegion / 2 + 14,
    alignItems: 'center',
    zIndex: 10,
  },
  markerTooltip: {
    backgroundColor: WayfinderColors.surfacePrimary,
    borderWidth: 1,
    borderColor: WayfinderColors.borderHairline,
    borderRadius: Rounded.md,
    // 14, not Spacing['3']'s 12 -- literal mockup value (mockups/key-marker-
    // peek-card.html: padding: 14px 16px), same "don't force an existing
    // scale step" convention as the coordinate row/stat pair below.
    paddingVertical: 14,
    paddingHorizontal: Spacing['4'],
    // 230, not the old 168 -- widened for Story 4.6's coordinate row/stat
    // pair content, matching mockups/key-marker-peek-card.html's real width.
    minWidth: 230,
    shadowColor: WayfinderColors.inkPrimary,
    shadowOpacity: 0.15,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  markerTooltipHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing['4'],
  },
  markerTooltipNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing['2'],
  },
  markerTooltipSwatch: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  markerTooltipName: {
    color: WayfinderColors.inkPrimary,
    fontFamily: 'GeneralSans-Bold',
    fontSize: 15,
    fontWeight: '700',
  },
  markerTooltipClose: {
    color: WayfinderColors.inkDisabled,
    fontSize: 13,
    padding: 2,
  },
  markerTooltipRole: {
    marginTop: 3,
    color: WayfinderColors.inkSecondary,
    fontFamily: Typography.body.fontFamily,
    fontSize: 11.5,
  },
  // Coordinate row (Story 4.6) -- decimal-degrees text + copy/Get
  // Directions controls, literal per-mockup values (not forced onto an
  // existing scale step, same convention Story 4.4's Dev Notes established
  // for Voyage Ended's stat values).
  markerTooltipCoordRow: {
    marginTop: Spacing['1'] + 6,
    paddingVertical: Spacing['2'],
    paddingHorizontal: Spacing['2'] + 2,
    backgroundColor: WayfinderColors.surfaceSecondary,
    borderRadius: Rounded.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing['2'],
  },
  markerTooltipCoordText: {
    color: WayfinderColors.inkPrimary,
    fontFamily: 'SpaceMono-Bold',
    fontSize: 12.5,
    fontWeight: '700',
    // -0.01em @ 12.5px = -0.125 (RN's letterSpacing is absolute points, not
    // em -- code review finding: this was dropped from the mockup's
    // .coord-text transcription).
    letterSpacing: -0.125,
  },
  markerTooltipCoordActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing['1'] + 2,
  },
  markerTooltipCopyButton: {
    width: 26,
    height: 26,
    // 8, not Rounded.sm's 10 -- literal mockup value (.copy-btn, .nav-btn
    // { border-radius: 8px }), distinct from the coord row's own 10px.
    borderRadius: 8,
    backgroundColor: WayfinderColors.surfacePrimary,
    borderWidth: 1,
    borderColor: WayfinderColors.borderHairline,
    alignItems: 'center',
    justifyContent: 'center',
  },
  markerTooltipCopyButtonActive: {
    backgroundColor: WayfinderColors.success,
    borderColor: WayfinderColors.success,
  },
  markerTooltipCopyIcon: {
    color: WayfinderColors.inkSecondary,
    fontSize: 13,
  },
  markerTooltipCopyIconActive: {
    color: '#FFFFFF',
  },
  // Stacked directly on top of the clipboard icon -- centers for free via
  // markerTooltipCopyButton's own alignItems/justifyContent, same technique
  // markerPulse/markerReduceMotionRing already use.
  markerTooltipCopyIconOverlay: {
    position: 'absolute',
  },
  markerTooltipNavButton: {
    width: 26,
    height: 26,
    borderRadius: 8,
    backgroundColor: WayfinderColors.accentPrimary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  markerTooltipNavIcon: {
    color: '#FFFFFF',
    fontSize: 12,
  },
  markerTooltipSelfNote: {
    marginTop: 3,
    color: WayfinderColors.inkDisabled,
    fontFamily: Typography.body.fontFamily,
    fontSize: 11,
  },
  // HUD scoreboard stat pair (Story 4.6) -- side-by-side, divided by a
  // hairline. 18px/700, not Typography.statNumeral's 32px scale step --
  // literal mockup value, same "don't force an existing scale step"
  // convention as the coordinate row above.
  markerTooltipStatPair: {
    marginTop: Spacing['2'] + 2,
    paddingTop: Spacing['2'] + 2,
    borderTopWidth: 1,
    borderTopColor: '#F0F2F6',
    flexDirection: 'row',
  },
  markerTooltipStatCell: {
    flex: 1,
    alignItems: 'center',
  },
  markerTooltipStatCellBordered: {
    borderLeftWidth: 1,
    borderLeftColor: '#F0F2F6',
  },
  markerTooltipStatNum: {
    fontFamily: 'SpaceMono-Bold',
    fontSize: 18,
    fontWeight: '700',
  },
  markerTooltipStatCap: {
    marginTop: 2,
    color: WayfinderColors.inkSecondary,
    fontFamily: 'GeneralSans-Bold',
    fontSize: 10.5,
    fontWeight: '700',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  // Speech-bubble tail pointing down at the marker -- a 45deg-rotated
  // square, top-left corner hidden, matching the mockup's own literal
  // "right+bottom border only" technique for a clean single-side shadow.
  markerTooltipTail: {
    width: 12,
    height: 12,
    marginTop: -7,
    backgroundColor: WayfinderColors.surfacePrimary,
    borderRightWidth: 1,
    borderBottomWidth: 1,
    borderRightColor: WayfinderColors.borderHairline,
    borderBottomColor: WayfinderColors.borderHairline,
    transform: [{ rotate: '45deg' }],
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

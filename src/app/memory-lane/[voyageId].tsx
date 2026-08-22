import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, PanResponder, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Circle, Rect } from 'react-native-svg';

import { MemoryLaneAurora, MemoryLaneCard, MemoryLaneDeck, PlayerColors, Rounded, Spacing, WayfinderColors } from '@/constants/design-tokens';
import type { MemoryLaneData, MemoryLaneVoyager } from '@/repositories/memory-lane-composer';
import { getSuperlativeCopy, getWhoJoinedCopy } from '@/shared/lib/memory-lane-copy';
import { useMemoryLaneData } from '@/shared/hooks/use-memory-lane-data';
import { useReduceMotion } from '@/shared/hooks/use-reduce-motion';

// Memory Lane Reveal (DESIGN.md#memory-lane-deck, EXPERIENCE.md#Motion &
// Transitions "End Voyage -> Memory Lane Reveal") -- the "Player
// Constellation" full-screen swipeable card sequence. 7 screens: trigger/CTA,
// 5 content cards, closing beat. Reached by voyageId (route param), both from
// active-voyage.tsx's handleEndVoyage and, later, from a Voyage History row
// (Story 6.4, not built here) -- this screen's own data-fetch by id is what
// makes that revisit-later requirement (AC4) possible.
//
// Pixel reference: mockups/key-memory-lane-reveal.html. Implementation note:
// built on React Native core's own `Animated` + `PanResponder`, not
// react-native-reanimated/react-native-gesture-handler -- both are present in
// package.json but, verified during this story, are not used anywhere else in
// this codebase; every other Motion & Transitions entry (Pop & Bounce,
// cut-to-gameplay, Home Journey, Splash Thread) is built the same way this
// screen is, so this follows that established convention rather than
// introducing a second animation paradigm for one screen.

const TOTAL_SCREENS = MemoryLaneDeck.cardCount + 2; // trigger + 5 content cards + closing beat
const CONTENT_CARD_START = 1;
const CONTENT_CARD_END = MemoryLaneDeck.cardCount; // inclusive
const CLOSING_INDEX = TOTAL_SCREENS - 1;

function formatDuration(durationMs: number): string {
  const totalMinutes = Math.max(0, Math.round(durationMs / 60000));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${hours}h ${minutes}m`;
}

function voyagerName(voyager: MemoryLaneVoyager): string {
  return voyager.displayName ?? 'A Voyager';
}

function playerColorHex(voyager: MemoryLaneVoyager, fallback: string): string {
  return voyager.playerColor ? PlayerColors[voyager.playerColor] : fallback;
}

// The deck's full-bleed decorative background -- purely visual, excluded
// from the accessibility tree (Story 6.2 accessibility review finding).
function Aurora({ cardIndex }: { cardIndex: number }) {
  const blobs = MemoryLaneAurora.blobsByCard[cardIndex] ?? MemoryLaneAurora.blobsByCard[0];
  return (
    <Svg
      style={StyleSheet.absoluteFill}
      viewBox={`0 0 ${MemoryLaneAurora.viewBoxWidth} ${MemoryLaneAurora.viewBoxHeight}`}
      preserveAspectRatio="xMidYMid slice"
      importantForAccessibility="no-hide-descendants"
      accessibilityElementsHidden
      pointerEvents="none"
    >
      <Rect x={0} y={0} width={MemoryLaneAurora.viewBoxWidth} height={MemoryLaneAurora.viewBoxHeight} fill={MemoryLaneAurora.baseSurface} />
      {blobs.map(([cx, cy, r, color, opacity], i) => (
        <Circle key={i} cx={cx} cy={cy} r={r} fill={color} opacity={opacity} />
      ))}
    </Svg>
  );
}

function ProgressDots({ activeContentIndex }: { activeContentIndex: number }) {
  return (
    <View style={styles.dotsRow} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {Array.from({ length: MemoryLaneDeck.cardCount }, (_, i) => (
        <View key={i} style={[styles.dot, i === activeContentIndex ? styles.dotActive : null]} />
      ))}
    </View>
  );
}

function ContentPanel({ children, style }: { children: React.ReactNode; style?: object }) {
  return <View style={[styles.contentPanel, style]}>{children}</View>;
}

// A card's entrance animation: an Animated.Value that eases 0 -> 1 once per
// mount (cards are conditionally rendered, so this naturally replays every
// time a Voyager revisits the card -- no separate "active" tracking needed).
// Settles instantly at 1 under Reduce Motion, matching goTo()'s own gate.
function useEntranceProgress(
  durationMs: number,
  easing: readonly [number, number, number, number],
  reduceMotion: boolean,
  reduceMotionResolved: boolean,
): Animated.Value {
  const [progress] = useState(() => new Animated.Value(0));
  useEffect(() => {
    if (!reduceMotionResolved || reduceMotion) {
      progress.setValue(1);
      return;
    }
    progress.setValue(0);
    const animation = Animated.timing(progress, {
      toValue: 1,
      duration: durationMs,
      easing: Easing.bezier(...easing),
      useNativeDriver: false, // fillBar animates `width`, which the native driver can't handle -- kept uniform across all entrance animations for one code path.
    });
    animation.start();
    // Stop on cleanup (card unmounts, or a dep changes) -- otherwise the
    // JS-driven timing loop keeps ticking after its owning card is gone.
    return () => animation.stop();
  }, [durationMs, easing, reduceMotion, reduceMotionResolved, progress]);
  return progress;
}

type CardMotionProps = { reduceMotion: boolean; reduceMotionResolved: boolean };

// --- Individual card content -------------------------------------------

function TriggerCard({ onStart }: { onStart: () => void }) {
  return (
    <View style={styles.centerFill}>
      <View style={styles.triggerHeadlineWrap}>
        <Text style={styles.headline}>{'Everyone’s story\nis ready.'}</Text>
        <Text style={styles.triggerSub}>See it the way the whole crew lived it.</Text>
      </View>
      <Pressable testID="memory-lane-start-button" accessibilityRole="button" onPress={onStart} style={styles.primaryButton}>
        <Text style={styles.primaryButtonLabel}>Show me my Voylo</Text>
      </Pressable>
    </View>
  );
}

const CONVERGE_DOTS = [
  { dx: -44, color: PlayerColors.teal },
  { dx: 0, color: PlayerColors.coral },
  { dx: 44, color: PlayerColors.gold },
] as const;

function DestinationCard({ data, reduceMotion, reduceMotionResolved }: { data: MemoryLaneData } & CardMotionProps) {
  const converge = useEntranceProgress(MemoryLaneDeck.convergeDurationMs, MemoryLaneDeck.convergeEasing, reduceMotion, reduceMotionResolved);
  return (
    <View style={styles.centerFill}>
      <Text style={styles.eyebrow}>Destination</Text>
      <View style={styles.convergeRow} pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        {CONVERGE_DOTS.map((dot, i) => (
          <Animated.View
            key={i}
            style={[
              styles.convergeDot,
              { backgroundColor: dot.color, opacity: converge },
              { transform: [{ translateX: converge.interpolate({ inputRange: [0, 1], outputRange: [dot.dx, 0] }) }] },
            ]}
          />
        ))}
      </View>
      <Text style={[styles.headline, styles.destinationHeadline]}>{data.destination}</Text>
    </View>
  );
}

function WhoJoinedCard({ data, reduceMotion, reduceMotionResolved }: { data: MemoryLaneData } & CardMotionProps) {
  const copy = getWhoJoinedCopy(data);
  const fadeUp = useEntranceProgress(MemoryLaneDeck.fadeUpDurationMs, MemoryLaneDeck.fadeUpEasing, reduceMotion, reduceMotionResolved);
  return (
    <View style={[styles.centerFill, styles.bottomAligned]}>
      <Animated.View
        style={{ opacity: fadeUp, transform: [{ translateY: fadeUp.interpolate({ inputRange: [0, 1], outputRange: [MemoryLaneDeck.fadeUpTranslateY, 0] }) }] }}
      >
        <ContentPanel>
          <Text style={styles.headlineSmall}>{copy.headline}</Text>
          <Text style={styles.subheadMuted}>{copy.subhead}</Text>
        </ContentPanel>
      </Animated.View>
    </View>
  );
}

function StopsCard({ data, reduceMotion, reduceMotionResolved }: { data: MemoryLaneData } & CardMotionProps) {
  const maxSpotCount = Math.max(1, ...data.voyagers.map((v) => v.spotCount));
  const dotPop = useEntranceProgress(MemoryLaneDeck.dotPopDurationMs, MemoryLaneDeck.dotPopEasing, reduceMotion, reduceMotionResolved);
  const fillBar = useEntranceProgress(MemoryLaneDeck.fillBarDurationMs, MemoryLaneDeck.fillBarEasing, reduceMotion, reduceMotionResolved);
  return (
    <View style={styles.centerFill}>
      <ContentPanel style={styles.fullWidthPanel}>
        <Text style={styles.eyebrowMuted}>Stops by crew member</Text>
        <View style={styles.stopsRows}>
          {data.voyagers.map((voyager) => {
            const targetPct = (voyager.spotCount / maxSpotCount) * 100;
            return (
              <View key={voyager.userId} style={styles.stopsRow}>
                <Animated.View
                  style={[
                    styles.stopsDot,
                    { backgroundColor: playerColorHex(voyager, WayfinderColors.inkSecondary) },
                    { transform: [{ scale: dotPop }] },
                  ]}
                />
                <Text style={styles.stopsName} numberOfLines={1}>
                  {voyagerName(voyager)}
                </Text>
                <View style={styles.stopsBarTrack}>
                  <Animated.View
                    style={[
                      styles.stopsBarFill,
                      { backgroundColor: playerColorHex(voyager, WayfinderColors.inkSecondary) },
                      { width: fillBar.interpolate({ inputRange: [0, 1], outputRange: ['0%', `${targetPct}%`] }) },
                    ]}
                  />
                </View>
                <Text style={styles.stopsCount}>{voyager.spotCount}</Text>
              </View>
            );
          })}
        </View>
        <Text style={styles.stopsFooter}>
          {data.totalSpotCount} {data.totalSpotCount === 1 ? 'stop' : 'stops'} along the way.
        </Text>
      </ContentPanel>
    </View>
  );
}

function SuperlativesCard({ data, reduceMotion, reduceMotionResolved }: { data: MemoryLaneData } & CardMotionProps) {
  const copy = getSuperlativeCopy(data);
  const crownDrop = useEntranceProgress(MemoryLaneDeck.crownDropDurationMs, MemoryLaneDeck.crownDropEasing, reduceMotion, reduceMotionResolved);
  const fadeUp = useEntranceProgress(MemoryLaneDeck.fadeUpDurationMs, MemoryLaneDeck.fadeUpEasing, reduceMotion, reduceMotionResolved);
  return (
    <View style={styles.centerFill}>
      <ContentPanel style={styles.fullWidthPanel}>
        {copy ? (
          <View style={styles.superlativeBody}>
            <Animated.View
              style={[
                styles.superlativeBadge,
                { opacity: crownDrop, transform: [{ translateY: crownDrop.interpolate({ inputRange: [0, 1], outputRange: [-30, 0] }) }] },
              ]}
            >
              <Text style={styles.superlativeBadgeGlyph}>{'👑'}</Text>
            </Animated.View>
            <Text style={styles.eyebrowMuted}>Most Spots Logged</Text>
            <Text style={styles.headlineSmall}>{copy.headline}</Text>
            <Text style={styles.subheadMuted}>{copy.subhead}</Text>
          </View>
        ) : (
          <Animated.View
            style={[
              styles.superlativeBody,
              { opacity: fadeUp, transform: [{ translateY: fadeUp.interpolate({ inputRange: [0, 1], outputRange: [MemoryLaneDeck.fadeUpTranslateY, 0] }) }] },
            ]}
          >
            <Text style={styles.headlineSmall}>Clean roads all around.</Text>
            <Text style={styles.subheadMuted}>Nobody logged a spot this trip.</Text>
          </Animated.View>
        )}
      </ContentPanel>
    </View>
  );
}

function FinaleCard({ data }: { data: MemoryLaneData }) {
  return (
    <View style={[styles.centerFill, styles.bottomAligned]}>
      <ContentPanel style={styles.fullWidthPanel}>
        <View style={styles.finaleStatRow}>
          <View style={styles.finaleStatCell}>
            <Text style={styles.finaleStatValue}>{formatDuration(data.durationMs)}</Text>
            <Text style={styles.finaleStatLabel}>Duration</Text>
          </View>
          <View style={styles.finaleStatCell}>
            <Text style={styles.finaleStatValue}>{data.totalSpotCount}</Text>
            <Text style={styles.finaleStatLabel}>{data.totalSpotCount === 1 ? 'Stop' : 'Stops'}</Text>
          </View>
        </View>
        {/* Fixed quote, not computed -- deterministic template copy per AC1
            (no AI), matching EXPERIENCE.md's Voice and Tone "Do" example
            verbatim. Not distance-derived; see Dev Notes' "Distance stat
            omitted throughout" -- this finale intentionally pairs Duration
            with a Stop count instead of the mockup's Duration+Distance pair. */}
        <Text style={styles.finaleQuote}>{'“The map said five hours.\nThe memories took twelve.”'}</Text>
      </ContentPanel>
    </View>
  );
}

function ClosingCard({ onClose }: { onClose: () => void }) {
  return (
    <View style={[styles.centerFill, styles.bottomAligned]}>
      <Text style={styles.headlineSmall}>Until the next one, crew.</Text>
      <Text style={styles.closingSub}>Your Voylo is saved — come back anytime, or send it to them.</Text>
      <Pressable testID="memory-lane-close-button" accessibilityRole="button" onPress={onClose} style={styles.closeButton}>
        <Text style={styles.closeButtonLabel}>Close</Text>
      </Pressable>
    </View>
  );
}

function announceCard(index: number, data: MemoryLaneData) {
  if (index === 0) {
    AccessibilityInfo.announceForAccessibility('Everyone’s story is ready. Show me my Voylo, button.');
    return;
  }
  if (index === CLOSING_INDEX) {
    AccessibilityInfo.announceForAccessibility('Until the next one, crew. Close, button.');
    return;
  }
  const contentIndex = index - CONTENT_CARD_START; // 0-based, 0..4
  const prefix = `Card ${contentIndex + 1} of ${MemoryLaneDeck.cardCount}. `;
  let body = '';
  if (contentIndex === 0) body = `Destination. ${data.destination}.`;
  else if (contentIndex === 1) body = getWhoJoinedCopy(data).headline + ' ' + getWhoJoinedCopy(data).subhead;
  else if (contentIndex === 2) body = `${data.totalSpotCount} ${data.totalSpotCount === 1 ? 'stop' : 'stops'} along the way.`;
  else if (contentIndex === 3) {
    const copy = getSuperlativeCopy(data);
    body = copy ? `${copy.headline}. ${copy.subhead}` : 'Clean roads all around. Nobody logged a spot this trip.';
  } else if (contentIndex === 4) body = `${formatDuration(data.durationMs)}. The map said five hours. The memories took twelve.`;
  AccessibilityInfo.announceForAccessibility(prefix + body);
}

export default function MemoryLaneDeckScreen() {
  const { voyageId } = useLocalSearchParams<{ voyageId: string }>();
  const { data, isLoading, error } = useMemoryLaneData(voyageId ?? null);
  const { reduceMotion, resolved: reduceMotionResolved } = useReduceMotion();

  const [index, setIndex] = useState(0);
  // useState's lazy initializer, not useRef(...).current -- same "create
  // once, stable across re-renders" semantic active-voyage.tsx's own
  // Animated.Value fields already use (its VoyagerMarker/pulseValue
  // comment explains why: reading a ref's .current during render, which
  // useRef(...).current effectively is, trips this codebase's
  // react-hooks/refs lint rule).
  const [translateX] = useState(() => new Animated.Value(0));
  const [contentOpacity] = useState(() => new Animated.Value(1));
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const goTo = useCallback(
    (nextIndex: number) => {
      const clamped = Math.max(0, Math.min(TOTAL_SCREENS - 1, nextIndex));
      if (clamped === index) return;
      setIndex(clamped);
      if (data) announceCard(clamped, data);

      if (!reduceMotionResolved || reduceMotion) {
        translateX.setValue(0);
        contentOpacity.setValue(1);
        return;
      }

      contentOpacity.setValue(0);
      translateX.setValue(clamped > index ? 40 : -40);
      Animated.parallel([
        Animated.timing(translateX, {
          toValue: 0,
          duration: MemoryLaneDeck.cardTransitionDurationMs,
          easing: Easing.bezier(...MemoryLaneDeck.cardTransitionEasing),
          useNativeDriver: true,
        }),
        Animated.timing(contentOpacity, {
          toValue: 1,
          duration: MemoryLaneDeck.cardTransitionDurationMs,
          easing: Easing.bezier(...MemoryLaneDeck.cardTransitionEasing),
          useNativeDriver: true,
        }),
      ]).start();
    },
    [index, data, reduceMotionResolved, reduceMotion, translateX, contentOpacity],
  );

  // WCAG 2.5.1's non-gestural fallback (see DESIGN.md's memory-lane-deck.
  // navigation) is two explicit, always-present Pressable zones -- not
  // inferred from a short/failed swipe gesture. A real element (rather than
  // a PanResponder release-distance heuristic) is both a more honest "always
  // a real tap target" and independently testable without simulating a
  // touch-gesture sequence.
  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_evt, gesture) => Math.abs(gesture.dx) > 12 && Math.abs(gesture.dx) > Math.abs(gesture.dy),
        onPanResponderRelease: (_evt, gesture) => {
          const SWIPE_THRESHOLD = 60;
          if (gesture.dx <= -SWIPE_THRESHOLD) goTo(index + 1);
          else if (gesture.dx >= SWIPE_THRESHOLD) goTo(index - 1);
        },
      }),
    [index, goTo],
  );

  useEffect(() => {
    if (data) announceCard(0, data);
    // Announce the trigger screen once data first resolves -- not re-run on
    // every data identity change (a refetch shouldn't re-announce the
    // currently-viewed card out from under the Voyager).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [!!data]);

  if (isLoading) {
    return (
      <View style={styles.container}>
        <SafeAreaView style={styles.safeArea}>
          <Text style={styles.loadingText}>Loading your Voylo…</Text>
        </SafeAreaView>
      </View>
    );
  }

  if (error || !data) {
    return (
      <View style={styles.container}>
        <SafeAreaView style={styles.safeArea}>
          <Text testID="memory-lane-error" style={styles.loadingText}>
            {error ?? 'Something went wrong.'}
          </Text>
          <Pressable testID="memory-lane-error-back" accessibilityRole="button" onPress={() => router.back()} style={styles.closeButton}>
            <Text style={styles.closeButtonLabel}>Go back</Text>
          </Pressable>
        </SafeAreaView>
      </View>
    );
  }

  const isTrigger = index === 0;
  const isClosing = index === CLOSING_INDEX;
  const activeContentIndex = index - CONTENT_CARD_START;

  return (
    <View style={styles.container} {...panResponder.panHandlers}>
      <Aurora cardIndex={index} />
      {!isTrigger && !isClosing ? <ProgressDots activeContentIndex={activeContentIndex} /> : null}
      <SafeAreaView style={styles.safeArea}>
        <Animated.View style={[styles.cardBody, { opacity: contentOpacity, transform: [{ translateX }] }]}>
          {isTrigger ? <TriggerCard onStart={() => goTo(1)} /> : null}
          {activeContentIndex === 0 ? (
            <DestinationCard data={data} reduceMotion={reduceMotion} reduceMotionResolved={reduceMotionResolved} />
          ) : null}
          {activeContentIndex === 1 ? <WhoJoinedCard data={data} reduceMotion={reduceMotion} reduceMotionResolved={reduceMotionResolved} /> : null}
          {activeContentIndex === 2 ? <StopsCard data={data} reduceMotion={reduceMotion} reduceMotionResolved={reduceMotionResolved} /> : null}
          {activeContentIndex === 3 ? (
            <SuperlativesCard data={data} reduceMotion={reduceMotion} reduceMotionResolved={reduceMotionResolved} />
          ) : null}
          {activeContentIndex === 4 ? <FinaleCard data={data} /> : null}
          {isClosing ? (
            <ClosingCard
              onClose={() => router.replace({ pathname: '/journey/[voyageId]', params: { voyageId: data.voyageId } })}
            />
          ) : null}
        </Animated.View>
      </SafeAreaView>
      {!isTrigger && !isClosing ? (
        <>
          {/* WCAG 2.5.1 non-gestural swipe fallback: always-present edge zones,
              20% width each per MemoryLaneDeck.edgeTapZoneWidthFraction --
              same navigation as a swipe, just a discrete tap target. */}
          <Pressable
            testID="memory-lane-edge-prev"
            accessibilityRole="button"
            accessibilityLabel="Previous card"
            onPress={() => goTo(index - 1)}
            style={styles.edgeZoneLeft}
          />
          <Pressable
            testID="memory-lane-edge-next"
            accessibilityRole="button"
            accessibilityLabel="Next card"
            onPress={() => goTo(index + 1)}
            style={styles.edgeZoneRight}
          />
          <Text style={styles.swipeHint}>{activeContentIndex === CONTENT_CARD_END - CONTENT_CARD_START ? 'tap to finish →' : '← swipe →'}</Text>
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: MemoryLaneAurora.baseSurface },
  safeArea: { flex: 1 },
  loadingText: { flex: 1, textAlign: 'center', textAlignVertical: 'center', color: WayfinderColors.inkPrimary, fontSize: 16 },
  cardBody: { flex: 1 },
  centerFill: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: Spacing['6'] },
  bottomAligned: { justifyContent: 'flex-end', paddingBottom: Spacing.heroGap },
  dotsRow: { position: 'absolute', top: 56, left: 0, right: 0, flexDirection: 'row', justifyContent: 'center', gap: 6, zIndex: 6 },
  dot: { width: 6, height: 6, borderRadius: Rounded.full, backgroundColor: MemoryLaneDeck.progressDotInactive },
  dotActive: { width: 16, borderRadius: 3, backgroundColor: MemoryLaneDeck.progressDotActive },
  edgeZoneLeft: { position: 'absolute', top: 0, bottom: 0, left: 0, width: `${MemoryLaneDeck.edgeTapZoneWidthFraction * 100}%` },
  edgeZoneRight: { position: 'absolute', top: 0, bottom: 0, right: 0, width: `${MemoryLaneDeck.edgeTapZoneWidthFraction * 100}%` },
  swipeHint: {
    position: 'absolute',
    bottom: 20,
    left: 0,
    right: 0,
    textAlign: 'center',
    color: WayfinderColors.inkPrimary,
    fontFamily: 'GeneralSans-Bold',
    fontSize: 11,
    letterSpacing: 0.5,
  },
  headline: { fontFamily: 'ClashDisplay-Semibold', fontSize: 28, color: WayfinderColors.inkPrimary, textAlign: 'center', lineHeight: 32 },
  destinationHeadline: { fontSize: 34, marginTop: 4 },
  headlineSmall: { fontFamily: 'ClashDisplay-Semibold', fontSize: 20, color: WayfinderColors.inkPrimary, textAlign: 'center' },
  triggerHeadlineWrap: { alignItems: 'center', marginBottom: Spacing['6'] },
  triggerSub: { marginTop: Spacing['2'], color: WayfinderColors.inkPrimary, fontFamily: 'GeneralSans-Regular', fontSize: 14, textAlign: 'center' },
  eyebrow: {
    color: WayfinderColors.inkPrimary,
    fontFamily: 'GeneralSans-Bold',
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 6,
  },
  convergeRow: { flexDirection: 'row', gap: 10, marginBottom: Spacing['3'] },
  convergeDot: { width: 8, height: 8, borderRadius: Rounded.full },
  eyebrowMuted: {
    color: WayfinderColors.inkSecondary,
    fontFamily: 'GeneralSans-Bold',
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 1,
    textAlign: 'center',
    marginBottom: Spacing['3'],
  },
  subheadMuted: { marginTop: Spacing['2'], color: WayfinderColors.inkSecondary, fontFamily: 'GeneralSans-Regular', fontSize: 13, textAlign: 'center' },
  closingSub: { marginTop: Spacing['2'], color: WayfinderColors.inkPrimary, fontFamily: 'GeneralSans-Regular', fontSize: 13, textAlign: 'center', maxWidth: 260 },
  primaryButton: {
    marginTop: Spacing['6'],
    backgroundColor: WayfinderColors.accentPrimary,
    borderRadius: Rounded.full,
    paddingVertical: Spacing['4'],
    paddingHorizontal: Spacing['6'],
  },
  primaryButtonLabel: { color: '#FFFFFF', fontFamily: 'GeneralSans-Bold', fontSize: 15, textAlign: 'center' },
  closeButton: { marginTop: Spacing['5'], borderRadius: Rounded.full, paddingVertical: Spacing['3'], paddingHorizontal: Spacing['5'], borderWidth: 2, borderColor: 'rgba(16,24,40,0.3)' },
  closeButtonLabel: { color: WayfinderColors.inkPrimary, fontFamily: 'GeneralSans-Bold', fontSize: 14, textAlign: 'center' },
  contentPanel: {
    backgroundColor: MemoryLaneCard.background,
    borderWidth: 1,
    borderColor: MemoryLaneCard.borderColor,
    borderRadius: MemoryLaneCard.radius,
    padding: MemoryLaneCard.padding,
    // Flat offset shadow (not blurred), same convention as
    // WayfinderButtonIgnition's own pressedShadow.
    shadowColor: MemoryLaneCard.shadowColor,
    shadowOffset: { width: 0, height: MemoryLaneCard.shadowOffset },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: MemoryLaneCard.shadowOffset,
  },
  fullWidthPanel: { width: '100%' },
  stopsRows: { gap: Spacing['3'] },
  stopsRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing['2'] },
  stopsDot: { width: 10, height: 10, borderRadius: Rounded.full },
  stopsName: { width: 64, fontFamily: 'GeneralSans-Bold', fontSize: 12.5, color: WayfinderColors.inkPrimary },
  stopsBarTrack: { flex: 1, height: 9, borderRadius: 5, backgroundColor: WayfinderColors.surfaceTertiary, overflow: 'hidden' },
  stopsBarFill: { height: '100%', borderRadius: 5 },
  stopsCount: { width: 18, textAlign: 'right', fontFamily: 'SpaceMono-Bold', fontSize: 13, color: WayfinderColors.inkPrimary },
  stopsFooter: { marginTop: Spacing['3'], textAlign: 'center', color: WayfinderColors.inkSecondary, fontFamily: 'GeneralSans-Regular', fontSize: 12.5 },
  superlativeBody: { alignItems: 'center', gap: 4 },
  superlativeBadge: {
    width: 56,
    height: 56,
    borderRadius: Rounded.full,
    backgroundColor: WayfinderColors.accentAmber,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing['2'],
  },
  superlativeBadgeGlyph: { fontSize: 22 },
  finaleStatRow: { flexDirection: 'row', justifyContent: 'center', gap: Spacing['5'], marginBottom: Spacing['3'] },
  finaleStatCell: { alignItems: 'center' },
  finaleStatValue: { fontFamily: 'SpaceMono-Bold', fontSize: 24, color: WayfinderColors.accentPrimary },
  finaleStatLabel: { fontFamily: 'GeneralSans-Bold', fontSize: 9.5, color: WayfinderColors.inkSecondary, textTransform: 'uppercase', letterSpacing: 0.5 },
  finaleQuote: { fontFamily: 'GeneralSans-Italic', fontSize: 15, color: WayfinderColors.inkPrimary, textAlign: 'center', lineHeight: 21 },
});

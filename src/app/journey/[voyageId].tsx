import * as Sharing from 'expo-sharing';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Circle, Rect } from 'react-native-svg';
import { captureRef } from 'react-native-view-shot';

import { MemoryLaneAurora, MemoryLaneCard, PlayerColors, Rounded, Spacing, WayfinderColors } from '@/constants/design-tokens';
import type { MemoryLaneVoyager } from '@/repositories/memory-lane-composer';
import { MemoryLaneShareCard } from '@/shared/components/memory-lane-share-card';
import { useMemoryLaneData } from '@/shared/hooks/use-memory-lane-data';
import { useReduceMotion } from '@/shared/hooks/use-reduce-motion';

const SHARE_CARD_CAPTURE_ERROR = "Couldn't make your card. Try again?";
const SHARE_CARD_SHARE_ERROR = "Couldn't share your card. Try again?";

// Persistent Journey Screen (DESIGN.md#journey-screen, EXPERIENCE.md IA) --
// the revisit/share home for one Voyage. Landed on when the reveal deck
// (memory-lane/[voyageId].tsx) closes; reached again, later, by tapping a
// Voyage History row (Story 6.4 -- not built here). This story (Task 6)
// builds the minimal version AC6 actually asks for: destination, crew, a
// replay control, and a stat summary -- the share row (Tasks 7-8) is a
// separate follow-up gated on new-dependency approval, not built here.
//
// Same route-param-only data-sourcing precedent as voyage-ended.tsx (fetches
// by voyageId, never reads useActiveVoyage() context) and the same
// unconditional-registration reasoning in _layout.tsx (Task 3).

const CARD_INDEX_FOR_AURORA = 6; // reuses the deck's own closing-beat blob layout, at reduced opacity per DESIGN.md's journey-screen.auroraOpacity.
const AURORA_OPACITY = 0.6; // "reduced ~40% from the reveal deck's intensity"

function formatDuration(durationMs: number): string {
  const totalMinutes = Math.max(0, Math.round(durationMs / 60000));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${hours}h ${minutes}m`;
}

function initial(voyager: MemoryLaneVoyager): string {
  return (voyager.displayName ?? '?').charAt(0).toUpperCase();
}

function playerColorHex(voyager: MemoryLaneVoyager, fallback: string): string {
  return voyager.playerColor ? PlayerColors[voyager.playerColor] : fallback;
}

function ShimmerPlayIcon() {
  const { reduceMotion, resolved } = useReduceMotion();
  const [opacity] = useState(() => new Animated.Value(1));
  const hasStartedRef = useRef(false);

  useEffect(() => {
    if (!resolved || hasStartedRef.current) return;
    hasStartedRef.current = true;
    if (reduceMotion) return; // rests at full opacity, no pulse.
    Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 0.55, duration: 1200, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 1, duration: 1200, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ]),
    ).start();
  }, [resolved, reduceMotion, opacity]);

  return (
    <Animated.View style={[styles.playIconCircle, { opacity }]}>
      <View style={styles.playTriangle} />
    </Animated.View>
  );
}

export default function JourneyScreen() {
  const { voyageId } = useLocalSearchParams<{ voyageId: string }>();
  const { data, isLoading, error } = useMemoryLaneData(voyageId ?? null);
  const shareCardRef = useRef<View>(null);
  const [isSharingCard, setIsSharingCard] = useState(false);
  const [shareCardError, setShareCardError] = useState<string | null>(null);
  // Ref-based re-entrancy guard, not state-only -- a rapid double-tap fires
  // both press events within the same React batch, before any re-render, so
  // a state-only guard would still read stale on the second call (the exact
  // bug Story 5.1's handleLogSpotting fixed the same way; see its comment).
  const isSharingCardRef = useRef(false);

  function handleReplay() {
    if (!data) return;
    // replace, not push -- the deck's own closing beat also replaces itself
    // with a fresh Journey Screen instance, so pushing here would leave this
    // screen behind it on the stack, growing by one on every replay cycle.
    router.replace({ pathname: '/memory-lane/[voyageId]', params: { voyageId: data.voyageId } });
  }

  async function handleShareCard() {
    if (isSharingCardRef.current) return;
    isSharingCardRef.current = true;
    setIsSharingCard(true);
    setShareCardError(null);

    // Two separate try/catches, not one -- a capture failure (native-module
    // error, storage full) and a share-step failure (share-sheet dismissal,
    // permission denial) are different problems with different messages;
    // conflating them into one generic "couldn't make your card" mislabels a
    // successfully-captured image whose only failure was the OS share step.
    let uri: string;
    try {
      uri = await captureRef(shareCardRef, { format: 'png', quality: 1 });
    } catch (err) {
      if (__DEV__) console.warn('[JourneyScreen] Memory Lane card capture failed', err);
      setShareCardError(SHARE_CARD_CAPTURE_ERROR);
      isSharingCardRef.current = false;
      setIsSharingCard(false);
      return;
    }

    try {
      const canShare = await Sharing.isAvailableAsync();
      if (!canShare) {
        setShareCardError('Sharing is not available on this device.');
        return;
      }
      await Sharing.shareAsync(uri, { mimeType: 'image/png', dialogTitle: 'Share your Voylo' });
    } catch (err) {
      if (__DEV__) console.warn('[JourneyScreen] Memory Lane card share failed', err);
      setShareCardError(SHARE_CARD_SHARE_ERROR);
    } finally {
      isSharingCardRef.current = false;
      setIsSharingCard(false);
    }
  }

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
          <Text testID="journey-screen-error" style={styles.loadingText}>
            {error ?? 'Something went wrong.'}
          </Text>
        </SafeAreaView>
      </View>
    );
  }

  const dateLabel = new Date(data.endedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });

  return (
    <View style={styles.container}>
      <Svg
        style={[StyleSheet.absoluteFill, { opacity: AURORA_OPACITY }]}
        viewBox={`0 0 ${MemoryLaneAurora.viewBoxWidth} ${MemoryLaneAurora.viewBoxHeight}`}
        preserveAspectRatio="xMidYMid slice"
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        pointerEvents="none"
      >
        <Rect x={0} y={0} width={MemoryLaneAurora.viewBoxWidth} height={MemoryLaneAurora.viewBoxHeight} fill={MemoryLaneAurora.baseSurface} />
        {MemoryLaneAurora.blobsByCard[CARD_INDEX_FOR_AURORA].map(([cx, cy, r, color, opacity], i) => (
          <Circle key={i} cx={cx} cy={cy} r={r} fill={color} opacity={opacity} />
        ))}
      </Svg>
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.topBar}>
          <Pressable
            testID="journey-back-button"
            accessibilityRole="button"
            accessibilityLabel="Back"
            onPress={() => router.back()}
            hitSlop={7} // 34px visual, 48pt/48dp hit region -- DESIGN.md journey-screen.navControls.
            style={styles.iconChip}
          >
            <Text style={styles.iconChipGlyph}>{'‹'}</Text>
          </Pressable>
          <Text style={styles.topBarDate}>{dateLabel}</Text>
        </View>

        <View style={styles.scrollArea}>
          <Text testID="journey-destination" style={styles.destination}>
            {data.destination}
          </Text>

          <View style={styles.avatarRow} accessible accessibilityLabel={`${data.voyagers.length} ${data.voyagers.length === 1 ? 'voyager' : 'voyagers'}`}>
            {data.voyagers.map((voyager, i) => (
              <View
                key={voyager.userId}
                style={[styles.avatar, { backgroundColor: playerColorHex(voyager, WayfinderColors.inkSecondary), marginLeft: i === 0 ? 0 : -10 }]}
              >
                <Text style={styles.avatarInitial}>{initial(voyager)}</Text>
              </View>
            ))}
          </View>

          <Pressable testID="journey-replay-button" accessibilityRole="button" onPress={handleReplay} style={styles.replayCard}>
            <View style={styles.replayHero}>
              <ShimmerPlayIcon />
            </View>
            <View style={styles.replayFooter}>
              <Text style={styles.replayTitle}>Watch your Voylo again</Text>
              <Text style={styles.replaySubtitle}>5 cards</Text>
            </View>
          </Pressable>

          <View style={styles.statPanel}>
            <View style={styles.statCell}>
              <Text testID="journey-duration" style={styles.statValue}>
                {formatDuration(data.durationMs)}
              </Text>
              <Text style={styles.statLabel}>Duration</Text>
            </View>
            <View style={styles.statCell}>
              <Text testID="journey-stop-count" style={styles.statValue}>
                {data.totalSpotCount}
              </Text>
              <Text style={styles.statLabel}>{data.totalSpotCount === 1 ? 'Stop' : 'Stops'}</Text>
            </View>
          </View>

          <Pressable
            testID="journey-share-card-button"
            accessibilityRole="button"
            accessibilityLabel={isSharingCard ? 'Preparing your card' : 'Share the card'}
            accessibilityState={{ disabled: isSharingCard }}
            disabled={isSharingCard}
            onPress={handleShareCard}
            style={[styles.shareButton, isSharingCard && styles.shareButtonDisabled]}
          >
            <Text style={styles.shareButtonLabel}>{isSharingCard ? 'Preparing…' : 'Share the card'}</Text>
          </Pressable>
          {shareCardError ? <Text style={styles.shareError}>{shareCardError}</Text> : null}
        </View>
      </SafeAreaView>

      {/* Off-screen (never visible to the Voyager) -- captureRef needs a
          real rendered View to snapshot. collapsable={false} on the card
          itself (see memory-lane-share-card.tsx) keeps the native view from
          being optimized away, which would make captureRef fail silently. */}
      <View ref={shareCardRef} style={styles.offscreenCapture} pointerEvents="none" collapsable={false}>
        <MemoryLaneShareCard data={data} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: WayfinderColors.surfaceSecondary },
  safeArea: { flex: 1 },
  loadingText: { flex: 1, textAlign: 'center', textAlignVertical: 'center', color: WayfinderColors.inkPrimary, fontSize: 16 },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: Spacing['5'], paddingTop: Spacing['2'] },
  iconChip: {
    width: 34,
    height: 34,
    borderRadius: Rounded.full,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: WayfinderColors.borderHairline,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconChipGlyph: { fontSize: 15, color: WayfinderColors.inkPrimary },
  topBarDate: { fontFamily: 'GeneralSans-Bold', fontSize: 11, color: WayfinderColors.inkSecondary, textTransform: 'uppercase', letterSpacing: 0.6 },
  scrollArea: { flex: 1, paddingHorizontal: Spacing['5'], paddingTop: Spacing['2'] },
  destination: { fontFamily: 'ClashDisplay-Semibold', fontSize: 26, color: WayfinderColors.inkPrimary, marginTop: 2 },
  avatarRow: { flexDirection: 'row', marginTop: Spacing['3'], marginBottom: Spacing['4'] },
  avatar: {
    width: 30,
    height: 30,
    borderRadius: Rounded.full,
    borderWidth: 3,
    borderColor: WayfinderColors.surfaceSecondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitial: { color: '#FFFFFF', fontFamily: 'GeneralSans-Bold', fontSize: 11 },
  replayCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: WayfinderColors.borderHairline,
    borderRadius: Rounded.xl,
    overflow: 'hidden',
    marginBottom: Spacing['3'],
  },
  replayHero: {
    height: 150,
    backgroundColor: WayfinderColors.accentPrimary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  playIconCircle: {
    width: 52,
    height: 52,
    borderRadius: Rounded.full,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  playTriangle: {
    width: 0,
    height: 0,
    borderTopWidth: 9,
    borderBottomWidth: 9,
    borderLeftWidth: 14,
    borderTopColor: 'transparent',
    borderBottomColor: 'transparent',
    borderLeftColor: WayfinderColors.accentPrimary,
    marginLeft: 4,
  },
  replayFooter: { padding: Spacing['4'] },
  replayTitle: { fontFamily: 'GeneralSans-Bold', fontSize: 14.5, color: WayfinderColors.inkPrimary },
  replaySubtitle: { marginTop: 2, fontFamily: 'GeneralSans-Regular', fontSize: 12, color: WayfinderColors.inkSecondary },
  statPanel: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    backgroundColor: MemoryLaneCard.background,
    borderWidth: 1,
    borderColor: MemoryLaneCard.borderColor,
    borderRadius: MemoryLaneCard.radius,
    padding: MemoryLaneCard.padding,
    shadowColor: MemoryLaneCard.shadowColor,
    shadowOffset: { width: 0, height: MemoryLaneCard.shadowOffset },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: MemoryLaneCard.shadowOffset,
  },
  statCell: { alignItems: 'center' },
  statValue: { fontFamily: 'SpaceMono-Bold', fontSize: 18, color: WayfinderColors.accentPrimary },
  statLabel: { fontFamily: 'GeneralSans-Bold', fontSize: 9, color: WayfinderColors.inkSecondary, textTransform: 'uppercase', letterSpacing: 0.5 },
  shareButton: {
    marginTop: Spacing['3'],
    backgroundColor: WayfinderColors.accentPrimary,
    borderRadius: Rounded.full,
    paddingVertical: Spacing['4'],
    alignItems: 'center',
  },
  shareButtonDisabled: { opacity: 0.6 },
  shareButtonLabel: { color: '#FFFFFF', fontFamily: 'GeneralSans-Bold', fontSize: 14 },
  shareError: { marginTop: Spacing['2'], color: WayfinderColors.accentCoral, fontFamily: 'GeneralSans-Regular', fontSize: 12.5, textAlign: 'center' },
  // Positioned off (way below) the visible screen, not display:none --
  // captureRef needs the view to actually be laid out/rendered to snapshot it.
  offscreenCapture: { position: 'absolute', top: 10000, left: 0 },
});

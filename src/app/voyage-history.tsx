import { router } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Circle, Line, Rect } from 'react-native-svg';

import { MemoryLaneAurora, PlayerColors, Rounded, Spacing, VoyageHistoryRowDotColors, WayfinderColors } from '@/constants/design-tokens';
import { voyageRepository, type EndedVoyage } from '@/repositories/voyage-repository';
import { useReduceMotion } from '@/shared/hooks/use-reduce-motion';

// A Voyage guaranteed to have actually ended -- get_voyage_history only ever
// returns status='ended' rows, and end_voyage() sets endedAt atomically with
// status, but EndedVoyage's own type still carries `endedAt: string | null`
// inherited from the base Voyage shape. Narrowed once at the fetch boundary
// (same pattern as memory-lane-composer.ts's EndedMemoryLaneVoyage) rather
// than asserting non-null deep inside HistoryRow.
type EndedHistoryVoyage = EndedVoyage & { endedAt: string };

// Diacritic-insensitive compare -- "São Paulo" should still match a
// "sao paulo" query. NFD splits accented characters into base + combining
// mark, then the combining-marks Unicode block is stripped.
// Built from explicit char codes (not a literal unicode range in source) --
// the combining diacritical marks block, U+0300-U+036F.
const COMBINING_DIACRITICS = new RegExp(`[${String.fromCharCode(0x0300)}-${String.fromCharCode(0x036f)}]`, 'g');

function normalize(s: string): string {
  return s.normalize('NFD').replace(COMBINING_DIACRITICS, '').toLowerCase();
}

// voyage-history (DESIGN.md#voyage-history-row/search-field/voyage-history-
// empty, EXPERIENCE.md IA "Home -> Past Voyages list") -- browse/search past
// Voyages by destination; tapping a row replays that Voyage's Memory Lane
// deck from the start (Story 6.3, unchanged, reused by id).
//
// No infinite scroll (EXPERIENCE.md's Interaction Primitives ban it
// everywhere) -- one-shot fetch at getVoyageHistory's own server-clamped max,
// filtered client-side by the always-visible search field.
//
// Pixel reference: mockups/key-voyage-history.html. Distance ("214 mi" in the
// mockup) is replaced with trip duration throughout -- no route/trail data
// exists to compute miles (same gap, same fix, as Story 6.3's Dev Notes).

const HISTORY_FETCH_LIMIT = 100;

// Destination-color-coded lead dot -- not a player color (DESIGN.md's own
// rule for this token), assigned deterministically per Voyage id (stable
// across renders/sessions). Uses VoyageHistoryRowDotColors, a palette kept
// genuinely distinct from every PlayerColors value (see that token's own
// comment) -- not the WayfinderColors accent set, which turned out to share
// hexes with real player marker colors.
function rowDotColorFor(voyageId: string): string {
  let hash = 0;
  for (let i = 0; i < voyageId.length; i += 1) {
    hash = (hash * 31 + voyageId.charCodeAt(i)) | 0;
  }
  return VoyageHistoryRowDotColors[Math.abs(hash) % VoyageHistoryRowDotColors.length];
}

function formatDuration(durationMs: number): string {
  const totalMinutes = Math.max(0, Math.round(durationMs / 60000));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${hours}h ${minutes}m`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

type HistoryRowProps = {
  voyage: EndedHistoryVoyage;
  index: number;
  reduceMotion: boolean;
  reduceMotionResolved: boolean;
};

function HistoryRow({ voyage, index, reduceMotion, reduceMotionResolved }: HistoryRowProps) {
  const [entrance] = useState(() => new Animated.Value(0));
  // Captured once at mount, not read live from the `index` prop inside the
  // effect below -- `index` is this row's position in the *filtered* list,
  // which shifts as search narrows the results even though the row itself
  // stays mounted (same key). If the effect depended on `index` directly, a
  // shifted position would replay this row's entrance animation on every
  // keystroke that changes its rank (code review finding, 2026-08-22).
  const stableIndexRef = useRef(index);

  useEffect(() => {
    if (!reduceMotionResolved || reduceMotion) {
      entrance.setValue(1);
      return;
    }
    entrance.setValue(0);
    // ~80ms stagger per row, per DESIGN.md's voyage-history-row.entrance.
    const animation = Animated.timing(entrance, {
      toValue: 1,
      duration: 400,
      delay: stableIndexRef.current * 80,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    });
    animation.start();
    return () => animation.stop();
  }, [entrance, reduceMotion, reduceMotionResolved]);

  const durationMs = new Date(voyage.endedAt).getTime() - new Date(voyage.createdAt).getTime();
  const duration = formatDuration(durationMs);
  const date = formatDate(voyage.endedAt);
  const label = `${voyage.destination}, ${duration}, ${date}, ${voyage.voyagerCount} ${voyage.voyagerCount === 1 ? 'voyager' : 'voyagers'}`;

  return (
    <Animated.View
      style={{
        opacity: entrance,
        transform: [{ translateY: entrance.interpolate({ inputRange: [0, 1], outputRange: [10, 0] }) }],
      }}
    >
      <Pressable
        testID={`voyage-history-row-${voyage.id}`}
        accessibilityRole="button"
        accessibilityLabel={label}
        onPress={() => router.push({ pathname: '/memory-lane/[voyageId]', params: { voyageId: voyage.id } })}
        style={styles.row}
      >
        <View testID={`voyage-history-dot-${voyage.id}`} style={[styles.rowDot, { backgroundColor: rowDotColorFor(voyage.id) }]} />
        <View style={styles.rowMain}>
          <Text style={styles.rowDest}>{voyage.destination}</Text>
          <Text style={styles.rowSub}>
            {date} · {voyage.voyagerCount} {voyage.voyagerCount === 1 ? 'voyager' : 'voyagers'}
          </Text>
        </View>
        <Text style={styles.rowStat}>{duration}</Text>
        <Text style={styles.rowChevron}>{'›'}</Text>
      </Pressable>
    </Animated.View>
  );
}

// Three player-color dots orbiting a center anchor -- the first-visit empty
// state's "your story is still ahead of you" motif, transcribed directly
// from mockups/key-voyage-history.html's own @keyframes orbit (rotate +
// translateX + counter-rotate, three different loop durations, one
// reversed). Frozen to a static frame (angle 0) under Reduce Motion.
function OrbitingDots({ reduceMotion, reduceMotionResolved }: { reduceMotion: boolean; reduceMotionResolved: boolean }) {
  // Matches mockups/key-voyage-history.html's own `translateX(76px)` --
  // dots orbit outside the nominal 120x120 wrapper box, same as the mockup
  // (neither clips its children).
  const ORBIT_RADIUS = 76;
  const [angles] = useState(() => [new Animated.Value(0), new Animated.Value(0), new Animated.Value(0)]);
  const durationsMs = [5500, 7500, 9000];
  const reversed = [false, true, false];
  // DESIGN.md's voyage-history-empty.heroMotif: "the three orbiting
  // player-color dots" -- these ARE meant to be PlayerColors (distinct from
  // the row's own lead dot, which explicitly must NOT be a player color).
  const colors = [PlayerColors.teal, PlayerColors.coral, PlayerColors.gold];

  useEffect(() => {
    if (!reduceMotionResolved || reduceMotion) {
      angles.forEach((value) => value.setValue(0));
      return;
    }
    const loops = angles.map((value, i) => {
      value.setValue(0);
      return Animated.loop(
        Animated.timing(value, { toValue: 1, duration: durationsMs[i], easing: Easing.linear, useNativeDriver: true }),
      );
    });
    loops.forEach((loop) => loop.start());
    return () => loops.forEach((loop) => loop.stop());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reduceMotion, reduceMotionResolved]);

  return (
    <View style={styles.orbitWrap} pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <View style={styles.orbitAnchor} />
      {angles.map((value, i) => {
        const turns = reversed[i] ? ['0deg', '-360deg'] : ['0deg', '360deg'];
        return (
          <Animated.View
            key={i}
            style={[
              styles.orbitDotWrap,
              {
                transform: [
                  { rotate: value.interpolate({ inputRange: [0, 1], outputRange: turns }) },
                  { translateX: ORBIT_RADIUS },
                  { rotate: value.interpolate({ inputRange: [0, 1], outputRange: reversed[i] ? ['0deg', '360deg'] : ['0deg', '-360deg'] }) },
                ],
              },
            ]}
          >
            <View style={[styles.orbitDot, { backgroundColor: colors[i] }]} />
          </Animated.View>
        );
      })}
    </View>
  );
}

function EmptyFirstVisit() {
  const { reduceMotion, resolved } = useReduceMotion();
  return (
    <View style={styles.emptyFill} testID="voyage-history-empty">
      <Svg style={StyleSheet.absoluteFill} viewBox={`0 0 ${MemoryLaneAurora.viewBoxWidth} ${MemoryLaneAurora.viewBoxHeight}`} preserveAspectRatio="xMidYMid slice" accessibilityElementsHidden importantForAccessibility="no-hide-descendants" pointerEvents="none">
        <Rect x={0} y={0} width={MemoryLaneAurora.viewBoxWidth} height={MemoryLaneAurora.viewBoxHeight} fill={MemoryLaneAurora.baseSurface} />
        {MemoryLaneAurora.blobsByCard[0].map(([cx, cy, r, color, opacity], i) => (
          <Circle key={i} cx={cx} cy={cy} r={r} fill={color} opacity={opacity} />
        ))}
      </Svg>
      <View style={styles.emptyContent}>
        <OrbitingDots reduceMotion={reduceMotion} reduceMotionResolved={resolved} />
        <Text style={styles.emptyHeadline}>{'Every road you take\nbecomes a story here.'}</Text>
        <Text style={styles.emptySub}>Your first Voylo is waiting to happen. Where to?</Text>
        <Pressable
          testID="voyage-history-empty-cta"
          accessibilityRole="button"
          accessibilityLabel="Start a Voyage"
          onPress={() => router.push('/voyage-intro')}
          style={styles.emptyCta}
        >
          <Text style={styles.emptyCtaLabel}>Start a Voyage</Text>
        </Pressable>
      </View>
    </View>
  );
}

export default function VoyageHistoryScreen() {
  const { reduceMotion, resolved: reduceMotionResolved } = useReduceMotion();
  const [voyages, setVoyages] = useState<EndedHistoryVoyage[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const load = useCallback(async () => {
    setError(null);
    const result = await voyageRepository.getVoyageHistory(undefined, undefined, HISTORY_FETCH_LIMIT);
    if (!isMountedRef.current) return;
    if (result.error) {
      setError(result.error.message);
      return;
    }
    // get_voyage_history only ever returns status='ended' rows (each with
    // endedAt set atomically by end_voyage()) -- narrowed here, once, rather
    // than asserting non-null at every read site.
    setVoyages((result.data ?? []).filter((v): v is EndedHistoryVoyage => v.endedAt != null));
  }, []);

  useEffect(() => {
    Promise.resolve().then(() => load());
  }, [load]);

  const filtered = useMemo(() => {
    if (!voyages) return [];
    const q = normalize(query.trim());
    if (!q) return voyages;
    return voyages.filter((v) => normalize(v.destination).includes(q));
  }, [voyages, query]);

  if (error) {
    return (
      <View style={styles.container}>
        <SafeAreaView style={styles.safeArea}>
          <Text testID="voyage-history-error" style={styles.loadingText}>
            {error}
          </Text>
          <Pressable testID="voyage-history-retry" accessibilityRole="button" onPress={load} style={styles.retryButton}>
            <Text style={styles.retryButtonLabel}>Try again</Text>
          </Pressable>
        </SafeAreaView>
      </View>
    );
  }

  if (voyages === null) {
    return (
      <View style={styles.container}>
        <SafeAreaView style={styles.safeArea}>
          <Text testID="voyage-history-loading" style={styles.loadingText}>
            Loading your Voylos…
          </Text>
        </SafeAreaView>
      </View>
    );
  }

  if (voyages.length === 0) {
    return (
      <View style={styles.container}>
        <SafeAreaView style={styles.safeArea}>
          <EmptyFirstVisit />
        </SafeAreaView>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.topbar}>
          <Text style={styles.topbarTitle}>Your Voylos</Text>
        </View>
        <View style={styles.searchField}>
          <Svg width={17} height={17} viewBox="0 0 24 24" fill="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
            <Circle cx={11} cy={11} r={7} stroke={WayfinderColors.inkDisabled} strokeWidth={2.2} />
            <Line x1={16.2} y1={16.2} x2={21} y2={21} stroke={WayfinderColors.inkDisabled} strokeWidth={2.2} strokeLinecap="round" />
          </Svg>
          <TextInput
            testID="voyage-history-search"
            value={query}
            onChangeText={setQuery}
            placeholder="Search by destination"
            placeholderTextColor={WayfinderColors.inkSecondary}
            style={styles.searchInput}
            accessibilityLabel="Search past Voyages by destination"
          />
        </View>
        {filtered.length === 0 ? (
          <Text testID="voyage-history-no-matches" style={styles.noMatches}>
            No matches for that destination.
          </Text>
        ) : (
          <View testID="voyage-history-list" style={styles.list}>
            {filtered.map((voyage, index) => (
              <HistoryRow key={voyage.id} voyage={voyage} index={index} reduceMotion={reduceMotion} reduceMotionResolved={reduceMotionResolved} />
            ))}
          </View>
        )}
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: WayfinderColors.surfaceSecondary },
  safeArea: { flex: 1 },
  loadingText: { flex: 1, textAlign: 'center', textAlignVertical: 'center', color: WayfinderColors.inkPrimary, fontSize: 16 },
  retryButton: { alignSelf: 'center', marginTop: Spacing['4'], paddingVertical: Spacing['3'], paddingHorizontal: Spacing['5'], borderRadius: Rounded.full, borderWidth: 2, borderColor: WayfinderColors.borderHairline },
  retryButtonLabel: { color: WayfinderColors.inkPrimary, fontFamily: 'GeneralSans-Bold', fontSize: 14 },
  topbar: { paddingHorizontal: Spacing['5'], paddingTop: Spacing['2'] },
  topbarTitle: { fontFamily: 'ClashDisplay-Semibold', fontSize: 21, color: WayfinderColors.inkPrimary },
  searchField: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing['2'],
    marginHorizontal: Spacing['5'],
    marginTop: Spacing['3'],
    marginBottom: Spacing['2'],
    backgroundColor: WayfinderColors.surfaceSecondary,
    borderWidth: 2,
    borderColor: WayfinderColors.borderHairline,
    borderRadius: Rounded.md,
    minHeight: 48,
    paddingHorizontal: Spacing['4'],
  },
  searchInput: { flex: 1, fontFamily: 'GeneralSans-Regular', fontSize: 14, color: WayfinderColors.inkPrimary },
  noMatches: {
    marginTop: Spacing['4'],
    textAlign: 'center',
    color: WayfinderColors.inkSecondary,
    fontFamily: 'GeneralSans-Regular',
    fontSize: 13,
  },
  list: { paddingHorizontal: Spacing['4'], paddingBottom: Spacing['4'], gap: Spacing['3'] },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing['3'],
    backgroundColor: WayfinderColors.surfacePrimary,
    borderWidth: 1,
    borderColor: WayfinderColors.borderHairline,
    borderRadius: Rounded.lg,
    padding: Spacing['4'],
    shadowColor: WayfinderColors.borderHairline,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 2,
  },
  rowDot: { width: 10, height: 10, borderRadius: Rounded.full },
  rowMain: { flex: 1 },
  rowDest: { fontFamily: 'GeneralSans-Bold', fontSize: 15, color: WayfinderColors.inkPrimary },
  rowSub: { marginTop: 2, fontFamily: 'GeneralSans-Regular', fontSize: 12, color: WayfinderColors.inkSecondary },
  rowStat: { fontFamily: 'SpaceMono-Bold', fontSize: 13, color: WayfinderColors.accentPrimary },
  rowChevron: { fontSize: 16, color: WayfinderColors.inkSecondary },
  emptyFill: { flex: 1 },
  emptyContent: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: Spacing['6'] },
  orbitWrap: { width: 120, height: 120, marginBottom: Spacing['5'], alignItems: 'center', justifyContent: 'center' },
  orbitAnchor: {
    position: 'absolute',
    width: 10,
    height: 10,
    borderRadius: Rounded.full,
    backgroundColor: WayfinderColors.accentPrimary,
  },
  orbitDotWrap: { position: 'absolute', alignItems: 'center', justifyContent: 'center' },
  orbitDot: {
    width: 18,
    height: 18,
    borderRadius: Rounded.full,
    borderWidth: 3,
    borderColor: '#FFFFFF',
  },
  emptyHeadline: {
    fontFamily: 'ClashDisplay-Semibold',
    fontSize: 21,
    color: WayfinderColors.inkPrimary,
    textAlign: 'center',
    lineHeight: 27,
  },
  emptySub: { marginTop: Spacing['2'], color: WayfinderColors.inkPrimary, fontFamily: 'GeneralSans-Regular', fontSize: 13, textAlign: 'center', maxWidth: 230 },
  emptyCta: {
    marginTop: Spacing['5'],
    backgroundColor: WayfinderColors.accentPrimary,
    borderRadius: Rounded.full,
    paddingVertical: Spacing['4'],
    paddingHorizontal: Spacing['6'],
  },
  emptyCtaLabel: { color: '#FFFFFF', fontFamily: 'GeneralSans-Bold', fontSize: 14.5, textAlign: 'center' },
});

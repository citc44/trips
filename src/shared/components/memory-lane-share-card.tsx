import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Rect } from 'react-native-svg';

import { MemoryLaneAurora, MemoryLaneCard, PlayerColors, Rounded, WayfinderColors } from '@/constants/design-tokens';
import type { MemoryLaneData, MemoryLaneVoyager } from '@/repositories/memory-lane-composer';

// memory-lane-share-card (DESIGN.md#memory-lane-share-card, Story 6.2/6.3) --
// the single external artifact, distinct from the personal 5-card deck. The
// only Memory Lane surface carrying a Voylo wordmark, since it's the one
// thing that leaves the app. Quote-led direction, confirmed in Story 6.2.
// Fixed pixel size (not flex-responsive) -- this is captured as a static
// image via react-native-view-shot, so it needs a stable, known render size
// (9:16, matching mockups/key-memory-lane-share-card.html's 300x533 frame
// scaled up for a reasonable share-image resolution).

const CARD_WIDTH = 360;
const CARD_HEIGHT = 640;
const AURORA_CARD_INDEX = 4; // reuses the deck's superlatives-card blob layout -- a calmer 2-blob field, closest match to the confirmed share-card mockup's own aurora.
// A big crew would overflow the fixed-width avatar row; cap what's drawn and
// summarize the rest with a "+N" chip, same convention as the overflow
// count text already shown next to the row.
const MAX_VISIBLE_AVATARS = 6;

function initial(voyager: MemoryLaneVoyager): string {
  return (voyager.displayName ?? '?').charAt(0).toUpperCase();
}

function playerColorHex(voyager: MemoryLaneVoyager, fallback: string): string {
  return voyager.playerColor ? PlayerColors[voyager.playerColor] : fallback;
}

function formatDuration(durationMs: number): string {
  const totalMinutes = Math.max(0, Math.round(durationMs / 60000));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${hours}h ${minutes}m`;
}

export function MemoryLaneShareCard({ data }: { data: MemoryLaneData }) {
  return (
    <View style={styles.card} collapsable={false}>
      <Svg
        style={StyleSheet.absoluteFill}
        viewBox={`0 0 ${MemoryLaneAurora.viewBoxWidth} ${MemoryLaneAurora.viewBoxHeight}`}
        preserveAspectRatio="xMidYMid slice"
        pointerEvents="none"
      >
        <Rect x={0} y={0} width={MemoryLaneAurora.viewBoxWidth} height={MemoryLaneAurora.viewBoxHeight} fill={MemoryLaneAurora.baseSurface} />
        {MemoryLaneAurora.blobsByCard[AURORA_CARD_INDEX].map(([cx, cy, r, color, opacity], i) => (
          <Circle key={i} cx={cx} cy={cy} r={r} fill={color} opacity={opacity} />
        ))}
      </Svg>

      <View style={styles.wordmarkRow}>
        <View style={styles.wordmarkDots}>
          <View style={[styles.wordmarkDot, { backgroundColor: PlayerColors.teal }]} />
          <View style={[styles.wordmarkDot, { backgroundColor: PlayerColors.coral }]} />
          <View style={[styles.wordmarkDot, { backgroundColor: PlayerColors.gold }]} />
        </View>
        <Text style={styles.wordmarkText}>Voylo</Text>
      </View>

      <View style={styles.heroBody}>
        <Text style={styles.quote}>{'“The map said five hours.\nThe memories took twelve.”'}</Text>
        <View style={styles.divider} />
        <Text style={styles.destination}>{data.destination}</Text>
        <View style={styles.avatarRow}>
          {data.voyagers.slice(0, MAX_VISIBLE_AVATARS).map((voyager, i) => (
            <View
              key={voyager.userId}
              style={[styles.avatar, { backgroundColor: playerColorHex(voyager, WayfinderColors.inkSecondary), marginLeft: i === 0 ? 0 : -8 }]}
            >
              <Text style={styles.avatarInitial}>{initial(voyager)}</Text>
            </View>
          ))}
          {data.voyagers.length > MAX_VISIBLE_AVATARS ? (
            <View style={[styles.avatar, styles.avatarOverflow, { marginLeft: -8 }]}>
              <Text style={styles.avatarOverflowLabel}>{`+${data.voyagers.length - MAX_VISIBLE_AVATARS}`}</Text>
            </View>
          ) : null}
          <Text style={styles.voyagerCount}>
            {data.voyagers.length} {data.voyagers.length === 1 ? 'voyager' : 'voyagers'}
          </Text>
        </View>
      </View>

      <View style={styles.statPanel}>
        <View style={styles.statCell}>
          <Text style={styles.statValue}>{formatDuration(data.durationMs)}</Text>
          <Text style={styles.statLabel}>Duration</Text>
        </View>
        <View style={styles.statCell}>
          <Text style={styles.statValue}>{data.totalSpotCount}</Text>
          <Text style={styles.statLabel}>{data.totalSpotCount === 1 ? 'Stop' : 'Stops'}</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    borderRadius: 24,
    overflow: 'hidden',
    padding: 24,
    justifyContent: 'space-between',
  },
  wordmarkRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  wordmarkDots: { flexDirection: 'row', gap: 2 },
  wordmarkDot: { width: 6, height: 6, borderRadius: Rounded.full },
  wordmarkText: { fontFamily: 'ClashDisplay-Semibold', fontSize: 15, color: WayfinderColors.inkPrimary },
  heroBody: { alignItems: 'center' },
  quote: {
    fontFamily: 'GeneralSans-Italic',
    fontSize: 19,
    color: WayfinderColors.inkPrimary,
    textAlign: 'center',
    lineHeight: 26,
  },
  divider: { width: 36, height: 1, backgroundColor: WayfinderColors.borderHairline, marginVertical: 18 },
  destination: { fontFamily: 'ClashDisplay-Semibold', fontSize: 30, color: WayfinderColors.inkPrimary, textAlign: 'center' },
  avatarRow: { flexDirection: 'row', alignItems: 'center', marginTop: 10 },
  avatar: {
    width: 30,
    height: 30,
    borderRadius: Rounded.full,
    borderWidth: 2,
    borderColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitial: { color: '#FFFFFF', fontFamily: 'GeneralSans-Bold', fontSize: 11 },
  avatarOverflow: { backgroundColor: WayfinderColors.inkSecondary },
  avatarOverflowLabel: { color: '#FFFFFF', fontFamily: 'GeneralSans-Bold', fontSize: 10 },
  voyagerCount: { marginLeft: 10, fontFamily: 'GeneralSans-Regular', fontSize: 13, color: WayfinderColors.inkSecondary },
  statPanel: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    backgroundColor: MemoryLaneCard.background,
    borderWidth: 1,
    borderColor: MemoryLaneCard.borderColor,
    borderRadius: MemoryLaneCard.radius,
    padding: 18,
    shadowColor: MemoryLaneCard.shadowColor,
    shadowOffset: { width: 0, height: MemoryLaneCard.shadowOffset },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: MemoryLaneCard.shadowOffset,
  },
  statCell: { alignItems: 'center' },
  statValue: { fontFamily: 'SpaceMono-Bold', fontSize: 20, color: WayfinderColors.accentPrimary },
  statLabel: { fontFamily: 'GeneralSans-Bold', fontSize: 9, color: WayfinderColors.inkSecondary, textTransform: 'uppercase', letterSpacing: 0.5 },
});

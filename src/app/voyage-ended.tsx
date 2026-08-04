import { router, useLocalSearchParams } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Spacing, Typography, WayfinderCard, WayfinderColors } from '@/constants/design-tokens';
import { IgnitionButton } from '@/shared/components/ignition-button';

// Calm terminal summary (EXPERIENCE.md: "Voyage ended. 5h 30m · 3 Voyagers ·
// Lake Tahoe." -- not a "wow" screen; deliberately no displayHero typography,
// no gradient/glow treatment. Superseded by Memory Lane in v1.1.
//
// Registered unconditionally in _layout.tsx (not gated on hasActiveVoyage) --
// all summary data arrives via route params from active-voyage.tsx, not read
// from useActiveVoyage()'s context, so this screen never depends on
// activeVoyage still being populated (it won't be, by the time this renders).
// Reachable in principle without params (registered unconditionally, not
// gated) -- defensive against malformed/missing values rather than rendering
// a literal "NaN" (code review finding).
function formatDuration(createdAt: string, endedAt: string): string | null {
  const ms = new Date(endedAt).getTime() - new Date(createdAt).getTime();
  if (!Number.isFinite(ms)) return null;
  const totalMinutes = Math.max(0, Math.round(ms / 60000));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${hours}h ${minutes}m`;
}

export default function VoyageEndedScreen() {
  const { destination, createdAt, endedAt, voyagerCount } = useLocalSearchParams<{
    destination: string;
    createdAt: string;
    endedAt: string;
    voyagerCount: string;
  }>();

  const duration = createdAt && endedAt ? formatDuration(createdAt, endedAt) : null;
  const parsedCount = Number(voyagerCount);
  const count = Number.isFinite(parsedCount) ? parsedCount : null;
  const hasStats = duration !== null || count !== null;

  return (
    <View style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.content}>
          {/* Literal mockup color -- a pale-green one-off used only for this
              badge, not worth promoting to WayfinderColors for a single call
              site. */}
          <View style={styles.iconBadge}>
            <Text style={styles.iconBadgeGlyph}>🏁</Text>
          </View>
          {/* "Voyage ended." is protected copy (EXPERIENCE.md) -- kept
              verbatim even though key-voyage-ended.html's own placeholder
              text reads "Voyage complete" (Story 4.4 Scope decision). */}
          <Text style={styles.title}>Voyage ended.</Text>

          {/* Code review finding: gate the whole card on having something to
              show it -- this screen is registered unconditionally and is
              reachable in principle with no params at all, and an empty
              bordered/shadowed card is a more visible-looking defect than
              rendering nothing. */}
          {destination || hasStats ? (
            <View style={styles.card}>
              {destination ? (
                <>
                  <Text style={styles.cardDestLabel}>Destination</Text>
                  <Text style={styles.cardDestName}>{destination}</Text>
                </>
              ) : null}
              {hasStats ? (
                <View style={styles.statRow}>
                  {duration !== null ? (
                    <View style={styles.statChip}>
                      <Text style={styles.statLabel}>Duration</Text>
                      <Text testID="voyage-ended-duration-value" style={styles.statValue}>
                        {duration}
                      </Text>
                    </View>
                  ) : null}
                  {count !== null ? (
                    <View style={styles.statChip}>
                      <Text style={styles.statLabel}>{count === 1 ? 'Voyager' : 'Voyagers'}</Text>
                      <Text testID="voyage-ended-voyager-count-value" style={styles.statValue}>
                        {count}
                      </Text>
                    </View>
                  ) : null}
                </View>
              ) : null}
            </View>
          ) : null}

          <IgnitionButton
            testID="back-to-home-button"
            label="Back to Home"
            disabled={false}
            onPress={() => router.push('/')}
            variant="secondary"
          />
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: WayfinderColors.surfaceSecondary,
  },
  safeArea: {
    flex: 1,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: Spacing['4'],
    paddingHorizontal: Spacing.heroGap,
  },
  iconBadge: {
    width: 64,
    height: 64,
    borderRadius: 20,
    backgroundColor: '#DCEBD3',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconBadgeGlyph: {
    fontSize: 28,
  },
  title: {
    color: WayfinderColors.inkPrimary,
    // 700 (Bold), not Typography.display's own 600 (Semibold).
    fontFamily: 'ClashDisplay-Bold',
    fontSize: 22,
    fontWeight: '700',
  },
  card: {
    width: '100%',
    backgroundColor: WayfinderCard.background,
    borderWidth: 1,
    borderColor: WayfinderCard.borderColor,
    borderRadius: WayfinderCard.radius,
    padding: Spacing['5'],
    shadowColor: WayfinderCard.shadowColor,
    shadowOffset: { width: 0, height: WayfinderCard.shadowOffset },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: WayfinderCard.shadowOffset,
  },
  cardDestLabel: {
    color: WayfinderColors.inkSecondary,
    // 700 (Bold), not Typography.label's own 600 (Semibold).
    fontFamily: 'GeneralSans-Bold',
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: Spacing['1'],
  },
  cardDestName: {
    color: WayfinderColors.inkPrimary,
    // 700 (Bold), not Typography.display's own 600 (Semibold).
    fontFamily: 'ClashDisplay-Bold',
    fontSize: 20,
    fontWeight: '700',
    marginBottom: Spacing['5'],
  },
  statRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: WayfinderColors.surfaceSecondary,
    paddingTop: Spacing['4'],
  },
  statChip: {
    gap: Spacing['1'],
  },
  statLabel: {
    color: WayfinderColors.inkSecondary,
    // 700 (Bold), not Typography.label's own 600 (Semibold).
    fontFamily: 'GeneralSans-Bold',
    fontSize: 10.5,
    fontWeight: '700',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  // Literal mockup value, not the shared 32px Typography.statNumeral scale
  // step -- this screen's stat values measure smaller (22px), same
  // "own literal value" convention Task 1's typography note already
  // established.
  statValue: {
    color: WayfinderColors.inkPrimary,
    fontFamily: Typography.statNumeral.fontFamily,
    fontSize: 22,
    fontWeight: '700',
  },
});

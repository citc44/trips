import { Link, router } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Spacing, Typography, WayfinderColors } from '@/constants/design-tokens';
import { IgnitionButton } from '@/shared/components/ignition-button';

export default function HomeScreen() {
  return (
    <View style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.topRow}>
          <Text style={styles.wordmark}>Voylo</Text>
          <Link testID="settings-link" href="/settings">
            <Text style={styles.settingsLabel}>Settings</Text>
          </Link>
        </View>
        {/* Upper third stays empty -- "a garage before the ignition, not a
            dashboard of options" (DESIGN.md) -- the CTA lives in the lower
            two-thirds via the 1:2 flex split below. */}
        <View style={styles.upperSpacer} />
        <View style={styles.ctaZone}>
          <IgnitionButton
            testID="start-voyage-button"
            label="Start a Voyage"
            disabled={false}
            onPress={() => router.push('/voyage-intro')}
          />
          {/* key-home.html's own literal caption below its single visible
              button -- decorative-only addition, no flow/copy change (Story
              4.4 Scope decision's "cheap, unambiguous mockup completions"). */}
          <Text style={styles.ctaCaption}>Gather your crew and hit the road.</Text>
          {/* key-home.html shows only the one primary button -- this stays
              understated (Story 4.4's own Scope decision keeps it, since
              AC #2 protects existing behavior the mockup just doesn't
              depict), so "text" reads more consistent with the mockup's
              minimal footprint than the new bordered "secondary" pill. */}
          <IgnitionButton
            testID="join-voyage-button"
            label="Join a Voyage"
            disabled={false}
            onPress={() => router.push('/join')}
            variant="text"
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
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.gutter,
    paddingTop: Spacing['2'],
  },
  wordmark: {
    color: WayfinderColors.inkPrimary,
    // 700 (Bold), not Typography.display's own 600 (Semibold).
    fontFamily: 'ClashDisplay-Bold',
    fontSize: 19,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  upperSpacer: {
    flex: 1,
  },
  ctaZone: {
    flex: 2,
    justifyContent: 'center',
    alignItems: 'center',
    gap: Spacing['3'],
    paddingHorizontal: Spacing.heroGap,
    paddingBottom: Spacing.heroGap,
  },
  ctaCaption: {
    color: WayfinderColors.inkDisabled,
    fontFamily: Typography.body.fontFamily,
    fontSize: 13.5,
    textAlign: 'center',
  },
  settingsLabel: {
    color: WayfinderColors.inkSecondary,
    fontFamily: Typography.body.fontFamily,
    fontSize: 14,
  },
});

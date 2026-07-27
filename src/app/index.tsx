import { Link, router } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Colors, Spacing, Typography } from '@/constants/design-tokens';
import { IgnitionButton } from '@/shared/components/ignition-button';

export default function HomeScreen() {
  return (
    <View style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.topRow}>
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
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.surfaceMidnight,
  },
  safeArea: {
    flex: 1,
  },
  topRow: {
    alignItems: 'flex-end',
    paddingHorizontal: Spacing.gutter,
    paddingTop: Spacing['2'],
  },
  upperSpacer: {
    flex: 1,
  },
  ctaZone: {
    flex: 2,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: Spacing.heroGap,
    paddingBottom: Spacing.heroGap,
  },
  settingsLabel: {
    color: Colors.inkSecondary,
    fontFamily: Typography.body.fontFamily,
    fontSize: 14,
  },
});

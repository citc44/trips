import { router } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Colors, Spacing, Typography } from '@/constants/design-tokens';
import { IgnitionButton } from '@/shared/components/ignition-button';

export default function VoyageIntroScreen() {
  return (
    <View style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <View>
          <Text style={styles.headline}>Every journey tells a story.</Text>
          <Text style={styles.subhead}>
            Voylo rides along live and turns the trip into a memory reel — inside jokes, wrong turns, and all — ready the moment you
            arrive.
          </Text>
        </View>
        <IgnitionButton
          testID="choose-destination-button"
          label="Choose Your Destination"
          disabled={false}
          onPress={() => router.push('/destination-picker')}
        />
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
    justifyContent: 'center',
    alignItems: 'flex-start',
    gap: Spacing.heroGap,
    paddingHorizontal: Spacing.gutter,
  },
  headline: {
    color: Colors.inkPrimary,
    fontFamily: Typography.displayHero.fontFamily,
    fontSize: Typography.displayHero.fontSize,
    fontWeight: Typography.displayHero.fontWeight,
    lineHeight: Typography.displayHero.lineHeight,
    letterSpacing: Typography.displayHero.letterSpacing,
  },
  subhead: {
    marginTop: Spacing['4'],
    color: Colors.inkSecondary,
    fontFamily: Typography.body.fontFamily,
    fontSize: Typography.body.fontSize,
    lineHeight: Typography.body.lineHeight,
    maxWidth: 300,
  },
});

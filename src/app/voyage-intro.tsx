import { router } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Spacing, Typography, WayfinderColors } from '@/constants/design-tokens';
import { IgnitionButton } from '@/shared/components/ignition-button';
import { RoadMotif } from '@/shared/components/road-motif';

export default function VoyageIntroScreen() {
  return (
    <View style={styles.container}>
      <RoadMotif rotateDeg={9} style={styles.roadMotif} />
      <View style={styles.destDot} pointerEvents="none" />
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.content}>
          <Text style={styles.headline}>Every journey tells a story.</Text>
          <Text style={styles.subhead}>
            Voylo rides along live and turns the trip into a memory reel — inside jokes, wrong turns, and all — ready the moment you
            arrive.
          </Text>
          <IgnitionButton
            testID="choose-destination-button"
            label="Choose Your Destination"
            disabled={false}
            onPress={() => router.push('/destination-picker')}
            variant="inverse"
          />
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: WayfinderColors.accentPrimary,
    overflow: 'hidden',
  },
  roadMotif: {
    top: -40,
    right: 40,
  },
  destDot: {
    position: 'absolute',
    top: 96,
    right: 56,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: WayfinderColors.accentAmber,
  },
  safeArea: {
    flex: 1,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: Spacing['5'],
    paddingHorizontal: Spacing.heroGap,
  },
  headline: {
    color: '#FFFFFF',
    // 700 (Bold), not Typography.displayHero's own 600 (Semibold).
    fontFamily: 'ClashDisplay-Bold',
    fontSize: 40,
    fontWeight: '700',
    lineHeight: 46,
    textAlign: 'center',
  },
  subhead: {
    color: '#D6E6FF',
    fontFamily: Typography.body.fontFamily,
    fontSize: 16,
    lineHeight: 25.6,
    maxWidth: 300,
    textAlign: 'center',
  },
});

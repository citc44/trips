import { router, useLocalSearchParams } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Colors, Spacing, Typography } from '@/constants/design-tokens';
import { IgnitionButton } from '@/shared/components/ignition-button';
import { screenStyles } from '@/shared/styles/screen';

// Calm terminal summary (EXPERIENCE.md: "Voyage ended. 5h 30m · 3 Voyagers ·
// Lake Tahoe." -- not a "wow" screen; deliberately no displayHero typography,
// no gradient/glow treatment. Superseded by Memory Lane in v1.1.
//
// Registered unconditionally in _layout.tsx (not gated on hasActiveVoyage) --
// all summary data arrives via route params from active-voyage.tsx, not read
// from useActiveVoyage()'s context, so this screen never depends on
// activeVoyage still being populated (it won't be, by the time this renders).
function formatDuration(createdAt: string, endedAt: string): string {
  const ms = new Date(endedAt).getTime() - new Date(createdAt).getTime();
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
  const count = Number(voyagerCount ?? 0);

  return (
    <View style={screenStyles.container}>
      <SafeAreaView style={screenStyles.safeArea}>
        <Text style={screenStyles.headline}>Voyage ended.</Text>
        <Text style={styles.summary}>
          {[duration, `${count} ${count === 1 ? 'Voyager' : 'Voyagers'}`, destination].filter(Boolean).join(' · ')}
        </Text>
        <IgnitionButton testID="back-to-home-button" label="Back to Home" disabled={false} onPress={() => router.push('/')} variant="secondary" />
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  summary: {
    color: Colors.inkSecondary,
    fontFamily: Typography.body.fontFamily,
    fontSize: Typography.body.fontSize,
    lineHeight: Typography.body.lineHeight,
    textAlign: 'center',
    marginTop: Spacing['2'],
  },
});

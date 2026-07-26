import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Colors, Typography } from '@/constants/design-tokens';
import { IgnitionButton } from '@/shared/components/ignition-button';
import { useProfile } from '@/shared/hooks/use-profile';
import { screenStyles } from '@/shared/styles/screen';

const GENERIC_ERROR = 'Something went wrong. Please try again.';

export default function TrustMomentScreen() {
  const { markTrustMomentSeen } = useProfile();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleGotIt() {
    setIsSubmitting(true);
    setError(null);

    try {
      const { error: markError } = await markTrustMomentSeen();
      if (markError) {
        setIsSubmitting(false);
        setError(markError.message);
        return;
      }
      // On success, _layout.tsx's guard reacts to the updated profile state
      // and routes to Home on its own -- no manual navigation here.
    } catch {
      setIsSubmitting(false);
      setError(GENERIC_ERROR);
    }
  }

  return (
    <View style={screenStyles.container}>
      <SafeAreaView style={screenStyles.safeArea}>
        <Text style={styles.headline}>Your location stays in this Voyage.</Text>
        <Text style={styles.supporting}>
          We never sell your location data. It&apos;s visible only to people in your Voyage, and only while it&apos;s active.
        </Text>
        <IgnitionButton testID="got-it-button" label="Got it" disabled={isSubmitting} onPress={handleGotIt} variant="secondary" />
        {error ? (
          <Text testID="error-message" style={screenStyles.error}>
            {error}
          </Text>
        ) : null}
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  headline: {
    color: Colors.inkPrimary,
    fontSize: Typography.display.fontSize,
    fontWeight: Typography.display.fontWeight,
    lineHeight: Typography.display.lineHeight,
    textAlign: 'center',
  },
  supporting: {
    color: Colors.inkSecondary,
    fontSize: Typography.body.fontSize,
    lineHeight: Typography.body.lineHeight,
    textAlign: 'center',
  },
});

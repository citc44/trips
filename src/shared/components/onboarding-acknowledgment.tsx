import { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Colors, Typography } from '@/constants/design-tokens';
import type { RepositoryError } from '@/repositories/profile-repository';
import { IgnitionButton } from '@/shared/components/ignition-button';
import { screenStyles } from '@/shared/styles/screen';

const GENERIC_ERROR = 'Something went wrong. Please try again.';

/**
 * Shared shell for Voylo's once-ever onboarding acknowledgment screens (Trust
 * Moment, Driver Attention Consent): full-bleed headline + supporting copy + one
 * secondary "Got it" button, same low-drama pattern per EXPERIENCE.md. Both screens
 * use the same fixed testIDs ("got-it-button"/"error-message") -- safe since a
 * screen is never mounted alongside another one in a render tree, and this keeps
 * the prop surface to exactly what varies between the two: copy and the action.
 */
export function OnboardingAcknowledgment({
  headline,
  supportingCopy,
  onAcknowledge,
}: {
  headline: string;
  supportingCopy: string;
  onAcknowledge: () => Promise<{ error: RepositoryError | null }>;
}) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isMounted = useRef(true);

  useEffect(() => {
    return () => {
      isMounted.current = false;
    };
  }, []);

  async function handleGotIt() {
    setIsSubmitting(true);
    setError(null);

    try {
      const { error: acknowledgeError } = await onAcknowledge();
      if (!isMounted.current) return;
      if (acknowledgeError) {
        setError(acknowledgeError.message);
      }
      // On success, _layout.tsx's guard reacts to the updated profile state
      // and routes onward on its own -- no manual navigation here.
    } catch {
      if (!isMounted.current) return;
      setError(GENERIC_ERROR);
    } finally {
      if (isMounted.current) setIsSubmitting(false);
    }
  }

  return (
    <View style={screenStyles.container}>
      <SafeAreaView style={screenStyles.safeArea}>
        <Text style={styles.headline}>{headline}</Text>
        <Text style={styles.supporting}>{supportingCopy}</Text>
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
    fontFamily: Typography.display.fontFamily,
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

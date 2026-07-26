import { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Colors, Typography } from '@/constants/design-tokens';
import { IgnitionButton } from '@/shared/components/ignition-button';
import { screenStyles } from '@/shared/styles/screen';

const GENERIC_ERROR = 'Something went wrong. Please try again.';

/**
 * Shared shell for Voylo's once-ever onboarding acknowledgment screens (Trust
 * Moment, Driver Attention Consent): full-bleed headline + supporting copy + one
 * secondary "Got it" button, same low-drama pattern per EXPERIENCE.md.
 * `testIdPrefix` keeps each screen's rendered testIDs distinct (e.g.
 * "trust-moment-got-it-button" vs "driver-consent-got-it-button") rather than
 * assuming the two screens are never simultaneously present in a live navigation
 * transition -- that assumption was never actually verified against React
 * Navigation's stack-transition mounting behavior (code review finding).
 */
export function OnboardingAcknowledgment({
  testIdPrefix,
  headline,
  supportingCopy,
  onAcknowledge,
}: {
  testIdPrefix: string;
  headline: string;
  supportingCopy: string;
  // Structural, not imported from the repository layer -- this shared UI shell
  // only ever reads `.message` and has no business knowing repositories exist.
  // `RepositoryError` (and anything else shaped like this) is still assignable.
  onAcknowledge: () => Promise<{ error: { message: string } | null }>;
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
        <IgnitionButton
          testID={`${testIdPrefix}-got-it-button`}
          label="Got it"
          disabled={isSubmitting}
          onPress={handleGotIt}
          variant="secondary"
        />
        {error ? (
          <Text testID={`${testIdPrefix}-error-message`} style={screenStyles.error}>
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

import { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Colors, Spacing, Typography } from '@/constants/design-tokens';
import { IgnitionButton } from '@/shared/components/ignition-button';
import { useProfile } from '@/shared/hooks/use-profile';
import { screenStyles } from '@/shared/styles/screen';

const GENERIC_ERROR = 'Something went wrong. Please try again.';

// Third one-time onboarding step (Story 2.5), after Trust Moment and Driver
// Attention Consent -- confirmed with the user directly as the prerequisite
// fix for "no display-name field exists anywhere" (first surfaced in Story
// 2.3, now a real blocker for Grant Organizer Status needing to distinguish
// individual Voyagers). Not built from OnboardingAcknowledgment: that shared
// shell is a pure acknowledgment (headline + "Got it"), no data input --
// this screen needs a text field, so it's standalone rather than adding
// conditional complexity to a component two other screens already depend on.
export default function DisplayNameScreen() {
  const { setDisplayName } = useProfile();
  const [name, setName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isMounted = useRef(true);

  useEffect(() => {
    return () => {
      isMounted.current = false;
    };
  }, []);

  const trimmedName = name.trim();
  const canSubmit = trimmedName.length > 0 && !isSubmitting;

  async function handleSubmit() {
    setIsSubmitting(true);
    setError(null);

    try {
      const { error: submitError } = await setDisplayName(trimmedName);
      if (!isMounted.current) return;
      if (submitError) {
        setError(submitError.message);
        return;
      }
      // On success, _layout.tsx's guard reacts to the updated profile state
      // and routes onward on its own -- no manual navigation here, same
      // established pattern as Trust Moment/Driver Attention Consent.
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
        <Text style={screenStyles.headline}>What should we call you?</Text>
        <TextInput
          testID="display-name-input"
          style={styles.input}
          placeholder="Your name"
          placeholderTextColor={Colors.inkSecondary}
          maxLength={60}
          value={name}
          onChangeText={setName}
          editable={!isSubmitting}
          autoFocus
        />
        <IgnitionButton testID="display-name-submit-button" label="Continue" disabled={!canSubmit} onPress={handleSubmit} />
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
  input: {
    width: '100%',
    minHeight: 56,
    color: Colors.inkPrimary,
    fontSize: Typography.body.fontSize,
    borderWidth: 1,
    borderColor: Colors.borderHairline,
    borderRadius: Spacing['2'],
    paddingHorizontal: Spacing['4'],
  },
});

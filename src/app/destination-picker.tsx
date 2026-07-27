import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Colors, Rounded, Spacing, Typography } from '@/constants/design-tokens';
import { voyageRepository } from '@/repositories/voyage-repository';
import { IgnitionButton } from '@/shared/components/ignition-button';
import { screenStyles } from '@/shared/styles/screen';

const GENERIC_ERROR = 'Something went wrong. Please try again.';

export default function DestinationPickerScreen() {
  const [destination, setDestination] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isMounted = useRef(true);

  useEffect(() => {
    return () => {
      isMounted.current = false;
    };
  }, []);

  const trimmedDestination = destination.trim();
  const canSubmit = trimmedDestination.length > 0 && !isSubmitting;

  async function handleStartVoyage() {
    setIsSubmitting(true);
    setError(null);

    try {
      const { data, error: startError } = await voyageRepository.startVoyage(trimmedDestination);
      if (!isMounted.current) return;
      if (startError || !data) {
        setError(startError?.message ?? GENERIC_ERROR);
        return;
      }
      router.push('/');
    } catch {
      if (!isMounted.current) return;
      setError(GENERIC_ERROR);
    } finally {
      if (isMounted.current) setIsSubmitting(false);
    }
  }

  return (
    <View style={screenStyles.container}>
      <SafeAreaView style={styles.safeArea}>
        <View>
          <Text style={styles.eyebrow}>Destination</Text>
          <Text style={styles.prompt}>Where are you headed?</Text>
        </View>

        <View style={styles.fieldWrap}>
          <Text style={styles.fieldLabel}>DESTINATION</Text>
          <TextInput
            testID="destination-input"
            style={styles.input}
            placeholder="Enter a destination"
            placeholderTextColor={Colors.inkSecondary}
            value={destination}
            onChangeText={setDestination}
            editable={!isSubmitting}
          />
        </View>

        <View style={styles.ctaWrap}>
          <IgnitionButton
            testID="start-the-voyage-button"
            label="Start the Voyage"
            disabled={!canSubmit}
            onPress={handleStartVoyage}
          />
          <Text style={styles.hint}>
            {trimmedDestination.length > 0 ? 'This creates the Voyage and starts live tracking.' : 'Type a destination to begin.'}
          </Text>
        </View>

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
  safeArea: {
    flex: 1,
    justifyContent: 'center',
    gap: Spacing['6'],
    paddingHorizontal: Spacing.gutter,
  },
  eyebrow: {
    color: Colors.accentViolet,
    fontFamily: Typography.body.fontFamily,
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 1.8,
    textTransform: 'uppercase',
  },
  prompt: {
    marginTop: Spacing['3'],
    color: Colors.inkPrimary,
    fontFamily: Typography.headline.fontFamily,
    fontSize: Typography.headline.fontSize,
    fontWeight: Typography.headline.fontWeight,
    lineHeight: Typography.headline.lineHeight,
  },
  fieldWrap: {
    gap: Spacing['2'],
  },
  fieldLabel: {
    color: Colors.inkSecondary,
    fontFamily: Typography.body.fontFamily,
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  input: {
    minHeight: 56,
    color: Colors.inkPrimary,
    fontSize: Typography.body.fontSize,
    borderWidth: 1,
    borderColor: Colors.borderHairline,
    borderRadius: Rounded.sm,
    backgroundColor: Colors.surfaceDuskHigh,
    paddingHorizontal: Spacing['4'],
  },
  ctaWrap: {
    gap: Spacing['3'],
    alignItems: 'flex-start',
  },
  hint: {
    color: Colors.inkSecondary,
    fontFamily: Typography.body.fontFamily,
    fontSize: 13,
  },
});

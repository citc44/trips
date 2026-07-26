import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ButtonIgnition, Colors, Spacing, Typography } from '@/constants/design-tokens';
import { useAuth } from '@/shared/hooks/use-auth';

const RESEND_COOLDOWN_SECONDS = 30;

function isPlausibleEmail(value: string) {
  return /\S+@\S+\.\S+/.test(value);
}

export default function SignInScreen() {
  const { signInWithEmail, verifyCode } = useAuth();

  const [step, setStep] = useState<'entry' | 'verify'>('entry');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  const shakeX = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (cooldown === 0) return;
    const interval = setInterval(() => {
      setCooldown((seconds) => Math.max(0, seconds - 1));
    }, 1000);
    return () => clearInterval(interval);
  }, [cooldown]);

  function triggerShake() {
    shakeX.setValue(0);
    Animated.sequence([
      Animated.timing(shakeX, { toValue: 8, duration: 40, useNativeDriver: true }),
      Animated.timing(shakeX, { toValue: -8, duration: 40, useNativeDriver: true }),
      Animated.timing(shakeX, { toValue: 8, duration: 40, useNativeDriver: true }),
      Animated.timing(shakeX, { toValue: 0, duration: 40, useNativeDriver: true }),
    ]).start();
  }

  async function sendCode() {
    setIsSubmitting(true);
    setError(null);
    const { error: sendError } = await signInWithEmail(email);
    setIsSubmitting(false);

    if (sendError) {
      setError(sendError.message);
      return;
    }

    setStep('verify');
    setCooldown(RESEND_COOLDOWN_SECONDS);
  }

  async function handleCodeChange(text: string) {
    const digitsOnly = text.replace(/[^0-9]/g, '').slice(0, 6);
    setCode(digitsOnly);
    setError(null);

    if (digitsOnly.length !== 6) return;

    setIsSubmitting(true);
    const { error: verifyError } = await verifyCode(email, digitsOnly);
    setIsSubmitting(false);

    if (verifyError) {
      setError('Incorrect code. Try again.');
      setCode('');
      triggerShake();
    }
    // On success, the shared auth hook picks up the new session via
    // onAuthStateChange and the root layout's guard routes away from here.
  }

  function handleResend() {
    if (cooldown > 0 || isSubmitting) return;
    sendCode();
  }

  const emailIsValid = isPlausibleEmail(email);

  return (
    <View style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        {step === 'entry' ? (
          <>
            <Text style={styles.headline}>Enter your email</Text>
            <TextInput
              testID="email-input"
              style={styles.input}
              placeholder="you@example.com"
              placeholderTextColor={Colors.inkSecondary}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              value={email}
              onChangeText={setEmail}
              editable={!isSubmitting}
            />
            <IgnitionButton testID="send-code-button" label="Send code" disabled={!emailIsValid || isSubmitting} onPress={sendCode} />
          </>
        ) : (
          <>
            <Text style={styles.headline}>Enter the code</Text>
            <Animated.View style={{ transform: [{ translateX: shakeX }] }}>
              <TextInput
                testID="code-input"
                style={styles.input}
                keyboardType="number-pad"
                maxLength={6}
                value={code}
                onChangeText={handleCodeChange}
                editable={!isSubmitting}
                autoFocus
              />
            </Animated.View>
            <IgnitionButton
              testID="resend-button"
              label={cooldown > 0 ? `Resend in ${cooldown}s` : 'Resend code'}
              disabled={cooldown > 0 || isSubmitting}
              onPress={handleResend}
              variant="secondary"
            />
          </>
        )}
        {error ? (
          <Text testID="error-message" style={styles.error}>
            {error}
          </Text>
        ) : null}
      </SafeAreaView>
    </View>
  );
}

function IgnitionButton({
  testID,
  label,
  disabled,
  onPress,
  variant = 'primary',
}: {
  testID: string;
  label: string;
  disabled: boolean;
  onPress: () => void;
  variant?: 'primary' | 'secondary';
}) {
  if (variant === 'secondary') {
    return (
      <Text
        testID={testID}
        accessibilityRole="button"
        accessibilityState={{ disabled }}
        onPress={disabled ? undefined : onPress}
        style={[styles.secondaryButtonLabel, disabled && styles.disabledLabel]}
      >
        {label}
      </Text>
    );
  }

  return (
    <LinearGradient
      testID={testID}
      colors={disabled ? [Colors.inkSecondary, Colors.inkSecondary] : [...ButtonIgnition.gradient]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.button}
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      onTouchEnd={disabled ? undefined : onPress}
    >
      <Text style={styles.buttonLabel}>{label}</Text>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.surfaceMidnight,
  },
  safeArea: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing['4'],
    paddingHorizontal: Spacing.gutter,
  },
  headline: {
    color: Colors.inkPrimary,
    fontSize: Typography.headline.fontSize,
    fontWeight: Typography.headline.fontWeight,
    lineHeight: Typography.headline.lineHeight,
  },
  input: {
    width: '100%',
    color: Colors.inkPrimary,
    fontSize: Typography.body.fontSize,
    lineHeight: Typography.body.lineHeight,
    borderWidth: 1,
    borderColor: Colors.borderHairline,
    borderRadius: Spacing['2'],
    paddingVertical: Spacing['3'],
    paddingHorizontal: Spacing['4'],
  },
  button: {
    width: '100%',
    minHeight: ButtonIgnition.minHeight,
    borderRadius: ButtonIgnition.radius,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonLabel: {
    color: ButtonIgnition.foreground,
    fontSize: Typography.body.fontSize,
    fontWeight: '600',
  },
  secondaryButtonLabel: {
    color: Colors.inkPrimary,
    fontSize: Typography.body.fontSize,
    padding: Spacing['3'],
  },
  disabledLabel: {
    color: Colors.inkSecondary,
  },
  error: {
    color: Colors.error,
    fontSize: Typography.body.fontSize,
  },
});

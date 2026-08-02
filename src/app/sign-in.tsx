import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Colors, Spacing, Typography } from '@/constants/design-tokens';
import { IgnitionButton } from '@/shared/components/ignition-button';
import { useAuth } from '@/shared/hooks/use-auth';
import { screenStyles } from '@/shared/styles/screen';

const RESEND_COOLDOWN_SECONDS = 30;
const GENERIC_ERROR = 'Something went wrong. Please try again.';
// Must match supabase/config.toml's auth.email.otp_length (also set on the
// hosted project's Auth settings, which config.toml does not push).
const CODE_LENGTH = 8;

function isPlausibleEmail(value: string) {
  return /^\S+@\S+\.\S+$/.test(value.trim());
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

    try {
      const { error: sendError } = await signInWithEmail(email.trim());
      setIsSubmitting(false);

      if (sendError) {
        setError(sendError.message);
        // Still cooldown on failure (e.g. hitting Supabase's own rate limit) so
        // the resend button doesn't let the user immediately retry into it.
        setCooldown(RESEND_COOLDOWN_SECONDS);
        return;
      }

      setStep('verify');
      setCooldown(RESEND_COOLDOWN_SECONDS);
    } catch {
      setIsSubmitting(false);
      setError(GENERIC_ERROR);
      setCooldown(RESEND_COOLDOWN_SECONDS);
    }
  }

  async function handleCodeChange(text: string) {
    const digitsOnly = text.replace(/[^0-9]/g, '').slice(0, CODE_LENGTH);
    setCode(digitsOnly);
    setError(null);

    if (digitsOnly.length !== CODE_LENGTH) return;

    setIsSubmitting(true);
    try {
      const { error: verifyError } = await verifyCode(email.trim(), digitsOnly);
      setIsSubmitting(false);

      if (verifyError) {
        setError('Incorrect code. Try again.');
        setCode('');
        triggerShake();
      }
      // On success, the shared auth hook picks up the new session via
      // onAuthStateChange and the root layout's guard routes away from here.
    } catch {
      setIsSubmitting(false);
      setError(GENERIC_ERROR);
      setCode('');
      triggerShake();
    }
  }

  function handleResend() {
    if (cooldown > 0 || isSubmitting) return;
    sendCode();
  }

  function backToEntry() {
    setStep('entry');
    setCode('');
    setError(null);
  }

  const emailIsValid = isPlausibleEmail(email);

  return (
    <View style={screenStyles.container}>
      <SafeAreaView style={screenStyles.safeArea}>
        {step === 'entry' ? (
          <>
            <Text style={screenStyles.headline}>Enter your email</Text>
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
            <Text
              testID="have-a-join-code-link"
              accessibilityRole="button"
              onPress={() => router.push('/join')}
              style={styles.joinCodeLink}
            >
              Have a join code?
            </Text>
          </>
        ) : (
          <>
            <Text style={screenStyles.headline}>Enter the code</Text>
            <Animated.View style={[styles.codeBoxRow, { transform: [{ translateX: shakeX }] }]}>
              {Array.from({ length: CODE_LENGTH }, (_, index) => (
                <View key={index} style={[styles.codeBox, index === code.length && styles.codeBoxActive]}>
                  <Text style={styles.codeBoxText}>{code[index] ?? ''}</Text>
                </View>
              ))}
              <TextInput
                testID="code-input"
                style={styles.codeHiddenInput}
                keyboardType="number-pad"
                maxLength={CODE_LENGTH}
                value={code}
                onChangeText={handleCodeChange}
                editable={!isSubmitting}
                autoFocus
                caretHidden
              />
            </Animated.View>
            <IgnitionButton
              testID="resend-button"
              label={cooldown > 0 ? `Resend in ${cooldown}s` : 'Resend code'}
              disabled={cooldown > 0 || isSubmitting}
              onPress={handleResend}
              variant="secondary"
            />
            <IgnitionButton testID="back-to-entry" label="Wrong email? Go back" disabled={false} onPress={backToEntry} variant="secondary" />
          </>
        )}
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
  joinCodeLink: {
    color: Colors.inkSecondary,
    fontFamily: Typography.body.fontFamily,
    fontSize: 13,
    textAlign: 'center',
    padding: Spacing['3'],
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
  codeBoxRow: {
    position: 'relative',
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  codeBox: {
    width: 32,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.borderHairline,
    borderRadius: Spacing['2'],
  },
  codeBoxActive: {
    borderColor: Colors.accentViolet,
  },
  codeBoxText: {
    color: Colors.inkPrimary,
    fontFamily: Typography.statNumeral.fontFamily,
    fontSize: Typography.headline.fontSize,
    fontWeight: Typography.headline.fontWeight,
  },
  codeHiddenInput: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    opacity: 0,
  },
});

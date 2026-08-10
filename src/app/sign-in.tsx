import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Animated, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Spacing, Typography, WayfinderColors } from '@/constants/design-tokens';
import { HorizonStrip } from '@/shared/components/horizon-strip';
import { IgnitionButton } from '@/shared/components/ignition-button';
import { useAuth } from '@/shared/hooks/use-auth';

const RESEND_COOLDOWN_SECONDS = 30;
const GENERIC_ERROR = 'Something went wrong. Please try again.';
// Must match supabase/config.toml's auth.email.otp_length (also set on the
// hosted project's Auth settings, which config.toml does not push).
// Story 4.4: mockups/key-otp-signin.html's own mockup shows 6 code boxes and
// "6-digit code" copy -- that's a mockup authoring inaccuracy, not a spec to
// follow (verified directly against config.toml: this app's real
// [auth.email] otp_length is 8; a different otp_length=6 entry elsewhere in
// that file is under the unrelated [auth.mfa.phone] section). This constant,
// and every render site below, stays at 8.
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
    <View style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.content}>
          {step === 'entry' ? (
            <>
              <Text style={styles.headline}>Sign in to Voylo</Text>
              <Text style={styles.subtext}>Enter your email and we&apos;ll send you a one-time code — no password to remember.</Text>
              <Text style={styles.fieldLabel}>Email</Text>
              <TextInput
                testID="email-input"
                style={styles.input}
                placeholder="you@example.com"
                placeholderTextColor={WayfinderColors.inkDisabled}
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
              {/* Restyled from the old "Wrong email? Go back" text link to
                  the mockup's icon-arrow treatment (Story 4.4 Scope
                  decision) -- same testID/onPress, accessibilityLabel keeps
                  the meaning for screen readers. Not built on the entry
                  step: no equivalent control exists there today, and adding
                  one would be new navigation behavior AC #2 doesn't
                  authorize. */}
              <Pressable
                testID="back-to-entry"
                accessibilityRole="button"
                accessibilityLabel="Wrong email? Go back"
                onPress={backToEntry}
                style={({ pressed }) => [styles.backArrow, pressed && styles.pressedScale]}
              >
                <Text style={styles.backArrowLabel}>{'‹'}</Text>
              </Pressable>
              <Text style={styles.headline}>Enter your code</Text>
              <Text style={styles.subtext}>We sent an {CODE_LENGTH}-digit code to {email}</Text>
              <Animated.View style={[styles.codeBoxRow, { transform: [{ translateX: shakeX }] }]}>
                {Array.from({ length: CODE_LENGTH }, (_, index) => {
                  const isFilled = index < code.length;
                  const isActive = index === code.length;
                  return (
                    <View key={index} style={[styles.codeBox, isFilled && styles.codeBoxFilled, isActive && styles.codeBoxActive]}>
                      <Text style={[styles.codeBoxText, !isFilled && styles.codeBoxTextEmpty]}>{code[index] ?? '•'}</Text>
                    </View>
                  );
                })}
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
                variant="text"
              />
            </>
          )}
          {error ? (
            <Text testID="error-message" style={styles.error}>
              {error}
            </Text>
          ) : null}
        </View>
        <HorizonStrip />
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: WayfinderColors.surfacePrimary,
  },
  safeArea: {
    flex: 1,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    gap: Spacing['3'],
    paddingHorizontal: Spacing.gutter,
  },
  backArrow: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: WayfinderColors.surfaceSecondary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing['4'],
  },
  pressedScale: {
    transform: [{ scale: 0.9 }],
  },
  backArrowLabel: {
    fontSize: 18,
    fontWeight: '700',
    color: WayfinderColors.inkPrimary,
  },
  headline: {
    color: WayfinderColors.inkPrimary,
    // 700 (Bold), not Typography.display's own 600 (Semibold).
    fontFamily: 'ClashDisplay-Bold',
    fontSize: 30,
    fontWeight: '700',
    lineHeight: 36,
  },
  subtext: {
    color: WayfinderColors.inkSecondary,
    fontFamily: Typography.body.fontFamily,
    fontSize: 14.5,
    lineHeight: 21.75,
  },
  fieldLabel: {
    color: WayfinderColors.inkSecondary,
    // 700 (Bold), not Typography.label's own 600 (Semibold).
    fontFamily: 'GeneralSans-Bold',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginTop: Spacing['2'],
  },
  joinCodeLink: {
    color: WayfinderColors.inkSecondary,
    fontFamily: Typography.body.fontFamily,
    fontSize: 13,
    textAlign: 'center',
    padding: Spacing['3'],
  },
  input: {
    width: '100%',
    color: WayfinderColors.inkPrimary,
    fontFamily: Typography.body.fontFamily,
    fontSize: 16,
    borderWidth: 2,
    borderColor: WayfinderColors.borderHairline,
    borderRadius: 14,
    padding: Spacing['4'],
    backgroundColor: WayfinderColors.surfacePrimary,
  },
  error: {
    color: WayfinderColors.error,
    fontFamily: Typography.body.fontFamily,
    fontSize: Typography.body.fontSize,
  },
  codeBoxRow: {
    position: 'relative',
    width: '100%',
    flexDirection: 'row',
    gap: 9,
  },
  codeBox: {
    flex: 1,
    height: 58,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: WayfinderColors.borderHairline,
    borderRadius: 14,
    backgroundColor: '#FAFBFC',
  },
  codeBoxFilled: {
    backgroundColor: WayfinderColors.surfaceSecondary,
  },
  codeBoxActive: {
    borderColor: WayfinderColors.accentPrimary,
    backgroundColor: WayfinderColors.surfacePrimary,
  },
  codeBoxText: {
    color: WayfinderColors.inkPrimary,
    fontFamily: Typography.statNumeral.fontFamily,
    fontSize: 22,
    fontWeight: '700',
  },
  // Literal mockup value -- an even lighter tone than WayfinderColors.
  // inkDisabled, used only for the empty-box bullet placeholder.
  codeBoxTextEmpty: {
    color: '#C0C6D2',
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

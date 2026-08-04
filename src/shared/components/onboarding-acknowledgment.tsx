import { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Spacing, Typography, WayfinderColors } from '@/constants/design-tokens';
import { IgnitionButton } from '@/shared/components/ignition-button';

const GENERIC_ERROR = 'Something went wrong. Please try again.';

/**
 * Shared shell for Voylo's once-ever onboarding acknowledgment screens (Trust
 * Moment, Driver Attention Consent): full-bleed headline + supporting copy + one
 * "Got it" button, same low-drama pattern per EXPERIENCE.md.
 * `testIdPrefix` keeps each screen's rendered testIDs distinct (e.g.
 * "trust-moment-got-it-button" vs "driver-consent-got-it-button") rather than
 * assuming the two screens are never simultaneously present in a live navigation
 * transition -- that assumption was never actually verified against React
 * Navigation's stack-transition mounting behavior (code review finding).
 *
 * Story 4.4: full-bleed `surfaceInkNavy` -- the one deliberate exception to
 * Wayfinder's "no dark surfaces" rule, per DESIGN.md, reserved exclusively for
 * these two screens. Not `screenStyles` (that's the legacy Night Drive shared
 * layout): the background here needs to be Wayfinder's own ink-navy token, not
 * the old dark canvas, even though the two happen to render the same hex --
 * see the design-tokens.ts comment on `surfaceInkNavy` for why they're kept as
 * separate, intentionally-named exports rather than one shared value.
 * `iconBackground`/`icon` are new -- an icon badge that didn't exist in this
 * component before this story, present in both mockups (teal shield for Trust
 * Moment, amber car for Driver Consent), decorative-only (no flow/copy
 * change). `headlineFontSize` exists because the two screens' own mockups
 * measure genuinely different headline sizes (30px vs 28px) -- literal
 * per-mockup values, not forced to match each other.
 */
export function OnboardingAcknowledgment({
  testIdPrefix,
  headline,
  headlineFontSize = 30,
  supportingCopy,
  iconBackground,
  icon,
  onAcknowledge,
}: {
  testIdPrefix: string;
  headline: string;
  headlineFontSize?: number;
  supportingCopy: string;
  iconBackground: string;
  icon: string;
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
    <View style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <View testID={`${testIdPrefix}-icon-badge`} style={[styles.iconBadge, { backgroundColor: iconBackground }]}>
          <Text style={styles.iconGlyph}>{icon}</Text>
        </View>
        <Text style={[styles.headline, { fontSize: headlineFontSize }]}>{headline}</Text>
        <Text style={styles.supporting}>{supportingCopy}</Text>
        <IgnitionButton testID={`${testIdPrefix}-got-it-button`} label="Got it" disabled={isSubmitting} onPress={handleGotIt} />
        {error ? (
          <Text testID={`${testIdPrefix}-error-message`} style={styles.error}>
            {error}
          </Text>
        ) : null}
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: WayfinderColors.surfaceInkNavy,
  },
  safeArea: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing['4'],
    paddingHorizontal: Spacing.gutter,
  },
  // 24px radius -- literal mockup value, doesn't match Rounded.md (18) or
  // .lg (28); same "mockup wins on precise values" convention as the rest
  // of this epic.
  iconBadge: {
    width: 84,
    height: 84,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconGlyph: {
    fontSize: 36,
  },
  headline: {
    color: WayfinderColors.inkOnNavyPrimary,
    fontFamily: Typography.display.fontFamily,
    fontWeight: '700',
    textAlign: 'center',
  },
  supporting: {
    color: WayfinderColors.inkOnNavySecondary,
    fontSize: 15,
    lineHeight: 23,
    maxWidth: 300,
    textAlign: 'center',
  },
  error: {
    color: WayfinderColors.error,
    fontSize: Typography.body.fontSize,
  },
});

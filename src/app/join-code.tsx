import * as Clipboard from 'expo-clipboard';
import { LinearGradient } from 'expo-linear-gradient';
import * as Linking from 'expo-linking';
import { Redirect, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Share, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Colors, JoinCodeCard, Spacing, Typography } from '@/constants/design-tokens';
import { IgnitionButton } from '@/shared/components/ignition-button';
import { useJustStartedVoyage } from '@/shared/hooks/use-just-started-voyage';
import { usePendingEntryTransition } from '@/shared/hooks/use-pending-entry-transition';
import { screenStyles } from '@/shared/styles/screen';

const COPIED_LABEL_DURATION_MS = 2000;

// CSS's linear-gradient(160deg, ...) angle converted to RN's fractional
// start/end points (0deg = up, clockwise) -- DESIGN.md#Components.
const GRADIENT_START = { x: 0.33, y: 0.03 };
const GRADIENT_END = { x: 0.67, y: 0.97 };

// Interim-scheme deep link (AD-10 release blocker -- see the story's Dev Notes):
// Linking.createURL respects app.json's configured scheme today and will start
// producing real https:// universal-link URLs with zero call-site changes once
// a domain is configured.
export default function JoinCodeScreen() {
  const { destination, joinCode } = useLocalSearchParams<{ destination: string; joinCode: string }>();
  const { clearJustStartedVoyage } = useJustStartedVoyage();
  const { triggerEntryTransition } = usePendingEntryTransition();
  const [copied, setCopied] = useState(false);
  const isMounted = useRef(true);
  const copiedTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      isMounted.current = false;
      if (copiedTimeout.current) clearTimeout(copiedTimeout.current);
      // Code review finding: previously only cleared by tapping Continue --
      // any other way off this screen (e.g. Android hardware back) left
      // hasJustStartedVoyage stuck true, which could re-admit this screen's
      // own Stack.Protected guard (_layout.tsx) unexpectedly on some later,
      // unrelated navigation. Clearing on unmount covers every exit path,
      // not just the one explicit button. Calling it again here after
      // Continue's own explicit clear is harmless (idempotent).
      clearJustStartedVoyage();
    };
  }, [clearJustStartedVoyage]);

  if (!destination || !joinCode) {
    return <Redirect href="/" />;
  }

  const link = Linking.createURL(`/join/${joinCode}`);

  async function handleCopy() {
    try {
      await Clipboard.setStringAsync(joinCode);
      if (!isMounted.current) return;
      setCopied(true);
      if (copiedTimeout.current) clearTimeout(copiedTimeout.current);
      copiedTimeout.current = setTimeout(() => {
        if (isMounted.current) setCopied(false);
      }, COPIED_LABEL_DURATION_MS);
    } catch {
      // Clipboard write failed silently -- no confirmation shown is the correct feedback.
    }
  }

  function handleShare() {
    Share.share({ message: `Join my Voyage to ${destination} on Voylo: ${link}` }).catch(() => {
      // User-cancelled or platform share-sheet error -- nothing actionable to surface.
    });
  }

  return (
    <View style={screenStyles.container}>
      <SafeAreaView style={styles.safeArea}>
        <Text style={screenStyles.headline}>Your Voyage is live.</Text>
        <Text style={styles.subhead}>Share this code to invite Voyagers to {destination}.</Text>
        <LinearGradient colors={JoinCodeCard.gradient} start={GRADIENT_START} end={GRADIENT_END} style={styles.card}>
          <Text style={styles.cardLabel}>JOIN CODE</Text>
          <Text
            testID="join-code-text"
            accessibilityRole="button"
            accessibilityLabel="Copy join code"
            style={styles.code}
            onPress={handleCopy}
          >
            {joinCode}
          </Text>
          {copied ? (
            <Text testID="copied-label" style={styles.copiedLabel}>
              Copied
            </Text>
          ) : null}
        </LinearGradient>
        {/* Story 4.4: "secondary" now means a bordered pill (see
            ignition-button.tsx) -- this screen isn't in that story's
            re-skin scope and stays Night-Drive-styled, so "text" preserves
            this control's current plain-text-link appearance instead. */}
        <IgnitionButton testID="share-button" label="Share" disabled={false} onPress={handleShare} variant="text" />
        {/* Clears the flag that admits this screen's own Stack.Protected
            guard (Story 4.3, _layout.tsx) -- once it's false, the router
            evicts this screen the same way voyage-joined.tsx's own Continue
            already does for the Join flow, landing on active-voyage.tsx (or
            location-permission.tsx first, if that's still outstanding). Not
            router.back(): this screen isn't Protected on a route param, so
            back() had nowhere correct to return to. triggerEntryTransition()
            is a separate flag (see its own file comment for why) that
            active-voyage.tsx reads on its own next mount to fire the "cut to
            gameplay" transition. */}
        <IgnitionButton
          testID="join-code-continue-button"
          label="Continue"
          disabled={false}
          onPress={() => {
            triggerEntryTransition();
            clearJustStartedVoyage();
          }}
        />
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing['5'],
    paddingHorizontal: Spacing.gutter,
  },
  subhead: {
    color: Colors.inkSecondary,
    fontFamily: Typography.body.fontFamily,
    fontSize: Typography.body.fontSize,
    lineHeight: Typography.body.lineHeight,
    textAlign: 'center',
  },
  card: {
    width: '100%',
    borderRadius: JoinCodeCard.radius,
    borderWidth: 1,
    borderColor: JoinCodeCard.borderColor,
    paddingVertical: Spacing['6'],
    paddingHorizontal: Spacing['5'],
    alignItems: 'center',
    gap: Spacing['2'],
    shadowColor: JoinCodeCard.glowColor,
    shadowOpacity: JoinCodeCard.glowOpacity,
    shadowRadius: JoinCodeCard.glowRadius,
    shadowOffset: { width: 0, height: 0 },
    elevation: 8,
  },
  cardLabel: {
    color: Colors.inkSecondary,
    fontFamily: Typography.label.fontFamily,
    fontSize: Typography.label.fontSize,
    fontWeight: Typography.label.fontWeight,
    lineHeight: Typography.label.lineHeight,
    letterSpacing: Typography.label.letterSpacing,
  },
  code: {
    color: Colors.inkPrimary,
    fontFamily: Typography.statNumeral.fontFamily,
    fontSize: Typography.statNumeral.fontSize,
    fontWeight: Typography.statNumeral.fontWeight,
    lineHeight: Typography.statNumeral.lineHeight,
    letterSpacing: Typography.statNumeral.letterSpacing,
  },
  copiedLabel: {
    color: Colors.accentViolet,
    fontFamily: Typography.body.fontFamily,
    fontSize: 13,
  },
});

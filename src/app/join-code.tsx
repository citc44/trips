import * as Clipboard from 'expo-clipboard';
import { LinearGradient } from 'expo-linear-gradient';
import * as Linking from 'expo-linking';
import { Redirect, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Share, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Colors, JoinCodeCard, Spacing, Typography } from '@/constants/design-tokens';
import { IgnitionButton } from '@/shared/components/ignition-button';
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
  const [copied, setCopied] = useState(false);
  const isMounted = useRef(true);
  const copiedTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      isMounted.current = false;
      if (copiedTimeout.current) clearTimeout(copiedTimeout.current);
    };
  }, []);

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
        <IgnitionButton testID="share-button" label="Share" disabled={false} onPress={handleShare} variant="secondary" />
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

import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Colors, Rounded, Spacing, Typography } from '@/constants/design-tokens';
import { IgnitionButton } from '@/shared/components/ignition-button';
import { screenStyles } from '@/shared/styles/screen';

// Distinct from both /join-code (the Organizer's own code-reveal screen) and
// /join/[code] (the deep-link landing screen a shared link jumps straight
// to). This screen exists for the case neither of those covers: someone was
// told a code (read aloud, texted as plain digits, typed from memory) with
// no link to tap -- there was previously no way to act on a join code at
// all without one. Deliberately thin: no preview/validation/join logic of
// its own, just collects the code and hands off to /join/[code], which
// already owns all of that (and is already reachable at any auth state, the
// same requirement this screen has).
export default function JoinManualScreen() {
  const [code, setCode] = useState('');

  const trimmedCode = code.trim();
  const canSubmit = trimmedCode.length > 0;

  function handleJoin() {
    if (!canSubmit) return;
    router.push({ pathname: '/join/[code]', params: { code: trimmedCode } });
  }

  return (
    <View style={screenStyles.container}>
      <SafeAreaView style={styles.safeArea}>
        <View>
          <Text style={styles.eyebrow}>Join a Voyage</Text>
          <Text style={styles.prompt}>Got a code?</Text>
        </View>

        <View style={styles.fieldWrap}>
          <Text style={styles.fieldLabel}>JOIN CODE</Text>
          <TextInput
            testID="join-code-input"
            style={styles.input}
            placeholder="e.g. ABCD2345"
            placeholderTextColor={Colors.inkSecondary}
            autoCapitalize="characters"
            autoCorrect={false}
            maxLength={20}
            value={code}
            onChangeText={setCode}
          />
        </View>

        <IgnitionButton testID="join-with-code-button" label="Join" disabled={!canSubmit} onPress={handleJoin} />
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
});

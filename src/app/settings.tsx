import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Colors, Spacing, Typography } from '@/constants/design-tokens';
import { useAuth } from '@/shared/hooks/use-auth';

export default function SettingsScreen() {
  const { signOut } = useAuth();
  const [isSigningOut, setIsSigningOut] = useState(false);

  async function handleSignOut() {
    setIsSigningOut(true);
    await signOut();
    // On success, the shared auth hook's session becomes null and the root
    // layout's Stack.Protected guard routes to /sign-in automatically.
    setIsSigningOut(false);
  }

  return (
    <View style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <Text style={styles.headline}>Settings</Text>
        <Text
          testID="sign-out-button"
          accessibilityRole="button"
          accessibilityState={{ disabled: isSigningOut }}
          onPress={isSigningOut ? undefined : handleSignOut}
          style={[styles.signOutLabel, isSigningOut && styles.disabledLabel]}
        >
          Sign out
        </Text>
      </SafeAreaView>
    </View>
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
  signOutLabel: {
    color: Colors.inkPrimary,
    fontSize: Typography.body.fontSize,
    borderWidth: 1,
    borderColor: Colors.borderHairline,
    borderRadius: Spacing['2'],
    paddingVertical: Spacing['3'],
    paddingHorizontal: Spacing['5'],
  },
  disabledLabel: {
    color: Colors.inkSecondary,
  },
});

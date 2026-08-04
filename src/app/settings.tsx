import { Link } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Colors, Typography } from '@/constants/design-tokens';
import { IgnitionButton } from '@/shared/components/ignition-button';
import { useAuth } from '@/shared/hooks/use-auth';
import { screenStyles } from '@/shared/styles/screen';

const GENERIC_ERROR = 'Something went wrong signing you out. Please try again.';

export default function SettingsScreen() {
  const { signOut } = useAuth();
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isMounted = useRef(true);

  useEffect(() => {
    return () => {
      isMounted.current = false;
    };
  }, []);

  async function handleSignOut() {
    setIsSigningOut(true);
    setError(null);

    try {
      const { error: signOutError } = await signOut();
      if (!isMounted.current) return;

      if (signOutError) {
        setError(signOutError.message);
      }
      // On success, the shared auth hook's session becomes null and the root
      // layout's Stack.Protected guard routes to /sign-in automatically.
    } catch {
      if (!isMounted.current) return;
      setError(GENERIC_ERROR);
    } finally {
      if (isMounted.current) {
        setIsSigningOut(false);
      }
    }
  }

  return (
    <View style={screenStyles.container}>
      <SafeAreaView style={screenStyles.safeArea}>
        <Text style={screenStyles.headline}>Settings</Text>
        {/* Story 4.4: "secondary" now means a bordered pill (see
            ignition-button.tsx) -- this screen isn't in that story's
            re-skin scope and stays Night-Drive-styled, so "text" preserves
            this control's current plain-text-link appearance instead. */}
        <IgnitionButton testID="sign-out-button" label="Sign out" disabled={isSigningOut} onPress={handleSignOut} variant="text" />
        <Text style={styles.caption}>Signs you out on every device, not just this one.</Text>
        {error ? (
          <Text testID="error-message" style={screenStyles.error}>
            {error}
          </Text>
        ) : null}
        <Link testID="back-to-home-link" href="/">
          <Text style={styles.backLabel}>Back to Home</Text>
        </Link>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  caption: {
    color: Colors.inkSecondary,
    fontFamily: Typography.body.fontFamily,
    fontSize: 13,
    textAlign: 'center',
  },
  backLabel: {
    color: Colors.inkPrimary,
    fontFamily: Typography.body.fontFamily,
    fontSize: Typography.body.fontSize,
  },
});

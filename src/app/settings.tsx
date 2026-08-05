import { Link } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Colors, Typography } from '@/constants/design-tokens';
import { IgnitionButton } from '@/shared/components/ignition-button';
import { useActiveVoyage } from '@/shared/hooks/use-active-voyage';
import { useAuth } from '@/shared/hooks/use-auth';
import { screenStyles } from '@/shared/styles/screen';

const GENERIC_ERROR = 'Something went wrong signing you out. Please try again.';

export default function SettingsScreen() {
  const { signOut } = useAuth();
  const { activeVoyage, clearActiveVoyage } = useActiveVoyage();
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [showOrganizerWarning, setShowOrganizerWarning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isMounted = useRef(true);

  useEffect(() => {
    return () => {
      isMounted.current = false;
    };
  }, []);

  async function handleSignOut() {
    // An Organizer departure may end the Voyage if nobody else can own it.
    // Require a second, explicit action after disclosing that consequence;
    // the server remains authoritative if the roster changes concurrently.
    if (activeVoyage?.role === 'organizer' && !showOrganizerWarning) {
      setShowOrganizerWarning(true);
      setError(null);
      return;
    }

    setIsSigningOut(true);
    setError(null);

    try {
      const { error: signOutError, didLeaveActiveVoyage } = await signOut();
      if (!isMounted.current) return;

      if (didLeaveActiveVoyage) {
        clearActiveVoyage();
      }

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
        {showOrganizerWarning ? (
          <>
            <Text testID="organizer-sign-out-warning" style={styles.caption}>
              Signing out leaves your active Voyage. If you are its last Organizer, the Voyage will end for everyone.
            </Text>
            <IgnitionButton
              testID="confirm-sign-out-button"
              label="Leave Voyage and sign out"
              disabled={isSigningOut}
              onPress={handleSignOut}
              variant="text"
            />
            <IgnitionButton
              testID="cancel-sign-out-button"
              label="Cancel"
              disabled={isSigningOut}
              onPress={() => {
                setShowOrganizerWarning(false);
                setError(null);
              }}
              variant="text"
            />
          </>
        ) : (
          <IgnitionButton testID="sign-out-button" label="Sign out" disabled={isSigningOut} onPress={handleSignOut} variant="text" />
        )}
        <Text style={styles.caption}>Leaves your active Voyage, then signs you out on every device.</Text>
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

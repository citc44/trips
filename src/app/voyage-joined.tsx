import { Redirect } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Colors, Typography } from '@/constants/design-tokens';
import { voyageRepository } from '@/repositories/voyage-repository';
import { IgnitionButton } from '@/shared/components/ignition-button';
import { useActiveVoyage } from '@/shared/hooks/use-active-voyage';
import { usePendingJoin } from '@/shared/hooks/use-pending-join';
import { screenStyles } from '@/shared/styles/screen';

const GENERIC_ERROR = 'Something went wrong. Please try again.';

// Interim landing (Story 2.3 Dev Notes): Live Map is Epic 3, so this is where
// AC2's "live Voyage view" lands for now -- same "build what this story needs"
// precedent as Destination Picker (2.1) and the Join-code card (2.2). Reached
// only via _layout.tsx's `route === 'home' && pendingJoinCode` guard branch
// (fresh-auth case) or a direct push from the Join Invitation screen
// (already-authenticated case) -- this is the ONE place join_voyage() is
// called, regardless of which path got the user here.
export default function VoyageJoinedScreen() {
  const { pendingJoinCode, clearPendingJoinCode } = usePendingJoin();
  const { refetch: refetchActiveVoyage } = useActiveVoyage();
  const [destination, setDestination] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  // Keyed to the specific code it started for (not a plain boolean latch) --
  // a second, different pendingJoinCode arriving while this screen is still
  // mounted (e.g. a second invite link tapped before the first join finishes)
  // must still trigger a fresh join attempt (code review finding).
  const startedFor = useRef<string | null>(null);
  const isMounted = useRef(true);

  useEffect(() => {
    return () => {
      isMounted.current = false;
    };
  }, []);

  useEffect(() => {
    if (!pendingJoinCode || startedFor.current === pendingJoinCode) return;
    startedFor.current = pendingJoinCode;
    setIsLoading(true);
    setError(null);
    setDestination(null);

    voyageRepository
      .joinVoyage(pendingJoinCode)
      .then(({ data, error: joinError }) => {
        if (!isMounted.current) return;
        if (joinError || !data) {
          setError(joinError?.message ?? GENERIC_ERROR);
          setIsLoading(false);
          return;
        }
        setDestination(data.destination);
        setIsLoading(false);
        // Without this, ActiveVoyageProvider only re-fetches on a userId
        // change -- tapping Continue below would clear pendingJoinCode and
        // route back to plain Home instead of active-voyage.tsx, since
        // activeVoyage would still be stale/null (code review finding).
        refetchActiveVoyage();
      })
      .catch(() => {
        if (!isMounted.current) return;
        setError(GENERIC_ERROR);
        setIsLoading(false);
      });
  }, [pendingJoinCode, refetchActiveVoyage]);

  if (!pendingJoinCode) {
    return <Redirect href="/" />;
  }

  function handleContinue() {
    // Clears pendingJoinCode -- this is what flips _layout.tsx's guard back to
    // the plain Home block and redirects there, same mechanism as the rest of
    // the onboarding cascade. Never leaves a stale pending code behind that
    // could re-trigger a join on some future, unrelated `home` transition.
    clearPendingJoinCode();
  }

  return (
    <View style={screenStyles.container}>
      <SafeAreaView style={screenStyles.safeArea}>
        {isLoading ? null : (
          <>
            <Text style={screenStyles.headline}>{error ? "Couldn't join this trip." : "You're on the trip."}</Text>
            {destination ? <Text style={styles.subhead}>{destination}</Text> : null}
            {error ? (
              <Text testID="voyage-joined-error" style={screenStyles.error}>
                {error}
              </Text>
            ) : null}
            <IgnitionButton
              testID="voyage-joined-continue-button"
              label="Continue"
              disabled={false}
              onPress={handleContinue}
              variant="secondary"
            />
          </>
        )}
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  subhead: {
    color: Colors.inkSecondary,
    fontFamily: Typography.body.fontFamily,
    fontSize: Typography.body.fontSize,
    lineHeight: Typography.body.lineHeight,
    textAlign: 'center',
  },
});

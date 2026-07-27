import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Colors, Spacing, Typography } from '@/constants/design-tokens';
import { voyageRepository, type VoyagePreview } from '@/repositories/voyage-repository';
import { IgnitionButton } from '@/shared/components/ignition-button';
import { useAuth } from '@/shared/hooks/use-auth';
import { usePendingJoin } from '@/shared/hooks/use-pending-join';
import { screenStyles } from '@/shared/styles/screen';

// Note: this is /join/<code> -- the invitee's landing screen -- distinct from
// the already-existing /join-code route (Story 2.2, the Organizer's own
// code-reveal screen). Similar names, unrelated screens.
//
// No personalized inviter name, no real per-Voyager avatar stack (see Story
// 2.3's Dev Notes: no display-name field exists anywhere in the schema, and
// player-color assignment is Epic 3/Live Map scope) -- generic copy + a
// Voyager count instead.
export default function JoinInvitationScreen() {
  const { code } = useLocalSearchParams<{ code: string }>();
  const { session } = useAuth();
  const { setPendingJoinCode } = usePendingJoin();

  const [preview, setPreview] = useState<VoyagePreview | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const isMounted = useRef(true);

  useEffect(() => {
    return () => {
      isMounted.current = false;
    };
  }, []);

  useEffect(() => {
    voyageRepository
      .getVoyagePreview(code)
      .then(({ data, error }) => {
        if (!isMounted.current) return;
        if (error || !data) {
          setNotFound(true);
        } else {
          setPreview(data);
        }
        setIsLoading(false);
      })
      .catch(() => {
        if (!isMounted.current) return;
        setNotFound(true);
        setIsLoading(false);
      });
  }, [code]);

  function handleJoin() {
    setPendingJoinCode(code);
    // Authenticated + already onboarded: _layout.tsx's `route === 'home' &&
    // pendingJoinCode` guard flips and redirects to voyage-joined on its own,
    // same mechanism as the existing onboarding cascade -- no push needed.
    // Unauthenticated: nothing else moves the user off this (unguarded)
    // screen, so an explicit push is required.
    if (!session) {
      router.push('/sign-in');
    }
  }

  if (isLoading) {
    return null;
  }

  if (notFound) {
    return (
      <View style={screenStyles.container}>
        <SafeAreaView style={screenStyles.safeArea}>
          <Text testID="invitation-invalid" style={screenStyles.headline}>
            This invite link isn&apos;t valid.
          </Text>
        </SafeAreaView>
      </View>
    );
  }

  if (preview?.status === 'ended') {
    return (
      <View style={screenStyles.container}>
        <SafeAreaView style={screenStyles.safeArea}>
          <Text testID="invitation-ended" style={screenStyles.headline}>
            This trip&apos;s already wrapped up.
          </Text>
          <IgnitionButton
            testID="start-your-own-voyage-button"
            label="Start your own Voyage"
            disabled={false}
            onPress={() => router.push('/voyage-intro')}
          />
        </SafeAreaView>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <View>
          <Text style={styles.eyebrow}>You&apos;re invited</Text>
          <Text style={styles.headline}>A road trip worth remembering.</Text>
          <Text style={styles.subhead}>
            Ride along live to {preview?.destination} — then walk away with a memory reel of the whole thing: inside jokes, wrong turns,
            and all.
          </Text>
          {preview && preview.voyagerCount > 0 ? (
            <Text style={styles.voyagerCount}>
              {preview.voyagerCount} {preview.voyagerCount === 1 ? 'Voyager' : 'Voyagers'} riding already
            </Text>
          ) : null}
          <View style={styles.trustLine}>
            <Text style={styles.trustLineText}>
              Your location stays in this Voyage. <Text style={styles.trustLineBold}>We never sell it.</Text> Visible only to the people
              riding with you, and only while it&apos;s active.
            </Text>
          </View>
        </View>
        <IgnitionButton testID="join-the-voyage-button" label="Join the Voyage" disabled={false} onPress={handleJoin} />
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
    justifyContent: 'center',
    alignItems: 'flex-start',
    gap: Spacing.heroGap,
    paddingHorizontal: Spacing.gutter,
  },
  eyebrow: {
    color: Colors.accentViolet,
    fontFamily: Typography.label.fontFamily,
    fontSize: Typography.label.fontSize,
    fontWeight: Typography.label.fontWeight,
    lineHeight: Typography.label.lineHeight,
    letterSpacing: Typography.label.letterSpacing,
    textTransform: 'uppercase',
  },
  headline: {
    marginTop: Spacing['3'],
    color: Colors.inkPrimary,
    fontFamily: Typography.displayHero.fontFamily,
    fontSize: Typography.displayHero.fontSize,
    fontWeight: Typography.displayHero.fontWeight,
    lineHeight: Typography.displayHero.lineHeight,
    letterSpacing: Typography.displayHero.letterSpacing,
  },
  subhead: {
    marginTop: Spacing['4'],
    color: Colors.inkSecondary,
    fontFamily: Typography.body.fontFamily,
    fontSize: Typography.body.fontSize,
    lineHeight: Typography.body.lineHeight,
    maxWidth: 300,
  },
  voyagerCount: {
    marginTop: Spacing['3'],
    color: Colors.inkSecondary,
    fontFamily: Typography.body.fontFamily,
    fontSize: 13,
  },
  trustLine: {
    marginTop: Spacing['4'],
    padding: Spacing['3'],
    borderRadius: Spacing['3'],
    borderWidth: 1,
    borderColor: Colors.borderHairline,
    maxWidth: 340,
  },
  trustLineText: {
    color: Colors.inkSecondary,
    fontFamily: Typography.body.fontFamily,
    fontSize: 13,
    lineHeight: 19,
  },
  trustLineBold: {
    color: Colors.inkPrimary,
    fontWeight: '700',
  },
});

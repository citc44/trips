import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Colors, Spacing, Typography } from '@/constants/design-tokens';
import { voyageRepository, type VoyagePreview } from '@/repositories/voyage-repository';
import { IgnitionButton } from '@/shared/components/ignition-button';
import { useAuth } from '@/shared/hooks/use-auth';
import { usePendingJoin } from '@/shared/hooks/use-pending-join';
import { useProfile } from '@/shared/hooks/use-profile';
import { resolveRoute } from '@/shared/navigation/resolve-route';
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
  const { profile, hasError: profileHasError } = useProfile();
  const { pendingJoinCode, setPendingJoinCode } = usePendingJoin();

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
    // Resolved via a microtask (not called synchronously in the effect body)
    // so this stays inside a promise callback, matching use-profile.tsx's
    // established pattern and satisfying the react-hooks/set-state-in-effect
    // rule -- needed here (unlike the mount-only effect above) because `code`
    // can change on an already-mounted instance, and without resetting first,
    // a stale "invalid"/destination from the previous code could briefly show
    // for the new one (code review finding).
    Promise.resolve().then(() => {
      if (!isMounted.current) return;
      setIsLoading(true);
      setNotFound(false);
      setPreview(null);
    });

    voyageRepository
      .getVoyagePreview(code)
      .then(({ data, error }) => {
        if (!isMounted.current) return;
        if (error || !data) {
          setNotFound(true);
          setPreview(null);
        } else {
          setPreview(data);
          setNotFound(false);
        }
        setIsLoading(false);
      })
      .catch(() => {
        if (!isMounted.current) return;
        setNotFound(true);
        setPreview(null);
        setIsLoading(false);
      });
  }, [code]);

  // `join/[code]` is registered outside every `Stack.Protected` block on
  // purpose (so a deep link can always reach it) -- which means, unlike
  // sign-in/trust-moment/driver-attention-consent, its own guard never flips,
  // so nothing in the framework automatically moves the user off of it once
  // authenticated. Explicitly navigate to whatever `resolveRoute()` (the same
  // pure function `_layout.tsx` uses) says is next, once `pendingJoinCode` has
  // actually committed -- guaranteed to be a currently-registered screen since
  // it's computed from the same live inputs `_layout.tsx`'s own guard uses
  // (code review finding: the original design wrongly assumed the guard-flip
  // auto-redirect that drives the rest of the onboarding cascade applied here
  // too, which left both an already-onboarded tap AND a mid-onboarding tap
  // stranded with no navigation at all).
  useEffect(() => {
    if (!session || pendingJoinCode !== code) return;

    const hasSeenTrustMoment = !!profile?.trustMomentSeenAt || profileHasError;
    const hasSeenDriverConsent = !!profile?.driverConsentSeenAt || profileHasError;
    const nextRoute = resolveRoute({ hasSession: true, hasSeenTrustMoment, hasSeenDriverConsent });

    if (nextRoute === 'trust-moment') {
      router.push('/trust-moment');
    } else if (nextRoute === 'driver-attention-consent') {
      router.push('/driver-attention-consent');
    } else {
      router.push('/voyage-joined');
    }
  }, [session, pendingJoinCode, code, profile, profileHasError]);

  function handleJoin() {
    setPendingJoinCode(code);
    if (!session) {
      router.push('/sign-in');
    }
    // Authenticated: the effect above navigates once pendingJoinCode commits.
  }

  // Used by the "invalid code" recovery button: there's no universal "Home" to
  // fall back to -- an unauthenticated user has no Home at all, and an
  // authenticated-but-mid-onboarding user still needs to finish that first.
  // Same resolveRoute()-driven approach as the join effect above, just without
  // a pendingJoinCode/voyage-joined destination since no join is in progress.
  function handleGoHome() {
    if (!session) {
      router.push('/sign-in');
      return;
    }
    const hasSeenTrustMoment = !!profile?.trustMomentSeenAt || profileHasError;
    const hasSeenDriverConsent = !!profile?.driverConsentSeenAt || profileHasError;
    const nextRoute = resolveRoute({ hasSession: true, hasSeenTrustMoment, hasSeenDriverConsent });

    if (nextRoute === 'trust-moment') {
      router.push('/trust-moment');
    } else if (nextRoute === 'driver-attention-consent') {
      router.push('/driver-attention-consent');
    } else {
      router.push('/');
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
          <IgnitionButton
            testID="invitation-invalid-home-button"
            label="Continue"
            disabled={false}
            onPress={handleGoHome}
            variant="secondary"
          />
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

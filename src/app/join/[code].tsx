import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Spacing, Typography, WayfinderColors } from '@/constants/design-tokens';
import { voyageRepository, type VoyagePreview } from '@/repositories/voyage-repository';
import { IgnitionButton } from '@/shared/components/ignition-button';
import { RoadMotif } from '@/shared/components/road-motif';
import { useActiveVoyage } from '@/shared/hooks/use-active-voyage';
import { useAuth } from '@/shared/hooks/use-auth';
import { useJustStartedVoyage } from '@/shared/hooks/use-just-started-voyage';
import { usePendingJoin } from '@/shared/hooks/use-pending-join';
import { useProfile } from '@/shared/hooks/use-profile';
import { resolveRoute } from '@/shared/navigation/resolve-route';

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
  const { activeVoyage } = useActiveVoyage();
  const { profile, hasError: profileHasError } = useProfile();
  const { pendingJoinCode, setPendingJoinCode } = usePendingJoin();
  const { clearJustStartedVoyage } = useJustStartedVoyage();

  const [preview, setPreview] = useState<VoyagePreview | null>(null);
  const [resolvedPreviewCode, setResolvedPreviewCode] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const previewRequestId = useRef(0);
  const isMounted = useRef(true);

  useEffect(() => {
    return () => {
      isMounted.current = false;
    };
  }, []);

  useEffect(() => {
    const thisRequestId = ++previewRequestId.current;
    const isCurrentRequest = () => isMounted.current && previewRequestId.current === thisRequestId;

    // Resolved via a microtask (not called synchronously in the effect body)
    // so this stays inside a promise callback, matching use-profile.tsx's
    // established pattern and satisfying the react-hooks/set-state-in-effect
    // rule -- needed here (unlike the mount-only effect above) because `code`
    // can change on an already-mounted instance, and without resetting first,
    // a stale "invalid"/destination from the previous code could briefly show
    // for the new one (code review finding).
    Promise.resolve().then(() => {
      if (!isCurrentRequest()) return;
      setIsLoading(true);
      setNotFound(false);
      setPreview(null);
      setResolvedPreviewCode(null);
    });

    voyageRepository
      .getVoyagePreview(code)
      .then(({ data, error }) => {
        if (!isCurrentRequest()) return;
        if (error || !data) {
          setNotFound(true);
          setPreview(null);
        } else {
          setPreview(data);
          setNotFound(false);
        }
        setResolvedPreviewCode(code);
        setIsLoading(false);
      })
      .catch(() => {
        if (!isCurrentRequest()) return;
        setNotFound(true);
        setPreview(null);
        setResolvedPreviewCode(code);
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
    const hasDisplayName = !!profile?.displayName || profileHasError;
    const nextRoute = resolveRoute({ hasSession: true, hasSeenTrustMoment, hasSeenDriverConsent, hasDisplayName });

    if (nextRoute === 'trust-moment') {
      router.replace('/trust-moment');
    } else if (nextRoute === 'driver-attention-consent') {
      router.replace('/driver-attention-consent');
    } else if (nextRoute === 'display-name') {
      router.replace('/display-name');
    } else {
      // Joining is now committed navigation state. Replace the invitation so
      // it cannot reappear underneath the resolver (or via Android Back) once
      // membership has changed.
      router.replace('/voyage-joined');
    }
  }, [session, pendingJoinCode, code, profile, profileHasError]);

  function handleJoin() {
    // A creator can open another invite while the one-time join-code reveal
    // flag is still set. Clear it before committing the new join intent so it
    // cannot reclaim navigation after the resolver switches memberships.
    clearJustStartedVoyage();
    setPendingJoinCode(code);
    if (!session) {
      router.replace('/sign-in');
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
    const hasDisplayName = !!profile?.displayName || profileHasError;
    const nextRoute = resolveRoute({ hasSession: true, hasSeenTrustMoment, hasSeenDriverConsent, hasDisplayName });

    if (nextRoute === 'trust-moment') {
      router.push('/trust-moment');
    } else if (nextRoute === 'driver-attention-consent') {
      router.push('/driver-attention-consent');
    } else if (nextRoute === 'display-name') {
      router.push('/display-name');
    } else {
      router.push('/');
    }
  }

  if (isLoading || resolvedPreviewCode !== code) {
    return null;
  }

  if (notFound) {
    return (
      <View style={styles.recoveryContainer}>
        <SafeAreaView style={styles.recoverySafeArea}>
          <Text testID="invitation-invalid" style={styles.recoveryHeadline}>
            This invite link isn&apos;t valid.
          </Text>
          {/* Code review finding: no mockup covers this branch (same as the
              `ended` branch below), so -- consistent with every other
              mockup-less button this story touched -- "text" preserves the
              prior plain-link appearance instead of silently picking up
              "secondary"'s new bordered-pill look with zero visual
              verification. */}
          <IgnitionButton
            testID="invitation-invalid-home-button"
            label="Continue"
            disabled={false}
            onPress={handleGoHome}
            variant="text"
          />
        </SafeAreaView>
      </View>
    );
  }

  if (preview?.status === 'ended') {
    return (
      <View style={styles.recoveryContainer}>
        <SafeAreaView style={styles.recoverySafeArea}>
          <Text testID="invitation-ended" style={styles.recoveryHeadline}>
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
      <RoadMotif rotateDeg={-8} style={styles.roadMotif} />
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.content}>
          {/* key-join-invitation.html's own "Chintan invited you" eyebrow and
              3-avatar stack are new personalization/content this re-skin
              doesn't add (Story 4.4 Scope decision -- no inviter-name or
              per-Voyager-color data exists yet). Keep the existing generic
              copy, re-skinned to the mockup's blue-hero eyebrow treatment. */}
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
          {activeVoyage ? (
            <Text testID="active-voyage-switch-warning" style={styles.switchWarning}>
              {activeVoyage.role === 'organizer'
                ? "Joining leaves your current Voyage. If you're its last Organizer, that Voyage will end for everyone."
                : 'Joining leaves your current Voyage automatically.'}
            </Text>
          ) : null}
          <IgnitionButton
            testID="join-the-voyage-button"
            label="Join the Voyage"
            disabled={false}
            onPress={handleJoin}
            variant="inverse"
          />
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: WayfinderColors.accentPrimary,
    overflow: 'hidden',
  },
  roadMotif: {
    top: -40,
    left: 70,
  },
  safeArea: {
    flex: 1,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: Spacing['4'],
    paddingHorizontal: Spacing.heroGap,
  },
  eyebrow: {
    color: '#D6E6FF',
    // 700 (Bold), not Typography.label's own 600 (Semibold).
    fontFamily: 'GeneralSans-Bold',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.6,
    textTransform: 'uppercase',
  },
  headline: {
    color: '#FFFFFF',
    // 700 (Bold), not Typography.displayHero's own 600 (Semibold).
    fontFamily: 'ClashDisplay-Bold',
    fontSize: 34,
    fontWeight: '700',
    lineHeight: 41,
    textAlign: 'center',
  },
  subhead: {
    color: '#D6E6FF',
    fontFamily: Typography.body.fontFamily,
    fontSize: 15.5,
    lineHeight: 24.8,
    maxWidth: 300,
    textAlign: 'center',
  },
  voyagerCount: {
    color: '#D6E6FF',
    fontFamily: Typography.body.fontFamily,
    fontSize: 13,
    textAlign: 'center',
  },
  trustLine: {
    padding: Spacing['3'],
    borderRadius: Spacing['3'],
    borderWidth: 1,
    borderColor: '#4C93FF',
    maxWidth: 340,
  },
  trustLineText: {
    color: '#D6E6FF',
    fontFamily: Typography.body.fontFamily,
    fontSize: 13,
    lineHeight: 19,
    textAlign: 'center',
  },
  trustLineBold: {
    color: '#FFFFFF',
    // No fontFamily of its own would inherit trustLineText's
    // GeneralSans-Regular while requesting 700 -- needs its own
    // weight-specific family to avoid faux (synthetic) bolding.
    fontFamily: 'GeneralSans-Bold',
    fontWeight: '700',
  },
  switchWarning: {
    color: '#FFFFFF',
    fontFamily: 'GeneralSans-Semibold',
    fontSize: 13,
    lineHeight: 19,
    maxWidth: 340,
    textAlign: 'center',
  },
  // notFound/ended branches: no dedicated mockup frame exists for either, so
  // these follow the app's light-canvas convention already established by
  // Voyage Ended/Home rather than the invited branch's blue hero above.
  recoveryContainer: {
    flex: 1,
    backgroundColor: WayfinderColors.surfaceSecondary,
  },
  recoverySafeArea: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'flex-start',
    gap: Spacing.heroGap,
    paddingHorizontal: Spacing.gutter,
  },
  recoveryHeadline: {
    color: WayfinderColors.inkPrimary,
    fontFamily: Typography.displayHero.fontFamily,
    fontSize: Typography.displayHero.fontSize,
    fontWeight: Typography.displayHero.fontWeight,
    lineHeight: Typography.displayHero.lineHeight,
    letterSpacing: Typography.displayHero.letterSpacing,
  },
});

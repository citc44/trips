import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { useColorScheme } from 'react-native';

import { initSentry, Sentry } from '@/lib/sentry';
import { ActiveVoyageProvider, useActiveVoyage } from '@/shared/hooks/use-active-voyage';
import { AuthProvider, useAuth } from '@/shared/hooks/use-auth';
import { PendingJoinProvider, usePendingJoin } from '@/shared/hooks/use-pending-join';
import { ProfileProvider, useProfile } from '@/shared/hooks/use-profile';
import { resolveRoute } from '@/shared/navigation/resolve-route';

initSentry();
SplashScreen.preventAutoHideAsync();

function AppNavigator() {
  const { session, isLoading: isAuthLoading } = useAuth();
  const { profile, isLoading: isProfileLoading, hasError: profileHasError } = useProfile();
  const { pendingJoinCode } = usePendingJoin();
  const { activeVoyage, isLoading: isActiveVoyageLoading } = useActiveVoyage();

  // Profile/active-Voyage data only start loading once a session exists (see
  // use-profile.tsx/use-active-voyage.tsx), so only wait on them while signed
  // in -- an unauthenticated user would otherwise be stuck on the splash
  // screen forever.
  const isLoading = isAuthLoading || (!!session && (isProfileLoading || isActiveVoyageLoading));

  useEffect(() => {
    if (!isLoading) {
      SplashScreen.hideAsync();
    }
  }, [isLoading]);

  if (isLoading) {
    return null;
  }

  // Fail open on a profile-fetch error: treat "unknown" as "already seen" rather
  // than "never seen," so a transient network failure doesn't re-show either
  // onboarding step to an already-onboarded user (see use-profile.tsx).
  const hasSeenTrustMoment = !!profile?.trustMomentSeenAt || profileHasError;
  const hasSeenDriverConsent = !!profile?.driverConsentSeenAt || profileHasError;
  const hasDisplayName = !!profile?.displayName || profileHasError;

  const route = resolveRoute({ hasSession: !!session, hasSeenTrustMoment, hasSeenDriverConsent, hasDisplayName });

  // The join-resume and active-Voyage decisions are layered on top of
  // resolveRoute()'s own 4-branch result, not folded into it -- resolveRoute()
  // stays a pure, directly-tested function (Story 1.4's real routing bug lived
  // in exactly this file, hence the extra care). These three `home`-scoped
  // blocks stay mutually exclusive by construction, same invariant
  // resolve-route.ts's own doc comment already documents for its 4 branches.
  // hasActiveVoyage takes precedence over hasPendingJoin: if the user already
  // has an active Voyage, that's the definitive state -- don't attempt a
  // stale/conflicting join on top of it (join_voyage() would reject it via
  // AD-9 anyway; landing straight on active-voyage is the cleaner experience).
  const hasActiveVoyage = !!activeVoyage;
  const hasPendingJoin = !hasActiveVoyage && !!pendingJoinCode;

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Protected guard={route === 'home' && hasActiveVoyage}>
        <Stack.Screen name="active-voyage" />
      </Stack.Protected>
      <Stack.Protected guard={route === 'home' && hasPendingJoin}>
        <Stack.Screen name="voyage-joined" />
      </Stack.Protected>
      <Stack.Protected guard={route === 'home' && !hasActiveVoyage && !hasPendingJoin}>
        <Stack.Screen name="index" />
        <Stack.Screen name="settings" />
      </Stack.Protected>
      <Stack.Protected guard={route === 'display-name'}>
        <Stack.Screen name="display-name" />
      </Stack.Protected>
      <Stack.Protected guard={route === 'driver-attention-consent'}>
        <Stack.Screen name="driver-attention-consent" />
      </Stack.Protected>
      <Stack.Protected guard={route === 'trust-moment'}>
        <Stack.Screen name="trust-moment" />
      </Stack.Protected>
      <Stack.Protected guard={route === 'sign-in'}>
        <Stack.Screen name="sign-in" />
      </Stack.Protected>
      {/* Reachable at any auth state (EXPERIENCE.md) -- a deep link to
          /join/<code> navigates straight here regardless of what
          resolveRoute() would otherwise resolve to. */}
      <Stack.Screen name="join/[code]" />
      {/* Unconditional, not gated on hasActiveVoyage, on purpose: end_voyage()
          success clears activeVoyage (via refetch), which would otherwise
          deregister this screen mid-transition if it lived inside the
          active-voyage guard branch above -- exactly the class of bug Story
          2.3's code review found in join/[code]'s original design. All summary
          data is passed as route params instead of read from context, so this
          screen never depends on activeVoyage still being populated. */}
      <Stack.Screen name="voyage-ended" />
    </Stack>
  );
}

function RootLayout() {
  const colorScheme = useColorScheme();
  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <AuthProvider>
        <ProfileProvider>
          <ActiveVoyageProvider>
            <PendingJoinProvider>
              <AppNavigator />
            </PendingJoinProvider>
          </ActiveVoyageProvider>
        </ProfileProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default Sentry.wrap(RootLayout);

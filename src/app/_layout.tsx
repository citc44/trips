// Side-effect import only, and deliberately first: registers the
// background location task (a module-scope TaskManager.defineTask() call)
// before anything else runs, matching Expo's own documented pattern for
// Expo Router projects -- the task must be defined before any navigation,
// not lazily whenever some screen happens to first reference it.
import '@/shared/lib/background-location-task';

import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { useColorScheme } from 'react-native';

import { initSentry, Sentry } from '@/lib/sentry';
import { ActiveVoyageProvider, useActiveVoyage } from '@/shared/hooks/use-active-voyage';
import { AuthProvider, useAuth } from '@/shared/hooks/use-auth';
import { LocationPermissionProvider, useLocationPermission } from '@/shared/hooks/use-location-permission';
import { PendingJoinProvider, usePendingJoin } from '@/shared/hooks/use-pending-join';
import { ProfileProvider, useProfile } from '@/shared/hooks/use-profile';
import { RemovalNoticeProvider, useRemovalNotice } from '@/shared/hooks/use-removal-notice';
import { resolveRoute } from '@/shared/navigation/resolve-route';

initSentry();
SplashScreen.preventAutoHideAsync();

function AppNavigator() {
  const { session, isLoading: isAuthLoading } = useAuth();
  const { profile, isLoading: isProfileLoading, hasError: profileHasError } = useProfile();
  const { pendingJoinCode } = usePendingJoin();
  const { activeVoyage, isLoading: isActiveVoyageLoading } = useActiveVoyage();
  const { removalNotice, isLoading: isRemovalNoticeLoading } = useRemovalNotice();
  const {
    status: locationPermissionStatus,
    hasCompletedPriming,
    isLoading: isLocationPermissionLoading,
  } = useLocationPermission();

  // Profile/active-Voyage/removal-notice/location-permission data only start
  // loading once a session exists (see use-profile.tsx/use-active-voyage.tsx/
  // use-removal-notice.tsx/use-location-permission.tsx), so only wait on them
  // while signed in -- an unauthenticated user would otherwise be stuck on
  // the splash screen forever.
  const isLoading =
    isAuthLoading || (!!session && (isProfileLoading || isActiveVoyageLoading || isRemovalNoticeLoading || isLocationPermissionLoading));

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

  // The join-resume, active-Voyage, removal-notice, and location-permission
  // decisions are layered on top of resolveRoute()'s own 5-branch result, not
  // folded into it -- resolveRoute() stays a pure, directly-tested function
  // (Story 1.4's real routing bug lived in exactly this file, hence the extra
  // care). These `home`-scoped blocks stay mutually exclusive by
  // construction, same invariant resolve-route.ts's own doc comment already
  // documents (needsLocationPermission is the one exception: it's a split
  // within hasActiveVoyage, not a sibling of it).
  // hasActiveVoyage takes precedence over hasRemovalNotice/hasPendingJoin --
  // deliberately, not just because a removed user's activeVoyage happens to
  // be null: that's only true until they join or start a *different* Voyage
  // before acknowledging the first removal. Once that happens, this
  // precedence intentionally keeps them on their new, currently-active trip
  // rather than interrupting it with a stale notice about a past one; the
  // notice reappears (get_removal_notice() still has it) as soon as they no
  // longer have an active Voyage. hasRemovalNotice takes precedence over
  // hasPendingJoin: a leftover pending join from before removal shouldn't
  // silently suppress showing the user what happened to their last Voyage.
  const hasActiveVoyage = !!activeVoyage;
  // Gates hasActiveVoyage's own active-voyage screen, not a fifth mutually
  // exclusive `home`-scoped concern of its own -- location-permission and
  // active-voyage are two faces of the same "there's an active Voyage" state.
  // Reads useLocationPermission()'s live OS status, not a cached/persisted
  // flag: once the OS has recorded any real decision (granted or denied),
  // `status` is no longer 'undetermined' and this naturally stops firing on
  // any later app session -- EXPERIENCE.md's "fires once per device" with no
  // extra app-side state (see use-location-permission.tsx's own comment).
  // `hasCompletedPriming` exists only to stop location-permission.tsx's own
  // in-flight permission-request calls (which change `status` mid-flow) from
  // prematurely flipping this guard away from itself before the flow (which
  // may still need to ask for background permission, or show the explainer)
  // has actually finished.
  const needsLocationPermission = hasActiveVoyage && locationPermissionStatus === 'undetermined' && !hasCompletedPriming;
  const hasRemovalNotice = !hasActiveVoyage && !!removalNotice;
  const hasPendingJoin = !hasActiveVoyage && !hasRemovalNotice && !!pendingJoinCode;

  return (
    <Stack screenOptions={{ headerShown: false }}>
      {/* Registered inside its own guard branch, same reasoning as
          voyage-removed below: the screen that clears the blocking
          condition (location-permission.tsx's own markPrimingComplete()
          call) IS the currently-focused, guarded screen itself. */}
      <Stack.Protected guard={route === 'home' && hasActiveVoyage && needsLocationPermission}>
        <Stack.Screen name="location-permission" />
      </Stack.Protected>
      <Stack.Protected guard={route === 'home' && hasActiveVoyage && !needsLocationPermission}>
        <Stack.Screen name="active-voyage" />
      </Stack.Protected>
      {/* Registered inside its own guard branch (unlike voyage-ended, which
          had to be unconditional) -- here the screen that clears the state
          (voyage-removed.tsx's own "Continue" button calling acknowledge())
          IS the currently-focused, guarded screen itself, the same "sign-in
          -> trust-moment" cascade shape that already works correctly, not
          the "a different screen clears state out from under this one"
          shape Story 2.3's code review found broken for join/[code]. */}
      <Stack.Protected guard={route === 'home' && hasRemovalNotice}>
        <Stack.Screen name="voyage-removed" />
      </Stack.Protected>
      <Stack.Protected guard={route === 'home' && hasPendingJoin}>
        <Stack.Screen name="voyage-joined" />
      </Stack.Protected>
      <Stack.Protected guard={route === 'home' && !hasActiveVoyage && !hasRemovalNotice && !hasPendingJoin}>
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
            <RemovalNoticeProvider>
              <LocationPermissionProvider>
                <PendingJoinProvider>
                  <AppNavigator />
                </PendingJoinProvider>
              </LocationPermissionProvider>
            </RemovalNoticeProvider>
          </ActiveVoyageProvider>
        </ProfileProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default Sentry.wrap(RootLayout);

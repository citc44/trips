// Side-effect import only, and deliberately first: registers the
// background location task (a module-scope TaskManager.defineTask() call)
// before anything else runs, matching Expo's own documented pattern for
// Expo Router projects -- the task must be defined before any navigation,
// not lazily whenever some screen happens to first reference it.
import '@/shared/lib/background-location-task';

import { useFonts } from 'expo-font';
import { DarkTheme, DefaultTheme, router, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useRef, useState } from 'react';
import { useColorScheme } from 'react-native';

import { initSentry, Sentry } from '@/lib/sentry';
import { ActiveVoyageProvider, useActiveVoyage } from '@/shared/hooks/use-active-voyage';
import { AuthProvider, useAuth } from '@/shared/hooks/use-auth';
import { JustStartedVoyageProvider, useJustStartedVoyage } from '@/shared/hooks/use-just-started-voyage';
import { LocationPermissionProvider, useLocationPermission } from '@/shared/hooks/use-location-permission';
import { PendingEntryTransitionProvider } from '@/shared/hooks/use-pending-entry-transition';
import { PendingJoinProvider, usePendingJoin } from '@/shared/hooks/use-pending-join';
import { ProfileProvider, useProfile } from '@/shared/hooks/use-profile';
import { useReduceMotion } from '@/shared/hooks/use-reduce-motion';
import { RemovalNoticeProvider, useRemovalNotice } from '@/shared/hooks/use-removal-notice';
import { resolveJustStartedVoyageExit } from '@/shared/navigation/resolve-just-started-voyage-exit';
import { resolveRoute } from '@/shared/navigation/resolve-route';
import { getStandardPushTransition } from '@/shared/navigation/standard-push-transition';
import { SplashThread } from '@/shared/components/splash-thread';

initSentry();
SplashScreen.preventAutoHideAsync();

// DESIGN.md's three-typeface system (Clash Display, General Sans, Space
// Mono) -- deferred since Story 1.2/1.4 first set these fontFamily values
// in design-tokens.ts: the names were wired into every screen's styles, but
// no font FILES were ever added to the project and no useFonts() call ever
// loaded them, so every screen has been silently falling back to the OS
// default font this whole time (Fontshare's own EULA is free for personal
// and commercial use for both faces; Space Mono is a Google Font, SIL OFL --
// license copies live alongside the files in assets/fonts/).
//
// Weight-specific family names, not `fontFamily` + `fontWeight`: React
// Native does not synthesize a "family + numeric weight" combination into a
// loaded custom font variant the way CSS can -- each weight has to be
// registered and referenced under its own literal family name, or the OS
// falls back to faux (synthetic) bolding on whichever single weight did
// load. See design-tokens.ts's Typography block and every screen's own
// per-usage fontFamily overrides for how these exact keys get referenced.
const FONT_ASSETS = {
  'ClashDisplay-Semibold': require('@/assets/fonts/ClashDisplay-Semibold.otf'),
  'ClashDisplay-Bold': require('@/assets/fonts/ClashDisplay-Bold.otf'),
  'GeneralSans-Regular': require('@/assets/fonts/GeneralSans-Regular.otf'),
  'GeneralSans-Semibold': require('@/assets/fonts/GeneralSans-Semibold.otf'),
  'GeneralSans-Bold': require('@/assets/fonts/GeneralSans-Bold.otf'),
  'GeneralSans-Italic': require('@/assets/fonts/GeneralSans-Italic.otf'),
  'SpaceMono-Regular': require('@/assets/fonts/SpaceMono-Regular.ttf'),
  'SpaceMono-Bold': require('@/assets/fonts/SpaceMono-Bold.ttf'),
};

function AppNavigator() {
  const { session, isLoading: isAuthLoading } = useAuth();
  const { profile, isLoading: isProfileLoading, hasError: profileHasError } = useProfile();
  const { pendingJoinCode } = usePendingJoin();
  const { hasJustStartedVoyage } = useJustStartedVoyage();
  const { activeVoyage, isLoading: isActiveVoyageLoading } = useActiveVoyage();
  const { removalNotice, isLoading: isRemovalNoticeLoading } = useRemovalNotice();
  const {
    status: locationPermissionStatus,
    hasCompletedPriming,
    isLoading: isLocationPermissionLoading,
  } = useLocationPermission();
  const { reduceMotion, resolved: reduceMotionResolved } = useReduceMotion();
  const [fontsLoaded, fontError] = useFonts(FONT_ASSETS);

  // User-reported "major defect": tapping Continue on join-code.tsx landed
  // back on destination-picker.tsx instead of the live map. See
  // resolve-just-started-voyage-exit.ts for the full root-cause writeup and
  // why this can't rely on Stack.Protected's own guard-flip auto-redirect
  // the way the onboarding cascade does.
  const wasJustStartedVoyageRef = useRef(hasJustStartedVoyage);
  useEffect(() => {
    const wasJustStarted = wasJustStartedVoyageRef.current;
    wasJustStartedVoyageRef.current = hasJustStartedVoyage;

    const exitRoute = resolveJustStartedVoyageExit({
      wasJustStarted,
      hasJustStartedVoyage,
      hasActiveVoyage: !!activeVoyage,
      needsLocationPermission: locationPermissionStatus === 'undetermined' && !hasCompletedPriming,
    });
    if (exitRoute) router.replace(exitRoute);
  }, [hasJustStartedVoyage, activeVoyage, locationPermissionStatus, hasCompletedPriming]);

  // Profile/active-Voyage/removal-notice/location-permission data only start
  // loading once a session exists (see use-profile.tsx/use-active-voyage.tsx/
  // use-removal-notice.tsx/use-location-permission.tsx), so only wait on them
  // while signed in -- an unauthenticated user would otherwise be stuck on
  // the splash screen forever. Fonts have no such dependency -- always
  // waited on, regardless of auth state, so no screen (including sign-in
  // itself) ever renders a frame in the OS-default fallback font. A load
  // error (e.g. a corrupt font file) fails open -- proceeds with whatever
  // fonts DID load rather than stranding the whole app on the splash screen
  // forever over a typography-only failure.
  const isLoading =
    (!fontsLoaded && !fontError) ||
    isAuthLoading ||
    (!!session && (isProfileLoading || isActiveVoyageLoading || isRemovalNoticeLoading || isLocationPermissionLoading));

  // EXPERIENCE.md "Splash Screen ('The Thread')": plays once, every cold
  // launch, right after the native (OS-drawn) splash hides -- native splash
  // covers the isLoading window above, this custom animated one bridges from
  // there to the resolved route. `hasPlayedSplash` naturally resets to false
  // on every fresh mount of this component (i.e. every cold launch), so no
  // extra "have I shown this before" bookkeeping is needed.
  const [hasPlayedSplash, setHasPlayedSplash] = useState(false);

  useEffect(() => {
    if (!isLoading) {
      SplashScreen.hideAsync();
    }
  }, [isLoading]);

  if (isLoading) {
    return null;
  }

  if (!hasPlayedSplash) {
    return <SplashThread onComplete={() => setHasPlayedSplash(true)} />;
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

  // Story 4.4 Task 11's "Standard push" transition -- see
  // standard-push-transition.ts for the full rationale (extracted so it's
  // unit-testable without rendering Stack/expo-router, same reasoning
  // resolve-route.ts already established) and for which 8 screens this
  // applies to vs. every other screen's unaffected default transition.
  //
  // Code review finding: treat "not yet resolved" the same as "Reduce
  // Motion is on" -- reduceMotion alone defaults to false until
  // useReduceMotion()'s async check lands, which could otherwise let the
  // very first screen transition after a cold start animate even for a
  // Reduce-Motion user.
  const standardPushTransition = getStandardPushTransition(!reduceMotionResolved || reduceMotion);

  return (
    <Stack screenOptions={{ headerShown: false }}>
      {/* Registered inside its own guard branch, same reasoning as
          voyage-removed below: the screen that clears the blocking
          condition (location-permission.tsx's own markPrimingComplete()
          call) IS the currently-focused, guarded screen itself. */}
      <Stack.Protected guard={route === 'home' && hasActiveVoyage && needsLocationPermission}>
        <Stack.Screen name="location-permission" />
      </Stack.Protected>
      {/* Story 4.3: the Organizer's "cut to gameplay" entry point. Mirrors
          voyage-joined.tsx's own working eviction-redirect pattern below --
          join-code.tsx is Stack.Protected on hasJustStartedVoyage (set by
          destination-picker.tsx right before it pushes here, cleared by
          join-code.tsx's own Continue button) instead of relying on
          router.back(), which used to land back on the still-mounted
          destination-picker.tsx screen instead of Live Map (neither screen
          was Stack.Protected, so nothing evicted destination-picker.tsx
          once a Voyage existed). Declared before active-voyage's own guard
          below, and active-voyage's guard excludes this flag, so the two
          stay mutually exclusive by construction -- same invariant this
          file's own comments already call out for needsLocationPermission. */}
      <Stack.Protected guard={route === 'home' && hasActiveVoyage && !needsLocationPermission && hasJustStartedVoyage}>
        <Stack.Screen name="join-code" />
      </Stack.Protected>
      <Stack.Protected guard={route === 'home' && hasActiveVoyage && !needsLocationPermission && !hasJustStartedVoyage}>
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
        <Stack.Screen name="index" options={standardPushTransition} />
        <Stack.Screen name="settings" />
      </Stack.Protected>
      <Stack.Protected guard={route === 'display-name'}>
        <Stack.Screen name="display-name" />
      </Stack.Protected>
      <Stack.Protected guard={route === 'driver-attention-consent'}>
        <Stack.Screen name="driver-attention-consent" options={standardPushTransition} />
      </Stack.Protected>
      <Stack.Protected guard={route === 'trust-moment'}>
        <Stack.Screen name="trust-moment" options={standardPushTransition} />
      </Stack.Protected>
      <Stack.Protected guard={route === 'sign-in'}>
        <Stack.Screen name="sign-in" options={standardPushTransition} />
      </Stack.Protected>
      {/* voyage-intro/destination-picker weren't previously declared as
          explicit Stack.Screen entries anywhere in this file -- Expo Router
          auto-registered them from the filesystem, unconditionally, with
          default options. Declared explicitly now, still unconditionally
          (not nested inside any guard), solely to attach this story's
          transition options -- no reachability change from their prior
          always-available auto-registered state. */}
      <Stack.Screen name="voyage-intro" options={standardPushTransition} />
      <Stack.Screen name="destination-picker" options={standardPushTransition} />
      {/* Reachable at any auth state (EXPERIENCE.md) -- a deep link to
          /join/<code> navigates straight here regardless of what
          resolveRoute() would otherwise resolve to. */}
      <Stack.Screen name="join/[code]" options={standardPushTransition} />
      {/* Same reachability as join/[code] above, same reason: someone with a
          code but no link to tap needs a way in regardless of auth state --
          it just collects the code here, then hands off to join/[code] for
          everything else. */}
      <Stack.Screen name="join/index" />
      {/* Unconditional, not gated on hasActiveVoyage, on purpose: end_voyage()
          success clears activeVoyage (via refetch), which would otherwise
          deregister this screen mid-transition if it lived inside the
          active-voyage guard branch above -- exactly the class of bug Story
          2.3's code review found in join/[code]'s original design. All summary
          data is passed as route params instead of read from context, so this
          screen never depends on activeVoyage still being populated. */}
      <Stack.Screen name="voyage-ended" options={standardPushTransition} />
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
                  <JustStartedVoyageProvider>
                    <PendingEntryTransitionProvider>
                      <AppNavigator />
                    </PendingEntryTransitionProvider>
                  </JustStartedVoyageProvider>
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

/**
 * Pure decision logic behind _layout.tsx's explicit post-Continue
 * navigation, extracted so it can be unit tested directly without
 * rendering Stack/expo-router at all -- same reasoning resolve-route.ts
 * and standard-push-transition.ts already established.
 *
 * Confirmed production bug this exists to fix: join-code.tsx is reached
 * via an explicit router.push() from destination-picker.tsx, not a pure
 * guard-swap the way the onboarding cascade (sign-in -> trust-moment ->
 * ...) is. When join-code's own Stack.Protected guard flips false
 * (Continue tapped, clearing hasJustStartedVoyage), the underlying native
 * stack doesn't reliably jump forward to whichever *other* guard just
 * became true (active-voyage.tsx) -- it falls back to whatever's still
 * sitting underneath it in that *push* history instead, landing back on
 * destination-picker.tsx. Stack.Protected's guard-flip auto-redirect only
 * reliably resolves forward for screens that were never pushed in the
 * first place.
 *
 * Returns the route to explicitly navigate to, or null if this isn't the
 * true -> false transition this exists to react to (or there's nothing to
 * transition into yet).
 */
export function resolveJustStartedVoyageExit({
  wasJustStarted,
  hasJustStartedVoyage,
  hasActiveVoyage,
  needsLocationPermission,
}: {
  wasJustStarted: boolean;
  hasJustStartedVoyage: boolean;
  hasActiveVoyage: boolean;
  needsLocationPermission: boolean;
}): '/active-voyage' | '/location-permission' | null {
  if (!wasJustStarted || hasJustStartedVoyage || !hasActiveVoyage) return null;
  return needsLocationPermission ? '/location-permission' : '/active-voyage';
}

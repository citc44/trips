/**
 * Resolves the explicit navigation that must follow a pending-join
 * transition. The join resolver is reached through a pushed/replaced route,
 * so relying on Stack.Protected to evict it can reveal an older route from
 * native-stack history instead of moving forward to the newly-active map.
 *
 * Returning Home when there is no active Voyage is the cancellation path.
 * A successful join only clears the pending code after ActiveVoyageProvider
 * has confirmed the joined Voyage, so its exit always resolves to permission
 * priming or Live Map.
 */
export function resolvePendingJoinExit({
  previousPendingJoinCode,
  pendingJoinCode,
  hasSession,
  hasActiveVoyage,
  needsLocationPermission,
}: {
  previousPendingJoinCode: string | null;
  pendingJoinCode: string | null;
  hasSession: boolean;
  hasActiveVoyage: boolean;
  needsLocationPermission: boolean;
}): '/' | '/active-voyage' | '/location-permission' | null {
  if (!previousPendingJoinCode || pendingJoinCode || !hasSession) return null;
  if (!hasActiveVoyage) return '/';
  return needsLocationPermission ? '/location-permission' : '/active-voyage';
}

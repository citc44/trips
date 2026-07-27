export type AppRoute = 'sign-in' | 'trust-moment' | 'driver-attention-consent' | 'display-name' | 'home';

/**
 * Pure decision logic behind _layout.tsx's Stack.Protected guards, extracted so it
 * can be unit tested directly without rendering Stack/expo-router at all. This is
 * exactly the layer Story 1.4's real, confirmed bug lived in (a stale isLoading
 * value let the wrong screen open for a frame) -- keeping the decision itself pure
 * and tested closes that whole class of routing bug, not just the one instance
 * already fixed (code review finding).
 *
 * The five cases are mutually exclusive and exhaustive by construction: exactly one
 * ever matches for a given input, so the order Stack.Protected blocks appear in JSX
 * is inert -- only one block's screens are ever registered at a time regardless of
 * position.
 *
 * `hasDisplayName` (Story 2.5) governs the same kind of once-ever, account-level
 * onboarding gate as `hasSeenTrustMoment`/`hasSeenDriverConsent` -- unlike
 * `pendingJoinCode`/`activeVoyage` (Stories 2.3/2.4), which are session-scoped UI
 * state deliberately layered on top of this function's `'home'` result in
 * _layout.tsx rather than folded in here. Keep that distinction in mind before
 * adding a new input: does it gate every session forever until acknowledged
 * (belongs here), or is it a per-session navigation concern (belongs in
 * AppNavigator instead)?
 */
export function resolveRoute({
  hasSession,
  hasSeenTrustMoment,
  hasSeenDriverConsent,
  hasDisplayName,
}: {
  hasSession: boolean;
  hasSeenTrustMoment: boolean;
  hasSeenDriverConsent: boolean;
  hasDisplayName: boolean;
}): AppRoute {
  if (!hasSession) return 'sign-in';
  if (!hasSeenTrustMoment) return 'trust-moment';
  if (!hasSeenDriverConsent) return 'driver-attention-consent';
  if (!hasDisplayName) return 'display-name';
  return 'home';
}

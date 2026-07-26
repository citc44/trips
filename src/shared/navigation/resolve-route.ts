export type AppRoute = 'sign-in' | 'trust-moment' | 'driver-attention-consent' | 'home';

/**
 * Pure decision logic behind _layout.tsx's Stack.Protected guards, extracted so it
 * can be unit tested directly without rendering Stack/expo-router at all. This is
 * exactly the layer Story 1.4's real, confirmed bug lived in (a stale isLoading
 * value let the wrong screen open for a frame) -- keeping the decision itself pure
 * and tested closes that whole class of routing bug, not just the one instance
 * already fixed (code review finding).
 *
 * The four cases are mutually exclusive and exhaustive by construction: exactly one
 * ever matches for a given input, so the order Stack.Protected blocks appear in JSX
 * is inert -- only one block's screens are ever registered at a time regardless of
 * position.
 */
export function resolveRoute({
  hasSession,
  hasSeenTrustMoment,
  hasSeenDriverConsent,
}: {
  hasSession: boolean;
  hasSeenTrustMoment: boolean;
  hasSeenDriverConsent: boolean;
}): AppRoute {
  if (!hasSession) return 'sign-in';
  if (!hasSeenTrustMoment) return 'trust-moment';
  if (!hasSeenDriverConsent) return 'driver-attention-consent';
  return 'home';
}

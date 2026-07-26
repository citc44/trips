import { expect, test } from '@jest/globals';

import { resolveRoute } from '@/shared/navigation/resolve-route';

test('routes to sign-in when there is no session, regardless of onboarding flags', () => {
  expect(resolveRoute({ hasSession: false, hasSeenTrustMoment: false, hasSeenDriverConsent: false })).toBe('sign-in');
  expect(resolveRoute({ hasSession: false, hasSeenTrustMoment: true, hasSeenDriverConsent: true })).toBe('sign-in');
});

test('routes to trust-moment when signed in but Trust Moment not yet seen', () => {
  expect(resolveRoute({ hasSession: true, hasSeenTrustMoment: false, hasSeenDriverConsent: false })).toBe('trust-moment');
  expect(resolveRoute({ hasSession: true, hasSeenTrustMoment: false, hasSeenDriverConsent: true })).toBe('trust-moment');
});

test('routes to driver-attention-consent when Trust Moment is seen but Driver Consent is not (AC #4: mid-onboarding account)', () => {
  expect(resolveRoute({ hasSession: true, hasSeenTrustMoment: true, hasSeenDriverConsent: false })).toBe('driver-attention-consent');
});

test('routes to home once both onboarding flags are seen', () => {
  expect(resolveRoute({ hasSession: true, hasSeenTrustMoment: true, hasSeenDriverConsent: true })).toBe('home');
});

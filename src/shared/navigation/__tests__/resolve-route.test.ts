import { expect, test } from '@jest/globals';

import { resolveRoute } from '@/shared/navigation/resolve-route';

test('routes to sign-in when there is no session, regardless of onboarding flags', () => {
  expect(resolveRoute({ hasSession: false, hasSeenTrustMoment: false, hasSeenDriverConsent: false, hasDisplayName: false })).toBe(
    'sign-in',
  );
  expect(resolveRoute({ hasSession: false, hasSeenTrustMoment: true, hasSeenDriverConsent: true, hasDisplayName: true })).toBe(
    'sign-in',
  );
});

test('routes to trust-moment when signed in but Trust Moment not yet seen', () => {
  expect(resolveRoute({ hasSession: true, hasSeenTrustMoment: false, hasSeenDriverConsent: false, hasDisplayName: false })).toBe(
    'trust-moment',
  );
  expect(resolveRoute({ hasSession: true, hasSeenTrustMoment: false, hasSeenDriverConsent: true, hasDisplayName: true })).toBe(
    'trust-moment',
  );
});

test('routes to driver-attention-consent when Trust Moment is seen but Driver Consent is not (AC #4: mid-onboarding account)', () => {
  expect(resolveRoute({ hasSession: true, hasSeenTrustMoment: true, hasSeenDriverConsent: false, hasDisplayName: false })).toBe(
    'driver-attention-consent',
  );
  expect(resolveRoute({ hasSession: true, hasSeenTrustMoment: true, hasSeenDriverConsent: false, hasDisplayName: true })).toBe(
    'driver-attention-consent',
  );
});

test('routes to display-name when Trust Moment and Driver Consent are seen but the display name is not set (Story 2.5)', () => {
  expect(resolveRoute({ hasSession: true, hasSeenTrustMoment: true, hasSeenDriverConsent: true, hasDisplayName: false })).toBe(
    'display-name',
  );
});

test('routes to home once all three onboarding flags are set', () => {
  expect(resolveRoute({ hasSession: true, hasSeenTrustMoment: true, hasSeenDriverConsent: true, hasDisplayName: true })).toBe('home');
});

import { expect, test } from '@jest/globals';

import { getStandardPushTransition, STANDARD_PUSH_SCREENS } from '../standard-push-transition';

test('fires slide_from_right by default', () => {
  expect(getStandardPushTransition(false)).toEqual({ animation: 'slide_from_right' });
});

test('is disabled under Reduce Motion -- screens change instantly, no slide or fade', () => {
  expect(getStandardPushTransition(true)).toEqual({ animation: 'none' });
});

test('applies to exactly this story\'s 8 re-skinned screens', () => {
  expect(STANDARD_PUSH_SCREENS).toEqual([
    'sign-in',
    'trust-moment',
    'driver-attention-consent',
    'index',
    'voyage-intro',
    'destination-picker',
    'join/[code]',
    'voyage-ended',
  ]);
});

test('does not fire for screens outside this story\'s scope', () => {
  const outOfScope = [
    'active-voyage',
    'join-code',
    'voyage-joined',
    'location-permission',
    'settings',
    'voyage-removed',
    'display-name',
    'join/index',
  ];

  for (const screen of outOfScope) {
    expect(STANDARD_PUSH_SCREENS).not.toContain(screen);
  }
});

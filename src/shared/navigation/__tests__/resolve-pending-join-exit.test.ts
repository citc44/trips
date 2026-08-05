import { expect, test } from '@jest/globals';

import { resolvePendingJoinExit } from '@/shared/navigation/resolve-pending-join-exit';

const base = {
  previousPendingJoinCode: 'ABCD2345',
  pendingJoinCode: null,
  hasSession: true,
  hasActiveVoyage: true,
  needsLocationPermission: false,
};

test('replaces into Live Map after a pending join clears with an active Voyage', () => {
  expect(resolvePendingJoinExit(base)).toBe('/active-voyage');
});

test('replaces into location priming when permission is still required', () => {
  expect(resolvePendingJoinExit({ ...base, needsLocationPermission: true })).toBe('/location-permission');
});

test('replaces Home when a cancelled pending join clears without an active Voyage', () => {
  expect(resolvePendingJoinExit({ ...base, hasActiveVoyage: false })).toBe('/');
});

test('does nothing while a pending join still exists or merely changes code', () => {
  expect(resolvePendingJoinExit({ ...base, pendingJoinCode: 'ABCD2345' })).toBeNull();
  expect(resolvePendingJoinExit({ ...base, pendingJoinCode: 'WXYZ6789' })).toBeNull();
});

test('does nothing without a real non-null to null transition', () => {
  expect(resolvePendingJoinExit({ ...base, previousPendingJoinCode: null })).toBeNull();
});

test('does not navigate after sign-out clears pending state', () => {
  expect(resolvePendingJoinExit({ ...base, hasSession: false })).toBeNull();
});

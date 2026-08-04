import { expect, test } from '@jest/globals';

import { resolveJustStartedVoyageExit } from '../resolve-just-started-voyage-exit';

test('resolves to /active-voyage on the true -> false transition, with an active Voyage and no outstanding location permission', () => {
  expect(
    resolveJustStartedVoyageExit({
      wasJustStarted: true,
      hasJustStartedVoyage: false,
      hasActiveVoyage: true,
      needsLocationPermission: false,
    }),
  ).toBe('/active-voyage');
});

test('resolves to /location-permission instead, when that is still outstanding', () => {
  expect(
    resolveJustStartedVoyageExit({
      wasJustStarted: true,
      hasJustStartedVoyage: false,
      hasActiveVoyage: true,
      needsLocationPermission: true,
    }),
  ).toBe('/location-permission');
});

test('does nothing if this was not a true -> false transition (e.g. still false, or already false last render)', () => {
  expect(
    resolveJustStartedVoyageExit({
      wasJustStarted: false,
      hasJustStartedVoyage: false,
      hasActiveVoyage: true,
      needsLocationPermission: false,
    }),
  ).toBeNull();
});

test('does nothing while still true (not yet cleared)', () => {
  expect(
    resolveJustStartedVoyageExit({
      wasJustStarted: true,
      hasJustStartedVoyage: true,
      hasActiveVoyage: true,
      needsLocationPermission: false,
    }),
  ).toBeNull();
});

test('does nothing if there is no active Voyage yet (activeVoyage refetch has not landed)', () => {
  expect(
    resolveJustStartedVoyageExit({
      wasJustStarted: true,
      hasJustStartedVoyage: false,
      hasActiveVoyage: false,
      needsLocationPermission: false,
    }),
  ).toBeNull();
});

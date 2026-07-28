import { expect, jest, test } from '@jest/globals';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { Text, View } from 'react-native';

import { LocationPermissionProvider, useLocationPermission } from '@/shared/hooks/use-location-permission';

import LocationPermissionScreen from '../location-permission';

// Integration regression test (code review finding): the real provider and
// the real screen, together -- not the mocked-hook unit tests elsewhere in
// this suite. Reproduces the exact hazard a mocked-hook test structurally
// cannot see: does `status` (which _layout.tsx's own routing guard reads)
// ever resolve out of 'undetermined' while `hasCompletedPriming` is still
// false and the Explainer hasn't rendered yet? If so, a real Stack.Protected
// guard would unmount this screen before the user ever saw the Explainer.

jest.mock('@/shared/hooks/use-auth', () => ({
  useAuth: () => ({ session: { user: { id: 'user-1' } } }),
}));

const mockRequestForegroundPermissionsAsync = jest.fn<(...args: any[]) => Promise<any>>();
const mockRequestBackgroundPermissionsAsync = jest.fn<(...args: any[]) => Promise<any>>();
// The mount fetch resolves 'undetermined' once; any later getForegroundPermissionsAsync()
// call (i.e. from refetch()) resolves 'denied', matching what the OS would
// actually report after requestForegroundPermissionsAsync() is declined.
const mockGetForegroundPermissionsAsync = jest
  .fn<(...args: any[]) => Promise<any>>()
  .mockResolvedValueOnce({ status: 'undetermined' })
  .mockResolvedValue({ status: 'denied' });
jest.mock('expo-location', () => ({
  PermissionStatus: { GRANTED: 'granted', DENIED: 'denied', UNDETERMINED: 'undetermined' },
  getForegroundPermissionsAsync: (...args: unknown[]) => mockGetForegroundPermissionsAsync(...args),
  requestForegroundPermissionsAsync: (...args: unknown[]) => mockRequestForegroundPermissionsAsync(...args),
  getBackgroundPermissionsAsync: jest.fn(),
  requestBackgroundPermissionsAsync: (...args: unknown[]) => mockRequestBackgroundPermissionsAsync(...args),
}));

const guardObservations: { status: string; hasCompletedPriming: boolean; needsLocationPermission: boolean }[] = [];

// Mirrors _layout.tsx's own `needsLocationPermission` expression exactly
// (with hasActiveVoyage hardcoded true, since that half isn't this test's
// concern) -- records every value it takes on, in render order.
function GuardProbe() {
  const { status, hasCompletedPriming } = useLocationPermission();
  const needsLocationPermission = status === 'undetermined' && !hasCompletedPriming;
  guardObservations.push({ status, hasCompletedPriming, needsLocationPermission });
  return <Text testID="guard-probe">{needsLocationPermission ? 'showing-screen' : 'would-evict'}</Text>;
}

test('the routing guard never evicts before the Explainer is shown, for a foreground denial', async () => {
  guardObservations.length = 0;
  mockRequestForegroundPermissionsAsync.mockResolvedValue({ status: 'denied', granted: false, canAskAgain: false });

  const { getByTestId } = await render(
    <LocationPermissionProvider>
      <View>
        <GuardProbe />
        <LocationPermissionScreen />
      </View>
    </LocationPermissionProvider>,
  );

  await waitFor(() => expect(getByTestId('guard-probe').props.children).toBe('showing-screen'));

  await act(async () => {
    fireEvent.press(getByTestId('location-permission-allow-button'));
  });

  // The Explainer must actually be showing by now.
  await waitFor(() => expect(getByTestId('location-permission-open-settings-button')).toBeTruthy());

  // The critical assertion: at no point before the user dismisses the
  // Explainer did the guard read 'would-evict'. If this fails, a real
  // Stack.Protected guard would have unmounted the screen mid-flow.
  for (const observation of guardObservations) {
    expect(observation.needsLocationPermission).toBe(true);
  }

  // Only after the user acts on the Explainer is it safe for the guard to
  // flip -- verify it still can (hasCompletedPriming does its job).
  await act(async () => {
    fireEvent.press(getByTestId('location-permission-continue-anyway-button'));
  });
  await waitFor(() => expect(getByTestId('guard-probe').props.children).toBe('would-evict'));
});

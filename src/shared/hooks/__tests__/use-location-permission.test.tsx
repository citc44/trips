import { beforeEach, expect, jest, test } from '@jest/globals';
import { act, render, waitFor } from '@testing-library/react-native';
import { Text } from 'react-native';

import { LocationPermissionProvider, useLocationPermission } from '@/shared/hooks/use-location-permission';

const mockUseAuth = jest.fn<(...args: any[]) => any>();
jest.mock('@/shared/hooks/use-auth', () => ({
  useAuth: () => mockUseAuth(),
}));

const mockGetForegroundPermissionsAsync = jest.fn<(...args: any[]) => Promise<any>>();
jest.mock('expo-location', () => ({
  PermissionStatus: { GRANTED: 'granted', DENIED: 'denied', UNDETERMINED: 'undetermined' },
  getForegroundPermissionsAsync: (...args: unknown[]) => mockGetForegroundPermissionsAsync(...args),
  requestForegroundPermissionsAsync: jest.fn(),
  getBackgroundPermissionsAsync: jest.fn(),
  requestBackgroundPermissionsAsync: jest.fn(),
}));

function Probe() {
  const { status, isLoading, hasError, hasCompletedPriming } = useLocationPermission();
  return <Text testID="probe">{isLoading ? 'loading' : hasError ? 'error' : `${status}:${hasCompletedPriming}`}</Text>;
}

function MarkCompleteProbe() {
  const { markPrimingComplete } = useLocationPermission();
  return <Text testID="mark-complete" onPress={() => markPrimingComplete()} />;
}

function RefetchProbe() {
  const { refetch } = useLocationPermission();
  return <Text testID="refetch" onPress={() => refetch()} />;
}

beforeEach(() => {
  jest.clearAllMocks();
});

test('resolves to undetermined (not loading) when there is no session, without calling the native API', async () => {
  mockUseAuth.mockReturnValue({ session: null });

  const { getByTestId } = await render(
    <LocationPermissionProvider>
      <Probe />
    </LocationPermissionProvider>,
  );

  await waitFor(() => expect(getByTestId('probe').props.children).toBe('undetermined:false'));
  expect(mockGetForegroundPermissionsAsync).not.toHaveBeenCalled();
});

test('fetches and exposes the live OS permission status when a session exists', async () => {
  mockUseAuth.mockReturnValue({ session: { user: { id: 'user-1' } } });
  mockGetForegroundPermissionsAsync.mockResolvedValue({ status: 'granted', granted: true, canAskAgain: true });

  const { getByTestId } = await render(
    <LocationPermissionProvider>
      <Probe />
    </LocationPermissionProvider>,
  );

  await waitFor(() => expect(getByTestId('probe').props.children).toBe('granted:false'));
});

test('exposes denied status as-is (not mapped to undetermined)', async () => {
  mockUseAuth.mockReturnValue({ session: { user: { id: 'user-1' } } });
  mockGetForegroundPermissionsAsync.mockResolvedValue({ status: 'denied', granted: false, canAskAgain: false });

  const { getByTestId } = await render(
    <LocationPermissionProvider>
      <Probe />
    </LocationPermissionProvider>,
  );

  await waitFor(() => expect(getByTestId('probe').props.children).toBe('denied:false'));
});

test('exposes hasError (not stuck loading) when the native call rejects', async () => {
  mockUseAuth.mockReturnValue({ session: { user: { id: 'user-1' } } });
  mockGetForegroundPermissionsAsync.mockRejectedValue(new Error('native module error'));

  const { getByTestId } = await render(
    <LocationPermissionProvider>
      <Probe />
    </LocationPermissionProvider>,
  );

  await waitFor(() => expect(getByTestId('probe').props.children).toBe('error'));
});

test('markPrimingComplete flips hasCompletedPriming without touching status', async () => {
  mockUseAuth.mockReturnValue({ session: { user: { id: 'user-1' } } });
  mockGetForegroundPermissionsAsync.mockResolvedValue({ status: 'undetermined', granted: false, canAskAgain: true });

  const { getByTestId } = await render(
    <LocationPermissionProvider>
      <MarkCompleteProbe />
      <Probe />
    </LocationPermissionProvider>,
  );

  await waitFor(() => expect(getByTestId('probe').props.children).toBe('undetermined:false'));

  await act(async () => {
    getByTestId('mark-complete').props.onPress();
  });

  await waitFor(() => expect(getByTestId('probe').props.children).toBe('undetermined:true'));
});

test('refetch re-queries the live OS status and updates it', async () => {
  mockUseAuth.mockReturnValue({ session: { user: { id: 'user-1' } } });
  mockGetForegroundPermissionsAsync.mockResolvedValueOnce({ status: 'undetermined', granted: false, canAskAgain: true });

  const { getByTestId } = await render(
    <LocationPermissionProvider>
      <RefetchProbe />
      <Probe />
    </LocationPermissionProvider>,
  );

  await waitFor(() => expect(getByTestId('probe').props.children).toBe('undetermined:false'));

  mockGetForegroundPermissionsAsync.mockResolvedValueOnce({ status: 'granted', granted: true, canAskAgain: true });
  await act(async () => {
    await getByTestId('refetch').props.onPress();
  });

  await waitFor(() => expect(getByTestId('probe').props.children).toBe('granted:false'));
});

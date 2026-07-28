import { beforeEach, expect, jest, test } from '@jest/globals';
import { act, render } from '@testing-library/react-native';
import { Text } from 'react-native';

import { useLocationTracking } from '@/shared/hooks/use-location-tracking';
import { useAuth } from '@/shared/hooks/use-auth';
import { useLocationPermission } from '@/shared/hooks/use-location-permission';

const mockStartLocationUpdatesAsync = jest.fn<(...args: any[]) => Promise<any>>();
const mockStopLocationUpdatesAsync = jest.fn<(...args: any[]) => Promise<any>>();
jest.mock('expo-location', () => ({
  Accuracy: { Balanced: 3 },
  startLocationUpdatesAsync: (...args: unknown[]) => mockStartLocationUpdatesAsync(...args),
  stopLocationUpdatesAsync: (...args: unknown[]) => mockStopLocationUpdatesAsync(...args),
}));

const mockSetBackgroundLocationContext = jest.fn();
jest.mock('@/shared/lib/background-location-task', () => ({
  BACKGROUND_LOCATION_TASK: 'voylo-background-location',
  setBackgroundLocationContext: (...args: unknown[]) => mockSetBackgroundLocationContext(...args),
}));

jest.mock('@/shared/hooks/use-auth', () => ({ useAuth: jest.fn() }));
jest.mock('@/shared/hooks/use-location-permission', () => ({ useLocationPermission: jest.fn() }));

const mockUseAuth = useAuth as jest.MockedFunction<typeof useAuth>;
const mockUseLocationPermission = useLocationPermission as jest.MockedFunction<typeof useLocationPermission>;

function Harness({ voyageId }: { voyageId: string | null }) {
  useLocationTracking(voyageId);
  return <Text testID="harness" />;
}

beforeEach(() => {
  jest.clearAllMocks();
  mockUseAuth.mockReturnValue({
    session: { user: { id: 'user-1' } } as any,
    isLoading: false,
    signInWithEmail: jest.fn<(...args: any[]) => Promise<any>>(),
    verifyCode: jest.fn<(...args: any[]) => Promise<any>>(),
    signOut: jest.fn<(...args: any[]) => Promise<any>>(),
  });
  mockUseLocationPermission.mockReturnValue({
    status: 'granted',
    isLoading: false,
    hasError: false,
    refetch: jest.fn<() => Promise<void>>(),
    hasCompletedPriming: true,
    markPrimingComplete: jest.fn(),
  });
  mockStartLocationUpdatesAsync.mockResolvedValue(undefined);
  mockStopLocationUpdatesAsync.mockResolvedValue(undefined);
});

test('does not start tracking when permission is not granted', async () => {
  mockUseLocationPermission.mockReturnValue({
    status: 'undetermined',
    isLoading: false,
    hasError: false,
    refetch: jest.fn<() => Promise<void>>(),
    hasCompletedPriming: false,
    markPrimingComplete: jest.fn(),
  });

  await render(<Harness voyageId="voyage-1" />);

  expect(mockStartLocationUpdatesAsync).not.toHaveBeenCalled();
  expect(mockSetBackgroundLocationContext).not.toHaveBeenCalled();
});

test('does not start tracking with no voyageId', async () => {
  await render(<Harness voyageId={null} />);

  expect(mockStartLocationUpdatesAsync).not.toHaveBeenCalled();
});

test('sets the background task context and starts background-capable tracking with the documented 5s/20m interval', async () => {
  await render(<Harness voyageId="voyage-1" />);

  expect(mockSetBackgroundLocationContext).toHaveBeenCalledWith({ voyageId: 'voyage-1', userId: 'user-1' });
  expect(mockStartLocationUpdatesAsync).toHaveBeenCalledWith(
    'voylo-background-location',
    expect.objectContaining({ accuracy: 3, timeInterval: 5000, distanceInterval: 20 }),
  );
});

test('supplies the required Android foreground-service notification title and body', async () => {
  await render(<Harness voyageId="voyage-1" />);

  const options = mockStartLocationUpdatesAsync.mock.calls[0][1] as { foregroundService: { notificationTitle: string; notificationBody: string } };
  expect(options.foregroundService.notificationTitle).toEqual(expect.any(String));
  expect(options.foregroundService.notificationTitle.length).toBeGreaterThan(0);
  expect(options.foregroundService.notificationBody).toEqual(expect.any(String));
  expect(options.foregroundService.notificationBody.length).toBeGreaterThan(0);
});

test('stops tracking and clears the background task context on unmount', async () => {
  const { unmount } = await render(<Harness voyageId="voyage-1" />);

  await act(async () => {
    unmount();
  });

  expect(mockStopLocationUpdatesAsync).toHaveBeenCalledWith('voylo-background-location');
  expect(mockSetBackgroundLocationContext).toHaveBeenLastCalledWith(null);
});

test('stops tracking and clears context when permission is lost while a Voyage is still active', async () => {
  const { rerender } = await render(<Harness voyageId="voyage-1" />);

  mockUseLocationPermission.mockReturnValue({
    status: 'denied',
    isLoading: false,
    hasError: false,
    refetch: jest.fn<() => Promise<void>>(),
    hasCompletedPriming: true,
    markPrimingComplete: jest.fn(),
  });
  await act(async () => {
    rerender(<Harness voyageId="voyage-1" />);
  });

  expect(mockStopLocationUpdatesAsync).toHaveBeenCalledWith('voylo-background-location');
  expect(mockSetBackgroundLocationContext).toHaveBeenLastCalledWith(null);
});

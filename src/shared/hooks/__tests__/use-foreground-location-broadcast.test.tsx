import { afterEach, beforeEach, expect, jest, test } from '@jest/globals';
import { act, render } from '@testing-library/react-native';
import { Text } from 'react-native';

import { useForegroundLocationBroadcast } from '@/shared/hooks/use-foreground-location-broadcast';
import { useAuth } from '@/shared/hooks/use-auth';
import { useLocationPermission } from '@/shared/hooks/use-location-permission';

const mockWatchPositionAsync = jest.fn<(...args: any[]) => Promise<any>>();
jest.mock('expo-location', () => ({
  Accuracy: { Balanced: 3 },
  watchPositionAsync: (...args: unknown[]) => mockWatchPositionAsync(...args),
}));

jest.mock('@/shared/hooks/use-auth', () => ({ useAuth: jest.fn() }));
jest.mock('@/shared/hooks/use-location-permission', () => ({ useLocationPermission: jest.fn() }));

const mockCreateBroadcastChannel = jest.fn<(...args: any[]) => any>();
const mockUpsertLocation = jest.fn<(...args: any[]) => Promise<any>>();
jest.mock('@/repositories/location-repository', () => ({
  locationRepository: {
    createBroadcastChannel: (...args: unknown[]) => mockCreateBroadcastChannel(...args),
    upsertLocation: (...args: unknown[]) => mockUpsertLocation(...args),
  },
}));

const mockUseAuth = useAuth as jest.MockedFunction<typeof useAuth>;
const mockUseLocationPermission = useLocationPermission as jest.MockedFunction<typeof useLocationPermission>;
const mockSend = jest.fn();
const mockChannelUnsubscribe = jest.fn();
const mockRemove = jest.fn();

function Harness({ voyageId }: { voyageId: string | null }) {
  useForegroundLocationBroadcast(voyageId);
  return <Text testID="harness" />;
}

beforeEach(() => {
  jest.clearAllMocks();
  jest.useFakeTimers({ now: new Date('2026-07-26T00:00:00Z') });
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
  mockCreateBroadcastChannel.mockReturnValue({ send: mockSend, unsubscribe: mockChannelUnsubscribe });
  mockUpsertLocation.mockResolvedValue({ error: null });
  mockWatchPositionAsync.mockResolvedValue({ remove: mockRemove });
});

afterEach(() => {
  jest.useRealTimers();
});

test('does not start watching when permission is not granted', async () => {
  mockUseLocationPermission.mockReturnValue({
    status: 'undetermined',
    isLoading: false,
    hasError: false,
    refetch: jest.fn<() => Promise<void>>(),
    hasCompletedPriming: false,
    markPrimingComplete: jest.fn(),
  });

  await render(<Harness voyageId="voyage-1" />);

  expect(mockWatchPositionAsync).not.toHaveBeenCalled();
  expect(mockCreateBroadcastChannel).not.toHaveBeenCalled();
});

test('does not start watching with no voyageId', async () => {
  await render(<Harness voyageId={null} />);

  expect(mockWatchPositionAsync).not.toHaveBeenCalled();
});

test('starts watching with the documented 5s/20m interval when granted and given a Voyage', async () => {
  await render(<Harness voyageId="voyage-1" />);

  expect(mockWatchPositionAsync).toHaveBeenCalledWith(
    { accuracy: 3, timeInterval: 5000, distanceInterval: 20 },
    expect.any(Function),
  );
  expect(mockCreateBroadcastChannel).toHaveBeenCalledWith('voyage-1');
});

test('sends a broadcast on every position callback', async () => {
  await render(<Harness voyageId="voyage-1" />);
  const callback = mockWatchPositionAsync.mock.calls[0][1] as (position: unknown) => void;

  await act(async () => {
    callback({ coords: { latitude: 39.1, longitude: -120.0, heading: 90 }, timestamp: 1785000000000 });
  });

  expect(mockSend).toHaveBeenCalledWith({ userId: 'user-1', lat: 39.1, lng: -120.0, heading: 90, updatedAt: expect.any(String) });
});

test('upserts on the first callback, then throttles further upserts within 30s', async () => {
  await render(<Harness voyageId="voyage-1" />);
  const callback = mockWatchPositionAsync.mock.calls[0][1] as (position: unknown) => void;

  await act(async () => {
    callback({ coords: { latitude: 39.1, longitude: -120.0, heading: 90 }, timestamp: Date.now() });
  });
  expect(mockUpsertLocation).toHaveBeenCalledTimes(1);

  await act(async () => {
    jest.advanceTimersByTime(5000);
    callback({ coords: { latitude: 39.2, longitude: -120.1, heading: 91 }, timestamp: Date.now() });
  });
  // Still throttled -- less than 30s since the first upsert.
  expect(mockUpsertLocation).toHaveBeenCalledTimes(1);
  // But every callback still broadcasts, throttle or not.
  expect(mockSend).toHaveBeenCalledTimes(2);

  await act(async () => {
    jest.advanceTimersByTime(30000);
    callback({ coords: { latitude: 39.3, longitude: -120.2, heading: 92 }, timestamp: Date.now() });
  });
  expect(mockUpsertLocation).toHaveBeenCalledTimes(2);
});

test('a heading-less position (device stationary) still sends, with heading null', async () => {
  await render(<Harness voyageId="voyage-1" />);
  const callback = mockWatchPositionAsync.mock.calls[0][1] as (position: unknown) => void;

  await act(async () => {
    callback({ coords: { latitude: 39.1, longitude: -120.0, heading: null }, timestamp: Date.now() });
  });

  expect(mockSend).toHaveBeenCalledWith(expect.objectContaining({ heading: null }));
});

test('stops watching and unsubscribes the broadcast channel on unmount', async () => {
  const { unmount } = await render(<Harness voyageId="voyage-1" />);

  await act(async () => {
    unmount();
  });

  expect(mockRemove).toHaveBeenCalledTimes(1);
  expect(mockChannelUnsubscribe).toHaveBeenCalledTimes(1);
});

test('stops watching a stale subscription that resolves after the effect was already cleaned up', async () => {
  let resolveWatch: (value: any) => void;
  mockWatchPositionAsync.mockImplementation(
    () =>
      new Promise((resolve) => {
        resolveWatch = resolve;
      }),
  );

  const { unmount } = await render(<Harness voyageId="voyage-1" />);
  await act(async () => {
    unmount();
  });

  await act(async () => {
    resolveWatch!({ remove: mockRemove });
  });

  expect(mockRemove).toHaveBeenCalledTimes(1);
});

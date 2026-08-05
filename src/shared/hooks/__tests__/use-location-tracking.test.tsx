import { afterEach, beforeEach, expect, jest, test } from '@jest/globals';
import { act, render } from '@testing-library/react-native';
import { Platform, Text } from 'react-native';

import { useLocationTracking } from '@/shared/hooks/use-location-tracking';
import { useAuth } from '@/shared/hooks/use-auth';
import { useLocationPermission } from '@/shared/hooks/use-location-permission';

const mockStartLocationUpdatesAsync = jest.fn<(...args: any[]) => Promise<any>>();
const mockStopLocationUpdatesAsync = jest.fn<(...args: any[]) => Promise<any>>();
const mockWatchPositionAsync = jest.fn<(...args: any[]) => Promise<any>>();
const mockSubscriptionRemove = jest.fn();
jest.mock('expo-location', () => ({
  Accuracy: { BestForNavigation: 6 },
  LocationActivityType: { AutomotiveNavigation: 2 },
  startLocationUpdatesAsync: (...args: unknown[]) => mockStartLocationUpdatesAsync(...args),
  stopLocationUpdatesAsync: (...args: unknown[]) => mockStopLocationUpdatesAsync(...args),
  watchPositionAsync: (...args: unknown[]) => mockWatchPositionAsync(...args),
}));

const mockSetBackgroundLocationContext = jest.fn<(...args: any[]) => Promise<any>>();
const mockClearBackgroundLocationContext = jest.fn<(...args: any[]) => Promise<any>>();
const mockReportLocationFix = jest.fn<(...args: any[]) => Promise<any>>();
jest.mock('@/shared/lib/background-location-task', () => ({
  BACKGROUND_LOCATION_TASK: 'voylo-background-location',
  setBackgroundLocationContext: (...args: unknown[]) => mockSetBackgroundLocationContext(...args),
  clearBackgroundLocationContext: (...args: unknown[]) => mockClearBackgroundLocationContext(...args),
  reportLocationFix: (...args: unknown[]) => mockReportLocationFix(...args),
}));

const ORIGINAL_PLATFORM_OS = Platform.OS;

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
  mockWatchPositionAsync.mockResolvedValue({ remove: mockSubscriptionRemove });
  mockReportLocationFix.mockResolvedValue(undefined);
  mockSetBackgroundLocationContext.mockResolvedValue(undefined);
  mockClearBackgroundLocationContext.mockResolvedValue(true);
});

afterEach(() => {
  Platform.OS = ORIGINAL_PLATFORM_OS;
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

test('starts navigation-grade tracking with immediate background delivery', async () => {
  await render(<Harness voyageId="voyage-1" />);

  expect(mockSetBackgroundLocationContext).toHaveBeenCalledWith({
    voyageId: 'voyage-1',
    ownerGeneration: expect.any(Number),
  });
  expect(mockStartLocationUpdatesAsync).toHaveBeenCalledWith(
    'voylo-background-location',
    expect.objectContaining({
      accuracy: 6,
      timeInterval: 1000,
      distanceInterval: 3,
      deferredUpdatesDistance: 0,
      deferredUpdatesInterval: 0,
    }),
  );
});

test('disables iOS auto-pause and sets an automotive activity type, so CoreLocation cannot silently stop delivering fixes mid-drive', async () => {
  await render(<Harness voyageId="voyage-1" />);

  expect(mockStartLocationUpdatesAsync).toHaveBeenCalledWith(
    'voylo-background-location',
    expect.objectContaining({ activityType: 2, pausesUpdatesAutomatically: false }),
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
  expect(mockClearBackgroundLocationContext).toHaveBeenLastCalledWith(expect.any(Number));
});

test('corrects the native state if startLocationUpdatesAsync resolves after this effect instance already cleaned up', async () => {
  let resolveStart: (() => void) | undefined;
  mockStartLocationUpdatesAsync.mockImplementation(() => new Promise<void>((resolve) => { resolveStart = resolve; }));

  const { unmount } = await render(<Harness voyageId="voyage-1" />);

  await act(async () => {
    unmount();
  });

  // The stop is queued behind the unresolved start so the two native calls
  // can never overtake one another.
  expect(mockStopLocationUpdatesAsync).not.toHaveBeenCalled();

  // The late-resolving start() from before unmount now completes.
  await act(async () => {
    resolveStart?.();
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
  });

  // The stale start is undone exactly once by its owning generation.
  expect(mockStopLocationUpdatesAsync).toHaveBeenCalledTimes(1);
  expect(mockClearBackgroundLocationContext).toHaveBeenLastCalledWith(expect.any(Number));
});

test('serializes a Voyage handoff so the old generation cannot stop or clear the newer task', async () => {
  let resolveFirstStart: (() => void) | undefined;
  mockStartLocationUpdatesAsync
    .mockImplementationOnce(() => new Promise<void>((resolve) => { resolveFirstStart = resolve; }))
    .mockResolvedValue(undefined);

  const { rerender } = await render(<Harness voyageId="voyage-1" />);
  expect(mockStartLocationUpdatesAsync).toHaveBeenCalledTimes(1);

  await act(async () => {
    rerender(<Harness voyageId="voyage-2" />);
  });

  // Voyage 2 is deliberately held behind Voyage 1's unresolved start.
  expect(mockStartLocationUpdatesAsync).toHaveBeenCalledTimes(1);
  expect(mockStopLocationUpdatesAsync).not.toHaveBeenCalled();

  await act(async () => {
    resolveFirstStart?.();
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
  });

  expect(mockStopLocationUpdatesAsync).toHaveBeenCalledTimes(1);
  expect(mockStartLocationUpdatesAsync).toHaveBeenCalledTimes(2);

  const oldContext = mockSetBackgroundLocationContext.mock.calls[0][0] as { ownerGeneration: number };
  const newContext = mockSetBackgroundLocationContext.mock.calls[1][0] as { voyageId: string; ownerGeneration: number };
  expect(newContext.voyageId).toBe('voyage-2');
  expect(newContext.ownerGeneration).not.toBe(oldContext.ownerGeneration);
  expect(mockClearBackgroundLocationContext).toHaveBeenCalledWith(oldContext.ownerGeneration);
  expect(mockClearBackgroundLocationContext).not.toHaveBeenCalledWith(newContext.ownerGeneration);

  // Most importantly, the only old-generation stop completed before the
  // newer start was issued; there is no detached old `.then()` left that can
  // stop Voyage 2 afterward.
  expect(mockStopLocationUpdatesAsync.mock.invocationCallOrder[0]).toBeLessThan(
    mockStartLocationUpdatesAsync.mock.invocationCallOrder[1],
  );
});

test('does not re-issue stop when start resolves normally before any cleanup', async () => {
  await render(<Harness voyageId="voyage-1" />);

  expect(mockStopLocationUpdatesAsync).not.toHaveBeenCalled();
  expect(mockSetBackgroundLocationContext).toHaveBeenLastCalledWith({
    voyageId: 'voyage-1',
    ownerGeneration: expect.any(Number),
  });
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
  expect(mockClearBackgroundLocationContext).toHaveBeenLastCalledWith(expect.any(Number));
});

test('on web, uses foreground watchPositionAsync instead of the background task -- startLocationUpdatesAsync silently no-ops on web (TaskManager has no web implementation)', async () => {
  Platform.OS = 'web';

  await render(<Harness voyageId="voyage-1" />);

  expect(mockWatchPositionAsync).toHaveBeenCalledWith(
    expect.objectContaining({ accuracy: 6, timeInterval: 1000, distanceInterval: 3 }),
    expect.any(Function),
  );
  expect(mockStartLocationUpdatesAsync).not.toHaveBeenCalled();
  expect(mockSetBackgroundLocationContext).not.toHaveBeenCalled();
});

test('on web, each position update is reported through the same reportLocationFix() the native task uses', async () => {
  Platform.OS = 'web';

  await render(<Harness voyageId="voyage-1" />);

  const onPosition = mockWatchPositionAsync.mock.calls[0][1] as (position: unknown) => void;
  await act(async () => {
    onPosition({ coords: { latitude: 39.1, longitude: -120.0, heading: -1 }, timestamp: 1753488000000 });
  });

  // heading -1 normalizes to null, same sentinel-normalization the native
  // task callback applies.
  expect(mockReportLocationFix).toHaveBeenCalledWith('voyage-1', 39.1, -120.0, null);
});

test('on web, removes the watchPositionAsync subscription on unmount', async () => {
  Platform.OS = 'web';

  const { unmount } = await render(<Harness voyageId="voyage-1" />);
  await act(async () => {
    unmount();
  });

  expect(mockSubscriptionRemove).toHaveBeenCalledTimes(1);
  expect(mockStopLocationUpdatesAsync).not.toHaveBeenCalled();
});

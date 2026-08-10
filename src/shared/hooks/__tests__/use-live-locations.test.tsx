import { beforeEach, expect, jest, test } from '@jest/globals';
import { act, render, waitFor } from '@testing-library/react-native';
import { AppState, Text, type AppStateStatus } from 'react-native';

import { useLiveLocations } from '@/shared/hooks/use-live-locations';

const mockGetLiveLocations = jest.fn<(...args: any[]) => Promise<any>>();
const mockSubscribeToLocations = jest.fn<(...args: any[]) => any>();
const mockUnsubscribe = jest.fn();
const mockRemoveAppStateListener = jest.fn();
let appStateListener: ((state: AppStateStatus) => void) | null = null;

jest.spyOn(AppState, 'addEventListener').mockImplementation((_type, listener) => {
  appStateListener = listener;
  return { remove: mockRemoveAppStateListener };
});

jest.mock('@/repositories/location-repository', () => ({
  locationRepository: {
    getLiveLocations: (...args: unknown[]) => mockGetLiveLocations(...args),
    subscribeToLocations: (...args: unknown[]) => mockSubscribeToLocations(...args),
  },
}));

const locationFixture = { userId: 'user-1', lat: 39.1, lng: -120.0, heading: 90, updatedAt: '2026-07-26T00:00:00Z' };

function Probe({ voyageId }: { voyageId: string | null }) {
  const { locations, isLoading, hasError } = useLiveLocations(voyageId);
  return (
    <Text testID="probe">{isLoading ? 'loading' : hasError ? 'error' : JSON.stringify(Object.keys(locations).sort())}</Text>
  );
}

function SyncProbe({ voyageId }: { voyageId: string }) {
  const { locations, isConnected, rosterRevision } = useLiveLocations(voyageId);
  return (
    <Text testID="sync-probe">
      {JSON.stringify({ lat: locations['user-1']?.lat ?? null, isConnected, rosterRevision })}
    </Text>
  );
}

function LifecycleProbe({ voyageId, userId = 'user-1' }: { voyageId: string; userId?: string }) {
  const { lifecycleRevision } = useLiveLocations(voyageId, userId);
  return <Text testID="lifecycle-probe">{lifecycleRevision ?? 0}</Text>;
}

beforeEach(() => {
  jest.clearAllMocks();
  appStateListener = null;
  mockSubscribeToLocations.mockReturnValue({ unsubscribe: mockUnsubscribe });
});

test('resolves to no locations (not loading) when voyageId is null, without calling the repository', async () => {
  const { getByTestId } = await render(<Probe voyageId={null} />);

  await waitFor(() => expect(getByTestId('probe').props.children).toBe('[]'));
  expect(mockGetLiveLocations).not.toHaveBeenCalled();
  expect(mockSubscribeToLocations).not.toHaveBeenCalled();
});

test('cold-loads and exposes locations keyed by userId when a voyageId is given', async () => {
  mockGetLiveLocations.mockResolvedValue({ data: [locationFixture], error: null });

  const { getByTestId } = await render(<Probe voyageId="voyage-1" />);

  await waitFor(() => expect(getByTestId('probe').props.children).toBe('["user-1"]'));
  expect(mockGetLiveLocations).toHaveBeenCalledWith('voyage-1');
});

test('subscribes to the Voyage channel after mounting', async () => {
  mockGetLiveLocations.mockResolvedValue({ data: [], error: null });

  await render(<Probe voyageId="voyage-1" />);

  await waitFor(() =>
    expect(mockSubscribeToLocations).toHaveBeenCalledWith(
      'voyage-1',
      expect.any(Function),
      expect.any(Function),
      expect.any(Function),
      expect.any(Function),
      null,
      expect.any(Function),
    ),
  );
});

test('exposes hasError (not stuck loading) when the cold-load fetch fails', async () => {
  mockGetLiveLocations.mockResolvedValue({ data: null, error: { code: 'LOC01', message: 'You are not an active member of this Voyage.' } });

  const { getByTestId } = await render(<Probe voyageId="voyage-1" />);

  await waitFor(() => expect(getByTestId('probe').props.children).toBe('error'));
});

test('a broadcast merges in a new Voyager not present in the cold load', async () => {
  mockGetLiveLocations.mockResolvedValue({ data: [], error: null });

  const { getByTestId } = await render(<Probe voyageId="voyage-1" />);
  await waitFor(() => expect(mockSubscribeToLocations).toHaveBeenCalled());
  const onLocation = mockSubscribeToLocations.mock.calls[0][1] as (location: unknown) => void;

  await act(async () => {
    onLocation(locationFixture);
  });

  await waitFor(() => expect(getByTestId('probe').props.children).toBe('["user-1"]'));
});

test('a newer broadcast overwrites an older cold-loaded location for the same Voyager', async () => {
  mockGetLiveLocations.mockResolvedValue({ data: [locationFixture], error: null });

  function LatProbe({ voyageId }: { voyageId: string }) {
    const { locations } = useLiveLocations(voyageId);
    return <Text testID="lat">{locations['user-1']?.lat ?? 'none'}</Text>;
  }

  const { getByTestId } = await render(<LatProbe voyageId="voyage-1" />);
  await waitFor(() => expect(getByTestId('lat').props.children).toBe(39.1));
  const onLocation = mockSubscribeToLocations.mock.calls[0][1] as (location: typeof locationFixture) => void;

  await act(async () => {
    onLocation({ ...locationFixture, lat: 40.0, updatedAt: '2026-07-26T00:05:00Z' });
  });

  await waitFor(() => expect(getByTestId('lat').props.children).toBe(40.0));
});

test('a stale broadcast does not regress a fresher already-rendered location', async () => {
  mockGetLiveLocations.mockResolvedValue({ data: [], error: null });

  function LatProbe({ voyageId }: { voyageId: string }) {
    const { locations } = useLiveLocations(voyageId);
    return <Text testID="lat">{locations['user-1']?.lat ?? 'none'}</Text>;
  }

  const { getByTestId } = await render(<LatProbe voyageId="voyage-1" />);
  await waitFor(() => expect(mockSubscribeToLocations).toHaveBeenCalled());
  const onLocation = mockSubscribeToLocations.mock.calls[0][1] as (location: typeof locationFixture) => void;

  await act(async () => {
    onLocation({ ...locationFixture, lat: 40.0, updatedAt: '2026-07-26T00:05:00Z' });
  });
  await waitFor(() => expect(getByTestId('lat').props.children).toBe(40.0));

  await act(async () => {
    onLocation({ ...locationFixture, lat: 1.0, updatedAt: '2026-07-26T00:00:00Z' });
  });

  expect(getByTestId('lat').props.children).toBe(40.0);
});

test('a broadcast that arrives before the cold-load resolves is not regressed by the cold-load (code review: race condition)', async () => {
  let resolveColdLoad: (value: any) => void;
  mockGetLiveLocations.mockImplementation(
    () =>
      new Promise((resolve) => {
        resolveColdLoad = resolve;
      }),
  );

  function LatProbe({ voyageId }: { voyageId: string }) {
    const { locations } = useLiveLocations(voyageId);
    return <Text testID="lat">{locations['user-1']?.lat ?? 'none'}</Text>;
  }

  const { getByTestId } = await render(<LatProbe voyageId="voyage-1" />);
  await waitFor(() => expect(mockSubscribeToLocations).toHaveBeenCalled());
  const onLocation = mockSubscribeToLocations.mock.calls[0][1] as (location: typeof locationFixture) => void;

  // A fresher broadcast lands while the cold-load's network round-trip is
  // still in flight.
  await act(async () => {
    onLocation({ ...locationFixture, lat: 40.0, updatedAt: '2026-07-26T00:05:00Z' });
  });
  await waitFor(() => expect(getByTestId('lat').props.children).toBe(40.0));

  // The cold-load finally resolves with the older (pre-broadcast) snapshot.
  await act(async () => {
    resolveColdLoad!({ data: [locationFixture], error: null });
  });

  // Must still show the fresher broadcast position, not regress to the
  // stale cold-load snapshot.
  expect(getByTestId('lat').props.children).toBe(40.0);
});

test('accumulates a trail of recent positions per Voyager as broadcasts arrive', async () => {
  mockGetLiveLocations.mockResolvedValue({ data: [], error: null });

  function TrailProbe({ voyageId }: { voyageId: string }) {
    const { trails } = useLiveLocations(voyageId);
    return <Text testID="trail-length">{trails['user-1']?.length ?? 0}</Text>;
  }

  const { getByTestId } = await render(<TrailProbe voyageId="voyage-1" />);
  await waitFor(() => expect(mockSubscribeToLocations).toHaveBeenCalled());
  const onLocation = mockSubscribeToLocations.mock.calls[0][1] as (location: typeof locationFixture) => void;

  await act(async () => {
    onLocation({ ...locationFixture, updatedAt: '2026-07-26T00:00:00Z' });
  });
  await waitFor(() => expect(getByTestId('trail-length').props.children).toBe(1));

  await act(async () => {
    onLocation({ ...locationFixture, updatedAt: '2026-07-26T00:00:02Z' });
  });
  expect(getByTestId('trail-length').props.children).toBe(2);
});

test('prunes trail points older than MapMarker.trailLengthMs (8s)', async () => {
  mockGetLiveLocations.mockResolvedValue({ data: [], error: null });

  function TrailProbe({ voyageId }: { voyageId: string }) {
    const { trails } = useLiveLocations(voyageId);
    return <Text testID="trail-length">{trails['user-1']?.length ?? 0}</Text>;
  }

  const { getByTestId } = await render(<TrailProbe voyageId="voyage-1" />);
  await waitFor(() => expect(mockSubscribeToLocations).toHaveBeenCalled());
  const onLocation = mockSubscribeToLocations.mock.calls[0][1] as (location: typeof locationFixture) => void;

  await act(async () => {
    onLocation({ ...locationFixture, updatedAt: '2026-07-26T00:00:00Z' });
  });
  // 9 seconds later -- past the 8s trail window, so the first point is pruned.
  await act(async () => {
    onLocation({ ...locationFixture, updatedAt: '2026-07-26T00:00:09Z' });
  });

  expect(getByTestId('trail-length').props.children).toBe(1);
});

test('isConnected starts true (optimistic -- no false "reconnecting" flash during a normal fast subscribe handshake)', async () => {
  mockGetLiveLocations.mockResolvedValue({ data: [], error: null });

  function ConnectedProbe({ voyageId }: { voyageId: string }) {
    const { isConnected } = useLiveLocations(voyageId);
    return <Text testID="connected">{String(isConnected)}</Text>;
  }

  const { getByTestId } = await render(<ConnectedProbe voyageId="voyage-1" />);

  expect(getByTestId('connected').props.children).toBe('true');
});

test('isConnected flips to false on a disconnected status callback, and back to true on reconnect', async () => {
  mockGetLiveLocations.mockResolvedValue({ data: [], error: null });

  function ConnectedProbe({ voyageId }: { voyageId: string }) {
    const { isConnected } = useLiveLocations(voyageId);
    return <Text testID="connected">{String(isConnected)}</Text>;
  }

  const { getByTestId } = await render(<ConnectedProbe voyageId="voyage-1" />);
  await waitFor(() => expect(mockSubscribeToLocations).toHaveBeenCalled());
  const onStatusChange = mockSubscribeToLocations.mock.calls[0][2] as (status: 'connected' | 'disconnected') => void;

  await act(async () => {
    onStatusChange('disconnected');
  });
  expect(getByTestId('connected').props.children).toBe('false');

  await act(async () => {
    onStatusChange('connected');
  });
  expect(getByTestId('connected').props.children).toBe('true');
});

test('the fourth subscription callback increments rosterRevision without re-fetching locations', async () => {
  mockGetLiveLocations.mockResolvedValue({ data: [], error: null });

  const { getByTestId } = await render(<SyncProbe voyageId="voyage-1" />);
  await waitFor(() => expect(mockSubscribeToLocations).toHaveBeenCalled());
  await waitFor(() => expect(mockGetLiveLocations).toHaveBeenCalledTimes(1));
  const onRosterChange = mockSubscribeToLocations.mock.calls[0][3] as (change: {
    userId: string | null;
    isActive: boolean | null;
  }) => void;

  await act(async () => {
    onRosterChange({ userId: 'user-2', isActive: true });
  });

  await waitFor(() => {
    expect(JSON.parse(getByTestId('sync-probe').props.children)).toEqual({ lat: null, isConnected: true, rosterRevision: 1 });
  });
  expect(mockGetLiveLocations).toHaveBeenCalledTimes(1);
});

test('an own-membership deactivation requests active-Voyage reconciliation', async () => {
  mockGetLiveLocations.mockResolvedValue({ data: [], error: null });

  const { getByTestId } = await render(<LifecycleProbe voyageId="voyage-1" />);
  await waitFor(() => expect(mockSubscribeToLocations).toHaveBeenCalled());
  const onRosterChange = mockSubscribeToLocations.mock.calls[0][3] as (change: {
    userId: string | null;
    isActive: boolean | null;
  }) => void;

  await act(async () => {
    onRosterChange({ userId: 'user-2', isActive: false });
  });
  expect(getByTestId('lifecycle-probe').props.children).toBe(0);

  await act(async () => {
    onRosterChange({ userId: 'user-1', isActive: false });
  });
  expect(getByTestId('lifecycle-probe').props.children).toBe(1);
});

test('an ended-Voyage broadcast requests active-Voyage reconciliation', async () => {
  mockGetLiveLocations.mockResolvedValue({ data: [], error: null });

  const { getByTestId } = await render(<LifecycleProbe voyageId="voyage-1" />);
  await waitFor(() => expect(mockSubscribeToLocations).toHaveBeenCalled());
  const onVoyageStatusChange = mockSubscribeToLocations.mock.calls[0][4] as (change: { status: 'active' | 'ended' | null }) => void;

  await act(async () => {
    onVoyageStatusChange({ status: 'ended' });
  });

  expect(getByTestId('lifecycle-probe').props.children).toBe(1);
});

test('reconnecting after a disconnect refreshes the durable snapshot and increments rosterRevision', async () => {
  const recoveredLocation = { ...locationFixture, lat: 40.0, updatedAt: '2026-07-26T00:05:00Z' };
  mockGetLiveLocations
    .mockResolvedValueOnce({ data: [locationFixture], error: null })
    .mockResolvedValueOnce({ data: [recoveredLocation], error: null });

  const { getByTestId } = await render(<SyncProbe voyageId="voyage-1" />);
  await waitFor(() => {
    expect(JSON.parse(getByTestId('sync-probe').props.children).lat).toBe(39.1);
  });
  const onStatusChange = mockSubscribeToLocations.mock.calls[0][2] as (status: 'connected' | 'disconnected') => void;

  await act(async () => {
    onStatusChange('disconnected');
  });
  expect(JSON.parse(getByTestId('sync-probe').props.children).isConnected).toBe(false);

  await act(async () => {
    onStatusChange('connected');
  });

  await waitFor(() => expect(mockGetLiveLocations).toHaveBeenCalledTimes(2));
  await waitFor(() => {
    expect(JSON.parse(getByTestId('sync-probe').props.children)).toEqual({ lat: 40, isConnected: true, rosterRevision: 1 });
  });
});

test('a reconnect snapshot cannot regress a fresher broadcast received while the hook stayed mounted', async () => {
  const staleRecoveryLocation = { ...locationFixture, lat: 40.0, updatedAt: '2026-07-26T00:02:00Z' };
  const freshBroadcastLocation = { ...locationFixture, lat: 41.0, updatedAt: '2026-07-26T00:05:00Z' };
  mockGetLiveLocations
    .mockResolvedValueOnce({ data: [locationFixture], error: null })
    .mockResolvedValueOnce({ data: [staleRecoveryLocation], error: null });

  const { getByTestId } = await render(<SyncProbe voyageId="voyage-1" />);
  await waitFor(() => expect(JSON.parse(getByTestId('sync-probe').props.children).lat).toBe(39.1));
  const onLocation = mockSubscribeToLocations.mock.calls[0][1] as (location: typeof locationFixture) => void;
  const onStatusChange = mockSubscribeToLocations.mock.calls[0][2] as (status: 'connected' | 'disconnected') => void;

  await act(async () => {
    onLocation(freshBroadcastLocation);
  });
  await waitFor(() => expect(JSON.parse(getByTestId('sync-probe').props.children).lat).toBe(41));

  await act(async () => {
    onStatusChange('disconnected');
    onStatusChange('connected');
  });

  await waitFor(() => expect(mockGetLiveLocations).toHaveBeenCalledTimes(2));
  expect(JSON.parse(getByTestId('sync-probe').props.children).lat).toBe(41);
});

test('returning to the foreground refreshes missed locations and roster state exactly once per transition', async () => {
  const foregroundLocation = { ...locationFixture, lat: 42.0, updatedAt: '2026-07-26T00:06:00Z' };
  mockGetLiveLocations
    .mockResolvedValueOnce({ data: [locationFixture], error: null })
    .mockResolvedValueOnce({ data: [foregroundLocation], error: null });

  const { getByTestId } = await render(<SyncProbe voyageId="voyage-1" />);
  await waitFor(() => expect(JSON.parse(getByTestId('sync-probe').props.children).lat).toBe(39.1));
  expect(AppState.addEventListener).toHaveBeenCalledWith('change', expect.any(Function));
  expect(appStateListener).not.toBeNull();

  await act(async () => {
    appStateListener?.('background');
    appStateListener?.('active');
  });

  await waitFor(() => expect(mockGetLiveLocations).toHaveBeenCalledTimes(2));
  await waitFor(() => {
    expect(JSON.parse(getByTestId('sync-probe').props.children)).toEqual({ lat: 42, isConnected: true, rosterRevision: 1 });
  });

  await act(async () => {
    appStateListener?.('active');
  });
  expect(mockGetLiveLocations).toHaveBeenCalledTimes(2);
  expect(JSON.parse(getByTestId('sync-probe').props.children).rosterRevision).toBe(1);
});

test('isConnected resets to true on a voyageId change', async () => {
  mockGetLiveLocations.mockResolvedValue({ data: [], error: null });

  function ConnectedProbe({ voyageId }: { voyageId: string }) {
    const { isConnected } = useLiveLocations(voyageId);
    return <Text testID="connected">{String(isConnected)}</Text>;
  }

  const { getByTestId, rerender } = await render(<ConnectedProbe voyageId="voyage-1" />);
  await waitFor(() => expect(mockSubscribeToLocations).toHaveBeenCalled());
  const onStatusChange = mockSubscribeToLocations.mock.calls[0][2] as (status: 'connected' | 'disconnected') => void;
  await act(async () => {
    onStatusChange('disconnected');
  });
  expect(getByTestId('connected').props.children).toBe('false');

  await act(async () => {
    rerender(<ConnectedProbe voyageId="voyage-2" />);
  });

  await waitFor(() => expect(getByTestId('connected').props.children).toBe('true'));
});

test('unsubscribes from the channel and removes the AppState listener on unmount', async () => {
  mockGetLiveLocations.mockResolvedValue({ data: [], error: null });

  const { unmount } = await render(<Probe voyageId="voyage-1" />);
  await waitFor(() => expect(mockSubscribeToLocations).toHaveBeenCalled());
  const staleAppStateListener = appStateListener;

  await act(async () => {
    unmount();
  });

  expect(mockUnsubscribe).toHaveBeenCalledTimes(1);
  expect(mockRemoveAppStateListener).toHaveBeenCalledTimes(1);

  await act(async () => {
    staleAppStateListener?.('background');
    staleAppStateListener?.('active');
  });
  expect(mockGetLiveLocations).toHaveBeenCalledTimes(1);
});

test('re-subscribes when voyageId changes, unsubscribing from the previous channel', async () => {
  mockGetLiveLocations.mockResolvedValue({ data: [], error: null });

  const { rerender } = await render(<Probe voyageId="voyage-1" />);
  await waitFor(() =>
    expect(mockSubscribeToLocations).toHaveBeenCalledWith(
      'voyage-1',
      expect.any(Function),
      expect.any(Function),
      expect.any(Function),
      expect.any(Function),
      null,
      expect.any(Function),
    ),
  );

  await act(async () => {
    rerender(<Probe voyageId="voyage-2" />);
  });

  expect(mockUnsubscribe).toHaveBeenCalledTimes(1);
  expect(mockRemoveAppStateListener).toHaveBeenCalledTimes(1);
  await waitFor(() =>
    expect(mockSubscribeToLocations).toHaveBeenCalledWith(
      'voyage-2',
      expect.any(Function),
      expect.any(Function),
      expect.any(Function),
      expect.any(Function),
      null,
      expect.any(Function),
    ),
  );
});

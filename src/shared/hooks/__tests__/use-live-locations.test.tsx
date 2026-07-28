import { beforeEach, expect, jest, test } from '@jest/globals';
import { act, render, waitFor } from '@testing-library/react-native';
import { Text } from 'react-native';

import { useLiveLocations } from '@/shared/hooks/use-live-locations';

const mockGetLiveLocations = jest.fn<(...args: any[]) => Promise<any>>();
const mockSubscribeToLocations = jest.fn<(...args: any[]) => any>();
const mockUnsubscribe = jest.fn();

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

beforeEach(() => {
  jest.clearAllMocks();
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

  await waitFor(() => expect(mockSubscribeToLocations).toHaveBeenCalledWith('voyage-1', expect.any(Function)));
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

test('unsubscribes from the channel on unmount', async () => {
  mockGetLiveLocations.mockResolvedValue({ data: [], error: null });

  const { unmount } = await render(<Probe voyageId="voyage-1" />);
  await waitFor(() => expect(mockSubscribeToLocations).toHaveBeenCalled());

  await act(async () => {
    unmount();
  });

  expect(mockUnsubscribe).toHaveBeenCalledTimes(1);
});

test('re-subscribes when voyageId changes, unsubscribing from the previous channel', async () => {
  mockGetLiveLocations.mockResolvedValue({ data: [], error: null });

  const { rerender } = await render(<Probe voyageId="voyage-1" />);
  await waitFor(() => expect(mockSubscribeToLocations).toHaveBeenCalledWith('voyage-1', expect.any(Function)));

  await act(async () => {
    rerender(<Probe voyageId="voyage-2" />);
  });

  expect(mockUnsubscribe).toHaveBeenCalledTimes(1);
  await waitFor(() => expect(mockSubscribeToLocations).toHaveBeenCalledWith('voyage-2', expect.any(Function)));
});

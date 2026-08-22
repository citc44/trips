import { act, render, waitFor } from '@testing-library/react-native';
import { expect, jest, test, beforeEach } from '@jest/globals';
import { Text } from 'react-native';

import { useMemoryLaneData } from '@/shared/hooks/use-memory-lane-data';

const mockGetVoyage = jest.fn<(...args: any[]) => Promise<any>>();
const mockGetVoyageMembers = jest.fn<(...args: any[]) => Promise<any>>();
const mockGetEventHistory = jest.fn<(...args: any[]) => Promise<any>>();

jest.mock('@/repositories/voyage-repository', () => ({
  voyageRepository: {
    getVoyage: (...args: unknown[]) => mockGetVoyage(...args),
    getVoyageMembers: (...args: unknown[]) => mockGetVoyageMembers(...args),
  },
}));

jest.mock('@/repositories/journey-event-repository', () => ({
  journeyEventRepository: {
    getEventHistory: (...args: unknown[]) => mockGetEventHistory(...args),
  },
}));

const endedVoyage = {
  data: {
    id: 'voyage-1',
    destination: 'Lake Tahoe',
    destinationLat: null,
    destinationLng: null,
    status: 'ended',
    createdBy: 'user-1',
    createdAt: '2026-08-11T10:00:00.000Z',
    endedAt: '2026-08-11T16:42:00.000Z',
    joinCode: null,
  },
  error: null,
};

// Minimal harness: exercises the hook the same way any real screen would,
// exposing its result via testIDs -- this codebase's proven render()+waitFor()
// pattern (active-voyage.test.tsx et al.), not the untested renderHook()+
// waitFor() combination (verified during this story to hit a real act-
// environment gap with no prior precedent anywhere in this codebase).
function Harness({ voyageId, onRefetchReady }: { voyageId: string | null; onRefetchReady?: (refetch: () => Promise<void>) => void }) {
  const { data, isLoading, error, refetch } = useMemoryLaneData(voyageId);
  onRefetchReady?.(refetch);
  return (
    <>
      <Text testID="loading">{String(isLoading)}</Text>
      <Text testID="destination">{data?.destination ?? ''}</Text>
      <Text testID="error">{error ?? ''}</Text>
      <Text testID="spot-count">{data ? String(data.totalSpotCount) : ''}</Text>
    </>
  );
}

function eventPage(count: number, startIndex: number) {
  return Array.from({ length: count }, (_, i) => {
    const n = startIndex + i;
    return {
      id: `event-${n}`,
      voyageId: 'voyage-1',
      actorUserId: 'user-1',
      eventType: 'police' as const,
      // Descending order (newest first), matching get_journey_event_history's
      // own `order by occurred_at desc, id desc` -- page 1 is the most recent
      // 200, page 2 the next-oldest batch below that cursor.
      occurredAt: new Date(2026, 7, 11, 12, 0, 0, -n).toISOString(),
      metadata: {},
      status: 'confirmed',
      source: 'manual',
      createdAt: new Date(2026, 7, 11, 12, 0, 0, -n).toISOString(),
    };
  });
}

beforeEach(() => {
  jest.clearAllMocks();
});

test('useMemoryLaneData fetches the voyage, members, and event history in parallel and composes them', async () => {
  mockGetVoyage.mockResolvedValue(endedVoyage);
  mockGetVoyageMembers.mockResolvedValue({
    data: [{ userId: 'user-1', displayName: 'Chintan', role: 'organizer', joinedAt: '2026-08-11T10:00:00.000Z', playerColor: 'teal', travelRole: null }],
    error: null,
  });
  mockGetEventHistory.mockResolvedValue({ data: [], error: null });

  const { getByTestId } = await render(<Harness voyageId="voyage-1" />);

  await waitFor(() => expect(getByTestId('loading')).toHaveTextContent('false'));

  expect(mockGetVoyage).toHaveBeenCalledWith('voyage-1');
  expect(mockGetVoyageMembers).toHaveBeenCalledWith('voyage-1');
  expect(mockGetEventHistory).toHaveBeenCalledWith('voyage-1', undefined, undefined, 200);
  expect(getByTestId('destination')).toHaveTextContent('Lake Tahoe');
  expect(getByTestId('error')).toHaveTextContent('');
});

test('useMemoryLaneData pages past the 200-event server cap instead of silently truncating', async () => {
  mockGetVoyage.mockResolvedValue(endedVoyage);
  mockGetVoyageMembers.mockResolvedValue({
    data: [{ userId: 'user-1', displayName: 'Chintan', role: 'organizer', joinedAt: '2026-08-11T10:00:00.000Z', playerColor: 'teal', travelRole: null }],
    error: null,
  });
  const firstPage = eventPage(200, 0);
  const secondPage = eventPage(30, 200);
  mockGetEventHistory.mockResolvedValueOnce({ data: firstPage, error: null }).mockResolvedValueOnce({ data: secondPage, error: null });

  const { getByTestId } = await render(<Harness voyageId="voyage-1" />);

  await waitFor(() => expect(getByTestId('loading')).toHaveTextContent('false'));

  expect(mockGetEventHistory).toHaveBeenCalledTimes(2);
  expect(mockGetEventHistory).toHaveBeenNthCalledWith(1, 'voyage-1', undefined, undefined, 200);
  const lastOfFirstPage = firstPage[firstPage.length - 1];
  expect(mockGetEventHistory).toHaveBeenNthCalledWith(2, 'voyage-1', lastOfFirstPage.occurredAt, lastOfFirstPage.id, 200);
  // All 230 events (across both pages) counted -- not just the first 200.
  expect(getByTestId('spot-count')).toHaveTextContent('230');
});

test('useMemoryLaneData surfaces an error when the Voyage has not actually ended yet', async () => {
  mockGetVoyage.mockResolvedValue({ data: { ...endedVoyage.data, status: 'active', endedAt: null }, error: null });
  mockGetVoyageMembers.mockResolvedValue({ data: [], error: null });
  mockGetEventHistory.mockResolvedValue({ data: [], error: null });

  const { getByTestId } = await render(<Harness voyageId="voyage-1" />);

  await waitFor(() => expect(getByTestId('loading')).toHaveTextContent('false'));

  expect(getByTestId('destination')).toHaveTextContent('');
  expect(getByTestId('error')).not.toHaveTextContent('');
});

test('useMemoryLaneData surfaces a repository error', async () => {
  mockGetVoyage.mockResolvedValue({ data: null, error: { code: 'unknown', message: 'Network request failed' } });
  mockGetVoyageMembers.mockResolvedValue({ data: [], error: null });
  mockGetEventHistory.mockResolvedValue({ data: [], error: null });

  const { getByTestId } = await render(<Harness voyageId="voyage-1" />);

  await waitFor(() => expect(getByTestId('loading')).toHaveTextContent('false'));

  expect(getByTestId('error')).toHaveTextContent('Network request failed');
});

test('useMemoryLaneData does nothing when voyageId is null', async () => {
  const { getByTestId } = await render(<Harness voyageId={null} />);

  expect(getByTestId('loading')).toHaveTextContent('false');
  expect(getByTestId('destination')).toHaveTextContent('');
  expect(mockGetVoyage).not.toHaveBeenCalled();
});

test('useMemoryLaneData refetch fetches fresh data again (no stale in-memory reuse, AC3)', async () => {
  mockGetVoyage.mockResolvedValue(endedVoyage);
  mockGetVoyageMembers.mockResolvedValue({ data: [], error: null });
  mockGetEventHistory.mockResolvedValue({ data: [], error: null });

  let capturedRefetch: (() => Promise<void>) | null = null;
  const { getByTestId } = await render(<Harness voyageId="voyage-1" onRefetchReady={(refetch) => (capturedRefetch = refetch)} />);

  await waitFor(() => expect(getByTestId('loading')).toHaveTextContent('false'));
  expect(mockGetVoyage).toHaveBeenCalledTimes(1);

  await act(async () => {
    await capturedRefetch!();
  });

  expect(mockGetVoyage).toHaveBeenCalledTimes(2);
});

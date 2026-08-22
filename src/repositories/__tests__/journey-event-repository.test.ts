import { beforeEach, expect, jest, test } from '@jest/globals';

import { journeyEventRepository } from '@/repositories/journey-event-repository';

const mockRpc = jest.fn<(...args: any[]) => Promise<any>>();

jest.mock('@/lib/supabase', () => ({
  supabase: {
    rpc: (...args: unknown[]) => mockRpc(...args),
  },
}));

beforeEach(() => {
  jest.clearAllMocks();
});

// Story 6.1 AC5: getEventHistory is new coverage for a new function.
// createEvent (the pre-existing live-broadcast path) has no test file today
// -- that's a pre-existing gap this story deliberately does not retrofit,
// per its own Dev Notes.

test('getEventHistory calls the get_journey_event_history RPC with a null cursor and the default limit when none are given', async () => {
  mockRpc.mockResolvedValue({ data: [], error: null });

  await journeyEventRepository.getEventHistory('voyage-1');

  expect(mockRpc).toHaveBeenCalledWith('get_journey_event_history', {
    p_voyage_id: 'voyage-1',
    p_before: null,
    p_before_id: null,
    p_limit: 50,
  });
});

test('getEventHistory passes an explicit cursor, tiebreak id, and limit through to the RPC', async () => {
  mockRpc.mockResolvedValue({ data: [], error: null });

  await journeyEventRepository.getEventHistory('voyage-1', '2026-08-11T00:00:00Z', 'event-9', 10);

  expect(mockRpc).toHaveBeenCalledWith('get_journey_event_history', {
    p_voyage_id: 'voyage-1',
    p_before: '2026-08-11T00:00:00Z',
    p_before_id: 'event-9',
    p_limit: 10,
  });
});

test('getEventHistory returns { data: [], error: null } (not a crash) when the RPC resolves with data: null', async () => {
  mockRpc.mockResolvedValue({ data: null, error: null });

  const result = await journeyEventRepository.getEventHistory('voyage-1');

  expect(result).toEqual({ data: [], error: null });
});

test('getEventHistory returns the mapped list of journey events, including status and source', async () => {
  mockRpc.mockResolvedValue({
    data: [
      {
        id: 'event-1',
        voyage_id: 'voyage-1',
        actor_user_id: 'user-2',
        event_type: 'police',
        occurred_at: '2026-08-11T00:00:00Z',
        metadata: {},
        status: 'confirmed',
        source: 'manual',
        created_at: '2026-08-11T00:00:01Z',
      },
    ],
    error: null,
  });

  const result = await journeyEventRepository.getEventHistory('voyage-1');

  expect(result).toEqual({
    data: [
      {
        id: 'event-1',
        voyageId: 'voyage-1',
        actorUserId: 'user-2',
        eventType: 'police',
        occurredAt: '2026-08-11T00:00:00Z',
        metadata: {},
        status: 'confirmed',
        source: 'manual',
        createdAt: '2026-08-11T00:00:01Z',
      },
    ],
    error: null,
  });
});

test('getEventHistory returns an empty array (not an error) when the RPC resolves with no rows', async () => {
  mockRpc.mockResolvedValue({ data: [], error: null });

  const result = await journeyEventRepository.getEventHistory('voyage-1');

  expect(result).toEqual({ data: [], error: null });
});

test('getEventHistory returns a typed { code, message } error on RPC failure (e.g. not a participant)', async () => {
  mockRpc.mockResolvedValue({ data: null, error: { code: 'EVT03', message: 'You are not a participant of this Voyage.' } });

  const result = await journeyEventRepository.getEventHistory('voyage-1');

  expect(result).toEqual({ data: null, error: { code: 'EVT03', message: 'You are not a participant of this Voyage.' } });
});

import { afterEach, beforeEach, expect, jest, test } from '@jest/globals';

import { locationRepository } from '@/repositories/location-repository';

const mockRpc = jest.fn<(...args: any[]) => any>();
const mockOn = jest.fn<(...args: any[]) => any>();
const mockSubscribe = jest.fn<(...args: any[]) => any>();
const mockChannel = jest.fn<(...args: any[]) => any>();
const mockRemoveChannel = jest.fn<(...args: any[]) => any>();

jest.mock('@/lib/supabase', () => ({
  supabase: {
    rpc: (...args: unknown[]) => mockRpc(...args),
    channel: (...args: unknown[]) => mockChannel(...args),
    removeChannel: (...args: unknown[]) => mockRemoveChannel(...args),
  },
}));

function makeChannelInstance() {
  return {
    on: mockOn.mockReturnThis(),
    subscribe: mockSubscribe,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  const channelInstance = makeChannelInstance();
  mockChannel.mockReturnValue(channelInstance);
  mockSubscribe.mockImplementation((callback?: (status: string) => void) => {
    callback?.('SUBSCRIBED');
    return channelInstance;
  });
});

afterEach(() => {
  jest.useRealTimers();
});

test('getLiveLocations calls the get_live_locations RPC with the Voyage id', async () => {
  mockRpc.mockResolvedValue({ data: [], error: null });

  await locationRepository.getLiveLocations('voyage-1');

  expect(mockRpc).toHaveBeenCalledWith('get_live_locations', { p_voyage_id: 'voyage-1' });
});

test('getLiveLocations returns the mapped list of live locations', async () => {
  mockRpc.mockResolvedValue({
    data: [{ user_id: 'user-1', lat: 39.1, lng: -120.0, heading: 90, updated_at: '2026-07-26T00:00:00Z' }],
    error: null,
  });

  const result = await locationRepository.getLiveLocations('voyage-1');

  expect(result).toEqual({
    data: [{ userId: 'user-1', lat: 39.1, lng: -120.0, heading: 90, updatedAt: '2026-07-26T00:00:00Z' }],
    error: null,
  });
});

test('getLiveLocations returns an empty array (not an error) when the RPC resolves with no rows', async () => {
  mockRpc.mockResolvedValue({ data: [], error: null });

  const result = await locationRepository.getLiveLocations('voyage-1');

  expect(result).toEqual({ data: [], error: null });
});

test('getLiveLocations returns a typed { code, message } error on RPC failure', async () => {
  mockRpc.mockResolvedValue({ data: null, error: { code: 'LOC01', message: 'You are not an active member of this Voyage.' } });

  const result = await locationRepository.getLiveLocations('voyage-1');

  expect(result).toEqual({ data: null, error: { code: 'LOC01', message: 'You are not an active member of this Voyage.' } });
});

test('upsertLocation calls the upsert_location RPC with the Voyage id and position', async () => {
  mockRpc.mockResolvedValue({ data: null, error: null });

  await locationRepository.upsertLocation('voyage-1', { lat: 39.1, lng: -120.0, heading: 90 });

  expect(mockRpc).toHaveBeenCalledWith('upsert_location', { p_voyage_id: 'voyage-1', p_lat: 39.1, p_lng: -120.0, p_heading: 90 });
});

test('upsertLocation returns a typed { code, message } error on RPC failure', async () => {
  mockRpc.mockResolvedValue({ data: null, error: { code: 'LOC02', message: 'You are not an active member of this Voyage.' } });

  const result = await locationRepository.upsertLocation('voyage-1', { lat: 0, lng: 0, heading: null });

  expect(result).toEqual({ error: { code: 'LOC02', message: 'You are not an active member of this Voyage.' } });
});

// Story: server-side broadcast (upsert_location() now emits the Realtime
// message itself, atomically with the write -- see
// 20260804010000_secure_live_location_delivery.sql). The client is
// receive-only: no `broadcast: { self: true }` (nothing to self-echo, the
// client never publishes), and no write-side channel/send API at all
// anymore -- createBroadcastChannel/broadcastLocationOnce are gone.
test('subscribeToLocations creates a private, receive-only channel scoped to the Voyage and subscribes', () => {
  locationRepository.subscribeToLocations('voyage-1', jest.fn());

  expect(mockChannel).toHaveBeenCalledWith('voyage:voyage-1', { config: { private: true } });
  expect(mockOn).toHaveBeenCalledWith('broadcast', { event: 'location' }, expect.any(Function));
  expect(mockOn).toHaveBeenCalledWith('broadcast', { event: 'roster_changed' }, expect.any(Function));
  expect(mockSubscribe).toHaveBeenCalledTimes(1);
});

test('subscribeToLocations invokes the callback with a mapped location on each location broadcast', () => {
  const onLocation = jest.fn();
  locationRepository.subscribeToLocations('voyage-1', onLocation);

  const locationHandler = mockOn.mock.calls.find((call) => call[1]?.event === 'location')?.[2] as (message: {
    payload: unknown;
  }) => void;
  locationHandler({ payload: { user_id: 'user-1', lat: 39.1, lng: -120.0, heading: 90, updated_at: '2026-07-26T00:00:00Z' } });

  expect(onLocation).toHaveBeenCalledWith({ userId: 'user-1', lat: 39.1, lng: -120.0, heading: 90, updatedAt: '2026-07-26T00:00:00Z' });
});

test('subscribeToLocations invokes onRosterChange on each roster_changed broadcast', () => {
  const onRosterChange = jest.fn();
  locationRepository.subscribeToLocations('voyage-1', jest.fn(), undefined, onRosterChange);

  const rosterHandler = mockOn.mock.calls.find((call) => call[1]?.event === 'roster_changed')?.[2] as () => void;
  rosterHandler();

  expect(onRosterChange).toHaveBeenCalledTimes(1);
});

test('subscribeToLocations returns an unsubscribe that removes the channel', () => {
  const { unsubscribe } = locationRepository.subscribeToLocations('voyage-1', jest.fn());

  unsubscribe();

  expect(mockRemoveChannel).toHaveBeenCalledTimes(1);
});

test('subscribeToLocations reports a connected status on SUBSCRIBED', () => {
  const onStatusChange = jest.fn();
  locationRepository.subscribeToLocations('voyage-1', jest.fn(), onStatusChange);

  expect(onStatusChange).toHaveBeenCalledWith('connected');
});

test.each(['CHANNEL_ERROR', 'TIMED_OUT'])('subscribeToLocations reports a disconnected status on %s', (status) => {
  mockSubscribe.mockImplementation((callback?: (status: string) => void) => {
    callback?.(status);
    return makeChannelInstance();
  });
  const onStatusChange = jest.fn();

  locationRepository.subscribeToLocations('voyage-1', jest.fn(), onStatusChange);

  expect(onStatusChange).toHaveBeenCalledWith('disconnected');
});

test('subscribeToLocations does not throw when onStatusChange/onRosterChange are omitted', () => {
  expect(() => locationRepository.subscribeToLocations('voyage-1', jest.fn())).not.toThrow();
});

// CLOSED is treated as terminal (unlike CHANNEL_ERROR/TIMED_OUT, which are
// left to Supabase's own rejoin timer) -- a channel left open for a long
// drive must be able to recover without requiring the screen to remount.
test('subscribeToLocations rebuilds the channel once, after the retry delay, on CLOSED', () => {
  jest.useFakeTimers();
  let callCount = 0;
  mockSubscribe.mockImplementation((callback?: (status: string) => void) => {
    callCount += 1;
    // First connect attempt closes immediately; the rebuilt channel (second
    // connect() call) settles normally.
    callback?.(callCount === 1 ? 'CLOSED' : 'SUBSCRIBED');
    return makeChannelInstance();
  });

  locationRepository.subscribeToLocations('voyage-1', jest.fn());

  expect(mockChannel).toHaveBeenCalledTimes(1);
  expect(mockRemoveChannel).toHaveBeenCalledTimes(1);

  jest.advanceTimersByTime(1000);

  expect(mockChannel).toHaveBeenCalledTimes(2);
});

test('subscribeToLocations does not schedule a rebuild for CHANNEL_ERROR or TIMED_OUT', () => {
  jest.useFakeTimers();
  mockSubscribe.mockImplementation((callback?: (status: string) => void) => {
    callback?.('CHANNEL_ERROR');
    return makeChannelInstance();
  });

  locationRepository.subscribeToLocations('voyage-1', jest.fn());
  jest.advanceTimersByTime(5000);

  expect(mockChannel).toHaveBeenCalledTimes(1);
  expect(mockRemoveChannel).not.toHaveBeenCalled();
});

test('unsubscribe before a scheduled reconnect fires clears the pending timer instead of rebuilding', () => {
  jest.useFakeTimers();
  mockSubscribe.mockImplementation((callback?: (status: string) => void) => {
    callback?.('CLOSED');
    return makeChannelInstance();
  });

  const { unsubscribe } = locationRepository.subscribeToLocations('voyage-1', jest.fn());
  unsubscribe();
  jest.advanceTimersByTime(5000);

  // One create (initial) + the CLOSED-triggered teardown's own removeChannel,
  // plus unsubscribe()'s removeChannel if a channel was still current -- the
  // key assertion is no *second* channel gets created after unsubscribe.
  expect(mockChannel).toHaveBeenCalledTimes(1);
});

test('a stale status callback from a superseded (already-replaced) channel is ignored', () => {
  jest.useFakeTimers();
  const capturedCallbacks: ((status: string) => void)[] = [];
  const firstInstance = makeChannelInstance();
  const secondInstance = makeChannelInstance();
  mockChannel.mockReturnValueOnce(firstInstance).mockReturnValueOnce(secondInstance);
  mockSubscribe.mockImplementation((callback?: (status: string) => void) => {
    if (callback) capturedCallbacks.push(callback);
    return undefined;
  });

  const onStatusChange = jest.fn();
  locationRepository.subscribeToLocations('voyage-1', jest.fn(), onStatusChange);

  // First channel closes -> scheduled rebuild.
  capturedCallbacks[0]('CLOSED');
  jest.advanceTimersByTime(1000);
  onStatusChange.mockClear();

  // The now-superseded first channel's callback fires again (a late/stale
  // network event) -- must not report status or trigger yet another rebuild.
  capturedCallbacks[0]('CLOSED');

  expect(onStatusChange).not.toHaveBeenCalled();
  expect(mockChannel).toHaveBeenCalledTimes(2);
});

import { beforeEach, expect, jest, test } from '@jest/globals';

import { locationRepository } from '@/repositories/location-repository';

const mockRpc = jest.fn<(...args: any[]) => any>();
const mockOn = jest.fn<(...args: any[]) => any>();
const mockSubscribe = jest.fn<(...args: any[]) => any>();
const mockSend = jest.fn<(...args: any[]) => any>();
const mockChannel = jest.fn<(...args: any[]) => any>();
const mockRemoveChannel = jest.fn<(...args: any[]) => any>();

jest.mock('@/lib/supabase', () => ({
  supabase: {
    rpc: (...args: unknown[]) => mockRpc(...args),
    channel: (...args: unknown[]) => mockChannel(...args),
    removeChannel: (...args: unknown[]) => mockRemoveChannel(...args),
  },
}));

beforeEach(() => {
  jest.clearAllMocks();
  const channelInstance = {
    on: mockOn.mockReturnThis(),
    subscribe: mockSubscribe,
    send: mockSend,
  };
  mockChannel.mockReturnValue(channelInstance);
  mockSubscribe.mockImplementation((callback?: (status: string) => void) => {
    callback?.('SUBSCRIBED');
    return channelInstance;
  });
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

test('subscribeToLocations creates a private channel scoped to the Voyage and subscribes', () => {
  locationRepository.subscribeToLocations('voyage-1', jest.fn());

  expect(mockChannel).toHaveBeenCalledWith('voyage:voyage-1', { config: { private: true } });
  expect(mockOn).toHaveBeenCalledWith('broadcast', { event: 'location' }, expect.any(Function));
  expect(mockSubscribe).toHaveBeenCalledTimes(1);
});

test('subscribeToLocations invokes the callback with a mapped location on each broadcast', () => {
  const onLocation = jest.fn();
  locationRepository.subscribeToLocations('voyage-1', onLocation);

  const broadcastHandler = mockOn.mock.calls[0][2] as (message: { payload: unknown }) => void;
  broadcastHandler({ payload: { user_id: 'user-1', lat: 39.1, lng: -120.0, heading: 90, updated_at: '2026-07-26T00:00:00Z' } });

  expect(onLocation).toHaveBeenCalledWith({ userId: 'user-1', lat: 39.1, lng: -120.0, heading: 90, updatedAt: '2026-07-26T00:00:00Z' });
});

test('subscribeToLocations returns an unsubscribe that removes the channel', () => {
  const { unsubscribe } = locationRepository.subscribeToLocations('voyage-1', jest.fn());

  unsubscribe();

  expect(mockRemoveChannel).toHaveBeenCalledTimes(1);
});

test('createBroadcastChannel creates a private channel scoped to the Voyage and subscribes', () => {
  locationRepository.createBroadcastChannel('voyage-1');

  expect(mockChannel).toHaveBeenCalledWith('voyage:voyage-1', { config: { private: true } });
  expect(mockSubscribe).toHaveBeenCalledTimes(1);
});

test('createBroadcastChannel sends a mapped broadcast payload once subscribed', () => {
  const { send } = locationRepository.createBroadcastChannel('voyage-1');

  send({ userId: 'user-1', lat: 39.1, lng: -120.0, heading: 90, updatedAt: '2026-07-26T00:00:00Z' });

  expect(mockSend).toHaveBeenCalledWith({
    type: 'broadcast',
    event: 'location',
    payload: { user_id: 'user-1', lat: 39.1, lng: -120.0, heading: 90, updated_at: '2026-07-26T00:00:00Z' },
  });
});

test('createBroadcastChannel drops a send that happens before the channel is actually subscribed', () => {
  mockSubscribe.mockImplementation(() => ({ on: mockOn, subscribe: mockSubscribe, send: mockSend })); // never calls back with 'SUBSCRIBED'

  const { send } = locationRepository.createBroadcastChannel('voyage-1');
  send({ userId: 'user-1', lat: 39.1, lng: -120.0, heading: 90, updatedAt: '2026-07-26T00:00:00Z' });

  expect(mockSend).not.toHaveBeenCalled();
});

test('createBroadcastChannel unsubscribe removes the channel', () => {
  const { unsubscribe } = locationRepository.createBroadcastChannel('voyage-1');

  unsubscribe();

  expect(mockRemoveChannel).toHaveBeenCalledTimes(1);
});

test('broadcastLocationOnce creates a private channel, sends once subscribed, then tears the channel down', async () => {
  await locationRepository.broadcastLocationOnce('voyage-1', {
    userId: 'user-1',
    lat: 39.1,
    lng: -120.0,
    heading: 90,
    updatedAt: '2026-07-26T00:00:00Z',
  });

  expect(mockChannel).toHaveBeenCalledWith('voyage:voyage-1', { config: { private: true } });
  expect(mockSend).toHaveBeenCalledWith({
    type: 'broadcast',
    event: 'location',
    payload: { user_id: 'user-1', lat: 39.1, lng: -120.0, heading: 90, updated_at: '2026-07-26T00:00:00Z' },
  });
  expect(mockRemoveChannel).toHaveBeenCalledTimes(1);
});

test('broadcastLocationOnce resolves without throwing (fails open) if the channel never reaches SUBSCRIBED', async () => {
  mockSubscribe.mockImplementation((callback?: (status: string) => void) => {
    callback?.('CHANNEL_ERROR');
    return { on: mockOn, subscribe: mockSubscribe, send: mockSend };
  });

  await expect(
    locationRepository.broadcastLocationOnce('voyage-1', {
      userId: 'user-1',
      lat: 39.1,
      lng: -120.0,
      heading: 90,
      updatedAt: '2026-07-26T00:00:00Z',
    }),
  ).resolves.toBeUndefined();

  expect(mockSend).not.toHaveBeenCalled();
  expect(mockRemoveChannel).toHaveBeenCalledTimes(1);
});

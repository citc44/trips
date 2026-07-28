import { beforeEach, expect, jest, test } from '@jest/globals';

const mockGetItem = jest.fn<(...args: any[]) => Promise<any>>();
const mockSetItem = jest.fn<(...args: any[]) => Promise<any>>();
jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: {
    getItem: (...args: unknown[]) => mockGetItem(...args),
    setItem: (...args: unknown[]) => mockSetItem(...args),
  },
}));

const mockEndVoyage = jest.fn<(...args: any[]) => Promise<any>>();
const mockGrantOrganizerStatus = jest.fn<(...args: any[]) => Promise<any>>();
const mockRemoveVoyager = jest.fn<(...args: any[]) => Promise<any>>();
jest.mock('@/repositories/voyage-repository', () => ({
  voyageRepository: {
    endVoyage: (...args: unknown[]) => mockEndVoyage(...args),
    grantOrganizerStatus: (...args: unknown[]) => mockGrantOrganizerStatus(...args),
    removeVoyager: (...args: unknown[]) => mockRemoveVoyager(...args),
  },
}));

const STORAGE_KEY = 'voylo:offline-write-outbox';

beforeEach(() => {
  jest.clearAllMocks();
  jest.resetModules();
  mockGetItem.mockResolvedValue(null);
  mockSetItem.mockResolvedValue(undefined);
});

function loadOutbox() {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require('../outbox').outbox as typeof import('../outbox').outbox;
}

test('enqueue persists a new item to AsyncStorage under the outbox key', async () => {
  const outbox = loadOutbox();

  await outbox.enqueue({ kind: 'end_voyage', payload: { voyageId: 'voyage-1' } });

  expect(mockSetItem).toHaveBeenCalledTimes(1);
  const [key, value] = mockSetItem.mock.calls[0] as [string, string];
  expect(key).toBe(STORAGE_KEY);
  const persisted = JSON.parse(value);
  expect(persisted).toHaveLength(1);
  expect(persisted[0]).toMatchObject({ kind: 'end_voyage', payload: { voyageId: 'voyage-1' } });
  expect(persisted[0].id).toEqual(expect.any(String));
  expect(persisted[0].queuedAt).toEqual(expect.any(String));
});

test('enqueue appends to an existing persisted queue rather than overwriting it', async () => {
  mockGetItem.mockResolvedValue(
    JSON.stringify([{ id: 'existing-1', kind: 'remove_voyager', payload: { voyageId: 'voyage-1', targetUserId: 'user-2' }, queuedAt: '2026-07-28T00:00:00Z' }]),
  );
  const outbox = loadOutbox();

  await outbox.enqueue({ kind: 'end_voyage', payload: { voyageId: 'voyage-1' } });

  const [, value] = mockSetItem.mock.calls[0] as [string, string];
  const persisted = JSON.parse(value);
  expect(persisted).toHaveLength(2);
  expect(persisted[0].id).toBe('existing-1');
  expect(persisted[1].kind).toBe('end_voyage');
});

test('flush on an empty queue is a no-op', async () => {
  const outbox = loadOutbox();

  const result = await outbox.flush();

  expect(result).toEqual({ succeeded: [], conflicts: [] });
  expect(mockEndVoyage).not.toHaveBeenCalled();
});

test('flush removes a succeeded item from the persisted queue and reports it with its result data', async () => {
  mockGetItem.mockResolvedValue(
    JSON.stringify([{ id: 'item-1', kind: 'end_voyage', payload: { voyageId: 'voyage-1' }, queuedAt: '2026-07-28T00:00:00Z' }]),
  );
  mockEndVoyage.mockResolvedValue({ data: { id: 'voyage-1', destination: 'Lake Tahoe', voyagerCount: 3 }, error: null });
  const outbox = loadOutbox();

  const result = await outbox.flush();

  expect(mockEndVoyage).toHaveBeenCalledWith('voyage-1');
  expect(result.succeeded).toHaveLength(1);
  expect(result.succeeded[0].item.id).toBe('item-1');
  expect(result.succeeded[0].data).toEqual({ id: 'voyage-1', destination: 'Lake Tahoe', voyagerCount: 3 });
  expect(result.conflicts).toEqual([]);
  // Removed from the persisted queue.
  const [, value] = mockSetItem.mock.calls.at(-1) as [string, string];
  expect(JSON.parse(value)).toEqual([]);
});

test('flush dispatches grant_organizer_status and remove_voyager to their matching repository calls', async () => {
  mockGetItem.mockResolvedValue(
    JSON.stringify([
      { id: 'item-1', kind: 'grant_organizer_status', payload: { voyageId: 'voyage-1', targetUserId: 'user-2' }, queuedAt: '2026-07-28T00:00:00Z' },
      { id: 'item-2', kind: 'remove_voyager', payload: { voyageId: 'voyage-1', targetUserId: 'user-3' }, queuedAt: '2026-07-28T00:00:01Z' },
    ]),
  );
  mockGrantOrganizerStatus.mockResolvedValue({ error: null });
  mockRemoveVoyager.mockResolvedValue({ error: null });
  const outbox = loadOutbox();

  const result = await outbox.flush();

  expect(mockGrantOrganizerStatus).toHaveBeenCalledWith('voyage-1', 'user-2');
  expect(mockRemoveVoyager).toHaveBeenCalledWith('voyage-1', 'user-3');
  expect(result.succeeded).toHaveLength(2);
});

test('flush removes a conflicting item (a real RPC errcode) and reports its message, then continues to the next item', async () => {
  mockGetItem.mockResolvedValue(
    JSON.stringify([
      { id: 'item-1', kind: 'remove_voyager', payload: { voyageId: 'voyage-1', targetUserId: 'user-2' }, queuedAt: '2026-07-28T00:00:00Z' },
      { id: 'item-2', kind: 'grant_organizer_status', payload: { voyageId: 'voyage-1', targetUserId: 'user-3' }, queuedAt: '2026-07-28T00:00:01Z' },
    ]),
  );
  mockRemoveVoyager.mockResolvedValue({ error: { code: 'REM03', message: 'That person is not an active member of this Voyage.' } });
  mockGrantOrganizerStatus.mockResolvedValue({ error: null });
  const outbox = loadOutbox();

  const result = await outbox.flush();

  expect(result.conflicts).toEqual([{ item: expect.objectContaining({ id: 'item-1' }), message: 'That person is not an active member of this Voyage.' }]);
  // The next item was still attempted -- a conflict does not block the rest of the queue.
  expect(mockGrantOrganizerStatus).toHaveBeenCalledWith('voyage-1', 'user-3');
  expect(result.succeeded).toHaveLength(1);
  const [, value] = mockSetItem.mock.calls.at(-1) as [string, string];
  expect(JSON.parse(value)).toEqual([]);
});

test('flush stops the pass on a network-level failure (error.code is unknown), keeping it and later items queued', async () => {
  mockGetItem.mockResolvedValue(
    JSON.stringify([
      { id: 'item-1', kind: 'end_voyage', payload: { voyageId: 'voyage-1' }, queuedAt: '2026-07-28T00:00:00Z' },
      { id: 'item-2', kind: 'grant_organizer_status', payload: { voyageId: 'voyage-1', targetUserId: 'user-2' }, queuedAt: '2026-07-28T00:00:01Z' },
    ]),
  );
  mockEndVoyage.mockResolvedValue({ data: null, error: { code: 'unknown', message: 'Network request failed' } });
  const outbox = loadOutbox();

  const result = await outbox.flush();

  expect(result.succeeded).toEqual([]);
  expect(result.conflicts).toEqual([]);
  // The second item was never attempted -- flush stopped at the first network failure.
  expect(mockGrantOrganizerStatus).not.toHaveBeenCalled();
  // Both items remain queued for the next flush trigger.
  const [, value] = mockSetItem.mock.calls.at(-1) as [string, string];
  expect(JSON.parse(value)).toHaveLength(2);
});

test('flush treats a thrown exception the same as a network-level failure', async () => {
  mockGetItem.mockResolvedValue(
    JSON.stringify([{ id: 'item-1', kind: 'end_voyage', payload: { voyageId: 'voyage-1' }, queuedAt: '2026-07-28T00:00:00Z' }]),
  );
  mockEndVoyage.mockRejectedValue(new Error('Network request failed'));
  const outbox = loadOutbox();

  const result = await outbox.flush();

  expect(result.succeeded).toEqual([]);
  expect(result.conflicts).toEqual([]);
  const [, value] = mockSetItem.mock.calls.at(-1) as [string, string];
  expect(JSON.parse(value)).toHaveLength(1);
});

test('flush preserves queue order across a partial flush', async () => {
  mockGetItem.mockResolvedValue(
    JSON.stringify([
      { id: 'item-1', kind: 'grant_organizer_status', payload: { voyageId: 'voyage-1', targetUserId: 'user-2' }, queuedAt: '2026-07-28T00:00:00Z' },
      { id: 'item-2', kind: 'remove_voyager', payload: { voyageId: 'voyage-1', targetUserId: 'user-3' }, queuedAt: '2026-07-28T00:00:01Z' },
      { id: 'item-3', kind: 'end_voyage', payload: { voyageId: 'voyage-1' }, queuedAt: '2026-07-28T00:00:02Z' },
    ]),
  );
  mockGrantOrganizerStatus.mockResolvedValue({ error: null });
  mockRemoveVoyager.mockResolvedValue({ data: null, error: { code: 'unknown', message: 'Network request failed' } });
  const outbox = loadOutbox();

  await outbox.flush();

  // item-1 succeeded and was removed; item-2 network-failed and stopped the
  // pass, so item-2 and item-3 (never attempted) both remain, in order.
  const [, value] = mockSetItem.mock.calls.at(-1) as [string, string];
  const persisted = JSON.parse(value);
  expect(persisted.map((item: { id: string }) => item.id)).toEqual(['item-2', 'item-3']);
  expect(mockRemoveVoyager).toHaveBeenCalledTimes(1);
});

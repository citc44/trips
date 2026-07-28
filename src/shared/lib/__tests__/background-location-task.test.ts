import { afterEach, beforeEach, expect, jest, test } from '@jest/globals';

const mockDefineTask = jest.fn<(...args: any[]) => void>();
jest.mock('expo-task-manager', () => ({
  defineTask: (...args: unknown[]) => mockDefineTask(...args),
}));

const mockUpsertLocation = jest.fn<(...args: any[]) => Promise<any>>();
const mockBroadcastLocationOnce = jest.fn<(...args: any[]) => Promise<any>>();
jest.mock('@/repositories/location-repository', () => ({
  locationRepository: {
    upsertLocation: (...args: unknown[]) => mockUpsertLocation(...args),
    broadcastLocationOnce: (...args: unknown[]) => mockBroadcastLocationOnce(...args),
  },
}));

const mockGetItem = jest.fn<(...args: any[]) => Promise<any>>();
const mockSetItem = jest.fn<(...args: any[]) => Promise<any>>();
const mockRemoveItem = jest.fn<(...args: any[]) => Promise<any>>();
jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: {
    getItem: (...args: unknown[]) => mockGetItem(...args),
    setItem: (...args: unknown[]) => mockSetItem(...args),
    removeItem: (...args: unknown[]) => mockRemoveItem(...args),
  },
}));

let BACKGROUND_LOCATION_TASK: string;
let setBackgroundLocationContext: (context: { voyageId: string; userId: string } | null) => void;
let taskExecutor: (body: { data: unknown; error: { code: string | number; message: string } | null }) => Promise<void>;

const locationFixture = {
  coords: { latitude: 39.1, longitude: -120.0, heading: 90 },
  timestamp: new Date('2026-07-26T00:00:00Z').getTime(),
};

beforeEach(() => {
  jest.useFakeTimers({ now: new Date('2026-07-26T00:00:00Z') });
  jest.resetModules();
  jest.clearAllMocks();
  mockUpsertLocation.mockResolvedValue({ error: null });
  mockBroadcastLocationOnce.mockResolvedValue(undefined);
  mockGetItem.mockResolvedValue(null);
  mockSetItem.mockResolvedValue(undefined);
  mockRemoveItem.mockResolvedValue(undefined);

  // Re-require after resetModules so defineTask() (a module-scope side
  // effect) runs fresh for each test, matching how it actually runs once
  // at real app startup. This also resets the module's throttle/context
  // state, so tests don't leak timing state into each other.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const taskModule = require('../background-location-task');
  BACKGROUND_LOCATION_TASK = taskModule.BACKGROUND_LOCATION_TASK;
  setBackgroundLocationContext = taskModule.setBackgroundLocationContext;
  taskExecutor = mockDefineTask.mock.calls[0][1] as typeof taskExecutor;
});

afterEach(() => {
  jest.useRealTimers();
});

test('defineTask is called once at module load with the exported task name', () => {
  expect(mockDefineTask).toHaveBeenCalledWith(BACKGROUND_LOCATION_TASK, expect.any(Function));
});

test('skips cleanly when the task body carries an error', async () => {
  setBackgroundLocationContext({ voyageId: 'voyage-1', userId: 'user-1' });

  await taskExecutor({ data: { locations: [locationFixture] }, error: { code: '1', message: 'boom' } });

  expect(mockUpsertLocation).not.toHaveBeenCalled();
  expect(mockBroadcastLocationOnce).not.toHaveBeenCalled();
});

test('skips cleanly when there is no context to report against and nothing persisted either', async () => {
  setBackgroundLocationContext(null);

  await taskExecutor({ data: { locations: [locationFixture] }, error: null });

  expect(mockUpsertLocation).not.toHaveBeenCalled();
  expect(mockBroadcastLocationOnce).not.toHaveBeenCalled();
});

test('skips cleanly when the locations array is empty', async () => {
  setBackgroundLocationContext({ voyageId: 'voyage-1', userId: 'user-1' });

  await taskExecutor({ data: { locations: [] }, error: null });

  expect(mockUpsertLocation).not.toHaveBeenCalled();
  expect(mockBroadcastLocationOnce).not.toHaveBeenCalled();
});

test('upserts and broadcasts using the latest location when the context is set', async () => {
  setBackgroundLocationContext({ voyageId: 'voyage-1', userId: 'user-1' });

  await taskExecutor({ data: { locations: [locationFixture] }, error: null });

  expect(mockUpsertLocation).toHaveBeenCalledWith('voyage-1', { lat: 39.1, lng: -120.0, heading: 90 });
  expect(mockBroadcastLocationOnce).toHaveBeenCalledWith('voyage-1', {
    userId: 'user-1',
    lat: 39.1,
    lng: -120.0,
    heading: 90,
    updatedAt: '2026-07-26T00:00:00.000Z',
  });
});

test('uses the last (most recent) location when the task delivers multiple in one batch', async () => {
  setBackgroundLocationContext({ voyageId: 'voyage-1', userId: 'user-1' });
  const older = { coords: { latitude: 1, longitude: 1, heading: 0 }, timestamp: new Date('2026-07-26T00:00:00Z').getTime() };
  const newer = { coords: { latitude: 39.1, longitude: -120.0, heading: 90 }, timestamp: new Date('2026-07-26T00:00:05Z').getTime() };

  await taskExecutor({ data: { locations: [older, newer] }, error: null });

  expect(mockUpsertLocation).toHaveBeenCalledWith('voyage-1', { lat: 39.1, lng: -120.0, heading: 90 });
});

test('normalizes a -1 heading sentinel to null, same as the foreground path', async () => {
  setBackgroundLocationContext({ voyageId: 'voyage-1', userId: 'user-1' });

  await taskExecutor({
    data: { locations: [{ coords: { latitude: 39.1, longitude: -120.0, heading: -1 }, timestamp: locationFixture.timestamp }] },
    error: null,
  });

  expect(mockUpsertLocation).toHaveBeenCalledWith('voyage-1', { lat: 39.1, lng: -120.0, heading: null });
});

test('a broadcast failure does not block or throw past the (already-completed) upsert', async () => {
  setBackgroundLocationContext({ voyageId: 'voyage-1', userId: 'user-1' });
  mockBroadcastLocationOnce.mockRejectedValue(new Error('network error'));

  await expect(taskExecutor({ data: { locations: [locationFixture] }, error: null })).resolves.toBeUndefined();

  expect(mockUpsertLocation).toHaveBeenCalledTimes(1);
});

test('an upsertLocation rejection does not throw past the task, and the broadcast still runs', async () => {
  setBackgroundLocationContext({ voyageId: 'voyage-1', userId: 'user-1' });
  mockUpsertLocation.mockRejectedValue(new Error('network error'));

  await expect(taskExecutor({ data: { locations: [locationFixture] }, error: null })).resolves.toBeUndefined();

  expect(mockBroadcastLocationOnce).toHaveBeenCalledTimes(1);
});

test('setBackgroundLocationContext(null) after a context was set stops future callbacks from reporting', async () => {
  setBackgroundLocationContext({ voyageId: 'voyage-1', userId: 'user-1' });
  setBackgroundLocationContext(null);

  await taskExecutor({ data: { locations: [locationFixture] }, error: null });

  expect(mockUpsertLocation).not.toHaveBeenCalled();
});

test('setBackgroundLocationContext persists to AsyncStorage when set, and clears it when set to null', () => {
  setBackgroundLocationContext({ voyageId: 'voyage-1', userId: 'user-1' });
  expect(mockSetItem).toHaveBeenCalledWith('voylo:background-location-context', JSON.stringify({ voyageId: 'voyage-1', userId: 'user-1' }));

  setBackgroundLocationContext(null);
  expect(mockRemoveItem).toHaveBeenCalledWith('voylo:background-location-context');
});

test('rehydrates context from AsyncStorage on the first callback after a process restart', async () => {
  // No in-memory context was ever set this "process" (fresh require, no
  // setBackgroundLocationContext call) -- simulates the OS headlessly
  // relaunching the app solely to deliver a due background task.
  mockGetItem.mockResolvedValue(JSON.stringify({ voyageId: 'voyage-1', userId: 'user-1' }));

  await taskExecutor({ data: { locations: [locationFixture] }, error: null });

  expect(mockGetItem).toHaveBeenCalledWith('voylo:background-location-context');
  expect(mockUpsertLocation).toHaveBeenCalledWith('voyage-1', { lat: 39.1, lng: -120.0, heading: 90 });
});

test('does not report anything when rehydration finds nothing persisted', async () => {
  mockGetItem.mockResolvedValue(null);

  await taskExecutor({ data: { locations: [locationFixture] }, error: null });

  expect(mockUpsertLocation).not.toHaveBeenCalled();
});

test('does not report anything when rehydration itself fails', async () => {
  mockGetItem.mockRejectedValue(new Error('storage unavailable'));

  await expect(taskExecutor({ data: { locations: [locationFixture] }, error: null })).resolves.toBeUndefined();

  expect(mockUpsertLocation).not.toHaveBeenCalled();
});

test('throttles upsertLocation to at most once per 30s, while still broadcasting every tick', async () => {
  setBackgroundLocationContext({ voyageId: 'voyage-1', userId: 'user-1' });

  await taskExecutor({ data: { locations: [locationFixture] }, error: null });
  expect(mockUpsertLocation).toHaveBeenCalledTimes(1);
  expect(mockBroadcastLocationOnce).toHaveBeenCalledTimes(1);

  jest.setSystemTime(new Date('2026-07-26T00:00:05Z'));
  await taskExecutor({ data: { locations: [locationFixture] }, error: null });
  expect(mockUpsertLocation).toHaveBeenCalledTimes(1);
  expect(mockBroadcastLocationOnce).toHaveBeenCalledTimes(2);

  jest.setSystemTime(new Date('2026-07-26T00:00:31Z'));
  await taskExecutor({ data: { locations: [locationFixture] }, error: null });
  expect(mockUpsertLocation).toHaveBeenCalledTimes(2);
  expect(mockBroadcastLocationOnce).toHaveBeenCalledTimes(3);
});

test('a fresh context (new tracking session) always writes the first fix immediately, ignoring any prior throttle window', async () => {
  setBackgroundLocationContext({ voyageId: 'voyage-1', userId: 'user-1' });
  await taskExecutor({ data: { locations: [locationFixture] }, error: null });
  expect(mockUpsertLocation).toHaveBeenCalledTimes(1);

  jest.setSystemTime(new Date('2026-07-26T00:00:01Z'));
  setBackgroundLocationContext({ voyageId: 'voyage-2', userId: 'user-1' });
  await taskExecutor({ data: { locations: [locationFixture] }, error: null });

  expect(mockUpsertLocation).toHaveBeenCalledTimes(2);
  expect(mockUpsertLocation).toHaveBeenLastCalledWith('voyage-2', { lat: 39.1, lng: -120.0, heading: 90 });
});

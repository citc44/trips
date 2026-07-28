import { beforeEach, expect, jest, test } from '@jest/globals';

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

let BACKGROUND_LOCATION_TASK: string;
let setBackgroundLocationContext: (context: { voyageId: string; userId: string } | null) => void;
let taskExecutor: (body: { data: unknown; error: { code: string | number; message: string } | null }) => Promise<void>;

const locationFixture = {
  coords: { latitude: 39.1, longitude: -120.0, heading: 90 },
  timestamp: new Date('2026-07-26T00:00:00Z').getTime(),
};

beforeEach(() => {
  jest.resetModules();
  jest.clearAllMocks();
  mockUpsertLocation.mockResolvedValue({ error: null });
  mockBroadcastLocationOnce.mockResolvedValue(undefined);

  // Re-require after resetModules so defineTask() (a module-scope side
  // effect) runs fresh for each test, matching how it actually runs once
  // at real app startup.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const taskModule = require('../background-location-task');
  BACKGROUND_LOCATION_TASK = taskModule.BACKGROUND_LOCATION_TASK;
  setBackgroundLocationContext = taskModule.setBackgroundLocationContext;
  taskExecutor = mockDefineTask.mock.calls[0][1] as typeof taskExecutor;
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

test('skips cleanly when there is no context to report against (nothing set, or already cleared)', async () => {
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

test('setBackgroundLocationContext(null) after a context was set stops future callbacks from reporting', async () => {
  setBackgroundLocationContext({ voyageId: 'voyage-1', userId: 'user-1' });
  setBackgroundLocationContext(null);

  await taskExecutor({ data: { locations: [locationFixture] }, error: null });

  expect(mockUpsertLocation).not.toHaveBeenCalled();
});

import { beforeEach, expect, jest, test } from '@jest/globals';

const mockDefineTask = jest.fn<(...args: any[]) => void>();
jest.mock('expo-task-manager', () => ({
  defineTask: (...args: unknown[]) => mockDefineTask(...args),
}));

const mockUpsertLocation = jest.fn<(...args: any[]) => Promise<any>>();
jest.mock('@/repositories/location-repository', () => ({
  locationRepository: {
    upsertLocation: (...args: unknown[]) => mockUpsertLocation(...args),
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
let setBackgroundLocationContext: (context: { voyageId: string } | null) => void;
let reportLocationFix: (voyageId: string, lat: number, lng: number, heading: number | null) => Promise<void>;
let taskExecutor: (body: { data: unknown; error: { code: string | number; message: string } | null }) => Promise<void>;

const locationFixture = {
  coords: { latitude: 39.1, longitude: -120.0, heading: 90 },
  timestamp: new Date('2026-07-26T00:00:00Z').getTime(),
};

beforeEach(() => {
  jest.resetModules();
  jest.clearAllMocks();
  mockUpsertLocation.mockResolvedValue({ error: null });
  mockGetItem.mockResolvedValue(null);
  mockSetItem.mockResolvedValue(undefined);
  mockRemoveItem.mockResolvedValue(undefined);

  // Re-require after resetModules so defineTask() (a module-scope side
  // effect) runs fresh for each test, matching how it actually runs once
  // at real app startup. This also resets the module's context/coalescing
  // state, so tests don't leak pending fixes into each other.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const taskModule = require('../background-location-task');
  BACKGROUND_LOCATION_TASK = taskModule.BACKGROUND_LOCATION_TASK;
  setBackgroundLocationContext = taskModule.setBackgroundLocationContext;
  reportLocationFix = taskModule.reportLocationFix;
  taskExecutor = mockDefineTask.mock.calls[0][1] as typeof taskExecutor;
});

test('defineTask is called once at module load with the exported task name', () => {
  expect(mockDefineTask).toHaveBeenCalledWith(BACKGROUND_LOCATION_TASK, expect.any(Function));
});

test('skips cleanly when the task body carries an error', async () => {
  setBackgroundLocationContext({ voyageId: 'voyage-1' });

  await taskExecutor({ data: { locations: [locationFixture] }, error: { code: '1', message: 'boom' } });

  expect(mockUpsertLocation).not.toHaveBeenCalled();
});

test('skips cleanly when there is no context to report against and nothing persisted either', async () => {
  setBackgroundLocationContext(null);

  await taskExecutor({ data: { locations: [locationFixture] }, error: null });

  expect(mockUpsertLocation).not.toHaveBeenCalled();
});

test('skips cleanly when the locations array is empty', async () => {
  setBackgroundLocationContext({ voyageId: 'voyage-1' });

  await taskExecutor({ data: { locations: [] }, error: null });

  expect(mockUpsertLocation).not.toHaveBeenCalled();
});

test('reports the latest location through the server RPC when the context is set', async () => {
  setBackgroundLocationContext({ voyageId: 'voyage-1' });

  await taskExecutor({ data: { locations: [locationFixture] }, error: null });

  expect(mockUpsertLocation).toHaveBeenCalledWith('voyage-1', { lat: 39.1, lng: -120.0, heading: 90 });
});

test('uses the last (most recent) location when the task delivers multiple in one batch', async () => {
  setBackgroundLocationContext({ voyageId: 'voyage-1' });
  const older = { coords: { latitude: 1, longitude: 1, heading: 0 }, timestamp: new Date('2026-07-26T00:00:00Z').getTime() };
  const newer = { coords: { latitude: 39.1, longitude: -120.0, heading: 90 }, timestamp: new Date('2026-07-26T00:00:05Z').getTime() };

  await taskExecutor({ data: { locations: [older, newer] }, error: null });

  expect(mockUpsertLocation).toHaveBeenCalledWith('voyage-1', { lat: 39.1, lng: -120.0, heading: 90 });
});

test('normalizes a -1 heading sentinel to null, same as the foreground path', async () => {
  setBackgroundLocationContext({ voyageId: 'voyage-1' });

  await taskExecutor({
    data: { locations: [{ coords: { latitude: 39.1, longitude: -120.0, heading: -1 }, timestamp: locationFixture.timestamp }] },
    error: null,
  });

  expect(mockUpsertLocation).toHaveBeenCalledWith('voyage-1', { lat: 39.1, lng: -120.0, heading: null });
});

test('an upsertLocation rejection does not throw past the background task', async () => {
  setBackgroundLocationContext({ voyageId: 'voyage-1' });
  mockUpsertLocation.mockRejectedValue(new Error('network error'));

  await expect(taskExecutor({ data: { locations: [locationFixture] }, error: null })).resolves.toBeUndefined();

  expect(mockUpsertLocation).toHaveBeenCalledTimes(1);
});

test('setBackgroundLocationContext(null) after a context was set stops future callbacks from reporting', async () => {
  setBackgroundLocationContext({ voyageId: 'voyage-1' });
  setBackgroundLocationContext(null);

  await taskExecutor({ data: { locations: [locationFixture] }, error: null });

  expect(mockUpsertLocation).not.toHaveBeenCalled();
});

test('setBackgroundLocationContext persists to AsyncStorage when set, and clears it when set to null', () => {
  setBackgroundLocationContext({ voyageId: 'voyage-1' });
  expect(mockSetItem).toHaveBeenCalledWith('voylo:background-location-context', JSON.stringify({ voyageId: 'voyage-1' }));

  setBackgroundLocationContext(null);
  expect(mockRemoveItem).toHaveBeenCalledWith('voylo:background-location-context');
});

test('rehydrates context from AsyncStorage on the first callback after a process restart', async () => {
  // No in-memory context was ever set this "process" (fresh require, no
  // setBackgroundLocationContext call) -- simulates the OS headlessly
  // relaunching the app solely to deliver a due background task.
  mockGetItem.mockResolvedValue(JSON.stringify({ voyageId: 'voyage-1' }));

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

test('reports every sequential fix through the authoritative server RPC without the former 30-second throttle', async () => {
  await reportLocationFix('voyage-1', 39.1, -120, 90);
  await reportLocationFix('voyage-1', 39.2, -120.1, 95);

  expect(mockUpsertLocation).toHaveBeenNthCalledWith(1, 'voyage-1', { lat: 39.1, lng: -120, heading: 90 });
  expect(mockUpsertLocation).toHaveBeenNthCalledWith(2, 'voyage-1', { lat: 39.2, lng: -120.1, heading: 95 });
});

test('coalesces rapid fixes while an RPC is in flight and sends the newest queued position next', async () => {
  let resolveFirstRequest!: (value: { error: null }) => void;
  mockUpsertLocation
    .mockImplementationOnce(() => new Promise((resolve) => { resolveFirstRequest = resolve; }))
    .mockResolvedValue({ error: null });

  const first = reportLocationFix('voyage-1', 39.1, -120, 90);
  const superseded = reportLocationFix('voyage-1', 39.2, -120.1, 95);
  const newest = reportLocationFix('voyage-1', 39.3, -120.2, 100);

  expect(mockUpsertLocation).toHaveBeenCalledTimes(1);
  resolveFirstRequest({ error: null });
  await Promise.all([first, superseded, newest]);

  expect(mockUpsertLocation).toHaveBeenCalledTimes(2);
  expect(mockUpsertLocation).toHaveBeenNthCalledWith(1, 'voyage-1', { lat: 39.1, lng: -120, heading: 90 });
  expect(mockUpsertLocation).toHaveBeenNthCalledWith(2, 'voyage-1', { lat: 39.3, lng: -120.2, heading: 100 });
});

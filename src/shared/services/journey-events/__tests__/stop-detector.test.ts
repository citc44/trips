import { expect, test } from '@jest/globals';
import { advanceStopDetector, initialStopDetectorState, type StopSample } from '@/shared/services/journey-events/stop-detector';

const sample = (capturedAtMs: number, overrides: Partial<StopSample> = {}): StopSample => ({
  lat: 39, lng: -77, capturedAtMs, speedMps: 0, accuracyM: 10, ...overrides,
});

test('confirms a generic stop after five minutes of accurate clustered fixes', () => {
  let state = initialStopDetectorState();
  state = advanceStopDetector(state, sample(0)).state;
  state = advanceStopDetector(state, sample(299_000)).state;
  expect(state.phase).toBe('candidate');
  state = advanceStopDetector(state, sample(300_000)).state;
  expect(state.phase).toBe('confirmed');
});

test('emits one bounded completed trace after collecting exit evidence', () => {
  let state = advanceStopDetector(initialStopDetectorState(), sample(0)).state;
  state = advanceStopDetector(state, sample(300_000)).state;
  const exiting = advanceStopDetector(state, sample(301_000, { lat: 39.002, speedMps: 10 }));
  expect(exiting.state.phase).toBe('exiting');
  expect(exiting.completed).toBeNull();
  const result = advanceStopDetector(exiting.state, sample(361_000, { lat: 39.004, speedMps: 10 }));
  expect(result.state.phase).toBe('moving');
  expect(result.completed).toMatchObject({ startedAtMs: 0, confirmedAtMs: 300_000, endedAtMs: 301_000 });
  expect(result.completed?.centroid.lat).toBeCloseTo(39);
});

test('poor or unknown GPS accuracy cannot create a candidate', () => {
  expect(advanceStopDetector(initialStopDetectorState(), sample(0, { accuracyM: 200 })).state.phase).toBe('moving');
  expect(advanceStopDetector(initialStopDetectorState(), sample(0, { accuracyM: null })).state.phase).toBe('moving');
});

test('unknown speed cannot be mistaken for stationary', () => {
  expect(advanceStopDetector(initialStopDetectorState(), sample(0, { speedMps: null })).state.phase).toBe('moving');
});

test('traffic creep resets an unconfirmed candidate without producing an event', () => {
  let state = advanceStopDetector(initialStopDetectorState(), sample(0)).state;
  const result = advanceStopDetector(state, sample(120_000, { speedMps: 4 }));
  expect(result.state.phase).toBe('moving');
  expect(result.completed).toBeNull();
});

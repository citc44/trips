import { expect, test } from '@jest/globals';
import { advanceCoffeeStop, type CoffeeStopState, type StopSample } from '@/shared/services/journey-events/coffee-stop-detector';

const sample = (time: number, overrides: Partial<StopSample> = {}): StopSample => ({ lat: 39, lng: -120, capturedAtMs: time, speedMps: 0, accuracyM: 5, ...overrides });

test('confirms only after five continuous stationary minutes', () => {
  let state: CoffeeStopState = { phase: 'moving' };
  state = advanceCoffeeStop(state, sample(0));
  state = advanceCoffeeStop(state, sample(299_000));
  expect(state.phase).toBe('candidate');
  expect(advanceCoffeeStop(state, sample(300_000)).phase).toBe('confirmed');
});

test('exits a confirmed stop after material movement', () => {
  const anchor = sample(0);
  const state: CoffeeStopState = { phase: 'confirmed', anchor, startedAtMs: 0, confirmedAtMs: 300_000 };
  expect(advanceCoffeeStop(state, sample(301_000, { lat: 39.002, speedMps: 10 })).phase).toBe('moving');
});

test('poor accuracy cannot begin a candidate', () => {
  expect(advanceCoffeeStop({ phase: 'moving' }, sample(0, { accuracyM: 200 })).phase).toBe('moving');
});

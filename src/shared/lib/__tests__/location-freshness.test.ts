import { expect, test } from '@jest/globals';
import { getLocationFreshness } from '@/shared/lib/location-freshness';

const now = Date.parse('2026-08-10T12:00:30Z');
const location = (ageMs: number) => ({ userId: 'u1', lat: 39, lng: -120, heading: 0, updatedAt: new Date(now - ageMs).toISOString(), capturedAt: new Date(now - ageMs).toISOString() });

test('ages through live, delayed, stale, and offline states', () => {
  expect(getLocationFreshness(location(1_000), false, now)).toBe('live');
  expect(getLocationFreshness(location(5_000), false, now)).toBe('delayed');
  expect(getLocationFreshness(location(20_000), false, now)).toBe('stale');
  expect(getLocationFreshness(location(31_000), false, now)).toBe('offline_or_suspended');
});

test('presence prevents an offline claim but does not make old GPS live', () => {
  expect(getLocationFreshness(location(60_000), true, now)).toBe('stale');
  expect(getLocationFreshness(undefined, false, now)).toBe('never_reported');
});

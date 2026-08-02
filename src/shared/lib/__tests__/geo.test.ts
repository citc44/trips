import { expect, test } from '@jest/globals';

import { formatDistanceMiles, haversineMiles } from '@/shared/lib/geo';

test('haversineMiles returns 0 for identical coordinates', () => {
  expect(haversineMiles({ lat: 39.0968, lng: -120.0324 }, { lat: 39.0968, lng: -120.0324 })).toBe(0);
});

test('haversineMiles computes the known great-circle distance between San Francisco and Lake Tahoe', () => {
  const sf = { lat: 37.7749, lng: -122.4194 };
  const laketahoe = { lat: 39.0968, lng: -120.0324 };

  expect(haversineMiles(sf, laketahoe)).toBeCloseTo(158, 0);
});

test('formatDistanceMiles shows "At destination" under a tenth of a mile', () => {
  expect(formatDistanceMiles(0.04)).toBe('At destination');
});

test('formatDistanceMiles shows one decimal place under 10 miles', () => {
  expect(formatDistanceMiles(2.34)).toBe('2.3 mi');
});

test('formatDistanceMiles rounds to a whole number at 10 miles or more', () => {
  expect(formatDistanceMiles(172.6)).toBe('173 mi');
});

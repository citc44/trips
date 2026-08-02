import { afterEach, beforeEach, expect, jest, test } from '@jest/globals';

import { geocodingRepository } from '@/repositories/geocoding-repository';

const mockFetch = jest.fn<(...args: any[]) => Promise<any>>();

const ORIGINAL_ENV = process.env.EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN;

beforeEach(() => {
  jest.clearAllMocks();
  process.env.EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN = 'pk.test-token';
  (global as any).fetch = mockFetch;
});

afterEach(() => {
  process.env.EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN = ORIGINAL_ENV;
});

test('returns an empty array without calling fetch for an empty query', async () => {
  const result = await geocodingRepository.searchDestinations('   ');

  expect(result).toEqual({ data: [], error: null });
  expect(mockFetch).not.toHaveBeenCalled();
});

test('maps Mapbox features to place suggestions', async () => {
  mockFetch.mockResolvedValue({
    ok: true,
    json: async () => ({
      features: [
        { id: 'place.1', place_name: 'Lake Tahoe, California, United States', center: [-120.0324, 39.0968] },
        { id: 'place.2', place_name: 'Lake Tahoe, Nevada, United States', center: [-119.9483, 39.1657] },
      ],
    }),
  });

  const result = await geocodingRepository.searchDestinations('Lake Tahoe');

  expect(result).toEqual({
    data: [
      { id: 'place.1', placeName: 'Lake Tahoe, California, United States', lat: 39.0968, lng: -120.0324 },
      { id: 'place.2', placeName: 'Lake Tahoe, Nevada, United States', lat: 39.1657, lng: -119.9483 },
    ],
    error: null,
  });
});

test('URL-encodes the query and includes the access token', async () => {
  mockFetch.mockResolvedValue({ ok: true, json: async () => ({ features: [] }) });

  await geocodingRepository.searchDestinations('Cape Cod, MA');

  const calledUrl = mockFetch.mock.calls[0][0] as string;
  expect(calledUrl).toContain(encodeURIComponent('Cape Cod, MA'));
  expect(calledUrl).toContain('access_token=pk.test-token');
});

test('returns an error when the Mapbox token is not configured', async () => {
  delete process.env.EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN;

  const result = await geocodingRepository.searchDestinations('Lake Tahoe');

  expect(result.data).toBeNull();
  expect(result.error?.code).toBe('missing_token');
  expect(mockFetch).not.toHaveBeenCalled();
});

test('returns an error when the response is not ok', async () => {
  mockFetch.mockResolvedValue({ ok: false, status: 500, json: async () => ({}) });

  const result = await geocodingRepository.searchDestinations('Lake Tahoe');

  expect(result.data).toBeNull();
  expect(result.error?.code).toBe('500');
});

test('returns an error when fetch rejects', async () => {
  mockFetch.mockRejectedValue(new Error('network down'));

  const result = await geocodingRepository.searchDestinations('Lake Tahoe');

  expect(result.data).toBeNull();
  expect(result.error?.code).toBe('unknown');
});

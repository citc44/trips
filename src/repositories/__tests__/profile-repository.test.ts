import { expect, jest, test, beforeEach } from '@jest/globals';

import { profileRepository } from '@/repositories/profile-repository';

const mockMaybeSingle = jest.fn<(...args: any[]) => Promise<any>>();
const mockEq = jest.fn(() => ({ maybeSingle: mockMaybeSingle }));
const mockSelectForGet = jest.fn(() => ({ eq: mockEq }));

const mockSingle = jest.fn<(...args: any[]) => Promise<any>>();
const mockSelectForUpsert = jest.fn(() => ({ single: mockSingle }));
const mockUpsert = jest.fn(() => ({ select: mockSelectForUpsert }));

const mockFrom = jest.fn((..._args: unknown[]) => ({
  select: mockSelectForGet,
  upsert: mockUpsert,
}));

jest.mock('@/lib/supabase', () => ({
  supabase: {
    from: (...args: unknown[]) => mockFrom(...args),
  },
}));

beforeEach(() => {
  jest.clearAllMocks();
});

test('getProfile queries the profiles table filtered by user_id', async () => {
  mockMaybeSingle.mockResolvedValue({ data: null, error: null });

  await profileRepository.getProfile('user-1');

  expect(mockFrom).toHaveBeenCalledWith('profiles');
  expect(mockSelectForGet).toHaveBeenCalledWith('*');
  expect(mockEq).toHaveBeenCalledWith('user_id', 'user-1');
});

test('getProfile returns null data with no error when no row exists', async () => {
  mockMaybeSingle.mockResolvedValue({ data: null, error: null });

  const result = await profileRepository.getProfile('user-1');

  expect(result).toEqual({ data: null, error: null });
});

test('getProfile returns mapped profile data when a row exists', async () => {
  mockMaybeSingle.mockResolvedValue({
    data: { user_id: 'user-1', trust_moment_seen_at: '2026-07-26T00:00:00Z', driver_consent_seen_at: null },
    error: null,
  });

  const result = await profileRepository.getProfile('user-1');

  expect(result).toEqual({
    data: { userId: 'user-1', trustMomentSeenAt: '2026-07-26T00:00:00Z', driverConsentSeenAt: null },
    error: null,
  });
});

test('getProfile returns a typed { code, message } error, never the raw Supabase error object', async () => {
  mockMaybeSingle.mockResolvedValue({ data: null, error: { code: '42501', message: 'permission denied' } });

  const result = await profileRepository.getProfile('user-1');

  expect(result).toEqual({ data: null, error: { code: '42501', message: 'permission denied' } });
});

test('markTrustMomentSeen upserts trust_moment_seen_at only, keyed on user_id', async () => {
  mockSingle.mockResolvedValue({
    data: { user_id: 'user-1', trust_moment_seen_at: '2026-07-26T00:00:00Z', driver_consent_seen_at: null },
    error: null,
  });

  await profileRepository.markTrustMomentSeen('user-1');

  expect(mockUpsert).toHaveBeenCalledWith(
    { user_id: 'user-1', trust_moment_seen_at: expect.any(String) },
    { onConflict: 'user_id' },
  );
});

test('markTrustMomentSeen returns the mapped, updated profile', async () => {
  mockSingle.mockResolvedValue({
    data: { user_id: 'user-1', trust_moment_seen_at: '2026-07-26T00:00:00Z', driver_consent_seen_at: null },
    error: null,
  });

  const result = await profileRepository.markTrustMomentSeen('user-1');

  expect(result).toEqual({
    data: { userId: 'user-1', trustMomentSeenAt: '2026-07-26T00:00:00Z', driverConsentSeenAt: null },
    error: null,
  });
});

test('markTrustMomentSeen returns a typed { code, message } error on failure', async () => {
  mockSingle.mockResolvedValue({ data: null, error: { code: '23505', message: 'conflict' } });

  const result = await profileRepository.markTrustMomentSeen('user-1');

  expect(result).toEqual({ data: null, error: { code: '23505', message: 'conflict' } });
});

import { expect, jest, test, beforeEach } from '@jest/globals';

import { profileRepository } from '@/repositories/profile-repository';

const mockMaybeSingle = jest.fn<(...args: any[]) => Promise<any>>();
const mockEq = jest.fn(() => ({ maybeSingle: mockMaybeSingle }));
const mockSelectForGet = jest.fn(() => ({ eq: mockEq }));

const mockFrom = jest.fn((..._args: unknown[]) => ({
  select: mockSelectForGet,
}));

const mockRpc = jest.fn<(...args: any[]) => Promise<any>>();

jest.mock('@/lib/supabase', () => ({
  supabase: {
    from: (...args: unknown[]) => mockFrom(...args),
    rpc: (...args: unknown[]) => mockRpc(...args),
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
    data: { user_id: 'user-1', trust_moment_seen_at: '2026-07-26T00:00:00Z', driver_consent_seen_at: null, display_name: 'Chintan' },
    error: null,
  });

  const result = await profileRepository.getProfile('user-1');

  expect(result).toEqual({
    data: { userId: 'user-1', trustMomentSeenAt: '2026-07-26T00:00:00Z', driverConsentSeenAt: null, displayName: 'Chintan' },
    error: null,
  });
});

test('getProfile maps a null display_name to null (before the onboarding step sets one)', async () => {
  mockMaybeSingle.mockResolvedValue({
    data: { user_id: 'user-1', trust_moment_seen_at: '2026-07-26T00:00:00Z', driver_consent_seen_at: null, display_name: null },
    error: null,
  });

  const result = await profileRepository.getProfile('user-1');

  expect(result.data?.displayName).toBeNull();
});

test('getProfile returns a typed { code, message } error, never the raw Supabase error object', async () => {
  mockMaybeSingle.mockResolvedValue({ data: null, error: { code: '42501', message: 'permission denied' } });

  const result = await profileRepository.getProfile('user-1');

  expect(result).toEqual({ data: null, error: { code: '42501', message: 'permission denied' } });
});

test('markTrustMomentSeen calls the server-stamping RPC with no client-supplied timestamp or user id', async () => {
  mockRpc.mockResolvedValue({
    data: { user_id: 'user-1', trust_moment_seen_at: '2026-07-26T00:00:00Z', driver_consent_seen_at: null },
    error: null,
  });

  await profileRepository.markTrustMomentSeen();

  expect(mockRpc).toHaveBeenCalledWith('mark_trust_moment_seen');
});

test('markTrustMomentSeen returns the mapped, updated profile', async () => {
  mockRpc.mockResolvedValue({
    data: { user_id: 'user-1', trust_moment_seen_at: '2026-07-26T00:00:00Z', driver_consent_seen_at: null },
    error: null,
  });

  const result = await profileRepository.markTrustMomentSeen();

  expect(result).toEqual({
    data: { userId: 'user-1', trustMomentSeenAt: '2026-07-26T00:00:00Z', driverConsentSeenAt: null },
    error: null,
  });
});

test('markTrustMomentSeen returns a typed { code, message } error on failure', async () => {
  mockRpc.mockResolvedValue({ data: null, error: { code: '23505', message: 'conflict' } });

  const result = await profileRepository.markTrustMomentSeen();

  expect(result).toEqual({ data: null, error: { code: '23505', message: 'conflict' } });
});

test('markDriverConsentSeen calls the server-stamping RPC with no client-supplied timestamp or user id', async () => {
  mockRpc.mockResolvedValue({
    data: { user_id: 'user-1', trust_moment_seen_at: null, driver_consent_seen_at: '2026-07-26T00:00:00Z' },
    error: null,
  });

  await profileRepository.markDriverConsentSeen();

  expect(mockRpc).toHaveBeenCalledWith('mark_driver_consent_seen');
});

test('markDriverConsentSeen returns the mapped, updated profile', async () => {
  mockRpc.mockResolvedValue({
    data: { user_id: 'user-1', trust_moment_seen_at: null, driver_consent_seen_at: '2026-07-26T00:00:00Z' },
    error: null,
  });

  const result = await profileRepository.markDriverConsentSeen();

  expect(result).toEqual({
    data: { userId: 'user-1', trustMomentSeenAt: null, driverConsentSeenAt: '2026-07-26T00:00:00Z' },
    error: null,
  });
});

test('markDriverConsentSeen returns a typed { code, message } error on failure', async () => {
  mockRpc.mockResolvedValue({ data: null, error: { code: '23505', message: 'conflict' } });

  const result = await profileRepository.markDriverConsentSeen();

  expect(result).toEqual({ data: null, error: { code: '23505', message: 'conflict' } });
});

test('setDisplayName calls the set_display_name RPC with the name', async () => {
  mockRpc.mockResolvedValue({
    data: { user_id: 'user-1', trust_moment_seen_at: null, driver_consent_seen_at: null, display_name: 'Chintan' },
    error: null,
  });

  await profileRepository.setDisplayName('Chintan');

  expect(mockRpc).toHaveBeenCalledWith('set_display_name', { p_display_name: 'Chintan' });
});

test('setDisplayName returns the mapped, updated profile', async () => {
  mockRpc.mockResolvedValue({
    data: { user_id: 'user-1', trust_moment_seen_at: null, driver_consent_seen_at: null, display_name: 'Chintan' },
    error: null,
  });

  const result = await profileRepository.setDisplayName('Chintan');

  expect(result).toEqual({
    data: { userId: 'user-1', trustMomentSeenAt: null, driverConsentSeenAt: null, displayName: 'Chintan' },
    error: null,
  });
});

test('setDisplayName returns a typed { code, message } error on failure (e.g. blank name rejected server-side)', async () => {
  mockRpc.mockResolvedValue({ data: null, error: { code: '22023', message: 'A display name is required.' } });

  const result = await profileRepository.setDisplayName('');

  expect(result).toEqual({ data: null, error: { code: '22023', message: 'A display name is required.' } });
});

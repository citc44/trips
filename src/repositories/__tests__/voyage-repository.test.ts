import { beforeEach, expect, jest, test } from '@jest/globals';

import { voyageRepository } from '@/repositories/voyage-repository';

const mockRpc = jest.fn<(...args: any[]) => Promise<any>>();

jest.mock('@/lib/supabase', () => ({
  supabase: {
    rpc: (...args: unknown[]) => mockRpc(...args),
  },
}));

beforeEach(() => {
  jest.clearAllMocks();
});

test('startVoyage calls the start_voyage RPC with the destination', async () => {
  mockRpc.mockResolvedValue({
    data: {
      id: 'voyage-1',
      destination: 'Lake Tahoe',
      status: 'active',
      created_by: 'user-1',
      created_at: '2026-07-26T00:00:00Z',
      ended_at: null,
      join_code: 'ABCD2345',
    },
    error: null,
  });

  await voyageRepository.startVoyage('Lake Tahoe');

  expect(mockRpc).toHaveBeenCalledWith('start_voyage', { p_destination: 'Lake Tahoe' });
});

test('startVoyage returns the mapped, created Voyage', async () => {
  mockRpc.mockResolvedValue({
    data: {
      id: 'voyage-1',
      destination: 'Lake Tahoe',
      status: 'active',
      created_by: 'user-1',
      created_at: '2026-07-26T00:00:00Z',
      ended_at: null,
      join_code: 'ABCD2345',
    },
    error: null,
  });

  const result = await voyageRepository.startVoyage('Lake Tahoe');

  expect(result).toEqual({
    data: {
      id: 'voyage-1',
      destination: 'Lake Tahoe',
      status: 'active',
      createdBy: 'user-1',
      createdAt: '2026-07-26T00:00:00Z',
      endedAt: null,
      joinCode: 'ABCD2345',
    },
    error: null,
  });
});

test('startVoyage maps a null join_code to null (pre-existing rows created before this column existed)', async () => {
  mockRpc.mockResolvedValue({
    data: {
      id: 'voyage-1',
      destination: 'Lake Tahoe',
      status: 'active',
      created_by: 'user-1',
      created_at: '2026-07-26T00:00:00Z',
      ended_at: null,
      join_code: null,
    },
    error: null,
  });

  const result = await voyageRepository.startVoyage('Lake Tahoe');

  expect(result.data?.joinCode).toBeNull();
});

test('startVoyage returns a typed { code, message } error on generic failure', async () => {
  mockRpc.mockResolvedValue({ data: null, error: { code: '22023', message: 'Destination is required.' } });

  const result = await voyageRepository.startVoyage('');

  expect(result).toEqual({ data: null, error: { code: '22023', message: 'Destination is required.' } });
});

test('startVoyage surfaces the AD-9 rejection as a normal typed error', async () => {
  mockRpc.mockResolvedValue({ data: null, error: { code: 'P0001', message: 'You already have an active Voyage.' } });

  const result = await voyageRepository.startVoyage('Big Sur');

  expect(result).toEqual({ data: null, error: { code: 'P0001', message: 'You already have an active Voyage.' } });
});

test('startVoyage returns a typed error instead of a malformed Voyage if the RPC resolves with no error but no usable data', async () => {
  mockRpc.mockResolvedValue({ data: { id: null, destination: null }, error: null });

  const result = await voyageRepository.startVoyage('Lake Tahoe');

  expect(result.data).toBeNull();
  expect(result.error).not.toBeNull();
});

test('getVoyagePreview calls the get_voyage_preview RPC with the join code', async () => {
  mockRpc.mockResolvedValue({ data: [{ destination: 'Lake Tahoe', status: 'active', voyager_count: 2 }], error: null });

  await voyageRepository.getVoyagePreview('ABCD2345');

  expect(mockRpc).toHaveBeenCalledWith('get_voyage_preview', { p_join_code: 'ABCD2345' });
});

test('getVoyagePreview normalizes the join code to trimmed uppercase before calling the RPC', async () => {
  mockRpc.mockResolvedValue({ data: [{ destination: 'Lake Tahoe', status: 'active', voyager_count: 2 }], error: null });

  await voyageRepository.getVoyagePreview(' abcd2345 ');

  expect(mockRpc).toHaveBeenCalledWith('get_voyage_preview', { p_join_code: 'ABCD2345' });
});

test('getVoyagePreview returns the mapped preview from the RPC row', async () => {
  mockRpc.mockResolvedValue({ data: [{ destination: 'Lake Tahoe', status: 'active', voyager_count: 2 }], error: null });

  const result = await voyageRepository.getVoyagePreview('ABCD2345');

  expect(result).toEqual({
    data: { destination: 'Lake Tahoe', status: 'active', voyagerCount: 2 },
    error: null,
  });
});

test('getVoyagePreview maps an ended Voyage row through unchanged (client decides how to render it)', async () => {
  mockRpc.mockResolvedValue({ data: [{ destination: 'Lake Tahoe', status: 'ended', voyager_count: 3 }], error: null });

  const result = await voyageRepository.getVoyagePreview('ABCD2345');

  expect(result.data?.status).toBe('ended');
});

test('getVoyagePreview returns a typed not-found error for an empty result array (invalid/unknown code)', async () => {
  mockRpc.mockResolvedValue({ data: [], error: null });

  const result = await voyageRepository.getVoyagePreview('BADCODE1');

  expect(result).toEqual({
    data: null,
    error: { code: 'not_found', message: 'This invite link is not valid.' },
  });
});

test('getVoyagePreview returns a typed { code, message } error on RPC failure', async () => {
  mockRpc.mockResolvedValue({ data: null, error: { code: 'unknown', message: 'Network error.' } });

  const result = await voyageRepository.getVoyagePreview('ABCD2345');

  expect(result).toEqual({ data: null, error: { code: 'unknown', message: 'Network error.' } });
});

test('joinVoyage normalizes the join code to trimmed uppercase before calling the RPC', async () => {
  mockRpc.mockResolvedValue({
    data: {
      id: 'voyage-1',
      destination: 'Lake Tahoe',
      status: 'active',
      created_by: 'user-1',
      created_at: '2026-07-26T00:00:00Z',
      ended_at: null,
      join_code: 'ABCD2345',
    },
    error: null,
  });

  await voyageRepository.joinVoyage(' abcd2345 ');

  expect(mockRpc).toHaveBeenCalledWith('join_voyage', { p_join_code: 'ABCD2345' });
});

test('joinVoyage calls the join_voyage RPC with the join code', async () => {
  mockRpc.mockResolvedValue({
    data: {
      id: 'voyage-1',
      destination: 'Lake Tahoe',
      status: 'active',
      created_by: 'user-1',
      created_at: '2026-07-26T00:00:00Z',
      ended_at: null,
      join_code: 'ABCD2345',
    },
    error: null,
  });

  await voyageRepository.joinVoyage('ABCD2345');

  expect(mockRpc).toHaveBeenCalledWith('join_voyage', { p_join_code: 'ABCD2345' });
});

test('joinVoyage returns the mapped, joined Voyage', async () => {
  mockRpc.mockResolvedValue({
    data: {
      id: 'voyage-1',
      destination: 'Lake Tahoe',
      status: 'active',
      created_by: 'user-1',
      created_at: '2026-07-26T00:00:00Z',
      ended_at: null,
      join_code: 'ABCD2345',
    },
    error: null,
  });

  const result = await voyageRepository.joinVoyage('ABCD2345');

  expect(result).toEqual({
    data: {
      id: 'voyage-1',
      destination: 'Lake Tahoe',
      status: 'active',
      createdBy: 'user-1',
      createdAt: '2026-07-26T00:00:00Z',
      endedAt: null,
      joinCode: 'ABCD2345',
    },
    error: null,
  });
});

test('joinVoyage surfaces the AD-9 rejection as a normal typed error', async () => {
  mockRpc.mockResolvedValue({ data: null, error: { code: 'P0001', message: 'You already have an active Voyage.' } });

  const result = await voyageRepository.joinVoyage('ABCD2345');

  expect(result).toEqual({ data: null, error: { code: 'P0001', message: 'You already have an active Voyage.' } });
});

test('joinVoyage surfaces the invalid-code rejection as a normal typed error', async () => {
  mockRpc.mockResolvedValue({ data: null, error: { code: 'JOIN1', message: 'This invite link is not valid.' } });

  const result = await voyageRepository.joinVoyage('BADCODE1');

  expect(result).toEqual({ data: null, error: { code: 'JOIN1', message: 'This invite link is not valid.' } });
});

test('joinVoyage returns a typed error instead of a malformed Voyage if the RPC resolves with no error but no usable data', async () => {
  mockRpc.mockResolvedValue({ data: { id: null }, error: null });

  const result = await voyageRepository.joinVoyage('ABCD2345');

  expect(result.data).toBeNull();
  expect(result.error).not.toBeNull();
});

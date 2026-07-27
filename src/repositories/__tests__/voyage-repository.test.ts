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
    },
    error: null,
  });
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

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

test('joinVoyage surfaces the removed-user rejection as a normal typed error (Story 2.6: old Join Code/Link no longer re-admits a removed Voyager)', async () => {
  mockRpc.mockResolvedValue({ data: null, error: { code: 'JOIN3', message: 'This invite is no longer valid for you.' } });

  const result = await voyageRepository.joinVoyage('ABCD2345');

  expect(result).toEqual({ data: null, error: { code: 'JOIN3', message: 'This invite is no longer valid for you.' } });
});

test('joinVoyage returns a typed error instead of a malformed Voyage if the RPC resolves with no error but no usable data', async () => {
  mockRpc.mockResolvedValue({ data: { id: null }, error: null });

  const result = await voyageRepository.joinVoyage('ABCD2345');

  expect(result.data).toBeNull();
  expect(result.error).not.toBeNull();
});

test('getMyActiveVoyage calls the get_my_active_voyage RPC with no arguments', async () => {
  mockRpc.mockResolvedValue({ data: [], error: null });

  await voyageRepository.getMyActiveVoyage();

  expect(mockRpc).toHaveBeenCalledWith('get_my_active_voyage');
});

test('getMyActiveVoyage returns the mapped active Voyage and role when one exists', async () => {
  mockRpc.mockResolvedValue({
    data: [
      {
        id: 'voyage-1',
        destination: 'Lake Tahoe',
        status: 'active',
        created_by: 'user-1',
        created_at: '2026-07-26T00:00:00Z',
        ended_at: null,
        join_code: 'ABCD2345',
        my_role: 'organizer',
      },
    ],
    error: null,
  });

  const result = await voyageRepository.getMyActiveVoyage();

  expect(result).toEqual({
    data: {
      voyage: {
        id: 'voyage-1',
        destination: 'Lake Tahoe',
        status: 'active',
        createdBy: 'user-1',
        createdAt: '2026-07-26T00:00:00Z',
        endedAt: null,
        joinCode: 'ABCD2345',
      },
      role: 'organizer',
    },
    error: null,
  });
});

test('getMyActiveVoyage returns null data (not an error) when the caller has no active Voyage', async () => {
  mockRpc.mockResolvedValue({ data: [], error: null });

  const result = await voyageRepository.getMyActiveVoyage();

  expect(result).toEqual({ data: null, error: null });
});

test('getMyActiveVoyage returns a typed { code, message } error on RPC failure', async () => {
  mockRpc.mockResolvedValue({ data: null, error: { code: 'unknown', message: 'Network error.' } });

  const result = await voyageRepository.getMyActiveVoyage();

  expect(result).toEqual({ data: null, error: { code: 'unknown', message: 'Network error.' } });
});

test('endVoyage calls the end_voyage RPC with the Voyage id', async () => {
  mockRpc.mockResolvedValue({
    data: [
      {
        id: 'voyage-1',
        destination: 'Lake Tahoe',
        status: 'ended',
        created_by: 'user-1',
        created_at: '2026-07-26T00:00:00Z',
        ended_at: '2026-07-26T05:30:00Z',
        join_code: 'ABCD2345',
        voyager_count: 3,
      },
    ],
    error: null,
  });

  await voyageRepository.endVoyage('voyage-1');

  expect(mockRpc).toHaveBeenCalledWith('end_voyage', { p_voyage_id: 'voyage-1' });
});

test('endVoyage returns the mapped, ended Voyage including the Voyager count', async () => {
  mockRpc.mockResolvedValue({
    data: [
      {
        id: 'voyage-1',
        destination: 'Lake Tahoe',
        status: 'ended',
        created_by: 'user-1',
        created_at: '2026-07-26T00:00:00Z',
        ended_at: '2026-07-26T05:30:00Z',
        join_code: 'ABCD2345',
        voyager_count: 3,
      },
    ],
    error: null,
  });

  const result = await voyageRepository.endVoyage('voyage-1');

  expect(result).toEqual({
    data: {
      id: 'voyage-1',
      destination: 'Lake Tahoe',
      status: 'ended',
      createdBy: 'user-1',
      createdAt: '2026-07-26T00:00:00Z',
      endedAt: '2026-07-26T05:30:00Z',
      joinCode: 'ABCD2345',
      voyagerCount: 3,
    },
    error: null,
  });
});

test('endVoyage surfaces the not-organizer rejection as a normal typed error', async () => {
  mockRpc.mockResolvedValue({ data: null, error: { code: 'END03', message: 'Only the Organizer can end this Voyage.' } });

  const result = await voyageRepository.endVoyage('voyage-1');

  expect(result).toEqual({ data: null, error: { code: 'END03', message: 'Only the Organizer can end this Voyage.' } });
});

test('endVoyage returns a typed error instead of a malformed Voyage if the RPC resolves with no error but no usable data', async () => {
  mockRpc.mockResolvedValue({ data: [], error: null });

  const result = await voyageRepository.endVoyage('voyage-1');

  expect(result.data).toBeNull();
  expect(result.error).not.toBeNull();
});

test('getVoyageMembers calls the get_voyage_members RPC with the Voyage id', async () => {
  mockRpc.mockResolvedValue({ data: [], error: null });

  await voyageRepository.getVoyageMembers('voyage-1');

  expect(mockRpc).toHaveBeenCalledWith('get_voyage_members', { p_voyage_id: 'voyage-1' });
});

test('getVoyageMembers returns the mapped list of members, including player_color and travel_role', async () => {
  mockRpc.mockResolvedValue({
    data: [
      {
        user_id: 'user-1',
        display_name: 'Chintan',
        role: 'organizer',
        joined_at: '2026-07-26T00:00:00Z',
        player_color: 'coral',
        travel_role: 'driving',
      },
      {
        user_id: 'user-2',
        display_name: 'Meera',
        role: 'voyager',
        joined_at: '2026-07-26T00:05:00Z',
        player_color: 'teal',
        travel_role: null,
      },
    ],
    error: null,
  });

  const result = await voyageRepository.getVoyageMembers('voyage-1');

  expect(result).toEqual({
    data: [
      { userId: 'user-1', displayName: 'Chintan', role: 'organizer', joinedAt: '2026-07-26T00:00:00Z', playerColor: 'coral', travelRole: 'driving' },
      { userId: 'user-2', displayName: 'Meera', role: 'voyager', joinedAt: '2026-07-26T00:05:00Z', playerColor: 'teal', travelRole: null },
    ],
    error: null,
  });
});

test('getVoyageMembers returns an empty array (not an error) when the RPC resolves with no rows', async () => {
  mockRpc.mockResolvedValue({ data: [], error: null });

  const result = await voyageRepository.getVoyageMembers('voyage-1');

  expect(result).toEqual({ data: [], error: null });
});

test('getVoyageMembers returns a typed { code, message } error on RPC failure (e.g. not a participant)', async () => {
  mockRpc.mockResolvedValue({ data: null, error: { code: 'MEM01', message: 'You are not a participant of this Voyage.' } });

  const result = await voyageRepository.getVoyageMembers('voyage-1');

  expect(result).toEqual({ data: null, error: { code: 'MEM01', message: 'You are not a participant of this Voyage.' } });
});

test('grantOrganizerStatus calls the grant_organizer_status RPC with the Voyage and target user ids', async () => {
  mockRpc.mockResolvedValue({ data: null, error: null });

  await voyageRepository.grantOrganizerStatus('voyage-1', 'user-2');

  expect(mockRpc).toHaveBeenCalledWith('grant_organizer_status', { p_voyage_id: 'voyage-1', p_target_user_id: 'user-2' });
});

test('grantOrganizerStatus returns no error on success', async () => {
  mockRpc.mockResolvedValue({ data: null, error: null });

  const result = await voyageRepository.grantOrganizerStatus('voyage-1', 'user-2');

  expect(result).toEqual({ error: null });
});

test('grantOrganizerStatus surfaces the not-organizer rejection as a normal typed error', async () => {
  mockRpc.mockResolvedValue({ data: null, error: { code: 'ORG01', message: 'Only an Organizer can grant Organizer status.' } });

  const result = await voyageRepository.grantOrganizerStatus('voyage-1', 'user-2');

  expect(result).toEqual({ error: { code: 'ORG01', message: 'Only an Organizer can grant Organizer status.' } });
});

test('removeVoyager calls the remove_voyager RPC with the Voyage and target user ids', async () => {
  mockRpc.mockResolvedValue({ data: null, error: null });

  await voyageRepository.removeVoyager('voyage-1', 'user-2');

  expect(mockRpc).toHaveBeenCalledWith('remove_voyager', { p_voyage_id: 'voyage-1', p_target_user_id: 'user-2' });
});

test('removeVoyager returns no error on success', async () => {
  mockRpc.mockResolvedValue({ data: null, error: null });

  const result = await voyageRepository.removeVoyager('voyage-1', 'user-2');

  expect(result).toEqual({ error: null });
});

test('removeVoyager surfaces the last-organizer rejection as a normal typed error', async () => {
  mockRpc.mockResolvedValue({ data: null, error: { code: 'REM02', message: 'A Voyage must always have at least one Organizer.' } });

  const result = await voyageRepository.removeVoyager('voyage-1', 'user-1');

  expect(result).toEqual({ error: { code: 'REM02', message: 'A Voyage must always have at least one Organizer.' } });
});

test('removeVoyager surfaces the self-removal rejection as a normal typed error', async () => {
  mockRpc.mockResolvedValue({ data: null, error: { code: 'REM04', message: 'An Organizer cannot remove themselves with this action.' } });

  const result = await voyageRepository.removeVoyager('voyage-1', 'user-1');

  expect(result).toEqual({ error: { code: 'REM04', message: 'An Organizer cannot remove themselves with this action.' } });
});

test('getRemovalNotice calls the get_removal_notice RPC with no arguments', async () => {
  mockRpc.mockResolvedValue({ data: [], error: null });

  await voyageRepository.getRemovalNotice();

  expect(mockRpc).toHaveBeenCalledWith('get_removal_notice');
});

test('getRemovalNotice returns the mapped notice when one exists', async () => {
  mockRpc.mockResolvedValue({ data: [{ voyage_id: 'voyage-1', destination: 'Lake Tahoe' }], error: null });

  const result = await voyageRepository.getRemovalNotice();

  expect(result).toEqual({ data: { voyageId: 'voyage-1', destination: 'Lake Tahoe' }, error: null });
});

test('getRemovalNotice returns null data (not an error) when there is no unacknowledged removal', async () => {
  mockRpc.mockResolvedValue({ data: [], error: null });

  const result = await voyageRepository.getRemovalNotice();

  expect(result).toEqual({ data: null, error: null });
});

test('getRemovalNotice returns a typed { code, message } error on RPC failure', async () => {
  mockRpc.mockResolvedValue({ data: null, error: { code: 'unknown', message: 'Network error.' } });

  const result = await voyageRepository.getRemovalNotice();

  expect(result).toEqual({ data: null, error: { code: 'unknown', message: 'Network error.' } });
});

test('acknowledgeRemoval calls the acknowledge_removal RPC with the Voyage id', async () => {
  mockRpc.mockResolvedValue({ data: null, error: null });

  await voyageRepository.acknowledgeRemoval('voyage-1');

  expect(mockRpc).toHaveBeenCalledWith('acknowledge_removal', { p_voyage_id: 'voyage-1' });
});

test('acknowledgeRemoval returns no error on success', async () => {
  mockRpc.mockResolvedValue({ data: null, error: null });

  const result = await voyageRepository.acknowledgeRemoval('voyage-1');

  expect(result).toEqual({ error: null });
});

test('setTravelRole calls the set_travel_role RPC with the Voyage id and the chosen role', async () => {
  mockRpc.mockResolvedValue({ data: null, error: null });

  await voyageRepository.setTravelRole('voyage-1', 'driving');

  expect(mockRpc).toHaveBeenCalledWith('set_travel_role', { p_voyage_id: 'voyage-1', p_travel_role: 'driving' });
});

test('setTravelRole returns no error on success', async () => {
  mockRpc.mockResolvedValue({ data: null, error: null });

  const result = await voyageRepository.setTravelRole('voyage-1', 'riding');

  expect(result).toEqual({ error: null });
});

test('setTravelRole surfaces the not-an-active-member rejection as a normal typed error', async () => {
  mockRpc.mockResolvedValue({ data: null, error: { code: 'ROL01', message: 'You are not an active member of this Voyage.' } });

  const result = await voyageRepository.setTravelRole('voyage-1', 'driving');

  expect(result).toEqual({ error: { code: 'ROL01', message: 'You are not an active member of this Voyage.' } });
});

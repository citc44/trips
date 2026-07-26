import { beforeEach, expect, jest, test } from '@jest/globals';
import { act, render, waitFor } from '@testing-library/react-native';
import { Text } from 'react-native';

import { ProfileProvider, useProfile } from '@/shared/hooks/use-profile';

const mockUseAuth = jest.fn<(...args: any[]) => any>();
jest.mock('@/shared/hooks/use-auth', () => ({
  useAuth: () => mockUseAuth(),
}));

const mockGetProfile = jest.fn<(...args: any[]) => Promise<any>>();
const mockMarkTrustMomentSeen = jest.fn<(...args: any[]) => Promise<any>>();
jest.mock('@/repositories/profile-repository', () => ({
  profileRepository: {
    getProfile: (...args: unknown[]) => mockGetProfile(...args),
    markTrustMomentSeen: (...args: unknown[]) => mockMarkTrustMomentSeen(...args),
  },
}));

function Probe() {
  const { profile, isLoading } = useProfile();
  return (
    <Text testID="probe">
      {isLoading ? 'loading' : profile ? (profile.trustMomentSeenAt ? 'seen' : 'unseen') : 'no-profile'}
    </Text>
  );
}

function ActionsProbe() {
  const { markTrustMomentSeen } = useProfile();
  return <Text testID="mark" onPress={() => markTrustMomentSeen()} />;
}

beforeEach(() => {
  jest.clearAllMocks();
});

test('resolves to no-profile (not loading) when there is no session', async () => {
  mockUseAuth.mockReturnValue({ session: null });

  const { getByTestId } = await render(
    <ProfileProvider>
      <Probe />
    </ProfileProvider>,
  );

  await waitFor(() => expect(getByTestId('probe').props.children).toBe('no-profile'));
  expect(mockGetProfile).not.toHaveBeenCalled();
});

test('fetches and exposes profile data when a session exists', async () => {
  mockUseAuth.mockReturnValue({ session: { user: { id: 'user-1' } } });
  mockGetProfile.mockResolvedValue({
    data: { userId: 'user-1', trustMomentSeenAt: null, driverConsentSeenAt: null },
    error: null,
  });

  const { getByTestId } = await render(
    <ProfileProvider>
      <Probe />
    </ProfileProvider>,
  );

  await waitFor(() => expect(getByTestId('probe').props.children).toBe('unseen'));
  expect(mockGetProfile).toHaveBeenCalledWith('user-1');
});

test('exposes profile with trustMomentSeenAt set when already seen', async () => {
  mockUseAuth.mockReturnValue({ session: { user: { id: 'user-1' } } });
  mockGetProfile.mockResolvedValue({
    data: { userId: 'user-1', trustMomentSeenAt: '2026-07-26T00:00:00Z', driverConsentSeenAt: null },
    error: null,
  });

  const { getByTestId } = await render(
    <ProfileProvider>
      <Probe />
    </ProfileProvider>,
  );

  await waitFor(() => expect(getByTestId('probe').props.children).toBe('seen'));
});

test('resolves to no-profile (not stuck loading) when getProfile rejects', async () => {
  mockUseAuth.mockReturnValue({ session: { user: { id: 'user-1' } } });
  mockGetProfile.mockRejectedValue(new Error('network error'));

  const { getByTestId } = await render(
    <ProfileProvider>
      <Probe />
    </ProfileProvider>,
  );

  await waitFor(() => expect(getByTestId('probe').props.children).toBe('no-profile'));
});

test('markTrustMomentSeen calls the repository with the session user id and updates local state', async () => {
  mockUseAuth.mockReturnValue({ session: { user: { id: 'user-1' } } });
  mockGetProfile.mockResolvedValue({
    data: { userId: 'user-1', trustMomentSeenAt: null, driverConsentSeenAt: null },
    error: null,
  });
  mockMarkTrustMomentSeen.mockResolvedValue({
    data: { userId: 'user-1', trustMomentSeenAt: '2026-07-26T00:00:00Z', driverConsentSeenAt: null },
    error: null,
  });

  const { getByTestId } = await render(
    <ProfileProvider>
      <ActionsProbe />
      <Probe />
    </ProfileProvider>,
  );

  await waitFor(() => expect(getByTestId('probe').props.children).toBe('unseen'));

  await act(async () => {
    await getByTestId('mark').props.onPress();
  });

  expect(mockMarkTrustMomentSeen).toHaveBeenCalledWith('user-1');
  await waitFor(() => expect(getByTestId('probe').props.children).toBe('seen'));
});

test('markTrustMomentSeen returns an error without updating state when the repository call fails', async () => {
  mockUseAuth.mockReturnValue({ session: { user: { id: 'user-1' } } });
  mockGetProfile.mockResolvedValue({
    data: { userId: 'user-1', trustMomentSeenAt: null, driverConsentSeenAt: null },
    error: null,
  });
  mockMarkTrustMomentSeen.mockResolvedValue({
    data: null,
    error: { code: '42501', message: 'permission denied' },
  });

  const { getByTestId } = await render(
    <ProfileProvider>
      <ActionsProbe />
      <Probe />
    </ProfileProvider>,
  );

  await waitFor(() => expect(getByTestId('probe').props.children).toBe('unseen'));

  let result: any;
  await act(async () => {
    result = await getByTestId('mark').props.onPress();
  });

  expect(result).toEqual({ error: { code: '42501', message: 'permission denied' } });
  expect(getByTestId('probe').props.children).toBe('unseen');
});

test('resets profile to null when the session goes away (e.g. sign-out)', async () => {
  mockUseAuth.mockReturnValue({ session: { user: { id: 'user-1' } } });
  mockGetProfile.mockResolvedValue({
    data: { userId: 'user-1', trustMomentSeenAt: '2026-07-26T00:00:00Z', driverConsentSeenAt: null },
    error: null,
  });

  const { getByTestId, rerender } = await render(
    <ProfileProvider>
      <Probe />
    </ProfileProvider>,
  );

  await waitFor(() => expect(getByTestId('probe').props.children).toBe('seen'));

  mockUseAuth.mockReturnValue({ session: null });
  await rerender(
    <ProfileProvider>
      <Probe />
    </ProfileProvider>,
  );

  await waitFor(() => expect(getByTestId('probe').props.children).toBe('no-profile'));
});

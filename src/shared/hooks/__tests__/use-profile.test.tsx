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
const mockMarkDriverConsentSeen = jest.fn<(...args: any[]) => Promise<any>>();
const mockSetDisplayName = jest.fn<(...args: any[]) => Promise<any>>();
jest.mock('@/repositories/profile-repository', () => ({
  profileRepository: {
    getProfile: (...args: unknown[]) => mockGetProfile(...args),
    markTrustMomentSeen: (...args: unknown[]) => mockMarkTrustMomentSeen(...args),
    markDriverConsentSeen: (...args: unknown[]) => mockMarkDriverConsentSeen(...args),
    setDisplayName: (...args: unknown[]) => mockSetDisplayName(...args),
  },
}));

function Probe() {
  const { profile, isLoading, hasError } = useProfile();
  return (
    <Text testID="probe">
      {isLoading ? 'loading' : profile ? (profile.trustMomentSeenAt ? 'seen' : 'unseen') : hasError ? 'error' : 'no-profile'}
    </Text>
  );
}

function ActionsProbe() {
  const { markTrustMomentSeen } = useProfile();
  return <Text testID="mark" onPress={() => markTrustMomentSeen()} />;
}

function DriverConsentProbe() {
  const { profile } = useProfile();
  return <Text testID="driver-probe">{profile ? (profile.driverConsentSeenAt ? 'seen' : 'unseen') : 'no-profile'}</Text>;
}

function DriverConsentActionsProbe() {
  const { markDriverConsentSeen } = useProfile();
  return <Text testID="mark-driver" onPress={() => markDriverConsentSeen()} />;
}

function DisplayNameProbe() {
  const { profile } = useProfile();
  return <Text testID="display-name-probe">{profile?.displayName ?? 'no-name'}</Text>;
}

function DisplayNameActionsProbe() {
  const { setDisplayName } = useProfile();
  return <Text testID="set-display-name" onPress={() => setDisplayName('Chintan')} />;
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

test('isLoading goes back to true the moment a session first arrives, not staying stale-false (Story 1.4 code review regression test)', async () => {
  // Reproduces the exact sequence that produced the original bug: session starts
  // null (as it always does before useAuth's async getSession() resolves), the
  // "no session" branch resolves isLoading to false, and only *then* does a real
  // session arrive -- simulating a returning, already-onboarded user's app relaunch.
  mockUseAuth.mockReturnValue({ session: null });

  const { getByTestId, rerender } = await render(
    <ProfileProvider>
      <Probe />
    </ProfileProvider>,
  );

  await waitFor(() => expect(getByTestId('probe').props.children).toBe('no-profile'));

  let resolveGetProfile: (value: any) => void;
  mockGetProfile.mockReturnValue(
    new Promise((resolve) => {
      resolveGetProfile = resolve;
    }),
  );
  mockUseAuth.mockReturnValue({ session: { user: { id: 'user-1' } } });
  await rerender(
    <ProfileProvider>
      <Probe />
    </ProfileProvider>,
  );

  // Before the fetch resolves, isLoading must already be true again -- if it were
  // still stale-false here, the caller (e.g. _layout.tsx's guard) would open on a
  // still-null profile and flash the wrong screen.
  expect(getByTestId('probe').props.children).toBe('loading');

  await act(async () => {
    resolveGetProfile({
      data: { userId: 'user-1', trustMomentSeenAt: '2026-07-26T00:00:00Z', driverConsentSeenAt: null },
      error: null,
    });
  });

  await waitFor(() => expect(getByTestId('probe').props.children).toBe('seen'));
});

test('exposes hasError (not stuck loading) when getProfile rejects -- fails open, not treated as "never seen"', async () => {
  mockUseAuth.mockReturnValue({ session: { user: { id: 'user-1' } } });
  mockGetProfile.mockRejectedValue(new Error('network error'));

  const { getByTestId } = await render(
    <ProfileProvider>
      <Probe />
    </ProfileProvider>,
  );

  await waitFor(() => expect(getByTestId('probe').props.children).toBe('error'));
});

test('exposes hasError when getProfile resolves with an error', async () => {
  mockUseAuth.mockReturnValue({ session: { user: { id: 'user-1' } } });
  mockGetProfile.mockResolvedValue({ data: null, error: { code: '500', message: 'network blip' } });

  const { getByTestId } = await render(
    <ProfileProvider>
      <Probe />
    </ProfileProvider>,
  );

  await waitFor(() => expect(getByTestId('probe').props.children).toBe('error'));
});

test('clears hasError once a subsequent fetch succeeds', async () => {
  mockUseAuth.mockReturnValue({ session: { user: { id: 'user-1' } } });
  mockGetProfile.mockRejectedValueOnce(new Error('network error'));

  const { getByTestId, rerender } = await render(
    <ProfileProvider>
      <Probe />
    </ProfileProvider>,
  );

  await waitFor(() => expect(getByTestId('probe').props.children).toBe('error'));

  mockGetProfile.mockResolvedValue({
    data: { userId: 'user-1', trustMomentSeenAt: null, driverConsentSeenAt: null },
    error: null,
  });
  mockUseAuth.mockReturnValue({ session: { user: { id: 'user-2' } } });
  await rerender(
    <ProfileProvider>
      <Probe />
    </ProfileProvider>,
  );

  await waitFor(() => expect(getByTestId('probe').props.children).toBe('unseen'));
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

  expect(mockMarkTrustMomentSeen).toHaveBeenCalledWith();
  await waitFor(() => expect(getByTestId('probe').props.children).toBe('seen'));
});

test('discards a stale markTrustMomentSeen response if the session changed while it was in flight (e.g. sign-out mid-request)', async () => {
  mockUseAuth.mockReturnValue({ session: { user: { id: 'user-1' } } });
  mockGetProfile.mockResolvedValue({
    data: { userId: 'user-1', trustMomentSeenAt: null, driverConsentSeenAt: null },
    error: null,
  });

  let resolveMark: (value: any) => void;
  mockMarkTrustMomentSeen.mockReturnValue(
    new Promise((resolve) => {
      resolveMark = resolve;
    }),
  );

  const { getByTestId, rerender } = await render(
    <ProfileProvider>
      <ActionsProbe />
      <Probe />
    </ProfileProvider>,
  );

  await waitFor(() => expect(getByTestId('probe').props.children).toBe('unseen'));

  let pressPromise: Promise<any>;
  await act(async () => {
    pressPromise = getByTestId('mark').props.onPress();
  });

  // Session goes away mid-request (e.g. sign-out) before the RPC call resolves.
  mockUseAuth.mockReturnValue({ session: null });
  await act(async () => {
    await rerender(
      <ProfileProvider>
        <ActionsProbe />
        <Probe />
      </ProfileProvider>,
    );
  });
  await waitFor(() => expect(getByTestId('probe').props.children).toBe('no-profile'));

  await act(async () => {
    resolveMark({
      data: { userId: 'user-1', trustMomentSeenAt: '2026-07-26T00:00:00Z', driverConsentSeenAt: null },
      error: null,
    });
    await pressPromise;
  });

  // The stale response for the now-signed-out user-1 must not resurrect profile state.
  expect(getByTestId('probe').props.children).toBe('no-profile');
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

test('markDriverConsentSeen calls the repository and updates local state', async () => {
  mockUseAuth.mockReturnValue({ session: { user: { id: 'user-1' } } });
  mockGetProfile.mockResolvedValue({
    data: { userId: 'user-1', trustMomentSeenAt: '2026-07-26T00:00:00Z', driverConsentSeenAt: null },
    error: null,
  });
  mockMarkDriverConsentSeen.mockResolvedValue({
    data: { userId: 'user-1', trustMomentSeenAt: '2026-07-26T00:00:00Z', driverConsentSeenAt: '2026-07-26T00:05:00Z' },
    error: null,
  });

  const { getByTestId } = await render(
    <ProfileProvider>
      <DriverConsentActionsProbe />
      <DriverConsentProbe />
    </ProfileProvider>,
  );

  await waitFor(() => expect(getByTestId('driver-probe').props.children).toBe('unseen'));

  await act(async () => {
    await getByTestId('mark-driver').props.onPress();
  });

  expect(mockMarkDriverConsentSeen).toHaveBeenCalledWith();
  await waitFor(() => expect(getByTestId('driver-probe').props.children).toBe('seen'));
});

test('discards a stale markDriverConsentSeen response if the session changed while it was in flight', async () => {
  mockUseAuth.mockReturnValue({ session: { user: { id: 'user-1' } } });
  mockGetProfile.mockResolvedValue({
    data: { userId: 'user-1', trustMomentSeenAt: '2026-07-26T00:00:00Z', driverConsentSeenAt: null },
    error: null,
  });

  let resolveMark: (value: any) => void;
  mockMarkDriverConsentSeen.mockReturnValue(
    new Promise((resolve) => {
      resolveMark = resolve;
    }),
  );

  const { getByTestId, rerender } = await render(
    <ProfileProvider>
      <DriverConsentActionsProbe />
      <DriverConsentProbe />
    </ProfileProvider>,
  );

  await waitFor(() => expect(getByTestId('driver-probe').props.children).toBe('unseen'));

  let pressPromise: Promise<any>;
  await act(async () => {
    pressPromise = getByTestId('mark-driver').props.onPress();
  });

  mockUseAuth.mockReturnValue({ session: null });
  await act(async () => {
    await rerender(
      <ProfileProvider>
        <DriverConsentActionsProbe />
        <DriverConsentProbe />
      </ProfileProvider>,
    );
  });
  await waitFor(() => expect(getByTestId('driver-probe').props.children).toBe('no-profile'));

  await act(async () => {
    resolveMark({
      data: { userId: 'user-1', trustMomentSeenAt: '2026-07-26T00:00:00Z', driverConsentSeenAt: '2026-07-26T00:05:00Z' },
      error: null,
    });
    await pressPromise;
  });

  expect(getByTestId('driver-probe').props.children).toBe('no-profile');
});

test('markDriverConsentSeen returns an error without updating state when the repository call fails', async () => {
  mockUseAuth.mockReturnValue({ session: { user: { id: 'user-1' } } });
  mockGetProfile.mockResolvedValue({
    data: { userId: 'user-1', trustMomentSeenAt: '2026-07-26T00:00:00Z', driverConsentSeenAt: null },
    error: null,
  });
  mockMarkDriverConsentSeen.mockResolvedValue({
    data: null,
    error: { code: '42501', message: 'permission denied' },
  });

  const { getByTestId } = await render(
    <ProfileProvider>
      <DriverConsentActionsProbe />
      <DriverConsentProbe />
    </ProfileProvider>,
  );

  await waitFor(() => expect(getByTestId('driver-probe').props.children).toBe('unseen'));

  let result: any;
  await act(async () => {
    result = await getByTestId('mark-driver').props.onPress();
  });

  expect(result).toEqual({ error: { code: '42501', message: 'permission denied' } });
  expect(getByTestId('driver-probe').props.children).toBe('unseen');
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

test('setDisplayName calls the repository with the name and updates local state', async () => {
  mockUseAuth.mockReturnValue({ session: { user: { id: 'user-1' } } });
  mockGetProfile.mockResolvedValue({
    data: { userId: 'user-1', trustMomentSeenAt: null, driverConsentSeenAt: null, displayName: null },
    error: null,
  });
  mockSetDisplayName.mockResolvedValue({
    data: { userId: 'user-1', trustMomentSeenAt: null, driverConsentSeenAt: null, displayName: 'Chintan' },
    error: null,
  });

  const { getByTestId } = await render(
    <ProfileProvider>
      <DisplayNameActionsProbe />
      <DisplayNameProbe />
    </ProfileProvider>,
  );

  await waitFor(() => expect(getByTestId('display-name-probe').props.children).toBe('no-name'));

  await act(async () => {
    await getByTestId('set-display-name').props.onPress();
  });

  expect(mockSetDisplayName).toHaveBeenCalledWith('Chintan');
  await waitFor(() => expect(getByTestId('display-name-probe').props.children).toBe('Chintan'));
});

test('setDisplayName returns an error without updating state when the repository call fails', async () => {
  mockUseAuth.mockReturnValue({ session: { user: { id: 'user-1' } } });
  mockGetProfile.mockResolvedValue({
    data: { userId: 'user-1', trustMomentSeenAt: null, driverConsentSeenAt: null, displayName: null },
    error: null,
  });
  mockSetDisplayName.mockResolvedValue({ data: null, error: { code: '22023', message: 'A display name is required.' } });

  const { getByTestId } = await render(
    <ProfileProvider>
      <DisplayNameActionsProbe />
      <DisplayNameProbe />
    </ProfileProvider>,
  );

  await waitFor(() => expect(getByTestId('display-name-probe').props.children).toBe('no-name'));

  let result: any;
  await act(async () => {
    result = await getByTestId('set-display-name').props.onPress();
  });

  expect(result).toEqual({ error: { code: '22023', message: 'A display name is required.' } });
  expect(getByTestId('display-name-probe').props.children).toBe('no-name');
});

import { beforeEach, expect, jest, test } from '@jest/globals';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';

import { voyageRepository } from '@/repositories/voyage-repository';
import { useAuth } from '@/shared/hooks/use-auth';
import { PendingJoinProvider } from '@/shared/hooks/use-pending-join';
import { useProfile } from '@/shared/hooks/use-profile';

import JoinInvitationScreen from '../join/[code]';

const mockPush = jest.fn();
const mockReplace = jest.fn();
const mockClearJustStartedVoyage = jest.fn();
const mockUseLocalSearchParams = jest.fn();
const mockUseActiveVoyage = jest.fn<() => any>();
jest.mock('expo-router', () => {
  const actual = jest.requireActual('expo-router') as object;
  return {
    ...actual,
    router: { push: (...args: unknown[]) => mockPush(...args), replace: (...args: unknown[]) => mockReplace(...args) },
    useLocalSearchParams: () => mockUseLocalSearchParams(),
  };
});

jest.mock('@/repositories/voyage-repository', () => ({
  voyageRepository: { getVoyagePreview: jest.fn() },
}));

jest.mock('@/shared/hooks/use-auth', () => ({
  useAuth: jest.fn(),
}));

jest.mock('@/shared/hooks/use-profile', () => ({
  useProfile: jest.fn(),
}));

jest.mock('@/shared/hooks/use-active-voyage', () => ({
  useActiveVoyage: () => mockUseActiveVoyage(),
}));

jest.mock('@/shared/hooks/use-just-started-voyage', () => ({
  useJustStartedVoyage: () => ({
    hasJustStartedVoyage: true,
    markVoyageStarted: jest.fn(),
    clearJustStartedVoyage: mockClearJustStartedVoyage,
  }),
}));

const mockGetVoyagePreview = voyageRepository.getVoyagePreview as jest.MockedFunction<typeof voyageRepository.getVoyagePreview>;
const mockUseAuth = useAuth as jest.MockedFunction<typeof useAuth>;
const mockUseProfile = useProfile as jest.MockedFunction<typeof useProfile>;

// Real PendingJoinProvider (not mocked) -- the fix under test depends on a
// genuine React state transition (pendingJoinCode committing after
// setPendingJoinCode) to drive the navigation effect; a static jest.fn() mock
// can't reproduce that re-render.
function renderScreen() {
  return render(
    <PendingJoinProvider>
      <JoinInvitationScreen />
    </PendingJoinProvider>,
  );
}

function mockAuth(session: { user: { id: string } } | null) {
  mockUseAuth.mockReturnValue({
    session: session as any,
    isLoading: false,
    signInWithEmail: jest.fn<(...args: any[]) => Promise<any>>(),
    verifyCode: jest.fn<(...args: any[]) => Promise<any>>(),
    signOut: jest.fn<(...args: any[]) => Promise<any>>(),
  });
}

function mockProfile(
  overrides: { trustMomentSeenAt?: string | null; driverConsentSeenAt?: string | null; displayName?: string | null } = {},
) {
  mockUseProfile.mockReturnValue({
    profile: {
      userId: 'user-1',
      trustMomentSeenAt: overrides.trustMomentSeenAt ?? null,
      driverConsentSeenAt: overrides.driverConsentSeenAt ?? null,
      displayName: overrides.displayName ?? null,
    } as any,
    isLoading: false,
    hasError: false,
    markTrustMomentSeen: jest.fn<(...args: any[]) => Promise<any>>(),
    markDriverConsentSeen: jest.fn<(...args: any[]) => Promise<any>>(),
    setDisplayName: jest.fn<(...args: any[]) => Promise<any>>(),
  });
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockUseActiveVoyage.mockReturnValue({ activeVoyage: null });
  mockUseLocalSearchParams.mockReturnValue({ code: 'ABCD2345' });
  mockAuth(null);
  mockProfile();
});

test('shows the invitation with destination and Voyager count on a valid, active code', async () => {
  mockGetVoyagePreview.mockResolvedValue({ data: { destination: 'Lake Tahoe', status: 'active', voyagerCount: 2 }, error: null });

  const { getByText, getByTestId } = await renderScreen();

  await waitFor(() => expect(getByText(/Lake Tahoe/)).toBeTruthy());
  expect(getByTestId('join-the-voyage-button')).toBeTruthy();
});

test('shows an invalid-link message for an unknown code, with a way back to Home', async () => {
  mockGetVoyagePreview.mockResolvedValue({ data: null, error: { code: 'not_found', message: 'This invite link is not valid.' } });

  const { getByTestId } = await renderScreen();

  await waitFor(() => expect(getByTestId('invitation-invalid')).toBeTruthy());
  expect(getByTestId('invitation-invalid-home-button')).toBeTruthy();

  await act(async () => {
    fireEvent.press(getByTestId('invitation-invalid-home-button'));
  });
  expect(mockPush).toHaveBeenCalledWith('/sign-in');
});

test('the invalid-link recovery button goes straight Home when already authenticated and onboarded', async () => {
  mockAuth({ user: { id: 'user-1' } });
  mockProfile({ trustMomentSeenAt: '2026-01-01T00:00:00Z', driverConsentSeenAt: '2026-01-01T00:00:00Z', displayName: 'Chintan' });
  mockGetVoyagePreview.mockResolvedValue({ data: null, error: { code: 'not_found', message: 'This invite link is not valid.' } });

  const { getByTestId } = await renderScreen();
  await waitFor(() => expect(getByTestId('invitation-invalid-home-button')).toBeTruthy());

  await act(async () => {
    fireEvent.press(getByTestId('invitation-invalid-home-button'));
  });
  expect(mockPush).toHaveBeenCalledWith('/');
});

test('the invalid-link recovery button routes to display-name when authenticated, onboarded, but no display name set yet (code review finding)', async () => {
  mockAuth({ user: { id: 'user-1' } });
  mockProfile({ trustMomentSeenAt: '2026-01-01T00:00:00Z', driverConsentSeenAt: '2026-01-01T00:00:00Z', displayName: null });
  mockGetVoyagePreview.mockResolvedValue({ data: null, error: { code: 'not_found', message: 'This invite link is not valid.' } });

  const { getByTestId } = await renderScreen();
  await waitFor(() => expect(getByTestId('invitation-invalid-home-button')).toBeTruthy());

  await act(async () => {
    fireEvent.press(getByTestId('invitation-invalid-home-button'));
  });
  expect(mockPush).toHaveBeenCalledWith('/display-name');
});

test('shows the "already wrapped up" state for an ended Voyage, with a CTA to start a new one', async () => {
  mockGetVoyagePreview.mockResolvedValue({ data: { destination: 'Lake Tahoe', status: 'ended', voyagerCount: 3 }, error: null });

  const { getByTestId } = await renderScreen();

  await waitFor(() => expect(getByTestId('invitation-ended')).toBeTruthy());
  expect(getByTestId('start-your-own-voyage-button')).toBeTruthy();
});

test('re-fetches and resets prior state when the code param changes', async () => {
  mockGetVoyagePreview.mockResolvedValueOnce({ data: null, error: { code: 'not_found', message: 'This invite link is not valid.' } });

  const { getByTestId, rerender } = await renderScreen();
  await waitFor(() => expect(getByTestId('invitation-invalid')).toBeTruthy());

  mockGetVoyagePreview.mockResolvedValueOnce({ data: { destination: 'Big Sur', status: 'active', voyagerCount: 1 }, error: null });
  mockUseLocalSearchParams.mockReturnValue({ code: 'WXYZ6789' });

  await act(async () => {
    rerender(
      <PendingJoinProvider>
        <JoinInvitationScreen />
      </PendingJoinProvider>,
    );
  });

  await waitFor(() => expect(getByTestId('join-the-voyage-button')).toBeTruthy());
  expect(mockGetVoyagePreview).toHaveBeenLastCalledWith('WXYZ6789');
});

test('ignores an older preview response that arrives after the latest code has loaded', async () => {
  const firstPreview = deferred<any>();
  const secondPreview = deferred<any>();
  mockGetVoyagePreview.mockReturnValueOnce(firstPreview.promise).mockReturnValueOnce(secondPreview.promise);

  const { getByText, queryByTestId, rerender } = await renderScreen();
  await waitFor(() => expect(mockGetVoyagePreview).toHaveBeenCalledWith('ABCD2345'));

  mockUseLocalSearchParams.mockReturnValue({ code: 'WXYZ6789' });
  await act(async () => {
    rerender(
      <PendingJoinProvider>
        <JoinInvitationScreen />
      </PendingJoinProvider>,
    );
  });
  await waitFor(() => expect(mockGetVoyagePreview).toHaveBeenCalledWith('WXYZ6789'));

  await act(async () => {
    secondPreview.resolve({ data: { destination: 'Big Sur', status: 'active', voyagerCount: 1 }, error: null });
    await secondPreview.promise;
  });
  await waitFor(() => expect(getByText(/Big Sur/)).toBeTruthy());

  await act(async () => {
    firstPreview.resolve({ data: null, error: { code: 'not_found', message: 'This invite link is not valid.' } });
    await firstPreview.promise;
  });

  expect(getByText(/Big Sur/)).toBeTruthy();
  expect(queryByTestId('invitation-invalid')).toBeNull();
});

test('tapping Join while unauthenticated sets the pending join code and replaces into sign-in', async () => {
  mockGetVoyagePreview.mockResolvedValue({ data: { destination: 'Lake Tahoe', status: 'active', voyagerCount: 2 }, error: null });

  const { getByTestId } = await renderScreen();
  await waitFor(() => expect(getByTestId('join-the-voyage-button')).toBeTruthy());

  await act(async () => {
    fireEvent.press(getByTestId('join-the-voyage-button'));
  });

  expect(mockClearJustStartedVoyage).toHaveBeenCalledTimes(1);
  expect(mockReplace).toHaveBeenCalledWith('/sign-in');
});

test('tapping Join while already authenticated and fully onboarded replaces the invitation with the join resolver', async () => {
  mockAuth({ user: { id: 'user-1' } });
  mockProfile({ trustMomentSeenAt: '2026-01-01T00:00:00Z', driverConsentSeenAt: '2026-01-01T00:00:00Z', displayName: 'Chintan' });
  mockGetVoyagePreview.mockResolvedValue({ data: { destination: 'Lake Tahoe', status: 'active', voyagerCount: 2 }, error: null });

  const { getByTestId } = await renderScreen();
  await waitFor(() => expect(getByTestId('join-the-voyage-button')).toBeTruthy());

  await act(async () => {
    fireEvent.press(getByTestId('join-the-voyage-button'));
  });

  await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/voyage-joined'));
  expect(mockPush).not.toHaveBeenCalledWith('/voyage-joined');
});

test('tapping Join while authenticated, Trust Moment and Driver Consent seen but no display name set, replaces into display-name', async () => {
  mockAuth({ user: { id: 'user-1' } });
  mockProfile({ trustMomentSeenAt: '2026-01-01T00:00:00Z', driverConsentSeenAt: '2026-01-01T00:00:00Z', displayName: null });
  mockGetVoyagePreview.mockResolvedValue({ data: { destination: 'Lake Tahoe', status: 'active', voyagerCount: 2 }, error: null });

  const { getByTestId } = await renderScreen();
  await waitFor(() => expect(getByTestId('join-the-voyage-button')).toBeTruthy());

  await act(async () => {
    fireEvent.press(getByTestId('join-the-voyage-button'));
  });

  await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/display-name'));
});

test('tapping Join while authenticated but the Trust Moment has not been seen replaces into trust-moment', async () => {
  mockAuth({ user: { id: 'user-1' } });
  mockProfile({ trustMomentSeenAt: null, driverConsentSeenAt: null });
  mockGetVoyagePreview.mockResolvedValue({ data: { destination: 'Lake Tahoe', status: 'active', voyagerCount: 2 }, error: null });

  const { getByTestId } = await renderScreen();
  await waitFor(() => expect(getByTestId('join-the-voyage-button')).toBeTruthy());

  await act(async () => {
    fireEvent.press(getByTestId('join-the-voyage-button'));
  });

  await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/trust-moment'));
});

test('tapping Join while authenticated, Trust Moment seen but Driver Consent not, replaces into driver-attention-consent', async () => {
  mockAuth({ user: { id: 'user-1' } });
  mockProfile({ trustMomentSeenAt: '2026-01-01T00:00:00Z', driverConsentSeenAt: null });
  mockGetVoyagePreview.mockResolvedValue({ data: { destination: 'Lake Tahoe', status: 'active', voyagerCount: 2 }, error: null });

  const { getByTestId } = await renderScreen();
  await waitFor(() => expect(getByTestId('join-the-voyage-button')).toBeTruthy());

  await act(async () => {
    fireEvent.press(getByTestId('join-the-voyage-button'));
  });

  await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/driver-attention-consent'));
});

test('warns an active Organizer that switching may end the prior Voyage', async () => {
  mockUseActiveVoyage.mockReturnValue({
    activeVoyage: { voyage: { id: 'old-voyage' }, role: 'organizer' },
  });
  mockGetVoyagePreview.mockResolvedValue({ data: { destination: 'Lake Tahoe', status: 'active', voyagerCount: 2 }, error: null });

  const { getByTestId } = await renderScreen();

  await waitFor(() => expect(getByTestId('active-voyage-switch-warning')).toBeTruthy());
  expect(getByTestId('active-voyage-switch-warning').props.children).toMatch(/end for everyone/i);
});

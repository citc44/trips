import { beforeEach, expect, jest, test } from '@jest/globals';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';

import { voyageRepository } from '@/repositories/voyage-repository';
import { useAuth } from '@/shared/hooks/use-auth';
import { PendingJoinProvider } from '@/shared/hooks/use-pending-join';
import { useProfile } from '@/shared/hooks/use-profile';

import JoinInvitationScreen from '../join/[code]';

const mockPush = jest.fn();
const mockUseLocalSearchParams = jest.fn();
jest.mock('expo-router', () => {
  const actual = jest.requireActual('expo-router') as object;
  return {
    ...actual,
    router: { push: (...args: unknown[]) => mockPush(...args) },
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

beforeEach(() => {
  jest.clearAllMocks();
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

test('tapping Join while unauthenticated sets the pending join code and pushes to sign-in', async () => {
  mockGetVoyagePreview.mockResolvedValue({ data: { destination: 'Lake Tahoe', status: 'active', voyagerCount: 2 }, error: null });

  const { getByTestId } = await renderScreen();
  await waitFor(() => expect(getByTestId('join-the-voyage-button')).toBeTruthy());

  await act(async () => {
    fireEvent.press(getByTestId('join-the-voyage-button'));
  });

  expect(mockPush).toHaveBeenCalledWith('/sign-in');
});

test('tapping Join while already authenticated and fully onboarded pushes to voyage-joined', async () => {
  mockAuth({ user: { id: 'user-1' } });
  mockProfile({ trustMomentSeenAt: '2026-01-01T00:00:00Z', driverConsentSeenAt: '2026-01-01T00:00:00Z', displayName: 'Chintan' });
  mockGetVoyagePreview.mockResolvedValue({ data: { destination: 'Lake Tahoe', status: 'active', voyagerCount: 2 }, error: null });

  const { getByTestId } = await renderScreen();
  await waitFor(() => expect(getByTestId('join-the-voyage-button')).toBeTruthy());

  await act(async () => {
    fireEvent.press(getByTestId('join-the-voyage-button'));
  });

  await waitFor(() => expect(mockPush).toHaveBeenCalledWith('/voyage-joined'));
});

test('tapping Join while authenticated, Trust Moment and Driver Consent seen but no display name set, pushes to display-name (Story 2.5)', async () => {
  mockAuth({ user: { id: 'user-1' } });
  mockProfile({ trustMomentSeenAt: '2026-01-01T00:00:00Z', driverConsentSeenAt: '2026-01-01T00:00:00Z', displayName: null });
  mockGetVoyagePreview.mockResolvedValue({ data: { destination: 'Lake Tahoe', status: 'active', voyagerCount: 2 }, error: null });

  const { getByTestId } = await renderScreen();
  await waitFor(() => expect(getByTestId('join-the-voyage-button')).toBeTruthy());

  await act(async () => {
    fireEvent.press(getByTestId('join-the-voyage-button'));
  });

  await waitFor(() => expect(mockPush).toHaveBeenCalledWith('/display-name'));
});

test('tapping Join while authenticated but the Trust Moment has not been seen pushes to trust-moment', async () => {
  mockAuth({ user: { id: 'user-1' } });
  mockProfile({ trustMomentSeenAt: null, driverConsentSeenAt: null });
  mockGetVoyagePreview.mockResolvedValue({ data: { destination: 'Lake Tahoe', status: 'active', voyagerCount: 2 }, error: null });

  const { getByTestId } = await renderScreen();
  await waitFor(() => expect(getByTestId('join-the-voyage-button')).toBeTruthy());

  await act(async () => {
    fireEvent.press(getByTestId('join-the-voyage-button'));
  });

  await waitFor(() => expect(mockPush).toHaveBeenCalledWith('/trust-moment'));
});

test('tapping Join while authenticated, Trust Moment seen but Driver Consent not, pushes to driver-attention-consent', async () => {
  mockAuth({ user: { id: 'user-1' } });
  mockProfile({ trustMomentSeenAt: '2026-01-01T00:00:00Z', driverConsentSeenAt: null });
  mockGetVoyagePreview.mockResolvedValue({ data: { destination: 'Lake Tahoe', status: 'active', voyagerCount: 2 }, error: null });

  const { getByTestId } = await renderScreen();
  await waitFor(() => expect(getByTestId('join-the-voyage-button')).toBeTruthy());

  await act(async () => {
    fireEvent.press(getByTestId('join-the-voyage-button'));
  });

  await waitFor(() => expect(mockPush).toHaveBeenCalledWith('/driver-attention-consent'));
});

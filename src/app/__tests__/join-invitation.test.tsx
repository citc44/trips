import { beforeEach, expect, jest, test } from '@jest/globals';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';

import { voyageRepository } from '@/repositories/voyage-repository';
import { useAuth } from '@/shared/hooks/use-auth';
import { usePendingJoin } from '@/shared/hooks/use-pending-join';

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

jest.mock('@/shared/hooks/use-pending-join', () => ({
  usePendingJoin: jest.fn(),
}));

const mockGetVoyagePreview = voyageRepository.getVoyagePreview as jest.MockedFunction<typeof voyageRepository.getVoyagePreview>;
const mockUseAuth = useAuth as jest.MockedFunction<typeof useAuth>;
const mockUsePendingJoin = usePendingJoin as jest.MockedFunction<typeof usePendingJoin>;
const mockSetPendingJoinCode = jest.fn();

beforeEach(() => {
  jest.clearAllMocks();
  mockUseLocalSearchParams.mockReturnValue({ code: 'ABCD2345' });
  mockUseAuth.mockReturnValue({
    session: null,
    isLoading: false,
    signInWithEmail: jest.fn<(...args: any[]) => Promise<any>>(),
    verifyCode: jest.fn<(...args: any[]) => Promise<any>>(),
    signOut: jest.fn<(...args: any[]) => Promise<any>>(),
  });
  mockUsePendingJoin.mockReturnValue({
    pendingJoinCode: null,
    setPendingJoinCode: mockSetPendingJoinCode,
    clearPendingJoinCode: jest.fn(),
  });
});

test('shows the invitation with destination and Voyager count on a valid, active code', async () => {
  mockGetVoyagePreview.mockResolvedValue({ data: { destination: 'Lake Tahoe', status: 'active', voyagerCount: 2 }, error: null });

  const { getByText, getByTestId } = await render(<JoinInvitationScreen />);

  await waitFor(() => expect(getByText(/Lake Tahoe/)).toBeTruthy());
  expect(getByTestId('join-the-voyage-button')).toBeTruthy();
});

test('shows an invalid-link message for an unknown code', async () => {
  mockGetVoyagePreview.mockResolvedValue({ data: null, error: { code: 'not_found', message: 'This invite link is not valid.' } });

  const { getByTestId } = await render(<JoinInvitationScreen />);

  await waitFor(() => expect(getByTestId('invitation-invalid')).toBeTruthy());
});

test('shows the "already wrapped up" state for an ended Voyage, with a CTA to start a new one', async () => {
  mockGetVoyagePreview.mockResolvedValue({ data: { destination: 'Lake Tahoe', status: 'ended', voyagerCount: 3 }, error: null });

  const { getByTestId } = await render(<JoinInvitationScreen />);

  await waitFor(() => expect(getByTestId('invitation-ended')).toBeTruthy());
  expect(getByTestId('start-your-own-voyage-button')).toBeTruthy();
});

test('tapping Join while unauthenticated sets the pending join code and pushes to sign-in', async () => {
  mockGetVoyagePreview.mockResolvedValue({ data: { destination: 'Lake Tahoe', status: 'active', voyagerCount: 2 }, error: null });

  const { getByTestId } = await render(<JoinInvitationScreen />);
  await waitFor(() => expect(getByTestId('join-the-voyage-button')).toBeTruthy());

  await act(async () => {
    fireEvent.press(getByTestId('join-the-voyage-button'));
  });

  expect(mockSetPendingJoinCode).toHaveBeenCalledWith('ABCD2345');
  expect(mockPush).toHaveBeenCalledWith('/sign-in');
});

test('tapping Join while already authenticated sets the pending join code without pushing to sign-in', async () => {
  mockUseAuth.mockReturnValue({
    session: { user: { id: 'user-1' } } as any,
    isLoading: false,
    signInWithEmail: jest.fn<(...args: any[]) => Promise<any>>(),
    verifyCode: jest.fn<(...args: any[]) => Promise<any>>(),
    signOut: jest.fn<(...args: any[]) => Promise<any>>(),
  });
  mockGetVoyagePreview.mockResolvedValue({ data: { destination: 'Lake Tahoe', status: 'active', voyagerCount: 2 }, error: null });

  const { getByTestId } = await render(<JoinInvitationScreen />);
  await waitFor(() => expect(getByTestId('join-the-voyage-button')).toBeTruthy());

  await act(async () => {
    fireEvent.press(getByTestId('join-the-voyage-button'));
  });

  expect(mockSetPendingJoinCode).toHaveBeenCalledWith('ABCD2345');
  expect(mockPush).not.toHaveBeenCalled();
});

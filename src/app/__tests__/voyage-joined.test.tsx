import { beforeEach, expect, jest, test } from '@jest/globals';
import { act, render, waitFor } from '@testing-library/react-native';

import { usePendingJoin } from '@/shared/hooks/use-pending-join';
import { voyageRepository } from '@/repositories/voyage-repository';

import VoyageJoinedScreen from '../voyage-joined';

jest.mock('@/shared/hooks/use-pending-join', () => ({
  usePendingJoin: jest.fn(),
}));

jest.mock('@/repositories/voyage-repository', () => ({
  voyageRepository: {
    joinVoyage: jest.fn(),
  },
}));

const mockUsePendingJoin = usePendingJoin as jest.MockedFunction<typeof usePendingJoin>;
const mockJoinVoyage = voyageRepository.joinVoyage as jest.MockedFunction<typeof voyageRepository.joinVoyage>;
const mockClearPendingJoinCode = jest.fn();

beforeEach(() => {
  jest.clearAllMocks();
});

// Note: the "no pending join code -> <Redirect href="/" />" guard isn't covered
// here -- expo-router's Redirect needs a NavigationContainer to render at all
// ("Couldn't find a navigation object"), and this codebase has no established
// pattern for that yet (join-code.tsx's equivalent params guard is untested for
// the same reason). Low-risk, single-condition guard; flagged rather than
// silently skipped.

test('calls joinVoyage with the pending join code on mount', async () => {
  mockUsePendingJoin.mockReturnValue({
    pendingJoinCode: 'ABCD2345',
    setPendingJoinCode: jest.fn(),
    clearPendingJoinCode: mockClearPendingJoinCode,
  });
  mockJoinVoyage.mockResolvedValue({
    data: { id: 'v1', destination: 'Lake Tahoe', status: 'active', createdBy: 'u1', createdAt: 't', endedAt: null, joinCode: 'ABCD2345' },
    error: null,
  });

  await render(<VoyageJoinedScreen />);

  await waitFor(() => expect(mockJoinVoyage).toHaveBeenCalledWith('ABCD2345'));
});

test('shows a success confirmation with the destination on success', async () => {
  mockUsePendingJoin.mockReturnValue({
    pendingJoinCode: 'ABCD2345',
    setPendingJoinCode: jest.fn(),
    clearPendingJoinCode: mockClearPendingJoinCode,
  });
  mockJoinVoyage.mockResolvedValue({
    data: { id: 'v1', destination: 'Lake Tahoe', status: 'active', createdBy: 'u1', createdAt: 't', endedAt: null, joinCode: 'ABCD2345' },
    error: null,
  });

  const { getByTestId, getByText } = await render(<VoyageJoinedScreen />);

  await waitFor(() => expect(getByText(/Lake Tahoe/)).toBeTruthy());
  expect(getByTestId('voyage-joined-continue-button')).toBeTruthy();
});

test('shows the error message on failure (e.g. AD-9 conflict)', async () => {
  mockUsePendingJoin.mockReturnValue({
    pendingJoinCode: 'ABCD2345',
    setPendingJoinCode: jest.fn(),
    clearPendingJoinCode: mockClearPendingJoinCode,
  });
  mockJoinVoyage.mockResolvedValue({ data: null, error: { code: 'P0001', message: 'You already have an active Voyage.' } });

  const { getByTestId } = await render(<VoyageJoinedScreen />);

  await waitFor(() => expect(getByTestId('voyage-joined-error')).toBeTruthy());
  expect(getByTestId('voyage-joined-error').props.children).toBe('You already have an active Voyage.');
});

test('tapping Continue clears the pending join code', async () => {
  mockUsePendingJoin.mockReturnValue({
    pendingJoinCode: 'ABCD2345',
    setPendingJoinCode: jest.fn(),
    clearPendingJoinCode: mockClearPendingJoinCode,
  });
  mockJoinVoyage.mockResolvedValue({
    data: { id: 'v1', destination: 'Lake Tahoe', status: 'active', createdBy: 'u1', createdAt: 't', endedAt: null, joinCode: 'ABCD2345' },
    error: null,
  });

  const { getByTestId } = await render(<VoyageJoinedScreen />);
  await waitFor(() => expect(getByTestId('voyage-joined-continue-button')).toBeTruthy());

  await act(async () => {
    getByTestId('voyage-joined-continue-button').props.onPress();
  });

  expect(mockClearPendingJoinCode).toHaveBeenCalledTimes(1);
});

test('does not call joinVoyage twice across re-renders', async () => {
  mockUsePendingJoin.mockReturnValue({
    pendingJoinCode: 'ABCD2345',
    setPendingJoinCode: jest.fn(),
    clearPendingJoinCode: mockClearPendingJoinCode,
  });
  mockJoinVoyage.mockResolvedValue({
    data: { id: 'v1', destination: 'Lake Tahoe', status: 'active', createdBy: 'u1', createdAt: 't', endedAt: null, joinCode: 'ABCD2345' },
    error: null,
  });

  const { rerender } = await render(<VoyageJoinedScreen />);
  await waitFor(() => expect(mockJoinVoyage).toHaveBeenCalledTimes(1));

  await act(async () => {
    rerender(<VoyageJoinedScreen />);
  });

  expect(mockJoinVoyage).toHaveBeenCalledTimes(1);
});

test('starts a fresh join when the pending code changes to a different value while still mounted', async () => {
  mockUsePendingJoin.mockReturnValue({
    pendingJoinCode: 'ABCD2345',
    setPendingJoinCode: jest.fn(),
    clearPendingJoinCode: mockClearPendingJoinCode,
  });
  mockJoinVoyage.mockResolvedValue({
    data: { id: 'v1', destination: 'Lake Tahoe', status: 'active', createdBy: 'u1', createdAt: 't', endedAt: null, joinCode: 'ABCD2345' },
    error: null,
  });

  const { rerender } = await render(<VoyageJoinedScreen />);
  await waitFor(() => expect(mockJoinVoyage).toHaveBeenCalledWith('ABCD2345'));

  mockUsePendingJoin.mockReturnValue({
    pendingJoinCode: 'WXYZ6789',
    setPendingJoinCode: jest.fn(),
    clearPendingJoinCode: mockClearPendingJoinCode,
  });

  await act(async () => {
    rerender(<VoyageJoinedScreen />);
  });

  await waitFor(() => expect(mockJoinVoyage).toHaveBeenCalledWith('WXYZ6789'));
  expect(mockJoinVoyage).toHaveBeenCalledTimes(2);
});

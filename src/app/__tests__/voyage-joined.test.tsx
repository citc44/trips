import { beforeEach, expect, jest, test } from '@jest/globals';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';

import { voyageRepository } from '@/repositories/voyage-repository';
import { usePendingJoin } from '@/shared/hooks/use-pending-join';

import VoyageJoinedScreen from '../voyage-joined';

jest.mock('@/shared/hooks/use-pending-join', () => ({
  usePendingJoin: jest.fn(),
}));

jest.mock('@/repositories/voyage-repository', () => ({
  voyageRepository: {
    joinVoyage: jest.fn(),
  },
}));

const mockRefetchActiveVoyage = jest.fn<() => Promise<any>>();
jest.mock('@/shared/hooks/use-active-voyage', () => ({
  useActiveVoyage: () => ({ activeVoyage: null, isLoading: false, hasError: false, refetch: mockRefetchActiveVoyage }),
}));

const mockTriggerEntryTransition = jest.fn();
jest.mock('@/shared/hooks/use-pending-entry-transition', () => ({
  usePendingEntryTransition: () => ({
    hasPendingEntryTransition: false,
    triggerEntryTransition: mockTriggerEntryTransition,
    consumeEntryTransition: jest.fn(),
  }),
}));

const mockUsePendingJoin = usePendingJoin as jest.MockedFunction<typeof usePendingJoin>;
const mockJoinVoyage = voyageRepository.joinVoyage as jest.MockedFunction<typeof voyageRepository.joinVoyage>;
const mockClearPendingJoinCode = jest.fn();

const joinedVoyage = {
  id: 'joined-voyage',
  destination: 'Lake Tahoe',
  destinationLat: null,
  destinationLng: null,
  status: 'active' as const,
  createdBy: 'organizer-1',
  createdAt: '2026-07-26T00:00:00Z',
  endedAt: null,
  joinCode: 'ABCD2345',
};

const confirmedActiveVoyage = { voyage: joinedVoyage, role: 'voyager' as const };

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockUsePendingJoin.mockReturnValue({
    pendingJoinCode: 'ABCD2345',
    setPendingJoinCode: jest.fn(),
    clearPendingJoinCode: mockClearPendingJoinCode,
  });
  mockRefetchActiveVoyage.mockResolvedValue({ data: confirmedActiveVoyage, error: null });
});

test('renders a loading-only resolver while join_voyage is in flight', async () => {
  const join = deferred<any>();
  mockJoinVoyage.mockReturnValue(join.promise);

  const { getByTestId, queryByTestId } = await render(<VoyageJoinedScreen />);

  expect(getByTestId('voyage-joined-loading')).toBeTruthy();
  expect(queryByTestId('voyage-joined-continue-button')).toBeNull();
  await waitFor(() => expect(mockJoinVoyage).toHaveBeenCalledWith('ABCD2345'));
});

test('does not clear pending state until active refetch confirms the joined Voyage id', async () => {
  const refresh = deferred<any>();
  mockJoinVoyage.mockResolvedValue({ data: joinedVoyage, error: null });
  mockRefetchActiveVoyage.mockReturnValue(refresh.promise);

  await render(<VoyageJoinedScreen />);

  await waitFor(() => expect(mockRefetchActiveVoyage).toHaveBeenCalledTimes(1));
  expect(mockClearPendingJoinCode).not.toHaveBeenCalled();
  expect(mockTriggerEntryTransition).not.toHaveBeenCalled();

  await act(async () => {
    refresh.resolve({ data: confirmedActiveVoyage, error: null });
    await refresh.promise;
  });

  await waitFor(() => expect(mockClearPendingJoinCode).toHaveBeenCalledTimes(1));
  expect(mockTriggerEntryTransition).toHaveBeenCalledTimes(1);
  expect(mockTriggerEntryTransition.mock.invocationCallOrder[0]).toBeLessThan(mockClearPendingJoinCode.mock.invocationCallOrder[0]);
});

test('retains pending state when refetch still reports the old active Voyage', async () => {
  mockJoinVoyage.mockResolvedValue({ data: joinedVoyage, error: null });
  mockRefetchActiveVoyage.mockResolvedValue({
    data: { ...confirmedActiveVoyage, voyage: { ...joinedVoyage, id: 'old-voyage' } },
    error: null,
  });

  const { getByTestId, queryByTestId } = await render(<VoyageJoinedScreen />);

  await waitFor(() => expect(getByTestId('voyage-joined-error').props.children).toMatch(/couldn't open the live map/i));
  expect(mockClearPendingJoinCode).not.toHaveBeenCalled();
  expect(mockTriggerEntryTransition).not.toHaveBeenCalled();
  expect(queryByTestId('voyage-joined-cancel-button')).toBeNull();
});

test('retains pending state and only exposes reconciliation when the committed join cannot be refreshed', async () => {
  mockJoinVoyage.mockResolvedValue({ data: joinedVoyage, error: null });
  mockRefetchActiveVoyage.mockResolvedValue({ data: null, error: { code: 'unknown', message: 'Network unavailable.' } });

  const { getByTestId, queryByTestId } = await render(<VoyageJoinedScreen />);

  await waitFor(() => expect(getByTestId('voyage-joined-error').props.children).toBe('Network unavailable.'));
  expect(getByTestId('voyage-joined-retry-button')).toBeTruthy();
  expect(queryByTestId('voyage-joined-cancel-button')).toBeNull();
  expect(mockClearPendingJoinCode).not.toHaveBeenCalled();
});

test('allows Cancel after a deterministic server rejection that cannot have changed membership', async () => {
  mockJoinVoyage.mockResolvedValue({ data: null, error: { code: 'JOIN2', message: 'This trip has already ended.' } });

  const { getByTestId } = await render(<VoyageJoinedScreen />);

  await waitFor(() => expect(getByTestId('voyage-joined-error').props.children).toBe('This trip has already ended.'));
  expect(getByTestId('voyage-joined-cancel-button')).toBeTruthy();
  expect(mockRefetchActiveVoyage).not.toHaveBeenCalled();
  expect(mockClearPendingJoinCode).not.toHaveBeenCalled();
});

test('Retry reruns the same idempotent join and completes after active state is confirmed', async () => {
  mockJoinVoyage
    .mockResolvedValueOnce({ data: null, error: { code: 'unknown', message: 'Network unavailable.' } })
    .mockResolvedValueOnce({ data: joinedVoyage, error: null });

  const { getByTestId } = await render(<VoyageJoinedScreen />);
  await waitFor(() => expect(getByTestId('voyage-joined-error')).toBeTruthy());
  expect(() => getByTestId('voyage-joined-cancel-button')).toThrow();

  await act(async () => {
    fireEvent.press(getByTestId('voyage-joined-retry-button'));
  });

  await waitFor(() => expect(mockJoinVoyage).toHaveBeenCalledTimes(2));
  await waitFor(() => expect(mockClearPendingJoinCode).toHaveBeenCalledTimes(1));
  expect(mockTriggerEntryTransition).toHaveBeenCalledTimes(1);
});

test('Cancel clears pending state without firing the gameplay transition', async () => {
  mockJoinVoyage.mockResolvedValue({ data: null, error: { code: 'JOIN2', message: 'This trip has already ended.' } });

  const { getByTestId } = await render(<VoyageJoinedScreen />);
  await waitFor(() => expect(getByTestId('voyage-joined-error')).toBeTruthy());

  await act(async () => {
    fireEvent.press(getByTestId('voyage-joined-cancel-button'));
  });

  expect(mockClearPendingJoinCode).toHaveBeenCalledTimes(1);
  expect(mockTriggerEntryTransition).not.toHaveBeenCalled();
});

test('does not call joinVoyage twice across ordinary re-renders', async () => {
  const join = deferred<any>();
  mockJoinVoyage.mockReturnValue(join.promise);

  const { rerender } = await render(<VoyageJoinedScreen />);
  await waitFor(() => expect(mockJoinVoyage).toHaveBeenCalledTimes(1));

  await rerender(<VoyageJoinedScreen />);
  expect(mockJoinVoyage).toHaveBeenCalledTimes(1);
});

test('serializes code changes so the latest join RPC is the final membership write', async () => {
  const firstJoin = deferred<any>();
  const secondJoin = deferred<any>();
  mockJoinVoyage.mockReturnValueOnce(firstJoin.promise).mockReturnValueOnce(secondJoin.promise);
  const secondVoyage = { ...joinedVoyage, id: 'second-voyage', destination: 'Big Sur', joinCode: 'WXYZ6789' };
  mockRefetchActiveVoyage.mockResolvedValue({ data: { voyage: secondVoyage, role: 'voyager' }, error: null });

  const { rerender } = await render(<VoyageJoinedScreen />);
  await waitFor(() => expect(mockJoinVoyage).toHaveBeenCalledWith('ABCD2345'));

  mockUsePendingJoin.mockReturnValue({
    pendingJoinCode: 'WXYZ6789',
    setPendingJoinCode: jest.fn(),
    clearPendingJoinCode: mockClearPendingJoinCode,
  });
  await rerender(<VoyageJoinedScreen />);

  // The second RPC is queued behind the first. Starting both concurrently
  // would allow the older code to acquire the server lock last and become the
  // user's final active membership.
  expect(mockJoinVoyage).toHaveBeenCalledTimes(1);

  await act(async () => {
    firstJoin.resolve({ data: joinedVoyage, error: null });
    await firstJoin.promise;
  });

  await waitFor(() => expect(mockJoinVoyage).toHaveBeenCalledWith('WXYZ6789'));
  expect(mockJoinVoyage).toHaveBeenCalledTimes(2);
  expect(mockRefetchActiveVoyage).not.toHaveBeenCalled();

  await act(async () => {
    secondJoin.resolve({ data: secondVoyage, error: null });
    await secondJoin.promise;
  });

  await waitFor(() => expect(mockClearPendingJoinCode).toHaveBeenCalledTimes(1));
  expect(mockRefetchActiveVoyage).toHaveBeenCalledTimes(1);
});

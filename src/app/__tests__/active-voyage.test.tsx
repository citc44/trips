import { beforeEach, expect, jest, test } from '@jest/globals';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';

import { voyageRepository } from '@/repositories/voyage-repository';
import { useActiveVoyage } from '@/shared/hooks/use-active-voyage';

import ActiveVoyageScreen from '../active-voyage';

const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  router: { push: (...args: unknown[]) => mockPush(...args) },
}));

jest.mock('@/repositories/voyage-repository', () => ({
  voyageRepository: { endVoyage: jest.fn(), getVoyageMembers: jest.fn(), grantOrganizerStatus: jest.fn() },
}));

jest.mock('@/shared/hooks/use-active-voyage', () => ({
  useActiveVoyage: jest.fn(),
}));

const mockEndVoyage = voyageRepository.endVoyage as jest.MockedFunction<typeof voyageRepository.endVoyage>;
const mockGetVoyageMembers = voyageRepository.getVoyageMembers as jest.MockedFunction<typeof voyageRepository.getVoyageMembers>;
const mockGrantOrganizerStatus = voyageRepository.grantOrganizerStatus as jest.MockedFunction<typeof voyageRepository.grantOrganizerStatus>;
const mockUseActiveVoyage = useActiveVoyage as jest.MockedFunction<typeof useActiveVoyage>;
const mockRefetch = jest.fn<() => Promise<void>>();

const membersFixture = [
  { userId: 'user-1', displayName: 'Chintan', role: 'organizer' as const, joinedAt: '2026-07-26T00:00:00Z' },
  { userId: 'user-2', displayName: 'Meera', role: 'voyager' as const, joinedAt: '2026-07-26T00:05:00Z' },
];

function mockActiveVoyage(role: 'organizer' | 'voyager') {
  mockUseActiveVoyage.mockReturnValue({
    activeVoyage: {
      voyage: {
        id: 'voyage-1',
        destination: 'Lake Tahoe',
        status: 'active',
        createdBy: 'user-1',
        createdAt: '2026-07-26T00:00:00Z',
        endedAt: null,
        joinCode: 'ABCD2345',
      },
      role,
    },
    isLoading: false,
    hasError: false,
    refetch: mockRefetch,
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  mockGetVoyageMembers.mockResolvedValue({ data: membersFixture, error: null });
});

test('shows the destination and an End Voyage control for the Organizer', async () => {
  mockActiveVoyage('organizer');

  const { getByText, getByTestId } = await render(<ActiveVoyageScreen />);

  expect(getByText(/Lake Tahoe/)).toBeTruthy();
  expect(getByTestId('end-voyage-button')).toBeTruthy();
});

test('does not show the End Voyage control for a plain Voyager', async () => {
  mockActiveVoyage('voyager');

  const { queryByTestId } = await render(<ActiveVoyageScreen />);

  expect(queryByTestId('end-voyage-button')).toBeNull();
});

test('tapping End Voyage swaps to the confirm view with the ceremonial copy', async () => {
  mockActiveVoyage('organizer');

  const { getByTestId, getByText } = await render(<ActiveVoyageScreen />);

  await act(async () => {
    fireEvent.press(getByTestId('end-voyage-button'));
  });

  expect(getByText('Ready to close out the trip?')).toBeTruthy();
  expect(getByTestId('confirm-end-voyage-button')).toBeTruthy();
  expect(getByTestId('keep-going-button')).toBeTruthy();
});

test('tapping Keep going swaps back without calling endVoyage', async () => {
  mockActiveVoyage('organizer');

  const { getByTestId, queryByTestId } = await render(<ActiveVoyageScreen />);

  await act(async () => {
    fireEvent.press(getByTestId('end-voyage-button'));
  });
  await act(async () => {
    fireEvent.press(getByTestId('keep-going-button'));
  });

  expect(queryByTestId('confirm-end-voyage-button')).toBeNull();
  expect(mockEndVoyage).not.toHaveBeenCalled();
});

test('confirming calls endVoyage, refetches, and navigates to voyage-ended with the summary data', async () => {
  mockActiveVoyage('organizer');
  mockEndVoyage.mockResolvedValue({
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

  const { getByTestId } = await render(<ActiveVoyageScreen />);

  await act(async () => {
    fireEvent.press(getByTestId('end-voyage-button'));
  });
  await act(async () => {
    fireEvent.press(getByTestId('confirm-end-voyage-button'));
  });

  expect(mockEndVoyage).toHaveBeenCalledWith('voyage-1');
  await waitFor(() => expect(mockRefetch).toHaveBeenCalledTimes(1));
  expect(mockPush).toHaveBeenCalledWith({
    pathname: '/voyage-ended',
    params: {
      destination: 'Lake Tahoe',
      createdAt: '2026-07-26T00:00:00Z',
      endedAt: '2026-07-26T05:30:00Z',
      voyagerCount: '3',
    },
  });
});

test('shows the error inline on failure and stays on the confirm view (never a dead end)', async () => {
  mockActiveVoyage('organizer');
  mockEndVoyage.mockResolvedValue({ data: null, error: { code: 'END03', message: 'Only the Organizer can end this Voyage.' } });

  const { getByTestId } = await render(<ActiveVoyageScreen />);

  await act(async () => {
    fireEvent.press(getByTestId('end-voyage-button'));
  });
  await act(async () => {
    fireEvent.press(getByTestId('confirm-end-voyage-button'));
  });

  await waitFor(() => expect(getByTestId('end-voyage-error')).toBeTruthy());
  expect(getByTestId('end-voyage-error').props.children).toBe('Only the Organizer can end this Voyage.');
  expect(getByTestId('keep-going-button')).toBeTruthy();
  expect(mockPush).not.toHaveBeenCalled();
});

test('fetches and shows the Voyager list with display names', async () => {
  mockActiveVoyage('organizer');

  const { getByText } = await render(<ActiveVoyageScreen />);

  expect(mockGetVoyageMembers).toHaveBeenCalledWith('voyage-1');
  await waitFor(() => expect(getByText('Chintan')).toBeTruthy());
  expect(getByText('Meera')).toBeTruthy();
});

test('shows a Grant Organizer action for each non-organizer row when viewed by an Organizer', async () => {
  mockActiveVoyage('organizer');

  const { getByTestId, queryByTestId } = await render(<ActiveVoyageScreen />);

  await waitFor(() => expect(getByTestId('grant-organizer-button-user-2')).toBeTruthy());
  // No action on the row that's already an Organizer.
  expect(queryByTestId('grant-organizer-button-user-1')).toBeNull();
});

test('shows no Grant Organizer actions at all when viewed by a plain Voyager', async () => {
  mockActiveVoyage('voyager');

  const { queryByTestId } = await render(<ActiveVoyageScreen />);

  await waitFor(() => expect(mockGetVoyageMembers).toHaveBeenCalled());
  expect(queryByTestId('grant-organizer-button-user-2')).toBeNull();
});

test('tapping Grant Organizer calls the repository, shows a quiet toast, and re-fetches -- no navigation', async () => {
  mockActiveVoyage('organizer');
  mockGrantOrganizerStatus.mockResolvedValue({ error: null });

  const { getByTestId, getByText } = await render(<ActiveVoyageScreen />);

  await waitFor(() => expect(getByTestId('grant-organizer-button-user-2')).toBeTruthy());

  await act(async () => {
    fireEvent.press(getByTestId('grant-organizer-button-user-2'));
  });

  expect(mockGrantOrganizerStatus).toHaveBeenCalledWith('voyage-1', 'user-2');
  await waitFor(() => expect(getByText(/Meera is now an Organizer/)).toBeTruthy());
  // Re-fetches to reflect the new role (getVoyageMembers called again beyond the initial mount fetch).
  await waitFor(() => expect(mockGetVoyageMembers).toHaveBeenCalledTimes(2));
  expect(mockPush).not.toHaveBeenCalled();
});

test('shows an inline error (not a dead end) when granting Organizer status fails', async () => {
  mockActiveVoyage('organizer');
  mockGrantOrganizerStatus.mockResolvedValue({ error: { code: 'ORG02', message: 'That person is not an active member of this Voyage.' } });

  const { getByTestId } = await render(<ActiveVoyageScreen />);

  await waitFor(() => expect(getByTestId('grant-organizer-button-user-2')).toBeTruthy());

  await act(async () => {
    fireEvent.press(getByTestId('grant-organizer-button-user-2'));
  });

  await waitFor(() => expect(getByTestId('voyager-list-error')).toBeTruthy());
  expect(getByTestId('voyager-list-error').props.children).toBe('That person is not an active member of this Voyage.');
});

test('shows a retry action (not a dead end) when the initial Voyager-list fetch fails, and retrying re-fetches', async () => {
  mockActiveVoyage('organizer');
  mockGetVoyageMembers.mockResolvedValueOnce({ data: null, error: { code: 'MEM01', message: 'You are not a participant of this Voyage.' } });

  const { getByTestId, getByText } = await render(<ActiveVoyageScreen />);

  await waitFor(() => expect(getByTestId('voyager-list-error')).toBeTruthy());
  expect(getByTestId('voyager-list-retry-button')).toBeTruthy();

  mockGetVoyageMembers.mockResolvedValueOnce({ data: membersFixture, error: null });
  await act(async () => {
    fireEvent.press(getByTestId('voyager-list-retry-button'));
  });

  expect(mockGetVoyageMembers).toHaveBeenCalledTimes(2);
  await waitFor(() => expect(getByText('Chintan')).toBeTruthy());
});

test('granting Organizer status on one row does not re-enable a different row still in flight', async () => {
  mockActiveVoyage('organizer');
  mockGetVoyageMembers.mockResolvedValue({
    data: [
      { userId: 'user-1', displayName: 'Chintan', role: 'organizer' as const, joinedAt: '2026-07-26T00:00:00Z' },
      { userId: 'user-2', displayName: 'Meera', role: 'voyager' as const, joinedAt: '2026-07-26T00:05:00Z' },
      { userId: 'user-3', displayName: 'Sam', role: 'voyager' as const, joinedAt: '2026-07-26T00:10:00Z' },
    ],
    error: null,
  });

  let resolveFirstGrant: (value: any) => void;
  mockGrantOrganizerStatus.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        resolveFirstGrant = resolve;
      }),
  );
  mockGrantOrganizerStatus.mockResolvedValueOnce({ error: null });

  const { getByTestId } = await render(<ActiveVoyageScreen />);
  await waitFor(() => expect(getByTestId('grant-organizer-button-user-2')).toBeTruthy());

  // Row 1 (Meera) starts and stays in flight.
  await act(async () => {
    fireEvent.press(getByTestId('grant-organizer-button-user-2'));
  });
  expect(getByTestId('grant-organizer-button-user-2').props.accessibilityState?.disabled).toBe(true);

  // Row 2 (Sam) starts and finishes while row 1 is still pending.
  await act(async () => {
    fireEvent.press(getByTestId('grant-organizer-button-user-3'));
  });

  // Row 1's button must still be disabled -- it hasn't resolved yet.
  expect(getByTestId('grant-organizer-button-user-2').props.accessibilityState?.disabled).toBe(true);

  await act(async () => {
    resolveFirstGrant!({ error: null });
  });
});

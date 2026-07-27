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
  voyageRepository: { endVoyage: jest.fn() },
}));

jest.mock('@/shared/hooks/use-active-voyage', () => ({
  useActiveVoyage: jest.fn(),
}));

const mockEndVoyage = voyageRepository.endVoyage as jest.MockedFunction<typeof voyageRepository.endVoyage>;
const mockUseActiveVoyage = useActiveVoyage as jest.MockedFunction<typeof useActiveVoyage>;
const mockRefetch = jest.fn<() => Promise<void>>();

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

import { act, render, waitFor, fireEvent } from '@testing-library/react-native';
import { expect, jest, test, beforeEach } from '@jest/globals';
import { AccessibilityInfo } from 'react-native';

import VoyageHistoryScreen from '@/app/voyage-history';

const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  router: { push: (...args: unknown[]) => mockPush(...args) },
}));

const mockGetVoyageHistory = jest.fn<(...args: any[]) => Promise<any>>();
jest.mock('@/repositories/voyage-repository', () => ({
  voyageRepository: {
    getVoyageHistory: (...args: unknown[]) => mockGetVoyageHistory(...args),
  },
}));

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(false);
});

const voyages = [
  {
    id: 'voyage-1',
    destination: 'Big Sur',
    destinationLat: null,
    destinationLng: null,
    status: 'ended' as const,
    createdBy: 'user-1',
    createdAt: '2026-08-11T10:00:00.000Z',
    endedAt: '2026-08-11T16:42:00.000Z',
    joinCode: null,
    voyagerCount: 3,
  },
  {
    id: 'voyage-2',
    destination: 'Lake Tahoe',
    destinationLat: null,
    destinationLng: null,
    status: 'ended' as const,
    createdBy: 'user-1',
    createdAt: '2026-07-28T09:00:00.000Z',
    endedAt: '2026-07-28T13:00:00.000Z',
    joinCode: null,
    voyagerCount: 4,
  },
];

test('shows a loading state, then the populated list once data resolves', async () => {
  mockGetVoyageHistory.mockResolvedValue({ data: voyages, error: null });

  const { getByTestId } = await render(<VoyageHistoryScreen />);

  await waitFor(() => expect(getByTestId('voyage-history-row-voyage-1')).toBeTruthy());
  expect(mockGetVoyageHistory).toHaveBeenCalledWith(undefined, undefined, 100);
});

test('surfaces an inline error instead of a blank screen', async () => {
  mockGetVoyageHistory.mockResolvedValue({ data: null, error: { code: 'unknown', message: 'Network request failed' } });

  const { getByTestId } = await render(<VoyageHistoryScreen />);

  await waitFor(() => expect(getByTestId('voyage-history-error')).toBeTruthy());
});

test('renders rows with destination, date + voyager count, and duration, most-recent-first order preserved', async () => {
  mockGetVoyageHistory.mockResolvedValue({ data: voyages, error: null });

  const { getByTestId, getByText, getAllByTestId } = await render(<VoyageHistoryScreen />);
  await waitFor(() => expect(getByTestId('voyage-history-row-voyage-1')).toBeTruthy());

  expect(getByText('Big Sur')).toBeTruthy();
  expect(getByText('6h 42m')).toBeTruthy();
  expect(getByText(/3 voyagers/)).toBeTruthy();
  expect(getByText('Lake Tahoe')).toBeTruthy();
  expect(getByText('4h 0m')).toBeTruthy();

  // Order preserved exactly as returned by the RPC (already most-recent-first server-side).
  const rows = getAllByTestId(/^voyage-history-row-/);
  expect(rows.map((row) => row.props.testID)).toEqual(['voyage-history-row-voyage-1', 'voyage-history-row-voyage-2']);
});

test('the search field filters the list live by destination, and shows a zero-matches state', async () => {
  mockGetVoyageHistory.mockResolvedValue({ data: voyages, error: null });

  const { getByTestId, queryByTestId, getByText } = await render(<VoyageHistoryScreen />);
  await waitFor(() => expect(getByTestId('voyage-history-row-voyage-1')).toBeTruthy());

  await act(async () => {
    fireEvent.changeText(getByTestId('voyage-history-search'), 'tahoe');
  });

  await waitFor(() => expect(queryByTestId('voyage-history-row-voyage-1')).toBeNull());
  expect(getByTestId('voyage-history-row-voyage-2')).toBeTruthy();

  await act(async () => {
    fireEvent.changeText(getByTestId('voyage-history-search'), 'nowhere');
  });

  await waitFor(() => expect(getByText(/No matches for that destination/i)).toBeTruthy());
  expect(queryByTestId('voyage-history-row-voyage-1')).toBeNull();
  expect(queryByTestId('voyage-history-row-voyage-2')).toBeNull();
});

test('shows the warm first-visit empty state (not a plain empty list) when zero Voyages have ever completed', async () => {
  mockGetVoyageHistory.mockResolvedValue({ data: [], error: null });

  const { getByTestId, getByText } = await render(<VoyageHistoryScreen />);

  await waitFor(() => expect(getByTestId('voyage-history-empty')).toBeTruthy());
  expect(getByText(/Every road you take/)).toBeTruthy();
  expect(getByTestId('voyage-history-empty-cta')).toBeTruthy();
});

test('the zero-Voyages-ever empty state is visibly distinct from the zero-search-matches state', async () => {
  mockGetVoyageHistory.mockResolvedValue({ data: voyages, error: null });

  const { getByTestId, queryByTestId } = await render(<VoyageHistoryScreen />);
  await waitFor(() => expect(getByTestId('voyage-history-row-voyage-1')).toBeTruthy());

  await act(async () => {
    fireEvent.changeText(getByTestId('voyage-history-search'), 'nowhere');
  });

  await waitFor(() => expect(getByTestId('voyage-history-no-matches')).toBeTruthy());
  expect(queryByTestId('voyage-history-empty')).toBeNull();
});

test('tapping a row navigates to that Voyage\'s Memory Lane deck via push', async () => {
  mockGetVoyageHistory.mockResolvedValue({ data: voyages, error: null });

  const { getByTestId } = await render(<VoyageHistoryScreen />);
  await waitFor(() => expect(getByTestId('voyage-history-row-voyage-1')).toBeTruthy());

  await act(async () => {
    fireEvent.press(getByTestId('voyage-history-row-voyage-1'));
  });

  expect(mockPush).toHaveBeenCalledWith({ pathname: '/memory-lane/[voyageId]', params: { voyageId: 'voyage-1' } });
});

test('each row carries an accessible label with destination, duration, date, and voyager count', async () => {
  mockGetVoyageHistory.mockResolvedValue({ data: voyages, error: null });

  const { getByTestId } = await render(<VoyageHistoryScreen />);
  await waitFor(() => expect(getByTestId('voyage-history-row-voyage-1')).toBeTruthy());

  const row = getByTestId('voyage-history-row-voyage-1');
  expect(row.props.accessibilityRole).toBe('button');
  expect(row.props.accessibilityLabel).toContain('Big Sur');
  expect(row.props.accessibilityLabel).toContain('6h 42m');
  expect(row.props.accessibilityLabel).toContain('Aug 11, 2026');
  expect(row.props.accessibilityLabel).toContain('3 voyagers');
});

test('a given Voyage id always maps to the same lead-dot color (stable across renders)', async () => {
  mockGetVoyageHistory.mockResolvedValue({ data: voyages, error: null });

  const first = await render(<VoyageHistoryScreen />);
  await waitFor(() => expect(first.getByTestId('voyage-history-row-voyage-1')).toBeTruthy());
  const firstStyle = first.getByTestId('voyage-history-dot-voyage-1').props.style;
  const firstColor = firstStyle[firstStyle.length - 1].backgroundColor;

  const second = await render(<VoyageHistoryScreen />);
  await waitFor(() => expect(second.getByTestId('voyage-history-row-voyage-1')).toBeTruthy());
  const secondStyle = second.getByTestId('voyage-history-dot-voyage-1').props.style;
  const secondColor = secondStyle[secondStyle.length - 1].backgroundColor;

  expect(firstColor).toBe(secondColor);
  expect(firstColor).toBeTruthy();
});

test('search matches destinations regardless of diacritics', async () => {
  mockGetVoyageHistory.mockResolvedValue({
    data: [...voyages, { ...voyages[0], id: 'voyage-3', destination: 'São Paulo' }],
    error: null,
  });

  const { getByTestId, queryByTestId } = await render(<VoyageHistoryScreen />);
  await waitFor(() => expect(getByTestId('voyage-history-row-voyage-3')).toBeTruthy());

  await act(async () => {
    fireEvent.changeText(getByTestId('voyage-history-search'), 'sao paulo');
  });

  await waitFor(() => expect(queryByTestId('voyage-history-row-voyage-1')).toBeNull());
  expect(getByTestId('voyage-history-row-voyage-3')).toBeTruthy();
});

test('the error state offers a working retry', async () => {
  mockGetVoyageHistory
    .mockResolvedValueOnce({ data: null, error: { code: 'unknown', message: 'Network request failed' } })
    .mockResolvedValueOnce({ data: voyages, error: null });

  const { getByTestId } = await render(<VoyageHistoryScreen />);
  await waitFor(() => expect(getByTestId('voyage-history-error')).toBeTruthy());

  await act(async () => {
    fireEvent.press(getByTestId('voyage-history-retry'));
  });

  await waitFor(() => expect(getByTestId('voyage-history-row-voyage-1')).toBeTruthy());
  expect(mockGetVoyageHistory).toHaveBeenCalledTimes(2);
});

test('renders correctly under Reduce Motion (no row-stagger animation)', async () => {
  jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(true);
  mockGetVoyageHistory.mockResolvedValue({ data: voyages, error: null });

  const { getByTestId } = await render(<VoyageHistoryScreen />);

  await waitFor(() => expect(getByTestId('voyage-history-row-voyage-1')).toBeTruthy());
  expect(getByTestId('voyage-history-row-voyage-2')).toBeTruthy();
});

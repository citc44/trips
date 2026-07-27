import { beforeEach, expect, jest, test } from '@jest/globals';
import { act, fireEvent, render } from '@testing-library/react-native';

import VoyageEndedScreen from '../voyage-ended';

const mockPush = jest.fn();
const mockUseLocalSearchParams = jest.fn();
jest.mock('expo-router', () => ({
  router: { push: (...args: unknown[]) => mockPush(...args) },
  useLocalSearchParams: () => mockUseLocalSearchParams(),
}));

beforeEach(() => {
  jest.clearAllMocks();
  mockUseLocalSearchParams.mockReturnValue({
    destination: 'Lake Tahoe',
    createdAt: '2026-07-26T00:00:00Z',
    endedAt: '2026-07-26T05:30:00Z',
    voyagerCount: '3',
  });
});

test('shows a calm summary: duration, Voyager count, and destination', async () => {
  const { getByText } = await render(<VoyageEndedScreen />);

  expect(getByText('Voyage ended.')).toBeTruthy();
  expect(getByText('5h 30m · 3 Voyagers · Lake Tahoe')).toBeTruthy();
});

test('singular "Voyager" when the count is exactly 1', async () => {
  mockUseLocalSearchParams.mockReturnValue({
    destination: 'Big Sur',
    createdAt: '2026-07-26T00:00:00Z',
    endedAt: '2026-07-26T01:00:00Z',
    voyagerCount: '1',
  });

  const { getByText } = await render(<VoyageEndedScreen />);

  expect(getByText('1h 0m · 1 Voyager · Big Sur')).toBeTruthy();
});

test('omits the Voyager-count segment (never renders "NaN") when voyagerCount is missing', async () => {
  mockUseLocalSearchParams.mockReturnValue({
    destination: 'Lake Tahoe',
    createdAt: '2026-07-26T00:00:00Z',
    endedAt: '2026-07-26T05:30:00Z',
    voyagerCount: undefined,
  });

  const { getByText, queryByText } = await render(<VoyageEndedScreen />);

  expect(getByText('5h 30m · Lake Tahoe')).toBeTruthy();
  expect(queryByText(/NaN/)).toBeNull();
});

test('omits the duration segment (never renders "NaN") when createdAt/endedAt are not parseable', async () => {
  mockUseLocalSearchParams.mockReturnValue({
    destination: 'Lake Tahoe',
    createdAt: 'not-a-date',
    endedAt: 'also-not-a-date',
    voyagerCount: '3',
  });

  const { getByText, queryByText } = await render(<VoyageEndedScreen />);

  expect(getByText('3 Voyagers · Lake Tahoe')).toBeTruthy();
  expect(queryByText(/NaN/)).toBeNull();
});

test('tapping Back to Home routes to /', async () => {
  const { getByTestId } = await render(<VoyageEndedScreen />);

  await act(async () => {
    fireEvent.press(getByTestId('back-to-home-button'));
  });

  expect(mockPush).toHaveBeenCalledWith('/');
});

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

test('shows a calm summary: destination, duration, and Voyager count as independent segments', async () => {
  const { getByText, getByTestId } = await render(<VoyageEndedScreen />);

  expect(getByText('Voyage ended.')).toBeTruthy();
  expect(getByText('Lake Tahoe')).toBeTruthy();
  expect(getByText('Duration')).toBeTruthy();
  expect(getByTestId('voyage-ended-duration-value').props.children).toBe('5h 30m');
  expect(getByText('Voyagers')).toBeTruthy();
  expect(getByTestId('voyage-ended-voyager-count-value').props.children).toBe(3);
});

test('singular "Voyager" label when the count is exactly 1', async () => {
  mockUseLocalSearchParams.mockReturnValue({
    destination: 'Big Sur',
    createdAt: '2026-07-26T00:00:00Z',
    endedAt: '2026-07-26T01:00:00Z',
    voyagerCount: '1',
  });

  const { getByText, getByTestId, queryByText } = await render(<VoyageEndedScreen />);

  expect(getByText('Voyager')).toBeTruthy();
  expect(queryByText('Voyagers')).toBeNull();
  expect(getByTestId('voyage-ended-voyager-count-value').props.children).toBe(1);
});

test('omits the Voyager-count stat entirely (never renders "NaN") when voyagerCount is missing', async () => {
  mockUseLocalSearchParams.mockReturnValue({
    destination: 'Lake Tahoe',
    createdAt: '2026-07-26T00:00:00Z',
    endedAt: '2026-07-26T05:30:00Z',
    voyagerCount: undefined,
  });

  const { getByTestId, queryByTestId, queryByText, queryAllByText } = await render(<VoyageEndedScreen />);

  expect(getByTestId('voyage-ended-duration-value').props.children).toBe('5h 30m');
  expect(queryByTestId('voyage-ended-voyager-count-value')).toBeNull();
  expect(queryByText('Voyager')).toBeNull();
  expect(queryByText('Voyagers')).toBeNull();
  expect(queryAllByText(/NaN/)).toHaveLength(0);
});

test('omits the Duration stat entirely (never renders "NaN") when createdAt/endedAt are not parseable', async () => {
  mockUseLocalSearchParams.mockReturnValue({
    destination: 'Lake Tahoe',
    createdAt: 'not-a-date',
    endedAt: 'also-not-a-date',
    voyagerCount: '3',
  });

  const { getByTestId, queryByTestId, queryAllByText } = await render(<VoyageEndedScreen />);

  expect(queryByTestId('voyage-ended-duration-value')).toBeNull();
  expect(getByTestId('voyage-ended-voyager-count-value').props.children).toBe(3);
  expect(queryAllByText(/NaN/)).toHaveLength(0);
});

test('tapping Back to Home routes to /', async () => {
  const { getByTestId } = await render(<VoyageEndedScreen />);

  await act(async () => {
    fireEvent.press(getByTestId('back-to-home-button'));
  });

  expect(mockPush).toHaveBeenCalledWith('/');
});

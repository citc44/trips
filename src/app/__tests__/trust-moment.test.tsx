import { beforeEach, expect, jest, test } from '@jest/globals';
import { act, fireEvent, render } from '@testing-library/react-native';

import TrustMomentScreen from '@/app/trust-moment';

const mockMarkTrustMomentSeen = jest.fn<() => Promise<any>>();

jest.mock('@/shared/hooks/use-profile', () => ({
  useProfile: () => ({
    markTrustMomentSeen: mockMarkTrustMomentSeen,
  }),
}));

beforeEach(() => {
  jest.clearAllMocks();
});

test('renders the locked Trust Moment copy', async () => {
  const { getByText } = await render(<TrustMomentScreen />);

  expect(getByText('Your location stays in this Voyage.')).toBeTruthy();
  expect(
    getByText("We never sell your location data. It's visible only to people in your Voyage, and only while it's active."),
  ).toBeTruthy();
});

test('tapping "Got it" calls markTrustMomentSeen', async () => {
  mockMarkTrustMomentSeen.mockResolvedValue({ error: null });

  const { getByTestId } = await render(<TrustMomentScreen />);

  await act(async () => {
    fireEvent.press(getByTestId('got-it-button'));
  });

  expect(mockMarkTrustMomentSeen).toHaveBeenCalledTimes(1);
});

test('shows an inline error and re-enables the button when markTrustMomentSeen resolves with an error', async () => {
  mockMarkTrustMomentSeen.mockResolvedValue({ error: { code: '42501', message: 'permission denied' } });

  const { getByTestId, queryByTestId } = await render(<TrustMomentScreen />);

  await act(async () => {
    fireEvent.press(getByTestId('got-it-button'));
  });

  expect(queryByTestId('error-message')).toBeTruthy();
  expect(getByTestId('error-message').props.children).toBe('permission denied');
  expect(getByTestId('got-it-button').props.accessibilityState?.disabled).toBe(false);
});

test('shows a generic error and re-enables the button when markTrustMomentSeen rejects', async () => {
  mockMarkTrustMomentSeen.mockRejectedValue(new Error('boom'));

  const { getByTestId, queryByTestId } = await render(<TrustMomentScreen />);

  await act(async () => {
    fireEvent.press(getByTestId('got-it-button'));
  });

  expect(queryByTestId('error-message')).toBeTruthy();
  expect(getByTestId('got-it-button').props.accessibilityState?.disabled).toBe(false);
});

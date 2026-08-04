import { beforeEach, expect, jest, test } from '@jest/globals';
import { act, fireEvent, render } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';

import TrustMomentScreen from '@/app/trust-moment';
import { WayfinderColors } from '@/constants/design-tokens';

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

test('shows the teal shield icon badge (Story 4.4 -- distinct from Driver Consent\'s amber car badge)', async () => {
  const { getByTestId } = await render(<TrustMomentScreen />);

  const flatStyle = StyleSheet.flatten(getByTestId('trust-moment-icon-badge').props.style);
  expect(flatStyle.backgroundColor).toBe(WayfinderColors.accentTeal);
});

test('tapping "Got it" calls markTrustMomentSeen', async () => {
  mockMarkTrustMomentSeen.mockResolvedValue({ error: null });

  const { getByTestId } = await render(<TrustMomentScreen />);

  await act(async () => {
    fireEvent.press(getByTestId('trust-moment-got-it-button'));
  });

  expect(mockMarkTrustMomentSeen).toHaveBeenCalledTimes(1);
});

test('"Got it" button is disabled while the request is in flight', async () => {
  let resolveMark: (value: any) => void;
  mockMarkTrustMomentSeen.mockReturnValue(
    new Promise((resolve) => {
      resolveMark = resolve;
    }),
  );

  const { getByTestId } = await render(<TrustMomentScreen />);

  await act(async () => {
    fireEvent.press(getByTestId('trust-moment-got-it-button'));
  });

  expect(getByTestId('trust-moment-got-it-button').props.accessibilityState?.disabled).toBe(true);

  await act(async () => {
    resolveMark({ error: null });
  });
});

test('shows an inline error and re-enables the button when markTrustMomentSeen resolves with an error', async () => {
  mockMarkTrustMomentSeen.mockResolvedValue({ error: { code: '42501', message: 'permission denied' } });

  const { getByTestId, queryByTestId } = await render(<TrustMomentScreen />);

  await act(async () => {
    fireEvent.press(getByTestId('trust-moment-got-it-button'));
  });

  expect(queryByTestId('trust-moment-error-message')).toBeTruthy();
  expect(getByTestId('trust-moment-error-message').props.children).toBe('permission denied');
  expect(getByTestId('trust-moment-got-it-button').props.accessibilityState?.disabled).toBe(false);
});

test('shows a generic error and re-enables the button when markTrustMomentSeen rejects', async () => {
  mockMarkTrustMomentSeen.mockRejectedValue(new Error('boom'));

  const { getByTestId, queryByTestId } = await render(<TrustMomentScreen />);

  await act(async () => {
    fireEvent.press(getByTestId('trust-moment-got-it-button'));
  });

  expect(queryByTestId('trust-moment-error-message')).toBeTruthy();
  expect(getByTestId('trust-moment-got-it-button').props.accessibilityState?.disabled).toBe(false);
});

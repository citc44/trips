import { beforeEach, expect, jest, test } from '@jest/globals';
import { act, fireEvent, render } from '@testing-library/react-native';

import DriverAttentionConsentScreen from '@/app/driver-attention-consent';

const mockMarkDriverConsentSeen = jest.fn<() => Promise<any>>();

jest.mock('@/shared/hooks/use-profile', () => ({
  useProfile: () => ({
    markDriverConsentSeen: mockMarkDriverConsentSeen,
  }),
}));

beforeEach(() => {
  jest.clearAllMocks();
});

test('renders the locked Driver Attention Consent copy', async () => {
  const { getByText } = await render(<DriverAttentionConsentScreen />);

  expect(getByText("If you're behind the wheel, stay focused on the road — Voylo can't do that for you.")).toBeTruthy();
  expect(getByText("Voylo isn't responsible for distracted driving.")).toBeTruthy();
});

test('tapping "Got it" calls markDriverConsentSeen', async () => {
  mockMarkDriverConsentSeen.mockResolvedValue({ error: null });

  const { getByTestId } = await render(<DriverAttentionConsentScreen />);

  await act(async () => {
    fireEvent.press(getByTestId('driver-consent-got-it-button'));
  });

  expect(mockMarkDriverConsentSeen).toHaveBeenCalledTimes(1);
});

test('"Got it" button is disabled while the request is in flight', async () => {
  let resolveMark: (value: any) => void;
  mockMarkDriverConsentSeen.mockReturnValue(
    new Promise((resolve) => {
      resolveMark = resolve;
    }),
  );

  const { getByTestId } = await render(<DriverAttentionConsentScreen />);

  await act(async () => {
    fireEvent.press(getByTestId('driver-consent-got-it-button'));
  });

  expect(getByTestId('driver-consent-got-it-button').props.accessibilityState?.disabled).toBe(true);

  await act(async () => {
    resolveMark({ error: null });
  });
});

test('shows an inline error and re-enables the button when markDriverConsentSeen resolves with an error', async () => {
  mockMarkDriverConsentSeen.mockResolvedValue({ error: { code: '42501', message: 'permission denied' } });

  const { getByTestId, queryByTestId } = await render(<DriverAttentionConsentScreen />);

  await act(async () => {
    fireEvent.press(getByTestId('driver-consent-got-it-button'));
  });

  expect(queryByTestId('driver-consent-error-message')).toBeTruthy();
  expect(getByTestId('driver-consent-error-message').props.children).toBe('permission denied');
  expect(getByTestId('driver-consent-got-it-button').props.accessibilityState?.disabled).toBe(false);
});

test('shows a generic error and re-enables the button when markDriverConsentSeen rejects', async () => {
  mockMarkDriverConsentSeen.mockRejectedValue(new Error('boom'));

  const { getByTestId, queryByTestId } = await render(<DriverAttentionConsentScreen />);

  await act(async () => {
    fireEvent.press(getByTestId('driver-consent-got-it-button'));
  });

  expect(queryByTestId('driver-consent-error-message')).toBeTruthy();
  expect(getByTestId('driver-consent-got-it-button').props.accessibilityState?.disabled).toBe(false);
});

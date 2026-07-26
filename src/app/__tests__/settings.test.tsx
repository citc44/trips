import { jest, test, expect, beforeEach } from '@jest/globals';
import { act, fireEvent, render } from '@testing-library/react-native';

import SettingsScreen from '@/app/settings';

const mockSignOut = jest.fn<() => Promise<any>>();

jest.mock('@/shared/hooks/use-auth', () => ({
  useAuth: () => ({
    signOut: mockSignOut,
  }),
}));

beforeEach(() => {
  jest.clearAllMocks();
});

test('tapping sign out calls signOut', async () => {
  mockSignOut.mockResolvedValue({ error: null });

  const { getByTestId } = await render(<SettingsScreen />);

  await act(async () => {
    fireEvent.press(getByTestId('sign-out-button'));
  });

  expect(mockSignOut).toHaveBeenCalledTimes(1);
});

test('sign-out button is disabled while signing out', async () => {
  let resolveSignOut: (value: any) => void;
  mockSignOut.mockReturnValue(
    new Promise((resolve) => {
      resolveSignOut = resolve;
    }),
  );

  const { getByTestId } = await render(<SettingsScreen />);

  await act(async () => {
    fireEvent.press(getByTestId('sign-out-button'));
  });

  expect(getByTestId('sign-out-button').props.accessibilityState?.disabled).toBe(true);

  await act(async () => {
    resolveSignOut({ error: null });
  });
});

test('shows an inline error when signOut resolves with an error', async () => {
  mockSignOut.mockResolvedValue({ error: { message: 'Network request failed' } });

  const { getByTestId, queryByTestId } = await render(<SettingsScreen />);

  await act(async () => {
    fireEvent.press(getByTestId('sign-out-button'));
  });

  expect(queryByTestId('error-message')).toBeTruthy();
  expect(getByTestId('error-message').props.children).toBe('Network request failed');
  // Button must re-enable after a failure, not stay stuck disabled.
  expect(getByTestId('sign-out-button').props.accessibilityState?.disabled).toBe(false);
});

test('shows a generic error and re-enables the button when signOut rejects', async () => {
  mockSignOut.mockRejectedValue(new Error('boom'));

  const { getByTestId, queryByTestId } = await render(<SettingsScreen />);

  await act(async () => {
    fireEvent.press(getByTestId('sign-out-button'));
  });

  expect(queryByTestId('error-message')).toBeTruthy();
  expect(getByTestId('sign-out-button').props.accessibilityState?.disabled).toBe(false);
});

import { expect, jest, test } from '@jest/globals';
import { fireEvent, render } from '@testing-library/react-native';

import HomeScreen from '@/app/index';

const mockPush = jest.fn();
jest.mock('expo-router', () => {
  const actual = jest.requireActual('expo-router') as object;
  return {
    ...actual,
    router: { push: (...args: unknown[]) => mockPush(...args) },
  };
});

test('renders a link to Settings', async () => {
  const { getByTestId } = await render(<HomeScreen />);

  expect(getByTestId('settings-link').props.href).toBe('/settings');
});

test('tapping "Start a Voyage" navigates to /voyage-intro', async () => {
  const { getByTestId } = await render(<HomeScreen />);

  fireEvent.press(getByTestId('start-voyage-button'));

  expect(mockPush).toHaveBeenCalledWith('/voyage-intro');
});

test('tapping "Join a Voyage" navigates to /join', async () => {
  const { getByTestId } = await render(<HomeScreen />);

  fireEvent.press(getByTestId('join-voyage-button'));

  expect(mockPush).toHaveBeenCalledWith('/join');
});

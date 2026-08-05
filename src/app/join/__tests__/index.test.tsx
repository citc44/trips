import { expect, jest, test } from '@jest/globals';
import { act, fireEvent, render } from '@testing-library/react-native';

import JoinManualScreen from '@/app/join/index';

const mockPush = jest.fn();
const mockReplace = jest.fn();
jest.mock('expo-router', () => {
  const actual = jest.requireActual('expo-router') as object;
  return {
    ...actual,
    router: {
      push: (...args: unknown[]) => mockPush(...args),
      replace: (...args: unknown[]) => mockReplace(...args),
    },
  };
});

test('"Join" is disabled while the field is empty', async () => {
  const { getByTestId } = await render(<JoinManualScreen />);

  expect(getByTestId('join-with-code-button').props.accessibilityState?.disabled).toBe(true);
});

test('stays disabled for whitespace-only input', async () => {
  const { getByTestId } = await render(<JoinManualScreen />);

  await act(async () => {
    fireEvent.changeText(getByTestId('join-code-input'), '   ');
  });

  expect(getByTestId('join-with-code-button').props.accessibilityState?.disabled).toBe(true);
});

test('"Join" becomes enabled once a code is entered', async () => {
  const { getByTestId } = await render(<JoinManualScreen />);

  await act(async () => {
    fireEvent.changeText(getByTestId('join-code-input'), 'ABCD2345');
  });

  expect(getByTestId('join-with-code-button').props.accessibilityState?.disabled).toBe(false);
});

test('tapping "Join" replaces into /join/[code] with the trimmed code -- all preview/validation/join logic lives there', async () => {
  const { getByTestId } = await render(<JoinManualScreen />);

  await act(async () => {
    fireEvent.changeText(getByTestId('join-code-input'), '  ABCD2345  ');
  });
  await act(async () => {
    fireEvent.press(getByTestId('join-with-code-button'));
  });

  expect(mockReplace).toHaveBeenCalledWith({ pathname: '/join/[code]', params: { code: 'ABCD2345' } });
  expect(mockPush).not.toHaveBeenCalled();
});

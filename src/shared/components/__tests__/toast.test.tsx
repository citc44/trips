import { afterEach, beforeEach, expect, jest, test } from '@jest/globals';
import { act, render } from '@testing-library/react-native';

import { Toast } from '../toast';

beforeEach(() => {
  jest.useFakeTimers();
});

afterEach(() => {
  jest.useRealTimers();
});

test('renders the message', async () => {
  const { getByText } = await render(<Toast message="Meera is now an Organizer" onDismiss={() => {}} />);

  expect(getByText('Meera is now an Organizer')).toBeTruthy();
});

test('calls onDismiss automatically after ~4s', async () => {
  const onDismiss = jest.fn();
  await render(<Toast message="Meera is now an Organizer" onDismiss={onDismiss} />);

  expect(onDismiss).not.toHaveBeenCalled();

  await act(async () => {
    jest.advanceTimersByTime(4000);
  });

  expect(onDismiss).toHaveBeenCalledTimes(1);
});

test('does not call onDismiss before the auto-dismiss window elapses', async () => {
  const onDismiss = jest.fn();
  await render(<Toast message="Meera is now an Organizer" onDismiss={onDismiss} />);

  await act(async () => {
    jest.advanceTimersByTime(3000);
  });

  expect(onDismiss).not.toHaveBeenCalled();
});

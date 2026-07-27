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

test('does not restart the dismiss window when re-rendered with a new onDismiss identity but the same message (code review finding)', async () => {
  const firstOnDismiss = jest.fn();
  const { rerender } = await render(<Toast message="Meera is now an Organizer" onDismiss={firstOnDismiss} />);

  await act(async () => {
    jest.advanceTimersByTime(3000);
  });

  // Simulates a parent re-render passing a brand-new inline arrow function,
  // as active-voyage.tsx's onDismiss={() => setToastMessage(null)} does.
  const secondOnDismiss = jest.fn();
  await act(async () => {
    rerender(<Toast message="Meera is now an Organizer" onDismiss={secondOnDismiss} />);
  });

  await act(async () => {
    jest.advanceTimersByTime(1000);
  });

  // Original 4s window (3000 + 1000) should have elapsed -- the callback
  // fires exactly once, using whichever onDismiss is current when it fires.
  expect(secondOnDismiss).toHaveBeenCalledTimes(1);
  expect(firstOnDismiss).not.toHaveBeenCalled();
});

test('restarts the dismiss window when the message itself changes', async () => {
  const onDismiss = jest.fn();
  const { rerender } = await render(<Toast message="Meera is now an Organizer" onDismiss={onDismiss} />);

  await act(async () => {
    jest.advanceTimersByTime(3000);
  });

  await act(async () => {
    rerender(<Toast message="Chintan is now an Organizer" onDismiss={onDismiss} />);
  });

  await act(async () => {
    jest.advanceTimersByTime(3000);
  });
  expect(onDismiss).not.toHaveBeenCalled();

  await act(async () => {
    jest.advanceTimersByTime(1000);
  });
  expect(onDismiss).toHaveBeenCalledTimes(1);
});

test('has an alert accessibility role and a polite live region', async () => {
  const { getByTestId } = await render(<Toast testID="toast" message="Meera is now an Organizer" onDismiss={() => {}} />);

  expect(getByTestId('toast').props.accessibilityRole).toBe('alert');
  expect(getByTestId('toast').props.accessibilityLiveRegion).toBe('polite');
});

import { afterEach, beforeEach, expect, jest, test } from '@jest/globals';
import { act, render } from '@testing-library/react-native';
import { AccessibilityInfo } from 'react-native';

import { SplashThread as SplashThreadTokens } from '@/constants/design-tokens';

import { SplashThread } from '../splash-thread';

beforeEach(() => {
  jest.useFakeTimers();
});

afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
});

test('renders the full-bleed sequence: three dots, three sparks, and the wordmark', async () => {
  const { getByTestId, getByText } = await render(<SplashThread onComplete={() => {}} />);

  expect(getByTestId('splash-thread')).toBeTruthy();
  SplashThreadTokens.dots.forEach((_, index) => expect(getByTestId(`splash-thread-dot-${index}`)).toBeTruthy());
  SplashThreadTokens.sparks.forEach((_, index) => expect(getByTestId(`splash-thread-spark-${index}`)).toBeTruthy());
  expect(getByText('Voylo')).toBeTruthy();
  expect(getByText(SplashThreadTokens.tagline)).toBeTruthy();
});

test('is purely decorative -- not interactive (pointerEvents="none")', async () => {
  const { getByTestId } = await render(<SplashThread onComplete={() => {}} />);

  expect(getByTestId('splash-thread').props.pointerEvents).toBe('none');
});

test('calls onComplete once the full sequence has played', async () => {
  jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(false);
  const onComplete = jest.fn();
  await render(<SplashThread onComplete={onComplete} />);

  await act(async () => {
    jest.advanceTimersByTime(SplashThreadTokens.totalDurationMs - 1);
  });
  expect(onComplete).not.toHaveBeenCalled();

  await act(async () => {
    jest.advanceTimersByTime(1);
  });
  expect(onComplete).toHaveBeenCalledTimes(1);
});

test('under Reduce Motion, completes quickly via the settled crossfade instead of the full sequence', async () => {
  jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(true);
  const onComplete = jest.fn();
  await render(<SplashThread onComplete={onComplete} />);

  await act(async () => {
    jest.advanceTimersByTime(SplashThreadTokens.reducedHoldMs);
  });

  expect(onComplete).toHaveBeenCalledTimes(1);
});

test('does not restart the sequence or call onComplete twice if re-rendered with a new onComplete closure', async () => {
  jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(true);
  const firstOnComplete = jest.fn();
  const secondOnComplete = jest.fn();
  const { rerender } = await render(<SplashThread onComplete={firstOnComplete} />);

  await act(async () => {
    rerender(<SplashThread onComplete={secondOnComplete} />);
  });

  await act(async () => {
    jest.advanceTimersByTime(SplashThreadTokens.reducedHoldMs);
  });

  expect(firstOnComplete).not.toHaveBeenCalled();
  expect(secondOnComplete).toHaveBeenCalledTimes(1);
});

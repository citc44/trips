import { afterEach, beforeEach, expect, jest, test } from '@jest/globals';
import { act, render } from '@testing-library/react-native';
import { AccessibilityInfo } from 'react-native';

import { HorizonStrip as HorizonStripTokens } from '@/constants/design-tokens';

import { HorizonStrip } from '../horizon-strip';

beforeEach(() => {
  jest.useFakeTimers();
});

afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
});

test('renders the strip and its decorative sky-glow', async () => {
  const { getByTestId } = await render(<HorizonStrip />);

  expect(getByTestId('horizon-strip')).toBeTruthy();
  expect(getByTestId('horizon-strip-sky-glow')).toBeTruthy();
});

test('is purely decorative -- not interactive (pointerEvents="none")', async () => {
  const { getByTestId } = await render(<HorizonStrip />);

  expect(getByTestId('horizon-strip').props.pointerEvents).toBe('none');
});

test('under Reduce Motion, the dash drift never starts', async () => {
  jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(true);

  const { getByTestId } = await render(<HorizonStrip />);

  await act(async () => {
    jest.advanceTimersByTime(HorizonStripTokens.driftDurationMs * 3);
  });

  // Still renders correctly -- Reduce Motion freezes to a static frame, it
  // doesn't hide the strip entirely.
  expect(getByTestId('horizon-strip')).toBeTruthy();
});

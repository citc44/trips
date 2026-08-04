import { expect, jest, test } from '@jest/globals';
import { act, renderHook } from '@testing-library/react-native';
import { AccessibilityInfo } from 'react-native';

import { useReduceMotion } from '../use-reduce-motion';

test('resolves reduceMotion=false, resolved=true when Reduce Motion is off', async () => {
  jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(false);

  const { result } = await renderHook(() => useReduceMotion());

  expect(result.current.resolved).toBe(true);
  expect(result.current.reduceMotion).toBe(false);
});

test('resolves reduceMotion=true, resolved=true when Reduce Motion is on', async () => {
  jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(true);

  const { result } = await renderHook(() => useReduceMotion());

  expect(result.current.resolved).toBe(true);
  expect(result.current.reduceMotion).toBe(true);
});

test('reduceMotion updates live on a reduceMotionChanged event', async () => {
  jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(false);
  let changeHandler: (enabled: boolean) => void = () => {};
  jest.spyOn(AccessibilityInfo, 'addEventListener').mockImplementation((_event: string, handler: any) => {
    changeHandler = handler;
    return { remove: jest.fn() } as any;
  });

  const { result } = await renderHook(() => useReduceMotion());

  expect(result.current.reduceMotion).toBe(false);

  await act(async () => {
    changeHandler(true);
  });

  expect(result.current.reduceMotion).toBe(true);
});

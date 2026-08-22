import { expect, jest, test } from '@jest/globals';
import { act, fireEvent, render } from '@testing-library/react-native';
import { AccessibilityInfo } from 'react-native';

import HomeScreen from '@/app/index';
import { HomeJourneyMotion } from '@/constants/design-tokens';

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

test('renders a link to Voyage History, alongside the existing Settings link', async () => {
  const { getByTestId, getByText } = await render(<HomeScreen />);

  expect(getByTestId('voyage-history-link').props.href).toBe('/voyage-history');
  expect(getByText('Past Voyages')).toBeTruthy();
  // Settings link still renders correctly alongside the new one -- no regression.
  expect(getByTestId('settings-link').props.href).toBe('/settings');
  expect(getByText('Settings')).toBeTruthy();
});

test('renders the Home Journey tagline', async () => {
  const { getByText } = await render(<HomeScreen />);

  expect(getByText('Every journey tells a story.')).toBeTruthy();
});

test('renders the Home Journey visual and its animated elements', async () => {
  const { getByTestId } = await render(<HomeScreen />);

  expect(getByTestId('home-journey')).toBeTruthy();
  expect(getByTestId('home-journey-reveal-glow')).toBeTruthy();
  expect(getByTestId('home-journey-crew-dot-0')).toBeTruthy();
  expect(getByTestId('home-journey-crew-dot-1')).toBeTruthy();
  expect(getByTestId('home-journey-crew-dot-2')).toBeTruthy();
  expect(getByTestId('home-journey-spark-0')).toBeTruthy();
  expect(getByTestId('home-journey-spark-1')).toBeTruthy();
  expect(getByTestId('home-journey-spark-2')).toBeTruthy();
  expect(getByTestId('home-journey-wordmark-glow')).toBeTruthy();
});

test('the Home Journey road is purely decorative -- not interactive (pointerEvents="none")', async () => {
  const { getByTestId } = await render(<HomeScreen />);

  expect(getByTestId('home-journey').props.pointerEvents).toBe('none');
});

test('under Reduce Motion, the Home Journey still renders a static frame -- including sparks', async () => {
  jest.useFakeTimers();
  jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(true);

  const { getByTestId } = await render(<HomeScreen />);

  await act(async () => {
    jest.advanceTimersByTime(HomeJourneyMotion.memorySparkDurationMs * 3);
  });

  // Reduce Motion freezes to a static frame -- everything still renders,
  // including the sparks (code review finding, Story 4.8: an earlier pass
  // left sparks at opacity 0 under Reduce Motion, effectively hiding them).
  expect(getByTestId('home-journey')).toBeTruthy();
  expect(getByTestId('home-journey-spark-0')).toBeTruthy();

  jest.useRealTimers();
  jest.restoreAllMocks();
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

import { expect, jest, test } from '@jest/globals';
import { fireEvent, render } from '@testing-library/react-native';

import VoyageIntroScreen from '@/app/voyage-intro';

const mockPush = jest.fn();
jest.mock('expo-router', () => {
  const actual = jest.requireActual('expo-router') as object;
  return {
    ...actual,
    router: { push: (...args: unknown[]) => mockPush(...args) },
  };
});

test('renders the locked Voyage Intro copy', async () => {
  const { getByText } = await render(<VoyageIntroScreen />);

  expect(getByText('Every journey tells a story.')).toBeTruthy();
  expect(
    getByText(
      "Voylo rides along live and turns the trip into a memory reel — inside jokes, wrong turns, and all — ready the moment you arrive.",
    ),
  ).toBeTruthy();
});

test('tapping "Choose Your Destination" navigates to /destination-picker', async () => {
  const { getByTestId } = await render(<VoyageIntroScreen />);

  fireEvent.press(getByTestId('choose-destination-button'));

  expect(mockPush).toHaveBeenCalledWith('/destination-picker');
});

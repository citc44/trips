import { beforeEach, expect, jest, test } from '@jest/globals';
import { act, fireEvent, render } from '@testing-library/react-native';

import DestinationPickerScreen from '@/app/destination-picker';

const mockPush = jest.fn();
jest.mock('expo-router', () => {
  const actual = jest.requireActual('expo-router') as object;
  return {
    ...actual,
    router: { push: (...args: unknown[]) => mockPush(...args) },
  };
});

const mockStartVoyage = jest.fn<(...args: any[]) => Promise<any>>();
jest.mock('@/repositories/voyage-repository', () => ({
  voyageRepository: {
    startVoyage: (...args: unknown[]) => mockStartVoyage(...args),
  },
}));

beforeEach(() => {
  jest.clearAllMocks();
});

test('renders the locked prompt copy', async () => {
  const { getByText } = await render(<DestinationPickerScreen />);

  expect(getByText('Destination')).toBeTruthy();
  expect(getByText('Where are you headed?')).toBeTruthy();
});

test('"Start the Voyage" is disabled while the field is empty', async () => {
  const { getByTestId } = await render(<DestinationPickerScreen />);

  expect(getByTestId('start-the-voyage-button').props.accessibilityState?.disabled).toBe(true);
});

test('"Start the Voyage" becomes enabled once a destination is entered', async () => {
  const { getByTestId } = await render(<DestinationPickerScreen />);

  await act(async () => {
    fireEvent.changeText(getByTestId('destination-input'), 'Lake Tahoe');
  });

  expect(getByTestId('start-the-voyage-button').props.accessibilityState?.disabled).toBe(false);
});

test('stays disabled for whitespace-only input', async () => {
  const { getByTestId } = await render(<DestinationPickerScreen />);

  await act(async () => {
    fireEvent.changeText(getByTestId('destination-input'), '   ');
  });

  expect(getByTestId('start-the-voyage-button').props.accessibilityState?.disabled).toBe(true);
});

test('tapping "Start the Voyage" calls voyageRepository.startVoyage with the trimmed destination', async () => {
  mockStartVoyage.mockResolvedValue({ data: { id: 'voyage-1' }, error: null });

  const { getByTestId } = await render(<DestinationPickerScreen />);

  await act(async () => {
    fireEvent.changeText(getByTestId('destination-input'), '  Lake Tahoe  ');
  });
  await act(async () => {
    fireEvent.press(getByTestId('start-the-voyage-button'));
  });

  expect(mockStartVoyage).toHaveBeenCalledWith('Lake Tahoe');
});

test('navigates to the Join-code screen with the created Voyage\'s destination and code on success', async () => {
  mockStartVoyage.mockResolvedValue({
    data: { id: 'voyage-1', destination: 'Lake Tahoe', joinCode: 'ABCD2345' },
    error: null,
  });

  const { getByTestId } = await render(<DestinationPickerScreen />);

  await act(async () => {
    fireEvent.changeText(getByTestId('destination-input'), 'Lake Tahoe');
  });
  await act(async () => {
    fireEvent.press(getByTestId('start-the-voyage-button'));
  });

  expect(mockPush).toHaveBeenCalledWith({
    pathname: '/join-code',
    params: { destination: 'Lake Tahoe', joinCode: 'ABCD2345' },
  });
});

test('shows the AD-9 rejection message inline and re-enables the button', async () => {
  mockStartVoyage.mockResolvedValue({ data: null, error: { code: 'P0001', message: 'You already have an active Voyage.' } });

  const { getByTestId, queryByTestId } = await render(<DestinationPickerScreen />);

  await act(async () => {
    fireEvent.changeText(getByTestId('destination-input'), 'Lake Tahoe');
  });
  await act(async () => {
    fireEvent.press(getByTestId('start-the-voyage-button'));
  });

  expect(queryByTestId('error-message')).toBeTruthy();
  expect(getByTestId('error-message').props.children).toBe('You already have an active Voyage.');
  expect(getByTestId('start-the-voyage-button').props.accessibilityState?.disabled).toBe(false);
  expect(mockPush).not.toHaveBeenCalled();
});

test('shows a generic error and re-enables the button when startVoyage rejects', async () => {
  mockStartVoyage.mockRejectedValue(new Error('boom'));

  const { getByTestId, queryByTestId } = await render(<DestinationPickerScreen />);

  await act(async () => {
    fireEvent.changeText(getByTestId('destination-input'), 'Lake Tahoe');
  });
  await act(async () => {
    fireEvent.press(getByTestId('start-the-voyage-button'));
  });

  expect(queryByTestId('error-message')).toBeTruthy();
  expect(getByTestId('start-the-voyage-button').props.accessibilityState?.disabled).toBe(false);
});

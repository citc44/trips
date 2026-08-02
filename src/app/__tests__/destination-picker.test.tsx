import { afterEach, beforeEach, expect, jest, test } from '@jest/globals';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';

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

const mockSearchDestinations = jest.fn<(...args: any[]) => Promise<any>>();
jest.mock('@/repositories/geocoding-repository', () => ({
  geocodingRepository: {
    searchDestinations: (...args: unknown[]) => mockSearchDestinations(...args),
  },
}));

const mockRefetch = jest.fn<() => Promise<void>>();
jest.mock('@/shared/hooks/use-active-voyage', () => ({
  useActiveVoyage: () => ({ activeVoyage: null, isLoading: false, hasError: false, refetch: mockRefetch }),
}));

const TAHOE_SUGGESTION = { id: 'place.1', placeName: 'Lake Tahoe, California, United States', lat: 39.0968, lng: -120.0324 };

beforeEach(() => {
  jest.useFakeTimers();
  jest.clearAllMocks();
  mockSearchDestinations.mockResolvedValue({ data: [TAHOE_SUGGESTION], error: null });
});

afterEach(() => {
  jest.useRealTimers();
});

async function typeAndWaitForSuggestions(getByTestId: (id: string) => any, text: string) {
  await act(async () => {
    fireEvent.changeText(getByTestId('destination-input'), text);
  });
  await act(async () => {
    jest.advanceTimersByTime(300);
  });
}

test('renders the locked prompt copy', async () => {
  const { getByText } = await render(<DestinationPickerScreen />);

  expect(getByText('Destination')).toBeTruthy();
  expect(getByText('Where are you headed?')).toBeTruthy();
});

test('"Start the Voyage" is disabled while nothing has been searched', async () => {
  const { getByTestId } = await render(<DestinationPickerScreen />);

  expect(getByTestId('start-the-voyage-button').props.accessibilityState?.disabled).toBe(true);
});

test('does not search until at least 3 characters are typed', async () => {
  const { getByTestId } = await render(<DestinationPickerScreen />);

  await typeAndWaitForSuggestions(getByTestId, 'La');

  expect(mockSearchDestinations).not.toHaveBeenCalled();
});

test('searches after a debounce once 3+ characters are typed, and shows the results', async () => {
  const { getByTestId, getByText } = await render(<DestinationPickerScreen />);

  await typeAndWaitForSuggestions(getByTestId, 'Lake');

  expect(mockSearchDestinations).toHaveBeenCalledWith('Lake');
  expect(getByText(TAHOE_SUGGESTION.placeName)).toBeTruthy();
});

test('"Start the Voyage" stays disabled while only free text has been typed, with no place picked', async () => {
  const { getByTestId } = await render(<DestinationPickerScreen />);

  await typeAndWaitForSuggestions(getByTestId, 'Lake Tahoe');

  expect(getByTestId('start-the-voyage-button').props.accessibilityState?.disabled).toBe(true);
});

test('picking a suggestion fills the input, hides the dropdown, and enables Start the Voyage', async () => {
  const { getByTestId, queryByTestId } = await render(<DestinationPickerScreen />);

  await typeAndWaitForSuggestions(getByTestId, 'Lake');
  await act(async () => {
    fireEvent.press(getByTestId('destination-suggestion-place.1'));
  });

  expect(getByTestId('destination-input').props.value).toBe(TAHOE_SUGGESTION.placeName);
  expect(queryByTestId('destination-suggestions')).toBeNull();
  expect(getByTestId('start-the-voyage-button').props.accessibilityState?.disabled).toBe(false);
});

test('editing the text after picking a suggestion clears the pick and disables Start the Voyage again', async () => {
  const { getByTestId } = await render(<DestinationPickerScreen />);

  await typeAndWaitForSuggestions(getByTestId, 'Lake');
  await act(async () => {
    fireEvent.press(getByTestId('destination-suggestion-place.1'));
  });
  await act(async () => {
    fireEvent.changeText(getByTestId('destination-input'), `${TAHOE_SUGGESTION.placeName} x`);
  });

  expect(getByTestId('start-the-voyage-button').props.accessibilityState?.disabled).toBe(true);
});

test('tapping "Start the Voyage" calls voyageRepository.startVoyage with the picked place name and coordinates', async () => {
  mockStartVoyage.mockResolvedValue({ data: { id: 'voyage-1' }, error: null });

  const { getByTestId } = await render(<DestinationPickerScreen />);

  await typeAndWaitForSuggestions(getByTestId, 'Lake');
  await act(async () => {
    fireEvent.press(getByTestId('destination-suggestion-place.1'));
  });
  await act(async () => {
    fireEvent.press(getByTestId('start-the-voyage-button'));
  });

  expect(mockStartVoyage).toHaveBeenCalledWith(TAHOE_SUGGESTION.placeName, { lat: TAHOE_SUGGESTION.lat, lng: TAHOE_SUGGESTION.lng });
});

test('navigates to the Join-code screen with the created Voyage\'s destination and code on success', async () => {
  mockStartVoyage.mockResolvedValue({
    data: { id: 'voyage-1', destination: TAHOE_SUGGESTION.placeName, joinCode: 'ABCD2345' },
    error: null,
  });

  const { getByTestId } = await render(<DestinationPickerScreen />);

  await typeAndWaitForSuggestions(getByTestId, 'Lake');
  await act(async () => {
    fireEvent.press(getByTestId('destination-suggestion-place.1'));
  });
  await act(async () => {
    fireEvent.press(getByTestId('start-the-voyage-button'));
  });

  expect(mockPush).toHaveBeenCalledWith({
    pathname: '/join-code',
    params: { destination: TAHOE_SUGGESTION.placeName, joinCode: 'ABCD2345' },
  });
});

test('refetches activeVoyage on success, before navigating -- otherwise the new active-voyage routing never engages this session', async () => {
  mockStartVoyage.mockResolvedValue({
    data: { id: 'voyage-1', destination: TAHOE_SUGGESTION.placeName, joinCode: 'ABCD2345' },
    error: null,
  });

  const { getByTestId } = await render(<DestinationPickerScreen />);

  await typeAndWaitForSuggestions(getByTestId, 'Lake');
  await act(async () => {
    fireEvent.press(getByTestId('destination-suggestion-place.1'));
  });
  await act(async () => {
    fireEvent.press(getByTestId('start-the-voyage-button'));
  });

  expect(mockRefetch).toHaveBeenCalledTimes(1);
});

test('shows the AD-9 rejection message inline and re-enables the button', async () => {
  mockStartVoyage.mockResolvedValue({ data: null, error: { code: 'P0001', message: 'You already have an active Voyage.' } });

  const { getByTestId, queryByTestId } = await render(<DestinationPickerScreen />);

  await typeAndWaitForSuggestions(getByTestId, 'Lake');
  await act(async () => {
    fireEvent.press(getByTestId('destination-suggestion-place.1'));
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

  await typeAndWaitForSuggestions(getByTestId, 'Lake');
  await act(async () => {
    fireEvent.press(getByTestId('destination-suggestion-place.1'));
  });
  await act(async () => {
    fireEvent.press(getByTestId('start-the-voyage-button'));
  });

  expect(queryByTestId('error-message')).toBeTruthy();
  expect(getByTestId('start-the-voyage-button').props.accessibilityState?.disabled).toBe(false);
});

test('a stale, slow search response for an earlier keystroke does not clobber the latest query\'s results', async () => {
  let resolveFirst: (value: any) => void = () => {};
  mockSearchDestinations.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        resolveFirst = resolve;
      }),
  );

  const { getByTestId, queryByTestId } = await render(<DestinationPickerScreen />);

  await typeAndWaitForSuggestions(getByTestId, 'Lak');

  mockSearchDestinations.mockResolvedValueOnce({ data: [], error: null });
  await typeAndWaitForSuggestions(getByTestId, 'Lake Zzz No Match');

  await act(async () => {
    resolveFirst({ data: [TAHOE_SUGGESTION], error: null });
    await waitFor(() => {});
  });

  expect(queryByTestId('destination-suggestion-place.1')).toBeNull();
});

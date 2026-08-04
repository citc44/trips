import { beforeEach, expect, jest, test } from '@jest/globals';
import { act, fireEvent, render } from '@testing-library/react-native';

import JoinCodeScreen from '@/app/join-code';

const mockSetStringAsync = jest.fn<(...args: any[]) => Promise<any>>();
jest.mock('expo-clipboard', () => ({
  setStringAsync: (...args: unknown[]) => mockSetStringAsync(...args),
}));

const mockShare = jest.fn<(...args: any[]) => Promise<any>>();
jest.mock('react-native/Libraries/Share/Share', () => ({
  default: { share: (...args: unknown[]) => mockShare(...args) },
}));

const mockPush = jest.fn();
const mockUseLocalSearchParams = jest.fn();
jest.mock('expo-router', () => {
  const actual = jest.requireActual('expo-router') as object;
  return {
    ...actual,
    router: { push: (...args: unknown[]) => mockPush(...args) },
    useLocalSearchParams: () => mockUseLocalSearchParams(),
  };
});

jest.mock('expo-linking', () => ({
  createURL: (path: string) => `voylo://${path.replace(/^\//, '')}`,
}));

const mockClearJustStartedVoyage = jest.fn();
jest.mock('@/shared/hooks/use-just-started-voyage', () => ({
  useJustStartedVoyage: () => ({ hasJustStartedVoyage: true, markVoyageStarted: jest.fn(), clearJustStartedVoyage: mockClearJustStartedVoyage }),
}));

const mockTriggerEntryTransition = jest.fn();
jest.mock('@/shared/hooks/use-pending-entry-transition', () => ({
  usePendingEntryTransition: () => ({ hasPendingEntryTransition: false, triggerEntryTransition: mockTriggerEntryTransition, consumeEntryTransition: jest.fn() }),
}));

beforeEach(() => {
  jest.clearAllMocks();
  mockUseLocalSearchParams.mockReturnValue({ destination: 'Lake Tahoe', joinCode: 'ABCD2345' });
});

test('renders the join code and destination', async () => {
  const { getByText, getByTestId } = await render(<JoinCodeScreen />);

  expect(getByTestId('join-code-text').props.children).toBe('ABCD2345');
  expect(getByText(/Lake Tahoe/)).toBeTruthy();
});

test('tapping the code copies it to the clipboard', async () => {
  mockSetStringAsync.mockResolvedValue(true);

  const { getByTestId } = await render(<JoinCodeScreen />);

  await act(async () => {
    fireEvent.press(getByTestId('join-code-text'));
  });

  expect(mockSetStringAsync).toHaveBeenCalledWith('ABCD2345');
});

test('tapping share opens the OS share sheet with a message containing the link', async () => {
  mockShare.mockResolvedValue({ action: 'sharedAction' });

  const { getByTestId } = await render(<JoinCodeScreen />);

  await act(async () => {
    fireEvent.press(getByTestId('share-button'));
  });

  expect(mockShare).toHaveBeenCalledTimes(1);
  const shareArg = mockShare.mock.calls[0][0] as { message: string };
  expect(shareArg.message).toContain('ABCD2345');
  expect(shareArg.message).toContain('Lake Tahoe');
});

test('tapping Continue clears the just-started-Voyage flag (Story 4.3) -- that flag change is what lets _layout.tsx\'s Stack.Protected guard evict this screen onto Live Map, not an explicit navigation call', async () => {
  const { getByTestId } = await render(<JoinCodeScreen />);

  await act(async () => {
    fireEvent.press(getByTestId('join-code-continue-button'));
  });

  expect(mockClearJustStartedVoyage).toHaveBeenCalledTimes(1);
  expect(mockPush).not.toHaveBeenCalled();
  // Story 4.3: triggers active-voyage.tsx's "cut to gameplay" transition on
  // its next mount.
  expect(mockTriggerEntryTransition).toHaveBeenCalledTimes(1);
});

test('leaving the screen any other way (unmounting without tapping Continue) still clears the just-started-Voyage flag (code review finding: previously only Continue cleared it, leaving the guard stuck admitting this screen)', async () => {
  const { unmount } = await render(<JoinCodeScreen />);

  expect(mockClearJustStartedVoyage).not.toHaveBeenCalled();

  await act(async () => {
    unmount();
  });

  expect(mockClearJustStartedVoyage).toHaveBeenCalledTimes(1);
});

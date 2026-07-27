import { beforeEach, expect, jest, test } from '@jest/globals';
import { act, fireEvent, render } from '@testing-library/react-native';

import { useProfile } from '@/shared/hooks/use-profile';

import DisplayNameScreen from '../display-name';

jest.mock('@/shared/hooks/use-profile', () => ({
  useProfile: jest.fn(),
}));

const mockUseProfile = useProfile as jest.MockedFunction<typeof useProfile>;
const mockSetDisplayName = jest.fn<(...args: any[]) => Promise<any>>();

beforeEach(() => {
  jest.clearAllMocks();
  mockUseProfile.mockReturnValue({
    profile: null,
    isLoading: false,
    hasError: false,
    markTrustMomentSeen: jest.fn<(...args: any[]) => Promise<any>>(),
    markDriverConsentSeen: jest.fn<(...args: any[]) => Promise<any>>(),
    setDisplayName: mockSetDisplayName,
  });
});

test('renders the prompt copy', async () => {
  const { getByText } = await render(<DisplayNameScreen />);

  expect(getByText('What should we call you?')).toBeTruthy();
});

test('submit is disabled while the field is empty', async () => {
  const { getByTestId } = await render(<DisplayNameScreen />);

  expect(getByTestId('display-name-submit-button').props.accessibilityState?.disabled).toBe(true);
});

test('submit becomes enabled once a name is entered', async () => {
  const { getByTestId } = await render(<DisplayNameScreen />);

  await act(async () => {
    fireEvent.changeText(getByTestId('display-name-input'), 'Chintan');
  });

  expect(getByTestId('display-name-submit-button').props.accessibilityState?.disabled).toBe(false);
});

test('stays disabled for whitespace-only input', async () => {
  const { getByTestId } = await render(<DisplayNameScreen />);

  await act(async () => {
    fireEvent.changeText(getByTestId('display-name-input'), '   ');
  });

  expect(getByTestId('display-name-submit-button').props.accessibilityState?.disabled).toBe(true);
});

test('tapping submit calls setDisplayName with the trimmed name', async () => {
  mockSetDisplayName.mockResolvedValue({ error: null });

  const { getByTestId } = await render(<DisplayNameScreen />);

  await act(async () => {
    fireEvent.changeText(getByTestId('display-name-input'), '  Chintan  ');
  });
  await act(async () => {
    fireEvent.press(getByTestId('display-name-submit-button'));
  });

  expect(mockSetDisplayName).toHaveBeenCalledWith('Chintan');
});

test('shows the error inline and re-enables submit on failure', async () => {
  mockSetDisplayName.mockResolvedValue({ error: { code: '22023', message: 'Display name must be 60 characters or fewer.' } });

  const { getByTestId, queryByTestId } = await render(<DisplayNameScreen />);

  await act(async () => {
    fireEvent.changeText(getByTestId('display-name-input'), 'Chintan');
  });
  await act(async () => {
    fireEvent.press(getByTestId('display-name-submit-button'));
  });

  expect(queryByTestId('error-message')).toBeTruthy();
  expect(getByTestId('error-message').props.children).toBe('Display name must be 60 characters or fewer.');
  expect(getByTestId('display-name-submit-button').props.accessibilityState?.disabled).toBe(false);
});

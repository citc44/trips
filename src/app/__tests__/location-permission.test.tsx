import { beforeEach, expect, jest, test } from '@jest/globals';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { Linking } from 'react-native';

import { useLocationPermission } from '@/shared/hooks/use-location-permission';

import LocationPermissionScreen from '../location-permission';

const mockRequestForegroundPermissionsAsync = jest.fn<(...args: any[]) => Promise<any>>();
const mockRequestBackgroundPermissionsAsync = jest.fn<(...args: any[]) => Promise<any>>();
jest.mock('expo-location', () => ({
  PermissionStatus: { GRANTED: 'granted', DENIED: 'denied', UNDETERMINED: 'undetermined' },
  getForegroundPermissionsAsync: jest.fn(),
  requestForegroundPermissionsAsync: (...args: unknown[]) => mockRequestForegroundPermissionsAsync(...args),
  getBackgroundPermissionsAsync: jest.fn(),
  requestBackgroundPermissionsAsync: (...args: unknown[]) => mockRequestBackgroundPermissionsAsync(...args),
}));

jest.mock('@/shared/hooks/use-location-permission', () => ({
  useLocationPermission: jest.fn(),
}));

const mockUseLocationPermission = useLocationPermission as jest.MockedFunction<typeof useLocationPermission>;
const mockMarkPrimingComplete = jest.fn();
const mockRefetch = jest.fn<() => Promise<void>>();

jest.spyOn(Linking, 'openSettings').mockImplementation(() => Promise.resolve());

beforeEach(() => {
  jest.clearAllMocks();
  mockUseLocationPermission.mockReturnValue({
    status: 'undetermined',
    isLoading: false,
    hasError: false,
    refetch: mockRefetch,
    hasCompletedPriming: false,
    markPrimingComplete: mockMarkPrimingComplete,
  });
});

test('shows the priming copy and an Allow Location control', async () => {
  const { getByTestId, getByText } = await render(<LocationPermissionScreen />);

  expect(getByText(/Voylo needs your location/)).toBeTruthy();
  expect(getByTestId('location-permission-allow-button')).toBeTruthy();
});

test('granting both foreground and background permission completes priming with no explainer', async () => {
  mockRequestForegroundPermissionsAsync.mockResolvedValue({ status: 'granted', granted: true, canAskAgain: true });
  mockRequestBackgroundPermissionsAsync.mockResolvedValue({ status: 'granted', granted: true, canAskAgain: true });

  const { getByTestId, queryByTestId } = await render(<LocationPermissionScreen />);

  await act(async () => {
    fireEvent.press(getByTestId('location-permission-allow-button'));
  });

  expect(mockRequestForegroundPermissionsAsync).toHaveBeenCalledTimes(1);
  expect(mockRequestBackgroundPermissionsAsync).toHaveBeenCalledTimes(1);
  await waitFor(() => expect(mockRefetch).toHaveBeenCalled());
  expect(mockMarkPrimingComplete).toHaveBeenCalledTimes(1);
  expect(queryByTestId('location-permission-open-settings-button')).toBeNull();
});

test('denying foreground permission shows the explainer without ever requesting background', async () => {
  mockRequestForegroundPermissionsAsync.mockResolvedValue({ status: 'denied', granted: false, canAskAgain: false });

  const { getByTestId } = await render(<LocationPermissionScreen />);

  await act(async () => {
    fireEvent.press(getByTestId('location-permission-allow-button'));
  });

  expect(mockRequestBackgroundPermissionsAsync).not.toHaveBeenCalled();
  await waitFor(() => expect(getByTestId('location-permission-open-settings-button')).toBeTruthy());
  expect(getByTestId('location-permission-continue-anyway-button')).toBeTruthy();
  expect(mockMarkPrimingComplete).not.toHaveBeenCalled();
});

test('granting foreground but not background (e.g. "While Using") shows the explainer', async () => {
  mockRequestForegroundPermissionsAsync.mockResolvedValue({ status: 'granted', granted: true, canAskAgain: true });
  mockRequestBackgroundPermissionsAsync.mockResolvedValue({ status: 'denied', granted: false, canAskAgain: true });

  const { getByTestId } = await render(<LocationPermissionScreen />);

  await act(async () => {
    fireEvent.press(getByTestId('location-permission-allow-button'));
  });

  await waitFor(() => expect(getByTestId('location-permission-open-settings-button')).toBeTruthy());
  expect(mockMarkPrimingComplete).not.toHaveBeenCalled();
});

test('tapping Open Settings on the explainer opens OS settings and completes priming', async () => {
  mockRequestForegroundPermissionsAsync.mockResolvedValue({ status: 'denied', granted: false, canAskAgain: false });

  const { getByTestId } = await render(<LocationPermissionScreen />);

  await act(async () => {
    fireEvent.press(getByTestId('location-permission-allow-button'));
  });
  await waitFor(() => expect(getByTestId('location-permission-open-settings-button')).toBeTruthy());

  await act(async () => {
    fireEvent.press(getByTestId('location-permission-open-settings-button'));
  });

  expect(Linking.openSettings).toHaveBeenCalledTimes(1);
  expect(mockMarkPrimingComplete).toHaveBeenCalledTimes(1);
});

test('tapping Continue anyway on the explainer completes priming without opening settings (not a lockout)', async () => {
  mockRequestForegroundPermissionsAsync.mockResolvedValue({ status: 'denied', granted: false, canAskAgain: false });

  const { getByTestId } = await render(<LocationPermissionScreen />);

  await act(async () => {
    fireEvent.press(getByTestId('location-permission-allow-button'));
  });
  await waitFor(() => expect(getByTestId('location-permission-continue-anyway-button')).toBeTruthy());

  await act(async () => {
    fireEvent.press(getByTestId('location-permission-continue-anyway-button'));
  });

  expect(Linking.openSettings).not.toHaveBeenCalled();
  expect(mockMarkPrimingComplete).toHaveBeenCalledTimes(1);
});

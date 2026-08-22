import { act, render, waitFor, fireEvent } from '@testing-library/react-native';
import { expect, jest, test, beforeEach } from '@jest/globals';
import { AccessibilityInfo } from 'react-native';

import JourneyScreen from '@/app/journey/[voyageId]';

const mockReplace = jest.fn();
const mockBack = jest.fn();
jest.mock('expo-router', () => ({
  router: {
    replace: (...args: unknown[]) => mockReplace(...args),
    back: (...args: unknown[]) => mockBack(...args),
  },
  useLocalSearchParams: () => ({ voyageId: 'voyage-1' }),
}));

const mockGetVoyage = jest.fn<(...args: any[]) => Promise<any>>();
const mockGetVoyageMembers = jest.fn<(...args: any[]) => Promise<any>>();
const mockGetEventHistory = jest.fn<(...args: any[]) => Promise<any>>();

const mockCaptureRef = jest.fn<(...args: any[]) => Promise<any>>();
jest.mock('react-native-view-shot', () => ({
  captureRef: (...args: unknown[]) => mockCaptureRef(...args),
}));

const mockIsAvailableAsync = jest.fn<(...args: any[]) => Promise<any>>();
const mockShareAsync = jest.fn<(...args: any[]) => Promise<any>>();
jest.mock('expo-sharing', () => ({
  isAvailableAsync: (...args: unknown[]) => mockIsAvailableAsync(...args),
  shareAsync: (...args: unknown[]) => mockShareAsync(...args),
}));

jest.mock('@/repositories/voyage-repository', () => ({
  voyageRepository: {
    getVoyage: (...args: unknown[]) => mockGetVoyage(...args),
    getVoyageMembers: (...args: unknown[]) => mockGetVoyageMembers(...args),
  },
}));

jest.mock('@/repositories/journey-event-repository', () => ({
  journeyEventRepository: {
    getEventHistory: (...args: unknown[]) => mockGetEventHistory(...args),
  },
}));

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(false);
});

function setupHappyPath() {
  mockGetVoyage.mockResolvedValue({
    data: {
      id: 'voyage-1',
      destination: 'Big Sur',
      destinationLat: null,
      destinationLng: null,
      status: 'ended',
      createdBy: 'user-1',
      createdAt: '2026-08-11T10:00:00.000Z',
      endedAt: '2026-08-11T16:42:00.000Z',
      joinCode: null,
    },
    error: null,
  });
  mockGetVoyageMembers.mockResolvedValue({
    data: [
      { userId: 'user-1', displayName: 'Chintan', role: 'organizer', joinedAt: '2026-08-11T10:00:00.000Z', playerColor: 'teal', travelRole: null },
      { userId: 'user-2', displayName: 'Sam', role: 'voyager', joinedAt: '2026-08-11T10:42:00.000Z', playerColor: 'coral', travelRole: null },
    ],
    error: null,
  });
  mockGetEventHistory.mockResolvedValue({
    data: [{ id: 'e1', voyageId: 'voyage-1', actorUserId: 'user-1', eventType: 'police', occurredAt: '2026-08-11T11:00:00.000Z', metadata: {}, status: 'confirmed', source: 'manual', createdAt: '2026-08-11T11:00:00.000Z' }],
    error: null,
  });
}

test(
  'renders the destination, crew, and stat summary once data resolves',
  async () => {
    setupHappyPath();
    // Big Sur/6h 42m/1 also appear in the off-screen share-card capture
    // target (Task 7) -- getByTestId scopes to the visible screen content.
    const { getByTestId } = await render(<JourneyScreen />);

    await waitFor(() => expect(getByTestId('journey-destination')).toHaveTextContent('Big Sur'));
    expect(getByTestId('journey-duration')).toHaveTextContent('6h 42m');
    expect(getByTestId('journey-stop-count')).toHaveTextContent('1');
  },
  15000,
);

test('surfaces the error state instead of a blank screen', async () => {
  mockGetVoyage.mockResolvedValue({ data: null, error: { code: 'unknown', message: 'Network request failed' } });
  mockGetVoyageMembers.mockResolvedValue({ data: [], error: null });
  mockGetEventHistory.mockResolvedValue({ data: [], error: null });

  const { getByTestId } = await render(<JourneyScreen />);

  await waitFor(() => expect(getByTestId('journey-screen-error')).toBeTruthy());
});

test('tapping the replay control navigates to the Memory Lane deck for the same voyageId (replace, not push, to avoid stacking)', async () => {
  setupHappyPath();
  const { getByTestId } = await render(<JourneyScreen />);
  await waitFor(() => expect(getByTestId('journey-replay-button')).toBeTruthy());

  await act(async () => {
    fireEvent.press(getByTestId('journey-replay-button'));
  });

  expect(mockReplace).toHaveBeenCalledWith({ pathname: '/memory-lane/[voyageId]', params: { voyageId: 'voyage-1' } });
});

test('back button pops the nav stack', async () => {
  setupHappyPath();
  const { getByTestId } = await render(<JourneyScreen />);
  await waitFor(() => expect(getByTestId('journey-back-button')).toBeTruthy());

  await act(async () => {
    fireEvent.press(getByTestId('journey-back-button'));
  });

  expect(mockBack).toHaveBeenCalled();
});

test('tapping Share the card captures the card view and opens the OS share sheet', async () => {
  setupHappyPath();
  mockIsAvailableAsync.mockResolvedValue(true);
  mockCaptureRef.mockResolvedValue('file:///tmp/share-card.png');
  mockShareAsync.mockResolvedValue(undefined);

  const { getByTestId } = await render(<JourneyScreen />);
  await waitFor(() => expect(getByTestId('journey-share-card-button')).toBeTruthy());

  await act(async () => {
    fireEvent.press(getByTestId('journey-share-card-button'));
  });

  await waitFor(() => expect(mockShareAsync).toHaveBeenCalledWith('file:///tmp/share-card.png', expect.any(Object)));
  expect(mockCaptureRef).toHaveBeenCalled();
});

test('a rapid double-tap on Share the card only captures/shares once (re-entrancy guard)', async () => {
  setupHappyPath();
  mockIsAvailableAsync.mockResolvedValue(true);
  mockShareAsync.mockResolvedValue(undefined);
  // A manually-controlled, still-pending promise -- keeps the first tap's
  // captureRef() in flight across both act() calls below, so the second tap
  // genuinely exercises the guard while it's engaged (not after it's already
  // reset). Same pattern as active-voyage.test.tsx's own proven
  // double-tap-guard test ("a rapid double-tap on a spotting control...").
  let resolveCapture: (uri: string) => void;
  mockCaptureRef.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        resolveCapture = resolve;
      }),
  );

  const { getByTestId } = await render(<JourneyScreen />);
  await waitFor(() => expect(getByTestId('journey-share-card-button')).toBeTruthy());

  await act(async () => {
    fireEvent.press(getByTestId('journey-share-card-button'));
  });
  expect(getByTestId('journey-share-card-button').props.accessibilityState?.disabled).toBe(true);

  await act(async () => {
    fireEvent.press(getByTestId('journey-share-card-button'));
  });

  await act(async () => {
    resolveCapture!('file:///tmp/share-card.png');
  });
  await waitFor(() => expect(mockShareAsync).toHaveBeenCalled());

  expect(mockCaptureRef).toHaveBeenCalledTimes(1);
});

test('shows a distinct inline error when the card was captured fine but only the OS share step failed', async () => {
  setupHappyPath();
  mockIsAvailableAsync.mockResolvedValue(true);
  mockCaptureRef.mockResolvedValue('file:///tmp/share-card.png');
  mockShareAsync.mockRejectedValueOnce(new Error('share sheet dismissed')).mockResolvedValueOnce(undefined);

  const { getByTestId, getByText } = await render(<JourneyScreen />);
  await waitFor(() => expect(getByTestId('journey-share-card-button')).toBeTruthy());

  await act(async () => {
    fireEvent.press(getByTestId('journey-share-card-button'));
  });
  await waitFor(() => expect(getByText(/couldn.t share your card/i)).toBeTruthy());

  await act(async () => {
    fireEvent.press(getByTestId('journey-share-card-button'));
  });
  await waitFor(() => expect(mockShareAsync).toHaveBeenCalledTimes(2));
});

test('shows an inline error (not a silent failure) when capture fails, with a working retry', async () => {
  setupHappyPath();
  mockIsAvailableAsync.mockResolvedValue(true);
  mockCaptureRef.mockRejectedValueOnce(new Error('capture failed')).mockResolvedValueOnce('file:///tmp/share-card.png');
  mockShareAsync.mockResolvedValue(undefined);

  const { getByTestId, getByText } = await render(<JourneyScreen />);
  await waitFor(() => expect(getByTestId('journey-share-card-button')).toBeTruthy());

  await act(async () => {
    fireEvent.press(getByTestId('journey-share-card-button'));
  });
  await waitFor(() => expect(getByText(/couldn.t make your card/i)).toBeTruthy());

  await act(async () => {
    fireEvent.press(getByTestId('journey-share-card-button'));
  });
  await waitFor(() => expect(mockShareAsync).toHaveBeenCalled());
});

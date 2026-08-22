import { act, render, waitFor, fireEvent } from '@testing-library/react-native';
import { expect, jest, test, beforeEach } from '@jest/globals';
import { AccessibilityInfo } from 'react-native';

import MemoryLaneDeckScreen from '@/app/memory-lane/[voyageId]';

const mockReplace = jest.fn();
jest.mock('expo-router', () => ({
  router: { replace: (...args: unknown[]) => mockReplace(...args), back: jest.fn() },
  useLocalSearchParams: () => ({ voyageId: 'voyage-1' }),
}));

const mockGetVoyage = jest.fn<(...args: any[]) => Promise<any>>();
const mockGetVoyageMembers = jest.fn<(...args: any[]) => Promise<any>>();
const mockGetEventHistory = jest.fn<(...args: any[]) => Promise<any>>();

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

const endedVoyage = {
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
};

const members = {
  data: [
    { userId: 'user-1', displayName: 'Chintan', role: 'organizer', joinedAt: '2026-08-11T10:00:00.000Z', playerColor: 'teal', travelRole: null },
    { userId: 'user-2', displayName: 'Sam', role: 'voyager', joinedAt: '2026-08-11T10:42:00.000Z', playerColor: 'coral', travelRole: null },
  ],
  error: null,
};

function setupHappyPath() {
  mockGetVoyage.mockResolvedValue(endedVoyage);
  mockGetVoyageMembers.mockResolvedValue(members);
  mockGetEventHistory.mockResolvedValue({ data: [], error: null });
}

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(false);
});

test(
  'shows a loading state, then the trigger card once data resolves',
  async () => {
    setupHappyPath();
    const { getByTestId } = await render(<MemoryLaneDeckScreen />);

    await waitFor(() => expect(getByTestId('memory-lane-start-button')).toBeTruthy());
  },
  15000, // First test in the file pays for module/font init cold-start -- same slow-first-test pattern already tolerated elsewhere in this codebase's test suite.
);

test('surfaces the composer error state instead of a blank/broken screen', async () => {
  mockGetVoyage.mockResolvedValue({ data: null, error: { code: 'unknown', message: 'Network request failed' } });
  mockGetVoyageMembers.mockResolvedValue({ data: [], error: null });
  mockGetEventHistory.mockResolvedValue({ data: [], error: null });

  const { getByTestId } = await render(<MemoryLaneDeckScreen />);

  await waitFor(() => expect(getByTestId('memory-lane-error')).toBeTruthy());
});

test('tapping the trigger CTA advances into the destination card', async () => {
  setupHappyPath();
  const { getByTestId, getByText } = await render(<MemoryLaneDeckScreen />);
  await waitFor(() => expect(getByTestId('memory-lane-start-button')).toBeTruthy());

  await act(async () => {
    fireEvent.press(getByTestId('memory-lane-start-button'));
  });

  expect(getByText('Big Sur')).toBeTruthy();
});

test('the non-gestural edge-tap zones advance and retreat through the deck (WCAG 2.5.1)', async () => {
  setupHappyPath();
  const { getByTestId, getByText } = await render(<MemoryLaneDeckScreen />);
  await waitFor(() => expect(getByTestId('memory-lane-start-button')).toBeTruthy());

  await act(async () => {
    fireEvent.press(getByTestId('memory-lane-start-button'));
  });
  expect(getByText('Big Sur')).toBeTruthy(); // card 1: destination

  await act(async () => {
    fireEvent.press(getByTestId('memory-lane-edge-next'));
  });
  // card 2: who-joined -- Sam is the late joiner in this fixture
  expect(getByText(/Sam showed up fashionably late/)).toBeTruthy();

  await act(async () => {
    fireEvent.press(getByTestId('memory-lane-edge-prev'));
  });
  expect(getByText('Big Sur')).toBeTruthy();
});

test('reaching the closing beat and tapping Close navigates to the Persistent Journey Screen', async () => {
  setupHappyPath();
  const { getByTestId } = await render(<MemoryLaneDeckScreen />);
  await waitFor(() => expect(getByTestId('memory-lane-start-button')).toBeTruthy());

  await act(async () => {
    fireEvent.press(getByTestId('memory-lane-start-button')); // -> card 1
  });
  for (let i = 0; i < 5; i += 1) {
    // eslint-disable-next-line no-await-in-loop
    await act(async () => {
      fireEvent.press(getByTestId('memory-lane-edge-next'));
    });
  }

  await waitFor(() => expect(getByTestId('memory-lane-close-button')).toBeTruthy());

  await act(async () => {
    fireEvent.press(getByTestId('memory-lane-close-button'));
  });

  expect(mockReplace).toHaveBeenCalledWith({ pathname: '/journey/[voyageId]', params: { voyageId: 'voyage-1' } });
});

test('announces each card\'s content via AccessibilityInfo on activation', async () => {
  const announceSpy = jest.spyOn(AccessibilityInfo, 'announceForAccessibility');
  setupHappyPath();
  const { getByTestId } = await render(<MemoryLaneDeckScreen />);
  await waitFor(() => expect(getByTestId('memory-lane-start-button')).toBeTruthy());
  await waitFor(() => expect(announceSpy).toHaveBeenCalledWith(expect.stringContaining('Everyone')));

  announceSpy.mockClear();
  await act(async () => {
    fireEvent.press(getByTestId('memory-lane-start-button'));
  });

  expect(announceSpy).toHaveBeenCalledWith(expect.stringContaining('Card 1 of 5'));
});

test('produces a complete deck for a solo (unjoined) Voyage -- no degraded state (AC5)', async () => {
  mockGetVoyage.mockResolvedValue(endedVoyage);
  mockGetVoyageMembers.mockResolvedValue({
    data: [{ userId: 'user-1', displayName: 'Chintan', role: 'organizer', joinedAt: '2026-08-11T10:00:00.000Z', playerColor: 'teal', travelRole: null }],
    error: null,
  });
  mockGetEventHistory.mockResolvedValue({ data: [], error: null });

  const { getByTestId, getByText } = await render(<MemoryLaneDeckScreen />);
  await waitFor(() => expect(getByTestId('memory-lane-start-button')).toBeTruthy());

  await act(async () => {
    fireEvent.press(getByTestId('memory-lane-start-button'));
  });
  await act(async () => {
    fireEvent.press(getByTestId('memory-lane-edge-next'));
  });

  expect(getByText(/Just Chintan and the open road/)).toBeTruthy();
});

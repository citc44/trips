import { beforeEach, expect, jest, test } from '@jest/globals';
import { act, fireEvent, render, waitFor, within } from '@testing-library/react-native';
import { AccessibilityInfo } from 'react-native';
import mockSafeAreaContext from 'react-native-safe-area-context/jest/mock';

import { voyageRepository } from '@/repositories/voyage-repository';
import { useActiveVoyage } from '@/shared/hooks/use-active-voyage';
import { useAuth } from '@/shared/hooks/use-auth';
import { useLiveLocations } from '@/shared/hooks/use-live-locations';
import { usePendingEntryTransition } from '@/shared/hooks/use-pending-entry-transition';
import { formatDistanceMiles, haversineMiles } from '@/shared/lib/geo';
import { outbox } from '@/shared/services/outbox/outbox';

import ActiveVoyageScreen from '../active-voyage';

const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  router: { push: (...args: unknown[]) => mockPush(...args) },
}));

jest.mock('@/lib/mapbox', () => ({ initMapbox: jest.fn() }));

// Official RNSAC mock -- useSafeAreaInsets() (skyStrip's height) throws
// without a real <SafeAreaProvider> ancestor, which this test harness
// doesn't render.
jest.mock('react-native-safe-area-context', () => mockSafeAreaContext);

const mockCameraMoveTo = jest.fn();
const mockCameraFitBounds = jest.fn();
const mockMarkerViewProps = jest.fn<(props: any) => void>();
// require(), not import -- jest.mock() factories may only reference
// out-of-scope bindings that are either "mock"-prefixed or obtained via
// require() inside the factory itself (Jest's own hoisting rule, not an
// oversight); the @typescript-eslint/no-require-imports warning this trips
// is a deliberate, correct exception to that general preference.
jest.mock('@rnmapbox/maps', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const ReactActual = require('react');
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { View } = require('react-native');
  return {
    __esModule: true,
    default: { StyleURL: { Street: 'mapbox://styles/mapbox/streets-v12' } },
    MapView: ({ children, testID }: any) => ReactActual.createElement(View, { testID }, children),
    Camera: ReactActual.forwardRef((_props: any, ref: any) => {
      ReactActual.useImperativeHandle(ref, () => ({
        moveTo: mockCameraMoveTo,
        flyTo: jest.fn(),
        zoomTo: jest.fn(),
        fitBounds: mockCameraFitBounds,
      }));
      return null;
    }),
    MarkerView: (props: any) => {
      mockMarkerViewProps(props);
      return props.children;
    },
    ShapeSource: ({ children }: any) => children ?? null,
    LineLayer: ({ id }: any) => ReactActual.createElement(View, { testID: id }),
  };
});

jest.mock('@/repositories/voyage-repository', () => ({
  voyageRepository: {
    endVoyage: jest.fn(),
    getVoyageMembers: jest.fn(),
    grantOrganizerStatus: jest.fn(),
    removeVoyager: jest.fn(),
    setTravelRole: jest.fn(),
  },
}));

jest.mock('@/shared/hooks/use-active-voyage', () => ({
  useActiveVoyage: jest.fn(),
}));

jest.mock('@/shared/hooks/use-auth', () => ({
  useAuth: jest.fn(),
}));

jest.mock('@/shared/hooks/use-live-locations', () => ({
  useLiveLocations: jest.fn(),
}));

jest.mock('@/shared/hooks/use-location-tracking', () => ({
  useLocationTracking: jest.fn(),
}));

const mockConsumeEntryTransition = jest.fn();
jest.mock('@/shared/hooks/use-pending-entry-transition', () => ({
  usePendingEntryTransition: jest.fn(),
}));

const mockMarkVoyageStarted = jest.fn();
jest.mock('@/shared/hooks/use-just-started-voyage', () => ({
  useJustStartedVoyage: () => ({ hasJustStartedVoyage: false, markVoyageStarted: mockMarkVoyageStarted, clearJustStartedVoyage: jest.fn() }),
}));

jest.mock('@/shared/services/outbox/outbox', () => ({
  outbox: { enqueue: jest.fn(), flush: jest.fn() },
}));

const mockEndVoyage = voyageRepository.endVoyage as jest.MockedFunction<typeof voyageRepository.endVoyage>;
const mockGetVoyageMembers = voyageRepository.getVoyageMembers as jest.MockedFunction<typeof voyageRepository.getVoyageMembers>;
const mockGrantOrganizerStatus = voyageRepository.grantOrganizerStatus as jest.MockedFunction<typeof voyageRepository.grantOrganizerStatus>;
const mockRemoveVoyager = voyageRepository.removeVoyager as jest.MockedFunction<typeof voyageRepository.removeVoyager>;
const mockSetTravelRole = voyageRepository.setTravelRole as jest.MockedFunction<typeof voyageRepository.setTravelRole>;
const mockUseActiveVoyage = useActiveVoyage as jest.MockedFunction<typeof useActiveVoyage>;
const mockUseAuth = useAuth as jest.MockedFunction<typeof useAuth>;
const mockUseLiveLocations = useLiveLocations as jest.MockedFunction<typeof useLiveLocations>;
const mockUsePendingEntryTransition = usePendingEntryTransition as jest.MockedFunction<typeof usePendingEntryTransition>;
const mockOutboxEnqueue = outbox.enqueue as jest.MockedFunction<typeof outbox.enqueue>;
const mockOutboxFlush = outbox.flush as jest.MockedFunction<typeof outbox.flush>;
const mockRefetch = jest.fn<() => Promise<void>>();

const membersFixture = [
  {
    userId: 'user-1',
    displayName: 'Chintan',
    role: 'organizer' as const,
    joinedAt: '2026-07-26T00:00:00Z',
    playerColor: 'coral' as const,
    travelRole: 'riding' as const,
  },
  {
    userId: 'user-2',
    displayName: 'Meera',
    role: 'voyager' as const,
    joinedAt: '2026-07-26T00:05:00Z',
    playerColor: 'teal' as const,
    travelRole: 'riding' as const,
  },
];

const locationsFixture = {
  'user-1': { userId: 'user-1', lat: 39.1, lng: -120.0, heading: 90, updatedAt: '2026-07-26T00:00:00Z' },
  'user-2': { userId: 'user-2', lat: 39.2, lng: -120.1, heading: null, updatedAt: '2026-07-26T00:05:00Z' },
};

function mockActiveVoyage(role: 'organizer' | 'voyager') {
  mockUseActiveVoyage.mockReturnValue({
    activeVoyage: {
      voyage: {
        id: 'voyage-1',
        destination: 'Lake Tahoe',
        destinationLat: null,
        destinationLng: null,
        status: 'active',
        createdBy: 'user-1',
        createdAt: '2026-07-26T00:00:00Z',
        endedAt: null,
        joinCode: 'ABCD2345',
      },
      role,
    },
    isLoading: false,
    hasError: false,
    refetch: mockRefetch,
  });
}

async function openOrganizerMenu(getByTestId: (id: string) => any) {
  await act(async () => {
    fireEvent.press(getByTestId('organizer-menu-button'));
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  mockGetVoyageMembers.mockResolvedValue({ data: membersFixture, error: null });
  mockSetTravelRole.mockResolvedValue({ error: null });
  mockOutboxEnqueue.mockResolvedValue(undefined);
  mockOutboxFlush.mockResolvedValue({ succeeded: [], conflicts: [] });
  mockUseAuth.mockReturnValue({
    session: { user: { id: 'user-1' } } as any,
    isLoading: false,
    signInWithEmail: jest.fn<(...args: any[]) => Promise<any>>(),
    verifyCode: jest.fn<(...args: any[]) => Promise<any>>(),
    signOut: jest.fn<(...args: any[]) => Promise<any>>(),
  });
  mockUseLiveLocations.mockReturnValue({ locations: locationsFixture, trails: {}, isLoading: false, hasError: false, isConnected: true, rosterRevision: 0 });
  // Default: not a fresh "cut to gameplay" arrival -- individual tests below
  // override this to exercise the transition itself.
  mockUsePendingEntryTransition.mockReturnValue({
    hasPendingEntryTransition: false,
    triggerEntryTransition: jest.fn(),
    consumeEntryTransition: mockConsumeEntryTransition,
  });
});

test('shows the map, destination, and status pill', async () => {
  mockActiveVoyage('organizer');

  const { getByText, getByTestId } = await render(<ActiveVoyageScreen />);

  expect(getByTestId('live-map')).toBeTruthy();
  expect(getByText('Lake Tahoe')).toBeTruthy();
  expect(getByTestId('status-pill')).toBeTruthy();
});

test('the top banner (Story 4.3, map-banner) shows the destination eyebrow and a Voyager-count badge instead of the old descriptive subtext', async () => {
  mockActiveVoyage('organizer');

  const { getByText, getByTestId, queryByText } = await render(<ActiveVoyageScreen />);

  expect(getByText('Voyage destination')).toBeTruthy();
  await waitFor(() => expect(getByTestId('voyager-count-badge')).toBeTruthy());
  // Both fixture members have a live location (locationsFixture), so both
  // count as markers -- the badge shows that count, not the roster length.
  expect(within(getByTestId('voyager-count-badge')).getByText('2☺')).toBeTruthy();
  expect(getByTestId('voyager-count-badge').props.accessibilityLabel).toBe('2 Voyagers riding with you');
  expect(queryByText(/riding with you/)).toBeNull();
});

test('the voyager-count badge counts markers.length (live locations), not members.length (roster size) -- code review finding: the two were never distinguished in test coverage', async () => {
  mockActiveVoyage('organizer');
  // Two members on the roster, but only one has a live location -- the
  // badge should read "1", not "2", since it's meant to represent who's
  // actually riding along right now, not everyone who's ever joined.
  mockUseLiveLocations.mockReturnValue({
    locations: { 'user-1': locationsFixture['user-1'] },
    trails: {},
    isLoading: false,
    hasError: false,
    isConnected: true,
    rosterRevision: 0,
  });

  const { getByTestId } = await render(<ActiveVoyageScreen />);

  await waitFor(() => expect(getByTestId('voyager-count-badge')).toBeTruthy());
  expect(within(getByTestId('voyager-count-badge')).getByText('1☺')).toBeTruthy();
  expect(getByTestId('voyager-count-badge').props.accessibilityLabel).toBe('1 Voyager riding with you');
});

test('tapping the voyager-count badge opens the Organizer/member drawer, same as the hamburger button (user-reported bug: it rendered as a plain, non-interactive View)', async () => {
  mockActiveVoyage('organizer');

  const { getByTestId } = await render(<ActiveVoyageScreen />);
  await waitFor(() => expect(getByTestId('voyager-count-badge')).toBeTruthy());

  await act(async () => {
    fireEvent.press(getByTestId('voyager-count-badge'));
  });

  expect(getByTestId('end-voyage-button')).toBeTruthy();
});

test('the bottom HUD (Story 4.3, hud-bar) shows an Elapsed stat instead of the old always-visible per-Voyager roster', async () => {
  mockActiveVoyage('organizer');

  const { getByTestId } = await render(<ActiveVoyageScreen />);

  const hudBottom = within(getByTestId('hud-bottom'));
  expect(hudBottom.getByText('Elapsed')).toBeTruthy();
  // The roster names/roles that used to render unconditionally in
  // hud-bottom are gone (Story 4.3's Scope decision) -- Meera's own marker
  // tag still renders her name elsewhere on the map, but not inside
  // hud-bottom itself anymore.
  expect(hudBottom.queryByText('Meera')).toBeNull();
});

test('the "cut to gameplay" transition (Story 4.3) shows the flash overlay with the destination name when arriving via a pending entry transition', async () => {
  mockActiveVoyage('organizer');
  mockUsePendingEntryTransition.mockReturnValue({
    hasPendingEntryTransition: true,
    triggerEntryTransition: jest.fn(),
    consumeEntryTransition: mockConsumeEntryTransition,
  });

  const { getByTestId } = await render(<ActiveVoyageScreen />);

  await waitFor(() => expect(getByTestId('cut-to-gameplay-flash')).toBeTruthy());
  expect(within(getByTestId('cut-to-gameplay-flash')).getByText('Lake Tahoe')).toBeTruthy();
});

test('the "cut to gameplay" transition consumes the pending flag once, so a later remount does not replay it', async () => {
  mockActiveVoyage('organizer');
  mockUsePendingEntryTransition.mockReturnValue({
    hasPendingEntryTransition: true,
    triggerEntryTransition: jest.fn(),
    consumeEntryTransition: mockConsumeEntryTransition,
  });

  await render(<ActiveVoyageScreen />);

  await waitFor(() => expect(mockConsumeEntryTransition).toHaveBeenCalledTimes(1));
});

test('the "cut to gameplay" transition does not fire on a cold relaunch mid-Voyage (no pending entry transition)', async () => {
  mockActiveVoyage('organizer');
  // Default beforeEach already sets hasPendingEntryTransition: false --
  // explicit here for clarity, matching EXPERIENCE.md's State Patterns
  // "Cold open, authenticated, active Voyage: skips Home entirely -- lands
  // straight on Live Map," with no flash.

  const { queryByTestId } = await render(<ActiveVoyageScreen />);

  await waitFor(() => expect(queryByTestId('live-map')).toBeTruthy());
  expect(queryByTestId('cut-to-gameplay-flash')).toBeNull();
});

test('under Reduce Motion, the "cut to gameplay" transition is skipped entirely -- Live Map simply appears', async () => {
  mockActiveVoyage('organizer');
  mockUsePendingEntryTransition.mockReturnValue({
    hasPendingEntryTransition: true,
    triggerEntryTransition: jest.fn(),
    consumeEntryTransition: mockConsumeEntryTransition,
  });
  jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(true);

  const { queryByTestId, getByTestId } = await render(<ActiveVoyageScreen />);

  await waitFor(() => expect(getByTestId('live-map')).toBeTruthy());
  // reduceMotion resolves asynchronously (AccessibilityInfo.
  // isReduceMotionEnabled()) -- waitFor absorbs that, same pattern this
  // file already uses for other reduceMotion-driven assertions.
  await waitFor(() => expect(queryByTestId('cut-to-gameplay-flash')).toBeNull());
});

test('under Reduce Motion, the "cut to gameplay" transition never renders even for a single frame before AccessibilityInfo resolves (code review finding: reduceMotion defaults to false until then)', async () => {
  mockActiveVoyage('organizer');
  mockUsePendingEntryTransition.mockReturnValue({
    hasPendingEntryTransition: true,
    triggerEntryTransition: jest.fn(),
    consumeEntryTransition: mockConsumeEntryTransition,
  });
  // A manually-controlled promise, not mockResolvedValue -- lets this test
  // inspect the render that happens *before* AccessibilityInfo's real
  // (Reduce-Motion-on) answer has landed, which is exactly the window the
  // old (buggy) implementation got wrong.
  let resolveReduceMotion: (enabled: boolean) => void = () => {};
  jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockReturnValue(
    new Promise((resolve) => {
      resolveReduceMotion = resolve;
    }),
  );

  const { queryByTestId } = await render(<ActiveVoyageScreen />);

  // Still unresolved at this point -- must not have rendered the flash
  // (or the animated, initially-opacity-0 content wrapper) speculatively.
  expect(queryByTestId('cut-to-gameplay-flash')).toBeNull();

  await act(async () => {
    resolveReduceMotion(true);
  });

  // Resolved as Reduce-Motion-on -- still never shown.
  expect(queryByTestId('cut-to-gameplay-flash')).toBeNull();
});

test('does not show the role prompt once the signed-in user already has a resolved travel role', async () => {
  mockActiveVoyage('organizer');

  const { queryByTestId } = await render(<ActiveVoyageScreen />);

  await waitFor(() => expect(queryByTestId('status-pill')).toBeTruthy());
  expect(queryByTestId('role-prompt')).toBeNull();
});

test('shows the role prompt when the signed-in user has not yet resolved a travel role this Voyage', async () => {
  mockActiveVoyage('organizer');
  mockGetVoyageMembers.mockResolvedValue({
    data: [{ ...membersFixture[0], travelRole: null }, membersFixture[1]],
    error: null,
  });

  const { getByTestId } = await render(<ActiveVoyageScreen />);

  await waitFor(() => expect(getByTestId('role-prompt')).toBeTruthy());
  expect(getByTestId('role-prompt-riding-button')).toBeTruthy();
  expect(getByTestId('role-prompt-driving-button')).toBeTruthy();
  // Both must be real, full-size Pressable buttons (IgnitionButton's default
  // `primary` variant, which renders to a host "View"), not the undersized
  // text-link `secondary` variant (a plain `Text` with no minHeight) --
  // code review finding: Riding and Driving are peer choices, not a main
  // action next to a de-emphasized one.
  expect(getByTestId('role-prompt-riding-button').type).toBe('View');
  expect(getByTestId('role-prompt-driving-button').type).toBe('View');
});

test('tapping Riding in the role prompt calls setTravelRole with riding and re-fetches, then dismisses the prompt', async () => {
  mockActiveVoyage('organizer');
  mockGetVoyageMembers.mockResolvedValueOnce({
    data: [{ ...membersFixture[0], travelRole: null }, membersFixture[1]],
    error: null,
  });

  const { getByTestId, queryByTestId } = await render(<ActiveVoyageScreen />);
  await waitFor(() => expect(getByTestId('role-prompt')).toBeTruthy());

  mockGetVoyageMembers.mockResolvedValueOnce({ data: membersFixture, error: null });
  await act(async () => {
    fireEvent.press(getByTestId('role-prompt-riding-button'));
  });

  expect(mockSetTravelRole).toHaveBeenCalledWith('voyage-1', 'riding');
  expect(mockGetVoyageMembers).toHaveBeenCalledTimes(2);
  expect(queryByTestId('role-prompt')).toBeNull();
});

test('tapping Driving in the role prompt calls setTravelRole with driving and re-fetches, then dismisses the prompt', async () => {
  mockActiveVoyage('organizer');
  mockGetVoyageMembers.mockResolvedValueOnce({
    data: [{ ...membersFixture[0], travelRole: null }, membersFixture[1]],
    error: null,
  });

  const { getByTestId, queryByTestId } = await render(<ActiveVoyageScreen />);
  await waitFor(() => expect(getByTestId('role-prompt')).toBeTruthy());

  mockGetVoyageMembers.mockResolvedValueOnce({
    data: [{ ...membersFixture[0], travelRole: 'driving' }, membersFixture[1]],
    error: null,
  });
  await act(async () => {
    fireEvent.press(getByTestId('role-prompt-driving-button'));
  });

  expect(mockSetTravelRole).toHaveBeenCalledWith('voyage-1', 'driving');
  expect(queryByTestId('role-prompt')).toBeNull();
});

test('shows an inline error (not a dead end) when resolving the role prompt fails, and leaves the prompt showing', async () => {
  mockActiveVoyage('organizer');
  mockGetVoyageMembers.mockResolvedValue({
    data: [{ ...membersFixture[0], travelRole: null }, membersFixture[1]],
    error: null,
  });
  mockSetTravelRole.mockResolvedValue({ error: { code: 'ROL01', message: 'You are not an active member of this Voyage.' } });

  const { getByTestId } = await render(<ActiveVoyageScreen />);
  await waitFor(() => expect(getByTestId('role-prompt')).toBeTruthy());

  await act(async () => {
    fireEvent.press(getByTestId('role-prompt-riding-button'));
  });

  expect(getByTestId('role-prompt-error')).toBeTruthy();
  expect(getByTestId('role-prompt')).toBeTruthy();
});

test('status pill shows Riding by default and switches to Driving with no confirmation dialog on tap', async () => {
  mockActiveVoyage('organizer');

  const { getByTestId, queryByTestId } = await render(<ActiveVoyageScreen />);
  await waitFor(() => expect(within(getByTestId('status-pill')).getByText('Riding')).toBeTruthy());

  mockGetVoyageMembers.mockResolvedValueOnce({
    data: [{ ...membersFixture[0], travelRole: 'driving' }, membersFixture[1]],
    error: null,
  });
  await act(async () => {
    fireEvent.press(getByTestId('status-pill'));
  });

  expect(mockSetTravelRole).toHaveBeenCalledWith('voyage-1', 'driving');
  // No confirmation dialog -- AC #2's explicit "no confirmation dialog" requirement.
  expect(queryByTestId('confirm-end-voyage-button')).toBeNull();
  await waitFor(() => expect(within(getByTestId('status-pill')).getByText('Driving')).toBeTruthy());
});

test('status pill shows Driving and switches back to Riding on tap', async () => {
  mockActiveVoyage('organizer');
  mockGetVoyageMembers.mockResolvedValue({
    data: [{ ...membersFixture[0], travelRole: 'driving' }, membersFixture[1]],
    error: null,
  });

  const { getByTestId } = await render(<ActiveVoyageScreen />);
  await waitFor(() => expect(within(getByTestId('status-pill')).getByText('Driving')).toBeTruthy());

  await act(async () => {
    fireEvent.press(getByTestId('status-pill'));
  });

  expect(mockSetTravelRole).toHaveBeenCalledWith('voyage-1', 'riding');
});

test('status pill is disabled while a role switch is already in flight', async () => {
  mockActiveVoyage('organizer');
  let resolveSetTravelRole: (value: any) => void;
  mockSetTravelRole.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        resolveSetTravelRole = resolve;
      }),
  );

  const { getByTestId } = await render(<ActiveVoyageScreen />);
  await waitFor(() => expect(getByTestId('status-pill')).toBeTruthy());

  await act(async () => {
    fireEvent.press(getByTestId('status-pill'));
  });
  expect(getByTestId('status-pill').props.accessibilityState?.disabled).toBe(true);

  await act(async () => {
    resolveSetTravelRole!({ error: null });
  });
  expect(mockSetTravelRole).toHaveBeenCalledTimes(1);
});

test('status pill announces the current travel role to screen readers, not the destination of the next tap', async () => {
  mockActiveVoyage('organizer');

  const { getByTestId } = await render(<ActiveVoyageScreen />);
  await waitFor(() => expect(getByTestId('status-pill').props.accessibilityLabel).toBe('Riding'));
});

test('shows an inline error (not a silent failure) when a pill-triggered role switch fails after the role is already resolved', async () => {
  mockActiveVoyage('organizer');
  mockSetTravelRole.mockResolvedValue({ error: { code: 'ROL01', message: 'You are not an active member of this Voyage.' } });

  const { getByTestId, queryByTestId } = await render(<ActiveVoyageScreen />);
  await waitFor(() => expect(getByTestId('status-pill')).toBeTruthy());
  // No prompt is showing (the fixture's own travel role is already resolved) -- this is the
  // path the prompt's own inline error doesn't cover.
  expect(queryByTestId('role-prompt')).toBeNull();

  await act(async () => {
    fireEvent.press(getByTestId('status-pill'));
  });

  expect(getByTestId('status-pill-error')).toBeTruthy();
  expect(getByTestId('status-pill-error').props.children).toBe('You are not an active member of this Voyage.');
});

test('renders a marker for each Voyager with a live location', async () => {
  mockActiveVoyage('organizer');

  const { getByTestId } = await render(<ActiveVoyageScreen />);

  await waitFor(() => expect(getByTestId('voyager-marker-user-1')).toBeTruthy());
  expect(getByTestId('voyager-marker-user-2')).toBeTruthy();
});

test('keeps nearby MarkerViews visible instead of letting Mapbox collapse overlapping Voyagers', async () => {
  mockActiveVoyage('organizer');

  await render(<ActiveVoyageScreen />);

  await waitFor(() => expect(mockMarkerViewProps).toHaveBeenCalled());
  expect(mockMarkerViewProps.mock.calls.every(([props]) => props.allowOverlap === true && props.allowOverlapWithPuck === true)).toBe(true);
});

test('refreshes the roster and renders a newly joined Voyager when their first location arrives', async () => {
  mockActiveVoyage('organizer');
  const joinedMember = {
    userId: 'user-3',
    displayName: 'Sam',
    role: 'voyager' as const,
    joinedAt: '2026-07-26T00:10:00Z',
    playerColor: 'violet' as const,
    travelRole: 'riding' as const,
  };
  const joinedLocation = {
    userId: 'user-3',
    lat: 39.3,
    lng: -120.2,
    heading: 45,
    updatedAt: '2026-07-26T00:10:00Z',
  };

  const { getByTestId, queryByTestId, rerender } = await render(<ActiveVoyageScreen />);
  await waitFor(() => expect(getByTestId('voyager-marker-user-2')).toBeTruthy());
  expect(queryByTestId('voyager-marker-user-3')).toBeNull();

  mockGetVoyageMembers.mockResolvedValueOnce({ data: [...membersFixture, joinedMember], error: null });
  mockUseLiveLocations.mockReturnValue({
    locations: { ...locationsFixture, 'user-3': joinedLocation },
    trails: {},
    isLoading: false,
    hasError: false,
    isConnected: true,
    rosterRevision: 0,
  });
  await act(async () => {
    rerender(<ActiveVoyageScreen />);
  });

  await waitFor(() => expect(getByTestId('voyager-marker-user-3')).toBeTruthy());
  expect(mockGetVoyageMembers).toHaveBeenCalledTimes(2);
});

test('a realtime roster revision removes a departed Voyager without remounting the map', async () => {
  mockActiveVoyage('organizer');

  const { getByTestId, queryByTestId, rerender } = await render(<ActiveVoyageScreen />);
  await waitFor(() => expect(getByTestId('voyager-marker-user-2')).toBeTruthy());

  mockGetVoyageMembers.mockResolvedValue({ data: [membersFixture[0]], error: null });
  mockUseLiveLocations.mockReturnValue({
    locations: locationsFixture,
    trails: {},
    isLoading: false,
    hasError: false,
    isConnected: true,
    rosterRevision: 1,
  });
  await act(async () => {
    rerender(<ActiveVoyageScreen />);
  });

  await waitFor(() => expect(queryByTestId('voyager-marker-user-2')).toBeNull());
  expect(getByTestId('voyager-marker-user-1')).toBeTruthy();
});

test('does not render a marker for a Voyager with no live location yet', async () => {
  mockActiveVoyage('organizer');
  mockUseLiveLocations.mockReturnValue({
    locations: { 'user-1': locationsFixture['user-1'] },
    trails: {},
    isLoading: false,
    hasError: false,
    isConnected: true,
    rosterRevision: 0,
  });

  const { getByTestId, queryByTestId } = await render(<ActiveVoyageScreen />);

  await waitFor(() => expect(getByTestId('voyager-marker-user-1')).toBeTruthy());
  expect(queryByTestId('voyager-marker-user-2')).toBeNull();
});

test('tapping a marker opens the peek tooltip with that Voyager, and closing it dismisses', async () => {
  mockActiveVoyage('organizer');

  const { getByTestId, queryByTestId } = await render(<ActiveVoyageScreen />);
  await waitFor(() => expect(getByTestId('voyager-marker-user-2')).toBeTruthy());

  await act(async () => {
    fireEvent.press(getByTestId('voyager-marker-user-2'));
  });

  expect(getByTestId('marker-peek-card')).toBeTruthy();
  expect(within(getByTestId('marker-peek-card')).getByText('Meera')).toBeTruthy();
  // Player color shown on the tooltip (code review finding: the original
  // version omitted it despite the story's own stated v1 scope).
  expect(getByTestId('marker-peek-color-swatch')).toBeTruthy();

  await act(async () => {
    fireEvent.press(getByTestId('marker-peek-close-button'));
  });

  expect(queryByTestId('marker-peek-card')).toBeNull();
});

test('tapping the already-open marker again closes its tooltip (toggle), same as the explicit close button', async () => {
  mockActiveVoyage('organizer');

  const { getByTestId, queryByTestId } = await render(<ActiveVoyageScreen />);
  await waitFor(() => expect(getByTestId('voyager-marker-user-2')).toBeTruthy());

  await act(async () => {
    fireEvent.press(getByTestId('voyager-marker-user-2'));
  });
  expect(getByTestId('marker-peek-card')).toBeTruthy();

  await act(async () => {
    fireEvent.press(getByTestId('voyager-marker-user-2'));
  });
  expect(queryByTestId('marker-peek-card')).toBeNull();
});

test('tapping a different marker while one tooltip is open switches straight to the new one', async () => {
  mockActiveVoyage('organizer');

  const { getByTestId } = await render(<ActiveVoyageScreen />);
  await waitFor(() => expect(getByTestId('voyager-marker-user-2')).toBeTruthy());

  await act(async () => {
    fireEvent.press(getByTestId('voyager-marker-user-2'));
  });
  expect(within(getByTestId('marker-peek-card')).getByText('Meera')).toBeTruthy();

  await act(async () => {
    fireEvent.press(getByTestId('voyager-marker-user-1'));
  });
  expect(within(getByTestId('marker-peek-card')).getByText('Chintan')).toBeTruthy();
});

test('marker peek tooltip shows the selected Voyager\'s distance from your own live position, not the destination (user-reported change)', async () => {
  mockActiveVoyage('organizer');

  const { getByTestId } = await render(<ActiveVoyageScreen />);
  await waitFor(() => expect(getByTestId('voyager-marker-user-2')).toBeTruthy());

  await act(async () => {
    fireEvent.press(getByTestId('voyager-marker-user-2'));
  });

  // session user is user-1 (Chintan) -- distance is from user-1's own
  // location, not from any destination coordinate.
  const expectedLabel = formatDistanceMiles(haversineMiles(locationsFixture['user-2'], locationsFixture['user-1']));
  const distanceChildren = getByTestId('marker-peek-distance').props.children as unknown[];
  expect(distanceChildren[0]).toBe(`${expectedLabel} `);
  expect(within(getByTestId('marker-peek-card')).getByText('from you')).toBeTruthy();
});

test('marker peek tooltip omits the distance readout when this device does not have its own live location yet', async () => {
  mockActiveVoyage('organizer');
  // Only user-2 has a live location -- the signed-in user (user-1) doesn't,
  // so there's no "from you" to compute against.
  mockUseLiveLocations.mockReturnValue({
    locations: { 'user-2': locationsFixture['user-2'] },
    trails: {},
    isLoading: false,
    hasError: false,
    isConnected: true,
    rosterRevision: 0,
  });

  const { getByTestId, queryByTestId } = await render(<ActiveVoyageScreen />);
  await waitFor(() => expect(getByTestId('voyager-marker-user-2')).toBeTruthy());

  await act(async () => {
    fireEvent.press(getByTestId('voyager-marker-user-2'));
  });

  expect(queryByTestId('marker-peek-distance')).toBeNull();
});

test('marker peek tooltip shows Driving for a Driving-role Voyager instead of the old hardcoded Riding', async () => {
  mockActiveVoyage('organizer');
  mockGetVoyageMembers.mockResolvedValue({
    data: [membersFixture[0], { ...membersFixture[1], travelRole: 'driving' }],
    error: null,
  });

  const { getByTestId } = await render(<ActiveVoyageScreen />);
  await waitFor(() => expect(getByTestId('voyager-marker-user-2')).toBeTruthy());

  await act(async () => {
    fireEvent.press(getByTestId('voyager-marker-user-2'));
  });

  expect(within(getByTestId('marker-peek-card')).getByText('Driving')).toBeTruthy();
});

test('tapping your own marker shows only your name in the tooltip -- no role, no distance (user-reported change)', async () => {
  mockActiveVoyage('organizer');

  const { getByTestId, queryByTestId } = await render(<ActiveVoyageScreen />);
  await waitFor(() => expect(getByTestId('voyager-marker-user-1')).toBeTruthy());

  await act(async () => {
    fireEvent.press(getByTestId('voyager-marker-user-1'));
  });

  expect(within(getByTestId('marker-peek-card')).getByText('Chintan')).toBeTruthy();
  expect(within(getByTestId('marker-peek-card')).getByText('This is you.')).toBeTruthy();
  expect(queryByTestId('marker-peek-distance')).toBeNull();
  expect(within(getByTestId('marker-peek-card')).queryByText('Organizer')).toBeNull();
});

test('your own marker always shows a "this is you" ring, even before it is tapped', async () => {
  mockActiveVoyage('organizer');

  const { getByTestId } = await render(<ActiveVoyageScreen />);
  await waitFor(() => expect(getByTestId('voyager-marker-user-1')).toBeTruthy());

  // getByTestId throws if more than one match exists, so this alone also
  // proves the ring isn't duplicated onto user-2's (non-self) marker.
  expect(within(getByTestId('voyager-marker-user-1')).getByTestId('marker-you-ring')).toBeTruthy();
});

test('shows a subtle reconnecting note (not the error banner) when the live channel disconnects, and keeps rendering last-known markers', async () => {
  mockActiveVoyage('organizer');
  mockUseLiveLocations.mockReturnValue({ locations: locationsFixture, trails: {}, isLoading: false, hasError: false, isConnected: false, rosterRevision: 0 });

  const { getByTestId, queryByTestId } = await render(<ActiveVoyageScreen />);

  await waitFor(() => expect(getByTestId('reconnecting-note')).toBeTruthy());
  // Not the (red, alarming) hasError banner -- a subtle note, not a blocking one.
  expect(queryByTestId('locations-error')).toBeNull();
  // Last-known marker positions keep rendering.
  expect(getByTestId('voyager-marker-user-1')).toBeTruthy();
  expect(getByTestId('voyager-marker-user-2')).toBeTruthy();
});

test('does not show the reconnecting note while connected', async () => {
  mockActiveVoyage('organizer');
  mockUseLiveLocations.mockReturnValue({ locations: locationsFixture, trails: {}, isLoading: false, hasError: false, isConnected: true, rosterRevision: 0 });

  const { queryByTestId, getByTestId } = await render(<ActiveVoyageScreen />);

  await waitFor(() => expect(getByTestId('live-map')).toBeTruthy());
  expect(queryByTestId('reconnecting-note')).toBeNull();
});

test('shows an inline error when live locations fail to load (code review: not indistinguishable from nobody online)', async () => {
  mockActiveVoyage('organizer');
  mockUseLiveLocations.mockReturnValue({ locations: {}, trails: {}, isLoading: false, hasError: true, isConnected: true, rosterRevision: 0 });

  const { getByTestId } = await render(<ActiveVoyageScreen />);

  await waitFor(() => expect(getByTestId('locations-error')).toBeTruthy());
});

test('renders a comet-trail line for a Voyager with 2+ recent trail points (AC1)', async () => {
  mockActiveVoyage('organizer');
  mockUseLiveLocations.mockReturnValue({
    locations: locationsFixture,
    trails: {
      'user-1': [
        { lat: 39.0, lng: -120.0, updatedAt: '2026-07-26T00:00:00Z' },
        { lat: 39.1, lng: -120.0, updatedAt: '2026-07-26T00:00:02Z' },
      ],
    },
    isLoading: false,
    hasError: false,
    isConnected: true,
    rosterRevision: 0,
  });

  const { getByTestId } = await render(<ActiveVoyageScreen />);

  await waitFor(() => expect(getByTestId('trail-layer-user-1')).toBeTruthy());
});

test('does not render a trail line for a Voyager with fewer than 2 recent trail points', async () => {
  mockActiveVoyage('organizer');
  mockUseLiveLocations.mockReturnValue({
    locations: locationsFixture,
    trails: { 'user-1': [{ lat: 39.0, lng: -120.0, updatedAt: '2026-07-26T00:00:00Z' }] },
    isLoading: false,
    hasError: false,
    isConnected: true,
    rosterRevision: 0,
  });

  const { getByTestId, queryByTestId } = await render(<ActiveVoyageScreen />);

  await waitFor(() => expect(getByTestId('voyager-marker-user-1')).toBeTruthy());
  expect(queryByTestId('trail-layer-user-1')).toBeNull();
});

test('tapping recenter fits the camera to every live location, not just their average point (user-reported bug: an averaged point at a fixed zoom could land on empty road between spread-out Voyagers)', async () => {
  mockActiveVoyage('organizer');

  const { getByTestId } = await render(<ActiveVoyageScreen />);
  await waitFor(() => expect(getByTestId('voyager-marker-user-1')).toBeTruthy());

  await act(async () => {
    fireEvent.press(getByTestId('recenter-button'));
  });

  // user-1 {lat: 39.1, lng: -120.0}, user-2 {lat: 39.2, lng: -120.1} -- NE is
  // the max of each, SW the min. Padding is [top, right, bottom, left]:
  // MapBanner/HudBar height + a margin, so a marker can't land hidden
  // underneath either.
  expect(mockCameraFitBounds).toHaveBeenCalledWith([-120.0, 39.2], [-120.1, 39.1], [126, 24, 120, 24], 500);
  expect(mockCameraMoveTo).not.toHaveBeenCalled();
});

test('recentering with only one live location moves to it directly instead of calling fitBounds (which needs two distinct corners)', async () => {
  mockActiveVoyage('organizer');
  mockUseLiveLocations.mockReturnValue({
    locations: { 'user-1': locationsFixture['user-1'] },
    trails: {},
    isLoading: false,
    hasError: false,
    isConnected: true,
    rosterRevision: 0,
  });

  const { getByTestId } = await render(<ActiveVoyageScreen />);
  await waitFor(() => expect(getByTestId('voyager-marker-user-1')).toBeTruthy());

  mockCameraMoveTo.mockClear();

  await act(async () => {
    fireEvent.press(getByTestId('recenter-button'));
  });

  expect(mockCameraMoveTo).toHaveBeenCalledWith([-120.0, 39.1], 500);
  expect(mockCameraFitBounds).not.toHaveBeenCalled();
});

test('tapping the organizer menu button opens the relocated Organizer actions', async () => {
  mockActiveVoyage('organizer');

  const { getByTestId } = await render(<ActiveVoyageScreen />);

  await openOrganizerMenu(getByTestId);

  expect(getByTestId('end-voyage-button')).toBeTruthy();
  expect(getByTestId('organizer-menu-close-button')).toBeTruthy();
});

test('the Invite More Voyagers and End Voyage rows show an icon (user-reported bug: mockups/key-live-map.html pairs every drawer row with one, but DrawerRow never had an icon slot at all)', async () => {
  mockActiveVoyage('organizer');

  const { getByTestId, getByText } = await render(<ActiveVoyageScreen />);

  await openOrganizerMenu(getByTestId);

  expect(within(getByTestId('invite-more-voyagers-button')).getByText('💬')).toBeTruthy();
  expect(within(getByTestId('end-voyage-button')).getByText('🚫')).toBeTruthy();
  // Labels still render as their own text, unaffected by the icon.
  expect(getByText('Invite More Voyagers')).toBeTruthy();
  expect(getByText('End Voyage')).toBeTruthy();
});

test('closing the organizer menu returns to the map', async () => {
  mockActiveVoyage('organizer');

  const { getByTestId, queryByTestId } = await render(<ActiveVoyageScreen />);
  await openOrganizerMenu(getByTestId);

  await act(async () => {
    fireEvent.press(getByTestId('organizer-menu-close-button'));
  });

  // The map is mounted throughout -- opening/closing the drawer never
  // unmounts it (Story 4.2).
  expect(getByTestId('live-map')).toBeTruthy();
  // The drawer stays mounted through its own close animation (280ms) before
  // its content actually unmounts -- waitFor absorbs that real delay rather
  // than asserting instantly.
  await waitFor(() => expect(queryByTestId('end-voyage-button')).toBeNull());
});

test('the map stays mounted while the action drawer is open (Story 4.2 -- opens over the map, not a full-screen takeover)', async () => {
  mockActiveVoyage('organizer');

  const { getByTestId } = await render(<ActiveVoyageScreen />);
  await openOrganizerMenu(getByTestId);

  // Deliberately still mounted, just correctly hidden from assistive tech
  // while the drawer is up (see the mainContent accessibility props above)
  // -- `includeHiddenElements` looks past that to confirm presence in the
  // tree, which is what "stays mounted" actually means here.
  expect(getByTestId('live-map', { includeHiddenElements: true })).toBeTruthy();
  expect(getByTestId('hud-top', { includeHiddenElements: true })).toBeTruthy();
  expect(getByTestId('hud-bottom', { includeHiddenElements: true })).toBeTruthy();
  expect(getByTestId('end-voyage-button')).toBeTruthy();
});

test('tapping the drawer scrim closes it, same as the explicit close button', async () => {
  mockActiveVoyage('organizer');

  const { getByTestId, queryByTestId } = await render(<ActiveVoyageScreen />);
  await openOrganizerMenu(getByTestId);
  expect(getByTestId('end-voyage-button')).toBeTruthy();

  await act(async () => {
    fireEvent.press(getByTestId('action-drawer-scrim'));
  });

  await waitFor(() => expect(queryByTestId('end-voyage-button')).toBeNull());
});

test('reopening the drawer after closing it from a confirm step lands back on the menu step, not the confirm step', async () => {
  mockActiveVoyage('organizer');

  const { getByTestId, queryByTestId } = await render(<ActiveVoyageScreen />);
  await openOrganizerMenu(getByTestId);
  await act(async () => {
    fireEvent.press(getByTestId('end-voyage-button'));
  });
  expect(getByTestId('confirm-end-voyage-button')).toBeTruthy();

  await act(async () => {
    fireEvent.press(getByTestId('organizer-menu-close-button'));
  });
  await waitFor(() => expect(queryByTestId('confirm-end-voyage-button')).toBeNull());

  await openOrganizerMenu(getByTestId);

  expect(getByTestId('end-voyage-button')).toBeTruthy();
  expect(queryByTestId('confirm-end-voyage-button')).toBeNull();
});

test('under Reduce Motion, the drawer unmounts its content immediately on close (no animation delay)', async () => {
  mockActiveVoyage('organizer');
  jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValueOnce(true);

  const { getByTestId, queryByTestId } = await render(<ActiveVoyageScreen />);
  await waitFor(() => expect(getByTestId('live-map')).toBeTruthy());
  await openOrganizerMenu(getByTestId);
  expect(getByTestId('end-voyage-button')).toBeTruthy();

  await act(async () => {
    fireEvent.press(getByTestId('organizer-menu-close-button'));
  });

  // No waitFor -- under Reduce Motion this must already be gone by the time
  // this synchronous assertion runs, not merely "eventually" gone.
  expect(queryByTestId('end-voyage-button')).toBeNull();
});

test('does not show the End Voyage control for a plain Voyager', async () => {
  mockActiveVoyage('voyager');

  const { getByTestId, queryByTestId } = await render(<ActiveVoyageScreen />);
  await openOrganizerMenu(getByTestId);

  expect(queryByTestId('end-voyage-button')).toBeNull();
});

test('Invite More Voyagers is available to any member (not just the Organizer), and re-opens the join-code screen', async () => {
  mockActiveVoyage('voyager');

  const { getByTestId } = await render(<ActiveVoyageScreen />);
  await openOrganizerMenu(getByTestId);

  await act(async () => {
    fireEvent.press(getByTestId('invite-more-voyagers-button'));
  });

  expect(mockPush).toHaveBeenCalledWith({
    pathname: '/join-code',
    params: { destination: 'Lake Tahoe', joinCode: 'ABCD2345' },
  });
  // Code review finding: this call site was missed when Task 7 first wired
  // the flag through -- without marking it here too, join-code.tsx's own
  // Stack.Protected guard (_layout.tsx) stays false and silently refuses to
  // admit the screen, breaking this mid-Voyage re-invite feature.
  expect(mockMarkVoyageStarted).toHaveBeenCalledTimes(1);
});

test('tapping End Voyage swaps to the confirm view with the ceremonial copy', async () => {
  mockActiveVoyage('organizer');

  const { getByTestId, getByText } = await render(<ActiveVoyageScreen />);
  await openOrganizerMenu(getByTestId);

  await act(async () => {
    fireEvent.press(getByTestId('end-voyage-button'));
  });

  expect(getByText('Ready to close out the trip?')).toBeTruthy();
  expect(getByTestId('confirm-end-voyage-button')).toBeTruthy();
  expect(getByTestId('keep-going-button')).toBeTruthy();
});

test('tapping Keep going swaps back without calling endVoyage', async () => {
  mockActiveVoyage('organizer');

  const { getByTestId, queryByTestId } = await render(<ActiveVoyageScreen />);
  await openOrganizerMenu(getByTestId);

  await act(async () => {
    fireEvent.press(getByTestId('end-voyage-button'));
  });
  await act(async () => {
    fireEvent.press(getByTestId('keep-going-button'));
  });

  expect(queryByTestId('confirm-end-voyage-button')).toBeNull();
  expect(mockEndVoyage).not.toHaveBeenCalled();
});

test('confirming calls endVoyage, refetches, and navigates to voyage-ended with the summary data', async () => {
  mockActiveVoyage('organizer');
  mockEndVoyage.mockResolvedValue({
    data: {
      id: 'voyage-1',
      destination: 'Lake Tahoe',
      destinationLat: null,
      destinationLng: null,
      status: 'ended',
      createdBy: 'user-1',
      createdAt: '2026-07-26T00:00:00Z',
      endedAt: '2026-07-26T05:30:00Z',
      joinCode: 'ABCD2345',
      voyagerCount: 3,
    },
    error: null,
  });

  const { getByTestId } = await render(<ActiveVoyageScreen />);
  await openOrganizerMenu(getByTestId);

  await act(async () => {
    fireEvent.press(getByTestId('end-voyage-button'));
  });
  await act(async () => {
    fireEvent.press(getByTestId('confirm-end-voyage-button'));
  });

  expect(mockEndVoyage).toHaveBeenCalledWith('voyage-1');
  await waitFor(() => expect(mockRefetch).toHaveBeenCalledTimes(1));
  expect(mockPush).toHaveBeenCalledWith({
    pathname: '/voyage-ended',
    params: {
      destination: 'Lake Tahoe',
      createdAt: '2026-07-26T00:00:00Z',
      endedAt: '2026-07-26T05:30:00Z',
      voyagerCount: '3',
    },
  });
});

test('shows the error inline on failure and stays on the confirm view (never a dead end)', async () => {
  mockActiveVoyage('organizer');
  mockEndVoyage.mockResolvedValue({ data: null, error: { code: 'END03', message: 'Only the Organizer can end this Voyage.' } });

  const { getByTestId } = await render(<ActiveVoyageScreen />);
  await openOrganizerMenu(getByTestId);

  await act(async () => {
    fireEvent.press(getByTestId('end-voyage-button'));
  });
  await act(async () => {
    fireEvent.press(getByTestId('confirm-end-voyage-button'));
  });

  await waitFor(() => expect(getByTestId('end-voyage-error')).toBeTruthy());
  expect(getByTestId('end-voyage-error').props.children).toBe('Only the Organizer can end this Voyage.');
  expect(getByTestId('keep-going-button')).toBeTruthy();
  expect(mockPush).not.toHaveBeenCalled();
});

test('a network failure on End Voyage (resolved error.code "unknown") queues it instead of showing a dead-end error, and does not navigate', async () => {
  mockActiveVoyage('organizer');
  mockEndVoyage.mockResolvedValue({ data: null, error: { code: 'unknown', message: 'Network request failed' } });

  const { getByTestId } = await render(<ActiveVoyageScreen />);
  await openOrganizerMenu(getByTestId);

  await act(async () => {
    fireEvent.press(getByTestId('end-voyage-button'));
  });
  await act(async () => {
    fireEvent.press(getByTestId('confirm-end-voyage-button'));
  });

  expect(mockOutboxEnqueue).toHaveBeenCalledWith({ kind: 'end_voyage', payload: { voyageId: 'voyage-1' } });
  await waitFor(() => expect(getByTestId('end-voyage-error')).toBeTruthy());
  expect(getByTestId('end-voyage-error').props.children).toContain('Queued');
  expect(mockPush).not.toHaveBeenCalled();
});

test('a thrown exception on End Voyage also queues it (not just a resolved network-shaped error)', async () => {
  mockActiveVoyage('organizer');
  mockEndVoyage.mockRejectedValue(new Error('Network request failed'));

  const { getByTestId } = await render(<ActiveVoyageScreen />);
  await openOrganizerMenu(getByTestId);

  await act(async () => {
    fireEvent.press(getByTestId('end-voyage-button'));
  });
  await act(async () => {
    fireEvent.press(getByTestId('confirm-end-voyage-button'));
  });

  expect(mockOutboxEnqueue).toHaveBeenCalledWith({ kind: 'end_voyage', payload: { voyageId: 'voyage-1' } });
  await waitFor(() => expect(getByTestId('end-voyage-error').props.children).toContain('Queued'));
});

test('outbox.flush is attempted on mount, and a successfully flushed end_voyage navigates to voyage-ended', async () => {
  mockActiveVoyage('organizer');
  // mockResolvedValueOnce, not mockResolvedValue -- isConnected starts
  // `true` by default, so both the unconditional mount-time flush and the
  // isConnected-keyed effect fire on the same initial render (matching a
  // real outbox: the second call would correctly find the queue already
  // empty after the first successfully processed it).
  mockOutboxFlush.mockResolvedValueOnce({
    succeeded: [
      {
        item: { id: 'item-1', kind: 'end_voyage', payload: { voyageId: 'voyage-1' }, queuedAt: '2026-07-28T00:00:00Z' },
        data: { destination: 'Lake Tahoe', createdAt: '2026-07-26T00:00:00Z', endedAt: '2026-07-26T05:30:00Z', voyagerCount: 3 },
      },
    ],
    conflicts: [],
  });

  await render(<ActiveVoyageScreen />);

  await waitFor(() => expect(mockOutboxFlush).toHaveBeenCalled());
  await waitFor(() => expect(mockRefetch).toHaveBeenCalledTimes(1));
  expect(mockPush).toHaveBeenCalledWith({
    pathname: '/voyage-ended',
    params: { destination: 'Lake Tahoe', createdAt: '2026-07-26T00:00:00Z', endedAt: '2026-07-26T05:30:00Z', voyagerCount: '3' },
  });
});

test('a reconnect (isConnected false -> true) triggers another flush attempt', async () => {
  mockActiveVoyage('organizer');
  mockUseLiveLocations.mockReturnValue({ locations: locationsFixture, trails: {}, isLoading: false, hasError: false, isConnected: false, rosterRevision: 0 });

  const { rerender } = await render(<ActiveVoyageScreen />);
  // Only the unconditional mount-time flush fires -- isConnected starts
  // false here, so the isConnected-keyed effect does not also fire.
  await waitFor(() => expect(mockOutboxFlush).toHaveBeenCalledTimes(1));

  mockUseLiveLocations.mockReturnValue({ locations: locationsFixture, trails: {}, isLoading: false, hasError: false, isConnected: true, rosterRevision: 0 });
  await act(async () => {
    rerender(<ActiveVoyageScreen />);
  });

  await waitFor(() => expect(mockOutboxFlush).toHaveBeenCalledTimes(2));
});

test('a successfully flushed grant_organizer_status refreshes the roster and shows a toast', async () => {
  mockActiveVoyage('organizer');
  // Mounts already connected with the default (empty) flush result, so the
  // mount-time flush attempt is a no-op and the initial roster fetch has a
  // chance to resolve and populate `members` before the flush this test
  // actually cares about ever runs -- avoids a genuine race between the two
  // independent mount-time effects (flush-on-mount vs. load-members).
  mockUseLiveLocations.mockReturnValue({ locations: locationsFixture, trails: {}, isLoading: false, hasError: false, isConnected: false, rosterRevision: 0 });

  const { getByTestId, rerender } = await render(<ActiveVoyageScreen />);
  await waitFor(() => expect(mockGetVoyageMembers).toHaveBeenCalledTimes(1));

  mockOutboxFlush.mockResolvedValue({
    succeeded: [
      {
        item: {
          id: 'item-1',
          kind: 'grant_organizer_status',
          payload: { voyageId: 'voyage-1', targetUserId: 'user-2' },
          queuedAt: '2026-07-28T00:00:00Z',
        },
        data: null,
      },
    ],
    conflicts: [],
  });
  mockUseLiveLocations.mockReturnValue({ locations: locationsFixture, trails: {}, isLoading: false, hasError: false, isConnected: true, rosterRevision: 0 });
  await act(async () => {
    rerender(<ActiveVoyageScreen />);
  });

  await waitFor(() => expect(getByTestId('outbox-toast')).toBeTruthy());
  expect(within(getByTestId('outbox-toast')).getByText('Meera is now an Organizer')).toBeTruthy();
  // Initial load + the flush-triggered refresh.
  await waitFor(() => expect(mockGetVoyageMembers).toHaveBeenCalledTimes(2));
});

test('a flush conflict shows the conflict message via the same toast mechanism, not a silent drop', async () => {
  mockActiveVoyage('organizer');
  mockOutboxFlush.mockResolvedValue({
    succeeded: [],
    conflicts: [
      {
        item: {
          id: 'item-1',
          kind: 'remove_voyager',
          payload: { voyageId: 'voyage-1', targetUserId: 'user-2' },
          queuedAt: '2026-07-28T00:00:00Z',
        },
        message: 'That person is not an active member of this Voyage.',
      },
    ],
  });

  const { getByTestId } = await render(<ActiveVoyageScreen />);

  await waitFor(() => expect(getByTestId('outbox-toast')).toBeTruthy());
  expect(within(getByTestId('outbox-toast')).getByText('That person is not an active member of this Voyage.')).toBeTruthy();
});

test('a flush pass with multiple items combines their messages into one toast instead of overwriting', async () => {
  mockActiveVoyage('organizer');
  // Mounts already connected with the default (empty) flush result, so the
  // mount-time flush is a no-op and the initial roster fetch resolves and
  // populates `members` before the flush this test cares about ever runs --
  // avoids a race between the two independent mount-time effects.
  mockUseLiveLocations.mockReturnValue({ locations: locationsFixture, trails: {}, isLoading: false, hasError: false, isConnected: false, rosterRevision: 0 });

  const { getByTestId, rerender } = await render(<ActiveVoyageScreen />);
  await waitFor(() => expect(mockGetVoyageMembers).toHaveBeenCalledTimes(1));

  mockOutboxFlush.mockResolvedValueOnce({
    succeeded: [
      {
        item: {
          id: 'item-1',
          kind: 'grant_organizer_status',
          payload: { voyageId: 'voyage-1', targetUserId: 'user-2' },
          queuedAt: '2026-07-28T00:00:00Z',
        },
        data: null,
      },
    ],
    conflicts: [
      {
        item: {
          id: 'item-2',
          kind: 'remove_voyager',
          payload: { voyageId: 'voyage-1', targetUserId: 'user-3' },
          queuedAt: '2026-07-28T00:00:01Z',
        },
        message: 'That person is not an active member of this Voyage.',
      },
    ],
  });
  mockUseLiveLocations.mockReturnValue({ locations: locationsFixture, trails: {}, isLoading: false, hasError: false, isConnected: true, rosterRevision: 0 });
  await act(async () => {
    rerender(<ActiveVoyageScreen />);
  });

  await waitFor(() => expect(getByTestId('outbox-toast')).toBeTruthy());
  const messageNode = within(getByTestId('outbox-toast')).getByText(/Meera is now an Organizer/);
  expect(messageNode.props.children).toContain('Meera is now an Organizer');
  expect(messageNode.props.children).toContain('That person is not an active member of this Voyage.');
});

test('fetches and shows the Voyager list with display names in the organizer menu', async () => {
  mockActiveVoyage('organizer');

  const { getByTestId } = await render(<ActiveVoyageScreen />);
  await openOrganizerMenu(getByTestId);

  expect(mockGetVoyageMembers).toHaveBeenCalledWith('voyage-1');
  // Scoped to the drawer's own member list (Story 4.2: the map stays
  // mounted behind the drawer, so an unscoped getByText risks matching a
  // marker's own name tag too).
  await waitFor(() => expect(within(getByTestId('drawer-member-list')).getByText('Chintan')).toBeTruthy());
  expect(within(getByTestId('drawer-member-list')).getByText('Meera')).toBeTruthy();
});

test('the drawer member list shows each non-Organizer member\'s Driving/Riding status (Story 4.3 code review: this was silently dropped when the always-visible hud-bottom roster was removed)', async () => {
  mockActiveVoyage('organizer');
  mockGetVoyageMembers.mockResolvedValue({
    data: [membersFixture[0], { ...membersFixture[1], travelRole: 'driving' }],
    error: null,
  });

  const { getByTestId } = await render(<ActiveVoyageScreen />);
  await openOrganizerMenu(getByTestId);

  await waitFor(() => expect(getByTestId('drawer-member-role-user-2').props.children).toBe('Driving'));
  expect(getByTestId('drawer-member-role-user-1').props.children).toBe('Organizer');
});

test('shows a Grant Organizer action for each non-organizer row when viewed by an Organizer', async () => {
  mockActiveVoyage('organizer');

  const { getByTestId, queryByTestId } = await render(<ActiveVoyageScreen />);
  await openOrganizerMenu(getByTestId);

  await waitFor(() => expect(getByTestId('grant-organizer-button-user-2')).toBeTruthy());
  expect(queryByTestId('grant-organizer-button-user-1')).toBeNull();
});

test('shows no Grant Organizer actions at all when viewed by a plain Voyager', async () => {
  mockActiveVoyage('voyager');

  const { getByTestId, queryByTestId } = await render(<ActiveVoyageScreen />);
  await openOrganizerMenu(getByTestId);

  await waitFor(() => expect(mockGetVoyageMembers).toHaveBeenCalled());
  expect(queryByTestId('grant-organizer-button-user-2')).toBeNull();
});

test('tapping Grant Organizer calls the repository, shows a quiet toast, and re-fetches -- no navigation', async () => {
  mockActiveVoyage('organizer');
  mockGrantOrganizerStatus.mockResolvedValue({ error: null });

  const { getByTestId, getByText } = await render(<ActiveVoyageScreen />);
  await openOrganizerMenu(getByTestId);

  await waitFor(() => expect(getByTestId('grant-organizer-button-user-2')).toBeTruthy());

  await act(async () => {
    fireEvent.press(getByTestId('grant-organizer-button-user-2'));
  });

  expect(mockGrantOrganizerStatus).toHaveBeenCalledWith('voyage-1', 'user-2');
  await waitFor(() => expect(getByText(/Meera is now an Organizer/)).toBeTruthy());
  await waitFor(() => expect(mockGetVoyageMembers).toHaveBeenCalledTimes(2));
  expect(mockPush).not.toHaveBeenCalled();
});

test('shows an inline error (not a dead end) when granting Organizer status fails', async () => {
  mockActiveVoyage('organizer');
  mockGrantOrganizerStatus.mockResolvedValue({ error: { code: 'ORG02', message: 'That person is not an active member of this Voyage.' } });

  const { getByTestId } = await render(<ActiveVoyageScreen />);
  await openOrganizerMenu(getByTestId);

  await waitFor(() => expect(getByTestId('grant-organizer-button-user-2')).toBeTruthy());

  await act(async () => {
    fireEvent.press(getByTestId('grant-organizer-button-user-2'));
  });

  await waitFor(() => expect(getByTestId('voyager-list-error')).toBeTruthy());
  expect(getByTestId('voyager-list-error').props.children).toBe('That person is not an active member of this Voyage.');
});

test('a network failure on Grant Organizer queues it instead of showing a dead-end error', async () => {
  mockActiveVoyage('organizer');
  mockGrantOrganizerStatus.mockResolvedValue({ error: { code: 'unknown', message: 'Network request failed' } });

  const { getByTestId } = await render(<ActiveVoyageScreen />);
  await openOrganizerMenu(getByTestId);
  await waitFor(() => expect(getByTestId('grant-organizer-button-user-2')).toBeTruthy());

  await act(async () => {
    fireEvent.press(getByTestId('grant-organizer-button-user-2'));
  });

  expect(mockOutboxEnqueue).toHaveBeenCalledWith({
    kind: 'grant_organizer_status',
    payload: { voyageId: 'voyage-1', targetUserId: 'user-2' },
  });
  await waitFor(() => expect(getByTestId('voyager-list-error').props.children).toContain('Queued'));
});

test('a thrown exception on Grant Organizer also queues it', async () => {
  mockActiveVoyage('organizer');
  mockGrantOrganizerStatus.mockRejectedValue(new Error('Network request failed'));

  const { getByTestId } = await render(<ActiveVoyageScreen />);
  await openOrganizerMenu(getByTestId);
  await waitFor(() => expect(getByTestId('grant-organizer-button-user-2')).toBeTruthy());

  await act(async () => {
    fireEvent.press(getByTestId('grant-organizer-button-user-2'));
  });

  expect(mockOutboxEnqueue).toHaveBeenCalledWith({
    kind: 'grant_organizer_status',
    payload: { voyageId: 'voyage-1', targetUserId: 'user-2' },
  });
});

test('a network failure on Grant Organizer still enqueues even if the component unmounts before the RPC resolves', async () => {
  mockActiveVoyage('organizer');
  let resolveGrant: (value: any) => void;
  mockGrantOrganizerStatus.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        resolveGrant = resolve;
      }),
  );

  const { getByTestId, unmount } = await render(<ActiveVoyageScreen />);
  await openOrganizerMenu(getByTestId);
  await waitFor(() => expect(getByTestId('grant-organizer-button-user-2')).toBeTruthy());

  await act(async () => {
    fireEvent.press(getByTestId('grant-organizer-button-user-2'));
  });
  await act(async () => {
    unmount();
  });
  await act(async () => {
    resolveGrant!({ error: { code: 'unknown', message: 'Network request failed' } });
  });

  expect(mockOutboxEnqueue).toHaveBeenCalledWith({
    kind: 'grant_organizer_status',
    payload: { voyageId: 'voyage-1', targetUserId: 'user-2' },
  });
});

test('shows a retry action (not a dead end) when the initial Voyager-list fetch fails, and retrying re-fetches', async () => {
  mockActiveVoyage('organizer');
  mockGetVoyageMembers.mockResolvedValueOnce({ data: null, error: { code: 'MEM01', message: 'You are not a participant of this Voyage.' } });

  const { getByTestId } = await render(<ActiveVoyageScreen />);
  await openOrganizerMenu(getByTestId);

  await waitFor(() => expect(getByTestId('voyager-list-error')).toBeTruthy());
  expect(getByTestId('voyager-list-retry-button')).toBeTruthy();

  mockGetVoyageMembers.mockResolvedValueOnce({ data: membersFixture, error: null });
  await act(async () => {
    fireEvent.press(getByTestId('voyager-list-retry-button'));
  });

  expect(mockGetVoyageMembers).toHaveBeenCalledTimes(2);
  // Scoped to the drawer's own member list -- see the equivalent note in
  // "fetches and shows the Voyager list..." above.
  await waitFor(() => expect(within(getByTestId('drawer-member-list')).getByText('Chintan')).toBeTruthy());
});

test('granting Organizer status on one row does not re-enable a different row still in flight', async () => {
  mockActiveVoyage('organizer');
  mockGetVoyageMembers.mockResolvedValue({
    data: [
      {
        userId: 'user-1',
        displayName: 'Chintan',
        role: 'organizer' as const,
        joinedAt: '2026-07-26T00:00:00Z',
        playerColor: 'coral' as const,
        travelRole: 'riding' as const,
      },
      {
        userId: 'user-2',
        displayName: 'Meera',
        role: 'voyager' as const,
        joinedAt: '2026-07-26T00:05:00Z',
        playerColor: 'teal' as const,
        travelRole: 'riding' as const,
      },
      {
        userId: 'user-3',
        displayName: 'Sam',
        role: 'voyager' as const,
        joinedAt: '2026-07-26T00:10:00Z',
        playerColor: 'violet' as const,
        travelRole: 'riding' as const,
      },
    ],
    error: null,
  });

  let resolveFirstGrant: (value: any) => void;
  mockGrantOrganizerStatus.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        resolveFirstGrant = resolve;
      }),
  );
  mockGrantOrganizerStatus.mockResolvedValueOnce({ error: null });

  const { getByTestId } = await render(<ActiveVoyageScreen />);
  await openOrganizerMenu(getByTestId);
  await waitFor(() => expect(getByTestId('grant-organizer-button-user-2')).toBeTruthy());

  await act(async () => {
    fireEvent.press(getByTestId('grant-organizer-button-user-2'));
  });
  expect(getByTestId('grant-organizer-button-user-2').props.accessibilityState?.disabled).toBe(true);

  await act(async () => {
    fireEvent.press(getByTestId('grant-organizer-button-user-3'));
  });

  expect(getByTestId('grant-organizer-button-user-2').props.accessibilityState?.disabled).toBe(true);

  await act(async () => {
    resolveFirstGrant!({ error: null });
  });
});

test('shows a Remove action for each non-self row when viewed by an Organizer', async () => {
  mockActiveVoyage('organizer');

  const { getByTestId, queryByTestId } = await render(<ActiveVoyageScreen />);
  await openOrganizerMenu(getByTestId);

  await waitFor(() => expect(getByTestId('remove-voyager-button-user-2')).toBeTruthy());
  expect(queryByTestId('remove-voyager-button-user-1')).toBeNull();
});

test('shows no Remove actions at all when viewed by a plain Voyager', async () => {
  mockActiveVoyage('voyager');
  mockUseAuth.mockReturnValue({
    session: { user: { id: 'user-2' } } as any,
    isLoading: false,
    signInWithEmail: jest.fn<(...args: any[]) => Promise<any>>(),
    verifyCode: jest.fn<(...args: any[]) => Promise<any>>(),
    signOut: jest.fn<(...args: any[]) => Promise<any>>(),
  });

  const { getByTestId, queryByTestId } = await render(<ActiveVoyageScreen />);
  await openOrganizerMenu(getByTestId);

  await waitFor(() => expect(mockGetVoyageMembers).toHaveBeenCalled());
  expect(queryByTestId('remove-voyager-button-user-1')).toBeNull();
});

test('tapping Remove swaps to the confirm view with the plain, calm copy', async () => {
  mockActiveVoyage('organizer');

  const { getByTestId, getByText } = await render(<ActiveVoyageScreen />);
  await openOrganizerMenu(getByTestId);

  await waitFor(() => expect(getByTestId('remove-voyager-button-user-2')).toBeTruthy());
  await act(async () => {
    fireEvent.press(getByTestId('remove-voyager-button-user-2'));
  });

  expect(getByText('Remove Meera from this Voyage?')).toBeTruthy();
  expect(getByTestId('confirm-remove-voyager-button')).toBeTruthy();
  expect(getByTestId('keep-voyager-button')).toBeTruthy();
});

test('tapping the cancel action swaps back without calling removeVoyager', async () => {
  mockActiveVoyage('organizer');

  const { getByTestId, queryByTestId } = await render(<ActiveVoyageScreen />);
  await openOrganizerMenu(getByTestId);

  await waitFor(() => expect(getByTestId('remove-voyager-button-user-2')).toBeTruthy());
  await act(async () => {
    fireEvent.press(getByTestId('remove-voyager-button-user-2'));
  });
  await act(async () => {
    fireEvent.press(getByTestId('keep-voyager-button'));
  });

  expect(queryByTestId('confirm-remove-voyager-button')).toBeNull();
  expect(mockRemoveVoyager).not.toHaveBeenCalled();
});

test('confirming Remove calls removeVoyager, re-fetches the member list, and shows no toast or navigation', async () => {
  mockActiveVoyage('organizer');
  mockRemoveVoyager.mockResolvedValue({ error: null });

  const { getByTestId, queryByTestId } = await render(<ActiveVoyageScreen />);
  await openOrganizerMenu(getByTestId);

  await waitFor(() => expect(getByTestId('remove-voyager-button-user-2')).toBeTruthy());
  await act(async () => {
    fireEvent.press(getByTestId('remove-voyager-button-user-2'));
  });
  await act(async () => {
    fireEvent.press(getByTestId('confirm-remove-voyager-button'));
  });

  expect(mockRemoveVoyager).toHaveBeenCalledWith('voyage-1', 'user-2');
  await waitFor(() => expect(mockGetVoyageMembers).toHaveBeenCalledTimes(2));
  expect(queryByTestId('confirm-remove-voyager-button')).toBeNull();
  expect(mockPush).not.toHaveBeenCalled();
  // A plain (non-flush, non-grant) Remove doesn't set toastMessage -- the
  // single shared outbox-toast (Story 4.2 consolidated the drawer's own
  // separate toast copy into this one) shouldn't be showing either.
  expect(queryByTestId('outbox-toast')).toBeNull();
});

test('shows an inline error (not a dead end) when removing a Voyager fails', async () => {
  mockActiveVoyage('organizer');
  mockRemoveVoyager.mockResolvedValue({ error: { code: 'REM02', message: 'A Voyage must always have at least one Organizer.' } });

  const { getByTestId } = await render(<ActiveVoyageScreen />);
  await openOrganizerMenu(getByTestId);

  await waitFor(() => expect(getByTestId('remove-voyager-button-user-2')).toBeTruthy());
  await act(async () => {
    fireEvent.press(getByTestId('remove-voyager-button-user-2'));
  });
  await act(async () => {
    fireEvent.press(getByTestId('confirm-remove-voyager-button'));
  });

  await waitFor(() => expect(getByTestId('remove-voyager-error')).toBeTruthy());
  expect(getByTestId('remove-voyager-error').props.children).toBe('A Voyage must always have at least one Organizer.');
  expect(getByTestId('keep-voyager-button')).toBeTruthy();
});

test('a network failure on Remove Voyager queues it, dismisses the confirm view, and shows the queued message in the organizer menu', async () => {
  mockActiveVoyage('organizer');
  mockRemoveVoyager.mockResolvedValue({ error: { code: 'unknown', message: 'Network request failed' } });

  const { getByTestId, queryByTestId } = await render(<ActiveVoyageScreen />);
  await openOrganizerMenu(getByTestId);

  await waitFor(() => expect(getByTestId('remove-voyager-button-user-2')).toBeTruthy());
  await act(async () => {
    fireEvent.press(getByTestId('remove-voyager-button-user-2'));
  });
  await act(async () => {
    fireEvent.press(getByTestId('confirm-remove-voyager-button'));
  });

  expect(mockOutboxEnqueue).toHaveBeenCalledWith({
    kind: 'remove_voyager',
    payload: { voyageId: 'voyage-1', targetUserId: 'user-2' },
  });
  // Dismissed back to the organizer menu, not stuck on the confirm view.
  expect(queryByTestId('keep-voyager-button')).toBeNull();
  await waitFor(() => expect(getByTestId('voyager-list-error').props.children).toContain('Queued'));
});

test('a thrown exception on Remove Voyager also queues it', async () => {
  mockActiveVoyage('organizer');
  mockRemoveVoyager.mockRejectedValue(new Error('Network request failed'));

  const { getByTestId } = await render(<ActiveVoyageScreen />);
  await openOrganizerMenu(getByTestId);

  await waitFor(() => expect(getByTestId('remove-voyager-button-user-2')).toBeTruthy());
  await act(async () => {
    fireEvent.press(getByTestId('remove-voyager-button-user-2'));
  });
  await act(async () => {
    fireEvent.press(getByTestId('confirm-remove-voyager-button'));
  });

  expect(mockOutboxEnqueue).toHaveBeenCalledWith({
    kind: 'remove_voyager',
    payload: { voyageId: 'voyage-1', targetUserId: 'user-2' },
  });
});

test('a network failure on Remove Voyager still enqueues even if the component unmounts before the RPC resolves', async () => {
  mockActiveVoyage('organizer');
  let resolveRemove: (value: any) => void;
  mockRemoveVoyager.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        resolveRemove = resolve;
      }),
  );

  const { getByTestId, unmount } = await render(<ActiveVoyageScreen />);
  await openOrganizerMenu(getByTestId);
  await waitFor(() => expect(getByTestId('remove-voyager-button-user-2')).toBeTruthy());

  await act(async () => {
    fireEvent.press(getByTestId('remove-voyager-button-user-2'));
  });
  await act(async () => {
    fireEvent.press(getByTestId('confirm-remove-voyager-button'));
  });
  await act(async () => {
    unmount();
  });
  await act(async () => {
    resolveRemove!({ error: { code: 'unknown', message: 'Network request failed' } });
  });

  expect(mockOutboxEnqueue).toHaveBeenCalledWith({
    kind: 'remove_voyager',
    payload: { voyageId: 'voyage-1', targetUserId: 'user-2' },
  });
});

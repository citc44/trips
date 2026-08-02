import { beforeEach, expect, jest, test } from '@jest/globals';
import { act, fireEvent, render, waitFor, within } from '@testing-library/react-native';

import { voyageRepository } from '@/repositories/voyage-repository';
import { useActiveVoyage } from '@/shared/hooks/use-active-voyage';
import { useAuth } from '@/shared/hooks/use-auth';
import { useLiveLocations } from '@/shared/hooks/use-live-locations';
import { formatDistanceMiles, haversineMiles } from '@/shared/lib/geo';
import { outbox } from '@/shared/services/outbox/outbox';

import ActiveVoyageScreen from '../active-voyage';

const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  router: { push: (...args: unknown[]) => mockPush(...args) },
}));

jest.mock('@/lib/mapbox', () => ({ initMapbox: jest.fn() }));

const mockCameraMoveTo = jest.fn();
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
    default: { StyleURL: { Dark: 'mapbox://styles/mapbox/dark-v10' } },
    MapView: ({ children, testID }: any) => ReactActual.createElement(View, { testID }, children),
    Camera: ReactActual.forwardRef((_props: any, ref: any) => {
      ReactActual.useImperativeHandle(ref, () => ({ moveTo: mockCameraMoveTo, flyTo: jest.fn(), zoomTo: jest.fn(), fitBounds: jest.fn() }));
      return null;
    }),
    MarkerView: ({ children }: any) => children,
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

const DESTINATION_COORDS = { lat: 39.0968, lng: -120.0324 };

// Distinct from mockActiveVoyage() above: this Voyage's destination has real
// picked-place coordinates (destination search), which is what the distance
// readout needs -- mockActiveVoyage()'s default fixture deliberately has
// none, covering the "started before destination search existed / free-text
// entry" degrade-gracefully case those other tests exercise.
function mockActiveVoyageWithDestinationCoords(role: 'organizer' | 'voyager') {
  mockUseActiveVoyage.mockReturnValue({
    activeVoyage: {
      voyage: {
        id: 'voyage-1',
        destination: 'Lake Tahoe, California, United States',
        destinationLat: DESTINATION_COORDS.lat,
        destinationLng: DESTINATION_COORDS.lng,
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
  mockUseLiveLocations.mockReturnValue({ locations: locationsFixture, trails: {}, isLoading: false, hasError: false, isConnected: true });
});

test('shows the map, destination, and status pill', async () => {
  mockActiveVoyage('organizer');

  const { getByText, getByTestId } = await render(<ActiveVoyageScreen />);

  expect(getByTestId('live-map')).toBeTruthy();
  expect(getByText('Lake Tahoe')).toBeTruthy();
  expect(getByTestId('status-pill')).toBeTruthy();
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

test('does not render a marker for a Voyager with no live location yet', async () => {
  mockActiveVoyage('organizer');
  mockUseLiveLocations.mockReturnValue({
    locations: { 'user-1': locationsFixture['user-1'] },
    trails: {},
    isLoading: false,
    hasError: false,
    isConnected: true,
  });

  const { getByTestId, queryByTestId } = await render(<ActiveVoyageScreen />);

  await waitFor(() => expect(getByTestId('voyager-marker-user-1')).toBeTruthy());
  expect(queryByTestId('voyager-marker-user-2')).toBeNull();
});

test('tapping a marker opens the peek card with that Voyager, and closing it dismisses', async () => {
  mockActiveVoyage('organizer');

  const { getByTestId, queryByTestId } = await render(<ActiveVoyageScreen />);
  await waitFor(() => expect(getByTestId('voyager-marker-user-2')).toBeTruthy());

  await act(async () => {
    fireEvent.press(getByTestId('voyager-marker-user-2'));
  });

  expect(getByTestId('marker-peek-card')).toBeTruthy();
  expect(within(getByTestId('marker-peek-card')).getByText('Meera')).toBeTruthy();
  // Player color shown on the peek card (code review finding: the original
  // version omitted it despite the story's own stated v1 scope).
  expect(getByTestId('marker-peek-color-swatch')).toBeTruthy();

  await act(async () => {
    fireEvent.press(getByTestId('marker-peek-close-button'));
  });

  expect(queryByTestId('marker-peek-card')).toBeNull();
});

test('hud-bottom roster row shows Driving for a Driving-role Voyager instead of the old hardcoded Riding', async () => {
  mockActiveVoyage('organizer');
  mockGetVoyageMembers.mockResolvedValue({
    data: [membersFixture[0], { ...membersFixture[1], travelRole: 'driving' }],
    error: null,
  });

  const { getByTestId } = await render(<ActiveVoyageScreen />);
  await waitFor(() => expect(within(getByTestId('hud-bottom')).getByText('Meera')).toBeTruthy());

  expect(within(getByTestId('hud-bottom')).getByText('Driving')).toBeTruthy();
});

test('hud-bottom roster row shows each Voyager\'s live distance from the destination once it has picked coordinates', async () => {
  mockActiveVoyageWithDestinationCoords('organizer');

  const { getByTestId } = await render(<ActiveVoyageScreen />);
  await waitFor(() => expect(within(getByTestId('hud-bottom')).getByText('Meera')).toBeTruthy());

  const expectedLabel = formatDistanceMiles(haversineMiles(locationsFixture['user-2'], DESTINATION_COORDS));
  expect(getByTestId('hud-bottom-distance-user-2').props.children).toBe(expectedLabel);
});

test('hud-bottom roster row omits the distance readout when the destination has no picked coordinates', async () => {
  mockActiveVoyage('organizer');

  const { getByTestId, queryByTestId } = await render(<ActiveVoyageScreen />);
  await waitFor(() => expect(within(getByTestId('hud-bottom')).getByText('Meera')).toBeTruthy());

  expect(queryByTestId('hud-bottom-distance-user-2')).toBeNull();
});

test('marker peek card shows the selected Voyager\'s distance from the destination', async () => {
  mockActiveVoyageWithDestinationCoords('organizer');

  const { getByTestId } = await render(<ActiveVoyageScreen />);
  await waitFor(() => expect(getByTestId('voyager-marker-user-2')).toBeTruthy());

  await act(async () => {
    fireEvent.press(getByTestId('voyager-marker-user-2'));
  });

  const expectedLabel = formatDistanceMiles(haversineMiles(locationsFixture['user-2'], DESTINATION_COORDS));
  expect(getByTestId('marker-peek-distance').props.children).toBe(`${expectedLabel} from Lake Tahoe, California, United States`);
});

test('marker peek card omits the distance readout when the destination has no picked coordinates', async () => {
  mockActiveVoyage('organizer');

  const { getByTestId, queryByTestId } = await render(<ActiveVoyageScreen />);
  await waitFor(() => expect(getByTestId('voyager-marker-user-2')).toBeTruthy());

  await act(async () => {
    fireEvent.press(getByTestId('voyager-marker-user-2'));
  });

  expect(queryByTestId('marker-peek-distance')).toBeNull();
});

test('marker peek card shows Driving for a Driving-role Voyager instead of the old hardcoded Riding', async () => {
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

test('shows a subtle reconnecting note (not the error banner) when the live channel disconnects, and keeps rendering last-known markers', async () => {
  mockActiveVoyage('organizer');
  mockUseLiveLocations.mockReturnValue({ locations: locationsFixture, trails: {}, isLoading: false, hasError: false, isConnected: false });

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
  mockUseLiveLocations.mockReturnValue({ locations: locationsFixture, trails: {}, isLoading: false, hasError: false, isConnected: true });

  const { queryByTestId, getByTestId } = await render(<ActiveVoyageScreen />);

  await waitFor(() => expect(getByTestId('live-map')).toBeTruthy());
  expect(queryByTestId('reconnecting-note')).toBeNull();
});

test('shows an inline error when live locations fail to load (code review: not indistinguishable from nobody online)', async () => {
  mockActiveVoyage('organizer');
  mockUseLiveLocations.mockReturnValue({ locations: {}, trails: {}, isLoading: false, hasError: true, isConnected: true });

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
  });

  const { getByTestId, queryByTestId } = await render(<ActiveVoyageScreen />);

  await waitFor(() => expect(getByTestId('voyager-marker-user-1')).toBeTruthy());
  expect(queryByTestId('trail-layer-user-1')).toBeNull();
});

test('tapping recenter moves the camera to the average of all live locations', async () => {
  mockActiveVoyage('organizer');

  const { getByTestId } = await render(<ActiveVoyageScreen />);
  await waitFor(() => expect(getByTestId('voyager-marker-user-1')).toBeTruthy());

  await act(async () => {
    fireEvent.press(getByTestId('recenter-button'));
  });

  expect(mockCameraMoveTo).toHaveBeenCalledWith([-120.05, 39.150000000000006], 500);
});

test('tapping the organizer menu button opens the relocated Organizer actions', async () => {
  mockActiveVoyage('organizer');

  const { getByTestId } = await render(<ActiveVoyageScreen />);

  await openOrganizerMenu(getByTestId);

  expect(getByTestId('end-voyage-button')).toBeTruthy();
  expect(getByTestId('organizer-menu-close-button')).toBeTruthy();
});

test('closing the organizer menu returns to the map', async () => {
  mockActiveVoyage('organizer');

  const { getByTestId, queryByTestId } = await render(<ActiveVoyageScreen />);
  await openOrganizerMenu(getByTestId);

  await act(async () => {
    fireEvent.press(getByTestId('organizer-menu-close-button'));
  });

  expect(getByTestId('live-map')).toBeTruthy();
  expect(queryByTestId('end-voyage-button')).toBeNull();
});

test('does not show the End Voyage control for a plain Voyager', async () => {
  mockActiveVoyage('voyager');

  const { getByTestId, queryByTestId } = await render(<ActiveVoyageScreen />);
  await openOrganizerMenu(getByTestId);

  expect(queryByTestId('end-voyage-button')).toBeNull();
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
  mockUseLiveLocations.mockReturnValue({ locations: locationsFixture, trails: {}, isLoading: false, hasError: false, isConnected: false });

  const { rerender } = await render(<ActiveVoyageScreen />);
  // Only the unconditional mount-time flush fires -- isConnected starts
  // false here, so the isConnected-keyed effect does not also fire.
  await waitFor(() => expect(mockOutboxFlush).toHaveBeenCalledTimes(1));

  mockUseLiveLocations.mockReturnValue({ locations: locationsFixture, trails: {}, isLoading: false, hasError: false, isConnected: true });
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
  mockUseLiveLocations.mockReturnValue({ locations: locationsFixture, trails: {}, isLoading: false, hasError: false, isConnected: false });

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
  mockUseLiveLocations.mockReturnValue({ locations: locationsFixture, trails: {}, isLoading: false, hasError: false, isConnected: true });
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
  mockUseLiveLocations.mockReturnValue({ locations: locationsFixture, trails: {}, isLoading: false, hasError: false, isConnected: false });

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
  mockUseLiveLocations.mockReturnValue({ locations: locationsFixture, trails: {}, isLoading: false, hasError: false, isConnected: true });
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

  const { getByTestId, getByText } = await render(<ActiveVoyageScreen />);
  await openOrganizerMenu(getByTestId);

  expect(mockGetVoyageMembers).toHaveBeenCalledWith('voyage-1');
  await waitFor(() => expect(getByText('Chintan')).toBeTruthy());
  expect(getByText('Meera')).toBeTruthy();
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

  const { getByTestId, getByText } = await render(<ActiveVoyageScreen />);
  await openOrganizerMenu(getByTestId);

  await waitFor(() => expect(getByTestId('voyager-list-error')).toBeTruthy());
  expect(getByTestId('voyager-list-retry-button')).toBeTruthy();

  mockGetVoyageMembers.mockResolvedValueOnce({ data: membersFixture, error: null });
  await act(async () => {
    fireEvent.press(getByTestId('voyager-list-retry-button'));
  });

  expect(mockGetVoyageMembers).toHaveBeenCalledTimes(2);
  await waitFor(() => expect(getByText('Chintan')).toBeTruthy());
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
  expect(queryByTestId('grant-organizer-toast')).toBeNull();
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

import { beforeEach, expect, jest, test } from '@jest/globals';
import { act, fireEvent, render, waitFor, within } from '@testing-library/react-native';

import { voyageRepository } from '@/repositories/voyage-repository';
import { useActiveVoyage } from '@/shared/hooks/use-active-voyage';
import { useAuth } from '@/shared/hooks/use-auth';
import { useLiveLocations } from '@/shared/hooks/use-live-locations';

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

const mockEndVoyage = voyageRepository.endVoyage as jest.MockedFunction<typeof voyageRepository.endVoyage>;
const mockGetVoyageMembers = voyageRepository.getVoyageMembers as jest.MockedFunction<typeof voyageRepository.getVoyageMembers>;
const mockGrantOrganizerStatus = voyageRepository.grantOrganizerStatus as jest.MockedFunction<typeof voyageRepository.grantOrganizerStatus>;
const mockRemoveVoyager = voyageRepository.removeVoyager as jest.MockedFunction<typeof voyageRepository.removeVoyager>;
const mockSetTravelRole = voyageRepository.setTravelRole as jest.MockedFunction<typeof voyageRepository.setTravelRole>;
const mockUseActiveVoyage = useActiveVoyage as jest.MockedFunction<typeof useActiveVoyage>;
const mockUseAuth = useAuth as jest.MockedFunction<typeof useAuth>;
const mockUseLiveLocations = useLiveLocations as jest.MockedFunction<typeof useLiveLocations>;
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
  mockUseAuth.mockReturnValue({
    session: { user: { id: 'user-1' } } as any,
    isLoading: false,
    signInWithEmail: jest.fn<(...args: any[]) => Promise<any>>(),
    verifyCode: jest.fn<(...args: any[]) => Promise<any>>(),
    signOut: jest.fn<(...args: any[]) => Promise<any>>(),
  });
  mockUseLiveLocations.mockReturnValue({ locations: locationsFixture, trails: {}, isLoading: false, hasError: false });
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

test('renders a marker for each Voyager with a live location', async () => {
  mockActiveVoyage('organizer');

  const { getByTestId } = await render(<ActiveVoyageScreen />);

  await waitFor(() => expect(getByTestId('voyager-marker-user-1')).toBeTruthy());
  expect(getByTestId('voyager-marker-user-2')).toBeTruthy();
});

test('does not render a marker for a Voyager with no live location yet', async () => {
  mockActiveVoyage('organizer');
  mockUseLiveLocations.mockReturnValue({ locations: { 'user-1': locationsFixture['user-1'] }, trails: {}, isLoading: false, hasError: false });

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

test('shows an inline error when live locations fail to load (code review: not indistinguishable from nobody online)', async () => {
  mockActiveVoyage('organizer');
  mockUseLiveLocations.mockReturnValue({ locations: {}, trails: {}, isLoading: false, hasError: true });

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

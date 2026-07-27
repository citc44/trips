import { beforeEach, expect, jest, test } from '@jest/globals';
import { act, render, waitFor } from '@testing-library/react-native';
import { Text } from 'react-native';

import { ActiveVoyageProvider, useActiveVoyage } from '@/shared/hooks/use-active-voyage';

const mockUseAuth = jest.fn<(...args: any[]) => any>();
jest.mock('@/shared/hooks/use-auth', () => ({
  useAuth: () => mockUseAuth(),
}));

const mockGetMyActiveVoyage = jest.fn<(...args: any[]) => Promise<any>>();
jest.mock('@/repositories/voyage-repository', () => ({
  voyageRepository: {
    getMyActiveVoyage: (...args: unknown[]) => mockGetMyActiveVoyage(...args),
  },
}));

const activeVoyageFixture = {
  voyage: {
    id: 'voyage-1',
    destination: 'Lake Tahoe',
    status: 'active' as const,
    createdBy: 'user-1',
    createdAt: '2026-07-26T00:00:00Z',
    endedAt: null,
    joinCode: 'ABCD2345',
  },
  role: 'organizer' as const,
};

function Probe() {
  const { activeVoyage, isLoading, hasError } = useActiveVoyage();
  return (
    <Text testID="probe">
      {isLoading ? 'loading' : activeVoyage ? `active:${activeVoyage.role}` : hasError ? 'error' : 'none'}
    </Text>
  );
}

function RefetchProbe() {
  const { refetch } = useActiveVoyage();
  return <Text testID="refetch" onPress={() => refetch()} />;
}

beforeEach(() => {
  jest.clearAllMocks();
});

test('resolves to none (not loading) when there is no session', async () => {
  mockUseAuth.mockReturnValue({ session: null });

  const { getByTestId } = await render(
    <ActiveVoyageProvider>
      <Probe />
    </ActiveVoyageProvider>,
  );

  await waitFor(() => expect(getByTestId('probe').props.children).toBe('none'));
  expect(mockGetMyActiveVoyage).not.toHaveBeenCalled();
});

test('fetches and exposes the active Voyage when a session exists', async () => {
  mockUseAuth.mockReturnValue({ session: { user: { id: 'user-1' } } });
  mockGetMyActiveVoyage.mockResolvedValue({ data: activeVoyageFixture, error: null });

  const { getByTestId } = await render(
    <ActiveVoyageProvider>
      <Probe />
    </ActiveVoyageProvider>,
  );

  await waitFor(() => expect(getByTestId('probe').props.children).toBe('active:organizer'));
});

test('resolves to none when the repository reports no active Voyage', async () => {
  mockUseAuth.mockReturnValue({ session: { user: { id: 'user-1' } } });
  mockGetMyActiveVoyage.mockResolvedValue({ data: null, error: null });

  const { getByTestId } = await render(
    <ActiveVoyageProvider>
      <Probe />
    </ActiveVoyageProvider>,
  );

  await waitFor(() => expect(getByTestId('probe').props.children).toBe('none'));
});

test('isLoading goes back to true the moment a session first arrives, not staying stale-false (same Story 1.4 regression class)', async () => {
  mockUseAuth.mockReturnValue({ session: null });

  const { getByTestId, rerender } = await render(
    <ActiveVoyageProvider>
      <Probe />
    </ActiveVoyageProvider>,
  );

  await waitFor(() => expect(getByTestId('probe').props.children).toBe('none'));

  let resolveFetch: (value: any) => void;
  mockGetMyActiveVoyage.mockReturnValue(
    new Promise((resolve) => {
      resolveFetch = resolve;
    }),
  );
  mockUseAuth.mockReturnValue({ session: { user: { id: 'user-1' } } });
  await rerender(
    <ActiveVoyageProvider>
      <Probe />
    </ActiveVoyageProvider>,
  );

  expect(getByTestId('probe').props.children).toBe('loading');

  await act(async () => {
    resolveFetch({ data: activeVoyageFixture, error: null });
  });

  await waitFor(() => expect(getByTestId('probe').props.children).toBe('active:organizer'));
});

test('exposes hasError (not stuck loading) when the fetch rejects', async () => {
  mockUseAuth.mockReturnValue({ session: { user: { id: 'user-1' } } });
  mockGetMyActiveVoyage.mockRejectedValue(new Error('network error'));

  const { getByTestId } = await render(
    <ActiveVoyageProvider>
      <Probe />
    </ActiveVoyageProvider>,
  );

  await waitFor(() => expect(getByTestId('probe').props.children).toBe('error'));
});

test('resets to none when the session goes away (e.g. sign-out)', async () => {
  mockUseAuth.mockReturnValue({ session: { user: { id: 'user-1' } } });
  mockGetMyActiveVoyage.mockResolvedValue({ data: activeVoyageFixture, error: null });

  const { getByTestId, rerender } = await render(
    <ActiveVoyageProvider>
      <Probe />
    </ActiveVoyageProvider>,
  );

  await waitFor(() => expect(getByTestId('probe').props.children).toBe('active:organizer'));

  mockUseAuth.mockReturnValue({ session: null });
  await rerender(
    <ActiveVoyageProvider>
      <Probe />
    </ActiveVoyageProvider>,
  );

  await waitFor(() => expect(getByTestId('probe').props.children).toBe('none'));
});

test('refetch re-pulls and updates the exposed active Voyage', async () => {
  mockUseAuth.mockReturnValue({ session: { user: { id: 'user-1' } } });
  mockGetMyActiveVoyage.mockResolvedValue({ data: activeVoyageFixture, error: null });

  const { getByTestId } = await render(
    <ActiveVoyageProvider>
      <RefetchProbe />
      <Probe />
    </ActiveVoyageProvider>,
  );

  await waitFor(() => expect(getByTestId('probe').props.children).toBe('active:organizer'));

  mockGetMyActiveVoyage.mockResolvedValue({ data: null, error: null });
  await act(async () => {
    await getByTestId('refetch').props.onPress();
  });

  await waitFor(() => expect(getByTestId('probe').props.children).toBe('none'));
});

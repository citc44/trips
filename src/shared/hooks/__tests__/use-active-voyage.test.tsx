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
  const { refetch, clearActiveVoyage, hasError } = useActiveVoyage();
  return (
    <>
      <Text testID="refetch" onPress={() => refetch()} />
      <Text testID="clear" onPress={clearActiveVoyage} />
      <Text testID="refetch-error">{hasError ? 'error' : 'no-error'}</Text>
    </>
  );
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
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
  let refetchResult: unknown;
  await act(async () => {
    refetchResult = await getByTestId('refetch').props.onPress();
  });

  await waitFor(() => expect(getByTestId('probe').props.children).toBe('none'));
  expect(refetchResult).toEqual({ data: null, error: null });
});

test('refetch does not throw (resolves to hasError) when the repository call rejects -- a caller that fires refetch without awaiting/catching must not see an unhandled rejection', async () => {
  mockUseAuth.mockReturnValue({ session: { user: { id: 'user-1' } } });
  mockGetMyActiveVoyage.mockResolvedValueOnce({ data: activeVoyageFixture, error: null });

  const { getByTestId } = await render(
    <ActiveVoyageProvider>
      <RefetchProbe />
      <Probe />
    </ActiveVoyageProvider>,
  );

  await waitFor(() => expect(getByTestId('probe').props.children).toBe('active:organizer'));

  mockGetMyActiveVoyage.mockRejectedValueOnce(new Error('network error'));

  let refetchResult: unknown;
  await expect(
    act(async () => {
      refetchResult = await getByTestId('refetch').props.onPress();
    }),
  ).resolves.not.toThrow();

  // Fails open, matching use-profile.tsx's precedent: a transient refetch
  // error surfaces via hasError but doesn't disruptively clear the
  // last-known-good activeVoyage (which would otherwise kick a legitimately
  // still-active-Voyage user off active-voyage.tsx on a blip).
  await waitFor(() => expect(getByTestId('refetch-error').props.children).toBe('error'));
  expect(getByTestId('probe').props.children).toBe('active:organizer');
  expect(refetchResult).toEqual({ data: null, error: { code: 'unknown', message: 'Something went wrong. Please try again.' } });
});

test('an authoritative local clear cannot be undone by a refetch that began before the leave completed', async () => {
  mockUseAuth.mockReturnValue({ session: { user: { id: 'user-1' } } });
  mockGetMyActiveVoyage.mockResolvedValueOnce({ data: activeVoyageFixture, error: null });

  const { getByTestId } = await render(
    <ActiveVoyageProvider>
      <RefetchProbe />
      <Probe />
    </ActiveVoyageProvider>,
  );
  await waitFor(() => expect(getByTestId('probe').props.children).toBe('active:organizer'));

  const staleFetch = deferred<any>();
  mockGetMyActiveVoyage.mockReturnValueOnce(staleFetch.promise);
  let staleResultPromise!: Promise<any>;
  await act(() => {
    staleResultPromise = getByTestId('refetch').props.onPress();
  });

  await act(() => {
    getByTestId('clear').props.onPress();
  });
  expect(getByTestId('probe').props.children).toBe('none');

  let staleResult: unknown;
  await act(async () => {
    staleFetch.resolve({ data: activeVoyageFixture, error: null });
    staleResult = await staleResultPromise;
  });

  expect(getByTestId('probe').props.children).toBe('none');
  expect(staleResult).toEqual({
    data: null,
    error: { code: 'stale_request', message: 'Active Voyage changed while refreshing. Please try again.' },
  });
});

test('overlapping refetches commit only the newest request even when the older one resolves last', async () => {
  mockUseAuth.mockReturnValue({ session: { user: { id: 'user-1' } } });
  mockGetMyActiveVoyage.mockResolvedValueOnce({ data: activeVoyageFixture, error: null });

  const { getByTestId } = await render(
    <ActiveVoyageProvider>
      <RefetchProbe />
      <Probe />
    </ActiveVoyageProvider>,
  );
  await waitFor(() => expect(getByTestId('probe').props.children).toBe('active:organizer'));

  const olderFetch = deferred<any>();
  const newerFetch = deferred<any>();
  mockGetMyActiveVoyage.mockReturnValueOnce(olderFetch.promise).mockReturnValueOnce(newerFetch.promise);
  let olderResultPromise!: Promise<any>;
  let newerResultPromise!: Promise<any>;
  await act(() => {
    olderResultPromise = getByTestId('refetch').props.onPress();
    newerResultPromise = getByTestId('refetch').props.onPress();
  });

  await act(async () => {
    newerFetch.resolve({ data: null, error: null });
    await newerResultPromise;
  });
  expect(getByTestId('probe').props.children).toBe('none');

  let olderResult: unknown;
  await act(async () => {
    olderFetch.resolve({ data: activeVoyageFixture, error: null });
    olderResult = await olderResultPromise;
  });

  expect(getByTestId('probe').props.children).toBe('none');
  expect(olderResult).toEqual({
    data: null,
    error: { code: 'stale_request', message: 'Active Voyage changed while refreshing. Please try again.' },
  });
});

test('a refetch started for the previous user cannot overwrite the next user active Voyage', async () => {
  mockUseAuth.mockReturnValue({ session: { user: { id: 'user-1' } } });
  mockGetMyActiveVoyage.mockResolvedValueOnce({ data: activeVoyageFixture, error: null });

  const { getByTestId, rerender } = await render(
    <ActiveVoyageProvider>
      <RefetchProbe />
      <Probe />
    </ActiveVoyageProvider>,
  );
  await waitFor(() => expect(getByTestId('probe').props.children).toBe('active:organizer'));

  const previousUserFetch = deferred<any>();
  const nextUserVoyage = {
    ...activeVoyageFixture,
    voyage: { ...activeVoyageFixture.voyage, id: 'voyage-2', createdBy: 'someone-else' },
    role: 'voyager' as const,
  };
  mockGetMyActiveVoyage
    .mockReturnValueOnce(previousUserFetch.promise)
    .mockResolvedValueOnce({ data: nextUserVoyage, error: null });
  let previousUserResultPromise!: Promise<any>;
  await act(() => {
    previousUserResultPromise = getByTestId('refetch').props.onPress();
  });

  mockUseAuth.mockReturnValue({ session: { user: { id: 'user-2' } } });
  await rerender(
    <ActiveVoyageProvider>
      <RefetchProbe />
      <Probe />
    </ActiveVoyageProvider>,
  );
  await waitFor(() => expect(getByTestId('probe').props.children).toBe('active:voyager'));

  let previousUserResult: unknown;
  await act(async () => {
    previousUserFetch.resolve({ data: activeVoyageFixture, error: null });
    previousUserResult = await previousUserResultPromise;
  });

  expect(getByTestId('probe').props.children).toBe('active:voyager');
  expect(previousUserResult).toEqual({
    data: null,
    error: { code: 'stale_request', message: 'Active Voyage changed while refreshing. Please try again.' },
  });
});

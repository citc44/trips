import { beforeEach, expect, jest, test } from '@jest/globals';
import { act, render, waitFor } from '@testing-library/react-native';
import { Text } from 'react-native';

import { AuthProvider, useAuth } from '@/shared/hooks/use-auth';

const mockGetSession = jest.fn<(...args: any[]) => Promise<any>>();
const mockOnAuthStateChange = jest.fn<(...args: any[]) => any>();
const mockUnsubscribe = jest.fn();
const mockSignInWithOtp = jest.fn<(...args: any[]) => Promise<any>>();
const mockVerifyOtp = jest.fn<(...args: any[]) => Promise<any>>();

jest.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: (...args: unknown[]) => mockGetSession(...args),
      onAuthStateChange: (...args: unknown[]) => mockOnAuthStateChange(...args),
      signInWithOtp: (...args: unknown[]) => mockSignInWithOtp(...args),
      verifyOtp: (...args: unknown[]) => mockVerifyOtp(...args),
    },
  },
}));

function Probe() {
  const { session, isLoading } = useAuth();
  return <Text testID="probe">{isLoading ? 'loading' : session ? 'signed-in' : 'signed-out'}</Text>;
}

beforeEach(() => {
  jest.clearAllMocks();
  mockOnAuthStateChange.mockReturnValue({ data: { subscription: { unsubscribe: mockUnsubscribe } } });
});

test('resolves to signed-out when there is no session', async () => {
  mockGetSession.mockResolvedValue({ data: { session: null } });

  const { getByTestId } = await render(
    <AuthProvider>
      <Probe />
    </AuthProvider>,
  );

  await waitFor(() => expect(getByTestId('probe').props.children).toBe('signed-out'));
});

test('resolves to signed-in when getSession returns an existing session', async () => {
  mockGetSession.mockResolvedValue({ data: { session: { user: { id: 'user-1' } } } });

  const { getByTestId } = await render(
    <AuthProvider>
      <Probe />
    </AuthProvider>,
  );

  await waitFor(() => expect(getByTestId('probe').props.children).toBe('signed-in'));
});

test('updates session when onAuthStateChange fires', async () => {
  mockGetSession.mockResolvedValue({ data: { session: null } });

  const { getByTestId } = await render(
    <AuthProvider>
      <Probe />
    </AuthProvider>,
  );

  await waitFor(() => expect(getByTestId('probe').props.children).toBe('signed-out'));

  const onChangeCallback = mockOnAuthStateChange.mock.calls[0][0];
  await act(async () => {
    onChangeCallback('SIGNED_IN', { user: { id: 'user-1' } });
  });

  await waitFor(() => expect(getByTestId('probe').props.children).toBe('signed-in'));
});

test('unsubscribes from onAuthStateChange on unmount', async () => {
  mockGetSession.mockResolvedValue({ data: { session: null } });

  const { getByTestId, unmount } = await render(
    <AuthProvider>
      <Probe />
    </AuthProvider>,
  );

  await waitFor(() => expect(getByTestId('probe').props.children).toBe('signed-out'));

  await unmount();

  expect(mockUnsubscribe).toHaveBeenCalledTimes(1);
});

function ActionsProbe() {
  const { signInWithEmail, verifyCode } = useAuth();
  return (
    <>
      <Text testID="signin" onPress={() => signInWithEmail('a@b.com')} />
      <Text testID="verify" onPress={() => verifyCode('a@b.com', '123456')} />
    </>
  );
}

test('signInWithEmail delegates to supabase.auth.signInWithOtp and returns its error', async () => {
  mockGetSession.mockResolvedValue({ data: { session: null } });
  mockSignInWithOtp.mockResolvedValue({ data: {}, error: null });

  const { getByTestId } = await render(
    <AuthProvider>
      <ActionsProbe />
    </AuthProvider>,
  );

  let result;
  await act(async () => {
    result = await getByTestId('signin').props.onPress();
  });

  expect(mockSignInWithOtp).toHaveBeenCalledWith({ email: 'a@b.com' });
  expect(result).toEqual({ error: null });
});

test('verifyCode delegates to supabase.auth.verifyOtp with type email and returns its error', async () => {
  mockGetSession.mockResolvedValue({ data: { session: null } });
  mockVerifyOtp.mockResolvedValue({ data: {}, error: null });

  const { getByTestId } = await render(
    <AuthProvider>
      <ActionsProbe />
    </AuthProvider>,
  );

  let result;
  await act(async () => {
    result = await getByTestId('verify').props.onPress();
  });

  expect(mockVerifyOtp).toHaveBeenCalledWith({ email: 'a@b.com', token: '123456', type: 'email' });
  expect(result).toEqual({ error: null });
});

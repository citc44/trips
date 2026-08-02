import { beforeEach, expect, jest, test } from '@jest/globals';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';

import SignInScreen from '@/app/sign-in';

const mockPush = jest.fn();
jest.mock('expo-router', () => {
  const actual = jest.requireActual('expo-router') as object;
  return {
    ...actual,
    router: { push: (...args: unknown[]) => mockPush(...args) },
  };
});

const mockSignInWithEmail = jest.fn<() => Promise<any>>();
const mockVerifyCode = jest.fn<() => Promise<any>>();

jest.mock('@/shared/hooks/use-auth', () => ({
  useAuth: () => ({
    signInWithEmail: mockSignInWithEmail,
    verifyCode: mockVerifyCode,
  }),
}));

beforeEach(() => {
  jest.clearAllMocks();
});

type RenderedElement = ReturnType<Awaited<ReturnType<typeof render>>['getByTestId']>;

async function changeText(element: RenderedElement, text: string) {
  await act(async () => {
    fireEvent.changeText(element, text);
  });
}

async function press(element: RenderedElement) {
  await act(async () => {
    fireEvent.press(element);
  });
}

async function getToVerifyStep() {
  mockSignInWithEmail.mockResolvedValue({ error: null });
  const utils = await render(<SignInScreen />);
  await changeText(utils.getByTestId('email-input'), 'chintan@example.com');
  await press(utils.getByTestId('send-code-button'));
  await waitFor(() => expect(utils.queryByTestId('code-input')).toBeTruthy());
  return utils;
}

test('renders the email entry step initially', async () => {
  const { getByTestId, queryByTestId } = await render(<SignInScreen />);
  expect(getByTestId('email-input')).toBeTruthy();
  expect(queryByTestId('code-input')).toBeNull();
});

test('tapping "Have a join code?" navigates to /join -- for someone who received a code with no link to tap', async () => {
  const { getByTestId } = await render(<SignInScreen />);

  fireEvent.press(getByTestId('have-a-join-code-link'));

  expect(mockPush).toHaveBeenCalledWith('/join');
});

test('send-code button is disabled until the email looks valid', async () => {
  const { getByTestId } = await render(<SignInScreen />);
  expect(getByTestId('send-code-button').props.accessibilityState?.disabled).toBe(true);

  await changeText(getByTestId('email-input'), 'not-an-email');
  expect(getByTestId('send-code-button').props.accessibilityState?.disabled).toBe(true);

  await changeText(getByTestId('email-input'), 'chintan@example.com');
  expect(getByTestId('send-code-button').props.accessibilityState?.disabled).toBe(false);
});

test('submitting a valid email calls signInWithEmail and advances to the verify step', async () => {
  const utils = await getToVerifyStep();
  expect(mockSignInWithEmail).toHaveBeenCalledWith('chintan@example.com');
  expect(utils.getByTestId('code-input')).toBeTruthy();
});

test('entering 8 digits auto-submits verifyCode with no separate submit tap', async () => {
  mockVerifyCode.mockResolvedValue({ error: null });
  const { getByTestId } = await getToVerifyStep();

  await changeText(getByTestId('code-input'), '12345678');

  await waitFor(() => expect(mockVerifyCode).toHaveBeenCalledWith('chintan@example.com', '12345678'));
});

test('entering fewer than 8 digits does not submit', async () => {
  const { getByTestId } = await getToVerifyStep();

  await changeText(getByTestId('code-input'), '123456');

  expect(mockVerifyCode).not.toHaveBeenCalled();
});

test('an invalid code clears the field in place and shows an inline error', async () => {
  mockVerifyCode.mockResolvedValue({ error: { message: 'Token has expired or is invalid' } });
  const { getByTestId, queryByTestId } = await getToVerifyStep();

  await changeText(getByTestId('code-input'), '00000000');

  await waitFor(() => expect(queryByTestId('error-message')).toBeTruthy());
  expect(getByTestId('code-input').props.value).toBe('');
});

test('resend is disabled during the 30s cooldown and re-enables after', async () => {
  jest.useFakeTimers();
  mockSignInWithEmail.mockResolvedValue({ error: null });
  const { getByTestId } = await getToVerifyStep();

  expect(getByTestId('resend-button').props.accessibilityState?.disabled).toBe(true);

  await act(async () => {
    jest.advanceTimersByTime(30000);
  });

  expect(getByTestId('resend-button').props.accessibilityState?.disabled).toBe(false);
  jest.useRealTimers();
});

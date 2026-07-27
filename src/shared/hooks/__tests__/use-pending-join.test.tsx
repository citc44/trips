import { expect, test } from '@jest/globals';
import { act, render, waitFor } from '@testing-library/react-native';
import { Text } from 'react-native';

import { PendingJoinProvider, usePendingJoin } from '@/shared/hooks/use-pending-join';

function Probe() {
  const { pendingJoinCode, setPendingJoinCode, clearPendingJoinCode } = usePendingJoin();
  return (
    <>
      <Text testID="value">{pendingJoinCode ?? 'none'}</Text>
      <Text testID="set" onPress={() => setPendingJoinCode('ABCD2345')} />
      <Text testID="clear" onPress={() => clearPendingJoinCode()} />
    </>
  );
}

test('starts with no pending join code', async () => {
  const { getByTestId } = await render(
    <PendingJoinProvider>
      <Probe />
    </PendingJoinProvider>,
  );

  expect(getByTestId('value').props.children).toBe('none');
});

test('setPendingJoinCode stores the code', async () => {
  const { getByTestId } = await render(
    <PendingJoinProvider>
      <Probe />
    </PendingJoinProvider>,
  );

  await act(async () => {
    getByTestId('set').props.onPress();
  });

  await waitFor(() => expect(getByTestId('value').props.children).toBe('ABCD2345'));
});

test('clearPendingJoinCode resets it to null', async () => {
  const { getByTestId } = await render(
    <PendingJoinProvider>
      <Probe />
    </PendingJoinProvider>,
  );

  await act(async () => {
    getByTestId('set').props.onPress();
  });
  await waitFor(() => expect(getByTestId('value').props.children).toBe('ABCD2345'));

  await act(async () => {
    getByTestId('clear').props.onPress();
  });
  await waitFor(() => expect(getByTestId('value').props.children).toBe('none'));
});

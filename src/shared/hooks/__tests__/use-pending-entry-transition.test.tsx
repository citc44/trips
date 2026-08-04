import { expect, test } from '@jest/globals';
import { act, render, waitFor } from '@testing-library/react-native';
import { Text } from 'react-native';

import { PendingEntryTransitionProvider, usePendingEntryTransition } from '@/shared/hooks/use-pending-entry-transition';

function Probe() {
  const { hasPendingEntryTransition, triggerEntryTransition, consumeEntryTransition } = usePendingEntryTransition();
  return (
    <>
      <Text testID="value">{hasPendingEntryTransition ? 'true' : 'false'}</Text>
      <Text testID="trigger" onPress={() => triggerEntryTransition()} />
      <Text testID="consume" onPress={() => consumeEntryTransition()} />
    </>
  );
}

test('starts false', async () => {
  const { getByTestId } = await render(
    <PendingEntryTransitionProvider>
      <Probe />
    </PendingEntryTransitionProvider>,
  );

  expect(getByTestId('value').props.children).toBe('false');
});

test('triggerEntryTransition flips it to true', async () => {
  const { getByTestId } = await render(
    <PendingEntryTransitionProvider>
      <Probe />
    </PendingEntryTransitionProvider>,
  );

  await act(async () => {
    getByTestId('trigger').props.onPress();
  });

  await waitFor(() => expect(getByTestId('value').props.children).toBe('true'));
});

test('consumeEntryTransition resets it to false', async () => {
  const { getByTestId } = await render(
    <PendingEntryTransitionProvider>
      <Probe />
    </PendingEntryTransitionProvider>,
  );

  await act(async () => {
    getByTestId('trigger').props.onPress();
  });
  await waitFor(() => expect(getByTestId('value').props.children).toBe('true'));

  await act(async () => {
    getByTestId('consume').props.onPress();
  });
  await waitFor(() => expect(getByTestId('value').props.children).toBe('false'));
});

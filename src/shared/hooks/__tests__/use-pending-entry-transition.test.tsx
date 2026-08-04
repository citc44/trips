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

// Regression coverage, same reasoning as use-just-started-voyage.test.tsx's
// own identity-stability test: unmemoized callbacks here would cause the
// same class of spurious effect churn in any consumer that keys an effect's
// dependency array off triggerEntryTransition/consumeEntryTransition.
test('triggerEntryTransition and consumeEntryTransition keep a stable identity across state changes', async () => {
  const identities: { trigger: (() => void)[]; consume: (() => void)[] } = { trigger: [], consume: [] };

  function IdentityProbe() {
    const { triggerEntryTransition, consumeEntryTransition } = usePendingEntryTransition();
    identities.trigger.push(triggerEntryTransition);
    identities.consume.push(consumeEntryTransition);
    return null;
  }

  const { getByTestId } = await render(
    <PendingEntryTransitionProvider>
      <Probe />
      <IdentityProbe />
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

  expect(identities.trigger.length).toBeGreaterThanOrEqual(3);
  expect(new Set(identities.trigger).size).toBe(1);
  expect(new Set(identities.consume).size).toBe(1);
});

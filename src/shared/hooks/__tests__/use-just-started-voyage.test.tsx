import { expect, test } from '@jest/globals';
import { act, render, waitFor } from '@testing-library/react-native';
import { Text } from 'react-native';

import { JustStartedVoyageProvider, useJustStartedVoyage } from '@/shared/hooks/use-just-started-voyage';

function Probe() {
  const { hasJustStartedVoyage, markVoyageStarted, clearJustStartedVoyage } = useJustStartedVoyage();
  return (
    <>
      <Text testID="value">{hasJustStartedVoyage ? 'true' : 'false'}</Text>
      <Text testID="mark" onPress={() => markVoyageStarted()} />
      <Text testID="clear" onPress={() => clearJustStartedVoyage()} />
    </>
  );
}

test('starts false', async () => {
  const { getByTestId } = await render(
    <JustStartedVoyageProvider>
      <Probe />
    </JustStartedVoyageProvider>,
  );

  expect(getByTestId('value').props.children).toBe('false');
});

test('markVoyageStarted flips it to true', async () => {
  const { getByTestId } = await render(
    <JustStartedVoyageProvider>
      <Probe />
    </JustStartedVoyageProvider>,
  );

  await act(async () => {
    getByTestId('mark').props.onPress();
  });

  await waitFor(() => expect(getByTestId('value').props.children).toBe('true'));
});

test('clearJustStartedVoyage resets it to false', async () => {
  const { getByTestId } = await render(
    <JustStartedVoyageProvider>
      <Probe />
    </JustStartedVoyageProvider>,
  );

  await act(async () => {
    getByTestId('mark').props.onPress();
  });
  await waitFor(() => expect(getByTestId('value').props.children).toBe('true'));

  await act(async () => {
    getByTestId('clear').props.onPress();
  });
  await waitFor(() => expect(getByTestId('value').props.children).toBe('false'));
});

// Regression coverage for a confirmed production bug: unmemoized,
// markVoyageStarted/clearJustStartedVoyage were new function identities on
// every provider render. join-code.tsx's own unmount-cleanup effect keys its
// dependency array on clearJustStartedVoyage -- an unstable identity meant
// that effect's cleanup (which itself calls clearJustStartedVoyage() again)
// fired as a *second*, overlapping update immediately after the Continue
// button's own explicit call, right as _layout.tsx's guard needed a single
// clean re-evaluation to admit active-voyage.tsx. Users reported being stuck
// on join-code.tsx after tapping Continue, needing to force-quit and
// relaunch to reach the live map.
test('markVoyageStarted and clearJustStartedVoyage keep a stable identity across state changes (regression: previously a new function every render, causing spurious effect churn in consumers keying off it)', async () => {
  const identities: { mark: (() => void)[]; clear: (() => void)[] } = { mark: [], clear: [] };

  function IdentityProbe() {
    const { markVoyageStarted, clearJustStartedVoyage } = useJustStartedVoyage();
    identities.mark.push(markVoyageStarted);
    identities.clear.push(clearJustStartedVoyage);
    return null;
  }

  const { getByTestId } = await render(
    <JustStartedVoyageProvider>
      <Probe />
      <IdentityProbe />
    </JustStartedVoyageProvider>,
  );

  await act(async () => {
    getByTestId('mark').props.onPress();
  });
  await waitFor(() => expect(getByTestId('value').props.children).toBe('true'));

  await act(async () => {
    getByTestId('clear').props.onPress();
  });
  await waitFor(() => expect(getByTestId('value').props.children).toBe('false'));

  expect(identities.mark.length).toBeGreaterThanOrEqual(3);
  expect(new Set(identities.mark).size).toBe(1);
  expect(new Set(identities.clear).size).toBe(1);
});

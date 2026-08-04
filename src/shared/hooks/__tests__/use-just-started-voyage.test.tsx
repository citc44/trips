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

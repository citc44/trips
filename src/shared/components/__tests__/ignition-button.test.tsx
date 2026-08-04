import { expect, jest, test } from '@jest/globals';
import { fireEvent, render } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';

import { WayfinderButtonIgnitionInverse, WayfinderButtonSecondary, WayfinderColors } from '@/constants/design-tokens';

import { IgnitionButton } from '../ignition-button';

// No dedicated test file existed for this component before Story 4.4 --
// it was only ever exercised indirectly through each screen's own test
// file. Story 4.4 restructures its variant set significantly (new
// "inverse"/"text" variants, "secondary" changing meaning from a plain
// text link to a bordered pill), so this file covers the component
// directly rather than relying solely on indirect screen-level coverage.

test('primary (default) variant presses call onPress and are not disabled by default', async () => {
  const onPress = jest.fn();
  const { getByTestId } = await render(<IgnitionButton testID="btn" label="Go" disabled={false} onPress={onPress} />);

  fireEvent.press(getByTestId('btn'));

  expect(onPress).toHaveBeenCalledTimes(1);
  expect(getByTestId('btn').props.accessibilityState?.disabled).toBe(false);
});

test('primary variant disabled state does not call onPress', async () => {
  const onPress = jest.fn();
  const { getByTestId } = await render(<IgnitionButton testID="btn" label="Go" disabled onPress={onPress} />);

  fireEvent.press(getByTestId('btn'));

  expect(onPress).not.toHaveBeenCalled();
  expect(getByTestId('btn').props.accessibilityState?.disabled).toBe(true);
});

test('secondary variant renders the new bordered "fog-fill" pill (Story 4.4 -- not the old plain text link)', async () => {
  const { getByTestId } = await render(<IgnitionButton testID="btn" label="Go" disabled={false} onPress={() => {}} variant="secondary" />);

  const flatStyle = StyleSheet.flatten(getByTestId('btn').props.style);
  expect(flatStyle.backgroundColor).toBe(WayfinderButtonSecondary.background);
  expect(flatStyle.borderWidth).toBe(WayfinderButtonSecondary.borderWidth);
});

test('text variant renders as a plain low-emphasis text control, not a bordered/filled button', async () => {
  const onPress = jest.fn();
  const { getByTestId } = await render(<IgnitionButton testID="btn" label="Go" disabled={false} onPress={onPress} variant="text" />);

  fireEvent.press(getByTestId('btn'));

  expect(onPress).toHaveBeenCalledTimes(1);
  const flatStyle = StyleSheet.flatten(getByTestId('btn').props.style);
  expect(flatStyle.backgroundColor).toBeUndefined();
  expect(flatStyle.color).toBe(WayfinderColors.inkSecondary);
});

test('text variant disabled does not call onPress', async () => {
  const onPress = jest.fn();
  const { getByTestId } = await render(<IgnitionButton testID="btn" label="Go" disabled onPress={onPress} variant="text" />);

  fireEvent.press(getByTestId('btn'));

  expect(onPress).not.toHaveBeenCalled();
});

test('inverse variant renders white-fill/accent-primary-label (Story 4.4 -- Voyage Intro/Join Invitation only)', async () => {
  const { getByTestId } = await render(<IgnitionButton testID="btn" label="Go" disabled={false} onPress={() => {}} variant="inverse" />);

  const flatStyle = StyleSheet.flatten(getByTestId('btn').props.style);
  expect(flatStyle.backgroundColor).toBe(WayfinderButtonIgnitionInverse.background);
});

test('destructive variant renders and responds to press', async () => {
  const onPress = jest.fn();
  const { getByTestId } = await render(<IgnitionButton testID="btn" label="Remove" disabled={false} onPress={onPress} variant="destructive" />);

  fireEvent.press(getByTestId('btn'));

  expect(onPress).toHaveBeenCalledTimes(1);
});

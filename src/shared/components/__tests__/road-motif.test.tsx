import { expect, test } from '@jest/globals';
import { render } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';

import { RoadMotif } from '../road-motif';

test('renders, purely decorative -- not interactive (pointerEvents="none")', async () => {
  const { getByTestId } = await render(<RoadMotif rotateDeg={9} />);

  const node = getByTestId('road-motif');
  expect(node).toBeTruthy();
  expect(node.props.pointerEvents).toBe('none');
});

test('rotates by the given degree', async () => {
  const { getByTestId } = await render(<RoadMotif rotateDeg={-8} />);

  const flattened = StyleSheet.flatten(getByTestId('road-motif').props.style);
  expect(flattened.transform).toEqual([{ rotate: '-8deg' }]);
});

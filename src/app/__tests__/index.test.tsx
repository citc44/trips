import { expect, test } from '@jest/globals';
import { render } from '@testing-library/react-native';

import HomeScreen from '@/app/index';

test('renders a link to Settings', async () => {
  const { getByTestId } = await render(<HomeScreen />);

  expect(getByTestId('settings-link').props.href).toBe('/settings');
});

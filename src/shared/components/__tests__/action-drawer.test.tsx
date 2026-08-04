import { afterEach, beforeEach, expect, jest, test } from '@jest/globals';
import { act, fireEvent, render } from '@testing-library/react-native';
import { BackHandler, Platform, Text } from 'react-native';
import mockSafeAreaContext from 'react-native-safe-area-context/jest/mock';

import { ActionDrawerMotion } from '@/constants/design-tokens';

import { ActionDrawer } from '../action-drawer';

// Official RNSAC mock -- useSafeAreaInsets() throws without a real
// <SafeAreaProvider> ancestor, which this test harness doesn't render
// (same setup as active-voyage.test.tsx).
jest.mock('react-native-safe-area-context', () => mockSafeAreaContext);

beforeEach(() => {
  jest.useFakeTimers();
});

afterEach(() => {
  jest.useRealTimers();
});

test('renders children immediately when visible -- no animation delay on open', async () => {
  const { getByText } = await render(
    <ActionDrawer visible reduceMotion={false} onClose={() => {}}>
      <Text>Voyage actions</Text>
    </ActionDrawer>,
  );

  expect(getByText('Voyage actions')).toBeTruthy();
});

test('renders nothing when never opened', async () => {
  const { queryByText } = await render(
    <ActionDrawer visible={false} reduceMotion={false} onClose={() => {}}>
      <Text>Voyage actions</Text>
    </ActionDrawer>,
  );

  expect(queryByText('Voyage actions')).toBeNull();
});

test('tapping the scrim calls onClose', async () => {
  const onClose = jest.fn();
  const { getByTestId } = await render(
    <ActionDrawer visible reduceMotion={false} onClose={onClose}>
      <Text>Voyage actions</Text>
    </ActionDrawer>,
  );

  await act(async () => {
    fireEvent.press(getByTestId('action-drawer-scrim'));
  });

  expect(onClose).toHaveBeenCalledTimes(1);
});

test('tapping the close button calls onClose', async () => {
  const onClose = jest.fn();
  const { getByTestId } = await render(
    <ActionDrawer visible reduceMotion={false} onClose={onClose}>
      <Text>Voyage actions</Text>
    </ActionDrawer>,
  );

  await act(async () => {
    fireEvent.press(getByTestId('action-drawer-close-button'));
  });

  expect(onClose).toHaveBeenCalledTimes(1);
});

test('a custom closeButtonTestID overrides the default (Story 4.2: active-voyage.tsx keeps the legacy organizer-menu-close-button id)', async () => {
  const { getByTestId } = await render(
    <ActionDrawer visible reduceMotion={false} onClose={() => {}} closeButtonTestID="organizer-menu-close-button">
      <Text>Voyage actions</Text>
    </ActionDrawer>,
  );

  expect(getByTestId('organizer-menu-close-button')).toBeTruthy();
});

test('content stays mounted through the close animation duration, then unmounts', async () => {
  const { queryByText, rerender } = await render(
    <ActionDrawer visible reduceMotion={false} onClose={() => {}}>
      <Text>Voyage actions</Text>
    </ActionDrawer>,
  );

  await act(async () => {
    rerender(
      <ActionDrawer visible={false} reduceMotion={false} onClose={() => {}}>
        <Text>Voyage actions</Text>
      </ActionDrawer>,
    );
  });

  // Still mounted immediately after visible flips false -- the animation
  // hasn't finished yet.
  expect(queryByText('Voyage actions')).toBeTruthy();

  await act(async () => {
    jest.advanceTimersByTime(ActionDrawerMotion.panelDurationMs - 1);
  });
  expect(queryByText('Voyage actions')).toBeTruthy();

  await act(async () => {
    jest.advanceTimersByTime(1);
  });
  expect(queryByText('Voyage actions')).toBeNull();
});

test('under Reduce Motion, content unmounts immediately on close -- no delay', async () => {
  const { queryByText, rerender } = await render(
    <ActionDrawer visible reduceMotion onClose={() => {}}>
      <Text>Voyage actions</Text>
    </ActionDrawer>,
  );

  await act(async () => {
    rerender(
      <ActionDrawer visible={false} reduceMotion onClose={() => {}}>
        <Text>Voyage actions</Text>
      </ActionDrawer>,
    );
  });

  expect(queryByText('Voyage actions')).toBeNull();
});

test('re-opening after a close cancels the pending unmount timer -- content stays mounted, not briefly flashing closed', async () => {
  const { queryByText, rerender } = await render(
    <ActionDrawer visible reduceMotion={false} onClose={() => {}}>
      <Text>Voyage actions</Text>
    </ActionDrawer>,
  );

  await act(async () => {
    rerender(
      <ActionDrawer visible={false} reduceMotion={false} onClose={() => {}}>
        <Text>Voyage actions</Text>
      </ActionDrawer>,
    );
  });
  await act(async () => {
    rerender(
      <ActionDrawer visible reduceMotion={false} onClose={() => {}}>
        <Text>Voyage actions</Text>
      </ActionDrawer>,
    );
  });

  // The close timer scheduled by the first rerender must not fire and
  // unmount content that's now supposed to be open again.
  await act(async () => {
    jest.advanceTimersByTime(ActionDrawerMotion.panelDurationMs);
  });
  expect(queryByText('Voyage actions')).toBeTruthy();
});

test('onClosed does not fire the instant visible flips false -- only once the close animation actually finishes', async () => {
  const onClosed = jest.fn();
  const { rerender } = await render(
    <ActionDrawer visible reduceMotion={false} onClose={() => {}} onClosed={onClosed}>
      <Text>Voyage actions</Text>
    </ActionDrawer>,
  );

  await act(async () => {
    rerender(
      <ActionDrawer visible={false} reduceMotion={false} onClose={() => {}} onClosed={onClosed}>
        <Text>Voyage actions</Text>
      </ActionDrawer>,
    );
  });
  expect(onClosed).not.toHaveBeenCalled();

  await act(async () => {
    jest.advanceTimersByTime(ActionDrawerMotion.panelDurationMs - 1);
  });
  expect(onClosed).not.toHaveBeenCalled();

  await act(async () => {
    jest.advanceTimersByTime(1);
  });
  expect(onClosed).toHaveBeenCalledTimes(1);
});

test('under Reduce Motion, onClosed fires immediately (no delay) alongside the instant unmount', async () => {
  const onClosed = jest.fn();
  const { rerender } = await render(
    <ActionDrawer visible reduceMotion onClose={() => {}} onClosed={onClosed}>
      <Text>Voyage actions</Text>
    </ActionDrawer>,
  );

  await act(async () => {
    rerender(
      <ActionDrawer visible={false} reduceMotion onClose={() => {}} onClosed={onClosed}>
        <Text>Voyage actions</Text>
      </ActionDrawer>,
    );
  });

  expect(onClosed).toHaveBeenCalledTimes(1);
});

test('the scrim is not independently exposed to screen readers -- the dedicated close button already covers dismissal accessibly', async () => {
  const { getByTestId } = await render(
    <ActionDrawer visible reduceMotion={false} onClose={() => {}}>
      <Text>Voyage actions</Text>
    </ActionDrawer>,
  );

  expect(getByTestId('action-drawer-scrim').props.accessible).toBe(false);
});

test('the scrim is pass-through (pointerEvents "none") once a close is requested, not only after the fade finishes', async () => {
  const { getByTestId, rerender } = await render(
    <ActionDrawer visible reduceMotion={false} onClose={() => {}}>
      <Text>Voyage actions</Text>
    </ActionDrawer>,
  );
  expect(getByTestId('action-drawer-scrim').props.pointerEvents).toBe('auto');

  await act(async () => {
    rerender(
      <ActionDrawer visible={false} reduceMotion={false} onClose={() => {}}>
        <Text>Voyage actions</Text>
      </ActionDrawer>,
    );
  });

  // Still mounted (mid close-animation, hasn't hit its unmount timer yet),
  // but must already be pass-through so touches on the map/HUD underneath
  // land immediately rather than waiting out the ~260ms fade.
  expect(getByTestId('action-drawer-scrim').props.pointerEvents).toBe('none');
});

test('the drawer (scrim + panel together) is marked as a modal for screen readers (iOS)', async () => {
  const { getByTestId } = await render(
    <ActionDrawer visible reduceMotion={false} onClose={() => {}}>
      <Text>Voyage actions</Text>
    </ActionDrawer>,
  );

  expect(getByTestId('action-drawer-root').props.accessibilityViewIsModal).toBe(true);
});

test('Android hardware back button closes the drawer while it is open', async () => {
  const originalOS = Platform.OS;
  Platform.OS = 'android';
  const onClose = jest.fn();
  // No built-in mockPressBack helper in this project's RN test environment
  // -- capture the registered listener directly and invoke it, same effect.
  const addListenerSpy = jest.spyOn(BackHandler, 'addEventListener');

  try {
    await render(
      <ActionDrawer visible reduceMotion={false} onClose={onClose}>
        <Text>Voyage actions</Text>
      </ActionDrawer>,
    );

    expect(addListenerSpy).toHaveBeenCalledWith('hardwareBackPress', expect.any(Function));
    const registeredHandler = addListenerSpy.mock.calls[0][1] as () => boolean;
    const handled = registeredHandler();

    expect(handled).toBe(true);
    expect(onClose).toHaveBeenCalledTimes(1);
  } finally {
    Platform.OS = originalOS;
    addListenerSpy.mockRestore();
  }
});

test('does not register an Android back-button listener while closed', async () => {
  const originalOS = Platform.OS;
  Platform.OS = 'android';
  const addListenerSpy = jest.spyOn(BackHandler, 'addEventListener');

  try {
    await render(
      <ActionDrawer visible={false} reduceMotion={false} onClose={() => {}}>
        <Text>Voyage actions</Text>
      </ActionDrawer>,
    );

    expect(addListenerSpy).not.toHaveBeenCalled();
  } finally {
    Platform.OS = originalOS;
    addListenerSpy.mockRestore();
  }
});

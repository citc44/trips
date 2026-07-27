import { useEffect, useRef } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { NudgeToast, Spacing, Typography } from '@/constants/design-tokens';

const AUTO_DISMISS_MS = 4000;

// Minimal nudge-toast (DESIGN.md#Components) -- no swipe-to-dismiss gesture
// (Story 2.5's interim-scope note: wiring a new gesture handler for one
// instance is out of scope here). Auto-dismisses after ~4s. Reusable as-is
// for future v1.1 nudges (long-stop, zero-contribution), not one-off to
// Grant Organizer's confirmation.
export function Toast({ testID, message, onDismiss }: { testID?: string; message: string; onDismiss: () => void }) {
  // A ref, not a direct effect dependency: callers commonly pass an inline
  // arrow function (e.g. onDismiss={() => setToastMessage(null)}), which is a
  // new identity every render. Depending on it directly would restart the
  // timer on any unrelated re-render while the toast is visible, silently
  // extending its lifetime well past ~4s (code review finding). Only `message`
  // changing should restart the window.
  const onDismissRef = useRef(onDismiss);
  useEffect(() => {
    onDismissRef.current = onDismiss;
  }, [onDismiss]);

  useEffect(() => {
    const timeout = setTimeout(() => onDismissRef.current(), AUTO_DISMISS_MS);
    return () => clearTimeout(timeout);
  }, [message]);

  return (
    <View testID={testID} style={styles.container} accessibilityRole="alert" accessibilityLiveRegion="polite">
      <View style={styles.accentBar} />
      <Text style={styles.message}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: NudgeToast.background,
    borderRadius: NudgeToast.radius,
    paddingVertical: Spacing['3'],
    paddingHorizontal: Spacing['4'],
    gap: Spacing['3'],
  },
  accentBar: {
    width: 3,
    alignSelf: 'stretch',
    borderRadius: Spacing['1'],
    backgroundColor: NudgeToast.accentBar,
  },
  message: {
    flex: 1,
    color: NudgeToast.foreground,
    fontFamily: Typography.body.fontFamily,
    fontSize: 14,
  },
});

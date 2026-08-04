import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { Animated, BackHandler, Easing, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ActionDrawer as ActionDrawerTokens, ActionDrawerMotion } from '@/constants/design-tokens';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

/**
 * action-drawer (DESIGN.md#components, Story 4.2) -- replaces v1's
 * organizer-sheet. Slides in from the right over whatever's behind it (the
 * caller keeps its own content mounted; this is an overlay, not a route
 * swap) with a solid scrim fading in behind it.
 *
 * Stays mounted through its own close animation -- `visible={false}` still
 * renders (and animates out) for `ActionDrawerMotion.panelDurationMs` before
 * actually unmounting, so the slide/fade is visible rather than an instant
 * cut. Opening has no such delay: content is mounted immediately when
 * `visible` becomes true, so callers querying for drawer content right
 * after opening it don't need to wait for the animation.
 *
 * `onClose` fires the instant a close is requested (tap, scrim, Android
 * back) -- callers should only flip `visible` here, not reset any of the
 * drawer's own step-level state (e.g. which confirm step is showing),
 * otherwise `children` recomputes mid-animation and visibly flashes to a
 * different step while the panel is still sliding out (code review
 * finding). `onClosed` fires once the close animation has actually
 * finished (right before content unmounts) -- do step-level resets there
 * instead.
 *
 * Reduce Motion skips the animation entirely in both directions -- the
 * drawer appears/disappears instantly (EXPERIENCE.md#Motion & Transitions).
 */
export function ActionDrawer({
  visible,
  onClose,
  onClosed,
  reduceMotion,
  closeButtonTestID = 'action-drawer-close-button',
  scrimTestID = 'action-drawer-scrim',
  children,
}: {
  visible: boolean;
  onClose: () => void;
  onClosed?: () => void;
  reduceMotion: boolean;
  closeButtonTestID?: string;
  scrimTestID?: string;
  children: ReactNode;
}) {
  const insets = useSafeAreaInsets();
  const [isRendered, setIsRendered] = useState(visible);
  // useState's lazy initializer (not useRef(...).current) -- same
  // react-hooks/refs-safe pattern this codebase already uses for the map
  // marker's pulse Animated.Value (active-voyage.tsx). Panel and scrim are
  // independent values -- they're timed differently (see ActionDrawerMotion).
  const [panelProgress] = useState(() => new Animated.Value(visible ? 1 : 0));
  const [scrimOpacity] = useState(() => new Animated.Value(visible ? 1 : 0));
  const closeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Ref, not a direct effect dependency -- callers commonly pass an inline
  // arrow function, a new identity every render (same reasoning as
  // toast.tsx's onDismissRef). Only visible/reduceMotion changing should
  // restart this effect.
  const onClosedRef = useRef(onClosed);
  useEffect(() => {
    onClosedRef.current = onClosed;
  });

  useEffect(() => {
    if (closeTimeoutRef.current) {
      clearTimeout(closeTimeoutRef.current);
      closeTimeoutRef.current = null;
    }

    let isEffectMounted = true;

    if (visible) {
      // Mount immediately -- no delay on open, only close (below) is
      // delayed. Deferred via a microtask (not called synchronously in the
      // effect body) so this satisfies react-hooks/set-state-in-effect,
      // matching this codebase's established pattern for the same rule
      // (e.g. use-live-locations.tsx's voyageId-change reset).
      Promise.resolve().then(() => {
        if (isEffectMounted) setIsRendered(true);
      });
      if (reduceMotion) {
        panelProgress.setValue(1);
        scrimOpacity.setValue(1);
      } else {
        Animated.timing(panelProgress, {
          toValue: 1,
          duration: ActionDrawerMotion.panelDurationMs,
          easing: Easing.bezier(...ActionDrawerMotion.panelEasing),
          useNativeDriver: true,
        }).start();
        Animated.timing(scrimOpacity, {
          toValue: 1,
          duration: ActionDrawerMotion.scrimDurationMs,
          easing: Easing.bezier(...ActionDrawerMotion.scrimEasing),
          useNativeDriver: true,
        }).start();
      }
      return () => {
        isEffectMounted = false;
      };
    }

    if (reduceMotion) {
      panelProgress.setValue(0);
      scrimOpacity.setValue(0);
      Promise.resolve().then(() => {
        if (!isEffectMounted) return;
        setIsRendered(false);
        onClosedRef.current?.();
      });
      return () => {
        isEffectMounted = false;
      };
    }

    Animated.timing(panelProgress, {
      toValue: 0,
      duration: ActionDrawerMotion.panelDurationMs,
      easing: Easing.bezier(...ActionDrawerMotion.panelEasing),
      useNativeDriver: true,
    }).start();
    Animated.timing(scrimOpacity, {
      toValue: 0,
      duration: ActionDrawerMotion.scrimDurationMs,
      easing: Easing.bezier(...ActionDrawerMotion.scrimEasing),
      useNativeDriver: true,
    }).start();
    // Unmount only after the LONGER of the two animations (the panel slide,
    // 280ms vs. the scrim's 260ms) -- keeps both visible for their full
    // duration instead of either getting cut off. Already inside a
    // setTimeout callback, not the effect body itself, so this setState
    // doesn't need the same microtask deferral as the two above.
    closeTimeoutRef.current = setTimeout(() => {
      setIsRendered(false);
      onClosedRef.current?.();
    }, ActionDrawerMotion.panelDurationMs);

    return () => {
      isEffectMounted = false;
      if (closeTimeoutRef.current) {
        clearTimeout(closeTimeoutRef.current);
        closeTimeoutRef.current = null;
      }
    };
  }, [visible, reduceMotion, panelProgress, scrimOpacity]);

  // Android hardware back button closes the drawer (and consumes the
  // event) while it's open, instead of falling through to the screen's own
  // back navigation -- standard platform expectation for a modal-like
  // overlay built to replace what used to be a route-level screen.
  useEffect(() => {
    if (Platform.OS !== 'android' || !visible) return;
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      onClose();
      return true;
    });
    return () => subscription.remove();
  }, [visible, onClose]);

  if (!isRendered) return null;

  const translateX = panelProgress.interpolate({ inputRange: [0, 1], outputRange: [ActionDrawerTokens.width, 0] });

  return (
    // The map/HUD stay mounted behind this drawer by design (that's the
    // whole point of Story 4.2) -- accessibilityViewIsModal (iOS) tells
    // VoiceOver to stop a swipe-navigation from reaching that still-mounted,
    // visually-covered content instead of the drawer itself (code review
    // finding). It has to sit on a wrapper around BOTH the scrim and the
    // panel, not the panel alone -- VoiceOver (and RNTL's own accessibility-
    // aware queries, which model the same rule) treat every *sibling* of an
    // accessibilityViewIsModal element as hidden too, which would make the
    // scrim itself unreachable. The Android half of this (hiding the
    // background from TalkBack) is handled by the caller, which owns that
    // content. Gated on `visible` directly, not `isRendered` -- the same
    // reasoning as the scrim's `pointerEvents` above: once a close is
    // requested, sibling content (e.g. a toast confirming the action that
    // triggered the close) must be reachable again immediately, not only
    // after the ~280ms close animation finishes.
    <View testID="action-drawer-root" accessibilityViewIsModal={visible} style={StyleSheet.absoluteFill}>
      <AnimatedPressable
        testID={scrimTestID}
        // Not independently exposed to screen readers -- the dedicated close
        // button below already covers "dismiss the drawer" accessibly; two
        // controls sharing the same label would be confusing to navigate
        // between (code review finding).
        accessible={false}
        onPress={onClose}
        // Gated on `visible` directly, not the animation's own progress --
        // touches on the map/HUD underneath must pass through immediately
        // once a close is requested, not only after the fade finishes
        // ~260ms later (code review finding).
        pointerEvents={visible ? 'auto' : 'none'}
        style={[styles.scrim, { opacity: scrimOpacity }]}
      />
      <Animated.View
        testID="action-drawer-panel"
        style={[
          styles.panel,
          {
            paddingTop: insets.top + 30,
            paddingBottom: insets.bottom + 30,
            paddingRight: insets.right + 18,
            transform: [{ translateX }],
          },
        ]}
      >
        <Pressable
          testID={closeButtonTestID}
          accessibilityRole="button"
          accessibilityLabel="Close menu"
          onPress={onClose}
          style={({ pressed }) => [styles.closeButton, pressed && styles.pressedScale]}
        >
          <Text style={styles.closeButtonLabel}>{'✕'}</Text>
        </Pressable>
        {children}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  scrim: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: ActionDrawerTokens.scrimColor,
    zIndex: 20,
  },
  panel: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    right: 0,
    width: ActionDrawerTokens.width,
    backgroundColor: ActionDrawerTokens.background,
    paddingLeft: 18,
    zIndex: 21,
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: ActionDrawerTokens.rowBackground,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 22,
  },
  pressedScale: {
    transform: [{ scale: 0.9 }],
  },
  closeButtonLabel: {
    color: ActionDrawerTokens.ink,
    fontWeight: '700',
    fontSize: 16,
  },
});

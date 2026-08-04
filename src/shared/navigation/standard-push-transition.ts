import type { StackAnimationTypes } from 'react-native-screens';

/**
 * Story 4.4 Task 11's "Standard push" transition, extracted so it can be unit
 * tested directly without rendering Stack/expo-router at all -- same reasoning
 * `resolve-route.ts` already established for _layout.tsx's routing guards.
 *
 * Scoped to exactly the 8 screens Story 4.4 re-skinned (AC #3's "within this
 * set"); every other screen (active-voyage, join-code, voyage-joined,
 * location-permission, settings, voyage-removed, display-name, join/index,
 * etc.) keeps its current unset/default transition, deliberately excluded.
 */
export const STANDARD_PUSH_SCREENS = [
  'sign-in',
  'trust-moment',
  'driver-attention-consent',
  'index',
  'voyage-intro',
  'destination-picker',
  'join/[code]',
  'voyage-ended',
] as const;

/**
 * EXPERIENCE.md's literal spec (28px slide + fade in/out, 360ms,
 * `cubic-bezier(.22,.85,.35,1)` enter / `cubic-bezier(.5,0,.75,.15)` exit)
 * isn't achievable here: Expo Router's Stack is built on react-native-screens'
 * *native* stack, whose `animation` option is a fixed preset enum
 * (`StackAnimationTypes`) with no custom-duration/easing/pixel-offset escape
 * hatch, unlike the JS-based `@react-navigation/stack`'s
 * `cardStyleInterpolator`/`transitionSpec`. [ASSUMPTION]: using the closest
 * built-in preset, `slide_from_right`, which correctly reverses to a
 * slide-back on backward navigation -- the part of the spec EXPERIENCE.md
 * itself treats as most important to preserve. This is a real approximation
 * of the timing curve, not full fidelity to the spec's literal values.
 */
export function getStandardPushTransition(reduceMotion: boolean): { animation: StackAnimationTypes } {
  return { animation: reduceMotion ? 'none' : 'slide_from_right' };
}

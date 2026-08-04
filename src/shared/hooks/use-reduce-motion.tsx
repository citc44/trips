import { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';

/**
 * Shared Reduce Motion detection -- pattern established by active-voyage.tsx,
 * then duplicated near-verbatim (without the `resolved` race-guard below)
 * into _layout.tsx and horizon-strip.tsx during Story 4.4; extracted here by
 * that story's own code review to fix the duplication and the missing guard
 * in one place.
 *
 * `resolved` stays false until the initial `isReduceMotionEnabled()` call
 * lands. Callers gating an animation should treat "not yet resolved" the
 * same as "Reduce Motion is on" (e.g. `!resolved || reduceMotion`) -- the
 * `reduceMotion` state alone defaults to `false`, so gating on it by itself
 * would let a Reduce-Motion user see one frame of motion before the real
 * value resolves (active-voyage.tsx's own original reasoning for why it
 * carries this same two-flag shape).
 */
export function useReduceMotion() {
  const [reduceMotion, setReduceMotion] = useState(false);
  const [resolved, setResolved] = useState(false);

  useEffect(() => {
    let isEffectMounted = true;
    AccessibilityInfo.isReduceMotionEnabled().then((enabled) => {
      if (isEffectMounted) {
        setReduceMotion(enabled);
        setResolved(true);
      }
    });
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    return () => {
      isEffectMounted = false;
      subscription.remove();
    };
  }, []);

  return { reduceMotion, resolved };
}

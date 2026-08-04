import { useEffect, useState } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';

import { HorizonStrip as HorizonStripTokens } from '@/constants/design-tokens';
import { useReduceMotion } from '@/shared/hooks/use-reduce-motion';

// Purely decorative, non-interactive ambient footer band (DESIGN.md
// #components `horizon-strip`, Story 4.4) -- keeps OTP Sign-In/Verify and
// Destination Picker from reading as "flatly, silently white." A pale sky
// gradient, a soft amber sun-glow, a road line, and a slow-scrolling dashed
// amber lane-line loop. Values transcribed directly from
// mockups/key-otp-signin.html and mockups/key-destination-picker.html's
// identical `.horizon`/`.horizon-sky-glow`/`.road-strip`/`.dash-track`/
// `.dash` CSS.
//
// The sky-glow's soft, faded edge is achieved via opacity on a solid-color
// shape (not blur/transparency-as-chrome) -- this is the one place in the
// whole system EXPERIENCE.md itself singles out as "the one place motion
// exists purely for texture, not feedback," distinct from the "no
// transparency/blur/glassmorphism" rule that governs UI chrome (buttons,
// cards, scrims) elsewhere.
//
// Enough dash segments to comfortably tile past any phone width plus the
// loop's own travel distance, mirroring the mockup's own `width:200%` track
// approach (each dash+gap repeats every 48px; 16 dashes covers 768px, safely
// past any real device width even mid-loop).
const DASH_COUNT = 16;
const DASH_UNIT = HorizonStripTokens.dashWidth + HorizonStripTokens.dashGap;
// Code review finding: must be a whole multiple of DASH_UNIT, or the tiled
// dash pattern doesn't line up with itself at the loop's reset instant and
// visibly jumps. The mockup's own literal CSS value (152px) isn't a multiple
// of 48px -- 3 * DASH_UNIT is the closest seamless distance to it.
const LOOP_DISTANCE = DASH_UNIT * 3;

export function HorizonStrip() {
  const { reduceMotion, resolved } = useReduceMotion();
  const [driftProgress] = useState(() => new Animated.Value(0));

  useEffect(() => {
    // Code review finding: also wait for `resolved` -- reduceMotion alone
    // defaults to false until useReduceMotion()'s async check lands, which
    // could otherwise let the drift play for a moment on mount even for a
    // Reduce-Motion user, contradicting the "freezes to a static frame" spec.
    if (!resolved || reduceMotion) return;
    const loop = Animated.loop(
      Animated.timing(driftProgress, {
        toValue: 1,
        duration: HorizonStripTokens.driftDurationMs,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    );
    loop.start();
    return () => {
      loop.stop();
      driftProgress.setValue(0);
    };
  }, [resolved, reduceMotion, driftProgress]);

  const translateX = driftProgress.interpolate({ inputRange: [0, 1], outputRange: [0, -LOOP_DISTANCE] });

  return (
    <View testID="horizon-strip" style={styles.container} pointerEvents="none">
      <View testID="horizon-strip-sky-glow" style={styles.skyGlow} />
      <View style={styles.roadLine} />
      <Animated.View style={[styles.dashTrack, { transform: [{ translateX }] }]}>
        {Array.from({ length: DASH_COUNT }, (_, index) => (
          <View key={index} style={styles.dash} />
        ))}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    height: HorizonStripTokens.height,
    // Middle stop of the mockup's 3-stop linear-gradient, as a flat
    // approximation -- expo-linear-gradient would be the literal match, but
    // this repo already reserves that dependency for JoinCodeCard's own
    // (still Night-Drive) glow; a flat mid-tone fill is a reasonable,
    // dependency-free stand-in for a band this quiet and this small.
    backgroundColor: HorizonStripTokens.skyGradient[1],
    borderTopWidth: 1,
    borderTopColor: HorizonStripTokens.borderTopColor,
    overflow: 'hidden',
  },
  skyGlow: {
    position: 'absolute',
    top: -30,
    left: '50%',
    marginLeft: -110,
    width: 220,
    height: 60,
    borderRadius: 30,
    backgroundColor: HorizonStripTokens.skyGlowColor,
    opacity: HorizonStripTokens.skyGlowOpacity,
  },
  roadLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 22,
    height: HorizonStripTokens.dashHeight,
    backgroundColor: HorizonStripTokens.roadLineColor,
  },
  dashTrack: {
    position: 'absolute',
    left: 0,
    bottom: 22,
    height: HorizonStripTokens.dashHeight,
    width: DASH_COUNT * DASH_UNIT,
    flexDirection: 'row',
  },
  dash: {
    width: HorizonStripTokens.dashWidth,
    height: HorizonStripTokens.dashHeight,
    marginRight: HorizonStripTokens.dashGap,
    borderRadius: 3,
    backgroundColor: HorizonStripTokens.dashColor,
  },
});

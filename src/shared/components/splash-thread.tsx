import { LinearGradient } from 'expo-linear-gradient';
import { forwardRef, useEffect, useRef, useState, type ComponentProps, type ComponentRef } from 'react';
import { Animated, Easing, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { SplashThread as SplashThreadTokens } from '@/constants/design-tokens';
import { useReduceMotion } from '@/shared/hooks/use-reduce-motion';

// React Native Animated injects the native-only `collapsable={false}` prop.
// react-native-svg's web Path forwards unknown props to the DOM, where React
// warns because `collapsable` is not a boolean HTML attribute. Keep Animated's
// ref behavior while consuming that implementation prop at this boundary.
const AnimationSafePath = forwardRef<
  ComponentRef<typeof Path>,
  ComponentProps<typeof Path> & { collapsable?: boolean }
>(({ collapsable: _collapsable, ...props }, ref) => <Path ref={ref} {...props} />);
AnimationSafePath.displayName = 'AnimationSafePath';
const AnimatedPath = Animated.createAnimatedComponent(AnimationSafePath);

const STAR_D = 'M10 0L12 8L20 10L12 12L10 20L8 12L0 10L8 8Z';

interface SplashThreadProps {
  onComplete: () => void;
}

/**
 * splash-thread (DESIGN.md#components, EXPERIENCE.md Motion & Transitions
 * "Splash Screen ('The Thread')") -- plays once per cold launch, fully
 * automatic, no tap/skip control (pointerEvents="none" throughout). Three
 * Voyagers appear apart, an amber thread draws itself between them with
 * sparks marking collected moments, then the wordmark settles in. See
 * mockups/key-splash-screen.html for the live reference this transcribes.
 *
 * Positions/path come from SplashThreadTokens' 300x620 reference frame and
 * are stretched (non-uniform scale, matching every other full-bleed
 * Wayfinder screen) to the real device via the SVG's own
 * `preserveAspectRatio="none"` for the thread, and manual cx/cy * scale for
 * the plain-View dots/sparks/ripple.
 */
export function SplashThread({ onComplete }: SplashThreadProps) {
  const { width, height } = useWindowDimensions();
  const { reduceMotion, resolved } = useReduceMotion();
  const scaleX = width / SplashThreadTokens.referenceWidth;
  const scaleY = height / SplashThreadTokens.referenceHeight;

  const [dotProgress] = useState(() => SplashThreadTokens.dots.map(() => new Animated.Value(0)));
  const [threadProgress] = useState(() => new Animated.Value(0));
  const [sparkProgress] = useState(() => SplashThreadTokens.sparks.map(() => new Animated.Value(0)));
  const [rippleProgress] = useState(() => new Animated.Value(0));
  const [wordmarkProgress] = useState(() => new Animated.Value(0));
  const [taglineProgress] = useState(() => new Animated.Value(0));

  const hasStartedRef = useRef(false);
  // Ref so the completion timers below don't need onComplete in their
  // effect dependency array -- callers (e.g. _layout.tsx) pass a fresh
  // closure every render, which would otherwise restart the sequence. Synced
  // in its own effect (not during render) per the rules of hooks.
  const onCompleteRef = useRef(onComplete);
  useEffect(() => {
    onCompleteRef.current = onComplete;
  });

  useEffect(() => {
    if (!resolved || hasStartedRef.current) return;
    hasStartedRef.current = true;

    if (reduceMotion) {
      dotProgress.forEach((value) => value.setValue(1));
      threadProgress.setValue(1);
      sparkProgress.forEach((value) => value.setValue(1));
      wordmarkProgress.setValue(1);
      taglineProgress.setValue(1);
      // rippleProgress stays at 0 -- the ripple is pure motion flourish, not
      // shown in the settled Reduce Motion end-state.
      const timer = setTimeout(() => onCompleteRef.current(), SplashThreadTokens.reducedHoldMs);
      return () => clearTimeout(timer);
    }

    Animated.parallel([
      ...dotProgress.map((value, index) =>
        Animated.timing(value, {
          toValue: 1,
          duration: SplashThreadTokens.dotPopDurationMs,
          delay: SplashThreadTokens.dots[index].popDelayMs,
          easing: Easing.out(Easing.back(1.6)),
          useNativeDriver: true,
        }),
      ),
      // strokeDashoffset isn't a native-driver-supported property -- this is
      // the one JS-driven animation in the sequence, everything else above
      // and below runs on the native driver.
      Animated.timing(threadProgress, {
        toValue: 1,
        duration: SplashThreadTokens.threadDrawDurationMs,
        delay: SplashThreadTokens.threadDrawDelayMs,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: false,
      }),
      ...sparkProgress.map((value, index) =>
        Animated.timing(value, {
          toValue: 1,
          duration: SplashThreadTokens.sparkPopDurationMs,
          delay: SplashThreadTokens.sparks[index].delayMs,
          easing: Easing.out(Easing.back(1.8)),
          useNativeDriver: true,
        }),
      ),
      Animated.timing(rippleProgress, {
        toValue: 1,
        duration: SplashThreadTokens.rippleDurationMs,
        delay: SplashThreadTokens.rippleDelayMs,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(wordmarkProgress, {
        toValue: 1,
        duration: SplashThreadTokens.wordmarkDurationMs,
        delay: SplashThreadTokens.wordmarkDelayMs,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(taglineProgress, {
        toValue: 1,
        duration: SplashThreadTokens.taglineDurationMs,
        delay: SplashThreadTokens.taglineDelayMs,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    ]).start();

    const timer = setTimeout(() => onCompleteRef.current(), SplashThreadTokens.totalDurationMs);
    return () => clearTimeout(timer);
    // Animated.Value instances (dotProgress, threadProgress, etc.) are
    // stable for the component's lifetime (created once via the useState
    // initializers above); only `resolved`/`reduceMotion` should ever
    // re-run this effect.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resolved, reduceMotion]);

  const threadDashoffset = threadProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [SplashThreadTokens.pathLength, 0],
  });

  return (
    <View testID="splash-thread" style={StyleSheet.absoluteFill} pointerEvents="none">
      <LinearGradient
        colors={SplashThreadTokens.background}
        style={StyleSheet.absoluteFill}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
      />

      <Svg width={width} height={height} viewBox={`0 0 ${SplashThreadTokens.referenceWidth} ${SplashThreadTokens.referenceHeight}`} preserveAspectRatio="none" style={StyleSheet.absoluteFill}>
        <AnimatedPath
          d={SplashThreadTokens.pathD}
          stroke={SplashThreadTokens.threadColor}
          strokeWidth={SplashThreadTokens.threadWidth}
          strokeLinecap="round"
          fill="none"
          strokeDasharray={SplashThreadTokens.pathLength}
          strokeDashoffset={threadDashoffset}
        />
      </Svg>

      {SplashThreadTokens.dots.map((dot, index) => {
        const progress = dotProgress[index];
        return (
          <Animated.View
            key={index}
            testID={`splash-thread-dot-${index}`}
            style={[
              styles.dot,
              {
                left: dot.cx * scaleX - SplashThreadTokens.dotRadius,
                top: dot.cy * scaleY - SplashThreadTokens.dotRadius,
                width: SplashThreadTokens.dotRadius * 2,
                height: SplashThreadTokens.dotRadius * 2,
                borderRadius: SplashThreadTokens.dotRadius,
                backgroundColor: dot.color,
                opacity: progress,
                transform: [{ scale: progress }],
              },
            ]}
          />
        );
      })}

      {SplashThreadTokens.sparks.map((spark, index) => {
        const progress = sparkProgress[index];
        return (
          <Animated.View
            key={index}
            testID={`splash-thread-spark-${index}`}
            style={[
              styles.spark,
              {
                left: spark.cx * scaleX - 5,
                top: spark.cy * scaleY - 5,
                opacity: progress,
                transform: [{ scale: progress }],
              },
            ]}
          >
            <Svg width={10} height={10} viewBox="0 0 20 20">
              <Path d={STAR_D} fill={SplashThreadTokens.threadColor} />
            </Svg>
          </Animated.View>
        );
      })}

      <Animated.View
        testID="splash-thread-ripple"
        pointerEvents="none"
        style={[
          styles.ripple,
          {
            left: SplashThreadTokens.rippleOrigin.cx * scaleX - 2,
            top: SplashThreadTokens.rippleOrigin.cy * scaleY - 2,
            borderColor: SplashThreadTokens.rippleColor,
            opacity: rippleProgress.interpolate({ inputRange: [0, 0.01, 1], outputRange: [0, 0.7, 0] }),
            transform: [{ scale: rippleProgress.interpolate({ inputRange: [0, 1], outputRange: [1, 65] }) }],
          },
        ]}
      />

      <Animated.View
        style={[
          styles.wordmarkWrap,
          {
            bottom: SplashThreadTokens.wordmarkBottom,
            opacity: wordmarkProgress,
            transform: [
              {
                translateY: wordmarkProgress.interpolate({ inputRange: [0, 1], outputRange: [16, 0] }),
              },
            ],
          },
        ]}
      >
        <Text style={styles.wordmark}>Voylo</Text>
        <Animated.Text style={[styles.tagline, { opacity: taglineProgress }]}>{SplashThreadTokens.tagline}</Animated.Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  dot: {
    position: 'absolute',
  },
  spark: {
    position: 'absolute',
    width: 10,
    height: 10,
  },
  ripple: {
    position: 'absolute',
    width: 4,
    height: 4,
    borderRadius: 2,
    borderWidth: 2,
  },
  wordmarkWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  wordmark: {
    fontFamily: 'ClashDisplay-Semibold',
    fontSize: 30,
    fontWeight: '600',
    letterSpacing: -0.3,
    color: SplashThreadTokens.wordmarkColor,
  },
  tagline: {
    marginTop: 4,
    fontFamily: 'GeneralSans-Semibold',
    fontSize: 12.5,
    color: SplashThreadTokens.taglineColor,
  },
});

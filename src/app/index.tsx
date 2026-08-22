import { LinearGradient } from 'expo-linear-gradient';
import { Link, router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Animated, Easing, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Circle, Defs, Polygon, RadialGradient, Rect, Stop } from 'react-native-svg';

import { HomeJourneyMotion, Spacing, Typography, WayfinderColors } from '@/constants/design-tokens';
import { IgnitionButton } from '@/shared/components/ignition-button';
import { useReduceMotion } from '@/shared/hooks/use-reduce-motion';

// Viewbox-agnostic loop unit (dash + gap); only needs to tile seamlessly
// with itself, not match the mockup's literal device-px dash geometry --
// this element is a small decorative texture, not load-bearing.
const CENTERLINE_UNIT = 14;

/**
 * home-journey (DESIGN.md#components, EXPERIENCE.md Motion & Transitions
 * "Home Journey ('Memory Sparks')" -- Story 4.8). Purely decorative, ambient
 * resting-state layer behind Home's real content: a perspective road, a
 * drifting centerline, three bobbing crew dots, a heartbeat reveal-glow, and
 * matching-color sparks lifting toward the wordmark. See
 * mockups/key-home.html for the pixel reference this transcribes.
 */
function HomeJourneyRoad() {
  const { reduceMotion, resolved } = useReduceMotion();
  const { height: windowHeight } = useWindowDimensions();
  // Sized to windowHeight rather than a fixed count (code review finding,
  // Story 4.8: a fixed 60 dashes could run short on unusually tall screens)
  // -- +4 dashes of buffer covers the drift loop's own translateY overlap.
  const centerlineDashCount = Math.ceil(((windowHeight * HomeJourneyMotion.roadHeightPercent) / 100 / CENTERLINE_UNIT)) + 4;

  const [driftProgress] = useState(() => new Animated.Value(0));
  const [glowProgress] = useState(() => new Animated.Value(0));
  const [bobProgress] = useState(() => HomeJourneyMotion.crewDots.map(() => new Animated.Value(0)));
  const [sparkProgress] = useState(() => HomeJourneyMotion.memorySparks.map(() => new Animated.Value(0)));

  useEffect(() => {
    if (!resolved) return;

    if (reduceMotion) {
      // DESIGN.md's home-journey.reducedMotion spec: sparks "appear as a
      // single static frame," not disappear -- progress 0 would otherwise
      // evaluate memorySparkOpacityStops[0] = 0 (invisible). 0.12 is the
      // mockup's own first-visible keyframe (opacity 1), giving a real
      // static frame instead of nothing (code review finding, Story 4.8).
      sparkProgress.forEach((value) => value.setValue(0.12));
      return;
    }

    const drift = Animated.loop(
      Animated.timing(driftProgress, { toValue: 1, duration: HomeJourneyMotion.centerlineDriftDurationMs, easing: Easing.linear, useNativeDriver: true }),
    );
    // Mockup's `heartbeat`/`bob` keyframes use ease-in-out, `rise` uses
    // ease-in, `roadDrift` uses linear -- matched here per-animation rather
    // than defaulting everything to linear (verified against key-home.html's
    // literal `animation:` declarations).
    const glow = Animated.loop(
      Animated.timing(glowProgress, { toValue: 1, duration: HomeJourneyMotion.revealGlowHeartbeatDurationMs, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
    );
    drift.start();
    glow.start();

    // Each dot/spark gets its own one-time stagger delay before looping --
    // NOT a delay inside the loop itself, which would re-insert on every
    // cycle and let the stagger drift out of sync over time.
    const bobSequences = bobProgress.map((value, index) =>
      Animated.sequence([
        Animated.delay(index * HomeJourneyMotion.crewDotStaggerMs),
        Animated.loop(Animated.timing(value, { toValue: 1, duration: HomeJourneyMotion.crewDotBobDurationMs, easing: Easing.inOut(Easing.ease), useNativeDriver: true })),
      ]),
    );
    const sparkSequences = sparkProgress.map((value, index) =>
      Animated.sequence([
        Animated.delay(index * HomeJourneyMotion.memorySparkStaggerMs),
        Animated.loop(Animated.timing(value, { toValue: 1, duration: HomeJourneyMotion.memorySparkDurationMs, easing: Easing.in(Easing.ease), useNativeDriver: true })),
      ]),
    );
    [...bobSequences, ...sparkSequences].forEach((sequence) => sequence.start());

    return () => {
      drift.stop();
      glow.stop();
      bobSequences.forEach((sequence) => sequence.stop());
      sparkSequences.forEach((sequence) => sequence.stop());
      driftProgress.setValue(0);
      glowProgress.setValue(0);
      bobProgress.forEach((value) => value.setValue(0));
      sparkProgress.forEach((value) => value.setValue(0));
    };
    // Animated.Value instances are stable for the component's lifetime
    // (created once via useState initializers above); only resolved/
    // reduceMotion should re-run this effect (same precedent as
    // splash-thread.tsx's own identically-shaped effect).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resolved, reduceMotion]);

  const centerlineTranslateY = driftProgress.interpolate({ inputRange: [0, 1], outputRange: [-CENTERLINE_UNIT, 0] });
  const glowScale = glowProgress.interpolate({ inputRange: [...HomeJourneyMotion.revealGlowKeyframeStops], outputRange: [...HomeJourneyMotion.revealGlowScaleStops] });
  const glowOpacity = glowProgress.interpolate({ inputRange: [...HomeJourneyMotion.revealGlowKeyframeStops], outputRange: [...HomeJourneyMotion.revealGlowOpacityStops] });
  const sparkRiseDistance = windowHeight * HomeJourneyMotion.memorySparkRiseFraction;

  return (
    <View testID="home-journey" style={styles.roadWrap} pointerEvents="none">
      <Svg style={StyleSheet.absoluteFill} viewBox="0 0 100 100" preserveAspectRatio="none">
        <Polygon points="42,0 58,0 100,100 0,100" fill={HomeJourneyMotion.roadSurfaceColor} />
      </Svg>

      <View style={styles.centerline}>
        <Animated.View style={[styles.centerlineTrack, { transform: [{ translateY: centerlineTranslateY }] }]}>
          {Array.from({ length: centerlineDashCount }, (_, index) => (
            <View key={index} style={styles.centerlineDash} />
          ))}
        </Animated.View>
      </View>

      <Animated.View
        testID="home-journey-reveal-glow"
        pointerEvents="none"
        style={[styles.revealGlow, { opacity: glowOpacity, transform: [{ scale: glowScale }] }]}
      >
        <Svg width="100%" height="100%" viewBox="0 0 46 46">
          <Defs>
            <RadialGradient id="revealGlowGradient" cx="50%" cy="50%" r="50%">
              <Stop offset="0%" stopColor={HomeJourneyMotion.revealGlowColor} stopOpacity={0.7} />
              <Stop offset="72%" stopColor={HomeJourneyMotion.revealGlowColor} stopOpacity={0} />
            </RadialGradient>
          </Defs>
          <Circle cx="23" cy="23" r="23" fill="url(#revealGlowGradient)" />
        </Svg>
      </Animated.View>

      {HomeJourneyMotion.crewDots.map((dot, index) => {
        const translateY = bobProgress[index].interpolate({
          inputRange: [...HomeJourneyMotion.crewDotBobKeyframeStops],
          outputRange: [...HomeJourneyMotion.crewDotBobTranslateY],
        });
        return (
          <Animated.View
            key={index}
            testID={`home-journey-crew-dot-${index}`}
            style={[
              styles.crewDot,
              {
                left: dot.left,
                bottom: dot.bottom,
                width: dot.size,
                height: dot.size,
                borderRadius: dot.size / 2,
                backgroundColor: dot.color,
                transform: [{ translateY }],
              },
            ]}
          />
        );
      })}

      {HomeJourneyMotion.memorySparks.map((spark, index) => {
        const progress = sparkProgress[index];
        return (
          <Animated.View
            key={index}
            testID={`home-journey-spark-${index}`}
            style={[
              styles.memorySpark,
              {
                left: spark.left,
                bottom: spark.bottom,
                backgroundColor: spark.color,
                // Mockup's own `box-shadow: 0 0 5px 1px <color>` soft glow --
                // iOS renders this via shadow*; Android has no colored-glow
                // equivalent and just shows the plain dot (graceful, not broken).
                shadowColor: spark.color,
                shadowOpacity: 0.9,
                shadowRadius: 5,
                shadowOffset: { width: 0, height: 0 },
                opacity: progress.interpolate({ inputRange: [...HomeJourneyMotion.memorySparkKeyframeStops], outputRange: [...HomeJourneyMotion.memorySparkOpacityStops] }),
                transform: [
                  { translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [0, -sparkRiseDistance] }) },
                  { scale: progress.interpolate({ inputRange: [0, 1], outputRange: [...HomeJourneyMotion.memorySparkScaleStops] }) },
                ],
              },
            ]}
          />
        );
      })}
    </View>
  );
}

function Wordmark() {
  const { reduceMotion, resolved } = useReduceMotion();
  const [glowProgress] = useState(() => new Animated.Value(0));

  useEffect(() => {
    if (!resolved || reduceMotion) return;
    const loop = Animated.loop(
      // Mockup's wordGlow keyframes use ease-in-out (key-home.html).
      Animated.timing(glowProgress, { toValue: 1, duration: HomeJourneyMotion.wordmarkGlowDurationMs, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
    );
    loop.start();
    return () => {
      loop.stop();
      glowProgress.setValue(0);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resolved, reduceMotion]);

  const scale = glowProgress.interpolate({ inputRange: [...HomeJourneyMotion.wordmarkGlowKeyframeStops], outputRange: [...HomeJourneyMotion.wordmarkGlowScaleStops] });
  const opacity = glowProgress.interpolate({ inputRange: [...HomeJourneyMotion.wordmarkGlowKeyframeStops], outputRange: [...HomeJourneyMotion.wordmarkGlowOpacityStops] });

  return (
    <View style={styles.wordmarkWrap}>
      <Animated.View testID="home-journey-wordmark-glow" pointerEvents="none" style={[styles.wordmarkGlow, { opacity, transform: [{ scale }] }]}>
        <Svg style={StyleSheet.absoluteFill} viewBox="0 0 100 100" preserveAspectRatio="none">
          <Defs>
            <RadialGradient id="wordmarkGlowGradient" cx="50%" cy="50%" r="50%">
              <Stop offset="0%" stopColor={HomeJourneyMotion.wordmarkGlowColor} stopOpacity={0.22} />
              <Stop offset="70%" stopColor={HomeJourneyMotion.wordmarkGlowColor} stopOpacity={0} />
            </RadialGradient>
          </Defs>
          {/* Non-uniform stretch (preserveAspectRatio="none") turns this
              circular gradient into the mockup's wide/short ellipse glow --
              same trick the road polygon above already relies on. */}
          <Rect x="0" y="0" width="100" height="100" fill="url(#wordmarkGlowGradient)" />
        </Svg>
      </Animated.View>
      <Text style={styles.wordmark}>Voylo</Text>
    </View>
  );
}

export default function HomeScreen() {
  return (
    <View style={styles.container}>
      <LinearGradient
        colors={[...HomeJourneyMotion.landGradient]}
        locations={[...HomeJourneyMotion.landGradientLocations]}
        style={StyleSheet.absoluteFill}
      />
      <HomeJourneyRoad />
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.topRow}>
          <Wordmark />
          {/* "Past Voyages" (Story 6.4) -- same plain-text visual treatment
              as the existing Settings link, placed alongside it. Home's own
              mockup (Story 4.8) predates Story 6.2's later Voyage History
              spec and never depicted this entry point; this is the smallest,
              most convention-consistent way to add it (see that story's
              Dev Notes "Home entry-point gap"). */}
          <View style={styles.topLinks}>
            <Link testID="voyage-history-link" href="/voyage-history">
              <Text style={styles.settingsLabel}>Past Voyages</Text>
            </Link>
            <Link testID="settings-link" href="/settings">
              <Text style={styles.settingsLabel}>Settings</Text>
            </Link>
          </View>
        </View>
        <View style={styles.mid}>
          <Text style={styles.tagline}>{HomeJourneyMotion.tagline}</Text>
        </View>
        <View style={styles.ctaZone}>
          <IgnitionButton
            testID="start-voyage-button"
            label="Start a Voyage"
            disabled={false}
            onPress={() => router.push('/voyage-intro')}
          />
          {/* key-home.html's own literal caption below its single visible
              button -- decorative-only addition, no flow/copy change (Story
              4.4 Scope decision's "cheap, unambiguous mockup completions"). */}
          <Text style={styles.ctaCaption}>Gather your crew and hit the road.</Text>
          {/* key-home.html shows only the one primary button -- this stays
              understated (Story 4.4's own Scope decision keeps it, since
              AC #2 protects existing behavior the mockup just doesn't
              depict), so "text" reads more consistent with the mockup's
              minimal footprint than the new bordered "secondary" pill. */}
          <IgnitionButton
            testID="join-voyage-button"
            label="Join a Voyage"
            disabled={false}
            onPress={() => router.push('/join')}
            variant="text"
          />
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    position: 'relative',
    // Fallback beneath the LinearGradient (code review finding, Story 4.8)
    // -- matches the gradient's own top stop so a failed/late paint doesn't
    // flash unstyled instead of a close approximation.
    backgroundColor: '#EAF2E4',
  },
  safeArea: {
    flex: 1,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.gutter,
    paddingTop: Spacing['2'],
  },
  wordmarkWrap: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  wordmark: {
    color: WayfinderColors.inkPrimary,
    // 700 (Bold), not Typography.display's own 600 (Semibold).
    fontFamily: 'ClashDisplay-Bold',
    fontSize: 19,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  wordmarkGlow: {
    position: 'absolute',
    left: -14,
    right: -14,
    top: -10,
    bottom: -10,
  },
  mid: {
    flex: 1,
    justifyContent: 'flex-start',
    alignItems: 'center',
    paddingHorizontal: Spacing.heroGap,
    paddingTop: Spacing['5'],
  },
  tagline: {
    color: WayfinderColors.inkPrimary,
    fontFamily: 'ClashDisplay-Bold',
    fontSize: 27,
    fontWeight: '700',
    lineHeight: 32,
    textAlign: 'center',
    // Mockup's `text-shadow: 0 2px 12px rgba(255,255,255,0.65)` legibility
    // halo against the road/gradient background (code review finding, Story 4.8).
    textShadowColor: 'rgba(255,255,255,0.65)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 12,
  },
  ctaZone: {
    flex: 2,
    justifyContent: 'center',
    alignItems: 'center',
    gap: Spacing['3'],
    paddingHorizontal: Spacing.heroGap,
    paddingBottom: Spacing.heroGap,
  },
  ctaCaption: {
    color: WayfinderColors.inkDisabled,
    fontFamily: Typography.body.fontFamily,
    fontSize: 13.5,
    textAlign: 'center',
  },
  topLinks: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing['4'],
  },
  settingsLabel: {
    color: WayfinderColors.inkSecondary,
    fontFamily: Typography.body.fontFamily,
    fontSize: 14,
  },
  roadWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: `${HomeJourneyMotion.roadHeightPercent}%`,
    overflow: 'hidden',
  },
  centerline: {
    position: 'absolute',
    left: '50%',
    bottom: 0,
    top: 0,
    width: 10,
    marginLeft: -5,
    overflow: 'hidden',
    alignItems: 'center',
  },
  centerlineTrack: {
    position: 'absolute',
    bottom: 0,
    width: 4,
  },
  centerlineDash: {
    width: 4,
    height: CENTERLINE_UNIT / 2,
    marginBottom: CENTERLINE_UNIT / 2,
    borderRadius: 2,
    backgroundColor: HomeJourneyMotion.centerlineColor,
  },
  revealGlow: {
    position: 'absolute',
    left: '50%',
    bottom: '42%',
    width: 46,
    height: 46,
    marginLeft: -23,
  },
  crewDot: {
    position: 'absolute',
    borderWidth: 2.5,
    borderColor: '#FFFFFF',
    // Mockup's `.crew-dot { box-shadow: 0 2px 4px 0 rgba(16,24,40,0.35); }`
    // depth shadow (code review finding, Story 4.8).
    shadowColor: '#101828',
    shadowOpacity: 0.35,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
  },
  memorySpark: {
    position: 'absolute',
    width: 5,
    height: 5,
    borderRadius: 2.5,
  },
});

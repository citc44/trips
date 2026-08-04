import type { StyleProp, ViewStyle } from 'react-native';
import { StyleSheet, View } from 'react-native';

// Purely decorative, non-interactive dashed line nodding at the Live Map
// without breaking the app's solid-color rule (DESIGN.md). RN has no native
// repeating-gradient primitive to match the mockups' own
// `repeating-linear-gradient(180deg, #4C93FF 0 16px, transparent 16px 30px)`
// -- approximated as a stack of short dash Views at the same 16px-dash/14px-
// gap rhythm. Shared between Voyage Intro (`key-voyage-intro.html`, rotated
// 9deg, right-anchored) and Join Invitation (`key-join-invitation.html`,
// rotated -8deg, left-anchored) -- same motif, mirrored per each mockup's own
// literal `transform` value, positioned via the `style` prop.
const DASH_COUNT = 14;

export function RoadMotif({ rotateDeg, style }: { rotateDeg: number; style?: StyleProp<ViewStyle> }) {
  return (
    <View testID="road-motif" style={[styles.container, { transform: [{ rotate: `${rotateDeg}deg` }] }, style]} pointerEvents="none">
      {Array.from({ length: DASH_COUNT }, (_, index) => (
        <View key={index} style={styles.dash} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    width: 5,
    height: 620,
    opacity: 0.9,
  },
  dash: {
    width: 5,
    height: 16,
    marginBottom: 14,
    backgroundColor: '#4C93FF',
  },
});

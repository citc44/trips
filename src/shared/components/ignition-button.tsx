import { LinearGradient } from 'expo-linear-gradient';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { ButtonIgnition, Colors, Spacing, Typography } from '@/constants/design-tokens';

export function IgnitionButton({
  testID,
  label,
  disabled,
  onPress,
  variant = 'primary',
}: {
  testID: string;
  label: string;
  disabled: boolean;
  onPress: () => void;
  variant?: 'primary' | 'secondary';
}) {
  if (variant === 'secondary') {
    return (
      <Text
        testID={testID}
        accessibilityRole="button"
        accessibilityState={{ disabled }}
        onPress={disabled ? undefined : onPress}
        style={[styles.secondaryLabel, disabled && styles.disabledLabel]}
      >
        {label}
      </Text>
    );
  }

  return (
    <Pressable testID={testID} accessibilityRole="button" accessibilityState={{ disabled }} disabled={disabled} onPress={onPress}>
      <LinearGradient
        colors={disabled ? [Colors.inkSecondary, Colors.inkSecondary] : [...ButtonIgnition.gradient]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.button}
      >
        <View style={styles.textScrim}>
          <Text style={styles.buttonLabel}>{label}</Text>
        </View>
      </LinearGradient>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    width: '100%',
    minHeight: ButtonIgnition.minHeight,
    borderRadius: ButtonIgnition.radius,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textScrim: {
    backgroundColor: ButtonIgnition.textScrim,
    borderRadius: Spacing['2'],
    paddingVertical: Spacing['1'],
    paddingHorizontal: Spacing['3'],
  },
  buttonLabel: {
    color: ButtonIgnition.foreground,
    fontSize: Typography.body.fontSize,
    fontWeight: '600',
  },
  secondaryLabel: {
    color: Colors.inkPrimary,
    fontSize: Typography.body.fontSize,
    padding: Spacing['3'],
  },
  disabledLabel: {
    color: Colors.inkSecondary,
  },
});

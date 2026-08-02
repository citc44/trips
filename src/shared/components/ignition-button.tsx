import { LinearGradient } from 'expo-linear-gradient';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { ButtonDestructive, ButtonIgnition, Colors, Spacing, Typography } from '@/constants/design-tokens';

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
  variant?: 'primary' | 'secondary' | 'destructive';
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

  if (variant === 'destructive') {
    return (
      <Pressable
        testID={testID}
        accessibilityRole="button"
        accessibilityState={{ disabled }}
        disabled={disabled}
        onPress={onPress}
        style={[styles.destructiveButton, disabled && styles.destructiveButtonDisabled]}
      >
        <Text style={[styles.destructiveLabel, disabled && styles.disabledLabel]}>{label}</Text>
      </Pressable>
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
        {disabled ? (
          <Text style={[styles.buttonLabel, styles.disabledButtonLabel]}>{label}</Text>
        ) : (
          <View style={styles.textScrim}>
            <Text style={styles.buttonLabel}>{label}</Text>
          </View>
        )}
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
  disabledButtonLabel: {
    // No gradient behind the label in the disabled state, so the textScrim's
    // dark backing (needed for contrast against the vivid gradient) would
    // just show up as a stray box/line against the flat inkSecondary fill.
    // Darkening the label itself keeps contrast without that backing.
    color: Colors.surfaceMidnight,
  },
  secondaryLabel: {
    color: Colors.inkPrimary,
    fontSize: Typography.body.fontSize,
    padding: Spacing['3'],
  },
  disabledLabel: {
    color: Colors.inkSecondary,
  },
  destructiveButton: {
    width: '100%',
    minHeight: ButtonDestructive.minHeight,
    borderRadius: ButtonDestructive.radius,
    borderWidth: 1,
    borderColor: ButtonDestructive.borderColor,
    backgroundColor: ButtonDestructive.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  destructiveButtonDisabled: {
    opacity: 0.5,
  },
  destructiveLabel: {
    color: ButtonDestructive.foreground,
    fontSize: Typography.body.fontSize,
    fontWeight: '600',
  },
});

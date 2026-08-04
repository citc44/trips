import { Pressable, StyleSheet, Text } from 'react-native';

import {
  Spacing,
  Typography,
  WayfinderButtonDestructive,
  WayfinderButtonIgnition,
  WayfinderButtonIgnitionInverse,
  WayfinderButtonSecondary,
  WayfinderColors,
} from '@/constants/design-tokens';

// Story 4.4: fully re-skinned to Wayfinder -- no more Night-Drive gradient
// (`ButtonIgnition`/`Colors` are untouched legacy exports, no longer
// referenced here; DESIGN.md's "no transparency, blur, or glassmorphism
// anywhere" also rules out the gradient fill this component used to have).
// `textScrim` is gone too -- that only existed to keep the label legible
// against the old vivid gradient; a flat fill needs no such backing.
//
// Five variants now, not three:
// - "primary" (default): flat accent-primary pill, the old "primary".
// - "secondary": a bordered "fog-fill" pill (DESIGN.md's real
//   `button-secondary` token) -- visually distinct from the old
//   "secondary", which was actually a plain unbordered text link. Existing
//   call sites using the old "secondary" for a genuinely quiet/low-emphasis
//   action (e.g. OTP's resend link) move to the new "text" variant instead,
//   not this one -- see each screen's own Story 4.4 changes.
// - "text": the old "secondary" behavior, kept under its own honest name
//   now that "secondary" means something visually different.
// - "inverse": new -- white fill/accent-primary label, used only on the
//   two full-bleed accent-primary hero screens (Voyage Intro, Join
//   Invitation), where a flat accent-primary button would vanish against
//   its own-color background.
// - "destructive": re-skinned to DESIGN.md's real `button-destructive`
//   values; not currently used by any of Story 4.4's 8 screens, kept in
//   sync since this is the one shared component every screen routes
//   through.
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
  variant?: 'primary' | 'secondary' | 'text' | 'inverse' | 'destructive';
}) {
  if (variant === 'text') {
    return (
      <Text
        testID={testID}
        accessibilityRole="button"
        accessibilityState={{ disabled }}
        onPress={() => {
          if (!disabled) onPress();
        }}
        style={[styles.textLabel, disabled && styles.textLabelDisabled]}
      >
        {label}
      </Text>
    );
  }

  if (variant === 'secondary') {
    return (
      <Pressable
        testID={testID}
        accessibilityRole="button"
        accessibilityState={{ disabled }}
        disabled={disabled}
        onPress={onPress}
        style={[styles.secondaryButton, disabled && styles.disabledOpacity]}
      >
        <Text style={styles.secondaryLabel}>{label}</Text>
      </Pressable>
    );
  }

  if (variant === 'inverse') {
    return (
      <Pressable
        testID={testID}
        accessibilityRole="button"
        accessibilityState={{ disabled }}
        disabled={disabled}
        onPress={onPress}
        style={[styles.inverseButton, disabled && styles.disabledOpacity]}
      >
        <Text style={styles.inverseLabel}>{label}</Text>
      </Pressable>
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
        style={[styles.destructiveButton, disabled && styles.disabledOpacity]}
      >
        <Text style={styles.destructiveLabel}>{label}</Text>
      </Pressable>
    );
  }

  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={[styles.primaryButton, disabled && styles.primaryButtonDisabled]}
    >
      <Text style={[styles.primaryLabel, disabled && styles.primaryLabelDisabled]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  primaryButton: {
    width: '100%',
    minHeight: WayfinderButtonIgnition.minHeight,
    borderRadius: WayfinderButtonIgnition.radius,
    backgroundColor: WayfinderButtonIgnition.background,
    alignItems: 'center',
    justifyContent: 'center',
    // Flat offset shadow (not blurred) -- DESIGN.md's real
    // `pressedShadow: '0 6px 0 accent-primary-pressed'`, matching every
    // mockup's own literal `box-shadow:0 6px 0 #0653C7`.
    shadowColor: WayfinderButtonIgnition.pressedShadowColor,
    shadowOffset: { width: 0, height: WayfinderButtonIgnition.pressedShadowOffset },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 6,
  },
  primaryButtonDisabled: {
    backgroundColor: WayfinderButtonIgnition.disabledBackground,
    shadowOpacity: 0,
    elevation: 0,
  },
  primaryLabel: {
    color: WayfinderButtonIgnition.foreground,
    fontSize: Typography.body.fontSize,
    fontWeight: '700',
  },
  primaryLabelDisabled: {
    color: WayfinderButtonIgnition.disabledForeground,
  },
  secondaryButton: {
    width: '100%',
    minHeight: WayfinderButtonSecondary.minHeight,
    borderRadius: WayfinderButtonSecondary.radius,
    borderWidth: WayfinderButtonSecondary.borderWidth,
    borderColor: WayfinderButtonSecondary.borderColor,
    backgroundColor: WayfinderButtonSecondary.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryLabel: {
    color: WayfinderButtonSecondary.foreground,
    fontSize: Typography.body.fontSize,
    fontWeight: '700',
  },
  inverseButton: {
    width: '100%',
    minHeight: WayfinderButtonIgnitionInverse.minHeight,
    borderRadius: WayfinderButtonIgnitionInverse.radius,
    backgroundColor: WayfinderButtonIgnitionInverse.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  inverseLabel: {
    color: WayfinderButtonIgnitionInverse.foreground,
    fontSize: Typography.body.fontSize,
    fontWeight: '700',
  },
  textLabel: {
    color: WayfinderColors.inkSecondary,
    fontSize: Typography.body.fontSize,
    padding: Spacing['3'],
  },
  textLabelDisabled: {
    color: WayfinderColors.inkDisabled,
  },
  destructiveButton: {
    width: '100%',
    minHeight: WayfinderButtonDestructive.minHeight,
    borderRadius: WayfinderButtonDestructive.radius,
    backgroundColor: WayfinderButtonDestructive.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  destructiveLabel: {
    color: WayfinderButtonDestructive.foreground,
    fontSize: Typography.body.fontSize,
    fontWeight: '700',
  },
  disabledOpacity: {
    opacity: 0.5,
  },
});

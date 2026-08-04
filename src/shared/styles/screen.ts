import { StyleSheet } from 'react-native';

import { Colors, Spacing, Typography } from '@/constants/design-tokens';

/** Shared layout for full-bleed, single-column auth/utility screens (sign-in, settings, ...). */
export const screenStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.surfaceMidnight,
  },
  safeArea: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing['4'],
    paddingHorizontal: Spacing.gutter,
  },
  headline: {
    color: Colors.inkPrimary,
    fontFamily: Typography.headline.fontFamily,
    fontSize: Typography.headline.fontSize,
    fontWeight: Typography.headline.fontWeight,
    lineHeight: Typography.headline.lineHeight,
  },
  disabledLabel: {
    color: Colors.inkSecondary,
  },
  error: {
    color: Colors.error,
    fontFamily: Typography.body.fontFamily,
    fontSize: Typography.body.fontSize,
  },
});

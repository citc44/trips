/**
 * Night Drive design tokens, sourced from DESIGN.md.
 * Only the values needed so far are ported here — not the full catalog
 * (player colors, display/caption typography, etc. are unused until a
 * screen actually needs them).
 */

export const Colors = {
  surfaceMidnight: '#0A0D1C',
  inkPrimary: '#F7F6FF',
  inkSecondary: '#A6ADD1',
  borderHairline: '#2A3156',
  accentIgnition: '#FF5677',
  accentViolet: '#9B6BFF',
  error: '#FF4D5E',
} as const;

export const Typography = {
  headline: {
    fontFamily: 'General Sans',
    fontSize: 20,
    fontWeight: '600',
    lineHeight: 24,
  },
  body: {
    fontFamily: 'General Sans',
    fontSize: 16,
    fontWeight: '400',
    lineHeight: 24,
  },
} as const;

export const Spacing = {
  '1': 4,
  '2': 8,
  '3': 12,
  '4': 16,
  '5': 24,
  '6': 32,
  gutter: 20,
} as const;

export const Rounded = {
  full: 9999,
} as const;

/**
 * button-ignition component spec (DESIGN.md#components).
 * textScrim is a hard requirement, not decorative: ink-primary alone fails
 * WCAG AA (≈2.86:1–3.29:1) against the gradient; a surface-midnight-at-50%
 * backing behind the label restores contrast to ≈7.7:1+.
 */
export const ButtonIgnition = {
  gradient: [Colors.accentIgnition, Colors.accentViolet] as const,
  foreground: Colors.inkPrimary,
  textScrim: `${Colors.surfaceMidnight}80`,
  minHeight: 56,
  radius: Rounded.full,
};

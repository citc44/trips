/**
 * Night Drive design tokens, sourced from DESIGN.md.
 * Only the values needed so far are ported here — not the full catalog
 * (player colors, display/caption typography, etc. are unused until a
 * screen actually needs them).
 */

export const Colors = {
  surfaceMidnight: '#0A0D1C',
  surfaceDuskHigh: '#1E2547',
  inkPrimary: '#F7F6FF',
  inkSecondary: '#A6ADD1',
  borderHairline: '#2A3156',
  accentIgnition: '#FF5677',
  accentViolet: '#9B6BFF',
  error: '#FF4D5E',
} as const;

export const Typography = {
  // -0.02em @ 40px = -0.8 (React Native's letterSpacing is absolute points, not em).
  displayHero: {
    fontFamily: 'Clash Display',
    fontSize: 40,
    fontWeight: '600',
    lineHeight: 42,
    letterSpacing: -0.8,
  },
  display: {
    fontFamily: 'Clash Display',
    fontSize: 28,
    fontWeight: '600',
    lineHeight: 31,
  },
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
  // -0.01em @ 32px = -0.32 (React Native's letterSpacing is absolute points, not em).
  statNumeral: {
    fontFamily: 'Space Mono',
    fontSize: 32,
    fontWeight: '700',
    lineHeight: 32,
    letterSpacing: -0.32,
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
  // Named token (not part of the numbered scale), per DESIGN.md's hero-gap: the
  // generous, cinematic whitespace around Voyage Intro/Join-screen copy.
  heroGap: 40,
} as const;

export const Rounded = {
  sm: 10,
  xl: 36,
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

/**
 * join-code-card component spec (DESIGN.md#components): "a violet-glowing hero
 * card... not a plain text string in a toast." No React Native shadow token
 * existed anywhere in this codebase to copy (IgnitionButton's own `glow` isn't
 * actually implemented, only described in prose) -- shadowColor/shadowOpacity/
 * shadowRadius (iOS) + elevation (Android) is a reasonable native approximation
 * of the web mockup's `0 0 40px accent-violet at 40%` box-shadow glow.
 */
export const JoinCodeCard = {
  gradient: [Colors.surfaceDuskHigh, Colors.surfaceMidnight] as const,
  radius: Rounded.xl,
  glowColor: Colors.accentViolet,
  glowOpacity: 0.4,
  glowRadius: 40,
};

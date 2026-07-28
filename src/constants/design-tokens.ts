/**
 * Night Drive design tokens, sourced from DESIGN.md.
 * Only the values needed so far are ported here — not the full catalog
 * (player colors, display/caption typography, etc. are unused until a
 * screen actually needs them).
 */

export const Colors = {
  surfaceMidnight: '#0A0D1C',
  surfaceDuskHigh: '#1E2547',
  surfaceGlass: '#1E2547CC',
  inkPrimary: '#F7F6FF',
  inkSecondary: '#A6ADD1',
  borderHairline: '#2A3156',
  accentIgnition: '#FF5677',
  accentElectric: '#2FE6C0',
  accentViolet: '#9B6BFF',
  error: '#FF4D5E',
  // Player-marker colors (Story 3.2): first-come-first-served from this
  // fixed 8-hue pool, assigned once per Voyager for the whole Voyage --
  // never reused for brand chrome, buttons, or any static UI (DESIGN.md's
  // "Don't" column).
  playerCoral: '#FF6B6B',
  playerTeal: '#2FE6C0',
  playerViolet: '#9B6BFF',
  playerGold: '#FFC247',
  playerSky: '#4FB4FF',
  playerLime: '#B4E61D',
  playerPink: '#FF8FD8',
  playerSlate: '#8C9AC4',
} as const;

// Maps the short token name stored on voyage_members.player_color to its hex
// value -- the DB never stores a hex, only the name (see Story 3.2's
// migration comment for why).
export const PlayerColors = {
  coral: Colors.playerCoral,
  teal: Colors.playerTeal,
  violet: Colors.playerViolet,
  gold: Colors.playerGold,
  sky: Colors.playerSky,
  lime: Colors.playerLime,
  pink: Colors.playerPink,
  slate: Colors.playerSlate,
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
  // +0.04em @ 13px = 0.52; 1.3 line-height ratio @ 13px = 16.9 (React Native's
  // letterSpacing/lineHeight are absolute points, not em/ratio).
  label: {
    fontFamily: 'General Sans',
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 17,
    letterSpacing: 0.52,
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
  md: 18,
  lg: 28,
  xl: 36,
  full: 9999,
} as const;

/**
 * nudge-toast component spec (DESIGN.md#components) -- reused for future
 * v1.1 nudges (long-stop, zero-contribution) too, per EXPERIENCE.md, not
 * one-off to Grant Organizer's confirmation.
 */
export const NudgeToast = {
  background: Colors.surfaceGlass,
  foreground: Colors.inkPrimary,
  radius: Rounded.md,
  accentBar: Colors.accentElectric,
};

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
 * of the web mockup's `0 0 40px accent-violet40` box-shadow glow. `40` there is
 * a CSS hex-alpha suffix (0x40 / 255 ~= 0.25), not a 40% literal.
 */
export const JoinCodeCard = {
  gradient: [Colors.surfaceDuskHigh, Colors.surfaceMidnight] as const,
  radius: Rounded.xl,
  borderColor: Colors.borderHairline,
  glowColor: Colors.accentViolet,
  glowOpacity: 0.25,
  glowRadius: 40,
};

/**
 * button-destructive component spec (DESIGN.md#components): surface-dusk-high
 * background, error foreground, error hairline at ~33% alpha. `55` is a CSS
 * hex-alpha suffix (0x55 / 255 ~= 0.33), not a 33% literal -- same convention
 * as JoinCodeCard's `40` above.
 */
export const ButtonDestructive = {
  background: Colors.surfaceDuskHigh,
  foreground: Colors.error,
  borderColor: `${Colors.error}55`,
  radius: Rounded.full,
  minHeight: ButtonIgnition.minHeight,
};

/**
 * hud-card component spec (DESIGN.md#components): the Live Map's top/bottom
 * dock chrome. `85` is a CSS hex-alpha suffix (0x85 / 255 ~= 52%, i.e. the
 * "scrimOpacityMin: 85%" spec value expressed the same hex-alpha way this
 * codebase already uses for JoinCodeCard's glow/ButtonDestructive's border --
 * not a literal 85% opacity.
 */
export const HudCard = {
  background: Colors.surfaceGlass,
  radius: Rounded.lg,
  borderColor: Colors.borderHairline,
  blurAmount: 20,
};

/**
 * map-marker component spec (DESIGN.md#components): 40px avatar circle, 3px
 * player-color ring, 48px tap region (well above the accessibility-floor
 * minimum), fading comet-trail. ringColor is resolved per-Voyager from
 * PlayerColors above, not a single static value.
 */
export const MapMarker = {
  size: 40,
  hitRegion: 48,
  radius: Rounded.full,
  ringWidth: 3,
  fill: Colors.surfaceDuskHigh,
  trailFadeDurationMs: 600,
  trailLengthMs: 8000,
};

/**
 * status-pill component spec (DESIGN.md#components). Story 3.2 only ever
 * renders the `riding` variant (interim-scope decision -- Story 3.4 owns the
 * real Driving/Riding mechanism); `driving`'s glow-alpha `55` is the same
 * hex-alpha convention as ButtonDestructive/HudCard above.
 */
export const StatusPill = {
  minHeight: 48,
  minWidth: 48,
  radius: Rounded.full,
  riding: { background: Colors.surfaceDuskHigh, foreground: Colors.inkPrimary, borderColor: Colors.borderHairline },
  driving: { background: Colors.accentElectric, foreground: Colors.surfaceMidnight, glowColor: `${Colors.accentElectric}55` },
};

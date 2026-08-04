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
// migration comment for why). Own literal Wayfinder values (DESIGN.md
// frontmatter `colors`), not derived from the legacy `Colors.player*` fields
// above -- Story 4.3 re-tuned coral/teal/lime and renamed "gold" to "amber"
// conceptually (the `gold` *key* itself is unchanged: it's a persisted
// voyage_members.player_color / PlayerColor union value, a DB/behavior
// concern this re-skin story must not touch -- only its mapped hex moved).
// violet/sky/pink/slate keep their Night Drive hex values.
export const PlayerColors = {
  coral: '#FF5A5F',
  teal: '#00C2A8',
  violet: '#9B6BFF',
  gold: '#FFB020',
  sky: '#4FB4FF',
  lime: '#8CC63F',
  pink: '#FF8FD8',
  slate: '#8C9AC4',
} as const;

// Font-family values reference the exact weight-specific keys loaded by
// _layout.tsx's useFonts(FONT_ASSETS) call, not the bare face names ("Clash
// Display", "General Sans", "Space Mono") -- React Native doesn't synthesize
// a family+fontWeight combination into the correct loaded variant, each
// weight has to be its own literal family name (see _layout.tsx's own
// comment). `fontWeight` fields are kept for documentation/semantic value
// and because many call sites destructure them directly, even though the
// weight is already baked into the loaded font file itself.
export const Typography = {
  // -0.02em @ 40px = -0.8 (React Native's letterSpacing is absolute points, not em).
  displayHero: {
    fontFamily: 'ClashDisplay-Semibold',
    fontSize: 40,
    fontWeight: '600',
    lineHeight: 42,
    letterSpacing: -0.8,
  },
  display: {
    fontFamily: 'ClashDisplay-Semibold',
    fontSize: 28,
    fontWeight: '600',
    lineHeight: 31,
  },
  headline: {
    fontFamily: 'GeneralSans-Semibold',
    fontSize: 20,
    fontWeight: '600',
    lineHeight: 24,
  },
  body: {
    fontFamily: 'GeneralSans-Regular',
    fontSize: 16,
    fontWeight: '400',
    lineHeight: 24,
  },
  // -0.01em @ 32px = -0.32 (React Native's letterSpacing is absolute points, not em).
  statNumeral: {
    fontFamily: 'SpaceMono-Bold',
    fontSize: 32,
    fontWeight: '700',
    lineHeight: 32,
    letterSpacing: -0.32,
  },
  // +0.04em @ 13px = 0.52; 1.3 line-height ratio @ 13px = 16.9 (React Native's
  // letterSpacing/lineHeight are absolute points, not em/ratio).
  label: {
    fontFamily: 'GeneralSans-Semibold',
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
 * Wayfinder v2 global color primitives (DESIGN.md frontmatter `colors`,
 * Story 4.3). Distinct from `Colors` above (still the Night Drive palette,
 * kept untouched -- Story 4.4 still depends on it for the screens it hasn't
 * re-skinned yet). Story 4.4 will need these same primitives for its own
 * re-skin; defining them once here, rather than only inline in Live Map's
 * own components, avoids reinventing them a second time.
 */
export const WayfinderColors = {
  inkPrimary: '#101828',
  inkSecondary: '#667085',
  inkDisabled: '#98A2B3',
  surfacePrimary: '#FFFFFF',
  surfaceSecondary: '#F4F6FA',
  surfaceTertiary: '#EDEFF3',
  borderHairline: '#DCE1EA',
  accentPrimary: '#0B6FFF',
  accentPrimaryPressed: '#0653C7',
  accentTeal: '#00C2A8',
  accentCoral: '#FF5A5F',
  accentAmber: '#FFB020',
  success: '#1F9D6E',
  error: '#FF5A5F',
  warning: '#B87700',
  // Story 4.4: the one deliberate exception to "no dark surfaces" (DESIGN.md
  // #Colors) -- reserved exclusively for Trust Moment/Driver Attention
  // Consent, never a general-purpose dark mode. Literally the same hex as
  // inkPrimary above, but named for what it *is* (a full-bleed surface) at
  // its two call sites, not left as a coincidental reuse of a text color.
  surfaceInkNavy: '#101828',
  inkOnNavyPrimary: '#FFFFFF',
  inkOnNavySecondary: '#A6B4CC',
} as const;

/**
 * map-banner component spec (DESIGN.md#components, Wayfinder v2 -- Story
 * 4.3): the solid, non-floating top destination banner replacing the old
 * floating `hud-top` HudCard. `eyebrowColor`/pin-icon amber are transcribed
 * directly from mockups/key-live-map.html's `.dest-eyebrow`/`.pin-icon`.
 */
export const MapBanner = {
  height: 110,
  background: WayfinderColors.accentPrimary,
  destNameColor: '#FFFFFF',
  eyebrowColor: '#C7DEFF',
  pinIconBackground: WayfinderColors.accentAmber,
  voyagerCountBackground: WayfinderColors.accentPrimaryPressed,
} as const;

/**
 * hud-bar component spec (DESIGN.md#components, Wayfinder v2 -- Story 4.3):
 * the solid, non-floating bottom dock replacing the old floating `hud-
 * bottom` HudCard and its always-visible per-Voyager roster (Story 4.3's own
 * Scope decision -- that roster is dropped, not relocated, to match
 * mockups/key-live-map.html exactly; names/roles stay reachable via the
 * Action Drawer's member list, distance via the marker peek card).
 */
export const HudBar = {
  height: 104,
  background: WayfinderColors.surfaceSecondary,
  borderTopColor: WayfinderColors.borderHairline,
  recenterBackground: WayfinderColors.accentTeal,
} as const;

/**
 * map-marker component spec (DESIGN.md#components, Wayfinder v2 -- Story
 * 4.3). `size` is 44px here, not DESIGN.md's own 40px token -- mockups/
 * key-live-map.html's real `.avatar` measures 44px, and per EXPERIENCE.md's
 * fidelity rule ("where this document and a mockup ever disagree on how it
 * looks, that's a bug to resolve, not a case where this document silently
 * wins"), the mockup wins; DESIGN.md's own 40px token needs a follow-up
 * correction. The avatar's own fill is the per-Voyager player color itself
 * (resolved from PlayerColors below, not a static value here) -- ringWidth/
 * ringBorderColor describe the plain white ring *around* that colored fill,
 * a structural inversion from Night Drive's dark-fill/colored-ring
 * treatment (see `VoyagerMarker` in active-voyage.tsx).
 */
export const MapMarker = {
  size: 44,
  hitRegion: 48,
  radius: Rounded.full,
  ringWidth: 3,
  ringBorderColor: '#FFFFFF',
  chevronColor: WayfinderColors.inkPrimary,
  trailFadeDurationMs: 600,
  trailLengthMs: 8000,
};

/**
 * status-pill component spec (DESIGN.md#components, Wayfinder v2 -- Story
 * 4.3). No glow field -- Wayfinder has no glow treatment anywhere
 * (DESIGN.md#Elevation & Depth); Driving's old glow-alpha shadow is removed
 * entirely, not re-colored.
 */
export const StatusPill = {
  minHeight: 48,
  minWidth: 48,
  radius: Rounded.full,
  riding: { background: WayfinderColors.surfacePrimary, foreground: WayfinderColors.inkPrimary, borderColor: WayfinderColors.borderHairline },
  driving: { background: WayfinderColors.accentTeal, foreground: '#FFFFFF' },
};

/**
 * action-drawer component spec (DESIGN.md#components, Wayfinder v2 --
 * Story 4.2). Uses its own literal Wayfinder-palette values rather than the
 * shared `Colors` object above, which is still the Night Drive palette
 * pending Stories 4.3/4.4's full re-skin -- merging these into `Colors` now
 * would either collide with or prematurely repaint every other still-dark
 * screen this story doesn't touch. `scrimColor` is a fully solid fill, not a
 * translucent overlay -- its opacity only animates 0->1 as the open
 * transition itself (see EXPERIENCE.md#Motion & Transitions); at rest, fully
 * open, it's solid, consistent with Wayfinder's "no transparency anywhere."
 *
 * row* fields are transcribed directly from mockups/key-live-map.html's real
 * `.drawer-row` computed CSS (12px radius, 13px/14px padding, 10px
 * margin-bottom, 13.5px font) -- literal, not snapped to the Rounded/Spacing
 * scale, per DESIGN.md's own "Shapes" note sanctioning this for values that
 * fall between two scale steps (code review finding: an earlier pass
 * approximated these to Rounded.md/Spacing['3']/Spacing['2'], which drifted
 * from the mockup -- exactly the kind of mistranscription this epic's own
 * fidelity rule exists to catch).
 */
export const ActionDrawer = {
  width: 270,
  background: '#FFFFFF',
  scrimColor: '#1D2A44',
  rowRadius: 12,
  rowPaddingVertical: 13,
  rowPaddingHorizontal: 14,
  rowMarginBottom: 10,
  rowFontSize: 13.5,
  rowBackground: '#F4F6FA',
  rowBackgroundPrimary: '#E7F0FF',
  rowBackgroundPrimaryText: '#0B6FFF',
  rowBackgroundDanger: '#FFEBEC',
  rowBackgroundDangerText: '#FF5A5F',
  ink: '#101828',
  inkSecondary: '#667085',
  hairline: '#DCE1EA',
  // .drawer-footer's mockup color -- used nowhere else, not worth adding to
  // the shared Colors object for a single decorative line.
  footerText: '#98A2B3',
} as const;

/**
 * Live Map's new hamburger trigger (DESIGN.md#components, Wayfinder v2 --
 * Story 4.2), replacing the old "..." glyph button. Own literal Wayfinder
 * values, same reasoning as ActionDrawer above -- not merged into the
 * shared (Night Drive) `Colors` object yet.
 */
export const Hamburger = {
  size: 42,
  radius: 12,
  background: '#FFFFFF',
  iconColor: '#0B6FFF',
} as const;

/**
 * action-drawer open/close motion spec (EXPERIENCE.md#Motion & Transitions
 * -- Story 4.2). Panel and scrim are independently timed, matching
 * mockups/motion-demo.html's real CSS exactly (code review finding, resolved
 * by user decision 2026-08-03: the interactive prototype is the source of
 * truth here, not EXPERIENCE.md's earlier "same duration" simplification,
 * which has been corrected to match). Reversed (same durations/easings) on
 * close. Disabled entirely under Reduce Motion -- see action-drawer.tsx.
 */
export const ActionDrawerMotion = {
  panelDurationMs: 280,
  panelEasing: [0.22, 0.85, 0.35, 1] as const,
  // scrimEasing is CSS's standard "ease" keyword expressed as its equivalent
  // cubic-bezier curve, matching motion-demo.html's `transition: opacity
  // 0.26s ease` literally rather than approximating via RN's built-in
  // Easing.ease (whose exact curve isn't the same function).
  scrimDurationMs: 260,
  scrimEasing: [0.25, 0.1, 0.25, 1] as const,
};

/**
 * "Cut to gameplay" entry transition (EXPERIENCE.md#Motion & Transitions,
 * DESIGN.md's Screens section -- Story 4.3). Fires entering Live Map from
 * Destination Picker (Organizer) or Join + OTP completion (Voyager), never
 * on cold relaunch mid-Voyage. Exact keyframes transcribed from
 * mockups/motion-demo.html's `.flash`/`.map-enter` CSS (`flashPulse`/
 * `mapEnter` @keyframes), not approximated. `flashEasing` is CSS's standard
 * "ease-out" keyword expressed as its equivalent cubic-bezier curve, same
 * convention as ActionDrawerMotion.scrimEasing above (RN's built-in
 * Easing.out(Easing.ease) isn't the same curve). `flashKeyframes`/
 * `flashOpacityStops`/`flashScaleStops` are the 0% / 35% / 100% stops from
 * `@keyframes flashPulse`, meant to drive a single 0->1 Animated.Value via
 * `.interpolate()` rather than a two-segment Animated.sequence -- much
 * closer to how CSS keyframe percentage stops actually work. Disabled
 * entirely under Reduce Motion -- Live Map simply appears, no flash or pop.
 */
export const CutToGameplayMotion = {
  flashDurationMs: 500,
  flashEasing: [0, 0, 0.58, 1] as const,
  flashKeyframeStops: [0, 0.35, 1] as const,
  flashOpacityStops: [0, 1, 0] as const,
  flashScaleStops: [0.85, 1.04, 1.2] as const,
  mapEnterDurationMs: 420,
  mapEnterDelayMs: 220,
  mapEnterEasing: [0.16, 1, 0.3, 1] as const,
  mapEnterScaleFrom: 1.06,
};

/**
 * button-ignition component spec (DESIGN.md#components, Wayfinder v2 --
 * Story 4.4). `Wayfinder`-prefixed to avoid colliding with the legacy
 * (Night Drive) `ButtonIgnition` above, which stays untouched until nothing
 * references it anymore (see this story's Dev Notes). No gradient -- flat
 * `accentPrimary` fill, since Wayfinder has no gradients/blur/glow anywhere.
 * `pressedShadow` is a literal flat offset shadow (not blurred), matching
 * mockups/key-otp-signin.html's and key-home.html's real
 * `box-shadow:0 6px 0 #0653C7` exactly.
 */
export const WayfinderButtonIgnition = {
  background: WayfinderColors.accentPrimary,
  foreground: '#FFFFFF',
  disabledBackground: WayfinderColors.borderHairline,
  disabledForeground: WayfinderColors.inkDisabled,
  radius: Rounded.full,
  minHeight: 56,
  pressedShadowColor: WayfinderColors.accentPrimaryPressed,
  pressedShadowOffset: 6,
} as const;

/**
 * button-ignition-inverse component spec (DESIGN.md#components, Wayfinder
 * v2 -- Story 4.4): the reversed white-fill variant used only on the two
 * full-bleed accent-primary hero screens (Voyage Intro, Join Invitation),
 * where a solid-primary button would vanish against its own-color
 * background.
 */
export const WayfinderButtonIgnitionInverse = {
  background: '#FFFFFF',
  foreground: WayfinderColors.accentPrimary,
  radius: Rounded.full,
  minHeight: 56,
} as const;

/**
 * button-secondary component spec (DESIGN.md#components, Wayfinder v2 --
 * Story 4.4): a bordered "fog-fill" pill (e.g. Voyage Ended's
 * back-to-home-button) -- structurally different from the legacy
 * `ignition-button.tsx` "secondary" variant's old unbordered text-link
 * look. Some controls (e.g. OTP's resend link) call for a plain-text
 * treatment instead -- see ignition-button.tsx's own "text" variant for
 * those, not this token.
 */
export const WayfinderButtonSecondary = {
  background: WayfinderColors.surfaceSecondary,
  foreground: WayfinderColors.inkPrimary,
  borderColor: WayfinderColors.borderHairline,
  borderWidth: 2,
  radius: Rounded.full,
  minHeight: 48,
} as const;

/**
 * button-destructive component spec (DESIGN.md#components, Wayfinder v2 --
 * Story 4.4). Kept in sync even though none of this story's 8 screens
 * currently use the destructive variant -- ignition-button.tsx is the one
 * shared component every screen routes through.
 */
export const WayfinderButtonDestructive = {
  background: '#FFEBEC',
  foreground: WayfinderColors.accentCoral,
  radius: Rounded.md,
  minHeight: 48,
} as const;

/**
 * card component spec (DESIGN.md#components, Wayfinder v2 -- Story 4.4):
 * "the flat, solid surface used everywhere a hud-card's glass fill used to
 * be -- Voyage Ended's summary panel, drawer rows, the OTP/Destination
 * Picker field containers." Flat offset shadow, no blur -- same convention
 * as WayfinderButtonIgnition's pressedShadow above.
 */
export const WayfinderCard = {
  background: WayfinderColors.surfacePrimary,
  borderColor: WayfinderColors.borderHairline,
  radius: Rounded.lg,
  shadowColor: WayfinderColors.borderHairline,
  shadowOffset: 2,
} as const;

/**
 * horizon-strip component spec (DESIGN.md#components, Wayfinder v2 -- Story
 * 4.4): the ambient decorative footer band on OTP Sign-In/Verify and
 * Destination Picker, keeping either screen from reading as "flatly,
 * silently white." Values transcribed directly from both mockups'
 * identical `.horizon`/`.dash-track`/`.dash` CSS (key-otp-signin.html,
 * key-destination-picker.html use the exact same numbers). Freezes to a
 * static frame under Reduce Motion (DESIGN.md: "reducedMotion: 'freezes to
 * a static frame'").
 */
export const HorizonStrip = {
  height: 96,
  skyGradient: ['#EDF3FF', '#E1EDFF', '#D6E6FF'] as const,
  borderTopColor: '#DCE9FF',
  skyGlowColor: '#FFE9BE',
  skyGlowOpacity: 0.7,
  roadLineColor: '#C7D6EC',
  dashColor: '#FFB020',
  dashWidth: 26,
  dashHeight: 6,
  dashGap: 22,
  driftDurationMs: 3200,
} as const;

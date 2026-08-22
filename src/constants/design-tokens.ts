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
 * marker-peek-card component spec (DESIGN.md#components, Story 4.5/4.6 --
 * "Pop & Bounce"). Deliberately bigger/more playful than Wayfinder's usual
 * restraint -- a contained exception in the same family as
 * CutToGameplayMotion above, not a palette-wide change. See
 * EXPERIENCE.md#Motion & Transitions for the full binding spec this mirrors.
 * cardScaleKeyframeStops/cardScaleStops and hopKeyframeStops/hopTranslateY
 * both drive their own progress `.interpolate()`, same technique
 * CutToGameplayMotion's flashKeyframeStops/flashScaleStops already uses --
 * a single bezier-eased Animated.timing genuinely cannot reproduce a curve
 * that overshoots past 1 and then dips back below it before settling (code
 * review finding, Story 4.6: verified by evaluating the actual
 * cubic-bezier(.22,1.5,.36,1) curve numerically -- it peaks once around
 * ~1.08 then decays monotonically to 1.0, never reaching 1.12 or dipping to
 * 0.94). Disabled entirely under Reduce Motion.
 */
export const MarkerPeekCardMotion = {
  openDurationMs: 420,
  openEasing: [0.22, 1.5, 0.36, 1] as const,
  cardScaleKeyframeStops: [0, 0.55, 0.78, 1] as const,
  cardScaleStops: [0.3, 1.12, 0.94, 1] as const,
  closeDurationMs: 180,
  closeEasing: [0.5, 0, 0.9, 0] as const,
  cardScaleFrom: 0.3,
  markerHopDurationMs: 420,
  markerHopEasing: [0.34, 1.56, 0.64, 1] as const,
  hopKeyframeStops: [0, 0.35, 0.6, 1] as const,
  hopTranslateY: [0, -10, 2, 0] as const,
  sparkCount: 6,
  sparkBurstDurationMs: 480,
  sparkColor: WayfinderColors.accentAmber,
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

/**
 * splash-thread component spec (DESIGN.md#components `splash-thread`,
 * EXPERIENCE.md Motion & Transitions "Splash Screen ('The Thread')" --
 * 2026-08-04). Plays once per cold launch. All positions/the path `d` are
 * transcribed directly from mockups/key-splash-screen.html's 300x620
 * reference frame -- the component scales them to the real device by
 * multiplying x by `screenWidth / referenceWidth` and y by
 * `screenHeight / referenceHeight` (a non-uniform stretch, matching how
 * every other full-bleed Wayfinder screen fills the device rather than
 * letterboxing). Reduce Motion collapses straight to the settled end state
 * (thread drawn, sparks in place, wordmark up) with one soft crossfade --
 * no draw, pop, or ripple -- same rule as every other Motion & Transitions
 * entry.
 */
export const SplashThread = {
  referenceWidth: 300,
  referenceHeight: 620,
  background: ['#EDF3FF', '#E1EDFF', '#D6E6FF'] as const,
  threadColor: WayfinderColors.accentAmber,
  threadWidth: 4,
  rippleColor: WayfinderColors.accentPrimary,
  wordmarkColor: WayfinderColors.inkPrimary,
  taglineColor: WayfinderColors.inkSecondary,
  tagline: 'Every journey tells a story.',
  // Path 'd' and dot centers, verbatim from the mockup's reference frame.
  pathD: 'M60,220 C90,110 190,90 230,170 C270,230 190,260 150,360',
  pathLength: 420,
  dots: [
    { color: PlayerColors.teal, cx: 80, cy: 220, popDelayMs: 120 },
    { color: PlayerColors.coral, cx: 230, cy: 170, popDelayMs: 260 },
    { color: PlayerColors.gold, cx: 150, cy: 380, popDelayMs: 400 },
  ],
  dotRadius: 20,
  sparks: [
    { cx: 123, cy: 133, delayMs: 1100 },
    { cx: 227, cy: 201, delayMs: 1420 },
    { cx: 191, cy: 275, delayMs: 1620 },
  ],
  rippleOrigin: { cx: 135, cy: 155 },
  wordmarkBottom: 100,
  // Phase timing (ms from mount) -- see EXPERIENCE.md for the authoritative
  // prose spec this mirrors exactly.
  dotPopDurationMs: 420,
  threadDrawDelayMs: 620,
  threadDrawDurationMs: 1150,
  sparkPopDurationMs: 500,
  rippleDelayMs: 1760,
  rippleDurationMs: 700,
  wordmarkDelayMs: 1900,
  wordmarkDurationMs: 460,
  taglineDelayMs: 2200,
  taglineDurationMs: 400,
  // Total time before handing off to the resolved route; matches the
  // mockup's "idle hold" starting point rather than its (demo-only)
  // infinite loop.
  totalDurationMs: 2600,
  // Reduce Motion: single soft crossfade to the fully-settled state.
  reducedCrossfadeDurationMs: 400,
  reducedHoldMs: 600,
} as const;

/**
 * home-journey component spec (DESIGN.md#components `home-journey`,
 * EXPERIENCE.md Motion & Transitions "Home Journey ('Memory Sparks')" --
 * Story 4.7/4.8, 2026-08-06). Home's resting state: a perspective road with
 * three illustrative player-color crew dots bobbing on it, a heartbeat glow
 * at the vanishing point, matching-color sparks lifting toward the
 * wordmark, and the wordmark's own breathing glow. Purely ambient and
 * looping -- unlike SplashThread above, nothing here ever "finishes."
 * `roadSurfaceColor`/`landGradient` are literal hex, not `WayfinderColors.*`
 * -- DESIGN.md's own `home-journey` token block deliberately doesn't reuse
 * Live Map's map-road tokens (see that block's own comment). Keyframe
 * stops/value arrays below are transcribed directly from
 * mockups/key-home.html's `@keyframes` rules (`bob`, `heartbeat`, `rise`,
 * `wordGlow`) -- several are non-monotonic (heartbeat, wordGlow) and need
 * the progress+`.interpolate()` keyframe technique, not a single
 * Easing.bezier `Animated.timing` (same limitation as MarkerPeekCardMotion
 * above).
 */
export const HomeJourneyMotion = {
  roadHeightPercent: 58,
  roadSurfaceColor: '#E8EAEE',
  landGradient: ['#EAF2E4', '#DCEBD3', '#C9E0BC'] as const,
  landGradientLocations: [0, 0.55, 1] as const,
  centerlineColor: WayfinderColors.accentAmber,
  centerlineDriftDurationMs: 900,
  crewDots: [
    { color: PlayerColors.teal, left: '46%', bottom: '46%', size: 20 },
    { color: PlayerColors.coral, left: '58%', bottom: '40%', size: 15 },
    { color: PlayerColors.gold, left: '40%', bottom: '36%', size: 12 },
  ] as const,
  crewDotBobDurationMs: 2400,
  crewDotStaggerMs: 600,
  crewDotBobKeyframeStops: [0, 0.5, 1] as const,
  crewDotBobTranslateY: [0, -5, 0] as const,
  revealGlowColor: WayfinderColors.accentAmber,
  revealGlowHeartbeatDurationMs: 2600,
  revealGlowKeyframeStops: [0, 0.45, 1] as const,
  revealGlowScaleStops: [0.85, 1.3, 0.85] as const,
  revealGlowOpacityStops: [0.5, 0.9, 0.5] as const,
  memorySparks: [
    { color: PlayerColors.teal, left: '47%', bottom: '48%' },
    { color: PlayerColors.coral, left: '59%', bottom: '42%' },
    { color: PlayerColors.gold, left: '41%', bottom: '38%' },
  ] as const,
  memorySparkDurationMs: 5000,
  memorySparkStaggerMs: 1600,
  // Mockup's `rise` keyframes only set `transform` (which carries scale) at
  // 0%/100% -- 12%/80% only set opacity -- so CSS interpolates scale
  // continuously across the full span. `memorySparkKeyframeStops` below is
  // for opacity only; scale uses its own plain [0, 1] range (code review
  // finding, Story 4.8: an earlier pass wrongly reused the opacity stops for
  // scale too, fabricating a false hold at 1.0 between 12%-80%).
  memorySparkKeyframeStops: [0, 0.12, 0.8, 1] as const,
  memorySparkOpacityStops: [0, 1, 0.9, 0] as const,
  memorySparkScaleStops: [0.6, 1.1] as const,
  // Fraction of screen height the spark rises, not a literal px -- mirrors
  // SplashThread's own reference-frame scaling above (mockup's -360px on an
  // 844px-tall preview frame).
  memorySparkRiseFraction: 360 / 844,
  wordmarkGlowColor: WayfinderColors.accentAmber,
  wordmarkGlowDurationMs: 4000,
  wordmarkGlowKeyframeStops: [0, 0.5, 1] as const,
  wordmarkGlowScaleStops: [0.94, 1.05, 0.94] as const,
  wordmarkGlowOpacityStops: [0.5, 1, 0.5] as const,
  tagline: 'Every journey tells a story.',
} as const;

/**
 * memory-lane-aurora / memory-lane-card / memory-lane-deck component specs
 * (DESIGN.md#components, Story 6.2/6.3). The full-bleed "Player
 * Constellation" background behind the Memory Lane reveal deck and the
 * Persistent Journey Screen (at reduced opacity there). Blob positions/radii/
 * opacities per card are transcribed directly from
 * mockups/key-memory-lane-reveal.html's real per-frame SVG circles -- not
 * randomly generated, so this mock stays the pixel-exact reference AC2
 * requires. `dots-nav`'s progress-dot styling and `content-panel` (the
 * floating white data panel) are shared across every card that needs one.
 *
 * Implementation note (this story): react-native-reanimated/
 * react-native-gesture-handler are both present in package.json but, verified
 * during this story, are not actually used anywhere else in this codebase --
 * every other Motion & Transitions entry (Pop & Bounce, cut-to-gameplay,
 * Home Journey, Splash Thread) is built on React Native core's own `Animated`
 * API. This story follows that same established convention for entrance
 * choreography (`Animated.Value` + `.interpolate()`), and uses core
 * `PanResponder` (also core RN, no new library) for the deck's swipe gesture,
 * rather than introducing Reanimated's separate worklet-based animation
 * model for this one screen.
 */
export const MemoryLaneAurora = {
  baseSurface: '#F4F6FA',
  // Per-card blob layout [cx, cy, r, color, opacity], transcribed from the
  // mockup's own per-frame <svg> (viewBox 0 0 300 649). Card indices: 0 =
  // trigger, 1-5 = the five content cards, 6 = closing beat.
  blobsByCard: [
    [
      [70, 180, 180, PlayerColors.teal, 0.22],
      [260, 140, 160, PlayerColors.coral, 0.18],
      [180, 480, 200, PlayerColors.gold, 0.2],
      [20, 560, 150, WayfinderColors.accentPrimary, 0.12],
    ],
    [
      [90, 220, 170, PlayerColors.teal, 0.24],
      [230, 300, 150, PlayerColors.coral, 0.2],
      [160, 420, 190, PlayerColors.gold, 0.2],
    ],
    [
      [110, 260, 170, PlayerColors.teal, 0.22],
      [210, 220, 140, PlayerColors.gold, 0.22],
      [160, 360, 150, PlayerColors.coral, 0.2],
    ],
    [
      [70, 160, 170, PlayerColors.teal, 0.18],
      [250, 500, 200, PlayerColors.coral, 0.16],
      [150, 600, 170, PlayerColors.gold, 0.18],
    ],
    [
      [200, 180, 190, PlayerColors.gold, 0.22],
      [80, 470, 160, PlayerColors.teal, 0.16],
    ],
    [
      [90, 200, 180, PlayerColors.teal, 0.2],
      [230, 260, 160, PlayerColors.coral, 0.18],
      [150, 440, 200, PlayerColors.gold, 0.2],
    ],
    [
      [150, 300, 220, PlayerColors.teal, 0.12],
      [150, 300, 220, PlayerColors.coral, 0.08],
      [150, 300, 220, PlayerColors.gold, 0.08],
    ],
  ] as const,
  viewBoxWidth: 300,
  viewBoxHeight: 649,
} as const;

export const MemoryLaneCard = {
  background: WayfinderColors.surfacePrimary,
  borderColor: WayfinderColors.borderHairline,
  radius: Rounded.xl,
  shadowColor: WayfinderColors.borderHairline,
  shadowOffset: 3,
  padding: Spacing['5'],
  openDurationMs: 550,
  openEasing: [0.22, 1, 0.36, 1] as const,
};

export const MemoryLaneDeck = {
  cardCount: 5,
  progressDotInactive: 'rgba(16,24,40,0.18)',
  progressDotActive: WayfinderColors.accentPrimary,
  // WCAG 2.5.1: swipe is the primary interaction, but a path-based gesture
  // must have a non-gesture equivalent -- left/right edge tap zones,
  // matching this fraction of the screen width each, always advance/retreat
  // the deck identically. Not a visible chevron/button (keeps the full-bleed
  // cards uninterrupted) but a real, always-present 44pt/48dp+ tap target.
  edgeTapZoneWidthFraction: 0.2,
  // dotPop (badges/dots), converge (destination card's dots flying inward),
  // fadeUp (text/panels), fillBar (stops card's bars), crownDrop (superlatives
  // card's crown) -- exact curves transcribed from EXPERIENCE.md's Motion &
  // Transitions "End Voyage -> Memory Lane Reveal" / the mockup's own
  // @keyframes.
  dotPopDurationMs: 500,
  dotPopEasing: [0.34, 1.56, 0.64, 1] as const,
  convergeDurationMs: 800,
  convergeEasing: [0.2, 1.4, 0.4, 1] as const,
  fadeUpDurationMs: 700,
  fadeUpEasing: [0.25, 0.1, 0.25, 1] as const, // CSS ease-out equivalent, same convention as this file's other *Easing fields.
  fadeUpTranslateY: 14,
  fillBarDurationMs: 900,
  fillBarEasing: [0.22, 1, 0.36, 1] as const,
  crownDropDurationMs: 500,
  crownDropEasing: [0.3, 1.6, 0.4, 1] as const,
  // Closing beat.
  ringPulseDurationMs: 3000,
  burstOutDurationMs: 900,
  // Swipe/tap-advance transition (deck between cards) -- not itself named in
  // EXPERIENCE.md as a card-content animation, so it reuses fadeUp's own
  // restrained timing/easing family rather than inventing a new one.
  cardTransitionDurationMs: 360,
  cardTransitionEasing: [0.22, 0.85, 0.35, 1] as const,
} as const;

// voyage-history-row's destination-color-coded lead dot (Story 6.4, DESIGN.md
// #voyage-history-row) -- "not a player color," so it needs its own palette,
// genuinely distinct from every PlayerColors hex (not a reuse under a
// different key, which was this story's own first, colliding attempt: 4 of
// its 5 colors turned out byte-identical to real PlayerColors values,
// defeating the whole point of the rule -- code review finding, 2026-08-22).
export const VoyageHistoryRowDotColors = [
  '#0B6FFF', // same as WayfinderColors.accentPrimary -- no PlayerColors entry shares this hex, so it's already safe to reuse directly.
  '#4C5FD5', // indigo
  '#2F9E6E', // forest green
  '#C2478E', // berry
  '#A9672F', // rust
] as const;


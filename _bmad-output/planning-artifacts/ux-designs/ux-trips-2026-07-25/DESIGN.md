---
status: final
created: 2026-07-25
updated: 2026-08-11
sources:
  - _bmad-output/planning-artifacts/prds/prd-trips-2026-07-25/prd.md
  - _bmad-output/brainstorming/brainstorm-group-road-trip-tracker-2026-07-21/brainstorm.html
  - _bmad-output/planning-artifacts/research/market-group-road-trip-coordination-and-travel-social-app-market-voylo-research-2026-07-24.md
  - _bmad-output/planning-artifacts/sprint-change-proposal-2026-08-02.md
  - _bmad-output/planning-artifacts/sprint-change-proposal-2026-08-06.md
  - _bmad-output/planning-artifacts/sprint-change-proposal-2026-08-10.md
  - docs/VOYLO-LIVING-VOYLO-FEATURE-CONCEPT.md
---

name: Voylo
description: Group road-trip live-presence and shareable-recap app (iOS/Android, v1). Reads as entertainment, not a safety/navigation utility — a game-like shared world the Voyager is a character inside, not a tracker they check.
colors:
  # WAYFINDER — v2 identity, replacing "Night Drive" (v1's dark/glassmorphic system,
  # retired after user feedback that it read as unclear and hard to navigate).
  # Solid colors only — no transparency, no blur, no glassmorphism anywhere, in any
  # component. Confident but restrained saturation, closest to Waze's actual product
  # register: colorful and icon-forward without tipping into a full arcade palette.
  surface-primary: '#FFFFFF'
  surface-secondary: '#F4F6FA'
  surface-tertiary: '#EDEFF3'
  border-hairline: '#DCE1EA'
  ink-primary: '#101828'
  ink-secondary: '#667085'
  ink-disabled: '#98A2B3'
  accent-primary: '#0B6FFF'
  accent-primary-pressed: '#0653C7'
  accent-teal: '#00C2A8'
  accent-coral: '#FF5A5F'
  accent-amber: '#FFB020'
  success: '#1F9D6E'
  error: '#FF5A5F'
  warning: '#B87700'
  # ink-navy is a deliberately narrow exception: the ONLY full-bleed dark surface
  # left in the system, reserved exclusively for the two onboarding consent moments
  # (Trust Moment, Driver Attention Consent) where a low-drama, serious register is
  # correct. It is not a "dark mode" — Wayfinder has no dark/light duality, no
  # Daylight toggle; ink-navy is a one-off, intentional surface for two screens only.
  surface-ink-navy: '#101828'
  ink-on-navy-primary: '#FFFFFF'
  ink-on-navy-secondary: '#A6B4CC'
  # scrim-navy is distinct from surface-ink-navy — used only behind action-drawer,
  # a solid navy fill (not a translucent dimming layer) that fades in as the
  # drawer opens. Not reused anywhere else.
  scrim-navy: '#1D2A44'
  # Player colors — the fixed, distinct hue assigned to each Voyager for their map
  # marker, motion trail, and any per-Voyager stat coloring. Reduced from 8 to 3
  # confirmed hues in the mocked flow (coral/teal/amber); the remaining 5 from the
  # v1 Night Drive palette (violet, sky, lime, pink, slate) carry forward unchanged
  # in hue assignment order — only coral/teal/amber were re-tuned for Wayfinder,
  # since those are the three that appear in every mock. `[ASSUMPTION: violet/sky/
  # lime/pink/slate need an on-device pass against the new surface-primary white to
  # confirm they still read as distinct and AA-legible — they were tuned against
  # Night Drive's dark surfaces originally, not validated against white yet.]`
  player-coral: '#FF5A5F'
  player-teal: '#00C2A8'
  player-amber: '#FFB020'
  player-violet: '#9B6BFF'
  player-sky: '#4FB4FF'
  player-lime: '#8CC63F'
  player-pink: '#FF8FD8'
  player-slate: '#8C9AC4'
  # Horizon-strip tokens — the ambient footer component that keeps otherwise-plain
  # functional screens (OTP, Destination Picker) from reading as flatly unfinished.
  horizon-sky-top: '#EDF3FF'
  horizon-sky-mid: '#E1EDFF'
  horizon-sky-bottom: '#D6E6FF'
  horizon-sun-glow: '#FFE9BE'
  horizon-road-line: '#C7D6EC'
  horizon-dash: '#FFB020'
  # Map tokens
  map-land-top: '#EAF2E4'
  map-land-bottom: '#DCEBD3'
  map-lake: '#6FB6FF'
  map-road: '#FFFFFF'
  map-road-border: '#DCE1EA'
  map-road-centerline: '#FFB020'
typography:
  display-hero:
    fontFamily: 'Clash Display'
    fontSize: 40px
    fontWeight: '600'
    lineHeight: '1.05'
    letterSpacing: -0.02em
  display:
    fontFamily: 'Clash Display'
    fontSize: 28px
    fontWeight: '600'
    lineHeight: '1.1'
    letterSpacing: -0.01em
  headline:
    fontFamily: 'General Sans'
    fontSize: 20px
    fontWeight: '600'
    lineHeight: '1.2'
  body:
    fontFamily: 'General Sans'
    fontSize: 16px
    fontWeight: '400'
    lineHeight: '1.5'
  body-sm:
    fontFamily: 'General Sans'
    fontSize: 14px
    fontWeight: '400'
    lineHeight: '1.4'
  label:
    fontFamily: 'General Sans'
    fontSize: 13px
    fontWeight: '600'
    lineHeight: '1.3'
    letterSpacing: 0.04em
  caption:
    fontFamily: 'General Sans'
    fontSize: 12px
    fontWeight: '400'
    lineHeight: '1.35'
  stat-numeral:
    fontFamily: 'Space Mono'
    fontSize: 32px
    fontWeight: '700'
    lineHeight: '1.0'
    letterSpacing: -0.01em
  stat-numeral-sm:
    fontFamily: 'Space Mono'
    fontSize: 18px
    fontWeight: '700'
    lineHeight: '1.0'
rounded:
  sm: 10px
  md: 18px
  lg: 28px
  xl: 36px
  full: 9999px
spacing:
  '1': 4px
  '2': 8px
  '3': 12px
  '4': 16px
  '5': 24px
  '6': 32px
  '7': 48px
  '8': 64px
  gutter: 20px
  margin-mobile: 20px
  hero-gap: 40px
components:
  # button-ignition: white text at 16-17px/700 on accent-primary measures ~4.44:1 —
  # marginally under the 4.5:1 AA normal-text threshold (large-text 3:1 passes with
  # room). This is a documented, deliberate near-miss, not an oversight: darkening
  # the fill to guarantee 4.5:1 would mean shipping a visibly different blue than
  # every approved mock, and mockup-fidelity is now a hard requirement (see
  # sprint-change-proposal-2026-08-02.md). `[ASSUMPTION: flag for a dedicated
  # on-device contrast pass before wide release — if it fails in practice, prefer
  # bumping label size to 18px+ (crosses into large-text 3:1 territory) over
  # changing accent-primary itself.]`
  button-ignition:
    background: '{colors.accent-primary}'
    foreground: '#FFFFFF'
    radius: '{rounded.full}'
    minHeight: 56px
    pressedShadow: '0 6px 0 {colors.accent-primary-pressed}'
    pressedTransform: 'translateY(3px)'
  # button-ignition-inverse: the reversed white-fill variant used only on the two
  # full-bleed accent-primary hero screens (Voyage Intro, Join Invitation), where a
  # solid-primary button would vanish against its own-color background.
  button-ignition-inverse:
    background: '#FFFFFF'
    foreground: '{colors.accent-primary}'
    radius: '{rounded.full}'
    minHeight: 56px
  button-secondary:
    background: '{colors.surface-secondary}'
    foreground: '{colors.ink-primary}'
    border: '2px solid {colors.border-hairline}'
    radius: '{rounded.full}'
    minHeight: 48px
  button-destructive:
    background: '#FFEBEC'
    foreground: '{colors.accent-coral}'
    radius: '{rounded.md}'
    minHeight: 48px
  # card: the flat, solid surface used everywhere a hud-card's glass fill used to
  # be — Voyage Ended's summary panel, drawer rows, the OTP/Destination Picker
  # field containers. No blur, no opacity tricks; a hairline border plus a flat
  # 2px offset shadow is the entire depth cue (see Elevation & Depth).
  card:
    background: '{colors.surface-primary}'
    border: '1px solid {colors.border-hairline}'
    radius: '{rounded.lg}'
    shadow: '0 2px 0 {colors.border-hairline}'
  input-field:
    background: '{colors.surface-primary}'
    border: '2px solid {colors.border-hairline}'
    borderFocused: '2px solid {colors.accent-primary}'
    radius: 14px
    minHeight: 56px
  # map-marker: unchanged in mechanism from v1 (circular player-color avatar, 40px
  # visual / 48px hit-region, heading chevron, comet-trail) — this redesign re-skins
  # the ring/fill colors to the new player-* tokens but keeps the component's shape
  # and behavior identical, per the decision to NOT move to car icons or character
  # tokens.
  map-marker:
    size: 40px
    hitRegion: 48px
    radius: '{rounded.full}'
    ringWidth: 3px
    ringColor: '{colors.player-*}'
    ringBorder: '3px solid #FFFFFF'
    chevronColor: '{colors.ink-primary}'
    trailFadeDuration: 600ms
    trailLength: 8s
  # marker-peek-card — NEW 2026-08-06 (Sprint Change Proposal 2026-08-06,
  # Story 4.5). The per-Voyager card opened by tapping map-marker. Content
  # expanded from v1's name/role/distance-from-you to add live coordinates,
  # distance-from-destination, a copy control, and a Get Directions control.
  # Motion spec ("Pop & Bounce") lives in EXPERIENCE.md's Motion &
  # Transitions section. mockups/key-marker-peek-card.html is the
  # pixel-exact reference, promoted from .working/direction-combo-final.html.
  marker-peek-card:
    background: '{colors.surface-primary}'
    border: '1px solid {colors.border-hairline}'
    radius: '{rounded.md}'
    minWidth: 230px
    shadow: '0 8px 20px 0 #10182833'
    openDuration: 420ms
    openEasing: 'cubic-bezier(.22,1.5,.36,1)'
    openPeakScale: 1.12
    closeDuration: 180ms
    closeEasing: 'cubic-bezier(.5,0,.9,0)'
    markerHopDuration: 420ms
    markerHopEasing: 'cubic-bezier(.34,1.56,.64,1)'
    sparkBurstColor: '{colors.accent-amber}'
    sparkBurstDuration: 480ms
    sparkCount: 6
    coordRow:
      background: '{colors.surface-secondary}'
      radius: '{rounded.sm}'
      text: 'monospace, 12.5px/700, letter-spacing -0.01em (Space Mono stand-in at reduced size — no dedicated token yet)'
      format: 'decimal degrees + cardinal direction, e.g. "36.5054° N, 121.9018° W"; copies as that same string'
    copyButton:
      size: 26px
      hitRegion: 44px
      radius: '{rounded.sm}'
      background: '{colors.surface-primary}'
      border: '1px solid {colors.border-hairline}'
      copiedBackground: '{colors.success}'
      copiedIconMorph: 'clipboard icon → checkmark, ~250ms crossfade, holds 1.1s then reverts'
    navigateButton:
      size: 26px
      hitRegion: 44px
      radius: '{rounded.sm}'
      background: '{colors.accent-primary}'
      icon: 'filled arrow, white'
      visibility: 'other-Voyager cards only — omitted entirely on the self card, same rationale as distance-from-you'
      action: "opens the device's default maps app (Apple Maps on iOS / Google Maps on Android) with driving directions from the tapping Voyager to the tapped Voyager"
    statPair:
      layout: 'side-by-side, divided by 1px {colors.border-hairline}, below the coordinate row'
      numeralTypography: '{typography.stat-numeral-sm}'
      captionTypography: '{typography.caption}'
      fromYouColor: '{colors.accent-teal}'
      toDestinationColor: '{colors.warning}'
      # `[ASSUMPTION: accent-teal/warning at stat-numeral-sm's 18px/700 weight
      # sit right at the WCAG large-text boundary (18.66px bold) — needs an
      # on-device contrast pass, same open item already flagged for
      # button-ignition above; darken toward success/error-strength values if
      # it fails in practice.]`
    reducedMotion: 'card and marker appear/disappear instantly — no scale, hop, or spark; see EXPERIENCE.md Accessibility Floor'
  # status-pill: unchanged mechanism from v1 (Riding/Driving role switch, the single
  # most safety-critical control) — re-skinned to solid Wayfinder tokens, glow
  # replaced with a flat fill since Wayfinder has no glow treatment at all (see
  # Elevation & Depth).
  status-pill:
    minHeight: 48px
    minWidth: 48px
    paddingX: '{spacing.4}'
    radius: '{rounded.full}'
    riding:
      background: '{colors.surface-primary}'
      foreground: '{colors.ink-primary}'
      border: '2px solid {colors.border-hairline}'
    driving:
      background: '{colors.accent-teal}'
      foreground: '#FFFFFF'
    label: '{typography.label}'
  # action-drawer — NEW component, replaces organizer-sheet entirely. Triggered by
  # the hamburger icon docked in the Live Map top banner; slides in from the right
  # edge with a scrim fade behind it (see Motion & Transitions, EXPERIENCE.md).
  # Houses End Voyage / Grant Organizer Status / Remove Voyager — same three rows
  # organizer-sheet held, same modal-depth rule (row tap swaps the drawer's own
  # content to a confirm step, never a stacked second dialog).
  # scrim-navy is its own distinct solid color, not a translucent surface-ink-navy
  # — consistent with "no transparency anywhere in Wayfinder": the scrim's opacity
  # only animates 0→1 as the OPEN transition itself (see Motion & Transitions); at
  # rest, fully open, it is a fully solid fill, not a permanently dimmed overlay.
  action-drawer:
    width: 270px
    background: '{colors.surface-primary}'
    scrim: '{colors.scrim-navy}'
    scrimRestOpacity: 1.0
    rowRadius: '{rounded.md}'
    rowBackground: '{colors.surface-secondary}'
    rowBackgroundPrimary: '#E7F0FF'
    rowBackgroundDanger: '#FFEBEC'
  # horizon-strip — NEW ambient component. A 96px footer band, purely decorative
  # (no interaction, no EXPERIENCE.md behavioral entry needed), used on screens
  # that would otherwise be flatly white end-to-end: OTP Sign-In/Verify and
  # Destination Picker. A slow-scrolling dashed lane-line loop plus a soft sky
  # gradient — the one place motion exists purely for texture, not feedback.
  horizon-strip:
    height: 96px
    background: 'linear-gradient(180deg, {colors.horizon-sky-top} 0%, {colors.horizon-sky-mid} 55%, {colors.horizon-sky-bottom} 100%)'
    borderTop: '1px solid {colors.horizon-road-line}'
    dashColor: '{colors.horizon-dash}'
    dashSize: '26px x 6px'
    dashGap: 22px
    driftDuration: 3.2s
    reducedMotion: 'freezes to a static frame'
  # map-banner — NEW component: the solid top destination banner that replaces
  # the floating top hud-card on Live Map. Non-floating, full-width, sits above
  # the map viewport rather than over it.
  map-banner:
    height: 110px
    background: '{colors.accent-primary}'
    destNameTypography: '{typography.headline}'
    destNameColor: '#FFFFFF'
    eyebrowColor: '#C7DEFF'
  # hud-bar — the bottom stat dock on Live Map, replacing the floating bottom
  # hud-card. Non-floating, full-width, docked to the bottom edge above the
  # safe area — a flat surface-secondary bar, not a card floating over the map.
  hud-bar:
    height: 104px
    background: '{colors.surface-secondary}'
    borderTop: '1px solid {colors.border-hairline}'
    statNumeralTypography: '{typography.stat-numeral}'
  join-code-card:
    background: '{colors.surface-primary}'
    border: '2px solid {colors.accent-primary}'
    radius: '{rounded.xl}'
  nudge-toast:
    background: '{colors.surface-primary}'
    foreground: '{colors.ink-primary}'
    border: '1px solid {colors.border-hairline}'
    radius: '{rounded.md}'
    accentBar: '{colors.accent-teal}'
  fun-fact-badge:
    background: '{colors.accent-amber}'
    foreground: '{colors.ink-primary}'
    radius: '{rounded.full}'
    padding: '{spacing.2} {spacing.4}'
  # app-icon — "The Unfinished Loop." Resolves the prior placeholder-icon
  # assumption. Three player-color dots, deliberately apart (not converged),
  # joined by a dashed thread that almost but doesn't quite close — "the story
  # isn't finished yet." Dash rhythm intentionally echoes map-road-centerline.
  app-icon:
    background: '{colors.accent-primary}'
    threadColor: '#FFFFFF'
    threadDash: '1px 9px @ 100x100 viewBox (scales with size)'
    threadWidth: 4px
    dots: ['{colors.player-teal}', '{colors.player-coral}', '{colors.player-amber}']
    cornerRadius: '~22% of icon width (export full square; platform applies its own mask)'
  # splash-thread — the splash-screen sequence. See EXPERIENCE.md Motion &
  # Transitions for the binding phase timing; mockup is the authoritative
  # visual/timing reference (mockups/key-splash-screen.html).
  splash-thread:
    background: 'linear-gradient(180deg, {colors.horizon-sky-top} 0%, {colors.horizon-sky-mid} 60%, {colors.horizon-sky-bottom} 100%)'
    dots: ['{colors.player-teal}', '{colors.player-coral}', '{colors.player-amber}']
    threadColor: '{colors.accent-amber}'
    rippleColor: '{colors.accent-primary}'
    wordmarkColor: '{colors.ink-primary}'
    taglineColor: '{colors.ink-secondary}'
    totalDuration: '~2.6s to idle hold'
    reducedMotion: 'settled end-state, single crossfade, no draw/pop/ripple'
  # memory-lane-aurora — NEW 2026-08-11 (Story 6.2, Sprint Change Proposal
  # 2026-08-10 / "Player Constellation"). The full-bleed background system
  # behind every Memory Lane reveal card, the shareable group card, and
  # Voyage History's empty state: 3-4 large soft radial washes of the
  # player-color tokens overlapping on a surface-secondary field, reaching
  # every edge (no plain leftover area -- a hard requirement after an
  # earlier direction shipped with color only in the top portion of the
  # frame). Two directions were explored and rejected: "Road & Reveal"
  # (extended home-journey's road/glow motif) and "Ignition Bloom" (full-
  # bleed accent-primary + theatrical amber bursts) -- both archived in
  # .working/ for reference, neither carried forward. Distinct per screen
  # via which 3-4 aurora blob positions/colors are used, not a fixed asset.
  # `[NOTE 2026-08-11, accessibility review]` Purely decorative -- exclude
  # from the accessibility tree (aria-hidden / accessibilityElementsHidden)
  # on every screen it appears on, same as horizon-strip/home-journey.
  # Documented contrast floor: in multi-blob overlap zones (3-4 blobs
  # stacking, e.g. the reveal trigger screen), ink-secondary text can drop
  # to ~2.67:1, under the 4.5:1 AA floor -- ink-primary stays safe (~9.5:1+)
  # even in worst-case overlap. Body/caption-weight text therefore must
  # either sit inside a memory-lane-card panel (safe, opaque white) or use
  # ink-primary, never ink-secondary/ink-disabled directly on raw aurora.
  memory-lane-aurora:
    baseSurface: '{colors.surface-secondary}'
    blobColors: ['{colors.player-teal}', '{colors.player-coral}', '{colors.player-amber}']
    blobOpacity: '0.14-0.24 depending on blob size (larger blob, lower opacity)'
    blobCount: '3-4 per screen, positions vary by card -- not a fixed asset'
    textOnAuroraRule: 'ink-primary only, or move the text into a memory-lane-card panel -- ink-secondary/ink-disabled directly on raw aurora fails AA in overlap zones'
  # memory-lane-card — the floating content panel used on every reveal card
  # that carries readable data (who-joined, stops, superlatives, finale) or
  # copy over the memory-lane-aurora background. Reuses the existing `card`
  # token's visual language (white, hairline border, flat offset shadow) at
  # a larger radius, so data stays legible without breaking the full-bleed
  # background rule -- opening/destination-style cards with just a headline
  # sit directly on the aurora with no panel.
  memory-lane-card:
    background: '{colors.surface-primary}'
    border: '1px solid {colors.border-hairline}'
    radius: '{rounded.xl}'
    shadow: '0 3px 0 {colors.border-hairline}'
    padding: '{spacing.5}'
    openDuration: 550ms
    openEasing: 'cubic-bezier(.22,1,.36,1)'
    openTransform: 'translateY(18px) scale(0.97) -> translateY(0) scale(1), opacity 0 -> 1'
  # memory-lane-deck — the swipeable full-screen reveal itself. 7 screens in
  # sequence: trigger/CTA, 5 content cards, closing beat. Progress dots
  # (Stories-style) map only to the 5 content cards, hidden on the trigger
  # and closing screens. Swipe is bidirectional (forward and back).
  memory-lane-deck:
    cardCount: 5
    progressDots:
      inactiveColor: '{colors.player-teal}, opacity reduced (rgba equivalent ~0.16-0.4 depending on background)'
      activeColor: '{colors.accent-primary}'
      activeShape: 'pill, widens from a dot on activation'
      accessibility: 'decorative visually, but the position they represent is announced via VoiceOver/TalkBack as "card N of 5" on each card -- see EXPERIENCE.md Accessibility Floor'
    swipeDirection: 'bidirectional'
    # `[NOTE 2026-08-11, accessibility review]` WCAG 2.5.1: a path-based
    # gesture must have a non-gesture equivalent. Swipe is the primary
    # interaction, but left/right tap zones (roughly the outer ~20% of the
    # screen width each) advance/retreat the deck identically -- not a
    # visible chevron/button (keeps the full-bleed cards uninterrupted),
    # but a real, always-present tap target satisfying the same 44pt/48dp
    # floor as everything else in the system.
    navigation: 'swipe (primary) or tap the left/right ~20% edge zones (non-gestural fallback, always present, 44pt/48dp minimum) -- never swipe-only'
    contentEntrance: 'staggered per-element: dots/badges pop in (dotPop, 500ms cubic-bezier(.34,1.56,.64,1)), destination-card dots converge inward (converge, 800ms cubic-bezier(.2,1.4,.4,1)), text/panels fade up (fadeUp, ~600ms ease-out), stat bars fill (fillBar, 900ms cubic-bezier(.22,1,.36,1)), the superlatives card\'s crown drops in (crownDrop, 500ms cubic-bezier(.3,1.6,.4,1)) -- see EXPERIENCE.md Motion & Transitions "End Voyage -> Memory Lane Reveal" for exact timings; any other card-specific entrance animation not named here is covered by this same umbrella pattern'
    reducedMotion: 'cards still swipe/tap-advance (the navigation itself is not decorative), but per-element entrance choreography (pop/fade/fill/converge/crownDrop staggers) is skipped -- each card\'s content appears in its settled state immediately, matching the same reduced-motion floor as home-journey below'
    focusOnActivate: 'keyboard/switch-control focus moves to the newly active card\'s heading when it becomes active -- not just an announcement while focus stays put'
  # memory-lane-share-card — the single external artifact, distinct from
  # the 5-card personal deck above. The only Memory Lane surface carrying a
  # Voylo wordmark, since it's the one thing that leaves the app (the
  # Living Voylo doc's "Send me your Voylo" acquisition loop). Confirmed
  # direction: quote-led (the trip's emotional quote as the hero element,
  # not the crew avatars -- a crew-led alternate was explored and archived
  # in .working/). Portrait 9:16, matching common story/status share
  # formats. mockups/key-memory-lane-share-card.html is the reference.
  memory-lane-share-card:
    aspectRatio: '9:16'
    background: '{components.memory-lane-aurora}'
    wordmark: 'small, top-left -- three player-color dots + "Voylo" wordmark text, {typography.label}-tier size'
    heroContent: 'the trip\'s closing quote (see Voice and Tone), destination headline, avatar-stack + voyager count, stat pair in a memory-lane-card panel'
    statCaptionColor: '{colors.ink-secondary} -- not ink-disabled, which fails AA (~2.58:1) on the white memory-lane-card panel at caption size'
    consentException: 'exempt from the per-person external-share consent gate (see EXPERIENCE.md Trust, Privacy & Consent) -- shows only names/avatars/aggregate stats, the same information already visible to every Voyager on Live Map throughout the trip, not tagged individual content like a photo. Re-evaluate this exception if/when this card ever gains individual photos.'
  # voyage-history-row — a list row in the Voyage History screen. Reuses
  # the existing `card` token (not memory-lane-aurora -- History is a
  # utility browse/search screen, deliberately restrained next to the
  # reveal's full-bleed drama, per the established "reserve Clash Display/
  # full-bleed hero treatments for emotional-beat screens" rule).
  voyage-history-row:
    background: '{colors.surface-primary}'
    border: '1px solid {colors.border-hairline}'
    radius: '{rounded.lg}'
    shadow: '0 2px 0 {colors.border-hairline}'
    leadDot: 'destination-color-coded dot, {rounded.full}, not a player color -- distinguishes trips from Voyagers'
    content: 'destination name ({typography.headline}), date + voyager count ({typography.caption}), total miles ({typography.stat-numeral-sm}), chevron'
    tap: 'replays the full memory-lane-deck reveal from the start -- see EXPERIENCE.md State Patterns'
    entrance: 'rows fade/slide up in a staggered list-load sequence (rowIn, ~400ms, staggered ~80ms apart) -- disabled under Reduce Motion, rows simply appear'
    accessibility: 'each row announces as "{destination}, {total miles} miles, {date}, {voyager count} voyagers, button" -- see EXPERIENCE.md Accessibility Floor'
  # search-field — NEW 2026-08-11 (Story 6.2). Voyage History's
  # always-visible destination search. No prior token existed for a search
  # input anywhere in the system.
  search-field:
    background: '{colors.surface-secondary}'
    border: '2px solid {colors.border-hairline}'
    radius: '{rounded.md}'
    minHeight: 48px
    placeholderColor: '{colors.ink-secondary} -- not ink-disabled, which both fails AA (~2.4:1) and visually implies the field is disabled when it\'s fully active'
    accessibleLabel: 'a persistent "Search past Voyages by destination" label, not the placeholder text alone (placeholders are not a substitute for an accessible label)'
  # voyage-history-empty — the first-visit empty state. The one place this
  # otherwise-utility screen borrows the memory-lane-aurora/emotional-beat
  # register: its job is converting a new voyager, not just informing them.
  voyage-history-empty:
    background: '{components.memory-lane-aurora}'
    heroMotif: 'the three orbiting player-color dots from the trigger screen (memory-lane-deck), reused here as a "your story is still ahead of you" echo -- continuous orbit loop, disabled under Reduce Motion (freezes to a static frame, same fallback pattern as memory-lane-deck\'s trigger screen)'
    cta: '{components.button-ignition}, "Start a Voyage"'
  # journey-screen — the persistent per-Voyage screen. Landed on when the
  # reveal deck closes; reached again by tapping a voyage-history-row (which
  # replays the deck, closing back to this same screen); the actual entry
  # point for both share formats. Calmer register than the reveal itself --
  # this is a page a Voyager returns to, not an entrance moment, so it
  # sits on plain surface-secondary with a low-opacity memory-lane-aurora
  # wash rather than the reveal's full-intensity background.
  journey-screen:
    background: '{colors.surface-secondary}'
    auroraOpacity: 'reduced ~40% from memory-lane-aurora\'s reveal-deck intensity'
    replayHero: 'a memory-lane-card-style panel with a play-icon thumbnail, "Watch your Voylo again," card count + running time -- tap replays memory-lane-deck from the start. The play-icon\'s ambient shimmer loop (opacity pulse, 2.4s) is disabled under Reduce Motion.'
    statSummary: 'duration / distance / stop count, {typography.stat-numeral-sm} triplet in a memory-lane-card panel'
    statCaptionColor: '{colors.ink-secondary} -- not ink-disabled, same AA fix as memory-lane-share-card above'
    shareRow: 'two controls side by side -- "Share the card" ({components.button-ignition}) and "Share the video" (secondary/outline variant) -- see EXPERIENCE.md Component Patterns "Shareable Group Card" for what each produces, and State Patterns for the generation-in-progress/failure state'
    navControls: 'back and overflow icon buttons render at a 34px visual size but must carry a 44pt/48dp minimum hit region via invisible hit-slop padding -- same visual-vs-hit-region split already established for map-marker (40px visual / 48px hit region)'
  # home-journey — NEW 2026-08-06 (Sprint Change Proposal 2026-08-06,
  # Story 4.7, "Memory Sparks"). Full description lives once in Screens
  # below (Home entry) and EXPERIENCE.md's Motion & Transitions "Home
  # Journey" subsection — not restated here (code review finding, Story
  # 4.7: this block was triple-narrating itself, the same issue already
  # fixed for marker-peek-card in Story 4.5).
  home-journey:
    roadHeightPercent: 58
    # #E8EAEE, not '{colors.map-road}' (#FFFFFF) -- literal, deliberately
    # muted value (code review finding, Story 4.7: the token originally
    # pointed at map-road but the approved mockup, key-home.html, never
    # used that color). A perspective road read at dusk/atmosphere reads
    # better slightly grayed than Live Map's flat top-down white road.
    roadSurfaceColor: '#E8EAEE'
    landGradient: 'linear-gradient(180deg, {colors.map-land-top} 0%, {colors.map-land-bottom} 55%, #C9E0BC 100%)'
    centerlineColor: '{colors.map-road-centerline}'
    centerlineDriftDurationMs: 900
    crewDots: ['{colors.player-teal}', '{colors.player-coral}', '{colors.player-amber}']
    crewDotBobDurationMs: 2400
    crewDotStaggerMs: 600
    revealGlowColor: '{colors.accent-amber}'
    revealGlowHeartbeatDurationMs: 2600
    memorySparkDurationMs: 5000
    memorySparkStaggerMs: 1600
    wordmarkGlowColor: '{colors.accent-amber}'
    wordmarkGlowDurationMs: 4000
    reducedMotion: 'road, crew dots, glow, and sparks all appear as a single static frame -- no drift, bob, pulse, or rise'

---

## Brand & Style

Voylo is not a tracker you check. It's a road-trip game world you're a character inside — the PRD is explicit that competitors (Life360, Zello, Convoy Tracker) all read as safety/navigation utilities first, and Voylo is deliberately, aggressively not that. That anti-reference is a positioning constraint, not a palette constraint: it survives this redesign unchanged even though the visual execution underneath it has completely changed.

**Wayfinder** is the v2 identity, replacing v1's "Night Drive" system (a dark-mode-primary, glassmorphic-HUD design) after real user testing on the built app called it "semi-transparent, dark, and bad navigation." Wayfinder answers that directly: solid colors everywhere (no transparency, no blur, no glass, anywhere in the system), a confident-but-restrained blue/teal/coral/amber palette, and icon-forward chrome — the closest reference point is Waze's actual product register, not Waze's turn-by-turn navigation function. The game-like, entertainment-first anti-utility positioning from the PRD is honored by staying colorful and characterful, not by staying dark.

Three typefaces still carry the whole system, unchanged from v1. **Clash Display** owns every emotional beat — Voyage Intro, the Join invitation, Memory Lane titles (v1.1). **General Sans** runs everything functional. **Space Mono** is reserved exclusively for stat numerals. See Typography below — none of this changed in the Wayfinder pass; only color, elevation, and select components did.

`[RESOLVED 2026-08-04: the app icon and splash screen are now specced — see app-icon and splash-thread in Components below. Both replace the placeholder Expo-default assets that predated any Wayfinder work.]`

**Brand throughline.** The tagline **"Every journey tells a story. We make sure you never miss it."** and the "send me your Voylo" ambition (§Brand & Style history) carry forward unchanged — these are copy/positioning decisions, untouched by the visual pivot. The Voyage Intro and Join Invitation screens still carry the tagline as real on-screen copy (see Screens below).

## Colors

The palette reads as clear and confident rather than moody — a bright, legible world with four accent colors that each own exactly one job, the same division-of-labor principle Night Drive used, just executed in solid, opaque values instead of dark/glass ones.

- **Surface Primary (`#FFFFFF`)**, **Surface Secondary (`#F4F6FA`)**, and **Surface Tertiary (`#EDEFF3`)** are the three flat surface tones — white for content canvases and cards, fog-gray for HUD fills and secondary panels, a slightly deeper fog for the outermost page background behind mockup frames. No tonal-elevation trickery is needed the way Night Drive's dusk/dusk-high pairing provided depth on a dark base — see Elevation & Depth.
- **Ink Primary (`#101828`)**, **Ink Secondary (`#667085`)**, **Ink Disabled (`#98A2B3`)** are the text tones, all set against light surfaces now (the inverse of Night Drive's light-on-dark).
- **Accent Primary (`#0B6FFF`)** is the primary brand action color — Voyage Intro, Destination Picker's enabled CTA, the Live Map banner, Join, the Wayfinder identity's signature blue. Warm confidence, not corporate: the same job Ignition Coral did in Night Drive, recast in blue because blue is what reads as "wayfinding, trustworthy, in motion" against a light system the way coral read as "ignition" against a dark one. **Accent Primary Pressed (`#0653C7`)** is its pressed/shadow state only — never used as a resting fill.
- **Teal (`#00C2A8`)** keeps its Night Drive job: *live and moving*. The recenter control, the Driving-role status-pill fill, the Trust Moment badge (reassurance-adjacent to "this is real and active"). Never used for buttons or static UI.
- **Coral (`#FF5A5F`)** is the alert/destructive color and Chintan's player color in every mock — End Voyage / Remove Voyager rows, error states.
- **Amber (`#FFB020`)** is the highlight/achievement color — Driver Consent's badge, the horizon-strip's road dashes, Sam's player color, the future home of `fun-fact-badge` (v1.1, unbuilt but tokened).
- **Player colors** (coral, teal, amber, violet, sky, lime, pink, slate — 8 total, same count as v1) are a separate palette from the four brand accents, one-per-Voyager. Coral/teal/amber are the three validated against every mocked screen (Chintan/Meera/Sam); the remaining five carry forward from Night Drive pending an on-device legibility pass against the new white surface (see frontmatter assumption note).
- **Ink Navy (`#101828`)** is the one deliberate exception to "no dark surfaces": a full-bleed background used only on Trust Moment and Driver Attention Consent, the two low-drama consent screens. This is not a dark-mode toggle and has no Daylight counterpart — Wayfinder has a single palette, not two.
- **Horizon-strip tokens** (`horizon-sky-*`, `horizon-sun-glow`, `horizon-road-line`, `horizon-dash`) exist only to serve the `horizon-strip` component (see Components) — a pale blue-sky gradient and amber lane-dash, never used elsewhere.
- **Map tokens** (`map-land-*`, `map-lake`, `map-road*`) replace Night Drive's glowing-light-trail-road treatment with a literal-but-stylized flat-toned terrain (green-to-sage land gradient, blue lake, white roads with an amber centerline) — closer to the "Wayfinder" name's implied register than Night Drive's neon-on-midnight world.
- **Success (`#1F9D6E`) / Error (`#FF5A5F`, shared with Coral) / Warning (`#B87700`)** — Error intentionally reuses the Coral value since Coral's whole job in Wayfinder (End Voyage, Remove Voyager, alerts) already is "this needs attention," unlike Night Drive where accent and error were kept deliberately distinct.

Avoid: any use of transparency, blur, or glassmorphism anywhere in the system (this is the one hard rule this entire redesign exists to enforce); using Accent Primary for anything that isn't a primary action or the Live Map banner; introducing a second Ink Navy surface anywhere outside Trust Moment/Driver Consent; reusing a player color for brand chrome.

## Typography

Unchanged from v1 — see the frontmatter `typography` block. Clash Display for emotional-beat screens (`display-hero`, `display`), General Sans for everything functional, Space Mono for stat numerals only. The Wayfinder redesign did not touch type; all mock font-family declarations using system-font stand-ins (Segoe UI Semibold, Consolas, etc.) are placeholder substitutions made only because the real licensed faces aren't available in an HTML preview environment — production must use the real three-typeface system specified here, not the mock's stand-ins.

## Layout & Spacing

Unchanged from v1 — see the frontmatter `spacing` block (4px base unit, `margin-mobile` 20px, `hero-gap` 40px). The Live Map still runs full-bleed to the device edge; everywhere else uses the standard scale.

## Elevation & Depth

Wayfinder has no glow, no blur, and no tonal-elevation trickery — the three mechanisms Night Drive used for depth. Depth here comes from exactly two things:

**Flat offset shadows.** A `card` surface (Voyage Ended's summary panel, input containers, drawer rows) is bounded by a 1px hairline border and a flat, non-blurred offset shadow (`0 2px 0 border-hairline`) — a "cut paper" depth cue, not a soft drop shadow. `button-ignition` uses the same idea at a larger scale: a 6px flat offset in `accent-primary-pressed`, which collapses to 3px on press, giving the button a physically "pushed" feel without any glow.

**Solid color fields, not layered tone.** Where Night Drive stepped `surface-dusk` → `surface-dusk-high` for elevation, Wayfinder simply uses a different named surface (`surface-primary` white vs. `surface-secondary` fog) as a flat field change — there is no "raised" reading beyond that contrast, and that is intentional: Wayfinder's flatness is the point, in deliberate contrast to Night Drive's moodier layering.

There is no glow treatment anywhere in Wayfinder. Where Night Drive used glow to mean "alive or earned" (an active marker's pulse, the Ignition button's coral halo), Wayfinder communicates the same ideas through flat color and motion instead — see `status-pill`'s Driving-state fill and Motion & Transitions in `EXPERIENCE.md` for the animated equivalents (map-marker pulse/chevron, drawer slide, screen transitions).

## Shapes

Unchanged rounding philosophy from v1 — generous, no sharp (0px) corners anywhere. Component-specific radii in this pass sometimes use a literal pixel value rather than snapping to the named scale (`rounded.sm/md/lg/xl/full`) where the built mocks measured a value between two tokens — e.g. `input-field`'s 14px sits between `sm` (10px) and `md` (18px). This is a deliberate fidelity choice: matching the approved mocks exactly takes priority over forcing every radius onto the abstract scale. See each component's `radius` value in the frontmatter block for its exact figure.

Map markers stay circles (a Voyager's avatar in a colored ring), never pins — unchanged from v1, and explicitly not replaced with car icons or character tokens (a considered, rejected alternative — see `sprint-change-proposal-2026-08-02.md`).

## Components

`[NOTE: several entries below link an HTML mockup for reference. Mockup fidelity is now a hard requirement — see sprint-change-proposal-2026-08-02.md and epics.md Stories 4.1-4.4. Where this document and a mockup ever disagree, treat that as a bug to resolve, not a case where this document silently wins.]`

### Screens

**Splash Screen** *(Ships: v1)* [mockup](mockups/key-splash-screen.html) — "The Thread." Cold-launch-only, plays once automatically before the app resolves to OTP Entry, Home, or a resumed Live Map. Three player-color dots appear apart, an `accent-amber` thread draws itself between them with sparks marking collected moments, resolves to the Voylo wordmark and "Every journey tells a story." Built to answer two rejected directions: a gentle drift on a dark-navy field read as too calm and broke Wayfinder's no-dark-surfaces rule, and a flash/comet-collision treatment read as exciting but conceptually disconnected from what Voylo actually is. This one is grounded directly in the brand promise — see Brand & Style — and the product's actual mechanic (separate Voyagers, one connected Voyage, quietly collected moments). Full phase timing in `EXPERIENCE.md` Motion & Transitions.

**OTP Sign-In / Verify** *(Ships: v1)* [mockup](mockups/key-otp-signin.html) — Still plumbing, not a brand moment: `surface-primary` white canvas, no color-blocking on the content itself. The one change from v1: a `horizon-strip` now closes out the bottom of the screen so it never reads as flatly, silently white — this was direct user feedback on the first Wayfinder pass ("every screen that has only and just white background looks very unprofessional"). `[RECONSIDERED 2026-08-06, Story 4.7]` User feedback named this screen as part of a "dead" front door alongside Home — deliberately kept low-friction and copy-unchanged on reconsideration (OTP's speed is a real virtue, not an oversight), but `horizon-strip` itself is the answer here: its amber dash color already matches Home's new road motif below, giving OTP a quiet, restrained echo of the same world at zero added cost or risk to the auth flow's speed.

**Home (no active Voyage)** *(Ships: v1 base — a Past Voyages list is v1.1)* [mockup](mockups/key-home.html) — `[REDESIGNED 2026-08-06, Story 4.7 — supersedes the "unchanged structure... revisit if feedback says otherwise" note this entry originally carried]` Home is the app's actual front door for a first-time Voyager, and the prior "quiet resting state" read as empty rather than anticipatory. New treatment, "Memory Sparks": a stylized perspective road fills the bottom ~58% of the screen (same road-in-perspective language as the map's own `map-road-centerline`), three small player-color dots (teal/coral/amber) bob gently in place partway up the road — an illustrative preview of "your crew," not real data — and a warm amber glow pulses at the road's vanishing point like a heartbeat, with matching-color sparks continuously lifting off each dot and drifting up toward the wordmark before fading. The tagline's first half ("Every journey tells a story.") appears as real on-screen copy for the first time on this screen — no subhead; the `home-journey` visual carries the rest of the promise instead of more words — and the wordmark itself carries a slow breathing glow so it reads as a little alive, not a static label. `button-ignition` ("Start a Voyage") and its caption ("Gather your crew and hit the road.") are unchanged in position and copy from v1.

**Trust Moment** *(Ships: v1)* [mockup](mockups/key-trust-moment.html) — Full-bleed `surface-ink-navy`, a teal icon badge, `display`-weight headline, one `button-ignition`. The exception to Wayfinder's all-light palette (see Colors) — deliberately low-drama and serious, distinct from every other screen's white/fog canvas.

**Driver Attention Consent** *(Ships: v1)* [mockup](mockups/key-driver-consent.html) — Same `surface-ink-navy` treatment as Trust Moment (same onboarding pass, shown immediately after it), amber badge instead of teal to distinguish "caution" from "reassurance" without breaking the shared low-drama register.

**Voyage Intro** *(Ships: v1)* [mockup](mockups/key-voyage-intro.html) — The app's biggest emotional beat, and the one screen allowed to fill the frame with `accent-primary` itself: full-bleed blue, `display-hero` headline in white, `button-ignition-inverse` (white fill, blue label) since a solid-blue button would vanish on a solid-blue field. A faint dashed road-motif and a small amber destination-dot nod at the Live Map without any glow or gradient animation. Canonical copy unchanged from v1 (see `EXPERIENCE.md` Voice and Tone).

**Destination Picker** *(Ships: v1)* [mockup](mockups/key-destination-picker.html) — Quiet and functional by design (the emotional lift already happened one screen back): `surface-primary` white, one destination field, `button-ignition` disabled (fog-gray) until filled, then full `accent-primary`. Gains the same `horizon-strip` treatment as OTP for the same reason.

**Join Invitation** *(Ships: v1)* [mockup](mockups/key-join-invitation.html) — Shares Voyage Intro's full-bleed `accent-primary` hero and `button-ignition-inverse` so the two cinematic moments read as one family. The one new motif: an overlapping three-avatar stack in player colors (coral/teal/amber), a wordless "people are already here" signal before any names are known. Canonical copy unchanged from v1.

**Live Map (Voyage View)** *(Ships: v1 base)* [mockup](mockups/key-live-map.html) — Restructured from v1's full-bleed map with floating top/bottom `hud-card` docking to a solid, non-floating `map-banner` (destination name, always visible) with the full map rendered below it. Each Voyager renders as the unchanged `map-marker` mechanism, re-skinned to the new player-color tokens. The organizer entry point moves from a bottom-docked button to the `hamburger` icon inside the `map-banner`, opening `action-drawer`. Tapping a marker opens `marker-peek-card` — see Components below.

**Voyage Ended** *(Ships: v1 — this is v1's actual terminal state)* [mockup](mockups/key-voyage-ended.html) — Deliberately understated next to Voyage Intro/Join Invitation, unchanged in intent from v1: `surface-secondary` fog canvas, one `card` summary panel (destination, duration, Voyager count in `stat-numeral`), one `button-secondary` back to Home.

**Memory Lane Reveal** *(Ships: v1.1)* [mockup](mockups/key-memory-lane-reveal.html) — "Player Constellation." Fires at End Voyage completion (superseding Voyage Ended above once v1.1 ships) and again on demand from Voyage History. A full-screen, swipeable, 7-screen sequence built on `memory-lane-deck`/`memory-lane-aurora`/`memory-lane-card`: a trigger screen with orbiting player-color dots and a "Show me my Voylo" CTA; five content cards (destination, who-joined, stops, superlatives, finale) each full-bleed `memory-lane-aurora` with data in a floating `memory-lane-card` panel; a closing beat (dashed ring, player-color dots, amber burst, "Until the next one, crew."). Navigation is swipe *or* tap the left/right edge zones — never swipe-only, per `memory-lane-deck.navigation`. `memory-lane-aurora`'s blobs, the orbiting/progress dots, and the spark/burst effects are all purely decorative — excluded from the accessibility tree — while VoiceOver/TalkBack announces each card's actual content and position ("card N of 5") on activation. Two other directions were explored and explicitly rejected — "Road & Reveal" (extended `home-journey`'s road/glow grammar) and "Ignition Bloom" (full-bleed `accent-primary` + theatrical amber bursts) — both archived in `.working/` for reference. Cards 3-4 (stops/superlatives) ship v1.1 with Story 5.1 spotting-tap data (a tally + a "most spots logged" superlative); they upgrade in place to richer coffee-champion/rest-stop content once stop intelligence (a separate initiative) clears its precision gates — same deck slots, no rework of the rest of the deck.

**Shareable Group Card** *(Ships: v1.1)* [mockup](mockups/key-memory-lane-share-card.html) — `memory-lane-share-card` token. The single external artifact distinct from the personal reveal deck — the only Memory Lane surface carrying a Voylo wordmark, since it's the one thing that leaves the app. Quote-led: the trip's closing quote as the hero element, destination headline, avatar-stack + voyager count, a stat pair. Offered alongside a stitched video (all 5 reveal cards with transitions) as a second share format — both remain available, neither replaces the other.

**Voyage History** *(Ships: v1.1)* [mockup](mockups/key-voyage-history.html) — Reached from Home, extending the Past Voyages list stub. Deliberately restrained next to the reveal's drama: always-visible search field, a simple `voyage-history-row` list (destination + total miles), no `memory-lane-aurora` background. Tapping a row replays the full `memory-lane-deck` from the start. The one exception to the restrained register is the first-visit empty state (`voyage-history-empty`) — it borrows the full emotional-beat treatment (aurora, orbiting dots, warm copy, Start-a-Voyage CTA) since converting a new voyager is this state's actual job.

**Persistent Journey Screen** *(Ships: v1.1)* [mockup](mockups/key-journey-screen.html) — `journey-screen` token. Landed on when the reveal deck closes; reached again by tapping a `voyage-history-row` (which replays the deck, closing back here). The real entry point for sharing: destination, crew avatar stack, a "Watch your Voylo again" replay hero, a stat-summary panel, and both share controls (card / video) side by side. Calmer register than the reveal itself — a revisit page, not an entrance moment — so its `memory-lane-aurora` runs at reduced opacity on a plain `surface-secondary` base.

### Components

**App icon** *(Ships: v1)* [mockup](mockups/key-app-icon.html) — "The Unfinished Loop." `app-icon` token. Three player-color dots (teal/coral/amber) held apart on an `accent-primary` field, joined by a white dashed thread that almost closes but doesn't — apart-but-connected, and the story isn't finished yet. Dash rhythm deliberately echoes `map-road-centerline`. Replaces the Expo-default placeholder icon; resolves the assumption flagged in Brand & Style. Verify legibility at sub-40px sizes before final export — the dash detail softens at favicon/notification scale (see mockup's size-check row).

**Role-switch pill (Driving / Riding)** *(Ships: v1)* — `status-pill` token, unchanged mechanism from v1, re-skinned: Riding renders as a neutral white pill with a hairline border; Driving renders as a solid `accent-teal` fill with white text — no glow, since Wayfinder has none, but still the same "unmissable at a glance" intent via flat, saturated color contrast against the neutral Riding state.

**Marker peek card** *(Ships: v1)* [mockup](mockups/key-marker-peek-card.html) — `marker-peek-card` token. The card opened by tapping any `map-marker`. Shows name, role, live coordinates (with copy and Get Directions controls), distance-from-you, and distance-from-destination in a side-by-side stat pair; the self-marker case drops role, distance-from-you, and Get Directions (unmeaningful readings for yourself), keeping only name, coordinates, and distance-from-destination. Opens/closes with "Pop & Bounce" — see Motion & Transitions, `EXPERIENCE.md`.

**Action drawer** *(Ships: v1)* [mockup](mockups/key-live-map.html) (drawer-open state) — `action-drawer` token. Replaces `organizer-sheet` entirely (see `sprint-change-proposal-2026-08-02.md`). Slides in from the right over the Live Map, `surface-primary` white fill, houses End Voyage / Grant Organizer Status / Remove Voyager. Row tap swaps the drawer's own content into a confirm step — same modal-depth rule `organizer-sheet` used, never a stacked second dialog. Opened via the hamburger icon in `map-banner`. Motion spec lives in `EXPERIENCE.md`'s Motion & Transitions section.

**Horizon-strip** *(Ships: v1)* [mockup](mockups/key-otp-signin.html) — `horizon-strip` token. A 96px ambient footer band with a soft sky gradient and a slow-scrolling dashed amber lane-line. Purely decorative — no tap target, no behavioral entry needed in `EXPERIENCE.md`. Used on OTP Sign-In/Verify and Destination Picker; freezes to a static frame under Reduce Motion. `[NOTE 2026-08-06, Story 4.7]` Deliberately left as OTP's only atmospheric treatment — its amber dash already shares `home-journey`'s own centerline color below, giving OTP a quiet family resemblance to Home at no added cost to the auth flow's speed.

**Home journey** *(Ships: v1)* [mockup](mockups/key-home.html) — `home-journey` token. See the Home entry under Screens above for what it shows; motion timing lives in `EXPERIENCE.md`'s Motion & Transitions, "Home Journey" subsection. Purely decorative — no tap target.

**Map banner** *(Ships: v1)* [mockup](mockups/key-live-map.html) — `map-banner` token. Solid `accent-primary` band docked to the top of Live Map, replacing the floating top `hud-card`. Displays the Voyage destination at all times and hosts the hamburger icon that opens `action-drawer`.

**Join-code card** *(Ships: v1)* — `join-code-card` token: unchanged in purpose from v1 (a keepsake-feeling object for the shareable code, not a plain string), re-skinned from a violet-glowing gradient to a white card with an `accent-primary` border — no glow.

**Manual Fun Fact log control / Fun Fact badge / Nudge toast** *(Ships: v1.1, not yet built)* — Tokens re-specced (`fun-fact-badge`, `nudge-toast`) against the new palette so v1.1 development starts from Wayfinder values, not Night Drive ones, but these components have no v1 mock — treat the frontmatter tokens as provisional until a dedicated pass when v1.1 is scoped.

**Memory Lane aurora / card panel** *(Ships: v1.1)* [mockup](mockups/key-memory-lane-reveal.html) — `memory-lane-aurora` / `memory-lane-card` tokens. The full-bleed background system (3-4 large soft player-color radial washes, reaching every edge — a hard requirement after an earlier direction shipped with color only in the top portion of a card) and its companion floating white content panel (reuses `card`'s visual language at `rounded.xl`), used together across every Memory Lane surface: the reveal deck, the shareable group card, Voyage History's empty state, and the persistent journey screen (at reduced opacity there — see Screens above). No new hues — only the existing `player-teal`/`player-coral`/`player-amber` tokens.

**Voyage History row** *(Ships: v1.1)* [mockup](mockups/key-voyage-history.html) — `voyage-history-row` token. Reuses the plain `card` token, not `memory-lane-aurora` — History's list is a utility browse/search surface, deliberately restrained next to the reveal's full-bleed drama. Destination-color-coded lead dot (not a player color — distinguishes trips from Voyagers), destination name, date + voyager count, total miles in `stat-numeral-sm`, chevron.

**Search field** *(Ships: v1.1)* [mockup](mockups/key-voyage-history.html) — `search-field` token. Voyage History's always-visible destination search — the first search input anywhere in the system, so this is a new token, not a re-skin. Placeholder text uses `ink-secondary`, not `ink-disabled` (which both fails AA contrast and misreads as a disabled field); carries a persistent accessible label beyond the placeholder.

## Do's and Don'ts

| Do | Don't |
|---|---|
| Use solid, opaque colors everywhere — every surface, every component | Use any transparency, blur, or glassmorphism anywhere in the system |
| Default to `surface-primary`/`surface-secondary` (light) as the system's face | Introduce a second dark surface anywhere outside Trust Moment/Driver Consent, or a Daylight/Night-mode toggle |
| Render the live map as stylized flat-toned terrain with circular player markers | Use literal Google-Maps-style cartography, teardrop pins, or glowing neon roads |
| Reserve Clash Display for emotional-beat screens (Voyage Intro, Join, Memory Lane) | Use Clash Display in lists, forms, or settings rows |
| Use Electric Teal only for "live/happening now" (recenter, Driving-role pill) | Use Teal for success states or static UI |
| Use one player color per Voyager, consistently, for markers and trails only | Reuse a player color for brand chrome, or let a Voyager's color drift between sessions |
| Communicate depth via flat offset shadows and hairline borders | Reach for glow, soft drop shadows, or tonal elevation stacking |
| Round generously (`md`/`lg`/`full`), including component-specific literal values that fall between named tokens | Use sharp 0px corners anywhere in the system |
| Match a built screen to its linked mockup exactly — colors, spacing, radii, motion | Ship a "close enough" interpretation of a mockup; treat any deviation as a bug |
| Give ambient/decorative motion (horizon-strip) a `prefers-reduced-motion` static fallback | Let any animation — ambient, transition, or drawer — ignore Reduce Motion |

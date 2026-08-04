---
status: final
created: 2026-07-25
updated: 2026-08-02
sources:
  - _bmad-output/planning-artifacts/prds/prd-trips-2026-07-25/prd.md
  - _bmad-output/brainstorming/brainstorm-group-road-trip-tracker-2026-07-21/brainstorm.html
  - _bmad-output/planning-artifacts/research/market-group-road-trip-coordination-and-travel-social-app-market-voylo-research-2026-07-24.md
  - _bmad-output/planning-artifacts/sprint-change-proposal-2026-08-02.md
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

---

## Brand & Style

Voylo is not a tracker you check. It's a road-trip game world you're a character inside — the PRD is explicit that competitors (Life360, Zello, Convoy Tracker) all read as safety/navigation utilities first, and Voylo is deliberately, aggressively not that. That anti-reference is a positioning constraint, not a palette constraint: it survives this redesign unchanged even though the visual execution underneath it has completely changed.

**Wayfinder** is the v2 identity, replacing v1's "Night Drive" system (a dark-mode-primary, glassmorphic-HUD design) after real user testing on the built app called it "semi-transparent, dark, and bad navigation." Wayfinder answers that directly: solid colors everywhere (no transparency, no blur, no glass, anywhere in the system), a confident-but-restrained blue/teal/coral/amber palette, and icon-forward chrome — the closest reference point is Waze's actual product register, not Waze's turn-by-turn navigation function. The game-like, entertainment-first anti-utility positioning from the PRD is honored by staying colorful and characterful, not by staying dark.

Three typefaces still carry the whole system, unchanged from v1. **Clash Display** owns every emotional beat — Voyage Intro, the Join invitation, Memory Lane titles (v1.1). **General Sans** runs everything functional. **Space Mono** is reserved exclusively for stat numerals. See Typography below — none of this changed in the Wayfinder pass; only color, elevation, and select components did.

`[ASSUMPTION: the brand mark itself — an app icon/wordmark — is still out of this document's scope; the current placeholder app icon (a generic blue chevron) predates Wayfinder and should be revisited to match the new palette before store submission.]`

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

**OTP Sign-In / Verify** *(Ships: v1)* [mockup](mockups/key-otp-signin.html) — Still plumbing, not a brand moment: `surface-primary` white canvas, no color-blocking on the content itself. The one change from v1: a `horizon-strip` now closes out the bottom of the screen so it never reads as flatly, silently white — this was direct user feedback on the first Wayfinder pass ("every screen that has only and just white background looks very unprofessional").

**Home (no active Voyage)** *(Ships: v1 base — a Past Voyages list is v1.1)* [mockup](mockups/key-home.html) — Unchanged structure from v1: `surface-secondary` fog canvas, a small wordmark for orientation, one dominant `button-ignition` ("Start a Voyage") anchored low in generous whitespace. Left without a `horizon-strip` — it already has enough visual weight (the button's flat offset shadow) not to read as flat; revisit if feedback says otherwise.

**Trust Moment** *(Ships: v1)* [mockup](mockups/key-trust-moment.html) — Full-bleed `surface-ink-navy`, a teal icon badge, `display`-weight headline, one `button-ignition`. The exception to Wayfinder's all-light palette (see Colors) — deliberately low-drama and serious, distinct from every other screen's white/fog canvas.

**Driver Attention Consent** *(Ships: v1)* [mockup](mockups/key-driver-consent.html) — Same `surface-ink-navy` treatment as Trust Moment (same onboarding pass, shown immediately after it), amber badge instead of teal to distinguish "caution" from "reassurance" without breaking the shared low-drama register.

**Voyage Intro** *(Ships: v1)* [mockup](mockups/key-voyage-intro.html) — The app's biggest emotional beat, and the one screen allowed to fill the frame with `accent-primary` itself: full-bleed blue, `display-hero` headline in white, `button-ignition-inverse` (white fill, blue label) since a solid-blue button would vanish on a solid-blue field. A faint dashed road-motif and a small amber destination-dot nod at the Live Map without any glow or gradient animation. Canonical copy unchanged from v1 (see `EXPERIENCE.md` Voice and Tone).

**Destination Picker** *(Ships: v1)* [mockup](mockups/key-destination-picker.html) — Quiet and functional by design (the emotional lift already happened one screen back): `surface-primary` white, one destination field, `button-ignition` disabled (fog-gray) until filled, then full `accent-primary`. Gains the same `horizon-strip` treatment as OTP for the same reason.

**Join Invitation** *(Ships: v1)* [mockup](mockups/key-join-invitation.html) — Shares Voyage Intro's full-bleed `accent-primary` hero and `button-ignition-inverse` so the two cinematic moments read as one family. The one new motif: an overlapping three-avatar stack in player colors (coral/teal/amber), a wordless "people are already here" signal before any names are known. Canonical copy unchanged from v1.

**Live Map (Voyage View)** *(Ships: v1 base)* [mockup](mockups/key-live-map.html) — Restructured from v1's full-bleed map with floating top/bottom `hud-card` docking to a solid, non-floating `map-banner` (destination name, always visible) with the full map rendered below it. Each Voyager renders as the unchanged `map-marker` mechanism, re-skinned to the new player-color tokens. The organizer entry point moves from a bottom-docked button to the `hamburger` icon inside the `map-banner`, opening `action-drawer`.

**Voyage Ended** *(Ships: v1 — this is v1's actual terminal state)* [mockup](mockups/key-voyage-ended.html) — Deliberately understated next to Voyage Intro/Join Invitation, unchanged in intent from v1: `surface-secondary` fog canvas, one `card` summary panel (destination, duration, Voyager count in `stat-numeral`), one `button-secondary` back to Home.

### Components

**Role-switch pill (Driving / Riding)** *(Ships: v1)* — `status-pill` token, unchanged mechanism from v1, re-skinned: Riding renders as a neutral white pill with a hairline border; Driving renders as a solid `accent-teal` fill with white text — no glow, since Wayfinder has none, but still the same "unmissable at a glance" intent via flat, saturated color contrast against the neutral Riding state.

**Action drawer** *(Ships: v1)* [mockup](mockups/key-live-map.html) (drawer-open state) — `action-drawer` token. Replaces `organizer-sheet` entirely (see `sprint-change-proposal-2026-08-02.md`). Slides in from the right over the Live Map, `surface-primary` white fill, houses End Voyage / Grant Organizer Status / Remove Voyager. Row tap swaps the drawer's own content into a confirm step — same modal-depth rule `organizer-sheet` used, never a stacked second dialog. Opened via the hamburger icon in `map-banner`. Motion spec lives in `EXPERIENCE.md`'s Motion & Transitions section.

**Horizon-strip** *(Ships: v1)* [mockup](mockups/key-otp-signin.html) — `horizon-strip` token. A 96px ambient footer band with a soft sky gradient and a slow-scrolling dashed amber lane-line. Purely decorative — no tap target, no behavioral entry needed in `EXPERIENCE.md`. Used on OTP Sign-In/Verify and Destination Picker; freezes to a static frame under Reduce Motion.

**Map banner** *(Ships: v1)* [mockup](mockups/key-live-map.html) — `map-banner` token. Solid `accent-primary` band docked to the top of Live Map, replacing the floating top `hud-card`. Displays the Voyage destination at all times and hosts the hamburger icon that opens `action-drawer`.

**Join-code card** *(Ships: v1)* — `join-code-card` token: unchanged in purpose from v1 (a keepsake-feeling object for the shareable code, not a plain string), re-skinned from a violet-glowing gradient to a white card with an `accent-primary` border — no glow.

**Manual Fun Fact log control / Fun Fact badge / Nudge toast** *(Ships: v1.1, not yet built)* — Tokens re-specced (`fun-fact-badge`, `nudge-toast`) against the new palette so v1.1 development starts from Wayfinder values, not Night Drive ones, but these components have no v1 mock — treat the frontmatter tokens as provisional until a dedicated pass when v1.1 is scoped.

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

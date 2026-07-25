---
status: draft
created: 2026-07-25
updated: 2026-07-25
sources:
  - _bmad-output/planning-artifacts/prds/prd-trips-2026-07-25/prd.md
  - _bmad-output/brainstorming/brainstorm-group-road-trip-tracker-2026-07-21/brainstorm.html
  - _bmad-output/planning-artifacts/research/market-group-road-trip-coordination-and-travel-social-app-market-voylo-research-2026-07-24.md
---

name: Voylo
description: Group road-trip live-presence and shareable-recap app (iOS/Android, v1). Reads as entertainment, not a safety/navigation utility — a game-like shared world the Voyager is a character inside, not a tracker they check.
colors:
  # NIGHT DRIVE — the default, primary mode. Voylo is a dusk/night-highway world:
  # deep indigo skies, glowing road lines, neon marker light. Dark is not a "theme
  # option" here, it is the brand's home surface. Base tokens below ARE dark mode.
  surface-midnight: '#0A0D1C'
  surface-dusk: '#141A33'
  surface-dusk-high: '#1E2547'
  surface-glass: '#1E2547CC'
  ink-primary: '#F7F6FF'
  ink-secondary: '#A6ADD1'
  ink-disabled: '#545C82'
  border-hairline: '#2A3156'
  accent-ignition: '#FF5677'
  accent-electric: '#2FE6C0'
  accent-gold: '#FFC247'
  accent-violet: '#9B6BFF'
  success: '#3DDC97'
  error: '#FF4D5E'
  warning: '#FFB454'
  # Player colors — the fixed, distinct hue assigned to each Voyager for their
  # map marker, motion trail, and any per-Voyager stat coloring. Not brand
  # accents; never reused for buttons, chrome, or system state.
  player-coral: '#FF6B6B'
  player-teal: '#2FE6C0'
  player-violet: '#9B6BFF'
  player-gold: '#FFC247'
  player-sky: '#4FB4FF'
  player-lime: '#B4E61D'
  player-pink: '#FF8FD8'
  player-slate: '#8C9AC4'
  # DAYLIGHT — secondary mode, for glare/accessibility, not the brand's face.
  surface-midnight-light: '#F5F6FC'
  surface-dusk-light: '#FFFFFF'
  surface-dusk-high-light: '#ECEEFA'
  surface-glass-light: '#FFFFFFE6'
  ink-primary-light: '#14162B'
  ink-secondary-light: '#5B6188'
  ink-disabled-light: '#A6ACC9'
  border-hairline-light: '#E1E4F2'
  accent-ignition-light: '#E23F63'
  accent-electric-light: '#0FA98A'
  accent-gold-light: '#C97F00'
  accent-violet-light: '#7C3AED'
  success-light: '#1F9D6E'
  error-light: '#D93548'
  warning-light: '#B87700'
  # Player-color Daylight variants — darkened/adjusted per hue for legibility against the light
  # surface tokens above, not simply reused from the Night Drive values (which are tuned to pop
  # against a dark canvas and would wash out on white/near-white surfaces). player-teal-light,
  # player-violet-light, and player-gold-light intentionally reuse their sibling accent-*-light
  # values above, since player-teal/violet/gold share the exact same base hue as
  # accent-electric/violet/gold in Night Drive mode.
  player-coral-light: '#C9432B'
  player-teal-light: '#0FA98A'
  player-violet-light: '#7C3AED'
  player-gold-light: '#C97F00'
  player-sky-light: '#1E7FCC'
  player-lime-light: '#6E8C12'
  player-pink-light: '#C4408F'
  player-slate-light: '#5A6690'
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
  # button-ignition's label sits on a coral→violet gradient. ink-primary alone measures only
  # ~2.86:1 at the coral endpoint (accent-ignition #FF5677) and ~3.29:1 at the violet endpoint
  # (accent-violet #9B6BFF) — both fail WCAG AA's 4.5:1 normal-text minimum. textScrim is a hard
  # requirement, not decorative: a surface-midnight backing at 50% opacity, rendered as a
  # soft-edged patch sized to the label glyphs (not the full button fill). Composited against the
  # worst point on the gradient (the coral endpoint), ink-primary over the scrimmed result
  # measures ≈7.7:1 — clears 4.5:1 AA with real margin, and every other point on the gradient
  # scores higher still, since the coral endpoint is the lowest-luminance-margin point.
  button-ignition:
    background: 'linear-gradient(135deg, {colors.accent-ignition}, {colors.accent-violet})'
    foreground: '{colors.ink-primary}'
    textScrim: '{colors.surface-midnight}80'
    radius: '{rounded.full}'
    glow: '0 0 24px {colors.accent-ignition}66'
    minHeight: 56px
  button-secondary:
    background: 'transparent'
    foreground: '{colors.ink-primary}'
    border: '1px solid {colors.border-hairline}'
    radius: '{rounded.full}'
    minHeight: 48px
  button-destructive:
    background: '{colors.surface-dusk-high}'
    foreground: '{colors.error}'
    border: '1px solid {colors.error}55'
    radius: '{rounded.full}'
  # surface-glass alone (80% opacity, per Colors) is a starting aesthetic value, not a contrast
  # guarantee — the live map behind it is dynamic and can glow brighter than any static swatch.
  # scrimOpacityMin is a hard floor: the dusk-high fill beneath the blur must never render below
  # 85% effective opacity, regardless of device or in-scene map brightness. At that floor, even
  # the worst case (a fully blown-out white pixel directly behind the card) composites to a
  # background luminance of ≈0.063 — ink-primary against it measures ≈8.65:1, clearing 4.5:1 AA
  # with real margin instead of depending on a per-screen tuning pass.
  hud-card:
    background: '{colors.surface-glass}'
    scrimOpacityMin: 85%
    radius: '{rounded.lg}'
    border: '1px solid {colors.border-hairline}'
    blur: 20px
  # size (40px) is the glanceable visual footprint — correct for a dense map with several markers
  # on screen at once. hitRegion (48px) is the actual tappable area: an invisible padded
  # hit-region centered on the visual marker, clearing both the 44pt (iOS) and 48dp (Android)
  # touch-target floors this document commits to elsewhere, without inflating the marker's visual
  # size. ringColor is a pattern reference, not a single static path: it resolves to whichever of
  # the 8 fixed colors.player-{name} tokens (see Colors frontmatter above — player-coral,
  # player-teal, player-violet, player-gold, player-sky, player-lime, player-pink, player-slate)
  # was assigned to that Voyager at join time. Assignment is first-come-first-served from the
  # unused pool for the life of the Voyage; a Voyager keeps the same color for the whole session
  # (see §Colors, "Player colors").
  map-marker:
    size: 40px
    hitRegion: 48px
    radius: '{rounded.full}'
    ringWidth: 3px
    ringColor: '{colors.player-*}'
    fill: '{colors.surface-dusk-high}'
    trailFadeDuration: 600ms
    trailLength: 8s
  fun-fact-badge:
    background: '{colors.accent-gold}'
    foreground: '{colors.surface-midnight}'
    radius: '{rounded.full}'
    padding: '{spacing.2} {spacing.4}'
  join-code-card:
    background: 'linear-gradient(160deg, {colors.surface-dusk-high}, {colors.surface-midnight})'
    radius: '{rounded.xl}'
    glow: '0 0 40px {colors.accent-violet}40'
    border: '1px solid {colors.border-hairline}'
  nudge-toast:
    background: '{colors.surface-glass}'
    foreground: '{colors.ink-primary}'
    radius: '{rounded.md}'
    accentBar: '{colors.accent-electric}'
  organizer-sheet:
    background: '{colors.surface-dusk}'
    radius: '{rounded.xl}'
    handle: '{colors.border-hairline}'
  # status-pill is the Driving/Riding role switch — the single most safety-critical control in
  # the app (a Driving-role Voyager gets manual-capture controls hard-removed from their HUD; see
  # EXPERIENCE.md's Driver-Safety Interaction Model). Two fixed visual states, not a subtle toggle
  # aesthetic — Driving must read as unmistakably distinct from Riding at a glance:
  #   - riding: ink-primary (#F7F6FF) on surface-dusk-high (#1E2547) — quiet, neutral, ≈13.9:1
  #     contrast. This is the default/unremarkable state.
  #   - driving: surface-midnight (#0A0D1C) on a solid accent-electric (#2FE6C0) fill — ≈12.1:1
  #     contrast. Solid electric teal is otherwise reserved for "live/happening now" (§Colors);
  #     a persistent Driving-state pill is exactly that, and the loud, unmissable treatment is a
  #     deliberate safety cue, not a rule exception.
  # Both states clear 44pt(iOS)/48dp(Android) at 48px minHeight/minWidth.
  status-pill:
    minHeight: 48px
    minWidth: 48px
    paddingX: '{spacing.4}'
    radius: '{rounded.full}'
    riding:
      background: '{colors.surface-dusk-high}'
      foreground: '{colors.ink-primary}'
      border: '1px solid {colors.border-hairline}'
    driving:
      background: '{colors.accent-electric}'
      foreground: '{colors.surface-midnight}'
      glow: '0 0 16px {colors.accent-electric}55'
    label: '{typography.label}'

---

## Brand & Style

Voylo is not a tracker you check. It's a road-trip game world you're a character inside — the PRD is explicit that competitors (Life360, Zello, Convoy Tracker) all read as safety/navigation utilities first, and Voylo is deliberately, aggressively not that. Every screen should feel closer to a racing HUD glimpsed at dusk than to a dashboard of dots and timestamps.

The identity is called **Night Drive**: a deep indigo sky, glowing road lines, and neon-lit player markers moving across a stylized world rather than a literal street map. Night is the default mode, not a toggle — most road trips run long past sunset, the map's motion glow *reads* against dark, and "glamorous/sexy" lands harder against a midnight canvas than a white one. A Daylight variant exists for glare and accessibility (§Colors), but Night Drive is the face of the brand: what's in the App Store screenshots, what's on the Voyage Intro screen, what a new Voyager sees first.

`[ASSUMPTION: the brand mark itself — an app icon/wordmark — is out of this document's scope, but the visual system implies one: a chevron/road-arrow motif doubling as a stylized "V," reinforcing motion and direction wherever a mark appears (loading states, empty states, share cards).]`

Two typefaces carry the whole system. **Clash Display**, a confident geometric display face, owns every emotional beat — Voyage Intro, the Join invitation, Memory Lane titles (v1.1). **General Sans** runs everything functional — body copy, labels, controls — because it stays legible at a glance, which matters given the driver-safety constraint (§5.4 of the PRD): the driver experiences Voylo ambiently, not by reading small text. A third face, **Space Mono**, is reserved exclusively for stat numerals — Fun Fact counts, distances, the odometer-style digits that make the app feel like a dashboard readout rather than a form. `[ASSUMPTION: all three (Clash Display, General Sans, Space Mono) are freely licensed for commercial use — a deliberate practical choice so the glam typographic identity doesn't carry a licensing cost or a native-font-embedding blocker for v1.]`

The emotional arc the PRD asks for — Voyage Intro is itself a payoff, the Join screen is "luring," the live map should feel like watching a game — means restraint is not the goal here the way it might be for a utility app. Motion, glow, and gradient are load-bearing brand elements, not garnish.

**Brand throughline.** The brainstorming session that originated this product named two things as the actual anchor of the brand, and both should inform every share-moment and Memory Lane-adjacent surface even though Memory Lane itself ships in v1.1: the tagline **"Every journey tells a story. We make sure you never miss it."** — which frames the entire live-map/Fun-Fact/Memory-Lane arc as a story being captured, not a trip being tracked — and the aspiration for Voylo to become a verb, in the same register as "send me your Wordle" or "send me your Strava": **"send me your Voylo."** That second line is a product-market ambition as much as a copy line — it implies the shareable artifact (the Join-code card now, Memory Lane later) should be designed to be *sent*, screenshotted, and recognized out of context, the way a Wordle grid or a Strava activity card is. Visual language on share-moment surfaces (the Join-code card today; Memory Lane in v1.1) should be built with this in mind — distinctive enough to be legible as "a Voylo" even divorced from the app chrome around it.

**Sound identity.** The brainstorm was explicit that audio cues should be "fun, thematic, and vary by event/activity type, rather than generic notification dings" — this is a sensory brand-identity decision, not just an accessibility affordance. Voylo's sound design should feel like part of the Night Drive world (closer to a game's diegetic audio cues than a phone's notification tone): a gas-stop detection should not sound like a border-crossing bank, and neither should sound like the generic `nudge-toast` chime. The specific sound-per-event-type mapping and playback behavior is a behavioral spec, not a visual one, and belongs in EXPERIENCE.md rather than here — this section only establishes that a thematic, differentiated sound identity is a brand requirement, not an implementation detail to be defaulted away.

## Colors

The palette reads as one continuous world — a dusk sky deepening into midnight — with four accent colors that never blur into each other because each owns exactly one job.

- **Midnight (`#0A0D1C`)** is the base canvas. Deeper than a typical "dark mode" gray-black — closer to a night sky than a settings screen. Used only for the outermost background layer (map viewport backdrop, full-bleed hero screens).
- **Dusk (`#141A33`)** and **Dusk High (`#1E2547`)** are the two raised surface tones — navigation chrome, cards, sheets. The step between them is the entire elevation vocabulary; see §Elevation.
- **Glass (`#1E2547CC`, Dusk High at 80% opacity)** is reserved for HUD cards that float *over* the live map — stat panels, the Voyager list, notification toasts — so the map is always legible underneath. For the `hud-card` component specifically, this base token is a starting point, not a ceiling: `scrimOpacityMin: 85%` in the components block guarantees text legibility even against a fully blown-out map background (see §Components token block for the computed contrast). `[ASSUMPTION: 80% opacity and a 20px blur remain the starting values for other surface-glass usages (e.g. `nudge-toast`), which don't sit over the map and carry lower contrast risk — but would still benefit from an on-device pass.]`
- **Ignition Coral (`#FF5677`)** is the primary brand action color — Voyage Intro, Destination Picker, Join, End Voyage confirm, the "wow" gradient. Warm, alive, unmistakably not corporate blue.
- **Electric Teal (`#2FE6C0`)** means *live and moving* — the pulse on an active Voyager's marker, the map's motion glow, real-time indicators. Never used for buttons or static UI; teal on screen always means "this is happening right now."
- **Gold (`#FFC247`)** is the achievement color — Fun Fact badges, stat highlights, anything with a "you earned this" quality. This is the color of the FOMO mechanic the PRD asks for (§5.1): a Voyager with no Fun Facts yet has a visibly gold-less presence next to Voyagers who do.
- **Violet (`#9B6BFF`)** is reserved for the premium/anticipation moments — the Join-code card glow, the Memory Lane teaser gradient (v1.1's payoff, foreshadowed even in v1's visual language). It's the rarest color in the system on purpose.
- **Player colors** (coral, teal, violet, gold, sky, lime, pink, slate — 8 total) are a *separate* palette from the four brand accents above, assigned one-per-Voyager for map markers and motion trails, the same way a racing game assigns a car color per player. `[ASSUMPTION: 8 fixed hues covers realistic convoy sizes per the PRD's family/friend-group use case; a 9th+ Voyager falls back to slate with a pattern/initial disambiguator — exact overflow behavior needs a UX pass if group sizes trend larger.]` These never leak into chrome, buttons, or badges — a player color only ever means "this specific Voyager," nowhere else.
  `[ASSUMPTION: flat one-hue-per-Voyager is an intentional v1 simplification, not the full idea from the brainstorm. The original brainstorm envisioned each Voyager's *distinct personality* becoming visible and aggregating into one shared group flavor — richer than a fixed color swap. A fixed 8-hue palette is the right v1 scope (cheap, unambiguous, no new engineering surface), but a natural next iteration is an optional personality layer on top of the same Night Drive identity — e.g. a marker-icon/emoji overlay a Voyager can pick, or stat-color intensity that shifts with that Voyager's activity — without changing the underlying player-color system or committing v1 engineering scope to it now.]`
- **Success (`#3DDC97`) / Error (`#FF4D5E`) / Warning (`#FFB454`)** are deliberately distinct from the four brand accents (especially from Electric Teal, which looks adjacent to Success but is never used for it) so system state never gets mistaken for brand decoration.

Avoid: flat gray-on-white "settings app" surfaces anywhere in the core loop (map, Voyage Intro, Destination Picker, Join, organizer controls); using Ignition Coral for anything that isn't a primary action; using more than one player color to represent the same Voyager across a session.

## Typography

Three roles, three jobs, no overlap.

**Clash Display** is the voice of the big moment: `display-hero` (40px) for Voyage Intro and the Join invitation headline — the two screens the PRD calls out by name as needing to produce a "wow" before anything else happens — and `display` (28px) for section-level hero text (Voyage name, a Memory Lane title in v1.1). Clash Display never appears in a list, a form, or a settings row; it is rationed to moments that deserve it.

**General Sans** runs the rest of the app: `headline` (20px) for card and modal titles, `body` (16px) for primary reading text, `body-sm` (14px) for secondary copy, `label` (13px, tracked +0.04em) for eyebrow tags and control labels, `caption` (12px) for timestamps and meta. This is the legibility layer — it has to hold up for a passenger glancing at a phone in a moving car, so nothing functional ever drops below `caption`.

**Space Mono** is the odometer. `stat-numeral` (32px) and `stat-numeral-sm` (18px) render every count that should feel like a dashboard readout: Fun Fact tallies, distance, a border-crossing timestamp, a "12 hours" Memory Lane stat. Tabular figures only — numbers must not reflow as they tick up. This is the single typographic device that most directly answers the brief's "racing HUD" reference: a live map with Space Mono digits ticking over it reads as a game dashboard in a way a plain sans numeral never will.

Driver-safety implication: any text the driver might glance at (map HUD cards, live stat panels) stays at `stat-numeral` or `headline` size minimum, at full `ink-primary` contrast against `surface-midnight` — never `caption`-sized, never `ink-secondary`, on the ambient/glanceable surfaces.

## Layout & Spacing

Base unit 4px, scaling 4 / 8 / 12 / 16 / 24 / 32 / 48 / 64. `margin-mobile` (20px) is the standard edge inset everywhere except the live map, which runs full-bleed to the device edge — the map is the world, not a card floating in a margin.

`hero-gap` (40px) is a named token for the generous, deliberate whitespace around Voyage Intro and Join-screen copy — these two screens should feel uncrowded and cinematic, closer to a game's title screen than a form. Everywhere else, the standard scale governs.

Single-column throughout; this is a phone-first, often one-handed, often passenger-held app. HUD cards on the live map stack vertically from the bottom edge (thumb-reachable) and top edge (status/stat glance), never side-by-side competing for width on a phone screen.

## Elevation & Depth

Depth comes from two different mechanisms depending on what's being lifted, and they should not be mixed.

**Surface elevation** (cards, sheets, modals) is tonal: `surface-dusk` → `surface-dusk-high` is the entire elevation step. No drop shadows on static UI — a darker-to-lighter indigo step reads as "raised" against the midnight base without needing a shadow at all.

**Glow** is reserved for things that are *alive* or *earned*: the Ignition button's coral glow, an active Voyager marker's teal pulse, the Join-code card's violet halo, a freshly-unlocked Fun Fact badge's gold bloom. Glow is motion-adjacent — it should read as energy, not as furniture. `[ASSUMPTION: glow radii and opacities in the components block (e.g. `0 0 24px accent-ignition 40% opacity`) are a starting point; needs real-device tuning against OLED black vs. non-OLED dark gray to avoid bloom looking muddy.]`

Glassmorphic HUD cards (`surface-glass`, blurred) are the one place both devices meet: a tonal glass fill *and* a hairline border, floating over the live map with no shadow — the map underneath provides all the depth cue that's needed.

## Shapes

Voylo rounds generously — `sm` (10px) on inputs and chips, `md` (18px) on standard cards, `lg` (28px) on HUD cards and bottom sheets, `xl` (36px) on the two hero surfaces (the Voyage Intro panel, the Join-code card). `full` (9999px) governs every button, every badge, and every map marker.

This is deliberately chunkier than a typical utility-app radius scale (which tends to sit at 6–12px). The intent is toy-like confidence without tipping into childish — closer to a game console UI or a racing game's HUD chrome than to enterprise software, but still legible and adult. Corners never go sharp (0px) anywhere in the system; a hard corner is the one shape Voylo doesn't have, because it's the one that reads as "spreadsheet."

Map markers are always circles (a Voyager's avatar in a colored ring), never pins or teardrops — pins are the standard-map convention Voylo is explicitly rejecting. A small chevron rotates with heading, docked to the marker's edge, doing the direction-indication job a pin's point normally does.

## Components

**OTP Sign-In** *(Ships: v1)* — Minimal and fast; this screen is plumbing, not a brand moment (the emotional beats are Voyage Intro and Join, not auth). `surface-midnight` background, `headline`-sized prompt, a single `body`-sized input, `button-ignition` to submit. No decoration competing with a 6-digit code entry.

**Home (no active Voyage)** *(Ships: v1 base — a Past Voyages list is v1.1)* — The pre-trip resting state, reached right after sign-in when there's no active Voyage. Full-bleed `surface-midnight` background, quiet rather than a menu of options: a single dominant `button-ignition` labeled "Start a Voyage" sits centered in the lower two-thirds of the screen, framed by `hero-gap` whitespace so the screen reads as an anticipatory beat — a garage before the ignition, not a dashboard of options. A restrained instance of the chevron/road-arrow brand motif (§Brand & Style) can anchor the upper portion of the screen as quiet identity, not decoration competing with the CTA. In v1.1, a Past Voyages list docks below the CTA using the `hud-card` treatment; v1 ships with nothing below the fold — an empty Home with one clear action is correct v1 scope, not an unfinished screen.

**Voyage Intro** *(Ships: v1)* [mockup](mockups/key-start-voyage.html) — this document is the authoritative contract and wins over the mockup if they ever conflict. The first payoff, per the PRD, and now the very first screen shown on tapping "Start a Voyage" from Home — before any destination has been chosen. Full-bleed `surface-midnight` background with a subtle animated dusk-gradient wash (indigo deepening toward violet at the edges — `[ASSUMPTION: exact gradient motion/duration needs a motion-design pass, not specified here]`). No destination exists yet at this point in the flow, so there is no eyebrow label echoing one back — the screen opens cold on the brand hook, with the `display-hero` headline carrying the brand tagline (`DESIGN.md.Brand & Style`, "Brand throughline") directly onto the screen as real on-screen copy, not just a reference elsewhere in this document. Generous `hero-gap` padding, and one `button-ignition` with its coral glow as the only bright, saturated element on screen — the minimal, one-glowing-button hero treatment is unchanged from before, only the copy and destination move forward to Destination Picker. Canonical copy (locked, not a placeholder example — apply verbatim):

> **Every journey tells a story.**
>
> Voylo rides along live and turns the trip into a memory reel — inside jokes, wrong turns, and all — ready the moment you arrive.
>
> [ Choose Your Destination ]

After tapping, transition into Destination Picker — the screen where the Organizer actually names where they're headed.

**Destination Picker** *(Ships: v1)* [mockup](mockups/key-destination-picker.html) — The single-purpose screen between Voyage Intro and Live Map: the Organizer names a destination, and confirming here is the real "start" action — it triggers Voyage creation and the "wow" cut into Live Map. Continues the same `surface-midnight` canvas as Voyage Intro (no jarring surface change), with a `headline`-sized prompt, a single unobtrusive destination text field (free-text in v1, no autocomplete/validation), and a `button-ignition` labeled "Start the Voyage" — the emotional weight and button copy that previously lived on Voyage Intro now sit here, since this confirm is what actually kicks off the Voyage. The button stays visually disabled (reduced opacity, non-interactive) until the field is non-empty. Deliberately no map preview here — per the live map's reveal-is-the-point design intent, Destination Picker stays quiet and typographic, relatively simple/functional (a destination input plus the confirm button), since the emotional lifting already happened one screen back on Voyage Intro. After tapping, the transition into the live map should feel like a cut-to-gameplay moment, not a page navigation.

**Join Invitation** *(Ships: v1)* [mockup](mockups/key-join-invitation.html) — The "luring" screen the PRD calls for, seen before any auth is requested. Same hero treatment as Voyage Intro but built around *anticipation of a group*: a stack of circular avatar placeholders in player colors (even before anyone's identity is known) hints "you're joining people," an eyebrow label names the inviting Organizer, `display-hero` copy sells the trip rather than the app by leaning directly into curiosity/FOMO for the story already in motion, and the accept action is a `button-ignition` labeled around joining the Voyage, not a generic "Continue." Canonical copy (locked, not a placeholder example — apply verbatim, substituting the actual Organizer's name for Chintan and the Voyage's actual destination for Lake Tahoe):

> CHINTAN INVITED YOU
>
> **A road trip worth remembering.**
>
> Ride along live to Lake Tahoe — then walk away with a memory reel of the whole thing: inside jokes, wrong turns, and all.
>
> [ Join the Voyage ]

**Live Map (Voyage View)** *(Ships: v1 — base map, markers, and HUD chrome; see below for the v1.1 additions that dock onto this same screen)* [mockup](mockups/key-live-map.html) — The core screen and the PRD's single most explicitly flagged design gap. Not a standard turn-by-turn map: terrain renders as simplified flat-toned regions rather than literal street-level cartography, and roads render as glowing light-trail lines (`accent-electric` at low opacity) rather than gray road fills — closer to a stylized overworld map than Google Maps. Each Voyager is a `map-marker`: a 40px circular avatar in their assigned player color ring, with a heading chevron and a fading comet-trail (`trailFadeDuration`/`trailLength` in the components block) showing their recent path — motion made visible, the way a racing game shows a car's line through a corner. `hud-card` glass panels dock to the screen's top (Voyage name, elapsed time in `stat-numeral`) and bottom (per-Voyager quick stats) without ever obscuring the map's center. A manual Fun Fact log control also docks onto this bottom HUD area, but that control — and the Fun Fact data it produces — is a v1.1 addition (see **Manual Fun Fact log control** below); it is not part of the v1 base map. A day/night ambient gradient strip at the very top of the viewport quietly ties the map back to the Night Drive sky motif even when zoomed into a route.

**Role-switch pill (Driving / Riding)** *(Ships: v1)* — `status-pill` token: the single most safety-critical control on the Live Map HUD, docked with the other top-of-screen HUD elements. Defaults to Riding on first load (a skippable two-large-tap-target prompt on a Voyager's first arrival at Live Map), and can be flipped anytime with one tap, no confirmation dialog. The two states are deliberately far apart visually, not a subtle toggle: Riding renders as a quiet neutral pill (`ink-primary` on `surface-dusk-high`); Driving renders as a solid, glowing `accent-electric` fill with dark text — the same loud "live/happening now" teal treatment used for active markers, because a Driving-role Voyager having their manual controls hard-removed (see EXPERIENCE.md's Driver-Safety Interaction Model) is exactly the kind of state that should be unmissable at a glance, both to the Voyager themselves and to anyone glancing at their screen.

**Manual Fun Fact log control** *(Ships: v1.1)* — A single large circular tap target (`full` radius, `player-color`-agnostic — uses `accent-gold`) docked within thumb reach on the map HUD, sized and positioned for passenger use per the driver-safety constraint. Never placed where it competes with the driver's sightline of the map itself. Not present in the v1 build — the v1 Live Map ships without any Fun Fact logging affordance.

**Fun Fact badge / stat chip** *(Ships: v1.1)* — `fun-fact-badge` token: gold fill, dark text, pill-shaped, `stat-numeral-sm` for any embedded count. This is the component that carries the FOMO mechanic — a Voyager panel with several gold badges next to one with none should visually communicate "thinner presence" without a single word of copy. Depends on Fun Fact logging (manual or automatic), both of which are v1.1 scope, so this component has no v1 presence either.

**Join-code card** *(Ships: v1)* — `join-code-card` token: a violet-glowing hero card (not a plain text string in a toast) presented after the Organizer confirms on Destination Picker (the screen that now carries the real "start the Voyage" action), with the code itself set in `stat-numeral` for scannability and a share action that opens the OS share sheet. This card is a keepsake-feeling object, not a system-generated string.

**Organizer action sheet** *(Ships: v1)* [mockup](mockups/key-organizer-action-sheet.html) — Bottom sheet (`organizer-sheet` token, `xl` radius, `surface-dusk` fill) housing End Voyage, Grant Organizer Status, and Remove Voyager. End Voyage and Grant Organizer use `button-secondary`; Remove Voyager uses `button-destructive` (dark fill, error-colored text and hairline, not a solid alarming red block) — serious without breaking the game-like tone into a corporate warning dialog. End Voyage itself ships in v1 (it's part of v1 organizer management), but per the PRD it's also the trigger for Memory Lane (v1.1) once that feature exists — so it should already carry a beat of ceremony rather than reading as a plain destructive confirm, so the v1.1 transition doesn't require redesigning this moment later. `[ASSUMPTION: exact End Voyage confirmation copy/animation is a content/motion decision, not fixed here, but it should not use the same bare pattern as Remove Voyager.]`

**Voyage Ended** *(Ships: v1 — this is v1's actual terminal state; superseded by Memory Lane at the same trigger point once v1.1 ships)* — A calm confirmation, not a highlight reel. `surface-dusk` background (not the full-bleed `surface-midnight` reserved for hero/empty states), with a single `hud-card`-style summary panel presenting the Voyage's vitals — duration and Voyager count in `stat-numeral`, destination in `headline` — and one `button-secondary` back to Home. No share action, no gradient hero treatment, no `join-code-card`-style glow: Voyage Ended intentionally under-plays the moment relative to Voyage Intro and the Join-code card, so that v1.1's Memory Lane, landing at this exact trigger point, reads as a genuine upgrade rather than a redundant second version of the same payoff. `[ASSUMPTION: whether Voyage Ended carries forward any of the ceremonial End Voyage confirm's motion energy, or resets to fully static, is a motion-design decision not fixed here — but it should stay visually subordinate to Voyage Intro/Join/Memory Lane.]`

**Nudge toast** *(Ships: v1.1)* — `nudge-toast` token: glass card, `accent-electric` accent bar, `body-sm` copy, auto-dismiss, no icon-badge clutter. Used for the PRD's one-time contextual onboarding nudges and the one-way lighthearted event notifications (automatic long-stop detection, Fun Fact logged by someone else) — always electric teal, since these are all "something is happening right now" moments. All of these triggers (onboarding nudges, long-stop detection, Fun Fact events) are v1.1 scope, so this component has no v1 build target; v1 ships with no toast/nudge surface at all.

**Memory Lane teaser anchor** *(Ships: v1 for the anchor treatment only — the Memory Lane feature itself ships v1.1)* — Wherever the product needs to foreshadow the payoff (e.g., an empty/building state during an active Voyage), use the `join-code-card` gradient family (violet-to-midnight) with a `display` headline — this is the one visual thread v1 should already be laying down so v1.1's actual Memory Lane feels like an inevitable arrival, not a bolted-on feature. To be explicit: the *anchor/teaser treatment* is v1 scope; Memory Lane generation, viewing, and sharing are v1.1 scope.

## Do's and Don'ts

| Do | Don't |
|---|---|
| Default to Night Drive (dark) as the brand's face; treat Daylight as a secondary accessibility mode | Design flagship screens (Voyage Intro, Join, Memory Lane) in light mode first |
| Render the live map as a stylized light-trail world with circular player markers | Use a standard street-map style, gray roads, or teardrop pins |
| Reserve Clash Display for emotional-beat screens (Voyage Intro, Join, Memory Lane) | Use Clash Display in lists, forms, or settings rows |
| Use Electric Teal only for "live/happening now" | Use Electric Teal for success states or static UI |
| Use one player color per Voyager, consistently, for markers and trails only | Reuse a player color for brand chrome, or let a Voyager's color drift between sessions |
| Keep driver-glanceable surfaces (map HUD) at `headline`/`stat-numeral` size and full `ink-primary` contrast | Put driver-relevant info in `caption` size or `ink-secondary` contrast |
| Let glow communicate "alive" or "earned" (buttons, active markers, badges) | Apply glow decoratively to static cards or chrome |
| Round generously (`md`/`lg`/`full`) everywhere, including destructive controls | Use sharp 0px corners anywhere in the system |
| Make End Voyage and the Join-code moment feel ceremonial | Treat Voyage-lifecycle actions as bare system dialogs |

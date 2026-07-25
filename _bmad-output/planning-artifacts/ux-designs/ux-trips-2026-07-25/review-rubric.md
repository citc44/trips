# Spine Pair Review — Voylo

## Overall verdict

The spine pair is a strong contract: all four PRD user journeys are represented as full Key Flows, every `{path.to.token}` reference in EXPERIENCE.md resolves cleanly to a DESIGN.md token, all three `sources:` files exist on disk, and both files follow their canonical section shapes exactly. It falls short of "clean source-extract" in three concrete ways a downstream consumer would trip on: no quantified contrast target anywhere despite driver-safety being an explicit hard constraint, three real v1 screens (Home, Voyage Setup, Voyage Ended) with zero visual spec in DESIGN.md, and one broken token path (`{player-color}`) in the map-marker component. None of these are fatal to a first read-through, but each would cause a downstream builder to either guess or stall.

## 1. Flow coverage — strong

Checked EXPERIENCE.md's Key Flows against the PRD's four Key User Journeys (§2.3). All four are present, correctly numbered (UJ-1–UJ-4), with named protagonists (Chintan, Meera, the group), numbered steps, and explicit `**Climax:**` markers.

### Findings
- **low** UJ-3 ("The drive itself") has no explicit `Failure:`/`edge:` closing line, unlike UJ-1, UJ-2, and UJ-4 which all end with one (EXPERIENCE.md Key Flows, UJ-3, lines 208–217). A corresponding State Pattern ("Connectivity loss mid-drive," line 106) exists and could anchor a failure path here but isn't referenced from the flow. *Fix:* add a one-line failure/edge note pointing at the connectivity-loss state.

## 2. Token completeness — adequate

Extracted every frontmatter token (colors, typography, rounded, spacing, components) and every `{path.to.token}` reference in both files' prose (37 references total across both files). All EXPERIENCE.md references resolve to DESIGN.md tokens by exact name. All color tokens carry hex values, and all color categories except one have explicit light/dark pairs.

### Findings
- **critical** No numeric contrast ratio or WCAG target is stated anywhere in DESIGN.md, despite driver-glanceable legibility being an explicit hard constraint (PRD §5.4; DESIGN.md line 223: "at full `ink-primary` contrast against `surface-midnight`"). "Full contrast" is a qualitative claim, not a testable spec. *Fix:* state the actual contrast ratio (e.g., "≥ 7:1") for `ink-primary`/`surface-midnight` and `ink-primary`/`surface-glass`, the two combinations the driver-safety model depends on.
- **high** The 8 player-marker colors (`player-coral` … `player-slate`, DESIGN.md lines 35–42) have no Daylight-mode (`-light`) counterparts, unlike every other color category in the file (surfaces, ink, accents, semantic all have `-light` pairs, lines 44–58). No rationale is given for the omission, and map markers must stay distinguishable against the light-mode surface too. *Fix:* either add `-light` variants or add an explicit note that player colors are mode-invariant by design.
- **medium** `map-marker.ringColor` is set to `'{player-color}'` (DESIGN.md line 154), a path that doesn't exist anywhere in the frontmatter — the real tokens are `colors.player-coral`, `colors.player-teal`, etc. A literal resolver would fail on this reference. *Fix:* replace with a note clarifying it's a dynamic per-Voyager binding (e.g., `{colors.player-*}` resolved at assignment time), not a static path.

## 3. Component coverage — thin

Extracted every component name from DESIGN.md's frontmatter `components:` block (9 tokens), DESIGN.md's `## Components` prose section (10 entries), and EXPERIENCE.md's Component Patterns table (10 rows). Cross-checked against the 19 IA surfaces in EXPERIENCE.md's Information Architecture table.

### Findings
- **high** Three v1 IA surfaces have no visual specification anywhere in DESIGN.md.Components: **Home** (no active Voyage), **Voyage Setup**, and **Voyage Ended** (the wrap-up summary — the actual v1 terminal state, ships v1). EXPERIENCE.md's IA table (lines 34–44) and Key Flows reference all three as real, load-bearing screens, but DESIGN.md's Components section (lines 251–271) only covers OTP Sign-In, Start Voyage, Join Invitation, Live Map, and the v1.1-onward components. Voyage Ended is notably a bigger gap than Memory Lane itself, since Memory Lane is v1.1 scope while Voyage Ended is what v1 actually ships as its terminal screen. *Fix:* add DESIGN.md.Components entries for Home, Voyage Setup, and Voyage Ended.
- **medium** Trust Moment is treated as load-bearing enough in EXPERIENCE.md to get its own top-level "Trust, Privacy & Consent" section, and appears in Component Patterns ("Trust Moment screen," line 90) and both UJ-1/UJ-2 flows — but has no DESIGN.md.Components row. Its only visual description ("Full-bleed, single statement in the hero type register," EXPERIENCE.md line 156) lives inside EXPERIENCE.md, which is a visual-spec leak into the behavioral spine (EXPERIENCE.md's own convention elsewhere is "visual contrast lives in DESIGN.md"). *Fix:* add a Trust Moment entry to DESIGN.md.Components and trim the visual description out of EXPERIENCE.md's Trust section.
- **low** EXPERIENCE.md's "Destination field" (Component Patterns, line 82) has no counterpart in DESIGN.md.Components — it's mentioned only in passing inside the (missing) Voyage Setup spec. Resolves once the Voyage Setup gap above is fixed.

## 4. State coverage — adequate

Walked all 19 IA surfaces against expected states (cold-load, empty, error, offline, permission-denied, focus) and checked coverage in EXPERIENCE.md's State Patterns table (20 rows). Coverage is strong for the core loop — auth, join, live map, connectivity, permissions, and organizer actions are all well covered, including several states the PRD left unsolved (long-stop, border-crossing, late-join, zero-contribution).

### Findings
- **medium** "Settings" appears as a Surface value in the State Patterns table (Sign out row, line 99) but is never defined as an IA surface in Information Architecture — no "Reached from," "Purpose," or "Ships" entry exists for it anywhere. *Fix:* add a Settings row to the IA table.
- **low** No failure state is defined for Voyage creation itself (Voyage Setup → Start Voyage tap) if it fails server-side — only the location-permission sub-flow off that same tap is covered.
- **low** No explicit "Live Map, solo (no Voyagers joined yet)" state row, though it's implied narratively in UJ-1 step 8 ("Chintan is already a Voyager on his own map, alone").

## 5. Visual reference coverage

No `mockups/`, `wireframes/` directories exist in the ux-trips-2026-07-25 folder; `imports/` exists but is empty. This is consistent with — not contradicted by — EXPERIENCE.md's own disclosure: "→ Composition reference: none yet produced for this project. Spine wins on conflict if mockups are added later" (line 55). Not a defect at this stage.

## 6. Bloat & overspecification — adequate

### Findings
- **low** DESIGN.md's Brand & Style section (lines 182–194) substantially restates PRD §1 Vision content — the tagline and the "send me your Voylo" aspiration — at paragraph length before arriving at the concrete design implication (share-moment surfaces should be recognizable out of context). *Fix:* compress to the implication; the tagline itself doesn't need re-quoting, a citation would do.
- **low** EXPERIENCE.md's Key Flow climax beats occasionally use marketing-register language rather than staying behavioral — e.g. UJ-4 line 226: "landing as the 'wow, that's so cool' payoff the whole product has been building toward since the Start Voyage screen." Per the rubric's own DESIGN/EXPERIENCE voice split, that register belongs in DESIGN.md's Brand & Style, not EXPERIENCE.md's flow narration.

## 7. Inheritance discipline — strong

`sources:` frontmatter is identical across both files and all three paths resolve on disk (verified `prd.md`, `brainstorm.html`, and the market-research `.md` all exist). UJ numbers and core names match the PRD verbatim. Glossary terms (Voyage, Voyager, Organizer, Fun Fact, Memory Lane, Join Code/Link) are used identically across PRD, DESIGN.md, and EXPERIENCE.md — no drift found. Component names match between DESIGN.md and EXPERIENCE.md everywhere both exist (the gaps above are omissions, not name mismatches).

### Findings
- **low (informational)** "Riding" / "Driving" roles are a new domain concept coined in EXPERIENCE.md's Driver-Safety Interaction Model to satisfy PRD §5.4, but this concept isn't yet reflected in the PRD's own Glossary (§3). Not a spine defect — the PRD explicitly delegated this design decision — but worth feeding back upstream so architecture and story-dev don't treat it as UX-only vocabulary.

## 8. Shape fit — strong

DESIGN.md's body sections appear in exact canonical order (Brand & Style → Colors → Typography → Layout & Spacing → Elevation & Depth → Shapes → Components → Do's and Don'ts), none omitted. EXPERIENCE.md carries all 8 required defaults (Foundation, IA, Voice and Tone, Component Patterns, State Patterns, Interaction Primitives, Accessibility Floor, Key Flows) in canonical order, plus three well-justified custom sections (Driver-Safety Interaction Model, Trust/Privacy & Consent, Contribution Richness) inserted between Accessibility Floor and Key Flows — each directly answers a PRD-flagged open item (§5.4 driver safety, §9 Q11 consent mechanism, §5.1 FOMO design brief) rather than being decorative additions.

## Mechanical notes

- Frontmatter (`status`, `created`, `updated`, `sources`) is present and identical in shape across both files.
- No name inconsistencies found for Glossary terms or matched component names.
- One broken cross-reference: `{player-color}` in DESIGN.md's `map-marker` component token (line 154) — see Finding #2.
- One undefined-surface reference: "Settings" used in State Patterns but absent from Information Architecture — see Finding #4.
- All `{...}` token references in EXPERIENCE.md (14 distinct references checked) resolve to DESIGN.md tokens by name with zero misses.

# Spine Pair Review — trips (Voylo)

## Overall verdict

The spine pair remains largely source-extractable and internally disciplined; Story 4.7's new `home-journey` token block is fully defined, every token it references resolves, and its motion timings match the promoted mockup almost exactly. But this pass surfaces two real problems introduced or exposed by this story: the `home-journey` road-surface color token resolves to a hex value the actual promoted `key-home.html` does not use (a genuine mockup-fidelity bug per the spine's own "disagreement is a bug" rule), and one of Story 4.7's own two explicit acceptance-criteria bullets — a new Voice and Tone row for OTP — was not delivered, leaving the table's only OTP-adjacent copy example sitting in the **Don't** column even though that exact phrase is OTP's real, currently-shipping, deliberately-preserved headline. Neither is a build-blocker on its own, but both are exactly the class of drift this contract exists to catch before Story 4.8 starts. A handful of medium/low items carry forward unresolved from the Story 4.5 pass (orphaned mockup, two components missing DESIGN.md prose rows, an orphaned typography token) — none touched by this story, all still open.

## 1. Flow coverage — strong

Extracted UJ-1 through UJ-4 from both files' shared frontmatter sources (PRD §2.3). All four have a named protagonist, numbered steps, an explicit **Climax** beat, and a failure/edge trailer in EXPERIENCE.md's Key Flows section. Story 4.7 is atmosphere-only (no new interaction, no new step), so no new flow content was required and none is missing — UJ-1 steps 1-2 and step 4 already cover OTP entry and Home landing without needing rewriting.

### Findings
None.

## 2. Token completeness — adequate

Extracted the full frontmatter `colors`/`typography`/`components` block plus every `{path.to.token}` reference in both files' prose. The new `home-journey` block (frontmatter lines 384-399) was checked field-by-field: `roadSurfaceColor` → `{colors.map-road}`, `roadsideColor` → `{colors.map-road-border}`, `landGradient` → `{colors.map-land-top}`/`{colors.map-land-bottom}`, `centerlineColor` → `{colors.map-road-centerline}`, `crewDots` → `{colors.player-teal}`/`{colors.player-coral}`/`{colors.player-amber}`, `revealGlowColor`/`wordmarkGlowColor` → `{colors.accent-amber}` — every one resolves to a defined token, no broken references.

### Findings
- **medium** `home-journey`'s crew-dot bob stagger (600ms, stated in EXPERIENCE.md's Motion & Transitions "Home Journey" subsection and matching `key-home.html`'s `animation-delay: 0s/0.6s/1.2s`) has no corresponding field in DESIGN.md's `home-journey` frontmatter block — every other stagger value in the same block (`memorySparkStaggerMs: 1600`) is tokenized, but the crew-dot one only exists in prose. A downstream consumer reading DESIGN.md alone (the "visual spec" half of the contract) would not find this number. *Fix:* add `crewDotStaggerMs: 600` to the `home-journey` token block.
- **low** `typography.body-sm` (frontmatter, DESIGN.md) is defined but never referenced anywhere in either file's prose or `{typography.*}` citations — carried forward unresolved from the prior review pass, untouched by this story. *Fix:* either cite it somewhere a small-body use exists, or drop it.

## 3. Component coverage — adequate

Extracted every component name from both files. `home-journey` (new this story) has a full frontmatter token block, a Screens-section description (DESIGN.md), a Components-section description (DESIGN.md), and a dated Motion & Transitions subsection (EXPERIENCE.md) — fully specified on both sides, matching the precedent set by `marker-peek-card`.

### Findings
- **medium** `map-marker` and `hud-bar` both have frontmatter token blocks and EXPERIENCE.md Component Patterns rows, but neither has a dedicated prose bullet under DESIGN.md's `### Components` heading (unlike `map-banner`, `action-drawer`, `horizon-strip`, `home-journey`, etc., which all get one). Carried forward from the Story 4.5 review, not touched by this story. *Fix:* add short DESIGN.md Components bullets for both, matching the format already used for every sibling component.

## 4. State coverage — adequate

Walked Home and OTP against the State Patterns table. Both surfaces' relevant states (cold-open authenticated/no-Voyage for Home; cold-open unauthenticated for OTP; the OTP field's own focus/error/cooldown states in Component Patterns) are covered. Story 4.7 doesn't add new interaction states to either surface (atmosphere/copy only), so no new state rows were required.

### Findings
- **low** No State Patterns row exists for an OTP send/verify network failure (e.g., the send-code request fails, or verify fails for a reason other than a wrong code). Pre-existing gap, unrelated to this story's scope, not blocking.

## 5. Visual reference coverage — thin

Listed all 14 files in `mockups/` (plus 4 archived directions in `mockups/directions-archive/`, correctly unlinked per the archival decision). Read `key-home.html` and `key-otp-signin.html` directly rather than trusting DESIGN.md's prose.

**OTP (`key-otp-signin.html`):** confirmed unchanged this story — DESIGN.md's `[RECONSIDERED 2026-08-06, Story 4.7]` note accurately states the horizon-strip was kept as-is and explains why (amber dash already echoes `home-journey`'s centerline color). The mockup file itself carries no Story 4.7 marks and its content matches DESIGN.md's description exactly. Accurate.

**Home (`key-home.html`):** mostly accurate — road height (58%), centerline drift (900ms), crew-dot bob (2400ms, colors teal/coral/amber in that order), reveal-glow heartbeat (2600ms), memory-spark rise (5000ms, staggered 1600ms → delays 0/1.6s/3.2s), and wordmark glow (4000ms) all match DESIGN.md's `home-journey` token values and the prose description precisely. But one real mismatch:

### Findings
- **high** DESIGN.md's `home-journey.roadSurfaceColor` token resolves to `{colors.map-road}` = `#FFFFFF` (pure white). The actual promoted mockup's `.road-surface` rule (`key-home.html` line 40) renders the road as `background: #E8EAEE` — a visibly different light gray, not white, and not any other defined token in the palette either (not `map-road-border` `#DCE1EA`, not `surface-tertiary` `#EDEFF3`). Separately, the `roadsideColor` token (`{colors.map-road-border}`) doesn't correspond to any visible border/stripe in the mockup's CSS at all — no roadside element exists to carry that color. Per DESIGN.md's own stated rule ("[w]here this document and a mockup ever disagree, treat that as a bug to resolve, not a case where this document silently wins"), this is exactly the kind of disagreement that needs resolving before Story 4.8, not carrying forward silently. *Fix:* either correct the mockup's road-surface fill to `#FFFFFF` (matching the token, matching every other `map-road` usage on Live Map) or correct the token to whatever hex the approved mock is meant to use, and add a real roadside element or drop the unused `roadsideColor` field.
- **medium** `mockups/key-drawer-roster.html` remains present but is referenced by neither DESIGN.md nor EXPERIENCE.md — carried forward as an orphan from the Story 4.5 review, untouched by this story. *Fix:* either link it from the Action Drawer entry (if the roster concept it depicts is still live) or delete it.

## 6. Bloat & overspecification — thin

### Findings
- **medium** `home-journey`'s full visual description (perspective road, three bobbing crew dots, heartbeat glow, rising sparks, breathing wordmark) is narrated in near-complete duplicate three times: the frontmatter token-block comment (DESIGN.md lines 375-383), the Screens → Home prose entry (line 467), and the Components → Home journey prose entry (line 495) — the latter two are close paraphrases of each other with almost no unique information in the third telling. This is the same triple-narration pattern the Story 4.5 editorial pass explicitly identified and fixed for `marker-peek-card` ("both now point to EXPERIENCE.md as the single authoritative motion spec"); that discipline wasn't applied here. Contrast with `splash-thread`, which states its description once in Screens and lets Components/Motion & Transitions cross-reference it. *Fix:* trim the Components → Home journey bullet and/or the frontmatter comment down to a one-line pointer at the Screens description and EXPERIENCE.md's Motion & Transitions subsection, matching the established convention.

## 7. Inheritance discipline — thin

Frontmatter `sources` in both files correctly list the brainstorming session document and `sprint-change-proposal-2026-08-06.md` (which contains both the marker-peek-card proposal and the Story 4.7 "Welcome & Sign-In Warmth" addendum) — confirmed these were direct inputs to this story's decisions per the memlog, and both are present. UJ names, component names, and EXPERIENCE.md's `{path.to.token}` references were all checked and resolve/match consistently.

### Findings
- **high** Story 4.7's own acceptance criteria (epics.md, Story 4.7, bullet 2) require: *"EXPERIENCE.md's Voice and Tone table gains real Do/Don't rows for OTP Sign-In and Home — both currently have zero entries."* Only Home received a new row (line 69, marked `[NEW 2026-08-06]`). OTP still has no dedicated Do/Don't row. Worse, that same Home row's **Don't** column reads `"Sign in to Voylo" / "Start" (a bare label with no feeling behind it)` — but `"Sign in to Voylo"` is not a hypothetical bad example, it is OTP's actual, current, shipping headline (verified in `key-otp-signin.html` line 140), which this exact story's own decision explicitly reaffirmed as deliberately kept, un-rewritten copy ("OTP's speed is a real virtue, not an oversight" — DESIGN.md's OTP entry). The spine now contradicts itself: one section says this phrase is the correct, sanctioned copy; another brands the identical phrase a "Don't." *Fix:* give OTP its own Do/Don't row (Do: "Sign in to Voylo" / "Enter your code" as the sanctioned, intentionally-restrained copy; Don't: something that was never OTP's real copy), and remove the stale "Sign in to Voylo" reference from Home's Don't column.

## 8. Shape fit — strong

DESIGN.md's sections run in canonical order: Brand & Style → Colors → Typography → Layout & Spacing → Elevation & Depth → Shapes → Components → Do's and Don'ts. EXPERIENCE.md carries all required defaults (Foundation, Information Architecture, Voice and Tone, Component Patterns, State Patterns, Interaction Primitives, Accessibility Floor, Key Flows) in a sensible order, with justified product-specific extensions (Motion & Transitions, Driver-Safety Interaction Model, Trust/Privacy & Consent, Contribution Richness) placed between Accessibility Floor and Key Flows rather than disrupting the required skeleton.

### Findings
None.

## Mechanical notes

- Both files' frontmatter `updated: 2026-08-06` dates are consistent with each other and with the memlog's own dating of this story's work.
- No broken `DESIGN.md.*`/`EXPERIENCE.md.*` cross-section citations found this pass (the Story 4.5 review's broken-citation finding was already fixed and stays fixed).
- No Mermaid diagrams in either file.
- `key-home.html`'s reduced-motion preview is a manual JS toggle rather than an actual `@media (prefers-reduced-motion: reduce)` rule (unlike `key-otp-signin.html`, which has a real media query). Cosmetic inconsistency between two mockup files, not a spine-content defect — EXPERIENCE.md's Accessibility Floor and Motion & Transitions sections already state the real reduced-motion behavior correctly regardless of how the illustrative mock demonstrates it.
- Story 4.7's AC also called for a new `key-otp-signin.html` mockup revision; none was produced. This is confirmed intentional (memlog: OTP kept byte-for-byte, "no real OTP work" decision) and DESIGN.md's `[RECONSIDERED]` note documents the rationale — noted here only for AC-traceability completeness, not as a defect.

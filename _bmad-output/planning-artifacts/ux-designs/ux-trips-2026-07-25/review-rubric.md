# Spine Pair Review — trips

## Overall verdict

Today's Story 6.2 additions (Memory Lane Reveal deck, Shareable Group Card, Voyage History, Persistent Journey Screen) are structurally well-integrated into an already-disciplined spine pair: all four new mockups are correctly linked inline, new sections are inserted at sensible points rather than dumped at the end, and the great majority of new tokens and cross-references resolve cleanly. The two high-severity gaps both concern what happens when the new sharing/generation feature *doesn't* go perfectly — no state is defined for a failed/slow share-asset generation, and the new Shareable Group Card isn't reconciled against the existing per-person external-share consent gate — both worth resolving before Story 6.3 implementation begins. The remaining findings are narrative-continuity and reference-hygiene issues (a destination/timing continuity break in the rewritten UJ-4, an untraceable "UJ-5" label, one non-conventional token reference, one misdirected cross-reference) that a downstream reader could work around but shouldn't have to.

## 1. Flow coverage — adequate

Checked every UJ named in the PRD (source) against EXPERIENCE.md Key Flows: UJ-1 through UJ-4 all present, each with a named protagonist, numbered steps, and a climax beat. UJ-4 (rewritten today) and the new UJ-5 both have explicit "Climax" and "Failure/edge" beats matching the shape of UJ-1/UJ-2.

### Findings
- **medium** UJ-4's rewritten flow (step 5) resolves Card 1 as "Big Sur" and gives Sam's late-join as "38 minutes in," while every other Key Flow uses "Lake Tahoe" as the trip's destination (UJ-1 step 7, UJ-2 step 2 copy, UJ-5 step 3 search term) and UJ-3 (step 8) states Sam joined "six hours after the Voyage started." A third variant ("Chintan showed up fashionably late — 42 minutes in," misattributing lateness to the Organizer) appears in the Voice and Tone table. (EXPERIENCE.md, UJ-3 step 8 / UJ-4 step 5 / Voice and Tone table, Memory Lane rows). *Fix:* reconcile UJ-4's example content to the established Chintan/Meera/Sam/Lake Tahoe canon (Sam, late by hours not minutes), and correct or remove the Voice and Tone table's conflicting "Chintan...42 minutes" row.
- **low** UJ-3 still has no explicit "Failure/edge:" trailer, unlike UJ-1/UJ-2/UJ-4/UJ-5 — a pre-existing gap already flagged in a prior review pass (see `.memlog.md` #58), not part of today's diff, still open. (EXPERIENCE.md, UJ-3). *Fix:* add a short failure/edge line (e.g., what a Voyager sees if the map fails to update / stale-position handling).

## 2. Token completeness — adequate

Extracted every token in DESIGN.md's YAML frontmatter (colors, typography, rounded, spacing, components) and every `{path.to.token}` reference in both files' prose. All color tokens have hex values; no missing-hex critical issues. All new `memory-lane-*`/`voyage-history-*`/`journey-screen` tokens resolve against real color/typography/rounded/spacing/component tokens, with one repeated exception below.

### Findings
- **medium** `{memory-lane-aurora}` is referenced as a bare token (not `{components.memory-lane-aurora}`) in two places: `memory-lane-share-card.background` and `voyage-history-empty.background`. Every other cross-component reference in the file uses the full `{components.X}` path (e.g. `{components.button-ignition}` used at lines 455 and 468 of the same block), so as written this doesn't resolve against any top-level frontmatter key. (DESIGN.md, ~line 433 and ~line 453). *Fix:* change both to `{components.memory-lane-aurora}`.

## 3. Component coverage — adequate

Extracted every component name used in either file. All new components (`memory-lane-aurora`, `memory-lane-card`, `memory-lane-deck`, `memory-lane-share-card`, `voyage-history-row`, `voyage-history-empty`, `journey-screen`) have both a DESIGN.md visual-spec entry (frontmatter token + Screens/Components prose) and an EXPERIENCE.md behavioral entry (Component Patterns row or, where purely decorative/a documented state, a State Patterns row).

### Findings
- **medium** DESIGN.md's `journey-screen.shareRow` field says "see State Patterns for what each produces" (i.e., what "Share the card" vs. "Share the video" generate), but State Patterns has no such row — only a consent-gating row ("External share attempted with others' content"). The actual explanation lives in EXPERIENCE.md's Component Patterns "Shareable Group Card" row instead. (DESIGN.md, `journey-screen` token, ~line 468). *Fix:* repoint the cross-reference to Component Patterns (or name the "Shareable Group Card" row directly).
- **low** Pre-existing, not introduced today: `map-marker`, `hud-bar`, and `status-pill` still have no dedicated prose row of their own under DESIGN.md's `### Components` subsection (token-only + mentions inside Screens entries) — already flagged in a prior review pass per `.memlog.md` #58, still open.

## 4. State coverage — thin

Walked all IA surfaces including the 4 new ones. Memory Lane Reveal has strong coverage (generation-in-progress via "Wrapping up…", solo-Organizer, pre-stop-intelligence content, mid-deck exit). Voyage History's first-visit empty state is explicit and well-designed. Two real gaps stand out for the new sharing surface specifically.

### Findings
- **high** No state is defined for a failed or slow share-asset generation (the video stitch or the group-card image render). The PRD's own FR-16 NFR already flags this as unresolved ("no defined performance target yet — revisit with engineering"), and today's new Component Patterns "Shareable Group Card" row doesn't add an error/retry/in-progress state despite this being squarely in its scope. (EXPERIENCE.md, Component Patterns "Shareable Group Card" row / State Patterns table — no matching row exists). *Fix:* add a State Patterns row for share-generation in-progress/failure (e.g., a brief generating indicator, and a plain retry path on failure).
- **high** The pre-existing "Consent for external sharing" gate (a per-Voyager approval required before sharing content that includes them) isn't reconciled against today's new Shareable Group Card, which by design always includes every crew member's avatar/name. The new Component Patterns row describes it as generating the image and opening the OS share sheet directly, with no mention of the consent gate — leaving it undefined whether the group card is exempt from consent (a plausible intentional carve-out, since it's the compiled trip's own primary artifact) or must pass through "Ask the group" like a tagged photo would. This is a real ambiguity in a privacy/legal-sensitive flow, not a cosmetic gap. (EXPERIENCE.md, "Consent for external sharing (v1.1)" section vs. Component Patterns "Shareable Group Card" row). *Fix:* add an explicit line stating whether/why the group card is exempt from the per-person consent gate.
- **medium** No "search returns zero matches" state is defined for Voyage History's always-visible, live-filtering search field — distinct from the well-covered "zero completed Voyages ever" empty state. The calibration reference example (`experience-example-mobile.md`, "Search empty" row: "No matches. No suggestions.") models exactly this state, and it's absent here despite Voyage History shipping live search today. (EXPERIENCE.md, State Patterns table — only "Voyage History, first visit" row exists). *Fix:* add a short "no matches for this search" row.
- **medium** No offline/error state is defined for viewing already-completed Voyage content later (Voyage History list, Persistent Journey Screen, Memory Lane replay) — unlike the well-covered "Connectivity loss mid-drive" state for active-Voyage surfaces. UJ-5's own framing ("months later") makes offline access to old content a plausible real scenario. (EXPERIENCE.md, State Patterns table). *Fix:* add a row for offline/failed load of a past Voyage's content (e.g., cached-if-available, friendly no-connection message otherwise).

## 5. Visual reference coverage — strong

Enumerated all 22 files in `mockups/` (18 active + 4 archived) and all 31 files in `.working/`. All four of today's new mockups (`key-memory-lane-reveal.html`, `key-memory-lane-share-card.html`, `key-voyage-history.html`, `key-journey-screen.html`) are linked inline in both DESIGN.md (Screens and Components entries) and EXPERIENCE.md (IA table, Motion & Transitions), with filenames matching exactly. All promoted `.working/` exploration files (the three full-deck directions, the two share-card directions, the History and Journey Screen prototypes) are correctly superseded by their `mockups/` counterparts — no stale draft is referenced instead of the promoted final.

### Findings
- **low** `mockups/key-drawer-roster.html` remains unlinked from either spine — pre-existing, unrelated to today's work, already flagged in a prior review pass per `.memlog.md` #58.

## 6. Bloat & overspecification — strong

No triple-narration or meaningful duplication found in today's additions — motion timing for the new Memory Lane deck is specified once, in EXPERIENCE.md's Motion & Transitions, exactly matching the discipline this project already established (and previously had to retrofit) for `marker-peek-card` and `home-journey`. The `memory-lane-aurora` rationale (rejected directions, full-bleed requirement) appears in both the frontmatter comment and the Components prose entry, but this matches the document's established convention elsewhere (e.g. `button-ignition`, `app-icon`) rather than introducing new redundancy.

### Findings
None.

## 7. Inheritance discipline — adequate

Sources resolve: all 7 frontmatter `sources` entries exist on disk, including `sprint-change-proposal-2026-08-10.md` and `docs/VOYLO-LIVING-VOYLO-FEATURE-CONCEPT.md`, both verified. Screen/component names are used consistently between DESIGN.md and EXPERIENCE.md (Memory Lane Reveal, Shareable Group Card, Voyage History, Persistent Journey Screen all match exactly across both files' Screens/IA/Component Patterns entries).

### Findings
- **medium** EXPERIENCE.md's new "UJ-5 — Revisiting a past Voyage" Key Flow has no corresponding UJ-5 in the PRD (a stated frontmatter source). The PRD's FR-17 (Browse & Search Voyage History) explicitly tags this functionality "Realizes UJ-4 (extended)," not a new numbered journey. A downstream reader cross-referencing "UJ-5" against the PRD will find nothing under that label — breaking the traceability the UJ-N numbering exists to provide, even though the flow's actual content is complete and correct. (EXPERIENCE.md, Key Flows; PRD §2.3/FR-17). *Fix:* either rename to something like "UJ-4b" / "UJ-4 (extended) — Revisiting a past Voyage," or add a one-line note explaining it's a spine-level flow extension beyond the PRD's numbered list, not a literal PRD UJ-5.

## 8. Shape fit — strong

Both files preserve their canonical section order (DESIGN.md: Brand & Style → Colors → Typography → Layout & Spacing → Elevation & Depth → Shapes → Components → Do's/Don'ts; EXPERIENCE.md: Foundation → IA → Voice and Tone → Component Patterns → State Patterns → Interaction Primitives → Motion & Transitions → Accessibility Floor → [domain sections] → Key Flows). Today's insertions land at contextually sensible points — new Screens/IA rows sit right after the prior terminal state (Voyage Ended) rather than at the document's literal end; new Component Patterns/State Patterns/Voice and Tone rows are grouped with their thematic siblings; UJ-4 was rewritten in place rather than duplicated, and UJ-5 was appended after it.

### Findings
- **low** The new "End Voyage → Memory Lane Reveal" Motion & Transitions subsection is placed before "Splash Screen ('The Thread')," even though Memory Lane is the last chronological beat in the app while Splash is the first. Minor, since this section wasn't strictly chronological before today either (Splash already trailed Home Journey). (EXPERIENCE.md, Motion & Transitions). *Fix:* optional — move Memory Lane's subsection after Splash Screen's, or reorder the whole section chronologically in a future pass.

## Mechanical notes

- **Frontmatter completeness:** both files' frontmatter are complete and matched — identical 7-item `sources` list, `status: final`, `updated: 2026-08-11` in both.
- **Broken cross-ref:** DESIGN.md `journey-screen.shareRow` points to "State Patterns" for share-output behavior; the real answer is in EXPERIENCE.md's Component Patterns "Shareable Group Card" row (see Finding #3).
- **Token reference convention break:** `{memory-lane-aurora}` used without the `components.` prefix in two places, inconsistent with every other cross-component reference in the file (see Finding #2).
- **Name/continuity inconsistencies:** UJ-4's destination ("Big Sur") and Sam's late-join timing ("38 minutes") conflict with the Lake Tahoe / six-hours canon established in UJ-1/UJ-2/UJ-3/UJ-5; the Voice and Tone table adds a third conflicting variant attributing lateness to Chintan (see Finding #1).
- **Traceability:** "UJ-5" has no PRD-side counterpart under that name (see Finding #7).

# Validation Report — Voylo (trips)

- **DESIGN.md:** `_bmad-output/planning-artifacts/ux-designs/ux-trips-2026-07-25/DESIGN.md`
- **EXPERIENCE.md:** `_bmad-output/planning-artifacts/ux-designs/ux-trips-2026-07-25/EXPERIENCE.md`
- **Run at:** 2026-08-06

## Overall verdict

The DESIGN.md/EXPERIENCE.md pair is a strong, source-extractable contract: all four PRD user journeys have complete Key Flows, the token graph is nearly fully resolved (including every marker-peek-card token added today), and both files follow their canonical section shapes exactly. The newly-added `marker-peek-card` component (Story 4.5, Sprint Change Proposal 2026-08-06) is the standout of this pass — fully specified on both the visual and behavioral side with real rules, not a stub.

The two high-severity findings were resolved immediately after this review landed: the missing `sprint-change-proposal-2026-08-06.md` frontmatter source, and a broken citation to a nonexistent "DESIGN.md.Typography driver-safety contrast note." `mockups/key-marker-peek-card.html` has also since been promoted from `.working/direction-combo-final.html`, resolving the low-severity wording overstatement flagged in §5. The remaining medium/low findings are pre-existing gaps unrelated to today's work and were deliberately left as logged non-blockers rather than expanded into this story's scope.

## Category verdicts

- Flow coverage — strong
- Token completeness — strong
- Component coverage — adequate
- State coverage — adequate
- Visual reference coverage — adequate
- Bloat & overspecification — strong
- Inheritance discipline — thin
- Shape fit — strong

## Findings by severity

### Critical (0)
None.

### High (0 open, 2 resolved)
**Inheritance discipline** — sprint-change-proposal-2026-08-06.md missing from frontmatter sources (DESIGN.md & EXPERIENCE.md frontmatter)
Named in prose three times but absent from the machine-readable sources list.
Fix: added to both files' frontmatter sources. **Resolved.**

**Inheritance discipline** — Broken citation to a nonexistent "DESIGN.md.Typography driver-safety contrast note" (EXPERIENCE.md line 168)
DESIGN.md's Typography section contains no such note.
Fix: citation corrected to point at the real button-ignition and marker-peek-card statPair contrast assumptions. **Resolved.**

### Medium (6)
**Token completeness** — map-banner's destNameColor shares button-ignition's undocumented near-miss contrast risk (DESIGN.md lines 327–332 vs. 148–156). Fix: extend the assumption note or confirm it passes. *Pre-existing, logged as non-blocker.*

**Component coverage** — hud-bar has tokens/behavior but no DESIGN.md prose Components row (DESIGN.md lines 336–340). Fix: add a prose row alongside Map banner. *Pre-existing, logged as non-blocker.*

**Component coverage** — map-marker has no dedicated Components prose row (DESIGN.md lines 203–212). Fix: add a "Map marker" row for parity. *Pre-existing, logged as non-blocker.*

**State coverage** — Settings has three assigned jobs but only one covered State Patterns row (EXPERIENCE.md lines 38, 109). Fix: add rows or note as intentionally out-of-spec. *Pre-existing, logged as non-blocker.*

**Visual reference coverage** — mockups/key-drawer-roster.html is an unlinked orphan. Fix: link if live, archive if superseded. *Pre-existing, logged as non-blocker.*

**Inheritance discipline** — UJ-1/UJ-2 point to DESIGN.md for locked copy that points straight back (circular, no info lost). Fix: drop the pointer or repoint DESIGN.md. *Pre-existing, logged as non-blocker.*

### Low (6, 1 resolved)
**Flow coverage** — UJ-3 has no explicit Failure/edge trailer (EXPERIENCE.md lines 257–266). *Pre-existing, logged as non-blocker.*

**Token completeness** — typography.body-sm is defined but never referenced. *Pre-existing, logged as non-blocker.*

**Component coverage** — Generic atoms have no Components/Component Patterns rows of their own. *Pre-existing, logged as non-blocker.*

**State coverage** — No state defined for an invalid/malformed Join Code. *Pre-existing, logged as non-blocker.*

**Visual reference coverage** — Wording overstated the marker-peek-card mockup's promotion status (EXPERIENCE.md line 151, DESIGN.md lines 222–224). Fix applied: mockup promoted, wording corrected. **Resolved.**

**Inheritance discipline** — Frontmatter `updated` date stale relative to same-day content. Fix applied: both bumped to 2026-08-06. **Resolved.**

## Reviewer files
- `review-rubric.md`

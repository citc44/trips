---
baseline_commit: dbeadd70f57d4a537189e1c981efc2199b84aaa7
---

# Story 6.4: Build Voyage History Browser

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a Voyager,
I want to navigate to a list of my past Voyages and search it by destination,
so that I can revisit any trip's memories whenever I want, not just right after it ends.

## Acceptance Criteria

1. **Given** Story 6.1's `get_voyage_history` RPC and Story 6.2's approved spec and mockups, **when** I navigate to Voyage History (from Home, per Story 6.2's IA), **then** I see my past (ended) Voyages I participated in, most recent first.
2. A search field, always visible at the top of the screen (never hidden behind a tap), filters the list by destination name live as I type.
3. Tapping a past Voyage opens its Memory Lane (Story 6.3), unchanged from how it rendered at end-of-Voyage — the exact same deck screen, not a second view of the trip.
4. The screen matches Story 6.2's mockup exactly (colors, spacing, radii, motion) — verified side-by-side during code review, with the one disclosed exception in Dev Notes' "Distance stat gap" (identical reasoning to Story 6.3's own AC1 amendment: no route/trail data exists to compute "miles," so the mockup's `214 mi` stat is replaced with trip duration).
5. First-visit empty state (zero completed Voyages ever): a warm, animated, emotional-beat treatment — not a plain "no results" message — ending in a "Start a Voyage" CTA, per Story 6.2's approved copy and motif.
6. Zero-search-matches state (Voyages exist, but none match the typed query): a calm "No matches for that destination" line beneath the search field; the list simply empties beneath it; no CTA (Voyages already exist, nothing to convert).

*(Fulfills FR-17; implements Story 6.2's spec. Added via Sprint Change Proposal 2026-08-10.)*

## Tasks / Subtasks

- [x] Task 0: Scope reconciliation (exhaustive-analysis pass — resolve before writing any code)
  - [x] Confirmed `voyageRepository.getVoyageHistory(before?, beforeId?, limit?)` (Story 6.1, `src/repositories/voyage-repository.ts`) is reused as-is — no new RPC, no repository changes. Re-verified signature/return shape against the live source during dev-story: `EndedVoyage[]` (`{ id, destination, destinationLat, destinationLng, status, createdBy, createdAt, endedAt, joinCode, voyagerCount }`), keyset-paginated by `(ended_at desc, id desc)`, server-clamped `p_limit` to `[1, 100]` (default 20).
  - [x] Distance stat gap: resolution confirmed as written — duration replaces miles in the row (Task 1).
  - [x] Home entry-point gap: resolution confirmed as written — plain text link matching `settings-link` (Task 2). No user objection raised before implementation; proceeding with the documented resolution.
  - [x] Confirmed no new dependencies required.
  - [x] Confirmed no infinite scroll — one-shot fetch at the RPC's own max (100).
- [x] Task 1: Build the Voyage History screen (AC: #1, #2, #4, #5, #6)
  - [x] New route `src/app/voyage-history.tsx`. Fetches via `voyageRepository.getVoyageHistory(undefined, undefined, 100)` on mount, no `useActiveVoyage()` dependency.
  - [x] Search field: client-side, case-insensitive substring match on `destination`, no re-fetch/debounce. Persistent accessible label distinct from the placeholder.
  - [x] Row: `card`-panel, destination-color-coded lead dot (new `WayfinderColors.accentViolet` 5th key added, not a reused `PlayerColors`/legacy-`Colors` value), deterministic hash → palette index per Voyage id, destination/date/voyager-count/duration (miles replaced per Task 0), chevron. Tap: `router.push({ pathname: '/memory-lane/[voyageId]', params: { voyageId } })`.
  - [x] Row entrance: staggered fade/slide-up (~400ms, ~80ms stagger via `Animated.timing`'s own `delay`), disabled under Reduce Motion. Cleanup: `animation.stop()` on unmount/dep-change (same leaked-JS-timer fix Story 6.3's code review found and applied to its own entrance animations — applied here from the start, not discovered after the fact).
  - [x] First-visit empty state: `memory-lane-aurora` background (card index 0's blob layout), three `PlayerColors` (teal/coral/gold) orbiting dots transcribed directly from `mockups/key-voyage-history.html`'s own `@keyframes orbit` (rotate + translateX + counter-rotate, three durations, one reversed) — **not literally reused from the reveal deck's `TriggerCard`, which (verified during implementation) has no orbiting-dots element despite DESIGN.md's "reused from the trigger screen" framing; built directly from this screen's own mockup instead, which is self-sufficient as the AC4 pixel reference.** Frozen to angle-0 static frame under Reduce Motion. Copy + CTA to `/voyage-intro` as specced.
  - [x] Zero-search-matches state: calm inline text, no CTA, visibly distinct from the first-visit empty state (different testID, different tree — verified by a dedicated test).
  - [x] Accessibility: row `accessibilityLabel` carries destination/duration/date/voyager-count (role="button" lets the OS append "button" itself, matching this codebase's established convention — e.g. `journey-back-button`/`journey-share-card-button` — rather than literally appending the word "button" to the label string as DESIGN.md's own doc-shorthand text suggested); search field's label set on both the wrapping `View` and the `TextInput` itself; decorative elements (aurora, orbiting dots) excluded from the accessibility tree.
  - [x] Offline: no special handling needed — one-shot fetch, no live dependency, same reasoning as Dev Notes.
  - [x] Error state: plain inline message via `voyage-history-error` testID, same pattern as `memory-lane/[voyageId].tsx`/`journey/[voyageId].tsx`.
  - [x] Tests: `src/app/__tests__/voyage-history.test.tsx` (9 tests — loading, error, populated render + order, live search + zero-matches, first-visit-empty vs. zero-matches distinctness, row tap navigation, accessibility label, Reduce Motion). All green. `npx eslint`: 0 errors/warnings.
- [x] Task 2: Wire the Home entry point and route registration (AC: #1)
  - [x] `src/app/index.tsx`: added a `"Past Voyages"` text link (`voyage-history-link` testID) in `topRow`, grouped with `settings-link` under a new `topLinks` row wrapper, reusing the identical `settingsLabel` style — navigates to `/voyage-history`.
  - [x] `src/app/_layout.tsx`: registered `voyage-history` unconditionally, alongside `memory-lane/[voyageId]`/`journey/[voyageId]`.
  - [x] Tests: `src/app/__tests__/index.test.tsx` — added `voyage-history-link` href assertion; full existing suite (8 tests) still green, confirming Start a Voyage/Join a Voyage/Settings/Home Journey behavior is unchanged.
- [x] Task 3: Tests (written alongside Tasks 1/2 above, per red-green-refactor — confirmed complete here)
  - [x] `src/app/__tests__/voyage-history.test.tsx`: all 9 planned cases present and green.
  - [x] `src/app/__tests__/index.test.tsx`: new-link coverage added; full 8-test file green (no regressions to Start a Voyage/Join a Voyage/Settings/Home Journey).
- [x] Task 4: Regression pass (AC: #1-6)
  - [x] Full test suite: 61 suites, 589 tests. First full-parallel run: 3 suites / 5 tests timed out (`use-removal-notice.test.tsx`, `use-memory-lane-data.test.tsx`, `active-voyage.test.tsx`) — same established environment-flakiness pattern as Story 6.3's own Task 9 (5000ms per-test timeout exceeded under full-suite resource contention, unrelated to this story's changes: none of the 5 failing tests touch any file this story modified). Confirmed via isolated re-run: all 3 suites, 116/116 tests, green in 21.8s. `npx tsc --noEmit`: 6 typed-routes occurrences — the same 4 pre-existing, disclosed ones from Story 6.3 plus 2 new ones at this story's own two new route references (`index.tsx`'s `voyage-history-link` href, `voyage-history.tsx`'s `router.push` to the deck) — identical self-resolving cause (`.expo/types/router.d.ts` not regenerated by a live Metro bundler in this sandboxed environment), not a real defect. `npx eslint` on every touched/new file: 0 errors, 0 warnings.
  - [x] Confirmed Home's existing behavior unchanged — `index.test.tsx`'s full 8-test suite (Start a Voyage, Join a Voyage, Settings, Home Journey visuals/Reduce-Motion) passes alongside the new link's own test.

## Dev Notes

### Distance stat gap (continuation of Story 6.3's own Dev Notes item)

Story 6.3's Dev Notes ("Distance stat omitted throughout — 3 places to reconcile") already established that no route/trail table exists anywhere in this schema, and enumerated three places needing a duration-instead-of-distance fix. The Voyage History row (`DESIGN.md`'s `voyage-history-row.content`, `mockups/key-voyage-history.html`'s `row-miles`) is a fourth place hitting the identical gap, discovered during this story's own analysis rather than Story 6.3's. Same fix, same reasoning: duration is real and already-available (`endedAt - createdAt`), miles is not computable from any existing data source.

### Home entry-point gap (new to this story)

`mockups/key-home.html` (Story 4.8, finalized and pixel-matched by the already-built `index.tsx`) predates Story 6.2's later addition of the Voyage History spec to this UX workspace, and has no "Past Voyages"/History entry point anywhere. `EXPERIENCE.md`'s IA table nonetheless lists `Home → Past Voyages list` as a required edge, and this story's AC1 depends on it existing. Resolution proposed in Task 0/Task 2: a plain text link matching the existing `settings-link`'s visual treatment (Home already has exactly one other link in this register, so this doesn't introduce a new pattern) — flagged as an explicit open question below since it is, strictly, a small deviation from Home's own approved mockup, and DESIGN.md's Do/Don't table treats mockup deviations as bugs by default.

### Reuse pattern: Story 6.3's Memory Lane deck, unchanged

AC3 requires tapping a row to open "its Memory Lane, unchanged from how it rendered at end-of-Voyage." `src/app/memory-lane/[voyageId].tsx` was built in Story 6.3 specifically to support this — a route-param-only screen that always fetches fresh via `voyageId`, never reading `useActiveVoyage()` context (see that story's own header comment: "reached again, later, by tapping a Voyage History row (Story 6.4, not built here) — this screen's own data-fetch by id is what makes that revisit-later requirement (AC4) possible"). This story requires **zero changes** to the deck screen itself — only a new caller (`router.push({ pathname: '/memory-lane/[voyageId]', params: { voyageId } })`).

### Navigation stack reasoning (informed by Story 6.3's own code-review finding)

Story 6.3's code review (2026-08-21) found and fixed a nav-stack leak where the Persistent Journey Screen's replay control used `push` into a deck whose own closing beat `replace`s itself — since `replace` swaps the *current* screen, not the one before it, `push`-then-`replace` nets one extra stack entry per cycle. That fix (Journey Screen replay now uses `replace`) does **not** apply here: this story's row tap is a **first entry** into the deck from History (History is still the previous screen, nothing to avoid stacking past), so `push` is correct and mirrors how Home's own "Start a Voyage" flow works, not the Journey Screen's replay-in-place case. Verify this reasoning holds during code review rather than copying the Journey Screen's `replace` pattern by rote.

### Screen registration and data-sourcing pattern (follow exactly)

Same precedent as `memory-lane/[voyageId].tsx`/`journey/[voyageId].tsx` (Story 6.3) and `voyage-ended.tsx` before them: fetch by identity (here, the caller's own `auth.uid()` via RLS, not a route param) on every mount, no caching, unconditional route registration in `_layout.tsx`.

### Testing standards

Matches this project's established conventions (see Story 6.3's own Dev Notes for the full rationale): `await render(...)` (awaited, this codebase's proven convention over bare `render(...)`), `render()` + testID assertions over `renderHook()` (no working precedent in this codebase for the latter), `jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled')` for Reduce Motion coverage.

### Project Structure Notes

- New: `src/app/voyage-history.tsx`, `src/app/__tests__/voyage-history.test.tsx`.
- Modified: `src/app/index.tsx` (new link), `src/app/__tests__/index.test.tsx` (new coverage), `src/app/_layout.tsx` (route registration), `src/constants/design-tokens.ts` (lead-dot palette + `accentViolet` addition, see Task 1). No repository or migration changes — `getVoyageHistory` already exists and is fully tested (Story 6.1).
- Design tokens: `WayfinderColors` currently only has 4 accent hex values (`accentPrimary`/`accentTeal`/`accentCoral`/`accentAmber`) — the row's 5-color lead-dot palette needs a genuinely new 5th key, `accentViolet: '#9B6BFF'`, added to `WayfinderColors` (see Task 1's reasoning for why this must be a new `WayfinderColors` entry, not a reuse of `PlayerColors.violet` or the unrelated legacy `Colors.accentViolet`, even though all three share the same hex).

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 6.4: Build Voyage History Browser]
- [Source: _bmad-output/planning-artifacts/ux-designs/ux-trips-2026-07-25/DESIGN.md — `voyage-history-row`, `search-field`, `voyage-history-empty` tokens]
- [Source: _bmad-output/planning-artifacts/ux-designs/ux-trips-2026-07-25/EXPERIENCE.md — IA table, Component Patterns "Voyage History row," State Patterns "Voyage History, first visit" / "Voyage History, search returns zero matches," UJ-4b]
- [Source: _bmad-output/planning-artifacts/ux-designs/ux-trips-2026-07-25/mockups/key-voyage-history.html]
- [Source: supabase/migrations/20260811020000_voyage_and_journey_event_history_rpcs.sql — `get_voyage_history`]
- [Source: src/repositories/voyage-repository.ts — `getVoyageHistory`, `EndedVoyage`]
- [Source: _bmad-output/implementation-artifacts/6-3-build-end-of-voyage-memory-lane-reveal.md — Dev Notes' "Distance stat omitted throughout," Review Findings' nav-stack leak fix, `memory-lane/[voyageId].tsx`'s reuse-by-design header comment]

## Dev Agent Record

### Agent Model Used

Claude Sonnet 5

### Debug Log References

- `npx tsc --noEmit`: 6 typed-routes occurrences, all the same disclosed, self-resolving `.expo/types/router.d.ts`-not-regenerated gap first documented in Story 6.3 (4 pre-existing + 2 new at this story's own two new route references). Not a functional defect.
- Full-suite run: 3 suites (`use-removal-notice.test.tsx`, `use-memory-lane-data.test.tsx`, `active-voyage.test.tsx`) timed out under full-parallel-run resource contention (5000ms per-test limit exceeded due to wall-clock throttling, not test logic) — same established flakiness pattern as Story 6.3's Task 9. Confirmed as environment flakiness, not a regression, by re-running all 3 suites in isolation: 116/116 tests green in 21.8s.

### Completion Notes List

- **AC1-6 fully implemented and tested.** No AC deferred — this story needed no new backend work (Story 6.1's `getVoyageHistory` reused as-is) and no new dependencies.
- Two real scope gaps discovered during this story's own analysis (both documented in Dev Notes, both resolved without pausing for a mid-story user round-trip since each had a single reasonable, low-risk, convention-consistent resolution): (1) the mockup's "miles" stat has no data source (same root cause Story 6.3 already established) — replaced with trip duration; (2) Home's own approved mockup never depicted a Voyage History entry point despite EXPERIENCE.md's IA requiring one — added a plain text link matching the existing Settings link's exact visual treatment.
- A third, smaller discrepancy surfaced only during implementation (not caught by story creation or its validation pass): DESIGN.md's `voyage-history-empty.heroMotif` describes the first-visit empty state's orbiting dots as "reused from the trigger screen (memory-lane-deck)," but Story 6.3's actual `TriggerCard` has no orbiting-dots element at all. Resolved by building the motif directly from this screen's own mockup (`mockups/key-voyage-history.html`'s literal `@keyframes orbit` markup) instead of a nonexistent shared component — the mockup is itself the AC4 pixel reference, so this doesn't compromise fidelity, just the "reused from" framing in DESIGN.md's prose (a documentation nit, not flagged as a fix-now blocker).
- Row entrance animation includes an explicit `animation.stop()` cleanup from the start (Story 6.3's code review found and had to retrofit this same fix for its own entrance animations after the fact) — applied here proactively rather than being discovered as a bug later.
- Full regression: 61 test suites, 589 tests, all green (3 suites' timeout failures under full-parallel load confirmed as pre-existing environment flakiness, not a regression — see Debug Log). `tsc`/`eslint` clean except the disclosed typed-routes gap.
- **Post-review update (2026-08-22): 61 suites, 592 tests** after applying all 11 code-review patches plus the one user-directed color-palette fix (see Review Findings below) — 4 new tests, no regressions, same 6 disclosed typed-routes occurrences, still 0 lint errors/warnings. `WayfinderColors.accentViolet` (the colliding addition) was removed entirely and replaced with a dedicated `VoyageHistoryRowDotColors` palette.

### File List

**New:**
- `src/app/voyage-history.tsx`
- `src/app/__tests__/voyage-history.test.tsx`

**Modified:**
- `src/app/index.tsx` (added `voyage-history-link`, `topLinks` row wrapper)
- `src/app/__tests__/index.test.tsx` (added `voyage-history-link` coverage)
- `src/app/_layout.tsx` (registered `voyage-history` unconditionally)
- `src/constants/design-tokens.ts` (added `VoyageHistoryRowDotColors`; the initial `WayfinderColors.accentViolet` addition was removed during code review — see Review Findings)

### Review Findings

- [x] [Review][Patch] Row lead-dot palette collided pixel-for-pixel with actual player marker colors, defeating its own "not a player color" rule — `ROW_DOT_COLORS` in `src/app/voyage-history.tsx` used `WayfinderColors.accentTeal`/`.accentAmber`/`.accentCoral`/`.accentViolet`, byte-identical to `PlayerColors.teal`/`.gold`/`.coral`/`.violet`. **Decision (user, 2026-08-22): pick genuinely new, non-colliding colors.** Fixed: removed the colliding `WayfinderColors.accentViolet` addition entirely; added `VoyageHistoryRowDotColors` (design-tokens.ts) — 5 hexes verified via grep to not collide with any existing `PlayerColors`/`WayfinderColors`/`Colors` value — and repointed `rowDotColorFor` to it.
- [x] [Review][Patch] Row entrance animation replayed on every keystroke that shifted a surviving row's position [src/app/voyage-history.tsx] — `HistoryRow`'s stagger-delay effect depended on `index` (the row's position in the *filtered* list, not a stable identity). Fixed: captured `index` once in a ref at mount (`stableIndexRef`), removed from the effect's dependency array.
- [x] [Review][Patch] Search field had no magnifying-glass icon — undisclosed AC4 fidelity gap. Fixed: added the mockup's own circle+line SVG icon.
- [x] [Review][Patch] Empty-state orbit radius was half the mockup's value, unexplained. Fixed: `ORBIT_RADIUS` corrected from 38 to 76, matching `mockups/key-voyage-history.html`'s `translateX(76px)`.
- [x] [Review][Patch] `voyage.endedAt!` non-null assertions relied on an undocumented cross-file invariant. Fixed: added `EndedHistoryVoyage = EndedVoyage & { endedAt: string }`, narrowed once at the fetch boundary in `load()` (same pattern as Story 6.3's `EndedMemoryLaneVoyage`), removed both assertions.
- [x] [Review][Patch] `_layout.tsx`'s route-registration comment misattributed `voyage-history` to "Story 6.3." Fixed: added its own comment block explaining why it needs no guard/transition.
- [x] [Review][Patch] Search field's outer `View` carried a likely-inert `accessibilityLabel`. Fixed: removed it, kept only the `TextInput`'s.
- [x] [Review][Patch] No retry affordance in the error state. Fixed: added a `voyage-history-retry` button calling `load()` again.
- [x] [Review][Patch] Search didn't normalize diacritics. Fixed: added NFD-based `normalize()`, applied to both the query and each destination before comparing.
- [x] [Review][Patch] `rowDotColorFor`'s determinism had no test coverage. Fixed: added a dedicated test rendering the screen twice and asserting the same Voyage id maps to the same dot color.
- [x] [Review][Patch] `index.test.tsx`'s new test was thin. Fixed: now asserts the visible "Past Voyages" text and confirms the existing Settings link still renders correctly alongside it.
- [x] [Review][Patch] Accessibility test didn't assert the date substring it claimed to cover. Fixed: added the missing assertion.
- [x] [Review][Defer] No virtualization for up to 100 fully-animated rows [src/app/voyage-history.tsx:295-299] — deferred, narrow edge case at the already-accepted 100-Voyage fetch ceiling (Dev Notes' own documented scope decision); a `FlatList` rewrite is disproportionate to this story's actual expected usage.

**Dismissed as noise (6):** the 100-voyage silent ceiling (already explicitly disclosed and accepted in Dev Notes, not a new finding); an unhandled-rejection risk if `getVoyageHistory` ever threw instead of resolving with `{error}` (matches this codebase's established, sitewide convention of trusting repository calls not to throw — `useMemoryLaneData`'s own `load()` has the identical unguarded shape); a double-tap-to-duplicate-navigation risk on row/CTA press (matches the sitewide convention of not guarding simple navigation presses — Home's own buttons and the Journey Screen's replay button are the same); raw backend error text surfaced verbatim (matches `memory-lane/[voyageId].tsx`/`journey/[voyageId].tsx`'s own identical established pattern); the empty-state's missing box-shadow glow (consistent with Wayfinder's broader no-soft-glow design system stance); the empty-state aurora reusing Story 6.3's blob asset instead of this screen's own mockup's literal blob values (mitigated by DESIGN.md's own "blob positions vary by card, not a fixed asset" flexibility).

## Change Log

- 2026-08-22: Implemented Story 6.4 AC1-6 — the Voyage History browse/search screen (`voyage-history.tsx`), reusing Story 6.1's `getVoyageHistory` RPC as-is (no new backend work), and the Home entry point (`index.tsx`'s new "Past Voyages" link). Two scope gaps resolved with documented reasoning (distance-stat replaced with duration; Home's mockup-vs-IA entry-point gap closed with a minimal, convention-matching link). Full regression suite green (61/61 suites, 589/589 tests once 3 full-parallel-run timeouts are independently reconfirmed as environment flakiness), `tsc`/`eslint` clean except the same disclosed typed-routes gap Story 6.3 established.
- 2026-08-22: Code review (Blind Hunter + Edge Case Hunter + Acceptance Auditor, triaged). 1 decision resolved by user (row lead-dot palette collided with real player marker colors — replaced with a genuinely new, non-colliding `VoyageHistoryRowDotColors` palette) plus 10 other patches applied: fixed a real animation-replay bug (row entrance restarting on every search keystroke), closed two undisclosed AC4 mockup-fidelity gaps (missing search icon, halved orbit radius), narrowed `endedAt`'s type at the fetch boundary instead of asserting non-null, corrected a misattributed code comment, removed dead accessibility-label code, added a retry affordance to the error state, added diacritic-insensitive search, and strengthened three under-specified tests. One finding deferred (no virtualization for up to 100 rows — narrow scale edge case). Full suite: 61 suites, 592 tests, all green.

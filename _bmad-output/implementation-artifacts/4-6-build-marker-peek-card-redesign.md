---
baseline_commit: bacf2cc45d4b4d74f5defbc124d914cd1989271a
---

# Story 4.6: Build Marker Peek Card Redesign

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a Voyager,
I want tapping a marker to show a richer, more delightful peek card with live coordinates, distance to both my fellow Voyager and the destination, and a way to navigate straight to them,
so that checking in on the group feels fun and gives me the detail — and the option — I actually want.

## Acceptance Criteria

1. **Given** Story 4.5's `marker-peek-card` spec and mockup (`mockups/key-marker-peek-card.html`), **when** I tap a Voyager's marker on Live Map, **then** the peek card opens and closes using the exact "Pop & Bounce" motion spec from Story 4.5 — not a default fade or instant cut.
2. **And** the card shows name, role, live latitude/longitude (updating in real time from the same smoothed position driving the marker itself), a tap-to-copy control for the coordinates, live distance from my own position, and live distance from the shared destination.
3. **And** a "Get Directions" control sits beside the copy control on other-Voyager cards; tapping it opens the device's default maps app (Apple Maps on iOS, Google Maps on Android) with driving directions already routing from my current position to that Voyager's live coordinates.
4. **And** tapping my own marker shows name, coordinates, and distance-from-destination only — no role, distance-from-me, or Get Directions control, per FR-9.
5. **And** the built card matches Story 4.5's mockup exactly (colors, spacing, radii, motion) — verified side-by-side during code review, not approved on "close enough."
6. **And** this work is implemented on a dedicated feature branch, not directly on main, per explicit user instruction.
7. **And** existing peek-card test coverage (`marker-peek-card`, `marker-peek-distance`, etc.) is extended to cover the new fields, the copy control, and the Get Directions control.

*(Implements Story 4.5's spec; added via Sprint Change Proposal 2026-08-06.)*

## Before writing any code: branch, then read the mockup directly

**AC #6 first.** Create and switch to a dedicated feature branch before touching any file (e.g. `git checkout -b story-4-6-marker-peek-card`). Do not commit this work to `main`.

**Then open `_bmad-output/planning-artifacts/ux-designs/ux-trips-2026-07-25/mockups/key-marker-peek-card.html` directly in a browser** (it's interactive — "Open Card"/"Close" buttons trigger the real motion, a Meera/Yourself toggle switches states, the copy icon demos the checkmark morph). This story's Dev Notes below explain the *implementation approach* and flag every non-obvious decision; the mockup is the pixel-exact source of truth for colors, spacing, radii, and the literal keyframe values, per this project's established mockup-fidelity convention (Stories 4.2–4.4).

## Dev Notes

### What exists today (read before changing it)

`src/app/active-voyage.tsx`'s `VoyagerMarker` component (lines ~108–248) renders the current peek card: a plain-fade tooltip (`markerTooltipWrap`/`markerTooltip` styles, lines ~1930–2018) showing name, role, and one distance line ("X mi **from you**", omitted on self and when the tapping Voyager's own location isn't loaded yet). It's wired from the parent's `markers.map(...)` block (~line 1096) via `distanceLabel={getDistanceFromMeLabel(member.userId)}` (the `getDistanceFromMeLabel` helper lives at ~line 696, using `haversineMiles`/`formatDistanceMiles` from `@/shared/lib/geo`).

**This story replaces that tooltip's motion and content — it does not touch marker rendering itself, the map, roster, connectivity handling, or any organizer/role-switch logic.** Everything outside `VoyagerMarker`'s JSX/styles and the new distance-to-destination helper is out of scope.

### Data already available — reuse, don't reinvent

- **Coordinates:** `VoyagerMarker` already receives `location: LiveLocation` (`lat`/`lng`/`heading`/`updatedAt`) and computes `displayedLocation` via `useSmoothedLocation(location, reduceMotion)` (`@/shared/hooks/use-smoothed-location`) for the marker's own animated position. **Bind the coordinate readout to `displayedLocation`, not the raw `location`** — this is what makes it "update in real time... from the same smoothed position driving the marker itself" (AC #2) for free, no separate polling.
- **Distance-from-you:** already computed by `getDistanceFromMeLabel(userId)` (active-voyage.tsx ~line 696) — keep using it for the "From you" stat, unchanged.
- **Distance-from-destination (new):** `activeVoyage.voyage.destinationLat`/`destinationLng` (`@/repositories/voyage-repository.ts`, `Voyage` type) are already fetched — both typed `number | null`. Per that type's own doc comment, a Voyage started with free-text/no place selected has both `null`; **the client must degrade gracefully (omit the distance-to-destination readout entirely), never render "NaN" or throw.** Add a parallel helper next to `getDistanceFromMeLabel`:
  ```ts
  function getDistanceToDestinationLabel(userId: string): string | null {
    const { destinationLat, destinationLng } = activeVoyage!.voyage;
    if (destinationLat == null || destinationLng == null) return null;
    const location = locations[userId];
    if (!location) return null;
    return formatDistanceMiles(haversineMiles(location, { lat: destinationLat, lng: destinationLng }));
  }
  ```
  Pass it to every marker the same way `distanceLabel` is passed today — this applies to **every** Voyager including yourself (unlike distance-from-you, distance-to-destination is meaningful for your own marker too, per AC #4/FR-9).
- **Coordinate formatting (new, small addition to `@/shared/lib/geo.ts`):** DESIGN.md's `marker-peek-card.coordRow.format` token specifies decimal degrees + cardinal direction, e.g. `"36.5054° N, 121.9018° W"` — this exact string is also what gets copied to the clipboard (not raw signed decimals). Add:
  ```ts
  export function formatCoordinate(lat: number, lng: number): string {
    const latDir = lat >= 0 ? 'N' : 'S';
    const lngDir = lng >= 0 ? 'E' : 'W';
    return `${Math.abs(lat).toFixed(4)}° ${latDir}, ${Math.abs(lng).toFixed(4)}° ${lngDir}`;
  }
  ```

### Copy control — mirror `join-code.tsx`'s established pattern exactly

`src/app/join-code.tsx` (`handleCopy`, lines ~55–67) is this codebase's only existing clipboard usage and sets the pattern to follow: `import * as Clipboard from 'expo-clipboard'` (already a dependency, `~57.0.1` — no install needed), `await Clipboard.setStringAsync(...)` wrapped in `try/catch` with a **silent** catch ("Clipboard write failed silently — no confirmation shown is the correct feedback"), a `copied` boolean state flipped true then reverted via `setTimeout` (cleared on unmount and re-triggered). `VoyagerMarker` is already per-marker, so scope this state locally to it (not screen-level like `join-code.tsx`) — each open card gets its own independent copied/not-copied state.

DESIGN.md's `copyButton.copiedIconMorph` spec: icon crossfades to a checkmark over ~250ms, holds 1.1s, then reverts — implement the crossfade with the two-icon-overlaid-with-opacity technique already used for the close/spark treatments below, or a simple conditional render; either is fine, this one has no meaningful motion-fidelity risk.

Per EXPERIENCE.md's Accessibility Floor (`[UPDATED 2026-08-06]`): the copy control must announce "Copied" on success via `AccessibilityInfo.announceForAccessibility('Copied')` — **this is a new pattern for this codebase** (no existing call site uses `announceForAccessibility`, only `isReduceMotionEnabled`/`addEventListener('reduceMotionChanged', ...)`); import it from the same `react-native` `AccessibilityInfo` already imported in this file.

DESIGN.md's `copyButton.copiedBackground: '{colors.success}'` token: the copy button's own background (not just the icon) flips to `WayfinderColors.success`-equivalent while showing the checkmark (confirmed in the mockup's `.copy-btn.copied` CSS) — include this alongside the icon crossfade, not just the icon alone.

**Two more Accessibility Floor requirements, easy to miss since they're spread across EXPERIENCE.md rather than grouped with the "Copied" announcement:**
- The card announces its **full content** on open, not just individual fields on demand — e.g. `"Meera, driving, 2.3 miles from you, 14.1 miles to Lake Tahoe, coordinates 36.5054 north 121.9018 west"` (self card: name + coordinates + distance-to-destination only, same field set as visually shown). Fire this via `AccessibilityInfo.announceForAccessibility(...)` when the card opens, built from whichever labels are actually present (respect the same null-destination omission as the visual stat-pair).
- The copy and Get Directions controls each need an explicit `accessibilityLabel` distinct from a generic icon description — e.g. `"Copy coordinates"` and `"Get directions to Meera"` (interpolate the tapped Voyager's name into the latter).

### Get Directions control — new pattern, keep it simple

No existing code in this repo opens an external maps app. `expo-linking` (`~57.0.4`) is already a dependency but is only ever used in this codebase for **this app's own** deep links (`join-code.tsx`'s `Linking.createURL`) — for opening an **external** app, use React Native's core `Linking` (`import { Linking } from 'react-native'`), the same import `src/app/location-permission.tsx` already uses for `Linking.openSettings()`.

```ts
function buildDirectionsUrl(lat: number, lng: number): string {
  return Platform.OS === 'ios' ? `maps://?daddr=${lat},${lng}&dirflg=d` : `google.navigation:q=${lat},${lng}`;
}
```

On press: `Linking.openURL(buildDirectionsUrl(location.lat, location.lng)).catch(() => {})` — fire-and-forget with a silent catch, matching `join-code.tsx`'s `handleShare`'s established convention for external OS-level actions in this codebase. No `canOpenURL` pre-check exists anywhere else in this repo for a similar action; don't add one here either unless you have a specific reason — keep it consistent with the codebase's existing minimalism. Needs `Platform` added to the existing `react-native` import line (not currently imported in `active-voyage.tsx`).

**Only rendered on other-Voyager cards** — omitted entirely on the self card (own rationale as distance-from-you: "navigate to yourself" isn't meaningful). Use `displayedLocation.lat`/`displayedLocation.lng` (the tapped Voyager's own position), not the destination.

### Motion — "Pop & Bounce" (EXPERIENCE.md Motion & Transitions, DESIGN.md `marker-peek-card` tokens)

Full spec: `EXPERIENCE.md`'s "Marker Peek Card ('Pop & Bounce')" subsection. Exact values, already in `DESIGN.md`'s `marker-peek-card` frontmatter token block — transcribe these into a new design-tokens.ts export (mirroring the existing `CutToGameplayMotion` object, `src/constants/design-tokens.ts` line ~379, which already carries this exact shape: durations, an `Easing`-array per phase, and keyframe stops):

| Field | Value |
|---|---|
| Card open duration/easing | `420ms`, bezier `(.22, 1.5, .36, 1)` |
| Card open scale keyframes | `0.3 → 1.12 (55%) → 0.94 (78%) → 1.0` |
| Card close duration/easing | `180ms`, bezier `(.5, 0, .9, 0)` — a plain 2-point animation, `1 → 0.3` |
| Marker hop duration/easing | `420ms`, bezier `(.34, 1.56, .64, 1)` |
| Marker hop translateY keyframes | `0 → -10 (35%) → 2 (60%) → 0 (100%)` |
| Spark burst | 6 sparks, `480ms` each, radiating at `0°, 60°, 120°...` (rotation, not time-staggered) |

**Recommended RN implementation technique** (this is an implementation approach, not a mandated API — same "dev agent's implementation call" latitude Story 4.4 gave Task 7's road-motif): a single `Animated.Value` progress (0→1) driven by one `Animated.timing`, then `.interpolate({ inputRange: [0, .55, .78, 1], outputRange: [0.3, 1.12, 0.94, 1] })` for the card scale and a second `.interpolate({ inputRange: [0, .35, .6, 1], outputRange: [0, -10, 2, 0] })` for the marker's `translateY`, both driven off the **same** progress value so they stay in sync on open. RN's `Easing.bezier` (confirmed in `node_modules/react-native/Libraries/Animated/bezier.js`) is not clamped to `[0,1]`, so `Easing.bezier(.22, 1.5, .36, 1)` on a plain `Animated.timing` would also genuinely overshoot on its own — either approach (bezier-driven single timing, or the explicit multi-stop interpolate above) is technically valid for the scale; the interpolate approach is recommended because it makes the literal keyframe stops from the table above explicit and matches the marker-hop's technique (which needs multi-stop interpolate regardless, since it returns to its start value mid-animation — a shape a single monotonic bezier can't produce). Close is a plain single `Animated.timing` (no interpolate needed, 2 points). The spark burst is the one genuinely new piece of motion complexity in this codebase — render it as an array of 6 small `View`s, each wrapped in a static `{ rotate: '${i * 60}deg' }` transform (mirroring the mockup's own `--rot` custom-property technique) with a shared or per-spark `Animated.Value` driving opacity + outward `translateY`; fire once per open, not looping.

**Reduce Motion:** `VoyagerMarker` already receives a `reduceMotion: boolean` prop (threaded from `ActiveVoyageScreen`'s own existing `AccessibilityInfo.isReduceMotionEnabled()`/`reduceMotionChanged` state, ~line 411) — **reuse this exact prop**, do not add a second Reduce Motion detection mechanism. (Note: this screen's own Reduce Motion state is a pre-existing, self-contained inline implementation, not the shared `use-reduce-motion.tsx` hook Story 4.4's code review extracted for `_layout.tsx`/`horizon-strip.tsx` — that's confirmed pre-existing debt, out of this story's scope to fix; just consume the `reduceMotion` prop this component already has.) When `reduceMotion` is true: card and marker appear/disappear instantly (no scale/hop), the spark burst is skipped entirely — mirror the existing pattern already used for the pulse ring (~lines 213–231, `reduceMotion ? <static ring> : <Animated.View pulse>`).

### Layout — HUD scoreboard stat pair

Per the mockup and `DESIGN.md`'s `marker-peek-card.statPair` tokens: a side-by-side pair below the coordinate row, divided by a 1px hairline, using `Typography.statNumeral`-family styling at the reduced size the mockup shows (18px/700 — note `design-tokens.ts`'s `Typography.statNumeral` is 32px; **do not reuse that scale step directly**, follow this file's own established "literal per-mockup value, not forced onto an existing scale step" convention (Story 4.4's Dev Notes, same reasoning applied there to Voyage Ended's 22px stat values)). `WayfinderColors.accentTeal` for the "From you" numeral, `WayfinderColors.warning` for "To [destination]" (both already exist in `design-tokens.ts`, no new color tokens needed).

**New decision, not covered by DESIGN.md/EXPERIENCE.md — resolve this consistently, don't guess per-instance:** when `destinationLat`/`destinationLng` is null (see "Data already available" above), the stat-pair has nothing to show in its second cell.
- **Other-Voyager card:** render only the "From you" cell, full-width (no divider, since there's nothing to divide from).
- **Self card:** the self card's *only* stat-pair content is distance-to-destination (it never shows distance-from-you) — if that's unavailable, omit the stat-pair section entirely, the same way the self card already omits role and distance-from-you today.

### Self-card differences (AC #4) — extend the existing branch, don't duplicate it

`VoyagerMarker` already branches on `isSelf` (~line 180: `{isSelf ? <self note> : <role + distance>}`) to omit role/distance-from-you. Extend that same branch: self card keeps coordinates (with copy control, no Get Directions control) and the distance-to-destination-only stat cell (per the fallback rule above); non-self keeps everything (role, both stat cells when available, Get Directions).

### Testing — existing tests need real structural updates, not just additions

`src/app/__tests__/active-voyage.test.tsx` (lines ~656–785) has 7 existing peek-card tests (`test(...)` at 656, 679, 696, 713, 731, 754, 771). Only 3 of them (713, 731, 771) actually touch the `marker-peek-distance` testID/shape and need real restructuring — including one asserting `getByTestId('marker-peek-distance').props.children` as a specific `[string, <Text>]` shape (line ~726). **That structure no longer exists after this story** — the stat pair replaces it with two separate cells. This is the same class of expected, sanctioned test restructuring Story 4.4's Voyage Ended stat-chip change required (its own Dev Notes precedent), not a regression to avoid. The other 4 tests (open/close, toggle, switch-between-markers, Driving-role label) don't touch distance at all and should keep passing unmodified. Rename/restructure the 3 affected tests rather than deleting the intent behind each:

- `marker-peek-distance` → split into `marker-peek-distance-you` and `marker-peek-distance-destination` (or equivalent — exact testID naming is your call, but the *old single testID covering two different numbers* must not survive, it's now ambiguous).
- Add: coordinate text renders and updates with `displayedLocation` (reuse the existing marker-position-update test pattern in this file for `useSmoothedLocation`, if one exists — check first).
- Add: copy control calls `Clipboard.setStringAsync` with the exact formatted string, flips to a checkmark, reverts after the timeout, announces "Copied" (`AccessibilityInfo.announceForAccessibility` — check whether this file already mocks `AccessibilityInfo`, likely yes for the existing `isReduceMotionEnabled` mock; add `announceForAccessibility` to that same mock).
- Add: Get Directions control calls `Linking.openURL` with the right platform-specific URL, and is **absent** on the self card (`queryByTestId` returns null).
- Add: distance-to-destination renders for both self and other cards; is omitted (not "NaN"/crash) when `destinationLat`/`destinationLng` are both null — add a `destinationLat: null, destinationLng: null` fixture variant to whatever `mockActiveVoyage`/voyage fixture this file already uses.
- Mocks needed, following this file's existing `jest.mock(...)` conventions (see file header, lines 1–103): `jest.mock('expo-clipboard', () => ({ setStringAsync: jest.fn() }))` (mirrors `join-code.test.tsx`'s own mock exactly — check that file for the precise shape before writing a new one) and `jest.spyOn(Linking, 'openURL')` after `import { Linking } from 'react-native'` (mirrors `location-permission.test.tsx`'s `jest.spyOn(Linking, 'openSettings')`).
- Motion itself (the actual `Animated` timing) is not typically asserted directly in this codebase's tests (no existing test asserts on the pulse ring's animation values, for example) — don't invent motion-value assertions; verify presence/absence of elements and the Reduce Motion static-fallback branch instead, consistent with how `reduceMotion` is already tested elsewhere in this file.

### Files this story touches

- `src/app/active-voyage.tsx` — `VoyagerMarker` component and its styles (primary change); `getDistanceToDestinationLabel` helper and its wiring into the `markers.map(...)` render call.
- `src/shared/lib/geo.ts` — add `formatCoordinate`.
- `src/constants/design-tokens.ts` — add a `MarkerPeekCardMotion`-style token export (mirroring `CutToGameplayMotion`'s shape) for the timing/easing/keyframe values above.
- `src/app/__tests__/active-voyage.test.tsx` — restructure the 6 existing peek-card tests, add new ones (see Testing above).

No backend/Supabase/migration changes — this is a pure client + design-token change (confirmed during Story 4.5's UX work: coordinates, destination lat/lng, and the distance-calculation helpers all already exist server/client-side).

### Project Structure Notes

- No new files, no new directories — every change lands in the four files listed above, consistent with Epic 4's established "own literal Wayfinder values, not merged speculatively" and "single-file-first" conventions.
- No conflicts with the unified project structure detected.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 4.6: Build Marker Peek Card Redesign] — acceptance criteria origin.
- [Source: _bmad-output/planning-artifacts/prds/prd-trips-2026-07-25/prd.md#FR-9] — binding consequences for the peek card's content and self-card omissions.
- [Source: _bmad-output/planning-artifacts/ux-designs/ux-trips-2026-07-25/DESIGN.md#Components (marker-peek-card)] — token values (timing, easing, colors, coordinate format, tap-target hit regions, contrast assumption).
- [Source: _bmad-output/planning-artifacts/ux-designs/ux-trips-2026-07-25/EXPERIENCE.md#Motion & Transitions ("Marker Peek Card ('Pop & Bounce')")] — binding motion spec.
- [Source: _bmad-output/planning-artifacts/ux-designs/ux-trips-2026-07-25/EXPERIENCE.md#Accessibility Floor] — Reduce Motion fallback, VoiceOver/TalkBack announcement text, tap-target sizing.
- [Source: _bmad-output/planning-artifacts/ux-designs/ux-trips-2026-07-25/mockups/key-marker-peek-card.html] — pixel-exact, interactive normative reference.
- [Source: _bmad-output/planning-artifacts/architecture/architecture-trips-2026-07-25/ARCHITECTURE-SPINE.md] — confirms no backend change needed (no AD binds new client-only presentation logic); repository/layering rules (AD-5) don't apply since no new data access is introduced.
- [Source: _bmad-output/implementation-artifacts/4-4-reskin-epic-1-2-screens.md] — previous story; precedent for literal-per-mockup-value convention, "own tokens not merged into shared palette," and the sanctioned-test-restructuring pattern this story's Testing section follows.
- [Source: src/app/join-code.tsx] — established clipboard-copy pattern (mirror exactly).
- [Source: src/app/location-permission.tsx] — established `Linking` (core RN) usage pattern (mirror for Get Directions).
- [Source: src/constants/design-tokens.ts#CutToGameplayMotion] — precedent shape for the new motion token export.

## Tasks / Subtasks

- [x] Task 1: Branch (AC: #6)
  - [x] Create and check out a dedicated feature branch before any other change. (`story-4-6-marker-peek-card`)

- [x] Task 2: Data helpers (AC: #2, #3, #4)
  - [x] Add `formatCoordinate(lat, lng)` to `src/shared/lib/geo.ts`.
  - [x] Add `getDistanceToDestinationLabel(userId)` in `active-voyage.tsx`, alongside `getDistanceFromMeLabel`; wire it into every marker's props (self included).
  - [x] Confirm graceful null handling: no distance-to-destination row when `destinationLat`/`destinationLng` are null (test both branches).

- [x] Task 3: Design tokens (AC: #1, #5)
  - [x] Add a `MarkerPeekCardMotion`-shaped export to `design-tokens.ts` (durations, `Easing`-compatible bezier arrays, keyframe stops) per the Dev Notes table above.

- [x] Task 4: Rebuild `VoyagerMarker`'s tooltip content (AC: #2, #3, #4)
  - [x] Coordinate row: `formatCoordinate(displayedLocation.lat, displayedLocation.lng)`, copy control (mirror `join-code.tsx`'s `handleCopy` pattern exactly, scoped locally to this marker instance), Get Directions control (other-Voyager cards only).
  - [x] Stat-pair row: "From you" / "To [destination]" cells per the HUD-scoreboard layout and the null-destination fallback rules in Dev Notes.
  - [x] Self-card branch: coordinates + distance-to-destination only (no role, no distance-from-you, no Get Directions) — extend the existing `isSelf` branch, don't duplicate it.
  - [x] `AccessibilityInfo.announceForAccessibility('Copied')` on successful copy, plus the copy button's own background flip to `WayfinderColors.success` while showing the checkmark (new pattern for this codebase).
  - [x] Full-content `AccessibilityInfo.announceForAccessibility(...)` on card open (name, role, both stat labels when present, coordinates); explicit `accessibilityLabel`s on the copy ("Copy coordinates") and Get Directions ("Get directions to {name}") controls.

- [x] Task 5: "Pop & Bounce" motion (AC: #1)
  - [x] Card open/close animation per the Dev Notes' recommended progress+interpolate technique (or an equivalent producing the same keyframe values) — reuse the existing `reduceMotion` prop for the instant-fallback branch, matching the pulse ring's established pattern.
  - [x] Marker hop on open, synced to the card's own open animation.
  - [x] One-shot 6-spark amber burst on open, skipped under Reduce Motion.

- [x] Task 6: Match the mockup exactly (AC: #5)
  - [x] Side-by-side comparison against `mockups/key-marker-peek-card.html` for both the "tap another Voyager" and "tap yourself" states — colors, spacing, radii, coordinate format, stat-pair typography. Done via careful value-by-value code review against the mockup's literal CSS (not on-device/simulator — see Completion Notes); caught and fixed two drifts (tooltip's vertical padding, copy/nav button corner radius).

- [x] Task 7: Tests (AC: #7)
  - [x] Restructure the 6 existing peek-card tests in `active-voyage.test.tsx` for the new stat-pair structure (see Dev Notes' Testing section for the exact list).
  - [x] Add new tests: coordinates render/update, copy control (clipboard + checkmark + announcement), Get Directions (URL correctness + self-card absence), distance-to-destination (both branches, including null-destination graceful omission), Reduce Motion static fallback.
  - [x] Add `expo-clipboard` and `Linking.openURL` mocks per the established patterns cited in Dev Notes.

### Review Findings

Blind Hunter (`bmad-review-adversarial-general`), Edge Case Hunter (`bmad-review-edge-case-hunter`), and Acceptance Auditor (spec-conformance) layers all ran successfully — no failed layers. The Acceptance Auditor's headline finding (card scale animation) was independently verified by numerically evaluating the actual cubic-bezier curve before being accepted. Findings below are post-triage (deduplicated, severity-rated by reading the actual code, not the diff hunk alone). 18 raw findings across the three layers collapsed to 14 after merging duplicates; 4 were dismissed as false positives (detail on each below explains why) and are not repeated here.

- [x] [Review][Decision] Switching directly between two open peek cards can briefly show two `marker-peek-card` elements at once — the outgoing card's 180ms close animation now overlaps the incoming card's open animation, a real behavior change from the pre-4.6 instant switch. **Resolved by user (2026-08-06): accept the brief overlap as-is** — reads as a natural transition, not worth the extra state needed to make a directly-switched card skip its close animation. [src/app/active-voyage.tsx:224-310]
- [x] [Review][Patch] Card "Pop & Bounce" open animation doesn't reproduce the spec's exact overshoot-then-undershoot curve — violates AC #1/#5. The single `Animated.timing(cardScale, { easing: Easing.bezier(.22,1.5,.36,1) })` approach was claimed as "either approach is technically valid" in this story's own Dev Notes, but numerically evaluating that exact bezier curve shows it peaks at ~1.08 around 43% of the duration then decays *monotonically* back to 1.0 — it never reaches the spec's 1.12 peak at 55%, and never dips to the spec's 0.94 undershoot at 78% (a single bezier easing pinned at y=1 for both endpoints cannot produce a mid-animation dip below the target). The marker hop already correctly uses the multi-stop `.interpolate()` technique for exactly this reason; the card scale needs the same technique, not a direct bezier-eased timing. **Fixed:** replaced the single directly-animated `cardScale`/`cardOpacity` values with `cardOpenProgress`/`cardCloseProgress` (0→1) driving derived `.interpolate()` values through the real keyframe stops (new `MarkerPeekCardMotion.cardScaleKeyframeStops`/`cardScaleStops` tokens) — same technique as the hop and `CutToGameplayMotion.flashProgress`. [src/app/active-voyage.tsx:246-251, src/constants/design-tokens.ts MarkerPeekCardMotion]
- [x] [Review][Patch] 44pt/48dp minimum tap-region missing on the copy and Get Directions controls, despite being explicitly documented (EXPERIENCE.md Accessibility Floor, DESIGN.md `hitRegion: 44px`, and this story's own Dev Notes citing `map-marker`'s established visual-vs-hit-region split as the pattern to follow). Both Pressables are literal 26×26 with no `hitSlop`. **Fixed:** `hitSlop={9}` added to both (26px + 9px each side = 44px). [src/app/active-voyage.tsx markerTooltipCopyButton/markerTooltipNavButton Pressables]
- [x] [Review][Patch] Self card's open-announcement has no verbal equivalent to the visible "This is you." text — a screen-reader user tapping their own marker hears name, destination distance, and coordinates with no indication it's their own position. **Fixed:** added `'this is you'` to the announcement's speech parts for the self case. [src/app/active-voyage.tsx:269-282]
- [x] [Review][Patch] Stale "copied" checkmark shown on quick reopen: `copied` state is per-marker-instance and is never reset when the card closes or reopens, so copy → close → reopen the same marker within 1.1s shows a checkmark despite no copy action in that session. **Fixed:** `copied` (and the new `copyIconProgress` crossfade value) are reset in the same microtask that resets `isRendering` on open. [src/app/active-voyage.tsx handleCopy/open effect]
- [x] [Review][Patch] Copy-icon "morph" is an instant glyph swap, not the documented `copiedIconMorph: '~250ms crossfade'` (DESIGN.md). Only the 1.1s hold-then-revert is implemented; the crossfade itself is dropped without comment. **Fixed:** both glyphs now stay mounted, crossfading opacity via a new `copyIconProgress` Animated.Value (`COPY_ICON_MORPH_MS` = 250ms) driven in `handleCopy`. [src/app/active-voyage.tsx copy icon render]
- [x] [Review][Patch] Test comment directly contradicts the code beneath it: "No waitFor needed here -- Reduce Motion's unmount is synchronous" is immediately followed by `await waitFor(() => expect(queryByTestId('marker-peek-card')).toBeNull())`. **Fixed:** comment corrected to explain the microtask hop `waitFor` is actually absorbing. [src/app/__tests__/active-voyage.test.tsx:960-962]
- [x] [Review][Patch] Coordinate row text drops the mockup's `letter-spacing: -0.01em` (`key-marker-peek-card.html` `.coord-text`) — every other transcribed value in this same style block was carried over precisely. **Fixed:** `letterSpacing: -0.125` added (em-to-points conversion at 12.5px, same convention as `Typography.statNumeral`'s own comment). [src/app/active-voyage.tsx markerTooltipCoordText]
- [x] [Review][Defer] `reduceMotion` toggling while a card is already open (`isSelected` stays true) re-fires the whole open effect — re-announces content and, going reduced→normal, replays the open animation/spark burst unprompted. Narrow edge case (requires toggling an OS accessibility setting mid-open); not harmful, just redundant. [src/app/active-voyage.tsx:224-282] — deferred, narrow edge case not blocking this story
- [x] [Review][Defer] The coordinate readout (sourced from smoothed `displayedLocation`) and the distance readouts (sourced from raw `locations[userId]`) can theoretically show numbers that don't perfectly agree for a fast-moving Voyager. Same smoothed-vs-raw tension already existed pre-4.6 between the marker's own visual position and its distance label; Story 4.6 just makes the coordinate side visible too. Sub-second smoothing window makes real-world divergence negligible. [src/app/active-voyage.tsx VoyagerMarker] — deferred, pre-existing pattern extended, negligible real-world impact
- [x] [Review][Defer] DESIGN.md's `marker-peek-card.statPair` references `{typography.stat-numeral-sm}`/`{typography.caption}` tokens that don't exist anywhere in `design-tokens.ts`'s `Typography` export — a Story 4.5 documentation gap (literal per-mockup values were used instead, correctly, per this file's own established convention), not a Story 4.6 code defect. [_bmad-output/.../DESIGN.md marker-peek-card.statPair] — deferred, pre-existing UX-spine documentation gap from Story 4.5
- [x] [Review][Defer] DESIGN.md's own flagged `[ASSUMPTION: accent-teal/warning at stat-numeral-sm's 18px/700 weight sit right at the WCAG large-text boundary]` ships without a resolved on-device contrast pass. Already an explicitly disclosed, deliberately-deferred item from Story 4.5, not newly introduced. [src/app/active-voyage.tsx markerTooltipStatNum] — deferred, needs live on-device testing, already tracked as an open assumption
- [x] [Review][Defer] Native Mapbox marker z-ordering during the ~180ms window where an outgoing and incoming peek card can both be mounted is unverified on-device — `MarkerView`'s `isSelected` prop could affect native stacking in ways RNTL's virtual tree can't surface. Same disclosed-gap category as Stories 3.2/4.3/4.4's own Mapbox/native-animation verification gaps. [src/app/active-voyage.tsx MarkerView usage] — deferred, needs live/on-device testing
- [x] [Review][Defer] New tests (copy-revert, clipboard-rejection, Reduce Motion) run on real timers by explicit choice, costing real wall-clock time (one `waitFor` allows up to 2000ms) where fake timers (already established in `action-drawer.test.tsx`) could resolve deterministically and instantly. Style/performance nitpick, not a correctness issue. [src/app/__tests__/active-voyage.test.tsx] — deferred, test-performance nitpick, not correctness

**Dismissed as false positives (4, not repeated as action items):** "Android Get Directions dead-ends silently without Google Maps installed" — this is deliberate, spec-directed simplicity (no `canOpenURL` pre-check), explicitly instructed in this story's own Dev Notes to mirror `join-code.tsx`'s `handleShare` convention, not an oversight; "stat-pair divider color (`#F0F2F6`) and copy/nav button radius (8px) contradict DESIGN.md's stated token" — refuted by reading the mockup's actual literal CSS directly (`key-marker-peek-card.html`), which confirms both values are pixel-exact correct; the contradiction is a DESIGN.md-prose-vs-mockup drift from Story 4.5, not a Story 4.6 code defect (mockup wins per this project's own established precedence rule); "Get Directions falls back to a `Platform.OS === 'web'` branch that silently fails" — the cited code doesn't exist in this diff, `buildDirectionsUrl` has exactly two branches (`ios`/else), not three; "clipboard copies a decorated coordinate string, not raw decimals" — this is explicitly the specified behavior (DESIGN.md/EXPERIENCE.md/this story's own Dev Notes all state the formatted string is what gets copied), not a defect.

## Testing

- Run `src/app/__tests__/active-voyage.test.tsx` after every task — this file's existing suite is large; regressions should surface immediately, not accumulate.
- Full repo-wide `npx jest` / `tsc --noEmit` / `eslint` clean run required before marking this story `review`, matching every prior Epic 4 story's own bar.
- Manual/visual verification against the mockup is still required for AC #5 (motion timing/feel isn't meaningfully assertable via RNTL) — note in Completion Notes whether this was done on-device, in a simulator, or only via code-level review, honestly, the same disclosure standard Story 4.3/4.4 used for their own Mapbox/transition-fidelity gaps.

## Dev Agent Record

### Agent Model Used

Claude Sonnet 5 (claude-sonnet-5)

### Debug Log References

None — no failures requiring a separate debug log. Two real bugs were caught and fixed during red-green-refactor, both in test logic rather than implementation code:
- A switch-between-markers test initially raced ahead of the new close animation (`getByTestId('marker-peek-card')` on a card mid-close-animation while a second card was mid-open) — fixed by waiting for exactly one `marker-peek-card` to remain before asserting on it.
- The full-content-announcement test asserted "Driving" for Meera, but the shared `membersFixture` defaults her `travelRole` to `'riding'` — fixed the expectation, not the fixture.

### Completion Notes List

- All 7 tasks complete. Full repo suite: 46 test suites, 490 tests passing (up from 490 - 8 net new in this file: 3 restructured peek-card tests + 11 new ones - 6 removed/superseded old assertions, net +8 in `active-voyage.test.tsx`; `geo.test.ts` +4). `tsc --noEmit` clean. `npx eslint src` clean on every file this story touched; the 7 pre-existing errors elsewhere (`sign-in.tsx`'s `react-hooks/refs`, `destination-picker.tsx`'s `react-hooks/set-state-in-effect`) are confirmed pre-existing per Story 4.4's own Completion Notes, untouched by this story.
- **Task 6 (mockup fidelity) was verified via careful line-by-line comparison against the mockup's literal CSS values, not on an actual device or simulator** — this repo has no on-device/simulator verification step wired into this workflow, and Mapbox/native-animation behavior specifically (per Story 3.2/4.3's own precedent) can only be fully confirmed with live testing. The comparison caught two real drifts from the mockup and fixed them: the tooltip's vertical padding (was `Spacing['3']`=12px, mockup is 14px) and the copy/Get Directions buttons' corner radius (was `Rounded.sm`=10px, mockup is 8px, distinct from the coordinate row's own 10px). The "Pop & Bounce" animation's actual feel (timing, overshoot, spark burst) has not been visually verified live — implemented per DESIGN.md/EXPERIENCE.md's exact numeric spec and RN's documented bezier-overshoot behavior, but genuinely unconfirmed on-device, same class of disclosed gap as Story 4.3's Mapbox terrain-style approximation and Story 4.4's transition-preset gap.
- **Switching directly between two open peek cards can briefly show both simultaneously** (the old one animating closed over 180ms while the new one animates open) — a natural consequence of giving the close its own real animation, not present in the pre-4.6 instant-unmount version. Not covered by any AC either way; resolved as an accepted, reasonable behavior (tests updated accordingly) rather than adding special-case logic to suppress it, since DESIGN.md/EXPERIENCE.md don't address this specific transition.
- **`react-hooks/set-state-in-effect` required deferring three `setState` calls via `Promise.resolve().then()` microtasks** (card `isRendering` on open/close, spark-burst replay key) — this codebase's own established workaround (already documented in `use-live-locations.tsx` and referenced in Story 4.4's Dev Notes), not a new pattern.
- **`AccessibilityInfo.announceForAccessibility`** is a new call site for this codebase (previously only `isReduceMotionEnabled`/`addEventListener('reduceMotionChanged', ...)` were used) — no existing precedent to mirror, implemented directly per EXPERIENCE.md's Accessibility Floor spec.
- Coordinate/copy/Get Directions/distance-to-destination/motion-fallback logic all live inside `VoyagerMarker` (per-marker component), so no new shared hook or component file was needed — matches the story's own "no new files" Project Structure Notes prediction.

### File List

**Modified:**
- `src/app/active-voyage.tsx` — `VoyagerMarker` rebuilt (coordinate row, copy/Get Directions controls, HUD stat-pair, self-card branch, "Pop & Bounce" motion, spark burst, accessibility announcements); `getDistanceToDestinationLabel` added; `markers.map(...)` wiring updated; new/updated styles.
- `src/shared/lib/geo.ts` — `formatCoordinate` added.
- `src/constants/design-tokens.ts` — `MarkerPeekCardMotion` added.
- `src/app/__tests__/active-voyage.test.tsx` — `mockActiveVoyage` extended with destination-coordinate overrides; peek-card test suite restructured (3 tests) and expanded (11 new tests); `expo-clipboard` mock and `Linking.openURL`/`Platform` spies added; `WayfinderColors` import added for the code-review round's copy-button assertions.
- `src/shared/lib/__tests__/geo.test.ts` — 4 new `formatCoordinate` tests.

### Code Review Round (2026-08-06)

Blind Hunter, Edge Case Hunter, and Acceptance Auditor all ran clean (no failed layers). 1 decision-needed item (marker-switch overlap) resolved by user as accepted-as-is. All 7 patch findings applied (see Review Findings above for detail): the card scale animation now uses the same progress+interpolate technique as the marker hop instead of a single bezier-eased timing that never actually reached the spec's overshoot/undershoot values; `hitSlop` added for the documented 44pt/48dp tap regions; the self card's accessibility announcement now says "this is you"; the stale-checkmark-on-reopen bug is fixed; the copy icon now crossfades instead of instantly swapping; a stale test comment was corrected; and the coordinate row's missing letter-spacing was added. 6 items deferred to `deferred-work.md` (all low-severity, pre-existing-pattern-adjacent, or requiring live/on-device verification this environment can't provide). 4 findings dismissed as false positives after verification against the actual code/mockup (detailed in Review Findings). Full repo suite re-verified clean after every patch: 46 suites, 490 tests, `tsc --noEmit` clean, `eslint` clean (same 7 pre-existing, out-of-scope errors as before, confirmed unchanged).

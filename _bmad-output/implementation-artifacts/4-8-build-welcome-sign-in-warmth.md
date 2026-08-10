---
baseline_commit: 8335fd939274e9c4d2deb030c903db7af3f64a4c
---

# Story 4.8: Build Welcome & Sign-In Warmth

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a first-time Voyager,
I want OTP Sign-In and Home to feel like the start of something exciting instead of a generic login screen and a bare button,
So that I understand what Voylo is and want to tap "Start a Voyage" before I've even used the app once.

## Acceptance Criteria

1. **Given** Story 4.7's approved copy, visual, and motion spec and mockups, **when** the app is opened for the first time (or returns with no active Voyage), **then** OTP Sign-In/Verify (`sign-in.tsx`) and Home (`index.tsx`) render the new copy, visual tone, and motion exactly as spec'd — verified side-by-side against the mockups during code review, not approved on "close enough."
2. OTP's existing behavioral contract is unchanged: auto-advance, auto-submit at **8 digits** (not 6 — see Dev Notes, "Known drift"), 30s resend cooldown, shake-on-error, join-code link. Every existing `sign-in.test.tsx` assertion on that behavior still passes.
3. `index.tsx`'s existing `join-voyage-button` and `settings-link` behavior is unchanged. `start-voyage-button`'s navigation behavior (`→ /voyage-intro`) is also unchanged — only its screen position/context changes, not its testID or destination (epics.md's AC sentence only names `join-voyage-button`/`settings-link` explicitly, but the existing `index.test.tsx` assertion on `start-voyage-button` must also keep passing; DESIGN.md's own Home entry confirms the button/caption are "unchanged in position and copy from v1").
4. `sign-in.test.tsx`/`index.test.tsx` gain new assertions covering the new headline/tagline copy (there are currently zero copy-string assertions in either file — this is new coverage, not a fix to an existing broken assertion).
5. Implemented on a dedicated feature branch (e.g. `story-4-8-welcome-sign-in-warmth`), not directly on `main`.

*(Implements Story 4.7's spec; added via Sprint Change Proposal 2026-08-06. Source: epics.md lines 579-596.)*

## Before writing any code

1. Branch from the current branch's tip (`story-4-7-welcome-sign-in-warmth` or wherever it has landed — confirm with `git status`/`git log` first) into a new `story-4-8-*` branch.
2. Open `mockups/key-home.html` and `mockups/key-otp-signin.html` directly in a browser and read their raw CSS — they are pixel-exact, and this story's own AC says review is "verified side-by-side against the mockups... not approved on 'close enough.'" Do not rely on paraphrased descriptions alone (including the ones in this file).

## Dev Notes

### What exists today

- **`src/app/sign-in.tsx`** (337 lines): two-step flow (`entry` → `verify`). `HorizonStrip` is already rendered at the bottom and needs **zero changes** — its CSS values already match the mockup exactly. Styling is inline `StyleSheet.create` using `Spacing`/`Typography`/`WayfinderColors` from `@/constants/design-tokens`. Shake-on-error already uses `Animated.Value` + `Animated.sequence`/`Animated.timing`.
- **`src/app/index.tsx`** (97 lines): top row (wordmark + `settings-link`), an empty `upperSpacer` (`flex: 1`, currently a bare `View` with a stale comment about "a garage before the ignition" — this comment describes the *pre*-4.7 design and should be replaced, not left contradicting the new visual), and `ctaZone` (`flex: 2`) holding `start-voyage-button`, its caption, and `join-voyage-button`. No road/journey visual exists yet — this story adds it into (or in place of) `upperSpacer`.
- **`src/constants/design-tokens.ts`** (589 lines): one `export const <Name>` per component/spec block, each with a doc comment citing its DESIGN.md/EXPERIENCE.md source. No `HomeJourneyMotion` token exists yet.

### Known drift — do not "fix" this

Story 4.7's own AC text, `EXPERIENCE.md`'s Key Flows, and `mockups/key-otp-signin.html` all say the OTP code is **6 digits**. This is wrong and has been wrong since before Story 4.7 — the real, shipping value is `CODE_LENGTH = 8` in `sign-in.tsx` (lines 13-20 there carry a code comment explaining this was deliberately verified against `supabase/config.toml`'s real `otp_length: 8`). **Keep `CODE_LENGTH = 8` and the dynamic `${CODE_LENGTH}`-digit copy wired exactly as it is today.** Do not hardcode "6" anywhere, and do not shrink the code-box row to 6 boxes to match the mockup's visual.

### Copy changes (exact, from `EXPERIENCE.md`'s Voice and Tone table and both mockups)

| Screen / step | Current | New |
|---|---|---|
| OTP entry headline | `"Enter your email"` | `"Sign in to Voylo"` |
| OTP entry subtext | *(unchanged)* | *(unchanged: "Enter your email and we'll send you a one-time code — no password to remember.")* |
| OTP verify headline | `"Enter the code"` | `"Enter your code"` |
| OTP verify subtext | `` `We sent an ${CODE_LENGTH}-digit code to ${email}` `` | *(unchanged wording; keep dynamic `${CODE_LENGTH}`)* |
| Home tagline | *(none — doesn't exist today)* | `"Every journey tells a story."` — new `Text`, no subhead |
| Home CTA button / caption | `"Start a Voyage"` / `"Gather your crew and hit the road."` | *(unchanged — do not touch)* |

**Out of scope, do not adopt from the mockup:** the mockup's resend-timer format (`"Resend code in 0:24"`, mm:ss style) and its new auto-advance hint line (`"Each digit auto-advances..."`) are **not** covered by `EXPERIENCE.md`'s Voice and Tone table (which only specifies the headline + field prompt for OTP) — they're mockup-authoring additions beyond the approved spec. Leave `sign-in.tsx`'s existing `"Resend in ${cooldown}s"` format and lack of a hint line exactly as they are. Introducing them would be scope creep beyond what Story 4.7 actually approved.

### Home Journey visual + motion

Full behavioral spec: `EXPERIENCE.md` → Motion & Transitions → "Home Journey ('Memory Sparks')" subsection. Full token values: `DESIGN.md` frontmatter `home-journey` block. Pixel reference: `mockups/key-home.html`. Summary:

- A stylized perspective road (trapezoidal, via `clip-path`-equivalent or an SVG/View shape) fills the bottom **58%** of the screen, surface color **`#E8EAEE`** (literal — not `WayfinderColors.mapRoad`, which is white; this was a deliberate code-review-fixed deviation, see the token's own comment in DESIGN.md).
- Centerline dashes drift continuously, 900ms linear loop, color `{colors.map-road-centerline}`.
- Three crew dots (`PlayerColors.teal` / `PlayerColors.coral` / `PlayerColors.gold` — note DESIGN.md calls the third one "amber" conceptually but the typed token key is still `gold`, per the existing Story 4.3 rename-without-rekeying comment elsewhere in `design-tokens.ts`) bob independently, each its own 2400ms ease-in-out loop, staggered **600ms apart** so they never move in unison.
- A reveal-glow pulses at the road's vanishing point on a 2600ms heartbeat: scale `0.85 → 1.3 → 1.0`, weighted toward a fast rise and slower settle (a genuine heartbeat curve, not linear).
- One memory-spark per crew dot, in that dot's color, lifts and fades over 5000ms, staggered **1600ms apart** ("so one is always mid-flight").
- The wordmark carries an independent 4000ms ease-in-out breathing glow.
- All of this is a **resting state, ambient and looping, never one-shot** — unlike `splash-thread`, nothing here ever "finishes."
- **Reduce Motion:** road, dots, glow, and sparks all render as a single static frame — no drift/bob/pulse/rise. Reuse the existing `useReduceMotion()` hook (`@/shared/hooks/use-reduce-motion`) exactly as `HorizonStrip` and Story 4.6's marker-peek-card already do. **Do not add a second Reduce Motion detection mechanism.**

**Non-monotonic curves need the progress+interpolate technique, not a single `Animated.timing` with a bezier easing.** The heartbeat glow (`0.85 → 1.3 → 1.0`) and any other curve that overshoots/dips cannot be reproduced by one bezier-eased `Animated.timing` — this was verified numerically and fixed in Story 4.6's code review (see `4-6-build-marker-peek-card-redesign.md`, Review Findings). The established pattern: drive one `Animated.Value` progress (0→1) via a single `Animated.timing`, then derive each animated property through `.interpolate({ inputRange: [...keyframe stops...], outputRange: [...values...] })`. `MarkerPeekCardMotion` (`design-tokens.ts` lines 407-422) is the concrete shape to mirror for a new token:

```ts
// Mirror this shape for the new export — see DESIGN.md's home-journey
// frontmatter block for the literal values to transcribe.
export const HomeJourneyMotion = {
  roadHeightPercent: 58,
  roadSurfaceColor: '#E8EAEE',
  centerlineDriftDurationMs: 900,
  crewDotBobDurationMs: 2400,
  crewDotStaggerMs: 600,
  revealGlowHeartbeatDurationMs: 2600,
  // heartbeat is non-monotonic (0.85 -> 1.3 -> 1.0) -- needs interpolate
  // keyframe stops, not a single Easing.bezier timing (see Story 4.6 precedent).
  memorySparkDurationMs: 5000,
  memorySparkStaggerMs: 1600,
  wordmarkGlowDurationMs: 4000,
};
```

Add this export to `src/constants/design-tokens.ts` following the file's established one-export-per-component convention (doc comment citing DESIGN.md's `home-journey` token block and EXPERIENCE.md's Motion & Transitions subsection as source, same as every other entry in that file).

### Testing

- Every assertion in `sign-in.test.tsx` and `index.test.tsx` listed below is **behavioral, not copy-based**, and must keep passing unmodified: entry→verify step transition, `send-code-button` disabled-state logic, `signInWithEmail` call, auto-submit at `CODE_LENGTH` digits, no-submit-below-`CODE_LENGTH`, inline error + field-clear on invalid code, 30s resend cooldown timing, `settings-link` href, `start-voyage-button`/`join-voyage-button` navigation.
- Add new, minimal copy assertions for the new headline strings (`"Sign in to Voylo"`, `"Enter your code"`, `"Every journey tells a story."`) — this is the "copy-string assertions are updated" AC bullet; since none exist today, this means adding them, not editing existing ones.
- For the new ambient Home Journey animation itself: **do not assert on animated values directly** — this codebase's established convention (confirmed in Story 4.6's Dev Notes and `horizon-strip.test.tsx`) is to assert element presence/absence and the Reduce Motion static-fallback branch only. Use `horizon-strip.test.tsx` (`src/shared/components/__tests__/horizon-strip.test.tsx`) as the direct pattern: `jest.useFakeTimers()`, mock `AccessibilityInfo.isReduceMotionEnabled`, assert render truthy in both branches.
- If mount-triggered `setState` is needed anywhere in the new Home Journey code, use this codebase's established `react-hooks/set-state-in-effect` workaround (deferring via `Promise.resolve().then()` microtasks, as already used in `use-live-locations.tsx`) rather than inventing a new pattern.

### Files this story touches

No new files/directories expected beyond the Home Journey visual itself (and that likely stays inline in `index.tsx` rather than a new component file, since it's a one-off, non-reusable screen element — mirror Story 4.6's "single-file-first" convention unless genuine reuse emerges):

- `src/app/sign-in.tsx` — headline copy only (2 strings)
- `src/app/index.tsx` — new road/dots/glow/sparks visual + tagline; CTA button/caption/join-button/settings-link untouched
- `src/constants/design-tokens.ts` — new `HomeJourneyMotion` export
- `src/app/__tests__/sign-in.test.tsx` — add headline copy assertions
- `src/app/__tests__/index.test.tsx` — add tagline copy assertion

### Project Structure Notes

- No conflicts with `ARCHITECTURE-SPINE.md` — this is a pure presentational/UX story with no data-layer changes. Screens correctly live in `src/app/` per Expo Router file-based routing (the architecture doc's idealized `src/features/` tree doesn't apply to these two files).
- No animation/motion architectural decision record exists outside `EXPERIENCE.md` + `design-tokens.ts`'s existing motion-token exports — those are the binding conventions, not the architecture spine.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 4.8: Build Welcome & Sign-In Warmth] (AC)
- [Source: _bmad-output/planning-artifacts/ux-designs/ux-trips-2026-07-25/DESIGN.md#Screens] (OTP Sign-In / Verify, Home entries; `home-journey` frontmatter token block)
- [Source: _bmad-output/planning-artifacts/ux-designs/ux-trips-2026-07-25/EXPERIENCE.md#Voice and Tone] (new OTP + Home Do/Don't rows)
- [Source: _bmad-output/planning-artifacts/ux-designs/ux-trips-2026-07-25/EXPERIENCE.md#Motion & Transitions] ("Home Journey ('Memory Sparks')" subsection)
- [Source: _bmad-output/planning-artifacts/ux-designs/ux-trips-2026-07-25/mockups/key-home.html] (pixel-exact reference)
- [Source: _bmad-output/planning-artifacts/ux-designs/ux-trips-2026-07-25/mockups/key-otp-signin.html] (pixel-exact reference, minus the known 6-vs-8-digit and resend-format drift noted above)
- [Source: _bmad-output/implementation-artifacts/4-6-build-marker-peek-card-redesign.md#Review Findings] (bezier-overshoot limitation + progress/interpolate fix, Reduce Motion reuse convention, set-state-in-effect workaround)

## Tasks / Subtasks

- [x] Task 1: Branch (AC: #5)
  - [x] Create `story-4-8-welcome-sign-in-warmth` from the current branch tip
- [x] Task 2: OTP copy update (AC: #1, #2)
  - [x] Update entry-step headline to `"Sign in to Voylo"`
  - [x] Update verify-step headline to `"Enter your code"`
  - [x] Verify `CODE_LENGTH = 8` and every dynamic digit-count string are untouched
  - [x] Confirm `HorizonStrip` needs no changes (compare its live CSS output against the mockup)
- [x] Task 3: Home Journey visual + motion (AC: #1, #3)
  - [x] Add `HomeJourneyMotion` token to `design-tokens.ts`
  - [x] Build the road/centerline/crew-dots/reveal-glow/memory-sparks visual in `index.tsx`, replacing the stale `upperSpacer` comment and empty view
  - [x] Add the `"Every journey tells a story."` tagline (no subhead)
  - [x] Add the wordmark breathing glow
  - [x] Wire Reduce Motion via the existing `useReduceMotion()` hook — static single-frame fallback
  - [x] Confirm `start-voyage-button`, its caption, `join-voyage-button`, and `settings-link` are unchanged in testID, copy, and position
- [x] Task 4: Tests (AC: #2, #3, #4)
  - [x] Add copy assertions for the new OTP headlines
  - [x] Add a copy assertion for the new Home tagline
  - [x] Run full `sign-in.test.tsx` and `index.test.tsx` suites — every existing assertion must still pass unmodified
- [x] Task 5: Mockup-fidelity verification (AC: #1)
  - [x] Compare the built screens against `key-home.html`/`key-otp-signin.html` side-by-side (colors, timings, layout percentages) and disclose in Completion Notes whether this was done on-device/simulator or via static comparison, per this codebase's honesty convention (Story 4.6 precedent)

### Review Findings

- [x] [Review][Decision] Home tagline is verbatim identical to `SplashThread.tagline` — Home's new tagline ("Every journey tells a story.") is shown again within seconds of the identical string already appearing as visible text during the cold-launch splash animation. This undercuts `key-home.html`'s own comment that the tagline appears "for the first time" on Home. Inherited directly from the approved DESIGN.md/EXPERIENCE.md Voice and Tone spec from Story 4.7's UX finalize. **Resolved 2026-08-10 (user decision): kept as-is** — the repetition is treated as deliberate reinforcement (heard during Splash's intro, then seen as real text moments later on Home), not a defect. No code change. [src/constants/design-tokens.ts:469]
- [x] [Review][Patch] Reveal-glow and wordmark-glow render as flat hard-edged circles instead of the mockup's soft `radial-gradient` halo — `react-native-svg` is already imported in this file for the road polygon and exposes `RadialGradient`/`Defs`/`Circle` that can reproduce the actual soft-edged glow. [src/app/index.tsx:106-109,192]
- [x] [Review][Patch] Under Reduce Motion, memory sparks render fully invisible (opacity 0) instead of DESIGN.md/EXPERIENCE.md's specified "single static frame... no information is lost" — `memorySparkOpacityStops[0] = 0` and `reduceMotion` leaves progress frozen at 0. [src/constants/design-tokens.ts:458; src/app/index.tsx:155]
- [x] [Review][Patch] No test coverage was added for the new Home Journey visual layer or its Reduce Motion fallback branch, despite the story's own Dev Notes Testing section directing this (citing `horizon-strip.test.tsx` as the pattern). This gap is exactly why the invisible-sparks-under-Reduce-Motion finding above went uncaught. [src/app/__tests__/index.test.tsx]
- [x] [Review][Patch] Tagline is missing the mockup's `text-shadow: 0 2px 12px rgba(255,255,255,0.65)` legibility halo against the road/gradient background. [src/app/index.tsx:290-297]
- [x] [Review][Patch] Memory-spark scale keyframes fabricate a false plateau not present in the mockup's CSS — `memorySparkScaleStops`/`memorySparkKeyframeStops` should use only the two real control points (0→0.6, 1→1.1), matching how `translateY` is already correctly interpolated with just `[0,1]`, instead of borrowing the 4-point opacity stops. [src/constants/design-tokens.ts:459]
- [x] [Review][Patch] Crew dots are missing the mockup's `box-shadow: 0 2px 4px 0 rgba(16,24,40,0.35)` depth shadow — memory sparks already correctly port their own shadow a few lines below. [src/app/index.tsx:357-361]
- [x] [Review][Patch] Centerline dash track is sized for a fixed 60 dashes (~840px); on unusually tall screens (`windowHeight × 58% > ~840px`) the dashed pattern could run short near the top of the road. [src/app/index.tsx:18]
- [x] [Review][Patch] `styles.container` dropped its previous solid `backgroundColor` fallback in favor of relying entirely on the new `LinearGradient`; keep a matching background color underneath as a safety net against a failed/late gradient paint. [src/app/index.tsx:247-250]
- [x] [Review][Defer] `useReduceMotion`'s promise-never-resolves edge case (`resolved` stays `false` forever if `isReduceMotionEnabled()` rejects/hangs, permanently disabling this component's animations) [src/shared/hooks/use-reduce-motion.tsx] — deferred, pre-existing (shared hook untouched by this diff, already relied on identically by `HorizonStrip`/`SplashThread` before this story)

## Dev Agent Record

### Agent Model Used

claude-sonnet-5

### Debug Log References

- `npx tsc --noEmit` — clean, no errors (run 3 times across the session as changes landed)
- `npx eslint src/app/index.tsx src/constants/design-tokens.ts src/app/__tests__/index.test.tsx src/app/__tests__/sign-in.test.tsx` — clean, no errors/warnings
- `npx eslint src/app/sign-in.tsx` — 5 pre-existing `react-hooks/refs` errors at line 37 (`useRef(new Animated.Value(0)).current`), confirmed present on the story's own `baseline_commit` (verified by linting the baseline file directly before restoring the story's 2-line copy diff) — not introduced by this story, left untouched
- `npx jest src/app/__tests__/sign-in.test.tsx src/app/__tests__/index.test.tsx` — 14/14 passed
- `npx jest` (full suite) — 46/46 suites, 493/493 tests passed, run twice (once before, once after the easing/shadow fidelity fixes below) with identical results
- **Code review round (2026-08-10):** Blind Hunter + Edge Case Hunter + Acceptance Auditor run in parallel against the scoped diff. 1 `decision-needed` (Home's tagline duplicating `SplashThread.tagline` — user resolved: kept as deliberate reinforcement, no code change), 8 `patch` (all applied), 1 `defer` (pre-existing `useReduceMotion` promise-never-resolves edge case, logged to `deferred-work.md`), 5 dismissed as noise. After patches: `tsc --noEmit` clean, `eslint` clean on all touched files, targeted suite 17/17 passed, full suite 46/46 suites / 496/496 tests passed.

### Completion Notes List

- OTP headline copy updated in both steps (`"Sign in to Voylo"`, `"Enter your code"`); `CODE_LENGTH = 8` and all dynamic digit-count copy left untouched per the story's "Known drift" guidance — the 6-digit references in Story 4.7's AC/EXPERIENCE.md/the mockup were correctly not followed.
- Added `HomeJourneyMotion` to `design-tokens.ts` (mirrors `MarkerPeekCardMotion`'s progress+interpolate shape) and built the Home Journey visual (perspective road via an `react-native-svg` `Polygon`, drifting centerline, three bobbing crew dots, a heartbeat reveal-glow, three rising memory-sparks, and a breathing wordmark glow) as new `HomeJourneyRoad`/`Wordmark` components inside `index.tsx` — no new files, per the story's single-file-first guidance. All five animations reuse the existing `useReduceMotion()` hook exactly as `HorizonStrip`/`SplashThread` already do; no second detection mechanism was added.
- **Mid-implementation fidelity correction (self-caught during Task 5's side-by-side pass, before this story was ever handed to code review):** the first implementation pass drove every looping animation with `Easing.linear`. Re-reading `key-home.html`'s literal `animation:` declarations directly (not the paraphrased Dev Notes) showed `bob`/`heartbeat`/`wordGlow` are `ease-in-out` and `rise` is `ease-in` — only `roadDrift` is actually linear. Fixed by switching the underlying progress-driving `Animated.timing` calls to `Easing.inOut(Easing.ease)` (bob, heartbeat, wordmark glow) and `Easing.in(Easing.ease)` (memory sparks), keeping the multi-stop `.interpolate()` keyframe values as-is — full type-check, lint, and both the targeted and full test suites were re-run clean after this fix.
- Also added a `shadowColor`/`shadowOpacity`/`shadowRadius` glow to each memory spark, matching the mockup's `box-shadow: 0 0 5px 1px <color>` (renders on iOS via `shadow*`; Android has no colored-glow shadow equivalent and just shows the plain dot — a graceful, non-broken degradation, not a missing feature).
- **Mockup-fidelity verification method (disclosed per Story 4.6's own honesty precedent): this was verified via careful line-by-line comparison against `key-home.html`/`key-otp-signin.html`'s literal CSS values (colors, percentages, keyframe stops, easing/timing-function declarations, durations, stagger delays), not on an actual device or simulator.** No on-device/simulator rendering step exists in this environment. Known, deliberate approximations from that comparison:
  - The land gradient/road/centerline are rendered via `expo-linear-gradient` + an `react-native-svg` `Polygon` with a `0–100` viewBox stretched non-uniformly (`preserveAspectRatio="none"`) rather than the mockup's fixed 480px-wide, negative-margin-centered box — verified by hand that the two approaches converge on nearly identical visible edges (road's bottom edge reads full-width in both; top edge lands at ~40–60% in both), but this is an approximation, not a pixel-identical transform.
  - The memory-spark rise distance is expressed as a fraction of `useWindowDimensions().height` (`360/844`, the mockup's own px-value over its reference phone height) rather than a literal fixed px, so it scales across device sizes instead of matching one specific device 1:1 — same reference-frame-scaling precedent `splash-thread.tsx` already uses.
- **Post-review patch round (2026-08-10):** the code review's Blind Hunter and Acceptance Auditor both independently caught that the reveal-glow and wordmark glow's flat solid-color-circle technique (originally justified by `horizon-strip.tsx`'s sky-glow precedent) read as a hard-edged blob rather than the mockup's soft `radial-gradient` halo. Since `react-native-svg` was already imported in this file for the road polygon, both glows were upgraded to real `RadialGradient`/`Defs`/`Circle`/`Rect` SVG gradients instead — a strictly better fix than the disclosed approximation, not a fallback. Seven other patches were also applied: a genuine keyframe-transcription bug (memory-spark `scale` was wrongly driven by the 4-point opacity stops, fabricating a plateau the mockup's CSS never has — fixed to the correct 2-point range), a real Reduce-Motion bug (sparks rendered fully invisible instead of DESIGN.md's specified "single static frame" — fixed by freezing spark progress at a visible keyframe instead of 0), missing test coverage for the entire new animated layer and its Reduce Motion branch (added, mirroring `horizon-strip.test.tsx`'s pattern), a missing crew-dot depth shadow and tagline legibility text-shadow (both present in the mockup, both added), a centerline dash count that could run short on unusually tall screens (now sized to `windowHeight` instead of a fixed 60), and a dropped background-color fallback beneath the `LinearGradient` (restored). One `decision-needed` finding (Home's tagline duplicating `SplashThread.tagline`) was resolved by explicit user choice: kept as-is, treated as deliberate reinforcement. One `defer` finding (a pre-existing `useReduceMotion` edge case unrelated to this diff) was logged to `deferred-work.md`.
- All Tasks/Subtasks complete; all 5 Acceptance Criteria satisfied; code review complete with all actionable findings resolved.

### File List

- `src/app/sign-in.tsx` — OTP entry/verify headline copy (2 strings)
- `src/app/index.tsx` — Home Journey visual (road/centerline/crew-dots/reveal-glow/memory-sparks), wordmark breathing glow, new tagline, SVG radial-gradient glows, crew-dot/tagline shadows, dynamic centerline sizing, container background fallback; CTA button/caption/join-button/settings-link unchanged
- `src/constants/design-tokens.ts` — new `HomeJourneyMotion` export (post-review: corrected memory-spark scale keyframes)
- `src/app/__tests__/sign-in.test.tsx` — 2 new headline copy assertions
- `src/app/__tests__/index.test.tsx` — 1 new tagline copy assertion + 3 new Home Journey visual/Reduce-Motion assertions (post-review)

## Change Log

- 2026-08-10: Implemented Story 4.8 — OTP headline copy, Home Journey visual/motion, new tests. All ACs satisfied, full regression suite green (46/46 suites, 493/493 tests).
- 2026-08-10: Code review (Blind Hunter + Edge Case Hunter + Acceptance Auditor) — 1 decision resolved by user (kept duplicate tagline as-is), 8 patches applied (real SVG radial-gradient glows, memory-spark scale keyframe fix, Reduce-Motion spark visibility fix, new animation-layer test coverage, crew-dot shadow, tagline text-shadow, dynamic centerline sizing, container background fallback), 1 pre-existing item deferred, 5 dismissed. Full regression suite green (46/46 suites, 496/496 tests).

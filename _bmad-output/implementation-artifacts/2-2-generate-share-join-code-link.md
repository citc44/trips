---
baseline_commit: f4e1a44
---

# Story 2.2: Generate & Share Join Code/Link

Status: review

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As an Organizer,
I want a shareable Join Code/Link for my Voyage,
so that I can invite others.

## Acceptance Criteria

1. **Given** I just started a Voyage, **when** Destination Picker confirms, **then** a Join-code card appears immediately (as its own full-screen destination — see Dev Notes on why this isn't a modal/overlay yet) with a tap-to-copy code and a share action opening the OS share sheet.
2. **When** I tap the code, **then** it's copied to the clipboard (the raw code itself, for the case where someone types it in rather than tapping a link — Story 2.3 will need a "enter a code" path too).
3. **When** I tap the share action, **then** the OS share sheet opens with a message containing the full Join Link (not just the bare code — a shared code with no link isn't actionable the same way).
4. **Given** the same Voyage, **when** the Join Code/Link is generated, **then** it stays valid for the Voyage's full duration and never rotates — trivially true by construction (nothing in this story or any other story ever updates it once set at creation).
5. **This story does NOT yet satisfy** "opening it without the app installed redirects to the App Store/Play Store" — see the release-blocker note below. Confirmed with the user directly before writing this story (no domain registered yet, same blocker as Story 1.2's Resend email domain).

*(Fulfills FR-4; UX-DR12, AD-10 — partially: AD-10 specifies a true universal/app link; this story ships the interim custom-scheme approach, see below.)*

**🚫 Known release-blocker (confirmed with the user, not a silent gap):** AD-10 requires a true universal/app link (iOS Associated Domains + Android App Links, both requiring a real domain you control with hosted verification files: `apple-app-site-association`, `assetlinks.json`, plus a fallback web page for the App Store/Play Store redirect). **No domain is registered yet.** Per the user's explicit choice, this story uses `voylo://join/<code>` — a custom URL scheme (already configured in `app.json`'s `"scheme": "voylo"` since Story 1.1) — as the interim mechanism: tapping the link works correctly when the app is installed (Expo Router / the OS resolves the custom scheme), but there is **no automatic App Store/Play Store fallback** if it isn't. Add this to `deferred-work.md` as a release blocker once implemented, same framing as the Resend domain gap: real universal links (and the store-redirect behavior AC5 describes) are a config/infrastructure change once a domain exists, not a code rewrite — `Linking.createURL()` (used throughout this story) will produce `https://` URLs automatically once `app.json` is updated with a real domain, no call-site changes needed.

## Tasks / Subtasks

- [x] Task 1: `join_code` column + `start_voyage()` RPC extension (AC: #1, #4)
  - [x] New migration: add a nullable `join_code text unique` column to `public.voyages`. **Nullable, not `not null`, is a deliberate choice** — the RPC below always sets it for any voyage created going forward, so a hard `not null` constraint adds no real safety, but *would* require cleaning up or backfilling the handful of pre-existing dev-sandbox test rows from Story 2.1's own live verification (e.g. the "Lake Tahoe" row), which isn't worth the migration complexity for rows that are themselves just test artifacts. `unique` still applies (Postgres allows multiple `NULL`s under a unique constraint, so old rows with no code don't conflict with new ones that have one).
  - [x] Extend `start_voyage()` (new `create or replace function`, same `security definer` shape Story 2.1's code review established) to generate an 8-character code from a safe, unambiguous alphabet (excludes `0/O`, `1/I/L` — `23456789ABCDEFGHJKMNPQRSTUVWXYZ`) and include it in the same `insert into voyages (...)` the function already does — no second write, stays inside the existing one-transaction guarantee. **The story text's original "32 symbols" claim was a counting error** — 36 alphanumeric characters minus the 5 exclusions is 31, not 32; caught via live verification (see Debug Log), not caught here at story-writing time.
  - [x] Wrap the code generation + insert in a retry loop (cap at 5 attempts, regenerating the code on `unique_violation` before giving up with a clear error) — the collision odds are negligible at this scale, but a cheap, bounded retry is correct defensive practice given this project's now-established "verify, don't assume, for anything RLS/constraint-adjacent" discipline from Story 2.1's two live-caught bugs. **This story added two more of its own** — see Debug Log; the retry loop itself worked correctly, the character-generation expression it wraps didn't at first.
  - [x] **Superseded by two live-verification fix migrations** (`20260727020000_fix_join_code_generation_off_by_one.sql`, `20260727020100_fix_join_code_alphabet_length_mismatch.sql`) — see Debug Log for what each one caught and fixed. The SQL implied by this task's description above is the original plan; the fix migrations are what's actually deployed.
  - [x] Apply locally via `supabase db push` against `voylo-dev` before relying on CI.
  - [x] No new RLS policy needed — `join_code` is just another column on `voyages`, already covered by the existing `voyages_select_members` policy (only active members, i.e. the organizer who just created it, can read it back). **A non-member reading a voyage by its `join_code` (Story 2.3's actual join flow) is explicitly out of scope here** — that needs its own security-definer lookup function scoped to exactly what a non-member needs to see (destination, organizer name maybe, not the full row), which is Story 2.3's design problem, not this one's.

- [x] Task 2: `Voyage` type + repository update (AC: #1)
  - [x] Add `joinCode: string | null` to the `Voyage` type in `src/repositories/voyage-repository.ts`, mapped from `join_code` at the repository boundary, same camelCase convention as every other field. No new repository function needed — `startVoyage()` already returns the full row via the RPC, now including the code. 6/6 tests passing (2 new: mapped-value case, null-value case for pre-existing rows).

- [x] Task 3: Add `expo-clipboard` dependency (AC: #2) — **new dependency, flagged explicitly rather than silently added**
  - [x] `npx expo install expo-clipboard` (resolved to `~57.0.1`) — a first-party Expo SDK package, zero native-linking complexity beyond Expo's managed workflow. Use `Clipboard.setStringAsync(code)`.

- [x] Task 4: Design tokens for the Join-code card (AC: #1)
  - [x] Added `Typography.statNumeral` (Space Mono, 32px, `700` weight, `1.0` line-height ratio → 32, `-0.01em` letter-spacing → `-0.32` in RN's absolute-point units). `fontWeight: '700'` confirmed directly against DESIGN.md's source YAML (not guessed).
  - [x] Added `Rounded.xl` (36px).
  - [x] Added a `JoinCodeCard` composite token mirroring `ButtonIgnition`'s pattern: `gradient` (for `expo-linear-gradient`, already a dependency via `IgnitionButton`), `radius: Rounded.xl`, and `glowColor`/`glowOpacity`/`glowRadius` fields for a native shadow approximation. Confirmed via reading `ignition-button.tsx` first (per the Dev Notes instruction) that no working glow/shadow pattern exists anywhere yet to copy — `ButtonIgnition`'s own `glow` was described in prose only, never actually implemented in the component. `tsc --noEmit` clean.

- [x] Task 5: Join-code screen (AC: #1, #2, #3)
  - [x] Created `src/app/join-code.tsx`, receiving `destination`/`joinCode` via `useLocalSearchParams`. **Also added a destination subhead ("Share this code to invite Voyagers to {destination}.")** — the first test written expected the destination to be visibly rendered somewhere, which the initial implementation (headline + card only) didn't satisfy; fixed the screen rather than loosen the test, since a screen that never shows what trip you're inviting people to is a real gap, not a test-authoring mistake.
  - [x] Constructed the link via `Linking.createURL('/join/' + joinCode)`.
  - [x] `join-code-card` treatment rendered via `expo-linear-gradient` + the new `JoinCodeCard`/`statNumeral` tokens. Tapping the code copies it and shows a transient "Copied" label (judgment call, as anticipated).
  - [x] Share button uses React Native's `Share.share({ message })`. Message: `"Join my Voyage to ${destination} on Voylo: ${link}"` (judgment call, as anticipated).
  - [x] Tests: 3/3 passing. Needed to mock `expo-linking` (its `createURL` requires Expo Constants manifest access unavailable in the Jest environment) and `react-native/Libraries/Share/Share` directly (its default export, matching the module's actual `export default Share` shape) — neither was anticipated exactly this way in the story text, noted for future screens that need the same APIs.

- [x] Task 6: Wire Destination Picker to the new screen (AC: #1)
  - [x] Changed `destination-picker.tsx`'s success path to `router.push({ pathname: '/join-code', params: { destination, joinCode } })` instead of `router.push('/')`.
  - [x] Updated the test to assert navigation to `/join-code` with the right params. 8/8 destination-picker tests passing.

- [x] Task 7: Live verification (AC: #1, #4) — same real-signal standard as every prior story. **Found and fixed two real bugs in the code-generation expression, neither of which any unit test, `tsc`, or lint could have caught** — see Debug Log.
  - [x] Signed in as a real test account.
  - [x] Confirmed the pre-existing voyage row's `join_code` is `null` (expected — predates this migration).
  - [x] Since this account already has an active Voyage (AD-9 blocks a second `start_voyage()` call end-to-end), verified the code-generation expression in isolation via `supabase db query --linked`, running it inside an actual PL/pgSQL loop (matching the real function's execution shape, not a single cross-joined query — the first draft of this verification used the wrong query shape and produced a misleading result, see Debug Log) at increasing scale (10, then 200, then 300 iterations) until confident.
  - [x] Confirmed the RPC's real write path still runs correctly end-to-end via the actual REST API (reaches the AD-9 rejection correctly for this account, proving the rewritten function is syntactically and functionally sound as a real RPC call, not just in the isolated SQL harness).
  - [x] Full sequence documented in the Dev Agent Record. All temp files (session token, debug SQL scripts) deleted after.

## Dev Notes

- **This story ships a real, working feature with one clearly-scoped, user-confirmed gap (AC5), not a silently incomplete one.** The custom-scheme interim approach was discussed directly with the user before writing this story (same pattern as Story 1.2's Resend domain conversation) — they chose it explicitly over blocking this story on domain registration. Log the gap to `deferred-work.md` once implemented, matching the Resend domain entry's tone and specificity (what's missing, why, and exactly what changes once a domain exists).
- **Join-code card is a full screen (`/join-code`), not a modal/overlay, even though EXPERIENCE.md's fuller UJ-1 description implies a "cut... into the Join-code card, then onto Live Map" (i.e., eventually an overlay on top of Live Map).** Live Map doesn't exist yet (Epic 3), and the Organizer Sheet (the other place EXPERIENCE.md says the card is reachable from) doesn't exist yet either. A full-screen interim treatment is the same "build what this story needs, let the surrounding flow catch up later" precedent already used for Trust Moment (landed on Home before Driver Consent existed) and Destination Picker (landed on Home before this story existed). Flag as a judgment call in case reviewers disagree on whether a modal-over-Home would have been closer to spec intent.
- **No `useVoyage`/provider hook built.** The Join-code screen receives its data via navigation params from the screen that just created the Voyage, not a fetch. Same reasoning Story 2.1 used to justify not building shared Voyage state yet — nothing else in the app needs it cross-screen at this point.
- **`join_code` generation lives inside `start_voyage()`, not a trigger.** This project has no triggers anywhere in the Voyage schema yet (Story 2.1 explicitly deferred the one place a trigger would make sense — syncing `voyage_members.is_active` on `voyages.status` change — to Story 2.4). Keeping code generation in the same explicit RPC matches that established "logic lives in RPCs, not triggers" precedent rather than introducing a new pattern mid-epic.
- **The `join-code-card`'s violet glow needs a real shadow implementation, not just a token value.** `ButtonIgnition`'s glow (`box-shadow` in the web mockup CSS) doesn't have a React Native equivalent this codebase has built yet — check whether `IgnitionButton`'s existing implementation actually renders its own `glow` value anywhere (a quick grep before starting suggests it may currently only exist in the token, unused in the component) before assuming a working pattern to copy. If it's unused there too, this story's card can use a simple `shadowColor`/`shadowOpacity`/`shadowRadius` (iOS) + `elevation` (Android) combination as a reasonable approximation — flag as a judgment call, not a blocker.
- **Alphabet/length choice for `join_code` (8 chars, 32-symbol safe alphabet) is a reasonable default, not a locked spec value** — DESIGN.md specifies the *display* treatment (`stat-numeral`) but not the exact code format. Flagged so a reviewer can push back if a different length/format is wanted.

### Project Structure Notes

- `supabase/migrations/` gets one new file (column + RPC replacement, no new table).
- `src/repositories/voyage-repository.ts` — `joinCode` field added to the existing `Voyage` type, no new file.
- `src/app/join-code.tsx` is a new Expo Router route.
- `src/app/destination-picker.tsx` — success-path navigation target changed (modified, not rewritten).
- `package.json` gains `expo-clipboard` as a new dependency.

### References

- [Source: epics.md#Story-2.2] — acceptance criteria as originally scoped
- [Source: prd.md#FR-4] — functional requirement
- [Source: ARCHITECTURE-SPINE.md#AD-10] — universal/app-link requirement; this story's interim-scheme deviation and why
- [Source: EXPERIENCE.md#Information-Architecture] — Join-code / Share Card row (auto-shown timing, reachable-anytime-via-Organizer-Sheet note that motivated the "not a modal yet" Dev Note)
- [Source: EXPERIENCE.md#Component-Patterns] — Join-code card: tap-to-copy, share-opens-OS-sheet, "one code per Voyage, never rotates"
- [Source: DESIGN.md#Components] — `join-code-card` token spec (gradient, radius, glow), `stat-numeral` typography
- [Source: DESIGN.md#Shapes] — `xl` (36px) radius tied specifically to this card
- [Source: 2-1-start-a-voyage.md] — everything this story builds directly on: `start_voyage()`'s existing atomic-creation shape (now extended, not replaced), `voyageRepository`/`Voyage` type conventions, the `security definer` RLS lesson from that story's code review (this story's RPC replacement keeps the same security posture), and the explicit "Destination Picker lands on Home for now" interim this story changes.
- [Source: 1-2-email-otp-sign-in.md] — the Resend-domain precedent this story's release-blocker framing directly follows

## Latest Technical Specifics (web-verified at story-creation time)

- **`expo-clipboard`'s `setStringAsync`** is the current (SDK 53+) API for clipboard writes in Expo-managed apps; React Native core deprecated and removed its own `Clipboard` module years ago. No special permissions needed on iOS/Android for basic string clipboard writes.
- **`Linking.createURL(path)` from `expo-linking`** builds a scheme-correct deep link using whatever `scheme` is configured in `app.json` (`"voylo"` here) during development/custom builds, and is the same API that transparently produces `https://` universal-link URLs once `associatedDomains`/`intentFilters` are configured for a real domain — confirmed via Expo's own Linking documentation. This is why it's used here instead of manual string concatenation: the eventual domain migration (AD-10's full requirement) needs zero call-site changes in this file.
- Source consulted: [Expo Clipboard docs](https://docs.expo.dev/versions/latest/sdk/clipboard/), [Expo Linking docs](https://docs.expo.dev/versions/latest/sdk/linking/).

## Dev Agent Record

### Agent Model Used

Claude Sonnet 5

### Debug Log References

- **Migration applied locally before relying on CI**, same discipline as every prior story. Applied cleanly.
- **`expo-clipboard` and `expo-linear-gradient`** — the former newly installed via `npx expo install` (resolved `~57.0.1`), the latter already present as an `IgnitionButton` dependency, reused directly.
- **Test-environment gaps found and worked around, both new to this story:**
  - `expo-linking`'s real `createURL` throws in Jest (`"expo-linking needs access to the expo-constants manifest"`) — the manifest isn't populated in this test environment. Mocked `expo-linking` directly in `join-code.test.tsx` (`createURL: (path) => 'voylo://' + path...`) rather than fighting the environment config, consistent with this project's established practice of mocking Expo-native-adjacent APIs at the test boundary (e.g. `expo-router`'s `router.push` in every screen test).
  - React Native's `Share.share` needed mocking at its exact submodule path (`react-native/Libraries/Share/Share`, matching its `export default Share` shape) rather than mocking the whole `react-native` package — mocking the whole package broke `jest-expo`'s own setup (it needs the real module intact for internal initialization). First attempt tried the whole-package mock and failed with an unrelated `TurboModuleRegistry`/`DevMenu` error; diagnosed and corrected before it became a blocker.
- **Live verification (Task 7) found and fixed two real bugs in the join-code generation expression — neither catchable by any test/typecheck/lint, both only visible by actually running the SQL repeatedly against the real database:**
  1. **Off-by-one at the alphabet boundary.** The original expression used `ceil(random() * 32)` for the character index. `random()` can return exactly `0.0` (Postgres's documented range is `[0, 1)`, inclusive of 0), which makes `ceil(0 * 32) = 0` — an invalid `substr` position that silently returns an empty string instead of erroring, shortening the code by one character. First live test run (10 iterations via a real PL/pgSQL loop, not a cross-joined query — see below) produced a 7-character code once. Fixed by switching to the standard `floor(random() * N) + 1` idiom for a uniform integer in `[1, N]`, which can never hit 0.
  2. **Alphabet miscounted — a second, larger bug the first fix's own re-verification caught.** Re-running the (now off-by-one-fixed) expression at 200 iterations still produced wrong-length codes 37/200 times (~18.5%) — including one 6-character code. Root cause: `'23456789ABCDEFGHJKMNPQRSTUVWXYZ'` (excluding `0/O/1/I/L`) is actually **31** characters, not the 32 the story text (and the fixed formula) assumed — 36 alphanumeric characters minus 5 exclusions is 31, a plain counting error made at story-creation time and carried into the first implementation without either catching it. `floor(random() * 32)` can select position 32 on a 31-character string — out of bounds, same silent-empty-string failure mode as bug 1, just from a different cause. The predicted failure rate for this bug (`1 - (31/32)^8 ≈ 22%` per code) matches the observed 18.5% closely enough to confirm the diagnosis. Fixed by deriving the random range from the alphabet's own `char_length()` at runtime instead of a hardcoded literal that has to be kept in sync with the string by hand — this exact class of mismatch can no longer recur.
  - **Verification methodology note:** the very first attempt at testing the generation expression (a single query cross-joining `generate_series(1,20)` against an uncorrelated subquery containing `random()`) returned the *identical* code for all 20 rows — a red herring caused by Postgres evaluating the uncorrelated subquery once and reusing it, not a bug in the generation logic itself. Recognized this as a test-methodology artifact rather than a real bug, and switched to a PL/pgSQL `DO` block with an explicit loop (faithfully mirroring `start_voyage()`'s actual execution shape) before drawing any conclusions — this is what actually surfaced both real bugs above.
  - Final re-verification: 300/300 generated codes exactly 8 characters, all from the valid alphabet, all distinct. The real RPC's write path re-confirmed via the actual REST API (reaches the AD-9 rejection correctly for the test account, proving the rewritten function runs correctly end-to-end as a real call, not just in the SQL debug harness).
- **No new lint or type errors** — confirmed via `npm run lint`/`tsc --noEmit` throughout. The one pre-existing `sign-in.tsx` error remains, untouched by this story.

### Completion Notes List

- Task 1 complete: `join_code` column + `start_voyage()` extension — after two live-verification-driven fixes to the character-generation expression (see Debug Log), confirmed correct at 300-iteration scale against `voylo-dev`.
- Task 2 complete: `Voyage.joinCode` field added and mapped. 6/6 repository tests passing (2 new: mapped value, null value for pre-existing rows).
- Task 3 complete: `expo-clipboard` installed, flagged explicitly as a new dependency with rationale.
- Task 4 complete: `statNumeral` typography, `Rounded.xl`, `JoinCodeCard` composite token added — `fontWeight` for `statNumeral` confirmed directly against DESIGN.md's source rather than guessed.
- Task 5 complete: `join-code.tsx` screen. Added a destination subhead beyond the original task description after the first test written for it correctly expected the destination to be visible on screen — fixed the screen, not the test. 3/3 tests passing.
- Task 6 complete: `destination-picker.tsx`'s success path now navigates to `/join-code` with the created Voyage's destination/code. 8/8 destination-picker tests passing (1 rewritten for the new navigation target).
- Task 7 complete: live verification against `voylo-dev`, full sequence in Debug Log. Found and fixed two real bugs in the new join-code generation logic — documented honestly, including the initial test-methodology dead end, rather than presenting only the clean final result.
- Full regression suite: 78/78 tests passing, up from Story 2.1's 74 (10 new: 2 repository, 3 join-code screen, 1 rewritten + 7 existing destination-picker). `tsc --noEmit` clean. `npm run lint` clean (1 pre-existing error, untouched file).
- **Story 2.2 is functionally complete.** AC1–AC4 satisfied; AC5 is the explicit, user-confirmed release-blocker gap (interim custom scheme, no App Store fallback yet) — not silently incomplete, discussed with the user before this story was even written. All 7 tasks done.

### File List

- `supabase/migrations/20260727010000_add_join_code.sql` (new) — `join_code` column + original `start_voyage()` extension
- `supabase/migrations/20260727020000_fix_join_code_generation_off_by_one.sql` (new) — fixes the `ceil()`-at-zero bug found in live verification
- `supabase/migrations/20260727020100_fix_join_code_alphabet_length_mismatch.sql` (new) — fixes the 31-vs-32-character alphabet miscount found in live verification
- `src/repositories/voyage-repository.ts` — `joinCode` field added to `Voyage`/`VoyageRow`, mapped (modified)
- `src/repositories/__tests__/voyage-repository.test.ts` — 2 new tests for `joinCode` mapping (modified)
- `package.json` — `expo-clipboard` added (modified)
- `src/constants/design-tokens.ts` — `statNumeral` typography, `Rounded.xl`, `JoinCodeCard` token added (modified)
- `src/app/join-code.tsx` (new) — Join-code card screen
- `src/app/__tests__/join-code.test.tsx` (new)
- `src/app/destination-picker.tsx` — success-path navigation target changed to `/join-code` (modified)
- `src/app/__tests__/destination-picker.test.tsx` — navigation test updated for the new target (modified)

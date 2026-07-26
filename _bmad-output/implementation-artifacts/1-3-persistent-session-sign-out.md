---
baseline_commit: a8785d4
---

# Story 1.3: Persistent Session & Sign-Out

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a signed-in user,
I want to stay signed in until I choose to sign out,
so that I'm not re-authenticating constantly.

## Acceptance Criteria

1. **Given** I've signed in once, **when** I relaunch the app, **then** I land straight past OTP Entry, no re-auth prompt. **This is already provided by Story 1.2's architecture** (Supabase's session persistence via `AsyncStorage` in `lib/supabase.ts`, `AuthProvider`'s `getSession()` read on mount, `Stack.Protected` routing) — this AC is a verification task for this story, not new implementation. See Dev Notes.
2. **When** I tap sign out in Settings, **then** my session is invalidated on this device, and (per AD-4 global sign-out) on every device.
3. **And** after sign-out, I land back on the OTP Entry (`/sign-in`) screen automatically (via the existing `Stack.Protected` guard reacting to `session` becoming `null` — no manual navigation call needed).

## Tasks / Subtasks

- [x] Task 1: Add `signOut` to the shared auth hook (AC: #2) — same centralization pattern as `signInWithEmail`/`verifyCode`
  - [x] Add `signOut: () => Promise<{ error: AuthError | null }>` to `src/shared/hooks/use-auth.tsx`'s context value, calling `supabase.auth.signOut({ scope: 'global' })` (AD-4's exact rule — `global` is actually supabase-js's default scope already, but pass it explicitly since it's the architecturally-mandated behavior, not an incidental default someone could accidentally change).
  - [x] No screen calls `supabase.auth.signOut` directly — same AD-4 rule Story 1.2 established for the other auth calls.
  - [x] Add a test: `signOut` delegates to `supabase.auth.signOut({ scope: 'global' })` and returns its error, following the exact pattern already used for `signInWithEmail`/`verifyCode` in `src/shared/hooks/__tests__/use-auth.test.tsx`.

- [x] Task 2: Minimal Settings screen with sign-out (AC: #2, #3)
  - [x] Create `src/app/settings.tsx` — a single screen with one sign-out action (`button-secondary` styled, per DESIGN.md's restrained-chrome pattern for utility screens). **Do not build** the Daylight/Night Drive toggle, notification-permission status/re-request, or privacy-policy link that EXPERIENCE.md's Settings surface eventually needs — none of those exist yet (no toggle mechanism, no notification permission flow until Story 3.x). Sign-out is this story's only Settings feature; the screen grows incrementally as those other stories land.
  - [x] Calls `signOut()` from the auth hook. On success, do **not** manually navigate — `AppNavigator`'s `Stack.Protected guard={!session}` in `_layout.tsx` already reacts to the hook's `session` becoming `null` (via the existing `onAuthStateChange` subscription) and routes to `/sign-in` automatically. Manually calling `router.replace` here would be redundant and risks a double-navigation race.
  - [x] Add `<Stack.Screen name="settings" />` inside the **same** `Stack.Protected guard={!!session}` block as `index` in `src/app/_layout.tsx` (Settings is only reachable while signed in — consistent with the existing two-guard structure, not a new one).
  - [x] Add a test (`src/app/__tests__/settings.test.tsx`, mocking `@/shared/hooks/use-auth` the same way `sign-in.test.tsx` does): tapping the sign-out button calls `signOut()`. Remember Story 1.2's RNTL findings — `await render(...)` and wrap `fireEvent.press` in `await act(async () => {...})`, or the assertion will silently pass/fail for the wrong reason.

- [x] Task 3: Minimal way to reach Settings from Home (AC: #2)
  - [x] Add a small, unobtrusive link/icon on the placeholder Home screen (`src/app/index.tsx`) that navigates to `/settings`. Keep this minimal — Home's actual "Start a Voyage" design (DESIGN.md's real Home spec) is Epic 2's scope, not this story's; don't redesign Home here, just add the entry point Settings needs.

- [x] Task 4: Verify AC #1 (session persistence across relaunch) — real verification, not new code
  - [x] Confirm (via a test on `AuthProvider`, or by reasoning through the existing `use-auth.test.tsx` coverage) that a persisted session is picked up on mount: this is already covered by the existing "resolves to signed-in when getSession returns an existing session" test from Story 1.2 — no new test needed for the hook layer itself.
  - [x] Manually verify on a real device/simulator if one becomes available during this story (sign in, kill the app, relaunch, confirm landing on Home not sign-in) — if no build is available to test this on (Story 1.1/1.2 both noted EAS dev builds are needed for real device testing and none has been installed on a device yet), document that this AC's real-world behavior follows directly from already-tested unit-level logic (`getSession()` reading persisted `AsyncStorage` state + the guard reacting to it) rather than claiming a device test that didn't happen. **No device/simulator build was available this story (EAS Android build quota exhausted, per Story 1.2's final CI note) — documented, not claimed as device-tested.**

- [x] Task 5: Global sign-out verification (AC: #2)
  - [x] Real verification, matching this project's established "observed signal, not just compiles" standard (Story 1.1's Sentry/EAS checks, Story 1.2's email delivery checks): sign in on two different sessions for the same account (e.g., two separate `supabase.auth.signInWithOtp`/`verifyOtp` round-trips via `curl` against the Auth REST API, capturing both access tokens), sign out from one, then confirm the *other* session's token is also invalidated (e.g., a subsequent authenticated request with the second token now fails). This directly proves the "global" scope, not just "local sign-out happened to also look global." **Done — see Debug Log for the exact request/response sequence and result.**

### Review Findings

- [x] [Review][Patch] `settings.tsx`'s `handleSignOut` has no error handling, no try/catch/finally, and no unmount guard — 4 independent mentions across all 3 review layers, the highest-confidence finding of this review. If `signOut()` resolves with a non-null `error`, it's silently discarded (no feedback to the user, unlike `sign-in.tsx`'s error-message pattern). If the promise rejects instead of resolving, `setIsSigningOut(false)` never runs and the button is stuck disabled until app restart. If sign-out succeeds and the auth subscription flips `session` to `null` before the trailing `setIsSigningOut(false)` runs, `Stack.Protected` may unmount `SettingsScreen` mid-callback, risking a state-update-after-unmount warning [src/app/settings.tsx] — fixed: try/catch/finally added, error surfaced via `error-message`, `isMounted` ref guards all post-await state updates
- [x] [Review][Patch] No test exercises `signOut()` resolving with an error — follows directly from the above; once error handling exists, cover it [src/app/__tests__/settings.test.tsx] — fixed: two new tests (resolved error, rejected promise), both confirm the button re-enables rather than staying stuck
- [x] [Review][Patch] No test exercises the actual `SIGNED_OUT`/null-session path in `onAuthStateChange` — the existing "updates session when onAuthStateChange fires" test only proves the `SIGNED_IN` direction; AC #3's real trigger (session going to `null`) is asserted in Dev Notes but never demonstrated in a test [src/shared/hooks/__tests__/use-auth.test.tsx] — fixed: new test starts signed-in, fires `SIGNED_OUT` with a `null` session, asserts the probe flips to signed-out
- [x] [Review][Patch] `settings.tsx` and `sign-in.tsx` have near-byte-for-byte duplicate style objects (`container`, `safeArea`, `headline`, secondary-button label, disabled label) — real duplication now (two call sites), not speculative; any future DESIGN.md-driven tweak has to be made twice and will drift [src/app/settings.tsx, src/app/sign-in.tsx] — fixed: extracted `src/shared/components/ignition-button.tsx` (both button variants) and `src/shared/styles/screen.ts` (shared screen-shell styles); both screens now import from these instead of duplicating
- [x] [Review][Patch] No way back to Home from Settings — the only exits are signing out or an undiscoverable OS-level back gesture; "minimal" doesn't require a dead end, and this also mitigates the case where `signOut()` hangs indefinitely (user isn't fully stuck) [src/app/settings.tsx] — fixed: added a "Back to Home" `<Link href="/">`
- [x] [Review][Patch] CI's `npx expo customize tsconfig.json` step has no explanatory comment in either workflow — its real purpose (regenerating `.expo/types/router.d.ts` as a side effect of `startTypeScriptServices()`) is completely non-obvious from the command name; a future maintainer has every reason to think it's stray scaffolding and delete it, silently reintroducing the typecheck failure it exists to prevent [.github/workflows/dev-deploy.yml, .github/workflows/prod-deploy.yml] — fixed: explanatory comment added to both workflows
- [x] [Review][Patch] Global (all-device) sign-out has no UI copy disclosing the blast radius — the scope decision itself is correctly resolved at the architecture level (AD-4, cited in Dev Notes), but tapping "Sign out" on one device silently ends every session everywhere with zero on-screen indication that's what's about to happen [src/app/settings.tsx] — fixed: added a caption under the sign-out button ("Signs you out on every device, not just this one.")
- [x] [Review][Defer] Two parallel theming systems in active use — `index.tsx` still uses `ThemedText`/`ThemedView`/`@/constants/theme` (follows OS light/dark), while `settings.tsx` and `sign-in.tsx` use `@/constants/design-tokens`'s hardcoded dark palette [src/app/index.tsx, src/app/settings.tsx, src/app/sign-in.tsx] — deferred, pre-existing: this tension started in Story 1.2 (design-tokens.ts was deliberately scoped to just the OTP screen's needs, not a full Home migration) and Story 1.3 only continued the same established pattern consistently; a full Home redesign is Epic 2's "Start a Voyage" scope, not this story's.
- [x] [Review][Defer] No automated end-to-end regression test for actual token revocation, only the unit-level `{ scope: 'global' }` parameter assertion [src/shared/hooks/__tests__/use-auth.test.tsx] — deferred, pre-existing: consistent with this project's deliberate convention (Story 1.1's Sentry check, Story 1.2's email delivery check) of live manual verification for infrastructure-touching behavior rather than committing live-credential E2E tests to CI.
- [x] [Review][Defer] Text-based disabled state (`onPress` nulled, no true native `disabled` prop) may not announce correctly to screen readers [src/app/settings.tsx] — deferred, pre-existing: inherited unchanged from `sign-in.tsx`'s secondary-button pattern (Story 1.2); worth fixing project-wide in one dedicated accessibility pass rather than piecemeal per screen.

## Dev Notes

- **AD-4 governs this story's core shape, continuing directly from Story 1.2:** "Session revocation is satisfied natively — sign-out calls `supabase.auth.signOut({ scope: 'global' })`, which revokes refresh tokens on every device; no separate infrastructure needed." [Source: ARCHITECTURE-SPINE.md#AD-4] This story is what actually wires that call — Story 1.2 built the hook's read-side (`session`, `signInWithEmail`, `verifyCode`); this story adds the write-side sign-out action to the same hook, not a new one.
- **`{ scope: 'global' }` is supabase-js's default already** (web-verified at story-creation time) — passing it explicitly isn't functionally required, but keep it explicit anyway: it's the architecturally-mandated behavior (AD-4), not an incidental default that should be left implicit and silently break if a future supabase-js version changes its default.
- **AC #1 is mostly already built, not new work.** Story 1.2's `AuthProvider` (`getSession()` reading Supabase's `AsyncStorage`-persisted session on mount) plus `Stack.Protected guard={!!session}` in `_layout.tsx` already produces exactly this behavior — a returning signed-in user lands on Home, not `/sign-in`, with zero new code required. Task 4 is about *verifying* this holds, not building a persistence mechanism from scratch. Do not add a second, redundant persistence layer (e.g., manually reading `AsyncStorage` again in a new screen) — the existing hook already owns this.
- **AC #3's "return to sign-in after sign-out" is also already provided by existing plumbing.** `Stack.Protected guard={!session}` in `_layout.tsx` reacts to `session` changes from the `onAuthStateChange` subscription Story 1.2 already wired — signing out sets `session` to `null`, the guard flips, routing happens automatically. Do not add a manual `router.replace('/sign-in')` call after `signOut()` succeeds — this would race with (or duplicate) the guard's own reaction and contradicts the single-source-of-truth principle AD-4 establishes.
- **A known doc tension, not something to resolve in code:** EXPERIENCE.md's State Patterns table describes sign-out as `"(v1, single device only)"` with an explicit `[NOTE FOR PM: remote/multi-device sign-out is an open item...]`, while both AD-4 and this story's AC #2 (sourced from epics.md) specify *global* (all-device) sign-out. Epics.md and AD-4 are the authoritative, already-resolved sources for this story — implement global sign-out per AD-4. The EXPERIENCE.md note is stale/unresolved documentation, not a constraint to honor; not this story's job to edit that file, just to not be misled by it.
- **No `profiles`/Trust-Moment/Voyage-membership work here.** Story 1.3's AC mentions "ends that device's active-Voyage membership" in EXPERIENCE.md's fuller description, but no `voyages`/`voyage_members` tables exist yet (Epic 2's scope) — there is no membership to end. Sign-out in this story is purely an auth-session action.
- **Settings screen styling:** DESIGN.md doesn't have a dedicated Settings screen spec (it's not in the 7 v1 key screens list) — use `button-secondary` (transparent background, `ink-primary` foreground, `border-hairline` border, per the `design-tokens.ts` pattern Story 1.2 already established) for the sign-out action, `surface-midnight` background, consistent with the rest of the app's utility-screen treatment (matches how Story 1.2 styled the OTP screen as "plumbing, not a brand moment"). Reuse `src/constants/design-tokens.ts` — do not invent new tokens for this screen; if a needed value isn't there yet, add only that specific value (same restraint Story 1.2 used).
- **Testing standard for this story:** Task 5's global-sign-out verification needs a *real* two-session proof, not just "the code compiles" — same philosophy as Story 1.1's Sentry check and Story 1.2's email delivery check. A unit test mocking `supabase.auth.signOut` only proves the call shape, not that Supabase's server actually revokes every session — that needs the real API round-trip described in Task 5.

### Project Structure Notes

- No new top-level directories. `src/app/settings.tsx` is a new Expo Router route alongside the existing `index.tsx`/`sign-in.tsx`.
- Continues to build directly on `src/shared/hooks/use-auth.tsx` (Story 1.2) — no new hook file.

### References

- [Source: ARCHITECTURE-SPINE.md#AD-4] — global sign-out rule, this story's core shape
- [Source: epics.md#Story-1.3] — acceptance criteria as originally scoped, explicitly cites AD-4's global sign-out
- [Source: EXPERIENCE.md#State-Patterns] — Settings surface description, and the single-device-vs-global tension noted above
- [Source: DESIGN.md#components] — `button-secondary` token spec (reused, not redefined)
- [Source: prd.md#FR-2] — persistent session functional requirement
- [Source: 1-2-email-otp-sign-in.md] — `use-auth.tsx`/`_layout.tsx` current state this story builds directly on top of; the RNTL testing conventions (`@jest/globals` imports, `await act()` around `render`/`fireEvent`) established there apply here too

## Latest Technical Specifics (web-verified at story-creation time)

- **`supabase.auth.signOut({ scope })`**: three scopes — `global` (default; terminates all sessions for the user), `local` (current session only), `others` (all but current; does not fire a `SIGNED_OUT` event for `others`). `global` is what AD-4 requires and is also the library default, so passing it explicitly is a clarity choice, not a functional necessity.
- Source consulted: [Supabase signOut docs](https://supabase.com/docs/reference/javascript/auth-signout), [Supabase Signing Out guide](https://supabase.com/docs/guides/auth/signout).

## Dev Agent Record

### Agent Model Used

Claude Sonnet 5

### Debug Log References

- **`signOut` follows the exact `signInWithEmail`/`verifyCode` centralization pattern** from Story 1.2 — added to the same hook, same test style, no new architecture.
- **`Stack.Screen name="settings"` needed no route guard of its own** — it's nested inside the existing `Stack.Protected guard={!!session}` block alongside `index`, so it inherits the same authenticated-only visibility for free.
- **`sign-in.test.tsx`'s primary-button `Pressable` pattern was deliberately not reused for the Settings sign-out button.** The `secondary`-variant pattern from `sign-in.tsx`'s `IgnitionButton` was used instead (a plain `Text` with a direct `onPress` prop) — this keeps `fireEvent.press` targeting the actual element with the handler directly (`instance.props` match, first check in RNTL's `findEventHandler`), avoiding the composite-ancestor fuzzy-matching gap Story 1.2's code review documented for the primary gradient button. No new false-positive risk introduced. (Post-review: `IgnitionButton` itself was extracted to `src/shared/components/` — see below — but the secondary variant's underlying structure, and therefore this testing property, is unchanged.)
- **New test-infra gap found: Jest couldn't load `index.tsx` at all** — `Unexpected token ':'` from `src/global.css` (imported transitively via `src/constants/theme.ts` → `themed-text.tsx` → `index.tsx`). Jest's transformer has no CSS loader by default; jest-expo's preset doesn't provide one either. Fixed by adding a `moduleNameMapper` entry in `package.json`'s jest config pointing `\.css$` at a trivial local mock (`src/shared/test-mocks/style-mock.js`, exports `{}`) — no new npm dependency needed (deliberately avoided `identity-obj-proxy` or similar). This was blocking, not optional: any future test touching `index.tsx` or the `ThemedText`/`ThemedView` components would hit the same wall.
- **Second new gap: `tsc --noEmit` failed on `<Link href="/settings">`** — `Type '"/settings"' is not assignable to type ...` from Expo Router's `typedRoutes` experiment (enabled in `app.json`). The generated declaration file (`.expo/types/router.d.ts`) is gitignored and only existed with stale content from earlier stories; this is the first time this project has used a typed `href` string, so it's the first time the gap surfaced. Confirmed empirically that `expo start`'s dev server only regenerates it on a *file-change* event via its watcher, not a fresh full scan on cold start, and that `npx expo export` (both `--platform web`, which additionally crashed with `window is not defined` — an SSR/AsyncStorage issue unrelated to this story and not investigated further since web export isn't in this project's scope — and `--platform android`, which completed cleanly) does **not** generate route types at all. The actual documented, CI-appropriate command (found via web search, not guessed) is **`npx expo customize tsconfig.json`** — added to both CI workflows' `Typecheck` step, right after the existing `expo-env.d.ts` generation line. Verified locally: deleted the stale file, ran the command, `tsc --noEmit` passed clean.
- **Global sign-out verified with a real two-session proof**, not a mock: requested two separate OTP codes for the same account (user provided both from their inbox), verified each independently to get two distinct sessions (A and B) with their own access/refresh token pairs, confirmed session B's refresh token worked *before* the test (baseline: `POST /auth/v1/token?grant_type=refresh_token` → 200, new rotated refresh token noted), called `POST /auth/v1/logout?scope=global` using session A's access token (204), then attempted to refresh session B's (rotated) refresh token again — got `400 refresh_token_not_found`. This directly proves `{ scope: 'global' }` revokes every session for the account, not just the one that called `signOut`. Temp files holding real tokens deleted immediately after the test.
- **AC #1 (relaunch persistence)** was not device-tested — no build was available (Story 1.2's final CI run exhausted the EAS Android free-tier monthly build quota, resetting Aug 1). Documented per the story's own accepted fallback: the behavior follows directly from already-passing unit coverage (`use-auth.test.tsx`'s "resolves to signed-in when getSession returns an existing session" test, from Story 1.2) rather than an unverified device claim.

### Completion Notes List

- Task 1 complete: `signOut()` added to `src/shared/hooks/use-auth.tsx`, delegating to `supabase.auth.signOut({ scope: 'global' })` per AD-4. Test added following the established pattern. 8/8 hook tests passing.
- Task 2 complete: `src/app/settings.tsx` — minimal sign-out screen, wired into `_layout.tsx`'s existing authenticated `Stack.Protected` block. No manual post-sign-out navigation (the existing guard handles it). 2/2 tests passing (sign-out call, disabled-while-submitting state).
- Task 3 complete: minimal `Settings` link added to the Home placeholder (`src/app/index.tsx`) via Expo Router's `<Link>`. 1/1 test passing.
- Two real test-infrastructure gaps found and fixed along the way (CSS import handling, typed-routes generation for CI) — both documented in Debug Log, both apply to every future story's tests/CI, not just this one.
- Task 4 complete: AC #1 confirmed via existing Story 1.2 unit coverage; no device test possible this story (EAS build quota exhausted) — documented honestly rather than claimed.
- Task 5 complete: global sign-out proven with a real two-session token-revocation test against the live `voylo-dev` project, not a mock.
- **Story 1.3 is functionally complete.** All 3 ACs satisfied, all 5 tasks done, 17/17 tests passing, `tsc --noEmit` clean.

**Code review (2026-07-26):** 3 parallel adversarial layers against the full commit range, converging heavily — the missing error-handling/try-catch/unmount-guard finding in `settings.tsx`'s sign-out handler was independently raised 4 times across the 3 reports, the highest-confidence finding of any review this project has run so far. 0 `decision-needed`, 7 `patch` (all applied), 3 `defer` (logged to `deferred-work.md`), 3 dismissed as noise (including one empirically disproven via real CI/local runs already on record). Patches: full error handling + unmount guard in the sign-out flow (2 new tests), a `SIGNED_OUT`/null-session test for the hook, extracted `IgnitionButton` and shared screen styles out of `sign-in.tsx`/`settings.tsx` duplication, a "Back to Home" link, a global-sign-out disclosure caption, and an explanatory comment on the CI typed-routes fix. Re-verified: `tsc --noEmit` clean, 20/20 tests passing (up from 17).

### File List

- `src/shared/hooks/use-auth.tsx` — `signOut()` added (modified)
- `src/shared/hooks/__tests__/use-auth.test.tsx` — `signOut` test added (modified)
- `src/app/settings.tsx` (new)
- `src/app/__tests__/settings.test.tsx` (new)
- `src/app/_layout.tsx` — `<Stack.Screen name="settings" />` added to the authenticated `Stack.Protected` block (modified)
- `src/app/index.tsx` — `Settings` link added (modified)
- `src/app/__tests__/index.test.tsx` (new)
- `src/shared/test-mocks/style-mock.js` (new) — Jest CSS-import mock
- `package.json` — `moduleNameMapper` added to the jest config block (modified)
- `.github/workflows/dev-deploy.yml`, `.github/workflows/prod-deploy.yml` — `npx expo customize tsconfig.json` added to the Typecheck step, plus code-review patch: explanatory comment (modified)
- `src/shared/components/ignition-button.tsx` (new, code review patch) — `IgnitionButton` extracted out of `sign-in.tsx`, both variants
- `src/shared/styles/screen.ts` (new, code review patch) — shared screen-shell styles extracted out of `sign-in.tsx`/`settings.tsx` duplication
- `src/app/sign-in.tsx` — refactored to import `IgnitionButton`/`screenStyles` instead of defining them locally; "Wrong email? Go back" now uses the shared component (code review patch, modified)
- `src/app/settings.tsx` — full rewrite (code review patch): try/catch/finally + `isMounted` guard around `handleSignOut`, error surfaced via `error-message`, global-sign-out disclosure caption, "Back to Home" link, now built from `IgnitionButton`/`screenStyles` (modified)
- `src/app/__tests__/settings.test.tsx` — 2 new tests for the error/rejection paths (code review patch, modified)
- `src/shared/hooks/__tests__/use-auth.test.tsx` — new `SIGNED_OUT`/null-session test (code review patch, modified)

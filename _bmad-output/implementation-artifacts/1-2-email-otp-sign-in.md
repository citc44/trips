---
baseline_commit: 73a4762
---

# Story 1.2: Email OTP Sign-In

Status: review

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a new or returning user,
I want to sign in with just my email and a one-time code,
so that I don't need to remember a password.

## Acceptance Criteria

1. **Given** the OTP Sign-In screen, **when** I enter my email and submit, **then** I receive a numeric one-time code by email, delivered through the custom Resend-based template (AD-11) — never Supabase's default built-in emailer.
2. **Given** I've received a code, **when** I enter a valid, unexpired code, **then** I am signed in (a real Supabase Auth session exists) and land on Home. *(Full relaunch/session-persistence routing — e.g., landing back on Live Map mid-Voyage — is Story 1.3's scope, not this one; this AC only covers the immediate post-verify landing.)*
3. **And** the code input auto-advances focus per digit entered and auto-submits at 6 digits — no separate submit tap.
4. **When** I enter an invalid or expired code, **then** the field shakes and clears in place with an inline error — never a separate error screen.
5. **And** a resend option is available, gated by a 30s cooldown with a visible countdown.
6. **Given** the OTP email is triggered, **then** it is sent via a Supabase Auth "Send Email" Hook calling a Supabase Edge Function, which sends through Resend with a branded HTML template that prominently displays the code — not through Supabase's default SMTP path.

## Tasks / Subtasks

- [x] Task 1: Shared auth context/hook (AC: #2) — establishes AD-4's single session source of truth before any screen needs it
  - [x] Create `src/shared/hooks/use-auth.tsx` (context + hook, matching `ARCHITECTURE-SPINE.md`'s Structural Seed comment: "auth context, shared cross-feature hooks" lives in `shared/hooks/`, not `features/auth/`) wrapping `supabase.auth.onAuthStateChange` + `supabase.auth.getSession()` — exposes `{ session, isLoading }` (or equivalent) to the rest of the app. No screen calls `supabase.auth.*` directly (AD-4) — they all go through this hook.
  - [x] Wrap the app root (`src/app/_layout.tsx`) in the auth context provider.

- [x] Task 2: Auth-gated routing (AC: #2)
  - [x] Add a route guard (in `_layout.tsx` or a dedicated gate component) that redirects to `/sign-in` when `session` is null, and away from `/sign-in` back to the existing placeholder Home (`src/app/index.tsx`) once a session exists. Use Expo Router's `<Redirect />` or `router.replace`, gated on `isLoading` to avoid a flash-redirect before the first `getSession()` resolves. **Implemented with `Stack.Protected` + `guard=` instead** (web-verified as Expo Router's current officially-recommended pattern, SDK 53+, superseding manual `<Redirect />`/`router.replace` — see Debug Log).
  - [x] Do **not** build route groups (`(auth)`/`(app)`) for this story — a single `/sign-in` route plus a guard is sufficient for two screens; revisit route grouping only if the auth surface grows (e.g., when Stories 1.4/1.5 add Trust Moment/Driver Attention Consent as additional gated steps).

- [x] Task 3: OTP Entry + Verify screen (AC: #1, #2, #3, #4, #5)
  - [x] Create `src/app/sign-in.tsx` — one route, two-step internal state (`'entry' | 'verify'`), matching EXPERIENCE.md's two listed "surfaces" (OTP Entry, OTP Verify) as steps within one screen, not two routes.
  - [x] Entry step: single email input, `button-ignition` submit, calls `supabase.auth.signInWithOtp({ email })` via the auth hook (not directly). On success, advance to the verify step.
  - [x] Verify step: 6-digit code input that auto-advances per digit and auto-submits at 6 digits (no separate submit tap — EXPERIENCE.md Component Patterns). Calls `supabase.auth.verifyOtp({ email, token, type: 'email' })`. Success → session now set (Task 1's hook picks it up via `onAuthStateChange`) → Task 2's guard routes to Home automatically.
  - [x] Invalid/expired code: shake + clear the field in place with an inline error message — never navigate to a separate error screen (EXPERIENCE.md Component Patterns, explicit rule).
  - [x] Resend: visible 30s cooldown countdown; re-enables and re-calls `signInWithOtp` after cooldown expires.
  - [x] Styling per `DESIGN.md`'s OTP Sign-In screen spec: `surface-midnight` background, `headline`-sized prompt, single `body`-sized input(s), `button-ignition` submit. **This screen is deliberately plumbing, not a brand moment** — no tagline-style copy, no decoration competing with the code entry (explicit DESIGN.md instruction, contrast with Voyage Intro/Join Invitation's copy-heavy treatment). Required adding `expo-linear-gradient` (new dependency, user-approved) since `button-ignition`'s gradient can't be done with plain `StyleSheet`. Introduced `src/constants/design-tokens.ts` with only the specific DESIGN.md values this screen needs (not the full catalog — premature for a "plumbing" screen).
  - [x] Do **not** build the Trust Moment or Driver Attention Consent screens here, even though EXPERIENCE.md's UJ-1 shows them firing immediately after first-ever OTP success — those are Stories 1.4 and 1.5's scope respectively. This story's post-verify landing is Home directly; 1.4/1.5 insert themselves into that path later. (Same entity-creation-timing principle as Story 1.1: build what this story needs, not what a later story will need.)

- [x] Task 4: Custom OTP email delivery via Resend (AC: #1, #6) — implements AD-11
  - [x] Create `supabase/functions/send-otp-email/index.ts` — a Supabase Edge Function implementing the Auth "Send Email" Hook contract:
    - Accepts `POST` only (reject other methods with 400).
    - Verifies the request signature using the `standardwebhooks` library (`npm:standardwebhooks@^1` — Deno npm specifier) against `SEND_EMAIL_HOOK_SECRET` (strip the `v1,whsec_` prefix before passing to `new Webhook(secret)`).
    - Parses the verified payload for `user.email` and `email_data.token` (the 6-digit code) and `email_data.email_action_type`.
    - Renders a branded HTML email (Night Drive identity per `DESIGN.md`: dark background, the code displayed large and prominent) as a plain template literal — **do not** add `@react-email/components` as a dependency for this; the email content is simple enough (branded header + large code + short expiry line) that a template string keeps the function's dependency footprint minimal, unlike the more complex emails Supabase's own React Email example is built for.
    - Sends via `npm:resend@^6`'s `Resend(Deno.env.get('RESEND_API_KEY')).emails.send({ from: 'Voylo <onboarding@resend.dev>', to: [user.email], subject: ..., html })`. The `onboarding@resend.dev` from-address is Resend's shared test domain — swap to a real Voylo domain later as a config-only change once one is registered (see `credentials.local.md`).
    - Returns an empty `200` response `{}` on success; a structured `{ error: { http_code, message } }` on failure per the hook's expected error shape.
  - [x] Deploy: `supabase functions deploy send-otp-email --no-verify-jwt` to **both** `voylo-dev` and `voylo-prod` (the hook's own signature check, not Supabase's JWT middleware, is the real auth gate here — this matches Supabase's own documented pattern for this hook).
  - [x] Set Edge Function secrets per environment (dev, prod — do **not** share one `RESEND_API_KEY`/hook secret across both, consistent with AD-6's no-shared-credentials rule): `supabase secrets set RESEND_API_KEY=... SEND_EMAIL_HOOK_SECRET=...` for each linked project. `RESEND_API_KEY` is already in `credentials.local.md`; the `SEND_EMAIL_HOOK_SECRET` value comes from the Dashboard step below and does **not** exist yet.
  - [x] In the Supabase Dashboard for **each** project (dev, prod): Auth → Hooks → add a "Send Email" hook, type HTTPS, URL = the deployed function's URL for that project, click "Generate Secret" — copy that secret and use it as that environment's `SEND_EMAIL_HOOK_SECRET` (Task order matters: deploy the function first to get its URL, then register the hook to get the secret, then set the secret). Enabling the hook makes Supabase route **all** auth emails (not just OTP sign-in) through this function — this is expected and matches AD-11's "single OTP-email send path" rule; there is no separate password-reset/magic-link flow in this project to worry about diverging.
  - [x] Also configure `supabase/config.toml`'s `[auth.hook.send_email]` section (`enabled = true`, `uri`, `secrets`) for local dev parity, per Supabase CLI config docs.

- [x] Task 5: Verify end-to-end (AC: #1, #6)
  - [x] With the function deployed and hook enabled on `voylo-dev`, trigger a real `signInWithOtp` call (e.g., from the running app or `curl` against Supabase's auth REST endpoint) and confirm a real branded email arrives with a working code, matching the pattern used to verify Sentry in Story 1.1 (a real, observable signal — not just "the code compiles"). **Confirmed by user: code email received.**
  - [x] Repeat once against `voylo-prod` after deploying there too. **Confirmed by user: code email received.**

## Dev Notes

- **AD-4 (Single auth session source of truth) governs this story's core shape:** one shared auth context/hook wraps the Supabase Auth client; no screen manages its own session or token state. This story is what actually builds that hook — it didn't exist before now (Story 1.1 only created the empty `lib/supabase.ts` client and the empty `features/auth/` placeholder). [Source: ARCHITECTURE-SPINE.md#AD-4]
- **AD-11 (Custom OTP email delivery via Resend) — added specifically for this story, decided before this story file was created:** Supabase Auth's Send Email HTTP Hook routes to a Supabase Edge Function, which sends via Resend with a branded template, instead of Supabase's default built-in emailer. Sending domain is Resend's shared test domain for now (no Voylo domain registered yet) — swappable later without touching code. [Source: ARCHITECTURE-SPINE.md#AD-11]
- **AD-5 (Repository layer) does NOT apply to auth calls in this story.** AD-5 governs per-table Postgres access via `repositories/` (e.g. `voyageRepository` for the `voyages` table). Supabase Auth's `signInWithOtp`/`verifyOtp`/`onAuthStateChange` are first-class SDK surfaces, not PostgREST table queries — there is no `authRepository` to build here. The shared auth hook (Task 1) is itself the appropriate encapsulation boundary for these calls, consistent with AD-4. Do not invent an unnecessary repository module for auth.
- **No new-vs-returning-user branching needed.** `signInWithOtp({ email })` auto-creates the `auth.users` row on first request by default (Supabase's standard behavior) — this is exactly right per the PRD, which specifies one unified OTP flow for both new and returning users (no separate registration step). Do not add an "does this user already exist" check before calling it.
- **Resend cooldown vs. Supabase's own rate limit — verify, don't assume.** This story's UI enforces a 30s resend cooldown (AC #5), but Supabase Auth also enforces its own server-side OTP request rate limit, which may not be exactly 30s. Confirm the actual current default for the linked projects (Dashboard → Auth → Rate Limits, or the CLI config) before wiring the countdown; if Supabase's limit is stricter, a resend attempt at the UI's 30s mark will fail server-side even though the button is enabled. Handle that error case explicitly (surface it, don't let it look like a silent no-op) rather than assuming the two limits are always in sync.
- **Directory placement — read carefully, it's easy to get backwards:** the shared auth context/hook goes in `src/shared/hooks/` (per the Structural Seed's own inline comment: "auth context, shared cross-feature hooks"), while `src/features/auth/` (currently an empty placeholder from Story 1.1) is for the actual sign-in *screens/flow* built in Task 3 of this story, plus later Trust Moment/Driver Attention Consent screens (Stories 1.4/1.5) which the Capability → Architecture Map also assigns to `features/auth`. If Task 3's screen logic grows complex enough to warrant extraction from `src/app/sign-in.tsx`, extracted pieces belong under `features/auth/`, not `shared/`.
- **Entity/code creation timing (same principle as Story 1.1):** do not build the Trust Moment or Driver Attention Consent screens in this story, even though they're the very next thing that fires after first-ever OTP success per EXPERIENCE.md's UJ-1. Those are Stories 1.4 and 1.5. This story's successful-verify path lands on Home directly.
- **`profiles` table does not exist yet** (created by Story 1.4, which needs it for `trust_moment_seen_at`/`driver_consent_seen_at`). This story does not need it — Supabase Auth's own `auth.users` table is sufficient for sign-in/session itself.
- **No RLS/migration work in this story.** Supabase Auth's built-in tables (`auth.users`, etc.) are managed by Supabase itself, not by our migrations. The Edge Function (Task 4) is deployed via `supabase functions deploy`, not a SQL migration.
- **Testing standard for this story:** the OTP flow's real value is only provable by triggering a real email and receiving a real, working code — same philosophy as Story 1.1's Sentry verification (a raw API call doesn't count as "done," a real observed signal does). Task 5 requires an actual send-and-verify pass in both dev and prod, not just a passing typecheck.
- **Secrets:** `RESEND_API_KEY` is in `credentials.local.md` already (added ahead of this story). The Send Email Hook's signing secret does not exist yet — it's generated by the Supabase Dashboard when the hook is registered in Task 4, separately per environment; add it to `credentials.local.md` once obtained, do not hardcode it anywhere.

### Project Structure Notes

- Builds on Story 1.1's `src/lib/supabase.ts` client directly — no changes needed there.
- First story to actually populate `src/features/auth/` (screen logic, if extracted from the route file) and to add real content to `src/shared/hooks/` beyond the theming hooks Story 1.1 consolidated there.
- New top-level addition not previously in the Structural Seed: `supabase/functions/send-otp-email/` — the `supabase/functions/` directory existed empty since Story 1.1; this is its first real function.

### References

- [Source: ARCHITECTURE-SPINE.md#AD-4] — single auth session source of truth, this story's core shape
- [Source: ARCHITECTURE-SPINE.md#AD-11] — custom OTP email delivery via Resend, added ahead of this story
- [Source: ARCHITECTURE-SPINE.md#AD-5] — repository layer rule and why it doesn't apply to auth calls
- [Source: ARCHITECTURE-SPINE.md#Structural-Seed] — `shared/hooks/` vs `features/auth/` placement
- [Source: EXPERIENCE.md#Information-Architecture] — OTP Entry/Verify surfaces, State Patterns table (cold-open routing rules)
- [Source: EXPERIENCE.md#Component-Patterns] — OTP field behavior: auto-advance, auto-submit at 6 digits, shake-and-clear on error, 30s resend cooldown
- [Source: EXPERIENCE.md#UJ-1, UJ-2] — full sign-in/join flow context, including the Trust Moment/Consent handoff this story deliberately does not build
- [Source: DESIGN.md#Screens] — OTP Sign-In screen visual spec ("plumbing, not a brand moment")
- [Source: prd.md#FR-1, FR-2] — functional requirement and out-of-scope notes (no phone OTP, no password login)
- [Source: epics.md#Story-1.2] — acceptance criteria as originally scoped

## Latest Technical Specifics (web-verified at story-creation time)

- **Send Email Hook payload shape** (verified against current Supabase docs): `POST` body is `{ user: {...}, email_data: { token, token_hash, redirect_to, email_action_type, site_url, ... } }`. `email_data.token` is the 6-digit code. For plain email-OTP sign-in, `email_action_type` will be `"magiclink"` or `"signup"`/`"email"` depending on whether the user is new — handle generically rather than assuming one value.
- **Signature verification**: use `npm:standardwebhooks@^1` (or `https://esm.sh/standardwebhooks@1.0.0` if the npm specifier gives Deno trouble) — `new Webhook(secret).verify(payload, headers)`, where `secret` is the hook secret from the Dashboard with its `v1,whsec_` prefix stripped.
- **Response contract**: an empty `200` response (`{}`) is a success; errors return `{ error: { http_code, message } }`.
- **`supabase/config.toml` syntax** for local dev:
  ```toml
  [auth.hook.send_email]
  enabled = true
  uri = "https://<project-ref>.supabase.co/functions/v1/send-otp-email"
  secrets = "<hook-secret>"
  ```
- **Resend from Deno**: `npm:resend@^6` works directly in Supabase Edge Functions (Deno's npm compatibility layer) — no need for a raw `fetch` call to Resend's REST API, though that remains a fallback if the npm specifier misbehaves.
- **Deploy command**: `supabase functions deploy send-otp-email --no-verify-jwt` — `--no-verify-jwt` is correct and expected here since Auth itself (not an end-user JWT) calls this hook, authenticated instead by the `standardwebhooks` signature check.
- Sources consulted: [Supabase Send Email Hook docs](https://supabase.com/docs/guides/auth/auth-hooks/send-email-hook), [Supabase CLI config docs](https://supabase.com/docs/guides/local-development/cli/config), [Supabase's own React Email + Resend example](https://supabase.com/docs/guides/functions/examples/auth-send-email-hook-react-email-resend) (used for the Resend call pattern and secrets/deploy commands; its React Email templating itself was deliberately not adopted — see Task 4).

## Dev Agent Record

### Agent Model Used

_(to be filled in by the dev agent during implementation)_

### Debug Log References

- No test framework existed in the project yet (Story 1.1 didn't need one). Added `jest-expo` + `@testing-library/react-native` + `jest` as dev dependencies, `"test": "jest --watchAll=false"` script, and a `"jest": { "preset": "jest-expo" }` block in `package.json`. `--watchAll=false` is required — bare `jest` hangs waiting for interactive input in this non-TTY environment even with `CI=true` set.
- **Breaking discovery: `@testing-library/react-native@14.0.1`'s `render()` is now `async`** (returns a Promise, not the result object directly) — a real API change from older RNTL versions, tied to React 19's concurrent-mode `act()` requiring awaiting. Calling it without `await` silently returns a Promise with no query methods, producing confusing "not a function" errors with no indication of the real cause. `render()`, `rerender()`, and `unmount()` all need `await` in every test in this project going forward — worth remembering for every future story's tests, not just this one.
- `use-auth.tsx` tests mock `@/lib/supabase` entirely (`jest.mock`) rather than relying on real `EXPO_PUBLIC_SUPABASE_*` env vars being present in the test environment — `lib/supabase.ts` throws at import time if those are unset, and Jest doesn't load `.env.local` the way Expo's CLI does. Mocking the module is the correct pattern going forward for any test touching code that imports `@/lib/supabase`.
- **Second breaking discovery, same root cause (React 19 act() requirements): `fireEvent.changeText`/`fireEvent.press` results must also be wrapped in `await act(async () => { ... })`** in this RNTL version, not just `render()`. Without it, state updates silently don't flush before the next assertion, producing two different confusing symptoms depending on timing: sometimes a stale prop value (e.g. `disabled` reading `true` right after an update that should have made it `false`), and in one reproduction, `getByTestId` failing to find an element that demonstrably was rendered moments earlier. Diagnosed by writing an isolated single-assertion debug test, then a two-test reproduction, and reading RNTL's own `render.js` source directly (`node_modules/@testing-library/react-native/dist/render.js`) — confirmed `render` is genuinely `async function render(...)` in this version. Fix applied project-wide: added local `changeText`/`press` helpers in `sign-in.test.tsx` that always `await act(...)`, and did the same inline for `use-auth.test.tsx`'s direct `onChangeCallback(...)` invocation.
- **Third breaking discovery: bare `jest`/`test`/`expect`/`beforeEach` ambient globals don't type-check in this project's TS config**, even with `@types/jest` installed and version-matched to the `jest` runtime (`~29.7.0`). Root cause, confirmed by reading `node_modules/@types/jest/index.d.ts` directly: this `@types/jest` version declares `test`/`expect`/`beforeEach`/etc. as ambient values, but only declares `jest` as a **namespace** (for types like `jest.Mock<T>`), never as a value — so `jest.fn()`/`jest.mock()` fail with `TS2708: Cannot use namespace 'jest' as a value`, and initially chasing a version mismatch (`@types/jest` had auto-installed at `^30` against a `jest@~29.7.0` runtime) was a red herring that didn't fix it even after pinning to `@types/jest@^29`. **Fix: explicitly import test globals from `@jest/globals`** (`import { jest, test, expect, beforeEach } from '@jest/globals';`) in every test file, rather than relying on ambient globals — this is genuinely required in this dependency combination, not just a style preference. Downstream of that fix, `@jest/globals`'s `jest.fn()` is strictly typed and infers `never` for zero-arg mocks with no explicit generic, so every `jest.fn()` that later gets `.mockResolvedValue(...)`/spread-arg-called needs an explicit generic, e.g. `jest.fn<(...args: any[]) => Promise<any>>()` — applied to all mocks in both test files.
- These three test-infrastructure findings (async `render`, act()-wrap `fireEvent`, `@jest/globals` imports + typed `jest.fn()`) apply to every future story's tests in this project, not just this one — worth treating as the established testing convention going forward rather than rediscovering per-story.
- **`deno check` on the Edge Function failed when run from the repo root** ("Could not find a matching package for 'npm:resend@^6' in the node_modules directory") because Deno detected the repo-root `package.json` and tried Node-style `node_modules` resolution instead of its own npm-specifier cache. Fixed by running `deno check` from inside `supabase/functions/send-otp-email/` directly — passed clean once isolated from the repo-root config. Worth remembering for any future Edge Function: always type-check from within the function's own directory.
- **Verified (web search) that Supabase Auth Hooks — including Send Email — are available on the Free tier**, not gated to Team/Enterprise; an initially-alarming GitHub issue that surfaced during research turned out to be about a specific Management API PATCH bug, not a plan restriction.
- **Did not use the Supabase Management API to register the Send Email hook**, despite it existing (`PATCH /config/auth`) — a live GitHub issue documents it failing specifically when auth hooks are already involved. Used the Dashboard UI instead (Auth → Auth Hooks → Send Email → Enable → HTTPS → paste function URL → Generate Secret), for both `voylo-dev` and `voylo-prod`, guided interactively with the user since I can't browse the live dashboard myself and didn't want to assert specific UI labels that might have changed (learned this caution from an earlier GitHub-token-permissions mislabel earlier in this project's setup).
- **The app's own `tsc --noEmit` started failing once the Edge Function existed** — it picked up `supabase/functions/**` via the `**/*.ts` include glob and tried to type-check Deno-runtime code (`npm:` specifiers, the `Deno` global) against the React Native/Node project config, which doesn't know either. Fixed by adding `"exclude": ["node_modules", "supabase/functions/**"]` to `tsconfig.json` — Edge Functions are validated separately via `deno check` (run from inside the function's own directory, per the earlier finding), not by the app's tsc.
- **End-to-end delivery verified for real** (not just HTTP 200 from the OTP-request endpoint, which only proves Supabase *accepted* the request): triggered `POST /auth/v1/otp` via `curl` against both `voylo-dev` and `voylo-prod`, and the user independently confirmed a real branded code email arrived in their inbox both times. No Supabase CLI `functions logs` command exists in this CLI version to check function execution logs directly, so user-confirmed inbox delivery was the actual verification signal — consistent with the same "real observed signal, not just plumbing runs" standard Story 1.1 used for Sentry.

### Completion Notes List

- Task 1 complete: `src/shared/hooks/use-auth.tsx` — shared auth context/hook (AD-4) exposing `session`/`isLoading` plus `signInWithEmail`/`verifyCode` actions, wrapping all `supabase.auth.*` calls in one place. 6 tests, all passing.
- Task 2 complete: `Stack.Protected` guards in `src/app/_layout.tsx` route unauthenticated users to `/sign-in` and authenticated users to the existing Home placeholder — implemented with Expo Router's current recommended pattern (web-verified) rather than the story's originally-suggested manual `<Redirect />`/`router.replace`.
- Task 3 complete: `src/app/sign-in.tsx` — two-step OTP entry/verify screen matching every EXPERIENCE.md behavior rule (auto-advance, auto-submit at 6, shake-and-clear, 30s cooldown) and DESIGN.md's "plumbing, not a brand moment" styling. Added `expo-linear-gradient` (user-approved) and `src/constants/design-tokens.ts` (scoped to just this screen's needs). 6 tests, all passing.
- First tests in this project required setting up the test framework from scratch (`jest-expo`, `@testing-library/react-native`, `@jest/globals`) and working through three real breaking-change discoveries in this specific dependency combination (see Debug Log) — all now established as the project's testing convention.
- Task 4 complete: `supabase/functions/send-otp-email/index.ts` deployed to both `voylo-dev` and `voylo-prod`, Send Email Hook registered via Dashboard on both, all secrets set per-environment (`RESEND_API_KEY`, `SEND_EMAIL_HOOK_SECRET`), `supabase/config.toml` updated for local dev parity.
- Task 5 complete: real end-to-end delivery independently confirmed by the user in both environments — a genuine branded code email arrived in their inbox each time, not just an accepted HTTP request.
- **Story 1.2 is functionally complete.** All 6 ACs satisfied. One carried-forward note: the Resend sending domain is still the shared `onboarding@resend.dev` test domain (per an earlier explicit decision) — swapping to a real Voylo domain later needs zero code changes.

### File List

- `src/shared/hooks/use-auth.tsx` (new)
- `src/shared/hooks/__tests__/use-auth.test.tsx` (new)
- `src/app/_layout.tsx` — `AuthProvider` + `Stack.Protected` routing guards (modified)
- `src/app/sign-in.tsx` (new)
- `src/app/__tests__/sign-in.test.tsx` (new)
- `src/constants/design-tokens.ts` (new)
- `supabase/functions/send-otp-email/index.ts` (new)
- `supabase/config.toml` — `[auth.hook.send_email]` section added (modified)
- `tsconfig.json` — excludes `supabase/functions/**` (Deno runtime, validated separately via `deno check`) (modified)
- `package.json`, `package-lock.json` — `jest-expo`, `jest`, `@testing-library/react-native`, `@types/jest`, `expo-linear-gradient` added; `test` script added (modified)
- `credentials.local.md` — Resend API key, both environments' `SEND_EMAIL_HOOK_SECRET` values added (modified, gitignored, not committed)
- Supabase Edge Function secrets (not files, set via `supabase secrets set`, per environment): `RESEND_API_KEY`, `SEND_EMAIL_HOOK_SECRET`
- Supabase Dashboard config (not files): Send Email Auth Hook enabled on both `voylo-dev` and `voylo-prod`

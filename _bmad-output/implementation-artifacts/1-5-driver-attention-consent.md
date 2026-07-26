---
baseline_commit: e815f47
---

# Story 1.5: Driver Attention Consent

Status: review

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a first-time user,
I want to explicitly acknowledge that I'm responsible for driving attentively,
so that Voylo's driver-safety approach is grounded in real consent, not a silent assumption.

## Acceptance Criteria

1. **Given** the Trust Moment was just dismissed (same onboarding pass), **when** it closes, **then** the Driver Attention Consent screen fires with the locked liability copy — headline "If you're behind the wheel, stay focused on the road — Voylo can't do that for you." and liability line "Voylo isn't responsible for distracted driving."
2. **When** the user taps the single "Got it" acknowledgment, **then** `profiles.driver_consent_seen_at` is set (server timestamp, same rationale as Story 1.4's AC2 — see Dev Notes) for that user's account, and the app proceeds to Home.
3. **Given** `profiles.driver_consent_seen_at` is already set for the account, **when** the user signs in again on any later session, **then** the Driver Attention Consent screen never fires again — the app proceeds straight past it (to Home, once Trust Moment is also already seen).
4. **Given** a user has already seen the Trust Moment but has *not* yet seen Driver Attention Consent (an account mid-onboarding, e.g. app was killed between the two screens), **when** they relaunch, **then** they land on Driver Attention Consent, not back on Trust Moment or Home — the guard evaluates both flags independently, in order.

*(Fulfills UX-DR24. Full liability copy source: EXPERIENCE.md's "Driver-Safety Interaction Model" section — this is the "Voylo does not detect who's driving" consent tradeoff made explicit, an affirmative once-ever tap, not boilerplate.)*

## Tasks / Subtasks

- [x] Task 1: `mark_driver_consent_seen()` RPC (AC: #2) — mirrors Story 1.4's `mark_trust_moment_seen()` function exactly
  - [x] New migration `supabase/migrations/<timestamp>_mark_driver_consent_seen_function.sql`:
    ```sql
    create or replace function public.mark_driver_consent_seen()
    returns public.profiles
    language sql
    security invoker
    set search_path = public
    as $$
      insert into public.profiles (user_id, driver_consent_seen_at)
      values (auth.uid(), now())
      on conflict (user_id) do update
        set driver_consent_seen_at = coalesce(public.profiles.driver_consent_seen_at, excluded.driver_consent_seen_at)
      returning *;
    $$;

    grant execute on function public.mark_driver_consent_seen() to authenticated;
    ```
  - [x] **This is server-stamped from the start, even though this story's AC text (unlike Story 1.4's AC2) doesn't literally say "(server timestamp)".** Story 1.4's code review established, for the whole `profiles` table's one-time-onboarding-flag columns, that a client-supplied `new Date().toISOString()` is a real spec/security gap (a skewed or spoofed device clock could persist an arbitrary value) — applying the same fix proactively here, to the sibling column on the same row, rather than waiting for review to flag the inconsistency a second time. Flagged plainly as a proactive-consistency choice, not a literal AC requirement, in case a reviewer wants to weigh in.
  - [x] Apply locally via `supabase db push` against `voylo-dev` before relying on CI.
  - [x] No new RLS policies needed — `profiles`' existing `profiles_select_own`/`profiles_insert_own`/`profiles_update_own` (Story 1.4's migration) already cover this column; `security invoker` means the RPC still goes through them.

- [x] Task 2: `profileRepository.markDriverConsentSeen()` (AC: #2)
  - [x] Add `markDriverConsentSeen(): Promise<ProfileResult>` to `src/repositories/profile-repository.ts`, calling `supabase.rpc('mark_driver_consent_seen')` — same shape as `markTrustMomentSeen`, same `toProfile`/`toRepositoryError` mapping, no new types needed.
  - [x] Export it from `profileRepository = { getProfile, markTrustMomentSeen, markDriverConsentSeen }`.
  - [x] Unit tests mirroring `markTrustMomentSeen`'s existing three tests exactly (calls the RPC with the right name, returns the mapped profile, returns a typed error on failure).

- [x] Task 3: `useProfile`'s `markDriverConsentSeen` action (AC: #2, #3) — **extract the shared staleness-guard logic instead of copy-pasting a second near-identical function**
  - [x] `markTrustMomentSeen`'s current body (in `src/shared/hooks/use-profile.tsx`) has three parts: (a) bail out if there's no session, (b) call its repository function, (c) apply the result only if `latestUserIdRef.current` still matches the request (the staleness guard this story's own predecessor's code review added after a first, buggy attempt read a stale closure instead). Part (a) and (c) are identical for any "mark a one-time onboarding flag" action. Extract a private helper (e.g. `applyMarkResult(requestedUserId, result)` or `runMarkAction(repositoryCall)`) that both `markTrustMomentSeen` and the new `markDriverConsentSeen` call, so the staleness guard exists in exactly one place. Copy-pasting it a second time risks silently dropping the guard on one of the two copies — a real, already-demonstrated risk this story should not repeat, not a hypothetical one.
  - [x] Add `markDriverConsentSeen: () => Promise<{ error: RepositoryError | null }>` to `ProfileContextValue` and the provider's return value.
  - [x] Unit tests mirroring `markTrustMomentSeen`'s existing coverage (updates local state on success, returns an error without updating state on failure, discards a stale response if the session changed mid-request — reuse the exact test structure/technique from `use-profile.test.tsx`'s existing `markTrustMomentSeen` tests).
  - [x] No changes needed to the `getProfile` effect, `isLoading` derivation, or `hasError` fail-open logic — those already cover the whole `profile` object (both flags load together in one fetch), not per-field. Do not duplicate that machinery per-field.

- [x] Task 4: Shared `OnboardingAcknowledgment` component + Driver Attention Consent screen (AC: #1, #2) — **extract before duplicating, not after**
  - [x] `src/app/trust-moment.tsx` and the new Driver Attention Consent screen are structurally identical: full-bleed headline + supporting copy + one `IgnitionButton` (secondary, "Got it") + `isMounted`/`finally`-guarded async handler + inline error message. Building the second screen by copy-pasting the first would recreate the exact kind of duplication Story 1.3's code review already found and fixed once (`IgnitionButton`/`screenStyles` extraction) — for the same reason, extract now, before the second copy exists, not after.
  - [x] Create `src/shared/components/onboarding-acknowledgment.tsx` exporting `OnboardingAcknowledgment`, taking props: `headline: string`, `supportingCopy: string`, `onAcknowledge: () => Promise<{ error: RepositoryError | null }>`. **No `testIdPrefix` prop added** — kept fixed `testID`s (`got-it-button`/`error-message`) inside the shared component instead, since the two screens never coexist in the same render tree (each is tested independently) and both literally use the same "Got it" affordance per EXPERIENCE.md; a prefix prop would have added surface area with no real test-isolation benefit. Encapsulates everything `trust-moment.tsx` had except the two copy strings and which action to call.
  - [x] Refactor `src/app/trust-moment.tsx` to a thin wrapper: imports `OnboardingAcknowledgment`, passes its existing locked copy and `useProfile().markTrustMomentSeen`. Its existing tests (`trust-moment.test.tsx`) pass **completely unmodified** — not even import paths needed changing, since the test only imports the default-exported screen component itself.
  - [x] Created `src/app/driver-attention-consent.tsx` using `OnboardingAcknowledgment` with this story's locked copy and `useProfile().markDriverConsentSeen`.
  - [x] New tests (`src/app/__tests__/driver-attention-consent.test.tsx`) mirroring `trust-moment.test.tsx`'s exact structure (renders locked copy, tap calls the mark action, resolved-error and rejected-promise paths). 4/4 passing, plus `trust-moment.test.tsx`'s original 4/4 still passing post-refactor.
  - [x] Typography: reused `Typography.display` for the headline exactly as Story 1.4 did.

- [x] Task 5: Extend `_layout.tsx`'s guard from three-way to four-way (AC: #1, #3, #4)
  - [x] Added `hasSeenDriverConsent = !!profile?.driverConsentSeenAt || profileHasError` alongside the existing `hasSeenTrustMoment`, same fail-open-on-error reasoning Story 1.4 established.
  - [x] Four `Stack.Protected` blocks, evaluated so a mid-onboarding account (Trust Moment seen, Driver Consent not yet seen — AC #4) lands correctly: `sign-in` (unauthenticated) → `trust-moment` (`!hasSeenTrustMoment`) → `driver-attention-consent` (`hasSeenTrustMoment && !hasSeenDriverConsent`) → `index`+`settings` (both seen).
  - [x] No changes needed to the loading-gate logic — confirmed: `useProfile`'s single `isLoading`/`resolvedForUserId` pair already covers the whole profile fetch (both flags load together), so no new per-field loading state was needed. Full 52-test regression suite green, `tsc --noEmit` clean.

- [x] Task 6: Live verification (AC: #1–#4) — same real-signal standard as every prior auth/profile story, same fallback as Stories 1.3/1.4 (no device build available; EAS Android quota resets 2026-08-01)
  - [x] Reused the still-valid access token from Story 1.4's Task 6 session (checked its expiry against wall-clock time before use — still ~11 minutes left in its 1-hour lifetime) rather than requesting a fresh OTP, avoiding the `429 over_email_send_rate_limit` Story 1.4's review round hit from over-requesting.
  - [x] Called the `mark_driver_consent_seen` RPC directly (`POST /rest/v1/rpc/mark_driver_consent_seen`) — succeeded, set `driver_consent_seen_at` to a fresh server timestamp (`2026-07-26T21:42:08.71...Z`) while `trust_moment_seen_at` (set by Story 1.4's testing) stayed untouched on the same row.
  - [x] Called it again immediately after — returned the identical `driver_consent_seen_at`, confirming `coalesce` idempotency (doesn't overwrite with a new `now()` on a repeat call).
  - [x] Both calls used inline shell variables, no token ever written to a temp file this time (no cleanup needed).

## Dev Notes

- **This story's entire shape is "do exactly what Story 1.4 did, for the sibling column, and fix the duplication Story 1.4 (correctly) didn't have the chance to avoid yet."** Story 1.4 built the `profiles` table with both `trust_moment_seen_at` and `driver_consent_seen_at` columns already (schema-shape decision made then, so no `ALTER TABLE` needed now), a server-stamping RPC pattern (proven correct via live verification and a code-review fix), a `useProfile` hook with the exact staleness-guard/fail-open machinery this story reuses, and a screen shape worth extracting into a shared component now that a second instance of it exists. Read `1-4-trust-moment.md`'s Dev Agent Record in full before starting — its Debug Log documents the loading-gate race, the stale-closure bug in the first staleness-guard attempt, and the fail-open design rationale, all of which this story depends on understanding, not re-discovering.
- **Do not duplicate the staleness guard or the screen shell.** Both are flagged explicitly in Tasks 3 and 4 above because copy-pasting either is the single most likely mistake in this story — the previous story's review process caught real, working-but-subtly-broken first attempts at exactly this kind of logic once already this project. Extracting shared code here isn't optional cleanup; it's closing a demonstrated bug class.
- **`hasError`'s fail-open semantics already cover both flags** since it's set at the whole-profile-fetch level, not per-field. A fetch error means "unknown state for this whole account," and both `hasSeenTrustMoment` and `hasSeenDriverConsent` should independently fail open to `true` in that case — same reasoning as Story 1.4 (this is a low-stakes, one-time consent screen; failing closed and re-showing onboarding to an already-onboarded user after a network blip is worse than failing open).
- **Routing order matters for AC #4.** A user could plausibly get killed/backgrounded between Trust Moment and Driver Attention Consent (both fire in the same onboarding pass but are still two separate screen transitions). The four-way guard must check `hasSeenTrustMoment` before `hasSeenDriverConsent` so that state is representable and correctly routes to the right screen, not skipped or double-shown.
- **No new table, no new RLS policy.** This story only adds a second RPC function and reuses every other piece of Story 1.4's infrastructure (`profiles` table, its RLS policies, `useProfile`'s fetch/loading logic). Resist the urge to add anything to the migration beyond the one function.

### Project Structure Notes

- `supabase/migrations/` gets one new file (RPC function only, no table/policy changes).
- `src/repositories/profile-repository.ts` gains one new exported method; no new file.
- `src/shared/hooks/use-profile.tsx` gains one new exported action plus an internal refactor (shared staleness-guard helper); no new file.
- `src/shared/components/onboarding-acknowledgment.tsx` is a new shared component, following the same extraction pattern Story 1.3 used for `ignition-button.tsx`/`screen.ts`.
- `src/app/trust-moment.tsx` is modified (refactored to use the new shared component) even though its story (1.4) is already `done` — same precedent as Story 1.3 modifying Story 1.2's `sign-in.tsx` to extract shared pieces.
- `src/app/driver-attention-consent.tsx` is a new Expo Router route alongside the existing four screens.
- `src/app/_layout.tsx` is modified (three-way guard → four-way).

### References

- [Source: epics.md#Story-1.5] — acceptance criteria as originally scoped
- [Source: EXPERIENCE.md#Driver-Safety-Interaction-Model] — locked Driver Attention Consent copy, firing rule, "consent-based not technical" rationale
- [Source: EXPERIENCE.md#UJ-1] — Driver Attention Consent's position in the first-time flow (immediately after Trust Moment, same onboarding pass, before Home)
- [Source: ARCHITECTURE-SPINE.md#Consistency-Conventions] — `profiles` table entity diagram (`driver_consent_seen_at` already present from Story 1.4's migration)
- [Source: 1-4-trust-moment.md] — everything this story builds directly on top of: the `profiles` table + RLS, `profileRepository`'s conventions, `useProfile`'s fetch/loading/fail-open/staleness-guard logic, the server-stamping RPC pattern (including its code-review fix history), and the three-way `_layout.tsx` guard this story extends to four-way. Read its full Dev Agent Record, not just its Tasks section.
- [Source: 1-3-persistent-session-sign-out.md] — the `IgnitionButton`/`screenStyles` extraction precedent this story's `OnboardingAcknowledgment` extraction follows (a second occurrence of screen-shell duplication triggering an extraction, same as that story's code review did for the button/style duplication).

## Dev Agent Record

### Agent Model Used

Claude Sonnet 5

### Debug Log References

- **Migration applied locally before relying on CI**, same discipline as every prior story: `supabase db push --yes` against `voylo-dev` with `SUPABASE_ACCESS_TOKEN`/`SUPABASE_DB_PASSWORD`/`SEND_EMAIL_HOOK_SECRET` set. Applied cleanly.
- **Extracted the staleness-guard helper (`runMarkAction`) into `use-profile.tsx` rather than copy-pasting `markTrustMomentSeen`'s body a second time**, exactly as the story's Dev Notes required. `markTrustMomentSeen` and `markDriverConsentSeen` are now both one-line wrappers around `runMarkAction(profileRepository.<fn>, <message>)`. No behavior change to `markTrustMomentSeen` — its existing 3 tests (including the stale-response regression test) still pass unmodified, proving the refactor preserved the fix.
- **Extracted `OnboardingAcknowledgment` (`src/shared/components/onboarding-acknowledgment.tsx`) before writing the Driver Attention Consent screen**, per the story's explicit instruction to avoid recreating Story 1.3's button/style duplication a second time. `trust-moment.tsx` is now a 12-line wrapper; its existing test file needed zero changes (it only imports the default-exported screen component, which kept its public shape). Deliberately did not add a `testIdPrefix` prop — both screens use the same fixed `got-it-button`/`error-message` testIDs since they never render simultaneously in any test, and a prefix would have added prop surface with no real benefit; noted as a judgment call in the Task 4 checklist in case review disagrees.
- **Live verification (Task 6) reused a still-valid access token from Story 1.4's own Task 6 session** instead of requesting a fresh OTP — checked its JWT `exp` claim against wall-clock time first (had ~11 minutes left of its 1-hour lifetime) before using it, avoiding the `429 over_email_send_rate_limit` Story 1.4's code-review round hit. Both RPC calls (initial + idempotency re-check) used inline shell variables, never written to a temp file, so no cleanup step was needed this time.
- **No new lint or type errors introduced** — confirmed via `npm run lint` and `tsc --noEmit` after every task, not just at the end. The two pre-existing lint errors (`sign-in.tsx`, `use-color-scheme.web.ts`) remain, both in files this story doesn't touch.

### Completion Notes List

- Task 1 complete: `mark_driver_consent_seen()` RPC, mirroring Story 1.4's `mark_trust_moment_seen()` exactly, applied to `voylo-dev`.
- Task 2 complete: `profileRepository.markDriverConsentSeen()`. 10/10 repository tests passing (7 pre-existing + 3 new).
- Task 3 complete: `useProfile`'s staleness-guard logic extracted into a shared `runMarkAction` helper; `markDriverConsentSeen` added using it. 14/14 hook tests passing (11 pre-existing + 3 new).
- Task 4 complete: `OnboardingAcknowledgment` extracted; `trust-moment.tsx` refactored to use it (existing tests unmodified, still passing); `driver-attention-consent.tsx` built on it. 8/8 screen tests passing across both files.
- Task 5 complete: `_layout.tsx`'s guard extended to four-way, `hasSeenDriverConsent` added with the same fail-open reasoning as `hasSeenTrustMoment`.
- Task 6 complete: `mark_driver_consent_seen` RPC live-verified against `voylo-dev` — sets the sibling column without disturbing `trust_moment_seen_at`, idempotent on repeat calls.
- Full regression suite: 52/52 tests passing, up from Story 1.4's 42 (10 new: 3 repository, 3 hook, 4 `driver-attention-consent` screen). `tsc --noEmit` clean. `npm run lint` clean (2 pre-existing errors in untouched files only).
- **Story 1.5 is functionally complete.** All 4 ACs satisfied, all 6 tasks done. Both onboarding screens now share one component; both mark-actions share one staleness-guard helper — no duplication carried forward from Story 1.4's pattern.

### File List

- `supabase/migrations/20260726170000_mark_driver_consent_seen_function.sql` (new) — server-stamping RPC for the sibling column
- `src/repositories/profile-repository.ts` — `markDriverConsentSeen()` added (modified)
- `src/repositories/__tests__/profile-repository.test.ts` — 3 new tests mirroring `markTrustMomentSeen`'s (modified)
- `src/shared/hooks/use-profile.tsx` — `markDriverConsentSeen` action added; `markTrustMomentSeen`'s staleness-guard logic extracted into a shared `runMarkAction` helper (modified)
- `src/shared/hooks/__tests__/use-profile.test.tsx` — 3 new tests mirroring `markTrustMomentSeen`'s (update, stale-discard, error-without-update) (modified)
- `src/shared/components/onboarding-acknowledgment.tsx` (new) — shared screen shell extracted from `trust-moment.tsx`
- `src/app/trust-moment.tsx` — refactored to a thin wrapper around `OnboardingAcknowledgment` (modified)
- `src/app/driver-attention-consent.tsx` (new) — Driver Attention Consent screen, built on `OnboardingAcknowledgment`
- `src/app/__tests__/driver-attention-consent.test.tsx` (new) — mirrors `trust-moment.test.tsx`'s structure
- `src/app/_layout.tsx` — three-way guard extended to four-way (`hasSeenDriverConsent` added) (modified)

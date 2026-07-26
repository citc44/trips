# Story 1.5: Driver Attention Consent

Status: ready-for-dev

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

- [ ] Task 1: `mark_driver_consent_seen()` RPC (AC: #2) — mirrors Story 1.4's `mark_trust_moment_seen()` function exactly
  - [ ] New migration `supabase/migrations/<timestamp>_mark_driver_consent_seen_function.sql`:
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
  - [ ] **This is server-stamped from the start, even though this story's AC text (unlike Story 1.4's AC2) doesn't literally say "(server timestamp)".** Story 1.4's code review established, for the whole `profiles` table's one-time-onboarding-flag columns, that a client-supplied `new Date().toISOString()` is a real spec/security gap (a skewed or spoofed device clock could persist an arbitrary value) — applying the same fix proactively here, to the sibling column on the same row, rather than waiting for review to flag the inconsistency a second time. Flagged plainly as a proactive-consistency choice, not a literal AC requirement, in case a reviewer wants to weigh in.
  - [ ] Apply locally via `supabase db push` against `voylo-dev` before relying on CI.
  - [ ] No new RLS policies needed — `profiles`' existing `profiles_select_own`/`profiles_insert_own`/`profiles_update_own` (Story 1.4's migration) already cover this column; `security invoker` means the RPC still goes through them.

- [ ] Task 2: `profileRepository.markDriverConsentSeen()` (AC: #2)
  - [ ] Add `markDriverConsentSeen(): Promise<ProfileResult>` to `src/repositories/profile-repository.ts`, calling `supabase.rpc('mark_driver_consent_seen')` — same shape as `markTrustMomentSeen`, same `toProfile`/`toRepositoryError` mapping, no new types needed.
  - [ ] Export it from `profileRepository = { getProfile, markTrustMomentSeen, markDriverConsentSeen }`.
  - [ ] Unit tests mirroring `markTrustMomentSeen`'s existing three tests exactly (calls the RPC with the right name, returns the mapped profile, returns a typed error on failure).

- [ ] Task 3: `useProfile`'s `markDriverConsentSeen` action (AC: #2, #3) — **extract the shared staleness-guard logic instead of copy-pasting a second near-identical function**
  - [ ] `markTrustMomentSeen`'s current body (in `src/shared/hooks/use-profile.tsx`) has three parts: (a) bail out if there's no session, (b) call its repository function, (c) apply the result only if `latestUserIdRef.current` still matches the request (the staleness guard this story's own predecessor's code review added after a first, buggy attempt read a stale closure instead). Part (a) and (c) are identical for any "mark a one-time onboarding flag" action. Extract a private helper (e.g. `applyMarkResult(requestedUserId, result)` or `runMarkAction(repositoryCall)`) that both `markTrustMomentSeen` and the new `markDriverConsentSeen` call, so the staleness guard exists in exactly one place. Copy-pasting it a second time risks silently dropping the guard on one of the two copies — a real, already-demonstrated risk this story should not repeat, not a hypothetical one.
  - [ ] Add `markDriverConsentSeen: () => Promise<{ error: RepositoryError | null }>` to `ProfileContextValue` and the provider's return value.
  - [ ] Unit tests mirroring `markTrustMomentSeen`'s existing coverage (updates local state on success, returns an error without updating state on failure, discards a stale response if the session changed mid-request — reuse the exact test structure/technique from `use-profile.test.tsx`'s existing `markTrustMomentSeen` tests).
  - [ ] No changes needed to the `getProfile` effect, `isLoading` derivation, or `hasError` fail-open logic — those already cover the whole `profile` object (both flags load together in one fetch), not per-field. Do not duplicate that machinery per-field.

- [ ] Task 4: Shared `OnboardingAcknowledgment` component + Driver Attention Consent screen (AC: #1, #2) — **extract before duplicating, not after**
  - [ ] `src/app/trust-moment.tsx` and the new Driver Attention Consent screen are structurally identical: full-bleed headline + supporting copy + one `IgnitionButton` (secondary, "Got it") + `isMounted`/`finally`-guarded async handler + inline error message. Building the second screen by copy-pasting the first would recreate the exact kind of duplication Story 1.3's code review already found and fixed once (`IgnitionButton`/`screenStyles` extraction) — for the same reason, extract now, before the second copy exists, not after.
  - [ ] Create `src/shared/components/onboarding-acknowledgment.tsx` exporting `OnboardingAcknowledgment`, taking props: `headline: string`, `supportingCopy: string`, `onAcknowledge: () => Promise<{ error: RepositoryError | null }>`, `testIdPrefix: string` (or similar — dev agent's call on exact prop shape, but it must parameterize copy, the action, and test IDs so both screens' existing tests can still target stable `testID`s). Encapsulates: the headline/supporting `Text`, the `IgnitionButton`, the `isMounted` ref + `finally` pattern, and the inline error message — everything currently in `trust-moment.tsx` except the two copy strings and which action to call.
  - [ ] Refactor `src/app/trust-moment.tsx` to a thin wrapper: import `OnboardingAcknowledgment`, pass its existing locked copy and `useProfile().markTrustMomentSeen`. Its existing tests (`trust-moment.test.tsx`) must still pass unmodified in intent (same `testID`s, same rendered copy, same behavior) — update only what the refactor requires (e.g. import paths), not the assertions themselves.
  - [ ] Create `src/app/driver-attention-consent.tsx` using `OnboardingAcknowledgment` with this story's locked copy and `useProfile().markDriverConsentSeen`.
  - [ ] New tests (`src/app/__tests__/driver-attention-consent.test.tsx`) mirroring `trust-moment.test.tsx`'s exact structure (renders locked copy, tap calls the mark action, resolved-error and rejected-promise paths).
  - [ ] Typography: reuse `Typography.display` for the headline exactly as Story 1.4 did (same "real moment, not a settings line" register per EXPERIENCE.md) — this is no longer a fresh interpretive call since Story 1.4's code review already had the opportunity to weigh in on that choice and didn't dispute it; treat it as settled precedent here, not a new decision to re-litigate.

- [ ] Task 5: Extend `_layout.tsx`'s guard from three-way to four-way (AC: #1, #3, #4)
  - [ ] Add `hasSeenDriverConsent = !!profile?.driverConsentSeenAt || hasError` alongside the existing `hasSeenTrustMoment`, same fail-open-on-error reasoning Story 1.4 established (a transient fetch error must not force either onboarding step to re-fire for an already-onboarded user).
  - [ ] Four `Stack.Protected` blocks, evaluated in this order so a mid-onboarding account (Trust Moment seen, Driver Consent not yet seen — AC #4) lands correctly:
    - `guard={!session}` → `sign-in` (unchanged)
    - `guard={!!session && !hasSeenTrustMoment}` → `trust-moment` (unchanged)
    - `guard={!!session && hasSeenTrustMoment && !hasSeenDriverConsent}` → new `driver-attention-consent` screen
    - `guard={!!session && hasSeenTrustMoment && hasSeenDriverConsent}` → `index` + `settings` (was the old `hasSeenTrustMoment`-only condition)
  - [ ] No changes needed to the loading-gate logic (`isAuthLoading || (!!session && isProfileLoading)`) — Story 1.4's code review already fixed the race in that logic at the `useProfile` level (a single `isLoading`/`resolvedForUserId` pair covering the whole profile fetch, both flags included), so no new per-field loading state is needed here.

- [ ] Task 6: Live verification (AC: #1–#4) — same real-signal standard as every prior auth/profile story, same fallback as Stories 1.3/1.4 (no device build available; EAS Android quota resets 2026-08-01)
  - [ ] Sign in as a real test account, capture its access token (OTP round-trip, same technique as Stories 1.3/1.4's Task 5/6 — reuse an existing session if still within its 1-hour token lifetime rather than requesting a fresh OTP unnecessarily, since Resend's shared test domain and Supabase's OTP rate limit both make repeated requests costly — Story 1.4's review round hit `429 over_email_send_rate_limit` from requesting too many in one session).
  - [ ] Call the `mark_driver_consent_seen` RPC directly (`POST /rest/v1/rpc/mark_driver_consent_seen`) and confirm it succeeds and sets `driver_consent_seen_at` without disturbing `trust_moment_seen_at` on the same row.
  - [ ] Call it again and confirm idempotency (`coalesce` preserves the original timestamp, doesn't overwrite with a new `now()`) — same proof technique Story 1.4 used for `mark_trust_moment_seen`.
  - [ ] Document the request/response sequence in the Dev Agent Record. Delete any temp files holding real tokens immediately after.

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

### Debug Log References

### Completion Notes List

### File List

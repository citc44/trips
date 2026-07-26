---
baseline_commit: 16d54e5
---

# Story 1.4: Trust Moment

Status: review

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a first-time user,
I want a clear, real statement that Voylo never sells my location data,
so that I trust it enough to grant location access later.

## Acceptance Criteria

1. **Given** a user's first-ever successful OTP verification on their account (no `profiles` row exists yet for that `user_id`, or one exists with `trust_moment_seen_at IS NULL`), **when** the app proceeds past sign-in, **then** the Trust Moment screen fires instead of landing directly on Home — full-bleed, locked copy: headline "Your location stays in this Voyage." and supporting line "We never sell your location data. It's visible only to people in your Voyage, and only while it's active."
2. **When** the user taps the single "Got it" acknowledgment, **then** `profiles.trust_moment_seen_at` is set (server timestamp) for that user's account, and the app proceeds to Home. (No separate Home entry point exists yet beyond the existing placeholder from Story 1.1 — this story routes to it, doesn't rebuild it.)
3. **Given** `profiles.trust_moment_seen_at` is already set for the account, **when** the user signs in again on any later session (same device or a new one), **then** the Trust Moment screen never fires again — the app proceeds straight to Home.

*(Fulfills UX-DR23. The "full policy stays reachable from Settings" promise in epics.md/EXPERIENCE.md refers to a privacy-policy link that does not exist yet — Story 1.3 explicitly deferred building out Settings beyond sign-out. Not this story's job to add it; only the Trust Moment screen and its one-time-fire behavior are in scope. Same incremental-growth precedent Story 1.3 set for Settings.)*

## Tasks / Subtasks

- [x] Task 1: `profiles` table + RLS migration (AC: #2, #3) — first table this project creates (base migration was intentionally schema-less, per Story 1.1's entity-creation-timing principle)
  - [x] New migration `supabase/migrations/<timestamp>_create_profiles.sql`:
    ```sql
    create table public.profiles (
      user_id uuid primary key references auth.users(id) on delete cascade,
      trust_moment_seen_at timestamptz,
      driver_consent_seen_at timestamptz,
      created_at timestamptz not null default now()
    );

    alter table public.profiles enable row level security;

    create policy "profiles_select_own" on public.profiles
      for select using (auth.uid() = user_id);

    create policy "profiles_insert_own" on public.profiles
      for insert with check (auth.uid() = user_id);

    create policy "profiles_update_own" on public.profiles
      for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
    ```
  - [x] `driver_consent_seen_at` is included now even though only Story 1.5 sets it — both columns belong to the same one-time-onboarding-flags shape on the same row/entity (`profiles`), and splitting them across two migrations would mean Story 1.5 does an `ALTER TABLE` on a table Story 1.4 just created in the same epic. This is a schema-shape decision, not building 1.5's screen/logic early — no application code in this story reads or writes `driver_consent_seen_at`.
  - [x] No `select`/`insert`/`update` policy grants access to any row but the caller's own (`auth.uid() = user_id`) — unlike Voyage-scoped tables (AD-1's shared `is_active_voyage_member` predicate), `profiles` needs no shared helper function; the own-row check is the entire authorization rule.
  - [x] Apply locally via `supabase db push` against `voylo-dev` to confirm the migration is valid before relying on CI's push step.

- [x] Task 2: `profileRepository` — first repository module in this codebase (AD-5) (AC: #2, #3)
  - [x] Create `src/repositories/profile-repository.ts`, exporting `profileRepository = { getProfile, markTrustMomentSeen }`.
  - [x] `getProfile(userId: string)`: `supabase.from('profiles').select('*').eq('user_id', userId).maybeSingle()` — `maybeSingle()` (not `single()`) because a first-ever user genuinely has no row yet; that's a valid `null` result, not an error.
  - [x] `markTrustMomentSeen(userId: string)`: `supabase.from('profiles').upsert({ user_id: userId, trust_moment_seen_at: new Date().toISOString() }, { onConflict: 'user_id' }).select().single()`. Web-verified: supabase-js's upsert only overwrites columns present in the payload object on conflict — `driver_consent_seen_at` (absent from this payload) is left untouched on an existing row, so this call can never accidentally clobber Story 1.5's future column. [Source: Supabase upsert docs](https://supabase.com/docs/reference/javascript/upsert)
  - [x] Map snake_case columns to camelCase at the repository boundary (`userId`, `trustMomentSeenAt`, `driverConsentSeenAt`), per ARCHITECTURE-SPINE.md's Consistency Conventions table.
  - [x] Surface errors as the typed `{ code, message }` shape the conventions table specifies — never the raw Supabase/PostgREST error object. This is the first repository in the codebase, so this is the pattern's first real implementation, not a precedent to follow from elsewhere; keep it simple (`{ code: error.code ?? 'unknown', message: error.message }` from the PostgrestError).
  - [x] Unit tests (mock the Supabase client the same way `use-auth.test.tsx` does): `getProfile` returns `null` data with no error when no row exists; returns mapped profile data when a row exists; `markTrustMomentSeen` calls `upsert` with the expected shape and returns the mapped, updated profile.

- [x] Task 3: `useProfile` shared hook (AC: #1, #3) — same centralization discipline as `use-auth.tsx`, but a separate hook/context, not an addition to it (auth session state and profile data are different concerns; `use-auth.tsx` owns AD-4's session source of truth, this hook owns profile data sourced through the new repository)
  - [x] Create `src/shared/hooks/use-profile.tsx`: `ProfileProvider` + `useProfile()`, exposing `{ profile, isLoading }`.
  - [x] On mount and whenever `session` (from `useAuth()`) changes: if there's a session, call `profileRepository.getProfile(session.user.id)` and store the result; if there's no session, reset `profile` to `null` (mirrors `use-auth.tsx`'s `isMounted` guard pattern for avoiding state updates after unmount/session-change races). Implemented keyed on `session?.user.id` rather than the full `session` object — Supabase's `autoRefreshToken` fires a new session object on every token refresh without the user changing, and refetching (plus flipping `isLoading` back to `true`) on every refresh would be wasted work and visible flicker.
  - [x] Expose a `markTrustMomentSeen()` action on the context that calls `profileRepository.markTrustMomentSeen(session.user.id)` and updates local `profile` state with the result on success — this is what lets `AppNavigator`'s guard (Task 5) react and flip without a manual navigation call, the same reactive pattern Story 1.3 used for sign-out.
  - [x] Unit tests mirroring `use-auth.test.tsx`'s structure: resolves to `profile: null` when there's no session; fetches and exposes profile data when a session exists; `markTrustMomentSeen` updates local state after a successful call.

- [x] Task 4: Trust Moment screen (AC: #1, #2)
  - [x] Create `src/app/trust-moment.tsx`. Full-bleed, `surfaceMidnight` background (same base canvas as `sign-in.tsx`/`settings.tsx`). Headline "Your location stays in this Voyage." + supporting line "We never sell your location data. It's visible only to people in your Voyage, and only while it's active." + one `IgnitionButton` (secondary variant, label "Got it").
  - [x] **Typography note (assumption, flag if changed):** DESIGN.md rations Clash Display (`Typography.display`, 28px) to named "emotional-beat" screens — Voyage Intro, Join invitation, Memory Lane title — and Trust Moment is not on that list. But EXPERIENCE.md separately describes Trust Moment as landing "as a real moment, not a settings-page disclosure," in "the hero type register" — explicitly not the restrained "plumbing" treatment `sign-in.tsx`/`settings.tsx` got. Reasonable reading used here: added a `display` entry to `design-tokens.ts` (28px Clash Display, 31px line-height per DESIGN.md's `1.1` ratio) and used it for the headline only; kept the supporting line in `Typography.body`. Also deliberately did **not** borrow the `hero-gap` (40px) spacing token — DESIGN.md names that one to exactly two screens (Voyage Intro, Join) far more explicitly than it names typography rationing, so Trust Moment keeps the existing `screenStyles.safeArea` gap. This is an interpretation, not a literally-named exception — noted here so code review can weigh in.
  - [x] On "Got it" tap: call `useProfile().markTrustMomentSeen()`. Do **not** manually navigate afterward — same AD-4-derived discipline Story 1.3 established for sign-out: `AppNavigator`'s guard (Task 5) reacts to the resulting `profile` state change and routes to Home on its own. A manual `router.replace` here would race with (or duplicate) the guard. Also added try/catch/inline-error-message/disabled-while-submitting handling matching `settings.tsx`'s established shape (Story 1.3's code review flagged the *absence* of this pattern 4 times independently — applying it from the start here rather than waiting for review to catch it again).
  - [x] Tests (`src/app/__tests__/trust-moment.test.tsx`, mocking `@/shared/hooks/use-profile`): renders the locked headline/supporting copy; tapping "Got it" calls `markTrustMomentSeen()`; plus two error-path tests (resolved error, rejected promise) mirroring `settings.test.tsx`. Remember this project's established RNTL findings — `await render(...)`, `await act(async () => { fireEvent.press(...) })`, `@jest/globals` imports — see `1-2-email-otp-sign-in.md` Dev Notes for the full findings if unfamiliar.

- [x] Task 5: Wire the three-way guard into `_layout.tsx` (AC: #1, #3)
  - [x] Wrap `AppNavigator` (or its consumer) with `ProfileProvider` inside `AuthProvider` (profile data depends on session, so `useProfile` needs `useAuth`'s session — provider nesting order matters).
  - [x] Extend the loading gate: currently `AppNavigator` returns `null` (splash stays up) while `useAuth().isLoading`. Also stay on the splash while a session exists but `useProfile().isLoading` is still true — otherwise there's a flash of the wrong screen before profile data resolves. Implemented as `isAuthLoading || (!!session && isProfileLoading)` — gated on `session` existing so an unauthenticated user isn't stuck on the splash screen waiting on profile data that will never load.
  - [x] Replace the existing two-way guard with a three-way one:
    - `Stack.Protected guard={!session}` → `sign-in` (unchanged)
    - `Stack.Protected guard={!!session && !profile?.trustMomentSeenAt}` → new `trust-moment` screen
    - `Stack.Protected guard={!!session && !!profile?.trustMomentSeenAt}` → `index` + `settings` (was `guard={!!session}` — now also requires the Trust Moment to be seen)
  - [x] No test framework exists for `_layout.tsx` itself in this project (none of Stories 1.1–1.3 added one for the guard composition) — verify this wiring via Task 6's live check rather than inventing a new layout-testing approach for one story. `tsc --noEmit` clean; full 38-test regression suite still green.

- [x] Task 6: Live verification (AC: #1, #2, #3) — real signal, not just "it compiles," matching this project's established standard (Story 1.1's Sentry/EAS checks, Story 1.2's email delivery check, Story 1.3's two-session sign-out proof). No device/simulator build is available this story either — the EAS Android free-tier quota exhausted during Story 1.2 resets 2026-08-01, still in the future as of this story. Verify at the API/RLS level instead, the same fallback Story 1.3 used for its equivalent gap:
  - [x] Sign in as a real test account (OTP round-trip via the Auth REST API, same technique as Story 1.3's Task 5) and capture its access token.
  - [x] Confirm no `profiles` row exists yet for that `user_id` via a `select` using the captured token (proves the "first-ever" `null` case `getProfile` must handle).
  - [x] Call the same upsert `markTrustMomentSeen` issues (`POST` to PostgREST with the captured token, `Prefer: resolution=merge-duplicates`) and confirm it succeeds and sets `trust_moment_seen_at`.
  - [x] Attempt the same upsert with a *different* real `user_id` in the payload (still using the original account's token) and confirm RLS rejects it — proves `profiles_insert_own`/`profiles_update_own`'s `auth.uid() = user_id` check actually blocks writing another account's row, not just that the happy path works.
  - [x] Re-run the first `select` and confirm it now returns the row with `trust_moment_seen_at` set — proves the "never resurfaces" condition (`getProfile` returning a non-null `trust_moment_seen_at`) is real, server-side state, not just client-side assumption.
  - [x] Document the exact request/response sequence in the Dev Agent Record, same format Story 1.3 used. Delete any temp files holding real tokens immediately after.

## Dev Notes

- **This is the first story to create an application table.** Story 1.1's base migration (`supabase/migrations/20260726023636_base_schema_init.sql`) deliberately created nothing (`select 1;`) — its own comment says RLS starts "per-table, starting with Story 1.4's `profiles` migration." This story is that migration.
- **This is also the first repository module (AD-5) and the first non-auth RLS policy set (AD-1's Voyage-scoped rule doesn't apply here) in the codebase.** Establishing the `{ code, message }` error-shape convention and the `<entityName>Repository` naming pattern for real, for the first time — later stories (Epic 2's `voyageRepository`, `memberRepository`) will follow whatever precedent this one sets, so keep it boring and exactly matching the conventions table rather than improvising.
- **`useProfile` is a new, separate hook/provider — not an addition to `use-auth.tsx`.** AD-4 scopes `use-auth.tsx` to session state specifically ("one shared auth context/hook wraps the Supabase Auth client... no screen manages its own session or token state"). Profile data is a normal repository-backed read, governed by AD-5, not AD-4 — it belongs in its own provider the same way a future `voyageRepository`-backed hook would, not bolted onto the auth hook.
- **Do not build Driver Attention Consent (Story 1.5) here.** `driver_consent_seen_at` exists as a column (schema-shape decision, see Task 1) but no code in this story reads or writes it, and Trust Moment's "Got it" routes straight to Home, not to a Driver Attention Consent screen — 1.5 will change that destination when it lands, same pattern Story 1.2 used when it explicitly deferred building Trust Moment itself.
- **Do not add the Settings privacy-policy link this story.** Epics.md/EXPERIENCE.md's "full policy stays reachable from Settings" describes the eventual end state; Story 1.3 already established that Settings grows incrementally per-story and deliberately did not build a policy link. Out of scope here too.
- **Typography ambiguity is real and intentional to flag, not resolve silently** — see Task 4's note. This project's code-review process (3 parallel adversarial layers) has caught and resolved exactly this kind of DESIGN.md-interpretation question before (Story 1.2's OTP-input-shape decision); expect the same here if the reviewers disagree with the `display`-token call.
- **`AppNavigator`'s loading gate now has two dependent stages (auth, then profile), not one.** Get the ordering right: don't render the three-way guard until *both* `useAuth().isLoading` is false *and*, if a session exists, `useProfile().isLoading` is also false — otherwise there's a one-frame flash of Home (or Trust Moment) before profile data has actually loaded, which would look like a bug even though the underlying data ends up correct.

### Project Structure Notes

- `src/repositories/profile-repository.ts` is the first file in `src/repositories/` (currently only a `.gitkeep`) — matches the structure Story 1.1 scaffolded in advance.
- `src/shared/hooks/use-profile.tsx` sits alongside `use-auth.tsx`, following the same file-naming convention.
- `src/app/trust-moment.tsx` is a new Expo Router route alongside `index.tsx`/`sign-in.tsx`/`settings.tsx`. Reuses `IgnitionButton` (`src/shared/components/ignition-button.tsx`) and, where applicable, `screenStyles` (`src/shared/styles/screen.ts`) from Story 1.3's extraction rather than duplicating styles again — the exact duplication Story 1.3's code review fixed once already.
- `src/constants/design-tokens.ts` gets one new export (`display` typography, see Task 4) — extend the existing file, don't create a second tokens file.
- New migration file under `supabase/migrations/`, timestamp-prefixed per the existing convention (see the base migration's filename).

### References

- [Source: epics.md#Story-1.4] — acceptance criteria as originally scoped
- [Source: ARCHITECTURE-SPINE.md#Consistency-Conventions] — `profiles` table's place in the entity diagram (`user_id`, `trust_moment_seen_at`, `driver_consent_seen_at`), repository naming/error-shape conventions, RLS-via-Postgres-policy rule (AD-1, generalized to non-Voyage tables)
- [Source: ARCHITECTURE-SPINE.md#AD-4] — why profile state is a separate hook from the auth session hook
- [Source: ARCHITECTURE-SPINE.md#AD-5] — repository-layer requirement this story implements for the first time
- [Source: EXPERIENCE.md#Trust-Privacy-Consent] — locked Trust Moment copy, "once per account ever" firing rule, hero type register description
- [Source: EXPERIENCE.md#UJ-1] — Trust Moment's position in the first-time flow (after OTP verify, before Driver Attention Consent/Home)
- [Source: DESIGN.md#Typography] — Clash Display/`display` token rationing rule behind Task 4's ambiguity note
- [Source: DESIGN.md#components] — `button-secondary` token spec (reused via `IgnitionButton`, not redefined)
- [Source: 1-1-project-foundation-environments.md] — base migration's explicit hand-off note naming this story as the first to add RLS/tables
- [Source: 1-2-email-otp-sign-in.md] — explicit note deferring Trust Moment to this story; RNTL testing conventions this story's tests must also follow
- [Source: 1-3-persistent-session-sign-out.md] — `IgnitionButton`/`screenStyles` extraction this story reuses; the "real API-level verification when no device build exists" precedent Task 6 follows

## Latest Technical Specifics (web-verified at story-creation time)

- **supabase-js `.upsert(payload, { onConflict })` only updates columns present in `payload` on conflict** — columns absent from the payload (e.g. `driver_consent_seen_at` when only setting `trust_moment_seen_at`) are left untouched on the existing row. Confirmed via Supabase's own upsert reference. One related gotcha specifically called out in community reports does **not** apply here: omitting the primary key from the payload can cause Postgres to assign a new key on the insert branch before the conflict resolves — but `profiles.user_id` is both the primary key and the exact value this repository's `markTrustMomentSeen` always includes, so that failure mode isn't reachable from this code path.
  - Source consulted: [Supabase upsert docs](https://supabase.com/docs/reference/javascript/upsert), [GitHub Discussion #25878 on upsert PK behavior](https://github.com/orgs/supabase/discussions/25878).

## Dev Agent Record

### Agent Model Used

Claude Sonnet 5

### Debug Log References

- **Migration applied locally before relying on CI**, same discipline as prior stories: `supabase link --project-ref dhdxaeczbgkdgoxxpxud` then `supabase db push --yes` against `voylo-dev`, with `SUPABASE_ACCESS_TOKEN`/`SUPABASE_DB_PASSWORD`/`SEND_EMAIL_HOOK_SECRET` set locally (the last one is required for `db push` to validate `config.toml`'s Auth hook config, unrelated to this story but a pre-existing local-environment requirement since AD-11). Applied cleanly; the only output was a harmless Docker-unavailable warning about migration-catalog caching, same as noted in earlier stories' CI runs.
- **`display` typography token added to `design-tokens.ts`** (28px Clash Display, 31px line-height derived from DESIGN.md's `1.1` line-height ratio — `28 * 1.1 = 30.8`, rounded to 31, same rounding approach already used for `headline`/`body`). This is the Task 4 "typography note" assumption called out in the story file — Trust Moment isn't in DESIGN.md's literal named list of Clash-Display screens (Voyage Intro, Join, Memory Lane), but EXPERIENCE.md separately and explicitly calls it a "real moment" in "the hero type register," contrasted against the deliberately restrained treatment `sign-in.tsx`/`settings.tsx` got. Flagging for code review rather than treating as settled.
- **`react-hooks/set-state-in-effect` ESLint rule caught a real issue in `use-profile.tsx`'s first draft**: the no-session early-return branch called `setProfile`/`setIsLoading` synchronously in the effect body (not inside a promise callback), which `npm run lint` flagged as an error. Fixed by wrapping that branch in `Promise.resolve().then(...)`, matching `use-auth.tsx`'s existing pattern of only ever calling setState inside `.then()`/`.catch()` callbacks, never synchronously in the effect body. Confirmed via `npm run lint`: this story's new/modified files are now clean; the two remaining lint errors project-wide (`sign-in.tsx`'s `useRef.current` access, `use-color-scheme.web.ts`'s synchronous effect setState) are both pre-existing and untouched by this story (`git diff --stat` confirms no changes to either file).
- **`useProfile`'s fetch effect is keyed on `session?.user.id`, not the full `session` object** — a deliberate deviation from copying `use-auth.tsx`'s dependency shape verbatim. Supabase's `autoRefreshToken` fires `onAuthStateChange` (and therefore a new `session` object) on every token refresh without the user changing; keying on the full object would refetch the profile and flash `isLoading` back to `true` on every refresh for no reason. Keying on the user id avoids this. Documented as a real, considered design choice, not an oversight, in case code review asks why it diverges from the auth hook's pattern.
- **Unplanned dependency note: running `npm run lint` bootstrapped `eslint`/`eslint-config-expo`.** `package.json` already had a `lint` script (`expo lint`) from Story 1.1's scaffolding, but the actual ESLint config/devDependencies were never installed — this was the first time any story actually ran it. `npx expo lint`'s first run auto-generated `eslint.config.js` and added `eslint`/`eslint-config-expo` as devDependencies (large `package-lock.json` diff as a result — a big transitive tree, but devDependency-only, nothing shipped to the app bundle). Not part of this story's task list; ran it as a quality check per the dev-story workflow's standard "run linting if configured" step, and it caught a real bug (see the `react-hooks/set-state-in-effect` finding above). Flagging plainly rather than silently absorbing it, since it's a real, if low-risk, unplanned dependency addition.
- **Live verification (Task 6) — full request/response trail**, run against the real `voylo-dev` project using a real test account (`citc_44@hotmail.com`, OTP round-trip via the Auth REST API, same technique as Story 1.3's Task 5):
  1. `POST /auth/v1/otp` (create_user: true) → `200 {}`. First OTP code the user reported was consumed by a local tooling mistake on my end (a `curl -o` write to a nonexistent directory) before I could use it — re-requested a second code rather than guessing.
  2. `POST /auth/v1/verify` with the second, fresh code → `200`, returned a real session: `user.id = 17b41198-43d3-442e-9d98-fb3c815fb633`, `access_token` captured.
  3. `GET /rest/v1/profiles?user_id=eq.17b41198-...` with that access token → `200 []` — confirms the true first-ever-user case: no row exists yet, exactly what `getProfile`'s `maybeSingle()` must handle as a valid `null`, not an error.
  4. `POST /rest/v1/profiles?on_conflict=user_id` with `Prefer: resolution=merge-duplicates,return=representation` and body `{"user_id": "17b41198-...", "trust_moment_seen_at": "2026-07-26T20:55:00.000Z"}` (the exact shape `markTrustMomentSeen` issues) → `201`, returned the new row with `trust_moment_seen_at` set and `driver_consent_seen_at: null` untouched — confirms the upsert both succeeds and doesn't clobber the sibling column.
  5. Same `POST` shape but with a different (fabricated, non-existent) `user_id` in the payload, still using the original account's access token → `403 {"code":"42501", "message":"new row violates row-level security policy for table \"profiles\""}` — proves `profiles_insert_own`'s `auth.uid() = user_id` check actually blocks writing another account's row, not just that the happy path works.
  6. Re-ran the `GET` from step 3 → `200`, now returns the row with `trust_moment_seen_at` set — proves the "never resurfaces" condition is real, persisted server-side state.
  - Temp file holding the real access token (`voylo_session_a.json`, written to the session scratchpad directory) was deleted immediately after the sequence completed.

### Completion Notes List

- Task 1 complete: `profiles` table + RLS migration created and applied to `voylo-dev`. First application table and first non-auth RLS policy set in this codebase.
- Task 2 complete: `profileRepository` (`getProfile`, `markTrustMomentSeen`) — first repository module in the codebase, establishing the `{ code, message }` error-shape and camelCase-mapping-at-the-boundary conventions for real. 7/7 unit tests passing.
- Task 3 complete: `useProfile`/`ProfileProvider` — separate hook from `use-auth.tsx` per AD-4's session-only scope. 7/7 unit tests passing, including a session-goes-away reset test and both success/failure paths for `markTrustMomentSeen`.
- Task 4 complete: `trust-moment.tsx` screen with the locked copy, `IgnitionButton` (secondary variant), and full try/catch/error-message/disabled-while-submitting handling applied proactively (Story 1.3's code review flagged the absence of this exact pattern 4 independent times — applied from the start here instead of waiting for review to catch it again). 4/4 tests passing. Typography interpretation flagged as an assumption for code review (see Debug Log).
- Task 5 complete: `_layout.tsx`'s guard extended from two-way to three-way (`sign-in` / `trust-moment` / `index`+`settings`), `ProfileProvider` nested inside `AuthProvider`, loading gate extended to also wait on profile data once a session exists. No dedicated layout test exists in this project (consistent with Stories 1.1–1.3); verified via `tsc --noEmit` (clean) and the full regression suite (green), plus Task 6's live proof that the underlying data the guard reads is correct.
- Task 6 complete: real API/RLS-level proof against `voylo-dev` — first-ever-null case, successful own-row upsert without clobbering sibling columns, RLS rejection of another account's row, and persisted never-resurfaces state. No device build available this story either (EAS quota resets 2026-08-01) — documented honestly, same as Story 1.3's equivalent gap, rather than claimed as device-tested.
- Full regression suite: 38/38 tests passing (20 pre-existing from Story 1.3 + 18 new across this story's 3 new test files: 7 `profile-repository`, 7 `use-profile`, 4 `trust-moment`). `tsc --noEmit` clean. `npm run lint`: no new errors or warnings from this story's files; 2 pre-existing errors remain in untouched files.
- **Story 1.4 is functionally complete.** All 3 ACs satisfied, all 6 tasks done.

### File List

- `supabase/migrations/20260726150000_create_profiles.sql` (new) — `profiles` table + RLS policies
- `src/repositories/profile-repository.ts` (new) — first repository module (AD-5)
- `src/repositories/__tests__/profile-repository.test.ts` (new)
- `src/shared/hooks/use-profile.tsx` (new) — `ProfileProvider`/`useProfile`
- `src/shared/hooks/__tests__/use-profile.test.tsx` (new)
- `src/app/trust-moment.tsx` (new) — Trust Moment screen
- `src/app/__tests__/trust-moment.test.tsx` (new)
- `src/constants/design-tokens.ts` — `display` typography token added (modified)
- `src/app/_layout.tsx` — three-way `Stack.Protected` guard, `ProfileProvider` nesting, extended loading gate (modified)

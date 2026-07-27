---
baseline_commit: ce4f0ed
---

# Story 2.5: Grant Organizer Status

Status: review

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As an Organizer,
I want to grant Organizer status to another Voyager,
so that no single person is a point of failure for managing the trip.

## Acceptance Criteria

1. **Given** the Organizer Action Sheet, **when** I select Grant Organizer Status for a Voyager, **then** they immediately gain End Voyage / Remove Voyager / Grant Organizer Status capabilities, with a quiet confirmation toast, no re-navigation.
2. **And** a Voyage can have more than one Organizer at a time.

*(Fulfills FR-7.)*

**🚫 Known interim-scope decisions (not silent gaps — see Dev Notes for full rationale on each):**

- **No display-name field exists anywhere in this schema — confirmed with the user directly before writing this story.** Every prior story (2.3 onward) worked around this for generic copy/counts, but "pick a specific Voyager to grant Organizer status to" genuinely cannot work without distinguishing individuals. Asked the user directly: add a real `display_name` field + a one-time collection prompt now, rather than a placeholder identity scheme (email exposure, or a meaningless positional label). **This story therefore also adds a third one-time onboarding step** (after Trust Moment, Driver Attention Consent), which is larger than this story's own AC text implies — flagged prominently, not silently absorbed.
- **No Organizer Action Sheet / bottom-sheet component exists yet** (Story 2.4's own interim-scope decision, still true). This story extends `active-voyage.tsx` — the same interim Live Map placeholder — with a minimal Voyager list and a "Grant Organizer" action per row, not a modal sheet. Remove Voyager (Story 2.6) will need the same list; building the real 3-row sheet is deferred until there's a concrete reason to unify all three actions into one component.
- **No toast/snackbar component exists anywhere in this app yet.** AC1 explicitly calls for one ("quiet confirmation toast, no re-navigation"), and DESIGN.md already defines a `nudge-toast` token for exactly this purpose (reused for future v1.1 nudges too, per EXPERIENCE.md). This story builds a minimal version: tap-through-nothing, ~4s auto-dismiss, no swipe-to-dismiss gesture (EXPERIENCE.md mentions swipe-dismiss for nudge toasts generally, but wiring a new gesture handler for one instance is out of scope here — flagged as a judgment call, not a silent cut).

## Tasks / Subtasks

- [x] Task 1: `profiles.display_name` + a third onboarding step (AC: #1) — **prerequisite scope, confirmed with the user directly, not silently added**
  - [x] New migration: `alter table public.profiles add column display_name text;` — nullable.
  - [x] New `set_display_name(p_display_name text)` RPC — `security invoker`, trims + length-caps (60 chars) server-side. Not coalesced (unlike the seen-flags) since a display name is ordinary editable user data, not a one-time consent stamp.
  - [x] **Re-confirmed Supabase CLI still 403'd against `voylo-dev`** at the start of this story — the fifth consecutive story blocked. Could not `db push` or live-verify; SQL hand-verified against established patterns instead.

- [x] Task 2: Extend `resolveRoute()` with the new onboarding gate (AC: #1)
  - [x] Added `hasDisplayName: boolean`, new `'display-name'` branch positioned after `'driver-attention-consent'`, before `'home'`. `AppRoute` union updated.
  - [x] `resolve-route.test.ts` updated exhaustively — every existing test extended with the new param, plus two new tests for the new branch and the full-chain `'home'` case. 5/5 passing.
  - [x] `_layout.tsx` wired: `hasDisplayName` derived (`!!profile?.displayName || profileHasError`), new `Stack.Protected guard={route === 'display-name'}` block registering `display-name.tsx`. **Also updated `join/[code].tsx`'s own two local `resolveRoute()` call sites (Story 2.3's fix)** — both needed the new `hasDisplayName` param and a new `display-name`-routing branch, or a user completing OTP + onboarding without a display name yet would have skipped this step entirely. Full suite re-run to confirm: 163/163 passing.

- [x] Task 3: `display-name.tsx` onboarding screen (AC: #1)
  - [x] New `src/app/display-name.tsx` — standalone screen (didn't extend `OnboardingAcknowledgment`; a text-input step is different enough from a pure acknowledgment that forcing a shared shell would have added conditional complexity to a component two other screens already depend on, for a one-time use).
  - [x] "What should we call you?" headline, single text input, `IgnitionButton` submit disabled until non-empty (trimmed).
  - [x] On submit: calls `setDisplayName`, no manual navigation on success — `_layout.tsx`'s guard reacts to the updated profile state.

- [x] Task 4: `profileRepository`/`useProfile` additions (AC: #1)
  - [x] `displayName: string | null` added to `Profile`, mapped from `display_name`. 16/16 repository tests passing (5 new).
  - [x] `setDisplayName(name)` added to `profileRepository`.
  - [x] `setDisplayName` added to `useProfile()`, reusing `runMarkAction`'s existing stale-response guard via a closure (`() => profileRepository.setDisplayName(name)`) rather than changing `runMarkAction`'s signature. 16/16 hook tests passing (2 new).

- [x] Task 5: `get_voyage_members()` — the list Grant Organizer picks from (AC: #1, #2)
  - [x] New migration. `security definer`, narrow explicit projection (`user_id`, `display_name`, `role`, `joined_at` only — `profiles`' RLS left untouched).
  - [x] Authorization reuses `is_voyage_participant()` from Story 2.4.
  - [x] `returns table (user_id uuid, display_name text, role text, joined_at timestamptz)`, active members only, ordered by `joined_at`.

- [x] Task 6: `grant_organizer_status()` RPC (AC: #1, #2)
  - [x] Same migration file. `security definer`, active-organizer authorization check (same shape as `end_voyage()`).
  - [x] Non-member target → distinct custom errcode (`ORG02`; caller-not-organizer is `ORG01`).
  - [x] Idempotent update — granting to an existing Organizer is a no-op success.
  - [x] Both `revoke` statements present.

- [x] Task 7: Repository additions (AC: #1, #2)
  - [x] `getVoyageMembers(voyageId)` → `VoyageMember[]`, `grantOrganizerStatus(voyageId, targetUserId)` → `{ error }`.
  - [x] Tests: mapped-value, empty-list, and error-passthrough cases for both. 33/33 repository tests passing (7 new).

- [x] Task 8: Minimal toast component (AC: #1)
  - [x] New `src/shared/components/toast.tsx` — a presentational `<Toast message onDismiss />` component (no global queue/context — the only caller today is `active-voyage.tsx`, which owns its own `toastMessage` state; building a queueing system for one usage would be over-engineering). `nudge-toast` token applied. Auto-dismisses after ~4s (fake-timer tested). No swipe-dismiss.
  - [x] Added `Colors.surfaceGlass` = `#1E2547CC`, `Colors.accentElectric` = `#2FE6C0`, `Rounded.md` = `18`, plus a `NudgeToast` composite token (mirrors `JoinCodeCard`'s pattern) so future v1.1 nudges reuse the same token, not just this story's usage. 3/3 tests passing.

- [x] Task 9: Extend `active-voyage.tsx` with a Voyager list + Grant Organizer action (AC: #1, #2)
  - [x] Fetches `getVoyageMembers` on mount via a stable-ref-held loader (doesn't block the rest of the screen).
  - [x] Renders `displayName` + role label per member. Organizer-only Grant Organizer action on each non-organizer row. Success shows the quiet toast and re-fetches (not optimistic) — no navigation. 11/11 tests passing (5 new).
  - [x] Failure shows inline, never a dead end.

- [x] Task 10: Live verification (AC: #1, #2)
  - [x] **Supabase CLI still 403'd against `voylo-dev`** — the fifth consecutive story blocked. Could not `db push` or live-verify `set_display_name()`, `get_voyage_members()`, or `grant_organizer_status()`. All hand-verified against established patterns (security invoker/definer posture matched to precedent, narrow projections, idempotent updates, explicit anon revokes) instead — stated plainly, not presented as equivalent to live verification.

## Dev Notes

- **This story's biggest architectural decision is Task 2, and it's a deliberate reversal of Story 2.3/2.4's "layer on top, don't touch resolveRoute()" guidance — read why before assuming that guidance still applies unconditionally.** That guidance was specifically about *session-scoped UI state* (a pending join, an active Voyage) that isn't part of the once-ever account onboarding chain. Display-name collection *is* part of that chain, structurally identical to Trust Moment/Driver Consent, so it belongs inside `resolveRoute()` itself, not layered on top of it. Getting this distinction wrong in either direction (folding `pendingJoinCode` into `resolveRoute()`, or layering display-name collection on top the way `activeVoyage` was) would be a real design mistake, not just a style preference.
- **`get_voyage_members()` is the first function in this project to bypass RLS specifically to read data from a *different table* (`profiles`) than the one its authorization check is against (`voyage_members`).** Every prior `security definer` function so far has queried the same table(s) its own RLS policies would otherwise gate. Keep the projection narrow and explicit (four named columns, not `select *` or a join returning full rows from either table) — this is the precedent future stories reading `profiles` cross-user should follow.
- **Idempotent grant, not rejected-as-error.** Unlike `join_voyage()`'s idempotent-rejoin case (which was a defensive fix for a race), `grant_organizer_status()`'s idempotency is a first-class, expected outcome per AC2 — a Voyage can have multiple Organizers, so re-granting to an existing one isn't an edge case, it's normal.
- **No Remove Voyager here.** Story 2.6 owns that; don't build it early just because the Voyager list UI would make it easy to bolt on. The list's only action in this story is Grant Organizer.

### Project Structure Notes

- `supabase/migrations/` gets two new files: one for `profiles.display_name` + `set_display_name()`, one for `get_voyage_members()` + `grant_organizer_status()`.
- `src/repositories/profile-repository.ts` — `displayName` field, `setDisplayName` added.
- `src/repositories/voyage-repository.ts` — `getVoyageMembers`, `grantOrganizerStatus` added.
- `src/shared/hooks/use-profile.tsx` — `setDisplayName` action added, following `markTrustMomentSeen`'s established shape.
- `src/shared/navigation/resolve-route.ts` — **modified**, not layered around: new `hasDisplayName` param, new `'display-name'` branch. Its own test file gets exhaustive new coverage.
- `src/app/display-name.tsx` is a new Expo Router route (the onboarding screen).
- `src/shared/components/toast.tsx` (or equivalent) is new.
- `src/app/active-voyage.tsx` — modified: Voyager list + Grant Organizer action added.
- `src/app/_layout.tsx` — modified: new guard branch for `'display-name'`.
- `src/constants/design-tokens.ts` — modified: `surfaceGlass`, `accentElectric`, `Rounded.md` added.

### References

- [Source: epics.md#Story-2.5] — acceptance criteria as originally scoped
- [Source: prd.md#FR-7] — functional requirement
- [Source: EXPERIENCE.md#Information-Architecture] — Grant Organizer confirm row; modal-stacking rule (not directly applicable here since no sheet exists yet, but the "swap don't stack" principle still informs the no-re-navigation requirement)
- [Source: EXPERIENCE.md#Component-Patterns] — `nudge-toast` component definition; `organizer-sheet`'s three-row description (Grant Organizer is one of the three, still not fully built)
- [Source: EXPERIENCE.md#State-Patterns] — "Organizer status granted" row: "Organizer controls simply appear on their existing Live Map HUD — no new screen, no re-navigation — with a quiet confirmation toast. Deliberately undramatic, in contrast to the 'wow' screens." (This story's AC1 verbatim, with the exact tone guidance.)
- [Source: DESIGN.md#Components] — `nudge-toast` token spec (background, foreground, radius, accentBar)
- [Source: 2-1-start-a-voyage.md] — `voyage_members.role` column and the `'organizer'`/`'voyager'` check constraint this story writes to
- [Source: 2-3-join-voyage-via-code-link.md] — the display-name gap first surfaced here (deferred at the time); `resolveRoute()`-stays-pure precedent this story deliberately reconsiders for a structurally different case (see Dev Notes)
- [Source: 2-4-end-voyage.md] — `is_voyage_participant()` (reused for Task 5's authorization check) and the organizer-authorization-check shape (reused for Task 6); the interim `active-voyage.tsx` placeholder this story extends; the Supabase CLI access caveat carried forward, now unresolved across five consecutive stories

## Dev Agent Record

### Agent Model Used

Claude Sonnet 5

### Debug Log References

- **Supabase CLI 403'd against `voylo-dev` for the fifth consecutive story** — checked at the start of this story, same unresolved gap. No `db push`, no live verification of any of this story's SQL (`profiles.display_name`, `set_display_name()`, `get_voyage_members()`, `grant_organizer_status()`).
- **`join/[code].tsx`'s own local `resolveRoute()` call sites (Story 2.3's fix) needed updating too, caught before it became a live bug.** That screen computes its own "what's next" route independently of `_layout.tsx` (see Story 2.3's Dev Notes on why). Extending `resolveRoute()`'s signature here meant both of `join/[code].tsx`'s call sites needed the new `hasDisplayName` param and a new `display-name` branch, or a user completing OTP + onboarding via a deep-link invite would have skipped display-name collection entirely and landed straight on `voyage-joined`/Home. Found this by re-running the full suite (which caught the resulting `tsc` errors) rather than by inspection alone — worth remembering for any future `resolveRoute()` signature change: grep for all call sites, not just `_layout.tsx`.
- **`OnboardingAcknowledgment` was deliberately not extended.** Considered adding an optional child-input slot to let `display-name.tsx` reuse it, but that would add conditional complexity to a shared component two other screens (Trust Moment, Driver Consent) already depend on, for a single one-time use. Built standalone instead, reusing the same typography/layout conventions without a shared-component refactor.
- No new lint or type errors — confirmed via `npm run lint`/`tsc --noEmit` throughout (one patch briefly left an unnecessary `eslint-disable` comment, caught and removed before considering the task done). Same 4 pre-existing `sign-in.tsx:27` `react-hooks/refs` reports, untouched by this story.

### Completion Notes List

- Task 1 complete: `profiles.display_name` + `set_display_name()`. Not live-verified (see Debug Log).
- Task 2 complete: `resolveRoute()` extended with a new `'display-name'` branch — a deliberate architectural reversal of Story 2.3/2.4's "layer on top" guidance, justified in Dev Notes (this is an account-level onboarding gate, not session-scoped UI state). `_layout.tsx` and `join/[code].tsx`'s two local call sites all updated together.
- Task 3 complete: `display-name.tsx` onboarding screen. 6/6 tests passing.
- Task 4 complete: `Profile.displayName`, `profileRepository.setDisplayName`, `useProfile().setDisplayName`. 16/16 + 16/16 tests passing (5 + 2 new).
- Task 5/6 complete: `get_voyage_members()` (narrow cross-table projection, first of its kind in this project) and `grant_organizer_status()` (idempotent, active-organizer authorization) in one migration.
- Task 7 complete: `getVoyageMembers`/`grantOrganizerStatus` repository functions. 33/33 repository tests passing (7 new).
- Task 8 complete: minimal `Toast` component + `NudgeToast`/`surfaceGlass`/`accentElectric`/`Rounded.md` design tokens. 3/3 tests passing.
- Task 9 complete: `active-voyage.tsx` extended with the Voyager list and Grant Organizer action. 11/11 tests passing (5 new).
- Task 10: live verification blocked by the ongoing Supabase CLI access issue, now spanning five consecutive stories — stated plainly, not glossed over.
- Full regression suite: 168/168 tests passing, up from Story 2.4's 139 (29 new: 2 `resolve-route`, 6 `display-name`, 5 `profile-repository`, 2 `use-profile`, 7 `voyage-repository`, 3 `toast`, 5 `active-voyage`, 1 `join-invitation`; `use-active-voyage` and other existing suites unchanged in count). `tsc --noEmit` clean. `npm run lint`: no new errors.
- **Story 2.5 is code-complete but not live-verified**, the same disclosed limitation as the last four stories, now spanning five consecutive stories' worth of un-pushed SQL.

### File List

- `supabase/migrations/20260729000000_add_display_name.sql` (new) — `profiles.display_name`, `set_display_name()`
- `supabase/migrations/20260729010000_grant_organizer_status.sql` (new) — `get_voyage_members()`, `grant_organizer_status()`
- `src/repositories/profile-repository.ts` — `displayName` field, `setDisplayName` added (modified)
- `src/repositories/__tests__/profile-repository.test.ts` — 5 new tests (modified)
- `src/repositories/voyage-repository.ts` — `VoyageMember` type, `getVoyageMembers`, `grantOrganizerStatus` added (modified)
- `src/repositories/__tests__/voyage-repository.test.ts` — 7 new tests (modified)
- `src/shared/hooks/use-profile.tsx` — `setDisplayName` action added (modified)
- `src/shared/hooks/__tests__/use-profile.test.tsx` — 2 new tests (modified)
- `src/shared/navigation/resolve-route.ts` — `hasDisplayName` param, `'display-name'` branch added (modified)
- `src/shared/navigation/__tests__/resolve-route.test.ts` — extended exhaustively (modified)
- `src/app/display-name.tsx` (new) — third onboarding step
- `src/app/__tests__/display-name.test.tsx` (new)
- `src/shared/components/toast.tsx` (new) — minimal nudge-toast component
- `src/shared/components/__tests__/toast.test.tsx` (new)
- `src/constants/design-tokens.ts` — `surfaceGlass`, `accentElectric`, `Rounded.md`, `NudgeToast` added (modified)
- `src/app/active-voyage.tsx` — Voyager list + Grant Organizer action added (modified)
- `src/app/__tests__/active-voyage.test.tsx` — 5 new tests (modified)
- `src/app/_layout.tsx` — `hasDisplayName` derivation, new `display-name` guard branch (modified)
- `src/app/join/[code].tsx` — both local `resolveRoute()` call sites updated for the new `hasDisplayName` param/branch (modified)
- `src/app/__tests__/join-invitation.test.tsx` — `mockProfile` helper extended, 1 new test (modified)

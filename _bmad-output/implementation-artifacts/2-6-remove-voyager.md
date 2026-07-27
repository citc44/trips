---
baseline_commit: 485b40b
---

# Story 2.6: Remove Voyager

Status: review

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As an Organizer,
I want to remove a Voyager from an active Voyage,
so that I can fix an accidentally-leaked Join Code/Link.

## Acceptance Criteria

1. **Given** the Organizer Action Sheet, **when** I confirm Remove Voyager for someone, **then** their location and further participation stop immediately.
2. **And** they see a calm "You've left this Voyage" state, and the old Join Code/Link no longer re-admits them.

*(Fulfills FR-8.)*

**🚫 Known interim-scope decisions (not silent gaps — see Dev Notes for full rationale on each):**

- **"Their location... stop[s] immediately" is trivially true — location tracking doesn't exist yet (Epic 3).** Nothing to stop. Only "further participation" (read access, re-join eligibility) is real work here.
- **The removed Voyager's own device cannot be pushed the news in real time — same infrastructure gap as Story 2.5's AC1, same user-confirmed resolution: defer the instant-push half to Epic 3's real-time delivery mechanism (AD-2).** Unlike 2.5, this story does not re-ask the question — it applies the same already-made decision consistently. What *is* buildable without real-time infrastructure, and what this story builds: on the removed Voyager's *next* app load (already true today for every other state change in this app — nothing anywhere pushes instantly), they land on a dedicated "You've left this Voyage" screen instead of silently seeing plain Home with no explanation. That's the achievable half of AC2; the instant-push half is the deferred half.
- **No full 3-row Organizer Action Sheet / bottom-sheet component exists yet** (Story 2.4/2.5's own interim-scope decision, still true). This story adds a "Remove" action to the same Voyager list `active-voyage.tsx` already has (from Story 2.5), not a modal sheet.

## Tasks / Subtasks

- [x] Task 1: `remove_voyager()` RPC (AC: #1, #2)
  - [x] New migration `supabase/migrations/20260730000000_remove_voyager.sql`.
  - [x] `remove_voyager(p_voyage_id uuid, p_target_user_id uuid) returns void`, `security definer`, mirrors `grant_organizer_status()`'s shape.
  - [x] Active-organizer authorization check.
  - [x] **Last-organizer guard implemented with an explicit `select ... for update` row lock**, not just a plain count check — the invariant spans multiple rows (all of a Voyage's organizer rows), so folding it into a single `UPDATE ... WHERE` (as `end_voyage()`/`grant_organizer_status()` do for their single-row transitions) isn't sufficient on its own; the lock correctly serializes two concurrent removals that could otherwise both pass the count check and jointly orphan the Voyage.
  - [x] Removal itself is a single atomic `UPDATE ... WHERE removed_at is null and is_active = true`; zero rows affected → clear "not an active member" exception.
  - [x] Both `revoke` statements present.
  - [x] **Re-confirmed Supabase CLI still 403'd against `voylo-dev`** — the sixth consecutive story. Could not `db push` or live-verify; SQL hand-verified against established patterns instead (see Debug Log).

- [x] Task 2: Close the re-admission gap in `join_voyage()` (AC: #2)
  - [x] Read `join_voyage()`'s full current definition before starting; confirmed the gap exists exactly as described.
  - [x] Added the removed-row check in the same migration file, before the existing idempotent-rejoin logic — new `JOIN3` errcode, distinct from every existing `join_voyage()` rejection.
  - [x] Repository test confirms the rejection passes through unchanged (no repository code change was needed — verified rather than assumed).

- [x] Task 3: "You've left this Voyage" detection (AC: #2)
  - [x] `voyage_members.removal_acknowledged_at timestamptz` added, same migration file.
  - [x] `get_removal_notice()` and `acknowledge_removal()` implemented. **Corrected from the task text's own guidance**: built as `security definer`, not `invoker` — `is_voyage_participant()` (behind `voyage_members`' SELECT RLS policy) explicitly requires `removed_at is null`, so an ordinary security-invoker query would have RLS-blocked a removed user from reading their *own* removed row. Caught this before writing any code, not after a live failure.

- [x] Task 4: Repository additions (AC: #1, #2)
  - [x] `removeVoyager`, `getRemovalNotice`, `acknowledgeRemoval` added. 43/43 repository tests passing (10 new).
  - [x] Confirmed via test that `joinVoyage()`'s existing error-passthrough surfaces the new `JOIN3` rejection with no repository code changes.

- [x] Task 5: `useRemovalNotice` — fetches "was I just removed" on session change (AC: #2)
  - [x] New `src/shared/hooks/use-removal-notice.tsx`: `RemovalNoticeProvider`/`useRemovalNotice()`, same fetch-on-`userId`-change pattern as `use-active-voyage.tsx` — copied faithfully.
  - [x] Exposes `{ removalNotice, isLoading, hasError, acknowledge }`. `acknowledge` fails open (empty `catch` before `finally`) — an initial `try/finally`-with-no-`catch` version let a rejection propagate past the local-state clear; the red-phase test caught it before this was ever committed (see Debug Log).
  - [x] Wrapped `AppNavigator` with `RemovalNoticeProvider` in `_layout.tsx`. `isLoading` gate extended a third time.

- [x] Task 6: Wire the new routing branch into `_layout.tsx` (AC: #2)
  - [x] `resolveRoute()` untouched — `hasRemovalNotice` stays a session-scoped concern layered on top of its `'home'` result, same category as `pendingJoinCode`/`activeVoyage`.
  - [x] `route === 'home'` split gained a fourth branch, `hasRemovalNotice`, ordered ahead of `hasPendingJoin` (and behind `hasActiveVoyage`, which is always mutually exclusive with it in practice).
  - [x] `voyage-removed` registered **inside its own guard branch** (unlike `voyage-ended`'s unconditional registration) — reasoned explicitly in `_layout.tsx`'s own comment: the screen that clears the state (`voyage-removed.tsx`'s own Continue button) IS the currently-focused, guarded screen itself, the same shape as the already-working sign-in → trust-moment cascade, not the "different screen clears state out from under this one" shape Story 2.3 found broken.

- [x] Task 7: "You've left this Voyage" screen (AC: #2)
  - [x] New `src/app/voyage-removed.tsx`. Exact calm/no-justification copy, no destination, no blame. Single Continue action calling `acknowledge()`; no manual navigation — the guard reacts to `removalNotice` clearing, same pattern proven by the onboarding screens.
  - [x] Reuses `screenStyles`, same restraint as `voyage-ended.tsx`.

- [x] Task 8: Extend `active-voyage.tsx` with the Remove action (AC: #1, #2)
  - [x] Organizer-only, non-self row hidden via `member.userId === session?.user.id` (from `useAuth()`) — self-removal via this control is hidden entirely, not merely disabled.
  - [x] `ButtonDestructive` token added to `design-tokens.ts` (`surface-dusk-high` background, `error` foreground, `error` hairline at `55` hex-alpha ≈ 33%); `IgnitionButton` extended with a third `'destructive'` variant.
  - [x] Confirm copy: "Remove `<name>` from this Voyage?" — same in-place confirm-swap full-screen pattern as End Voyage's confirm view (no stacked dialog, no "cannot be undone"/"WARNING" language).
  - [x] On confirm: calls `removeVoyager`, re-fetches the member list on success, no toast (matches EXPERIENCE.md — only Grant Organizer gets one).
  - [x] Failure: inline error (`remove-voyager-error`), stays on the confirm view — never a dead end.

- [x] Task 9: Live verification (AC: #1, #2)
  - [x] **Supabase CLI still 403's against `voylo-dev`** — re-confirmed at the start of this task, same error as every prior story this session (now a sixth-consecutive-story blocker, unresolved). Could not `db push` or live-verify any of `remove_voyager()`, the `join_voyage()` re-admission fix, `get_removal_notice()`, or `acknowledge_removal()`. All SQL hand-verified against this epic's established patterns instead (see Debug Log). Flagged plainly here per this task's own instruction.

## Dev Notes

- **This story closes a real gap in a previous story's code (Task 2), not just adds new behavior.** `join_voyage()`'s re-admission hole existed since Story 2.3 and was invisible until Remove Voyager's own AC (2) demanded the guarantee it violates. Read `join_voyage()`'s full current definition before touching anything else in this story — this is the single most important pre-existing-code read for this story.
- **This is the third RPC in this epic to need the "fold the check into `UPDATE ... WHERE`" atomic-transition pattern** (`end_voyage()`, then `grant_organizer_status()`, now `remove_voyager()`). Apply it directly this time; don't ship the check-then-act version and wait for review to catch it a third time.
- **The last-organizer guard is a genuinely new invariant this story introduces** — nothing before this enforced "a Voyage must always have at least one Organizer" as a hard rule (Story 2.5 only established that it's *allowed* to have more than one). Get the count query right: active organizers only (`role = 'organizer' and removed_at is null and is_active = true`), scoped to `p_voyage_id`.
- **`removal_acknowledged_at` deliberately lives on `voyage_members`, not `profiles`.** A removal is specific to one Voyage; a future story could plausibly have a user removed from one trip while still active-or-later-joining another, and the acknowledgment must not leak across Voyages. This differs from Story 2.5's `display_name`, which correctly lives on the account-level `profiles` row because a name isn't Voyage-scoped — don't conflate the two patterns.
- **No "why was I removed" messaging, ever, anywhere.** EXPERIENCE.md is explicit and this is a deliberate product stance, not an oversight to "fix" later: "Calm, no red, no justification text."

### Project Structure Notes

- `supabase/migrations/` gets one new file: `remove_voyager()`, the `join_voyage()` re-admission fix, `voyage_members.removal_acknowledged_at`, `get_removal_notice()`, `acknowledge_removal()`.
- `src/repositories/voyage-repository.ts` — `removeVoyager`, `getRemovalNotice`, `acknowledgeRemoval` added.
- `src/shared/hooks/use-removal-notice.tsx` is a new file, new provider, mounted in `_layout.tsx` alongside the other three.
- `src/app/voyage-removed.tsx` is a new Expo Router route.
- `src/app/_layout.tsx` — modified: new provider wrapper, `isLoading` gate extended a third time, `home` block gains a fourth branch.
- `src/constants/design-tokens.ts` — modified: `button-destructive` token added.
- `src/shared/components/ignition-button.tsx` — modified: third `'destructive'` variant added.
- `src/app/active-voyage.tsx` — modified: Remove action added to the Voyager list.

### References

- [Source: epics.md#Story-2.6] — acceptance criteria as originally scoped
- [Source: prd.md#FR-8] — functional requirement
- [Source: EXPERIENCE.md#Component-Patterns] — `organizer-sheet`'s three rows (Remove Voyager is `button-destructive`, distinct from End Voyage's `button-ignition` ceremony and Grant Organizer's `button-secondary`)
- [Source: EXPERIENCE.md#Voice-and-Tone] — exact confirm copy register ("Remove Priya from this Voyage?" plain and calm, not "WARNING: this action will permanently remove this user")
- [Source: EXPERIENCE.md#State-Patterns] — "Voyager removed by Organizer" row: "You've left this Voyage." Calm, no red, no justification text, old join link no longer re-admits them — this row is this story's AC2 verbatim
- [Source: DESIGN.md#Components] — `button-destructive` token definition (background, foreground, border)
- [Source: 2-1-start-a-voyage.md] — `voyage_members.removed_at`/`is_active` columns this story is the first to actually *write* `removed_at` for (they've existed since Story 2.1 but nothing has set `removed_at` until now); AD-9's partial unique index, whose scoping (`removed_at is null and is_active = true`) is exactly why the Task 2 re-admission gap was possible
- [Source: 2-3-join-voyage-via-code-link.md] — `join_voyage()`'s current full definition, amended in Task 2
- [Source: 2-4-end-voyage.md] — `end_voyage()`'s atomic-update fix (the pattern Task 1 applies from the start this time); `is_voyage_participant()`'s `removed_at is null` scoping, which already correctly excludes removed users from read access with no further change needed
- [Source: 2-5-grant-organizer-status.md] — `grant_organizer_status()`'s authorization-check shape (reused for Task 1); the user's decision to defer real-time target-device updates to Epic 3, applied consistently here rather than re-litigated; `useActiveVoyage`'s fetch-on-session pattern (reused for Task 5); the Supabase CLI access caveat, now unresolved across five consecutive stories going into a sixth

## Dev Agent Record

### Agent Model Used

Claude Sonnet 5 (claude-sonnet-5)

### Debug Log References

- Supabase CLI 403 against `voylo-dev` (`dhdxaeczbgkdgoxxpxud`), re-confirmed via `npx supabase projects api-keys --project-ref dhdxaeczbgkdgoxxpxud` — same error as every prior story this session (sixth consecutive story, unresolved). All migration SQL hand-verified against this epic's established patterns (atomic `UPDATE ... WHERE` transitions, `revoke execute ... from public`/`from anon` pairs, `security definer` posture) rather than live-tested.
- Task 3's own guidance in this story file originally said `get_removal_notice()`/`acknowledge_removal()` should be `security invoker`. Caught before writing any code: `is_voyage_participant()` requires `removed_at is null` in its own predicate, so a removed user's own row is not readable via normal RLS — a security-invoker query would be silently blocked from reading/writing exactly the row these two functions exist to touch. Corrected to `security definer` in the migration, with an explanatory comment.
- `use-removal-notice.tsx`'s `acknowledge()` was first written as `try { await ... } finally { setRemovalNotice(null); }` with no `catch`. The red-phase test "acknowledge clears the local notice even if the repository call fails (fails open)" failed with the raw rejection propagating — `finally` runs before a re-throw, it doesn't suppress it. Fixed by adding an explicit empty `catch` before the `finally`.
- Full regression suite (`npx jest`, `npx tsc --noEmit`) re-run clean after every task; `npm run lint` shows one pre-existing failure in `src/app/sign-in.tsx` (`react-hooks/refs`, "Cannot access refs during render") — that file was committed in `5ca45e7` (Story 1.3), untouched by this story, confirmed via `git log -- src/app/sign-in.tsx`.

### Completion Notes List

- All 9 tasks complete, both ACs satisfied within this story's documented interim scope (location-stopping trivially true, no location tracking yet; instant push to the removed user's own device deferred to Epic 3, consistent with Story 2.5's user-confirmed decision, not re-asked).
- Full test suite: 23 suites / 198 tests passing (Story 2.6 added 5 repository tests folded into the existing 43/43 repository count, 6 `use-removal-notice` tests, 2 `voyage-removed` screen tests, 5 `active-voyage` Remove-action tests — 19 new tests this story on top of Story 2.5's baseline).
- `npx tsc --noEmit` clean. `npm run lint` has one pre-existing, out-of-scope failure (see Debug Log) not introduced by this story.
- Task 9 live verification could not run — Supabase CLI access remains blocked, disclosed plainly rather than assumed passing.

### File List

- `supabase/migrations/20260730000000_remove_voyager.sql` (new)
- `src/repositories/voyage-repository.ts` (modified)
- `src/repositories/__tests__/voyage-repository.test.ts` (modified)
- `src/shared/hooks/use-removal-notice.tsx` (new)
- `src/shared/hooks/__tests__/use-removal-notice.test.tsx` (new)
- `src/app/_layout.tsx` (modified)
- `src/app/voyage-removed.tsx` (new)
- `src/app/__tests__/voyage-removed.test.tsx` (new)
- `src/constants/design-tokens.ts` (modified)
- `src/shared/components/ignition-button.tsx` (modified)
- `src/app/active-voyage.tsx` (modified)
- `src/app/__tests__/active-voyage.test.tsx` (modified)

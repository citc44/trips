---
baseline_commit: 7e0e9e6
---

# Story 2.4: End Voyage

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As an Organizer,
I want to manually end an active Voyage,
so that I can close out the trip when it's done.

## Acceptance Criteria

1. **Given** an active Voyage, **when** I open the Organizer Action Sheet and confirm End Voyage, **then** new recording stops immediately but never auto-triggers on anyone's arrival.
2. **And** I land on the Voyage Ended screen — a calm summary (duration, Voyager count, destination) with one action back to Home.

*(Fulfills FR-6; UX-DR14, UX-DR22.)*

**🚫 Known interim-scope decisions (not silent gaps — see Dev Notes for full rationale on each):**

- **No Live Map exists yet (Epic 3), so there's currently no "home surface for the entire duration of an active Voyage" for anyone to land on at all** — not just no Organizer Action Sheet to dock a control on, but literally nothing: today, after starting or joining a Voyage, the app has no screen reflecting "you're currently in an active Voyage," and no routing anywhere checks for that fact. This story adds a minimal interim `active-voyage.tsx` placeholder (destination + an Organizer-only End Voyage control) and the routing to actually reach it — same "build what this story needs, let the surrounding flow catch up" precedent already used four times this session (Destination Picker, Join-code card, Join Invitation's routing, `voyage-joined.tsx`).
- **The full 3-row Organizer Action Sheet (End Voyage / Grant Organizer Status / Remove Voyager) is not built.** Grant Organizer (Story 2.5) and Remove Voyager (Story 2.6) don't exist yet, and the sheet itself is a genuinely new UI pattern (a bottom modal sheet) nothing in this app has built before. Building the full 3-row sheet now means either stubbing two not-yet-real rows or redoing this component twice. This story implements only the single End Voyage control, on the interim full-screen placeholder (not a modal sheet), preserving the spec's most load-bearing behavior — the ceremonial confirm step swapping the same screen's content in place (never a stacked dialog), the exact confirm copy, and the `button-ignition` confirm treatment. The real 3-row modal sheet is Story 2.5/2.6's (or Epic 3's) problem once there's more than one row to justify it.
- **Ended-Voyage read access (RLS) was an explicitly deferred problem from Story 2.1, due now.** `voyages_select_members`/`voyage_members_select_fellow_members` currently route through `is_active_voyage_member()`, which requires `status = 'active'` — the instant this story flips a Voyage's status to `'ended'`, those policies would deny read access to *everyone*, including the Organizer who just ended it and needs to see the Voyage Ended summary. This story fixes it (see Task 1) rather than leaving End Voyage unusable.

## Tasks / Subtasks

- [x] Task 1: `end_voyage()` RPC + the ended-Voyage RLS read-access fix (AC: #1, #2)
  - [x] New migration `supabase/migrations/20260728000000_end_voyage.sql`.
  - [x] **New `is_voyage_participant(p_voyage_id uuid, p_user_id uuid)` function** — same shape/security posture as `is_active_voyage_member()` (Story 2.1: `security definer`, called from the same tables' own RLS policies it queries internally, so must bypass RLS to avoid the established self-recursion pitfall), but **without** the `v.status = 'active'` requirement — checks only that a `voyage_members` row exists for this `(voyage_id, user_id)` with `removed_at is null`. This is deliberately broader than `is_active_voyage_member` (which still means what it always meant: currently-active member of a currently-active Voyage — kept unchanged, still correct where it's used).
  - [x] Dropped and recreated `voyages_select_members` and `voyage_members_select_fellow_members` to call `is_voyage_participant` instead of `is_active_voyage_member`. This is the fix for the interim-scope note above — a participant of an *ended* Voyage can still read it; a stranger still cannot.
  - [x] `end_voyage(p_voyage_id uuid)`: `security definer`, `set search_path = public`, mirrors `start_voyage()`/`join_voyage()`'s established atomic-function shape.
    - Authorization: caller must be an **active organizer** of `p_voyage_id` specifically — not found → `raise exception 'Only the Organizer can end this Voyage.' using errcode = 'END03'`.
    - Not found → `errcode = 'END01'`. Already ended (`status <> 'active'`) → `errcode = 'END02'` (idempotent-tap safety, same reasoning as `join_voyage()`'s ended-code guard). Custom, non-reserved codes matching the `JOIN1`/`JOIN2` precedent from Story 2.3's own code review fix.
    - `update public.voyages set status = 'ended', ended_at = now() where id = p_voyage_id`.
    - **`update public.voyage_members set is_active = false where voyage_id = p_voyage_id and is_active = true`** — releases AD-9's per-user lock for **every** member of this Voyage, not just the Organizer.
    - `select * into strict result from public.voyages where id = p_voyage_id; return result;`
  - [x] `revoke execute on function public.end_voyage(uuid) from public; revoke execute on function public.end_voyage(uuid) from anon;` (both statements — Story 2.1's code review lesson).
  - [x] **Re-confirmed Supabase CLI still 403'd against `voylo-dev`** at the start of this story (same unresolved gap from the last two stories' code reviews) — could not `db push` or live-verify. SQL hand-verified against established patterns instead (see Debug Log).

- [x] Task 2: `get_my_active_voyage()` — "do I currently have one, and which" (AC: #1, #2, prerequisite plumbing)
  - [x] Same migration file. Implemented as a single table-returning function (`returns table (id, destination, status, created_by, created_at, ended_at, join_code, my_role)`), `security invoker` (only ever reads the caller's own row via `auth.uid()`, no cross-user privilege question). **Resolved the judgment call in favor of a single round trip** rather than a second function/query — one `join`, one RPC call, same PostgREST array-shape pattern `get_voyage_preview()` already established.
  - [x] Query joins `voyages`/`voyage_members` on `vm.user_id = auth.uid() and vm.is_active = true and vm.removed_at is null and v.status = 'active'` — the **narrow**, `is_active_voyage_member`-equivalent semantics, not the broadened `is_voyage_participant` from Task 1. AD-9 guarantees at most one row.
  - [x] No new RLS policy needed beyond Task 1's — confirmed.

- [x] Task 3: Repository additions (AC: #1, #2)
  - [x] In `src/repositories/voyage-repository.ts`: `getMyActiveVoyage()` → `{ voyage: Voyage; role: 'organizer' | 'voyager' } | null`, `endVoyage(voyageId: string)` → same `VoyageResult` shape `startVoyage`/`joinVoyage` already return.
  - [x] Tests: mapped-value cases for both, the "no active Voyage" (`null`) case for `getMyActiveVoyage`, and error-passthrough for `endVoyage`. 26/26 repository tests passing (8 new).

- [x] Task 4: `useActiveVoyage` — fetches "do I have one" on session change (AC: #1, #2)
  - [x] New `src/shared/hooks/use-active-voyage.tsx`: `ActiveVoyageProvider`/`useActiveVoyage()`, same fetch-on-`userId`-change pattern as `use-profile.tsx`. Exposes `{ activeVoyage, isLoading, hasError, refetch }` — `refetch` used by `active-voyage.tsx` to re-pull after `end_voyage()` succeeds.
  - [x] Reused `use-profile.tsx`'s established resolved-for-userId pattern for deriving `isLoading` correctly across a userId transition. 7/7 tests passing, including the same-class Story 1.4 regression test.
  - [x] Wrapped `AppNavigator` with `ActiveVoyageProvider` in `_layout.tsx`, alongside `AuthProvider`/`ProfileProvider`/`PendingJoinProvider`.
  - [x] Extended the top-level `isLoading` gate: `isAuthLoading || (!!session && (isProfileLoading || isActiveVoyageLoading))`.

- [x] Task 5: Wire the new routing branch into `_layout.tsx` (AC: #1, #2)
  - [x] `resolveRoute()`'s signature untouched — confirmed still passes its own existing tests unmodified.
  - [x] `route === 'home'` split into **three** mutually-exclusive `Stack.Protected` blocks: `hasActiveVoyage` → `active-voyage`; else `hasPendingJoin` → `voyage-joined`; else → `index`/`settings`. `hasActiveVoyage` takes precedence (`hasPendingJoin` is computed as `!hasActiveVoyage && !!pendingJoinCode`).
  - [x] **Resolved the judgment call: `voyage-ended` is registered unconditionally**, not inside the `active-voyage` guard branch — reasoning: `end_voyage()` success triggers a `refetch()` that clears `activeVoyage`, which would flip the `hasActiveVoyage` guard false and deregister anything inside that branch mid-transition, bouncing the user off `voyage-ended` before they could read it — exactly the class of bug Story 2.3's code review found in `join/[code]`'s original design. All summary data reaches `voyage-ended.tsx` via route params instead, so it never depends on `activeVoyage` staying populated.

- [x] Task 6: Interim `active-voyage.tsx` screen (AC: #1)
  - [x] New `src/app/active-voyage.tsx`. Reads `activeVoyage` from `useActiveVoyage()`, shows "You're on your way to `<destination>`."
  - [x] Organizer-only End Voyage control (`activeVoyage.role === 'organizer'`); confirmed absent for a plain Voyager. Tapping swaps the same screen's content into a confirm view — mockup's exact copy, adapted (the "like Meera's photo" example generalized since no photo-upload feature exists yet in v1).
  - [x] Confirm action uses `IgnitionButton`'s primary (ignition) variant; "Keep going" secondary, no navigation, just swaps back.
  - [x] On confirm: calls `endVoyage`, then `refetch()`, then `router.push('/voyage-ended', { params: {...} })` with destination/createdAt/endedAt/voyagerCount. Failure shows the error inline with "Keep going" still available — never a dead end. 6/6 tests passing.

- [x] Task 7: `voyage-ended.tsx` screen (AC: #2)
  - [x] New `src/app/voyage-ended.tsx`. Calm summary ("Voyage ended." + "5h 30m · 3 Voyagers · Lake Tahoe"), duration computed by a small local `formatDuration` helper, singular/plural "Voyager" handled. Single "Back to Home" action (`IgnitionButton`, secondary).
  - [x] Uses `screenStyles.headline`/`Typography.body` only — no `displayHero`, no gradient/glow, confirmed not a "wow" screen.
  - [x] "Back to Home" routes to `/`. 3/3 tests passing.

- [x] Task 8: Fix the Organizer's pre-existing dead end after starting a Voyage (AC: #1)
  - [x] `src/app/join-code.tsx` had no forward navigation at all — confirmed and fixed: added a "Continue" `IgnitionButton` (primary variant, since it's now the actual forward action) routing to `/`. Existing 3 tests plus 1 new one, 4/4 passing.

- [x] Task 9: Live verification (AC: #1, #2)
  - [x] **Supabase CLI still 403'd against `voylo-dev`** — re-confirmed at the start of this story, same unresolved gap from Stories 2.2/2.3's code reviews. Could not `db push` or live-verify `is_voyage_participant()`, the repointed RLS policies, `get_my_active_voyage()`, or `end_voyage()` against a real database. All hand-verified against established patterns (security definer/invoker postures matched to precedent, atomic single-function writes, explicit anon revokes) instead — **stated plainly here, not presented as equivalent to live verification.** This is the third consecutive story blocked by this same environment issue; flagging again for the user to resolve before any of these three stories' SQL is trusted in production.

## Dev Notes

- **This story's core risk is the same class as Story 2.3's, in a different place: an RLS predicate change that must not silently lock out or open access.** `is_voyage_participant` broadens read access on purpose (ended Voyages must stay readable to their own participants) — verify it does *not* accidentally allow a non-participant to read anything, and that `is_active_voyage_member` (unchanged, still narrower) remains correct wherever it's still used.
- **`end_voyage()`'s two updates (Voyage status + every member's `is_active`) must happen together, atomically, in one function** — exactly the "atomic, single-function write, not client-side multi-step" precedent `start_voyage()`/`join_voyage()` already established. A client-side two-call version risks a Voyage ending while members stay AD-9-locked forever if the second call fails.
- **Read `src/app/join-code.tsx`, `src/app/voyage-joined.tsx`, and `src/app/_layout.tsx` in full before starting** — Task 5/8 both modify or depend precisely on their current behavior (established this session as the highest-risk file in the whole app; Story 1.4's real routing bug and Story 2.3's real navigation bug both lived here).
- **Voyager count needs a source; don't invent a redundant one.** Story 2.3's `get_voyage_preview()` already computes an active-Voyager count for a Voyage by `join_code`; Task 6/7 need the same number for a Voyage the caller already knows the `id` of. Reuse the counting *logic* (a `voyage_members` count query) rather than routing through `get_voyage_preview()` itself (which takes a `join_code`, an awkward fit here) — a small dedicated count, inline in `end_voyage()`'s return or a trivial follow-up query, is enough; don't build new infrastructure for one integer.
- **No Organizer Action Sheet component, no bottom-sheet primitive, no Grant Organizer/Remove Voyager here** — all explicitly out of scope per the interim-scope notes above. Don't build ahead of Stories 2.5/2.6's actual requirements.

### Project Structure Notes

- `supabase/migrations/` gets one new file: `is_voyage_participant()`, two repointed SELECT policies, `end_voyage()`, `get_my_active_voyage()` (and its role-lookup companion if implemented separately).
- `src/repositories/voyage-repository.ts` — `getMyActiveVoyage`, `endVoyage` added, no new file.
- `src/shared/hooks/use-active-voyage.tsx` is a new file, new provider, mounted in `_layout.tsx` alongside the existing three providers.
- `src/app/active-voyage.tsx` and `src/app/voyage-ended.tsx` are new Expo Router routes.
- `src/app/_layout.tsx` — modified: new provider wrapper, `isLoading` gate extended, `home` block split into three mutually-exclusive guarded branches, `voyage-ended` registered (mechanism per Task 5's judgment call).
- `src/app/join-code.tsx` — modified: forward navigation added (Task 8).

### References

- [Source: epics.md#Story-2.4] — acceptance criteria as originally scoped
- [Source: prd.md#FR-6] — functional requirement
- [Source: ARCHITECTURE-SPINE.md#AD-9] — one active Voyage per user; this story is what actually *releases* the lock, not just enforces it
- [Source: EXPERIENCE.md#Information-Architecture] — Organizer Action Sheet / End Voyage confirm / Voyage Ended rows; modal-stacking-capped-at-one-level rule
- [Source: EXPERIENCE.md#Component-Patterns] — `organizer-sheet` component: three rows, row-tap swaps to confirm, `button-ignition` for the End Voyage confirm specifically
- [Source: EXPERIENCE.md#Voice-and-Tone] — exact confirm copy register ("Ready to close out the trip?" not "Are you sure... this cannot be undone")
- [Source: EXPERIENCE.md#State-Patterns] — "End Voyage tapped," "Voyage ended, v1 build" rows (recording stops immediately, in-flight work finishes normally, brief transitional state, calm terminal summary)
- [Source: EXPERIENCE.md#Key-Flows] — UJ-4 step 2 (ceremonial treatment applies to the confirm interaction itself, independent of v1 vs. v1.1's differing destination)
- [Source: DESIGN.md#Components] — `organizer-sheet`, `button-secondary`, `button-destructive`, `button-ignition` token definitions
- [Source: mockups/key-organizer-action-sheet.html] — exact End Voyage confirm copy and layout reference (directional for the interim full-screen treatment, not literal — no modal sheet built here)
- [Source: 2-1-start-a-voyage.md] — `start_voyage()`'s atomic-function shape this story's `end_voyage()` continues; the `voyage_members_one_active_per_user` index this story releases; **its own deferred-work.md entry explicitly naming this story as the owner of the ended-Voyage RLS read-access design**
- [Source: 2-2-generate-share-join-code-link.md] — `join-code.tsx`'s current (dead-end) shape, fixed in Task 8
- [Source: 2-3-join-voyage-via-code-link.md] — `usePendingJoin`/`_layout.tsx` routing precedent this story's `useActiveVoyage`/routing extension directly continues; the `resolveRoute()`-must-stay-pure principle; the Supabase CLI access caveat carried forward unresolved

## Dev Agent Record

### Agent Model Used

Claude Sonnet 5

### Debug Log References

- **Supabase CLI 403'd against `voylo-dev` for the third consecutive story** — checked at the start of this story, same as Stories 2.2/2.3's code reviews found. No `db push`, no live verification of any of this story's four new/changed SQL objects (`is_voyage_participant()`, the two repointed SELECT policies, `get_my_active_voyage()`, `end_voyage()`). This is now a recurring, unresolved environment issue affecting three stories in a row's worth of SQL — worth the user's direct attention before any of it is trusted in production, independent of this story's own completion.
- **`end_voyage()`'s return shape changed mid-implementation.** Originally spec'd/first-implemented as `returns public.voyages` (matching `start_voyage()`/`join_voyage()`'s plain-row precedent), but the Voyage Ended summary (AC2) needs a Voyager count the plain row doesn't carry. Rather than a second RPC or a separate client-side count query, extended `end_voyage()` to a table-returning function (same pattern `get_voyage_preview()`/`get_my_active_voyage()` already established) that computes the count in the same atomic call. Repository/tests updated to the array-returning shape before this was committed anywhere — no intermediate broken state shipped.
- **The `voyage-ended` screen-registration decision (Task 5's flagged judgment call) resolved in favor of "unconditional, params-driven," specifically because of a bug already found and fixed in Story 2.3's code review**: registering it inside the `active-voyage`-guarded branch would have meant `end_voyage()`'s own success path (which calls `refetch()`, clearing `activeVoyage`) deregisters the very screen it's about to navigate to, in the same transition. Learned this from Story 2.3's "tapping Join while authenticated does nothing" finding before writing any code here, not discovered by re-hitting it.
- No new lint or type errors — confirmed via `npm run lint`/`tsc --noEmit` throughout. Same 4 pre-existing `sign-in.tsx:27` `react-hooks/refs` reports, untouched by this story.

### Completion Notes List

- Task 1/2 complete: `is_voyage_participant()`, repointed `voyages_select_members`/`voyage_members_select_fellow_members` policies, `get_my_active_voyage()`, `end_voyage()` — all in `supabase/migrations/20260728000000_end_voyage.sql`. Hand-verified against established security-definer/invoker and atomic-write patterns; **not live-verified** (see Debug Log).
- Task 3 complete: `getMyActiveVoyage`/`endVoyage` repository functions. 26/26 repository tests passing (8 new).
- Task 4 complete: `useActiveVoyage` hook, mirroring `use-profile.tsx`'s proven fetch-on-userId pattern exactly, including its own version of the Story 1.4 isLoading regression test. 7/7 tests passing.
- Task 5 complete: `_layout.tsx`'s `home` guard split into three branches; `voyage-ended` registered unconditionally (see Debug Log for why). `resolveRoute()` itself untouched.
- Task 6 complete: `active-voyage.tsx` — interim placeholder with Organizer-only End Voyage control, in-place confirm swap, ceremonial `button-ignition` confirm treatment. 6/6 tests passing.
- Task 7 complete: `voyage-ended.tsx` — calm, non-hero terminal summary. 3/3 tests passing.
- Task 8 complete: `join-code.tsx`'s pre-existing dead end fixed with a "Continue" action. 4/4 tests passing (1 new).
- Task 9: live verification blocked by the ongoing Supabase CLI access issue — stated plainly, not glossed over.
- Full regression suite: 133/133 tests passing, up from Story 2.3's 108 (25 new: 8 repository, 7 `useActiveVoyage`, 6 `active-voyage`, 3 `voyage-ended`, 1 `join-code` Continue). `tsc --noEmit` clean. `npm run lint`: no new errors.
- **Story 2.4 is code-complete but not live-verified**, the same disclosed limitation as the last two stories, now compounding across three consecutive stories' worth of un-pushed SQL.

### Review Findings

- [x] [Review][Patch] `is_voyage_participant()` is missing the `revoke execute ... from public/anon` statements — reopens the exact anonymous-membership-disclosure vulnerability class Story 2.1's code review already found and fixed for its sibling function `is_active_voyage_member()`, confirmed live at the time [supabase/migrations/20260728000000_end_voyage.sql] — fixed via `supabase/migrations/20260728010000_fix_end_voyage_review_findings.sql` (new forward-only migration, not an edit to the already-shipped one).
- [x] [Review][Patch] `activeVoyage` never refetches after `start_voyage()` or `join_voyage()` succeed elsewhere in the app — the story's headline mechanism (landing on `active-voyage.tsx` to reach End Voyage) is unreachable within a live session [src/app/destination-picker.tsx; src/app/voyage-joined.tsx] — fixed: both now call `useActiveVoyage().refetch()` on success, before navigating onward.
- [x] [Review][Patch] `get_my_active_voyage()` is also missing `revoke` statements [supabase/migrations/20260728000000_end_voyage.sql] — fixed in the same follow-up migration.
- [x] [Review][Patch] `end_voyage()`'s status/authorization checks are not atomic with its updates [supabase/migrations/20260728000000_end_voyage.sql] — fixed: redefined with an atomic `update ... where status = 'active'` as the race-free operation itself (no row lock needed — a losing concurrent call simply matches zero rows and falls into the already-ended branch).
- [x] [Review][Patch] A successful `endVoyage()` followed by a failing `refetch()` strands the user with a false "Something went wrong" message [src/app/active-voyage.tsx; src/shared/hooks/use-active-voyage.tsx] — fixed: `refetch()` now has its own try/catch (never propagates a rejection) and fails open (keeps the last-known-good `activeVoyage` rather than clearing it on a transient error), matching `use-profile.tsx`'s established precedent. This structurally resolves the strand — `await refetch()` in `active-voyage.tsx` can no longer throw.
- [x] [Review][Patch] `voyage-ended.tsx` renders literal "NaN Voyagers"/"NaNh NaNm" if reached with missing or malformed route params [src/app/voyage-ended.tsx] — fixed: both segments are now omitted (not rendered as "NaN") when unparseable.
- [x] [Review][Patch] Dev Agent Record's repository-test count is wrong — claims "13 new" but the diff adds 8 [Dev Agent Record → Task 3, Completion Notes, File List] — corrected throughout.
- [x] [Review][Patch] Task 4's own checkbox is left unchecked while all four of its subtasks are checked and the code is present and working [Tasks/Subtasks → Task 4] — corrected.
- [x] [Review][Defer] `is_voyage_participant`'s broadened read access has no expiry — any never-explicitly-removed past participant retains read access to an ended Voyage's member list indefinitely. Framed here purely as "fixing" Story 2.1's deferred gap without addressing whether indefinite retroactive visibility is the actually-intended long-term policy — a real product-scope question, not a bug, worth the user/PM's attention.

**Dismissed (noise / handled elsewhere / already disclosed):**
- Voyager count in the Voyage Ended summary includes the Organizer — matches Story 2.3's own `get_voyage_preview()` counting convention (no role distinction anywhere else in the app either); not a new inconsistency.
- Empty-string RPC error messages rendering blank (`?? GENERIC_ERROR` doesn't catch `''`) — pre-existing pattern used identically everywhere else in this codebase, already explicitly deferred in Story 1.4's deferred-work.md ("narrow edge case since Supabase/PostgREST errors always populate a real message in practice"); not newly introduced here.
- The initial "End Voyage" button hardcoded `disabled={false}` while confirm-view buttons use `disabled={isSubmitting}` — not actually inconsistent: tapping it only swaps to the confirm view (no async operation), so there's nothing to guard against.
- "Three consecutive stories' SQL never run against a real database" — already extensively disclosed in this story's own interim-scope notes and Debug Log; not a new finding.

### File List

- `supabase/migrations/20260728000000_end_voyage.sql` (new) — `is_voyage_participant()`, repointed RLS policies, `get_my_active_voyage()`, `end_voyage()`
- `src/repositories/voyage-repository.ts` — `ActiveVoyage`/`EndedVoyage` types, `getMyActiveVoyage`, `endVoyage` added (modified)
- `src/repositories/__tests__/voyage-repository.test.ts` — 8 new tests (modified)
- `src/shared/hooks/use-active-voyage.tsx` (new) — `ActiveVoyageProvider`/`useActiveVoyage`
- `src/shared/hooks/__tests__/use-active-voyage.test.tsx` (new)
- `src/app/active-voyage.tsx` (new) — interim placeholder screen + End Voyage control
- `src/app/__tests__/active-voyage.test.tsx` (new)
- `src/app/voyage-ended.tsx` (new) — calm terminal summary screen
- `src/app/__tests__/voyage-ended.test.tsx` (new)
- `src/app/_layout.tsx` — `ActiveVoyageProvider` wired in, `isLoading` gate extended, `home` block split into three branches, `voyage-ended` registered unconditionally (modified)
- `src/app/join-code.tsx` — "Continue" forward action added (modified)
- `src/app/__tests__/join-code.test.tsx` — 1 new test (modified)

### Post-Review Fixes

- Fixed 8 patch findings from parallel adversarial review (Blind Hunter, Edge Case Hunter, Acceptance Auditor). Two findings were independently converged on by multiple reviewers, which is why they're the two most significant: **(1)** `is_voyage_participant()` shipped without the `revoke execute` statements that `end_voyage()` in the same migration correctly got — the exact anon-membership-disclosure bug Story 2.1's code review already found, fixed, and live-verified for the sibling function it was modeled on. **(2)** Nothing anywhere in the app refetched `ActiveVoyageProvider`'s context after `start_voyage()`/`join_voyage()` succeeded, so this story's entire routing mechanism (landing on `active-voyage.tsx` to reach End Voyage) would never have engaged within a live session — only a full app relaunch would have surfaced it. Both are now fixed.
- New forward-only migration `supabase/migrations/20260728010000_fix_end_voyage_review_findings.sql` adds the missing revokes and redefines `end_voyage()` with a race-free atomic status transition (`update ... where status = 'active'` as the operation that settles the race, not a separate locked read) — the original migration was left untouched per this project's established convention, since it's very likely CI already applied it via its own credentials even though the local CLI here remained blocked throughout.
- `use-active-voyage.tsx`'s `refetch()` now has its own error handling and fails open (keeps the last-known-good `activeVoyage` on a transient error rather than clearing it) — this structurally closes the "successful end, failing refetch, false failure message" gap without needing any change to `active-voyage.tsx`'s own logic. `refetch` is also now `useCallback`-memoized (keyed on `userId`) so `voyage-joined.tsx`'s effect can correctly list it as a dependency without extra churn.
- Full regression suite: 139/139 tests passing, up from the pre-review 133 (6 new: 1 `destination-picker` refetch assertion, 2 `voyage-joined` refetch assertions, 1 `use-active-voyage` refetch-rejection case, 2 `voyage-ended` malformed-param cases). `tsc --noEmit` clean. `npm run lint`: no new errors (one patch briefly introduced a `react-hooks/exhaustive-deps` warning, caught by re-running lint before considering the patch done, fixed by memoizing `refetch`'s identity rather than suppressing the warning).
- **Still not live-verified against `voylo-dev`** (same Supabase CLI access blocker, now spanning four stories' worth of SQL across this session) — the new fix migration has the same disclosed limitation as the original.

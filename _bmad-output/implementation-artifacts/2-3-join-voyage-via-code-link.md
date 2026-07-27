---
baseline_commit: 15421bb
---

# Story 2.3: Join Voyage via Code/Link

Status: review

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As any user,
I want to join an active Voyage using a Join Code/Link,
so that I can ride along with the group.

## Acceptance Criteria

1. **Given** I open a valid Join Code/Link, **when** the app loads, **then** I see the Join Invitation screen (locked copy) before any authentication is requested.
2. **When** I tap "Join the Voyage" and complete OTP sign-in, **then** I'm added as a Voyager and land immediately on the live Voyage view.
3. **And** joining after the Voyage has already started is allowed, not an error — I simply appear normally, with my `joined_at` timestamp recorded.
4. **And** if I already belong to another active Voyage, joining this one is blocked (AD-9).

*(Fulfills FR-5; UX-DR20.)*

**🚫 Known interim-scope decisions (not silent gaps — see Dev Notes for full rationale on each):**

- **AC2's "live Voyage view" doesn't exist yet.** Live Map is Epic 3. This story lands on a new interim confirmation screen (`voyage-joined.tsx`) after a successful join instead — same "build what this story needs, let the surrounding flow catch up later" precedent already used for Destination Picker (Story 2.1) and the Join-code card (Story 2.2).
- **No personalized inviter name.** DESIGN.md's mockup shows "Chintan invited you," but no story has ever added a display-name field anywhere in the schema (OTP-only sign-in never collects one). This story uses generic, non-personalized invitation copy. Adding a name-collection flow is out of scope here — flagged for the user/PM to decide if/when it matters.
- **No real per-Voyager avatar/player-color stack.** DESIGN.md's mockup avatar-stack implies the 8-color player-palette system, which doesn't exist in code yet (it's Epic 3/Live Map scope, same as Fun Fact badges). This story may show a simple Voyager count instead (`get_voyage_preview` returns one) — real avatars are deferred with Live Map.
- **AD-10's interim custom-scheme deep link (established in Story 2.2) applies here unchanged** — this story is the actual screen `voylo://join/<code>` resolves to. No new deep-linking gap introduced; carried forward, not re-litigated.

## Tasks / Subtasks

- [x] Task 1: `get_voyage_preview()` — pre-auth, narrow, public-safe Voyage lookup (AC: #1)
  - [x] New migration `supabase/migrations/20260727040000_join_voyage.sql`. `create or replace function public.get_voyage_preview(p_join_code text) returns table (destination text, status text, voyager_count bigint) language sql stable security definer set search_path = public`.
  - [x] **Must be `security definer`** — the existing `voyages_select_members` RLS policy (Story 2.1) only allows *active members* to `select`; an unauthenticated or not-yet-member caller has zero row access otherwise. This function deliberately bypasses RLS to expose a narrow, explicit projection (destination, status, a live count of active `voyage_members` — **not** ids, `created_by`, member identities, or the full row).
  - [x] **Must NOT filter by `status = 'active'`.** AC/EXPERIENCE.md's "Voyage already ended" state pattern requires looking up ended Voyages too (so the client can show "This trip's already wrapped up," not a generic not-found). Look up by `join_code` alone; the client branches on the returned `status`.
  - [x] **Do not add any `grant`/`revoke` statements for this function.** Per this project's established Supabase lesson (Story 2.1 code review): a freshly created function is executable by `anon`/`authenticated`/`service_role` by default on this platform, independent of the `PUBLIC` pseudo-role — that default-open posture is exactly what's wanted here (unauthenticated preview access), so leave it alone. Contrast with `join_voyage()` below, which must be explicitly locked down.
  - [x] No rows returned (invalid/unknown code) is a valid, non-error result — the repository layer maps "no row" to a "this invite link isn't valid" message, not a thrown error.
  - [x] Apply locally via `supabase db push` against `voylo-dev` before relying on CI (same discipline as every prior story). **Note:** the previous story's code review found the Supabase CLI in that session's environment was 403'd against the `voylo-dev` project despite the "Voylo" org being visible — confirm CLI access works before starting, or flag it again if not, same as that finding did. **Re-confirmed still 403'd at the start of this story** — could not `db push` or live-verify; SQL hand-verified against established patterns instead (see Debug Log).

- [x] Task 2: `join_voyage()` — the actual join RPC (AC: #2, #3, #4)
  - [x] Same migration file. `create or replace function public.join_voyage(p_join_code text) returns public.voyages language plpgsql security definer set search_path = public`. Mirrors `start_voyage()`'s established shape (Story 2.1/2.2): one atomic function, no client-side multi-step write, into strict on the final read-back.
  - [x] Guard: `p_join_code` null/blank → `raise exception` (same defensive-input pattern as `start_voyage()`'s destination guard).
  - [x] Look up the Voyage by `join_code` (no status filter, same reasoning as Task 1). Not found → raise a distinct, clear exception (e.g. `'This invite link is not valid.'`). Found but `status <> 'active'` → raise a distinct exception (e.g. `'This trip has already ended.'`) — these must be distinguishable error codes/messages so the client can show the right copy for each (not one generic error).
  - [x] **Idempotent rejoin check, before attempting the insert:** if the caller is already an *active* member of *this exact* Voyage (`voyage_members` row for `voyage_id`+`auth.uid()`, `removed_at is null and is_active = true`), skip the insert entirely and just return the Voyage row. This covers "already authenticated, re-tapping your own invite" (EXPERIENCE.md: tapping join when already authenticated still shows the invitation, but joining shouldn't error just because they're already in) — without this check, the AD-9 unique index below would incorrectly reject it as "already has an active Voyage" (technically true, but *this* Voyage, not a conflicting one).
  - [x] If not already a member: `insert into voyage_members (voyage_id, user_id, role) values (v_voyage_id, auth.uid(), 'voyager')` — **`role = 'voyager'`, not `'organizer'`** (the one substantive difference from `start_voyage()`'s membership insert). Relies on the same `voyage_members_one_active_per_user` partial unique index from Story 2.1 (AD-9) — no new constraint needed.
  - [x] On `unique_violation` from that insert (AD-9 conflict — caller has an active Voyage *elsewhere*): `raise exception 'You already have an active Voyage.' using errcode = 'P0001'` — **reuse `start_voyage()`'s exact message/errcode** so the client can share one "already active elsewhere" error-handling branch across both RPCs rather than duplicating it.
  - [x] `select * into strict result from public.voyages where id = v_voyage_id; return result;` at the end (both the idempotent-rejoin path and the fresh-join path converge here).
  - [x] **Lock this one down, unlike Task 1's function** — authenticated users only: `revoke execute on function public.join_voyage(text) from public; revoke execute on function public.join_voyage(text) from anon;` (both statements — Story 2.1's code review found that revoking from `public` alone left `anon` still able to call it on this platform; don't repeat that gap).
  - [x] Apply and live-verify against `voylo-dev` alongside Task 1 (same migration file, one push). **Could not push/live-verify — same CLI 403 as Task 1.** Flagged for the user; not silently claimed as verified.

- [x] Task 3: Repository additions (AC: #1, #2, #4)
  - [x] In `src/repositories/voyage-repository.ts`, add `VoyagePreview` type (`destination: string; status: 'active' | 'ended'; voyagerCount: number`) and `getVoyagePreview(joinCode: string)`, calling `supabase.rpc('get_voyage_preview', { p_join_code: joinCode })`. **This RPC returns an array** (Postgres table-returning function via PostgREST), unlike `startVoyage`'s single-row RPC — take `data?.[0]`, and treat an empty array as the "invalid code" case (`{ data: null, error: { code: 'not_found', message: ... } }`), not a thrown error.
  - [x] Add `joinVoyage(joinCode: string)`, calling `supabase.rpc('join_voyage', { p_join_code: joinCode })`, returning the same `VoyageResult` shape `startVoyage` already returns (reuse `toVoyage`/`toRepositoryError`, same defensive `!row?.id` check).
  - [x] Export both from `voyageRepository`. Tests: mapped-value cases for both, the empty-array "not found" case for `getVoyagePreview`, and an error-passthrough case for `joinVoyage` (e.g. simulating the AD-9 `P0001` error so a later screen-level test can assert on its message). 16/16 repository tests passing (10 new).

- [x] Task 4: `usePendingJoin` — carries a join code across the auth/onboarding gate (AC: #2)
  - [x] **Why this is needed, precisely:** `_layout.tsx`'s `AppNavigator` gates the *entire* app on `resolveRoute()`'s 4-branch result (`sign-in` / `trust-moment` / `driver-attention-consent` / `home`) via `Stack.Protected`. When an unauthenticated tap on "Join the Voyage" pushes to `/sign-in`, then OTP succeeds, the resulting `hasSession=true` recomputes `route` and — for a first-ever sign-in — cascades through `trust-moment` → `driver-attention-consent` → `home`, exactly like today's existing onboarding flow. Each of those transitions swaps which `Stack.Protected` block is registered, which resets the navigation stack; nothing in a route param or the current screen survives that cascade. The join code has to live somewhere *outside* the navigation stack to survive it.
  - [x] New `src/shared/hooks/use-pending-join.tsx`: a `PendingJoinProvider`/`usePendingJoin()` pair, same minimal Context pattern as `use-auth.tsx` (simplest of the two existing provider hooks — no repository/async logic needed here, just in-memory state). Exposes `{ pendingJoinCode: string | null; setPendingJoinCode: (code: string) => void; clearPendingJoinCode: () => void }`.
  - [x] **Deliberately in-memory only, not persisted (no `AsyncStorage`).** If the app is killed mid-flow (e.g. between tapping Join and finishing OTP), the pending join is simply lost and the user re-opens the same link — deep links are idempotent and re-tappable, so this is a reasonable v1 scope cut, not a real gap. Flag as a judgment call in case a reviewer wants persistence added later.
  - [x] Wrap `AppNavigator` with `PendingJoinProvider` in `_layout.tsx`, same nesting level as `AuthProvider`/`ProfileProvider`. 3/3 tests passing.

- [x] Task 5: Wire the new route into `_layout.tsx` without changing `resolveRoute()`'s signature (AC: #1, #2)
  - [x] **Do not add a "join" branch inside `resolveRoute()` itself.** That function is deliberately pure and directly unit-tested (`resolve-route.test.ts`) specifically because Story 1.4 shipped a real routing bug in this exact area — keep its 4-branch contract exactly as-is. Layer the join-resume decision *on top*, in `AppNavigator`'s JSX, as a second, independent condition.
  - [x] Add `<Stack.Screen name="join/[code]" />` **outside every `Stack.Protected` block** (a plain sibling, like the pattern already used for each screen inside a block, just unwrapped) — this is what makes it reachable "at any auth state" per EXPERIENCE.md's Information Architecture table. A deep link to `/join/<code>` navigates straight there regardless of what `resolveRoute()` would otherwise resolve to; nothing needs to redirect *into* it.
  - [x] Split the existing `route === 'home'` block in two, using `usePendingJoin()`'s value: `Stack.Protected guard={route === 'home' && !!pendingJoinCode}` → registers a new `voyage-joined` screen; `Stack.Protected guard={route === 'home' && !pendingJoinCode}` → registers the existing `index`/`settings` pair unchanged. These two stay mutually exclusive by construction (same invariant `resolveRoute`'s own doc comment already documents for its 4 branches, now spanning these 5).
  - [x] **This gives the "skip OTP if already authenticated" behavior (AC2, EXPERIENCE.md's "Join link opened, already authenticated" row) for free, with no explicit navigation call**: if the user taps Join while already on `route === 'home'`, calling `setPendingJoinCode(code)` alone flips that guard and Expo Router redirects to `voyage-joined` automatically — the exact same mechanism that already drives the existing sign-in → trust-moment → driver-attention-consent → home cascade. Don't add a redundant `router.push`/`router.replace` call for this case.
  - [x] **The unauthenticated case does need an explicit `router.push('/sign-in')`**, unlike the case above — `join/[code]` isn't inside any `Stack.Protected` block, so no guard-flip auto-redirects *away* from it. `sign-in` only enters this via a deliberate push from the join-invitation screen's button handler.

- [x] Task 6: Join Invitation screen (AC: #1, #2, #4)
  - [x] New `src/app/join/[code].tsx` — **note the path: this is `/join/<code>`, distinct from the already-existing `/join-code` route from Story 2.2** (the Organizer's own code-reveal screen). Do not confuse the two; they're unrelated screens with similar names.
  - [x] `useLocalSearchParams<{ code: string }>()`, `useAuth()` for `session`, `usePendingJoin()` for `setPendingJoinCode`. On mount, `voyageRepository.getVoyagePreview(code)` (loading/error/data states, `isMounted` guard per this project's established pattern).
  - [x] Render states: loading (return `null`, matching `_layout.tsx`'s own established loading-gate convention) · invalid code (generic "This invite link isn't valid" copy, no action beyond going Home) · Voyage already ended (EXPERIENCE.md's exact framing: "This trip's already wrapped up," **plus an inline CTA to start their own Voyage**, routing to `/voyage-intro`) · active invitation (the real "hero" state: destination, `voyagerCount`, trust-line reinforcement reusing Trust Moment's established copy register, "Join the Voyage" `IgnitionButton`).
  - [x] Button handler: `setPendingJoinCode(code)`; if `!session`, also `router.push('/sign-in')`. (See Task 5 for why the authenticated case needs no further call.) **Do not call `joinVoyage()` directly from this screen** — that call belongs solely in `voyage-joined.tsx` (Task 7), so there is exactly one code path for completing a join regardless of whether the user just finished OTP or was already signed in.
  - [x] Copy: no personalized inviter name (see the interim-scope note above) and no real avatar stack — reasonable placeholder treatment for the group-presence visual is a judgment call, flagged for review. 5/5 tests passing.

- [x] Task 7: `voyage-joined.tsx` — the single place `join_voyage()` actually gets called (AC: #2, #3, #4)
  - [x] New `src/app/voyage-joined.tsx`. On mount: read `pendingJoinCode` from `usePendingJoin()`; if null (shouldn't normally happen given Task 5's guard, but defensively), redirect Home. Otherwise call `voyageRepository.joinVoyage(pendingJoinCode)`. **Clarification found during implementation:** `clearPendingJoinCode()` is called from the "Continue" button's handler, not immediately when the RPC resolves — clearing it immediately would flip Task 5's guard back to the plain `home` block instantly, bouncing the user off this screen before they ever see the confirmation/error. The RPC result (success or error) is held in local state and shown first; clearing (and the resulting auto-redirect to Home) only happens on the user's own "Continue" tap. Never leaves a stale pending code around either way — just deferred to an explicit user action instead of the RPC's completion instant.
  - [x] Success: interim confirmation copy ("You're on the trip." + destination), single `IgnitionButton` "Continue" → Home. This is the AC2 landing spot until Live Map exists (see interim-scope note).
  - [x] Error (AD-9 conflict, code invalidated between preview and join, etc.): show the error message inline with the same "Continue" path back to Home — never leave the user stuck on a dead-end screen. 5/5 tests passing.

## Dev Notes

- **This story's biggest risk is `_layout.tsx`, not the SQL.** It's the one file that governs which screens the *entire app* can even reach, and Story 1.4's own real, confirmed bug lived in exactly this area (a stale `isLoading` value briefly let the wrong screen open). Tasks 4/5 above are written at high precision specifically to prevent re-deriving this from scratch and reintroducing a similar class of bug. Read `src/app/_layout.tsx` and `src/shared/navigation/resolve-route.ts` in full before touching either.
- **`get_voyage_preview` vs. `join_voyage` have opposite access postures on purpose** — one is deliberately public (pre-auth preview), the other deliberately locked to `authenticated` (the actual state-changing join). Story 2.1's code review already found and fixed the exact failure mode of assuming a `revoke ... from public` alone closes `anon` access on this platform — don't reintroduce that specific gap on `join_voyage()`.
- **`role = 'voyager'` is the one line that actually differs from `start_voyage()`'s membership insert.** Everything else about `join_voyage()`'s shape (security definer, `into strict`, atomic single-function write, AD-9 via the existing unique index) is a direct continuation of `start_voyage()`'s already-established, already-code-reviewed pattern — don't design a new shape from scratch.
- **The idempotent-rejoin check (Task 2) is easy to skip and would produce a confusing bug if skipped**: without it, an already-authenticated user re-opening their own invite link would hit the AD-9 unique-violation branch and see "You already have an active Voyage" — true, but misleading, since the "conflicting" Voyage is the one they're trying to join. Test this case explicitly.
- **Display name / avatar-stack gaps are real product gaps, not implementation gaps** — flagged prominently above rather than either silently building a fake name/color system or silently under-delivering against the mockup without saying so. Same transparency precedent as Story 2.2's AC5 domain gap and Story 1.2's Resend domain gap.
- **No `useVoyage`/shared Voyage-state provider built here either** — same reasoning Story 2.1/2.2 already used: nothing yet needs Voyage state shared across screens beyond what navigation params / the two repository calls in this story already carry.

### Project Structure Notes

- `supabase/migrations/` gets one new file: `get_voyage_preview()` + `join_voyage()`, both new functions, no schema/table changes.
- `src/repositories/voyage-repository.ts` — two new functions, one new type, no new file.
- `src/shared/hooks/use-pending-join.tsx` is a new file, new provider, mounted in `_layout.tsx` alongside `AuthProvider`/`ProfileProvider`.
- `src/app/join/[code].tsx` is a new Expo Router dynamic route (new `join/` subfolder under `src/app/`).
- `src/app/voyage-joined.tsx` is a new Expo Router route.
- `src/app/_layout.tsx` — modified: new provider wrapper, new always-on `Stack.Screen`, existing `home` block split into two mutually-exclusive guarded blocks. `src/shared/navigation/resolve-route.ts` is explicitly **not** modified (see Dev Notes).

### References

- [Source: epics.md#Story-2.3] — acceptance criteria as originally scoped
- [Source: prd.md#FR-5] — functional requirement
- [Source: ARCHITECTURE-SPINE.md#AD-9] — one active Voyage per user; this story's actual second real enforcement point (`start_voyage()` was the first)
- [Source: ARCHITECTURE-SPINE.md#AD-10] — universal/app-link requirement; this story's screen is what the interim custom-scheme link (Story 2.2) resolves to
- [Source: EXPERIENCE.md#Information-Architecture] — "Join Invitation" row: reached via deep link at any auth state, the "luring" second aha
- [Source: EXPERIENCE.md#State-Patterns] — "Join link opened, unauthenticated/already authenticated/Voyage already ended" rows — the three distinct states this story's screen must handle
- [Source: EXPERIENCE.md#Key-Flows] — UJ-2 (Meera joins): the full unauthenticated-join-through-onboarding sequence this story's routing must support
- [Source: DESIGN.md#Components] — "Join Invitation" row: hero treatment, avatar-stack intent (not fully buildable yet — see interim-scope notes), `display-hero` typography, `button-ignition` accept action
- [Source: mockups/key-join-invitation.html] — exact visual reference (avatar stack, eyebrow, trust-line reinforcement, accept button) — treat as directional, not literal, given the personalization/avatar gaps
- [Source: 2-1-start-a-voyage.md] — `start_voyage()`'s established shape (security definer, `into strict`, atomic single-function write) this story's `join_voyage()` directly continues; AD-9's unique index, created there, reused here unchanged
- [Source: 2-2-generate-share-join-code-link.md] — `join_code` column/generation this story reads from; the `voyages_select_members` RLS gap this story's `get_voyage_preview()` was explicitly flagged there as needing to fill; the Supabase CLI 403 access issue found in that story's code review, worth re-checking before this story's Task 1
- [Source: src/app/_layout.tsx, src/shared/navigation/resolve-route.ts] — read in full during story creation; current 4-branch gate shape and the Story 1.4 bug precedent that motivates Task 4/5's precision

## Dev Agent Record

### Agent Model Used

Claude Sonnet 5

### Debug Log References

- **Supabase CLI still 403'd against `voylo-dev`** — re-checked at the start of this story (same finding as Story 2.2's code review: the CLI session is authorized for a different org's projects, 403 on the actual Voylo project despite the "Voylo" org itself being visible via `supabase orgs list`). Could not `supabase db push` or live-verify `get_voyage_preview()`/`join_voyage()` against the real database. Both functions were hand-verified against this project's own established SQL patterns instead (same `security definer`/`into strict`/atomic-function shape as `start_voyage()`, same anon-revoke discipline as its code review fix) rather than silently claimed as live-tested. Flagging again for the user to resolve CLI access before this migration is pushed (locally or via CI).
- **`voyage-joined.tsx`'s `clearPendingJoinCode()` timing** — the task text said to clear "regardless of outcome," which read at first like "clear it the moment the RPC resolves." Implementing that literally would have flipped `_layout.tsx`'s `route === 'home' && pendingJoinCode` guard back to the plain `home` block instantly, unregistering `voyage-joined` and bouncing the user off the confirmation/error screen before they could read it. Corrected during implementation: the RPC still only runs once (guarded by a `hasStarted` ref against re-renders), and the result is held in local state; `clearPendingJoinCode()` moved to the "Continue" button's `onPress` instead, so the auto-redirect back to Home only fires once the user dismisses the screen themselves.
- **Two RNTL testing gaps hit, both handled by removing the specific test rather than adding new mocking infrastructure:** `expo-router`'s `<Redirect>` throws `"Couldn't find a navigation object"` when rendered outside a real `NavigationContainer` — this codebase has no established pattern for that yet (confirmed `join-code.tsx`'s own equivalent params-guard, from the last story's code review, is untested for the same reason). Both `voyage-joined.tsx`'s and `join/[code].tsx`'s guard-redirect paths are therefore implemented but not directly unit-tested; low-risk, single-condition guards, flagged rather than silently skipped. Separately, `IgnitionButton`'s primary variant (a `Pressable`, unlike its `secondary` variant's plain `Text`) doesn't expose a directly callable `.props.onPress` the way `join-code.tsx`'s tests assumed for its `Text`-based buttons — switched to RNTL's `fireEvent.press(...)`, matching the convention already used elsewhere in this same test file suite for consistency.
- No new lint or type errors — confirmed via `npm run lint`/`tsc --noEmit`. Same 4 pre-existing `sign-in.tsx:27` `react-hooks/refs` reports (one rule/line, duplicate-reported by the linter), untouched by this story.

### Completion Notes List

- Task 1 complete: `get_voyage_preview()` — pre-auth, security-definer, no-status-filter lookup, deliberately left with no explicit grant/revoke (open-by-default posture per Story 2.1's established Supabase lesson).
- Task 2 complete: `join_voyage()` — mirrors `start_voyage()`'s atomic shape, `role = 'voyager'`, idempotent-rejoin guard, AD-9 conflict reuses `start_voyage()`'s exact `P0001` error, locked to `authenticated` via explicit `public` + `anon` revokes. **Neither function could be pushed/live-verified this session — see Debug Log.**
- Task 3 complete: `voyageRepository.getVoyagePreview`/`joinVoyage` added, array-vs-single-row RPC shape difference handled explicitly. 16/16 repository tests passing (10 new).
- Task 4 complete: `usePendingJoin` — minimal in-memory Context/Provider, same shape as `use-auth.tsx`. 3/3 tests passing.
- Task 5 complete: `_layout.tsx` wired — `PendingJoinProvider` added, `home` block split into two mutually-exclusive guarded blocks, `join/[code]` registered unconditionally outside all `Stack.Protected` blocks. `resolveRoute()` itself untouched (still 4-branch, still passes its own existing tests unmodified).
- Task 6 complete: `src/app/join/[code].tsx` — loading/invalid/ended/active states, generic non-personalized copy (no display-name field exists anywhere in the schema), Voyager-count line instead of a real avatar stack. 5/5 tests passing.
- Task 7 complete: `src/app/voyage-joined.tsx` — the single call site for `join_voyage()` regardless of which path (fresh OTP vs. already-authenticated) led here; `clearPendingJoinCode()` timing corrected during implementation (see Debug Log). 5/5 tests passing.
- Full regression suite: 101/101 tests passing, up from Story 2.2's 78 (23 new: 10 repository, 3 `usePendingJoin`, 5 `voyage-joined`, 5 `join/[code]`). `tsc --noEmit` clean. `npm run lint`: no new errors.
- **Story 2.3 is code-complete but not live-verified.** AC1–AC4 are implemented per the story's design; the interim-scope decisions (no Live Map yet, no personalized name, no real avatar stack, AD-10's custom-scheme link) are all disclosed above, not silent gaps. The one open item is the Supabase CLI access blocker preventing `db push`/live verification of the two new SQL functions this session — flagged prominently, not glossed over.

### File List

- `supabase/migrations/20260727040000_join_voyage.sql` (new) — `get_voyage_preview()` + `join_voyage()`
- `src/repositories/voyage-repository.ts` — `VoyagePreview` type, `getVoyagePreview`, `joinVoyage` added (modified)
- `src/repositories/__tests__/voyage-repository.test.ts` — 10 new tests (modified)
- `src/shared/hooks/use-pending-join.tsx` (new) — `PendingJoinProvider`/`usePendingJoin`
- `src/shared/hooks/__tests__/use-pending-join.test.tsx` (new)
- `src/app/join/[code].tsx` (new) — Join Invitation screen
- `src/app/__tests__/join-invitation.test.tsx` (new)
- `src/app/voyage-joined.tsx` (new) — interim post-join confirmation / pending-join resolver
- `src/app/__tests__/voyage-joined.test.tsx` (new)
- `src/app/_layout.tsx` — `PendingJoinProvider` wired in, `home` block split, `join/[code]` registered unconditionally (modified)

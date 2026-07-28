---
baseline_commit: d8f5e72f3273877b0f570fd9fe6924847f5e6834
---

# Story 3.4: Driver-Safety Role Switch

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a driver,
I want to mark myself as Driving,
so that Voylo knows to keep my screen hands-off.

## Acceptance Criteria

1. **Given** I land on Live Map for the first time this Voyage, **when** the role prompt appears, **then** I can pick Riding or Driving (skippable, defaults to Riding).
2. **And** I can switch anytime with one tap on my status pill, no confirmation dialog.
3. **And** in v1 there are no manual controls yet for Driving mode to remove (Fun Fact capture is v1.1) — this story establishes the role mechanism and persisted state that v1.1's controls will respect from day one.

*(Fulfills UX-DR15, UX-DR25.)*

## Tasks / Subtasks

- [x] Task 1: Database — `travel_role` column, `set_travel_role()` RPC, extend `get_voyage_members()` (AC: #1, #2)
  - [x] New migration file `supabase/migrations/20260801000000_driver_safety_role_switch.sql` (never edit an already-shipped migration; this is a brand-new forward-only file).
  - [x] `alter table public.voyage_members add column travel_role text check (travel_role in ('riding', 'driving'));` — **nullable, no default.** This is a deliberate difference from `player_color` (Story 3.2), which *does* get assigned at insert time via `assign_player_color()`. `travel_role` must NOT be assigned at insert time — `null` is the correct, meaningful initial state: it's what the client reads to know "this Voyager hasn't landed on Live Map yet this Voyage, show them the prompt." Do not copy the player_color insert-time-assignment pattern here.
  - [x] Do not touch `start_voyage()`/`join_voyage()` — they don't need to reference `travel_role` at all; new rows get `null` for it automatically since it has no default.
  - [x] New RPC, structurally almost identical to `upsert_location()` (Story 3.2, same file) — find the caller's own active-membership row for the Voyage, then write:
    ```sql
    create or replace function public.set_travel_role(p_voyage_id uuid, p_travel_role text)
    returns void
    language plpgsql
    security definer
    set search_path = public
    as $$
    declare
      v_voyage_member_id uuid;
    begin
      select id into v_voyage_member_id
      from public.voyage_members
      where voyage_id = p_voyage_id
        and user_id = auth.uid()
        and removed_at is null
        and is_active = true;

      if v_voyage_member_id is null then
        raise exception 'You are not an active member of this Voyage.' using errcode = 'ROL01';
      end if;

      update public.voyage_members
      set travel_role = p_travel_role
      where id = v_voyage_member_id;
    end;
    $$;

    revoke execute on function public.set_travel_role(uuid, text) from public;
    revoke execute on function public.set_travel_role(uuid, text) from anon;
    ```
    No separate application-level validation of `p_travel_role` — the column's own `check` constraint is the authoritative guard (a bad value raises a Postgres constraint-violation error), and the client's TS type already restricts callers to the two valid literals. This one function serves BOTH the first-landing prompt's choice AND every later status-pill tap — don't write a second RPC for the pill switch.
  - [x] Extend `get_voyage_members()` (already extended once for `player_color` in Story 3.2's migration) to also return `travel_role` as a 6th output column. **Critical gotcha already hit once this session:** `create or replace function` cannot change a function's return-column set — Postgres requires `drop function if exists public.get_voyage_members(uuid);` immediately before the `create or replace function` statement, in the same migration file. Do this or the migration will fail outright.
    ```sql
    drop function if exists public.get_voyage_members(uuid);

    create or replace function public.get_voyage_members(p_voyage_id uuid)
    returns table (
      user_id uuid,
      display_name text,
      role text,
      joined_at timestamptz,
      player_color text,
      travel_role text
    )
    language plpgsql
    security definer
    set search_path = public
    as $$
    begin
      if not public.is_voyage_participant(p_voyage_id, auth.uid()) then
        raise exception 'You are not a participant of this Voyage.' using errcode = 'MEM01';
      end if;

      return query
        select vm.user_id, p.display_name, vm.role, vm.joined_at, vm.player_color, vm.travel_role
        from public.voyage_members vm
        left join public.profiles p on p.user_id = vm.user_id
        where vm.voyage_id = p_voyage_id
          and vm.is_active = true
          and vm.removed_at is null
        order by vm.joined_at asc;
    end;
    $$;

    revoke execute on function public.get_voyage_members(uuid) from public;
    revoke execute on function public.get_voyage_members(uuid) from anon;
    ```
  - [x] No new RLS policy needed on `voyage_members` for direct client writes — there was never one for `player_color` either; all writes go through `set_travel_role()` (`security definer`), matching this project's "every Voyage-scoped write goes through an authorizing RPC, never a direct client table write" convention.

- [x] Task 2: Repository layer (AC: #1, #2)
  - [x] `src/repositories/voyage-repository.ts`: add `travelRole: 'riding' | 'driving' | null` to the `VoyageMember` type, `travel_role: 'riding' | 'driving' | null` to `VoyageMemberRow`, and map it in `toVoyageMember()`. **Naming note:** `VoyageMember.role` already exists and means the *membership* role (`'organizer' | 'voyager'`) — `travelRole` is a deliberately different name for a completely different concept (Driving/Riding safety state). Do not conflate or rename the existing `role` field.
  - [x] Add `setTravelRole(voyageId: string, travelRole: 'riding' | 'driving'): Promise<{ error: RepositoryError | null }>` calling the `set_travel_role` RPC with `{ p_voyage_id: voyageId, p_travel_role: travelRole }`, same `{ error }`-only return shape as `upsertLocation`. Export it from the `voyageRepository` object.

- [x] Task 3: Role prompt on first Live Map landing (AC: #1)
  - [x] In `src/app/active-voyage.tsx`, derive (no new state needed beyond what already exists): `const myMember = members.find((m) => m.userId === session?.user.id);` and `const showRolePrompt = !!myMember && myMember.travelRole === null;`. This is correctly `false` before `members` has ever loaded (`myMember` is `undefined` while `members` is still `[]`), so no separate "members loaded" flag is needed.
  - [x] Render as a centered card overlay on top of the map — same visual shape as the existing `marker-peek-card`/`peekScrim` overlay (semi-transparent scrim + centered card), **not** a full early-return screen swap like End Voyage confirm/Remove Voyager confirm. This matches DESIGN.md's framing of the prompt as something a Voyager sees while arriving at Live Map, not a screen that replaces it.
  - [x] Exactly two large tap targets — "Riding" and "Driving" — no separate third "Skip" button. DESIGN.md calls this a "two-large-tap-target prompt"; tapping "Riding" *is* the skip-equivalent action (AC #1's "skippable, defaults to Riding" is satisfied by Riding being one of the two direct choices, not a third option). Both meet the standard ≥44pt(iOS)/48dp(Android) tap-target floor already established site-wide (EXPERIENCE.md) — this is not the Fun Fact control's special `[ASSUMPTION: ≥60pt/dp]` floor, that's unrelated v1.1 scope.
  - [x] `handleSetTravelRole(role: 'riding' | 'driving')`: call `voyageRepository.setTravelRole(voyageId, role)`, then on success `await loadMembers.current(voyageId)` — same "call RPC, then re-fetch the roster" pattern already used by `handleGrantOrganizer`/`handleRemoveVoyager`. Once `members` refreshes, `myMember.travelRole` becomes non-null and `showRolePrompt` naturally goes false — no separate dismiss flag needed. Guard against double-submission with an `isTogglingRole` boolean (disable both buttons while true), and surface a failure via a new `roleError` state (reuse `screenStyles.error`), matching the existing `removeError`/`membersError` pattern. On failure, leave the prompt showing so the Voyager can retry. Implemented as a single shared handler used by both the prompt (Task 3) and the pill (Task 4), rather than two separate functions, as explicitly permitted below.
  - [x] Confirmed: this prompt is not added to the 1s ticker's pause condition (`if (showOrganizerMenu || showConfirm || removeTarget) return;`) — matches the existing peek-card precedent, not the three full-screen-swap decision moments.

- [x] Task 4: Status pill becomes a live, tappable Riding/Driving switch (AC: #2)
  - [x] The `testID="status-pill"` element (`active-voyage.tsx`, currently a static `View` hardcoding the label "Riding") becomes a `Pressable`. Label: `myTravelRole === 'driving' ? 'Driving' : 'Riding'` (treat `null` the same as `'riding'` for display, matching AC #1's "defaults to Riding").
  - [x] Visual state already has design tokens waiting, unused, from Story 3.2 (`src/constants/design-tokens.ts`'s `StatusPill.riding`/`StatusPill.driving` — the `driving` variant was deliberately pre-built then but never rendered, per its own code comment: "Story 3.2 only ever renders the riding variant... Story 3.4 owns the real Driving/Riding mechanism"). Swap `backgroundColor`/`borderColor`/label `color` between `StatusPill.riding.{background,borderColor,foreground}` and `StatusPill.driving.{background,foreground}` based on `myTravelRole`. Do not invent new colors.
  - [x] Driving state also needs the glow called for in DESIGN.md ("solid, glowing `accent-electric` fill"). `StatusPill.driving.glowColor` already exists (`` `${Colors.accentElectric}55` ``, hex-alpha convention). Applied the exact same way `JoinCodeCard`'s glow is already consumed in `src/app/join-code.tsx` (lines ~116-120): `shadowColor: StatusPill.driving.glowColor`, `shadowOffset: { width: 0, height: 0 }`, `elevation: 8`, `shadowOpacity: 1`, `shadowRadius: 14` (judgment call, smaller than `JoinCodeCard`'s hero-card `40`).
  - [x] `handleSetTravelRole()` (shared with Task 3): pill's `onPress` flips `myTravelRole === 'driving' ? 'riding' : 'driving'`, calls `setTravelRole` + `loadMembers.current(voyageId)`. **No confirmation dialog** — explicit, hard AC requirement, unlike End Voyage/Remove Voyager which *do* confirm. Pill is `disabled={isTogglingRole}` mid-request (a real guard, not just visual).

- [x] Task 5: Fix the two pre-existing hardcoded "Riding" placeholders (AC: #2, #3)
  - [x] Two places in `active-voyage.tsx` currently hardcode `member.role === 'organizer' ? 'Organizer' : 'Riding'` — written this way in Story 3.2 before `travel_role` existed, and now factually wrong for any real Driving-role Voyager once this story ships:
    - `hudBottomRole` (bottom roster list, ~line 511)
    - `peekStatus` (marker peek card, ~line 544)
  - [x] Both become `member.role === 'organizer' ? 'Organizer' : (member.travelRole === 'driving' ? 'Driving' : 'Riding')`. This preserves the existing (Story 3.2) precedence of showing "Organizer" over travel role unchanged — that precedence isn't part of this story's AC and shouldn't be second-guessed, just fed real data. `null`/`'riding'` both render "Riding," same reasoning as Task 4.

- [x] Task 6: Tests (AC: #1, #2, #3)
  - [x] `voyage-repository.test.ts`: `setTravelRole` calls the `set_travel_role` RPC with the right args and returns `{ error }`; `getVoyageMembers`'s row-mapping includes `travelRole` (including the `null` case).
  - [x] `active-voyage.test.tsx`: role prompt renders when the signed-in user's own `travelRole` is `null` and does not render once it's resolved; tapping "Riding"/"Driving" in the prompt calls `setTravelRole` with the right value and re-fetches members; the status pill renders the correct label/visual state for both `riding` and `driving`, is tappable, calls `setTravelRole` with the *opposite* of the current value with no confirmation step, and is disabled mid-request; `hud-bottom`'s roster rows and the marker peek card both show "Driving" for a Driving-role member instead of the old hardcoded "Riding". Also added an inline-error-on-failure test for the role prompt, matching the existing `removeError`/`membersError` coverage pattern.
  - [x] Updated the existing mocked `voyageRepository.getVoyageMembers` fixtures in `active-voyage.test.tsx` to include a `travelRole` field on every member fixture.

- [x] Task 7: Live verification (AC: #1, #2)
  - [x] Same standard as every prior story this session: attempt via EAS CLI/physical device, disclose plainly if blocked (this has been blocked for 8 consecutive stories; expect the same). Nothing about this story is background-execution-dependent like Story 3.3, so if a live build is ever available this one is easy to hand-verify: land on Live Map, confirm the prompt, pick a role, confirm the pill updates instantly with no confirmation dialog, confirm re-opening the app later doesn't re-show the prompt.

### Review Findings

- [x] [Review][Patch] Role-prompt "Driving" button fails the story's own tap-target-floor requirement — Task 3's own checked-off subtask requires "exactly two large tap targets... both meet the standard ≥44pt(iOS)/48dp(Android) tap-target floor." The "Riding" button uses `IgnitionButton`'s default `primary` variant (`minHeight: ButtonIgnition.minHeight` = 56, confirmed in `src/shared/components/ignition-button.tsx`), but "Driving" uses `variant="secondary"`, which renders as a bare `<Text>` with only `padding: Spacing['3']` and no `minHeight` at all — the same de-emphasized/dismissive treatment used everywhere else in this codebase for "Cancel"/"Keep going"/"Retry," not a peer-weight choice. Confirmed by reading `ignition-button.tsx` directly: `secondary`'s only sizing is `padding`, no `minHeight`/`minWidth`. Not caught by the added tests, which only assert the buttons exist and fire `onPress`, not their size/variant. Fixed: dropped `variant="secondary"` from the "Driving" button so both use the default `primary` variant; added a regression test asserting both resolve to a real Pressable's host type, not a plain `Text`. [src/app/active-voyage.tsx, role-prompt buttons]

- [x] [Review][Patch] `set_travel_role()` has no guard against `p_travel_role = null` — the column's `check` constraint (the RPC's sole documented validation layer) is satisfied trivially by `NULL` per SQL semantics, so any authenticated active member can call the RPC directly (bypassing the TS type system entirely, e.g. via raw PostgREST) with `p_travel_role: null` and silently reset their own `travel_role` back to `null` — re-triggering their own role prompt, contradicting the migration's own documented "never write back to null" invariant. Fixed directly in the same migration file (never applied anywhere yet this session, same reasoning as Story 3.2's in-place `drop function if exists` fix): added an explicit `if p_travel_role is null then raise exception ... errcode = 'ROL02'; end if;` guard before the membership lookup. [supabase/migrations/20260801000000_driver_safety_role_switch.sql]

- [x] [Review][Patch] Status pill's `accessibilityLabel` describes the next action, never the current state — `accessibilityLabel={myTravelRole === 'driving' ? 'Switch to Riding' : 'Switch to Driving'}` on the `Pressable` overrides the accessible name a screen reader would otherwise derive from the child `<Text>` ("Riding"/"Driving"). A VoiceOver/TalkBack user can never hear their actual current travel role from this control — only where the next tap leads — a real gap for DESIGN.md's "single most safety-critical control... unmissable at a glance... to the Voyager themselves." Fixed: `accessibilityLabel` now announces current state ("Riding"/"Driving"); the "switch to X" framing moved to `accessibilityHint`, which doesn't override the accessible name. Regression test added. [src/app/active-voyage.tsx, status pill]

- [x] [Review][Patch] A pill-triggered (post-prompt) `setTravelRole` failure is silently swallowed — `roleError` is only ever rendered inside the `showRolePrompt` overlay's card. Once a Voyager has already resolved their role (the common case — the prompt is gone permanently for that Voyage), a failed status-pill tap sets `roleError` in state but nothing on screen shows it: `isTogglingRole` resets, the pill silently reverts, and the user gets zero feedback that the switch didn't apply. No test exercises this path (the existing failure test only presses the prompt's button, not the pill). Fixed: wrapped the pill in a new `statusPillWrapper` and added a small inline error `<Text testID="status-pill-error">` shown whenever `roleError` is set and the prompt is not (the prompt's own inline error already covers that case). Regression test added, exercising the pill (not the prompt) failure path. [src/app/active-voyage.tsx, `handleSetTravelRole`]

- [x] [Review][Defer] `handleSetTravelRole` has no `catch` for a genuine thrown exception (not an `{error}`-shaped RPC response) [src/app/active-voyage.tsx] — deferred, pre-existing pattern: `handleGrantOrganizer`/`handleRemoveVoyager` in this exact file have the identical `try { ... } finally { ... }` shape with no `catch`, already reviewed and accepted in prior stories. Fixing only the new handler would leave the file internally inconsistent; worth a single hardening pass across all three mutation handlers in a future story, not a piecemeal fix here.

- [x] [Review][Defer] `activeVoyage!.voyage.id` non-null assertion inside `handleSetTravelRole` [src/app/active-voyage.tsx] — deferred, pre-existing pattern identical to `handleGrantOrganizer`/`handleRemoveVoyager`'s own `activeVoyage!.voyage.id` reads after their own `await` points. Same reasoning as above — a consolidated fix across all three call sites, not one in isolation.

- [x] [Review][Defer] No synchronous (ref-based) guard against a double-tap issuing two concurrent `set_travel_role` calls before React's `disabled` prop re-renders [src/app/active-voyage.tsx, status pill] — deferred, pre-existing pattern: `handleGrantOrganizer`'s per-row `disabled={grantingUserIds.has(...)}` and `handleRemoveVoyager`'s `disabled={isRemoving}` are the same state-based (not synchronous) guard. Worst case here is a transient visual inconsistency that self-corrects on the next roster fetch, not data corruption (the last server-side write always wins).

- [x] [Review][Defer] Role-prompt scrim has no `accessibilityViewIsModal`, so a screen reader could navigate past it to reach the status pill underneath while the prompt is showing [src/app/active-voyage.tsx, role-prompt overlay] — deferred, pre-existing gap in the `peekScrim`/`peekCard` pattern this prompt deliberately reuses (the marker peek card has the identical gap already). Worth fixing both overlays together in a future accessibility-focused pass, not just the new one.

- [x] [Review][Defer] No client-side timeout on the `set_travel_role` round trip — if it never resolves, the pill/prompt stay disabled for the rest of the session with no retry path [src/app/active-voyage.tsx] — deferred, universal pattern: no RPC call anywhere in this codebase (`upsertLocation`, `endVoyage`, `grantOrganizerStatus`, etc.) has a client-side timeout either. Not specific to this story.

## Dev Notes

- **`role` vs `travel_role` — do not confuse these.** `voyage_members.role` (`'organizer' | 'voyager'`) is the *membership* role from Epic 2 (Grant Organizer Status, etc.) — completely unrelated to this story. This story's new column is named `travel_role` in the DB / `travelRole` in TS specifically to avoid colliding with the existing name. [Source: `supabase/migrations/20260726190000_create_voyages.sql`, `src/repositories/voyage-repository.ts`'s existing `VoyageMember.role`]
- **`travel_role` is nullable with no default — this is intentional and different from `player_color`'s pattern.** `null` is a real, meaningful state ("hasn't landed on Live Map yet this Voyage") that the client reads to decide whether to show the role prompt. Resolving it (by picking a role, or by the prompt's own "Riding" option acting as the skip) always writes an explicit `'riding'` or `'driving'` — it should never be written back to `null`. Read the full reasoning already worked out for this: a per-app-session-only "have I shown the prompt" flag (like Story 3.1's `hasCompletedPriming`, which resets on every provider remount) is the *wrong* shape here, because Story 3.3 already made background tracking outlive the app being backgrounded, and this screen legitimately remounts when the user returns to a backgrounded app mid-Voyage — an in-memory-only flag would wrongly re-show the prompt every time. Persisting the resolution in the DB (via the nullable column itself) is what makes "first time this Voyage" actually mean "first time," not "first time since the screen last mounted."
- **Only the current user's own `travel_role` matters for any decision-gating logic in this story** (whether to show the prompt, what the pill shows) — but `get_voyage_members()` returns `travel_role` for *every* member, not just the caller, because the roster list and peek card (Task 5) display each Voyager's status too, per the mockup (`key-live-map.html`'s `roster-role`/`peek-status` elements already show per-Voyager Riding/Driving labels). Don't build a second, narrower "my own role only" RPC — the existing full-roster fetch (`loadMembers`, already called on mount and after every mutation) is the single source of truth for both uses.
- **Read `src/app/active-voyage.tsx` in full before touching it.** It's a large, established file with several already-tuned interaction details this story must not regress: the `loadMembers.current(id)` ref-wrapped fetch pattern (used by every mutation handler to refresh the roster post-write), the `isMounted` ref guard on async callbacks, the 1s ticker's pause condition, and the existing full-screen-swap overlays (`removeTarget`/`showConfirm`/`showOrganizerMenu`) that this story's new role-prompt overlay must coexist with but not copy the shape of (see Task 3's ticker-gate note — the role prompt is peek-card-weight, not full-screen-swap-weight).
- **`StatusPill.driving`'s design tokens already exist and are unused** (`src/constants/design-tokens.ts`) — Story 3.2 deliberately pre-built them and left them unrendered, with its own code comment saying so. This story is what activates them; don't redefine or duplicate them.
- **This story does not touch `use-location-tracking.tsx` or `background-location-task.ts` (Story 3.3) at all.** Location tracking is unaffected by travel role in v1 — per AC #3, there are no manual controls yet to gate behind the Driving role. Don't add a role-based branch to the location-tracking hook; that's not what this story is.
- **EAS-CLI/physical-device access has been blocked for 8 consecutive stories this session** (Story 3.1 through 3.3) — expect the same for Task 7; disclose plainly rather than assume success, same as every prior story.

### Project Structure Notes

- New migration file: `supabase/migrations/20260801000000_driver_safety_role_switch.sql`.
- `src/repositories/voyage-repository.ts` — modified: `VoyageMember`/`VoyageMemberRow` gain `travelRole`/`travel_role`; new `setTravelRole()` export.
- `src/app/active-voyage.tsx` — modified: new role-prompt overlay + handler, status pill becomes interactive, two hardcoded "Riding" strings become real.
- `src/repositories/__tests__/voyage-repository.test.ts`, `src/app/__tests__/active-voyage.test.tsx` — modified.
- No new files besides the migration — everything else is an extension of Story 3.2's existing surface area.

### References

- [Source: epics.md#Story-3.4] — acceptance criteria as scoped; confirms no manual Driving-mode controls exist yet in v1 (Fun Fact capture is v1.1) — this story is the mechanism/persisted-state only
- [Source: epics.md#Epic-3 UX-DR15, UX-DR25] — `status-pill` as "the single most safety-critical control," 48×48px minimum, no confirmation dialog on toggle; self-declared (not sensor-based) role, changeable anytime
- [Source: ux-designs/ux-trips-2026-07-25/EXPERIENCE.md#Driver-Safety-Interaction-Model] — full mechanism spec: self-declared per-Voyage role set on first Live Map landing, two-large-tap-target skippable prompt defaulting to Riding, status-pill switch with no confirmation, consent-based (not technical) enforcement rationale
- [Source: ux-designs/ux-trips-2026-07-25/DESIGN.md#Components "Role-switch pill"] — `status-pill` token/visual-state spec (riding = neutral pill, driving = solid glowing `accent-electric` fill), confirms Ships: v1
- [Source: ux-designs/ux-trips-2026-07-25/mockups/key-live-map.html] — confirms per-Voyager (not just self) Riding/Driving labels appear in both the bottom roster list and the marker peek card
- [Source: architecture/architecture-trips-2026-07-25/ARCHITECTURE-SPINE.md] — `voyage_members` ER shape (confirms `role` is already taken by the organizer/voyager membership concept, motivating the `travel_role` naming); AD-1's "every Voyage-scoped write through an authorizing RPC" convention
- [Source: 3-2-real-time-voyager-map.md, `supabase/migrations/20260731000000_live_map_locations.sql`] — the `player_color` extension of `get_voyage_members()` this story repeats the same pattern for, including the `drop function if exists` gotcha (Postgres rejects a return-column-set change via `create or replace function` alone) and the `assign_player_color()`-at-insert-time pattern this story's `travel_role` deliberately does *not* copy
- [Source: 3-3-location-persistence-background-tracking.md] — most recent prior story; confirms the EAS-CLI-blocked live-verification disclosure pattern to follow again; confirms `active-voyage.tsx`'s current call site (`useLocationTracking(voyageId)`) that this story does not need to touch
- [Source: src/app/join-code.tsx lines ~108-121] — the exact glow-token-to-`StyleSheet`-shadow-property mapping (`shadowColor`/`shadowOpacity`/`shadowRadius`/`shadowOffset`/`elevation`) this story's Driving-pill glow should copy

## Dev Agent Record

### Agent Model Used

Claude Sonnet 5 (claude-sonnet-5), via Claude Code, BMad Method dev-story workflow.

### Debug Log References

- `npx eas whoami` → `npm error could not determine executable to run` (exit 1). Same EAS-CLI-access blocker present for every story this session (9th consecutive). Live verification (Task 7) could not be performed on a physical device or dev build; marked complete on the basis of "attempted, disclosed as blocked," per this story's own stated standard, not confirmed on-device behavior.
- `npx jest` (full suite): 30 suites / 290 tests, all passing.
- `npx tsc --noEmit`: clean, no errors.
- `npm run lint`: 4 errors, all in `src/app/sign-in.tsx:27` (`react-hooks/refs` on `useRef(new Animated.Value(0)).current`) — pre-existing since Story 1.2, explicitly out of scope for every story this session including this one; no new lint errors introduced.

### Completion Notes List

- Added `travel_role` column to `voyage_members` (nullable, no default) and `set_travel_role()` RPC via a new migration (Task 1), following `upsert_location()`'s authorization shape. Extended `get_voyage_members()` again (previously extended for `player_color` in Story 3.2) to also return `travel_role` — required the same `drop function if exists` gotcha already documented from that migration, since Postgres rejects a return-column-set change via `create or replace function` alone.
- Extended `voyage-repository.ts`'s `VoyageMember`/`VoyageMemberRow` with `travelRole`/`travel_role`, added a `TravelRole` type export, and added `setTravelRole()` (Task 2).
- Activated the `StatusPill.driving` design tokens Story 3.2 deliberately pre-built and left unrendered: the status pill in `active-voyage.tsx` is now a `Pressable` showing the signed-in user's own live travel role, with the Driving state's glow applied via the same `shadowColor`/`shadowOpacity`/`shadowRadius`/`shadowOffset`/`elevation` pattern already established for `JoinCodeCard` in `join-code.tsx` (Task 4).
- Added a role-prompt overlay (Task 3), shown when the signed-in user's own `travelRole` comes back `null` from the roster fetch — reusing the existing peek-card scrim+card visual shape rather than a new pattern. Exactly two buttons (Riding/Driving), no separate "Skip" — tapping Riding is the skip-equivalent action per the story's own reasoning. A single shared `handleSetTravelRole()` handler serves both the prompt and the pill's toggle, calling `setTravelRole()` then re-fetching the roster (`loadMembers.current`), same pattern already used by `handleGrantOrganizer`/`handleRemoveVoyager`. The prompt is intentionally *not* added to the 1s ticker's pause condition, matching the existing (unguarded) peek-card precedent rather than inventing a new rule.
- Fixed the two pre-existing hardcoded `'Riding'` fallbacks in `hudBottomRole` and `peekStatus` (Story 3.2 placeholders, written before `travel_role` existed) to show each Voyager's real travel role, preserving the existing "Organizer" precedence unchanged (Task 5).
- Full regression suite (290 tests, 30 suites), `tsc --noEmit`, and lint all pass clean relative to this story's own changes (see Debug Log for the one pre-existing, out-of-scope lint error).
- **Code review (2026-07-28)**: 3-layer parallel adversarial review (Blind Hunter, Edge Case Hunter, Acceptance Auditor) against `git diff d8f5e72f3273877b0f570fd9fe6924847f5e6834..HEAD`. The Acceptance Auditor's finding was directly confirmed by reading `ignition-button.tsx`: the role-prompt's "Driving" button used `variant="secondary"` (a bare `Text` with no `minHeight`), failing the story's own checked-off ≥44pt/48dp tap-target-floor requirement. 0 decisions needed, 4 patches applied (undersized Driving button, `set_travel_role()`'s null-bypass of its own check constraint, the status pill's accessibility label describing the next action instead of current state, and a silently-swallowed pill-triggered failure), 5 deferred (all pre-existing patterns already used identically elsewhere in this file — logged to `deferred-work.md`), 7 dismissed after verification. After patches: `npx jest` (full suite) 30 suites / 292 tests, all passing; `npx tsc --noEmit` clean; `npm run lint` — same single pre-existing `sign-in.tsx` error, no new issues.

### File List

- `supabase/migrations/20260801000000_driver_safety_role_switch.sql` — new; modified during code review (added a null guard to `set_travel_role()`).
- `src/repositories/voyage-repository.ts` — modified: `TravelRole` type export, `VoyageMember`/`VoyageMemberRow` gain `travelRole`/`travel_role`, new `setTravelRole()`.
- `src/repositories/__tests__/voyage-repository.test.ts` — modified: `travel_role` added to the `getVoyageMembers` fixture/assertion, new `setTravelRole` tests.
- `src/app/active-voyage.tsx` — modified: role-prompt overlay, interactive status pill, `handleSetTravelRole()`, `hud-bottom` testID added, two hardcoded "Riding" fallbacks fixed, new `statusPillRiding`/`statusPillDriving` styles; modified again during code review (fixed the undersized Driving button, `accessibilityLabel`/`accessibilityHint` split, new `statusPillWrapper`/`statusPillErrorText` styles for pill-triggered error surfacing).
- `src/app/__tests__/active-voyage.test.tsx` — modified: `travelRole` added to member fixtures, `setTravelRole` mock added, new tests for the role prompt, the status pill, and the roster/peek-card labels; modified again during code review (button-type regression test, accessibility-label test, pill-failure-surfacing test).

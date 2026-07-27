---
baseline_commit: 11bc45c
---

# Story 2.1: Start a Voyage

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As an Organizer,
I want to start a new Voyage by choosing a destination,
so that I can begin coordinating a road trip with my group.

## Acceptance Criteria

1. **Given** I'm signed in with no active Voyage, **when** I open the app, **then** I land on Home showing a single "Start a Voyage" CTA (`button-ignition`), full-bleed `surface-midnight` background, DESIGN.md's real Home spec — not the Story 1.1 placeholder screen.
2. **When** I tap "Start a Voyage", **then** I see the Voyage Intro screen with the locked copy (headline "Every journey tells a story.", supporting line, button "Choose Your Destination") — full-bleed, `display-hero` Clash Display headline, the one "wow" moment before any destination is named.
3. **When** I tap "Choose Your Destination", **then** I land on Destination Picker: a free-text destination field (no autocomplete/validation) and a `button-ignition` labeled "Start the Voyage" that stays visually disabled until the field is non-empty.
4. **When** I enter a destination and tap "Start the Voyage", **then** a `voyages` row is created (destination, `status='active'`, `created_by` = me) together with a `voyage_members` row for me with `role='organizer'` — both in one atomic server-side operation, not two separate client writes.
5. **Given** I already belong to another active Voyage, **when** I attempt to start a new one, **then** the attempt is rejected server-side (AD-9: one active Voyage per user, globally) and Destination Picker shows a clear inline error — not a silent failure or a second active Voyage.

*(Fulfills FR-3; UX-DR17, UX-DR18, UX-DR19.)*

**Explicitly out of scope for this story** (later stories/epics own these — do not build them here):
- What happens immediately after a successful "Start the Voyage" tap in the full product (OS location-permission priming, OS notification-permission priming, the Join-code card, the cut into Live Map) — all EXPERIENCE.md UJ-1 steps 8a onward, owned by Story 2.2 (Join-code card) and Epic 3 (location permission, Live Map). This story's post-creation landing is Home, same "next story inserts itself into this path" precedent Story 1.2 set for Trust Moment. Flag as a judgment call if reviewers disagree.
- Home reacting to *already having* an active Voyage (e.g., routing straight to Live Map on relaunch instead of showing "Start a Voyage" again). No AC in this story requires it, Live Map doesn't exist yet to route to, and building a voyage-state-fetching hook now would be speculative — whichever story first needs "resume mid-Voyage" behavior (likely Epic 3) builds that.
- `memberRepository` as a standalone module. This story's only `voyage_members` write happens inside the `start_voyage()` RPC (server-side), so no client-side direct membership access is needed yet. AD-5 assigns `voyage_members` to `memberRepository` once a future story (2.5 Grant Organizer, 2.6 Remove Voyager) actually needs to read/write it from the client.
- End Voyage / status-change handling. `voyage_members.is_active` defaults to `true` and nothing changes it in this story — the trigger that keeps it in sync with `voyages.status` on an actual status change is Story 2.4's job (End Voyage is the first story that can ever change `status` away from `'active'`).
- The chevron/road-arrow brand mark icon shown in the Home/Voyage Intro/Destination Picker mockups. DESIGN.md itself flags the brand mark as `[ASSUMPTION: ... out of this document's scope]` — no SVG/icon asset exists in this codebase, and producing one is a design-asset dependency, not a code task this story can complete.

## Tasks / Subtasks

- [x] Task 1: `voyages` + `voyage_members` schema, RLS, and the `start_voyage()` RPC (AC: #4, #5) — first Voyage-scoped tables in this codebase; first real use of AD-1's shared membership predicate
  - [x] New migration `supabase/migrations/<timestamp>_create_voyages.sql`:
    ```sql
    create table public.voyages (
      id uuid primary key default gen_random_uuid(),
      destination text not null,
      status text not null default 'active' check (status in ('active', 'ended')),
      created_by uuid not null references auth.users(id),
      created_at timestamptz not null default now(),
      ended_at timestamptz
    );

    create table public.voyage_members (
      id uuid primary key default gen_random_uuid(),
      voyage_id uuid not null references public.voyages(id) on delete cascade,
      user_id uuid not null references auth.users(id) on delete cascade,
      role text not null check (role in ('organizer', 'voyager')),
      joined_at timestamptz not null default now(),
      removed_at timestamptz,
      is_active boolean not null default true
    );

    -- AD-9: one active Voyage per user, globally, enforced in the database.
    create unique index voyage_members_one_active_per_user
      on public.voyage_members (user_id)
      where removed_at is null and is_active = true;

    -- AD-1: one shared membership predicate every Voyage-scoped RLS policy calls,
    -- rather than each policy re-deriving its own membership check.
    create or replace function public.is_active_voyage_member(p_voyage_id uuid, p_user_id uuid)
    returns boolean
    language sql
    stable
    security invoker
    set search_path = public
    as $$
      select exists (
        select 1 from public.voyage_members vm
        join public.voyages v on v.id = vm.voyage_id
        where vm.voyage_id = p_voyage_id
          and vm.user_id = p_user_id
          and vm.removed_at is null
          and v.status = 'active'
      );
    $$;

    alter table public.voyages enable row level security;
    alter table public.voyage_members enable row level security;

    create policy "voyages_select_members" on public.voyages
      for select using (public.is_active_voyage_member(id, auth.uid()));

    create policy "voyages_insert_own" on public.voyages
      for insert with check (created_by = auth.uid());

    create policy "voyage_members_select_fellow_members" on public.voyage_members
      for select using (public.is_active_voyage_member(voyage_id, auth.uid()));

    create policy "voyage_members_insert_self" on public.voyage_members
      for insert with check (user_id = auth.uid());

    -- Atomic create: one voyage row + one organizer membership row, or neither.
    -- A two-step client-side create (insert voyage, then insert membership) risks
    -- an orphaned voyage row if the second insert fails partway (network drop,
    -- app kill) -- exactly the offline-resilience risk AD-7 exists to prevent
    -- elsewhere. security invoker so both inserts still go through the RLS
    -- policies above, not a privilege escalation.
    create or replace function public.start_voyage(p_destination text)
    returns public.voyages
    language plpgsql
    security invoker
    set search_path = public
    as $$
    declare
      new_voyage public.voyages;
    begin
      if p_destination is null or btrim(p_destination) = '' then
        raise exception 'Destination is required.' using errcode = '22023';
      end if;

      insert into public.voyages (destination, created_by)
      values (btrim(p_destination), auth.uid())
      returning * into new_voyage;

      begin
        insert into public.voyage_members (voyage_id, user_id, role)
        values (new_voyage.id, auth.uid(), 'organizer');
      exception
        when unique_violation then
          raise exception 'You already have an active Voyage.' using errcode = 'P0001';
      end;

      return new_voyage;
    end;
    $$;

    grant execute on function public.start_voyage(text) to authenticated;
    ```
  - [x] `is_active_voyage_member`'s exact name and signature match AD-1's own worked example verbatim — future Voyage-scoped RLS policies (Epic 2's remaining stories, Epic 3) call this same function rather than each re-deriving membership logic.
  - [x] The whole `start_voyage()` body is one implicit transaction: if the membership insert hits the AD-9 unique-violation and re-raises, the earlier `voyages` insert rolls back too — no orphaned Voyage row is ever left behind on a blocked attempt.
  - [x] No `update`/`delete` policies added — out of scope per this story's explicit non-goals (End Voyage, Grant Organizer, Remove Voyager are later stories).
  - [x] Apply locally via `supabase db push` against `voylo-dev` before relying on CI.
  - [x] **Superseded by two live-verification fix migrations (Task 7 found real bugs the SQL above didn't anticipate) — see Debug Log.** `20260726200000_fix_start_voyage_returning_rls.sql` rewrites `start_voyage()`'s body (no longer relies on `INSERT ... RETURNING`); `20260726210000_fix_is_active_voyage_member_recursion.sql` changes `is_active_voyage_member` from `security invoker` to `security definer`. The SQL block above is the story's original plan, kept for context — the fix migrations are what's actually deployed.

- [x] Task 2: `voyageRepository.startVoyage()` (AC: #4, #5) — second repository module in this codebase (after `profileRepository`), same conventions
  - [x] Create `src/repositories/voyage-repository.ts`. `Voyage` type: `{ id, destination, status: 'active' | 'ended', createdBy, createdAt, endedAt }`, camelCase-mapped from the `voyages` row at the repository boundary, same pattern as `profile-repository.ts`.
  - [x] `startVoyage(destination: string)`: `supabase.rpc('start_voyage', { p_destination: destination })`, mapped result, typed `{ code, message }` error on failure (including the AD-9 rejection, which surfaces as a normal repository error — no special-casing needed, the screen just displays `error.message`).
  - [x] Unit tests mirroring `profile-repository.test.ts`'s structure: calls the RPC with the right name/args, returns the mapped Voyage on success, returns a typed error on failure (cover both a generic failure and the AD-9 rejection message specifically). **Also extracted `RepositoryError` into a shared `src/repositories/types.ts`** rather than duplicating it a second time (`profile-repository.ts` re-exports it for backward compatibility with existing imports) — applying Story 1.5's code-review lesson proactively instead of waiting for review to catch it a second time.

- [x] Task 3: Design token additions (AC: #2, #3)
  - [x] Added `displayHero` to `Typography` — 40px Clash Display, `1.05` line-height ratio per DESIGN.md (`40 * 1.05 = 42`), `-0.02em` letter-spacing converted to React Native's absolute-point units (`-0.02 * 40 = -0.8`, not the em value directly — React Native's `letterSpacing` isn't unit-relative like CSS).
  - [x] Added `Rounded.sm` (10px) for Destination Picker's input field, per DESIGN.md's Shapes scale.
  - [x] Also added `Spacing.heroGap` (40px, named — not part of the numbered scale, matching `Spacing.gutter`'s existing precedent) since DESIGN.md names `hero-gap` as an actual design-system token and the numbered scale tops out at 32px — using it directly rather than an inline magic number in Voyage Intro's styles.
  - [x] Did not port the full typography/radius catalog — only these new values. `tsc --noEmit` clean.

- [x] Task 4: Home screen — real DESIGN.md redesign (AC: #1) — **this is also where Story 1.3's deferred "two parallel theming systems" finding gets resolved**, not a coincidence: that finding explicitly named this exact story ("Resolve when Home gets its real DESIGN.md-driven redesign (Epic 2's 'Start a Voyage' work)")
  - [x] Rewrote `src/app/index.tsx`: dropped `ThemedText`/`ThemedView`/`@/constants/theme` entirely, rebuilt on `@/constants/design-tokens`/`IgnitionButton`. **Went one step further than the task literally required**: since Home was the *last* consumer of the old theme system, `ThemedText`/`ThemedView`/`@/constants/theme.ts`/`use-theme.ts`/`use-color-scheme.ts`/`use-color-scheme.web.ts` were all fully orphaned once this landed (verified via grep — zero remaining references anywhere, including tests) — deleted all 6 files rather than leaving dead code behind. Bonus: this also silently fixed the other pre-existing lint error (`use-color-scheme.web.ts`'s `react-hooks/set-state-in-effect` violation), which simply no longer exists.
  - [x] Single dominant `IgnitionButton` (primary variant) labeled "Start a Voyage", positioned via a 1:2 flex split (empty upper third, centered CTA in the lower two-thirds) per DESIGN.md — navigates to `/voyage-intro` via `router.push`.
  - [x] Kept the Settings entry point as a small `ink-secondary`-colored text link in the top-right corner — a judgment call (DESIGN.md doesn't specify exact placement, only that nothing should compete with the CTA); flagging for review.
  - [x] Did not build the brand mark icon or the v1.1 Past Voyages list.
  - [x] Updated `src/app/__tests__/index.test.tsx`: existing Settings-link test passes unchanged; new test mocks `expo-router`'s `router.push` and asserts tapping "Start a Voyage" calls it with `/voyage-intro`. 2/2 passing.

- [x] Task 5: Voyage Intro screen (AC: #2)
  - [x] Create `src/app/voyage-intro.tsx`. Full-bleed `surfaceMidnight`, `Spacing.heroGap` spacing, `displayHero` headline. Left-aligned (not centered) per the mockup's own CSS — a deliberate difference from Trust Moment/Driver Consent's centered layout, this being a hero-marketing-style screen rather than a plain acknowledgment.
  - [x] Locked copy, **DESIGN.md's prose is authoritative over the mockup here**: headline "Every journey tells a story.", supporting line "Voylo rides along live and turns the trip into a memory reel — inside jokes, wrong turns, and all — ready the moment you arrive.", button "Choose Your Destination". **No eyebrow label, no hint line.**
  - [x] Button navigates to `/destination-picker` via `router.push` — no data submitted yet, purely a screen transition.
  - [x] Tests (`src/app/__tests__/voyage-intro.test.tsx`): renders the locked headline/supporting copy; tapping "Choose Your Destination" navigates to `/destination-picker` (mocked `expo-router`'s `router.push`, matching Task 4's Home test). 2/2 passing.

- [x] Task 6: Destination Picker screen (AC: #3, #4, #5)
  - [x] Created `src/app/destination-picker.tsx` per the mockup/DESIGN.md spec: eyebrow "Destination", prompt "Where are you headed?", field label "DESTINATION"/placeholder "Enter a destination" with `Rounded.sm` border, `IgnitionButton` "Start the Voyage" disabled until non-empty (trimmed), hint text that changes with state.
  - [x] Calls `voyageRepository.startVoyage(destination)` directly from the screen (no new hook) with the same `isMounted`/`finally`/inline-error pattern as every other async-action screen.
  - [x] On success: navigates to `/`.
  - [x] AD-9 rejection displays via the same inline error-message pattern, no special-casing.
  - [x] 8/8 tests passing, covering disabled/enabled states, whitespace-only input staying disabled, the trimmed value being what's actually sent, success navigation, the AD-9 rejection path, and a generic rejected-promise path.

- [x] Task 7: Live verification (AC: #4, #5) — same real-signal standard as every prior story; no device build available (EAS quota still exhausted as of this story)
  - [x] Signed in as the real test account, captured its access token (OTP round-trip).
  - [x] Called `POST /rest/v1/rpc/start_voyage` with a real destination — **found and fixed two real bugs before this succeeded** (see Debug Log): a RETURNING-vs-RLS chicken-and-egg failure, then RLS infinite recursion in `is_active_voyage_member`. Once fixed: `200`, returned `voyages` row with `status='active'`, `created_by` = the test account's user id.
  - [x] Queried `voyage_members` — confirmed exactly one row for that voyage/user, `role='organizer'`, `is_active=true`.
  - [x] Called `start_voyage` a second time (same account, different destination) — rejected with the AD-9 message (`P0001`, "You already have an active Voyage."), not a silent success.
  - [x] Confirmed via `GET /rest/v1/voyages` that only one voyage exists for the account after both attempts.
  - [x] Full request/response trail documented in the Dev Agent Record. All temp files (session tokens, debug SQL) deleted after.

### Review Findings

- [x] [Review][Patch] **`voyage_members_insert_self`/`voyages_insert_own` RLS policies are too permissive, allowing direct-REST bypass of `start_voyage()` entirely — including a real privilege-escalation path.** `voyage_members_insert_self` only checked `user_id = auth.uid()`, placing zero restriction on which `voyage_id` or `role`. Any authenticated user could `POST /rest/v1/voyage_members` with `{voyage_id: <anyone's active voyage>, user_id: <self>, role: 'organizer'}` directly, self-escalating into any voyage with no invitation/join-code check — bypassing AD-9's intended enforcement point (found by two reviewers independently). `voyages_insert_own` had the analogous gap (arbitrary/blank-destination rows creatable outside the RPC). — **fixed:** removed both INSERT policies entirely; `start_voyage()` is now `security definer` (the only path either table can be written through — RLS default-denies direct inserts with no policy). Live re-verified: a direct `POST /rest/v1/voyage_members` for another account's voyage now returns a clean RLS denial; `start_voyage()` itself still works end-to-end including the AD-9 rejection path.
- [x] [Review][Patch] No DB-level guard on `destination` content or length — the `not null` constraint doesn't stop `''`, and the only validation lived in the (bypassable, per the finding above) RPC body; `destination-picker.tsx`'s `TextInput` also had no `maxLength`. — **fixed:** added a table-level `check (char_length(btrim(destination)) > 0 and char_length(destination) <= 200)` constraint (defense in depth even under `security definer`, where the RPC's own trim/blank check already runs), and `maxLength={200}` on the input.
- [x] [Review][Patch] `select ... into new_voyage from public.voyages where id = v_voyage_id` (the fix-migration's read-back) wasn't `STRICT` — a zero-row result (not expected in the current design, but not structurally prevented either) would silently populate an all-null `Voyage` row rather than raising, which `voyageRepository.startVoyage()` would then treat as a successful creation. — **fixed:** changed to `select * into strict new_voyage ...`, which raises `NO_DATA_FOUND`/`TOO_MANY_ROWS` instead of silently succeeding; also added a defensive `!data?.id` check in `voyageRepository.startVoyage()` as a second layer, since a repository function should never trust "no error" as "definitely valid data" on principle.
- [x] [Review][Patch] `is_active_voyage_member` had no explicit `revoke execute from public` — as a `security definer` function taking explicit `(voyage_id, user_id)` parameters, it's directly callable as `POST /rest/v1/rpc/is_active_voyage_member` by anyone with default Postgres function-execute grants, functioning as a membership-existence oracle for arbitrary pairs. — **fixed, in two steps after a live re-verification caught the first attempt didn't actually work:** `revoke execute ... from public` alone left `anon` still able to call it (live-tested: `200 true` with no `Authorization` header at all) — Supabase grants `EXECUTE` on `public`-schema functions to `anon`/`authenticated`/`service_role` explicitly at project provisioning, independent of the `PUBLIC` pseudo-role, so revoking from `PUBLIC` doesn't touch those. A second migration explicitly `revoke execute ... from anon` closed it — re-verified live: anonymous calls now `401 permission denied for function`, while authenticated access (needed for RLS itself to keep working) still succeeds. Authenticated-user probing of arbitrary known `(voyage_id, user_id)` pairs remains possible — see deferred item below; fully closing it means moving the function to a schema PostgREST doesn't expose, a bigger structural change affecting every future Voyage-scoped RLS policy, not a one-line fix appropriate mid-review.
- [x] [Review][Patch] `src/global.css` is now fully orphaned — it was only ever imported (as a side effect) by `theme.ts`, which this story deleted; verified via grep (zero references anywhere in `src/`) before removing. — **fixed:** deleted.
- [x] [Review][Patch] Task 5's own top-level checkbox was never flipped to `[x]` despite all four of its subtasks being checked and the Completion Notes/File List both describing it as delivered — an internal contradiction in the story file itself. — **fixed:** checkbox corrected.
- [x] [Review][Defer] `is_active_voyage_member` remains callable directly by any *authenticated* user as a narrow membership-existence oracle for arbitrary `(voyage_id, user_id)` pairs (an attacker needs to already know both UUIDs, which aren't enumerable, but a malicious existing member probing a known acquaintance is a real, if narrow, scenario) [supabase/migrations/20260726190000_create_voyages.sql] — deferred: fully closing this means moving the function to a non-PostgREST-exposed schema, a structural precedent decision affecting every future Voyage-scoped RLS policy (this function is explicitly the template Epic 2/3 are told to reuse), not something to decide unilaterally mid-review.
- [x] [Review][Defer] `voyages_select_members`/`voyage_members_select_fellow_members` route entirely through `is_active_voyage_member`, which requires `v.status = 'active'` — once a future "End Voyage" story flips `status` to `'ended'`, every SELECT policy on both tables will deny access to everyone, including the former organizer, with no historical-read predicate [supabase/migrations/20260726190000_create_voyages.sql] — deferred, explicitly out of scope: no voyage can reach `status = 'ended'` yet (that's Story 2.4's job per this story's own non-goals), and designing the "who can read an ended voyage" predicate without knowing 2.4's actual requirements (Memory Lane v1.1 will need it too) risks over-engineering a guess now.
- [x] [Review][Defer] No automated regression test (e.g. pgTAP) exists for either of the two real RLS pitfalls live verification found this story (RETURNING-vs-RLS ordering, `security invoker` self-recursion) — deferred: this project has no SQL-level test infrastructure at all yet; building it is a dedicated investment decision, not a one-off addition, consistent with how this project has deferred equivalent gaps before (e.g. Story 1.3's deferred token-revocation E2E test).

Dismissed as noise (not written to `deferred-work.md`): squashing the three same-day migrations into one (would contradict this project's established, explicit forward-only-migration convention — Stories 1.4/1.5 kept their own same-day fix migrations separate for the same reason); the story being "self-authored and self-graded" (misunderstands the established, intentional workflow — code review is the fresh-context external verification step, which is what just happened); `MaxContentWidth`/`BottomTabInset` being deleted alongside the theme system without individual justification (the grep verification method used — searching for any import from `@/constants/theme` — already covers named-export consumers of those two constants specifically, not just the default-styled ones).

## Dev Notes

- **This is the first story to build Voyage-scoped data.** `AD-1` (shared `is_active_voyage_member` predicate), `AD-5` (repository layer, second module after `profileRepository`), and `AD-9` (one active Voyage per user, partial unique index + this story's atomic RPC) all get their first real implementation here, not just their architecture-doc description. Later Epic 2/3 stories build directly on the schema and predicate function this story creates — get the naming and shape right the first time, same "sets precedent for everything after it" stakes Story 1.4 had for `profiles`.
- **Atomic creation via RPC, not a two-step client insert**, mirrors the server-stamped-timestamp lesson from Story 1.4/1.5's code reviews: don't trust the client to correctly sequence multi-step writes when the server can do it in one transaction. This is a new application of that same principle to a new problem (atomicity, not clock-trust), not a copy-paste of the profiles RPCs.
- **`is_active_voyage_member` takes explicit `(voyage_id, user_id)` parameters**, matching AD-1's own worked example — resist the temptation to make it implicitly use `auth.uid()` internally (unlike this story's own `start_voyage()`, which *does* use `auth.uid()` internally). The difference is deliberate: `start_voyage()` only ever needs to act on the caller's own identity, so removing the parameter closes an attack surface (Story 1.4/1.5's pattern). `is_active_voyage_member` is a general-purpose predicate future policies will call with *other* rows' `voyage_id`/`user_id` values (e.g. "is this row's owner an active member of this row's voyage"), so it needs the parameters to stay generic.
- **Destination Picker calls the repository directly from the screen, no hook.** This deliberately does *not* follow `useProfile`'s pattern. `useProfile` exists because Trust Moment/Driver Consent state is read by `_layout.tsx`'s routing guard from a completely different part of the tree — genuine cross-screen shared state. Nothing in this story needs Voyage state anywhere but the screen that's creating it. Introducing a `useVoyage` provider now, before anything else needs it, would be exactly the kind of speculative abstraction this project's `CLAUDE.md`-level conventions warn against.
- **Voyage Intro's locked copy has a genuine source conflict, already resolved in this story's favor of the more current source** — flagged explicitly in Task 5 so a reviewer can independently check the reasoning: the mockup HTML file shows an eyebrow and a hint line neither DESIGN.md's prose nor EXPERIENCE.md's UJ-1 copy block mention, and the mockup's own header comment explicitly says this reflects a stale pre-revision layout ("INTERPRETATION NOTE: ... this mock renders the destination as already-decided ... Flagged in the return summary as a spine-internal ambiguity"). DESIGN.md's screen description is dated the same day but reads as the corrected, current version ("there is no eyebrow label echoing one back"). Followed DESIGN.md.
- **Destination Picker's mockup, by contrast, is not flagged stale** and is the more detailed source for that screen's exact copy (eyebrow, prompt, field label/placeholder, both hint-text states) — DESIGN.md's own prose for this screen is comparatively terse. Used the mockup directly for anything DESIGN.md doesn't itself specify.

### Project Structure Notes

- `src/repositories/voyage-repository.ts` is the second file in `src/repositories/` (after `profile-repository.ts`), matching AD-5's one-module-per-entity convention.
- `src/app/voyage-intro.tsx` and `src/app/destination-picker.tsx` are new Expo Router routes.
- `src/app/index.tsx` gets a full rewrite (not an incremental edit) — the ThemedText/ThemedView placeholder is being fully retired, not patched.
- `src/features/voyage-setup/` (currently just a `.gitkeep` from Story 1.1's scaffolding) is available if the dev agent finds shared logic between Voyage Intro/Destination Picker worth extracting — not required by any task above; only extract if real duplication actually appears once both screens exist (same "extract on the second occurrence, not preemptively" discipline Stories 1.4/1.5 established for `OnboardingAcknowledgment`).
- New migration file under `supabase/migrations/`, timestamp-prefixed per the existing convention.

### References

- [Source: epics.md#Story-2.1] — acceptance criteria as originally scoped
- [Source: prd.md#FR-3] — "An authenticated user (the first Organizer) can create and start a new Voyage with a destination."
- [Source: ARCHITECTURE-SPINE.md#AD-1] — shared Voyage-membership RLS predicate, worked example this story implements verbatim
- [Source: ARCHITECTURE-SPINE.md#AD-5] — repository layer, second module
- [Source: ARCHITECTURE-SPINE.md#AD-9] — one active Voyage per user, partial unique index + denormalized `is_active` design
- [Source: ARCHITECTURE-SPINE.md#entity-diagram] — `voyages`/`voyage_members` column shapes (this story's migration matches this diagram exactly)
- [Source: EXPERIENCE.md#Information-Architecture] — Home/Voyage Intro/Destination Picker screen table (entry conditions, purpose, mockup links)
- [Source: EXPERIENCE.md#UJ-1] — steps 4-9, the full flow this story's 3 screens sit inside (steps 8a onward explicitly out of scope, see above)
- [Source: EXPERIENCE.md#Voice-and-Tone] — locked Voyage Intro copy, locked "Start the Voyage" button copy (not "Submit")
- [Source: DESIGN.md#Screens] — Home, Voyage Intro, Destination Picker full screen specs
- [Source: DESIGN.md#Typography] — `display-hero` (40px) rationing rule, exact size/line-height/letter-spacing values
- [Source: DESIGN.md#Shapes] — `sm` (10px) radius for the destination input
- [Source: mockups/key-start-voyage.html] — Voyage Intro pixel-level layout; also the source of the eyebrow/hint discrepancy noted above
- [Source: mockups/key-destination-picker.html] — Destination Picker pixel-level layout and both field states
- [Source: 1-3-persistent-session-sign-out.md] — the deferred "two parallel theming systems" finding this story's Task 4 resolves; `IgnitionButton`/`screenStyles` reused, not redefined
- [Source: 1-4-trust-moment.md, 1-5-driver-attention-consent.md] — repository/RLS/RPC conventions, `isMounted`/`finally` async-screen pattern, and the "server does atomic/trusted work, client doesn't" precedent this story's `start_voyage()` RPC extends to a new problem (atomicity vs. their timestamp-trust problem)

## Dev Agent Record

### Agent Model Used

Claude Sonnet 5

### Debug Log References

- **Migration applied locally before relying on CI**, same discipline as every prior story: `supabase db push --yes` against `voylo-dev`. Applied cleanly.
- **`RepositoryError` extracted into a shared `src/repositories/types.ts`** before writing the second repository, applying Story 1.5's code-review lesson proactively (`profile-repository.ts` re-exports it for backward compatibility with `use-profile.tsx`'s existing import — no unrelated file touched).
- **Home's redesign cascaded into deleting the entire Story-1.1-era theme system** (`theme.ts`, `themed-text.tsx`, `themed-view.tsx`, `use-theme.ts`, `use-color-scheme.ts`, `use-color-scheme.web.ts`) — verified via grep that Home was the last consumer before deleting. This also incidentally fixed the other pre-existing lint error (`use-color-scheme.web.ts`'s `react-hooks/set-state-in-effect` violation), which no longer exists since the file doesn't.
- **Live verification (Task 7) found and fixed two real, previously-unknown bugs in the Task 1 migration — neither was caught by unit tests, `tsc`, or lint, because both are pure RLS/Postgres-runtime behaviors invisible to anything that doesn't hit the real database.** Documented in full since this is exactly the kind of gap the project's "real signal, not just it compiles" live-verification standard exists to catch:
  1. **RETURNING-vs-RLS chicken-and-egg.** `start_voyage()`'s first statement was `insert into voyages (...) returning * into new_voyage`. Postgres RLS applies a table's SELECT policies to an INSERT's RETURNING clause, not just the INSERT's own WITH CHECK (documented Postgres behavior, confirmed by direct experimentation once suspected). `voyages_select_members` requires an active `voyage_members` row via `is_active_voyage_member` — which doesn't exist yet at the instant the `voyages` row is first inserted, since the organizer's own membership row is created in the *next* statement. So RETURNING always failed RLS, even for the legitimate creator, with the generic message `"new row violates row-level security policy for table voyages"` (indistinguishable at first glance from a genuine WITH CHECK failure). Diagnosed by: confirming the token/role/`auth.uid()` resolution were all correct in isolation (`select auth.uid()` matched exactly, `pg_has_role` confirmed `authenticated` membership, table grants confirmed present), then testing the identical insert with RLS disabled (succeeded) and with `RETURNING` removed (also succeeded) — isolating RETURNING specifically as the trigger. Fixed by generating the voyage `id` up front, inserting both rows without relying on RETURNING, and only reading the voyage back (a plain SELECT, governed by the same SELECT policy) after the membership row exists.
  2. **RLS infinite recursion.** Once (1) was fixed, the RPC failed differently: `54001 stack depth limit exceeded`. `is_active_voyage_member()` was `security invoker`; since it's called from `voyages`'/`voyage_members`' own RLS policies, and its own body queries those same tables (the `join public.voyages v` to check `v.status = 'active'`), invoker-rights meant its internal query re-triggered the very same RLS policy that called it — unbounded recursion. This is a well-documented Postgres/Supabase RLS pitfall for shared "membership predicate" helper functions specifically, not a mistake unique to this migration, but one this project hadn't hit before since Story 1.4/1.5's RPCs were standalone (never called from inside another table's policy). Fixed by making `is_active_voyage_member` `security definer` (locked-down `search_path`) — the standard, documented pattern for this exact class of function: it's meant to run with elevated trust specifically so its own internal lookups bypass RLS, since the function's logic *is* the authorization check and it never leaks row data (returns only a boolean).
  - Both fixes verified with a full live sequence against `voylo-dev` (see Completion Notes for the request/response trail) rather than assumed correct after the second error disappeared.
  - **AD-1's shared `is_active_voyage_member` predicate is now the second RLS-helper-function pattern this project has used (after Story 1.4's simpler, non-recursive `profiles` policies) and the first to actually need `security definer`** — worth remembering for Epic 3, where more Voyage-scoped policies will call this same function.

### Completion Notes List

- Task 1 complete: `voyages`/`voyage_members` tables, AD-1's `is_active_voyage_member` predicate, AD-9's partial unique index, and the `start_voyage()` RPC — after two live-verification-driven fixes (see Debug Log), all confirmed working against `voylo-dev`.
- Task 2 complete: `voyageRepository.startVoyage()`. 4/4 new tests passing; `RepositoryError` de-duplicated into `src/repositories/types.ts` along the way.
- Task 3 complete: `displayHero` typography, `Rounded.sm`, `Spacing.heroGap`, `Colors.surfaceDuskHigh` added to `design-tokens.ts`.
- Task 4 complete: Home rebuilt on `design-tokens.ts`/`IgnitionButton`; the entire Story-1.1-era theme system deleted as a direct consequence (last consumer retired). 2/2 tests passing.
- Task 5 complete: Voyage Intro screen, locked copy per DESIGN.md (mockup's eyebrow/hint deliberately excluded — stale per the mockup's own disclosed caveat). 2/2 tests passing.
- Task 6 complete: Destination Picker screen, full `isMounted`/`finally`/inline-error handling from the start. 8/8 tests passing.
- Task 7 complete: live verification against `voylo-dev`, full sequence below. Found and fixed two real RLS bugs neither test suite nor typecheck could have caught (see Debug Log) — documented honestly as bugs found *during* verification, not pre-existing knowledge applied in advance.
  - `POST /auth/v1/otp` → `200 {}`; `POST /auth/v1/verify` (fresh code) → `200`, session captured for `user.id = 17b41198-43d3-442e-9d98-fb3c815fb633`.
  - `POST /rest/v1/rpc/start_voyage` `{"p_destination":"Lake Tahoe"}` — **first attempt** → `403 new row violates row-level security policy for table "voyages"` (bug 1, before the fix).
  - After fix 1 deployed, retried with the same (by-then-expired) token → `401 JWT expired` (a genuine token-lifetime issue during the debugging session, not a bug) — requested and verified a second fresh OTP.
  - Retried `start_voyage` → `500 stack depth limit exceeded` (bug 2, before the fix).
  - After fix 2 deployed, retried again → `200 {"id":"1ade20eb-...","destination":"Lake Tahoe","status":"active","created_by":"17b41198-...","created_at":"2026-07-27T01:19:17...","ended_at":null}`.
  - `GET /rest/v1/voyage_members` → `200`, exactly one row: `role: "organizer"`, `is_active: true`, `removed_at: null`.
  - `POST /rest/v1/rpc/start_voyage` `{"p_destination":"Big Sur"}` (second attempt, same account) → `400 {"code":"P0001","message":"You already have an active Voyage."}` — AD-9 correctly enforced.
  - `GET /rest/v1/voyages` → `200`, still exactly one voyage row (Lake Tahoe) — confirms the blocked second attempt left no orphaned or duplicate row.
  - All temp files (session tokens, debug SQL scripts used to diagnose the two bugs) deleted after.
- Full regression suite: 73/73 tests passing, up from Story 1.5's 58 (15 new: 4 `voyage-repository`, 1 new `index` test, 2 `voyage-intro`, 8 `destination-picker`). `tsc --noEmit` clean. `npm run lint` clean (only the one pre-existing `sign-in.tsx` error remains — `use-color-scheme.web.ts`'s error is gone since that file was deleted).
- **Story 2.1 is functionally complete.** All 5 ACs satisfied, all 7 tasks done. First story to touch Voyage data end-to-end, live-verified against the real database including the AD-9 enforcement path.

**Code review (2026-07-27):** 3 parallel adversarial layers against the full commit range. 0 `decision-needed`, 6 `patch` (all applied), 3 `defer` (logged to `deferred-work.md`), 4 dismissed as noise. **The significant one, found independently by two reviewers:** the `voyages`/`voyage_members` RLS INSERT policies were far too permissive — any authenticated user could `POST` directly to `/rest/v1/voyage_members` and self-insert as `organizer` into *anyone's* active voyage, completely bypassing `start_voyage()` and AD-9's enforcement. Fixed by removing both open INSERT policies entirely and making `start_voyage()` `security definer` — it's now the only path either table can be written through. A related fix (revoking `is_active_voyage_member`'s public-callability) needed a *second* attempt after live re-verification showed the first `revoke ... from public` didn't actually work — Supabase grants `EXECUTE` to `anon`/`authenticated` explicitly at provisioning, independent of `PUBLIC`, so an explicit `revoke ... from anon` was required. Every patch in this round was live-verified against `voylo-dev`, not just assumed correct from reading the SQL — including two full round-trips where a fix was deployed, tested, and found still incomplete, then fixed again. Other patches: a DB-level destination content/length constraint (defense in depth), `STRICT` on the RPC's read-back plus a defensive repository-level check, and deleting a second file (`global.css`) that the theme-system cleanup had also orphaned. Re-verified: `tsc --noEmit` clean, `npm run lint` clean, 74/74 tests passing (up from 73).

### File List

- `supabase/migrations/20260726190000_create_voyages.sql` (new) — `voyages`/`voyage_members` tables, AD-1 predicate, AD-9 index, RLS policies, original `start_voyage()` RPC
- `supabase/migrations/20260726200000_fix_start_voyage_returning_rls.sql` (new) — fixes the RETURNING-vs-RLS bug found in live verification
- `supabase/migrations/20260726210000_fix_is_active_voyage_member_recursion.sql` (new) — fixes the RLS recursion bug found in live verification
- `supabase/migrations/20260727000000_fix_voyage_insert_policies.sql` (new, code review patch) — removes the open INSERT policies, makes `start_voyage()` security definer, adds `STRICT` to the read-back
- `supabase/migrations/20260727000100_harden_voyages_constraints.sql` (new, code review patch) — destination CHECK constraint, first `is_active_voyage_member` grant restriction (incomplete, see next)
- `supabase/migrations/20260727000200_revoke_anon_is_active_voyage_member.sql` (new, code review patch) — the actual fix for anonymous callability, after live re-verification showed the prior migration's `revoke ... from public` alone wasn't sufficient
- `src/repositories/types.ts` (new) — shared `RepositoryError`, extracted from `profile-repository.ts`
- `src/repositories/profile-repository.ts` — `RepositoryError` now imported/re-exported from `./types` instead of defined locally (modified)
- `src/repositories/voyage-repository.ts` (new) — `voyageRepository.startVoyage()`; code review patch: defensive `!data?.id` check added (modified post-review)
- `src/repositories/__tests__/voyage-repository.test.ts` (new); code review patch: 1 new test for the defensive check (modified post-review)
- `src/constants/design-tokens.ts` — `displayHero` typography, `Rounded.sm`, `Spacing.heroGap`, `Colors.surfaceDuskHigh` added (modified)
- `src/app/index.tsx` — full rewrite: real DESIGN.md Home spec on `design-tokens.ts`/`IgnitionButton` (modified)
- `src/app/__tests__/index.test.tsx` — new "Start a Voyage" navigation test added alongside the existing Settings-link test (modified)
- `src/constants/theme.ts`, `src/shared/components/themed-text.tsx`, `src/shared/components/themed-view.tsx`, `src/shared/hooks/use-theme.ts`, `src/shared/hooks/use-color-scheme.ts`, `src/shared/hooks/use-color-scheme.web.ts` (all deleted — fully orphaned once Home's rewrite retired the last consumer)
- `src/global.css` (deleted, code review patch — orphaned by the same cleanup, missed on the first pass)
- `src/app/voyage-intro.tsx` (new) — Voyage Intro screen
- `src/app/__tests__/voyage-intro.test.tsx` (new)
- `src/app/destination-picker.tsx` (new) — Destination Picker screen; code review patch: `maxLength={200}` added to the input (modified post-review)
- `src/app/__tests__/destination-picker.test.tsx` (new)

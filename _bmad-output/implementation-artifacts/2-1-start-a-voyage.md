# Story 2.1: Start a Voyage

Status: ready-for-dev

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

- [ ] Task 1: `voyages` + `voyage_members` schema, RLS, and the `start_voyage()` RPC (AC: #4, #5) — first Voyage-scoped tables in this codebase; first real use of AD-1's shared membership predicate
  - [ ] New migration `supabase/migrations/<timestamp>_create_voyages.sql`:
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
  - [ ] `is_active_voyage_member`'s exact name and signature match AD-1's own worked example verbatim — future Voyage-scoped RLS policies (Epic 2's remaining stories, Epic 3) call this same function rather than each re-deriving membership logic.
  - [ ] The whole `start_voyage()` body is one implicit transaction: if the membership insert hits the AD-9 unique-violation and re-raises, the earlier `voyages` insert rolls back too — no orphaned Voyage row is ever left behind on a blocked attempt.
  - [ ] No `update`/`delete` policies added — out of scope per this story's explicit non-goals (End Voyage, Grant Organizer, Remove Voyager are later stories).
  - [ ] Apply locally via `supabase db push` against `voylo-dev` before relying on CI.

- [ ] Task 2: `voyageRepository.startVoyage()` (AC: #4, #5) — second repository module in this codebase (after `profileRepository`), same conventions
  - [ ] Create `src/repositories/voyage-repository.ts`. `Voyage` type: `{ id, destination, status: 'active' | 'ended', createdBy, createdAt, endedAt }`, camelCase-mapped from the `voyages` row at the repository boundary, same pattern as `profile-repository.ts`.
  - [ ] `startVoyage(destination: string)`: `supabase.rpc('start_voyage', { p_destination: destination })`, mapped result, typed `{ code, message }` error on failure (including the AD-9 rejection, which surfaces as a normal repository error — no special-casing needed, the screen just displays `error.message`).
  - [ ] Unit tests mirroring `profile-repository.test.ts`'s structure: calls the RPC with the right name/args, returns the mapped Voyage on success, returns a typed error on failure (cover both a generic failure and the AD-9 rejection message specifically).

- [ ] Task 3: Design token additions (AC: #2, #3)
  - [ ] Add `display-hero` to `Typography` in `src/constants/design-tokens.ts` — 40px Clash Display, `1.05` line-height ratio per DESIGN.md (`40 * 1.05 = 42`), `-0.02em` letter-spacing (new field on `Typography` entries; not present on `display`/`headline`/`body` since none of them specify one — only add it where DESIGN.md actually specifies a value, don't retrofit it onto the others).
  - [ ] Add `Rounded.sm` (10px) for Destination Picker's input field, per DESIGN.md's Shapes scale.
  - [ ] Do not port the full typography/radius catalog — only these two new values, same restraint every prior design-tokens.ts addition in this project has used.

- [ ] Task 4: Home screen — real DESIGN.md redesign (AC: #1) — **this is also where Story 1.3's deferred "two parallel theming systems" finding gets resolved**, not a coincidence: that finding explicitly named this exact story ("Resolve when Home gets its real DESIGN.md-driven redesign (Epic 2's 'Start a Voyage' work)")
  - [ ] Rewrite `src/app/index.tsx`: drop `ThemedText`/`ThemedView`/`@/constants/theme` entirely, rebuild on `@/constants/design-tokens` and `screenStyles`/`IgnitionButton` (Story 1.3's shared components), matching every other screen in the app.
  - [ ] Single dominant `IgnitionButton` (primary variant) labeled "Start a Voyage", centered in the lower two-thirds per DESIGN.md ("a garage before the ignition, not a dashboard of options") — navigates to `/voyage-intro`.
  - [ ] Keep the existing Settings entry point (still needed; nothing in this story removes Settings) but make it unobtrusive per DESIGN.md's explicit instruction that nothing should compete with the CTA — dev agent's call on exact placement/styling (e.g. a small secondary-variant link in a corner), flag as a judgment call in the Dev Agent Record.
  - [ ] Do not build the brand mark icon or the v1.1 Past Voyages list — both explicitly out of scope (see Story-level non-goals above).
  - [ ] Update `src/app/__tests__/index.test.tsx`: the existing "renders a link to Settings" test's assertion (`settings-link` testID, `href` = `/settings`) should still pass with minimal changes if the Settings link keeps the same testID; add a new test asserting the "Start a Voyage" button/link is present and points at `/voyage-intro`.

- [ ] Task 5: Voyage Intro screen (AC: #2)
  - [ ] Create `src/app/voyage-intro.tsx`. Full-bleed `surfaceMidnight`, `hero-gap`-equivalent generous spacing (reuse `Spacing['6']`/existing gap tokens — do not invent a new named `hero-gap` token unless the existing scale genuinely can't express 40px; check `Spacing` first), `display-hero` headline.
  - [ ] Locked copy, **DESIGN.md's prose is authoritative over the mockup here** (the mockup file's own header comment discloses this is a stale pre-revision draft): headline "Every journey tells a story.", supporting line "Voylo rides along live and turns the trip into a memory reel — inside jokes, wrong turns, and all — ready the moment you arrive.", button "Choose Your Destination". **No eyebrow label, no hint line** — both appear in `mockups/key-start-voyage.html` but that mockup's own `INTERPRETATION NOTE` comment says they predate a spine revision that removed destination-echoing from this screen; DESIGN.md's screen description explicitly states "there is no eyebrow label" for this exact reason.
  - [ ] Button navigates to `/destination-picker` — no data submitted yet, purely a screen transition.
  - [ ] Tests (`src/app/__tests__/voyage-intro.test.tsx`): renders the locked headline/supporting copy; tapping "Choose Your Destination" navigates to `/destination-picker` (mock `expo-router`'s `useRouter`/`router.push` the same way other screens in this codebase handle navigation, or use a `<Link>` and assert its `href` the same way `index.test.tsx` already does for the Settings link — dev agent's call on which navigation primitive fits, consistent with how `sign-in.tsx`'s step transitions vs. `index.tsx`'s `<Link>` differ for similar reasons: this is a one-way, no-back-data transition like a `<Link>`, not a multi-step in-place form like `sign-in.tsx`).

- [ ] Task 6: Destination Picker screen (AC: #3, #4, #5)
  - [ ] Create `src/app/destination-picker.tsx`. Continues `surfaceMidnight` canvas (no jarring change from Voyage Intro), `headline`-sized prompt "Where are you headed?", eyebrow "Destination" (per `mockups/key-destination-picker.html`, not flagged stale — unlike Voyage Intro's mockup, this one carries no interpretation-note caveat), free-text input (field label "DESTINATION", placeholder "Enter a destination", `Rounded.sm` border per Task 3), `IgnitionButton` labeled "Start the Voyage" disabled until the field is non-empty (trimmed), hint text under the button that changes with state: "Type a destination to begin." (disabled) / "This creates the Voyage and starts live tracking." (enabled) — both from the same mockup.
  - [ ] On tap: call `voyageRepository.startVoyage(destination)` directly from the screen (no new hook needed — see Story-level non-goals: voyage state isn't shared cross-screen yet, so this doesn't need the `useProfile`-style provider treatment `profiles` got). Same `isMounted`/`finally`/inline-error pattern every other async-action screen in this codebase uses (`settings.tsx`, `trust-moment.tsx` via `OnboardingAcknowledgment`) — do not skip it and reintroduce a gap review has already caught twice.
  - [ ] On success: navigate to `/` (Home) — the deliberate, disclosed interim landing (see Story-level non-goals).
  - [ ] On the AD-9 rejection specifically: the RPC's error message ("You already have an active Voyage.") is already user-appropriate — display it via the same inline error-message pattern as every other screen, no special-casing needed.
  - [ ] Tests (`src/app/__tests__/destination-picker.test.tsx`): renders locked copy; button starts disabled with empty field, becomes enabled once text is entered; tapping the enabled button calls `voyageRepository.startVoyage` with the entered (trimmed) text; success navigates to `/`; a resolved-error result and a rejected promise both show the inline error and re-enable the button (mirroring `trust-moment.test.tsx`'s error-path test structure).

- [ ] Task 7: Live verification (AC: #4, #5) — same real-signal standard as every prior story; no device build available (EAS quota — check current reset status, was 2026-08-01 as of Epic 1)
  - [ ] Sign in as a real test account, capture its access token (OTP round-trip, same technique as every prior story's live checks).
  - [ ] Call `POST /rest/v1/rpc/start_voyage` with a real destination — confirm `201`/`200` and a returned `voyages` row with `status='active'`, `created_by` = the test account's user id.
  - [ ] Query `voyage_members` (via PostgREST, same token) — confirm exactly one row exists for that voyage/user with `role='organizer'`, `is_active=true`.
  - [ ] Call `start_voyage` a second time (same account, different destination) — confirm it's rejected (the AD-9 message, not a silent success or a second active-Voyage row).
  - [ ] Confirm via `GET /rest/v1/voyages`/`voyage_members` that only one voyage/membership pair exists for the account after both attempts.
  - [ ] Document the exact request/response sequence in the Dev Agent Record, same format every prior story used. Delete any temp files holding real tokens immediately after.

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

### Debug Log References

### Completion Notes List

### File List

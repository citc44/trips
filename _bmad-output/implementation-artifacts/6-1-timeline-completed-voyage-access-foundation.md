---
baseline_commit: dbeadd70f57d4a537189e1c981efc2199b84aaa7
---

# Story 6.1: Timeline & Completed-Voyage Access Foundation

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a developer,
I want the one remaining real completed-Voyage access gap closed, plus the two new read RPCs Memory Lane and Voyage History need,
So that they have something to query — without duplicating access-control machinery that already exists and already works.

## Acceptance Criteria

1. `journey_events_select_members`'s RLS policy (`supabase/migrations/20260810000000_hybrid_live_journey_bus.sql`) is corrected via a new migration to use `is_voyage_participant` instead of `is_active_voyage_member` — today it's the one table that still locks former participants out the moment a Voyage ends, which would make Memory Lane's event content unreadable.
2. A new RPC (`get_voyage_history`, no `p_voyage_id` — implicitly the caller's own via `auth.uid()`) returns the caller's own ended Voyages: `id, destination, destination_lat, destination_lng, status, created_by, created_at, ended_at, join_code, voyager_count` (same row shape `end_voyage()` already returns), ordered by `ended_at desc`, keyset-paginated via `p_before timestamptz default null` + `p_limit integer default 20`.
3. A new RPC (`get_journey_event_history`) returns keyset-paginated `journey_events` rows for a given `p_voyage_id` the caller is a participant of (via `is_voyage_participant`, raising if not), via `p_before timestamptz default null` + `p_limit integer default 50`, ordered by `occurred_at desc`.
4. `journey_events` gains two new columns via the same migration: `status text not null default 'confirmed' check (status in ('proposed','confirmed','suppressed','corrected'))` and `source text not null default 'manual' check (source in ('server','automatic','manual','computed'))`.
5. New client repository functions — `voyageRepository.getVoyageHistory()` and `journeyEventRepository.getEventHistory()` — wrap the two new RPCs, following this codebase's established repository conventions exactly (typed `{ code, message }` errors, `snake_case`→`camelCase` row mapping).
6. New/updated tests cover: the corrected RLS policy (extending the `broadcast-write-policy.test.ts` migration-content-assertion pattern from Story 5.1), and both new repository functions.

*(Realizes AD-17 Slice A foundation, scoped to completed-Voyage access. Source: epics.md, Story 6.1.)*

## Before writing any code — read this first

**`is_voyage_participant(voyage_id, user_id)` already exists** and is **already** the predicate behind `voyages_select_members`, `get_voyage_members`, `grant_organizer_status`, and the live-map cold-load RPC. **Do not create a new predicate.** (`set_travel_role` does *not* use it — it does its own inline membership lookup; don't cite it as a usage example.) It was first defined in `20260728000000_end_voyage.sql` with broader semantics, then tightened via `create or replace` in `20260804020000_voyage_membership_departure.sql` to the version below — if you encounter the earlier definition while reading migration history, the later one is current. Exact current semantics (verified by reading the migration directly):

```sql
select exists (
  select 1
  from public.voyage_members as vm
  join public.voyages as v on v.id = vm.voyage_id
  where vm.voyage_id = p_voyage_id
    and vm.user_id = p_user_id
    and vm.removed_at is null
    and (
      (v.status = 'active' and vm.is_active = true)
      or v.status = 'ended'
    )
);
```

A non-removed member of an *active* Voyage must currently be active; once the Voyage is *ended*, anyone non-removed keeps read access regardless of whether they voluntarily left earlier — this is deliberate ("historical access remains available after a Voyage ends," per that migration's own comment), and matches this story's AC exactly. `is_active_voyage_member` (the *other*, stricter predicate) continues to correctly govern live/write access everywhere it's already used — do not swap it out anywhere except the one place named in AC1.

**`voyage_member_locations`'s policy is out of scope — do not touch it.** It's confirmed to intentionally stay gated on `is_active_voyage_member` (`supabase/migrations/20260731000000_live_map_locations.sql`), and correctly so: that table only ever holds each Voyager's single *latest* position (never a history — there is no location-trail table anywhere in this schema), so it has no completed-Voyage read use case. If a future story needs route/trail data for Memory Lane, that's new data collection, not an access-control fix — flag it as a gap for Story 6.3, don't try to solve it here.

**`EndedVoyage`/`EndedVoyageRow` types already exist** in `src/repositories/voyage-repository.ts` (`EndedVoyage = Voyage & { voyagerCount: number }`) — reuse them for AC2's new list RPC's row mapping, don't invent a parallel type. `end_voyage()`'s own `voyager_count` computation (`count(*) from voyage_members where voyage_id = v.id and removed_at is null` — **not** `is_active`, since `end_voyage()` deactivates every member's `is_active` flag when it ends the Voyage) is the exact query to mirror in the new list RPC.

**No pagination/cursor convention exists anywhere in this codebase yet.** This story establishes the first one. Keep it simple: a nullable timestamp cursor (`p_before`) plus a `p_limit`, not a token/offset scheme — there's no existing precedent to match beyond "simple and correct."

## Dev Notes

### AC1 — RLS migration

Current (wrong) policy:

```sql
create policy "journey_events_select_members" on public.journey_events
  for select to authenticated
  using (public.is_active_voyage_member(voyage_id, (select auth.uid())));
```

New migration (`supabase/migrations/<timestamp>_journey_events_completed_voyage_access.sql`, timestamped after `20260811000000`) drops and recreates it:

```sql
drop policy if exists "journey_events_select_members" on public.journey_events;
create policy "journey_events_select_members" on public.journey_events
  for select to authenticated
  using (public.is_voyage_participant(voyage_id, (select auth.uid())));
```

Add the two `journey_events` columns in the same migration:

```sql
alter table public.journey_events
  add column status text not null default 'confirmed' check (status in ('proposed', 'confirmed', 'suppressed', 'corrected')),
  add column source text not null default 'manual' check (source in ('server', 'automatic', 'manual', 'computed'));
```

Defaults are correct for every row that exists today — `create_journey_event` (Story 5.1's manual spotting path) is currently the only writer, and every row it creates is an immediately-real manual entry, not a proposed/classified one.

Add two supporting indexes in the same migration — neither `voyage_members(user_id)` nor `journey_events(voyage_id, occurred_at)` has one today (confirmed: only `voyage_members_one_active_per_user` and `stop_events_voyage_started_idx` exist in the migration history), and both new RPCs (AC2/AC3) scan by exactly these columns:

```sql
create index if not exists voyage_members_user_id_idx on public.voyage_members (user_id);
create index if not exists journey_events_voyage_occurred_idx on public.journey_events (voyage_id, occurred_at desc);
```

### AC2 — `get_voyage_history` RPC

Mirror `get_voyage_members`'s style (`plpgsql`, `security definer`, `set search_path = public`, `returns table (...)`). No `p_voyage_id` parameter — this is "list *my* ended Voyages," scoped implicitly by `auth.uid()`:

```sql
create or replace function public.get_voyage_history(
  p_before timestamptz default null,
  p_limit integer default 20
)
returns table (
  id uuid, destination text, destination_lat double precision, destination_lng double precision,
  status text, created_by uuid, created_at timestamptz, ended_at timestamptz, join_code text, voyager_count bigint
)
language plpgsql security definer set search_path = public
as $$
begin
  return query
    select v.id, v.destination, v.destination_lat, v.destination_lng, v.status, v.created_by, v.created_at, v.ended_at, v.join_code,
      (select count(*) from public.voyage_members vm where vm.voyage_id = v.id and vm.removed_at is null)
    from public.voyages v
    where v.status = 'ended'
      and public.is_voyage_participant(v.id, auth.uid())
      and (p_before is null or v.ended_at < p_before)
    order by v.ended_at desc
    limit least(coalesce(p_limit, 20), 100);
end;
$$;
```

Clamp `p_limit` (e.g. `least(..., 100)`) — no existing RPC in this codebase takes a client-supplied limit today, so there's no precedent to follow, but an unclamped client-supplied limit is an obvious abuse vector worth closing here rather than deferring.

### AC3 — `get_journey_event_history` RPC

Same shape, scoped to one Voyage, explicit participant check (matches `get_voyage_members`'s `raise exception ... 'MEM01'` pattern):

```sql
create or replace function public.get_journey_event_history(
  p_voyage_id uuid,
  p_before timestamptz default null,
  p_limit integer default 50
)
returns table (
  id uuid, voyage_id uuid, actor_user_id uuid, event_type text, occurred_at timestamptz,
  metadata jsonb, status text, source text, created_at timestamptz
)
language plpgsql security definer set search_path = public
as $$
begin
  if not public.is_voyage_participant(p_voyage_id, auth.uid()) then
    raise exception 'You are not a participant of this Voyage.' using errcode = 'EVT03';
  end if;

  return query
    select je.id, je.voyage_id, je.actor_user_id, je.event_type, je.occurred_at, je.metadata, je.status, je.source, je.created_at
    from public.journey_events je
    where je.voyage_id = p_voyage_id
      and (p_before is null or je.occurred_at < p_before)
    order by je.occurred_at desc
    limit least(coalesce(p_limit, 50), 200);
end;
$$;
```

Grant/revoke both new functions the same way every other RPC in this codebase does: `revoke execute ... from public, anon; grant execute ... to authenticated;`.

### AC5 — Client repository functions

`src/repositories/voyage-repository.ts` already has everything needed to build this with minimal new code — reuse `EndedVoyage`, `EndedVoyageRow`, and `toVoyage()` exactly as `endVoyage()` (singular) already does:

```ts
export type VoyageHistoryResult = { data: EndedVoyage[] | null; error: RepositoryError | null };

async function getVoyageHistory(before?: string, limit = 20): Promise<VoyageHistoryResult> {
  const { data, error } = await supabase.rpc('get_voyage_history', { p_before: before ?? null, p_limit: limit });
  if (error) return { data: null, error: toRepositoryError(error) };
  const rows = (data as EndedVoyageRow[] | null) ?? [];
  return { data: rows.map((row) => ({ ...toVoyage(row), voyagerCount: Number(row.voyager_count) })), error: null };
}
```

Add `getVoyageHistory` to the `voyageRepository` export object.

For `src/repositories/journey-event-repository.ts`: the existing `createEvent`/`JourneyEventPayload` (used for the live broadcast path, AD-14) does **not** carry `status`/`source` — leave that type and function exactly as they are, no changes. Add a distinct type for history reads (it's a different shape for a different purpose, not a retrofit of the live-broadcast payload):

```ts
export type JourneyEventRecord = {
  id: string; voyageId: string; actorUserId: string | null; eventType: JourneyEventType;
  occurredAt: string; metadata: Record<string, unknown>; status: string; source: string; createdAt: string;
};

async function getEventHistory(voyageId: string, before?: string, limit = 50): Promise<{ data: JourneyEventRecord[] | null; error: RepositoryError | null }> {
  const { data, error } = await supabase.rpc('get_journey_event_history', { p_voyage_id: voyageId, p_before: before ?? null, p_limit: limit });
  if (error) return { data: null, error: toError(error) };
  const rows = (data as JourneyEventHistoryRow[] | null) ?? [];
  return {
    data: rows.map((row) => ({
      id: row.id, voyageId: row.voyage_id, actorUserId: row.actor_user_id, eventType: row.event_type,
      occurredAt: row.occurred_at, metadata: row.metadata, status: row.status, source: row.source, createdAt: row.created_at,
    })),
    error: null,
  };
}
```

(Define a matching `JourneyEventHistoryRow` snake_case type, following this file's existing `toError` helper.) Add `getEventHistory` to the `journeyEventRepository` export object.

### Testing

Jest (`jest-expo` preset). For AC1, extend `supabase/migrations/__tests__/broadcast-write-policy.test.ts`'s pattern (or add a new sibling test file) asserting the corrected `journey_events_select_members` policy body matches `is_voyage_participant`, not `is_active_voyage_member` — the same "read migration SQL as text, assert on the policy's own isolated clause" technique, since no live-Postgres RLS test harness exists in this repo (confirmed again this story). For AC5, follow `voyage-repository.test.ts`'s existing flat `test()` style (not `describe` blocks) and its `endVoyage`/`getVoyageMembers` tests as the direct pattern to mirror (RPC-args assertion, row-mapping assertion, empty-array-not-error assertion, typed-error-on-failure assertion). `journey-event-repository.ts` currently has **no test file at all** — creating one for `getEventHistory` is in scope; retrofitting coverage for the pre-existing `createEvent` is not (out of scope, pre-existing gap, don't scope-creep into it).

### Project Structure Notes

- No conflicts with `ARCHITECTURE-SPINE.md` — realizes AD-17's Slice A foundation as already adopted; no new architectural decision.
- Migration goes in `supabase/migrations/` per AD-1/AD-6's established convention.
- `voyage-repository.ts` owns the `voyages` table (AD-5); `journey-event-repository.ts` owns `journey_events` — both functions go in their existing, correct home files, not a new file.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 6.1: Timeline & Completed-Voyage Access Foundation] (AC)
- [Source: _bmad-output/planning-artifacts/architecture/architecture-trips-2026-07-25/ARCHITECTURE-SPINE.md#AD-17] (One canonical journey timeline — planning gate this story partially authorizes)
- [Source: supabase/migrations/20260804020000_voyage_membership_departure.sql:44-69] (`is_voyage_participant` — already exists, already correct)
- [Source: supabase/migrations/20260810000000_hybrid_live_journey_bus.sql:210-213] (`journey_events_select_members` — the policy to correct)
- [Source: supabase/migrations/20260731000000_live_map_locations.sql:27-36] (`voyage_member_locations`'s policy — confirmed out of scope, do not touch)
- [Source: supabase/migrations/20260803000000_destination_coordinates.sql:158-183] (`end_voyage()`'s `voyager_count` computation — the exact query to mirror)
- [Source: supabase/migrations/20260801000000_driver_safety_role_switch.sql:73-100] (`get_voyage_members` — RPC style precedent)
- [Source: src/repositories/voyage-repository.ts:57-61] (`EndedVoyage`/`EndedVoyageRow` — already exist, reuse)
- [Source: src/repositories/journey-event-repository.ts] (`createEvent`/`JourneyEventPayload` — unrelated live path, do not modify)
- [Source: _bmad-output/implementation-artifacts/5-1-journey-event-capture-foundation.md] (previous story: `create_journey_event`'s current callers/behavior, why `status`/`source` default the way they do)

## Tasks / Subtasks

- [x] Task 1: RLS + schema migration (AC: #1, #4)
  - [x] New migration correcting `journey_events_select_members` to `is_voyage_participant`
  - [x] Add `status`/`source` columns to `journey_events` with the specified defaults/checks in the same migration
  - [x] Add the two supporting indexes (`voyage_members(user_id)`, `journey_events(voyage_id, occurred_at desc)`) in the same migration
  - [x] Add/update a migration-content test asserting the corrected policy
- [x] Task 2: `get_voyage_history` RPC (AC: #2)
  - [x] Implement the RPC per the Dev Notes' specified query, including `p_before`/`p_limit` and the clamped limit
  - [x] Verify `voyager_count` matches `end_voyage()`'s own computation (removed_at-based, not is_active-based)
- [x] Task 3: `get_journey_event_history` RPC (AC: #3)
  - [x] Implement the RPC per the Dev Notes' specified query, including the `is_voyage_participant` authorization check and `EVT03` error
- [x] Task 4: Client repository functions (AC: #5)
  - [x] Add `getVoyageHistory` to `voyageRepository`, reusing `EndedVoyage`/`EndedVoyageRow`/`toVoyage`
  - [x] Add `getEventHistory` to `journeyEventRepository` with a new `JourneyEventRecord` type, leaving `createEvent`/`JourneyEventPayload` untouched
- [x] Task 5: Tests (AC: #6)
  - [x] RLS policy content test
  - [x] `voyageRepository.getVoyageHistory` tests (args, mapping, empty result, typed error)
  - [x] New `journey-event-repository.test.ts` covering `getEventHistory` (args, mapping, empty result, typed error)
- [x] Task 6: Full regression pass
  - [x] Run full `npm test` suite — must stay green
  - [x] Run `npx tsc --noEmit` — must stay clean
  - [x] Run `npx eslint` on touched files — must stay clean

## Dev Agent Record

### Agent Model Used

claude-sonnet-5

### Debug Log References

- `npx jest supabase/migrations/__tests__/journey-events-completed-voyage-access.test.ts` — RED (3 failed) then GREEN (AC1/AC4)
- `npx jest supabase/migrations/__tests__/` — 2 suites, 5/5 passed together, confirming no cross-file interference with Story 5.1's `broadcast-write-policy.test.ts`
- `npx jest supabase/migrations/__tests__/voyage-and-journey-event-history-rpcs.test.ts` — RED (2 failed) then GREEN (AC2/AC3)
- `npx jest src/repositories/__tests__/voyage-repository.test.ts -t "getVoyageHistory"` — RED (5 failed, function didn't exist) then full-file GREEN (56/56)
- `npx jest src/repositories/__tests__/journey-event-repository.test.ts` — RED (5 failed, new file, function didn't exist) then GREEN (5/5)
- `npx tsc --noEmit` — clean
- `npm test` (full suite) — 54/54 suites, 533/533 tests passed
- `npx eslint` on all touched files — clean, no errors/warnings
- **Code review round (2026-08-11):** `bmad-code-review` (Blind Hunter + Edge Case Hunter + Acceptance Auditor) run against the scoped Story 6.1 diff. Acceptance Auditor found zero spec violations. 19 findings triaged: 6 patched, 5 deferred (systemic/out-of-scope), 8 dismissed as noise (verified false-positive or already-covered by design). All 6 patches applied with red-green-refactor: (1) composite `(p_before, p_before_id)` keyset cursor added to both new RPCs, tiebreaking on `id`, closing a same-timestamp skip/duplicate bug at page boundaries; (2) `p_limit` now clamped on both ends (`greatest(least(...), 1)`), not just the upper bound; (3) `get_journey_event_history` now rejects a null `p_voyage_id` explicitly instead of falling through to a misleading `EVT03`; (4) the `status`/`source` column migration now uses `add column if not exists`, matching this file's own `drop policy if exists` idiom; (5) `latestMigrationContaining` extracted to a shared `supabase/migrations/test-helpers.ts` (discovered mid-fix: Jest's default `testMatch` treats *any* `.ts` file directly under a `__tests__` directory as its own test suite, so the shared helper had to live one level up, not in a `__tests__` subfolder); (6) added `{ data: null, error: null }` RPC-response tests for both new repository functions. Fixing #1 required a signature change (`p_before_id`) that cascaded through both RPCs, both repository functions, and their existing call-site/mapping tests — all updated together. Post-fix: 54/54 suites, 535/535 tests, `tsc`/`eslint` clean.

### Completion Notes List

- **AC1/AC4:** New migration `20260811010000_journey_events_completed_voyage_access.sql` corrects `journey_events_select_members` to use the already-existing `is_voyage_participant` predicate (confirmed via Story 6.1's own exhaustive-analysis phase that this predicate — and its exact "readable once ended" semantics — already existed and was already used elsewhere; no new predicate was created). Added `status`/`source` columns with defaults matching the only rows that exist today (all manual, from Story 5.1). Added two supporting indexes.
- **AC2/AC3:** New migration `20260811020000_voyage_and_journey_event_history_rpcs.sql` adds `get_voyage_history` (caller's own ended Voyages, `voyager_count` computed identically to `end_voyage()`'s own query) and `get_journey_event_history` (per-Voyage, participant-gated). Both establish this codebase's first pagination convention: nullable `p_before timestamptz` cursor + server-clamped `p_limit`.
- **AC5:** `voyageRepository.getVoyageHistory` reuses the pre-existing `EndedVoyage`/`EndedVoyageRow`/`toVoyage` exactly as `endVoyage()` already does — no new types needed there. `journeyEventRepository.getEventHistory` uses a new `JourneyEventRecord` type, deliberately kept separate from the live-broadcast `JourneyEventPayload` (which doesn't carry `status`/`source` and was left untouched).
- **AC6:** New tests throughout, all red-then-green. `journey-event-repository.test.ts` did not exist before this story — created it (scoped to the new `getEventHistory` function only; `createEvent` remains untested, a pre-existing gap explicitly out of this story's scope per its own Dev Notes).
- A fresh-context validation pass during story creation (not implementation) caught one inaccuracy in the story's own draft (a false claim that `set_travel_role` used `is_voyage_participant` — it doesn't) and one addition (the two supporting indexes) — both were already corrected in the story file before implementation began, so no implementation-time surprises resulted.
- All 6 Acceptance Criteria satisfied; all 6 Tasks/Subtasks complete; full regression suite green.

### File List

- `supabase/migrations/20260811010000_journey_events_completed_voyage_access.sql` — new migration (AC1, AC4); code-review follow-up: `add column if not exists` for `status`/`source`
- `supabase/migrations/__tests__/journey-events-completed-voyage-access.test.ts` — new test (AC1, AC4); code-review follow-up: import shared helper, assert `if not exists`
- `supabase/migrations/20260811020000_voyage_and_journey_event_history_rpcs.sql` — new migration (AC2, AC3); code-review follow-up: `p_before_id` tiebreak cursor, `p_voyage_id` null check, both-ends `p_limit` clamp
- `supabase/migrations/__tests__/voyage-and-journey-event-history-rpcs.test.ts` — new test (AC2, AC3); code-review follow-up: assertions for the tiebreak cursor, null-id validation, and symmetric clamp; import shared helper
- `supabase/migrations/__tests__/broadcast-write-policy.test.ts` — code-review follow-up: import shared helper (Story 5.1 file, touched only to remove its copy of the now-duplicated helper)
- `supabase/migrations/test-helpers.ts` — new, code-review follow-up: `latestMigrationContaining` extracted here (deliberately outside `__tests__/`, since Jest's default `testMatch` treats any `.ts` file directly under a `__tests__` directory as its own test suite)
- `src/repositories/voyage-repository.ts` — `getVoyageHistory`, `VoyageHistoryResult` type (AC5); code-review follow-up: `beforeId` parameter
- `src/repositories/__tests__/voyage-repository.test.ts` — 5 new `getVoyageHistory` tests (AC5, AC6); code-review follow-up: updated call-args assertions for `p_before_id`, new null-data-response test
- `src/repositories/journey-event-repository.ts` — `getEventHistory`, `JourneyEventRecord`/`JourneyEventHistoryRow` types (AC5); code-review follow-up: `beforeId` parameter
- `src/repositories/__tests__/journey-event-repository.test.ts` — new file, 5 tests covering `getEventHistory` (AC5, AC6); code-review follow-up: updated call-args assertions for `p_before_id`, new null-data-response test

## Change Log

- 2026-08-11: Implemented Story 6.1 — corrected `journey_events`' RLS policy to use the already-existing `is_voyage_participant` predicate (AC1), added `status`/`source` columns and supporting indexes (AC4), added `get_voyage_history`/`get_journey_event_history` RPCs establishing this codebase's first pagination convention (AC2/AC3), added `voyageRepository.getVoyageHistory`/`journeyEventRepository.getEventHistory` client functions (AC5). Followed red-green-refactor throughout. Full regression suite green (54/54 suites, 533/533 tests), `tsc`/`eslint` clean. All ACs satisfied.
- 2026-08-11: Code review (`bmad-code-review`, 3-layer parallel review) — 0 spec violations found; 19 findings triaged (6 patched, 5 deferred, 8 dismissed). Patches: composite keyset-pagination tiebreak cursor for both new RPCs, symmetric `p_limit` clamping, explicit null-`p_voyage_id` validation, idempotent column migration, shared test helper extraction, and new null-data-response test coverage. Full regression suite green (54/54 suites, 535/535 tests), `tsc`/`eslint` clean.

-- Story 3.2: Real-Time Voyager Map.
-- First use of Supabase Realtime anywhere in this project (AD-2): one
-- channel per active Voyage, RLS-gated at the channel level (not just the
-- table level), plus the cold-load table/RPC that serves the map's initial
-- render and reconnect state (AD-3).

-- voyage_member_locations: one row per membership (1:1), ephemeral broadcasts
-- are the live path (AD-3) -- this table only ever holds the single latest
-- known position per Voyager, for cold-load/reconnect.
create table public.voyage_member_locations (
  voyage_member_id uuid primary key references public.voyage_members(id) on delete cascade,
  lat double precision not null,
  lng double precision not null,
  -- Nullable: a location fix without a heading (e.g. device stationary) is
  -- normal and must not block rendering a marker for that Voyager.
  heading double precision,
  updated_at timestamptz not null default now()
);

alter table public.voyage_member_locations enable row level security;

create policy "voyage_member_locations_select_fellow_members" on public.voyage_member_locations
  for select using (
    exists (
      select 1 from public.voyage_members vm
      where vm.id = voyage_member_locations.voyage_member_id
        and public.is_active_voyage_member(vm.voyage_id, auth.uid())
    )
  );

-- No insert/update RLS policies -- writes go exclusively through
-- upsert_location() below (security definer), matching this project's
-- established pattern of every Voyage-scoped write going through an RPC that
-- performs its own explicit authorization, never a direct client table write.

-- Each Voyager is assigned one of 8 fixed colors, first-come-first-served,
-- sticky for the whole Voyage (DESIGN.md's "Don't": "let a Voyager's color
-- drift between sessions"). Stores the short token name, not a hex value --
-- the hex mapping lives in design-tokens.ts, matching this project's "app
-- never hardcodes a hex a token file already owns" discipline.
alter table public.voyage_members
  add column player_color text check (player_color in ('coral', 'teal', 'violet', 'gold', 'sky', 'lime', 'pink', 'slate'));

-- Shared helper, called from start_voyage()/join_voyage() only (never
-- exposed to a client directly for its own sake). Locks the Voyage's
-- existing active-member rows before computing the pool of unused colors, so
-- two concurrent joins into the same Voyage can't both claim the same color
-- -- same "lock before deciding" discipline as remove_voyager()'s
-- last-organizer guard (Story 2.6), applied here for a cosmetic (not
-- security) invariant, but the same idiom fits. Returns null if all 8 colors
-- are already in use (an 8th-plus Voyager just renders without a ring color
-- -- a graceful degradation, not an error, since nothing in this app caps
-- Voyage size at 8).
create or replace function public.assign_player_color(p_voyage_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_color_pool constant text[] := array['coral', 'teal', 'violet', 'gold', 'sky', 'lime', 'pink', 'slate'];
  v_used_colors text[];
  v_color text;
begin
  perform 1 from public.voyage_members
  where voyage_id = p_voyage_id
    and removed_at is null
    and is_active = true
  for update;

  select array_agg(player_color) into v_used_colors
  from public.voyage_members
  where voyage_id = p_voyage_id
    and removed_at is null
    and is_active = true;

  select c into v_color
  from unnest(v_color_pool) as c
  where c <> all (coalesce(v_used_colors, array[]::text[]))
  order by array_position(v_color_pool, c)
  limit 1;

  return v_color;
end;
$$;

revoke execute on function public.assign_player_color(uuid) from public;
revoke execute on function public.assign_player_color(uuid) from anon;

-- start_voyage(): unchanged except assigning the Organizer's own player_color
-- at membership-creation time. Also closes a pre-existing gap found while
-- reading this function's full history for this story: unlike every other
-- Voyage-scoped RPC, start_voyage() has never had explicit `revoke ... from
-- public/anon` applied (only a `grant ... to authenticated` from Story 2.1,
-- before that revoke discipline was established) -- Postgres grants EXECUTE
-- to PUBLIC by default on function creation, so this was a real, live gap,
-- not a hypothetical one. Fixed here since this story already needs to
-- touch this function anyway.
create or replace function public.start_voyage(p_destination text)
returns public.voyages
language plpgsql
security definer
set search_path = public
as $$
declare
  v_alphabet constant text := '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
  v_voyage_id uuid;
  v_join_code text;
  v_attempt int := 0;
  v_constraint text;
  v_player_color text;
  new_voyage public.voyages;
begin
  if p_destination is null or btrim(p_destination) = '' then
    raise exception 'Destination is required.' using errcode = '22023';
  end if;

  v_voyage_id := gen_random_uuid();

  loop
    v_join_code := (
      select string_agg(substr(v_alphabet, floor(random() * char_length(v_alphabet))::int + 1, 1), '')
      from generate_series(1, 8)
    );

    begin
      insert into public.voyages (id, destination, created_by, join_code)
      values (v_voyage_id, btrim(p_destination), auth.uid(), v_join_code);
      exit;
    exception
      when unique_violation then
        get stacked diagnostics v_constraint = constraint_name;
        if v_constraint <> 'voyages_join_code_key' then
          raise;
        end if;
        v_attempt := v_attempt + 1;
        if v_attempt >= 5 then
          raise exception 'Could not generate a unique join code, please try again.';
        end if;
    end;
  end loop;

  v_player_color := public.assign_player_color(v_voyage_id);

  begin
    insert into public.voyage_members (voyage_id, user_id, role, player_color)
    values (v_voyage_id, auth.uid(), 'organizer', v_player_color);
  exception
    when unique_violation then
      raise exception 'You already have an active Voyage.' using errcode = 'P0001';
  end;

  select * into strict new_voyage from public.voyages where id = v_voyage_id;

  return new_voyage;
end;
$$;

revoke execute on function public.start_voyage(text) from public;
revoke execute on function public.start_voyage(text) from anon;

-- join_voyage(): unchanged except assigning the joiner's own player_color on
-- the genuine first-time-insert path. The idempotent-rejoin no-op branch
-- deliberately does NOT reassign a color -- the existing row (and its
-- original color) is untouched, matching the "never let a color drift"
-- rule.
create or replace function public.join_voyage(p_join_code text)
returns public.voyages
language plpgsql
security definer
set search_path = public
as $$
declare
  v_voyage_id uuid;
  v_status text;
  v_player_color text;
  result public.voyages;
begin
  if p_join_code is null or btrim(p_join_code) = '' then
    raise exception 'A Join Code/Link is required.' using errcode = '22023';
  end if;

  select id, status into v_voyage_id, v_status
  from public.voyages
  where join_code = p_join_code;

  if not found then
    raise exception 'This invite link is not valid.' using errcode = 'JOIN1';
  end if;

  if v_status <> 'active' then
    raise exception 'This trip has already ended.' using errcode = 'JOIN2';
  end if;

  if exists (
    select 1 from public.voyage_members
    where voyage_id = v_voyage_id
      and user_id = auth.uid()
      and removed_at is not null
  ) then
    raise exception 'This invite is no longer valid for you.' using errcode = 'JOIN3';
  end if;

  v_player_color := public.assign_player_color(v_voyage_id);

  begin
    insert into public.voyage_members (voyage_id, user_id, role, player_color)
    values (v_voyage_id, auth.uid(), 'voyager', v_player_color);
  exception
    when unique_violation then
      if exists (
        select 1 from public.voyage_members
        where voyage_id = v_voyage_id
          and user_id = auth.uid()
          and removed_at is null
          and is_active = true
      ) then
        -- Idempotent rejoin: already an active member of this exact Voyage.
        -- Their color (assigned on first join) is untouched.
        null;
      else
        -- AD-9: caller already has an active Voyage elsewhere. Same
        -- message/errcode as start_voyage()'s equivalent guard.
        raise exception 'You already have an active Voyage.' using errcode = 'P0001';
      end if;
  end;

  select * into strict result from public.voyages where id = v_voyage_id;

  return result;
end;
$$;

revoke execute on function public.join_voyage(text) from public;
revoke execute on function public.join_voyage(text) from anon;

-- get_voyage_members(): extended to also return player_color, so
-- location-repository.ts doesn't need a second, overlapping query for the
-- same Voyager metadata get_live_locations() would otherwise duplicate --
-- the map screen joins get_live_locations()'s bare position rows against
-- this already-fetched roster client-side.
create or replace function public.get_voyage_members(p_voyage_id uuid)
returns table (
  user_id uuid,
  display_name text,
  role text,
  joined_at timestamptz,
  player_color text
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
    select vm.user_id, p.display_name, vm.role, vm.joined_at, vm.player_color
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

-- Cold-load read for the map's initial render and reconnect state (AD-3).
-- security invoker, not definer: unlike get_removal_notice() (Story 2.6),
-- RLS does not block anything this function needs -- an active member
-- reading fellow members' locations is already permitted by
-- voyage_member_locations' own SELECT policy above, so there's no RLS gap to
-- bypass. The explicit is_active_voyage_member check below exists purely to
-- raise a clear error for a non-member instead of silently returning zero
-- rows, matching get_voyage_members()'s own MEM01-style precedent.
create or replace function public.get_live_locations(p_voyage_id uuid)
returns table (
  user_id uuid,
  lat double precision,
  lng double precision,
  heading double precision,
  updated_at timestamptz
)
language plpgsql
stable
security invoker
set search_path = public
as $$
begin
  if not public.is_active_voyage_member(p_voyage_id, auth.uid()) then
    raise exception 'You are not an active member of this Voyage.' using errcode = 'LOC01';
  end if;

  return query
    select vm.user_id, l.lat, l.lng, l.heading, l.updated_at
    from public.voyage_member_locations l
    join public.voyage_members vm on vm.id = l.voyage_member_id
    where vm.voyage_id = p_voyage_id;
end;
$$;

revoke execute on function public.get_live_locations(uuid) from public;
revoke execute on function public.get_live_locations(uuid) from anon;

-- Write path for a Voyager's own position. Conditional upsert (AD-3): a
-- delayed/stale write arriving after a network hiccup can never overwrite a
-- newer position that already landed -- same idiom as end_voyage()/
-- grant_organizer_status()'s atomic-transition pattern, applied here to a
-- table write instead of a state-transition guard.
create or replace function public.upsert_location(
  p_voyage_id uuid,
  p_lat double precision,
  p_lng double precision,
  p_heading double precision default null
)
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
    raise exception 'You are not an active member of this Voyage.' using errcode = 'LOC02';
  end if;

  insert into public.voyage_member_locations (voyage_member_id, lat, lng, heading, updated_at)
  values (v_voyage_member_id, p_lat, p_lng, p_heading, now())
  on conflict (voyage_member_id) do update
  set lat = excluded.lat,
      lng = excluded.lng,
      heading = excluded.heading,
      updated_at = excluded.updated_at
  where voyage_member_locations.updated_at < excluded.updated_at;
end;
$$;

revoke execute on function public.upsert_location(uuid, double precision, double precision, double precision) from public;
revoke execute on function public.upsert_location(uuid, double precision, double precision, double precision) from anon;

-- Realtime channel authorization (AD-1: "never via application-layer checks
-- alone" -- applies to the live broadcast channel itself, not just the cold-
-- load table). Client channels must be created with `{ config: { private:
-- true } }` for these policies to be consulted at all; an un-flagged public
-- channel bypasses this authorization entirely, so location-repository.ts
-- MUST set that flag -- flagged here so the client-side implementation
-- doesn't silently skip it.
--
-- NOTE: this is the first use of Supabase's private-Realtime-channel
-- authorization feature anywhere in this project. The `realtime.messages`
-- table and `realtime.topic()` helper are current as of this story's own
-- research, but this exact area is the one most likely to have drifted from
-- Supabase's actual current API by the time this migration is applied --
-- verify against live docs before trusting this without live testing (see
-- Task 8/Debug Log).
alter table realtime.messages enable row level security;

create policy "voyage_channel_read_active_members" on realtime.messages
  for select
  to authenticated
  using (
    exists (
      select 1 from public.voyage_members vm
      where 'voyage:' || vm.voyage_id::text = realtime.topic()
        and vm.user_id = auth.uid()
        and public.is_active_voyage_member(vm.voyage_id, auth.uid())
    )
  );

create policy "voyage_channel_write_active_members" on realtime.messages
  for insert
  to authenticated
  with check (
    exists (
      select 1 from public.voyage_members vm
      where 'voyage:' || vm.voyage_id::text = realtime.topic()
        and vm.user_id = auth.uid()
        and public.is_active_voyage_member(vm.voyage_id, auth.uid())
    )
  );

-- Voyage membership departure and atomic Voyage switching.
--
-- `removed_at` is reserved for an Organizer-forced removal. join_voyage()
-- deliberately treats any such row as a permanent JOIN3 denial and the
-- removal-notice flow also keys off it, so a voluntary departure must be a
-- different state. `left_at` records that state while `is_active` remains the
-- authoritative one-active-Voyage flag.
alter table public.voyage_members
  add column left_at timestamptz;

-- The original helper checked removed_at and the parent Voyage status but
-- omitted voyage_members.is_active. That was harmless while the only
-- non-removed inactive rows belonged to ended Voyages, but it would let a
-- voluntary leaver keep receiving a still-active Voyage's private Realtime
-- channel. Keep this predicate narrow: current active members only.
create or replace function public.is_active_voyage_member(
  p_voyage_id uuid,
  p_user_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.voyage_members as vm
    join public.voyages as v on v.id = vm.voyage_id
    where vm.voyage_id = p_voyage_id
      and vm.user_id = p_user_id
      and vm.is_active = true
      and vm.removed_at is null
      and v.status = 'active'
  );
$$;

revoke execute on function public.is_active_voyage_member(uuid, uuid) from public, anon;
grant execute on function public.is_active_voyage_member(uuid, uuid) to authenticated;

-- Historical access remains available after a Voyage ends, but somebody who
-- voluntarily leaves an ongoing Voyage must immediately lose its ordinary
-- table/RPC read access. Organizer-removed members remain excluded forever.
create or replace function public.is_voyage_participant(
  p_voyage_id uuid,
  p_user_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
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
$$;

revoke execute on function public.is_voyage_participant(uuid, uuid) from public, anon;
grant execute on function public.is_voyage_participant(uuid, uuid) to authenticated;

-- A voluntarily-left membership keeps its player color so a later rejoin is
-- visually stable. Reserve colors held by every non-removed membership, not
-- only currently-active rows; otherwise somebody else could claim a leaver's
-- color and the required preserved color would collide when they returned.
create or replace function public.assign_player_color(p_voyage_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_color_pool constant text[] := array[
    'coral',
    'teal',
    'violet',
    'gold',
    'sky',
    'lime',
    'pink',
    'slate'
  ];
  v_used_colors text[];
  v_color text;
begin
  perform vm.id
  from public.voyage_members as vm
  where vm.voyage_id = p_voyage_id
    and vm.removed_at is null
  order by vm.id
  for update;

  select pg_catalog.array_agg(vm.player_color)
    filter (where vm.player_color is not null)
  into v_used_colors
  from public.voyage_members as vm
  where vm.voyage_id = p_voyage_id
    and vm.removed_at is null;

  select colors.color
  into v_color
  from pg_catalog.unnest(v_color_pool) as colors(color)
  where colors.color <> all (coalesce(v_used_colors, array[]::text[]))
  order by pg_catalog.array_position(v_color_pool, colors.color)
  limit 1;

  return v_color;
end;
$$;

revoke execute on function public.assign_player_color(uuid)
  from public, anon, authenticated;

-- Coordinate an in-flight GPS write with membership departure. Without this
-- row lock, upsert_location() could read an active membership, pause, then
-- recreate its location row after Leave had deleted it. A shared membership
-- lock lets the location transaction finish first; departure then takes the
-- conflicting update lock and performs the final delete. If departure wins
-- first, the active-member lookup below rechecks and rejects the write.
create or replace function public.upsert_location(
  p_voyage_id uuid,
  p_lat double precision,
  p_lng double precision,
  p_heading double precision default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_voyage_member_id uuid;
  v_updated_at timestamptz := pg_catalog.clock_timestamp();
begin
  if p_lat is null or not (p_lat between -90 and 90) then
    raise exception 'Latitude must be between -90 and 90.' using errcode = '22023';
  end if;

  if p_lng is null or not (p_lng between -180 and 180) then
    raise exception 'Longitude must be between -180 and 180.' using errcode = '22023';
  end if;

  if p_heading is not null and not (p_heading between 0 and 360) then
    raise exception 'Heading must be between 0 and 360.' using errcode = '22023';
  end if;

  select vm.id
  into v_voyage_member_id
  from public.voyage_members as vm
  join public.voyages as v on v.id = vm.voyage_id
  where vm.voyage_id = p_voyage_id
    and vm.user_id = v_user_id
    and vm.removed_at is null
    and vm.is_active = true
    and v.status = 'active'
  for share of vm;

  if v_voyage_member_id is null then
    raise exception 'You are not an active member of this Voyage.' using errcode = 'LOC02';
  end if;

  insert into public.voyage_member_locations as locations (
    voyage_member_id,
    lat,
    lng,
    heading,
    updated_at
  )
  values (
    v_voyage_member_id,
    p_lat,
    p_lng,
    p_heading,
    v_updated_at
  )
  on conflict (voyage_member_id) do update
  set lat = excluded.lat,
      lng = excluded.lng,
      heading = excluded.heading,
      updated_at = excluded.updated_at
  where locations.updated_at < excluded.updated_at;

  perform realtime.send(
    jsonb_build_object(
      'user_id', v_user_id,
      'lat', p_lat,
      'lng', p_lng,
      'heading', p_heading,
      'updated_at', v_updated_at
    ),
    'location',
    'voyage:' || p_voyage_id::text,
    true
  );
end;
$$;

revoke execute on function public.upsert_location(
  uuid,
  double precision,
  double precision,
  double precision
) from public, anon;
grant execute on function public.upsert_location(
  uuid,
  double precision,
  double precision,
  double precision
) to authenticated;

-- Internal lifecycle primitive shared by explicit Leave, sign-out cleanup,
-- and join_voyage's old-Voyage cleanup. It is intentionally not callable by
-- API roles because it accepts an explicit user id and bypasses RLS.
--
-- Every caller/user transition takes the same transaction-level advisory
-- lock. Unlike a row lock, this also serializes the first membership insert
-- when no membership row exists yet. The Voyage row is then locked before
-- member rows, matching join_voyage's deterministic lock order.
--
-- An active Voyage may never be left with zero Organizers. If the departing
-- member is its last active Organizer, the only non-arbitrary transition is
-- to end the Voyage and deactivate everybody; this deliberately avoids
-- silently promoting another user.
create or replace function public.depart_voyage_membership(
  p_user_id uuid,
  p_voyage_id uuid
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_member_id uuid;
  v_member_role text;
  v_voyage_status text;
  v_active_organizer_count integer;
  v_departed_at timestamptz := pg_catalog.clock_timestamp();
begin
  if p_user_id is null or p_voyage_id is null then
    raise exception 'A user and Voyage are required.' using errcode = '22023';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_user_id::text, 0)
  );

  select v.status
  into v_voyage_status
  from public.voyages as v
  where v.id = p_voyage_id
  for update;

  if not found then
    return 'none';
  end if;

  select vm.id, vm.role
  into v_member_id, v_member_role
  from public.voyage_members as vm
  where vm.voyage_id = p_voyage_id
    and vm.user_id = p_user_id
    and vm.is_active = true
    and vm.removed_at is null
  order by vm.joined_at desc, vm.id desc
  limit 1
  for update;

  -- Idempotent for sign-out and retry safety. The normal schema invariant
  -- permits at most one active, non-removed membership for this user.
  if not found then
    return 'none';
  end if;

  -- Lock the actual organizer rows first, then aggregate in a separate
  -- statement. PostgreSQL rejects FOR UPDATE directly on an aggregate query.
  perform vm.id
  from public.voyage_members as vm
  where vm.voyage_id = p_voyage_id
    and vm.role = 'organizer'
    and vm.is_active = true
    and vm.removed_at is null
  order by vm.id
  for update;

  select pg_catalog.count(*)::integer
  into v_active_organizer_count
  from public.voyage_members as vm
  where vm.voyage_id = p_voyage_id
    and vm.role = 'organizer'
    and vm.is_active = true
    and vm.removed_at is null;

  -- A departing user's durable last location must not reappear if they later
  -- rejoin and the same membership row is reactivated.
  delete from public.voyage_member_locations as locations
  where locations.voyage_member_id = v_member_id;

  update public.voyage_members as vm
  set is_active = false,
      left_at = v_departed_at,
      travel_role = null
  where vm.id = v_member_id;

  if v_voyage_status = 'active'
    and v_member_role = 'organizer'
    and v_active_organizer_count <= 1 then
    update public.voyages as v
    set status = 'ended',
        ended_at = v_departed_at
    where v.id = p_voyage_id
      and v.status = 'active';

    update public.voyage_members as vm
    set is_active = false
    where vm.voyage_id = p_voyage_id
      and vm.is_active = true;

    return 'ended';
  end if;

  return 'left';
end;
$$;

revoke execute on function public.depart_voyage_membership(uuid, uuid)
  from public, anon, authenticated;

-- Explicit Leave is offered only to a member other than the person who
-- started the Voyage. Authorization is enforced here, not left to UI hiding.
-- A promoted Organizer may leave; if they are the last active Organizer the
-- shared primitive atomically ends the Voyage rather than orphaning it.
create or replace function public.leave_voyage(p_voyage_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_created_by uuid;
begin
  if v_user_id is null then
    raise exception 'Authentication is required.' using errcode = '28000';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(v_user_id::text, 0)
  );

  select v.created_by
  into v_created_by
  from public.voyages as v
  join public.voyage_members as vm on vm.voyage_id = v.id
  where v.id = p_voyage_id
    and vm.user_id = v_user_id
    and vm.is_active = true
    and vm.removed_at is null;

  if not found then
    raise exception 'You are not an active member of this Voyage.' using errcode = 'LEAV1';
  end if;

  if v_created_by = v_user_id then
    raise exception 'The person who started this Voyage must end it instead.' using errcode = 'LEAV2';
  end if;

  perform public.depart_voyage_membership(v_user_id, p_voyage_id);
end;
$$;

revoke execute on function public.leave_voyage(uuid) from public, anon;
grant execute on function public.leave_voyage(uuid) to authenticated;

-- Sign-out cleanup is intentionally idempotent and is allowed for the Voyage
-- creator. If the signing-out user is the last Organizer, the Voyage ends;
-- otherwise only that user's membership is deactivated. The client must call
-- this while its authenticated session still exists, before auth.signOut().
create or replace function public.leave_active_voyage()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_voyage_id uuid;
begin
  if v_user_id is null then
    raise exception 'Authentication is required.' using errcode = '28000';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(v_user_id::text, 0)
  );

  select vm.voyage_id
  into v_voyage_id
  from public.voyage_members as vm
  where vm.user_id = v_user_id
    and vm.is_active = true
    and vm.removed_at is null
  order by vm.joined_at desc, vm.id desc
  limit 1;

  if v_voyage_id is null then
    return;
  end if;

  perform public.depart_voyage_membership(v_user_id, v_voyage_id);
end;
$$;

revoke execute on function public.leave_active_voyage() from public, anon;
grant execute on function public.leave_active_voyage() to authenticated;

-- Repair remove_voyager's last-Organizer lock. Its previous
-- `select array_agg(...) ... for update` fails at runtime because PostgreSQL
-- does not permit a row-locking clause on an aggregate query. It also now
-- shares the target user's advisory lock with join/leave, so removal cannot
-- race that user's membership transition.
create or replace function public.remove_voyager(
  p_voyage_id uuid,
  p_target_user_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_is_organizer boolean;
  v_target_is_organizer boolean;
  v_active_organizer_count integer;
begin
  if v_user_id is null then
    raise exception 'Authentication is required.' using errcode = '28000';
  end if;

  if p_target_user_id is null then
    raise exception 'That person is not an active member of this Voyage.' using errcode = 'REM03';
  end if;

  if p_target_user_id = v_user_id then
    raise exception 'An Organizer cannot remove themselves with this action.' using errcode = 'REM04';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_target_user_id::text, 0)
  );

  -- Serialize against end/depart/join for this Voyage before locking member
  -- rows. All new lifecycle paths use this same Voyage-then-member order.
  perform v.id
  from public.voyages as v
  where v.id = p_voyage_id
  for update;

  select exists (
    select 1
    from public.voyage_members as vm
    where vm.voyage_id = p_voyage_id
      and vm.user_id = v_user_id
      and vm.role = 'organizer'
      and vm.removed_at is null
      and vm.is_active = true
  )
  into v_is_organizer;

  if not v_is_organizer then
    raise exception 'Only an Organizer can remove a Voyager.' using errcode = 'REM01';
  end if;

  perform vm.id
  from public.voyage_members as vm
  where vm.voyage_id = p_voyage_id
    and vm.role = 'organizer'
    and vm.removed_at is null
    and vm.is_active = true
  order by vm.id
  for update;

  select
    pg_catalog.count(*)::integer,
    coalesce(
      pg_catalog.bool_or(vm.user_id = p_target_user_id),
      false
    )
  into v_active_organizer_count, v_target_is_organizer
  from public.voyage_members as vm
  where vm.voyage_id = p_voyage_id
    and vm.role = 'organizer'
    and vm.removed_at is null
    and vm.is_active = true;

  if v_target_is_organizer and v_active_organizer_count <= 1 then
    raise exception 'A Voyage must always have at least one Organizer.' using errcode = 'REM02';
  end if;

  update public.voyage_members as vm
  set is_active = false,
      removed_at = pg_catalog.clock_timestamp(),
      left_at = null,
      removal_acknowledged_at = null,
      travel_role = null
  where vm.voyage_id = p_voyage_id
    and vm.user_id = p_target_user_id
    and vm.removed_at is null
    and vm.is_active = true;

  if not found then
    raise exception 'That person is not an active member of this Voyage.' using errcode = 'REM03';
  end if;

  delete from public.voyage_member_locations as locations
  using public.voyage_members as vm
  where locations.voyage_member_id = vm.id
    and vm.voyage_id = p_voyage_id
    and vm.user_id = p_target_user_id;
end;
$$;

revoke execute on function public.remove_voyager(uuid, uuid) from public, anon;
grant execute on function public.remove_voyager(uuid, uuid) to authenticated;

-- Joining is one server-side transaction: validate and lock the requested
-- target first; only then depart any stale/prior active membership; finally
-- reactivate a voluntary-left row or insert a new membership. An invalid,
-- ended, or Organizer-blocked invite therefore never ejects the caller from
-- their current Voyage.
create or replace function public.join_voyage(p_join_code text)
returns public.voyages
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_voyage_id uuid;
  v_status text;
  v_created_by uuid;
  v_existing_member_id uuid;
  v_existing_is_active boolean;
  v_player_color text;
  v_old_voyage_id uuid;
  v_joined_at timestamptz := pg_catalog.clock_timestamp();
  v_result public.voyages;
begin
  if v_user_id is null then
    raise exception 'Authentication is required.' using errcode = '28000';
  end if;

  if p_join_code is null or pg_catalog.btrim(p_join_code) = '' then
    raise exception 'A Join Code/Link is required.' using errcode = '22023';
  end if;

  -- Resolve once for a fast, side-effect-free error, then re-read after the
  -- row locks below so an end_voyage racing this call cannot slip through.
  select v.id, v.status
  into v_voyage_id, v_status
  from public.voyages as v
  where v.join_code = p_join_code;

  if not found then
    raise exception 'This invite link is not valid.' using errcode = 'JOIN1';
  end if;

  if v_status <> 'active' then
    raise exception 'This trip has already ended.' using errcode = 'JOIN2';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(v_user_id::text, 0)
  );

  -- Lock target and prior Voyage rows in one deterministic UUID order. This
  -- prevents the A->B / B->A switch pattern from deadlocking.
  perform v.id
  from public.voyages as v
  where v.id = v_voyage_id
     or exists (
       select 1
       from public.voyage_members as vm
       where vm.voyage_id = v.id
         and vm.user_id = v_user_id
         and vm.is_active = true
         and vm.removed_at is null
     )
  order by v.id
  for update;

  select v.status, v.created_by
  into v_status, v_created_by
  from public.voyages as v
  where v.id = v_voyage_id;

  if not found then
    raise exception 'This invite link is not valid.' using errcode = 'JOIN1';
  end if;

  if v_status <> 'active' then
    raise exception 'This trip has already ended.' using errcode = 'JOIN2';
  end if;

  -- Organizer-forced removal remains a permanent block for this Voyage.
  -- This check intentionally happens before any old membership is changed.
  if exists (
    select 1
    from public.voyage_members as vm
    where vm.voyage_id = v_voyage_id
      and vm.user_id = v_user_id
      and vm.removed_at is not null
  ) then
    raise exception 'This invite is no longer valid for you.' using errcode = 'JOIN3';
  end if;

  -- AD-9 normally makes this loop run zero or one time. Keeping it as a loop
  -- also heals any stale pre-constraint data without a client-side cleanup
  -- round trip.
  for v_old_voyage_id in
    select vm.voyage_id
    from public.voyage_members as vm
    where vm.user_id = v_user_id
      and vm.is_active = true
      and vm.removed_at is null
      and vm.voyage_id <> v_voyage_id
    order by vm.voyage_id
  loop
    perform public.depart_voyage_membership(v_user_id, v_old_voyage_id);
  end loop;

  -- No uniqueness constraint on (voyage_id, user_id) was historically
  -- present, so choose the newest non-removed row defensively. New lifecycle
  -- calls are serialized by the per-user advisory lock and will reuse it.
  select vm.id, vm.is_active, vm.player_color
  into v_existing_member_id, v_existing_is_active, v_player_color
  from public.voyage_members as vm
  where vm.voyage_id = v_voyage_id
    and vm.user_id = v_user_id
    and vm.removed_at is null
  order by vm.is_active desc, vm.joined_at desc, vm.id desc
  limit 1
  for update;

  if found then
    if not v_existing_is_active then
      if v_player_color is null then
        v_player_color := public.assign_player_color(v_voyage_id);
      end if;

      -- Defensive deletion in addition to departure-time deletion prevents a
      -- legacy pre-left_at location from resurfacing on row reactivation.
      delete from public.voyage_member_locations as locations
      where locations.voyage_member_id = v_existing_member_id;

      update public.voyage_members as vm
      set is_active = true,
          left_at = null,
          removal_acknowledged_at = null,
          joined_at = v_joined_at,
          role = case
            when v_created_by = v_user_id then 'organizer'
            else 'voyager'
          end,
          player_color = v_player_color,
          travel_role = null
      where vm.id = v_existing_member_id;
    end if;
  else
    v_player_color := public.assign_player_color(v_voyage_id);

    insert into public.voyage_members (
      voyage_id,
      user_id,
      role,
      joined_at,
      player_color,
      travel_role,
      left_at
    )
    values (
      v_voyage_id,
      v_user_id,
      case
        when v_created_by = v_user_id then 'organizer'
        else 'voyager'
      end,
      v_joined_at,
      v_player_color,
      null,
      null
    );
  end if;

  select v.*
  into strict v_result
  from public.voyages as v
  where v.id = v_voyage_id;

  return v_result;
end;
$$;

revoke execute on function public.join_voyage(text) from public, anon;
grant execute on function public.join_voyage(text) to authenticated;

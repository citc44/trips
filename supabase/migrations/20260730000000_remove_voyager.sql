-- Story 2.6: Remove Voyager.

-- The actual removal RPC. Mirrors grant_organizer_status()'s established
-- shape (itself mirroring end_voyage()). The removal + last-organizer guard
-- are folded into a single atomic UPDATE ... WHERE so a target whose
-- membership changes concurrently can't be removed after the fact (same
-- race-free discipline end_voyage()/grant_organizer_status() already
-- established -- applied correctly from the start this time).
create or replace function public.remove_voyager(p_voyage_id uuid, p_target_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_is_organizer boolean;
  v_target_is_organizer boolean;
  v_active_organizer_count int;
begin
  select exists (
    select 1 from public.voyage_members
    where voyage_id = p_voyage_id
      and user_id = auth.uid()
      and role = 'organizer'
      and removed_at is null
      and is_active = true
  ) into v_is_organizer;

  if not v_is_organizer then
    raise exception 'Only an Organizer can remove a Voyager.' using errcode = 'REM01';
  end if;

  select exists (
    select 1 from public.voyage_members
    where voyage_id = p_voyage_id
      and user_id = p_target_user_id
      and role = 'organizer'
      and removed_at is null
      and is_active = true
  ) into v_target_is_organizer;

  if v_target_is_organizer then
    -- Lock this Voyage's organizer rows for the rest of this transaction, so
    -- a concurrent remove_voyager() call targeting a *different* Organizer
    -- can't both pass this count check before either commits -- the last-
    -- Organizer invariant spans multiple rows, so (unlike a single-row state
    -- transition) folding it into one UPDATE ... WHERE isn't enough on its
    -- own; an explicit row lock is the correct tool here.
    select count(*) into v_active_organizer_count
    from public.voyage_members
    where voyage_id = p_voyage_id
      and role = 'organizer'
      and removed_at is null
      and is_active = true
    for update;

    if v_active_organizer_count <= 1 then
      raise exception 'A Voyage must always have at least one Organizer.' using errcode = 'REM02';
    end if;
  end if;

  update public.voyage_members
  set is_active = false, removed_at = now()
  where voyage_id = p_voyage_id
    and user_id = p_target_user_id
    and removed_at is null
    and is_active = true;

  if not found then
    raise exception 'That person is not an active member of this Voyage.' using errcode = 'REM03';
  end if;
end;
$$;

revoke execute on function public.remove_voyager(uuid, uuid) from public;
revoke execute on function public.remove_voyager(uuid, uuid) from anon;

-- Closes a re-admission gap in join_voyage() (Story 2.3): its idempotent-
-- rejoin check only ever matched an *active* membership row, so a
-- previously-removed row (removed_at is not null) fell through to the normal
-- insert path -- nothing stopped a removed user from rejoining via the same
-- code, directly contradicting this story's AC2. Added as a new check before
-- the existing logic; everything else in the function is unchanged.
create or replace function public.join_voyage(p_join_code text)
returns public.voyages
language plpgsql
security definer
set search_path = public
as $$
declare
  v_voyage_id uuid;
  v_status text;
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

  begin
    insert into public.voyage_members (voyage_id, user_id, role)
    values (v_voyage_id, auth.uid(), 'voyager');
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

-- "You've left this Voyage" detection. Scoped per-membership-row, not
-- per-account (unlike Story 2.5's profiles.display_name) -- a removal is
-- specific to one Voyage, and the acknowledgment must not leak across a
-- different Voyage a removed user later joins.
alter table public.voyage_members
  add column removal_acknowledged_at timestamptz;

-- security definer, NOT invoker, despite only ever touching the caller's own
-- rows via auth.uid(): is_voyage_participant() (the predicate behind
-- voyage_members' own SELECT RLS policy) explicitly requires `removed_at is
-- null` -- by design, to close off a removed user's read access to the
-- Voyage they were removed from. That same design means normal RLS would
-- also block a removed user from reading their *own* removed row through an
-- ordinary security-invoker query, so this function must bypass RLS on
-- purpose to let them read exactly (and only) their own removal notice.
create or replace function public.get_removal_notice()
returns table (voyage_id uuid, destination text)
language sql
stable
security definer
set search_path = public
as $$
  select vm.voyage_id, v.destination
  from public.voyage_members vm
  join public.voyages v on v.id = vm.voyage_id
  where vm.user_id = auth.uid()
    and vm.removed_at is not null
    and vm.removal_acknowledged_at is null
  order by vm.removed_at desc
  limit 1;
$$;

revoke execute on function public.get_removal_notice() from public;
revoke execute on function public.get_removal_notice() from anon;

-- Same security definer reasoning as get_removal_notice() -- writes the
-- caller's own already-removed row, which normal RLS (via
-- voyage_members_update policy, if one even existed) would not reach either.
create or replace function public.acknowledge_removal(p_voyage_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.voyage_members
  set removal_acknowledged_at = now()
  where voyage_id = p_voyage_id
    and user_id = auth.uid()
    and removed_at is not null
    and removal_acknowledged_at is null;
end;
$$;

revoke execute on function public.acknowledge_removal(uuid) from public;
revoke execute on function public.acknowledge_removal(uuid) from anon;

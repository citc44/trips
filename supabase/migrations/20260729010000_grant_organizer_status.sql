-- Story 2.5: Grant Organizer Status.

-- The list Grant Organizer picks from. security definer: needs to read
-- profiles.display_name for OTHER users, which the existing
-- profiles_select_own RLS policy does not permit (a fellow Voyager currently
-- has zero read access to anyone else's profile row). Deliberately does NOT
-- weaken profiles' RLS policies to fix this -- that would open every profile
-- field (including future ones) to every co-participant indefinitely.
-- Instead, a narrow, explicit projection: only user_id, display_name, role,
-- joined_at, never the full profiles or voyage_members row -- same
-- narrow-projection precedent get_voyage_preview() established for a
-- different table pair.
create or replace function public.get_voyage_members(p_voyage_id uuid)
returns table (
  user_id uuid,
  display_name text,
  role text,
  joined_at timestamptz
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
    select vm.user_id, p.display_name, vm.role, vm.joined_at
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

-- Grants Organizer status to an existing, active member of the same Voyage.
-- security definer, same authorization shape end_voyage() already
-- established (active-organizer check against voyage_members).
create or replace function public.grant_organizer_status(p_voyage_id uuid, p_target_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_is_organizer boolean;
  v_target_is_member boolean;
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
    raise exception 'Only an Organizer can grant Organizer status.' using errcode = 'ORG01';
  end if;

  select exists (
    select 1 from public.voyage_members
    where voyage_id = p_voyage_id
      and user_id = p_target_user_id
      and removed_at is null
      and is_active = true
  ) into v_target_is_member;

  if not v_target_is_member then
    raise exception 'That person is not an active member of this Voyage.' using errcode = 'ORG02';
  end if;

  -- Idempotent: granting Organizer status to someone who already has it is a
  -- normal, expected outcome (AC2: a Voyage can have multiple simultaneous
  -- Organizers), not an error to reject.
  update public.voyage_members
  set role = 'organizer'
  where voyage_id = p_voyage_id
    and user_id = p_target_user_id;
end;
$$;

revoke execute on function public.grant_organizer_status(uuid, uuid) from public;
revoke execute on function public.grant_organizer_status(uuid, uuid) from anon;

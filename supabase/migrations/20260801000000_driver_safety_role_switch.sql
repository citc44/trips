-- Story 3.4: Driver-Safety Role Switch.
-- Adds the self-declared, per-Voyage Riding/Driving safety role. Deliberately
-- named `travel_role`, not `role` -- `voyage_members.role` already means the
-- organizer/voyager membership role (Story 2.x), a completely different
-- concept.

-- Nullable, no default: null means "hasn't landed on Live Map yet this
-- Voyage, show the role prompt." Unlike player_color (Story 3.2), this is
-- deliberately NOT assigned at insert time in start_voyage()/join_voyage() --
-- null is a meaningful state here, not a gap to fill immediately.
alter table public.voyage_members
  add column travel_role text check (travel_role in ('riding', 'driving'));

-- Structurally almost identical to upsert_location() (Story 3.2): find the
-- caller's own active-membership row for the Voyage, then write. Serves both
-- the first-landing prompt's choice and every later status-pill tap -- one
-- function, no separate RPC for the pill switch. No separate application-
-- level validation of p_travel_role -- the column's own check constraint is
-- the authoritative guard, and the client's TS type already restricts
-- callers to the two valid literals.
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

-- get_voyage_members(): extended again (previously extended for player_color
-- in Story 3.2) to also return travel_role, so the roster list and marker
-- peek card can show each Voyager's real Riding/Driving status instead of
-- Story 3.2's hardcoded "Riding" placeholder.
--
-- Postgres rejects changing a function's return-column set via CREATE OR
-- REPLACE FUNCTION alone (adding travel_role as a 6th output column counts
-- as such a change) -- it must be dropped first, same gotcha hit in Story
-- 3.2's migration.
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

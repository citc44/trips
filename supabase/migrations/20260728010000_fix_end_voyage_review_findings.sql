-- Story 2.4 code review fixes.

-- 1. is_voyage_participant() was left at Postgres's default PUBLIC-execute
--    grant -- a security definer function bypassing RLS, reachable via
--    POST /rest/v1/rpc/is_voyage_participant with no Authorization header,
--    exactly the anonymous-membership-disclosure bug Story 2.1's code review
--    already found and live-verified for its sibling function
--    is_active_voyage_member() (see 20260727000200_revoke_anon_is_active_voyage_member.sql).
--    Both statements needed -- revoking from public alone leaves anon still
--    able to call it on this platform.
revoke execute on function public.is_voyage_participant(uuid, uuid) from public;
revoke execute on function public.is_voyage_participant(uuid, uuid) from anon;

-- 2. get_my_active_voyage() is security invoker (RLS still applies, and a null
--    auth.uid() for an anon caller matches no rows either way), so this is
--    lower-risk than #1, but added for consistency with the migration's own
--    established explicit-revoke discipline.
revoke execute on function public.get_my_active_voyage() from public;
revoke execute on function public.get_my_active_voyage() from anon;

-- 3. end_voyage()'s status/authorization checks were not atomic with its
--    updates: a separate, unlocked `select status` before the `update` meant
--    two concurrent calls (double-tap, retried request) could both pass the
--    "not yet ended" check before either committed. Fixed by making the
--    status transition itself the race-free operation -- `update ... where
--    status = 'active'` can only ever match for one concurrent caller, so a
--    second caller's update simply matches zero rows and falls into the
--    already-ended branch, no row lock needed.
create or replace function public.end_voyage(p_voyage_id uuid)
returns table (
  id uuid,
  destination text,
  status text,
  created_by uuid,
  created_at timestamptz,
  ended_at timestamptz,
  join_code text,
  voyager_count bigint
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_is_organizer boolean;
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
    -- Real authorization boundary, not just a UI nicety -- this function must
    -- not trust the client to only ever call it as an Organizer.
    raise exception 'Only the Organizer can end this Voyage.' using errcode = 'END03';
  end if;

  update public.voyages
  set status = 'ended', ended_at = now()
  where id = p_voyage_id
    and status = 'active';

  if not found then
    if exists (select 1 from public.voyages where id = p_voyage_id) then
      raise exception 'This Voyage has already ended.' using errcode = 'END02';
    else
      raise exception 'This Voyage does not exist.' using errcode = 'END01';
    end if;
  end if;

  -- Releases AD-9's per-user lock for every member of this Voyage, not just
  -- the Organizer.
  update public.voyage_members
  set is_active = false
  where voyage_id = p_voyage_id
    and is_active = true;

  return query
    select v.id, v.destination, v.status, v.created_by, v.created_at, v.ended_at, v.join_code,
      (select count(*) from public.voyage_members vm where vm.voyage_id = v.id and vm.removed_at is null)
    from public.voyages v
    where v.id = p_voyage_id;
end;
$$;

revoke execute on function public.end_voyage(uuid) from public;
revoke execute on function public.end_voyage(uuid) from anon;

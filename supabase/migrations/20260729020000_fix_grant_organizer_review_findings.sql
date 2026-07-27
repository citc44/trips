-- Story 2.5 code review fixes.

-- 1. set_display_name() was left at Postgres's default PUBLIC-execute grant.
--    Not a live security hole (still security invoker, RLS still blocks a
--    real write since anon's auth.uid() is null and profiles_insert_own
--    requires auth.uid() = user_id) -- but an anon caller hits a raw NOT
--    NULL constraint violation instead of a clean error. Same two-line fix
--    every other locked-down RPC in this project already has.
revoke execute on function public.set_display_name(text) from public;
revoke execute on function public.set_display_name(text) from anon;

-- 2. grant_organizer_status()'s target-membership check was not atomic with
--    its update -- the same check-then-act shape end_voyage() had before
--    Story 2.4's own code review found and fixed a race there. Fixed the
--    same way: fold the state check into the UPDATE ... WHERE clause itself,
--    so a target whose membership changes between the check and the update
--    (e.g. a concurrent end_voyage() deactivating everyone) can no longer be
--    silently promoted after the fact.
create or replace function public.grant_organizer_status(p_voyage_id uuid, p_target_user_id uuid)
returns void
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
    raise exception 'Only an Organizer can grant Organizer status.' using errcode = 'ORG01';
  end if;

  update public.voyage_members
  set role = 'organizer'
  where voyage_id = p_voyage_id
    and user_id = p_target_user_id
    and removed_at is null
    and is_active = true;

  if not found then
    raise exception 'That person is not an active member of this Voyage.' using errcode = 'ORG02';
  end if;
end;
$$;

revoke execute on function public.grant_organizer_status(uuid, uuid) from public;
revoke execute on function public.grant_organizer_status(uuid, uuid) from anon;

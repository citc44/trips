-- Close the cross-service sign-out race.
--
-- The client deliberately departs membership before calling Auth sign-out so
-- it still has a usable access token. A second device could, however, join a
-- Voyage in the narrow interval between those two requests. Supabase removes
-- auth.sessions rows when logout completes, so deletion of the user's final
-- session is the durable server-side fence: serialize on that user and depart
-- anything that managed to become active in the interval.
create or replace function public.depart_voyage_after_last_auth_session()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_voyage_id uuid;
begin
  -- Local/session-scoped logout must not remove shared account membership
  -- while another Auth session remains. The app uses global logout, for which
  -- this becomes false after the final row is deleted.
  if exists (
    select 1
    from auth.sessions as sessions
    where sessions.user_id = old.user_id
  ) then
    return old;
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(old.user_id::text, 0)
  );

  -- Normally zero rows because the client already departed. Keeping the loop
  -- heals a cross-device race and any legacy multi-active data atomically.
  for v_voyage_id in
    select vm.voyage_id
    from public.voyage_members as vm
    where vm.user_id = old.user_id
      and vm.is_active = true
      and vm.removed_at is null
    order by vm.voyage_id
  loop
    perform public.depart_voyage_membership(old.user_id, v_voyage_id);
  end loop;

  return old;
end;
$$;

revoke execute on function public.depart_voyage_after_last_auth_session()
  from public, anon, authenticated;

drop trigger if exists auth_sessions_depart_voyage_after_last_session
  on auth.sessions;

create trigger auth_sessions_depart_voyage_after_last_session
after delete on auth.sessions
for each row
execute function public.depart_voyage_after_last_auth_session();

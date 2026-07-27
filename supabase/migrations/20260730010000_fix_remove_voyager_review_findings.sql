-- Story 2.6 code review fixes for remove_voyager().
--
-- Two findings, both independently confirmed by two review layers:
--
-- 1. No server-side guard against self-removal. The UI hides the Remove
--    control on the viewer's own row, but the RPC itself never checked
--    p_target_user_id = auth.uid(), so a direct call could self-remove.
--
-- 2. TOCTOU race in the last-Organizer guard. The original version read
--    "is the target currently an Organizer?" via a separate, unlocked SELECT
--    before deciding whether to even acquire the row lock. If a concurrent
--    grant_organizer_status() promoted the target between that read and this
--    function's final UPDATE, the lock (and the count check inside it) was
--    skipped entirely. Fixed by always locking this Voyage's organizer rows
--    up front, unconditionally, and deriving both "is the target one of
--    them" and the count from that single locked snapshot -- removing the
--    unlocked pre-check instead of trying to patch around it.
create or replace function public.remove_voyager(p_voyage_id uuid, p_target_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_is_organizer boolean;
  v_active_organizer_ids uuid[];
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

  if p_target_user_id = auth.uid() then
    raise exception 'An Organizer cannot remove themselves with this action.' using errcode = 'REM04';
  end if;

  select array_agg(user_id) into v_active_organizer_ids
  from public.voyage_members
  where voyage_id = p_voyage_id
    and role = 'organizer'
    and removed_at is null
    and is_active = true
  for update;

  if p_target_user_id = any(v_active_organizer_ids)
    and coalesce(array_length(v_active_organizer_ids, 1), 0) <= 1 then
    raise exception 'A Voyage must always have at least one Organizer.' using errcode = 'REM02';
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

-- Fix: end_voyage() raised "column reference \"id\" is ambiguous" on every
-- call, so no Voyage could ever be ended.
--
-- Root cause: end_voyage() is `RETURNS TABLE (id uuid, destination text,
-- status text, ...)`. In plpgsql, those OUT columns become variables in
-- scope for the whole function body -- so the unqualified `id` and `status`
-- in the status-transition UPDATE's WHERE clause were ambiguous between the
-- public.voyages column and the function's own OUT parameter of the same
-- name. Postgres reports the first ambiguity it hits scanning the WHERE
-- clause, which is why only "id" (not "status", listed second) ever showed
-- up in the error. Fixed by aliasing the target table and qualifying both
-- WHERE-clause references -- the SET clause's target list (`status = ...`)
-- was never ambiguous, since UPDATE always resolves SET targets against the
-- target table, not local variables.
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

  update public.voyages as v
  set status = 'ended', ended_at = now()
  where v.id = p_voyage_id
    and v.status = 'active';

  if not found then
    if exists (select 1 from public.voyages where public.voyages.id = p_voyage_id) then
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

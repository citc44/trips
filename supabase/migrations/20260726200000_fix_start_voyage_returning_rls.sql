-- Fix (found via live verification, Story 2.1): the original start_voyage()
-- inserted into voyages with `returning * into new_voyage`. Postgres RLS applies
-- a table's SELECT policies to an INSERT's RETURNING clause, not just WITH CHECK
-- (documented Postgres behavior). voyages_select_members requires an active
-- voyage_members row (is_active_voyage_member) -- which doesn't exist yet at the
-- instant the voyages row is first inserted, since the organizer's own
-- membership row is created in the *next* statement. RETURNING therefore always
-- failed RLS, even for the legitimate creator, confirmed live against voylo-dev
-- (a bare insert with no RETURNING succeeded; the identical insert with
-- RETURNING failed with "new row violates row-level security policy").
--
-- Fixed by generating the voyage id up front, inserting both rows without
-- relying on RETURNING, and only reading the voyage back (a plain SELECT,
-- governed by the same SELECT policy) after the membership row exists --
-- at which point is_active_voyage_member is satisfied normally. No RLS
-- policy needed loosening; AD-1's predicate stays exactly as specified.
create or replace function public.start_voyage(p_destination text)
returns public.voyages
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_voyage_id uuid;
  new_voyage public.voyages;
begin
  if p_destination is null or btrim(p_destination) = '' then
    raise exception 'Destination is required.' using errcode = '22023';
  end if;

  v_voyage_id := gen_random_uuid();

  insert into public.voyages (id, destination, created_by)
  values (v_voyage_id, btrim(p_destination), auth.uid());

  begin
    insert into public.voyage_members (voyage_id, user_id, role)
    values (v_voyage_id, auth.uid(), 'organizer');
  exception
    when unique_violation then
      raise exception 'You already have an active Voyage.' using errcode = 'P0001';
  end;

  select * into new_voyage from public.voyages where id = v_voyage_id;

  return new_voyage;
end;
$$;

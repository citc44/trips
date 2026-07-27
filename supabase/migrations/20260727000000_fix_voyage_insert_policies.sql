-- Code review fix (Story 2.1): voyages_insert_own and voyage_members_insert_self
-- were far too permissive -- each only checked that the caller was inserting a
-- row naming themselves (created_by = auth.uid() / user_id = auth.uid()), with
-- zero restriction on which voyage_id or role. Any authenticated user could
-- POST directly to /rest/v1/voyage_members with an arbitrary existing voyage_id
-- and role: 'organizer', self-escalating into someone else's active Voyage --
-- completely bypassing start_voyage() and AD-9's intended enforcement point.
-- Found independently by two review layers.
--
-- Fixed by removing both INSERT policies entirely (RLS default-denies direct
-- inserts on either table once no permissive INSERT policy exists) and making
-- start_voyage() security definer, so it becomes the *only* path either table
-- can be written through -- a real enforcement boundary, not a convenience
-- wrapper sitting on top of open policies.
drop policy if exists "voyages_insert_own" on public.voyages;
drop policy if exists "voyage_members_insert_self" on public.voyage_members;

create or replace function public.start_voyage(p_destination text)
returns public.voyages
language plpgsql
security definer
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

  select * into strict new_voyage from public.voyages where id = v_voyage_id;

  return new_voyage;
end;
$$;

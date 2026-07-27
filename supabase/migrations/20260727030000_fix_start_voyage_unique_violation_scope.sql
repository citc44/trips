-- Fix (Story 2.2 code review): the unique_violation handler in start_voyage()
-- assumed any unique_violation on the voyages insert meant a join_code
-- collision, regenerating v_join_code and retrying against the *same*
-- v_voyage_id up to 5 times. A collision on the id primary key instead
-- (astronomically unlikely with gen_random_uuid(), but not impossible) would
-- retry identically every attempt and raise a misleading "Could not generate
-- a unique join code" error for a fault that has nothing to do with code
-- generation. Scoped the retry to the actual join_code constraint via
-- GET STACKED DIAGNOSTICS; any other unique_violation now re-raises as-is.
-- voyages_join_code_key is Postgres's standard default name for an inline
-- `column type unique` constraint (<table>_<column>_key).
create or replace function public.start_voyage(p_destination text)
returns public.voyages
language plpgsql
security definer
set search_path = public
as $$
declare
  v_alphabet constant text := '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
  v_voyage_id uuid;
  v_join_code text;
  v_attempt int := 0;
  v_constraint text;
  new_voyage public.voyages;
begin
  if p_destination is null or btrim(p_destination) = '' then
    raise exception 'Destination is required.' using errcode = '22023';
  end if;

  v_voyage_id := gen_random_uuid();

  loop
    v_join_code := (
      select string_agg(substr(v_alphabet, floor(random() * char_length(v_alphabet))::int + 1, 1), '')
      from generate_series(1, 8)
    );

    begin
      insert into public.voyages (id, destination, created_by, join_code)
      values (v_voyage_id, btrim(p_destination), auth.uid(), v_join_code);
      exit;
    exception
      when unique_violation then
        get stacked diagnostics v_constraint = constraint_name;
        if v_constraint <> 'voyages_join_code_key' then
          raise;
        end if;
        v_attempt := v_attempt + 1;
        if v_attempt >= 5 then
          raise exception 'Could not generate a unique join code, please try again.';
        end if;
    end;
  end loop;

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

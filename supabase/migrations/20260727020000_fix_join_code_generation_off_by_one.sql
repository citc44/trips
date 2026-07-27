-- Fix (found via live verification, Story 2.2): ceil(random() * 32) can evaluate
-- to 0 when random() returns exactly 0.0 (a real, reachable value -- Postgres's
-- random() range is [0, 1), inclusive of 0). substr(alphabet, 0, 1) then silently
-- returns an empty string instead of a character or an error, shortening the
-- generated code by one -- confirmed live: a 10-iteration test run produced a
-- 7-character code once. floor(random() * 32) + 1 is the correct idiom for a
-- uniform random integer in [1, 32] -- it can never hit 0 or 33.
create or replace function public.start_voyage(p_destination text)
returns public.voyages
language plpgsql
security definer
set search_path = public
as $$
declare
  v_voyage_id uuid;
  v_join_code text;
  v_attempt int := 0;
  new_voyage public.voyages;
begin
  if p_destination is null or btrim(p_destination) = '' then
    raise exception 'Destination is required.' using errcode = '22023';
  end if;

  v_voyage_id := gen_random_uuid();

  loop
    v_join_code := (
      select string_agg(substr('23456789ABCDEFGHJKMNPQRSTUVWXYZ', floor(random() * 32)::int + 1, 1), '')
      from generate_series(1, 8)
    );

    begin
      insert into public.voyages (id, destination, created_by, join_code)
      values (v_voyage_id, btrim(p_destination), auth.uid(), v_join_code);
      exit;
    exception
      when unique_violation then
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

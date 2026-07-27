-- Fix (found via live verification, Story 2.2 -- the prior fix migration's own
-- re-verification test wasn't clean, so this is a *second* live-caught bug in
-- the same expression): the "32-symbol alphabet" ('23456789ABCDEFGHJKMNPQRSTUVWXYZ',
-- excluding 0/O/1/I/L) actually only has 31 characters -- 36 alphanumeric minus
-- 5 exclusions is 31, not 32, a plain counting error. floor(random() * 32) can
-- select position 32, which is out of bounds for a 31-character string;
-- substr() silently returns an empty string rather than erroring, shortening
-- the code by one character. At 200 iterations this hit ~18.5% of generated
-- codes (37/200) -- matches the predicted 1-(31/32)^8 ≈ 22% per-code failure
-- rate almost exactly once diagnosed.
--
-- Fixed by deriving the random range from the alphabet's own char_length()
-- instead of a hardcoded literal that has to stay in sync with the string by
-- hand -- this class of mismatch can't recur. Re-verified live: 200/200
-- generated codes at exactly 8 characters.
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

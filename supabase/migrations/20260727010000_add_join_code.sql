-- Story 2.2: Generate & Share Join Code/Link.
-- Nullable, not `not null`: the RPC below always sets it for any voyage created
-- going forward, so a hard not-null constraint adds no real safety but would
-- require cleaning up pre-existing dev-sandbox test rows from Story 2.1's own
-- live verification. `unique` still applies -- Postgres allows multiple NULLs
-- under a unique constraint, so old codeless rows don't conflict with new ones.
alter table public.voyages
  add column join_code text unique;

-- Extends start_voyage() (unchanged signature/security posture from Story 2.1's
-- code review: still security definer, still the only path either table can be
-- written through) to also generate a join code atomically with Voyage
-- creation -- no second write, stays inside the existing one-transaction
-- guarantee. 8 chars from a 32-symbol alphabet excluding ambiguous characters
-- (0/O, 1/I/L), ~2^40 code space. Bounded retry loop on collision (negligible
-- odds at this scale, but cheap and correct).
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
      select string_agg(substr('23456789ABCDEFGHJKMNPQRSTUVWXYZ', ceil(random() * 32)::int, 1), '')
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

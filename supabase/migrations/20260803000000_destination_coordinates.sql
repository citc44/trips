-- Destination search/autocomplete: the destination field was free text with
-- no coordinates, so nothing could ever compute a Voyager's distance to it.
-- Adds nullable lat/lng alongside the existing text (nullable: existing rows
-- and any future manual/free-text entry have none -- the client degrades
-- gracefully and simply omits a distance readout when they're absent).

alter table public.voyages
  add column destination_lat double precision,
  add column destination_lng double precision;

-- start_voyage(): unchanged shape (still `returns public.voyages`, so the
-- new columns flow through automatically) -- only the insert gains two new,
-- optional trailing parameters. Defaulted to null, not made required: a
-- free-text destination with no picked place is still a valid Voyage.
create or replace function public.start_voyage(
  p_destination text,
  p_destination_lat double precision default null,
  p_destination_lng double precision default null
)
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
  v_player_color text;
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
      insert into public.voyages (id, destination, destination_lat, destination_lng, created_by, join_code)
      values (v_voyage_id, btrim(p_destination), p_destination_lat, p_destination_lng, auth.uid(), v_join_code);
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

  v_player_color := public.assign_player_color(v_voyage_id);

  begin
    insert into public.voyage_members (voyage_id, user_id, role, player_color)
    values (v_voyage_id, auth.uid(), 'organizer', v_player_color);
  exception
    when unique_violation then
      raise exception 'You already have an active Voyage.' using errcode = 'P0001';
  end;

  select * into strict new_voyage from public.voyages where id = v_voyage_id;

  return new_voyage;
end;
$$;

revoke execute on function public.start_voyage(text, double precision, double precision) from public;
revoke execute on function public.start_voyage(text, double precision, double precision) from anon;

-- get_my_active_voyage() and end_voyage() both use an explicit RETURNS TABLE
-- column list (unlike start_voyage/join_voyage's `returns public.voyages`),
-- so adding destination_lat/destination_lng means dropping first -- Postgres
-- rejects changing a function's return-column set via CREATE OR REPLACE
-- alone, same gotcha this project has hit before (get_voyage_members()).
drop function if exists public.get_my_active_voyage();

create or replace function public.get_my_active_voyage()
returns table (
  id uuid,
  destination text,
  destination_lat double precision,
  destination_lng double precision,
  status text,
  created_by uuid,
  created_at timestamptz,
  ended_at timestamptz,
  join_code text,
  my_role text
)
language sql
stable
security invoker
set search_path = public
as $$
  select v.id, v.destination, v.destination_lat, v.destination_lng, v.status, v.created_by, v.created_at, v.ended_at, v.join_code, vm.role
  from public.voyages v
  join public.voyage_members vm on vm.voyage_id = v.id
  where vm.user_id = auth.uid()
    and vm.is_active = true
    and vm.removed_at is null
    and v.status = 'active';
$$;

revoke execute on function public.get_my_active_voyage() from public;
revoke execute on function public.get_my_active_voyage() from anon;

drop function if exists public.end_voyage(uuid);

-- Body otherwise identical to 20260802000000_fix_end_voyage_ambiguous_id.sql
-- -- keeps that migration's table-alias qualification (id/status collide
-- with this function's own OUT parameters of the same name) -- only the
-- destination_lat/destination_lng columns are new.
create or replace function public.end_voyage(p_voyage_id uuid)
returns table (
  id uuid,
  destination text,
  destination_lat double precision,
  destination_lng double precision,
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

  update public.voyage_members
  set is_active = false
  where voyage_id = p_voyage_id
    and is_active = true;

  return query
    select v.id, v.destination, v.destination_lat, v.destination_lng, v.status, v.created_by, v.created_at, v.ended_at, v.join_code,
      (select count(*) from public.voyage_members vm where vm.voyage_id = v.id and vm.removed_at is null)
    from public.voyages v
    where v.id = p_voyage_id;
end;
$$;

revoke execute on function public.end_voyage(uuid) from public;
revoke execute on function public.end_voyage(uuid) from anon;

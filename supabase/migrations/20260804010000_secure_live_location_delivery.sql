-- Make live-location delivery authoritative and atomic.
--
-- The client previously performed two unrelated best-effort operations: a
-- throttled durable upsert and a direct Realtime broadcast. A dropped or
-- rejected broadcast therefore left every mounted map stale even when the
-- latest row was safely stored, and allowing clients to construct the
-- payload meant an active member could claim another member's user_id.
--
-- upsert_location() now derives identity from auth.uid(), writes the latest
-- position, and emits the matching private broadcast in the same database
-- transaction. Clients only need permission to receive broadcasts after
-- this migration; they can no longer publish arbitrary channel payloads.

drop policy if exists "voyage_channel_write_active_members" on realtime.messages;
drop policy if exists "voyage_channel_read_active_members" on realtime.messages;

create policy "voyage_channel_read_active_members" on realtime.messages
  for select
  to authenticated
  using (
    realtime.messages.extension = 'broadcast'
    and exists (
      select 1
      from public.voyage_members vm
      where 'voyage:' || vm.voyage_id::text = (select realtime.topic())
        and vm.user_id = (select auth.uid())
        and public.is_active_voyage_member(vm.voyage_id, (select auth.uid()))
    )
  );

create or replace function public.upsert_location(
  p_voyage_id uuid,
  p_lat double precision,
  p_lng double precision,
  p_heading double precision default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_voyage_member_id uuid;
  v_updated_at timestamptz := clock_timestamp();
begin
  if p_lat is null or not (p_lat between -90 and 90) then
    raise exception 'Latitude must be between -90 and 90.' using errcode = '22023';
  end if;

  if p_lng is null or not (p_lng between -180 and 180) then
    raise exception 'Longitude must be between -180 and 180.' using errcode = '22023';
  end if;

  if p_heading is not null and not (p_heading between 0 and 360) then
    raise exception 'Heading must be between 0 and 360.' using errcode = '22023';
  end if;

  select vm.id
  into v_voyage_member_id
  from public.voyage_members vm
  join public.voyages v on v.id = vm.voyage_id
  where vm.voyage_id = p_voyage_id
    and vm.user_id = v_user_id
    and vm.removed_at is null
    and vm.is_active = true
    and v.status = 'active';

  if v_voyage_member_id is null then
    raise exception 'You are not an active member of this Voyage.' using errcode = 'LOC02';
  end if;

  insert into public.voyage_member_locations as locations (
    voyage_member_id,
    lat,
    lng,
    heading,
    updated_at
  )
  values (
    v_voyage_member_id,
    p_lat,
    p_lng,
    p_heading,
    v_updated_at
  )
  on conflict (voyage_member_id) do update
  set lat = excluded.lat,
      lng = excluded.lng,
      heading = excluded.heading,
      updated_at = excluded.updated_at
  where locations.updated_at < excluded.updated_at;

  perform realtime.send(
    jsonb_build_object(
      'user_id', v_user_id,
      'lat', p_lat,
      'lng', p_lng,
      'heading', p_heading,
      'updated_at', v_updated_at
    ),
    'location',
    'voyage:' || p_voyage_id::text,
    true
  );
end;
$$;

revoke execute on function public.upsert_location(uuid, double precision, double precision, double precision) from public, anon;
grant execute on function public.upsert_location(uuid, double precision, double precision, double precision) to authenticated;

-- Roster changes share the already-authorized Voyage topic. This lets maps
-- fetch member metadata immediately when somebody joins, is removed, or
-- changes role; location messages alone are not sufficient because marker
-- rendering intentionally joins positions against the active roster.
create or replace function public.broadcast_voyage_roster_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_voyage_id uuid;
begin
  if tg_op = 'DELETE' then
    v_voyage_id := old.voyage_id;
  else
    v_voyage_id := new.voyage_id;
  end if;

  perform realtime.send(
    jsonb_build_object('voyage_id', v_voyage_id),
    'roster_changed',
    'voyage:' || v_voyage_id::text,
    true
  );

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

revoke execute on function public.broadcast_voyage_roster_change() from public, anon, authenticated;

drop trigger if exists voyage_members_broadcast_roster_change on public.voyage_members;

create trigger voyage_members_broadcast_roster_change
after insert or update or delete on public.voyage_members
for each row execute function public.broadcast_voyage_roster_change();

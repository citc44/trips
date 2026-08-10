-- Hybrid live-journey transport: low-latency client Broadcast when a socket
-- is healthy, latest-only durable snapshots for recovery/background fallback,
-- and database-authoritative journey events on the same private topic.

alter table public.voyage_member_locations
  add column if not exists captured_at timestamptz,
  add column if not exists speed_mps double precision,
  add column if not exists accuracy_m double precision,
  add column if not exists sender_session_id text,
  add column if not exists sequence bigint;

update public.voyage_member_locations
set captured_at = updated_at
where captured_at is null;

alter table public.voyage_member_locations
  alter column captured_at set not null,
  alter column captured_at set default now();

-- Client Broadcast is permitted only for the authenticated active member and
-- only when the payload claims that same identity and Voyage. The server RPC
-- remains the background/fallback path and always derives identity itself.
drop policy if exists "voyage_channel_read_active_members" on realtime.messages;
create policy "voyage_channel_read_active_members" on realtime.messages
  for select to authenticated
  using (
    realtime.messages.extension in ('broadcast', 'presence')
    and exists (
      select 1 from public.voyage_members vm
      where 'voyage:' || vm.voyage_id::text = (select realtime.topic())
        and vm.user_id = (select auth.uid())
        and public.is_active_voyage_member(vm.voyage_id, (select auth.uid()))
    )
  );

drop policy if exists "voyage_channel_write_active_members" on realtime.messages;
create policy "voyage_channel_write_active_members" on realtime.messages
  for insert
  to authenticated
  with check (
    realtime.messages.extension = 'broadcast'
    and payload ->> 'senderUserId' = (select auth.uid())::text
    and payload ->> 'voyageId' is not null
    and (select realtime.topic()) = 'voyage:' || (payload ->> 'voyageId')
    and public.is_active_voyage_member((payload ->> 'voyageId')::uuid, (select auth.uid()))
  );

create policy "voyage_channel_presence_active_members" on realtime.messages
  for insert to authenticated
  with check (
    realtime.messages.extension = 'presence'
    and exists (
      select 1 from public.voyage_members vm
      where 'voyage:' || vm.voyage_id::text = (select realtime.topic())
        and vm.user_id = (select auth.uid())
        and public.is_active_voyage_member(vm.voyage_id, (select auth.uid()))
    )
  );

create or replace function public.upsert_location_snapshot(
  p_voyage_id uuid,
  p_lat double precision,
  p_lng double precision,
  p_heading double precision default null,
  p_speed_mps double precision default null,
  p_accuracy_m double precision default null,
  p_captured_at timestamptz default now(),
  p_sender_session_id text default 'legacy',
  p_sequence bigint default 0
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_member_id uuid;
  v_received_at timestamptz := clock_timestamp();
  v_message_id uuid := gen_random_uuid();
  v_rows integer;
begin
  if p_lat is null or not (p_lat between -90 and 90)
    or p_lng is null or not (p_lng between -180 and 180)
    or (p_heading is not null and not (p_heading between 0 and 360))
    or (p_speed_mps is not null and not (p_speed_mps between 0 and 120))
    or (p_accuracy_m is not null and not (p_accuracy_m between 0 and 10000))
    or p_captured_at > v_received_at + interval '5 minutes'
    or p_captured_at < v_received_at - interval '24 hours'
    or p_sequence < 0
    or length(p_sender_session_id) not between 1 and 128 then
    raise exception 'Invalid location snapshot.' using errcode = '22023';
  end if;

  select vm.id into v_member_id
  from public.voyage_members vm
  join public.voyages v on v.id = vm.voyage_id
  where vm.voyage_id = p_voyage_id
    and vm.user_id = v_user_id
    and vm.removed_at is null and vm.is_active and v.status = 'active';

  if v_member_id is null then
    raise exception 'You are not an active member of this Voyage.' using errcode = 'LOC02';
  end if;

  insert into public.voyage_member_locations as locations
    (voyage_member_id, lat, lng, heading, speed_mps, accuracy_m,
     captured_at, sender_session_id, sequence, updated_at)
  values
    (v_member_id, p_lat, p_lng, p_heading, p_speed_mps, p_accuracy_m,
     p_captured_at, p_sender_session_id, p_sequence, v_received_at)
  on conflict (voyage_member_id) do update set
    lat = excluded.lat, lng = excluded.lng, heading = excluded.heading,
    speed_mps = excluded.speed_mps, accuracy_m = excluded.accuracy_m,
    captured_at = excluded.captured_at,
    sender_session_id = excluded.sender_session_id,
    sequence = excluded.sequence, updated_at = excluded.updated_at
  where locations.captured_at < excluded.captured_at
     or (locations.sender_session_id = excluded.sender_session_id
         and locations.sequence < excluded.sequence);

  get diagnostics v_rows = row_count;
  if v_rows = 0 then
    return;
  end if;

  perform realtime.send(
    jsonb_build_object(
      'protocolVersion', 1, 'messageId', v_message_id, 'voyageId', p_voyage_id,
      'senderUserId', v_user_id, 'senderSessionId', p_sender_session_id,
      'sequence', p_sequence, 'type', 'location.updated',
      'capturedAt', p_captured_at, 'sentAt', v_received_at,
      'payload', jsonb_build_object('lat', p_lat, 'lng', p_lng,
        'heading', p_heading, 'speedMps', p_speed_mps, 'accuracyM', p_accuracy_m)
    ),
    'voyage_message', 'voyage:' || p_voyage_id::text, true
  );

  -- Compatibility window for installed clients that still listen to the
  -- pre-v1 event. New clients consume only voyage_message, avoiding duplicate
  -- state; remove this send after legacy mobile adoption is negligible.
  perform realtime.send(
    jsonb_build_object('user_id', v_user_id, 'lat', p_lat, 'lng', p_lng,
      'heading', p_heading, 'updated_at', v_received_at),
    'location', 'voyage:' || p_voyage_id::text, true
  );
end;
$$;

revoke execute on function public.upsert_location_snapshot(uuid, double precision, double precision, double precision, double precision, double precision, timestamptz, text, bigint) from public, anon;
grant execute on function public.upsert_location_snapshot(uuid, double precision, double precision, double precision, double precision, double precision, timestamptz, text, bigint) to authenticated;

-- Preserve the installed-client RPC contract while routing it through the
-- new snapshot implementation so captured_at never freezes for legacy users.
create or replace function public.upsert_location(
  p_voyage_id uuid,
  p_lat double precision,
  p_lng double precision,
  p_heading double precision default null
)
returns void language plpgsql security definer set search_path = ''
as $$
declare
  v_now timestamptz := clock_timestamp();
begin
  perform public.upsert_location_snapshot(
    p_voyage_id, p_lat, p_lng, p_heading, null, null, v_now,
    'legacy', floor(extract(epoch from v_now) * 1000)::bigint
  );
end;
$$;
revoke execute on function public.upsert_location(uuid, double precision, double precision, double precision) from public, anon;
grant execute on function public.upsert_location(uuid, double precision, double precision, double precision) to authenticated;

drop function if exists public.get_live_locations(uuid);
create function public.get_live_locations(p_voyage_id uuid)
returns table (
  user_id uuid, lat double precision, lng double precision,
  heading double precision, speed_mps double precision, accuracy_m double precision,
  captured_at timestamptz, sender_session_id text, sequence bigint,
  updated_at timestamptz
)
language plpgsql stable security invoker set search_path = public
as $$
begin
  if not public.is_active_voyage_member(p_voyage_id, auth.uid()) then
    raise exception 'You are not an active member of this Voyage.' using errcode = 'LOC01';
  end if;
  return query
    select vm.user_id, l.lat, l.lng, l.heading, l.speed_mps, l.accuracy_m,
      l.captured_at, l.sender_session_id, l.sequence, l.updated_at
    from public.voyage_member_locations l
    join public.voyage_members vm on vm.id = l.voyage_member_id
    where vm.voyage_id = p_voyage_id and vm.removed_at is null and vm.is_active;
end;
$$;
revoke execute on function public.get_live_locations(uuid) from public, anon;
grant execute on function public.get_live_locations(uuid) to authenticated;

create table public.journey_events (
  id uuid primary key,
  voyage_id uuid not null references public.voyages(id) on delete cascade,
  actor_user_id uuid references auth.users(id) on delete set null,
  event_type text not null check (event_type in ('coffee_stop', 'police', 'deer', 'construction', 'custom')),
  occurred_at timestamptz not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.journey_events enable row level security;
create policy "journey_events_select_members" on public.journey_events
  for select to authenticated
  using (public.is_active_voyage_member(voyage_id, (select auth.uid())));

create or replace function public.create_journey_event(
  p_event_id uuid,
  p_voyage_id uuid,
  p_event_type text,
  p_occurred_at timestamptz,
  p_metadata jsonb default '{}'::jsonb
)
returns public.journey_events
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_event public.journey_events;
begin
  if not public.is_active_voyage_member(p_voyage_id, v_user_id) then
    raise exception 'You are not an active member of this Voyage.' using errcode = 'EVT01';
  end if;
  if p_event_type not in ('coffee_stop', 'police', 'deer', 'construction', 'custom')
    or p_occurred_at > now() + interval '5 minutes'
    or p_occurred_at < now() - interval '7 days'
    or pg_column_size(coalesce(p_metadata, '{}'::jsonb)) > 16384 then
    raise exception 'Invalid journey event.' using errcode = '22023';
  end if;

  insert into public.journey_events (id, voyage_id, actor_user_id, event_type, occurred_at, metadata)
  values (p_event_id, p_voyage_id, v_user_id, p_event_type, p_occurred_at, coalesce(p_metadata, '{}'::jsonb))
  on conflict (id) do nothing
  returning * into v_event;

  if not found then
    select * into strict v_event from public.journey_events where id = p_event_id;
    if v_event.voyage_id <> p_voyage_id or v_event.actor_user_id <> v_user_id then
      raise exception 'Journey event id is already in use.' using errcode = 'EVT02';
    end if;
    return v_event;
  end if;
  if v_event.voyage_id <> p_voyage_id or v_event.actor_user_id <> v_user_id then
    raise exception 'Journey event id is already in use.' using errcode = 'EVT02';
  end if;

  perform realtime.send(
    jsonb_build_object('protocolVersion', 1, 'messageId', gen_random_uuid(),
      'voyageId', p_voyage_id, 'senderUserId', v_user_id,
      'senderSessionId', 'server', 'sequence', 0,
      'type', 'journey.event.created', 'capturedAt', v_event.occurred_at,
      'sentAt', clock_timestamp(),
      'payload', jsonb_build_object('eventId', v_event.id, 'eventType', v_event.event_type,
        'occurredAt', v_event.occurred_at, 'actorUserId', v_event.actor_user_id,
        'metadata', v_event.metadata)),
    'voyage_message', 'voyage:' || p_voyage_id::text, true
  );
  return v_event;
end;
$$;

revoke execute on function public.create_journey_event(uuid, uuid, text, timestamptz, jsonb) from public, anon;
grant execute on function public.create_journey_event(uuid, uuid, text, timestamptz, jsonb) to authenticated;

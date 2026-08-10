-- Stop Intelligence foundation (AD-16). Classification launches in shadow
-- mode: candidates are auditable but cannot create user-visible notifications
-- until field-calibrated server configuration explicitly enables them.

alter table public.journey_events drop constraint if exists journey_events_event_type_check;
alter table public.journey_events add constraint journey_events_event_type_check
  check (event_type in ('stop', 'traffic_delay', 'coffee_stop', 'police', 'deer', 'construction', 'custom'));

create table public.stop_events (
  id uuid primary key,
  voyage_id uuid not null references public.voyages(id) on delete cascade,
  actor_user_id uuid references auth.users(id) on delete set null,
  journey_event_id uuid references public.journey_events(id) on delete set null,
  status text not null default 'candidate'
    check (status in ('candidate', 'confirmed', 'completed', 'suppressed', 'corrected')),
  started_at timestamptz not null,
  confirmed_at timestamptz,
  ended_at timestamptz,
  centroid_lat double precision not null check (centroid_lat between -90 and 90),
  centroid_lng double precision not null check (centroid_lng between -180 and 180),
  centroid_accuracy_m real not null check (centroid_accuracy_m > 0 and centroid_accuracy_m <= 500),
  trace jsonb not null default '[]'::jsonb,
  classification jsonb not null default '{"kind":"unknown","primaryCategory":"unknown","secondaryCategories":[],"confidence":0,"visibility":"suppressed"}'::jsonb,
  place jsonb,
  evidence jsonb not null default '{}'::jsonb,
  classifier_version text not null default 'stop-v1-shadow',
  source text not null default 'automatic' check (source in ('automatic', 'user_confirmed', 'user_corrected')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ended_at is null or ended_at >= started_at),
  check (confirmed_at is null or confirmed_at >= started_at),
  check (jsonb_typeof(trace) = 'array' and jsonb_array_length(trace) <= 80),
  check (pg_column_size(trace) <= 32768)
);

create index stop_events_voyage_started_idx on public.stop_events (voyage_id, started_at desc);
alter table public.stop_events enable row level security;
create policy "stop_events_select_members" on public.stop_events for select to authenticated
  using (public.is_active_voyage_member(voyage_id, (select auth.uid())));

create or replace function public.submit_stop_candidate(
  p_id uuid,
  p_voyage_id uuid,
  p_started_at timestamptz,
  p_confirmed_at timestamptz,
  p_ended_at timestamptz,
  p_lat double precision,
  p_lng double precision,
  p_accuracy_m real,
  p_trace jsonb
)
returns public.stop_events
language plpgsql security definer set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_stop public.stop_events;
begin
  if not public.is_active_voyage_member(p_voyage_id, v_user_id) then
    raise exception 'You are not an active member of this Voyage.' using errcode = 'STP01';
  end if;
  if p_started_at < now() - interval '7 days' or p_started_at > now() + interval '5 minutes'
     or p_confirmed_at < p_started_at or p_ended_at < p_confirmed_at
     or p_lat not between -90 and 90 or p_lng not between -180 and 180
     or p_accuracy_m <= 0 or p_accuracy_m > 500
     or jsonb_typeof(p_trace) <> 'array' or jsonb_array_length(p_trace) > 80
     or pg_column_size(p_trace) > 32768 then
    raise exception 'Invalid stop candidate.' using errcode = '22023';
  end if;

  insert into public.stop_events (
    id, voyage_id, actor_user_id, status, started_at, confirmed_at, ended_at,
    centroid_lat, centroid_lng, centroid_accuracy_m, trace
  ) values (
    p_id, p_voyage_id, v_user_id, 'completed', p_started_at, p_confirmed_at, p_ended_at,
    p_lat, p_lng, p_accuracy_m, p_trace
  ) on conflict (id) do nothing returning * into v_stop;

  if not found then
    select * into strict v_stop from public.stop_events where id = p_id;
    if v_stop.voyage_id <> p_voyage_id or v_stop.actor_user_id <> v_user_id then
      raise exception 'Stop id is already in use.' using errcode = 'STP02';
    end if;
  end if;
  return v_stop;
end;
$$;

revoke execute on function public.submit_stop_candidate(uuid, uuid, timestamptz, timestamptz, timestamptz, double precision, double precision, real, jsonb) from public, anon;
grant execute on function public.submit_stop_candidate(uuid, uuid, timestamptz, timestamptz, timestamptz, double precision, double precision, real, jsonb) to authenticated;

create or replace function public.create_journey_event(
  p_event_id uuid, p_voyage_id uuid, p_event_type text,
  p_occurred_at timestamptz, p_metadata jsonb default '{}'::jsonb
)
returns public.journey_events language plpgsql security definer set search_path = ''
as $$
declare v_user_id uuid := auth.uid(); v_event public.journey_events;
begin
  if not public.is_active_voyage_member(p_voyage_id, v_user_id) then
    raise exception 'You are not an active member of this Voyage.' using errcode = 'EVT01';
  end if;
  if p_event_type not in ('stop', 'traffic_delay', 'coffee_stop', 'police', 'deer', 'construction', 'custom')
    or p_occurred_at > now() + interval '5 minutes' or p_occurred_at < now() - interval '7 days'
    or pg_column_size(coalesce(p_metadata, '{}'::jsonb)) > 16384 then
    raise exception 'Invalid journey event.' using errcode = '22023';
  end if;
  insert into public.journey_events (id, voyage_id, actor_user_id, event_type, occurred_at, metadata)
  values (p_event_id, p_voyage_id, v_user_id, p_event_type, p_occurred_at, coalesce(p_metadata, '{}'::jsonb))
  on conflict (id) do nothing returning * into v_event;
  if not found then
    select * into strict v_event from public.journey_events where id = p_event_id;
    if v_event.voyage_id <> p_voyage_id or v_event.actor_user_id <> v_user_id then
      raise exception 'Journey event id is already in use.' using errcode = 'EVT02';
    end if;
    return v_event;
  end if;
  perform realtime.send(jsonb_build_object(
    'protocolVersion', 1, 'messageId', gen_random_uuid(), 'voyageId', p_voyage_id,
    'senderUserId', v_user_id, 'senderSessionId', 'server', 'sequence', 0,
    'type', 'journey.event.created', 'capturedAt', v_event.occurred_at, 'sentAt', clock_timestamp(),
    'payload', jsonb_build_object('eventId', v_event.id, 'eventType', v_event.event_type,
      'occurredAt', v_event.occurred_at, 'actorUserId', v_event.actor_user_id, 'metadata', v_event.metadata)
  ), 'voyage_message', 'voyage:' || p_voyage_id::text, true);
  return v_event;
end;
$$;

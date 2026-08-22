-- Story 6.1 AC2/AC3: the two new read RPCs Memory Lane and Voyage History
-- need. Neither RPC introduces new access-control logic -- both reuse the
-- already-existing is_voyage_participant predicate (see the companion
-- migration in this same story for the RLS fix that made journey_events
-- readable for ended Voyages in the first place).
--
-- No pagination/cursor convention existed anywhere in this codebase before
-- this story; both RPCs establish the same one: a nullable timestamptz
-- cursor (p_before) tiebroken by a nullable id cursor (p_before_id) when two
-- rows share the exact same timestamp at a page boundary, plus a p_limit
-- clamped on both ends (code review finding: an unclamped lower bound let
-- 0 silently return an empty page, and a negative value raised a raw
-- Postgres error).

-- Lists the caller's own ended Voyages, most recent first. Scoped implicitly
-- by auth.uid() via is_voyage_participant -- no p_voyage_id parameter, since
-- this is "my history," not "a given Voyage's roster."
create or replace function public.get_voyage_history(
  p_before timestamptz default null,
  p_before_id uuid default null,
  p_limit integer default 20
)
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
begin
  return query
    select v.id, v.destination, v.destination_lat, v.destination_lng, v.status, v.created_by, v.created_at, v.ended_at, v.join_code,
      -- Mirrors end_voyage()'s own voyager_count computation exactly:
      -- removed_at-based, not is_active-based -- end_voyage() deactivates
      -- every member's is_active flag when it ends the Voyage, so counting
      -- by is_active would always read zero for every ended Voyage here.
      (select count(*) from public.voyage_members vm where vm.voyage_id = v.id and vm.removed_at is null)
    from public.voyages v
    where v.status = 'ended'
      and public.is_voyage_participant(v.id, auth.uid())
      and (
        p_before is null
        or v.ended_at < p_before
        or (v.ended_at = p_before and p_before_id is not null and v.id < p_before_id)
      )
    order by v.ended_at desc, v.id desc
    limit greatest(least(coalesce(p_limit, 20), 100), 1);
end;
$$;

revoke execute on function public.get_voyage_history(timestamptz, uuid, integer) from public, anon;
grant execute on function public.get_voyage_history(timestamptz, uuid, integer) to authenticated;

-- Journey-event history for one Voyage the caller participates in (active or
-- ended -- is_voyage_participant covers both correctly).
create or replace function public.get_journey_event_history(
  p_voyage_id uuid,
  p_before timestamptz default null,
  p_before_id uuid default null,
  p_limit integer default 50
)
returns table (
  id uuid,
  voyage_id uuid,
  actor_user_id uuid,
  event_type text,
  occurred_at timestamptz,
  metadata jsonb,
  status text,
  source text,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_voyage_id is null then
    raise exception 'A Voyage id is required.' using errcode = '22023';
  end if;

  if not public.is_voyage_participant(p_voyage_id, auth.uid()) then
    raise exception 'You are not a participant of this Voyage.' using errcode = 'EVT03';
  end if;

  return query
    select je.id, je.voyage_id, je.actor_user_id, je.event_type, je.occurred_at, je.metadata, je.status, je.source, je.created_at
    from public.journey_events je
    where je.voyage_id = p_voyage_id
      and (
        p_before is null
        or je.occurred_at < p_before
        or (je.occurred_at = p_before and p_before_id is not null and je.id < p_before_id)
      )
    order by je.occurred_at desc, je.id desc
    limit greatest(least(coalesce(p_limit, 50), 200), 1);
end;
$$;

revoke execute on function public.get_journey_event_history(uuid, timestamptz, uuid, integer) from public, anon;
grant execute on function public.get_journey_event_history(uuid, timestamptz, uuid, integer) to authenticated;

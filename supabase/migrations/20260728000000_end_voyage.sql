-- Story 2.4: End Voyage.

-- Broader than is_active_voyage_member() on purpose: no `v.status = 'active'`
-- requirement, so a participant of an *ended* Voyage can still read it (the
-- SELECT policies below currently deny everyone, including the Organizer who
-- just ended it, the instant status flips -- explicitly flagged as this
-- story's problem to fix in Story 2.1's deferred-work.md). Still requires
-- `removed_at is null` -- a removed member does not retroactively regain
-- read access. security definer for the same reason as is_active_voyage_member:
-- called from the same tables' own RLS policies it queries internally, so it
-- must bypass RLS on its own lookups to avoid infinite recursion.
create or replace function public.is_voyage_participant(p_voyage_id uuid, p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.voyage_members vm
    where vm.voyage_id = p_voyage_id
      and vm.user_id = p_user_id
      and vm.removed_at is null
  );
$$;

drop policy if exists "voyages_select_members" on public.voyages;
create policy "voyages_select_members" on public.voyages
  for select using (public.is_voyage_participant(id, auth.uid()));

drop policy if exists "voyage_members_select_fellow_members" on public.voyage_members;
create policy "voyage_members_select_fellow_members" on public.voyage_members
  for select using (public.is_voyage_participant(voyage_id, auth.uid()));

-- "Do I currently have an active Voyage, and what's my role in it" -- security
-- invoker (not definer): only ever reads the caller's own membership row via
-- auth.uid(), no cross-user privilege question, so it should honor RLS
-- normally rather than bypass it. Deliberately the *narrow* semantics
-- (currently-active membership in a currently-active Voyage), not
-- is_voyage_participant's broader one -- this answers "right now," not "ever."
-- Table-returning (PostgREST returns an array): 0 or 1 rows, AD-9 guarantees
-- at most one.
create or replace function public.get_my_active_voyage()
returns table (
  id uuid,
  destination text,
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
  select v.id, v.destination, v.status, v.created_by, v.created_at, v.ended_at, v.join_code, vm.role
  from public.voyages v
  join public.voyage_members vm on vm.voyage_id = v.id
  where vm.user_id = auth.uid()
    and vm.is_active = true
    and vm.removed_at is null
    and v.status = 'active';
$$;

-- The actual end-Voyage RPC. Mirrors start_voyage()/join_voyage()'s
-- established atomic-function shape: one call, no client-side multi-step
-- write. Both updates (Voyage status + every member's is_active) happen
-- together -- a client-side two-call version risks a Voyage ending while
-- members stay AD-9-locked forever if the second call fails.
-- Table-returning (extends the plain public.voyages shape with voyager_count,
-- same reasoning as get_voyage_preview()'s own extended shape): the Voyage
-- Ended summary (AC2) needs a Voyager count, and this is the natural place to
-- compute it once, atomically, alongside the ending itself.
create or replace function public.end_voyage(p_voyage_id uuid)
returns table (
  id uuid,
  destination text,
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
  v_status text;
  v_is_organizer boolean;
begin
  select v.status into v_status from public.voyages v where v.id = p_voyage_id;

  if not found then
    raise exception 'This Voyage does not exist.' using errcode = 'END01';
  end if;

  if v_status <> 'active' then
    raise exception 'This Voyage has already ended.' using errcode = 'END02';
  end if;

  select exists (
    select 1 from public.voyage_members
    where voyage_id = p_voyage_id
      and user_id = auth.uid()
      and role = 'organizer'
      and removed_at is null
      and is_active = true
  ) into v_is_organizer;

  if not v_is_organizer then
    -- Real authorization boundary, not just a UI nicety -- this function must
    -- not trust the client to only ever call it as an Organizer.
    raise exception 'Only the Organizer can end this Voyage.' using errcode = 'END03';
  end if;

  update public.voyages
  set status = 'ended', ended_at = now()
  where id = p_voyage_id;

  -- Releases AD-9's per-user lock for every member of this Voyage, not just
  -- the Organizer. Without this, every Voyager who was ever in this trip
  -- stays permanently unable to start or join any future Voyage.
  update public.voyage_members
  set is_active = false
  where voyage_id = p_voyage_id
    and is_active = true;

  return query
    select v.id, v.destination, v.status, v.created_by, v.created_at, v.ended_at, v.join_code,
      (select count(*) from public.voyage_members vm where vm.voyage_id = v.id and vm.removed_at is null)
    from public.voyages v
    where v.id = p_voyage_id;
end;
$$;

revoke execute on function public.end_voyage(uuid) from public;
revoke execute on function public.end_voyage(uuid) from anon;

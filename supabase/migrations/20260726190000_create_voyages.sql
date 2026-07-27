-- Story 2.1: Start a Voyage. First Voyage-scoped tables in this project.
create table public.voyages (
  id uuid primary key default gen_random_uuid(),
  destination text not null,
  status text not null default 'active' check (status in ('active', 'ended')),
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  ended_at timestamptz
);

create table public.voyage_members (
  id uuid primary key default gen_random_uuid(),
  voyage_id uuid not null references public.voyages(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('organizer', 'voyager')),
  joined_at timestamptz not null default now(),
  removed_at timestamptz,
  is_active boolean not null default true
);

-- AD-9: one active Voyage per user, globally, enforced in the database.
create unique index voyage_members_one_active_per_user
  on public.voyage_members (user_id)
  where removed_at is null and is_active = true;

-- AD-1: one shared membership predicate every Voyage-scoped RLS policy calls,
-- rather than each policy re-deriving its own membership check. Takes explicit
-- parameters (not auth.uid() internally) since future policies call this with
-- *other* rows' voyage_id/user_id values, not just the caller's own.
create or replace function public.is_active_voyage_member(p_voyage_id uuid, p_user_id uuid)
returns boolean
language sql
stable
security invoker
set search_path = public
as $$
  select exists (
    select 1 from public.voyage_members vm
    join public.voyages v on v.id = vm.voyage_id
    where vm.voyage_id = p_voyage_id
      and vm.user_id = p_user_id
      and vm.removed_at is null
      and v.status = 'active'
  );
$$;

alter table public.voyages enable row level security;
alter table public.voyage_members enable row level security;

create policy "voyages_select_members" on public.voyages
  for select using (public.is_active_voyage_member(id, auth.uid()));

create policy "voyages_insert_own" on public.voyages
  for insert with check (created_by = auth.uid());

create policy "voyage_members_select_fellow_members" on public.voyage_members
  for select using (public.is_active_voyage_member(voyage_id, auth.uid()));

create policy "voyage_members_insert_self" on public.voyage_members
  for insert with check (user_id = auth.uid());

-- Atomic create: one voyage row + one organizer membership row, or neither. A
-- two-step client-side create risks an orphaned voyage row if the second insert
-- fails partway (network drop, app kill). security invoker so both inserts still
-- go through the RLS policies above, not a privilege escalation.
create or replace function public.start_voyage(p_destination text)
returns public.voyages
language plpgsql
security invoker
set search_path = public
as $$
declare
  new_voyage public.voyages;
begin
  if p_destination is null or btrim(p_destination) = '' then
    raise exception 'Destination is required.' using errcode = '22023';
  end if;

  insert into public.voyages (destination, created_by)
  values (btrim(p_destination), auth.uid())
  returning * into new_voyage;

  begin
    insert into public.voyage_members (voyage_id, user_id, role)
    values (new_voyage.id, auth.uid(), 'organizer');
  exception
    when unique_violation then
      raise exception 'You already have an active Voyage.' using errcode = 'P0001';
  end;

  return new_voyage;
end;
$$;

grant execute on function public.start_voyage(text) to authenticated;

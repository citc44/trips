-- Story 2.3: Join Voyage via Code/Link.

-- Pre-auth, narrow, public-safe Voyage lookup by join_code. Deliberately
-- security definer: the existing voyages_select_members RLS policy (Story
-- 2.1) only allows active members to select, but an unauthenticated or
-- not-yet-member caller needs to see the destination/status/voyager count
-- before any auth is requested (AC1). Bypasses RLS on purpose to expose a
-- narrow, explicit projection -- never ids, created_by, or member identities.
-- No status filter: an ended Voyage must still resolve (so the client can
-- show "This trip's already wrapped up," not a generic not-found).
-- No grant/revoke here on purpose -- a freshly created function is already
-- executable by anon/authenticated/service_role by default on this platform
-- (Story 2.1's code review lesson), which is exactly the open posture wanted
-- for a pre-auth preview. Contrast with join_voyage() below.
create or replace function public.get_voyage_preview(p_join_code text)
returns table (destination text, status text, voyager_count bigint)
language sql
stable
security definer
set search_path = public
as $$
  select
    v.destination,
    v.status,
    (
      select count(*)
      from public.voyage_members vm
      where vm.voyage_id = v.id
        and vm.removed_at is null
        and vm.is_active = true
    ) as voyager_count
  from public.voyages v
  where v.join_code = p_join_code;
$$;

-- The actual join RPC. Mirrors start_voyage()'s established shape (security
-- definer, into strict, one atomic function -- no client-side multi-step
-- write). The one substantive difference: role = 'voyager', not 'organizer'.
create or replace function public.join_voyage(p_join_code text)
returns public.voyages
language plpgsql
security definer
set search_path = public
as $$
declare
  v_voyage_id uuid;
  v_status text;
  v_already_member boolean;
  result public.voyages;
begin
  if p_join_code is null or btrim(p_join_code) = '' then
    raise exception 'A Join Code/Link is required.' using errcode = '22023';
  end if;

  select id, status into v_voyage_id, v_status
  from public.voyages
  where join_code = p_join_code;

  if not found then
    raise exception 'This invite link is not valid.' using errcode = 'P0003';
  end if;

  if v_status <> 'active' then
    raise exception 'This trip has already ended.' using errcode = 'P0004';
  end if;

  -- Idempotent rejoin: already an active member of *this exact* Voyage (e.g.
  -- an already-authenticated user re-tapping their own invite). Without this
  -- check the unique_violation branch below would fire and misleadingly
  -- report "already have an active Voyage" for the very Voyage being joined.
  select exists (
    select 1 from public.voyage_members
    where voyage_id = v_voyage_id
      and user_id = auth.uid()
      and removed_at is null
      and is_active = true
  ) into v_already_member;

  if not v_already_member then
    begin
      insert into public.voyage_members (voyage_id, user_id, role)
      values (v_voyage_id, auth.uid(), 'voyager');
    exception
      when unique_violation then
        -- AD-9: caller already has an active Voyage elsewhere. Same
        -- message/errcode as start_voyage()'s equivalent guard so the client
        -- can share one "already active elsewhere" error branch.
        raise exception 'You already have an active Voyage.' using errcode = 'P0001';
    end;
  end if;

  select * into strict result from public.voyages where id = v_voyage_id;

  return result;
end;
$$;

-- Locked down, unlike get_voyage_preview above: authenticated users only.
-- Both statements needed -- Story 2.1's code review found that revoking from
-- public alone left anon still able to call it on this platform.
revoke execute on function public.join_voyage(text) from public;
revoke execute on function public.join_voyage(text) from anon;

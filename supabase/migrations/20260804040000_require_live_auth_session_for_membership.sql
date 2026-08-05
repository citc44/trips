-- A Supabase access-token JWT remains cryptographically valid until its
-- expiry even after Auth sign-out. For membership-creating actions that is
-- too weak: another device holding the old JWT could otherwise recreate an
-- active membership after leave_active_voyage() and global sign-out.
--
-- Supabase documents the session_id claim as the key of auth.sessions and
-- recommends checking that row when an action must stop working immediately
-- after logout. Keep the auth schema lookup behind this non-API helper.
create or replace function public.has_live_auth_session()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from auth.sessions as sessions
    where sessions.id::text = auth.jwt() ->> 'session_id'
      and sessions.user_id = auth.uid()
  );
$$;

revoke execute on function public.has_live_auth_session()
  from public, anon, authenticated;

-- Preserve the fully-tested atomic switch implementation under a private
-- name, then expose a session-validating wrapper at the original RPC name.
alter function public.join_voyage(text)
  rename to join_voyage_with_live_session_unchecked;

revoke execute on function public.join_voyage_with_live_session_unchecked(text)
  from public, anon, authenticated;

create function public.join_voyage(p_join_code text)
returns public.voyages
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null or not public.has_live_auth_session() then
    raise exception 'Your session has ended. Please sign in again.' using errcode = '28000';
  end if;

  return public.join_voyage_with_live_session_unchecked(p_join_code);
end;
$$;

revoke execute on function public.join_voyage(text) from public, anon;
grant execute on function public.join_voyage(text) to authenticated;

-- The current client always calls the coordinate-aware overload. Rename it
-- behind the same live-session wrapper pattern. The legacy one-argument RPC
-- is no longer used by this client and is revoked to prevent it becoming a
-- logout-fence bypass.
alter function public.start_voyage(text, double precision, double precision)
  rename to start_voyage_with_live_session_unchecked;

revoke execute on function public.start_voyage_with_live_session_unchecked(
  text,
  double precision,
  double precision
) from public, anon, authenticated;

create function public.start_voyage(
  p_destination text,
  p_destination_lat double precision default null,
  p_destination_lng double precision default null
)
returns public.voyages
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null or not public.has_live_auth_session() then
    raise exception 'Your session has ended. Please sign in again.' using errcode = '28000';
  end if;

  return public.start_voyage_with_live_session_unchecked(
    p_destination,
    p_destination_lat,
    p_destination_lng
  );
end;
$$;

revoke execute on function public.start_voyage(
  text,
  double precision,
  double precision
) from public, anon;
grant execute on function public.start_voyage(
  text,
  double precision,
  double precision
) to authenticated;

revoke execute on function public.start_voyage(text)
  from public, anon, authenticated;

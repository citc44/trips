-- Story 1.4 code review fix: AC2 requires trust_moment_seen_at to be a *server*
-- timestamp. The original client-supplied `new Date().toISOString()` upsert let a
-- skewed or spoofed device clock set an arbitrary value. This RPC stamps the value
-- with Postgres's own now() and derives the row's identity from auth.uid() rather
-- than a client-supplied user_id, removing that write path's dependency on the
-- client entirely. security invoker (not definer) so the existing RLS policies on
-- profiles still apply as defense in depth -- this is a convenience wrapper around
-- an RLS-safe write, not a privilege escalation.
-- coalesce(...) makes the write idempotent: once trust_moment_seen_at is set, a
-- repeat call can never overwrite it with a later timestamp.
create or replace function public.mark_trust_moment_seen()
returns public.profiles
language sql
security invoker
set search_path = public
as $$
  insert into public.profiles (user_id, trust_moment_seen_at)
  values (auth.uid(), now())
  on conflict (user_id) do update
    set trust_moment_seen_at = coalesce(public.profiles.trust_moment_seen_at, excluded.trust_moment_seen_at)
  returning *;
$$;

grant execute on function public.mark_trust_moment_seen() to authenticated;

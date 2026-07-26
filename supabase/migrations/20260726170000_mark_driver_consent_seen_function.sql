-- Story 1.5: Driver Attention Consent. Mirrors Story 1.4's mark_trust_moment_seen()
-- exactly, for the sibling driver_consent_seen_at column -- server-stamped from the
-- start (see that story's code review for why a client-supplied timestamp is a real
-- gap), idempotent via coalesce, security invoker so existing RLS policies still apply.
create or replace function public.mark_driver_consent_seen()
returns public.profiles
language sql
security invoker
set search_path = public
as $$
  insert into public.profiles (user_id, driver_consent_seen_at)
  values (auth.uid(), now())
  on conflict (user_id) do update
    set driver_consent_seen_at = coalesce(public.profiles.driver_consent_seen_at, excluded.driver_consent_seen_at)
  returning *;
$$;

grant execute on function public.mark_driver_consent_seen() to authenticated;

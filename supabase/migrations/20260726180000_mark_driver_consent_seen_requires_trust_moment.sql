-- Code review fix (Story 1.5): the original mark_driver_consent_seen() was an
-- unconditional upsert, so calling it before mark_trust_moment_seen() (e.g. a raw
-- API call bypassing the app -- the app's own routing guard never does this) could
-- silently create a profiles row with driver_consent_seen_at set and
-- trust_moment_seen_at still NULL, permanently satisfying the "driver consent
-- already seen" check while Trust Moment's own gate never fires for that account.
-- Rewritten as an UPDATE requiring an existing row with trust_moment_seen_at
-- already set; raises a clear error on out-of-order calls instead of silently
-- creating an inconsistent row.
create or replace function public.mark_driver_consent_seen()
returns public.profiles
language plpgsql
security invoker
set search_path = public
as $$
declare
  updated_row public.profiles;
begin
  update public.profiles
    set driver_consent_seen_at = coalesce(driver_consent_seen_at, now())
    where user_id = auth.uid() and trust_moment_seen_at is not null
    returning * into updated_row;

  if not found then
    raise exception 'Cannot mark driver consent seen before trust moment is seen.' using errcode = 'P0001';
  end if;

  return updated_row;
end;
$$;

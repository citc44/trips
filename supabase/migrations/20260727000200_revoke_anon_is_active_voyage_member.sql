-- Fix (found via live re-verification of the prior patch, Story 2.1 code review):
-- `revoke execute ... from public` alone did not actually close anonymous access.
-- Supabase grants EXECUTE on public-schema functions to anon/authenticated/
-- service_role explicitly at project provisioning (via ALTER DEFAULT PRIVILEGES),
-- independent of the PUBLIC pseudo-role -- confirmed live: POST
-- /rest/v1/rpc/is_active_voyage_member with no Authorization header (anon)
-- still succeeded (200 true) after the previous migration. Revoking anon's
-- explicit grant directly closes it.
revoke execute on function public.is_active_voyage_member(uuid, uuid) from anon;

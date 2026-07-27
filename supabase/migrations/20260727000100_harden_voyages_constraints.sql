-- Code review fixes (Story 2.1), two independent hardening items:

-- 1. No DB-level guard existed on `destination` content/length -- the RPC's own
--    trim/blank check is the only validation, and (before this same review round's
--    prior migration) was bypassable via direct table access. Defense in depth:
--    even under security definer, a table-level constraint costs nothing and
--    protects against any future RPC/trigger that forgets to validate.
alter table public.voyages
  add constraint voyages_destination_not_blank
  check (char_length(btrim(destination)) > 0 and char_length(destination) <= 200);

-- 2. is_active_voyage_member (security definer, explicit (voyage_id, user_id)
--    params) had no explicit grant restriction, making it directly callable as
--    POST /rest/v1/rpc/is_active_voyage_member by anyone with Postgres's default
--    public-executable grant -- a membership-existence oracle for arbitrary
--    pairs. Revoking from public closes anonymous probing; authenticated-role
--    execute is still required since Voyage-scoped RLS policies call this
--    function on behalf of real user queries. Residual authenticated-user
--    probing is a documented, deferred item (see deferred-work.md) -- fully
--    closing it means moving the function to a non-PostgREST-exposed schema.
revoke execute on function public.is_active_voyage_member(uuid, uuid) from public;
grant execute on function public.is_active_voyage_member(uuid, uuid) to authenticated;

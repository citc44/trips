-- Fix (found via live verification, Story 2.1): is_active_voyage_member() was
-- `security invoker`. Since it's called FROM voyages'/voyage_members' own RLS
-- SELECT policies, and its own body queries those same tables (to check
-- v.status = 'active'), invoker-rights meant its internal query re-triggered the
-- very same RLS policy that called it -- unbounded recursion, confirmed live
-- against voylo-dev ("stack depth limit exceeded", SQLSTATE 54001).
--
-- This is the standard, documented pattern for RLS "membership predicate"
-- helper functions: security definer (with search_path still locked down) so
-- the function's own internal lookups bypass RLS entirely -- the function's
-- logic *is* the authorization check, it doesn't need RLS's help to compute
-- its answer, and it never leaks row data (returns only a boolean).
create or replace function public.is_active_voyage_member(p_voyage_id uuid, p_user_id uuid)
returns boolean
language sql
stable
security definer
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

-- Lifecycle reconciliation for clients that already have a private Voyage
-- channel open. Membership RLS remains the authorization boundary for new
-- subscriptions/queries; these payloads let an honest, already-connected
-- client notice that *its own* membership was deactivated and immediately
-- refetch/unmount instead of displaying a stale map until restart.
create or replace function public.broadcast_voyage_roster_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_voyage_id uuid;
  v_user_id uuid;
  v_is_active boolean;
begin
  if tg_op = 'DELETE' then
    v_voyage_id := old.voyage_id;
    v_user_id := old.user_id;
    v_is_active := false;
  else
    v_voyage_id := new.voyage_id;
    v_user_id := new.user_id;
    v_is_active := new.is_active and new.removed_at is null;
  end if;

  perform realtime.send(
    jsonb_build_object(
      'voyage_id', v_voyage_id,
      'user_id', v_user_id,
      'is_active', v_is_active
    ),
    'roster_changed',
    'voyage:' || v_voyage_id::text,
    true
  );

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

revoke execute on function public.broadcast_voyage_roster_change()
  from public, anon, authenticated;

-- Membership updates already cover joins/leaves/removals. Voyage status is a
-- separate row, though, so broadcast it explicitly. This handles both the
-- normal End Voyage RPC and the last-Organizer departure path.
create or replace function public.broadcast_voyage_status_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform realtime.send(
    jsonb_build_object(
      'voyage_id', new.id,
      'status', new.status,
      'ended_at', new.ended_at
    ),
    'voyage_status_changed',
    'voyage:' || new.id::text,
    true
  );

  return new;
end;
$$;

revoke execute on function public.broadcast_voyage_status_change()
  from public, anon, authenticated;

drop trigger if exists voyages_broadcast_status_change on public.voyages;

create trigger voyages_broadcast_status_change
after update of status on public.voyages
for each row
when (old.status is distinct from new.status)
execute function public.broadcast_voyage_status_change();

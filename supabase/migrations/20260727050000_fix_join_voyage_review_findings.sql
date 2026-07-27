-- Story 2.3 code review fixes.
--
-- 1. Error codes were misusing Postgres's reserved P0-class meanings: P0003
--    conventionally means too_many_rows, P0004 means assert_failure -- neither
--    matches what this function used them for ("invalid code" / "ended").
--    Harmless today (the client only reads .message), but a landmine for any
--    future .code-based branching. Switched to non-reserved custom codes.
-- 2. The idempotent-rejoin check was a separate `select exists(...)` before the
--    insert -- a classic check-then-act race under a double-tap or concurrent
--    call: two calls can both pass the exists-check before either inserts, and
--    the second then hits unique_violation and reports the AD-9 "already have
--    an active Voyage" error for a conflict that's actually with the same
--    Voyage being joined. Folded the check into the exception handler instead,
--    evaluated against the real row that caused the violation -- correct even
--    under concurrent calls, since unique_violation only fires once the
--    conflicting row is already committed.
create or replace function public.join_voyage(p_join_code text)
returns public.voyages
language plpgsql
security definer
set search_path = public
as $$
declare
  v_voyage_id uuid;
  v_status text;
  result public.voyages;
begin
  if p_join_code is null or btrim(p_join_code) = '' then
    raise exception 'A Join Code/Link is required.' using errcode = '22023';
  end if;

  select id, status into v_voyage_id, v_status
  from public.voyages
  where join_code = p_join_code;

  if not found then
    raise exception 'This invite link is not valid.' using errcode = 'JOIN1';
  end if;

  if v_status <> 'active' then
    raise exception 'This trip has already ended.' using errcode = 'JOIN2';
  end if;

  begin
    insert into public.voyage_members (voyage_id, user_id, role)
    values (v_voyage_id, auth.uid(), 'voyager');
  exception
    when unique_violation then
      if exists (
        select 1 from public.voyage_members
        where voyage_id = v_voyage_id
          and user_id = auth.uid()
          and removed_at is null
          and is_active = true
      ) then
        -- Idempotent rejoin: already an active member of this exact Voyage.
        null;
      else
        -- AD-9: caller already has an active Voyage elsewhere. Same
        -- message/errcode as start_voyage()'s equivalent guard.
        raise exception 'You already have an active Voyage.' using errcode = 'P0001';
      end if;
  end;

  select * into strict result from public.voyages where id = v_voyage_id;

  return result;
end;
$$;

revoke execute on function public.join_voyage(text) from public;
revoke execute on function public.join_voyage(text) from anon;

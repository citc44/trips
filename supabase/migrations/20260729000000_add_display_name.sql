-- Story 2.5: Grant Organizer Status. Prerequisite: no display-name field
-- existed anywhere in this schema (OTP-only sign-in never collects one),
-- confirmed with the user directly as a blocker for identifying a specific
-- Voyager to grant Organizer status to.
alter table public.profiles
  add column display_name text;

-- Unlike mark_trust_moment_seen()/mark_driver_consent_seen(), this is NOT
-- coalesced to prevent overwrite -- a display name is ordinary user data a
-- person may want to change later, not a one-time consent/timestamp flag.
-- security invoker: writes only the caller's own row via auth.uid(), already
-- covered by the existing profiles_update_own/profiles_insert_own RLS
-- policies -- a convenience wrapper around an RLS-safe write, not a
-- privilege escalation. Server-side trim + length cap, not just client-side
-- validation (this project's "don't trust the client alone" discipline,
-- applied here to input validation rather than authorization).
create or replace function public.set_display_name(p_display_name text)
returns public.profiles
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_name text;
  result public.profiles;
begin
  v_name := btrim(p_display_name);

  if v_name is null or v_name = '' then
    raise exception 'A display name is required.' using errcode = '22023';
  end if;

  if char_length(v_name) > 60 then
    raise exception 'Display name must be 60 characters or fewer.' using errcode = '22023';
  end if;

  insert into public.profiles (user_id, display_name)
  values (auth.uid(), v_name)
  on conflict (user_id) do update
    set display_name = excluded.display_name
  returning * into result;

  return result;
end;
$$;

grant execute on function public.set_display_name(text) to authenticated;

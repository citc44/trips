-- Fixes the CRITICAL "Voyager markers never move in real time" bug.
--
-- Root cause (confirmed against Supabase's own docs, not guessed): the write
-- policy created in 20260731000000_live_map_locations.sql included
-- `payload ->> 'user_id' = auth.uid()::text` in its WITH CHECK clause. That
-- migration's own comment already flagged this exact clause as "genuinely
-- new, unproven ... verify realtime.messages' actual payload column shape
-- against live Supabase docs before trusting this without live testing" --
-- it was never actually verified, and it doesn't work.
--
-- Per Supabase's Realtime Authorization docs: "When Realtime generates a
-- policy for a client it performs a query on the realtime.messages table
-- and then rolls it back. Realtime does not store any messages in your
-- realtime.messages table." Broadcast-write authorization is evaluated
-- once per topic (a generic "can this user broadcast here at all" check),
-- not per-message -- the real `payload` content of an actual channel.send()
-- call is never what the WITH CHECK clause sees. `payload ->> 'user_id'`
-- therefore evaluated against an empty/synthetic row, `null = auth.uid()
-- ::text` is null (falsy), and every single broadcast INSERT was denied,
-- unconditionally, since this policy first went live. Reads (subscribing)
-- were never affected, which is exactly why the channel always looked
-- "connected" while markers silently never received a live update -- only
-- the once-per-session cold load (get_live_locations) ever showed a
-- position, and only a full app restart (which re-runs the cold load)
-- ever appeared to move a marker at all.
--
-- Fix: authorize broadcast writes by topic + active membership only, same
-- shape as the read policy right above it -- matching how Realtime
-- Authorization is actually meant to be used (a per-topic permission gate,
-- not per-payload content validation).
--
-- This reopens a narrower, lower-severity gap the removed clause was
-- trying (and failing) to close: an active Voyager could still hand-craft
-- a broadcast payload claiming a different member's user_id, since nothing
-- server-side now inspects payload content. The app's own client code
-- never does this (location-repository.ts always sends the caller's own
-- id), so this isn't exploitable through normal use of Voylo itself, only
-- through a modified client or direct API access. Deriving the broadcast
-- server-side (e.g. from upsert_location() itself, via realtime.send())
-- would close this properly, but that changes the "ephemeral broadcast
-- every ~5s / throttled durable write every 30s" cadence this app
-- deliberately built (AD-3) into one shared cadence -- a real design
-- change, not a one-line fix, and out of scope for restoring core
-- functionality right now. Tracked as follow-up hardening, not a blocker.
drop policy if exists "voyage_channel_write_active_members" on realtime.messages;

create policy "voyage_channel_write_active_members" on realtime.messages
  for insert
  to authenticated
  with check (
    exists (
      select 1 from public.voyage_members vm
      where 'voyage:' || vm.voyage_id::text = realtime.topic()
        and vm.user_id = auth.uid()
        and public.is_active_voyage_member(vm.voyage_id, auth.uid())
    )
  );

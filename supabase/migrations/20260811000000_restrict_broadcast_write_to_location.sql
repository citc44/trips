-- Story 5.1 AC1: the voyage_channel_write_active_members Broadcast write
-- policy (20260810000000_hybrid_live_journey_bus.sql) checks sender
-- identity, voyage/topic match, and active membership, but never restricts
-- the message *type* -- an active member could broadcast a hand-crafted
-- `journey.event.created` message directly, bypassing create_journey_event
-- (AD-14) entirely and forging a journey event no one ever inserted into
-- journey_events. Only the location fast path is a legitimate
-- client-originated Broadcast write; every journey event must come from
-- create_journey_event's own security-definer realtime.send(), which this
-- INSERT policy does not gate at all.

drop policy if exists "voyage_channel_write_active_members" on realtime.messages;
create policy "voyage_channel_write_active_members" on realtime.messages
  for insert
  to authenticated
  with check (
    realtime.messages.extension = 'broadcast'
    and payload ->> 'type' = 'location.updated'
    and payload ->> 'senderUserId' = (select auth.uid())::text
    and payload ->> 'voyageId' is not null
    and (select realtime.topic()) = 'voyage:' || (payload ->> 'voyageId')
    and public.is_active_voyage_member((payload ->> 'voyageId')::uuid, (select auth.uid()))
  );

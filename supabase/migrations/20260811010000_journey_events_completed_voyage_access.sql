-- Story 6.1 AC1/AC4: journey_events_select_members was the one table still
-- gating on is_active_voyage_member -- once a Voyage ends, its journey
-- events (exactly the content Memory Lane needs) became unreadable to
-- everyone, including former participants. is_voyage_participant already
-- exists (20260804020000_voyage_membership_departure.sql) and already
-- governs voyages_select_members/get_voyage_members/etc. -- this migration
-- does not create a new predicate, it just applies the existing one here too.

drop policy if exists "journey_events_select_members" on public.journey_events;
create policy "journey_events_select_members" on public.journey_events
  for select to authenticated
  using (public.is_voyage_participant(voyage_id, (select auth.uid())));

-- Defaults match the only rows that exist today: create_journey_event
-- (Story 5.1's manual spotting path) is the sole writer, and every row it
-- creates is an immediately-real manual entry, not a proposed/classified one.
alter table public.journey_events
  add column if not exists status text not null default 'confirmed'
    check (status in ('proposed', 'confirmed', 'suppressed', 'corrected')),
  add column if not exists source text not null default 'manual'
    check (source in ('server', 'automatic', 'manual', 'computed'));

-- Supporting indexes for the two new history RPCs (get_voyage_history scans
-- voyage_members by user_id; get_journey_event_history scans journey_events
-- by voyage_id + occurred_at). Neither existed before this migration.
create index if not exists voyage_members_user_id_idx on public.voyage_members (user_id);
create index if not exists journey_events_voyage_occurred_idx on public.journey_events (voyage_id, occurred_at desc);

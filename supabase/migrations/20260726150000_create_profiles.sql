-- Story 1.4: Trust Moment. First application table + RLS policy set.
-- driver_consent_seen_at is included now (schema-shape decision) even though
-- only Story 1.5 sets it -- both flags belong to the same one-time-onboarding
-- row, and this avoids an ALTER TABLE on a table just created in the same epic.

create table public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  trust_moment_seen_at timestamptz,
  driver_consent_seen_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "profiles_select_own" on public.profiles
  for select using (auth.uid() = user_id);

create policy "profiles_insert_own" on public.profiles
  for insert with check (auth.uid() = user_id);

create policy "profiles_update_own" on public.profiles
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

import { expect, test } from '@jest/globals';

import { latestMigrationContaining } from '../test-helpers';

// Story 6.1 AC1/AC4: journey_events_select_members was the one table still
// gating on is_active_voyage_member, meaning journey events for an ended
// Voyage were unreadable to everyone. No live-Postgres RLS test harness
// exists in this repo (same constraint noted in Story 5.1's
// broadcast-write-policy.test.ts) -- this is the same lightweight
// "read migration SQL as text, assert on the policy's own isolated clause"
// alternative.

test('journey_events_select_members uses is_voyage_participant, not is_active_voyage_member, so completed-Voyage events remain readable', () => {
  const sql = latestMigrationContaining(/create policy "journey_events_select_members"/);

  const policyMatch = sql.match(/create policy "journey_events_select_members"[\s\S]*?using \(([\s\S]*?)\);/);
  expect(policyMatch).not.toBeNull();
  const using = policyMatch![1];

  expect(using).toMatch(/is_voyage_participant/);
  expect(using).not.toMatch(/is_active_voyage_member/);
});

test('journey_events gains status and source columns with the correct defaults and check constraints, guarded for re-apply', () => {
  const sql = latestMigrationContaining(/add column if not exists status text/);

  expect(sql).toMatch(/add column if not exists status text not null default 'confirmed'\s+check \(status in \('proposed', 'confirmed', 'suppressed', 'corrected'\)\)/);
  expect(sql).toMatch(/add column if not exists source text not null default 'manual'\s+check \(source in \('server', 'automatic', 'manual', 'computed'\)\)/);
});

test('supporting indexes exist for the new history RPCs', () => {
  const sql = latestMigrationContaining(/voyage_members_user_id_idx/);

  expect(sql).toMatch(/create index if not exists voyage_members_user_id_idx on public\.voyage_members \(user_id\)/);
  expect(sql).toMatch(/create index if not exists journey_events_voyage_occurred_idx on public\.journey_events \(voyage_id, occurred_at desc\)/);
});

import { expect, test } from '@jest/globals';

import { latestMigrationContaining } from '../test-helpers';

// No pgTAP/local Postgres test harness exists in this repo (Story 5.1 Dev
// Notes: "No SQL/RLS test framework exists"). This is the sanctioned
// lightweight alternative: verify the *latest* migration that touches
// `voyage_channel_write_active_members` actually restricts client Broadcast
// writes to `location.updated`, closing the journey-event-forgery gap
// (Story 5.1 AC1). A real RLS integration test would need a live Postgres
// instance this test environment doesn't have.

test('voyage_channel_write_active_members restricts client Broadcast writes to location.updated, preventing forged journey events', () => {
  const sql = latestMigrationContaining(/voyage_channel_write_active_members/);

  // Isolate the policy's own WITH CHECK clause, not the whole file, so this
  // assertion can't accidentally pass by matching an unrelated policy.
  const policyMatch = sql.match(
    /create policy "voyage_channel_write_active_members"[\s\S]*?with check \(([\s\S]*?)\);/,
  );
  expect(policyMatch).not.toBeNull();
  const withCheck = policyMatch![1];

  // Pre-existing checks must still be present (not accidentally dropped
  // while adding the new restriction).
  expect(withCheck).toMatch(/extension = 'broadcast'/);
  expect(withCheck).toMatch(/payload ->> 'senderUserId' = \(select auth\.uid\(\)\)::text/);
  expect(withCheck).toMatch(/is_active_voyage_member/);

  // The actual fix: only location.updated may be client-broadcast. Every
  // journey event must come from create_journey_event's own
  // security-definer realtime.send(), which this INSERT policy never gates.
  expect(withCheck).toMatch(/payload ->> 'type' = 'location\.updated'/);
});

test('voyage_channel_presence_active_members (a different extension) is untouched by this fix', () => {
  // Code review finding: this previously reused latestMigrationContaining
  // scoped to the *write* policy's own name -- which, once this story's own
  // migration existed, resolved to that migration (since it's alphabetically
  // last and does mention voyage_channel_write_active_members), which never
  // defines the presence policy at all. The `if (presenceMatch)` guard then
  // silently skipped every assertion, passing vacuously regardless of the
  // presence policy's real content. Searching by the presence policy's own
  // name finds the migration that actually defines it, and asserting
  // unconditionally (no `if`) makes this test fail if that ever changes.
  const sql = latestMigrationContaining(/create policy "voyage_channel_presence_active_members"/);
  const presenceMatch = sql.match(/create policy "voyage_channel_presence_active_members"[\s\S]*?with check \(([\s\S]*?)\);/);
  expect(presenceMatch).not.toBeNull();
  expect(presenceMatch![1]).toMatch(/extension = 'presence'/);
});

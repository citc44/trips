import { expect, test } from '@jest/globals';

import { latestMigrationContaining } from '../test-helpers';

// Story 6.1 AC2/AC3: no live-Postgres RPC test harness exists in this repo
// (same constraint as broadcast-write-policy.test.ts and
// journey-events-completed-voyage-access.test.ts) -- this asserts on the
// migration's own SQL text for the same reason those do.

function extractFunctionBody(sql: string, functionName: string): string {
  const match = sql.match(new RegExp(`create or replace function public\\.${functionName}\\([\\s\\S]*?\\$\\$;`));
  if (!match) throw new Error(`Function ${functionName} not found`);
  return match[0];
}

test('get_voyage_history returns the caller\'s own ended Voyages, keyset-paginated with a tiebreak cursor and a clamped limit', () => {
  const sql = latestMigrationContaining(/function public\.get_voyage_history/);
  const fn = extractFunctionBody(sql, 'get_voyage_history');

  // Scoped implicitly by auth.uid() via is_voyage_participant -- no p_voyage_id parameter.
  expect(fn).not.toMatch(/p_voyage_id/);
  expect(fn).toMatch(/p_before timestamptz default null/);
  // Code review finding: a single-column cursor can skip/duplicate rows that
  // share the exact same ended_at at a page boundary -- p_before_id
  // tiebreaks on id, the same column the ORDER BY's second key is.
  expect(fn).toMatch(/p_before_id uuid default null/);
  expect(fn).toMatch(/p_limit integer default 20/);
  expect(fn).toMatch(/where v\.status = 'ended'/);
  expect(fn).toMatch(/public\.is_voyage_participant\(v\.id, auth\.uid\(\)\)/);
  expect(fn).toMatch(
    /v\.ended_at < p_before\s+or \(v\.ended_at = p_before and p_before_id is not null and v\.id < p_before_id\)/,
  );
  expect(fn).toMatch(/order by v\.ended_at desc, v\.id desc/);
  // Clamped on both ends, not just the upper bound -- 0 or negative previously
  // either silently returned an empty page or raised a raw Postgres error.
  expect(fn).toMatch(/limit greatest\(least\(coalesce\(p_limit, 20\), 100\), 1\)/);
  // voyager_count must mirror end_voyage()'s own computation: removed_at-based, not is_active-based.
  expect(fn).toMatch(/where vm\.voyage_id = v\.id and vm\.removed_at is null/);
  expect(fn).not.toMatch(/vm\.is_active/);

  expect(sql).toMatch(/revoke execute on function public\.get_voyage_history/);
  expect(sql).toMatch(/grant execute on function public\.get_voyage_history\([^)]*\) to authenticated/);
});

test('get_journey_event_history returns keyset-paginated journey_events for a Voyage the caller participates in, with a required Voyage id, a tiebreak cursor, and a clamped limit', () => {
  const sql = latestMigrationContaining(/function public\.get_journey_event_history/);
  const fn = extractFunctionBody(sql, 'get_journey_event_history');

  expect(fn).toMatch(/p_voyage_id uuid/);
  // Code review finding: a null p_voyage_id previously fell straight through
  // to the participant check, surfacing a misleading "not a participant"
  // error instead of a validation error.
  expect(fn).toMatch(/if p_voyage_id is null then/);
  expect(fn).toMatch(/raise exception 'A Voyage id is required\.' using errcode = '22023'/);
  expect(fn).toMatch(/p_before timestamptz default null/);
  expect(fn).toMatch(/p_before_id uuid default null/);
  expect(fn).toMatch(/p_limit integer default 50/);
  expect(fn).toMatch(/if not public\.is_voyage_participant\(p_voyage_id, auth\.uid\(\)\) then/);
  expect(fn).toMatch(/using errcode = 'EVT03'/);
  expect(fn).toMatch(
    /je\.occurred_at < p_before\s+or \(je\.occurred_at = p_before and p_before_id is not null and je\.id < p_before_id\)/,
  );
  expect(fn).toMatch(/order by je\.occurred_at desc, je\.id desc/);
  expect(fn).toMatch(/limit greatest\(least\(coalesce\(p_limit, 50\), 200\), 1\)/);

  expect(sql).toMatch(/revoke execute on function public\.get_journey_event_history/);
  expect(sql).toMatch(/grant execute on function public\.get_journey_event_history\([^)]*\) to authenticated/);
});

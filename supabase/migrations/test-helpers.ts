import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

// Code review finding (Story 6.1): this was duplicated verbatim across
// journey-events-completed-voyage-access.test.ts and
// voyage-and-journey-event-history-rpcs.test.ts (itself following the
// pattern Story 5.1's broadcast-write-policy.test.ts established). No
// live-Postgres test harness exists in this repo -- every migration test in
// this directory reads migration SQL as text and asserts on it for that
// reason; this is the shared implementation, not a new pattern.
const MIGRATIONS_DIR = __dirname;

export function latestMigrationContaining(pattern: RegExp): string {
  const files = readdirSync(MIGRATIONS_DIR)
    .filter((name) => name.endsWith('.sql'))
    .sort();
  const matches = files.filter((name) => pattern.test(readFileSync(join(MIGRATIONS_DIR, name), 'utf8')));
  if (matches.length === 0) throw new Error(`No migration matches ${pattern}`);
  return readFileSync(join(MIGRATIONS_DIR, matches[matches.length - 1]), 'utf8');
}

import { expect, test } from '@jest/globals';

import { getSuperlativeCopy, getWhoJoinedCopy } from '@/shared/lib/memory-lane-copy';
import type { MemoryLaneData, MemoryLaneVoyager } from '@/repositories/memory-lane-composer';

function voyager(overrides: Partial<MemoryLaneVoyager> = {}): MemoryLaneVoyager {
  return {
    userId: 'user-1',
    displayName: 'Chintan',
    playerColor: 'teal',
    role: 'organizer',
    joinedAt: '2026-08-11T10:00:00.000Z',
    spotCount: 0,
    ...overrides,
  };
}

function data(overrides: Partial<MemoryLaneData> = {}): MemoryLaneData {
  return {
    voyageId: 'voyage-1',
    destination: 'Lake Tahoe',
    createdAt: '2026-08-11T10:00:00.000Z',
    endedAt: '2026-08-11T16:42:00.000Z',
    durationMs: 0,
    voyagers: [voyager()],
    lateJoiner: null,
    lateJoinDelayMs: null,
    totalSpotCount: 0,
    topSpotter: null,
    ...overrides,
  };
}

test('getWhoJoinedCopy names the late joiner and formats a minutes-scale delay', () => {
  const meera = voyager({ userId: 'user-2', displayName: 'Meera', joinedAt: '2026-08-11T10:42:00.000Z' });
  const copy = getWhoJoinedCopy(
    data({
      voyagers: [voyager(), meera],
      lateJoiner: meera,
      lateJoinDelayMs: 42 * 60 * 1000,
    }),
  );

  expect(copy.headline).toBe('Meera showed up fashionably late — 42 minutes in.');
});

test('getWhoJoinedCopy formats an hours-scale delay per UJ-3\'s established canon', () => {
  const sam = voyager({ userId: 'user-3', displayName: 'Sam', joinedAt: '2026-08-11T16:00:00.000Z' });
  const copy = getWhoJoinedCopy(
    data({
      voyagers: [voyager(), sam],
      lateJoiner: sam,
      lateJoinDelayMs: 6 * 60 * 60 * 1000,
    }),
  );

  expect(copy.headline).toBe('Sam showed up fashionably late — 6 hours in.');
});

test('getWhoJoinedCopy names everyone else who was already on the road', () => {
  const meera = voyager({ userId: 'user-2', displayName: 'Meera', joinedAt: '2026-08-11T10:20:00.000Z' });
  const sam = voyager({ userId: 'user-3', displayName: 'Sam', joinedAt: '2026-08-11T10:42:00.000Z' });
  const copy = getWhoJoinedCopy(
    data({
      voyagers: [voyager(), meera, sam],
      lateJoiner: sam,
      lateJoinDelayMs: 42 * 60 * 1000,
    }),
  );

  expect(copy.subhead).toBe('Chintan and Meera were already on the road.');
});

test('getWhoJoinedCopy falls back to a solo-appropriate variant when nobody else joined', () => {
  const copy = getWhoJoinedCopy(data({ voyagers: [voyager()], lateJoiner: null, lateJoinDelayMs: null }));

  expect(copy.headline).toBe('Just Chintan and the open road.');
  expect(copy.subhead).toBe('Every good story starts somewhere.');
});

test('getWhoJoinedCopy falls back to "A Voyager" for a null display name', () => {
  const anon = voyager({ userId: 'user-2', displayName: null, joinedAt: '2026-08-11T10:42:00.000Z' });
  const copy = getWhoJoinedCopy(
    data({ voyagers: [voyager(), anon], lateJoiner: anon, lateJoinDelayMs: 42 * 60 * 1000 }),
  );

  expect(copy.headline).toBe('A Voyager showed up fashionably late — 42 minutes in.');
});

test('getSuperlativeCopy names the top spotter and their tally', () => {
  const meera = voyager({ userId: 'user-2', displayName: 'Meera', spotCount: 3 });
  const copy = getSuperlativeCopy(data({ voyagers: [voyager(), meera], totalSpotCount: 3, topSpotter: meera }));

  expect(copy).toEqual({ headline: 'Meera', subhead: 'Most spots logged — 3.' });
});

test('getSuperlativeCopy returns null when nobody logged a spot (not a fabricated zero-value winner)', () => {
  const copy = getSuperlativeCopy(data({ totalSpotCount: 0, topSpotter: null }));

  expect(copy).toBeNull();
});

import { expect, test } from '@jest/globals';

import { composeMemoryLane, type EndedMemoryLaneVoyage } from '@/repositories/memory-lane-composer';
import type { VoyageMember } from '@/repositories/voyage-repository';
import type { JourneyEventRecord } from '@/repositories/journey-event-repository';

function voyage(overrides: Partial<EndedMemoryLaneVoyage> = {}): EndedMemoryLaneVoyage {
  return {
    id: 'voyage-1',
    destination: 'Lake Tahoe',
    destinationLat: null,
    destinationLng: null,
    status: 'ended',
    createdBy: 'user-1',
    createdAt: '2026-08-11T10:00:00.000Z',
    endedAt: '2026-08-11T16:42:00.000Z',
    joinCode: null,
    ...overrides,
  };
}

function member(overrides: Partial<VoyageMember> = {}): VoyageMember {
  return {
    userId: 'user-1',
    displayName: 'Chintan',
    role: 'organizer',
    joinedAt: '2026-08-11T10:00:00.000Z',
    playerColor: 'teal',
    travelRole: null,
    ...overrides,
  };
}

function event(overrides: Partial<JourneyEventRecord> = {}): JourneyEventRecord {
  return {
    id: 'event-1',
    voyageId: 'voyage-1',
    actorUserId: 'user-1',
    eventType: 'police',
    occurredAt: '2026-08-11T11:00:00.000Z',
    metadata: {},
    status: 'confirmed',
    source: 'manual',
    createdAt: '2026-08-11T11:00:00.000Z',
    ...overrides,
  };
}

test('composeMemoryLane computes duration from createdAt to endedAt', () => {
  const data = composeMemoryLane(voyage(), [member()], []);
  // 10:00 -> 16:42 = 6h 42m
  expect(data.durationMs).toBe((6 * 60 + 42) * 60 * 1000);
});

test('composeMemoryLane orders voyagers by joinedAt ascending and identifies the last joiner', () => {
  const members = [
    member({ userId: 'user-2', displayName: 'Meera', role: 'voyager', joinedAt: '2026-08-11T10:05:00.000Z' }),
    member({ userId: 'user-1', displayName: 'Chintan', role: 'organizer', joinedAt: '2026-08-11T10:00:00.000Z' }),
    member({ userId: 'user-3', displayName: 'Sam', role: 'voyager', joinedAt: '2026-08-11T10:42:00.000Z' }),
  ];

  const data = composeMemoryLane(voyage(), members, []);

  expect(data.voyagers.map((v) => v.userId)).toEqual(['user-1', 'user-2', 'user-3']);
  expect(data.lateJoiner?.userId).toBe('user-3');
  expect(data.lateJoinDelayMs).toBe(42 * 60 * 1000);
});

test('composeMemoryLane reports no late joiner for a solo (unjoined) Voyage', () => {
  const data = composeMemoryLane(voyage(), [member()], []);

  expect(data.voyagers).toHaveLength(1);
  expect(data.lateJoiner).toBeNull();
  expect(data.lateJoinDelayMs).toBeNull();
});

test('composeMemoryLane tallies confirmed spotting events per Voyager and picks the top spotter', () => {
  const members = [
    member({ userId: 'user-1', displayName: 'Chintan' }),
    member({ userId: 'user-2', displayName: 'Meera', joinedAt: '2026-08-11T10:05:00.000Z' }),
  ];
  const events = [
    event({ id: 'e1', actorUserId: 'user-1', eventType: 'police' }),
    event({ id: 'e2', actorUserId: 'user-2', eventType: 'deer' }),
    event({ id: 'e3', actorUserId: 'user-2', eventType: 'construction' }),
  ];

  const data = composeMemoryLane(voyage(), members, events);

  expect(data.totalSpotCount).toBe(3);
  expect(data.voyagers.find((v) => v.userId === 'user-1')?.spotCount).toBe(1);
  expect(data.voyagers.find((v) => v.userId === 'user-2')?.spotCount).toBe(2);
  expect(data.topSpotter?.userId).toBe('user-2');
});

test('composeMemoryLane breaks a spotCount tie by earliest join', () => {
  const members = [
    member({ userId: 'user-1', displayName: 'Chintan', joinedAt: '2026-08-11T10:00:00.000Z' }),
    member({ userId: 'user-2', displayName: 'Meera', joinedAt: '2026-08-11T10:05:00.000Z' }),
  ];
  const events = [
    event({ id: 'e1', actorUserId: 'user-1', eventType: 'police' }),
    event({ id: 'e2', actorUserId: 'user-2', eventType: 'deer' }),
  ];

  const data = composeMemoryLane(voyage(), members, events);

  expect(data.voyagers.find((v) => v.userId === 'user-1')?.spotCount).toBe(1);
  expect(data.voyagers.find((v) => v.userId === 'user-2')?.spotCount).toBe(1);
  expect(data.topSpotter?.userId).toBe('user-1');
});

test('composeMemoryLane excludes non-confirmed journey events from the tally (Task 0 filtering decision)', () => {
  const events = [
    event({ id: 'e1', status: 'confirmed' }),
    event({ id: 'e2', status: 'proposed' }),
    event({ id: 'e3', status: 'suppressed' }),
    event({ id: 'e4', status: 'corrected' }),
  ];

  const data = composeMemoryLane(voyage(), [member()], events);

  expect(data.totalSpotCount).toBe(1);
});

test('composeMemoryLane ignores non-spotting journey event types when tallying', () => {
  const events = [event({ id: 'e1', eventType: 'police' }), event({ id: 'e2', eventType: 'traffic_delay' }), event({ id: 'e3', eventType: 'coffee_stop' })];

  const data = composeMemoryLane(voyage(), [member()], events);

  expect(data.totalSpotCount).toBe(1);
});

test('composeMemoryLane returns a null topSpotter (not zero/undefined) when nobody logged a spot', () => {
  const data = composeMemoryLane(voyage(), [member()], []);

  expect(data.totalSpotCount).toBe(0);
  expect(data.topSpotter).toBeNull();
});

test('composeMemoryLane produces complete, non-empty output for zero Fun Facts/photos (no such data exists yet)', () => {
  const data = composeMemoryLane(voyage(), [member()], []);

  expect(data.destination).toBe('Lake Tahoe');
  expect(data.voyagers).toHaveLength(1);
  expect(data.durationMs).toBeGreaterThan(0);
});

test('composeMemoryLane is idempotent -- identical inputs produce byte-identical output', () => {
  const members = [
    member({ userId: 'user-1', displayName: 'Chintan' }),
    member({ userId: 'user-2', displayName: 'Meera', joinedAt: '2026-08-11T10:42:00.000Z' }),
  ];
  const events = [event({ id: 'e1', actorUserId: 'user-1' })];

  const first = composeMemoryLane(voyage(), members, events);
  const second = composeMemoryLane(voyage(), members, events);

  expect(JSON.stringify(first)).toBe(JSON.stringify(second));
});

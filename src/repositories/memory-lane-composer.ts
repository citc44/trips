import type { JourneyEventRecord } from '@/repositories/journey-event-repository';
import type { PlayerColor, Voyage, VoyageMember } from '@/repositories/voyage-repository';

// Story 5.1's manual spotting log control only ever produces these three
// event types (see active-voyage.tsx's handleLogSpotting/spot-*-button) --
// other JourneyEventType values (stop, traffic_delay, coffee_stop, custom)
// are not "spottings" and must not be counted toward the tally/superlative.
const SPOTTING_EVENT_TYPES = new Set(['police', 'deer', 'construction']);

// Task 0's filtering decision: only a confirmed event is real, user-visible
// journey history. journey_events.status also allows 'proposed' (not yet
// finalized), 'suppressed' (deliberately hidden), and 'corrected' (superseded
// by a later row) -- none of those belong in a Memory Lane recap.
const VISIBLE_STATUS = 'confirmed';

export type MemoryLaneVoyager = {
  userId: string;
  displayName: string | null;
  playerColor: PlayerColor | null;
  role: 'organizer' | 'voyager';
  joinedAt: string;
  spotCount: number;
};

export type MemoryLaneData = {
  voyageId: string;
  destination: string;
  createdAt: string;
  endedAt: string;
  durationMs: number;
  // Ascending by joinedAt -- the Organizer is always first in practice
  // (AD-9's atomic start_voyage() creates their membership with the Voyage
  // itself), but this composer doesn't assume that; it only sorts.
  voyagers: MemoryLaneVoyager[];
  // The most-recently-joined Voyager, for the "who joined" card -- null for
  // a solo (unjoined) Voyage, where "who joined late" isn't a meaningful
  // question (AC5: still a complete recap, just without this specific beat).
  lateJoiner: MemoryLaneVoyager | null;
  lateJoinDelayMs: number | null;
  totalSpotCount: number;
  // The Voyager with the most confirmed spottings, ties broken by earliest
  // join (deterministic, since `voyagers` is already join-order sorted).
  // Null when nobody logged a single spot -- not zero/undefined, so callers
  // can distinguish "no data" from "data says zero" unambiguously.
  topSpotter: MemoryLaneVoyager | null;
};

// A composer input never has a null endedAt in practice (Memory Lane only
// ever exists for a Voyage that has actually ended), but Voyage's own type
// still carries `endedAt: string | null` -- this narrows it at the
// composer's boundary rather than asserting non-null deep inside the
// computation. Built directly off `Voyage`, not `EndedVoyage` (which adds a
// `voyagerCount` this composer never reads -- that field exists for the
// Voyage History list, a different consumer) -- requiring it here would
// force every caller to synthesize a meaningless value just to satisfy the
// type.
export type EndedMemoryLaneVoyage = Voyage & { endedAt: string };

// Pure, deterministic, no I/O -- identical inputs always produce identical
// output (AC3's idempotency requirement is satisfied structurally by this
// function never writing anything and never reading a clock/random source,
// not by any dedup/uniqueness check).
export function composeMemoryLane(voyage: EndedMemoryLaneVoyage, members: VoyageMember[], events: JourneyEventRecord[]): MemoryLaneData {
  const durationMs = new Date(voyage.endedAt).getTime() - new Date(voyage.createdAt).getTime();

  const spotCounts = new Map<string, number>();
  let totalSpotCount = 0;
  for (const event of events) {
    if (event.status !== VISIBLE_STATUS) continue;
    if (!SPOTTING_EVENT_TYPES.has(event.eventType)) continue;
    if (!event.actorUserId) continue;
    spotCounts.set(event.actorUserId, (spotCounts.get(event.actorUserId) ?? 0) + 1);
    totalSpotCount += 1;
  }

  const sortedMembers = [...members].sort((a, b) => new Date(a.joinedAt).getTime() - new Date(b.joinedAt).getTime());

  const voyagers: MemoryLaneVoyager[] = sortedMembers.map((m) => ({
    userId: m.userId,
    displayName: m.displayName,
    playerColor: m.playerColor,
    role: m.role,
    joinedAt: m.joinedAt,
    spotCount: spotCounts.get(m.userId) ?? 0,
  }));

  const lateJoiner = voyagers.length > 1 ? voyagers[voyagers.length - 1] : null;
  const lateJoinDelayMs = lateJoiner ? new Date(lateJoiner.joinedAt).getTime() - new Date(voyage.createdAt).getTime() : null;

  const topSpotter = voyagers.reduce<MemoryLaneVoyager | null>((top, current) => {
    if (current.spotCount === 0) return top;
    if (!top || current.spotCount > top.spotCount) return current;
    return top;
  }, null);

  return {
    voyageId: voyage.id,
    destination: voyage.destination,
    createdAt: voyage.createdAt,
    endedAt: voyage.endedAt,
    durationMs,
    voyagers,
    lateJoiner,
    lateJoinDelayMs,
    totalSpotCount,
    topSpotter,
  };
}

import type { MemoryLaneData, MemoryLaneVoyager } from '@/repositories/memory-lane-composer';

export type MemoryLaneCopy = { headline: string; subhead: string };

function name(voyager: MemoryLaneVoyager): string {
  return voyager.displayName ?? 'A Voyager';
}

// Minutes below an hour, otherwise whole hours -- matches UJ-3's own
// established canon ("Sam joins six hours after the Voyage started," never
// expressed in minutes at that scale) rather than a literal ms->min
// conversion that would read as "360 minutes in."
function formatDelay(delayMs: number): string {
  const totalMinutes = Math.round(delayMs / 60000);
  if (totalMinutes < 60) {
    return `${totalMinutes} minute${totalMinutes === 1 ? '' : 's'}`;
  }
  const hours = Math.round(totalMinutes / 60);
  return `${hours} hour${hours === 1 ? '' : 's'}`;
}

// Who-Joined card (Voice and Tone: "Sam showed up fashionably late — 42
// minutes in."). Solo Voyages (AC5) get their own on-brand variant -- "who
// joined late" isn't a meaningful question with nobody else on the trip, but
// this card still has to say something real, not a degraded/empty state.
export function getWhoJoinedCopy(data: MemoryLaneData): MemoryLaneCopy {
  if (!data.lateJoiner || data.lateJoinDelayMs == null) {
    // data.voyagers[0] is safe in every real case (a Voyage always has >=1
    // member -- AD-9's atomic start_voyage()), but this card must still say
    // something real rather than crash if that invariant is ever violated
    // elsewhere.
    const solo = data.voyagers[0];
    return {
      headline: solo ? `Just ${name(solo)} and the open road.` : 'This trip is still being written.',
      subhead: 'Every good story starts somewhere.',
    };
  }

  const others = data.voyagers.filter((v) => v.userId !== data.lateJoiner!.userId).map(name);
  const othersList =
    others.length <= 1
      ? (others[0] ?? '')
      : `${others.slice(0, -1).join(', ')} and ${others[others.length - 1]}`;

  return {
    headline: `${name(data.lateJoiner)} showed up fashionably late — ${formatDelay(data.lateJoinDelayMs)} in.`,
    subhead: `${othersList} ${others.length === 1 ? 'was' : 'were'} already on the road.`,
  };
}

// Superlatives card. Null (not a fabricated zero-value winner) when nobody
// logged a single spot -- the deck screen decides how to render that case,
// this function only ever describes real data.
export function getSuperlativeCopy(data: MemoryLaneData): MemoryLaneCopy | null {
  if (!data.topSpotter || data.totalSpotCount === 0) return null;

  return {
    headline: name(data.topSpotter),
    subhead: `Most spots logged — ${data.topSpotter.spotCount}.`,
  };
}

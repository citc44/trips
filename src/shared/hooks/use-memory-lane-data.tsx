import { useCallback, useEffect, useRef, useState } from 'react';

import { journeyEventRepository, type JourneyEventRecord } from '@/repositories/journey-event-repository';
import { composeMemoryLane, type MemoryLaneData } from '@/repositories/memory-lane-composer';
import type { RepositoryError } from '@/repositories/types';
import { voyageRepository } from '@/repositories/voyage-repository';

// get_journey_event_history's own server-clamped max per page (see its
// migration) -- a single page comfortably covers a typical trip's manual
// spotting taps, but a very active/long trip can exceed it, so this walks
// the keyset cursor (occurred_at, id) until a short page signals the end,
// rather than trusting one page to be the whole history.
const EVENT_HISTORY_PAGE_LIMIT = 200;

const NOT_ENDED_ERROR = 'This Voyage has not ended yet.';
const NOT_FOUND_ERROR = "This Voylo couldn't be found.";

async function fetchAllEvents(voyageId: string): Promise<{ data: JourneyEventRecord[] | null; error: RepositoryError | null }> {
  const all: JourneyEventRecord[] = [];
  let before: string | undefined;
  let beforeId: string | undefined;

  for (;;) {
    // Sequential by necessity -- each page's cursor depends on the previous page's last row; pages can't be requested in parallel.
    const page = await journeyEventRepository.getEventHistory(voyageId, before, beforeId, EVENT_HISTORY_PAGE_LIMIT);
    if (page.error) return { data: null, error: page.error };
    const rows = page.data ?? [];
    all.push(...rows);
    if (rows.length < EVENT_HISTORY_PAGE_LIMIT) break;
    const last = rows[rows.length - 1];
    before = last.occurredAt;
    beforeId = last.id;
  }

  return { data: all, error: null };
}

export type UseMemoryLaneDataResult = {
  data: MemoryLaneData | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
};

// AC3's idempotency + AC4's "revisit it later" both rest on this hook never
// caching/reusing stale data across a call -- every invocation (initial
// mount or an explicit refetch()) re-fetches all three sources fresh and
// re-runs composeMemoryLane, a pure function, over them. Fetches run in
// parallel (Promise.all), not sequentially -- these three reads are
// independent of one another.
export function useMemoryLaneData(voyageId: string | null): UseMemoryLaneDataResult {
  const [data, setData] = useState<MemoryLaneData | null>(null);
  const [isLoading, setIsLoading] = useState(!!voyageId);
  const [error, setError] = useState<string | null>(null);
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const load = useCallback(async () => {
    if (!voyageId) {
      setData(null);
      setError(null);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    const [voyageResult, membersResult, eventsResult] = await Promise.all([
      voyageRepository.getVoyage(voyageId),
      voyageRepository.getVoyageMembers(voyageId),
      fetchAllEvents(voyageId),
    ]);

    if (!isMountedRef.current) return;

    if (voyageResult.error) {
      setData(null);
      setError(voyageResult.error.message);
      setIsLoading(false);
      return;
    }
    if (!voyageResult.data) {
      setData(null);
      setError(NOT_FOUND_ERROR);
      setIsLoading(false);
      return;
    }
    if (voyageResult.data.status !== 'ended' || !voyageResult.data.endedAt) {
      setData(null);
      setError(NOT_ENDED_ERROR);
      setIsLoading(false);
      return;
    }
    if (membersResult.error) {
      setData(null);
      setError(membersResult.error.message);
      setIsLoading(false);
      return;
    }
    if (eventsResult.error) {
      setData(null);
      setError(eventsResult.error.message);
      setIsLoading(false);
      return;
    }

    const composed = composeMemoryLane(
      { ...voyageResult.data, endedAt: voyageResult.data.endedAt },
      membersResult.data ?? [],
      eventsResult.data ?? [],
    );

    setData(composed);
    setIsLoading(false);
  }, [voyageId]);

  useEffect(() => {
    // .then(), not a direct `void load()` call -- the lint rule's static
    // analysis flags any function known to update state when invoked
    // directly in an effect body, regardless of internal await placement;
    // routing the call through an actual Promise continuation (the same
    // shape use-profile.tsx's fetch effect already uses) satisfies it.
    Promise.resolve().then(() => load());
  }, [load]);

  return { data, isLoading, error, refetch: load };
}

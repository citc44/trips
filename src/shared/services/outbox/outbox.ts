import AsyncStorage from '@react-native-async-storage/async-storage';

import { voyageRepository } from '@/repositories/voyage-repository';

// AD-7's offline write-outbox. Deliberately scoped to only the three Voyage
// lifecycle writes that happen from *within* an already-active Voyage
// session (Live Map's Organizer menu) and leave the user on the same screen
// either way -- start_voyage/join_voyage are out of scope (see this story's
// own Dev Notes: both navigate immediately to a new screen using
// server-generated data that doesn't exist until the write lands, with no
// coherent "queued, still show the next screen" UX without a bigger
// redesign).
export type OutboxItem =
  | { id: string; kind: 'end_voyage'; payload: { voyageId: string }; queuedAt: string }
  | { id: string; kind: 'grant_organizer_status'; payload: { voyageId: string; targetUserId: string }; queuedAt: string }
  | { id: string; kind: 'remove_voyager'; payload: { voyageId: string; targetUserId: string }; queuedAt: string };

const STORAGE_KEY = 'voylo:offline-write-outbox';

async function loadQueue(): Promise<OutboxItem[]> {
  const stored = await AsyncStorage.getItem(STORAGE_KEY);
  return stored ? (JSON.parse(stored) as OutboxItem[]) : [];
}

async function saveQueue(items: OutboxItem[]): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(items));
}

async function enqueue(item: Omit<OutboxItem, 'id' | 'queuedAt'>): Promise<void> {
  const queue = await loadQueue();
  const fullItem = { ...item, id: `${Date.now()}-${Math.random().toString(36).slice(2)}`, queuedAt: new Date().toISOString() } as OutboxItem;
  await saveQueue([...queue, fullItem]);
}

function callForKind(item: OutboxItem): Promise<{ data?: unknown; error: { code: string; message: string } | null }> {
  switch (item.kind) {
    case 'end_voyage':
      return voyageRepository.endVoyage(item.payload.voyageId);
    case 'grant_organizer_status':
      return voyageRepository.grantOrganizerStatus(item.payload.voyageId, item.payload.targetUserId);
    case 'remove_voyager':
      return voyageRepository.removeVoyager(item.payload.voyageId, item.payload.targetUserId);
  }
}

type AttemptOutcome =
  | { outcome: 'succeeded'; data: unknown }
  | { outcome: 'conflict'; message: string }
  | { outcome: 'network-failure' };

// The crux of the whole outbox: distinguishing "the server actively
// rejected this" (a real, non-retryable conflict -- e.g. a stale
// precondition) from "we couldn't reach the server at all" (worth retrying
// later). None of endVoyage/grantOrganizerStatus/removeVoyager's own RPCs
// ever legitimately return error.code === 'unknown' themselves -- every real
// business/conflict error from those RPCs carries a specific errcode
// (END03, ORG01, REM02, REM03, REM04, MEM01, verified directly against
// their migrations). toRepositoryError()'s `code: error.code ?? 'unknown'`
// fallback only fires when supabase-js itself didn't have a real Postgres
// error to report -- exactly what a genuine network-level failure looks
// like. A thrown exception (not a resolved {error}) is unambiguously
// network-level too.
async function attemptItem(item: OutboxItem): Promise<AttemptOutcome> {
  try {
    const result = await callForKind(item);
    if (!result.error) return { outcome: 'succeeded', data: result.data ?? null };
    if (result.error.code === 'unknown') return { outcome: 'network-failure' };
    return { outcome: 'conflict', message: result.error.message };
  } catch {
    return { outcome: 'network-failure' };
  }
}

type FlushResult = {
  succeeded: { item: OutboxItem; data: unknown }[];
  conflicts: { item: OutboxItem; message: string }[];
};

// Iterates the queue in order. A succeeded or conflicting item is removed
// and the pass continues to the next item (AD-7: "one failed or conflicting
// item does not block the rest of the queue" -- a conflict means the server
// was reached and said no, so the network is evidently fine and trying the
// next item is correct). A network-level failure stops the whole pass right
// there -- that item and everything after it stays queued for the next
// flush trigger, since attempting more items while evidently still offline
// would just repeat the same failure.
async function flush(): Promise<FlushResult> {
  const items = await loadQueue();
  const succeeded: FlushResult['succeeded'] = [];
  const conflicts: FlushResult['conflicts'] = [];
  let stoppedAt = items.length;

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const result = await attemptItem(item);
    if (result.outcome === 'succeeded') {
      succeeded.push({ item, data: result.data });
    } else if (result.outcome === 'conflict') {
      conflicts.push({ item, message: result.message });
    } else {
      stoppedAt = i;
      break;
    }
  }

  await saveQueue(items.slice(stoppedAt));
  return { succeeded, conflicts };
}

export const outbox = { enqueue, flush };

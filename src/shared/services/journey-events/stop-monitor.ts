import AsyncStorage from '@react-native-async-storage/async-storage';

import { stopEventRepository } from '@/repositories/stop-event-repository';
import { createMessageId } from '@/shared/types/voyage-message';
import { advanceStopDetector, initialStopDetectorState, type StopDetectorState, type StopSample, type StopTrace } from './stop-detector';

type PersistedMonitor = { state: StopDetectorState; pending: { id: string; trace: StopTrace }[] };

const monitors = new Map<string, PersistedMonitor>();
const queues = new Map<string, Promise<void>>();
const storageKey = (voyageId: string) => `voylo:stop-monitor:${voyageId}`;

async function load(voyageId: string): Promise<PersistedMonitor> {
  const cached = monitors.get(voyageId);
  if (cached) return cached;
  try {
    const value = await AsyncStorage.getItem(storageKey(voyageId));
    const parsed = value ? JSON.parse(value) as PersistedMonitor : null;
    if (parsed?.state && Array.isArray(parsed.pending)) {
      monitors.set(voyageId, parsed);
      return parsed;
    }
  } catch { /* Corrupt/missing local evidence starts a fresh detector safely. */ }
  const monitor = { state: initialStopDetectorState(), pending: [] };
  monitors.set(voyageId, monitor);
  return monitor;
}

async function process(voyageId: string, sample: StopSample): Promise<void> {
  const monitor = await load(voyageId);
  const result = advanceStopDetector(monitor.state, sample);
  monitor.state = result.state;
  if (result.completed) monitor.pending.push({ id: createMessageId(), trace: result.completed });

  // Old events are bounded independently of the location outbox. Keep the
  // newest ten completed candidates; submission is idempotent by UUID.
  monitor.pending = monitor.pending.slice(-10);
  await AsyncStorage.setItem(storageKey(voyageId), JSON.stringify(monitor));

  const next = monitor.pending[0];
  if (!next) return;
  try {
    const response = await stopEventRepository.submitCandidate(voyageId, next.id, next.trace);
    if (!response.error) {
      monitor.pending.shift();
      await AsyncStorage.setItem(storageKey(voyageId), JSON.stringify(monitor));
    }
  } catch { /* Retain for the next GPS callback/reconnect. */ }
}

export function observeStopSample(voyageId: string, sample: StopSample): Promise<void> {
  const prior = queues.get(voyageId) ?? Promise.resolve();
  const next = prior.catch(() => {}).then(() => process(voyageId, sample));
  queues.set(voyageId, next);
  return next.finally(() => { if (queues.get(voyageId) === next) queues.delete(voyageId); });
}

export async function clearStopMonitor(voyageId: string): Promise<void> {
  monitors.delete(voyageId);
  queues.delete(voyageId);
  try { await AsyncStorage.removeItem(storageKey(voyageId)); } catch { /* Best-effort privacy cleanup. */ }
}

import type { RepositoryError } from '@/repositories/types';
import type { StopTrace } from '@/shared/services/journey-events/stop-detector';

const toError = (error: { code?: string | null; message: string }): RepositoryError => ({
  code: error.code ?? 'unknown', message: error.message,
});

async function submitCandidate(voyageId: string, id: string, trace: StopTrace) {
  // Lazy import keeps module evaluation lightweight for headless background
  // startup and allows the location task to be tested without booting Auth.
  const { supabase } = await import('@/lib/supabase');
  const { data, error } = await supabase.rpc('submit_stop_candidate', {
    p_id: id,
    p_voyage_id: voyageId,
    p_started_at: new Date(trace.startedAtMs).toISOString(),
    p_confirmed_at: new Date(trace.confirmedAtMs).toISOString(),
    p_ended_at: new Date(trace.endedAtMs).toISOString(),
    p_lat: trace.centroid.lat,
    p_lng: trace.centroid.lng,
    p_accuracy_m: trace.centroid.accuracyM,
    p_trace: trace.samples.map((sample) => ({
      lat: sample.lat, lng: sample.lng, capturedAt: new Date(sample.capturedAtMs).toISOString(),
      speedMps: sample.speedMps, accuracyM: sample.accuracyM, heading: sample.heading ?? null,
    })),
  });
  if (error) return { data: null, error: toError(error) };
  // Classification is best effort and shadow-only. The durable candidate is
  // already safe; a provider outage must not make the client retry its insert.
  void supabase.functions.invoke('classify-stop', { body: { stopId: id } }).catch(() => undefined);
  return { data, error: null };
}

export const stopEventRepository = { submitCandidate };

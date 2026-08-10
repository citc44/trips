export type StopSample = {
  lat: number;
  lng: number;
  capturedAtMs: number;
  speedMps: number | null;
  accuracyM: number | null;
  heading?: number | null;
};

export type StopTrace = {
  startedAtMs: number;
  confirmedAtMs: number;
  endedAtMs: number;
  centroid: { lat: number; lng: number; accuracyM: number };
  samples: StopSample[];
};

export type StopDetectorState =
  | { phase: 'moving'; recent: StopSample[] }
  | { phase: 'candidate'; anchor: StopSample; startedAtMs: number; samples: StopSample[] }
  | { phase: 'confirmed'; anchor: StopSample; startedAtMs: number; confirmedAtMs: number; samples: StopSample[] }
  | { phase: 'exiting'; anchor: StopSample; startedAtMs: number; confirmedAtMs: number; exitStartedAtMs: number; samples: StopSample[] };

export type StopDetectorResult = { state: StopDetectorState; completed: StopTrace | null };

const MAX_STOP_SPEED_MPS = 2;
const MIN_STOP_DURATION_MS = 5 * 60 * 1000;
const ENTER_RADIUS_M = 60;
const EXIT_RADIUS_M = 100;
const MAX_ACCURACY_M = 80;
const PRE_STOP_WINDOW_MS = 2 * 60 * 1000;
const EXIT_TRACE_WINDOW_MS = 60 * 1000;
const EXIT_TRACE_DISTANCE_M = 300;
const MAX_TRACE_SAMPLES = 80;

export const initialStopDetectorState = (): StopDetectorState => ({ phase: 'moving', recent: [] });

export function distanceM(a: Pick<StopSample, 'lat' | 'lng'>, b: Pick<StopSample, 'lat' | 'lng'>): number {
  const r = 6_371_000;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * r * Math.asin(Math.sqrt(h));
}

function bounded(samples: StopSample[]): StopSample[] {
  if (samples.length <= MAX_TRACE_SAMPLES) return samples;
  const stride = Math.ceil(samples.length / MAX_TRACE_SAMPLES);
  return samples.filter((_, index) => index % stride === 0).slice(-MAX_TRACE_SAMPLES);
}

function recent(samples: StopSample[], now: number): StopSample[] {
  return bounded(samples.filter((sample) => now - sample.capturedAtMs <= PRE_STOP_WINDOW_MS));
}

function centroid(samples: StopSample[]): StopTrace['centroid'] {
  const usable = samples.filter((sample) => (sample.accuracyM ?? MAX_ACCURACY_M) <= MAX_ACCURACY_M);
  const points = usable.length ? usable : samples;
  const totalWeight = points.reduce((sum, point) => sum + 1 / Math.max(point.accuracyM ?? 20, 5), 0);
  return {
    lat: points.reduce((sum, point) => sum + point.lat / Math.max(point.accuracyM ?? 20, 5), 0) / totalWeight,
    lng: points.reduce((sum, point) => sum + point.lng / Math.max(point.accuracyM ?? 20, 5), 0) / totalWeight,
    accuracyM: Math.max(...points.map((point) => point.accuracyM ?? MAX_ACCURACY_M)),
  };
}

export function advanceStopDetector(state: StopDetectorState, sample: StopSample): StopDetectorResult {
  const usable = sample.accuracyM != null && sample.accuracyM > 0 && sample.accuracyM <= MAX_ACCURACY_M;
  const stopped = usable && sample.speedMps != null && sample.speedMps >= 0 && sample.speedMps <= MAX_STOP_SPEED_MPS;

  if (state.phase === 'moving') {
    const history = recent([...state.recent, sample], sample.capturedAtMs);
    if (!stopped) return { state: { phase: 'moving', recent: history }, completed: null };
    return {
      state: { phase: 'candidate', anchor: sample, startedAtMs: sample.capturedAtMs, samples: history },
      completed: null,
    };
  }

  if (state.phase === 'exiting') {
    const samples = bounded([...state.samples, sample]);
    const exitComplete = sample.capturedAtMs - state.exitStartedAtMs >= EXIT_TRACE_WINDOW_MS
      || distanceM(state.anchor, sample) >= EXIT_TRACE_DISTANCE_M;
    if (!exitComplete) return { state: { ...state, samples }, completed: null };
    return {
      state: { phase: 'moving', recent: [sample] },
      completed: {
        startedAtMs: state.startedAtMs, confirmedAtMs: state.confirmedAtMs,
        endedAtMs: state.exitStartedAtMs, centroid: centroid(state.samples), samples,
      },
    };
  }

  const radius = state.phase === 'confirmed' ? EXIT_RADIUS_M : ENTER_RADIUS_M;
  const departed = !stopped || distanceM(state.anchor, sample) > radius;
  if (departed) {
    if (state.phase === 'confirmed') {
      return {
        state: { ...state, phase: 'exiting', exitStartedAtMs: sample.capturedAtMs, samples: bounded([...state.samples, sample]) },
        completed: null,
      };
    }
    return { state: { phase: 'moving', recent: [sample] }, completed: null };
  }

  const samples = bounded([...state.samples, sample]);
  if (state.phase === 'candidate' && sample.capturedAtMs - state.startedAtMs >= MIN_STOP_DURATION_MS) {
    return {
      state: { ...state, phase: 'confirmed', confirmedAtMs: sample.capturedAtMs, samples },
      completed: null,
    };
  }
  return { state: { ...state, samples }, completed: null };
}

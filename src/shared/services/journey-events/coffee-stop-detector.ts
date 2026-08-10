export type StopSample = {
  lat: number;
  lng: number;
  capturedAtMs: number;
  speedMps: number | null;
  accuracyM: number | null;
};

export type CoffeeStopState =
  | { phase: 'moving' }
  | { phase: 'candidate'; anchor: StopSample; startedAtMs: number }
  | { phase: 'confirmed'; anchor: StopSample; startedAtMs: number; confirmedAtMs: number };

const MAX_STOP_SPEED_MPS = 2;
const MIN_STOP_DURATION_MS = 5 * 60 * 1000;
const ENTER_RADIUS_M = 60;
const EXIT_RADIUS_M = 100;
const MAX_ACCURACY_M = 80;

function distanceM(a: StopSample, b: StopSample): number {
  const r = 6_371_000;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * r * Math.asin(Math.sqrt(h));
}

export function advanceCoffeeStop(state: CoffeeStopState, sample: StopSample): CoffeeStopState {
  const usable = (sample.accuracyM ?? 0) <= MAX_ACCURACY_M;
  const stopped = usable && (sample.speedMps ?? 0) <= MAX_STOP_SPEED_MPS;
  if (state.phase === 'moving') {
    return stopped ? { phase: 'candidate', anchor: sample, startedAtMs: sample.capturedAtMs } : state;
  }

  const radius = state.phase === 'confirmed' ? EXIT_RADIUS_M : ENTER_RADIUS_M;
  if (!stopped || distanceM(state.anchor, sample) > radius) return { phase: 'moving' };
  if (state.phase === 'candidate' && sample.capturedAtMs - state.startedAtMs >= MIN_STOP_DURATION_MS) {
    return { ...state, phase: 'confirmed', confirmedAtMs: sample.capturedAtMs };
  }
  return state;
}

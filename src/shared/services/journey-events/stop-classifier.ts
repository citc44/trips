import type { StopTrace } from '@/shared/services/journey-events/stop-detector';

export type StopCategory =
  | 'fuel' | 'coffee' | 'food' | 'rest_area' | 'service_plaza' | 'lodging'
  | 'shopping' | 'scenic' | 'attraction' | 'pickup_dropoff' | 'destination'
  | 'traffic' | 'unknown';

export type PlaceCandidate = {
  provider: 'mapbox' | 'foursquare' | 'google';
  providerPlaceId: string;
  name: string;
  primaryCategory: StopCategory;
  secondaryCategories: StopCategory[];
  distanceM: number;
  providerConfidence: number;
  containment: number;
  dwellCompatibility: number;
};

export type StopEvidence = {
  roadMatchConfidence: number | null;
  distanceFromRoadM: number | null;
  creepingPattern: number;
  liveTrafficEvidence: boolean;
  parkingDeviation: number;
  entryExitPattern: number;
  convoyCorroborationCount: number;
};

export type StopClassification = {
  kind: 'venue_stop' | 'traffic' | 'destination' | 'unknown';
  primaryCategory: StopCategory;
  secondaryCategories: StopCategory[];
  confidence: number;
  visibility: 'exact' | 'category' | 'generic' | 'suppressed';
  place: PlaceCandidate | null;
  scores: { traffic: number; venue: number; place: number };
  classifierVersion: 'stop-v1-shadow';
};

export interface NavigationContextProvider {
  analyzeTrace(trace: StopTrace): Promise<StopEvidence>;
}

export interface PlaceCandidateProvider {
  findCandidates(trace: StopTrace): Promise<PlaceCandidate[]>;
}

const clamp = (value: number): number => Math.max(0, Math.min(1, value));

export function classifyStop(evidence: StopEvidence, candidates: PlaceCandidate[]): StopClassification {
  const road = evidence.roadMatchConfidence ?? 0;
  const traffic = clamp(
    road * 0.3 + evidence.creepingPattern * 0.25 + Number(evidence.liveTrafficEvidence) * 0.3
      - evidence.parkingDeviation * 0.2 - Math.min(candidates[0]?.providerConfidence ?? 0, 1) * 0.1,
  );
  const best = [...candidates].sort((a, b) => scorePlace(b) - scorePlace(a))[0] ?? null;
  const place = best ? scorePlace(best) : 0;
  const offRoad = clamp((evidence.distanceFromRoadM ?? 0) / 60);
  const venue = clamp(
    offRoad * 0.2 + evidence.parkingDeviation * 0.25 + evidence.entryExitPattern * 0.2
      + place * 0.3 + Math.min(evidence.convoyCorroborationCount, 2) * 0.025
      - Number(evidence.liveTrafficEvidence) * 0.25,
  );

  if (traffic >= 0.72 && traffic > venue + 0.12) {
    return result('traffic', 'traffic', traffic, 'suppressed', null, traffic, venue, place);
  }
  if (venue < 0.5) return result('unknown', 'unknown', Math.max(traffic, venue), 'suppressed', null, traffic, venue, place);
  if (!best || place < 0.55) return result('venue_stop', 'unknown', venue, 'generic', null, traffic, venue, place);

  const confidence = clamp(venue * 0.55 + place * 0.45);
  const visibility = confidence >= 0.9 ? 'exact' : confidence >= 0.75 ? 'category' : 'generic';
  return result('venue_stop', best.primaryCategory, confidence, visibility, visibility === 'exact' ? best : null, traffic, venue, place, best.secondaryCategories);
}

function scorePlace(candidate: PlaceCandidate): number {
  const proximity = clamp(1 - candidate.distanceM / 150);
  return clamp(proximity * 0.25 + candidate.providerConfidence * 0.3 + candidate.containment * 0.25 + candidate.dwellCompatibility * 0.2);
}

function result(
  kind: StopClassification['kind'], primaryCategory: StopCategory, confidence: number,
  visibility: StopClassification['visibility'], place: PlaceCandidate | null,
  traffic: number, venue: number, placeScore: number, secondaryCategories: StopCategory[] = [],
): StopClassification {
  return {
    kind, primaryCategory, secondaryCategories, confidence: clamp(confidence), visibility, place,
    scores: { traffic, venue, place: placeScore }, classifierVersion: 'stop-v1-shadow',
  };
}

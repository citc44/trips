import { expect, test } from '@jest/globals';
import { classifyStop, type PlaceCandidate, type StopEvidence } from '@/shared/services/journey-events/stop-classifier';

const evidence = (overrides: Partial<StopEvidence> = {}): StopEvidence => ({
  roadMatchConfidence: 0.2, distanceFromRoadM: 50, creepingPattern: 0,
  liveTrafficEvidence: false, parkingDeviation: 0.9, entryExitPattern: 0.9,
  convoyCorroborationCount: 0, ...overrides,
});
const place = (overrides: Partial<PlaceCandidate> = {}): PlaceCandidate => ({
  provider: 'mapbox', providerPlaceId: 'poi.1', name: 'Pilot', primaryCategory: 'fuel',
  secondaryCategories: [], distanceM: 8, providerConfidence: 0.98, containment: 1,
  dwellCompatibility: 1, ...overrides,
});

test('traffic evidence suppresses a nearby venue instead of announcing it', () => {
  const result = classifyStop(evidence({ roadMatchConfidence: 1, distanceFromRoadM: 2, creepingPattern: 1, liveTrafficEvidence: true, parkingDeviation: 0, entryExitPattern: 0 }), [place({ distanceM: 40, providerConfidence: 0.6 })]);
  expect(result).toMatchObject({ kind: 'traffic', primaryCategory: 'traffic', visibility: 'suppressed' });
});

test('strong facility evidence can produce an exact classified venue', () => {
  const result = classifyStop(evidence(), [place()]);
  expect(result).toMatchObject({ kind: 'venue_stop', primaryCategory: 'fuel', visibility: 'exact' });
  expect(result.place?.name).toBe('Pilot');
});

test('ambiguous place evidence degrades to generic rather than guessing', () => {
  const result = classifyStop(evidence({ parkingDeviation: 0.7, entryExitPattern: 0.6 }), [place({ distanceM: 130, providerConfidence: 0.4, containment: 0.2, dwellCompatibility: 0.5 })]);
  expect(['generic', 'suppressed']).toContain(result.visibility);
  expect(result.place).toBeNull();
});

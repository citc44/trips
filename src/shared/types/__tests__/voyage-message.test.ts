import { expect, test } from '@jest/globals';
import { isJourneyEventSignal, isLocationSignal, VOYAGE_PROTOCOL_VERSION } from '@/shared/types/voyage-message';

const base = { protocolVersion: VOYAGE_PROTOCOL_VERSION, messageId: 'm1', voyageId: 'v1', senderUserId: 'u1', senderSessionId: 's1', sequence: 1, capturedAt: '2026-08-10T12:00:00Z', sentAt: '2026-08-10T12:00:00Z' };

test('accepts complete v1 location signals and rejects unknown versions', () => {
  const signal = { ...base, type: 'location.updated', payload: { lat: 39, lng: -120, heading: 90, speedMps: 20, accuracyM: 5 } };
  expect(isLocationSignal(signal)).toBe(true);
  expect(isLocationSignal({ ...signal, protocolVersion: 2 })).toBe(false);
});

test('recognizes durable journey-event signals independently', () => {
  expect(isJourneyEventSignal({ ...base, type: 'journey.event.created', payload: { eventId: 'e1', eventType: 'stop', occurredAt: base.capturedAt, actorUserId: 'u1', metadata: { primaryCategory: 'coffee' } } })).toBe(true);
});

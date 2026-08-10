export const VOYAGE_PROTOCOL_VERSION = 1 as const;

export type LocationSignalPayload = {
  lat: number;
  lng: number;
  heading: number | null;
  speedMps: number | null;
  accuracyM: number | null;
};

// `coffee_stop` remains accepted during the mobile compatibility window. New
// automatic classification always emits one generic `stop` lifecycle event;
// coffee/fuel/rest-area are metadata categories, never event types.
export type JourneyEventType = 'stop' | 'traffic_delay' | 'coffee_stop' | 'police' | 'deer' | 'construction' | 'custom';

export type JourneyEventPayload = {
  eventId: string;
  eventType: JourneyEventType;
  occurredAt: string;
  actorUserId: string | null;
  metadata: Record<string, unknown>;
};

export type VoyageMessage<TType extends string, TPayload> = {
  protocolVersion: typeof VOYAGE_PROTOCOL_VERSION;
  messageId: string;
  voyageId: string;
  senderUserId: string;
  senderSessionId: string;
  sequence: number;
  type: TType;
  capturedAt: string;
  sentAt: string;
  payload: TPayload;
};

export type LocationSignal = VoyageMessage<'location.updated', LocationSignalPayload>;
export type JourneyEventSignal = VoyageMessage<'journey.event.created', JourneyEventPayload>;
export type SupportedVoyageMessage = LocationSignal | JourneyEventSignal;

export function createMessageId(): string {
  const cryptoObject = globalThis.crypto as { randomUUID?: () => string } | undefined;
  return cryptoObject?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function isLocationSignal(value: unknown): value is LocationSignal {
  if (!value || typeof value !== 'object') return false;
  const message = value as Partial<LocationSignal>;
  const payload = message.payload as Partial<LocationSignalPayload> | undefined;
  return (
    message.protocolVersion === VOYAGE_PROTOCOL_VERSION &&
    message.type === 'location.updated' &&
    typeof message.messageId === 'string' &&
    typeof message.voyageId === 'string' &&
    typeof message.senderUserId === 'string' &&
    typeof message.senderSessionId === 'string' &&
    typeof message.sequence === 'number' &&
    typeof message.capturedAt === 'string' &&
    typeof payload?.lat === 'number' &&
    typeof payload?.lng === 'number'
  );
}

export function isJourneyEventSignal(value: unknown): value is JourneyEventSignal {
  if (!value || typeof value !== 'object') return false;
  const message = value as Partial<JourneyEventSignal>;
  const payload = message.payload as Partial<JourneyEventPayload> | undefined;
  return message.protocolVersion === VOYAGE_PROTOCOL_VERSION && message.type === 'journey.event.created'
    && typeof message.voyageId === 'string' && typeof message.messageId === 'string'
    && typeof payload?.eventId === 'string' && typeof payload?.eventType === 'string'
    && typeof payload?.occurredAt === 'string';
}

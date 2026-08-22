import { supabase } from '@/lib/supabase';
import type { RepositoryError } from '@/repositories/types';
import type { JourneyEventPayload, JourneyEventType } from '@/shared/types/voyage-message';

type JourneyEventRow = {
  id: string;
  actor_user_id: string | null;
  event_type: JourneyEventType;
  occurred_at: string;
  metadata: Record<string, unknown> | null;
};

// Story 6.1 AC5: a distinct shape for history reads, not a retrofit of
// JourneyEventPayload above -- that type is the live-broadcast (AD-14)
// payload and intentionally does not carry status/source.
export type JourneyEventRecord = {
  id: string;
  voyageId: string;
  actorUserId: string | null;
  eventType: JourneyEventType;
  occurredAt: string;
  metadata: Record<string, unknown>;
  status: string;
  source: string;
  createdAt: string;
};

type JourneyEventHistoryRow = {
  id: string;
  voyage_id: string;
  actor_user_id: string | null;
  event_type: JourneyEventType;
  occurred_at: string;
  metadata: Record<string, unknown> | null;
  status: string;
  source: string;
  created_at: string;
};

type JourneyEventHistoryResult = { data: JourneyEventRecord[] | null; error: RepositoryError | null };

function toError(error: { code?: string | null; message: string }): RepositoryError {
  return { code: error.code ?? 'unknown', message: error.message };
}

async function createEvent(
  voyageId: string,
  event: { id: string; type: JourneyEventType; occurredAt: string; metadata?: Record<string, unknown> },
): Promise<{ data: JourneyEventPayload | null; error: RepositoryError | null }> {
  const { data, error } = await supabase.rpc('create_journey_event', {
    p_event_id: event.id,
    p_voyage_id: voyageId,
    p_event_type: event.type,
    p_occurred_at: event.occurredAt,
    p_metadata: event.metadata ?? {},
  });
  if (error) return { data: null, error: toError(error) };
  const row = data as JourneyEventRow;
  return {
    data: {
      eventId: row.id, eventType: row.event_type, occurredAt: row.occurred_at,
      actorUserId: row.actor_user_id, metadata: row.metadata ?? {},
    },
    error: null,
  };
}

// Story 6.1 AC3/AC5: keyset-paginated history for a Voyage the caller
// participates in (active or ended). get_journey_event_history() is
// table-returning, same PostgREST array shape as create_journey_event()'s
// row -- an empty array is a valid "no events yet" result, not an error.
async function getEventHistory(
  voyageId: string,
  before?: string,
  beforeId?: string,
  limit = 50,
): Promise<JourneyEventHistoryResult> {
  const { data, error } = await supabase.rpc('get_journey_event_history', {
    p_voyage_id: voyageId,
    p_before: before ?? null,
    p_before_id: beforeId ?? null,
    p_limit: limit,
  });
  if (error) return { data: null, error: toError(error) };

  const rows = (data as JourneyEventHistoryRow[] | null) ?? [];
  return {
    data: rows.map((row) => ({
      id: row.id,
      voyageId: row.voyage_id,
      actorUserId: row.actor_user_id,
      eventType: row.event_type,
      occurredAt: row.occurred_at,
      metadata: row.metadata ?? {},
      status: row.status,
      source: row.source,
      createdAt: row.created_at,
    })),
    error: null,
  };
}

export const journeyEventRepository = { createEvent, getEventHistory };

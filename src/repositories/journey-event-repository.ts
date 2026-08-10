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

export const journeyEventRepository = { createEvent };

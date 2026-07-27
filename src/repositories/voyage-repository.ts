import { supabase } from '@/lib/supabase';
import type { RepositoryError } from '@/repositories/types';

export type Voyage = {
  id: string;
  destination: string;
  status: 'active' | 'ended';
  createdBy: string;
  createdAt: string;
  endedAt: string | null;
  joinCode: string | null;
};

type VoyageRow = {
  id: string;
  destination: string;
  status: 'active' | 'ended';
  created_by: string;
  created_at: string;
  ended_at: string | null;
  join_code: string | null;
};

type VoyageResult = { data: Voyage | null; error: RepositoryError | null };

export type VoyagePreview = {
  destination: string;
  status: 'active' | 'ended';
  voyagerCount: number;
};

type VoyagePreviewRow = {
  destination: string;
  status: 'active' | 'ended';
  voyager_count: number;
};

type VoyagePreviewResult = { data: VoyagePreview | null; error: RepositoryError | null };

function toVoyage(row: VoyageRow): Voyage {
  return {
    id: row.id,
    destination: row.destination,
    status: row.status,
    createdBy: row.created_by,
    createdAt: row.created_at,
    endedAt: row.ended_at,
    joinCode: row.join_code,
  };
}

function toRepositoryError(error: { code?: string | null; message: string }): RepositoryError {
  return { code: error.code ?? 'unknown', message: error.message };
}

async function startVoyage(destination: string): Promise<VoyageResult> {
  // Atomic (Voyage + organizer membership created together server-side): the
  // start_voyage() RPC also enforces AD-9 (one active Voyage per user) and
  // surfaces a clear error on rejection -- see its migration for the full
  // rationale. No client-side two-step create.
  const { data, error } = await supabase.rpc('start_voyage', { p_destination: destination });

  if (error) {
    return { data: null, error: toRepositoryError(error) };
  }

  // Defensive: never trust "no error" alone as "definitely valid data" -- the
  // RPC's own `select ... into strict` guards against this server-side, but a
  // repository shouldn't rely solely on that (code review finding).
  const row = data as VoyageRow | null;
  if (!row?.id) {
    return { data: null, error: { code: 'unknown', message: 'Failed to create Voyage.' } };
  }

  return { data: toVoyage(row), error: null };
}

async function getVoyagePreview(joinCode: string): Promise<VoyagePreviewResult> {
  // get_voyage_preview() is a table-returning (set-returning) Postgres function,
  // so PostgREST returns an array, unlike start_voyage()'s single-row RPC. An
  // empty array is the valid "invalid/unknown code" case, not an error.
  const { data, error } = await supabase.rpc('get_voyage_preview', { p_join_code: joinCode });

  if (error) {
    return { data: null, error: toRepositoryError(error) };
  }

  const rows = data as VoyagePreviewRow[] | null;
  const row = rows?.[0];
  if (!row) {
    return { data: null, error: { code: 'not_found', message: 'This invite link is not valid.' } };
  }

  return {
    data: { destination: row.destination, status: row.status, voyagerCount: Number(row.voyager_count) },
    error: null,
  };
}

async function joinVoyage(joinCode: string): Promise<VoyageResult> {
  // join_voyage() enforces AD-9 and the invalid/ended-code cases server-side and
  // surfaces a clear error on rejection -- see its migration for the full
  // rationale. No client-side multi-step write.
  const { data, error } = await supabase.rpc('join_voyage', { p_join_code: joinCode });

  if (error) {
    return { data: null, error: toRepositoryError(error) };
  }

  const row = data as VoyageRow | null;
  if (!row?.id) {
    return { data: null, error: { code: 'unknown', message: 'Failed to join Voyage.' } };
  }

  return { data: toVoyage(row), error: null };
}

export const voyageRepository = { startVoyage, getVoyagePreview, joinVoyage };

import { supabase } from '@/lib/supabase';
import type { RepositoryError } from '@/repositories/types';

export type Voyage = {
  id: string;
  destination: string;
  status: 'active' | 'ended';
  createdBy: string;
  createdAt: string;
  endedAt: string | null;
};

type VoyageRow = {
  id: string;
  destination: string;
  status: 'active' | 'ended';
  created_by: string;
  created_at: string;
  ended_at: string | null;
};

type VoyageResult = { data: Voyage | null; error: RepositoryError | null };

function toVoyage(row: VoyageRow): Voyage {
  return {
    id: row.id,
    destination: row.destination,
    status: row.status,
    createdBy: row.created_by,
    createdAt: row.created_at,
    endedAt: row.ended_at,
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

  return { data: toVoyage(data as VoyageRow), error: null };
}

export const voyageRepository = { startVoyage };

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

export type ActiveVoyage = {
  voyage: Voyage;
  role: 'organizer' | 'voyager';
};

type ActiveVoyageRow = VoyageRow & { my_role: 'organizer' | 'voyager' };

type ActiveVoyageResult = { data: ActiveVoyage | null; error: RepositoryError | null };

export type EndedVoyage = Voyage & { voyagerCount: number };

type EndedVoyageRow = VoyageRow & { voyager_count: number };

type EndedVoyageResult = { data: EndedVoyage | null; error: RepositoryError | null };

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

// Join codes are generated from an uppercase-only alphabet (Story 2.2); normalizing
// here (not just trusting the caller) protects against any future manual-entry path
// where a user might type/paste a code in the wrong case (code review finding).
function normalizeJoinCode(joinCode: string): string {
  return joinCode.trim().toUpperCase();
}

async function getVoyagePreview(joinCode: string): Promise<VoyagePreviewResult> {
  // get_voyage_preview() is a table-returning (set-returning) Postgres function,
  // so PostgREST returns an array, unlike start_voyage()'s single-row RPC. An
  // empty array is the valid "invalid/unknown code" case, not an error.
  const { data, error } = await supabase.rpc('get_voyage_preview', { p_join_code: normalizeJoinCode(joinCode) });

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
  const { data, error } = await supabase.rpc('join_voyage', { p_join_code: normalizeJoinCode(joinCode) });

  if (error) {
    return { data: null, error: toRepositoryError(error) };
  }

  const row = data as VoyageRow | null;
  if (!row?.id) {
    return { data: null, error: { code: 'unknown', message: 'Failed to join Voyage.' } };
  }

  return { data: toVoyage(row), error: null };
}

async function getMyActiveVoyage(): Promise<ActiveVoyageResult> {
  // get_my_active_voyage() is table-returning (set-returning), same PostgREST
  // array shape as get_voyage_preview(). An empty array is the valid "no
  // active Voyage" case, not an error -- AD-9 guarantees at most one row.
  const { data, error } = await supabase.rpc('get_my_active_voyage');

  if (error) {
    return { data: null, error: toRepositoryError(error) };
  }

  const rows = data as ActiveVoyageRow[] | null;
  const row = rows?.[0];
  if (!row) {
    return { data: null, error: null };
  }

  return { data: { voyage: toVoyage(row), role: row.my_role }, error: null };
}

async function endVoyage(voyageId: string): Promise<EndedVoyageResult> {
  // end_voyage() is table-returning (extends the plain Voyage shape with a
  // Voyager count for the Voyage Ended summary), so PostgREST returns an
  // array, same as get_voyage_preview()/get_my_active_voyage(). Enforces
  // organizer-only authorization and releases AD-9's lock for every member
  // server-side -- see its migration for the full rationale. No client-side
  // multi-step write.
  const { data, error } = await supabase.rpc('end_voyage', { p_voyage_id: voyageId });

  if (error) {
    return { data: null, error: toRepositoryError(error) };
  }

  const rows = data as EndedVoyageRow[] | null;
  const row = rows?.[0];
  if (!row?.id) {
    return { data: null, error: { code: 'unknown', message: 'Failed to end Voyage.' } };
  }

  return { data: { ...toVoyage(row), voyagerCount: Number(row.voyager_count) }, error: null };
}

export const voyageRepository = { startVoyage, getVoyagePreview, joinVoyage, getMyActiveVoyage, endVoyage };

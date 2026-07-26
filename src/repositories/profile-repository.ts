import { supabase } from '@/lib/supabase';

export type Profile = {
  userId: string;
  trustMomentSeenAt: string | null;
  driverConsentSeenAt: string | null;
};

export type RepositoryError = { code: string; message: string };

type ProfileRow = {
  user_id: string;
  trust_moment_seen_at: string | null;
  driver_consent_seen_at: string | null;
};

type ProfileResult = { data: Profile | null; error: RepositoryError | null };

function toProfile(row: ProfileRow): Profile {
  return {
    userId: row.user_id,
    trustMomentSeenAt: row.trust_moment_seen_at,
    driverConsentSeenAt: row.driver_consent_seen_at,
  };
}

function toRepositoryError(error: { code?: string | null; message: string }): RepositoryError {
  return { code: error.code ?? 'unknown', message: error.message };
}

async function getProfile(userId: string): Promise<ProfileResult> {
  const { data, error } = await supabase.from('profiles').select('*').eq('user_id', userId).maybeSingle();

  if (error) {
    return { data: null, error: toRepositoryError(error) };
  }

  return { data: data ? toProfile(data as ProfileRow) : null, error: null };
}

async function markTrustMomentSeen(userId: string): Promise<ProfileResult> {
  const { data, error } = await supabase
    .from('profiles')
    .upsert({ user_id: userId, trust_moment_seen_at: new Date().toISOString() }, { onConflict: 'user_id' })
    .select()
    .single();

  if (error) {
    return { data: null, error: toRepositoryError(error) };
  }

  return { data: toProfile(data as ProfileRow), error: null };
}

export const profileRepository = { getProfile, markTrustMomentSeen };

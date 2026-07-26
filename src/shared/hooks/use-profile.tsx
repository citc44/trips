import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

import { profileRepository, type Profile, type RepositoryError } from '@/repositories/profile-repository';
import { useAuth } from '@/shared/hooks/use-auth';

type ProfileContextValue = {
  profile: Profile | null;
  isLoading: boolean;
  markTrustMomentSeen: () => Promise<{ error: RepositoryError | null }>;
};

const ProfileContext = createContext<ProfileContextValue | undefined>(undefined);

export function ProfileProvider({ children }: { children: ReactNode }) {
  const { session } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const userId = session?.user.id;

  useEffect(() => {
    let isMounted = true;

    if (!userId) {
      // Resolved via a microtask (not called synchronously in the effect body) so
      // this stays inside a promise callback, matching use-auth.tsx's pattern and
      // satisfying the react-hooks/set-state-in-effect rule.
      Promise.resolve().then(() => {
        if (!isMounted) return;
        setProfile(null);
        setIsLoading(false);
      });
      return () => {
        isMounted = false;
      };
    }

    profileRepository
      .getProfile(userId)
      .then(({ data }) => {
        if (!isMounted) return;
        setProfile(data);
        setIsLoading(false);
      })
      .catch(() => {
        if (!isMounted) return;
        setProfile(null);
        setIsLoading(false);
      });

    return () => {
      isMounted = false;
    };
    // Keyed on the user id, not the full session object: Supabase's autoRefreshToken
    // fires onAuthStateChange (a new session object) on every token refresh without the
    // user changing — refetching the profile on each of those would be wasted work and
    // would needlessly flip isLoading back to true for an already-loaded screen.
  }, [userId]);

  const markTrustMomentSeen = async (): Promise<{ error: RepositoryError | null }> => {
    if (!userId) {
      return { error: { code: 'no_session', message: 'Cannot mark trust moment seen without a session.' } };
    }

    const { data, error } = await profileRepository.markTrustMomentSeen(userId);
    if (!error && data) {
      setProfile(data);
    }
    return { error };
  };

  return (
    <ProfileContext.Provider value={{ profile, isLoading, markTrustMomentSeen }}>
      {children}
    </ProfileContext.Provider>
  );
}

export function useProfile(): ProfileContextValue {
  const context = useContext(ProfileContext);
  if (!context) throw new Error('useProfile must be used within a ProfileProvider');
  return context;
}

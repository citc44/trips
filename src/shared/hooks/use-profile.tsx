import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';

import { profileRepository, type Profile, type RepositoryError } from '@/repositories/profile-repository';
import { useAuth } from '@/shared/hooks/use-auth';

type ProfileContextValue = {
  profile: Profile | null;
  isLoading: boolean;
  hasError: boolean;
  markTrustMomentSeen: () => Promise<{ error: RepositoryError | null }>;
};

const ProfileContext = createContext<ProfileContextValue | undefined>(undefined);

export function ProfileProvider({ children }: { children: ReactNode }) {
  const { session } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [hasError, setHasError] = useState(false);
  // Tracks which user id (or `null` for "no session") `profile`/`hasError` currently
  // reflect. `undefined` means "not yet resolved for the current userId". Deriving
  // isLoading by comparing this to the live userId -- instead of a manually toggled
  // boolean -- means it can never go stale across a userId transition: a plain
  // boolean previously stayed `false` (set once on first mount, for the "no session
  // yet" case) even after a real session later arrived, because nothing ever reset
  // it back to `true`. That let _layout.tsx's loading gate open one render before
  // the real profile fetch had even started, flashing the wrong screen for every
  // returning, already-onboarded user (Story 1.4 code review finding).
  const [resolvedForUserId, setResolvedForUserId] = useState<string | null | undefined>(undefined);
  const userId = session?.user.id ?? null;
  const isLoading = resolvedForUserId !== userId;

  // A ref (not a closed-over variable) so markTrustMomentSeen's in-flight staleness
  // check below always reads the *latest* userId, not the one from whichever render
  // created the closure the caller happens to be holding -- a plain closed-over
  // `session`/`userId` would still read its own render's value even after a later
  // render changed it, silently defeating the guard (caught by this story's own
  // code review: a test simulating sign-out mid-request proved the closure-based
  // version never actually blocked the stale write).
  const latestUserIdRef = useRef(userId);
  useEffect(() => {
    latestUserIdRef.current = userId;
  }, [userId]);

  useEffect(() => {
    let isMounted = true;

    if (!userId) {
      // Resolved via a microtask (not called synchronously in the effect body) so
      // this stays inside a promise callback, matching use-auth.tsx's pattern and
      // satisfying the react-hooks/set-state-in-effect rule.
      Promise.resolve().then(() => {
        if (!isMounted) return;
        setProfile(null);
        setHasError(false);
        setResolvedForUserId(null);
      });
      return () => {
        isMounted = false;
      };
    }

    // Fail open on any error path (rejected promise, or a resolved { error } result --
    // profileRepository never rejects for ordinary Supabase/PostgREST errors, only for
    // genuine network/thrown failures, so both paths must be handled): a fetch error is
    // "unknown," not "definitely never seen." For this low-stakes, one-time consent
    // screen, treating "unknown" as "already seen" (via the hasError flag consumers can
    // check) is far less disruptive to trust than incorrectly re-showing it to an
    // already-onboarded user after a transient network blip -- a real risk for a
    // road-trip app that spends real time in cellular dead zones.
    profileRepository
      .getProfile(userId)
      .then(({ data, error }) => {
        if (!isMounted) return;
        if (error) {
          setProfile(null);
          setHasError(true);
        } else {
          setProfile(data);
          setHasError(false);
        }
        setResolvedForUserId(userId);
      })
      .catch(() => {
        if (!isMounted) return;
        setProfile(null);
        setHasError(true);
        setResolvedForUserId(userId);
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

    const requestedUserId = userId;
    const { data, error } = await profileRepository.markTrustMomentSeen();
    // Guard against a stale response landing after the session has since changed
    // (e.g. sign-out mid-request) -- applying it would resurrect profile data for
    // an account that's no longer signed in. Reads the ref, not a closed-over
    // variable, so it sees the *current* userId even if this function instance
    // was captured by a caller before a later render changed it.
    if (!error && data && latestUserIdRef.current === requestedUserId) {
      setProfile(data);
      setHasError(false);
    }
    return { error };
  };

  return (
    <ProfileContext.Provider value={{ profile, isLoading, hasError, markTrustMomentSeen }}>
      {children}
    </ProfileContext.Provider>
  );
}

export function useProfile(): ProfileContextValue {
  const context = useContext(ProfileContext);
  if (!context) throw new Error('useProfile must be used within a ProfileProvider');
  return context;
}

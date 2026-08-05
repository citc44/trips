import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';

import { voyageRepository, type ActiveVoyage } from '@/repositories/voyage-repository';
import { useAuth } from '@/shared/hooks/use-auth';

type ActiveVoyageContextValue = {
  activeVoyage: ActiveVoyage | null;
  isLoading: boolean;
  hasError: boolean;
  refetch: () => Promise<ActiveVoyageRefetchResult>;
  clearActiveVoyage: () => void;
};

export type ActiveVoyageRefetchResult = Awaited<ReturnType<typeof voyageRepository.getMyActiveVoyage>>;

const STALE_REFETCH_ERROR = {
  code: 'stale_request',
  message: 'Active Voyage changed while refreshing. Please try again.',
};

const ActiveVoyageContext = createContext<ActiveVoyageContextValue | undefined>(undefined);

export function ActiveVoyageProvider({ children }: { children: ReactNode }) {
  const { session } = useAuth();
  const [activeVoyage, setActiveVoyage] = useState<ActiveVoyage | null>(null);
  const [hasError, setHasError] = useState(false);
  // Same "resolved for userId" pattern as use-profile.tsx (Story 1.4 code
  // review): deriving isLoading by comparing this to the live userId, instead
  // of a manually toggled boolean, means it can never go stale across a userId
  // transition -- a plain boolean would stay false (set once on first mount)
  // even after a real session later arrived, letting _layout.tsx's routing
  // gate open one render before the real fetch had even started.
  const [resolvedForUserId, setResolvedForUserId] = useState<string | null | undefined>(undefined);
  const userId = session?.user.id ?? null;
  const isLoading = resolvedForUserId !== userId;
  // Every provider read (the session-driven load and an explicit refetch)
  // participates in the same generation. Only the newest request may commit
  // state. This also lets an authoritative local transition, such as a
  // successful leave, invalidate work that started before the server write.
  const latestRequestIdRef = useRef(0);
  const latestUserIdRef = useRef(userId);
  const isProviderMountedRef = useRef(true);

  useEffect(() => {
    isProviderMountedRef.current = true;
    return () => {
      isProviderMountedRef.current = false;
      latestRequestIdRef.current += 1;
    };
  }, []);

  useEffect(() => {
    let isMounted = true;
    latestUserIdRef.current = userId;
    const requestId = ++latestRequestIdRef.current;

    const canCommit = () =>
      isMounted &&
      isProviderMountedRef.current &&
      latestRequestIdRef.current === requestId &&
      latestUserIdRef.current === userId;

    if (!userId) {
      // Resolved via a microtask (not called synchronously in the effect body)
      // so this stays inside a promise callback, matching use-profile.tsx's
      // pattern and satisfying the react-hooks/set-state-in-effect rule.
      Promise.resolve().then(() => {
        if (!canCommit()) return;
        setActiveVoyage(null);
        setHasError(false);
        setResolvedForUserId(null);
      });
      return () => {
        isMounted = false;
      };
    }

    voyageRepository
      .getMyActiveVoyage()
      .then(({ data, error }) => {
        if (!canCommit()) return;
        if (error) {
          setActiveVoyage(null);
          setHasError(true);
        } else {
          setActiveVoyage(data);
          setHasError(false);
        }
        setResolvedForUserId(userId);
      })
      .catch(() => {
        if (!canCommit()) return;
        setActiveVoyage(null);
        setHasError(true);
        setResolvedForUserId(userId);
      });

    return () => {
      isMounted = false;
    };
  }, [userId]);

  // Lets active-voyage.tsx re-pull immediately after a membership change,
  // rather than waiting for some unrelated userId change to re-trigger the
  // effect above. Some callers fire this without awaiting it while the join
  // resolver awaits and inspects the result. It must never throw/reject in
  // either case: a network failure surfaces through both hasError and the
  // result's error field, never as an unhandled rejection.
  // Stable identity (keyed only on userId) so callers can safely list it in
  // their own effect dependency arrays without causing extra re-runs on every
  // provider render.
  const refetch = useCallback(async () => {
    if (!userId) {
      return { data: null, error: { code: 'not_authenticated', message: 'You must be signed in.' } };
    }
    const requestedUserId = userId;
    const requestId = ++latestRequestIdRef.current;
    const canCommit = () =>
      isProviderMountedRef.current &&
      latestRequestIdRef.current === requestId &&
      latestUserIdRef.current === requestedUserId;

    try {
      const { data, error } = await voyageRepository.getMyActiveVoyage();
      if (!canCommit()) {
        return { data: null, error: STALE_REFETCH_ERROR };
      }
      if (error) {
        setHasError(true);
        setResolvedForUserId(requestedUserId);
        return { data: null, error };
      }
      setActiveVoyage(data);
      setHasError(false);
      setResolvedForUserId(requestedUserId);
      return { data, error: null };
    } catch {
      if (!canCommit()) {
        return { data: null, error: STALE_REFETCH_ERROR };
      }
      setHasError(true);
      setResolvedForUserId(requestedUserId);
      return { data: null, error: { code: 'unknown', message: 'Something went wrong. Please try again.' } };
    }
  }, [userId]);

  // Call only after an authoritative server response confirms that this user
  // left the active Voyage. Clearing locally avoids making navigation depend
  // on a second network read, and advancing the generation prevents any read
  // that began before the leave from resurrecting the stale membership.
  const clearActiveVoyage = useCallback(() => {
    if (latestUserIdRef.current !== userId) return;
    latestRequestIdRef.current += 1;
    setActiveVoyage(null);
    setHasError(false);
    setResolvedForUserId(userId);
  }, [userId]);

  return (
    <ActiveVoyageContext.Provider value={{ activeVoyage, isLoading, hasError, refetch, clearActiveVoyage }}>
      {children}
    </ActiveVoyageContext.Provider>
  );
}

export function useActiveVoyage(): ActiveVoyageContextValue {
  const context = useContext(ActiveVoyageContext);
  if (!context) {
    throw new Error('useActiveVoyage must be used within an ActiveVoyageProvider');
  }
  return context;
}

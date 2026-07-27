import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

import { voyageRepository, type ActiveVoyage } from '@/repositories/voyage-repository';
import { useAuth } from '@/shared/hooks/use-auth';

type ActiveVoyageContextValue = {
  activeVoyage: ActiveVoyage | null;
  isLoading: boolean;
  hasError: boolean;
  refetch: () => Promise<void>;
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

  useEffect(() => {
    let isMounted = true;

    if (!userId) {
      // Resolved via a microtask (not called synchronously in the effect body)
      // so this stays inside a promise callback, matching use-profile.tsx's
      // pattern and satisfying the react-hooks/set-state-in-effect rule.
      Promise.resolve().then(() => {
        if (!isMounted) return;
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
        if (!isMounted) return;
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
        if (!isMounted) return;
        setActiveVoyage(null);
        setHasError(true);
        setResolvedForUserId(userId);
      });

    return () => {
      isMounted = false;
    };
  }, [userId]);

  // Lets active-voyage.tsx re-pull immediately after end_voyage() succeeds,
  // rather than waiting for some unrelated userId change to re-trigger the
  // effect above.
  const refetch = async () => {
    if (!userId) return;
    const { data, error } = await voyageRepository.getMyActiveVoyage();
    if (error) {
      setHasError(true);
      return;
    }
    setActiveVoyage(data);
    setHasError(false);
  };

  return (
    <ActiveVoyageContext.Provider value={{ activeVoyage, isLoading, hasError, refetch }}>{children}</ActiveVoyageContext.Provider>
  );
}

export function useActiveVoyage(): ActiveVoyageContextValue {
  const context = useContext(ActiveVoyageContext);
  if (!context) {
    throw new Error('useActiveVoyage must be used within an ActiveVoyageProvider');
  }
  return context;
}

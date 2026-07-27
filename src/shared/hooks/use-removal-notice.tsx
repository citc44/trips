import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';

import { voyageRepository, type RemovalNotice } from '@/repositories/voyage-repository';
import { useAuth } from '@/shared/hooks/use-auth';

type RemovalNoticeContextValue = {
  removalNotice: RemovalNotice | null;
  isLoading: boolean;
  hasError: boolean;
  acknowledge: () => Promise<void>;
};

const RemovalNoticeContext = createContext<RemovalNoticeContextValue | undefined>(undefined);

// Third hook following use-profile.tsx's established fetch-on-userId pattern
// (after use-active-voyage.tsx) -- copied faithfully, not re-derived.
export function RemovalNoticeProvider({ children }: { children: ReactNode }) {
  const { session } = useAuth();
  const [removalNotice, setRemovalNotice] = useState<RemovalNotice | null>(null);
  const [hasError, setHasError] = useState(false);
  const [resolvedForUserId, setResolvedForUserId] = useState<string | null | undefined>(undefined);
  const userId = session?.user.id ?? null;
  const isLoading = resolvedForUserId !== userId;

  useEffect(() => {
    let isMounted = true;

    if (!userId) {
      Promise.resolve().then(() => {
        if (!isMounted) return;
        setRemovalNotice(null);
        setHasError(false);
        setResolvedForUserId(null);
      });
      return () => {
        isMounted = false;
      };
    }

    voyageRepository
      .getRemovalNotice()
      .then(({ data, error }) => {
        if (!isMounted) return;
        if (error) {
          setRemovalNotice(null);
          setHasError(true);
        } else {
          setRemovalNotice(data);
          setHasError(false);
        }
        setResolvedForUserId(userId);
      })
      .catch(() => {
        if (!isMounted) return;
        setRemovalNotice(null);
        setHasError(true);
        setResolvedForUserId(userId);
      });

    return () => {
      isMounted = false;
    };
  }, [userId]);

  // A one-shot dismissal, not a re-pull like use-active-voyage.tsx's refetch.
  // Clears local state regardless of whether the server-side acknowledge call
  // itself succeeds -- fails open (same philosophy as use-profile.tsx's
  // seen-flag handling): if the RPC call fails, the notice may simply
  // reappear on next load, which is a self-healing fallback, not a user
  // permanently stuck on this screen over a transient network blip.
  const acknowledge = useCallback(async () => {
    if (!removalNotice) return;
    try {
      await voyageRepository.acknowledgeRemoval(removalNotice.voyageId);
    } catch {
      // Swallowed on purpose -- see the fail-open rationale above.
    } finally {
      setRemovalNotice(null);
    }
  }, [removalNotice]);

  return (
    <RemovalNoticeContext.Provider value={{ removalNotice, isLoading, hasError, acknowledge }}>
      {children}
    </RemovalNoticeContext.Provider>
  );
}

export function useRemovalNotice(): RemovalNoticeContextValue {
  const context = useContext(RemovalNoticeContext);
  if (!context) {
    throw new Error('useRemovalNotice must be used within a RemovalNoticeProvider');
  }
  return context;
}

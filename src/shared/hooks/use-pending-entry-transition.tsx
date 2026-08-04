import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';

type PendingEntryTransitionContextValue = {
  hasPendingEntryTransition: boolean;
  triggerEntryTransition: () => void;
  consumeEntryTransition: () => void;
};

const PendingEntryTransitionContext = createContext<PendingEntryTransitionContextValue | undefined>(undefined);

// Deliberately in-memory only, not persisted -- same reasoning as
// PendingJoinProvider/JustStartedVoyageProvider's own comments: this flag
// only needs to survive from a Continue tap to active-voyage.tsx's own next
// mount, both within the same app session.
//
// Story 4.3: a separate flag from useJustStartedVoyage on purpose, even
// though both are set/cleared around the same "Continue" taps -- that one
// gates join-code.tsx's own Stack.Protected visibility and is *cleared* by
// the moment of arrival (clearing it is what triggers the eviction-redirect
// onto active-voyage.tsx), so it can't also double as "was this a fresh
// arrival" for active-voyage.tsx to read on its own mount -- by the time it
// mounts, that flag already reads false. This flag is *set* at the same
// moment instead, and consumed (read once, then cleared) by active-voyage.tsx
// itself once the "cut to gameplay" transition has been shown, so it doesn't
// replay on a later remount within the same session.
export function PendingEntryTransitionProvider({ children }: { children: ReactNode }) {
  const [hasPendingEntryTransition, setHasPendingEntryTransition] = useState(false);

  // Stable identities -- same reasoning as JustStartedVoyageProvider's own
  // comment (a confirmed, real bug fix): consumers elsewhere in the app may
  // hold these in effect dependency arrays, where an unmemoized identity
  // would cause spurious cleanup/re-run churn on every provider render.
  const triggerEntryTransition = useCallback(() => setHasPendingEntryTransition(true), []);
  const consumeEntryTransition = useCallback(() => setHasPendingEntryTransition(false), []);
  const value = useMemo(
    () => ({ hasPendingEntryTransition, triggerEntryTransition, consumeEntryTransition }),
    [hasPendingEntryTransition, triggerEntryTransition, consumeEntryTransition],
  );

  return <PendingEntryTransitionContext.Provider value={value}>{children}</PendingEntryTransitionContext.Provider>;
}

export function usePendingEntryTransition(): PendingEntryTransitionContextValue {
  const context = useContext(PendingEntryTransitionContext);
  if (!context) {
    throw new Error('usePendingEntryTransition must be used within a PendingEntryTransitionProvider');
  }
  return context;
}

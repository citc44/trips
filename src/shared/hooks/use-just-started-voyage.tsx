import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';

type JustStartedVoyageContextValue = {
  hasJustStartedVoyage: boolean;
  markVoyageStarted: () => void;
  clearJustStartedVoyage: () => void;
};

const JustStartedVoyageContext = createContext<JustStartedVoyageContextValue | undefined>(undefined);

// Deliberately in-memory only, not persisted -- same reasoning as
// PendingJoinProvider's own comment: if the app is killed between starting a
// Voyage and tapping Continue on join-code, activeVoyage is already real by
// then (destination-picker.tsx's handleStartVoyage already refetched it
// before navigating here), so a relaunch correctly lands straight on
// active-voyage.tsx per _layout.tsx's own "Cold open, authenticated, active
// Voyage" case -- losing this in-memory flag on a kill is the *correct*
// behavior, not a gap (there's no join-code screen to return to, and no
// cut-to-gameplay flash to fire, on a cold relaunch).
//
// Story 4.3: closes a real navigation gap -- join-code.tsx's Continue button
// used to call router.back(), landing back on the still-mounted
// destination-picker.tsx screen instead of Live Map, since neither screen is
// Stack.Protected-guarded (unlike voyage-joined.tsx's own working
// equivalent, which IS Stack.Protected on hasPendingJoin). Wrapping
// join-code.tsx in a Stack.Protected guard keyed on this flag gives it the
// same automatic eviction-redirect Expo Router already provides
// voyage-joined.tsx: once the flag clears, the router lands on whichever
// screen's own guard is now true (active-voyage.tsx, or location-permission
// first if that's still outstanding) -- the same resolution mechanism
// voyage-joined.tsx already relies on, not a hardcoded destination.
export function JustStartedVoyageProvider({ children }: { children: ReactNode }) {
  const [hasJustStartedVoyage, setHasJustStartedVoyage] = useState(false);

  // Code review finding, confirmed as the root cause of a real user-reported
  // bug: unmemoized, these are new function identities on every provider
  // render. join-code.tsx's own unmount-cleanup effect depends on
  // `[clearJustStartedVoyage]`, so a changed identity makes React run that
  // effect's cleanup (which itself calls clearJustStartedVoyage() again) as
  // a side effect of the *first* call already made from the Continue
  // button's own onPress -- two overlapping state updates firing back to
  // back, right as _layout.tsx's guard is trying to re-evaluate and admit
  // active-voyage.tsx, instead of one clean update. Stable identities here
  // remove that whole class of extra churn.
  const markVoyageStarted = useCallback(() => setHasJustStartedVoyage(true), []);
  const clearJustStartedVoyage = useCallback(() => setHasJustStartedVoyage(false), []);
  const value = useMemo(
    () => ({ hasJustStartedVoyage, markVoyageStarted, clearJustStartedVoyage }),
    [hasJustStartedVoyage, markVoyageStarted, clearJustStartedVoyage],
  );

  return <JustStartedVoyageContext.Provider value={value}>{children}</JustStartedVoyageContext.Provider>;
}

export function useJustStartedVoyage(): JustStartedVoyageContextValue {
  const context = useContext(JustStartedVoyageContext);
  if (!context) {
    throw new Error('useJustStartedVoyage must be used within a JustStartedVoyageProvider');
  }
  return context;
}

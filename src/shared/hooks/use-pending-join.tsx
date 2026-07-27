import { createContext, useContext, useState, type ReactNode } from 'react';

type PendingJoinContextValue = {
  pendingJoinCode: string | null;
  setPendingJoinCode: (code: string) => void;
  clearPendingJoinCode: () => void;
};

const PendingJoinContext = createContext<PendingJoinContextValue | undefined>(undefined);

// Deliberately in-memory only, not persisted (no AsyncStorage): if the app is
// killed mid-flow (between tapping Join and finishing OTP), the pending join
// is simply lost and the user re-opens the same link -- deep links are
// idempotent and re-tappable, a reasonable v1 scope cut (Story 2.3 Dev Notes).
export function PendingJoinProvider({ children }: { children: ReactNode }) {
  const [pendingJoinCode, setPendingJoinCodeState] = useState<string | null>(null);

  const setPendingJoinCode = (code: string) => setPendingJoinCodeState(code);
  const clearPendingJoinCode = () => setPendingJoinCodeState(null);

  return (
    <PendingJoinContext.Provider value={{ pendingJoinCode, setPendingJoinCode, clearPendingJoinCode }}>
      {children}
    </PendingJoinContext.Provider>
  );
}

export function usePendingJoin(): PendingJoinContextValue {
  const context = useContext(PendingJoinContext);
  if (!context) {
    throw new Error('usePendingJoin must be used within a PendingJoinProvider');
  }
  return context;
}

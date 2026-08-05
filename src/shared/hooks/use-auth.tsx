import type { AuthError, Session } from '@supabase/supabase-js';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

import { supabase } from '@/lib/supabase';
import { voyageRepository } from '@/repositories/voyage-repository';
import type { RepositoryError } from '@/repositories/types';

type AuthContextValue = {
  session: Session | null;
  isLoading: boolean;
  signInWithEmail: (email: string) => Promise<{ error: AuthError | null }>;
  verifyCode: (email: string, token: string) => Promise<{ error: AuthError | null }>;
  signOut: () => Promise<{ error: AuthError | RepositoryError | null; didLeaveActiveVoyage: boolean }>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);
const SIGN_OUT_ERROR: RepositoryError = { code: 'unknown', message: 'Something went wrong signing you out. Please try again.' };

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    supabase.auth
      .getSession()
      .then(({ data }) => {
        if (!isMounted) return;
        setSession(data.session);
        setIsLoading(false);
      })
      .catch(() => {
        if (!isMounted) return;
        // Fail open to signed-out rather than leaving isLoading stuck true forever.
        setSession(null);
        setIsLoading(false);
      });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const signInWithEmail = async (email: string) => {
    const { error } = await supabase.auth.signInWithOtp({ email });
    return { error };
  };

  const verifyCode = async (email: string, token: string) => {
    const { error } = await supabase.auth.verifyOtp({ email, token, type: 'email' });
    return { error };
  };

  const signOut = async () => {
    // Membership cleanup must happen while this client still has an access
    // token. If it cannot be confirmed, keep the user signed in so Retry can
    // complete the departure instead of leaving an unreachable active row.
    if (session) {
      try {
        const { error: leaveError } = await voyageRepository.leaveActiveVoyage();
        if (leaveError) {
          return { error: leaveError, didLeaveActiveVoyage: false };
        }
      } catch {
        return { error: SIGN_OUT_ERROR, didLeaveActiveVoyage: false };
      }
    }

    // AD-4: explicit 'global' scope revokes refresh tokens on every device.
    try {
      const { error } = await supabase.auth.signOut({ scope: 'global' });
      // Membership cleanup is already committed even if Auth sign-out itself
      // fails. Expose that phase to Settings so it can clear stale map state
      // without asking the non-idempotent Leave action to run again.
      return { error, didLeaveActiveVoyage: !!session };
    } catch {
      return { error: SIGN_OUT_ERROR, didLeaveActiveVoyage: !!session };
    }
  };

  return (
    <AuthContext.Provider value={{ session, isLoading, signInWithEmail, verifyCode, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

import * as Location from 'expo-location';
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';

import { useAuth } from '@/shared/hooks/use-auth';

export type LocationPermissionStatus = 'undetermined' | 'granted' | 'denied';

type LocationPermissionContextValue = {
  status: LocationPermissionStatus;
  isLoading: boolean;
  hasError: boolean;
  refetch: () => Promise<void>;
  // Plain in-memory flag, deliberately not persisted anywhere (not `profiles`,
  // not AsyncStorage) -- exists only so location-permission.tsx's own
  // permission-request calls (which change `status` mid-flow) can't
  // prematurely flip _layout.tsx's guard away from itself before the flow
  // (foreground -> background -> optional explainer) actually finishes.
  hasCompletedPriming: boolean;
  markPrimingComplete: () => void;
};

const LocationPermissionContext = createContext<LocationPermissionContextValue | undefined>(undefined);

function toStatus(status: Location.PermissionStatus): LocationPermissionStatus {
  if (status === Location.PermissionStatus.GRANTED) return 'granted';
  if (status === Location.PermissionStatus.DENIED) return 'denied';
  return 'undetermined';
}

// Unlike use-active-voyage.tsx/use-removal-notice.tsx, this fetches live,
// OS-owned device state via expo-location directly -- never a repository/
// Supabase call. The OS itself already remembers the user's decision across
// app sessions (EXPERIENCE.md's "fires once per device"), so there is no
// server-side data to keep in sync and no need to duplicate this state
// anywhere else.
export function LocationPermissionProvider({ children }: { children: ReactNode }) {
  const { session } = useAuth();
  const [status, setStatus] = useState<LocationPermissionStatus>('undetermined');
  const [hasError, setHasError] = useState(false);
  const [resolvedForUserId, setResolvedForUserId] = useState<string | null | undefined>(undefined);
  const [hasCompletedPriming, setHasCompletedPriming] = useState(false);
  const userId = session?.user.id ?? null;
  const isLoading = resolvedForUserId !== userId;

  useEffect(() => {
    let isMounted = true;

    if (!userId) {
      Promise.resolve().then(() => {
        if (!isMounted) return;
        setStatus('undetermined');
        setHasError(false);
        setResolvedForUserId(null);
      });
      return () => {
        isMounted = false;
      };
    }

    Location.getForegroundPermissionsAsync()
      .then((response) => {
        if (!isMounted) return;
        setStatus(toStatus(response.status));
        setHasError(false);
        setResolvedForUserId(userId);
      })
      .catch(() => {
        if (!isMounted) return;
        setHasError(true);
        setResolvedForUserId(userId);
      });

    return () => {
      isMounted = false;
    };
  }, [userId]);

  // Lets location-permission.tsx re-pull the live status after it makes its
  // own request calls, same "refetch on demand" shape use-active-voyage.tsx
  // established. A no-op with no session, matching that same precedent.
  const refetch = useCallback(async () => {
    if (!userId) return;
    try {
      const response = await Location.getForegroundPermissionsAsync();
      setStatus(toStatus(response.status));
      setHasError(false);
    } catch {
      setHasError(true);
    }
  }, [userId]);

  const markPrimingComplete = useCallback(() => {
    setHasCompletedPriming(true);
  }, []);

  return (
    <LocationPermissionContext.Provider value={{ status, isLoading, hasError, refetch, hasCompletedPriming, markPrimingComplete }}>
      {children}
    </LocationPermissionContext.Provider>
  );
}

export function useLocationPermission(): LocationPermissionContextValue {
  const context = useContext(LocationPermissionContext);
  if (!context) {
    throw new Error('useLocationPermission must be used within a LocationPermissionProvider');
  }
  return context;
}

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { voyageRepository } from '@/repositories/voyage-repository';
import { IgnitionButton } from '@/shared/components/ignition-button';
import { useActiveVoyage } from '@/shared/hooks/use-active-voyage';
import { usePendingEntryTransition } from '@/shared/hooks/use-pending-entry-transition';
import { usePendingJoin } from '@/shared/hooks/use-pending-join';
import { screenStyles } from '@/shared/styles/screen';

const GENERIC_ERROR = 'Something went wrong. Please try again.';
const ACTIVE_VOYAGE_SYNC_ERROR = "You joined, but we couldn't open the live map. Please try again.";
const DETERMINISTIC_JOIN_REJECTION_CODES = new Set(['22023', '28000', 'JOIN1', 'JOIN2', 'JOIN3']);

function isDeterministicJoinRejection(code: string): boolean {
  // These are validation/auth/rejection branches that the join_voyage RPC
  // raises before changing either the target or the prior membership. Every
  // other failure is treated conservatively: a lost response can mean the
  // transaction committed even though the client never received its result.
  return DETERMINISTIC_JOIN_REJECTION_CODES.has(code);
}

// The single join resolver for both invite links and manually-entered codes.
// This is intentionally loading/error-only: after the server confirms the
// join and ActiveVoyageProvider confirms the same Voyage id, clearing the
// pending code lets _layout.tsx explicitly replace this route with Live Map
// (or location priming first). There is no post-join Continue step to race the
// active-Voyage refresh.
export default function VoyageJoinedScreen() {
  const { pendingJoinCode, clearPendingJoinCode } = usePendingJoin();
  const { triggerEntryTransition } = usePendingEntryTransition();
  const { refetch: refetchActiveVoyage } = useActiveVoyage();
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [canCancel, setCanCancel] = useState(false);
  const startedFor = useRef<string | null>(null);
  const requestId = useRef(0);
  const latestPendingJoinCode = useRef(pendingJoinCode);
  const joinQueue = useRef<Promise<void>>(Promise.resolve());
  const isMounted = useRef(true);

  // Invalidate an older response as soon as a new pending code is committed,
  // before passive effects have a chance to enqueue its replacement. This
  // prevents an old successful request from clearing a newer pending code.
  useLayoutEffect(() => {
    latestPendingJoinCode.current = pendingJoinCode;
  }, [pendingJoinCode]);

  useEffect(() => {
    return () => {
      isMounted.current = false;
    };
  }, []);

  const attemptJoin = useCallback(
    (joinCode: string) => {
      startedFor.current = joinCode;
      const thisRequestId = ++requestId.current;
      setIsLoading(true);
      setError(null);
      setCanCancel(false);

      const isCurrentAttempt = () =>
        isMounted.current && requestId.current === thisRequestId && latestPendingJoinCode.current === joinCode;

      const runAttempt = async () => {
        // Only one join RPC may be in flight from this resolver. If several
        // invite links arrive while one is running, obsolete queued attempts
        // are skipped and the newest code runs after the in-flight call. The
        // server therefore always sees the user's final choice last.
        if (!isCurrentAttempt()) return;

        try {
          const { data, error: joinError } = await voyageRepository.joinVoyage(joinCode);
          if (!isCurrentAttempt()) return;
          if (joinError || !data) {
            setError(joinError?.message ?? GENERIC_ERROR);
            setCanCancel(!!joinError && isDeterministicJoinRejection(joinError.code));
            setIsLoading(false);
            return;
          }

          // Do not clear the pending code merely because the write succeeded.
          // Routing reads ActiveVoyageProvider, so first prove that its refresh
          // sees this exact Voyage. A retry is safe because join_voyage is
          // idempotent for an already-current membership.
          const refreshed = await refetchActiveVoyage();
          if (!isCurrentAttempt()) return;
          if (refreshed.error || refreshed.data?.voyage.id !== data.id) {
            setError(refreshed.error?.message ?? ACTIVE_VOYAGE_SYNC_ERROR);
            // The membership write definitely committed. Keep the pending
            // intent until an idempotent retry reconciles provider state.
            setCanCancel(false);
            setIsLoading(false);
            return;
          }

          triggerEntryTransition();
          clearPendingJoinCode();
        } catch {
          if (!isCurrentAttempt()) return;
          // A transport exception is ambiguous: the server might have
          // committed before the response was lost. Retrying is the only safe
          // recovery because clearing the intent could reveal stale state.
          setError(GENERIC_ERROR);
          setCanCancel(false);
          setIsLoading(false);
        }
      };

      joinQueue.current = joinQueue.current.then(runAttempt, runAttempt);
    },
    [clearPendingJoinCode, refetchActiveVoyage, triggerEntryTransition],
  );

  useEffect(() => {
    if (!pendingJoinCode || startedFor.current === pendingJoinCode) return;
    void attemptJoin(pendingJoinCode);
  }, [attemptJoin, pendingJoinCode]);

  if (!pendingJoinCode) {
    // _layout owns the pending-code transition and explicit destination.
    // Rendering a second Redirect here would race that root-level replace.
    return null;
  }

  function handleRetry() {
    if (!pendingJoinCode || isLoading) return;
    void attemptJoin(pendingJoinCode);
  }

  function handleCancel() {
    requestId.current += 1;
    clearPendingJoinCode();
  }

  return (
    <View style={screenStyles.container}>
      <SafeAreaView style={screenStyles.safeArea}>
        {isLoading ? (
          <Text testID="voyage-joined-loading" style={screenStyles.headline}>
            Joining your Voyage…
          </Text>
        ) : (
          <>
            <Text style={screenStyles.headline}>Couldn&apos;t join this trip.</Text>
            <Text testID="voyage-joined-error" style={screenStyles.error}>
              {error}
            </Text>
            <IgnitionButton
              testID="voyage-joined-retry-button"
              label="Try again"
              disabled={false}
              onPress={handleRetry}
            />
            {canCancel ? (
              <IgnitionButton
                testID="voyage-joined-cancel-button"
                label="Cancel"
                disabled={false}
                onPress={handleCancel}
                variant="text"
              />
            ) : null}
          </>
        )}
      </SafeAreaView>
    </View>
  );
}

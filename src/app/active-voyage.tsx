import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Colors, Spacing, Typography } from '@/constants/design-tokens';
import { voyageRepository, type VoyageMember } from '@/repositories/voyage-repository';
import { IgnitionButton } from '@/shared/components/ignition-button';
import { Toast } from '@/shared/components/toast';
import { useActiveVoyage } from '@/shared/hooks/use-active-voyage';
import { screenStyles } from '@/shared/styles/screen';

const GENERIC_ERROR = 'Something went wrong. Please try again.';

// Interim placeholder for Live Map (Epic 3) -- see Story 2.4's Dev Notes.
// Minimal: destination, an Organizer-only End Voyage control, and (Story 2.5)
// a Voyager list with a Grant Organizer action per non-organizer row -- no
// map, no Fun Facts, no full 3-row Organizer Action Sheet (Remove Voyager
// doesn't exist yet -- Story 2.6). Only reachable via _layout.tsx's
// `route === 'home' && hasActiveVoyage` guard, so `activeVoyage` should
// always be populated when this renders.
export default function ActiveVoyageScreen() {
  const { activeVoyage, refetch } = useActiveVoyage();
  const [showConfirm, setShowConfirm] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [members, setMembers] = useState<VoyageMember[]>([]);
  const [membersError, setMembersError] = useState<string | null>(null);
  // A Set, not a single scalar: granting Organizer status on one row must not
  // affect another row's in-flight state -- a single grantingUserId let a
  // second row's completion re-enable a still-pending first row's button
  // (code review finding).
  const [grantingUserIds, setGrantingUserIds] = useState<Set<string>>(new Set());
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const isMounted = useRef(true);

  useEffect(() => {
    return () => {
      isMounted.current = false;
    };
  }, []);

  const voyageId = activeVoyage?.voyage.id ?? null;

  const loadMembers = useRef(async (id: string) => {
    const { data, error: fetchError } = await voyageRepository.getVoyageMembers(id);
    if (!isMounted.current) return;
    if (fetchError || !data) {
      setMembersError(fetchError?.message ?? GENERIC_ERROR);
      return;
    }
    setMembers(data);
  });

  useEffect(() => {
    if (!voyageId) return;
    loadMembers.current(voyageId);
  }, [voyageId]);

  if (!activeVoyage) {
    return null;
  }

  const isOrganizer = activeVoyage.role === 'organizer';

  async function handleEndVoyage() {
    setIsSubmitting(true);
    setError(null);

    try {
      const { data, error: endError } = await voyageRepository.endVoyage(activeVoyage!.voyage.id);
      if (endError || !data) {
        setError(endError?.message ?? GENERIC_ERROR);
        setIsSubmitting(false);
        return;
      }
      // Clears activeVoyage before navigating -- voyage-ended.tsx reads its
      // own data from route params, not context, so this ordering doesn't
      // race the navigation (see _layout.tsx's comment on why voyage-ended is
      // registered unconditionally, not inside the active-voyage guard).
      await refetch();
      router.push({
        pathname: '/voyage-ended',
        params: {
          destination: data.destination,
          createdAt: data.createdAt,
          endedAt: data.endedAt ?? '',
          voyagerCount: String(data.voyagerCount),
        },
      });
    } catch {
      setError(GENERIC_ERROR);
      setIsSubmitting(false);
    }
  }

  async function handleGrantOrganizer(member: VoyageMember) {
    setGrantingUserIds((prev) => new Set(prev).add(member.userId));
    setMembersError(null);

    try {
      const { error: grantError } = await voyageRepository.grantOrganizerStatus(activeVoyage!.voyage.id, member.userId);
      if (!isMounted.current) return;
      if (grantError) {
        setMembersError(grantError.message);
        return;
      }
      // Quiet, undramatic confirmation (EXPERIENCE.md: "Deliberately
      // undramatic, in contrast to the 'wow' screens") -- no navigation, no
      // screen change (AC1). Re-fetches (not an optimistic local update) to
      // reflect the new role, matching this project's established caution
      // about trusting optimistic state over the server.
      setToastMessage(`${member.displayName ?? 'They'} is now an Organizer`);
      await loadMembers.current(activeVoyage!.voyage.id);
    } finally {
      if (isMounted.current) {
        setGrantingUserIds((prev) => {
          const next = new Set(prev);
          next.delete(member.userId);
          return next;
        });
      }
    }
  }

  function handleRetryMembers() {
    if (voyageId) {
      setMembersError(null);
      loadMembers.current(voyageId);
    }
  }

  if (showConfirm) {
    return (
      <View style={screenStyles.container}>
        <SafeAreaView style={screenStyles.safeArea}>
          <Text style={styles.eyebrow}>End Voyage</Text>
          <Text style={styles.confirmTitle}>Ready to close out the trip?</Text>
          <Text style={styles.confirmSub}>
            New recording stops right away. Anything already in progress finishes normally and makes it into the story.
          </Text>
          <IgnitionButton testID="confirm-end-voyage-button" label="End Voyage" disabled={isSubmitting} onPress={handleEndVoyage} />
          <IgnitionButton
            testID="keep-going-button"
            label="Keep going"
            disabled={isSubmitting}
            onPress={() => setShowConfirm(false)}
            variant="secondary"
          />
          {error ? (
            <Text testID="end-voyage-error" style={screenStyles.error}>
              {error}
            </Text>
          ) : null}
        </SafeAreaView>
      </View>
    );
  }

  return (
    <View style={screenStyles.container}>
      <SafeAreaView style={screenStyles.safeArea}>
        <Text style={screenStyles.headline}>You&apos;re on your way to {activeVoyage.voyage.destination}.</Text>
        {isOrganizer ? (
          <IgnitionButton
            testID="end-voyage-button"
            label="End Voyage"
            disabled={false}
            onPress={() => setShowConfirm(true)}
            variant="secondary"
          />
        ) : null}

        <View style={styles.memberList}>
          {members.map((member) => (
            <View key={member.userId} style={styles.memberRow}>
              <Text style={styles.memberName}>{member.displayName ?? 'Voyager'}</Text>
              {member.role === 'organizer' ? (
                <Text style={styles.memberRoleLabel}>Organizer</Text>
              ) : isOrganizer ? (
                <IgnitionButton
                  testID={`grant-organizer-button-${member.userId}`}
                  label="Grant Organizer"
                  disabled={grantingUserIds.has(member.userId)}
                  onPress={() => handleGrantOrganizer(member)}
                  variant="secondary"
                />
              ) : null}
            </View>
          ))}
        </View>
        {membersError ? (
          <Text testID="voyager-list-error" style={screenStyles.error}>
            {membersError}
          </Text>
        ) : null}
        {membersError && members.length === 0 ? (
          <IgnitionButton
            testID="voyager-list-retry-button"
            label="Retry"
            disabled={false}
            onPress={handleRetryMembers}
            variant="secondary"
          />
        ) : null}
        {toastMessage ? (
          <Toast testID="grant-organizer-toast" message={toastMessage} onDismiss={() => setToastMessage(null)} />
        ) : null}
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  eyebrow: {
    color: Colors.inkSecondary,
    fontFamily: Typography.label.fontFamily,
    fontSize: Typography.label.fontSize,
    fontWeight: Typography.label.fontWeight,
    lineHeight: Typography.label.lineHeight,
    letterSpacing: Typography.label.letterSpacing,
    textTransform: 'uppercase',
  },
  confirmTitle: {
    marginTop: Spacing['3'],
    color: Colors.inkPrimary,
    fontFamily: Typography.display.fontFamily,
    fontSize: Typography.display.fontSize,
    fontWeight: Typography.display.fontWeight,
    lineHeight: Typography.display.lineHeight,
  },
  confirmSub: {
    marginTop: Spacing['4'],
    color: Colors.inkSecondary,
    fontFamily: Typography.body.fontFamily,
    fontSize: Typography.body.fontSize,
    lineHeight: Typography.body.lineHeight,
  },
  memberList: {
    width: '100%',
    gap: Spacing['3'],
  },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing['3'],
  },
  memberName: {
    color: Colors.inkPrimary,
    fontFamily: Typography.body.fontFamily,
    fontSize: Typography.body.fontSize,
  },
  memberRoleLabel: {
    color: Colors.inkSecondary,
    fontFamily: Typography.label.fontFamily,
    fontSize: Typography.label.fontSize,
    fontWeight: Typography.label.fontWeight,
    letterSpacing: Typography.label.letterSpacing,
    textTransform: 'uppercase',
  },
});

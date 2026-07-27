import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Colors, Spacing, Typography } from '@/constants/design-tokens';
import { voyageRepository } from '@/repositories/voyage-repository';
import { IgnitionButton } from '@/shared/components/ignition-button';
import { useActiveVoyage } from '@/shared/hooks/use-active-voyage';
import { screenStyles } from '@/shared/styles/screen';

const GENERIC_ERROR = 'Something went wrong. Please try again.';

// Interim placeholder for Live Map (Epic 3) -- see Story 2.4's Dev Notes.
// Minimal: destination + an Organizer-only End Voyage control. No map, no
// other Voyagers shown, no Fun Facts, no full 3-row Organizer Action Sheet
// (Grant Organizer/Remove Voyager don't exist yet -- Stories 2.5/2.6). Only
// reachable via _layout.tsx's `route === 'home' && hasActiveVoyage` guard, so
// `activeVoyage` should always be populated when this renders.
export default function ActiveVoyageScreen() {
  const { activeVoyage, refetch } = useActiveVoyage();
  const [showConfirm, setShowConfirm] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
});

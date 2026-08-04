import * as Location from 'expo-location';
import { useEffect, useRef, useState } from 'react';
import { Linking, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Colors, Spacing, Typography } from '@/constants/design-tokens';
import { IgnitionButton } from '@/shared/components/ignition-button';
import { useLocationPermission } from '@/shared/hooks/use-location-permission';
import { screenStyles } from '@/shared/styles/screen';

const GENERIC_ERROR = 'Something went wrong. Please try again.';

type FlowState = 'priming' | 'requesting' | 'explainer';

// Local state machine on one screen, same shape active-voyage.tsx's End
// Voyage confirm-swap already established, not separate routes -- Explainer
// is reached only through Priming's own request flow, never navigated to
// directly. Reached via _layout.tsx's `hasActiveVoyage && needsLocationPermission`
// guard branch; markPrimingComplete() (called from both Explainer actions,
// and directly on a full "Always" grant) is what lets that guard flip away
// from this screen on its own -- no manual navigation here.
export default function LocationPermissionScreen() {
  const { markPrimingComplete, refetch } = useLocationPermission();
  const [flowState, setFlowState] = useState<FlowState>('priming');
  const [error, setError] = useState<string | null>(null);
  const isMounted = useRef(true);

  useEffect(() => {
    return () => {
      isMounted.current = false;
    };
  }, []);

  async function handleAllowLocation() {
    // Double-tap guard: ignore a second press before the disabled state commits.
    if (flowState !== 'priming') return;
    setFlowState('requesting');
    setError(null);

    try {
      const foreground = await Location.requestForegroundPermissionsAsync();
      if (!isMounted.current) return;
      if (foreground.status !== Location.PermissionStatus.GRANTED) {
        // Deliberately no refetch() here -- see the note on the Explainer
        // branch below for why updating `status` before the flow visually
        // reaches Explainer is actively dangerous, not just unnecessary.
        setFlowState('explainer');
        return;
      }

      // Always foreground first, then background -- requesting background
      // without foreground already granted is treated by iOS as a combined
      // request, which isn't what "choosing Always Allow" in the AC describes.
      const background = await Location.requestBackgroundPermissionsAsync();
      if (!isMounted.current) return;

      if (background.status === Location.PermissionStatus.GRANTED) {
        markPrimingComplete();
        refetch();
        return;
      }

      // Deliberately no refetch() here (code review finding): refetch()
      // updates the shared `status` this screen's own _layout.tsx guard
      // reads (`needsLocationPermission`). Calling it here, before
      // markPrimingComplete(), lets `status` resolve out of 'undetermined'
      // while `hasCompletedPriming` is still false -- the guard would then
      // evict this screen (swap to active-voyage.tsx) before Explainer ever
      // renders, for what is the *common* case on Android. refetch() is
      // deferred to the Explainer's own dismiss actions below, where it's
      // safe because markPrimingComplete() already makes the guard's
      // `!hasCompletedPriming` clause false on its own.
      setFlowState('explainer');
    } catch {
      if (!isMounted.current) return;
      setFlowState('priming');
      setError(GENERIC_ERROR);
    }
  }

  function handleOpenSettings() {
    Linking.openSettings();
    // Not a lockout (EXPERIENCE.md): offering Settings never forces it --
    // priming is considered resolved either way. markPrimingComplete() first,
    // refetch() after -- markPrimingComplete() alone already makes the
    // _layout.tsx guard safe, so refetch()'s status update here can't recreate
    // the premature-eviction hazard the Requesting flow above avoids.
    markPrimingComplete();
    refetch();
  }

  function handleContinueAnyway() {
    markPrimingComplete();
    refetch();
  }

  if (flowState === 'explainer') {
    return (
      <View style={screenStyles.container}>
        <SafeAreaView style={screenStyles.safeArea}>
          <Text style={styles.headline}>This is how everyone sees you.</Text>
          <Text style={styles.supporting}>
            Voylo needs Always-allow location access to keep showing you on the map, even when your phone locks. You can turn this on
            any time in Settings.
          </Text>
          <IgnitionButton
            testID="location-permission-open-settings-button"
            label="Open Settings"
            disabled={false}
            onPress={handleOpenSettings}
          />
          {/* Story 4.4: "secondary" now means a bordered pill (see
              ignition-button.tsx) -- this screen isn't in that story's
              re-skin scope and stays Night-Drive-styled, so "text"
              preserves this control's current plain-text-link appearance. */}
          <IgnitionButton
            testID="location-permission-continue-anyway-button"
            label="Continue anyway"
            disabled={false}
            onPress={handleContinueAnyway}
            variant="text"
          />
        </SafeAreaView>
      </View>
    );
  }

  return (
    <View style={screenStyles.container}>
      <SafeAreaView style={screenStyles.safeArea}>
        <Text style={styles.headline}>One more thing.</Text>
        <Text style={styles.supporting}>
          Voylo needs your location for as long as the Voyage is active, so your Voyagers can see you on the map. Choose &quot;Always
          Allow&quot; next so it keeps working if your phone locks.
        </Text>
        <IgnitionButton
          testID="location-permission-allow-button"
          label="Allow Location"
          disabled={flowState === 'requesting'}
          onPress={handleAllowLocation}
        />
        {error ? (
          <Text testID="location-permission-error" style={screenStyles.error}>
            {error}
          </Text>
        ) : null}
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  headline: {
    color: Colors.inkPrimary,
    fontFamily: Typography.display.fontFamily,
    fontSize: Typography.display.fontSize,
    fontWeight: Typography.display.fontWeight,
    lineHeight: Typography.display.lineHeight,
    textAlign: 'center',
  },
  supporting: {
    marginTop: Spacing['4'],
    color: Colors.inkSecondary,
    fontFamily: Typography.body.fontFamily,
    fontSize: Typography.body.fontSize,
    lineHeight: Typography.body.lineHeight,
    textAlign: 'center',
  },
});

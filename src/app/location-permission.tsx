import * as Location from 'expo-location';
import { useState } from 'react';
import { Linking, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Colors, Spacing, Typography } from '@/constants/design-tokens';
import { IgnitionButton } from '@/shared/components/ignition-button';
import { useLocationPermission } from '@/shared/hooks/use-location-permission';
import { screenStyles } from '@/shared/styles/screen';

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

  async function handleAllowLocation() {
    setFlowState('requesting');

    const foreground = await Location.requestForegroundPermissionsAsync();
    if (foreground.status !== Location.PermissionStatus.GRANTED) {
      await refetch();
      setFlowState('explainer');
      return;
    }

    // Always foreground first, then background -- requesting background
    // without foreground already granted is treated by iOS as a combined
    // request, which isn't what "choosing Always Allow" in the AC describes.
    const background = await Location.requestBackgroundPermissionsAsync();
    await refetch();

    if (background.status === Location.PermissionStatus.GRANTED) {
      markPrimingComplete();
      return;
    }

    setFlowState('explainer');
  }

  function handleOpenSettings() {
    Linking.openSettings();
    // Not a lockout (EXPERIENCE.md): offering Settings never forces it --
    // priming is considered resolved either way.
    markPrimingComplete();
  }

  function handleContinueAnyway() {
    markPrimingComplete();
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
          <IgnitionButton
            testID="location-permission-continue-anyway-button"
            label="Continue anyway"
            disabled={false}
            onPress={handleContinueAnyway}
            variant="secondary"
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
    fontSize: Typography.body.fontSize,
    lineHeight: Typography.body.lineHeight,
    textAlign: 'center',
  },
});

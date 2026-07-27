import { Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { IgnitionButton } from '@/shared/components/ignition-button';
import { useRemovalNotice } from '@/shared/hooks/use-removal-notice';
import { screenStyles } from '@/shared/styles/screen';

// EXPERIENCE.md's State Patterns, verbatim: "You've left this Voyage." Calm,
// no red, no justification text -- deliberately no destination, no mention
// of who removed them or why. Not a "wow" screen, same restraint
// voyage-ended.tsx already established. Reached only via _layout.tsx's
// `route === 'home' && hasRemovalNotice` guard branch; tapping Continue
// calls acknowledge(), which clears removalNotice and lets the guard react
// on its own (same pattern voyage-joined.tsx's Continue button uses).
export default function VoyageRemovedScreen() {
  const { acknowledge } = useRemovalNotice();

  return (
    <View style={screenStyles.container}>
      <SafeAreaView style={screenStyles.safeArea}>
        <Text style={screenStyles.headline}>You&apos;ve left this Voyage.</Text>
        <IgnitionButton
          testID="voyage-removed-continue-button"
          label="Continue"
          disabled={false}
          onPress={() => acknowledge()}
          variant="secondary"
        />
      </SafeAreaView>
    </View>
  );
}

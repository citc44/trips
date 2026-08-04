import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Spacing, Typography, WayfinderColors } from '@/constants/design-tokens';
import { geocodingRepository, type PlaceSuggestion } from '@/repositories/geocoding-repository';
import { voyageRepository } from '@/repositories/voyage-repository';
import { HorizonStrip } from '@/shared/components/horizon-strip';
import { IgnitionButton } from '@/shared/components/ignition-button';
import { useActiveVoyage } from '@/shared/hooks/use-active-voyage';
import { useJustStartedVoyage } from '@/shared/hooks/use-just-started-voyage';

const GENERIC_ERROR = 'Something went wrong. Please try again.';
const SEARCH_DEBOUNCE_MS = 300;
const MIN_QUERY_LENGTH = 3;

export default function DestinationPickerScreen() {
  const { refetch: refetchActiveVoyage } = useActiveVoyage();
  const { markVoyageStarted } = useJustStartedVoyage();
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState<PlaceSuggestion[]>([]);
  const [selectedPlace, setSelectedPlace] = useState<PlaceSuggestion | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isMounted = useRef(true);
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Guards a stale, slow response from an earlier keystroke overwriting the
  // suggestions for whatever's currently typed -- a plain isMounted check
  // alone isn't enough here since the component stays mounted the whole
  // time, only the in-flight query itself goes stale.
  const searchToken = useRef(0);

  useEffect(() => {
    return () => {
      isMounted.current = false;
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
    };
  }, []);

  // A place is only "selected" while `query` still matches exactly what was
  // picked -- any further edit clears it, so the destination search can't
  // silently submit a place the user has since typed over (code review
  // precedent: the same "edit invalidates the prior pick" rule search UIs
  // like this one are expected to follow).
  useEffect(() => {
    if (selectedPlace && query !== selectedPlace.placeName) {
      setSelectedPlace(null);
    }
  }, [query, selectedPlace]);

  useEffect(() => {
    if (debounceTimer.current) clearTimeout(debounceTimer.current);

    const trimmed = query.trim();
    if (selectedPlace || trimmed.length < MIN_QUERY_LENGTH) {
      setSuggestions([]);
      return;
    }

    const token = ++searchToken.current;
    debounceTimer.current = setTimeout(async () => {
      const { data } = await geocodingRepository.searchDestinations(trimmed);
      if (!isMounted.current || searchToken.current !== token) return;
      setSuggestions(data ?? []);
    }, SEARCH_DEBOUNCE_MS);

    return () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
    };
  }, [query, selectedPlace]);

  function handleSelectSuggestion(suggestion: PlaceSuggestion) {
    setQuery(suggestion.placeName);
    setSelectedPlace(suggestion);
    setSuggestions([]);
  }

  const canSubmit = !!selectedPlace && !isSubmitting;

  async function handleStartVoyage() {
    if (!selectedPlace) return;
    setIsSubmitting(true);
    setError(null);

    try {
      const { data, error: startError } = await voyageRepository.startVoyage(selectedPlace.placeName, {
        lat: selectedPlace.lat,
        lng: selectedPlace.lng,
      });
      if (!isMounted.current) return;
      if (startError || !data || !data.joinCode) {
        setError(startError?.message ?? GENERIC_ERROR);
        return;
      }
      // Without this, ActiveVoyageProvider only re-fetches on a userId change
      // -- the Organizer is still the same user, so activeVoyage would stay
      // stale/null and _layout.tsx's hasActiveVoyage guard would never engage
      // this session, leaving active-voyage.tsx (and its End Voyage control)
      // unreachable until a full app relaunch (code review finding).
      await refetchActiveVoyage();
      // Interim landing (see Story 2.2's Dev Notes): the Join-code card is
      // its own full screen, shown once before Live Map, per EXPERIENCE.md's
      // IA table ("Auto-shown after Destination Picker confirm"). Marking
      // the flag before navigating is what makes join-code.tsx's own
      // Stack.Protected guard (Story 4.3, _layout.tsx) admit this screen at
      // all -- without it the guard stays false and this push would have
      // nowhere to land.
      markVoyageStarted();
      router.push({ pathname: '/join-code', params: { destination: data.destination, joinCode: data.joinCode } });
    } catch {
      if (!isMounted.current) return;
      setError(GENERIC_ERROR);
    } finally {
      if (isMounted.current) setIsSubmitting(false);
    }
  }

  const showSuggestions = suggestions.length > 0 && !selectedPlace;
  const isFilled = query.trim().length > 0;

  return (
    <View style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.content}>
          <View>
            <Text style={styles.headline}>Where are you headed?</Text>

            <View style={styles.fieldWrap}>
              <Text style={styles.fieldLabel}>Destination</Text>
              <TextInput
                testID="destination-input"
                style={[styles.input, isFilled && styles.inputFilled]}
                placeholder="Enter a city or place"
                placeholderTextColor={WayfinderColors.inkDisabled}
                maxLength={200}
                value={query}
                onChangeText={setQuery}
                editable={!isSubmitting}
                autoCorrect={false}
              />
              {showSuggestions ? (
                <View testID="destination-suggestions" style={styles.suggestionList}>
                  {suggestions.map((suggestion) => (
                    <Pressable
                      key={suggestion.id}
                      testID={`destination-suggestion-${suggestion.id}`}
                      onPress={() => handleSelectSuggestion(suggestion)}
                      style={styles.suggestionRow}
                    >
                      <Text style={styles.suggestionText}>{suggestion.placeName}</Text>
                    </Pressable>
                  ))}
                </View>
              ) : null}
            </View>
          </View>

          <View style={styles.ctaWrap}>
            <IgnitionButton
              testID="start-the-voyage-button"
              label="Start the Voyage"
              disabled={!canSubmit}
              onPress={handleStartVoyage}
            />
            <Text style={styles.hint}>
              {selectedPlace
                ? 'This creates the Voyage and starts live tracking.'
                : 'Search and pick a real place -- your Voyagers will see how far they are from it.'}
            </Text>
          </View>

          {error ? (
            <Text testID="error-message" style={styles.error}>
              {error}
            </Text>
          ) : null}
        </View>
        <HorizonStrip />
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: WayfinderColors.surfacePrimary,
  },
  safeArea: {
    flex: 1,
  },
  content: {
    flex: 1,
    justifyContent: 'space-between',
    gap: Spacing['6'],
    paddingHorizontal: Spacing.gutter,
    paddingTop: Spacing['6'],
    paddingBottom: Spacing['5'],
  },
  headline: {
    color: WayfinderColors.inkPrimary,
    fontFamily: Typography.display.fontFamily,
    fontSize: 27,
    fontWeight: '700',
    lineHeight: 35,
    marginBottom: Spacing['5'],
  },
  fieldWrap: {
    gap: Spacing['2'],
  },
  fieldLabel: {
    color: WayfinderColors.inkSecondary,
    fontFamily: Typography.label.fontFamily,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  input: {
    minHeight: 56,
    color: WayfinderColors.inkPrimary,
    fontSize: 17,
    borderWidth: 2,
    borderColor: WayfinderColors.borderHairline,
    borderRadius: 14,
    backgroundColor: WayfinderColors.surfacePrimary,
    paddingHorizontal: Spacing['4'],
  },
  inputFilled: {
    borderColor: WayfinderColors.accentPrimary,
  },
  suggestionList: {
    borderWidth: 2,
    borderColor: WayfinderColors.borderHairline,
    borderRadius: 14,
    backgroundColor: WayfinderColors.surfacePrimary,
    overflow: 'hidden',
  },
  suggestionRow: {
    paddingVertical: Spacing['3'],
    paddingHorizontal: Spacing['4'],
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: WayfinderColors.borderHairline,
  },
  suggestionText: {
    color: WayfinderColors.inkPrimary,
    fontFamily: Typography.body.fontFamily,
    fontSize: Typography.body.fontSize,
  },
  ctaWrap: {
    gap: Spacing['3'],
    alignItems: 'stretch',
  },
  hint: {
    color: WayfinderColors.inkSecondary,
    fontFamily: Typography.body.fontFamily,
    fontSize: 13,
    textAlign: 'center',
  },
  error: {
    color: WayfinderColors.error,
    fontSize: Typography.body.fontSize,
  },
});

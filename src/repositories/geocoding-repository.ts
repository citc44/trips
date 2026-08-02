import type { RepositoryError } from '@/repositories/types';

export type PlaceSuggestion = {
  id: string;
  placeName: string;
  lat: number;
  lng: number;
};

type MapboxFeature = {
  id: string;
  place_name: string;
  center: [number, number];
};

type MapboxGeocodingResponse = {
  features: MapboxFeature[];
};

type SearchDestinationsResult = { data: PlaceSuggestion[] | null; error: RepositoryError | null };

const GEOCODING_BASE_URL = 'https://api.mapbox.com/geocoding/v5/mapbox.places';
const SUGGESTION_LIMIT = 5;

function toPlaceSuggestion(feature: MapboxFeature): PlaceSuggestion {
  const [lng, lat] = feature.center;
  return { id: feature.id, placeName: feature.place_name, lat, lng };
}

// Mapbox's Geocoding API is a plain REST endpoint, not a Supabase RPC -- it
// takes the same public EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN already used to
// render the map itself (see src/lib/mapbox.ts), no separate secret needed.
// Deliberately not throwing when the token is missing (unlike
// initMapbox()'s hard throw) -- a broken destination search shouldn't crash
// the picker screen, it should just degrade to manual free-text entry.
async function searchDestinations(query: string): Promise<SearchDestinationsResult> {
  const trimmed = query.trim();
  if (trimmed.length === 0) {
    return { data: [], error: null };
  }

  const accessToken = process.env.EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN;
  if (!accessToken) {
    return { data: null, error: { code: 'missing_token', message: 'Destination search is unavailable right now.' } };
  }

  const url = `${GEOCODING_BASE_URL}/${encodeURIComponent(trimmed)}.json?access_token=${accessToken}&autocomplete=true&limit=${SUGGESTION_LIMIT}`;

  try {
    const response = await fetch(url);
    if (!response.ok) {
      return { data: null, error: { code: String(response.status), message: 'Destination search is unavailable right now.' } };
    }

    const body = (await response.json()) as MapboxGeocodingResponse;
    return { data: (body.features ?? []).map(toPlaceSuggestion), error: null };
  } catch {
    return { data: null, error: { code: 'unknown', message: 'Destination search is unavailable right now.' } };
  }
}

export const geocodingRepository = {
  searchDestinations,
};

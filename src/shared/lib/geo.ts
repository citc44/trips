const EARTH_RADIUS_MILES = 3958.8;

function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

// Great-circle distance, not driving distance -- a straight-line "how far
// as the crow flies" figure is enough for "how far is everyone from the
// destination," and doesn't need a routing API call per Voyager per update.
export function haversineMiles(from: { lat: number; lng: number }, to: { lat: number; lng: number }): number {
  const dLat = toRadians(to.lat - from.lat);
  const dLng = toRadians(to.lng - from.lng);
  const lat1 = toRadians(from.lat);
  const lat2 = toRadians(to.lat);

  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return EARTH_RADIUS_MILES * c;
}

// Sub-tenth-mile precision reads as false accuracy for a live, constantly-
// moving figure -- "0.0 mi" the instant you arrive is more honest than
// "0.04 mi" implying GPS precision this feature was never meant to promise.
export function formatDistanceMiles(miles: number): string {
  if (miles < 0.1) return 'At destination';
  if (miles < 10) return `${miles.toFixed(1)} mi`;
  return `${Math.round(miles)} mi`;
}

import Mapbox from '@rnmapbox/maps';

// Unlike supabase.ts's hard, app-wide throw (the whole app is unusable
// without Supabase) or sentry.ts's silent warn-and-skip (losing error
// reporting shouldn't break anything), a missing Mapbox token only matters to
// the one screen that actually renders a map -- so this throws loudly, but is
// only ever called from that screen's own module, not from the root layout,
// keeping the blast radius scoped to Live Map instead of crashing the whole
// app for every user on cold start.
export function initMapbox() {
  const accessToken = process.env.EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN;

  if (!accessToken) {
    throw new Error('Missing EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN — check the EAS environment variables for this build profile.');
  }

  Mapbox.setAccessToken(accessToken);
}

import { createClient } from 'npm:@supabase/supabase-js@^2';

type TracePoint = { lat: number; lng: number; capturedAt: string; speedMps: number | null; accuracyM: number | null };
type StopRow = {
  id: string; voyage_id: string; actor_user_id: string; started_at: string; ended_at: string;
  centroid_lat: number; centroid_lng: number; trace: TracePoint[];
};

const json = (status: number, body: unknown) => new Response(JSON.stringify(body), {
  status, headers: { 'Content-Type': 'application/json' },
});
const clamp = (value: number) => Math.max(0, Math.min(1, value));
const categoryMap: Record<string, string> = {
  gas_station: 'fuel', fuel: 'fuel', coffee_shop: 'coffee', cafe: 'coffee', restaurant: 'food',
  fast_food: 'food', rest_area: 'rest_area', service_area: 'service_plaza', hotel: 'lodging',
  motel: 'lodging', shopping_mall: 'shopping', viewpoint: 'scenic', attraction: 'attraction',
};

function distanceM(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const r = 6_371_000;
  const p1 = a.lat * Math.PI / 180;
  const p2 = b.lat * Math.PI / 180;
  const dp = (b.lat - a.lat) * Math.PI / 180;
  const dl = (b.lng - a.lng) * Math.PI / 180;
  const h = Math.sin(dp / 2) ** 2 + Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) ** 2;
  return 2 * r * Math.asin(Math.sqrt(h));
}

function normalizeCategory(properties: Record<string, unknown>): string {
  const values = [properties.poi_category_ids, properties.poi_category, properties.category]
    .flatMap((value) => Array.isArray(value) ? value : typeof value === 'string' ? value.split(',') : [])
    .map((value) => String(value).toLowerCase().replaceAll(' ', '_'));
  for (const value of values) if (categoryMap[value]) return categoryMap[value];
  return 'unknown';
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json(405, { error: 'Method not allowed' });
  const auth = req.headers.get('Authorization');
  if (!auth) return json(401, { error: 'Authentication required' });

  const url = Deno.env.get('SUPABASE_URL') ?? '';
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  const mapboxToken = Deno.env.get('MAPBOX_ACCESS_TOKEN') ?? '';
  if (!url || !anonKey || !serviceKey) return json(503, { error: 'Service is not configured' });

  const caller = createClient(url, anonKey, { global: { headers: { Authorization: auth } } });
  const { data: userData } = await caller.auth.getUser();
  if (!userData.user) return json(401, { error: 'Invalid session' });

  let stopId = '';
  try { stopId = String((await req.json()).stopId ?? ''); } catch { return json(400, { error: 'Invalid JSON' }); }
  if (!/^[0-9a-f-]{36}$/i.test(stopId)) return json(400, { error: 'Invalid stop id' });

  const admin = createClient(url, serviceKey);
  const { data, error } = await admin.from('stop_events').select('*').eq('id', stopId).single();
  const stop = data as StopRow | null;
  if (error || !stop) return json(404, { error: 'Stop not found' });
  if (stop.actor_user_id !== userData.user.id) return json(403, { error: 'Stop ownership required' });

  if (!mapboxToken) {
    await admin.from('stop_events').update({ status: 'suppressed', trace: [], evidence: { providerUnavailable: true }, updated_at: new Date().toISOString() }).eq('id', stop.id);
    return json(202, { status: 'suppressed', reason: 'provider_unavailable' });
  }

  const points = stop.trace.filter((point) => Number.isFinite(point.lat) && Number.isFinite(point.lng)).slice(-80);
  const coordinates = points.map((point) => `${point.lng},${point.lat}`).join(';');
  const searchUrl = `https://api.mapbox.com/search/searchbox/v1/reverse?longitude=${stop.centroid_lng}&latitude=${stop.centroid_lat}&limit=5&access_token=${encodeURIComponent(mapboxToken)}`;
  const matchUrl = points.length >= 2
    ? `https://api.mapbox.com/matching/v5/mapbox/driving/${coordinates}?geometries=geojson&overview=false&access_token=${encodeURIComponent(mapboxToken)}`
    : null;

  try {
    const [searchResponse, matchResponse] = await Promise.all([
      fetch(searchUrl), matchUrl ? fetch(matchUrl) : Promise.resolve(null),
    ]);
    if (!searchResponse.ok) throw new Error(`Mapbox Search ${searchResponse.status}`);
    const search = await searchResponse.json();
    const matched = matchResponse?.ok ? await matchResponse.json() : null;
    const roadConfidence = clamp(Number(matched?.matchings?.[0]?.confidence ?? 0));
    const roadPoints = (matched?.tracepoints ?? []).filter(Boolean);
    const roadDistance = roadPoints.length
      ? Math.min(...roadPoints.map((point: { location: [number, number] }) => distanceM(
          { lat: stop.centroid_lat, lng: stop.centroid_lng }, { lat: point.location[1], lng: point.location[0] },
        ))) : null;
    const creepCount = points.filter((point) => (point.speedMps ?? 99) > 0.5 && (point.speedMps ?? 99) <= 4).length;
    const creeping = points.length ? creepCount / points.length : 0;

    const candidates = (search.features ?? []).map((feature: Record<string, any>) => {
      const coords = feature.geometry?.coordinates ?? [stop.centroid_lng, stop.centroid_lat];
      const properties = feature.properties ?? {};
      return {
        provider: 'mapbox', providerPlaceId: properties.mapbox_id ?? feature.id,
        name: properties.name ?? properties.full_address ?? 'Unknown place',
        primaryCategory: normalizeCategory(properties), secondaryCategories: [],
        distanceM: distanceM({ lat: stop.centroid_lat, lng: stop.centroid_lng }, { lat: coords[1], lng: coords[0] }),
        providerConfidence: 0.75, containment: 0.5, dwellCompatibility: 0.7,
      };
    }).sort((a: { distanceM: number }, b: { distanceM: number }) => a.distanceM - b.distanceM);

    const best = candidates[0] ?? null;
    const placeScore = best ? clamp((1 - best.distanceM / 150) * 0.35 + 0.65 * best.providerConfidence) : 0;
    const parkingDeviation = clamp((roadDistance ?? 0) / 60);
    const trafficScore = clamp(roadConfidence * 0.45 + creeping * 0.35 - parkingDeviation * 0.25 - placeScore * 0.1);
    const venueScore = clamp(parkingDeviation * 0.4 + placeScore * 0.45 - trafficScore * 0.25);
    const confidence = clamp(venueScore * 0.55 + placeScore * 0.45);
    const kind = trafficScore >= 0.72 && trafficScore > venueScore + 0.12 ? 'traffic' : venueScore >= 0.5 ? 'venue_stop' : 'unknown';
    const visibility = kind === 'traffic' || kind === 'unknown' ? 'suppressed' : confidence >= 0.9 ? 'exact' : confidence >= 0.75 ? 'category' : 'generic';
    const classification = {
      kind, primaryCategory: kind === 'traffic' ? 'traffic' : best?.primaryCategory ?? 'unknown',
      secondaryCategories: [], confidence, visibility,
    };
    const evidence = {
      roadMatchConfidence: roadConfidence, distanceFromRoadM: roadDistance,
      creepingPattern: creeping, candidateCount: candidates.length,
      scores: { traffic: trafficScore, venue: venueScore, place: placeScore },
      classifierVersion: 'stop-v1-shadow',
    };
    const mode = Deno.env.get('STOP_INTELLIGENCE_MODE') ?? 'shadow';
    const { error: updateError } = await admin.from('stop_events').update({
      status: visibility === 'suppressed' ? 'suppressed' : 'completed', classification,
      place: visibility === 'exact' ? best : null, evidence, trace: [], updated_at: new Date().toISOString(),
    }).eq('id', stop.id);
    if (updateError) throw updateError;

    // Shadow is intentionally the only enabled mode in this first migration.
    // Publishing requires a later calibrated server migration, not a client flag.
    return json(200, { status: 'classified', mode, classification });
  } catch (error) {
    await admin.from('stop_events').update({ status: 'suppressed', trace: [], evidence: { providerError: true }, updated_at: new Date().toISOString() }).eq('id', stop.id);
    console.error('Stop classification failed', error instanceof Error ? error.message : 'unknown');
    return json(202, { status: 'suppressed', reason: 'provider_error' });
  }
});

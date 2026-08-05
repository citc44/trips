# Performance Analysis: Navigation-Grade Location Tracking

**Date:** 2026-08-04
**Scope:** The location-tracking rewrite that shipped alongside the critical "Voyagers never move" fix — `use-location-tracking.tsx`'s new 1s/3m/`BestForNavigation` cadence, `upsert_location()`'s atomic server-side broadcast, and the new `useSmoothedLocation` marker-interpolation hook.
**Why this exists:** Requested as a standing document to revisit as real usage data comes in, not a one-time verdict. Update the "Status" line per finding as it gets measured/tuned, rather than filing a new report.

## TL;DR

The correctness fixes in this change (server-side atomic broadcast, roster live-refresh, self-healing reconnect) are unambiguously good and should stay exactly as they are. The **tracking cadence** (`Accuracy.BestForNavigation`, 1s / 3m, `pausesUpdatesAutomatically: false`, zero-deferred delivery) is the one piece worth pausing on: it's the most battery-aggressive configuration `expo-location` offers, and it trades directly against a counter-metric the PRD names explicitly:

> **SM-C1**: Battery drain per hour of active tracking — must not be sacrificed to make the live map feel more "real-time" via higher-frequency location pings. (PRD §8, Counter-metrics)
> **Cross-cutting NFR**: "Live map location updates must feel real-time without materially degrading device battery life over a multi-hour drive — this is the single most-cited failure mode of the category leader (Life360)." (PRD §5.5)

This isn't a bug — it's a real design tradeoff that was made (probably to make marker movement look smooth) without the battery side being measured yet. Recommend treating it as **not-yet-verified, not yet "shipped and done."**

## What actually changed

| | Before (5s throttle era) | After (navigation-grade) |
|---|---|---|
| GPS accuracy | `Balanced` | `BestForNavigation` (highest tier — GPS + full sensor fusion, continuous) |
| Time interval | 5000ms | 1000ms |
| Distance filter | 20m | 3m |
| Auto-pause (iOS) | unset → native default `true` (the bug we fixed) | explicitly `false` |
| Deferred/batched delivery | default | `deferredUpdatesDistance: 0`, `deferredUpdatesInterval: 0` (no batching at all) |
| DB write | throttled, ≤1/30s | one attempt per accepted fix, coalesced only while a prior request is still in flight |
| Broadcast | separate best-effort client `channel.send()` (silently failing — the bug) | atomic, inside `upsert_location()`'s own transaction |

The accuracy/interval/pause settings are what drive battery cost. The atomic-broadcast and coalescing pieces are what drive network/server cost. They're separable — the correctness win doesn't require the aggressive cadence.

## Battery — the real concern

**Status: unverified, flagged as the primary open risk.**

- `BestForNavigation` + `pausesUpdatesAutomatically: false` + zero deferred batching is functionally the same configuration a dedicated turn-by-turn app (Google Maps/Waze *while actively navigating*) uses — not what a passive presence-sharing app typically needs. Continuous full-accuracy GPS is one of the most power-hungry things a phone radio/sensor stack can do.
- Voylo's own use case is multi-hour highway drives (the PRD's explicit framing) — exactly the scenario where this cost compounds the most, and exactly the scenario Life360's own most-cited complaint (per the PRD's market research) comes from.
- No numeric battery budget has ever been set (PRD Open Question 1 — "exact refresh interval... needs engineering input" — was never resolved before this cadence was picked).
- **This has not been measured on a real device yet.** Everything above is a reasoned-from-the-API-surface risk, not a benchmark.

**Recommended before this ships broadly:** an actual on-device battery drain measurement (a real multi-hour drive or a simulated GPS route with screen off/backgrounded, comparing % drained/hour against the old 5s/`Balanced` config). If the drain is materially worse, cheapest lever to pull first is dropping accuracy from `BestForNavigation` to `Balanced` or `High` (marker smoothing already covers the "feels jumpy" problem that accuracy was probably compensating for) before touching the interval/distance filter.

## Network — request volume, not bandwidth

**Status: real increase, low individual risk, worth confirming against Supabase plan limits.**

- Each fix is tiny (~100–150 bytes of JSON) — raw bandwidth per trip is still trivial, even at the new cadence. This is not a cellular-data-cost concern.
- **Request *count* is the real change.** Old: throttled to at most 120 upsert calls/hour/Voyager. New: bounded only by GPS-fix rate and RPC round-trip time while actually driving — realistically tens of times higher per active Voyager (every accepted fix now attempts a send, vs. one attempt per 30-second window before).
- Coalescing (only one request in flight at a time, newest-wins) caps *concurrent* load per Voyager, but doesn't reduce *cumulative* request count over a long drive.

## Server load — writes + Realtime fan-out

**Status: real increase, scales with Voyage size, worth confirming against Supabase plan limits.**

- `voyage_member_locations` is an upsert-only table (one row per member) — **no storage growth concern** regardless of update frequency. This part is fine at any cadence.
- Write *volume* (UPDATE statements/hour) scales the same way the network request count does — tens of times more DB writes per active Voyager per hour than the old throttled design.
- Realtime broadcast fan-out is the sharper edge: every accepted fix now triggers `realtime.send()`, delivered to every other connected member of that Voyage. For a Voyage with N active Voyagers all driving, message volume scales roughly with N × (N−1) — an 8-Voyager trip (the app's own 8-color player-palette ceiling) at peak cadence is a meaningfully different load profile than the 2-3 Voyager case this was presumably tested against.
- Worth confirming this stays comfortably inside whatever Supabase plan tier this project is on (message-rate/concurrent-connection limits vary by plan) — not verified as part of this analysis.

## Memory (client)

**Status: negligible, no action needed.**

- The comet-trail buffer (`MapMarker.trailLengthMs = 8000`) is pruned by a fixed *time* window, not a point count — more frequent fixes mean more points held within that same 8-second window (up to ~8 vs. ~2 before), but the bound is still tiny and fixed regardless of cadence. Not a real concern at any Voyage size.

## CPU / render (client)

**Status: real but likely acceptable — worth a device-level sanity check, not a redesign.**

- `useSmoothedLocation` runs one independent `requestAnimationFrame` interpolation loop per rendered marker. With many Voyagers all moving, that's several concurrent rAF loops each doing cheap interpolation math and one `setState` per frame, layered on top of Mapbox's own native per-frame rendering work.
- This is a legitimate, deliberate tradeoff (smoothness in exchange for render/CPU work) rather than a bug, and is probably fine on modern hardware — but hasn't been checked against an 8-Voyager Voyage on a mid-tier/older device, which is the realistic worst case.

## Storage (durable)

**Status: no impact.** Confirmed no growth concern — see "Server load" above; the location table is upsert-only.

## Recommendation

1. Keep the atomic server-side broadcast, roster live-refresh, self-healing reconnect, and marker smoothing exactly as shipped — these are correctness/quality wins independent of the cadence question.
2. Treat the `BestForNavigation` / 1s / 3m / no-pause / no-defer cadence as **not yet validated** rather than final. Get a real battery-drain number before or shortly after this reaches real multi-hour usage.
3. If the drain turns out to be a problem, the cheapest fix is very likely accuracy (`BestForNavigation` → `Balanced`/`High`) before touching interval/distance — `useSmoothedLocation` already absorbs most of the "choppy without high accuracy" concern that navigation-grade accuracy was likely chosen to solve.
4. Confirm the Realtime message-rate headroom for an 8-Voyager Voyage at this cadence against the actual Supabase plan in use.

## Revision log

- 2026-08-04 — Initial analysis, written before any real-device measurement. All "Status" lines above are the open items to close out.

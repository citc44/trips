# Tech Verification Review — Voylo Architecture Spine

**Reviewed:** ARCHITECTURE-SPINE.md (architecture-trips-2026-07-25)
**Date:** 2026-07-25
**Method:** Web search against each named technology in the Stack table and Structural Seed; checked (a) current version/release status, (b) continued existence/maintenance, (c) fitness for a React Native + Expo managed-workflow app with live location, real-time sync, and zero-manual-steps AI-agent buildability.

## Summary verdict

Every technology named in the spine is real, current, and actively maintained — nothing is dead, abandoned, or hallucinated. No wholesale replacement is warranted. There are, however, several **implementation-detail gaps** the spine doesn't surface that an AI build agent could trip on if not flagged now (see "Flagged" below), plus one **terminology nuance** worth tightening (Mapbox SDK v10 vs v11).

## Confirmed current and fitting

| Item | Verified status |
| --- | --- |
| **Expo SDK 56** | Real, current, released 2026-05-21. Ships React Native 0.85 + React 19.2. This is presently the latest SDK line — not a stale or superseded version. Managed workflow remains fully supported and is Expo's flagship path. |
| **EAS Build / Submit / Update** | Hosted, operational (status page shows normal operation; one transient iOS-submission slowdown on 2026-07-14 already resolved). Continues to be Expo's standard build/submit/OTA pipeline — fits the "zero manual infrastructure" requirement directly. |
| **Supabase (Postgres, Auth, Realtime, Storage, Edge Functions)** | Active hosted BaaS with current 2026 pricing published (Free: 500MB DB / 50k MAU / 200 realtime connections; Pro: $25/mo, 500 realtime connections). Realtime's Postgres-changes + broadcast model (AD-2/AD-3) is a supported, documented capability, not a workaround. |
| **`@rnmapbox/maps`** | Actively maintained; latest release (10.3.5) published 2026-07-22, days before this architecture was drafted. Confirmed real Expo config-plugin support (`plugins: [["@rnmapbox/maps", {...}]]`, `RNMapboxMapsVersion`) — this is the standard, current integration path, not deprecated tooling. |
| **Expo Notifications** | Bundled with SDK 56, current. FCM v1 migration (the historical Android push-breakage risk) completed back in 2024 and is long stable — no lingering migration risk. |
| **`expo-location` + `expo-task-manager`** | Both current, bundled with SDK 56, and confirmed to still work in **managed workflow with no bare/eject required** — background permission mode and the `TaskManager`-driven background location task are documented, supported patterns, configured entirely via config-plugin options in `app.json`. |
| **Sentry React Native SDK** | Actively developed; `@sentry/react-native` latest is 8.20.0, published within days of this check. Free tier still exists. |
| **GitHub Actions** | No currency risk — mature, stable, hosted CI, unchanged fitness. |
| **Groq (Deferred section, AI pipeline)** | Verified: genuinely free forever tier (30 RPM / 6K TPM / 14.4K req/day, no credit card), sub-$0.10/M-token paid pricing, LPU-based low-latency inference. The spine's own "verified current" claim holds up. |

## Flagged — not currency problems, but gaps worth closing before build

1. **Expo Go is a dead end for this app; the spine doesn't say so.** Both `@rnmapbox/maps` (custom native code) and `expo-location`/`expo-task-manager` background mode (foreground service on Android, background modes on iOS) **cannot run in Expo Go** — confirmed for both libraries. Since SDK 53, remote push notifications also require a development build, not Expo Go, on Android (and increasingly in practice on iOS too). None of this contradicts "managed workflow" — EAS development-client builds are still managed-workflow, fully config-plugin-driven, and already implied by having EAS Build in the stack — but the spine currently reads as if Expo Go could be part of the dev loop. Recommend an explicit line (e.g., under AD-8 or the Stack table) stating: *local development and testing must use an EAS development build (dev client), not Expo Go*, so no AI build agent wastes a cycle discovering this the hard way.

2. **Mapbox SDK v10 vs v11 terminology.** The upstream **native** Mapbox Maps SDK v10 is deprecated; v11 is current. This does **not** mean the npm package `@rnmapbox/maps` (whose own major version is unrelated/"10.x") is deprecated — current `@rnmapbox/maps` releases (10.2+) already default their `RNMapboxMapsVersion` to target the v11 native SDK. Risk is narrow but real: if a build script or AI agent pins an old `RNMapboxMapsVersion` from an outdated tutorial, it will silently target the deprecated native v10 SDK. Worth a one-line pin note when this gets projected into an actual dependency/config spec.

3. **Android 14/15 foreground-service-type declaration.** AD-8 describes background location via `expo-location` + `expo-task-manager` + Android foreground service, but doesn't mention that Android 14+ (API 34, and this continues on Android 15) requires explicitly declaring the foreground service type (e.g., via the `expo-location` config-plugin option enabling the foreground service, or manifest injection). This is a documented, solvable config-plugin setting — not a blocker — but omitting it is a common cause of background location silently failing on current Android versions. Worth a config-detail note wherever AD-8 gets implemented.

4. **iOS background-location App Store review scrutiny.** Apps requesting `NSLocationAlwaysAndWhenInUseUsageDescription` need a clearly stated, functioning purpose and reviewer notes explaining the background use case, or risk a 5.1.1-style rejection. This is process, not code, and doesn't require the manual Apple Developer Program approval that the spine's Deferred section already calls out for the Time-Sensitive notification entitlement — but it's a similar category of "reviewer-facing" risk worth being aware of alongside that existing flag.

## Not flagged / no action needed

TypeScript ("latest stable") and the general BaaS-centric paradigm carry no currency risk and needed no research beyond confirming the named services above remain live products.

## Sources consulted

- https://expo.dev/changelog/sdk-56
- https://expo.dev/sdk/56
- https://status.expo.dev/
- https://docs.expo.dev/router/migrate/sdk-55-to-56/
- https://rnmapbox.github.io/docs/install
- https://github.com/rnmapbox/maps
- https://www.npmjs.com/package/@rnmapbox/maps?activeTab=versions
- https://docs.mapbox.com/android/maps/guides/migrate-to-v11/
- https://docs.expo.dev/versions/latest/sdk/location/
- https://docs.expo.dev/versions/latest/sdk/task-manager/
- https://github.com/expo/expo/issues/28767 (Android foreground-service manifest requirement)
- https://expo.dev/blog/expo-push-notifications-migrating-to-fcm-v1
- https://docs.expo.dev/push-notifications/faq/
- https://docs.sentry.io/platforms/react-native/releases/
- https://github.com/getsentry/sentry-react-native
- https://uibakery.io/blog/supabase-pricing (2026 pricing snapshot)
- https://tokenmix.ai/blog/groq-free-tier-limits-2026
- https://developer.apple.com/app-store/review/guidelines/

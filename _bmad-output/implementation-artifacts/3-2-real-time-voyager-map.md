---
baseline_commit: ab01ad2333b173234ba99dd74fa118fa96779e27
---

# Story 3.2: Real-Time Voyager Map

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a Voyager,
I want to see all Voyagers' live locations on one shared, stylized map,
so that I always know where everyone in the group is.

## Acceptance Criteria

1. **Given** an active Voyage, **when** I open Live Map, **then** I see a stylized world (glowing light-trail roads, simplified terrain — not a standard street map), each Voyager as a marker (player-color ring, heading chevron, comet-trail, 48px tap region).
2. **And** positions update near-real-time via one Realtime channel per Voyage; the map is visible only to that Voyage's own Voyagers.
3. **And** I can pinch/pan and use one "recenter" control — no manual refresh button anywhere.
4. **And** the marker's live state is never color-only (paired with pulse/chevron), and notifications are audio/haptic-redundant, per the accessibility floor.

*(Fulfills FR-9; UX-DR10, UX-DR21, UX-DR30, UX-DR32; AD-2, AD-1.)*

**🚫 Known interim-scope decisions (not silent gaps — see Dev Notes for full rationale on each):**

- **The custom "glowing light-trail roads, simplified terrain" base-map art direction is a Mapbox Studio style (a hosted content asset), not something producible in code.** This story wires up `@rnmapbox/maps` with Mapbox's stock Dark v11 style as the base map, and puts ALL of the actual visual differentiation ("game-like, not Google Maps") into the parts that genuinely are code: the custom `map-marker` (ring/chevron/trail/pulse), `hud-card`/`status-pill` chrome, and the ambient sky-strip. **A real, art-directed Mapbox Studio style is an explicit follow-up dependency, not this story's job** — wiring accepts a style URL via env var with the stock Dark v11 style as a documented fallback.
- ~~A real Mapbox account and access token do not exist yet~~ **Resolved during story creation**: user supplied a real Mapbox account's public access token (`EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN`, written to `.env.local`, gitignored) and secret downloads token (written to `~/.netrc` outside the repo, per Mapbox's own documented convention for `@rnmapbox/maps` native builds — never committed, never placed in `app.json`). **Not yet done**: an EAS secret for the downloads token, needed only when a real EAS *cloud* build is attempted (local builds read `~/.netrc` directly; this environment has no EAS CLI access to set the cloud-side secret — same category of blocker as every prior story's live-verification gap, flag if it comes up during Task 8).
- **Foreground-only location sending.** This story's own AC ("positions update near-real-time") needs *something* actually broadcasting for the map to be testable at all, so this story owns location-watching + broadcasting **while the Live Map screen is mounted and foregrounded** (using `expo-location`'s `watchPositionAsync`, not background tracking). Background-mode sending (app backgrounded/phone locked) is explicitly Story 3.3's job (**"Location Persistence & Background Tracking"**, epics.md's own scoping) — do not build `expo-task-manager`/background task registration here.
- **No Driving/Riding role-switch mechanism.** The `status-pill` renders (per DESIGN.md's component spec) but is hardcoded to the "Riding" visual state for every Voyager — the actual role-switch UI and the "Driving" state's real meaning are Story 3.4's job.
- **No "reconnecting" HUD note, no offline write-outbox.** That's Story 3.5's job (NFR2, UX-DR33, AD-7). This story's Realtime subscription can fail/disconnect silently for now; a bare-minimum "channel not connected" fallback (last-known positions stay rendered, nothing crashes) is all this story needs — not a polished reconnect UX.
- **No Fun Fact count on the marker peek card.** DESIGN.md's own mockup footnote confirms this is a v1.1-only field (`Ships: v1.1`) — the v1 peek card is name + player color + role only.
- **The Organizer Action Sheet reorganization is functional relocation, not a new visual system.** `active-voyage.tsx`'s existing, already-tested End Voyage / Grant Organizer / Remove Voyager sub-flows move behind the HUD's "⋯" entry point (matching the mockup's `hud-top` layout) instead of living inline on a plain list screen — their own internal logic/copy/tests are preserved as-is, not redesigned.

## Tasks / Subtasks

- [x] Task 1: Add `@rnmapbox/maps` and configure the plugin (AC: #1)
  - [x] Ran `npx expo install @rnmapbox/maps` — resolved to v10.3.5 (bundles native SDK 11.23.1, matching AD-8's v11 pin exactly).
  - [x] Config plugin appended to `app.json`'s `expo.plugins` array as a 5th entry (`expo install` auto-added the bare-string form; upgraded it to the `[name, config]` tuple form with `RNMapboxMapsVersion: "11.23.1"` — the exact version the installed package bundles, not guessed). Existing 4 entries untouched.
  - [x] `src/lib/mapbox.ts` added: `initMapbox()` throws loudly if `EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN` is missing (matching `supabase.ts`'s fail-loud discipline), but is scoped to be called from the Live Map screen itself, not the root layout — unlike Supabase (whole app needs it) or Sentry (safe to skip silently), a missing Mapbox token only matters to the one screen that renders a map.
  - [x] `EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN` already added to `.env.local` (real token, gitignored) and `.env.example` (empty placeholder) during story creation — read `src/lib/supabase.ts` first for this project's established "fail loud, not silent" pattern for a missing required env var, and apply the same discipline to wherever the Mapbox token is consumed (e.g. `Mapbox.setAccessToken(...)`), since a future contributor without `.env.local` populated still needs a clear failure, not a silent blank map.
  - [x] Mapbox downloads token already written to `~/.netrc` during story creation (Mapbox's own documented convention for `@rnmapbox/maps` native builds — `machine api.mapbox.com` / `login mapbox` / `password sk...`), confirmed still required for the current native SDK v11 setup (this story's own research flagged this as unconfirmed; resolved by following Mapbox's current official docs directly rather than guessing). **Remaining gap**: this only covers local builds — an EAS *cloud* build additionally needs this same secret registered as an EAS secret (`eas secret:create`), not yet done (no EAS CLI access in this environment).

- [x] Task 2: Migration — `voyage_member_locations`, player-color assignment, RLS, Realtime authorization (AC: #1, #2)
  - [x] `voyage_member_locations` table created (nullable `heading`, per AC's heading-chevron need).
  - [x] `voyage_members.player_color` added (short token name, not hex).
  - [x] **Player-color assignment**: read `start_voyage()`/`join_voyage()`'s full current definitions first, then amended both via a new shared `assign_player_color()` helper (lowest-unused-color pool, locked via `perform ... for update` on the Voyage's existing active-member rows before computing — prevents two concurrent joins claiming the same color; race-free by construction for `start_voyage()` since each call operates on a brand-new `voyage_id`). Assignment happens once, at membership creation; the idempotent-rejoin branch in `join_voyage()` never reassigns. **Found and fixed a pre-existing gap while reading `start_voyage()`'s full history**: it had never had `revoke execute ... from public/anon` applied (only Story 2.1's original `grant ... to authenticated`), unlike every other Voyage-scoped RPC — added both revokes.
  - [x] `voyage_member_locations` RLS: **select-only** policy (any active fellow member can read); deliberately no insert/update RLS policies — all writes route through `upsert_location()` (security definer), matching this project's consistent established pattern of every Voyage-scoped write going through an authorizing RPC, never direct client table access (this is a deviation from the story's own original text, which proposed insert/update RLS policies — corrected during implementation for consistency with the rest of the codebase).
  - [x] `get_live_locations(p_voyage_id)` RPC — reasoned through definer-vs-invoker the way Story 2.6 reasoned through `get_removal_notice()`: unlike that case, RLS doesn't block anything a legitimate member needs here, so `security invoker` is correct (more minimal-privilege than definer); an explicit `is_active_voyage_member` check still raises a clear `LOC01` error for a non-member rather than silently returning zero rows, matching `get_voyage_members()`'s `MEM01` precedent. Extended `get_voyage_members()` to also return `player_color` rather than duplicating Voyager-metadata logic in a second query.
  - [x] `upsert_location(p_voyage_id, p_lat, p_lng, p_heading)` RPC — conditional upsert (`where voyage_member_locations.updated_at < excluded.updated_at`, same idiom as `end_voyage()`/`grant_organizer_status()`), per AD-3.
  - [x] **Realtime channel authorization**: implemented via `realtime.messages` RLS policies + `realtime.topic()`, gating both read and write on `is_active_voyage_member()` for the `voyage:{voyageId}` topic. **This is genuinely new, unproven surface for this project** — flagged explicitly in the migration's own comment and in the Debug Log; needs live verification against Supabase's current docs more than anything else in this story.

- [x] Task 3: `location-repository.ts` (AC: #1, #2)
  - [x] New `src/repositories/location-repository.ts`: `getLiveLocations`/`upsertLocation` wrap the Task 2 RPCs; `subscribeToLocations(voyageId, onLocation)` (receive side) and `createBroadcastChannel(voyageId)` (send side, exposing `send`/`unsubscribe`) both use `broadcast` events (not `postgres_changes`, per AD-3) on `{ config: { private: true } }` channels — required for the Realtime-authorization RLS policies to be consulted at all.
  - [x] Channel lifecycle lives entirely in this repository layer, per AD-2. `createBroadcastChannel`'s `send` drops calls issued before the channel's subscribe handshake actually completes (`isReady` flag), rather than risk a silently-lost first broadcast. 13/13 new tests passing; `tsc --noEmit` clean.

- [x] Task 4: `useLiveLocations()` hook (AC: #1, #2)
  - [x] New `src/shared/hooks/use-live-locations.tsx` — a plain parameterized hook (`voyageId` in, live locations out), not a Context/Provider like the app-wide hooks (no reason to be globally provided; only one screen ever consumes it). Cold-loads via `getLiveLocations`, then subscribes via `locationRepository.subscribeToLocations`. Merges broadcasts into local state by `userId`, `updatedAt`-wins so a stale broadcast can't regress a fresher render.
  - [x] Unsubscribes on unmount, and correctly re-subscribes (unsubscribing the old channel first) if `voyageId` itself changes.
  - [x] Exposes `{ locations, isLoading, hasError }`, no `refetch` (matches AC #3's "no manual refresh"). 9/9 new tests passing; `tsc --noEmit` clean.

- [x] Task 5: Foreground location watching + sending (AC: #2)
  - [x] New `src/shared/hooks/use-foreground-location-broadcast.tsx`. `Location.watchPositionAsync({ accuracy: Balanced, timeInterval: 5000, distanceInterval: 20 }, callback)` — 5s/20m documented explicitly in-code as an assumption, not settled fact. Every callback broadcasts; `upsertLocation` throttled to at most once per 30s.
  - [x] Only runs when `useLocationPermission()`'s `status === 'granted'` — no separate suppression flag; absence of a broadcast/upsert IS the suppression mechanism.
  - [x] Stops watching (`subscription.remove()`) and unsubscribes the broadcast channel on unmount, correctly handling the case where `watchPositionAsync`'s promise resolves *after* the effect was already cleaned up (an `isCancelled` flag, same shape this codebase already uses elsewhere for async-work-outliving-unmount). 8/8 new tests passing; `tsc --noEmit` clean.

- [x] Task 6: The Live Map screen itself (AC: #1, #3, #4)
  - [x] Read `active-voyage.tsx`'s full current definition first. End Voyage and Remove Voyager confirm-swap sub-states preserved verbatim (same testIDs, same logic). The old default view (destination + inline member list) is now the **Organizer menu** (`showOrganizerMenu`), reached via the HUD's "⋯" — same "functional relocation, not redesign" scope as planned.
  - [x] `MapView`/`Camera` base, `Mapbox.StyleURL.Dark` (the package's own stock-dark constant — `dark-v10` in the installed 10.3.5 version, not the `dark-v11` guessed in this story's original text; corrected during implementation to use the real bundled constant rather than a hand-picked string) unless overridden.
  - [x] Custom `MarkerView`-based marker per Voyager-with-a-location: ring/dot/chevron/label using the new `MapMarker`/`PlayerColors` tokens.
  - [x] Pulse via `Animated.loop`, with an `AccessibilityInfo.isReduceMotionEnabled()`/`reduceMotionChanged`-gated static filled-ring fallback.
  - [x] Marker tap → peek card (scrim + bottom-docked card, name/role, close). No Fun Fact count.
  - [x] `hud-top`: destination, live Voyager count, elapsed time (ticking every second off `createdAt`), "⋯" opening the Organizer menu.
  - [x] `status-pill`, hardcoded "Riding".
  - [x] Sky-strip.
  - [x] `recenter-button`: moves the camera to the centroid of all currently-rendered marker coordinates.
  - [x] `accessibilityLabel` per marker (name + role + player color, no Fun Fact count).

- [x] Task 7: Tests (AC: #1, #2, #3, #4)
  - [x] `location-repository.test.ts` — 13 tests.
  - [x] `use-live-locations.test.tsx` — 9 tests, including the stale-broadcast-doesn't-regress case.
  - [x] `use-foreground-location-broadcast.test.tsx` — 8 tests, including permission-gating, send-vs-throttled-upsert, and stale-subscription-resolves-after-unmount.
  - [x] `active-voyage.test.tsx` — rewritten; `@rnmapbox/maps` mocked as functional stub components (`MapView`/`MarkerView` render children, `Camera` exposes an imperative `moveTo` via `useImperativeHandle` so the recenter test can assert on it directly). 25 tests: all pre-existing End Voyage/Grant Organizer/Remove Voyager coverage preserved (now reached via `organizer-menu-button` first), plus new marker/peek-card/recenter/organizer-menu coverage. 29 suites / 251 tests passing project-wide; `tsc --noEmit` clean.

- [x] Task 8: Live verification (AC: #1, #2, #3, #4)
  - [x] **Attempted and confirmed blocked.** `npx eas whoami` still fails to resolve an executable in this environment; no physical device attached — identical blocker to every prior story, confirmed specifically for this story too rather than assumed. `@rnmapbox/maps` (like `expo-location`'s background mode) genuinely cannot run in Expo Go, so nothing in Task 6 could be exercised on-device here.
  - [x] A real Mapbox access token IS available (set during story creation) — not a blocker for rendering tiles once a dev build exists; the remaining blockers are purely the EAS CLI/physical-device gap and the separate EAS-cloud-secret gap noted in Task 1.
  - [x] **UNVERIFIED, needs a real device**: two-session near-real-time marker updates; whether the Realtime channel authorization (`realtime.messages` RLS policies, genuinely new/unproven surface for this project) actually blocks a non-member from subscribing to another Voyage's channel — this is the single most important thing in this entire story that hand-verification-against-patterns cannot substitute for, flagged with particular emphasis in the Dev Agent Record.

### Review Findings

- [x] [Review][Patch] `get_voyage_members()`'s `CREATE OR REPLACE FUNCTION` adds a 5th return column (`player_color`) without a preceding `DROP FUNCTION` — Postgres rejects changing a function's return-column set this way, which would abort this entire migration in a single transaction, taking down the locations table, RLS, Realtime authorization, and `player_color` itself along with it, and blocking the previously-working Grant Organizer flow [supabase/migrations/20260731000000_live_map_locations.sql] — fixed: `drop function if exists public.get_voyage_members(uuid);` added directly ahead of the redefinition, fixed in place (not a follow-up migration — this migration has never successfully applied anywhere, so a later migration could never have "fixed" a predecessor that never got past this exact statement).
- [x] [Review][Patch] `voyage_member_locations`'s SELECT RLS policy and `get_live_locations()`'s query both filter only on the *requester's* active-membership status, never the *row owner's* — a Voyager removed from (or who leaves) a Voyage keeps their last-known position rendering as a live marker for every remaining member indefinitely [supabase/migrations/20260731000000_live_map_locations.sql] — fixed: both now also require `vm.removed_at is null and vm.is_active = true` on the row owner.
- [x] [Review][Patch] The Realtime broadcast **write** policy authorizes by channel membership only — it never validates that the broadcast payload's `user_id` matches the sender's own `auth.uid()`, so any active Voyager can currently broadcast a spoofed location claiming to be a different Voyager [supabase/migrations/20260731000000_live_map_locations.sql] — fixed: `payload ->> 'user_id' = auth.uid()::text` added to the write policy's `with check`, confirmed to match `location-repository.ts`'s actual broadcast payload shape.
- [x] [Review][Patch] AC1's required "comet-trail" marker element was never implemented — `MapMarker.trailFadeDurationMs`/`trailLengthMs` tokens exist but are never referenced anywhere in `active-voyage.tsx`; the Completion Notes' claim that the marker implements "ring/chevron/trail/pulse" is inaccurate [src/app/active-voyage.tsx, src/constants/design-tokens.ts] — fixed: `useLiveLocations` now also accumulates a pruned (`trailLengthMs`-windowed) position-history array per Voyager; a new `VoyagerTrail` component renders it as a real Mapbox `ShapeSource`/`LineLayer` (a geographic trail needs to pan/zoom with the map, which only a real map layer can do — not an approximation within `MarkerView`). Rendered as one fixed-opacity line per Voyager, a deliberate simplification of a full per-point gradient fade, documented as such in-code.
- [x] [Review][Patch] `useLiveLocations`' cold-load unconditionally replaces the entire locations map (`setLocations(initial)`) instead of merging through the same `updatedAt`-wins comparison its own broadcast handler uses — a broadcast that lands before the cold-load's network round-trip resolves gets silently regressed back to the stale cold-load snapshot [src/shared/hooks/use-live-locations.tsx] — fixed: rewritten around a single closure-local `mergeIn` function both the cold-load and every broadcast route through; a new integration-style test controls the cold-load's promise resolution timing to prove the race is actually closed.
- [x] [Review][Patch] `initMapbox()` is called at module scope in `active-voyage.tsx`, contradicting `mapbox.ts`'s own documented design intent ("only ever called from that screen's own module... keeping the blast radius scoped to Live Map instead of crashing the whole app") — Expo Router's file-based route registration may import this module eagerly at app startup regardless of whether the user ever reaches an active Voyage, which would turn a missing Mapbox token into an app-wide crash rather than a Live-Map-scoped one [src/app/active-voyage.tsx, src/lib/mapbox.ts] — fixed: moved into a `useEffect(() => { initMapbox(); }, [])` inside the screen component itself.
- [x] [Review][Patch] The marker peek card omits player color, contradicting this story's own interim-scope decision text ("the v1 peek card is name + player color + role only") [src/app/active-voyage.tsx] — fixed: a color swatch added next to the name.
- [x] [Review][Patch] `get_live_locations()` failing (`hasError`) has no user-facing treatment anywhere — the map silently shows zero markers, indistinguishable from "no one else is online yet" [src/app/active-voyage.tsx] — fixed: an inline error line added to the `hud-top` card when `hasError` is true.
- [x] [Review][Patch] A raw location fix's `heading` can be the platform's `-1` "undetermined" sentinel rather than `null` — passed straight through to the marker's chevron rotation, this renders at an invalid `-1deg` angle instead of hiding as unknown [src/shared/hooks/use-foreground-location-broadcast.tsx] — fixed: normalized to `null` whenever the raw value is negative.
- [x] [Review][Patch] The elapsed-time `setInterval` re-renders every second regardless of which sub-view is showing, including while the Organizer menu or a confirm screen (where the elapsed text isn't even rendered) is up [src/app/active-voyage.tsx] — fixed: the effect now no-ops while `showOrganizerMenu`/`showConfirm`/`removeTarget` is active.
- [x] [Review][Defer] Two independent Realtime channel objects (`useLiveLocations`' receive-side, `useForegroundLocationBroadcast`'s send-side) are opened per client for the identical `voyage:{voyageId}` topic, rather than one shared channel handle — functionally correct (both work), but redundant, and in tension with AD-2's "one channel per Voyage... not a separate ad hoc channel per feature" framing. Consolidating requires coupling two currently-independent, already-tested hooks; deferred rather than rushed late in an already-large review round [src/repositories/location-repository.ts] — deferred, revisit as a deliberate refactor, not a review-round patch
- [x] [Review][Defer] `hud-bottom`'s member-list roster has no scroll view or max-height and isn't part of Task 6's own checklist or the DESIGN.md tokens quoted in Dev Notes — for a larger Voyage it could grow to cover a substantial, unscrollable portion of the map. Narrow real-world likelihood (this app's road-trip use case rarely exceeds a handful of people) but worth a bounded-height/scroll fix in a follow-up rather than this already-large round [src/app/active-voyage.tsx] — deferred
- [x] [Review][Defer] `upsertLocation`'s call in the foreground-broadcast hook is fire-and-forget with no `.catch`/error surfacing — folds into the existing Story 1.4 deferred item ("no screen's catch block reports to Sentry... worth a dedicated error-reporting pass across all screens at once"), not a new one-off fix [src/shared/hooks/use-foreground-location-broadcast.tsx] — deferred, folds into existing Story 1.4 deferred item
- [x] [Review][Defer] Colorless Voyagers (9th+ member, once the 8-color pool is exhausted) all render with the same fallback ring color, indistinguishable from each other except by name label. `assign_player_color()`'s graceful `null` degradation is correct; this is a real but very narrow edge case for this app's actual road-trip group sizes [src/app/active-voyage.tsx] — deferred
- [x] [Review][Defer] `realtime.messages` is a shared, project-wide system table — this migration is the first to enable RLS and add topic-scoped policies on it, but nothing documents this as a convention future Realtime features must also follow (add their own topic-scoped policy or be silently default-denied). Documentation-only gap, worth a comment addition in a follow-up [supabase/migrations/20260731000000_live_map_locations.sql] — deferred
- [x] [Review][Dismiss] `handleRecenter()`'s naive arithmetic-mean centroid breaks at the antimeridian (longitudes near ±180) — impractically narrow for a single-group road-trip app that will never span the international date line
- [x] [Review][Dismiss] `assign_player_color()`'s locking correctness depends on an "at least one active member always exists before `join_voyage()` can run" invariant that's structurally true by construction (a Voyage always starts with the Organizer's row) but only asserted in a comment — real observation, but not independently actionable beyond what's already reasoned through
- [x] [Review][Dismiss] Story shipped to `review` status with its highest-risk piece (Realtime channel authorization) explicitly marked unverified — this is the same disclose-honestly-and-let-review-decide pattern every prior story in this session has followed for its own live-verification gaps, not a new process gap specific to this story

## Dev Notes

- **This is the largest, most architecturally consequential story so far in this project** — first use of Supabase Realtime anywhere in this codebase (confirmed via a full-repo grep: zero existing matches for `supabase.channel`/`realtime`), first native map library, first genuinely long-lived client-side subscription (every prior hook this session has been fetch-once-or-on-demand). Budget for this — do not rush Task 2's RLS/Realtime-authorization work in particular; AD-1's "never via application-layer checks alone" is a hard, repeatedly-reinforced rule in this project, not a suggestion.
- **Two external, human-owned dependencies block full completion, distinct from the usual Supabase-CLI-access blocker**: (1) no Mapbox account/access token exists yet in this project (verified: `.env.local`/`.env.example` have no Mapbox-related keys) — same category of gap as Story 1.2's Resend-domain issue; (2) the actual "glowing light-trail roads" art-directed Mapbox Studio style doesn't exist either — this story wires up the *mechanism* to consume a style URL, not the style itself. Both are flagged explicitly in this story's own interim-scope decisions, not silently assumed away.
- **Exact refresh/ping interval (5s time / 20m distance in Task 5) is a documented ASSUMPTION, not a settled spec value** — the PRD's own §9 Open Questions list explicitly flags this exact tradeoff as unresolved ("needs engineering input"). This assumption should be raised for confirmation, same as this story's other assumptions, before or during implementation — don't let it silently ossify into "the spec" just because it's written in a task list.
- **Component token specs, quoted verbatim from DESIGN.md** (needed almost word-for-word to implement Task 6 correctly, reproduced here so the dev agent doesn't have to re-derive them from a separate document mid-implementation):
  ```yaml
  hud-card:
    background: '{colors.surface-glass}'      # #1E2547CC
    scrimOpacityMin: 85%
    radius: '{rounded.lg}'
    border: '1px solid {colors.border-hairline}'
    blur: 20px

  map-marker:
    size: 40px
    hitRegion: 48px
    radius: '{rounded.full}'
    ringWidth: 3px
    ringColor: '{colors.player-*}'   # first-come-first-served from the 8-hue pool, sticky for the whole Voyage
    fill: '{colors.surface-dusk-high}'
    trailFadeDuration: 600ms
    trailLength: 8s

  status-pill:
    minHeight: 48px
    minWidth: 48px
    paddingX: '{spacing.4}'
    radius: '{rounded.full}'
    riding:  { background: '{colors.surface-dusk-high}', foreground: '{colors.ink-primary}', border: '1px solid {colors.border-hairline}' }
    driving: { background: '{colors.accent-electric}', foreground: '{colors.surface-midnight}', glow: '0 0 16px {colors.accent-electric}55' }
    label: '{typography.label}'
  ```
  8 player-color hex values (`design-tokens.ts` needs all 8, this story is the first to need any of them): `coral #FF6B6B`, `teal #2FE6C0`, `violet #9B6BFF`, `gold #FFC247`, `sky #4FB4FF`, `lime #B4E61D`, `pink #FF8FD8`, `slate #8C9AC4`.
- **Accessibility floor, quoted verbatim** (EXPERIENCE.md): "every map marker announces role + state (\"Meera, riding, teal marker\")... Live/active state is never color-only: an active Voyager marker pairs its player-color ring with a pulse animation (or, under Reduce Motion, a filled-vs-hollow ring distinction) and a heading chevron... Notifications are audio/haptic-redundant, not visual-only." *(The EXPERIENCE.md example string also mentions a Fun Fact count — that's v1.1-only per DESIGN.md's own mockup footnote; the v1 announcement omits it, as reflected in Task 6's own wording above — this is a real, minor inconsistency between EXPERIENCE.md's example and DESIGN.md's scoping, not something to silently "fix" by inventing a v1 Fun Fact count.)*
- **No `player_color` handling exists anywhere in the codebase yet** — `get_voyage_members()` (Story 2.5) doesn't return it. Either extend that existing function to also return `player_color`, or have the new `get_live_locations()` RPC be the sole source of it — read `get_voyage_members()`'s current definition before deciding, since duplicating "list of Voyagers" logic across two RPCs unnecessarily is exactly the kind of "reinventing wheels" this project's whole process exists to prevent.
- **"Marker doesn't render for others until resolved" (Story 3.1's AC2) has no explicit data-model flag anywhere in any planning doc** — confirmed by this story's own research. The correct implementation is implicit: a Voyager whose OS permission isn't granted never produces a broadcast or upsert (Task 5's own permission-gating), so there is simply no location row/broadcast for the map to render a marker from. Do not build a separate "is this Voyager's location suppressed" flag — it would be redundant state duplicating what "no data" already expresses, the same "never duplicate what absence-of-data already tells you" principle this project applied repeatedly in Epic 2.
- **`active-voyage.tsx` is being substantially restructured, not rewritten from scratch.** Its Organizer sub-flows (End Voyage, Grant Organizer, Remove Voyager) are fully built, fully tested, and correct as of Story 2.6's review — this story relocates their entry point (behind the new HUD's "⋯"), it does not redesign their internal behavior, copy, or the RPCs they call. Minimize the surface area of that diff; a large, hard-to-review diff on an already-correct subsystem is a self-inflicted review risk.

### Project Structure Notes

- `supabase/migrations/` gets one new file: `voyage_member_locations` table, `voyage_members.player_color`, `start_voyage()`/`join_voyage()` player-color-assignment changes, `get_live_locations()`, RLS policies, Realtime channel authorization policies.
- `src/repositories/location-repository.ts` is a new file (per the architecture doc's own named source-tree entry).
- `src/shared/hooks/use-live-locations.tsx` and `src/shared/hooks/use-foreground-location-broadcast.tsx` are new files.
- `src/app/active-voyage.tsx` — substantially modified (map + HUD replaces the plain default view; confirm-swap sub-states preserved).
- `src/constants/design-tokens.ts` — modified: `HudCard`, `MapMarker`, `StatusPill` tokens added; all 8 `player-*` colors added to `Colors`.
- `app.json` — modified: `@rnmapbox/maps` plugin appended.
- `.env.example`/`.env.local` — `EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN` already added (placeholder/real respectively, during story creation); may still need `EXPO_PUBLIC_MAPBOX_STYLE_URL` if the style-URL-override approach (interim-scope decision above) is implemented.
- `~/.netrc` (outside the repo, not part of the git tree) — Mapbox secret downloads token, already written during story creation. Nothing to add here during implementation unless it's missing/misconfigured.

### References

- [Source: epics.md#Story-3.2] — acceptance criteria as originally scoped; Epic 3's own story-to-story scope boundaries (3.3 owns background tracking, 3.4 owns the role-switch mechanism, 3.5 owns reconnection UX)
- [Source: prd.md#FR-9] — the functional requirement; §9 Open Question 1 (refresh interval, unresolved); §8 SM-C1 (battery counter-metric)
- [Source: EXPERIENCE.md#Component-Patterns, #Accessibility-Floor, #Interaction-Primitives, #State-Patterns] — map-marker/hud-card behavior, the accessibility floor quoted verbatim above, pinch/pan/recenter-only interaction rule, the "marker doesn't render... not a punitive lockout" line inherited from Story 3.1
- [Source: DESIGN.md#Components, #Colors, #Voice-and-Tone] — `hud-card`/`map-marker`/`status-pill` token blocks quoted verbatim above, all 8 player-color hex values, the "let a Voyager's color drift between sessions" Don't
- [Source: DESIGN.md mockups/key-live-map.html] — structural reference for HUD layout, marker anatomy (trail/pulse/dot/ring/chevron/label), peek-card layout; explicitly a *mockup* simplification (SVG glow-road illustration), not a literal implementation spec for the base map tile style itself
- [Source: architecture/ARCHITECTURE-SPINE.md#AD-1, #AD-2, #AD-3, #AD-8] — RLS-via-shared-predicate-function rule, single-Realtime-channel-per-Voyage rule, ephemeral-broadcast/single-persisted-row location model, Mapbox native SDK v11 pin and EAS-dev-build requirement
- [Source: 2-1-start-a-voyage.md, 2-3-join-voyage-via-code-link.md] — `is_active_voyage_member()`'s current definition, `start_voyage()`/`join_voyage()`'s current definitions (both amended by this story for player-color assignment) — read fully before touching either function, same discipline Story 2.6 applied to `join_voyage()`
- [Source: 2-5-grant-organizer-status.md] — `get_voyage_members()`'s current definition (candidate for extension vs. duplication — see Dev Notes)
- [Source: 3-1-os-location-permission.md] — `useLocationPermission()`'s exposed `status`, the precedent for disclosing an EAS/device-verification blocker plainly, the `app.json` "append, don't clobber the plugins array" precedent, and the exact reasoning behind "no explicit suppression flag — no data in, no marker out" this story's Task 5 applies directly

## Dev Agent Record

### Agent Model Used

Claude Sonnet 5 (claude-sonnet-5)

### Debug Log References

- `npx eas whoami` still fails to resolve an executable, no physical device attached — Task 8's live device verification could not be performed. Same disclosure standard as every prior story; particularly consequential here since the Realtime channel authorization (this story's single riskiest piece) can only be truly proven correct against a live Supabase project with two real sessions.
- Realtime channel authorization (`realtime.messages` RLS + `realtime.topic()`) is genuinely new, unproven surface for this codebase — implemented against this story's own research into Supabase's current documented pattern, but flagged explicitly in the migration's own comment as the area most likely to have drifted from Supabase's actual current API.
- `Mapbox.StyleURL.Dark` resolves to `dark-v10` in the installed `@rnmapbox/maps` 10.3.5, not `dark-v11` as the story's own original text guessed — corrected to use the package's own bundled constant rather than a hand-picked string, once actually checked against the installed package's type definitions.
- Found and fixed a pre-existing gap while reading `start_voyage()`'s full history for the player-color work: it had never had `revoke execute ... from public/anon` applied, unlike every other Voyage-scoped RPC (only Story 2.1's original `grant ... to authenticated`). Fixed in the same migration since it was already being touched.
- `use-live-locations.tsx` initially used a plain `isLoading` boolean requiring a synchronous `setIsLoading(true)` reset in the effect body, tripping `react-hooks/set-state-in-effect`. Rewritten to derive `isLoading` from a `resolvedForVoyageId` comparison, matching `use-active-voyage.tsx`/`use-profile.tsx`'s established pattern exactly, rather than patching around the symptom.
- `active-voyage.tsx`'s marker pulse used `useRef(new Animated.Value(0)).current`, tripping the same `react-hooks/refs` rule already present (unfixed) in `sign-in.tsx` since Story 1.2. Unlike `sign-in.tsx` (pre-existing, out of scope), this was new code — fixed by switching to `useState(() => new Animated.Value(0))[0]`, which achieves the same create-once semantic without a ref access, resolving all three flagged lines (the initializer plus both `.interpolate()` calls) with one change.
- **Code review found two genuine security/data-integrity gaps in the migration** (a location-spoofing hole in the Realtime broadcast write policy, and removed Voyagers' stale positions never being filtered out) plus a migration that would have failed to apply outright (`get_voyage_members()`'s `CREATE OR REPLACE FUNCTION` changing its return-column set without a `DROP FUNCTION` first — verified against documented Postgres semantics, not just taken on faith). All three fixed directly in the same migration file rather than a follow-up one, since the file had never successfully applied anywhere in the first place.
- **Code review also found the comet-trail (part of AC1) had never actually been implemented** despite tokens existing and the Completion Notes claiming it was done. Implemented for real during the review round: `useLiveLocations` now accumulates a pruned position-history array per Voyager, rendered via a genuine Mapbox `ShapeSource`/`LineLayer` (not an approximation), with the specific limitation (one fixed-opacity line, not a full per-point gradient fade) documented in-code rather than silently narrowed.

### Completion Notes List

- All 8 tasks complete. AC1 (stylized map, custom markers, comet-trail), AC2 (Realtime channel per Voyage, RLS-gated at both the table and channel level, spoofing-resistant), AC3 (pinch/pan/recenter, no manual refresh), and AC4 (pulse+chevron, never color-only, with a Reduce Motion fallback) are all implemented and tested within this story's documented interim-scope decisions (stock Mapbox style not a custom art-directed one; foreground-only sending; no Driving-mode mechanism; no reconnection UX; no Fun Fact count).
- Full Mapbox integration (not deferred): user supplied real public + secret Mapbox tokens during story creation, wired into `.env.local` and `~/.netrc` respectively. The only remaining Mapbox-related gap is registering the secret as an EAS cloud secret, which needs EAS CLI access this environment doesn't have.
- Code review (2026-07-29) found and fixed 10 patch items, including a migration-breaking bug, a location-spoofing gap, a stale-location privacy gap, a real cold-load/broadcast race condition, and the missing comet-trail. 4 items deferred (double Realtime channel, unbounded `hud-bottom` roster, colorless-past-8-Voyagers edge case, undocumented `realtime.messages` convention for future stories) rather than rushed in an already-large review round.
- Full test suite: 29 suites / 258 tests passing. Story implementation added 55 tests; code review added 7 more (1 cold-load-race regression test, 2 trail accumulation/pruning tests, 1 heading-sentinel test, 1 hasError test, 2 comet-trail rendering tests) and revised existing `active-voyage.test.tsx`/`use-live-locations.test.tsx` fixtures for the `trails` field.
- `npx tsc --noEmit` clean. `npm run lint` clean except the one pre-existing, out-of-scope `sign-in.tsx` failure from Story 1.3.
- Task 8 live verification is UNVERIFIED — no EAS CLI or physical device available. The on-device map rendering, two-session near-real-time marker updates, and — most importantly — whether the Realtime channel authorization (now also validating payload identity, post-review) actually blocks a non-member from subscribing to another Voyage's channel all still need hands-on confirmation before this ships. This last item in particular cannot be meaningfully substituted for by pattern-matching against prior stories, since it's genuinely new surface.

### File List

- `package.json` / `package-lock.json` (modified — `@rnmapbox/maps` dependency added)
- `app.json` (modified — `@rnmapbox/maps` config plugin appended)
- `.env.local` / `.env.example` (modified — `EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN`)
- `~/.netrc` (new, outside the repo — Mapbox secret downloads token)
- `src/lib/mapbox.ts` (new)
- `supabase/migrations/20260731000000_live_map_locations.sql` (new; modified again in code review — DROP FUNCTION fix, stale-location filtering, broadcast payload validation)
- `src/constants/design-tokens.ts` (modified — player colors, `HudCard`, `MapMarker`, `StatusPill`, `Rounded.lg`)
- `src/repositories/voyage-repository.ts` (modified — `VoyageMember.playerColor`)
- `src/repositories/__tests__/voyage-repository.test.ts` (modified)
- `src/repositories/location-repository.ts` (new)
- `src/repositories/__tests__/location-repository.test.ts` (new)
- `src/shared/hooks/use-live-locations.tsx` (new; modified again in code review — cold-load/broadcast race fix, trail accumulation)
- `src/shared/hooks/__tests__/use-live-locations.test.tsx` (new; modified again in code review)
- `src/shared/hooks/use-foreground-location-broadcast.tsx` (new; modified again in code review — heading sentinel normalization)
- `src/shared/hooks/__tests__/use-foreground-location-broadcast.test.tsx` (new; modified again in code review)
- `src/app/active-voyage.tsx` (substantially restructured; modified again in code review — initMapbox scope, comet-trail rendering, peek card color, hasError banner, interval gating)
- `src/app/__tests__/active-voyage.test.tsx` (substantially rewritten; modified again in code review)
- `src/app/__tests__/active-voyage.test.tsx` (substantially rewritten)

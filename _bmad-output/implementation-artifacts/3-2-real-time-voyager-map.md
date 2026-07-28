---
baseline_commit: ab01ad2333b173234ba99dd74fa118fa96779e27
---

# Story 3.2: Real-Time Voyager Map

Status: review

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

### Completion Notes List

- All 8 tasks complete. AC1 (stylized map, custom markers), AC2 (Realtime channel per Voyage, RLS-gated), AC3 (pinch/pan/recenter, no manual refresh), and AC4 (pulse+chevron, never color-only, with a Reduce Motion fallback) are all implemented and tested within this story's documented interim-scope decisions (stock Mapbox style not a custom art-directed one; foreground-only sending; no Driving-mode mechanism; no reconnection UX; no Fun Fact count).
- Full Mapbox integration (not deferred): user supplied real public + secret Mapbox tokens during story creation, wired into `.env.local` and `~/.netrc` respectively. The only remaining Mapbox-related gap is registering the secret as an EAS cloud secret, which needs EAS CLI access this environment doesn't have.
- Full test suite: 29 suites / 251 tests passing. This story added 55 new tests across 4 new test files (`location-repository.test.ts`: 13, `use-live-locations.test.tsx`: 9, `use-foreground-location-broadcast.test.tsx`: 8, plus a rewritten `active-voyage.test.tsx`: 25) and touched `voyage-repository.test.ts`/fixtures for the new `playerColor` field.
- `npx tsc --noEmit` clean. `npm run lint` clean except the one pre-existing, out-of-scope `sign-in.tsx` failure from Story 1.3.
- Task 8 live verification is UNVERIFIED — no EAS CLI or physical device available. The on-device map rendering, two-session near-real-time marker updates, and — most importantly — whether the Realtime channel authorization actually blocks a non-member from subscribing to another Voyage's channel all still need hands-on confirmation before this ships. This last item in particular cannot be meaningfully substituted for by pattern-matching against prior stories, since it's genuinely new surface.

### File List

- `package.json` / `package-lock.json` (modified — `@rnmapbox/maps` dependency added)
- `app.json` (modified — `@rnmapbox/maps` config plugin appended)
- `.env.local` / `.env.example` (modified — `EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN`)
- `~/.netrc` (new, outside the repo — Mapbox secret downloads token)
- `src/lib/mapbox.ts` (new)
- `supabase/migrations/20260731000000_live_map_locations.sql` (new)
- `src/constants/design-tokens.ts` (modified — player colors, `HudCard`, `MapMarker`, `StatusPill`, `Rounded.lg`)
- `src/repositories/voyage-repository.ts` (modified — `VoyageMember.playerColor`)
- `src/repositories/__tests__/voyage-repository.test.ts` (modified)
- `src/repositories/location-repository.ts` (new)
- `src/repositories/__tests__/location-repository.test.ts` (new)
- `src/shared/hooks/use-live-locations.tsx` (new)
- `src/shared/hooks/__tests__/use-live-locations.test.tsx` (new)
- `src/shared/hooks/use-foreground-location-broadcast.tsx` (new)
- `src/shared/hooks/__tests__/use-foreground-location-broadcast.test.tsx` (new)
- `src/app/active-voyage.tsx` (substantially restructured)
- `src/app/__tests__/active-voyage.test.tsx` (substantially rewritten)

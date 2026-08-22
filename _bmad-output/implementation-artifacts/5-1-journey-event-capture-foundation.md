---
baseline_commit: dbeadd70f57d4a537189e1c981efc2199b84aaa7
---

# Story 5.1: Journey Event Capture Foundation

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a developer,
I want the two remaining real gaps in the already-built journey-event capture backend closed — a broadcast RLS restriction and end-to-end delivery to the UI — plus a minimal manual spotting path,
So that Epic 6's Memory Lane has trustworthy, correctly-scoped event data to draw on, with no captured event silently dropped and no client able to forge one.

## Acceptance Criteria

1. A new migration restricts the `realtime.messages` Broadcast write RLS policy (`voyage_channel_write_active_members` in `supabase/migrations/20260810000000_hybrid_live_journey_bus.sql`) so `payload ->> 'type' = 'location.updated'` is required in its `WITH CHECK`. Today that policy checks only `senderUserId`, `voyageId`/topic match, and active membership — nothing stops a client from broadcasting a hand-crafted `journey.event.created` message directly, bypassing `create_journey_event` entirely (AD-14 requires journey events be server-created and idempotent).
2. `onJourneyEvent` is wired end-to-end: `useLiveLocations` (`src/shared/hooks/use-live-locations.tsx`) passes a real callback as `subscribeToLocations`'s 9th argument (currently omitted — see Dev Notes), accumulates received `JourneyEventSignal`s into new hook state, and returns that state. Today `onJourneyEvent?.(...)` inside `subscribeToLocations` (`src/repositories/location-repository.ts`) is an unreachable no-op because nothing ever passes it.
3. A minimal manual spotting-log control exists on the Live Map screen (`src/app/active-voyage.tsx`) for `police` / `deer` / `construction` — a small set of tap controls, no nudges, no onboarding, no photo attachment (that's Epic 5's remaining, still-deferred scope). Tapping one calls the existing `journeyEventRepository.createEvent` (already implemented, already wired into the offline outbox's `journey_event` kind — see Dev Notes). No such UI trigger exists anywhere in the app today.
4. Per the established Driving-role convention (Story 3.4, UX-DR25 — "manual Fun Fact/photo controls are entirely **absent**, not disabled, from a Driving-role Voyager's HUD"), the spotting controls are absent, not disabled, when the current Voyager's `travelRole === 'driving'`.
5. New/updated tests cover: the RLS type restriction (a broadcast with `type` other than `location.updated` is rejected), and end-to-end journey-event delivery through `useLiveLocations` (a `journey.event.created` broadcast reaches the hook's returned state).

*(Fulfills part of FR-10; realizes AD-14. Pulled forward via Sprint Change Proposal 2026-08-10 ahead of the rest of Epic 5, to unblock Epic 6. Source: epics.md, Story 5.1.)*

## Before writing any code — read this first

This story's scope was revised **three times** during story creation as the actual current state of the codebase kept turning out richer than expected. Do not re-derive scope from first principles or from the git history of commits `7977d0d`/`cd74c6e` in isolation — trust the "What already exists — do not touch" section below, verified directly against the current source at story-creation time.

**What already exists and is already correct — do not touch, do not duplicate:**

- **Stop detection is fully built and wired.** `src/shared/services/journey-events/stop-detector.ts` (generic, provider-independent hysteresis state machine: `moving → candidate → confirmed → exiting → moving`, producing a `StopTrace`), `stop-classifier.ts` (evidence-fusion scoring, mirrors the server's `classify-stop` Edge Function), and `stop-monitor.ts` (persists detector state to `AsyncStorage`, submits completed traces via `stopEventRepository.submitCandidate`). `stop-monitor.ts`'s `observeStopSample` is called from `src/shared/lib/background-location-task.ts`'s `reportLocationFix` (the function shared by *both* the background task callback and web's foreground `watchPositionAsync` path — see that file's own comment), so it already covers foreground and background. There is no old "coffee-stop detector" left in the codebase (it was fully superseded, not merely renamed) — do not look for one to generalize or delete.
- **`journey_events.event_type` keeping `'coffee_stop'` alongside the generic `'stop'` type is deliberate**, not a defect. `src/shared/types/voyage-message.ts` lines 11-13 carry an explicit comment: *"`coffee_stop` remains accepted during the mobile compatibility window. New automatic classification always emits one generic `stop` lifecycle event; coffee/fuel/rest-area are metadata categories, never event types."* Do not remove `'coffee_stop'` from either the DB CHECK constraint or the `JourneyEventType` TS union. This is the same compatibility-window convention AD-15 establishes generally and this codebase already applies elsewhere (e.g. the legacy `'location'` broadcast event kept alongside `'voyage_message'`).
- **The shadow stop-intelligence pipeline** (`stop_events` table, `submit_stop_candidate` RPC, `classify-stop` Edge Function) is a separate system from this story's scope. It has its own rollout gate (AD-16's production gate, `STOP-INTELLIGENCE-ARCHITECTURE.md`) and does not publish to `journey_events` or notify anyone yet. Nothing in this story touches it.

**What is actually still missing** (verified by direct grep/read at story-creation time, not assumption): the RLS type restriction (AC1), the `onJourneyEvent` wiring (AC2), and any manual spotting-log UI at all (AC3) — none exists.

## Dev Notes

### AC1 — RLS migration

Current policy (`supabase/migrations/20260810000000_hybrid_live_journey_bus.sql`, lines 36-46):

```sql
create policy "voyage_channel_write_active_members" on realtime.messages
  for insert
  to authenticated
  with check (
    realtime.messages.extension = 'broadcast'
    and payload ->> 'senderUserId' = (select auth.uid())::text
    and payload ->> 'voyageId' is not null
    and (select realtime.topic()) = 'voyage:' || (payload ->> 'voyageId')
    and public.is_active_voyage_member((payload ->> 'voyageId')::uuid, (select auth.uid()))
  );
```

Add a new migration file (do not edit the migration above in place — it is already committed) that drops and recreates this policy with one more `and payload ->> 'type' = 'location.updated'` clause. Follow this repo's own naming convention: `supabase/migrations/<timestamp>_<description>.sql`, timestamp later than the newest existing migration (`20260810010000_stop_intelligence_foundation.sql`) — e.g. `20260811000000_restrict_broadcast_write_to_location.sql`. Location broadcasts (the fast path in `location-repository.ts`'s `activePublishers`) are the only client-originated Broadcast messages that should ever pass this policy; every journey event must come from `create_journey_event`'s own `realtime.send()` (which is not subject to this INSERT policy at all — it runs as the RPC's `security definer` role, not as the authenticated client).

### AC2 — `onJourneyEvent` wiring

`location-repository.ts`'s `subscribeToLocations` signature (already correct, unchanged by this story):

```ts
function subscribeToLocations(
  voyageId, onLocation, onStatusChange?, onRosterChange?, onVoyageStatusChange?,
  currentUserId?, onPresenceChange?, onJourneyEvent?: (event: JourneyEventSignal) => void,
): { unsubscribe: () => void }
```

and its dispatch (already correct, unchanged):

```ts
} else if (isJourneyEventSignal(message.payload) && message.payload.voyageId === voyageId) {
  onJourneyEvent?.(message.payload);
}
```

`use-live-locations.tsx`'s call (lines 188-230) passes exactly 7 arguments after `voyageId` today, ending at `currentUserId, setPresentUserIds,` — no 8th callback. Add a `journeyEvents` state field (e.g. `useState<JourneyEventSignal[]>([])`, or keyed by `eventId` if de-duplication across reconnects matters — `JourneyEventPayload.eventId` is stable), pass an accumulator callback as the 9th argument, and add it to the hook's returned `LiveLocationsState`. Follow this file's existing conventions: reset it alongside `locations`/`trails` in both the no-`voyageId` and per-effect-run reset blocks (the `Promise.resolve().then()` microtask pattern already used there for `react-hooks/set-state-in-effect`), and do not introduce a second state-reset mechanism.

This story does **not** require rendering received journey events anywhere in the UI — that's Epic 6's Roadbook/consumer work. Exposing them from the hook is the full scope here.

### AC3/AC4 — Manual spotting-log UI

`journeyEventRepository.createEvent` (`src/repositories/journey-event-repository.ts`, unchanged by this story) already calls the `create_journey_event` RPC correctly:

```ts
async function createEvent(voyageId: string, event: { id: string; type: JourneyEventType; occurredAt: string; metadata?: Record<string, unknown> })
```

and the offline outbox (`src/shared/services/outbox/outbox.ts`) already has a `journey_event` kind wired to it — reuse both directly, do not write a new RPC call path. Generate `id` via `createMessageId()` (`@/shared/types/voyage-message`, already used elsewhere in this codebase for the same purpose) and `occurredAt` via `new Date().toISOString()`.

`active-voyage.tsx` is the Live Map screen (2500+ lines — use Grep, not a full read, to navigate it). Relevant existing state/patterns to reuse, not duplicate:
- `myMember`/`myTravelRole` (already computed, ~line 1274-1276) — gate the controls' entire render (not a `disabled` prop) on `myTravelRole !== 'driving'`, matching Story 3.4's established "absent, not disabled" convention.
- `toastMessage`/`setToastMessage` (already used for organizer-action confirmations) — reuse for a lightweight "Logged." confirmation, consistent with this screen's existing feedback pattern; do not add a second toast mechanism.
- `HudBar`/`MapBanner` tokens (already imported from `@/constants/design-tokens`) — place the new controls as a small HUD row using these existing tokens, not a new design-token set. This story does not include a UX design pass (unlike Stories 4.1/4.5/4.7/6.2) — keep the visual treatment simple and consistent with existing HUD chrome; do not invent new visual language here.
- On failure (network/offline), follow the exact `isNetworkFailure`/outbox-enqueue pattern already used by `handleEndVoyage`/`handleGrantOrganizer`/`handleRemoveVoyager` in this file: call `journeyEventRepository.createEvent` directly first; if it fails with a network-classified error (`isNetworkFailure`, already defined in this file), the **UI handler itself must call** `outbox.enqueue({ kind: 'journey_event', payload: {...} })` — `createEvent` is a bare RPC wrapper with no outbox involvement of its own (verified: `outbox.ts`'s `journey_event` case is what calls `createEvent`, not the reverse). Omitting this explicit enqueue call would silently drop an offline spotting tap, directly contradicting this story's own goal.

### Testing

This project uses Jest (`jest-expo` preset, `npm test` = `jest --watchAll=false`). No SQL/RLS test framework exists in this repo (confirmed: no pgTAP, no `supabase/tests`) — for AC1, add a lightweight verification (either a lint-level assertion in a test file that constructs the expected policy SQL and greps the migration for it, or a documented manual verification step in Completion Notes if no automated DB-level test is feasible in this environment) rather than inventing new test infrastructure. For AC2, follow the existing pattern in `src/shared/hooks/__tests__/use-live-locations.test.tsx` (already asserts on `subscribeToLocations`'s call arguments and invokes the captured callbacks directly, per this codebase's established mock style).

### Project Structure Notes

- No conflicts with `ARCHITECTURE-SPINE.md` — this story implements AD-14 as already adopted, adds no new architectural decision.
- Migration goes in `supabase/migrations/` per AD-1/AD-6's established convention (timestamp-prefixed filename, applied via the existing dev/prod promotion pipeline — no manual DB step).

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 5.1: Journey Event Capture Foundation] (AC)
- [Source: _bmad-output/planning-artifacts/architecture/architecture-trips-2026-07-25/ARCHITECTURE-SPINE.md#AD-14] (durable journey-event authority)
- [Source: _bmad-output/planning-artifacts/sprint-change-proposal-2026-08-10.md] (why this story exists, sequencing rationale)
- [Source: supabase/migrations/20260810000000_hybrid_live_journey_bus.sql:36-46] (policy to correct)
- [Source: src/repositories/location-repository.ts] (`subscribeToLocations`/`onJourneyEvent` — already correct)
- [Source: src/shared/hooks/use-live-locations.tsx:188-230] (call site missing the 9th argument)
- [Source: src/repositories/journey-event-repository.ts] (`createEvent` — already correct, reuse as-is)
- [Source: src/shared/services/journey-events/stop-detector.ts, stop-classifier.ts, stop-monitor.ts] (already-complete stop pipeline — do not touch)
- [Source: src/shared/types/voyage-message.ts:11-13] (deliberate `coffee_stop` compatibility-window comment — do not remove)

## Tasks / Subtasks

- [x] Task 1: RLS migration (AC: #1)
  - [x] Create new timestamped migration dropping/recreating `voyage_channel_write_active_members` with the added `type = 'location.updated'` check
  - [x] Verify the fast-path location broadcast in `location-repository.ts` still passes (it already sends `type: 'location.updated'`)
  - [x] Add/update a test verifying a non-`location.updated` broadcast is rejected
- [x] Task 2: `onJourneyEvent` wiring (AC: #2)
  - [x] Add `journeyEvents` state to `useLiveLocations`, reset alongside `locations`/`trails`
  - [x] Pass an accumulator callback as `subscribeToLocations`'s 8th argument (corrected from the story's earlier "9th" — the signature has 8 params total after `voyageId` is counted as the 1st)
  - [x] Return `journeyEvents` from the hook
  - [x] Add/update a test asserting a `journey.event.created` broadcast reaches the hook's state
- [x] Task 3: Manual spotting-log UI (AC: #3, #4)
  - [x] Add police/deer/construction tap controls to `active-voyage.tsx`, gated absent (not disabled) for `travelRole === 'driving'`
  - [x] Wire taps to `journeyEventRepository.createEvent` via the existing outbox path
  - [x] Reuse existing `toastMessage` for confirmation feedback
- [x] Task 4: Full regression pass
  - [x] Run full `npm test` suite — must stay green
  - [x] Run `npx tsc --noEmit` — must stay clean

## Dev Agent Record

### Agent Model Used

claude-sonnet-5

### Debug Log References

- `npx jest supabase/migrations/__tests__/broadcast-write-policy.test.ts` — RED then GREEN (AC1)
- `npx jest src/shared/hooks/__tests__/use-live-locations.test.tsx -t "journey.event.created"` — RED then GREEN (AC2)
- `npx jest src/shared/hooks/__tests__/use-live-locations.test.tsx` (full file) — 22/22 passed after updating the two pre-existing call-signature assertions for the new 8th argument
- `npx jest src/app/__tests__/active-voyage.test.tsx -t "spotting"` — RED (3 of 4 failed; the "hides controls" test passed trivially since nothing existed yet) then GREEN (AC3/AC4)
- `npx jest src/app/__tests__/active-voyage.test.tsx` (full file) — 101/101 passed, no regressions
- `npx tsc --noEmit` — clean (run 3 times across the session as changes landed; first run caught 9 pre-existing `active-voyage.test.tsx` mock literals needing the new required `journeyEvents` field, all fixed)
- `npm test` (full suite) — 51/51 suites, 515/515 tests passed
- `npx eslint src/app/active-voyage.tsx src/app/__tests__/active-voyage.test.tsx src/shared/hooks/use-live-locations.tsx src/shared/hooks/__tests__/use-live-locations.test.tsx supabase/migrations/__tests__/broadcast-write-policy.test.ts` — clean, no errors/warnings
- **Code review round (2026-08-11):** ad hoc `/code-review` run against this story's diff found 4 issues, all verified accurate against source before fixing: (1) the outbox flush success handler had no branch for `journey_event`, so a queued spotting log flushed with no confirmation toast; (2) `handleLogSpotting` had no re-entrancy guard, so a rapid double-tap could create two `journey_events` rows for one sighting; (3) this story's own second RLS test (`voyage_channel_presence_active_members...`) was vacuous — it searched for the presence policy inside the *new* migration (which never defines it), so its `if (presenceMatch)` guard silently skipped every assertion; (4) `journeyEvents` had no growth bound, unlike `trails`. All 4 fixed with new failing-then-passing tests. Confirmed fix #3 is no longer vacuous via a manual mutation test (temporarily changed the expected value to something false, confirmed the test then failed, reverted). Fixing #2's test also surfaced a real React "overlapping act() calls" warning from the test's own structure (not app logic) — resolved by matching the existing "granting Organizer status on one row does not re-enable a different row still in flight" precedent's two-separate-act() pattern. Full regression after all 4 fixes: 51/51 suites, 518/518 tests, `tsc`/`eslint` clean.

### Completion Notes List

- **AC1:** Added `supabase/migrations/20260811000000_restrict_broadcast_write_to_location.sql`, restricting `voyage_channel_write_active_members`'s `WITH CHECK` to `payload ->> 'type' = 'location.updated'`. Did not edit the original `20260810000000` migration in place (already committed). Verified the fast-path location broadcast (`location-repository.ts`) is unaffected — it already constructs `type: 'location.updated'` on every signal.
- **AC2:** `useLiveLocations` now accumulates received `journey.event.created` broadcasts into new `journeyEvents` state (deduplicated by `JourneyEventPayload.eventId`, following the same closure-variable + `Promise.resolve().then()` reset pattern already used for `locations`/`trails`), passed as `subscribeToLocations`'s 8th argument. Note: the story text said "9th argument" in a few places — corrected during implementation to "8th" (the signature has 8 parameters total after and including `voyageId`); this was a documentation-only imprecision, not an implementation ambiguity, since the actual signature was read directly from source.
- **AC3/AC4:** Added a minimal police/deer/construction spotting-log row to the Live Map's `hud-bottom` bar, reusing the already-built `journeyEventRepository.createEvent` and the existing `isNetworkFailure`/`outbox.enqueue` pattern already established by `handleEndVoyage`/`handleGrantOrganizer`/`handleRemoveVoyager` in the same file. Controls are entirely absent (not disabled) when `myTravelRole === 'driving'`, per Story 3.4/UX-DR25's established convention. Sized 60x60 (not reusing `recenterButton`'s 56x56) per NFR7's stricter `>=60pt/dp` requirement for manual Fun Fact-family capture controls. No UX design pass was in this story's scope, so styling deliberately mirrors the existing `recenterButton` treatment rather than inventing new visual language.
- **Scope discipline:** this story's Dev Notes explicitly warned that its own scope had been revised three times during story creation, and named specific already-complete systems not to touch or duplicate (the generic `stop-detector.ts`/`stop-classifier.ts`/`stop-monitor.ts` pipeline, and the deliberate `coffee_stop` compatibility-window value in `journey_events`/`voyage-message.ts`). Verified both were still accurate at implementation time and left untouched.
- All 5 Acceptance Criteria satisfied; all 4 Tasks/Subtasks complete; full regression suite green with no pre-existing test behavior changed (only mechanical updates to account for the new required `journeyEvents` field and the new 8th callback argument).
- **Code review follow-up (2026-08-11):** fixed all 4 findings from an ad hoc `/code-review` pass — outbox flush now confirms a successfully-synced spotting log; `handleLogSpotting` gained a ref-based re-entrancy guard (state alone doesn't work here, since two same-tick presses land in the same React batch before any re-render, so a state-only guard's closure would still read stale/empty on the second call); the presence-policy RLS test now searches for the policy it actually asserts on, instead of vacuously skipping; `journeyEvents` is now capped at the newest 200 entries.

### File List

- `supabase/migrations/20260811000000_restrict_broadcast_write_to_location.sql` — new migration (AC1)
- `supabase/migrations/__tests__/broadcast-write-policy.test.ts` — new test (AC1); code-review follow-up: corrected the presence-policy test to search by its own policy name instead of the write policy's, and to assert unconditionally
- `src/shared/hooks/use-live-locations.tsx` — `journeyEvents` state, `onJourneyEvent` wiring (AC2); code-review follow-up: `MAX_JOURNEY_EVENTS` cap in `mergeInJourneyEvent`
- `src/shared/hooks/__tests__/use-live-locations.test.tsx` — new journey-event-delivery test; updated 3 pre-existing call-signature assertions for the new 8th argument (AC2); code-review follow-up: new bounded-growth test
- `src/app/active-voyage.tsx` — `handleLogSpotting`, spotting-controls row in `hud-bottom`, new imports (`journeyEventRepository`, `createMessageId`, `JourneyEventType`), new styles (AC3, AC4); code-review follow-up: `journey_event` outbox-flush success branch, `loggingSpotTypesRef`/`loggingSpotTypes` re-entrancy guard, `disabled` state on spotting Pressables
- `src/app/__tests__/active-voyage.test.tsx` — new `journeyEventRepository` mock, 4 new spotting-control tests; updated 9 pre-existing `mockUseLiveLocations` return-value literals for the new required `journeyEvents` field (AC3, AC4); code-review follow-up: new outbox-confirmation test and double-tap test

## Change Log

- 2026-08-11: Implemented Story 5.1 — RLS broadcast-type restriction migration (AC1), `onJourneyEvent` end-to-end wiring in `useLiveLocations` (AC2), minimal police/deer/construction manual spotting-log UI on Live Map with offline outbox queuing (AC3/AC4). Followed red-green-refactor throughout. Full regression suite green (51/51 suites, 515/515 tests), `tsc --noEmit` clean. All ACs satisfied.
- 2026-08-11: Code review follow-up — fixed 4 findings from an ad hoc `/code-review` pass (missing outbox-flush confirmation for `journey_event`, missing double-tap re-entrancy guard, a vacuous RLS test, unbounded `journeyEvents` growth). All fixed with new failing-then-passing tests. Full regression suite green (51/51 suites, 518/518 tests), `tsc`/`eslint` clean.

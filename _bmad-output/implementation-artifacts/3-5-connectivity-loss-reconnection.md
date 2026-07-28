---
baseline_commit: d4a37bb5de9f8f78b341661bf77d672a61b16db6
---

# Story 3.5: Connectivity Loss & Reconnection

Status: review

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a Voyager,
I want the map to handle a dead zone gracefully,
so that a temporary signal drop doesn't corrupt the trip or make me look like I vanished.

## Acceptance Criteria

1. **Given** I lose connectivity mid-drive, **when** the map can't reach the server, **then** last-known positions stay rendered with a subtle "reconnecting" note, not a blocking banner.
2. **And** any queued Voyage-lifecycle write (not location pings) flushes per-item on reconnect; one with a stale precondition (e.g. my membership was revoked while offline) is dropped with a clear conflict message, never silently retried forever.

*(Fulfills NFR2; UX-DR33; AD-7.)*

## Scope decision (confirmed with the user during story creation)

AD-7's text names five "Voyage lifecycle writes" (start/join/end/grant/remove). **This story's outbox covers only `end_voyage`, `grant_organizer_status`, and `remove_voyager`** — the three writes that happen from *within* an already-active Voyage session (Live Map's Organizer menu) and leave the user on the same screen either way.

`start_voyage` and `join_voyage` are explicitly **out of scope** for this story: both navigate immediately to a new screen on success (Join-code card, Live Map) using server-generated data (join code, Voyage id) that doesn't exist until the write actually lands. There's no coherent "queued, still show the next screen" UX for those two without a materially different "don't navigate until it lands" design — and the AC's own "mid-drive" framing points at the three in-session writes anyway (starting/joining normally happens at trip kickoff, where signal is more likely than mid-drive). This is a deliberate, user-confirmed v1 scope cut, not a silently dropped requirement — flag it explicitly if a future story revisits full AD-7 coverage.

## Tasks / Subtasks

- [x] Task 1: Live connectivity signal (AC: #1)
  - [x] **Read `src/repositories/location-repository.ts`'s `subscribeToLocations()` in full first.** Its current `.subscribe()` call passes no status callback at all — the channel's own connection-status stream (`SUBSCRIBED`/`CHANNEL_ERROR`/`TIMED_OUT`/`CLOSED`) is discarded entirely. This is the first place anywhere in this codebase a live connectivity signal has been needed — there is currently zero connectivity tracking anywhere in the app (confirmed: no `@react-native-community/netinfo`/`expo-network` dependency exists, and `useLiveLocations`'s existing `hasError` is a one-time cold-load-fetch-failure flag only, never updated from the realtime subscription's own health).
  - [x] Add an optional third parameter to `subscribeToLocations(voyageId, onLocation, onStatusChange?: (status: 'connected' | 'disconnected') => void)`. Wire it into the existing `.subscribe(...)` call: `'SUBSCRIBED'` → `onStatusChange?.('connected')`; `'CHANNEL_ERROR' | 'TIMED_OUT' | 'CLOSED'` → `onStatusChange?.('disconnected')`. This is the actual "can we reach the server" signal AC #1 means by "the map can't reach the server" — more accurate than a generic device-network check, and it needs no new dependency.
  - [x] Extend `use-live-locations.tsx`'s returned state with `isConnected: boolean`, **defaulted to `true`** (optimistic) so the normal, near-instant subscribe handshake on every mount never flashes a false "reconnecting" note — it only flips to `false` on an actual `CHANNEL_ERROR`/`TIMED_OUT`/`CLOSED` signal, and back to `true` on the next `SUBSCRIBED`. Reset to `true` on a `voyageId` change (same as `hasError`/`locations`/`trails` already reset), for the same "don't leak state across a Voyage change" reason those already do. The reset is deferred via a microtask (`Promise.resolve().then(...)`), matching the null-`voyageId` branch's own existing `react-hooks/set-state-in-effect` workaround — confirmed via lint that a synchronous reset at the top of the effect body trips that rule.

- [x] Task 2: "Reconnecting" HUD note (AC: #1)
  - [x] No DESIGN.md/EXPERIENCE.md copy exists for this exact note (confirmed absent — EXPERIENCE.md's own line is only "a subtle 'reconnecting' HUD note, not a blocking banner," no wording given). Wrote reasonable first-draft copy directly — "Reconnecting…" — flagged here for eventual PM/UX sign-off, matching this project's established pattern for filling undocumented UX gaps rather than blocking on it.
  - [x] In `active-voyage.tsx`, when `useLiveLocations`'s `isConnected` is `false`, shows the note inside the existing `hud-top` card (near the elapsed-time text) — muted/secondary styling (`Colors.inkSecondary`, a new `hudReconnecting` style), deliberately **not** `hudError`'s red/alarm treatment. Markers keep rendering from whatever `locations` last held for free (the hook simply stops receiving new broadcasts while disconnected; it never clears `locations`) — no new logic needed, confirmed via a dedicated test that markers stay rendered while disconnected.

- [x] Task 3: Offline write-outbox service (AC: #2)
  - [x] New file `src/shared/services/outbox/outbox.ts` — matches AD-7's own prescribed source-tree location (`shared/services/outbox/`, from `ARCHITECTURE-SPINE.md`'s source-tree block: `outbox/ # offline write-queue (AD-7)`).
  - [x] Typed queue, one variant per in-scope write kind:
    ```ts
    export type OutboxItem =
      | { id: string; kind: 'end_voyage'; payload: { voyageId: string }; queuedAt: string }
      | { id: string; kind: 'grant_organizer_status'; payload: { voyageId: string; targetUserId: string }; queuedAt: string }
      | { id: string; kind: 'remove_voyager'; payload: { voyageId: string; targetUserId: string }; queuedAt: string };
    ```
  - [x] Persist via `@react-native-async-storage/async-storage` (already a project dependency — used for Supabase session persistence in `src/lib/supabase.ts` and background-location-task context in `src/shared/lib/background-location-task.ts`; no new dependency needed). Storage key: `voylo:offline-write-outbox`. Load into an in-memory array on first use each session; persist the full array back after every mutation (enqueue or flush).
  - [x] `enqueue(item: Omit<OutboxItem, 'id' | 'queuedAt'>): Promise<void>` — generates an id (e.g. via a timestamp+random string, no new uuid dependency needed), appends, persists.
  - [x] **The network-failure-vs-conflict classifier is the crux of this task — read carefully.** None of `endVoyage`/`grantOrganizerStatus`/`removeVoyager`'s own RPCs ever legitimately return `error.code === 'unknown'` themselves — every real business/conflict error from this codebase's own RPCs carries a specific errcode (`END03`, `ORG01`, `REM02`, `REM04`, `MEM01`, etc., per each RPC's own migration). `toRepositoryError()`'s `code: error.code ?? 'unknown'` fallback to `'unknown'` only fires when supabase-js itself didn't have a real Postgres error to report — which is exactly what a genuine network-level failure looks like. Classify like this:
    ```ts
    async function attemptItem(item: OutboxItem): Promise<
      { outcome: 'succeeded'; data: unknown } | { outcome: 'conflict'; message: string } | { outcome: 'network-failure' }
    > {
      try {
        const result = await callForKind(item); // dispatches to voyageRepository.endVoyage/grantOrganizerStatus/removeVoyager based on item.kind
        if (!result.error) return { outcome: 'succeeded', data: 'data' in result ? result.data : null };
        if (result.error.code === 'unknown') return { outcome: 'network-failure' };
        return { outcome: 'conflict', message: result.error.message };
      } catch {
        // A genuinely thrown exception (not a resolved {error}) is unambiguously network-level.
        return { outcome: 'network-failure' };
      }
    }
    ```
    This also means the same `catch` this classifier relies on must exist at the *call site* in `active-voyage.tsx` (Task 4) for the very first, non-queued attempt too — see Task 4's note about `handleGrantOrganizer`/`handleRemoveVoyager` currently having no `catch` at all (a gap already found and deliberately deferred in Story 3.4's code review as "pre-existing, fix uniformly later" — this story is that "later": it needs the catch anyway to distinguish queueable failures from real ones, so add it now rather than re-deferring).
  - [x] `flush(): Promise<{ succeeded: { item: OutboxItem; data: unknown }[]; conflicts: { item: OutboxItem; message: string }[] }>` — iterate the persisted queue **in order**. For each item: `succeeded` → collect it, continue to the next item (AD-7: "one failed or conflicting item does not block the rest of the queue" — a conflict is exactly this "failed" case, and the network-fine, so trying the next item is correct). `conflict` → collect it (with its message), continue to the next item, same reasoning. `network-failure` → **stop the whole flush pass here** — this item and everything after it stays queued for the next flush trigger, since attempting more items while evidently still offline would just repeat the same failure. Persist whatever remains queued (succeeded + conflicted items removed; everything from the network-failure point onward kept) before returning.
  - [x] Scoping note: no cross-Voyage bookkeeping needed. If a queued item's precondition genuinely goes stale (e.g. the user left the Voyage before reconnecting), the existing RPC's own server-side authorization check already rejects it correctly at flush time — same as it would for any live call — so it naturally surfaces as a `conflict`, not a special case this service needs to detect itself.
  - [x] Explicitly out of scope, documented not silently skipped: the outbox is **not** cleared on sign-out. A queued item flushing under a different signed-in user (shared-device edge case) still can't succeed incorrectly — the RPC's own `auth.uid()`-based authorization at flush time would reject it as a conflict, same as any stale precondition — so this is a narrow, self-correcting, non-security cosmetic gap (a confusing dropped-conflict message for the wrong user), not worth the added scope of wiring outbox-clearing into `use-auth.tsx`'s sign-out flow for v1.

- [x] Task 4: Wire the outbox into `active-voyage.tsx` (AC: #2)
  - [x] **Read the current `handleEndVoyage`/`handleGrantOrganizer`/`handleRemoveVoyager` in full before touching them** — this is a targeted extension of existing, already-reviewed handlers, not a rewrite. Preserve their existing synchronous-success behavior (navigate for end, toast+refresh for grant, refresh for remove) exactly.
  - [x] Add a `catch` to each of the three handlers (currently `handleGrantOrganizer`/`handleRemoveVoyager` have none at all — `try { ... } finally { ... }`; `handleEndVoyage` already has one). On catch: instead of just `setError(GENERIC_ERROR)`, call `outbox.enqueue({ kind: '...', payload: {...} })` and show a distinct "queued, will sync when you're back online" message (reuse the same error-text slot each handler already has — `error`/`membersError`/`removeError` — with different copy, not a new state field). Also applied the same `isNetworkFailure(error)` (`error.code === 'unknown'`) check to each handler's *resolved*-error branch, not just the `catch` — a network failure can surface either way, and both needed the same enqueue treatment for consistency with the outbox's own classifier.
  - [x] Move the `Toast` render (`{toastMessage ? <Toast .../> : null}`) so it's visible from the **main map view**, not only inside the `showOrganizerMenu` early-return block where it lives today — a flush-triggered success/conflict can legitimately happen while the user is looking at the map, not the organizer menu. Kept the organizer-menu's own Toast render too (still needed for its existing synchronous-action toasts) — this is a second render site sharing the same `toastMessage` state, not a relocation, since only one of the two screen states is ever mounted at a time.
  - [x] Added two `useEffect`s that call `outbox.flush()`: one unconditional on mount (covers items persisted from a previous app session, regardless of what `isConnected` happens to read at that instant), and one keyed on `[isConnected]` that fires whenever it's `true` (covers reconnects within the same session). These briefly overlap in the common case (`isConnected` starts `true`), causing a harmless double-attempt on mount — a flush on an already-empty/already-processed queue is a cheap no-op, confirmed via a dedicated test using `mockResolvedValueOnce` to match real (not mocked-every-call) outbox behavior. The flush logic itself lives in a ref reassigned inside a dependency-less effect (not synchronously during render — `react-hooks/refs` forbids writing `.current` during render, confirmed via lint), so it always closes over the latest `members`/`voyageId` without needing them in either triggering effect's own dependency array. On the result:
    - For each `succeeded` item: dispatches the same side effects the synchronous handler would have — `end_voyage` → `await refetch()` then `router.push('/voyage-ended', {...})`, same params shape `handleEndVoyage` already builds; `grant_organizer_status`/`remove_voyager` → `await loadMembers.current(voyageId)` plus a toast. Grant's toast looks up the target's display name from the (possibly stale) `members` array, falling back to `"A Voyager"` if they've since fallen out of it.
    - For each `conflicts` item: shows its message via the same toast mechanism (a conflict is exactly AC #2's "clear conflict message," not a silent drop).
  - [x] Noted the one real UX consequence of this design in-code: an Organizer who queues "End Voyage" while offline will be automatically navigated away to Voyage Ended the moment connectivity returns, even mid-interaction with something else — matches the AC's own "flushes... on reconnect" framing, not a bug to guard against.

- [x] Task 5: Tests (AC: #1, #2)
  - [x] `location-repository.test.ts`: `subscribeToLocations` invokes `onStatusChange('connected')` on a `SUBSCRIBED` status and `onStatusChange('disconnected')` on each of `CHANNEL_ERROR`/`TIMED_OUT`/`CLOSED`; omitting the callback doesn't throw.
  - [x] `use-live-locations.test.tsx`: `isConnected` starts `true`, flips to `false` on a disconnected status callback, flips back to `true` on a subsequent connected callback, and resets to `true` on a `voyageId` change.
  - [x] New `src/shared/services/outbox/__tests__/outbox.test.ts`: `enqueue` persists via AsyncStorage and is readable back; `flush` on an empty queue is a no-op; a `succeeded` item is removed from the persisted queue and reported; a `conflict` item (an RPC error with a real errcode) is removed and reported with its message; a `network-failure` item (an RPC error with `code: 'unknown'`, and separately a thrown exception) is **kept** in the queue and **stops** the flush pass, leaving later-queued items untouched; queue order is preserved across a partial flush.
  - [x] `active-voyage.test.tsx`: a network-failure (both a resolved `code: 'unknown'` error and a thrown exception) on End Voyage/Grant Organizer/Remove Voyager enqueues instead of showing the generic error, with distinct "queued" copy; `outbox.flush()` is attempted on mount; a reconnect (`isConnected` false→true) triggers a flush attempt; a successful flushed `end_voyage` navigates to `voyage-ended` with the right params; a successful flushed `grant_organizer_status` refreshes the roster and shows a toast with the target's real display name; a `conflicts` result shows the conflict message via the same toast mechanism; the "Reconnecting…" note shows only when `isConnected` is `false`, is distinct from the error banner, and never clears rendered markers.

- [x] Task 6: Live verification (AC: #1, #2)
  - [x] Same standard as every prior story this session: attempt via EAS CLI/physical device, disclose plainly if blocked (blocked for 9 consecutive stories at the time this story was created; expect the same). Note this one is genuinely harder to verify even with a working build than most prior stories — it requires actually losing real connectivity (e.g. airplane mode mid-session) rather than just running the app, so disclose that as a second layer of uncertainty even if the EAS blocker is ever resolved.

## Dev Notes

- **This is the first story to introduce any live connectivity tracking in this codebase.** Confirmed via research during story creation: no `@react-native-community/netinfo`, `expo-network`, or any other network-status dependency exists anywhere in `package.json`. Deliberately not adding one — the Realtime channel's own subscribe-status stream (already flowing through `location-repository.ts`, just previously discarded) is the more accurate signal anyway ("can we reach *this app's* server," not "is the device on some network"), and needs no new dependency.
- **AD-7's "precondition snapshot" doesn't need new server-side plumbing.** Every write RPC in this codebase already re-validates its own authorization at call time (RLS + explicit checks), statelessly, on every invocation — that's exactly a "precondition check" already. Replaying a queued item's exact original arguments through the unmodified existing RPC gets correct precondition enforcement for free; the outbox itself doesn't need to capture or send any separate "precondition" data beyond what each RPC already requires.
- **The network-failure-vs-conflict classifier (Task 3) is the one piece of new reasoning this story introduces — get it right, it's load-bearing for the whole feature.** `error.code === 'unknown'` (from `toRepositoryError`'s own fallback) is the signal; every real RPC error in this codebase has a specific, non-`'unknown'` code. Verify this holds for `end_voyage`/`grant_organizer_status`/`remove_voyager` specifically by reading their migrations (`20260728000000_end_voyage.sql`, `20260729010000_grant_organizer_status.sql`, `20260730000000_remove_voyager.sql`) before implementing — don't just trust this note, confirm it.
- **Story 3.4's code review deferred exactly this gap** ("`handleGrantOrganizer`/`handleRemoveVoyager` have no `catch` for a genuine thrown exception... worth a single hardening pass across all three [handlers] at once, not a piecemeal fix"). This story *is* that pass — Task 4 adding a `catch` to all three handlers closes that deferred item as a side effect, not a coincidence.
- **Location pings are explicitly out of scope for this story's outbox** (AD-7's own text) — Story 3.3's background-location upsert/broadcast already has its own independent "fails open" handling; nothing here should touch it.
- **`travel_role` (Story 3.4) is also out of scope for the outbox** — AD-7 enumerates "start/join/end/grant/remove" only; a travel-role switch is a live status toggle a Voyager can just retry with a normal tap once back online, not a consequential one-shot action worth offline-queueing infrastructure for.
- **The outbox is a plain, portable module — not a React hook/Context.** It has no UI dependency and is called from `active-voyage.tsx`'s effects/handlers like any other repository-shaped service, matching AD-7's own "shared/services" framing (a service, not a feature-local hook).

### Project Structure Notes

- `src/shared/services/outbox/outbox.ts` — new (first file in a new `shared/services/` directory — matches the path AD-7's own architecture doc source-tree block already reserved for it).
- `src/shared/services/outbox/__tests__/outbox.test.ts` — new.
- `src/repositories/location-repository.ts` — modified: `subscribeToLocations()` gains an optional `onStatusChange` callback.
- `src/shared/hooks/use-live-locations.tsx` — modified: new `isConnected` field.
- `src/app/active-voyage.tsx` — modified: "Reconnecting…" HUD note, `catch` added to `handleGrantOrganizer`/`handleRemoveVoyager`, outbox enqueue-on-failure and flush-on-reconnect/mount, `Toast` render relocated to the main view.
- Test files for all of the above.

### References

- [Source: epics.md#Story-3.5] — acceptance criteria as scoped; the "Idea captured for story detailing" note in Epic 4's section confirming a future "connection drops" Fun Fact could cheaply extend this story's own connectivity-drop detection later (not this story's job)
- [Source: architecture/ARCHITECTURE-SPINE.md#AD-7] — the offline write-outbox rule verbatim: binds start/join/end/grant/remove, per-item flushing not FIFO-blocking, precondition-snapshot/conflict-drop semantics, location pings explicitly excluded; source-tree's `outbox/` path reservation
- [Source: architecture/ARCHITECTURE-SPINE.md#AD-3, AD-8] — confirms location pings are governed separately and never queued here
- [Source: architecture/ARCHITECTURE-SPINE.md#AD-4] — "surfaced to the user via the shared auth/session hook" — interpreted pragmatically as "through this app's existing user-notification mechanism" (the already-established `Toast` component), not a literal requirement to route conflict events through `use-auth.tsx` specifically, since AD-4's own rule text is about session/token handling, not a general notification bus
- [Source: ux-designs/ux-trips-2026-07-25/EXPERIENCE.md UX-DR33, "Connectivity loss mid-drive" state pattern] — "last-known positions stay rendered with a subtle 'reconnecting' HUD note... not a blocking banner. Taps/photos queue locally, sync on reconnect." (the "taps/photos" half is v1.1 Fun Fact scope, not applicable yet — only the reconnecting-note and lifecycle-write-queueing halves apply to v1)
- [Source: 3-2-real-time-voyager-map.md, `src/repositories/location-repository.ts`] — `subscribeToLocations()`'s current implementation being extended here (confirmed via direct read: its `.subscribe()` call currently discards the channel status callback entirely)
- [Source: 3-4-driver-safety-role-switch.md's code review findings] — the deferred "no catch in `handleGrantOrganizer`/`handleRemoveVoyager`" finding this story's Task 4 resolves as a byproduct

## Dev Agent Record

### Agent Model Used

Claude Sonnet 5 (claude-sonnet-5), via Claude Code, BMad Method dev-story workflow.

### Debug Log References

- `npx eas whoami` → `npm error could not determine executable to run` (exit 1). Same EAS-CLI-access blocker present for every story this session (10th consecutive). Live verification (Task 6) could not be performed on a physical device — doubly so for this story, since AC1 requires actually losing real connectivity (e.g. airplane mode mid-session), not just running the app on a working build.
- `npx jest` (full suite): 31 suites / 321 tests, all passing.
- `npx tsc --noEmit`: clean, no errors.
- `npm run lint`: 4 errors, all in `src/app/sign-in.tsx:27` (`react-hooks/refs` on `useRef(new Animated.Value(0)).current`) — pre-existing since Story 1.2, explicitly out of scope for every story this session including this one; no new lint errors introduced.
- One real lint-driven design correction during implementation: an initial version of the outbox-flush wiring in `active-voyage.tsx` reassigned a ref's `.current` synchronously during render (`flushOutbox.current = async () => {...}` directly in the render body) to keep it closing over the latest `members`/`voyageId`. `react-hooks/refs` flagged this — the same rule this file's own marker-pulse `Animated.Value` had already worked around via `useState`'s lazy initializer instead of `useRef`. Fixed by moving the reassignment into a dependency-less `useEffect` (runs after render, not during it) rather than reverting to a stale-closure-prone pattern.

### Completion Notes List

- Extended `subscribeToLocations()` (`location-repository.ts`) with an optional `onStatusChange` callback wired to the Realtime channel's own `SUBSCRIBED`/`CHANNEL_ERROR`/`TIMED_OUT`/`CLOSED` status stream — previously discarded entirely. Extended `useLiveLocations()` with `isConnected: boolean` (optimistic default `true`, reset via the same microtask-deferred pattern the null-`voyageId` branch already used, confirmed necessary via lint) (Task 1).
- Added a subtle "Reconnecting…" HUD note (first-draft copy, no DESIGN.md/EXPERIENCE.md wording existed) shown when `isConnected` is `false`, deliberately styled distinct from the existing red `hudError` banner. Markers keep rendering from last-known positions for free — `useLiveLocations` never clears `locations` on disconnect, only stops receiving new broadcasts (Task 2).
- Built `src/shared/services/outbox/outbox.ts` (Task 3), AD-7's offline write-outbox, scoped to `end_voyage`/`grant_organizer_status`/`remove_voyager` only per the user-confirmed scope decision recorded in this story's own header. AsyncStorage-persisted (`voylo:offline-write-outbox`). The core design decision — classifying a network-level failure (`error.code === 'unknown'`, or a thrown exception) versus a genuine business/conflict failure (any real RPC errcode) — was verified directly against all three RPCs' migrations before implementing, not just asserted.
- Wired the outbox into `active-voyage.tsx` (Task 4): added the missing `catch` to `handleGrantOrganizer`/`handleRemoveVoyager` (closing the exact gap Story 3.4's code review deferred as "fix uniformly later"), applied the same network-failure classifier to each handler's resolved-error branch too (not just the catch), added a second `Toast` render site in the main map view (the existing one only ever rendered inside the Organizer-menu screen state), and added the mount/reconnect flush-triggering effects with per-kind success/conflict dispatch.
- Full regression suite (321 tests, 31 suites), `tsc --noEmit`, and lint all pass clean relative to this story's own changes (see Debug Log for the one pre-existing, out-of-scope lint error and the one lint-driven design correction made during implementation).

### File List

- `src/repositories/location-repository.ts` — modified: `subscribeToLocations()` gains an optional `onStatusChange` callback.
- `src/repositories/__tests__/location-repository.test.ts` — modified: new tests for the status callback.
- `src/shared/hooks/use-live-locations.tsx` — modified: new `isConnected` field.
- `src/shared/hooks/__tests__/use-live-locations.test.tsx` — modified: updated `subscribeToLocations` call assertions for the new third argument; new `isConnected` tests.
- `src/shared/services/outbox/outbox.ts` — new.
- `src/shared/services/outbox/__tests__/outbox.test.ts` — new.
- `src/app/active-voyage.tsx` — modified: "Reconnecting…" HUD note, `catch` added to `handleGrantOrganizer`/`handleRemoveVoyager`, network-failure classifier + outbox enqueue on all three write handlers, second `Toast` render site, flush-on-mount/reconnect effects.
- `src/app/__tests__/active-voyage.test.tsx` — modified: `isConnected` added to all `useLiveLocations` mock fixtures, outbox mocked, new tests for the reconnecting note, network-failure enqueueing, and flush-triggered success/conflict dispatch.

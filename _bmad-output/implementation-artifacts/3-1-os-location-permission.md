---
baseline_commit: aa00c3e924f4b7fc51fcdb1ef4038a163becb0da
---

# Story 3.1: OS Location Permission

Status: review

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a Voyager,
I want to grant Voylo location access,
so that the app can show me and my group on a live map.

## Acceptance Criteria

1. **Given** I just started or joined a Voyage, **when** the app needs location, **then** an app-authored priming screen explains why before the native OS dialog appears.
2. **And** choosing "Always Allow" enables background updates; choosing less shows a full-bleed explainer with a link to Settings, and my marker doesn't render for others until resolved.

*(Fulfills UX-DR26, supports FR-9.)*

**🚫 Known interim-scope decisions (not silent gaps — see Dev Notes for full rationale on each):**

- **This story is the OS-permission-request flow only.** There is no Live Map yet (`active-voyage.tsx` is still Epic 2's placeholder; Story 3.2 builds the real map). "My marker doesn't render for others until resolved" is a *consequence* Story 3.2's map-rendering logic will actually implement once markers exist — this story's job is to get the OS permission decided and the two required screens (priming, explainer) built and correctly reachable, not to touch marker rendering that doesn't exist yet.
- **The explainer is a one-time landing after the OS dialog, not a persistent lockout.** EXPERIENCE.md is explicit that this is "not a punitive lockout screen." Once a Voyager has been through priming → OS request → (if needed) the explainer, they proceed to their active Voyage regardless of the final permission level. This story does not re-show the explainer on every subsequent app open just because permission is still less than "Always" — Story 3.2/3.5 own any ongoing, in-Voyage degraded-state messaging.
- **No continuous/background monitoring of permission revocation is built here.** The AC's flow is about the *first* ask. A Voyager who revokes permission mid-trip via OS Settings is a live-map-rendering concern (Story 3.2) or a connectivity/reconnection concern (Story 3.5), not this story's.

## Tasks / Subtasks

- [x] Task 1: Add `expo-location` and configure the plugin (AC: #1, #2)
  - [x] Ran `npx expo install expo-location` — SDK-57-resolved version added to `package.json`/`package-lock.json`.
  - [x] Added the `expo-location` config plugin to `app.json`'s `expo.plugins` array with `locationAlwaysAndWhenInUsePermission`, `isIosBackgroundLocationEnabled: true`, `isAndroidBackgroundLocationEnabled: true`, `isAndroidForegroundServiceEnabled: true`.
  - [x] Appended to the existing `plugins` array (expo-router, expo-splash-screen, @sentry/react-native all preserved unchanged) — read the file first, did not clobber anything.

- [x] Task 2: `useLocationPermission()` — live OS permission status, not app/DB state (AC: #1, #2)
  - [x] New `src/shared/hooks/use-location-permission.tsx`: `LocationPermissionProvider`/`useLocationPermission()`, fetch-on-`userId`-change pattern matching `use-active-voyage.tsx`/`use-removal-notice.tsx`, fetching `Location.getForegroundPermissionsAsync()` directly (no repository layer).
  - [x] Exposes `{ status, isLoading, hasError, refetch, hasCompletedPriming, markPrimingComplete }`. `status` maps `expo-location`'s `PermissionStatus` enum to `'undetermined' | 'granted' | 'denied'`.
  - [x] `hasCompletedPriming`/`markPrimingComplete()` implemented as plain in-memory `useState` — no persistence.
  - [x] Wrapped `AppNavigator` with `LocationPermissionProvider` in `_layout.tsx`; `isLoading` gate extended a fourth time. 6/6 new tests passing; `tsc --noEmit` clean.

- [x] Task 3: `location-permission.tsx` — priming, request, and (if needed) explainer, all as one screen (AC: #1, #2)
  - [x] New `src/app/location-permission.tsx`. Local state machine (`'priming' | 'requesting' | 'explainer'`), same shape as `active-voyage.tsx`'s End Voyage confirm-swap.
  - [x] Priming state: headline + supporting copy per EXPERIENCE.md's framing, one `IgnitionButton` ("Allow Location") kicking off the request sequence.
  - [x] Requesting: `requestForegroundPermissionsAsync()` → if not granted, straight to Explainer; if granted, `requestBackgroundPermissionsAsync()` immediately after (platform divergence documented in-code, flagged for Task 5 live verification).
  - [x] Explainer: shown only when the final result is short of full background grant; "Open Settings" (`Linking.openSettings()`) and "Continue anyway", both calling `markPrimingComplete()` — neither is a lockout.
  - [x] Full "Always" grant calls `markPrimingComplete()` directly, no Explainer shown.
  - [x] Not built on `OnboardingAcknowledgment` (too much internal state), typography kept consistent with it. 6/6 new tests passing.

- [x] Task 4: Wire the new routing branch into `_layout.tsx` (AC: #1, #2)
  - [x] `resolveRoute()` untouched.
  - [x] New `needsLocationPermission = hasActiveVoyage && locationPermissionStatus === 'undetermined' && !hasCompletedPriming`, splitting the existing `hasActiveVoyage` branch into two (`location-permission` vs `active-voyage`) rather than adding a fifth sibling `home`-scoped concern.
  - [x] `location-permission` registered inside its own guard branch, matching `voyage-removed`'s reasoning.
  - [x] `_layout.tsx`'s own precedence-explaining comment block updated to describe the new branch. `tsc --noEmit` clean.

- [x] Task 5: Live verification (AC: #1, #2)
  - [x] **Attempted and confirmed blocked.** No EAS CLI available in this environment (`npx eas whoami` fails to resolve an executable) and no physical iOS/Android device attached. Background location and the plugin's native config genuinely cannot be exercised in Expo Go, and no dev build could be produced or installed here — consistent with AD-8's own note, same disclosure standard as every Epic 2 story's Supabase-CLI blocker. The iOS/Android on-device flow, the platform-divergent background-permission behavior, and the "fires once per device" persistence across app restarts are all UNVERIFIED and need a real device + dev build before this ships.
  - [ ] Confirm the "fires once per device" behavior: force-quit and reopen the app after granting/denying — the priming screen must not reappear (gate correctly reads OS status as no longer `undetermined`).
  - [ ] If a dev build isn't available/buildable in this environment, say so plainly in the Dev Agent Record, same standard as every prior story's Supabase-CLI disclosure.

## Dev Notes

- **No new `profiles` column, and no `AsyncStorage`, for "has this device seen the priming flow."** The architecture's own principle (already applied identically in Story 2.6 for OS-adjacent state) is that live, OS-owned state must never be duplicated into app storage, because the app's copy can silently drift from the OS's ground truth (e.g., a user revokes permission in Settings — a DB flag would have no way to know). `expo-location`'s own permission status (`undetermined` → `granted`/`denied`, persisted by the OS itself, surviving across app sessions) already *is* the "once per device" memory EXPERIENCE.md's State Patterns text calls for — using it directly, rather than shadowing it with a second flag, is both simpler and strictly more correct. This is a deliberate divergence from Trust Moment/Driver Consent's `profiles`-column pattern, not an oversight — those two are genuine account-level, app-owned "have I shown this person this copy yet" flags with no OS equivalent; this one has a perfect OS equivalent already.
- **The one piece of state that *is* new and in-memory (`hasCompletedPriming`) exists only to prevent the screen's own status-changing side effects from prematurely flipping `_layout.tsx`'s guard mid-flow.** The moment `requestForegroundPermissionsAsync()` resolves, OS status is no longer `undetermined` — if `_layout.tsx`'s guard read raw OS status alone, it would try to navigate away from `location-permission.tsx` before the background request or explainer had even been shown, cutting the flow short. This is the same class of timing hazard Story 2.3's code review found in `join/[code]`, caught here proactively before writing any navigation code, not after a live failure.
- **Read `active-voyage.tsx` before writing `location-permission.tsx`.** It's this codebase's only existing precedent for a screen with more than one internal view-state driven by local `useState` rather than separate routes (its End Voyage confirm-swap) — copy that shape, don't invent a new one.
- **Read `_layout.tsx`'s full current guard-branch structure and its own extensive comments before adding the fifth branch.** Four session-scoped decisions (`hasActiveVoyage`, `hasRemovalNotice`, `hasPendingJoin`, and now `needsLocationPermission`) all layer on top of `resolveRoute()`'s `'home'` result; get the ordering right relative to the existing three, and update the file's own precedence-explaining comment block to include the new branch rather than leaving it undocumented.
- **This story cannot be meaningfully live-verified without an EAS development build**, per AD-8's own note that background location and native config don't work in Expo Go. Flag this honestly in the Dev Agent Record if a build isn't actually produced/tested during this story's implementation, same discipline as every Epic 2 story's Supabase-CLI disclosure.
- **Platform divergence on background permission is expected, not a defect to "fix."** Research going into this story could not fully confirm Android's exact `requestBackgroundPermissionsAsync()` behavior on modern Android versions (it may not show any native dialog at all, relying entirely on the Settings-link explainer path). Task 3/5 are written to make this an expected, handled branch rather than something the implementer discovers as a surprise mid-task.
- **Testing `expo-location`: this is the first story needing per-test control over a native permission API's resolved values (granted/denied/undetermined).** Whether or not `jest-expo`'s preset auto-mocks the module for basic non-crashing render, tests here need to *control* what `getForegroundPermissionsAsync`/`requestForegroundPermissionsAsync`/`requestBackgroundPermissionsAsync`/`getBackgroundPermissionsAsync` each resolve to per-test-case (same reason `expo-router`'s `router.push` is hand-mocked per test file throughout this codebase, not left to preset defaults). Use an explicit `jest.mock('expo-location', () => ({ PermissionStatus: { GRANTED: 'granted', DENIED: 'denied', UNDETERMINED: 'undetermined' }, getForegroundPermissionsAsync: jest.fn(), requestForegroundPermissionsAsync: jest.fn(), getBackgroundPermissionsAsync: jest.fn(), requestBackgroundPermissionsAsync: jest.fn() }))` at the top of every test file that touches this hook or screen.

### Project Structure Notes

- `package.json` / `package-lock.json` — `expo-location` added as a new dependency (via `npx expo install`, not hand-edited).
- `app.json` — `expo-location` config plugin added to `expo.plugins`.
- `src/shared/hooks/use-location-permission.tsx` is a new file, new provider, mounted in `_layout.tsx` alongside the other four.
- `src/app/location-permission.tsx` is a new Expo Router route.
- `src/app/_layout.tsx` — modified: new provider wrapper, `isLoading` gate extended a fourth time, new guard branch gating `hasActiveVoyage`'s existing `active-voyage` branch.

### References

- [Source: epics.md#Story-3.1] — acceptance criteria as originally scoped; Epic 3's own scoping note deferring the notification-permission priming screen to Epic 4
- [Source: prd.md#FR-9] — the Live Map functional requirement this story is a prerequisite for; PRD §5.4's privacy constraint (location data never sold/shared) underlying the priming copy's trust framing
- [Source: EXPERIENCE.md#Foundation] — "Continuous location access is a hard requirement... its trust framing is load-bearing enough to get its own section"
- [Source: EXPERIENCE.md#State-Patterns] — the two rows this story implements verbatim: the priming/request flow's exact copy and trigger points, and the "Location permission denied/revoked... not a punitive lockout screen" row
- [Source: EXPERIENCE.md#Key-Flows] — UJ-1 step 8a (Organizer, fires after Destination Picker confirm) and UJ-2 step 5b (Joiner, fires after first-ever OTP Verify/Driver Consent) as the two entry points this story's routing must correctly reach regardless of which path got the user there
- [Source: architecture/ARCHITECTURE-SPINE.md#AD-8] — background location capability rule (`expo-location` + `expo-task-manager`, Android 14+ foreground-service-type is Story 3.3's concern not this one), the Expo Go/dev-build limitation, and the Deferred section's App Store/Play Store review-scrutiny risk note
- [Source: architecture/ARCHITECTURE-SPINE.md#AD-3] — confirms no separate persisted location-permission-status column exists or should exist in the data model (`voyage_member_locations` only stores actual position, not permission state)
- [Source: 2-5-grant-organizer-status.md, 2-6-remove-voyager.md] — the repeated, reaffirmed precedent this story applies once more: session-scoped UI-state layers on top of `resolveRoute()`'s `'home'` result, never folded into `resolveRoute()` itself
- [Source: 1-4-trust-moment.md, 1-5-driver-attention-consent.md] — `OnboardingAcknowledgment`'s shape and the account-level `profiles`-column pattern, explicitly NOT reused here for the priming-seen flag (see Dev Notes) but still the tonal/copy precedent this story's priming and explainer screens should match

## Dev Agent Record

### Agent Model Used

Claude Sonnet 5 (claude-sonnet-5)

### Debug Log References

- `npx eas whoami` fails to resolve an executable in this environment, and no physical iOS/Android device is attached — Task 5's live device verification could not be performed. Documented plainly rather than assumed passing, same standard as every Epic 2 story's Supabase-CLI disclosure.
- `ARCHITECTURE-SPINE.md`'s Stack table says `expo-location` is "compatible with Expo SDK 56" — stale; `npx expo install expo-location` resolved a version against the repo's actual Expo `~57.0.8`, which is what was trusted, not the stale doc line (flagged explicitly in the story's own Task 1 guidance before implementation started).
- Deliberately did not add any DB column or `AsyncStorage` flag for "has this device seen the priming screen" — reused `expo-location`'s own OS-persisted permission status (`undetermined` → `granted`/`denied`) as that memory directly, per the architecture's established device-vs-account-state boundary (see story Dev Notes).

### Completion Notes List

- All 5 tasks complete. AC1 (priming screen before the native OS dialog) and AC2 (Always Allow enables background; anything less shows the full-bleed explainer with a Settings link) are both implemented and unit-tested; the "marker doesn't render for others" half of AC2 is explicitly out of this story's scope (no map exists yet — Story 3.2's job), per the story's own documented interim-scope decision.
- Full test suite: 25 suites / 212 tests passing. This story added 12 new tests: 6 for `useLocationPermission()`, 6 for `location-permission.tsx`.
- `npx tsc --noEmit` clean. `npm run lint` has one pre-existing, out-of-scope failure in `src/app/sign-in.tsx` (Story 1.3, `react-hooks/refs`) — untouched by this story.
- Task 5 live verification is UNVERIFIED — no EAS CLI or physical device available in this environment. The on-device priming/request/explainer flow, the iOS-vs-Android background-permission divergence, and the "fires once per device" persistence across app restarts all still need hands-on confirmation on a real dev build before this ships.

### File List

- `package.json` / `package-lock.json` (modified — `expo-location` dependency added)
- `app.json` (modified — `expo-location` config plugin added)
- `src/shared/hooks/use-location-permission.tsx` (new)
- `src/shared/hooks/__tests__/use-location-permission.test.tsx` (new)
- `src/app/location-permission.tsx` (new)
- `src/app/__tests__/location-permission.test.tsx` (new)
- `src/app/_layout.tsx` (modified — new provider wrapper, `isLoading` gate extended a fourth time, `hasActiveVoyage` branch split by `needsLocationPermission`)

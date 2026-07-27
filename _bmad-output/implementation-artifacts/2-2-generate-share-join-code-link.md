# Story 2.2: Generate & Share Join Code/Link

Status: ready-for-dev

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As an Organizer,
I want a shareable Join Code/Link for my Voyage,
so that I can invite others.

## Acceptance Criteria

1. **Given** I just started a Voyage, **when** Destination Picker confirms, **then** a Join-code card appears immediately (as its own full-screen destination — see Dev Notes on why this isn't a modal/overlay yet) with a tap-to-copy code and a share action opening the OS share sheet.
2. **When** I tap the code, **then** it's copied to the clipboard (the raw code itself, for the case where someone types it in rather than tapping a link — Story 2.3 will need a "enter a code" path too).
3. **When** I tap the share action, **then** the OS share sheet opens with a message containing the full Join Link (not just the bare code — a shared code with no link isn't actionable the same way).
4. **Given** the same Voyage, **when** the Join Code/Link is generated, **then** it stays valid for the Voyage's full duration and never rotates — trivially true by construction (nothing in this story or any other story ever updates it once set at creation).
5. **This story does NOT yet satisfy** "opening it without the app installed redirects to the App Store/Play Store" — see the release-blocker note below. Confirmed with the user directly before writing this story (no domain registered yet, same blocker as Story 1.2's Resend email domain).

*(Fulfills FR-4; UX-DR12, AD-10 — partially: AD-10 specifies a true universal/app link; this story ships the interim custom-scheme approach, see below.)*

**🚫 Known release-blocker (confirmed with the user, not a silent gap):** AD-10 requires a true universal/app link (iOS Associated Domains + Android App Links, both requiring a real domain you control with hosted verification files: `apple-app-site-association`, `assetlinks.json`, plus a fallback web page for the App Store/Play Store redirect). **No domain is registered yet.** Per the user's explicit choice, this story uses `voylo://join/<code>` — a custom URL scheme (already configured in `app.json`'s `"scheme": "voylo"` since Story 1.1) — as the interim mechanism: tapping the link works correctly when the app is installed (Expo Router / the OS resolves the custom scheme), but there is **no automatic App Store/Play Store fallback** if it isn't. Add this to `deferred-work.md` as a release blocker once implemented, same framing as the Resend domain gap: real universal links (and the store-redirect behavior AC5 describes) are a config/infrastructure change once a domain exists, not a code rewrite — `Linking.createURL()` (used throughout this story) will produce `https://` URLs automatically once `app.json` is updated with a real domain, no call-site changes needed.

## Tasks / Subtasks

- [ ] Task 1: `join_code` column + `start_voyage()` RPC extension (AC: #1, #4)
  - [ ] New migration: add a nullable `join_code text unique` column to `public.voyages`. **Nullable, not `not null`, is a deliberate choice** — the RPC below always sets it for any voyage created going forward, so a hard `not null` constraint adds no real safety, but *would* require cleaning up or backfilling the handful of pre-existing dev-sandbox test rows from Story 2.1's own live verification (e.g. the "Lake Tahoe" row), which isn't worth the migration complexity for rows that are themselves just test artifacts. `unique` still applies (Postgres allows multiple `NULL`s under a unique constraint, so old rows with no code don't conflict with new ones that have one).
  - [ ] Extend `start_voyage()` (new `create or replace function`, same `security definer` shape Story 2.1's code review established) to generate an 8-character code from a safe, unambiguous alphabet (excludes `0/O`, `1/I/L` — e.g. `23456789ABCDEFGHJKMNPQRSTUVWXYZ`, 32 symbols, ~2^40 code space) and include it in the same `insert into voyages (...)` the function already does — no second write, stays inside the existing one-transaction guarantee.
  - [ ] Wrap the code generation + insert in a retry loop (cap at 5 attempts, regenerating the code on `unique_violation` before giving up with a clear error) — the collision odds are negligible at this scale, but a cheap, bounded retry is correct defensive practice given this project's now-established "verify, don't assume, for anything RLS/constraint-adjacent" discipline from Story 2.1's two live-caught bugs.
  - [ ] Apply locally via `supabase db push` against `voylo-dev` before relying on CI.
  - [ ] No new RLS policy needed — `join_code` is just another column on `voyages`, already covered by the existing `voyages_select_members` policy (only active members, i.e. the organizer who just created it, can read it back). **A non-member reading a voyage by its `join_code` (Story 2.3's actual join flow) is explicitly out of scope here** — that needs its own security-definer lookup function scoped to exactly what a non-member needs to see (destination, organizer name maybe, not the full row), which is Story 2.3's design problem, not this one's.

- [ ] Task 2: `Voyage` type + repository update (AC: #1)
  - [ ] Add `joinCode: string | null` to the `Voyage` type in `src/repositories/voyage-repository.ts`, mapped from `join_code` at the repository boundary, same camelCase convention as every other field. No new repository function needed — `startVoyage()` already returns the full row via the RPC, now including the code.

- [ ] Task 3: Add `expo-clipboard` dependency (AC: #2) — **new dependency, flagged explicitly rather than silently added**
  - [ ] `npx expo install expo-clipboard` — a first-party Expo SDK package (not a third-party library), zero native-linking complexity beyond Expo's managed workflow, the standard/only reasonable choice for clipboard write access in an Expo-managed app (React Native core no longer ships a Clipboard API). Use `Clipboard.setStringAsync(code)`.

- [ ] Task 4: Design tokens for the Join-code card (AC: #1)
  - [ ] Add `Typography.statNumeral` (Space Mono, 32px, `1.0` line-height ratio, `-0.01em` letter-spacing converted to RN's absolute-point units per Story 2.1's precedent) — DESIGN.md specifies the code itself renders in this token.
  - [ ] Add `Rounded.xl` (36px) — DESIGN.md ties this radius specifically to "the two hero surfaces (the Voyage Intro panel, the Join-code card)."
  - [ ] Add a `JoinCodeCard` composite token (mirroring `ButtonIgnition`'s existing pattern): background `linear-gradient(160deg, surfaceDuskHigh, surfaceMidnight)`, radius `xl`, glow `0 0 40px accentViolet at 40% opacity` (React Native doesn't support CSS gradients directly — use `expo-linear-gradient`, already a dependency since `IgnitionButton` uses it, for the card background; the glow needs a platform-appropriate shadow, see Dev Notes).

- [ ] Task 5: Join-code screen (AC: #1, #2, #3)
  - [ ] Create `src/app/join-code.tsx`, receiving the just-created Voyage's `destination` and `joinCode` via Expo Router navigation params (no new fetch/hook — the data already exists in hand right after `startVoyage()` succeeds; see Dev Notes on why this doesn't need a `useVoyage`-style provider yet).
  - [ ] Construct the full link via `Linking.createURL('/join/' + joinCode)` from `expo-linking` (respects `app.json`'s configured `scheme` automatically, and will start producing real `https://` universal links with zero call-site changes once a real domain is configured — this is exactly why `Linking.createURL` is used instead of manually string-concatenating `voylo://join/${code}`).
  - [ ] Render the `join-code-card` treatment (per Task 4's tokens) with the code in `stat-numeral`. Tapping the code copies it (`expo-clipboard`, Task 3) and shows a brief inline confirmation (dev agent's call on exact micro-copy/treatment — e.g. a transient "Copied" label — not specified in DESIGN.md/EXPERIENCE.md, flag as a judgment call).
  - [ ] A share button uses React Native's built-in `Share.share({ message })` (from `'react-native'` — no new dependency; DESIGN.md only calls for "opens the OS share sheet," which this API does directly). Message content: dev agent's call on exact wording (e.g. `"Join my Voyage to ${destination} on Voylo: ${link}"`) since no locked copy exists for this specific string in DESIGN.md/EXPERIENCE.md — flag as a judgment call.
  - [ ] Tests (`src/app/__tests__/join-code.test.tsx`): renders the passed-through code/destination; tapping the code calls `Clipboard.setStringAsync` with the raw code; tapping share calls `Share.share` with a message containing the constructed link.

- [ ] Task 6: Wire Destination Picker to the new screen (AC: #1)
  - [ ] Change `destination-picker.tsx`'s success path: instead of `router.push('/')` (Story 2.1's explicit, disclosed interim landing), navigate to `/join-code` passing the created Voyage's `destination` and `joinCode` as params. This is exactly the "next story inserts itself into the path" pattern already used twice (Trust Moment → Driver Attention Consent; now Destination Picker → Join-code card) — Epic 3's eventual Live Map will change this destination again when it exists.
  - [ ] Update `destination-picker.test.tsx`'s "navigates to Home on successful creation" test to assert navigation to `/join-code` with the right params instead.

- [ ] Task 7: Live verification (AC: #1, #4) — same real-signal standard as every prior story
  - [ ] Sign in as a real test account (reuse a still-valid session if within its 1-hour lifetime, matching Story 2.1's Task 7 lesson about avoiding unnecessary OTP requests).
  - [ ] Since this test account already has an active Voyage from Story 2.1's own live verification, either confirm `join_code` was already backfilled by re-running `start_voyage()` isn't possible (AD-9 blocks a second voyage) — instead verify via a direct `GET /rest/v1/voyages?select=join_code` that the existing row's `join_code` is `null` (expected: it predates this story's migration) and confirm the RPC's *code path* is correct by reading the migration/function definition plus a targeted SQL-level test (e.g. `select public.start_voyage('Test')` would fail on AD-9 for this account, so directly unit-test the code-generation expression in isolation via `supabase db query --linked` instead, or use a fabricated user id the same way Story 1.5's code review verified `mark_driver_consent_seen`'s rejection path).
  - [ ] Confirm the generated code matches the expected alphabet/length via direct inspection.
  - [ ] Document the exact verification approach and results in the Dev Agent Record. Delete any temp files/tokens after.

## Dev Notes

- **This story ships a real, working feature with one clearly-scoped, user-confirmed gap (AC5), not a silently incomplete one.** The custom-scheme interim approach was discussed directly with the user before writing this story (same pattern as Story 1.2's Resend domain conversation) — they chose it explicitly over blocking this story on domain registration. Log the gap to `deferred-work.md` once implemented, matching the Resend domain entry's tone and specificity (what's missing, why, and exactly what changes once a domain exists).
- **Join-code card is a full screen (`/join-code`), not a modal/overlay, even though EXPERIENCE.md's fuller UJ-1 description implies a "cut... into the Join-code card, then onto Live Map" (i.e., eventually an overlay on top of Live Map).** Live Map doesn't exist yet (Epic 3), and the Organizer Sheet (the other place EXPERIENCE.md says the card is reachable from) doesn't exist yet either. A full-screen interim treatment is the same "build what this story needs, let the surrounding flow catch up later" precedent already used for Trust Moment (landed on Home before Driver Consent existed) and Destination Picker (landed on Home before this story existed). Flag as a judgment call in case reviewers disagree on whether a modal-over-Home would have been closer to spec intent.
- **No `useVoyage`/provider hook built.** The Join-code screen receives its data via navigation params from the screen that just created the Voyage, not a fetch. Same reasoning Story 2.1 used to justify not building shared Voyage state yet — nothing else in the app needs it cross-screen at this point.
- **`join_code` generation lives inside `start_voyage()`, not a trigger.** This project has no triggers anywhere in the Voyage schema yet (Story 2.1 explicitly deferred the one place a trigger would make sense — syncing `voyage_members.is_active` on `voyages.status` change — to Story 2.4). Keeping code generation in the same explicit RPC matches that established "logic lives in RPCs, not triggers" precedent rather than introducing a new pattern mid-epic.
- **The `join-code-card`'s violet glow needs a real shadow implementation, not just a token value.** `ButtonIgnition`'s glow (`box-shadow` in the web mockup CSS) doesn't have a React Native equivalent this codebase has built yet — check whether `IgnitionButton`'s existing implementation actually renders its own `glow` value anywhere (a quick grep before starting suggests it may currently only exist in the token, unused in the component) before assuming a working pattern to copy. If it's unused there too, this story's card can use a simple `shadowColor`/`shadowOpacity`/`shadowRadius` (iOS) + `elevation` (Android) combination as a reasonable approximation — flag as a judgment call, not a blocker.
- **Alphabet/length choice for `join_code` (8 chars, 32-symbol safe alphabet) is a reasonable default, not a locked spec value** — DESIGN.md specifies the *display* treatment (`stat-numeral`) but not the exact code format. Flagged so a reviewer can push back if a different length/format is wanted.

### Project Structure Notes

- `supabase/migrations/` gets one new file (column + RPC replacement, no new table).
- `src/repositories/voyage-repository.ts` — `joinCode` field added to the existing `Voyage` type, no new file.
- `src/app/join-code.tsx` is a new Expo Router route.
- `src/app/destination-picker.tsx` — success-path navigation target changed (modified, not rewritten).
- `package.json` gains `expo-clipboard` as a new dependency.

### References

- [Source: epics.md#Story-2.2] — acceptance criteria as originally scoped
- [Source: prd.md#FR-4] — functional requirement
- [Source: ARCHITECTURE-SPINE.md#AD-10] — universal/app-link requirement; this story's interim-scheme deviation and why
- [Source: EXPERIENCE.md#Information-Architecture] — Join-code / Share Card row (auto-shown timing, reachable-anytime-via-Organizer-Sheet note that motivated the "not a modal yet" Dev Note)
- [Source: EXPERIENCE.md#Component-Patterns] — Join-code card: tap-to-copy, share-opens-OS-sheet, "one code per Voyage, never rotates"
- [Source: DESIGN.md#Components] — `join-code-card` token spec (gradient, radius, glow), `stat-numeral` typography
- [Source: DESIGN.md#Shapes] — `xl` (36px) radius tied specifically to this card
- [Source: 2-1-start-a-voyage.md] — everything this story builds directly on: `start_voyage()`'s existing atomic-creation shape (now extended, not replaced), `voyageRepository`/`Voyage` type conventions, the `security definer` RLS lesson from that story's code review (this story's RPC replacement keeps the same security posture), and the explicit "Destination Picker lands on Home for now" interim this story changes.
- [Source: 1-2-email-otp-sign-in.md] — the Resend-domain precedent this story's release-blocker framing directly follows

## Latest Technical Specifics (web-verified at story-creation time)

- **`expo-clipboard`'s `setStringAsync`** is the current (SDK 53+) API for clipboard writes in Expo-managed apps; React Native core deprecated and removed its own `Clipboard` module years ago. No special permissions needed on iOS/Android for basic string clipboard writes.
- **`Linking.createURL(path)` from `expo-linking`** builds a scheme-correct deep link using whatever `scheme` is configured in `app.json` (`"voylo"` here) during development/custom builds, and is the same API that transparently produces `https://` universal-link URLs once `associatedDomains`/`intentFilters` are configured for a real domain — confirmed via Expo's own Linking documentation. This is why it's used here instead of manual string concatenation: the eventual domain migration (AD-10's full requirement) needs zero call-site changes in this file.
- Source consulted: [Expo Clipboard docs](https://docs.expo.dev/versions/latest/sdk/clipboard/), [Expo Linking docs](https://docs.expo.dev/versions/latest/sdk/linking/).

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List

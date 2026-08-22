---
stepsCompleted: [1, 2, 3]
inputDocuments:
  - _bmad-output/planning-artifacts/prds/prd-trips-2026-07-25/prd.md
  - _bmad-output/planning-artifacts/architecture/architecture-trips-2026-07-25/ARCHITECTURE-SPINE.md
  - _bmad-output/planning-artifacts/ux-designs/ux-trips-2026-07-25/DESIGN.md
  - _bmad-output/planning-artifacts/ux-designs/ux-trips-2026-07-25/EXPERIENCE.md
---

# Voylo - Epic Breakdown

## Overview

This document provides the complete epic and story breakdown for Voylo, decomposing the requirements from the PRD, UX Design (DESIGN.md + EXPERIENCE.md), and Architecture (ARCHITECTURE-SPINE.md) into implementable stories.

## Requirements Inventory

### Functional Requirements

FR-1: A user can authenticate using their email and a one-time code, with no password (email OTP sign-in).
FR-2: An authenticated user remains signed in until they explicitly sign out (persistent session; global sign-out revokes all devices per architecture AD-4).
FR-3: An authenticated user (the first Organizer) can create and start a new Voyage with a single destination.
FR-4: An Organizer can obtain a shareable Join Code/Link for an active Voyage.
FR-5: Any user can join an active Voyage using a valid Join Code/Link, no Organizer approval required.
FR-6: An Organizer can manually end an active Voyage (a checkpoint, not a hard cutoff — in-flight captures finish; never auto-triggered on arrival).
FR-7: An Organizer can grant Organizer status to another Voyager (a Voyage can have more than one Organizer).
FR-8: An Organizer can remove a Voyager from an active Voyage.
FR-9: Any Voyager can view all Voyagers' live locations on one shared, game-like map for the active Voyage.
FR-10 (v1.1): Any Voyager can manually log a spotting (police, deer, construction, etc.) with a single tap.
FR-11 (v1.1): The system automatically detects and logs qualifying events (long stops, border crossings) without requiring Voyager action.
FR-12 (v1.1): Any Voyager can attach a photo to a moment during the Voyage.
FR-13 (v1.1): The system shows a first-time Voyager a single, dismissible contextual tip the first time a relevant feature becomes newly relevant.
FR-14 (v1.1): The system generates a Memory Lane highlight experience when a Voyage ends.
FR-15 (v1.1): All Voyagers on a completed Voyage can view and revisit its Memory Lane.
FR-16 (v1.1): Any Voyager can share their Voyage's Memory Lane to external platforms (gated by per-Voyager consent for content featuring them).
FR-17 (v1.1): Any Voyager can browse a list of their own past (ended) Voyages and search it by destination name; selecting one opens its Memory Lane. Added via Sprint Change Proposal 2026-08-10.

### NonFunctional Requirements

NFR1 (Performance): Live map location updates must feel real-time without materially degrading device battery life over a multi-hour drive.
NFR2 (Reliability): Core Voyage lifecycle (start, join, live tracking, end) must degrade gracefully through cellular dead zones — a connectivity drop must not silently lose a Voyager from the map or corrupt Voyage state.
NFR3 (Security): OTP-based session tokens must be stored and transmitted securely; a compromised session must be revocable (sign-out on all devices).
NFR4 (Reliability - Auth): OTP delivery must be reliable and timely enough not to break the "frictionless" sign-in promise.
NFR5 (Quality - Auto-detection): Automatic event detection (FR-11) must be validated for an acceptably low false-positive rate before wide release.
NFR6 (Performance - Sharing): Share-asset generation (FR-16) must be fast enough not to break the emotional momentum of the moment.
NFR7 (Accessibility): VoiceOver/TalkBack support on every map marker and HUD element; dynamic type reflow without truncation; Reduce Motion alternatives for marker pulse/animated gradients; tap targets ≥44pt(iOS)/48dp(Android), ≥60pt/dp for the manual Fun Fact control; live/active state never communicated by color alone; notifications audio/haptic-redundant, not visual-only.
NFR8 (Contrast): `button-ignition` label text must clear WCAG AA 4.5:1 against its gradient background (requires a text scrim per DESIGN.md); `hud-card` must guarantee ≥85% effective scrim opacity against the live map background regardless of device or map brightness.

### Additional Requirements

**Starter Template:** No named starter/boilerplate kit — greenfield Expo (SDK 56, managed workflow) project with Expo Router, initialized fresh (e.g. via `npx create-expo-app`). This is the Epic 1 / Story 1.1 foundation.

Architecture (ARCHITECTURE-SPINE.md) requirements affecting implementation:

- **Paradigm:** BaaS-centric layered architecture — Screens/Features → Shared hooks/services → Repository layer → Supabase SDK. No screen/feature calls the Supabase SDK directly.
- **AD-1 (RLS data boundary):** All Voyage-related tables use Postgres Row-Level Security keyed on a single shared predicate function `is_active_voyage_member(voyage_id, user_id)` (requires `removed_at IS NULL` and Voyage `status = 'active'`). No application-layer-only authorization.
- **AD-2 (Realtime):** Supabase Realtime is the sole live-delivery mechanism; exactly one Realtime channel per active Voyage, managed through the repository layer.
- **AD-3 (Location persistence):** Live position is broadcast ephemerally, never persisted per-ping. Only one latest-known-location row per Voyager (`voyage_member_locations`, upserted), with a conditional upsert guard (`WHERE updated_at < EXCLUDED.updated_at`) to prevent stale overwrites.
- **AD-4 (Auth session):** One shared auth context/hook wraps Supabase Auth (email OTP). Global sign-out via `supabase.auth.signOut({ scope: 'global' })` satisfies session revocation.
- **AD-5 (Repository layer):** Every table has exactly one owning repository module (1:1 mapping); no screen/hook calls the Supabase SDK directly.
- **AD-6 (Environments):** Three environments (dev/staging/prod), each its own Supabase project and EAS build profile. Promotion pipeline: merge to `main` → dev migrations + `development` EAS build (automatic); staging/prod → tagged release or manual dispatch.
- **AD-7 (Offline resilience):** Client-side write-outbox for Voyage lifecycle writes attempted offline; per-item flush (not FIFO-blocking); precondition snapshot per queued write; typed conflict event on stale precondition. Location pings are explicitly excluded from the outbox (governed by AD-3/AD-8 instead).
- **AD-8 (Background location):** `expo-location` (background mode) + `expo-task-manager`; Android 14+ requires explicit `location` foreground-service-type declaration; requires an EAS development build (not Expo Go) for testing; Mapbox native SDK pinned to v11.
- **AD-9 (One active Voyage per user):** Enforced via a denormalized, trigger-maintained `is_active` boolean on `voyage_members` plus a partial unique index `(user_id) WHERE removed_at IS NULL AND is_active = true`.
- **AD-10 (Deep-linking):** Join Code/Link uses Expo Router universal/app-links (not a bare URI scheme); redirects to App/Play Store if uninstalled, opens directly to Join Invitation if installed.
- **Entities:** `users` (Supabase auth), `profiles` (user_id, trust_moment_seen_at, driver_consent_seen_at), `push_tokens` (user_id, expo_push_token, updated_at), `voyages` (id, destination, status, created_by, created_at, ended_at), `voyage_members` (id, voyage_id, user_id, role, joined_at, removed_at, is_active), `voyage_member_locations` (voyage_member_id, lat, lng, updated_at).
- **Stack:** React Native/Expo SDK 56, Expo Router, TypeScript, EAS Build/Submit/Update, Supabase (Postgres/Auth/Realtime/Storage/Edge Functions), Mapbox (`@rnmapbox/maps`, SDK v11), Expo Notifications, `expo-location` + `expo-task-manager`, GitHub Actions, Sentry (React Native SDK).
- **One-time manual setup (not code-automatable, needed before Epic 1 can ship):** Supabase (×3 projects), Mapbox, GitHub, Sentry account creation; Apple Developer Program + Google Play Developer enrollment; iOS Time-Sensitive notification entitlement request.
- **Push notifications:** Delivery dispatched through a Supabase Edge Function keyed off `push_tokens`; iOS requests Time-Sensitive interruption level, Android a priority channel able to bypass Focus/DND.

### UX Design Requirements

**Design tokens (DESIGN.md):**

UX-DR1: Implement the full "Night Drive" color system as design tokens — dark-mode-primary palette (midnight/dusk/dusk-high/glass surfaces, ink primary/secondary/disabled, 4 semantic accents: ignition coral, electric teal, gold, violet) plus a full parallel Daylight (light-mode) palette, plus 8 fixed per-Voyager player colors with separate Daylight variants for each.
UX-DR2: Implement the 3-typeface type system as tokens: Clash Display (`display-hero` 40px, `display` 28px — rationed to Voyage Intro/Join/Memory Lane only), General Sans (`headline` 20px, `body` 16px, `body-sm` 14px, `label` 13px, `caption` 12px), Space Mono (`stat-numeral` 32px, `stat-numeral-sm` 18px, tabular figures only).
UX-DR3: Implement the spacing scale (4px base unit: 4/8/12/16/24/32/48/64) plus named tokens `margin-mobile` (20px) and `hero-gap` (40px).
UX-DR4: Implement the rounded-corner scale (`sm` 10px, `md` 18px, `lg` 28px, `xl` 36px, `full` 9999px) — no sharp (0px) corners anywhere in the system.
UX-DR5: Implement the elevation model — tonal surface steps (no drop shadows on static UI) plus a distinct "glow" treatment reserved for alive/earned elements (active markers, ignition buttons, badges).

**Components (DESIGN.md Components section — build all, each with the noted contrast/touch-target requirement):**

UX-DR6: `button-ignition` — primary CTA, gradient background, **requires a text scrim** (`surface-midnight` at 50% opacity) to meet WCAG AA 4.5:1 contrast; 56px min height.
UX-DR7: `button-secondary` — outline/transparent button, 48px min height.
UX-DR8: `button-destructive` — used only for Remove Voyager; dark fill with error-colored text/hairline, not a solid alarm-red block.
UX-DR9: `hud-card` — glass HUD panel; **requires `scrimOpacityMin: 85%`** to guarantee contrast against the live map background.
UX-DR10: `map-marker` — 40px visual size with a **48px padded hit-region** (independent of visual size) to meet touch-target minimums; player-color ring, heading chevron, fading comet-trail.
UX-DR11: `fun-fact-badge` (v1.1) — gold pill stat chip.
UX-DR12: `join-code-card` — violet-glowing hero card for the Join Code/Link, code set in `stat-numeral`.
UX-DR13: `nudge-toast` (v1.1) — glass toast, electric-teal accent bar, auto-dismiss.
UX-DR14: `organizer-sheet` — bottom sheet housing End Voyage / Grant Organizer Status / Remove Voyager, capped at one modal-stacking level (row taps swap the sheet's own content into a confirm step, never a stacked second dialog).
UX-DR15: `status-pill` (Riding/Driving role switch) — the single most safety-critical control; two visually distinct states, 48×48px minimum, no confirmation dialog on toggle.

**Screens (7 total for v1, per DESIGN.md Screens + EXPERIENCE.md IA table):**

UX-DR16: OTP Sign-In / Verify screens — minimal, fast, no brand decoration.
UX-DR17: Home (no active Voyage) — single dominant "Start a Voyage" CTA; Past Voyages list is v1.1-only addition to this same screen.
UX-DR18: Voyage Intro screen — locked canonical copy: headline "Every journey tells a story.", subhead "Voylo rides along live and turns the trip into a memory reel — inside jokes, wrong turns, and all — ready the moment you arrive.", button "Choose Your Destination". No destination shown (none chosen yet).
UX-DR19: Destination Picker screen — destination text field (free-text, no autocomplete in v1) + "Start the Voyage" confirm button (disabled until non-empty); this confirm is the actual Voyage-creation trigger.
UX-DR20: Join Invitation screen — locked canonical copy pattern: eyebrow "{ORGANIZER} INVITED YOU", headline "A road trip worth remembering.", subhead "Ride along live to {destination} — then walk away with a memory reel of the whole thing: inside jokes, wrong turns, and all.", button "Join the Voyage". Shown before any auth is requested.
UX-DR21: Live Map (Voyage View) screen — full-bleed stylized map (simplified terrain, glowing light-trail roads, no standard street cartography), top/bottom `hud-card` HUD docking, Role-switch pill.
UX-DR22: Voyage Ended screen (v1's actual terminal state, pre-Memory-Lane) — calm summary (duration, Voyager count, destination), single "back to Home" action, deliberately visually subordinate to Voyage Intro/Join so v1.1's Memory Lane reads as an upgrade, not a duplicate.

**Trust, consent, and safety flows (EXPERIENCE.md):**

UX-DR23: Trust Moment screen — fires exactly once per account ever, immediately after first-ever OTP success; states "we never sell your location data" as a real moment (single acknowledgment tap), not a settings-page disclosure.
UX-DR24: Driver Attention Consent screen — fires once ever, immediately after the Trust Moment, same onboarding pass; single acknowledgment tap stating the driver-attention expectation and liability disclaimer.
UX-DR25: Driver-Safety Interaction Model — self-declared Riding/Driving role (not sensor-based), set on first Live Map landing, changeable anytime via the status pill with no confirmation dialog; manual Fun Fact/photo controls are entirely **absent** (not disabled) from a Driving-role Voyager's HUD.
UX-DR26: OS location-permission flow — app-authored priming screen before the native OS permission dialog fires (never a cold OS prompt); denial/revocation shows a full-bleed explainer, marker simply doesn't render for others until resolved.
UX-DR27: OS notification-permission (time-sensitive) flow — app-authored priming screen before the native OS dialog; requests iOS Time-Sensitive interruption level / Android priority channel; decline degrades delivery only, never blocks functionality.
UX-DR28: External-sharing consent gate (v1.1) — "Ask the group" flow: each tagged Voyager gets one approve/decline ask per share action; share only proceeds once all tagged Voyagers approve or are excluded from a trimmed re-share.
UX-DR29: Contribution Richness / FOMO-as-invitation pattern (v1.1) — player-color ring is always full brightness (never dimmed for low contribution); gold Fun Fact badges accumulate visually; exactly one gentle nudge-toast for a zero-contribution Voyager late in the trip, never repeated, never a negative/red marker; no leaderboard or cross-Voyager ranking, ever.

**Interaction & accessibility (EXPERIENCE.md):**

UX-DR30: Interaction primitives — tap is the only primitive required in the core loop; no custom long-press actions; swipe only for toast-dismiss and sheet drag-to-dismiss; pinch/pan are the map's only continuous gestures plus one "recenter" HUD control (no manual refresh anywhere).
UX-DR31: No-messaging enforcement — no reply/comment affordance, no DM/chat entry point, no unread badge counts, no push-to-talk, no competitive leaderboards, anywhere in the product (a foundation-level IA exclusion, not a missing feature).
UX-DR32: Accessibility floor — VoiceOver/TalkBack announcements on every marker and HUD element; dynamic type reflow (Clash Display hero text may scale down but never below a legible floor); Reduce Motion alternatives (static ring instead of pulse, no animated gradient wash); live/active state never color-only (pairs with pulse/chevron); notifications audio/haptic-redundant.
UX-DR33: Offline/connectivity-loss state — last-known positions stay rendered with a subtle "reconnecting" HUD note (not a blocking banner); taps/photos queue locally and sync on reconnect (implements architecture AD-7).
UX-DR34: One active Voyage / no-tab-bar IA — no persistent tab bar or drawer; navigation is a state machine (Home ↔ Intro/Picker/Join → Live Map → Wrap-up → Voyage Ended/Memory Lane); Live Map is the entire screen for the Voyage's duration, everything else surfaces as a sheet or toast over it.

### FR Coverage Map

FR-1: Epic 1 - Email OTP sign-in
FR-2: Epic 1 - Persistent session
FR-3: Epic 2 - Start Voyage
FR-4: Epic 2 - Generate Join Code/Link
FR-5: Epic 2 - Join Voyage via Code/Link
FR-6: Epic 2 - End Voyage
FR-7: Epic 2 - Grant Organizer Status
FR-8: Epic 2 - Remove Voyager
FR-9: Epic 3 - Real-time Voyager map
FR-10: Epic 5 (v1.1) - Manual Fun Fact logging
FR-11: Epic 5 (v1.1) - Automatic event detection
FR-12: Epic 5 (v1.1) - In-app photo logging
FR-13: Epic 5 (v1.1) - One-time contextual nudges
FR-14: Epic 6 (v1.1) - Generate Memory Lane
FR-15: Epic 6 (v1.1) - View Memory Lane together
FR-16: Epic 6 (v1.1) - Share Memory Lane externally
FR-17: Epic 6 (v1.1) - Browse & search Voyage history

## Epic List

### Epic 1: Foundation, Sign-In & Trust
Users can create an account with a frictionless email code, stay signed in, and see Voylo's privacy and driver-safety commitments as real onboarding moments before anything else. Includes the greenfield project setup (Expo/Supabase/EAS scaffolding) as its foundation story.
**FRs covered:** FR-1, FR-2

### Epic 2: Voyage Creation, Invite & Group Management
An Organizer can start a Voyage, invite others with a link, have them join instantly, and run the group for the whole trip — promoting co-organizers, removing anyone who shouldn't be there, and ending it cleanly when it's over.
**FRs covered:** FR-3, FR-4, FR-5, FR-6, FR-7, FR-8

### Epic 3: Live Map & Presence
Every Voyager sees the whole group moving together in real time on a stylized, game-like map for the duration of the drive — reliably, safely for drivers, and without draining the battery.
**FRs covered:** FR-9

### Epic 4: Visual Design System v2 (Cross-Cutting Redesign)
Replaces the shipped "Night Drive" dark/glass system with a solid-color, high-saturation game-map aesthetic and a breadcrumb-icon action drawer, across all built screens. Re-skin only — no FR/behavior change. Epics touched: 1, 2, 3.
**FRs covered:** none (visual/navigation redesign only)

### Epic 5: Fun Fact Capture (v1.1)
Voyagers can tap-log spottings, get automatic detection of stops and border crossings, attach photos, and get gently nudged toward these features the first time each becomes relevant.
**FRs covered:** FR-10, FR-11, FR-12, FR-13

**Idea captured for story detailing (not yet a story):** a new automatic Fun Fact type — "connection drops" — counting how many times a Voyager lost and regained connectivity during the Voyage (e.g. "Went off-grid 4 times"). Cheap to add: Epic 3's Story 3.5 already detects every drop/reconnect to drive the "reconnecting" HUD note; this would extend FR-11 (Automatic Event Detection) to also log that event as a bankable Fun Fact, the same way border crossings are silently banked.

**Story 5.1 pulled forward via Sprint Change Proposal 2026-08-10** (see that file), ahead of the rest of this epic, specifically to unblock Epic 6: an in-progress, uncommitted event-capture backend (`journey_events` table, coffee-stop detector) already existed outside the story process and needed reconciling with the approved AD-16 Stop Intelligence design before use.

### Epic 6: Memory Lane & Voyage History (v1.1)
When a Voyage ends, the group gets a generated highlight-reel recap they can watch together, revisit, and share externally with consent — and can browse and search their past Voyages at any time. Realizes the "Living Voylo" concept (`docs/VOYLO-LIVING-VOYLO-FEATURE-CONCEPT.md`): a versioned, deterministic (template-based) recap ships first; AI-powered narration (Groq) is a later, separate slice layered on top once the deterministic version proves out. Revised via Sprint Change Proposal 2026-08-10 to add FR-17 (history browsing/search) and to no longer strictly wait on Epic 5's full scope — Memory Lane v1 is built to produce a complete recap using data already available (route, timing, roster) even with zero Fun Facts/photos, per the Living Voylo doc's own Slice D proof criterion.
**FRs covered:** FR-14, FR-15, FR-16, FR-17

## Epic 1: Foundation, Sign-In & Trust

Users can create an account with a frictionless email code, stay signed in, and see Voylo's privacy and driver-safety commitments as real onboarding moments before anything else. Includes the greenfield project setup as its foundation story.

### Story 1.1: Project Foundation & Environments

As a developer,
I want the Voylo app scaffolded on Expo with Supabase, EAS, and CI/CD wired across dev/staging/prod,
So that every later story has a working, deployable base.

**Acceptance Criteria:**

**Given** a fresh repository
**When** the project is initialized
**Then** it is an Expo SDK 56 + TypeScript + Expo Router app matching the `ARCHITECTURE-SPINE.md` source tree (app/, features/, shared/, repositories/, lib/, supabase/)
**And** three Supabase projects (dev/staging/prod) exist with base migrations applied and RLS enabled
**And** EAS build profiles (development/preview/production) are configured per AD-6
**And** GitHub Actions runs the AD-6 promotion pipeline (dev auto-deploys on merge to main; staging/prod on tagged release or manual dispatch)
**And** Sentry captures a test error in each environment

### Story 1.2: Email OTP Sign-In

As a new or returning user,
I want to sign in with just my email and a one-time code,
So that I don't need to remember a password.

**Acceptance Criteria:**

**Given** the OTP Sign-In screen
**When** I enter my email
**Then** I receive a numeric one-time code
**And** entering a valid, unexpired code signs me in
**And** the code field auto-advances per digit and auto-submits at 6 digits
**When** I enter an invalid or expired code
**Then** the field shakes and clears in place with an error and a resend option (30s cooldown)

*(Fulfills FR-1.)*

### Story 1.3: Persistent Session & Sign-Out

As a signed-in user,
I want to stay signed in until I choose to sign out,
So that I'm not re-authenticating constantly.

**Acceptance Criteria:**

**Given** I've signed in once
**When** I relaunch the app
**Then** I land straight past OTP Entry, no re-auth prompt
**When** I tap sign out in Settings
**Then** my session is invalidated on this device, and (per AD-4 global sign-out) on every device

*(Fulfills FR-2, NFR3.)*

### Story 1.4: Trust Moment

As a first-time user,
I want a clear, real statement that Voylo never sells my location data,
So that I trust it enough to grant location access later.

**Acceptance Criteria:**

**Given** my first-ever successful OTP sign-in
**When** the app proceeds
**Then** the Trust Moment screen fires with the locked copy ("Your location stays in this Voyage." / "We never sell your location data...")
**And** one "Got it" tap dismisses it, setting `profiles.trust_moment_seen_at`
**And** it never resurfaces on this account again; full policy stays reachable from Settings

*(Fulfills UX-DR23.)*

### Story 1.5: Driver Attention Consent

As a first-time user,
I want to explicitly acknowledge that I'm responsible for driving attentively,
So that Voylo's driver-safety approach is grounded in real consent, not a silent assumption.

**Acceptance Criteria:**

**Given** the Trust Moment was just dismissed (same onboarding pass)
**When** it closes
**Then** the Driver Attention Consent screen fires with the locked liability copy
**And** one "Got it" tap dismisses it, setting `profiles.driver_consent_seen_at`
**And** it never resurfaces on this account again

*(Fulfills UX-DR24.)*

## Epic 2: Voyage Creation, Invite & Group Management

An Organizer can start a Voyage, invite others with a link, have them join instantly, and run the group for the whole trip — promoting co-organizers, removing anyone who shouldn't be there, and ending it cleanly when it's over.

### Story 2.1: Start a Voyage

As an Organizer,
I want to start a new Voyage by choosing a destination,
So that I can begin coordinating a road trip with my group.

**Acceptance Criteria:**

**Given** I'm signed in with no active Voyage
**When** I open the app
**Then** I see Home with a single "Start a Voyage" CTA
**When** I tap it
**Then** I see the Voyage Intro screen (locked copy), then tap "Choose Your Destination" to reach Destination Picker
**When** I enter a destination and tap "Start the Voyage"
**Then** a Voyage is created with me as its first Organizer and Voyager, single destination only, live tracking active
**And** if I already belong to another active Voyage, starting a new one is blocked (AD-9: one active Voyage per user)

*(Fulfills FR-3; UX-DR17, UX-DR18, UX-DR19.)*

### Story 2.2: Generate & Share Join Code/Link

As an Organizer,
I want a shareable Join Code/Link for my Voyage,
So that I can invite others.

**Acceptance Criteria:**

**Given** I just started a Voyage
**When** Destination Picker confirms
**Then** a Join-code card appears immediately with a tap-to-copy code and a share action opening the OS share sheet
**And** the code is a deep link (AD-10: universal/app link) that stays valid for the Voyage's full duration and never rotates
**And** opening it without the app installed redirects to the App Store/Play Store

*(Fulfills FR-4; UX-DR12, AD-10.)*

### Story 2.3: Join Voyage via Code/Link

As any user,
I want to join an active Voyage using a Join Code/Link,
So that I can ride along with the group.

**Acceptance Criteria:**

**Given** I open a valid Join Code/Link
**When** the app loads
**Then** I see the Join Invitation screen (locked copy) before any authentication is requested
**When** I tap "Join the Voyage" and complete OTP sign-in
**Then** I'm added as a Voyager and land immediately on the live Voyage view
**And** joining after the Voyage has already started is allowed, not an error — I simply appear normally, with my `joined_at` timestamp recorded
**And** if I already belong to another active Voyage, joining this one is blocked (AD-9)

*(Fulfills FR-5; UX-DR20.)*

### Story 2.4: End Voyage

As an Organizer,
I want to manually end an active Voyage,
So that I can close out the trip when it's done.

**Acceptance Criteria:**

**Given** an active Voyage
**When** I open the Organizer Action Sheet and confirm End Voyage
**Then** new recording stops immediately but never auto-triggers on anyone's arrival
**And** I land on the Voyage Ended screen — a calm summary (duration, Voyager count, destination) with one action back to Home

*(Fulfills FR-6; UX-DR14, UX-DR22.)*

### Story 2.5: Grant Organizer Status

As an Organizer,
I want to grant Organizer status to another Voyager,
So that no single person is a point of failure for managing the trip.

**Acceptance Criteria:**

**Given** the Organizer Action Sheet
**When** I select Grant Organizer Status for a Voyager
**Then** they immediately gain End Voyage / Remove Voyager / Grant Organizer Status capabilities, with a quiet confirmation toast, no re-navigation
**And** a Voyage can have more than one Organizer at a time

*(Fulfills FR-7.)*

### Story 2.6: Remove Voyager

As an Organizer,
I want to remove a Voyager from an active Voyage,
So that I can fix an accidentally-leaked Join Code/Link.

**Acceptance Criteria:**

**Given** the Organizer Action Sheet
**When** I confirm Remove Voyager for someone
**Then** their location and further participation stop immediately
**And** they see a calm "You've left this Voyage" state, and the old Join Code/Link no longer re-admits them

*(Fulfills FR-8.)*

## Epic 3: Live Map & Presence

Every Voyager sees the whole group moving together in real time on a stylized, game-like map for the duration of the drive — reliably, safely for drivers, and without draining the battery.

**Scoping note:** the OS notification-permission (Time-Sensitive) priming screen from EXPERIENCE.md is deferred to Epic 4 — v1 has nothing to notify about yet (Fun Facts/long-stop detection don't exist until then), so requesting that permission early has no payoff. Location permission is in scope here since it's required for the map itself.

### Story 3.1: OS Location Permission

As a Voyager,
I want to grant Voylo location access,
So that the app can show me and my group on a live map.

**Acceptance Criteria:**

**Given** I just started or joined a Voyage
**When** the app needs location
**Then** an app-authored priming screen explains why before the native OS dialog appears
**And** choosing "Always Allow" enables background updates; choosing less shows a full-bleed explainer with a link to Settings, and my marker doesn't render for others until resolved

*(Fulfills UX-DR26.)*

### Story 3.2: Real-Time Voyager Map

As a Voyager,
I want to see all Voyagers' live locations on one shared, stylized map,
So that I always know where everyone in the group is.

**Acceptance Criteria:**

**Given** an active Voyage
**When** I open Live Map
**Then** I see a stylized world (glowing light-trail roads, simplified terrain — not a standard street map), each Voyager as a marker (player-color ring, heading chevron, comet-trail, 48px tap region)
**And** positions update near-real-time via one Realtime channel per Voyage; the map is visible only to that Voyage's own Voyagers
**And** I can pinch/pan and use one "recenter" control — no manual refresh button anywhere
**And** the marker's live state is never color-only (paired with pulse/chevron), and notifications are audio/haptic-redundant, per the accessibility floor

*(Fulfills FR-9; UX-DR10, UX-DR21, UX-DR30, UX-DR32; AD-2, AD-1.)*

### Story 3.3: Location Persistence & Background Tracking

As a Voyager,
I want my location to keep updating even when my phone is locked,
So that my group can see me without me keeping the app open.

**Acceptance Criteria:**

**Given** the app is backgrounded or the phone is locked
**When** I'm on an active Voyage
**Then** location upserts keep sending (background mode + task manager; Android 14+ foreground-service-type declared)
**And** only my single latest-known location is persisted (never per-ping), with a conditional upsert so a stale/delayed update can never overwrite a newer one

*(Fulfills AD-3, AD-8.)*

### Story 3.4: Driver-Safety Role Switch

As a driver,
I want to mark myself as Driving,
So that Voylo knows to keep my screen hands-off.

**Acceptance Criteria:**

**Given** I land on Live Map for the first time this Voyage
**When** the role prompt appears
**Then** I can pick Riding or Driving (skippable, defaults to Riding)
**And** I can switch anytime with one tap on my status pill, no confirmation dialog
**And** in v1 there are no manual controls yet for Driving mode to remove (Fun Fact capture is v1.1) — this story establishes the role mechanism and persisted state that v1.1's controls will respect from day one

*(Fulfills UX-DR15, UX-DR25.)*

### Story 3.5: Connectivity Loss & Reconnection

As a Voyager,
I want the map to handle a dead zone gracefully,
So that a temporary signal drop doesn't corrupt the trip or make me look like I vanished.

**Acceptance Criteria:**

**Given** I lose connectivity mid-drive
**When** the map can't reach the server
**Then** last-known positions stay rendered with a subtle "reconnecting" note, not a blocking banner
**And** any queued Voyage-lifecycle write (not location pings) flushes per-item on reconnect; one with a stale precondition (e.g. my membership was revoked while offline) is dropped with a clear conflict message, never silently retried forever

*(Fulfills NFR2; UX-DR33; AD-7.)*

## Epic 4: Visual Design System v2 (Cross-Cutting Redesign)

Replaces the shipped "Night Drive" dark/glass system with a solid-color, high-saturation game-map aesthetic and a breadcrumb-icon action drawer, across all built screens. Originally re-skin only — no FR/behavior change. Added via Sprint Change Proposal 2026-08-02 (see `sprint-change-proposal-2026-08-02.md`), triggered by user feedback that the shipped dark/glass UI and organizer bottom-sheet navigation read as unclear and hard to use. Extended via Sprint Change Proposal 2026-08-06 (see `sprint-change-proposal-2026-08-06.md`) to add a game-like, motion-driven redesign of the marker peek card plus new FR-9 content (live coordinates, distance-from-destination, Get Directions) — Stories 4.5/4.6. Extended a second time the same day (see the same file's addendum) to bring brand warmth and purposeful motion to OTP Sign-In and Home — Story 4.1's original brief had deliberately kept both "quiet," but user feedback identified them as the app's actual front door for a first-time Voyager who has no other context for what Voylo does — Stories 4.7/4.8.

### Story 4.1: UX Design System v2

As a UX Designer,
I want to redefine Voylo's color system, elevation model, and key components against a solid-color, high-saturation "game map" direction,
So that the app drops the semi-transparent/dark treatment users found unclear and instead reads as a colorful, icon-driven, Waze-like experience.

**Acceptance Criteria:**

**Given** the UX Design Brief in `sprint-change-proposal-2026-08-02.md` §4.3
**When** this story is executed via a dedicated `bmad-ux` session
**Then** `DESIGN.md` is updated with a new solid, opaque, high-saturation palette (no transparency/blur anywhere) and WCAG AA contrast recomputed from the new values
**And** the glassmorphism mechanism (`surface-glass`, blur, `scrimOpacityMin`) is removed from `hud-card`, `nudge-toast`, and `organizer-sheet`'s replacement
**And** a new `action-drawer` component is specified (breadcrumb-triggered, on-demand, holds End Voyage / Grant Organizer Status / Remove Voyager)
**And** the Live Map layout is respecced as a solid top destination banner + full map below, replacing floating top/bottom `hud-card` docking
**And** `map-marker`, `status-pill`, `button-ignition`, `button-secondary`, `button-destructive`, `join-code-card` are re-specced against the new palette
**And** typography, spacing, and rounded-corner scales are unchanged; all `EXPERIENCE.md` behavioral/IA content is unchanged except the line-53 IA amendment already applied
**And** the new palette is validated against PRD §5.1 and FR-9's "game-like, not utility" guardrail before this story is marked done
**And** `EXPERIENCE.md` gains a Motion & Transitions section specifying concrete screen-transition types/timing/easing (including the Destination Picker → Live Map "cut to gameplay" moment) and the action-drawer's open/close animation (slide + scrim fade), with parameters precise enough to implement without guessing
**And** every mockup produced for Stories 4.2-4.4 is treated as the pixel-exact normative reference — not an approximation — for the screen it depicts: exact colors, spacing, radii, type sizes, and specified motion. A prior redesign pass shipped visibly different from its mockups; that must not repeat.
**This story is design-only — no app code changes.**

### Story 4.2: Action Drawer & Breadcrumb Navigation

As an Organizer,
I want to reach End Voyage, Grant Organizer Status, and Remove Voyager from a breadcrumb icon that opens a drawer,
So that organizer actions are consolidated behind clear, discoverable chrome instead of a floating bottom sheet.

**Acceptance Criteria:**

**Given** Story 4.1's `action-drawer` spec
**When** I tap the breadcrumb icon docked in Live Map's top chrome
**Then** the action drawer opens over the map, showing End Voyage, Grant Organizer Status, and Remove Voyager (Organizer-only)
**And** selecting a row behaves the same as it did in `organizer-sheet` (swaps to a confirm step, never stacks a second dialog)
**And** the drawer closes after an action completes or on explicit dismiss — it is not a persistent nav surface
**And** `organizer-sheet` is removed from the codebase, fully replaced by `action-drawer`
**And** the drawer's open and close animation matches Story 4.1's Motion & Transitions spec exactly (slide + scrim fade, same timing/easing) — not an instant cut, not a substituted default transition
**And** the built screen matches its linked mockup exactly (colors, spacing, radii, component treatment) — verified side-by-side against the mockup file during code review, not approved on "close enough"

*(Fulfills EXPERIENCE.md line-53 IA amendment; replaces UX-DR14.)*

### Story 4.3: Live Map Redesign

As a Voyager,
I want the Live Map to open with a clear destination banner and a clean, colorful map view of everyone in the group,
So that the core screen reads as an inviting game-like world instead of a dark, hard-to-parse HUD.

**Acceptance Criteria:**

**Given** Story 4.1's respecced Live Map layout
**When** I open Live Map
**Then** a solid top banner clearly displays the Voyage's destination
**And** the full map renders below the banner, with each Voyager shown via the re-specced `map-marker` and `status-pill`
**And** no glass/blur/transparency is used anywhere on this screen
**And** all existing Live Map behavior (Realtime updates, recenter control, connectivity-loss handling, role switch) is preserved unchanged
**And** entering Live Map from Destination Picker (Organizer) or from Join+OTP completion (Voyager) uses Story 4.1's specified "cut to gameplay" transition, not a default screen push
**And** the built screen matches its linked mockup exactly (colors, spacing, radii, component treatment) — verified side-by-side against the mockup file during code review, not approved on "close enough"

*(Fulfills Story 4.1's Live Map respec; supersedes visual portions of Stories 3.2, 3.4, 3.5 — no behavioral change to those stories.)*

### Story 4.4: Reskin Epic 1 & 2 Screens

As a Voyager,
I want every screen — not just Live Map — to use the new colorful design system,
So that the app feels consistent app-wide instead of having one redesigned screen surrounded by the old dark/glass look.

**Acceptance Criteria:**

**Given** Story 4.1's new design system
**When** I use OTP Sign-In/Verify, Trust Moment, Driver Attention Consent, Home, Voyage Intro, Destination Picker, Join Invitation, or Voyage Ended
**Then** each screen renders using the new palette and components, with no remaining Night Drive dark/glass styling
**And** no flow, copy, or logic changes are introduced — this is a visual re-skin only
**And** screen-to-screen navigation within this set uses Story 4.1's specified transition types/timing, not default platform transitions or instant cuts
**And** each built screen matches its linked mockup exactly (colors, spacing, radii, component treatment) — verified side-by-side against the mockup file during code review, not approved on "close enough"

*(Fulfills app-wide scope of Story 4.1's design output across Epics 1-2's screens.)*

### Story 4.5: Marker Peek Card Redesign (UX)

As a UX Designer,
I want to redesign the Voyager marker peek card's content and motion into a deliberately game-like, polished interaction,
So that inspecting a fellow Voyager feels like a rewarding, fun beat in the drive rather than a plain utility tooltip.

**Acceptance Criteria:**

**Given** the expanded content requirements in FR-9 (per Sprint Change Proposal 2026-08-06) and the existing Motion & Transitions precedent in EXPERIENCE.md
**When** this story is executed via a dedicated `bmad-ux` session
**Then** `DESIGN.md` gains a first-class `marker-peek-card` component spec (promoted from its current single-row mention in EXPERIENCE.md's Interaction Design table) covering layout, typography, and visual treatment for: name, role, latitude/longitude (with a tap-to-copy control and a Get Directions control), distance-from-you, and distance-from-destination
**And** `EXPERIENCE.md`'s Motion & Transitions section gains a new dated subsection specifying the peek card's open and close animation with exact timing/easing parameters (matching the precedent set by "cut to gameplay" and the Splash Screen entries), designed to read as a fun, game-like reveal rather than a plain fade
**And** the Accessibility Floor section is updated: a Reduce-Motion fallback for the new animation, and updated VoiceOver/TalkBack announcement text covering the new fields
**And** a new mockup revision of `key-marker-peek-card.html` is produced as the pixel-exact normative reference for Story 4.6, showing both the "tap another Voyager" and "tap yourself" states with all new fields
**And** the self-marker case continues to omit role, distance-from-you, and the Get Directions control (unchanged/extended rationale — neither "how far from yourself" nor "navigate to yourself" is a meaningful reading), but now includes distance-from-destination and coordinates
**This story is design-only — no app code changes.**

*(Extends Story 4.1's Live Map respec and FR-9; added via Sprint Change Proposal 2026-08-06.)*

### Story 4.6: Build Marker Peek Card Redesign

As a Voyager,
I want tapping a marker to show a richer, more delightful peek card with live coordinates, distance to both my fellow Voyager and the destination, and a way to navigate straight to them,
So that checking in on the group feels fun and gives me the detail — and the option — I actually want.

**Acceptance Criteria:**

**Given** Story 4.5's `marker-peek-card` spec and mockup
**When** I tap a Voyager's marker on Live Map
**Then** the peek card opens and closes using the exact motion spec from Story 4.5 (not a default fade or instant cut)
**And** the card shows name, role, live latitude/longitude (updating in real time from the same smoothed position driving the marker itself), a tap-to-copy control for the coordinates, live distance from my own position, and live distance from the shared destination
**And** a "Get Directions" control sits beside the copy control on other-Voyager cards; tapping it opens the device's default maps app (Apple Maps on iOS, Google Maps on Android) with driving directions already routing from my current position to that Voyager's live coordinates
**And** tapping my own marker shows name, coordinates, and distance-from-destination only — no role, distance-from-me, or Get Directions control, per FR-9
**And** the built card matches Story 4.5's mockup exactly (colors, spacing, radii, motion) — verified side-by-side during code review, not approved on "close enough"
**And** this work is implemented on a dedicated feature branch, not directly on main, per explicit user instruction
**And** existing peek-card test coverage (`marker-peek-card`, `marker-peek-distance`, etc.) is extended to cover the new fields, the copy control, and the Get Directions control

*(Implements Story 4.5's spec; added via Sprint Change Proposal 2026-08-06.)*

### Story 4.7: Welcome & Sign-In Warmth (UX)

As a UX Designer,
I want to redesign OTP Sign-In/Verify and Home's copy, visual tone, and motion so a first-time Voyager immediately feels the brand and understands what happens next,
So that the app's actual front door stops reading as generic auth/utility screens next to the emotional payoff already built into Voyage Intro and Join Invitation.

**Acceptance Criteria:**

**Given** the brand core captured in the original brainstorming session (`_bmad-output/brainstorming/brainstorm-group-road-trip-tracker-2026-07-21/brainstorm.html` — the "send me your Voylo" throughline, the tagline, "let people experience a journey together, even when physically apart") and PRD §4.5's now-updated discoverability note (Sprint Change Proposal 2026-08-06)
**When** this story is executed via a dedicated `bmad-ux` session
**Then** `DESIGN.md`'s OTP Sign-In/Verify and Home Screens entries are rewritten, dropping the "still plumbing, not a brand moment" / "unchanged structure" framing in favor of a deliberate content and tone treatment for each — explicitly weighted differently: OTP stays fast and low-friction (no added steps, no delay to code entry), Home gets the larger swing since it's the literal first "what is this app" moment for a brand-new Voyager
**And** `EXPERIENCE.md`'s Voice and Tone table gains real Do/Don't rows for OTP Sign-In and Home — both currently have zero entries, unlike every other screen already in that table
**And** a new dated subsection is added to `EXPERIENCE.md`'s Motion & Transitions section specifying purposeful motion for at least Home (and OTP if the chosen direction calls for it) that reflects Voylo's actual premise — a shared journey, a road-trip game world — not generic decorative animation; consider (not mandate) extending existing motion building blocks already in this codebase (`horizon-strip`'s ambient road drift, the `road-motif` component shared by Voyage Intro/Join Invitation) before inventing a new pattern
**And** at least 2-3 concrete directions (copy + visual + motion) are rendered for user review before any single approach is locked in, per explicit user request during this story's own Sprint Change Proposal discussion
**And** new mockup revisions of `key-otp-signin.html` and `key-home.html` are produced as the pixel-exact normative reference for Story 4.8
**And** the OTP field's existing behavioral contract (auto-advance, auto-submit at 6 digits, 30s resend cooldown, shake-on-error) is unchanged — this story touches tone and motion, not the auth flow itself
**This story is design-only — no app code changes.**

*(Extends Story 4.1's original design brief for OTP/Home; added via Sprint Change Proposal 2026-08-06.)*

### Story 4.8: Build Welcome & Sign-In Warmth

As a first-time Voyager,
I want OTP Sign-In and Home to feel like the start of something exciting instead of a generic login screen and a bare button,
So that I understand what Voylo is and want to tap "Start a Voyage" before I've even used the app once.

**Acceptance Criteria:**

**Given** Story 4.7's approved copy, visual, and motion spec and mockups
**When** I open the app for the first time (or return with no active Voyage)
**Then** OTP Sign-In/Verify (`sign-in.tsx`) and Home (`index.tsx`) render the new copy, visual tone, and motion exactly as spec'd — verified side-by-side against the mockups during code review, not approved on "close enough"
**And** OTP's existing behavioral contract (auto-advance, auto-submit, 30s resend cooldown, shake-on-error, join-code link) is unchanged and every existing `sign-in.test.tsx` assertion on that behavior still passes — this story changes tone/motion, not the flow
**And** `index.tsx`'s existing `join-voyage-button`/`settings-link` behavior is unchanged
**And** `sign-in.test.tsx`/`index.test.tsx`'s copy-string assertions are updated to match the new copy — an expected, sanctioned test update, not a regression
**And** this work is implemented on a dedicated feature branch, not directly on main, matching this project's established convention for UX-driven build stories

*(Implements Story 4.7's spec; added via Sprint Change Proposal 2026-08-06.)*

## Epic 5: Fun Fact Capture (v1.1)

Voyagers can tap-log spottings, get automatic detection of stops and border crossings, attach photos, and get gently nudged toward these features the first time each becomes relevant.

### Story 5.1: Journey Event Capture Foundation

As a developer,
I want the two remaining real gaps in the already-built journey-event capture backend closed — a broadcast RLS restriction and end-to-end delivery to the UI — plus a minimal manual spotting path,
So that Epic 6's Memory Lane has trustworthy, correctly-scoped event data to draw on, with no captured event silently dropped and no client able to forge one.

**Acceptance Criteria:**

**Given** commits `7977d0d` (hybrid live journey architecture) and `cd74c6e` (shadow stop intelligence foundation) already landed on this branch, which fully built and wired a generic, AD-16-compliant stop-detection pipeline (`stop-detector.ts`, `stop-classifier.ts`, `stop-monitor.ts`, `stop-event-repository.ts`, called from `background-location-task.ts`'s shared `reportLocationFix` — covering both foreground and background) — **none of that is touched by this story**. Likewise, `journey_events.event_type` keeping `'coffee_stop'` alongside the generic `'stop'` type (`src/shared/types/voyage-message.ts` lines 11-13) is a deliberate, already-documented mobile-compatibility-window decision, not a defect — **do not remove it**
**When** this story is implemented
**Then** a new migration restricts the `realtime.messages` Broadcast write RLS policy's `WITH CHECK` (`voyage_channel_write_active_members`) to `payload ->> 'type' = 'location.updated'` only — today it has no type restriction at all, so a client can broadcast a fabricated `journey.event.created` message; all journey events must be created exclusively through the authenticated `create_journey_event` RPC (AD-14)
**And** `onJourneyEvent` is wired end-to-end: `useLiveLocations`'s call to `subscribeToLocations` (`src/shared/hooks/use-live-locations.tsx`) still only passes 7 arguments today, omitting the 9th (`onJourneyEvent`) — add a real callback there, accumulate received events into new hook state, and return it, so `onJourneyEvent?.(...)` in `location-repository.ts` stops being a permanent no-op
**And** a minimal manual spotting-log UI (police/deer/construction — a small set of tap controls, no nudges/onboarding/photo attachment) calls the existing `journeyEventRepository.createEvent` (`src/repositories/journey-event-repository.ts`, already implemented and already wired into the offline outbox's `journey_event` kind) — no such UI trigger exists anywhere in the app today
**And** new/updated tests cover: the RLS type restriction and end-to-end journey-event delivery through `useLiveLocations`

*(Fulfills part of FR-10; realizes AD-14. Pulled forward via Sprint Change Proposal 2026-08-10 ahead of the rest of Epic 5, to unblock Epic 6.)*

## Epic 6: Memory Lane & Voyage History (v1.1)

When a Voyage ends, the group gets a generated highlight-reel recap they can watch together, revisit, and share externally with consent — and can browse and search their past Voyages at any time. Realizes the "Living Voylo" concept (`docs/VOYLO-LIVING-VOYLO-FEATURE-CONCEPT.md`).

**Scoping note:** this slice covers the Living Voylo doc's Slice A foundation pieces required for completed-Voyage access, plus a trimmed Slice D (Memory Lane v1 without Fun Facts). The doc's mid-trip "Live Roadbook" pull-down UI (also part of Slice A) and full Slice C (calibrated stop intelligence, group split/reunion classifiers) are intentionally deferred, not dropped — a natural next slice once this one ships.

### Story 6.1: Timeline & Completed-Voyage Access Foundation

As a developer,
I want the one remaining real completed-Voyage access gap closed, plus the two new read RPCs Memory Lane and Voyage History need,
So that they have something to query — without duplicating access-control machinery that already exists and already works.

**Acceptance Criteria:**

**Given** `is_voyage_participant(voyage_id, user_id)` already exists (migration `20260804020000_voyage_membership_departure.sql`) — was a non-removed member, readable once the Voyage is `'ended'` regardless of when they left, or currently active for an active Voyage — and is **already** the predicate behind `voyages_select_members` and `get_voyage_members`; this story does **not** create a new predicate
**When** this story is implemented
**Then** the `journey_events_select_members` policy (`supabase/migrations/20260810000000_hybrid_live_journey_bus.sql`) — the one table still gating on `is_active_voyage_member`, meaning journey events for an ended Voyage are currently unreadable to everyone — is corrected to use `is_voyage_participant`, via a new corrective migration (not editing the committed one in place)
**And** `voyage_member_locations`'s policy is explicitly **not** touched — it deliberately stays active-only (confirmed: it only ever holds each Voyager's single *latest* position, never a history, so it has no completed-Voyage read use case)
**And** a new RPC returns the caller's own ended Voyages (id, destination, created_at, ended_at, voyager_count — mirroring `end_voyage()`'s own existing `voyager_count` computation: `count(*) where removed_at is null`, not `is_active`, since `end_voyage()` deactivates every member on end), ordered by `ended_at desc`, keyset-paginated via `p_before timestamptz default null` + `p_limit integer default 20` (no cursor/pagination convention exists yet in this codebase — this establishes the simplest correct one, not an elaborate scheme)
**And** a new RPC returns keyset-paginated `journey_events` for a given Voyage the caller is a participant of (via `is_voyage_participant`), via `p_before timestamptz default null` + `p_limit integer default 50`
**And** `journey_events` gains `status` (`proposed`/`confirmed`/`suppressed`/`corrected`, default `'confirmed'`) and `source` (`server`/`automatic`/`manual`/`computed`, default `'manual'`) columns — defaults matching the only rows that exist today (all manual spotting logs from Story 5.1); sufficient for Story 6.3's composer — full `JourneyMoment` model parity (e.g. `visibility`, `classifierVersion`) is deferred until those fields have a consumer

*(Realizes AD-17 Slice A foundation, scoped to completed-Voyage access; authorizes AD-17 for this specific slice per its planning gate. Added via Sprint Change Proposal 2026-08-10.)*

### Story 6.2: Memory Lane & Voyage History UX

As a UX Designer,
I want a dedicated design pass for the end-of-Voyage reveal, the memory-card visual language, and the Voyage History browse/search screen,
So that this emotionally-central feature gets the same rigor as every other major screen in this product (matching the Story 4.1/4.5/4.7 precedent) instead of being improvised during implementation.

**Acceptance Criteria:**

**Given** the Living Voylo doc's "End-of-Voyage reveal" and "Information architecture" sections, and PRD FR-14/FR-15/FR-17
**When** this story is executed via a dedicated `bmad-ux` session
**Then** `DESIGN.md` gains component specs for: the Memory Lane reveal (opening title/route/stat/finale cards), a shareable final group card, and a Voyage History list item + search field
**And** `EXPERIENCE.md`'s Motion & Transitions section gains a dated subsection for the End Voyage → Memory Lane reveal transition, specified with the same rigor as the "cut to gameplay" and marker-peek-card precedents — this is the single most emotionally-weighted animation in the app per the brainstorming session's north star and must be spec'd, not improvised
**And** the Voyage History screen's IA is defined: reached from Home (extending the existing `UX-DR17` "Past Voyages list" stub), search-by-destination behavior, and navigation into a selected past Voyage's Memory Lane
**And** the reveal and card designs explicitly account for the no-Fun-Facts, no-photos case (Story 6.3 ships before Epic 5's full capture UI) — a low-content Voyage must still feel complete and intentional, not empty, per the Living Voylo doc's negative-scenario table
**And** at least 2-3 concrete directions (copy + visual + motion) are rendered for review before any one approach is locked in, matching Story 4.7's precedent for a brand-defining moment
**And** new mockups are produced as the pixel-exact normative reference for Stories 6.3 and 6.4
**This story is design-only — no app code changes.**

*(Extends the design system from Story 4.1; added via Sprint Change Proposal 2026-08-10.)*

### Story 6.3: Build End-of-Voyage Memory Lane Reveal

As a Voyager,
I want ending a Voyage to reveal a beautiful, animated recap of the trip,
So that finishing a Voyage feels like a reward, not just closing out a tracker.

**Acceptance Criteria:**

**Given** Story 6.1's data foundation and Story 6.2's approved spec and mockups
**When** an Organizer ends the Voyage (FR-6)
**Then** a versioned, deterministic (template-based, no AI) composer assembles the Memory Lane immediately: opening title/destination/date/participating Voyagers, Planned-vs-Actual travel time, distance and time traveled together, states/countries crossed (where already captured), and any journey events already captured by Story 5.1 (stops, spottings) — with a complete, non-empty recap even when zero Fun Facts/photos exist
**And** the reveal plays Story 6.2's spec'd animation exactly, verified side-by-side against the mockups, not approved on "close enough"
**And** Memory Lane generation is idempotent — re-opening or a retried assembly never produces a duplicate or a different result for the same Voyage
**And** every participating Voyager can independently view the same Memory Lane from their own app (FR-15), and revisit it later, not just at the moment of the reveal
**And** a solo (unjoined) Voyage still produces a complete Memory Lane

*(Fulfills FR-14, FR-15; implements Story 6.2's spec. Added via Sprint Change Proposal 2026-08-10.)*

### Story 6.4: Build Voyage History Browser

As a Voyager,
I want to navigate to a list of my past Voyages and search it by destination,
So that I can revisit any trip's memories whenever I want, not just right after it ends.

**Acceptance Criteria:**

**Given** Story 6.1's Voyage-list RPC and Story 6.2's approved spec and mockups
**When** I navigate to Voyage History (from Home, per Story 6.2's IA)
**Then** I see my past (ended) Voyages I participated in, most recent first
**And** a search field filters the list by destination name as I type
**And** tapping a past Voyage opens its Memory Lane (Story 6.3), unchanged from how it rendered at end-of-Voyage
**And** the screen matches Story 6.2's mockup exactly (colors, spacing, radii, motion) — verified side-by-side during code review

*(Fulfills FR-17; implements Story 6.2's spec. Added via Sprint Change Proposal 2026-08-10.)*

### Story 6.5: AI-Powered Narration (Groq)

*(Backlog placeholder — not yet detailed. Deferred until Stories 6.3/6.4 ship and prove out, per `docs/VOYLO-LIVING-VOYLO-FEATURE-CONCEPT.md` Slice F: AI rewrites verified facts into narrative styles as a presentation layer only, cannot create canonical events, and Memory Lane generation must never block on AI availability. Resolves PRD Open Question #7. Added via Sprint Change Proposal 2026-08-10.)*

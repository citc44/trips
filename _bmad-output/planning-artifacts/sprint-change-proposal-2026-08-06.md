# Sprint Change Proposal — 2026-08-06

**Project:** trips (Voylo)
**Prepared by:** Correct Course workflow, with Citc_
**Mode:** Incremental

---

## 1. Issue Summary

**Problem statement:** The Voyager marker peek card (built in Story 4.3 against `mockups/key-marker-peek-card.html`, "Wayfinder" direction) currently shows only name, role, and distance-from-you, with a plain fade-in/out. The user wants this interaction elevated to feel deliberately game-like — a fun, exciting "popup open/close" moment — and wants two new pieces of live detail added: latitude/longitude (with a tap-to-copy control, updating in real time alongside the marker) and distance from the shared destination (in addition to the existing distance-from-me).

**Context of discovery:** Raised directly by the user as a stakeholder enhancement request during active development, not a defect found during implementation or QA. A fourth ask — detecting when a Voyager has stopped sharing location while still active on the Voyage, and showing a distinct "sleeping" icon/suppressed pulse for them — was raised, investigated, and then explicitly dropped by the user after learning there's no reliable "sharing on/off" signal today (only inference from location-update staleness, which would false-positive on a Voyager stopped at a light). Out of scope for this proposal.

**Evidence:** User's direct description (this session). Technical feasibility of the remaining three asks was verified against the current codebase:
- `LiveLocation` already carries `lat`/`lng` (`src/repositories/location-repository.ts:4-10`) — coordinates are free.
- Destination coordinates already live on the voyage record; `haversineMiles`/`formatDistanceMiles` (`src/shared/lib/geo.ts`, used at `active-voyage.tsx:700`) already compute distance-from-me and apply identically to distance-from-destination.
- Clipboard usage already exists elsewhere in the app (`join-code.tsx`) — no new dependency needed for the copy control.
- The marker's live position is already smoothed/interpolated (`use-smoothed-location.ts`) — the popup's coordinate readout can bind to the same live values driving the marker, satisfying "real-time, just like it moves on the map" for free.
- No backend, schema, or migration changes are required anywhere in this scope.

---

## 2. Impact Analysis

### Epic Impact

- **Epic 4 (Visual Design System v2)** is the affected epic — it's the epic that established the "game-like feel, motion as a binding spec, mockups as pixel-exact reference" pattern this request extends, and it was itself added mid-project via a prior Sprint Change Proposal (2026-08-02).
- All four of Epic 4's existing stories (4.1–4.4) remain `done` and unmodified. This proposal adds two new stories rather than reopening any of them.
- No other epic is affected. Epic 5 (Fun Fact Capture) and Epic 6 (Memory Lane) are untouched — nothing here touches FR-10 through FR-16.

### Story Impact

Two new stories added to Epic 4, mirroring the existing 4.1→4.2/4.3 design-then-build precedent:

- **Story 4.5 — Marker Peek Card Redesign (UX):** design-only, via a dedicated `bmad-ux` session. Produces the `DESIGN.md` component spec, an `EXPERIENCE.md` Motion & Transitions subsection, Accessibility Floor updates, and a new mockup revision.
- **Story 4.6 — Build Marker Peek Card Redesign:** implements Story 4.5's spec exactly, on a dedicated feature branch (explicit user instruction), with extended test coverage.

### Artifact Conflicts

- **PRD:** FR-9's peek-tooltip consequence bullet (`prd.md:200`) needs expanding to cover coordinates, the copy control, distance-from-destination, and the new motion requirement. Additive only — no conflict with core PRD goals or MVP scope.
- **Architecture:** None. Purely a client-side + design change; no schema, migration, or backend work.
- **UX:** `DESIGN.md` gains a first-class `marker-peek-card` component entry (currently just one row in an interaction table). `EXPERIENCE.md`'s Motion & Transitions section gains a new dated subsection, plus Accessibility Floor updates (Reduce Motion fallback, updated VoiceOver/TalkBack text). The mockup gets a fresh revision as Story 4.6's pixel-exact reference.
- **Other artifacts:** No CI/CD, deployment, or infrastructure impact. Existing peek-card test IDs (`marker-peek-card`, `marker-peek-distance`, etc.) need extended coverage for the new fields and copy control — routine, not a conflict.

### Technical Impact

None beyond the client app. No new dependencies, no backend/RPC/schema changes. Implementation happens on its own feature branch per explicit user instruction, merged only once Story 4.6 is complete and verified against Story 4.5's mockup.

---

## 3. Recommended Approach

**Selected path: Option 1 — Direct Adjustment.** Add two new stories (4.5 UX, 4.6 build) within the existing Epic 4 structure.

**Rationale:**
- Effort: Medium — mostly UX design time; the implementation itself is contained to one component with data already available client-side.
- Risk: Low — no backend/schema touch, isolated to `active-voyage.tsx`'s marker peek card, built on its own branch.
- This is squarely a scope extension of Epic 4's own mandate (motion-driven, game-like presentation), not a pivot — Option 2 (rollback) and Option 3 (MVP review) don't apply; nothing needs reverting and no MVP goal is affected.
- The two-story split (design-only, then build) directly satisfies the user's explicit requirement that UX be fully resolved and reviewed before any code changes begin.

---

## 4. Detailed Change Proposals

### PRD

**File:** `_bmad-output/planning-artifacts/prds/prd-trips-2026-07-25/prd.md`
**Section:** 4.3 Live Map & Presence → FR-9 → Consequences (testable)

> **OLD:**
> - Tapping a Voyager's marker opens a lightweight peek tooltip anchored to that marker (Waze-style callout, not a full-screen sheet) showing their name, role, and live distance from the *tapping* Voyager's own current position — not from the shared destination. Tapping your own marker shows only your name, with no role or distance shown, since distance-from-yourself isn't a meaningful reading.
>
> **NEW:**
> - Tapping a Voyager's marker opens a peek card anchored to that marker, presented with a deliberate, game-like open/close treatment (exact motion parameters specified in EXPERIENCE.md's Motion & Transitions, per Story 4.5). It shows their name, role, live coordinates (latitude/longitude, updating in real time with their marker position, with a tap-to-copy control), live distance from the *tapping* Voyager's own current position, and live distance from the shared destination. Tapping your own marker shows only your name and coordinates, with no role or distance-from-you, since distance-from-yourself isn't a meaningful reading; distance-from-destination is still shown since that is meaningful even for your own marker.

**Rationale:** Expands FR-9's existing consequence to cover the new content and motion requirements without changing the FR's intent or any other requirement.

### Epics

**File:** `_bmad-output/planning-artifacts/epics.md`

**Epic 4 header** — old/new diff:

> **OLD:**
> Replaces the shipped "Night Drive" dark/glass system with a solid-color, high-saturation game-map aesthetic and a breadcrumb-icon action drawer, across all built screens. Re-skin only — no FR/behavior change. Added via Sprint Change Proposal 2026-08-02 (see `sprint-change-proposal-2026-08-02.md`), triggered by user feedback that the shipped dark/glass UI and organizer bottom-sheet navigation read as unclear and hard to use.
>
> **NEW:**
> Replaces the shipped "Night Drive" dark/glass system with a solid-color, high-saturation game-map aesthetic and a breadcrumb-icon action drawer, across all built screens. Originally re-skin only — no FR/behavior change. Added via Sprint Change Proposal 2026-08-02 (see `sprint-change-proposal-2026-08-02.md`), triggered by user feedback that the shipped dark/glass UI and organizer bottom-sheet navigation read as unclear and hard to use. Extended via Sprint Change Proposal 2026-08-06 (see `sprint-change-proposal-2026-08-06.md`) to add a game-like, motion-driven redesign of the marker peek card plus new FR-9 content (live coordinates, distance-from-destination) — Stories 4.5/4.6.

**New Story 4.5 — Marker Peek Card Redesign (UX):**

> As a UX Designer,
> I want to redesign the Voyager marker peek card's content and motion into a deliberately game-like, polished interaction,
> So that inspecting a fellow Voyager feels like a rewarding, fun beat in the drive rather than a plain utility tooltip.
>
> **Acceptance Criteria:**
>
> **Given** the expanded content requirements in FR-9 (per Sprint Change Proposal 2026-08-06) and the existing Motion & Transitions precedent in EXPERIENCE.md
> **When** this story is executed via a dedicated `bmad-ux` session
> **Then** `DESIGN.md` gains a first-class `marker-peek-card` component spec (promoted from its current single-row mention in EXPERIENCE.md's Interaction Design table) covering layout, typography, and visual treatment for: name, role, latitude/longitude (with a tap-to-copy control), distance-from-you, and distance-from-destination
> **And** `EXPERIENCE.md`'s Motion & Transitions section gains a new dated subsection specifying the peek card's open and close animation with exact timing/easing parameters (matching the precedent set by "cut to gameplay" and the Splash Screen entries), designed to read as a fun, game-like reveal rather than a plain fade
> **And** the Accessibility Floor section is updated: a Reduce-Motion fallback for the new animation, and updated VoiceOver/TalkBack announcement text covering the new fields
> **And** a new mockup revision of `key-marker-peek-card.html` is produced as the pixel-exact normative reference for Story 4.6, showing both the "tap another Voyager" and "tap yourself" states with all new fields
> **And** the self-marker case continues to omit role and distance-from-you (unchanged rationale), but now includes distance-from-destination and coordinates
> **This story is design-only — no app code changes.**
>
> *(Extends Story 4.1's Live Map respec and FR-9; added via Sprint Change Proposal 2026-08-06.)*

**New Story 4.6 — Build Marker Peek Card Redesign:**

> As a Voyager,
> I want tapping a marker to show a richer, more delightful peek card with live coordinates and distance to both my fellow Voyager and the destination,
> So that checking in on the group feels fun and gives me the detail I actually want.
>
> **Acceptance Criteria:**
>
> **Given** Story 4.5's `marker-peek-card` spec and mockup
> **When** I tap a Voyager's marker on Live Map
> **Then** the peek card opens and closes using the exact motion spec from Story 4.5 (not a default fade or instant cut)
> **And** the card shows name, role, live latitude/longitude (updating in real time from the same smoothed position driving the marker itself), a tap-to-copy control for the coordinates, live distance from my own position, and live distance from the shared destination
> **And** tapping my own marker shows name, coordinates, and distance-from-destination only — no role or distance-from-me, per FR-9
> **And** the built card matches Story 4.5's mockup exactly (colors, spacing, radii, motion) — verified side-by-side during code review, not approved on "close enough"
> **And** this work is implemented on a dedicated feature branch, not directly on main, per explicit user instruction
> **And** existing peek-card test coverage (`marker-peek-card`, `marker-peek-distance`, etc.) is extended to cover the new fields and the copy control
>
> *(Implements Story 4.5's spec; added via Sprint Change Proposal 2026-08-06.)*

### Sprint Status Tracking

**File:** `_bmad-output/implementation-artifacts/sprint-status.yaml`

> **OLD:**
> ```yaml
>   epic-4: in-progress
>   4-1-ux-design-system-v2: done
>   4-2-action-drawer-breadcrumb-navigation: done
>   4-3-live-map-redesign: done
>   4-4-reskin-epic-1-2-screens: done
>   epic-4-retrospective: optional
> ```
>
> **NEW:**
> ```yaml
>   epic-4: in-progress
>   4-1-ux-design-system-v2: done
>   4-2-action-drawer-breadcrumb-navigation: done
>   4-3-live-map-redesign: done
>   4-4-reskin-epic-1-2-screens: done
>   4-5-marker-peek-card-redesign-ux: backlog
>   4-6-build-marker-peek-card-redesign: backlog
>   epic-4-retrospective: optional
> ```

### Dropped Item (for the record)

Item 4 from the original request — detecting a Voyager who has stopped sharing location while still active, and showing a distinct icon/suppressing the pulse for them — was investigated and explicitly deferred/dropped by the user after review. No artifact changes proposed for it. Not added to `deferred-work.md` since it was never implemented or attempted, only requested and withdrawn before any design/build work began.

---

## 5. Implementation Handoff

**Scope classification: Moderate** — requires backlog reorganization (new stories registered above) and sequenced design-then-build execution; does not require PM/Architect strategic replanning since no PRD goal, MVP scope, or architecture pattern changes.

| Step | Owner | Responsibility |
|---|---|---|
| 1 | Product Owner / Dev | Apply the three approved edits above (PRD, epics.md, sprint-status.yaml) |
| 2 | UX Designer (`bmad-ux`) | Execute Story 4.5 — produce the full `marker-peek-card` design spec, motion subsection, accessibility updates, and mockup revision. No code. |
| 3 | User | Review and approve Story 4.5's design output before Story 4.6 begins |
| 4 | Developer | Create a dedicated feature branch, then execute Story 4.6 against Story 4.5's approved spec exactly |
| 5 | Developer | Code review verifies the built card matches the mockup pixel-for-pixel, and that new test coverage exists |

**Success criteria:** Story 4.5's spec is reviewed and approved by the user before any code is written; Story 4.6 is built on its own branch and matches that spec exactly on merge.

---

# Sprint Change Proposal — 2026-08-06 (Addendum: Welcome & Sign-In Warmth)

**Project:** trips (Voylo)
**Prepared by:** Correct Course workflow, with Citc_
**Mode:** Incremental

---

## 1. Issue Summary

**Problem statement:** OTP Sign-In/Verify and Home (no active Voyage) — the two screens a Voyager actually lands on right after Splash — read as "very dead": no visual excitement, no emotional or sensory hook in the copy, and a first-time user has no real indication of what Voylo is or why they'd want to tap "Start a Voyage." This sits in sharp contrast to Voyage Intro and Join Invitation, which already carry the full brand tagline and hero treatment one tap later.

**Context of discovery:** Raised directly by the user as direct product/UX feedback, referencing the original brainstorming session's stated goals (the "aha moment," why Voylo exists) as the standard these screens should be held to. Not a defect — a deliberate original design choice ("OTP is still plumbing, not a brand moment"; Home is "unchanged structure... revisit if feedback says otherwise") that the user is now explicitly revisiting, using exactly the language DESIGN.md itself invited ("revisit if feedback says otherwise").

**Evidence:**
- Current OTP Sign-In copy: headline "Sign in to Voylo," subtext "Enter your email and we'll send you a one-time code — no password to remember." Verify step: "Enter your code" / "We sent a 6-digit code to you@email.com." Purely functional, no brand voice.
- Current Home copy: wordmark "Voylo," button "Start a Voyage," one caption "Gather your crew and hit the road." No tagline, no explanation of what happens next for someone with zero context.
- `EXPERIENCE.md`'s Voice and Tone table has a Do/Don't example for every other screen in the app (Voyage Intro, Destination Picker, Join Invitation, notifications, Memory Lane, End Voyage, Remove Voyager, nudges, privacy) — OTP and Home are the only two screens with zero entries.
- PRD §4.5 already names the underlying problem for a different context: "Voylo's value isn't self-evident the way GPS navigation's is" — currently only mitigated mid-trip via FR-13's one-time nudges (deferred to v1.1), with no equivalent mitigation at the front door.
- Brainstorming session core (`brainstorm-group-road-trip-tracker-2026-07-21/brainstorm.html`): north star "make the road trip fun, not just trackable"; first principle "let people experience a journey together, even when physically apart"; brand throughline "Send me your Voylo" + "Every journey tells a story. We make sure you never miss it."

**Scope decision during this session:** OTP Sign-In (pure auth, must stay fast/low-friction) and Home (the literal front door) get different weights of treatment — Home gets the bigger swing, OTP gets a lighter touch — rather than pushing both to Voyage Intro's full intensity. The user also asked for purposeful motion on these screens reflecting Voylo's actual premise (the shared-journey/game-world idea), not just copy warmth, and asked to see concrete directions before locking in any single approach — both captured directly in Story 4.7's acceptance criteria below.

## 2. Impact Analysis

### Epic Impact
- **Epic 4 (Visual Design System v2)** again — the epic already responsible for moving every screen off the old "Night Drive" restraint and toward Voylo's actual game-like brand register. Story 4.4 (which re-skinned OTP/Home's colors) isn't at fault here — its own AC #2 explicitly scoped it to "no flow, copy, or logic changes," faithfully executing Story 4.1's original brief. This proposal revises that brief, not Story 4.4's execution of it.
- No other epic affected — doesn't touch Fun Fact Capture or Memory Lane's FRs.
- Epic 4 reopens from `done` to `in-progress` for a second time today (same pattern as when 4.5/4.6 were added).

### Story Impact
Two new stories, mirroring the established 4.5→4.6 design-then-build pattern:
- **Story 4.7 — Welcome & Sign-In Warmth (UX):** design-only, via a dedicated `bmad-ux` session. Rewrites DESIGN.md's OTP/Home Screens entries, adds the missing Voice and Tone rows, adds a Motion & Transitions subsection for purposeful brand-appropriate motion, and renders 2-3 concrete directions for user review before anything is locked in.
- **Story 4.8 — Build Welcome & Sign-In Warmth:** implements Story 4.7's approved spec in `sign-in.tsx`/`index.tsx`, on a dedicated feature branch, with sanctioned test-copy updates.

### Artifact Conflicts
- **PRD:** §4.5's Onboarding Nudges description updated (already applied) to acknowledge Home/OTP now share the "value isn't self-evident" discoverability burden with FR-13, for the pre-trip case FR-13 doesn't cover. No FR changes — this is presentation, not new functionality.
- **Architecture:** none. Pure UI/copy/motion change to two already-built screens; no data model or endpoint impact.
- **UX:** `DESIGN.md` Screens entries (OTP, Home) rewritten; `EXPERIENCE.md` Voice and Tone table gains two new rows; `EXPERIENCE.md` Motion & Transitions gains a new dated subsection; `key-otp-signin.html`/`key-home.html` mockups get new revisions.
- **Tests:** `sign-in.test.tsx`/`index.test.tsx` assert today's exact copy strings — expected, sanctioned updates once new copy lands, same precedent as prior Epic 4 stories.

### Technical Impact
None beyond the client app's two screens. No new dependencies. OTP's existing auth behavior (auto-advance, auto-submit, cooldown, shake-on-error) is explicitly protected by Story 4.8's AC — this is a tone/motion pass, not a flow change.

## 3. Recommended Approach

**Selected path: Option 1 — Direct Adjustment.** Add Stories 4.7 (UX) and 4.8 (build) to Epic 4.

**Rationale:** Effort: Medium (mostly copy/motion design time on two already-built, already-styled screens). Risk: Low (no backend/architecture touch, OTP's actual auth behavior is explicitly out of scope). This is a natural continuation of Epic 4's own mandate, and DESIGN.md itself flagged Home as open to revisiting — Options 2/3 don't apply.

## 4. Detailed Change Proposals

### PRD

**File:** `_bmad-output/planning-artifacts/prds/prd-trips-2026-07-25/prd.md`
**Section:** 4.5 Onboarding Nudges → Description

> **OLD:** "Because Voylo's value isn't self-evident the way GPS navigation's is, first-time Voyagers need to discover what they can do — solved with one-time, contextual nudges tied to real moments rather than an upfront tutorial. Realizes UJ-3 (discoverability)."
>
> **NEW:** "Because Voylo's value isn't self-evident the way GPS navigation's is, first-time Voyagers need to discover what they can do. Mid-trip, this is solved with one-time, contextual nudges tied to real moments rather than an upfront tutorial (v1.1). Before the trip even starts, the same not-self-evident problem exists at the front door — OTP Sign-In and Home (FR-1, §5.1) carry the discoverability burden for v1, via warmer copy and visual tone rather than a nudge mechanism, since there's no in-app moment to attach a nudge to yet. Realizes UJ-3 (discoverability)."

**Rationale:** Extends the PRD's own already-acknowledged problem statement to explicitly cover the pre-trip gap, without adding a new FR or changing scope.

### Epics

**File:** `_bmad-output/planning-artifacts/epics.md`

Epic 4 header extended with a second same-day addendum sentence; full Story 4.7 (UX) and Story 4.8 (Build) definitions added after Story 4.6 — see the epics.md file itself for full text (both stories written directly into the file during this session, incremental-mode approved).

**Story 4.7 highlights:** grounds the redesign in the original brainstorming session's brand core; requires new Voice and Tone rows for OTP/Home; requires a new Motion & Transitions subsection for purposeful (not decorative) motion, suggesting — not mandating — reuse of existing `horizon-strip`/`road-motif` building blocks; requires 2-3 rendered directions before lock-in; explicitly protects OTP's existing behavioral contract.

**Story 4.8 highlights:** implements the approved spec on its own branch; protects OTP's auto-advance/auto-submit/cooldown/shake-on-error behavior and Home's existing button behavior; sanctions the expected copy-string test updates.

### Sprint Status Tracking

**File:** `_bmad-output/implementation-artifacts/sprint-status.yaml`

> **OLD:**
> ```yaml
>   epic-4: done
>   4-1-ux-design-system-v2: done
>   4-2-action-drawer-breadcrumb-navigation: done
>   4-3-live-map-redesign: done
>   4-4-reskin-epic-1-2-screens: done
>   4-5-marker-peek-card-redesign-ux: done
>   4-6-build-marker-peek-card-redesign: done
>   epic-4-retrospective: optional
> ```
>
> **NEW:**
> ```yaml
>   epic-4: in-progress
>   4-1-ux-design-system-v2: done
>   4-2-action-drawer-breadcrumb-navigation: done
>   4-3-live-map-redesign: done
>   4-4-reskin-epic-1-2-screens: done
>   4-5-marker-peek-card-redesign-ux: done
>   4-6-build-marker-peek-card-redesign: done
>   4-7-welcome-sign-in-warmth-ux: backlog
>   4-8-build-welcome-sign-in-warmth: backlog
>   epic-4-retrospective: optional
> ```

## 5. Implementation Handoff

**Scope classification: Moderate** — backlog reorganization plus sequenced design-then-build execution; no PM/Architect replanning needed.

| Step | Owner | Responsibility |
|---|---|---|
| 1 | Product Owner / Dev | Apply the three approved edits above (PRD, epics.md, sprint-status.yaml) |
| 2 | UX Designer (`bmad-ux`) | Execute Story 4.7 — render 2-3 directions, produce the copy/visual/motion spec and mockup revisions. No code. |
| 3 | User | Review directions and approve Story 4.7's design output before Story 4.8 begins |
| 4 | Developer | Create a dedicated feature branch, then execute Story 4.8 against Story 4.7's approved spec exactly |
| 5 | Developer | Code review verifies the built screens match the mockups exactly, OTP's auth behavior is unchanged, and test coverage is updated |

**Success criteria:** Story 4.7's directions are reviewed and a spec approved by the user before any code is written; Story 4.8 is built on its own branch and matches that spec exactly on merge.

**Branching note:** per explicit user instruction, `story-4-6-marker-peek-card` was pushed to `origin` and a new branch, `story-4-7-welcome-sign-in-warmth`, was created for this work before this proposal was finalized.


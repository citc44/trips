---
title: Sprint Change Proposal — Memory Lane & Voyage History
date: 2026-08-10
status: approved
---

# Sprint Change Proposal — 2026-08-10

## 1. Issue Summary

**Problem statement:** When a Voyage ends today, nothing is persisted for a Voyager to revisit — there is no history, no way to browse or search past Voyages, and no memory artifact. Epic 6 (Memory Lane, FR-14/15/16) is fully specified in the PRD and confirmed as a deliberate v1.1 deferral, not an oversight — but it has zero stories built (`sprint-status.yaml`: `epic-6: backlog`). Epic 5 (Fun Fact Capture), which Memory Lane's content was designed to depend on, is also unbuilt (`epic-5: backlog`).

**Discovery context:** Raised directly by the user while reviewing the app, framed against the original brainstorming session's throughline — *"Send me your Voylo"* — and the PRD's own north star: *"every journey tells a story, and Voylo makes sure you never miss it."*

**Evidence:**
- PRD §7.2 confirms Memory Lane's v1.1 deferral was deliberate, citing it as Voylo's differentiator and primary growth channel.
- FR-15 as written only covers revisiting *one's own single* Voyage's Memory Lane — no requirement exists for browsing or searching a list of many past Voyages.
- A fully-designed, approved-but-unimplemented plan for this exact feature area already exists: `docs/VOYLO-LIVING-VOYLO-FEATURE-CONCEPT.md` ("The Living Voylo"), and architecture spine entries AD-16 (Stop Intelligence) and AD-17 (One canonical journey timeline) were adopted the same day this proposal was raised, with AD-17 explicitly gated as "approved direction, not implementation authorization for a specific slice."
- A concrete architecture conflict was found during impact analysis: uncommitted, in-progress work (a `journey_events` table and coffee-stop detector) violates AD-16's rule that stop detection must be generic and provider-independent (it hardcodes a `coffee_stop` event type).
- A load-bearing data-access gap was found: the shared `is_active_voyage_member()` RLS predicate (AD-1) requires an active Voyage, meaning ended Voyages are currently unreadable by anyone, including their own former Voyagers — Memory Lane and Voyage History cannot function without a new predicate.

## 2. Impact Analysis

**Epic Impact:**
- **Epic 6 (Memory Lane)** — retitled "Memory Lane & Voyage History," scope modified: no longer strictly gated on Epic 5's full completion (ships a complete recap using data already available — route, timing, roster — even with zero Fun Facts/photos, per the Living Voylo doc's own Slice D proof criterion). Gains FR-17 (history browsing/search) and four new stories (6.1–6.4) plus a placeholder (6.5, Groq narration).
- **Epic 5 (Fun Fact Capture)** — one story (5.1) pulled forward, ahead of the rest of the epic, to reconcile already-existing uncommitted event-capture code with the approved architecture and unblock Epic 6. Remainder of Epic 5 (manual-tap UI polish, in-app photo logging, onboarding nudges) stays deferred/unchanged.
- No epics invalidated. No new epic created — extended existing Epic 5/6 structure.

**Story Impact:** Five new stories added (5.1, 6.1–6.4) plus one backlog placeholder (6.5). All currently `backlog` in `sprint-status.yaml` — no story files created yet.

**Artifact Conflicts:**
- **PRD** — added FR-17 (Browse & Search Voyage History); resolved Open Question #7 (Groq roadmap placement — deferred to Slice F, after a deterministic Memory Lane proves out); updated §7.2 MVP-deferral list.
- **Architecture** — two fixes required before build: (1) realign the uncommitted `journey_events` schema with AD-16 (generic `stop` type + `category` metadata, not a hardcoded `coffee_stop` type); (2) add a new `is_voyage_participant` RLS predicate for completed-Voyage read access, distinct from the live/write-scoped `is_active_voyage_member()`. This proposal serves as AD-17's required authorization for a specific slice (Slice A foundation + trimmed Slice D).
- **UX** — no spec exists yet for the Memory Lane reveal, memory-card visual language, or Voyage History browse/search screen. New design-only Story 6.2 required before build, following this project's established pattern (Stories 4.1, 4.5, 4.7).
- **Other artifacts** — new Supabase migration required (schema fix + new RLS predicate + event-history/Voyage-list RPCs); new test coverage for completed-Voyage access and deterministic composer output.

**Technical Impact:** Concentrated in two foundational fixes (schema/RLS), both cheap to do now since the conflicting code is still uncommitted — no rollback of shipped/committed work required.

## 3. Recommended Approach

**Selected path: Direct Adjustment (hybrid).** Extend Epic 5 and Epic 6 within the existing epic structure; no rollback needed (conflicting work is uncommitted, corrected rather than reverted); no PRD MVP scope change needed (v1, Epics 1–4, already shipped and is unaffected — this is purely additive v1.1 work).

**Rationale:** The overwhelming majority of design work already exists and is already approved (`VOYLO-LIVING-VOYLO-FEATURE-CONCEPT.md`, AD-16, AD-17) — this proposal's job is to formally authorize a specific implementation slice, correct the one piece of in-flight code that drifted from the approved design before it ships, and fill the one genuine specification gap (searchable multi-Voyage history, FR-17) that wasn't previously written down.

**Effort estimate:** Medium. **Risk:** Medium, concentrated entirely in the two foundation fixes (Story 6.1's RLS predicate, Story 5.1's schema realignment) — both isolated, well-understood, and low-blast-radius since nothing is built on top of them yet.

**Explicitly scoped out of this proposal (deferred, not dropped):** the Living Voylo doc's mid-trip "Live Roadbook" pull-down UI, and its full Slice C (calibrated stop intelligence, group split/reunion classifiers). Neither was requested; both remain natural future slices once this one ships.

## 4. Detailed Change Proposals

### PRD (`prd.md`)
- Added **FR-17: Browse & Search Voyage History** under §4.6.
- Resolved Open Question #7 (Groq placement) — deferred to post-deterministic-Memory-Lane, per Living Voylo doc Slice F.
- Updated §7.2's MVP-deferral list to include FR-17.

### Epics (`epics.md`)
- Added FR-17 to the Requirements Inventory and FR Coverage Map.
- Added **Story 5.1: Journey Event Capture Foundation** (Epic 5, pulled forward) — realigns the uncommitted `journey_events`/coffee-stop-detector work with AD-16, restricts the Realtime broadcast RLS policy to prevent journey-event forgery, wires `onJourneyEvent` end-to-end, wires the stop detector into the live GPS pipeline with its missing `exited` phase, adds a minimal manual spotting-log path.
- Retitled Epic 6 to "Memory Lane & Voyage History," rewrote its description to reference the Living Voylo doc and its revised (non-Epic-5-blocked) sequencing.
- Added **Story 6.1: Timeline & Completed-Voyage Access Foundation** — new `is_voyage_participant` RLS predicate, Voyage-list and event-history RPCs, minimal `journey_events` schema additions.
- Added **Story 6.2: Memory Lane & Voyage History UX** (design-only `bmad-ux` session) — reveal animation, memory-card visual language, Voyage History IA.
- Added **Story 6.3: Build End-of-Voyage Memory Lane Reveal** — deterministic composer + reveal animation, no Fun-Fact dependency.
- Added **Story 6.4: Build Voyage History Browser** — Past Voyages list, search by destination, tap-through to Memory Lane.
- Added **Story 6.5: AI-Powered Narration (Groq)** as an undetailed backlog placeholder.

### Sprint Status (`sprint-status.yaml`)
- Added all five new story keys under `epic-5` and `epic-6`, each `backlog` (no story files created yet — epics remain `backlog` per this project's own transition rule: an epic flips to `in-progress` automatically when its first story file is created via `create-story`, not before).

## 5. Implementation Handoff

**Scope classification: Moderate.** Backlog reorganization (new stories across two epics, PRD/architecture amendments) plus foundational schema/RLS work — not a strategic replan (no PM/Architect-level pivot needed, since the target architecture is already approved), but more than a single-story dev task.

**Routed to:** Product Owner / Developer agents.

**Responsibilities:**
- **Next action:** run `create-story` for Story 5.1, then Story 6.1 — these are the two foundation stories and must land before Story 6.2's UX pass begins (per the "fix both before building UI" sequencing decision made during this proposal's review).
- **Developer agent:** implements 5.1 and 6.1 (schema/RLS/RPC work), then 6.3/6.4 once 6.2's UX spec and mockups exist.
- **UX pass (Story 6.2):** dedicated `bmad-ux` session, matching the established Story 4.1/4.5/4.7 pattern — must produce 2–3 rendered directions before any one is locked in.
- **Success criteria:** Story 6.1 proof — a former Voyager can read their own ended Voyage's data through the new predicate, with removed/non-members still denied. Story 6.3 proof — every ended Voyage (including solo, zero-Fun-Fact Voyages) produces a complete, non-empty Memory Lane. Story 6.4 proof — Voyage History search by destination returns correct results and opens the right Memory Lane.

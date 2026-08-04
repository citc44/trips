---
title: Voylo
status: final
created: 2026-07-25
updated: 2026-07-25
---

# PRD: Voylo
*Working title — confirm.*

## 0. Document Purpose

This PRD defines Voylo, a group road-trip presence and shareable-recap app, for the team building it and for downstream UX/architecture/epics work. It builds on two prior artifacts rather than duplicating them: the brainstorming session (`_bmad-output/brainstorming/brainstorm-group-road-trip-tracker-2026-07-21/`) and the market research report (`_bmad-output/planning-artifacts/research/market-group-road-trip-coordination-and-travel-social-app-market-voylo-research-2026-07-24.md`). Terms are Glossary-anchored (§3); Features (§4) nest globally-numbered Functional Requirements; inferred details are tagged inline `[ASSUMPTION]` and indexed in §10.

**What ships first:** v1 is deliberately narrow — passwordless auth, Voyage setup/invite, and the live map only. Fun Fact capture and Memory Lane (the differentiating, shareable payoff) are a confirmed v1.1 fast-follow, not a v1 gap. Full detail in §7 MVP Scope.

## 1. Vision

Voylo turns a group road trip into a shared, living story instead of a scattered set of separate drives. Instead of "where are you" texts and a flat map dot, a Voyager sees the whole Voyage moving together in a live, game-like view, while the app quietly captures the small moments that make a road trip memorable — a long gas stop, a border crossing, a coffee habit, a spotted cop — with a mix of automatic detection and simple one-tap logging, without demanding constant attention.

At the end, that quiet collection becomes Memory Lane: a highlight reel worth watching together and sharing, turning an ordinary drive into a story people want to relive and repeat. The brand promise, in one line: *every journey tells a story, and Voylo makes sure you never miss it* — and the aspiration is for "send me your Voylo" to become as natural a phrase among friend groups as "send me your Wordle."

### 1.1 Why Now

Road trips are a large and growing behavior (71% of Americans plan to drive their next vacation; 73% of car travelers now prefer road trips to flying), and location-sharing has gone mainstream even among privacy-conscious Gen Z. At the same time, the "Wrapped-ification" of personal data (Spotify Wrapped, and travel-specific copies like Globetrotter) has proven that people want a shareable, emotional recap of their own activity — but no existing player combines that with live group presence for road trips specifically. The category's incumbent (Life360) carries a real trust liability from selling location data, and the closest functional competitor (Convoy Tracker) has not attempted the "fun-first" framing. The window is open now but not indefinitely — see the market research report for full detail.

## 2. Target User

Voylo targets both family Voyages (illustrated by UJ-1–UJ-4's Chintan) and friend-group Voyages — the core appeal (collected memories, a game-like shared view rather than a utilitarian map) is persona-agnostic. Market research segmented the market by which appeal drives adoption (friend groups lean toward gamification/badges, families lean toward safety/togetherness), but the underlying product mechanic serves both without requiring different builds.

### 2.1 Jobs To Be Done

- **Functional:** Know where everyone in the convoy is, without a text-message relay.
- **Emotional:** Feel connected to the group during a long drive, even spread across separate cars — and come away wanting to create more road-trip memories with Voylo again. This is the product's north star; see §5.1 for the concrete design brief it implies. `[NOTE FOR PM: flag explicitly for UX/UI — this is a design brief, not just a JTBD line.]`
- **Social:** Turn an ordinary drive into a shared story the whole group experienced together, not just something each family did in parallel.
- **Contextual (organizer, e.g. Chintan):** Make the trip feel like An Event worth building anticipation for, from the moment it's set up.
- **Contextual (post-trip, everyone):** Have something worth showing off — screenshotting, sending, posting — that captures what actually happened, not a generic "trip complete" summary.

### 2.2 Non-Users (v1)

- Solo drivers with no group traveling — the product's whole value is the shared, multi-car experience.
- Commercial/logistics trucking or fleet convoys — different needs (dispatch, compliance, cargo tracking), not this product's focus.
- Anyone expecting a real-time law-enforcement-evasion tool — the police Fun Fact is a retrospective, lighthearted stat, not a live warning system. This boundary is explicit given the legal/jurisdictional risk flagged in market research.

### 2.3 Key User Journeys

- **UJ-1. Chintan sets up the Voyage and it hooks him before they've even left the driveway.**
  - **Persona + context:** Chintan, organizing a 10-hour road trip to a national park with his own family plus two other families driving separately.
  - **Entry state:** New user, opens Voylo for the first time, unauthenticated.
  - **Path:** (1) Enters email, receives an OTP, enters it — no password, session persists until he signs out. (2) Sets the destination and taps "Start Voyage." (3) Sees an intentionally adventurous, emotionally-charged screen — not a generic confirmation — that previews the kind of memory the app will hand him at the end. (4) Gets a shareable join code/link and sends it to the other two families.
  - **Climax:** The "Start Voyage" moment itself is the first payoff — before anyone's even joined, Chintan already feels "wow, this is exciting," purely from the framing/copy/visual of that one screen.
  - **Resolution:** The Voyage is live, waiting on the other two Voyagers to join. Even if nobody else ever joins, Chintan's own drive still produces a full Fun Facts and Memory Lane experience at the end — which becomes the pitch for next time.

- **UJ-2. Meera, from one of the other families, receives the code and gets the same "oh, this is going to be fun" jolt.**
  - **Persona + context:** Meera, from one of the two other families joining Chintan's trip, mid-preparation for the same trip, has never used Voylo before.
  - **Entry state:** Unauthenticated, arriving via a shared code/link from Chintan.
  - **Path:** (1) Opens the link/code. (2) Sees a "luring," emotionally-pitched invitation screen before being asked to do anything — sells the experience, not just "join Voyage." (3) Taps join, enters email, receives an OTP, enters it — same frictionless, passwordless pattern as UJ-1.
  - **Climax:** Joining itself is the second "aha" — before the drive even starts, Meera also feels the trip is already going to be memorable.
  - **Resolution:** All three Voyagers now live on one shared map, Voyage officially rolling.

- **UJ-3. The drive itself feels like watching a live game, not checking a tracker.**
  - **Persona + context:** Chintan (or any passenger in any of the three cars) checking in during the 10-hour drive.
  - **Entry state:** Already authenticated, Voyage already live, app open or backgrounded.
  - **Path:** (1) Opens the map — sees all three Voyagers moving in real time, game-like rendering, not a standard map. (2) One Voyager stops for gas; the app detects the long stop and surfaces a lighthearted, one-way humorous notification to the rest of the group (no reply/messaging — out of scope for v1). (3) The stopped Voyager logs a photo in-app. (4) A Voyager crosses a state border — the app timestamps it and quietly banks it as a future Fun Fact. (5) Running Fun Facts accumulate in the background — fastest/slowest, most stops, cop-sightings, coffee stops — not surfaced intrusively, just accumulating.
  - **Climax:** Nobody is "using" the app so much as glancing at it and feeling like they're part of a shared, living scene.
  - **Resolution:** The Voyage continues; every moment above is quietly banked for Memory Lane.
  - **Edge case:** A Voyager joins mid-drive, hours late — recorded as a good-natured "fashionably late" Fun Fact, not an error.

- **UJ-4. Memory Lane is the payoff everyone's been anticipating.**
  - **Persona + context:** All three Voyagers, Voyage complete, relaxing together (or remotely) after arriving.
  - **Entry state:** Voyage marked ended by the Organizer manually tapping "End Voyage" (not auto-detected on arrival, since Voyagers arrive at different times).
  - **Path:** (1) Memory Lane is generated: Fun Facts (deer-spotter, coffee addict, border-crossing race, latecomer), funny in-drive moments and photos, presented like a highlight reel. (2) Voyagers view it together, reacting, talking about the next trip. (3) Chintan (and others) share it externally to social media.
  - **Climax:** The "wow, that's so cool" moment — the emotional and shareable payoff of the entire Voyage.
  - **Resolution:** Memory Lane is saved/shareable; even a solo (unjoined) Voyage still produces a full Memory Lane.

**Non-goals surfaced during journey capture:** no "missed exit" alert (too noisy — group members often intentionally take different routes, not actually missing the exit); no in-app messaging/reply feature for v1 (notifications are one-way, from the app to the group, not person-to-person).

## 3. Glossary

- **Voyage** — One tracked road trip, from Start Voyage to its end. Has one or more Organizers and one or more Voyagers. Produces one Memory Lane.
- **Voyager** — A participant (typically a family or friend-group unit riding together in one car) on a Voyage. A Voyage has one or more Voyagers; every Organizer is also a Voyager.
- **Organizer** — A Voyager with Voyage-management capabilities (End Voyage, Remove Voyager, Grant Organizer Status). The Voyager who starts the Voyage is the first Organizer; others can be granted the role.
- **Fun Fact** — A small, lighthearted, auto-generated stat or moment tied to a Voyager or the group as a whole (e.g. most cop-sightings, coffee addict, border-crossing time, fashionably-late joiner). Accumulates during the Voyage; surfaced in Memory Lane.
- **Memory Lane** — The generated end-of-Voyage highlight experience: Fun Facts, photos, and in-drive moments presented as a shareable recap.
- **Join Code/Link** — The frictionless mechanism an Organizer sends to invite other Voyagers into a Voyage.

## 4. Features

### 4.1 Passwordless Auth & Onboarding

**Description:** Frictionless, passwordless sign-in via email OTP for both Organizers and joining Voyagers. No password, ever, for v1. Realizes UJ-1, UJ-2.

**Functional Requirements:**

#### FR-1: Email OTP Sign-In

A user can authenticate using their email and a one-time code, with no password. Realizes UJ-1, UJ-2.

**Consequences (testable):**
- User enters an email address and receives a numeric one-time code via email.
- Entering a valid, unexpired code completes authentication.
- An invalid or expired code shows a clear error with an option to resend.

**Out of Scope:**
- Phone-number OTP (planned for a later release, not v1).
- Password-based login (not planned at all).

#### FR-2: Persistent Session

An authenticated user remains signed in until they explicitly sign out.

**Consequences (testable):**
- App does not prompt for re-authentication on relaunch.
- A visible sign-out action exists and immediately invalidates the session on that device.

**Feature-specific NFRs:**
- OTP delivery must be reliable and timely enough not to break the "frictionless" promise (target delivery within seconds under normal conditions — exact SLA `[NOTE FOR PM: needs engineering input]`).

### 4.2 Voyage Setup & Invite

**Description:** Starting a Voyage and inviting others are both designed as emotional beats, not administrative steps — each screen is meant to produce a small "wow" before any group activity has even happened. This feature area also covers the ongoing management of who's in a Voyage and who can run it. Realizes UJ-1, UJ-2.

**Functional Requirements:**

#### FR-3: Start Voyage

An authenticated user (the first Organizer) can create and start a new Voyage with a destination. Realizes UJ-1.

**Consequences (testable):**
- Organizer sets a destination for the Voyage.
- Tapping "Start Voyage" transitions to an intentionally adventurous, emotionally-charged screen (not a generic confirmation dialog) before landing on the live Voyage view.
- The Voyage is created with its creator as first Organizer and first Voyager, live tracking already active.

**Out of Scope:**
- Multi-destination / multi-leg itinerary planning — single destination per Voyage for v1 (confirmed).

#### FR-4: Generate Join Code/Link

An Organizer can obtain a shareable Join Code/Link for an active Voyage. Realizes UJ-1.

**Consequences (testable):**
- A Join Code/Link is available as soon as the Voyage starts.
- The Organizer can share it through any external channel via the OS share sheet.
- The Join Code/Link stays valid for the full duration of the Voyage, enabling mid-Voyage joins.

#### FR-5: Join Voyage via Code/Link

Any user can join an active Voyage using a valid Join Code/Link. Realizes UJ-2.

**Consequences (testable):**
- Opening the link/code shows an emotionally-pitched invitation screen before any authentication is requested.
- After completing OTP authentication (FR-1), the user is added as a Voyager and immediately sees the live Voyage view alongside existing Voyagers.
- Joining after the Voyage has already started is allowed; it produces a good-natured "fashionably late" Fun Fact (realizes UJ-3 edge case) rather than an error.

**Out of Scope:**
- Organizer approval/gatekeeping before a joiner is admitted — holding a valid Join Code/Link is sufficient to join (confirmed).

#### FR-6: End Voyage

An Organizer can manually end an active Voyage. Realizes UJ-4.

**Consequences (testable):**
- Only an Organizer can end the Voyage (no other Voyager can trigger this).
- Ending the Voyage is a checkpoint, not a hard cutoff: it stops any *new* recording (location tracking, Fun Fact capture) from that moment forward, but does not interrupt or discard captures/uploads already in progress at that instant (e.g. a photo mid-upload) — those complete normally and are included in Memory Lane generation (FR-14).
- The Voyage is not ended automatically on any Voyager's arrival — deliberate, since Voyagers arrive at different times and an early auto-end would cut off Fun Facts/moments for Voyagers still en route.

**Out of Scope:**
- Automatic ending of a Voyage that runs indefinitely (e.g. an unreachable Organizer never ends it). Accepted as a v1 risk to observe in real-world usage rather than solved upfront; see §9 Open Questions.

#### FR-7: Grant Organizer Status

An Organizer can grant Organizer status to another Voyager on the same Voyage. Realizes UJ-1, UJ-4 (avoids the Organizer being a single point of failure).

**Consequences (testable):**
- Any Voyager granted Organizer status gains the same Voyage-management capabilities as the original Organizer (End Voyage per FR-6, Remove Voyager per FR-8, Grant Organizer Status per FR-7).
- A Voyage can have more than one Organizer at a time.

#### FR-8: Remove Voyager

An Organizer can remove a Voyager from an active Voyage. Realizes trust/safety for the Join Code/Link's frictionless-by-design join flow (FR-5).

**Consequences (testable):**
- Removing a Voyager immediately stops their location from being visible to the rest of the Voyage and stops them from further Fun Fact capture on that Voyage.
- This is the primary mitigation for an accidentally-leaked Join Code/Link (FR-4) — rather than revoking the code itself, an Organizer removes whoever shouldn't be there.

### 4.3 Live Map & Presence

**Description:** The core ambient experience during the drive — every Voyager sees the whole Voyage moving together on one shared, game-like map. Realizes UJ-3.

**Functional Requirements:**

#### FR-9: Real-Time Voyager Map

Any Voyager can view all Voyagers' live locations on one shared map for the active Voyage. Realizes UJ-3.

**Consequences (testable):**
- The map reflects each Voyager's position with a near-real-time refresh. `[ASSUMPTION: exact refresh interval TBD — trades off battery cost vs. live-feel, needs engineering input]`
- The map's visual treatment is stylized/game-like rather than a standard turn-by-turn navigation map. `[NOTE FOR PM: see Open Question 3]`
- The map and the Voyagers on it are visible only to Voyagers on that specific Voyage.
- Tapping a Voyager's marker opens a lightweight peek tooltip anchored to that marker (Waze-style callout, not a full-screen sheet) showing their name, role, and live distance from the *tapping* Voyager's own current position — not from the shared destination. Tapping your own marker shows only your name, with no role or distance shown, since distance-from-yourself isn't a meaningful reading.

**Feature-specific NFRs:**
- Battery impact of continuous location tracking must be actively budgeted and load-tested — flagged as a high-severity risk in market research (Life360's battery-drain complaints are the category's most-cited failure).

### 4.4 Fun Fact Capture

**Description:** A hybrid model — some moments are manually tap-logged by Voyagers, others are detected automatically by the system — that together accumulate into the Fun Facts shown in Memory Lane. Realizes UJ-3.

**Functional Requirements:**

#### FR-10: Manual Fun Fact Logging

Any Voyager can manually log a spotting (police, deer, construction, and similar events) with a single tap. Realizes UJ-3.

**Consequences (testable):**
- Tapping a spotting control immediately sends a one-way, lighthearted notification to the rest of the Voyage's Voyagers — no reply or messaging capability.
- Each manual log is attributed to the logging Voyager and accumulates toward a Fun Fact (e.g., "most cop-sightings").

**Out of Scope:**
- "Missed exit" detection or alerting — dropped as too noisy/unreliable, since Voyagers often intentionally take different routes.
- In-app messaging or replies of any kind.

#### FR-11: Automatic Event Detection

The system automatically detects and logs qualifying events without requiring Voyager action. Realizes UJ-3.

**Consequences (testable):**
- Long stops (e.g., gas or rest-area stops exceeding a duration threshold) are detected and trigger a one-way lighthearted notification to the rest of the group. `[ASSUMPTION: exact stop-duration threshold TBD]`
- State/country border crossings are detected and time-stamped, banked as a future Fun Fact without notifying anyone mid-drive.
- Detected events require no Voyager confirmation to be logged.

**Out of Scope:**
- Automatic "missed exit" or route-deviation detection (explicitly dropped, see FR-10).

#### FR-12: In-App Photo Logging

Any Voyager can attach a photo to a moment (such as a detected stop) during the Voyage. Realizes UJ-3.

**Consequences (testable):**
- Photos are stored and associated with both the Voyage and the logging Voyager.
- Logged photos become source material for Memory Lane (FR-14).

**Feature-specific NFRs:**
- Auto-detection (FR-11) must be validated for an acceptably low false-positive rate before wide release — the same reliability concern that led to dropping the "missed exit" alert applies here.

### 4.5 Onboarding Nudges

**Description:** Because Voylo's value isn't self-evident the way GPS navigation's is, first-time Voyagers need to discover what they can do — solved with one-time, contextual nudges tied to real moments rather than an upfront tutorial. Realizes UJ-3 (discoverability).

**Functional Requirements:**

#### FR-13: One-Time Contextual Nudges

The system shows a first-time Voyager a single, dismissible contextual tip the first time a relevant feature becomes newly relevant. Realizes UJ-3.

**Consequences (testable):**
- A tip introducing manual Fun Fact logging (FR-10) appears once, shortly after a Voyage starts, for any Voyager who hasn't seen it before.
- A tip inviting a photo add (FR-12) appears once, the first time the system auto-detects a stop (FR-11) for that Voyager.
- Each distinct nudge fires at most once per Voyager, ever, and requires no more than a single tap (or nothing) to dismiss.

**Out of Scope:**
- Persistent tutorials, onboarding checklists, or recurring/repeating reminders.

### 4.6 Memory Lane

**Description:** The emotional and shareable payoff of the whole Voyage — everything quietly captured along the way, assembled into a highlight-reel experience. Realizes UJ-4.

**Functional Requirements:**

#### FR-14: Generate Memory Lane

The system generates a Memory Lane highlight experience when a Voyage ends. Realizes UJ-4.

**Consequences (testable):**
- Memory Lane includes accumulated Fun Facts (FR-10, FR-11), logged photos (FR-12), and other in-drive moments, presented as a highlight-reel-style experience.
- Generation is triggered once an Organizer manually taps "End Voyage" (FR-6) — not auto-detected on arrival, since Voyagers arrive at different times and ending on the first arrival would cut off Fun Facts/moments for Voyagers still en route.
- A solo (unjoined) Voyage still produces a complete Memory Lane for its single Voyager.

#### FR-15: View Memory Lane Together

All Voyagers on a completed Voyage can view its Memory Lane. Realizes UJ-4.

**Consequences (testable):**
- Memory Lane is accessible, from their own app, to every Voyager who participated in the Voyage.
- Voyagers can revisit Memory Lane after the Voyage ends — not a one-time-only view.

#### FR-16: Share Memory Lane Externally

Any Voyager can share their Voyage's Memory Lane to external platforms. Realizes UJ-4.

**Consequences (testable):**
- Sharing produces a self-contained artifact (image, video, or card) viewable by someone who does not have the Voylo app — the mechanic market research identified as Voylo's strongest, lowest-cost growth channel.
- Content that features another Voyager (e.g. a photo they appear in) requires that Voyager's consent before it can be included in anything shared externally — a Voyager cannot unilaterally share content featuring other Voyagers without their opt-in. `[NOTE FOR PM: consent-collection mechanism (e.g. per-photo opt-in, blanket Voyage-level consent) not yet designed — needs a UX pass.]`

**Feature-specific NFRs:**
- Share-asset generation should be fast enough not to break the emotional momentum of the "wow" moment. `[NOTE FOR PM: no defined performance target yet — revisit with engineering]`

## 5. Product Experience & Constraints

### 5.1 Aesthetic and Tone

Voylo must feel like a game, not a utility: glamorous, clean, intuitive, and — in the founder's own words — "sexy," incredibly appealing, as if the Voyager is a character inside the experience rather than a user checking an app. Every sensory layer (visuals, motion, sound, copy) carries the emotional north-star from §2.1: a Voyager should finish a Voyage wanting to do another one. A specific effect to design for: Voyagers who *don't* contribute (no Fun Fact taps, no photos) should feel a gentle sense of FOMO about their thinner presence in Memory Lane — a pull toward participating, not a guilt-trip.

**Anti-reference:** explicitly not utilitarian/corporate in feel — competitors researched (Life360, Zello, Convoy Tracker) all present as safety/navigation tools first; Voylo should read as entertainment first.

**Voice example (from brainstorming, worth preserving as a content-tone reference for Memory Lane copy):** *"The map said five hours. The memories took twelve."* — delay and detours are framed as the story, not an apology. A "Planned vs. Actual" stat in this voice is a good candidate for Memory Lane (FR-14) once it's built in v1.1.

`[NOTE FOR PM: no concrete visual references given yet — see Open Question 3.]`

### 5.2 Platform

- **v1:** Native iOS and Android app.
- **Later (not in this PRD's scope):** A web companion, primarily so someone without the Voylo app can still view a shared Memory Lane.

### 5.3 Monetization

`[ASSUMPTION: fully free for v1 and v1.1, monetization strategy deferred until the core loop and Memory Lane's growth loop are proven — not explicitly confirmed with the user. Consistent with market research finding that freemium conversion in this category is low (~2% median) and shouldn't be relied on for early traction.]`

### 5.4 Constraints and Guardrails

**Privacy:** Location and trip data is scoped to the Voyage's own Voyagers only — never sold or shared with third parties (data brokers, advertisers, etc.). This is a direct, deliberate counter-position to Life360's documented history of selling location data to data brokers, and should be visible to users (e.g. at sign-up), not just a privacy-policy clause.

**Safety:** The police Fun Fact is retrospective and lighthearted only (see Non-Goals, §6) — legal review of this specific feature is recommended before wide release, since real-time hazard/police-alert legality varies by jurisdiction (flagged in market research). Separately, manual Fun Fact logging and photo capture (FR-10, FR-12) are designed for passengers, not the driver — the driver should be able to experience Voylo ambiently (glancing at the live map, hearing notifications) without needing to interact with the phone while driving; this should inform interaction design, not just be assumed.

**Cost:** No infrastructure/API cost constraints have been discussed yet for v1's scope (auth, live map, presence). `[NOTE FOR PM: if a future AI-content-generation capability (raised earlier in this project's brainstorming, not scoped into this PRD's v1 or v1.1) is pursued later, cost and battery impact should both be modeled before commitment — flagged as an Open Question, §9.]`

### 5.5 Cross-Cutting NFRs

- **Performance:** Live map location updates must feel real-time without materially degrading device battery life over a multi-hour drive — this is the single most-cited failure mode of the category leader (Life360) and a hard quality bar for Voylo.
- **Reliability:** Core Voyage lifecycle (start, join, live tracking, end) must degrade gracefully through cellular dead zones common on long highway drives — a drop in connectivity should not silently lose a Voyager from the map or corrupt Voyage state.
- **Security:** OTP-based session tokens must be stored and transmitted securely; a compromised session should be revocable (sign-out on all devices) `[NOTE FOR PM: no such control specified yet — revisit if needed for v1]`.

## 6. Non-Goals (Explicit)

- **No in-app messaging or chat** between Voyagers — notifications are strictly one-way (system-to-group), by design, not just a v1 gap.
- **No real-time missed-exit or route-deviation alerting** — dropped for reliability; group members routinely take intentionally different routes, making this too noisy to trust.
- **No real-time law-enforcement-evasion tooling** — the police Fun Fact is a retrospective, lighthearted stat only, never a live warning system. Explicit boundary given the legal/jurisdictional risk market research flagged.
- **No commercial/logistics fleet or trucking dispatch functionality** — different domain (dispatch, compliance, cargo), not this product.
- **No Organizer approval/gatekeeping on joins** — holding a valid Join Code/Link is sufficient; this is a deliberate frictionless-by-design choice, not a missing permission feature.

## 7. MVP Scope

### 7.1 In Scope

- Passwordless email OTP authentication (FR-1, FR-2)
- Voyage Setup & Invite: Start Voyage, Join Code/Link generation, Join via Code/Link, End Voyage, Grant Organizer Status, Remove Voyager (FR-3, FR-4, FR-5, FR-6, FR-7, FR-8)
- Live Map & Presence: real-time shared Voyager map (FR-9)

### 7.2 Out of Scope for MVP

- **Fun Fact Capture** — manual spotting logs (FR-10), automatic event detection (FR-11), in-app photo logging (FR-12). Deferred to v1.1.
- **Onboarding Nudges** (FR-13) — deferred to v1.1; nothing to nudge toward without Fun Fact Capture live.
- **Memory Lane** — generation, group viewing, and external sharing (FR-14, FR-15, FR-16). Deferred to v1.1.

  `[NOTE FOR PM: Deliberate, confirmed tradeoff, not an oversight — Fun Facts and Memory Lane are Voylo's differentiator and primary growth channel per market research, so v1 launches without what makes it different or how it's meant to spread. That window isn't indefinite: Convoy Tracker already has the harder live-map/voice/replay infrastructure working and is best-positioned to add a recap layer of its own. Prioritize v1.1 accordingly.]`

- Phone-number OTP (planned after email OTP proves out).

## 8. Success Metrics

**Primary**
- **SM-1**: Voyage completion rate — % of started Voyages that reach "End Voyage" (FR-6) with 2+ Voyagers joined. Validates FR-3, FR-5, FR-6.
- **SM-2**: Join conversion rate — % of Join Code/Link opens (FR-5) that complete OTP authentication (FR-1) and successfully join. Validates FR-1, FR-5.

**Secondary**
- **SM-3**: Repeat Voyage rate — % of Organizers who start a second Voyage within 90 days, even without Memory Lane's pull in v1. The core signal that the bare v1 loop has standalone value before investing in v1.1. Validates the v1 loop overall.
- **SM-4**: Invite K-factor — average Join Code/Link sends per Organizer × conversion rate of those invites into joined Voyagers. Target > 1.0 for compounding growth, per the referral-growth benchmarking in market research. Validates FR-4, FR-5.

**Counter-metrics (do not optimize)**
- **SM-C1**: Battery drain per hour of active tracking — must not be sacrificed to make the live map (FR-9) feel more "real-time" via higher-frequency location pings. Counterbalances SM-3.
- **SM-C2**: OTP failure/resend rate — join conversion (SM-2) must not be inflated by loosening auth reliability or security (FR-1).

## 9. Open Questions

1. Exact GPS/location refresh interval for the live map (FR-9) — balances battery cost vs. live-feel; needs engineering input.
2. Exact stop-duration threshold for automatic long-stop detection (FR-11).
3. Concrete visual direction for the "game-like, not a boring map" treatment (FR-9) and the broader glamorous/game-like aesthetic (§5.1) — recommend a dedicated `bmad-ux` pass.
4. OTP delivery SLA and session-security controls (e.g. remote sign-out) — needs engineering input (§5.5).
5. Share-asset generation performance target for Memory Lane (FR-16) — needs engineering input.
6. Monetization strategy (§5.3) — currently assumed free-for-now; revisit once the v1 loop and v1.1 Memory Lane are proven.
7. Where the previously-discussed Groq-powered AI content-generation agent (raised during brainstorming, not scoped into this PRD) fits on the roadmap relative to v1.1 Memory Lane — including its cost and battery implications (§5.4).
8. Legal review of the police Fun Fact across target jurisdictions (§5.4) — recommended before wide release.
9. Market sizing for Voylo's exact category is unproven (third-party estimates disagreed by an order of magnitude in market research). Research recommended a cheap demand-validation step (e.g. a landing-page/waitlist test) before heavy build-out — not yet acted on.
10. Indefinitely-running Voyages (an Organizer who never taps End Voyage) are an accepted v1 risk, not solved upfront (FR-6) — revisit if real-world usage shows this is a real problem (e.g. battery complaints, zombie Voyages).
11. Consent-collection mechanism for sharing content featuring other Voyagers (FR-16) — per-photo opt-in vs. blanket Voyage-level consent, or something else — needs a UX design pass.

## 10. Assumptions Index

- §5.3 Monetization — assumed fully free for v1/v1.1, not explicitly confirmed with the user.
- §4.3 (FR-9) — exact location refresh interval not yet defined.
- §4.4 (FR-11) — exact stop-duration threshold not yet defined.

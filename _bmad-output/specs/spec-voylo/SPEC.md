---
id: SPEC-voylo
companions:
  - glossary.md
  - success-metrics.md
  - ../../planning-artifacts/ux-designs/ux-trips-2026-07-25/DESIGN.md
  - ../../planning-artifacts/ux-designs/ux-trips-2026-07-25/EXPERIENCE.md
  - ../../planning-artifacts/architecture/architecture-trips-2026-07-25/ARCHITECTURE-SPINE.md
sources:
  - ../../planning-artifacts/prds/prd-trips-2026-07-25/prd.md
---

> **Canonical contract.** This SPEC and the files in `companions:` are the complete, preservation-validated contract for what to build, test, and validate. Source documents listed in frontmatter are for traceability only — consult them only if you need narrative rationale or prose color this contract intentionally omits.

# Voylo

## Why

Group road trips currently produce no shared record of the experience: coordination happens over ad hoc text threads and a flat location dot, and the trip itself leaves nothing anyone wants to revisit or share afterward. This is both a pain (friend groups and families lose track of each other and the story of the drive) and an opportunity market research confirmed as real and currently unclaimed — road-trip and group-location-sharing behavior is large and growing, but no existing product combines live group presence with an entertainment-first, shareable recap. The category leader (Life360) carries a documented trust liability from selling location data; the closest functional competitor (Convoy Tracker) has not attempted the fun-first framing. Voylo claims that gap: a mobile app where a group driving together sees each other live on a game-like map, ending in Memory Lane, a shareable highlight-reel payoff. Affects friend-group and family road-trippers running multi-car trips together. The opportunity window is open now but not indefinite.

## Capabilities

- **CAP-1** *(v1)*
  - **intent:** A user can authenticate via a one-time emailed code, no password.
  - **success:** A valid, unexpired code signs the user in; an invalid or expired code shows a clear error with a resend option.
- **CAP-2** *(v1)*
  - **intent:** An authenticated user stays signed in until they explicitly sign out.
  - **success:** No re-authentication prompt on relaunch; signing out invalidates the session on that device, and (per architecture AD-4) on every device via global sign-out.
- **CAP-3** *(v1)*
  - **intent:** An Organizer can start a new Voyage with a single destination.
  - **success:** Creates the Voyage with its creator as first Organizer and first Voyager, live tracking already active; no second destination can be added to the same Voyage.
- **CAP-4** *(v1)*
  - **intent:** An Organizer can obtain a shareable Join Code/Link for an active Voyage.
  - **success:** Available immediately on Voyage start, shareable via the OS share sheet, valid for the Voyage's full duration.
- **CAP-5** *(v1)*
  - **intent:** Any user can join an active Voyage via a valid Join Code/Link, no approval required.
  - **success:** An invitation screen shows before any authentication is requested; completing OTP auth adds the user as a Voyager immediately visible on the live map; joining after start produces a "fashionably late" Fun Fact, not an error.
- **CAP-6** *(v1)*
  - **intent:** An Organizer can manually end an active Voyage.
  - **success:** Ending stops new recording immediately but lets in-flight captures finish; never auto-triggered on any Voyager's arrival. A v1 build surfaces a calm "Voyage Ended" summary as the terminal state (superseded by Memory Lane once v1.1 ships).
- **CAP-7** *(v1)*
  - **intent:** An Organizer can grant Organizer status to another Voyager.
  - **success:** The newly granted Voyager gains the same End Voyage / Remove Voyager / Grant Organizer Status capabilities; a Voyage can have more than one Organizer.
- **CAP-8** *(v1)*
  - **intent:** An Organizer can remove a Voyager from an active Voyage.
  - **success:** The removed Voyager's location and further Fun Fact capture immediately stop being visible/possible; this is the primary mitigation for an accidentally-leaked Join Code/Link.
- **CAP-9** *(v1)*
  - **intent:** Any Voyager can see all Voyagers' live locations on one shared, game-like map for the active Voyage.
  - **success:** Positions update near-real-time; the map is not a standard turn-by-turn view; visibility is scoped to that Voyage's own Voyagers only.
- **CAP-10** *(v1.1)*
  - **intent:** Any Voyager can manually log a spotting (police, deer, construction, etc.) with one tap.
  - **success:** Sends a one-way, lighthearted notification to the group and accumulates toward a Fun Fact attributed to that Voyager; no reply capability exists.
- **CAP-11** *(v1.1)*
  - **intent:** The system automatically detects and logs long stops and border crossings, no Voyager action required.
  - **success:** Long stops trigger a one-way group notification; border crossings are time-stamped and silently banked; no "missed exit" detection is attempted.
- **CAP-12** *(v1.1)*
  - **intent:** Any Voyager can attach a photo to a moment during the Voyage.
  - **success:** Photos are stored per Voyage and Voyager and become Memory Lane source material.
- **CAP-13** *(v1.1)*
  - **intent:** First-time Voyagers get one-time, contextual nudges introducing Fun Fact logging and photo capture, at the moment each becomes relevant.
  - **success:** Each distinct nudge fires at most once per Voyager, ever; no persistent tutorial exists.
- **CAP-14** *(v1.1)*
  - **intent:** The system generates a Memory Lane highlight-reel when a Voyage ends.
  - **success:** Includes accumulated Fun Facts, photos, and in-drive moments; generation triggers on End Voyage; a solo (unjoined) Voyage still produces a complete Memory Lane.
- **CAP-15** *(v1.1)*
  - **intent:** All Voyagers on a completed Voyage can view and revisit its Memory Lane.
  - **success:** Every participating Voyager can open Memory Lane from their own app, any time after the Voyage ends, not just once.
- **CAP-16** *(v1.1)*
  - **intent:** Any Voyager can share their Voyage's Memory Lane to external platforms.
  - **success:** Produces a self-contained artifact viewable without the Voylo app; content featuring another Voyager requires that Voyager's consent (per-share approval, see `EXPERIENCE.md` "Trust, Privacy & Consent") before it can be shared externally.

## Constraints

- Native iOS and Android app in v1 (no web companion — see Non-goals).
- Voyage data (location, Fun Facts, photos) is scoped to that Voyage's own Voyagers only — never sold or shared with third parties.
- No in-app messaging or reply capability anywhere; every notification is one-way, system-to-group.
- The police Fun Fact is retrospective and lighthearted only, never a live warning system — explicit boundary given jurisdictional legal risk.
- Manual Fun Fact logging and photo capture are for passengers only; driver enforcement is consent-based (a self-declared role plus a one-time Driver Attention Consent acknowledgment), not sensor or technical detection — a deliberate, disclosed tradeoff.
- Single destination per Voyage in v1; no multi-leg itinerary planning.
- Holding a valid Join Code/Link is sufficient to join — no Organizer approval/gatekeeping step.
- A Voyager belongs to at most one active Voyage at a time, enforced at the database level.
- Battery impact of continuous location tracking must be actively budgeted and load-tested — the category's most-cited failure mode.
- Core Voyage lifecycle must degrade gracefully through cellular dead zones — a connectivity drop must never silently lose a Voyager or corrupt Voyage state.

## Non-goals

- No in-app messaging or chat.
- No real-time missed-exit or route-deviation alerting.
- No real-time law-enforcement-evasion tooling.
- No commercial/logistics fleet or trucking dispatch functionality.
- No solo (non-group) drivers as a use case.
- No payments or monetization infrastructure in v1 or v1.1.
- No phone-number OTP in v1 (email OTP only, for now).
- No web companion in v1 or v1.1.

## Success signal

A group starts a Voyage, invites others via a link, sees everyone live on the map for the whole drive, and ends it cleanly with a calm summary — demonstrable end to end without Fun Facts or Memory Lane existing yet. At least one Organizer starts a second Voyage within 90 days, showing the bare v1 loop has standalone value before v1.1 investment. Full metrics dashboard in `success-metrics.md`.

## Assumptions

- Monetization is fully free for v1 and v1.1, with no billing infrastructure — not explicitly confirmed by the user; revisit once the core loop and Memory Lane are proven.

## Open Questions

- Exact GPS/location refresh interval for the live map (CAP-9) — trades battery cost against live-feel, needs engineering input.
- Exact stop-duration threshold for automatic long-stop detection (CAP-11).
- OTP delivery SLA — no concrete target set anywhere yet.
- Share-asset generation performance target for Memory Lane (CAP-16).
- Where the Groq-powered AI content-generation agent (provider already confirmed in `ARCHITECTURE-SPINE.md`) fits on the roadmap relative to v1.1 Memory Lane — timing/sequencing is open, not the provider choice.
- Legal review of the police Fun Fact across target jurisdictions — recommended before wide release.
- Market sizing for Voylo's exact category is unproven (third-party estimates disagreed by an order of magnitude). A cheap demand-validation step (e.g. a landing-page/waitlist test) was recommended and not yet acted on.
- Indefinitely-running Voyages (an Organizer who never taps End Voyage) are an accepted v1 risk, not solved upfront — revisit if real-world usage shows a real problem (battery complaints, zombie Voyages).

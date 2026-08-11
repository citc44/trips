---
topic: The Living Voylo live roadbook and Memory Lane
goal: Preserve the approved future feature direction and implementation boundaries
mode: product-architecture-memory
status: approved-direction-not-implemented
updated: 2026-08-10T00:00:00-04:00
---

- (decision) The strongest next major capability is The Living Voylo: one trusted event timeline powering an ambient live Roadbook, route mile markers, and the end-of-Voyage Memory Lane.
- (product) The live map answers where everyone is; The Living Voylo answers what the journey is becoming. Voylo is “real life becomes a game, then becomes a story,” not primarily a convoy utility.
- (invariant) Live feed and recap are projections of the same canonical Voyage-scoped events. Never create competing truth stores.
- (invariant) Deterministic structured events and narration ship before generative AI. AI may rewrite verified facts but cannot create canonical events or invent names, places, times, people, or statistics.
- (invariant) The feature is ambient. Driving-role users never receive manual capture/edit controls. Never reward unsafe speed or driving without breaks.
- (sequence) Build timeline/history/reconciliation, then passenger moments/photos, then calibrated automatic moments, then deterministic Memory Lane, then consent-aware sharing, then optional AI/video polish.
- (privacy) Precise traces have bounded retention and are not the recap product. External sharing is a separate per-content consent boundary. Sensitive locations must be hidden/generalized before narration or sharing.
- (dependency) Completed-Voyage authorization must be designed before revisitable Memory Lane; current active-member-only access semantics are not sufficient by themselves.
- (dependency) Companion/vehicle grouping precedes correct per-car story statistics and group-stop deduplication.
- (non-goal) No general chat, PTT radio, public feed, raw GPS replay, real-time police-evasion alerting, missed-exit accusations, or fully AI-generated video in the first release.
- (metric) Optimize meaningful-event rate, recap opens/revisits/shares, repeat Voyages, classifier correction rate, offline recovery, generation latency, battery/network cost, and zero driver-control exposure—not number of cards.
- (source) Full design: `docs/VOYLO-LIVING-VOYLO-FEATURE-CONCEPT.md`.

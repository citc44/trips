---
topic: Voylo automatic stop, traffic, and place classification
goal: Preserve reviewed intent and guardrails for future AI implementation
mode: architecture-memory
status: proposed-not-authorized
updated: 2026-08-10T00:00:00-04:00
---

- (status) Documentation/research only. Do not implement until the user explicitly approves this architecture.
- (decision-proposal) Replace coffee-specific detection with a generic stop candidate detector. Coffee/fuel/rest-area are classification results, never detector assumptions.
- (invariant) A nearby POI does not prove a visit. Exact-place classification requires trajectory, road, traffic, dwell, accuracy, entry/exit, and place evidence.
- (invariant) Traffic classification happens before venue classification. Traffic beside a POI must not create a venue event.
- (provider) Mapbox is primary for Map Matching, Directions traffic/incidents, and Search Box because Voylo already renders Mapbox and has compatible infrastructure.
- (provider) A secondary provider is queried only for ambiguous cases and only after licensing/attribution review. Foursquare Place Snap is the leading escalation candidate; Google is viable but awkward on a Mapbox surface.
- (invariant) Public OSM Nominatim is not an automatic production classifier under its usage policy.
- (domain) One idempotent `stop` event evolves through candidate/confirmed/completed/corrected. Normalized primary/secondary categories are metadata.
- (confidence) High confidence may show exact name; medium shows category; low shows generic pit stop or suppresses. Unknown is a successful safe outcome.
- (privacy) Never infer or retain sensitive-place traits. Precise temporary traces do not enter general logs and have bounded retention.
- (offline) Candidate detection continues locally. Classification may happen after reconnect using compact retained evidence; original occurrence time is preserved.
- (dedupe) Companion phones represent one vehicle event. Independent convoy vehicles may share a group stop while retaining participation evidence.
- (validation) Run shadow mode and a labeled field dataset before notifications. Target >95% precision for high-confidence exact/category outputs; accept unknowns rather than false certainty.
- (operations) Provider failure/rate limiting must not affect live location. Classification is one workflow per candidate, never per GPS fix.
- (reference) Full document: `docs/VOYLO-STOP-INTELLIGENCE-ARCHITECTURE.md`.
- (reference) BMAD extension: `_bmad-output/planning-artifacts/architecture/architecture-trips-2026-07-25/STOP-INTELLIGENCE-ARCHITECTURE.md`.

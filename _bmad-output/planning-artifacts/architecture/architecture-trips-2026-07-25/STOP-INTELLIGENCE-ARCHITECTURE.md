---
name: 'Voylo Stop Intelligence'
type: architecture-extension
purpose: reviewable-design
altitude: capability
status: approved-shadow-foundation
created: '2026-08-10'
updated: '2026-08-10'
parent: ARCHITECTURE-SPINE.md
companion: ../../../../../docs/VOYLO-STOP-INTELLIGENCE-ARCHITECTURE.md
---

# Architecture Extension — Stop Intelligence

This capability extends AD-2/AD-14. Its foundation was approved and implemented in shadow mode on 2026-08-10. The complete technical narrative, diagrams, failure matrix, provider research, domain contract, rollout state, and validation plan live in `docs/VOYLO-STOP-INTELLIGENCE-ARCHITECTURE.md`.

## Binding proposal

1. Stop detection is generic and provider-independent; no detector is named after coffee, fuel, or another conclusion.
2. Detection, stop-versus-traffic classification, and venue/category classification are separate stages.
3. Mapbox supplies primary road matching, traffic context, and POI candidates. A secondary place provider is adaptive, not unconditional.
4. The durable entity is one idempotent `stop` journey event with a lifecycle; category is normalized metadata, not a proliferation of event types.
5. Exact names require calibrated high confidence and a provider-licensing decision. Medium confidence produces category-only copy; low confidence produces generic copy or no event.
6. Presence of a nearby POI never proves a visit. Trace geometry, road alignment, traffic, convoy corroboration, dwell, accuracy, and entry/exit behavior are fused.
7. User correction updates the existing event and is the final product truth.
8. Shadow-mode field validation precedes user-visible automatic classification.

```mermaid
flowchart LR
  Candidate[Generic stop candidate] --> Motion[Trace/motion evidence]
  Candidate --> Road[Road + traffic evidence]
  Candidate --> POI[Place candidates]
  Candidate --> Convoy[Voyage corroboration]
  Motion --> Fusion[Versioned evidence fusion]
  Road --> Fusion
  POI --> Fusion
  Convoy --> Fusion
  Fusion --> Traffic[Traffic]
  Fusion --> Exact[Exact venue]
  Fusion --> Category[Category only]
  Fusion --> Generic[Generic/unknown]
  Fusion --> Suppress[Suppress]
```

## Production gate

The detector, schema, durable submission, and Mapbox-primary shadow worker are implemented. Automatic notifications, exact-name Memory Lane persistence, adaptive secondary providers, and companion deduplication remain gated by the field validation, licensing, and product decisions in the full document.

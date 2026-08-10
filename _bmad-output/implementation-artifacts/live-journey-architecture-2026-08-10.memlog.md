---
topic: Voylo hybrid live-location and journey-event architecture
goal: Preserve architectural intent, hazards, invariants, and implementation guidance for future AI development
mode: architecture-memory
status: active
updated: 2026-08-10T00:00:00-04:00
---

- (decision) Voylo uses a hybrid system: low-latency Realtime signals plus periodic durable Postgres snapshots; location is no longer database-first in the healthy foreground path.
- (decision) Do not introduce WebRTC/P2P as the primary transport. NAT/TURN, mobile suspension, mesh scaling, access revocation, and recovery make a server relay the correct boundary.
- (invariant) One private Realtime topic per Voyage carries all typed signals. Do not create an unrelated socket lifecycle for each feature.
- (invariant) The self marker updates from local GPS immediately. Never wait for Supabase to echo the sender's own location.
- (invariant) Every location carries protocol version, message id, sender session id, monotonic sequence, GPS `capturedAt`, speed, heading and accuracy. Server arrival time is not GPS capture time.
- (invariant) Location delivery is latest-state/loss-tolerant. Keep only the newest unsent fix; never replay an offline GPS queue as current movement.
- (invariant) Durable journey events are idempotent and database-authoritative. Broadcast-only delivery is allowed only for disposable UI effects.
- (security) Sender identity must be derived from or cryptographically constrained by the authenticated session. Never trust an arbitrary `senderUserId` in a client payload.
- (security) Active Voyage membership and parent Voyage status remain RLS/RPC boundaries for subscription, publishing, snapshots and events.
- (rendering) Avoid long interpolation toward stale coordinates. Use a short jitter buffer, at most two seconds of accuracy-aware prediction, short reconciliation, and snapping after long gaps.
- (reachability) Presence means connected socket only. Combine Presence, last GPS capture time and explicit health. Never tell users why a device is unavailable when the system only knows it is stale.
- (offline) Reconnect order: authenticate; reconcile Voyage/membership; restore snapshots; publish newest local fix; flush durable events. Reject/deduplicate obsolete writes explicitly.
- (event) Coffee stops use moving/candidate/confirmed/exited hysteresis. Client detection can propose; the server creates one idempotent `journey_events` row and broadcasts it.
- (compatibility) Keep legacy location RPC behavior through the mobile app adoption window. Database migrations must land before clients that require them.
- (operations) The fast signal path needs an independent kill switch/fallback. A rollback must retain durable snapshots and cold-start recovery.
- (measurement) Do not tune cadence by appearance alone. Gate production on capture-to-render latency, battery drain, message fan-out/quota, background behavior, and real two-car passing tests.
- (privacy) Never put precise coordinates in Sentry breadcrumbs or general application logs.
- (reference) Full narrative and failure matrix: `docs/VOYLO-LIVE-JOURNEY-ARCHITECTURE.md`.
- (reference) Canonical binding decisions: `_bmad-output/planning-artifacts/architecture/architecture-trips-2026-07-25/ARCHITECTURE-SPINE.md` AD-2, AD-3, AD-7, AD-8, AD-12 through AD-15.

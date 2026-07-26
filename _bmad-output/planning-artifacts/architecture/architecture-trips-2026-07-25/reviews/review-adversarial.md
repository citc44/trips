---
name: 'Voylo — Adversarial Review of ARCHITECTURE-SPINE.md'
type: review
purpose: find AD-compliant-but-incompatible implementation pairs
target: _bmad-output/planning-artifacts/architecture/architecture-trips-2026-07-25/ARCHITECTURE-SPINE.md
status: draft
created: '2026-07-25'
---

# Adversarial Review — ARCHITECTURE-SPINE.md

Method: for each finding, construct two units one level down (two features, or two AI
dev agents each independently implementing a different feature/story off the same
PRD) that each satisfy every cited AD to the letter, and show the divergent, mutually
incompatible system that results. Each finding closes with a proposed new/tightened AD.

---

## Finding 1 — AD-9's "partial unique constraint" cannot literally be built as described, and its scope is ambiguous

**AD-9 rule (verbatim):** "a partial unique constraint ensures a user has at most one
non-removed `voyage_members` row on a Voyage with `status = 'active'` at any time."

**The gap:** a Postgres partial unique index can only filter on columns of the table it
indexes (`voyage_members`: `id, voyage_id, user_id, role, joined_at, removed_at`). It
cannot reference `voyages.status`, which lives on a different table. So the rule as
literally stated is not implementable as a plain partial unique index — the two
predicates ("non-removed" and "voyage is active") live on two different tables.
Nothing in AD-9 or the ERD flags this, and no AD assigns which agent resolves it or how.

**Two compliant-but-incompatible units:**

- **Agent A** denormalizes voyage status onto `voyage_members` (e.g. adds a
  `voyage_status` column, kept in sync via an `AFTER UPDATE` trigger on `voyages`), then
  builds the partial unique index: `UNIQUE(user_id) WHERE removed_at IS NULL AND
  voyage_status = 'active'`. This is a true race-proof unique index — but it creates a
  second, denormalized source of truth for voyage status that a different feature
  (`features/organizer`, ending a Voyage) must remember to keep synchronized, and the
  ERD in the spine has no such column.
- **Agent B** instead enforces the rule with a `BEFORE INSERT/UPDATE` trigger that does
  a subquery join to `voyages.status` at write time and raises an exception on
  violation. This matches AD-9's stated predicate exactly and needs no schema change —
  but under default Postgres `READ COMMITTED` isolation, two concurrent inserts (e.g.
  two devices for the same user each rejoining at the same instant, or an outbox flush
  racing a live UI action) can both pass the "check" before either commits, so **both
  rows commit** and the very constraint AD-9 exists to guarantee ("EXPERIENCE.md's IA
  assumes [two active Voyages] is impossible") is silently violated exactly under the
  concurrency conditions AD-7's offline outbox is designed to produce.

Also ambiguous independent of the above: does "at most one non-removed row on a Voyage"
mean (a) at most one *active-voyage* membership globally per user, or (b) at most one
row *per (voyage, user) pair* (i.e. just de-duplication within a single Voyage, which
would still allow a user to be an active member of two different Voyages
simultaneously)? The PRD/EXPERIENCE.md intent is clearly (a), but AD-9's sentence
grammatically supports (b) as much as (a) — "a Voyage" reads as "any given Voyage,"
not "across all Voyages." Two independently-built features could pick either reading
and both would cite AD-9 as their authority.

**Fix — tighten AD-9:**
1. State the scope unambiguously: "at most one non-removed `voyage_members` row **across
   all Voyages** where the referenced Voyage has `status = 'active'`, per user" (global,
   not per-voyage).
2. Mandate the enforcement mechanism, not just the outcome: either (a) require
   `voyages.status` denormalization onto `voyage_members` with a named sync trigger
   owned by a single migration, or (b) require `SERIALIZABLE` isolation (or an
   `advisory lock` on `user_id`) around any transaction that inserts an active
   membership row, so a trigger-based check cannot race. Leaving "enforced in the
   database" open to either a unique index or a same-transaction trigger check is what
   creates the incompatible pair.

---

## Finding 2 — AD-7's outbox has no defined reconciliation semantics when the target Voyage membership no longer holds at flush time

**AD-7 rule:** "the client persists a local write-outbox for any mutation attempted
while offline; the outbox flushes and reconciles against server state on reconnect."
"Reconciles" is not defined anywhere in the spine.

**Scenario:** Voyager U is a member of Voyage A, goes offline (dead zone). While
offline: the organizer removes U from A (`removed_at` set), or ends Voyage A
(`status='ended'`), or — per AD-9 as written today — U's account somehow becomes
associated with a different active Voyage via another session. U's client, unaware,
queued one or more writes against Voyage A (e.g., a location update, or per AD-7's own
bind list, a "grant/remove" action if U was an organizer of A). U reconnects.

**Two compliant-but-incompatible outbox implementations:**

- **Agent A** builds a strict FIFO outbox: items flush in enqueue order, and a failure
  (RLS denial once U's membership row is gone/`removed_at` is set, correctly enforced
  per AD-1) halts the queue so ordering is never violated. Result: any of U's *other*,
  unrelated queued writes (e.g., a profile update, or a different Voyage's join
  request) are now permanently stuck behind the failed item with no user-visible error
  and no way to drain — a silent deadlock.
- **Agent B** builds a per-item independent flush: each queued write is retried/failed
  independently, so unrelated writes still succeed. But a failed write is simply
  dropped once — no conflict is ever surfaced to the user ("your location share
  request could not be delivered because you were removed from this Voyage"), so U's
  client-side state (e.g., "pending grant organizer" UI) silently diverges from server
  truth with no reconciliation UI at all.

Both are valid readings of "flushes and reconciles against server state" — nothing in
AD-7 specifies per-item vs. all-or-nothing flushing, nothing specifies what "reconcile"
means when the precondition for a queued write (active membership) has been revoked
server-side while offline, and nothing requires surfacing the conflict to the user.

**Fix — new AD (or extend AD-7):** specify outbox flush semantics explicitly:
(1) flush is per-item, not FIFO-blocking; (2) each queued write carries the
`voyage_id`/membership snapshot it was created against; (3) on flush, if server-side
preconditions (active membership, active Voyage) no longer hold, the item is discarded
and a typed conflict event (not a raw error) is surfaced to the shared auth/session
hook (AD-4) so any feature can react (e.g., force the user back to Voyage Intro); and
(4) location writes are explicitly declared in-scope or out-of-scope for the outbox
(see Finding 3 — currently AD-7's bind list omits them entirely).

---

## Finding 3 — AD-3 location upserts have no timestamp guard, and AD-7 doesn't say whether location writes go through the outbox at all

**AD-3 rule:** "Only one latest-known-location row per Voyager
(`voyage_member_locations`, upserted in place) is persisted." No ordering/guard
condition is specified for the upsert.

**AD-7's bind list:** "all Voyage lifecycle writes (start/join/end/grant/remove) and
future Fun Fact/photo writes." Location upserts are conspicuously absent from this
list — which is itself ambiguous: is that an intentional exclusion (location pings are
explicitly ephemeral per AD-3, so they're not meant to survive a dead zone and should
just be dropped when offline), or an oversight, since AD-3's persisted row is still a
database write like any other?

**Two compliant-but-incompatible units, both implementing Live Map (FR-9):**

- **Agent A** reads AD-7's bind list literally: location upserts are *not* a "Voyage
  lifecycle write," so the location repository never queues to the outbox — when
  offline, `expo-task-manager` pings are simply dropped, and only the next successful
  ping after reconnect gets persisted. Safe, but silently loses the "last known
  location before going dark" signal other Voyagers may want (map shows U frozen at an
  old point until the very next ping succeeds — arguably fine, arguably a regression).
- **Agent B** reads AD-8 together with AD-7 more broadly ("all... writes" as
  inclusive) and queues location upserts to the shared outbox like any other mutation,
  so a backgrounded Voyager's buffered pings (L1@10:00, L2@10:01, L3@10:02, all queued
  while in a tunnel) all flush on reconnect. Because AD-3's upsert has no documented
  `WHERE new.updated_at > voyage_member_locations.updated_at` guard, and because the
  outbox flush (async, batched) can interleave with a fresh *direct* (non-queued) live
  ping the client sends the instant it regains signal, the three stale queued upserts
  can land at the server **after** the fresh ping, each unconditionally overwriting the
  row — leaving every other Voyager's map showing U at a stale tunnel-entrance
  coordinate instead of their current, correct one. This is exactly the "stale queued
  location overwrites a newer one" race the review was asked to look for, and it is not
  ruled out anywhere in the spine.

**Fix — tighten AD-3 and AD-7 together:**
1. AD-3: mandate the upsert be conditional — `INSERT ... ON CONFLICT (voyage_member_id)
   DO UPDATE SET lat=..., lng=..., updated_at=... WHERE
   voyage_member_locations.updated_at < EXCLUDED.updated_at` — so no write, queued or
   live, can ever regress the stored location, regardless of arrival order.
2. AD-7: explicitly state whether location upserts are in-scope for the outbox.
   Recommended: out of scope by design (matches AD-3's "ephemeral, not persisted
   per-ping" intent) — the outbox binds list should say so explicitly rather than
   leaving it inferable two different ways.

---

## Finding 4 — AD-5 mandates "a per-entity repository module" but not a single, discoverable one — two features can each build their own for the same table

**AD-5 rule:** "every Supabase query or mutation goes through a per-entity repository
module (e.g. `voyageRepository`, `memberRepository`). No screen or hook calls the
Supabase client SDK directly." Its own stated purpose: "prevents inconsistent query
shapes and caching behavior across independently-built features."

**The gap:** `voyage_members` is written to by *two* features per the Capability →
Architecture Map: `features/voyage-setup` (FR-3/4/5 — join creates a row with
`role='voyager'`) and `features/organizer` (FR-6/7/8 — end/grant/remove mutate
`role`/`removed_at` on that same row). AD-5 says each write must go "through a
per-entity repository module" — but nothing designates *one canonical file/module
name* for `voyage_members`, nor requires a registry/lookup step before creating a new
repository file.

**Two compliant-but-incompatible units:**

- **Agent A**, building `features/voyage-setup` first, creates
  `repositories/memberRepository.ts` with `insertMember()`, camelCase-mapped, errors
  wrapped as the spine's typed `{code, message}` shape.
- **Agent B**, building `features/organizer` independently (e.g. in parallel, or in a
  later sprint by a different AI dev agent with no visibility into Agent A's file),
  does not discover `memberRepository.ts` (or does, but judges its shape unsuited to
  "organizer actions" and decides those deserve their own module) and creates
  `repositories/organizerRepository.ts` with `updateRole()`, `removeMember()` — its own
  Supabase-response mapping, its own retry/error conventions.

Both literally satisfy AD-5 ("every mutation goes through *a* per-entity repository
module; no screen calls the SDK directly"). The result is two owners of one entity's
data-access layer: divergent query shapes, possibly divergent camelCase mappings or
error-shape conventions, and — worse — if either module independently decides to
also read `voyage_members` for its own caching, two independent caches of the same
table can now disagree, defeating the exact failure mode AD-5's own "Prevents"
clause names.

**Fix — tighten AD-5:** name the repository module 1:1 with the primary table it
owns, using the naming convention already given in Consistency Conventions
(`<entityName>Repository`), and state explicitly: *"there is exactly one repository
module per table; any feature that reads or writes that table imports the existing
module rather than creating a new one — repository module existence must be checked
(e.g. via the `repositories/` index) before a new one is authored."* Optionally list
the fixed repository→table map in the spine itself (as the source tree already
gestures at: `voyageRepository, memberRepository, locationRepository,
profileRepository`) so it's a lookup, not a judgment call, for whichever agent builds
the organizer feature.

---

## Finding 5 — AD-1's "keyed on voyage_members membership" doesn't say whether removed/ended-Voyage members are excluded — two RLS policies can both be "correct"

**AD-1 rule:** "authorization is enforced via Postgres Row-Level Security policies
keyed on `voyage_members` membership — never via application-layer checks alone."
It does not say whether "membership" means *any* row ever created for
`(voyage_id, user_id)`, or only a *currently valid* one.

**Two compliant-but-incompatible RLS policies, each written by a different agent
implementing a different table's policy off the same PRD:**

- **Agent A** (writing the policy for `voyage_member_locations`, FR-9 Live Map) writes:
  `USING (EXISTS (SELECT 1 FROM voyage_members vm WHERE vm.voyage_id = <target voyage>
  AND vm.user_id = auth.uid()))` — checks membership existence only. This is "keyed on
  `voyage_members` membership" by the letter of AD-1.
- **Agent B** (writing the policy for, say, a v1.1 `fun_facts` table under the same
  AD-1) writes the equivalent check *with* `AND vm.removed_at IS NULL`.

Under Agent A's reading, a Voyager who was removed by the organizer (PRD FR-8) — or
who was a member of a Voyage that has since ended (`status='ended'`) — retains
permanent read access to that Voyage's live location feed and any future
Fun-Fact/photo data, directly contradicting the PRD's "hard privacy requirement that
Voyage data never leaves that Voyage's own Voyagers" that AD-1 itself cites as its
justification. Both policies are defensible readings of the same one-sentence rule,
and because RLS policies are authored per-table by whichever feature/agent adds that
table, there is nothing in AD-1 forcing the two to converge.

**Fix — tighten AD-1:** specify the canonical membership predicate once, in the spine,
and require every RLS policy on every Voyage-scoped table to use it verbatim (e.g. as
a shared Postgres function `is_active_voyage_member(voyage_id uuid) returns boolean`
that all policies call, rather than each policy re-deriving its own `EXISTS` clause).
The predicate itself should explicitly state: membership requires `removed_at IS NULL`
**and** the referenced Voyage's `status = 'active'` (mirroring the same active-Voyage
concept Finding 1 shows AD-9 also needs to pin down) — history of a removed member's
past locations, if retained for audit, should be governed by a separate, explicit
retention rule, not left as a side effect of an underspecified `membership` check.

---

## Summary table

| # | Two units | Shared spine rule both obey | Divergent/incompatible outcome |
| - | --- | --- | --- |
| 1 | Agent A (denormalized status + unique index) vs Agent B (trigger + subquery) | AD-9 | Denormalized-status drift risk vs. race condition that lets two active Voyage memberships coexist |
| 2 | Agent A (FIFO-blocking outbox) vs Agent B (per-item, silent-drop outbox) | AD-7 | Stuck queue (silent deadlock) vs. silently lost user actions with no reconciliation UI |
| 3 | Agent A (location excluded from outbox) vs Agent B (location included, unguarded upsert) | AD-3 + AD-7 | Frozen-but-safe stale map point vs. stale queued ping overwriting a fresher live one |
| 4 | Agent A (`memberRepository`) vs Agent B (`organizerRepository`) both writing `voyage_members` | AD-5 | Two divergent data-access modules/caches for one table — exactly what AD-5 says it prevents |
| 5 | Agent A (RLS: membership = row exists) vs Agent B (RLS: membership = row exists AND not removed) | AD-1 | Removed/ended-Voyage members retain permanent read access under one valid reading of AD-1 |

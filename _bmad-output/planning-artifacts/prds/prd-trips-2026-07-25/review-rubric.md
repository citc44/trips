# PRD Quality Review — Voylo (prd-trips-2026-07-25)

## Overall verdict

This is an unusually disciplined PRD: decisions are stated as decisions, trade-offs are named with what was given up, and the `[ASSUMPTION]` / `[NOTE FOR PM]` tagging is used at real tensions rather than as decoration. The MVP-narrowing tradeoff (deferring the differentiator to v1.1) is handled honestly, with a competitive-timing risk named rather than buried. What's at risk is downstream-usability hygiene — a genuinely broken cross-reference, a section-numbering slip in the MVP Scope section, an Assumptions Index entry that doesn't roundtrip to its inline tag, and one under-specified journey (UJ-2 has no named protagonist) — none of which are conceptually hard to fix, but all of which will trip up a UX/architecture reader trying to source-extract cleanly.

## Decision-readiness — strong

Decisions are stated as decisions, not softened into "considerations": FR-3's "single destination per Voyage for v1 (confirmed)," FR-5's "Organizer approval... is sufficient to join (confirmed)," and the §7 MVP-scope cut are all explicit commitments, not hedges. Trade-offs name what was given up — e.g. §7's `[NOTE FOR PM]` on deferring Fun Facts/Memory Lane states plainly that "v1 launches as a live-map tracker without what makes Voylo different from existing tools, and without its main acquisition channel," and further names a live competitive-timing risk (Convoy Tracker) rather than treating the deferral as costless. Open Questions (§9) are genuinely unresolved — GPS refresh interval, stop-duration threshold, legal review, monetization — not rhetorical questions answered in the next sentence. No findings.

## Substance over theater — adequate

Vision (§1) and the persona/JTBD framing (§2.1) are product-specific, not swappable boilerplate — the "send me your Voylo" / Wordle line and the FOMO-without-guilt design note (§5.1) are earned specifics, not template filler. No persona theater: Chintan is the sole named protagonist and he actively drives UJ-1–UJ-3's beats.

### Findings
- **medium** Security NFR reads as boilerplate (§5.5) — "OTP-based session tokens must be stored and transmitted securely" is exactly the copied-boilerplate pattern the rubric warns about (cf. "system must be secure") — no standard, bound, or mechanism named, and the accompanying `[NOTE FOR PM]` only addresses revocability, not the storage/transmission claim itself. *Fix:* either give this a concrete bound (e.g., "tokens encrypted at rest; TLS for all transmission") or fold it into an `[ASSUMPTION]`/`[NOTE FOR PM]` like the rest of the NFRs in this section already do.

## Strategic coherence — strong

The thesis is explicit and singular: turn a scattered group drive into "a shared, living story" (§1), with the emotional payoff named as "the product's north star" that "must show up in every sensory layer" (§2.1). Feature prioritization follows the thesis, not ease — Auth and Voyage Setup are framed as emotional beats ("each screen is meant to produce a small 'wow'," §4.2) rather than administrative plumbing. Success Metrics are self-aware about the MVP's narrowed thesis-exposure: SM-3 explicitly measures "the core signal that the bare v1 loop has standalone value... even without Memory Lane's pull in v1" rather than pretending the MVP tests the full thesis. Counter-metrics (SM-C1, SM-C2) are present and correctly target the two ways the primary metrics could be gamed (battery, auth reliability). No findings.

## Done-ness clarity — strong

Nearly every FR has testable consequences with concrete pass/fail conditions (e.g. FR-2: "A visible sign-out action exists and immediately invalidates the session on that device"; FR-14: "Only the Organizer can end the Voyage"). Where a threshold is genuinely undetermined, the PRD tags it rather than hiding it in an adjective — FR-6's refresh interval and FR-8's stop-duration threshold are both `[ASSUMPTION]`-flagged and carried through to Open Questions (§9) and the Assumptions Index (§10), which is exactly the right move. The one soft NFR (§5.5 security, above) is the exception, not the pattern.

## Scope honesty — strong

§6 Non-Goals does real work (in-app messaging, missed-exit alerting, law-enforcement-evasion, fleet/logistics, join-gatekeeping are each explicitly ruled out with a reason, not just listed). `[ASSUMPTION]` tags are indexed at §10 and traceable to source. `[NOTE FOR PM]` callouts land at real unresolved tensions (§7's MVP-deferral risk, §5.4's future-AI-feature cost caveat, §5.1's missing visual references) rather than safe checkpoints. Open-items density (9 Open Questions, several `[NOTE FOR PM]`s, 3 inline `[ASSUMPTION]`s) is proportionate to a PRD that repeatedly and correctly recommends further passes (engineering input, a dedicated `bmad-ux` pass, legal review) before those items convert to commitments — it reads as honest sequencing, not an oversight. No findings beyond the roundtrip issue noted under Mechanical notes.

## Downstream usability — adequate

Glossary (§3) is present and its six terms are used consistently through the Features, Non-Goals, and MVP Scope sections. FR IDs are unique with no gaps (FR-1–FR-14). Cross-references generally resolve (e.g. FR-14 → FR-11 for Memory Lane triggering).

### Findings
- **medium** UJ-2 has no named protagonist (§2.3) — it's written as "One of the two other families" / "A joining Voyager," in contrast to UJ-1, UJ-3, and UJ-4, which all anchor to Chintan by name. The rubric treats named protagonists as load-bearing for consumer-product UJs; a floating, unnamed UJ is harder for UX to design a concrete flow against and breaks the pattern the other three journeys establish. *Fix:* name the joining persona (even a placeholder name) and carry it through UJ-2's path/climax/resolution the way Chintan is carried through the others.

## Shape fit — adequate

Consumer product with meaningful UX, correctly given UJ-led treatment — this is the right shape for Voylo. However, §2 asserts the product serves both "family Voyages (illustrated by UJ-1–UJ-4's Chintan) and friend-group Voyages" with the "underlying product mechanic serv[ing] both without requiring different builds," but no UJ actually illustrates a friend-group context — all four journeys run through Chintan's family-trip scenario. If the mechanic really is persona-agnostic this may be a non-issue, but as written it's an asserted claim with no journey evidence behind it, which downstream UX work would have to take on faith.

### Findings
- **low** Friend-group persona is named in §2 as an equally-served audience but has zero UJ coverage — every journey (UJ-1–UJ-4) is Chintan/family-context. *Fix:* either add a short friend-group UJ variant (even abbreviated) or add a line in §2 explicitly noting why family and friend-group journeys are expected to be structurally identical, so the omission reads as a decision rather than a gap.

## Mechanical notes

- **Broken cross-reference:** §5.5's Performance bullet reads "...over a multi-hour drive (see §5.6 in Feature 4.3's NFRs)" — the document has no §5.6; §5.5 is itself the last numbered subsection under §5, and the referenced battery NFR actually lives in §4.3. The pointer should read "(see §4.3's NFRs)" or similar.
- **Section-numbering slip:** §7 is titled "7. MVP Scope" but its subsections are numbered "### 6.1 In Scope" and "### 6.2 Out of Scope for MVP" (lines 320, 326) — orphaned from a renumbering, likely a leftover from when this was §6. Should be 7.1/7.2.
- **Assumptions Index roundtrip gap:** §10 lists "§4.1 (FR-2 NFR) — exact OTP delivery SLA not yet defined" as an indexed assumption, but the inline tag at that location (§4.1, line 115) is `[NOTE FOR PM: needs engineering input]`, not `[ASSUMPTION: ...]`. The other three index entries (§5.3, §4.3/FR-6, §4.4/FR-8) do correctly roundtrip to inline `[ASSUMPTION]` tags. Either retag line 115 as an `[ASSUMPTION]` or move this entry out of the Assumptions Index into a "flagged NOTE FOR PM items" list.
- **ID/document-order mismatch:** FR-14 (End Voyage) is numbered last but appears in document order inside §4.2, before FR-6–FR-13 (§4.3–§4.6). IDs are described as "globally-numbered" (§0) so this isn't technically wrong, but a reader scanning FR-6...FR-13 as a contiguous range following FR-14 in the text may be confused. Worth a one-line note in §0 that FR numbering reflects authoring order, not document order — or renumber.
- **Glossary term drift:** §3 defines the term as "Join Code / Join Link" (spaced, slash-separated) but every other usage in the document compresses it to "Join Code/Link" (e.g. §4.2, §6, §7). Cosmetic only.
- UJ protagonist naming: see Downstream usability finding above (UJ-2).

---
status: pending-approval
created: 2026-08-02
author: Correct Course workflow (Developer agent)
trigger: Direct user feedback on shipped UI (Live Map / navigation)
---

# Sprint Change Proposal — Voylo Visual Design System v2

## 1. Issue Summary

**Problem statement:** The shipped "Night Drive" dark/glass visual design system (`DESIGN.md`) — dark backgrounds, semi-transparent HUD/sheet surfaces, glow-based elevation — and the current navigation pattern (organizer actions via a bottom sheet) are being rejected by real user feedback on the built app as unclear, low-contrast, and hard to navigate.

**Discovery context:** Epics 1–3 (Sign-In & Trust, Voyage Creation & Group Management, Live Map & Presence) are functionally complete — all stories `done` as of the last several polish commits (most recent: `944c979`, manual join-code entry). This feedback arrived after real usage of the built app, not during story implementation.

**Evidence:** Direct user quote (2026-08-02): *"Everything is semi-transparent, dark and navigation is so bad."*

**Confirmed direction (via clarifying questions):**
- The solid-color, high-saturation, Waze-like aesthetic **replaces** the Night Drive dark/glass palette entirely — not a light/dark toggle.
- The breadcrumb-icon → drawer pattern **replaces** the current organizer bottom sheet entirely.
- The redesign applies **app-wide**, not just to the Live Map screen.

## 2. Impact Analysis

### Epic Impact

| Epic | Status | Impact |
|---|---|---|
| Epic 1 — Sign-In & Trust | done | Visual re-skin only (OTP, Trust Moment, Driver Consent) |
| Epic 2 — Voyage Creation & Group Mgmt | done | Visual re-skin + structural: `organizer-sheet` retired, replaced by breadcrumb→drawer |
| Epic 3 — Live Map & Presence | done | Heaviest impact: marker/status-pill re-skin, Live Map restructured (top banner + map) |
| Epic 4 (renumbered → 5) — Fun Fact Capture, v1.1 | backlog, not built | No rework — design to new system when built |
| Epic 5 (renumbered → 6) — Memory Lane, v1.1 | backlog, not built | No rework — design to new system when built |

No epic becomes obsolete. No FR is added, removed, or changes meaning. This is a redesign of *how* the product looks and is navigated, not *what* it does.

### Artifact Conflicts

- **PRD** — No functional requirement changes. PRD §5.1 ("not utilitarian/corporate... entertainment first," anti-referencing Life360/Zello/Convoy Tracker) and FR-9 ("stylized/game-like, not a standard turn-by-turn map") remain binding guardrails on the new palette — a solid/colorful arcade-style execution satisfies these fine; it's a style change, not a positioning change.
- **Architecture** — No impact. Purely visual/navigation; no data model, RLS, Realtime, or repository-layer changes.
- **UX Design (`DESIGN.md` + `EXPERIENCE.md`)** — Extensive:
  - Retire: Night Drive dark palette + Daylight-as-secondary framing; glassmorphism mechanism (`surface-glass`, blur, `scrimOpacityMin`) everywhere it's used (`hud-card`, `nudge-toast`, `organizer-sheet`); `organizer-sheet` component itself.
  - Build new: solid high-saturation palette (recomputed WCAG AA contrast from scratch); `action-drawer` component (breadcrumb-triggered, on-demand, houses End Voyage / Grant Organizer / Remove Voyager); Live Map restructure (solid top destination banner + map below, replacing floating top/bottom `hud-card` docking); re-specced `map-marker`, `status-pill`, buttons, `join-code-card`.
  - Preserve: typography system, spacing scale, rounded-corner scale, all `EXPERIENCE.md` behavioral/IA content (flows, driver-safety role model, consent flows), accessibility floor (re-validated against new values, not relaxed).
  - One precise IA wording amendment needed (see §4, EXPERIENCE.md line 53) so the new on-demand drawer doesn't read as contradicting the existing "no persistent drawer" principle.
- **Other artifacts** (deployment, IaC, monitoring, testing strategy, CI/CD) — No impact.

### Technical Impact

No architecture or infrastructure changes. Real rework of already-shipped UI code across Epics 1–3's screens and components (React Native/Expo, per `ARCHITECTURE-SPINE.md`'s existing layered structure) — implementation detail for the Developer agent once Story 4.1's design output exists, not a technical risk in itself.

## 3. Recommended Approach

**Selected: Direct Adjustment (Option 1), executed as a two-stage handoff.**

- Rollback (Option 2) is not viable: the functional plumbing (auth, Voyage lifecycle, Realtime location, RLS) built in Epics 1–3 is sound and untouched by this feedback — rolling back would discard working code for zero benefit.
- MVP scope review (Option 3) does not apply: no FR is added, removed, or descoped.
- Because the new palette/component specs require real design judgment (contrast computation, accessibility validation) rather than line-item token edits, this is scoped as: (1) a dedicated UX Designer pass (`bmad-ux`) against the brief in §4, producing the new `DESIGN.md`/`EXPERIENCE.md` content, followed by (2) Developer implementation against that output.

**Effort:** Medium-High (four new stories, touching UI code across three completed epics). **Risk:** Low (no architecture/data risk — contained to UI layer). **Timeline impact:** Real but contained; Epic 4/5 (v1.1, renumbered 5/6) are unaffected since they're not yet started.

## 4. Detailed Change Proposals

### 4.1 PRD — no edit
§5.1 and FR-9 stay as-is; carried into the UX brief below as a guardrail.

### 4.2 `EXPERIENCE.md` (line 53)

```
OLD:
Voylo has **no persistent tab bar and no drawer**. Navigation is a state machine, not a
multi-section app: `Home ↔ Intro/Picker/Join → Live Map → Wrap-up → Voyage Ended (v1) /
Memory Lane (v1.1+)`.

NEW:
Voylo has **no persistent tab bar and no persistent navigation drawer**. Navigation is a
state machine, not a multi-section app: `Home ↔ Intro/Picker/Join → Live Map → Wrap-up →
Voyage Ended (v1) / Memory Lane (v1.1+)`. The one exception is the Live Map's breadcrumb
icon, which opens an on-demand `action-drawer` (organizer/settings actions) that closes
after use — this is a transient action surface, not a persistent nav affordance, and does
not reintroduce a tab-bar-style IA.
```

### 4.3 UX Design Brief (input to the Story 4.1 `bmad-ux` session)

**Retire:** Night Drive dark palette + Daylight-secondary framing; glassmorphism (`surface-glass`, blur, `scrimOpacityMin`) in `hud-card`/`nudge-toast`/`organizer-sheet`; `organizer-sheet` component.

**Build new:** Solid-color, high-saturation "game map" palette (opaque surfaces, no transparency/blur anywhere, arcade/racing-game register per PRD §5.1) with WCAG AA contrast recomputed from real new values; `action-drawer` component (breadcrumb-triggered, on-demand, holds End Voyage / Grant Organizer / Remove Voyager); Live Map restructure (solid top destination banner + full map below); re-specced `map-marker`, `status-pill`, `button-ignition`, `button-secondary`, `button-destructive`, `join-code-card`, icon-forward where it improves clarity.

**Preserve:** Typography system (Clash Display / General Sans / Space Mono), spacing scale, rounded-corner scale; all `EXPERIENCE.md` behavioral/IA content (flows, state patterns, driver-safety role model, consent flows); PRD FR-9 + §5.1 guardrails; accessibility floor (re-validated, not relaxed).

### 4.4 `epics.md` restructure

```
NEW Epic 4: Visual Design System v2 (Cross-Cutting Redesign)
Replaces the shipped "Night Drive" dark/glass system with a solid-color, high-saturation
game-map aesthetic and a breadcrumb-icon action drawer, across all built screens.
**Epics touched:** 1, 2, 3 (re-skin only — no FR/behavior change)

  Story 4.1: UX Design System v2
    Produce the new DESIGN.md/EXPERIENCE.md sections per the UX Design Brief (§4.3) via
    a dedicated bmad-ux session. Design-only, no app code.

  Story 4.2: Action Drawer & Breadcrumb Navigation
    Build the new action-drawer component; wire the Live Map breadcrumb icon as its
    trigger; retire organizer-sheet (End Voyage / Grant Organizer / Remove Voyager move
    into the drawer).

  Story 4.3: Live Map Redesign
    Restructure Live Map to a solid top destination banner + map below; re-skin
    map-marker, status-pill, and remaining HUD elements to the new palette (drops
    glass/blur entirely).

  Story 4.4: Reskin Epic 1 & 2 Screens
    Re-skin OTP Sign-In/Verify, Trust Moment, Driver Attention Consent, Home, Voyage
    Intro, Destination Picker, Join Invitation, Voyage Ended to the new design system.
    No flow/logic changes.

RENUMBER: Epic 4 (Fun Fact Capture, v1.1) → Epic 5
          Epic 5 (Memory Lane, v1.1) → Epic 6

FR Coverage Map updates:
  FR-10, FR-11, FR-12, FR-13: "Epic 4" → "Epic 5"
  FR-14, FR-15, FR-16: "Epic 5" → "Epic 6"
```

## 5. Implementation Handoff

**Scope classification: Major** — requires a dedicated UX Designer pass before backlog/dev work can proceed (not just backlog reorganization, not directly dev-implementable as-is).

**Routing:**
1. **UX Designer (Sally / `bmad-ux`)** — owns Story 4.1: produce new `DESIGN.md`/`EXPERIENCE.md` content per the brief in §4.3, including the `EXPERIENCE.md` line-53 amendment in §4.2. This is the blocking prerequisite for 4.2–4.4.
2. **Product Owner / Developer** — apply the `epics.md` restructure in §4.4 and `sprint-status.yaml` update (this workflow applies both directly on approval, since exact text is already approved below); then sequence Stories 4.2–4.4.
3. **Developer** — implements Stories 4.2, 4.3, 4.4 against Story 4.1's output, following the existing code-review workflow per story (consistent with how Epics 1–3 were built).

**Success criteria:** New `DESIGN.md`/`EXPERIENCE.md` content ships with no transparency/blur anywhere, a solid high-saturation palette passing WCAG AA, a working breadcrumb→drawer replacing the organizer sheet, and a restructured Live Map (banner + map) — validated against the PRD §5.1/FR-9 "game-like, not utility" guardrail before merging Story 4.1's output.

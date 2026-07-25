---
status: draft
reviewed: 2026-07-25
reviewer: accessibility review pass (WCAG 2.1 AA baseline, adapted for native mobile)
sources:
  - DESIGN.md
  - EXPERIENCE.md
---

# Voylo — Accessibility Review (DESIGN.md + EXPERIENCE.md)

Scope: color contrast (Night Drive + Daylight palettes), touch target sizing (44×44pt iOS / 48×48dp Android), dynamic type, VoiceOver/TalkBack considerations for a map-centric interface, motion-reduction support, and the driver-safety interaction model specifically (does the spine deliver a genuinely low-distraction driving experience, or only gesture at one).

**Total findings: 16**

---

## Top-severity findings

### 1. [HIGH] Driver-role enforcement is self-declared, not verified — the core safety claim is opt-in
`EXPERIENCE.md` §Driver-Safety Interaction Model states the mechanism explicitly: "self-declared role, not sensor detection." A driver must manually tap "Switch to Driving" for the manual Fun Fact control and photo-attach control to disappear from their HUD. Nothing stops a driver from staying in (or defaulting to, since "skipping defaults to Riding") the Riding role while actually driving — at which point they have full manual logging affordances live on their HUD while operating the vehicle. The document's own framing ("Voylo trusts the Voyager to say who's driving") concedes this is a trust mechanism, not a safety gate. This is the central answer to whether the spine *delivers* vs. *gestures at* low-distraction driving: the UI gate only activates if the driver remembers, and wants, to flip a switch.
**Fix:** At minimum, layer a low-confidence heuristic nudge (e.g., prompt/re-confirm role on speed change, or default new Voyagers who move fast pre-role-selection to a "confirm you're not driving" prompt) rather than relying solely on a skippable, silently-defaulting self-report — or explicitly document this as an accepted v1 risk with a plan to add sensor corroboration later.

### 2. [HIGH] The single most safety-critical control (role-switch pill) has no defined touch-target, contrast, or size spec
The "Switch to Driving / Switch to Riding" status pill (`EXPERIENCE.md` §Driver-Safety Interaction Model) is the control a driver is expected to tap, ideally before moving. It does not appear anywhere in `DESIGN.md`'s `components:` block — no `minHeight`, no color/contrast pairing, no radius token. Every other interactive control (button-ignition, button-secondary, button-destructive, map-marker, fun-fact-badge) has a named token; this one, arguably the most consequential for driver safety, does not.
**Fix:** Add a `status-pill` (or similar) component token to DESIGN.md with an explicit `minHeight` ≥ 44pt/48dp and confirmed contrast, and treat it with the same "meaningfully larger than the floor" instruction already given to the Fun Fact log control.

### 3. [HIGH] Map marker touch target (40px) is below the document's own stated accessibility floor
`DESIGN.md.components.map-marker` sets `size: 40px`. `EXPERIENCE.md.Accessibility Floor` states "Tap targets ≥ 44pt (iOS) / 48dp (Android) everywhere," and `Component Patterns` confirms the marker itself is the tap target ("Tap opens a lightweight per-Voyager peek card"). 40px is below both platform minimums and directly contradicts the spine's own accessibility commitment — markers are also the densest tap targets on screen when several Voyagers cluster, compounding the miss-tap risk.
**Fix:** Either grow the visual marker to ≥44/48px, or keep the 40px visual size but pad the actual hit-region to the platform minimum (standard mobile pattern) and state that explicitly in the token.

### 4. [HIGH/MEDIUM] button-ignition text contrast fails WCAG AA across its own gradient
`button-ignition` background is `linear-gradient(135deg, accent-ignition, accent-violet)` with `ink-primary` foreground text. Computed contrast (sRGB relative luminance):
- `ink-primary (#F7F6FF)` on `accent-ignition (#FF5677)`: **≈2.86:1** — fails AA for both normal text (4.5:1) and large/bold text (3:1).
- `ink-primary` on `accent-violet (#9B6BFF)`: **≈3.29:1** — passes large-text AA (3:1) but fails normal-text AA (4.5:1).
This is the button used for Start Voyage, Join, and the ceremonial End Voyage confirm — the three most emotionally-loaded "wow" moments in the product — meaning the label text sitting over the coral end of the gradient is sub-AA-compliant on the flagship screens. The equivalent Daylight pairing (`ink-primary` on `accent-ignition-light #E23F63`) computes to **≈3.82:1**, still failing normal-text AA.
**Fix:** Either darken/desaturate the coral end of the gradient, increase label font weight/size enough to reliably clear the 3:1 large-text threshold everywhere on the gradient (and accept large-text-only AA), or add a subtle text shadow/scrim proven to restore effective contrast on-device.

### 5. [MEDIUM/HIGH] surface-glass HUD contrast is unverified against a dynamic, glowing background — precisely the glanceable surface
`hud-card` uses `surface-glass` (`#1E2547CC`, 80% opacity, 20px blur) floating over the live map. `DESIGN.md` itself flags this with `[ASSUMPTION: ... exact values need an on-device pass]`. Because the background isn't a flat color but a moving, glowing map (light-trail roads in `accent-electric`, comet-trails, marker glow), the actual rendered contrast behind HUD text is unbounded by the token alone — bright content behind the glass could drop text contrast well below AA at the exact moment a driver or riding passenger glances at the HUD. This is the same surface the "driver-safety implication" paragraph in `DESIGN.md.Typography` promises will stay at full `ink-primary` contrast — a promise the design system cannot currently guarantee given a translucent fill over unpredictable content.
**Fix:** Add a minimum-contrast enforcement mechanism (e.g., a semi-opaque scrim under text within the glass card, or bump opacity/blur until contrast is guaranteed regardless of underlying map content) rather than leaving it to an on-device tuning pass.

### 6. [MEDIUM/HIGH] OS "Driving mode" / Focus settings could silently defeat the stated haptic/audio guarantee
`EXPERIENCE.md.Driver-Safety Interaction Model` guarantees notifications are "audio/haptic-redundant, not visual-only" so a Driving-role Voyager can register events without looking at the screen. Neither document mentions iOS's "Do Not Disturb While Driving" or Android's Driving Mode/Do Not Disturb — both are common, sometimes auto-enabled, OS-level features that can silently suppress notification sound/haptics. If a driver has either enabled (plausible, since it's marketed as a safety feature), Voylo's own safety guarantee silently breaks with no fallback or detection mentioned anywhere in the spine.
**Fix:** Explicitly design for this case — detect/request Focus-mode exceptions where platform APIs allow, or state as an accepted limitation.

---

## Remaining findings

### 7. [MEDIUM] Reduce Motion coverage is incomplete
`EXPERIENCE.md.Accessibility Floor` addresses comet-trail animation, the Start Voyage/Join animated gradient wash, and the marker pulse. It does not address the "cut to gameplay" transition from Start Voyage into Live Map, or the "coral-glow ignition treatment" End Voyage confirm ceremony — both explicitly described elsewhere as motion-heavy cinematic beats and both plausible triggers for vestibular discomfort (large-scale transition/scale animations) that Reduce Motion is specifically meant to cover.
**Fix:** Extend the Reduce Motion spec to explicitly define a static/cross-fade fallback for both named transitions.

### 8. [MEDIUM] Dynamic Type behavior for `stat-numeral` (the driver-facing HUD digits) is unspecified
`DESIGN.md.Typography` states General Sans reflows to the largest OS text size and Clash Display scales down proportionally, but says nothing about whether `stat-numeral`/`stat-numeral-sm` (Space Mono, used for elapsed time and group-presence counts — the literal content of a Driving-role Voyager's reduced two-element HUD) scale with system text size at all. If the "odometer" digits are fixed-size to preserve the dashboard aesthetic, low-vision users lose Dynamic Type support on exactly the screen meant to be safely glanceable.
**Fix:** Explicitly state stat-numeral's Dynamic Type behavior and floor/ceiling sizes.

### 9. [MEDIUM] Custom-rendered stylized map has no stated screen-reader exposure strategy
The Live Map is explicitly not standard cartography — "terrain renders as simplified flat-toned regions," "roads render as glowing light-trail lines" — implying a custom-drawn (canvas/game-engine-style) rendering layer rather than native map-SDK tiles/pins. Custom-rendered canvases are a well-known VoiceOver/TalkBack blind spot: unless markers are deliberately exposed as accessible elements (not just visually drawn), a screen-reader user may perceive the entire map as one opaque, unlabeled region. `EXPERIENCE.md` states markers "announce role + state" but doesn't address how, given the custom rendering approach, or whether a non-map list-view fallback exists for reviewing Voyager status without navigating the canvas.
**Fix:** Confirm markers are implemented as real accessibility nodes (not just visual paint), and consider a list-view alternative to the map for screen-reader users.

### 10. [MEDIUM] Nudge-toast timing conflicts with WCAG 2.2.1 (Timing Adjustable) and risks being missed by AT users
`nudge-toast` auto-dismisses at ~4s, and the product has a deliberate "no unread state, no inbox, nothing to catch up on" design constraint — meaning a missed toast is gone, not recoverable. For a VoiceOver/TalkBack user, 4 seconds may not be enough time for the screen reader to finish announcing the toast content before it disappears, and there's no persistent surface to check afterward.
**Fix:** Extend the timer for users with VoiceOver/TalkBack active (detectable via OS APIs), or make dismiss content briefly re-surfaceable (e.g., in the Voyager peek card) rather than purely transient.

### 11. [MEDIUM] OTP wrong-code error is visual-only (shake animation)
`Component Patterns`: "a wrong code shakes the field and clears it in place." No mention of an accessible-equivalent announcement (e.g., a live-region VoiceOver/TalkBack cue) for this state change — a shake animation alone conveys nothing to a screen-reader or low-vision user relying on audio feedback.
**Fix:** Pair the shake with an explicit accessibility announcement ("Incorrect code, try again") and haptic.

### 12. [MEDIUM] No CarPlay / Android Auto consideration despite an explicit ambient/driving-safety premise
Given the product's stated goal (driver interacts with zero required taps, ambient-only), the most effective mitigation — getting status off the handheld phone screen entirely via CarPlay/Android Auto — is absent from both documents. This is a product-scope gap more than a WCAG violation, but it's the most direct lever available for the stated goal and its absence is conspicuous.
**Fix:** Note as a future-scope item if truly out of v1, but flag explicitly rather than leaving silent.

### 13. [LOW/MEDIUM] fun-fact-badge / stat chip likely renders under the touch-target minimum
`Component Patterns` states the badge/stat chip is tappable ("Tap opens that Voyager's Fun Fact timeline"). Its only sizing spec (`DESIGN.md.components.fun-fact-badge`) is `padding: spacing.2 spacing.4` (8px/16px) around `stat-numeral-sm` (18px line-height) text — yielding an estimated ~34px tall hit target, under the 44/48pt floor.
**Fix:** Define an explicit minHeight for the tappable badge variant, independent of its compact visual padding.

### 14. [LOW] button-destructive has no defined `minHeight`
Unlike `button-ignition` (56px) and `button-secondary` (48px), `button-destructive` (used for "Remove Voyager") has no `minHeight` token, leaving its touch target unspecified/at risk of falling under the floor.
**Fix:** Add an explicit minHeight ≥44/48pt, matching button-secondary.

### 15. [LOW] Daylight-mode component remapping is implicit, not specified
`DESIGN.md.components` (button-ignition, hud-card, etc.) reference only base/dark-mode color tokens (e.g., `{colors.accent-ignition}`), with no explicit statement of which `-light` token each maps to in Daylight mode. Functionally this is probably "swap suffix," but it's not stated, and the accent-ignition-light contrast finding above (#4) shows the light-mode pairing needs the same scrutiny as dark mode, not an assumed pass.
**Fix:** Add an explicit light-mode token mapping table or note "same component, `-light` suffix substituted" with contrast re-verified per pairing.

### 16. [LOW] 8-hue player-color palette has confusable pairs for common color-vision deficiencies
Coral/pink, teal/sky/lime, and violet/slate are plausible confusion pairs under deuteranopia/protanopia. Mitigated somewhat by markers containing an avatar image/initial inside the color ring (color is supplementary, not sole identifier), but this mitigation is implicit rather than stated as a deliberate CVD accommodation, and the "9th+ Voyager falls back to slate with a pattern/initial disambiguator" overflow behavior is itself flagged as an open `[ASSUMPTION]`.
**Fix:** State explicitly that avatar/initial-in-ring is the CVD-safe identifier and color is decorative reinforcement only; finalize the overflow disambiguator rather than leaving it open.

---

## Overall assessment

The spine is unusually thoughtful about driver safety at the *policy* level — the Driving/Riding role split, control removal (not disabling), audio/haptic-redundant notifications, and glanceable-tier typography rules are all genuinely well-reasoned, and several of them (findings acknowledged as `[ASSUMPTION]`s in the source docs) show the authors are already aware of the soft spots. But the mechanism underneath the policy is self-reported and unenforced (#1), the one control that toggles the whole safety mode is itself unspecified as a component (#2), and the promised contrast/redundancy guarantees have at least two concrete points (#5, #6) where the design as written cannot actually guarantee what it promises. Taken together: this spine **gestures convincingly** at a low-distraction driving experience — the intent and IA are real and well-considered — but as specified it does not yet **deliver** a verifiable one; the gaps are enforcement and verification gaps, not conceptual ones, and are addressable without rethinking the model.

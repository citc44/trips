---
status: final
created: 2026-07-25
updated: 2026-07-25
sources:
  - _bmad-output/planning-artifacts/prds/prd-trips-2026-07-25/prd.md
  - _bmad-output/brainstorming/brainstorm-group-road-trip-tracker-2026-07-21/brainstorm.html
  - _bmad-output/planning-artifacts/research/market-group-road-trip-coordination-and-travel-social-app-market-voylo-research-2026-07-24.md
---

# Voylo — Experience Spine

## Foundation

Native iOS + Android, v1 scope only (this document also specs the fully-defined v1.1 surfaces — Fun Fact capture, Onboarding Nudges, Memory Lane — so the identity is built *toward* them, but every section below is marked by version). No third-party UI system named; Voylo is a from-scratch "Night Drive" system per `DESIGN.md`, which is the visual identity reference for everything in this spine — this document is the behavior half.

Night Drive (dark) is the default surface *in-app*, independent of the device's OS theme setting — `[ASSUMPTION: Voylo does not auto-follow system light/dark mode; Night Drive is the brand's face per DESIGN.md, so it ships as the fixed default with Daylight available only as an explicit, manual toggle in Settings, not an automatic switch]`. This mirrors DESIGN.md's own framing: Daylight is a secondary accessibility/glare mode, not a parallel brand identity.

Three structural constraints shape the entire IA, not just individual screens:

- **No messaging, ever.** No reply, no thread, no DM — every notification is one-way and system-generated. This is a foundation-level exclusion, not a missing feature — it rules out an entire category of IA (inbox, unread state, conversation surfaces) before component design even starts. See Interaction Primitives for the complete banned-pattern list.
- **One active Voyage at a time.** `[ASSUMPTION: the PRD's family/friend-group road-trip framing implies a Voyager is part of at most one Voyage concurrently; this collapses the IA into a single-mode state machine — see Information Architecture — rather than a multi-workspace switcher.]`
- **Continuous location access is a hard requirement**, not an optional permission, for the duration of an active Voyage. Its trust framing is load-bearing enough to get its own section (see Trust, Privacy & Consent) rather than living in a permissions dialog.

No tablet layout is specified for v1 — phone-first, often one-handed, often passenger-held, per `DESIGN.md.Layout & Spacing`. `[ASSUMPTION: tablet/large-screen support is out of scope for this spine.]`

## Information Architecture

| Surface | Reached from | Purpose | Mockup | Ships |
|---|---|---|---|---|
| OTP Entry (email) | App open, unauthenticated, no invite link · or "Join" tap on Join Invitation | Passwordless sign-in, step 1 | — | v1 |
| OTP Verify (code) | OTP Entry submit | Confirms identity, opens/resumes session | — | v1 |
| Trust Moment | First-ever successful OTP verify on an account (once, ever) | The "we never sell your location" screen, as a real moment, not a settings line | — | v1 |
| Driver Attention Consent | Immediately after the Trust Moment, same first-ever onboarding pass (once, ever) | One-time acknowledgment that the driver must stay attentive while driving and that Voylo isn't responsible for distracted driving — a consent/liability gate, not a technical safeguard; see Driver-Safety Interaction Model | — | v1 |
| Home (no active Voyage) | App open, authenticated, no active Voyage | "Start a Voyage" entry point; (v1.1) Past Voyages list for Memory Lane revisits | — | v1 (base) / v1.1 (Past Voyages) |
| Settings | Home · Live Map HUD | Sign out; manual Daylight/Night Drive toggle (see Foundation); time-sensitive notification permission status and re-request; full privacy policy | — | v1 |
| Voyage Intro | Home → "Start a Voyage" tap | The first emotional payoff — the "Every journey tells a story" hook, shown before any destination is chosen; forward action moves to Destination Picker | [mockup](mockups/key-start-voyage.html) | v1 |
| Destination Picker | Voyage Intro → "Choose Your Destination" tap | Organizer names a destination and confirms — confirming is the actual "start" action: creates the Voyage, begins live tracking, cuts into Live Map | [mockup](mockups/key-destination-picker.html) | v1 |
| Join-code / Share Card | Auto-shown after Destination Picker confirm · reachable anytime via Organizer Sheet | Shareable code/link, OS share sheet | — | v1 |
| Join Invitation | Join link/code opened (deep link), any auth state | The "luring" second aha — sells the trip before any auth is requested | [mockup](mockups/key-join-invitation.html) | v1 |
| Live Map (Voyage View) | Destination Picker confirm (Organizer) · Join + OTP completion (Voyager) · app relaunch mid-Voyage | The home surface for the entire duration of an active Voyage | [mockup](mockups/key-live-map.html) | v1 |
| Organizer Action Sheet | Organizer-only control docked on Live Map HUD | Entry point to End Voyage / Grant Organizer / Remove Voyager | [mockup](mockups/key-organizer-action-sheet.html) | v1 |
| Grant Organizer confirm | Organizer Sheet row tap | Low-drama role handoff | — | v1 |
| Remove Voyager confirm | Organizer Sheet row tap | Low-drama removal | — | v1 |
| End Voyage confirm | Organizer Sheet row tap | Ceremonial checkpoint; triggers wrap-up, which leads to Voyage Ended (v1) or Memory Lane (v1.1) — see below | — | v1 |
| Voyage Ended (wrap-up summary) | End Voyage confirm → wrap-up completion | **v1's actual terminal state.** A calm confirmation/summary screen ("Voyage ended. 5h 30m · 3 Voyagers · Lake Tahoe."), not a highlight reel — Memory Lane doesn't exist yet in a v1 build. Same trigger point as Memory Lane below; superseded by it once v1.1 ships. | — | v1 (superseded by Memory Lane in v1.1) |
| Fun Fact log sheet | Manual log control tap on Live Map HUD (Riding role only) | Single-tap category + optional photo | — | v1.1 |
| Photo capture | Fun Fact log sheet · long-stop detected state | Bank a photo memory | — | v1.1 |
| Onboarding nudge toast | Fires contextually, once per Voyager ever, per tip | Just-in-time tips, no upfront tutorial | — | v1.1 |
| Memory Lane | End-Voyage wrap-up completion (v1.1 onward — replaces the v1 Voyage Ended state above at the same trigger point) · Past Voyages list entry | The shareable highlight-reel payoff, revisitable | — | v1.1 |
| Share & Consent review | Memory Lane → external share action | Per-person consent gate before content leaves the app | — | v1.1 |

Voylo has **no persistent tab bar and no drawer**. Navigation is a state machine, not a multi-section app: `Home ↔ Intro/Picker/Join → Live Map → Wrap-up → Voyage Ended (v1) / Memory Lane (v1.1+)`. The last hop is a version seam, not a typo: End Voyage always triggers the same Wrap-up beat, but what it lands on differs by build — see the IA table's Voyage Ended / Memory Lane rows and State Patterns. This is a deliberate IA call, not an omission — DESIGN.md describes the Destination Picker confirm → Live Map transition as a "cut to gameplay," and a bottom tab bar sitting under a full-bleed cinematic hero screen would undercut that immediately. The Live Map is the entire screen for the duration of a Voyage; everything else (Voyager peeks, Organizer controls, Fun Fact logging) surfaces as a sheet or toast over it, never a new tab.

Modal stacking is capped at one level. The Organizer Sheet is level 1; tapping End Voyage, Grant Organizer, or Remove Voyager swaps the *same sheet's* content to a confirm step rather than stacking a second sheet on top — there is never a dialog on top of a dialog anywhere in the product.

This spine document is the authoritative contract; where a mockup and this document ever disagree, this document wins.

## Voice and Tone

Microcopy only. Brand voice and aesthetic posture live in `DESIGN.md.Brand & Style` — not duplicated here. Share-moment and Memory Lane copy specifically should carry the spirit of the brand tagline — see `DESIGN.md.Brand & Style` for the full brand line, not repeated here.

| Do | Don't |
|---|---|
| "Every journey tells a story. Voylo rides along live and turns the trip into a memory reel — inside jokes, wrong turns, and all — ready the moment you arrive." (Voyage Intro headline + subhead — the tagline itself, live as on-screen copy, shown before any destination is chosen) | "Trip started." |
| "Start the Voyage" (Destination Picker confirm button — the actual start action, once a destination is entered; creates the Voyage and cuts to Live Map) | "Submit." |
| "A road trip worth remembering. Ride along live to Lake Tahoe — then walk away with a memory reel of the whole thing: inside jokes, wrong turns, and all." (Join Invitation headline + subhead — names the trip and the payoff for an invitee with zero context) | "You've been invited to join a trip." |
| "You're on the road." | "Location tracking: active." |
| "3 Voyagers riding with you." | "3 users connected." |
| "Pit stop! Someone go get snacks." (long-stop notification) | "User has been stationary for 12 minutes." |
| "Fashionably late." (late-join Fun Fact) | "Joined 3h 12m after Voyage start." |
| "The map said five hours. The memories took twelve." (Memory Lane opening line — a delay reframed as the story, cinematic-voiceover register) | "Sorry this trip ran longer than planned." |
| Memory Lane narrates the trip like a movie trailer looking back on itself. | Memory Lane narrates the trip like a trip report or a status log. |
| "Ready to close out the trip?" (End Voyage confirm) | "Are you sure you want to end the Voyage? This cannot be undone." |
| "Remove Priya from this Voyage?" (plain, calm) | "WARNING: This action will permanently remove this user." |
| "Your Memory Lane's looking a little quiet." (zero-contribution nudge) | "You haven't logged any Fun Facts yet! Don't miss out!" |
| "Your location stays in this Voyage. We never sell it." | "Please review our Privacy Policy before continuing." |
| Notifications read like something happened, not like something's waiting for a reply. | Any phrasing implying a reply, an unread count, or "catch up." |

## Component Patterns

Behavioral. Visual specs live in `DESIGN.md.Components`.

| Component | Use | Behavioral rules |
|---|---|---|
| OTP field (`{typography.body}` input, `{components.button-ignition}` submit) | OTP Entry / Verify | Auto-advances per digit; auto-submits at 6 digits with no separate submit tap; 30s resend cooldown, visible countdown; a wrong code shakes the field and clears it in place — never routes to a separate error screen. |
| Destination field | Destination Picker | Free-text in v1, `[ASSUMPTION: no address autocomplete/validation for v1]`. `{components.button-ignition}` stays disabled until non-empty; its label reads "Start the Voyage" — confirming both creates the Voyage and cuts to Live Map. No map preview before confirming — the reveal is the point. |
| Join-code card (`{components.join-code-card}`) | Post-Destination-Picker-confirm · Organizer Sheet "Invite more" | Tap-to-copy code; primary action opens the OS share sheet. One code per Voyage — it never rotates or expires mid-trip, so late invites reuse the same card. |
| Map marker (`{components.map-marker}`) | Live Map | Tap opens a lightweight per-Voyager peek card — never a message or reply entry point. v1: name + player color only. v1.1 adds: Fun Fact count so far. Long-press is unused; reserved for platform default (e.g., text selection elsewhere in the app). |
| HUD card (`{components.hud-card}`) | Live Map top/bottom dock | Read-only glance surfaces. Content updates live via push; there is no manual refresh control anywhere on the map. |
| Manual Fun Fact log control (`{colors.accent-gold}`) | Live Map bottom HUD, **Riding role only** | One tap opens a single-screen category picker (police / deer / construction / other) as large icon buttons — no multi-field form. "Add a photo" sits one tap below, always optional. Entirely absent — not disabled — from a Driving-role Voyager's HUD. See Driver-Safety Interaction Model. |
| Fun Fact badge / stat chip (`{components.fun-fact-badge}`) | Voyager peek card · Memory Lane | Tap opens that Voyager's Fun Fact timeline for the trip. Accumulates visually per-Voyager — see Contribution Richness. |
| Nudge toast (`{components.nudge-toast}`) | Global, contextual | Fires once per trigger; auto-dismisses ~4s or swipe-dismiss. Tapping it navigates only when there's somewhere meaningful to land (e.g., a fresh Fun Fact badge opens that Fun Fact) — never implies a reply is expected. |
| Organizer action sheet (`{components.organizer-sheet}`) | Live Map, Organizer only | Three rows: End Voyage, Grant Organizer Status, Remove Voyager. Selecting a row swaps the sheet's own content into a confirm step — see Information Architecture's modal-depth rule. |
| Trust Moment screen | Fires once, first-ever OTP success on an account | Single acknowledgment tap (`{components.button-secondary}`, "Got it") — no link-out wall of legal text gating progress. Full policy stays reachable from Settings for anyone who wants it. |
| Driver Attention Consent screen | Fires once, immediately after the Trust Moment, same first-ever onboarding pass | Single acknowledgment tap (`{components.button-secondary}`, "Got it") — same low-drama pattern as the Trust Moment it follows. States the driver-attention expectation and the liability disclaimer; never resurfaces after this first time. See Driver-Safety Interaction Model. |

## State Patterns

| State | Surface | Treatment |
|---|---|---|
| Cold open, unauthenticated, no invite link | App open | OTP Entry directly — no splash, no upfront tutorial. |
| Cold open, authenticated, no active Voyage | App open | Home: "Start a Voyage" front and center. (v1.1) Past Voyages list below. |
| Cold open, authenticated, active Voyage | App open / relaunch mid-drive | Skips Home entirely — lands straight on Live Map; session and Voyage membership persist across app kill. |
| Sign out (v1, single device only) | Settings | Signs the current device out and returns to OTP Entry; ends that device's active-Voyage membership the same way an app-kill leaves it. `[NOTE FOR PM: remote/multi-device sign-out is an open item — the PRD (FR-2) currently specifies single-device sign-out only, and revoking a session from a device other than the one in the Voyager's hand is not designed anywhere in this spine yet.]` |
| Join link opened, unauthenticated | Deep link | Join Invitation first, always — auth is never requested before the invitation is seen. |
| Join link opened, already authenticated | Deep link | Join Invitation still shows (the aha beat isn't skipped), but tapping join skips OTP entirely and lands on Live Map. |
| Join link opened, Voyage already ended | Deep link | Not an error: "This trip's already wrapped up," with an inline invite to start their own Voyage. |
| Voyager joins hours late | Live Map (everyone's) | No catch-up/error state. They appear on the map; a "fashionably late" Fun Fact auto-logs, warm not apologetic. |
| Long stop detected | Live Map (group) + stopped Voyager's own device | Group sees one nudge-toast, once. Stopped Voyager's own HUD shows a soft "paused" indicator; the photo-log affordance surfaces only if they're in Riding role. |
| Border crossing detected | (none — silent) | Zero UI at detection time. Banked as a Fun Fact, first visible in the eventual tally / Memory Lane. |
| Connectivity loss mid-drive | Live Map | Last-known positions stay rendered with a subtle "reconnecting" HUD note, not a blocking banner. Taps/photos queue locally, sync on reconnect. |
| OS location-permission request, first Destination Picker confirm or first Join | Fires once per device, immediately after the Trust Moment on an Organizer's first Destination Picker confirm tap, or immediately after a Joiner's first OTP Verify — the last beat before either one's first landing on Live Map | An app-authored pre-priming screen fires first, tying directly back to the Trust Moment's promise ("One more thing — Voylo needs your location for as long as the Voyage is active, so your Voyagers can see you on the map. Choose 'Always Allow' next so it keeps working if your phone locks."). The native OS dialog (Always / While Using the App / Don't Allow) fires immediately after — never a cold OS prompt with no context. Choosing anything short of "Always" routes into the "Location permission denied/revoked" row below rather than a separate error path. |
| Location permission denied/revoked | Any surface, active Voyage | A full-bleed explainer ties back to Trust Moment copy ("this is how everyone sees you"), with a direct link to OS settings. Their marker simply doesn't render for others until resolved — not a punitive lockout screen. |
| OS notification-permission request, first Destination Picker confirm or first Join | Fires once per device, same beat as the location-permission flow immediately above it — after location permission is resolved, still before either Voyager's first landing on Live Map | An app-authored priming screen fires first, explaining *why* before the OS asks: "Voylo needs to reach you even if your phone's in Driving Focus or Do Not Disturb — allow time-sensitive alerts so a Pit stop ping or a Fun Fact from your Voyage can still get through." The native OS notification-permission dialog fires immediately after, requesting delivery as an iOS Time-Sensitive interruption level / an Android priority channel that can be allowed to bypass Focus/DND. Same "never a cold OS prompt with no context" rule as the location-permission flow. |
| Notification permission (time-sensitive) declined | Any surface, active Voyage | No blocking, no repeated ask, no degraded app state — this only affects delivery, not functionality. If the Voyager's phone is in OS Focus/Driving-Mode/DND, the live, in-the-moment one-way pings (long-stop detection, a Fun Fact logged by someone else) may be silently suppressed by the OS rather than reaching them. Those events still accumulate normally in the background for Memory Lane either way — only the live "ping" is at risk, not the record. Silently-banked events (e.g., border crossing, which was never a live notification to begin with — see the "Border crossing detected" row above) are entirely unaffected by this permission either way. |
| Zero-contribution Voyager, late in the trip | Live Map, once | See Contribution Richness — one gentle nudge, never repeated, never a negative/red marker. |
| End Voyage tapped (Organizer) | Organizer Sheet → confirm | New recording stops immediately; anything already in flight (an uploading photo, a queued offline tap) finishes normally. Brief "Wrapping up…" transitional state, not an abrupt cut. |
| Voyage ended, v1 build (pre-Memory Lane) | Wrap-up completion, v1 | Terminal state, not a hand-off: a calm "Voyage ended" summary (duration, Voyager count, destination) with a single way back to Home — no highlight reel, no share action, since those are the v1.1 Memory Lane experience below. The trigger point (End Voyage confirm) never changes across builds; only what it leads to does. |
| Voyage ends, solo Organizer (nobody ever joined) | Wrap-up → Memory Lane (v1.1) | Full Fun Facts/Memory Lane experience regardless — never a degraded "not enough people" state. (In a v1 build, this instead lands on the plain "Voyage ended" state above, same as any other End Voyage.) |
| Voyager removed by Organizer | Removed Voyager's own device | "You've left this Voyage." Calm, no red, no justification text, old join link no longer re-admits them. |
| Organizer status granted | New Organizer's device | Organizer controls simply appear on their existing Live Map HUD — no new screen, no re-navigation — with a quiet confirmation toast. Deliberately undramatic, in contrast to the "wow" screens. |
| External share attempted with others' content (v1.1) | Memory Lane → Share | Held pending consent — see Trust, Privacy & Consent. |

## Interaction Primitives

- **Tap** is the only primitive required anywhere in the core loop.
- **Long-press** is unused for custom actions; reserved for platform default (e.g., text-field selection). No feature is gated behind a long-press.
- **Swipe** dismisses nudge toasts and drives the Organizer Sheet's native drag-to-dismiss. There is no swipe-to-reply and no swipe-actions row anywhere — a Voyager is a person on a map, not an inbox item.
- **Pinch / pan** are the map's only continuous gestures (standard zoom/pan). A single "recenter on the group" HUD control is the map's one reset action — there is no manual refresh button anywhere, because the map is push-live by definition.
- **Deep links** open Join Invitation directly, cold-start or warm-start, before anything else renders.
- **Haptics**: a light haptic confirms a Fun Fact tap-log and the Destination Picker confirm / Join ignition taps — the one place Voylo borrows a game-feedback feel. `[ASSUMPTION: exact haptic pattern is a motion/platform-API decision, not fixed here.]`
- **Banned everywhere:** reply/comment affordances, DM or chat entry points of any kind, push-to-talk, unread badge counts (nothing ever needs "catching up on" — every notification is transient), infinite scroll, drag-to-reorder, competitive leaderboards or rankings comparing Voyagers to each other.

## Accessibility Floor

Behavioral. Visual contrast lives in `DESIGN.md` (see `DESIGN.md.Colors`, `DESIGN.md.Typography`'s driver-safety contrast note).

- VoiceOver / TalkBack: every map marker announces role + state ("Meera, riding, teal marker, 3 Fun Facts"); HUD stat cards and Organizer Sheet rows announce label + current value/state on focus.
- Dynamic type: the `{typography}` functional layer (General Sans: body, label, caption) reflows without truncation up to the largest OS text size. Clash Display hero moments (`display-hero`, `display`) may scale down proportionally rather than reflow, but never below a legible floor. `[ASSUMPTION: exact floor size needs an on-device pass.]`
- Reduce Motion: disable the map marker's comet-trail animation and the Voyage Intro / Join screens' animated gradient wash; the "live" pulse on an active marker becomes a static full-opacity ring instead of a pulsing one — presence is still communicated, just not animated.
- Tap targets ≥ 44pt (iOS) / 48dp (Android) everywhere, and the manual Fun Fact log control sits meaningfully larger than that floor — it has to be hittable one-handed, glanced-at, in a moving vehicle. `[ASSUMPTION: ≥60pt/dp target for that control specifically.]`
- Live/active state is never color-only: an active Voyager marker pairs its player-color ring with a pulse animation (or, under Reduce Motion, a filled-vs-hollow ring distinction) and a heading chevron — not hue alone, since the 8-color player palette isn't guaranteed distinguishable to every Voyager.
- Notifications are audio/haptic-redundant, not visual-only — a Driving-role Voyager must be able to register that "something happened" (a stop, a Fun Fact) without looking at the screen. This ties directly into the Driver-Safety Interaction Model below.
- Focus/reading order on every surface, including the cinematic Voyage Intro and Join Invitation screens, matches visual order — a "wow" screen still has to be a fully operable screen for a screen-reader user, not a decorative one.

## Driver-Safety Interaction Model

This is the one constraint in Voylo that overrides the "glamorous, game-like" posture in favor of doing nothing at all: a driver must be able to use Voylo with zero required interaction, ever, and manual capture must be unavailable to them, not merely discouraged.

**Mechanism — self-declared role, not sensor detection.** Each Voyager sets a per-Voyage role, **Riding** or **Driving**, at the moment they land on Live Map for the first time (right after Destination Picker confirm or right after joining). The role choice is a two-large-tap-target prompt, skippable — skipping defaults to Riding, so nobody is ever blocked from the app by an unanswered prompt. The role can be changed anytime with a single tap on their own status pill on the HUD ("Switch to Driving" / "Switch to Riding") — no confirmation dialog, since driver swaps happen mid-trip and shouldn't cost more than a glance. `[ASSUMPTION: self-reported role rather than motion/speed-sensor detection — sensor-based driving detection is out of the PRD's stated scope, and false positives would undermine the trust-based, non-nanny tone the rest of the product commits to. Voylo trusts the Voyager to say who's driving, the same way it trusts them with everything else.]`

**What Driving role actually changes:**
- The manual Fun Fact log control and the photo-attach control are **removed from the HUD entirely** for a Driving-role Voyager — not grayed out, not disabled-with-a-tooltip. A dead tap target is still a temptation to glance and reach for; an absent one isn't.
- Their Live Map reduces to exactly two things: the map itself, and glance-sized `{typography.stat-numeral}`/`headline`-tier HUD cards (elapsed time, group presence). Nothing on their screen ever requires a decision.
- Notifications (long-stop, a Fun Fact logged by someone else) fire identically for Driving and Riding roles — a `{components.nudge-toast}` plus haptic/audio — but a Driving-role Voyager is never expected to act on or even look at one. The ping itself is the entire interaction.

**What never changes regardless of role:** nothing in Voylo is ever a *required* interaction for anyone. A Riding-role Voyager who never taps anything still gets the full ambient experience — manual logging is opt-in richness on top of a baseline that already asks nothing of anybody. This is what makes the Riding/Driving split safe to build as a hard UI gate rather than a soft suggestion: removing controls from a Driving Voyager never removes anything they were required to do.

**Enforcement is consent-based, not technical — and that's a deliberate, disclosed tradeoff, not a silently-assumed solve.** Voylo does not detect who's driving. There is no sensor, motion, or Bluetooth-pairing check standing behind the Riding/Driving split — only the self-declared role above. That means the actual guarantee is conditional: a Voyager who honestly declares Driving gets a hard UI gate (no manual controls, ever); a Voyager who doesn't declare it, or declares it dishonestly, gets none. Voylo does not attempt to close that gap technically. Instead, it makes the tradeoff explicit and puts the responsibility where consent-based products put it: on the driver's own acknowledgment. This is the same pattern Waze and Google Maps use — neither technically prevents a driver from interacting with their app while the vehicle is moving; both rely on UI friction plus an implicit-to-explicit liability disclaimer rather than a hard sensor gate. Voylo's version of that disclaimer is the **Driver Attention Consent** step below — an affirmative, once-ever tap, not boilerplate buried in a Terms of Service link nobody opens.

**Driver Attention Consent (onboarding, once ever).** Fires immediately after the Trust Moment, on a Voyager's first-ever successful OTP verification — same onboarding pass, before Home for an Organizer or before Live Map for a Joiner (see Information Architecture, Component Patterns). Full-bleed, same low-drama visual register as the Trust Moment it directly follows: a plain statement of the expectation ("If you're behind the wheel, stay focused on the road — Voylo can't do that for you.") plus the liability line ("Voylo isn't responsible for distracted driving."). One acknowledgment tap (`{components.button-secondary}`, "Got it") to continue — no separate legal wall, consistent with the rest of onboarding. Never resurfaces after this first time on this account, same lifecycle as the Trust Moment.

## Trust, Privacy & Consent

Per the PRD and the market research, "we never sell your location data" has to land as a moment, not a settings-page disclosure the average Voyager never opens.

**The Trust Moment (v1).** Fires exactly once per account, ever, immediately after a Voyager's first-ever successful OTP verification — before Voyage Intro for an Organizer (Chintan), before landing on Live Map for a Joiner (Meera). Full-bleed, single statement in the hero type register: "Your location stays in this Voyage." with a supporting line, "We never sell your location data. It's visible only to people in your Voyage, and only while it's active." One acknowledgment tap (`{components.button-secondary}`, "Got it") — never a scroll-to-the-bottom legal wall. The full privacy policy remains reachable from Settings for anyone who wants the detail, but nothing about reaching it is required to proceed.

Because Meera is being asked to share live location with people she may only loosely trust (a friend's family, not her own), the Join Invitation screen itself — which she sees *before* any auth — carries a short reinforcing line of the same promise, so the trust signal lands even earlier than her own account-level Trust Moment does. `[ASSUMPTION: exact copy placement on Join Invitation is a content decision; the requirement here is that the promise appears pre-auth, not that it's this literal wording.]`

**Consent for external sharing (v1.1).** A Voyager can always share their own Memory Lane contributions freely — their own photos, their own logged Fun Facts — no consent gate needed. The gate applies only when a share would include another Voyager's content (a photo they're in, a Fun Fact attributed to them). In that case:

1. The sharer picks "Ask the group" instead of a plain share.
2. Each tagged Voyager gets exactly one `{components.nudge-toast}`-style ask ("Sam wants to share this photo from the trip — it includes you") with a single-tap Approve / Decline. This is a consent gate, not a conversation — one ask, one tap, no thread, consistent with the no-messaging constraint.
3. The share only goes out once every tagged Voyager has approved, or the sharer trims the content to exclude anyone who declined or hasn't responded, and re-shares the reduced set.
4. Declines are handled without drama: the sharer sees the content quietly excluded, never a "declined" callout, never a notification back to the person who said no.

Consent is scoped per share action, not a one-time global toggle — different shares can include different people and different content, so the gate re-evaluates every time.

## Contribution Richness — the FOMO-as-Invitation Pattern

The PRD leaves this explicitly unsolved: a Voyager who never taps or photographs anything should feel their eventual Memory Lane will be thinner, without the app ever shaming them for it. Here is the concrete mechanic:

- Every Voyager has a card in the group roster (visible in the Live Map's Voyager list and, prominently, in Memory Lane). The card's player-color ring is **always full brightness, never dimmed** — presence itself is never diminished by low contribution, because a dimmed ring would read as a penalty, not an invitation.
- Beneath the ring, `{components.fun-fact-badge}` gold pips accumulate one per logged Fun Fact/photo. A Voyager with three Fun Facts has a visibly denser, gold-flecked card; a Voyager with none simply has an empty row beneath their ring — **absence, not a negative marker**. No "0" is ever rendered in `{colors.error}` or any warning tone; there is nothing to render at all.
- In Memory Lane (v1.1), highlight-reel real estate scales roughly with what each Voyager contributed — someone with more logged moments naturally gets more of the reel built from their material. This is a direct, structural consequence of what exists, not an editorial judgment the app makes about anyone.
- **One nudge, once, late in the trip.** A Voyager with zero contributions gets exactly one `{colors.accent-electric}` nudge-toast before the trip wraps up: "Your Memory Lane's looking a little quiet — tap the badge below to log something." It never repeats within the Voyage, it never blocks anything, and it's copy-tested against the "Don't" column in Voice and Tone — no exclamation marks, no "don't miss out," no comparison to anyone else's count.
- **No leaderboard, ever.** Contribution counts are never shown ranked or compared Voyager-to-Voyager — each card communicates only its own richness. A ranking would tip this from an invitation into a competition, which is explicitly the failure mode this pattern is designed to avoid.

## Key Flows

### UJ-1 — Chintan sets up the Voyage (Chintan, Organizer, packing the car Friday morning)

1. Chintan opens Voylo for the first time. Cold open, unauthenticated → OTP Entry.
2. Enters his email, gets a code, enters it → OTP Verify auto-submits at six digits.
3. First-ever successful sign-in on this account → the Trust Moment fires once, one acknowledgment tap ("Got it") — full copy in Trust, Privacy & Consent.
3a. **Driver Attention Consent.** Same first-ever onboarding pass, immediately after the Trust Moment, same single-tap "Got it" pattern — full copy in Driver-Safety Interaction Model. Never resurfaces on this account again.
4. Lands on Home (no active Voyage) → taps "Start a Voyage."
5. **Climax:** the tap cuts straight into Voyage Intro — full-bleed Night Drive gradient wash, `display-hero` Clash Display headline, the coral-glow ignition already fired — the first "wow," and it happens before Chintan has named a destination or a single other person has joined. Not knowing where the trip goes yet doesn't blunt the payoff; if anything it reads as more anticipatory, a promise about the experience rather than a reveal tied to a place. The copy puts the brand tagline directly on screen rather than just alluding to it: headline "**Every journey tells a story.**", subhead "Voylo rides along live and turns the trip into a memory reel — inside jokes, wrong turns, and all — ready the moment you arrive.", button "Choose Your Destination" (see `DESIGN.md.Components`, "Voyage Intro," for the locked copy block).
6. Taps "Choose Your Destination" → lands on Destination Picker.
7. Destination Picker: types a destination ("Lake Tahoe"). The confirm button — now labeled "Start the Voyage" — lights up.
8. Taps "Start the Voyage." This is the real start trigger, not a formality: confirming here is what creates the Voyage and begins live tracking.
8a. **OS location-permission request.** Since continuous location access is a hard requirement for the length of a Voyage, an app-authored priming screen fires first, then the native OS dialog (Always / While Using the App / Don't Allow) appears immediately after — never a cold OS prompt with no context; full priming copy in State Patterns' "OS location-permission request" row. Chintan taps Always.
8b. **OS notification-permission (time-sensitive) request.** Same beat, immediately after location permission resolves: an app-authored priming screen explains why first, then the native OS notification-permission dialog fires, requesting delivery as an iOS Time-Sensitive interruption level / Android priority channel — full priming copy in State Patterns' "OS notification-permission request" row. Chintan allows it.
9. Cut (not a page-nav) into the Join-code card, then onto Live Map — Chintan is already a Voyager on his own map, alone, marker moving.
10. Taps the Join-code card's share action → OS share sheet → sends the link to two other families over text.

Failure/edge: if Chintan closes the app before sending the link, the same code is always reachable again from the Organizer Sheet — it never expires or regenerates mid-Voyage. Note forward: even if nobody ever joins, Chintan still gets a full Fun Facts/Memory Lane experience solo at End Voyage in a v1.1 build (State Pattern: "Voyage ends, solo Organizer"); in a v1 build without Memory Lane, he'd land on the plain "Voyage ended" state instead.

### UJ-2 — Meera joins (Meera, a friend from the second family, phone in hand at her kitchen table)

1. Meera taps the link Chintan texted. Unauthenticated, deep link → Join Invitation opens directly — no auth requested yet.
2. The screen sells the trip, not the app: `display-hero` headline, a stack of avatar placeholders in player colors hinting "you're joining people," plus the trust reinforcement line about her location staying inside this Voyage only. The copy gives her, a first-time user with zero context, an actual reason to care: eyebrow "CHINTAN INVITED YOU," headline "**A road trip worth remembering.**", subhead "Ride along live to Lake Tahoe — then walk away with a memory reel of the whole thing: inside jokes, wrong turns, and all.", button "Join the Voyage" (see `DESIGN.md.Components`, "Join Invitation," for the locked copy block).
3. **Climax (first beat):** Meera hasn't signed in, hasn't done anything but open a link, and she's already looking at something that feels like an invitation to an event, not a login wall.
4. She taps the join action (labeled around joining the Voyage — never a generic "Continue").
5. OTP Entry → Verify — first-ever sign-in on her account, so her own one-time Trust Moment fires too, same as Chintan's.
5a. **Driver Attention Consent.** Same first-ever onboarding pass, immediately after her Trust Moment, same copy and single "Got it" tap Chintan saw. Never resurfaces on her account again.
5b. **OS location-permission request.** Right after that and before Live Map appears, the same app-authored priming screen Chintan saw fires ("One more thing — Voylo needs your location for as long as the Voyage is active…"), then the native OS dialog (Always / While Using the App / Don't Allow). Meera taps Always.
5c. **OS notification-permission (time-sensitive) request.** Same beat, immediately after: the app-authored priming screen explaining time-sensitive delivery fires, then the native OS notification-permission dialog. Meera allows it.
6. **Climax (second beat):** she lands on Live Map and is immediately alongside Chintan and anyone else already on the road, moving in real time — joining itself is the aha, before the drive has even started for her.

Failure/edge: if Meera already has a Voylo account from a past Voyage, Join Invitation still shows in full (the beat isn't skipped), but tapping join skips OTP entirely and drops her straight onto Live Map.

### UJ-3 — The drive itself (ambient, hours into the trip)

1. Meera, riding, glances at her phone: Live Map shows every Voyager's marker moving in their player color, comet-trails tracing recent motion — game-like, not turn-by-turn.
2. Chintan, driving, never opens any manual control — his HUD is in Driving role: just the map and glance-sized stat cards. The Fun Fact log control isn't there to tempt him.
3. The car pulls into a gas station. The system detects a long stop.
4. Group-wide: one lighthearted nudge-toast fires once ("Pit stop! Someone go get snacks."). Chintan, driving, doesn't need to see it — haptic/audio is enough, nothing is required of him.
5. Meera, riding, sees the same toast, and the photo-log affordance is now live on her HUD since they're stopped. She taps it, snaps a photo of the vending machine — two taps, done.
6. **Climax:** the group keeps driving with zero interruption to the ambient experience — nobody "checked in," nothing blocked the map, and the trip's texture (a photo, a lighthearted ping) accumulated for free in the background.
7. Later, they cross a state line. Border crossing detected silently — no toast, no visible change, nothing on screen. It's simply banked.
8. A third family's teenager, Sam, joins six hours after the Voyage started. He appears on the map mid-trip; a "fashionably late" Fun Fact auto-logs for him, warm not apologetic — no error state, no "why so late" framing anywhere in the product.

### UJ-4 — Memory Lane (v1.1) (the whole group, that evening, checked into the cabin)

1. Chintan, Organizer, opens the Organizer Sheet and taps End Voyage.
2. The confirm step swaps into the same sheet (never a stacked dialog) and carries a deliberate beat of ceremony — the coral-glow ignition treatment, not the bare `button-destructive` pattern Remove Voyager uses — since ending the Voyage is the trigger for Memory Lane in a v1.1 build, not a plain destructive action. (In a v1 build without Memory Lane, this same End Voyage confirm instead leads to the plain "Voyage ended" state — see State Patterns.)
3. He confirms. New recording stops immediately; a photo Meera was mid-uploading finishes normally in the background rather than being force-cut.
4. A brief "Putting together your trip…" wrap-up state while Memory Lane assembles: Fun Facts, photos, and in-drive moments woven into a highlight reel, narrated in Memory Lane's cinematic-trailer voice — the register that reframes a long or delayed drive as the story rather than apologizing for it ("The map said five hours. The memories took twelve."), not a plain summary read-out.
5. Everyone in the Voyage can open Memory Lane independently — it's shared and revisitable, not a one-time reveal Chintan controls or gatekeeps.
6. **Climax:** the group watches it together that evening — the gas-station photo, Sam's fashionably-late badge, each Voyager's card carrying its own accumulated gold-badge density from Contribution Richness — landing as the "wow, that's so cool" payoff the whole product has been building toward since the Voyage Intro screen.
7. Someone wants to post a clip externally. Because it includes a photo of Meera, the share is held at the Share & Consent step; Meera gets one Approve/Decline tap. Once she approves, the share goes out. Had she declined, the sharer could still post a trimmed version excluding her without any renegotiation.

Failure/edge: a Voyager who never logged a single Fun Fact still appears fully in Memory Lane — their card is simply quieter (no gold badges), never omitted, never marked negatively.

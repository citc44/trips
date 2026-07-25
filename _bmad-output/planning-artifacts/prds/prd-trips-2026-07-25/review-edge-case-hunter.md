# Edge Case Hunter Review — Voylo PRD

Scope: full document at `_bmad-output/planning-artifacts/prds/prd-trips-2026-07-25/prd.md`, focused on §2.3 User Journeys (UJ-1–UJ-4) and §4 Functional Requirements (FR-1–FR-14). Method: exhaustive branch/boundary walk per `bmad-review-edge-case-hunter`; only unhandled paths are listed (handled ones discarded silently). Items already acknowledged in the PRD's own `[ASSUMPTION]` tags or §9 Open Questions (e.g. exact OTP SLA, refresh interval, stop-duration threshold) are treated as handled and not repeated here.

```json
[
  {
    "location": "prd.md:93-101 (FR-1)",
    "trigger_condition": "User mistypes email address before requesting OTP",
    "guard_snippet": "Add an 'edit email' step before OTP send / resend",
    "potential_consequence": "User locked out; resend keeps failing to a wrong inbox with no way to correct it"
  },
  {
    "location": "prd.md:93-104 (FR-1)",
    "trigger_condition": "Repeated invalid OTP guesses against one code",
    "guard_snippet": "Rate-limit / lock after N failed attempts",
    "potential_consequence": "Brute-forceable OTP allows unauthorized account access"
  },
  {
    "location": "prd.md:93-101 (FR-1)",
    "trigger_condition": "User requests OTP twice before entering the first code",
    "guard_snippet": "Invalidate prior code when a new one is issued",
    "potential_consequence": "Ambiguous which code is valid, unpredictable auth behavior"
  },
  {
    "location": "prd.md:144-155 (FR-5), prd.md:93-104 (FR-1)",
    "trigger_condition": "Already-authenticated user opens a Join Code/Link on the same device",
    "guard_snippet": "Skip OTP if a valid session exists; otherwise require it",
    "potential_consequence": "Already-signed-in user forced through unneeded re-auth, or flow undefined"
  },
  {
    "location": "prd.md:123-134 (FR-3)",
    "trigger_condition": "Organizer taps Start Voyage without setting a destination",
    "guard_snippet": "Require non-empty destination before enabling Start Voyage",
    "potential_consequence": "Voyage created with no destination context for the UI or Memory Lane"
  },
  {
    "location": "prd.md:123-134 (FR-3)",
    "trigger_condition": "Device location permission denied/unavailable at Start Voyage",
    "guard_snippet": "Block Start Voyage or show a permission-request flow until granted",
    "potential_consequence": "Voyage starts claiming 'live tracking active' with no actual location data"
  },
  {
    "location": "prd.md:123-134 (FR-3), prd.md:144-155 (FR-5)",
    "trigger_condition": "Same account starts or joins a second Voyage while already Organizer/Voyager on an active one",
    "guard_snippet": "Disallow, or explicitly define, multi-Voyage membership per account",
    "potential_consequence": "Undefined state — user's live presence split across two active Voyages at once"
  },
  {
    "location": "prd.md:135-143 (FR-4)",
    "trigger_condition": "Join Code/Link leaks beyond intended recipients (no gatekeeping by design, §6)",
    "guard_snippet": "Add Organizer-triggered code revoke/regenerate",
    "potential_consequence": "Unlimited unintended strangers can join with no way to lock out the leaked code"
  },
  {
    "location": "prd.md:144-155 (FR-5)",
    "trigger_condition": "User enters an invalid, malformed, or already-Voyage-ended Join Code",
    "guard_snippet": "Show an explicit invalid/expired-code error state",
    "potential_consequence": "No defined error path — user hits a dead end with no code-specific handling"
  },
  {
    "location": "prd.md:144-155 (FR-5)",
    "trigger_condition": "Already-joined Voyager re-opens the same Join Code/Link",
    "guard_snippet": "Detect existing membership and route to live view instead of re-joining",
    "potential_consequence": "Duplicate Voyager record or duplicate 'fashionably late' Fun Fact"
  },
  {
    "location": "prd.md:156-164 (FR-14)",
    "trigger_condition": "Organizer never taps End Voyage (forgets, churns, uninstalls)",
    "guard_snippet": "Add a max Voyage duration / inactivity auto-end safeguard",
    "potential_consequence": "Voyage stays active indefinitely, draining all Voyagers' batteries with no recap ever generated"
  },
  {
    "location": "prd.md:156-164 (FR-14)",
    "trigger_condition": "Organizer becomes unreachable mid-Voyage (dead phone, lost account access)",
    "guard_snippet": "Add an organizer-transfer or fallback end-Voyage path",
    "potential_consequence": "No other Voyager can end the Voyage — it is permanently orphaned, tracking never stops"
  },
  {
    "location": "prd.md:171-182 (FR-6)",
    "trigger_condition": "A Voyager's location update fails to arrive (dead zone, backgrounded app, revoked permission)",
    "guard_snippet": "Render a stale/offline state (e.g. greyed pin + last-seen timestamp) distinct from live pins",
    "potential_consequence": "Map silently shows a frozen/wrong position with no staleness indicator, undercutting the Reliability NFR (§5.5)"
  },
  {
    "location": "prd.md:189-196 (FR-7)",
    "trigger_condition": "Voyager rapid-taps the same spotting control repeatedly",
    "guard_snippet": "Debounce/cooldown per spotting type per Voyager",
    "potential_consequence": "Inflated Fun Fact counts (e.g. 'most cop-sightings') and notification spam to the group"
  },
  {
    "location": "prd.md:189-200 (FR-7)",
    "trigger_condition": "Voyager taps a manual log while offline (cellular dead zone)",
    "guard_snippet": "Queue the log locally and sync once connectivity returns",
    "potential_consequence": "Manual log silently lost, contradicting the graceful-degradation NFR (§5.5)"
  },
  {
    "location": "prd.md:201-212 (FR-8)",
    "trigger_condition": "Voyager crosses back and forth near a state/country border repeatedly",
    "guard_snippet": "Debounce border-crossing detection with a minimum dwell time on the new side",
    "potential_consequence": "Spurious duplicate crossing events corrupt the 'border-crossing race' Fun Fact"
  },
  {
    "location": "prd.md:213-223 (FR-9), prd.md:156-164 (FR-14)",
    "trigger_condition": "A photo upload or detected event is still in-flight the instant Organizer taps End Voyage",
    "guard_snippet": "Drain/grace-window in-flight uploads before finalizing Memory Lane generation",
    "potential_consequence": "'Immediately triggers Memory Lane generation' can drop a just-captured moment from the recap"
  },
  {
    "location": "prd.md:248-256 (FR-11)",
    "trigger_condition": "A multi-Voyager Voyage ends with zero Fun Facts, photos, or moments captured",
    "guard_snippet": "Define a minimum/fallback Memory Lane content set for a near-empty Voyage",
    "potential_consequence": "The UJ-4 'wow' climax instead renders as a jarring, empty recap"
  },
  {
    "location": "prd.md:67-73 (UJ-4), prd.md:156-164 (FR-14)",
    "trigger_condition": "Organizer ends the Voyage while other Voyagers are actively viewing the live map",
    "guard_snippet": "Push an end-of-Voyage transition/notification to all Voyagers' live views",
    "potential_consequence": "Other Voyagers left staring at a now-frozen live map with no indication the Voyage ended"
  },
  {
    "location": "prd.md:265-274 (FR-13)",
    "trigger_condition": "A Voyager shares Memory Lane externally when it includes other Voyagers' photos/moments",
    "guard_snippet": "Add per-Voyager consent/opt-out before inclusion in externally shared assets",
    "potential_consequence": "Non-consenting Voyager's photos/location-derived moments get distributed outside the group, in tension with §5.4's privacy stance"
  },
  {
    "location": "prd.md:230-241 (FR-10)",
    "trigger_condition": "Two nudge trigger conditions occur near-simultaneously (Voyage start plus an immediate detected stop)",
    "guard_snippet": "Queue/sequence nudges instead of allowing concurrent display",
    "potential_consequence": "Overlapping tips visually collide, or one is silently dropped"
  },
  {
    "location": "prd.md:213-223 (FR-9)",
    "trigger_condition": "Voyager wants to remove or replace a mistakenly attached photo",
    "guard_snippet": "Add a delete/replace action for a logged photo before Voyage ends",
    "potential_consequence": "Wrong or unwanted photo becomes permanently embedded in Memory Lane with no correction path"
  }
]
```

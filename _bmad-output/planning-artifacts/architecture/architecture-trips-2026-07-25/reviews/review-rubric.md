---
title: Architecture Spine Review — Voylo (rubric-based)
reviewed: ARCHITECTURE-SPINE.md
reviewed_against: .memlog.md, prd.md, DESIGN.md, EXPERIENCE.md
date: 2026-07-25
---

# Review: ARCHITECTURE-SPINE.md (Voylo)

## Verdict

The spine is well-constructed where it engages — its nine ADs are each traceable to a real divergence risk, mostly enforceable, and correctly scoped to v1 (it does not over-build for the deferred v1.1 Fun Fact/Memory Lane surfaces) — but it has one systemic weakness given its stated purpose: it under-specifies the operational/environmental envelope that a *non-technical, self-managing* founder critically depends on, and it silently skips two structural decisions (deep-link resolution, client data/subscription ownership) that are real fork points for the level below.

## Findings

### 1. [CRITICAL] "No manual infrastructure work" claim is not actually held up by the document

The Design Paradigm section and memlog both assert the architecture is chosen "specifically because every layer must be buildable and operable by an AI coding agent with no manual infrastructure work from the founder," and the Deferred section calls out exactly **one** non-automatable step (the iOS Time-Sensitive entitlement request). That framing doesn't survive scrutiny:

- **Account/project provisioning**: AD-6 mandates three *separate* Supabase projects, three EAS build profiles, plus Mapbox, Sentry, and GitHub. Creating each of these accounts/projects, and retrieving their API keys/service-role tokens, is an inherently manual, credentialed, human-identity action (email verification, ToS acceptance, billing details) — no AI agent can self-provision a Supabase project under someone else's identity. This is not addressed anywhere, not even flagged as "founder does this once."
- **Secrets flow**: nothing describes how per-environment secrets (Supabase service-role key, Mapbox token, Sentry DSN, EAS credentials) get from "founder creates them" into GitHub Actions / EAS secret stores. The CI diagram just draws `CI --> Supabase` and `CI --> EAS` edges with no supporting decision.
- **App-store enrollment**: EAS Submit automates the *submission* mechanics, but Apple Developer Program enrollment (paid, identity/business-verified) and Google Play Console enrollment (paid, identity-verified) are themselves manual, non-agent-completable prerequisites — arguably a bigger, earlier manual step than the Time-Sensitive entitlement the spine does call out.

Given the explicit, primary design constraint is "self-managed, no manual steps," a document that names *one* manual step while leaving several larger ones completely silent is actively misleading about how self-managed this build actually is. This should either be decided (e.g., "founder performs a one-time bootstrap checklist: N account creations, listed explicitly") or moved into Deferred/Open Questions with the same honesty the Time-Sensitive entitlement gets.

### 2. [HIGH] Join Code/Link deep-linking mechanism is undecided

FR-4 (Generate Join Code/Link) and FR-5 (Join via Code/Link) are core v1 scope and the PRD's stated growth mechanic (SM-4 Invite K-factor), but the spine never decides *how* the link resolves: custom URI scheme vs. HTTPS universal/app link, or how an unauthenticated user without the app installed lands anywhere sensible (a "web companion" is explicitly Deferred/post-v1, so what does a cold link open to in v1?). This is a genuine fork point for the level below: invite-generation code (features/voyage-setup) and invite-consumption/routing code could independently assume incompatible link formats with nothing here to prevent it — exactly the kind of divergence AD-1 through AD-9 exist to close off elsewhere, but this one is missing.

Related, smaller gap: `app/ # Expo Router screens` appears once, only as a source-tree comment — Expo Router is never named in the Stack table or backed by an AD, despite being load-bearing for exactly this deep-link/routing decision. Either name and verify it in Stack, or don't assume it in the source tree.

### 3. [MEDIUM] Client-side data/subscription ownership is undecided

AD-2 fixes Supabase Realtime as the sole live-delivery mechanism and AD-5 fixes repositories as the sole data-access path, but neither says who owns a Voyage's Realtime channel lifecycle (subscribe/unsubscribe timing) or whether reads of the same entity share one cached/subscribed source across screens. Live Map (v1) and the future Fun Fact notification surface (v1.1, explicitly bound by AD-2 already) are two features reading/subscribing to overlapping Voyage state — without a stated pattern (e.g., "one channel per active Voyage, owned by a shared hook, ref-counted across consumers"), each is free to open its own channel/subscription independently, which is a real risk of divergent, duplicated, or leaking Realtime connections at exactly the multi-feature boundary this document exists to control.

### 4. [MEDIUM] Environment promotion pipeline is not specified

AD-6 fixes *what* the three environments are (separate Supabase project + EAS profile each) but not *how* a change moves dev → staging → prod: is migration/build promotion automatic on merge, or gated behind something? For a founder who by design cannot manually approve/execute a deploy, this is exactly the kind of decision that should be pinned at this altitude — right now it's silent, not deferred, not flagged as an open question.

### 5. [LOW] Minor accuracy/consistency nits

- Memlog's stack entry reads "Supabase ... $\{5\}/mo Pro when outgrown" — Supabase's Pro tier is $25/mo; this looks like a transcription artifact ("$2" dropped) worth fixing so the cost record stays trustworthy, since cost-consciousness is repeatedly cited as a driver.
- Stack table says `expo-location` + `expo-task-manager` are "bundled with Expo SDK 56" — these are SDK-compatible installable packages (`npx expo install ...`), not auto-included in every Expo app; "bundled" overstates it slightly.
- AD-5's rule ("no screen or hook calls the Supabase client SDK directly") has no stated enforcement mechanism (e.g., an ESLint `no-restricted-imports` boundary). For a human team this would live as tribal knowledge/code review; for AI coding agents building independently story-by-story, an unenforced convention is materially weaker than the DB-level enforcement AD-1/AD-9 get. Worth at least noting the enforcement mechanism (lint rule, or accept it's convention-only).

## What the spine gets right (for balance)

- Every AD traces to a concrete, real divergence risk and is either DB-enforced (AD-1 RLS, AD-9 partial unique constraint) or has a clear, narrow convention (AD-3, AD-4, AD-7, AD-8).
- v1/v1.1 scoping discipline is good: the capability map and ERD include only what FR-1–FR-9 need; nothing is over-built for Fun Fact/Memory Lane before it's scoped, and the Deferred section correctly identifies that none of those deferrals are load-bearing for v1 (single-destination `text` column already forecloses multi-leg itineraries at the schema level, for instance).
- Cross-checked against EXPERIENCE.md/DESIGN.md: the `profiles` (Trust Moment / Driver Attention Consent) and `push_tokens` tables accurately reflect the UX spec's "once ever" and notification-priming requirements — no invented or missing entities found there.
- AD-4's native `signOut({ scope: 'global' })` resolution is a genuinely good example of closing a PRD open question (§5.5 remote sign-out) without new infrastructure — appropriate for the AI-agent-buildable constraint.
- The one manual step it *does* flag (Apple Time-Sensitive entitlement) is flagged honestly and specifically, not hand-waved — the problem is that it's presented as the *only* one, which finding #1 disputes.

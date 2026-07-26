---
title: Voylo — Architecture, Explained
audience: Citc_ (non-technical founder, following along)
purpose: Plain-language companion to ARCHITECTURE-SPINE.md
created: '2026-07-25'
---

# Voylo — Architecture, Explained

This is the plain-language version of `ARCHITECTURE-SPINE.md`. That file is the precise technical contract the AI dev agents build from. This one is for you — so you can follow along, ask good questions, and know what's normal vs. what's worth flagging.

## The big picture

Voylo is a mobile app (iOS and Android, one codebase for both) where a group of people driving somewhere together can see each other live on a map and, later, get a highlight recap of the trip. There's no company server sitting in a data center that you or anyone has to maintain. Instead, the whole backend — the database, the login system, the live map updates, file storage — runs on a service called **Supabase**, which you can think of as "renting a fully-managed backend" rather than building and babysitting one yourself.

## Why this stack

Every piece was chosen for one reason above all: **an AI coding agent can build and operate all of it without you doing anything technical**, and it's cheap to start (free, until the app actually has real usage).

| Piece | Plain-language role | Why this one |
| --- | --- | --- |
| **Expo / React Native** | The toolkit that builds the actual app you install on your phone | The most common, well-documented way to build one app that runs on both iPhone and Android — and AI agents are very good at building with it because so many of the internet's code examples use it |
| **EAS** (Expo Application Services) | The robot that builds your app and submits it to the App Store / Play Store | Normally submitting an app requires Xcode (Mac-only, technical) and juggling signing certificates. EAS does all of that in the cloud — no local setup, ever |
| **Supabase** | The backend: database, login, live updates, file storage | One account, one dashboard, covers almost everything the app needs. Free to start, $25/month once you outgrow the free tier |
| **Mapbox** | The map itself | Regular Google Maps can't be given the "game-like" custom look your UX design calls for. Mapbox can. Also has a generous free tier |
| **GitHub + GitHub Actions** | Where the code lives, and the robot that tests/builds/deploys it automatically every time something changes | Standard, free, and exactly what AI coding agents expect to work with |
| **Sentry** | Automatically tells you (or the AI agent) when something breaks in the live app | Since you can't manually poke around debugging, this is your early-warning system — free to start |
| **Groq** | (Later, not in this first version) — powers the AI-generated trip content idea from brainstorming | Confirmed as the right choice when that feature actually gets built: cheap and fast |

## What "the database enforces privacy" means

One of the more important decisions: your PRD requires that a road trip's location data never leaves the people on that trip. Rather than trusting every piece of app code to remember to check that rule, **the database itself refuses to hand out data to anyone who isn't a member of that trip** — a security layer called Row-Level Security (RLS). Even if an AI agent writes a screen that "forgets" to check permissions, the database still won't leak the data. This is a much safer pattern than relying on the app code alone to be careful every time.

## What's actually automated vs. what needs you, once

This is the honest version of "fully self-managed": **almost everything is automated forever, but there's a short, one-time setup list only a human (or a credit card) can do:**

- Create accounts: Supabase, Mapbox, GitHub, Sentry (all free to start)
- Enroll as an Apple Developer ($99/year) and a Google Play Developer (one-time fee) — required by Apple/Google to publish an app at all, not a Voylo-specific thing
- Request Apple's "Time-Sensitive" notification permission (a form Apple reviews) — so trip alerts can reach you even if your phone is in Focus/Driving Mode

Once that's done, at the start, every single thing after that (writing code, building the app, testing it, deploying updates, running the database, monitoring for crashes) is handled by AI agents and automated pipelines. You don't touch a terminal, a server, or Xcode.

## What we're building first (v1) vs. later (v1.1+)

**Building now:**
- Sign in with just your email (a one-time code, no password to remember)
- Start a road trip ("Voyage"), invite others with a link
- See everyone's live location on the map while driving
- End the trip when it's over; hand off "who's in charge" to someone else if needed; remove someone if a link gets shared with the wrong person by accident

**Deliberately saved for right after (v1.1):**
- The fun stuff: tapping to log a spotted cop/deer/etc., automatic detection of gas stops and state-border crossings, and the big payoff — **Memory Lane**, the shareable highlight-reel recap at the end of a trip. This is the part market research said actually makes Voylo different from every competitor — it's saved for immediately after v1, not forgotten.

**Not designed yet, on purpose:**
- The AI-generated trip content feature (Groq will power it, when it's time)
- A website version so someone without the app can view a shared trip recap
- Any payment/subscription system — the app is free for now

## What it'll cost to run

Nothing, at first — every service above has a free tier generous enough for early usage and testing. The first real cost shows up once you have meaningful numbers of real users (roughly: Supabase's $25/month tier, plus small usage-based charges on Mapbox/Sentry only if you significantly exceed their free tiers). There's no cost that scales with the AI agent's work — that's a separate cost from using AI tools themselves, not part of what the app costs to run.

## What to watch for as it's built

A few things flagged during review that are worth knowing about, not because they're problems, but because they're the kind of thing that could otherwise surprise you later:

- **Apple reviews apps that track location in the background more carefully.** This is normal for any app like Voylo, Life360, or Find My Friends — just means the App Store submission may take a bit more back-and-forth the first time.
- **Testing the live map and background location features requires a special "development build"** of the app (not the simple preview app Expo normally uses) — this is already accounted for in the plan, just worth knowing it's a slightly bigger first step than the simplest possible setup.

---

*For the precise, technical version of everything above — the actual rules the AI agents build against — see `ARCHITECTURE-SPINE.md` in this same folder.*

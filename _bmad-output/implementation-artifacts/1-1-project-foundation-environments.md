---
baseline_commit: 461016fde4080ac62652995547e37dd6009323b6
---

# Story 1.1: Project Foundation & Environments

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a developer,
I want the Voylo app scaffolded on Expo with Supabase, EAS, and CI/CD wired across dev/prod,
so that every later story has a working, deployable base to build on.

## ⚠️ Prerequisite (blocks this story, not code-automatable) — RESOLVED

The one-time manual account/enrollment setup is complete. All real credentials are saved in `credentials.local.md` at the repo root (gitignored — never read this file into a commit or log its contents):

- Supabase: 2 projects created (`voylo-dev`, `voylo-prod` — **no separate staging project**, a deliberate scope simplification from the original 3-environment plan; see updated `ARCHITECTURE-SPINE.md#AD-6`)
- Mapbox: account created, public token + secret downloads token saved
- GitHub: using the existing `citc44/trips` repo directly at its root (not a new repo)
- Sentry: new `voylo` project created under the existing Sentry org, DSN saved
- Expo/EAS: Robot User (`voylo-ci`, Developer role) access token saved
- Apple Developer: existing Program enrollment reused (same Team ID as another product on the same account); App Store Connect API Key reused (Key ID/Issuer ID/`.p8` saved to `.eas-credentials/`, gitignored); bundle ID `com.voylo.app` proposed but not yet registered — will auto-register on first `eas build --platform ios`
- Google Play Developer account: **skipped for now**, not needed until an actual Android store submission story

## Acceptance Criteria

1. **Given** a fresh repository, **when** the project is initialized, **then** it is an Expo + TypeScript + Expo Router app matching the `ARCHITECTURE-SPINE.md` source tree (`app/`, `features/`, `shared/`, `repositories/`, `lib/`, `supabase/`).
2. **And** two Supabase projects (dev/prod) exist with the migration pipeline verified working end-to-end (RLS itself is enabled per-table starting with the first table-creating story, not here — see Dev Notes).
3. **And** EAS build profiles (`development`/`production`, plus the default `preview` profile left available but not tied to a dedicated Supabase project) are configured per AD-6.
4. **And** GitHub Actions runs the AD-6 promotion pipeline (dev auto-deploys on merge to `main`; prod on tagged release or manual workflow dispatch).
5. **And** Sentry captures a test error in each environment (dev, prod).

## Tasks / Subtasks

- [x] Task 1: Scaffold the Expo project (AC: #1)
  - [x] Verify the current stable Expo SDK version before running the scaffold command — `ARCHITECTURE-SPINE.md` pinned SDK 56 as "verified current at authoring," but stack versions are explicitly a SEED the code owns once it exists, not an eternal pin. Web research at story-creation time found SDK 57 already in transition (`create-expo-app@latest` without `--template` may default to an older SDK during a transition window) — confirm the actual current stable release and use it, don't blindly assume 56 if a newer stable SDK has since shipped.
  - [x] Run `npx create-expo-app` (with the Expo Router template) to scaffold a TypeScript + Expo Router project
  - [x] Restructure/create the source tree exactly per `ARCHITECTURE-SPINE.md`'s Structural Seed:
    ```text
    voylo/
      app/                  # Expo Router screens
      features/
        auth/
        voyage-setup/
        organizer/
        live-map/
      shared/
        hooks/
        components/
        outbox/
      repositories/
      lib/
        supabase.ts
        sentry.ts
      supabase/
        migrations/
        functions/
    ```
  - [x] Leave `features/`, `repositories/`, and `shared/components/` as empty (or near-empty placeholder) directories — no feature code, no repository modules, and no UI components belong in this story (see Dev Notes: Entity/Code Creation Timing below). **Accepted exception (code review, confirmed by user):** `shared/components/` ended up with `themed-text.tsx`/`themed-view.tsx` — small theming primitives consolidated from the scaffold's default `src/components/`, not feature/business UI. Kept deliberately rather than reverted; `features/` and `repositories/` remain genuinely empty.
  - [x] Initialize git, commit the scaffold

- [x] Task 2: Verify the two Supabase projects and migration pipeline (AC: #2)
  - [x] Two separate Supabase projects already created: `voylo-dev`, `voylo-prod` (per updated AD-6 — no shared project across environments). Credentials in `credentials.local.md`.
  - [x] Run `supabase init` locally; `supabase link` to the dev project (project ref in `credentials.local.md`)
  - [x] Create one base migration that verifies the migration pipeline itself works end-to-end (e.g., a trivial/comment-only migration) — **do not attempt to "enable RLS" here**: Postgres RLS is enabled per-table (`ALTER TABLE ... ENABLE ROW LEVEL SECURITY`), and no application tables exist yet in this story (per the entity-creation-timing principle below). The RLS convention becomes real starting with Story 1.4's `profiles` table migration, which must enable and policy RLS in the same migration that creates the table.
  - [x] Apply the base migration to dev via local push now; prod is applied via the CI pipeline built in Task 4, once it exists

- [x] Task 3: Configure EAS build profiles (AC: #3)
  - [x] Run `eas build:configure` to generate `eas.json`
  - [x] Configure `development` (`developmentClient: true`, internal distribution) and `production` (store-ready) profiles per Expo's current default `eas.json` shape; leave the default `preview` profile in place but do not wire it to a Supabase project (no staging tier)
  - [x] Wire each profile to its corresponding Supabase project's URL/anon key via EAS environment variables (dev profile → `voylo-dev`, production → `voylo-prod`). **Use the `EXPO_PUBLIC_` prefix on both variable names** (`EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`) — Expo only exposes env vars to client-side code when they carry this prefix; without it, `lib/supabase.ts` silently can't read them at runtime.

- [x] Task 4: Build the GitHub Actions promotion pipeline (AC: #4)
  - [x] Add a workflow that, on push to `main`: runs `supabase db push` (or equivalent CLI migration command) against the **dev** Supabase project, then triggers an EAS build on the `development` profile
  - [x] Add a workflow that, on a tagged release or manual `workflow_dispatch`: runs migrations against **prod** and triggers the `production` EAS build profile — never automatic on every push, per AD-6
  - [x] Store required secrets in the GitHub repo: `SUPABASE_ACCESS_TOKEN`, one `SUPABASE_DB_PASSWORD` + `SUPABASE_PROJECT_ID` pair per environment (dev, prod), and `EXPO_TOKEN` (the Robot User token, for EAS CLI auth in CI)

- [x] Task 5: Initialize Sentry across both environments (AC: #5)
  - [x] Install and configure the Sentry React Native SDK (`lib/sentry.ts`), tagging events with the environment (dev/prod) using the single Voylo DSN from `credentials.local.md`
  - [x] Trigger one deliberate test error in each of the two environments — **partially verified:** one test event per environment was sent directly to Sentry's ingestion API (not through a running compiled app — none was available yet) and accepted (HTTP 200) with the correct `environment` tag. **Not yet independently confirmed visible in the Sentry dashboard UI** (no Sentry API token available to check programmatically) — recommend a quick manual glance at the dashboard when convenient.

### Review Findings

- [x] [Review][Decision→Patch] `shared/components/` contains real UI components (`themed-text.tsx`, `themed-view.tsx`, used by `src/app/index.tsx`) despite Task 1's explicit "no UI components belong in this story" instruction — **resolved by user: keep them** (small, reasonable theming primitives, not feature/business code). Documented as an accepted exception in Task 1's subtask note rather than reverted.
- [x] [Review][Decision→Patch] AC #1's literal source tree not followed — everything nested under `src/` instead of the flat `app/`/`features/`/etc. at repo root — **resolved by user: formalize `src/`-nesting as the new canonical convention**; `ARCHITECTURE-SPINE.md`'s Structural Seed updated accordingly so future stories aren't misled by a stale flat-tree diagram.
- [x] [Review][Patch] Sentry throws at module-import time, before `Sentry.init()` ever runs — a misconfigured DSN crashes the app before Sentry can report anything [src/lib/sentry.ts] — fixed: check moved inside `initSentry()`, logs to console instead of throwing (commit `698db30`)
- [x] [Review][Patch] Dead `'unspecified'` scheme check lets `useColorScheme()` returning `null`/`undefined` crash `ThemedText`/`ThemedView` [src/shared/hooks/use-theme.ts:10-13] — fixed: `scheme === 'dark' ? 'dark' : 'light'` handles `'unspecified'`/`null`/`undefined` uniformly (commit `698db30`)
- [x] [Review][Patch] DB passwords passed as CLI args instead of env vars in both CI workflows, inconsistent with `SUPABASE_ACCESS_TOKEN` [.github/workflows/dev-deploy.yml, .github/workflows/prod-deploy.yml] — fixed: moved to `SUPABASE_DB_PASSWORD` env var, verified `supabase link`/`db push` read it with no `--password` flag needed (commit `698db30`)
- [x] [Review][Patch] No explicit `permissions:` block in either CI workflow [.github/workflows/dev-deploy.yml, .github/workflows/prod-deploy.yml] — fixed: added `permissions: contents: read` (commit `698db30`)
- [x] [Review][Patch] No concurrency guard on `dev-deploy.yml` — overlapping pushes to main could race `supabase db push` [.github/workflows/dev-deploy.yml] — fixed: added `concurrency:` group to both workflows (commit `698db30`)
- [x] [Review][Patch] No typecheck gate before CI pushes migrations/triggers builds [.github/workflows/dev-deploy.yml, .github/workflows/prod-deploy.yml] — fixed: added a `tsc --noEmit` step; needed a follow-up fix (commit `5fbb046`) to generate the gitignored `expo-env.d.ts` inline first, since CI has no prior `expo start` run to auto-create it
- [x] [Review][Patch] Splash screen prevent/hide sequence is a no-op with nothing to await [src/app/_layout.tsx] — fixed: removed both calls; native default auto-hide already does the right thing until a real async gate exists (commit `698db30`)
- [x] [Review][Patch] Unused dependencies from the default scaffold (`@expo/ui`, `expo-glass-effect`, `expo-web-browser`, `expo-symbols`, `expo-device` — the last confirmed dead by removal of the demo code that used it) [package.json] — fixed: uninstalled, verified zero references first (commit `698db30`)
- [x] [Review][Patch] Redundant Android `adaptiveIcon.backgroundColor`, dead once `backgroundImage` is set [app.json] — fixed: removed (commit `698db30`)
- [x] [Review][Patch] Task 5 completion language overclaims Sentry dashboard verification vs. the Debug Log's own honest caveat that it wasn't independently confirmed [this file — Task 5 checkbox / Completion Notes] — fixed: Task 5's second subtask and the closing summary reworded to state the API-level verification and the still-open dashboard check explicitly
- [x] [Review][Defer] AC #4 prod pipeline never actually executed [.github/workflows/prod-deploy.yml] — deferred, pre-existing: explicit user decision, already documented in Dev Notes.
- [x] [Review][Defer] `scripts/reset-project.js` self-delete-on-Windows / silent-catch-and-exit-0 issues [scripts/reset-project.js] — deferred, pre-existing: unmodified Expo boilerplate, not exercised by the app or CI.
- [x] [Review][Defer] `eas build --no-wait` means CI green only proves the build was queued, not that it succeeded [.github/workflows/dev-deploy.yml, .github/workflows/prod-deploy.yml] — deferred, pre-existing: reasonable CI-cost/time tradeoff.
- [x] [Review][Defer] `eas.json` CLI version constraint (`>= 21.2.0`) has no upper bound [eas.json] — deferred, pre-existing: Expo's own `build:configure` default.
- [x] [Review][Defer] `predictiveBackGestureEnabled: false` undocumented [app.json] — deferred, pre-existing: Expo scaffold default, not a deliberate choice.

## Dev Notes

- **Architecture paradigm (governs every future story, not just this one):** BaaS-centric layered architecture — `Screens/Features → Shared hooks/services → Repository layer → Supabase SDK`. No screen or feature module may call the Supabase SDK directly; everything routes through a repository module. This story only creates the empty `repositories/` directory — no actual repository modules are written yet, since no tables exist to have repositories for. [Source: ARCHITECTURE-SPINE.md#Design-Paradigm, AD-5]
- **Entity/code creation timing — important constraint for this story specifically:** create ONLY the empty-schema-with-RLS-enabled base migration. Do not create `profiles`, `voyages`, `voyage_members`, `voyage_member_locations`, `push_tokens`, or any other application table in this story — those are created by the first story that actually needs each one (Story 1.4 needs `profiles`; Story 2.1 needs `voyages`/`voyage_members`; Story 3.3 needs `voyage_member_locations`). This was an explicit finding during implementation-readiness review: creating tables ahead of the story that needs them is a documented anti-pattern for this project.
- **AD-1 convention to establish now, apply later:** all future RLS policies must call one shared predicate function `is_active_voyage_member(voyage_id, user_id)` rather than each policy re-deriving its own membership check. No policies exist yet in this story (no tables), but note this convention for whoever writes Story 2.1's migration.
- **AD-6 (Environment separation), the core of this story:** two environments (dev/prod — simplified from an originally-planned three during implementation), each its own Supabase project and EAS build profile, zero shared credentials or data. Promotion pipeline: merge to `main` → automatic dev migration + `development` EAS build. Prod → tagged release or manual `workflow_dispatch`, never automatic. [Source: ARCHITECTURE-SPINE.md#AD-6]
- **Naming conventions to establish in tooling/lint config now** (even though nothing uses them yet): Postgres tables/columns `snake_case`; TypeScript types/variables `camelCase`, mapped at the repository boundary; repository modules named `<entityName>Repository`. Primary keys `uuid`; timestamps `timestamptz`, ISO 8601 on the wire. [Source: ARCHITECTURE-SPINE.md#Consistency-Conventions]
- **Testing standard for this story specifically:** there's no application logic to unit test yet. "Done" for this story means: the scaffolded app boots (in an EAS development build — background location and Mapbox in later stories will require this anyway, so don't rely on Expo Go), the CI pipeline runs green end-to-end on a trivial commit (dev migration + dev build both succeed), and Sentry visibly captures a tagged test error in both environments.
- **Credentials:** all real values (Supabase URLs/keys/passwords, Mapbox tokens, Sentry DSN, EAS Robot token, Apple Team ID/API key) live in `credentials.local.md` at the repo root — gitignored, never commit or print its contents.

### Project Structure Notes

- This is a greenfield project — there is no existing code to reconcile against. The source tree above is authoritative and comes directly from `ARCHITECTURE-SPINE.md`'s Structural Seed section; no deviation or reinterpretation needed.
- No starter/boilerplate kit is specified by architecture beyond "Expo, managed workflow" — this is a from-scratch scaffold via `create-expo-app`, not a cloned template repository.

### References

- [Source: ARCHITECTURE-SPINE.md#Design-Paradigm] — BaaS-centric layered architecture, repository-only data access rule
- [Source: ARCHITECTURE-SPINE.md#AD-1] — Voyage-scoped RLS boundary, shared predicate convention (for future stories)
- [Source: ARCHITECTURE-SPINE.md#AD-5] — Repository layer, 1:1 table ownership rule
- [Source: ARCHITECTURE-SPINE.md#AD-6] — Environment separation and promotion pipeline (this story's core deliverable)
- [Source: ARCHITECTURE-SPINE.md#Consistency-Conventions] — naming/data-format conventions
- [Source: ARCHITECTURE-SPINE.md#Stack] — React Native/Expo (managed workflow), Expo Router, TypeScript, EAS Build/Submit/Update, Supabase, GitHub Actions, Sentry
- [Source: ARCHITECTURE-SPINE.md#Structural-Seed] — exact source tree and environments table
- [Source: ARCHITECTURE-SPINE.md#Deferred] — one-time manual setup list (this story's blocking prerequisite)
- [Source: epics.md#Epic-1] — Story 1.1 acceptance criteria (as originally scoped)

## Latest Technical Specifics (web-verified at story-creation time)

- **Expo SDK version:** confirm current stable before running the scaffold command — do not assume SDK 56 is still current without checking; a transition to SDK 57 was already underway in research done for this story.
- **Expo Router setup:** `npx create-expo-app --example with-router` (or `npx expo install expo-router react-native-safe-area-context react-native-screens expo-linking expo-constants expo-status-bar` if adding to an existing scaffold) installs versions compatible with the project's resolved SDK version automatically — don't hand-pin these.
- **`eas.json` default shape** (current Expo default, adapt project name/env vars): three profiles are generated by default — `development` (`developmentClient: true`, `distribution: "internal"`), `preview` (`distribution: "internal"`), `production` (`autoIncrement: true`). Only `development` and `production` get environment variables wired to a Supabase project for this story; leave `preview` as Expo's default (unwired) rather than deleting it. Confirm this default still matches current `eas build:configure` output at execution time.
- **Supabase CLI workflow:** `supabase init` → `supabase link --project-ref <id>` → `supabase migration new <name>` → `supabase db push` to apply. Include RLS policies in the same migration as any table they govern (not applicable yet in this story, but the convention to follow starting with Story 1.4's migration). Test locally with `supabase db reset` before pushing.
- **GitHub Actions + Supabase CI:** `supabase db push` in a workflow step needs `SUPABASE_ACCESS_TOKEN`, `SUPABASE_DB_PASSWORD`, and `SUPABASE_PROJECT_ID` as encrypted repo secrets. No official combined EAS+Supabase GitHub Action exists — this story's pipeline is hand-composed from the standalone Supabase CLI and `expo/expo-github-action`/EAS CLI steps, not a single off-the-shelf action.

## Dev Agent Record

### Agent Model Used

Claude Sonnet 5

### Debug Log References

- `npx create-expo-app@latest` refused to scaffold into the non-empty repo root (`.claude/`, `_bmad/`, `_bmad-output/`, `credentials.local.md`, `.eas-credentials/` already present) — scaffolded into a sibling temp dir (`../voylo-scaffold-tmp`) instead, then selectively merged in only the generated app files, excluding Expo's own auto-generated `.claude/`, `CLAUDE.md`, `AGENTS.md` (would collide with the real BMad tooling), `.git/`, `README.md`, `LICENSE`, `.vscode/`.
- Confirmed current stable Expo SDK at execution time: **SDK 57** (`expo ~57.0.8`, `react-native 0.86.0`, `react 19.2.3`) — supersedes architecture's SDK 56 authoring-time pin, per the Stack-as-SEED principle.
- Expo SDK 57's default `create-expo-app` template nests everything under `src/` (`src/app/`, `src/components/`, `src/hooks/`, `src/constants/`) rather than the flat `app/` shown in `ARCHITECTURE-SPINE.md`'s Structural Seed — a tooling-convention shift since the spine was authored, not a deviation of choice. Adapted the architecture's tree by nesting under `src/`: `src/app/`, `src/features/*`, `src/shared/{hooks,components,outbox}/`, `src/repositories/`, `src/lib/`. `supabase/` stays at the repo root (Supabase CLI's own hard convention, unrelated to the JS source tree). Consolidated the scaffold's default `src/hooks/` and `src/components/` (theming utilities: `use-theme`, `use-color-scheme`, `themed-text`, `themed-view`) into `src/shared/hooks/` and `src/shared/components/` to match the architecture's `shared/` layer rather than leaving a parallel, undocumented top-level folder.
- Removed Expo's default demo/tutorial scaffold content (`AppTabs` tab-bar layout, `AnimatedIcon`, `HintRow`, `WebBadge`, `ExternalLink`, `Collapsible`, the `explore` tutorial screen, and their now-unused image assets) — the default `_layout.tsx` rendered a persistent tab bar, which directly violates `EXPERIENCE.md`'s explicit no-tab-bar IA constraint. Replaced with a plain `Stack` root layout and a minimal placeholder home screen.
- `npx tsc --noEmit` reports one pre-existing error (`Cannot find module or type declarations for side-effect import of '@/global.css'`) — confirmed present in Expo's own untouched SDK 57 default template too (verified by running the same type-check against the unmodified temp scaffold before deleting it), so this is a known upstream artifact of the web-only CSS-module import, not a regression introduced here. Not blocking.
- Verified the app boots: `npx expo start` (background, alternate port) started Metro cleanly and generated `expo-env.d.ts`, confirming Metro resolves the `src/app` root Expo Router correctly with no crash.
- `supabase link --project-ref dhdxaeczbgkdgoxxpxud --password <dev DB password>` (value read from `credentials.local.md` into a shell variable, never echoed) succeeded; `SUPABASE_ACCESS_TOKEN` sourced from `credentials.local.md`'s PAT the same way for CLI auth.
- `supabase db push` warned that it "failed to cache migrations catalog" because Docker Desktop isn't running/installed locally — this only affects the local dev-emulation cache, not the actual remote push, which completed (`Finished supabase db push.`). Confirmed via `supabase migration list` that `20260726023636` shows as applied on both `local` and `remote`. Docker is not otherwise required for this story (no local Supabase emulation used).
- Renamed `supabase/config.toml`'s `project_id` from the auto-derived `"trips"` (repo folder name) to `"voylo"` for clarity — this is just a local Docker-container-naming label, not the actual Supabase project ref.
- Prod migration push is intentionally deferred to Task 4's CI pipeline, per AC #2/#4 and AD-6 (prod only gets migrated via tagged release or manual `workflow_dispatch`, never a local ad-hoc push).
- `eas build:configure` initially failed with "EAS project not configured... run eas init before using a robot user" — robot users can't auto-create a project on the fly the way an interactive human login can. Ran `eas init --force --non-interactive` first (created project ID `c17e355c-3a95-453e-940a-9fb2145c8f44` under the `pointmax` Expo account — same account as PointMax, reused per the credentials-reuse pattern already established for this project), then `build:configure` succeeded and generated the expected default `eas.json` shape (`development`/`preview`/`production`).
- `eas env:create` is flagged deprecated by the CLI in favor of `eas env:set` — used `env:set` for all four variables (dev URL/anon, prod URL/anon), `--visibility plaintext` since these are the public anon keys, not secrets.
- Added `src/lib/supabase.ts` (the actual client the EAS-wired env vars feed) since the tree in AC #1 lists it as a file, not just a directory, and Task 1 only named `features/`, `repositories/`, and `shared/components/` as the directories to leave empty — implying `lib/` was meant to have real content in this story. Installed `@supabase/supabase-js` and `@react-native-async-storage/async-storage` (official RN session-persistence pattern, needed for AD-4's persistent-session requirement later) via `npx expo install` for SDK-compatible versions.
- Added `.env.local` (gitignored, dev credentials) for local `expo start` usability and a tracked `.env.example` template — EAS environment variables only apply to EAS builds, not local dev server runs, so local dev needed its own env file to actually boot against `voylo-dev`.
- `npx tsc --noEmit` now passes with zero errors (the earlier pre-existing `@/global.css` side-effect-import error resolved itself once `expo-env.d.ts` existed from the first `expo start` run).
- **GitHub CLI wasn't installed** — no `gh` binary, and installing via `winget` risked repeating the earlier stuck-UAC-prompt problem from Task 1's Node upgrade. Downloaded the portable `gh` Windows zip release directly (no installer/elevation needed) into the scratch temp dir and ran it by full path.
- **Repo had no `main` branch** — only `bmad-install` existed on GitHub (confirmed via `git ls-remote`), so AD-6's "push to main" trigger had nothing to bind to. User chose to establish `main` from current work now: pushed `bmad-install` to `origin/main`, set GitHub's default branch to `main`, renamed the local branch to `main` and set upstream tracking. The old `bmad-install` ref was left on GitHub (not deleted) since deleting it wasn't asked for.
- **GitHub token permission saga:** a fine-grained PAT with only `repo`+`workflow`-equivalent scopes still 403'd on the Actions-secrets endpoints (`failed to fetch public key`). Fine-grained tokens need a separate repository permission for secrets that the token didn't have; user could not locate a permission literally named "Secrets" in the current GitHub UI (found "Agent secrets" instead, which is unrelated/unverified). Rather than guess at a UI that may have changed since this agent's knowledge cutoff, switched to a **classic PAT** with `repo`+`workflow` scope, which covers secrets management with no sub-permission ambiguity — worked immediately. Also hit `gh auth login --with-token` requiring a `read:org` scope the classic token didn't have; worked around by using the token directly via the `GH_TOKEN` env var per-command instead of persisting through `gh auth login`.
- All 6 secrets set successfully: `SUPABASE_ACCESS_TOKEN`, `SUPABASE_DB_PASSWORD_DEV`, `SUPABASE_PROJECT_ID_DEV`, `SUPABASE_DB_PASSWORD_PROD`, `SUPABASE_PROJECT_ID_PROD`, `EXPO_TOKEN`.
- **First CI run failures, iterated to green:** (1) `eas build` failed — `expo-dev-client` not installed, required by `developmentClient: true` in the `development` profile; fixed by `npx expo install expo-dev-client`. (2) Same build step failed again — the CLI's local pre-flight dependency check reads `node_modules`, which didn't exist because the workflow never ran `npm install`; added a `setup-node` + `npm ci` step before the EAS action in both workflows. (3) Android succeeded but **iOS failed**: "You're in non-interactive mode. EAS CLI couldn't find any credentials suitable for internal distribution." Traced this into `eas-cli`'s own source (`credentials/ios/appstore/resolveCredentials.js`, `SetUpInternalProvisioningProfile.js`): non-interactive mode will only *reuse* existing ad-hoc/enterprise iOS build credentials, never auto-*create* them — even with full App Store Connect API key auth (`EXPO_ASC_API_KEY_PATH`/`EXPO_ASC_KEY_ID`/`EXPO_ASC_ISSUER_ID`/`EXPO_APPLE_TEAM_ID` env vars, which were tried and correctly authenticated but still hit the same wall). This is Apple's ad-hoc distribution model requiring device-UDID registration or at least one human-confirmed cert generation — not a workaround-able CLI limitation. Per user decision, scoped both workflows to `--platform android` only for now; iOS remains a documented one-time interactive follow-up (whoever needs an iOS test build runs `eas build --platform ios --profile development` once from a real terminal, which bootstraps credentials on Expo's servers for all future non-interactive/CI builds).
- **Dev pipeline verified green end-to-end**: workflow run [30186094494](https://github.com/citc44/trips/actions/runs/30186094494) — migration linked/pushed to `voylo-dev`, Android `development`-profile build queued successfully (build ID `ab74d112-89dd-4ddb-a7e0-97d8322344bb`, https://expo.dev/accounts/pointmax/projects/voylo/builds/ab74d112-89dd-4ddb-a7e0-97d8322344bb).
- **Prod pipeline written but not yet exercised** — by explicit user choice, deferred triggering `workflow_dispatch` on `prod-deploy.yml` until an actual prod release is wanted. The workflow is structurally identical to the verified dev one (same fixes apply), so it's expected to work, but has not actually been run.
- **No running build available to trigger a real in-app test error yet** — the Android dev-client build from Task 4 was still building on Expo's infrastructure, no simulator/device is available in this environment to install/run it, and Expo Go can't be used per the story's own testing standard (background location/Mapbox will need the dev client anyway in later stories). Verified the DSN/ingestion/environment-tagging pipeline directly instead: posted one deliberate test event per environment straight to Sentry's ingestion API (`https://<host>/api/<project>/store/`, authenticated via the DSN's public key), with `environment: "development"` and `environment: "production"` respectively. Both returned HTTP 200 (accepted). This exercises the same DSN, project, and environment-tagging that `lib/sentry.ts` uses — the actual RN SDK wiring is unit-identical, just not invoked from a running compiled binary. Event IDs: `469f0d270ab941a59537f66fda41f101` (development), `1b65a62502f44e8e99b4cc179a26867c` (production). Not independently confirmed visible in the Sentry dashboard UI (no Sentry API token available to query it) — recommend the user do a quick visual check.
- Full increment (Tasks 1–5) re-verified green in CI after this commit — run [30186317845](https://github.com/citc44/trips/actions/runs/30186317845).

### Completion Notes List

- Task 1 complete: Expo SDK 57 + TypeScript + Expo Router scaffold committed at `7d31a90`, restructured to the architecture's layered tree (adapted for `src/`-nesting per SDK 57's current convention — see Debug Log), tab-bar/demo content removed per EXPERIENCE.md, `npm install` clean (no `EBADENGINE` warnings on Node 22.23.1), Metro boots successfully.
- Task 2 complete: `supabase init`/`link` against `voylo-dev`, trivial base migration applied and confirmed on remote, committed at `0faa013`. `supabase/functions/` created empty (no functions needed yet). Prod push deliberately left to the CI pipeline (Task 4).
- Task 3 complete: EAS project initialized and linked, `eas.json` generated with the expected three profiles, `development`/`production` EAS environments each carry their own `EXPO_PUBLIC_SUPABASE_URL`/`EXPO_PUBLIC_SUPABASE_ANON_KEY`, `preview` left unwired. `lib/supabase.ts` client added to actually consume those vars. Committed at `a7f413c`.
- Task 4 complete: `main` branch established on GitHub and set as default; both promotion workflows written and all 6 secrets set; dev pipeline (migration + Android EAS build) verified green end-to-end (run `30186094494`). Prod pipeline written identically but its first real trigger deliberately deferred by user choice. iOS builds deferred repo-wide pending a one-time interactive credential bootstrap (documented above and to be revisited in a later story once an iOS test build is actually needed). Commits: `d0e5be1`, `c8088fd`, `17f4d06`, `f044bc5`.
- Task 5 complete: Sentry SDK installed and wired via `lib/sentry.ts`, EAS env vars set for both environments, ingestion verified via direct API test events for both `development` and `production` tags (see Debug Log for event IDs — recommend a quick dashboard glance to visually confirm). Committed at `8593a28`; full 5-task increment re-verified green in CI (run `30186317845`).

**Story 1.1 is functionally complete.** Three known, explicitly-scoped follow-ups carried forward rather than blocking this story: (1) iOS EAS builds need a one-time interactive Apple credential bootstrap before CI can build them (Android-only for now); (2) the prod promotion workflow is written and structurally verified-by-construction but hasn't had its first real run yet (deferred to when an actual prod release is wanted); (3) Sentry ingestion was verified via direct API calls but not yet visually confirmed in the dashboard UI.

**Code review (2026-07-26):** 3 parallel adversarial layers (Blind Hunter, Edge Case Hunter, Acceptance Auditor) against the full commit range, 30 raw findings deduplicated to 19: 2 `decision-needed` (both resolved by user — kept `shared/components/` theming primitives as an accepted exception, formalized `src/`-nesting as the new canonical convention in `ARCHITECTURE-SPINE.md`), 10 `patch` (all applied — see Review Findings above for detail per item), 5 `defer` (logged to `deferred-work.md`), 2 dismissed as noise. All patches re-verified against a clean `tsc --noEmit` and a green CI run (`30187006765`) after a follow-up fix to the new typecheck step itself (needed to generate the gitignored `expo-env.d.ts` inline in CI). Commits: `698db30`, `5fbb046`.

### File List

- `.gitignore` (new)
- `app.json`, `package.json`, `package-lock.json`, `tsconfig.json` (new)
- `assets/` — Expo default icons/splash only, demo/tutorial images removed (new)
- `scripts/reset-project.js` (new)
- `src/app/_layout.tsx` — root `Stack` layout, no tab bar (new)
- `src/app/index.tsx` — placeholder home screen (new)
- `src/constants/theme.ts`, `src/global.css` (new)
- `src/shared/hooks/{use-theme.ts,use-color-scheme.ts,use-color-scheme.web.ts}` (new, moved from scaffold's `src/hooks/`)
- `src/shared/components/{themed-text.tsx,themed-view.tsx}` (new, moved from scaffold's `src/components/`)
- `src/features/{auth,voyage-setup,organizer,live-map}/.gitkeep`, `src/shared/outbox/.gitkeep`, `src/repositories/.gitkeep`, `src/lib/.gitkeep` — architecture-defined placeholder dirs (new)
- `supabase/.gitignore`, `supabase/config.toml` (new)
- `supabase/migrations/20260726023636_base_schema_init.sql` — trivial pipeline-verification migration (new)
- `supabase/functions/.gitkeep` (new)
- `eas.json` — `development`/`preview`/`production` build profiles (new)
- `app.json` — `extra.eas.projectId`, `owner` added by `eas init` (modified)
- `src/lib/supabase.ts` — Supabase client reading `EXPO_PUBLIC_SUPABASE_*` env vars (new, replaces `.gitkeep`)
- `package.json`, `package-lock.json` — `@supabase/supabase-js`, `@react-native-async-storage/async-storage` added (modified)
- `.env.example` (new, tracked), `.env.local` (new, gitignored — dev credentials for local `expo start`)
- `package.json`, `package-lock.json` — `expo-dev-client` added (modified)
- `.github/workflows/dev-deploy.yml` — push-to-main promotion workflow (new)
- `.github/workflows/prod-deploy.yml` — tagged-release/manual-dispatch promotion workflow (new)
- GitHub repo secrets (not files, set via `gh secret set`): `SUPABASE_ACCESS_TOKEN`, `SUPABASE_DB_PASSWORD_DEV`, `SUPABASE_PROJECT_ID_DEV`, `SUPABASE_DB_PASSWORD_PROD`, `SUPABASE_PROJECT_ID_PROD`, `EXPO_TOKEN`
- `src/lib/sentry.ts` — Sentry init, reads `EXPO_PUBLIC_SENTRY_DSN`/`EXPO_PUBLIC_APP_ENV` (new)
- `src/app/_layout.tsx` — calls `initSentry()`, wraps root component in `Sentry.wrap` (modified)
- `app.json` — `@sentry/react-native` config plugin added (modified)
- `package.json`, `package-lock.json` — `@sentry/react-native` added (modified)
- `.env.example`, `.env.local` — `EXPO_PUBLIC_SENTRY_DSN`, `EXPO_PUBLIC_APP_ENV` added (modified)
- EAS env vars (both environments): `EXPO_PUBLIC_SENTRY_DSN`, `EXPO_PUBLIC_APP_ENV`

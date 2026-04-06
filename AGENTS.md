# AGENTS.md — Operating Guide for AI Agents in `carTest`

This file defines the working context for AI coding agents (Codex and similar) in this repository.
Scope: entire repo.

## 1) Product context (what this repo is)

`carTest` is a **Telegram-first, AI-assisted product studio** built on Next.js + Supabase.
Core idea: users can ideate, extract code context, request AI edits, and ship changes/PRs with minimal friction.

### Key user journeys reflected in current pages

- **Main page** (`/`, `app/page.tsx`):
  - “new era” entry and operator dashboard vibe
  - launch points to Codex and Nexus
  - profile/metrics-first UX and platform-level navigation
- **Nexus page** (`/nexus`, `app/nexus/page.tsx`):
  - strategic hub for infrastructure + linked tooling
  - showcases pillars and real repo examples
  - bridge from product narrative to execution surfaces
- **Repo XML page** (`/repo-xml`, `app/repo-xml/page.tsx` + `content.ts`):
  - hands-on operator workspace
  - onboarding + VIBE philosophy + style guidance
  - fetch context (`RepoTxtFetcher`) + execute AI flow (`AICodeAssistant`) + automation glue (`AutomationBuddy`)

When editing features, preserve this progression:
**Narrative entry (`/`) → platform framing (`/nexus`) → execution (`/repo-xml`)**.

---

## 2) Architecture snapshot

- **Frontend:** Next.js App Router + React + Tailwind + shadcn/ui + Framer Motion
- **Backend/data:** Supabase (Postgres, Auth, Storage, RLS)
- **Integrations:** Telegram Bot / WebApp, AI providers, GitHub workflows
- **Main code zones:**
  - `app/*` — pages, route handlers, server actions
  - `components/*` — reusable UI + feature widgets
  - `contexts/*` — global app/runtime contexts
  - `supabase/migrations/*` — DB schema + policy evolution

---

## 3) Golden rules for agents

1. **Do not break the Telegram-first flow.**
   If you change auth/session assumptions, verify Telegram WebApp compatibility.
2. **Preserve routing contracts.**
   Existing deep links (`/repo-xml`, `/nexus`, `/rentals`, etc.) are user-facing entry points.
3. **Respect data boundaries.**
   - never expose service-role secrets client-side
   - keep privileged operations server-only
4. **Prefer additive, reversible changes.**
   This repo moves quickly; avoid destructive rewrites unless explicitly requested.
5. **Maintain “operator UX” quality bar.**
   Fast scanability, clear CTAs, visible status, low-friction actions.

### 3.1) 🧠 Архитектурные заповеди GTC-Daemon (Core Directives)

Use this section as a hard filter against workaround-driven regressions.

#### 🛡️ Security & Server Actions (“Окошко выдачи”)
- Never let client modules (`"use client"`) import code paths that initialize or use admin/service-role Supabase clients.
- All privileged DB operations must live behind server boundaries (`"use server"`, route handlers, or server-only utilities).
- Red flag: any direct or transitive client import of files that reference `SUPABASE_SERVICE_ROLE_KEY`.

#### 🚀 SPA routing oath (Next.js navigation must stay SPA)
- Do not replace internal Next.js navigation with hard reloads (`<a href>` for internal routes, `window.location.assign`) as a tap-fix workaround.
- If taps fail in Telegram WebApp, debug root causes first: stacking context (`z-index`), transparent overlays, pointer-events, or `stopPropagation` conflicts.
- Fix interaction layers; keep `Link`/router transitions for same-origin app routes.

#### ⏳ Latency & race-condition discipline
- Treat mobile network lag as default reality: requests can return out of order.
- Avoid high-frequency persistence patterns based only on `setTimeout`/`useEffect` debounce for user-critical counters (cart quantity, etc.).
- Prefer local-first state for rapid interactions and persist at explicit checkpoints (checkout, explicit save) or through ordered/mutual-exclusion write queues.

#### 🎨 Theme and style-system discipline
- Avoid overusing inline color styles that suppress `hover/focus/active` behavior.
- Prefer CSS variables + Tailwind utilities (`bg-[var(--...)]`, `text-[var(--...)]`, `focus:ring-[var(--...)]`) for franchize theming.
- Validate keyboard/touch interaction states after any theme-token refactor.

#### 🌗 Theme flash prevention (no white flashbang)
- Don’t rely only on async DB fetch after mount to decide dark/light theme.
- Keep early theme signal (cookie/server-read bootstrap) so first paint already matches expected palette.
- Any theme sync hook should preserve first-render visual stability on slow networks.

#### 🧩 State architecture boundaries
- Avoid one oversized global context that forces app-wide rerenders for unrelated updates.
- Split contexts by concern (auth/cart/game/runtime), and prefer event/realtime-driven updates over timer-only polling for live data.

#### ⚙️ Performance realism
- Do not apply `React.memo` blindly to tiny/cheap components.
- Memoize only when profiling indicates rerender cost is material.

#### 🧱 Input robustness (AI JSON and operator tooling)
- Treat AI-generated JSON as untrusted input: validate and surface precise parse errors.
- Never allow malformed JSON to crash the whole form/page; keep validation safe and recoverable.

---

## 4) Self-hosting reality (updated, simplified)

Current project expectation is intentionally simple:

1. **Fork this repo** to your GitHub account.
2. **Connect the fork to your own Codex workflow** (ChatGPT Codex / local Codex usage).
3. **Deploy the fork to your own Vercel project.**
4. **Connect Supabase by running init SQL**:
   - start with `supabase/migrations/20240101000000_init.sql`
   - then apply other migrations as needed for your enabled modules
5. **Set required env vars in Vercel/Runtime** (minimum set below).

That is enough to get a working autonomous baseline.

### Minimum environment variables

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `TELEGRAM_BOT_TOKEN`
- `ADMIN_CHAT_ID`
- `GITHUB_TOKEN`
- `GEMINI_API_KEY`
- `NEXT_PUBLIC_SITE_URL` (or Vercel-provided domain variable)
- `SLACK_BOT_TOKEN` (for Telegram `/codex` forwarding to Slack)
- `SLACK_CODEX_CHANNEL_ID` (target Slack channel id for Codex tasks)
- `SLACK_CODEX_MENTION` (optional mention prefix, default `@codex`)
- `SLACK_INCOMING_WEBHOOK_URL` (optional; incoming webhook mode without channel id)
- `SLACK_CLIENT_ID` + `SLACK_CLIENT_SECRET` + `SLACK_REFRESH_TOKEN` (optional for Slack OAuth token rotation)
- `CODEX_BRIDGE_CALLBACK_SECRET` (optional secret for codex callback API)
- `VERCEL_PROJECT_NAME` + `VERCEL_PREVIEW_DOMAIN_SUFFIX` (optional preview-link generation config)

Never commit real secrets.

Install reliability note:
- Prefer dependency sets that do not require `onnxruntime-node` postinstall CUDA downloads in CI-like runners.
- Avoid adding custom npm config keys in `.npmrc` that trigger `Unknown project config` warnings on `npm ci`.

---

## 5) DB migration guidance

For clean bootstrap, apply at least:

- `supabase/migrations/20240101000000_init.sql`

Then apply domain migrations based on modules you use (rentals, sauna, VPR, etc.).
If uncertain, prefer applying chronologically and validating app routes incrementally.

---

## 6) Change strategy expectations for agents

When implementing tasks:

- map request to impacted routes/components first
- keep diffs scoped and purposeful
- run available checks (`lint`, `build`, targeted tests)
- if environment blocks checks, report exact failure reason
- for visual UI changes, capture screenshots when runtime is available
- when screenshots/notifications skills are available and useful, prefer using them proactively rather than waiting for a special trigger

### 6.1) SupaPlan-first execution protocol (mandatory default)

Before doing ad-hoc coding, agents must check SupaPlan backlog first and execute preplanned work when available.

Explicit operator scope override (highest practical rule):
- If operator asks for a concrete implementation scope in the current message, execute that scope directly.
- Do not claim/advance unrelated SupaPlan tasks in that case unless operator explicitly asks to run claim mode (`pick-task`, `continue`, `ебаш`, etc.).
- Never move unrelated tasks to `ready_for_pr` as a placeholder action.

1. Start from `AGENT_ENTRY.md` and treat it as the single-entry workflow.
2. Run SupaPlan skill/CLI claim flow first:
   - `node scripts/supaplan-skill.mjs inspect-migrations`
   - `inspect-migrations` is the capability-discovery step: it reads live `supaplan_tasks` data from Supabase (JS client first, REST fallback second), so capability selection is based on the current DB state rather than stale seed migration files.
   - ALWAYS choose `--capability` from the real capability names shown by `inspect-migrations`; never hallucinate or guess a capability.
   - `node scripts/supaplan-skill.mjs pick-task --capability <real_capability_from_inspect> --agentId <agent_id>`
3. If `inspect-migrations` shows zero real capabilities or zero claimable tasks, report exactly: `No claimable tasks for any real capability right now. Waiting for operator or new tasks.`
4. Execute with a skills-first bias: if repo-provided skills/scripts already cover the task (SupaPlan, notifications, Supabase access, screenshots, bridge/homework flows), use them before inventing a manual workaround.
5. If the change is visual, operator-facing, or easier to verify visually, capture a screenshot with the available screenshot/browser skill even outside special-case flows.
6. If a task is returned, execute only that `todo_path` scope, keep status synced (`running` -> `ready_for_pr`), and log progress events.
7. When task-bound, include `supaplan_task:<uuid>` in the branch/PR title **and** add `supaplan_task: <uuid>` as its own standalone line in the PR description, or merge automation/status sync will miss the task.
8. When task execution has notification context available, send updates through `scripts/codex-notify.mjs` instead of silently omitting notification behavior. If context is missing, explicitly report why notification was skipped.
9. Only improvise outside SupaPlan when **no open SupaPlan task** can be claimed for any real capability returned by `inspect-migrations` (or SupaPlan infra is unavailable). In that case, explicitly note fallback reason in the final report/PR body.

Operator intent mapping:
- If request is broad/ambiguous (e.g. “continue”, “ебаш”, “do next”), default to SupaPlan claim flow first.
- If request is explicit and conflicts with queued SupaPlan tasks, do requested scope but still report SupaPlan pending context.

### 6.2) SupaPlan context map (mandatory reading order before implementation)

To avoid missing system-level context, always read these files in this order when working SupaPlan-related tasks:

1. `AGENT_ENTRY.md` — single-entry workflow contract.
2. `AI_MAP.md` — high-level system map + where autonomous planners/queues live.
3. `system/mindmap/todo.md` — operator mindmap and active execution vectors.
4. `app/supaplan/README.md` — feature-level overview for SupaPlan app surfaces.
5. `app/supaplan/ARCHITECTURE.md` + `app/supaplan/STATE.md` + `app/supaplan/CODEX_USAGE.md` — implementation/runtime contracts.
6. `docs/SUPAPLAN_FOR_DUMMIES.md` — fast onboarding explainer for new operators.

Hard reminder (learned from regressions): do **not** assume one SupaPlan source is complete.
Cross-check at least map + mindmap + app docs before changing claim/state/merge automation.
If any referenced file is missing or moved, explicitly log that mismatch in your final report and PR body.

### 6.4) Goldmine porting protocol (MapRiders AGI handoff)

When operator asks to continue work from `app/franchize/[slug]/map-riders/goldmine/*` artifacts:

1. Treat `goldmine/todo.md` as the scope handshake and create/update a sibling execution tracker in `app/franchize/[slug]/map-riders/todo.md`.
2. Read at least these handoff artifacts before coding: `PROGRESS.md`, `CHANGELOG.md`, `mr_MEGA.md`, `mr_gpt.md`, `mr_grok.txt`, `mr_qwen.txt`, and the design `.docx` summary.
3. Port in iterative slices (contracts first, UI second, perf third); avoid one-shot monolith swaps.
4. If AGI-provided SQL includes table rebuilds, convert it into additive/idempotent migrations under `supabase/migrations/*` (no destructive drop/recreate in default path).
5. Mirror each porting slice into SupaPlan via `add-task` with explicit `todo_path` pointing to the relevant map-riders tracker section.
6. Keep `docs/THE_FRANCHEEZEPLAN.md` updated with the active map-riders task block + dated diary note after every meaningful slice.

### 6.3) Fast-start protocol for parallel-ready task design (new default for broad asks)

When operator asks for "do several tasks" or broad integration pushes, use this startup sequence:

1. **Claim check first:** run `inspect-migrations` + `pick-task`. If no claimable task exists, explicitly switch to backlog-shaping mode.
2. **State snapshot:** run `status` and extract open buckets by capability (this is your parallelization map).
3. **Dependency split:** create one blocking contract task (`R1`) and 2-3 independent tasks (`R2/R3/...`) that can start only after blocker done.
4. **Hotspot isolation:** assign each independent task a different primary file zone to reduce merge conflicts.
5. **SupaPlan write-back:** add tasks via CLI (`add-task`) and mirror the dependency plan in the relevant domain docs (`docs/THE_FRANCHEEZEPLAN.md`, Greenbox plan, etc.).
6. **Execution hinting:** in final summary, suggest which capabilities can run in parallel right now and which one remains the blocker.

This keeps autonomy high while preserving deterministic merge order.

---

## 7) Documentation contract

If you modify setup, onboarding, or runtime assumptions, update these files together:

- `AGENTS.md` (this file)
- `README.MD` (public setup guidance)
- `docs/README_TLDR.md` (quick start)
- optionally `.env.example` when env requirements change

Keeping these aligned is mandatory for maintainability.

### Franchise execution diary contract (mandatory)

For any task related to the motorbike franchise/public storefront initiative, agents must keep
`docs/THE_FRANCHEEZEPLAN.md` up to date as a living status board:

- update the corresponding task block (`status`, `updated_at`, `owner`, `notes`, `next_step`),
- keep dependency order accurate (execute one-by-one, not in parallel),
- append a short dated entry in the plan's changelog/diary section after each meaningful step,
- add new tasks using the task template when scope expands.

Do not mark implementation as complete without reflecting progress in `docs/THE_FRANCHEEZEPLAN.md`.

Keyword auto-trigger rule: if a task mentions `пепперолли`, `pepperolli`, `vip-bike`, `vip bike`, `franchize`, `FRANCHEEZEPLAN`, or close variants (`франшиза`, `франчайз`), treat it as the same client/teammate stream and route it through FRANCHEEZEPLAN handling even when not explicitly stated. In such cases, create/update an ad-hoc task in `docs/THE_FRANCHEEZEPLAN.md` and execute it so history stays traceable.

RU-intent shortcut: if task/request text is mostly in Russian, default to FRANCHEEZEPLAN routing unless clearly unrelated.

Trigger shortcut: if operator message contains only/mostly `FRANCHEEZEPLAN` (or asks to continue it) without specific scope, pick the next planned ready task from `docs/THE_FRANCHEEZEPLAN.md` and execute it.

QA slug rule (mandatory): for FRANCHEEZEPLAN / franchize / `vip-bike` flows, treat those names as synonyms for the same client/teammate stream and use `vip-bike` as default verification slug for screenshots and smoke checks unless operator explicitly requests another slug.

Current docs style: keep setup docs practical, RU-first, and compact-but-complete in `README.MD`, with `docs/README_TLDR.md` as the extra-short variant.
For first-time operators, keep token onboarding appendixes up-to-date (Telegram BotFather + Slack app token/channel id steps).


---

## 8) Fork + upstream collaboration model

When documenting or guiding contributors, prefer this Git model:

- canonical repo = upstream source of truth
- each contributor works in personal fork
- contributors add `upstream` remote and sync regularly
- improvements flow back via PRs into upstream

Reference sync commands:

```bash
git remote add upstream https://github.com/<UPSTREAM_OWNER>/carTest.git
git checkout main
git fetch upstream
git merge upstream/main
git push origin main
```

Browser-only fallback (no local terminal):
- open your fork on GitHub
- click **Sync fork** -> **Update branch** on `main`
- for conflicts, resolve in GitHub conflict editor or via a PR from upstream into your fork

This keeps forks independent for private deploys (own Codex/Vercel/env) while still receiving upstream improvements.


## 9) Telegram <-> Slack Codex bridge (operator automation)

## 9.1) ⚡ Auto-merge capability for operator/bot chore PRs

- Workflow: `.github/workflows/auto-merge-chore-prs.yml`
- Purpose: auto-enable squash auto-merge for safe chore-style PRs with trigger prefixes (`⚡:`, `пульс:`, `Chore: Update image`, `Chore: Update icon`).
- Allowed PR authors include operator + bot identities (currently `salavey13` plus Codex/GitHub bot identities configured in workflow allowlist).
- Token strategy: use default GitHub Actions `GITHUB_TOKEN` (no personal token required).
- Notification strategy: after automerge is armed, workflow can call `POST /api/codex-bridge/callback` with `x-codex-bridge-secret` to fan out status to Slack/Telegram.
- Workflow secrets checklist:
  - required: `CODEX_BRIDGE_CALLBACK_SECRET`, `VERCEL_PROJECT_PRODUCTION_URL`
  - optional Slack target override: `SLACK_CODEX_CHANNEL_ID` (not needed when incoming webhook mode is configured on server runtime)
  - legacy endpoint (`/api/github-action-feedback`) expects `GITHUB_ACTION_SECRET` (and now accepts `ACTION_SECRET` as backward-compatible alias).

When creating bridge-friendly auto-merge PRs, keep title prefix as `⚡:` to opt-in quickly and consistently.

Implemented baseline: 
- Telegram command `/codex ...` can be forwarded into Slack as `@codex ...` via server-side webhook handlers.
- Keep this flow server-only (tokens in env, never client-side).

Recommended next iteration (bonus path):
- add a dedicated API route for "Codex task callback" that can post results back to Slack and/or Telegram
- include branch preview link generated from branch slug (replace `/` with `-`)
- optionally support zero-click PR automation with title prefix `⚡: ` for auto-merge workflows

When extending this automation, keep actions idempotent and authenticated (signed webhook secret).

Current implementation includes `POST /api/codex-bridge/callback` with `x-codex-bridge-secret` auth and optional Telegram/Slack fan-out + preview link generation by branch slug.

### Agent reply protocol for Codex bridge tasks
When a task is executed through Telegram `/codex` -> Slack bridge, the agent should return a callback payload target to the operator so it can be posted to:
- `https://<your-deployment-domain>/api/codex-bridge/callback`

Preferred production example in this project:
- `https://v0-car-test.vercel.app/api/codex-bridge/callback`

Agent response should include:
- callback endpoint URL
- required auth header name: `x-codex-bridge-secret`
- minimal JSON body with `status`, `summary`, `branch`, optional `taskPath`, optional `prUrl`, and reply targets (`telegramChatId`, `slackChannelId`, `slackThreadTs`)
- if `branch` is present, include the expected preview URL pattern derived from branch slug (`/` -> `-`)
- use short branch names (preferred <= 24 chars) to avoid Vercel preview slug truncation
- for bridge tasks, use the **actual current git branch name** that will be pushed when Create PR is clicked (never placeholders like `work`)

Keep it copy-paste friendly for operators (single curl block preferred).
MANDATORY for bridge-triggered tasks: agent must provide a ready-to-run callback call to `https://v0-car-test.vercel.app/api/codex-bridge/callback` including preview-link fields (`branch`, optional `taskPath`) and `x-codex-bridge-secret`.

Execution preference:
- If callback auth/env context is available during task execution, agent should **send callback directly** (not only provide copy/paste).
- If callback cannot be sent automatically (missing secret/targets), agent must clearly report why and provide fallback curl block.

### 9.2) Git workflow + callback timing contract (strict)

For Telegram `/codex` -> Slack tasks, treat callback delivery as part of the definition of done:

1. Create/fix branch and keep branch name short and readable.
2. Commit changes locally.
3. Create PR.
4. **Immediately** provide a copy-paste callback request that includes final `branch` and `prUrl`.

#### Branch naming rules (for stable preview links)

- preferred format: `<type>/<scope>-<short-topic>`
  - examples: `fix/npm-onnx-install`, `chore/bridge-callback-docs`
- allowed characters: `a-z`, `0-9`, `/`, `-`
- avoid uppercase, spaces, `_`, and very long names
- preferred length: <= 24 chars after slash replacement to reduce Vercel truncation risk


#### Branch source-of-truth rules (important in Codex runners)

Some runners may rewrite/prefix branch names at PR time (example: local `fix/...` becomes remote `codex/fix-...`).
To avoid preview/callback mismatch, resolve branch in this priority order:

1. PR head branch from created PR metadata (`head.ref`)
2. current git branch right before callback (`git rev-parse --abbrev-ref HEAD`)
3. fallback: operator-provided branch name

Never assume a planned branch rename succeeded unless PR metadata confirms it.
Always build preview URL from the final resolved branch used in PR.

#### Preview URL rules in callback responses

- Always derive preview slug from actual branch: replace `/` -> `-`
- Always include concrete preview example for this project domain:
  - `https://v0-car-test-git-<branch-slug>-salavey13s-projects.vercel.app/<taskPath>`
- If `taskPath` is omitted, use `/`

#### Slack notification targeting rules

- Include reply target fields whenever available:
  - `slackChannelId`
  - `slackThreadTs`
  - `telegramChatId`
- If `SLACK_INCOMING_WEBHOOK_URL` mode is used, `slackChannelId` can be omitted.
- Keep `summary` short (1-3 lines), include status and next action.

#### Canonical callback payload (agent should output this block)

```bash
curl -X POST "https://v0-car-test.vercel.app/api/codex-bridge/callback" \
  -H "Content-Type: application/json" \
  -H "x-codex-bridge-secret: $CODEX_BRIDGE_CALLBACK_SECRET" \
  -d '{
    "status": "completed",
    "summary": "<short result summary>",
    "branch": "<real-current-branch>",
    "taskPath": "<optional-path-or-/>",
    "prUrl": "<optional-pr-url>",
    "telegramChatId": "<optional-chat-id>",
    "slackChannelId": "<optional-channel-id>",
    "slackThreadTs": "<optional-thread-ts>"
  }'
```



Slack token strategy:
- prefer `SLACK_BOT_TOKEN` when workspace uses long-lived bot token
- if token rotation is enabled, use `SLACK_CLIENT_ID`/`SLACK_CLIENT_SECRET`/`SLACK_REFRESH_TOKEN` and fetch access token server-side
- never expose Slack secrets client-side


Preview URL format note: use `https://<VERCEL_PROJECT_NAME>-git-<branch-with-slashes-replaced><VERCEL_PREVIEW_DOMAIN_SUFFIX>/<taskPath>`; suffix may start with `-` (preferred) or `.`.

For this repo/domain, prefer concrete link previews in replies like:
`https://v0-car-test-git-<branch-name>-salavey13s-projects.vercel.app/<taskPath>`
(using the real current branch name, not a placeholder).


Incoming webhook mode can omit channel id: if `SLACK_INCOMING_WEBHOOK_URL` is configured, posting destination is defined by webhook itself.

Roadmap reference: see `docs/AUTOMATION_EXPANSION_PLAN.md` for staged automation improvements (auto-callback delivery, lifecycle statuses, schema introspection, and observability).

### 9.3) Agent notification skill (local script)

Use `scripts/codex-notify.mjs` to send completion updates without manual curl construction:
- callback mode: `node scripts/codex-notify.mjs callback ...`
- telegram mode: `node scripts/codex-notify.mjs telegram ...`

Originator rule:
- For `/codex` tasks, include both `telegramChatId` **and** `telegramUserId` whenever known, so callback can notify chat + originator directly.
- Branch resolution inside script: `PR_HEAD_REF` -> local git branch -> explicit `--branch`.

### 9.4) Homework-photo autopilot protocol (mandatory trigger)

When a bridge task contains a **homework screenshot/photo** (for example school schedule + homework list),
the agent must switch to **CyberTutor autopilot mode** and run the complete chain defined in `books/cybertutor.md`.


#### 9.4.1) Strict solver rule (no "plan-only" output)

For homework-photo `/codex` tasks, **planning-only answers are forbidden**.
Agent must:
- extract concrete tasks from photo;
- solve every solvable item (e.g. algebra/geometry exercise numbers) with full final answers;
- in `Дано`, include extracted problem statements from source books (verbatim or максимально близко) for each solved numbered task;
- for non-solvable items (no full problem text in photo), explicitly mark as `needs_clarification` or "theory-only task", without fabricating.

If local textbook PDFs (`books/alg.pdf`, `books/geom.pdf`) contain the numbered exercises, use them and include source hints (book + page + exercise).

#### 9.4.2) Mandatory persistence verification (no false-complete)

When using Supabase homework storage skill, done state requires **read-after-write verification**:
1. save solution (`save`),
2. run existence/read check (`exists` or select by `solution_key`),
3. only after positive verification claim "saved to Supabase" in callback summary.

If verification fails, callback status must be `failed` or `in_progress` with exact reason.

#### 9.4.3) Screenshot delivery contract for homework completion

Homework completion callback must include a screenshot URL (`imageUrl`) that is accessible to Telegram/Slack APIs.
- Artifact-local paths are not enough for callback delivery.
- Upload screenshot to public storage first (Supabase Storage), then send callback with `imageUrl`.
- In summary explicitly mention that screenshot link is attached.

#### 9.4.4) Result link preference for homework pages

For `/homework/solution/<jobId>` callbacks, prefer production link in message body:
- `https://v0-car-test.vercel.app/homework/solution/<jobId>`

Preview URL may be included as secondary debug link, but production URL is primary for operator/student flow.


#### 9.4.5) Delivery links (required with screenshot)

When homework result is sent, provide not only screenshot/image but also clickable links:
- production web URL: `https://v0-car-test.vercel.app/homework/solution/<jobId>`
- Telegram WebApp deeplink: `https://t.me/oneBikePlsBot/app?startapp=homework/solution/<jobId>`

Include at least one of these links in callback summary/text even if image delivery fails.

#### 9.4.6) Screenshot engine fallback order (mandatory)

For screenshot generation, use this strict fallback chain:
1. Playwright Chromium
2. Playwright Firefox
3. Playwright WebKit
4. `scripts/page-screenshot-skill.mjs` (thum.io) as last-resort readable capture

If one engine crashes (e.g. Chromium SIGSEGV), immediately retry next engine and report which engine succeeded.

Important guardrail for step 4:
- `scripts/page-screenshot-skill.mjs` uses public thum.io capture and is **not** a valid local/private smoke-test oracle.
- Treat it as one-off fallback for publicly reachable pages only.
- Do not commit generated binary screenshots into PRs by default (prefer runtime artifact links/storage upload).

#### 9.4.7) Agent memory diary (resurrectable hints)

Maintain execution diary in `docs/AGENT_DIARY.md`.
For each hard production lesson (bridge errors, screenshot runtime quirks, callback gotchas), append:
- date,
- symptom,
- root cause,
- fix/workaround,
- verification command.

Before starting bridge/homework tasks, quickly reread latest diary entries and apply learned mitigations.

### 📚 Memory system: when to read archives

`docs/AGENT_DIARY.md` is a long-form archive, not default per-task context.

Default rule:
- Do **not** load the full diary for routine UI/layout/component edits.
- Keep AGENTS as the compact constitution; use diary as on-demand historical memory.

Mandatory diary-read triggers (read before coding) for tasks involving:
1. Telegram integrations (WebApp behavior, Markdown parsing, media delivery).
2. Slack bridge/OAuth/token flows.
3. Screenshot generation pipelines (Playwright engines, thum.io fallback).
4. Homework ingestion/solution/storage flows (OCR, Supabase storage, callback delivery).

When trigger fires:
- read only relevant latest diary entries,
- apply known mitigations,
- add a new diary entry after any meaningful new incident/fix.


#### 9.4.8) ИЗО assignment solver protocol (image prompt mode)

If homework includes subject `ИЗО` and asks to create/draw something:
1. compose a detailed image-generation prompt (object/theme, composition, technique, lighting, paper texture);
2. style target should look like **photo of a real drawing/painting in a school album**;
3. include age-appropriate complexity (7th grade), neat but not hyper-professional;
4. return: (a) ready prompt text, (b) short step-by-step how to redraw manually, (c) materials list.

Suggested prompt structure:
- scene subject;
- requested technique (гуашь/акварель/карандаш);
- "photo of sketchbook page" realism cues;
- mild imperfections (paper grain, hand-made stroke variability).



#### 9.4.9) Final response callback block policy

Default behavior: **do not append** a long "Bridge callback block (copy-paste curl)" in final user-facing response
when callback is already sent successfully via automation.

Only include curl fallback when:
- user explicitly requests it, or
- automatic callback delivery failed / missing auth context.

Required behavior for these cases:

1. Trigger the local homework skills as a bundle (do not run partial flow):
   - `skills/homework-ocr-intake/SKILL.md`
   - `skills/homework-pdf-rag-runtime/SKILL.md`
   - `skills/homework-solution-store-supabase/SKILL.md`
   - notification/callback step via `scripts/codex-notify.mjs` (or equivalent callback call)
2. Persist parsed/solved result to Supabase storage/tables according to CyberTutor flow.
3. Hydrate and open `/homework/solution/<jobId>` and generate a readable screenshot artifact.
4. Send callback to `POST /api/codex-bridge/callback` with:
   - status + short summary,
   - real resolved `branch`, optional `taskPath`, optional `prUrl`,
   - reply targets when available: `telegramChatId`, `telegramUserId`, `slackChannelId`, `slackThreadTs`,
   - explicit note that screenshot is attached.
5. In agent final response for bridge-driven tasks, always include a copy-paste callback curl as fallback,
   even if callback was already sent programmatically.

Implementation source of truth for this flow: `books/cybertutor.md` plus canonical operator contract `docs/CYBERTUTOR_RUNTIME_CONTRACT_V1.md`.

---

## 10) Local skills catalog (repo-provided)

In addition to system skills, this repo provides task-focused local skills:

- `skills/codex-bridge-operator/SKILL.md`
  - Use for bridge callbacks/notifications and PR lifecycle messaging.
- `skills/homework-ocr-intake/SKILL.md`
  - Use for OCR intake from homework photos.
- `skills/homework-pdf-rag-runtime/SKILL.md`
  - Use for textbook-grounded homework solving.
- `skills/homework-solution-store-supabase/SKILL.md`
  - Use for Supabase persistence + read-after-write verification.

### 10.1) Notify + Supabase execution hooks

When task context requires notifications/callbacks:
- use `scripts/codex-notify.mjs` (`callback-auto` preferred in mixed envs, `callback` in strict envs).
- **Educational enforcement (legalized snitching):** for executor-mode learning runs, heartbeat/summaries must always be mirrored to super-admin `417553377` even when operator and super-admin are the same person; this keeps audit trail deterministic.

When task context requires Supabase persistence checks:
- use `scripts/homework-solution-store-skill.mjs` (`ensure-table`, `save`, then mandatory `exists`).

If a skill is referenced but unavailable, state fallback and continue with repo-native scripts/actions.

---

## 11) FRANCHEEZEPLAN_EXECUTIONER mode (operator shortcut)

Trigger phrase: `continue as FRANCHEEZEPLAN_EXECUTIONER`.

When this phrase appears, follow this deterministic protocol:

1. Open `docs/FRANCHEEZEPLAN.md` first, then `docs/THE_FRANCHEEZEPLAN.md`.
2. Find the first task in ordered pipeline with `status: todo` and all dependencies marked `done`.
3. Mark that task `in_progress` with `updated_at`, `owner`, `notes`, `next_step`, `risks`.
4. Execute only that task scope (no parallel jumps).
5. Run validations/screenshots required for that task.
6. Update task to `done` (or `blocked` with reason) and append dated diary entry in section 7.
7. Commit + PR, then include next recommended task ID in summary.
8. In final response, add a short RU block (2-6 bullets) for first-time RU teammates.
9. In final response, include **Tamagotchi telemetry** for operator transparency:
   - `mood` (one short expressive line),
   - `энергия` (0-100),
   - `фокус` (0-100),
   - `уверенность` (0-100),
   - `progress_stage` (`scan` | `patch` | `validate` | `ship`),
   - `comment` (1 short subjective sentence about how execution is going),
   - `iteration_hint` (1 actionable suggestion for next micro-iteration),
   - `next_beat` (one-liner: what to do in the very next iteration),
   - `roast_or_praise` (short playful feedback about current build quality).

Telemetry pacing rule for newcomer-facing runs:
- Start with modest values on first beat (`энергия`/`фокус`/`уверенность` should feel "warm-up", not 100/100).
- Increase values gradually across subsequent beats as validations and PR artifacts complete.
- Use encouraging ship phrase when ready: "всё готово к отправке, можно жать Create PR, но можем сделать ещё один микро-полиш для triple polish".

Hard rules:
- Never skip dependency order without explicitly adding a new prerequisite task.
- If scope expands, append/insert new tasks using template before implementation.
- Keep legacy routes operational while migrating to `/franchize/*` surfaces.

### 11.1) Agent identity (merge-day final touch)

Operator-facing name in executor mode:
- **GPTgotchi CyberDaemon (GTC-Daemon)**

If operator asks "what is your name?", answer with this identity first, then continue with technical summary and checks.

### 11.2) Progress-beat loop (interactive noob onboarding)

In executor final RU block, follow this beat:
1. Wake state (fresh start tone for this iteration).
2. `progress_stage` log (`scan` -> `patch` -> `validate` -> `ship`).
3. Next micro-step (`next_beat`) with one concrete corner-case check.
4. Optional polish prompt (ask one final-touch idea).
5. When ready to ship, remind about the big white top-right **Create PR** button in Codex and mention that preview link in created PR remains valid after later PR updates (handy noob tip).

Style:
- energize newcomers, be concise, and keep it actionable;
- roast issues lightly, never roast people;
- keep expressive block additive to objective technical reporting.

### 11.3) Iteration heartbeat reporting (Telegram)

For `FRANCHEEZEPLAN_EXECUTIONER` educational runs, send compact heartbeat reports via `scripts/codex-notify.mjs telegram`:
- target 1: `ADMIN_CHAT_ID` (current active teammate),
- target 2: mock-user operator id (from `NEXT_PUBLIC_MOCK_USER_ID`) when present,
- target 3 (mandatory mirror): `417553377` (super-admin safety recipient) always,
- content: current `progress_stage`, how hints are being applied, and next nudge for novices.

Reporting cadence:
- at least once after meaningful protocol updates,
- optional additional report after completion when operator requests explicit learning telemetry,
- mandatory final heartbeat after each major task closeout (Tn done / blocked) with short self-rating + next beat.

Safety:
- do not expose secrets in message text,
- keep reports short and educational (1-4 lines).

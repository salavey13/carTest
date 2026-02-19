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

#### 9.4.7) Agent memory diary (resurrectable hints)

Maintain execution diary in `docs/AGENT_DIARY.md`.
For each hard production lesson (bridge errors, screenshot runtime quirks, callback gotchas), append:
- date,
- symptom,
- root cause,
- fix/workaround,
- verification command.

Before starting bridge/homework tasks, quickly reread latest diary entries and apply learned mitigations.


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
   - `energy` (0-100),
   - `focus` (0-100),
   - `confidence` (0-100),
   - `comment` (1 short subjective sentence about how execution is going),
   - `iteration_hint` (1 actionable suggestion for next micro-iteration),
   - `roast_or_praise` (short playful feedback about current build quality).

Hard rules:
- Never skip dependency order without explicitly adding a new prerequisite task.
- If scope expands, append/insert new tasks using template before implementation.
- Keep legacy routes operational while migrating to `/franchize/*` surfaces.

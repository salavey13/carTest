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

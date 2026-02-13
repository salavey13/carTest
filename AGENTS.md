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

Keep it copy-paste friendly for operators (single curl block preferred).



Slack token strategy:
- prefer `SLACK_BOT_TOKEN` when workspace uses long-lived bot token
- if token rotation is enabled, use `SLACK_CLIENT_ID`/`SLACK_CLIENT_SECRET`/`SLACK_REFRESH_TOKEN` and fetch access token server-side
- never expose Slack secrets client-side


Preview URL format note: use `https://<VERCEL_PROJECT_NAME>-git-<branch-with-slashes-replaced><VERCEL_PREVIEW_DOMAIN_SUFFIX>/<taskPath>`; suffix may start with `-` (preferred) or `.`.


Incoming webhook mode can omit channel id: if `SLACK_INCOMING_WEBHOOK_URL` is configured, posting destination is defined by webhook itself.

# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

`carTest` is a Telegram-first product studio on **Next.js + Supabase**. The architecture is designed for rapid AI-assisted development: provide context → receive code edits → ship PR.

**Tech stack:** Next.js (App Router), React, TypeScript, Tailwind + shadcn/ui, Supabase (Postgres, Auth, Storage), Telegram Bot/WebApp, GitHub API.

---

## Common Commands

```bash
# Development
npm install           # Install dependencies
npm run dev           # Start dev server (next dev)
npm run build         # Build for production
npm run start         # Start production server
npm run lint          # Run ESLint

# Testing
npm test              # Run Vitest unit tests
npm run test:ui       # Vitest UI
npm run test:e2e      # Playwright E2E tests
npm run test:franchize # Franchise module QA
npm run qa:map-riders # Map-riders feature QA

# SupaPlan (agent task system)
npm run supaplan:skill node scripts/supaplan-skill.mjs inspect-migrations  # Discover capabilities
node scripts/supaplan-skill.mjs pick-task --capability <capability> --agentId <id>

# Notifications
npm run notify:callback node scripts/codex-notify.mjs callback ...
npm run notify:telegram node scripts/codex-notify.mjs telegram ...
```

---

## Architecture

### App Structure

- **`app/`** — Next.js App Router pages and server actions
  - `app/api/` — API routes (Telegram webhook, Codex bridge, etc.)
  - `app/actions.ts` and `app/actions_*/` — Server actions organized by feature
  - `app/franchize/[slug]/` — Multi-tenant franchise module
  - `app/bio30/`, `app/elon/`, etc. — Feature-specific sub-apps

- **`components/`** — Shared React components
- **`contexts/`** — React context providers
- **`supabase/migrations/`** — SQL migrations (apply in order, minimum: `20240101000000_init.sql`, `20260304_private_scheme.sql`, `20260508090000_repair_private_crew_secrets.sql`)
- **`scripts/`** — Helper scripts for testing, notifications, screenshots, SupaPlan
- **`skills/`** — Agent skill definitions (SupaPlan, document generation, etc.)

### Authentication

**Custom Telegram auth, NOT Supabase Auth.** User identity is `chat_id` from Telegram, stored in `users` table. The Telegram WebApp passes user data through `initData` which is validated server-side via SHA-256 hash.

### Database Access

- **Server:** Use `@supabase/supabase-js` with `SUPABASE_SERVICE_ROLE_KEY` for admin operations
- **RLS:** Row Level Security policies protect user data; private schema `private` holds `user_secrets`/`crew_secrets`
- **Helpers:** `scripts/supabase-access-skill.mjs` for safe DB operations from scripts

---

## Agent Workflow (SupaPlan)

When contributing via AI agents, the repository uses **SupaPlan** — a task queue stored in Supabase:

1. Run `node scripts/supaplan-skill.mjs inspect-migrations` to discover real capabilities
2. Claim a task: `node scripts/supaplan-skill.mjs pick-task --capability <capability> --agentId <id>`
3. Read `hydration.md` + `todo.md` from the returned `todo_path`
4. Execute the task, updating status: `claimed` → `running` → `ready_for_pr`
5. Create PR with `supaplan_task:<uuid>` in **BOTH** title and description (standalone line in description)

**Keyword trigger:** "ебаш" activates SupaPlan execution mode with Russian-language output and mandatory notifications.

---

## Document Generation (Deal Contracts)

For rent/sale contract generation from photos:
- Use `scripts/make-deal-contract-skill.mjs` with exact CLI flags only
- **Never invent flags** — read the script source if unsure
- Script handles Telegram delivery automatically; do NOT modify templates during generation
- Deal type auto-detection: `продажа`/`sale`/`купли-продажи` → `sale`, otherwise `rent`

**Required photos:**
- Rent: passport + driver license
- Sale: passport only (2 pages: main spread + registration)

---

## Telegram Codex Bridge

- `/codex <task>` in Telegram → Slack channel (`@codex ...`)
- Callback API: `POST /api/codex-bridge/callback` with header `x-codex-bridge-secret`
- Use `scripts/codex-notify.mjs` for notifications (callback, telegram heartbeat)

**Callback payload includes:** `status`, `summary`, `branch`, `prUrl`, `telegramChatId`, optional `slackChannelId`/`slackThreadTs`

---

## Important Environment Variables

Minimum required:
- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
- `TELEGRAM_BOT_TOKEN`, `ADMIN_CHAT_ID`
- `GITHUB_TOKEN`, `GEMINI_API_KEY`, `NEXT_PUBLIC_SITE_URL`
- Slack: `SLACK_BOT_TOKEN` + `SLACK_CODEX_CHANNEL_ID` OR `SLACK_INCOMING_WEBHOOK_URL`

Optional: `CODEX_BRIDGE_CALLBACK_SECRET`, `VERCEL_PROJECT_NAME`, `VERCEL_PREVIEW_DOMAIN_SUFFIX`

---

## Key Rules

1. **Never expose service-role secrets client-side**
2. **Prefer additive, reversible changes** — don't delete, deprecate
3. **Validate AI-generated JSON** — surface precise parse errors
4. **Use existing skills/scripts** before improvising (SupaPlan helpers, notify helpers, screenshot helpers)
5. **Screenshot fallback:** For visual verification, use `scripts/capture-screenshot.mjs` (Chromium → Firefox → WebKit → thum.io for public URLs)
6. **PR titles:** Use conventional commits (`feat:`, `fix:`, `docs:`, `refactor:`)

---

## Client Aliases

`vip-bike`, `vip bike`, `franchize`, and `FRANCHEEZEPLAN` refer to the same client/teammate stream unless explicitly stated otherwise.

---

## Reference Documentation

- `README.MD` — Full project setup and operations guide
- `docs/README_TLDR.md` — Quick reference for common operations
- `AGENTS.md` — Agent operating guide with triggers and prohibitions
- `AGENT_ENTRY.md` — Agent entrypoint with SupaPlan workflow
- `docs/CYBERTUTOR_RUNTIME_CONTRACT_V1.md` — Homework task execution contract
- `docs/AGENT_DIARY.md` — Runtime lessons and incident memory
- `CONTRIBUTING.md` — Contribution guidelines

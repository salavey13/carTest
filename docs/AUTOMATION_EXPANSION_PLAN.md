# Codex Bridge Automation Expansion Plan

## Why this exists
This plan upgrades the current Telegram `/codex` -> Slack -> PR flow from copy/paste-heavy operations to **agent-executed automation** with safe fallbacks.

## North star
- Agent can complete task end-to-end:
  1. implement change
  2. run checks
  3. commit + PR
  4. send callback notification itself (when secrets are available)
  5. attach preview + status to Slack/Telegram thread automatically

## Phase 1 — Remove manual callback bottleneck (near-term)

### Objective
Stop requiring operators to manually run callback curl in normal cases.

### Actions
1. **Runtime callback execution policy in AGENTS.md**
   - If `CODEX_BRIDGE_CALLBACK_SECRET` and target routing fields are present, agent should execute callback directly.
   - If secret/routing is missing, agent must output fallback copy/paste curl.
2. **Standard callback payload contract**
   - always include: `status`, `summary`, `branch`
   - include when known: `taskPath`, `prUrl`, `telegramChatId`, `telegramUserId`, `slackChannelId`, `slackThreadTs`
   - for `/codex` tasks, notify both chat and originator (`telegramUserId`)
3. **Result transparency**
   - final response must say whether callback was sent automatically or requires fallback manual trigger.
4. Add local notification skill script (`scripts/codex-notify.mjs`) for callback + Telegram direct mode.

## Phase 2 — Stronger operator automation (short-term)

### Objective
Increase observability and reliability of bridge task lifecycle.

### Actions
1. Add lifecycle statuses:
   - `started`, `checks_passed`, `pr_opened`, `completed`, `failed`
2. Add idempotency key support for callback API:
   - avoid duplicate Slack/Telegram posts on retries.
3. Persist callback events in Supabase table (`codex_bridge_events`) for audit/debug.

## Phase 3 — Data + deployment intelligence (mid-term)

### Objective
Use available infra (GitHub, Vercel, Supabase) for autonomous operations.

### Actions
1. **Schema introspection job**
   - secure server-side endpoint to read Supabase schema metadata.
   - generate migration-aware init/bootstrap recommendations.
2. **Preview health checks**
   - after PR creation, probe preview URL and include health result in callback summary.
3. **Operator insight digests**
   - scheduled Slack/Telegram digest of open bridge tasks, failing previews, and pending migrations.


## Branch resolution reliability (must-have)

When building callback payloads and preview URLs, resolve branch from PR metadata first (`head.ref`) because automation runners may rewrite branch names (e.g. add `codex/` prefix).

Recommended resolver order:
1. `head.ref` from created PR
2. `git rev-parse --abbrev-ref HEAD`
3. operator-provided fallback

## Phase 4 — Guardrails + safety (always-on)

1. Never expose secrets to client or logs.
2. Callback API must remain authenticated via `x-codex-bridge-secret`.
3. Privileged DB inspections stay server-only and read-only unless explicitly approved in task scope.
4. Sensitive outputs (tokens, private IDs, raw credentials) must be redacted in notifications.

## Required env checklist for full automation
- `CODEX_BRIDGE_CALLBACK_SECRET`
- `NEXT_PUBLIC_SITE_URL` or deployment base URL
- `NEXT_PUBLIC_SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` (for server-side schema introspection and migration diagnostics)
- `SLACK_BOT_TOKEN` and routing fields (`SLACK_CODEX_CHANNEL_ID` / thread metadata) OR webhook mode
- Telegram routing (`ADMIN_CHAT_ID` or task-specific `telegramChatId`) when Telegram fan-out is needed

## Success criteria
- 90%+ bridge tasks end with automatic callback send (no manual operator curl).
- preview link attached to every PR callback where branch is known.
- callback failures are visible and retriable with clear diagnostics.

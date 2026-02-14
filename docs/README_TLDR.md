# carTest — TL;DR

## 1) Запуск через fork (коротко)
1. Fork репозитория в свой GitHub.
2. Подключение к Codex.
3. Деплой fork в Vercel.
4. Применить `supabase/migrations/20240101000000_init.sql`.
5. Поставить env из `.env.example`.

## 2) Синхронизация с upstream (коротко)
### Терминал
```bash
git remote add upstream https://github.com/<UPSTREAM_OWNER>/carTest.git
git checkout main
git fetch upstream
git merge upstream/main
# или: git rebase upstream/main
git push origin main
```

### Только браузер
- GitHub → твой fork → **Sync fork** → **Update branch**.
- Конфликты решай через conflict editor или PR из upstream в свой fork.

## 3) Обязательные env
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `TELEGRAM_BOT_TOKEN`
- `ADMIN_CHAT_ID`
- `GITHUB_TOKEN`
- `GEMINI_API_KEY`
- `NEXT_PUBLIC_SITE_URL`
- `SLACK_BOT_TOKEN`
- `SLACK_CODEX_CHANNEL_ID` (for token mode)
- `SLACK_CODEX_MENTION` (optional, default `@codex`)
- `SLACK_INCOMING_WEBHOOK_URL` (optional alternative; channel id not required)
- `SLACK_CLIENT_ID` + `SLACK_CLIENT_SECRET` + `SLACK_REFRESH_TOKEN` (optional, if Slack token rotation is enabled)
- `CODEX_BRIDGE_CALLBACK_SECRET` (optional, protects callback API from unauthorized calls)
- `VERCEL_PROJECT_NAME` + `VERCEL_PREVIEW_DOMAIN_SUFFIX` (optional, preview URL generation)



## 3.1) Install note for restricted networks
- Prefer: `npm install`
- Why: project no longer depends on custom ONNX npm config keys, so `npm ci` does not emit `Unknown project config` warnings for this path.

## 4) Telegram `/codex` -> Slack
- Команда `/codex <task>` из Telegram форвардится в Slack канал.
- Нужны env: либо `SLACK_BOT_TOKEN` + `SLACK_CODEX_CHANNEL_ID`, либо `SLACK_INCOMING_WEBHOOK_URL`.
- Опционально: `SLACK_CODEX_MENTION` для замены `@codex`.


## 5) Codex callback API
- `POST /api/codex-bridge/callback` with header `x-codex-bridge-secret`.
- Sends updates to Telegram and/or Slack.
- Can return preview URL based on branch name (`/` -> `-`).


## 6) Быстрый onboarding токенов
- Telegram: см. `README.MD` → **Appendix A** (BotFather + `ADMIN_CHAT_ID` через `getUpdates`).
- Slack: см. `README.MD` → **Appendix B** (`chat:write`, `xoxb-...`, channel id `C...`).


## 7) Callback quick curl
- Endpoint: `https://v0-car-test.vercel.app/api/codex-bridge/callback`
- Header: `x-codex-bridge-secret`
- Include `branch` (+ optional `taskPath`) to get preview URL in response.
- Branch naming: use short lowercase branches (`fix/...`, `chore/...`, chars `a-z0-9/-`).
- After commit + PR, send callback immediately with `branch` + `prUrl` + reply target fields (`telegramChatId`, `slackChannelId`, `slackThreadTs`).
- For this repo previews, use: `https://v0-car-test-git-<branch-slug>-salavey13s-projects.vercel.app/<taskPath>`.
- Suffix format: prefer `-team.vercel.app` (dot-prefixed `.team.vercel.app` is also supported).


## 8) Automation expansion roadmap
- See `docs/AUTOMATION_EXPANSION_PLAN.md` for the full phased plan: auto callback execution, lifecycle statuses, preview health checks, and schema-level operator intelligence.

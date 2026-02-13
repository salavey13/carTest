# carTest

`carTest` — Telegram-first продуктовая студия на **Next.js + Supabase**.

Цель простая: быстро собрать идею, дать ИИ контекст, получить правки в код и довести это до PR.

---

## Ключевые маршруты
- `/` — вход и навигация по платформе.
- `/nexus` — хаб по инфраструктуре и инструментам.
- `/repo-xml` — рабочая зона: контекст репозитория, AI-правки, PR-флоу.

Логика продукта: **вход → рамка платформы → выполнение**.

---

## Что нужно, чтобы запустить свой fork

### 1) Fork и деплой
1. Сделай **Fork** репозитория в свой GitHub.
2. Подключи fork к своему Codex-потоку (ChatGPT Codex / local Codex).
3. Импортируй fork в **Vercel**.
4. Подключи Supabase.

### 2) База данных
Минимум для старта:
- `supabase/migrations/20240101000000_init.sql`

Дальше — накатывай остальные миграции по модулям, которые реально используешь.

### 3) Переменные окружения (минимум)
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `TELEGRAM_BOT_TOKEN`
- `ADMIN_CHAT_ID`
- `GITHUB_TOKEN`
- `GEMINI_API_KEY`
- `NEXT_PUBLIC_SITE_URL`
- `SLACK_BOT_TOKEN` *(для `/codex` -> Slack)*
- `SLACK_CODEX_CHANNEL_ID` *(ID канала, куда слать Codex-задачи; нужно для `chat.postMessage` mode)*
- `SLACK_CODEX_MENTION` *(опционально, по умолчанию `@codex`)*
- `SLACK_INCOMING_WEBHOOK_URL` *(опционально, альтернатива token+channel; канал берётся из webhook)*
- `SLACK_CLIENT_ID` *(опционально, если используешь OAuth token rotation)*
- `SLACK_CLIENT_SECRET` *(опционально, если используешь OAuth token rotation)*
- `SLACK_REFRESH_TOKEN` *(опционально, если используешь OAuth token rotation)*
- `CODEX_BRIDGE_CALLBACK_SECRET` *(опционально, для защищенного callback API)*
- `VERCEL_PROJECT_NAME` *(опционально, по умолчанию `v0-car-test`)*
- `VERCEL_PREVIEW_DOMAIN_SUFFIX` *(опционально, для автогенерации preview ссылок)*

> Реальные секреты в Git не коммитим.

---

## Локальный запуск (опционально)
```bash
git clone https://github.com/<YOUR_USERNAME>/carTest.git
cd carTest
cp .env.example .env.local
npm install
npm run dev
```

---

## Как держать fork в актуальном состоянии

### Вариант A: через терминал
```bash
git remote add upstream https://github.com/<UPSTREAM_OWNER>/carTest.git
git checkout main
git fetch upstream
git merge upstream/main
# или: git rebase upstream/main
git push origin main
```

### Вариант B: только браузер (без локального Git)
1. Открой свой fork на GitHub.
2. Нажми **Sync fork** → **Update branch** для `main`.
3. Если возникли конфликты — реши их через GitHub conflict editor
   или открой PR из upstream в свой fork.

---

## Как контрибьютить без боли
1. Делай изменения в своей ветке в форке.
2. Открывай PR.
3. После мержа в upstream остальные форки подтягивают апдейты тем же способом.

Коротко: **fork it → ship it → sync it**.

---

## Технологии
- Next.js (App Router), React, TypeScript
- Tailwind + shadcn/ui
- Supabase (Postgres, Auth, Storage)
- Telegram Bot / WebApp
- GitHub API (автоматизация branch/PR)

---

## Полезные документы
- Короткая версия: `docs/README_TLDR.md`
- Правила для агентных правок: `AGENTS.md`
- Контрибьют: `CONTRIBUTING.md`


---

## Telegram → Slack (`/codex`) bridge

Добавлен бесплатный мост вместо внешних форвардеров: команда в Telegram уходит в Slack как запрос к Codex.

Пример:
```
/codex add /codex command that posts to slack
```

Что происходит:
1. Пользователь пишет `/codex ...` в Telegram-бота.
2. В `app/api/telegramWebhook` это проходит через общий `command-handler`.
3. Новый handler отправляет сообщение в Slack через `chat.postMessage` в канал `SLACK_CODEX_CHANNEL_ID`.
4. Текст трансформируется в формат `@codex ...` (или другой mention через `SLACK_CODEX_MENTION`).

Важно для тебя (что нужно настроить в Vercel secrets):

Вариант A — `chat.postMessage` mode:
- `SLACK_BOT_TOKEN` (Bot User OAuth Token, обычно `xoxb-...`)
- `SLACK_CODEX_CHANNEL_ID` (например `C08...`, не имя `#general`)
- опционально `SLACK_CODEX_MENTION` (если нужен не `@codex`)

Вариант B — Incoming Webhook mode (без channel id):
- `SLACK_INCOMING_WEBHOOK_URL`
- опционально `SLACK_CODEX_MENTION`

Чтобы token mode работал, Slack app должен иметь минимум scope `chat:write` и быть добавлен в целевой канал.

Рекомендация по хранению токенов:
- Если `xoxb` долгоживущий в твоей конфигурации — храни `SLACK_BOT_TOKEN` в Vercel env.
- Если у тебя rotation и токен часто истекает — храни `SLACK_CLIENT_ID`/`SLACK_CLIENT_SECRET`/`SLACK_REFRESH_TOKEN`, а access token получай динамически (уже реализовано серверно).
- Если хочешь самый простой fixed-channel вариант — используй `SLACK_INCOMING_WEBHOOK_URL` и не задавай `SLACK_CODEX_CHANNEL_ID`.


## Codex callback API (Telegram/Slack replies + preview link)

Добавлен server-side endpoint: `POST /api/codex-bridge/callback`

Для чего: после выполнения задачи можно отправить результат обратно в Telegram и/или в Slack, плюс автоматически собрать preview URL по branch name.

Авторизация:
- header `x-codex-bridge-secret: <CODEX_BRIDGE_CALLBACK_SECRET>`


Зачем нужен `CODEX_BRIDGE_CALLBACK_SECRET`:
- это shared secret для защиты `POST /api/codex-bridge/callback` от чужих запросов
- endpoint принимает callback только если header `x-codex-bridge-secret` совпадает с env
- без этого любой, кто знает URL, мог бы спамить сообщения в Telegram/Slack от имени системы

Пример payload:
```json
{
  "status": "done",
  "summary": "Implemented /codex flow",
  "branch": "feat-ai-1770909184796",
  "taskPath": "/wblanding",
  "prUrl": "https://github.com/.../pull/123",
  "telegramChatId": "123456789",
  "slackChannelId": "C0123456789",
  "slackThreadTs": "1730000000.12345"
}
```

Preview link строится как:
`https://<VERCEL_PROJECT_NAME>-git-<branch-with-slashes-replaced><VERCEL_PREVIEW_DOMAIN_SUFFIX>/<taskPath>`

Пример: `feat/ai-177` -> `feat-ai-177`.

Suffix может быть в формате `-team.vercel.app` (рекомендуемо) или `.team.vercel.app`; код поддерживает оба варианта.

### Operator copy-paste callback template
After Codex task completion, send callback to:
- `https://v0-car-test.vercel.app/api/codex-bridge/callback`

```bash
curl -X POST "https://v0-car-test.vercel.app/api/codex-bridge/callback" \
  -H "Content-Type: application/json" \
  -H "x-codex-bridge-secret: $CODEX_BRIDGE_CALLBACK_SECRET" \
  -d '{
    "status": "done",
    "summary": "Implemented requested change",
    "branch": "feat/ai-1770909184796",
    "taskPath": "/wblanding",
    "prUrl": "https://github.com/<owner>/<repo>/pull/<id>",
    "telegramChatId": "<chat_id>",
    "slackChannelId": "<channel_id>",
    "slackThreadTs": "<thread_ts_optional>"
  }'
```



---

## Appendix A — Как получить `TELEGRAM_BOT_TOKEN` и `ADMIN_CHAT_ID` (первый раз)

### A1) Создать бота через BotFather
1. В Telegram открой `@BotFather`.
2. Отправь `/newbot`.
3. Задай имя бота (любое, например `oneSitePls Helper`).
4. Задай username бота (должен заканчиваться на `bot`, например `oneSitePlsBot`).
5. BotFather вернет токен вида `123456789:AA...` — это и есть `TELEGRAM_BOT_TOKEN`.

### A2) Включить WebApp-кнопку (опционально, но полезно)
1. В `@BotFather` отправь `/setmenubutton`.
2. Выбери своего бота.
3. Выбери `Configure menu button`.
4. Укажи URL вашего приложения (например Vercel production URL).

### A3) Узнать `ADMIN_CHAT_ID`
Самый простой путь:
1. Напиши любое сообщение своему боту.
2. Открой в браузере:
   `https://api.telegram.org/bot<TELEGRAM_BOT_TOKEN>/getUpdates`
3. Найди поле `message.chat.id` (или `from.id`) — это твой `ADMIN_CHAT_ID`.

> Для групп/каналов chat id может быть отрицательным (например `-100...`).

---

## Appendix B — Как получить Slack токены для `/codex` bridge

### B1) Создать Slack App
1. Открой [api.slack.com/apps](https://api.slack.com/apps).
2. Нажми **Create New App** → **From scratch**.
3. Укажи имя (например `carTest Codex Bridge`) и workspace (`oneSitePls.slack.com`).

### B2) Выдать права (OAuth Scopes)
1. В приложении открой **OAuth & Permissions**.
2. В **Bot Token Scopes** добавь минимум:
   - `chat:write`
3. Нажми **Install to Workspace** (или **Reinstall** после изменения scopes).

### B3) Получить `SLACK_BOT_TOKEN`
1. В **OAuth & Permissions** скопируй **Bot User OAuth Token** (`xoxb-...`).
2. Сохрани как `SLACK_BOT_TOKEN` в Vercel env.

### B3b) Если включена token rotation (short-lived access token)
Если в Slack включен rotation и access token короткоживущий, в env лучше хранить не сам access token, а связку:
- `SLACK_CLIENT_ID`
- `SLACK_CLIENT_SECRET`
- `SLACK_REFRESH_TOKEN`

В этом проекте мост умеет автоматически получать свежий access token через `oauth.v2.access` (grant type: `refresh_token`).
Тогда `SLACK_BOT_TOKEN` можно не задавать.

### B4b) Incoming webhook без channel id
Если используешь incoming webhook URL, `SLACK_CODEX_CHANNEL_ID` не нужен: канал уже "зашит" в webhook.

### B4) Получить `SLACK_CODEX_CHANNEL_ID`
Вариант через Slack UI:
1. Открой нужный канал (например `#general`).
2. Кликни по названию канала → **View channel details**.
3. Найди/скопируй Channel ID (формат обычно `C...`).

Вариант через URL канала:
- часто ID виден в URL вида `.../client/T.../C...`.

### B5) Добавить бота в канал
В канале Slack выполни:
- `/invite @<имя_твоего_slack_app_бота>`

Без этого `chat.postMessage` может возвращать `not_in_channel`.

### B6) Проверка (минимальная)
После деплоя отправь в Telegram:
```
/codex test slack bridge
```
Ожидаемо: сообщение появится в Slack в формате `@codex ...`.

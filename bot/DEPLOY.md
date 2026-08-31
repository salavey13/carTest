# DEPLOY: Telegram-бот VIP BIKE на новый инстанс

Снапшот боевого бота с VPS (живёт в `/opt/claudeclaw/vip-bike`, systemd `claudeclaw-vip-bike.service`).
Репо сайта и бот живут рядом: `/opt/claudeclaw/vip-bike/rental-repo` — клон этого репо.
Дата снапшота: 2026-08-31.

## Что внутри

| Путь | Что это |
|---|---|
| `src/` | движок бота (grammy + claude-agent-sdk): Telegram, сессии, voice, scheduler, память |
| `workspace/` | «мозг»: CLAUDE.md, skills/, reference/, active-context.md |
| `modules/` | contract (договоры: OCR → .docx → SQLite), certificate, digest, lead-watcher, avito |
| `boss-commands/` | cron-скрипты дайджестов (утро/вечер/просрочки/выручка) |
| `bundled-skills/` | штатные навыки (docx, xlsx, pptx, pdf, audio-transcribe, ...) |
| `scripts/` | VPS-утилиты: bootstrap, notify, экспорт CSV каталога/аренд |
| `tenants/vip-bike/tenant.yaml` | паспорт инстанса (пути, сервис, что нужно от владельца) |
| `.claude/` | settings.json + boss-crons.md (док по cron) |
| `.env.example` | шаблон секретов (реальный `.env` в git НЕ попадает) |

Не включено (сознательно): `.env`, `.boss-secrets.txt`, `node_modules/`, `dist/`, `logs/`,
`backups/`, `store/` (SQLite памяти), `workspace/store/` (зашифрованная БД договоров + ПДн),
`workspace/uploads/` (фото документов клиентов), `data/` (генерируемые CSV).

## Требования

- Ubuntu 24.04, Node >= 20, npm
- `jq`, `curl`, `python3` (для скриптов экспорта CSV)
- build-инструменты для нативных модулей (`build-essential`, `python3` — sharp, better-sqlite3)

## Шаги развёртывания

### 1. Разложить файлы

Рекомендую тот же путь, что на боевом (много абсолютных путей в cron и скриптах):

```bash
sudo mkdir -p /opt/claudeclaw
sudo useradd -m claudeclaw   # если нет
git clone <этот-репо> /opt/claudeclaw/vip-bike/rental-repo
rsync -a /opt/claudeclaw/vip-bike/rental-repo/bot/ /opt/claudeclaw/vip-bike/
cd /opt/claudeclaw/vip-bike
mkdir -p logs workspace/uploads workspace/store data
```

Если кладёшь в другой путь — прогони замену по cron и скриптам:
`grep -rl '/opt/claudeclaw/vip-bike' . | xargs sed -i 's|/opt/claudeclaw/vip-bike|<новый путь>|g'`

### 2. Зависимости и сборка

```bash
npm ci            # или npm install
npm run build     # tsc -> dist/
```

Проверка сборки: `npm run typecheck`.

### 3. Секреты (вручную, chmod 600)

**`.env`** — взять с боевого инстанса или заполнить по `.env.example`.
Полный список боевых переменных (имена):

```
TELEGRAM_BOT_TOKEN, ALLOWED_CHAT_ID
ANTHROPIC_AUTH_TOKEN, ANTHROPIC_BASE_URL, ANTHROPIC_MODEL
OCR_MODE, GENAPI_API_KEY, GENAPI_MODEL
GROQ_VISION_MODEL, GROQ_STT_MODEL, Z_AI_API_KEY(резерв)
CONTRACTS_DB_PATH, CONTRACTS_DB_KEY, CONTRACTS_UPLOADS_DIR
DIGEST_SEEN_PATH, RECOGNIZE_MOCK(пусто в проде)
DEEPGRAM_API_KEY, DEEPGRAM_MODEL, DEEPGRAM_LANGUAGE
SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, CONTRACT_EMAIL_TO
KIE_API_KEY
SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_CREW_SLUG
NEXT_PUBLIC_SUPABASE_URL, CREW_SLUG, CREW_ID
GH_TOKEN, GH_USER          # для git-push CSV скриптами
NODE_OPTIONS
```

Не-секретные значения боевого инстанса:
`ANTHROPIC_BASE_URL=https://api.z.ai/api/anthropic`, `ANTHROPIC_MODEL=glm-5.2`,
`OCR_MODE=genapi`, `GENAPI_MODEL=gemini-2.5-flash`,
`NODE_OPTIONS=--dns-result-order=ipv4first`,
`SUPABASE_URL=https://inmctohsodgdohamhzag.supabase.co`, `CREW_SLUG=vip-bike`,
`CREW_ID=2d5fde70-1dd3-4f0d-8d72-66ccf6908746`.

**`.boss-secrets.txt`** — формат (парсится `boss-commands/_lib.sh`):

```
secrets:
NEXT_PUBLIC_SUPABASE_URL=https://<project>.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ...
ADMIN_CHAT_ID=413553377,356282674,...
<строка 3: голый TELEGRAM_BOT_TOKEN без ключа=>
GITHUB_TOKEN=ghp_...
```

### 4. systemd

`/etc/systemd/system/claudeclaw-vip-bike.service`:

```ini
[Unit]
Description=claudeclaw bot instance vip-bike
After=network.target
StartLimitIntervalSec=60
StartLimitBurst=3

[Service]
Type=simple
User=claudeclaw
WorkingDirectory=/opt/claudeclaw/vip-bike
ExecStart=/usr/bin/node dist/index.js
EnvironmentFile=/opt/claudeclaw/vip-bike/.env
Restart=on-failure
RestartSec=5
StandardOutput=journal
StandardError=journal
SyslogIdentifier=claudeclaw-vip-bike

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now claudeclaw-vip-bike
journalctl -u claudeclaw-vip-bike -f   # смотреть лог
```

### 5. cron (boss-команды, всё в UTC; МСК = UTC+3)

`crontab -e` от пользователя `claudeclaw`:

```cron
SHELL=/bin/bash
HOME=/home/claudeclaw
SECRETS_FILE=/opt/claudeclaw/vip-bike/.boss-secrets.txt
LOG=/opt/claudeclaw/vip-bike/logs/boss-commands.log

# 09:07 МСК daily — утренний стендап
7 6 * * * /opt/claudeclaw/vip-bike/boss-commands/morning-standup.sh >> $LOG 2>&1
# 22:30 МСК daily — вечерний дайджест
30 19 * * * /opt/claudeclaw/vip-bike/boss-commands/evening-summary.sh >> $LOG 2>&1
# понедельник 21:13 МСК — недельная выручка
13 18 * * 0 /opt/claudeclaw/vip-bike/boss-commands/weekly-revenue.sh >> $LOG 2>&1
# ежечасно 09-21 МСК — напоминание о возвратах
7 6-18 * * * /opt/claudeclaw/vip-bike/boss-commands/returns-reminder.sh >> $LOG 2>&1
# каждые 2ч 09-21 МСК — алерт по просроченным арендам
7 5,7,9,11,13,15,17,19 * * * /opt/claudeclaw/vip-bike/boss-commands/overdue-alert.sh >> $LOG 2>&1
# 00:07 МСК daily — синк CSV каталога (Supabase -> репо -> git push)
7 21 * * * /opt/claudeclaw/vip-bike/scripts/update_catalog_csvs.sh >> /opt/claudeclaw/vip-bike/logs/catalog-csv.log 2>&1
0 * * * * /opt/claudeclaw/vip-bike/scripts/update_rentals_csvs.sh >> /opt/claudeclaw/vip-bike/logs/rentals-csv.log 2>&1
```

CSV-скрипты пушат в git: нужен `.env.local` рядом (в `rental-repo/`) с
`SUPABASE_SERVICE_ROLE_KEY` + `GITHUB_TOKEN` (на боевом уже настроено, в .gitignore).

### 6. Проверка

- `systemctl status claudeclaw-vip-bike` — active (running)
- Написать боту в Telegram в разрешённый чат (`ALLOWED_CHAT_ID`) — должен ответить
- `sudo -u claudeclaw /opt/claudeclaw/vip-bike/boss-commands/evening-summary.sh` — тест дайджеста

## Обновление снапшота с боевого

```bash
cd /opt/claudeclaw/vip-bike
rsync -a --delete \
  --exclude='.env*' --exclude='.boss-secrets.txt' --exclude='node_modules' --exclude='dist' \
  --exclude='logs' --exclude='backups' --exclude='store' --exclude='data' \
  --exclude='rental-repo' --exclude='workspace/uploads' --exclude='workspace/store' \
  --exclude='*.bak*' --exclude='*.backup*' --exclude='skills.backup-*' --exclude='__pycache__' \
  ./ rental-repo/bot/
cd rental-repo && git add bot/ && git commit -m "chore(bot): sync snapshot from live VPS" && git push
```

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

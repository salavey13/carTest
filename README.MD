# 🏍️ VIP Bike — Telegram Mini App для аренды мото (франшиза)

**VIP Bike** — это Telegram-first платформа аренды мотоциклов: мини-приложение
(`@oneBikePlsBot`), CRM для экипажа (crews), полный пайплайн аренд с документами,
аналитика с разделением денег партнёр/компания, и «Мотопарк» — стена историй
каждого мото как в VK. Плюс Telegram-бот, который закрывает операционку:
смены, документы, отчёты, `/testdrive`, `/salary` и другое.

> Репо выросло из песочницы экспериментов — весь легаси (VPR-тесты, sauna,
> strikeball, arbitrage и т.п.) остался в коде как «debug oldschool mode»,
> но вынесен из критического пути миграций. Продукт — франшиза VIP Bike.

---

## Что внутри (продуктовая поверхность)

| Модуль | Где | Что делает |
|---|---|---|
| Лендинг + каталог | `/` | Витрина байков, конфигуратор, заявки |
| Франшиза (экипаж) | `/franchize/{slug}` | Кабинет crews: аренды, лиды, деньги, документы |
| Аренды | `/franchize/{slug}/rentals` | Пайплайн: заявка → подтверждение → активная → закрытие (фото ДО/ПОСЛЕ, одометр, депозит, экип) |
| Аналитика | `/franchize/{slug}/rentals-analytics` | KPI, разделение партнёр/компания, парольной вход с TTL |
| **Мотопарк** | `/franchize/{slug}/bikes` | Стена историй мото: фото аренд, деньги, сервис, одометр |
| Зарплаты | `/franchize/{slug}/salary` | Планы, комиссии, расчёты |
| Telegram-бот | `app/webhook-handlers` | Смены, документы (docx), отчёты, команды |
| Документы | `app/franchize/*doc*` | DOCX-генерация: аренда/продажа/тестдрайв/субаренда/КП |

**Дисциплина денег:** один движок расчёта (`computePartnerSplit` +
`computeBikeStats`), отменённые аренды никогда не считаются в доход (iter27),
весь геймификационный слой поверх — только отображение (PRD BikeSoul, iter29).

---

## Клон → деплой → ребрендинг

### 1) Fork и деплой
1. **Fork** репозитория.
2. Импортируй fork в **Vercel** (framework Next.js, `npm run build`).
3. Создай проект в **Supabase** (free tier хватает для старта).
4. Создай бота в **@BotFather**, включи Mini App (Menu Button → Web App),
   поставь webhook на `https://<твой-domain>/api/telegramWebhook`.

### 2) База данных
```bash
supabase link --project-ref <ref>
supabase db push          # применит ~160 чистых миграций из supabase/migrations/
```
Применяется всё: users, crews/members, cars (bike/equipment/service), rentals
+ rental_photos, franchize_intents, leads, salary, cash, deposits, артефакты
документов, RPC для бота. Легаси-эксперименты вынесены в
`supabase/legacy-migrations/` (см. README там — включая ⚠️ токен на ротацию).

Минимум для старта, если хочешь шаг за шагом:
- `20240101000000_init.sql` (base, включая исправленный Paul:-баг)
- `20260304_private_scheme.sql` + `20260508090000_repair_private_crew_secrets.sql` (приватные секреты для документов)
- далее по порядку — полный список в `supabase/migrations/README.md`.

### 3) Переменные окружения

**Обязательные:**
- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
- `TELEGRAM_BOT_TOKEN`, `ADMIN_CHAT_ID`
- `NEXT_PUBLIC_SITE_URL`

**Опциональные:** `GITHUB_TOKEN`, `GEMINI_API_KEY`, `ZAI_*` (AI-функции),
`SLACK_*` (мост `/codex` → Slack), `RENTAL_DOC_TEMPLATE_MODE=html`,
`VERCEL_PROJECT_NAME`, `VERCEL_PREVIEW_DOMAIN_SUFFIX` — полный список в
`.env.example`.

> Секреты в Git не коммитим. Никогда. Даже в SQL-миграциях (см. историю — и урок в `supabase/legacy-migrations/README.md`).

### 4) Ребрендинг
- Название/палитра crews: `docs/sql/update-vip-bike-*-palette.sql` как образец; метаданные crews (`metadata.franchize.*`) правятся SQL-хидрацией (`docs/sql/*-hydration.sql`).
- Шаблоны документов: `docs/*_DEAL_TEMPLATE.html` + генератор в `app/franchize/`.
- Бот: имя/аватар в BotFather, команды — в `app/webhook-handlers/commands/`.

### 5) Локальный запуск
```bash
cp .env.example .env.local   # заполни секреты
npm install && npm run dev
```

---

## Разработка и гейты

```bash
npx vitest run tests/franchize/   # тесты франшизы (~930, есть live-спеки — нужны креды)
npm run typecheck:franchize       # строгий TS-слайс продукта
npm run lint:target               # eslint по app/franchize
npm run gen:db-types              # перегенерация types/database.types.ts из живой БД
```

Правила для агентов и контрибьюторов: `AGENTS.md`, `CLAUDE.md`, `CONTRIBUTING.md`.
Опыт итераций: `docs/AGENT_DIARY.md`, корневой `worklog.md`.

## Карта документации

- Продуктовые PRD: `docs/PRD_*.md` (зарплаты, аналитика, лиды, фото аренд, …)
- **BikeSoul** — геймификация «байки как питомцы»: `docs/PRD_BIKE_SOUL_GAMIFICATION.md`
- Плейсхолдеры и планы: `docs/superpowers/plans/`
- Легаси-архив (vibe-эпоха): `docs/legacy/`

## Sync форка

```bash
git remote add upstream https://github.com/salavey13/cartest.git
git fetch upstream && git rebase upstream/main && git push origin main
```
Или кнопкой **Sync fork** на GitHub.

## Лицензия

Apache License 2.0 (`LICENSE.md`). Vibe-лицензия эпохи песочницы — в `docs/legacy/`.

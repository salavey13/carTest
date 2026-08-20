# 🆚 Twenty CRM vs Franchize CRM (rental-repo): Детальное сравнение

> **Версия:** 2.0 · **Обновлено:** 19 августа 2026
>
> Полный технический разбор: архитектура, мульти-тенантность, модель данных, лиды и воронки,
> автоматизация, документы, аналитика, права доступа, API, стоимость владения
> и конкретный план заимствования фич Twenty в Franchize.

---

## 📌 TL;DR — главное одной страницей

| Критерий | **Twenty CRM** | **Franchize CRM (rental-repo)** |
|---|---|---|
| Что это | Универсальный open-source конструктор CRM (альтернатива Salesforce/HubSpot) | Специализированная операционная система проката/продаж электро-байков для сети франшиз |
| Кому подходит | Любому бизнесу, которому нужна настраиваемая CRM без кода | Команде VIP BIKE и партнёрам-франчайзи с конкретной вертикалью: аренда, продажа, договоры |
| Модель рынка | Продукт (50k+ звёзд на GitHub, компания + венчурные деньги) | Внутренний продукт (код в vip-bike.ru, стек Next.js + Supabase) |
| Мульти-тенантность | Workspace (рабочие пространства) | Crew (экипажи) со slug-маршрутами `/franchize/[slug]/*` |
| Сильнейшая сторона | Гибкая модель данных, воркфлоу-билдер, API, экосистема приложений | Боевая вертикаль: договоры DOCX, OCR паспорта/ВУ, QR-claim, Telegram-бот, касса, физическая выдача/возврат |
| Документы | Генерация PDF/документов кодом в воркфлоу (нужно строить) | Из коробки: шаблоны RENTAL/SALE/SUBRENTAL, распознавание документов, 152-ФЗ |
| Канал клиента | Email + календарь (Google/Microsoft 365) | Telegram (WebApp + бот) — здесь же лиды, уведомления, платежи |
| Лицензия/цена | Self-host бесплатно (AGPL-3.0); платный Cloud; premium-фичи на Organization-плане | Собственный код, сервер фабрики; для франчайзи — доступ по подписке/партнёрству |
| Вывод | **Взять как источник архитектурных идей** (custom fields, webhooks, workflow, views) | **Не менять на Twenty**: вертикальные фичи (договоры, QR, бот, касса) в Twenty не существуют и строятся месяцам |

**Главный вывод:** это не конкурентная борьба, а «конструктор против готовой вертикали». Twenty учит нас,
как сделать Franchize CRM более гибкой и открытой для интеграций; Franchize учит Twenty-мир, как выглядит
настоящая CRM для операционного бизнеса с физическими активами и юридическими документами.

---

## 1️⃣ Обзор систем

### 1.1 Twenty CRM

**Twenty** — открытая CRM-платформа («open alternative to Salesforce»), развиваемая компанией Twenty
(репозиторий `twentyhq/twenty`, ~55 тыс. звёзд на GitHub — один из самых популярных open-source CRM).

- **Форма поставки:** облако (SaaS, twenty.com) или self-hosted (Docker Compose, одна команда).
- **Философия:** «дай строительные блоки CRM — объекты, views, воркфлоу, агентов — и расширяй их кодом».
- **Стандартные объекты:** Companies, People, Opportunities, Tasks, Notes.
- **Ключевые блоки (по доке Key Features):**
  - Кастомная модель данных (объекты + 20+ типов полей + связи, включая многие-ко-многим);
  - Views: таблицы, канбан, календарь, фильтры AND/OR, группировки, сохранённые вью;
  - Workflows: визуальный билдер автоматизаций (триггеры, ветки, итераторы, code actions);
  - Calendar & Email sync (Google Workspace / Microsoft 365);
  - AI: чат с данными CRM + AI-агенты в рамках permission model;
  - Dashboards: виджеты и графики в реальном времени;
  - Permissions: ролевой доступ на уровне объектов, полей и записей; SSO (SAML/OIDC), аудит-логи;
  - API: GraphQL + REST, автогенерируемые под workspace; webhooks; OAuth (PKCE и client credentials);
  - Apps-платформа: кастомные объекты, server-side TypeScript функции (HTTP/cron/DB-event триггеры),
    frontend-компоненты в песочнице, marketplace приложений;
  - Импорт/экспорт данных (CSV с маппингом полей, дедупликацией и обработкой ошибок в UI).
- **Лицензия:** AGPL-3.0 (community/self-hosted бесплатно; Organization-план с premium-фичами
  — SSO, row-level permissions, audit logs, AI Usage, убрано требование публиковать свой код).

### 1.2 Franchize CRM (rental-repo)

**Franchize CRM** — внутренняя вертикальная CRM сети VIP BIKE ELECTRO (vip-bike.ru), реализованная как
плагин-модуль `app/franchize/*` в Next.js-репозитории rental-repo. Обслуживает **сеть франшиз проката**:
каждый «экипаж» (crew) — независимый тенант со своим каталогом, ценами, командой, лидами и аналитикой.

- **Стек:** Next.js App Router (React/TS) + Supabase (Postgres + RLS + Realtime) + Telegram (WebApp и Bot API).
- **Мульти-тенантность:** тенант = экипаж; маршруты `/franchize/[slug]/*`; создание экипажа — в `/franchize/create`.
- **Полный жизненный цикл клиента в одном контуре:**
  - каталог + корзина + чекаут (промокоды, инвойсы через Telegram XTR);
  - лид-лоджмент (franchize_intents) → доска лидов с воронкой из 9 стадий → звонок/TG → договор;
  - договоры DOCX (шаблоны RENTAL/SALE/SUBRENTAL), OCR паспорта и водительского, QR-claim,
    чек-листы выдачи/возврата, одометры, депозиты;
  - телеграм-бот: `/doc` (генерация договора по фото документов), `/leads`, `/shift`, `/sos`, `/analytics-pass` и др.;
  - аналитика: дашборды аренды/продаж/ком. предложений, зарплаты, комиссии, касса, лидерборд, депозиты.
- **Данные:** таблицы `crews`, `crew_members`, `crew_member_shifts`, `cars`, `rentals`, `users`,
  `franchize_intents`, `crew_todos`, `lead_todos`, `lead_notes`, `rental_handoffs`, `deposit_entries`,
  `commission_rates`, `salary_plans`, `message_templates`, `analytics_passwords`, `live_locations`,
  `equipment` + приватная схема документов (`rental_contract_artifacts`, `user_rental_secrets`, `crew_secrets`...).

---

## 2️⃣ Архитектура и стек

### 2.1 Сравнительная таблица

| Слой | **Twenty** | **Franchize** |
|---|---|---|
| Язык | TypeScript повсюду (монорепозиторий) | TypeScript повсюду (Next.js) |
| Backend | NestJS + BullMQ (воркеры) | Next.js Server Actions (`app/franchize/server-actions/*`), API routes |
| Frontend | React + GraphQL-клиент | React (RSC/Client components), SWR-подобные хуки, Supabase Realtime |
| БД | PostgreSQL (+ Redis для очередей/состояний) | Supabase Postgres (+ RLS, Realtime, Storage) |
| GraphQL | Да, собственный API-first слой | Нет — типизированные Server Actions вместо GraphQL |
| REST | Да | Да (`/api/*`: docphotoocr, orders, rentals, webhooks, telegramWebhook) |
| Очереди/фоновые задачи | BullMQ (Redis) worker-контейнеры | Vercel-функции, cron, Realtime-дозор лидов |
| Аутентификация | Email/password, Google, Microsoft; SSO (SAML/OIDC) на Org-плане | Telegram WebApp (signed cookie HMAC-SHA256), JWT chat_id, password-гейт аналитики |
| Деплой | Docker Compose / Kubernetes (self-host) или Cloud | Vercel + Supabase, `git push` → автодеплой |
| Лицензия | AGPL-3.0 (self-host) / платный Cloud | Проприетарный код фабрики |

### 2.2 Ключевая архитектурная разница: «платформа» vs «вертикаль»

- **Twenty** — это **платформа**: данные и бизнес-процессы описываются в рантайме (metadata-driven).
  Новая сущность = новый объект + поля + views + permissions, без переписывания кода.
  Именно поэтому она так хороша для кастомизации: «custom objects are first-class citizens».
- **Franchize** — это **вертикаль «под ключ»**: каждая операция (аренда, договор, QR, возврат, зарплата)
  реализована явным кодом и проверена на бою. Быстрое изменение модели данных требует миграции,
  зато система точно знает предметную область и не заставляет «собирать CRM из кубиков».

> 💡 **Инсайт для нас:** сегодня Franchize тяготеет к «коду», а Twenty — к «конфигу». Идеальная траектория —
> добавить в Franchize слой декларативной конфигурации (custom fields, настраиваемые стадии воронки,
> визуальные воркфлоу) поверх уже готовой вертикальной логики. Подробнее — в разделе «План заимствования».

---

## 3️⃣ Мульти-тенантность

### 3.1 Twenty: Workspace

- Каждый workspace — изолированный тенант: свои объекты (в т.ч. кастомные), поля, view, пользователи, брендинг.
- В Cloud-версии на бесплатном/Pro-плане число тenant практиччески не ограничено, но в self-host на
  Organization-плане есть фича «Unlimited workspaces» — для больших групп компаний.
- Дополнительно: членство через инвайты, домен workspace, SSO на уровне workspace.

### 3.2 Franchize: Crew (экипаж)

- Тенант = **crew**: `crews.id/name/slug`, `owner_id`, описание, лого, локация.
- Изоляция: RLS-политики (`public.crews`, `crew_members`, `crew_member_shifts`, `cars.crew_id` и т.д.);
  каждая таблица аренды/лидов привязана к `slug`/`crew_id`.
- Публичный маршрут: `/franchize/[slug]/*` — экипаж получает свой «магазин» + админку + аналитику.
- Реальность сети: **настоящий франчайзинг** — каждый экипаж продаёт/сдаёт свой парк, видит только свои
  лиды и деньги; владелец сети (admin/vpradmin) видит всё.
- Дополнительно есть row-level контроль в RLS на уровне «кто владелец экипажа» (проверка
  `(SELECT owner_id FROM crews WHERE id = crew_id) = auth.jwt() ->> 'chat_id'`) и membership_status='active'.

### 3.3 Сравнение

| Аспект | Twenty | Franchize |
|---|---|---|
| Модель тенанта | Workspace (объекты/поля/юзеры) | Crew (slug, парк, команда, лиды, деньги) |
| Настройка тенанта | В рантайме, сильно кастомизируемо | Через `/franchize/[slug]/admin/*` (цены, конфиг, палитра тем) |
| Изоляция | Встроенная (multi-tenant из коробки) | RLS + серверные проверки доступа |
| Масштаб сети | Нет «соревновательности» между workspace | Есть лидерборд (rpc_leaderboard) — геймификация сети |
| Администрирование сети | Нет такого понятия | `admin` / `vpradmin` — глобальные роли |

---

## 4️⃣ Модель данных

### 4.1 Twenty: объекты и поля

- Системные поля каждого объекта: `id`, `createdAt`, `updatedAt`, `createdBy`, `position`.
- Типы полей:
  - **Базовые:** Text, Number, Boolean, Date, Currency, Rating, Select;
  - **Композитные:** Address (улица/город/область/индекс), Full Name, Links, Phones, Emails;
  - **Специальные:** Relation, File Attachment, JSON, Actor (кто создал/изменил).
- Связи: one-to-many, many-to-many (junction objects), двунаправленные.
- Кастомные объекты получают те же права, что и стандартные: API-эндпоинты, views, permissions, триггеры воркфлоу.

### 4.2 Franchize: боевая схема

Ядро (public schema):

| Таблица | Назначение |
|---|---|
| `users` | Пользователи; `user_id`, `metadata.role` (admin/vpradmin/...), чат_id |
| `crews` | Экипажи-тенанты: имя, slug, владелец, локация, лого |
| `crew_members` | Участники: role (member/admin...), membership_status, hourly_rate (руб/час) |
| `crew_member_shifts` | Смены: clock_in/clock_out, duration (вычисляемый) |
| `cars` | Парк: модель, crew_id, статус, спецификации |
| `rentals` | Аренды: статус, payment_status, даты, cost, metadata(checklist, verifier id) |
| `franchize_intents` | Лид-лоджмент: intent_type, stage, urgency_score 0–100, phone, telegram_user_id, source_route, contact_channel, metadata jsonb |
| `crew_todos` / `lead_todos` / `lead_notes` | Задачи и заметки по экипажу/лиду |
| `rental_handoffs` | Выдача/возврат: одометры, чек-листы |
| `deposit_entries` / `commission_rates` / `salary_plans` / `salary_calculations` | Депозиты, комиссии, зарплатные планы и расчёты |
| `analytics_passwords` | Пароли-гейты для аналитических дашбордов |
| `live_locations` | Живые координаты райдеров (map-riders) |
| `message_templates` | Шаблоны уведомлений в Telegram |
| `equipment` | Экипировка (прокат снаряжения) |

Приватная схема документов: `rental_contract_artifacts`, `sale_contract_artifacts`,
`subrent_contract_artifacts`, `user_rental_secrets` (QR-секреты), `crew_secrets`, `testdrive_contract_artifacts`.

### 4.3 Разница подходов

- Twenty: **метаданные → таблицы** (объекты описываются декларативно; миграции генерируются).
- Franchize: **код → миграции** (190 SQL-миграций в `supabase/migrations/*`; каждая фича — своя миграция).

> **Слабое место Franchize:** добавить «просто поле» в лид = написать миграцию + типы + UI.
> У Twenty это делается в Settings за минуту. → План заимствования №1: **Custom Fields** для лидов/аренд.

---

## 5️⃣ Лиды и воронка продаж (самое детальное сравнение)

### 5.1 Twenty: возможности по лидам

- Объекты **People** (контакты) и **Opportunities** (сделки) + связи с Companies.
- **Pipeline** (конвейер) — стандартный механизм: кастомные стадии, kanban-вид, drag-and-drop,
  смена стадии = смена поля `stage`.
- Weighted pipeline: расчёт ожидаемой суммы по вероятностям стадий,
  tracking времени в стадии (deal velocity / time-in-stage).
- Workflows по лидам: triage входящих email, auto-reply, детект «stale opportunities»,
  closed-won автоматизации, вебхук-триггеры из внешних форм (Typeform и т.п.).
- **Важно:** в Twenty нет встроенного понятия «источник лида» с метаданными канала и скорингом
  срочности — это строится custom objects + workflows.

### 5.2 Franchize: полноценная воронка на 9 стадий

Пайплайн лидов (`app/franchize/[slug]/leads/lib/pipeline-stages.ts`):

| Стадия | Кто «застревает» (bottleneck) | Next action |
|---|---|---|
| `new` — Новые | Связаться | Написать в Telegram |
| `needs_contact` — Нужен контакт | Создать договор | Написать в Telegram |
| `contract_sent` — Договор отправлен | Показать QR | Переслать QR |
| `awaiting_qr_claim` — QR не принят | Переслать QR лично | Переслать QR |
| `documents_missing` — Документы отсутствуют | Загрузить фото | Запросить документы |
| `active_rental` — Активные | Открыть аренду | Открыть договор |
| `return_due` — Возврат | Закрыть аренду | Назначить возврат |
| `closed_won` — Закрыто | Запросить отзыв | Создать аренду |
| `closed_lost` — Потеряно | Открыть повторно | Открыть повторно |

Что стоит за воронкой:

1. **Лид-лоджмент `franchize_intents`**: каждый значимый сигнал на сайте пишется в таблицу —
   `checkout_start`, `payment_failure`, `payment_success`, `hold_created`, `map_click`,
   `contact_click`, `test_ride_click`, `prebuy`. Плюс `urgency_score 0–100`, `source_route`,
   `contact_channel`, `last_seen_at`. Таблица реалтайм-подписана (publication supabase_realtime) —
   «дозор лидов» толкает уведомления в Telegram.
2. **Два флоу верификации:**
   - **doc-флоу** (оператор сам создал договор через `/doc`): документы проверены вживую,
     QR генерируется для привязки Telegram-личности, bottleneck — показать QR;
   - **webapp-флоу** (клиент сам оформил через каталог): chat_id уже привязан, QR не нужен,
     bottleneck — загрузка фото паспорта/ВУ + проверка оператором (OCR через `/api/docphotoocr`).
3. **SLA-сигналы** (`leads/lib/sla-signals.ts`): «с первого контакта», «без отклика»,
   «просроченные задачи», «до начала аренды», «QR не принят», «до возврата», «документы отсутствуют» —
   каждый с приоритетом и тоном (good/neutral/warning/danger).
4. **Карточка лида** (`LeadRow` in `leads-types.ts`): identityState (`claimed_user | phone_only |
   operator_placeholder | merged`), qrStatus (`unclaimed | sent | claimed | expired`), assignee,
   все аренды и продажи клиента, sourceCount, контракты, totalSpent.
5. **Действия оператора:** telegram/звонок, переслать QR, запросить документы, открыть договор,
   назначить возврат, проверить фото, создать аренду, reopen.
6. **KPI-карточки** (`LeadsKPICards`): totalLeads, hotLeads, conversionRate, monthlyRevenue + дельты.
7. **Dismiss-логика**: лид можно закрыть с причиной и заметкой (`leads-dismiss.ts`);
   стадия станет `closed_lost`.
8. **Полная защита данных:** 152-ФЗ — фотографии документов удаляются после верификации,
   в metadata остаются только проверочные флаги и вердикт верификатора.

### 5.3 Таблица сравнения по лидам

| Функция | Twenty | Franchize |
|---|---|---|
| Kanban-доска сделок | ✅ (Opportunities pipeline, кастомные стадии) | ✅ (LeadBoard, 9 стадий) |
| Источники лидов | Нужно строить (workflows) | ✅ Из коробки: intent-лоджмент + source_route + contact_channel |
| Скоринг срочности | Нужно строить (формулы/поля) | ✅ urgency_score 0–100 + hotLeads KPI |
| SLA / «долгие» лиды | Детект stale opportunities (workflow) | ✅ SLA-сигналы по 7 осям с приоритетами |
| Подсказка «что делать дальше» | Нет | ✅ Bottleneck + Next Action на каждой карточке |
| QR-привязка клиента | Нет | ✅ QR-claim флоу (doc-флоу) |
| Автоверификация документов | Нет | ✅ OCR паспорта/ВУ + чек-лист верификации |
| Работа с повторными клиентами | История сделок/контактов | ✅ Полный профиль: все аренды, продажи, totalSpent, отзывы |
| Закрытие лида с причиной | Есть (стадии) | ✅ dismiss с причинами и заметками |
| Weighted суммы по воронке | ✅ (expected amounts) | Частично (конверсия/выручка в KPI) |

---

## 6️⃣ Автоматизация и интеграции

### 6.1 Twenty: Workflows + Apps

- **Триггеры:** on-record-change, schedule (cron), manual, incoming webhook.
- **Действия:** создание/обновление записей, отправка email, вызов code actions (TypeScript),
  запуск AI-агентов, интеграция с внешними сервисами (Typeform, Stripe, PDF-генерация).
- **Продвинутое:** ветвление (branches), итераторы (loops), версии воркфлоу, запуски (runs) с мониторингом,
  кредитная система (workflow credits).
- **Apps-платформа:** server-side логика с триггерами HTTP/cron/db-event, key-value store,
  background jobs, OAuth connections (действия «от имени пользователя» в сторонних сервисах),
  публикация в marketplace.

### 6.2 Franchize: Server Actions + Telegram-бот + Realtime

- **Server Actions** (`app/franchize/server-actions/*`) — типизированный слой бизнес-логики:
  - `catalog.ts` — витрина и доступность парка;
  - `orders.ts` — чекаут, инвойсы, нотификации, retry-механизм;
  - `rentals.ts` — аренды, договоры, выдача/возврат, verify-чеклист;
  - `leads.ts`, `lead-notes.ts`, `leads-kpis.ts`, `leads-dismiss.ts` — вся воронка;
  - `rentals-dashboard.ts` — единый дашборд аренд+продаж+ком. предложений;
  - `deposit-entries.ts`, `salary-calculations.ts`, `commission_rates`, `team-earnings.ts` — деньги;
  - `crew-todos.ts`, `message-templates.ts`, `checklist.ts`, `reviews.ts`, `promotions.ts` и др.
- **State machine в Telegram:** `/doc` (генерация договора: фото паспорта → фото ВУ → расписание →
  DOCX + QR), `/subrent-manual`, `/testdrive-manual`, `/shift` (часы), `/sos`, `/analytics-pass`,
  `/leads` (Топ-5 горячих лидов), `/codex`, `/howto` и прочие команды (`app/webhook-handlers/commands/*`).
- **Realtime-дозор:** Supabase Realtime на `franchize_intents` + хуки (`useSupabaseRealtime`) —
  новые лиды/интенты→ уведомления в Telegram без поллинга.
- **OCR-пайплайн:** `/api/docphotoocr` → ZAI VLM → данные паспорта/ВУ из фото → подстановка в договор.
- **Внешние API:** `/api/*` — оплаты, синк стоков, вебхуки, callback-lead, GitHub-action-feedback,
  crypto-цены, maps, validate-telegram-auth.

### 6.3 Сравнение

| Возможность | Twenty | Franchize |
|---|---|---|
| Визуальный билдер воркфлоу | ✅ (UI, без кода) | ❌ (логика только кодом) |
| Триггер «запись изменена» | ✅ | ✅ (Realtime + server actions) |
| Триггер «по расписанию» | ✅ cron | ✅ (Vercel cron + API routes) |
| Вебхук-вход (внешний → CRM) | ✅ | ✅ (callback-lead, webhooks) |
| Вебхук-выход (CRM → внешний) | ✅ (нативные webhooks) | ⚠️/❌ (почти нет — только уведомления в TG) |
| Code actions (TS) | ✅ | ✅ (по сути все server actions) |
| AI-агенты в проде | ✅ (чат, агенты, skills) | ⚠️ (VLM OCR для документов; AI-код в бою) |
| Очереди фоновых задач | ✅ (BullMQ) | ⚠️ (Vercel функции, cron, retry-менеджеры) |
| Внешние OAuth-подключения | ✅ | ❌ (нет) |

---

## 7️⃣ Документы и юридическая работа

**Это — zone, где Twenty вообще не конкурент, а Franchize — сильнейший.**

### 7.1 Twenty

- Нет встроенных юридических документов. Есть **пример приложения «Document Generator»**
  (из доки): объект «Документ», логика генерации как AI-тул и workflow-action, HTTP-роуты,
  фронтенд-компоненты, публикация в marketplace.
- То есть в Twenty можно *построить* генерацию PDF-договоров, но это требует разработки
  (объекты, шаблоны, агенты, UI), и это не vertical-специфика (ни OCR паспортов, ни 152-ФЗ, ни QR).

### 7.2 Franchize (из коробки)

- **Шаблоны договоров:** `docs/RENTAL_DEAL_TEMPLATE.html`, `SALE_DEAL_TEMPLATE.html`,
  `SUBRENTAL_DEAL_TEMPLATE.html` → генерация `.docx` через `lib/htmlToDocx.mjs` +
  `app/franchize/lib/docx-capability.ts`, `subrent-contract-generator.ts`.
- **OCR-верификация:** фото паспорта (главная + прописка) и ВУ → распознавание → автозаполнение
  договора; автоматический OCR через `/api/docphotoocr` (webapp-флоу).
- **Чек-лист верификации** (`DocVerificationData`): паспорт проверен, права проверены, экипировка
  передана, одометр «до», даты подтверждены, оплата проверена.
- **QR-claim:** секреты договоров (`user_rental_secrets`) с QR; статусы `unclaimed/sent/claimed/expired`;
  `qr_generated_at`, `qr_first_viewed_at`, `qr_claimed_at`, `qr_regeneration_count`.
- **152-ФЗ:** фото удаляются после верификации (см. комментарии в `computeLeadStage`).
- **Контрактный контур:** draft → approve/decline (`submitContractDraft`, `approveContract`,
  `declineContract`), страница `/franchize/[slug]/contract-draft/[rentalId]`.
- **Приватная схема:** `rental_contract_artifacts`, `sale_contract_artifacts`, `subrent_contract_artifacts` —
  доступ только service_role; верификация через зашифрованные секреты/ша-256.

---

## 8️⃣ Аналитика и отчёты

| Возможность | Twenty | Franchize |
|---|---|---|
| Дашборды с виджетами | ✅ (настраиваемые, real-time) | ✅ (rentals/sales/commercial-analytics) |
| KPI-карточки | ✅ | ✅ RentalsStatsRow, LeadsKPICards, DepositSection |
| Календарь аренд | ⚠️ (Calendar view по датам записей) | ✅ RentalsCalendar |
| Лидерборд сети | ❌ | ✅ rpc_leaderboard + FranchizeLeaderboardClient |
| Зарплаты/комиссии | ❌ (нет такого понятия) | ✅ SalaryClient, CommissionsClient, team-earnings |
| Касса | ❌ | ✅ CashLedger, deposit tracker |
| Экспорт | ✅ (CSV/API) | ✅ ExportModal |
| Парольная защита отчётов | ❌ (роли) | ✅ AnalyticsPasswordEntry (analytics_passwords) |
| Суммы по стадиям воронки | ✅ weighted pipeline | ⚠️ конверсия + revenue в KPI, без весов стадий |
| Когортный анализ персонала | ❌ | ✅ пересменки, часы (shift), hourly_rate, овертаймы |

---

## 9️⃣ Права доступа и безопасность

### 9.1 Twenty

- Роли (admin/member/... ) с правами на объекты, поля, записи (row-level permissions — premium).
- SSO (SAML/OIDC) — Organization-план; audit logs — Organization-план.
- OAuth 2.0 (PKCE) для клиентов API; JWT-токены API.

### 9.2 Franchize

- **Авторизация привязана к Telegram:**
  - WebApp-сессия: подписанный cookie `TELEGRAM_ACTOR_COOKIE` (HMAC-SHA256) — сервер сам читает
    и проверяет идентичность (`verifyTelegramActorCookieValue`), без доверия клиентским булевым
    (fix LA-001: раньше можно было подделать `isPasswordAuth=true`);
  - JWT: chat_id пользователя в `auth.jwt()` — используется в RLS (`auth.jwt() ->> 'chat_id'`);
- **Двухконтурная проверка доступа** в server actions: (1) telegram-кука → role/owner/membership,
  (2) password-гейт → actorUserId сверяется с `crew.owner_id`. Только реальный владелец знает UUID.
- **Роли:** глобальные `admin`/`vpradmin` (metadata.role/status), локальные роли экипажа
  (owner / member / admin в crew_members), `membership_status='active'` обязателен.
- **RLS:** публичные таблицы читаются всеми (`crews`, `crew_members`), записи защищены
  политиками владельца; приватная схема — только service_role.
- **152-ФЗ:** удаление персональных фото после верификации.

### 9.3 Сравнение

| Аспект | Twenty | Franchize |
|---|---|---|
| Role-based access | ✅ | ✅ |
| Row-level permissions | ✅ (premium) | ✅ RLS + серверные проверки |
| SSO | ✅ (premium) | ❌ (Telegram — сам себе SSO) |
| Аудит-логи | ✅ (premium) | ⚠️ частично (история лидов, lead-history) |
| API-токены | ✅ | ⚠️ частично (service_role внутренние) |
| Особый контроль персональных данных | Стандартный | ✅ 152-ФЗ, шифрование секретов, приватная схема |

---

## 🔌 API и интеграции

| Возможность | Twenty | Franchize |
|---|---|---|
| GraphQL | ✅ (полноценный, auto-docs) | ❌ |
| REST | ✅ | ✅ `/api/*` |
| Webhooks (исходящие) | ✅ нативный механизм | ⚠️/❌ |
| Webhooks (входящие) | ✅ триггер воркфлоу | ✅ |
| OAuth clients | ✅ PKCE + client_credentials | ⚠️ внутренние токены |
| Telegram Bot API | ❌ (нет) | ✅ полноценный бот + WebApp |
| CSV импорт/экспорт | ✅ (маппинг, дедуп, ошибки в UI) | ⚠️ экспорт частично; импорт нет |
| Стартовая интеграция | 30+ официальных шаблонов | Кастомные: XTR-платежи, OCR, карты, синк стоков |

---

## 💰 Стоимость владения (TCO) и лицензия

### Twenty
- **Self-hosted Free:** вся Pro-функциональность, бесплатно, сообщество Discord.
- **Cloud Pro:** ~$/мес/пользователь (оплата за сиденья) — email/calendar синк, workflows, standard support.
- **Organization (Cloud или Self-hosted с enterprise-ключом):** SSO, row-level permissions,
  audit logs, AI usage, private source code, unlimited workspaces; priority support.
- **AGPL-3.0 нюанс:** если строите SaaS-продукт поверх Twenty и не берёте Organization-лицензию —
  обязаны публиковать изменения кода (network clause). Для self-host внутри компании — ок.
- Инфраструктура self-host: минимум 2 ГБ RAM (docs), сервер + worker + Postgres + Redis, SSL, бекапы сами.

### Franchize
- Код собственный; бекапы/хостинг — на строне фабрики (Supabase + Vercel).
- Для новых экипажей — готовый «продукт под ключ»: каталог, CRM, бот, документы, аналитика.
- Главный «налог» — инженерное время на новые фичи (миграции + код + тесты), а не лицензия.

---

## 📈 Масштабируемость и производительность

| Аспект | Twenty | Franchize |
|---|---|---|
| Горизонтальное масштабирование | ✅ K8s/Compose, server+worker | ⚠️ Vercel serverless + Supabase (авто) |
| Тяжёлые отчёты | ✅ (воркеры, кэш) | ✅ server actions + SQL RPC (rpc_leaderboard и т.д.) |
| Realtime | ✅ (GraphQL subscriptions?) | ✅ Supabase Realtime (интенты, live_locations) |
| Возможности на тенанта | Ограничены мощностями workspace | Ограничены RLS + парком экипажа |
| Честная оценка | Требует поддержки infra (Redis, волюмы, бекапы) | Требует внимания к размеру таблиц лидов/аренд |

---

## 🚀 План заимствования: 12 фич Twenty → Franchize (по приоритету)

Рекомендации по внедрению, отсортированные по ROI. Каждая фича — с «как» и «где».

### P0 — быстрые победы (1–2 дня каждая)

1. **Custom Fields для лидов/аренд** — декларативная схема доп. полей
   (`lead_custom_fields` jsonb + редактор в админке). Открывает путь к кастомизации под франчайзи
   без миграций на каждое поле.
   *Файлы:* `leads-types.ts`, `server-actions/leads.ts`, миграция на `franchize_intents.metadata`.
2. **Исходящие Webhooks** — дать возможность подписаться на события (новый лид, payment_failure,
   status changed) и слать POST на URL франчайзи. Модуль webhook-out + таблица регистрации подписок.
   *Файлы:* новое `server-actions/webhooks-out.ts`, `/api/webhooks/register`.
3. **Сохранённые Views** — для доски лидов: персональные фильтры/сортировки/группировки
   (AND/OR), как в Twenty. Уже есть фильтры в `useLeadFilters` — добавить сохранение.
4. **CSV-экспорт лидов и аренд** — разовый боевой кейс: выгрузка воронки/кассы в Excel
   (сейчас экспорт есть только в rentals-analytics, `ExportModal`).

### P1 — средний приоритет (3–5 дней)

5. **Weighted Pipeline** — добавить вероятность стадии (%) и «ожидаемую сумму» конвейера
   на KPI-карточки лидов. Логика уже частично есть в `LeadsKPICards` (conversionRate).
6. **Формульные поля** — вычисляемые значения (возраст клиента из даты рождения, сумма
   депозита по тарифу, «дней до возврата» как поле) — на базе custom fields из пункта 1.
7. **Аудит-трейл действий** — таблица `audit_logs` (кто, что, когда, в каком экипаже)
   для всей сети; критично для франчайзи-отношений. Частично есть `lead-history`
   и `wh_audit.sql` — расширить на все money-операции.
8. **Визуальный workflow-lite** — визуальный билдер простых правил поверх
   server actions: «если лид в стадии X и не отвечал N часов → уведомление владельцу»,
   «если rental return_due → напомнить клиенту в TG». Не полный Twenty-билдер,
   а декларативные правила-триггеры в БД.

### P2 — стратегические (1–2 недели)

9. **API-first паспорт для партнёров** — публичный GraphQL или OpenAPI (REST) поверх
   существующих server actions, чтобы франчайзи могли вести своих лидов из своих систем.
10. **AI-ассистент по данным экипажа** — чат/натуральный язык к дашбордам
   (как AI-чат Twenty), доступ только с правами владельца экипажа.
11. **Email/календарь-синк** (опционально) — если франчайзи просят классические каналы;
   в приоритете остаётся Telegram, но можно сделать «Telegram-календарь» (напоминания,
   план возвратов) — дешевле и в духе системы.
12. **Unlimited workspaces для франчайзи** — фактически уже есть (каждый crew), но добавить
   self-service: создание экипажа, инвайты, onbording-флоу (форма в `/franchize/create` уже есть).

### ❌ Чего сознательно НЕ брать из Twenty

- **Замену Telegram на email/календарь** — у нашей аудитории Telegram первичен;
- **Полный workflow-билдер со всеми фичами Twenty** — оверхед для вертикали;
- **Генерацию договоров средствами Twenty** — наша система уже делает это лучше
  (OCR, 152-ФЗ, QR-claim);
- **AGPL-модель Twenty** — мы не публикуем код и не обязаны.

---

## ⚖️ Вердикт: что выбрать и когда

| Ситуация | Выбор |
|---|---|
| Нужна CRM «под любой бизнес», без своей команды разработки | **Twenty** (белый self-host или cloud) |
| Нужен прокат/продажа байков с договорами, Telegram-ботом, кассой и партнёрской сетью | **Franchize** (уже работает) |
| Нужно быстро сделать воронку «на коленке» без кастомизаций | **Twenty** быстрее |
| Нужна воронка с OCR документов, QR-привязкой, SLA-сигналами и юридическими артефактами | **Franchize** — единственный вариант |
| Сеть франчайзи, где каждый тенант автономен и соревнуется | **Franchize** (лидерборд, зарплаты, касса) |
| Гибрид: Franchize как ядро + данные в Twenty для общих отчётов | Возможно через webhooks (P0 №2) |

---

## 📚 Ссылки и источники

- Twenty: https://twenty.com · https://github.com/twentyhq/twenty · https://docs.twenty.com (llms.txt)
- Franchize в репо: `app/franchize/*` (actions, server-actions, hooks, modals, [slug]/leads, rentals-analytics)
- Схема: `supabase/migrations/*` (якорь: `20260508120000_create_franchize_intents.sql`,
  `20240727000000_crew_and_shifts_setup.sql`, `20260621000000_crew_todos.sql`)
- Бот: `app/webhook-handlers/commands/*` (doc, leads, shift, analytics_pass, subrent-manual...)
- Документы: `docs/*_TEMPLATE.html`, `lib/htmlToDocx.mjs`, `api/docphotoocr`

---

*Сгенерировано для внутренней команды rental-repo. Данные о Twenty — из официальной документации (август 2026);*
*данные о Franchize — из фактического кода репозитория.*
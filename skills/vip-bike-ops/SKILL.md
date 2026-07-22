---
name: vip-bike-ops
description: >
  Umbrella meta-skill for VIP Bike operator workspace. Routes operator requests to the
  correct text-skill (leads, analytics, catalog, rentals, crew, contracts, etc.) based
  on natural language intent. Provides shared context: Supabase credentials, crew IDs,
  operator IDs, common curl patterns. Use this skill when the request is ambiguous or
  spans multiple domains.
  Trigger phrases (RU): "операторская", "панель оператора", "что я могу сделать",
  "оператор вип-байк", "оператор vip-bike", "помощь по операторской", "команды оператора",
  "какой skill использовать", "маршрутизация запроса".
  Trigger phrases (EN): "operator workspace", "vip-bike ops", "operator dashboard",
  "what can I do", "operator help", "operator commands", "skill router",
  "route my request".
---

# VIP Bike Ops — Umbrella Meta-Skill

Триггер-фразы (RU): **`операторская`**, **`панель оператора`**, **`что я могу сделать`**, **`оператор вип-байк`**, **`оператор vip-bike`**, **`помощь по операторской`**, **`команды оператора`**, **`какой skill использовать`**, **`маршрутизация запроса`**.
Триггер-фразы (EN): `operator workspace`, `vip-bike ops`, `operator dashboard`, `what can I do`, `operator help`, `operator commands`, `skill router`, `route my request`.

## Overview

Umbrella meta-skill для экипажа `vip-bike`. Не содержит собственных запросов к Supabase — только маршрутизирует операторский запрос в подходящий text-skill на основе естественного языка. Содержит **общий контекст**: Supabase credentials, crew IDs, operator IDs, common curl patterns — используется всеми sibling skills.

Если запрос оператора однозначный (например "покажи лиды") — используйте `leads-crm-text` напрямую. Если запрос составной или неоднозначный (например "что у меня сегодня горит?") — этот meta-skill поможет разбить его на конкретные команды.

## When to Use

Use this skill when:

- Запрос оператора неоднозначный или составной.
- Нужно понять, какой skill использовать для конкретного запроса.
- Нужен единый контекст (Supabase URL, key, crew IDs) для всех skills.
- Нужно объединить вывод нескольких skills в один отчёт (например, morning standup).
- Оператор впервые работает с CLI и хочет список доступных команд.

## Shared Supabase Context

This block is identical in every sibling skill — copy-paste it.

```bash
SUPABASE_URL="https://inmctohsodgdohamhzag.supabase.co"
SUPABASE_SERVICE_ROLE_KEY="$(grep SUPABASE_SERVICE_ROLE_KEY /home/z/my-project/upload/secrets.txt | cut -d= -f2-)"
CREW_SLUG="vip-bike"
CREW_ID="2d5fde70-1dd3-4f0d-8d72-66ccf6908746"

# Operator IDs (vip-bike crew)
OP_OWNER=356282674        # I_O_S_NN
OP_CO_OWNER=244736261     # Roman_Vip_Bike_Electro
OP_ADMIN=413553377        # salavey13
OP_MEMBER=7813830016      # DJORUDJOV

# Common curl headers
HDR_PUBLIC=(-H "apikey: ${SUPABASE_SERVICE_ROLE_KEY}" -H "Authorization: Bearer ${SUPABASE_SERVICE_ROLE_KEY}" -H "Accept: application/json")
HDR_PRIVATE=(-H "apikey: ${SUPABASE_SERVICE_ROLE_KEY}" -H "Authorization: Bearer ${SUPABASE_SERVICE_ROLE_KEY}" -H "Accept: application/json" -H "Accept-Profile: private")
```

Service-role key bypasses RLS and gives read access to both `public` and `private` schemas. **Never** commit it; **never** pass it as URL param.

## Skill Router

### По домену запроса

| Ключевые слова в запросе                                                                                          | Skill                                                          |
|-------------------------------------------------------------------------------------------------------------------|----------------------------------------------------------------|
| лиды, воронка, KPI лидов, dismiss, QR не принят, просроченные задачи лида                                         | `leads-crm-text`                                               |
| аренды, продажи, дашборд задач, выручка, статистика экипажа, KPI экипажа                                          | `analytics-text`                                               |
| каталог байков, цена байка, доступность байка, какие байки есть                                                   | `franchize-catalog-text`                                       |
| карточка аренды, детали аренды, документы аренды, QR-claim аренды, контракт аренды                                | `rental-card-text`                                             |
| экипаж, участники экипажа, роли экипажа, кто онлайн, задачи оператора, изменить роль                              | `crew-management-text`                                         |
| профиль клиента, профиль райдера, история аренд клиента, верификация клиента, troubled                            | `rider-profile-text`                                           |
| отзывы, рейтинг аренд, плохие отзывы, оставить отзыв                                                              | `reviews-text`                                                 |
| договор аренды, контракт аренды, драфт контракта, одобрить, отклонить, STS pledge                                 | `contract-draft-text`                                          |
| заказы, корзина, оформление, чекаут, провал оплаты, abandoned cart                                                | `orders-checkout-text`                                         |
| админка, цены байков, промоакции, шаблоны сообщений, палитра, скидка                                              | `crew-admin-text`                                              |
| лидерборд, топ клиентов, топ операторов, самый популярный байк, доска почёта                                      | `leaderboard-text`                                             |
| информация об экипаже, контакты экипажа, адрес экипажа, описание экипажа                                          | `crew-info-text`                                               |

### По роли оператора

| Роль         | Доступные skills (write)                                              |
|--------------|-----------------------------------------------------------------------|
| `owner`      | ALL skills (incl. `crew-admin-text` sensitive ops)                    |
| `co_owner`   | ALL skills (incl. `crew-admin-text`)                                  |
| `admin`      | ALL skills (incl. `crew-admin-text`)                                  |
| `member`     | `leads-crm-text`, `analytics-text`, `rental-card-text`, `crew-management-text` (read), `rider-profile-text`, `reviews-text`, `orders-checkout-text`, `leaderboard-text`, `crew-info-text`. NO write to `crew-admin-text`. |

### Composite queries

Если запрос оператора составной, разбейте его на отдельные команды:

**Пример 1: "что у меня сегодня горит?"**

```bash
# 1. Горячие лиды
node /home/z/my-project/download/skills/leads-crm-text/leads-query.mjs list-leads --hot --limit 10

# 2. Просроченные задачи
curl -sS "${SUPABASE_URL}/rest/v1/crew_todos?select=id,title,due_date,status&crew_id=eq.${CREW_ID}&status=neq.done&due_date=not.is.null&due_date=lt.$(date -u '+%Y-%m-%dT%H:%M:%S.000Z')&order=due_date.asc&limit=10" \
  "${HDR_PUBLIC[@]}"

# 3. Сегодняшние аренды
curl -sS "${SUPABASE_URL}/rest/v1/rentals?select=rental_id,user_id,vehicle_id,status,total_cost,agreed_start_date&crew_id=eq.${CREW_ID}&status=eq.active&agreed_start_date=gte.$(date -u '+%Y-%m-%dT00:00:00.000Z')&agreed_start_date=lte.$(date -u '+%Y-%m-%dT23:59:59.999Z')" \
  "${HDR_PUBLIC[@]}"

# 4. Провалы оплат за сегодня
curl -sS "${SUPABASE_URL}/rest/v1/franchize_intents?select=id,telegram_user_id,bike_id,metadata&slug=eq.${CREW_SLUG}&intent_type=eq.payment_failure&created_at=gte.$(date -u '+%Y-%m-%dT00:00:00.000Z')" \
  "${HDR_PUBLIC[@]}"
```

🌐 Web: `https://v0-car-test-salavey13s-projects.vercel.app/franchize/vip-bike/dashboard`

**Пример 2: "что с клиентом +79861720402?"**

```bash
# 1. Rider profile
node /home/z/my-project/download/skills/rider-profile-text/rider-query.mjs rider-detail 78901234

# 2. Active rental
curl -sS "${SUPABASE_URL}/rest/v1/rentals?select=rental_id,status,total_cost,agreed_start_date,agreed_end_date&crew_id=eq.${CREW_ID}&user_id=eq.78901234&status=in.(active,confirmed)&order=created_at.desc&limit=1" \
  "${HDR_PUBLIC[@]}"

# 3. Contract artifact
curl -sS "${SUPABASE_URL}/rest/v1/rental_contract_artifacts?select=contract_key,total_sum,storage_path,created_at&rental_id=eq.<rental_id>&crew_slug=eq.${CREW_SLUG}&order=created_at.desc&limit=1" \
  "${HDR_PRIVATE[@]}"

# 4. Todos on this rider
curl -sS "${SUPABASE_URL}/rest/v1/crew_todos?select=id,title,status,due_date&crew_id=eq.${CREW_ID}&or=(user_id.eq.78901234,lead_id.eq.78901234,phone.eq.+79861720402)&order=due_date.asc" \
  "${HDR_PUBLIC[@]}"
```

🌐 Web: `https://v0-car-test-salavey13s-projects.vercel.app/franchize/vip-bike/leads`

**Пример 3: "какие байки свободны завтра?"**

```bash
# 1. List all bikes
node /home/z/my-project/download/skills/franchize-catalog-text/catalog-query.mjs list-bikes

# 2. For each bike, check availability for tomorrow
TOMORROW=$(date -u -d 'tomorrow' '+%Y-%m-%d')
for BIKE_ID in falcon-lynx sur-ron-light-bee-x segway-x160 rawrr-mantis-s; do
  node /home/z/my-project/download/skills/franchize-catalog-text/catalog-query.mjs check-availability $BIKE_ID --date $TOMORROW
done
```

🌐 Web: `https://v0-car-test-salavey13s-projects.vercel.app/franchize/vip-bike/electro-enduro`

## Available Skills (cross-reference)

All 12 text skills + this umbrella:

| # | Skill                       | Path                                                                     | Primary use case                                     |
|---|-----------------------------|--------------------------------------------------------------------------|------------------------------------------------------|
| 1 | `leads-crm-text`            | `/home/z/my-project/download/skills/leads-crm-text/SKILL.md`             | CRM лиды, pipeline, dismiss                          |
| 2 | `analytics-text`            | `/home/z/my-project/download/skills/analytics-text/SKILL.md`             | Rentals/sales/todos dashboards                       |
| 3 | `franchize-catalog-text`    | `/home/z/my-project/download/skills/franchize-catalog-text/SKILL.md`     | Bike catalog, pricing, availability                  |
| 4 | `rental-card-text`          | `/home/z/my-project/download/skills/rental-card-text/SKILL.md`           | Single rental card detail                            |
| 5 | `crew-management-text`      | `/home/z/my-project/download/skills/crew-management-text/SKILL.md`       | Crew members, roles, live status                     |
| 6 | `rider-profile-text`        | `/home/z/my-project/download/skills/rider-profile-text/SKILL.md`         | Rider profile, history, verification                 |
| 7 | `reviews-text`              | `/home/z/my-project/download/skills/reviews-text/SKILL.md`               | Rental reviews, ratings                              |
| 8 | `contract-draft-text`       | `/home/z/my-project/download/skills/contract-draft-text/SKILL.md`        | Contract artifacts, draft/approve/decline            |
| 9 | `orders-checkout-text`      | `/home/z/my-project/download/skills/orders-checkout-text/SKILL.md`       | Orders, cart, checkout intents, payment failures     |
| 10| `crew-admin-text`           | `/home/z/my-project/download/skills/crew-admin-text/SKILL.md`            | Admin panel: prices, promotions, templates, palette  |
| 11| `leaderboard-text`          | `/home/z/my-project/download/skills/leaderboard-text/SKILL.md`           | Top riders/operators/bikes, hall of fame             |
| 12| `crew-info-text`            | `/home/z/my-project/download/skills/crew-info-text/SKILL.md`             | Public crew info, contacts, about                    |
| — | `vip-bike-ops` (this)       | `/home/z/my-project/download/skills/vip-bike-ops/SKILL.md`               | Router + shared context                              |

## Schema Access (consolidated)

This skill does not query Supabase directly. For schema details, refer to the relevant sibling skill.

### Public schema (used across skills)

- `crews` — `id`, `name`, `slug`, `description`, `logo_url`, `owner_id`, `hq_location`, `metadata`, `created_at`, `updated_at`.
- `crew_members` — `id`, `crew_id`, `user_id`, `role` (`owner` / `co_owner` / `admin` / `mechanic` / `member`), `joined_at`, `membership_status`, `last_location`, `live_status`.
- `users` — `user_id`, `username`, `full_name`, `avatar_url`, `website`, `status`, `role`, `metadata`, `language_code`, `badges`, `created_at`.
- `cars` — `id`, `make`, `model`, `description`, `daily_price`, `image_url`, `rent_link`, `is_test_result`, `specs` (jsonb), `owner_id`, `type`, `crew_id`, `availability_rules` (jsonb), `quantity`.
- `rentals` — `rental_id`, `user_id`, `vehicle_id`, `owner_id`, `status`, `payment_status`, `interest_amount`, `total_cost`, `requested_start_date`, `requested_end_date`, `agreed_start_date`, `agreed_end_date`, `delivery_address`, `created_at`, `metadata`, `passport_mainpage_photo`, `passport_registration_photo`, `drivers_licence_frontal_photo`, `crew_id`, `created_by_operator_chat_id`.
- `franchize_intents` — `id`, `slug`, `bike_id`, `intent_type`, `stage`, `source_route`, `contact_channel`, `urgency_score`, `metadata`, `telegram_user_id`, `phone`, `last_seen_at`, `created_at`, `updated_at`.
- `crew_todos` — `id`, `crew_id`, `assigned_to`, `title`, `description`, `category`, `status`, `priority`, `due_date`, `created_at`, `created_by`, `updated_at`, `completed_at`, `lead_id`, `user_id`, `phone`, `rental_id`.
- `lead_notes` — `id`, `lead_id`, `crew_id`, `text`, `created_by`, `created_at`, `updated_at`.

### Private schema (requires `Accept-Profile: private` header)

- `user_rental_secrets` — PII. Renter passport/license/registration, QR-claim state, verification status.
- `rental_contract_artifacts` — PII. Rental contract metadata, STS pledge, storage_path.
- `sale_contract_artifacts` — PII. Sale contract metadata, buyer info, warranty.

### Lead identity resolution (important)

When surfacing leads (web page `app/franchize/server-actions/leads.ts` and this
skill's `leads-query.mjs`), the identity key is resolved in this priority:

1. **Phone** (normalized `+7XXXXXXXXXX`) — when the artifact/rental has one.
2. **Normalized renter name** — `name:<lowercased, dot-collapsed full name>` —
   used as a fallback for operator-created contracts where the operator SKIPPED
   the optional client phone step in `/doc-manual`. Without this fallback all of
   one operator's renters collapsed into a single lead keyed by the operator's
   `telegram_chat_id`, hiding everyone except one. The normalization MUST match
   exactly between `leads.ts` (`nameIdentityKey`) and `leads-query.mjs`
   (`nameIdentityKey`) or the web page and the text skill diverge.
3. `telegram_chat_id` / `user_id` — last resort (operator placeholder).

`rentals.user_id` for operator-created rentals is a placeholder = crew owner
until the renter scans the QR. `created_by_operator_chat_id` on
`rental_contract_artifacts` preserves the REAL operator; on `rentals` it is the
crew-owner placeholder (known inconsistency, do not rely on it for "who issued").

`/doc-manual` now auto-suggests recent web callback (`contact_click`) phones in
the client_phone step so the operator links the contract in one tap instead of
skipping — the main cause of `renter_phone = NULL`.

## Web Links

| Command         | Web page                                                                              |
|-----------------|---------------------------------------------------------------------------------------|
| Skill router    | https://v0-car-test-salavey13s-projects.vercel.app/franchize/vip-bike/dashboard       |
| Composite query | (depends on sub-skill used)                                                           |

## Anti-hallucination: флаги, которых НЕ существует

- ~~`--json`~~ — не существует. Этот skill не имеет собственного вывода, только маршрутизирует.
- ~~`--crew <slug>`~~ — не существует. Crew захардкожен как `vip-bike` во всех sibling skills.
- ~~`--skill <name>`~~ — не существует как named flag. Имя skill'а — positional аргумент или выводится из контекста запроса.
- ~~`--runAll`~~ — не существует. Запуск всех skills разом не имеет смысла.
- ~~`--outFile <path>`~~ — не существует. Используйте `> file.txt` в каждом sub-skill.
- ~~`--format csv|md`~~ — не существует.
- ~~`--aggregate`~~ — не существует. Агрегация выводов — через shell piping.
- ~~`--permission <role>`~~ — не существует. Роль берётся из `crew_members.role` для `ACTOR`.

## Error Handling

| Stage                | Reason                                  | Когда возникает                                                       | Exit | Что делать                                       |
|----------------------|-----------------------------------------|-----------------------------------------------------------------------|------|--------------------------------------------------|
| `secrets_load`       | `SUPABASE_SERVICE_ROLE_KEY not found`   | Путь `/home/z/my-project/upload/secrets.txt` недоступен              | 2    | Проверить путь или export env                    |
| `unknown_skill`      | `Unknown skill: <name>`                 | Маршрутизация в несуществующий skill                                  | 2    | Проверить список skills в разделе "Available Skills" |
| `ambiguous_request`  | `Ambiguous request, please clarify`     | Запрос покрывает несколько skills                                     | 0    | Уточнить запрос или запустить skills по отдельности |
| `permission_denied`  | `Actor <id> cannot use <skill>`         | `member` пытается использовать `crew-admin-text`                      | 2    | Использовать `ACTOR=${OP_ADMIN}` или `${OP_OWNER}` |
| `subskill_error`     | `<skill>: <error>`                      | Sub-skill вернул ошибку                                               | 2    | Смотреть error handling соответствующего skill    |

## Security

- **Service role key** — полный read/write ко всем схемам. Никогда не коммитить, не логировать, не передавать как URL-параметр. Только header `apikey` / `Authorization: Bearer`.
- **PII masking** (обязательно во всех sub-skills):
  - Телефон → `+7XXXXXXXX42` (первые 4 + `…`).
  - Паспорт → `XXXX…` (первые 4 + `…`).
  - Водительское удостоверение → `XXXX…`.
  - Регистрация (адрес) → `г. Мо…` (первые 4 + `…`).
  - Email → `i…@example.com`.
  - ФИО → фамилия с инициалами в публичных чатах.
  - STS (vin, plate) — только в приватном operator chat.
- **Private schema headers**: для `rental_contract_artifacts`, `user_rental_secrets`, `sale_contract_artifacts` обязателен `Accept-Profile: private` (для GET) AND `Content-Profile: private` (для PATCH/INSERT).
- **Permission model**: `owner` / `co_owner` / `admin` — все skills. `member` — read-only + `leads-crm-text dismiss-lead` (with audit). No `crew-admin-text` write.
- Все HTTP-запросы — HTTPS.
- Skill не делает собственных запросов к Supabase — только маршрутизирует в sub-skills.

## Related Files

**Sibling text skills (this skill routes to all 12):**

- `/home/z/my-project/download/skills/leads-crm-text/SKILL.md`
- `/home/z/my-project/download/skills/analytics-text/SKILL.md`
- `/home/z/my-project/download/skills/franchize-catalog-text/SKILL.md`
- `/home/z/my-project/download/skills/rental-card-text/SKILL.md`
- `/home/z/my-project/download/skills/crew-management-text/SKILL.md`
- `/home/z/my-project/download/skills/rider-profile-text/SKILL.md`
- `/home/z/my-project/download/skills/reviews-text/SKILL.md`
- `/home/z/my-project/download/skills/contract-draft-text/SKILL.md`
- `/home/z/my-project/download/skills/orders-checkout-text/SKILL.md`
- `/home/z/my-project/download/skills/crew-admin-text/SKILL.md`
- `/home/z/my-project/download/skills/leaderboard-text/SKILL.md`
- `/home/z/my-project/download/skills/crew-info-text/SKILL.md`

**Source skill files (existing, pre-polish):**

- `/home/z/my-project/franchize_pages/_existing_skills/leads-crm-text__SKILL.md`
- `/home/z/my-project/franchize_pages/_existing_skills/analytics-text__SKILL.md`
- `/home/z/my-project/franchize_pages/_existing_skills/franchize-catalog-text__SKILL.md`

**Boss-mode integration (Telegram bot):**

- `/home/z/my-project/existing_skills/skills_dirs/boss-mode/SKILL.md`
- `/home/z/my-project/existing_skills/skills_dirs/boss-mode/boss.mjs`
- `/home/z/my-project/existing_skills/skills_dirs/boss-mode/execute.mjs`

**Server actions (source of truth for all skills):**

- `app/franchize/server-actions/` — all server actions
- `app/franchize/lib/` — shared libraries
- `app/franchize/[slug]/` — page components

**Leads UI component contracts (frontend gotchas):**

- `app/franchize/[slug]/leads/page.tsx` imports `LeadsClient` from `./LeadsClient` (v1, the **live** version). The Phase 3 `components/LeadsClient.tsx` (v2) is not yet wired into `page.tsx` — edits to v2 don't reach production.
- `app/franchize/[slug]/leads/components/LeadsKPICards.tsx` expects a **single** `kpis: LeadsKpis` prop (`{ totalLeads, hotLeads, conversionRate, monthlyRevenue }`). Do **not** pass raw arrays (`leads` / `hot` / `verified` / `todos`) — `kpis` ends up `undefined` and the page dies on `kpis.totalLeads` inside the error boundary. Compute KPIs upstream (client `useMemo` from `activeLeads` + `hot`, or server action `getLeadsKpis(slug, mode)` in `app/franchize/server-actions/leads-kpis.ts`).
- v1 `LeadsClient.tsx` carries several pre-existing TS prop mismatches with sibling components (`LeadsToolbar`, `LeadList`, `LeadBoard`, `LeadDetailContent`) — they predate the KPI bug, don't blank the page, and are tracked separately. Don't conflate with new fixes.

**Schema migrations (consolidated):**

- `20260304_private_scheme.sql` — private schema setup
- `20260508120000_create_franchize_intents.sql` — `franchize_intents`
- `20260601000000_user_rental_secrets.sql`
- `20260607000000_create_sale_contract_artifacts.sql`
- `20260612000000_fix_rental_contract_artifacts.sql`
- `20260621000000_crew_todos.sql` — `crew_todos`
- `20260705000000_crew_todos_lead_id.sql`
- `20260714000000_lead_notes.sql`
- `20260720120100_add_operator_chat_id.sql`
- `20260720120200_add_crew_todos_rental_id.sql`
- `20260721150000_fix_claim_rental_rpc.sql`
- `20260721160000_backfill_todos_artifacts.sql`
- `20260721170000_fix_backfill_chatid_and_jsonb.sql`
- `20260722000000_hotfix_schema_discrepancies.sql`

**Secrets:**

- `/home/z/my-project/upload/secrets.txt` — `SUPABASE_SERVICE_ROLE_KEY`, `ADMIN_CHAT_ID`, Telegram bot token
- `/home/z/my-project/upload/supabase.txt` — full schema dump

## Known limitations

1. **Crew is hardcoded**: `CREW_SLUG`, `CREW_ID`, operator IDs захардкожены под `vip-bike` во всех sibling skills. Для другого экипажа — отредактировать переменные в начале каждого skill файла.
2. **No streaming**: composite queries выполняются последовательно. Для параллельного выполнения — использовать `&` + `wait` в shell.
3. **No caching**: каждый запрос идёт в Supabase напрямую. Для часто повторяющихся запросов — external cache (Redis/file).
4. **No timezone conversion**: все даты в UTC. Локализация в MSK (UTC+3) — на стороне вызывающего.
5. **Permission check — advisory**: в CLI-skills permission check делается через `ACTOR` env, но не enforced на уровне DB (service_role bypasses RLS). Production enforcement — через RLS policies.

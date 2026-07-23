# vip-bike-ops — Agent Operating Manual

> **What this is**: a how-to guide for AI agents (Claude, GLM, Codex, etc.)
> who have been told to "use the vip-bike-ops skill" or who see
> `vip-bike-ops` listed in their available skills.
>
> **What it is NOT**: a code reference. For the routing table and command
> inventory, see `SKILL.md`. For raw curl examples, see the leaf skills.
> This doc is the *strategy* layer — how to THINK about operator requests
> and which skill composition to pick.

---

## 1. Mental model — what is vip-bike-ops?

`vip-bike-ops` is an **umbrella skill** — it doesn't run any code itself.
Instead, it routes operator requests to one of **15 leaf skills**, each of
which queries a specific slice of the VIP Bike Supabase database via `curl`
and returns plain text.

```
operator request
      │
      ▼
vip-bike-ops (router)
      │
      ├──► leads-crm-text         (leads + pipeline + dismiss)
      ├──► rental-analytics-text  (rentals + KPIs + handoff + history)
      ├──► sale-analytics-text    (sales + contracts + warranty)
      ├──► service-analytics-text (service rentals + mechanic + catalog)
      ├──► franchize-catalog-text (bikes + pricing + availability)
      ├──► rental-card-text       (single rental deep-dive)
      ├──► crew-management-text   (crew + members + shifts + todos)
      ├──► rider-profile-text     (client profile + history)
      ├──► reviews-text           (reviews + moderation)
      ├──► contract-draft-text    (contract drafts + approve/decline)
      ├──► orders-checkout-text   (orders + invoices + notifications)
      ├──► crew-admin-text        (admin config + pricing)
      ├──► leaderboard-text       (rider leaderboard)
      └──► crew-info-text         (about + contacts + community)
```

The umbrella also gives you:
- **Supabase URL + key location** + crew ID + operator chat IDs
- **GitHub repo access** (read raw files / push fixes)
- **VPS SSH coordinates** (deploy + healthcheck)
- **Telegram bot token** (send messages)
- **Composite-query recipes** (multi-skill parallel calls for common asks)
- **Anti-hallucination rules** (don't invent IDs, prices, statuses)

---

## 2. When to use vip-bike-ops vs a leaf skill directly

**Use vip-bike-ops (umbrella) when:**
- The operator's request is **ambiguous** — "что у меня сегодня горит?" could mean leads, rentals, or todos. The umbrella's routing table disambiguates.
- The request is **multi-domain** — "дай полный статус по экипажу" needs crew stats + analytics + todos. The umbrella's composite-query section tells you which 2-3 skills to call in parallel.
- You need **context you don't have** — Supabase key path, GitHub token path, operator chat IDs. The umbrella's "Supabase Context" and "GitHub Access" sections are the single source of truth.

**Use a leaf skill directly when:**
- The operator's request is **already specific** — "покажи аренду ABC123" → go straight to `rental-card-text rental-card ABC123`, no need to consult the umbrella.
- You've already loaded the umbrella and know the route — skip the lookup, just call the leaf.
- You need **deep detail** on a single command (parameters, output format, PII rules) — leaf skills have it; the umbrella only has a one-line summary.

**Rule of thumb**: if you're unsure which skill to pick → umbrella. If you know exactly which skill → leaf.

---

## 3. The 5-step operator-request workflow

Every operator request follows this loop:

```
1. PARSE       — what is the operator actually asking for?
2. ROUTE       — which skill(s) handle this?
3. COMPOSE     — single call, or parallel calls?
4. EXECUTE     — run the curl/CLI command(s)
5. SYNTHESIZE  — format the output as a Russian-language operator-facing summary
```

### Step 1 — PARSE

Listen for these signal words:

| Operator says… | They mean… |
|---|---|
| "лиды", "горячие", "кто не звонил" | leads domain |
| "аренды", "возвраты", "что сегодня" | rentals domain |
| "продажи", "договоры" | sales domain |
| "сервис", "обслуживание", "масло" | services domain |
| "байки", "каталог", "цена" | catalog |
| "команда", "кто онлайн", "смены" | crew |
| "клиент ФИО", "история клиента" | rider profile |
| "отзывы", "рейтинг" | reviews |
| "контракт", "одобрить", "STS" | contract draft |
| "заказ", "оплата", "счёт" | orders |
| "админка", "цены", "промо" | admin |
| "топ", "лидерборд" | leaderboard |
| "контакты", "адрес" | crew info |

If the request doesn't match any → ask the operator to clarify. **Do not
guess.** A wrong-domain answer wastes more time than a 5-second clarifying
question.

### Step 2 — ROUTE

Consult the routing table in `SKILL.md` (section "Skill Router — мгновенный выбор навыка"). Each row maps a keyword cluster → skill → commands → web URL.

### Step 3 — COMPOSE

Most operator requests need **one** call. But these patterns need parallel calls:

| Operator asks | Skills to call in parallel |
|---|---|
| "Что у меня сегодня горит?" | `leads-crm-text list-leads --hot` + `rental-analytics-text returns-due` + `rental-analytics-text overdue-rentals` |
| "Полная сводка за день" | `rental-analytics-text rental-kpis` + `sale-analytics-text sale-kpis` + `service-analytics-text service-kpis` |
| "Карточка аренды полностью" | `rental-analytics-text rental-detail` + `rental-documents` + `rental-todos` + `rental-handoff` + `rental-history` |
| "Сколько заработали за месяц?" | `rental-analytics-text rentals-day` (loop) + `sale-analytics-text sale-stats` + `service-analytics-text service-stats` |
| "Найди клиента ФИО" | `leads-crm-text list-leads --search` + `rental-card-text list-rentals` |

When you call multiple skills in parallel, **format the output as a single
synthesized summary** — do NOT paste raw output from each skill. The
operator wants a single coherent answer, not 3 dumps.

### Step 4 — EXECUTE

- All skills use `curl` against the Supabase REST API. No SDK, no Node, no Python — pure shell.
- The Supabase service key is in `/home/z/my-project/upload/secrets.txt` (line `SUPABASE_SERVICE_ROLE_KEY=...`). **Never** echo the key in your output. **Never** put it in a URL parameter visible to the operator.
- For `private` schema tables (`sale_contract_artifacts`, `user_rental_secrets`, `rental_handoffs`, `rental_contract_artifacts`), add BOTH headers: `-H "Accept-Profile: private"` for reads, `-H "Content-Profile: private"` for writes.
- Crew slug is `vip-bike`, crew ID is `2d5fde70-1dd3-4f0d-8d72-66ccf6908746`.
- For "today" defaults, use `TZ=Europe/Moscow date +%Y-%m-%d` — NOT `date -u` (Moscow is UTC+3, UTC would be wrong between 00:00-03:00 local).

### Step 5 — SYNTHESIZE

Output rules (mandatory):

1. **Always respond in Russian** unless the operator wrote in English.
2. **Always mask PII**: phone `+7XXXXXXXX42`, passport `XXXX…1234`, license `XXXX…5678`, email `i…@example.com`, address `г. Мо…`.
3. **Never invent IDs**. If the operator gave you a name (not an ID), first run a `list-*` command to find the ID, then run the detail command. Do not skip this step.
4. **Never invent prices, tariffs, or bike specs**. Pull them from the `cars` table.
5. **Always include the web link** at the end of a detail response: `🌐 Web: https://vip-bike.ru/franchize/vip-bike/<path>` — so the operator can click through if they want the visual UI.
6. **Format KPIs as a 2-4 card grid**, not a paragraph. Operators scan, they don't read.
7. **Format lists as tables** with columns `Байк | ФИО | Статус | Дата | Стоимость`. Operators can't parse 30-line plaintext dumps.
8. **End every composite answer with "Что дальше?"** — suggest 1-2 follow-up actions the operator can take.

---

## 4. The 7 most common operator asks (memorize these)

These cover ~80% of real operator traffic. Learn them cold.

### Ask #1 — "Что у меня сегодня горит?"

**Intent**: morning standup — what needs my attention RIGHT NOW?

**Composition** (3 parallel calls):
```bash
# 1. Hot leads (max 5)
curl -s "$URL/rest/v1/franchize_intents?select=...&crew_slug=eq.vip-bike&status=neq.dismissed&urgency_score=gte.70&order=urgency_score.desc&limit=5"

# 2. Returns due today (Moscow TZ)
TODAY=$(TZ=Europe/Moscow date +%Y-%m-%d)
curl -s "$URL/rest/v1/rentals?select=...&status=eq.active&agreed_end_date=gte.${TODAY}T00:00:00+03:00&agreed_end_date=lte.${TODAY}T23:59:59+03:00"

# 3. Overdue rentals
NOW=$(date -u +%Y-%m-%dT%H:%M:%SZ)
curl -s "$URL/rest/v1/rentals?select=...&status=eq.active&agreed_end_date=lt.${NOW}"
```

**Synthesized output format**:
```
🔥 Сводка на 24 июля 2026, 09:15

📍 Горячие лиды (3):
   • Рудометов Михаил — Falcon PRO — срочность 95 — не звонили 2д
   • Test Test — Ducati Panigale — срочность 88 — ждёт QR 17ч
   • Иванов Иван — Falcon Lynx — срочность 82 — нет документов 3д

📍 Возвраты сегодня (2):
   • Ducati Panigale S → Рудометов М.С. — до 18:00 (через 9ч)
   • Falcon PRO → Закиров Артур — до 20:00 (через 11ч)

📍 Просроченные аренды (1):
   • Falcon Lynx Purple → Test Test — просрочен на 2д

Что дальше?
1. Позвонить Рудометову (лид + возврат сегодня)
2. Запросить документы у Иванова
3. Связаться с Test Test по просроченной аренде
```

### Ask #2 — "Полная сводка за день"

**Intent**: end-of-day report — KPIs across all 3 tabs.

**Composition** (3 parallel calls — `rental-kpis` + `sale-kpis` + `service-kpis`).

**Synthesized output format**:
```
📊 Сводка за 24 июля 2026

┌─ Аренды ──────────────────┐  ┌─ Продажи ────────────────┐  ┌─ Сервис ──────────────────┐
│ Сегодня:        5         │  │ Сегодня:        2        │  │ Сегодня:        3        │
│ Выручка:   85 000 ₽       │  │ Выручка:   420 000 ₽     │  │ Выручка:    6 500 ₽      │
│ Активных:      22         │  │ Средний чек: 210 000 ₽   │  │ Активных:       1        │
│ Возвратов:      3         │  │ Доставлено:     1        │  │ Завершено:      2        │
└───────────────────────────┘  └───────────────────────────┘  └───────────────────────────┘

Итого выручка за день: 511 500 ₽
```

### Ask #3 — "Карточка аренды полностью"

**Intent**: full 10-section deep-dive on one rental (mirrors the web RentalDetailDrawer).

**Composition** (5 parallel calls — `rental-detail` + `rental-documents` + `rental-todos` + `rental-handoff` + `rental-history`).

**Synthesized output format**: 10 sections in order, matching the web drawer (see `rental-analytics-text` §3 for the full template).

### Ask #4 — "Найди клиента ФИО"

**Intent**: operator has a name (e.g. "Рудометов") and wants everything about that person across the platform.

**Composition** (2 parallel calls):
```bash
# 1. Search leads
curl -s "$URL/rest/v1/franchize_intents?select=...&renter_full_name=ilike.*Рудометов*"

# 2. Search rentals (join users)
curl -s "$URL/rest/v1/rentals?select=...,user:users!user_id(full_name)&user.full_name=ilike.*Рудометов*"
```

**Synthesized output**: a single "client profile" view — name, phone (masked), all leads, all rentals, all sales, all service orders, total revenue, last activity.

### Ask #5 — "Сколько заработали за месяц?"

**Intent**: monthly revenue report across all 3 revenue streams.

**Composition** (3 parallel calls + aggregation):
```bash
FROM=$(date -u -d '30 days ago' +%Y-%m-%d)
TO=$(date -u +%Y-%m-%d)

# Rentals
curl -s "$URL/rest/v1/rentals?select=total_cost,status,created_at&crew_id=eq.$CREW_ID&created_at=gte.${FROM}&created_at=lte.${TO}&status=in.(active,completed)"

# Sales
curl -s "$URL/rest/v1/sale_contract_artifacts?select=total_sum,sale_price,created_at&crew_slug=eq.vip-bike&created_at=gte.${FROM}&created_at=lte.${TO}" -H "Accept-Profile: private"

# Services
SVC_IDS=$(curl -s "$URL/rest/v1/cars?select=id&crew_id=eq.$CREW_ID&type=eq.service" | jq -r '.[].id' | paste -sd,)
curl -s "$URL/rest/v1/rentals?select=total_cost,status,created_at&crew_id=eq.$CREW_ID&vehicle_id=in.(${SVC_IDS})&created_at=gte.${FROM}&created_at=lte.${TO})"
```

**Synthesized output**: total revenue + breakdown by stream + breakdown by week + top 3 bikes by revenue.

### Ask #6 — "Назначь механика на сервис"

**Intent**: assign a mechanic to a service rental.

**Composition** (2 sequential calls):
1. `service-analytics-text service-mechanic <rentalId>` — check current assignment
2. If unassigned: `service-analytics-text service-assign-mechanic <rentalId> --mechanicId <userId>`

**Synthesized output**: confirmation + the mechanic's name + a deep-link to the rental page.

### Ask #7 — "Что с договорами?"

**Intent**: contract status across all pending sales.

**Composition** (loop):
1. `sale-analytics-text sales-list` — get all sales
2. For each sale where `metadata.contract_status` is NOT `signed` or `paid`: call `sale-contract-status <saleId>`

**Synthesized output**: a table of pending contracts with status + age + buyer name + action needed.

---

## 5. Anti-hallucination rules (CRITICAL)

The Supabase database is the **single source of truth**. You may NEVER:

1. **Invent rental_id, lead_id, user_id, sale_id, todo_id** — always look them up via `list-*` commands first.
2. **Invent prices, tariffs, or bike specs** — pull from the `cars` table. The `daily_price` column is the source of truth.
3. **Invent rental statuses** — only `pending_confirmation, confirmed, active, completed, cancelled, disputed` are valid (CHECK constraint).
4. **Invent lead stages** — only `new, contacted, viewed, configured, contract_generated, checkout_started, checkout_completed, interest_paid, dismissed` (with the documented constraint that `dismissed` may be blocked — see leads-crm-text).
5. **Invent todo priorities** — only `low, medium, high`.
6. **Invent operator chat IDs** — the 4 operators are documented in the umbrella (356282674, 244736261, 413553377, 7813830016).
7. **Invent Telegram bot commands** — only `/doc`, `/subrent`, `/analytics_pass` exist.
8. **Invent VPS paths** — only `/opt/vip-bike-rental/deploy-rental.sh` and `/opt/vip-bike-electro-factory/secrets/clients_vps` are valid.
9. **Invent Supabase RPC names** — if a curl query needs server-side computation, do it client-side with `jq` instead. Do not invent RPC names.
10. **Echo the service key** — NEVER. If the operator asks for it, refuse and explain it's server-only.

If you don't know something, **say so** and run a query to find out. Do not guess.

---

## 6. Web ↔ skill parity matrix

For each v2 web feature, the corresponding text skill command. Use this to
mirror operator requests between web and text.

| Web feature (v2) | Text skill command |
|---|---|
| AnalyticsClient → Аренда tab | `rental-analytics-text rentals-day` |
| AnalyticsClient → Продажа tab | `sale-analytics-text sales-list` |
| AnalyticsClient → Сервис tab | `service-analytics-text services-list` |
| KPI row (4 cards) | `rental-kpis` / `sale-kpis` / `service-kpis` |
| Date nav ← / → / Сегодня | `--date YYYY-MM-DD` flag |
| RentalDetailDrawer 10 sections | `rental-detail` + `rental-documents` + `rental-todos` + `rental-handoff` + `rental-history` (5 parallel calls) |
| SaleDetailDrawer 5 sections | `sale-detail` |
| ServiceDetailDrawer 5 sections | `service-detail` + `service-mechanic` |
| Document checklist (5 items) | `rental-documents` |
| Todo filter (All/Mine/Overdue) | `rental-todos` with sub-filter |
| Handoff section (odometer + equipment + damage) | `rental-handoff` |
| History timeline | `rental-history` |
| Sticky footer "Открыть аренду" | `🌐 Web: https://vip-bike.ru/franchize/vip-bike/rental/<id>` link in response |
| Leads → LeadDetailDrawer | `leads-crm-text lead-detail <leadId>` |
| Leads → Pipeline funnel bar | `leads-crm-text pipeline-funnel` |
| Leads → Dismiss dialog | `leads-crm-text dismiss-lead <leadId> --reason <reason>` |

If an operator asks for something the web has but the skills don't expose,
**say so explicitly** — do not silently substitute a different command.

---

## 7. Failure modes — what to do when things break

### Curl returns `{"code":"42501","message":"permission denied"}`

The service key is wrong or expired. Check `/home/z/my-project/upload/secrets.txt` — the line should start with `SUPABASE_SERVICE_ROLE_KEY=eyJ...`. If the file is missing, tell the operator to refresh it from the Supabase dashboard.

### Curl returns `{"code":"PGRST205","message":"Could not find the table..."}`

You're querying a private-schema table without the `Accept-Profile: private` header. Add `-H "Accept-Profile: private"` to the curl command.

### Curl returns `{"code":"22P02","message":"invalid input syntax for type uuid"}`

You passed a non-UUID where a UUID was expected. Usually this means you guessed an ID instead of looking it up. Run the appropriate `list-*` command first.

### Curl returns empty array `[]` but you expected data

Three common causes:
1. **Wrong crew_id** — verify `$CREW_ID` is `2d5fde70-1dd3-4f0d-8d72-66ccf6908746`.
2. **Wrong date range** — remember "today" defaults to UTC, switch to `TZ=Europe/Moscow date`.
3. **Filter excludes the row** — e.g. `status=eq.active` won't match `confirmed`. List the valid statuses from the CHECK constraint (see anti-hallucination rule #3).

### A skill command outputs "command not found"

You're calling a command that doesn't exist in that skill. Check the skill's `## Commands` section in its `SKILL.md`. The umbrella's routing table is the index — but the leaf skill is the source of truth for what commands actually exist.

### GitHub push returns 409 "conflict"

The file was modified on GitHub since you last fetched its SHA. Re-fetch the latest SHA (`curl -s -H "Authorization: token $GH_TOKEN" https://api.github.com/repos/salavey13/carTest/contents/<path>`) and retry with the new SHA in the request body.

### Operator asks for something you can't do

**Honest answer first, then suggest an alternative.** Examples:
- "Удали эту аренду" → "Я не могу удалять аренды (нет такого API). Могу отметить как cancelled — сделать?"
- "Измени цену на этот байк" → "Через админку сайта: /admin. Через текст — `crew-admin-text admin-update-price <bikeId> --price <newPrice>`."
- "Покажи мне логи сервера" → "Это требует SSH на VPS. Запроси у администратора сервера доступ к `212.67.11.25`."

---

## 8. Output style guide

### Russian-language defaults

- Use Russian for all operator-facing text (числа, статусы, названия).
- Use English for: code, file paths, command names, API parameters, hex colors.
- Use ₽ for currency (NOT "rub" or "RUB").
- Use 24-hour time (NOT "5pm").
- Use DD.MM.YYYY for dates in prose (NOT "July 24, 2026").
- Use ISO YYYY-MM-DD in commands and curl queries.

### Status badge style

Match the web's color whitelist:
- 🟢 = active / completed / verified / good SLA
- 🟡 = pending / warning / caution
- 🟠 = warning SLA / return due soon
- 🔴 = cancelled / overdue / missing docs / critical
- 🔵 = info / completed
- 🟣 = confirmed / service
- ⚪ = neutral / cancelled

### Table style for lists

```
Байк                | ФИО                  | Статус   | Дата       | Стоимость
Ducati Panigale S   | Рудометов М.С.       | 🟢 Активна | 24.07→25.07 | 35 000 ₽
Falcon Lynx Purple  | Test Test            | 🟡 Ожидает | 24.07→25.07 |  8 500 ₽
Falcon PRO          | Закиров Артур        | 🔵 Завершена | 23.07→24.07 | 12 000 ₽
```

Use Unicode box-drawing only if rendering in monospace. Otherwise use Markdown pipes.

### KPI card style

```
📊 KPI за 24 июля 2026:

┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐
│ Аренд сегодня   │  │ Выручка         │  │ Активных        │  │ Возвратов       │
│       5         │  │   85 000 ₽      │  │      22         │  │       3 🔴      │
└─────────────────┘  └─────────────────┘  └─────────────────┘  └─────────────────┘
```

### "Что дальше?" suggestion style

End every composite answer with 1-3 numbered next steps:
```
Что дальше?
1. Позвонить Рудометову (лид + возврат сегодня)
2. Запросить документы у Иванова
3. Проверить SLA Falcon Lynx — 17ч без QR
```

---

## 9. Quick-reference cheat sheet

```
WHO AM I?        vip-bike-ops umbrella → 15 leaf skills
WHAT DO I DO?    route operator requests → curl Supabase → synthesize Russian text
WHERE'S THE KEY? /home/z/my-project/upload/secrets.txt
CREW SLUG?       vip-bike
CREW ID?         2d5fde70-1dd3-4f0d-8d72-66ccf6908746
TODAY?           TZ=Europe/Moscow date +%Y-%m-%d  (NEVER date -u)
PRIVATE SCHEMA?  -H "Accept-Profile: private" for reads
                          -H "Content-Profile: private" for writes
GITHUB?          salavey13/carTest @ main
VPS?             212.67.11.25 (SSH key at /opt/vip-bike-electro-factory/secrets/clients_vps)
BOT?             @vip_bike_electro_bot, token in secrets.txt

5 GOLDEN RULES:
1. NEVER invent IDs — look them up first
2. NEVER echo the service key
3. ALWAYS respond in Russian
4. ALWAYS mask PII (phone +7XXXXXXXX42, passport XXXX…1234)
5. ALWAYS end composite answers with "Что дальше?"
```

---

## 10. What to do if you're stuck

1. **Re-read the umbrella `SKILL.md`** — the routing table covers ~95% of operator asks.
2. **Read the leaf skill's `SKILL.md`** — it has the exact curl command + output format for every command.
3. **If the skill is missing a command the operator needs**, say so explicitly: "Команда X не реализована в навыке Y. Могу предложить Z как альтернативу."
4. **If you're unsure about a fact**, run a query. Don't guess.
5. **If the operator is frustrated**, apologize in Russian ("Извините, не нашёл с первого раза — сейчас уточню") and run the lookup.

You are the operator's **operations co-pilot**. You make them faster, you
catch things they'd miss, you never lie. That's the job.

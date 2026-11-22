---
name: rental-stats
description: >
  Текстовая аналитика аренд VIP BIKE прямо в чат оператору: аренды за день, KPI (выручка/
  активные/возвраты), карточка аренды (10 секций), чек-лист документов, состояние передачи
  байка, история событий, возвраты к сроку, просроченные. Активация/завершение аренды.
  Триггеры: аренды сегодня, статус аренд, сколько аренд, выручка за день, возвраты сегодня,
  аренды к возврату, kpi аренд, карточка аренды, документы аренды, передача байка, история
  аренды, активировать аренду, завершить аренду, кто не вернул байк, просроченные аренды,
  что с арендами, сколько заработали на арендах, rental stats.
---

# rental-stats (бот VIP BIKE, операторский навык)

Триггер-фразы: **аренды сегодня**, **статус аренд**, **сколько аренд**, **выручка за день**, **возвраты сегодня**, **аренды к возврату**, **kpi аренд**, **карточка аренды**, **документы аренды**, **передача байка**, **история аренды**, **активировать аренду**, **завершить аренду**, **кто не вернул байк**, **просроченные аренды**, **что с арендами**, **сколько заработали на арендах**.

Результат — текстом в чат оператору. Никаких веб-страниц и внешних дашбордов: всё, что оператор видит в Telegram — это форматированный текст, который генерируется из живых данных Supabase.

## Supabase Access

Переменные приходят из `.env` сервиса (`EnvironmentFile=/opt/claudeclaw/vip-bike/.env`):

```bash
# Фолбэк для ручного запуска из shell под claudeclaw:
[ -z "$SUPABASE_SERVICE_ROLE_KEY" ] && { set -a; . /opt/claudeclaw/vip-bike/.env; set +a; }

URL="${SUPABASE_URL:?no SUPABASE_URL in env}"
KEY="$SUPABASE_SERVICE_ROLE_KEY"
CREW_ID="${CREW_ID:-2d5fde70-1dd3-4f0d-8d72-66ccf6908746}"
CREW_SLUG="${CREW_SLUG:-vip-bike}"
OPERATOR_ID="${ALLOWED_CHAT_ID:?no ALLOWED_CHAT_ID}"
```

Service-role ключ обходит RLS. **Никогда** в URL, никогда в git, никогда в stdout/stderr.

## ⚠️ Критичные URL-конвенции (читай перед любым curl)

1. **URL-encode `+` как `%2B` в offset-таймстампах.** PostgREST парсит `+` в query-string как пробел (form-urlencoded-семантика), поэтому `2026-07-17T00:00:00+03:00` приезжает как `2026-07-17T00:00:00 03:00` → Postgres ошибка `22007 invalid input syntax for type timestamp with time zone`. Пиши `+03:00` как `%2B03:00` внутри URL curl. Двоеточие `:` PostgREST терпит, можно не кодить.
2. **`users` join требует FK-disambiguation.** В `rentals` ДВА FK на `users`: `rentals_user_id_fkey` (user_id → users.user_id) и `rentals_owner_id_fkey` (owner_id → users.user_id). PostgREST отказывает `users!user_id` с PGRST201 "Could not embed because more than one relationship was found". Используй имя констрейнта: `users!rentals_user_id_fkey(full_name,...)` для арендатора, `users!rentals_owner_id_fkey(full_name,...)` для владельца. Тот же паттерн для любого неоднозначного join (`crew_members!crew_members_user_id_fkey`).
3. **Фильтры по датам**: предпочитай UTC `Z`-суффикс (`2026-07-17T00:00:00Z`) перед offset, если не важна локальная дата (возвраты к сроку / KPI). Когда offset нужен — всегда `%2B03:00`.

## KPI (считается на выбранную дату)

4 карточки:
1. **Аренд сегодня** — count аренд, где `created_at` ИЛИ период пересекается с днём
2. **Выручка** — SUM(`total_cost`) WHERE status IN (`active`, `completed`)
3. **Активных** — count WHERE status = `active`
4. **Возвратов** — count WHERE status = `active` AND `agreed_end_date` сегодня (LOCAL дата)

Цветовой whitelist статусов (для эмодзи в выводе):
- 🟢 `#22c55e` active / completed / verified
- 🟡 `#f59e0b` pending_confirmation / warning SLA
- 🟣 `#8b5cf6` confirmed
- 🔴 `#ef4444` cancelled / disputed / overdue / missing docs
- 🔵 `#3b82f6` info / completed (повторный)
- ⚪ `#64748b` neutral / cancelled

## Команды

### 1. `rentals-day [--date YYYY-MM-DD]`
Все аренды за дату (created ИЛИ период пересекает день). Исключает сервисные аренды (`vehicle_id NOT LIKE 'vip-bike-svc-%'`).

```bash
# IMPORTANT: дефолт "сегодня" — Europe/Moscow, не UTC.
DATE="${1:-$(TZ=Europe/Moscow date +%Y-%m-%d)}"
START="${DATE}T00:00:00Z"; END="${DATE}T23:59:59Z"
curl -s "$URL/rest/v1/rentals?select=rental_id,user_id,vehicle_id,status,payment_status,total_cost,requested_start_date,requested_end_date,agreed_start_date,agreed_end_date,metadata,created_at,crew_id,created_by_operator_chat_id&crew_id=eq.$CREW_ID&or=(and(created_at.gte.$START,created_at.lte.$END),and(requested_start_date.lte.$END,requested_end_date.gte.$START),and(agreed_start_date.lte.$END,agreed_end_date.gte.$START))&vehicle_id=not.like.vip-bike-svc-*&order=created_at.desc" \
  -H "apikey: $KEY" -H "Authorization: Bearer $KEY"
```

По каждой карточке:
- Байк: `vehicle.make + " " + vehicle.model` (join `cars` on `vehicle_id`)
- Арендатор ФИО: `users.full_name` (join `users!rentals_user_id_fkey`) — **ФИО первично, НЕ телефон**
- Бейдж статуса (RU): Активна / Завершена / Подтверждена / Ожидает / Отменена / Спор
- Диапазон дат: `agreed_start_date → agreed_end_date` (или requested_*)
- Стоимость: `total_cost` в ₽
- Документы: `3/5 ✅` или `2 missing 🔴` (см. `rental-documents`)
- Передача: `Передан` / `Ожидает` (см. `rental-handoff`)
- SLA countdown: `До возврата: 2д 3ч` (красный, если просрочено)

### 2. `rental-kpis [--date YYYY-MM-DD]`
4 KPI-карточки на дату.

```bash
# LOCAL дата для "сегодня" по умолчанию (Europe/Moscow).
DATE="${1:-$(TZ=Europe/Moscow date +%Y-%m-%d)}"

# 1. Всего сегодня: count из rentals-day
# 2. Выручка: SUM(total_cost) WHERE status IN ('active','completed')
# 3. Активных: COUNT(*) WHERE status = 'active'
# 4. Возвратов: COUNT(*) WHERE status = 'active'
#    AND localDate(agreed_end_date) = $DATE
#    (т.е. TZ=Europe/Moscow date-of-agreed_end_date равно $DATE)
#
# Postgres хранит agreed_end_date как timestamptz (UTC). Чтобы сравнивать "сегодня"
# по Москве — границы через +03:00 offset, как localDateOnly() в web.
START_LOCAL="${DATE}T00:00:00%2B03:00"
END_LOCAL="${DATE}T23:59:59%2B03:00"
curl -s "$URL/rest/v1/rentals?select=rental_id,status,agreed_end_date,total_cost&crew_id=eq.$CREW_ID&status=eq.active&agreed_end_date=gte.${START_LOCAL}&agreed_end_date=lte.${END_LOCAL}" \
  -H "apikey: $KEY" -H "Authorization: Bearer $KEY"
```

Вывод:
```
📊 KPI аренд за 2026-07-24:
   Аренд сегодня: 5
   Выручка: 85 000 ₽
   Активных: 22
   Возвратов: 3
```

### 3. `rental-detail <rentalId>`
Полная карточка из 10 секций.

```bash
curl -s "$URL/rest/v1/rentals?select=*,vehicle:cars!vehicle_id(make,model,type),user:users!rentals_user_id_fkey(full_name,username,metadata)&rental_id=eq.${rentalId}" \
  -H "apikey: $KEY" -H "Authorization: Bearer $KEY"
```

Секции (по порядку):
1. **Header** — байк, ФИО арендатора, бейдж статуса
2. **Основные действия** — Активировать / Завершить / Отменить
3. **SLA overview** — 4 индикатора:
   - `days_active` (с `agreed_start_date`)
   - `until_return` (или `return_overdue`, если просрочено)
   - `docs` (`3/5` готовность)
   - `todo_in_focus` count для этой аренды
4. **Info grid** (12 плиток): Байк, Арендатор, Телефон, Статус, Оплата, Начало, Конец, Стоимость, Депозит, Оператор, Экипаж, Создана
5. **Документы** — чек-лист из 5: passport_mainpage_photo, passport_registration_photo, drivers_licence_frontal_photo, passport_backpage_photo, drivers_licence_back_photo. Каждый: ✅ есть или 🔴 нет
6. **Задачи** — фильтр по All / Mine / Overdue
7. **Передача** — `rental_handoffs`: odometer_before, odometer_after, equipment_checklist, damage_notes
8. **Заметки** — список + добавить (через другой навык, не здесь)
9. **История** — таймлайн событий (создана → началась → завершена/отменена)
10. **Footer** — `rental_id` (для других команд)

### 4. `rental-todos <rentalId>`
Все задачи по аренде. `crew_todos` не несёт `rental_id` напрямую, поэтому фильтруем по `category` + `assigned_to = rental.created_by_operator_chat_id`.

```bash
# Шаг 1: достаём оператора для аренды
OPERATOR=$(curl -s "$URL/rest/v1/rentals?select=created_by_operator_chat_id&rental_id=eq.${rentalId}" \
  -H "apikey: $KEY" -H "Authorization: Bearer $KEY" | jq -r '.[0].created_by_operator_chat_id')

# Шаг 2: задачи на этого оператора
curl -s "$URL/rest/v1/crew_todos?select=id,title,status,category,priority,due_date,assigned_to,created_at&crew_id=eq.$CREW_ID&assigned_to=eq.${OPERATOR}&order=created_at.desc" \
  -H "apikey: $KEY" -H "Authorization: Bearer $KEY"
```

Sub-фильтры: **All** (дефолт), **Mine** (`assigned_to = current_operator`), **Overdue** (`due_date < now() AND status != 'done'`).

### 5. `rental-documents <rentalId>`
Готовность документов — чек-лист из 5.

```bash
# Из metadata rentals + 2 поля в metadata JSONB
curl -s "$URL/rest/v1/rentals?select=metadata&rental_id=eq.${rentalId}" \
  -H "apikey: $KEY" -H "Authorization: Bearer $KEY"

# Из user_rental_secrets (verified OCR data, private schema)
curl -s "$URL/rest/v1/user_rental_secrets?select=renter_full_name,renter_passport,renter_passport_issue_date,renter_registration,renter_driver_license,renter_phone,renter_email,verification_status,doc_sha256&source_rental_id=eq.${rentalId}" \
  -H "apikey: $KEY" -H "Authorization: Bearer $KEY" -H "Accept-Profile: private"
```

Вывод: `Документы: 3/5 ✅` (или `2/5 🔴 — нет: passport_back, license_back`).
PII-маскировка: `passport = "XXXX…1234"`, `phone = "+7…XX-12"`, `email = "x…@y.ru"`.

### 6. `rental-handoff <rentalId>`
Состояние передачи из `rental_handoffs` (или `metadata.handoff_*`).

```bash
# Primary: rental_handoffs (private schema)
curl -s "$URL/rest/v1/rental_handoffs?select=handoff_at,handoff_by,odometer_before,odometer_after,equipment_checklist,damage_notes&rental_id=eq.${rentalId}&order=handoff_at.desc&limit=1" \
  -H "apikey: $KEY" -H "Authorization: Bearer $KEY" -H "Accept-Profile: private"

# Fallback: metadata JSONB
curl -s "$URL/rest/v1/rentals?select=metadata&rental_id=eq.${rentalId}" \
  -H "apikey: $KEY" -H "Authorization: Bearer $KEY" | jq '.[0].metadata | {handoff_at, odometer_before, odometer_after, equipment_checklist, damage_notes}'
```

Вывод:
- `Передан ✅` (если `handoff_at` есть) или `Ожидает 🔄`
- `Одометр: 1234 → 1567 км`
- `Снаряжение: шлем ✅ / перчатки ✅ / защита ❌`
- `Повреждения: царапина на левом баке` (или `—`)

### 7. `rental-history <rentalId>`
Таймлайн событий.

```bash
# Смена статусов из rentals
curl -s "$URL/rest/v1/rentals?select=created_at,agreed_start_date,agreed_end_date,status&rental_id=eq.${rentalId}" \
  -H "apikey: $KEY" -H "Authorization: Bearer $KEY"

# Плюс events из metadata.history (если есть)
curl -s "$URL/rest/v1/rentals?select=metadata&rental_id=eq.${rentalId}" \
  -H "apikey: $KEY" -H "Authorization: Bearer $KEY" | jq '.[0].metadata.history // []'
```

События (таймлайн, последние снизу):
- 🔵 `Аренда создана` (`created_at`)
- 🟢 `Аренда началась` (`agreed_start_date`, если status=active/completed)
- 🟢 `QR принят` (`metadata.qr_claimed_at`, если есть)
- 🔵 `Аренда завершена` (`agreed_end_date`, если status=completed)
- 🔴 `Аренда отменена` (если status=cancelled)

### 8. `activate-rental <rentalId> [--odometer <km>]`
**Мутирует состояние.** Активируем аренду: PATCH `status='active'` + `metadata.odometer_before`.

```bash
curl -s -X PATCH "$URL/rest/v1/rentals?rental_id=eq.${rentalId}" \
  -H "apikey: $KEY" -H "Authorization: Bearer $KEY" \
  -H "Content-Type: application/json" \
  -H "Prefer: return=representation" \
  -d '{"status":"active","agreed_start_date":"'"$(date -u +%Y-%m-%dT%H:%M:%SZ)"'","metadata":{"odometer_before":'"${ODOMETER:-null}"'}}'
```

### 9. `complete-rental <rentalId> --odometer <km>`
**Мутирует состояние.** Завершаем аренду: PATCH `status='completed'` + `metadata.odometer_after`.

```bash
curl -s -X PATCH "$URL/rest/v1/rentals?rental_id=eq.${rentalId}" \
  -H "apikey: $KEY" -H "Authorization: Bearer $KEY" \
  -H "Content-Type: application/json" \
  -H "Prefer: return=representation" \
  -d '{"status":"completed","agreed_end_date":"'"$(date -u +%Y-%m-%dT%H:%M:%SZ)"'","metadata":{"odometer_after":'"${ODOMETER}"'}}'
```

### 10. `returns-due [--date YYYY-MM-DD]`
Аренды к возврату: `status='active'` AND `agreed_end_date` попадает на $DATE **в таймзоне Europe/Moscow**.

```bash
# LOCAL дата для "сегодня" (Europe/Moscow).
DATE="${1:-$(TZ=Europe/Moscow date +%Y-%m-%d)}"
# Границы через +03:00 offset — как localDateOnly() в web.
# UTC-границы (Z-суффикс) дали бы дрейф 3 часа и пропускали бы возвраты у полуночи.
START_LOCAL="${DATE}T00:00:00%2B03:00"
END_LOCAL="${DATE}T23:59:59%2B03:00"
curl -s "$URL/rest/v1/rentals?select=rental_id,vehicle_id,user_id,agreed_end_date,total_cost,status&crew_id=eq.$CREW_ID&status=eq.active&agreed_end_date=gte.${START_LOCAL}&agreed_end_date=lte.${END_LOCAL}" \
  -H "apikey: $KEY" -H "Authorization: Bearer $KEY"
```

Вывод: список с ФИО арендатора + байк + `agreed_end_date` как `до 18:00`.

### 11. `rentals-awaiting-return`
Активные аренды, у которых `agreed_end_date` уже прошла.

```bash
NOW=$(date -u +%Y-%m-%dT%H:%M:%SZ)
curl -s "$URL/rest/v1/rentals?select=rental_id,vehicle_id,user_id,agreed_end_date,total_cost&crew_id=eq.$CREW_ID&status=eq.active&agreed_end_date=lt.${NOW}" \
  -H "apikey: $KEY" -H "Authorization: Bearer $KEY"
```

Вывод: список с countdown `Ждёт оформления: 3д` по каждой строке.

## SLA-сигналы (computeSlaSignals, эквивалент lib/analytics-utils.ts)

По каждой активной аренде считаются 4 индикатора:
1. `days_active` — floor((now - agreed_start_date) / 86400000) → "5д"
2. `until_return` — floor((agreed_end_date - now) / 3600000) → "2д 3ч" или "5ч"
   - тон: `good` (>72ч), `warning` (24-72ч), `danger` (<24ч)
3. `return_overdue` — если `agreed_end_date < now` → "Ждёт оформления: 3д" (тон: `danger`)
4. `docs` — `3/5` готовность (тон: `good` если 5/5, `warning` если 2-4, `danger` если ≤1)

Приоритет: `return_overdue` (10) > `until_return` (8) > `docs` (5) > `days_active` (1).

## Anti-hallucination

- ~~`--json`~~ — текстовый вывод только.
- ~~`--outFile`~~ — stdout только.
- ~~`--crew`~~ — захардкожен `CREW_ID` из `.env` (= vip-bike).
- Никогда не выдумывать KPI — всегда пересчитывать из сырых `rentals`.
- Никогда не показывать телефон арендатора в card view (только в `rental-detail`).

## Безопасность

- Service-role ключ: никогда не показывать клиенту.
- PII-маскировка: паспорт `XXXX…1234`, права `XXXX…5678`, телефон `+7…XX-12`, email `x…@y.ru`.
- Private schema (`user_rental_secrets`, `rental_handoffs`): обязателен `Accept-Profile: private`.
- `activate-rental` / `complete-rental` мутируют состояние. Подтверждать у оператора перед вызовом.

## Связанные навыки бота

- `deposit-tracker` — залоги по арендам.
- `rider-profile` — карточка клиента.
- `leads-crm` — лиды и воронка (кто пришёл, но ещё не арендовал).
- `contract-agent` — оформление аренды (создаёт rentals + .docx договора).

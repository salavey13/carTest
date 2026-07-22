---
name: rental-card-text
description: >
  Text-based rental card detail for VIP Bike. Query rental status, documents, handoffs,
  verification todos, activate/complete rentals, send messages to renters.
  Trigger phrases: "карточка аренды", "статус аренды", "документы аренды",
  "активировать аренду", "завершить аренду", "вернуть байк", "одометр",
  "rental card", "rental detail", "rental status", "activate rental",
  "complete rental", "rental handoff", "rental documents"
---

# Rental Card (text) — VIP Bike

Триггер-фразы: **`карточка аренды`**, **`статус аренды`**, **`документы аренды`**, **`активировать аренду`**, **`завершить аренду`**, **`вернуть байк`**, **`одометр`**, `rental card`, `rental detail`, `rental status`, `activate rental`, `complete rental`, `rental handoff`, `rental documents`.

## Overview

Text-based эквивалент страницы `/franchize/vip-bike/rental/<id>` — самой «толстой» операционной страницы приложения. Читает те же таблицы Supabase, что и server-action `getFranchizeRentalCard` + `getRentalHandoff` + `getRentalVerificationTodos` + `getRentalReturnTodos`, применяет ту же логику классификации identity state (`classifyIdentityState` из `leads.ts`), и выводит форматированную текстовую карточку вместо React UI.

Включает секции: rental header (статус, оплата, даты, сумма), транспорт, арендатор (TG ID, имя, телефон, identity state, QR-claim), verification todos (5 шт: паспорт, прописка, ВУ, одометр, даты), документы (фото на `rentals` + текстовые поля из `user_rental_secrets`), контракт-артефакт (`rental_contract_artifacts`: SHA256, contract_key, даты, сумма, STS-залог), handoff-чек-листы (handout/return), история изменений статуса, и следующее рекомендованное действие.

Skill не запускает Node.js сервер и не требует сборки Next.js — только один файл `rental-query.mjs` (pure ESM, без зависимостей, использует встроенный `fetch`).

## When to Use

Use this skill when:

- Нужно быстро увидеть карточку одной аренды без открытия браузера / Telegram WebApp.
- Нужно проверить прогресс verification todos (паспорт, прописка, ВУ, одометр, даты) — `rental-todos`.
- Нужно увидеть состояние документов арендатора (фото + OCR-текст) — `rental-documents`.
- Нужно проверить handoff-чек-листы (выдача/возврат, одометр, оборудование, повреждения) — `rental-handoff`.
- Нужно вывести список аренд по статусу или за конкретный день — `list-rentals --status active` / `--date 2026-07-22`.
- Нужно увидеть timeline изменений статуса + завершения todos — `rental-history`.
- Нужно активировать аренду (`activate-rental`), завершить (`complete-rental`), сменить статус (`update-rental-status`), или написать арендатору в Telegram (`send-rental-message`) — write-команды реализованы как `curl` recipes (см. ниже), потому что они требуют auth-context оператора, который живёт в Next.js server-action слое.

## End-to-end pipeline

```
┌──────────────────────────────────────────────────────────────────────────┐
│ 1. RENTAL:    загрузить rentals по rental_id (primary key)                 │
│ 2. PARALLEL:  6 источников (public + private schema):                      │
│    a) cars                          (bike: make, model, type, specs)       │
│    b) users                         (renter: full_name, username, phone)   │
│    c) user_rental_secrets (private) (OCR-данные, QR-claim timestamps)      │
│    d) rental_contract_artifacts (private) (contract_key, SHA256, STS)      │
│    e) crew_todos                    (verification + lead_followup todos)   │
│    f) rental_handoffs               (handout/return checklist)             │
│ 3. CLASSIFY:  identityState = classifyRentalIdentityState(rental)          │
│    → operator_placeholder | claimed_user | merged | phone_only             │
│ 4. QR STATUS: computeQrStatus(rental)                                      │
│    → claimed | unclaimed | not_applicable                                  │
│ 5. VERIFY:    verifTodos = crew_todos[category=rental_verification]        │
│    verifDone/verifTotal, allVerifDone                                      │
│ 6. DOCS:      passport_mainpage/registration/drivers_licence               │
│    (bool на rentals + bool на secret + OCR-текст на secret)                │
│ 7. ARTIFACT:  contract_key, original_sha256, rent_start_date/end_date,     │
│    daily_price, deposit_rub, total_sum, storage_path, sts_pledge_used      │
│ 8. HANDOFF:   handout.completed_at, return.completed_at,                   │
│    odometer_start/end, fuel/battery levels, damage_notes                   │
│ 9. HISTORY:   rental.metadata.history[] + crew_todos.completed_at          │
│10. RENDER:    текстовая карточка (header → dates → bike → renter → QR →    │
│    todos → docs → artifact → handoff → messages → verifier → history →     │
│    next action → web link)                                                 │
└──────────────────────────────────────────────────────────────────────────┘
```

## CLI Usage

Все read-only команды выполняются из директории skill:

```bash
# Базовый запуск (читает SUPABASE_SERVICE_ROLE_KEY из /home/z/my-project/upload/secrets.txt)
node rental-query.mjs rental-card <rentalId>

# С явным указанием файла секретов
node rental-query.mjs --secrets /path/to/secrets.txt rental-card <rentalId>

# Через env-переменные
SUPABASE_URL=https://inmctohsodgdohamhzag.supabase.co \
SUPABASE_SERVICE_ROLE_KEY=eyJ... \
node rental-query.mjs rental-card <rentalId>
```

### `rental-card <rentalId>` — полная карточка аренды

```bash
node rental-query.mjs rental-card 9b0c3759-60d1-4348-b03d-5cd44c8e1609
node rental-query.mjs rental-card --rentalId 9b0c3759-60d1-4348-b03d-5cd44c8e1609
```

Выводит секции (по порядку):
1. **Header**: rental_id, crew, status, payment_status, total_cost, interest_amount
2. **Даты**: requested_start/end, agreed_start/end, created_at, updated_at, delivery_address
3. **Транспорт**: bike title (make+model), vehicle_id, type, crew_id
4. **Арендатор**: имя, username, телефон (замаскированный), Telegram ID, identity_state, owner_id, created_by_operator_chat_id
5. **QR-claim**: status (claimed/unclaimed/not_applicable), qr_generated_at, qr_first_viewed_at, qr_claimed_at, qr_regeneration_count, is_web_app_flow
6. **Verification todos**: прогресс X/Y, список с типами (passport_mainpage, passport_registration, drivers_license, odometer, dates) и датами завершения
7. **Документы (rentals)**: ✗/✓ для passport_mainpage_photo, passport_registration_photo, drivers_licence_frontal_photo
8. **Документы (user_rental_secrets)**: ✗/✓ для тех же полей + OCR-текстовые поля (renter_passport, renter_passport_issued_by, renter_passport_issue_date, renter_registration, renter_driver_license, renter_birth_date, renter_email, renter_address)
9. **Контракт-артефакт**: contract_key, original_sha256, created_at, rent_start_date/end_date, total_sum, daily_price, deposit_rub, template_version, storage_path, doc_verifier_id, sts_pledge_used, sts_series, sts_number, created_by_operator_chat_id
10. **Handoff**: handout и return фазы с одометром, топливом, батареей, чек-листом (паспорт/ВУ/депозит/шлем/ключи/инструкции/фото), keys_count, оборудованием (зарядка, замок, куртка, второй шлем, сумка, сетка, крепление камеры, чехол мото, зарядка e-bike), damage_notes, handout_notes, return_notes, equipment_condition_return
11. **Сообщения**: hint про send-rental-message
12. **Контракт verifier**: status (verified/expired/not_verified), scope, documentKey, expiresAt, originalSha256
13. **История** (если есть в `metadata.history[]`): timeline изменений статуса с датой, оператором, сообщением
14. **Следующее рекомендованное действие**: depends on status + verification + handoff state
15. **🌐 Web: https://vip-bike.ru/franchize/vip-bike/rental/<rentalId>**

**Пример вывода:**

```
=== Карточка аренды ===
Rental ID:        9b0c3759-60d1-4348-b03d-5cd44c8e1609
Crew:             vip-bike (2d5fde70-1dd3-4f0d-8d72-66ccf6908746)
Статус:           Активна (active)
Оплата:           Полностью оплачено (fully_paid)
Итого:            15 000 ₽

=== Даты ===
Запрошенные:      2026-07-14 09:00 → 2026-07-15 09:00
...

=== Verification todos ===
Прогресс:         0/5 ○
  ○ Паспорт (главная)
  ○ Паспорт (прописка)
  ○ Вод. удостоверение
  ○ Одометр (старт)
  ○ Даты аренды

=== Документы (на user_rental_secrets) ===
  ✗ Паспорт (главная)
  ✗ Паспорт (регистрация)
  ✗ Вод. удостоверение
  Паспорт (текст):    2225 936960
  Дата рождения:       03.07.1980
  Регистрация:         Город Бор, Нижегородская область, ...

=== Контракт-артефакт ===
Contract key:     rental-sequence-zero-1784014576966
SHA256:           c5ad4cee35aeeb0de966e416cc4a9aa96771b7cc8f1cb7545de88ead5832be92
Dates:            14.07.2026 → 15.07.2026
Total sum:         35 000 ₽

=== Следующее рекомендованное действие ===
Заполнить return-чек-лист при возврате (состояние, одометр-конец, депозит-возврат)

🌐 Web: https://vip-bike.ru/franchize/vip-bike/rental/9b0c3759-60d1-4348-b03d-5cd44c8e1609
```

### `rental-todos <rentalId>` — все verification + lead_followup todos

```bash
node rental-query.mjs rental-todos 9b0c3759-60d1-4348-b03d-5cd44c8e1609
```

Выводит три группы:
- **rental_verification** — 5 системных todos (passport_mainpage, passport_registration, drivers_license, odometer, dates), создаются автоматически при создании аренды (`createRentalVerificationTodos()` server-action).
- **lead_followup** — операторские todos (например «🔑 Принять ключи», «🔧 Проверить ТС при возврате», «🔍 Осмотр на повреждения», «📄 Проверить документы», «📊 Сравнить одометр»). Создаются вручную или скриптами.
- **other** — любые другие категории.

Lookup path: `crew_todos.rental_id = <rentalId>` (primary, миграция `20260720120200_add_crew_todos_rental_id.sql`) + fallback по `description->>'rental_id'` для legacy rows.

### `rental-documents <rentalId>` — статус документов

```bash
node rental-query.mjs rental-documents 9b0c3759-60d1-4348-b03d-5cd44c8e1609
```

Выводит три секции:
- **Фото на `rentals`**: ✗/✓ + storage path для `passport_mainpage_photo`, `passport_registration_photo`, `drivers_licence_frontal_photo`.
- **Данные на `user_rental_secrets`** (private schema): ✗/✓ для тех же полей + OCR-текстовые поля (ФИО, паспорт, кем выдан, дата выдачи, регистрация, ВУ, дата рождения, телефон (замаскированный), email, адрес) + STS-залог поля (если есть: sts_series, sts_number, sts_vehicle_plate, sts_vehicle_vin, sts_vehicle_model, sts_owner_full_name).
- **Контракт-артефакт** (`rental_contract_artifacts`, private): contract_key, SHA256, renter_full_name, renter_passport, renter_passport_issued_by, renter_passport_issue_date, renter_registration, renter_driver_license, license_categories, renter_phone (замаскированный), daily_price, deposit_rub, total_sum, storage_path, sts_pledge_used.

### `rental-handoff <rentalId>` — handoff-чек-листы

```bash
node rental-query.mjs rental-handoff 9b0c3759-60d1-4348-b03d-5cd44c8e1609
```

Выводит две фазы (`handout` и `return`) с:
- **Завершён**: ✓ datetime / ○ (не завершён)
- **Completed by**: оператор, завершивший фазу
- **Замеры**: одометр (start/end), топливо (%), батарея (%)
- **Чек-лист** (зависит от фазы):
  - Handout: passport_checked, license_checked, deposit_collected, helmet_issued, keys_issued, instructions_given, photos_taken
  - Return: condition_checked, helmet_returned, keys_returned, deposit_returned, no_damages_confirmed
- **Оборудование** (только handout): keys_count, charger_included, lock_cable_included, jacket_issued, second_helmet_issued, bag_issued, net_issued, camera_mount_issued, moto_cover_issued, ebike_charger_issued, other_equipment
- **Заметки**: damage_notes, handout_notes, return_notes, equipment_condition_return

Финальная сводка считает пробег за аренду (`odometer_end - odometer_start`).

⚠ **Known limitation**: таблица `rental_handoffs` может отсутствовать в production-БД (если миграция не применена). Скрипт gracefully выводит предупреждение вместо падения.

### `list-rentals [--status X] [--date YYYY-MM-DD]` — список аренд

```bash
# Все аренды экипажа (по умолчанию, лимит 100)
node rental-query.mjs list-rentals

# По статусу
node rental-query.mjs list-rentals --status active
node rental-query.mjs list-rentals --status completed
node rental-query.mjs list-rentals --status cancelled
node rental-query.mjs list-rentals --status pending   # shortcut для pending_confirmation
node rental-query.mjs list-rentals --status confirmed
node rental-query.mjs list-rentals --status disputed

# За конкретный день (UTC): созданные в этот день ИЛИ с периодом, перекрывающим этот день
node rental-query.mjs list-rentals --date 2026-07-22

# Комбинация
node rental-query.mjs list-rentals --status active --date 2026-07-22 --limit 20
```

**Валидные статусы**: `active`, `completed`, `cancelled`, `pending` (alias для `pending_confirmation`), `confirmed`, `disputed`.

**Логика фильтра по дате** (mirrors rentals-analytics page):
1. **Created on day**: `created_at ∈ [YYYY-MM-DDT00:00:00Z, YYYY-MM-DDT23:59:59Z]`
2. **Period overlapping**: `requested_start_date <= endOfDay AND requested_end_date >= startOfDay`

PostgREST не умеет OR между разными колонками в одном запросе, поэтому скрипт делает два параллельных запроса и мержит по `rental_id` (period-overlapping выигрывает — релевантнее для выбранного дня).

**Пример вывода:**

```
=== Аренды VIP Bike за 2026-07-14 (2 всего) ===
   Активна: 2

ID                      Байк                    Статус          Рентер              Даты          Сумма
──────────────────────  ──────────────────────  ──────────────  ──────────────────  ────────────  ────────────
9b0c3759…               Sequence Zero           Активна         Илья I.O.S.         2026-07-14→…  15k₽
7129ef6d…               Yamaha R7               Активна         Dmitriy             2026-07-11→…  45k₽

Открыть карточку: https://vip-bike.ru/franchize/vip-bike/rental/<rentalId>
```

### `rental-history <rentalId>` — история изменений статуса + завершения todos

```bash
node rental-query.mjs rental-history 9b0c3759-60d1-4348-b03d-5cd44c8e1609
```

Выводит единый timeline (отсортированный по времени asc) из 4 источников событий:
- `rental_created` — создание аренды (timestamp из `rentals.created_at`)
- `status_change` — каждое изменение статуса (из `rentals.metadata.history[]`, добавляется server-action `updateRentalStatus`)
- `todo_created` — создание todo (timestamp из `crew_todos.created_at`)
- `todo_completed` — завершение todo (timestamp из `crew_todos.completed_at`)
- `todo_in_progress` — todo в работе (timestamp из `crew_todos.updated_at`)

Каждая строка показывает: дату/время, тип события, описание (статус → X / Todo: Y / Todo: Z), оператора (`by`), и сообщение (если есть).

Финальная сводка считает события по типам.

## Write commands (curl recipes)

Write-команды требуют auth-context оператора (Telegram user_id), который живёт в Next.js server-action слое (`updateRentalStatus`, `activateRental`, `sendRentalMessage` из `/app/franchize/server-actions/`). Они НЕ реализованы в `rental-query.mjs` (read-only), но могут быть вызваны через `curl` к Supabase REST напрямую или к Next.js API endpoints.

**Crew constants для всех recipes:**
```bash
SUPA_URL="https://inmctohsodgdohamhzag.supabase.co"
SUPA_KEY="$(grep SUPABASE_SERVICE_ROLE_KEY /home/z/my-project/upload/secrets.txt | cut -d= -f2-)"
CREW_SLUG="vip-bike"
CREW_ID="2d5fde70-1dd3-4f0d-8d72-66ccf6908746"
ACTOR_ID="413553377"   # telegram user_id оператора (Артур С. / admin)
# Альтернативы: 356282674 (owner Илья), 244736261 (co-owner Роман), 7813830016 (member Джордан)
SITE_URL="https://v0-car-test.vercel.app"   # где крутится Next.js с server-actions
```

### `activate-rental <rentalId> --odometer <km>`

Активирует аренду: переводит `status` из `pending_confirmation` → `active`, сохраняет `metadata.odometer_before`, добавляет запись в `metadata.history[]`, и (через Next.js server-action) регенерирует DOCX с одометром и отправляет уведомления арендатору + владельцу.

**⚠️ Prefer Next.js server-action** — он регенерирует DOCX и шлёт Telegram. Прямой PATCH в Supabase только меняет статус.

**Option A — Next.js server-action** (рекомендуется, но требует POST к `/api/...` или RPC endpoint, не реализовано как публичный API в этом skill):

```bash
# Этот вызов требует пользовательской сессии Telegram WebApp — нельзя сделать чистым curl.
# Вместо этого используйте Option B (PATCH rentals) и затем вызовите активацию через UI.
```

**Option B — прямой PATCH rentals** (минимальный — только статус + одометр, без DOCX и TG-уведомлений):

```bash
RENTAL_ID="9b0c3759-60d1-4348-b03d-5cd44c8e1609"
ODOMETER=12345
NOW=$(date -u '+%Y-%m-%dT%H:%M:%S.000Z')

# 1. Fetch current metadata (для merge)
META=$(curl -sS "${SUPA_URL}/rest/v1/rentals?select=metadata&rental_id=eq.${RENTAL_ID}" \
  -H "apikey: ${SUPA_KEY}" -H "Authorization: Bearer ${SUPA_KEY}" \
  | python3 -c "import json,sys; r=json.load(sys.stdin); print(json.dumps((r[0]['metadata'] if r and r[0] else {}) or {}))")

# 2. Build new metadata: merge history + odometer_before + last_status_change
NEW_META=$(python3 -c "
import json, sys
m = json.loads('''${META}''')
history = m.get('history', [])
history.append({'status': 'active', 'at': '${NOW}', 'by': '${ACTOR_ID}'})
m['history'] = history
m['odometer_before'] = ${ODOMETER}
m['last_status_change_at'] = '${NOW}'
m['last_status_change_by'] = '${ACTOR_ID}'
m['activated_at'] = '${NOW}'
m['activated_by'] = '${ACTOR_ID}'
print(json.dumps(m))
")

# 3. PATCH
curl -sS -X PATCH "${SUPA_URL}/rest/v1/rentals?rental_id=eq.${RENTAL_ID}" \
  -H "apikey: ${SUPA_KEY}" \
  -H "Authorization: Bearer ${SUPA_KEY}" \
  -H "Content-Type: application/json" \
  -H "Prefer: return=representation" \
  -d "{\"status\": \"active\", \"updated_at\": \"${NOW}\", \"metadata\": ${NEW_META}}"

# 4. (Опционально) Записать odometer в rental_handoffs.phase=handout, если таблица существует
curl -sS -X POST "${SUPA_URL}/rest/v1/rental_handoffs" \
  -H "apikey: ${SUPA_KEY}" \
  -H "Authorization: Bearer ${SUPA_KEY}" \
  -H "Content-Type: application/json" \
  -H "Prefer: resolution=merge-duplicates" \
  -d "{\"rental_id\": \"${RENTAL_ID}\", \"phase\": \"handout\", \"odometer_start\": ${ODOMETER}, \"updated_at\": \"${NOW}\"}"
# UNIQUE(rental_id, phase) → upsert works
```

**⚠️ CHECK constraint**: `check_rental_status` разрешает `status ∈ ('pending_confirmation', 'confirmed', 'active', 'completed', 'cancelled', 'disputed')`. Любое другое значение → 23514.

### `complete-rental <rentalId> --odometer <km>`

Завершает аренду: `status` → `completed`, `metadata.odometer_after`, обновляет `cars.specs.last_known_odometer` (для prefill следующей аренды), добавляет запись в `metadata.history[]`.

```bash
RENTAL_ID="9b0c3759-60d1-4348-b03d-5cd44c8e1609"
ODOMETER=12395
NOW=$(date -u '+%Y-%m-%dT%H:%M:%S.000Z')

# 1. Fetch current metadata + vehicle_id
ROW=$(curl -sS "${SUPA_URL}/rest/v1/rentals?select=metadata,vehicle_id&rental_id=eq.${RENTAL_ID}" \
  -H "apikey: ${SUPA_KEY}" -H "Authorization: Bearer ${SUPA_KEY}")
META=$(echo "$ROW" | python3 -c "import json,sys; r=json.load(sys.stdin); print(json.dumps((r[0]['metadata'] if r and r[0] else {}) or {}))")
VEHICLE_ID=$(echo "$ROW" | python3 -c "import json,sys; r=json.load(sys.stdin); print(r[0]['vehicle_id'] if r and r[0] else '')")

# 2. Build new metadata
NEW_META=$(python3 -c "
import json
m = json.loads('''${META}''')
history = m.get('history', [])
history.append({'status': 'completed', 'at': '${NOW}', 'by': '${ACTOR_ID}'})
m['history'] = history
m['odometer_after'] = ${ODOMETER}
m['last_status_change_at'] = '${NOW}'
m['last_status_change_by'] = '${ACTOR_ID}'
m['completed_at'] = '${NOW}'
print(json.dumps(m))
")

# 3. PATCH rentals
curl -sS -X PATCH "${SUPA_URL}/rest/v1/rentals?rental_id=eq.${RENTAL_ID}" \
  -H "apikey: ${SUPA_KEY}" \
  -H "Authorization: Bearer ${SUPA_KEY}" \
  -H "Content-Type: application/json" \
  -H "Prefer: return=representation" \
  -d "{\"status\": \"completed\", \"updated_at\": \"${NOW}\", \"metadata\": ${NEW_META}}"

# 4. Save last_known_odometer on the car (for next-rental prefill) — server-action does this in cars.specs
if [ -n "$VEHICLE_ID" ]; then
  CAR_SPECS=$(curl -sS "${SUPA_URL}/rest/v1/cars?select=specs&id=eq.${VEHICLE_ID}" \
    -H "apikey: ${SUPA_KEY}" -H "Authorization: Bearer ${SUPA_KEY}" \
    | python3 -c "import json,sys; r=json.load(sys.stdin); print(json.dumps((r[0]['specs'] if r and r[0] else {}) or {}))")
  NEW_SPECS=$(python3 -c "
import json
s = json.loads('''${CAR_SPECS}''')
s['last_known_odometer'] = ${ODOMETER}
print(json.dumps(s))
")
  curl -sS -X PATCH "${SUPA_URL}/rest/v1/cars?id=eq.${VEHICLE_ID}" \
    -H "apikey: ${SUPA_KEY}" \
    -H "Authorization: Bearer ${SUPA_KEY}" \
    -H "Content-Type: application/json" \
    -d "{\"specs\": ${NEW_SPECS}}"
fi

# 5. (Опционально) Save odometer_end in rental_handoffs.phase=return
curl -sS -X POST "${SUPA_URL}/rest/v1/rental_handoffs" \
  -H "apikey: ${SUPA_KEY}" \
  -H "Authorization: Bearer ${SUPA_KEY}" \
  -H "Content-Type: application/json" \
  -H "Prefer: resolution=merge-duplicates" \
  -d "{\"rental_id\": \"${RENTAL_ID}\", \"phase\": \"return\", \"odometer_end\": ${ODOMETER}, \"updated_at\": \"${NOW}\"}"
```

### `update-rental-status <rentalId> --status <status> [--message <text>]`

Меняет статус аренды + (опционально) отправляет сообщение арендатору через Telegram forward API. История записывается в `metadata.history[]`.

```bash
RENTAL_ID="9b0c3759-60d1-4348-b03d-5cd44c8e1609"
NEW_STATUS="completed"   # или confirmed | active | cancelled | disputed | pending_confirmation
MESSAGE="Возврат принят, депозит возвращён наличными."
NOW=$(date -u '+%Y-%m-%dT%H:%M:%S.000Z')

# 1. Fetch current metadata + user_id (renter's chat_id)
ROW=$(curl -sS "${SUPA_URL}/rest/v1/rentals?select=metadata,user_id&rental_id=eq.${RENTAL_ID}" \
  -H "apikey: ${SUPA_KEY}" -H "Authorization: Bearer ${SUPA_KEY}")
META=$(echo "$ROW" | python3 -c "import json,sys; r=json.load(sys.stdin); print(json.dumps((r[0]['metadata'] if r and r[0] else {}) or {}))")
RENTER_CHAT_ID=$(echo "$ROW" | python3 -c "import json,sys; r=json.load(sys.stdin); print(r[0]['user_id'] if r and r[0] else '')")

# 2. Build new metadata
NEW_META=$(python3 -c "
import json
m = json.loads('''${META}''')
history = m.get('history', [])
history.append({'status': '${NEW_STATUS}', 'at': '${NOW}', 'by': '${ACTOR_ID}', 'message': '''${MESSAGE}'''})
m['history'] = history
m['last_status_change_at'] = '${NOW}'
m['last_status_change_by'] = '${ACTOR_ID}'
m['last_status_change_message'] = '''${MESSAGE}'''
print(json.dumps(m))
")

# 3. PATCH rentals
curl -sS -X PATCH "${SUPA_URL}/rest/v1/rentals?rental_id=eq.${RENTAL_ID}" \
  -H "apikey: ${SUPA_KEY}" \
  -H "Authorization: Bearer ${SUPA_KEY}" \
  -H "Content-Type: application/json" \
  -H "Prefer: return=representation" \
  -d "{\"status\": \"${NEW_STATUS}\", \"updated_at\": \"${NOW}\", \"metadata\": ${NEW_META}}"

# 4. (Опционально) Notify renter via Telegram forward API
if [ -n "$RENTER_CHAT_ID" ] && [ -n "$MESSAGE" ]; then
  curl -sS -X POST "${SITE_URL}/api/forward-telegram" \
    -H "Content-Type: application/json" \
    -d "{
      \"chat_id\": \"${RENTER_CHAT_ID}\",
      \"method\": \"sendMessage\",
      \"payload\": {
        \"text\": \"ℹ️ <b>Аренда обновлена</b>\\n\\nСтатус: <b>${NEW_STATUS}</b>\\n\\n📝 Сообщение оператора:\\n${MESSAGE}\",
        \"parse_mode\": \"HTML\"
      }
    }"
fi
```

**Валидные значения `--status`**: `pending_confirmation`, `confirmed`, `active`, `completed`, `cancelled`, `disputed`. Любое другое → 23514 (CHECK constraint `check_rental_status`).

### `send-rental-message <rentalId> --message <text>`

Отправляет сообщение арендатору через Telegram forward API (forward-telegram endpoint на Next.js сервере). Сообщение пересылается в chat_id = `rentals.owner_id` (владельцу экипажа) с пометкой rental ID — НЕ напрямую арендатору.

Это зеркалирует server-action `sendRentalMessage()` из `/app/franchize/server-actions/rentals.ts`.

```bash
RENTAL_ID="9b0c3759-60d1-4348-b03d-5cd44c8e1609"
MESSAGE="Когда планируете вернуть байк?"

# 1. Fetch owner_id (chat_id куда пересылать)
OWNER_ID=$(curl -sS "${SUPA_URL}/rest/v1/rentals?select=owner_id&rental_id=eq.${RENTAL_ID}" \
  -H "apikey: ${SUPA_KEY}" -H "Authorization: Bearer ${SUPA_KEY}" \
  | python3 -c "import json,sys; r=json.load(sys.stdin); print(r[0]['owner_id'] if r and r[0] else '')")

if [ -z "$OWNER_ID" ]; then
  echo "ERROR: rental not found or owner_id is null" >&2
  exit 2
fi

# 2. POST to forward-telegram endpoint
curl -sS -X POST "${SITE_URL}/api/forward-telegram" \
  -H "Content-Type: application/json" \
  -d "{
    \"chat_id\": \"${OWNER_ID}\",
    \"method\": \"sendMessage\",
    \"payload\": {
      \"text\": \"📩 Сообщение по аренде #${RENTAL_ID:0:8}:\\n\\n${MESSAGE}\",
      \"parse_mode\": \"Markdown\"
    }
  }"
```

**⚠️ Замечание**: `sendRentalMessage()` в server-action шлёт именно владельцу (`rentals.owner_id`), а не арендатору (`rentals.user_id`). Это сделано намеренно — операторы пишут владельцу через бота, чтобы обсудить конкретную аренду. Если нужно отправить напрямую арендатору, замените `owner_id` на `user_id` в fetch-запросе.

## Input/Output Contracts

### Required Inputs

- Supabase service role key — читается из (в порядке приоритета):
  1. `--secrets <path>` аргумент CLI
  2. `SUPABASE_SERVICE_ROLE_KEY` env-переменная
  3. `/home/z/my-project/upload/secrets.txt` (ищет строку `SUPABASE_SERVICE_ROLE_KEY=...`)
- `rentalId` — для команд `rental-card`, `rental-todos`, `rental-documents`, `rental-handoff`, `rental-history`. Должен быть валидным UUID.

### Optional Inputs

- `--secrets <path>` — путь к файлу с секретами (default: `/home/z/my-project/upload/secrets.txt`)
- `SUPABASE_URL` env — URL проекта (default: `https://inmctohsodgdohamhzag.supabase.co`)
- `DEBUG` env — печатать stack trace при ошибках
- `--limit <n>` — ограничение строк в `list-rentals` (default: 100)
- `--status <s>` — фильтр по статусу в `list-rentals` (active|completed|cancelled|pending|confirmed|disputed)
- `--date YYYY-MM-DD` — фильтр по дате в `list-rentals` (created_at OR period overlap)

### Anti-hallucination: флаги, которых НЕ существует

- ~~`--json`~~ — не существует. Скрипт всегда выводит форматированный текст.
- ~~`--outFile <path>`~~ — не существует. Используйте `> rentals.txt` shell-redirect.
- ~~`--crew <slug>`~~ — не существует. Crew захардкожен как `vip-bike` (меняется в `CREW_SLUG`, `CREW_ID`, `CREW_OPERATOR_IDS`).
- ~~`--format csv|md|html`~~ — не существует. Только текстовая таблица.
- ~~`--actor <userId>`~~ — не существует для read-only команд. Для write-команд используйте env `RENTAL_CLI_ACTOR=<telegram_user_id>` или передавайте `ACTOR_ID` в curl recipes.
- ~~`rental-card --includeMessages`~~ — не существует. Сообщения не хранятся в БД как строки (они идут через Telegram forward API). В карточке показывается hint как отправить новое.
- ~~`rental-todos --status done`~~ — не существует. Все todos показываются; для фильтрации используйте `grep` на stdout.
- ~~`list-rentals --renter <name>`~~ — не существует. Используйте `list-rentals | grep <name>`.
- ~~`rental-handoff --phase handout`~~ — не существует. Обе фазы (handout + return) всегда показываются вместе.
- ~~`rental-history --since <date>`~~ — не существует. Выводится весь timeline; для фильтрации по дате используйте `grep` или `awk`.
- ~~`activate-rental --force`~~ / ~~`complete-rental --force`~~ — не существуют. Write-команды в этом skill — это curl recipes; они не имеют force-флага. Если нужно обойти проверки server-action, редактируйте recipes вручную.

### Output

- **stdout** — форматированная текстовая карточка / таблица / timeline.
- **stderr** — ошибки в формате `ERROR: <message>`. Дополнительный контекст (например, SQL для починки CHECK constraint) печатается на stderr.
- **exit code**:
  - `0` — успех.
  - `2` — ошибка (невалидные аргументы, rental не найден, Supabase 4xx/5xx, constraint violation).

## Schema access

### Public schema (no `Accept-Profile` header needed)

- **`rentals`** — главная таблица аренд. Поля:
  - `rental_id` (uuid, PK)
  - `user_id` (text, FK → users) — Telegram chat_id арендатора (или operator-placeholder до QR-claim)
  - `vehicle_id` (text, FK → cars)
  - `owner_id` (text, FK → users) — владелец ТС (crew owner)
  - `crew_id` (uuid, FK → crews)
  - `status` (text, CHECK: `pending_confirmation | confirmed | active | completed | cancelled | disputed`)
  - `payment_status` (text, CHECK: `pending | interest_paid | fully_paid | refunded | failed`)
  - `interest_amount` (numeric) — депозит
  - `total_cost` (numeric) — итог
  - `requested_start_date`, `requested_end_date`, `agreed_start_date`, `agreed_end_date` (timestamptz)
  - `delivery_address` (text)
  - `metadata` (jsonb) — включает `history[]`, `contract_draft`, `contract_key`, `contract_sha256`, `contract_verifier`, `odometer_before/after`, `last_status_change_*`, `activated_at/by`, `pickup_freeze`, и др.
  - `passport_mainpage_photo`, `passport_registration_photo`, `drivers_licence_frontal_photo` (text — storage paths)
  - `created_by_operator_chat_id` (text) — operator telegram ID, создавший аренду (для pre-claim detection)
  - `created_at`, `updated_at` (timestamptz)
- **`crew_todos`** — задачи экипажа. Поля:
  - `id` (text, PK, UUID)
  - `crew_id` (text, FK → crews)
  - `assigned_to` (text, FK → users, nullable)
  - `lead_id` (text, nullable) — Telegram user_id лида
  - `user_id` (text, nullable) — Telegram user_id арендатора (после QR-claim propagation)
  - `rental_id` (uuid, FK → rentals, nullable) — primary linkage (миграция `20260720120200`)
  - `title` (text), `description` (text — JSON с `rental_id`, `todo_type`, `source`, `lead_id`, `user_id`)
  - `category` (text) — `rental_verification` | `lead_followup` | `general` | `maintenance` | ...
  - `status` (text) — `pending` | `in_progress` | `done`
  - `priority` (text) — `low` | `medium` | `high`
  - `due_date` (timestamptz, nullable)
  - `created_by` (text, FK → users, nullable)
  - `created_at`, `updated_at`, `completed_at` (timestamptz)
- **`cars`** — каталог ТС. Поля: `id` (text, PK), `make`, `model`, `type`, `specs` (jsonb, включает `last_known_odometer`), `crew_id` (uuid)
- **`users`** — Telegram users. Поля: `user_id` (text, PK), `username`, `full_name`, `metadata` (jsonb — включает `phone`, `fullName`, `display_name`, `role`, `troubled`)
- **`crews`** — экипажи. Поля: `id` (uuid, PK), `slug`, `owner_id`, `metadata`
- **`rental_handoffs`** (⚠️ **may be missing in production**) — handoff-чек-листы. Поля:
  - `id` (uuid, PK)
  - `rental_id` (uuid, FK → rentals)
  - `phase` (text) — `handout` | `return`
  - UNIQUE(rental_id, phase) — один handout + один return на аренду
  - Boolean checklist: `passport_checked`, `license_checked`, `deposit_collected`, `helmet_issued`, `keys_issued`, `instructions_given`, `photos_taken`, `condition_checked`, `helmet_returned`, `keys_returned`, `deposit_returned`, `no_damages_confirmed`
  - Numeric: `odometer_start`, `odometer_end`, `fuel_level_start/end`, `battery_level_start/end`, `keys_count`
  - Equipment booleans: `charger_included`, `lock_cable_included`, `jacket_issued`, `second_helmet_issued`, `bag_issued`, `net_issued`, `camera_mount_issued`, `moto_cover_issued`, `ebike_charger_issued`
  - Text: `damage_notes`, `handout_notes`, `return_notes`, `other_equipment`, `equipment_condition_return`
  - Tracking: `completed_at`, `completed_by`, `created_at`, `updated_at`

### Private schema (requires `Accept-Profile: private` AND `Content-Profile: private` headers)

- **`user_rental_secrets`** — данные арендатора с OCR-происхождением. Поля:
  - `id` (uuid, PK)
  - `chat_id` (text, nullable — NULL пока QR не claimed)
  - `crew_slug` (text, NOT NULL)
  - `doc_sha256` (text, NOT NULL, UNIQUE) — links to `rental_contract_artifacts.original_sha256`
  - `renter_full_name`, `renter_passport`, `renter_passport_issued_by`, `renter_passport_issue_date`, `renter_registration`, `renter_driver_license`, `renter_birth_date`, `renter_phone`, `renter_email`, `renter_address` (text, OCR-извлечённые)
  - `source_doc_key` (text) — contract_key источника
  - `source_rental_id` (text) — **primary key для lookup по rentalId**
  - `verification_status` (text, default `'verified'`) — `verified` | `pending` | `revoked`
  - `template_version` (int)
  - `is_web_app_flow` (bool, nullable)
  - `qr_generated_at`, `qr_first_viewed_at`, `qr_claimed_at` (timestamptz) — QR-claim lifecycle
  - `qr_regeneration_count` (int, default 0)
  - `original_doc_sha256` (text, nullable) — для отслеживания регенерации
  - `passport_mainpage_photo`, `passport_registration_photo`, `drivers_licence_frontal_photo` (text — storage paths)
  - STS fields (для залога ПТС): `sts_series`, `sts_number`, `sts_vehicle_plate`, `sts_vehicle_vin`, `sts_vehicle_model`, `sts_owner_full_name`, `sts_pledge_return_days` (int, default 3)
  - `created_at`, `updated_at` (timestamptz)
- **`rental_contract_artifacts`** — контракты-артефакты (DOCX). Поля:
  - `id` (uuid, PK)
  - `contract_key` (text, NOT NULL, UNIQUE)
  - `requested_bike_id`, `resolved_bike_id` (text)
  - `telegram_chat_id` (text, nullable) — изначально operator ID, после QR-claim → renter ID
  - `telegram_message_id` (bigint)
  - `renter_full_name`, `renter_passport`, `renter_passport_issued_by`, `renter_passport_issue_date`, `renter_registration`, `renter_driver_license`, `renter_birth_date` (text)
  - `license_categories` (text)
  - `rent_start_date`, `rent_end_date` (text — формат "DD.MM.YYYY")
  - `daily_price`, `deposit_rub` (text)
  - `total_sum` (numeric)
  - `original_sha256` (text) — matching `user_rental_secrets.doc_sha256`
  - `doc_verifier_id` (uuid, FK → `doc_verifier_records`)
  - `template_version` (int)
  - `sts_pledge_used` (bool, default false)
  - `sts_series`, `sts_number`, `sts_issue_date`, `sts_vehicle_plate`, `sts_vehicle_vin`, `sts_vehicle_model`, `sts_vehicle_year`, `sts_owner_full_name`, `sts_owner_registration`, `sts_owner_relation` (text)
  - `sts_pledge_return_days` (int, default 3)
  - `deposit_amount_skipped` (text)
  - `rental_id` (uuid, FK → rentals) — **primary key для lookup по rentalId**
  - `storage_path` (text)
  - `crew_slug` (text, NOT NULL)
  - `renter_phone` (text)
  - `created_by_operator_chat_id` (text) — operator ID, создавшего контракт (для pre-claim detection)
  - `created_at` (timestamptz)

Headers применяются автоматически в `supabaseQuery()` при `opts.schema === "private"`.

## Identity matching algorithm (порт из leads.ts)

1. **Phone normalization** (порт `phone-utils.ts`):
   - strip `space`, `-`, `(`, `)`
   - `8XXXXXXXXXX` → `+7XXXXXXXXXX`
   - `7XXXXXXXXXX` → `+7XXXXXXXXXX`
   - `XXXXXXXXXX` (10 digits) → `+7XXXXXXXXXX`
   - else: prepend `+`

2. **`classifyRentalIdentityState(rental)`** (порт из `leads.ts classifyIdentityState`):
   - `operator_placeholder` — `rental.user_id ∈ CREW_OPERATOR_IDS`
   - `merged` — `rental.created_by_operator_chat_id ∈ CREW_OPERATOR_IDS` и `≠ rental.user_id` (QR claim перезаписал user_id)
   - `claimed_user` — `rental.user_id` — numeric Telegram ID, не оператор
   - `phone_only` — `rental.user_id` выглядит как телефон
   - fallback: `operator_placeholder`

3. **`computeQrStatus(rental)`**:
   - `not_applicable` — нет `created_by_operator_chat_id` (арендатор создал напрямую)
   - `claimed` — identityState ∈ (`claimed_user`, `merged`)
   - `unclaimed` — есть `created_by_operator_chat_id` но identityState = `operator_placeholder` (QR ещё не отсканирован)

4. **Crew operator IDs** (vip-bike):
   - `356282674` — I_O_S_NN (owner)
   - `244736261` — Roman_Vip_Bike_Electro (co_owner)
   - `413553377` — salavey13 (admin)
   - `7813830016` — DJORUDJOV (member)

## Status lifecycle

```
                  ┌──────────────────────────┐
                  │ pending_confirmation     │ ← аренда создана (web order / doc-manual)
                  └──────────┬───────────────┘
                             │ (verification todos: 5/5 done)
                             │ (operator runs activate-rental --odometer <km>)
                             ▼
                  ┌──────────────────────────┐
                  │ active                   │ ← ТС у арендатора
                  └──────────┬───────────────┘
                             │ (operator runs complete-rental --odometer <km>)
                             ▼
                  ┌──────────────────────────┐
                  │ completed                │ ← ТС возвращено, депозит возвращён
                  └──────────────────────────┘

   Альтернативные переходы (через update-rental-status):
   pending_confirmation → cancelled (operator decline)
   pending_confirmation → confirmed (operator confirm before activation)
   active               → disputed   (renter/owner disagree)
   any                  → cancelled  (forced cancel)
```

**CHECK constraint** (`check_rental_status`): `status ∈ ('pending_confirmation', 'confirmed', 'active', 'completed', 'cancelled', 'disputed')`. Любое другое значение → Postgres code 23514.

## Verification todos lifecycle

При создании аренды server-action `createRentalVerificationTodos(rentalId, crewId, leadId)` создаёт 5 строк в `crew_todos` с `category='rental_verification'`:

| todo_type              | title                                          | priority |
|------------------------|------------------------------------------------|----------|
| `passport_mainpage`    | Верифицировать паспорт (главная страница)      | high     |
| `passport_registration`| Верифицировать паспорт (страница с пропиской)  | high     |
| `drivers_license`      | Верифицировать водительское удостоверение     | high     |
| `odometer`             | Подтвердить начальный одометр                 | medium   |
| `dates`                | Подтвердить даты аренды                       | medium   |

Каждый todo имеет `description` JSON: `{"rental_id": "<uuid>", "todo_type": "...", "source": "rental_verification_system", "lead_id": "...", "user_id": "..."}`.

Server-action `completeRentalVerificationTodo(rentalId, todoType)` помечает конкретный todo как `done` (по `rental_id` + `todo_type` в JSON description).

Server-action `activateRentalIfReady(rentalId)` проверяет, что ВСЕ verification todos выполнены, и если да — активирует аренду (`pending_confirmation` → `active`). Это **автоматический** триггер, но его можно вызвать вручную.

## Error Handling

| Stage                       | Reason                                          | Когда возникает                                                                | Exit | Что делать                                                                  |
|-----------------------------|-------------------------------------------------|--------------------------------------------------------------------------------|------|-----------------------------------------------------------------------------|
| `secrets_load`              | `SUPABASE_SERVICE_ROLE_KEY not found`           | Нет env-переменной, `--secrets` путь не читается, дефолтный путь недоступен    | 2    | Передать `--secrets <path>` или export env var                              |
| `supabase_query_4xx`        | `Supabase <schema>.<table> 4xx: <body>`         | Неверный select-список, RLS запретил, нет такой таблицы/колонки                 | 2    | Проверить схему (см. раздел "Schema access")                                |
| `supabase_query_5xx`        | `Supabase <schema>.<table> 5xx: <body>`         | Supabase лежит, rate-limit, timeout                                            | 2    | Повторить через минуту                                                       |
| `rental_handoffs_missing`   | (graceful warning, не error)                    | Таблица `rental_handoffs` не существует в БД (Postgres 42P01)                   | 0    | Применить миграцию для создания `rental_handoffs` (см. ниже)                 |
| `rental_not_found`          | `Rental not found: <rentalId>`                  | `rental-card`/`rental-todos`/etc — нет строки с таким `rental_id`              | 2    | Проверить UUID через `list-rentals`                                          |
| `rental_id_missing`         | `rentalId is required`                          | Команда вызвана без позиционного аргумента и без `--rentalId`                  | 2    | Передать `rental-card <uuid>`                                                |
| `status_filter_invalid`     | `invalid status "<value>"`                      | `list-rentals --status bogus`                                                  | 2    | Использовать `active|completed|cancelled|pending|confirmed|disputed`         |
| `date_format_invalid`       | `invalid --date format`                         | `list-rentals --date 22-07-2026` (нужен YYYY-MM-DD)                            | 2    | Использовать ISO format `2026-07-22`                                         |
| `unknown_command`           | `unknown command "<value>"`                     | Опечатка в подкоманде                                                          | 2    | Запустить `--help` для списка команд                                         |

### Migration для `rental_handoffs` (если таблицы нет)

Скрипт gracefully обрабатывает отсутствие `rental_handoffs` (Postgres code `42P01`), выводя предупреждение вместо падения. Чтобы включить handoff-функциональность, примените миграцию (примерная схема — финальная может отличаться, см. типы в `/app/franchize/server-actions/rental-handoffs.ts`):

```sql
CREATE TABLE IF NOT EXISTS public.rental_handoffs (
  id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rental_id                   UUID NOT NULL REFERENCES public.rentals(rental_id) ON DELETE CASCADE,
  phase                       TEXT NOT NULL CHECK (phase IN ('handout', 'return')),
  -- Boolean checklist (handout)
  passport_checked            BOOLEAN DEFAULT false,
  license_checked             BOOLEAN DEFAULT false,
  deposit_collected           BOOLEAN DEFAULT false,
  helmet_issued               BOOLEAN DEFAULT false,
  keys_issued                 BOOLEAN DEFAULT false,
  instructions_given          BOOLEAN DEFAULT false,
  photos_taken                BOOLEAN DEFAULT false,
  -- Boolean checklist (return)
  condition_checked           BOOLEAN DEFAULT false,
  helmet_returned             BOOLEAN DEFAULT false,
  keys_returned               BOOLEAN DEFAULT false,
  deposit_returned            BOOLEAN DEFAULT false,
  no_damages_confirmed        BOOLEAN DEFAULT false,
  -- Numeric readings
  odometer_start              INTEGER,
  odometer_end                INTEGER,
  fuel_level_start            INTEGER CHECK (fuel_level_start BETWEEN 0 AND 100),
  fuel_level_end              INTEGER CHECK (fuel_level_end   BETWEEN 0 AND 100),
  battery_level_start         INTEGER CHECK (battery_level_start BETWEEN 0 AND 100),
  battery_level_end           INTEGER CHECK (battery_level_end   BETWEEN 0 AND 100),
  keys_count                  INTEGER,
  -- Equipment booleans
  charger_included            BOOLEAN,
  lock_cable_included         BOOLEAN,
  jacket_issued               BOOLEAN,
  second_helmet_issued        BOOLEAN,
  bag_issued                  BOOLEAN,
  net_issued                  BOOLEAN,
  camera_mount_issued         BOOLEAN,
  moto_cover_issued           BOOLEAN,
  ebike_charger_issued        BOOLEAN,
  -- Notes
  damage_notes                TEXT,
  handout_notes               TEXT,
  return_notes                TEXT,
  other_equipment             TEXT,
  equipment_condition_return  TEXT,
  -- Tracking
  completed_at                TIMESTAMPTZ,
  completed_by                TEXT REFERENCES public.users(user_id) ON DELETE SET NULL,
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(rental_id, phase)
);

CREATE INDEX idx_rental_handoffs_rental_id ON public.rental_handoffs(rental_id);

-- Trigger для updated_at
CREATE OR REPLACE FUNCTION public.update_rental_handoffs_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER rental_handoffs_updated_at
  BEFORE UPDATE ON public.rental_handoffs
  FOR EACH ROW EXECUTE FUNCTION public.update_rental_handoffs_updated_at();

-- RLS: только crew members могут читать/писать
ALTER TABLE public.rental_handoffs ENABLE ROW LEVEL SECURITY;
-- TODO: добавить политики RLS для crew-scoped access
```

Запустить через Supabase SQL Editor (Dashboard → SQL → New query) или через `psql` к production DB. После этого `rental-handoff` начнёт показывать реальные данные.

### CHECK constraint fix для `update-rental-status` / `activate-rental` / `complete-rental`

Production DB `check_rental_status` (из schema-dump) **разрешает** только: `pending_confirmation`, `confirmed`, `active`, `completed`, `cancelled`, `disputed`. Если curl recipe пытается записать другое значение (например `pending` без `_confirmation`), Postgres вернёт code 23514. Решение: использовать полный enum значений.

## Security / Compliance Rules

- **Service role key** (`SUPABASE_SERVICE_ROLE_KEY`) даёт полный read/write доступ ко всем таблицам, **включая private-схему с ПДн клиентов** (паспорта, права, телефоны, адреса, OCR-данные). Никогда:
  - не коммитить ключ в git
  - не логировать ключ в stdout/stderr (скрипт не печатает его нигде)
  - не передавать ключ как URL-параметр (только header `apikey` / `Authorization: Bearer`)
  - не встраивать ключ в клиентский код (React/Next.js client bundle)
- **ПДн клиентов** (ФИО, телефон, метаданные паспорта/прав) печатаются в stdout. Скрипт применяет маскирование:
  - **Телефон**: последние 4 цифры заменяются на `XXXX` (`+7XXXXXXXXXXXX` → `+7XXXXXXXXXXXX` без последних 4)
  - **ФИО**: выводится как есть (в карточке аренды это нужно для идентификации). Для публичных чатов / логов внешние утилиты должны дополнительно маскировать.
  - **Паспорт/ВУ серии-номера**: выводятся как есть в `rental-documents` (это операционные данные, необходимые для верификации). НЕ логировать в публичные каналы.
- Скрипт **не делает** `INSERT`/`UPDATE`/`DELETE` нигде. Все 6 команд (`rental-card`, `rental-todos`, `rental-documents`, `rental-handoff`, `list-rentals`, `rental-history`) — read-only через `GET` запросы к PostgREST.
- Write-команды (`activate-rental`, `complete-rental`, `update-rental-status`, `send-rental-message`) — это **curl recipes** в SKILL.md. Они используют тот же `service_role` key для PATCH `rentals` и POST к `forward-telegram` endpoint. При их выполнении:
  - Всегда записывайте `metadata.last_status_change_by = <actor_user_id>` для аудита.
  - Используйте `ACTOR_ID` env var (текущий операторский Telegram ID), не зашивайте в скрипт.
  - Для `send-rental-message` помните, что сообщение уходит владельцу экипажа (`rentals.owner_id`), а не арендатору (`rentals.user_id`).
- Private schema (`user_rental_secrets`, `rental_contract_artifacts`, `sale_contract_artifacts`) доступна только через `service_role` key — RLS отзывает `anon`/`authenticated`. Не делитесь ключом с посторонними.
- Все HTTP-запросы идут через HTTPS (`https://inmctohsodgdohamhzag.supabase.co`). Не использовать plain HTTP proxy в промежуточных цепочках.
- Скрипт не сохраняет результаты запросов на диск. Вывод в stdout принадлежит вызывающей стороне (shell, CI runner, Telegram-бот).

## Examples

### Утренний standup: активные аренды + просроченные

```bash
cd /home/z/my-project/download/skills/rental-card-text

echo "🚴 Активные аренды:"
node rental-query.mjs list-rentals --status active --limit 20

echo ""
echo "📋 Детали конкретной аренды:"
node rental-query.mjs rental-card 9b0c3759-60d1-4348-b03d-5cd44c8e1609
```

### Проверка документов перед активацией

```bash
RENTAL_ID=9b0c3759-60d1-4348-b03d-5cd44c8e1609

echo "📄 Verification todos:"
node rental-query.mjs rental-todos "$RENTAL_ID" | grep -A 20 "rental_verification"

echo ""
echo "🪪 Документы:"
node rental-query.mjs rental-documents "$RENTAL_ID"

echo ""
echo "✋ Handoff:"
node rental-query.mjs rental-handoff "$RENTAL_ID"
```

### Завершение аренды (write command, curl recipe)

```bash
source /home/z/my-project/upload/secrets.txt
SUPA_URL="$NEXT_PUBLIC_SUPABASE_URL"
SUPA_KEY="$SUPABASE_SERVICE_ROLE_KEY"
ACTOR_ID="413553377"
RENTAL_ID="9b0c3759-60d1-4348-b03d-5cd44c8e1609"
ODOMETER=12395
NOW=$(date -u '+%Y-%m-%dT%H:%M:%S.000Z')

# Fetch + patch (см. полный recipe в разделе "complete-rental выше")
ROW=$(curl -sS "${SUPA_URL}/rest/v1/rentals?select=metadata,vehicle_id&rental_id=eq.${RENTAL_ID}" \
  -H "apikey: ${SUPA_KEY}" -H "Authorization: Bearer ${SUPA_KEY}")
META=$(echo "$ROW" | python3 -c "import json,sys; r=json.load(sys.stdin); print(json.dumps((r[0]['metadata'] if r and r[0] else {}) or {}))")
NEW_META=$(python3 -c "
import json
m = json.loads('$META')
history = m.get('history', [])
history.append({'status': 'completed', 'at': '${NOW}', 'by': '${ACTOR_ID}'})
m['history'] = history
m['odometer_after'] = $ODOMETER
m['last_status_change_at'] = '${NOW}'
m['last_status_change_by'] = '${ACTOR_ID}'
print(json.dumps(m))
")
curl -sS -X PATCH "${SUPA_URL}/rest/v1/rentals?rental_id=eq.${RENTAL_ID}" \
  -H "apikey: ${SUPA_KEY}" -H "Authorization: Bearer ${SUPA_KEY}" \
  -H "Content-Type: application/json" -H "Prefer: return=representation" \
  -d "{\"status\": \"completed\", \"updated_at\": \"${NOW}\", \"metadata\": ${NEW_META}}"

# Verify
node rental-query.mjs rental-card "$RENTAL_ID" | grep -E "Статус|одометр"
```

### Просмотр истории конкретной аренды

```bash
node rental-query.mjs rental-history 9b0c3759-60d1-4348-b03d-5cd44c8e1609
# → timeline из ~11 событий (rental_created + todo_created×10)
```

### Аренды за конкретный день

```bash
# Что происходило 14 июля 2026
node rental-query.mjs list-rentals --date 2026-07-14 --limit 50
```

## Integration with boss-mode / Telegram bot

Скрипт можно вызывать из Telegram-бота (boss-mode) для ответов на запросы оператора:

```
Пользователь: "карточка аренды 9b0c3759"
Бот: exec `node rental-query.mjs rental-card 9b0c3759-60d1-4348-b03d-5cd44c8e1609`
     → вывод карточки в Telegram-чат

Пользователь: "покажи активные аренды"
Бот: exec `node rental-query.mjs list-rentals --status active --limit 20`
     → вывод таблицы в Telegram-чат

Пользователь: "заверши аренду 9b0c3759, одометр 12395"
Бот: exec curl recipe (см. "complete-rental" выше) с RENTAL_ID=9b0c3759... и ODOMETER=12395
     → вывод подтверждения + обновлённой карточки
```

При интеграции с Telegram учитывать:
- Длинные карточки (>4096 символов) разбивать на несколько сообщений или отправлять как файл.
- Маскировать телефоны в публичных чатах (скрипт уже делает `+7XXXXXXXXXXXX` → `+7XXXXXXXXXXXX` без последних 4 цифр, но ФИО и паспортные данные видны).
- Для write-команд всегда записывать `metadata.last_status_change_by = <actor_user_id>` для аудита.
- Сообщения арендатору идут через `forward-telegram` endpoint, который требует доступности Next.js сервера (default: `https://v0-car-test.vercel.app`). Если сервер недоступен — использовать прямой Telegram Bot API с `TELEGRAM_BOT_TOKEN`.

## Known limitations

1. **Crew is hardcoded**: `CREW_SLUG`, `CREW_ID`, `CREW_OPERATOR_IDS` захардкожены в `rental-query.mjs` под `vip-bike`. Для другого crew — отредактировать константы в начале файла.

2. **`rental_handoffs` table may be missing**: миграция для этой таблицы может быть не применена в production. Скрипт gracefully выводит предупреждение вместо падения (Postgres code 42P01).

3. **Resource embedding not used**: Supabase REST `?select=...,vehicle:cars(make,model)` syntax для JOIN'ов не используется. Bike title и renter name резолвятся отдельными bulk-запросами к `cars` и `users`. Это работает медленнее на больших наборах, но проще и надёжнее.

4. **Write commands are curl recipes, not native**: `activate-rental`, `complete-rental`, `update-rental-status`, `send-rental-message` не реализованы как node-команды, потому что они требуют auth-context оператора (Telegram user_id) и вызова Next.js server-actions (которые регенерируют DOCX, шлют Telegram, обновляют related таблицы). Прямой PATCH в Supabase через curl — это **минимальная** версия без DOCX-регенерации. Для полной функциональности используйте UI или Next.js API endpoints.

5. **No pagination**: `list-rentals` показывает максимум `--limit` (default 100) аренд. Для больших списков увеличивать лимит или использовать `--status` / `--date` для фильтрации.

6. **No timezone conversion**: Все даты выводятся в ISO / UTC. Локализация в MSK (UTC+3) — на стороне вызывающего.

7. **Operator names hardcoded**: `OPERATOR_NAMES` map в начале файла. Если состав экипажа изменился — обновить map. Незнакомые `assigned_to` ID выводятся как `ID:<number>`.

8. **`metadata.history[]` only**: История статусов читается только из `rentals.metadata.history[]`, который ведётся server-action `updateRentalStatus`. Если аренда была создана/изменена в обход server-action (raw SQL), история может быть неполной.

9. **Verification todos lookup dual-path**: Сначала по FK `rental_id` (primary, миграция `20260720120200`), затем fallback по `description->>'rental_id'` для legacy rows. Это может привести к дубликатам, если оба пути совпадают — скрипт дедуплит по `crew_todos.id`.

10. **Messages are not stored in DB**: Сообщения арендатору идут через Telegram forward API и НЕ сохраняются в БД как строки. Поэтому в `rental-card` секция «Сообщения» показывает только hint как отправить новое. Для истории сообщений смотрите Telegram chat напрямую.

## Related Files

- **Script**: `rental-query.mjs` (этот skill)
- **Source of truth (server actions)**:
  - `app/franchize/actions-runtime.ts` — `getFranchizeRentalCard()` (primary fetcher, mirrors our `rental-card`)
  - `app/franchize/server-actions/rentals.ts` — `submitContractDraft`, `approveContract`, `declineContract`, `sendRentalMessage`, `getRentalReturnTodos`
  - `app/franchize/server-actions/rentals-dashboard.ts` — `updateRentalStatus`, `activateRental`, `getTodayRentalsAnalytics`, `getRentalsDashboard`
  - `app/franchize/server-actions/rental-activation.ts` — `activateRentalIfReady` (auto-activation when all verification todos done)
  - `app/franchize/server-actions/rental-verification-todos.ts` — `createRentalVerificationTodos`, `completeRentalVerificationTodo`, `checkAllTodosCompleted`, `getRentalVerificationTodos`
  - `app/franchize/server-actions/rental-handoffs.ts` — `getRentalHandoff`, `saveRentalHandoff`, `deleteRentalHandoff`
  - `app/franchize/server-actions/rental-secrets-claim.ts` — `claimRentalSecretsByDocSha` (QR claim → propagate to artifacts/todos/intents)
  - `app/franchize/lib/phone-utils.ts` — `normalizePhone()`
- **UI page (для справки, не используется скриптом)**:
  - `app/franchize/[slug]/rental/[id]/page.tsx` — React-страница карточки аренды
  - `app/franchize/[slug]/rental/[id]/` directory — client components (RentalChecklistPanel, RentalReturnChecklist, RentalMessageInput, FranchizeRentalLifecycleActions, FranchizeRentalDocumentsPanel)
- **Schema migrations**:
  - `20260304_private_scheme.sql` — private schema setup (`user_rental_secrets`, `rental_contract_artifacts`)
  - `20260601000000_user_rental_secrets.sql` — `user_rental_secrets` (id, chat_id, crew_slug, doc_sha256, renter_*)
  - `20260612000000_fix_rental_contract_artifacts.sql` — `rental_contract_artifacts` schema fix
  - `20260621000000_crew_todos.sql` — `crew_todos` table
  - `20260705000000_crew_todos_lead_id.sql` — `lead_id` column on crew_todos
  - `20260720120200_add_crew_todos_rental_id.sql` — `rental_id` FK column on crew_todos + `propagate_claim` RPC
  - `20260720120100_add_operator_chat_id.sql` — `created_by_operator_chat_id` on rentals/artifacts (для pre-claim detection)
  - `20260721150000_fix_claim_rental_rpc.sql` — RPC fix for QR claiming
  - `20260721160000_backfill_todos_artifacts.sql` — backfill `crew_todos.user_id` + `rental_contract_artifacts.rental_id`
  - `20260721170000_fix_backfill_chatid_and_jsonb.sql` — JSONB fixes for backfill
  - ⚠️ **`rental_handoffs` migration** — НЕ найдена в `/migrations/`; таблица может отсутствовать в production. См. раздел "Migration для `rental_handoffs`" выше для примерной схемы.
- **Crew constants**:
  - Crew slug: `vip-bike`
  - Crew ID: `2d5fde70-1dd3-4f0d-8d72-66ccf6908746`
  - Owner: `356282674` (I_O_S_NN)
  - Members: `244736261` (Roman), `413553377` (salavey13), `7813830016` (DJORUDJOV)
  - Секреты: `/home/z/my-project/upload/secrets.txt`
- **Web app base URL**: `https://vip-bike.ru/franchize/vip-bike/rental/<rentalId>` (production mirror of `/franchize/vip-bike/rental/<id>`)

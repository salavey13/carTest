---
name: contract-draft-text
description: >
  Text-based contract draft viewer for VIP Bike. Shows rental/sale contract artifacts,
  draft state, approval flow, STS pledge info. Queries Supabase REST API (curl),
  outputs formatted text. Read + submit draft + approve/decline.
  Trigger phrases (RU): "договор аренды", "контракт аренды", "драфт контракта",
  "черновик договора", "одобрить контракт", "отклонить контракт", "отправить контракт",
  "артефакт контракта", "STS pledge", "залог по СТС", "контракт продажи",
  "contract artifact".
  Trigger phrases (EN): "rental contract", "sale contract", "contract draft",
  "approve contract", "decline contract", "submit contract", "contract artifact",
  "STS pledge", "contract detail".
---

# Contract Draft (text) — VIP Bike

Триггер-фразы (RU): **`договор аренды`**, **`контракт аренды`**, **`драфт контракта`**, **`черновик договора`**, **`одобрить контракт`**, **`отклонить контракт`**, **`отправить контракт`**, **`артефакт контракта`**, **`STS pledge`**, **`залог по СТС`**, **`контракт продажи`**, `contract artifact`.
Триггер-фразы (EN): `rental contract`, `sale contract`, `contract draft`, `approve contract`, `decline contract`, `submit contract`, `contract artifact`, `STS pledge`, `contract detail`.

## Overview

Text-based эквивалент страницы `/franchize/vip-bike/contract-draft/[rentalId]`. Показывает contract artifacts (rental & sale), draft state, approval flow, STS pledge info, storage path. Поддерживает submit-draft (operator → client), approve/decline (client → operator через QR-claim).

## When to Use

Use this skill when:

- Нужно увидеть текущий contract artifact аренды (rental_contract_artifacts).
- Нужно увидеть contract artifact продажи (sale_contract_artifacts).
- Нужно проверить, одобрен ли контракт клиентом (verification_status).
- Нужно отправить драфт контракта на подписание (`submit-draft`).
- Нужно проверить STS pledge состояние (используется ли СТС как залог).
- Нужно просмотреть storage_path для скачивания DOCX.

## Supabase Access

```bash
SUPABASE_URL="https://inmctohsodgdohamhzag.supabase.co"
SUPABASE_SERVICE_ROLE_KEY="$(grep SUPABASE_SERVICE_ROLE_KEY /home/z/my-project/upload/secrets.txt | cut -d= -f2-)"
CREW_SLUG="vip-bike"
CREW_ID="2d5fde70-1dd3-4f0d-8d72-66ccf6908746"

OP_OWNER=356282674        # I_O_S_NN
OP_CO_OWNER=244736261     # Roman_Vip_Bike_Electro
OP_ADMIN=413553377        # salavey13
OP_MEMBER=7813830016      # DJORUDJOV

HDR_PUBLIC=(-H "apikey: ${SUPABASE_SERVICE_ROLE_KEY}" -H "Authorization: Bearer ${SUPABASE_SERVICE_ROLE_KEY}" -H "Accept: application/json")
HDR_PRIVATE=(-H "apikey: ${SUPABASE_SERVICE_ROLE_KEY}" -H "Authorization: Bearer ${SUPABASE_SERVICE_ROLE_KEY}" -H "Accept: application/json" -H "Accept-Profile: private" -H "Content-Profile: private")
```

## Commands

### 1. `rental-contract <rentalId>` — artifact аренды

```bash
RENTAL_ID="a1b2c3d4-e5f6-7890-abcd-ef1234567890"
curl -sS "${SUPABASE_URL}/rest/v1/rental_contract_artifacts?\
select=id,contract_key,requested_bike_id,resolved_bike_id,telegram_chat_id,\
renter_full_name,renter_phone,renter_passport,renter_passport_issued_by,renter_passport_issue_date,\
renter_registration,renter_driver_license,renter_birth_date,license_categories,\
rent_start_date,rent_end_date,daily_price,deposit_rub,total_sum,original_sha256,\
sts_pledge_used,sts_series,sts_number,sts_issue_date,sts_vehicle_plate,sts_vehicle_vin,\
sts_vehicle_model,sts_vehicle_year,sts_owner_full_name,sts_owner_registration,sts_owner_relation,\
sts_pledge_return_days,deposit_amount_skipped,rental_id,storage_path,crew_slug,\
created_by_operator_chat_id,created_at,template_version\
&rental_id=eq.${RENTAL_ID}&crew_slug=eq.${CREW_SLUG}\
&order=created_at.desc&limit=5" \
  "${HDR_PRIVATE[@]}"
```

**Пример вывода:**

```
=== Contract artifact для аренды a1b2c3d4-... ===
contract_key:       ra_vip-bike_2026-07-21_a1b2c3d4
rental_id:          a1b2c3d4-e5f6-7890-abcd-ef1234567890
crew_slug:          vip-bike
template_version:   3
создан:             21.07 14:35 (UTC)
created by:         413553377 (salavey13, admin)

— Рентер —
ФИО:                Логунов Егор Иванович
Телефон:            +7XXXXXXXX42 (masked)
Паспорт:            XXXX… (masked), выдан МВД РФ 15.06.2020
Регистрация:        г. Мо… (masked)
Водит. права:       XXXX… (masked), категории A, A1
Дата рождения:      1990

— Байк —
requested:          bmw-f800r-001
resolved:           bmw-f800r-001

— Аренда —
Даты:               25.07 10:00 — 27.07 20:00 (2 дня)
Цена/день:          7 000 ₽
Депозит:            30 000 ₽
Итого:              14 000 ₽

— STS pledge —
Используется:       нет (deposit_rub = 30 000 ₽ вместо STS)
STS series/number:  —
VIN:                —
Owner:              —

— Storage —
storage_path:       contracts/2026/07/ra_vip-bike_…_a1b2c3d4.docx
sha256:             abc123…
```

🌐 Web: `https://v0-car-test-salavey13s-projects.vercel.app/franchize/vip-bike/contract-draft/a1b2c3d4-e5f6-7890-abcd-ef1234567890`

---

### 2. `sale-contract <contractKey>` — artifact продажи

```bash
CONTRACT_KEY="sa_vip-bike_2026-07-21_xyz123"
curl -sS "${SUPABASE_URL}/rest/v1/sale_contract_artifacts?\
select=id,contract_key,requested_bike_id,resolved_bike_id,telegram_chat_id,\
buyer_full_name,buyer_passport_number,buyer_passport_issued_by,buyer_passport_issue_date,\
buyer_registration,buyer_email,buyer_phone,sale_price,price_words,warranty_months,\
total_sum,original_sha256,storage_path,crew_slug,created_at,template_version\
&contract_key=eq.${CONTRACT_KEY}&crew_slug=eq.${CREW_SLUG}" \
  "${HDR_PRIVATE[@]}"
```

**Пример вывода:**

```
=== Sale contract artifact ===
contract_key:       sa_vip-bike_2026-07-21_xyz123
crew_slug:          vip-bike
template_version:   2
создан:             21.07 14:35 (UTC)

— Покупатель —
ФИО:                Иванов Иван Иванович
Телефон:            +7XXXXXXXX42 (masked)
Email:              i…@example.com (masked)
Паспорт:            XXXX… (masked), выдан МВД РФ 15.06.2020
Регистрация:        г. Мо… (masked)

— Байк —
requested:          falcon-lynx
resolved:           falcon-lynx (79BIKE Falcon Lynx)

— Продажа —
Цена:               390 000 ₽
Цена словами:       Триста девяносто тысяч рублей
Гарантия:           12 месяцев
Итого:              390 000 ₽

— Storage —
storage_path:       contracts/2026/07/sa_vip-bike_…_xyz123.docx
sha256:             def456…
```

🌐 Web: `https://v0-car-test-salavey13s-projects.vercel.app/franchize/vip-bike/market/falcon-lynx/buy`

---

### 3. `list-contracts [--type rental|sale] [--limit N]` — список контрактов

```bash
# Rental contracts
curl -sS "${SUPABASE_URL}/rest/v1/rental_contract_artifacts?\
select=id,contract_key,rental_id,renter_full_name,renter_phone,total_sum,created_at,sts_pledge_used\
&crew_slug=eq.${CREW_SLUG}\
&order=created_at.desc&limit=20" \
  "${HDR_PRIVATE[@]}"

# Sale contracts
curl -sS "${SUPABASE_URL}/rest/v1/sale_contract_artifacts?\
select=id,contract_key,buyer_full_name,buyer_phone,sale_price,total_sum,created_at\
&crew_slug=eq.${CREW_SLUG}\
&order=created_at.desc&limit=20" \
  "${HDR_PRIVATE[@]}"
```

**Пример вывода:**

```
=== Rental contracts vip-bike (20 последних) ===
contract_key                rental_id    Рентер              Сумма       STS   Создан
ra_vip-bike_2026-07-21_…    a1b2c3d4-…   Логунов Е.          14 000 ₽    нет   21.07 14:35
ra_vip-bike_2026-07-20_…    b2c3d4e5-…   Закиров А.          12 000 ₽    да    20.07 11:20
...

=== Sale contracts vip-bike (5 последних) ===
contract_key                Покупатель       Цена          Создан
sa_vip-bike_2026-07-21_…    Иванов И.        390 000 ₽     21.07 14:32
sa_vip-bike_2026-07-20_…    Петров П.        280 000 ₽     20.07 10:15
...
```

🌐 Web: `https://v0-car-test-salavey13s-projects.vercel.app/franchize/vip-bike/contract-draft`

---

### 4. `submit-draft <rentalId>` — отправить драфт контракта клиенту

```bash
RENTAL_ID="a1b2c3d4-e5f6-7890-abcd-ef1234567890"
ACTOR="${OP_ADMIN}"  # кто отправляет

# 1. Найти contract_key
CONTRACT_KEY=$(curl -sS "${SUPABASE_URL}/rest/v1/rental_contract_artifacts?\
select=contract_key\
&rental_id=eq.${RENTAL_ID}&crew_slug=eq.${CREW_SLUG}\
&order=created_at.desc&limit=1" \
  "${HDR_PRIVATE[@]}" | jq -r '.[0].contract_key')

# 2. PATCH: установить draft submitted state (через server-action submit-contract-draft.ts)
# В CLI- версии просто показываем, что нужно вызвать server-action:
echo "Submit draft via server action:"
echo "  submitContractDraft({ contractKey: '${CONTRACT_KEY}', actorChatId: '${ACTOR}' })"
echo ""
echo "Или через Supabase Edge Function:"
curl -sS -X POST "${SUPABASE_URL}/functions/v1/submit-contract-draft" \
  -H "apikey: ${SUPABASE_SERVICE_ROLE_KEY}" \
  -H "Authorization: Bearer ${SUPABASE_SERVICE_ROLE_KEY}" \
  -H "Content-Type: application/json" \
  -d "{\"contractKey\":\"${CONTRACT_KEY}\",\"actorChatId\":\"${ACTOR}\"}"
```

**Логика:** `submit-contract-draft` server-action генерирует QR-ссылку для клиента и отправляет её в Telegram-чат `telegram_chat_id` артефакта. После принятия QR-claim клиентом, `user_rental_secrets.qr_claimed_at` заполняется — это означает одобрение.

**Пример вывода:**

```
✓ Драфт контракта отправлен
  contract_key:    ra_vip-bike_2026-07-21_a1b2c3d4
  rental_id:       a1b2c3d4-e5f6-7890-abcd-ef1234567890
  renter chat_id:  78901234
  sent by:         413553377 (salavey13, admin)
  sent at:         2026-07-21T23:50:00.000Z

Клиент получит QR-ссылку в Telegram. После принятия — contract одобрен.
```

🌐 Web: `https://v0-car-test-salavey13s-projects.vercel.app/franchize/vip-bike/contract-draft/a1b2c3d4-e5f6-7890-abcd-ef1234567890`

---

### 5. `approve-contract <contractKey>` / `decline-contract <contractKey>` — одобрить/отклонить

```bash
CONTRACT_KEY="ra_vip-bike_2026-07-21_a1b2c3d4"

# Approve (через server-action)
curl -sS -X POST "${SUPABASE_URL}/functions/v1/approve-contract" \
  -H "apikey: ${SUPABASE_SERVICE_ROLE_KEY}" \
  -H "Authorization: Bearer ${SUPABASE_SERVICE_ROLE_KEY}" \
  -H "Content-Type: application/json" \
  -d "{\"contractKey\":\"${CONTRACT_KEY}\"}"

# Decline
curl -sS -X POST "${SUPABASE_URL}/functions/v1/decline-contract" \
  -H "apikey: ${SUPABASE_SERVICE_ROLE_KEY}" \
  -H "Authorization: Bearer ${SUPABASE_SERVICE_ROLE_KEY}" \
  -H "Content-Type: application/json" \
  -d "{\"contractKey\":\"${CONTRACT_KEY}\",\"reason\":\"documents_invalid\"}"
```

**Логика:** Approve/decline через server-actions `approve-contract.ts` / `decline-contract.ts`. Approve устанавливает `verification_status='verified'` в `user_rental_secrets`. Decline — `verification_status='revoked'` + `metadata.declineReason`.

**Пример вывода (approve):**

```
✓ Контракт одобрен
  contract_key:        ra_vip-bike_2026-07-21_a1b2c3d4
  verification_status: verified
  approved at:         2026-07-21T23:55:00.000Z
```

**Пример вывода (decline):**

```
✗ Контракт отклонён
  contract_key:        ra_vip-bike_2026-07-21_a1b2c3d4
  verification_status: revoked
  reason:              documents_invalid
  declined at:         2026-07-21T23:55:00.000Z
```

🌐 Web: `https://v0-car-test-salavey13s-projects.vercel.app/franchize/vip-bike/contract-draft`

---

### 6. `sts-pledge <rentalId>` — состояние STS pledge

```bash
RENTAL_ID="a1b2c3d4-e5f6-7890-abcd-ef1234567890"
curl -sS "${SUPABASE_URL}/rest/v1/rental_contract_artifacts?\
select=id,contract_key,sts_pledge_used,sts_series,sts_number,sts_issue_date,\
sts_vehicle_plate,sts_vehicle_vin,sts_vehicle_model,sts_vehicle_year,\
sts_owner_full_name,sts_owner_registration,sts_owner_relation,sts_pledge_return_days,\
deposit_amount_skipped\
&rental_id=eq.${RENTAL_ID}&crew_slug=eq.${CREW_SLUG}\
&order=created_at.desc&limit=1" \
  "${HDR_PRIVATE[@]}"
```

**Логика:** STS (Свидетельство о регистрации ТС) pledge — альтернатива денежному залогу. Клиент оставляет СТС своего ТС как залог. `sts_pledge_used=true` → `deposit_amount_skipped` (залог не берётся).

**Пример вывода:**

```
=== STS Pledge для аренды a1b2c3d4-... ===
Используется:        да
STS series/number:   12 34 567890
Issue date:          15.06.2020
Vehicle plate:       А123БВ77
VIN:                 XYZ1234567890ABC
Vehicle model:       Toyota Camry 2018
Vehicle year:        2018
STS owner:           Логунов Иван Иванович (отец)
Owner relation:      отец
Pledge return days:  3 (после возврата байка)
Deposit skipped:     30 000 ₽ (вместо денежного залога)

⚠️ Клиент оставил СТС как залог. Вернуть в течение 3 дней после завершения аренды.
```

🌐 Web: `https://v0-car-test-salavey13s-projects.vercel.app/franchize/vip-bike/contract-draft/a1b2c3d4-e5f6-7890-abcd-ef1234567890`

---

## Schema Access

### Public schema

- `rentals` — `rental_id` (uuid PK), `user_id`, `vehicle_id`, `status`, `total_cost`, `crew_id`, `created_by_operator_chat_id`. Используется для резолва `rental_id` → contract.

### Private schema (requires `Accept-Profile: private` AND `Content-Profile: private` for writes)

- `rental_contract_artifacts` — PII. `id`, `contract_key`, `requested_bike_id`, `resolved_bike_id`, `telegram_chat_id`, `telegram_message_id`, `renter_full_name`, `renter_passport`, `renter_passport_issued_by`, `renter_passport_issue_date`, `renter_registration`, `renter_driver_license`, `renter_birth_date`, `license_categories`, `rent_start_date`, `rent_end_date`, `daily_price`, `deposit_rub`, `total_sum`, `original_sha256`, `doc_verifier_id`, `template_version`, `sts_pledge_used`, `sts_series`, `sts_number`, `sts_issue_date`, `sts_vehicle_plate`, `sts_vehicle_vin`, `sts_vehicle_model`, `sts_vehicle_year`, `sts_owner_full_name`, `sts_owner_registration`, `sts_owner_relation`, `sts_pledge_return_days`, `deposit_amount_skipped`, `rental_id`, `storage_path`, `crew_slug`, `renter_phone`, `created_by_operator_chat_id`, `created_at`.
- `sale_contract_artifacts` — PII. `id`, `contract_key`, `requested_bike_id`, `resolved_bike_id`, `telegram_chat_id`, `telegram_message_id`, `buyer_full_name`, `buyer_passport_number`, `buyer_passport_issued_by`, `buyer_passport_issue_date`, `buyer_registration`, `buyer_email`, `sale_price` (text formatted `"390 000"`), `price_words`, `warranty_months` (default `"12"`), `original_sha256`, `template_version`, `total_sum`, `storage_path`, `crew_slug`, `buyer_phone`, `created_at`.
- `user_rental_secrets` — PII. `verification_status` (`verified` / `pending` / `revoked`), `qr_generated_at`, `qr_first_viewed_at`, `qr_claimed_at`, `source_rental_id`, `chat_id`, `crew_slug`. Используется для проверки approval state.

## Web Links

| Command            | Web page                                                                                                                |
|--------------------|-------------------------------------------------------------------------------------------------------------------------|
| `rental-contract`  | https://v0-car-test-salavey13s-projects.vercel.app/franchize/vip-bike/contract-draft/<rentalId>                         |
| `sale-contract`    | https://v0-car-test-salavey13s-projects.vercel.app/franchize/vip-bike/market/<bikeId>/buy                               |
| `list-contracts`   | https://v0-car-test-salavey13s-projects.vercel.app/franchize/vip-bike/contract-draft                                    |
| `submit-draft`     | https://v0-car-test-salavey13s-projects.vercel.app/franchize/vip-bike/contract-draft/<rentalId>                         |
| `approve-contract` | https://v0-car-test-salavey13s-projects.vercel.app/franchize/vip-bike/contract-draft/<rentalId>                         |
| `decline-contract` | https://v0-car-test-salavey13s-projects.vercel.app/franchize/vip-bike/contract-draft/<rentalId>                         |
| `sts-pledge`       | https://v0-car-test-salavey13s-projects.vercel.app/franchize/vip-bike/contract-draft/<rentalId>                         |

## Anti-hallucination: флаги, которых НЕ существует

- ~~`--json`~~ — не существует. Только текст.
- ~~`--includePii`~~ — не существует. Паспорт/права/адрес/СТС всегда маскируются в stdout.
- ~~`--downloadDocx`~~ — не существует. Для скачивания DOCX используйте `curl` напрямую с `storage_path` через Supabase Storage API.
- ~~`--set-sts-pledge`~~ — не существует. Установка STS pledge — через `submit-contract-draft` server-action с параметрами STS.
- ~~`--regenerate`~~ — не существует. Регенерация контракта — через `submit-contract-draft` повторно (создаёт новый artifact).
- ~~`--outFile <path>`~~ — не существует. Используйте `> file.txt`.
- ~~`--format csv|md`~~ — не существует.
- ~~`--crew <slug>`~~ — не существует. Crew захардкожен как `vip-bike`.
- ~~`--template-version <N>`~~ — не существует. Версия шаблона выбирается автоматически в server-action.
- ~~`submit-draft --dry-run`~~ — не существует. Все вызовы реально отправляют QR в Telegram.

## Error Handling

| Stage                  | Reason                                  | Когда возникает                                                       | Exit | Что делать                                       |
|------------------------|-----------------------------------------|-----------------------------------------------------------------------|------|--------------------------------------------------|
| `secrets_load`         | `SUPABASE_SERVICE_ROLE_KEY not found`   | Путь `/home/z/my-project/upload/secrets.txt` недоступен              | 2    | Проверить путь или export env                    |
| `rental_not_found`     | `Rental not found: <rentalId>`          | `rental-contract` — нет аренды с таким `rental_id`                    | 2    | Проверить ID через `rental-card-text`            |
| `contract_not_found`   | `No contract artifact for rental`       | Аренда есть, но artifact не создан                                    | 0    | Вывод: `Contract artifact: — (не сгенерирован). Используйте submit-draft.` |
| `contract_key_invalid` | `Invalid contract_key: <key>`           | `sale-contract` — нет такого `contract_key`                           | 2    | Проверить `list-contracts --type sale`           |
| `private_404`          | `404 for private.<table>`               | Не передан `Accept-Profile: private` header                           | 2    | Добавить header                                  |
| `supabase_4xx`         | `Supabase <table> 4xx: <body>`          | Неверный select, RLS                                                  | 2    | Проверить схему (раздел "Schema Access")         |
| `supabase_5xx`         | `Supabase <table> 5xx: <body>`          | Supabase лежит                                                        | 2    | Повторить через минуту                           |
| `submit_no_artifact`   | `Cannot submit — no artifact exists`    | `submit-draft` вызван до создания artifact                            | 2    | Сначала создайте artifact через `submit-contract-draft` server-action |
| `submit_no_telegram`   | `No telegram_chat_id on artifact`       | У артефакта нет `telegram_chat_id` (клиент не привязал Telegram)      | 2    | Привязать chat_id через rental-card-text         |
| `approve_already`      | `Contract already verified`             | `approve-contract` на уже одобренном контракте                        | 0    | Вывод: `Контракт уже одобрен ранее.`             |
| `decline_invalid_reason` | `Invalid decline reason`              | `decline-contract` с неверной причиной                                | 2    | Использовать `documents_invalid` / `renter_refused` / `other` |

## Security

- **Service role key** — полный read/write. Никогда не коммитить, не логировать, не передавать как URL-параметр. Только header.
- **PII masking** (обязательно для всех PII полей в stdout):
  - Паспорт (renter_passport, buyer_passport_number) → `XXXX 1234…` (первые 4 символа серии + `…`).
  - Водительское удостоверение (renter_driver_license) → `XXXX…`.
  - Регистрация (renter_registration, buyer_registration) → `г. Мо…` (первые 4 символа + `…`).
  - Телефон (renter_phone, buyer_phone) → `+7XXXXXXXX42` (первые 4 + `…`).
  - Email (buyer_email) → `i…@example.com`.
  - ФИО → фамилия с инициалами в публичных чатах.
  - Дата рождения → только год (`1990`).
  - STS (vin, plate, owner_full_name) — показывать полностью только в приватном operator chat (для сверки при возврате). В публичных чатах — маскировать.
- **Private schema headers**: для `rental_contract_artifacts`, `sale_contract_artifacts`, `user_rental_secrets` обязательны `Accept-Profile: private` (для GET) И `Content-Profile: private` (для PATCH/INSERT). Без них PostgREST вернёт 404.
- **storage_path**: путь к DOCX в Supabase Storage. Не выводить в публичных чатах (можно сгенерировать signed URL для скачивания).
- **original_sha256**: хеш исходного документа. Используется для верификации целостности. Не маскируется.
- Skill делает POST только в `submit-draft` / `approve-contract` / `decline-contract` (через server-actions). Остальные команды — read-only.
- Все HTTP-запросы — HTTPS.

## Related Files

**Sibling text skills:**

- `/home/z/my-project/download/skills/leads-crm-text/SKILL.md` — leads CRM (contract stage in pipeline)
- `/home/z/my-project/download/skills/analytics-text/SKILL.md` — analytics (sales-dashboard uses sale_contract_artifacts)
- `/home/z/my-project/download/skills/franchize-catalog-text/SKILL.md` — bike catalog (resolved_bike_id resolution)
- `/home/z/my-project/download/skills/rental-card-text/SKILL.md` — rental card (rental_contract_artifacts link)
- `/home/z/my-project/download/skills/crew-management-text/SKILL.md` — crew management (operator creates contracts)
- `/home/z/my-project/download/skills/rider-profile-text/SKILL.md` — rider profile (renter info from artifacts)
- `/home/z/my-project/download/skills/reviews-text/SKILL.md` — reviews (after contract completed)
- `/home/z/my-project/download/skills/orders-checkout-text/SKILL.md` — orders/checkout (sale contracts from orders)
- `/home/z/my-project/download/skills/crew-admin-text/SKILL.md` — admin (contract approval workflow)
- `/home/z/my-project/download/skills/leaderboard-text/SKILL.md` — leaderboard
- `/home/z/my-project/download/skills/crew-info-text/SKILL.md` — crew info
- `/home/z/my-project/download/skills/vip-bike-ops/SKILL.md` — umbrella meta-skill

**Server actions (source of truth):**

- `app/franchize/server-actions/submit-contract-draft.ts`
- `app/franchize/server-actions/approve-contract.ts`
- `app/franchize/server-actions/decline-contract.ts`
- `app/franchize/server-actions/rental-secrets-claim.ts` — QR claim flow
- `app/franchize/lib/rental-contract-types.ts` — contract types
- `app/franchize/lib/rental-contract-vars.ts` — contract variables
- `app/franchize/lib/docx-capability.ts` — DOCX generation
- `app/lib/rental-contract-vars.ts` — contract variable resolver

**Schema migrations:**

- `20260304_private_scheme.sql` — private schema setup
- `20260612000000_fix_rental_contract_artifacts.sql` — rental_contract_artifacts schema fix
- `20260607000000_create_sale_contract_artifacts.sql` — sale_contract_artifacts table
- `20260720120100_add_operator_chat_id.sql` — `created_by_operator_chat_id` on artifacts

**UI references:**

- `app/franchize/[slug]/contract-draft/[rentalId]/page.tsx` — contract draft page
- `app/franchize/[slug]/market/[bike_id]/buy/page.tsx` — sale contract flow

**Secrets:**

- `/home/z/my-project/upload/secrets.txt`
- `/home/z/my-project/upload/supabase.txt`

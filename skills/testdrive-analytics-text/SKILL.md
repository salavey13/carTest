---
name: testdrive-analytics-text
description: >
  Text-based testdrive analytics for VIP Bike. Mirrors the testdrive data
  from private.testdrive_contract_artifacts. List testdrives, KPIs, detail,
  conversion tracking (testdrive → rental), stats.
  Trigger phrases: "тест-драйвы", "тест драйвы", "кто тест-драйвил",
  "kpi тест-драйвов", "детали тест-драйва", "конверсия тест-драйвов",
  "testdrives today", "testdrive kpis", "testdrive detail", "testdrive stats",
  "testdrive list", "testdrive conversion".
---

# testdrive-analytics-text

Триггер-фразы: **`тест-драйвы`**, **`тест драйвы`**, **`кто тест-драйвил`**, **`kpi тест-драйвов`**, **`детали тест-драйва`**, **`конверсия тест-драйвов`**, **`testdrives today`**, **`testdrive kpis`**, **`testdrive detail`**, **`testdrive stats`**, **`testdrive list`**, **`testdrive conversion`**

## Supabase Access
- URL: https://inmctohsodgdohamhzag.supabase.co
- Key: from /home/z/my-project/upload/secrets.txt (SUPABASE_SERVICE_ROLE_KEY=)
- Crew: vip-bike, slug: vip-bike, ID: 2d5fde70-1dd3-4f0d-8d72-66ccf6908746
- Private schema: `testdrive_contract_artifacts` lives in `private` schema — `Accept-Profile: private` header required

## Web UI mirror

Mirrors the testdrive data visible on `/franchize/vip-bike/leads` (testdrive
leads have `intentType: "test_drive"` and a purple "Тест-драйв" badge).
Testdrives are free 10-minute rides — no rental period, no deposit.

KPI row for testdrives (computed for selected date):
- **Тест-драйвов сегодня** — count of testdrive_contract_artifacts with `created_at` on the date
- **Уникальных клиентов** — count of distinct `customer_phone` (or `customer_full_name` if phone is null)
- **С QR** — count where `telegram_chat_id != created_by_operator_chat_id` (renter has scanned QR → claimed)
- **Без QR** — count where `telegram_chat_id = created_by_operator_chat_id` (renter hasn't scanned yet)

Status color whitelist:
- 🟣 `#8b5cf6` testdrive accent (purple — matches leads page badge)
- 🟢 `#22c55e` claimed (renter scanned QR)
- 🟡 `#f59e0b` pending (renter hasn't scanned QR yet)

## Commands

### 1. testdrives-list [--date YYYY-MM-DD]
All testdrives for a date. Mirrors testdrive lead cards on /leads page.

```bash
DATE="${1:-$(TZ=Europe/Moscow date +%Y-%m-%d)}"
START="${DATE}T00:00:00Z"; END="${DATE}T23:59:59Z"
curl -s "$URL/rest/v1/testdrive_contract_artifacts?select=id,customer_full_name,customer_phone,resolved_bike_id,testdrive_date,created_at,created_by_operator_chat_id,telegram_chat_id,license_categories&crew_slug=eq.vip-bike&created_at=gte.${START}&created_at=lte.${END}&order=created_at.desc" \
  -H "apikey: $KEY" -H "Authorization: Bearer $KEY" -H "Accept-Profile: private"
```

Output per card (matches testdrive lead card on /leads):
- Bike title: join `cars` on `resolved_bike_id` → `make + " " + model`
- Customer ФИО: `customer_full_name`
- Phone: `customer_phone` (masked: +7XXXXXXXX42)
- Time: `created_at` formatted as HH:ММ
- QR badge: `✅ Claimed` (renter scanned) or `⏳ Pending` (operator only)
- License categories: `license_categories` (e.g. "B, A, M")

### 2. testdrive-kpis [--date YYYY-MM-DD]
Returns the 4 KPI cards for the date.

```bash
DATE="${1:-$(TZ=Europe/Moscow date +%Y-%m-%d)}"
START="${DATE}T00:00:00Z"; END="${DATE}T23:59:59Z"
curl -s "$URL/rest/v1/testdrive_contract_artifacts?select=id,customer_phone,customer_full_name,telegram_chat_id,created_by_operator_chat_id&crew_slug=eq.vip-bike&created_at=gte.${START}&created_at=lte.${END}" \
  -H "apikey: $KEY" -H "Authorization: Bearer $KEY" -H "Accept-Profile: private"
```

Output format:
```
📊 KPI тест-драйвов за 2026-08-09:
   Тест-драйвов сегодня: 3
   Уникальных клиентов: 3
   С QR (claimed): 2
   Без QR (pending): 1
```

### 3. testdrive-detail <testdriveId>
Full detail of a testdrive (mirrors lead detail drawer for test_drive intents).

```bash
curl -s "$URL/rest/v1/testdrive_contract_artifacts?select=*,vehicle:cars!testdrive_contract_artifacts_resolved_bike_id_fkey(make,model,type)&id=eq.${testdriveId}" \
  -H "apikey: $KEY" -H "Authorization: Bearer $KEY" -H "Accept-Profile: private"
```

Sections (in order):
1. **Header** — bike title, customer ФИО, testdrive date
2. **Customer info** — phone, passport (masked), driver license (masked), birth date, registration
3. **License** — categories, series/number (masked)
4. **QR status** — claimed (renter scanned) or pending (operator only)
5. **Crew context** — crew_slug, created_by_operator_chat_id, storage_path (DOCX link)

### 4. testdrive-conversion [--from YYYY-MM-DD] [--to YYYY-MM-DD]
Conversion rate: how many testdrive customers later did a real rental.

```bash
# Step 1: Get all testdrives in the period
FROM="${1:-$(date -u -d '30 days ago' +%Y-%m-%d)}"
TO="${2:-$(date -u +%Y-%m-%d)}"
TESTDRIVES=$(curl -s "$URL/rest/v1/testdrive_contract_artifacts?select=id,customer_phone,customer_full_name,telegram_chat_id&crew_slug=eq.vip-bike&created_at=gte.${FROM}T00:00:00Z&created_at=lte.${TO}T23:59:59Z" \
  -H "apikey: $KEY" -H "Authorization: Bearer $KEY" -H "Accept-Profile: private")

# Step 2: For each testdrive customer, check if they have a rental
# Match by phone (normalized) or telegram_chat_id
echo "$TESTDRIVES" | jq -r '.[] | .customer_phone' | while read -r phone; do
  if [[ -n "$phone" ]]; then
    RENTALS=$(curl -s "$URL/rest/v1/rentals?select=rental_id&crew_id=eq.${CREW_ID}&or=(metadata->>renter_phone.eq.${phone})" \
      -H "apikey: $KEY" -H "Authorization: Bearer $KEY")
    echo "$phone: $(echo "$RENTALS" | jq 'length')"
  fi
done
```

Output format:
```
📈 Конверсия тест-драйвов в аренды (30 дней):
   Всего тест-драйвов: 12
   Сделали аренду после: 4
   Конверсия: 33%
```

### 5. testdrive-stats [--from YYYY-MM-DD] [--to YYYY-MM-DD]
Aggregate stats over a period.

```bash
FROM="${1:-$(date -u -d '30 days ago' +%Y-%m-%d)}"
TO="${2:-$(date -u +%Y-%m-%d)}"
curl -s "$URL/rest/v1/testdrive_contract_artifacts?select=id,customer_phone,telegram_chat_id,created_by_operator_chat_id,resolved_bike_id&crew_slug=eq.vip-bike&created_at=gte.${FROM}T00:00:00Z&created_at=lte.${TO}T23:59:59Z" \
  -H "apikey: $KEY" -H "Authorization: Bearer $KEY" -H "Accept-Profile: private"
```

Output format:
```
📊 Статистика тест-драйвов за 30 дней:
   Всего: 45
   Уникальных клиентов: 38
   Среднее в день: 1.5
   Конверсия в аренду: 27%
   Топ байк: Falkon GT (12 тест-драйвов)
   QR claim rate: 67%
```

## Composite queries

**"Полная сводка за день"** now includes testdrives (4 аналитических навыка):
1. `rental-analytics-text rental-kpis --date <today>` — 4 KPI по арендам
2. `sale-analytics-text sale-kpis --date <today>` — 4 KPI по продажам
3. `service-analytics-text service-kpis --date <today>` — 4 KPI по сервису
4. `testdrive-analytics-text testdrive-kpis --date <today>` — 4 KPI по тест-драйвам

**"Сколько заработали за месяц?"** now includes testdrives (конверсия):
1. `rental-analytics-text rentals-day --date <30d-ago>` (агрегируй по дню)
2. `sale-analytics-text sale-stats --from <30d-ago> --to <today>`
3. `service-analytics-text service-stats --from <30d-ago> --to <today>`
4. `testdrive-analytics-text testdrive-conversion --from <30d-ago> --to <today>`

## Notes

- Testdrives are stored in `private.testdrive_contract_artifacts` (NOT `rental_contract_artifacts`)
- The `telegram_chat_id` column starts as the operator's chat_id and is updated to the renter's chat_id when they scan the QR (via `claim_testdrive_by_qr` RPC)
- `created_by_operator_chat_id` is preserved forever — never overwritten
- Testdrives are free (`total_sum = 0`) — they don't contribute to revenue
- The conversion metric (testdrive → rental) is the key business KPI for this flow

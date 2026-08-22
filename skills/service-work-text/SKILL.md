---
name: service-work-text
description: >
  Log performed service work and add new service items to the VIP Bike catalog.
  Two modes: (1) "add service position" → INSERT into public.cars with type=service;
  (2) "performed service work" → INSERT into public.rentals for a service — the
  record shows up in evening-summary digest and Сервис KPIs on the dashboard.
  Trigger phrases: "добавь позицию в сервис", "новая услуга в сервис",
  "выполняю работу в сервисе", "сделал работу в сервисе", "сделал работу в сервис",
  "логируй сервисную работу", "работа в сервисе", "add service position",
  "log service work", "performed service", "service work done".
---

# service-work-text

Триггер-фразы: **`добавь позицию в сервис`**, **`новая услуга в сервис`**, **`выполняю работу в сервисе`**, **`сделал работу в сервисе`**, **`сделал работу в сервис`**, **`логируй сервисную работу`**, **`работа в сервисе`**, **`add service position`**, **`log service work`**, **`performed service`**, **`service work done`**

## Supabase Access

- URL: `https://inmctohsodgdohamhzag.supabase.co` (или `process.env.SUPABASE_URL`)
- Key: `process.env.SUPABASE_SERVICE_ROLE_KEY` (service role — full write)
- Crew slug: `vip-bike`
- Crew ID: `2d5fde70-1dd3-4f0d-8d72-66ccf6908746`
- Owner / operator chat_id: `356282674` (Илья I.O.S. — `users.user_id='356282674'`)
- У services `make='VIP_BIKE'`, `type='service'`, `specs={"service":true,"subtype":"service","dailyPrice":N}`
- ID pattern: `vip-bike-svc-XXX` (3-значный, инкрементальный)

```bash
# Source env at the top of every command block:
set -a && source .env && set +a
URL="$SUPABASE_URL"
KEY="$SUPABASE_SERVICE_ROLE_KEY"
CREW_ID="2d5fde70-1dd3-4f0d-8d72-66ccf6908746"
OWNER_ID="356282674"
```

## Когда какой режим

| Оператор говорит | Режим | Что делает |
|---|---|---|
| «добавь позицию в сервис», «новая услуга X за Y» | **add-service-position** | INSERT в `cars` (type=service) |
| «выполняю работу в сервисе 'X'», «сделал работу в сервисе» | **log-service-work** | INSERT в `rentals` (status=completed) — попадает в вечерний digest |

Если оператор назвал И услугу И что она сделана сегодня — это **log-service-work** (с созданием услуги, если её ещё нет в каталоге).

## Режим 1: add-service-position

Оператор даёт: **название** услуги + **цену** (₽).

### Шаг 1. Найти следующий свободный `vip-bike-svc-XXX`

```bash
NEXT_NUM=$(curl -s "$URL/rest/v1/cars?select=id&crew_id=eq.$CREW_ID&type=eq.service&id=like.vip-bike-svc-*" \
  -H "apikey: $KEY" -H "Authorization: Bearer $KEY" \
  | jq -r '[.[].id | ltrimstr("vip-bike-svc-") | tonumber] | max // 0 | . + 1' \
  | xargs printf "%03d")
NEW_ID="vip-bike-svc-${NEXT_NUM}"
echo "Next free id: $NEW_ID"
```

### Шаг 2. Проверить, что такого названия ещё нет

```bash
# ilike.*<token>* — ищет вхождение ключевого слова в model
curl -s "$URL/rest/v1/cars?crew_id=eq.$CREW_ID&type=eq.service&model=ilike.*${KEYWORD}*&select=id,model,daily_price" \
  -H "apikey: $KEY" -H "Authorization: Bearer $KEY" | jq
```

Если нашлось — НЕ дублируем, используем существующий `id`.

### Шаг 3. INSERT

```bash
curl -s -X POST "$URL/rest/v1/cars" \
  -H "apikey: $KEY" -H "Authorization: Bearer $KEY" \
  -H "Content-Type: application/json" \
  -H "Prefer: return=representation" \
  -d "{
    \"id\": \"${NEW_ID}\",
    \"make\": \"VIP_BIKE\",
    \"model\": \"${SERVICE_NAME}\",
    \"description\": \"${DESCRIPTION:-${SERVICE_NAME}}\",
    \"daily_price\": ${PRICE},
    \"image_url\": \"\",
    \"rent_link\": \"https://t.me/I_O_S_NN\",
    \"is_test_result\": false,
    \"specs\": {\"service\": true, \"subtype\": \"service\", \"dailyPrice\": ${PRICE}},
    \"type\": \"service\",
    \"crew_id\": \"${CREW_ID}\",
    \"availability_rules\": {},
    \"quantity\": 1
  }" | jq '.[0] | {id, make, model, daily_price, type}'
```

### Шаг 4. Ответ оператору

```
✅ Добавил услугу в каталог
• vip-bike-svc-011 · Сборка байка · 1 250 ₽
```

## Режим 2: log-service-work

Оператор даёт: **название услуги** (или id) + **цену** + (опционально) **на каком байке** + (опционально) **дата** (по умолчанию сегодня).

### Шаг 1. Найти услугу в каталоге (fuzzy по model)

```bash
# q — название из фразы оператора ("Сборка байка", "замена масла" и т.д.)
SVC=$(curl -s "$URL/rest/v1/cars?crew_id=eq.$CREW_ID&type=eq.service&select=id,model,daily_price" \
  -H "apikey: $KEY" -H "Authorization: Bearer $KEY" \
  | jq -r --arg q "${SERVICE_NAME,,}" '
      [.[] | select((.model // "") | ascii_downcase | test($q))] 
      | if length > 0 then .[0] else empty end')

if [[ -z "$SVC" ]]; then
  echo "NOT_FOUND — спросить оператора: создать новую услугу за эту цену?"
  # Если оператор согласился — выполнить Режим 1, потом продолжить с шага 2.
fi
SVC_ID=$(echo "$SVC" | jq -r .id)
SVC_DEFAULT_PRICE=$(echo "$SVC" | jq -r .daily_price)
```

### Шаг 2. Определить параметры записи

- `total_cost` — цена. Если оператор не назвал — берём `daily_price` из каталога.
- `bike` — slug байка (falcon-gt, ducati-panigale-…). Если не назван — не кладём в metadata.
- `date` — по умолчанию сегодня (МСК). Диапазон `agreed_start_date..agreed_end_date` = один час в середине дня.
- `user_id` / `owner_id` = `356282674` (внутренняя работа, оператор сам заказчик).
- `status` = `completed` (работа уже выполнена), `payment_status` = `fully_paid`.

### Шаг 3. INSERT в rentals

```bash
# Московский сегодня (дата может быть передана оператором явно)
SVC_DATE="${SVC_DATE:-$(TZ=Europe/Moscow date +%Y-%m-%d)}"
START_ISO="${SVC_DATE}T10:00:00+00:00"
END_ISO="${SVC_DATE}T11:00:00+00:00"
NOW_ISO=$(date -u +%Y-%m-%dT%H:%M:%SZ)

# Metadata: bike кладётся только если есть
META=$(jq -nc --arg src "service_work" --arg by "service-work-text" \
                  --arg name "${SERVICE_NAME}" --arg bike "${BIKE_SLUG:-}" \
                  --arg performed "$NOW_ISO" \
                  '{source:$src, created_by:$by, service_name:$name, performed_at:$performed} 
                   + (if $bike != "" then {bike:$bike} else {} end)')

curl -s -X POST "$URL/rest/v1/rentals" \
  -H "apikey: $KEY" -H "Authorization: Bearer $KEY" \
  -H "Content-Type: application/json" \
  -H "Prefer: return=representation" \
  -d "{
    \"user_id\": \"${OWNER_ID}\",
    \"vehicle_id\": \"${SVC_ID}\",
    \"owner_id\": \"${OWNER_ID}\",
    \"crew_id\": \"${CREW_ID}\",
    \"status\": \"completed\",
    \"payment_status\": \"fully_paid\",
    \"total_cost\": ${TOTAL_COST},
    \"requested_start_date\": \"${START_ISO}\",
    \"requested_end_date\": \"${END_ISO}\",
    \"agreed_start_date\": \"${START_ISO}\",
    \"agreed_end_date\": \"${END_ISO}\",
    \"created_by_operator_chat_id\": \"${OWNER_ID}\",
    \"metadata\": ${META}
  }" | jq '.[0] | {rental_id, vehicle_id, status, total_cost, metadata}'
```

### Шаг 4. Ответ оператору

```
✅ Записал сервисную работу
• Сборка байка · 1 250 ₽ · байк falcon-gt · 2026-08-08
• rental_id: b100a570-14a1-4d0d-919b-533ffafa7837

📋 Вечерний дайджест это увидит.
```

## Куда попадает запись

Сервисные rental-записи всплывают в:

1. **`boss-commands/evening-summary.sh`** (21:00 МСК) — `rentals WHERE vehicle_id IN (cars.type='service') AND created_at = today` → KPI «Сервисов сегодня / Выручка / Завершено».
2. **Web UI** `vip-bike.ru/franchize/vip-bike/rentals-analytics?ui=v2&tab=services` — Сервис tab, ServiceDetailDrawer.
3. **Sibling skill** `service-analytics-text` — `services-list`, `service-kpis`, `service-detail`.

Детектор `isServiceRental` (см. `lib/analytics-utils.ts`):
```
vehicle_id LIKE 'vip-bike-svc-%'  OR  vehicle_id IN (SELECT id FROM cars WHERE type='service')
```
Оба условия эквивалентны для нашей схемы (все сервисные услуги имеют id `vip-bike-svc-XXX`).

## 🔗 Deep Links

| Что показать | Ссылка |
|---|---|
| Сервис tab | `https://t.me/oneBikePlsBot/app?startapp=analytics_services` |
| Конкр. сервис (drawer) | `?startapp=rental_{rentalId}` |
| Web Сервис tab | `https://vip-bike.ru/franchize/vip-bike/rentals-analytics?ui=v2&tab=services` |

## Anti-hallucination

- ⛔ НЕ выдумывать цену — брать из фразы оператора или `daily_price` из каталога.
- ⛔ НЕ выдумывать `vip-bike-svc-XXX` — всегда вычислять `max+1` запросом к БД.
- ⛔ НЕ создавать дубль услуги — сначала fuzzy-поиск по `model ilike`.
- ✅ Если услуга не найдена, а оператор сказал «выполнил работу X» — спросить: создать новую или это опечатка (один короткий вопрос списком).
- ✅ Дату всегда через `TZ=Europe/Moscow date` или `date -d`, никогда в уме.

## Security

- Сервис-ролевый ключ НЕ показывать оператору, не логировать.
- Внутренние сервисные работы: `user_id = owner_id = 356282674`. ПДн не передаётся.

## Related Files

- Sibling: `skills/service-analytics-text/SKILL.md` — просмотр/аналитика сервисов
- Sibling: `skills/catalog-adder-text/SKILL.md` — добавление байков/услуг с картинками (тяжёлый флоу)
- Digest: `boss-commands/evening-summary.sh` (строки 60-80 — Сервис KPIs)
- Reference CSV: `docs/crewDocs/vip-bike-service-items.csv`
- Reference SQL: `docs/crewDocs/vip-bike-service-seed.sql`
- Schema: `supabase/migrations/20240717000000_update_rentals_and_rls.sql` (rentals DDL)
- Schema: `cars.type='service'` + `specs={"service":true,"subtype":"service","dailyPrice":N}`
- Web v2: `app/franchize/[slug]/rentals-analytics/components/ServiceDetailDrawer.tsx`
- Umbrella: `skills/vip-bike-ops`

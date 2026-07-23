---
name: sale-analytics-text
description: >
  Text-based sales analytics for VIP Bike. Mirrors the v2 web dashboard
  (Продажа tab, SaleDetailDrawer 5 sections). List sales, KPIs, detail,
  contract status, delivery status, warranty, stats.
  Trigger phrases: "продажи", "статистика продаж", "kpi продаж", "детали продажи",
  "статус договора", "доставка байка", "гарантия", "сумма продаж",
  "sales list", "sale kpis", "sale detail", "sale stats", "sales revenue",
  "contract status", "delivery status", "warranty"
---

# sale-analytics-text

Триггер-фразы: **`продажи`**, **`статистика продаж`**, **`kpi продаж`**, **`детали продажи`**, **`статус договора`**, **`доставка байка`**, **`гарантия`**, **`сумма продаж`**, **`sales list`**, **`sale kpis`**, **`sale detail`**, **`sale stats`**, **`sales revenue`**, **`contract status`**, **`delivery status`**, **`warranty`**

## Supabase Access
- URL: https://inmctohsodgdohamhzag.supabase.co
- Key: from /home/z/my-project/upload/secrets.txt
- Crew: vip-bike, ID: 2d5fde70-1dd3-4f0d-8d72-66ccf6908746
- Private schema: `sale_contract_artifacts` lives in `private` schema — `Accept-Profile: private` header required

## Web UI mirror (v2)

Mirrors the Продажа tab at `/franchize/vip-bike/rentals-analytics?ui=v2`.
The web SaleDetailDrawer has 5 sections; this skill exposes the same data
via text.

KPI row for sales (computed for selected date):
- **Продаж сегодня** — count of sales with `created_at` on the date
- **Выручка с продаж** — sum of `total_sum` (or `sale_price` fallback)
- **Средний чек** — `total_sum / count`
- **Доставлено** — count where `metadata.delivery_status = 'delivered'`

Status color whitelist:
- 🟡 `#f59e0b` Продажа badge (sale accent)
- 🟢 `#22c55e` подписан / доставлен / оплачен
- 🔵 `#3b82f6` отправлен / в пути
- 🔴 `#ef4444` отменён

## Commands

### 1. sales-list [--date YYYY-MM-DD]
All sales for a date. Mirrors AnalyticsSaleCard.

```bash
DATE="${1:-$(date -u +%Y-%m-%d)}"
START="${DATE}T00:00:00Z"; END="${DATE}T23:59:59Z"
curl -s "$URL/rest/v1/sale_contract_artifacts?select=id,buyer_full_name,buyer_phone,buyer_email,sale_price,total_sum,created_at,resolved_bike_id,warranty_months,contract_key,metadata&crew_slug=eq.vip-bike&created_at=gte.${START}&created_at=lte.${END}&order=created_at.desc" \
  -H "apikey: $KEY" -H "Authorization: Bearer $KEY" -H "Accept-Profile: private"
```

Output per card (matches AnalyticsSaleCard):
- Bike title: join `cars` on `resolved_bike_id` → `make + " " + model`
- Buyer ФИО: `buyer_full_name` (NOT phone — phone is drawer-only)
- Price: `total_sum ?? sale_price` formatted as ₽
- Created date: `created_at` formatted as DD.MM
- Right badge: `Продажа` (yellow)

### 2. sale-kpis [--date YYYY-MM-DD]
4 KPI cards for the date.

```bash
DATE="${1:-$(date -u +%Y-%m-%d)}"
START="${DATE}T00:00:00Z"; END="${DATE}T23:59:59Z"
curl -s "$URL/rest/v1/sale_contract_artifacts?select=total_sum,sale_price,metadata&crew_slug=eq.vip-bike&created_at=gte.${START}&created_at=lte.${END}" \
  -H "apikey: $KEY" -H "Authorization: Bearer $KEY" -H "Accept-Profile: private"
```

Compute:
1. `total_today` = COUNT(*)
2. `revenue_today` = SUM(COALESCE(total_sum, sale_price::numeric))
3. `avg_check` = revenue_today / total_today (or 0 if total_today = 0)
4. `delivered_today` = COUNT(*) WHERE metadata->>'delivery_status' = 'delivered'

### 3. sale-detail <saleId>
Full 5-section detail (mirrors SaleDetailDrawer):

```bash
curl -s "$URL/rest/v1/sale_contract_artifacts?select=*,vehicle:cars!resolved_bike_id(make,model,type,specs)&id=eq.${saleId}" \
  -H "apikey: $KEY" -H "Authorization: Bearer $KEY" -H "Accept-Profile: private"
```

Sections (in order):
1. **Header** — bike title, buyer ФИО, sale badge (yellow), price pill
2. **Primary actions** — 4 buttons:
   - `Договор` (open contract PDF)
   - `Отправить` (send by email/telegram)
   - `Подписан` (mark signed — PATCH metadata.contract_status='signed')
   - `Отменить` (cancel — PATCH metadata.contract_status='cancelled')
3. **Info grid** (8 tiles):
   - Байк, Покупатель, Телефон, Email, Цена, Сумма итого, Создана, Байк ID
4. **Notes** — list + add-note input (currently empty stub; persistence TBD)
5. **Sticky footer** — "Открыть продажу →"

### 4. sale-contract-status <saleId>
Contract lifecycle status.

```bash
curl -s "$URL/rest/v1/sale_contract_artifacts?select=id,metadata,warranty_months,created_at&id=eq.${saleId}" \
  -H "apikey: $KEY" -H "Authorization: Bearer $KEY" -H "Accept-Profile: private" | \
  jq '.[0].metadata | {contract_status, signed_at, sent_at}'
```

Status values (in `metadata.contract_status`):
- `pending` — договор создан, не отправлен
- `sent` — отправлен покупателю
- `signed` — подписан покупателем
- `paid` — оплата получена
- `delivered` — байк передан
- `cancelled` — отменён

Output: `Статус: Подписан ✅ (2024-07-15)` or `Статус: Отправлен 🔵 (ожидает подписи)`.

### 5. sale-delivery-status <saleId>
Delivery tracking.

```bash
curl -s "$URL/rest/v1/sale_contract_artifacts?select=metadata&id=eq.${saleId}" \
  -H "apikey: $KEY" -H "Authorization: Bearer $KEY" -H "Accept-Profile: private" | \
  jq '.[0].metadata | {delivery_status, delivered_at, delivery_address, tracking_number}'
```

Status values (in `metadata.delivery_status`):
- `pending` — ожидает отправки
- `in_transit` — в пути (with `tracking_number`)
- `delivered` — доставлен
- `picked_up` — забран лично

### 6. sale-warranty <saleId>
Warranty info.

```bash
curl -s "$URL/rest/v1/sale_contract_artifacts?select=warranty_months,metadata&id=eq.${saleId}" \
  -H "apikey: $KEY" -H "Authorization: Bearer $KEY" -H "Accept-Profile: private"
```

Output: `Гарантия: 12 мес (до 2025-07-15)` or `Гарантия: без гарантии`.

### 7. sale-stats [--from YYYY-MM-DD] [--to YYYY-MM-DD]
Aggregate stats.

```bash
FROM="${1:-$(date -u -d '30 days ago' +%Y-%m-%d)}"
TO="${2:-$(date -u +%Y-%m-%d)}"
curl -s "$URL/rest/v1/sale_contract_artifacts?select=id,total_sum,sale_price,resolved_bike_id,created_at&crew_slug=eq.vip-bike&created_at=gte.${FROM}T00:00:00Z&created_at=lte.${TO}T23:59:59Z" \
  -H "apikey: $KEY" -H "Authorization: Bearer $KEY" -H "Accept-Profile: private"
```

Output:
- `Всего продаж: 24`
- `Выручка: 8 450 000 ₽`
- `Средний чек: 352 083 ₽`
- `Топ-модель: Falcon PRO (8 продаж, 3 200 000 ₽)`
- `По месяцам: июнь — 12, июль — 12`

### 8. sale-update-status <saleId> --status <status> [--field contract_status|delivery_status]
Update sale contract or delivery status.

```bash
# Read current metadata
META=$(curl -s "$URL/rest/v1/sale_contract_artifacts?select=metadata&id=eq.${saleId}" \
  -H "apikey: $KEY" -H "Authorization: Bearer $KEY" -H "Accept-Profile: private" | \
  jq -c '.[0].metadata // {}')

# Patch the field
UPDATED=$(echo "$META" | jq -c --arg field "$FIELD" --arg val "$STATUS" '.[$field] = $val')

curl -s -X PATCH "$URL/rest/v1/sale_contract_artifacts?id=eq.${saleId}" \
  -H "apikey: $KEY" -H "Authorization: Bearer $KEY" \
  -H "Content-Type: application/json" \
  -H "Prefer: return=representation" \
  -H "Accept-Profile: private" \
  -d "{\"metadata\":${UPDATED}}"
```

## Anti-hallucination
- ~~--json~~, ~~--outFile~~, ~~--crew~~
- `total_sum` may be NULL — fall back to `sale_price` (cast to numeric)
- `metadata` may be NULL — guard with `?? {}` or `// {}`

## Security
- Private schema (`sale_contract_artifacts`): `Accept-Profile: private` header required on ALL requests
- PII masking: `buyer_phone = "+7…XX-12"`, `buyer_email = "x…@y.ru"`, `buyer_passport_number = "XXXX…1234"`
- Service key: never expose to client

## Related Files
- Web v2: `app/franchize/[slug]/rentals-analytics/components/AnalyticsClient.tsx` (Продажа tab)
- Web v2 card: `app/franchize/[slug]/rentals-analytics/components/AnalyticsSaleCard.tsx`
- Web v2 drawer: `app/franchize/[slug]/rentals-analytics/components/SaleDetailDrawer.tsx`
- Server actions: `app/franchize/server-actions/rentals-dashboard.ts` (`getSalesDashboard`)
- Sibling skills: `rental-analytics-text`, `service-analytics-text`, `leads-crm-text`
- Umbrella: `vip-bike-ops`

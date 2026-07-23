---
name: sale-analytics-text
description: >
  Text-based sales analytics for VIP Bike. List sales, view detail, aggregate stats.
  Trigger phrases: "продажи", "статистика продаж", "детали продажи", "сумма продаж",
  "sales list", "sale detail", "sale stats", "sales revenue"
---

# sale-analytics-text

Триггер-фразы: **`продажи`**, **`статистика продаж`**, **`детали продажи`**, **`сумма продаж`**, **`sales list`**, **`sale detail`**

## Supabase Access
- URL: https://inmctohsodgdohamhzag.supabase.co
- Key: from /home/z/my-project/upload/secrets.txt
- Crew: vip-bike, ID: 2d5fde70-1dd3-4f0d-8d72-66ccf6908746

## Commands

### 1. sales-list [--date YYYY-MM-DD]
```bash
curl -s "$URL/rest/v1/sale_contract_artifacts?select=id,buyer_full_name,buyer_phone,sale_price,total_sum,created_at,resolved_bike_id&crew_slug=eq.vip-bike&order=created_at.desc&limit=50" \
  -H "apikey: $KEY" -H "Authorization: Bearer $KEY" -H "Accept-Profile: private"
```
Output: bike, buyer ФИО, price, date.
`🌐 Web: https://vip-bike.ru/franchize/vip-bike/sales-analytics`

### 2. sale-detail <saleId>
Full detail: buyer info, bike, price, warranty, contract data.

### 3. sale-stats
Aggregate: total sales, total revenue, average price, by bike model.

## Anti-hallucination
- ~~--json~~, ~~--outFile~~, ~~--crew~~

## Security
- Private schema: Accept-Profile: private required
- PII: mask buyer_phone (+7…XXXX)

## Related Files
- Skills: rental-analytics-text, service-analytics-text, leads-crm-text

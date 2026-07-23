---
name: service-analytics-text
description: >
  Text-based service analytics for VIP Bike. List service rentals, view detail, catalog, stats.
  Trigger phrases: "сервис", "обслуживание", "услуги", "сервисные работы", "нормо-час",
  "service list", "service detail", "service catalog", "service stats"
---

# service-analytics-text

Триггер-фразы: **`сервис`**, **`обслуживание`**, **`услуги`**, **`сервисные работы`**, **`нормо-час`**, **`service list`**, **`service catalog`**

## Supabase Access
- URL: https://inmctohsodgdohamhzag.supabase.co
- Key: from /home/z/my-project/upload/secrets.txt
- Crew: vip-bike, ID: 2d5fde70-1dd3-4f0d-8d72-66ccf6908746

## Commands

### 1. services-list [--date YYYY-MM-DD]
Service rentals = rentals where vehicle_id IN (cars.type='service').
```bash
# Step 1: get service bike IDs
SVC_IDS=$(curl -s "$URL/rest/v1/cars?select=id&crew_id=eq.$CREW_ID&type=eq.service" \
  -H "apikey: $KEY" -H "Authorization: Bearer $KEY" | jq -r '.[].id' | paste -sd,)
# Step 2: query rentals
curl -s "$URL/rest/v1/rentals?select=rental_id,user_id,vehicle_id,status,total_cost,created_at&vehicle_id=in.(${SVC_IDS})&order=created_at.desc&limit=50" \
  -H "apikey: $KEY" -H "Authorization: Bearer $KEY"
```
Output: service type, client ФИО, status, cost, mechanic.
`🌐 Web: https://vip-bike.ru/franchize/vip-bike/rentals-analytics`

### 2. service-detail <rentalId>
Full detail: service type, client, status, cost, mechanic, todos, history.

### 3. service-catalog
```bash
curl -s "$URL/rest/v1/cars?select=id,make,model,daily_price&crew_id=eq.$CREW_ID&type=eq.service&order=make.asc" \
  -H "apikey: $KEY" -H "Authorization: Bearer $KEY"
```
Output: 10 service items (Нормо-час 2000₽, Замена масла 2000₽, etc.)

### 4. service-stats
Aggregate: total services, total revenue, by service type.

## Anti-hallucination
- ~~--json~~, ~~--outFile~~, ~~--crew~~

## Security
- PII: mask client phone
- Private schema: Accept-Profile: private for artifact queries

## Related Files
- Skills: rental-analytics-text, sale-analytics-text, leads-crm-text, franchize-catalog-text

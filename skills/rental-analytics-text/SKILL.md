---
name: rental-analytics-text
description: >
  Text-based rental analytics for VIP Bike. Daily rentals, detail, todos, documents, handoffs,
  activate/complete, returns due, overdue tracking.
  Trigger phrases: "аренды сегодня", "статус аренд", "возвраты сегодня", "просроченные аренды",
  "активировать аренду", "завершить аренду", "карточка аренды", "rentals today", "rental detail",
  "returns due", "overdue rentals", "activate rental", "complete rental"
---

# rental-analytics-text

Триггер-фразы: **`аренды сегодня`**, **`статус аренд`**, **`возвраты сегодня`**, **`просроченные аренды`**, **`карточка аренды`**, **`rentals today`**, **`rental detail`**, **`returns due`**

## Supabase Access
- URL: https://inmctohsodgdohamhzag.supabase.co
- Key: from /home/z/my-project/upload/secrets.txt (SUPABASE_SERVICE_ROLE_KEY=)
- Crew: vip-bike, ID: 2d5fde70-1dd3-4f0d-8d72-66ccf6908746

## Commands

### 1. rentals-day [--date YYYY-MM-DD]
All rentals for a date (created OR period overlapping).

```bash
DATE="${1:-$(date -u +%Y-%m-%d)}"
START="${DATE}T00:00:00Z"; END="${DATE}T23:59:59Z"
curl -s "$URL/rest/v1/rentals?select=rental_id,user_id,vehicle_id,status,total_cost,requested_start_date,requested_end_date,agreed_end_date,metadata,created_at&crew_id=eq.$CREW_ID&or=(and(created_at.gte.$START,created_at.lte.$END),and(requested_start_date.lte.$END,requested_end_date.gte.$START))&order=created_at.desc" \
  -H "apikey: $KEY" -H "Authorization: Bearer $KEY"
```

Output: bike, renter ФИО, status, dates, cost, docs status, SLA.
`🌐 Web: https://vip-bike.ru/franchize/vip-bike/rentals-analytics`

### 2. rental-detail <rentalId>
Full detail: bike, renter, status, dates, cost, payment, documents, todos, handoff, history, QR status.
`🌐 Web: https://vip-bike.ru/franchize/vip-bike/rental/<rentalId>`

### 3. rental-todos <rentalId>
All todos for this rental (both categories).
```bash
curl -s "$URL/rest/v1/crew_todos?select=id,title,status,category,priority,due_date,assigned_to&rental_id=eq.${rentalId}&order=created_at.desc" \
  -H "apikey: $KEY" -H "Authorization: Bearer $KEY"
```

### 4. rental-documents <rentalId>
Document status: passport photos, license, OCR data from user_rental_secrets.

### 5. rental-handoff <rentalId>
Handoff checklist: odometer, equipment, damage inspection.

### 6. activate-rental <rentalId> --odometer <km>
Activate rental (PATCH status=active + metadata.odometer_before).

### 7. complete-rental <rentalId> --odometer <km>
Complete rental (PATCH status=completed + metadata.odometer_after).

### 8. returns-due [--date YYYY-MM-DD]
Rentals due for return (end_date <= today, status=active).

### 9. overdue-rentals
Rentals past end_date with status=active.

## Anti-hallucination
- ~~--json~~ — text output only
- ~~--outFile~~ — stdout only
- ~~--crew~~ — hardcoded to vip-bike

## Security
- Service key: never expose to client
- PII: mask passport (XXXX…), license (XXXX…), registration (г. Мо…)
- Private schema: Accept-Profile: private header required

## Related Files
- Server actions: app/franchize/server-actions/rentals-dashboard.ts
- Skills: sale-analytics-text, service-analytics-text, leads-crm-text, rental-card-text

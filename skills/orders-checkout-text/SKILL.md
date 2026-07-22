---
name: orders-checkout-text
description: >
  Text-based orders and checkout for VIP Bike. View orders, create checkouts/invoices, track notifications. Trigger phrases: заказы, оформить заказ, создать чекаут, счет на оплату, статус заказа, уведомления заказов, orders, checkout, invoice, order status, order notifications, payment
---

# orders-checkout-text

Триггер-фразы: см. description выше.

## Overview

Text-based skill that queries Supabase directly and outputs structured text — same data as the corresponding web page but as CLI/table output. Each command output ends with a link to the web app version.

## Supabase Access

- URL: https://inmctohsodgdohamhzag.supabase.co
- Service key: read from /home/z/my-project/upload/secrets.txt (SUPABASE_SERVICE_ROLE_KEY= line)
- Crew slug: vip-bike
- Crew ID: 2d5fde70-1dd3-4f0d-8d72-66ccf6908746

## Commands

### 1. order-detail <orderId>
Show order details: items, total, payment status, customer.

```bash
curl -s "$URL/rest/v1/orders?select=*&id=eq.${orderId}" \
  -H "apikey: $KEY" -H "Authorization: Bearer $KEY"
```

### 2. list-orders [--status pending|paid|failed|refunded] [--date YYYY-MM-DD]
List orders filtered.

### 3. create-checkout <bikeId> --startDate <YYYY-MM-DD> --endDate <YYYY-MM-DD>
Create a checkout session (documented as server action call).

### 4. create-invoice <bikeId> --amount <rubles> --description <text>
Create an invoice.

### 5. order-notifications [--status failed|sent|pending]
Show notification delivery status from franchize_order_notifications.

```bash
curl -s "$URL/rest/v1/franchize_order_notifications?select=*&order=created_at.desc&limit=20" \
  -H "apikey: $KEY" -H "Authorization: Bearer $KEY"
```

### 6. retry-notification <orderId>
Retry a failed notification (PATCH status=pending).

## Schema Access

Tables: public.orders (id, crew_id, user_id, total_amount, status, items, created_at), public.franchize_order_notifications (id, order_id, channel, status, error, created_at), public.rentals (by order metadata)

## Web Links

Each command output ends with:
```
🌐 Web: https://vip-bike.ru/franchize/vip-bike/order/<orderId>
```

## Anti-hallucination

- ~~--json~~ — output is always text, not JSON
- ~~--outFile~~ — write to stdout only
- ~~--crew~~ — crew is hardcoded to vip-bike
- All flags are listed per command above; do not invent new ones

## Error Handling

| Stage | Reason | When |
|---|---|---|
| auth | Invalid or missing service key | Key not found in secrets.txt |
| not_found | Entity not found | ID doesn't exist in database |
| constraint | CHECK constraint violation | Writing invalid value |
| network | Supabase unreachable | DNS/firewall/timeout |

## Security

- Service role key must NEVER be exposed to client-side code
- PII (passport numbers, registration addresses) must be masked in output: show first 4 chars + "…"
- All queries use HTTPS
- Private schema tables require Accept-Profile: private header

## Related Files

- Server actions: app/franchize/server-actions/
- Supabase schema: supabase/migrations/
- Companion skills: leads-crm-text, analytics-text, franchize-catalog-text, rental-card-text, crew-management-text

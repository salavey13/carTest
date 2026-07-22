---
name: crew-admin-text
description: >
  Text-based crew admin for VIP Bike. View/edit config, pricing, bike availability. Trigger phrases: админка, настройки экипажа, цены на байки, доступность байков, конфигурация, crew admin, bike pricing admin, availability toggle, admin config, admin prices
---

# crew-admin-text

Триггер-фразы: см. description выше.

## Overview

Text-based skill that queries Supabase directly and outputs structured text — same data as the corresponding web page but as CLI/table output. Each command output ends with a link to the web app version.

## Supabase Access

- URL: https://inmctohsodgdohamhzag.supabase.co
- Service key: read from /home/z/my-project/upload/secrets.txt (SUPABASE_SERVICE_ROLE_KEY= line)
- Crew slug: vip-bike
- Crew ID: 2d5fde70-1dd3-4f0d-8d72-66ccf6908746

## Commands

### 1. admin-config
Show crew configuration from crews.metadata.

```bash
curl -s "$URL/rest/v1/crews?select=name,slug,metadata,description,logo_url,hq_location&slug=eq.vip-bike" \
  -H "apikey: $KEY" -H "Authorization: Bearer $KEY"
```

### 2. admin-prices
Show all bike pricing from cars.specs.

```bash
curl -s "$URL/rest/v1/cars?select=id,make,model,daily_price,specs,quantity&crew_id=eq.${CREW_ID}&type=eq.bike&order=make.asc" \
  -H "apikey: $KEY" -H "Authorization: Bearer $KEY"
```

### 3. admin-update-price <bikeId> --weekday <rubles> [--weekend <rubles>] [--deposit <rubles>]
Update bike pricing (PATCH cars.specs).

### 4. admin-toggle-availability <bikeId> --available <true|false>
Toggle bike availability (PATCH cars.availability_rules).

### 5. admin-bikes
List all bikes with availability status, pricing, crew assignment.

## Schema Access

Tables: public.crews (metadata: theme, branding, contacts, CTA, social, menu), public.cars (id, make, model, daily_price, specs, availability_rules, quantity, crew_id)

## Web Links

Each command output ends with:
```
🌐 Web: https://vip-bike.ru/franchize/vip-bike/admin
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

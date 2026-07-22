---
name: leaderboard-text
description: >
  Text-based rider leaderboard for VIP Bike. View rankings, rider stats, aggregate stats. Trigger phrases: лидерборд, рейтинг райдеров, топ райдеров, статистика райдеров, leaderboard, rider rankings, top riders, rider stats, rider points
---

# leaderboard-text

Триггер-фразы: см. description выше.

## Overview

Text-based skill that queries Supabase directly and outputs structured text — same data as the corresponding web page but as CLI/table output. Each command output ends with a link to the web app version.

## Supabase Access

- URL: https://inmctohsodgdohamhzag.supabase.co
- Service key: read from /home/z/my-project/upload/secrets.txt (SUPABASE_SERVICE_ROLE_KEY= line)
- Crew slug: vip-bike
- Crew ID: 2d5fde70-1dd3-4f0d-8d72-66ccf6908746

## Commands

### 1. leaderboard [--period week|month|all]
Show rider leaderboard: rank, name, rentals count, total spent, average rating.

```bash
# Get all users with rental activity
curl -s "$URL/rest/v1/users?select=user_id,username,full_name,metadata&order=created_at.desc&limit=100" \
  -H "apikey: $KEY" -H "Authorization: Bearer $KEY"
# Get rental counts per user
curl -s "$URL/rest/v1/rentals?select=user_id,status,total_cost&status=in.(active,completed)" \
  -H "apikey: $KEY" -H "Authorization: Bearer $KEY"
```

### 2. leaderboard-rider <userId>
Show a rider's position and stats: rentals, total spent, reviews, badges.

### 3. leaderboard-stats
Aggregate stats: total riders, total rentals, total revenue, average rating.

## Schema Access

Tables: public.users (user_id, username, full_name, badges, metadata), public.rentals (by user_id, status, total_cost), public.rental_reviews (by user_id, rating)

## Web Links

Each command output ends with:
```
🌐 Web: https://vip-bike.ru/franchize/vip-bike/leaderboard
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

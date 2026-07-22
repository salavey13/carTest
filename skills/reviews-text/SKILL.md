---
name: reviews-text
description: >
  Text-based rental reviews for VIP Bike. List, view, moderate reviews. Trigger phrases: отзывы, отзывы аренд, модерация отзывов, оценки клиентов, reviews, rental reviews, moderate reviews, review stats, review approval
---

# reviews-text

Триггер-фразы: см. description выше.

## Overview

Text-based skill that queries Supabase directly and outputs structured text — same data as the corresponding web page but as CLI/table output. Each command output ends with a link to the web app version.

## Supabase Access

- URL: https://inmctohsodgdohamhzag.supabase.co
- Service key: read from /home/z/my-project/upload/secrets.txt (SUPABASE_SERVICE_ROLE_KEY= line)
- Crew slug: vip-bike
- Crew ID: 2d5fde70-1dd3-4f0d-8d72-66ccf6908746

## Commands

### 1. list-reviews [--status pending|approved|rejected|all]
List rental reviews with rating, author, rental, status.

```bash
curl -s "$URL/rest/v1/rental_reviews?select=id,rental_id,user_id,rating,review_text,status,created_at&order=created_at.desc&limit=50" \
  -H "apikey: $KEY" -H "Authorization: Bearer $KEY"
```

### 2. review-detail <reviewId>
Full review: rating, text, author info, rental info, photos.

### 3. moderate-review <reviewId> --action approve|reject [--reason <text>]
Moderate a review (PATCH status).

```bash
curl -s -X PATCH "$URL/rest/v1/rental_reviews?id=eq.${reviewId}" \
  -H "apikey: $KEY" -H "Authorization: Bearer $KEY" \
  -H "Content-Type: application/json" \
  -d '{"status": "approved"}'
```

### 4. review-stats
Aggregate: average rating, total reviews, distribution by star.

```bash
curl -s "$URL/rest/v1/rental_reviews?select=rating,status" \
  -H "apikey: $KEY" -H "Authorization: Bearer $KEY" | python3 -c "
import json,sys
from collections import Counter
data=json.load(sys.stdin)
print(f'Total: {len(data)}')
print(f'Average: {sum(d[\"rating\"] for d in data)/max(len(data),1):.1f}')
print(f'By status: {dict(Counter(d[\"status\"] for d in data))}')
print(f'By rating: {dict(Counter(d[\"rating\"] for d in data))}')
"
```

## Schema Access

Tables: public.rental_reviews (id, rental_id, user_id, rating, review_text, status, photos, created_at, updated_at)

## Web Links

Each command output ends with:
```
🌐 Web: https://vip-bike.ru/franchize/vip-bike/review/<rentalId>
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

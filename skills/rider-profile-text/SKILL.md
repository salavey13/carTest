---
name: rider-profile-text
description: >
  Text-based rider profile for VIP Bike. View user profile, rentals, achievements, documents, activity. Trigger phrases: профиль райдера, история аренд пользователя, достижения, документы пользователя, rider profile, user rentals, user achievements, user documents, profile activity
---

# rider-profile-text

Триггер-фразы: см. description выше.

## Overview

Text-based skill that queries Supabase directly and outputs structured text — same data as the corresponding web page but as CLI/table output. Each command output ends with a link to the web app version.

## Supabase Access

- URL: https://inmctohsodgdohamhzag.supabase.co
- Service key: read from /home/z/my-project/upload/secrets.txt (SUPABASE_SERVICE_ROLE_KEY= line)
- Crew slug: vip-bike
- Crew ID: 2d5fde70-1dd3-4f0d-8d72-66ccf6908746

## Commands

### 1. profile <userId>
Show rider profile: name, username, avatar_url, badges, rental count, total spent, troubled status.

```bash
curl -s "$URL/rest/v1/users?select=user_id,username,full_name,avatar_url,metadata,badges&user_id=eq.${userId}" \
  -H "apikey: $KEY" -H "Authorization: Bearer $KEY"
curl -s "$URL/rest/v1/rentals?select=rental_id,status,total_cost,requested_start_date,requested_end_date&user_id=eq.${userId}&order=created_at.desc&limit=20" \
  -H "apikey: $KEY" -H "Authorization: Bearer $KEY"
```

### 2. profile-rentals <userId>
List all rentals for a user with bike, status, dates, cost.

### 3. profile-achievements <userId>
Show badges from users.badges + metadata.achievementPoints.

### 4. profile-activity <userId>
Activity digest: recent franchize_intents + rentals + reviews.

```bash
curl -s "$URL/rest/v1/franchize_intents?select=intent_type,stage,created_at,last_seen_at&telegram_user_id=eq.${userId}&order=last_seen_at.desc&limit=10" \
  -H "apikey: $KEY" -H "Authorization: Bearer $KEY"
```

### 5. profile-documents <userId>
Document verification status from user_rental_secrets.

```bash
curl -s "$URL/rest/v1/user_rental_secrets?select=renter_full_name,renter_passport,renter_driver_license,verification_status,source_rental_id&chat_id=eq.${userId}" \
  -H "apikey: $KEY" -H "Authorization: Bearer $KEY" -H "Accept-Profile: private"
```

### 6. profile-secrets <userId>
Saved rental secrets for profile prefill (renter data from past rentals).

## Schema Access

Tables: public.users (user_id, username, full_name, avatar_url, metadata, badges, test_progress), public.rentals (by user_id), private.user_rental_secrets (by chat_id), public.franchize_intents (by telegram_user_id), public.rental_reviews (by user_id)

## Web Links

Each command output ends with:
```
🌐 Web: https://vip-bike.ru/franchize/vip-bike/profile
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

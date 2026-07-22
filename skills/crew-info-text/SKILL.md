---
name: crew-info-text
description: >
  Text-based crew info for VIP Bike. About, contacts, community, onboarding. Trigger phrases: о экипаже, контакты экипажа, сообщество, онбординг партнера, crew about, crew contacts, crew community, partner onboarding, crew info
---

# crew-info-text

Триггер-фразы: см. description выше.

## Overview

Text-based skill that queries Supabase directly and outputs structured text — same data as the corresponding web page but as CLI/table output. Each command output ends with a link to the web app version.

## Supabase Access

- URL: https://inmctohsodgdohamhzag.supabase.co
- Service key: read from /home/z/my-project/upload/secrets.txt (SUPABASE_SERVICE_ROLE_KEY= line)
- Crew slug: vip-bike
- Crew ID: 2d5fde70-1dd3-4f0d-8d72-66ccf6908746

## Commands

### 1. crew-about
Show crew info: name, description, capabilities, trust indicators.

```bash
curl -s "$URL/rest/v1/crews?select=name,description,metadata,hq_location&slug=eq.vip-bike" \
  -H "apikey: $KEY" -H "Authorization: Bearer $KEY"
```

### 2. crew-contacts
Show contacts: address, phone, Telegram, working hours, map link.
Extracted from crews.metadata.contacts.

### 3. crew-community
Show community events, partners, city routes from crews.metadata.community.

### 4. crew-onboarding
Show partner onboarding checklist/status from crews.metadata.onboarding.

## Schema Access

Tables: public.crews (name, description, metadata, hq_location, logo_url)

## Web Links

Each command output ends with:
```
🌐 Web: https://vip-bike.ru/franchize/vip-bike/about
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

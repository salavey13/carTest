---
name: contract-draft-text
description: >
  Text-based contract draft management for VIP Bike. Submit, review, approve, decline contracts. Trigger phrases: договор аренды, черновик договора, согласовать договор, отклонить договор, статус договора, contract draft, approve contract, decline contract, contract status, contract review
---

# contract-draft-text

Триггер-фразы: см. description выше.

## Overview

Text-based skill that queries Supabase directly and outputs structured text — same data as the corresponding web page but as CLI/table output. Each command output ends with a link to the web app version.

## Supabase Access

- URL: https://inmctohsodgdohamhzag.supabase.co
- Service key: read from /home/z/my-project/upload/secrets.txt (SUPABASE_SERVICE_ROLE_KEY= line)
- Crew slug: vip-bike
- Crew ID: 2d5fde70-1dd3-4f0d-8d72-66ccf6908746

## Commands

### 1. contract-draft <rentalId>
Show contract draft status from rentals.metadata.contractDraft.

```bash
curl -s "$URL/rest/v1/rentals?select=rental_id,status,metadata&rental_id=eq.${rentalId}" \
  -H "apikey: $KEY" -H "Authorization: Bearer $KEY"
```

### 2. submit-draft <rentalId> --text <contractText>
Submit a contract draft (PATCH rentals.metadata).

```bash
curl -s -X PATCH "$URL/rest/v1/rentals?rental_id=eq.${rentalId}" \
  -H "apikey: $KEY" -H "Authorization: Bearer $KEY" \
  -H "Content-Type: application/json" \
  -d '{"metadata": {"contractDraft": {"text": "...", "submittedAt": "...", "submittedBy": "..."}}}'
```

### 3. approve-contract <rentalId>
Approve a submitted contract draft.

### 4. decline-contract <rentalId> --reason <text>
Decline a submitted contract draft.

### 5. contract-status <rentalId>
Show contract lifecycle: draft → submitted → approved/declined.

## Schema Access

Tables: public.rentals (metadata.contractDraft), private.rental_contract_artifacts (by rental_id), private.user_rental_secrets (by source_rental_id)

## Web Links

Each command output ends with:
```
🌐 Web: https://vip-bike.ru/franchize/vip-bike/contract-draft/<rentalId>
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

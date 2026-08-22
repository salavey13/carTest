---
name: deposit-tracer-text
description: >
  Trace deposit states across cash, T-Bank card, and Sber card. Lists
  deposit movements (collected/returned/penalty), shows per-card balances,
  and per-rental deposit history. Works with the deposit_entries table.
  Trigger phrases: "где депозиты", "статус депозитов", "депозиты на картах",
  "cash or card", "deposit trace", "депозиты сегодня", "куда пришли деньги",
  "сколько на картах", "deposit list", "deposit balance", "deposit rental".
---

# deposit-tracer-text

Триггер-фразы: **`где депозиты`**, **`статус депозитов`**, **`депозиты на картах`**, **`cash or card`**, **`deposit trace`**, **`депозиты сегодня`**, **`куда пришли деньги`**, **`сколько на картах`**, **`deposit list`**, **`deposit balance`**, **`deposit rental`**

## Supabase Access
- URL: https://inmctohsodgdohamhzag.supabase.co
- Key: from /home/z/my-project/upload/secrets.txt (SUPABASE_SERVICE_ROLE_KEY=)
- Crew: vip-bike, ID: 2d5fde70-1dd3-4f0d-8d72-66ccf6908746

## Deposit Destinations

| Destination | Label | Icon |
|-------------|-------|------|
| `cash` | Наличные | 💵 |
| `tbank` | Карта Тинькофф (card 1) | 💳Т |
| `sber` | Карта Сбербанк (card 2) | 💳С |

## Entry Types

| entry_type | direction | Description |
|------------|-----------|-------------|
| `deposit_collected` | `in` | Депозит получен (at handout) |
| `deposit_returned` | `out` | Депозит возвращён (at return) |
| `penalty` | `out` | Удержание из депозита (damage, missing fuel) |

A single rental can have multiple entries (split deposit = 2+ rows).

## Commands

### 1. deposit-list [--date YYYY-MM-DD] [--destination cash|tbank|sber]

Lists all deposit_entries for a date, optionally filtered by destination.

```bash
DATE="${1:-$(TZ=Europe/Moscow date +%Y-%m-%d)}"
START="${DATE}T00:00:00Z"; END="${DATE}T23:59:59Z"

# Optional destination filter
DEST_FILTER="${2:-}"
if [ -n "$DEST_FILTER" ]; then
  FILTER="&destination=eq.${DEST_FILTER}"
else
  FILTER=""
fi

curl -s "$URL/rest/v1/deposit_entries?select=id,rental_id,entry_type,amount,direction,destination,operator_chat_id,notes,created_at&created_at=gte.${START}&created_at=lte.${END}${FILTER}&order=created_at.asc" \
  -H "apikey: $KEY" -H "Authorization: Bearer $KEY"
```

**Output format:**
```
📋 Депозиты за 2026-08-10:

12:11 💰 Collected  +5 000₽  💵 Cash     by 7813830016  (kawasaki-ex650k)
12:11 💰 Collected +15 000₽  💳Т T-Bank  by 7813830016  (kawasaki-ex650k)
14:30 💰 Collected +20 000₽  💳С Sber    by 244736261   (ducati-panigale)
16:00 ↩️ Returned  -5 000₽   💵 Cash     (auto-return, kawasaki-ex650k)
16:00 ↩️ Returned -15 000₽   💳Т T-Bank  (auto-return, kawasaki-ex650k)
18:00 ⚠️ Penalty    -3 000₽   💵 Cash     (scratched fairing, ducati-panigale)
18:00 ↩️ Returned -17 000₽   💳С Sber    (ducati-panigale)

Итого: +40 000 collected, -40 000 returned/penalty
```

### 2. deposit-balance [--from YYYY-MM-DD] [--to YYYY-MM-DD]

Summary per destination for a date range.

```bash
FROM="${1:-$(TZ=Europe/Moscow date +%Y-%m-%d)}"
TO="${2:-$FROM}"
START="${FROM}T00:00:00Z"; END="${TO}T23:59:59Z"

curl -s "$URL/rest/v1/deposit_entries?select=destination,entry_type,direction,amount&created_at=gte.${START}&created_at=lte.${END}" \
  -H "apikey: $KEY" -H "Authorization: Bearer $KEY" | jq -r '
  group_by(.destination) | map({
    destination: .[0].destination,
    collected: ([.[] | select(.entry_type == "deposit_collected")] | map(.amount) | add // 0),
    returned: ([.[] | select(.entry_type == "deposit_returned")] | map(.amount) | add // 0),
    penalty: ([.[] | select(.entry_type == "penalty")] | map(.amount) | add // 0)
  }) |
  .[] | "\(.destination): collected=\(.collected) returned=\(.returned) penalty=\(.penalty) net=\(.collected - .returned - .penalty)"
'
```

**Output format:**
```
📊 Баланс депозитов за 2026-08-10:

💵 Cash:     +25 000 collected, -8 000 returned, -3 000 penalty, net: +14 000
💳Т T-Bank:  +15 000 collected, -15 000 returned, net: 0
💳С Sber:    +20 000 collected, -17 000 returned, net: +3 000
─────────
Total:       +60 000 collected, -40 000 returned, -3 000 penalty, net: +17 000
```

### 3. deposit-rental <rentalId>

Shows all deposit_entries for a specific rental.

```bash
RENTAL_ID="$1"
curl -s "$URL/rest/v1/deposit_entries?select=entry_type,amount,direction,destination,operator_chat_id,notes,created_at&rental_id=eq.${RENTAL_ID}&order=created_at.asc" \
  -H "apikey: $KEY" -H "Authorization: Bearer $KEY"
```

**Output format:**
```
🔍 Депозиты для аренды 823115b1:

12:11 deposit_collected  +5 000₽  💵 Cash    by 7813830016  (cash portion)
12:11 deposit_collected +15 000₽  💳Т T-Bank by 7813830016  (T-Bank portion)
16:00 deposit_returned   -5 000₽  💵 Cash    (auto-return)
16:00 deposit_returned  -15 000₽  💳Т T-Bank (auto-return)
─────────
Collected: 20 000₽ (split: 5k cash + 15k T-Bank)
Returned: 20 000₽
Penalty: 0₽
Balance: 0₽
```

### 4. deposit-card <tbank|sber> [--date YYYY-MM-DD]

Shows all money that went to a specific card today.

```bash
CARD="$1"
DATE="${2:-$(TZ=Europe/Moscow date +%Y-%m-%d)}"
START="${DATE}T00:00:00Z"; END="${DATE}T23:59:59Z"

curl -s "$URL/rest/v1/deposit_entries?select=rental_id,entry_type,amount,direction,created_at&destination=eq.${CARD}&created_at=gte.${START}&created_at=lte.${END}&order=created_at.asc" \
  -H "apikey: $KEY" -H "Authorization: Bearer $KEY"
```

**Output format:**
```
💳 Тинькофф сегодня (2026-08-10):

12:11 deposit_collected +15 000₽  (rental 823115b1)
14:30 deposit_collected +40 000₽  (rental 9c0ba304)
16:00 deposit_returned -15 000₽  (auto-return, rental 823115b1)
─────────
Total on T-Bank: +55 000 collected, -15 000 returned, net: +40 000
```

## Notes

- Deposits are ONLY for rental deposits (not rental payments, sale payments, etc.)
- `deposit_log` table still exists for backward compat — new writes go to `deposit_entries`
- Split deposits create multiple rows (e.g., 5000 cash + 15000 T-Bank = 2 rows)
- Auto-return on rental completion copies destinations from original collection
- Penalty entries track withheld amounts (damage, missing fuel, etc.)

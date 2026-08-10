# DEPOSIT TRACKING ENHANCEMENT PRD

**Version:** 2.1 (Post-implementation audit — statuses synced, trigger idempotency gap specced, signature/placement fixes)
**Date:** 2026-08-10 (audited 2026-08-11)
**Status:** ⚠️ Partially Implemented — DB + collection + auto-return ✅ shipped (2026-08-10); penalty capture, admin page, skill, digest integration ⏳ pending. **One trigger bug must be fixed — see §3.2a.**
**Related:** `docs/FRANCHIZE_SERVICE_OPERATIONS_PRD.md` §6.6, `docs/DOC_MANUAL_STEP_CORRECTION_PRD.md`, `docs/META_PRD_ITERATIVE_IMPLEMENTATION_PLAN.md`

---

## 1. PROBLEM

### 1.1 Current State
- `deposit_log` table exists with `method` column (only `cash` in production — 14 rows)
- `doc-manual.ts` collects deposit via `deposit_choice` step but doesn't track WHERE money went
- No way to know if deposit was collected as cash, on T-Bank card, or on Sber card
- No way to support split deposits (partially cash, partially card)

### 1.2 What's Needed
- Track deposit collection and return with `destination` (cash/tbank/sber)
- Support split deposits: e.g., 5000₽ cash + 15000₽ on T-Bank
- Show deposit info on rental card (analytics page)
- Accessible via skill (`deposit-tracer-text`)
- Admin debug page for visual tracking

---

## 2. DATABASE CHANGES

### 2.1 New Table: `public.deposit_entries`

Each row = one deposit money movement. A single rental can have multiple entries (split deposit = 2 rows).

```sql
-- Migration: 20260810000010_create_deposit_entries.sql

CREATE TABLE IF NOT EXISTS public.deposit_entries (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rental_id       UUID NOT NULL REFERENCES public.rentals(rental_id) ON DELETE CASCADE,

  -- What kind of deposit movement
  entry_type      TEXT NOT NULL CHECK (entry_type IN (
    'deposit_collected',    -- Депозит получен (at handout)
    'deposit_returned',     -- Депозит возвращён (at return)
    'penalty'               -- Удержание из депозита (damage, missing fuel, etc.)
  )),

  -- Amount and direction
  amount          NUMERIC NOT NULL CHECK (amount >= 0),
  direction       TEXT NOT NULL CHECK (direction IN ('in', 'out')),
  -- 'in' = money came TO the business (deposit collected)
  -- 'out' = money left the business (deposit returned, penalty withheld)

  -- WHERE the money went (THE KEY ENHANCEMENT)
  destination     TEXT NOT NULL CHECK (destination IN (
    'cash',     -- Наличные
    'tbank',    -- Карта Тинькофф (card 1, default)
    'sber'      -- Карта Сбербанк (card 2)
  )),

  -- Who and when (nullable — auto-returns by the system have no operator)
  operator_chat_id TEXT,

  -- Notes (e.g., "Partial: 5000 cash + 15000 T-Bank" or "Withheld for scratched fairing")
  notes           TEXT,

  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_deposit_entries_rental ON public.deposit_entries(rental_id);
CREATE INDEX idx_deposit_entries_destination ON public.deposit_entries(destination);
CREATE INDEX idx_deposit_entries_type ON public.deposit_entries(entry_type);
CREATE INDEX idx_deposit_entries_date ON public.deposit_entries(created_at);
CREATE INDEX idx_deposit_entries_operator ON public.deposit_entries(operator_chat_id);

-- RLS: crew members can read, crew owners can manage
ALTER TABLE public.deposit_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Crew members can read deposit entries"
  ON public.deposit_entries FOR SELECT
  TO authenticated USING (
    EXISTS (SELECT 1 FROM public.rentals r
            JOIN public.cars c ON c.id = r.vehicle_id
            JOIN public.crews crew ON crew.id = c.crew_id
            WHERE r.rental_id = deposit_entries.rental_id
              AND (
                crew.owner_id = auth.jwt() ->> 'chat_id'
                OR EXISTS (SELECT 1 FROM public.crew_members cm
                           WHERE cm.crew_id = crew.id
                             AND cm.user_id = auth.jwt() ->> 'chat_id'
                             AND cm.membership_status = 'active')
              ))
  );
CREATE POLICY "Crew owners/managers can manage deposit entries"
  ON public.deposit_entries FOR ALL
  TO authenticated USING (
    EXISTS (SELECT 1 FROM public.rentals r
            JOIN public.cars c ON c.id = r.vehicle_id
            JOIN public.crews crew ON crew.id = c.crew_id
            WHERE r.rental_id = deposit_entries.rental_id
              AND (
                crew.owner_id = auth.jwt() ->> 'chat_id'
                OR EXISTS (SELECT 1 FROM public.crew_members cm
                           WHERE cm.crew_id = crew.id
                             AND cm.user_id = auth.jwt() ->> 'chat_id'
                             AND cm.role IN ('admin', 'co_owner')
                             AND cm.membership_status = 'active')
              ))
  );

-- View: daily deposit summary by destination
CREATE OR REPLACE VIEW public.daily_deposit_summary AS
SELECT
  DATE(de.created_at AT TIME ZONE 'Europe/Moscow') as flow_date,
  de.destination,
  de.entry_type,
  SUM(CASE WHEN de.direction = 'in' THEN de.amount ELSE 0 END) as total_in,
  SUM(CASE WHEN de.direction = 'out' THEN de.amount ELSE 0 END) as total_out,
  SUM(CASE WHEN de.direction = 'in' THEN de.amount ELSE -de.amount END) as net,
  COUNT(*) as entry_count
FROM public.deposit_entries de
GROUP BY DATE(de.created_at AT TIME ZONE 'Europe/Moscow'), de.destination, de.entry_type
ORDER BY flow_date DESC, destination;
```

### 2.2 Backfill from `deposit_log`

```sql
INSERT INTO public.deposit_entries (rental_id, entry_type, amount, direction, destination, operator_chat_id, notes, created_at)
SELECT
  dl.rental_id::UUID,
  CASE WHEN dl.action = 'collected' THEN 'deposit_collected' ELSE 'deposit_returned' END,
  dl.amount,
  CASE WHEN dl.action = 'collected' THEN 'in' ELSE 'out' END,
  'cash', -- all existing are cash
  dl.operator_chat_id,
  dl.notes,
  dl.created_at
FROM public.deposit_log dl
WHERE NOT EXISTS (
  SELECT 1 FROM public.deposit_entries de
  WHERE de.rental_id = dl.rental_id::UUID
    AND de.created_at = dl.created_at
);
```

### 2.3 Keep `deposit_log` for backward compat

Don't drop `deposit_log` — existing code writes to it. New code writes to `deposit_entries` (and optionally also to `deposit_log` during transition).

---

## 3. DOC-MANUAL INTEGRATION

### 3.1 Deposit Collection Step Enhancement

**Current** `deposit_choice` state (line 341):
```
[✅ Депозит 20 000 ₽]  [✏️ Своя сумма]  [🪪 СТС]  [❌ Отменить]
```

**Enhanced** — after choosing deposit amount, ask WHERE it was collected:

**New state:** `deposit_destination` — placed **after `deposit_choice`, before `confirm`** (flow order: `equipment` → `payment_split` → `deposit_choice` → `deposit_destination` → `confirm`). ✅ IMPLEMENTED in `doc-manual.ts` as step 15/16 (2026-08-10). *v2.0 incorrectly said "between `deposit_choice` and `equipment`" — equipment comes much earlier in the flow.*

```
Депозит: 20 000 ₽
Где получен?

[💵 Всё наличными]
[💳 Всё на Тинькофф]
[💳 Всё на Сбербанк]
[🔀 Смешанный]
```

**If "Смешанный" (split):**
```
Смешанный депозит: 20 000 ₽
Сколько наличными?

(operator types: 5000)

Остаток: 15 000 ₽
Куда?

[💳 Тинькофф]  [💳 Сбербанк]
```

**New DocFlowContext fields:**
```typescript
// Deposit destination(s) — supports split
depositCashAmount?: number;      // cash portion (0 if all card)
depositCardDestination?: 'tbank' | 'sber';  // which card for the card portion
depositCardAmount?: number;      // card portion (0 if all cash)
```

**On confirm:** Insert ONE OR TWO rows into `deposit_entries`:
```sql
-- If all cash:
INSERT INTO deposit_entries (rental_id, entry_type, amount, direction, destination, operator_chat_id, notes)
VALUES ($rentalId, 'deposit_collected', 20000, 'in', 'cash', $userId, 'Deposit collected via /doc');

-- If split (5000 cash + 15000 T-Bank):
INSERT INTO deposit_entries (rental_id, entry_type, amount, direction, destination, operator_chat_id, notes)
VALUES ($rentalId, 'deposit_collected', 5000, 'in', 'cash', $userId, 'Deposit (cash portion)');

INSERT INTO deposit_entries (rental_id, entry_type, amount, direction, destination, operator_chat_id, notes)
VALUES ($rentalId, 'deposit_collected', 15000, 'in', 'tbank', $userId, 'Deposit (T-Bank portion)');
```

### 3.2 Deposit Return on Rental Completion

✅ **IMPLEMENTED** — `supabase/migrations/20260810000011_deposit_auto_return_trigger.sql` (2026-08-10). Covers both `completed` and `cancelled` transitions.

Auto-create `deposit_returned` entries — copies destinations from the original collection:

```sql
-- Trigger on rentals.status → 'completed':
-- For each deposit_collected entry, create a matching deposit_returned entry
-- with the SAME destination and proportional amount.
-- operator_chat_id is NULL for auto-returns (system-generated, no human operator).
INSERT INTO public.deposit_entries (rental_id, entry_type, amount, direction, destination, operator_chat_id, notes)
SELECT
  NEW.rental_id, 'deposit_returned', de.amount, 'out', de.destination,
  NULL, 'Auto-returned on rental completion'
FROM public.deposit_entries de
WHERE de.rental_id = NEW.rental_id AND de.entry_type = 'deposit_collected';
```

This returns each portion to its original destination — if 5000 was cash and 15000 was on T-Bank, the return creates two entries: 5000 cash out + 15000 T-Bank out.

**Idempotency requirement (NEW in v2.1):** auto-return must fire AT MOST ONCE per collected entry. If a rental is re-opened (`completed` → `active`) and later re-completed, no duplicate `deposit_returned` rows may be created.

### 3.2a 🔴 KNOWN BUG — completed-path trigger lacks the double-return guard

`auto_return_deposit_entries()` (the `completed` path) inserts returns unconditionally. The code comment even says *"the insert above is idempotent only if we add a guard. Let's add a guard to prevent double-returns"* — **but no guard follows**. The cancellation-path function `auto_return_deposit_on_cancel()` DOES have the `NOT EXISTS` guard.

**Impact:** rental re-opened then re-completed → duplicate `deposit_returned` rows → wrong balances in `daily_deposit_summary` and `getDepositSummary`.

**Fix (apply as a follow-up migration):** add the same guard the cancel path already uses:

```sql
-- Inside auto_return_deposit_entries(), extend the SELECT with:
AND NOT EXISTS (
  SELECT 1 FROM public.deposit_entries ret
  WHERE ret.rental_id = de.rental_id
    AND ret.entry_type = 'deposit_returned'
    AND ret.destination = de.destination
    AND ret.amount = de.amount
);
```

**Also required:** a one-time dedup query for production data if any rental was completed twice since 2026-08-10.

### 3.3 Penalty Withholding

⏳ **NOT YET IMPLEMENTED (spec only, 2026-08-11 audit).** Aggregation support exists in `app/franchize/server-actions/deposit-entries.ts` (`totalPenalty`, per-destination `penalty`), and the `penalty` entry_type is in the schema CHECK — but **no insert path exists**: no doc-manual state, no operator UI, no API endpoint writes `penalty` rows. Tracked in the meta plan (Iteration I2).

If the operator deducts from the deposit (damage, missing fuel, etc.):

```
Возврат депозита: 20 000 ₽
Удержать за повреждения?

[✅ Без удержаний]  [✏️ Указать сумму]

(operator types: 3000)

Удержание: 3 000 ₽
Возврат: 17 000 ₽
Куда вернуть остаток?

[💵 Наличные]  [💳 Тинькофф]  [💳 Сбербанк]
```

Creates TWO entries:
- `penalty` 3000₽ direction=out destination=cash/tbank/sber (withheld)
- `deposit_returned` 17000₽ direction=out destination=cash/tbank/sber (returned)

---

## 4. RENTAL CARD INTEGRATION

### 4.1 Show Deposit Info on Rental Card

**File:** `app/franchize/[slug]/rentals-analytics/components/AnalyticsRentalCard.tsx` (or equivalent)

Add deposit badge to each rental card:
```tsx
{/* Deposit status badge */}
{depositSummary && (
  <div className="flex items-center gap-2">
    {depositSummary.totalCollected > 0 && (
      <span className="text-xs px-2 py-0.5 rounded-full font-medium"
            style={{ backgroundColor: 'rgba(34,197,94,0.1)', color: '#22c55e' }}>
        Депозит: {depositSummary.totalCollected.toLocaleString('ru-RU')}₽
      </span>
    )}
    {depositSummary.destinations.map(d => (
      <span key={d.destination} className="text-[10px]" style={{ color: textSecondary }}>
        {d.destination === 'cash' ? '💵' : d.destination === 'tbank' ? '💳Т' : '💳С'}
        {d.amount.toLocaleString('ru-RU')}₽
      </span>
    ))}
    {depositSummary.totalReturned > 0 && (
      <span className="text-xs" style={{ color: textSecondary }}>
        → возвращено {depositSummary.totalReturned.toLocaleString('ru-RU')}₽
      </span>
    )}
    {depositSummary.totalPenalty > 0 && (
      <span className="text-xs px-2 py-0.5 rounded-full" style={{ backgroundColor: 'rgba(239,68,68,0.1)', color: '#ef4444' }}>
        Удержание: {depositSummary.totalPenalty.toLocaleString('ru-RU')}₽
      </span>
    )}
  </div>
)}
```

**Example display:**
```
Депозит: 20 000₽  💵5 000₽ 💳Т15 000₽  → возвращено 20 000₽
```

### 4.2 New Server Action: `getDepositSummary(rentalId)`

✅ **IMPLEMENTED** — `app/franchize/server-actions/deposit-entries.ts` (with `getDepositEntriesForDate`, `getDailyDepositSummary`; tests in `tests/franchize/deposit-entries.spec.ts`). Returns `null` for empty rentalId / no entries.

**Actual shipped signature** (supersedes the v2.0 sketch — destinations carry full aggregates, not amount/direction pairs):

```typescript
export async function getDepositSummary(rentalId: string): Promise<{
  totalCollected: number;
  totalReturned: number;
  totalPenalty: number;
  balance: number; // collected - returned - penalty
  destinations: Array<{
    destination: string;   // 'cash' | 'tbank' | 'sber'
    collected: number;
    returned: number;
    penalty: number;
    net: number;           // collected - returned - penalty
  }>;
  entries: Array<{ entryType: string; amount: number; destination: string; direction: string; notes: string; createdAt: string }>;
} | null>
```

---

## 5. ADMIN DEBUG PAGE

### 5.1 `/franchize/[slug]/admin/deposits`

**Filters:**
- Date picker (default: today)
- Destination filter: All / 💵 Cash / 💳 T-Bank / 💳 Sber
- Entry type filter: All / Collected / Returned / Penalty

**Summary cards:**
```
┌──────────────┐ ┌──────────────┐ ┌──────────────┐
│ 💵 Наличные   │ │ 💳 Тинькофф   │ │ 💳 Сбербанк   │
│              │ │              │ │              │
│ +15 000₽    │ │ +40 000₽    │ │ +0₽         │
│ -5 000₽     │ │ -0₽         │ │ -0₽         │
│ ─────────   │ │ ─────────   │ │ ─────────   │
│ Итого: 10к  │ │ Итого: 40к  │ │ Итого: 0    │
└──────────────┘ └──────────────┘ └──────────────┘
```

**Table:**
| Time | Rental | Type | Amount | Destination | Operator |
|------|--------|------|--------|-------------|----------|
| 12:11 | kawasaki-ex650k | 💰 Collected | +5 000₽ | 💵 Cash | DJORUDJOV |
| 12:11 | kawasaki-ex650k | 💰 Collected | +15 000₽ | 💳 T-Bank | DJORUDJOV |
| 16:00 | kawasaki-ex650k | ↩️ Returned | -5 000₽ | 💵 Cash | system |
| 16:00 | kawasaki-ex650k | ↩️ Returned | -15 000₽ | 💳 T-Bank | system |

Color-coded: green = `in`, red = `out`.

---

## 6. SKILL: `deposit-tracer-text`

```
Trigger phrases: "где депозиты", "статус депозитов", "депозиты на картах",
"cash or card", "deposit trace", "депозиты сегодня", "куда пришли деньги",
"сколько на картах"

Commands:
1. deposit-list [--date YYYY-MM-DD] [--destination cash|tbank|sber]
   Lists all deposit_entries for a date, filtered by destination.
   Shows: time, rental (bike title), type, amount, destination, operator
   Example output:
   12:11 kawasaki-ex650k 💰 Collected +5 000₽ 💵 Cash by DJORUDJOV
   12:11 kawasaki-ex650k 💰 Collected +15 000₽ 💳 T-Bank by DJORUDJOV
   14:30 ducati-panigale 💰 Collected +20 000₽ 💳 Sber by Roman
   16:00 kawasaki-ex650k ↩️ Returned -20 000₽ (split: 5k cash + 15k T-Bank)

2. deposit-balance [--from YYYY-MM-DD] [--to YYYY-MM-DD]
   Summary per destination:
   💵 Cash:     +45 000 collected, -30 000 returned, -3 000 penalty, net: 12 000
   💳 T-Bank:   +55 000 collected, -15 000 returned, net: 40 000
   💳 Sber:     +20 000 collected, -0 returned, net: 20 000
   ─────────
   Total:       +120 000 collected, -45 000 returned, -3 000 penalty, net: 72 000

3. deposit-rental <rentalId>
   Shows all deposit_entries for a specific rental:
   12:11 deposit_collected +5 000₽ cash by DJORUDJOV (cash portion)
   12:11 deposit_collected +15 000₽ tbank by DJORUDJOV (T-Bank portion)
   16:00 deposit_returned -5 000₽ cash (auto-return)
   16:00 deposit_returned -15 000₽ tbank (auto-return)
   ─────────
   Total collected: 20 000₽ (split: 5k cash + 15k T-Bank)
   Total returned: 20 000₽
   Penalty: 0₽

4. deposit-card <tbank|sber> [--date YYYY-MM-DD]
   Shows all money that went to a specific card today:
   12:11 deposit_collected +15 000₽ (kawasaki-ex650k)
   14:30 deposit_collected +40 000₽ (ducati-panigale)
   ─────────
   Total on T-Bank today: +55 000₽
   Returned today: -15 000₽
   Net on T-Bank: +40 000₽
```

---

## 7. RELATIONSHIP TO `rental_handoffs`

The `rental_handoffs` migration (`20260623000003_rental_handoffs.sql`) tracks the **physical** handout/return checklist (odometer, equipment, damage notes). The `deposit_entries` table tracks the **financial** movements (where money went).

Both link to `rentals.rental_id` via FK. They are complementary:
- `rental_handoffs` = "Did we check the passport? What was the odometer? Was there damage?"
- `deposit_entries` = "How much deposit was collected? Was it cash or card? Which card? Was it returned?"

**Apply `rental_handoffs` migration first** — ✅ DONE (applied 2026-08-10, fixed `auth.jwt() ->> 'chat_id'`).

---

## 8. CORNER CASES

| Scenario | What happens |
|----------|-------------|
| All cash deposit (20 000₽) | 1 row: `deposit_collected 20000 in cash` |
| All T-Bank deposit (20 000₽) | 1 row: `deposit_collected 20000 in tbank` |
| All Sber deposit (20 000₽) | 1 row: `deposit_collected 20000 in sber` |
| Split: 5000 cash + 15000 T-Bank | 2 rows: `5000 in cash` + `15000 in tbank` |
| Split: 5000 cash + 15000 Sber | 2 rows: `5000 in cash` + `15000 in sber` |
| Split: 10000 T-Bank + 10000 Sber | **NOT SUPPORTED** — split is cash + ONE card only. If operator needs 2 cards, they collect one card, then manually add a second entry via admin page |
| СТС instead of deposit | 0 rows — no cash deposit collected. `deposit_destination` step skipped entirely |
| Deposit = 0 (free rental) | 0 rows — `deposit_destination` step skipped (nothing to track) |
| Custom deposit amount (15000 instead of 20000) | `deposit_choice` → custom → `deposit_destination` → pick where |
| Penalty: 3000 withheld for damage | `penalty 3000 out` + `deposit_returned 17000 out` (both to original destination(s)) |
| Auto-return on completion | For each `deposit_collected` row, create matching `deposit_returned` row with SAME destination + amount |
| Auto-return with split deposit | 2 return rows: `5000 out cash` + `15000 out tbank` |
| Manual return (operator returns less than collected) | Operator specifies amount + destination. May differ from collection (e.g., collected 20k cash, return 17k on T-Bank — penalty scenario) |
| Deposit returned partially, then rest later | 2 separate `deposit_returned` entries with different timestamps |
| Rental cancelled before return | `deposit_returned` entries created with full amount, same destination(s) |
| Multiple deposits on same rental (re-collect) | Allowed — multiple `deposit_collected` rows. ⚠️ **Corrected in v2.1:** the auto-return trigger creates a return for **EVERY** collected row (not "the most recent collection" as v2.0 said). Net effect is the same when amounts match; with differing amounts the return total = sum of ALL collections |

---

## 9. SKILLS & PAGES THAT BENEFIT

| Skill/Page | Enhancement |
|------------|------------|
| `deposit-tracer-text` (NEW) | Full deposit querying: list, balance, per-rental, per-card |
| `rental-card-text` | Show deposit destination breakdown: "Депозит: 20к (💵5к + 💳Т15к)" |
| `rental-analytics-text` | `rental-detail` command shows deposit history for a rental |
| `leads-crm-text` | Lead card shows if deposit was collected (green badge) or pending |
| Evening digest (`evening-summary.sh`) | Add deposit summary section: "💵 Cash: +15к, 💳 T-Bank: +40к, 💳 Sber: +0" |
| Morning standup (`morning-standup.sh`) | Show yesterday's deposit balance per card |
| Profile page "My Work" | Show deposits collected today by this operator, per destination |
| `/franchize/[slug]/admin/deposits` (NEW) | Visual deposit tracker with date/destination filters |
| `/franchize/[slug]/rentals-analytics` | Rental card badge: 💰 20к (💵5к 💳Т15к) → returned |
| `/franchize/[slug]/sales-analytics` | No deposit tracking (sales don't have deposits) |
| `vip-bike-ops` skill | "Полная сводка за день" includes deposit per-card summary |
| `analytics-text` | "Сколько на картах?" → deposit-balance command |

---

## 10. IMPLEMENTATION PLAN

1. ✅ **DONE:** `rental_handoffs` migration applied (2026-08-10, fixed auth.jwt())
2. ✅ **DONE (2026-08-10):** Migration `20260810000010_create_deposit_entries.sql` (table + view + RLS + backfill from deposit_log)
3. ✅ **DONE (2026-08-10):** `deposit_destination` state after `deposit_choice` — `doc-manual.ts:400` (step 15/16)
4. ✅ **DONE (2026-08-10):** Split deposits (cash + one card) — `deposit_split_cash`/`deposit_split_card` states (`doc-manual.ts:3199/3228`)
5. ✅ **DONE (2026-08-10):** Insert into `deposit_entries` on collection — `doc-manual.ts:432-495`
6. ⚠️ **DONE WITH BUG (2026-08-10):** Auto-return trigger `20260810000011` — completed path missing double-return guard, **fix per §3.2a**
7. ⏳ **Rental card:** Show deposit badge with destination breakdown
8. ⏳ **Admin page:** `/franchize/[slug]/admin/deposits` visual tracker
9. ⏳ **Skill:** `deposit-tracer-text` for text-based deposit queries
10. ⏳ **Evening digest:** Add deposit summary per card to `evening-summary.sh`
11. ⏳ **Morning standup:** Add previous day's deposit balance
12. ⏳ **Profile page "My Work":** Show deposits collected today per destination
13. ⏳ **NEW (v2.1):** Penalty capture flow (§3.3) — doc-manual state or admin UI insert path

---

**Document History:**
- v1.0 (2026-08-10): Initial draft — too many entry_types (rental_payment, sale_payment, etc.)
- v2.0 (2026-08-10): Simplified — deposits ONLY (collected/returned/penalty). Removed Stars. Added split deposit support. Added rental card integration. Added skill access.
- v2.1 (2026-08-11): Post-implementation audit. Status → Partially Implemented. Added §3.2a (completed-path trigger missing double-return guard — fix required). Fixed §3.1 placement (deposit_destination is after deposit_choice, before confirm — not "before equipment"). Fixed §4.2 to actual shipped signature (per-destination collected/returned/penalty/net). Fixed §8 re-collect corner case (trigger returns ALL collected rows). Marked §3.3 penalty as spec-only (no insert path). Implementation plan checkmarks synced to reality.

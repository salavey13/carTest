-- ═══════════════════════════════════════════════════════════════════════════
-- Create deposit_entries table — tracks WHERE deposit money went
-- (cash / tbank / sber) with split support.
--
-- Each row = one deposit money movement. A rental can have multiple entries
-- (split deposit = 2+ rows: e.g., 5000 cash + 15000 T-Bank).
--
-- Replaces the narrow deposit_log (which only had method='cash' in production).
-- deposit_log stays for backward compat; new code writes to deposit_entries.
-- ═══════════════════════════════════════════════════════════════════════════

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
CREATE INDEX IF NOT EXISTS idx_deposit_entries_rental ON public.deposit_entries(rental_id);
CREATE INDEX IF NOT EXISTS idx_deposit_entries_destination ON public.deposit_entries(destination);
CREATE INDEX IF NOT EXISTS idx_deposit_entries_type ON public.deposit_entries(entry_type);
CREATE INDEX IF NOT EXISTS idx_deposit_entries_date ON public.deposit_entries(created_at);
CREATE INDEX IF NOT EXISTS idx_deposit_entries_operator ON public.deposit_entries(operator_chat_id);

-- RLS: crew members can read, crew owners/admins can manage
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

CREATE POLICY "Crew owners and admins can manage deposit entries"
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

-- Backfill from deposit_log (all existing rows are method='cash')
INSERT INTO public.deposit_entries (rental_id, entry_type, amount, direction, destination, operator_chat_id, notes, created_at)
SELECT
  dl.rental_id::UUID,
  CASE WHEN dl.action = 'collected' THEN 'deposit_collected' ELSE 'deposit_returned' END,
  dl.amount,
  CASE WHEN dl.action = 'collected' THEN 'in' ELSE 'out' END,
  'cash',
  dl.operator_chat_id,
  dl.notes,
  dl.created_at
FROM public.deposit_log dl
WHERE NOT EXISTS (
  SELECT 1 FROM public.deposit_entries de
  WHERE de.rental_id = dl.rental_id::UUID
    AND de.created_at = dl.created_at
);

-- Verification
SELECT 'deposit_entries' AS table_name, COUNT(*) AS backfilled_rows FROM public.deposit_entries;
SELECT 'daily_deposit_summary' AS view_name, COUNT(*) AS rows FROM public.daily_deposit_summary;

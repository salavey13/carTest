-- ─────────────────────────────────────────────────────────────────────────
-- VIP Bike dashboard — TODO table migration
-- Apply manually via Supabase SQL editor:
--   https://supabase.com/dashboard/project/inmctohsodgdohamhzag/sql/new
-- ─────────────────────────────────────────────────────────────────────────
-- Idempotent: safe to re-run (IF NOT EXISTS on every object).

CREATE TABLE IF NOT EXISTS public.todos (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date        DATE NOT NULL,                       -- operator's local date
  text        TEXT NOT NULL,
  done        BOOLEAN NOT NULL DEFAULT FALSE,
  source      TEXT NOT NULL DEFAULT 'manual',      -- 'manual' | 'telegram-bot'
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_todos_date ON public.todos(date);

-- Allow service_role full access (dashboard backend uses service key).
-- Allow anon/authenticated read-only for now (so Telegram bot can insert via RLS-protected path later).
GRANT ALL ON public.todos TO service_role;
GRANT SELECT ON public.todos TO anon, authenticated;

-- Optional: enable RLS for stricter control once Telegram bot gets its own key.
-- ALTER TABLE public.todos ENABLE ROW LEVEL SECURITY;
-- CREATE POLICY "service_role can do everything" ON public.todos
--   FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');

-- ─────────────────────────────────────────────────────────────────────────
-- Optional: trigger to auto-update updated_at on row change
-- ─────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_todos_updated_at ON public.todos;
CREATE TRIGGER trg_todos_updated_at
  BEFORE UPDATE ON public.todos
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

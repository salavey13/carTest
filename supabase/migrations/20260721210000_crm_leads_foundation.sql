-- ═══════════════════════════════════════════════════════════════════════════
-- supabase/migrations/20260721210000_crm_leads_foundation.sql
-- §13.4c #8 — Stable CRM lead UUID foundation
--
-- Создаёт таблицу crm_leads с каноническим UUID для каждого лида.
-- Решает проблему фрагментации identity (см. franchise-identity-flow-audit.md §1):
--   - Один лид = один UUID навсегда
--   - Телефон, Telegram ID, rental_id, artifact_id — всё линкуется к этому UUID
--   - При смене identity (QR claim) UUID не меняется
--
-- Это фундамент. Интеграция в существующие таблицы (rentals, artifacts, todos,
-- intents, lead_notes) — следующий этап.
--
-- Идемпотентно. Безопасно для повторного запуска.
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── Step 1: Create crm_leads table ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.crm_leads (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Канонические identity-поля (устанавливаются при создании, не меняются)
  phone         TEXT,           -- E.164, если известен
  telegram_id   TEXT,           -- Telegram chat id, если известен
  -- Метаданные
  display_name  TEXT,           -- Человекочитаемое имя (first known name)
  source        TEXT,           -- Откуда появился: 'doc_manual', 'web_flow', 'auto'
  metadata      JSONB NOT NULL DEFAULT '{}',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for fast lookup
CREATE INDEX IF NOT EXISTS idx_crm_leads_phone ON public.crm_leads(phone)
  WHERE phone IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_crm_leads_telegram_id ON public.crm_leads(telegram_id)
  WHERE telegram_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_crm_leads_created_at ON public.crm_leads(created_at);

-- ─── Step 2: Link tables ──────────────────────────────────────────────────
-- Связь crm_lead → rental (один лид → много аренд)
CREATE TABLE IF NOT EXISTS public.crm_lead_rentals (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  crm_lead_id UUID NOT NULL REFERENCES public.crm_leads(id) ON DELETE CASCADE,
  rental_id   UUID NOT NULL REFERENCES public.rentals(rental_id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(rental_id)  -- Одна аренда → один лид
);

CREATE INDEX IF NOT EXISTS idx_crm_lead_rentals_lead ON public.crm_lead_rentals(crm_lead_id);
CREATE INDEX IF NOT EXISTS idx_crm_lead_rentals_rental ON public.crm_lead_rentals(rental_id);

-- Связь crm_lead → artifact (один лид → много артефактов)
CREATE TABLE IF NOT EXISTS public.crm_lead_artifacts (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  crm_lead_id     UUID NOT NULL REFERENCES public.crm_leads(id) ON DELETE CASCADE,
  artifact_type   TEXT NOT NULL CHECK (artifact_type IN ('rental', 'sale', 'subrent')),
  artifact_id     UUID NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(artifact_type, artifact_id)
);

CREATE INDEX IF NOT EXISTS idx_crm_lead_artifacts_lead ON public.crm_lead_artifacts(crm_lead_id);

-- ─── Step 3: Helper function — resolve or create CRM lead ─────────────────
-- Ищет существующий CRM lead по телефону, telegram_id или rental_id.
-- Если не находит — создаёт новый.
CREATE OR REPLACE FUNCTION public.resolve_crm_lead(
  p_phone         TEXT DEFAULT NULL,
  p_telegram_id   TEXT DEFAULT NULL,
  p_rental_id     UUID DEFAULT NULL,
  p_display_name  TEXT DEFAULT NULL,
  p_source        TEXT DEFAULT 'auto'
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_crm_lead_id UUID;
BEGIN
  -- 1. Try by rental_id (strongest match)
  IF p_rental_id IS NOT NULL THEN
    SELECT crm_lead_id INTO v_crm_lead_id
    FROM crm_lead_rentals
    WHERE rental_id = p_rental_id;
    IF FOUND THEN
      RETURN v_crm_lead_id;
    END IF;
  END IF;

  -- 2. Try by telegram_id
  IF p_telegram_id IS NOT NULL THEN
    SELECT id INTO v_crm_lead_id
    FROM crm_leads
    WHERE telegram_id = p_telegram_id;
    IF FOUND THEN
      -- Link rental if provided
      IF p_rental_id IS NOT NULL THEN
        INSERT INTO crm_lead_rentals (crm_lead_id, rental_id)
        VALUES (v_crm_lead_id, p_rental_id)
        ON CONFLICT (rental_id) DO NOTHING;
      END IF;
      RETURN v_crm_lead_id;
    END IF;
  END IF;

  -- 3. Try by phone
  IF p_phone IS NOT NULL THEN
    SELECT id INTO v_crm_lead_id
    FROM crm_leads
    WHERE phone = p_phone;
    IF FOUND THEN
      -- Update telegram_id if discovered
      IF p_telegram_id IS NOT NULL AND (v_crm_lead_id IS NOT NULL) THEN
        UPDATE crm_leads SET telegram_id = p_telegram_id
        WHERE id = v_crm_lead_id AND telegram_id IS NULL;
      END IF;
      -- Link rental if provided
      IF p_rental_id IS NOT NULL THEN
        INSERT INTO crm_lead_rentals (crm_lead_id, rental_id)
        VALUES (v_crm_lead_id, p_rental_id)
        ON CONFLICT (rental_id) DO NOTHING;
      END IF;
      RETURN v_crm_lead_id;
    END IF;
  END IF;

  -- 4. Not found — create new CRM lead
  INSERT INTO crm_leads (phone, telegram_id, display_name, source)
  VALUES (p_phone, p_telegram_id, p_display_name, p_source)
  RETURNING id INTO v_crm_lead_id;

  -- Link rental if provided
  IF p_rental_id IS NOT NULL THEN
    INSERT INTO crm_lead_rentals (crm_lead_id, rental_id)
    VALUES (v_crm_lead_id, p_rental_id)
    ON CONFLICT (rental_id) DO NOTHING;
  END IF;

  RETURN v_crm_lead_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.resolve_crm_lead TO service_role, authenticated;

-- ─── Step 4: Trigger — auto-update crm_leads.updated_at ───────────────────
DROP TRIGGER IF EXISTS update_crm_leads_updated_at ON public.crm_leads;
CREATE TRIGGER update_crm_leads_updated_at
  BEFORE UPDATE ON public.crm_leads
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ─── Step 5: Verify ────────────────────────────────────────────────────────
DO $$
BEGIN
  RAISE NOTICE 'crm_leads foundation created: tables + resolve_crm_lead() ready';
END;
$$;

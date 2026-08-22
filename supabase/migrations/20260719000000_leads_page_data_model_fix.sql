-- ─────────────────────────────────────────────────────────────────────────────
-- VIP Bike — leads page data model fix
-- 2026-07-19
--
-- 1. Add renter_phone to rental_contract_artifacts (private)
-- 2. Add buyer_phone to sale_contract_artifacts (private)
-- 3. Add user_id + phone to crew_todos (public)
-- 4. Backfill existing data
-- 5. Add renter_full_name index to rental_contract_artifacts
-- ─────────────────────────────────────────────────────────────────────────────

-- ═════════════════════════════════════════════════════════════════════════════
-- PART 1: rental_contract_artifacts (private)
-- ═════════════════════════════════════════════════════════════════════════════

ALTER TABLE private.rental_contract_artifacts
  ADD COLUMN IF NOT EXISTS renter_phone TEXT;

COMMENT ON COLUMN private.rental_contract_artifacts.renter_phone IS
  'Phone number of the renter (if provided during /doc flow). Used for lead matching on the leads page.';

-- ═════════════════════════════════════════════════════════════════════════════
-- PART 2: sale_contract_artifacts (private)
-- ═════════════════════════════════════════════════════════════════════════════

ALTER TABLE private.sale_contract_artifacts
  ADD COLUMN IF NOT EXISTS buyer_phone TEXT;

COMMENT ON COLUMN private.sale_contract_artifacts.buyer_phone IS
  'Phone number of the buyer (if provided during /doc sale flow). Used for lead matching.';

-- ═════════════════════════════════════════════════════════════════════════════
-- PART 3: crew_todos (public)
-- ═════════════════════════════════════════════════════════════════════════════

-- user_id: Telegram chat_id of the client/lead (numeric)
ALTER TABLE public.crew_todos
  ADD COLUMN IF NOT EXISTS user_id TEXT;

-- phone: Phone number of the client (nullable)
ALTER TABLE public.crew_todos
  ADD COLUMN IF NOT EXISTS phone TEXT;

COMMENT ON COLUMN public.crew_todos.user_id IS
  'Telegram chat_id of the client/lead this todo is linked to. Matches users.user_id.';
COMMENT ON COLUMN public.crew_todos.phone IS
  'Phone number of the client (optional, for phone-only leads).';

CREATE INDEX IF NOT EXISTS idx_crew_todos_user_id
  ON public.crew_todos(user_id)
  WHERE user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_crew_todos_phone
  ON public.crew_todos(phone)
  WHERE phone IS NOT NULL;

-- ═════════════════════════════════════════════════════════════════════════════
-- PART 4: Backfill existing crew_todos data
-- ═════════════════════════════════════════════════════════════════════════════

-- 4a. Numeric Telegram IDs (≤9 digits) → user_id
--     These are Telegram chat IDs (could be operator's or client's — we move
--     them honestly; the QR claim flow later re-links to the real client).
UPDATE public.crew_todos
SET user_id = lead_id
WHERE lead_id IS NOT NULL
  AND lead_id ~ '^\d{1,9}$'
  AND user_id IS NULL;

-- 4b. Phone numbers (Russian format: +7XXXXXXXXXX, 7XXXXXXXXXX, 8XXXXXXXXXX)
--     → phone column
UPDATE public.crew_todos
SET phone = lead_id
WHERE lead_id IS NOT NULL
  AND lead_id ~ '^(\+?7|8)\d{10}$'
  AND phone IS NULL;

-- 4c. Update the description JSON to also carry user_id and phone for future
--     backward compatibility. We DON'T touch existing JSON — new code will
--     write the new fields going forward.

-- ═════════════════════════════════════════════════════════════════════════════
-- PART 5: Backfill rental_contract_artifacts.renter_phone from user_rental_secrets
-- ═════════════════════════════════════════════════════════════════════════════

-- If a rental_contract_artifact has an original_sha256 matching a
-- user_rental_secret's doc_sha256, and the artifact's renter_phone is null,
-- copy the phone from the secret.
UPDATE private.rental_contract_artifacts a
SET renter_phone = s.renter_phone
FROM private.user_rental_secrets s
WHERE a.original_sha256 = s.doc_sha256
  AND a.renter_phone IS NULL
  AND s.renter_phone IS NOT NULL;

-- ═════════════════════════════════════════════════════════════════════════════
-- PART 6: Backfill sale_contract_artifacts.buyer_phone from metadata
-- ═════════════════════════════════════════════════════════════════════════════

-- sale_contract_artifacts doesn't have a phone column yet, so no existing
-- phone data to backfill. The buyer_phone will be populated by future /doc
-- sale flows.

-- ─────────────────────────────────────────────────────────────────────────────
-- Done
-- ─────────────────────────────────────────────────────────────────────────────

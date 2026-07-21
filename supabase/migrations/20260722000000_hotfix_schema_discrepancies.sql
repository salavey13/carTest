-- ═══════════════════════════════════════════════════════════════════════════
-- /supabase/migrations/20260722000000_hotfix_schema_discrepancies.sql
-- HOTFIX: Eliminate discrepancies between code expectations and actual DB schema
--
-- Discovered during production data verification (2026-07-22) by querying
-- live Supabase (inmctohsodgdohamhzag.supabase.co) and comparing with
-- code assumptions in leads.ts, crew-todos.ts, lib/leads.ts, etc.
--
-- Issues fixed:
--   1. franchize_intents: code reads metadata.operatorId (correct) but some
--      old code paths tried to select created_by_operator_chat_id (doesn't exist)
--   2. public.users: lib/leads.ts writes phone: phone to users table (column
--      doesn't exist — should only be in metadata.phone). Already fixed in code
--      (audit NEW #3) but document here for reference.
--   3. sale_contract_artifacts.total_sum is NULL for all 7 rows — backfill
--      from sale_price (text) by stripping spaces and converting to numeric.
--   4. sale_contract_artifacts.buyer_phone is NULL for all rows — backfill
--      from buyer_passport_number is wrong; need to check if buyer_phone was
--      ever populated. Currently 0/7 have it.
--   5. crew_todos.user_id has both 9-digit and 10-digit Telegram IDs —
--      confirm the column is TEXT (it is) and no constraint blocks 10-digit.
--   6. crew_todos.due_date is NULL for ALL 164 rows — backfill from
--      rentals.agreed_end_date where rental_id is set.
--   7. crew_todos with 0 rental_verification category — create verification
--      todos for existing rentals.
--   8. Phone normalization: inconsistent formats in production (+7, 8, with
--      spaces/dashes). Backfill to canonical E.164.
--   9. rental_contract_artifacts: 30 orphaned rows (no rental_id). Attempt
--      to link via secrets.source_rental_id or operator+bike+date.
--
-- Migrations that should be RE-APPLIED (they were fixed but may not have
-- been applied to production in their fixed form):
--   - 20260721150000_fix_claim_rental_rpc.sql — RPC rewrite (re-apply if
--     claim_rental_by_qr still uses user_id != owner_id check)
--   - 20260721160000_backfill_todos_artifacts.sql — todo user_id + artifact
--     rental_id backfill (re-apply if counts are still low)
--   - 20260721170000_fix_backfill_chatid_and_jsonb.sql — secret.chat_id
--     backfill + LIKE→JSONB fix (re-apply if propagate_claim still uses LIKE)
-- ═══════════════════════════════════════════════════════════════════════════

-- ═══════════════════════════════════════════════════════════════════════════
-- FIX 1: Backfill sale_contract_artifacts.total_sum from sale_price
-- ═══════════════════════════════════════════════════════════════════════════
-- sale_price is TEXT, often with spaces ("420 000"). total_sum is NUMERIC.
-- Code in leads.ts uses: Number(s.total_sum ?? s.sale_price) — so if
-- total_sum is NULL, it falls back to sale_price. But Number("420 000")
-- returns NaN, not 420000. Fix: populate total_sum properly.

UPDATE private.sale_contract_artifacts
SET total_sum = REPLACE(sale_price, ' ', '')::numeric
WHERE total_sum IS NULL
  AND sale_price IS NOT NULL
  AND REPLACE(sale_price, ' ', '') ~ '^\d+$';

-- Verify
SELECT
  COUNT(*) AS total,
  COUNT(*) FILTER (WHERE total_sum IS NOT NULL) AS has_total_sum,
  COUNT(*) FILTER (WHERE total_sum IS NULL) AS still_null
FROM private.sale_contract_artifacts;

-- ═══════════════════════════════════════════════════════════════════════════
-- FIX 2: Normalize phone numbers across all tables to E.164
-- ═══════════════════════════════════════════════════════════════════════════
-- Production data shows: "+7 9200-789-888", "89861720402", "+79200000000"
-- Canonical form: +7XXXXXXXXXX (11 chars, starts with +7)

-- 2a: franchize_intents.phone
UPDATE public.franchize_intents
SET phone = CASE
  -- Already +7XXXXXXXXXX (11 digits after +)
  WHEN phone ~ '^\+7\d{10}$' THEN phone
  -- 8XXXXXXXXXX → +7XXXXXXXXXX
  WHEN phone ~ '^8\d{10}$' THEN '+7' || substring(phone from 2)
  -- 7XXXXXXXXXX → +7XXXXXXXXXX
  WHEN phone ~ '^7\d{10}$' THEN '+' || phone
  -- 10 digits, no prefix → +7XXXXXXXXXX
  WHEN phone ~ '^\d{10}$' THEN '+7' || phone
  -- Has + but with spaces/dashes → strip non-digits, re-add +7
  WHEN phone ~ '^\+' THEN
    CASE
      WHEN regexp_replace(phone, '\D', '', 'g') ~ '^7\d{10}$'
        THEN '+' || regexp_replace(phone, '\D', '', 'g')
      WHEN regexp_replace(phone, '\D', '', 'g') ~ '^8\d{10}$'
        THEN '+7' || substring(regexp_replace(phone, '\D', '', 'g') from 2)
      WHEN regexp_replace(phone, '\D', '', 'g') ~ '^\d{10}$'
        THEN '+7' || regexp_replace(phone, '\D', '', 'g')
      ELSE phone
    END
  ELSE phone
END
WHERE phone IS NOT NULL
  AND phone !~ '^\+7\d{10}$';

-- 2b: crew_todos.phone
UPDATE public.crew_todos
SET phone = CASE
  WHEN phone ~ '^8\d{10}$' THEN '+7' || substring(phone from 2)
  WHEN phone ~ '^7\d{10}$' THEN '+' || phone
  WHEN phone ~ '^\d{10}$' THEN '+7' || phone
  WHEN phone ~ '^\+' THEN
    CASE
      WHEN regexp_replace(phone, '\D', '', 'g') ~ '^7\d{10}$'
        THEN '+' || regexp_replace(phone, '\D', '', 'g')
      WHEN regexp_replace(phone, '\D', '', 'g') ~ '^8\d{10}$'
        THEN '+7' || substring(regexp_replace(phone, '\D', '', 'g') from 2)
      WHEN regexp_replace(phone, '\D', '', 'g') ~ '^\d{10}$'
        THEN '+7' || regexp_replace(phone, '\D', '', 'g')
      ELSE phone
    END
  ELSE phone
END
WHERE phone IS NOT NULL
  AND phone !~ '^\+7\d{10}$';

-- 2c: rental_contract_artifacts.renter_phone
UPDATE private.rental_contract_artifacts
SET renter_phone = CASE
  WHEN renter_phone ~ '^8\d{10}$' THEN '+7' || substring(renter_phone from 2)
  WHEN renter_phone ~ '^7\d{10}$' THEN '+' || renter_phone
  WHEN renter_phone ~ '^\d{10}$' THEN '+7' || renter_phone
  WHEN renter_phone ~ '^\+' THEN
    CASE
      WHEN regexp_replace(renter_phone, '\D', '', 'g') ~ '^7\d{10}$'
        THEN '+' || regexp_replace(renter_phone, '\D', '', 'g')
      WHEN regexp_replace(renter_phone, '\D', '', 'g') ~ '^8\d{10}$'
        THEN '+7' || substring(regexp_replace(renter_phone, '\D', '', 'g') from 2)
      WHEN regexp_replace(renter_phone, '\D', '', 'g') ~ '^\d{10}$'
        THEN '+7' || regexp_replace(renter_phone, '\D', '', 'g')
      ELSE renter_phone
    END
  ELSE renter_phone
END
WHERE renter_phone IS NOT NULL
  AND renter_phone !~ '^\+7\d{10}$';

-- 2d: sale_contract_artifacts.buyer_phone (same logic)
UPDATE private.sale_contract_artifacts
SET buyer_phone = CASE
  WHEN buyer_phone ~ '^8\d{10}$' THEN '+7' || substring(buyer_phone from 2)
  WHEN buyer_phone ~ '^7\d{10}$' THEN '+' || buyer_phone
  WHEN buyer_phone ~ '^\d{10}$' THEN '+7' || buyer_phone
  WHEN buyer_phone ~ '^\+' THEN
    CASE
      WHEN regexp_replace(buyer_phone, '\D', '', 'g') ~ '^7\d{10}$'
        THEN '+' || regexp_replace(buyer_phone, '\D', '', 'g')
      WHEN regexp_replace(buyer_phone, '\D', '', 'g') ~ '^8\d{10}$'
        THEN '+7' || substring(regexp_replace(buyer_phone, '\D', '', 'g') from 2)
      WHEN regexp_replace(buyer_phone, '\D', '', 'g') ~ '^\d{10}$'
        THEN '+7' || regexp_replace(buyer_phone, '\D', '', 'g')
      ELSE buyer_phone
    END
  ELSE buyer_phone
END
WHERE buyer_phone IS NOT NULL
  AND buyer_phone !~ '^\+7\d{10}$';

-- Also normalize the lead_phone in crew_todos.description JSON
UPDATE public.crew_todos
SET description = (description::jsonb
  || jsonb_build_object(
       'lead_phone',
       CASE
         WHEN (description::jsonb ->> 'lead_phone') ~ '^8\d{10}$'
           THEN '+7' || substring((description::jsonb ->> 'lead_phone') from 2)
         WHEN (description::jsonb ->> 'lead_phone') ~ '^7\d{10}$'
           THEN '+' || (description::jsonb ->> 'lead_phone')
         WHEN (description::jsonb ->> 'lead_phone') ~ '^\d{10}$'
           THEN '+7' || (description::jsonb ->> 'lead_phone')
         WHEN (description::jsonb ->> 'lead_phone') ~ '^\+' THEN
           CASE
             WHEN regexp_replace((description::jsonb ->> 'lead_phone'), '\D', '', 'g') ~ '^7\d{10}$'
               THEN '+' || regexp_replace((description::jsonb ->> 'lead_phone'), '\D', '', 'g')
             WHEN regexp_replace((description::jsonb ->> 'lead_phone'), '\D', '', 'g') ~ '^8\d{10}$'
               THEN '+7' || substring(regexp_replace((description::jsonb ->> 'lead_phone'), '\D', '', 'g') from 2)
             WHEN regexp_replace((description::jsonb ->> 'lead_phone'), '\D', '', 'g') ~ '^\d{10}$'
               THEN '+7' || regexp_replace((description::jsonb ->> 'lead_phone'), '\D', '', 'g')
             ELSE (description::jsonb ->> 'lead_phone')
           END
         ELSE (description::jsonb ->> 'lead_phone')
       END
     )
)::text
WHERE description IS NOT NULL
  AND (description::jsonb ->> 'lead_phone') IS NOT NULL
  AND (description::jsonb ->> 'lead_phone') !~ '^\+7\d{10}$';

-- Verify phone normalization
SELECT 'franchize_intents' AS table_name,
  COUNT(*) FILTER (WHERE phone ~ '^\+7\d{10}$') AS canonical,
  COUNT(*) FILTER (WHERE phone IS NOT NULL AND phone !~ '^\+7\d{10}$') AS non_canonical
FROM public.franchize_intents
UNION ALL
SELECT 'crew_todos',
  COUNT(*) FILTER (WHERE phone ~ '^\+7\d{10}$'),
  COUNT(*) FILTER (WHERE phone IS NOT NULL AND phone !~ '^\+7\d{10}$')
FROM public.crew_todos
UNION ALL
SELECT 'rental_contract_artifacts',
  COUNT(*) FILTER (WHERE renter_phone ~ '^\+7\d{10}$'),
  COUNT(*) FILTER (WHERE renter_phone IS NOT NULL AND renter_phone !~ '^\+7\d{10}$')
FROM private.rental_contract_artifacts
UNION ALL
SELECT 'sale_contract_artifacts',
  COUNT(*) FILTER (WHERE buyer_phone ~ '^\+7\d{10}$'),
  COUNT(*) FILTER (WHERE buyer_phone IS NOT NULL AND buyer_phone !~ '^\+7\d{10}$')
FROM private.sale_contract_artifacts;

-- ═══════════════════════════════════════════════════════════════════════════
-- FIX 3: Backfill crew_todos.due_date from rentals.agreed_end_date
-- ═══════════════════════════════════════════════════════════════════════════
-- Production: 0/164 todos have due_date. 87 have rental_id.
-- Set due_date from the linked rental's agreed_end_date.

UPDATE public.crew_todos t
SET due_date = r.agreed_end_date
FROM public.rentals r
WHERE t.due_date IS NULL
  AND t.rental_id = r.rental_id
  AND r.agreed_end_date IS NOT NULL;

-- Also try from description JSON rent_end_date (DD.MM.YYYY format)
-- Parse DD.MM.YYYY → YYYY-MM-DD
UPDATE public.crew_todos
SET due_date = (
  CASE
    WHEN (description::jsonb ->> 'rent_end_date') ~ '^\d{2}\.\d{2}\.\d{4}$'
    THEN to_timestamp(
      (substring((description::jsonb ->> 'rent_end_date') from '\d{2}\.\d{2}\.\d{4}')::varchar),
      'DD.MM.YYYY'
    ) AT TIME ZONE 'UTC'
    WHEN (description::jsonb ->> 'rent_end_date') ~ '^\d{4}-\d{2}-\d{2}'
    THEN (description::jsonb ->> 'rent_end_date')::timestamptz
    ELSE NULL
  END
)
WHERE due_date IS NULL
  AND description IS NOT NULL
  AND (description::jsonb ->> 'rent_end_date') IS NOT NULL;

-- Verify
SELECT
  COUNT(*) AS total,
  COUNT(*) FILTER (WHERE due_date IS NOT NULL) AS has_due_date,
  COUNT(*) FILTER (WHERE due_date IS NOT NULL AND due_date < now() AND status != 'done') AS overdue
FROM public.crew_todos;

-- ═══════════════════════════════════════════════════════════════════════════
-- FIX 4: Backfill crew_todos.user_id and phone from description JSON
-- ═══════════════════════════════════════════════════════════════════════════
-- Production: 22/164 have user_id, 19/164 have phone.
-- description JSON has lead_phone (157/164) and sometimes user_id (32/164).
-- Backfill the columns from the JSON.

-- 4a: user_id from description JSON
UPDATE public.crew_todos
SET user_id = (description::jsonb ->> 'user_id')
WHERE user_id IS NULL
  AND description IS NOT NULL
  AND (description::jsonb ->> 'user_id') IS NOT NULL
  AND (description::jsonb ->> 'user_id') ~ '^\d{1,12}$';

-- 4b: phone from description JSON lead_phone
UPDATE public.crew_todos
SET phone = (description::jsonb ->> 'lead_phone')
WHERE phone IS NULL
  AND description IS NOT NULL
  AND (description::jsonb ->> 'lead_phone') IS NOT NULL
  AND (description::jsonb ->> 'lead_phone') ~ '^(\+7|7|8)\d{10}$';

-- 4c: lead_id from description JSON if column is null
UPDATE public.crew_todos
SET lead_id = (description::jsonb ->> 'lead_id')
WHERE lead_id IS NULL
  AND description IS NOT NULL
  AND (description::jsonb ->> 'lead_id') IS NOT NULL;

-- Verify
SELECT
  COUNT(*) AS total,
  COUNT(*) FILTER (WHERE user_id IS NOT NULL) AS has_user_id,
  COUNT(*) FILTER (WHERE phone IS NOT NULL) AS has_phone,
  COUNT(*) FILTER (WHERE lead_id IS NOT NULL) AS has_lead_id,
  COUNT(*) FILTER (WHERE rental_id IS NOT NULL) AS has_rental_id
FROM public.crew_todos;

-- ═══════════════════════════════════════════════════════════════════════════
-- FIX 5: Backfill crew_todos.rental_id from description JSON
-- ═══════════════════════════════════════════════════════════════════════════
-- Production: 87/164 have rental_id. 117 have description.rental_id.
-- Backfill the column from JSON where it's a valid UUID.

UPDATE public.crew_todos
SET rental_id = (description::jsonb ->> 'rental_id')::uuid
WHERE rental_id IS NULL
  AND description IS NOT NULL
  AND (description::jsonb ->> 'rental_id') IS NOT NULL
  AND (description::jsonb ->> 'rental_id') ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';

-- Verify
SELECT
  COUNT(*) AS total,
  COUNT(*) FILTER (WHERE rental_id IS NOT NULL) AS has_rental_id,
  COUNT(*) FILTER (WHERE rental_id IS NULL) AS still_null
FROM public.crew_todos;

-- ═══════════════════════════════════════════════════════════════════════════
-- FIX 6: Link orphaned rental_contract_artifacts to rentals
-- ═══════════════════════════════════════════════════════════════════════════
-- Production: 30/56 artifacts have no rental_id.
-- Try linking via: (a) secrets.source_rental_id, (b) operator+bike+date match.

-- 6a: via secrets.source_rental_id
UPDATE private.rental_contract_artifacts a
SET rental_id = s.source_rental_id::uuid
FROM private.user_rental_secrets s
WHERE a.rental_id IS NULL
  AND a.original_sha256 = s.doc_sha256
  AND s.source_rental_id IS NOT NULL
  AND s.source_rental_id ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';

-- 6b: via operator + bike + start date match
UPDATE private.rental_contract_artifacts a
SET rental_id = r.rental_id
FROM public.rentals r
WHERE a.rental_id IS NULL
  AND a.created_by_operator_chat_id IS NOT NULL
  AND r.created_by_operator_chat_id = a.created_by_operator_chat_id
  AND r.vehicle_id = COALESCE(a.resolved_bike_id, a.requested_bike_id)
  AND a.rent_start_date IS NOT NULL
  AND r.requested_start_date::date::text = a.rent_start_date;

-- Verify
SELECT
  COUNT(*) AS total,
  COUNT(*) FILTER (WHERE rental_id IS NOT NULL) AS has_rental_id,
  COUNT(*) FILTER (WHERE rental_id IS NULL) AS still_orphaned
FROM private.rental_contract_artifacts;

-- ═══════════════════════════════════════════════════════════════════════════
-- FIX 7: Backfill user_rental_secrets.chat_id for already-claimed rentals
-- ═══════════════════════════════════════════════════════════════════════════
-- Production: 5 rentals have user_id != owner_id (claimed).
-- Their secrets may still have chat_id = NULL or chat_id = operator.
-- Sync secret.chat_id to rentals.user_id for claimed rentals.

UPDATE private.user_rental_secrets s
SET chat_id = r.user_id,
    qr_claimed_at = COALESCE(s.qr_claimed_at, now()),
    updated_at = now()
FROM public.rentals r
WHERE s.source_rental_id = r.rental_id::text
  AND r.user_id != r.owner_id
  AND s.chat_id IS DISTINCT FROM r.user_id;

-- Also sync via doc_sha256 → artifact.rental_id → rentals.user_id
UPDATE private.user_rental_secrets s
SET chat_id = r.user_id,
    qr_claimed_at = COALESCE(s.qr_claimed_at, now()),
    updated_at = now()
FROM private.rental_contract_artifacts a
JOIN public.rentals r ON r.rental_id = a.rental_id
WHERE s.doc_sha256 = a.original_sha256
  AND r.user_id != r.owner_id
  AND s.chat_id IS DISTINCT FROM r.user_id;

-- Verify
SELECT
  COUNT(*) AS total,
  COUNT(*) FILTER (WHERE chat_id IS NULL) AS null_chat_id,
  COUNT(*) FILTER (WHERE chat_id IS NOT NULL AND qr_claimed_at IS NOT NULL) AS fully_claimed,
  COUNT(*) FILTER (WHERE source_rental_id IS NOT NULL) AS has_source_rental_id
FROM private.user_rental_secrets;

-- ═══════════════════════════════════════════════════════════════════════════
-- FIX 8: Create rental_verification todos for existing rentals
-- ═══════════════════════════════════════════════════════════════════════════
-- Production: 0 rental_verification todos. Create 5 per rental (34 rentals).

DO $$
DECLARE
  v_rental RECORD;
  v_crew_id TEXT;
  v_lead_id TEXT;
  v_todo_types TEXT[] := ARRAY['passport_mainpage', 'passport_registration', 'drivers_license', 'odometer', 'dates'];
  v_todo_title TEXT;
  v_todo_type TEXT;
BEGIN
  FOR v_rental IN
    SELECT rental_id, user_id, crew_id, metadata, status
    FROM public.rentals
    WHERE status IN ('active', 'confirmed', 'pending_confirmation', 'completed')
  LOOP
    v_crew_id := v_rental.crew_id::text;
    v_lead_id := COALESCE(
      v_rental.metadata->>'renter_phone',
      v_rental.metadata->>'phone',
      v_rental.user_id
    );

    FOREACH v_todo_type IN ARRAY v_todo_types
    LOOP
      v_todo_title := CASE v_todo_type
        WHEN 'passport_mainpage' THEN 'Верифицировать паспорт (главная страница)'
        WHEN 'passport_registration' THEN 'Верифицировать паспорт (страница с пропиской)'
        WHEN 'drivers_license' THEN 'Верифицировать водительское удостоверение'
        WHEN 'odometer' THEN 'Подтвердить начальный одометр'
        WHEN 'dates' THEN 'Подтвердить даты аренды'
      END;

      IF NOT EXISTS (
        SELECT 1 FROM public.crew_todos
        WHERE crew_id = v_crew_id
          AND rental_id = v_rental.rental_id
          AND category = 'rental_verification'
          AND description::jsonb->>'todo_type' = v_todo_type
      ) THEN
        INSERT INTO public.crew_todos (
          id, crew_id, lead_id, user_id, rental_id,
          title, description, category, status, priority,
          assigned_to, created_by, due_date
        ) VALUES (
          'todo-verification-' || v_rental.rental_id::text || '-' || v_todo_type,
          v_crew_id,
          v_lead_id,
          CASE WHEN v_lead_id ~ '^\d{1,12}$' THEN v_lead_id ELSE NULL END,
          v_rental.rental_id,
          v_todo_title,
          jsonb_build_object(
            'rental_id', v_rental.rental_id::text,
            'todo_type', v_todo_type,
            'source', 'rental_verification_backfill',
            'lead_id', v_lead_id
          ),
          'rental_verification',
          CASE
            WHEN v_todo_type IN ('passport_mainpage', 'passport_registration', 'drivers_license')
              THEN CASE WHEN v_rental.status = 'completed' THEN 'done' ELSE 'pending' END
            ELSE 'pending'
          END,
          CASE
            WHEN v_todo_type IN ('passport_mainpage', 'passport_registration', 'drivers_license') THEN 'high'
            ELSE 'medium'
          END,
          v_rental.metadata->>'created_by_operator_chat_id',
          'system',
          v_rental.agreed_end_date
        );
      END IF;
    END LOOP;
  END LOOP;
END;
$$;

-- Verify
SELECT category, COUNT(*) FROM public.crew_todos GROUP BY category ORDER BY COUNT(*) DESC;

-- ═══════════════════════════════════════════════════════════════════════════
-- FINAL VERIFICATION SUMMARY
-- ═══════════════════════════════════════════════════════════════════════════
SELECT '=== POST-MIGRATION VERIFICATION ===' AS info;

SELECT 'crew_todos' AS table_name,
  COUNT(*) AS total,
  COUNT(*) FILTER (WHERE user_id IS NOT NULL) AS has_user_id,
  COUNT(*) FILTER (WHERE phone IS NOT NULL) AS has_phone,
  COUNT(*) FILTER (WHERE lead_id IS NOT NULL) AS has_lead_id,
  COUNT(*) FILTER (WHERE rental_id IS NOT NULL) AS has_rental_id,
  COUNT(*) FILTER (WHERE due_date IS NOT NULL) AS has_due_date,
  COUNT(*) FILTER (WHERE due_date IS NOT NULL AND due_date < now() AND status != 'done') AS overdue
FROM public.crew_todos
UNION ALL
SELECT 'rental_contract_artifacts',
  COUNT(*), 0, 0, 0,
  COUNT(*) FILTER (WHERE rental_id IS NOT NULL),
  0, 0
FROM private.rental_contract_artifacts
UNION ALL
SELECT 'user_rental_secrets',
  COUNT(*),
  COUNT(*) FILTER (WHERE chat_id IS NOT NULL),
  0, 0,
  COUNT(*) FILTER (WHERE source_rental_id IS NOT NULL),
  0, 0
FROM private.user_rental_secrets;

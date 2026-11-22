-- ─────────────────────────────────────────────────────────────────────────────
-- Backfill renter_phone from public.users for operator-created contracts where
-- the operator skipped the optional client_phone step in /doc-manual.
--
-- ROOT CAUSE (data-backed): 45 of 57 rental_contract_artifacts had
-- renter_phone = NULL. All 45 were created by operator 7813830016 via
-- /doc-manual, which makes the phone step OPTIONAL ("Пропустить"). The operator
-- skipped it every time, so the phone is genuinely absent from the DB for ~44 of
-- them. This migration recovers the few phones that DO exist elsewhere (in
-- public.users under a phone-based user_id or users.metadata->>phone) by matching
-- on the NORMALIZED renter full name (same normalization the leads page / text
-- skill use to key identity — see nameIdentityKey in leads.ts & leads-query.mjs).
--
-- This migration is IDEMPOTENT: it only touches rows where renter_phone IS NULL,
-- and only fills from a concrete phone found in users. It does NOT invent numbers.
-- Re-running is safe and a no-op once applied.
--
-- Expected yield: small (≈1-2 real recoveries in the current dataset, e.g.
-- "Чуфыркин Михаил Сергеевич" ← +79307020666). The rest have no phone anywhere —
-- they can only be re-collected going forward (see doc-manual phone auto-suggest).
-- ─────────────────────────────────────────────────────────────────────────────

-- Name normalization mirroring nameIdentityKey(): lowercase, collapse dots/runs
-- of whitespace, strip stray dots. Kept inline because rental_contract_artifacts
-- and users live in different schemas and we match across them.
-- (private.rental_contract_artifacts.renter_full_name  ↔  public.users.full_name)

-- 1) rental_contract_artifacts.renter_phone  (private schema)
--    NOTE: this table has no updated_at column (only created_at).
UPDATE private.rental_contract_artifacts AS a
SET renter_phone = u.phone_value
FROM (
  SELECT
    lower(btrim(regexp_replace(u.full_name, '[.\s]+', ' ', 'g'), '.')) AS norm_name,
    COALESCE(
      NULLIF(u.metadata->>'phone', ''),
      CASE
        WHEN u.user_id ~ '^\+?\d{11,13}$' THEN u.user_id
      END
    ) AS phone_value
  FROM public.users u
  WHERE u.full_name IS NOT NULL
    AND (
      NULLIF(u.metadata->>'phone', '') IS NOT NULL
      OR u.user_id ~ '^\+?\d{11,13}$'
    )
) AS u
WHERE a.renter_phone IS NULL
  AND a.renter_full_name IS NOT NULL
  AND u.phone_value IS NOT NULL
  AND lower(btrim(regexp_replace(a.renter_full_name, '[.\s]+', ' ', 'g'), '.')) = u.norm_name;

-- 2) user_rental_secrets.renter_phone  (private schema) — same match
UPDATE private.user_rental_secrets AS s
SET renter_phone = u.phone_value,
    updated_at = COALESCE(s.updated_at, now())
FROM (
  SELECT
    lower(btrim(regexp_replace(u.full_name, '[.\s]+', ' ', 'g'), '.')) AS norm_name,
    COALESCE(
      NULLIF(u.metadata->>'phone', ''),
      CASE
        WHEN u.user_id ~ '^\+?\d{11,13}$' THEN u.user_id
      END
    ) AS phone_value
  FROM public.users u
  WHERE u.full_name IS NOT NULL
    AND (
      NULLIF(u.metadata->>'phone', '') IS NOT NULL
      OR u.user_id ~ '^\+?\d{11,13}$'
    )
) AS u
WHERE s.renter_phone IS NULL
  AND s.renter_full_name IS NOT NULL
  AND u.phone_value IS NOT NULL
  AND lower(btrim(regexp_replace(s.renter_full_name, '[.\s]+', ' ', 'g'), '.')) = u.norm_name;

-- 3) franchize_intents.phone for operator-keyed callback leads — intentionally
--    NOT touched: operator-created intents collapse to ONE row keyed by the
--    operator's telegram_user_id (last write wins on name), so a per-renter phone
--    cannot be assigned without splitting that row. Per-renter visibility on the
--    leads page now comes from the normalized name identity key (leads.ts +
--    leads-query.mjs), not from this column.

-- ── Verification (run before & after to see the delta) ────────────────────────
-- SELECT count(*) FILTER (WHERE renter_phone IS NULL)  AS still_null,
--        count(*) FILTER (WHERE renter_phone IS NOT NULL) AS has_phone
-- FROM private.rental_contract_artifacts;

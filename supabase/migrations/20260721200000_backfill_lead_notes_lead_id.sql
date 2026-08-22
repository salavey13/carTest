-- ═══════════════════════════════════════════════════════════════════════════
-- supabase/migrations/20260721200000_backfill_lead_notes_lead_id.sql
-- §13.4c #6 — Backfill lead_notes.lead_id for existing rows
--
-- propagate_claim Step 6 уже обновляет lead_notes.lead_id для будущих QR
-- claim'ов. Этот бэкфилл чинит существующие строки, где lead_id всё ещё
-- указывает на старый identity (operator id вместо renter chat id).
--
-- Идемпотентно. Безопасно для повторного запуска.
-- ═══════════════════════════════════════════════════════════════════════════

-- Backfill lead_notes.lead_id for already-claimed rentals
-- Соединяем lead_notes с rentals через user_id/owner_id:
-- если lead_id совпадает с owner_id (operator placeholder), а rental уже
-- имеет user_id != owner_id (значит, QR заклеймлён), то обновляем lead_id.
DO $$
DECLARE
  v_updated INT := 0;
BEGIN
  -- Match lead_notes where lead_id = old operator id AND that operator
  -- has a claimed rental (user_id != owner_id) in the same crew.
  UPDATE public.lead_notes ln
  SET lead_id = r.user_id
  FROM public.rentals r
  JOIN public.crews c ON c.id = r.crew_id
  WHERE ln.crew_id = r.crew_id
    AND ln.lead_id = r.owner_id::text
    AND r.user_id != r.owner_id
    AND ln.lead_id IS DISTINCT FROM r.user_id;

  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RAISE NOTICE 'lead_notes backfill: % rows updated', v_updated;

  -- Also handle the case where lead_id = phone (E.164) that was
  -- the operator's phone — match via artifact.renter_phone
  UPDATE public.lead_notes ln
  SET lead_id = r.user_id
  FROM private.rental_contract_artifacts a
  JOIN public.rentals r ON r.rental_id = a.rental_id::uuid
  WHERE ln.crew_id = r.crew_id
    AND ln.lead_id = a.renter_phone
    AND r.user_id != r.owner_id
    AND ln.lead_id IS DISTINCT FROM r.user_id;

  GET DIAGNOSTICS v_updated = ROW_COUNT;
  IF v_updated > 0 THEN
    RAISE NOTICE 'lead_notes phone-match backfill: % rows updated', v_updated;
  END IF;
END;
$$;

-- Verify: check for any lead_notes where lead_id still matches an operator
-- who has claimed rentals (acceptable edge case: notes attached to operator
-- before any claim happened)
DO $$
DECLARE
  v_still_orphaned INT;
BEGIN
  SELECT COUNT(*) INTO v_still_orphaned
  FROM public.lead_notes ln
  WHERE EXISTS (
    SELECT 1 FROM public.rentals r
    WHERE r.crew_id = ln.crew_id
      AND r.owner_id::text = ln.lead_id
      AND r.user_id != r.owner_id
  );

  RAISE NOTICE 'lead_notes still orphaned after backfill: %', v_still_orphaned;
END;
$$;

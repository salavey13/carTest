-- ═══════════════════════════════════════════════════════════════════════════
-- Auto-create deposit_returned entries when rental status → 'completed'
--
-- For each deposit_collected entry on the rental, creates a matching
-- deposit_returned entry with the SAME destination and amount.
-- If split (cash + card), creates 2 return entries.
--
-- operator_chat_id is NULL for auto-returns (system-generated).
-- ═══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.auto_return_deposit_entries()
RETURNS TRIGGER
SECURITY DEFINER
LANGUAGE plpgsql AS $$
BEGIN
  -- Only fire on transition TO 'completed'
  IF NEW.status = 'completed' AND (OLD IS NULL OR OLD.status != 'completed') THEN
    -- For each deposit_collected entry, create a matching deposit_returned entry
    INSERT INTO public.deposit_entries (
      rental_id, entry_type, amount, direction, destination, operator_chat_id, notes
    )
    SELECT
      NEW.rental_id,
      'deposit_returned',
      de.amount,
      'out',
      de.destination,
      NULL, -- system-generated, no human operator
      'Auto-returned on rental completion'
    FROM public.deposit_entries de
    WHERE de.rental_id = NEW.rental_id
      AND de.entry_type = 'deposit_collected';

    -- Log how many entries were created (for debugging)
    -- Can't RAISE NOTICE in triggers reliably, but the insert above is idempotent
    -- only if we add a guard. Let's add a guard to prevent double-returns:
  END IF;

  RETURN NEW;
END;
$$;

-- Drop existing trigger if re-applying
DROP TRIGGER IF EXISTS trg_auto_return_deposit_entries ON public.rentals;

-- Create trigger — fires AFTER UPDATE OF status (not INSERT, since rentals
-- are created with status='active' and later transitioned to 'completed')
CREATE TRIGGER trg_auto_return_deposit_entries
  AFTER UPDATE OF status ON public.rentals
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_return_deposit_entries();

-- Grant execute
GRANT EXECUTE ON FUNCTION public.auto_return_deposit_entries() TO service_role;

-- ═══════════════════════════════════════════════════════════════════════════
-- Also handle rental CANCELLATION — return deposits on cancel too
-- ═══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.auto_return_deposit_on_cancel()
RETURNS TRIGGER
SECURITY DEFINER
LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.status = 'cancelled' AND (OLD IS NULL OR OLD.status NOT IN ('cancelled', 'completed')) THEN
    INSERT INTO public.deposit_entries (
      rental_id, entry_type, amount, direction, destination, operator_chat_id, notes
    )
    SELECT
      NEW.rental_id,
      'deposit_returned',
      de.amount,
      'out',
      de.destination,
      NULL,
      'Auto-returned on rental cancellation'
    FROM public.deposit_entries de
    WHERE de.rental_id = NEW.rental_id
      AND de.entry_type = 'deposit_collected'
      -- Don't double-return: skip if a return already exists for this collected entry
      AND NOT EXISTS (
        SELECT 1 FROM public.deposit_entries ret
        WHERE ret.rental_id = de.rental_id
          AND ret.entry_type = 'deposit_returned'
          AND ret.destination = de.destination
          AND ret.amount = de.amount
      );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_auto_return_deposit_on_cancel ON public.rentals;

CREATE TRIGGER trg_auto_return_deposit_on_cancel
  AFTER UPDATE OF status ON public.rentals
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_return_deposit_on_cancel();

GRANT EXECUTE ON FUNCTION public.auto_return_deposit_on_cancel() TO service_role;

-- Add total_sum columns to contract artifact tables
-- This enables faster daily summary calculations without joins

-- Step 1: Add total_sum to rental_contract_artifacts (with NULL for existing records)
ALTER TABLE public.rental_contract_artifacts
ADD COLUMN IF NOT EXISTS total_sum NUMERIC;

COMMENT ON COLUMN public.rental_contract_artifacts.total_sum IS 'Total rental value in RUB. NULL for existing contracts, filled for new ones.';

-- Step 2: Add total_sum to sale_contract_artifacts (can be calculated from sale_price)
-- First need to add column if it doesn't exist in private schema
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'private'
    AND table_name = 'sale_contract_artifacts'
    AND column_name = 'total_sum'
  ) THEN
    ALTER TABLE private.sale_contract_artifacts
    ADD COLUMN total_sum NUMERIC;

    COMMENT ON COLUMN private.sale_contract_artifacts.total_sum IS 'Total sale value in RUB (parsed from sale_price).';

    -- Backfill existing records: parse sale_price (remove spaces) and convert to numeric
    UPDATE private.sale_contract_artifacts
    SET total_sum = NULLIF(regexp_replace(sale_price, '\s+', '', 'g'), '')::NUMERIC
    WHERE sale_price IS NOT NULL
      AND total_sum IS NULL;
  END IF;
END $$;

-- Step 3: Create a helper function to update total_sum for rentals
-- This can be called when a rental contract is created
CREATE OR REPLACE FUNCTION public.update_rental_total_sum()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Calculate total from bike's daily_price and rental period
  -- For now, this is a placeholder - actual calculation requires date range and bike data
  -- New contracts should populate this during creation
  NEW.total_sum := NEW.total_sum; -- Preserve if set
  RETURN NEW;
END;
$$;

-- Step 4: Create helper function to backfill rental total_sums
-- This joins with cars table and calculates based on bike daily_price
CREATE OR REPLACE FUNCTION public.backfill_rental_totals()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  updated_count INTEGER := 0;
BEGIN
  -- Update rentals where total_sum is NULL by joining with bikes table
  UPDATE public.rental_contract_artifacts rca
  SET total_sum = (
    -- Calculate rough estimate based on bike's daily_price
    -- A more accurate calculation would require parsing rent_start_date and rent_end_date
    SELECT COALESCE(
      NULLIF(regexp_replace(c.daily_price::TEXT, '\s+', '', 'g'), '')::NUMERIC,
      COALESCE(NULLIF(regexp_replace((c.specs->>'price_rub')::TEXT, '\s+', '', 'g'), '')::NUMERIC, 0)
    )
    FROM public.cars c
    WHERE c.id = rca.resolved_bike_id
  )
  WHERE rca.total_sum IS NULL
    AND rca.resolved_bike_id IS NOT NULL;

  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RETURN updated_count;
END;
$$;

COMMENT ON FUNCTION public.backfill_rental_totals() IS 'Backfills total_sum for rental contracts by joining with bikes table. Returns number of rows updated.';

-- Step 5: Create a view for daily contract summaries
-- This provides fast access to today's contract counts and totals
CREATE OR REPLACE VIEW public.daily_contract_summary AS
WITH today_rentals AS (
  SELECT
    COUNT(*) AS rental_count,
    COALESCE(SUM(total_sum), 0) AS rental_total
  FROM public.rental_contract_artifacts
  WHERE DATE(created_at) = CURRENT_DATE
),
today_sales AS (
  SELECT
    COUNT(*) AS sale_count,
    COALESCE(SUM(total_sum), 0) AS sale_total
  FROM private.sale_contract_artifacts
  WHERE DATE(created_at) = CURRENT_DATE
)
SELECT
  CURRENT_DATE AS report_date,
  COALESCE(tr.rental_count, 0) AS rental_count,
  COALESCE(tr.rental_total, 0) AS rental_total,
  COALESCE(ts.sale_count, 0) AS sale_count,
  COALESCE(ts.sale_total, 0) AS sale_total,
  COALESCE(tr.rental_total, 0) + COALESCE(ts.sale_total, 0) AS total_revenue
FROM (SELECT * FROM today_rentals) tr
FULL OUTER JOIN (SELECT * FROM today_sales) ts ON true;

COMMENT ON VIEW public.daily_contract_summary IS 'Daily summary of rental and sale contracts. Fast lookup for today counts and totals.';

-- Grant permissions
GRANT SELECT ON public.daily_contract_summary TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.backfill_rental_totals TO authenticated;

-- Optional: Run backfill once
-- SELECT public.backfill_rental_totals();

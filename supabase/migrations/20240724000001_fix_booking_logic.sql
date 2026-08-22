-- Step 1: Drop the old check constraint on rentals table
ALTER TABLE public.rentals
DROP CONSTRAINT IF EXISTS check_rental_payment_status;

-- Step 2: Add the new check constraint that includes 'pending'
ALTER TABLE public.rentals
ADD CONSTRAINT check_rental_payment_status
CHECK (payment_status IN ('pending', 'interest_paid', 'fully_paid', 'refunded', 'failed'));

-- Step 3: Recreate the calendar function to be more robust
-- It should only consider rentals that are confirmed or active to block dates
CREATE OR REPLACE FUNCTION get_vehicle_calendar(p_vehicle_id TEXT)
RETURNS TABLE (
    start_date TIMESTAMPTZ,
    end_date TIMESTAMPTZ
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT
        r.agreed_start_date,
        r.agreed_end_date
    FROM
        public.rentals AS r
    WHERE
        r.vehicle_id = p_vehicle_id
        AND r.status IN ('active', 'confirmed') -- Only block dates for confirmed/active rentals
        AND r.agreed_end_date >= CURRENT_DATE;
END;
$$;
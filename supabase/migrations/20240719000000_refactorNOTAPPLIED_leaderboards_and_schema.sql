-- Step 1: Remove the redundant 'crew_id' column from the 'cars' table.
-- The crew will be determined dynamically via the vehicle's owner.
ALTER TABLE public.cars DROP COLUMN IF EXISTS crew_id;

-- Step 2: Drop and recreate the 'get_top_fleets' function for correctness.
DROP FUNCTION IF EXISTS public.get_top_fleets();
CREATE OR REPLACE FUNCTION public.get_top_fleets()
RETURNS TABLE (
  owner_id TEXT,
  owner_name TEXT,
  total_revenue NUMERIC,
  car_count BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    c.owner_id,
    COALESCE(u.username, 'DEMO') AS owner_name,
    COALESCE(SUM(r.total_cost), 0) AS total_revenue, -- FIX: Use COALESCE to prevent null revenue
    COUNT(DISTINCT c.id) AS car_count
  FROM public.cars c
  LEFT JOIN public.rentals r ON c.id = r.vehicle_id AND r.payment_status IN ('interest_paid', 'fully_paid')
  LEFT JOIN public.users u ON c.owner_id = u.user_id
  WHERE c.owner_id IS NOT NULL
  GROUP BY c.owner_id, u.username
  ORDER BY total_revenue DESC
  LIMIT 10;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION public.get_top_fleets() IS 'Retrieves the top 10 individual vehicle owners based on total rental revenue. Ensures revenue is never null.';


-- Step 3: Drop and recreate the 'get_top_crews' function to use correct joins.
DROP FUNCTION IF EXISTS public.get_top_crews();
CREATE OR REPLACE FUNCTION public.get_top_crews()
RETURNS TABLE (
    crew_id UUID,
    crew_name TEXT,
    crew_logo_url TEXT,
    total_revenue NUMERIC,
    vehicle_count BIGINT,
    member_count BIGINT
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        cr.id AS crew_id,
        cr.name AS crew_name,
        cr.logo_url AS crew_logo_url,
        COALESCE(SUM(r.total_cost), 0) AS total_revenue,
        COUNT(DISTINCT c.id) AS vehicle_count,
        COUNT(DISTINCT cm.user_id) AS member_count
    FROM
        public.crews cr
    -- Join members to get the link between crew and user
    JOIN
        public.crew_members cm ON cr.id = cm.crew_id
    -- Join cars based on the owner being a crew member
    LEFT JOIN
        public.cars c ON cm.user_id = c.owner_id
    -- Join rentals based on the car
    LEFT JOIN
        public.rentals r ON c.id = r.vehicle_id AND r.payment_status IN ('interest_paid', 'fully_paid')
    GROUP BY
        cr.id, cr.name, cr.logo_url
    ORDER BY
        total_revenue DESC
    LIMIT 10;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION public.get_top_crews() IS 'Retrieves the top 10 crews based on the combined rental revenue of all member vehicles. Joins through crew_members instead of a direct link on cars.';
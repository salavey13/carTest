-- Drop the old function to replace it with a corrected version
DROP FUNCTION IF EXISTS public.get_top_fleets();

-- Create the corrected 'get_top_fleets' function for individual owners
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
  LEFT JOIN public.rentals r ON c.id = r.vehicle_id AND r.payment_status IN ('interest_paid', 'fully_paid') -- Count interest as revenue
  LEFT JOIN public.users u ON c.owner_id = u.user_id
  WHERE c.owner_id IS NOT NULL
  GROUP BY c.owner_id, u.username
  ORDER BY total_revenue DESC NULLS LAST
  LIMIT 10;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION public.get_top_fleets() IS 'Retrieves the top 10 individual vehicle owners based on total rental revenue.';


-- Create the new 'get_top_crews' function for crews
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
    JOIN
        public.crew_members cm ON cr.id = cm.crew_id
    LEFT JOIN
        public.cars c ON cm.user_id = c.owner_id
    LEFT JOIN
        public.rentals r ON c.id = r.vehicle_id AND r.payment_status IN ('interest_paid', 'fully_paid')
    GROUP BY
        cr.id, cr.name, cr.logo_url
    ORDER BY
        total_revenue DESC
    LIMIT 10;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION public.get_top_crews() IS 'Retrieves the top 10 crews based on the combined rental revenue of their members vehicles.';
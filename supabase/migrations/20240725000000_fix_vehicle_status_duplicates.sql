-- This migration fixes a bug in the get_vehicles_with_status RPC function
-- where vehicles with multiple rentals would appear multiple times in the result.
-- It also enhances the function to return the start and end dates of the active rental.

CREATE OR REPLACE FUNCTION get_vehicles_with_status()
RETURNS TABLE (
    id TEXT,
    make TEXT,
    model TEXT,
    description TEXT,
    embedding vector(384),
    daily_price NUMERIC,
    image_url TEXT,
    rent_link TEXT,
    is_test_result BOOLEAN,
    type TEXT,
    specs JSONB,
    owner_id TEXT,
    crew_id UUID,
    availability TEXT,
    crew_name TEXT,
    crew_logo_url TEXT,
    active_booking_start TIMESTAMPTZ, -- Added field
    active_booking_end TIMESTAMPTZ   -- Added field
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT
        c.id,
        c.make,
        c.model,
        c.description,
        c.embedding,
        c.daily_price,
        c.image_url,
        c.rent_link,
        c.is_test_result,
        c.type,
        c.specs,
        c.owner_id,
        c.crew_id,
        CASE
            -- 1. Check for an active rental (highest priority)
            WHEN r.vehicle_id IS NOT NULL THEN 'taken'
            -- 2. Check for base availability rules
            WHEN c.availability_rules->>'type' = 'weekends_only' AND EXTRACT(ISODOW FROM CURRENT_DATE) NOT IN (6, 7) THEN 'unavailable'
            -- 3. If no blocking rules, it's available
            ELSE 'available'
        END AS availability,
        cr.name AS crew_name,
        cr.logo_url AS crew_logo_url,
        r.agreed_start_date AS active_booking_start, -- Select the start date
        r.agreed_end_date AS active_booking_end     -- Select the end date
    FROM
        public.cars AS c
    LEFT JOIN (
        -- Subquery to select only the most relevant active rental for each vehicle,
        -- preventing duplicates and fetching necessary dates.
        SELECT DISTINCT ON (vehicle_id)
            vehicle_id,
            agreed_start_date,
            agreed_end_date
        FROM public.rentals
        WHERE status = 'active'
        ORDER BY vehicle_id, created_at DESC -- In case of data anomalies, pick the newest active rental
    ) AS r ON c.id = r.vehicle_id
    LEFT JOIN
        public.crews AS cr ON c.crew_id = cr.id;
END;
$$;
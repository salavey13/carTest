-- /supabase/migrations/20240725000000_fix_vehicle_status_duplicates.sql

-- This migration fixes a bug in the get_vehicles_with_status RPC function
-- where vehicles with multiple rentals would appear multiple times in the result.
-- The LEFT JOIN is modified to only consider a single, most relevant rental status ('active').

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
    crew_logo_url TEXT
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
        cr.logo_url AS crew_logo_url
    FROM
        public.cars AS c
    LEFT JOIN
        -- Correctly join only against active rentals to prevent duplication
        (SELECT vehicle_id FROM public.rentals WHERE status = 'active' LIMIT 1) AS r ON c.id = r.vehicle_id
    LEFT JOIN
        public.crews AS cr ON c.crew_id = cr.id;
END;
$$;

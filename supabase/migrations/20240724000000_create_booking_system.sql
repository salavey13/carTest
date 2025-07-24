-- Step 1: Add a column to the cars table for availability rules
ALTER TABLE public.cars
ADD COLUMN IF NOT EXISTS availability_rules JSONB DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.cars.availability_rules IS 'Stores base availability rules, e.g., {"type": "weekends_only"}';

-- Example of setting a rule for one vehicle for testing
UPDATE public.cars
SET availability_rules = '{"type": "weekends_only"}'
WHERE id = 'kawasaki-ninja-h2';


-- Step 2: Create or replace the RPC function to get vehicles with their current status and crew info
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
            WHEN r.rental_id IS NOT NULL THEN 'taken'
            -- 2. Check for base availability rules
            WHEN c.availability_rules->>'type' = 'weekends_only' AND EXTRACT(ISODOW FROM CURRENT_DATE) IN (1, 2, 3, 4, 5) THEN 'unavailable'
            -- 3. If no blocking rules, it's available
            ELSE 'available'
        END AS availability,
        cr.name AS crew_name,
        cr.logo_url AS crew_logo_url
    FROM
        public.cars AS c
    LEFT JOIN
        public.rentals AS r ON c.id = r.vehicle_id AND r.status = 'active'
    LEFT JOIN
        public.crews AS cr ON c.crew_id = cr.id;
END;
$$;

-- Step 3: Create a function to get future bookings for a vehicle
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
        AND r.status IN ('active', 'confirmed', 'pending_confirmation')
        AND r.agreed_end_date >= CURRENT_DATE;
END;
$$;
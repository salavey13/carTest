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
            WHEN r.rental_id IS NOT NULL THEN 'taken'
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
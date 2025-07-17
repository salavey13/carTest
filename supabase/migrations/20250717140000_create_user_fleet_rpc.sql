CREATE OR REPLACE FUNCTION get_user_fleet_with_stats(p_user_id TEXT)
RETURNS TABLE (
    id TEXT,
    make TEXT,
    model TEXT,
    description TEXT,
    daily_price NUMERIC,
    image_url TEXT,
    rent_link TEXT,
    type TEXT,
    specs JSONB,
    owner_id TEXT,
    crew_id UUID,
    crew_name TEXT,
    crew_slug TEXT,
    crew_logo_url TEXT,
    rental_count BIGINT,
    total_revenue NUMERIC,
    active_rentals BIGINT
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
        c.daily_price,
        c.image_url,
        c.rent_link,
        c.type,
        c.specs,
        c.owner_id,
        cr.id as crew_id,
        cr.name as crew_name,
        cr.slug as crew_slug,
        cr.logo_url as crew_logo_url,
        COALESCE(rs.rental_count, 0) as rental_count,
        COALESCE(rs.total_revenue, 0) as total_revenue,
        COALESCE(rs.active_rentals, 0) as active_rentals
    FROM
        public.cars c
    LEFT JOIN
        public.crews cr ON c.crew_id = cr.id
    LEFT JOIN LATERAL (
        SELECT
            COUNT(r.rental_id) as rental_count,
            SUM(COALESCE(r.interest_amount, 0) + COALESCE(r.total_cost, 0)) as total_revenue,
            COUNT(*) FILTER (WHERE r.status IN ('active', 'confirmed', 'pending_confirmation')) as active_rentals
        FROM
            public.rentals r
        WHERE
            r.vehicle_id = c.id
    ) rs ON true
    WHERE
        c.owner_id = p_user_id;
END;
$$;
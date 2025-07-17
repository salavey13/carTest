DROP FUNCTION get_top_fleets();
CREATE OR REPLACE FUNCTION get_top_fleets()
RETURNS TABLE(
    owner_id TEXT,
    username TEXT,
    avatar_url TEXT,
    total_vehicles BIGINT,
    total_revenue NUMERIC
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        u.user_id as owner_id,
        u.username,
        u.avatar_url,
        (SELECT COUNT(*) FROM public.cars c WHERE c.owner_id = u.user_id) as total_vehicles,
        COALESCE(SUM(COALESCE(r.interest_amount, 0) + COALESCE(r.total_cost, 0)), 0) as total_revenue
    FROM
        public.users u
    LEFT JOIN
        public.rentals r ON u.user_id = r.owner_id AND r.payment_status IN ('fully_paid', 'interest_paid')
    WHERE
        EXISTS (SELECT 1 FROM public.cars c WHERE c.owner_id = u.user_id) -- Only include users who own at least one car
    GROUP BY
        u.user_id, u.username, u.avatar_url
    ORDER BY
        total_revenue DESC
    LIMIT 10;
END;
$$ LANGUAGE plpgsql;
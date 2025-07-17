DROP FUNCTION IF EXISTS get_top_crews();
CREATE OR REPLACE FUNCTION get_top_crews()
RETURNS TABLE(
    crew_id UUID,
    name TEXT,
    slug TEXT,
    logo_url TEXT,
    owner_id TEXT,
    owner_username TEXT,
    owner_avatar_url TEXT,
    total_members BIGINT,
    total_fleet_value NUMERIC
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        c.id as crew_id,
        c.name,
        c.slug,
        c.logo_url,
        c.owner_id,
        u.username as owner_username,
        u.avatar_url as owner_avatar_url,
        (SELECT COUNT(*) FROM public.crew_members cm WHERE cm.crew_id = c.id) as total_members,
        COALESCE((SELECT SUM(v.daily_price) FROM public.cars v WHERE v.crew_id = c.id), 0) * 100 AS total_fleet_value
    FROM
        public.crews c
    JOIN
        public.users u ON c.owner_id = u.user_id
    GROUP BY
        c.id, u.username, u.avatar_url
    ORDER BY
        total_fleet_value DESC, total_members DESC
    LIMIT 10;
END;
$$ LANGUAGE plpgsql;
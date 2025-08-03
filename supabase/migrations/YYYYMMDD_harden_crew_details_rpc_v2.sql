CREATE OR REPLACE FUNCTION get_public_crew_details(p_slug TEXT)
RETURNS TABLE (
    id UUID,
    name TEXT,
    description TEXT,
    logo_url TEXT,
    hq_location TEXT,
    owner json,
    members json,
    vehicles json
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT
        c.id,
        c.name,
        c.description,
        c.logo_url,
        c.hq_location,
        -- If owner is not found, return null instead of dropping the whole crew row
        CASE WHEN u.user_id IS NOT NULL THEN
            json_build_object('user_id', u.user_id, 'username', u.username)
        ELSE
            null
        END AS owner,
        COALESCE(
            (SELECT json_agg(json_build_object(
                'user_id', m.user_id, 'username', mu.username, 'avatar_url', mu.avatar_url,
                'role', m.role, 'status', m.status
             ))
             FROM public.crew_members m
             JOIN public.users mu ON m.user_id = mu.user_id
             WHERE m.crew_id = c.id),
            '[]'::json
        ) AS members,
        COALESCE(
            (SELECT json_agg(json_build_object(
                'id', v.id, 'make', v.make, 'model', v.model, 'image_url', v.image_url
             ))
             FROM public.cars v
             WHERE v.crew_id = c.id),
            '[]'::json
        ) AS vehicles
    FROM
        public.crews c
    -- CRITICAL CHANGE: Use LEFT JOIN to prevent crews with no/deleted owners from disappearing
    LEFT JOIN
        public.users u ON c.owner_id = u.user_id
    WHERE
        lower(c.slug) = lower(p_slug);
END;
$$;
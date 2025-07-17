CREATE OR REPLACE FUNCTION get_public_crews()
RETURNS TABLE(
    id UUID,
    name TEXT,
    slug TEXT,
    description TEXT,
    logo_url TEXT,
    owner_username TEXT,
    member_count BIGINT,
    vehicle_count BIGINT
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        c.id,
        c.name,
        c.slug,
        c.description,
        c.logo_url,
        u.username AS owner_username,
        (SELECT count(*) FROM public.crew_members cm WHERE cm.crew_id = c.id) AS member_count,
        (SELECT count(*) FROM public.cars v WHERE v.crew_id = c.id) AS vehicle_count
    FROM
        public.crews c
    LEFT JOIN
        public.users u ON c.owner_id = u.user_id
    ORDER BY
        c.created_at DESC;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION get_public_crew_details(p_slug TEXT)
RETURNS json AS $$
DECLARE
    crew_details json;
BEGIN
    SELECT
        json_build_object(
            'id', c.id,
            'name', c.name,
            'slug', c.slug,
            'description', c.description,
            'logo_url', c.logo_url,
            'created_at', c.created_at,
            'owner', json_build_object(
                'user_id', u.user_id,
                'username', u.username
            ),
            'members', (
                SELECT COALESCE(json_agg(
                    json_build_object(
                        'user_id', mem.user_id,
                        'username', mem_user.username,
                        'avatar_url', mem_user.avatar_url,
                        'role', mem.role
                    )
                ), '[]'::json)
                FROM public.crew_members mem
                JOIN public.users mem_user ON mem.user_id = mem_user.user_id
                WHERE mem.crew_id = c.id
            ),
            'vehicles', (
                SELECT COALESCE(json_agg(
                    json_build_object(
                        'id', v.id,
                        'make', v.make,
                        'model', v.model,
                        'image_url', v.image_url
                    )
                ), '[]'::json)
                FROM public.cars v
                WHERE v.crew_id = c.id
            )
        )
    INTO
        crew_details
    FROM
        public.crews c
    JOIN
        public.users u ON c.owner_id = u.user_id
    WHERE
        c.slug = p_slug;

    RETURN crew_details;
END;
$$ LANGUAGE plpgsql;
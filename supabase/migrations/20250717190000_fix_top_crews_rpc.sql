DROP FUNCTION IF EXISTS get_top_crews();
CREATE OR REPLACE FUNCTION public.get_top_crews()
 RETURNS TABLE(
    crew_id uuid, 
    crew_name text, 
    slug text, 
    logo_url text, 
    owner_id text, 
    owner_username text, 
    owner_avatar_url text, 
    total_members bigint, 
    total_fleet_value numeric,
    debug_info jsonb
 )
 LANGUAGE plpgsql
AS $function$
DECLARE
    v_debug_info jsonb;
BEGIN
    -- Collect diagnostic information
    v_debug_info := jsonb_build_object(
        'crews_count', (SELECT COUNT(*) FROM public.crews),
        'users_count', (SELECT COUNT(*) FROM public.users),
        'cars_count', (SELECT COUNT(*) FROM public.cars),
        'cars_with_crew_count', (SELECT COUNT(*) FROM public.cars WHERE public.cars.crew_id IS NOT NULL),
        'crew_members_count', (SELECT COUNT(*) FROM public.crew_members),
        'crews_with_cars_count', (
            SELECT COUNT(DISTINCT c.id) 
            FROM public.crews c
            JOIN public.cars car ON car.crew_id = c.id
        )
    );

    RETURN QUERY
    WITH crew_details AS (
        SELECT 
            c.id AS crew_id,
            c.name AS crew_name,
            c.slug,
            c.logo_url,
            c.owner_id,
            u.username AS owner_username,
            u.avatar_url AS owner_avatar_url,
            (
                SELECT COUNT(DISTINCT cm.user_id)
                FROM public.crew_members cm
                WHERE cm.crew_id = c.id
            ) AS total_members,
            (
                SELECT COALESCE(SUM(car.daily_price), 0)
                FROM public.cars car
                WHERE car.crew_id = c.id
            ) AS total_fleet_value
        FROM
            public.crews c
        JOIN
            public.users u ON c.owner_id = u.user_id
        WHERE
            EXISTS (
                SELECT 1 
                FROM public.cars car 
                WHERE car.crew_id = c.id
            )
    )
    SELECT 
        crew_details.crew_id, 
        crew_details.crew_name, 
        crew_details.slug, 
        crew_details.logo_url, 
        crew_details.owner_id, 
        crew_details.owner_username, 
        crew_details.owner_avatar_url, 
        crew_details.total_members, 
        crew_details.total_fleet_value,
        v_debug_info
    FROM 
        crew_details
    WHERE 
        crew_details.total_members > 0 OR crew_details.total_fleet_value > 0
    ORDER BY
        crew_details.total_fleet_value DESC, 
        crew_details.total_members DESC
    LIMIT 10;
END;
$function$;

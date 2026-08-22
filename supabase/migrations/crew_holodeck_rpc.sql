-- Run this code in your Supabase SQL Editor to create the new function

CREATE OR REPLACE FUNCTION get_user_crew_command_deck(p_user_id TEXT)
RETURNS TABLE (
    crew_id UUID,
    crew_name TEXT,
    crew_slug TEXT,
    crew_logo_url TEXT,
    total_vehicles BIGINT,
    vehicles_with_primary_photo BIGINT,
    vehicles_needing_gallery BIGINT,
    photo_completeness_percentage NUMERIC
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    WITH user_crew AS (
        SELECT id
        FROM public.crews
        WHERE owner_id = p_user_id
        LIMIT 1
    ),
    fleet_stats AS (
        SELECT
            c.crew_id,
            COUNT(*) AS total_vehicles,
            COUNT(*) FILTER (WHERE c.image_url IS NOT NULL AND c.image_url <> '') AS vehicles_with_primary_photo,
            COUNT(*) FILTER (WHERE c.specs->>'gallery' IS NULL OR jsonb_array_length(c.specs->'gallery') = 0) AS vehicles_needing_gallery
        FROM public.cars c
        WHERE c.crew_id = (SELECT id FROM user_crew)
        GROUP BY c.crew_id
    )
    SELECT
        uc.id AS crew_id,
        cr.name AS crew_name,
        cr.slug AS crew_slug,
        cr.logo_url AS crew_logo_url,
        COALESCE(fs.total_vehicles, 0) AS total_vehicles,
        COALESCE(fs.vehicles_with_primary_photo, 0) AS vehicles_with_primary_photo,
        COALESCE(fs.vehicles_needing_gallery, 0) AS vehicles_needing_gallery,
        CASE
            WHEN fs.total_vehicles > 0 THEN
                ROUND(
                    (COALESCE(fs.vehicles_with_primary_photo, 0)::NUMERIC / fs.total_vehicles) * 100
                )
            ELSE 0
        END AS photo_completeness_percentage
    FROM user_crew uc
    JOIN public.crews cr ON cr.id = uc.id
    LEFT JOIN fleet_stats fs ON fs.crew_id = uc.id;
END;
$$;
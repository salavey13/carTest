-- Run this code in your Supabase SQL Editor to fix the statistics calculation.

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
        -- Find the crew owned by the user
        SELECT c.id FROM public.crews c WHERE c.owner_id = p_user_id LIMIT 1
    ),
    fleet_stats AS (
        -- Calculate statistics for the fleet of that crew
        SELECT
            c.crew_id,
            COUNT(c.id) AS total_vehicles,
            
            -- Count vehicles that have a non-empty image_url
            COUNT(c.id) FILTER (WHERE c.image_url IS NOT NULL AND c.image_url <> '') AS vehicles_with_primary_photo,
            
            -- CRITICAL FIX: Count vehicles where 'gallery' is NULL, not a JSON null, or an empty array.
            -- Use `->` to keep the value as JSONB for jsonb_array_length.
            COUNT(c.id) FILTER (
                WHERE c.specs->'gallery' IS NULL 
                   OR c.specs->'gallery' = 'null'::jsonb 
                   OR jsonb_array_length(c.specs->'gallery') = 0
            ) AS vehicles_needing_gallery,

            -- Count vehicles that are "complete" (have both primary photo and a gallery)
            COUNT(c.id) FILTER (
                WHERE (c.image_url IS NOT NULL AND c.image_url <> '')
                  AND (c.specs->'gallery' IS NOT NULL AND c.specs->'gallery' <> 'null'::jsonb AND jsonb_array_length(c.specs->'gallery') > 0)
            ) AS vehicles_fully_photographed

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
        
        -- CRITICAL FIX: Recalculate percentage based on a more meaningful metric:
        -- The percentage of vehicles that have BOTH a primary photo AND a gallery.
        CASE
            WHEN fs.total_vehicles IS NULL OR fs.total_vehicles = 0 THEN 0
            ELSE ROUND((COALESCE(fs.vehicles_fully_photographed, 0)::NUMERIC / fs.total_vehicles) * 100)
        END AS photo_completeness_percentage
    FROM user_crew uc
    JOIN public.crews cr ON cr.id = uc.id
    LEFT JOIN fleet_stats fs ON fs.crew_id = uc.id;
END;
$$;
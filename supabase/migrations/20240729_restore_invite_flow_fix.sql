-- Run this in your Supabase SQL Editor

CREATE OR REPLACE FUNCTION get_crew_for_invite(p_slug TEXT)
RETURNS TABLE (
    id UUID,
    name TEXT,
    description TEXT,
    logo_url TEXT,
    owner_id TEXT,
    owner_username TEXT,
    hq_location TEXT
)
LANGUAGE sql
SECURITY DEFINER -- IMPORTANT: Runs with the permissions of the function owner
AS $$
    SELECT
        c.id,
        c.name,
        c.description,
        c.logo_url,
        c.owner_id,
        u.username as owner_username,
        c.hq_location
    FROM public.crews c
    JOIN public.users u ON c.owner_id = u.user_id
    WHERE c.slug = p_slug;
$$;
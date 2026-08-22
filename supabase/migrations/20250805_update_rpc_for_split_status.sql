DROP FUNCTION IF EXISTS public.get_crew_live_details(text);
CREATE OR REPLACE FUNCTION public.get_crew_live_details(p_slug text)
 RETURNS TABLE(id uuid, name text, description text, logo_url text, hq_location text, owner json, members json, vehicles json)
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
  RETURN QUERY
  SELECT
    c.id,
    c.name,
    c.description,
    c.logo_url,
    c.hq_location,
    COALESCE(
      (SELECT json_build_object('user_id', u.user_id, 'username', u.username, 'avatar_url', u.avatar_url)
       FROM public.users u
       WHERE u.user_id = c.owner_id),
      json_build_object('user_id', 'unknown', 'username', 'unknown_owner', 'avatar_url', null)
    ) AS owner,
    COALESCE(
      (SELECT json_agg(
        json_build_object(
          'user_id', m.user_id, 
          'username', mu.username, 
          'avatar_url', mu.avatar_url, 
          'role', m.role,
          'membership_status', m.membership_status, -- Статус членства (pending, active)
          'live_status', m.live_status, -- Живой статус (offline, online, riding)
          'last_location', ST_AsGeoJSON(m.last_location)
        ) ORDER BY m.joined_at
      )
      FROM public.crew_members m
      JOIN public.users mu ON m.user_id = mu.user_id
      WHERE m.crew_id = c.id),
      '[]'::json
    ) AS members,
    COALESCE(
      (SELECT json_agg(
        json_build_object(
          'id', v.id, 
          'make', v.make, 
          'model', v.model, 
          'image_url', v.image_url
        ) ORDER BY v.make, v.model
      )
      FROM public.cars v
      WHERE v.crew_id = c.id),
      '[]'::json
    ) AS vehicles
  FROM
    public.crews c
  WHERE
    c.slug = p_slug;
END;
$function$;
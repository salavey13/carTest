DROP FUNCTION get_top_fleets();
CREATE OR REPLACE FUNCTION public.get_top_fleets()
 RETURNS TABLE(owner_id text, username text, avatar_url text, total_vehicles bigint, total_revenue numeric, debug_info jsonb)
 LANGUAGE plpgsql
AS $function$
DECLARE
    v_debug_info JSONB;
BEGIN
    -- Collect diagnostic information
    v_debug_info := jsonb_build_object(
        'users_count', (SELECT COUNT(*) FROM public.users),
        'cars_count', (SELECT COUNT(*) FROM public.cars),
        'rentals_count', (SELECT COUNT(*) FROM public.rentals),
        'rentals_fully_paid_count', (SELECT COUNT(*) FROM public.rentals WHERE payment_status IN ('fully_paid', 'interest_paid')),
        'users_with_cars_count', (SELECT COUNT(DISTINCT user_id) FROM public.users WHERE user_id IN (SELECT DISTINCT public.cars.owner_id FROM public.cars))
    );

    RETURN QUERY
    WITH fleet_details AS (
        SELECT
            u.user_id AS owner_id,
            u.username,
            u.avatar_url,
            (SELECT COUNT(*) FROM public.cars WHERE public.cars.owner_id = u.user_id) AS total_vehicles,
            COALESCE(
                (
                    SELECT SUM(
                        COALESCE(public.rentals.interest_amount, 0) + 
                        COALESCE(public.rentals.total_cost, 0)
                    )
                    FROM public.rentals 
                    WHERE public.rentals.owner_id = u.user_id
                    AND public.rentals.payment_status IN ('fully_paid', 'interest_paid')
                ), 
                0
            ) AS total_revenue
        FROM
            public.users u
        WHERE
            EXISTS (SELECT 1 FROM public.cars WHERE public.cars.owner_id = u.user_id)
    )
    SELECT 
        fleet_details.owner_id, 
        fleet_details.username, 
        fleet_details.avatar_url, 
        fleet_details.total_vehicles, 
        fleet_details.total_revenue,
        v_debug_info
    FROM 
        fleet_details
    WHERE 
        fleet_details.total_vehicles > 0 OR fleet_details.total_revenue > 0
    ORDER BY
        fleet_details.total_revenue DESC, 
        fleet_details.total_vehicles DESC
    LIMIT 10;
END;
$function$;

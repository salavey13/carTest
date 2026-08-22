CREATE OR REPLACE FUNCTION public.get_user_rentals_dashboard_new(
    p_user_id TEXT,
    p_minimal BOOLEAN DEFAULT false
)
RETURNS TABLE (
    rental_id UUID,
    user_id TEXT,
    vehicle_id TEXT,
    owner_id TEXT,
    status TEXT,
    payment_status TEXT,
    interest_amount NUMERIC,
    total_cost NUMERIC,
    requested_start_date TIMESTAMPTZ,
    requested_end_date TIMESTAMPTZ,
    agreed_start_date TIMESTAMPTZ,
    agreed_end_date TIMESTAMPTZ,
    delivery_address TEXT,
    created_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ,
    metadata JSONB
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    IF p_minimal THEN
        RETURN QUERY
        SELECT 
            r.rental_id,
            NULL::TEXT,
            NULL::TEXT,
            NULL::TEXT,
            r.status,
            NULL::TEXT,
            NULL::NUMERIC,
            NULL::NUMERIC,
            NULL::TIMESTAMPTZ,
            NULL::TIMESTAMPTZ,
            NULL::TIMESTAMPTZ,
            NULL::TIMESTAMPTZ,
            NULL::TEXT,
            NULL::TIMESTAMPTZ,
            NULL::TIMESTAMPTZ,
            NULL::JSONB
        FROM public.rentals r
        WHERE r.user_id = p_user_id
        ORDER BY r.created_at DESC;
    ELSE
        RETURN QUERY
        SELECT 
            r.rental_id,
            r.user_id,
            r.vehicle_id,
            r.owner_id,
            r.status,
            r.payment_status,
            COALESCE(r.interest_amount, 0),
            COALESCE(r.total_cost, 0),
            r.requested_start_date,
            r.requested_end_date,
            r.agreed_start_date,
            r.agreed_end_date,
            r.delivery_address,
            r.created_at,
            r.updated_at,
            COALESCE(r.metadata, '{}')::JSONB
        FROM public.rentals r
        WHERE r.user_id = p_user_id
        ORDER BY r.created_at DESC;
    END IF;
END;
$$;

COMMENT ON FUNCTION public.get_user_rentals_dashboard_new IS
'Возвращает аренды для дашборда пользователя. Если p_minimal = true — только rental_id и status.';
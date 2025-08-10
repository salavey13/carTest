CREATE OR REPLACE FUNCTION public.get_user_rentals_dashboard(
    p_owned_crew_ids UUID[],
    p_user_id TEXT,
    p_minimal BOOLEAN DEFAULT false
)
RETURNS TABLE (
    -- Основные поля, как и раньше
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
    metadata JSONB,
    
    -- >>> НОВЫЕ ПОЛЯ ДЛЯ ФРОНТЕНДА <<<
    user_role TEXT,
    vehicle_make TEXT,
    vehicle_model TEXT,
    vehicle_image_url TEXT
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- В режиме p_minimal возвращаем только статус и ID, остальное NULL.
    -- Это экономит ресурсы, если нужны только базовые данные.
    IF p_minimal THEN
        RETURN QUERY
        SELECT 
            r.rental_id,
            NULL::TEXT, NULL::TEXT, NULL::TEXT,
            r.status,
            NULL::TEXT, NULL::NUMERIC, NULL::NUMERIC,
            NULL::TIMESTAMPTZ, NULL::TIMESTAMPTZ, NULL::TIMESTAMPTZ, NULL::TIMESTAMPTZ,
            NULL::TEXT, NULL::TIMESTAMPTZ, NULL::TIMESTAMPTZ, NULL::JSONB,
            -- Добавляем NULL для новых полей
            NULL::TEXT, NULL::TEXT, NULL::TEXT, NULL::TEXT
        FROM public.rentals r
        LEFT JOIN public.cars c ON r.vehicle_id = c.id
        WHERE 
            (r.owner_id = p_user_id OR c.crew_id = ANY(p_owned_crew_ids))
            OR
            r.user_id = p_user_id
        ORDER BY r.created_at DESC;
    ELSE
        -- В полном режиме возвращаем все данные
        RETURN QUERY
        SELECT 
            r.rental_id, r.user_id, r.vehicle_id, r.owner_id,
            r.status, r.payment_status, r.interest_amount, r.total_cost,
            r.requested_start_date, r.requested_end_date, r.agreed_start_date, r.agreed_end_date,
            r.delivery_address, r.created_at, r.updated_at, r.metadata,
            
            -- >>> ЛОГИКА ДЛЯ НОВЫХ ПОЛЕЙ <<<
            CASE
                WHEN r.user_id = p_user_id THEN 'renter'
                WHEN c.crew_id = ANY(p_owned_crew_ids) THEN 'crew_owner'
                WHEN r.owner_id = p_user_id THEN 'owner'
                ELSE 'unknown'
            END AS user_role,
            c.make AS vehicle_make,
            c.model AS vehicle_model,
            c.image_url AS vehicle_image_url

        FROM public.rentals r
        LEFT JOIN public.cars c ON r.vehicle_id = c.id -- JOIN уже был, теперь используем его
        WHERE 
            (r.owner_id = p_user_id OR c.crew_id = ANY(p_owned_crew_ids))
            OR
            r.user_id = p_user_id
        ORDER BY r.created_at DESC;
    END IF;
END;
$$;

-- Обновляем комментарий, чтобы отразить новые поля
COMMENT ON FUNCTION public.get_user_rentals_dashboard IS
'Возвращает аренды для дашборда. Включает роль пользователя и базовую информацию о ТС. Если p_minimal = true — только rental_id и status.';
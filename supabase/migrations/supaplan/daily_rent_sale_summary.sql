-- Daily Rent/Sale Summary Function
-- Creates a function that reads today's rent/sale data and sends summary via forward-telegram API
-- Usage: SELECT public.send_daily_rent_sale_summary('chat_id_from_db');

-- Step 1: Enable pg_net extension if not already enabled
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Step 2: Create the summary function
CREATE OR REPLACE FUNCTION public.send_daily_rent_sale_summary(target_chat_id TEXT DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    -- Today's date range
    today_start TIMESTAMPTZ := date_trunc('day', now());
    today_end TIMESTAMPTZ := date_trunc('day', now()) + interval '1 day';

    -- Summary data
    rental_count INTEGER := 0;
    rental_total NUMERIC := 0;
    sale_count INTEGER := 0;
    sale_total NUMERIC := 0;

    -- Individual records for details
    rental_details TEXT := '';
    sale_details TEXT := '';

    -- API configuration
    api_url TEXT;
    api_secret TEXT;
    chat_id TEXT := target_chat_id;

    -- Response
    response_id BIGINT;
    response_body jsonb;

    -- Record variables
    r RECORD;
BEGIN
    -- Step 1: Calculate rental statistics for today
    SELECT
        COUNT(*),
        COALESCE(SUM(total_cost), 0)
    INTO rental_count, rental_total
    FROM public.rentals
    WHERE created_at >= today_start
      AND created_at < today_end
      AND status NOT IN ('cancelled', 'disputed');

    -- Step 2: Calculate sale statistics for today
    -- Sales are tracked via cars table with specs->>'sale' = 1
    -- We need to track when a bike was sold - let's use metadata or a separate tracking approach
    -- For now, we'll count bikes marked as 'sale' in specs
    SELECT
        COUNT(*),
        COALESCE(SUM((specs->>'price_rub')::NUMERIC), 0)
    INTO sale_count, sale_total
    FROM public.cars
    WHERE (specs->>'sale')::INT = 1
      AND created_at >= today_start
      AND created_at < today_end;

    -- Step 3: Build rental details
    rental_details := 'RENTALS TODAY:\\n';
    IF rental_count > 0 THEN
        FOR r IN
            SELECT
                r.vehicle_id,
                make || ' ' || model AS vehicle_name,
                total_cost,
                status,
                created_at
            FROM public.rentals r
            JOIN public.cars ON r.vehicle_id = cars.id
            WHERE r.created_at >= today_start
              AND r.created_at < today_end
              AND r.status NOT IN ('cancelled', 'disputed')
            ORDER BY r.created_at DESC
        LOOP
            rental_details := rental_details || FORMAT('• %s - %s RUB - %s\\n',
                r.vehicle_name,
                r.total_cost,
                r.status
            );
        END LOOP;
    ELSE
        rental_details := rental_details || 'No rentals today\\n';
    END IF;

    -- Step 4: Build sale details
    sale_details := '\\nSALES TODAY:\\n';
    IF sale_count > 0 THEN
        FOR r IN
            SELECT
                id,
                make || ' ' || model AS vehicle_name,
                (specs->>'price_rub')::NUMERIC AS price,
                created_at
            FROM public.cars
            WHERE (specs->>'sale')::INT = 1
              AND created_at >= today_start
              AND created_at < today_end
            ORDER BY created_at DESC
        LOOP
            sale_details := sale_details || FORMAT('• %s - %s RUB\\n',
                r.vehicle_name,
                r.price
            );
        END LOOP;
    ELSE
        sale_details := sale_details || 'No sales today\\n';
    END IF;

    -- Step 5: If no target chat_id provided, return summary without sending
    IF chat_id IS NULL THEN
        -- Try to get admin chat_id from environment or default
        chat_id := '356282674'; -- Default admin chat_id
    END IF;

    -- Step 6: Build the message
    DECLARE
        message_text TEXT;
    BEGIN
        message_text := FORMAT(
            '📊 DAILY REPORT - %s\\n\\n' ||
            '🔑 RENTALS: %s transactions | %s RUB total\\n' ||
            '💰 SALES: %s transactions | %s RUB total\\n\\n' ||
            '💵 TOTAL REVENUE: %s RUB\\n\\n' ||
            '%s' ||
            '%s',
            now()::DATE,
            rental_count,
            rental_total,
            sale_count,
            sale_total,
            rental_total + sale_total,
            rental_details,
            sale_details
        );

        -- Step 7: Get API credentials from vault
        SELECT decrypted_secret INTO api_url
        FROM vault.decrypted_secrets
        WHERE name = 'NOTIFY_API_URL'
        LIMIT 1;

        SELECT decrypted_secret INTO api_secret
        FROM vault.decrypted_secrets
        WHERE name = 'CRON_SECRET'
        LIMIT 1;

        -- Step 8: Send via forward-telegram API
        IF api_url IS NOT NULL AND api_secret IS NOT NULL THEN
            -- Call the forward-telegram API endpoint
            -- The API should have a route like /api/forward-telegram
            SELECT net.http_post(
                url := api_url || '/api/forward-telegram',
                headers := jsonb_build_object(
                    'Content-Type', 'application/json',
                    'x-codex-bridge-secret', api_secret
                ),
                body := jsonb_build_object(
                    'chat_id', chat_id,
                    'method', 'sendMessage',
                    'payload', jsonb_build_object(
                        'text', message_text,
                        'parse_mode', 'HTML'
                    )
                ),
                timeout := 10
            ) INTO response_id;

            -- Get response body
            SELECT content::jsonb INTO response_body
            FROM net.http_response_record
            WHERE id = response_id;

            -- Return result
            RETURN jsonb_build_object(
                'success', (response_body->>'ok')::BOOLEAN,
                'rental_count', rental_count,
                'rental_total', rental_total,
                'sale_count', sale_count,
                'sale_total', sale_total,
                'total_revenue', rental_total + sale_total,
                'message', message_text,
                'response', response_body,
                'chat_id', chat_id
            );
        ELSE
            -- API credentials not found, return summary without sending
            RETURN jsonb_build_object(
                'success', false,
                'error', 'API credentials not found in Vault',
                'rental_count', rental_count,
                'rental_total', rental_total,
                'sale_count', sale_count,
                'sale_total', sale_total,
                'total_revenue', rental_total + sale_total,
                'message', message_text,
                'chat_id', chat_id
            );
        END IF;
    END;
END;
$$;

COMMENT ON FUNCTION public.send_daily_rent_sale_summary IS 'Sends daily rent/sale summary via forward-telegram API. Can be called with pg_cron or manually.';

-- Step 3: Create a helper function to get summary without sending
CREATE OR REPLACE FUNCTION public.get_daily_rent_sale_summary()
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
AS $$
    SELECT jsonb_build_object(
        'rental_count', (
            SELECT COUNT(*)
            FROM public.rentals
            WHERE created_at >= date_trunc('day', now())
              AND created_at < date_trunc('day', now()) + interval '1 day'
              AND status NOT IN ('cancelled', 'disputed')
        ),
        'rental_total', (
            SELECT COALESCE(SUM(total_cost), 0)
            FROM public.rentals
            WHERE created_at >= date_trunc('day', now())
              AND created_at < date_trunc('day', now()) + interval '1 day'
              AND status NOT IN ('cancelled', 'disputed')
        ),
        'sale_count', (
            SELECT COUNT(*)
            FROM public.cars
            WHERE (specs->>'sale')::INT = 1
              AND created_at >= date_trunc('day', now())
              AND created_at < date_trunc('day', now()) + interval '1 day'
        ),
        'sale_total', (
            SELECT COALESCE(SUM((specs->>'price_rub')::NUMERIC), 0)
            FROM public.cars
            WHERE (specs->>'sale')::INT = 1
              AND created_at >= date_trunc('day', now())
              AND created_at < date_trunc('day', now()) + interval '1 day'
        )
    );
$$;

COMMENT ON FUNCTION public.get_daily_rent_sale_summary IS 'Returns daily rent/sale summary without sending notification.';

-- Step 4: Create a view for crew member earnings (for future salary calculations)
CREATE OR REPLACE VIEW public.crew_daily_earnings AS
WITH today_rentals AS (
    SELECT
        r.owner_id AS crew_member_id,
        COUNT(*) AS rental_count,
        COALESCE(SUM(r.total_cost), 0) AS rental_total
    FROM public.rentals r
    WHERE r.created_at >= date_trunc('day', now())
      AND r.created_at < date_trunc('day', now()) + interval '1 day'
      AND r.status NOT IN ('cancelled', 'disputed')
    GROUP BY r.owner_id
),
today_sales AS (
    SELECT
        c.owner_id AS crew_member_id,
        COUNT(*) AS sale_count,
        COALESCE(SUM((c.specs->>'price_rub')::NUMERIC), 0) AS sale_total
    FROM public.cars c
    WHERE (c.specs->>'sale')::INT = 1
      AND c.created_at >= date_trunc('day', now())
      AND c.created_at < date_trunc('day', now()) + interval '1 day'
    GROUP BY c.owner_id
)
SELECT
    COALESCE(r.crew_member_id, s.crew_member_id) AS crew_member_id,
    u.name AS crew_member_name,
    COALESCE(r.rental_count, 0) AS rental_count,
    COALESCE(r.rental_total, 0) AS rental_total,
    COALESCE(s.sale_count, 0) AS sale_count,
    COALESCE(s.sale_total, 0) AS sale_total,
    COALESCE(r.rental_total, 0) + COALESCE(s.sale_total, 0) AS total_earnings
FROM today_rentals r
FULL OUTER JOIN today_sales s ON r.crew_member_id = s.crew_member_id
LEFT JOIN public.users u ON COALESCE(r.crew_member_id, s.crew_member_id) = u.user_id;

COMMENT ON VIEW public.crew_daily_earnings IS 'Daily earnings breakdown by crew member (for future salary calculations)';

-- Grant necessary permissions
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.send_daily_rent_sale_summary TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_daily_rent_sale_summary TO authenticated, anon;
GRANT SELECT ON public.crew_daily_earnings TO authenticated;

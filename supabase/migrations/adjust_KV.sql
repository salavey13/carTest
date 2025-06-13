-- /supabase/migrations/adjust_KV.sql
CREATE OR REPLACE FUNCTION adjust_kilovibes(
    p_user_id TEXT,
    p_kv_adjustment NUMERIC
)
RETURNS TABLE (
    success BOOLEAN,
    new_balance NUMERIC,
    message TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    current_kv NUMERIC;
    updated_kv NUMERIC;
    user_metadata JSONB;
BEGIN
    -- Select the user's metadata and lock the row for update
    SELECT metadata INTO user_metadata FROM public.users WHERE user_id = p_user_id FOR UPDATE;

    -- If user not found, return failure
    IF user_metadata IS NULL THEN
        RETURN QUERY SELECT FALSE, NULL::NUMERIC, 'User not found';
        RETURN;
    END IF;

    -- Get current KiloVibes, defaulting to 0 if not present
    current_kv := (user_metadata->'cyberFitness'->>'kiloVibes')::NUMERIC;
    IF current_kv IS NULL THEN
        current_kv := 0;
    END IF;

    -- Check for sufficient funds if spending
    IF p_kv_adjustment < 0 AND current_kv < ABS(p_kv_adjustment) THEN
        RETURN QUERY SELECT FALSE, current_kv, 'Insufficient KiloVibes';
        RETURN;
    END IF;

    -- Calculate the new balance
    updated_kv := current_kv + p_kv_adjustment;

    -- Update the metadata with the new balance
    -- jsonb_set will create the path if it doesn't exist
    user_metadata := jsonb_set(
        user_metadata,
        '{cyberFitness,kiloVibes}',
        to_jsonb(updated_kv),
        true -- create_missing
    );
    -- Also update the timestamp
    user_metadata := jsonb_set(
        user_metadata,
        '{cyberFitness,lastActivityTimestamp}',
        to_jsonb(now() at time zone 'utc'),
        true
    );

    UPDATE public.users
    SET metadata = user_metadata
    WHERE user_id = p_user_id;

    -- Return success with the new balance
    RETURN QUERY SELECT TRUE, updated_kv, 'KiloVibes updated successfully';
    RETURN;

EXCEPTION
    WHEN OTHERS THEN
        -- Log the error and return failure
        RAISE WARNING 'adjust_kilovibes failed for user %: %', p_user_id, SQLERRM;
        RETURN QUERY SELECT FALSE, NULL::NUMERIC, 'An unexpected database error occurred: ' || SQLERRM;
        RETURN;
END;
$$;

-- Grant execute permissions to the authenticated role
GRANT EXECUTE ON FUNCTION public.adjust_kilovibes(TEXT, NUMERIC) TO authenticated;
GRANT EXECUTE ON FUNCTION public.adjust_kilovibes(TEXT, NUMERIC) TO service_role;

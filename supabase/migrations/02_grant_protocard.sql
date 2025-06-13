-- supabase/migrations/02_grant_protocard.sql
CREATE OR REPLACE FUNCTION grant_protocard_access(
    p_user_id TEXT,
    p_card_id TEXT,
    p_card_details JSONB
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    user_metadata JSONB;
BEGIN
    -- Select the user's metadata and lock the row for update to prevent race conditions
    SELECT metadata INTO user_metadata FROM public.users WHERE id = p_user_id FOR UPDATE;

    -- If user not found, raise an exception. The calling code should handle this.
    IF user_metadata IS NULL THEN
        RAISE EXCEPTION 'User not found with user_id %', p_user_id;
    END IF;

    -- If xtr_protocards object doesn't exist, initialize it.
    IF user_metadata->'xtr_protocards' IS NULL THEN
        user_metadata := jsonb_set(user_metadata, '{xtr_protocards}', '{}'::jsonb, true);
    END IF;

    -- Add or update the specific protocard's details.
    user_metadata := jsonb_set(
        user_metadata,
        ARRAY['xtr_protocards', p_card_id],
        p_card_details,
        true -- create_missing flag
    );

    -- Update the user's metadata column with the new data.
    UPDATE public.users
    SET metadata = user_metadata
    WHERE id = p_user_id;

EXCEPTION
    WHEN OTHERS THEN
        -- Log the error and re-raise it so the transaction fails
        RAISE WARNING 'grant_protocard_access failed for user % and card %: %', p_user_id, p_card_id, SQLERRM;
        RAISE;
END;
$$;

-- Grant execute permissions to the roles that will call this function
GRANT EXECUTE ON FUNCTION public.grant_protocard_access(TEXT, TEXT, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION public.grant_protocard_access(TEXT, TEXT, JSONB) TO service_role;

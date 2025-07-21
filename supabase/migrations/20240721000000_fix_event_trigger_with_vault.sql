-- Step 1: Replace the trigger function to correctly use Supabase Vault.
-- This version queries the vault.decrypted_secrets view, which is the correct way.

CREATE OR REPLACE FUNCTION public.handle_new_rental_event()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    api_url TEXT;
    api_secret TEXT;
BEGIN
    -- Correctly and securely fetch secrets from the Supabase Vault.
    -- This requires secrets named 'NOTIFY_API_URL' and 'CRON_SECRET' to exist in your Vault.
    SELECT decrypted_secret INTO api_url FROM vault.decrypted_secrets WHERE name = 'NOTIFY_API_URL' LIMIT 1;
    SELECT decrypted_secret INTO api_secret FROM vault.decrypted_secrets WHERE name = 'CRON_SECRET' LIMIT 1;

    -- If secrets are not found, log a warning and exit gracefully.
    IF api_url IS NULL OR api_secret IS NULL THEN
        RAISE WARNING 'handle_new_rental_event trigger failed: Could not find NOTIFY_API_URL or CRON_SECRET in Vault.';
        RETURN NEW;
    END IF;

    -- Perform the HTTP request to our own notification API endpoint.
    -- This requires the pg_net extension to be enabled.
    PERFORM net.http_post(
        url := api_url,
        headers := jsonb_build_object(
            'Authorization', 'Bearer ' || api_secret,
            'Content-Type', 'application/json'
        ),
        body := jsonb_build_object(
            'event_id', NEW.id,
            'rental_id', NEW.rental_id,
            'event_type', NEW.type,
            'created_by', NEW.created_by,
            'payload', NEW.payload
        )
    );

    RETURN NEW;
EXCEPTION
    WHEN OTHERS THEN
        RAISE WARNING 'handle_new_rental_event trigger failed with an exception: %', SQLERRM;
        RETURN NEW;
END;
$$;

-- No changes needed for the trigger itself, just the function it calls.
COMMENT ON FUNCTION public.handle_new_rental_event IS 'Handles new rental events by POSTing to a Vercel API endpoint. Securely fetches secrets from Supabase Vault.';
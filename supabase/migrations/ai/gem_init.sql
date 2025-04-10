-- Drop dependent objects first if recreating the table/type
DROP TRIGGER IF EXISTS on_ai_requests_update ON public.ai_requests;
DROP TRIGGER IF EXISTS after_ai_request_insert ON public.ai_requests;
DROP FUNCTION IF EXISTS public.handle_updated_at();
DROP FUNCTION IF EXISTS public.update_user_last_ai_request();
DROP TABLE IF EXISTS public.ai_requests;
DROP TYPE IF EXISTS public.ai_request_status;

-- Enum for request status
CREATE TYPE public.ai_request_status AS ENUM (
    'pending',
    'processing',
    'completed',
    'failed'
);

-- Table to store AI requests
CREATE TABLE public.ai_requests (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    -- Reference public.users table using the text user_id
    user_id text REFERENCES public.users(user_id) ON DELETE SET NULL,
    status public.ai_request_status DEFAULT 'pending'::public.ai_request_status NOT NULL,
    prompt text NOT NULL,
    model_name text DEFAULT 'gemini-2.5-pro-exp-0325',
    response text,
    error_message text,
    generation_config jsonb,
    safety_settings jsonb
);

-- Optional: Index on user_id (text) and status
CREATE INDEX idx_ai_requests_user_status ON public.ai_requests(user_id, status);

-- Trigger function to automatically update 'updated_at' timestamp
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update 'updated_at' on row update
CREATE TRIGGER on_ai_requests_update
BEFORE UPDATE ON public.ai_requests
FOR EACH ROW
EXECUTE FUNCTION public.handle_updated_at();

-- NEW: Trigger function to update users.metadata after ai_request insert
CREATE OR REPLACE FUNCTION public.update_user_last_ai_request()
RETURNS TRIGGER AS $$
BEGIN
    -- Check if user_id is not NULL in the inserted row
    IF NEW.user_id IS NOT NULL THEN
        -- Update the metadata field in the public.users table
        UPDATE public.users
        SET metadata = jsonb_set(
                            COALESCE(metadata, '{}'::jsonb), -- Ensure metadata is not NULL
                            '{last_ai_request_id}', -- Path to the key
                            to_jsonb(NEW.id::text), -- The ID of the newly inserted request as JSONB text
                            true -- Create the key if it doesn't exist
                         )
        WHERE public.users.user_id = NEW.user_id; -- Match the user
    END IF;

    RETURN NEW; -- Result is ignored for AFTER trigger, but required syntax
END;
$$ LANGUAGE plpgsql;

-- NEW: Trigger to call the function after a new AI request is inserted
CREATE TRIGGER after_ai_request_insert
AFTER INSERT ON public.ai_requests
FOR EACH ROW
EXECUTE FUNCTION public.update_user_last_ai_request();

-- Grant usage on the enum type
GRANT USAGE ON TYPE public.ai_request_status TO postgres, anon, authenticated, service_role;

-- Grant permissions on the ai_requests table
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.ai_requests TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.ai_requests TO authenticated; -- Adjust as needed
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.ai_requests TO anon;        -- Adjust as needed

-- Grant permissions on the trigger functions (important!)
GRANT EXECUTE ON FUNCTION public.handle_updated_at() TO postgres, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.update_user_last_ai_request() TO postgres, anon, authenticated, service_role;

-- Ensure the roles that insert into ai_requests can also UPDATE the users table
-- You might grant UPDATE specifically on the 'metadata' column for tighter security
GRANT UPDATE ON TABLE public.users TO authenticated; -- Or the specific role performing inserts
GRANT UPDATE ON TABLE public.users TO service_role; -- If the edge function might insert directly
-- Example for specific column grant:
-- GRANT UPDATE (metadata) ON TABLE public.users TO authenticated;

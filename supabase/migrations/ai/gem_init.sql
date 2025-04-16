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
    model_name text DEFAULT 'gemini-1.5-flash-latest', -- Changed default model
    response text,
    error_message text,
    generation_config jsonb,
    safety_settings jsonb
);

-- Optional: Index on user_id (text) and status
CREATE INDEX idx_ai_requests_user_status ON public.ai_requests(user_id, status);
-- Optional: Index on status for faster querying of pending tasks
CREATE INDEX idx_ai_requests_status ON public.ai_requests(status);


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
-- This function updates the user's metadata with the ID of the latest AI request submitted by them.
CREATE OR REPLACE FUNCTION public.update_user_last_ai_request()
RETURNS TRIGGER AS $$
BEGIN
    -- Check if user_id is not NULL in the inserted row (should always be set from the frontend)
    IF NEW.user_id IS NOT NULL THEN
        -- Update the metadata field in the public.users table
        UPDATE public.users
        SET metadata = jsonb_set(
                            COALESCE(metadata, '{}'::jsonb), -- Ensure metadata is not NULL, initialize if needed
                            '{last_ai_request_id}', -- Path to the key within the metadata JSONB
                            to_jsonb(NEW.id::text), -- The ID of the newly inserted ai_requests row as JSONB text
                            true -- Create the 'last_ai_request_id' key if it doesn't exist
                         )
        WHERE public.users.user_id = NEW.user_id; -- Match the user by their ID
    END IF;

    RETURN NEW; -- Result is ignored for AFTER trigger, but required syntax
END;
$$ LANGUAGE plpgsql SECURITY DEFINER; -- Use SECURITY DEFINER if the function needs permissions of the creator

-- NEW: Trigger to call the function after a new AI request is inserted
CREATE TRIGGER after_ai_request_insert
AFTER INSERT ON public.ai_requests
FOR EACH ROW
EXECUTE FUNCTION public.update_user_last_ai_request();

-- Grant usage on the enum type
GRANT USAGE ON TYPE public.ai_request_status TO postgres, anon, authenticated, service_role;

-- Grant permissions on the ai_requests table
-- service_role needs full access for edge functions/triggers
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.ai_requests TO service_role;
-- authenticated users likely need SELECT and INSERT, maybe UPDATE (their own) depending on RLS
GRANT SELECT, INSERT ON TABLE public.ai_requests TO authenticated;
-- anon users likely only need SELECT if you want to show public results (unlikely here)
-- GRANT SELECT ON TABLE public.ai_requests TO anon;

-- Enable Row Level Security (RLS) for ai_requests
ALTER TABLE public.ai_requests ENABLE ROW LEVEL SECURITY;

-- Policy: Authenticated users can insert requests for themselves
CREATE POLICY "Allow authenticated insert for self" ON public.ai_requests
AS PERMISSIVE FOR INSERT
TO authenticated
WITH CHECK (auth.jwt() ->> 'chat_id' = user_id);

-- Policy: Users can select their own requests
CREATE POLICY "Allow authenticated select for self" ON public.ai_requests
AS PERMISSIVE FOR SELECT
TO authenticated
USING (auth.jwt() ->> 'chat_id' = user_id);

-- Policy: Users can update the status/response/error of their own requests (or service_role for edge function)
-- Note: This allows users to update their *own* requests.
-- The Edge Function runs as service_role and bypasses RLS by default.
-- If you want ONLY the edge function to update results, restrict this policy.
-- CREATE POLICY "Allow authenticated update for self" ON public.ai_requests
-- AS PERMISSIVE FOR UPDATE
-- TO authenticated
-- USING (auth.jwt() ->> 'chat_id' = user_id)
-- WITH CHECK (auth.jwt() ->> 'chat_id' = user_id);

-- Grant permissions on the trigger functions (important!)
GRANT EXECUTE ON FUNCTION public.handle_updated_at() TO postgres, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.update_user_last_ai_request() TO postgres, anon, authenticated, service_role;

-- Ensure the roles that insert into ai_requests can also UPDATE the users table
-- This is typically handled by the 'update_user_last_ai_request' trigger running as SECURITY DEFINER
-- Or, if the trigger is not SECURITY DEFINER, grant update permission on the users table metadata column
-- GRANT UPDATE (metadata) ON TABLE public.users TO authenticated; -- Example if needed
GRANT UPDATE ON TABLE public.users TO service_role; -- Allow service role (edge function) to update metadata if needed

-- Grant permission to invoke the edge function (adjust role as needed)
-- GRANT USAGE ON SCHEMA functions TO authenticated; -- If users call it directly (unlikely here)
-- GRANT EXECUTE ON FUNCTION functions.ai-request-handler TO authenticated;
-- Enum for request status (optional but recommended)
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
    user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL, -- Link to user if logged in
    status public.ai_request_status DEFAULT 'pending'::public.ai_request_status NOT NULL,
    prompt text NOT NULL,
    model_name text DEFAULT 'gemini-1.5-pro-latest', -- Or your preferred default
    response text, -- Stores the successful AI response
    error_message text, -- Stores error details if status is 'failed'
    generation_config jsonb, -- Optional: Store specific generation settings
    safety_settings jsonb -- Optional: Store specific safety settings
);

-- Enable Row Level Security (Recommended)
ALTER TABLE public.ai_requests ENABLE ROW LEVEL SECURITY;

-- Policy: Allow users to insert their own requests
CREATE POLICY "Allow users insert own requests"
ON public.ai_requests
FOR INSERT
TO authenticated -- Or 'public' if anonymous users can make requests
WITH CHECK (auth.uid() = user_id); -- Ensure user_id matches the logged-in user

-- Policy: Allow users to read their own requests (for Realtime/Polling)
CREATE POLICY "Allow users read own requests"
ON public.ai_requests
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Policy: Allow the Edge Function (using service_role) to update any request
-- Note: Service role bypasses RLS by default, but explicit policy can be clearer if needed.
-- CREATE POLICY "Allow service_role full access" ON public.ai_requests FOR ALL USING (true) WITH CHECK (true);

-- Optional: Index on status and user_id for faster lookups
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

-- Grant usage on the enum type to relevant roles if needed
GRANT USAGE ON TYPE public.ai_request_status TO authenticated, anon, service_role;
-- Grant permissions on the table
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.ai_requests TO service_role; -- Service role needs full access
GRANT SELECT, INSERT ON TABLE public.ai_requests TO authenticated;
GRANT SELECT ON TABLE public.ai_requests TO anon; -- If anon users can read (adjust RLS policy too)
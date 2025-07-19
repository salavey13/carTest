-- Step 1: Create the new 'events' table
CREATE TABLE public.events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    rental_id UUID NOT NULL REFERENCES public.rentals(rental_id) ON DELETE CASCADE,
    type TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending', -- pending, accepted, completed, cancelled
    payload JSONB DEFAULT '{}'::jsonb,
    created_by TEXT NOT NULL REFERENCES public.users(user_id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT now()
);

COMMENT ON TABLE public.events IS 'A real-time log of all events related to a rental journey.';
COMMENT ON COLUMN public.events.type IS 'e.g., payment_init, photo_start, sos_fuel, pickup_confirm';
COMMENT ON COLUMN public.events.status IS 'The current status of this specific event.';
COMMENT ON COLUMN public.events.payload IS 'Data specific to the event, like a photo URL or an XTR amount.';

-- Step 2: Enable RLS and define policies
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users in a rental can view its events"
ON public.events FOR SELECT
USING (
    (SELECT EXISTS (
        SELECT 1 FROM public.rentals
        WHERE rental_id = events.rental_id AND (
            user_id = auth.jwt()->>'chat_id' OR 
            owner_id = auth.jwt()->>'chat_id'
        )
    ))
);

CREATE POLICY "Users in a rental can create events"
ON public.events FOR INSERT
WITH CHECK (
    created_by = auth.jwt()->>'chat_id' AND
    (SELECT EXISTS (
        SELECT 1 FROM public.rentals
        WHERE rental_id = events.rental_id AND (
            user_id = auth.jwt()->>'chat_id' OR
            owner_id = auth.jwt()->>'chat_id'
        )
    ))
);


-- Step 3: Enable Realtime on the new table
ALTER PUBLICATION supabase_realtime ADD TABLE public.events;

-- Step 4: Create a function to handle new event notifications by calling our API
CREATE OR REPLACE FUNCTION public.handle_new_rental_event()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    -- The base URL of your Vercel deployment, INCLUDING the /api/notify part
    -- Store this in Supabase secrets: `supabase secrets set NOTIFY_API_URL=https://<your-project>.vercel.app/api/notify`
    api_url TEXT := secrets.get('NOTIFY_API_URL');
    api_secret TEXT := secrets.get('CRON_SECRET'); -- A shared secret
BEGIN
    -- We are delegating the complex logic of sending messages to our own API.
    -- The database's job is to simply and reliably report that a new event happened.
    PERFORM http((
        'POST',
        api_url,
        ARRAY[('Authorization', 'Bearer ' || api_secret), ('Content-Type', 'application/json')],
        jsonb_build_object(
            'event_id', NEW.id,
            'rental_id', NEW.rental_id,
            'event_type', NEW.type,
            'created_by', NEW.created_by,
            'payload', NEW.payload
        )::text
    ));

    RETURN NEW;
END;
$$;

-- Step 5: Create the trigger on the 'events' table
DROP TRIGGER IF EXISTS on_new_rental_event ON public.events;
CREATE TRIGGER on_new_rental_event
AFTER INSERT ON public.events
FOR EACH ROW
EXECUTE FUNCTION public.handle_new_rental_event();

-- Step 6: Update rentals.metadata to store event_ids instead of a full log
-- This is a conceptual change. Old data will remain, new logic should use the events table.
-- We can add a function later to migrate old logs if needed.
COMMENT ON COLUMN public.rentals.metadata IS 'Holds rental-specific metadata. Event history is now in the events table.';
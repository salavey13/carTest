-- This migration creates a trigger to automatically update the rental status
-- based on events being inserted into the 'events' table.

CREATE OR REPLACE FUNCTION public.update_rental_status_from_event()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- When a 'pickup_confirmed' event is inserted, the rental becomes 'active'.
    IF NEW.type = 'pickup_confirmed' THEN
        UPDATE public.rentals
        SET status = 'active', updated_at = now()
        WHERE rental_id = NEW.rental_id;
    
    -- When a 'return_confirmed' event is inserted, the rental is 'completed'.
    ELSIF NEW.type = 'return_confirmed' THEN
        UPDATE public.rentals
        SET status = 'completed', updated_at = now()
        WHERE rental_id = NEW.rental_id;

    -- When a 'rental_cancelled' event is inserted, the rental is 'cancelled'.
    ELSIF NEW.type = 'rental_cancelled' THEN
        UPDATE public.rentals
        SET status = 'cancelled', updated_at = now()
        WHERE rental_id = NEW.rental_id;
    END IF;

    RETURN NEW;
END;
$$;

-- Drop the trigger if it already exists to ensure a clean setup
DROP TRIGGER IF EXISTS on_new_status_changing_event ON public.events;

-- Create the trigger that executes the function after a new event is inserted.
CREATE TRIGGER on_new_status_changing_event
AFTER INSERT ON public.events
FOR EACH ROW
EXECUTE FUNCTION public.update_rental_status_from_event();

COMMENT ON FUNCTION public.update_rental_status_from_event IS 'Updates the status in the rentals table based on specific event types being inserted into the events table.';
COMMENT ON TRIGGER on_new_status_changing_event ON public.events IS 'Fires after an event is inserted to potentially update the corresponding rental status.';
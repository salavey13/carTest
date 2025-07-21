-- Add a new 'hq_location' column to store crew headquarters coordinates.
ALTER TABLE public.crews
ADD COLUMN hq_location TEXT;

COMMENT ON COLUMN public.crews.hq_location IS 'Headquarters location as a "latitude,longitude" string.';

-- Update the existing crew with a demo location (e.g., somewhere in the city center)
-- Find your crew_id from the crews table. This is an example UUID.
UPDATE public.crews
SET hq_location = '56.3269,44.0059' -- Example: NN Main Square coordinates
WHERE name = 'SLY13'; -- Replace with the actual name of the main crew
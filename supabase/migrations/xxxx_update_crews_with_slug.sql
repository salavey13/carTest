-- Add a new 'slug' column to the 'crews' table.
-- It will store a URL-friendly, unique version of the crew's name.
ALTER TABLE public.crews
ADD COLUMN slug TEXT UNIQUE;

-- Add a comment for clarity on the new column's purpose.
COMMENT ON COLUMN public.crews.slug IS 'URL-friendly, unique identifier for the crew, derived from its name.';

-- Create an index on the new 'slug' column for faster lookups.
CREATE INDEX IF NOT EXISTS idx_crews_slug ON public.crews(slug);

-- (Optional) Backfill existing rows with a generated slug.
-- This part is for existing data. New entries will handle this in the application logic.
-- Note: This is a one-time operation. The application should handle slug generation for new crews.
UPDATE public.crews
SET slug = lower(regexp_replace(name, '\s+', '-', 'g'))
WHERE slug IS NULL;

-- After backfilling, it's a good idea to make the column non-nullable
-- if all crews are expected to have a slug.
-- ALTER TABLE public.crews ALTER COLUMN slug SET NOT NULL;
-- (Leaving this commented out to avoid breaking changes if run multiple times,
-- but it's a good practice for new setups).
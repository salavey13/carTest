-- Friend review intake for completed franchize rentals.
CREATE TABLE IF NOT EXISTS public.rental_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rental_id uuid NOT NULL REFERENCES public.rentals(rental_id) ON DELETE CASCADE,
  user_id text NOT NULL REFERENCES public.users(user_id) ON DELETE CASCADE,
  bike_id text NOT NULL REFERENCES public.cars(id) ON DELETE CASCADE,
  crew_id uuid NOT NULL REFERENCES public.crews(id) ON DELETE CASCADE,
  rating integer NOT NULL CHECK (rating BETWEEN 1 AND 5),
  text text NOT NULL DEFAULT '',
  hidden_at timestamptz,
  moderated_by text REFERENCES public.users(user_id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (rental_id)
);

CREATE INDEX IF NOT EXISTS idx_rental_reviews_bike_visible
  ON public.rental_reviews (bike_id, created_at DESC)
  WHERE hidden_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_rental_reviews_crew_visible
  ON public.rental_reviews (crew_id, created_at DESC)
  WHERE hidden_at IS NULL;

ALTER TABLE public.rental_reviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can read visible rental reviews"
ON public.rental_reviews
FOR SELECT
USING (hidden_at IS NULL);

CREATE POLICY "Renters can insert own completed rental review"
ON public.rental_reviews
FOR INSERT
WITH CHECK (
  auth.jwt() ->> 'chat_id' = user_id
  AND EXISTS (
    SELECT 1
    FROM public.rentals r
    WHERE r.rental_id = rental_reviews.rental_id
      AND r.user_id = rental_reviews.user_id
      AND r.vehicle_id = rental_reviews.bike_id
      AND r.status = 'completed'
  )
);

CREATE POLICY "Renters can update own visible rental review"
ON public.rental_reviews
FOR UPDATE
USING (auth.jwt() ->> 'chat_id' = user_id AND hidden_at IS NULL)
WITH CHECK (auth.jwt() ->> 'chat_id' = user_id);

CREATE OR REPLACE FUNCTION public.touch_rental_reviews_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS rental_reviews_touch_updated_at ON public.rental_reviews;
CREATE TRIGGER rental_reviews_touch_updated_at
BEFORE UPDATE ON public.rental_reviews
FOR EACH ROW
EXECUTE FUNCTION public.touch_rental_reviews_updated_at();

COMMENT ON TABLE public.rental_reviews IS 'Friend reviews for completed rentals; hidden_at is a soft moderation delete.';

CREATE TABLE public.maps (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    map_image_url TEXT NOT NULL,
    bounds JSONB NOT NULL,
    points_of_interest JSONB DEFAULT '[]'::jsonb,
    is_default BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT now(),
    owner_id TEXT REFERENCES public.users(user_id) ON DELETE SET NULL
);

COMMENT ON TABLE public.maps IS 'Stores map presets including image, boundaries, and points of interest.';
COMMENT ON COLUMN public.maps.bounds IS 'Stores the geographical boundaries {top, bottom, left, right} of the map image.';
COMMENT ON COLUMN public.maps.points_of_interest IS 'Stores an array of custom points like race tracks, potholes, etc.';
COMMENT ON COLUMN public.maps.is_default IS 'If true, this map is loaded by default.';

-- Enable RLS
ALTER TABLE public.maps ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Public can read map presets"
ON public.maps FOR SELECT
USING (true);

CREATE POLICY "Admins can manage map presets"
ON public.maps FOR ALL
USING (
    (SELECT role FROM public.users WHERE user_id = auth.jwt() ->> 'chat_id') IN ('admin', 'vprAdmin')
)
WITH CHECK (
    (SELECT role FROM public.users WHERE user_id = auth.jwt() ->> 'chat_id') IN ('admin', 'vprAdmin')
);

-- Ensure only one map can be default
CREATE UNIQUE INDEX one_default_map_idx ON public.maps (is_default) WHERE (is_default = TRUE);
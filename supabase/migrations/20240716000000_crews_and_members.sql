-- Create the 'crews' table
CREATE TABLE public.crews (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    description TEXT,
    logo_url TEXT,
    owner_id TEXT NOT NULL REFERENCES public.users(user_id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Add comments to the 'crews' table
COMMENT ON TABLE public.crews IS 'Stores information about vehicle owner crews or teams.';
COMMENT ON COLUMN public.crews.id IS 'Unique identifier for the crew.';
COMMENT ON COLUMN public.crews.name IS 'The public name of the crew.';
COMMENT ON COLUMN public.crews.owner_id IS 'The user who created and owns the crew.';


-- Create the 'crew_members' table
CREATE TABLE public.crew_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    crew_id UUID NOT NULL REFERENCES public.crews(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL REFERENCES public.users(user_id) ON DELETE CASCADE,
    role TEXT NOT NULL DEFAULT 'member', -- e.g., 'member', 'co_owner', 'mechanic'
    joined_at TIMESTAMPTZ DEFAULT now(),
    CONSTRAINT unique_user_per_crew UNIQUE (crew_id, user_id)
);

-- Add comments to the 'crew_members' table
COMMENT ON TABLE public.crew_members IS 'Associates users with crews, defining their role within the crew.';
COMMENT ON COLUMN public.crew_members.role IS 'The role of the user within the crew.';


-- Add a 'crew_id' column to the 'cars' table
ALTER TABLE public.cars
ADD COLUMN crew_id UUID REFERENCES public.crews(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.cars.crew_id IS 'The crew this vehicle belongs to.';

-- Create indexes for performance
CREATE INDEX idx_crews_owner_id ON public.crews(owner_id);
CREATE INDEX idx_crew_members_crew_id ON public.crew_members(crew_id);
CREATE INDEX idx_crew_members_user_id ON public.crew_members(user_id);
CREATE INDEX idx_cars_crew_id ON public.cars(crew_id);


-- Enable Row-Level Security (RLS)
ALTER TABLE public.crews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crew_members ENABLE ROW LEVEL SECURITY;

-- RLS Policies for 'crews' table
CREATE POLICY "Public can read crews"
ON public.crews FOR SELECT
USING (true);

CREATE POLICY "Owners can manage their own crews"
ON public.crews FOR ALL
USING (auth.jwt() ->> 'sub' = owner_id)
WITH CHECK (auth.jwt() ->> 'sub' = owner_id);


-- RLS Policies for 'crew_members' table
CREATE POLICY "Public can read crew memberships"
ON public.crew_members FOR SELECT
USING (true);

CREATE POLICY "Crew owners can manage their crew members"
ON public.crew_members FOR ALL
USING (
    (SELECT owner_id FROM public.crews WHERE id = crew_id) = auth.jwt() ->> 'sub'
);

CREATE POLICY "Users can leave crews"
ON public.crew_members FOR DELETE
USING (user_id = auth.jwt() ->> 'sub');
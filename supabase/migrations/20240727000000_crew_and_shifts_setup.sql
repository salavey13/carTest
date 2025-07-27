-- Run this code in your Supabase SQL Editor

-- Create the 'crews' table
CREATE TABLE IF NOT EXISTS public.crews (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    slug TEXT NOT NULL UNIQUE,
    description TEXT,
    logo_url TEXT,
    hq_location TEXT,
    owner_id TEXT NOT NULL REFERENCES public.users(user_id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create the 'crew_members' table
CREATE TABLE IF NOT EXISTS public.crew_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    crew_id UUID NOT NULL REFERENCES public.crews(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL REFERENCES public.users(user_id) ON DELETE CASCADE,
    role TEXT NOT NULL DEFAULT 'member',
    joined_at TIMESTAMPTZ DEFAULT now(),
    CONSTRAINT unique_user_per_crew UNIQUE (crew_id, user_id)
);

-- Add a 'crew_id' column to the 'cars' table if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS(SELECT * FROM information_schema.columns WHERE table_name='cars' and column_name='crew_id') THEN
    ALTER TABLE public.cars ADD COLUMN crew_id UUID REFERENCES public.crews(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Create the NEW 'crew_member_shifts' table
CREATE TABLE IF NOT EXISTS public.crew_member_shifts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    member_id TEXT NOT NULL REFERENCES public.users(user_id) ON DELETE CASCADE,
    crew_id UUID NOT NULL REFERENCES public.crews(id) ON DELETE CASCADE,
    clock_in_time TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    clock_out_time TIMESTAMPTZ,
    duration_minutes INT GENERATED ALWAYS AS (
        CASE 
            WHEN clock_out_time IS NOT NULL THEN 
                EXTRACT(EPOCH FROM (clock_out_time - clock_in_time)) / 60
            ELSE NULL 
        END
    ) STORED
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_crews_owner_id ON public.crews(owner_id);
CREATE INDEX IF NOT EXISTS idx_crew_members_crew_id ON public.crew_members(crew_id);
CREATE INDEX IF NOT EXISTS idx_crew_members_user_id ON public.crew_members(user_id);
CREATE INDEX IF NOT EXISTS idx_cars_crew_id ON public.cars(crew_id);
CREATE INDEX IF NOT EXISTS idx_crew_member_shifts_member_id ON public.crew_member_shifts(member_id);
CREATE INDEX IF NOT EXISTS idx_crew_member_shifts_crew_id ON public.crew_member_shifts(crew_id);

-- Enable Row-Level Security (RLS)
ALTER TABLE public.crews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crew_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crew_member_shifts ENABLE ROW LEVEL SECURITY;

-- RLS Policies for 'crews' table
DROP POLICY IF EXISTS "Public can read crews" ON public.crews;
CREATE POLICY "Public can read crews" ON public.crews FOR SELECT USING (true);

DROP POLICY IF EXISTS "Owners can manage their own crews" ON public.crews;
CREATE POLICY "Owners can manage their own crews" ON public.crews FOR ALL
USING (auth.jwt() ->> 'chat_id' = owner_id) WITH CHECK ( auth.jwt() ->> 'chat_id' = owner_id);

-- RLS Policies for 'crew_members' table
DROP POLICY IF EXISTS "Public can read crew memberships" ON public.crew_members;
CREATE POLICY "Public can read crew memberships" ON public.crew_members FOR SELECT USING (true);

DROP POLICY IF EXISTS "Crew owners can manage their crew members" ON public.crew_members;
CREATE POLICY "Crew owners can manage their crew members" ON public.crew_members FOR ALL
USING ((SELECT owner_id FROM public.crews WHERE id = crew_id) = auth.jwt() ->> 'chat_id');

DROP POLICY IF EXISTS "Users can leave crews" ON public.crew_members;
CREATE POLICY "Users can leave crews" ON public.crew_members FOR DELETE
USING (user_id = auth.jwt() ->> 'chat_id');

-- RLS Policies for 'crew_member_shifts' table
DROP POLICY IF EXISTS "Allow members to manage their own shifts" ON public.crew_member_shifts;
CREATE POLICY "Allow members to manage their own shifts" ON public.crew_member_shifts FOR ALL
USING ( auth.jwt() ->> 'chat_id' = member_id) WITH CHECK (auth.jwt() ->> 'chat_id' = member_id);

DROP POLICY IF EXISTS "Allow crew owners to view their crew's shifts" ON public.crew_member_shifts;
CREATE POLICY "Allow crew owners to view their crew's shifts" ON public.crew_member_shifts FOR SELECT
USING (EXISTS (SELECT 1 FROM public.crews WHERE public.crews.id = crew_member_shifts.crew_id AND public.crews.owner_id = auth.jwt() ->> 'chat_id'));
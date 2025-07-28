-- Run this in your Supabase SQL Editor

-- Add status to crew_members for invite system
ALTER TABLE public.crew_members
ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'pending';

-- Add shift_type to crew_member_shifts
ALTER TABLE public.crew_member_shifts
ADD COLUMN IF NOT EXISTS shift_type TEXT NOT NULL DEFAULT 'online';

-- Add location to crew_members for live tracking
ALTER TABLE public.crew_members
ADD COLUMN IF NOT EXISTS last_location GEOGRAPHY(Point, 4326);

-- Update RLS policies to handle new statuses
DROP POLICY IF EXISTS "Crew owners can manage their crew members" ON public.crew_members;
CREATE POLICY "Crew owners can manage their crew members" ON public.crew_members
FOR ALL
USING (
  (SELECT owner_id FROM public.crews WHERE id = crew_id) = (auth.jwt() ->> 'chat_id')
);

DROP POLICY IF EXISTS "Users can manage their own pending membership" ON public.crew_members;
CREATE POLICY "Users can manage their own pending membership" ON public.crew_members
FOR ALL
USING (
  user_id = (auth.jwt() ->> 'chat_id')
);

-- Index for location
CREATE INDEX IF NOT EXISTS crew_members_location_idx ON public.crew_members USING GIST (last_location);
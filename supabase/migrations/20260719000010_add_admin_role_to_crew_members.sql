-- Add 'admin' as a recognized role in crew_members.
-- The role column already exists as free-text; this migration adds a
-- check constraint and updates the column comment for discoverability.

ALTER TABLE public.crew_members
DROP CONSTRAINT IF EXISTS crew_members_role_check;

ALTER TABLE public.crew_members
ADD CONSTRAINT crew_members_role_check
CHECK (role IN ('member', 'admin', 'co_owner', 'mechanic'));

COMMENT ON COLUMN public.crew_members.role IS 'The role of the user within the crew: member, admin, co_owner, mechanic';

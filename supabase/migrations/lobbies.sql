CREATE TABLE public.lobbies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  owner_id text NOT NULL,
  mode text,
  max_players integer,
  field_id text,
  start_at timestamptz,
  status text DEFAULT 'open',
  is_public boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

-- Fix Lobbies Table (Add missing column)
ALTER TABLE public.lobbies 
ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;

-- Fix: Add missing qr_code_hash column to lobbies
ALTER TABLE public.lobbies 
ADD COLUMN IF NOT EXISTS qr_code_hash text;


-- lobby_members
CREATE TABLE public.lobby_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lobby_id uuid REFERENCES public.lobbies(id) ON DELETE CASCADE,
  user_id text NOT NULL,
  role text,
  joined_at timestamptz DEFAULT now()
);

-- Add missing columns to lobby_members
ALTER TABLE public.lobby_members 
ADD COLUMN IF NOT EXISTS team text DEFAULT 'spectator',
ADD COLUMN IF NOT EXISTS status text DEFAULT 'ready',
ADD COLUMN IF NOT EXISTS is_bot boolean DEFAULT false;

-- Optional: Create an index for faster team lookups
CREATE INDEX IF NOT EXISTS idx_lobby_members_team ON public.lobby_members(lobby_id, team);

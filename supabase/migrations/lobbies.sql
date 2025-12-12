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

-- lobby_members
CREATE TABLE public.lobby_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lobby_id uuid REFERENCES public.lobbies(id) ON DELETE CASCADE,
  user_id text NOT NULL,
  role text,
  joined_at timestamptz DEFAULT now()
);
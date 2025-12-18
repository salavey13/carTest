-- Table for Capture Points (Flags)
CREATE TABLE public.lobby_checkpoints (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lobby_id uuid REFERENCES public.lobbies(id) ON DELETE CASCADE,
  name text NOT NULL, -- e.g. "Alpha", "Bravo", "Base"
  owner_team text DEFAULT 'neutral', -- 'neutral', 'red', 'blue'
  captured_at timestamptz,
  captured_by text, -- user_id of the hero
  created_at timestamptz DEFAULT now()
);

-- Index for realtime lookups
CREATE INDEX idx_checkpoints_lobby ON public.lobby_checkpoints(lobby_id);
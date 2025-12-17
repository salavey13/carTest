-- Tournaments Table
CREATE TABLE public.tournaments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  status text DEFAULT 'draft', -- draft, active, completed
  format text DEFAULT 'single_elimination',
  created_by text NOT NULL, -- user_id
  created_at timestamptz DEFAULT now(),
  metadata jsonb DEFAULT '{}'::jsonb
);

-- Tournament Matches (The Bracket)
CREATE TABLE public.tournament_matches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id uuid REFERENCES public.tournaments(id) ON DELETE CASCADE,
  lobby_id uuid REFERENCES public.lobbies(id), -- The actual game
  round integer NOT NULL, -- 1 = Final, 2 = Semi, 3 = Quarter
  match_order integer NOT NULL, -- 0, 1, 2... (vertical position)
  next_match_id uuid, -- Where the winner goes
  crew1_id uuid REFERENCES public.crews(id),
  crew2_id uuid REFERENCES public.crews(id),
  winner_crew_id uuid REFERENCES public.crews(id),
  status text DEFAULT 'pending' -- pending, active, completed
);
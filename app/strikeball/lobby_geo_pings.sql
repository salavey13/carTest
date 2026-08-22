-- Migration for Drink Royale
CREATE TABLE IF NOT EXISTS public.lobby_geo_pings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lobby_id UUID REFERENCES public.lobbies(id) ON DELETE CASCADE,
  user_id TEXT REFERENCES public.users(user_id) ON DELETE CASCADE,
  coords GEOGRAPHY(POINT), -- PostGIS for radius calculations
  lat FLOAT NOT NULL,
  lng FLOAT NOT NULL,
  timestamp TIMESTAMPTZ DEFAULT now()
);

-- Index for fast proximity lookups
CREATE INDEX idx_geo_pings_lobby_user ON lobby_geo_pings(lobby_id, user_id);
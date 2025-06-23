CREATE TABLE notified_opportunities (
  id bigint primary key generated always as identity,
  user_id text NOT NULL,
  opportunity_signature text NOT NULL,  -- A unique signature for an opportunity, e.g., "BTC/USDT:binance->bybit"
  last_notified_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  cooldown_expires_at TIMESTAMPTZ NOT NULL,
  CONSTRAINT fk_user FOREIGN KEY (user_id) REFERENCES public.users(user_id) ON DELETE CASCADE
);

-- Enable Row Level Security
ALTER TABLE notified_opportunities ENABLE ROW LEVEL SECURITY;

-- Create a unique index for fast lookups and to prevent duplicate entries
CREATE UNIQUE INDEX idx_user_opportunity_signature ON notified_opportunities(user_id, opportunity_signature);

-- Grant access to the service_role key used by edge functions
GRANT SELECT, INSERT, UPDATE, DELETE ON notified_opportunities TO service_role;

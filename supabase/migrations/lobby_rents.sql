-- Create Purchases/Inventory Ledger
CREATE TABLE public.user_purchases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL,
  item_id text NOT NULL, -- Links to 'cars' table id (e.g. 'gear-gun-01')
  quantity integer DEFAULT 1,
  total_price integer NOT NULL,
  status text DEFAULT 'paid', -- 'paid', 'collected', 'returned'
  created_at timestamptz DEFAULT now(),
  metadata jsonb DEFAULT '{}'::jsonb
);

-- Index for fast profile lookups
CREATE INDEX idx_purchases_user ON public.user_purchases(user_id);
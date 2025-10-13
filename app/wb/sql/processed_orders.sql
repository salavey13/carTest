-- processed_orders (dedup)
CREATE TABLE IF NOT EXISTS processed_orders (
  order_id TEXT NOT NULL,
  platform TEXT NOT NULL CHECK (platform IN ('wb', 'ozon', 'ym')),
  items JSONB,
  processed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (order_id, platform)
);
CREATE INDEX IF NOT EXISTS idx_order_id ON processed_orders (order_id);

-- config (lastPollTs)
CREATE TABLE IF NOT EXISTS config (
  key TEXT PRIMARY KEY,
  value TEXT
);

-- salary_calc (daily decreased per item/platform)
CREATE TABLE IF NOT EXISTS salary_calc (
  date DATE NOT NULL,
  platform TEXT NOT NULL CHECK (platform IN ('wb', 'ozon', 'ym')),
  item_id TEXT NOT NULL,
  decreased_qty INTEGER DEFAULT 0,
  PRIMARY KEY (date, platform, item_id)
);
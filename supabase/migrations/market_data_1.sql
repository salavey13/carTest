CREATE TABLE market_data (
  id SERIAL PRIMARY KEY,
  exchange VARCHAR(20) NOT NULL,            -- 'binance' | 'bybit'
  symbol VARCHAR(20) NOT NULL,              -- e.g. 'BTCUSDT'
  bid_price NUMERIC(20, 10) NOT NULL,
  ask_price NUMERIC(20, 10) NOT NULL,
  last_price NUMERIC(20, 10) NOT NULL,
  volume NUMERIC(30, 10) NOT NULL,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- For querying efficiency
  UNIQUE (exchange, symbol, timestamp)
);

-- Create index for faster queries when analyzing data
CREATE INDEX idx_market_data_exchange_symbol ON market_data(exchange, symbol);
CREATE INDEX idx_market_data_timestamp ON market_data(timestamp);

-- Optional view for arbitrage opportunities
CREATE OR REPLACE VIEW arbitrage_opportunities AS
WITH latest_prices AS (
  SELECT DISTINCT ON (exchange, symbol) 
    exchange, 
    symbol, 
    bid_price, 
    ask_price,
    timestamp
  FROM market_data
  ORDER BY exchange, symbol, timestamp DESC
)
SELECT 
  a.symbol,
  a.exchange as exchange_a,
  b.exchange as exchange_b,
  a.bid_price as bid_price_a,
  b.bid_price as bid_price_b,
  a.ask_price as ask_price_a,
  b.ask_price as ask_price_b,
  -- Formula: (Sell Price on B - Buy Price on A) / Buy Price on A
  ((b.bid_price - a.ask_price) / a.ask_price) * 100 as potential_profit_pct_a_to_b,
  ((a.bid_price - b.ask_price) / b.ask_price) * 100 as potential_profit_pct_b_to_a,
  a.timestamp as timestamp_a,
  b.timestamp as timestamp_b
FROM latest_prices a
JOIN latest_prices b ON a.symbol = b.symbol AND a.exchange != b.exchange
WHERE (a.bid_price - b.ask_price) > 0 OR (b.bid_price - a.ask_price) > 0;
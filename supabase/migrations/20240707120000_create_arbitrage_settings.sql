CREATE TABLE public.arbitrage_user_settings (
    user_id TEXT NOT NULL REFERENCES public.users(user_id) ON DELETE CASCADE,
    settings JSONB NOT NULL,
    last_updated TIMESTAMPTZ DEFAULT now() NOT NULL,
    PRIMARY KEY (user_id)
);

ALTER TABLE public.arbitrage_user_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow user to manage their own arbitrage settings"
ON public.arbitrage_user_settings
FOR ALL
USING (auth.jwt() ->> 'chat_id' = user_id)
WITH CHECK (auth.jwt() ->> 'chat_id'  = user_id);

COMMENT ON TABLE public.arbitrage_user_settings IS 'Stores user-specific settings for the Arbitrage Alpha Seeker.';
COMMENT ON COLUMN public.arbitrage_user_settings.settings IS 'JSONB object containing all arbitrage scanner preferences.';

INSERT INTO public.arbitrage_user_settings (user_id, settings)
SELECT user_id, 
  '{
      "minSpreadPercent": 0.5,
      "enabledExchanges": ["Binance", "Bybit", "KuCoin"],
      "trackedPairs": ["BTC/USDT", "ETH/USDT", "SOL/USDT", "ETH/BTC"],
      "defaultTradeVolumeUSD": 1000,
      "exchangeFees": {
        "Binance": {"maker": 0.001, "taker": 0.001}, 
        "Bybit": {"maker": 0.001, "taker": 0.001}, 
        "KuCoin": {"maker": 0.001, "taker": 0.001},
        "Gate.io": {"maker": 0.001, "taker": 0.001}, 
        "OKX": {"maker": 0.001, "taker": 0.001},
        "SimulatedExchangeA": {"maker": 0.001, "taker": 0.001},
        "SimulatedExchangeB": {"maker": 0.001, "taker": 0.001}
      },
      "networkFees": {
        "BTC": 5, "ETH": 2, "SOL": 0.1, "USDT_ERC20": 3, "USDT_TRC20": 1
      }
    }'::jsonb
FROM public.users
ON CONFLICT (user_id) DO NOTHING;

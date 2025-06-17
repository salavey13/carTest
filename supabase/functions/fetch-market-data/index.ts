import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const log = (message: string, data?: any) => console.log(`[fetch-market-data] ${new Date().toISOString()}: ${message}`, data || '');

// Define the data structure for type safety
interface MarketData {
  exchange: string;
  symbol: string;
  bid_price: number;
  ask_price: number;
  last_price: number;
  volume: number;
  timestamp: string;
}

const SYMBOLS_TO_MONITOR = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT'];

// --- Data Fetching Functions for Deno Runtime ---
async function fetchBinanceData(): Promise<MarketData[]> {
    const results: MarketData[] = [];
    for (const symbol of SYMBOLS_TO_MONITOR) {
        try {
            const [tickerRes, volumeRes] = await Promise.all([
                fetch(`https://api.binance.com/api/v3/ticker/bookTicker?symbol=${symbol}`).then(res => res.json()),
                fetch(`https://api.binance.com/api/v3/ticker/24hr?symbol=${symbol}`).then(res => res.json())
            ]);

            if (tickerRes.code || volumeRes.code) {
                log(`Binance API error for ${symbol}`, { tickerRes, volumeRes });
                continue;
            }

            results.push({
                exchange: 'binance',
                symbol,
                bid_price: parseFloat(tickerRes.bidPrice),
                ask_price: parseFloat(tickerRes.askPrice),
                last_price: parseFloat(volumeRes.lastPrice),
                volume: parseFloat(volumeRes.volume),
                timestamp: new Date().toISOString()
            });
        } catch (e) {
            log(`Failed to fetch Binance data for ${symbol}`, e.message);
        }
    }
    return results;
}

async function fetchBybitData(): Promise<MarketData[]> {
    const results: MarketData[] = [];
    for (const symbol of SYMBOLS_TO_MONITOR) {
        try {
            const response = await fetch(`https://api.bybit.com/v5/market/tickers?category=spot&symbol=${symbol}`);
            const data = await response.json();
            const ticker = data?.result?.list?.[0];

            if (ticker) {
                results.push({
                    exchange: 'bybit',
                    symbol,
                    bid_price: parseFloat(ticker.bid1Price),
                    ask_price: parseFloat(ticker.ask1Price),
                    last_price: parseFloat(ticker.lastPrice),
                    volume: parseFloat(ticker.volume24h),
                    timestamp: new Date().toISOString()
                });
            }
        } catch (e) {
            log(`Failed to fetch Bybit data for ${symbol}`, e.message);
        }
    }
    return results;
}


// --- Main Server Logic ---
serve(async (req) => {
  // 1. --- Authorization Check ---
  const CRON_SECRET = Deno.env.get('CRON_SECRET');
  const authHeader = req.headers.get('Authorization');
  if (authHeader !== `Bearer ${CRON_SECRET}`) {
    log('Unauthorized attempt to trigger function.');
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { 'Content-Type': 'application/json' } });
  }

  log('Function invoked securely.');
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey);

    // 2. --- Fetch Data ---
    log("Starting data fetch from exchanges...");
    const [binanceData, bybitData] = await Promise.all([fetchBinanceData(), fetchBybitData()]);
    const allMarketData = [...binanceData, ...bybitData];
    log(`Fetched ${allMarketData.length} total records.`);

    if (allMarketData.length === 0) {
      return new Response(JSON.stringify({ success: true, message: 'No data fetched, nothing to insert.' }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }

    // 3. --- Insert Data ---
    const { error } = await supabaseAdmin.from('market_data').insert(allMarketData);
    if (error) {
        log('Supabase insert error:', error);
        throw error;
    }

    log("Data successfully inserted into Supabase.");
    return new Response(JSON.stringify({ success: true, count: allMarketData.length }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  } catch (error) {
    log('Critical error in edge function:', error.message);
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
});
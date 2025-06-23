import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'npm:@supabase/supabase-js@2';

const log = (message: string, data?: any) => console.log(`[fetch-market-data] ${new Date().toISOString()}: ${message}`, data || '');

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

// --- Hardened Data Fetching Functions ---
async function fetchBinanceData(): Promise<MarketData[]> {
    const results: MarketData[] = [];
    for (const symbol of SYMBOLS_TO_MONITOR) {
        try {
            const [tickerRes, volumeRes] = await Promise.all([
                fetch(`https://api.binance.com/api/v3/ticker/bookTicker?symbol=${symbol}`).then(res => res.json()),
                fetch(`https://api.binance.com/api/v3/ticker/24hr?symbol=${symbol}`).then(res => res.json())
            ]);

            if (tickerRes.code || volumeRes.code || !tickerRes.bidPrice || !tickerRes.askPrice || !volumeRes.lastPrice || !volumeRes.volume) {
                log(`Binance API error or incomplete data for ${symbol}`, { tickerRes, volumeRes });
                continue;
            }

            // --- DATA VALIDATION ---
            const bid_price = parseFloat(tickerRes.bidPrice);
            const ask_price = parseFloat(tickerRes.askPrice);
            const last_price = parseFloat(volumeRes.lastPrice);
            const volume = parseFloat(volumeRes.volume);

            if (isNaN(bid_price) || isNaN(ask_price) || isNaN(last_price) || isNaN(volume)) {
                log(`Binance data validation failed (NaN) for ${symbol}`, { tickerRes, volumeRes });
                continue;
            }

            results.push({
                exchange: 'binance',
                symbol,
                bid_price,
                ask_price,
                last_price,
                volume,
                timestamp: new Date().toISOString()
            });
        } catch (e) {
            log(`Failed to fetch or parse Binance data for ${symbol}`, e.message);
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

            if (ticker && ticker.bid1Price && ticker.ask1Price && ticker.lastPrice && ticker.volume24h) {
                // --- DATA VALIDATION ---
                const bid_price = parseFloat(ticker.bid1Price);
                const ask_price = parseFloat(ticker.ask1Price);
                const last_price = parseFloat(ticker.lastPrice);
                const volume = parseFloat(ticker.volume24h);

                if (isNaN(bid_price) || isNaN(ask_price) || isNaN(last_price) || isNaN(volume)) {
                    log(`Bybit data validation failed (NaN) for ${symbol}`, { ticker });
                    continue;
                }

                results.push({
                    exchange: 'bybit',
                    symbol,
                    bid_price,
                    ask_price,
                    last_price,
                    volume,
                    timestamp: new Date().toISOString()
                });
            } else {
                 log(`Bybit API error or incomplete data for ${symbol}`, { ticker });
            }
        } catch (e) {
            log(`Failed to fetch or parse Bybit data for ${symbol}`, e.message);
        }
    }
    return results;
}

// --- Main Server Logic (Auth part is now correct) ---
Deno.serve(async (req: Request) => {
  const CUSTOM_AUTH_SECRET = Deno.env.get('CRON_SECRET')!;
  const receivedSecret = req.headers.get('X-Vibe-Auth-Secret');

  if (receivedSecret !== CUSTOM_AUTH_SECRET) {
    log('Unauthorized: Missing or incorrect X-Vibe-Auth-Secret header.');
    return new Response(JSON.stringify({ error: 'Unauthorized: Invalid secret.' }), { status: 401, headers: { 'Content-Type': 'application/json' } });
  }

  log('Function invoked securely.');
  
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey);

    log("Starting data fetch from exchanges...");
    const [binanceData, bybitData] = await Promise.all([fetchBinanceData(), fetchBybitData()]);
    const allMarketData = [...binanceData, ...bybitData];
    log(`Fetched ${allMarketData.length} total valid records.`);

    if (allMarketData.length === 0) {
      return new Response(JSON.stringify({ success: true, message: 'No valid data fetched, nothing to insert.' }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }

    const { error } = await supabaseAdmin.from('market_data').insert(allMarketData);
    if (error) {
        log('Supabase insert error:', error);
        throw error;
    }

    log("Data successfully inserted into Supabase.");
    return new Response(JSON.stringify({ success: true, count: allMarketData.length }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  } catch (error) {
    log('Critical error in edge function:', error.message);
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
});
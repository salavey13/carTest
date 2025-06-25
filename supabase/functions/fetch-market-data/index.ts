import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'npm:@supabase/supabase-js@2';
import { HmacSha256 } from 'https://deno.land/std@0.168.0/hash/sha256.ts';

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

// --- Authenticated Data Fetching Functions ---

async function fetchBinanceData(apiKey: string, apiSecret: string): Promise<{data: MarketData[], errors: string[]}> {
    const results: MarketData[] = [];
    const errors: string[] = [];
    for (const symbol of SYMBOLS_TO_MONITOR) {
        try {
            // Public endpoints on Binance often work with just the API key in the header for higher rate limits.
            // No signature is needed for these specific public ticker endpoints.
            const [tickerRes, volumeRes] = await Promise.all([
                fetch(`https://api.binance.com/api/v3/ticker/bookTicker?symbol=${symbol}`, { headers: { 'X-MBX-APIKEY': apiKey } }).then(res => res.json()),
                fetch(`https://api.binance.com/api/v3/ticker/24hr?symbol=${symbol}`, { headers: { 'X-MBX-APIKEY': apiKey } }).then(res => res.json())
            ]);

            if (tickerRes.code || volumeRes.code) {
                const errorMsg = `Binance API error for ${symbol}: ${tickerRes.msg || volumeRes.msg || 'Incomplete data'}`;
                log(errorMsg, { tickerRes, volumeRes });
                errors.push(errorMsg);
                continue;
            }

            const bid_price = parseFloat(tickerRes.bidPrice);
            const ask_price = parseFloat(tickerRes.askPrice);
            const last_price = parseFloat(volumeRes.lastPrice);
            const volume = parseFloat(volumeRes.volume);

            if (isNaN(bid_price) || isNaN(ask_price) || isNaN(last_price) || isNaN(volume)) {
                 const errorMsg = `Binance data validation failed (NaN) for ${symbol}`;
                 log(errorMsg, { tickerRes, volumeRes });
                 errors.push(errorMsg);
                continue;
            }

            results.push({
                exchange: 'binance', symbol, bid_price, ask_price, last_price, volume, timestamp: new Date().toISOString()
            });
        } catch (e) {
            const errorMsg = `Failed to fetch/parse Binance data for ${symbol}: ${e.message}`;
            log(errorMsg);
            errors.push(errorMsg);
        }
    }
    return { data: results, errors };
}

async function fetchBybitData(apiKey: string, apiSecret: string): Promise<{data: MarketData[], errors: string[]}> {
    const results: MarketData[] = [];
    const errors: string[] = [];
    const host = "https://api.bybit.com";

    for (const symbol of SYMBOLS_TO_MONITOR) {
        try {
            const timestamp = Date.now().toString();
            const recvWindow = "5000";
            const path = "/v5/market/tickers";
            const queryString = `category=spot&symbol=${symbol}`;
            
            // Signature generation for Bybit
            const toSign = timestamp + apiKey + recvWindow + queryString;
            const signature = new HmacSha256(apiSecret).update(toSign).hex();

            const response = await fetch(`${host}${path}?${queryString}`, {
                headers: {
                    'X-BAPI-API-KEY': apiKey,
                    'X-BAPI-TIMESTAMP': timestamp,
                    'X-BAPI-RECV-WINDOW': recvWindow,
                    'X-BAPI-SIGN': signature
                }
            });
            
            if (!response.ok) {
                const errorBody = await response.text();
                throw new Error(`Bybit API returned non-OK status: ${response.status}. Body: ${errorBody}`);
            }

            const data = await response.json();
            const ticker = data?.result?.list?.[0];

            if (data.retCode !== 0) {
                 const errorMsg = `Bybit API returned error for ${symbol}: ${data.retMsg}`;
                 log(errorMsg, { responseData: data });
                 errors.push(errorMsg);
                 continue;
            }

            if (ticker && ticker.bid1Price && ticker.ask1Price && ticker.lastPrice && ticker.volume24h) {
                const bid_price = parseFloat(ticker.bid1Price);
                const ask_price = parseFloat(ticker.ask1Price);
                const last_price = parseFloat(ticker.lastPrice);
                const volume = parseFloat(ticker.volume24h);

                if (isNaN(bid_price) || isNaN(ask_price) || isNaN(last_price) || isNaN(volume)) {
                    const errorMsg = `Bybit data validation failed (NaN) for ${symbol}`;
                    log(errorMsg, { ticker });
                    errors.push(errorMsg);
                    continue;
                }
                results.push({
                    exchange: 'bybit', symbol, bid_price, ask_price, last_price, volume, timestamp: new Date().toISOString()
                });
            } else {
                 const errorMsg = `Bybit API error or incomplete data for ${symbol}: ${data?.retMsg || 'Unknown structure'}`;
                 log(errorMsg, { responseData: data });
                 errors.push(errorMsg);
            }
        } catch (e) {
            const errorMsg = `Failed to fetch/parse Bybit data for ${symbol}: ${e.message}`;
            log(errorMsg);
            errors.push(errorMsg);
        }
    }
    return { data: results, errors };
}

Deno.serve(async (req: Request) => {
  const CUSTOM_AUTH_SECRET = Deno.env.get('CRON_SECRET')!;
  const receivedSecret = req.headers.get('X-Vibe-Auth-Secret');

  if (receivedSecret !== CUSTOM_AUTH_SECRET) {
    log('Unauthorized: Missing or incorrect X-Vibe-Auth-Secret header.');
    return new Response(JSON.stringify({ error: 'Unauthorized: Invalid secret.' }), { status: 401, headers: { 'Content-Type': 'application/json' } });
  }

  log('Function invoked securely.');
  
  try {
    // Retrieve personal API keys from environment variables
    const BINANCE_API_KEY = Deno.env.get('PERSONAL_BINANCE_API_KEY');
    const BINANCE_API_SECRET = Deno.env.get('PERSONAL_BINANCE_API_SECRET');
    const BYBIT_API_KEY = Deno.env.get('PERSONAL_BYBIT_API_KEY');
    const BYBIT_API_SECRET = Deno.env.get('PERSONAL_BYBIT_API_SECRET');

    if (!BYBIT_API_KEY || !BYBIT_API_SECRET || !BINANCE_API_KEY || !BINANCE_API_SECRET) {
        throw new Error("One or more personal API keys are not set in environment variables.");
    }
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey);

    log("Starting authenticated data fetch from exchanges...");
    const [{ data: binanceData, errors: binanceErrors }, { data: bybitData, errors: bybitErrors }] = await Promise.all([
        fetchBinanceData(BINANCE_API_KEY, BINANCE_API_SECRET), 
        fetchBybitData(BYBIT_API_KEY, BYBIT_API_SECRET)
    ]);
    
    const allMarketData = [...binanceData, ...bybitData];
    const allErrors = [...binanceErrors, ...bybitErrors];

    log(`Fetched ${allMarketData.length} total valid records. Encountered ${allErrors.length} errors.`);

    if (allMarketData.length > 0) {
        const { error } = await supabaseAdmin.from('market_data').insert(allMarketData);
        if (error) {
            log('Supabase insert error:', error);
            allErrors.push(`Supabase insert failed: ${error.message}`);
        } else {
            log("Data successfully inserted into Supabase.");
        }
    }

    if (allErrors.length > 0) {
        const errorMessage = `Data fetch completed with errors: ${allErrors.join('; ')}`;
        log(`RETURNING ERROR: ${errorMessage}`);
        return new Response(JSON.stringify({ error: errorMessage, insertedCount: allMarketData.length }), { status: 502, headers: { 'Content-Type': 'application/json' } });
    }

    return new Response(JSON.stringify({ success: true, count: allMarketData.length, message: "All data fetched and inserted successfully." }), { status: 200, headers: { 'Content-Type': 'application/json' } });

  } catch (error) {
    log('Critical error in edge function:', error.message);
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
});
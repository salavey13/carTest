import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'npm:@supabase/supabase-js@2';

// NO MORE EXTERNAL HASH IMPORT. WE GO NATIVE.

const log = (message: string, data?: any) => console.log(`[fetch-market-data-v5] ${new Date().toISOString()}: ${message}`, data || '');

// --- NATIVE CRYPTO HELPER ---
async function createHmacSha256Signature(secret: string, payload: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signatureBuffer = await crypto.subtle.sign('HMAC', key, encoder.encode(payload));
  // Convert ArrayBuffer to hex string
  return Array.from(new Uint8Array(signatureBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');
}


// --- Interface & Constants ---
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

// --- Hardened & Authenticated Fetching Functions ---
async function fetchBinanceData(apiKey: string): Promise<{data: MarketData[], errors: string[]}> {
    const results: MarketData[] = [];
    const errors: string[] = [];
    if (!apiKey) return { data: [], errors: ["Binance API Key not provided."] };
    
    for (const symbol of SYMBOLS_TO_MONITOR) {
        try {
            const [tickerRes, volumeRes] = await Promise.all([
                fetch(`https://api.binance.com/api/v3/ticker/bookTicker?symbol=${symbol}`, { headers: { 'X-MBX-APIKEY': apiKey } }).then(res => res.json()),
                fetch(`https://api.binance.com/api/v3/ticker/24hr?symbol=${symbol}`, { headers: { 'X-MBX-APIKEY': apiKey } }).then(res => res.json())
            ]);

            if (tickerRes.code || volumeRes.code || !tickerRes.bidPrice || !tickerRes.askPrice || !volumeRes.lastPrice || !volumeRes.volume) {
                const errorMsg = `Binance API error or incomplete data for ${symbol}: ${tickerRes.msg || volumeRes.msg || 'Incomplete data'}`;
                log(errorMsg); errors.push(errorMsg); continue;
            }
            const [bid_price, ask_price, last_price, volume] = [parseFloat(tickerRes.bidPrice), parseFloat(tickerRes.askPrice), parseFloat(volumeRes.lastPrice), parseFloat(volumeRes.volume)];
            if ([bid_price, ask_price, last_price, volume].some(isNaN)) {
                 const errorMsg = `Binance data validation failed (NaN) for ${symbol}`;
                 log(errorMsg, { tickerRes, volumeRes }); errors.push(errorMsg); continue;
            }
            results.push({ exchange: 'binance', symbol, bid_price, ask_price, last_price, volume, timestamp: new Date().toISOString() });
        } catch (e) {
            const errorMsg = `Failed to fetch/parse Binance data for ${symbol}: ${e.message}`;
            log(errorMsg); errors.push(errorMsg);
        }
    }
    return { data: results, errors };
}

async function fetchBybitData(apiKey: string, apiSecret: string): Promise<{data: MarketData[], errors: string[]}> {
    const results: MarketData[] = [];
    const errors: string[] = [];
    if (!apiKey || !apiSecret) return { data: [], errors: ["Bybit API Key or Secret not provided."] };

    const host = "https://api.bybit.com";
    for (const symbol of SYMBOLS_TO_MONITOR) {
        try {
            const timestamp = Date.now().toString();
            const recvWindow = "5000";
            const path = "/v5/market/tickers";
            const queryString = `category=spot&symbol=${symbol}`;
            const toSign = timestamp + apiKey + recvWindow + queryString;
            // USING THE NATIVE CRYPTO HELPER
            const signature = await createHmacSha256Signature(apiSecret, toSign);

            const response = await fetch(`${host}${path}?${queryString}`, {
                headers: { 'X-BAPI-API-KEY': apiKey, 'X-BAPI-TIMESTAMP': timestamp, 'X-BAPI-RECV-WINDOW': recvWindow, 'X-BAPI-SIGN': signature }
            });
            
            if (!response.ok) { throw new Error(`Bybit API returned non-OK status: ${response.status}. Body: ${await response.text()}`); }
            const data = await response.json();
            const ticker = data?.result?.list?.[0];
            if (data.retCode !== 0) {
                 const errorMsg = `Bybit API returned error for ${symbol}: ${data.retMsg}`;
                 log(errorMsg, { responseData: data }); errors.push(errorMsg); continue;
            }
            if (ticker && ticker.bid1Price && ticker.ask1Price && ticker.lastPrice && ticker.volume24h) {
                const [bid_price, ask_price, last_price, volume] = [parseFloat(ticker.bid1Price), parseFloat(ticker.ask1Price), parseFloat(ticker.lastPrice), parseFloat(ticker.volume24h)];
                if ([bid_price, ask_price, last_price, volume].some(isNaN)) {
                    const errorMsg = `Bybit data validation failed (NaN) for ${symbol}`;
                    log(errorMsg, { ticker }); errors.push(errorMsg); continue;
                }
                results.push({ exchange: 'bybit', symbol, bid_price, ask_price, last_price, volume, timestamp: new Date().toISOString() });
            } else {
                 const errorMsg = `Bybit API error or incomplete data for ${symbol}: ${data?.retMsg || 'Unknown structure'}`;
                 log(errorMsg, { responseData: data }); errors.push(errorMsg);
            }
        } catch (e) {
            const errorMsg = `Failed to fetch/parse Bybit data for ${symbol}: ${e.message}`;
            log(errorMsg); errors.push(errorMsg);
        }
    }
    return { data: results, errors };
}

// --- Main Server Logic ---
Deno.serve(async (req: Request) => {
  const CUSTOM_AUTH_SECRET = Deno.env.get('CRON_SECRET');
  const receivedSecret = req.headers.get('X-Vibe-Auth-Secret');
  if (receivedSecret !== CUSTOM_AUTH_SECRET) {
    log('Unauthorized: Missing or incorrect X-Vibe-Auth-Secret header.');
    return new Response(JSON.stringify({ error: 'Unauthorized: Invalid secret.' }), { status: 401 });
  }
  log('Function invoked securely.');
  
  try {
    const BINANCE_API_KEY = Deno.env.get('PERSONAL_BINANCE_API_KEY');
    const BINANCE_API_SECRET = Deno.env.get('PERSONAL_BINANCE_API_SECRET');
    const BYBIT_API_KEY = Deno.env.get('PERSONAL_BYBIT_API_KEY');
    const BYBIT_API_SECRET = Deno.env.get('PERSONAL_BYBIT_API_SECRET');
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey);

    const fetchPromises = [];
    if (BINANCE_API_KEY && BINANCE_API_SECRET) {
      log("Binance keys found. Adding to fetch queue.");
      fetchPromises.push(fetchBinanceData(BINANCE_API_KEY));
    }
    if (BYBIT_API_KEY && BYBIT_API_SECRET) {
      log("Bybit keys found. Adding to fetch queue.");
      fetchPromises.push(fetchBybitData(BYBIT_API_KEY, BYBIT_API_SECRET));
    }
    
    if (fetchPromises.length === 0) {
      log("No API keys provided for any exchange. Exiting.");
      return new Response(JSON.stringify({ success: true, message: "No API keys configured." }), { status: 200 });
    }

    const results = await Promise.all(fetchPromises);
    const allMarketData = results.flatMap(res => res.data);
    const allErrors = results.flatMap(res => res.errors);

    log(`Fetched ${allMarketData.length} total valid records. Encountered ${allErrors.length} errors.`);

    if (allMarketData.length > 0) {
        const { error } = await supabaseAdmin.from('market_data').insert(allMarketData);
        if (error) { log('Supabase insert error:', error); allErrors.push(`Supabase insert failed: ${error.message}`); }
        else { log("Data successfully inserted into Supabase."); }
    }

    if (allErrors.length > 0) {
        const errorMessage = `Data fetch completed with errors: ${allErrors.join('; ')}`;
        return new Response(JSON.stringify({ success: false, error: errorMessage, insertedCount: allMarketData.length }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }

    return new Response(JSON.stringify({ success: true, count: allMarketData.length, message: "All data fetched and inserted successfully." }), { status: 200 });
  } catch (error) {
    log('Critical error in edge function:', error.message);
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
});
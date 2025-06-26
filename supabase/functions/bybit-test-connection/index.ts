import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { HmacSha256 } from 'https://deno.land/std/hash/sha256.ts';

const log = (message: string, data?: any) => console.log(`[bybit-test] ${new Date().toISOString()}: ${message}`, data || '');

Deno.serve(async (req: Request) => {
  // Use our standard custom secret auth
  const CUSTOM_AUTH_SECRET = Deno.env.get('CRON_SECRET');
  const receivedSecret = req.headers.get('X-Vibe-Auth-Secret');

  if (receivedSecret !== CUSTOM_AUTH_SECRET) {
    log('Unauthorized access attempt.');
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  }

  log('Function invoked. Testing Bybit connection...');

  try {
    const apiKey = Deno.env.get('PERSONAL_BYBIT_API_KEY');
    const apiSecret = Deno.env.get('PERSONAL_BYBIT_API_SECRET');

    if (!apiKey || !apiSecret) {
      throw new Error("PERSONAL_BYBIT_API_KEY or PERSONAL_BYBIT_API_SECRET not found in environment variables.");
    }

    const host = "https://api.bybit.com";
    const path = "/v5/market/tickers";
    const symbol = "BTCUSDT";
    const queryString = `category=spot&symbol=${symbol}`;
    
    const timestamp = Date.now().toString();
    const recvWindow = "10000"; // Increased recv_window for testing
    
    const toSign = timestamp + apiKey + recvWindow + queryString;
    const signature = new HmacSha256(apiSecret).update(toSign).hex();

    log('Making request to Bybit with:', { host, path, queryString, timestamp, recvWindow });
    
    const response = await fetch(`${host}${path}?${queryString}`, {
      headers: {
        'X-BAPI-API-KEY': apiKey,
        'X-BAPI-TIMESTAMP': timestamp,
        'X-BAPI-RECV-WINDOW': recvWindow,
        'X-BAPI-SIGN': signature,
      },
    });

    const responseBody = await response.json();

    log('Bybit Response:', { status: response.status, body: responseBody });

    if (!response.ok || responseBody.retCode !== 0) {
      throw new Error(`Bybit API Error (Status: ${response.status}): ${responseBody.retMsg || 'Unknown error'}`);
    }

    const message = "Successfully connected to Bybit API and received a valid response.";
    return new Response(JSON.stringify({ success: true, message, data: responseBody.result.list[0] }), { status: 200 });

  } catch (error) {
    log('Critical error in Bybit test function:', error.message);
    return new Response(JSON.stringify({ success: false, error: error.message }), { status: 500 });
  }
});
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// CORS headers for browser calls (good practice)
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Define the structure of the data we expect
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
      // Public endpoints don't require signatures, simplifying the fetch
      const [tickerRes, volumeRes] = await Promise.all([
        fetch(`https://api.binance.com/api/v3/ticker/bookTicker?symbol=${symbol}`).then(res => res.json()),
        fetch(`https://api.binance.com/api/v3/ticker/24hr?symbol=${symbol}`).then(res => res.json())
      ]);

      if (tickerRes.code || volumeRes.code) { // Check for Binance API error codes
          console.error(`Binance API error for ${symbol}:`, tickerRes, volumeRes);
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
      console.error(`Failed to fetch Binance data for ${symbol}:`, e.message);
    }
  }
  return results;
}

async function fetchBybitData(): Promise<MarketData[]> {
  const results: MarketData[] = [];
  for (const symbol of SYMBOLS_TO_MONITOR) {
    try {
      // Public tickers endpoint for Bybit v5
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
      console.error(`Failed to fetch Bybit data for ${symbol}:`, e.message);
    }
  }
  return results;
}


// --- Main Server Logic ---

serve(async (req) => {
  // Handle preflight OPTIONS request
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Get Supabase credentials from environment variables
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    // Create a Supabase client with the service role key to bypass RLS for inserts
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey);

    // Fetch data from exchanges
    console.log("Starting data fetch from exchanges...");
    const [binanceData, bybitData] = await Promise.all([
      fetchBinanceData(),
      fetchBybitData()
    ]);

    const allMarketData = [...binanceData, ...bybitData];
    console.log(`Fetched ${allMarketData.length} total records.`);

    if (allMarketData.length === 0) {
      return new Response(JSON.stringify({ success: true, message: 'No data fetched, nothing to insert.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      });
    }

    // Insert data into the database
    const { error } = await supabaseAdmin.from('market_data').insert(allMarketData);

    if (error) {
      console.error('Error inserting data into Supabase:', error);
      throw error;
    }

    console.log("Data successfully inserted into Supabase.");
    return new Response(JSON.stringify({ success: true, count: allMarketData.length }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });
  } catch (error) {
    console.error('Critical error in edge function:', error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});
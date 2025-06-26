import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const log = (message: string, data?: any) => console.log(`[get-api-keys-v3] ${new Date().toISOString()}: ${message}`, data || '');

// --- CORS HEADERS - THE KEY TO UNLOCKING THE BROWSER ---
const corsHeaders = {
  'Access-Control-Allow-Origin': '*', // For testing, '*' is fine. For production, you'd use 'https://your-app-domain.vercel.app'
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

Deno.serve(async (req: Request) => {
  // Handle preflight requests for CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // We are keeping JWT enforcement enabled on this function in the Supabase dashboard.
    // The Supabase client on the front-end will automatically handle the user's auth token.
    log('Function invoked by an authenticated user.');
    
    const bybitApiKey = Deno.env.get('PERSONAL_BYBIT_API_KEY');
    const bybitApiSecret = Deno.env.get('PERSONAL_BYBIT_API_SECRET');
    const binanceApiKey = Deno.env.get('PERSONAL_BINANCE_API_KEY');
    const binanceApiSecret = Deno.env.get('PERSONAL_BINANCE_API_SECRET');

    const keys = {
      bybit: {
        apiKey: bybitApiKey || null,
        apiSecret: bybitApiSecret || null,
      },
      binance: {
        apiKey: binanceApiKey || null,
        apiSecret: binanceApiSecret || null,
      },
    };

    if (!keys.bybit.apiKey && !keys.binance.apiKey) {
        log("Warning: No API keys are set in the function's environment.");
    }

    log('Successfully retrieved keys. Returning to client.');
    return new Response(JSON.stringify({ success: true, keys }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error) {
    log(`Critical error: ${error.message}`);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});
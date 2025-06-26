import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'npm:@supabase/supabase-js@2';

const log = (message: string, data?: any) => console.log(`[get-api-keys-v2] ${new Date().toISOString()}: ${message}`, data || '');

Deno.serve(async (req: Request) => {
  // CRITICAL: This function MUST have "Enforce JWT Verification" ENABLED in Supabase dashboard.
  // The 'Authorization: Bearer <user_jwt>' header will be validated by Supabase automatically.
  // We don't need a separate custom secret for this one, as it's user-specific.
  
  log('Function invoked by an authenticated user.');

  try {
    const bybitApiKey = Deno.env.get('PERSONAL_BYBIT_API_KEY');
    const bybitApiSecret = Deno.env.get('PERSONAL_BYBIT_API_SECRET');
    const binanceApiKey = Deno.env.get('PERSONAL_BINANCE_API_KEY');
    const binanceApiSecret = Deno.env.get('PERSONAL_BINANCE_API_SECRET');

    // Return everything. The Captain gets the full loadout.
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

    if (!keys.bybit.apiKey || !keys.binance.apiKey) {
        log("Warning: One or more API keys are not set in the function's environment.");
    }

    log('Successfully retrieved keys for authenticated user. Returning to client.');
    return new Response(JSON.stringify({ success: true, keys }), {
      headers: { 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error) {
    log(`Critical error: ${error.message}`);
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
});
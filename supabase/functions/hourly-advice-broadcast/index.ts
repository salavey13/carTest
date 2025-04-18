import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { config } from 'https://deno.land/x/dotenv@v3.2.2/mod.ts'; // Using dotenv for local testing

// Load environment variables from .env file for local development
// In production on Supabase, these should be set via Supabase dashboard
config({ export: true, path: '../.env.local' }); // Adjust path if needed

const ADVICE_BROADCAST_URL = Deno.env.get('ADVICE_BROADCAST_URL');
const CRON_SECRET = Deno.env.get('CRON_SECRET');

console.log('Hourly Advice Broadcast Function Initialized.');
console.log('API URL:', ADVICE_BROADCAST_URL ? 'Loaded' : 'MISSING!'); // Basic check
console.log('Cron Secret:', CRON_SECRET ? 'Loaded' : 'MISSING!'); // Basic check

async function handler(_req: Request): Promise<Response> {
  // Check if essential variables are loaded
  if (!ADVICE_BROADCAST_URL || !CRON_SECRET) {
    console.error('Error: Missing required environment variables (ADVICE_BROADCAST_URL or CRON_SECRET).');
    return new Response(JSON.stringify({ error: 'Function configuration missing.' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  console.log(`Triggering Advice Broadcast API: ${ADVICE_BROADCAST_URL}`);

  try {
    const response = await fetch(ADVICE_BROADCAST_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${CRON_SECRET}`, // Send the secret as a Bearer token
      },
      // No body needed for this trigger, the API route fetches users itself
    });

    const responseData = await response.json();

    if (!response.ok) {
      console.error(`Error calling Advice Broadcast API: ${response.status} ${response.statusText}`, responseData);
      // Return the error from the API route if available
      return new Response(JSON.stringify({ error: `API call failed: ${response.statusText}`, details: responseData }), {
        status: response.status, // Forward the status code
        headers: { 'Content-Type': 'application/json' },
      });
    }

    console.log('Advice Broadcast API called successfully.', responseData);
    // Return the success response from the API route
    return new Response(JSON.stringify(responseData), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Failed to execute fetch to Advice Broadcast API:', error);
    return new Response(JSON.stringify({ error: `Internal function error: ${error.message}` }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

// Start the Deno server
serve(handler);

/*
To Deploy:
1. Ensure .env.local has ADVICE_BROADCAST_URL and CRON_SECRET for local testing.
2. Set ADVICE_BROADCAST_URL and CRON_SECRET in Supabase Function environment variables via the dashboard.
3. Run: supabase functions deploy hourly-advice-broadcast --no-verify-jwt
4. Schedule via SQL (see migration file).
*/
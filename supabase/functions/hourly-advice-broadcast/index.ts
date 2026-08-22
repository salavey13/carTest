import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
// Note: Deno's standard library for dotenv is more direct.
// For Supabase Edge Functions, environment variables are typically set in the dashboard.
// This dotenv import is mainly for local Deno development if you use a .env file.
// Ensure your .env.local path is correct relative to where you run `deno run --allow-env --allow-net index.ts`
// Example: if index.ts is in functions/hourly-advice-broadcast, and .env.local is in functions/.env.local
// then path would be '../.env.local'. If .env.local is in the project root, it's '../../.env.local'
// For Supabase deployment, these are set in the dashboard and Deno.env.get will pick them up.

// Local development: Attempt to load .env.local from project root if this script is in supabase/functions/hourly-advice-broadcast/
// This might require creating a separate .env file for the function or adjusting the path.
// For deployment, these are set in Supabase dashboard.
// const envPath = new URL('../../.env.local', import.meta.url).pathname; // For local testing from project root
// try {
//   config({ export: true, path: envPath, safe: true }); // safe: true means it won't throw if .env not found
// } catch (e) {
//   console.warn("Dotenv: Failed to load .env.local for local development. This is OK if deploying to Supabase.", e.message);
// }


const ADVICE_BROADCAST_URL = Deno.env.get('ADVICE_BROADCAST_URL');
const CRON_SECRET = Deno.env.get('CRON_SECRET');

console.log('Hourly Advice Broadcast Function Initialized.');
console.log('ADVICE_BROADCAST_URL Status:', ADVICE_BROADCAST_URL ? 'Loaded' : 'MISSING!');
console.log('CRON_SECRET Status:', CRON_SECRET ? 'Loaded' : 'MISSING!');

async function handler(_req: Request): Promise<Response> {
  const authHeader = _req.headers.get('Authorization');
  if (authHeader !== `Bearer ${CRON_SECRET}`) {
    console.warn('Unauthorized attempt to trigger cron job. Provided token:', authHeader);
    return new Response(JSON.stringify({ error: 'Unauthorized cron trigger' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  
  if (!ADVICE_BROADCAST_URL) { // CRON_SECRET already checked basically by authHeader
    console.error('Error: ADVICE_BROADCAST_URL environment variable is missing.');
    return new Response(JSON.stringify({ error: 'Function configuration incomplete (Missing API URL).' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  console.log(`Triggering Advice Broadcast API endpoint: ${ADVICE_BROADCAST_URL}`);

  try {
    const response = await fetch(ADVICE_BROADCAST_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // The API route itself should verify its own internal CRON_SECRET if it's called directly
        // This function's CRON_SECRET is for this function's own auth.
        // If ADVICE_BROADCAST_URL is an internal API route, it might have its own auth logic.
        // For simplicity, if it's the same secret, we can pass it.
        'Authorization': `Bearer ${CRON_SECRET}`,
      },
    });

    // Try to parse JSON regardless of status, as error responses might also be JSON
    let responseData;
    try {
      responseData = await response.json();
    } catch (e) {
      // If JSON parsing fails, use text and log the error
      const responseText = await response.text(); // Re-read as text
      console.error(`Advice Broadcast API response was not valid JSON (Status: ${response.status}):`, responseText);
      responseData = { error: "Invalid JSON response from API", details: responseText.substring(0, 200) };
      // If response was not ok AND not JSON, return an error based on status
      if (!response.ok) {
        return new Response(JSON.stringify(responseData), {
          status: 502, // Bad Gateway, as API responded unexpectedly
          headers: { 'Content-Type': 'application/json' },
        });
      }
    }

    if (!response.ok) {
      console.error(`Error calling Advice Broadcast API: ${response.status} ${response.statusText}`, responseData);
      return new Response(JSON.stringify({ error: `API call failed: ${response.statusText}`, details: responseData }), {
        status: response.status,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    console.log('Advice Broadcast API called successfully.', responseData);
    return new Response(JSON.stringify(responseData), {
      status: 200, // Or response.status if it might be 202 etc.
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Failed to execute fetch to Advice Broadcast API:', error.message, error.stack);
    return new Response(JSON.stringify({ error: `Internal function error: ${error.message}` }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

serve(handler);

/*
To Deploy:
1. Ensure `ADVICE_BROADCAST_URL` (pointing to your `/api/advice-broadcast` route) and `CRON_SECRET`
   are set in Supabase Function environment variables (Settings -> Edge Functions -> Your Function -> Environment variables).
2. Run: `supabase functions deploy hourly-advice-broadcast --no-verify-jwt`
3. Schedule this Edge Function (not the API route) via Supabase dashboard (Database -> Cron Jobs) or SQL:
   `SELECT cron.schedule('hourly-advice-job', '0 * * * *', 'SELECT net.http_post(url:=''https://YOUR_PROJECT_REF.supabase.co/functions/v1/hourly-advice-broadcast'', headers:=''{"Authorization": "Bearer YOUR_CRON_SECRET"}''::jsonb)');`
   Replace YOUR_PROJECT_REF and YOUR_CRON_SECRET. The URL is the invocation URL of *this* Edge Function.
*/
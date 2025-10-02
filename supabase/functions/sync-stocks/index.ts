import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const SYNC_API_URL = Deno.env.get('SYNC_API_URL');  // e.g., https://your-app-url/app/api/sync-stocks
const CRON_SECRET = Deno.env.get('CRON_SECRET');

console.log('Sync Stocks Function Initialized.');
console.log('SYNC_API_URL Status:', SYNC_API_URL ? 'Loaded' : 'MISSING!');
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
  
  if (!SYNC_API_URL) {
    console.error('Error: SYNC_API_URL environment variable is missing.');
    return new Response(JSON.stringify({ error: 'Function configuration incomplete (Missing API URL).' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  console.log(`Triggering Sync API endpoint: ${SYNC_API_URL}`);

  try {
    const response = await fetch(SYNC_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${CRON_SECRET}`,  // If your API route needs auth
      },
    });

    let responseData;
    try {
      responseData = await response.json();
    } catch (e) {
      const responseText = await response.text();
      console.error(`Sync API response was not valid JSON (Status: ${response.status}):`, responseText);
      responseData = { error: "Invalid JSON response from API", details: responseText.substring(0, 200) };
      if (!response.ok) {
        return new Response(JSON.stringify(responseData), {
          status: 502,
          headers: { 'Content-Type': 'application/json' },
        });
      }
    }

    if (!response.ok) {
      console.error(`Error calling Sync API: ${response.status} ${response.statusText}`, responseData);
      return new Response(JSON.stringify({ error: `API call failed: ${response.statusText}`, details: responseData }), {
        status: response.status,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    console.log('Sync API called successfully.', responseData);
    return new Response(JSON.stringify(responseData), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Failed to execute fetch to Sync API:', error.message, error.stack);
    return new Response(JSON.stringify({ error: `Internal function error: ${error.message}` }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

serve(handler);

/*
Deployment:
1. Set SYNC_API_URL (your /api/sync-stocks) and CRON_SECRET in Supabase Function env.
2. Deploy: supabase functions deploy sync-stocks --no-verify-jwt
3. Cron: See below SQL.
*/
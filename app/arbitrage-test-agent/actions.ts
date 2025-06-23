// /app/arbitrage-test-agent/actions.ts
"use server";

import { logger } from "@/lib/logger";

async function triggerEdgeFunction(functionName: string): Promise<{ success: boolean; data?: any; error?: string }> {
  const endpoint = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/${functionName}`;
  
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const customSecret = process.env.CRON_SECRET;

  if (!anonKey || !customSecret) {
    const missing = !anonKey ? "ANON_KEY" : "CRON_SECRET";
    logger.error(`[TestAgentActions] Vercel environment variable ${missing} is not configured.`);
    return { success: false, error: `${missing} is not configured.` };
  }
  
  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        // This is the standard Supabase client header. It gets us past the first gate.
        'apikey': anonKey, 
        // THIS IS THE FIX. We are now putting our OWN secret inside the standard 'Authorization' header.
        // The Supabase gateway will see "Bearer" and pass it to the function.
        // Our function will then check if the token part matches our CRON_SECRET.
        'Authorization': `Bearer ${customSecret}`, 
        'Content-Type': 'application/json'
      },
    });

    const data = await response.json();
    if (!response.ok) {
        logger.error(`Failed to trigger '${functionName}' function.`, { status: response.status, response: data });
        throw new Error(data.error || `Function failed with status ${response.status}`);
    }
    
    logger.info(`'${functionName}' triggered successfully.`, data);
    return { success: true, data };
  } catch(e) {
    const errorMsg = e instanceof Error ? e.message : "Unknown error";
    logger.error(`Critical error triggering ${functionName}:`, errorMsg);
    return { success: false, error: errorMsg };
  }
}

export async function triggerMarketDataFetch(): Promise<{ success: boolean; data?: any; error?: string }> {
  return triggerEdgeFunction('fetch-market-data');
}

export async function triggerCentralAnalyzer(): Promise<{ success: boolean; data?: any; error?: string }> {
  return triggerEdgeFunction('arbitrage-analyzer-notifier');
}

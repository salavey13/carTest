"use server";

import { logger } from "@/lib/logger";

/**
 * Securely triggers the Supabase Edge Function to fetch fresh market data.
 * This is the "Hunter-Gatherer" drone.
 */
export async function triggerMarketDataFetch(): Promise<{ success: boolean; data?: any; error?: string }> {
  const endpoint = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/fetch-market-data`;
  const secret = process.env.CRON_SECRET;

  if (!secret) {
    logger.error("[TestAgentActions] CRON_SECRET is not configured on Vercel.");
    return { success: false, error: "CRON_SECRET not configured on Vercel." };
  }
  
  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 
        'Authorization': `Bearer ${secret}`,
        'Content-Type': 'application/json'
      },
    });

    const data = await response.json();
    if (!response.ok) {
        logger.error("Failed to trigger 'fetch-market-data' function.", { status: response.status, response: data });
        throw new Error(data.error || `Function failed with status ${response.status}`);
    }
    
    logger.info("'fetch-market-data' triggered successfully.", data);
    return { success: true, data };
  } catch(e) {
    const errorMsg = e instanceof Error ? e.message : "Unknown error";
    logger.error("Critical error triggering market data fetch:", errorMsg);
    return { success: false, error: errorMsg };
  }
}

/**
 * Securely triggers the Supabase Edge Function to run the central analysis and notification logic.
 * This is the "Watchtower".
 */
export async function triggerCentralAnalyzer(): Promise<{ success: boolean; data?: any; error?: string }> {
  const endpoint = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/arbitrage-analyzer-notifier`;
  const secret = process.env.CRON_SECRET;

  if (!secret) {
    logger.error("[TestAgentActions] CRON_SECRET is not configured on Vercel.");
    return { success: false, error: "CRON_SECRET not configured on Vercel." };
  }

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${secret}`,
        'Content-Type': 'application/json'
      }
    });
    
    const data = await response.json();
    if (!response.ok) {
        logger.error("Failed to trigger 'arbitrage-analyzer-notifier' function.", { status: response.status, response: data });
        throw new Error(data.error || `Function failed with status ${response.status}`);
    }

    logger.info("'arbitrage-analyzer-notifier' triggered successfully.", data);
    return { success: true, data };
  } catch(e) {
    const errorMsg = e instanceof Error ? e.message : "Unknown error";
    logger.error("Critical error triggering central analyzer:", errorMsg);
    return { success: false, error: errorMsg };
  }
}
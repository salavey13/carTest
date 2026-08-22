"use server";

import { logger } from "@/lib/logger";
import {
    fetchArbitrageOpportunities
} from '@/app/elon/arbitrage_scanner_actions';

// Centralized function to trigger any edge function with the new auth strategy
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
        'apikey': anonKey,
        'Authorization': `Bearer ${anonKey}`,
        'X-Vibe-Auth-Secret': customSecret,
        'Content-Type': 'application/json'
      },
    });

    const data = await response.json();
    if (!response.ok) {
        const errorMessage = data.error || `Function failed with status ${response.status}`;
        logger.error(`Failed to trigger '${functionName}' function.`, { status: response.status, response: data });
        return { success: false, error: errorMessage };
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

// NEW: Server action to run a full simulation cycle locally.
export async function runFullSimulation(userId: string): Promise<{ success: boolean; data?: any; error?: string }> {
    logger.info(`[TestAgentActions] Starting full local simulation for user: ${userId}`);
    if (!userId) {
        const errorMsg = "User ID is required for a full simulation.";
        logger.error(`[TestAgentActions] ${errorMsg}`);
        return { success: false, error: errorMsg };
    }

    try {
        // Step 1: Simulate fetching and storing opportunities (similar to fetchArbitrageOpportunities)
        // We'll use the main action from the Elon page for consistency.
        const opportunitiesResult = await fetchArbitrageOpportunities(userId);
        
        if (!opportunitiesResult.opportunities || opportunitiesResult.opportunities.length === 0) {
            const message = "Simulation ran, but no profitable opportunities were generated based on current settings.";
            logger.info(`[TestAgentActions] ${message}`);
            return { success: true, data: { message, logs: opportunitiesResult.logs } };
        }
        
        logger.info(`[TestAgentActions] Simulation generated ${opportunitiesResult.opportunities.length} opportunities.`);

        // Step 2: In a real scenario, you'd now trigger the analyzer with this data.
        // For this test, we just confirm that data generation works.
        // The analyzer edge function reads from the database view, which we are bypassing here.
        // So we just return the generated data for now.
        return { 
            success: true, 
            data: { 
                message: `Full simulation complete. Generated ${opportunitiesResult.opportunities.length} opportunities.`,
                opportunities: opportunitiesResult.opportunities,
                logs: opportunitiesResult.logs
            } 
        };

    } catch (e) {
        const errorMsg = e instanceof Error ? e.message : "Unknown error during full simulation.";
        logger.error(`[TestAgentActions] Critical error in runFullSimulation:`, errorMsg);
        return { success: false, error: errorMsg };
    }
}
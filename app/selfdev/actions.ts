"use server";

import { supabaseAdmin } from "@/hooks/supabase";
import { logger } from "@/lib/logger";
import { debugLogger } from "@/lib/debugLogger";

interface PurchaseRecord {
  boost_type: string;
  purchased_at: string; // ISO string format recommended
}

/**
 * Fetches the most recent 'selfdev_boost' purchases from the database.
 * Accessible only on the server.
 * @param limit The maximum number of records to fetch.
 */
export async function getRecentSelfDevPurchases(limit: number = 5): Promise<{
    success: boolean;
    data?: PurchaseRecord[];
    error?: string;
}> {
    debugLogger.log(`[SelfDev Action] Fetching recent self-dev purchases (limit: ${limit})`);
    try {
        const { data, error } = await supabaseAdmin
            .from("invoices")
            .select("metadata->>boost_type, created_at") // Select boost_type from metadata and timestamp
            .eq("type", "selfdev_boost") // Filter by the correct invoice type
            .eq("status", "paid")       // Only include paid invoices
            .order("created_at", { ascending: false })
            .limit(limit);

        if (error) {
            logger.error("Error fetching recent self-dev purchases from DB:", error);
            throw error;
        }

        // Format the data
        const purchases: PurchaseRecord[] = data.map((invoice: any) => ({ // Use 'any' carefully or define Invoice type
            boost_type: invoice.boost_type || "unknown", // Extract boost_type, handle missing case
            purchased_at: invoice.created_at,
        }));

        debugLogger.log(`[SelfDev Action] Successfully fetched ${purchases.length} purchases.`);
        return { success: true, data: purchases };

    } catch (error) {
        logger.error("[SelfDev Action] Failed to execute getRecentSelfDevPurchases:", error);
        return {
            success: false,
            error: error instanceof Error ? error.message : "Failed to fetch recent purchases",
        };
    }
}


/**
 * Subscribes to new 'selfdev_boost' purchases.
 * NOTE: This function demonstrates the concept but sending real-time updates
 * from a Server Action to a Client Component requires a more complex setup
 * (e.g., WebSockets, Server-Sent Events, or a third-party service).
 * This basic version would only log on the server.
 *
 * @param callback A function to call when a new purchase occurs.
 */
export async function subscribeToSelfDevPurchases(
    callback: (purchase: PurchaseRecord) => void
): Promise<() => void> {
    logger.info("[SelfDev Action] Attempting to subscribe to self-dev purchases (server-side only).");

    // This subscription happens on the server where the action runs.
    // It cannot directly push updates back to the specific client that called the action
    // without additional infrastructure.
    const channel = supabaseAdmin
        .channel('realtime-selfdev-purchases')
        .on(
            'postgres_changes',
            {
                event: 'INSERT',
                schema: 'public',
                table: 'invoices',
                filter: 'type=eq.selfdev_boost' // Filter for relevant type
            },
            (payload) => {
                logger.info('[SelfDev Action] Received new invoice insert via subscription (server-side).', payload);
                // Check if the new invoice is paid (status might change later)
                if (payload.new && payload.new.status === 'paid') {
                    const boostType = payload.new.metadata?.boost_type || "unknown";
                    const createdAt = payload.new.created_at || new Date().toISOString();
                    logger.info(`[SelfDev Action] New PAID selfdev_boost detected: ${boostType}`);
                    const purchase: PurchaseRecord = {
                        boost_type: boostType,
                        purchased_at: createdAt,
                    };
                    // Calling the callback here will execute it on the server environment
                    // where the action is running, NOT push it to the client's browser.
                    try {
                        callback(purchase);
                    } catch (cbError) {
                        logger.error("[SelfDev Action] Error executing subscription callback:", cbError);
                    }
                }
            }
        )
        .subscribe((status, err) => {
            if (status === 'SUBSCRIBED') {
                logger.info('[SelfDev Action] Successfully subscribed to self-dev purchases on server.');
            } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
                logger.error(`[SelfDev Action] Subscription error: ${status}`, err);
            } else {
                 logger.info(`[SelfDev Action] Subscription status: ${status}`);
            }
        });

    // Return a function to unsubscribe
    const unsubscribe = async () => {
        logger.info("[SelfDev Action] Removing server-side subscription to self-dev purchases.");
        await supabaseAdmin.removeChannel(channel);
    };

    return unsubscribe;
}
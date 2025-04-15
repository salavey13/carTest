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
        // Используем RPC для более чистого извлечения и обработки JSONB
        const { data, error } = await supabaseAdmin.rpc(
            'get_recent_paid_selfdev_invoices',
            { limit_count: limit }
        );

        if (error) {
            logger.error("Error fetching recent self-dev purchases via RPC from DB:", error);
            throw error;
        }

        // Данные из RPC должны уже быть в нужном формате { boost_type, created_at }
        // Переименуем created_at в purchased_at для соответствия PurchaseRecord
        const purchases: PurchaseRecord[] = data.map((item: any) => ({
            boost_type: item.boost_type || "unknown",
            purchased_at: item.created_at,
        }));


        debugLogger.log(`[SelfDev Action] Successfully fetched ${purchases.length} purchases via RPC.`);
        return { success: true, data: purchases };

    } catch (error) {
        logger.error("[SelfDev Action] Failed to execute getRecentSelfDevPurchases:", error);
        return {
            success: false,
            error: error instanceof Error ? error.message : "Failed to fetch recent purchases",
        };
    }
}

/*
-- SQL Функция для Supabase (выполнить один раз в SQL Editor)
-- Эта функция безопаснее и эффективнее извлекает нужные данные
CREATE OR REPLACE FUNCTION get_recent_paid_selfdev_invoices(limit_count integer)
RETURNS TABLE(boost_type text, created_at timestamp with time zone)
LANGUAGE sql
AS $$
SELECT
    metadata->>'boost_type' AS boost_type,
    created_at
FROM
    public.invoices
WHERE
    type = 'selfdev_boost' AND status = 'paid'
ORDER BY
    created_at DESC
LIMIT limit_count;
$$;

-- NB: You might need to enable this function for the service_role or relevant user.
-- Example: GRANT EXECUTE ON FUNCTION get_recent_paid_selfdev_invoices(integer) TO service_role;
-- Example: ALTER FUNCTION get_recent_paid_selfdev_invoices(integer) SECURITY DEFINER; (Use with caution)
*/


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

    // Эта подписка происходит на сервере, где выполняется action.
    // Она не может напрямую отправлять обновления клиенту без доп. инфраструктуры.
    const channel = supabaseAdmin
        .channel('realtime-selfdev-purchases')
        .on<any>( // Используем <any> для payload, т.к. тип сложный
            'postgres_changes',
            {
                event: 'INSERT',
                schema: 'public',
                table: 'invoices',
                filter: 'type=eq.selfdev_boost' // Фильтр по типу
            },
            (payload) => {
                logger.info('[SelfDev Action] Received new invoice insert via subscription (server-side).', payload);
                // Проверяем, что это новый оплаченный счет
                if (payload.new && payload.new.status === 'paid') {
                    // Извлекаем boost_type из metadata, проверяя его наличие
                    const boostType = payload.new.metadata?.boost_type ?? "unknown";
                    const createdAt = payload.new.created_at ?? new Date().toISOString(); // Используем ?? для null/undefined

                    logger.info(`[SelfDev Action] New PAID selfdev_boost detected: ${boostType}`);
                    const purchase: PurchaseRecord = {
                        boost_type: boostType,
                        purchased_at: createdAt,
                    };
                    // Вызов callback выполнится в серверной среде
                    try {
                        callback(purchase);
                    } catch (cbError) {
                        logger.error("[SelfDev Action] Error executing subscription callback:", cbError);
                    }
                } else {
                    // Логируем, если пришло событие INSERT, но статус не 'paid' (может быть 'pending' и т.д.)
                    debugLogger.log('[SelfDev Action] Received non-paid or incomplete invoice insert event.', payload.new);
                }
            }
        )
        .subscribe((status, err) => {
            if (status === 'SUBSCRIBED') {
                logger.info('[SelfDev Action] Successfully subscribed to self-dev purchases on server.');
            } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') { // Добавим CLOSED
                logger.error(`[SelfDev Action] Subscription error or closed: ${status}`, err);
                // Здесь можно добавить логику переподключения, если нужно
            } else {
                 logger.info(`[SelfDev Action] Subscription status: ${status}`);
            }
        });

    // Возвращаем функцию для отписки
    const unsubscribe = async () => {
        logger.info("[SelfDev Action] Removing server-side subscription to self-dev purchases.");
        try {
            const removeStatus = await supabaseAdmin.removeChannel(channel);
            logger.info("[SelfDev Action] Subscription removal status:", removeStatus);
        } catch (removeError) {
            logger.error("[SelfDev Action] Error removing subscription channel:", removeError);
        }
    };

    return unsubscribe;
}
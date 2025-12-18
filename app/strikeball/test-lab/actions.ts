"use server";

import { qrMerchantHandler } from "@/app/webhook-handlers/qr-merchant"; // Import logic directly
import { supabaseAdmin } from "@/hooks/supabase";

export async function simulateGearPurchase(userId: string, itemId: string) {
    try {
        // Mock Invoice Data
        const mockInvoice = {
            id: `TEST_INV_${Date.now()}`,
            type: 'gear_buy',
            status: 'paid',
            metadata: {
                gear_id: itemId
            }
        };

        // Reuse the handler logic directly
        // We pass a dummy 'adminChatId' and 'telegramToken' because in test mode they might not send messages if env vars are missing, or they will log errors which is fine.
        await qrMerchantHandler.handle(
            mockInvoice as any, 
            userId, 
            { user_id: userId } as any, // Mock user data
            100, // Amount
            supabaseAdmin,
            process.env.TELEGRAM_BOT_TOKEN!,
            process.env.ADMIN_CHAT_ID!,
            "http://localhost:3000"
        );

        return { success: true };
    } catch (e: any) {
        return { success: false, error: e.message };
    }
}
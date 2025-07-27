"use server";

import { logger } from "@/lib/logger";
import { supabaseAdmin } from "@/hooks/supabase";
import { sendComplexMessage } from "../actions/sendComplexMessage";

export async function shiftCommand(chatId: number, userId: string, username?: string) {
    logger.info(`[Shift Command] User ${userId} initiated /shift.`);
    try {
        // Invoke the Edge Function securely from the Vercel backend.
        const { error } = await supabaseAdmin.functions.invoke('handle-shift-command', {
            body: { userId, chatId, username },
        });
        if (error) throw error;
        // The Edge Function now handles sending messages, so no message is needed here on success.
    } catch (e) {
        logger.error(`[Shift Command] Error invoking edge function for user ${userId}:`, e);
        await sendComplexMessage(chatId, "Не удалось связаться с системой учета времени. Попробуйте позже.", []);
    }
}
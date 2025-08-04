"use server";

import { logger } from "@/lib/logger";
import { supabaseAdmin } from "@/hooks/supabase";
import { sendComplexMessage } from "../actions/sendComplexMessage";

// Добавляем опциональный параметр action
export async function shiftCommand(chatId: number, userId: string, username?: string, action?: string) {
    logger.info(`[Shift Command] User ${userId} initiated /shift. Action: ${action || 'request_keyboard'}`);
    try {
        // Передаем action в теле запроса к Edge-функции
        const { error } = await supabaseAdmin.functions.invoke('handle-shift-command', {
            body: { userId, chatId, username, action },
        });
        if (error) throw error;
        // Edge-функция сама отправляет все ответы, поэтому здесь ничего не делаем в случае успеха.
    } catch (e) {
        logger.error(`[Shift Command] Error invoking edge function for user ${userId}:`, e);
        await sendComplexMessage(chatId, "Не удалось связаться с системой учета времени. Попробуйте позже.", []);
    }
}
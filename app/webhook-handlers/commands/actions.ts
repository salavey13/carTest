"use server";

import { logger } from "@/lib/logger";
import { supabaseAdmin } from "@/hooks/supabase";
import { sendComplexMessage, KeyboardButton } from "../actions/sendComplexMessage";
import { sosCommand } from './sos';

// Helper to determine the current state and available actions
async function getRentalContext(userId: string): Promise<{rentalId: string, role: 'renter' | 'owner'} | null> {
    const { data, error } = await supabaseAdmin
        .from('rentals')
        .select('rental_id, user_id, owner_id, status')
        .or(`user_id.eq.${userId},owner_id.eq.${userId}`)
        .in('status', ['pending_confirmation', 'confirmed', 'active'])
        .order('created_at', { ascending: false })
        .limit(1)
        .single();
    
    if (error || !data) {
        if (error) logger.error(`[actionsCommand] Error fetching rental context for ${userId}`, error);
        return null;
    }
    
    return {
        rentalId: data.rental_id,
        role: data.user_id === userId ? 'renter' : 'owner'
    };
}


export async function actionsCommand(chatId: number, userId: string) {
    logger.info(`[actionsCommand] User ${userId} initiated /actions command.`);
    
    const context = await getRentalContext(userId);

    if (!context) {
        await sendComplexMessage(chatId, "🤔 У вас нет активных аренд, требующих действий.", [], { removeKeyboard: true });
        return;
    }

    const { data: events, error } = await supabaseAdmin
        .from('events')
        .select('type, status')
        .eq('rental_id', context.rentalId)
        .order('created_at', { ascending: true });

    if (error) {
        logger.error(`[actionsCommand] Error fetching events for rental ${context.rentalId}`, error);
        await sendComplexMessage(chatId, "🚨 Ошибка при получении статуса аренды.", [], { removeKeyboard: true });
        return;
    }

    const buttons: KeyboardButton[][] = [];
    const eventTypes = new Set(events.map(e => e.type));

    if (context.role === 'renter') {
        if (!eventTypes.has('photo_start')) buttons.push([{ text: "📸 Загрузить фото 'ДО'" }]);
        if (eventTypes.has('pickup_confirmed') && !eventTypes.has('photo_end')) buttons.push([{ text: "📸 Загрузить фото 'ПОСЛЕ'" }]);
        buttons.push([{ text: "🆘 SOS" }]);
    }

    if (context.role === 'owner') {
        const lastPendingEvent = events.filter(e => e.status === 'pending').pop();
        if (lastPendingEvent?.type === 'photo_start') buttons.push([{ text: "✅ Подтвердить получение" }]);
        if (lastPendingEvent?.type === 'photo_end') buttons.push([{ text: "✅ Подтвердить возврат" }]);
    }
    
    buttons.push([{ text: "❌ Закрыть" }]);

    if (buttons.length > 1) { // More than just the "Close" button
        await sendComplexMessage(chatId, "👇 Выберите доступное действие:", buttons, { keyboardType: 'reply' });
    } else {
        await sendComplexMessage(chatId, "На данный момент для вас нет доступных действий.", [], { removeKeyboard: true });
    }
}

export async function handleActionChoice(chatId: number, userId: string, choice: string) {
    logger.info(`[handleActionChoice] User ${userId} chose action: "${choice}"`);
    
    const context = await getRentalContext(userId);
    if (!context) {
        await sendComplexMessage(chatId, "Не удалось найти активную аренду. Операция отменена.", [], { removeKeyboard: true });
        return;
    }

    let actionResponse = "Действие в обработке...";
    
    switch(choice) {
        case "📸 Загрузить фото 'ДО'":
        case "📸 Загрузить фото 'ПОСЛЕ'":
            actionResponse = `Чтобы загрузить фото, откройте страницу аренды.`;
            break;
        case "✅ Подтвердить получение":
            actionResponse = "Подтверждаю получение... "; // Placeholder
            break;
        case "✅ Подтвердить возврат":
            actionResponse = "Подтверждаю возврат..."; // Placeholder
            break;
        case "🆘 SOS":
            await sosCommand(chatId, userId);
            return; // SOS has its own flow
        case "❌ Закрыть":
            actionResponse = "Меню действий закрыто.";
            break;
        default:
            actionResponse = "Неизвестное действие.";
            break;
    }
    
    await sendComplexMessage(chatId, actionResponse, [], { removeKeyboard: true });
}
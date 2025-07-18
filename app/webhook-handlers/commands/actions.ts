"use server";

import { logger } from "@/lib/logger";
import { supabaseAdmin } from "@/hooks/supabase";
import { sendComplexMessage, KeyboardButton } from "../actions/sendComplexMessage";
import { sosCommand } from './sos';
import { confirmVehiclePickup, confirmVehicleReturn } from '@/app/rentals/actions';

// Helper to determine the current state and available actions
async function getRentalContext(userId: string): Promise<{rentalId: string, role: 'renter' | 'owner', status: string} | null> {
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
        role: data.user_id === userId ? 'renter' : 'owner',
        status: data.status,
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

    if (context.role === 'renter' && context.status === 'active') {
        if (!eventTypes.has('photo_end')) buttons.push([{ text: "action_upload-photo-end" }]);
        buttons.push([{ text: "🆘 SOS" }]);
    } else if (context.role === 'renter') {
        if (!eventTypes.has('photo_start')) buttons.push([{ text: "action_upload-photo-start" }]);
    }

    if (context.role === 'owner') {
        const hasPendingStartPhoto = events.some(e => e.type === 'photo_start' && e.status === 'completed');
        const hasPickupConfirmed = events.some(e => e.type === 'pickup_confirmed' && e.status === 'completed');
        const hasPendingEndPhoto = events.some(e => e.type === 'photo_end' && e.status === 'completed');

        if (hasPendingStartPhoto && !hasPickupConfirmed) buttons.push([{ text: "action_confirm-pickup" }]);
        if (hasPendingEndPhoto) buttons.push([{ text: "action_confirm-return" }]);
    }
    
    buttons.push([{ text: "❌ Закрыть" }]);
    const buttonLabels: Record<string, string> = {
        "action_upload-photo-start": "📸 Загрузить фото 'ДО'",
        "action_upload-photo-end": "📸 Загрузить фото 'ПОСЛЕ'",
        "action_confirm-pickup": "✅ Подтвердить получение",
        "action_confirm-return": "✅ Подтвердить возврат",
    }

    const formattedButtons = buttons.map(row => row.map(button => ({ text: buttonLabels[button.text] || button.text })));

    if (buttons.length > 1) {
        await sendComplexMessage(chatId, "👇 Выберите доступное действие:", formattedButtons, { keyboardType: 'reply' });
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

    const actionKey = Object.keys(buttonLabels).find(key => buttonLabels[key] === choice);

    if (!actionKey) {
        if (choice === "🆘 SOS") {
            await sosCommand(chatId, userId);
        } else {
            await sendComplexMessage(chatId, "Действие отменено или не распознано.", [], { removeKeyboard: true });
        }
        return;
    }

    let actionResponse = "Действие в обработке...";
    
    switch(actionKey) {
        case "action_upload-photo-start":
        case "action_upload-photo-end":
            const photoType = actionKey.endsWith('start') ? 'start' : 'end';
            await supabaseAdmin.from('user_states').upsert({ user_id: userId, state: 'awaiting_rental_photo', context: { rental_id: context.rentalId, photo_type: photoType }});
            actionResponse = `Отлично! Теперь просто отправьте фото в этот чат. Я жду...`;
            break;
        case "action_confirm-pickup":
            await confirmVehiclePickup(context.rentalId, userId);
            actionResponse = "Получение транспорта подтверждено!";
            break;
        case "action_confirm-return":
            await confirmVehicleReturn(context.rentalId, userId);
            actionResponse = "Возврат транспорта подтвержден!";
            break;
        default:
            actionResponse = "Неизвестное действие.";
            break;
    }
    
    await sendComplexMessage(chatId, actionResponse, [], { removeKeyboard: true });
}
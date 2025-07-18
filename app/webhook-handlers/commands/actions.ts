"use server";

import { logger } from "@/lib/logger";
import { supabaseAdmin } from "@/hooks/supabase";
import { sendComplexMessage, KeyboardButton } from "../actions/sendComplexMessage";
import { sosCommand } from './sos';
import { confirmVehiclePickup, confirmVehicleReturn } from '@/app/rentals/actions';
import { sendTelegramInvoice } from "@/app/actions";

const buttonLabels: Record<string, string> = {
    "action_upload-photo-start": "📸 Загрузить фото 'ДО'",
    "action_upload-photo-end": "📸 Загрузить фото 'ПОСЛЕ'",
    "action_confirm-pickup": "✅ Подтвердить получение",
    "action_confirm-return": "✅ Подтвердить возврат",
    "action_drop-anywhere": "棄 Я сваливаю (200 XTR)",
    "sos": "🆘 SOS",
    "cancel": "❌ Закрыть"
};

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
        if (error && error.code !== 'PGRST116') logger.error(`[actionsCommand] Error fetching rental context for ${userId}`, error);
        return null;
    }
    
    return { rentalId: data.rental_id, role: data.user_id === userId ? 'renter' : 'owner', status: data.status };
}


export async function actionsCommand(chatId: number, userId: string) {
    logger.info(`[actionsCommand] User ${userId} initiated /actions command.`);
    
    const context = await getRentalContext(userId);

    if (!context) {
        await sendComplexMessage(chatId, "🤔 У вас нет активных аренд, требующих действий.", [], { removeKeyboard: true });
        return;
    }

    const { data: events, error } = await supabaseAdmin.from('events').select('type, status').eq('rental_id', context.rentalId).order('created_at', { ascending: true });
    if (error) {
        logger.error(`[actionsCommand] Error fetching events for rental ${context.rentalId}`, error);
        await sendComplexMessage(chatId, "🚨 Ошибка при получении статуса аренды.", [], { removeKeyboard: true });
        return;
    }

    const buttons: KeyboardButton[][] = [];
    const eventTypes = new Set(events.map(e => e.type));

    if (context.role === 'renter') {
        if (context.status === 'active') {
            if (!eventTypes.has('photo_end')) buttons.push([{ text: buttonLabels["action_upload-photo-end"] }]);
            buttons.push([{ text: buttonLabels["action_drop-anywhere"] }]);
            buttons.push([{ text: buttonLabels["sos"] }]);
        } else if (!eventTypes.has('photo_start')) {
            buttons.push([{ text: buttonLabels["action_upload-photo-start"] }]);
        }
    }

    if (context.role === 'owner') {
        const hasCompletedStartPhoto = events.some(e => e.type === 'photo_start' && e.status === 'completed');
        const hasPickupConfirmed = events.some(e => e.type === 'pickup_confirmed');
        const hasCompletedEndPhoto = events.some(e => e.type === 'photo_end' && e.status === 'completed');

        if (hasCompletedStartPhoto && !hasPickupConfirmed) buttons.push([{ text: buttonLabels["action_confirm-pickup"] }]);
        if (hasCompletedEndPhoto) buttons.push([{ text: buttonLabels["action_confirm-return"] }]);
    }
    
    buttons.push([{ text: buttonLabels["cancel"] }]);

    if (buttons.length > 1) {
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
    
    const actionKey = Object.keys(buttonLabels).find(key => buttonLabels[key] === choice);

    switch(actionKey) {
        case "action_upload-photo-start":
        case "action_upload-photo-end":
            const photoType = actionKey.endsWith('start') ? 'start' : 'end';
            await supabaseAdmin.from('user_states').upsert({ user_id: userId, state: 'awaiting_rental_photo', context: { rental_id: context.rentalId, photo_type: photoType }});
            await sendComplexMessage(chatId, `Отлично! Теперь просто отправьте фото в этот чат. Я жду...`, [], { removeKeyboard: true });
            break;
        case "action_confirm-pickup":
            await confirmVehiclePickup(context.rentalId, userId);
            await sendComplexMessage(chatId, "Получение транспорта подтверждено!", [], { removeKeyboard: true });
            break;
        case "action_confirm-return":
            await confirmVehicleReturn(context.rentalId, userId);
            await sendComplexMessage(chatId, "Возврат транспорта подтвержден!", [], { removeKeyboard: true });
            break;
        case "action_drop-anywhere":
            await sendTelegramInvoice(String(chatId), "Hustle: Drop Anywhere", "Оплата сбора за вызов экипажа для возврата транспорта.", `hustle_dropoff_${context.rentalId}_${Date.now()}`, 20000, 0); // 200 XTR
            await sendComplexMessage(chatId, "Счет на 200 XTR отправлен. После оплаты вы сможете указать геолокацию.", [], { removeKeyboard: true });
            break;
        case "sos":
            await sosCommand(chatId, userId);
            break;
        case "cancel":
            await sendComplexMessage(chatId, "Меню действий закрыто.", [], { removeKeyboard: true });
            break;
        default:
             await sendComplexMessage(chatId, "Неизвестное действие.", [], { removeKeyboard: true });
            break;
    }
}
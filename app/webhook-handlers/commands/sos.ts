"use server";

import { logger } from "@/lib/logger";
import { supabaseAdmin } from "@/hooks/supabase";
import { sendComplexMessage, KeyboardButton } from "../actions/sendComplexMessage";

// This function presents the initial SOS options
export async function sosCommand(chatId: number, userId: string) {
    logger.info(`[SOS Command] User ${userId} initiated /sos command.`);

    // 1. Find the user's most recent *active* rental
    const { data: activeRental, error } = await supabaseAdmin
        .from('rentals')
        .select('rental_id, vehicle_id')
        .eq('user_id', userId)
        .eq('status', 'active')
        .order('created_at', { ascending: false })
        .limit(1)
        .single();
    
    if (error || !activeRental) {
        logger.warn(`[SOS Command] User ${userId} has no active rentals.`, error);
        await sendComplexMessage(chatId, "🚨 У вас нет активных аренд для вызова SOS. Эта команда работает только во время поездки.", []);
        return;
    }

    // 2. Present options via a reply keyboard
    const message = "🚨 *Экстренная Служба VIBE*\n\nЧто случилось? Выбери опцию, и мы оповестим владельца и его экипаж.";
    const buttons: KeyboardButton[][] = [
        [{ text: "⛽️ Запрос Топлива (50 XTR)" }],
        [{ text: "🛠️ Запрос Эвакуации (250 XTR)" }],
        [{ text: "❌ Отмена" }]
    ];

    await sendComplexMessage(chatId, message, buttons, { keyboardType: 'reply' });
}

// This function handles the user's choice from the reply keyboard
export async function handleSosChoice(chatId: number, userId: string, choice: string) {
    logger.info(`[SOS Handler] User ${userId} chose: "${choice}"`);

    // 1. Find the active rental again
    const { data: activeRental, error: rentalError } = await supabaseAdmin
        .from('rentals')
        .select('rental_id')
        .eq('user_id', userId)
        .eq('status', 'active')
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

    if (rentalError || !activeRental) {
        await sendComplexMessage(chatId, "Не удалось найти активную аренду. Операция отменена.", [], { removeKeyboard: true });
        return;
    }
    
    let eventType: string | null = null;
    let xtrAmount: number | null = null;

    if (choice.startsWith("⛽️ Запрос Топлива")) {
        eventType = 'sos_fuel';
        xtrAmount = 50;
    } else if (choice.startsWith("🛠️ Запрос Эвакуации")) {
        eventType = 'sos_evac';
        xtrAmount = 250;
    } else if (choice === "❌ Отмена") {
        await sendComplexMessage(chatId, "Действие отменено.", [], { removeKeyboard: true });
        return;
    } else {
        await sendComplexMessage(chatId, "Неизвестный выбор. Используйте /sos для начала.", [], { removeKeyboard: true });
        return;
    }
    
    // 2. Create the event in the new 'events' table. The DB trigger will handle notifications.
    const { error: eventError } = await supabaseAdmin
        .from('events')
        .insert({
            rental_id: activeRental.rental_id,
            type: eventType,
            status: 'pending',
            payload: { xtr_amount: xtrAmount, reason: "User initiated SOS" },
            created_by: userId
        });

    if (eventError) {
        logger.error(`[SOS Handler] Failed to create event for rental ${activeRental.rental_id}`, eventError);
        await sendComplexMessage(chatId, "🚨 Ошибка при создании запроса. Пожалуйста, попробуйте снова.", [], { removeKeyboard: true });
        return;
    }

    // 3. Confirm to the user and remove the keyboard
    const confirmationMessage = `✅ Ваш запрос отправлен! Владелец и его экипаж будут уведомлены. Ожидайте помощи. Вы можете следить за статусом на странице аренды.`;
    await sendComplexMessage(chatId, confirmationMessage, [], { removeKeyboard: true });
}
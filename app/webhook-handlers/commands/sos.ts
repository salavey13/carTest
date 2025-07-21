"use server";

import { logger } from "@/lib/logger";
import { supabaseAdmin } from "@/hooks/supabase";
import { sendComplexMessage, KeyboardButton, sendTelegramInvoice } from "../actions/sendComplexMessage";

// This function presents the initial SOS options
export async function sosCommand(chatId: number, userId: string) {
    logger.info(`[SOS Command] User ${userId} initiated /sos command.`);

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
        await sendComplexMessage(chatId, "🚨 У вас нет активных аренд для вызова SOS. Эта команда работает только во время поездки.", [], { removeKeyboard: true });
        return;
    }

    const message = "🚨 *Экстренная Служба VIBE*\n\nЧто случилось? Выбери опцию, и мы выставим счет. После оплаты будет отправлено уведомление.";
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
    
    let invoiceType: string | null = null;
    let title: string | null = null;
    let description: string | null = null;
    let xtrAmount: number | null = null;

    if (choice.startsWith("⛽️ Запрос Топлива")) {
        invoiceType = 'sos_fuel';
        title = 'SOS: Доставка Топлива';
        description = 'Оплата за экстренную доставку топлива к вашему местоположению.';
        xtrAmount = 5000; // 50 XTR in cents
    } else if (choice.startsWith("🛠️ Запрос Эвакуации")) {
        invoiceType = 'sos_evac';
        title = 'SOS: Эвакуация';
        description = 'Оплата за вызов эвакуатора для вашего транспортного средства.';
        xtrAmount = 25000; // 250 XTR in cents
    } else if (choice === "❌ Отмена") {
        await sendComplexMessage(chatId, "Действие отменено.", [], { removeKeyboard: true });
        return;
    } else {
        await sendComplexMessage(chatId, "Неизвестный выбор. Используйте /sos для начала.", [], { removeKeyboard: true });
        return;
    }

    // Create an invoice instead of an event
    const invoicePayload = `${invoiceType}_${activeRental.rental_id}_${Date.now()}`;
    await sendTelegramInvoice(
        userId,
        title,
        description,
        invoicePayload,
        xtrAmount
    );

    await sendComplexMessage(chatId, `Счет на ${xtrAmount/100} XTR отправлен. После оплаты владелец и экипаж будут немедленно уведомлены.`, [], { removeKeyboard: true });
}
"use server";

import { logger } from "@/lib/logger";
import { supabaseAdmin } from "@/hooks/supabase";
import { sendComplexMessage } from '@/app/webhook-handlers/actions/sendComplexMessage';
import { KeyboardButton, sendTelegramInvoice } from "@/app/actions";

// This function INITIATES the SOS flow by requesting a location
export async function sosCommand(chatId: number, userId: string) {
    logger.info(`[SOS Command] User ${userId} initiated /sos command.`);

    const { data: activeRental, error } = await supabaseAdmin
        .from('rentals')
        .select('rental_id, vehicle:cars(crew_id)')
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

    if (!activeRental.vehicle?.crew_id) {
        await sendComplexMessage(chatId, "🚨 Не удалось определить экипаж для этого транспорта. SOS временно недоступен.", [], { removeKeyboard: true });
        return;
    }

    // Put user in a state to await their location
    await supabaseAdmin
        .from('user_states')
        .upsert({
            user_id: userId,
            state: 'awaiting_sos_geotag',
            context: { rental_id: activeRental.rental_id, crew_id: activeRental.vehicle.crew_id }
        });

    const message = "🚨 *Экстренная Служба VIBE*\n\nПонял, нужна помощь. Чтобы я мог рассчитать стоимость и оповестить экипаж, пожалуйста, отправь свою геолокацию.\n\nИспользуй скрепку (📎) в Telegram и выбери 'Геопозиция'.";
    await sendComplexMessage(chatId, message, [], { removeKeyboard: true });
}

// This function handles the user's PAYMENT choice from the reply keyboard
export async function handleSosPaymentChoice(chatId: number, userId: string, choice: string) {
    logger.info(`[SOS Handler] User ${userId} chose payment: "${choice}"`);

    const { data: userState, error: stateError } = await supabaseAdmin
        .from('user_states').select('*').eq('user_id', userId).single();

    if (stateError || !userState || userState.state !== 'awaiting_sos_payment_choice') {
        await sendComplexMessage(chatId, "Не удалось найти ваш запрос SOS. Пожалуйста, начните заново с /sos.", [], { removeKeyboard: true });
        return;
    }

    const { rental_id, geotag } = userState.context as { rental_id: string, geotag: {latitude: number, longitude: number} };
    
    // Parse amount from button text like "⛽️ Топливо (150 XTR)"
    const amountMatch = choice.match(/\((\d+)\s*XTR\)/);
    const amount = amountMatch ? parseInt(amountMatch[1], 10) : 0;
    const isFuel = choice.includes('Топливо');
    const type = isFuel ? 'sos_fuel' : 'sos_evac';

    if (amount === 0) { // Handle "No payment" case
        await supabaseAdmin.from('events').insert({
            rental_id,
            type,
            status: 'pending',
            payload: { xtr_amount: 0, reason: "User requested help without payment", geotag },
            created_by: userId
        });
        await supabaseAdmin.from('user_states').delete().eq('user_id', userId);
        await sendComplexMessage(chatId, "✅ Ваша просьба о помощи отправлена! Экипаж уведомлен.", [], { removeKeyboard: true });
        return;
    }

    // Create an invoice for payment
    const invoicePayload = `${type}_${rental_id}_${Date.now()}`;
    const description = `Экстренная помощь для аренды ${rental_id}.`;
    
    // We create the invoice in our DB FIRST
    await supabaseAdmin.from('invoices').insert({
        id: invoicePayload,
        type: type,
        user_id: userId,
        amount: amount,
        status: 'pending',
        subscription_id: rental_id, // Re-using this field for rental_id context
        metadata: { rental_id, geotag }
    });

    await sendTelegramInvoice(userId, choice, description, invoicePayload, amount * 100); // Amount in smallest units for TG
    await sendComplexMessage(chatId, `Счет на ${amount} XTR отправлен. После оплаты экипаж будет немедленно уведомлен.`, [], { removeKeyboard: true });
    
    // Clear state after sending invoice
    await supabaseAdmin.from('user_states').delete().eq('user_id', userId);
}
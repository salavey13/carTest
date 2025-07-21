import { NextRequest, NextResponse } from "next/server";
import { logger } from "@/lib/logger";
import { supabaseAdmin } from "@/hooks/supabase";
import { sendComplexMessage, KeyboardButton } from "@/app/webhook-handlers/actions/sendComplexMessage";
import { handleWebhookProxy } from "@/app/webhook-handlers/proxy";
import { handleCommand } from "@/app/webhook-handlers/commands/command-handler";
import { addRentalPhoto } from "@/app/rentals/actions";

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;

function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number) {
    const R = 6371; // Radius of the earth in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c; // Distance in km
}

async function handlePhotoMessage(message: any) {
    const userId = message.from.id.toString();
    const chatId = message.chat.id;

    const { data: userState, error: stateError } = await supabaseAdmin
        .from('user_states')
        .select('*')
        .eq('user_id', userId)
        .single();
    
    if (stateError || !userState || userState.state !== 'awaiting_rental_photo') {
        logger.info(`[Webhook] Photo from user ${userId} received without 'awaiting_rental_photo' state. Ignoring.`);
        return;
    }
    
    const { rental_id, photo_type } = userState.context as { rental_id: string, photo_type: 'start' | 'end' };
    
    const photo = message.photo[0]; // Telegram sends multiple sizes, 0 is the smallest
    const fileId = photo.file_id;

    try {
        const fileInfoResponse = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getFile?file_id=${fileId}`);
        const fileInfo = await fileInfoResponse.json();
        if (!fileInfo.ok) throw new Error("Failed to get file info from Telegram");

        const fileUrl = `https://api.telegram.org/file/bot${TELEGRAM_BOT_TOKEN}/${fileInfo.result.file_path}`;
        const imageResponse = await fetch(fileUrl);
        const imageBlob = await imageResponse.blob();
        
        const formData = new FormData();
        formData.append('bucketName', 'rentals');
        formData.append('file', imageBlob, `rental_${rental_id}_${photo_type}.jpg`);

        const { uploadSingleImage } = await import('@/app/rentals/actions');
        const uploadResult = await uploadSingleImage(formData);
        if (!uploadResult.success || !uploadResult.url) {
            throw new Error(uploadResult.error || "Failed to upload image to storage.");
        }

        const { error: eventError } = await supabaseAdmin.from('events').insert({
          rental_id: rental_id,
          type: `photo_${photo_type}`,
          created_by: userId,
          payload: { photo_url: uploadResult.url }
        });
        
        if (eventError) {
          throw new Error(`Failed to create photo event: ${eventError.message}`);
        }

        await supabaseAdmin.from('user_states').delete().eq('user_id', userId);
        
        await sendComplexMessage(chatId, `📸 Фото "${photo_type === 'start' ? 'ДО' : 'ПОСЛЕ'}" успешно загружено! Владелец уведомлен.`, [], undefined);

    } catch (error) {
        logger.error(`[Webhook Photo Handler] Error processing photo for user ${userId}:`, error);
        await sendComplexMessage(chatId, `🚨 Ошибка при обработке фото. Попробуйте снова.`, [], undefined);
    }
}

async function handleLocationMessage(message: any) {
    const userId = message.from.id.toString();
    const chatId = message.chat.id;
    const { latitude, longitude } = message.location;

    const { data: userState, error: stateError } = await supabaseAdmin
        .from('user_states').select('*').eq('user_id', userId).single();

    if (stateError || !userState) {
        logger.info(`[Webhook] Location from user ${userId} received without any state. Ignoring.`);
        return;
    }
    
    if (userState.state === 'awaiting_sos_geotag') {
        const { rental_id, crew_id } = userState.context as { rental_id: string, crew_id: string };
        
        try {
            const { data: crewData, error: crewError } = await supabaseAdmin
                .from('crews').select('hq_location').eq('id', crew_id).single();
            if (crewError || !crewData?.hq_location) throw new Error("Could not retrieve crew location.");

            const [hqLat, hqLon] = crewData.hq_location.split(',').map(Number);
            const distance = calculateDistance(latitude, longitude, hqLat, hqLon);

            let buttons: KeyboardButton[][] = [];
            if (distance < 5) { // Close by
                buttons.push([{ text: "⛽️ Топливо (50 XTR)" }]);
                buttons.push([{ text: "🛠️ Эвакуация (150 XTR)" }]);
            } else { // Far away
                buttons.push([{ text: "⛽️ Топливо (200 XTR)" }]);
                buttons.push([{ text: "🛠️ Эвакуация (500 XTR)" }]);
            }
            buttons.push([{ text: "🙏 Помогите, денег нет!"}]);

            await supabaseAdmin.from('user_states').update({
                state: 'awaiting_sos_payment_choice',
                context: { rental_id, geotag: { latitude, longitude } }
            }).eq('user_id', userId);
            
            const messageText = `📍 Геопозиция получена! Вы находитесь примерно в *${distance.toFixed(1)} км* от базы экипажа.\n\nВыберите опцию помощи:`;
            await sendComplexMessage(chatId, messageText, buttons, { keyboardType: 'reply' });

        } catch (error) {
            logger.error(`[Webhook SOS Location] Error processing location for user ${userId}:`, error);
            await sendComplexMessage(chatId, `🚨 Ошибка при обработке геотега. Пожалуйста, попробуйте снова.`, [], undefined);
        }

    } else if (userState.state === 'awaiting_geotag') { // Original Drop Anywhere logic
        const { rental_id, event_id } = userState.context as { rental_id: string, event_id: string };
        try {
            const { error: eventUpdateError } = await supabaseAdmin
                .from('events')
                .update({ payload: { geotag: { latitude, longitude } }, status: 'pending_acceptance' })
                .eq('id', event_id);
            if (eventUpdateError) throw eventUpdateError;
            await supabaseAdmin.from('user_states').delete().eq('user_id', userId);
            await sendComplexMessage(chatId, `📍 Геотег получен! Оповещаем экипаж о месте перехвата. Вы можете оставить транспорт.`, [], undefined);
        } catch (error) {
            logger.error(`[Webhook Location Handler] Error processing location for user ${userId}:`, error);
            await sendComplexMessage(chatId, `🚨 Ошибка при обработке геотега. Пожалуйста, попробуйте снова.`, [], undefined);
        }
    } else {
        logger.info(`[Webhook] Location from user ${userId} received in unhandled state: ${userState.state}. Ignoring.`);
    }
}


export async function POST(request: Request) {
  try {
    const update = await request.json();
    logger.info("[Master Webhook] Received update:", Object.keys(update));

    if (update.pre_checkout_query || update.message?.successful_payment) {
      await handleWebhookProxy(update);
    } else if (update.message?.photo) {
      await handlePhotoMessage(update.message);
    } else if (update.message?.location) {
      await handleLocationMessage(update.message);
    } else if (update.message?.text || update.callback_query) {
      await handleCommand(update);
    } else {
      logger.info("[Master Webhook] Unhandled update type, ignoring.", { keys: Object.keys(update || {}) });
    }

  } catch (error) {
    logger.error("!!! CRITICAL UNHANDLED ERROR IN WEBHOOK, PREVENTING LOOP !!!", error);
    return NextResponse.json({ ok: true, error: "Internal error handled gracefully to prevent webhook loop." }, { status: 200 });
  }

  return NextResponse.json({ ok: true });
}
import { NextRequest, NextResponse } from "next/server";
import { logger } from "@/lib/logger";
import { supabaseAdmin } from "@/hooks/supabase";
import { sendTelegramMessage, uploadSingleImage } from "@/app/actions";
import { handleWebhookProxy } from "@/app/webhook-handlers/proxy";
import { handleCommand } from "@/app/webhook-handlers/commands/command-handler";
import { addRentalPhoto } from "@/app/rentals/actions";

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;

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

        const uploadResult = await uploadSingleImage(formData);
        if (!uploadResult.success || !uploadResult.url) {
            throw new Error(uploadResult.error || "Failed to upload image to storage.");
        }

        // Create an event instead of calling the action directly
        // The DB trigger on the events table will handle the notification and state update
        const { error: eventError } = await supabaseAdmin.from('events').insert({
          rental_id: rental_id,
          type: `photo_${photo_type}`,
          created_by: userId,
          payload: { photo_url: uploadResult.url }
        });
        
        if (eventError) {
          throw new Error(`Failed to create photo event: ${eventError.message}`);
        }

        // Clear the user's state
        await supabaseAdmin.from('user_states').delete().eq('user_id', userId);
        
        await sendTelegramMessage(`📸 Фото "${photo_type === 'start' ? 'ДО' : 'ПОСЛЕ'}" успешно загружено! Владелец уведомлен.`, [], undefined, chatId.toString());

    } catch (error) {
        logger.error(`[Webhook Photo Handler] Error processing photo for user ${userId}:`, error);
        await sendTelegramMessage(`🚨 Ошибка при обработке фото. Попробуйте снова.`, [], undefined, chatId.toString());
    }
}

async function handleLocationMessage(message: any) {
    const userId = message.from.id.toString();
    const chatId = message.chat.id;

    const { data: userState, error: stateError } = await supabaseAdmin
        .from('user_states').select('*').eq('user_id', userId).single();

    if (stateError || !userState || userState.state !== 'awaiting_geotag') {
        logger.info(`[Webhook] Location from user ${userId} received without 'awaiting_geotag' state. Ignoring.`);
        return;
    }

    const { rental_id, event_id } = userState.context as { rental_id: string, event_id: string };
    const { latitude, longitude } = message.location;

    try {
        // Update the event with the geotag and change its status
        const { error: eventUpdateError } = await supabaseAdmin
            .from('events')
            .update({ 
                payload: { geotag: { latitude, longitude } },
                status: 'pending_acceptance'
            })
            .eq('id', event_id);

        if (eventUpdateError) throw eventUpdateError;

        await supabaseAdmin.from('user_states').delete().eq('user_id', userId);

        await sendTelegramMessage(`📍 Геотег получен! Оповещаем экипаж о месте перехвата. Вы можете оставить транспорт.`, [], undefined, chatId.toString());
    } catch (error) {
        logger.error(`[Webhook Location Handler] Error processing location for user ${userId}:`, error);
        await sendTelegramMessage(`🚨 Ошибка при обработке геотега. Пожалуйста, попробуйте снова.`, [], undefined, chatId.toString());
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
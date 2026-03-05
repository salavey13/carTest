import { NextRequest, NextResponse } from "next/server";
import { logger } from "@/lib/logger";
import { supabaseAnon } from "@/hooks/supabase";
import { sendComplexMessage, KeyboardButton } from "@/app/webhook-handlers/actions/sendComplexMessage";
import { handleWebhookProxy } from "@/app/webhook-handlers/proxy";
import { handleCommand } from "@/app/webhook-handlers/commands/command-handler";
import { addRentalPhoto } from "@/app/rentals/actions";

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;

function isCodexCaption(caption: string | undefined) {
    return Boolean(caption?.trim().match(/^\/codex(?:@[\w_]+)?(?:\s|$)/i));
}

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

    const { data: userState, error: stateError } = await supabaseAnon
        .from('user_states')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();

    if (stateError) {
        logger.error(`[Webhook] Failed to load user_state for user ${userId}`, stateError);
        return;
    }

    let rentalIdFromState: string | null = null;
    let photoTypeFromState: 'start' | 'end' | null = null;

    if (userState && userState.state === 'awaiting_rental_photo') {
        const context = userState.context as { rental_id?: string; photo_type?: 'start' | 'end' };
        rentalIdFromState = context?.rental_id ?? null;
        photoTypeFromState = context?.photo_type ?? null;
    }

    if (!rentalIdFromState || !photoTypeFromState) {
        const { data: rentals, error: rentalsError } = await supabaseAnon
            .from('rentals')
            .select('rental_id, status, created_at')
            .eq('user_id', userId)
            .in('status', ['pending_confirmation', 'confirmed', 'active'])
            .order('created_at', { ascending: false })
            .limit(12);

        if (rentalsError) {
            logger.error(`[Webhook] Failed to auto-resolve rental for photo message ${userId}`, rentalsError);
            await sendComplexMessage(chatId, '🚨 Не удалось определить активную аренду. Нажмите /actions и выберите шаг с фото.', [], undefined);
            return;
        }

        let resolved: { rental_id: string; photo_type: 'start' | 'end' } | null = null;
        for (const rental of rentals ?? []) {
            const { data: events } = await supabaseAnon
                .from('events')
                .select('type, status')
                .eq('rental_id', rental.rental_id);

            const hasCompletedStart = (events || []).some((e) => e.type === 'photo_start' && e.status === 'completed');
            const hasCompletedEnd = (events || []).some((e) => e.type === 'photo_end' && e.status === 'completed');

            if (rental.status === 'active' && !hasCompletedEnd) {
                resolved = { rental_id: rental.rental_id, photo_type: 'end' };
                break;
            }

            if ((rental.status === 'pending_confirmation' || rental.status === 'confirmed') && !hasCompletedStart) {
                resolved = { rental_id: rental.rental_id, photo_type: 'start' };
                break;
            }
        }

        if (!resolved) {
            logger.info(`[Webhook] Photo from user ${userId} received without resolvable rental context.`);
            await sendComplexMessage(chatId, '🤔 Не удалось найти шаг с ожидаемым фото. Откройте /actions и выберите нужное действие.', [], undefined);
            return;
        }

        rentalIdFromState = resolved.rental_id;
        photoTypeFromState = resolved.photo_type;

        await supabaseAnon.from('user_states').upsert({
            user_id: userId,
            state: 'awaiting_rental_photo',
            context: resolved,
            expires_at: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
        });
    }

    if (userState.expires_at && new Date(userState.expires_at).getTime() < Date.now()) {
        await supabaseAnon.from('user_states').delete().eq('user_id', userId);
        await sendComplexMessage(chatId, '⌛️ Режим загрузки фото истек. Нажмите /actions и запустите шаг снова.', [], undefined);
        return;
    }

    const rental_id = rentalIdFromState;
    const photo_type = photoTypeFromState;

    const photo = message.photo?.[message.photo.length - 1]; // берем самый большой размер
    if (!photo?.file_id) {
        await sendComplexMessage(chatId, '🚨 Не удалось прочитать фото. Отправьте изображение ещё раз.', [], undefined);
        return;
    }

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

        const { error: eventError } = await supabaseAnon.from('events').insert({
          rental_id: rental_id,
          type: `photo_${photo_type}`,
          status: 'completed',
          created_by: userId,
          payload: { photo_url: uploadResult.url }
        });
        
        if (eventError) {
          throw new Error(`Failed to create photo event: ${eventError.message}`);
        }

        await supabaseAnon.from('user_states').delete().eq('user_id', userId);
        
        await sendComplexMessage(chatId, `📸 Фото "${photo_type === 'start' ? 'ДО' : 'ПОСЛЕ'}" успешно загружено для аренды ${rental_id.slice(0, 8)}. Владелец уведомлен.`, [], undefined);

    } catch (error) {
        logger.error(`[Webhook Photo Handler] Error processing photo for user ${userId}:`, error);
        await sendComplexMessage(chatId, `🚨 Ошибка при обработке фото. Попробуйте снова.`, [], undefined);
    }
}

// --- ИЗМЕНЕНО: Эта функция теперь является универсальным обработчиком геолокации ---
async function handleLocationMessage(message: any) {
    const userId = message.from.id.toString();
    const chatId = message.chat.id;
    const { latitude, longitude } = message.location;

    // --- ДОБАВЛЕНО: Сценарий 1 - Обновление геолокации члена экипажа на смене ---
    try {
        const { data: member, error: memberError } = await supabaseAnon
            .from('crew_members')
            .select('live_status')
            .eq('user_id', userId)
            .eq('membership_status', 'active')
            .single();
        
        if (memberError && memberError.code !== 'PGRST116') throw memberError;

        // Если участник в статусе 'riding', обновляем его геолокацию и прекращаем дальнейшую обработку.
        if (member && member.live_status === 'riding') {
            const { error: updateError } = await supabaseAnon
                .from('crew_members')
                .update({ last_location: `POINT(${longitude} ${latitude})` })
                .eq('user_id', userId);
            
            if (updateError) throw updateError;
            logger.info(`[Shift Location Update] Updated location for riding user ${userId}`);
            // Важно: выходим из функции, так как задача выполнена.
            return; 
        }
    } catch (error) {
        // Не фатально. Просто логируем и позволяем коду перейти к проверке состояний.
        logger.error(`[Shift Location Check] Could not check/update rider status for user ${userId}`, error);
    }

    // --- Сценарий 2 и 3: Обработка на основе состояния пользователя (user_states) ---
    const { data: userState, error: stateError } = await supabaseAnon
        .from('user_states').select('*').eq('user_id', userId).single();

    // Если состояния нет (и это не райдер на смене), то игнорируем.
    if (stateError || !userState) {
        logger.info(`[Webhook] Location from user ${userId} received without any state or active 'riding' status. Ignoring.`);
        return;
    }
    
    // Сценарий 2: Пользователь отправляет геоточку для SOS
    if (userState.state === 'awaiting_sos_geotag') {
        const { rental_id, crew_id } = userState.context as { rental_id: string, crew_id: string };
        
        try {
            const { data: crewData, error: crewError } = await supabaseAnon
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

            await supabaseAnon.from('user_states').update({
                state: 'awaiting_sos_payment_choice',
                context: { rental_id, geotag: { latitude, longitude } }
            }).eq('user_id', userId);
            
            const messageText = `📍 Геопозиция получена! Вы находитесь примерно в *${distance.toFixed(1)} км* от базы экипажа.\n\nВыберите опцию помощи:`;
            await sendComplexMessage(chatId, messageText, buttons, { keyboardType: 'reply' });

        } catch (error) {
            logger.error(`[Webhook SOS Location] Error processing location for user ${userId}:`, error);
            await sendComplexMessage(chatId, `🚨 Ошибка при обработке геотега. Пожалуйста, попробуйте снова.`, [], undefined);
        }

    // Сценарий 3: Пользователь отправляет геоточку для "Бросить где угодно"
    } else if (userState.state === 'awaiting_geotag') { 
        const { rental_id, event_id } = userState.context as { rental_id: string, event_id: string };
        try {
            const { error: eventUpdateError } = await supabaseAnon
                .from('events')
                .update({ payload: { geotag: { latitude, longitude } }, status: 'pending_acceptance' })
                .eq('id', event_id);
            if (eventUpdateError) throw eventUpdateError;
            await supabaseAnon.from('user_states').delete().eq('user_id', userId);
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
    } else if ((update.message?.photo && isCodexCaption(update.message?.caption)) || (update.message?.document && isCodexCaption(update.message?.caption))) {
      await handleCommand(update);
    } else if (update.message?.photo) {
      await handlePhotoMessage(update.message);
    } else if (update.message?.location) {
      await handleLocationMessage(update.message);
    // --- ЗАКОММЕНТИРОВАНО: Обработка "живых" геоточек отключена для экономии ресурсов Supabase ---
    // } else if (update.edited_message?.location) {
    //   await handleLocationMessage(update.edited_message);
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

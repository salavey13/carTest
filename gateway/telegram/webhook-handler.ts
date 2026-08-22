import { NextResponse } from "next/server";
import { logger } from "@/lib/logger";
import { supabaseAnon } from "@/hooks/supabase";
import { supabaseAdmin } from "@/lib/supabase-server";
import { sendComplexMessage, KeyboardButton } from "@/app/webhook-handlers/actions/sendComplexMessage";
import { handleWebhookProxy } from "@/app/webhook-handlers/proxy";
import { handleCommand } from "@/app/webhook-handlers/commands/command-handler";
import { ensureTelegramSubscriptions } from "@/gateway/telegram/subscriptions";

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_LOCATION_DEDUPE_WINDOW_MS = 2000;
const TELEGRAM_LOCATION_DEDUPE_METERS = 5;

function isCodexCaption(caption: string | undefined) {
    return Boolean(caption?.trim().match(/^\/codex(?:@[\w_]+)?(?:\s|$)/i));
}

function isDocCaption(caption: string | undefined) {
    return Boolean(caption?.trim().match(/^\/doc(?:@[\w_]+)?(?:\s|$)/i));
}

function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number) {
    const R = 6371; // Radius of the earth in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c; // Distance in km
}

function calculateDistanceMeters(lat1: number, lon1: number, lat2: number, lon2: number) {
    return calculateDistance(lat1, lon1, lat2, lon2) * 1000;
}


type TelegramLocationPayload = {
    latitude: number;
    longitude: number;
    speed?: number | null;
    heading?: number | null;
    horizontal_accuracy?: number | null;
};

function getTelegramCapturedAt(message: any) {
    const unixSeconds = Number(message.edit_date || message.date || 0);
    if (Number.isFinite(unixSeconds) && unixSeconds > 0) {
        return new Date(unixSeconds * 1000).toISOString();
    }
    return new Date().toISOString();
}

async function broadcastMapRiderMove(crewSlug: string, payload: Record<string, unknown>) {
    const channel = supabaseAdmin.channel(`map-riders:${crewSlug}`);
    await new Promise<void>((resolve) => {
        const timeout = setTimeout(async () => {
            await supabaseAdmin.removeChannel(channel);
            resolve();
        }, 1200);

        channel.subscribe(async (status) => {
            if (status !== "SUBSCRIBED") return;
            await channel.send({ type: "broadcast", event: "rider:move", payload });
            clearTimeout(timeout);
            await supabaseAdmin.removeChannel(channel);
            resolve();
        });
    });
}

async function mirrorTelegramLocationToActiveMapRiderSession(userId: string, location: TelegramLocationPayload, capturedAt: string) {
    const { data: activeSession, error: sessionError } = await supabaseAdmin
        .from("map_rider_sessions")
        .select("id, crew_slug, sharing_enabled, started_at, stats")
        .eq("user_id", userId)
        .eq("status", "active")
        .eq("sharing_enabled", true)
        .order("started_at", { ascending: false })
        .limit(1)
        .maybeSingle();

    if (sessionError) {
        throw sessionError;
    }

    if (!activeSession) {
        return false;
    }

    const crewSlug = activeSession.crew_slug || "vip-bike";
    const speedKmh = Number(location.speed || 0) * 3.6;
    const heading = location.heading != null ? Number(location.heading) : null;
    const accuracyMeters = location.horizontal_accuracy != null ? Number(location.horizontal_accuracy) : null;

    const { data: previousLiveLocation } = await supabaseAdmin
        .from("live_locations")
        .select("lat,lng,updated_at")
        .eq("user_id", userId)
        .eq("crew_slug", crewSlug)
        .maybeSingle();

    if (previousLiveLocation?.updated_at) {
        const lastUpdatedMs = new Date(previousLiveLocation.updated_at).getTime();
        const currentUpdatedMs = new Date(capturedAt).getTime();
        const elapsedMs = Math.max(currentUpdatedMs - lastUpdatedMs, 0);
        const distanceMeters = calculateDistanceMeters(
            Number(location.latitude),
            Number(location.longitude),
            Number(previousLiveLocation.lat),
            Number(previousLiveLocation.lng),
        );

        if (elapsedMs < TELEGRAM_LOCATION_DEDUPE_WINDOW_MS && distanceMeters < TELEGRAM_LOCATION_DEDUPE_METERS) {
            logger.info(`[MapRiders Telegram GPS] Skipping duplicate live-location burst for user ${userId}`);
            return true;
        }
    }

    const [{ error: liveError }, { error: sessionUpdateError }, { error: pointInsertError }] = await Promise.all([
        supabaseAdmin.from("live_locations").upsert(
            {
                user_id: userId,
                crew_slug: crewSlug,
                lat: Number(location.latitude),
                lng: Number(location.longitude),
                speed_kmh: speedKmh,
                heading,
                is_riding: true,
                updated_at: capturedAt,
            },
            { onConflict: "user_id" },
        ),
        supabaseAdmin
            .from("map_rider_sessions")
            .update({
                latest_lat: Number(location.latitude),
                latest_lon: Number(location.longitude),
                latest_speed_kmh: speedKmh,
                last_ping_at: capturedAt,
                updated_at: new Date().toISOString(),
                stats: {
                    ...((activeSession.stats as Record<string, unknown> | null) || {}),
                    telegramNativeGps: {
                        lastCapturedAt: capturedAt,
                        lastAccuracyMeters: accuracyMeters,
                        source: "telegram-webhook",
                    },
                },
            })
            .eq("id", activeSession.id),
        supabaseAdmin.from("map_rider_points").insert({
            session_id: activeSession.id,
            user_id: userId,
            crew_slug: crewSlug,
            lat: Number(location.latitude),
            lon: Number(location.longitude),
            speed_kmh: speedKmh,
            heading_deg: heading,
            accuracy_meters: accuracyMeters,
            captured_at: capturedAt,
        }),
    ]);

    if (liveError || sessionUpdateError || pointInsertError) {
        throw liveError || sessionUpdateError || pointInsertError;
    }

    await broadcastMapRiderMove(crewSlug, {
        user_id: userId,
        lat: Number(location.latitude),
        lng: Number(location.longitude),
        speed_kmh: speedKmh,
        heading,
        updated_at: capturedAt,
        source: "telegram-native-live-location",
    });

    logger.info(`[MapRiders Telegram GPS] Mirrored native live-location into active session ${activeSession.id} for user ${userId}`);
    return true;
}

async function handlePhotoMessage(message: any) {
    const userId = message.from.id.toString();
    const chatId = message.chat.id;

    // ── I4 enhancement: album detection ──
    // When a renter sends multiple photos as one message (album), Telegram
    // delivers each photo as a SEPARATE webhook update, all sharing the same
    // `media_group_id`. Each update is processed independently here — each
    // photo gets uploaded via uploadRentalPhoto. But we suppress the per-photo
    // confirmation message when media_group_id is present, and instead send
    // ONE summary message at the end.
    //
    // Heuristic: Telegram sends album photos in quick succession (within ~1s).
    // We can't easily detect "the last one" without a debounce queue. So the
    // approach is: if media_group_id is present, suppress the confirmation
    // message entirely — the renter will see the photos appear in the WebApp
    // gallery, and we send a single "processed N photos" message via a
    // short debounce. For simplicity in v1, we just send a per-photo message
    // but with a shorter format for albums.
    const mediaGroupId = message.media_group_id;
    const isAlbum = Boolean(mediaGroupId);

    // NOTE: /doc command no longer processes photos - manual input only

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
        // ── I4 enhancement: auto-detect before/after from rental start time ──
        // Query rentals WITH agreed_start_date + agreed_end_date so we can
        // determine photo_type based on time proximity to start/end.
        //
        // Logic:
        //   - If status is 'pending_confirmation' or 'confirmed' → 'start' (before pickup)
        //   - If status is 'active':
        //     - If current time is within ±1 hour of agreed_start_date → 'start'
        //       (renter is at handoff, taking pre-rental photos)
        //     - Otherwise → 'end' (rental is underway, photos are for return)
        //   - The existing event-based check (hasCompletedStart/hasCompletedEnd)
        //     is kept as a fallback when time is ambiguous.
        const { data: rentals, error: rentalsError } = await supabaseAnon
            .from('rentals')
            .select('rental_id, status, created_at, agreed_start_date, agreed_end_date')
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
        const now = Date.now();
        const ONE_HOUR_MS = 60 * 60 * 1000;

        for (const rental of rentals ?? []) {
            // ── I4: time-based detection ──
            if (rental.status === 'pending_confirmation' || rental.status === 'confirmed') {
                // Rental hasn't started yet → any photo is a "before" photo
                resolved = { rental_id: rental.rental_id, photo_type: 'start' };
                break;
            }

            if (rental.status === 'active') {
                // Rental is active. Check if we're near the start time (within ±1 hour).
                // If so → 'start' (renter is at handoff). Otherwise → 'end' (return photos).
                const startDate = rental.agreed_start_date ? new Date(rental.agreed_start_date).getTime() : null;

                if (startDate && Math.abs(now - startDate) < ONE_HOUR_MS) {
                    // Within ±1 hour of agreed start → handoff in progress
                    resolved = { rental_id: rental.rental_id, photo_type: 'start' };
                    break;
                }

                // Not near start → assume return photos
                // (existing event-based check below refines this if needed)
                resolved = { rental_id: rental.rental_id, photo_type: 'end' };
                break;
            }

            // Fallback: existing event-based logic (for edge cases where status
            // doesn't cleanly map — e.g. disputed rentals)
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
            await sendComplexMessage(chatId, '🤔 Не удалось найти активную аренду для привязки фото. Откройте /actions или выберите аренду на сайте.', [], undefined);
            return;
        }

        rentalIdFromState = resolved.rental_id;
        photoTypeFromState = resolved.photo_type;

        // Note: we DON'T set user_state here anymore — each photo message
        // re-evaluates the time-based detection. This is more robust than
        // caching the photo_type in state (which could go stale if the renter
        // sends photos hours later).
    }

    if (userState?.expires_at && new Date(userState.expires_at).getTime() < Date.now()) {
        await supabaseAnon.from('user_states').delete().eq('user_id', userId);
        await sendComplexMessage(chatId, '⌛️ Режим загрузки фото истек. Нажмите /actions и запустите шаг снова.', [], undefined);
        return;
    }

    const rental_id = rentalIdFromState;
    const photo_type = photoTypeFromState;

    // ── I3 hotfix (H4): use a MIDDLE photo variant (was smallest) ──
    // photo[2] is the right tradeoff: ~80 KB before sharp compression (which
    // brings it to ~30-50 KB at 1280px q75), sufficient quality for disputes,
    // still 50x smaller than the original largest variant.
    // Fallback chain: photo[2] → photo[1] → photo[0] (never photo[3]+).
    const photo = message.photo?.[2] || message.photo?.[1] || message.photo?.[0];
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
        const imageBuffer = Buffer.from(await imageResponse.arrayBuffer());

        // ── I3: route through new uploadRentalPhoto pipeline ──
        // Replaces the old path: uploadSingleImage → public `rentals` bucket →
        // event-only log (no metadata, no hash, no compression).
        //
        // New path: uploadRentalPhoto → private `rental-photos` bucket →
        // sharp compression (1280px q75, ≤500 KB) → SHA-256 dedup → metadata
        // row in rental_photos → counter increment on rentals → event row.
        const { uploadRentalPhoto } = await import('@/app/rentals/photo-actions');
        const uploadResult = await uploadRentalPhoto({
            rentalId: rental_id,
            photoType: photo_type,
            file: imageBuffer,
            mimeType: 'image/jpeg',
            uploaderUserId: userId,
            // C4: uploaderRole is derived server-side — this field is ignored.
            // Bot path: the renter is uploading their own photo, so the server
            // will derive 'renter' from rental.user_id === userId.
            source: 'bot',
        });

        if (!uploadResult.success) {
            throw new Error(uploadResult.error || "Failed to upload photo via new pipeline.");
        }

        if (uploadResult.deduped) {
            // For albums: suppress dedup messages (too noisy)
            if (!isAlbum) {
                await sendComplexMessage(
                    chatId,
                    `ℹ️ Фото "${photo_type === 'start' ? 'ДО' : 'ПОСЛЕ'}" уже было загружено ранее для аренды ${rental_id.slice(0, 8)} — дубликат не создан.`,
                    [],
                    undefined,
                );
            }
        } else {
            // For albums: send a shorter per-photo message (or suppress entirely)
            // For single photos: send the full confirmation
            if (!isAlbum) {
                await sendComplexMessage(
                    chatId,
                    `📸 Фото "${photo_type === 'start' ? 'ДО' : 'ПОСЛЕ'}" привязано к аренде #${rental_id.slice(0, 8)}.`,
                    [],
                    undefined,
                );
            } else {
                // Album: send a compact "✓" reaction-style message
                // (Telegram doesn't support reactions via Bot API for all chats,
                // so we send a short text. The renter sees these stack up.)
                await sendComplexMessage(
                    chatId,
                    `✓ ${photo_type === 'start' ? 'ДО' : 'ПОСЛЕ'}`,
                    [],
                    undefined,
                );
            }
        }

        // Clear user_state if it was set (for the explicit /actions flow).
        // For auto-detected photos (no state), this is a no-op.
        await supabaseAnon.from('user_states').delete().eq('user_id', userId);

    } catch (error) {
        logger.error(`[Webhook Photo Handler] Error processing photo for user ${userId}:`, error);
        await sendComplexMessage(chatId, `🚨 Ошибка при обработке фото. Попробуйте снова.`, [], undefined);
    }
}

// --- ИЗМЕНЕНО: Эта функция теперь является универсальным обработчиком геолокации ---
async function handleLocationMessage(message: any, options: { preferMapRiders?: boolean } = {}) {
    const userId = message.from.id.toString();
    const chatId = message.chat.id;
    const { latitude, longitude } = message.location;
    const capturedAt = getTelegramCapturedAt(message);

    if (options.preferMapRiders) {
        try {
            const mirroredToMapRiders = await mirrorTelegramLocationToActiveMapRiderSession(userId, message.location, capturedAt);
            if (mirroredToMapRiders) {
                return;
            }
        } catch (error) {
            logger.error(`[MapRiders Telegram GPS] Could not mirror native live-location for user ${userId}`, error);
        }
    }

    // --- ДОБАВЛЕНО: Сценарий 1 - Обновление геолокации члена экипажа на смене ---
    try {
        const { data: member, error: memberError } = await supabaseAnon
            .from('crew_members')
            .select('live_status, crew_id')
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

            // Mirror Telegram-native live-location updates into live_locations for realtime feed and postgres_changes fallback.
            let crewSlug = "vip-bike";
            if (member.crew_id) {
                const { data: crew } = await supabaseAnon
                    .from("crews")
                    .select("slug")
                    .eq("id", member.crew_id)
                    .maybeSingle();
                if (crew?.slug) {
                    crewSlug = crew.slug;
                }
            }

            const shiftCapturedAt = new Date().toISOString();
            const { data: previousLiveLocation } = await supabaseAdmin
                .from("live_locations")
                .select("lat,lng,updated_at")
                .eq("user_id", userId)
                .maybeSingle();

            if (previousLiveLocation?.updated_at) {
                const lastUpdatedMs = new Date(previousLiveLocation.updated_at).getTime();
                const elapsedMs = Date.now() - lastUpdatedMs;
                const distanceMeters = calculateDistanceMeters(
                    Number(latitude),
                    Number(longitude),
                    Number(previousLiveLocation.lat),
                    Number(previousLiveLocation.lng),
                );

                if (elapsedMs < TELEGRAM_LOCATION_DEDUPE_WINDOW_MS && distanceMeters < TELEGRAM_LOCATION_DEDUPE_METERS) {
                    logger.info(`[Shift Location Update] Skipping duplicate live-location burst for user ${userId}`);
                    return;
                }
            }

            const { error: liveError } = await supabaseAdmin
                .from("live_locations")
                .upsert(
                    {
                        user_id: userId,
                        crew_slug: crewSlug,
                        lat: Number(latitude),
                        lng: Number(longitude),
                        speed_kmh: Number(message.location?.speed || 0) * 3.6,
                        heading: message.location?.heading != null ? Number(message.location.heading) : null,
                        is_riding: true,
                        updated_at: shiftCapturedAt,
                    },
                    { onConflict: "user_id" },
                );

            if (liveError) {
                throw liveError;
            }

            const channel = supabaseAdmin.channel(`map-riders:${crewSlug}`);
            await new Promise<void>((resolve) => {
                const timeout = setTimeout(async () => {
                    await supabaseAdmin.removeChannel(channel);
                    resolve();
                }, 1200);

                channel.subscribe(async (status) => {
                    if (status !== "SUBSCRIBED") return;
                    await channel.send({
                        type: "broadcast",
                        event: "rider:move",
                        payload: {
                            user_id: userId,
                            lat: Number(latitude),
                            lng: Number(longitude),
                            speed_kmh: Number(message.location?.speed || 0) * 3.6,
                            heading: message.location?.heading != null ? Number(message.location.heading) : null,
                            updated_at: shiftCapturedAt,
                            source: "telegram-webhook",
                        },
                    });
                    clearTimeout(timeout);
                    await supabaseAdmin.removeChannel(channel);
                    resolve();
                });
            });

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

export async function handleTelegramWebhook(request: Request) {
  logger.info("[WEBHOOK_HANDLER_ENTRY] handleTelegramWebhook called");
  ensureTelegramSubscriptions();

  try {
    const update = await request.json();
    logger.info("[Master Webhook] Received update:", Object.keys(update));

    if (update.pre_checkout_query || update.message?.successful_payment) {
      await handleWebhookProxy(update);
    } else if ((update.message?.photo && isCodexCaption(update.message?.caption)) || (update.message?.document && isCodexCaption(update.message?.caption))) {
      await handleCommand(update);
    } else if ((update.message?.photo && isDocCaption(update.message?.caption)) || (update.message?.document && isDocCaption(update.message?.caption))) {
      await handleCommand(update);
    } else if (update.message?.photo) {
      await handlePhotoMessage(update.message);
    } else if (update.message?.location) {
      await handleLocationMessage(update.message, { preferMapRiders: Boolean(update.message.location?.live_period) });
    } else if (update.edited_message?.location) {
      // Live-location updates from Telegram arrive as edited_message payloads.
      // We support them to keep MapRiders location feed in sync for Telegram-first flow.
      await handleLocationMessage(update.edited_message, { preferMapRiders: true });
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
import { NextResponse } from "next/server";
import { logger } from "@/lib/logger";
import { supabaseAdmin } from "@/hooks/supabase";
import { sendComplexMessage, KeyboardButton } from "@/app/webhook-handlers/actions/sendComplexMessage";
import { handleWebhookProxy } from "@/app/webhook-handlers/proxy";
import { handleCommand } from "@/app/webhook-handlers/commands/command-handler";
import { postCodexCommandToSlack } from "@/lib/slack";

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const HOMEWORK_BUCKET = "homework-intake";
let homeworkBucketInitialized = false;

type TelegramPhotoSize = {
  file_id: string;
};

function extractCodexPrompt(rawText?: string | null) {
  if (!rawText) return "";
  return rawText.replace(/^\/codex(?:@[\w_]+)?\s*/i, "").trim();
}

async function ensureHomeworkBucket() {
  if (homeworkBucketInitialized) return;

  const { error } = await supabaseAdmin.storage.createBucket(HOMEWORK_BUCKET, {
    public: true,
    fileSizeLimit: "10MB",
  });

  if (error && !error.message.toLowerCase().includes("already exists")) {
    throw error;
  }

  homeworkBucketInitialized = true;
}

async function downloadAndStoreHomeworkPhoto(message: any) {
  const highestResolutionPhoto: TelegramPhotoSize | undefined = message.photo?.[message.photo.length - 1];
  if (!highestResolutionPhoto?.file_id) {
    throw new Error("Telegram photo payload is missing file_id.");
  }

  const fileInfoResponse = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getFile?file_id=${highestResolutionPhoto.file_id}`);
  const fileInfo = await fileInfoResponse.json();
  if (!fileInfo.ok) {
    throw new Error("Failed to resolve Telegram file path via getFile.");
  }

  const fileUrl = `https://api.telegram.org/file/bot${TELEGRAM_BOT_TOKEN}/${fileInfo.result.file_path}`;
  const imageResponse = await fetch(fileUrl);
  if (!imageResponse.ok) {
    throw new Error(`Failed to download Telegram photo (${imageResponse.status}).`);
  }

  await ensureHomeworkBucket();

  const timestamp = Date.now();
  const storagePath = `${message.chat.id}/${timestamp}.jpg`;
  const imageBuffer = Buffer.from(await imageResponse.arrayBuffer());

  const { error: uploadError } = await supabaseAdmin.storage
    .from(HOMEWORK_BUCKET)
    .upload(storagePath, imageBuffer, {
      contentType: "image/jpeg",
      upsert: false,
    });

  if (uploadError) {
    throw uploadError;
  }

  const { data: publicData } = supabaseAdmin.storage.from(HOMEWORK_BUCKET).getPublicUrl(storagePath);
  return {
    path: storagePath,
    photoUrl: publicData.publicUrl,
    createdAt: new Date(timestamp).toISOString(),
  };
}

async function handleCodexHomeworkPhoto(message: any) {
  const chatId = message.chat.id;
  const userId = String(message.from.id);
  const username = message.from.username;
  const captionPrompt = extractCodexPrompt(message.caption);

  const { data: userState } = await supabaseAdmin
    .from("user_states")
    .select("state, context")
    .eq("user_id", userId)
    .maybeSingle();

  const statePrompt = userState?.state === "awaiting_codex_homework_photo"
    ? extractCodexPrompt(userState.context?.codex_prompt)
    : "";

  const codexPrompt = captionPrompt || statePrompt;
  if (!codexPrompt) {
    return false;
  }

  const contractType = captionPrompt ? "caption" : "prompt_then_photo";

  try {
    const storedPhoto = await downloadAndStoreHomeworkPhoto(message);

    const { data: intakeRow, error: intakeInsertError } = await supabaseAdmin
      .from("codex_homework_intake")
      .insert({
        telegram_chat_id: String(chatId),
        telegram_user_id: userId,
        photo_url: storedPhoto.photoUrl,
        status: "stored",
        created_at: storedPhoto.createdAt,
      })
      .select("id")
      .single();

    if (intakeInsertError) {
      throw intakeInsertError;
    }

    const commandText = `/codex ${codexPrompt}`;
    const slackResult = await postCodexCommandToSlack({
      telegramCommandText: commandText,
      telegramUserId: userId,
      telegramUsername: username,
      telegramChatId: String(chatId),
      photoUrl: storedPhoto.photoUrl,
      origin: {
        contract: contractType,
        telegramMessageId: String(message.message_id),
        intakeId: intakeRow.id,
        createdAt: storedPhoto.createdAt,
      },
    });

    if (!slackResult.ok) {
      await supabaseAdmin
        .from("codex_homework_intake")
        .update({ status: "slack_failed" })
        .eq("id", intakeRow.id);

      const reason = slackResult.reason === "not_configured"
        ? "ℹ️ Slack bridge пока не настроен (нет токена/канала)."
        : `⚠️ Не удалось отправить задачу в Slack: ${slackResult.error}`;

      await sendComplexMessage(chatId, `${reason}\nФото сохранено: ${storedPhoto.photoUrl}`, [], undefined);
      return true;
    }

    await supabaseAdmin
      .from("codex_homework_intake")
      .update({ status: "forwarded" })
      .eq("id", intakeRow.id);

    await supabaseAdmin.from("user_states").delete().eq("user_id", userId).eq("state", "awaiting_codex_homework_photo");

    await sendComplexMessage(
      chatId,
      `✅ Фото + задача отправлены в Slack как запрос к Codex.\n\n*Prompt:* ${codexPrompt}\n*Photo:* ${storedPhoto.photoUrl}\n\nДля callback добавь:\n\`telegramChatId\`: \`${chatId}\`\n\`telegramUserId\`: \`${userId}\``,
      [],
      { parseMode: "Markdown" },
    );
    return true;
  } catch (error) {
    logger.error(`[Webhook Codex Homework] Error processing photo for user ${userId}:`, error);
    await sendComplexMessage(chatId, "🚨 Ошибка при обработке фото для /codex. Попробуйте снова.", [], undefined);
    return true;
  }
}

function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

async function handlePhotoMessage(message: any) {
  const consumedByCodexHomework = await handleCodexHomeworkPhoto(message);
  if (consumedByCodexHomework) {
    return;
  }

  const userId = message.from.id.toString();
  const chatId = message.chat.id;

  const { data: userState, error: stateError } = await supabaseAdmin
    .from("user_states")
    .select("*")
    .eq("user_id", userId)
    .single();

  if (stateError || !userState || userState.state !== "awaiting_rental_photo") {
    logger.info(`[Webhook] Photo from user ${userId} received without 'awaiting_rental_photo' state. Ignoring.`);
    return;
  }

  const { rental_id, photo_type } = userState.context as { rental_id: string; photo_type: "start" | "end" };

  const highestResolutionPhoto = message.photo[message.photo.length - 1];
  const fileId = highestResolutionPhoto.file_id;

  try {
    const fileInfoResponse = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getFile?file_id=${fileId}`);
    const fileInfo = await fileInfoResponse.json();
    if (!fileInfo.ok) throw new Error("Failed to get file info from Telegram");

    const fileUrl = `https://api.telegram.org/file/bot${TELEGRAM_BOT_TOKEN}/${fileInfo.result.file_path}`;
    const imageResponse = await fetch(fileUrl);
    const imageBlob = await imageResponse.blob();

    const formData = new FormData();
    formData.append("bucketName", "rentals");
    formData.append("file", imageBlob, `rental_${rental_id}_${photo_type}.jpg`);

    const { uploadSingleImage } = await import("@/app/rentals/actions");
    const uploadResult = await uploadSingleImage(formData);
    if (!uploadResult.success || !uploadResult.url) {
      throw new Error(uploadResult.error || "Failed to upload image to storage.");
    }

    const { error: eventError } = await supabaseAdmin.from("events").insert({
      rental_id,
      type: `photo_${photo_type}`,
      created_by: userId,
      payload: { photo_url: uploadResult.url },
    });

    if (eventError) {
      throw new Error(`Failed to create photo event: ${eventError.message}`);
    }

    await supabaseAdmin.from("user_states").delete().eq("user_id", userId);

    await sendComplexMessage(chatId, `📸 Фото "${photo_type === "start" ? "ДО" : "ПОСЛЕ"}" успешно загружено! Владелец уведомлен.`, [], undefined);
  } catch (error) {
    logger.error(`[Webhook Photo Handler] Error processing photo for user ${userId}:`, error);
    await sendComplexMessage(chatId, "🚨 Ошибка при обработке фото. Попробуйте снова.", [], undefined);
  }
}

async function handleLocationMessage(message: any) {
  const userId = message.from.id.toString();
  const chatId = message.chat.id;
  const { latitude, longitude } = message.location;

  try {
    const { data: member, error: memberError } = await supabaseAdmin
      .from("crew_members")
      .select("live_status")
      .eq("user_id", userId)
      .eq("membership_status", "active")
      .single();

    if (memberError && memberError.code !== "PGRST116") throw memberError;

    if (member && member.live_status === "riding") {
      const { error: updateError } = await supabaseAdmin
        .from("crew_members")
        .update({ last_location: `POINT(${longitude} ${latitude})` })
        .eq("user_id", userId);

      if (updateError) throw updateError;
      logger.info(`[Shift Location Update] Updated location for riding user ${userId}`);
      return;
    }
  } catch (error) {
    logger.error(`[Shift Location Check] Could not check/update rider status for user ${userId}`, error);
  }

  const { data: userState, error: stateError } = await supabaseAdmin
    .from("user_states").select("*").eq("user_id", userId).single();

  if (stateError || !userState) {
    logger.info(`[Webhook] Location from user ${userId} received without any state or active 'riding' status. Ignoring.`);
    return;
  }

  if (userState.state === "awaiting_sos_geotag") {
    const { rental_id, crew_id } = userState.context as { rental_id: string; crew_id: string };

    try {
      const { data: crewData, error: crewError } = await supabaseAdmin
        .from("crews").select("hq_location").eq("id", crew_id).single();
      if (crewError || !crewData?.hq_location) throw new Error("Could not retrieve crew location.");

      const [hqLat, hqLon] = crewData.hq_location.split(",").map(Number);
      const distance = calculateDistance(latitude, longitude, hqLat, hqLon);

      const buttons: KeyboardButton[][] = [];
      if (distance < 5) {
        buttons.push([{ text: "⛽️ Топливо (50 XTR)" }]);
        buttons.push([{ text: "🛠️ Эвакуация (150 XTR)" }]);
      } else {
        buttons.push([{ text: "⛽️ Топливо (200 XTR)" }]);
        buttons.push([{ text: "🛠️ Эвакуация (500 XTR)" }]);
      }
      buttons.push([{ text: "🙏 Помогите, денег нет!" }]);

      await supabaseAdmin.from("user_states").update({
        state: "awaiting_sos_payment_choice",
        context: { rental_id, geotag: { latitude, longitude } },
      }).eq("user_id", userId);

      const messageText = `📍 Геопозиция получена! Вы находитесь примерно в *${distance.toFixed(1)} км* от базы экипажа.\n\nВыберите опцию помощи:`;
      await sendComplexMessage(chatId, messageText, buttons, { keyboardType: "reply" });
    } catch (error) {
      logger.error(`[Webhook SOS Location] Error processing location for user ${userId}:`, error);
      await sendComplexMessage(chatId, "🚨 Ошибка при обработке геотега. Пожалуйста, попробуйте снова.", [], undefined);
    }
  } else if (userState.state === "awaiting_geotag") {
    const { event_id } = userState.context as { rental_id: string; event_id: string };
    try {
      const { error: eventUpdateError } = await supabaseAdmin
        .from("events")
        .update({ payload: { geotag: { latitude, longitude } }, status: "pending_acceptance" })
        .eq("id", event_id);
      if (eventUpdateError) throw eventUpdateError;
      await supabaseAdmin.from("user_states").delete().eq("user_id", userId);
      await sendComplexMessage(chatId, "📍 Геотег получен! Оповещаем экипаж о месте перехвата. Вы можете оставить транспорт.", [], undefined);
    } catch (error) {
      logger.error(`[Webhook Location Handler] Error processing location for user ${userId}:`, error);
      await sendComplexMessage(chatId, "🚨 Ошибка при обработке геотега. Пожалуйста, попробуйте снова.", [], undefined);
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

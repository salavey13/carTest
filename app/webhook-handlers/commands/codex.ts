import { sendComplexMessage } from "../actions/sendComplexMessage";
import { logger } from "@/lib/logger";
import { postCodexCommandToSlack } from "@/lib/slack";

type TelegramPhotoMeta = {
  file_id: string;
  file_unique_id?: string;
  width?: number;
  height?: number;
  file_size?: number;
};

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const ADMIN_CHAT_ID = process.env.ADMIN_CHAT_ID;

function shouldSendAdminPhotoFallback(userId: string) {
  if (!ADMIN_CHAT_ID) return false;
  return String(userId) !== String(ADMIN_CHAT_ID);
}

async function sendTelegramPhotoByFileId(params: { chatId: string; fileId: string; caption?: string }) {
  if (!TELEGRAM_BOT_TOKEN) return { ok: false as const, error: "TELEGRAM_BOT_TOKEN is not configured" };

  const response = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendPhoto`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: params.chatId,
      photo: params.fileId,
      caption: params.caption,
    }),
  });

  const data = await response.json();
  if (!response.ok || !data?.ok) {
    return { ok: false as const, error: data?.description || `sendPhoto failed (${response.status})` };
  }

  return { ok: true as const };
}

async function forwardCodexPhotosToAdmin(params: {
  prompt: string;
  photos: TelegramPhotoMeta[];
  telegramChatId: number;
  telegramUserId: string;
  telegramUsername?: string;
  reason: "empty_prompt" | "slack_image_issue";
}) {
  if (!ADMIN_CHAT_ID) {
    return { ok: false as const, reason: "admin_not_configured", forwarded: 0 };
  }

  const photoCandidates = [...params.photos]
    .sort((a, b) => (b.file_size || 0) - (a.file_size || 0))
    .filter((photo, index, list) =>
      list.findIndex((other) => (other.file_unique_id || other.file_id) === (photo.file_unique_id || photo.file_id)) === index,
    );

  let forwarded = 0;
  for (const [index, photo] of photoCandidates.entries()) {
    const caption =
      index === 0
        ? [
            "📌 Codex photo fallback",
            `Reason: ${params.reason}`,
            `From: @${params.telegramUsername || "unknown"} (user ${params.telegramUserId})`,
            `Chat: ${params.telegramChatId}`,
            params.prompt ? `Prompt: ${params.prompt}` : "Prompt: (пусто, только фото)",
          ].join("\n")
        : undefined;

    const sent = await sendTelegramPhotoByFileId({
      chatId: ADMIN_CHAT_ID,
      fileId: photo.file_id,
      caption,
    });

    if (!sent.ok) {
      logger.error("[Codex Command] Failed to forward /codex photo to admin", sent.error);
      continue;
    }

    forwarded += 1;
  }

  return { ok: forwarded > 0 as boolean, forwarded };
}

export async function codexCommand(
  chatId: number,
  userId: string,
  username: string | undefined,
  rawText: string,
  photos: TelegramPhotoMeta[] = [],
) {
  const prompt = rawText.replace(/^\/codex(?:@[\w_]+)?\s*/i, "").trim();

  if (!prompt && photos.length === 0) {
    await sendComplexMessage(
      chatId,
      "Использование: `/codex <задача>`\nПример: `/codex add slack forwarding status in webhook logs`",
      [],
    );
    return;
  }

  try {
    const slackResult = await postCodexCommandToSlack({
      telegramCommandText: rawText,
      telegramUserId: userId,
      telegramUsername: username,
      telegramChatId: String(chatId),
      telegramPhotos: photos,
    });

    if (!slackResult.ok && slackResult.reason === "not_configured") {
      const adminForward = photos.length > 0 && shouldSendAdminPhotoFallback(userId)
        ? await forwardCodexPhotosToAdmin({
            prompt,
            photos,
            telegramChatId: chatId,
            telegramUserId: userId,
            telegramUsername: username,
            reason: "empty_prompt",
          })
        : null;

      const adminPart = adminForward
        ? `\nAdmin photo fallback: ${adminForward.forwarded}/${photos.length}`
        : "";

      await sendComplexMessage(
        chatId,
        `ℹ️ Slack bridge пока не настроен (нет токена/канала). Команда принята, но форвард не выполнен.${adminPart}`,
        [],
      );
      return;
    }

    if (!slackResult.ok) {
      await sendComplexMessage(chatId, `⚠️ Задача не ушла в Slack: ${slackResult.error}`, []);
      return;
    }

    const promptPart = prompt ? `\n\nPrompt: ${prompt}` : "\n\nPrompt: (пусто, только фото)";
    const photoPart = photos.length > 0 ? `\nPhoto: ${photos.length} файл(ов)` : "";
    const photoForwarding = slackResult.photoForwarding;
    const forwardingPart =
      photoForwarding && photos.length > 0
        ? `\nSlack images: ${photoForwarding.uploaded}/${photoForwarding.attempted}${photoForwarding.skippedReason ? ` (${photoForwarding.skippedReason})` : ""}`
        : "";

    const shouldForwardToAdmin =
      photos.length > 0 &&
      shouldSendAdminPhotoFallback(userId) &&
      (!prompt || (photoForwarding && photoForwarding.uploaded < photoForwarding.attempted));
    const adminForward = shouldForwardToAdmin
      ? await forwardCodexPhotosToAdmin({
          prompt,
          photos,
          telegramChatId: chatId,
          telegramUserId: userId,
          telegramUsername: username,
          reason: !prompt ? "empty_prompt" : "slack_image_issue",
        })
      : null;

    const adminPart = adminForward ? `\nAdmin photo fallback: ${adminForward.forwarded}/${photos.length}` : "";

    await sendComplexMessage(
      chatId,
      `✅ Задача отправлена в Slack как запрос к Codex.${promptPart}${photoPart}${forwardingPart}${adminPart}\n\nДля callback добавь:\ntelegramChatId: ${chatId}\ntelegramUserId: ${userId}`,
      [],
    );
  } catch (error: unknown) {
    logger.error("[Codex Command] Unexpected error while forwarding to Slack", error);
    await sendComplexMessage(chatId, `⚠️ Временный сбой при отправке: ${error instanceof Error ? error.message : "Unknown error"}`, []);
  }
}

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
      { parseMode: "Markdown" },
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
      await sendComplexMessage(
        chatId,
        "ℹ️ Slack bridge пока не настроен (нет токена/канала). Команда принята, но форвард не выполнен.",
        [],
        { parseMode: "Markdown" },
      );
      return;
    }

    if (!slackResult.ok) {
      await sendComplexMessage(
        chatId,
        `⚠️ Задача не ушла в Slack: ${slackResult.error}`,
        [],
        { parseMode: "Markdown" },
      );
      return;
    }

    const promptPart = prompt ? `\n\n*Prompt:* ${prompt}` : "\n\n*Prompt:* _(пусто, только фото)_";
    const photoPart = photos.length > 0 ? `\n*Photo:* ${photos.length} файл(ов)` : "";

    await sendComplexMessage(
      chatId,
      `✅ Задача отправлена в Slack как запрос к Codex.${promptPart}${photoPart}\n\nДля callback добавь:\n\`telegramChatId\`: \`${chatId}\`\n\`telegramUserId\`: \`${userId}\``,
      [],
      { parseMode: "Markdown" },
    );
  } catch (error: any) {
    logger.error("[Codex Command] Unexpected error while forwarding to Slack", error);
    await sendComplexMessage(
      chatId,
      `⚠️ Временный сбой при отправке: ${error?.message || "Unknown error"}`,
      [],
      { parseMode: "Markdown" },
    );
  }
}

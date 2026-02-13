import { sendComplexMessage } from "../actions/sendComplexMessage";
import { logger } from "@/lib/logger";
import { postCodexCommandToSlack } from "@/lib/slack";

export async function codexCommand(chatId: number, userId: string, username: string | undefined, rawText: string) {
  const prompt = rawText.replace(/^\/codex(?:@[\w_]+)?\s*/i, "").trim();

  if (!prompt) {
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

    await sendComplexMessage(
      chatId,
      `✅ Задача отправлена в Slack как запрос к Codex.\n\n*Prompt:* ${prompt}\n\nДля callback добавь:\n\`telegramChatId\`: \`${chatId}\`\n\`telegramUserId\`: \`${userId}\``,
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

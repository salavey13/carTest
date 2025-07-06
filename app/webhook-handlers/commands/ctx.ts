import { sendTelegramMessage, sendTelegramDocument } from "@/app/actions";
import { logger } from "@/lib/logger";
import { fetchRepoContents } from "@/app/actions_github/actions";

const REPO_URL = process.env.NEXT_PUBLIC_REPO_URL;

export async function ctxCommand(chatId: number, userId: number) {
  logger.info(`[Ctx Command] User ${userId} triggered the /ctx command.`);
  
  if (!REPO_URL) {
      logger.error("[Ctx Command] REPO_URL is not defined in environment variables.");
      await sendTelegramMessage("🚨 Ошибка: URL репозитория не настроен на сервере.", [], undefined, chatId.toString());
      return;
  }

  await sendTelegramMessage("🌌 Собираю весь контекст проекта в один астральный файл... Это может занять некоторое время.", [], undefined, chatId.toString());

  try {
      const { success, files, error } = await fetchRepoContents(REPO_URL);

      if (!success || !files) {
          throw new Error(error || "Не удалось извлечь файлы репозитория.");
      }

      const combinedContent = files
          .map(file => `// File: ${file.path}\n\n${file.content}\n\n// --- END OF FILE: ${file.path} ---\n\n`)
          .join('');
      
      const fileName = `VibeContext_${new Date().toISOString().split('T')[0]}.ts`;

      const sendDocResult = await sendTelegramDocument(String(chatId), combinedContent, fileName);

      if (!sendDocResult.success) {
          throw new Error(sendDocResult.error || "Не удалось отправить файл с контекстом.");
      }

      logger.info(`[Ctx Command] Successfully sent full context file to user ${userId}.`);

  } catch(e) {
      logger.error("[Ctx Command] Error fetching or sending context file:", e);
      const errorMessage = e instanceof Error ? e.message : "Неизвестная ошибка.";
      await sendTelegramMessage(`🚨 Провал операции. Не удалось собрать контекст.\nПричина: ${errorMessage}`, [], undefined, chatId.toString());
  }
}
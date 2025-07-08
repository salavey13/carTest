import { sendTelegramMessage } from "@/app/actions";
import { logger } from "@/lib/logger";

export async function helpCommand(chatId: number, userId: number) {
  logger.info(`[Help Command] User ${userId} requested help.`);

  const helpText = `*CyberVibe Штаб - Доступные Директивы:*\n\n` +
    `*Основные:*\n` +
    `\`/start\` - Начать или перезапустить онбординг-опрос.\n` +
    `\`/help\` - Показать это сообщение.\n` +
    `\`/howto\` - Показать гайды и инструкции по проекту.\n` +
    `\`/profile\` - (В разработке) Показать ваш профиль и статистику.\n\n` +
    `*Для Контрибьюторов:*\n` +
    `\`/ctx\` - Получить полный контекст проекта в виде одного файла.\n` +
    `\`/sauce\` - Показать системный промпт (секретный соус) этого бота.\n` +
    `\`/file\` - (В разработке) Получить файл из репозитория.\n\n` +
    `*Бизнес и Vibe:*\n` +
    `\`/leads\` - Показать последние горячие лиды.\n` +
    `\`/rage\` - Запустить симуляцию арбитражного сканера.\n` +
    `\`/offer\` - (В разработке) Сгенерировать коммерческое предложение.`;

  await sendTelegramMessage(helpText, [], undefined, String(chatId), undefined, "Markdown");
}
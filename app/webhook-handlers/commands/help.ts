import { sendComplexMessage } from "../actions/sendComplexMessage";
import { logger } from "@/lib/logger";

export async function helpCommand(chatId: number, userId: number) {
  logger.info(`[Help Command] User ${userId} requested help.`);

  const helpText = `*CyberVibe Штаб - Доступные Директивы:*\n\n` +
    `*Основные:*\n` +
    `\`/start\` - Начать или перезапустить онбординг-опрос.\n` +
    `\`/help\` - Показать это сообщение.\n` +
    `\`/howto\` - Показать гайды и инструкции по проекту.\n` +
    `\`/profile\` - Открыть ваш профиль агента (статистика и перки).\n\n` +
    `*Для Контрибьюторов:*\n` +
    `\`/ctx\` - Получить полный контекст проекта в виде одного файла.\n` +
    `\`/sauce\` - Показать системный промпт (секретный соус) этого бота.\n` +
    `\`/file [термин1] [термин2]\` - Найти и показать файлы по ключевым словам.\n\n` +
    `*Бизнес и Vibe:*\n` +
    `\`/rage\` - Запустить симуляцию арбитражного сканера (режим "крестьянина").\n` +
    `\`/settings rage\` - Открыть быстрые настройки для \`/rage\`.\n` +
    `\`/sim_god [сумма]\` - Показать расклад в God-Mode симуляторе.\n` +
    `\`/sim_go [сумма]\` - Совершить "взрыв" в God-Mode и обновить баланс.\n` +
    `\`/leads\` - Показать последние горячие лиды.\n` +
    `\`/offer\` - (В разработке) Сгенерировать коммерческое предложение.`;

  await sendComplexMessage(chatId, helpText, []);
}
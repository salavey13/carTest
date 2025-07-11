import { sendComplexMessage } from "../actions/sendComplexMessage";
import { logger } from "@/lib/logger";

export async function helpCommand(chatId: number, userId: number) {
  logger.info(`[Help Command] User ${userId} requested help.`);

  const helpText = `*CyberVibe Штаб - Доступные Директивы:*\n\n` +
    `*Основные:*\n` +
    `\`/start\` - Начать или перезапустить онбординг-опрос.\n` +
    `\`/help\` - Показать это сообщение.\n` +
    `\`/profile\` - Открыть ваш профиль агента.\n\n` +
    `*Симуляторы Vibe:*\n` +
    `\`/rage\` - Запустить арбитражный сканер (режим "крестьянина").\n` +
    `\`/settings rage\` - Открыть настройки для \`/rage\`.\n` +
    `\`/sim [сумма]\` - Наблюдать потенциал рынка (God-Mode).\n` +
    `\`/sim_go [сумма]\` - Совершить "взрыв" и изменить баланс (God-Mode).\n\n`+
    `*Для Разработчиков:*\n` +
    `\`/seed_market\` - (DEV) Засеять рынок начальными данными.\n` +
    `\`/ctx\` - Получить полный контекст проекта в виде одного файла.\n` +
    `\`/sauce\` - Показать системный промпт этого бота.\n` +
    `\`/file [путь]\` - Найти и показать файлы по пути.`

  await sendComplexMessage(chatId, helpText, []);
}
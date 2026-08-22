import { logger } from "@/lib/logger";
import { getArbitrageScannerSettings } from "@/app/elon/arbitrage_scanner_actions";
import { executeQuantumFluctuation } from "@/app/elon/arbitrage_god_mode_actions";
import { sendComplexMessage } from "../actions/sendComplexMessage";

export async function simCommand(chatId: number, userId: string, args: string[]) {
  const burstAmount = parseInt(args[0]) || 5000;
  logger.info(`[sim] User ${userId} triggered OBSERVER EFFECT. Burst: $${burstAmount}`);
  
  await sendComplexMessage(chatId, `🔬 *Наблюдение...* Вычисляю потенциал вселенной с объемом $${burstAmount.toLocaleString()}...`, []);

  try {
    const settingsResult = await getArbitrageScannerSettings(userId);
    if (!settingsResult.success || !settingsResult.data) {
      throw new Error("Не удалось загрузить настройки пользователя.");
    }

    const result = await executeQuantumFluctuation(settingsResult.data, burstAmount);
    
    let report = `*НАБЛЮДЕНИЕ ЗАВЕРШЕНО:*\n\n` +
                 `Зафиксирован потенциальный сдвиг капитала на *+$${result.totalProfit.toFixed(2)}*. ` +
                 `Эхо этого события записано в ткань рынка. Ваш личный баланс не изменился.\n\n` +
                 `*ТОП-3 ВОЗМОЖНОСТЕЙ:*\n`;

    if (result.opportunities.length > 0) {
        report += result.opportunities.slice(0, 3).map(op => 
            ` • **\`${op.asset}\`**: +${op.spreadPercent.toFixed(2)}% | Потенциал: +$${op.potentialProfitUSD.toFixed(2)}`
        ).join('\n');
    } else {
        report += `Рынок спокоен. Потенциала не найдено.`;
    }

    await sendComplexMessage(chatId, report, []);
  } catch (error) {
    logger.error("[sim] Error processing command:", error);
    await sendComplexMessage(chatId, `🚨 Ошибка Наблюдения: ${error.message}`, []);
  }
}
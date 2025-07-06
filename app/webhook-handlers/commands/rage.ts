import { sendTelegramMessage } from "@/app/actions";
import { logger } from "@/lib/logger";
import { fetchArbitrageOpportunities } from "@/app/elon/arbitrage_scanner_actions";
import type { ArbitrageOpportunity, TwoLegArbitrageOpportunity, ThreeLegArbitrageOpportunity } from "@/app/elon/arbitrage_scanner_types";

// Хелпер для красивого форматирования
function formatOpportunity(op: ArbitrageOpportunity): string {
    const profit = `${op.profitPercentage.toFixed(3)}% ($${op.potentialProfitUSD.toFixed(2)})`;
    if (op.type === '2-leg') {
        const twoLegOp = op as TwoLegArbitrageOpportunity;
        return `*2-Leg:* ${twoLegOp.currencyPair}\n` +
               `  - Покупка: *${twoLegOp.buyExchange}* @ ${twoLegOp.buyPrice.toFixed(4)}\n` +
               `  - Продажа: *${twoLegOp.sellExchange}* @ ${twoLegOp.sellPrice.toFixed(4)}\n` +
               `  - 🔥 *Профит: ${profit}*`;
    }
    const threeLegOp = op as ThreeLegArbitrageOpportunity;
    return `*3-Leg:* ${threeLegOp.currencyPair} на *${threeLegOp.exchange}*\n` +
           `  - 🔥 *Профит: ${profit}*`;
}

export async function rageCommand(chatId: number, userId: number) {
    logger.info(`[Rage Command] User ${userId} triggered the /rage command.`);
    await sendTelegramMessage("⚡️ *Режим Ярости Активирован!* Ищу арбитражные возможности в симуляторе...", [], undefined, chatId.toString());

    try {
        const { opportunities } = await fetchArbitrageOpportunities(String(userId));

        if (!opportunities || opportunities.length === 0) {
            await sendTelegramMessage("🧘‍♂️ Рынок спокоен. Значимых возможностей не найдено. Попробуй позже.", [], undefined, chatId.toString());
            return;
        }

        const sortedOps = opportunities.sort((a, b) => b.profitPercentage - a.profitPercentage);
        const top3 = sortedOps.slice(0, 3);

        const messageLines = top3.map(op => formatOpportunity(op));
        const finalMessage = "🏆 *Топ-3 Горячих Возможностей:*\n\n" + messageLines.join('\n\n');

        await sendTelegramMessage(finalMessage, [], undefined, chatId.toString());

    } catch (error) {
        logger.error("[Rage Command] Error fetching arbitrage opportunities:", error);
        await sendTelegramMessage("🚨 Ошибка при сканировании рынка. Попробуйте позже или проверьте логи.", [], undefined, chatId.toString());
    }
}
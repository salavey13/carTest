import { logger } from "@/lib/logger";
import { fetchArbitrageOpportunities } from "@/app/elon/arbitrage_scanner_actions";
import type { ArbitrageOpportunity, TwoLegArbitrageOpportunity } from "@/app/elon/arbitrage_scanner_types";
import { sendComplexMessage } from "../actions/sendComplexMessage";

function createExchangeLink(exchange: string, pair: string): string {
    const formattedPair = pair.replace('/', '_');
    switch (exchange.toLowerCase()) {
        case 'bybit': return `https://www.bybit.com/trade/spot/${pair.replace('/', '')}`;
        case 'binance': return `https://www.binance.com/en/trade/${formattedPair}`;
        case 'kucoin': return `https://www.kucoin.com/trade/${pair.replace('/', '-')}`;
        default: return `https://www.google.com/search?q=${exchange}+${pair}`;
    }
}

function formatOpportunity(op: ArbitrageOpportunity): { text: string; buttons: any[] } {
    const profit = `${op.profitPercentage.toFixed(3)}% ($${op.potentialProfitUSD.toFixed(2)})`;
    let text = "";
    let buttons = [];

    if (op.type === '2-leg') {
        const twoLegOp = op as TwoLegArbitrageOpportunity;
        text = `*2-Leg:* ${twoLegOp.currencyPair}\n` +
               `  - Покупка: *${twoLegOp.buyExchange}* @ ${twoLegOp.buyPrice.toFixed(4)}\n` +
               `  - Продажа: *${twoLegOp.sellExchange}* @ ${twoLegOp.sellPrice.toFixed(4)}\n` +
               `  - 🔥 *Профит: ${profit}*`;
        buttons = [
            { text: `Buy on ${twoLegOp.buyExchange}`, url: createExchangeLink(twoLegOp.buyExchange, twoLegOp.currencyPair) },
            { text: `Sell on ${twoLegOp.sellExchange}`, url: createExchangeLink(twoLegOp.sellExchange, twoLegOp.currencyPair) }
        ];
    } else {
        text = `*3-Leg:* ${op.currencyPair} на *${op.exchange}*\n` +
               `  - 🔥 *Профит: ${profit}*`;
        buttons = [{ text: `Go to ${op.exchange}`, url: createExchangeLink(op.exchange, op.legs[0].pair) }];
    }
    return { text, buttons };
}

export async function rageCommand(chatId: number, userId: number) {
    logger.info(`[RageCommandV3_ACTIONABLE] User ${userId} triggered /rage.`);
    
    // Send an initial "thinking" message that we can edit later
    const thinkingMessage = await sendComplexMessage(chatId, "⚡️ *Режим Ярости Активирован!* Сканирую симулированный рынок на наличие альфы...", [], "lightning storm");

    try {
        const { opportunities } = await fetchArbitrageOpportunities(String(userId));

        if (!opportunities || opportunities.length === 0) {
            await sendComplexMessage(chatId, "🧘‍♂️ Рынок спокоен. Значимых возможностей не найдено. Попробуй позже.", [], "zen");
            return;
        }

        const sortedOps = opportunities.sort((a, b) => b.profitPercentage - a.profitPercentage);
        const topOp = sortedOps[0];

        const { text, buttons } = formatOpportunity(topOp);
        const finalMessage = "🏆 *Найден Топ-Сигнал:*\n\n" + text;

        await sendComplexMessage(chatId, finalMessage, [buttons], "gold treasure");

    } catch (error) {
        logger.error("[RageCommandV3] Error fetching arbitrage opportunities:", error);
        await sendComplexMessage(chatId, "🚨 Ошибка при сканировании рынка. Нейросеть перегрелась.", [], "explosion");
    }
}
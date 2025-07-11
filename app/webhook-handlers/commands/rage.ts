import { logger } from "@/lib/logger";
import { fetchArbitrageOpportunities, getArbitrageScannerSettings } from "@/app/elon/arbitrage_scanner_actions";
import type { ArbitrageOpportunity, TwoLegArbitrageOpportunity, ThreeLegArbitrageOpportunity, ArbitrageSettings } from "@/app/elon/arbitrage_scanner_types";
import { sendComplexMessage, KeyboardButton, editMessage } from "../actions/sendComplexMessage";

function createExchangeLink(exchange: string, pair: string): string {
    const formattedPair = pair.replace('/', '_');
    switch (exchange.toLowerCase()) {
        case 'bybit': return `https://www.bybit.com/trade/spot/${pair.replace('/', '')}`;
        case 'binance': return `https://www.binance.com/en/trade/${formattedPair}`;
        case 'kucoin': return `https://www.kucoin.com/trade/${pair.replace('/', '-')}`;
        default: return `https://www.google.com/search?q=${exchange}+${pair}`;
    }
}

function formatOpportunity(op: ArbitrageOpportunity): string {
    const profit = `${op.profitPercentage.toFixed(3)}% ($${op.potentialProfitUSD.toFixed(2)})`;
    if (op.type === '2-leg') {
        const twoLegOp = op as TwoLegArbitrageOpportunity;
        return `*2-Leg:* ${twoLegOp.currencyPair}\n` +
               `  - Покупка: *${twoLegOp.buyExchange}* @ ${twoLegOp.buyPrice.toFixed(4)}\n` +
               `  - Продажа: *${twoLegOp.sellExchange}* @ ${twoLegOp.sellPrice.toFixed(4)}\n` +
               `  - 🔥 *Профит: ${profit}*`;
    } else {
        const threeLegOp = op as ThreeLegArbitrageOpportunity;
        return `*3-Leg:* ${threeLegOp.currencyPair} на *${threeLegOp.exchange}*\n` +
               `  - 🔥 *Профит: ${profit}*`;
    }
}

function formatSettings(settings: ArbitrageSettings): string {
    return `*Мин. Спред:* ${settings.minSpreadPercent}% | *Объем:* $${settings.defaultTradeVolumeUSD}\n` +
           `*Биржи:* ${settings.enabledExchanges.join(', ')}\n` +
           `*Пары:* ${settings.trackedPairs.join(', ')}`;
}

export async function rageCommand(chatId: number, userId: number) {
    logger.info(`[RageCommand V6 - Delete & Resend] User ${userId} triggered /rage.`);
    
    const thinkingMessageResult = await sendComplexMessage(chatId, "⚡️ *Режим Ярости Активирован!* Сканирую симулированный рынок на наличие альфы...", [], { imageQuery: "lightning storm" });

    if (!thinkingMessageResult.success || !thinkingMessageResult.data?.result?.message_id) {
        logger.error("[RageCommandV6] Failed to send initial 'thinking' message. Aborting.");
        return;
    }
    const messageId = thinkingMessageResult.data.result.message_id;

    try {
        const settingsResult = await getArbitrageScannerSettings(String(userId));
        const settings = settingsResult.data;

        if (!settings) {
            throw new Error("Не удалось загрузить настройки пользователя.");
        }

        const { opportunities } = await fetchArbitrageOpportunities(String(userId));

        const botUsername = process.env.BOT_USERNAME || 'oneSitePlsBot';
        const settingsLink = `https://t.me/${botUsername}/app?startapp=settings`;
        const deepDiveLink = `https://t.me/${botUsername}/app?startapp=arbitrage_notdummies`;

        const buttons: KeyboardButton[][] = [[
            { text: "⚙️ Изменить Настройки", url: settingsLink },
            { text: "🧠 Что это значит?", url: deepDiveLink }
        ]];

        if (!opportunities || opportunities.length === 0) {
            const noResultMessage = `🧘‍♂️ *Рынок спокоен.*\nЗначимых возможностей не найдено с вашими текущими настройками:\n\n` +
                                    `\`${formatSettings(settings)}\`\n\n` +
                                    `Попробуйте изменить их или повторите попытку позже.`;
            
            await editMessage(chatId, messageId, noResultMessage, buttons, { imageQuery: "zen garden", keyboardType: 'inline' });
            return;
        }

        const sortedOps = opportunities.sort((a, b) => b.profitPercentage - a.profitPercentage);
        const topOp = sortedOps[0];

        const opportunityText = formatOpportunity(topOp);
        const finalMessage = `🏆 *Найден Топ-Сигнал:*\n\n${opportunityText}\n\n` +
                             `*Настройки симуляции:*\n` +
                             `\`${formatSettings(settings)}\``;
        
        await editMessage(chatId, messageId, finalMessage, buttons, { imageQuery: "gold treasure", keyboardType: 'inline' });

    } catch (error) {
        logger.error("[RageCommandV6] Error processing command:", error);
        await editMessage(chatId, messageId, "🚨 Ошибка при сканировании рынка. Нейросеть перегрелась. Попробуйте позже или проверьте настройки.", [], { imageQuery: "explosion" });
    }
}
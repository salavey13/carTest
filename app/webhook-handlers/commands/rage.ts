import { logger } from "@/lib/logger";
import { fetchArbitrageOpportunities, getArbitrageScannerSettings } from "@/app/elon/arbitrage_scanner_actions";
import type { ArbitrageOpportunity, TwoLegArbitrageOpportunity, ThreeLegArbitrageOpportunity, ArbitrageSettings } from "@/app/elon/arbitrage_scanner_types";
import { sendComplexMessage, KeyboardButton, editMessage } from "../actions/sendComplexMessage";

function createExchangeLink(
    exchange: string, 
    pair: string, 
    side: 'buy' | 'sell',
    price?: number,
    amount?: number
): string {
    const formattedPair = pair.replace('/', '_');
    const baseAsset = pair.split('/')[0];

    switch (exchange.toLowerCase()) {
        case 'binance':
            // Binance supports deep linking with parameters for limit orders
            const binanceParams = new URLSearchParams({
                type: 'LIMIT',
                symbol: pair.replace('/', ''),
            });
            if (price) binanceParams.set('price', price.toPrecision(6));
            if (amount) binanceParams.set('quantity', (amount / (price || 1)).toPrecision(6)); // Calculate quantity based on USD amount
            return `https://www.binance.com/en/trade/${formattedPair}?${binanceParams.toString()}`;

        case 'bybit':
            // Bybit also supports deep linking
            const bybitParams = new URLSearchParams({
                type: 'LIMIT',
                symbol: pair.replace('/', ''),
                side: side.charAt(0).toUpperCase() + side.slice(1),
            });
            if (price) bybitParams.set('orderPrice', price.toPrecision(6));
            if (amount) bybitParams.set('orderQty', (amount / (price || 1)).toPrecision(6));
             return `https://www.bybit.com/en/trade/spot/${pair.replace('/', '')}?${bybitParams.toString()}`;

        case 'kucoin':
             // KuCoin's URL structure for spot trading is simpler and does not support order pre-filling via params.
            return `https://www.kucoin.com/trade/${pair.replace('/', '-')}`;

        default:
            return `https://www.google.com/search?q=${exchange}+${pair}`;
    }
}

function formatOpportunity(op: ArbitrageOpportunity, tradeVolume: number): { text: string, buttons: KeyboardButton[] } {
    const profit = `${op.profitPercentage.toFixed(3)}% ($${op.potentialProfitUSD.toFixed(2)})`;
    let text = "";
    let buttons: KeyboardButton[] = [];

    if (op.type === '2-leg') {
        const twoLegOp = op as TwoLegArbitrageOpportunity;
        text = `*2-Leg:* ${twoLegOp.currencyPair}\n` +
               `  - Покупка: *${twoLegOp.buyExchange}* @ ${twoLegOp.buyPrice.toFixed(4)}\n` +
               `  - Продажа: *${twoLegOp.sellExchange}* @ ${twoLegOp.sellPrice.toFixed(4)}\n` +
               `  - 🔥 *Профит: ${profit}*`;
        buttons = [
            { text: `Buy on ${twoLegOp.buyExchange}`, url: createExchangeLink(twoLegOp.buyExchange, twoLegOp.currencyPair, 'buy', twoLegOp.buyPrice, tradeVolume) },
            { text: `Sell on ${twoLegOp.sellExchange}`, url: createExchangeLink(twoLegOp.sellExchange, twoLegOp.currencyPair, 'sell', twoLegOp.sellPrice, tradeVolume) }
        ];
    } else {
        const threeLegOp = op as ThreeLegArbitrageOpportunity;
        text = `*3-Leg (Треугольный):* ${threeLegOp.currencyPair} на *${threeLegOp.exchange}*\n` +
               `*Цепочка:* \`${threeLegOp.legs.map(l => l.pair).join(' -> ')}\`\n` +
               `  - 🔥 *Профит: ${profit}*`;
        // For 3-leg, a direct link is less useful as it involves multiple trades. We link to the first pair on the exchange.
        buttons = [{ text: `Go to ${threeLegOp.exchange}`, url: createExchangeLink(threeLegOp.exchange, threeLegOp.legs[0].pair, 'buy') }];
    }
    return { text, buttons };
}

function formatSettings(settings: ArbitrageSettings): string {
    return `*Мин. Спред:* ${settings.minSpreadPercent}% | *Объем:* $${settings.defaultTradeVolumeUSD}\n` +
           `*Биржи:* ${settings.enabledExchanges.join(', ') || 'Нет'}\n` +
           `*Пары:* ${settings.trackedPairs.join(', ')}`;
}

export async function rageCommand(chatId: number, userId: number) {
    logger.info(`[RageCommand V8 - Deep Links] User ${userId} triggered /rage.`);
    
    const thinkingMessageResult = await sendComplexMessage(chatId, "⚡️ *Режим Ярости Активирован!* Сканирую симулированный рынок на наличие альфы...", [], { imageQuery: "lightning storm" });

    if (!thinkingMessageResult.success || !thinkingMessageResult.data?.result?.message_id) {
        logger.error("[RageCommandV8] Failed to send initial 'thinking' message. Aborting.");
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

        let mainButtons: KeyboardButton[][] = [[
            { text: "⚙️ Изменить Настройки", url: settingsLink },
            { text: "⚡️ Быстрые Настройки", text: "/settings rage" },
        ]];

        if (!opportunities || opportunities.length === 0) {
            const noResultMessage = `🧘‍♂️ *Рынок спокоен.*\nЗначимых возможностей не найдено с вашими текущими настройками:\n\n` +
                                    `\`${formatSettings(settings)}\`\n\n` +
                                    `Попробуйте изменить их или повторите попытку позже.`;
            
            await editMessage(chatId, messageId, noResultMessage, mainButtons, { imageQuery: "zen garden", keyboardType: 'inline' });
            return;
        }

        const sortedOps = opportunities.sort((a, b) => b.profitPercentage - a.profitPercentage);
        const topOp = sortedOps[0];

        const { text: opportunityText, buttons: opportunityButtons } = formatOpportunity(topOp, settings.defaultTradeVolumeUSD);
        
        if (opportunityButtons.length > 0) {
            mainButtons.unshift(opportunityButtons);
        }

        const finalMessage = `🏆 *Найден Топ-Сигнал:*\n\n${opportunityText}\n\n` +
                             `*Настройки симуляции:*\n` +
                             `\`${formatSettings(settings)}\``;
        
        await editMessage(chatId, messageId, finalMessage, mainButtons, { imageQuery: "gold treasure", keyboardType: 'inline' });

    } catch (error) {
        logger.error("[RageCommandV8] Error processing command:", error);
        await editMessage(chatId, messageId, "🚨 Ошибка при сканировании рынка. Нейросеть перегрелась. Попробуйте позже или проверьте настройки.", [], { imageQuery: "explosion" });
    }
}
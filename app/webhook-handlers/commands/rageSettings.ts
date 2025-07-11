import { logger } from "@/lib/logger";
import { getArbitrageScannerSettings, updateArbitrageUserSettings } from "@/app/elon/arbitrage_scanner_actions";
import type { ArbitrageSettings, ExchangeName } from "@/app/elon/arbitrage_scanner_types";
import { sendComplexMessage } from "../actions/sendComplexMessage";

function formatSettings(settings: ArbitrageSettings): string {
    return `*Текущие настройки симуляции:*\n` +
           `\`Мин. Спред: ${settings.minSpreadPercent}%\`\n` +
           `\`Активные Биржи: ${settings.enabledExchanges.join(', ') || 'Нет'}\``;
}

export async function rageSettingsCommand(chatId: number, userId: number, text: string) {
    logger.info(`[RageSettings] User ${userId} triggered with text: "${text}"`);
    const userIdStr = String(userId);
    
    const settingsResult = await getArbitrageScannerSettings(userIdStr);
    if (!settingsResult.success || !settingsResult.data) {
        await sendComplexMessage(chatId, "🚨 Не удалось загрузить ваши настройки арбитража.", []);
        return;
    }
    let currentSettings = settingsResult.data;

    let settingsUpdated = false;

    if (text.startsWith('Set Spread')) {
        const newSpread = parseFloat(text.split(' ')[2]);
        if (!isNaN(newSpread)) {
            currentSettings.minSpreadPercent = newSpread;
            settingsUpdated = true;
        }
    } else if (text.startsWith('Toggle')) {
        const exchange = text.split(' ')[1] as ExchangeName;
        const isEnabled = currentSettings.enabledExchanges.includes(exchange);
        if (isEnabled) {
            currentSettings.enabledExchanges = currentSettings.enabledExchanges.filter(ex => ex !== exchange);
        } else {
            currentSettings.enabledExchanges.push(exchange);
        }
        settingsUpdated = true;
    } else if (text === 'Done') {
        await sendComplexMessage(chatId, "Настройки сохранены. Клавиатура убрана.", [], { removeKeyboard: true });
        return;
    }

    if (settingsUpdated) {
        await updateArbitrageUserSettings(userIdStr, currentSettings);
    }

    const message = formatSettings(currentSettings);
    const buttons = [
        [{ text: "Set Spread 0.5%" }, { text: "Set Spread 1.0%" }],
        [{ text: "Toggle Binance" }, { text: "Toggle Bybit" }, { text: "Toggle KuCoin" }],
        [{ text: "Done" }]
    ];
    
    await sendComplexMessage(chatId, message, buttons, { keyboardType: 'reply' });
}
import { logger } from "@/lib/logger";
import { getArbitrageScannerSettings, updateArbitrageUserSettings } from "@/app/elon/arbitrage_scanner_actions";
import type { ArbitrageSettings, ExchangeName } from "@/app/elon/arbitrage_scanner_types";
import { sendComplexMessage } from "../actions/sendComplexMessage";
import { ALL_POSSIBLE_EXCHANGES_CONST } from "@/app/elon/arbitrage_scanner_types";

function formatSettings(settings: ArbitrageSettings): string {
    return `*Текущие настройки симуляции для /rage:*\n` +
           `\`Мин. Спред: ${settings.minSpreadPercent}%\`\n` +
           `\`Объем сделки: $${settings.defaultTradeVolumeUSD}\`\n` +
           `\`Активные Биржи: ${settings.enabledExchanges.join(', ') || 'Нет'}\``;
}

export async function rageSettingsCommand(chatId: number, userId: number, text: string) {
    logger.info(`[RageSettings] User ${userId} triggered with text: "${text}"`);
    const userIdStr = String(userId);
    
    // --- ПРОТОКОЛ "READ-VERIFY-MODIFY-WRITE" ---

    // 1. READ: Читаем текущие настройки.
    const settingsResult = await getArbitrageScannerSettings(userIdStr);

    // 2. VERIFY: Проверяем, что чтение прошло успешно.
    if (!settingsResult.success || !settingsResult.data) {
        logger.error(`[RageSettings] CRITICAL: Failed to read settings for user ${userId}. Aborting operation.`);
        await sendComplexMessage(chatId, "🚨 КРИТИЧЕСКАЯ ОШИБКА: Не удалось загрузить ваши настройки. Операция отменена для защиты данных.", []);
        return; // Прерываем выполнение, чтобы не работать с пустыми данными.
    }
    
    // Создаем рабочую копию настроек, с которой будем работать.
    let currentSettings: ArbitrageSettings = { ...settingsResult.data };
    let settingsUpdated = false;

    // 3. MODIFY: Изменяем рабочую копию на основе команды пользователя.
    if (text.startsWith('Set Spread')) {
        const newSpread = parseFloat(text.split(' ')[2]);
        if (!isNaN(newSpread)) {
            currentSettings.minSpreadPercent = newSpread;
            settingsUpdated = true;
        }
    } else if (text.startsWith('Toggle')) {
        const exchange = text.split(' ')[1] as ExchangeName;
        if (ALL_POSSIBLE_EXCHANGES_CONST.includes(exchange)) {
            const isEnabled = currentSettings.enabledExchanges.includes(exchange);
            if (isEnabled) {
                currentSettings.enabledExchanges = currentSettings.enabledExchanges.filter(ex => ex !== exchange);
            } else {
                currentSettings.enabledExchanges.push(exchange);
            }
            settingsUpdated = true;
        }
    } else if (text === 'Done') {
        // Команда 'Done' просто убирает клавиатуру, не сохраняя ничего дополнительно.
        // Сохранение уже произошло на предыдущих шагах.
        await sendComplexMessage(chatId, "Настройки сохранены. Клавиатура убрана. Используй /rage, чтобы увидеть результат.", [], { removeKeyboard: true });
        return;
    }

    // 4. WRITE: Если были изменения, безопасно сохраняем полный объект настроек.
    if (settingsUpdated) {
        logger.info(`[RageSettings] Settings were modified for user ${userId}. Writing to DB...`, currentSettings);
        const updateResult = await updateArbitrageUserSettings(userIdStr, currentSettings);
        if (!updateResult.success) {
            // Если запись не удалась, сообщаем пользователю.
            // Мы не откатываем локальные изменения, т.к. при следующем вызове они снова прочитаются из базы.
             await sendComplexMessage(chatId, `🚨 ОШИБКА СОХРАНЕНИЯ: Не удалось обновить настройки. ${updateResult.error || ''}`, []);
             return;
        }
    }

    // После всех манипуляций (или их отсутствия) показываем актуальный интерфейс.
    const message = formatSettings(currentSettings);
    const buttons = [
        [{ text: "Set Spread 0.5%" }, { text: "Set Spread 1.0%" }, { text: "Set Spread 1.5%" }],
        ALL_POSSIBLE_EXCHANGES_CONST.map(ex => ({ text: `Toggle ${ex}` })),
        [{ text: "Done" }]
    ];
    
    await sendComplexMessage(chatId, message, buttons, { keyboardType: 'reply' });
}
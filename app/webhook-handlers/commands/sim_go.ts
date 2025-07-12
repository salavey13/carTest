import { logger } from "@/lib/logger";
import { getArbitrageScannerSettings } from "@/app/elon/arbitrage_scanner_actions";
import { executeQuantumFluctuation } from "@/app/elon/arbitrage_god_mode_actions";
import { sendComplexMessage } from "../actions/sendComplexMessage";
import { supabaseAdmin } from "@/hooks/supabase";
import type { GodModeDeck } from "@/app/elon/arbitrage_scanner_types";

const INITIAL_BALANCES: Record<string, number> = { "USDT": 50000 };

export async function simGoCommand(chatId: number, userId: string, args: string[]) {
  const burstAmount = parseInt(args[0]) || 5000;
  logger.info(`[sim_go] User ${userId} triggered INTERVENTION EFFECT. Burst: $${burstAmount}`);
  
  await sendComplexMessage(chatId, `🚀 *Вмешательство...* Совершаю квантовый взрыв на $${burstAmount.toLocaleString()}...`, []);

  // --- ИСПРАВЛЕНИЕ: Используем правильную кастомную таблицу 'users' с ключом 'user_id' ---
  const { data: userProfile, error: readError } = await supabaseAdmin.from('users').select('metadata').eq('user_id', userId).single();
  
  if (readError || !userProfile) {
    logger.error(`[sim_go] CRITICAL: Cannot read profile from 'users' table for user ${userId}.`, { error: readError });
    await sendComplexMessage(chatId, "🚨 КРИТИЧЕСКАЯ ОШИБКА: Не могу прочитать твой профиль из таблицы `users`. Операция отменена.");
    return;
  }

  try {
    const settingsResult = await getArbitrageScannerSettings(userId);
    if (!settingsResult.success || !settingsResult.data) throw new Error("Не удалось загрузить настройки.");
    
    // Выполняем флуктуацию
    const result = await executeQuantumFluctuation(settingsResult.data, burstAmount);
    
    // Применяем результат к балансу
    const currentMetadata = userProfile.metadata || {};
    let deck: GodModeDeck = JSON.parse(JSON.stringify(currentMetadata.god_mode_deck || { balances: {}, total_profit_usd: 0 }));
    if (Object.keys(deck.balances).length === 0) deck.balances = { ...INITIAL_BALANCES };

    deck.balances["USDT"] = (deck.balances["USDT"] || 0) + result.totalProfit;
    deck.total_profit_usd = (deck.total_profit_usd || 0) + result.totalProfit;
    
    const finalMetadata = { ...currentMetadata, god_mode_deck: deck };
    
    // --- ИСПРАВЛЕНИЕ: Обновляем правильную таблицу 'users' ---
    const { error: writeError } = await supabaseAdmin.from('users').update({ metadata: finalMetadata }).eq('user_id', userId);
    
    if (writeError) throw new Error(`Ошибка сохранения обновленного профиля: ${writeError.message}`);

    const finalMessage = `✅ *КВАНТОВЫЙ ВЗРЫВ ЗАВЕРШЕН!*\n\n` +
                         `Ваша чистая стоимость изменилась на *+$${result.totalProfit.toFixed(2)}*.\n` +
                         `Новый баланс USDT: *${deck.balances["USDT"].toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}*`;

    await sendComplexMessage(chatId, finalMessage, []);

  } catch (error) {
    const err = error as Error;
    logger.error("[sim_go] Error processing command:", err);
    await sendComplexMessage(chatId, `🚨 Ошибка Вмешательства: ${err.message}`, []);
  }
}
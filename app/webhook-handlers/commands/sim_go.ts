import { logger } from "@/lib/logger";
import { getArbitrageScannerSettings } from "@/app/elon/arbitrage_scanner_actions";
import { runGodModeSimulation } from "@/app/elon/arbitrage_god_mode_actions";
import { sendComplexMessage } from "../actions/sendComplexMessage";
import { supabaseAdmin } from "@/hooks/supabase";
import type { GodModeDeck } from "@/app/elon/arbitrage_scanner_types";

const INITIAL_BALANCES: Record<string, number> = {
  "USDT": 50000, "BTC": 1, "ETH": 15, "SOL": 300
};

export async function simGoCommand(chatId: number, userId: string, args: string[]) {
  const burstAmount = parseInt(args[0]) || 5000;
  logger.info(`[sim_go] User ${userId} triggered BURST. Amount: $${burstAmount}`);
  
  await sendComplexMessage(chatId, `🚀 *Принято.* Совершаю квантовый сдвиг капитала на $${burstAmount}...`, []);

  // --- ИСПРАВЛЕННЫЙ ЗАПРОС К SUPABASE ---
  const { data: userProfile, error: readError } = await supabaseAdmin
      .from('users')      // <-- ИСПРАВЛЕНИЕ
      .select('metadata')
      .eq('user_id', userId) // <-- ИСПРАВЛЕНИЕ
      .single();

  if (readError || !userProfile) {
    logger.error(`[sim_go] CRITICAL: Failed to read user profile from 'users' table for ${userId}. Aborting write.`, readError);
    await sendComplexMessage(chatId, "🚨 КРИТИЧЕСКАЯ ОШИБКА: Не могу прочитать твой профиль. Операция отменена для защиты данных.");
    return;
  }

  try {
    // ВАЖНО: getArbitrageScannerSettings тоже должен использовать 'users' и 'user_id'.
    // Предполагаем, что он уже исправлен или будет исправлен.
    const settingsResult = await getArbitrageScannerSettings(userId);
    if (!settingsResult.success || !settingsResult.data) {
      throw new Error("Не удалось загрузить настройки пользователя.");
    }
    
    const simResult = await runGodModeSimulation(settingsResult.data, burstAmount);

    if (simResult.opportunities.length === 0) {
        await sendComplexMessage(chatId, "✅ *BURST COMPLETE!* Рынок был спокоен, профита нет. Баланс не изменился.");
        return;
    }

    const currentMetadata = userProfile.metadata || {};
    let deck: GodModeDeck = JSON.parse(JSON.stringify(currentMetadata.god_mode_deck || { balances: {}, total_profit_usd: 0 }));
    
    if (Object.keys(deck.balances).length === 0) {
        deck.balances = { ...INITIAL_BALANCES };
        logger.info(`[sim_go] Initializing balances for user ${userId}`);
    }

    deck.balances["USDT"] = (deck.balances["USDT"] || 0) + simResult.totalProfit;
    deck.total_profit_usd = (deck.total_profit_usd || 0) + simResult.totalProfit;

    const finalMetadata = { ...currentMetadata, god_mode_deck: deck };

    // --- ИСПРАВЛЕННЫЙ ЗАПРОС НА ОБНОВЛЕНИЕ ---
    const { error: writeError } = await supabaseAdmin
        .from('users') // <-- ИСПРАВЛЕНИЕ
        .update({ metadata: finalMetadata })
        .eq('user_id', userId); // <-- ИСПРАВЛЕНИЕ

    if (writeError) {
      logger.error(`[sim_go] CRITICAL: Failed to write metadata to 'users' table for ${userId}.`, writeError);
      throw new Error("Ошибка сохранения обновленного профиля.");
    }
    
    const updatedScoreboardText = "*Updated Scoreboard:*\n" +
      Object.entries(deck.balances).map(([asset, amount]) => ` • \`${asset}\`: ${amount.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 8})}`).join('\n') +
      `\n*Total Profit:* $${deck.total_profit_usd.toFixed(2)}`;

    const finalMessage = `✅ *BURST COMPLETE! (Объем: $${burstAmount.toLocaleString()})*\n\n` +
                         `*Изменение капитала за "взрыв": +$${simResult.totalProfit.toFixed(2)}*\n\n` +
                         `${updatedScoreboardText}\n\n---\n` +
                         `Анализируй новый расклад с \`/sim_god ${burstAmount}\` или совершай следующий взрыв.`;

    await sendComplexMessage(chatId, finalMessage, []);

  } catch (error) {
    logger.error("[sim_go] Error processing command:", error);
    await sendComplexMessage(chatId, `🚨 Ошибка во время "взрыва": ${error.message}`, []);
  }
}
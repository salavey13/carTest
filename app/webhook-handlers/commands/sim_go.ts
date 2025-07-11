import { logger } from "@/lib/logger";
import { getArbitrageScannerSettings } from "@/app/elon/arbitrage_scanner_actions";
import { runGodModeSimulation } from "@/app/elon/arbitrage_god_mode_actions";
import { sendComplexMessage } from "../actions/sendComplexMessage";
import { supabaseAdmin } from "@/hooks/supabase";
import type { GodModeDeck } from "@/app/elon/arbitrage_scanner_types";

const INITIAL_BALANCES: Record<string, number> = {
  "USDT": 50000,
  "BTC": 1,
  "ETH": 15,
  "SOL": 300
};

export async function simGoCommand(chatId: number, userId: string, args: string[]) {
  const burstAmount = parseInt(args[0]) || 5000;
  logger.info(`[sim_go] User ${userId} triggered BURST. Amount: $${burstAmount}`);
  
  await sendComplexMessage(chatId, `🚀 *Принято.* Совершаю квантовый сдвиг капитала на $${burstAmount}...`, []);

  // --- ШАГ 1 & 2: READ & VERIFY ---
  const { data: userProfile, error: readError } = await supabaseAdmin
      .from('profiles')
      .select('metadata')
      .eq('id', userId)
      .single();

  if (readError || !userProfile) {
    logger.error(`[sim_go] CRITICAL: Failed to read user profile for ${userId}. Aborting write.`, readError);
    await sendComplexMessage(chatId, "🚨 КРИТИЧЕСКАЯ ОШИБКА: Не могу прочитать твой профиль. Операция отменена для защиты данных.");
    return;
  }

  try {
    const settingsResult = await getArbitrageScannerSettings(userId);
    if (!settingsResult.success || !settingsResult.data) {
      throw new Error("Не удалось загрузить настройки пользователя.");
    }
    
    // Запускаем симуляцию по самым свежим данным
    const simResult = await runGodModeSimulation(settingsResult.data, burstAmount);

    if (simResult.opportunities.length === 0) {
        await sendComplexMessage(chatId, "✅ *BURST COMPLETE!* Рынок был спокоен, профита нет. Баланс не изменился.");
        return;
    }

    // --- ШАГ 3: MODIFY (Calculate new state) ---
    const currentMetadata = userProfile.metadata || {};
    let deck: GodModeDeck = JSON.parse(JSON.stringify(currentMetadata.god_mode_deck || { balances: {}, total_profit_usd: 0 }));
    
    // Инициализация, если балансы пустые
    if (Object.keys(deck.balances).length === 0) {
        deck.balances = { ...INITIAL_BALANCES };
        logger.info(`[sim_go] Initializing balances for user ${userId}`);
    }

    // В God-Mode мы просто добавляем профит в USDT, т.к. предполагаем бесконечные балансы активов
    deck.balances["USDT"] = (deck.balances["USDT"] || 0) + simResult.totalProfit;
    deck.total_profit_usd = (deck.total_profit_usd || 0) + simResult.totalProfit;

    // --- ШАГ 4: MERGE & WRITE ---
    const finalMetadata = {
        ...currentMetadata,
        god_mode_deck: deck,
    };

    const { error: writeError } = await supabaseAdmin
        .from('profiles')
        .update({ metadata: finalMetadata })
        .eq('id', userId);

    if (writeError) {
      logger.error(`[sim_go] CRITICAL: Failed to write metadata for ${userId}.`, writeError);
      throw new Error("Ошибка сохранения обновленного профиля.");
    }
    
    // --- Финальный отчет ---
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
import { logger } from "@/lib/logger";
import { getArbitrageScannerSettings } from "@/app/elon/arbitrage_scanner_actions";
import { runGodModeSimulation } from "@/app/elon/arbitrage_god_mode_actions";
import { sendComplexMessage } from "../actions/sendComplexMessage";
import { supabaseAdmin } from "@/hooks/supabase";
import type { GodModeDeck } from "@/app/elon/arbitrage_scanner_types";

export async function simGodCommand(chatId: number, userId: string, args: string[]) {
  const burstAmount = parseInt(args[0]) || 5000;
  logger.info(`[sim_god] User ${userId} requested God-Mode deck. Burst: $${burstAmount}`);
  
  await sendComplexMessage(chatId, "👑 *God Mode: ON.* Анализирую квантовые флуктуации...", []);

  try {
    const settingsResult = await getArbitrageScannerSettings(userId);
    if (!settingsResult.success || !settingsResult.data) {
      throw new Error("Не удалось загрузить настройки пользователя.");
    }

    const simResult = await runGodModeSimulation(settingsResult.data, burstAmount);
    
    // Читаем текущий scoreboard
    const { data: userProfile } = await supabaseAdmin.from('profiles').select('metadata').eq('id', userId).single();
    const deck: GodModeDeck = userProfile?.metadata?.god_mode_deck || { balances: {}, total_profit_usd: 0 };
    
    let scoreboardText = "";
    if (Object.keys(deck.balances).length > 0) {
      scoreboardText = "*Scoreboard (Virtual Net Worth):*\n" +
        Object.entries(deck.balances).map(([asset, amount]) => ` • \`${asset}\`: ${amount.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 8})}`).join('\n') +
        `\n*Total Profit:* $${deck.total_profit_usd.toFixed(2)}`;
    } else {
      scoreboardText = "*Scoreboard:* Пусто. Используй `/sim_go` для инициализации.";
    }

    let opportunitiesText = "*TOP-3 ALPHA SHIFTS:*\n";
    if (simResult.opportunities.length > 0) {
      opportunitiesText += simResult.opportunities.slice(0, 3).map((op, i) => 
        `${i+1}. **\`${op.asset}\` | +${op.spreadPercent.toFixed(2)}% | +$${op.potentialProfitUSD.toFixed(2)}**\n` +
        `     *BUY:* ${op.buyAt.exchange} @ $${op.buyAt.price.toFixed(2)}\n` +
        `     *SELL:* ${op.sellAt.exchange} @ $${op.sellAt.price.toFixed(2)}`
      ).join('\n\n');
      if (simResult.opportunities.length > 3) {
        opportunitiesText += `\n...и еще ${simResult.opportunities.length - 3} возможностей.`;
      }
    } else {
      opportunitiesText = "*Рынок спокоен. Альфы не найдено.*";
    }

    const finalMessage = `👑 *GOD-MODE DECK (Burst: $${burstAmount.toLocaleString()})*\n\n` +
                         `*Market Vibe Index (Juiciness): ${simResult.marketJuiciness}/100* ${simResult.marketJuiciness > 70 ? '🔥' : '💧'}\n\n` +
                         `${scoreboardText}\n\n---\n\n${opportunitiesText}\n\n---\n` +
                         `*ИНСТРУКЦИЯ:*\n`+
                         `Это снимок рынка. Чтобы совершить "взрыв" и обновить баланс, используй команду:\n` +
                         `\`/sim_go ${burstAmount}\``;

    await sendComplexMessage(chatId, finalMessage, []);
  } catch (error) {
    logger.error("[sim_god] Error processing command:", error);
    await sendComplexMessage(chatId, `🚨 Ошибка в режиме Бога: ${error.message}`, []);
  }
}
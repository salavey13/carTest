import { logger } from "@/lib/logger";
import { getArbitrageScannerSettings } from "@/app/elon/arbitrage_scanner_actions";
import { sendComplexMessage } from "../actions/sendComplexMessage";
import { supabaseAdmin } from "@/hooks/supabase";
import { Database } from "@/lib/database.types";

type MarketDataInsert = Database['public']['Tables']['market_data']['Insert'];

export async function seedMarketCommand(chatId: number, userId: string) {
  logger.info(`[SeedMarket] User ${userId} initiated market seeding.`);
  await sendComplexMessage(chatId, "🌱 *Засеиваю рынок...* Генерирую начальные данные. Это может занять несколько секунд.", []);

  try {
    const settingsResult = await getArbitrageScannerSettings(userId);
    if (!settingsResult.success || !settingsResult.data) {
      throw new Error("Не удалось загрузить настройки пользователя для сидинга.");
    }
    const { trackedPairs, enabledExchanges } = settingsResult.data;

    const seedPoints: MarketDataInsert[] = [];
    const basePrices: { [key: string]: number } = {
        'BTC/USDT': 68000,
        'ETH/USDT': 3500,
        'SOL/USDT': 150,
    };

    const now = new Date();

    for (const pair of trackedPairs) {
      if (!pair.includes('/USDT')) continue;

      for (const exchange of enabledExchanges) {
        // Генерируем 3 точки данных для каждой пары/биржи
        for (let i = 0; i < 3; i++) {
          const basePrice = basePrices[pair] || 100;
          const price = basePrice * (1 + (Math.random() - 0.5) * 0.01); // до 1% отклонение
          const timestamp = new Date(now.getTime() - i * 5 * 60 * 1000); // каждые 5 минут в прошлом

          seedPoints.push({
            exchange,
            symbol: pair,
            last_price: price,
            bid_price: price * 0.9999,
            ask_price: price * 1.0001,
            volume: Math.random() * 20 + 1, // объем от 1 до 21
            is_simulated: false, // Засеянные данные считаем "реальными"
            timestamp: timestamp.toISOString(),
          });
        }
      }
    }
    
    if (seedPoints.length === 0) {
      throw new Error("Нет пар или бирж в настройках для генерации данных.");
    }

    // Удаляем старые данные по этим парам, чтобы не было дублей
    for (const pair of trackedPairs) {
        await supabaseAdmin.from('market_data').delete().eq('symbol', pair);
    }

    const { error } = await supabaseAdmin.from('market_data').insert(seedPoints);
    if (error) {
      throw new Error(`Ошибка Supabase при записи: ${error.message}`);
    }

    await sendComplexMessage(chatId, `✅ *Рынок засеян!* Создано ${seedPoints.length} точек данных. Теперь можно использовать \`/sim\` и \`/sim_go\`.`, []);

  } catch (error) {
    logger.error("[SeedMarket] Error seeding market:", error);
    await sendComplexMessage(chatId, `🚨 Ошибка сидинга: ${error.message}`, []);
  }
}
import { logger } from "@/lib/logger";
import { getArbitrageScannerSettings } from "@/app/elon/arbitrage_scanner_actions";
import { sendComplexMessage } from "../actions/sendComplexMessage";
import { supabaseAdmin } from "@/hooks/supabase";
import { Database } from "@/lib/database.types";

type MarketDataInsert = Database['public']['Tables']['market_data']['Insert'];

export async function seedMarketCommand(chatId: number, userId: string) {
  logger.info(`[SeedMarket] User ${userId} initiated market seeding.`);
  await sendComplexMessage(chatId, "🌱 *Засеиваю рынок...* Генерирую правдоподобную историю. Это может занять несколько секунд.", []);

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

    // Удаляем старые данные по всем отслеживаемым парам, чтобы начать с чистого листа
    const symbolsToDelete = trackedPairs.filter(p => p.includes('/USDT'));
    await supabaseAdmin.from('market_data').delete().in('symbol', symbolsToDelete);
    logger.info(`[SeedMarket] Cleared old data for symbols: ${symbolsToDelete.join(', ')}`);


    for (const pair of trackedPairs) {
      if (!pair.includes('/USDT')) continue;

      for (const exchange of enabledExchanges) {
        let currentPrice = basePrices[pair] || 100;
        
        // --- ГЕНЕРАЦИЯ ИСТОРИИ (3 точки в прошлом) ---
        // Точка 3 (самая старая): начало роста
        let price1 = currentPrice * (1 - Math.random() * 0.005); // -0.5% от базы
        // Точка 2: пик роста
        let price2 = price1 * (1 + Math.random() * 0.01); // +1% от предыдущей
        // Точка 1 (самая свежая): начало коррекции
        let price3 = price2 * (1 - Math.random() * 0.003); // -0.3% от пика

        const prices = [price3, price2, price1];

        for (let i = 0; i < prices.length; i++) {
          const price = prices[i] * (1 + (Math.random() - 0.5) * 0.001); // Добавляем легкий шум биржи
          const timestamp = new Date(now.getTime() - i * 5 * 60 * 1000); // 0, 5, 10 минут в прошлом

          seedPoints.push({
            exchange,
            symbol: pair,
            last_price: price,
            bid_price: price * 0.9999,
            ask_price: price * 1.0001,
            volume: Math.random() * 20 + 1,
            is_simulated: false,
            timestamp: timestamp.toISOString(),
          });
        }
      }
    }
    
    if (seedPoints.length === 0) {
      throw new Error("Нет пар или бирж в настройках для генерации данных.");
    }

    const { error } = await supabaseAdmin.from('market_data').insert(seedPoints);
    if (error) {
      throw new Error(`Ошибка Supabase при записи: ${error.message}`);
    }

    await sendComplexMessage(chatId, `✅ *Рынок засеян!* Создана история из ${seedPoints.length} точек данных. Вселенная готова к наблюдению.`, []);

  } catch (error) {
    logger.error("[SeedMarket] Error seeding market:", error);
    await sendComplexMessage(chatId, `🚨 Ошибка сидинга: ${error.message}`, []);
  }
}
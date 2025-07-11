"use server";

import { logger } from "@/lib/logger";
import { supabaseAdmin } from "@/hooks/supabase";
import type { ArbitrageSettings, GodModeOpportunity } from "./arbitrage_scanner_types";

type MarketDataPoint = { price: number; created_at: string };

interface QuantumFluctuationResult {
  opportunities: GodModeOpportunity[];
  totalProfit: number;
}

/**
 * Сердце симулятора. Выполняет квантовую флуктуацию, возвращая результат
 * и опционально записывая его в market_data.
 */
export async function executeQuantumFluctuation(
  settings: ArbitrageSettings,
  burstAmount: number,
): Promise<QuantumFluctuationResult> {
  
  logger.info(`[QuantumEngine] Executing fluctuation. Burst: $${burstAmount}`);
  const priceMatrix: Map<string, { bestAsk: { price: number, exchange: string }, bestBid: { price: number, exchange: string } }> = new Map();
  const newDataPointsToInsert: { exchange: string; symbol: string; price: number; is_simulated: boolean }[] = [];

  for (const pair of settings.trackedPairs) {
    if (!pair.includes('/USDT')) continue; // Упрощение для God-Mode

    const baseAsset = pair.split('/')[0];

    for (const exchange of settings.enabledExchanges) {
      // 1. Получаем 2 последние точки для расчета вектора
      const { data: marketPoints, error } = await supabaseAdmin
        .from('market_data')
        .select('price, created_at')
        .eq('exchange', exchange)
        .eq('symbol', pair)
        .order('created_at', { ascending: false })
        .limit(2);

      if (error || !marketPoints || marketPoints.length < 2) {
        logger.warn(`[QuantumEngine] Not enough data for ${pair} on ${exchange}. Skipping.`);
        continue;
      }

      const [p_current, p_previous] = marketPoints as MarketDataPoint[];
      
      // 2. Рассчитываем вектор и "коллапсируем" цену
      const timeNow = new Date().getTime();
      const timeCurrent = new Date(p_current.created_at).getTime();
      const timePrevious = new Date(p_previous.created_at).getTime();

      const priceDelta = p_current.price - p_previous.price;
      const timeDelta = timeCurrent - timePrevious;
      const velocity = timeDelta > 0 ? priceDelta / timeDelta : 0; // цена в миллисекунду
      
      const executionTimeDelta = timeNow - timeCurrent;
      const jitter = (Math.random() - 0.5) * velocity * 0.2; // Фактор неопределенности
      
      const p_execution = p_current.price + (velocity * executionTimeDelta) + (jitter * executionTimeDelta);

      // 3. Сохраняем новую точку для последующей записи в БД
      newDataPointsToInsert.push({ exchange, symbol: pair, price: p_execution, is_simulated: true });

      // 4. Формируем матрицу цен на основе "сколлапсировавших" значений
      const { bid, ask } = { bid: p_execution * 0.9999, ask: p_execution * 1.0001 }; // Упрощенный спред
      
      if (!priceMatrix.has(baseAsset)) {
        priceMatrix.set(baseAsset, {
          bestAsk: { price: Infinity, exchange: "N/A" },
          bestBid: { price: 0, exchange: "N/A" },
        });
      }
      const assetData = priceMatrix.get(baseAsset)!;
      if (ask < assetData.bestAsk.price) assetData.bestAsk = { price: ask, exchange };
      if (bid > assetData.bestBid.price) assetData.bestBid = { price: bid, exchange };
    }
  }

  // 5. Расчет профита
  const opportunities: GodModeOpportunity[] = [];
  let totalProfit = 0;

  for (const [asset, data] of priceMatrix.entries()) {
    if (data.bestBid.price > data.bestAsk.price) {
      const spread = ((data.bestBid.price - data.bestAsk.price) / data.bestAsk.price);
      const profit = burstAmount * spread;
      opportunities.push({
        asset, spreadPercent: spread * 100, potentialProfitUSD: profit,
        buyAt: data.bestAsk, sellAt: data.bestBid,
      });
      totalProfit += profit;
    }
  }
  
  // 6. ЗАПИСЬ В ТКАНЬ РЫНКА
  if (newDataPointsToInsert.length > 0) {
    const { error: insertError } = await supabaseAdmin.from('market_data').insert(newDataPointsToInsert);
    if (insertError) logger.error("[QuantumEngine] Failed to insert simulated data points:", insertError);
    else logger.info(`[QuantumEngine] Successfully inserted ${newDataPointsToInsert.length} simulated data points into market_data.`);
  }

  opportunities.sort((a, b) => b.spreadPercent - a.spreadPercent);
  return { opportunities, totalProfit };
}
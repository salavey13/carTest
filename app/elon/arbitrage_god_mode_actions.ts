"use server";

import { logger } from "@/lib/logger";
import { supabaseAdmin } from "@/hooks/supabase";
import type { ArbitrageSettings, GodModeOpportunity, GodModeSimulationResult } from "./arbitrage_scanner_types";

type MarketDataPoint = { last_price: number; timestamp: string };

interface QuantumFluctuationResult {
  opportunities: GodModeOpportunity[];
  totalProfit: number;
}

/**
 * Выполняет симуляцию, предсказывает цены, находит возможности и ЗАПИСЫВАЕТ новые точки данных в БД.
 * Используется для /sim и /sim_go.
 */
export async function executeQuantumFluctuation(
  settings: ArbitrageSettings,
  burstAmount: number,
): Promise<QuantumFluctuationResult> {
  
  logger.info(`[QuantumEngine-Execute] Executing fluctuation. Burst: $${burstAmount}`);
  const { opportunities, totalProfit, newDataPointsToInsert } = await runGodModeSimulationCore(settings, burstAmount);
  
  if (newDataPointsToInsert.length > 0) {
    const { error: insertError } = await supabaseAdmin.from('market_data').insert(newDataPointsToInsert);
    if (insertError) logger.error("[QuantumEngine-Execute] Failed to insert simulated data points:", insertError);
    else logger.info(`[QuantumEngine-Execute] Successfully inserted ${newDataPointsToInsert.length} simulated data points.`);
  }

  return { opportunities, totalProfit };
}


/**
 * Выполняет симуляцию, предсказывает цены, находит возможности, но НЕ записывает данные в БД.
 * Возвращает расширенный результат с логами и "сочностью" рынка.
 * Используется для /god.
 */
export async function runGodModeSimulation(
  settings: ArbitrageSettings,
  burstAmount: number
): Promise<GodModeSimulationResult> {
  logger.info(`[QuantumEngine-Simulate] Running God Mode simulation. Burst: $${burstAmount}`);
  
  const { opportunities, totalProfit, logs } = await runGodModeSimulationCore(settings, burstAmount);
  
  const totalProfitPercent = opportunities.reduce((sum, op) => sum + op.spreadPercent, 0);
  const marketJuiciness = Math.min(100, Math.round(totalProfitPercent * 20 + opportunities.length * 5));

  logger.info(`[QuantumEngine-Simulate] Simulation complete. Juiciness: ${marketJuiciness}`);
  
  return {
    opportunities,
    totalProfit,
    marketJuiciness,
    logs
  };
}


/**
 * Ядро симуляции, которое используется обеими функциями выше.
 */
async function runGodModeSimulationCore(settings: ArbitrageSettings, burstAmount: number) {
  const logs: string[] = [`Core simulation started for $${burstAmount}`];
  const priceMatrix: Map<string, { bestAsk: { price: number, exchange: string }, bestBid: { price: number, exchange: string } }> = new Map();
  const newDataPointsToInsert: { 
    exchange: string; 
    symbol: string; 
    last_price: number; 
    bid_price: number;
    ask_price: number;
    volume: number;
    is_simulated: boolean 
  }[] = [];

  for (const pair of settings.trackedPairs) {
    if (!pair.includes('/USDT')) continue; 
    const baseAsset = pair.split('/')[0];

    for (const exchange of settings.enabledExchanges) {
      const { data: marketPoints, error } = await supabaseAdmin
        .from('market_data')
        .select('last_price, timestamp')
        .eq('exchange', exchange)
        .eq('symbol', pair)
        .order('timestamp', { ascending: false })
        .limit(2);

      if (error || !marketPoints || marketPoints.length < 2) {
        const warning = `[QuantumCore] Not enough data for ${pair} on ${exchange}. Skipping.`;
        logger.warn(warning);
        logs.push(warning);
        continue;
      }

      const [p_current, p_previous] = marketPoints as MarketDataPoint[];
      
      const timeNow = new Date().getTime();
      const timeCurrent = new Date(p_current.timestamp).getTime();
      const timePrevious = new Date(p_previous.timestamp).getTime();

      const priceDelta = p_current.last_price - p_previous.last_price;
      const timeDelta = timeCurrent - timePrevious;
      const velocity = timeDelta > 0 ? priceDelta / timeDelta : 0;
      
      const executionTimeDelta = timeNow - timeCurrent;
      const jitter = (Math.random() - 0.5) * velocity * 0.2; 
      
      const p_execution = p_current.last_price + (velocity * executionTimeDelta) + (jitter * executionTimeDelta);
      const bid = p_execution * 0.9999;
      const ask = p_execution * 1.0001;

      newDataPointsToInsert.push({ 
        exchange, 
        symbol: pair, 
        last_price: p_execution,
        bid_price: bid,
        ask_price: ask,
        volume: Math.random() * 10,
        is_simulated: true 
      });

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
      logs.push(`[QuantumCore] Found opportunity for ${asset}: ${data.bestAsk.exchange} -> ${data.bestBid.exchange} (+${(spread*100).toFixed(3)}%)`);
    }
  }
  
  opportunities.sort((a, b) => b.spreadPercent - a.spreadPercent);
  return { opportunities, totalProfit, newDataPointsToInsert, logs };
}
"use server";
import { logger } from "@/lib/logger";
import type { 
  GodModeOpportunity, 
  GodModeSimulationResult, 
  ArbitrageSettings,
  ExchangeName 
} from "./arbitrage_scanner_types";

// Helper-симулятор, такой же как в обычном сканере
const simulateOrderBook = (pair: string, exchange: ExchangeName) => {
  let basePrice;
  const a = pair.split('/')[0];
  const b = pair.split('/')[1];

  if (a === "BTC") basePrice = 65000 + (Math.random() - 0.5) * 500;
  else if (a === "ETH") basePrice = 3500 + (Math.random() - 0.5) * 50;
  else if (a === "SOL") basePrice = 150 + (Math.random() - 0.5) * 10;
  else if (a === "ETH" && b === "BTC") basePrice = 0.053 + (Math.random() - 0.5) * 0.001;
  else basePrice = 1 + (Math.random() - 0.5) * 0.1;

  // Создаем искусственный спред между биржами для симуляции
  const exchangeFactors: Record<ExchangeName, number> = {
    "Binance": 1.0002, "Bybit": 0.9995, "KuCoin": 1.0005, "Gate.io": 0.9998, "OKX": 1.0001, "SimulatedExchangeA": 1.001, "SimulatedExchangeB": 0.999,
  };
  basePrice *= exchangeFactors[exchange] || 1;

  const midPrice = basePrice * (1 + (Math.random() - 0.5) * 0.002);
  const spread = midPrice * (0.0002 + Math.random() * 0.0005);
  
  return {
    bid: parseFloat((midPrice - spread / 2).toFixed(b === "BTC" ? 8 : 4)),
    ask: parseFloat((midPrice + spread / 2).toFixed(b === "BTC" ? 8 : 4)),
  };
};

export async function runGodModeSimulation(
  settings: ArbitrageSettings,
  burstAmount: number
): Promise<GodModeSimulationResult> {
  logger.info(`[GodModeAction] Running simulation with burst: $${burstAmount}`);
  const logs: string[] = [`GOD MODE SIMULATION (BURST: $${burstAmount})`];
  
  const priceMatrix: Map<string, { bestAsk: { price: number, exchange: ExchangeName }, bestBid: { price: number, exchange: ExchangeName } }> = new Map();

  // 1. Собрать Матрицу Цен
  for (const pair of settings.trackedPairs) {
      if (pair.includes('/')) {
          const [baseAsset, quoteAsset] = pair.split('/');
          if (quoteAsset !== 'USDT') continue; // God-Mode упрощенно работает с USDT как с основной валютой

          for (const exchange of settings.enabledExchanges) {
              const { bid, ask } = simulateOrderBook(pair, exchange);
              
              if (!priceMatrix.has(baseAsset)) {
                  priceMatrix.set(baseAsset, {
                      bestAsk: { price: Infinity, exchange: "N/A" as ExchangeName },
                      bestBid: { price: 0, exchange: "N/A" as ExchangeName },
                  });
              }

              const assetData = priceMatrix.get(baseAsset)!;
              if (ask < assetData.bestAsk.price) {
                  assetData.bestAsk = { price: ask, exchange };
              }
              if (bid > assetData.bestBid.price) {
                  assetData.bestBid = { price: bid, exchange };
              }
          }
      }
  }
  logs.push(`Price matrix assembled for ${priceMatrix.size} assets.`);

  // 2. Найти Возможности
  const opportunities: GodModeOpportunity[] = [];
  let totalProfit = 0;
  let totalSpreadSum = 0;

  for (const [asset, data] of priceMatrix.entries()) {
      if (data.bestBid.price > data.bestAsk.price) {
          const spread = ((data.bestBid.price - data.bestAsk.price) / data.bestAsk.price) * 100;
          if (spread >= settings.minSpreadPercent) {
              const profit = burstAmount * (spread / 100);
              opportunities.push({
                  asset,
                  spreadPercent: spread,
                  potentialProfitUSD: profit,
                  buyAt: data.bestAsk,
                  sellAt: data.bestBid,
              });
              totalProfit += profit;
              totalSpreadSum += spread;
          }
      }
  }

  // 3. Рассчитать "Сочность Рынка"
  const juiceFactor = opportunities.length > 0 ? (totalSpreadSum / opportunities.length) * 10 : 0;
  const marketJuiciness = Math.min(100, Math.round(juiceFactor * opportunities.length));

  logs.push(`Found ${opportunities.length} opportunities. Total profit: $${totalProfit.toFixed(2)}. Juiciness: ${marketJuiciness}/100`);

  opportunities.sort((a, b) => b.spreadPercent - a.spreadPercent);
  
  return { opportunities, totalProfit, marketJuiciness, logs };
}
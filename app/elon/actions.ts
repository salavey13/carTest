"use server";
import { logger } from "@/lib/logger";

interface TeslaStockData {
  price: number;
  change: number;
  changePercent: number;
  trend: "up" | "down" | "stable";
  lastElonTweetEffect?: "positive" | "negative" | "neutral" | null;
  newsFlash?: string | null;
}

let lastPrice = 170.00; // Начальная цена
let lastTrend: "up" | "down" | "stable" = "stable";
let lastTweetEffectApplied: "positive" | "negative" | "neutral" | null = null;

const positiveNews = [
  "Новый Cybertruck V2 анонсирован! Предзаказы бьют рекорды!",
  "Tesla получила крупный госзаказ на зарядные станции.",
  "ИИ Dojo показывает невероятные результаты в обучении автопилота!",
  "Маск обещает колонию на Марсе к 2030 году с помощью Starship.",
  "Батареи 4680 выходят на массовое производство, снижая себестоимость.",
];
const negativeNews = [
  "Маск опять что-то курит в прямом эфире... SEC напряглась.",
  "Отзыв 100,000 Model Y из-за проблем с рулевым управлением.",
  "Конкуренты из Китая показывают электрокар дешевле и с большим запасом хода.",
  "Маск переименовал X в Y... опять. Инвесторы в недоумении.",
  "Завод в Берлине остановлен из-за протестов эко-активистов.",
];

export async function teslaStockSimulator(): Promise<TeslaStockData> {
  logger.info("[ElonActions] Simulating Tesla stock price...");

  const baseChangePercent = (Math.random() - 0.5) * 0.02; // Базовое изменение +/- 2%
  let priceChangeFactor = baseChangePercent;
  let currentTweetEffect: "positive" | "negative" | "neutral" | null = null;
  let currentNewsFlash: string | null = null;

  // Эффект от "твита Маска" (случайный)
  const tweetRNG = Math.random();
  if (tweetRNG < 0.2) { // 20% шанс на негативный твит
    priceChangeFactor -= Math.random() * 0.05; // Дополнительное падение до -5%
    currentTweetEffect = "negative";
    currentNewsFlash = negativeNews[Math.floor(Math.random() * negativeNews.length)];
    logger.debug(`[ElonActions] Negative tweet effect applied. Factor: ${priceChangeFactor.toFixed(4)}`);
  } else if (tweetRNG < 0.4) { // 20% шанс на позитивный твит
    priceChangeFactor += Math.random() * 0.04; // Дополнительный рост до +4%
    currentTweetEffect = "positive";
    currentNewsFlash = positiveNews[Math.floor(Math.random() * positiveNews.length)];
    logger.debug(`[ElonActions] Positive tweet effect applied. Factor: ${priceChangeFactor.toFixed(4)}`);
  } else { // 60% шанс на нейтральный эффект или отсутствие значимого твита
    currentTweetEffect = "neutral";
    logger.debug(`[ElonActions] Neutral tweet effect. Factor: ${priceChangeFactor.toFixed(4)}`);
  }
  lastTweetEffectApplied = currentTweetEffect;


  // "Инерция" рынка
  if (lastTrend === "up") priceChangeFactor += 0.005;
  if (lastTrend === "down") priceChangeFactor -= 0.005;

  const change = lastPrice * priceChangeFactor;
  let newPrice = lastPrice + change;

  // Не даем цене упасть слишком низко или взлететь нереально
  newPrice = Math.max(50, Math.min(newPrice, 500));

  const changePercent = ((newPrice - lastPrice) / lastPrice) * 100;

  if (changePercent > 0.1) lastTrend = "up";
  else if (changePercent < -0.1) lastTrend = "down";
  else lastTrend = "stable";

  const result: TeslaStockData = {
    price: parseFloat(newPrice.toFixed(2)),
    change: parseFloat(change.toFixed(2)),
    changePercent: parseFloat(changePercent.toFixed(2)),
    trend: lastTrend,
    lastElonTweetEffect: lastTweetEffectApplied,
    newsFlash: currentNewsFlash,
  };

  lastPrice = newPrice; // Обновляем последнюю цену для следующего вызова

  logger.info("[ElonActions] Tesla stock price simulated:", result);
  return result;
}
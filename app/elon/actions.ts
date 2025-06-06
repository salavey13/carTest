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

let lastPrice = 170.00; 
let lastTrend: "up" | "down" | "stable" = "stable";
let lastTweetEffectApplied: "positive" | "negative" | "neutral" | null = null;

const positiveNews = [
  "Новый Cybertruck V2 анонсирован! Предзаказы бьют рекорды!",
  "Tesla получила крупный госзаказ на зарядные станции.",
  "ИИ Dojo показывает невероятные результаты в обучении автопилота!",
  "Маск обещает колонию на Марсе к 2030 году с помощью Starship.",
  "Батареи 4680 выходят на массовое производство, снижая себестоимость.",
  "Tesla объявляет о рекордной прибыли за квартал!",
  "SpaceX успешно запустила еще 60 спутников Starlink.",
  "Маск анонсировал Neuralink V3 с улучшенным интерфейсом.",
];
const negativeNews = [
  "Маск опять что-то курит в прямом эфире... SEC напряглась.",
  "Отзыв 100,000 Model Y из-за проблем с рулевым управлением.",
  "Конкуренты из Китая показывают электрокар дешевле и с большим запасом хода.",
  "Маск переименовал X в Y... опять. Инвесторы в недоумении.",
  "Завод в Берлине остановлен из-за протестов эко-активистов.",
  "Маск вызвал Цукерберга на бой в Колизее. Акции META и TSLA в замешательстве.",
  "SEC начала новое расследование в отношении твитов Маска.",
  "Маск заявил, что Dogecoin - будущая валюта Марса. Инвесторы Tesla нервничают.",
];

export async function teslaStockSimulator(): Promise<TeslaStockData> {
  logger.debug("[ElonActions] Simulating Tesla stock price...");

  const baseChangePercent = (Math.random() - 0.5) * 0.02; // Базовое изменение +/- 2%
  let priceChangeFactor = baseChangePercent;
  let currentTweetEffect: "positive" | "negative" | "neutral" | null = null;
  let currentNewsFlash: string | null = null;

  const tweetRNG = Math.random();
  if (tweetRNG < 0.3) { 
    priceChangeFactor -= (Math.random() * 0.03 + 0.02); // Дополнительное падение от -2% до -5%
    currentTweetEffect = "negative";
    currentNewsFlash = negativeNews[Math.floor(Math.random() * negativeNews.length)];
    logger.debug(`[ElonActions] Negative tweet effect. Change factor before inertia: ${priceChangeFactor.toFixed(4)}`);
  } else if (tweetRNG < 0.6) { 
    priceChangeFactor += (Math.random() * 0.03 + 0.01); // Дополнительный рост от +1% до +4%
    currentTweetEffect = "positive";
    currentNewsFlash = positiveNews[Math.floor(Math.random() * positiveNews.length)];
    logger.debug(`[ElonActions] Positive tweet effect. Change factor before inertia: ${priceChangeFactor.toFixed(4)}`);
  } else { 
    currentTweetEffect = "neutral";
    currentNewsFlash = "Рынок ожидает следующего твита Маска...";
    logger.debug(`[ElonActions] Neutral tweet effect. Change factor before inertia: ${priceChangeFactor.toFixed(4)}`);
  }
  lastTweetEffectApplied = currentTweetEffect;

  if (lastTrend === "up") priceChangeFactor += 0.005; // Небольшая инерция
  else if (lastTrend === "down") priceChangeFactor -= 0.005;

  const change = lastPrice * priceChangeFactor;
  let newPrice = lastPrice + change;

  newPrice = Math.max(80, Math.min(newPrice, 350)); // Ограничим цену

  const finalChange = newPrice - lastPrice;
  const finalChangePercent = lastPrice === 0 ? 0 : (finalChange / lastPrice) * 100;

  if (finalChangePercent > 0.15) lastTrend = "up";
  else if (finalChangePercent < -0.15) lastTrend = "down";
  else lastTrend = "stable";

  const result: TeslaStockData = {
    price: parseFloat(newPrice.toFixed(2)),
    change: parseFloat(finalChange.toFixed(2)),
    changePercent: parseFloat(finalChangePercent.toFixed(2)),
    trend: lastTrend,
    lastElonTweetEffect: lastTweetEffectApplied,
    newsFlash: currentNewsFlash,
  };

  lastPrice = newPrice; 

  logger.info("[ElonActions] Tesla stock price simulated:", result);
  return result;
}
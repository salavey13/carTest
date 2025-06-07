// /app/elon/actions.ts
"use server";
import { logger } from "@/lib/logger";

interface TeslaStockData {
  price: number;
  change: number;
  changePercent: number;
  trend: "up" | "down" | "stable";
  lastEventTrigger?: "musk_tweet" | "russian_economy" | "market_noise";
  newsFlash?: string | null;
}

let lastPrice = 170.00; 
let lastTrend: "up" | "down" | "stable" = "stable";

const positiveMuskNews = [
  "Маск: 'Tesla Roadster нового поколения будет летать, буквально!' Акции TSLA <VibeContentRenderer content='::FaRocket::'/> !",
  "Tesla заключает мега-контракт на поставку Cybertruck'ов для колонизации Луны!",
  "Автопилот FSD V15 распознает мысли водителя и заказывает пиццу!",
  "Маск: 'Dogecoin станет официальной валютой на Марсе!' TSLA + Doge <VibeContentRenderer content='::FaChartLine::'/>",
];
const negativeMuskNews = [
  "Маск снова пишет твиты в 3 часа ночи! На этот раз про то, что Земля плоская и рептилоиды существуют. Инвесторы TSLA <VibeContentRenderer content='::FaFaceDizzy::'/>.",
  "SEC открывает новое расследование по манипуляциям Маска с ценой акций TSLA.",
  "Маск: 'Продаю еще 10% акций Tesla, нужны деньги на золотой унитаз для Starship'.",
  "Внезапно! Маск объявляет, что следующая модель Tesla будет работать на дровах 'для экологии'. <VibeContentRenderer content='::FaTree::'/>",
];

const russianEconomyPositiveNews = [ // Сарказм
  "РФ ТВ: 'Экономика России показала беспрецедентный рост! Рубль признан самой стабильной валютой Галактики!' <VibeContentRenderer content='::FaFaceGrinStars::'/>",
  "Замминистра финансов РФ: 'Дефицит бюджета? Это выдумки Госдепа! У нас профицит профицитов!'",
];
const russianEconomyNegativeNews = [
  "Reuters: 'Доходы РФ от нефти/газа рухнули на 60% из-за потолка цен и санкций. Дыра в бюджете размером с Байкал.' <VibeContentRenderer content='::FaSackXmark::'/>",
  "Bloomberg: 'ЦБ РФ экстренно повышает ставку до 30% в попытке остановить гиперинфляцию. Гречка по цене черной икры.' <VibeContentRenderer content='::FaChartPie::'/>",
  "The Economist: 'Технологическая деградация в РФ ускоряется. Новые 'Москвичи' собирают с использованием изоленты и молитв.'",
  "Forbes: 'Отток капитала из РФ превысил все мыслимые пределы. Остались только самые патриотичные рубли.' <VibeContentRenderer content='::FaPlaneDeparture::'/>",
];

export async function teslaStockSimulator(): Promise<TeslaStockData> {
  logger.info("[ElonActions] Simulating Tesla stock price with Russian Spice...");

  let priceChangeFactor = (Math.random() - 0.5) * 0.015; // Базовое рыночное колебание +/- 1.5%
  let currentNewsFlash: string | null = null;
  let eventTrigger: "musk_tweet" | "russian_economy" | "market_noise" = "market_noise";

  const eventRNG = Math.random();

  if (eventRNG < 0.35) { // 35% шанс на событие от Маска
    eventTrigger = "musk_tweet";
    const muskTweetRNG = Math.random();
    if (muskTweetRNG < 0.5) { // 50% негативный твит Маска
      priceChangeFactor -= (Math.random() * 0.04 + 0.02); // Доп. падение -2% to -6%
      currentNewsFlash = negativeMuskNews[Math.floor(Math.random() * negativeMuskNews.length)];
      logger.debug(`[ElonActions] Musk Negative. Factor: ${priceChangeFactor.toFixed(4)}`);
    } else { // 50% позитивный твит Маска
      priceChangeFactor += (Math.random() * 0.03 + 0.015); // Доп. рост +1.5% to +4.5%
      currentNewsFlash = positiveMuskNews[Math.floor(Math.random() * positiveMuskNews.length)];
      logger.debug(`[ElonActions] Musk Positive. Factor: ${priceChangeFactor.toFixed(4)}`);
    }
  } else if (eventRNG < 0.6) { // 25% шанс на событие из "российской экономики"
    eventTrigger = "russian_economy";
    const russiaRNG = Math.random();
    if (russiaRNG < 0.85) { // 85% шанс на "классический" негативный русский вайб
      priceChangeFactor -= (Math.random() * 0.015 + 0.005); // Небольшое доп. падение -0.5% to -2% (глобальные рынки чуть реагируют)
      currentNewsFlash = russianEconomyNegativeNews[Math.floor(Math.random() * russianEconomyNegativeNews.length)];
      logger.debug(`[ElonActions] Russian Economy Negative. Factor: ${priceChangeFactor.toFixed(4)}`);
    } else { // 15% шанс на "саркастический позитив"
      // priceChangeFactor += Math.random() * 0.005; // Минимальный или отсутствующий эффект
      currentNewsFlash = russianEconomyPositiveNews[Math.floor(Math.random() * russianEconomyPositiveNews.length)];
      logger.debug(`[ElonActions] Russian Economy "Positive" (Sarcasm). Factor: ${priceChangeFactor.toFixed(4)}`);
    }
  } else {
    logger.debug(`[ElonActions] Market Noise. Base Factor: ${priceChangeFactor.toFixed(4)}`);
    currentNewsFlash = "Рыночный шум и легкая турбулентность... Маск пока молчит.";
  }

  // Инерция от прошлого тренда
  if (lastTrend === "up") priceChangeFactor += 0.003;
  else if (lastTrend === "down") priceChangeFactor -= 0.003;

  const change = lastPrice * priceChangeFactor;
  let newPrice = lastPrice + change;

  newPrice = Math.max(75, Math.min(newPrice, 400)); // Ограничения цены

  const finalChange = newPrice - lastPrice;
  const finalChangePercent = lastPrice === 0 ? 0 : (finalChange / lastPrice) * 100;

  if (finalChangePercent > 0.2) lastTrend = "up";
  else if (finalChangePercent < -0.2) lastTrend = "down";
  else lastTrend = "stable";

  const result: TeslaStockData = {
    price: parseFloat(newPrice.toFixed(2)),
    change: parseFloat(finalChange.toFixed(2)),
    changePercent: parseFloat(finalChangePercent.toFixed(2)),
    trend: lastTrend,
    lastEventTrigger: eventTrigger,
    newsFlash: currentNewsFlash,
  };

  lastPrice = newPrice; 

  logger.info("[ElonActions] Tesla stock price simulated (with Russian Spice):", result);
  return result;
}
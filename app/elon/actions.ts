"use server";
// import { debugLogger as logger } from "@/lib/debugLogger"; // Удаляем debugLogger
import { logger } from "@/lib/logger"; // Используем стандартный logger

interface TeslaStockData {
  price: number;
  change: number;
  changePercent: number;
  trend: "up" | "down" | "stable";
  lastEventTrigger?: "musk_tweet" | "russian_economy" | "market_noise" | "musk_trump_feud";
  newsFlash?: string | null;
}

let lastPrice = 170.00; 
let lastTrend: "up" | "down" | "stable" = "stable";

const positiveMuskNews = [
  "Маск: 'Tesla Roadster нового поколения будет летать, буквально!' Акции TSLA ::FaRocket:: !",
  "Tesla заключает мега-контракт на поставку Cybertruck'ов для колонизации Луны!",
  "Автопилот FSD V15 распознает мысли водителя и заказывает пиццу!",
  "Маск: 'Dogecoin станет официальной валютой на Марсе!' TSLA + Doge ::FaChartLine::",
  "Срочно! Маск и Трамп замечены играющими в гольф! 'Недопонимание устранено, мы снова лучшие друзья!' – твитнул Маск. Акции TSLA ::FaRocket::?",
  "Tesla объявляет о прорыве в гуманоидных роботах Optimus! Трамп: 'Отличные роботы, лучшие, я всегда это говорил!'",
];
const negativeMuskNews = [
  "Маск снова пишет твиты в 3 часа ночи! На этот раз про то, что Земля плоская и рептилоиды существуют. Инвесторы TSLA ::FaFaceDizzy::.",
  "SEC открывает новое расследование по манипуляциям Маска с ценой акций TSLA.",
  "Маск: 'Продаю еще 10% акций Tesla, нужны деньги на золотой унитаз для Starship'.",
  "Внезапно! Маск объявляет, что следующая модель Tesla будет работать на дровах 'для экологии'. ::FaTree::",
];

const muskTrumpFeudNews = [
    "Трамп в ярости! Обещает 'регуляторный ад' для Tesla после твитов Маска о бюджете и Эпштейне! Акции TSLA ::FaArrowTrendDown:: ::FaFaceFlushed::",
    "Forbes: 'Новый кошмар Tesla – Дональд Трамп'. Аналитики предрекают волну проверок безопасности Autopilot и FSD.",
    "Маск призывает к импичменту Трампа и ставит на JD Vance! Белый Дом в шоке, инвесторы Tesla пьют корвалол.",
    "Слухи: Трамп может позвонить губернатору Техаса и 'попросить' притормозить запуск RoboTaxi от Tesla в Остине. ::FaPhoneSlash::",
    "Goldman Sachs УРОНИЛ прогнозы по поставкам Tesla за Q2! Продажи в Китае и Европе ::FaTemperatureQuarter::, а тут еще и война с Трампом!",
    "Маск связал Трампа с Эпштейном, заявив, что имя Трампа есть в 'тех самых файлах', и поэтому их не публикуют. Ответный удар не заставил себя ждать...",
    "Илон Маск заявил, что Трамп не победил бы на выборах без его (Маска) поддержки и денег. Трамп назвал Маска 'неблагодарным выскочкой'.",
];

const russianEconomyPositiveNews = [ 
  "РФ ТВ: 'Экономика России показала беспрецедентный рост! Рубль признан самой стабильной валютой Галактики!' ::FaFaceGrinStars::",
  "Замминистра финансов РФ: 'Дефицит бюджета? Это выдумки Госдепа! У нас профицит профицитов!'",
];
const russianEconomyNegativeNews = [
  "Reuters: 'Доходы РФ от нефти/газа рухнули на 60% из-за потолка цен и санкций. Дыра в бюджете размером с Байкал.' ::FaSackXmark::",
  "Bloomberg: 'ЦБ РФ экстренно повышает ставку до 30% в попытке остановить гиперинфляцию. Гречка по цене черной икры.' ::FaChartPie::",
  "The Economist: 'Технологическая деградация в РФ ускоряется. Новые 'Москвичи' собирают с использованием изоленты и молитв.'",
  "Forbes: 'Отток капитала из РФ превысил все мыслимые пределы. Остались только самые патриотичные рубли.' ::FaPlaneDeparture::",
];

export async function teslaStockSimulator(): Promise<TeslaStockData> {
  logger.info("[ElonActions] Simulating Tesla stock price with Russian Spice & Trump Feud...");

  let priceChangeFactor = (Math.random() - 0.5) * 0.01; 
  let currentNewsFlash: string | null = null;
  let eventTrigger: TeslaStockData['lastEventTrigger'] = "market_noise";

  const eventRNG = Math.random();

  if (eventRNG < 0.30) { 
    eventTrigger = "musk_trump_feud";
    priceChangeFactor -= (Math.random() * 0.05 + 0.03); 
    currentNewsFlash = muskTrumpFeudNews[Math.floor(Math.random() * muskTrumpFeudNews.length)];
    logger.info(`[ElonActions] Musk vs Trump Feud! Factor: ${priceChangeFactor.toFixed(4)}`); // Используем logger.info или logger.debug
  } else if (eventRNG < 0.55) { 
    eventTrigger = "musk_tweet";
    const muskTweetRNG = Math.random();
    if (muskTweetRNG < 0.5) { 
      priceChangeFactor -= (Math.random() * 0.03 + 0.01); 
      currentNewsFlash = negativeMuskNews[Math.floor(Math.random() * negativeMuskNews.length)];
      logger.info(`[ElonActions] Musk Negative. Factor: ${priceChangeFactor.toFixed(4)}`);
    } else { 
      priceChangeFactor += (Math.random() * 0.025 + 0.01); 
      currentNewsFlash = positiveMuskNews[Math.floor(Math.random() * positiveMuskNews.length)];
      logger.info(`[ElonActions] Musk Positive. Factor: ${priceChangeFactor.toFixed(4)}`);
    }
  } else if (eventRNG < 0.75) { 
    eventTrigger = "russian_economy";
    const russiaRNG = Math.random();
    if (russiaRNG < 0.85) { 
      priceChangeFactor -= (Math.random() * 0.01 + 0.002); 
      currentNewsFlash = russianEconomyNegativeNews[Math.floor(Math.random() * russianEconomyNegativeNews.length)];
      logger.info(`[ElonActions] Russian Economy Negative. Factor: ${priceChangeFactor.toFixed(4)}`);
    } else { 
      currentNewsFlash = russianEconomyPositiveNews[Math.floor(Math.random() * russianEconomyPositiveNews.length)];
      logger.info(`[ElonActions] Russian Economy "Positive" (Sarcasm). Factor: ${priceChangeFactor.toFixed(4)}`);
    }
  } else { 
    logger.info(`[ElonActions] Market Noise. Base Factor: ${priceChangeFactor.toFixed(4)}`);
    currentNewsFlash = "Рыночный шум и легкая турбулентность... Все ждут, что еще выкинет Маск или Трамп.";
  }

  if (lastTrend === "up") priceChangeFactor += 0.002;
  else if (lastTrend === "down") priceChangeFactor -= 0.002;

  const change = lastPrice * priceChangeFactor;
  let newPrice = lastPrice + change;

  newPrice = Math.max(60, Math.min(newPrice, 380)); 

  const finalChange = newPrice - lastPrice;
  const finalChangePercent = lastPrice === 0 ? 0 : (finalChange / lastPrice) * 100;

  if (finalChangePercent > 0.18) lastTrend = "up";
  else if (finalChangePercent < -0.18) lastTrend = "down";
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

  logger.info("[ElonActions] Tesla stock price simulated (with Russian Spice & Trump Feud):", result);
  return result;
}
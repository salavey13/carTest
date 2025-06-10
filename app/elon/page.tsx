"use client";
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { VibeContentRenderer } from '@/components/VibeContentRenderer';
import { useAppContext } from '@/contexts/AppContext';
import { teslaStockSimulator } from './actions'; 
import { purchaseProtoCardAction } from '../hotvibes/actions'; 
import type { ProtoCardDetails } from '../hotvibes/actions';
import { toast } from 'sonner';
import { logger } from '@/lib/logger';
import Link from 'next/link';
import { Textarea } from '@/components/ui/textarea';

import {
  fetchArbitrageOpportunities,
  getArbitrageScannerSettings as fetchArbitrageSettings
} from './arbitrage_scanner_actions';
import type {
  ArbitrageOpportunity,
  TwoLegArbitrageOpportunity,
  ThreeLegArbitrageOpportunity,
  ArbitrageSettings,
} from './arbitrage_scanner_types';


interface TeslaStockData {
  price: number;
  change: number;
  changePercent: number;
  trend: "up" | "down" | "stable";
  lastEventTrigger?: "musk_tweet" | "russian_economy" | "market_noise" | "musk_trump_feud";
  newsFlash?: string | null;
}

const ELON_SIMULATOR_CARD_ID = "elon_simulator_access_v1";
const SIMULATOR_ACCESS_PRICE_XTR = 13;

// Translations Object
const pageTranslations: Record<string, Record<string, any>> = {
  ru: {
    accessDeniedTitle: "Доступ к 'Рынку Маска & Arbitrage Alpha Seeker' Закрыт!",
    accessDeniedDescription: "Чтобы войти в симуляторы, приобретите ПротоКарточку Доступа.",
    purchaseAccessButton: "Купить Доступ за {price} XTR",
    processingButton: "Обработка...",
    authNeededForPurchase: "Для покупки нужна авторизация через Telegram.",
    muskMarketTab: "Рынок Маска",
    arbitrageSeekerTab: "Arbitrage Seeker",
    muskMarketTitle: "Рынок Маска: TSLA & Russian Vibe Edition",
    muskMarketDescription: "Симулятор влияния твитов, новостей и \"особого русского вайба\" на фантомные акции Tesla.",
    simulatedPriceLabel: "Симулированная цена TSLA:",
    updateVibeButton: "Какой Вайб Сегодня? (Маск/РФ/Трамп)",
    updatingVibeButton: "Обновляю вайб...",
    marketMechanicsTitle: "Механика Рынка (на пальцах):",
    marketMechanicsInfo: "::FaCircleInfo:: Агент, это симулятор! Реальные деньги не участвуют. Мы играем с XTR и KiloVibes.",
    marketMechanicsVibes: "<strong class=\"text-brand-yellow\">Вайбы Маска, Трампа & РФ:</strong> Каждый клик на кнопку симулирует новый 'вайб'. Следи за `NewsFlash`!",
    wolfAdvicesTitle: "Советы Волка",
    jordanBelfortAdvices: [
        { titleKey: "Волчий Вайб №1: НЕПРОБИВАЕМАЯ УВЕРЕННОСТЬ!", textKey: "Джордан Белфорт учит: 'Продажа – это передача эмоции'. Главная эмоция – УВЕРЕННОСТЬ. Ты должен быть на 10 из 10 уверен, что твой 'продукт' (в нашем случае – твоя ставка на вайб Маска) – это лучшее, что есть! Если ты сам не веришь, что TSLA взлетит/упадет после 'прикола' Маска – как ты заставишь XTR-рынок поверить в это?", icon: "::FaHandshake::" },
        { titleKey: "Волчий Вайб №2: ЗАХВАТИ КОНТРОЛЬ ЗА 4 СЕКУНДЫ!", textKey: "У тебя 4 секунды, чтобы показать, что ты: 1. Резкий как Пуля. 2. Энтузиаст до Мозга Костей. 3. Эксперт, Мать Его! В симуляторе: увидел Вайб -> мгновенно оценил -> с энтузиазмом 'купил ПротоКарточку' -> показал, что ты 'в теме' рынка Маска.", icon: "::FaBolt::" },
        { titleKey: "Волчий Вайб №3: ДЕРЖИ ПРЯМУЮ ЛИНИЮ!", textKey: "Рынок всегда пытается увести тебя с 'прямой линии' к успеху. Возражения, сомнения... Твоя задача – элегантно возвращать его, повышая уверенность. 'Маск твитнул про кота? Отлично! Это подтверждает мой анализ! Покупаем/Шортим СЕЙЧАС!' Каждое 'НЕТ' от рынка – запрос на большую уверенность.", icon: "::FaChartLine className='transform rotate-90'::" },
        { titleKey: "Волчий Вайб №4: УПРАВЛЯЙ СВОИМ СОСТОЯНИЕМ!", textKey: "Страх, сомнения, жадность – твои враги. Будь в ресурсном состоянии: уверенность, ясность, смелость. Потерял XTR? Не ной! Анализируй, управляй эмоциями, готовься к следующему Вайбу. Успешные 'трейдеры' действуют перед лицом страха.", icon: "::FaBrain::" },
        { titleKey: "Волчий Вайб №5: ПОДГОТОВКА РЕШАЕТ!", textKey: "Белфорт писал скрипты часами. Ты – изучай 'историю твитов Маска' (предыдущие NewsFlash в симуляторе), смотри на 'тренд'. Не кликай наобум! Думай, Агент!", icon: "::FaScroll::" }
    ],
    backToHotVibes: "Назад в Лобби Горячих Вайбов",
    arbitrageSeekerTitle: "Arbitrage Alpha Seeker",
    arbitrageSeekerSubtitle: "Simulated crypto-arbitrage opportunity scanner. Access settings via <Link href=\"/settings\" class=\"underline text-brand-yellow hover:text-yellow-300\">System Config</Link>.",
    scanForAlphaButton: "Scan for Alpha (Simulated)",
    scanningButton: "Scanning Markets...",
    currentScannerSettingsTitle: "Текущие настройки сканера:",
    minSpreadLabel: "Мин. спред:",
    tradeVolumeLabel: "Объем сделки:",
    exchangesLabel: "Биржи:",
    pairsLabel: "Пары:",
    noValue: "Нет",
    changeSettingsLink: "Изменить настройки...",
    loadingSettings: "Загрузка настроек сканера...",
    potentialAlphaTitle: "Potential Alpha",
    noOpportunitiesFound: "No significant arbitrage opportunities found in the latest simulation.",
    scanLogsTitle: "Scan Logs",
    scanLogsPlaceholder: "Scan logs will appear here...",
    disclaimer: "::FaTriangleExclamation className='inline mr-1 text-yellow-500':: **Disclaimer:** This is a SIMULATION. Not real trades.",
    loadingVibeOs: "Загрузка VIBE OS...",
    errorSimulatingTesla: "Ошибка симуляции цены Tesla.",
    errorLoadingArbitrageSettings: "Error loading arbitrage settings.",
    errorDuringArbitrageScan: "Error during arbitrage scan.",
    userOrSettingsNotAvailable: "User or arbitrage settings not available for scan.",
    arbitrageScanCompleteSuccess: "Arbitrage Scan complete! Found {count} potential opportunities.",
    arbitrageScanCompleteInfo: "Arbitrage Scan complete. No significant opportunities found.",
    authErrorForPurchase: "Сначала авторизуйтесь для покупки доступа!",
    accessRequestSent: "Запрос на доступ отправлен! Проверьте Telegram для оплаты счета.",
    failedToInitiatePurchase: "Не удалось инициировать покупку доступа.",
    errorPurchasingAccess: "Ошибка при запросе на покупку доступа.",
  },
  en: {
    accessDeniedTitle: "Access to 'Musk Market & Arbitrage Alpha Seeker' is Locked!",
    accessDeniedDescription: "To enter the simulators, please purchase the Access ProtoCard.",
    purchaseAccessButton: "Buy Access for {price} XTR",
    processingButton: "Processing...",
    authNeededForPurchase: "Authorization via Telegram is required for purchase.",
    muskMarketTab: "Musk Market",
    arbitrageSeekerTab: "Arbitrage Seeker",
    muskMarketTitle: "Musk Market: TSLA & Russian Vibe Edition",
    muskMarketDescription: "Simulator of tweets, news, and 'special Russian vibe' influence on phantom Tesla stocks.",
    simulatedPriceLabel: "Simulated TSLA Price:",
    updateVibeButton: "What's the Vibe Today? (Musk/RF/Trump)",
    updatingVibeButton: "Updating Vibe...",
    marketMechanicsTitle: "Market Mechanics (in a nutshell):",
    marketMechanicsInfo: "::FaCircleInfo:: Agent, this is a simulator! No real money involved. We play with XTR and KiloVibes.",
    marketMechanicsVibes: "<strong class=\"text-brand-yellow\">Musk, Trump & RF Vibes:</strong> Each button click simulates a new 'vibe'. Watch the `NewsFlash`!",
    wolfAdvicesTitle: "Wolf's Advices",
    jordanBelfortAdvices: [
        { titleKey: "Wolf Vibe #1: UNBREAKABLE CERTAINTY!", textKey: "Jordan Belfort teaches: 'Selling is a transference of emotion.' The main emotion is CERTAINTY. You must be 10/10 certain that your 'product' (in our case - your bet on Musk's vibe) is the best thing out there! If you don't believe TSLA will rise/fall after Musk's 'stunt' – how will you make the XTR market believe it?", icon: "::FaHandshake::" },
        { titleKey: "Wolf Vibe #2: TAKE CONTROL IN 4 SECONDS!", textKey: "You have 4 seconds to show you are: 1. Sharp as a Tack. 2. Enthusiastic to the Core. 3. An Expert, Damn It! In the simulator: saw the Vibe -> instantly assessed -> enthusiastically 'bought a ProtoCard' -> showed you're 'in the know' of Musk's market.", icon: "::FaBolt::" },
        { titleKey: "Wolf Vibe #3: HOLD THE STRAIGHT LINE!", textKey: "The market always tries to pull you off the 'straight line' to success. Objections, doubts... Your job is to elegantly bring it back, increasing certainty. 'Musk tweeted about a cat? Great! This confirms my analysis! Buy/Short NOW!' Every 'NO' from the market is a request for more certainty.", icon: "::FaChartLine className='transform rotate-90'::" },
        { titleKey: "Wolf Vibe #4: MANAGE YOUR STATE!", textKey: "Fear, doubt, greed – your enemies. Be in a resourceful state: certainty, clarity, courage. Lost XTR? Don't whine! Analyze, manage emotions, prepare for the next Vibe. Successful 'traders' act in the face of fear.", icon: "::FaBrain::" },
        { titleKey: "Wolf Vibe #5: PREPARATION IS KEY!", textKey: "Belfort wrote scripts for hours. You – study 'Musk's tweet history' (previous NewsFlashes in the simulator), look at the 'trend'. Don't click randomly! Think, Agent!", icon: "::FaScroll::" }
    ],
    backToHotVibes: "Back to Hot Vibes Lobby",
    arbitrageSeekerTitle: "Arbitrage Alpha Seeker",
    arbitrageSeekerSubtitle: "Simulated crypto-arbitrage opportunity scanner. Access settings via <Link href=\"/settings\" class=\"underline text-brand-yellow hover:text-yellow-300\">System Config</Link>.",
    scanForAlphaButton: "Scan for Alpha (Simulated)",
    scanningButton: "Scanning Markets...",
    currentScannerSettingsTitle: "Current Scanner Settings:",
    minSpreadLabel: "Min. Spread:",
    tradeVolumeLabel: "Trade Volume:",
    exchangesLabel: "Exchanges:",
    pairsLabel: "Pairs:",
    noValue: "None",
    changeSettingsLink: "Change settings...",
    loadingSettings: "Loading scanner settings...",
    potentialAlphaTitle: "Potential Alpha",
    noOpportunitiesFound: "No significant arbitrage opportunities found in the latest simulation.",
    scanLogsTitle: "Scan Logs",
    scanLogsPlaceholder: "Scan logs will appear here...",
    disclaimer: "::FaTriangleExclamation className='inline mr-1 text-yellow-500':: **Disclaimer:** This is a SIMULATION. Not real trades.",
    loadingVibeOs: "Loading VIBE OS...",
    errorSimulatingTesla: "Error simulating Tesla price.",
    errorLoadingArbitrageSettings: "Error loading arbitrage settings.",
    errorDuringArbitrageScan: "Error during arbitrage scan.",
    userOrSettingsNotAvailable: "User or arbitrage settings not available for scan.",
    arbitrageScanCompleteSuccess: "Arbitrage Scan complete! Found {count} potential opportunities.",
    arbitrageScanCompleteInfo: "Arbitrage Scan complete. No significant opportunities found.",
    authErrorForPurchase: "Please log in first to purchase access!",
    accessRequestSent: "Access request sent! Check Telegram to pay the invoice.",
    failedToInitiatePurchase: "Failed to initiate access purchase.",
    errorPurchasingAccess: "Error requesting access purchase.",
  }
};

const formatNum = (num: number | undefined, digits = 2) => {
    if (typeof num === 'undefined') return 'N/A';
    return num.toLocaleString(undefined, { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

export default function ElonPage() {
  const { dbUser, isAuthenticated, isLoading: appContextLoading, user: tgUser } = useAppContext();
  const [currentLang, setCurrentLang] = useState<'ru' | 'en'>('en'); // Default to 'en' or a sensible fallback

  useEffect(() => {
    let langToSet: 'ru' | 'en' = 'en'; // Default to 'en'
    if (dbUser?.language_code) { // Prioritize dbUser's language code
        langToSet = dbUser.language_code.toLowerCase().startsWith('ru') ? 'ru' : 'en';
    } else if (tgUser?.language_code) { // Fallback to Telegram user's language code
        langToSet = tgUser.language_code.toLowerCase().startsWith('ru') ? 'ru' : 'en';
    }
    setCurrentLang(langToSet);
    logger.debug(`[ElonPage] Language set to: ${langToSet} (dbUser lang: ${dbUser?.language_code}, tgUser lang: ${tgUser?.language_code})`);
  }, [dbUser?.language_code, tgUser?.language_code]);

  const t = useCallback((key: string, params?: Record<string, string | number>) => {
    let text = pageTranslations[currentLang]?.[key] || pageTranslations['en']?.[key] || key;
    if (params) {
        Object.keys(params).forEach(pKey => {
            text = text.replace(`{${pKey}}`, String(params[pKey]));
        });
    }
    return text;
  }, [currentLang]);


  const [stockData, setStockData] = useState<TeslaStockData | null>(null);
  const [isLoadingPrice, setIsLoadingPrice] = useState(false);
  const [isPurchasing, setIsPurchasing] = useState(false);
  const [hasAccess, setHasAccess] = useState(false);

  const [arbitrageOpportunities, setArbitrageOpportunities] = useState<ArbitrageOpportunity[]>([]);
  const [arbitrageScanLogs, setArbitrageScanLogs] = useState<string[]>([]);
  const [isLoadingArbitrageScan, setIsLoadingArbitrageScan] = useState(false);
  const [currentArbitrageSettings, setCurrentArbitrageSettings] = useState<ArbitrageSettings | null>(null);
  const [isLoadingArbitrageSettings, setIsLoadingArbitrageSettings] = useState(false);


  useEffect(() => {
    if (dbUser && dbUser.metadata?.xtr_protocards?.[ELON_SIMULATOR_CARD_ID]?.status === 'active') {
      setHasAccess(true);
    } else {
      setHasAccess(false);
    }
  }, [dbUser]);

  const fetchStockPrice = useCallback(async () => {
    setIsLoadingPrice(true);
    try {
      const data = await teslaStockSimulator();
      setStockData(data);
    } catch (error) {
      toast.error(t("errorSimulatingTesla"));
      logger.error("ElonPage: Error fetching stock price", error);
    }
    setIsLoadingPrice(false);
  }, [t]);

  const loadArbitrageSettings = useCallback(async () => {
    if (!dbUser?.user_id || !isAuthenticated) return;
    setIsLoadingArbitrageSettings(true);
    try {
      const result = await fetchArbitrageSettings(dbUser.user_id);
      if (result.success && result.data) {
        setCurrentArbitrageSettings(result.data);
      } else {
        toast.error(t("errorLoadingArbitrageSettings") + (result.error || "Unknown error"));
      }
    } catch (error) {
      toast.error(t("errorLoadingArbitrageSettings"));
      logger.error("ElonPage: Error loading arbitrage settings", error);
    }
    setIsLoadingArbitrageSettings(false);
  }, [dbUser?.user_id, isAuthenticated, t]);


  useEffect(() => {
    if (hasAccess) {
      fetchStockPrice();
      if (isAuthenticated && dbUser?.user_id && !currentArbitrageSettings) {
        loadArbitrageSettings();
      }
    }
  }, [fetchStockPrice, hasAccess, isAuthenticated, dbUser?.user_id, loadArbitrageSettings, currentArbitrageSettings]);

  const handleArbitrageScan = useCallback(async () => {
    if (!dbUser?.user_id || !currentArbitrageSettings) {
      toast.info(t("userOrSettingsNotAvailable"));
      return;
    }
    setIsLoadingArbitrageScan(true);
    setArbitrageScanLogs([`[${new Date().toLocaleTimeString()}] Initiating arbitrage scan...`]);
    setArbitrageOpportunities([]);
    try {
      const result = await fetchArbitrageOpportunities(dbUser.user_id);
      setArbitrageOpportunities(result.opportunities);
      setArbitrageScanLogs(prevLogs => [...prevLogs, ...result.logs, `[${new Date().toLocaleTimeString()}] Scan finished.`]);
      if (result.opportunities.length > 0) {
        toast.success(t("arbitrageScanCompleteSuccess", {count: result.opportunities.length}));
      } else {
        toast.info(t("arbitrageScanCompleteInfo"));
      }
      if (result.settings) {
        setCurrentArbitrageSettings(result.settings);
      }
    } catch (error) {
      toast.error(t("errorDuringArbitrageScan"));
      logger.error("ElonPage: Error scanning for arbitrage", error);
      setArbitrageScanLogs(prevLogs => [...prevLogs, `[${new Date().toLocaleTimeString()}] Error during scan: ${String(error)}`]);
    }
    setIsLoadingArbitrageScan(false);
  }, [dbUser?.user_id, currentArbitrageSettings, t]);


  const handlePurchaseAccess = async () => {
    if (!isAuthenticated || !dbUser?.user_id) {
      toast.error(t("authErrorForPurchase"));
      return;
    }
    setIsPurchasing(true);
    const cardDetails: ProtoCardDetails = {
      cardId: ELON_SIMULATOR_CARD_ID,
      title: `Доступ к Симулятору Маска`, 
      description: `Разблокировать симулятор влияния твитов Илона и 'русского вайба' на акции Tesla. Включает доступ к Arbitrage Alpha Seeker. Цена: ${SIMULATOR_ACCESS_PRICE_XTR} XTR.`,
      amountXTR: SIMULATOR_ACCESS_PRICE_XTR,
      type: "simulation_access", 
      metadata: { page_link: "/elon", simulator_name: "Рынок Маска TSLA & Arbitrage Edition" }
    };

    try {
      const result = await purchaseProtoCardAction(dbUser.user_id, cardDetails); 
      if (result.success) {
        toast.success(t("accessRequestSent"));
      } else {
        toast.error(result.error || t("failedToInitiatePurchase"));
      }
    } catch (error) {
      toast.error(t("errorPurchasingAccess"));
      logger.error("ElonPage: Error purchasing access", error);
    }
    setIsPurchasing(false);
  };

  if (appContextLoading) {
    return <div className="min-h-screen flex items-center justify-center bg-black text-brand-cyan"><VibeContentRenderer content="::FaSpinner className='animate-spin text-4xl'::" /> {t("loadingVibeOs")}</div>;
  }

  if (!hasAccess) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-gray-900 via-purple-900 to-blue-900 p-6 text-center">
        <motion.div initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.5 }}>
          <VibeContentRenderer content="::FaRocket className='text-7xl text-brand-orange mb-6 animate-pulse'::" />
          <h1 className="text-4xl font-orbitron font-bold text-brand-yellow mb-4">{t("accessDeniedTitle")}</h1>
          <p className="text-lg text-gray-300 mb-8 max-w-md">
            {t("accessDeniedDescription")}
          </p>
          <Button
            onClick={handlePurchaseAccess}
            disabled={isPurchasing || !isAuthenticated}
            size="lg"
            className="bg-brand-orange text-black font-orbitron font-bold py-3 px-8 rounded-lg text-lg hover:bg-yellow-400 transition-colors shadow-lg hover:shadow-yellow-500/50"
          >
            {isPurchasing ? <VibeContentRenderer content="::FaSpinner className='animate-spin mr-2'::" /> : ''} 
            {isPurchasing ? t("processingButton") : t("purchaseAccessButton", {price: SIMULATOR_ACCESS_PRICE_XTR})}
          </Button>
          {!isAuthenticated && <p className="text-xs text-red-400 mt-3">{t("authNeededForPurchase")}</p>}
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-black via-indigo-900 to-black text-white p-4 pt-24">
        <Tabs defaultValue="musk_market" className="max-w-4xl mx-auto">
            <TabsList className="grid w-full grid-cols-2 bg-black/70 border-2 border-brand-purple shadow-lg shadow-brand-purple/30 backdrop-blur-sm mb-6">
                <TabsTrigger value="musk_market" className="font-orbitron text-sm data-[state=active]:bg-brand-purple data-[state=active]:text-black data-[state=active]:shadow-purple-glow">
                    <VibeContentRenderer content="::FaChartLine className='mr-2'::"/> {t("muskMarketTab")}
                </TabsTrigger>
                <TabsTrigger value="arbitrage_seeker" className="font-orbitron text-sm data-[state=active]:bg-brand-cyan data-[state=active]:text-black data-[state=active]:shadow-cyan-glow">
                    <VibeContentRenderer content="::FaRobot className='mr-2'::"/> {t("arbitrageSeekerTab")}
                </TabsTrigger>
            </TabsList>

            <TabsContent value="musk_market">
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
                    <Card className="bg-black/70 border-2 border-brand-purple shadow-2xl shadow-brand-purple/30 backdrop-blur-md">
                        <CardHeader className="text-center">
                        <motion.div initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ delay: 0.2, type: "spring", stiffness: 150 }}>
                            <VibeContentRenderer content="::FaChartLine className='text-6xl text-brand-orange mx-auto mb-4 filter drop-shadow-[0_0_8px_hsl(var(--brand-orange-rgb))]'::" />
                        </motion.div>
                        <CardTitle className="text-3xl sm:text-4xl font-orbitron font-bold text-brand-orange glitch" data-text={t("muskMarketTitle")}>
                            {t("muskMarketTitle")}
                        </CardTitle>
                        <CardDescription className="text-sm sm:text-md text-purple-300 font-mono mt-2">
                           {t("muskMarketDescription")}
                        </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-6">
                        {stockData && (
                            <motion.div
                            key={`${stockData.price}-${stockData.newsFlash}`} 
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="text-center p-4 sm:p-6 bg-gray-800/60 rounded-lg border border-purple-500/60 shadow-inner"
                            >
                            <p className="text-xs sm:text-sm text-gray-400 font-mono">{t("simulatedPriceLabel")}</p>
                            <p className={`text-5xl sm:text-6xl font-orbitron font-bold my-1 sm:my-2 ${
                                stockData.trend === 'up' ? 'text-green-400' : stockData.trend === 'down' ? 'text-red-400' : 'text-gray-200'
                            }`}>
                                ${stockData.price.toFixed(2)}
                            </p>
                            <p className={`text-md sm:text-lg font-mono ${
                                stockData.change >= 0 ? 'text-green-500' : 'text-red-500'
                            }`}>
                                {stockData.change >= 0 ? '+' : ''}{stockData.change.toFixed(2)} ({stockData.changePercent.toFixed(2)}%)
                                {stockData.trend === 'up' && <VibeContentRenderer content="::FaArrowTrendUp::" />}
                                {stockData.trend === 'down' && <VibeContentRenderer content="::FaArrowTrendDown::" />}
                            </p>
                            {stockData.newsFlash && (
                                <p className="text-xs sm:text-sm text-purple-300 mt-2 sm:mt-3 italic px-2">
                                    <VibeContentRenderer content="::FaNewspaper className='inline mr-1 text-base align-middle'::" /> 
                                    <VibeContentRenderer content={stockData.newsFlash} />
                                </p>
                            )}
                            </motion.div>
                        )}
                        <Button
                            onClick={fetchStockPrice}
                            disabled={isLoadingPrice}
                            className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white font-orbitron py-3 text-lg rounded-md shadow-lg hover:shadow-purple-500/50 transition-all"
                        >
                            {isLoadingPrice ? <VibeContentRenderer content="::FaSpinner className='animate-spin mr-2'::" /> : <VibeContentRenderer content="::FaDiceD6::" /> }
                            {isLoadingPrice ? t("updatingVibeButton") : t("updateVibeButton")}
                        </Button>
                        
                        <div className="space-y-3 text-xs sm:text-sm text-gray-300/90 font-mono p-3 sm:p-4 bg-black/40 rounded-md border border-gray-700/80">
                            <h3 className="text-lg sm:text-xl font-orbitron text-brand-cyan mb-2 sm:mb-3">{t("marketMechanicsTitle")}</h3>
                            <VibeContentRenderer content={t("marketMechanicsInfo")}/>
                            <VibeContentRenderer content={t("marketMechanicsVibes")}/>
                        </div>

                        <div className="mt-6 space-y-4">
                            <h3 className="text-2xl font-orbitron text-brand-pink text-center glitch" data-text={t("wolfAdvicesTitle")}>{t("wolfAdvicesTitle")}</h3>
                            {t("jordanBelfortAdvices").map((advice: any, index: number) => (
                                <motion.div 
                                    key={index}
                                    initial={{ opacity: 0, x: -20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    transition={{ delay: 0.2 + index * 0.1 }}
                                    className="p-3 bg-gray-800/50 border border-pink-500/30 rounded-lg shadow-sm"
                                >
                                    <h4 className="text-md font-orbitron text-pink-400 mb-1 flex items-center">
                                        <VibeContentRenderer content={`${advice.icon} `} className="mr-2 text-lg" /> 
                                        <VibeContentRenderer content={advice.titleKey} />
                                    </h4>
                                    <p className="text-xs text-gray-300/90">
                                        <VibeContentRenderer content={advice.textKey} />
                                    </p>
                                </motion.div>
                            ))}
                        </div>
                        <Link href="/hotvibes" className="block text-center mt-8">
                            <Button variant="outline" className="border-brand-cyan text-brand-cyan hover:bg-brand-cyan/10">
                                <VibeContentRenderer content="::FaArrowLeft::"/> {t("backToHotVibes")}
                            </Button>
                        </Link>
                        </CardContent>
                    </Card>
                </motion.div>
            </TabsContent>

            <TabsContent value="arbitrage_seeker">
                 <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
                    <Card className="bg-black/60 border-2 border-brand-blue shadow-2xl shadow-brand-blue/30 backdrop-blur-sm">
                        <CardHeader className="text-center">
                            <motion.div initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ delay: 0.2, type: "spring", stiffness: 150 }}>
                            <VibeContentRenderer content="::FaRobot className='text-6xl text-brand-cyan mx-auto mb-4 filter drop-shadow-[0_0_8px_hsl(var(--brand-cyan-rgb))]'::" />
                            </motion.div>
                            <CardTitle className="text-3xl sm:text-4xl font-orbitron font-bold text-brand-cyan glitch" data-text={t("arbitrageSeekerTitle")}>
                                {t("arbitrageSeekerTitle")} <span className="text-sm align-super text-yellow-400">(Simulation)</span>
                            </CardTitle>
                            <CardDescription className="text-sm sm:text-md text-blue-300 font-mono mt-2">
                                <VibeContentRenderer content={t("arbitrageSeekerSubtitle")} />
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            <Button
                                onClick={handleArbitrageScan}
                                disabled={isLoadingArbitrageScan || !currentArbitrageSettings || isLoadingArbitrageSettings}
                                className="w-full bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 text-white font-orbitron py-3 text-lg rounded-md shadow-lg hover:shadow-cyan-500/50 transition-all"
                            >
                                {isLoadingArbitrageScan ? <VibeContentRenderer content="::FaSpinner className='animate-spin mr-2'::" /> : <VibeContentRenderer content="::FaSearchDollar className='mr-2'::" /> }
                                {isLoadingArbitrageScan ? t("scanningButton") : t("scanForAlphaButton")}
                            </Button>

                            {currentArbitrageSettings && !isLoadingArbitrageSettings && (
                                <div className="p-3 bg-gray-800/50 border border-purple-600/50 rounded-lg text-xs">
                                    <h4 className="text-sm font-orbitron text-gray-700 dark:text-purple-300 mb-1">{t("currentScannerSettingsTitle")}</h4>
                                    <p className="text-gray-600 dark:text-gray-400">{t("minSpreadLabel")} <span className="text-gray-800 dark:text-brand-yellow">{currentArbitrageSettings.minSpreadPercent}%</span> | {t("tradeVolumeLabel")} <span className="text-gray-800 dark:text-brand-yellow">${currentArbitrageSettings.defaultTradeVolumeUSD}</span></p>
                                    <p className="text-gray-600 dark:text-gray-400">{t("exchangesLabel")} <span className="text-gray-800 dark:text-brand-yellow">{currentArbitrageSettings.enabledExchanges.join(', ') || t("noValue")}</span></p>
                                    <p className="text-gray-600 dark:text-gray-400">{t("pairsLabel")} <span className="text-gray-800 dark:text-brand-yellow">{currentArbitrageSettings.trackedPairs.join(', ') || t("noValue")}</span></p>
                                    <Link href="/settings" className="text-brand-cyan hover:underline mt-1 block">{t("changeSettingsLink")}</Link>
                                </div>
                            )}
                            {isLoadingArbitrageSettings && <p className="text-center text-purple-400"><VibeContentRenderer content="::FaSpinner className='animate-spin'::" /> {t("loadingSettings")}</p>}


                            {arbitrageOpportunities.length > 0 && (
                            <div className="mt-6 space-y-4">
                                <h3 className="text-2xl font-orbitron text-brand-orange text-center glitch" data-text={t("potentialAlphaTitle")}>{t("potentialAlphaTitle")}</h3>
                                <AnimatePresence>
                                {arbitrageOpportunities.map((op) => (
                                <motion.div
                                    key={op.id}
                                    layout
                                    initial={{ opacity: 0, y: 20, scale: 0.95 }}
                                    animate={{ opacity: 1, y: 0, scale: 1 }}
                                    exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.2 } }}
                                    transition={{ type: "spring", stiffness: 260, damping: 20 }}
                                >
                                    <Card className={`bg-gray-800/80 border ${op.profitPercentage > (currentArbitrageSettings?.minSpreadPercent || 0) + 0.5 ? 'border-green-500 shadow-green-500/30' : 'border-yellow-500 shadow-yellow-500/30'} hover:shadow-lg transition-shadow`}>
                                    <CardHeader>
                                        <CardTitle className={`flex items-center justify-between text-lg ${op.profitPercentage > (currentArbitrageSettings?.minSpreadPercent || 0) + 0.2 ? 'text-green-400' : 'text-yellow-400'}`}>
                                        <span className="flex items-center">
                                            {op.type === '2-leg' ? <VibeContentRenderer content="::FaRightLeft className='inline mr-2 text-xl'::" /> : <VibeContentRenderer content="::FaBolt className='inline mr-2 text-xl'::" />}
                                            {op.type === '2-leg' ? `Inter-Exchange: ${op.currencyPair}` : `Triangular: ${op.currencyPair} (${(op as ThreeLegArbitrageOpportunity).exchange})`}
                                        </span>
                                        <span className="text-xl font-bold">{formatNum(op.profitPercentage, 3)}%</span>
                                        </CardTitle>
                                        <CardDescription className="text-xs text-gray-600 dark:text-gray-400">
                                        Profit: <VibeContentRenderer content="::FaDollarSign className='inline'::" />{formatNum(op.potentialProfitUSD)} (on <VibeContentRenderer content="::FaDollarSign className='inline'::" />{formatNum(op.tradeVolumeUSD,0)} vol)
                                        </CardDescription>
                                    </CardHeader>
                                    <CardContent className="text-sm space-y-1">
                                        <p className="font-mono text-gray-800 dark:text-gray-300 text-xs md:text-sm">{(op as any).details}</p>
                                        {op.type === '2-leg' && (
                                            <>
                                                <p className="text-gray-700 dark:text-gray-300"><VibeContentRenderer content="::FaArrowRightFromBracket className='inline mr-1 text-blue-600 dark:text-blue-400'::" /> Buy: <strong>{(op as TwoLegArbitrageOpportunity).buyExchange}</strong> @ ${formatNum((op as TwoLegArbitrageOpportunity).buyPrice, 4)} (Fee: {formatNum((op as TwoLegArbitrageOpportunity).buyFeePercentage,3)}%)</p>
                                                <p className="text-gray-700 dark:text-gray-300"><VibeContentRenderer content="::FaArrowRightToBracket className='inline mr-1 text-teal-600 dark:text-teal-400'::" /> Sell: <strong>{(op as TwoLegArbitrageOpportunity).sellExchange}</strong> @ ${formatNum((op as TwoLegArbitrageOpportunity).sellPrice, 4)} (Fee: {formatNum((op as TwoLegArbitrageOpportunity).sellFeePercentage,3)}%)</p>
                                                <p className="text-xs text-gray-600 dark:text-gray-500">Network Fee: <VibeContentRenderer content="::FaDollarSign className='inline'::" />{formatNum((op as TwoLegArbitrageOpportunity).networkFeeUSD)}</p>
                                            </>
                                        )}
                                        {op.type === '3-leg' && (
                                            <div className="text-xs text-gray-700 dark:text-gray-400 space-y-0.5">
                                                {(op as ThreeLegArbitrageOpportunity).legs.map((leg, i) => (
                                                    <p key={i}><VibeContentRenderer content="::FaRepeat className='inline mr-1'::" /> Leg {i+1}: {leg.action.toUpperCase()} {leg.asset} on {leg.pair} @ ~${formatNum(leg.price, leg.pair.includes('BTC') ? 5 : 2)} (Fee: {formatNum(leg.feeApplied*100,3)}%)</p>
                                                ))}
                                            </div>
                                        )}
                                        <p className="text-xs text-gray-600 dark:text-gray-500 pt-1">Identified: {new Date(op.timestamp).toLocaleString()}</p>
                                    </CardContent>
                                    </Card>
                                </motion.div>
                                ))}
                                </AnimatePresence>
                            </div>
                            )}
                            {(arbitrageOpportunities.length === 0 && !isLoadingArbitrageScan && arbitrageScanLogs.length > 1 && currentArbitrageSettings) && ( 
                                <div className="text-center py-8 text-gray-500">
                                    <VibeContentRenderer content="::FaCoffee className='text-4xl mb-2 mx-auto'::" />
                                    <p>{t("noOpportunitiesFound")}</p>
                                </div>
                            )}

                            {(arbitrageScanLogs.length > 0 || isLoadingArbitrageScan) && (
                            <Card className="mt-6 bg-gray-800/50 border border-gray-700">
                                <CardHeader>
                                <CardTitle className="text-lg font-orbitron text-gray-400 flex items-center"><VibeContentRenderer content="::FaClipboardList className='mr-2'::" />{t("scanLogsTitle")}</CardTitle>
                                </CardHeader>
                                <CardContent>
                                <Textarea
                                    readOnly
                                    value={arbitrageScanLogs.join('\n')}
                                    className="h-40 font-mono text-xs bg-black/50 border-gray-600 text-gray-300 resize-y simple-scrollbar"
                                    placeholder={t("scanLogsPlaceholder")}
                                />
                                </CardContent>
                            </Card>
                            )}
                            
                            <div className="mt-6 p-4 bg-black/30 border border-yellow-600/50 rounded-lg text-xs text-yellow-300/80 space-y-1">
                                <VibeContentRenderer content={t("disclaimer")} />
                            </div>
                             <Link href="/hotvibes" className="block text-center mt-8">
                                <Button variant="outline" className="border-brand-cyan text-brand-cyan hover:bg-brand-cyan/10">
                                    <VibeContentRenderer content="::FaArrowLeft::" /> {t("backToHotVibes")}
                                </Button>
                            </Link>
                        </CardContent>
                    </Card>
                </motion.div>
            </TabsContent>
        </Tabs>
    </div>
  );
}
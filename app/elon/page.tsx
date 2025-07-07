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
import type {
  ArbitrageOpportunity,
  TwoLegArbitrageOpportunity,
  ThreeLegArbitrageOpportunity,
  ArbitrageSettings,
} from './arbitrage_scanner_types';
import {
  fetchArbitrageOpportunities,
  getArbitrageScannerSettings as fetchArbitrageSettings
} from './arbitrage_scanner_actions';

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

const pageTranslations: Record<string, Record<string, any>> = {
  ru: {
    accessDeniedTitle: "Доступ к 'Рынку Маска & Arbitrage Alpha Seeker' Закрыт!",
    accessDeniedDescription: "Чтобы войти в симуляторы, приобретите ПротоКарточку Доступа.",
    purchaseAccessButton: "Купить Доступ за {price} XTR",
    processingButton: "Обработка...",
    authNeededForPurchase: "Для покупки нужна авторизация через Telegram.",
    muskMarketTab: "Рынок Маска",
    arbitrageHubTab: "Арбитраж-Хаб",
    educationTab: "Обучение",
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
    loadingVibeOs: "Загрузка VIBE OS...",
    errorSimulatingTesla: "Ошибка симуляции цены Tesla.",
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
    arbitrageHubTab: "Arbitrage Hub",
    educationTab: "Education",
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
    loadingVibeOs: "Loading VIBE OS...",
    errorSimulatingTesla: "Error simulating Tesla price.",
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
  const [currentLang, setCurrentLang] = useState<'ru' | 'en'>('en');

  useEffect(() => {
    let langToSet: 'ru' | 'en' = 'en';
    if (dbUser?.language_code) {
        langToSet = dbUser.language_code.toLowerCase().startsWith('ru') ? 'ru' : 'en';
    } else if (tgUser?.language_code) {
        langToSet = tgUser.language_code.toLowerCase().startsWith('ru') ? 'ru' : 'en';
    }
    setCurrentLang(langToSet);
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

  useEffect(() => {
    if (hasAccess) {
      fetchStockPrice();
    }
  }, [hasAccess, fetchStockPrice]);

  if (appContextLoading) {
    return <div className="min-h-screen flex items-center justify-center bg-black text-brand-cyan"><VibeContentRenderer content="::FaSpinner className='animate-spin text-4xl'::" /> {t("loadingVibeOs")}</div>;
  }

  if (!hasAccess) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-gray-900 via-purple-900 to-blue-900 p-6 text-center">
        <motion.div initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.5 }}>
          <VibeContentRenderer content="::FaRocket className='text-7xl text-brand-orange mb-6 animate-pulse'::" />
          <h1 className="text-4xl font-orbitron font-bold text-brand-yellow mb-4">{t("accessDeniedTitle")}</h1>
          <p className="text-lg text-gray-300 mb-8 max-w-md">{t("accessDeniedDescription")}</p>
          <Button onClick={handlePurchaseAccess} disabled={isPurchasing || !isAuthenticated} size="lg" className="bg-brand-orange text-black font-orbitron font-bold py-3 px-8 rounded-lg text-lg hover:bg-yellow-400 transition-colors shadow-lg hover:shadow-yellow-500/50">
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
        <Tabs defaultValue="hub" className="max-w-4xl mx-auto">
            <TabsList className="grid w-full grid-cols-3 bg-black/70 border-2 border-brand-purple shadow-lg shadow-brand-purple/30 backdrop-blur-sm mb-6">
                <TabsTrigger value="hub" className="font-orbitron text-sm data-[state=active]:bg-brand-orange data-[state=active]:text-black">
                    <VibeContentRenderer content="::FaHubspot className='mr-2'::"/> {t("arbitrageHubTab")}
                </TabsTrigger>
                <TabsTrigger value="musk_market" className="font-orbitron text-sm data-[state=active]:bg-brand-purple data-[state=active]:text-black">
                    <VibeContentRenderer content="::FaChartLine className='mr-2'::"/> {t("muskMarketTab")}
                </TabsTrigger>
                <TabsTrigger value="education" className="font-orbitron text-sm data-[state=active]:bg-brand-cyan data-[state=active]:text-black">
                    <VibeContentRenderer content="::FaGraduationCap className='mr-2'::"/> {t("educationTab")}
                </TabsTrigger>
            </TabsList>

            <TabsContent value="hub">
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
                    <Card className="bg-black/70 border-2 border-brand-orange shadow-2xl shadow-brand-orange/40 backdrop-blur-md">
                    <CardHeader className="text-center">
                        <CardTitle className="text-4xl font-orbitron text-brand-orange glitch" data-text="Arbitrage Hub">Arbitrage Hub</CardTitle>
                        <CardDescription className="text-orange-300/80">Your command center for seeking Alpha.</CardDescription>
                    </CardHeader>
                    <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <Link href="/arbitrage-live-scanner" passHref>
                        <Card className="p-4 text-center bg-gray-800/60 border border-brand-lime/50 hover:bg-gray-800 hover:border-brand-lime transition-all cursor-pointer">
                            <VibeContentRenderer content="::FaBroadcastTower className='text-4xl text-brand-lime mx-auto mb-2'::" />
                            <h3 className="font-orbitron font-bold text-lg text-brand-lime">Live Seeker</h3>
                            <p className="text-xs text-gray-400">Run a real-time, client-side scan for opportunities using your keys.</p>
                        </Card>
                        </Link>
                        <Link href="/arbitrage-test-agent" passHref>
                        <Card className="p-4 text-center bg-gray-800/60 border border-brand-purple/50 hover:bg-gray-800 hover:border-brand-purple transition-all cursor-pointer">
                            <VibeContentRenderer content="::FaTerminal className='text-4xl text-brand-purple mx-auto mb-2'::" />
                            <h3 className="font-orbitron font-bold text-lg text-brand-purple">Command Deck</h3>
                            <p className="text-xs text-gray-400">Manually trigger server-side functions and view raw DB data. (Admin)</p>
                        </Card>
                        </Link>
                        <Link href="/elon/testbase/arbitrage-viz-sandbox" passHref>
                        <Card className="p-4 text-center bg-gray-800/60 border border-brand-cyan/50 hover:bg-gray-800 hover:border-brand-cyan transition-all cursor-pointer md:col-span-2">
                            <VibeContentRenderer content="::FaCubesStacked className='text-4xl text-brand-cyan mx-auto mb-2'::" />
                            <h3 className="font-orbitron font-bold text-lg text-brand-cyan">Voxel Sandbox</h3>
                            <p className="text-xs text-gray-400">Visualize simulated arbitrage data in a 3D latent space.</p>
                        </Card>
                        </Link>
                    </CardContent>
                    </Card>
                </motion.div>
            </TabsContent>

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
                        <CardDescription className="text-sm sm:text-md text-purple-300 font-mono mt-2">{t("muskMarketDescription")}</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-6">
                        {stockData && (
                            <motion.div key={`${stockData.price}-${stockData.newsFlash}`} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="text-center p-4 sm:p-6 bg-gray-800/60 rounded-lg border border-purple-500/60 shadow-inner">
                            <p className="text-xs sm:text-sm text-gray-400 font-mono">{t("simulatedPriceLabel")}</p>
                            <p className={`text-5xl sm:text-6xl font-orbitron font-bold my-1 sm:my-2 ${stockData.trend === 'up' ? 'text-green-400' : stockData.trend === 'down' ? 'text-red-400' : 'text-gray-200'}`}>
                                ${stockData.price.toFixed(2)}
                            </p>
                            <p className={`text-md sm:text-lg font-mono ${stockData.change >= 0 ? 'text-green-500' : 'text-red-500'}`}>
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
                        <Button onClick={fetchStockPrice} disabled={isLoadingPrice} className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white font-orbitron py-3 text-lg rounded-md shadow-lg hover:shadow-purple-500/50 transition-all">
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
                                <motion.div key={index} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.2 + index * 0.1 }} className="p-3 bg-gray-800/50 border border-pink-500/30 rounded-lg shadow-sm">
                                    <h4 className="text-md font-orbitron text-pink-400 mb-1 flex items-center">
                                        <VibeContentRenderer content={`${advice.icon} `} className="mr-2 text-lg" /> 
                                        <VibeContentRenderer content={advice.titleKey} />
                                    </h4>
                                    <p className="text-xs text-gray-300/90"><VibeContentRenderer content={advice.textKey} /></p>
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
            
            <TabsContent value="education">
               <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                 <Card className="bg-black/70 border-2 border-brand-cyan shadow-2xl shadow-brand-cyan/40 backdrop-blur-md">
                  <CardHeader className="text-center">
                     <CardTitle className="text-4xl font-orbitron text-brand-cyan glitch" data-text="Education">Education</CardTitle>
                     <CardDescription className="text-cyan-300/80">Level up your understanding of the Vibe.</CardDescription>
                  </CardHeader>
                  <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <Link href="/arbitrage-explained" passHref>
                        <Card className="p-4 text-center bg-gray-800/60 border border-brand-blue/50 hover:bg-gray-800 hover:border-brand-blue transition-all cursor-pointer">
                          <VibeContentRenderer content="::FaGraduationCap className='text-4xl text-brand-blue mx-auto mb-2'::" />
                          <h3 className="font-orbitron font-bold text-lg text-brand-blue">Arbitrage School</h3>
                          <p className="text-xs text-gray-400">The fundamentals of arbitrage, scanner logic, and common pitfalls.</p>
                        </Card>
                      </Link>
                       <Link href="/arbitrage-notdummies" passHref>
                        <Card className="p-4 text-center bg-gray-800/60 border border-brand-purple/50 hover:bg-gray-800 hover:border-brand-purple transition-all cursor-pointer">
                          <VibeContentRenderer content="::FaBrain className='text-4xl text-brand-purple mx-auto mb-2'::" />
                          <h3 className="font-orbitron font-bold text-lg text-brand-purple">Deep Dive</h3>
                          <p className="text-xs text-gray-400">Explore the metaphysics: latent spaces, E.E.R. models, and scientific analogies.</p>
                        </Card>
                      </Link>
                  </CardContent>
                 </Card>
               </motion.div>
            </TabsContent>

        </Tabs>
    </div>
  );
}
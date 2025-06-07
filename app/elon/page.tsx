"use client";
import React, { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { VibeContentRenderer } from '@/components/VibeContentRenderer';
import { useAppContext } from '@/contexts/AppContext';
import { teslaStockSimulator } from './actions'; 
import { purchaseProtoCardAction } from '../hotvibes/actions'; 
import type { ProtoCardDetails } from '../hotvibes/actions';
import { toast } from 'sonner';
import { logger } from '@/lib/logger';
import Link from 'next/link';

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

const jordanBelfortAdvices = [
    {
        titleKey: "Волчий Вайб №1: НЕПРОБИВАЕМАЯ УВЕРЕННОСТЬ!",
        textKey: "Джордан Белфорт учит: 'Продажа – это передача эмоции'. Главная эмоция – УВЕРЕННОСТЬ. Ты должен быть на 10 из 10 уверен, что твой 'продукт' (в нашем случае – твоя ставка на вайб Маска) – это лучшее, что есть! Если ты сам не веришь, что TSLA взлетит/упадет после 'прикола' Маска – как ты заставишь XTR-рынок поверить в это?",
        icon: "::FaHandshake::"
    },
    {
        titleKey: "Волчий Вайб №2: ЗАХВАТИ КОНТРОЛЬ ЗА 4 СЕКУНДЫ!",
        textKey: "У тебя 4 секунды, чтобы показать, что ты: 1. Резкий как Пуля. 2. Энтузиаст до Мозга Костей. 3. Эксперт, Мать Его! В симуляторе: увидел Вайб -> мгновенно оценил -> с энтузиазмом 'купил ПротоКарточку' -> показал, что ты 'в теме' рынка Маска.",
        icon: "::FaBolt::"
    },
    {
        titleKey: "Волчий Вайб №3: ДЕРЖИ ПРЯМУЮ ЛИНИЮ!",
        textKey: "Рынок всегда пытается увести тебя с 'прямой линии' к успеху. Возражения, сомнения... Твоя задача – элегантно возвращать его, повышая уверенность. 'Маск твитнул про кота? Отлично! Это подтверждает мой анализ! Покупаем/Шортим СЕЙЧАС!' Каждое 'НЕТ' от рынка – запрос на большую уверенность.",
        icon: "::FaChartLine className='transform rotate-90'::"
    },
    {
        titleKey: "Волчий Вайб №4: УПРАВЛЯЙ СВОИМ СОСТОЯНИЕМ!",
        textKey: "Страх, сомнения, жадность – твои враги. Будь в ресурсном состоянии: уверенность, ясность, смелость. Потерял XTR? Не ной! Анализируй, управляй эмоциями, готовься к следующему Вайбу. Успешные 'трейдеры' действуют перед лицом страха.",
        icon: "::FaBrain::"
    },
    {
        titleKey: "Волчий Вайб №5: ПОДГОТОВКА РЕШАЕТ!",
        textKey: "Белфорт писал скрипты часами. Ты – изучай 'историю твитов Маска' (предыдущие NewsFlash в симуляторе), смотри на 'тренд'. Не кликай наобум! Думай, Агент!",
        icon: "::FaScroll::"
    }
];

export default function ElonPage() {
  const { dbUser, isAuthenticated, isLoading: appContextLoading } = useAppContext();
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
      toast.error("Ошибка симуляции цены Tesla.");
      logger.error("ElonPage: Error fetching stock price", error);
    }
    setIsLoadingPrice(false);
  }, []);

  useEffect(() => {
    if (hasAccess) {
      fetchStockPrice();
    }
  }, [fetchStockPrice, hasAccess]);

  const handlePurchaseAccess = async () => {
    if (!isAuthenticated || !dbUser?.user_id) {
      toast.error("Сначала авторизуйтесь для покупки доступа!");
      return;
    }
    setIsPurchasing(true);
    const cardDetails: ProtoCardDetails = {
      cardId: ELON_SIMULATOR_CARD_ID,
      title: `Доступ к Симулятору Маска`,
      description: `Разблокировать симулятор влияния твитов Илона и 'русского вайба' на акции Tesla. Цена: ${SIMULATOR_ACCESS_PRICE_XTR} XTR.`,
      amountXTR: SIMULATOR_ACCESS_PRICE_XTR,
      type: "simulation_access", 
      metadata: { page_link: "/elon", simulator_name: "Рынок Маска TSLA Edition" }
    };

    try {
      const result = await purchaseProtoCardAction(dbUser.user_id, cardDetails); 
      if (result.success) {
        toast.success("Запрос на доступ отправлен! Проверьте Telegram для оплаты счета.");
      } else {
        toast.error(result.error || "Не удалось инициировать покупку доступа.");
      }
    } catch (error) {
      toast.error("Ошибка при запросе на покупку доступа.");
      logger.error("ElonPage: Error purchasing access", error);
    }
    setIsPurchasing(false);
  };

  if (appContextLoading) {
    return <div className="min-h-screen flex items-center justify-center bg-black text-brand-cyan"><VibeContentRenderer content="::FaSpinner className='animate-spin text-4xl':: Загрузка VIBE OS..." /></div>;
  }

  if (!hasAccess) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-gray-900 via-purple-900 to-blue-900 p-6 text-center">
        <motion.div initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.5 }}>
          <VibeContentRenderer content="::FaRocket className='text-7xl text-brand-orange mb-6 animate-pulse'::" />
          <h1 className="text-4xl font-orbitron font-bold text-brand-yellow mb-4">Доступ к 'Рынку Маска' Закрыт!</h1>
          <p className="text-lg text-gray-300 mb-8 max-w-md">
            Чтобы войти в симулятор влияния твитов Илона и "русского экономического вайба" на фантомные акции, приобретите ПротоКарточку Доступа.
          </p>
          <Button
            onClick={handlePurchaseAccess}
            disabled={isPurchasing || !isAuthenticated}
            size="lg"
            className="bg-brand-orange text-black font-orbitron font-bold py-3 px-8 rounded-lg text-lg hover:bg-yellow-400 transition-colors shadow-lg hover:shadow-yellow-500/50"
          >
            {isPurchasing ? <VibeContentRenderer content="::FaSpinner className='animate-spin mr-2':: Обработка..." /> : `Купить Доступ за ${SIMULATOR_ACCESS_PRICE_XTR} XTR`}
          </Button>
          {!isAuthenticated && <p className="text-xs text-red-400 mt-3">Для покупки нужна авторизация через Telegram.</p>}
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-black via-indigo-900 to-black text-white p-4 pt-24">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-4xl mx-auto" 
      >
        <Card className="bg-black/70 border-2 border-brand-purple shadow-2xl shadow-brand-purple/30 backdrop-blur-md">
          <CardHeader className="text-center">
            <motion.div initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ delay: 0.2, type: "spring", stiffness: 150 }}>
              <VibeContentRenderer content="::FaChartLine className='text-6xl text-brand-orange mx-auto mb-4 filter drop-shadow-[0_0_8px_hsl(var(--brand-orange-rgb))]'::" />
            </motion.div>
            <CardTitle className="text-3xl sm:text-4xl font-orbitron font-bold text-brand-orange glitch" data-text="Рынок Маска: TSLA & Russian Vibe Edition">
              Рынок Маска: TSLA & Russian Vibe Edition
            </CardTitle>
            <CardDescription className="text-sm sm:text-md text-purple-300 font-mono mt-2">
              Симулятор влияния твитов, новостей и "особого русского вайба" на фантомные акции Tesla.
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
                <p className="text-xs sm:text-sm text-gray-400 font-mono">Симулированная цена TSLA:</p>
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
              {isLoadingPrice ? <VibeContentRenderer content="::FaSpinner className='animate-spin mr-2':: Обновляю вайб..." /> : <VibeContentRenderer content="::FaDiceD6:: Какой Вайб Сегодня? (Маск/РФ/Трамп)" />}
            </Button>
            
            <div className="space-y-3 text-xs sm:text-sm text-gray-300/90 font-mono p-3 sm:p-4 bg-black/40 rounded-md border border-gray-700/80">
              <h3 className="text-lg sm:text-xl font-orbitron text-brand-cyan mb-2 sm:mb-3">Механика Рынка (на пальцах):</h3>
              <p><VibeContentRenderer content="::FaCircleInfo:: Агент, это симулятор! Реальные деньги не участвуют. Мы играем с XTR и KiloVibes."/></p>
              <p><strong className="text-brand-yellow">Вайбы Маска, Трампа & РФ:</strong> Каждый клик на кнопку симулирует новый 'вайб' – твит Маска, заявление Трампа или 'экономическое чудо' из РФ. Позитив = <VibeContentRenderer content="::FaArrowTrendUp::"/>, Негатив = <VibeContentRenderer content="::FaArrowTrendDown::"/>. Следи за `NewsFlash`!</p>
              <p><strong className="text-brand-yellow">Конфликт Маск-Трамп:</strong> Публичная перепалка этих двоих – отдельный мощный фактор для TSLA. Обычно не в плюс. <VibeContentRenderer content="::FaUserNinja::"/> <VibeContentRenderer content="::FaUserTie::"/></p>
              <p className="text-brand-red/80"><VibeContentRenderer content="::FaTriangleExclamation:: Особый Русский Вайб:"/> Иногда, если 'стабильность' в РФ 'отрицательно растет', это может вызвать... неожиданные колебания. Или нет. Никто не знает. Это Россия, детка. <VibeContentRenderer content="::FaSnowflake::"/></p>
              <p className="text-brand-green"><VibeContentRenderer content="::FaGraduationCap:: Главная Цель:"/> Понять, как инфо-шум влияет на настроения... и словить немного XTR-фана! VIBE ON!</p>
            </div>

            <div className="mt-6 space-y-4">
                <h3 className="text-2xl font-orbitron text-brand-pink text-center glitch" data-text="Советы Волка">Советы Волка</h3>
                {jordanBelfortAdvices.map((advice, index) => (
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
                    <VibeContentRenderer content="::FaArrowLeft:: Назад в Лобби Горячих Вайбов"/>
                </Button>
            </Link>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
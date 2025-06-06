"use client";
import React, { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { VibeContentRenderer } from '@/components/VibeContentRenderer';
import { useAppContext } from '@/contexts/AppContext';
import { teslaStockSimulator } from './actions'; // Simulator function
import { purchaseProtoCardAction } from '../hotvibes/actions'; // Action to buy card
import type { ProtoCardDetails } from '../hotvibes/actions';
import { toast } from 'sonner';
import { logger } from '@/lib/logger';
import Link from 'next/link';

interface TeslaStockData {
  price: number;
  change: number;
  changePercent: number;
  trend: "up" | "down" | "stable";
  lastElonTweetEffect?: "positive" | "negative" | "neutral" | null;
  newsFlash?: string | null;
}

const ELON_SIMULATOR_CARD_ID = "elon_simulator_access_v1";
const SIMULATOR_ACCESS_PRICE_XTR = 13;

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
      description: `Разблокировать симулятор влияния твитов Илона на акции Tesla. Цена: ${SIMULATOR_ACCESS_PRICE_XTR} XTR.`,
      amountXTR: SIMULATOR_ACCESS_PRICE_XTR,
      type: "simulation_access",
      metadata: { page_link: "/elon" }
    };

    try {
      const result = await purchaseProtoCardAction(cardDetails); // This action now calls sendAndRecordProtoCardInvoice
      if (result.success) {
        toast.success("Запрос на доступ отправлен! Проверьте Telegram для оплаты счета.");
        // Доступ будет предоставлен через вебхук после оплаты
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
          <VibeContentRenderer content="::FaRocketLaunch className='text-7xl text-brand-orange mb-6 animate-pulse'::" />
          <h1 className="text-4xl font-orbitron font-bold text-brand-yellow mb-4">Доступ к 'Рынку Маска' Закрыт!</h1>
          <p className="text-lg text-gray-300 mb-8 max-w-md">
            Чтобы войти в симулятор влияния твитов Илона и понять, как новости (иногда фейковые) двигают рынки, приобретите ПротоКарточку Доступа.
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
        className="max-w-3xl mx-auto"
      >
        <Card className="bg-black/70 border-2 border-brand-purple shadow-2xl shadow-brand-purple/30 backdrop-blur-md">
          <CardHeader className="text-center">
            <motion.div initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ delay: 0.2, type: "spring", stiffness: 150 }}>
              <VibeContentRenderer content="::FaChartLine className='text-6xl text-brand-orange mx-auto mb-4 filter drop-shadow-[0_0_8px_hsl(var(--brand-orange-rgb))]'::" />
            </motion.div>
            <CardTitle className="text-4xl font-orbitron font-bold text-brand-orange glitch" data-text="Рынок Маска: TSLA Edition">
              Рынок Маска: TSLA Edition
            </CardTitle>
            <CardDescription className="text-md text-purple-300 font-mono mt-2">
              Симулятор влияния твитов и новостей на (фантомные) акции Tesla.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {stockData && (
              <motion.div
                key={stockData.price} // Re-trigger animation on price change
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-center p-6 bg-gray-800/50 rounded-lg border border-purple-500/50"
              >
                <p className="text-sm text-gray-400 font-mono">Симулированная цена TSLA:</p>
                <p className={`text-6xl font-orbitron font-bold my-2 ${
                  stockData.trend === 'up' ? 'text-green-400' : stockData.trend === 'down' ? 'text-red-400' : 'text-gray-200'
                }`}>
                  ${stockData.price.toFixed(2)}
                </p>
                <p className={`text-lg font-mono ${
                  stockData.change >= 0 ? 'text-green-500' : 'text-red-500'
                }`}>
                  {stockData.change >= 0 ? '+' : ''}{stockData.change.toFixed(2)} ({stockData.changePercent.toFixed(2)}%)
                  {stockData.trend === 'up' && <VibeContentRenderer content="::FaArrowTrendUp::" />}
                  {stockData.trend === 'down' && <VibeContentRenderer content="::FaArrowTrendDown::" />}
                </p>
                {stockData.newsFlash && (
                    <p className="text-sm text-purple-300 mt-3 italic">
                        <VibeContentRenderer content="::FaNewspaper className='inline mr-1'::" /> {stockData.newsFlash}
                    </p>
                )}
              </motion.div>
            )}
            <Button
              onClick={fetchStockPrice}
              disabled={isLoadingPrice}
              className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white font-orbitron py-3 text-lg rounded-md shadow-lg hover:shadow-purple-500/50 transition-all"
            >
              {isLoadingPrice ? <VibeContentRenderer content="::FaSpinner className='animate-spin mr-2':: Обновляю вайб..." /> : <VibeContentRenderer content="::FaRandom:: Какой Вайб Сегодня? (Твит Маска)" />}
            </Button>
            
            <div className="space-y-4 text-sm text-gray-300 font-mono p-4 bg-black/30 rounded-md border border-gray-700">
              <h3 className="text-xl font-orbitron text-brand-cyan mb-3">Механика Рынка (на пальцах):</h3>
              <p><VibeContentRenderer content="::FaInfoCircle:: Агент, это симулятор! Реальные деньги не участвуют. Мы играем с XTR и KiloVibes."/></p>
              <p><strong className="text-brand-yellow">Твиты Маска:</strong> Каждый клик на кнопку "Какой Вайб Сегодня?" симулирует новый твит или новость. Иногда это позитив (новые технологии, рекорды продаж) - цена TSLA <VibeContentRenderer content="::FaArrowTrendUp::"/>. Иногда - негатив (скандалы, проблемы с производством) - цена TSLA <VibeContentRenderer content="::FaArrowTrendDown::"/>. Иногда - нейтрально.</p>
              <p><strong className="text-brand-yellow">Шорт (Short Selling):</strong> Видишь, что Маск "чудит" и ждешь падения? В реальном мире трейдеры "шортят": берут акции взаймы у брокера, продают по текущей высокой цене. Если цена падает, они откупают акции дешевле, возвращают брокеру, а разницу кладут в карман. Риск: если цена пойдет вверх, убытки могут быть большими. Здесь мы это просто симулируем для понимания.</p>
              <p><strong className="text-brand-yellow">Лонг (Long Position):</strong> Веришь в Tesla и Маска? "Покупаешь" (фантомно), когда цена кажется низкой, и "держишь" (HODL!), ожидая роста. Если цена растет - ты в "профите".</p>
              <p className="text-brand-red/80"><VibeContentRenderer content="::FaExclamationTriangle:: Особенность Российского Вайба:"/> В отличие от некоторых западных рынков, где после падения часто бывает отскок (bounce back), на нашем специфическом рынке иногда "если упало - то лежит". Это значит, что слепое копирование стратегий "купи на низах" или "шорти на хаях" без учета локального контекста может привести к... ну, ты понял. <VibeContentRenderer content="::FaSkullCrossbones::"/></p>
              <p className="text-brand-green"><VibeContentRenderer content="::FaGraduationCap:: Главная Цель:"/> Научиться "чувствовать" вайбы рынка, понимать, как информация (и дезинформация) влияет на настроения... и просто повеселиться с XTR! VIBE ON!</p>
            </div>
             <Link href="/hotvibes" className="block text-center mt-6">
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
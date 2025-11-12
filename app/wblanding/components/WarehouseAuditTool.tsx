'use client';

import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { FaChartLine, FaRocket, FaSpinner, FaTelegram } from 'react-icons/fa6';
import Link from 'next/link';
import { useWarehouseAudit } from '../hooks/useWarehouseAudit';
import { useAppContext } from '@/contexts/AppContext';

export const WarehouseAuditTool = () => {
  const { dbUser } = useAppContext();
  const {
    step,
    questions,
    currentAnswer,
    isSending,
    breakdown,
    showResult,
    setCurrentAnswer,
    handleNext,
    handleGetReport,
    reset,
  } = useWarehouseAudit(dbUser?.user_id);

  if (step === 0 && !showResult) {
    return (
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="bg-white rounded-2xl p-6 sm:p-8 shadow-xl max-w-2xl mx-auto">
        <div className="text-center mb-6">
          <h3 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-3">Рассчитайте ваши потери за 60 секунд</h3>
          <p className="text-gray-600 text-base sm:text-lg">Узнайте, сколько денег и времени теряет ваш склад сейчас</p>
        </div>
        <div className="text-center">
          <Button onClick={() => setStep(1)} size="lg" className="bg-red-500 hover:bg-red-600 text-white px-4 sm:px-6 py-3 sm:py-4 rounded-full font-bold text-base sm:text-lg w-full sm:w-auto">
            <FaRocket className="mr-2" /> НАЧАТЬ БЕСПЛАТНЫЙ АУДИТ
          </Button>
        </div>
      </motion.div>
    );
  }

  if (showResult && breakdown) {
    const totalLosses = breakdown.timeCost + breakdown.penaltyCost + breakdown.missedSales;
    
    return (
      <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="bg-white rounded-2xl p-6 sm:p-8 shadow-xl max-w-2xl mx-auto">
        <div className="text-center mb-6">
          <FaChartLine className="text-5xl sm:text-6xl text-red-500 mx-auto mb-4" />
          <h3 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-3">
            Вы теряете: ~{totalLosses.toLocaleString('ru-RU')}₽/мес
          </h3>
          <p className="text-gray-600 text-base sm:text-lg mb-4">И тратите {breakdown.hours} часов на рутину</p>
        </div>
        <div className="bg-red-50 p-5 sm:p-6 rounded-xl mb-6">
          <h4 className="font-bold text-lg sm:text-xl text-red-800 mb-3">Как это возможно?</h4>
          <ul className="space-y-2 text-red-700 text-sm sm:text-base">
            <li>• Штрафы за ошибки: {breakdown.penaltyCost.toLocaleString('ru-RU')}₽</li>
            <li>• Стоимость вашего времени: {breakdown.timeCost.toLocaleString('ru-RU')}₽</li>
            <li>• Упущенные продажи ({breakdown.skus} SKU × {breakdown.stores} магазинов): {breakdown.missedSales.toLocaleString('ru-RU')}₽</li>
          </ul>
        </div>

        <div className="mb-6">
          {dbUser?.user_id ? (
            <div className="text-center">
              <p className="text-gray-600 mb-4 text-sm">Персональный план будет отправлен вам в Telegram</p>
              <Button onClick={handleGetReport} disabled={isSending} className="w-full bg-green-600 hover:bg-green-700 text-white text-lg py-4">
                {isSending ? (
                  <>
                    <FaSpinner className="animate-spin mr-2" /> Отправка...
                  </>
                ) : (
                  <>
                    <FaTelegram className="mr-2" /> ПОЛУЧИТЬ ПЛАН ЭКОНОМИИ
                  </>
                )}
              </Button>
            </div>
          ) : (
            <div className="text-center p-4 bg-blue-50 rounded-xl">
              <p className="text-gray-700 mb-3">
                <Link href="/wb" className="text-blue-600 hover:text-blue-800 font-semibold underline">
                  Войдите в приложение
                </Link>
                , чтобы получить персональный план в Telegram
              </p>
              <p className="text-sm text-gray-500">Это быстро и безопасно через ваш Telegram аккаунт</p>
            </div>
          )}
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="bg-white rounded-2xl p-6 sm:p-8 shadow-xl max-w-2xl mx-auto">
      <div className="mb-6">
        <div className="flex justify-between items-center mb-4">
          <span className="text-sm text-gray-500">Шаг {step} из {questions.length}</span>
          <Button variant="ghost" size="sm" onClick={reset}>Начать заново</Button>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div className="bg-red-500 h-2 rounded-full transition-all" style={{ width: `${(step / questions.length) * 100}%` }}></div>
        </div>
      </div>
      <div className="mb-6">
        <Label className="text-xl font-bold text-gray-900 mb-6 block">{questions[step].text}</Label>
        <Input
          type={questions[step].type}
          placeholder={questions[step].placeholder}
          value={currentAnswer}
          onChange={(e) => setCurrentAnswer(e.target.value)}
          onKeyPress={(e) => { if (e.key === 'Enter') handleNext(); }}
          className="py-5 text-lg"
          autoFocus
        />
      </div>
      <div className="flex gap-3">
        {step > 1 && <Button variant="outline" onClick={() => setStep(step - 1)} className="flex-1">Назад</Button>}
        <Button onClick={handleNext} className="flex-1 bg-red-500 hover:bg-red-600 text-white text-lg py-4">
          Далее
          <FaRocket className="ml-2" />
        </Button>
      </div>
    </motion.div>
  );
};
'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Label } from '@//components/ui/label';
import { Input } from '@/components/ui/input';
import { FaChartLine, FaRocket, FaCheckCircle, FaSparkles, FaTelegram, FaRedo } from 'react-icons/fa';
import { Loader2, AlertTriangle, TrendingUp, Zap } from 'lucide-react';
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
    totalLosses,
    efficiency,
    setCurrentAnswer,
    handleNext,
    handleGetReport,
    reset,
    startAudit,
    validateAnswer,
  } = useWarehouseAudit(dbUser?.user_id);

  if (step === 0 && !showResult) {
    return (
      <motion.div 
        initial={{ opacity: 0, y: 20 }} 
        animate={{ opacity: 1, y: 0 }}
        className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-3xl p-8 sm:p-12 shadow-2xl max-w-2xl mx-auto border border-blue-100"
      >
        <motion.div 
          className="text-center mb-8"
          initial={{ scale: 0.9 }}
          animate={{ scale: 1 }}
          transition={{ type: "spring", stiffness: 200 }}
        >
          <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-full mb-6 shadow-lg">
            <FaChartLine className="text-4xl text-white" />
          </div>
          <h3 className="text-3xl font-bold text-gray-900 mb-3">
            Оптимизация склада за 60 секунд
          </h3>
          <p className="text-lg text-gray-600">
            Узнайте, как увеличить эффективность и сэкономить время
          </p>
        </motion.div>
        
        <motion.div 
          className="text-center"
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
        >
          <Button 
            onClick={startAudit} 
            size="lg" 
            className="bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white px-8 py-4 rounded-full font-bold text-lg shadow-xl transition-all duration-300"
          >
            <motion.span className="flex items-center">
              <FaRocket className="mr-3 text-xl" />
              НАЧАТЬ БЕСПЛАТНЫЙ АУДИТ
              <motion.div
                className="ml-3"
                animate={{ rotate: 360 }}
                transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
              >
                <Zap className="w-5 h-5" />
              </motion.div>
            </motion.span>
          </Button>
        </motion.div>
        
        <motion.div 
          className="mt-8 grid grid-cols-3 gap-4 text-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
        >
          <div className="p-3 bg-white/60 rounded-xl">
            <div className="text-2xl font-bold text-blue-600">73%</div>
            <div className="text-xs text-gray-500 mt-1">Снижение ошибок</div>
          </div>
          <div className="p-3 bg-white/60 rounded-xl">
            <div className="text-2xl font-bold text-green-600">20+</div>
            <div className="text-xs text-gray-500 mt-1">Часов экономии</div>
          </div>
          <div className="p-3 bg-white/60 rounded-xl">
            <div className="text-2xl font-bold text-purple-600">1000+</div>
            <div className="text-xs text-gray-500 mt-1">Довольных клиентов</div>
          </div>
        </motion.div>
      </motion.div>
    );
  }

  if (showResult && breakdown) {
    return (
      <motion.div 
        initial={{ opacity: 0, scale: 0.9 }} 
        animate={{ opacity: 1, scale: 1 }}
        className="bg-gradient-to-br from-white to-gray-50 rounded-3xl p-8 sm:p-12 shadow-2xl max-w-3xl mx-auto border border-gray-200"
      >
        <motion.div 
          className="text-center mb-8"
          initial={{ y: -20 }}
          animate={{ y: 0 }}
        >
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", stiffness: 300, delay: 0.2 }}
            className="inline-flex"
          >
            <FaCheckCircle className="text-6xl text-green-500 mx-auto mb-4" />
          </motion.div>
          <h3 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-3">
            Ваш потенциал роста: ~{(totalLosses * 0.7).toLocaleString('ru-RU')}₽/мес
          </h3>
          <p className="text-lg text-gray-600">
            Эффективность вашего склада: <span className="font-bold text-blue-600">{efficiency}%</span>
          </p>
        </motion.div>

        <motion.div 
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ staggerChildren: 0.1 }}
        >
          {[
            { label: 'Время', value: `${breakdown.hours} ч`, color: 'blue', icon: FaClock },
            { label: 'Штрафы', value: `${breakdown.penaltyCost.toLocaleString()}₽`, color: 'red', icon: FaExclamationTriangle },
            { label: 'Упущено', value: `${breakdown.missedSales.toLocaleString()}₽`, color: 'orange', icon: FaChartLine },
            { label: 'Ошибки', value: `${breakdown.humanErrorCost.toLocaleString()}₽`, color: 'purple', icon: FaSyncAlt },
          ].map((item, idx) => {
            const Icon = item.icon;
            return (
              <motion.div
                key={item.label}
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: idx * 0.1 }}
                className={`bg-${item.color}-50 p-4 rounded-xl text-center border-2 border-${item.color}-100`}
                whileHover={{ scale: 1.05 }}
              >
                <Icon className={`w-8 h-8 text-${item.color}-600 mx-auto mb-2`} />
                <div className={`text-2xl font-bold text-${item.color}-600`}>{item.value}</div>
                <div className="text-xs text-gray-500 mt-1">{item.label}</div>
              </motion.div>
            );
          })}
        </motion.div>

        <motion.div 
          className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-xl p-6 mb-8"
          initial={{ x: -20, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          transition={{ delay: 0.5 }}
        >
          <h4 className="font-bold text-xl text-blue-900 mb-4 flex items-center gap-3">
            <FaSparkles className="text-blue-600" />
            Ваша дорожная карта оптимизации:
          </h4>
          <ul className="space-y-3">
            {breakdown.penaltyCost > 20000 && (
              <motion.li 
                className="flex items-start gap-3 bg-white p-3 rounded-lg shadow-sm"
                initial={{ x: -10, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                transition={{ delay: 0.6 }}
              >
                <div className="w-2 h-2 bg-red-500 rounded-full mt-2"></div>
                <div>
                  <span className="font-semibold text-red-800">Экономия на штрафах:</span>
                  <span className="text-gray-700 ml-2">до {breakdown.penaltyCost.toLocaleString()}₽/мес</span>
                </div>
              </motion.li>
            )}
            {breakdown.hours > 10 && (
              <motion.li 
                className="flex items-start gap-3 bg-white p-3 rounded-lg shadow-sm"
                initial={{ x: -10, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                transition={{ delay: 0.7 }}
              >
                <div className="w-2 h-2 bg-blue-500 rounded-full mt-2"></div>
                <div>
                  <span className="font-semibold text-blue-800">Экономия времени:</span>
                  <span className="text-gray-700 ml-2">{breakdown.hours} часов/мес</span>
                </div>
              </motion.li>
            )}
            {breakdown.stores > 1 && (
              <motion.li 
                className="flex items-start gap-3 bg-white p-3 rounded-lg shadow-sm"
                initial={{ x: -10, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                transition={{ delay: 0.8 }}
              >
                <div className="w-2 h-2 bg-green-500 rounded-full mt-2"></div>
                <div>
                  <span className="font-semibold text-green-800">Централизация:</span>
                  <span className="text-gray-700 ml-2">{breakdown.stores} маркетплейсов → 1 система</span>
                </div>
              </motion.li>
            )}
          </ul>
        </motion.div>

        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.9 }}
        >
          {dbUser?.user_id ? (
            <div className="text-center space-y-4">
              <p className="text-gray-600 flex items-center justify-center gap-2">
                <FaTelegram className="text-blue-500" />
                Персональный план будет отправлен вам в Telegram
              </p>
              <Button 
                onClick={handleGetReport} 
                disabled={isSending}
                className="w-full bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white text-lg py-4 rounded-xl shadow-lg transition-all duration-300"
              >
                <AnimatePresence mode="wait">
                  {isSending ? (
                    <motion.span
                      key="sending"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="flex items-center justify-center"
                    >
                      <Loader2 className="animate-spin mr-2" /> Генерация плана...
                    </motion.span>
                  ) : (
                    <motion.span
                      key="send"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="flex items-center justify-center"
                    >
                      <FaRocket className="mr-2" /> ПОЛУЧИТЬ ПЛАН ОПТИМИЗАЦИИ
                    </motion.span>
                  )}
                </AnimatePresence>
              </Button>
              <Button 
                onClick={reset}
                variant="ghost"
                className="text-gray-500 hover:text-gray-700"
              >
                <FaRedo className="mr-2" /> Пройти еще раз
              </Button>
            </div>
          ) : (
            <motion.div
              initial={{ scale: 0.95 }}
              animate={{ scale: 1 }}
              className="text-center p-6 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl border border-blue-200"
            >
              <p className="text-gray-700 mb-3">
                <Link href="/wb" className="text-blue-600 hover:text-blue-800 font-bold underline">
                  Войдите в систему
                </Link>
                , чтобы получить персональный план
              </p>
              <p className="text-sm text-gray-500 flex items-center justify-center gap-2">
                <FaTelegram className="text-blue-500" />
                Быстро и безопасно через Telegram
              </p>
            </motion.div>
          )}
        </motion.div>
      </motion.div>
    );
  }

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }} 
      animate={{ opacity: 1, y: 0 }}
      className="bg-gradient-to-br from-white to-gray-50 rounded-3xl p-8 sm:p-10 shadow-2xl max-w-2xl mx-auto"
    >
      <motion.div 
        className="mb-6"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.1 }}
      >
        <div className="flex justify-between items-center mb-4">
          <span className="text-sm font-medium text-gray-500">
            Шаг {step} из {questions.length}
          </span>
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={reset}
            className="text-gray-400 hover:text-gray-600"
          >
            <FaRedo className="mr-1" /> Начать заново
          </Button>
        </div>
        <div className="relative h-3 bg-gray-200 rounded-full overflow-hidden">
          <motion.div 
            className="absolute inset-y-0 left-0 bg-gradient-to-r from-blue-500 to-indigo-600"
            initial={{ width: 0 }}
            animate={{ width: `${(step / questions.length) * 100}%` }}
            transition={{ duration: 0.5, ease: "easeOut" }}
          />
          <motion.div 
            className="absolute inset-0 bg-white/30"
            animate={{ x: ["0%", "100%"] }}
            transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
          />
        </div>
      </motion.div>

      <motion.div 
        className="mb-6"
        initial={{ x: -10 }}
        animate={{ x: 0 }}
      >
        <Label className="text-xl sm:text-2xl font-bold text-gray-900 mb-6 block leading-tight">
          {questions[step].text}
        </Label>
        <div className="relative">
          <Input
            type={questions[step].type}
            placeholder={questions[step].placeholder}
            value={currentAnswer}
            onChange={(e) => setCurrentAnswer(e.target.value)}
            onKeyPress={(e) => { if (e.key === 'Enter') handleNext(); }}
            className="py-6 text-lg pr-12 bg-white border-2 border-gray-200 focus:border-blue-500 focus:ring-0 transition-colors"
            autoFocus
          />
          <motion.div 
            className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400"
            animate={{ rotate: currentAnswer ? 0 : 12 }}
            transition={{ type: "spring" }}
          >
            <FaKeyboard className="w-5 h-5" />
          </motion.div>
        </div>
        <AnimatePresence>
          {validateAnswer(currentAnswer, questions[step]) && (
            <motion.p
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="text-red-500 text-sm mt-3 flex items-center gap-2 bg-red-50 p-2 rounded-lg"
            >
              <AlertTriangle className="w-4 h-4" />
              {validateAnswer(currentAnswer, questions[step])}
            </motion.p>
          )}
        </AnimatePresence>
      </motion.div>

      <motion.div 
        className="flex gap-3"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.2 }}
      >
        {step > 1 && (
          <Button 
            variant="outline" 
            onClick={() => setStep(step - 1)} 
            className="flex-1 py-6 text-lg border-2"
          >
            Назад
          </Button>
        )}
        <Button 
          onClick={handleNext} 
          className="flex-1 bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white text-lg py-6 rounded-xl shadow-lg transition-all duration-300"
        >
          <motion.span className="flex items-center justify-center">
            {step === questions.length ? 'Получить результат' : 'Далее'}
            <FaRocket className="ml-2" />
          </motion.span>
        </Button>
      </motion.div>
    </motion.div>
  );
};
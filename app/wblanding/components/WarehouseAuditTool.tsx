'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { FaChartLine, FaRocket, FaCheckCircle, FaMagic, FaTelegram, FaRedo, FaKeyboard, FaClock, FaExclamationTriangle, FaSyncAlt, FaUsers, FaFire, FaPaperPlane, FaBell, FaInfoCircle } from 'react-icons/fa';
import { Loader2, AlertTriangle, TrendingUp, Zap, ChevronLeft, ChevronRight, Star, Target, Coins, TrendingDown } from 'lucide-react';
import Link from 'next/link';
import { useWarehouseAudit } from '../hooks/useWarehouseAudit';
import { useAppContext } from '@/contexts/AppContext';
import { useState, useEffect } from 'react';

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
    estimatedTime,
    roadmap,
    setCurrentAnswer,
    handleNext,
    handleGetReport,
    reset,
    startAudit,
    validateAnswer,
    trackAuditEvent,
  } = useWarehouseAudit(dbUser?.user_id);

  const [validationResult, setValidationResult] = useState<{ type: 'error' | 'warning' | 'critical' | null; message: string; icon?: string }>(null);
  const [selectedMetric, setSelectedMetric] = useState<string | null>(null);

  // Dynamic validation with context
  useEffect(() => {
    if (step > 0 && currentAnswer) {
      const error = validateAnswer(currentAnswer, questions[step]);
      if (error) {
        setValidationResult({ type: 'error', message: error });
      } else {
        // Contextual warnings
        const num = parseInt(currentAnswer, 10);
        const question = questions[step];
        
        if (question.id === 'skus' && num > 500) {
          setValidationResult({ type: 'warning', message: 'Рекомендуем Про-план для 500+ SKU', icon: '📈' });
        } else if (question.id === 'penalties' && num > 25000) {
          setValidationResult({ type: 'critical', message: 'Ваши потери критичны! Начните сегодня', icon: '⚠️' });
        } else if (question.id === 'stores' && num > 2) {
          setValidationResult({ type: 'warning', message: 'Многоканальность требует автоматизации', icon: '🎯' });
        } else {
          setValidationResult(null);
        }
      }
    } else {
      setValidationResult(null);
    }
  }, [currentAnswer, step, questions, validateAnswer]);

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
          <motion.div
            className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-full mb-6 shadow-lg"
            animate={{ rotate: 360 }}
            transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
          >
            <FaChartLine className="text-4xl text-white" />
          </motion.div>
          <h3 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-3">
            Оптимизация склада за <span className="text-blue-600">{estimatedTime}</span>
          </h3>
          <p className="text-lg text-gray-600">
            Узнайте, как увеличить эффективность и сэкономить время
          </p>
          
          {/* Social Proof */}
          <motion.div 
            className="mt-4 bg-green-50 border border-green-200 rounded-xl p-3 text-sm text-green-800 max-w-md mx-auto"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.5 }}
          >
            <FaUsers className="inline mr-2" /> 
            <strong>1,247+</strong> складов уже оптимизировано
          </motion.div>
        </motion.div>
        
        <motion.div 
          className="text-center"
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
        >
          <Button 
            onClick={() => {
              startAudit();
              trackAuditEvent('start_click', {});
            }} 
            size="lg" 
            className="bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white px-8 py-4 rounded-full font-bold text-lg shadow-xl transition-all duration-300 w-full sm:w-auto"
          >
            <motion.span className="flex items-center justify-center">
              <FaRocket className="mr-3 text-xl" />
              ПРОЙТИ АУДИТ
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
          {[
            { value: '73%', label: 'Снижение ошибок', color: 'text-blue-600', bg: 'bg-blue-50', border: 'border-blue-100' },
            { value: '20+', label: 'Часов экономии', color: 'text-green-600', bg: 'bg-green-50', border: 'border-green-100' },
            { value: '1,247', label: 'Довольных клиентов', color: 'text-purple-600', bg: 'bg-purple-50', border: 'border-purple-100' },
          ].map((stat, index) => (
            <motion.div
              key={stat.label}
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: index * 0.1 }}
              whileHover={{ scale: 1.05 }}
              className={`${bg} ${border} p-3 rounded-xl border`}
            >
              <div className={`text-2xl font-bold ${color}`}>{stat.value}</div>
              <div className="text-xs text-gray-500 mt-1">{stat.label}</div>
            </motion.div>
          ))}
        </motion.div>
      </motion.div>
    );
  }

  if (showResult && breakdown) {
    return (
      <motion.div 
        initial={{ opacity: 0, scale: 0.9 }} 
        animate={{ opacity: 1, scale: 1 }}
        className="bg-gradient-to-br from-white to-gray-50 rounded-3xl p-8 sm:p-12 shadow-2xl max-w-5xl mx-auto border border-gray-200"
      >
        {/* Success Header */}
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
            <FaCheckCircle className="text-7xl text-green-500 mx-auto mb-4 drop-shadow-lg" />
          </motion.div>
          <h3 className="text-3xl sm:text-5xl font-bold text-gray-900 mb-3">
            Ваш потенциал: <span className="bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
              {breakdown.monthlySavings.toLocaleString('ru-RU')}₽/мес
            </span>
          </h3>
          <p className="text-lg text-gray-600">
            Эффективность вашего склада: <span className="font-bold text-blue-600 text-2xl">{efficiency}%</span>
          </p>
          
          {/* ROI Badge */}
          <motion.div 
            className="inline-block mt-4 bg-gradient-to-r from-gold-50 to-yellow-50 border border-yellow-200 rounded-full px-4 py-2"
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.8, type: "spring" }}
          >
            <Coins className="inline w-5 h-5 text-yellow-600 mr-2" />
            <span className="font-bold text-yellow-800">ROI: {breakdown.roi}% годовых</span>
          </motion.div>
        </motion.div>

        {/* Interactive Metrics */}
        <motion.div 
          className="mb-8"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ staggerChildren: 0.1 }}
        >
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { id: 'time', label: 'Время', value: `${breakdown.hours} ч`, color: 'blue', icon: FaClock, detail: `${breakdown.timeCost.toLocaleString()}₽/мес на рутину`, action: 'Автоматизация в 1 клик' },
              { id: 'penalties', label: 'Штрафы', value: `${breakdown.penaltyCost.toLocaleString()}₽`, color: 'red', icon: FaExclamationTriangle, detail: 'За ошибки в остатках', action: 'Экономия 90% с PRO' },
              { id: 'missed', label: 'Упущено', value: `${breakdown.missedSales.toLocaleString()}₽`, color: 'orange', icon: FaChartLine, detail: 'Потерянные продажи', action: 'Точность 99.9%' },
              { id: 'errors', label: 'Ошибки', value: `${breakdown.humanErrorCost.toLocaleString()}₽`, color: 'purple', icon: FaSyncAlt, detail: 'Человеческий фактор', action: 'Gamification' },
            ].map((item, idx) => {
              const Icon = item.icon;
              return (
                <motion.button
                  key={item.id}
                  onClick={() => setSelectedMetric(selectedMetric === item.id ? null : item.id)}
                  className={`relative p-4 rounded-xl border-2 transition-all cursor-pointer ${
                    selectedMetric === item.id 
                      ? `border-${item.color}-500 bg-${item.color}-50 scale-105 shadow-lg` 
                      : 'border-gray-200 bg-white hover:border-gray-300'
                  }`}
                  initial={{ y: 20, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: idx * 0.1 }}
                  whileHover={{ scale: 1.02 }}
                >
                  <Icon className={`w-8 h-8 text-${item.color}-600 mx-auto mb-2`} />
                  <div className={`text-2xl font-bold text-${item.color}-600`}>{item.value}</div>
                  <div className="text-xs text-gray-500 mt-1">{item.label}</div>

                  {/* Drill-down details */}
                  <AnimatePresence>
                    {selectedMetric === item.id && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="mt-3 text-left bg-gray-50 p-3 rounded-lg border border-gray-200"
                      >
                        <p className="text-sm text-gray-600 mb-2">{item.detail}</p>
                        <p className="text-sm font-semibold text-blue-600 flex items-center">
                          <Target className="w-4 h-4 mr-1" /> {item.action}
                        </p>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.button>
              );
            })}
          </div>
        </motion.div>

        {/* Social Proof */}
        <motion.div 
          className="bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-xl p-4 mb-8"
          initial={{ x: -20, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          transition={{ delay: 0.5 }}
        >
          <div className="flex items-center gap-3">
            <TrendingUp className="w-6 h-6 text-green-600" />
            <div>
              <p className="text-sm text-green-800 font-medium">
                Склады с похожими параметрами экономят <strong>{(breakdown.monthlySavings * 1.1).toLocaleString()}₽/мес</strong>
              </p>
              <p className="text-xs text-green-600">На основе 1,247+ аудитов</p>
            </div>
          </div>
        </motion.div>

        {/* Smart Roadmap */}
        <motion.div 
          className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-xl p-6 mb-8"
          initial={{ x: -20, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          transition={{ delay: 0.6 }}
        >
          <h4 className="font-bold text-xl text-blue-900 mb-4 flex items-center gap-3">
            <FaMagic className="text-blue-600" />
            Ваша дорожная карта оптимизации:
          </h4>
          
          <AnimatePresence>
            {roadmap.map((item, idx) => (
              <motion.div
                key={item.title}
                initial={{ x: -10, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                exit={{ x: -10, opacity: 0 }}
                transition={{ delay: 0.7 + idx * 0.1 }}
                className="flex items-start gap-3 mb-3"
              >
                <motion.div 
                  className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold"
                  whileHover={{ scale: 1.1 }}
                >
                  {item.priority}
                </motion.div>
                <div className="flex-1 bg-white p-4 rounded-lg shadow-sm border border-gray-100 hover:border-blue-200 transition-all">
                  <div className="flex justify-between items-start mb-2">
                    <span className="font-semibold text-blue-800">{item.title}</span>
                    {item.quickWin && (
                      <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded-full font-medium">
                        Быстрый результат
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-4 text-sm text-gray-600">
                    <span className="flex items-center gap-1">
                      <Coins className="w-4 h-4 text-green-600" />
                      +{item.impact.toLocaleString()}₽/мес
                    </span>
                    <span className="flex items-center gap-1">
                      <FaClock className="text-blue-500" />
                      {item.effort}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 mt-2">{item.description}</p>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </motion.div>

        {/* ROI Summary */}
        <motion.div 
          className="bg-gradient-to-r from-yellow-50 to-amber-50 border border-yellow-200 rounded-xl p-6 mb-8"
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 1 }}
        >
          <div className="grid md:grid-cols-3 gap-4 text-center">
            <div>
              <div className="text-2xl font-bold text-yellow-800">{breakdown.roi}%</div>
              <div className="text-sm text-yellow-700">Годовой ROI</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-yellow-800">{breakdown.paybackMonths}</div>
              <div className="text-sm text-yellow-700">Мес. окупаемости</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-yellow-800">{breakdown.monthlySavings.toLocaleString()}₽</div>
              <div className="text-sm text-yellow-700">Экономия/мес</div>
            </div>
          </div>
        </motion.div>

        {/* Action Buttons */}
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 1.1 }}
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
                className="w-full bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white text-lg py-4 rounded-xl shadow-lg transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
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
                <FaRedo className="mr-2" /> Пройти ещё раз
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

  // Question Screen
  const currentQuestion = questions[step];
  const progress = (step / questions.length) * 100;

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }} 
      animate={{ opacity: 1, y: 0 }}
      className="bg-gradient-to-br from-white to-gray-50 rounded-3xl p-8 sm:p-10 shadow-2xl max-w-3xl mx-auto"
    >
      {/* Progress Bar */}
      <motion.div 
        className="mb-6"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.1 }}
      >
        <div className="flex justify-between items-center mb-4">
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium text-gray-500">
              Шаг {step} из {questions.length}
            </span>
            <span className="text-xs text-gray-400">
              ~{estimatedTime}
            </span>
          </div>
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={reset}
            className="text-gray-400 hover:text-gray-600"
          >
            <FaRedo className="mr-1" /> Начать заново
          </Button>
        </div>
        <div className="relative h-3 bg-gray-200 rounded-full overflow-hidden shadow-inner">
          <motion.div 
            className="absolute inset-y-0 left-0 bg-gradient-to-r from-blue-500 to-indigo-600"
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.5, ease: "easeOut" }}
          />
          <motion.div 
            className="absolute inset-0 bg-white/30"
            animate={{ x: ["0%", "100%"] }}
            transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
          />
        </div>
      </motion.div>

      {/* Question */}
      <motion.div 
        className="mb-6"
        initial={{ x: -10 }}
        animate={{ x: 0 }}
      >
        <Label className="text-xl sm:text-2xl font-bold text-gray-900 mb-3 block leading-tight">
          {currentQuestion.text}
        </Label>
        {currentQuestion.helper && (
          <p className="text-sm text-gray-500 mb-4 flex items-start gap-2">
            <FaInfoCircle className="text-blue-500 mt-0.5 flex-shrink-0" />
            {currentQuestion.helper}
          </p>
        )}
        
        <div className="relative">
          {currentQuestion.type === 'select' ? (
            <select
              value={currentAnswer}
              onChange={(e) => setCurrentAnswer(e.target.value)}
              className="w-full py-4 px-4 text-lg bg-white border-2 border-gray-200 focus:border-blue-500 focus:ring-0 transition-colors rounded-lg appearance-none"
              autoFocus
            >
              <option value="">{currentQuestion.placeholder}</option>
              {currentQuestion.options?.map((opt: any) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          ) : (
            <Input
              type="number"
              placeholder={currentQuestion.placeholder}
              value={currentAnswer}
              onChange={(e) => setCurrentAnswer(e.target.value)}
              onKeyPress={(e) => { if (e.key === 'Enter') handleNext(); }}
              className="py-6 text-lg pr-12 bg-white border-2 border-gray-200 focus:border-blue-500 focus:ring-0 transition-colors"
              autoFocus
            />
          )}
          
          <motion.div 
            className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
            animate={{ rotate: currentAnswer ? 0 : 12 }}
            transition={{ type: "spring", stiffness: 300 }}
          >
            <FaKeyboard className="w-5 h-5" />
          </motion.div>
        </div>
        
        <AnimatePresence>
          {validationResult && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className={`mt-3 p-3 rounded-lg flex items-start gap-3 ${
                validationResult.type === 'error' ? 'bg-red-100 text-red-700' :
                validationResult.type === 'warning' ? 'bg-yellow-100 text-yellow-700' :
                'bg-blue-100 text-blue-700'
              }`}
            >
              <span className="text-lg">{validationResult.icon || '💡'}</span>
              <span className="font-medium">{validationResult.message}</span>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* Navigation */}
      <motion.div 
        className="flex gap-3"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.2 }}
      >
        {step > 1 && (
          <Button 
            variant="outline" 
            onClick={() => {
              setStep(step - 1);
              setCurrentAnswer(answers[questions[step - 1].id]?.toString() || '');
            }}
            className="flex-1 py-6 text-lg border-2 hover:border-blue-500"
          >
            <ChevronLeft className="mr-2" /> Назад
          </Button>
        )}
        <Button 
          onClick={handleNext} 
          disabled={!currentAnswer || !!validationResult?.type}
          className="flex-1 bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white text-lg py-6 rounded-xl shadow-lg transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <motion.span className="flex items-center justify-center">
            {step === questions.length ? 'Получить результат' : 'Далее'}
            <ChevronRight className="ml-2" />
          </motion.span>
        </Button>
      </motion.div>
    </motion.div>
  );
};
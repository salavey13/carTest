"use client";

import { useState } from 'react';
import { toast } from 'sonner';
import { sendComplexMessage } from '@/app/webhook-handlers/actions/sendComplexMessage';

interface AuditAnswers {
  skus: number;
  hours: number;
  penalties: number;
  stores: number;
}

interface CalculationBreakdown {
  timeCost: number;
  penaltyCost: number;
  missedSales: number;
  skus: number;
  stores: number;
  hours: number;
}

export const useWarehouseAudit = (userId: string | undefined) => {
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Partial<AuditAnswers>>({});
  const [currentAnswer, setCurrentAnswer] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [breakdown, setBreakdown] = useState<CalculationBreakdown | null>(null);
  const [showResult, setShowResult] = useState(false);

  const questions = [
    { id: 'skus', text: 'Сколько артикулов вы держите на складе?', type: 'number', placeholder: '100', min: 1 },
    { id: 'hours', text: 'Сколько часов в месяц тратите на ручные обновления остатков?', type: 'number', placeholder: '40', min: 0 },
    { id: 'penalties', text: 'Сколько платите штрафов за ошибки в остатках (руб/мес)?', type: 'number', placeholder: '30000', min: 0 },
    { id: 'stores', text: 'На скольких маркетплейсах одновременно продаете?', type: 'number', placeholder: '2', min: 1 },
  ];

  // FIX: Универсальная функция расчёта с защитой от 0 в stores
  const calcLosses = (data: Partial<AuditAnswers>) => {
    const skus = Math.max(0, Number(data.skus) || 0);
    const stores = Math.max(1, Number(data.stores) || 1); // BUG FIX: минимум 1!
    const hours = Math.max(0, Number(data.hours) || 0);
    const penalties = Math.max(0, Number(data.penalties) || 0);

    const timeCost = hours * 1500;
    const penaltyCost = penalties;
    const missedSales = Math.floor(skus * stores * 0.05 * 1000);

    return {
      total: timeCost + penaltyCost + missedSales,
      breakdown: { timeCost, penaltyCost, missedSales, skus, stores, hours },
    };
  };

  const handleNext = () => {
    if (!currentAnswer && currentAnswer !== '0') {
      toast.error('Введите ответ');
      return;
    }

    const numValue = parseInt(currentAnswer, 10);
    const minValue = questions[step].min;

    if (isNaN(numValue) || numValue < minValue) {
      toast.error(`Введите число от ${minValue}`);
      return;
    }

    const newAnswers = { ...answers, [questions[step].id]: numValue };
    setAnswers(newAnswers);

    if (step < questions.length - 1) {
      setStep(step + 1);
      setCurrentAnswer('');
    } else {
      const result = calcLosses(newAnswers);
      setBreakdown(result.breakdown);
      setShowResult(true);
      console.log('📊 Audit Debug:', { inputs: newAnswers, calculation: result });
    }
  };

  const handleGetReport = async () => {
    if (!userId) {
      toast.error('Пожалуйста, войдите в систему');
      return;
    }

    setIsSending(true);
    try {
      const result = calcLosses(answers);

      const message = `📊 *Ваш аудит склада готов!*

💸 *Вы теряете:* ~${result.total.toLocaleString('ru-RU')}₽/мес

📉 *Развернутый разбор:*
• Штрафы за ошибки: ${result.breakdown.penaltyCost.toLocaleString('ru-RU')}₽
• Стоимость вашего времени: ${result.breakdown.timeCost.toLocaleString('ru-RU')}₽
• Упущенные продажи: ${result.breakdown.missedSales.toLocaleString('ru-RU')}₽

🎯 *Ваш план снижения потерь:*
1. Автоматизируйте обновление остатков
2. Внедрите контроль качества
3. Оптимизируйте работу персонала

💡 Начните прямо сейчас!`;

      await sendComplexMessage(userId, message, [], {
        parseMode: 'Markdown',
        imageQuery: 'warehouse logistics optimization',
      });

      toast.success('✅ План экономии отправлен в Telegram!');
    } catch (error) {
      toast.error('❌ Ошибка отправки отчета');
      console.error('Failed to send audit report:', error);
    } finally {
      setIsSending(false);
    }
  };

  const reset = () => {
    setStep(0);
    setAnswers({});
    setCurrentAnswer('');
    setBreakdown(null);
    setShowResult(false);
    setIsSending(false);
  };

  return {
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
  };
};
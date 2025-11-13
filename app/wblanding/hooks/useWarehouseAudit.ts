"use client";

import { useState, useMemo } from 'react';
import { toast } from 'sonner';
import { sendComplexMessage } from '@/app/webhook-handlers/actions/sendComplexMessage';

interface AuditAnswers {
  skus: number;
  hours: number;
  penalties: number;
  stores: number;
  industry?: string;
}

interface CalculationBreakdown {
  timeCost: number;
  penaltyCost: number;
  missedSales: number;
  humanErrorCost: number;
  skus: number;
  stores: number;
  hours: number;
  efficiency: number;
}

interface AuditReport {
  userId: string;
  timestamp: Date;
  answers: AuditAnswers;
  calculation: CalculationBreakdown;
  totalLosses: number;
  efficiency: number;
  recommendations: string[];
}

export const useWarehouseAudit = (userId: string | undefined) => {
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Partial<AuditAnswers>>({});
  const [currentAnswer, setCurrentAnswer] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [breakdown, setBreakdown] = useState<CalculationBreakdown | null>(null);
  const [showResult, setShowResult] = useState(false);

  const questions = [
    { 
      id: 'skus', 
      text: 'Сколько артикулов вы держите на складе?', 
      type: 'number', 
      placeholder: 'Например: 150', 
      min: 1,
      helper: 'Считайте все уникальные товары (размеры, цвета, модели)'
    },
    { 
      id: 'hours', 
      text: 'Сколько часов в месяц тратите на обновление остатков вручную?', 
      type: 'number', 
      placeholder: 'Например: 20', 
      min: 0,
      helper: 'Включая проверку, ввод данных, исправление ошибок'
    },
    { 
      id: 'penalties', 
      text: 'Какой объём штрафов за ошибки в остатках вы получаете (руб/мес)?', 
      type: 'number', 
      placeholder: 'Например: 15000', 
      min: 0,
      helper: 'Штрафы от маркетплейсов за несвоевременное обновление'
    },
    { 
      id: 'stores', 
      text: 'На скольких маркетплейсах одновременно продаёте?', 
      type: 'number', 
      placeholder: 'Например: 2', 
      min: 1,
      max: 10,
      helper: 'WB, Ozon, Яндекс.Маркет и другие'
    },
  ];

  const HOURLY_RATE = 2000;
  const AVG_ORDER_VALUE = 1500;
  const ERROR_COST_PER_SKU = 50;

  const calcLosses = (data: Partial<AuditAnswers>) => {
    const skus = Math.max(1, Number(data.skus) || 1);
    const stores = Math.max(1, Number(data.stores) || 1);
    const hours = Math.max(0, Number(data.hours) || 0);
    const penalties = Math.max(0, Number(data.penalties) || 0);

    const timeCost = hours * HOURLY_RATE;
    const penaltyCost = penalties;
    
    const missedSalesRate = Math.min(0.15, 0.03 + (stores - 1) * 0.02 + Math.log10(skus) * 0.01);
    const missedSales = Math.floor(skus * missedSalesRate * AVG_ORDER_VALUE * 30);
    
    const humanErrorCost = Math.floor(skus * stores * ERROR_COST_PER_SKU);

    const total = timeCost + penaltyCost + missedSales + humanErrorCost;
    const efficiency = Math.max(0, Math.round(100 - (missedSalesRate * 100)));

    return {
      total,
      breakdown: { 
        timeCost, 
        penaltyCost, 
        missedSales, 
        humanErrorCost,
        skus, 
        stores, 
        hours,
        efficiency
      },
    };
  };

  const validateAnswer = (value: string, question: any): string | null => {
    if (value === '') return null;
    
    const num = parseInt(value, 10);
    if (isNaN(num)) return 'Пожалуйста, введите число';
    if (num < question.min) return `Минимальное значение: ${question.min}`;
    if (question.max && num > question.max) return `Максимальное значение: ${question.max}`;
    
    if (question.id === 'skus' && num > 10000) return 'Введите реалистичное количество (max 10 000)';
    if (question.id === 'stores' && num > 10) return 'Максимум 10 маркетплейсов';
    
    return null;
  };

  const generateRecommendations = (calc: CalculationBreakdown, ans: AuditAnswers): string[] => {
    const recs: string[] = [];
    
    if (calc.penaltyCost > 20000) {
      recs.push(`• Автоматизируйте обновление остатков → экономия ${calc.penaltyCost.toLocaleString()}₽/мес`);
    }
    if (calc.hours > 15) {
      recs.push(`• Централизуйте управление → освобождение ${calc.hours} часов/мес`);
    }
    if (calc.stores > 1) {
      recs.push(`• Единая панель для ${calc.stores} маркетплейсов → снижение ошибок на 73%`);
    }
    if (calc.skus > 200) {
      recs.push(`• Визуализация ${calc.skus} SKU → быстрый поиск и учёт`);
    }
    
    return recs.length > 0 ? recs : ['• Начните с базовой автоматизации → рост эффективности от 30%'];
  };

  const handleNext = () => {
    const error = validateAnswer(currentAnswer, questions[step]);
    if (error) {
      toast.error(error, { icon: '⚠️' });
      return;
    }

    const numValue = parseInt(currentAnswer, 10);
    const newAnswers = { ...answers, [questions[step].id]: numValue };
    setAnswers(newAnswers);

    if (step < questions.length - 1) {
      setStep(step + 1);
      setCurrentAnswer('');
    } else {
      const result = calcLosses(newAnswers);
      setBreakdown(result.breakdown);
      setShowResult(true);
      console.log('📊 Audit completed:', { inputs: newAnswers, result });
    }
  };

  const startAudit = () => {
    reset();
    setStep(1);
  };

  const saveAuditReport = async (report: AuditReport) => {
    try {
      const response = await fetch('/api/audit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(report),
      });
      return await response.json();
    } catch (error) {
      console.error('Failed to save audit:', error);
      return null;
    }
  };

  const handleGetReport = async () => {
    if (!userId) {
      toast.error('Пожалуйста, войдите в систему', { icon: '🔐' });
      return;
    }

    setIsSending(true);
    try {
      const result = calcLosses(answers);
      const recommendations = generateRecommendations(result.breakdown, answers as AuditAnswers);

      const message = `📊 *Ваш аудит склада готов!*

✅ *Ваш потенциал:* ~${Math.floor(result.total * 0.7).toLocaleString('ru-RU')}₽/мес

📈 *Текущая эффективность:* ${result.breakdown.efficiency}%

💡 *Рекомендации:*
${recommendations.join('\n')}

🚀 *Следующий шаг:* Начните с бесплатного тарифа`;

      await sendComplexMessage(userId, message, [], {
        parseMode: 'Markdown',
        imageQuery: 'warehouse optimization success',
      });

      const report: AuditReport = {
        userId: userId,
        timestamp: new Date(),
        answers: answers as AuditAnswers,
        calculation: result.breakdown,
        totalLosses: result.total,
        efficiency: result.breakdown.efficiency,
        recommendations,
      };
      
      await saveAuditReport(report);

      toast.success('✅ План оптимизации отправлен в Telegram!', {
        icon: '📨',
        duration: 5000,
      });
    } catch (error) {
      toast.error('❌ Ошибка отправки отчёта', { icon: '❌' });
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
    totalLosses: breakdown ? breakdown.timeCost + breakdown.penaltyCost + breakdown.missedSales + breakdown.humanErrorCost : 0,
    efficiency: breakdown?.efficiency || 0,
    setCurrentAnswer,
    handleNext,
    handleGetReport,
    reset,
    startAudit,
    validateAnswer,
  };
};
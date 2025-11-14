"use client";

import { useState, useMemo, useCallback, useEffect } from 'react';
import { toast } from 'sonner';
import { sendComplexMessage } from '@/app/webhook-handlers/actions/sendComplexMessage';

// ============= Enhanced Interfaces =============
interface EnhancedAuditAnswers {
  skus: number;
  hours: number;
  penalties: number;
  stores: number;
  industry: string;
  orderVolume: number;
  avgSkuValue: number;
  staffCount: number;
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
  roi: number;
  paybackMonths: number;
  monthlySavings: number;
}

interface RoadmapItem {
  priority: number;
  title: string;
  impact: number;
  effort: string;
  description: string;
  quickWin: boolean;
}

interface AuditReport {
  userId: string;
  timestamp: Date;
  answers: EnhancedAuditAnswers;
  calculation: CalculationBreakdown;
  totalLosses: number;
  efficiency: number;
  recommendations: string[];
  roadmap: RoadmapItem[];
}

// ============= Industry & Regional Data =============
const INDUSTRY_MULTIPLIERS = {
  electronics: { avgOrderValue: 5000, errorRate: 0.8, penaltyRisk: 1.5, name: 'Электроника' },
  clothing: { avgOrderValue: 2500, errorRate: 1.2, penaltyRisk: 1.0, name: 'Одежда и обувь' },
  'home-goods': { avgOrderValue: 1500, errorRate: 1.0, penaltyRisk: 1.1, name: 'Товары для дома' },
  cosmetics: { avgOrderValue: 2000, errorRate: 1.1, penaltyRisk: 1.3, name: 'Косметика' },
  'auto-parts': { avgOrderValue: 4000, errorRate: 0.9, penaltyRisk: 1.4, name: 'Автозапчасти' },
  toys: { avgOrderValue: 1200, errorRate: 1.3, penaltyRisk: 1.0, name: 'Детские товары' },
  books: { avgOrderValue: 800, errorRate: 0.7, penaltyRisk: 0.8, name: 'Книги' },
  food: { avgOrderValue: 1800, errorRate: 1.4, penaltyRisk: 1.6, name: 'Продукты питания' },
  other: { avgOrderValue: 2000, errorRate: 1.0, penaltyRisk: 1.0, name: 'Другое' },
};

const REGIONAL_HOURLY_RATES = {
  moscow: 3500, spb: 3000, regions: 2000, remote: 1500,
};

// ============= Main Hook =============
export const useWarehouseAudit = (userId: string | undefined) => {
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Partial<EnhancedAuditAnswers>>({});
  const [currentAnswer, setCurrentAnswer] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [breakdown, setBreakdown] = useState<CalculationBreakdown | null>(null);
  const [showResult, setShowResult] = useState(false);
  const [estimatedTime, setEstimatedTime] = useState('60 сек');
  const [roadmap, setRoadmap] = useState<RoadmapItem[]>([]);

  const questions = [
    { 
      id: 'industry', 
      text: 'Ваша отрасль?', 
      type: 'select' as const,
      placeholder: 'Выберите отрасль',
      options: Object.entries(INDUSTRY_MULTIPLIERS).map(([key, value]) => ({
        value: key,
        label: value.name,
      })),
      required: true,
      helper: 'Поможет точнее рассчитать потери и дать рекомендации',
    },
    { 
      id: 'skus', 
      text: 'Сколько артикулов вы держите на складе?', 
      type: 'number' as const, 
      placeholder: 'Например: 150', 
      min: 1,
      max: 10000,
      required: true,
      helper: 'Считайте все уникальные товары (размеры, цвета, модели)',
    },
    { 
      id: 'orderVolume', 
      text: 'Среднее количество заказов в день?', 
      type: 'number' as const, 
      placeholder: 'Например: 50', 
      min: 1,
      required: true,
      helper: 'Поможет точнее рассчитать упущенные продажи',
    },
    { 
      id: 'avgSkuValue', 
      text: 'Средняя закупочная стоимость товара (₽)', 
      type: 'number' as const, 
      placeholder: 'Например: 2000', 
      min: 100,
      required: true,
      helper: 'Для расчёта реальной стоимости ошибок и упущенной прибыли',
    },
    { 
      id: 'hours', 
      text: 'Сколько часов в месяц тратите на обновление остатков?', 
      type: 'number' as const, 
      placeholder: 'Например: 20', 
      min: 0,
      max: 200,
      required: true,
      helper: 'Включая проверку, ввод данных, исправление ошибок',
    },
    { 
      id: 'penalties', 
      text: 'Какой объём штрафов за ошибки в остатках (₽/мес)?', 
      type: 'number' as const, 
      placeholder: 'Например: 15000', 
      min: 0,
      max: 1000000,
      required: true,
      helper: 'Штрафы от маркетплейсов за несвоевременное обновление',
    },
    { 
      id: 'stores', 
      text: 'На скольких маркетплейсах продаёте?', 
      type: 'number' as const, 
      placeholder: 'Например: 2', 
      min: 1,
      max: 10,
      required: true,
      helper: 'WB, Ozon, Яндекс.Маркет и другие',
    },
    { 
      id: 'staffCount', 
      text: 'Сколько человек работает со складом?', 
      type: 'number' as const, 
      placeholder: 'Например: 3', 
      min: 1,
      max: 50,
      required: true,
      helper: 'Влияет на стоимость обучения и риски ошибок',
    },
  ];

  // ============= Calculation Logic =============
  const calcLosses = useCallback((data: Partial<EnhancedAuditAnswers>) => {
    const skus = Math.max(1, Number(data.skus) || 1);
    const stores = Math.max(1, Number(data.stores) || 1);
    const hours = Math.max(0, Number(data.hours) || 0);
    const penalties = Math.max(0, Number(data.penalties) || 0);
    const orderVolume = Math.max(1, Number(data.orderVolume) || 1);
    const avgSkuValue = Math.max(100, Number(data.avgSkuValue) || 1500);
    const staffCount = Math.max(1, Number(data.staffCount) || 1);
    const industry = data.industry || 'other';

    const multipliers = INDUSTRY_MULTIPLIERS[industry as keyof typeof INDUSTRY_MULTIPLIERS];
    
    // Региональная ставка (можно расширить)
    const hourlyRate = REGIONAL_HOURLY_RATES.regions;

    // 1. Стоимость времени
    const timeCost = hours * hourlyRate;

    // 2. Штрафы (прямой ввод)
    const penaltyCost = penalties;

    // 3. Упущенные продажи (реалистичная модель)
    const baseLossRate = 0.05; // 5% потерь при ручном учёте
    const storeComplexity = Math.min(0.08, (stores - 1) * 0.02);
    const skuComplexity = Math.min(0.05, Math.log10(skus) * 0.01);
    const volumeFactor = Math.min(0.03, Math.log10(orderVolume) * 0.01);
    
    const totalLossRate = baseLossRate + storeComplexity + skuComplexity + volumeFactor;
    const missedSales = Math.floor((orderVolume * 30) * totalLossRate * avgSkuValue * multipliers.penaltyRisk);

    // 4. Стоимость ошибок персонала
    const humanErrorCost = Math.floor(skus * stores * 50 * multipliers.errorRate * (staffCount * 0.1));

    const total = timeCost + penaltyCost + missedSales + humanErrorCost;
    
    // Комплексный расчёт эффективности
    const efficiency = Math.max(0, Math.round(
      100 - (totalLossRate * 100 + Math.min(20, penaltyCost / 1000) + Math.min(10, hours / 5))
    ));

    // ROI и срок окупаемости
    const monthlySavings = Math.floor(total * 0.7); // Реалистичная экономия
    const annualSavings = monthlySavings * 12;
    const proPlanPrice = 4900;
    const roi = Math.round((annualSavings / proPlanPrice) * 100);
    const paybackMonths = Math.max(1, Math.round(proPlanPrice / monthlySavings * 10) / 10);

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
        efficiency,
        roi,
        paybackMonths,
        monthlySavings,
      },
    };
  }, []);

  // ============= Validation =============
  const validateAnswer = (value: string, question: any): string | null => {
    if (value === '') return null;
    
    const num = parseInt(value, 10);
    if (isNaN(num)) return 'Пожалуйста, введите число';
    if (num < question.min) return `Минимальное значение: ${question.min}`;
    if (question.max && num > question.max) return `Максимальное значение: ${question.max}`;
    
    // Реалистичность
    if (question.id === 'skus' && num > 10000) return 'Введите реалистичное количество (max 10 000)';
    if (question.id === 'stores' && num > 10) return 'Максимум 10 маркетплейсов';
    if (question.id === 'penalties' && num > 1000000) return 'Введите реалистичную сумму';
    
    return null;
  };

  // ============= Roadmap Generation =============
  const generateSmartRoadmap = useCallback((calc: CalculationBreakdown, ans: EnhancedAuditAnswers): RoadmapItem[] => {
    const roadmap: RoadmapItem[] = [];
    
    // Приоритизация по ROI
    if (calc.penaltyCost > 20000) {
      roadmap.push({
        priority: 1,
        title: '🎯 Автоматизация обновлений остатков',
        impact: calc.penaltyCost * 0.9,
        effort: '1 день',
        description: 'Настройка API-интеграций с маркетплейсами',
        quickWin: true,
      });
    }
    
    if (calc.hours > 15) {
      roadmap.push({
        priority: 2,
        title: '⚡ Централизация управления',
        impact: calc.hours * 1500,
        effort: '3 дня',
        description: 'Единая панель для всех маркетплейсов и складов',
        quickWin: false,
      });
    }
    
    if (calc.stores > 1) {
      roadmap.push({
        priority: 3,
        title: '🏪 Оптимизация многоканальности',
        impact: calc.missedSales * 0.6,
        effort: '5 дней',
        description: `Управление ${calc.stores} маркетплейсами из одной системы`,
        quickWin: false,
      });
    }
    
    if (calc.skus > 200) {
      roadmap.push({
        priority: 4,
        title: '📦 Визуализация склада',
        impact: calc.humanErrorCost * 0.5,
        effort: '2 дня',
        description: `Карта и фильтры для ${calc.skus} SKU → ускорение поиска на 70%`,
        quickWin: true,
      });
    }
    
    // Обучение команды если много сотрудников
    if (ans.staffCount > 5) {
      roadmap.push({
        priority: 5,
        title: '👨‍🏫 Обучение персонала',
        impact: calc.humanErrorCost * 0.3,
        effort: '1 неделя',
        description: 'Сокращение ошибок кладовщиков на 50%',
        quickWin: false,
      });
    }
    
    return roadmap.sort((a, b) => a.priority - b.priority);
  }, []);

  // ============= Event Tracking =============
  const trackAuditEvent = useCallback((event: string, data: any) => {
    if (typeof window !== 'undefined' && (window as any).gtag) {
      (window as any).gtag('event', `audit_${event}`, {
        step,
        questionId: questions[step]?.id,
        userId,
        ...data,
      });
    }
  }, [step, questions, userId]);

  // ============= Save Partial Results =============
  const savePartialResult = useCallback(async (currentAnswers: Partial<EnhancedAuditAnswers>) => {
    if (!userId) return;
    
    try {
      await fetch('/api/audit/partial', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          userId, 
          step, 
          answers: currentAnswers,
          timestamp: new Date(),
          estimatedCompletion: `${(questions.length - step) * 15} сек`,
        }),
      });
    } catch (error) {
      console.error('Failed to save partial audit:', error);
    }
  }, [userId, step, questions.length]);

  // Auto-save every 3 seconds when answers exist
  useEffect(() => {
    if (step === 0) return;
    
    const timer = setTimeout(() => {
      if (Object.keys(answers).length > 0) {
        savePartialResult(answers);
      }
    }, 3000);
    
    return () => clearTimeout(timer);
  }, [answers, savePartialResult, step]);

  // Update estimated time
  useEffect(() => {
    if (step > 0) {
      const remaining = (questions.length - step + 1) * 15;
      setEstimatedTime(`${remaining} сек`);
    }
  }, [step, questions.length]);

  // ============= Navigation =============
  const handleNext = () => {
    const error = validateAnswer(currentAnswer, questions[step]);
    if (error) {
      toast.error(error, { icon: '⚠️' });
      trackAuditEvent('validation_error', { error, questionId: questions[step].id });
      return;
    }

    const value = questions[step].type === 'select' ? currentAnswer : parseInt(currentAnswer, 10);
    const newAnswers = { ...answers, [questions[step].id]: value };
    setAnswers(newAnswers);
    trackAuditEvent('question_completed', { questionId: questions[step].id });

    if (step < questions.length - 1) {
      setStep(step + 1);
      setCurrentAnswer('');
    } else {
      // Final calculation
      const result = calcLosses(newAnswers);
      const smartRoadmap = generateSmartRoadmap(result.breakdown, newAnswers as EnhancedAuditAnswers);
      
      setBreakdown(result.breakdown);
      setRoadmap(smartRoadmap);
      setShowResult(true);
      trackAuditEvent('audit_completed', { totalLosses: result.total });
      
      console.log('📊 Audit completed:', { 
        inputs: newAnswers, 
        result: result.breakdown,
        roadmap: smartRoadmap,
      });
    }
  };

  const startAudit = () => {
    reset();
    setStep(1);
    trackAuditEvent('audit_started', {});
  };

  // ============= Report Generation =============
  const handleGetReport = async () => {
    if (!userId) {
      toast.error('Пожалуйста, войдите в систему', { icon: '🔐' });
      return;
    }

    setIsSending(true);
    try {
      const result = calcLosses(answers);
      const recommendations = generateRecommendations(result.breakdown, answers as EnhancedAuditAnswers);

      // Telegram message with Markdown
      const message = `📊 *Ваш аудит склада готов!*

✅ *Потенциал экономии:* ${result.breakdown.monthlySavings.toLocaleString('ru-RU')}₽/мес

📈 *Текущая эффективность:* ${result.breakdown.efficiency}%

💰 *Годовой ROI:* ${result.breakdown.roi}%
⏱️ *Срок окупаемости:* ${result.breakdown.paybackMonths} мес

📋 *Детализация потерь:*
• Время: ${result.breakdown.timeCost.toLocaleString()}₽
• Штрафы: ${result.breakdown.penaltyCost.toLocaleString()}₽
• Упущено: ${result.breakdown.missedSales.toLocaleString()}₽
• Ошибки: ${result.breakdown.humanErrorCost.toLocaleString()}₽

🚀 *Приоритетные действия:*
${roadmap.slice(0, 3).map((item, i) => `${i + 1}. ${item.title} → ${item.impact.toLocaleString()}₽/мес`).join('\n')}

💡 *Следующий шаг:* Начните с бесплатного тарифа`;

      await sendComplexMessage(userId, message, [], {
        parseMode: 'Markdown',
        imageQuery: 'warehouse optimization success chart infographic',
      });

      // Save full report
      const report: AuditReport = {
        userId: userId,
        timestamp: new Date(),
        answers: answers as EnhancedAuditAnswers,
        calculation: result.breakdown,
        totalLosses: result.total,
        efficiency: result.breakdown.efficiency,
        recommendations,
        roadmap,
      };
      
      await saveAuditReport(report);

      toast.success('✅ План оптимизации отправлен в Telegram!', {
        icon: '📨',
        duration: 5000,
      });
      
      trackAuditEvent('report_sent', { totalLosses: result.total });
    } catch (error) {
      toast.error('❌ Ошибка отправки отчёта', { icon: '❌' });
      console.error('Failed to send audit report:', error);
      trackAuditEvent('report_error', { error });
    } finally {
      setIsSending(false);
    }
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

  const reset = () => {
    setStep(0);
    setAnswers({});
    setCurrentAnswer('');
    setBreakdown(null);
    setShowResult(false);
    setIsSending(false);
    setRoadmap([]);
    trackAuditEvent('audit_reset', {});
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
    estimatedTime,
    roadmap,
    setCurrentAnswer,
    handleNext,
    handleGetReport,
    reset,
    startAudit,
    validateAnswer,
    trackAuditEvent,
  };
};
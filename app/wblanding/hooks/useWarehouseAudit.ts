"use client";

import { useState, useMemo, useCallback, useEffect } from 'react';
import { toast } from 'sonner';
import { sendComplexMessage } from '@/app/webhook-handlers/actions/sendComplexMessage';
import { clearWarehouseAuditProgress, getWarehouseAuditState, saveWarehouseAuditProgress } from '@/app/wblanding/actions_audit';
import { checkAndUnlockFeatureAchievement } from '@/hooks/cyberFitnessSupabase';

// ============= Enhanced Interfaces =============
export interface EnhancedAuditAnswers {
  skus: number;
  hours: number;
  penalties: number;
  stores: number;
  industry: string;
  orderVolume: number;
  avgSkuValue: number;
  staffCount: number;
}

export interface CalculationBreakdown {
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
  totalLossRatePct: number;
  hourlyRateUsed: number;
  industryName: string;
  penaltyRiskMultiplier: number;
  errorRateMultiplier: number;
  missedRevenueBeforeMargin: number;
  contributionMarginPct: number;
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
  roadmap: RoadmapItem[];
}

interface AuditProgress {
  userId: string;
  currentStep: number;
  answers: Partial<EnhancedAuditAnswers>;
  updatedAt: Date;
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

export const useWarehouseAudit = (userId: string | undefined) => {
  
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Partial<EnhancedAuditAnswers>>({});
  const [currentAnswer, setCurrentAnswer] = useState('');
  const [breakdown, setBreakdown] = useState<CalculationBreakdown | null>(null);
  const [roadmap, setRoadmap] = useState<RoadmapItem[]>([]);
  const [isSending, setIsSending] = useState(false);
  const [showResult, setShowResult] = useState(false);
  const [estimatedTime, setEstimatedTime] = useState('60 сек');
  const [hasCompletedAudit, setHasCompletedAudit] = useState(false);
  const [lastCompletedAudit, setLastCompletedAudit] = useState<AuditReport | null>(null);

  // ============= Load progress on mount =============
  useEffect(() => {
    if (!userId) return;
    
    const loadProgress = async () => {
      try {
        // Check for incomplete audit
        const result = await getWarehouseAuditState(userId);

        if (!result.success) {
          console.error('Failed to load warehouse audit state:', result.error);
          return;
        }

        const progress = result.progress as any;
        if (progress) {
          const timeDiff = Date.now() - new Date(progress.updated_at).getTime();
          const hoursDiff = timeDiff / (1000 * 60 * 60);

          if (hoursDiff < 24 && progress.current_step < 8) {
            setStep(progress.current_step);
            setAnswers(progress.answers_snapshot || {});
            setEstimatedTime(`Продолжить с шага ${progress.current_step}`);
            console.log('✅ Progress loaded:', progress);
            return;
          }
        }

        const lastAudit = result.lastAudit as any;
        if (lastAudit) {
          setHasCompletedAudit(true);
          setLastCompletedAudit(lastAudit);
          console.log('✅ Last audit loaded:', lastAudit);
        }
      } catch (error) {
        console.error('Failed to load progress:', error);
      }
    };
    
    loadProgress();
  }, [userId]);

  // ============= Analytics =============
  const trackAuditEvent = useCallback((eventName: string, properties: Record<string, any>) => {
    if (typeof window !== 'undefined' && (window as any).ym) {
      (window as any).ym(96574217, 'reachGoal', eventName, properties);
      console.log(`📊 Яндекс.Метрика: ${eventName}`, properties);
    }
  }, []);

  // ============= Questions =============
  const questions = useMemo(() => [
    { id: 'skus', text: 'Сколько SKU вы управляете?', type: 'number', min: 1, max: 10000, placeholder: 'Например: 150', helper: 'SKU — это каждая уникальная позиция товара' },
    { id: 'hours', text: 'Сколько часов в неделю тратите на ручные обновления остатков?', type: 'number', min: 0, max: 168, placeholder: 'Например: 15', helper: 'Включая проверки, переносы между таблицами, исправления ошибок' },
    { id: 'penalties', text: 'Какие штрафы от маркетплейсов вы платите в месяц (₽)?', type: 'number', min: 0, max: 1000000, placeholder: 'Например: 15000', helper: 'Озон: (возвраты×2 + опоздания) ÷ доставки = % от продаж. Вильфер: до 30% за неточные остатки' },
    { id: 'stores', text: 'Сколько маркетплейсов вы используете?', type: 'number', min: 1, max: 10, placeholder: 'Например: 3', helper: 'WB, Озон, ЯМ, СберМегаМаркет и др.' },
    { id: 'industry', text: 'Ваша отрасль?', type: 'select', placeholder: 'Выберите отрасль', options: [
      { value: 'electronics', label: 'Электроника' },
      { value: 'clothing', label: 'Одежда и обувь' },
      { value: 'home-goods', label: 'Товары для дома' },
      { value: 'cosmetics', label: 'Косметика' },
      { value: 'auto-parts', label: 'Автозапчасти' },
      { value: 'toys', label: 'Детские товары' },
      { value: 'books', label: 'Книги' },
      { value: 'food', label: 'Продукты питания' },
      { value: 'other', label: 'Другое' },
    ]},
    { id: 'orderVolume', text: 'Сколько заказов в день вы обрабатываете?', type: 'number', min: 1, max: 10000, placeholder: 'Например: 30', helper: 'Среднее количество заказов со всех маркетплейсов' },
    { id: 'avgSkuValue', text: 'Средняя стоимость товара (₽)?', type: 'number', min: 100, max: 1000000, placeholder: 'Например: 3000', helper: 'Средний чек по товарам' },
    { id: 'staffCount', text: 'Сколько человек на складе?', type: 'number', min: 1, max: 100, placeholder: 'Например: 1', helper: 'Кладовщики, комплектовщики, приёмка' },
  ], []);

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
    
    const hourlyRate = REGIONAL_HOURLY_RATES.regions;

    // 1. Стоимость времени (реалистичная ставка)
    const timeCost = Math.floor(hours * hourlyRate * 4.3); // Часы в неделю → в месяц

    // 2. Штрафы (прямой ввод пользователя, основанный на реальной формуле Озон)
    const penaltyCost = penalties;

    // 3. Упущенные продажи (консервативно)
    const baseLossRate = 0.02;
    const storeComplexity = Math.min(0.03, (stores - 1) * 0.015);
    const skuComplexity = Math.min(0.02, Math.log10(skus) * 0.008);
    const volumeFactor = Math.min(0.015, Math.log10(orderVolume) * 0.008);
    
    const totalLossRate = Math.min(0.08, baseLossRate + storeComplexity + skuComplexity + volumeFactor);
    
    const monthlyOrders = orderVolume * 30;
    const avgOrderValue = avgSkuValue * 1.3;

    // Важно: считаем не "весь оборот", а потери по марже, иначе оценка завышается.
    const contributionMargin = 0.35; // 35% консервативная маржа для e-com
    const missedRevenueBeforeMargin = monthlyOrders * totalLossRate * avgOrderValue * multipliers.penaltyRisk;
    const missedSales = Math.floor(missedRevenueBeforeMargin * contributionMargin);

    // 4. Стоимость ошибок персонала (снижена)
    const humanErrorCost = Math.floor(skus * stores * 25 * multipliers.errorRate * Math.sqrt(staffCount));

    const total = timeCost + penaltyCost + missedSales + humanErrorCost;
    
    const efficiency = Math.max(10, Math.round(
      100 - (totalLossRate * 100) - Math.min(15, penaltyCost / 5000) - Math.min(10, hours / 10)
    ));

    // ROI и срок окупаемости
    const monthlySavings = Math.floor(total * 0.65);
    const annualSavings = monthlySavings * 12;
    const proPlanPrice = 4900;
    const roi = Math.round((annualSavings / proPlanPrice) * 100);
    const paybackMonths = Math.max(1, Math.ceil(proPlanPrice / monthlySavings));

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
        totalLossRatePct: Number((totalLossRate * 100).toFixed(2)),
        hourlyRateUsed: hourlyRate,
        industryName: multipliers.name,
        penaltyRiskMultiplier: multipliers.penaltyRisk,
        errorRateMultiplier: multipliers.errorRate,
        missedRevenueBeforeMargin: Math.floor(missedRevenueBeforeMargin),
        contributionMarginPct: Math.round(contributionMargin * 100),
      },
    };
  }, []);

  // ============= Validation =============
  const validateAnswer = useCallback((value: string, question: any): { type: 'error' | 'warning' | null; message: string; } | null => {
    if (value === '') return null;
    
    if (question.type === 'select') return null;
    
    const num = parseInt(value, 10);
    if (isNaN(num)) return { type: 'error', message: 'Пожалуйста, введите число' };
    if (num < question.min) return { type: 'error', message: `Минимальное значение: ${question.min}` };
    if (question.max && num > question.max) return { type: 'error', message: `Максимальное значение: ${question.max}` };
    
    if (question.id === 'avgSkuValue' && num > 10000) {
      return { type: 'warning', message: '⚠️ Стоимость слишком высока. Уточните данные.' };
    }
    if (question.id === 'orderVolume' && num > 500) {
      return { type: 'warning', message: '⚠️ Значение кажется завышенным. Проверьте, пожалуйста.' };
    }
    if (question.id === 'stores' && num > 5) {
      return { type: 'warning', message: '⚠️ 5+ маркетплейсов требует кастомного решения. Свяжитесь: @salavey13' };
    }
    
    return null;
  }, []);

  // ============= Save Progress =============
  const saveProgress = useCallback(async () => {
    if (!userId) return;
    
    try {
      const result = await saveWarehouseAuditProgress({
        userId,
        currentStep: step,
        answersSnapshot: answers as Record<string, unknown>,
      });

      if (!result.success) {
        throw new Error(result.error || 'Failed to save progress');
      }
      
      console.log('💾 Progress saved:', { step, answers });
    } catch (error) {
      console.error('Failed to save progress:', error);
    }
  }, [userId, step, answers]);

  // ============= Roadmap Generation =============
  const generateRoadmap = useCallback((calc: CalculationBreakdown, ans: EnhancedAuditAnswers): RoadmapItem[] => {
    const roadmap: RoadmapItem[] = [];
    
    if (calc.penaltyCost > 10000) {
      roadmap.push({
        priority: 1,
        title: '🎯 Автоматизация обновлений остатков',
        impact: Math.floor(calc.penaltyCost * 0.8),
        effort: '1 день',
        description: 'Настройка API-интеграций с маркетплейсами. Исключает 80% штрафов.',
        quickWin: true,
      });
    }
    
    if (calc.hours > 10) {
      roadmap.push({
        priority: 2,
        title: '⚡ Централизация управления',
        impact: Math.floor(calc.hours * 1200),
        effort: '3 дня',
        description: 'Единая панель для всех маркетплейсов и складов. Экономия 15+ часов/нед.',
        quickWin: false,
      });
    }
    
    if (calc.stores > 1) {
      roadmap.push({
        priority: 3,
        title: '🏪 Оптимизация многоканальности',
        impact: Math.floor(calc.missedSales * 0.5),
        effort: '5 дней',
        description: `Управление ${calc.stores} маркетплейсами из одной системы. Синхронизация в реальном времени.`,
        quickWin: false,
      });
    }
    
    if (calc.skus > 150) {
      roadmap.push({
        priority: 4,
        title: '📦 Визуализация склада',
        impact: Math.floor(calc.humanErrorCost * 0.4),
        effort: '2 дня',
        description: `Карта и фильтры для ${calc.skus} SKU → ускорение поиска в 3 раза.`,
        quickWin: true,
      });
    }
    
    if (ans.staffCount > 3) {
      roadmap.push({
        priority: 5,
        title: '👨‍🏫 Обучение персонала',
        impact: Math.floor(calc.humanErrorCost * 0.25),
        effort: '1 неделя',
        description: 'Сокращение ошибок кладовщиков с чек-листами и геймификацией.',
        quickWin: false,
      });
    }
    
    return roadmap.sort((a, b) => a.priority - b.priority);
  }, []);

  // ============= Clear progress after completion =============
  const clearProgress = useCallback(async () => {
    if (!userId) return;
    try {
      const result = await clearWarehouseAuditProgress(userId);
      if (!result.success) throw new Error(result.error || 'Failed to clear progress');
      console.log('🗑️ Progress cleared');
    } catch (error) {
      console.error('Failed to clear progress:', error);
    }
  }, [userId]);

  // ============= Navigation =============
  const handleNext = useCallback(() => {
    const validation = validateAnswer(currentAnswer, questions[step]);
    if (validation?.type === 'error') {
      toast.error(validation.message, { icon: '⚠️' });
      trackAuditEvent('validation_error', { error: validation.message, questionId: questions[step].id });
      return;
    }

    const value = questions[step].type === 'select' ? currentAnswer : parseInt(currentAnswer, 10);
    const newAnswers = { ...answers, [questions[step].id]: value };
    setAnswers(newAnswers);
    trackAuditEvent('question_completed', { questionId: questions[step].id });

    // Save progress after each answer
    if (userId) {
      saveProgress();
    }

    if (step < questions.length - 1) {
      setStep(step + 1);
      setCurrentAnswer('');
    } else {
      // Final calculation
      const result = calcLosses(newAnswers);
      const smartRoadmap = generateRoadmap(result.breakdown, newAnswers as EnhancedAuditAnswers);
      
      setBreakdown(result.breakdown);
      setRoadmap(smartRoadmap);
      setShowResult(true);
      trackAuditEvent('audit_completed', { totalLosses: result.total });
      if (userId) {
        checkAndUnlockFeatureAchievement(userId, 'wb_audit_completed', true).catch(() => null);
      }
      
      // Clear progress after completion
      clearProgress();
      
      console.log('📊 Audit completed:', { 
        inputs: newAnswers, 
        result: result.breakdown,
        roadmap: smartRoadmap,
      });
    }
  }, [answers, currentAnswer, questions, step, validateAnswer, calcLosses, generateRoadmap, trackAuditEvent, userId, saveProgress, clearProgress]);

  const startAudit = useCallback((options?: { preserveAnswers?: boolean }) => {
    const shouldPreserveAnswers = options?.preserveAnswers === true;

    setStep(1);
    if (!shouldPreserveAnswers) {
      setAnswers({});
      setCurrentAnswer('');
    } else {
      const firstQuestionValue = answers[questions[1]?.id as keyof EnhancedAuditAnswers];
      setCurrentAnswer(firstQuestionValue !== undefined && firstQuestionValue !== null ? String(firstQuestionValue) : '');
    }

    setBreakdown(null);
    setShowResult(false);
    setIsSending(false);
    setRoadmap([]);
    setHasCompletedAudit(false);
    setLastCompletedAudit(null);

    trackAuditEvent('audit_started', { preservedAnswers: shouldPreserveAnswers });
    if (userId) {
      checkAndUnlockFeatureAchievement(userId, 'wb_audit_started', true).catch(() => null);
    }
  }, [answers, questions, trackAuditEvent, userId]);

  const resumeAudit = useCallback(() => {
    trackAuditEvent('audit_resumed', { step });
  }, [step, trackAuditEvent]);

  const viewLastAudit = useCallback(() => {
    if (lastCompletedAudit) {
      setBreakdown(lastCompletedAudit.calculation);
      setRoadmap(lastCompletedAudit.roadmap);
      setAnswers(lastCompletedAudit.answers);
      setStep(8);
      setShowResult(true);
      trackAuditEvent('view_last_audit', {});
    }
  }, [lastCompletedAudit, trackAuditEvent]);

  // ============= Report Generation =============
  const saveAuditReport = useCallback(async (report: AuditReport) => {
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
  }, []);

  const handleGetReport = useCallback(async () => {
    if (!userId) {
      toast.error('Пожалуйста, войдите в систему', { icon: '🔐' });
      return;
    }

    setIsSending(true);
    try {
      const result = calcLosses(answers);
      
      // Build Telegram message with contact
      let message = `🏴‍☠️ *WAREHOUSE DIAGNOSTIC REPORT*

🛑 *Monthly Burn:* ${result.breakdown.monthlySavings.toLocaleString('ru-RU')}₽
(Money currently wasted on fines/manual work)

⚡ *Efficiency Score:* ${result.breakdown.efficiency}%

📉 *The Leaks:*
• Wasted Labor: ${result.breakdown.timeCost.toLocaleString()}₽
• MP Fines: ${result.breakdown.penaltyCost.toLocaleString()}₽
• Lost Sales: ${result.breakdown.missedSales.toLocaleString()}₽

🚀 *BATTLE PLAN (Immediate fixes):*`;

      const topRoadmap = roadmap.slice(0, 3);
      topRoadmap.forEach((item, i) => {
        message += `\n${i + 1}. 🔹 ${item.title} (Save ~${item.impact.toLocaleString()}₽)`;
      });

      message += `\n\n💾 *Save this report.*\n👉 [Start Free Setup](https://t.me/oneBikePlsBot/app)`;

      await sendComplexMessage(userId, message, [], {
        parseMode: 'Markdown',
        imageQuery: 'warehouse automation success',
      });

      // Save full report
      const report: AuditReport = {
        userId: userId,
        timestamp: new Date(),
        answers: answers as EnhancedAuditAnswers,
        calculation: result.breakdown,
        totalLosses: result.total,
        efficiency: result.breakdown.efficiency,
        roadmap: roadmap,
      };
      
      await saveAuditReport(report);

      toast.success('✅ План оптимизации отправлен в Telegram!', {
        icon: '📨',
        duration: 5000,
      });
      await checkAndUnlockFeatureAchievement(userId, 'wb_audit_report_sent', true);
      
      trackAuditEvent('report_sent', { totalLosses: result.total });
    } catch (error) {
      console.error('Failed to send audit report:', error);
      toast.error('❌ Ошибка отправки отчёта', { icon: '❌' });
    } finally {
      setIsSending(false);
    }
  }, [userId, answers, roadmap, calcLosses, saveAuditReport, trackAuditEvent]);

  const reset = useCallback(() => {
    setStep(0);
    setAnswers({});
    setCurrentAnswer('');
    setBreakdown(null);
    setShowResult(false);
    setIsSending(false);
    setRoadmap([]);
    setHasCompletedAudit(false);
    setLastCompletedAudit(null);
    trackAuditEvent('audit_reset', {});
  }, [trackAuditEvent]);

  const applyAutoDetectedData = useCallback((detected: Partial<EnhancedAuditAnswers>) => {
    const merged = { ...answers, ...detected };
    setAnswers(merged);

    if (step > 0 && questions[step]) {
      const nextValue = merged[questions[step].id as keyof EnhancedAuditAnswers];
      if (nextValue !== undefined && nextValue !== null) {
        setCurrentAnswer(String(nextValue));
      }
    }

    trackAuditEvent('audit_autofill_applied', {
      fields: Object.keys(detected),
    });
  }, [answers, step, questions, trackAuditEvent]);

  const runAuditFromDetectedData = useCallback((detected: Partial<EnhancedAuditAnswers>) => {
    const baseAnswers: Partial<EnhancedAuditAnswers> = {
      skus: 1,
      hours: 2,
      penalties: 0,
      stores: 1,
      industry: 'other',
      orderVolume: 1,
      avgSkuValue: 1500,
      staffCount: 1,
    };

    const normalized = {
      ...baseAnswers,
      ...answers,
      ...detected,
    };

    const result = calcLosses(normalized);
    const smartRoadmap = generateRoadmap(result.breakdown, normalized as EnhancedAuditAnswers);

    setAnswers(normalized);
    setBreakdown(result.breakdown);
    setRoadmap(smartRoadmap);
    setStep(questions.length);
    setShowResult(true);
    setCurrentAnswer('');
    if (userId) {
      checkAndUnlockFeatureAchievement(userId, 'wb_audit_completed', true).catch(() => null);
    }

    clearProgress();

    trackAuditEvent('audit_autofill_completed', {
      totalLosses: result.total,
      fields: Object.keys(detected),
    });
  }, [answers, calcLosses, clearProgress, generateRoadmap, questions.length, trackAuditEvent, userId]);

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
    hasCompletedAudit,
    lastCompletedAudit,
    setCurrentAnswer,
    handleNext,
    handleGetReport,
    reset,
    startAudit,
    resumeAudit,
    viewLastAudit,
    validateAnswer,
    trackAuditEvent,
    applyAutoDetectedData,
    runAuditFromDetectedData,
    answers,
  };
};

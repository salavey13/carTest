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
  const timeCost = Math.floor(hours * hourlyRate);

  // 2. Штрафы (прямой ввод пользователя)
  const penaltyCost = penalties;

  // 3. Упущенные продажи - ИЗМЕНЁННАЯ ФОРМУЛА
  // Базовая потеря от ручного учёта: 2% (была 5%)
  const baseLossRate = 0.02;
  // Сложность от количества маркетплейсов (макс 3%)
  const storeComplexity = Math.min(0.03, (stores - 1) * 0.015);
  // Сложность от количества SKU (макс 2%)
  const skuComplexity = Math.min(0.02, Math.log10(skus) * 0.008);
  // Фактор объёма заказов (макс 1.5%)
  const volumeFactor = Math.min(0.015, Math.log10(orderVolume) * 0.008);
  
  const totalLossRate = Math.min(0.08, baseLossRate + storeComplexity + skuComplexity + volumeFactor);
  
  // Реальное количество заказов в месяц (не 30, а фактическое)
  const monthlyOrders = orderVolume * 30;
  const avgOrderValue = avgSkuValue * 1.3; // Учёт наценки
  
  const missedSales = Math.floor(monthlyOrders * totalLossRate * avgOrderValue * multipliers.penaltyRisk);

  // 4. Стоимость ошибок персонала (снижена)
  const humanErrorCost = Math.floor(skus * stores * 25 * multipliers.errorRate * Math.sqrt(staffCount));

  const total = timeCost + penaltyCost + missedSales + humanErrorCost;
  
  // Эффективность: 100% - потери - штрафы - время
  const efficiency = Math.max(10, Math.round(
    100 - (totalLossRate * 100) - Math.min(15, penaltyCost / 5000) - Math.min(10, hours / 10)
  ));

  // ROI и срок окупаемости
  const monthlySavings = Math.floor(total * 0.65); // Более консервативная экономия (была 0.7)
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
    },
  };
}, [answers]);

  // ============= Validation =============
  const validateAnswer = (value: string, question: any): string | null => {
    if (value === '') return null;
    
    const num = parseInt(value, 10);
    if (isNaN(num)) return 'Пожалуйста, введите число';
    if (num < question.min) return `Минимальное значение: ${question.min}`;
    if (question.max && num > question.max) return `Максимальное значение: ${question.max}`;
    
    // Reality checks with warnings (not errors)
    if (question.id === 'avgSkuValue' && num > 10000) {
      return '⚠️ Стоимость слишком высока. Уточните данные.';
    }
    if (question.id === 'orderVolume' && num > 500) {
      return '⚠️ Значение кажется завышенным. Проверьте, пожалуйста.';
    }
    
    return null;
  };

  // ============= Roadmap Generation =============
  const generateRoadmap = useCallback((calc: CalculationBreakdown, ans: EnhancedAuditAnswers): RoadmapItem[] => {
    const roadmap: RoadmapItem[] = [];
    
    // Приоритет по ROI
    if (calc.penaltyCost > 10000) {
      roadmap.push({
        priority: 1,
        title: '🎯 Автоматизация обновлений остатков',
        impact: Math.floor(calc.penaltyCost * 0.8),
        effort: '1 день',
        description: 'Настройка API-интеграций с маркетплейсами',
        quickWin: true,
      });
    }
    
    if (calc.hours > 10) {
      roadmap.push({
        priority: 2,
        title: '⚡ Централизация управления',
        impact: Math.floor(calc.hours * 1200),
        effort: '3 дня',
        description: 'Единая панель для всех маркетплейсов и складов',
        quickWin: false,
      });
    }
    
    if (calc.stores > 1) {
      roadmap.push({
        priority: 3,
        title: '🏪 Оптимизация многоканальности',
        impact: Math.floor(calc.missedSales * 0.5),
        effort: '5 дней',
        description: `Управление ${calc.stores} маркетплейсами из одной системы`,
        quickWin: false,
      });
    }
    
    if (calc.skus > 150) {
      roadmap.push({
        priority: 4,
        title: '📦 Визуализация склада',
        impact: Math.floor(calc.humanErrorCost * 0.4),
        effort: '2 дня',
        description: `Карта и фильтры для ${calc.skus} SKU → ускорение поиска`,
        quickWin: true,
      });
    }
    
    if (ans.staffCount > 3) {
      roadmap.push({
        priority: 5,
        title: '👨‍🏫 Обучение персонала',
        impact: Math.floor(calc.humanErrorCost * 0.25),
        effort: '1 неделя',
        description: 'Сокращение ошибок кладовщиков с чек-листами',
        quickWin: false,
      });
    }
    
    return roadmap.sort((a, b) => a.priority - b.priority);
  }, []);

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
      const smartRoadmap = generateRoadmap(result.breakdown, newAnswers as EnhancedAuditAnswers);
      
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
      
      // Build Telegram message with contact
      let message = `📊 *Ваш аудит склада готов!*

✅ *Потенциал экономии:* ${result.breakdown.monthlySavings.toLocaleString('ru-RU')}₽/мес

📈 *Текущая эффективность:* ${result.breakdown.efficiency}%

💰 *Годовой ROI:* ${result.breakdown.roi}%
⏱️ *Срок окупаемости:* ${result.breakdown.paybackMonths} мес

📋 *Детализация потерь:*
• Время: ${result.breakdown.timeCost.toLocaleString()}₽
• Штрафы: ${result.breakdown.penaltyCost.toLocaleString()}₽
• Упущено: ${result.breakdown.missedSales.toLocaleString()}₽
• Ошибки: ${result.breakdown.humanErrorCost.toLocaleString()}₽

🚀 *Приоритетные действия:*`;

      // Add top 3 roadmap items
      const topRoadmap = roadmap.slice(0, 3);
      topRoadmap.forEach((item, i) => {
        message += `\n${i + 1}. ${item.title} → ${item.impact.toLocaleString()}₽/мес`;
      });

      message += `\n\n💡 *Следующий шаг:* Начните с бесплатного тарифа

📞 *Вопросы/предложения:* @salavey13`;

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
      
      trackAuditEvent('report_sent', { totalLosses: result.total });
    } catch (error) {
      console.error('Failed to send audit report:', error);
      toast.error('❌ Ошибка отправки отчёта', { icon: '❌' });
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
    setEstimatedTime('60 сек');
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
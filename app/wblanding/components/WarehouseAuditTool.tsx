'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import {
  Loader2,
  ChevronLeft,
  Terminal,
  TriangleAlert,
  Skull,
  CheckCircle2,
  Send,
  RotateCcw,
  Keyboard,
  ArrowRight,
  UploadCloud,
  Sparkles,
  WandSparkles,
  FileSpreadsheet,
} from 'lucide-react';
import Link from 'next/link';
import { useWarehouseAudit, type EnhancedAuditAnswers } from '../hooks/useWarehouseAudit';
import { useAppContext } from '@/contexts/AppContext';
import { useMemo, useState, useEffect, useCallback } from 'react';
import * as XLSX from 'xlsx';
import { toast } from 'sonner';

type ValidationState = { type: 'error' | 'warning' | null; message: string } | null;

type AuditAutofillResult = {
  suggested: Partial<EnhancedAuditAnswers>;
  confidence: number;
  notes: string[];
};

const normalizeHeader = (header: string): string =>
  (header || '').toLowerCase().trim().replace(/\s+/g, '');

const HEADER_ALIASES: Record<string, keyof EnhancedAuditAnswers | 'date' | 'marketplace' | 'category'> = {
  артикул: 'skus',
  sku: 'skus',
  vendorcode: 'skus',
  баркод: 'skus',

  остаток: 'skus',
  quantity: 'skus',

  цена: 'avgSkuValue',
  стоимость: 'avgSkuValue',
  price: 'avgSkuValue',
  сумма: 'avgSkuValue',

  заказы: 'orderVolume',
  orders: 'orderVolume',
  продажи: 'orderVolume',
  sales: 'orderVolume',

  штраф: 'penalties',
  penalties: 'penalties',
  удержание: 'penalties',

  сотрудник: 'staffCount',
  employee: 'staffCount',
  кладовщик: 'staffCount',

  маркетплейс: 'marketplace',
  marketplace: 'marketplace',
  канал: 'marketplace',

  категория: 'category',
  category: 'category',

  дата: 'date',
  date: 'date',
};

const inferIndustry = (samples: string[]): EnhancedAuditAnswers['industry'] => {
  const joined = samples.join(' ').toLowerCase();
  if (/электр|гаджет|телефон|ноутбук|electron/.test(joined)) return 'electronics';
  if (/одеж|обув|fashion|shirt|dress/.test(joined)) return 'clothing';
  if (/дом|мебел|интерьер|home/.test(joined)) return 'home-goods';
  if (/космет|beauty|парфюм/.test(joined)) return 'cosmetics';
  if (/авто|запчаст|car|motor/.test(joined)) return 'auto-parts';
  if (/игруш|toy|детск/.test(joined)) return 'toys';
  if (/книг|book/.test(joined)) return 'books';
  if (/пищ|еда|food|продукт/.test(joined)) return 'food';
  return 'other';
};

const parseWorkbookForAudit = (file: File): Promise<AuditAutofillResult> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        const workbook = XLSX.read(data, { type: 'array', raw: false });

        const skuSet = new Set<string>();
        const marketplaceSet = new Set<string>();
        const categorySamples: string[] = [];
        const employeeSet = new Set<string>();
        const orderValues: number[] = [];
        const priceValues: number[] = [];
        const penaltyValues: number[] = [];
        const seenDates = new Set<string>();

        workbook.SheetNames.forEach((sheetName) => {
          const sheet = workbook.Sheets[sheetName];
          const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' });

          rows.forEach((row) => {
            const entries = Object.entries(row);
            entries.forEach(([rawKey, rawValue]) => {
              const key = normalizeHeader(rawKey);
              const str = String(rawValue ?? '').trim();
              if (!str) return;

              let mapped: (typeof HEADER_ALIASES)[keyof typeof HEADER_ALIASES] | undefined = HEADER_ALIASES[key];
              if (!mapped) {
                const alias = Object.entries(HEADER_ALIASES).find(([candidate]) => key.includes(candidate));
                mapped = alias?.[1];
              }

              if (!mapped) return;

              const numeric = Number(str.toString().replace(/[^\d.,-]/g, '').replace(',', '.'));

              if (mapped === 'skus' && !Number.isNaN(numeric)) {
                if (rawKey.toLowerCase().includes('остат') || rawKey.toLowerCase().includes('quantity')) {
                  return;
                }
                skuSet.add(str);
              }

              if (mapped === 'marketplace') marketplaceSet.add(str.toLowerCase());
              if (mapped === 'category') categorySamples.push(str);
              if (mapped === 'staffCount') employeeSet.add(str);
              if (mapped === 'orderVolume' && Number.isFinite(numeric) && numeric > 0) orderValues.push(numeric);
              if (mapped === 'avgSkuValue' && Number.isFinite(numeric) && numeric > 0) priceValues.push(numeric);
              if (mapped === 'penalties' && Number.isFinite(numeric) && numeric > 0) penaltyValues.push(numeric);
              if (mapped === 'date') seenDates.add(str);
            });
          });
        });

        const skus = Math.max(1, skuSet.size || Math.min(500, Math.max(10, Math.round((orderValues[0] ?? 30) * 4))));

        const dailyOrders =
          orderValues.length > 0
            ? Math.round(orderValues.reduce((a, b) => a + b, 0) / Math.max(1, seenDates.size || orderValues.length))
            : Math.max(5, Math.round(skus * 0.08));

        const avgSkuValue =
          priceValues.length > 0
            ? Math.round(priceValues.reduce((a, b) => a + b, 0) / priceValues.length)
            : 2200;

        const penalties = penaltyValues.length > 0 ? Math.round(penaltyValues.reduce((a, b) => a + b, 0)) : 0;

        const stores = Math.max(1, Math.min(6, marketplaceSet.size || 1));
        const staffCount = Math.max(1, employeeSet.size || Math.ceil(skus / 120));

        const hours = Math.max(2, Math.min(40, Math.round(skus / 25 + stores * 1.5 + dailyOrders / 40)));

        const suggested: Partial<EnhancedAuditAnswers> = {
          skus,
          stores,
          orderVolume: dailyOrders,
          avgSkuValue,
          penalties,
          staffCount,
          hours,
          industry: inferIndustry(categorySamples),
        };

        let confidence = 45;
        confidence += skuSet.size ? 15 : 0;
        confidence += orderValues.length ? 15 : 0;
        confidence += priceValues.length ? 10 : 0;
        confidence += penaltyValues.length ? 10 : 0;
        confidence += categorySamples.length ? 5 : 0;

        const notes: string[] = [
          `Найдено листов: ${workbook.SheetNames.length}`,
          `SKU: ${skus}, заказов/день: ${dailyOrders}, средний чек: ${avgSkuValue.toLocaleString('ru-RU')}₽`,
        ];
        if (!penaltyValues.length) notes.push('Штрафы не найдены — выставлено 0₽.');
        if (!marketplaceSet.size) notes.push('Маркетплейс явно не определён — принято 1 канал.');

        resolve({ suggested, confidence: Math.min(95, confidence), notes });
      } catch (error) {
        reject(error);
      }
    };
    reader.onerror = () => reject(new Error('Не удалось прочитать файл'));
    reader.readAsArrayBuffer(file);
  });
};

export const WarehouseAuditTool = () => {
  const { dbUser } = useAppContext();
  const {
    step,
    questions,
    currentAnswer,
    isSending,
    breakdown,
    showResult,
    efficiency,
    estimatedTime,
    roadmap,
    setCurrentAnswer,
    handleNext,
    handleGetReport,
    reset,
    startAudit,
    validateAnswer,
    applyAutoDetectedData,
    runAuditFromDetectedData,
  } = useWarehouseAudit(dbUser?.user_id);

  const [validationResult, setValidationResult] = useState<ValidationState>(null);
  const [isAutofilling, setIsAutofilling] = useState(false);
  const [autofillSummary, setAutofillSummary] = useState<AuditAutofillResult | null>(null);

  useEffect(() => {
    if (step > 0 && currentAnswer && questions && questions[step]) {
      setValidationResult(validateAnswer(currentAnswer, questions[step]));
    } else {
      setValidationResult(null);
    }
  }, [currentAnswer, step, questions, validateAnswer]);

  const progress = useMemo(() => ((step) / questions.length) * 100, [step, questions.length]);

  const onXlsxUpload = useCallback(async (file: File) => {
    try {
      setIsAutofilling(true);
      const result = await parseWorkbookForAudit(file);
      setAutofillSummary(result);
      applyAutoDetectedData(result.suggested);
      toast.success(`AI-аудит заполнен (${result.confidence}% confidence)`);
    } catch (error) {
      console.error(error);
      toast.error('Не получилось разобрать XLSX. Проверь формат отчёта.');
    } finally {
      setIsAutofilling(false);
    }
  }, [applyAutoDetectedData]);

  if (step === 0 && !showResult) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="bg-zinc-950 border border-zinc-800 rounded-[28px] p-4 sm:p-8 shadow-2xl max-w-3xl mx-auto relative overflow-hidden"
      >
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-brand-cyan via-indigo-500 to-brand-pink" />

        <div className="text-center mb-6 sm:mb-8">
          <div className="inline-flex items-center justify-center w-12 h-12 sm:w-16 sm:h-16 bg-zinc-900 rounded-2xl mb-4 border border-zinc-700">
            <Terminal className="w-6 h-6 sm:w-8 sm:h-8 text-brand-cyan" />
          </div>
          <h3 className="text-2xl sm:text-5xl font-black text-white mb-3 tracking-tight leading-tight">
            Аудит склада за 60 секунд
          </h3>
          <p className="text-sm sm:text-lg text-zinc-400 max-w-lg mx-auto">
            Залей XLSX-выгрузку WB/Ozon/ЯМ — метрики рассчитаются автоматически. Дальше можно сразу получить план в Telegram.
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="relative flex flex-col items-center justify-center rounded-2xl border border-dashed border-brand-cyan/40 bg-brand-cyan/5 p-4 sm:p-5 text-center cursor-pointer hover:border-brand-cyan transition-colors">
            <input
              type="file"
              accept=".xlsx,.xls"
              className="absolute inset-0 opacity-0 cursor-pointer"
              onChange={(e) => e.target.files?.[0] && onXlsxUpload(e.target.files[0])}
            />
            {isAutofilling ? <Loader2 className="w-6 h-6 animate-spin text-brand-cyan mb-2" /> : <UploadCloud className="w-6 h-6 text-brand-cyan mb-2" />}
            <p className="text-white font-semibold text-sm sm:text-base">Загрузить XLSX и авто-заполнить</p>
            <p className="text-zinc-400 text-xs mt-1">Поддержка таблиц маркетплейсов</p>
          </label>

          <Button
            onClick={() => startAudit()}
            className="h-auto rounded-2xl bg-white text-black hover:bg-zinc-200 py-4 sm:py-5 text-base sm:text-lg font-bold"
          >
            Ручной ввод <ArrowRight className="ml-2 w-5 h-5" />
          </Button>
        </div>

        {autofillSummary && (
          <div className="mt-4 rounded-2xl border border-zinc-700 bg-zinc-900/70 p-4">
            <div className="flex items-center gap-2 text-brand-cyan font-semibold text-sm mb-2">
              <WandSparkles className="w-4 h-4" />
              Auto-audit готов • {autofillSummary.confidence}% confidence
            </div>
            <ul className="space-y-1 text-xs text-zinc-300 mb-3">
              {autofillSummary.notes.map((n) => <li key={n}>• {n}</li>)}
            </ul>
            <Button
              onClick={() => runAuditFromDetectedData(autofillSummary.suggested)}
              className="w-full rounded-xl bg-brand-cyan text-black hover:bg-brand-cyan/80 font-bold"
            >
              <Sparkles className="w-4 h-4 mr-2" /> Мгновенный отчёт из файла
            </Button>
          </div>
        )}
      </motion.div>
    );
  }

  if (showResult && breakdown) {
    return (
      <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} className="bg-black border border-zinc-800 rounded-[28px] p-4 sm:p-8 max-w-5xl mx-auto">
        <div className="grid gap-5 lg:grid-cols-2">
          <div className="space-y-4">
            <h3 className="text-zinc-400 font-mono text-xs uppercase">Текущий статус</h3>
            <h2 className="text-2xl sm:text-4xl font-black text-white">Отчет эффективности</h2>

            <div className="bg-red-900/10 border border-red-900/30 p-4 sm:p-6 rounded-2xl">
              <div className="flex items-center gap-2 mb-2 text-red-400 font-bold text-xs sm:text-sm">
                <Skull className="w-5 h-5" /> Ежемесячные потери
              </div>
              <div className="text-3xl sm:text-5xl font-black text-red-500 font-mono tracking-tight">-{Math.floor(breakdown.monthlySavings / 0.65).toLocaleString()}₽</div>
            </div>

            <div className="bg-zinc-900 border border-zinc-800 p-4 rounded-2xl">
              <div className="flex justify-between items-center mb-3 text-sm">
                <span className="text-zinc-400">Operational Score</span>
                <span className={`text-2xl font-bold ${efficiency > 70 ? 'text-green-500' : 'text-yellow-500'}`}>{efficiency}/100</span>
              </div>
              <div className="w-full bg-zinc-800 h-2 rounded-full overflow-hidden">
                <div className="bg-indigo-500 h-full" style={{ width: `${efficiency}%` }} />
              </div>
            </div>
          </div>

          <div className="bg-zinc-900/60 p-4 sm:p-7 rounded-3xl border border-zinc-800">
            <h4 className="text-white font-bold text-xl mb-1">Потенциал экономии</h4>
            <p className="text-zinc-400 text-sm mb-5">Ваш приоритетный roadmap на ближайшие 14 дней</p>
            <div className="text-3xl sm:text-4xl font-black text-white mb-6 font-mono">+{breakdown.monthlySavings.toLocaleString()}₽<span className="text-zinc-500 text-base">/мес</span></div>

            <div className="space-y-2.5 mb-6">
              {roadmap.slice(0, 3).map((item, i) => (
                <div key={i} className="flex items-start gap-2 text-xs sm:text-sm text-zinc-300">
                  <CheckCircle2 className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                  <span>{item.title} (+{item.impact.toLocaleString()}₽)</span>
                </div>
              ))}
            </div>


            <div className="mb-6 rounded-2xl border border-zinc-700 bg-black/30 p-3 sm:p-4">
              <p className="text-[11px] uppercase tracking-wide text-brand-cyan font-semibold mb-2">Прозрачность расчёта</p>
              <ul className="space-y-1.5 text-[11px] sm:text-xs text-zinc-300">
                <li>• Время: {breakdown.hours} ч/нед × {(breakdown.hourlyRateUsed ?? 2000).toLocaleString()}₽ × 4.3 = <span className="text-white">{breakdown.timeCost.toLocaleString()}₽</span></li>
                <li>• Штрафы: прямой ввод из отчёта/анкеты = <span className="text-white">{breakdown.penaltyCost.toLocaleString()}₽</span></li>
                <li>• Упущенные продажи: заказы/день × 30 × (ср.чек×1.3) × loss rate <span className="text-white">{(breakdown.totalLossRatePct ?? 2)}%</span> × risk {(breakdown.penaltyRiskMultiplier ?? 1)} = <span className="text-white">{breakdown.missedSales.toLocaleString()}₽</span></li>
                <li>• Ошибки команды: SKU × каналы × 25 × errorRate {(breakdown.errorRateMultiplier ?? 1)} × √staff = <span className="text-white">{breakdown.humanErrorCost.toLocaleString()}₽</span></li>
                <li>• Отрасль: <span className="text-white">{(breakdown.industryName ?? "Другое")}</span>; потенциал экономии считается как <span className="text-white">65%</span> от total loss.</li>
              </ul>
            </div>

            {dbUser?.user_id ? (
              <Button onClick={handleGetReport} disabled={isSending} className="w-full bg-white text-black hover:bg-zinc-200 font-bold py-5 rounded-xl">
                {isSending ? <Loader2 className="animate-spin mr-2" /> : <><Send className="mr-2 w-5 h-5" /> Отправить план в Telegram</>}
              </Button>
            ) : (
              <div className="text-center">
                <p className="text-zinc-400 mb-3 text-sm">Войдите, чтобы получить файл внедрения.</p>
                <Link href="/wb">
                  <Button variant="outline" className="border-zinc-600 text-white hover:bg-zinc-800">Войти / Регистрация</Button>
                </Link>
              </div>
            )}

            <button onClick={reset} className="mt-5 text-zinc-500 text-xs hover:text-white flex items-center justify-center w-full gap-2">
              <RotateCcw className="w-3 h-3" /> Пересчитать
            </button>
          </div>
        </div>
      </motion.div>
    );
  }

  if (!questions || !questions[step]) return null;

  const currentQ = questions[step];

  return (
    <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} className="bg-zinc-950 border border-zinc-800 rounded-[28px] p-4 sm:p-8 shadow-2xl max-w-2xl mx-auto">
      <div className="mb-6">
        <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
          <motion.div initial={{ width: 0 }} animate={{ width: `${progress}%` }} className="h-full bg-gradient-to-r from-indigo-500 to-brand-cyan" />
        </div>
        <div className="flex justify-between mt-2 text-[11px] font-mono text-zinc-500">
          <span>ШАГ {step + 1}/{questions.length}</span>
          <span>ВРЕМЯ: {estimatedTime}</span>
        </div>
      </div>

      <div className="mb-6 min-h-[170px]">
        <Label className="text-xl sm:text-3xl font-bold text-white mb-3 block leading-tight">{currentQ.text}</Label>
        {currentQ.helper && (
          <p className="text-zinc-400 text-xs sm:text-sm mb-4 flex gap-2 items-start">
            <TriangleAlert className="w-4 h-4 text-yellow-500 flex-shrink-0 mt-0.5" />
            {currentQ.helper}
          </p>
        )}

        <div className="relative">
          {currentQ.type === 'select' ? (
            <select
              value={currentAnswer}
              onChange={(e) => setCurrentAnswer(e.target.value)}
              className="w-full bg-black border border-zinc-700 text-white text-base sm:text-xl p-4 rounded-xl focus:ring-2 focus:ring-brand-cyan outline-none appearance-none"
            >
              <option value="">Выбрать...</option>
              {currentQ.options?.map((opt: { value: string; label: string }) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          ) : (
            <Input
              type="number"
              placeholder={currentQ.placeholder}
              value={currentAnswer}
              onChange={(e) => setCurrentAnswer(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleNext()}
              className="bg-black border-zinc-700 text-white text-2xl sm:text-3xl p-7 h-auto rounded-xl font-mono focus:ring-2 focus:ring-brand-cyan"
              autoFocus
            />
          )}

          {currentQ.type !== 'select' && (
            <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-zinc-600">
              <Keyboard className="w-5 h-5" />
            </div>
          )}
        </div>

        <AnimatePresence>
          {validationResult && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-red-400 mt-2 text-sm font-bold flex items-center gap-2">
              <TriangleAlert className="w-4 h-4" /> {validationResult.message}
            </motion.div>
          )}
        </AnimatePresence>

        <label className="mt-4 inline-flex items-center gap-2 text-xs text-brand-cyan cursor-pointer hover:text-brand-cyan/80">
          <FileSpreadsheet className="w-4 h-4" />
          Обновить ответы из XLSX
          <input type="file" accept=".xlsx,.xls" className="hidden" onChange={(e) => e.target.files?.[0] && onXlsxUpload(e.target.files[0])} />
        </label>
      </div>

      <div className="flex gap-3">
        {step > 1 && (
          <Button variant="ghost" onClick={reset} className="text-zinc-500 hover:text-white px-3">
            <ChevronLeft className="w-5 h-5 mr-1" /> Сброс
          </Button>
        )}
        <Button
          onClick={handleNext}
          disabled={!currentAnswer || validationResult?.type === 'error'}
          className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white py-5 text-base rounded-xl font-bold"
        >
          Далее <ArrowRight className="ml-2 w-5 h-5" />
        </Button>
      </div>
    </motion.div>
  );
};

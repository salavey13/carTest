"use client";

import React, { useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import { 
  ChevronDown, ChevronUp, FileText, Shield, 
  Clock, Package, AlertCircle, Download
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { useAppContext } from "@/contexts/AppContext";
import { toast } from "sonner";
import { generateCrewShiftPdf } from "@/app/wb/actions/service";

interface Props {
  activeShift?: any;
  slug?: string;
  userId?: string;
  offloadUnits?: number;
  onloadUnits?: number;
  sessionDuration?: number;
  errorCount?: number;
  ratePerUnit?: number; // 50 rub default
}

export default function WarehouseStats({
  activeShift,
  slug,
  userId,
  offloadUnits = 0,
  onloadUnits = 0,
  sessionDuration = 0,
  errorCount = 0,
  ratePerUnit = 50
}: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const [generating, setGenerating] = useState(false);
  
  const isRecording = !!activeShift && !activeShift?.clock_out_time;
  const evidenceCount = activeShift?.actions?.length || 0;
  
  // Calculations
  const grossEarnings = offloadUnits * ratePerUnit;
  const solidarityTax = Math.floor(grossEarnings * 0.13); // 13% mutal aid
  const netEarnings = grossEarnings - solidarityTax;
  
  const hoursWorked = Math.floor(sessionDuration / 3600);
  const minutesWorked = Math.floor((sessionDuration % 3600) / 60);
  
  const handleGeneratePdf = async () => {
    if (!slug || !userId || !activeShift) {
      toast.error("Нет активной смены для заверения");
      return;
    }
    setGenerating(true);
    try {
      const res = await generateCrewShiftPdf(userId, activeShift.id);
      if (res.success) {
        toast.success("Акт смены отправлен в Telegram", {
          description: "Сохраните PDF — это ваше доказательство работы"
        });
      } else {
        toast.error("Ошибка генерации");
      }
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className={cn(
      "border rounded-xl overflow-hidden transition-colors",
      isRecording 
        ? "bg-red-50/50 dark:bg-red-950/20 border-red-200 dark:border-red-900" 
        : "bg-card border-border"
    )}>
      {/* COLLAPSED HEADER - SHOWS ONLY MONEY & STATUS */}
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="w-full p-4 flex items-center justify-between hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className={cn(
            "w-3 h-3 rounded-full",
            isRecording ? "bg-red-500 animate-pulse" : "bg-muted-foreground"
          )} />
          <div className="text-left">
            <div className="text-xs text-muted-foreground uppercase tracking-wider font-medium">
              {isRecording ? "Смена идет" : "Смена закрыта"}
            </div>
            <div className="text-2xl font-black text-foreground tabular-nums">
              {netEarnings.toLocaleString()} <span className="text-sm font-medium text-muted-foreground">₽</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {isRecording && evidenceCount > 0 && (
            <div className="hidden sm:flex items-center gap-1.5 text-xs text-red-600 dark:text-red-400 bg-red-100 dark:bg-red-900/30 px-2 py-1 rounded-md">
              <Shield size={12} />
              <span className="font-medium">{evidenceCount} актов</span>
            </div>
          )}
          {isOpen ? <ChevronUp size={20} className="text-muted-foreground" /> : <ChevronDown size={20} className="text-muted-foreground" />}
        </div>
      </button>

      {/* EXPANDED CONTENT - THE LEGAL BREAKDOWN */}
      <AnimatePresence>
        {isOpen && (
          <motion.div 
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="p-4 pt-0 border-t border-border/50">
              
              {/* EARNING BREAKDOWN - like a paystub */}
              <div className="mt-4 space-y-3">
                <div className="flex justify-between items-baseline text-sm">
                  <span className="text-muted-foreground">Выдано единиц</span>
                  <span className="font-mono font-medium">{offloadUnits} × {ratePerUnit}₽</span>
                </div>
                <div className="flex justify-between items-baseline text-sm">
                  <span className="text-muted-foreground">Валовый заработок</span>
                  <span className="font-mono text-foreground">{grossEarnings.toLocaleString()} ₽</span>
                </div>
                <div className="flex justify-between items-baseline text-sm text-amber-600 dark:text-amber-500">
                  <span className="flex items-center gap-1.5">
                    <AlertCircle size={14} />
                    Взнос в кассу (13%)
                  </span>
                  <span className="font-mono">-{solidarityTax.toLocaleString()} ₽</span>
                </div>
                
                <div className="h-px bg-border my-3" />
                
                <div className="flex justify-between items-baseline">
                  <span className="font-bold text-foreground">К выплате</span>
                  <span className="text-2xl font-black text-green-600 dark:text-green-500 tabular-nums">
                    {netEarnings.toLocaleString()} ₽
                  </span>
                </div>
              </div>

              {/* PROTECTION STATUS BAR */}
              <div className={cn(
                "mt-6 p-3 rounded-lg border flex items-start gap-3",
                isRecording 
                  ? "bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-900/50" 
                  : "bg-muted border-border"
              )}>
                <div className="mt-0.5">
                  {isRecording ? (
                    <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                  ) : (
                    <Shield size={16} className="text-muted-foreground" />
                  )}
                </div>
                <div className="flex-1">
                  <div className="text-sm font-bold text-foreground flex items-center gap-2">
                    {isRecording ? "Защита активна" : "Смена заархивирована"}
                    {evidenceCount > 0 && (
                      <span className="text-xs font-normal text-muted-foreground">
                        ({evidenceCount} действий записано)
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                    {isRecording 
                      ? "Каждое действие фиксируется в реестре. При споре с работодателем этот отчет — доказательство."
                      : "Смена завершена. Сгенерируйте PDF для юридического архива."}
                  </p>
                  
                  {/* THE BIG BUTTON - Reason to uncollapse */}
                  {isRecording && evidenceCount > 5 && (
                    <Button 
                      onClick={handleGeneratePdf}
                      disabled={generating}
                      size="sm"
                      className="mt-3 w-full bg-red-600 hover:bg-red-700 text-white border-0"
                    >
                      <FileText size={14} className="mr-2" />
                      {generating ? "Генерация..." : "Заверить смену (PDF)"}
                    </Button>
                  )}
                </div>
              </div>

              {/* FOOTER STATS - Minimal */}
              <div className="mt-4 grid grid-cols-3 gap-4 text-center">
                <div>
                  <div className="text-[10px] uppercase text-muted-foreground tracking-wider">Время</div>
                  <div className="text-sm font-mono font-medium">
                    {hoursWorked}:{String(minutesWorked).padStart(2, '0')}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] uppercase text-muted-foreground tracking-wider">Темп</div>
                  <div className="text-sm font-mono font-medium">
                    {sessionDuration > 0 ? Math.round((offloadUnits / sessionDuration) * 3600) : 0} <span className="text-[10px]">ед/ч</span>
                  </div>
                </div>
                <div>
                  <div className="text-[10px] uppercase text-muted-foreground tracking-wider">Ошибки</div>
                  <div className={cn(
                    "text-sm font-mono font-medium",
                    errorCount > 0 ? "text-red-600" : "text-green-600"
                  )}>
                    {errorCount}
                  </div>
                </div>
              </div>

              {/* EXPORT BUTTON (Secondary) */}
              {!isRecording && evidenceCount > 0 && (
                <Button 
                  onClick={handleGeneratePdf}
                  disabled={generating}
                  variant="outline"
                  size="sm"
                  className="mt-4 w-full"
                >
                  <Download size={14} className="mr-2" />
                  Скачать трудовой акт (PDF)
                </Button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
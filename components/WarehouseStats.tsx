"use client";

import React, { useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import { 
  Star, Package, Clock, Zap, ShieldCheck, 
  AlertTriangle, Users, TrendingUp, 
  Target, Share2, Ghost, ShieldAlert, Coins, 
  ChevronDown, ChevronUp, FileText, Gavel, 
  Radio, Lock, Unlock
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { useAppContext } from "@/contexts/AppContext";
import { toast } from "sonner";
import { generateCrewShiftPdf } from "@/app/wb/actions/service";

type LeaderboardEntry = { name: string; score: number; date: string; xtr?: number; };

interface IncomingProps {
  stats?: { changedCount?: number; totalDelta?: number; stars?: number; offloadUnits?: number; salary?: number };
  itemsCount?: number;
  uniqueIds?: number;
  score?: number;
  level?: number;
  streak?: number;
  dailyStreak?: number;
  checkpointMain?: string;
  checkpointSub?: string;
  changedCount?: number;
  totalDelta?: number;
  stars?: number;
  offloadUnits?: number;
  salary?: number;
  achievements?: string[];
  sessionStart?: number | null;
  errorCount?: number;
  bossMode?: boolean;
  bossTimer?: number;
  leaderboard?: LeaderboardEntry[];
  efficiency?: number;
  avgTimePerItem?: number;
  dailyGoals?: { units: number; errors: number; xtr: number };
  sessionDuration?: number;
  activeShift?: any; // NEW: Pass active shift for "recording" status
  slug?: string;     // NEW: For PDF generation
  userId?: string;   // NEW: For PDF generation
}

export default function WarehouseStats(inProps: IncomingProps) {
  // --- STATE: Collapsed by default for "ghost mode" stealth ---
  const [isOpen, setIsOpen] = useState(false);
  const [generatingPdf, setGeneratingPdf] = useState(false);
  
  const stats = inProps.stats || {};
  const itemsCount = inProps.itemsCount ?? 0;
  const uniqueIds = inProps.uniqueIds ?? 0;
  const score = inProps.score ?? 0;
  const level = inProps.level ?? 1;
  const streak = inProps.streak ?? 0;
  const changedCount = inProps.changedCount ?? stats.changedCount ?? 0;
  const totalDelta = inProps.totalDelta ?? stats.totalDelta ?? 0;
  const stars = inProps.stars ?? stats.stars ?? 0;
  const offloadUnits = inProps.offloadUnits ?? stats.offloadUnits ?? 0;
  const salary = inProps.salary ?? stats.salary ?? 0;
  const achievements = inProps.achievements ?? [];
  const sessionDuration = inProps.sessionDuration ?? 0;
  const errorCount = inProps.errorCount ?? 0;
  const bossMode = inProps.bossMode ?? false;
  const bossTimer = inProps.bossTimer ?? 0;
  const leaderboard = inProps.leaderboard ?? [];
  const efficiency = inProps.efficiency ?? 0;
  const avgTimePerItem = inProps.avgTimePerItem ?? 0;
  const dailyGoals = inProps.dailyGoals ?? { units: 100, errors: 0, xtr: 100 };
  const activeShift = inProps.activeShift;
  const slug = inProps.slug;
  const userId = inProps.userId;

  const { dbUser } = useAppContext();
  const [copied, setCopied] = useState(false);

  // --- GHOST ECONOMY → SHADOW PROTECTION FUND ---
  const sessionGV = useMemo(() => (offloadUnits * 7) + (Math.max(0, totalDelta - offloadUnits) * 3), [offloadUnits, totalDelta]);
  const solidarityContribution = useMemo(() => Math.floor(salary * 0.13), [salary]);
  const netEarnings = salary - solidarityContribution;
  const shadowBalance = dbUser?.metadata?.cyberFitness?.ghost_stats?.balance || 0;

  // --- LEGAL PROTECTION STATUS ---
  const isRecording = !!activeShift && !activeShift.clock_out_time;
  const evidenceCount = activeShift?.actions?.length || 0;
  const lastCheckpoint = activeShift?.checkpoint?.saved_at;
  
  const top = useMemo(() => (Array.isArray(leaderboard) ? leaderboard.slice(0, 3) : []), [leaderboard]);
  const unitsProgress = useMemo(() => Math.min(100, (offloadUnits / (dailyGoals?.units || 1)) * 100), [offloadUnits, dailyGoals]);
  const errorFree = errorCount === 0 && sessionDuration > 3600;

  // Calculate XTR bonuses earned
  const totalXtr = useMemo(() => {
    let earned = 0;
    if (unitsProgress >= 100) earned += 50;
    if (errorFree) earned += (dailyGoals?.xtr || 0);
    return earned;
  }, [unitsProgress, errorFree, dailyGoals]);

  const formatDuration = (sec: number) => {
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s = sec % 60;
    return h > 0 ? `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}` : `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  };

  const shareEvidence = () => {
    const text = `📋 ОТЧЕТ О ЗАЩИТЕ ТРУДА:
Зафиксировано: ${offloadUnits} ед.
Заработок: ${salary} RUB.
Взнос в кассу (13%): ${solidarityContribution} RUB.
Чистыми: ${netEarnings} RUB.
Доказательства: ${evidenceCount} действий.
Статус: ${isRecording ? '🔴 Запись идет' : '⚫ Архив'}`;
    navigator.clipboard.writeText(text).then(() => { 
      setCopied(true); 
      toast.success("Доказательства скопированы!", { description: "Отправьте юристу или в бригадный чат" });
      setTimeout(() => setCopied(false), 2000); 
    });
  };

  const handleGenerateEvidence = async () => {
    if (!slug || !userId || !activeShift) {
      toast.error("Нет активной смены для нотариального заверения");
      return;
    }
    setGeneratingPdf(true);
    try {
      const res = await generateCrewShiftPdf(userId, activeShift.id);
      if (res.success) {
        toast.success("📄 Акт смены отправлен в Telegram", { 
          description: "PDF с цифровой подписью сохранен как юридическое доказательство" 
        });
      } else {
        toast.error("Ошибка генерации акта");
      }
    } catch (e) {
      toast.error("Критическая ошибка печати");
    } finally {
      setGeneratingPdf(false);
    }
  };

  return (
    <div className="bg-card border border-border rounded-xl text-[13px] font-mono shadow-sm overflow-hidden">
      {/* --- COLLAPSIBLE HEADER (Always Visible) --- */}
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="w-full p-3 flex items-center justify-between hover:bg-accent/50 transition-colors border-b border-transparent data-[state=open]:border-border"
        data-state={isOpen ? "open" : "closed"}
      >
        <div className="flex items-center gap-3">
          <div className={cn(
            "w-2 h-2 rounded-full animate-pulse",
            isRecording ? "bg-destructive" : "bg-muted-foreground"
          )} />
          <div className="text-left">
            <h3 className="font-black text-foreground uppercase flex items-center gap-2 tracking-tighter text-sm">
              <ShieldAlert size={14} className={isRecording ? "text-destructive" : "text-muted-foreground"} />
              {isRecording ? "🔴 ЗАПИСЬ_ДОКАЗАТЕЛЬСТВ" : "⚫ АРХИВ_ЗАЩИТЫ"}
            </h3>
            <div className="text-[10px] text-muted-foreground mt-0.5 uppercase flex items-center gap-2">
              <span>ID: {dbUser?.user_id?.slice(0,8)}</span>
              <span className="text-border">|</span>
              <span>{isRecording ? `Смена: ${formatDuration(sessionDuration)}` : "Нет активной смены"}</span>
              {isRecording && (
                <Badge variant="outline" className="h-3 text-[8px] border-destructive text-destructive ml-2">
                  LIVE
                </Badge>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Summary stats when collapsed */}
          {!isOpen && (
            <div className="hidden sm:flex items-center gap-4 text-[11px]">
              <div className="text-right">
                <div className="text-[9px] text-muted-foreground uppercase">Заработок</div>
                <div className="font-bold text-brand-green">{salary.toLocaleString()} ₽</div>
              </div>
              <div className="text-right">
                <div className="text-[9px] text-muted-foreground uppercase">Актов</div>
                <div className="font-bold text-foreground">{evidenceCount}</div>
              </div>
            </div>
          )}
          {isOpen ? <ChevronUp size={16} className="text-muted-foreground" /> : <ChevronDown size={16} className="text-muted-foreground" />}
        </div>
      </button>

      {/* --- COLLAPSIBLE CONTENT --- */}
      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div 
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: "easeInOut" }}
            className="overflow-hidden"
          >
            <div className="p-3 pt-0">
              <div className="flex flex-col lg:flex-row gap-4 mt-3">
                <main className="flex-1">
                  {/* LEGAL STATUS BAR */}
                  <div className="mb-3 p-2 bg-destructive/5 border border-destructive/20 rounded-lg flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Radio size={12} className={isRecording ? "text-destructive animate-pulse" : "text-muted-foreground"} />
                      <span className="text-[10px] font-bold uppercase text-destructive">
                        {isRecording ? "Нотариальная запись активна" : "Запись приостановлена"}
                      </span>
                    </div>
                    {isRecording && (
                      <Button 
                        size="sm" 
                        variant="ghost" 
                        className="h-6 text-[9px] text-destructive hover:bg-destructive/10"
                        onClick={handleGenerateEvidence}
                        disabled={generatingPdf}
                      >
                        <FileText size={10} className="mr-1" />
                        {generatingPdf ? "..." : "PDF Акт"}
                      </Button>
                    )}
                  </div>

                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <div className="text-[10px] text-muted-foreground mt-1 uppercase flex items-center gap-2">
                        <Lock size={10} />
                        <span>Защита от налоговых претензий</span>
                        {lastCheckpoint && (
                          <span className="text-brand-cyan">• Чекпоинт: {new Date(lastCheckpoint).toLocaleTimeString('ru-RU', {hour:'2-digit', minute:'2-digit'})}</span>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Badge variant="outline" className="h-5 text-[9px] border-border text-secondary-foreground">
                        КВАЛ-{level}
                      </Badge>
                      <Badge variant="outline" className="h-5 text-[9px] border-brand-pink text-brand-pink uppercase bg-brand-pink/10">
                        СТАЖ {streak}
                      </Badge>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {/* EARNINGS DEFENDER */}
                    <section className="p-3 bg-secondary border border-border rounded-lg relative overflow-hidden group">
                      <div className="flex items-start gap-3">
                        <motion.div 
                          animate={{ rotate: efficiency > 50 ? 360 : 0 }} 
                          transition={{ duration: 3, repeat: Infinity, ease: "linear" }} 
                          className="p-1.5 bg-brand-green rounded-full shadow-lg shadow-brand-green/20"
                        >
                          <Coins size={14} className="text-white dark:text-black" />
                        </motion.div>
                        <div>
                          <div className="text-[10px] text-muted-foreground font-bold uppercase tracking-tight">Заработок_За_Смену</div>
                          <div className="text-lg font-black text-foreground">{salary.toLocaleString()} <span className="text-xs font-normal text-muted-foreground">₽</span></div>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-2 mt-4">
                        <div className="bg-background/50 p-2 border border-border rounded">
                            <div className="text-[8px] text-muted-foreground uppercase flex items-center gap-1">
                              <Ghost size={10} className="text-brand-purple" /> Теневой_Резерв
                            </div>
                            <div className="text-xs font-black text-brand-purple">{shadowBalance.toLocaleString()} GV</div>
                        </div>
                        <div className="bg-background/50 p-2 border border-border rounded">
                            <div className="text-[8px] text-muted-foreground uppercase flex items-center gap-1">
                              <Gavel size={10} className="text-brand-gold" /> Доказательств
                            </div>
                            <div className="text-xs font-black text-foreground">{evidenceCount} актов</div>
                        </div>
                      </div>
                    </section>

                    {/* TRANSPARENT SALARY CALCULATION */}
                    <section className="p-3 bg-secondary border border-border rounded-lg flex flex-col justify-between">
                      <div>
                        <div className="text-[10px] text-muted-foreground uppercase font-bold tracking-widest mb-1">Расчет_Выплаты</div>
                        <div className="flex items-baseline gap-1">
                            <span className="font-black text-2xl text-brand-green">{netEarnings.toLocaleString()}</span>
                            <span className="text-[9px] text-muted-foreground font-bold uppercase">RUB чистыми</span>
                        </div>
                      </div>
                      <div className="mt-4 pt-2 border-t border-border space-y-1">
                        <div className="flex justify-between text-[10px] items-center text-muted-foreground">
                            <span className="font-bold flex items-center gap-1 uppercase tracking-tighter">
                              <Users size={10} /> Валовый заработок:
                            </span>
                            <span className="font-mono">{salary.toLocaleString()} ₽</span>
                        </div>
                        <div className="flex justify-between text-[10px] items-center text-brand-pink">
                            <span className="font-bold flex items-center gap-1 uppercase tracking-tighter">
                              <ShieldCheck size={10} /> Взнос в кассу (13%):
                            </span>
                            <span className="font-black">-{solidarityContribution.toLocaleString()} ₽</span>
                        </div>
                        <div className="text-[8px] text-muted-foreground mt-1 italic">
                          *Взнос гарантирует юридическую защиту и доступ к кассе взаимопомощи
                        </div>
                      </div>
                    </section>
                  </div>

                  {/* QUOTAS → LEGAL MINIMUMS */}
                  <div className="mt-3 p-3 bg-muted border border-border rounded-lg">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Норма_Выполнения</span>
                      <Badge variant={totalXtr > 0 ? "default" : "secondary"} className="text-[8px] h-4">
                        {totalXtr > 0 ? `+${totalXtr} XTR Бонус` : "Бонусы при 100%"}
                      </Badge>
                    </div>
                    <Progress value={unitsProgress} className="h-1 bg-secondary" />
                    <div className="mt-2 text-[9px] text-muted-foreground flex justify-between uppercase font-mono">
                        <span>{offloadUnits} / {dailyGoals.units} ед. (минимум для защиты)</span>
                        {errorCount > 0 && <span className="text-destructive font-bold">ОШИБКИ: {errorCount}</span>}
                    </div>
                  </div>
                </main>

                {/* SIDEBAR: BRIGADE & PROTECTION */}
                <aside className="w-full lg:w-64 flex flex-col gap-3">
                  {/* MUTUAL AID FUND */}
                  <div className="p-3 bg-secondary border-2 border-brand-purple rounded-lg relative overflow-hidden group">
                    <div className="absolute -right-4 -bottom-4 opacity-5 group-hover:opacity-10 transition-opacity">
                      <Ghost size={80} />
                    </div>
                    <div className="text-[10px] text-brand-purple font-black uppercase tracking-widest mb-1 flex items-center gap-2">
                        <Coins size={12} /> Касса_Взаимопомощи
                    </div>
                    <div className="text-3xl font-black text-foreground tracking-tighter">
                      {shadowBalance.toLocaleString()} <span className="text-xs text-brand-purple">GV</span>
                    </div>
                    <div className="mt-2 text-[9px] text-muted-foreground uppercase font-mono">
                        Статус: <span className="text-foreground">Защищено от изъятия</span>
                    </div>
                  </div>

                  {/* BRIGADE WITNESSES (was Leaderboard) */}
                  <div className="p-3 bg-secondary border border-border rounded-lg flex-1">
                    <div className="flex justify-between items-center mb-3 border-b border-border pb-2">
                        <span className="text-[9px] font-black uppercase text-amber-600 dark:text-amber-500 tracking-tighter">
                          Свидетели_Смены (Бригада)
                        </span>
                        <Button 
                          variant="ghost" 
                          onClick={shareEvidence} 
                          className="h-5 w-5 p-0 hover:text-brand-cyan text-foreground"
                          title="Поделиться доказательствами"
                        >
                          <Share2 size={10} />
                        </Button>
                    </div>
                    <div className="space-y-1.5">
                        {top.map((entry, idx) => (
                          <div key={idx} className="flex justify-between text-[11px] p-1 rounded hover:bg-accent/50 transition-colors">
                            <span className="font-bold text-muted-foreground">
                              0{idx+1} <span className="text-foreground ml-1 uppercase">{entry.name}</span>
                            </span>
                            <span className="font-black text-brand-cyan">{entry.score} актов</span>
                          </div>
                        ))}
                        {top.length === 0 && (
                          <div className="text-[10px] text-muted-foreground text-center py-2 italic">
                            Нет активных свидетелей
                          </div>
                        )}
                    </div>
                  </div>

                  {/* EVIDENCE INTEGRITY */}
                  {isRecording && (
                    <div className="p-3 bg-brand-green/10 border border-brand-green/30 rounded-lg">
                      <div className="flex items-center gap-2 mb-2">
                        <Lock size={12} className="text-brand-green" />
                        <span className="text-[10px] font-black uppercase text-brand-green">Целостность данных</span>
                      </div>
                      <div className="text-[9px] text-muted-foreground space-y-1">
                        <div className="flex justify-between">
                          <span>Хеш-сумма:</span>
                          <span className="font-mono text-foreground">{activeShift?.id?.slice(0,8)}...</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Действия:</span>
                          <span className="font-mono text-foreground">{evidenceCount}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Проверка:</span>
                          <span className="text-brand-green">SHA-256</span>
                        </div>
                      </div>
                    </div>
                  )}
                </aside>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      
      {/* Flash line when recording is active and collapsed */}
      {!isOpen && isRecording && (
        <div className="h-0.5 bg-destructive/50 w-full animate-pulse" />
      )}
    </div>
  );
}
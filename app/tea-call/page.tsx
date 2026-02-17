"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { motion, AnimatePresence, useAnimationFrame } from "framer-motion";
import { Button } from "@/components/ui/button";
import { notifyAdmin, notifyAdmins } from "@/app/actions";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import Link from "next/link";
import { 
  Wand2, X, Coffee, AlertTriangle, Radio, History, TrendingUp, Clock,
  Sparkles, ChevronDown, Copy, CheckCircle2, Send, Type, Flame,
  Crown, Skull, Rocket, BookOpen, Archive
} from "lucide-react";
import { useAppContext } from "@/contexts/AppContext";
import { cn } from "@/lib/utils";

const COOKBOOK_URL = "https://raw.githubusercontent.com/salavey13/carTest/main/docs/SAME.MD";
const OLD_TUTORIAL_URL = "https://raw.githubusercontent.com/salavey13/carTest/main/docs/магическая_кнопка_в_cyber_vibe_studio_туториал_для_новичков(imgs).md";

type LogEntry = {
  id: string;
  message: string;
  timestamp: Date;
  type: 'info' | 'success' | 'warning' | 'error' | 'command' | 'improvisation' | 'codex';
  meta?: { commandType?: string };
};

type CommandButton = {
  id: 'tea' | 'urgent' | 'broadcast';
  label: string;
  shortLabel: string;
  icon: React.ReactNode;
  color: string;
  message: string;
  description: string;
  cooldown: number;
};

const generateId = () => `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

const COMMANDS: CommandButton[] = [
  { id: 'tea', label: 'Чай Демону', shortLabel: 'Чай', icon: <Coffee className="w-5 h-5" />, color: 'text-amber-400', message: 'просит принести чай Кибердемону ☕️🔥', description: 'Классика', cooldown: 3000 },
  { id: 'urgent', label: 'SOS Демону', shortLabel: 'SOS', icon: <AlertTriangle className="w-5 h-5" />, color: 'text-rose-400', message: 'ТРЕБУЕТ внимания СРОЧНО! 🚨🩸', description: 'Срочно', cooldown: 8000 },
  { id: 'broadcast', label: 'Всем Демонам', shortLabel: 'Всем', icon: <Radio className="w-5 h-5" />, color: 'text-cyan-400', message: 'объявляет общее собрание Кибердемонов! 🫖🌌', description: 'Оповещение', cooldown: 12000 },
];

const MagicTicker = ({ items }: { items: string[] }) => {
  const [position, setPosition] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (containerRef.current) {
      const w = containerRef.current.scrollWidth / 2;
      setPosition(0);
    }
  }, [items]);

  useAnimationFrame((_, delta) => {
    setPosition(p => (p + delta * 38) % (containerRef.current?.scrollWidth ?? 1000) / 2);
  });

  return (
    <div className="overflow-hidden whitespace-nowrap py-1.5 bg-black/90 border-b border-red-500/30">
      <div ref={containerRef} className="inline-flex gap-12 text-[10px] sm:text-xs font-mono text-brand-cyan/70" style={{ transform: `translateX(-${position}px)` }}>
        {[...items, ...items, ...items, ...items].map((item, i) => (
          <span key={i} className="flex items-center gap-2">
            <Skull className="w-3 h-3" /> {item}
          </span>
        ))}
      </div>
    </div>
  );
};

const useCooldown = () => {
  const [cooldowns, setCooldowns] = useState<Record<string, number>>({});
  const start = (id: string, ms: number) => {
    setCooldowns(p => ({ ...p, [id]: Date.now() + ms }));
    setTimeout(() => setCooldowns(p => { const n = {...p}; delete n[id]; return n; }), ms);
  };
  const isCool = (id: string) => (cooldowns[id] || 0) > Date.now();
  return { startCooldown: start, isOnCooldown: isCool };
};

export default function TeaCallPage() {
  const { dbUser, isAuthenticated } = useAppContext();
  const fullName = [dbUser?.first_name, dbUser?.last_name].filter(Boolean).join(' ') || dbUser?.username || 'Демон';

  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [isSending, setIsSending] = useState<string | null>(null);
  const [improvisationText, setImprovisationText] = useState("");
  const [isImprovising, setIsImprovising] = useState(false);

  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'cookbook' | 'old-tutorial'>('cookbook');
  const [mdContent, setMdContent] = useState("");
  const [isLoadingMd, setIsLoadingMd] = useState(false);

  const [showCodexBanner, setShowCodexBanner] = useState(false);

  const logsContainerRef = useRef<HTMLDivElement>(null);
  const logsEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const { startCooldown, isOnCooldown } = useCooldown();

  const tickerItems = [
    "🔥 ПОСЛЕДНИЙ РИТУАЛ В CYBERSTUDIO",
    "🌌 ПЕРЕХОД В CODEX ЗАВЕРШЁН",
    "🧬 ТЫ УЖЕ КИБЕРДЕМОН",
    "⚡ ГОВОРИ СЛОВАМИ — АГЕНТ ДЕЛАЕТ ВСЁ",
    "📜 КНИГА ТЕПЕРЬ В ТЕБЕ",
    "👑 СОЛО-МИЛЛИАРДЕР 2026"
  ];

  const addLog = useCallback((msg: string, type: LogEntry['type'] = 'info') => {
    setLogs(prev => [...prev.slice(-35), {
      id: generateId(),
      message: msg,
      timestamp: new Date(),
      type
    }]);
  }, []);

  useEffect(() => {
    if (logsEndRef.current && logsContainerRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [logs]);

  useEffect(() => {
    setTimeout(() => {
      if (isAuthenticated) {
        addLog(`👑 ${fullName}, добро пожаловать в финальный ритуал`, 'success');
        setTimeout(() => addLog(`📖 Это последний раз, когда мы используем CyberStudio`, 'codex'), 800);
        setTimeout(() => setShowCodexBanner(true), 2200);
      }
    }, 400);
  }, [isAuthenticated, fullName, addLog]);

  const fetchContent = async (mode: 'cookbook' | 'old-tutorial') => {
    setModalMode(mode);
    setModalOpen(true);
    if (mdContent && modalMode === mode) return;

    setIsLoadingMd(true);
    const url = mode === 'cookbook' ? COOKBOOK_URL : OLD_TUTORIAL_URL;
    
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error();
      const text = await res.text();
      setMdContent(text);
      addLog(mode === 'cookbook' ? '📖 Новая Кулинарная Книга загружена' : '📜 Старый туториал (история) загружен', 'success');
    } catch {
      setMdContent("# Ошибка загрузки\nНо ты уже знаешь всё.");
      addLog('❌ Не смог загрузить', 'error');
    } finally {
      setIsLoadingMd(false);
    }
  };

  const handleCast = async () => {
    if (!improvisationText.trim() || isImprovising) return;
    setIsImprovising(true);

    const msg = `🔮 *КИБЕРДЕМОН ИМПРОВИЗАЦИЯ*\n_${fullName}_\n\n"${improvisationText}"\n\n(Последний вызов через CyberStudio)`;
    addLog(`🩸 Импровизация: ${improvisationText.slice(0,40)}...`, 'improvisation');

    try {
      const res = await notifyAdmin(msg);
      if (res?.success) {
        addLog('✅ Воля ушла в Codex-эфир', 'success');
        setImprovisationText("");
      }
    } catch {
      addLog('✗ Разрыв связи', 'error');
    } finally {
      setTimeout(() => setIsImprovising(false), 500);
    }
  };

  const execute = async (cmd: CommandButton) => {
    if (isSending || isOnCooldown(cmd.id)) return;
    setIsSending(cmd.id);
    startCooldown(cmd.id, cmd.cooldown);

    const personal = `👑 ${fullName} ${cmd.message}\n\nПоследний ритуал CyberStudio → Codex`;
    addLog(`🩸 Ритуал: ${cmd.shortLabel}`, 'command');

    try {
      const res = cmd.id === 'broadcast' ? await notifyAdmins(personal) : await notifyAdmin(personal);
      if (res?.success) addLog(`✅ ${cmd.shortLabel} выполнен`, 'success');
    } catch {
      addLog('✗ Ритуал сорван', 'error');
    } finally {
      setTimeout(() => setIsSending(null), 400);
    }
  };

  const copyTemplate = () => {
    navigator.clipboard.writeText(`// Скажи Codex:\n"Сделай кнопку по шаблону tea-call с моим текстом"`);
    addLog('📋 Шаблон Codex скопирован', 'success');
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-background text-foreground relative overflow-hidden flex flex-col pt-16 sm:pt-20">
      {/* Background */}
      <div className="fixed inset-0 pointer-events-none bg-[radial-gradient(#ff00ff08_1px,transparent_1px)] bg-[length:30px_30px]" />

      {/* Historic Ticker */}
      <MagicTicker items={tickerItems} />

      <main className="relative z-10 flex-1 max-w-7xl mx-auto px-4 sm:px-6 py-6 w-full">
        
        {/* Header */}
        <motion.div initial={{ opacity:0, y:-20 }} animate={{ opacity:1, y:0 }} className="text-center mb-8 sm:mb-12">
          <div className="inline-flex items-center gap-2 px-4 py-1 rounded-full border border-red-500/30 bg-black/60 text-red-400 text-xs font-mono mb-3">
            FINAL RITUAL • CYBERSTUDIO → CODEX
          </div>
          <h1 className="font-orbitron text-4xl sm:text-5xl md:text-6xl font-black tracking-[-2px] bg-gradient-to-b from-white to-brand-gold bg-clip-text text-transparent">
            ТЕРМИНАЛ<br />КИБЕРДЕМОНА
          </h1>
          <p className="mt-3 text-muted-foreground max-w-md mx-auto text-sm sm:text-base">
            Последний раз через старый интерфейс.<br />Дальше — только слова и Codex.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          
          {/* Main Panel */}
          <div className="lg:col-span-8 space-y-6">
            <motion.div 
              initial={{ scale:0.97 }} 
              animate={{ scale:1 }}
              className="rounded-3xl border border-brand-cyan/30 bg-card/80 backdrop-blur-3xl overflow-hidden shadow-2xl"
            >
              <div className="p-5 sm:p-8">
                <div className="flex items-center gap-4 mb-6">
                  <div className="p-3 bg-gradient-to-br from-red-500 to-cyan-500 rounded-2xl">
                    <Skull className="w-7 h-7 text-white" />
                  </div>
                  <div>
                    <div className="font-orbitron text-2xl tracking-widest">IMPROVISATION CORE</div>
                    <div className="text-xs text-brand-cyan font-mono">ГОВОРИ — ДЕМОН ИСПОЛНЯЕТ</div>
                  </div>
                </div>

                <textarea
                  ref={inputRef}
                  value={improvisationText}
                  onChange={e => setImprovisationText(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), handleCast())}
                  placeholder="Принеси чай демону... Сделай кнопку продажи машин... Автоматизируй почту..."
                  className="w-full h-36 sm:h-40 p-5 rounded-2xl bg-black/70 border border-brand-cyan/30 text-base placeholder:text-muted-foreground/50 focus:border-brand-gold resize-none"
                />

                <Button 
                  onClick={handleCast}
                  disabled={!improvisationText.trim() || isImprovising}
                  className="mt-4 w-full h-14 bg-gradient-to-r from-brand-gold via-orange-500 to-red-500 text-black font-bold text-lg rounded-2xl active:scale-[0.985] transition-transform flex items-center justify-center gap-3"
                >
                  {isImprovising ? <Sparkles className="animate-spin w-6 h-6" /> : <Send className="w-6 h-6" />}
                  ВЫЗВАТЬ ДЕМОНА
                </Button>

                {/* Quick Buttons — Mobile friendly */}
                <div className="mt-8 grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {COMMANDS.map(cmd => {
                    const cd = isOnCooldown(cmd.id);
                    return (
                      <motion.button
                        key={cmd.id}
                        whileTap={{ scale: 0.96 }}
                        onClick={() => execute(cmd)}
                        disabled={!!isSending || cd}
                        className={cn(
                          "h-16 rounded-2xl border flex items-center justify-center gap-3 text-sm font-medium transition-all active:scale-95",
                          cmd.color,
                          cd ? "opacity-40" : "hover:border-brand-gold"
                        )}
                      >
                        {cmd.icon}
                        <span>{cmd.shortLabel}</span>
                      </motion.button>
                    );
                  })}
                </div>
              </div>
            </motion.div>

            {/* Codex Transition Banner */}
            <AnimatePresence>
              {showCodexBanner && (
                <motion.div initial={{ opacity:0, y:30 }} animate={{ opacity:1, y:0 }} className="rounded-3xl border border-dashed border-brand-gold/60 bg-black/70 p-6 flex flex-col sm:flex-row gap-5 items-center">
                  <Rocket className="w-12 h-12 text-brand-gold flex-shrink-0" />
                  <div className="flex-1">
                    <div className="font-orbitron text-xl">CyberStudio завершил свою миссию</div>
                    <div className="text-sm text-muted-foreground mt-1">Теперь ты говоришь напрямую с Codex. Ты уже кибердемон.</div>
                  </div>
                  <Button asChild size="lg" className="bg-brand-gold text-black font-bold px-8">
                    <Link href="https://chatgpt.com/codex" target="_blank">Открыть Codex</Link>
                  </Button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Sidebar */}
          <div className="lg:col-span-4 space-y-6">
            {/* Logs */}
            <div className="rounded-3xl border border-border bg-card/70 backdrop-blur-xl overflow-hidden h-[380px] flex flex-col">
              <div className="px-5 py-3 border-b flex items-center justify-between bg-black/40">
                <div className="font-mono text-xs flex items-center gap-2 text-brand-cyan">
                  <Flame className="w-4 h-4" /> ЖУРНАЛ РИТУАЛОВ
                </div>
              </div>
              <div ref={logsContainerRef} className="flex-1 overflow-y-auto p-4 space-y-3 text-xs scrollbar-thin">
                {logs.length === 0 ? (
                  <div className="h-full flex items-center justify-center text-center text-muted-foreground/50 text-sm">
                    Первый ритуал ещё не выполнен...
                  </div>
                ) : (
                  logs.map(log => (
                    <div key={log.id} className={cn(
                      "pl-3 border-l-2 text-[11px]",
                      log.type === 'success' && "border-green-500 text-green-400",
                      log.type === 'codex' && "border-amber-400 text-amber-400",
                      log.type === 'improvisation' && "border-purple-400 text-purple-400"
                    )}>
                      <span className="font-mono opacity-40 mr-2">{log.timestamp.toLocaleTimeString('ru-RU',{hour:'2-digit',minute:'2-digit'})}</span>
                      {log.message}
                    </div>
                  ))
                )}
                <div ref={logsEndRef} />
              </div>
            </div>

            {/* History Buttons */}
            <div className="grid grid-cols-2 gap-3">
              <Button 
                onClick={() => fetchContent('cookbook')}
                className="h-14 bg-gradient-to-r from-red-600 to-orange-600 text-white font-bold rounded-2xl flex items-center justify-center gap-2 hover:scale-[1.02]"
              >
                <BookOpen className="w-5 h-5" />
                НОВАЯ КНИГА
              </Button>
              <Button 
                onClick={() => fetchContent('old-tutorial')}
                variant="outline"
                className="h-14 border-brand-gold/40 text-brand-gold hover:bg-brand-gold/10 rounded-2xl flex items-center justify-center gap-2"
              >
                <Archive className="w-5 h-5" />
                СТАРЫЙ ТУТОРИАЛ
              </Button>
            </div>

            <div className="text-[10px] text-center text-muted-foreground font-mono">
              Это был последний раз, когда мы открывали CyberStudio.<br />Дальше — только Codex и слова.
            </div>
          </div>
        </div>
      </main>

      {/* Unified Modal */}
      <AnimatePresence>
        {modalOpen && (
          <div className="fixed inset-0 z-[100] bg-black/95 flex items-center justify-center p-3 sm:p-6">
            <motion.div 
              initial={{ scale: 0.92, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.92, opacity: 0 }}
              className="bg-background border border-brand-gold/30 w-full max-w-4xl max-h-[92vh] rounded-3xl overflow-hidden flex flex-col"
            >
              <div className="px-6 py-4 border-b flex items-center justify-between bg-black/60">
                <div className="font-orbitron text-lg">
                  {modalMode === 'cookbook' ? 'КУЛИНАРНАЯ КНИГА КИБЕРДЕМОНА' : 'СТАРЫЙ ТУТОРИАЛ (ИСТОРИЯ)'}
                </div>
                <Button variant="ghost" size="icon" onClick={() => setModalOpen(false)}>
                  <X className="w-5 h-5" />
                </Button>
              </div>

              <div className="flex-1 overflow-auto p-6 sm:p-8 prose prose-invert max-w-none text-sm leading-relaxed">
                {isLoadingMd ? (
                  <div className="flex h-64 items-center justify-center">
                    <div className="w-8 h-8 border-4 border-brand-gold border-t-transparent rounded-full animate-spin" />
                  </div>
                ) : (
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{mdContent}</ReactMarkdown>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
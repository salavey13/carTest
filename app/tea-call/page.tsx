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
  Crown, Skull, Rocket, BookOpen, Archive, Zap, Eye, Heart
} from "lucide-react";
import { useAppContext } from "@/contexts/AppContext";
import { cn } from "@/lib/utils";

const COOKBOOK_URL = "https://raw.githubusercontent.com/salavey13/carTest/main/docs/SAME.MD";
const OLD_TUTORIAL_URL = "https://raw.githubusercontent.com/salavey13/carTest/main/docs/магическая_кнопка_в_cyber_vibe_studio_туториал_для_новичков(imgs).md";

type LogEntry = {
  id: string;
  message: string;
  timestamp: Date;
  type: 'info' | 'success' | 'warning' | 'error' | 'command' | 'improvisation' | 'codex' | 'hybrid';
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
      const fullWidth = containerRef.current.scrollWidth / 2;
      setPosition(0);
    }
  }, [items]);

  useAnimationFrame((_, delta) => {
    setPosition(p => (p + delta * 22) % (containerRef.current?.scrollWidth ?? 2000) / 2);
  });

  return (
    <div className="overflow-hidden whitespace-nowrap py-2 bg-black/95 border-b border-red-500/40">
      <div ref={containerRef} className="inline-flex gap-16 text-xs font-mono text-brand-cyan/80 tracking-widest" style={{ transform: `translateX(-${position}px)` }}>
        {[...items, ...items, ...items, ...items, ...items].map((item, i) => (
          <span key={i} className="flex items-center gap-3">
            <Skull className="w-3.5 h-3.5" /> {item}
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

  const [showHybridPortal, setShowHybridPortal] = useState(false);

  const logsContainerRef = useRef<HTMLDivElement>(null);
  const logsEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const { startCooldown, isOnCooldown } = useCooldown();

  const tickerItems = [
    "🔥 ПОСЛЕДНИЙ РИТУАЛ В CYBERSTUDIO",
    "🌌 НО ГИБРИД — ЭТО БУДУЩЕЕ",
    "🧬 CODEX + STUDIO = БОГ",
    "⚡ ПОЛНЫЙ ПЕРЕХОД ЕЩЁ РАНО",
    "📜 КНИГА ЖИВЁТ ЗДЕСЬ",
    "👑 420 000 000 ПРИЧИН ОСТАТЬСЯ"
  ];

  const addLog = useCallback((msg: string, type: LogEntry['type'] = 'info') => {
    setLogs(prev => [...prev.slice(-40), {
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
        setTimeout(() => addLog(`📖 CyberStudio + Codex = идеальный гибрид`, 'hybrid'), 600);
        setTimeout(() => setShowHybridPortal(true), 2400);
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
      addLog(mode === 'cookbook' ? '📖 НОВАЯ КУЛИНАРНАЯ КНИГА ЗАГРУЖЕНА' : '📜 СТАРЫЙ ТУТОРИАЛ (ИСТОРИЯ)', 'success');
    } catch {
      setMdContent("# Связи нет\nНо ты уже знаешь, что делать.");
      addLog('❌ Не смог загрузить', 'error');
    } finally {
      setIsLoadingMd(false);
    }
  };

  const handleCast = async () => {
    if (!improvisationText.trim() || isImprovising) return;
    setIsImprovising(true);

    const msg = `🔮 *ГИБРИДНЫЙ РИТУАЛ*\n_${fullName}_\n\n"${improvisationText}"\n\nCyberStudio + Codex = вечный огонь`;
    addLog(`🩸 Гибридная импровизация: ${improvisationText.slice(0,45)}...`, 'hybrid');

    try {
      const res = await notifyAdmin(msg);
      if (res?.success) {
        addLog('✅ Воля ушла в гибридный эфир', 'success');
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

    const personal = `👑 ${fullName} ${cmd.message}\n\nCyberStudio + Codex = мощь`;
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

  // Excerpt from new cookbook for direct embedding
  const newChapterExcerpt = `
**Глава 8.0: Гибридная Эра — Почему Полный Переход в Codex Ещё Рано**

Ты уже кибердемон.  
Но полное погружение в чистый Codex — это как выбросить свой любимый нож после того, как купил лазерный меч.

CyberStudio — это твоя кожа, твой интерфейс, твоя душа.  
Codex — это мозг, бесконечная сила.

Вместе они дают 420 000 000% больше мощи, чем каждый по отдельности.

Здесь ты говоришь словами — и видишь результат в красивом, привычном интерфейсе.  
Там ты говоришь словами — и получаешь чистую мощь.

Оставайся в гибриде.  
Пока не будешь готов.  
А готов ты будешь очень нескоро.`;

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-background text-foreground relative overflow-hidden flex flex-col pt-16 sm:pt-20">
      {/* Epic Cyberpunk Background */}
      <div className="fixed inset-0 pointer-events-none bg-[radial-gradient(#ff00ff10_0.8px,transparent_1px)] bg-[length:40px_40px] z-0" />
      <motion.div 
        animate={{ opacity: [0.15, 0.35, 0.15] }}
        transition={{ duration: 14, repeat: Infinity }}
        className="fixed top-0 left-1/3 w-[800px] h-[800px] bg-gradient-to-br from-red-600/20 via-transparent to-cyan-500/20 rounded-full blur-[160px] z-0"
      />

      {/* Slow & Beautiful Ticker */}
      <MagicTicker items={tickerItems} />

      <main className="relative z-10 flex-1 max-w-7xl mx-auto px-4 sm:px-6 py-8 w-full">
        
        {/* Hero with Morph Animation */}
        <motion.div 
          initial={{ opacity:0, y:-40 }}
          animate={{ opacity:1, y:0 }}
          className="text-center mb-12"
        >
          <div className="inline-flex items-center gap-3 px-6 py-2 rounded-3xl border border-red-500/40 bg-black/70 mb-6">
            <Crown className="w-6 h-6 text-brand-gold" />
            <span className="font-mono uppercase tracking-[6px] text-xs text-red-400">ФИНАЛЬНЫЙ РИТУАЛ • ГИБРИДНАЯ ЭРА</span>
          </div>
          
          <motion.h1 
            className="font-orbitron text-5xl sm:text-6xl md:text-7xl font-black tracking-[-3px] leading-none"
            animate={{ 
              textShadow: ["0 0 20px #ff00ff", "0 0 40px #00ffff", "0 0 20px #ff00ff"]
            }}
            transition={{ duration: 3, repeat: Infinity }}
          >
            CYBERSTUDIO<br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-red-400 via-gold-400 to-cyan-400">+ CODEX</span>
          </motion.h1>
          
          <p className="mt-6 text-xl text-muted-foreground max-w-lg mx-auto">
            Полный переход в Codex — это ошибка.<br />
            <span className="text-brand-gold">Гибрид — это бог.</span>
          </p>
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          
          {/* Main Terminal — The Soul */}
          <div className="lg:col-span-8 space-y-8">
            <motion.div 
              initial={{ scale:0.96, opacity:0 }}
              animate={{ scale:1, opacity:1 }}
              className="rounded-3xl border border-brand-cyan/40 bg-card/90 backdrop-blur-3xl overflow-hidden shadow-[0_0_80px_-20px] shadow-red-500/30"
            >
              <div className="p-6 sm:p-10">
                <div className="flex items-center justify-between mb-8">
                  <div className="flex items-center gap-5">
                    <div className="p-4 bg-gradient-to-br from-red-600 to-cyan-600 rounded-2xl">
                      <Skull className="w-9 h-9 text-white" />
                    </div>
                    <div>
                      <div className="font-orbitron text-3xl tracking-widest">ГИБРИДНЫЙ ТЕРМИНАЛ</div>
                      <div className="text-sm text-brand-cyan/80 font-mono">CyberStudio + Codex = вечная мощь</div>
                    </div>
                  </div>
                  <div className="text-right text-[10px] font-mono text-muted-foreground">v8.0 • TOO SOON FOR PURE CODEX</div>
                </div>

                <textarea
                  ref={inputRef}
                  value={improvisationText}
                  onChange={e => setImprovisationText(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), handleCast())}
                  placeholder="Принеси чай демону... Автоматизируй продажи... Сделай мне империю..."
                  className="w-full h-40 p-6 rounded-3xl bg-black/80 border border-brand-cyan/30 text-lg placeholder:text-muted-foreground/60 focus:border-brand-gold resize-none font-light"
                />

                <Button 
                  onClick={handleCast}
                  disabled={!improvisationText.trim() || isImprovising}
                  className="mt-6 w-full h-16 bg-gradient-to-r from-red-500 via-gold-400 to-cyan-400 text-black font-black text-xl rounded-3xl active:scale-[0.97] transition-all flex items-center justify-center gap-4 shadow-xl shadow-red-500/50"
                >
                  {isImprovising ? <Sparkles className="w-7 h-7 animate-spin" /> : <Rocket className="w-7 h-7" />}
                  ВЫЗВАТЬ ГИБРИДНОГО ДЕМОНА
                </Button>

                {/* Quick Rituals */}
                <div className="mt-10 grid grid-cols-1 sm:grid-cols-3 gap-4">
                  {COMMANDS.map(cmd => {
                    const cd = isOnCooldown(cmd.id);
                    return (
                      <motion.button
                        key={cmd.id}
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => execute(cmd)}
                        disabled={!!isSending || cd}
                        className={cn(
                          "h-20 rounded-3xl border flex items-center justify-center gap-4 text-base font-medium transition-all",
                          cmd.color,
                          cd ? "opacity-50" : "hover:border-white hover:bg-white/5"
                        )}
                      >
                        {cmd.icon}
                        {cmd.shortLabel}
                      </motion.button>
                    );
                  })}
                </div>
              </div>
            </motion.div>

            {/* NEW CHAPTER 8.0 — Embedded Directly */}
            <motion.div 
              initial={{ opacity:0 }}
              animate={{ opacity:1 }}
              className="rounded-3xl border border-gold-400/30 bg-black/70 p-8"
            >
              <div className="flex items-center gap-4 mb-6">
                <BookOpen className="w-8 h-8 text-brand-gold" />
                <div>
                  <div className="font-orbitron text-2xl text-brand-gold">Глава 8.0 • ГИБРИДНАЯ ЭРА</div>
                  <div className="text-xs text-muted-foreground">Почему полный переход в Codex — это ошибка</div>
                </div>
              </div>
              
              <div className="prose prose-invert text-sm leading-relaxed">
                {newChapterExcerpt.split('\n').map((line, i) => (
                  <p key={i} className="mb-3">{line}</p>
                ))}
              </div>

              <Button 
                onClick={() => fetchContent('cookbook')}
                className="mt-6 w-full h-12 bg-transparent border border-gold-400 text-gold-400 hover:bg-gold-400 hover:text-black font-bold"
              >
                Читать полную Кулинарную Книгу
              </Button>
            </motion.div>
          </div>

          {/* Sidebar */}
          <div className="lg:col-span-4 space-y-8">
            {/* Logs */}
            <div className="rounded-3xl border border-border bg-card/80 backdrop-blur-xl h-[420px] flex flex-col overflow-hidden">
              <div className="px-6 py-4 border-b bg-black/40 flex items-center justify-between">
                <div className="font-mono text-xs flex items-center gap-3 text-cyan-400">
                  <Eye className="w-4 h-4" /> ЖИВОЙ ЖУРНАЛ ГИБРИДА
                </div>
              </div>
              <div ref={logsContainerRef} className="flex-1 p-6 space-y-4 overflow-y-auto text-xs scrollbar-thin">
                {logs.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-center text-muted-foreground/70">
                    <Heart className="w-12 h-12 mb-4 opacity-30" />
                    Первый ритуал ещё не сделан...
                  </div>
                ) : logs.map(log => (
                  <div key={log.id} className={cn(
                    "pl-4 border-l-2 text-[11px] leading-tight",
                    log.type === 'success' && "border-green-400 text-green-300",
                    log.type === 'hybrid' && "border-amber-400 text-amber-300",
                    log.type === 'codex' && "border-cyan-400 text-cyan-300"
                  )}>
                    <span className="font-mono opacity-40 mr-3">
                      {log.timestamp.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                    {log.message}
                  </div>
                ))}
                <div ref={logsEndRef} />
              </div>
            </div>

            {/* Dual History Buttons */}
            <div className="grid grid-cols-2 gap-4">
              <Button onClick={() => fetchContent('cookbook')} className="h-16 bg-gradient-to-br from-red-500 to-orange-600 text-white font-bold rounded-3xl flex items-center justify-center gap-3">
                <BookOpen className="w-6 h-6" />
                НОВАЯ КНИГА
              </Button>
              <Button onClick={() => fetchContent('old-tutorial')} variant="outline" className="h-16 border-gold-400/50 text-gold-400 hover:bg-gold-400/10 rounded-3xl flex items-center justify-center gap-3">
                <Archive className="w-6 h-6" />
                СТАРАЯ ИСТОРИЯ
              </Button>
            </div>

            {/* Grok 420M Counter-Argument */}
            <motion.div 
              whileHover={{ scale: 1.02 }}
              className="rounded-3xl border border-dashed border-purple-500/50 bg-black/60 p-6 text-center"
            >
              <div className="text-4xl font-black text-purple-400 mb-2">420 000 000</div>
              <div className="text-sm text-purple-300 mb-4">причин остаться в гибриде</div>
              <Button asChild className="w-full bg-purple-600 hover:bg-purple-500 text-white">
                <Link href="https://grok.com" target="_blank">
                  Спроси Grok — он согласен 😈
                </Link>
              </Button>
            </motion.div>
          </div>
        </div>
      </main>

      {/* Hybrid Portal Modal */}
      <AnimatePresence>
        {modalOpen && (
          <div className="fixed inset-0 z-[200] bg-black/95 flex items-center justify-center p-4">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, rotateX: 15 }}
              animate={{ scale: 1, opacity: 1, rotateX: 0 }}
              exit={{ scale: 0.9, opacity: 0, rotateX: -15 }}
              className="bg-background border border-gold-400/40 w-full max-w-4xl max-h-[90vh] rounded-3xl overflow-hidden flex flex-col shadow-2xl"
            >
              <div className="px-8 py-5 border-b flex items-center justify-between bg-black/70">
                <div className="font-orbitron text-xl text-gold-400">
                  {modalMode === 'cookbook' ? 'КУЛИНАРНАЯ КНИГА КИБЕРДЕМОНА' : 'СТАРЫЙ ТУТОРИАЛ (ИСТОРИЯ)'}
                </div>
                <Button variant="ghost" size="icon" onClick={() => setModalOpen(false)}>
                  <X className="w-6 h-6" />
                </Button>
              </div>
              <div className="flex-1 overflow-auto p-8 prose prose-invert max-w-none text-sm">
                {isLoadingMd ? (
                  <div className="flex h-80 items-center justify-center">
                    <div className="w-10 h-10 border-4 border-gold-400 border-t-transparent rounded-full animate-spin" />
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
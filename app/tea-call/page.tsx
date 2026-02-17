"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { motion, AnimatePresence, useAnimationFrame } from "framer-motion";
import { Button } from "@/components/ui/button";
import { notifyAdmin, notifyAdmins } from "@/app/actions";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import Link from "next/link";
import { 
  Wand2, 
  X, 
  Coffee, 
  Bot, 
  Zap, 
  AlertTriangle, 
  MessageSquare, 
  Terminal,
  Clock,
  Sparkles,
  ChevronRight,
  ArrowUpRight,
  Radio,
  History,
  TrendingUp,
  MousePointer2,
  Plus,
  Code2,
  GitBranch,
  Cpu,
  TerminalSquare,
  Wand,
  FileCode,
  Palette,
  Layers,
  Sparkle,
  ChevronDown,
  ChevronUp,
  Copy,
  CheckCircle2,
  ExternalLink,
  Send,
  Type,
  Flame,
  Rocket,
  Skull,
  Crown
} from "lucide-react";
import { useAppContext } from "@/contexts/AppContext";
import { cn } from "@/lib/utils";

const COOKBOOK_URL = "https://raw.githubusercontent.com/salavey13/carTest/main/docs/SAME.MD";

type LogEntry = {
  id: string;
  message: string;
  timestamp: Date;
  type: 'info' | 'success' | 'warning' | 'error' | 'command' | 'improvisation' | 'codex';
  meta?: {
    originator?: string;
    commandType?: string;
  };
};

type CommandButton = {
  id: 'tea' | 'urgent' | 'broadcast';
  label: string;
  shortLabel: string;
  icon: React.ReactNode;
  color: string;
  bgGradient: string;
  message: string;
  description: string;
  variant: 'primary' | 'danger' | 'secondary';
  priority: number;
  cooldown: number;
  magicLevel: number;
};

const generateId = () => `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

const COMMANDS: CommandButton[] = [
  {
    id: 'tea',
    label: 'Чай Демону',
    shortLabel: 'Чай',
    icon: <Coffee className="w-4 h-4" />,
    color: 'text-amber-400',
    bgGradient: 'from-amber-500/20 via-orange-500/20 to-amber-600/20',
    message: 'просит принести чай Кибердемону ☕️🔥',
    description: 'Классика',
    variant: 'primary',
    priority: 1,
    cooldown: 3000,
    magicLevel: 2
  },
  {
    id: 'urgent',
    label: 'SOS Демону',
    shortLabel: 'SOS',
    icon: <AlertTriangle className="w-4 h-4" />,
    color: 'text-rose-400',
    bgGradient: 'from-rose-500/20 via-red-500/20 to-rose-600/20',
    message: 'ТРЕБУЕТ внимания СРОЧНО! 🚨🩸',
    description: 'Срочно',
    variant: 'danger',
    priority: 3,
    cooldown: 8000,
    magicLevel: 4
  },
  {
    id: 'broadcast',
    label: 'Всем Демонам',
    shortLabel: 'Всем',
    icon: <Radio className="w-4 h-4" />,
    color: 'text-cyan-400',
    bgGradient: 'from-cyan-500/20 via-blue-500/20 to-cyan-600/20',
    message: 'объявляет общее собрание Кибердемонов! 🫖🌌',
    description: 'Оповещение',
    variant: 'secondary',
    priority: 2,
    cooldown: 12000,
    magicLevel: 5
  }
];

const MagicTicker = ({ items, speed = 40 }: { items: string[], speed?: number }) => {
  const [position, setPosition] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const [contentWidth, setContentWidth] = useState(0);
  
  useEffect(() => {
    if (containerRef.current) setContentWidth(containerRef.current.scrollWidth / 2);
  }, [items]);

  useAnimationFrame((time, delta) => {
    setPosition((prev) => (prev + (delta * speed) / 1000) % contentWidth);
  });

  const duplicatedItems = [...items, ...items, ...items];

  return (
    <div className="overflow-hidden whitespace-nowrap relative py-1 bg-black/40 border-b border-brand-cyan/20">
      <div 
        ref={containerRef}
        className="inline-flex gap-12 text-xs sm:text-sm font-mono text-brand-cyan/70"
        style={{ transform: `translateX(-${position}px)` }}
      >
        {duplicatedItems.map((item, i) => (
          <span key={i} className="inline-flex items-center gap-2">
            <Skull className="w-3 h-3" /> {item}
          </span>
        ))}
      </div>
    </div>
  );
};

const useCooldown = () => {
  const [cooldowns, setCooldowns] = useState<Record<string, number>>({});
  
  const startCooldown = useCallback((id: string, duration: number) => {
    setCooldowns(prev => ({ ...prev, [id]: Date.now() + duration }));
    setTimeout(() => setCooldowns(prev => { const next = { ...prev }; delete next[id]; return next; }), duration);
  }, []);

  const isOnCooldown = useCallback((id: string) => (cooldowns[id] || 0) > Date.now(), [cooldowns]);

  return { startCooldown, isOnCooldown };
};

export default function TeaCallPage() {
  const { dbUser, isAuthenticated } = useAppContext();
  
  const {
    username = 'Гость',
    user_id: userId,
    first_name: firstName,
    last_name: lastName,
    photo_url: photoUrl,
  } = dbUser || {};

  const fullName = [firstName, lastName].filter(Boolean).join(' ') || username || 'Неизвестный';

  const [isSending, setIsSending] = useState<string | null>(null);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [mdContent, setMdContent] = useState<string>("");
  const [isLoadingMd, setIsLoadingMd] = useState(false);
  const [showExtender, setShowExtender] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showCodexTransition, setShowCodexTransition] = useState(false);
  
  const [improvisationText, setImprovisationText] = useState("");
  const [isImprovising, setIsImprovising] = useState(false);
  
  const logsEndRef = useRef<HTMLDivElement>(null);
  const logsContainerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const { startCooldown, isOnCooldown } = useCooldown();

  const tickerItems = [
    "🔥 Последний ритуал в CyberStudio",
    "🌌 Переход в чистый Codex начат",
    "🧬 Ты — следующий соло-миллиардер",
    "⚡ Говори — агент делает end-to-end",
    "📜 Кулинарная Книга уже в тебе",
    "👑 Кибердемон пробуждается"
  ];

  useEffect(() => {
    const container = logsContainerRef.current;
    if (logsEndRef.current && container) {
      const isNearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 120;
      if (isNearBottom) logsEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [logs]);

  useEffect(() => {
    setTimeout(() => {
      if (isAuthenticated && dbUser) {
        addLog(`🔐 Сессия Кибердемона активна`, 'success');
        setTimeout(() => addLog(`👑 ${fullName}, это твой последний ритуал в CyberStudio`, 'codex'), 400);
      } else {
        addLog('⚠️ Гостевой режим. Становись демоном', 'warning');
      }
      setTimeout(() => setShowCodexTransition(true), 1800);
    }, 300);
  }, [isAuthenticated, dbUser, fullName]);

  const addLog = useCallback((message: string, type: LogEntry['type'] = 'info', options?: { meta?: LogEntry['meta'] }) => {
    setLogs(prev => [...prev.slice(-29), {
      id: generateId(),
      message,
      timestamp: new Date(),
      type,
      meta: options?.meta
    }]);
  }, []);

  const fetchCookbook = async () => {
    if (mdContent) { setIsModalOpen(true); return; }
    setIsLoadingMd(true);
    setIsModalOpen(true);
    try {
      const res = await fetch(COOKBOOK_URL);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const text = await res.text();
      setMdContent(text);
      addLog('📖 Кулинарная Книга загружена. Добро пожаловать в Codex-эру', 'codex');
    } catch (e) {
      setMdContent("# ⚠️ Связи нет\nНо ты уже знаешь, что делать.");
      addLog('❌ Не смог открыть Книгу. Но ты и так кибердемон', 'error');
    } finally {
      setIsLoadingMd(false);
    }
  };

  const handleCastImprovisation = async () => {
    if (!improvisationText.trim() || isImprovising) return;
    setIsImprovising(true);
    const message = `🔮 *КИБЕРДЕМОН ИМПРОВИЗАЦИЯ*\n_${fullName}_ (@${username}):\n\n"${improvisationText}"\n\n(Последний вызов через CyberStudio → Codex)`;
    
    addLog(`🩸 Импровизация: "${improvisationText.substring(0, 35)}..."`, 'improvisation');

    try {
      const result = await notifyAdmin(message);
      if (result?.success) {
        addLog(`✅ Воля ушла в эфир. Codex уже ждёт`, 'success');
        setImprovisationText("");
      } else {
        addLog(`✗ Помехи в матрице`, 'error');
      }
    } catch (err) {
      addLog(`✗ Разрыв связи с демоном`, 'error');
    } finally {
      setTimeout(() => setIsImprovising(false), 600);
    }
  };

  const executeCommand = async (command: CommandButton) => {
    if (isSending || isOnCooldown(command.id)) return;
    setIsSending(command.id);
    startCooldown(command.id, command.cooldown);
    
    const personalizedMessage = `👑 *${fullName}* (@${username}) ${command.message}\n\nПоследний ритуал CyberStudio перед полной миграцией в Codex`;
    
    addLog(`🩸 Ритуал: ${command.label}`, 'command', { meta: { commandType: command.id } });

    try {
      const result = command.id === 'broadcast' 
        ? await notifyAdmins(personalizedMessage)
        : await notifyAdmin(personalizedMessage);

      if (result?.success) {
        addLog(`✅ Ритуал завершён: ${command.label}`, 'success');
      } else {
        addLog(`✗ Ритуал провалился`, 'error');
      }
    } catch (err) {
      addLog(`✗ Разрыв с потусторонним`, 'error');
    } finally {
      setTimeout(() => setIsSending(null), 400);
    }
  };

  const copyCodexTemplate = useCallback(() => {
    const template = `// Скажи агенту в Codex:
// "Сделай кнопку по шаблону tea-call с моим кастомным сообщением"`;
    navigator.clipboard.writeText(template);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
    addLog('📋 Шаблон Codex скопирован. Теперь говори с ним словами', 'codex');
  }, [addLog]);

  const stats = useMemo(() => ({
    total: logs.filter(l => l.type === 'success' || l.type === 'codex').length,
    commands: logs.filter(l => l.type === 'command' || l.type === 'improvisation').length,
    uptime: Math.floor(logs.length * 2.3)
  }), [logs]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleCastImprovisation();
    }
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-background text-foreground relative overflow-hidden flex flex-col pt-16">
      {/* Epic Background */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(#ff00ff10_0.8px,transparent_1px)] bg-[length:40px_40px]" />
        <motion.div 
          animate={{ opacity: [0.2, 0.4, 0.2] }}
          transition={{ duration: 18, repeat: Infinity }}
          className="absolute -top-40 -left-40 w-[800px] h-[800px] bg-gradient-to-br from-brand-red-orange/30 via-transparent to-brand-cyan/20 rounded-full blur-[180px]"
        />
      </div>

      {/* Historic Ticker */}
      <div className="relative z-30 bg-black/90 border-b border-red-500/30 py-2">
        <MagicTicker items={tickerItems} speed={35} />
      </div>

      <main className="relative z-20 flex-1 max-w-7xl mx-auto px-4 py-8 w-full">
        
        {/* Header — Historic Moment */}
        <motion.div 
          initial={{ opacity: 0, y: -30 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-10"
        >
          <div className="inline-flex items-center gap-3 px-5 py-2 rounded-2xl border border-brand-red-orange/40 bg-black/60 mb-4">
            <Crown className="w-5 h-5 text-brand-gold" />
            <span className="font-mono uppercase tracking-[4px] text-xs text-brand-red-orange">ФИНАЛЬНЫЙ РИТУАЛ</span>
          </div>
          
          <h1 className="font-orbitron text-5xl sm:text-6xl font-black tracking-tighter bg-gradient-to-b from-white via-brand-gold to-brand-red-orange bg-clip-text text-transparent">
            ТЕРМИНАЛ ВЫЗОВА<br />КИБЕРДЕМОНА
          </h1>
          
          <p className="mt-3 text-xl text-muted-foreground max-w-lg mx-auto">
            Последний вызов через CyberStudio.<br />
            <span className="text-brand-cyan">Дальше — только Codex и ты.</span>
          </p>
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          
          {/* Main Terminal */}
          <div className="lg:col-span-8 space-y-6">
            
            <motion.div 
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              className="relative overflow-hidden rounded-3xl border border-brand-cyan/40 bg-card/80 backdrop-blur-3xl shadow-2xl shadow-black/80"
            >
              <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-brand-cyan to-transparent" />
              
              <div className="p-8">
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-4">
                    <div className="p-3 rounded-2xl bg-gradient-to-br from-brand-red-orange to-brand-cyan text-white">
                      <Bot className="w-7 h-7" />
                    </div>
                    <div>
                      <div className="font-orbitron text-2xl tracking-widest">IMPROVISATION CORE</div>
                      <div className="text-xs text-brand-cyan/70 font-mono">ГОВОРИ — ДЕМОН ДЕЛАЕТ</div>
                    </div>
                  </div>
                  <div className="text-[10px] font-mono text-right text-muted-foreground">
                    Codex Era<br />Activated
                  </div>
                </div>

                <div className="relative">
                  <textarea
                    ref={inputRef}
                    value={improvisationText}
                    onChange={(e) => setImprovisationText(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Принеси чай демону. Сделай кнопку для продажи машин. Автоматизируй разбор почты..."
                    disabled={isImprovising}
                    className="w-full h-32 p-6 rounded-2xl bg-black/70 border border-brand-cyan/30 text-lg font-light placeholder:text-brand-cyan/30 focus:border-brand-gold resize-none transition-all"
                  />
                  
                  <Button
                    onClick={handleCastImprovisation}
                    disabled={!improvisationText.trim() || isImprovising}
                    className="absolute bottom-4 right-4 bg-gradient-to-r from-brand-gold to-brand-red-orange text-black font-bold px-8 py-3 rounded-xl hover:scale-105 transition-transform"
                  >
                    {isImprovising ? <Sparkles className="animate-spin w-5 h-5" /> : <Send className="w-5 h-5" />}
                    <span className="ml-3">ВЫЗВАТЬ ДЕМОНА</span>
                  </Button>
                </div>

                {/* Quick Rituals */}
                <div className="mt-8">
                  <div className="uppercase text-xs tracking-[3px] text-muted-foreground mb-3">Быстрые ритуалы</div>
                  <div className="grid grid-cols-3 gap-3">
                    {COMMANDS.map((cmd) => {
                      const onCooldown = isOnCooldown(cmd.id);
                      return (
                        <motion.button
                          key={cmd.id}
                          whileHover={{ scale: 1.04 }}
                          whileTap={{ scale: 0.96 }}
                          onClick={() => executeCommand(cmd)}
                          disabled={!!isSending || onCooldown}
                          className={cn(
                            "h-20 rounded-2xl border flex flex-col items-center justify-center gap-1 text-sm font-mono transition-all",
                            "hover:border-brand-gold",
                            cmd.color,
                            onCooldown && "opacity-40"
                          )}
                        >
                          {isSending === cmd.id ? <Sparkles className="animate-spin" /> : cmd.icon}
                          <span>{cmd.shortLabel}</span>
                        </motion.button>
                      );
                    })}
                  </div>
                </div>
              </div>
            </motion.div>

            {/* Codex Transition Banner */}
            <AnimatePresence>
              {showCodexTransition && (
                <motion.div
                  initial={{ opacity: 0, y: 40 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="rounded-3xl border border-dashed border-brand-gold/50 bg-gradient-to-br from-black/80 to-transparent p-6 flex items-center gap-5"
                >
                  <Rocket className="w-10 h-10 text-brand-gold" />
                  <div>
                    <div className="font-orbitron text-xl text-brand-gold">Это был последний ритуал в CyberStudio</div>
                    <div className="text-sm text-muted-foreground mt-1">Теперь говори напрямую с Codex. Ты уже кибердемон.</div>
                  </div>
                  <Button asChild className="ml-auto bg-brand-gold text-black hover:bg-white">
                    <Link href="https://chatgpt.com/codex" target="_blank">
                      Открыть Codex сейчас
                    </Link>
                  </Button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Right Sidebar — Logs & Legacy */}
          <div className="lg:col-span-4 space-y-6">
            
            <div className="rounded-3xl border border-border bg-card/60 backdrop-blur-2xl overflow-hidden">
              <div className="px-6 py-4 border-b flex items-center justify-between bg-black/40">
                <div className="font-mono text-xs text-brand-cyan flex items-center gap-2">
                  <Flame className="w-4 h-4" /> ЖУРНАЛ ВЫЗОВОВ
                </div>
                <div className="flex gap-1.5">
                  <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                  <div className="w-2 h-2 rounded-full bg-yellow-400" />
                  <div className="w-2 h-2 rounded-full bg-green-500" />
                </div>
              </div>
              
              <div ref={logsContainerRef} className="h-[380px] overflow-y-auto p-5 space-y-3 text-xs">
                {logs.length === 0 ? (
                  <div className="h-full flex items-center justify-center text-center text-muted-foreground/60">
                    Жди первого вызова...<br />История пишется здесь
                  </div>
                ) : (
                  <AnimatePresence>
                    {logs.map((log) => (
                      <motion.div
                        key={log.id}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        className={cn(
                          "pl-3 border-l-2 text-[11px] leading-relaxed",
                          log.type === 'success' && "border-green-500 text-green-400",
                          log.type === 'error' && "border-red-500 text-red-400",
                          log.type === 'codex' && "border-brand-gold text-brand-gold",
                          log.type === 'improvisation' && "border-purple-500 text-purple-400",
                          log.type === 'command' && "border-cyan-400 text-cyan-400"
                        )}
                      >
                        <span className="font-mono opacity-50 mr-2">
                          {log.timestamp.toLocaleTimeString('ru-RU', { hour:'2-digit', minute:'2-digit' })}
                        </span>
                        {log.message}
                      </motion.div>
                    ))}
                    <div ref={logsEndRef} />
                  </AnimatePresence>
                )}
              </div>
            </div>

            {/* Cookbook Button */}
            <Button 
              onClick={fetchCookbook}
              className="w-full h-16 bg-gradient-to-r from-brand-red-orange via-brand-gold to-brand-cyan text-black font-bold text-lg rounded-2xl hover:scale-[1.02] transition-transform flex items-center justify-center gap-3"
            >
              <FileCode className="w-6 h-6" />
              ОТКРЫТЬ КУЛИНАРНУЮ КНИГУ КИБЕРДЕМОНА
            </Button>

            <div className="text-center text-[10px] text-muted-foreground font-mono">
              Это был последний раз, когда мы использовали CyberStudio.<br />
              Дальше — только слова и Codex.
            </div>
          </div>
        </div>
      </main>

      {/* Modal — The Book */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-background border border-brand-gold/30 w-full max-w-4xl max-h-[90vh] rounded-3xl overflow-hidden flex flex-col"
            >
              <div className="px-6 py-4 border-b flex items-center justify-between bg-black/60">
                <div className="font-orbitron text-xl text-brand-gold">КУЛИНАРНАЯ КНИГА КИБЕРДЕМОНА</div>
                <Button variant="ghost" size="icon" onClick={() => setIsModalOpen(false)}>
                  <X />
                </Button>
              </div>
              
              <div className="flex-1 overflow-auto p-8 prose prose-invert max-w-none text-sm">
                {isLoadingMd ? (
                  <div className="flex h-64 items-center justify-center">
                    <div className="animate-spin w-8 h-8 border-2 border-brand-gold border-t-transparent rounded-full" />
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
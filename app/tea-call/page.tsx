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
  Flame
} from "lucide-react";
import { useAppContext } from "@/contexts/AppContext";
import { cn } from "@/lib/utils";

const INSTRUCTIONS_URL =
  "https://raw.githubusercontent.com/salavey13/carTest/main/docs/%D0%BC%D0%B0%D0%B3%D0%B8%D1%87%D0%B5%D1%81%D0%BA%D0%B0%D1%8F_%D0%BA%D0%BD%D0%BE%D0%BF%D0%BA%D0%B0_%D0%B2_cyber_vibe_studio_%D1%82%D1%83%D1%82%D0%BE%D1%80%D0%B8%D0%B0%D0%BB_%D0%B4%D0%BB%D1%8F_%D0%BD%D0%BE%D0%B2%D0%B8%D1%87%D0%BA%D0%BE%D0%B2(imgs).md";

type LogEntry = {
  id: string;
  message: string;
  timestamp: Date;
  type: 'info' | 'success' | 'warning' | 'error' | 'command' | 'improvisation';
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
    label: 'Чай',
    shortLabel: 'Чай',
    icon: <Coffee className="w-4 h-4" />,
    color: 'text-amber-400',
    bgGradient: 'from-amber-500/20 via-orange-500/20 to-amber-600/20',
    message: 'просит принести чай. ☕️',
    description: 'Классика',
    variant: 'primary',
    priority: 1,
    cooldown: 3000,
    magicLevel: 2
  },
  {
    id: 'urgent',
    label: 'SOS',
    shortLabel: 'SOS',
    icon: <AlertTriangle className="w-4 h-4" />,
    color: 'text-rose-400',
    bgGradient: 'from-rose-500/20 via-red-500/20 to-rose-600/20',
    message: 'ТРЕБУЕТ внимания СРОЧНО! 🚨',
    description: 'Срочно',
    variant: 'danger',
    priority: 3,
    cooldown: 8000,
    magicLevel: 4
  },
  {
    id: 'broadcast',
    label: 'Всем',
    shortLabel: 'Всем',
    icon: <Radio className="w-4 h-4" />,
    color: 'text-cyan-400',
    bgGradient: 'from-cyan-500/20 via-blue-500/20 to-cyan-600/20',
    message: 'объявляет общее собрание! 🫖',
    description: 'Оповещение',
    variant: 'secondary',
    priority: 2,
    cooldown: 12000,
    magicLevel: 5
  }
];

// Smooth ticker
const MagicTicker = ({ items, speed = 50 }: { items: string[], speed?: number }) => {
  const [position, setPosition] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const [contentWidth, setContentWidth] = useState(0);
  
  useEffect(() => {
    if (containerRef.current) {
      setContentWidth(containerRef.current.scrollWidth / 2);
    }
  }, [items]);

  useAnimationFrame((time, delta) => {
    setPosition((prev) => {
      const newPos = prev + (delta * speed) / 1000;
      return newPos >= contentWidth ? 0 : newPos;
    });
  });

  const duplicatedItems = [...items, ...items, ...items];

  return (
    <div className="overflow-hidden whitespace-nowrap relative">
      <div 
        ref={containerRef}
        className="inline-flex gap-8"
        style={{ transform: `translateX(-${position}px)` }}
      >
        {duplicatedItems.map((item, i) => (
          <span key={i} className="inline-flex items-center gap-2 text-xs sm:text-sm text-muted-foreground/60 font-mono">
            <Sparkle className="w-3 h-3 text-brand-gold/50" />
            {item}
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
    setTimeout(() => {
      setCooldowns(prev => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
    }, duration);
  }, []);

  const isOnCooldown = useCallback((id: string) => {
    return (cooldowns[id] || 0) > Date.now();
  }, [cooldowns]);

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
    status,
    role
  } = dbUser || {};

  const fullName = [firstName, lastName].filter(Boolean).join(' ') || username || 'Неизвестный';

  const [isSending, setIsSending] = useState<string | null>(null);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [mdContent, setMdContent] = useState<string>("");
  const [isLoadingMd, setIsLoadingMd] = useState(false);
  const [showExtender, setShowExtender] = useState(false);
  const [copied, setCopied] = useState(false);
  
  // Improvisation State
  const [improvisationText, setImprovisationText] = useState("");
  const [isImprovising, setIsImprovising] = useState(false);
  
  const logsEndRef = useRef<HTMLDivElement>(null);
  const logsContainerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const { startCooldown, isOnCooldown } = useCooldown();

  const tickerItems = [
    "✨ Напиши любой запрос — сработает как заклинание",
    "🚀 Импровизируй без границ",
    "🎨 Быстрые кнопки — лишь шаблоны",
    "⚡ Твоя воля — закон",
    "🔮 Введи команду в терминал",
    "🛠️ Создай свой интерфейс"
  ];

  useEffect(() => {
    if (logsEndRef.current && logsContainerRef.current) {
      const container = logsContainerRef.current;
      const isNearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 100;
      if (isNearBottom) {
        logsEndRef.current.scrollIntoView({ behavior: "smooth", block: "end" });
      }
    }
  }, [logs]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (isAuthenticated && dbUser) {
        addLog(`🔐 Сессия активна`, 'info');
        setTimeout(() => {
          addLog(`👋 ${firstName || username}, готов к магии`, 'success');
        }, 300);
      } else {
        addLog('⚡ Гостевой режим', 'warning');
      }
    }, 200);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const addLog = useCallback((message: string, type: LogEntry['type'] = 'info', options?: { meta?: LogEntry['meta'] }) => {
    setLogs(prev => {
      const newLog: LogEntry = {
        id: generateId(),
        message,
        timestamp: new Date(),
        type,
        meta: options?.meta
      };
      return [...prev.slice(-24), newLog];
    });
  }, []);

  const fetchInstructions = async () => {
    if (mdContent) {
      setIsModalOpen(true);
      return;
    }
    setIsLoadingMd(true);
    setIsModalOpen(true);
    try {
      const response = await fetch(INSTRUCTIONS_URL);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const text = await response.text();
      setMdContent(text);
      addLog('📖 Гримуар загружен', 'success');
    } catch (error) {
      setMdContent("# ⚠️ Ошибка\nНет связи с библиотекой.");
      addLog('❌ Ошибка загрузки', 'error');
    } finally {
      setIsLoadingMd(false);
    }
  };

  // --- IMPROVISATION LOGIC ---
  const handleCastImprovisation = async () => {
    if (!improvisationText.trim() || isImprovising) return;

    setIsImprovising(true);
    const message = `🔮 *ИМПРОВИЗАЦИЯ*\n_${fullName}_ (@${username}):\n\n"${improvisationText}"`;
    
    addLog(`▶ Колдовство: "${improvisationText.substring(0, 30)}..."`, 'improvisation');

    try {
      const result = await notifyAdmin(message);
      if (result?.success) {
        addLog(`✓ Воля отправлена во Вселенную`, 'success');
        setImprovisationText("");
      } else {
        addLog(`✗ Помехи в эфире`, 'error');
      }
    } catch (err) {
      addLog(`✗ Магический провал`, 'error');
    } finally {
      setTimeout(() => setIsImprovising(false), 500);
    }
  };

  const executeCommand = async (command: CommandButton) => {
    if (isSending || isOnCooldown(command.id)) return;
    
    setIsSending(command.id);
    startCooldown(command.id, command.cooldown);
    
    const personalizedMessage = `👤 *${fullName}* (@${username}) ${command.message}`;
    
    addLog(`▶ Заклинание: ${command.label}`, 'command', {
      meta: { commandType: command.id }
    });

    try {
      const result = command.id === 'broadcast' 
        ? await notifyAdmins(personalizedMessage)
        : await notifyAdmin(personalizedMessage);

      if (result?.success) {
        addLog(`✓ Успех: ${command.label}`, 'success');
      } else {
        addLog(`✗ Ошибка: ${command.label}`, 'error');
      }
    } catch (err) {
      addLog(`✗ Системный сбой`, 'error');
    } finally {
      setTimeout(() => setIsSending(null), 300);
    }
  };

  const copyCommandTemplate = useCallback(() => {
    const template = `{
  id: 'my_spell',
  label: 'Моё Заклинание',
  icon: <Zap className="w-4 h-4" />,
  message: 'колдует! ✨'
}`;
    navigator.clipboard.writeText(template);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    addLog('📋 Свиток скопирован', 'success');
  }, [addLog]);

  const stats = useMemo(() => ({
    total: logs.filter(l => l.type === 'success').length,
    commands: logs.filter(l => l.type === 'command' || l.type === 'improvisation').length,
    uptime: Math.floor(logs.length * 1.5)
  }), [logs]);

  // Handle Enter key in textarea
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleCastImprovisation();
    }
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-background text-foreground relative overflow-hidden flex flex-col pt-16 sm:pt-20">
      {/* Background Effects */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808005_1px,transparent_1px),linear-gradient(to_bottom,#80808005_1px,transparent_1px)] bg-[size:20px_20px] sm:bg-[size:32px_32px] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_40%,transparent_100%)]" />
        
        <motion.div
          animate={{ scale: [1, 1.2, 1], opacity: [0.15, 0.3, 0.15] }}
          transition={{ duration: 15, repeat: Infinity, ease: "easeInOut" }}
          className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-brand-cyan/10 rounded-full blur-[120px]"
        />
      </div>

      {/* Top Ticker */}
      <div className="relative z-20 bg-background/80 backdrop-blur-md border-b border-border/50 py-2">
        <MagicTicker items={tickerItems} speed={30} />
      </div>

      {/* Main Content */}
      <main className="relative z-10 flex-1 max-w-6xl mx-auto px-3 sm:px-4 lg:px-6 py-4 sm:py-6 w-full">
        
        {/* Header */}
        <motion.div 
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6 sm:mb-8 text-center"
        >
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-brand-cyan/10 border border-brand-cyan/20 text-brand-cyan text-xs font-mono mb-2">
            <Terminal className="w-3 h-3" />
            <span>IMPROVISATION TERMINAL</span>
            <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
          </div>
          <h1 className="font-orbitron font-bold text-3xl sm:text-4xl bg-gradient-to-r from-brand-cyan via-brand-gold to-brand-red-orange bg-clip-text text-transparent">
            Точка Входа
          </h1>
          <p className="text-sm sm:text-base text-muted-foreground mt-1 max-w-md mx-auto">
            Опиши свою волю. Система исполнит.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-6">
          
          {/* Main Interaction Panel */}
          <div className="lg:col-span-8 space-y-4 sm:space-y-6">
            
            {/* The Input Core - Entry Point for Improvisation */}
            <motion.div 
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              className="relative overflow-hidden rounded-2xl border border-brand-cyan/30 bg-card/70 backdrop-blur-xl shadow-2xl"
            >
              {/* Glowing Top Border */}
              <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-brand-cyan to-transparent" />
              
              <div className="p-5 sm:p-8">
                <div className="flex flex-col gap-4">
                  <div className="flex items-center gap-3 text-brand-cyan">
                    <div className="p-2 rounded-lg bg-brand-cyan/10 border border-brand-cyan/20">
                      <Type className="w-5 h-5" />
                    </div>
                    <div>
                      <h2 className="font-orbitron font-bold">Поле Импровизации</h2>
                      <p className="text-xs text-muted-foreground">Введи команду на естественном языке</p>
                    </div>
                  </div>

                  <div className="relative group">
                    <textarea
                      ref={inputRef}
                      value={improvisationText}
                      onChange={(e) => setImprovisationText(e.target.value)}
                      onKeyDown={handleKeyDown}
                      placeholder="Например: Напомни админу про таблицу в 15:00..."
                      disabled={isImprovising}
                      className={cn(
                        "w-full h-24 p-4 rounded-xl bg-background/80 border border-border/50",
                        "focus:border-brand-cyan/50 focus:ring-1 focus:ring-brand-cyan/20 focus:outline-none",
                        "font-mono text-sm text-foreground placeholder:text-muted-foreground/40 resize-none transition-all",
                        "disabled:opacity-50 disabled:cursor-not-allowed"
                      )}
                    />
                    
                    {/* Character count & send button */}
                    <div className="absolute bottom-3 right-3 flex items-center gap-2">
                       <AnimatePresence>
                        {improvisationText.length > 0 && (
                          <motion.span 
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            className="text-[10px] text-muted-foreground font-mono"
                          >
                            {improvisationText.length} / 500
                          </motion.span>
                        )}
                      </AnimatePresence>

                      <Button
                        onClick={handleCastImprovisation}
                        disabled={!improvisationText.trim() || isImprovising}
                        size="sm"
                        className={cn(
                          "bg-brand-cyan text-black hover:bg-brand-cyan/90 font-bold transition-all",
                          "disabled:bg-muted disabled:text-muted-foreground"
                        )}
                      >
                        {isImprovising ? (
                          <Sparkles className="w-4 h-4 animate-spin" />
                        ) : (
                          <Send className="w-4 h-4" />
                        )}
                        <span className="ml-2 hidden sm:inline">Cast</span>
                      </Button>
                    </div>
                  </div>

                  {/* Quick Spells (Formerly Magic Buttons) */}
                  <div className="pt-2">
                    <div className="flex items-center justify-between mb-2 px-1">
                      <span className="text-xs text-muted-foreground uppercase tracking-wider font-mono">Быстрые заклинания</span>
                      <span className="text-[10px] text-muted-foreground/50">или выбери шаблон</span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {COMMANDS.map((cmd) => {
                        const cooldownActive = isOnCooldown(cmd.id);
                        return (
                          <motion.button
                            key={cmd.id}
                            whileHover={{ scale: 1.03 }}
                            whileTap={{ scale: 0.97 }}
                            onClick={() => executeCommand(cmd)}
                            disabled={!!isSending || cooldownActive}
                            className={cn(
                              "flex items-center gap-2 px-4 py-2 rounded-lg border text-sm font-mono transition-all",
                              "bg-muted/30 hover:bg-muted/50 border-border/50 hover:border-brand-gold/30",
                              cmd.color,
                              "disabled:opacity-50 disabled:cursor-not-allowed"
                            )}
                          >
                            {isSending === cmd.id ? (
                              <Sparkles className="w-4 h-4 animate-spin" />
                            ) : (
                              cmd.icon
                            )}
                            <span>{cmd.label}</span>
                            {cooldownActive && (
                              <Clock className="w-3 h-3 ml-1 text-muted-foreground animate-pulse" />
                            )}
                          </motion.button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>

            {/* Extender / Education Section */}
            <motion.div
              initial={false}
              className="relative overflow-hidden rounded-2xl border border-dashed border-brand-yellow/30 bg-gradient-to-br from-brand-yellow/5 via-transparent to-brand-gold/5 backdrop-blur-sm"
            >
              <button
                onClick={() => setShowExtender(!showExtender)}
                className="w-full p-4 sm:p-5 text-left group"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-brand-yellow/10 border border-brand-yellow/20">
                      <GitBranch className="w-5 h-5 text-brand-yellow" />
                    </div>
                    <div>
                      <h3 className="font-orbitron font-bold text-sm text-foreground group-hover:text-brand-yellow transition-colors">
                        Кристаллизация Воли
                      </h3>
                      <p className="text-xs text-muted-foreground">Часто используешь? Сделай кнопкой</p>
                    </div>
                  </div>
                  <motion.div
                    animate={{ rotate: showExtender ? 180 : 0 }}
                    transition={{ duration: 0.3 }}
                  >
                    <ChevronDown className="w-5 h-5 text-muted-foreground" />
                  </motion.div>
                </div>
              </button>

              <AnimatePresence>
                {showExtender && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="px-4 sm:px-5 pb-5 space-y-4 text-sm"
                  >
                    <div className="h-px bg-gradient-to-r from-transparent via-brand-yellow/30 to-transparent" />
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      <span className="text-brand-yellow font-semibold">Концепция:</span> Импровизация — это поток. Но если паттерн повторяется, его стоит "застыть" в коде. 
                      Так "Принеси чаю" превращается в кнопку, экономя время.
                    </p>
                    
                    <div className="flex gap-2">
                      <Button
                        onClick={fetchInstructions}
                        size="sm"
                        variant="outline"
                        className="border-brand-yellow/30 text-brand-yellow hover:bg-brand-yellow/10"
                      >
                        <FileCode className="w-4 h-4 mr-2" />
                        Как создать кнопку
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={copyCommandTemplate}
                        className="text-muted-foreground"
                      >
                        {copied ? <CheckCircle2 className="w-4 h-4 mr-2 text-green-500" /> : <Copy className="w-4 h-4 mr-2" />}
                        Скопировать шаблон
                      </Button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>

          </div>

          {/* Sidebar - Logs & Stats */}
          <div className="lg:col-span-4 space-y-4">
            
            {/* System Log */}
            <div className="rounded-2xl border border-border bg-card/50 backdrop-blur-xl overflow-hidden shadow-lg">
              <div className="px-3 sm:px-4 py-2.5 border-b border-border bg-muted/30 flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs font-mono text-muted-foreground">
                  <History className="w-3.5 h-3.5" />
                  <span>ЖУРНАЛ СОБЫТИЙ</span>
                </div>
                <div className="flex gap-1">
                  <div className="w-1.5 h-1.5 rounded-full bg-red-500/60" />
                  <div className="w-1.5 h-1.5 rounded-full bg-yellow-500/60" />
                  <div className="w-1.5 h-1.5 rounded-full bg-green-500/60 animate-pulse" />
                </div>
              </div>
              
              <div 
                ref={logsContainerRef}
                className="h-[320px] overflow-y-auto p-3 space-y-2 scrollbar-thin scrollbar-thumb-border scrollbar-track-transparent"
              >
                {logs.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-muted-foreground/40 gap-2">
                    <Flame className="w-8 h-8" />
                    <span className="text-xs text-center">Ждем твоей команды...</span>
                  </div>
                ) : (
                  <AnimatePresence mode="popLayout" initial={false}>
                    {logs.map((log) => (
                      <motion.div
                        key={log.id}
                        layout
                        initial={{ opacity: 0, x: -10, scale: 0.95 }}
                        animate={{ opacity: 1, x: 0, scale: 1 }}
                        exit={{ opacity: 0, x: 10 }}
                        className={cn(
                          "flex gap-2 items-start p-2 rounded-lg border-l-2 text-[10px] sm:text-xs",
                          log.type === 'success' && "bg-green-500/5 border-green-500 text-green-600 dark:text-green-400",
                          log.type === 'error' && "bg-red-500/5 border-red-500 text-red-600 dark:text-red-400",
                          log.type === 'info' && "bg-blue-500/5 border-blue-500 text-blue-600 dark:text-blue-400",
                          log.type === 'warning' && "bg-yellow-500/5 border-yellow-500 text-yellow-600 dark:text-yellow-400",
                          log.type === 'command' && "bg-purple-500/5 border-purple-500 text-purple-600 dark:text-purple-400",
                          log.type === 'improvisation' && "bg-brand-cyan/5 border-brand-cyan text-brand-cyan",
                        )}
                      >
                        <span className="text-muted-foreground/40 font-mono shrink-0">
                          {log.timestamp.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                        </span>
                        <span className="break-words leading-relaxed">{log.message}</span>
                      </motion.div>
                    ))}
                    <div ref={logsEndRef} />
                  </AnimatePresence>
                )}
              </div>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-3 gap-2">
              {[
                { icon: TrendingUp, value: stats.total, label: 'Успех', color: 'text-brand-gold' },
                { icon: TerminalSquare, value: stats.commands, label: 'Команд', color: 'text-brand-cyan' },
                { icon: Clock, value: `${stats.uptime}m`, label: 'Аптайм', color: 'text-green-500' }
              ].map((stat, i) => (
                <motion.div 
                  key={i}
                  whileHover={{ scale: 1.05 }}
                  className="p-3 rounded-xl border border-border bg-card/40 backdrop-blur-sm text-center"
                >
                  <stat.icon className={cn("w-4 h-4 mx-auto mb-1", stat.color)} />
                  <div className={cn("text-lg font-bold", stat.color)}>{stat.value}</div>
                  <div className="text-[10px] text-muted-foreground">{stat.label}</div>
                </motion.div>
              ))}
            </div>

             {/* Developer Card */}
             <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3 }}
              className="relative overflow-hidden rounded-xl border border-border bg-card/50 backdrop-blur-md p-4 group hover:border-brand-yellow/30 transition-colors"
            >
              <div className="flex flex-col gap-3">
                <div className="flex items-center gap-2 text-brand-yellow">
                  <Zap className="w-4 h-4" />
                  <span className="text-xs font-bold uppercase font-mono">Pro Level</span>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Нужна сложная автоматизация или интеграция? Обращайся.
                </p>
                <Button 
                  asChild
                  variant="outline" 
                  size="sm"
                  className="border-brand-cyan/30 text-brand-cyan hover:bg-brand-cyan/10"
                >
                  <Link href="/wblanding" className="flex items-center justify-center gap-2">
                    Контакты
                    <ArrowUpRight className="w-4 h-4" />
                  </Link>
                </Button>
              </div>
            </motion.div>

          </div>
        </div>
      </main>

      {/* Instructions Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsModalOpen(false)}
              className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50"
            />
            
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="fixed inset-3 sm:inset-4 md:inset-auto md:top-1/2 md:left-1/2 md:-translate-x-1/2 md:-translate-y-1/2 md:w-full md:max-w-3xl md:h-[80vh] z-50 bg-background border border-border rounded-2xl shadow-2xl flex flex-col overflow-hidden"
            >
              <div className="px-4 sm:px-6 py-3 sm:py-4 border-b border-border bg-muted/30 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-brand-yellow/10 border border-brand-yellow/20">
                    <Wand2 className="w-4 h-4 sm:w-5 sm:h-5 text-brand-yellow" />
                  </div>
                  <div>
                    <h2 className="font-orbitron font-bold text-sm sm:text-base">Гримуар Инструкций</h2>
                    <p className="text-[10px] sm:text-xs text-muted-foreground font-mono">Как создать кнопку</p>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setIsModalOpen(false)}
                  className="h-8 w-8 sm:h-10 sm:w-10"
                >
                  <X className="h-4 w-4 sm:h-5 sm:w-5" />
                </Button>
              </div>

              <div className="flex-1 overflow-y-auto p-4 sm:p-6 prose prose-sm max-w-none 
                prose-headings:font-orbitron prose-headings:text-brand-gold prose-headings:text-sm sm:prose-headings:text-base
                prose-a:text-brand-cyan prose-code:text-brand-pink prose-code:bg-muted prose-code:px-1 prose-code:rounded
                prose-pre:bg-muted prose-pre:border prose-pre:border-border prose-img:rounded-lg">
                {isLoadingMd ? (
                  <div className="flex flex-col items-center justify-center h-40 gap-3">
                    <div className="w-8 h-8 border-2 border-brand-yellow/30 border-t-brand-yellow rounded-full animate-spin" />
                    <span className="text-xs text-muted-foreground font-mono">Загрузка...</span>
                  </div>
                ) : (
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {mdContent}
                  </ReactMarkdown>
                )}
              </div>

              <div className="px-4 sm:px-6 py-3 sm:py-4 border-t border-border bg-muted/30 flex justify-end items-center shrink-0">
                <Button 
                  onClick={() => setIsModalOpen(false)}
                  className="bg-brand-yellow text-black hover:bg-brand-yellow/90 text-xs sm:text-sm"
                >
                  Закрыть
                </Button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
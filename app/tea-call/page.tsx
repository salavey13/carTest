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
  ExternalLink
} from "lucide-react";
import { useAppContext } from "@/contexts/AppContext";
import { cn } from "@/lib/utils";

const INSTRUCTIONS_URL =
  "https://raw.githubusercontent.com/salavey13/carTest/main/docs/%D0%BC%D0%B0%D0%B3%D0%B8%D1%87%D0%B5%D1%81%D0%BA%D0%B0%D1%8F_%D0%BA%D0%BD%D0%BE%D0%BF%D0%BA%D0%B0_%D0%B2_cyber_vibe_studio_%D1%82%D1%83%D1%82%D0%BE%D1%80%D0%B8%D0%B0%D0%BB_%D0%B4%D0%BB%D1%8F_%D0%BD%D0%BE%D0%B2%D0%B8%D1%87%D0%BA%D0%BE%D0%B2(imgs).md";

type LogEntry = {
  id: string;
  message: string;
  timestamp: Date;
  type: 'info' | 'success' | 'warning' | 'error' | 'command';
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
  magicLevel: number; // 1-5 stars
};

const generateId = () => `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

const COMMANDS: CommandButton[] = [
  {
    id: 'tea',
    label: 'Вызвать за чаем',
    shortLabel: 'Чай',
    icon: <Coffee className="w-5 h-5" />,
    color: 'text-amber-400',
    bgGradient: 'from-amber-500/20 via-orange-500/20 to-amber-600/20',
    message: 'просит принести чай. ☕️',
    description: 'Классика. Надежно. Вкусно.',
    variant: 'primary',
    priority: 1,
    cooldown: 3000,
    magicLevel: 2
  },
  {
    id: 'urgent',
    label: 'Срочный вызов',
    shortLabel: 'SOS',
    icon: <AlertTriangle className="w-5 h-5" />,
    color: 'text-rose-400',
    bgGradient: 'from-rose-500/20 via-red-500/20 to-rose-600/20',
    message: 'ТРЕБУЕТ чая СРОЧНО! 🚨',
    description: 'Когда терпеть нельзя.',
    variant: 'danger',
    priority: 3,
    cooldown: 8000,
    magicLevel: 4
  },
  {
    id: 'broadcast',
    label: 'Оповестить всех',
    shortLabel: 'Всем',
    icon: <Radio className="w-5 h-5" />,
    color: 'text-cyan-400',
    bgGradient: 'from-cyan-500/20 via-blue-500/20 to-cyan-600/20',
    message: 'объявляет чайную паузу для всех! 🫖',
    description: 'Массовый охват. Максимальный эффект.',
    variant: 'secondary',
    priority: 2,
    cooldown: 12000,
    magicLevel: 5
  }
];

// Smooth ticker using requestAnimationFrame
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

  const getRemainingTime = useCallback((id: string) => {
    const remaining = (cooldowns[id] || 0) - Date.now();
    return Math.max(0, Math.ceil(remaining / 1000));
  }, [cooldowns]);

  return { startCooldown, isOnCooldown, getRemainingTime };
};

const MagicStars = ({ level }: { level: number }) => (
  <div className="flex gap-0.5">
    {[1, 2, 3, 4, 5].map((star) => (
      <Sparkles 
        key={star} 
        className={cn(
          "w-3 h-3 transition-all duration-300",
          star <= level ? "text-brand-gold fill-brand-gold" : "text-muted-foreground/20"
        )}
      />
    ))}
  </div>
);

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
  const isAdmin = status === 'admin' || role === 'vprAdmin' || role === 'admin';

  const [isSending, setIsSending] = useState<string | null>(null);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [mdContent, setMdContent] = useState<string>("");
  const [isLoadingMd, setIsLoadingMd] = useState(false);
  const [activeGlow, setActiveGlow] = useState<number>(0);
  const [showExtender, setShowExtender] = useState(false);
  const [copied, setCopied] = useState(false);
  
  const logsEndRef = useRef<HTMLDivElement>(null);
  const logsContainerRef = useRef<HTMLDivElement>(null);

  const { startCooldown, isOnCooldown, getRemainingTime } = useCooldown();

  const tickerItems = [
    "✨ Добавь свою кнопку через инструкцию",
    "🚀 Расширяй функционал без кода",
    "🎨 Кастомизируй сообщения",
    "⚡ Автоматизируй рутину",
    "🔮 Создай свой магический интерфейс",
    "📱 Работает в Telegram и Web",
    "🛠️ Zero-code конфигурация"
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
    const interval = setInterval(() => {
      setActiveGlow((prev) => (prev + 1) % COMMANDS.length);
    }, 4000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (isAuthenticated && dbUser) {
        addLog(`🔐 Сессия инициализирована`, 'info');
        setTimeout(() => {
          addLog(`👋 Добро пожаловать, ${firstName || username}!`, 'success');
        }, 300);
      } else {
        addLog('⚡ Гостевой доступ активирован', 'warning');
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
      addLog('📖 Инструкции загружены', 'success');
    } catch (error) {
      setMdContent("# ⚠️ Ошибка загрузки\nПроверьте соединение или попробуйте позже.");
      addLog('❌ Ошибка загрузки инструкций', 'error');
    } finally {
      setIsLoadingMd(false);
    }
  };

  const executeCommand = async (command: CommandButton) => {
    if (isSending || isOnCooldown(command.id)) return;
    
    setIsSending(command.id);
    startCooldown(command.id, command.cooldown);
    
    const personalizedMessage = `👤 *${fullName}* (@${username}) ${command.message}`;
    
    addLog(`▶ ${command.label}...`, 'command', {
      meta: { commandType: command.id }
    });

    try {
      const result = command.id === 'broadcast' 
        ? await notifyAdmins(personalizedMessage)
        : await notifyAdmin(personalizedMessage);

      if (result?.success) {
        addLog(`✓ Успешно: ${command.label}`, 'success');
      } else {
        addLog(`✗ Ошибка: ${command.label}`, 'error');
      }
    } catch (err) {
      addLog(`✗ Системная ошибка`, 'error');
    } finally {
      setTimeout(() => setIsSending(null), 300);
    }
  };

  const copyCommandTemplate = useCallback(() => {
    const template = `{
  id: 'my_custom_command',
  label: 'Моя Кнопка',
  icon: <Zap className="w-5 h-5" />,
  color: 'text-purple-400',
  message: 'творит магию! ✨',
  magicLevel: 5
}`;
    navigator.clipboard.writeText(template);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    addLog('📋 Шаблон команды скопирован!', 'success');
  }, [addLog]);

  const stats = useMemo(() => ({
    total: logs.filter(l => l.type === 'success').length,
    commands: logs.filter(l => l.type === 'command').length,
    uptime: Math.floor(logs.length * 1.5)
  }), [logs]);

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-background text-foreground relative overflow-hidden flex flex-col pt-16 sm:pt-20">
      {/* Background Effects */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808005_1px,transparent_1px),linear-gradient(to_bottom,#80808005_1px,transparent_1px)] bg-[size:20px_20px] sm:bg-[size:32px_32px] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_40%,transparent_100%)]" />
        
        <motion.div
          animate={{ scale: [1, 1.2, 1], opacity: [0.1, 0.25, 0.1] }}
          transition={{ duration: 15, repeat: Infinity, ease: "easeInOut" }}
          className="absolute top-0 left-1/4 w-96 h-96 bg-brand-red-orange/20 rounded-full blur-[100px]"
        />
        <motion.div
          animate={{ scale: [1, 1.3, 1], opacity: [0.08, 0.2, 0.08] }}
          transition={{ duration: 20, repeat: Infinity, ease: "easeInOut", delay: 5 }}
          className="absolute bottom-0 right-1/4 w-[500px] h-[500px] bg-brand-deep-indigo/20 rounded-full blur-[120px]"
        />
      </div>

      {/* Top Ticker - Smooth */}
      <div className="relative z-20 bg-background/80 backdrop-blur-md border-b border-border/50 py-2">
        <MagicTicker items={tickerItems} speed={30} />
      </div>

      {/* Main Content */}
      <main className="relative z-10 flex-1 max-w-6xl mx-auto px-3 sm:px-4 lg:px-6 py-4 sm:py-6 w-full">
        
        {/* Header */}
        <motion.div 
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-4 sm:mb-6 text-center sm:text-left"
        >
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-brand-cyan/10 border border-brand-cyan/20 text-brand-cyan text-xs font-mono mb-2">
            <Terminal className="w-3 h-3" />
            <span>TERMINAL v2.0</span>
            <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
          </div>
          <h1 className="font-orbitron font-bold text-2xl sm:text-3xl lg:text-4xl bg-gradient-to-r from-brand-gold via-brand-red-orange to-brand-cyan bg-clip-text text-transparent">
            Панель Управления
          </h1>
          <p className="text-sm sm:text-base text-muted-foreground mt-1">
            Удаленное управление администрацией через магические кнопки
          </p>
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-6">
          {/* Main Panel */}
          <div className="lg:col-span-8 space-y-4 sm:space-y-6">
            
            {/* Commands Grid */}
            <div className="relative overflow-hidden rounded-2xl border border-border bg-card/50 backdrop-blur-xl shadow-xl">
              <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-brand-red-orange via-brand-gold to-brand-cyan" />
              
              <div className="p-4 sm:p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="font-orbitron font-bold text-base sm:text-lg flex items-center gap-2">
                    <Wand2 className="w-4 h-4 sm:w-5 sm:h-5 text-brand-gold" />
                    Магические Кнопки
                  </h2>
                  <span className="text-xs text-muted-foreground font-mono">
                    {COMMANDS.length} активных
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {COMMANDS.map((cmd, idx) => {
                    const cooldownActive = isOnCooldown(cmd.id);
                    const remaining = getRemainingTime(cmd.id);
                    const isActive = activeGlow === idx && !cooldownActive;
                    
                    return (
                      <motion.button
                        key={cmd.id}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: idx * 0.1 }}
                        whileHover={!cooldownActive ? { y: -4, scale: 1.02 } : {}}
                        whileTap={!cooldownActive ? { scale: 0.98 } : {}}
                        onClick={() => executeCommand(cmd)}
                        disabled={!!isSending || cooldownActive}
                        className={cn(
                          "group relative overflow-hidden rounded-xl border text-left transition-all duration-300",
                          "p-4 sm:p-5",
                          isActive 
                            ? "border-brand-gold/50 shadow-[0_0_20px_rgba(249,172,103,0.15)]" 
                            : "border-border/50 hover:border-brand-gold/30",
                          cooldownActive && "opacity-50 cursor-not-allowed"
                        )}
                      >
                        {/* Background */}
                        <div className={cn(
                          "absolute inset-0 bg-gradient-to-br opacity-0 group-hover:opacity-100 transition-opacity duration-500",
                          cmd.bgGradient
                        )} />
                        
                        {/* Cooldown */}
                        {cooldownActive && (
                          <div className="absolute inset-0 bg-background/90 backdrop-blur-sm flex items-center justify-center z-10">
                            <div className="text-center">
                              <Clock className="w-6 h-6 text-muted-foreground mx-auto mb-1 animate-pulse" />
                              <span className="font-mono text-lg font-bold text-muted-foreground">
                                {remaining}s
                              </span>
                            </div>
                          </div>
                        )}
                        
                        <div className="relative z-10">
                          <div className="flex items-start justify-between mb-3">
                            <motion.div 
                              className={cn(
                                "w-10 h-10 sm:w-12 sm:h-12 rounded-xl flex items-center justify-center text-white shadow-lg",
                                cmd.color.replace('text-', 'bg-').replace('400', '500')
                              )}
                              whileHover={{ rotate: 360 }}
                              transition={{ duration: 0.6 }}
                            >
                              {isSending === cmd.id ? (
                                <Sparkles className="w-5 h-5 animate-spin" />
                              ) : (
                                cmd.icon
                              )}
                            </motion.div>
                            <MagicStars level={cmd.magicLevel} />
                          </div>
                          
                          <h3 className="font-bold text-sm sm:text-base text-card-foreground mb-1">
                            {cmd.label}
                          </h3>
                          <p className="text-[10px] sm:text-xs text-muted-foreground leading-relaxed">
                            {cmd.description}
                          </p>
                          
                          <div className="mt-3 flex items-center gap-2">
                            <div className={cn(
                              "w-2 h-2 rounded-full",
                              cmd.priority === 3 ? "bg-red-500 animate-pulse" :
                              cmd.priority === 2 ? "bg-yellow-500" : "bg-green-500"
                            )} />
                            <span className="text-[10px] text-muted-foreground font-mono">
                              Приоритет: {cmd.priority}
                            </span>
                          </div>
                        </div>
                      </motion.button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* System Extender - The Persuasion Section */}
            <motion.div
              initial={false}
              animate={{ height: showExtender ? 'auto' : 'auto' }}
              className="relative overflow-hidden rounded-2xl border border-dashed border-brand-yellow/30 bg-gradient-to-br from-brand-yellow/5 via-transparent to-brand-gold/5 backdrop-blur-sm"
            >
              <button
                onClick={() => setShowExtender(!showExtender)}
                className="w-full p-4 sm:p-6 text-left group"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-brand-yellow/10 border border-brand-yellow/20">
                      <Plus className="w-5 h-5 text-brand-yellow" />
                    </div>
                    <div>
                      <h3 className="font-orbitron font-bold text-sm sm:text-base text-foreground group-hover:text-brand-yellow transition-colors">
                        Расширить систему
                      </h3>
                      <p className="text-[10px] sm:text-xs text-muted-foreground">
                        Добавь свои собственные магические кнопки
                      </p>
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
                    className="px-4 sm:px-6 pb-4 sm:pb-6 space-y-4"
                  >
                    <div className="h-px bg-gradient-to-r from-transparent via-brand-yellow/30 to-transparent" />
                    
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs sm:text-sm">
                      <div className="flex items-start gap-2 p-3 rounded-lg bg-background/50 border border-border/50">
                        <Code2 className="w-4 h-4 text-brand-cyan shrink-0 mt-0.5" />
                        <div>
                          <span className="font-semibold text-foreground">Zero-code</span>
                          <p className="text-muted-foreground">Добавляй кнопки без программирования</p>
                        </div>
                      </div>
                      <div className="flex items-start gap-2 p-3 rounded-lg bg-background/50 border border-border/50">
                        <Palette className="w-4 h-4 text-brand-pink shrink-0 mt-0.5" />
                        <div>
                          <span className="font-semibold text-foreground">Кастомизация</span>
                          <p className="text-muted-foreground">Свои иконки, цвета и сообщения</p>
                        </div>
                      </div>
                      <div className="flex items-start gap-2 p-3 rounded-lg bg-background/50 border border-border/50">
                        <GitBranch className="w-4 h-4 text-brand-gold shrink-0 mt-0.5" />
                        <div>
                          <span className="font-semibold text-foreground">Версионирование</span>
                          <p className="text-muted-foreground">GitHub хранит историю изменений</p>
                        </div>
                      </div>
                      <div className="flex items-start gap-2 p-3 rounded-lg bg-background/50 border border-border/50">
                        <Layers className="w-4 h-4 text-green-500 shrink-0 mt-0.5" />
                        <div>
                          <span className="font-semibold text-foreground">Масштабирование</span>
                          <p className="text-muted-foreground">От 1 кнопки до целой панели</p>
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-col sm:flex-row gap-3">
                      <Button
                        onClick={fetchInstructions}
                        className="flex-1 bg-brand-yellow text-black hover:bg-brand-yellow/90 font-bold group"
                      >
                        <FileCode className="w-4 h-4 mr-2 group-hover:animate-pulse" />
                        Открыть инструкцию
                        <ExternalLink className="w-3 h-3 ml-2 opacity-50" />
                      </Button>
                      <Button
                        variant="outline"
                        onClick={copyCommandTemplate}
                        className="border-brand-cyan/30 text-brand-cyan hover:bg-brand-cyan/10"
                      >
                        {copied ? <CheckCircle2 className="w-4 h-4 mr-2" /> : <Copy className="w-4 h-4 mr-2" />}
                        Скопировать шаблон
                      </Button>
                    </div>

                    <div className="p-3 rounded-lg bg-brand-gold/5 border border-brand-gold/20">
                      <p className="text-xs text-muted-foreground leading-relaxed">
                        <span className="text-brand-gold font-semibold">💡 Профессиональный совет:</span> Начни с копирования существующей кнопки и измени сообщение. 
                        Через 5 минут у тебя будет своя персональная команда! Все изменения автоматически деплоятся через GitHub.
                      </p>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>

            {/* Developer Card */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3 }}
              className="relative overflow-hidden rounded-xl border border-border bg-card/50 backdrop-blur-md p-4 sm:p-5 group hover:border-brand-yellow/30 transition-colors"
            >
              <div className="absolute top-0 right-0 p-6 opacity-5 group-hover:opacity-10 transition-opacity">
                <Bot className="w-24 h-24 text-brand-yellow" />
              </div>
              
              <div className="relative z-10 flex flex-col sm:flex-row gap-4 items-start sm:items-center">
                <div className="bg-gradient-to-br from-brand-yellow/20 to-brand-red-orange/20 p-3 rounded-xl border border-brand-yellow/20 shrink-0">
                  <Zap className="w-6 h-6 sm:w-8 sm:h-8 text-brand-yellow" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-orbitron font-bold text-sm sm:text-base text-foreground mb-1">
                    Нужен кастомный бот или автоматизация?
                  </h3>
                  <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
                    Павел создает Telegram-ботов и веб-приложения. Заменю "МойСклад", 
                    интегрирую с Ozon/Wildberries, автоматизирую процессы от 2000₽.
                  </p>
                </div>
                <Button 
                  asChild
                  variant="outline" 
                  size="sm"
                  className="border-brand-yellow/30 text-brand-yellow hover:bg-brand-yellow/10 shrink-0 w-full sm:w-auto"
                >
                  <Link href="/wblanding" className="flex items-center justify-center gap-2">
                    Обсудить проект
                    <ArrowUpRight className="w-4 h-4" />
                  </Link>
                </Button>
              </div>
            </motion.div>
          </div>

          {/* Sidebar */}
          <div className="lg:col-span-4 space-y-4">
            
            {/* System Log */}
            <div className="rounded-2xl border border-border bg-card/50 backdrop-blur-xl overflow-hidden shadow-lg">
              <div className="px-3 sm:px-4 py-2.5 border-b border-border bg-muted/30 flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs font-mono text-muted-foreground">
                  <History className="w-3.5 h-3.5" />
                  <span>ЛОГ СИСТЕМЫ</span>
                </div>
                <div className="flex gap-1">
                  <div className="w-1.5 h-1.5 rounded-full bg-red-500/60" />
                  <div className="w-1.5 h-1.5 rounded-full bg-yellow-500/60" />
                  <div className="w-1.5 h-1.5 rounded-full bg-green-500/60 animate-pulse" />
                </div>
              </div>
              
              <div 
                ref={logsContainerRef}
                className="h-[280px] sm:h-[320px] overflow-y-auto p-3 space-y-2 scrollbar-thin scrollbar-thumb-border scrollbar-track-transparent"
              >
                {logs.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-muted-foreground/40 gap-2">
                    <MousePointer2 className="w-8 h-8" />
                    <span className="text-xs">Нажмите кнопку...</span>
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

            {/* Stats */}
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
                  <div className={cn("text-lg sm:text-xl font-bold", stat.color)}>{stat.value}</div>
                  <div className="text-[10px] text-muted-foreground">{stat.label}</div>
                </motion.div>
              ))}
            </div>

            {/* Quick Tip */}
            <div className="p-3 rounded-xl border border-brand-cyan/20 bg-brand-cyan/5">
              <p className="text-[10px] sm:text-xs text-muted-foreground leading-relaxed">
                <span className="text-brand-cyan font-semibold">⌨️ Быстрая команда:</span> Нажмите на любую кнопку — админ получит уведомление с вашим именем и ID.
              </p>
            </div>
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
                    <h2 className="font-orbitron font-bold text-sm sm:text-base">Магические Инструкции</h2>
                    <p className="text-[10px] sm:text-xs text-muted-foreground font-mono">Расширение функционала</p>
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

              <div className="px-4 sm:px-6 py-3 sm:py-4 border-t border-border bg-muted/30 flex justify-between items-center shrink-0">
                <span className="text-[10px] sm:text-xs text-muted-foreground font-mono">
                  UTF-8 • HTTPS • Markdown
                </span>
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
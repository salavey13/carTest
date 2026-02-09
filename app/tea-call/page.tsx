// /app/tea-call/page.tsx
"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
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
  User,
  Shield,
  Radio,
  History,
  TrendingUp,
  MousePointer2,
  Maximize2,
  Minimize2,
  Copy,
  CheckCircle2,
  Wifi,
  Battery,
  Signal
} from "lucide-react";
import { useAppContext } from "@/contexts/AppContext";
import { cn } from "@/lib/utils";

// GitHub Raw URL for the instructions
const INSTRUCTIONS_URL =
  "https://raw.githubusercontent.com/salavey13/carTest/main/docs/%D0%BC%D0%B0%D0%B3%D0%B8%D1%87%D0%B5%D1%81%D0%BA%D0%B0%D1%8F_%D0%BA%D0%BD%D0%BE%D0%BF%D0%BA%D0%B0_%D0%B2_cyber_vibe_studio_%D1%82%D1%83%D1%82%D0%BE%D1%80%D0%B8%D0%B0%D0%BB_%D0%B4%D0%BB%D1%8F_%D0%BD%D0%BE%D0%B2%D0%B8%D1%87%D0%BA%D0%BE%D0%B2(imgs).md";

type LogEntry = {
  id: string;
  message: string;
  timestamp: Date;
  type: 'info' | 'success' | 'warning' | 'error' | 'command';
  meta?: {
    originator?: string;
    originatorId?: string;
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
    description: 'Стандартный запрос',
    variant: 'primary',
    priority: 1,
    cooldown: 5000
  },
  {
    id: 'urgent',
    label: 'Срочный вызов',
    shortLabel: 'SOS',
    icon: <AlertTriangle className="w-5 h-5" />,
    color: 'text-rose-400',
    bgGradient: 'from-rose-500/20 via-red-500/20 to-rose-600/20',
    message: 'ТРЕБУЕТ чая СРОЧНО! 🚨',
    description: 'Максимальный приоритет',
    variant: 'danger',
    priority: 3,
    cooldown: 10000
  },
  {
    id: 'broadcast',
    label: 'Оповестить всех',
    shortLabel: 'Всем',
    icon: <Radio className="w-5 h-5" />,
    color: 'text-cyan-400',
    bgGradient: 'from-cyan-500/20 via-blue-500/20 to-cyan-600/20',
    message: 'объявляет чайную паузу для всех! 🫖',
    description: 'Уведомление команды',
    variant: 'secondary',
    priority: 2,
    cooldown: 15000
  }
];

// Utility hooks
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

const useTypingEffect = (text: string, speed: number = 30) => {
  const [displayed, setDisplayed] = useState('');
  const [isTyping, setIsTyping] = useState(false);

  useEffect(() => {
    if (!text) return;
    setIsTyping(true);
    setDisplayed('');
    let i = 0;
    const timer = setInterval(() => {
      if (i < text.length) {
        setDisplayed(text.slice(0, i + 1));
        i++;
      } else {
        setIsTyping(false);
        clearInterval(timer);
      }
    }, speed);
    return () => clearInterval(timer);
  }, [text, speed]);

  return { displayed, isTyping };
};

export default function TeaCallPage() {
  const { dbUser, isAuthenticated } = useAppContext();
  
  // Destructure user data with fallbacks
  const {
    username = 'Гость',
    user_id: userId,
    first_name: firstName,
    last_name: lastName,
    photo_url: photoUrl,
    status,
    role
  } = dbUser || {};

  const displayName = firstName || username || 'Аноним';
  const fullName = [firstName, lastName].filter(Boolean).join(' ') || username || 'Неизвестный';
  const isAdmin = status === 'admin' || role === 'vprAdmin' || role === 'admin';
  const isVip = isAdmin || status === 'vip' || status === 'premium';

  const [isSending, setIsSending] = useState<string | null>(null);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [mdContent, setMdContent] = useState<string>("");
  const [isLoadingMd, setIsLoadingMd] = useState(false);
  const [activeGlow, setActiveGlow] = useState<number>(0);
  const [isCompact, setIsCompact] = useState(false);
  const [copied, setCopied] = useState(false);
  const [lastCommand, setLastCommand] = useState<string | null>(null);
  
  const logsEndRef = useRef<HTMLDivElement>(null);
  const logsContainerRef = useRef<HTMLDivElement>(null);
  const mainRef = useRef<HTMLDivElement>(null);

  const { startCooldown, isOnCooldown, getRemainingTime } = useCooldown();

  // Auto-scroll with smart detection
  useEffect(() => {
    if (logsEndRef.current && logsContainerRef.current) {
      const container = logsContainerRef.current;
      const threshold = 50;
      const isNearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < threshold;
      
      if (isNearBottom) {
        logsEndRef.current.scrollIntoView({ behavior: "smooth", block: "end" });
      }
    }
  }, [logs]);

  // Cycle glow effect
  useEffect(() => {
    const interval = setInterval(() => {
      setActiveGlow((prev) => (prev + 1) % COMMANDS.length);
    }, 4000);
    return () => clearInterval(interval);
  }, []);

  // Welcome animation sequence
  useEffect(() => {
    const timer = setTimeout(() => {
      if (isAuthenticated && dbUser) {
        addLog(`🔐 Сессия инициализирована`, 'info', { 
          meta: { 
            originator: fullName,
            originatorId: userId
          } 
        });
        setTimeout(() => {
          addLog(`👋 Добро пожаловать, ${displayName}!`, 'success', {
            meta: { originator: 'Система' }
          });
        }, 400);
      } else {
        addLog('⚡ Гостевой доступ активирован', 'warning');
      }
    }, 300);
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
      return [...prev.slice(-19), newLog]; // Keep last 20 logs
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
      addLog('📖 Инструкции загружены из репозитория', 'success');
    } catch (error) {
      setMdContent("# ⚠️ Ошибка загрузки\nНе удалось загрузить инструкции. Проверьте соединение.");
      addLog('❌ Ошибка загрузки инструкций', 'error');
    } finally {
      setIsLoadingMd(false);
    }
  };

  const executeCommand = async (command: CommandButton) => {
    if (isSending || isOnCooldown(command.id)) return;
    
    setIsSending(command.id);
    setLastCommand(command.id);
    startCooldown(command.id, command.cooldown);
    
    // Personalized message with originator info
    const personalizedMessage = `👤 *${fullName}* (@${username}) ${command.message}\n🆔 ID: \`${userId?.slice(-8) || 'N/A'}\`\n⚡ Приоритет: ${command.priority}`;
    
    addLog(`▶ Выполнение: ${command.label}...`, 'command', {
      meta: { 
        originator: fullName,
        commandType: command.id 
      }
    });

    try {
      let result;
      
      if (command.id === 'broadcast') {
        result = await notifyAdmins(personalizedMessage);
      } else {
        result = await notifyAdmin(personalizedMessage);
      }

      if (result?.success) {
        addLog(`✓ ${command.label}: Успешно доставлено`, 'success', {
          meta: { originator: fullName }
        });
      } else {
        addLog(`✗ ${command.label}: Ошибка доставки`, 'error');
      }
    } catch (err) {
      addLog(`✗ ${command.label}: Критическая ошибка`, 'error');
    } finally {
      setTimeout(() => setIsSending(null), 500);
    }
  };

  const copyUserId = useCallback(() => {
    if (userId) {
      navigator.clipboard.writeText(userId);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      addLog('📋 ID скопирован в буфер обмена', 'info');
    }
  }, [userId, addLog]);

  const stats = useMemo(() => ({
    total: logs.filter(l => l.type === 'success').length,
    commands: logs.filter(l => l.type === 'command').length,
    errors: logs.filter(l => l.type === 'error').length
  }), [logs]);

  const { displayed: typedWelcome, isTyping } = useTypingEffect(
    isAuthenticated ? `Привет, ${displayName}!` : 'Гостевой режим',
    40
  );

  return (
    <div 
      ref={mainRef}
      className="min-h-[calc(100vh-4rem)] bg-background text-foreground relative overflow-hidden flex flex-col"
    >
      {/* Animated Background - Optimized for performance */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808005_1px,transparent_1px),linear-gradient(to_bottom,#80808005_1px,transparent_1px)] bg-[size:24px_24px] sm:bg-[size:32px_32px] [mask-image:radial-gradient(ellipse_80%_50%_at_50%_50%,#000_70%,transparent_100%)]" />
        
        {/* Floating Orbs with staggered animations */}
        <motion.div
          animate={{
            scale: [1, 1.2, 1],
            opacity: [0.15, 0.4, 0.15],
            x: [0, 30, 0],
            y: [0, -20, 0],
          }}
          transition={{ 
            duration: 12, 
            ease: "easeInOut", 
            repeat: Infinity,
            repeatType: "loop"
          }}
          className="absolute -top-20 -left-20 w-72 h-72 sm:w-96 sm:h-96 bg-brand-red-orange/30 rounded-full blur-[80px] sm:blur-[120px]"
        />
        <motion.div
          animate={{
            scale: [1, 1.3, 1],
            opacity: [0.1, 0.3, 0.1],
            x: [0, -20, 0],
            y: [0, 30, 0],
          }}
          transition={{ 
            duration: 15, 
            ease: "easeInOut", 
            repeat: Infinity,
            repeatType: "loop",
            delay: 3
          }}
          className="absolute -bottom-20 -right-20 w-80 h-80 sm:w-[500px] sm:h-[500px] bg-brand-deep-indigo/30 rounded-full blur-[80px] sm:blur-[120px]"
        />
        <motion.div
          animate={{
            scale: [1, 1.1, 1],
            opacity: [0.05, 0.2, 0.05],
          }}
          transition={{ 
            duration: 10, 
            ease: "easeInOut", 
            repeat: Infinity,
            repeatType: "loop",
            delay: 1.5
          }}
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-brand-gold/10 rounded-full blur-[100px]"
        />
      </div>

      {/* Main Content */}
      <main className="relative z-10 flex-1 max-w-7xl mx-auto px-3 sm:px-4 lg:px-6 py-4 sm:py-6 lg:py-8 w-full">
        
        {/* Header Section with User Profile */}
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-4 sm:mb-6"
        >
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 p-4 rounded-2xl border border-border/50 bg-card/40 backdrop-blur-md">
            <div className="flex items-center gap-3">
              <div className="relative">
                <div className={cn(
                  "w-12 h-12 sm:w-14 sm:h-14 rounded-full overflow-hidden border-2",
                  isVip ? "border-brand-gold shadow-[0_0_15px_rgba(249,172,103,0.4)]" : "border-border"
                )}>
                  {photoUrl ? (
                    <img src={photoUrl} alt={displayName} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-brand-red-orange to-brand-deep-indigo flex items-center justify-center text-white font-bold text-lg">
                      {displayName.charAt(0).toUpperCase()}
                    </div>
                  )}
                </div>
                {isVip && (
                  <div className="absolute -bottom-1 -right-1 bg-brand-gold text-black text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                    VIP
                  </div>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <h1 className="font-orbitron font-bold text-lg sm:text-xl text-foreground truncate">
                  {typedWelcome}
                  {isTyping && <span className="animate-pulse">|</span>}
                </h1>
                <div className="flex items-center gap-2 text-xs sm:text-sm text-muted-foreground">
                  <span className="truncate">@{username}</span>
                  {isAdmin && <Shield className="w-3 h-3 text-brand-cyan" />}
                  <button 
                    onClick={copyUserId}
                    className="flex items-center gap-1 hover:text-foreground transition-colors"
                  >
                    {copied ? <CheckCircle2 className="w-3 h-3 text-green-500" /> : <Copy className="w-3 h-3" />}
                    <span className="font-mono opacity-60">{userId?.slice(-6) || '------'}</span>
                  </button>
                </div>
              </div>
            </div>
            
            <div className="flex items-center justify-between sm:justify-end gap-3">
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-green-500/10 border border-green-500/20 text-green-500 text-xs font-mono">
                <Signal className="w-3 h-3" />
                <span className="hidden sm:inline">ONLINE</span>
                <span className="sm:hidden">OK</span>
              </div>
              <button
                onClick={() => setIsCompact(!isCompact)}
                className="p-2 rounded-lg hover:bg-muted transition-colors"
              >
                {isCompact ? <Maximize2 className="w-4 h-4" /> : <Minimize2 className="w-4 h-4" />}
              </button>
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className={cn(
            "grid gap-4 sm:gap-6",
            isCompact ? "grid-cols-1" : "grid-cols-1 lg:grid-cols-12"
          )}
        >
          {/* Main Control Panel */}
          <div className={cn(
            "space-y-4 sm:space-y-6",
            isCompact ? "" : "lg:col-span-7 xl:col-span-8"
          )}>
            {/* Terminal Card */}
            <div className="relative overflow-hidden rounded-2xl border border-border bg-card/60 backdrop-blur-xl shadow-2xl">
              <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-brand-red-orange via-brand-gold to-brand-cyan" />
              
              <div className="p-4 sm:p-6 lg:p-8 space-y-4 sm:space-y-6">
                {/* Terminal Header */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 sm:gap-3">
                    <div className="p-2 rounded-lg bg-brand-cyan/10 border border-brand-cyan/20">
                      <Terminal className="w-5 h-5 sm:w-6 sm:h-6 text-brand-cyan" />
                    </div>
                    <div>
                      <h2 className="font-orbitron font-bold text-base sm:text-lg text-foreground">
                        ADMIN TERMINAL
                      </h2>
                      <p className="text-[10px] sm:text-xs text-muted-foreground font-mono">
                        v2.0 // {isAuthenticated ? 'AUTHENTICATED' : 'GUEST'}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="w-2.5 h-2.5 rounded-full bg-red-500/60" />
                    <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/60" />
                    <div className="w-2.5 h-2.5 rounded-full bg-green-500/60" />
                  </div>
                </div>

                {/* Command Grid - Adaptive layout */}
                <div className={cn(
                  "grid gap-3 sm:gap-4",
                  isCompact ? "grid-cols-3" : "grid-cols-1 sm:grid-cols-3"
                )}>
                  {COMMANDS.map((cmd, idx) => {
                    const cooldownActive = isOnCooldown(cmd.id);
                    const remaining = getRemainingTime(cmd.id);
                    const isActive = activeGlow === idx && !cooldownActive && !isSending;
                    
                    return (
                      <motion.button
                        key={cmd.id}
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: idx * 0.1 }}
                        whileHover={!cooldownActive ? { scale: 1.02, y: -2 } : {}}
                        whileTap={!cooldownActive ? { scale: 0.98 } : {}}
                        onClick={() => executeCommand(cmd)}
                        disabled={!!isSending || cooldownActive}
                        className={cn(
                          "group relative overflow-hidden rounded-xl border transition-all duration-300",
                          isCompact ? "p-3" : "p-4 sm:p-6",
                          isActive 
                            ? "shadow-[0_0_30px_rgba(236,72,153,0.2)] border-brand-pink/50" 
                            : "border-border/50 hover:border-brand-gold/50",
                          cooldownActive && "opacity-60 cursor-not-allowed",
                          isSending === cmd.id && "animate-pulse"
                        )}
                      >
                        {/* Background gradient */}
                        <motion.div 
                          className={cn(
                            "absolute inset-0 bg-gradient-to-br opacity-0 transition-opacity duration-500",
                            cmd.bgGradient
                          )}
                          animate={{ opacity: isActive ? 0.3 : 0 }}
                        />
                        
                        {/* Cooldown overlay */}
                        {cooldownActive && (
                          <div className="absolute inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center z-20">
                            <span className="font-mono text-lg font-bold text-muted-foreground">
                              {remaining}s
                            </span>
                          </div>
                        )}
                        
                        <div className="relative z-10 flex flex-col items-center gap-2 sm:gap-3">
                          <motion.div 
                            className={cn(
                              "rounded-xl flex items-center justify-center text-white shadow-lg transition-all duration-300",
                              isCompact ? "w-10 h-10" : "w-12 h-12 sm:w-14 sm:h-14",
                              cmd.color.replace('text-', 'bg-').replace('400', '500'),
                              !cooldownActive && "group-hover:shadow-xl group-hover:scale-110"
                            )}
                            whileHover={!cooldownActive ? { rotate: [0, -10, 10, 0] } : {}}
                            transition={{ duration: 0.5 }}
                          >
                            {isSending === cmd.id ? (
                              <Sparkles className={cn("animate-spin", isCompact ? "w-4 h-4" : "w-5 h-5 sm:w-6 sm:h-6")} />
                            ) : (
                              <div className={isCompact ? "w-4 h-4" : "w-5 h-5 sm:w-6 sm:h-6"}>
                                {cmd.icon}
                              </div>
                            )}
                          </motion.div>
                          
                          <div className="text-center">
                            <div className={cn(
                              "font-bold text-card-foreground",
                              isCompact ? "text-xs" : "text-sm sm:text-base"
                            )}>
                              {isCompact ? cmd.shortLabel : cmd.label}
                            </div>
                            {!isCompact && (
                              <div className="text-[10px] sm:text-xs text-muted-foreground mt-1 hidden sm:block">
                                {cmd.description}
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Priority indicator */}
                        <div className="absolute top-2 right-2">
                          <div className={cn(
                            "w-2 h-2 rounded-full",
                            cmd.priority === 3 ? "bg-red-500 animate-pulse" :
                            cmd.priority === 2 ? "bg-yellow-500" : "bg-green-500"
                          )} />
                        </div>
                      </motion.button>
                    );
                  })}
                </div>

                {/* Instructions Button */}
                <motion.div 
                  className="pt-2 sm:pt-4 border-t border-border/50"
                  whileHover={{ scale: 1.01 }}
                >
                  <Button
                    onClick={fetchInstructions}
                    variant="outline"
                    className="w-full group relative overflow-hidden border-dashed border-brand-yellow/50 hover:border-brand-yellow hover:bg-brand-yellow/5 h-12 sm:h-auto"
                  >
                    <span className="relative z-10 flex items-center justify-center gap-2 text-muted-foreground group-hover:text-brand-yellow transition-colors">
                      <Wand2 className="w-4 h-4 group-hover:animate-pulse" />
                      <span className="font-mono text-xs sm:text-sm">Инструкция по магическим кнопкам</span>
                      <ChevronRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
                    </span>
                  </Button>
                </motion.div>
              </div>
            </div>

            {/* Developer Card - Collapsible on mobile */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="relative overflow-hidden rounded-xl border border-border bg-card backdrop-blur-md p-4 sm:p-6 group hover:border-brand-yellow/30 transition-all duration-300"
            >
              <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-15 transition-opacity">
                <Zap className="w-24 h-24 sm:w-32 sm:h-32 text-brand-yellow" />
              </div>
              
              <div className="relative z-10 flex flex-col sm:flex-row gap-4 items-start sm:items-center">
                <motion.div 
                  className="bg-brand-yellow/10 p-3 rounded-xl border border-brand-yellow/20 shrink-0"
                  whileHover={{ rotate: 360 }}
                  transition={{ duration: 0.8 }}
                >
                  <Bot className="w-8 h-8 sm:w-10 sm:h-10 text-brand-yellow" />
                </motion.div>
                <div className="flex-1 space-y-2 min-w-0">
                  <h3 className="font-orbitron font-bold text-base sm:text-lg text-card-foreground flex items-center gap-2 flex-wrap">
                    Нужен автомат или склад?
                    <Sparkles className="w-4 h-4 text-brand-gold animate-pulse" />
                  </h3>
                  <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
                    Павел делает телеграм-ботов и веб-приложения. 
                    Заменит "МойСклад" от 2000₽.
                  </p>
                </div>
                <Button 
                  asChild
                  variant="outline" 
                  size="sm"
                  className="border-brand-yellow/30 text-brand-yellow hover:bg-brand-yellow/10 shrink-0 group/btn w-full sm:w-auto"
                >
                  <Link href="/wblanding" className="flex items-center justify-center gap-2">
                    Связаться
                    <ArrowUpRight className="w-4 h-4 transition-transform group-hover/btn:translate-x-0.5 group-hover/btn:-translate-y-0.5" />
                  </Link>
                </Button>
              </div>
            </motion.div>
          </div>

          {/* Sidebar - Logs & Stats */}
          <div className={cn(
            "space-y-4 sm:space-y-6",
            isCompact ? "" : "lg:col-span-5 xl:col-span-4"
          )}>
            {/* System Log Panel */}
            <div className="rounded-2xl border border-border bg-card/60 backdrop-blur-xl overflow-hidden shadow-xl">
              <div className="px-3 sm:px-4 py-2.5 sm:py-3 border-b border-border bg-muted/50 flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs font-mono text-muted-foreground">
                  <History className="w-3 h-3 sm:w-4 sm:h-4" />
                  <span className="hidden sm:inline">СИСТЕМНЫЙ ЛОГ</span>
                  <span className="sm:hidden">ЛОГ</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-muted-foreground">{logs.length} записей</span>
                  <div className="flex gap-1">
                    <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-red-500/50" />
                    <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-yellow-500/50" />
                    <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-green-500/50" />
                  </div>
                </div>
              </div>
              
              <div 
                ref={logsContainerRef}
                className="h-[250px] sm:h-[300px] lg:h-[350px] overflow-y-auto p-3 sm:p-4 font-mono text-[10px] sm:text-xs space-y-2 scrollbar-thin scrollbar-thumb-border scrollbar-track-transparent"
              >
                {logs.length === 0 ? (
                  <motion.div 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="text-muted-foreground/50 italic text-center py-8 sm:py-12 flex flex-col items-center gap-2"
                  >
                    <MousePointer2 className="w-6 h-6 sm:w-8 sm:h-8 opacity-30" />
                    <span>Ожидание команд...</span>
                  </motion.div>
                ) : (
                  <AnimatePresence mode="popLayout" initial={false}>
                    {logs.map((log, index) => (
                      <motion.div
                        key={log.id}
                        layout
                        initial={{ opacity: 0, x: -20, scale: 0.9 }}
                        animate={{ opacity: 1, x: 0, scale: 1 }}
                        exit={{ opacity: 0, x: 20, scale: 0.9 }}
                        transition={{ duration: 0.2, delay: index * 0.02 }}
                        className={cn(
                          "flex gap-2 items-start p-2 sm:p-2.5 rounded-lg border-l-2 text-[10px] sm:text-xs backdrop-blur-sm",
                          log.type === 'success' && "bg-green-500/5 border-green-500 text-green-600 dark:text-green-400",
                          log.type === 'error' && "bg-red-500/5 border-red-500 text-red-600 dark:text-red-400",
                          log.type === 'info' && "bg-blue-500/5 border-blue-500 text-blue-600 dark:text-blue-400",
                          log.type === 'warning' && "bg-yellow-500/5 border-yellow-500 text-yellow-600 dark:text-yellow-400",
                          log.type === 'command' && "bg-purple-500/5 border-purple-500 text-purple-600 dark:text-purple-400",
                        )}
                      >
                        <Clock className="w-2.5 h-2.5 sm:w-3 sm:h-3 mt-0.5 shrink-0 opacity-50" />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="opacity-40 text-[9px] sm:text-[10px]">
                              {log.timestamp.toLocaleTimeString('ru-RU', { hour12: false })}
                            </span>
                            {log.meta?.originator && (
                              <span className="text-[9px] sm:text-[10px] px-1.5 py-0.5 rounded-full bg-muted/50 truncate max-w-[100px] sm:max-w-[150px]">
                                @{log.meta.originator}
                              </span>
                            )}
                          </div>
                          <div className="mt-0.5 break-words leading-relaxed">{log.message}</div>
                        </div>
                      </motion.div>
                    ))}
                    <div ref={logsEndRef} />
                  </AnimatePresence>
                )}
              </div>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-3 gap-2 sm:gap-3">
              <motion.div 
                whileHover={{ scale: 1.05 }}
                className="p-3 sm:p-4 rounded-xl border border-border bg-card/40 backdrop-blur-sm text-center"
              >
                <div className="flex items-center justify-center gap-1 mb-1">
                  <TrendingUp className="w-3 h-3 sm:w-4 sm:h-4 text-brand-gold" />
                </div>
                <div className="text-xl sm:text-2xl font-bold text-brand-gold">{stats.total}</div>
                <div className="text-[9px] sm:text-[10px] text-muted-foreground">Успешных</div>
              </motion.div>
              <motion.div 
                whileHover={{ scale: 1.05 }}
                className="p-3 sm:p-4 rounded-xl border border-border bg-card/40 backdrop-blur-sm text-center"
              >
                <div className="flex items-center justify-center gap-1 mb-1">
                  <Terminal className="w-3 h-3 sm:w-4 sm:h-4 text-brand-cyan" />
                </div>
                <div className="text-xl sm:text-2xl font-bold text-brand-cyan">{stats.commands}</div>
                <div className="text-[9px] sm:text-[10px] text-muted-foreground">Команд</div>
              </motion.div>
              <motion.div 
                whileHover={{ scale: 1.05 }}
                className="p-3 sm:p-4 rounded-xl border border-border bg-card/40 backdrop-blur-sm text-center"
              >
                <div className="flex items-center justify-center gap-1 mb-1">
                  <Wifi className="w-3 h-3 sm:w-4 sm:h-4 text-green-500" />
                </div>
                <div className="text-xl sm:text-2xl font-bold text-green-500">
                  {isAuthenticated ? 'ON' : 'OFF'}
                </div>
                <div className="text-[9px] sm:text-[10px] text-muted-foreground">Статус</div>
              </motion.div>
            </div>

            {/* Quick Info Card */}
            <div className="p-3 sm:p-4 rounded-xl border border-border/50 bg-muted/30 backdrop-blur-sm">
              <div className="flex items-center gap-2 text-[10px] sm:text-xs text-muted-foreground">
                <Battery className="w-3 h-3 sm:w-4 sm:h-4" />
                <span>Система активна</span>
                <span className="ml-auto font-mono">{new Date().toLocaleDateString('ru-RU')}</span>
              </div>
            </div>
          </div>
        </motion.div>
      </main>

      {/* Instructions Modal - Responsive */}
      <AnimatePresence>
        {isModalOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsModalOpen(false)}
              className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50"
            />
            
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 50 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 50 }}
              className="fixed inset-2 sm:inset-4 md:inset-auto md:top-1/2 md:left-1/2 md:-translate-x-1/2 md:-translate-y-1/2 md:w-full md:max-w-4xl md:h-[85vh] z-50 bg-background border border-border rounded-2xl shadow-2xl flex flex-col overflow-hidden"
            >
              {/* Modal Header */}
              <div className="px-4 sm:px-6 py-3 sm:py-4 border-b border-border bg-muted/50 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-2 sm:gap-3">
                  <div className="p-1.5 sm:p-2 rounded-lg bg-brand-yellow/10 border border-brand-yellow/20">
                    <Wand2 className="w-4 h-4 sm:w-5 sm:h-5 text-brand-yellow" />
                  </div>
                  <div>
                    <h2 className="font-orbitron font-bold text-sm sm:text-base text-foreground">Магические инструкции</h2>
                    <p className="text-[10px] sm:text-xs text-muted-foreground font-mono">v2.0 // GitHub Raw // UTF-8</p>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setIsModalOpen(false)}
                  className="text-muted-foreground hover:text-foreground hover:bg-muted h-8 w-8 sm:h-10 sm:w-10"
                >
                  <X className="h-4 w-4 sm:h-5 sm:w-5" />
                </Button>
              </div>

              {/* Modal Content */}
              <div className="flex-1 overflow-y-auto p-4 sm:p-6 prose prose-sm max-w-none 
                prose-headings:font-orbitron prose-headings:text-brand-gold prose-headings:text-base sm:prose-headings:text-lg
                prose-a:text-brand-cyan hover:prose-a:text-brand-cyan/80 
                prose-code:text-brand-pink prose-code:bg-muted prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-code:text-xs
                prose-pre:bg-muted prose-pre:border prose-pre:border-border prose-pre:rounded-lg prose-pre:text-xs sm:prose-pre:text-sm
                prose-img:rounded-lg prose-p:text-xs sm:prose-p:text-sm prose-p:leading-relaxed">
                {isLoadingMd ? (
                  <div className="flex flex-col items-center justify-center h-40 sm:h-60 gap-4 text-muted-foreground">
                    <div className="w-8 h-8 sm:w-10 sm:h-10 border-2 border-brand-yellow/30 border-t-brand-yellow rounded-full animate-spin" />
                    <span className="font-mono text-xs sm:text-sm">Загрузка данных...</span>
                  </div>
                ) : (
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {mdContent}
                  </ReactMarkdown>
                )}
              </div>

              {/* Modal Footer */}
              <div className="px-4 sm:px-6 py-3 sm:py-4 border-t border-border bg-muted/50 flex flex-col sm:flex-row justify-between items-center gap-2 sm:gap-0 shrink-0">
                <div className="text-[10px] sm:text-xs text-muted-foreground font-mono text-center sm:text-left">
                  Кодировка: UTF-8 | Протокол: HTTPS | Сжатие: GZIP
                </div>
                <Button 
                  onClick={() => setIsModalOpen(false)}
                  className="bg-brand-yellow text-black hover:bg-brand-yellow/90 font-bold text-xs sm:text-sm w-full sm:w-auto"
                >
                  Закрыть терминал
                </Button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

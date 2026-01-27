"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence, useAnimation } from "framer-motion";
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
  User,
  Clock,
  Sparkles,
  Command,
  Activity,
  ChevronRight,
  ArrowUpRight
} from "lucide-react";
import { useAppContext } from "@/contexts/AppContext";
import { cn } from "@/lib/utils";

// GitHub Raw URL for the instructions
const INSTRUCTIONS_URL =
  "https://raw.githubusercontent.com/salavey13/carTest/main/docs/%D0%BC%D0%B0%D0%B3%D0%B8%D1%87%D0%B5%D1%81%D0%BA%D0%B0%D1%8F_%D0%BA%D0%BD%D0%BE%D0%BF%D0%BA%D0%B0_%D0%B2_cyber_vibe_studio_%D1%82%D1%83%D1%82%D0%BE%D1%80%D0%B8%D0%B0%D0%BB_%D0%B4%D0%BB%D1%8F_%D0%BD%D0%BE%D0%B2%D0%B8%D1%87%D0%BA%D0%BE%D0%B2(imgs).md ";

type LogEntry = {
  id: string;
  message: string;
  timestamp: Date;
  type: 'info' | 'success' | 'warning' | 'error';
};

type CommandButton = {
  id: string;
  label: string;
  icon: React.ReactNode;
  color: string;
  message: string;
  description: string;
  variant: 'primary' | 'danger' | 'secondary';
};

const commands: CommandButton[] = [
  {
    id: 'tea',
    label: 'Вызвать за чаем',
    icon: <Coffee className="w-5 h-5" />,
    color: 'from-amber-500 to-orange-600',
    message: 'Админ, принеси чай. ☕️',
    description: 'Стандартный запрос чая',
    variant: 'primary'
  },
  {
    id: 'urgent',
    label: 'Срочный вызов',
    icon: <AlertTriangle className="w-5 h-5" />,
    color: 'from-red-500 to-rose-600',
    message: '🚨 АДМИН! СРОЧНО НУЖЕН ЧАЙ! 🚨',
    description: 'Высокий приоритет',
    variant: 'danger'
  },
  {
    id: 'broadcast',
    label: 'Оповестить всех',
    icon: <MessageSquare className="w-5 h-5" />,
    color: 'from-cyan-500 to-blue-600',
    message: 'Всем админам: пора на чайную паузу! 🫖',
    description: 'Уведомление всей команды',
    variant: 'secondary'
  }
];

export default function TeaCallPage() {
  const { dbUser, isAuthenticated } = useAppContext();
  const [isSending, setIsSending] = useState<string | null>(null);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [mdContent, setMdContent] = useState<string>("");
  const [isLoadingMd, setIsLoadingMd] = useState(false);
  const [activeGlow, setActiveGlow] = useState<number>(0);
  const logsEndRef = useRef<HTMLDivElement>(null);
  
  const orbControls = useAnimation();

  // Auto-scroll logs
  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs]);

  // Floating orbs animation
  useEffect(() => {
    const sequence = async () => {
      while (true) {
        await orbControls.start({
          scale: [1, 1.2, 1],
          opacity: [0.3, 0.6, 0.3],
          transition: { duration: 8, ease: "easeInOut" }
        });
      }
    };
    sequence();
  }, [orbControls]);

  // Cycled glow effect
  useEffect(() => {
    const interval = setInterval(() => {
      setActiveGlow((prev) => (prev + 1) % 3);
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  const addLog = useCallback((message: string, type: LogEntry['type'] = 'info') => {
    setLogs(prev => [...prev.slice(-9), {
      id: Math.random().toString(36).substr(2, 9),
      message,
      timestamp: new Date(),
      type
    }]);
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
      if (!response.ok) throw new Error("Failed to load");
      const text = await response.text();
      setMdContent(text);
      addLog('Инструкции загружены из репозитория', 'success');
    } catch (error) {
      setMdContent("# Ошибка загрузки\nНе удалось загрузить инструкции.");
      addLog('Ошибка загрузки инструкций', 'error');
    } finally {
      setIsLoadingMd(false);
    }
  };

  const executeCommand = async (command: CommandButton) => {
    if (isSending) return;
    
    setIsSending(command.id);
    addLog(`Выполнение команды: ${command.label}...`, 'info');

    try {
      let result;
      
      if (command.id === 'broadcast') {
        result = await notifyAdmins(command.message);
      } else {
        result = await notifyAdmin(command.message);
      }

      if (result?.success) {
        addLog(`✓ ${command.label}: Успешно отправлено`, 'success');
      } else {
        addLog(`✗ ${command.label}: Ошибка отправки`, 'error');
      }
    } catch (err) {
      addLog(`✗ ${command.label}: Системная ошибка`, 'error');
    } finally {
      setIsSending(null);
    }
  };

  // Initialize with welcome message
  useEffect(() => {
    if (isAuthenticated && dbUser) {
      addLog(`Добро пожаловать, ${dbUser.username || 'Пользователь'}!`, 'info');
    } else {
      addLog('Система готова к работе', 'info');
    }
  }, [isAuthenticated, dbUser, addLog]);

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-background text-foreground relative overflow-hidden flex flex-col">
      {/* Animated Background Elements - subdued for global layout compatibility */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808008_1px,transparent_1px),linear-gradient(to_bottom,#80808008_1px,transparent_1px)] bg-[size:32px_32px] [mask-image:radial-gradient(ellipse_80%_50%_at_50%_50%,#000_70%,transparent_100%)]" />
        
        <motion.div
          animate={orbControls}
          className="absolute top-20 left-10 w-72 h-72 bg-brand-red-orange/10 rounded-full blur-[100px]"
        />
        <motion.div
          animate={{ ...orbControls, transition: { delay: 2 } }}
          className="absolute bottom-20 right-10 w-96 h-96 bg-brand-deep-indigo/10 rounded-full blur-[100px]"
        />
      </div>

      {/* Main Content - pt-8 to account for global header */}
      <main className="relative z-10 flex-1 max-w-6xl mx-auto px-4 py-8 w-full flex flex-col justify-center">
        
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="grid grid-cols-1 lg:grid-cols-3 gap-6"
        >
          {/* Main Control Panel */}
          <div className="lg:col-span-2 space-y-6">
            <div className="relative overflow-hidden rounded-2xl border border-border bg-card/60 backdrop-blur-xl shadow-2xl">
              {/* Decorative Top Border */}
              <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-brand-red-orange via-brand-gold to-brand-cyan" />
              
              <div className="p-6 sm:p-8 space-y-6">
                <div className="flex items-start justify-between">
                  <div>
                    <h1 className="text-2xl font-orbitron font-bold flex items-center gap-2 bg-gradient-to-r from-brand-gold via-brand-red-orange to-brand-deep-indigo bg-clip-text text-transparent">
                      <Terminal className="w-6 h-6 text-brand-cyan" />
                      ADMIN TERMINAL
                    </h1>
                    <p className="text-muted-foreground mt-1 font-mono text-sm">
                      Удаленное управление администрацией
                    </p>
                  </div>
                  <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-brand-gold/10 border border-brand-gold/20 text-brand-gold text-xs font-mono">
                    <Activity className="w-3 h-3 animate-pulse" />
                    ONLINE
                  </div>
                </div>

                {/* Command Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  {commands.map((cmd, idx) => (
                    <motion.div
                      key={cmd.id}
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: idx * 0.1 }}
                    >
                      <button
                        onClick={() => executeCommand(cmd)}
                        disabled={!!isSending}
                        className={cn(
                          "group relative w-full p-4 rounded-xl border transition-all duration-300 overflow-hidden",
                          activeGlow === idx 
                            ? "shadow-[0_0_30px_rgba(236,72,153,0.15)] border-brand-pink/50" 
                            : "border-border/50 hover:border-brand-gold/50",
                          isSending === cmd.id && "opacity-80 cursor-wait"
                        )}
                      >
                        <div className={cn(
                          "absolute inset-0 bg-gradient-to-br opacity-0 group-hover:opacity-5 transition-opacity duration-300",
                          cmd.color
                        )} />
                        
                        <div className="relative z-10 flex flex-col items-center gap-3">
                          <div className={cn(
                            "w-12 h-12 rounded-lg bg-gradient-to-br flex items-center justify-center text-white shadow-lg transition-transform duration-300 group-hover:scale-110",
                            cmd.color,
                            isSending === cmd.id && "animate-pulse"
                          )}>
                            {isSending === cmd.id ? (
                              <Sparkles className="w-6 h-6 animate-spin" />
                            ) : (
                              cmd.icon
                            )}
                          </div>
                          
                          <div className="text-center">
                            <div className="font-bold text-sm text-card-foreground">{cmd.label}</div>
                            <div className="text-xs text-muted-foreground mt-1">{cmd.description}</div>
                          </div>
                        </div>
                      </button>
                    </motion.div>
                  ))}
                </div>

                {/* Magic Button Row */}
                <div className="pt-4 border-t border-border/50">
                  <Button
                    onClick={fetchInstructions}
                    variant="outline"
                    className="w-full group relative overflow-hidden border-dashed border-brand-yellow/50 hover:border-brand-yellow hover:bg-brand-yellow/5"
                  >
                    <span className="relative z-10 flex items-center justify-center gap-2 text-muted-foreground group-hover:text-brand-yellow transition-colors">
                      <Wand2 className="w-4 h-4 group-hover:animate-pulse" />
                      <span className="font-mono text-sm">Открыть инструкцию по магическим кнопкам</span>
                      <ChevronRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
                    </span>
                  </Button>
                </div>
              </div>
            </div>

            {/* Developer Card - Theme Aware */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="relative overflow-hidden rounded-xl border border-border bg-card backdrop-blur-md p-6 group hover:border-brand-yellow/30 transition-colors"
            >
              <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                <Zap className="w-20 h-20 text-brand-yellow" />
              </div>
              
              <div className="relative z-10 flex flex-col sm:flex-row gap-4 items-start sm:items-center">
                <div className="bg-brand-yellow/10 p-3 rounded-xl border border-brand-yellow/20 shrink-0">
                  <Bot className="w-8 h-8 text-brand-yellow" />
                </div>
                <div className="flex-1 space-y-2">
                  <h3 className="font-orbitron font-bold text-lg text-card-foreground flex items-center gap-2">
                    Нужен автомат или склад?
                    <Sparkles className="w-4 h-4 text-brand-gold animate-pulse" />
                  </h3>
                  <p className="text-sm text-muted-foreground leading-relaxed max-w-xl">
                    Привет! Я Павел. Делаю телеграм-ботов и веб-приложения (не на Python). 
                    Заменю платный "МойСклад" и помогу с автоматизацией от 2000₽.
                  </p>
                </div>
                <Button 
                  asChild
                  variant="outline" 
                  size="sm"
                  className="border-brand-yellow/30 text-brand-yellow hover:bg-brand-yellow/10 shrink-0 group/btn"
                >
                  <Link href="/wblanding" className="flex items-center gap-2">
                    Связаться
                    <ArrowUpRight className="w-4 h-4 transition-transform group-hover/btn:translate-x-0.5 group-hover/btn:-translate-y-0.5" />
                  </Link>
                </Button>
              </div>
            </motion.div>
          </div>

          {/* Sidebar - Logs & Status */}
          <div className="space-y-6">
            {/* Status Panel */}
            <div className="rounded-2xl border border-border bg-card/60 backdrop-blur-xl overflow-hidden shadow-xl">
              <div className="px-4 py-3 border-b border-border bg-muted/50 flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs font-mono text-muted-foreground">
                  <Terminal className="w-3 h-3" />
                  СИСТЕМНЫЙ ЛОГ
                </div>
                <div className="flex gap-1.5">
                  <div className="w-2 h-2 rounded-full bg-red-500/50" />
                  <div className="w-2 h-2 rounded-full bg-yellow-500/50" />
                  <div className="w-2 h-2 rounded-full bg-green-500/50" />
                </div>
              </div>
              
              <div className="h-[300px] overflow-y-auto p-4 font-mono text-xs space-y-2 scrollbar-thin scrollbar-thumb-border scrollbar-track-transparent">
                {logs.length === 0 ? (
                  <div className="text-muted-foreground/50 italic text-center py-8">
                    Ожидание команд...
                  </div>
                ) : (
                  <AnimatePresence initial={false}>
                    {logs.map((log) => (
                      <motion.div
                        key={log.id}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: 10 }}
                        className={cn(
                          "flex gap-2 items-start p-2 rounded border-l-2 text-xs",
                          log.type === 'success' && "bg-green-500/5 border-green-500 text-green-600 dark:text-green-400",
                          log.type === 'error' && "bg-red-500/5 border-red-500 text-red-600 dark:text-red-400",
                          log.type === 'info' && "bg-blue-500/5 border-blue-500 text-blue-600 dark:text-blue-400",
                          log.type === 'warning' && "bg-yellow-500/5 border-yellow-500 text-yellow-600 dark:text-yellow-400",
                        )}
                      >
                        <Clock className="w-3 h-3 mt-0.5 shrink-0 opacity-50" />
                        <div className="flex-1 break-words">
                          <span className="opacity-50 text-[10px]">
                            {log.timestamp.toLocaleTimeString()} 
                          </span>
                          <div className="mt-0.5">{log.message}</div>
                        </div>
                      </motion.div>
                    ))}
                    <div ref={logsEndRef} />
                  </AnimatePresence>
                )}
              </div>
            </div>

            {/* Quick Stats */}
            <div className="grid grid-cols-2 gap-3">
              <div className="p-4 rounded-xl border border-border bg-card/40 backdrop-blur-sm">
                <div className="text-2xl font-bold text-brand-gold">{commands.length}</div>
                <div className="text-xs text-muted-foreground mt-1">Доступные команды</div>
              </div>
              <div className="p-4 rounded-xl border border-border bg-card/40 backdrop-blur-sm">
                <div className="text-2xl font-bold text-brand-cyan">{logs.filter(l => l.type === 'success').length}</div>
                <div className="text-xs text-muted-foreground mt-1">Успешных вызовов</div>
              </div>
            </div>
          </div>
        </motion.div>
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
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
            />
            
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="fixed inset-4 md:inset-auto md:top-1/2 md:left-1/2 md:-translate-x-1/2 md:-translate-y-1/2 md:w-full md:max-w-3xl md:h-[80vh] z-50 bg-background border border-border rounded-2xl shadow-2xl flex flex-col overflow-hidden"
            >
              {/* Modal Header */}
              <div className="px-6 py-4 border-b border-border flex items-center justify-between bg-muted/50">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-brand-yellow/10 border border-brand-yellow/20">
                    <Wand2 className="w-5 h-5 text-brand-yellow" />
                  </div>
                  <div>
                    <h2 className="font-orbitron font-bold text-foreground">Магические инструкции</h2>
                    <p className="text-xs text-muted-foreground font-mono">v1.0 // GitHub Raw</p>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setIsModalOpen(false)}
                  className="text-muted-foreground hover:text-foreground hover:bg-muted"
                >
                  <X className="h-5 w-5" />
                </Button>
              </div>

              {/* Modal Content */}
              <div className="flex-1 overflow-y-auto p-6 prose prose-sm max-w-none 
                prose-headings:font-orbitron prose-headings:text-brand-gold 
                prose-a:text-brand-cyan hover:prose-a:text-brand-cyan/80 
                prose-code:text-brand-pink prose-code:bg-muted prose-code:px-1 prose-code:py-0.5 prose-code:rounded 
                prose-pre:bg-muted prose-pre:border prose-pre:border-border prose-img:rounded-lg">
                {isLoadingMd ? (
                  <div className="flex flex-col items-center justify-center h-40 gap-4 text-muted-foreground">
                    <div className="w-8 h-8 border-2 border-brand-yellow/30 border-t-brand-yellow rounded-full animate-spin" />
                    <span className="font-mono text-sm">Загрузка данных...</span>
                  </div>
                ) : (
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {mdContent}
                  </ReactMarkdown>
                )}
              </div>

              {/* Modal Footer */}
              <div className="px-6 py-4 border-t border-border bg-muted/50 flex justify-between items-center">
                <div className="text-xs text-muted-foreground font-mono">
                  Кодировка: UTF-8 | Протокол: HTTPS
                </div>
                <Button 
                  onClick={() => setIsModalOpen(false)}
                  className="bg-brand-yellow text-black hover:bg-brand-yellow/90 font-bold"
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
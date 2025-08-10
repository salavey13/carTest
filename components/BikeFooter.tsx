"use client";

import { useState, useEffect, useRef } from "react"; // <-- Добавляем useRef
import Link from "next/link";
import { FaInstagram, FaTelegram, FaVk, FaPhone, FaMapLocationDot } from "react-icons/fa6";
import { VibeContentRenderer } from "@/components/VibeContentRenderer";
import { useTheme } from "next-themes";
import { useAppContext } from "@/contexts/AppContext";
import { updateUserMetadata } from "@/hooks/supabase";
import { toast } from "sonner";
import { AnimatePresence, motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

export default function BikeFooter() {
  const { dbUser, refreshDbUser } = useAppContext();
  const { theme, setTheme, resolvedTheme } = useTheme();
  
  const [isSavingTheme, setIsSavingTheme] = useState(false);
  const isInitialThemeSet = useRef(false); // Флаг, чтобы useEffect сработал только один раз

  // ИСПРАВЛЕННЫЙ useEffect: Устанавливает тему из БД только один раз при загрузке
  useEffect(() => {
    if (dbUser && !isInitialThemeSet.current) {
      const userTheme = dbUser.metadata?.theme as 'light' | 'dark' | undefined;
      if (userTheme && userTheme !== resolvedTheme) {
        setTheme(userTheme);
      }
      isInitialThemeSet.current = true; // Отмечаем, что начальная тема установлена
    }
  }, [dbUser, setTheme, resolvedTheme]);

  // Отполированный обработчик: теперь он надежен
  const handleThemeToggle = async () => {
    if (isSavingTheme) return;

    const newTheme = resolvedTheme === 'dark' ? 'light' : 'dark';
    const oldTheme = resolvedTheme;

    // 1. Мгновенно меняем тему в UI
    setTheme(newTheme);

    // 2. Если нет пользователя, просто меняем тему и выходим
    if (!dbUser?.user_id) return;
    
    // 3. Сохраняем в БД
    setIsSavingTheme(true);
    const updatedMetadata = { ...(dbUser.metadata || {}), theme: newTheme };
    const { success, error } = await updateUserMetadata(dbUser.user_id, updatedMetadata);

    if (success) {
      toast.success(`Тема сохранена: ${newTheme === 'dark' ? 'Темная' : 'Светлая'}`);
      // refreshDbUser() здесь больше не нужен, он вызывал конфликт.
      // Контекст обновится сам, когда пользователь перейдет на другую страницу.
    } else {
      toast.error(`Ошибка сохранения: ${error}`);
      setTheme(oldTheme || 'dark'); // В случае ошибки откатываем тему обратно
    }
    
    setIsSavingTheme(false);
  };
  
  const footerLinkClass = "text-sm text-muted-foreground hover:text-primary transition-colors duration-200 flex items-center gap-2";
  
  return (
    <footer className={cn("bg-card py-10 md:py-12 border-t border-border", "mb-16 sm:mb-0")}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 md:gap-10">
          <div><h3 className="text-xl font-orbitron font-semibold text-brand-orange cyber-text glitch mb-4" data-text="VIP BIKE RENTAL">VIP BIKE RENTAL</h3><p className="text-xs text-muted-foreground font-mono leading-relaxed">Аренда мотоциклов в Нижнем Новгороде. Твой байк на любой вкус: от дерзких нейкедов до спортбайков. Выбери свой вайб и покори город.</p></div>
          <div><h3 className="text-xl font-orbitron font-semibold text-brand-cyan cyber-text glitch mb-4" data-text="РАЗДЕЛЫ">РАЗДЕЛЫ</h3><ul className="space-y-3"><li><Link href="/rent-bike" className={`${footerLinkClass} text-base font-semibold`}><VibeContentRenderer content="::FaMotorcycle::" /> Мотопарк</Link></li><li><Link href="/leaderboard" className={footerLinkClass}><VibeContentRenderer content="::FaTrophy::" /> Зал Славы</Link></li><li><Link href="/crews" className={footerLinkClass}><VibeContentRenderer content="::FaUsers::" /> Экипажи</Link></li><li><Link href="/vipbikerental" className={footerLinkClass}><VibeContentRenderer content="::FaCircleInfo::" /> О Нас</Link></li></ul></div>
          <div><h3 className="text-xl font-orbitron font-semibold text-brand-pink cyber-text glitch mb-4" data-text="СОЦСЕТИ">СОЦСЕТИ</h3><ul className="space-y-2.5"><li><a href="https://vk.com/vip_bike" target="_blank" rel="noopener noreferrer" className={footerLinkClass}><FaVk className="w-4 h-4" /> VK Group</a></li><li><a href="https://www.instagram.com/vipbikerental_nn" target="_blank" rel="noopener noreferrer" className={footerLinkClass}><FaInstagram className="w-4 h-4" /> Instagram</a></li><li><a href="https://t.me/oneBikePlsBot" target="_blank" rel="noopener noreferrer" className={footerLinkClass}><FaTelegram className="w-4 h-4" /> Telegram Бот</a></li></ul></div>
          <div><h3 className="text-xl font-orbitron font-semibold text-brand-yellow cyber-text glitch mb-4" data-text="СВЯЗЬ">СВЯЗЬ</h3><ul className="space-y-2.5"><li><a href="https://t.me/I_O_S_NN" target="_blank" rel="noopener noreferrer" className={footerLinkClass}><FaTelegram className="w-4 h-4" /> @I_O_S_NN</a></li><li><a href="tel:+79200789888" className={footerLinkClass}><FaPhone className="w-4 h-4" /> +7 9200-789-888</a></li><li className={`${footerLinkClass} items-start`}><FaMapLocationDot className="w-4 h-4 mt-1 flex-shrink-0" /><span>Н. Н. Стригинский переулок 13Б</span></li></ul></div>
        </div>

        <div className="mt-10 md:mt-12 pt-6 border-t border-border/50">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4 text-muted-foreground font-mono text-xs">
            <p>© {new Date().getFullYear()} Vip Bike Rental NN</p>
            
            <div className="flex items-center gap-4">
                <p>Powered by <a href="https://t.me/oneSitePlsBot" target="_blank" rel="noopener noreferrer" className="text-brand-green hover:text-glow hover:underline">oneSitePls</a> :: @SALAVEY13</p>
                
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                          onClick={handleThemeToggle}
                          disabled={isSavingTheme}
                          className="p-2 rounded-full hover:bg-muted transition-all duration-200 active:scale-90 disabled:cursor-not-allowed disabled:opacity-50"
                          aria-label={`Switch to ${resolvedTheme === 'dark' ? 'light' : 'dark'} mode`}
                      >
                          <AnimatePresence mode="wait" initial={false}>
                              <motion.span
                                  key={isSavingTheme ? 'saving' : resolvedTheme}
                                  initial={{ y: -10, opacity: 0, rotate: -30 }}
                                  animate={{ y: 0, opacity: 1, rotate: 0 }}
                                  exit={{ y: 10, opacity: 0, rotate: 30 }}
                                  transition={{ type: "spring", stiffness: 300, damping: 20 }}
                                  className="inline-block"
                              >
                                {isSavingTheme ? 
                                    <VibeContentRenderer content="::FaSpinner::" className="animate-spin text-muted-foreground h-4 w-4" /> 
                                    : resolvedTheme === 'dark' ? 
                                      <VibeContentRenderer content="::FaBolt::" className="icon-animate-bolt text-brand-yellow h-4 w-4" />
                                      : <VibeContentRenderer content="::FaLightbulb::" className="icon-animate-light text-brand-deep-indigo h-4 w-4" />
                                  }
                              </motion.span>
                          </AnimatePresence>
                      </button>
                    </TooltipTrigger>
                    <TooltipContent><p>{isSavingTheme ? "Сохранение..." : "Сменить тему"}</p></TooltipContent>
                  </Tooltip>
                </TooltipProvider>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
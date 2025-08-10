"use client";

import Link from "next/link";
import { FaInstagram, FaTelegram, FaVk, FaPhone, FaMapLocationDot } from "react-icons/fa6";
import { VibeContentRenderer } from "@/components/VibeContentRenderer";
import { useTheme } from "next-themes";
import { useAppContext } from "@/contexts/AppContext";
import { updateUserMetadata } from "@/hooks/supabase";
import { useEffect } from "react";
import { toast } from "sonner";
import { AnimatePresence, motion } from "framer-motion";
import { cn } from "@/lib/utils";

export default function BikeFooter() {
  const { dbUser, refreshDbUser } = useAppContext();
  // *** ИСПРАВЛЕНИЕ ЛОГИКИ: theme - главный источник правды для UI ***
  // Локальное состояние `currentTheme` больше не нужно.
  const { theme, setTheme, resolvedTheme } = useTheme();

  // Этот useEffect синхронизирует тему из БД при первой загрузке
  useEffect(() => {
    const userTheme = dbUser?.metadata?.theme as 'light' | 'dark' | undefined;
    if (userTheme && userTheme !== theme) {
      setTheme(userTheme);
    }
  }, [dbUser, theme, setTheme]);

  const handleThemeChange = async (newTheme: 'light' | 'dark') => {
    // 1. Мгновенно меняем тему в UI
    setTheme(newTheme);

    // 2. Если пользователь не авторизован, просто выходим
    if (!dbUser?.user_id) {
      return;
    }
    
    // 3. Асинхронно сохраняем выбор в БД
    const currentMetadata = dbUser.metadata || {};
    // Не сохраняем, если тема уже такая
    if (currentMetadata.theme === newTheme) return;

    const updatedMetadata = { ...currentMetadata, theme: newTheme };
    const { success, error } = await updateUserMetadata(dbUser.user_id, updatedMetadata);

    if (success) {
      toast.success(`Тема сохранена: ${newTheme === 'dark' ? 'Темная' : 'Светлая'}`);
      // Обновляем данные пользователя в контексте, чтобы metadata была актуальной
      await refreshDbUser();
    } else {
      toast.error(`Ошибка сохранения темы: ${error}`);
      // Если сохранение не удалось, откатываем тему обратно
      setTheme(theme || 'dark');
    }
  };

  const toggleTheme = () => {
    const newTheme = resolvedTheme === 'dark' ? 'light' : 'dark';
    handleThemeChange(newTheme);
  };
  
  const footerLinkClass = "text-sm text-muted-foreground hover:text-primary transition-colors duration-200 flex items-center gap-2";
  
  return (
    // *** ГЛАВНОЕ ИСПРАВЛЕНИЕ СТИЛЕЙ ***
    // Заменяем `bg-dark-bg` на `bg-card` и `border-brand-orange` на `border-border`
    <footer className={cn(
        "bg-card py-10 md:py-12 border-t border-border",
        "mb-16 sm:mb-0" // Отступ от нижнего навбара на мобильных
    )}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 md:gap-10">
          
          <div>
            <h3 className="text-xl font-orbitron font-semibold text-brand-orange cyber-text glitch mb-4" data-text="VIP BIKE RENTAL">
              VIP BIKE RENTAL
            </h3>
            <p className="text-xs text-muted-foreground font-mono leading-relaxed">
              Аренда мотоциклов в Нижнем Новгороде. Твой байк на любой вкус: от дерзких нейкедов до спортбайков. Выбери свой вайб и покори город.
            </p>
          </div>

          <div>
            <h3 className="text-xl font-orbitron font-semibold text-brand-cyan cyber-text glitch mb-4" data-text="РАЗДЕЛЫ">РАЗДЕЛЫ</h3>
            <ul className="space-y-3">
              <li><Link href="/rent-bike" className={`${footerLinkClass} text-base font-semibold`}><VibeContentRenderer content="::FaMotorcycle::" /> Мотопарк</Link></li>
              <li><Link href="/leaderboard" className={footerLinkClass}><VibeContentRenderer content="::FaTrophy::" /> Зал Славы</Link></li>
              <li><Link href="/crews" className={footerLinkClass}><VibeContentRenderer content="::FaUsers::" /> Экипажи</Link></li>
              <li><Link href="/vipbikerental" className={footerLinkClass}><VibeContentRenderer content="::FaCircleInfo::" /> О Нас</Link></li>
            </ul>
          </div>

          <div>
            <h3 className="text-xl font-orbitron font-semibold text-brand-pink cyber-text glitch mb-4" data-text="СОЦСЕТИ">СОЦСЕТИ</h3>
            <ul className="space-y-2.5">
              <li><a href="https://vk.com/vip_bike" target="_blank" rel="noopener noreferrer" className={footerLinkClass}><FaVk className="w-4 h-4" /> VK Group</a></li>
              <li><a href="https://www.instagram.com/vipbikerental_nn" target="_blank" rel="noopener noreferrer" className={footerLinkClass}><FaInstagram className="w-4 h-4" /> Instagram</a></li>
              <li><a href="https://t.me/oneBikePlsBot" target="_blank" rel="noopener noreferrer" className={footerLinkClass}><FaTelegram className="w-4 h-4" /> Telegram Бот</a></li>
            </ul>
          </div>

          <div>
             <h3 className="text-xl font-orbitron font-semibold text-brand-yellow cyber-text glitch mb-4" data-text="СВЯЗЬ">СВЯЗЬ</h3>
             <ul className="space-y-2.5">
                <li><a href="https://t.me/I_O_S_NN" target="_blank" rel="noopener noreferrer" className={footerLinkClass}><FaTelegram className="w-4 h-4" /> @I_O_S_NN</a></li>
                <li><a href="tel:+79200789888" className={footerLinkClass}><FaPhone className="w-4 h-4" /> +7 9200-789-888</a></li>
                <li className={`${footerLinkClass} items-start`}><FaMapLocationDot className="w-4 h-4 mt-1 flex-shrink-0" /><span>Н. Н. Стригинский переулок 13Б</span></li>
             </ul>
          </div>
        </div>

        <div className="mt-10 md:mt-12 pt-6 border-t border-border/50">
          <div className="flex flex-col md:flex-row justify-between items-center gap-3 text-muted-foreground font-mono text-xs">
            <p>© {new Date().getFullYear()} Vip Bike Rental NN</p>
            
            <div className="flex items-center gap-2">
                <button
                    onClick={toggleTheme}
                    className="flex items-center gap-2 cursor-pointer group"
                    aria-label={`Switch to ${resolvedTheme === 'dark' ? 'light' : 'dark'} mode`}
                >
                    <AnimatePresence mode="wait" initial={false}>
                        <motion.span
                            key={resolvedTheme}
                            initial={{ y: -10, opacity: 0 }}
                            animate={{ y: 0, opacity: 1 }}
                            exit={{ y: 10, opacity: 0 }}
                            transition={{ duration: 0.2 }}
                            className="inline-block"
                        >
                           {resolvedTheme === 'dark' ? 
                                <VibeContentRenderer content="::FaBolt::" className="icon-animate-bolt text-brand-yellow group-hover:text-yellow-300 transition-colors h-4 w-4" />
                                : <VibeContentRenderer content="::FaLightbulb::" className="icon-animate-light text-brand-deep-indigo group-hover:text-foreground transition-colors h-4 w-4" />
                            }
                        </motion.span>
                    </AnimatePresence>
                    <p className="transition-colors group-hover:text-primary">Powered by <a href="https://t.me/oneSitePlsBot" target="_blank" rel="noopener noreferrer" className="text-brand-green hover:text-glow hover:underline">oneSitePls</a> :: @SALAVEY13</p>
                </button>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
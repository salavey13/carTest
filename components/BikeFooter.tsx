"use client";

import Link from "next/link";
import { FaInstagram, FaTelegram, FaVk, FaPhone, FaMapLocationDot } from "react-icons/fa6";
import { VibeContentRenderer } from "@/components/VibeContentRenderer";
import { useTheme } from "next-themes";
import { useAppContext } from "@/contexts/AppContext";
import { updateUserMetadata } from "@/hooks/supabase";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { AnimatePresence, motion } from "framer-motion";
import { cn } from "@/lib/utils";

export default function BikeFooter() {
  const { dbUser, refreshDbUser } = useAppContext();
  const { theme, setTheme } = useTheme();
  const [currentTheme, setCurrentTheme] = useState<'light' | 'dark'>('dark');

  useEffect(() => {
    const userTheme = dbUser?.metadata?.theme as 'light' | 'dark' | undefined;
    const initialTheme = userTheme || 'dark';
    
    setCurrentTheme(initialTheme);
    
    if (theme !== initialTheme) {
      setTheme(initialTheme);
    }

    if (!userTheme && dbUser?.user_id) {
      handleThemeChange(initialTheme, true);
    }
  }, [dbUser, theme, setTheme]);

  const handleThemeChange = async (newTheme: 'light' | 'dark', isSilent = false) => {
    if (!dbUser?.user_id) {
      if (!isSilent) toast.error("Не удалось сохранить тему: пользователь не авторизован.");
      return;
    }
    
    setCurrentTheme(newTheme);
    setTheme(newTheme);

    const currentMetadata = dbUser.metadata || {};
    const updatedMetadata = { ...currentMetadata, theme: newTheme };

    const { success, error } = await updateUserMetadata(dbUser.user_id, updatedMetadata);

    if (success) {
      if (!isSilent) toast.success(`Тема сохранена: ${newTheme === 'dark' ? 'Темная' : 'Светлая'}`);
      await refreshDbUser();
    } else {
      if (!isSilent) toast.error(`Ошибка сохранения темы: ${error}`);
      const oldTheme = newTheme === 'dark' ? 'light' : 'dark';
      setCurrentTheme(oldTheme);
      setTheme(oldTheme);
    }
  };

  const toggleTheme = () => {
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    handleThemeChange(newTheme);
  };
  
  const footerLinkClass = "text-sm text-muted-foreground hover:text-brand-cyan font-mono flex items-center gap-2 transition-colors duration-200 hover:text-glow";
  
  return (
    // --- ИЗМЕНЕНИЕ ЗДЕСЬ ---
    // Добавляем mb-16 (margin-bottom: 4rem) на мобильных, чтобы был отступ от навбара
    <footer className={cn("bg-dark-bg py-10 md:py-12 border-t-2 border-brand-orange/30 mb-16 sm:mb-0")}>
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

        <div className="mt-10 md:mt-12 pt-6 border-t border-brand-orange/20">
          <div className="flex flex-col md:flex-row justify-between items-center gap-3 text-muted-foreground font-mono text-xs">
            <p>© {new Date().getFullYear()} Vip Bike Rental NN</p>
            
            <div className="flex items-center gap-2">
                <button
                    onClick={toggleTheme}
                    className="flex items-center gap-2 cursor-pointer group"
                    aria-label={`Switch to ${currentTheme === 'dark' ? 'light' : 'dark'} mode`}
                >
                    <AnimatePresence mode="wait" initial={false}>
                        <motion.span
                            key={currentTheme}
                            initial={{ y: -10, opacity: 0 }}
                            animate={{ y: 0, opacity: 1 }}
                            exit={{ y: 10, opacity: 0 }}
                            transition={{ duration: 0.2 }}
                            className="inline-block"
                        >
                           {currentTheme === 'dark' ? 
                             <VibeContentRenderer content="::FaBolt::" className="text-brand-yellow group-hover:text-yellow-300 transition-colors h-4 w-4" /> : 
                             <VibeContentRenderer content="::FaLightbulb::" className="text-brand-deep-indigo group-hover:text-black transition-colors h-4 w-4" />
                           }
                        </motion.span>
                    </AnimatePresence>
                    <p className="transition-colors group-hover:text-brand-cyan">Powered by <a href="https://t.me/oneSitePlsBot" target="_blank" rel="noopener noreferrer" className="text-brand-cyan hover:text-glow hover:underline">oneSitePls</a> :: @SALAVEY13</p>
                </button>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
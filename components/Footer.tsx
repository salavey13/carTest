"use client";

import { motion } from "framer-motion";
import { Gift, Heart, ExternalLink, Send, Code, Lock, Sparkles, ShieldQuestion } from "lucide-react"; // Added ShieldQuestion
import { useAppContext } from "@/contexts/AppContext";
import Link from "next/link";
import { FaGithub } from "react-icons/fa6"; // For GitHub icon

export default function Footer() {
  const { tg, isInTelegramContext } = useAppContext();

  const handleShare = () => {
    const shareUrl = "https://t.me/share/url?url=" + encodeURIComponent("https://t.me/oneSitePlsBot/Friends") + "&text=" + encodeURIComponent("Зацени oneSitePls - твой AI-Dev ассистент в Telegram!");
    if (isInTelegramContext && tg) {
      tg.openLink(shareUrl);
    } else {
      window.open(shareUrl, "_blank");
    }
  };

  const footerLinkClass = "text-sm text-muted-foreground hover:text-brand-cyan font-mono flex items-center gap-2 transition-colors duration-200 hover:text-glow";
  const importantLinkClass = "text-lg font-orbitron text-gradient font-semibold flex items-center justify-center gap-2 transition-all duration-300 hover:brightness-125 hover:scale-105 text-glow shadow-[0_0_15px_var(--tw-shadow-color)] hover:shadow-[0_0_25px_var(--tw-shadow-color)] px-4 py-2 rounded-lg border";
  
  return (
    <footer className="bg-dark-bg py-10 md:py-16 border-t-2 border-brand-purple/30">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 md:gap-12">
          
          <div>
            <h3 className="text-xl font-orbitron font-semibold text-brand-purple cyber-text glitch mb-5" data-text="ONE SITE PLS">
              ONE SITE PLS
            </h3>
            <p className="text-sm text-muted-foreground font-mono leading-relaxed">
              Твоя AI-Dev студия и самоулучшающаяся платформа. Создавай, обновляй, управляй кодом и контентом прямо из Telegram. Магия CyberVibe в каждом клике!
            </p>
          </div>

          <div>
            <h3 className="text-xl font-orbitron font-semibold text-brand-cyan cyber-text glitch mb-5" data-text="КЛЮЧЕВЫЕ МОДУЛИ">
              КЛЮЧЕВЫЕ МОДУЛИ
            </h3>
            <ul className="space-y-3.5">
              <li>
                 <Link href="/repo-xml" className={`${importantLinkClass} border-brand-purple/60 hover:border-brand-purple [--tw-shadow-color:theme(colors.brand-purple/70%)] bg-purple-950/30 hover:bg-purple-900/40`}>
                   <Sparkles className="w-5 h-5 text-brand-yellow animate-[pulse_2s_infinite]" /> SUPERVIBE Studio ✨
                 </Link>
               </li>
               <li>
                 <Link href="/jumpstart" className={`${importantLinkClass} border-brand-green/60 hover:border-brand-green [--tw-shadow-color:theme(colors.brand-green/70%)] bg-green-950/30 hover:bg-green-900/40`}>
                   <Sparkles className="w-5 h-5 text-neon-lime animate-[pulse_2.2s_infinite_0.2s]" /> JUMPSTART Kit 🚀
                 </Link>
               </li>
                 <li><Link href="/selfdev/gamified" className={footerLinkClass}><Sparkles className="w-4 h-4 text-brand-pink"/>CyberDev OS</Link></li>
                 <li><Link href="/p-plan" className={footerLinkClass}><Code className="w-4 h-4 text-brand-yellow"/>VIBE План</Link></li>
            </ul>
          </div>

          <div>
            <h3 className="text-xl font-orbitron font-semibold text-brand-pink cyber-text glitch mb-5" data-text="РЕСУРСЫ">
              РЕСУРСЫ
            </h3>
            <ul className="space-y-3">
              <li><Link href="/about" className={footerLinkClass}><ExternalLink className="w-4 h-4" />О Проекте</Link></li>
              <li><a href="https://t.me/oneSitePlsBot" target="_blank" rel="noopener noreferrer" className={footerLinkClass}><Send className="w-4 h-4" />Telegram Бот</a></li>
              <li><a href="https://github.com/salavey13/carTest" target="_blank" rel="noopener noreferrer" className={footerLinkClass}><FaGithub className="w-4 h-4" />GitHub Репозиторий</a></li>
              <li><Link href="/donate" className={footerLinkClass}><Heart className="w-4 h-4 text-brand-red" />Поддержать Vibe</Link></li>
            </ul>
          </div>

          <div>
             <h3 className="text-xl font-orbitron font-semibold text-brand-yellow cyber-text glitch mb-5" data-text="СВЯЗЬ">
               СВЯЗЬ
             </h3>
             <motion.button
               whileHover={{ scale: 1.03, boxShadow: "0 0 20px theme(colors.brand-yellow / 0.6)" }}
               whileTap={{ scale: 0.97 }}
               onClick={handleShare}
               className="w-full bg-gradient-to-r from-brand-yellow to-brand-orange text-black hover:shadow-brand-yellow/50 p-3.5 rounded-xl font-orbitron text-lg shadow-lg transition-all flex items-center justify-center gap-2.5 text-glow"
             >
               {isInTelegramContext ? (
                 <><Gift className="w-5 h-5" /><span>Шарить oneSitePls</span></>
               ) : (
                 <><Send className="w-5 h-5" /><span>Открыть в Telegram</span></>
               )}
             </motion.button>
             <p className="text-xs text-muted-foreground font-mono mt-4 text-center">
               Поделись магией с друзьями или открой бота для старта!
             </p>
          </div>
        </div>

        <div className="mt-12 md:mt-16 pt-8 border-t border-brand-purple/20">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4 text-muted-foreground font-mono text-xs sm:text-sm">
            <p>© {new Date().getFullYear()} oneSitePls <span className="text-brand-purple mx-1">::</span> Powered by CyberVibe <span className="text-brand-purple mx-1">::</span> @SALAVEY13</p>
            <div className="flex items-center gap-4 sm:gap-6">
              <Link href="/privacy-policy" className={footerLinkClass}><ShieldQuestion className="w-3.5 h-3.5"/>Конфиденциальность</Link>
              <Link href="https://github.com/salavey13/carTest/blob/main/LICENSE" target="_blank" rel="noopener noreferrer" className={footerLinkClass}><Lock className="w-3.5 h-3.5"/>Лицензия (MIT)</Link>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
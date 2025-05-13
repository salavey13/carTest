"use client";

import { motion } from "framer-motion";
import { Gift, Heart, ExternalLink, Send, Code, Lock, Sparkles, ShieldQuestion, FileText } from "lucide-react";
import { useAppContext } from "@/contexts/AppContext";
import Link from "next/link";
import { FaGithub, FaTelegram } from "react-icons/fa6"; 
import { usePathname } from "next/navigation"; 

export default function Footer() {
  const { tg, isInTelegramContext } = useAppContext();
  const pathname = usePathname(); 

  // Логика скрытия футера на '/finance-literacy-memo' УДАЛЕНА
  // if (pathname === '/finance-literacy-memo') {
  //   return null;
  // }

  const handleShare = () => {
    const shareUrl = "https://t.me/share/url?url=" + encodeURIComponent("https://t.me/oneSitePlsBot/app") + "&text=" + encodeURIComponent("Зацени oneSitePls - твой AI-Dev ассистент в Telegram!");
    if (isInTelegramContext && tg) {
      tg.openLink(shareUrl);
    } else {
      window.open(shareUrl, "_blank");
    }
  };

  const footerLinkClass = "text-sm text-muted-foreground hover:text-brand-cyan font-mono flex items-center gap-1.5 transition-colors duration-200 hover:text-glow";
  const importantLinkClass = "text-base font-orbitron text-gradient font-semibold flex items-center justify-center gap-2 transition-all duration-300 hover:brightness-125 hover:scale-105 text-glow shadow-[0_0_15px_var(--tw-shadow-color)] hover:shadow-[0_0_25px_var(--tw-shadow-color)] px-3 py-1.5 rounded-lg border";
  
  return (
    <footer className="bg-dark-bg py-10 md:py-12 border-t-2 border-brand-purple/30">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 md:gap-10">
          
          <div>
            <h3 className="text-xl font-orbitron font-semibold text-brand-purple cyber-text glitch mb-4" data-text="ONE SITE PLS">
              ONE SITE PLS
            </h3>
            <p className="text-xs text-muted-foreground font-mono leading-relaxed">
              Твоя AI-Dev студия и самоулучшающаяся платформа. Создавай, обновляй, управляй кодом и контентом прямо из Telegram. Магия CyberVibe в каждом клике!
            </p>
          </div>

          <div>
            <h3 className="text-xl font-orbitron font-semibold text-brand-cyan cyber-text glitch mb-4" data-text="CORE MODULES">
              CORE MODULES
            </h3>
            <ul className="space-y-3">
              <li>
                 <Link href="/repo-xml" className={`${importantLinkClass} border-brand-purple/50 hover:border-brand-purple [--tw-shadow-color:theme(colors.brand-purple/60%)] bg-purple-950/40 hover:bg-purple-900/50`}>
                   <Sparkles className="w-4 h-4 text-brand-yellow animate-[pulse_1.8s_infinite]" /> SUPERVIBE Studio
                 </Link>
               </li>
               <li>
                 <Link href="/jumpstart" className={`${importantLinkClass} border-brand-green/50 hover:border-brand-green [--tw-shadow-color:theme(colors.brand-green/60%)] bg-green-950/40 hover:bg-green-900/50`}>
                   <Sparkles className="w-4 h-4 text-neon-lime animate-[pulse_2s_infinite_0.2s]" /> JUMPSTART Kit
                 </Link>
               </li>
                 <li><Link href="/selfdev/gamified" className={footerLinkClass}><Sparkles className="w-3.5 h-3.5 text-brand-pink"/>CyberDev OS</Link></li>
                 <li><Link href="/p-plan" className={footerLinkClass}><Code className="w-3.5 h-3.5 text-brand-yellow"/>VIBE План</Link></li>
            </ul>
          </div>

          <div>
            <h3 className="text-xl font-orbitron font-semibold text-brand-pink cyber-text glitch mb-4" data-text="RESOURCES">
              RESOURCES
            </h3>
            <ul className="space-y-2.5">
              <li><Link href="/about" className={footerLinkClass}><ExternalLink className="w-3.5 h-3.5" />О Проекте</Link></li>
              <li><a href="https://t.me/oneSitePlsBot" target="_blank" rel="noopener noreferrer" className={footerLinkClass}><FaTelegram className="w-3.5 h-3.5" />Telegram Бот</a></li>
              <li><a href="https://github.com/salavey13/carTest" target="_blank" rel="noopener noreferrer" className={footerLinkClass}><FaGithub className="w-3.5 h-3.5" />GitHub Репо</a></li>
              <li><Link href="/donate" className={footerLinkClass}><Heart className="w-3.5 h-3.5 text-brand-red" />Поддержать Vibe</Link></li>
            </ul>
          </div>

          <div>
             <h3 className="text-xl font-orbitron font-semibold text-brand-yellow cyber-text glitch mb-4" data-text="CONNECT">
               CONNECT
             </h3>
             <motion.button
               whileHover={{ scale: 1.03, boxShadow: "0 0 18px theme(colors.brand-yellow / 0.5)" }}
               whileTap={{ scale: 0.97 }}
               onClick={handleShare}
               className="w-full bg-gradient-to-r from-brand-yellow to-brand-orange text-black hover:shadow-brand-yellow/40 p-3 rounded-lg font-orbitron text-md shadow-lg transition-all flex items-center justify-center gap-2 text-glow"
             >
               {isInTelegramContext ? (
                 <><Gift className="w-4 h-4" /><span>Шарить oneSitePls</span></>
               ) : (
                 <><FaTelegram className="w-4 h-4" /><span>Открыть в Telegram</span></>
               )}
             </motion.button>
             <p className="text-[0.7rem] text-muted-foreground font-mono mt-3 text-center leading-tight">
               Поделись магией с друзьями или открой бота для старта!
             </p>
          </div>
        </div>

        <div className="mt-10 md:mt-12 pt-6 border-t border-brand-purple/20">
          <div className="flex flex-col md:flex-row justify-between items-center gap-3 text-muted-foreground font-mono text-xs">
            <p>© {new Date().getFullYear()} oneSitePls <span className="text-brand-purple/70 mx-0.5">::</span> Powered by CyberVibe <span className="text-brand-purple/70 mx-0.5">::</span> @SALAVEY13</p>
            <div className="flex items-center gap-3 sm:gap-4">
              <Link href="/privacy-policy" className={footerLinkClass}><ShieldQuestion className="w-3 h-3"/>Конфиденциальность</Link>
              <Link href="https://github.com/salavey13/carTest/blob/main/LICENSE" target="_blank" rel="noopener noreferrer" className={footerLinkClass}><FileText className="w-3 h-3"/>MIT License</Link>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
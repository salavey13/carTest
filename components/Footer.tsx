"use client";

"use client"
import { motion } from "framer-motion";
// Добавили иконку Sparkles
import { Gift, Heart, ExternalLink, Send, Code, Lock, Sparkles } from "lucide-react";
import { useAppContext } from "@/contexts/AppContext";
import Link from "next/link";

export default function Footer() {
  const { tg, isInTelegramContext } = useAppContext();

  const handleShare = () => {
    // .. (share logic remains the same)
    const shareUrl = "https://t.me/share/url?url=" + encodeURIComponent("https://t.me/oneSitePlsBot/Friends") + "&text=" + encodeURIComponent("Зацени Affordable Chinese Rent Cars!");
    if (isInTelegramContext && tg) {
      tg.openLink(shareUrl);
    } else {
      window.open(shareUrl, "_blank");
    }
  };

  return (
    // Убрал тень с футера, чтобы акцент был на ссылке SUPERVIBE
    <footer className="bg-background py-10 border-t border-muted">
      <div className="max-w-7xl mx-auto px-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {/* О нас */}
          <div className="space-y-4">
            {/* ... (О нас remains the same) */}
            <h3 className="text-xl font-semibold text-gradient cyber-text glitch" data-text="О НАС">
              О НАС
            </h3>
            <ul className="space-y-3">
              <li>
                <Link
                  href="/about"
                  className="text-sm text-muted-foreground hover:text-primary font-mono flex items-center gap-2 transition-colors text-glow"
                >
                  <ExternalLink className="w-4 h-4" /> Обо мне
                </Link>
              </li>
            </ul>
            {/* Обновил описание, чтобы оно соответствовало oneSitePls */}
            <p className="text-sm text-muted-foreground font-mono">
              oneSitePls — твоя студия для мгновенной разработки и апдейтов через Telegram. AI, GitHub Actions и магия кода в одном боте!
            </p>
          </div>

          {/* Быстрые ссылки */}
          <div className="space-y-4">
            <h3 className="text-xl font-semibold text-gradient cyber-text glitch" data-text="ССЫЛКИ">
              ССЫЛКИ
            </h3>
            <ul className="space-y-3">
               {/* --- Ссылка SUPERVIBE --- */}
               <li>
                 <Link
                   href="/repo-xml"
                   // --- Измененные стили для выделения ---
                   className="text-base font-bold text-gradient font-mono flex items-center gap-2 transition-all hover:brightness-125 hover:scale-105 text-glow shadow-[0_0_15px_rgba(128,0,128,0.7)] hover:shadow-[0_0_25px_rgba(128,0,128,0.9)] px-3 py-1 rounded-full bg-purple-900/30 border border-purple-600/50"
                   // Добавил немного фона, рамку, тень и увеличил размер шрифта
                 >
                   {/* --- Измененная иконка --- */}
                   <Sparkles className="w-5 h-5 text-yellow-400 animate-pulse" /> {/* Сделал иконку чуть больше и добавил пульсацию */}
                   SUPERVIBE ✨ {/* Добавил эмодзи для доп. акцента */}
                 </Link>
               </li>
               {/* --- Ссылка JUMPSTART --- */}
               <li>
                 <Link
                   href="/jumpstart"
                   // --- Измененные стили для выделения ---
                   className="text-base font-bold text-gradient font-mono flex items-center gap-2 transition-all hover:brightness-125 hover:scale-105 text-glow shadow-[0_0_15px_rgba(128,0,128,0.7)] hover:shadow-[0_0_25px_rgba(128,0,128,0.9)] px-3 py-1 rounded-full bg-purple-900/30 border border-cyan-600/50"
                   // Добавил немного фона, рамку, тень и увеличил размер шрифта
                 >
                   {/* --- Измененная иконка --- */}
                   <Sparkles className="w-5 h-5 text-yellow-400 animate-pulse" /> {/* Сделал иконку чуть больше и добавил пульсацию */}
                   JUMPSTART 🌟 {/* Добавил эмодзи для доп. акцента */}
                 </Link>
               </li>
               {/* --- Остальные ссылки --- */}
              <li>
                <a
                  href="https://v0.dev/chat/community/car-rent-telegram-web-app-demo-7jgtr94e1QR"
                  className="text-sm text-muted-foreground hover:text-primary font-mono flex items-center gap-2 transition-colors text-glow"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <ExternalLink className="w-4 h-4" /> Проект V0
                </a>
              </li>
              <li>
                <a
                  href="https://v0.dev/chat/fork-of-rastaman-shop-ovZ2DvhjGCA"
                  className="text-sm text-muted-foreground hover:text-primary font-mono flex items-center gap-2 transition-colors text-glow"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <ExternalLink className="w-4 h-4" /> Проект V0 + донат
                </a>
              </li>
              <li>
                <a
                  href="https://t.me/oneSitePlsBot/Friends"
                  className="text-sm text-muted-foreground hover:text-primary font-mono flex items-center gap-2 transition-colors text-glow"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Send className="w-4 h-4" /> Telegram-бот
                </a>
              </li>
              <li>
                <a
                  href="https://github.com/salavey13/carTest" // TODO: Update to correct repo if needed
                  className="text-sm text-muted-foreground hover:text-primary font-mono flex items-center gap-2 transition-colors text-glow"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <ExternalLink className="w-4 h-4" /> GitHub
                </a>
              </li>
              <li>
                <Link
                  href="https://linkgraph.net/stack/RH7eHk3vSe" 
                  className="text-sm text-muted-foreground hover:text-primary font-mono flex items-center gap-2 transition-colors text-glow"
                >
                  <Lock className="w-4 h-4" /> linkgraph
                </Link>
              </li>
              <li>
                <Link
                  href="/donate"
                  className="text-sm text-muted-foreground hover:text-primary font-mono flex items-center gap-2 transition-colors text-glow"
                >
                  <Heart className="w-4 h-4 text-red-500" /> {/* Заменил иконку на сердце */}
                  Донат
                </Link>
              </li>
            </ul>
          </div>

          {/* Сообщество */}
          <div className="space-y-4">
            {/* ... (Братва remains the same) */}
            <h3 className="text-xl font-semibold text-gradient cyber-text glitch" data-text="БРАТВА">
              БРАТВА
            </h3>
            <div className="flex items-center gap-2 text-muted-foreground font-mono text-sm">
              <span>Сварено с</span>
              <Heart className="w-4 h-4 text-accent animate-pulse" />
              <span>бандой Tupabase</span> {/* TODO: Check if Supabase is still relevant/used */}
            </div>
          </div>

          {/* Призыв к действию */}
          <div className="space-y-4">
            {/* ... (Гоняй remains the same, maybe update text later?) */}
             <h3 className="text-xl font-semibold text-gradient cyber-text glitch" data-text="ГОНЯЙ">
               ГОНЯЙ
             </h3>
             <motion.button
               whileHover={{ scale: 1.05 }}
               whileTap={{ scale: 0.95 }}
               onClick={handleShare}
               // Обновил цвет кнопки на более соответствующий SUPERVIBE
               className="w-full sm:w-auto bg-purple-600 text-white hover:bg-purple-700 p-4 rounded-xl font-mono text-lg shadow-[0_0_15px_rgba(192,132,252,0.7)] hover:shadow-[0_0_25px_rgba(192,132,252,0.9)] transition-all flex items-center justify-center gap-2 text-glow"
             >
               {isInTelegramContext ? (
                 <>
                   <Gift className="w-5 h-5" />
                   {/* Обновил текст для соответствия oneSitePls */}
                   <span>Шарить фичу</span>
                 </>
               ) : (
                 <>
                   <Send className="w-5 h-5" />
                   <span>Го в Telegram</span>
                 </>
               )}
             </motion.button>
          </div>
        </div>

        {/* Нижняя панель */}
        <div className="mt-10 pt-6 border-t border-muted">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4 text-muted-foreground font-mono text-sm">
            {/* Обновил копирайт */}
            <p>© {new Date().getFullYear()} oneSitePls by @SALAVEY13. Все права вайбуют!</p>
            <div className="flex items-center gap-6">
              <a href="#" className="hover:text-primary transition-colors text-glow">Конфиденциальность</a>
              <a href="#" className="hover:text-primary transition-colors text-glow">Условия</a>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}

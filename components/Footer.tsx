"use client";
import { motion } from "framer-motion";
import { Gift, Heart, ExternalLink, Send, Code, Lock } from "lucide-react";
import { useTelegram } from "@/hooks/useTelegram";
import Link from "next/link";

export default function Footer() {
  const { tg, isInTelegramContext } = useTelegram();

  const handleShare = () => {
    const shareUrl = "https://t.me/share/url?url=" + encodeURIComponent("https://t.me/oneSitePlsBot/Friends") + "&text=" + encodeURIComponent("Зацени Affordable Chinese Rent Cars!");
    if (isInTelegramContext && tg) {
      tg.openTelegramLink(shareUrl);
    } else {
      window.open(shareUrl, "_blank");
    }
  };

  return (
    <footer className="bg-background py-10 border-t border-muted shadow-[0_0_20px_rgba(255,107,107,0.3)]">
      <div className="max-w-7xl mx-auto px-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {/* О нас */}
          <div className="space-y-4">
            <h3 className="text-xl font-semibold text-gradient cyber-text glitch" data-text="О НАС">
              О НАС
            </h3>
            <p className="text-sm text-muted-foreground font-mono">
              Affordable Chinese Rent Cars — твой кибер-гараж для аренды китайских тачек. ИИ, неон и любовь к железу в одном флаконе!
            </p>
          </div>

          {/* Быстрые ссылки */}
          <div className="space-y-4">
            <h3 className="text-xl font-semibold text-gradient cyber-text glitch" data-text="ССЫЛКИ">
              ССЫЛКИ
            </h3>
            <ul className="space-y-3">
              <li>
                <a
                  href="https://v0.dev/chat/cartest-tupabase-template-hdQdrfzkTFA?b=b_HVsNns2SOBL&p=0"
                  className="text-sm text-muted-foreground hover:text-primary font-mono flex items-center gap-2 transition-colors text-glow"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <ExternalLink className="w-4 h-4" /> Проект V0
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
                  href="https://github.com/salavey13/carTest"
                  className="text-sm text-muted-foreground hover:text-primary font-mono flex items-center gap-2 transition-colors text-glow"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <ExternalLink className="w-4 h-4" /> GitHub
                </a>
              </li>
              <li>
                <Link
                  href="/repo-xml"
                  className="text-sm text-muted-foreground hover:text-primary font-mono flex items-center gap-2 transition-colors text-glow"
                >
                  <Code className="w-4 h-4" /> Кибер-Экстрактор
                </Link>
              </li>
              <li>
                <Link
                  href="/cyber-garage"
                  className="text-sm text-muted-foreground hover:text-primary font-mono flex items-center gap-2 transition-colors text-glow"
                >
                  <Lock className="w-4 h-4" /> Кибер-Гараж
                </Link>
              </li>
            </ul>
          </div>

          {/* Сообщество */}
          <div className="space-y-4">
            <h3 className="text-xl font-semibold text-gradient cyber-text glitch" data-text="БРАТВА">
              БРАТВА
            </h3>
            <div className="flex items-center gap-2 text-muted-foreground font-mono text-sm">
              <span>Сварено с</span>
              <Heart className="w-4 h-4 text-accent animate-pulse" />
              <span>бандой Tupabase</span>
            </div>
          </div>

          {/* Призыв к действию */}
          <div className="space-y-4">
            <h3 className="text-xl font-semibold text-gradient cyber-text glitch" data-text="ГОНЯЙ">
              ГОНЯЙ
            </h3>
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={handleShare}
              className="w-full sm:w-auto bg-primary text-primary-foreground hover:bg-secondary p-4 rounded-xl font-mono text-lg shadow-[0_0_15px_rgba(255,107,107,0.7)] hover:shadow-[0_0_25px_rgba(255,107,107,0.9)] transition-all flex items-center justify-center gap-2 text-glow"
            >
              {isInTelegramContext ? (
                <>
                  <Gift className="w-5 h-5" />
                  <span>Шарить и профитить</span>
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
            <p>© {new Date().getFullYear()} Affordable Chinese Rent Cars. Все права на месте, братан!</p>
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


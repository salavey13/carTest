"use client";

import { motion } from "framer-motion";
import { Gift, Heart, ExternalLink, Send } from "lucide-react";
import { useTelegram } from "@/hooks/useTelegram";
import { Button } from "@/components/ui/button";

export default function Footer() {
  const { tg, isInTelegramContext } = useTelegram();

  const handleShare = () => {
    const shareUrl = "https://t.me/share/url?url=" + encodeURIComponent("https://t.me/oneSitePlsBot/Friends") + "&text=" + encodeURIComponent("Зацени Affordable Chinese Rent Cars!");
    if (isInTelegramContext && tg) {
      // Use openLink to share within Telegram
      tg.openTelegramLink(shareUrl);
    } else {
      // Fallback for non-Telegram context
      window.open(shareUrl, "_blank");
    }
  };

  return (
    <footer className="bg-gradient-to-t from-black to-transparent py-8">
      <div className="max-w-7xl mx-auto px-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {/* Секция "О нас" */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gradient">Об Affordable Chinese Rent Cars</h3>
            <p className="text-sm text-gray-400">
              Rent Car помогает найти идеальный доступный китайский автомобиль для аренды на основе ваших предпочтений. Работает на передовом ИИ и любви к автомобилям.
            </p>
          </div>

          {/* Быстрые ссылки */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gradient">Быстрые ссылки</h3>
            <ul className="space-y-2">
              <li>
                <a
                  href="https://v0.dev/chat/cartest-tupabase-template-hdQdrfzkTFA?b=b_HVsNns2SOBL&p=0"
                  className="text-sm text-gray-400 hover:text-primary transition-colors flex items-center gap-2"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <ExternalLink className="w-4 h-4" />
                  Проект V0
                </a>
              </li>
              <li>
                <a
                  href="https://t.me/oneSitePlsBot/Friends"
                  className="text-sm text-gray-400 hover:text-primary transition-colors flex items-center gap-2"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Send className="w-4 h-4" />
                  Telegram-бот
                </a>
              </li>
              <li>
                <a
                  href="https://github.com/salavey13/carTest"
                  className="text-sm text-gray-400 hover:text-primary transition-colors flex items-center gap-2"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <ExternalLink className="w-4 h-4" />
                  GitHub
                </a>
              </li>
            </ul>
          </div>

          {/* Сообщество */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gradient">Сообщество</h3>
            <div className="flex items-center space-x-1 text-gray-400">
              <span className="text-sm">Создано с</span>
              <Heart className="w-4 h-4 text-red-500" />
              <span className="text-sm">командой Tupabase</span>
            </div>
          </div>

          {/* Призыв к действию */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gradient">Начать</h3>
            <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
              <Button
                onClick={handleShare}
                variant="neon"
                className="w-full sm:w-auto"
              >
                {isInTelegramContext ? (
                  <>
                    <Gift className="w-4 h-4 mr-2" />
                    <span className="text-sm font-medium">Поделиться и получить подарок</span>
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4 mr-2" />
                    <span className="text-sm font-medium">Попробовать Affordable Chinese Rent Cars в Telegram</span>
                  </>
                )}
              </Button>
            </motion.div>
          </div>
        </div>

        {/* Нижняя панель */}
        <div className="mt-8 pt-8 border-t border-gray-800">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <p className="text-sm text-gray-500">
              © {new Date().getFullYear()} Affordable Chinese Rent Cars. Все права защищены.
            </p>
            <div className="flex items-center space-x-4">
              <a href="#" className="text-xs text-gray-500 hover:text-primary">
                Политика конфиденциальности
              </a>
              <a href="#" className="text-xs text-gray-500 hover:text-primary">
                Условия использования
              </a>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}


"use client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { sendTelegramInvoice } from "../actions";
import { toast } from "sonner"; // Import Sonner toast
import { useAppContext } from "@/contexts/AppContext"; // Import AppContext

export default function SelfDevPage() {
  const { user } = useAppContext(); // Deconstruct user from context
  const chatId = user?.user_id; // Dynamic user ID

  const buyBoost = async (type: string, amount: number, title: string, description: string) => {
    if (!chatId) {
      toast.error("Ошибка: Не удалось найти твой ID. Залогинься, братан!");
      return;
    }

    const payload = `selfdev_boost_${type}_${Date.now()}`;

    const result = await sendTelegramInvoice(chatId, title, description, payload, amount, 0);
    if (result.success) {
      toast.success(`Счёт за "${title}" отправлен! Плати XTR в Telegram, бро!`);
    } else {
      toast.error("Не удалось отправить счёт. Попробуй ещё раз, мой человек!");
    }
  };

  const boosts = [
    { type: "priority_review", title: "Пропуск на Приоритетный Обзор", desc: "Твой pull request вливается за 24 часа!", amount: 50 },
    { type: "cyber_extractor_pro", title: "Кибер-Экстрактор Про", desc: "Полное дерево проекта + AI-подсказки.", amount: 100 },
    { type: "custom_command", title: "Кастомная Команда Бота", desc: "Персональная команда для oneSitePlsBot.", amount: 200 },
    { type: "ai_code_review", title: "AI Обзор Кода", desc: "Grok проверяет твой код с проф. советами.", amount: 75 },
    { type: "neon_avatar", title: "Неоновый Аватар", desc: "Кастомный киберпанк-аватар для профиля.", amount: 150 },
    { type: "vibe_session", title: "Сессия Менторства VIBE", desc: "1-на-1 со мной, чтобы освоить VIBE!", amount: 300 },
    { type: "ar_tour_generator", title: "Генератор AR-Туров", desc: "AI создаёт AR-туры для твоих тачек.", amount: 250 },
    { type: "code_warp_drive", title: "Кодовый Варп-Двигатель", desc: "Бот пишет фичу за 12 часов.", amount: 400 },
    { type: "cyber_garage_key", title: "Ключ VIP Кибер-Гаража", desc: "Эксклюзивный доступ к премиум-тачкам.", amount: 500 },
    { type: "tsunami_rider", title: "Значок Всадника Цунами", desc: "Понты + приоритет во всех очередях.", amount: 1000 },
    { type: "bot_overclock", title: "Оверклок Бота", desc: "Удвой скорость oneSitePlsBot на 30 дней.", amount: 600 },
    { type: "neural_tuner", title: "Нейронный Тюнер", desc: "AI подбирает тачки по твоему вайбу.", amount: 350 },
    { type: "repo_stealth_mode", title: "Режим Стелс Репозитория", desc: "Скрой свои PR от чужих глаз.", amount: 200 },
    { type: "glitch_fx_pack", title: "Пакет Глитч-Эффектов", desc: "Киберпанк-эффекты для твоих страниц.", amount: 120 },
    { type: "infinite_extract", title: "Бесконечный Экстрактор", desc: "Извлечение файлов без лимитов.", amount: 800 },
  ];

  return (
    <div className="relative min-h-screen">
      {/* Cyberpunk SVG Background */}
      <div className="absolute inset-0 z-0">
        <svg className="w-full h-full opacity-70 animate-pulse-slow" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 1000">
          <defs>
            <linearGradient id="cyberBg" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" style={{ stopColor: "#000000", stopOpacity: 1 }} />
              <stop offset="100%" style={{ stopColor: "#111111", stopOpacity: 1 }} />
            </linearGradient>
          </defs>
          <rect width="1000" height="1000" fill="url(#cyberBg)" />
          <path d="M0,200 H1000 M0,400 H1000 M0,600 H1000 M0,800 H1000" stroke="#39FF14" strokeWidth="2" opacity="0.5" />
          <path d="M200,0 V1000 M400,0 V1000 M600,0 V1000 M800,0 V1000" stroke="#39FF14" strokeWidth="2" opacity="0.5" />
          <circle cx="500" cy="500" r="300" stroke="#39FF14" strokeWidth="1" fill="none" opacity="0.3" />
        </svg>
      </div>
      <div className="relative z-10 container mx-auto p-4 pt-24">
        <Card className="max-w-4xl mx-auto bg-black text-white rounded-3xl shadow-[0_0_10px_#39FF14]">
          <CardHeader>
            <CardTitle className="text-2xl md:text-4xl font-bold text-center text-[#39FF14]">
              Рынок Бустов: Твой Кибер-Базар
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <p className="text-sm md:text-base text-center">
              Добро пожаловать на Рынок Бустов, братан! Это твой шлюз в мир AI-ускорителей — от прокачки кода до эксклюзивных фишек. Всё за XTR, всё для тебя, чтобы оседлать цунами технологий. Выбирай, плати, взлетаем!
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {boosts.map((boost) => (
                <div key={boost.type} className="flex justify-between items-center p-4 bg-gray-900 rounded-xl shadow-[0_0_5px_#39FF14]">
                  <div>
                    <p className="text-[#39FF14] font-bold">{boost.title}</p>
                    <p className="text-sm">{boost.desc}</p>
                  </div>
                  <Button
                    onClick={() => buyBoost(boost.type, boost.amount, boost.title, boost.desc)}
                    className="bg-[#39FF14] text-black hover:bg-[#2ecc11] font-semibold"
                  >
                    {boost.amount} XTR
                  </Button>
                </div>
              ))}
            </div>

            <p className="text-sm md:text-base text-center mt-6">
              Не нашёл нужный буст? Пиши в <a href="https://t.me/salavey13" className="text-[#39FF14] hover:underline">Telegram</a>, и я замутим что-то космическое под тебя! Го зарабатывать звёзды и править кибер-миром, мой звёздный бой!
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
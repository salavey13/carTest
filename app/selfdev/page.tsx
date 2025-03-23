"use client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { sendTelegramInvoice } from "../actions";
import { toast } from "sonner";
import { useAppContext } from "@/contexts/AppContext";
import { cn } from "@/lib/utils";
import { useState, useEffect } from "react";
import { supabaseAdmin } from "@/hooks/supabase"; // For ticker data
import {
  Zap,
  Tool,
  Bot,
  Search,
  Star,
  GraduationCap,
  Camera,
  Rocket,
  Key,
  Waves,
  FastForward,
  Brain,
  EyeOff,
  Sparkles,
  Infinity,
} from "lucide-react"; // Lucide icons

// Map boost types to Lucide icons
const boostIcons = {
  priority_review: Zap,
  cyber_extractor_pro: Tool,
  custom_command: Bot,
  ai_code_review: Search,
  neon_avatar: Star,
  vibe_session: GraduationCap,
  ar_tour_generator: Camera,
  code_warp_drive: Rocket,
  cyber_garage_key: Key,
  tsunami_rider: Waves,
  bot_overclock: FastForward,
  neural_tuner: Brain,
  repo_stealth_mode: EyeOff,
  glitch_fx_pack: Sparkles,
  infinite_extract: Infinity,
};

// Top boosts for extra glow
const topBoosts = ["tsunami_rider", "cyber_garage_key", "infinite_extract"];

export default function SelfDevPage() {
  const { user } = useAppContext();
  const chatId = user?.id; // Aligned with user.id
  const [xtrEarned, setXtrEarned] = useState(0);
  const [recentPurchases, setRecentPurchases] = useState<string[]>([]);
  const boostOfTheDay = "code_warp_drive";

  // Mock XTR earnings simulation
  useEffect(() => {
    const interval = setInterval(() => {
      setXtrEarned((prev) => Math.min(prev + Math.floor(Math.random() * 50), 1000));
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  // Fetch recent purchases from Supabase
  useEffect(() => {
    const fetchRecentPurchases = async () => {
      const { data, error } = await supabaseAdmin
        .from("invoices")
        .select("metadata, created_at")
        .eq("type", "selfdev_boost")
        .eq("status", "paid")
        .order("created_at", { ascending: false })
        .limit(5);

      if (error) {
        console.error("Error fetching purchases:", error);
        return;
      }

      const purchases = data.map((invoice) => `${invoice.metadata?.boost_type} - ${new Date(invoice.created_at).toLocaleTimeString()}`);
      setRecentPurchases(purchases);
    };

    fetchRecentPurchases();
    const channel = supabaseAdmin
      .channel("purchases")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "invoices" }, (payload) => {
        if (payload.new.type === "selfdev_boost" && payload.new.status === "paid") {
          setRecentPurchases((prev) => [`${payload.new.metadata?.boost_type} - ${new Date().toLocaleTimeString()}`, ...prev.slice(0, 4)]);
        }
      })
      .subscribe();

    return () => {
      supabaseAdmin.removeChannel(channel);
    };
  }, []);

  const buyBoost = async (type: string, amount: number, title: string, description: string) => {
    if (!chatId) {
      toast.error("Ошибка: Не удалось найти твой ID. Залогинься, братан!");
      return;
    }

    const payload = `selfdev_boost_${type}_${Date.now()}`;
    const finalAmount = type === boostOfTheDay ? Math.floor(amount * 0.8) : amount;

    const result = await sendTelegramInvoice(chatId, title, description, payload, finalAmount, 0);
    if (result.success) {
      toast.success(`Счёт за "${title}" отправлен! Плати ${finalAmount} XTR в Telegram, бро!`);
    } else {
      toast.error("Не удалось отправить счёт. Попробуй ещё раз, мой человек!");
    }
  };

  const boosts = [
    { type: "priority_review", title: "Пропуск на Приоритетный Обзор", desc: "Твой PR вливается за 24 часа!", amount: 50 },
    { type: "cyber_extractor_pro", title: "Кибер-Экстрактор Про", desc: "Полное дерево проекта + AI-подсказки.", amount: 100 },
    { type: "custom_command", title: "Кастомная Команда Бота", desc: "Персональная команда для бота.", amount: 200 },
    { type: "ai_code_review", title: "AI Обзор Кода", desc: "Grok проверяет твой код.", amount: 75 },
    { type: "neon_avatar", title: "Неоновый Аватар", desc: "Кастомный киберпанк-аватар.", amount: 150 },
    { type: "vibe_session", title: "Сессия Менторства VIBE", desc: "1-на-1 со мной по VIBE!", amount: 300 },
    { type: "ar_tour_generator", title: "Генератор AR-Туров", desc: "AI создаёт AR-туры для тачек.", amount: 250 },
    { type: "code_warp_drive", title: "Кодовый Варп-Двигатель", desc: "Бот пишет фичу за 12 часов.", amount: 400 },
    { type: "cyber_garage_key", title: "Ключ VIP Кибер-Гаража", desc: "Доступ к премиум-тачкам.", amount: 500 },
    { type: "tsunami_rider", title: "Значок Всадника Цунами", desc: "Элита + приоритет в очередях.", amount: 1000 },
    { type: "bot_overclock", title: "Оверклок Бота", desc: "Удвой скорость бота на 30 дней.", amount: 600 },
    { type: "neural_tuner", title: "Нейронный Тюнер", desc: "AI подбирает тачки по вайбу.", amount: 350 },
    { type: "repo_stealth_mode", title: "Режим Стелс Репозитория", desc: "Скрой свои PR от других.", amount: 200 },
    { type: "glitch_fx_pack", title: "Пакет Глитч-Эффектов", desc: "Эффекты для твоих страниц.", amount: 120 },
    { type: "infinite_extract", title: "Бесконечный Экстрактор", desc: "Извлечение без лимитов.", amount: 800 },
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
            <CardTitle className="text-2xl md:text-4xl font-bold text-center text-[#39FF14] cyber-text">
              Рынок Бустов: Кибер-Лавка
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <p className="text-sm md:text-base text-center">
              Добро пожаловать в Кибер-Лавку, братан! Хватай бусты, как легендарный лут — от кодовых читов до элитных плюшек. Всё за XTR, чтобы править кибер-миром!
            </p>

            {/* Boost of the Day */}
            <div className="bg-gray-900 p-4 rounded-xl shadow-[0_0_15px_#39FF14] animate-pulse">
              <p className="text-[#39FF14] font-bold text-center">Буст Дня: {boosts.find(b => b.type === boostOfTheDay)?.title}</p>
              <p className="text-sm text-center">Скидка 20%! Только сегодня за {Math.floor(boosts.find(b => b.type === boostOfTheDay)?.amount! * 0.8)} XTR</p>
            </div>

            {/* Boosts Grid */}
            <div className="grid grid-cols-2 gap-4">
              {boosts.map((boost) => {
                const Icon = boostIcons[boost.type];
                return (
                  <button
                    key={boost.type}
                    onClick={() => buyBoost(boost.type, boost.amount, boost.title, boost.desc)}
                    className={cn(
                      "relative aspect-square bg-gray-900 rounded-xl shadow-[0_0_5px_#39FF14] hover:shadow-[0_0_15px_#39FF14] transition-all duration-300 animate-glitch",
                      boost.type === boostOfTheDay && "border-2 border-[#39FF14] animate-pulse",
                      topBoosts.includes(boost.type) && "shadow-[0_0_10px_#e1ff01] hover:shadow-[0_0_20px_#e1ff01]"
                    )}
                  >
                    <div className="flex flex-col items-center justify-center h-full p-4">
                      <Icon className="w-12 h-12 text-[#39FF14] mb-2" />
                      <p className="text-[#39FF14] font-bold text-sm">{boost.title}</p>
                      <p className="text-xs text-center text-gray-400">{boost.desc}</p>
                    </div>
                    <span className="absolute top-2 right-2 text-[#39FF14] font-mono text-sm">
                      {boost.type === boostOfTheDay ? Math.floor(boost.amount * 0.8) : boost.amount} XTR
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Recently Purchased Ticker */}
            <div className="mt-6 bg-gray-900 p-2 rounded-xl shadow-[0_0_5px_#39FF14] overflow-hidden">
              <p className="text-[#39FF14] font-bold text-center">Недавно Куплено</p>
              <div className="relative h-6 overflow-hidden">
                <div className="absolute animate-ticker whitespace-nowrap">
                  {recentPurchases.length > 0 ? (
                    recentPurchases.map((purchase, i) => (
                      <span key={i} className="inline-block mx-4 text-sm text-gray-400">
                        {purchase}
                      </span>
                    ))
                  ) : (
                    <span className="text-sm text-gray-400">Пока тихо... Будь первым!</span>
                  )}
                </div>
              </div>
            </div>

            {/* XTR Earned Today Progress Bar */}
            <div className="mt-6">
              <p className="text-center text-[#39FF14] font-bold">XTR Заработано Сегодня</p>
              <div className="relative w-full h-4 bg-gray-800 rounded-full overflow-hidden">
                <div
                  className="absolute h-full bg-[#39FF14] transition-all duration-500"
                  style={{ width: `${(xtrEarned / 1000) * 100}%` }}
                />
                <span className="absolute inset-0 flex items-center justify-center text-xs font-mono">
                  {xtrEarned} / 1000 XTR
                </span>
              </div>
            </div>

            <p className="text-sm md:text-base text-center mt-6">
              Хочешь свой буст? Пиши в <a href="https://t.me/salavey13" className="text-[#39FF14] hover:underline">Telegram</a>, и я замутим легенду под тебя!
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
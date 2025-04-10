// /app/selfdev/page.tsx
"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button"; // Assuming you have a Button component
import { Progress } from "@/components/ui/progress"; // Assuming you have a Progress component
import { sendTelegramInvoice } from "../actions"; // Main actions file
import { getRecentSelfDevPurchases, subscribeToSelfDevPurchases } from "./actions"; // NEW: Server actions for this page
import { toast } from "sonner";
import { useAppContext } from "@/contexts/AppContext";
import { cn } from "@/lib/utils";
import {
  Zap, Wrench, Bot, Search, Star, GraduationCap, Camera, Rocket, Key,
  Waves, FastForward, Brain, EyeOff, Sparkles, Infinity, HelpCircle, // Added HelpCircle
  type LucideIcon, // Import type
} from "lucide-react";
import { debugLogger } from "@/lib/debugLogger"; // For debugging

// --- Types ---
interface Boost {
  type: string;
  title: string;
  desc: string;
  amount: number; // Amount in XTR (whole units)
  icon: LucideIcon; // Use LucideIcon type
}

interface PurchaseRecord {
  boost_type: string;
  purchased_at: string; // ISO string or formatted time string
}

// --- Constants ---
const BOOST_ICONS: Record<string, LucideIcon> = {
  priority_review: Zap,
  cyber_extractor_pro: Wrench,
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
  default: HelpCircle, // Fallback icon
};

const TOP_BOOSTS = ["tsunami_rider", "cyber_garage_key", "infinite_extract"];
const BOOST_OF_THE_DAY_DISCOUNT = 0.2; // 20% discount

// Boosts data (define with types)
const BOOSTS_DATA: Omit<Boost, 'icon'>[] = [
  { type: "priority_review", title: "Приоритетный Обзор", desc: "Твой PR вливается за 24ч!", amount: 50 },
  { type: "cyber_extractor_pro", title: "Кибер-Экстрактор Про", desc: "Дерево проекта + AI-подсказки.", amount: 100 },
  { type: "custom_command", title: "Кастомная Команда Бота", desc: "Персональная команда.", amount: 200 },
  { type: "ai_code_review", title: "AI Обзор Кода", desc: "Gemini смотрит твой код.", amount: 75 }, // Updated AI name
  { type: "neon_avatar", title: "Неоновый Аватар", desc: "Киберпанк-аватар.", amount: 150 },
  { type: "vibe_session", title: "Сессия Менторства VIBE", desc: "1-на-1 по VIBE!", amount: 300 },
  { type: "ar_tour_generator", title: "Генератор AR-Туров", desc: "AI создаёт AR-туры.", amount: 250 },
  { type: "code_warp_drive", title: "Кодовый Варп-Двигатель", desc: "Бот пишет фичу за 12ч.", amount: 400 },
  { type: "cyber_garage_key", title: "VIP Ключ Кибер-Гаража", desc: "Доступ к премиум-тачкам.", amount: 500 },
  { type: "tsunami_rider", title: "Значок Всадника Цунами", desc: "Элита + приоритет.", amount: 1000 },
  { type: "bot_overclock", title: "Оверклок Бота", desc: "x2 скорость бота (30д).", amount: 600 },
  { type: "neural_tuner", title: "Нейронный Тюнер", desc: "AI подбирает тачки.", amount: 350 },
  { type: "repo_stealth_mode", title: "Стелс Репозитория", desc: "Скрой свои PR.", amount: 200 },
  { type: "glitch_fx_pack", title: "Пакет Глитч-Эффектов", desc: "Эффекты для страниц.", amount: 120 },
  { type: "infinite_extract", title: "Бесконечный Экстрактор", desc: "Извлечение без лимитов.", amount: 800 },
];

// Add icons to boosts data
const boosts: Boost[] = BOOSTS_DATA.map(boost => ({
  ...boost,
  icon: BOOST_ICONS[boost.type] || BOOST_ICONS.default,
}));

// --- Component ---
export default function SelfDevPage() {
  const { user, isAuthenticated, isLoading: isAuthLoading } = useAppContext();
  const [isMounted, setIsMounted] = useState(false);
  const [boostOfTheDayType, setBoostOfTheDayType] = useState<string | null>(null);
  const [recentPurchases, setRecentPurchases] = useState<PurchaseRecord[]>([]);
  const [isLoadingPurchases, setIsLoadingPurchases] = useState(true);
  const [xtrEarned, setXtrEarned] = useState(0); // Mock state

  // Determine Boost of the Day (client-side consistent based on date)
  useEffect(() => {
    setIsMounted(true);
    const daySeed = new Date().toDateString();
    const seed = daySeed.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0);
    const randomIndex = seed % boosts.length;
    setBoostOfTheDayType(boosts[randomIndex].type);
  }, []);

  // Mock XTR earnings simulation
  useEffect(() => {
    if (!isMounted) return;
    const interval = setInterval(() => {
      setXtrEarned((prev) => Math.min(prev + Math.floor(Math.random() * 3) + 1, 1000)); // Simulate earning 1-3 XTR
    }, 3000); // Every 3 seconds
    return () => clearInterval(interval);
  }, [isMounted]);

  // Fetch initial recent purchases using Server Action
  useEffect(() => {
    if (!isMounted || !isAuthenticated) return; // Wait for mount and auth

    const fetchPurchases = async () => {
      debugLogger.log("[SelfDevPage] Fetching initial recent purchases...");
      setIsLoadingPurchases(true);
      try {
        const result = await getRecentSelfDevPurchases(5); // Fetch last 5
        if (result.success && result.data) {
           debugLogger.log("[SelfDevPage] Fetched purchases:", result.data);
           setRecentPurchases(result.data);
        } else {
           logger.warn("[SelfDevPage] Failed to fetch recent purchases:", result.error);
           // Optional: Show error to user?
        }
      } catch (error) {
         logger.error("[SelfDevPage] Error calling getRecentSelfDevPurchases:", error);
      } finally {
         setIsLoadingPurchases(false);
      }
    };

    fetchPurchases();

    // --- Real-time Subscription (using Server Action wrapper) ---
    // This part is more complex to implement securely and efficiently on the client.
    // The `subscribeToSelfDevPurchases` action would need to handle the Supabase channel
    // and potentially use a mechanism like Server-Sent Events (SSE) or WebSockets
    // to push updates back to the client securely.
    //
    // For simplicity in this refactor, we'll stick to fetching on load.
    // If real-time is critical, a more robust solution is needed.
    // Example (Conceptual - requires backend implementation):
    /*
    const unsubscribe = subscribeToSelfDevPurchases((newPurchase) => {
       debugLogger.log("[SelfDevPage] Received new purchase via subscription:", newPurchase);
       setRecentPurchases((prev) => [newPurchase, ...prev.slice(0, 4)]);
       toast.info(`Кто-то купил: ${newPurchase.boost_type}!`);
    });

    return () => {
       debugLogger.log("[SelfDevPage] Unsubscribing from purchases.");
       unsubscribe(); // Clean up subscription
    };
    */

  }, [isMounted, isAuthenticated]);


  const handleBuyBoost = useCallback(async (boost: Boost) => {
    if (!isAuthenticated || !user?.user_id) {
      toast.error("Ошибка: Не удалось найти твой ID. Пожалуйста, перезагрузи приложение.");
      debugLogger.error("[SelfDevPage] Buy boost failed: User not authenticated or user ID missing.", { isAuthenticated, userId: user?.user_id });
      return;
    }

    const isBoostOfTheDay = boost.type === boostOfTheDayType;
    const finalAmount = isBoostOfTheDay
      ? Math.floor(boost.amount * (1 - BOOST_OF_THE_DAY_DISCOUNT))
      : boost.amount;
    const discountApplied = isBoostOfTheDay ? `${(BOOST_OF_THE_DAY_DISCOUNT * 100)}%` : "Нет";

    // Unique payload for the invoice
    const payload = `selfdev_${boost.type}_${user.user_id}_${Date.now()}`;
    const title = boost.title + (isBoostOfTheDay ? " (Буст Дня!)" : "");
    const description = `${boost.desc}\nСкидка: ${discountApplied}`;

    debugLogger.log(`[SelfDevPage] Attempting to buy boost: ${boost.type} for user ${user.user_id} with amount ${finalAmount} XTR`);
    toast.loading(`Создаем счет за "${boost.title}"...`);

    try {
      // Call the main sendTelegramInvoice action
      const result = await sendTelegramInvoice(
          user.user_id.toString(), // Ensure user ID is string
          title,
          description,
          payload,
          finalAmount,
          0, // No subscription ID for boosts
          undefined // No image for boost invoice (or add one?)
      );

      toast.dismiss(); // Dismiss loading toast

      if (result.success) {
        toast.success(`Счёт за "${title}" отправлен!`, {
          description: `Сумма: ${finalAmount} XTR. Оплати в Telegram, чтобы активировать буст!`,
        });
        debugLogger.log(`[SelfDevPage] Invoice ${payload} sent successfully for boost ${boost.type}`);
      } else {
        toast.error("Не удалось отправить счёт.", {
          description: result.error || "Попробуй ещё раз или свяжись с поддержкой.",
        });
         debugLogger.error(`[SelfDevPage] Failed to send invoice for boost ${boost.type}: ${result.error}`);
      }
    } catch (error) {
        toast.dismiss();
        toast.error("Произошла ошибка при покупке.", {
            description: "Пожалуйста, попробуйте позже."
        });
        logger.error(`[SelfDevPage] Error calling sendTelegramInvoice for boost ${boost.type}:`, error);
    }
  }, [user, isAuthenticated, boostOfTheDayType]);


  // Render loading state or placeholder if not mounted or auth loading
  if (!isMounted || isAuthLoading) {
    return (
        <div className="flex justify-center items-center min-h-screen">
            <p>Загрузка кибер-лавки...</p>
            {/* Optional: Add a spinner */}
        </div>
    );
  }
   // Handle case where user is not authenticated after loading
   if (!isAuthenticated) {
       return (
           <div className="flex flex-col justify-center items-center min-h-screen text-center p-4">
               <p className="text-lg font-semibold mb-4">Для доступа к Кибер-Лавке необходимо авторизоваться.</p>
               <p className="text-sm text-gray-400">Пожалуйста, убедитесь, что вы используете приложение внутри Telegram.</p>
               {/* Optional: Add a refresh button or instructions */}
           </div>
       );
   }


  const currentBoostOfTheDay = boosts.find(b => b.type === boostOfTheDayType);

  return (
    <div className="relative min-h-screen overflow-hidden">
      {/* Cyberpunk Background - Consider optimizing SVG or using CSS */}
      <div className="absolute inset-0 z-0 opacity-50 animate-pulse-slow">
         {/* Simplified background using CSS gradients for better performance */}
         <div className="absolute inset-0 bg-gradient-to-br from-gray-900 via-black to-gray-900"></div>
         {/* Grid lines (optional, can be heavy) */}
         <div
            className="absolute inset-0 bg-repeat"
            style={{
                backgroundImage: `linear-gradient(to right, rgba(57, 255, 20, 0.1) 1px, transparent 1px),
                                linear-gradient(to bottom, rgba(57, 255, 20, 0.1) 1px, transparent 1px)`,
                backgroundSize: '40px 40px',
            }}
         ></div>
      </div>

      <div className="relative z-10 container mx-auto p-4 pt-20 md:pt-24 pb-10">
        <Card className="max-w-4xl mx-auto bg-black/80 backdrop-blur-sm text-white rounded-xl border border-brand-green/30 shadow-[0_0_15px_rgba(0,255,157,0.3)]">
          <CardHeader className="text-center border-b border-brand-green/20 pb-4">
            <CardTitle className="text-2xl md:text-4xl font-bold text-brand-green cyber-text">
              Кибер-Лавка Бустов
            </CardTitle>
             <p className="text-sm md:text-base text-gray-300 mt-2">
               Апгрейды для твоей кибер-жизни. Хватай бусты за XTR!
            </p>
          </CardHeader>

          <CardContent className="space-y-6 p-4 md:p-6">

             {/* --- Boost of the Day --- */}
            {currentBoostOfTheDay && (
                <div className="bg-brand-green/10 border border-brand-green/50 p-4 rounded-lg shadow-lg text-center animate-pulse">
                    <h3 className="text-brand-green font-bold text-lg mb-1">🚀 Буст Дня! 🚀</h3>
                    <p className="font-semibold">{currentBoostOfTheDay.title}</p>
                    <p className="text-sm text-gray-300">{currentBoostOfTheDay.desc}</p>
                    <p className="text-sm mt-1">
                        Скидка <span className="font-bold">{BOOST_OF_THE_DAY_DISCOUNT * 100}%</span>!
                        Цена: <span className="line-through text-gray-400">{currentBoostOfTheDay.amount} XTR</span>
                        <span className="text-brand-green font-bold ml-2">
                           {Math.floor(currentBoostOfTheDay.amount * (1 - BOOST_OF_THE_DAY_DISCOUNT))} XTR
                        </span>
                    </p>
                    <Button
                        size="sm"
                        variant="ghost"
                        className="mt-2 text-brand-green border-brand-green hover:bg-brand-green/20"
                        onClick={() => handleBuyBoost(currentBoostOfTheDay)}
                    >
                        Купить со скидкой!
                    </Button>
                </div>
            )}


            {/* --- Boosts Grid --- */}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 md:gap-4">
              {boosts.map((boost) => {
                const isTopBoost = TOP_BOOSTS.includes(boost.type);
                const isBoostOfTheDay = boost.type === boostOfTheDayType;
                const finalAmount = isBoostOfTheDay ? Math.floor(boost.amount * (1 - BOOST_OF_THE_DAY_DISCOUNT)) : boost.amount;

                return (
                  <Button // Use Button for consistent styling and interaction
                    key={boost.type}
                    variant="outline" // Use outline or ghost variant
                    onClick={() => handleBuyBoost(boost)}
                    className={cn(
                      "h-auto aspect-square p-2 md:p-3 flex flex-col items-center justify-center text-center",
                      "bg-gray-900/70 border-brand-green/30 hover:bg-brand-green/10 hover:border-brand-green/70",
                      "transition-all duration-300 group", // Added group for potential hover effects inside
                      isBoostOfTheDay && "border-2 border-brand-green animate-pulse shadow-[0_0_10px_rgba(0,255,157,0.5)]",
                      isTopBoost && "border-yellow-400/50 hover:border-yellow-400 shadow-[0_0_8px_rgba(225,255,1,0.4)]"
                    )}
                  >
                      <boost.icon className={cn(
                          "w-8 h-8 md:w-10 md:h-10 mb-1",
                          isTopBoost ? "text-yellow-400" : "text-brand-green",
                          "transition-transform group-hover:scale-110" // Example hover effect
                      )} />
                      <p className={cn(
                          "font-semibold text-xs md:text-sm leading-tight",
                           isTopBoost ? "text-yellow-300" : "text-brand-green"
                      )}>{boost.title}</p>
                      <p className="text-xs text-gray-400 mt-1 hidden md:block">{boost.desc}</p> {/* Hide desc on small screens */}
                      <span className={cn(
                          "block mt-1 font-mono text-xs md:text-sm",
                          isBoostOfTheDay ? "text-brand-green font-bold" : "text-gray-300"
                      )}>
                          {isBoostOfTheDay && <span className="line-through text-gray-500 mr-1">{boost.amount}</span>}
                          {finalAmount} XTR
                      </span>
                  </Button>
                );
              })}
            </div>

            {/* --- Recently Purchased Ticker --- */}
            <div className="mt-6 bg-gray-900/50 p-3 rounded-lg border border-brand-green/20 shadow-inner overflow-hidden">
              <p className="text-brand-green font-bold text-center text-sm mb-2">Недавно Куплено:</p>
              <div className="relative h-6 overflow-hidden">
                {isLoadingPurchases ? (
                    <p className="text-center text-gray-400 text-sm">Загрузка...</p>
                ) : recentPurchases.length > 0 ? (
                    <div className="absolute animate-ticker whitespace-nowrap">
                    {/* Duplicate the list for seamless looping */}
                    {[...recentPurchases, ...recentPurchases].map((purchase, i) => {
                         const boostMeta = boosts.find(b => b.type === purchase.boost_type);
                        return (
                          <span key={i} className="inline-flex items-center mx-4 text-sm text-gray-300">
                             {boostMeta && <boostMeta.icon className="w-4 h-4 mr-1.5 text-brand-green/70" />}
                             {boostMeta?.title || purchase.boost_type}
                             <span className="text-gray-500 ml-1">({new Date(purchase.purchased_at).toLocaleTimeString()})</span>
                          </span>
                        );
                    })}
                    </div>
                ) : (
                    <p className="text-center text-gray-400 text-sm">Пока никто ничего не купил... Будь первым!</p>
                )}
              </div>
            </div>

            {/* --- XTR Earned Today Progress Bar (Mock) --- */}
            <div className="mt-6">
              <p className="text-center text-brand-green font-bold mb-1">XTR Заработано Сегодня (Симуляция)</p>
              <Progress
                value={(xtrEarned / 1000) * 100}
                className="w-full h-3 bg-gray-800 border border-brand-green/30"
                indicatorClassName="bg-brand-green" // Custom class for the indicator bar if Progress allows
              />
              <p className="text-center text-xs font-mono mt-1 text-gray-400">
                  {xtrEarned} / 1000 XTR
              </p>
            </div>

            <p className="text-sm text-center mt-6 text-gray-400">
              Хочешь свой буст? Пиши в <a href="https://t.me/salavey13" target="_blank" rel="noopener noreferrer" className="text-brand-green hover:underline font-semibold">Telegram @salavey13</a>, обсудим!
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}


// Add simple CSS animation for the ticker if not already present globally
/* In your global CSS or a relevant style block:
@keyframes ticker {
  0% { transform: translateX(0); }
  100% { transform: translateX(-50%); } // Adjust based on content width if needed
}
.animate-ticker {
  animation: ticker 40s linear infinite; // Adjust duration as needed
  display: inline-block; // Ensure it works correctly
}
*/

// Add CSS for cyber-text if not defined
/*
.cyber-text {
   text-shadow: 0 0 5px rgba(0, 255, 157, 0.7), 0 0 10px rgba(0, 255, 157, 0.5);
}
*/
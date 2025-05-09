// /app/buy-subscription/page.tsx
"use client";
import { useState, useEffect } from "react";
import { useAppContext } from "@/contexts/AppContext";
import { sendTelegramInvoice } from "@/app/actions";
import { createInvoice, getUserSubscription } from "@/hooks/supabase"; // Renamed from getUserSubscriptionId
import { motion } from "framer-motion";
import { toast } from "sonner";
import { FaDumbbell, FaAppleAlt, FaStar, FaUsers } from "react-icons/fa";

const SUBSCRIPTIONS = [
  { id: 1, name: "Лайт", price: 13, features: ["Доступ к базовым тренировкам", "Трекер прогресса"], color: "from-blue-600 to-cyan-400", icon: <FaDumbbell className="inline mr-2" /> },
  { id: 2, name: "Про", price: 69, features: ["Все тренировки и программы", "Персональные планы питания", "Приоритетная поддержка"], color: "from-purple-600 to-pink-500", icon: <FaAppleAlt className="inline mr-2" /> },
  { id: 3, name: "Макс", price: 420, features: ["Все из Про", "Консультации с тренером", "Эксклюзивный контент"], color: "from-amber-500 to-red-600", icon: <FaStar className="inline mr-2" /> },
];

export default function BuySubscription() {
  const { user, isInTelegramContext } = useAppContext();
  const [selectedSubscription, setSelectedSubscription] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeSubscriptionDetails, setActiveSubscriptionDetails] = useState<any>(null); // Store full subscription object

  useEffect(() => {
    const checkSubscription = async () => {
      if (user?.id) { // Ensure user and user.id exist
        const subResult = await getUserSubscription(user.id.toString());
        if (subResult.success && subResult.data) {
          const currentSubId = Number(subResult.data); // Assuming subscription_id is numeric
          const currentSub = SUBSCRIPTIONS.find(s => s.id === currentSubId);
          if (currentSub) {
            setActiveSubscriptionDetails(currentSub);
            toast.success(`Активна подписка: "${currentSub.name}"`);
          } else {
            toast.info("Активная подписка не найдена среди текущих планов.");
            setActiveSubscriptionDetails(null);
          }
        } else {
          toast.info("Подписка не найдена.");
          setActiveSubscriptionDetails(null);
        }
      }
    };
    checkSubscription();
  }, [user]);

  const handlePurchase = async () => {
    if (!user?.id) return setError("Авторизуйтесь в Telegram"), toast.error("Авторизуйтесь в Telegram");
    if (activeSubscriptionDetails) return setError(`У вас уже активна подписка "${activeSubscriptionDetails.name}"`), toast.error(`Подписка "${activeSubscriptionDetails.name}" уже активна`);
    if (!selectedSubscription) return setError("Выберите план подписки"), toast.error("Выберите план подписки");

    setLoading(true);
    setError(null);
    setSuccess(false);

    // Демо-режим, если не в Telegram
    if (!isInTelegramContext) {
      setSuccess(true); // Имитируем успех
      toast.success(`Демо-режим: Счет для подписки "${selectedSubscription.name}" создан!`);
      setLoading(false);
      // Имитируем активацию подписки в демо-режиме
      setActiveSubscriptionDetails(selectedSubscription);
      return;
    }

    try {
      const metadata = {
        type: "subscription",
        subscription_id: selectedSubscription.id,
        subscription_name: selectedSubscription.name,
        subscription_price_stars: selectedSubscription.price,
      };
      const payload = `subscription_${user.id}_${Date.now()}`;
      
      // Создаем инвойс в нашей БД
      const invoiceCreateResult = await createInvoice(
        "subscription",
        payload,
        user.id.toString(),
        selectedSubscription.price, // Цена в XTR (целые числа)
        selectedSubscription.id, // ID подписки для связи
        metadata
      );

      if (!invoiceCreateResult.success || !invoiceCreateResult.data) {
        throw new Error(invoiceCreateResult.error || "Не удалось создать запись о счете в базе данных");
      }
      
      // Отправляем инвойс в Telegram
      const response = await sendTelegramInvoice(
        user.id.toString(),
        `Подписка Fit10min: ${selectedSubscription.name}`,
        `Разблокируйте премиум-функции с планом "${selectedSubscription.name}"! Включает: ${selectedSubscription.features.join(', ')}.`,
        payload, // Используем созданный payload
        selectedSubscription.price // Сумма в XTR (целые единицы)
      );

      if (!response.success) {
        throw new Error(response.error || "Не удалось отправить счёт в Telegram");
      }
      
      setSuccess(true);
      toast.success("Счёт на оплату подписки отправлен в Telegram! После оплаты подписка активируется.");
      // Подписка активируется через вебхук после успешной оплаты
      // Здесь можно, например, показать сообщение "Ожидаем подтверждения оплаты..."

    } catch (err) {
      const errMsg = err instanceof Error ? err.message : "Неизвестная ошибка";
      setError("Ошибка покупки: " + errMsg);
      toast.error("Ошибка покупки: " + errMsg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen pt-24 bg-background bg-grid-pattern animate-[drift_30s_infinite]">
      <main className="container mx-auto pt-10 px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-5xl mx-auto p-8 bg-card rounded-2xl shadow-[0_0_20px_rgba(0,255,157,0.3)] border border-muted"
        >
          <h1 className="text-4xl font-bold text-gradient cyber-text glitch text-center mb-6" data-text="ПРЕМИУМ ПОДПИСКА">
            ПРЕМИУМ ПОДПИСКА
          </h1>
          <p className="text-muted-foreground mb-8 text-lg font-mono text-center">
            {activeSubscriptionDetails
              ? `Поздравляем! У вас активна подписка "${activeSubscriptionDetails.name}". Наслаждайтесь всеми преимуществами!`
              : "Открой полный доступ к Fit10min и достигни своих фитнес-целей!"}
          </p>
          
          {activeSubscriptionDetails && (
            <div className={`mb-10 p-6 rounded-xl border border-muted shadow-inner bg-gradient-to-br ${activeSubscriptionDetails.color} text-center`}>
                <h3 className="text-3xl font-semibold text-primary mb-3 cyber-text">{activeSubscriptionDetails.icon} {activeSubscriptionDetails.name}</h3>
                <p className="text-xl font-bold text-foreground mb-3 font-mono">{activeSubscriptionDetails.price} XTR / месяц</p>
                <ul className="space-y-1 mb-4 text-left max-w-md mx-auto">
                    {activeSubscriptionDetails.features.map((feature: string, i: number) => (
                      <li key={i} className="text-muted-foreground font-mono text-base flex items-center gap-2">
                        <span className="text-primary">✓</span> {feature}
                      </li>
                    ))}
                </ul>
                <p className="text-sm text-primary-foreground font-mono">Подписка активна. Новые возможности уже доступны!</p>
            </div>
          )}

          {!activeSubscriptionDetails && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {SUBSCRIPTIONS.map((sub) => (
                <motion.div
                  key={sub.id}
                  initial={{ opacity: 0, y: 30 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: sub.id * 0.15 }}
                  whileHover={{ scale: 1.05, boxShadow: "0 0 25px rgba(0,255,157,0.4)" }}
                  className={`bg-card p-6 rounded-xl border border-muted shadow-inner bg-gradient-to-br ${sub.color} flex flex-col justify-between`}
                >
                  <div>
                    <h3 className="text-2xl font-semibold text-primary mb-4 cyber-text">{sub.icon} {sub.name}</h3>
                    <p className="text-3xl font-bold text-foreground mb-4 font-mono">{sub.price} XTR</p>
                    <ul className="space-y-2 mb-6">
                      {sub.features.map((feature, i) => (
                        <li key={i} className="text-muted-foreground font-mono text-sm flex items-center gap-2">
                          <span className="text-primary">✓</span> {feature}
                        </li>
                      ))}
                    </ul>
                  </div>
                  <button
                    onClick={() => setSelectedSubscription(sub)}
                    disabled={loading}
                    className={`w-full mt-auto p-3 rounded-lg font-mono text-lg ${selectedSubscription?.id === sub.id ? "bg-primary text-primary-foreground ring-2 ring-offset-2 ring-offset-card ring-brand-green" : "bg-muted text-foreground hover:bg-primary/60"} transition-all`}
                  >
                    {selectedSubscription?.id === sub.id ? "Выбрано" : "Выбрать"}
                  </button>
                </motion.div>
              ))}
            </div>
          )}
          {!activeSubscriptionDetails && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6 }}
              className="mt-10 text-center"
            >
              <button
                onClick={handlePurchase}
                disabled={!selectedSubscription || loading || success}
                className={`px-10 py-4 rounded-xl font-semibold text-primary-foreground ${loading || success ? "bg-muted cursor-not-allowed animate-pulse" : "bg-brand-green hover:bg-brand-green/80 hover:shadow-[0_0_15px_rgba(0,255,157,0.7)]"} transition-all text-glow font-mono text-lg`}
              >
                {loading ? "Обработка..." : success ? "Счет отправлен!" : "Оформить подписку"}
              </button>
              {error && (
                <motion.p
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="text-destructive text-sm font-mono mt-4 animate-[neon_2s_infinite]"
                >
                  {error}
                </motion.p>
              )}
            </motion.div>
          )}
           {success && !activeSubscriptionDetails && (
             <motion.p 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-center text-brand-green font-mono mt-6 text-lg"
             >
                Отлично! Мы отправили счет в ваш Telegram. После успешной оплаты подписка будет активирована автоматически.
             </motion.p>
           )}
        </motion.div>
      </main>
    </div>
  );
}
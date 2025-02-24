"use client";
import { useState, useEffect } from "react";
import { useTelegram } from "@/hooks/useTelegram";
import { sendTelegramInvoice } from "@/app/actions";
import { createInvoice, getUserSubscription } from "@/hooks/supabase";
import { motion } from "framer-motion";
import { toast } from "sonner";

const SUBSCRIPTIONS = [
  { id: 1, name: "Базовый", price: 13, features: ["Доступ к стандартным автомобилям", "Базовая поддержка"], color: "from-blue-600 to-cyan-400" },
  { id: 2, name: "Продвинутый", price: 69, features: ["Доступ к премиум-автомобилям", "Приоритетная поддержка", "Бесплатные апгрейды"], color: "from-purple-600 to-pink-500" },
  { id: 3, name: "VIP", price: 420, features: ["Доступ ко всем автомобилям", "Круглосуточная поддержка", "Персональный менеджер"], color: "from-amber-500 to-red-600" },
];

export default function BuySubscription() {
  const { user, isInTelegramContext } = useTelegram();
  const [selectedSubscription, setSelectedSubscription] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasSubscription, setHasSubscription] = useState<boolean>(false);

  useEffect(() => {
    const checkSubscription = async () => {
      if (user) {
        const subscriptionId = await getUserSubscription(user.id.toString());
        setHasSubscription(!!subscriptionId);
        toast.success(subscriptionId ? "У вас уже есть подписка" : "Подписка не найдена");
      }
    };
    checkSubscription();
  }, [user]);

  const handlePurchase = async () => {
    if (!user) return setError("Авторизуйтесь в Telegram"), toast.error("Авторизуйтесь в Telegram");
    if (hasSubscription) return setError("У вас уже есть подписка"), toast.error("Подписка уже активна");
    if (!selectedSubscription) return setError("Выберите абонемент"), toast.error("Выберите абонемент");

    setLoading(true);
    setError(null);

    if (!isInTelegramContext) {
      setSuccess(true);
      setError("Демо-режим: Счёт создан!");
      toast.success("Демо: Счёт создан!");
      setLoading(false);
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
      await createInvoice("subscription", payload, user.id.toString(), selectedSubscription.price, metadata);
      const response = await sendTelegramInvoice(
        user.id.toString(),
        `${selectedSubscription.name} Абонемент`,
        "Разблокируйте премиум-функции с этим абонементом!",
        payload,
        selectedSubscription.price
      );
      if (!response.success) throw new Error(response.error || "Не удалось отправить счёт");
      setSuccess(true);
      toast.success("Счёт отправлен в Telegram!");
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
      <header className="fixed top-0 left-0 right-0 bg-card shadow-md p-6 z-10 border-b border-muted">
        <h1 className="text-4xl font-bold text-gradient cyber-text glitch" data-text="КУПИТЬ АБОНЕМЕНТ">
          КУПИТЬ АБОНЕМЕНТ
        </h1>
      </header>
      <main className="container mx-auto pt-10 px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-5xl mx-auto p-8 bg-card rounded-2xl shadow-[0_0_20px_rgba(255,107,107,0.3)] border border-muted"
        >
          <p className="text-muted-foreground mb-8 text-lg font-mono text-center">
            {hasSubscription ? "Добро пожаловать в элиту! Премиум активен." : "Разблокируй кибер-привилегии с абонементом!"}
          </p>
          {!hasSubscription && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {SUBSCRIPTIONS.map((sub) => (
                <motion.div
                  key={sub.id}
                  initial={{ opacity: 0, y: 30 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: sub.id * 0.2 }}
                  whileHover={{ scale: 1.05, boxShadow: "0 0 25px rgba(255,107,107,0.5)" }}
                  className={`bg-card p-6 rounded-xl border border-muted shadow-inner bg-gradient-to-br ${sub.color}`}
                >
                  <h3 className="text-2xl font-semibold text-primary mb-4 cyber-text">{sub.name}</h3>
                  <p className="text-3xl font-bold text-foreground mb-4 font-mono">{sub.price} XTR</p>
                  <ul className="space-y-2 mb-6">
                    {sub.features.map((feature, i) => (
                      <li key={i} className="text-muted-foreground font-mono text-sm flex items-center gap-2">
                        <span className="text-primary">▶</span> {feature}
                      </li>
                    ))}
                  </ul>
                  <button
                    onClick={() => setSelectedSubscription(sub)}
                    className={`w-full p-3 rounded-lg font-mono text-lg ${selectedSubscription?.id === sub.id ? "bg-primary text-primary-foreground" : "bg-muted text-foreground hover:bg-primary/50"} transition-colors`}
                  >
                    {selectedSubscription?.id === sub.id ? "Выбрано" : "Выбрать"}
                  </button>
                </motion.div>
              ))}
            </div>
          )}
          {!hasSubscription && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6 }}
              className="mt-10 text-center"
            >
              <button
                onClick={handlePurchase}
                disabled={!selectedSubscription || loading}
                className={`px-10 py-4 rounded-xl font-semibold text-primary-foreground ${loading ? "bg-muted cursor-not-allowed animate-pulse" : "bg-primary hover:bg-secondary hover:shadow-[0_0_15px_rgba(255,107,107,0.7)]"} transition-all text-glow font-mono text-lg`}
              >
                {loading ? "Обработка..." : "КУПИТЬ"}
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
        </motion.div>
      </main>
    </div>
  );
}

"use client";
import { useState, useEffect } from "react";
import { useAppContext } from "@/contexts/AppContext";
import { sendTelegramInvoice } from "@/app/actions";
import { createInvoice, getUserSubscription } from "@/hooks/supabase";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { FaBrain, FaBolt, FaMicrochip, FaRocket, FaUserNinja, FaStar, FaLockOpen } from "react-icons/fa"; // FaLockOpen is not Fa6
import { FaShieldHalved, FaInfinity, FaUsers } from "react-icons/fa6"; // FaLockOpen -> FaShieldHalved, FaInfinity, FaUsers for features
import VibeContentRenderer from "@/components/VibeContentRenderer";

const SUBSCRIPTION_PLANS = [
  {
    id: "basic_neural_net",
    name: "Basic Neural Net",
    price: 0, // Assuming a free/basic tier
    xtrPrice: "0 XTR",
    features: [
      "<FaBrain className='text-brand-cyan'/> Доступ к CyberDev OS (Lvl 0-1)",
      "<FaBolt className='text-brand-yellow'/> Базовый генератор KiloVibes",
      "<FaMicrochip className='text-brand-green'/> Ограниченный банк промптов",
    ],
    color: "from-gray-700/50 to-gray-800/50 border-gray-600",
    icon: <FaBrain className="inline mr-2 text-brand-cyan" />,
    cta: "Текущий Уровень",
    isCurrent: true, // Example, logic needed
  },
  {
    id: "epu_tier",
    name: "Enhanced Processing Unit (EPU)",
    price: 13,
    xtrPrice: "13 XTR",
    features: [
      "<FaBrain className='text-brand-cyan'/> Все из Basic Neural Net",
      "<FaRocket className='text-brand-orange'/> Ускоренный генератор KiloVibes",
      "<FaInfinity className='text-brand-green'/> Расширенный Prompt Matrix",
      "<FaUserNinja className='text-brand-pink'/> Доступ к квестам CyberDev (Lvl 1-5)",
      "<FaShieldHalved className='text-brand-blue'/> Стандартная AI-поддержка",
    ],
    color: "from-brand-blue/80 to-brand-cyan/80 border-brand-blue",
    icon: <FaMicrochip className="inline mr-2 text-brand-blue" />,
    cta: "Апгрейд до EPU"
  },
  {
    id: "qbi_tier",
    name: "Quantum Brain Interface (QBI)",
    price: 69,
    xtrPrice: "69 XTR",
    features: [
      "<FaBrain className='text-brand-cyan'/> Все из EPU Tier",
      "<FaBolt className='text-brand-yellow'/> Максимальный поток KiloVibes",
      "<FaUserNinja className='text-brand-pink'/> Доступ ко всем уровням и квестам CyberDev",
      "<FaUsers className='text-brand-purple'/> Приоритетный AI Co-Pilot Support",
      "<FaStar className='text-neon-lime'/> Эксклюзивные Vibe Perks & Альфа-дропы",
    ],
    color: "from-brand-purple/80 to-brand-pink/80 border-brand-purple",
    icon: <FaBolt className="inline mr-2 text-brand-yellow" />,
    cta: "Активировать QBI"
  },
];

export default function BuySubscriptionPage() {
  const { user, isInTelegramContext, dbUser } = useAppContext();
  const [selectedSubscription, setSelectedSubscription] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeSubscriptionId, setActiveSubscriptionId] = useState<string | null>(null);

  useEffect(() => {
    const checkSubscription = async () => {
      if (dbUser?.id) {
        // Assuming subscription_id on dbUser stores the ID like "epu_tier" or "qbi_tier"
        const currentSubId = dbUser.subscription_id as string | null;
        if (currentSubId && SUBSCRIPTION_PLANS.find(s => s.id === currentSubId && s.id !== "basic_neural_net")) {
          setActiveSubscriptionId(currentSubId);
          const currentSub = SUBSCRIPTION_PLANS.find(s => s.id === currentSubId);
          toast.success(`Активна подписка: "${currentSub?.name}"`);
        } else {
          setActiveSubscriptionId("basic_neural_net"); // Default to basic if no premium active
        }
      } else {
        setActiveSubscriptionId("basic_neural_net"); // Default for non-logged-in users
      }
    };
    checkSubscription();
  }, [dbUser]);

  const handlePurchase = async () => {
    if (!user?.id) return setError("Авторизуйтесь в Telegram"), toast.error("Авторизуйтесь в Telegram");
    if (!selectedSubscription || selectedSubscription.id === "basic_neural_net") return setError("Выберите платный план для апгрейда"), toast.error("Выберите платный план");
    if (activeSubscriptionId === selectedSubscription.id) return setError(`План "${selectedSubscription.name}" уже активен`), toast.error(`План "${selectedSubscription.name}" уже активен`);

    setLoading(true);
    setError(null);
    setSuccess(false);

    if (!isInTelegramContext) {
      toast.success(`Демо-режим: Счет для "${selectedSubscription.name}" создан!`);
      setLoading(false);
      setSuccess(true);
      setActiveSubscriptionId(selectedSubscription.id); // Simulate activation
      return;
    }

    try {
      const metadata = {
        type: "subscription_cyberfitness",
        subscription_id: selectedSubscription.id,
        subscription_name: selectedSubscription.name,
        subscription_price_stars: selectedSubscription.price,
        userId: user.id.toString(),
      };
      const payload = `sub_cf_${user.id}_${selectedSubscription.id}_${Date.now()}`;
      
      const invoiceCreateResult = await createInvoice(
        "subscription_cyberfitness",
        payload,
        user.id.toString(),
        selectedSubscription.price,
        selectedSubscription.id, 
        metadata
      );

      if (!invoiceCreateResult.success || !invoiceCreateResult.data) {
        throw new Error(invoiceCreateResult.error || "Не удалось создать запись о счете в CyberVibe БД");
      }
      
      const response = await sendTelegramInvoice(
        user.id.toString(),
        `Апгрейд CyberDev OS: ${selectedSubscription.name}`,
        `Разблокируй ${selectedSubscription.name} для доступа к: ${selectedSubscription.features.map((f: string) => f.replace(/<[^>]*>/g, '')).join(', ')}.`,
        payload,
        selectedSubscription.price
      );

      if (!response.success) {
        throw new Error(response.error || "Не удалось отправить счёт в Telegram");
      }
      
      setSuccess(true);
      toast.success("Счёт на апгрейд ОС отправлен в Telegram! После оплаты система обновится.");

    } catch (err) {
      const errMsg = err instanceof Error ? err.message : "Неизвестная ошибка";
      setError("Ошибка апгрейда: " + errMsg);
      toast.error("Ошибка апгрейда: " + errMsg);
    } finally {
      setLoading(false);
    }
  };

  const activePlan = SUBSCRIPTION_PLANS.find(s => s.id === activeSubscriptionId) || SUBSCRIPTION_PLANS[0];

  return (
    <div className="min-h-screen pt-24 bg-dark-bg bg-grid-pattern animate-[drift_30s_linear_infinite] pb-10">
      <main className="container mx-auto pt-10 px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-5xl mx-auto p-6 md:p-8 bg-dark-card/90 backdrop-blur-md rounded-2xl shadow-[0_0_30px_theme(colors.brand-purple/40%)] border border-brand-purple/50"
        >
          <h1 className="text-4xl font-orbitron font-bold text-brand-purple cyber-text glitch text-center mb-3" data-text="UPGRADE COGNITIVE OS">
            UPGRADE COGNITIVE OS
          </h1>
          <p className="text-muted-foreground mb-8 text-lg font-mono text-center">
            {activeSubscriptionId !== "basic_neural_net"
              ? `Поздравляем, Агент! Твоя ОС: "${activePlan.name}". Все системы в норме.`
              : "Расширь свои возможности. Выбери апгрейд для своей нейросети."}
          </p>
          
          {activeSubscriptionId !== "basic_neural_net" && (
            <div className={`mb-10 p-6 rounded-xl border ${activePlan.color.split(' ').pop()} shadow-inner bg-gradient-to-br ${activePlan.color} text-center`}>
                <h3 className="text-3xl font-orbitron font-semibold text-light-text mb-3 flex items-center justify-center">{activePlan.icon} {activePlan.name}</h3>
                <p className="text-xl font-bold text-white mb-3 font-mono">{activePlan.xtrPrice} / цикл</p>
                <ul className="space-y-1.5 mb-4 text-left max-w-md mx-auto text-sm">
                    {activePlan.features.map((feature: string, i: number) => (
                      <li key={i} className="text-gray-200 font-mono flex items-start gap-2">
                        <VibeContentRenderer content={feature.replace(/className='[^']*'/, "className='text-xl text-current'")} />
                      </li>
                    ))}
                </ul>
                <p className="text-sm text-gray-100 font-mono">Статус ОС: <span className="text-brand-green font-bold">Оптимальный</span>. Новые горизонты открыты!</p>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8">
            {SUBSCRIPTION_PLANS.map((sub) => (
              <motion.div
                key={sub.id}
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: SUBSCRIPTION_PLANS.indexOf(sub) * 0.1 }}
                whileHover={{ scale: 1.03, boxShadow: "0 0 25px hsla(var(--brand-cyan-hsl), 0.5)" }}
                className={`p-5 md:p-6 rounded-xl border shadow-xl flex flex-col justify-between bg-gradient-to-br ${sub.color} ${sub.id === "basic_neural_net" ? 'opacity-70' : ''} transition-all duration-300`}
              >
                <div>
                  <h3 className="text-2xl font-orbitron font-semibold text-light-text mb-3 flex items-center">{sub.icon} {sub.name}</h3>
                  <p className="text-3xl font-bold text-white mb-4 font-mono">{sub.xtrPrice}</p>
                  <ul className="space-y-1.5 mb-6 text-xs">
                    {sub.features.map((feature, i) => (
                      <li key={i} className="text-gray-200 font-mono flex items-start gap-2">
                        <VibeContentRenderer content={feature.replace(/className='[^']*'/, "className='text-lg text-current'")} />
                      </li>
                    ))}
                  </ul>
                </div>
                <Button
                  onClick={() => setSelectedSubscription(sub)}
                  disabled={loading || sub.id === activeSubscriptionId || sub.id === "basic_neural_net"}
                  className={`w-full mt-auto py-2.5 rounded-lg font-orbitron text-md transition-all duration-200 ease-in-out
                    ${selectedSubscription?.id === sub.id && sub.id !== "basic_neural_net" ? "bg-brand-green text-black ring-2 ring-offset-2 ring-offset-current ring-brand-yellow shadow-lg" 
                    : sub.id === activeSubscriptionId ? "bg-gray-600 text-gray-400 cursor-not-allowed" 
                    : sub.id === "basic_neural_net" ? "bg-gray-500 text-gray-300 cursor-not-allowed"
                    : "bg-dark-bg text-light-text hover:bg-brand-green hover:text-black hover:shadow-brand-green/50 focus:bg-brand-green focus:text-black"}`}
                >
                  {sub.id === activeSubscriptionId ? "Активен" : selectedSubscription?.id === sub.id ? "Выбран" : sub.cta}
                </Button>
              </motion.div>
            ))}
          </div>
          
          {activeSubscriptionId === "basic_neural_net" && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
              className="mt-10 text-center"
            >
              <Button
                onClick={handlePurchase}
                disabled={!selectedSubscription || selectedSubscription.id === "basic_neural_net" || loading || success}
                className={`px-8 py-3 rounded-xl font-orbitron text-lg transition-all duration-300 ease-in-out transform hover:scale-105
                  ${loading || success ? "bg-muted text-muted-foreground cursor-not-allowed animate-pulse" 
                  : "bg-gradient-to-r from-brand-green to-neon-lime text-black hover:shadow-[0_0_20px_theme(colors.brand-green)] text-glow"}`}
              >
                {loading ? "Обработка запроса..." : success ? "Счет отправлен!" : "Апгрейд ОС"}
              </Button>
              {error && (
                <motion.p
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="text-brand-red text-sm font-mono mt-4 animate-pulse"
                >
                  {error}
                </motion.p>
              )}
            </motion.div>
          )}
           {success && activeSubscriptionId === "basic_neural_net" && (
             <motion.p 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-center text-brand-green font-mono mt-6 text-lg"
             >
                Отлично, Агент! Мы отправили счет на апгрейд в твой Telegram. После успешной транзакции ОС будет обновлена автоматически.
             </motion.p>
           )}
        </motion.div>
      </main>
    </div>
  );
}
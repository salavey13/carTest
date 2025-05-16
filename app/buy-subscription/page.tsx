"use client";
import { useState, useEffect } from "react";
import { useAppContext } from "@/contexts/AppContext";
import { sendTelegramInvoice } from "@/app/actions";
import { createInvoice } from "@/hooks/supabase"; 
import { motion } from "framer-motion";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
// FaUserNinja, FaStar, FaShieldHalved, FaInfinity, FaUsers were already imported.
// VibeContentRenderer already imported.

const SUBSCRIPTION_PLANS = [
  {
    id: "basic_neural_net",
    name: "Basic Neural Net",
    price: 0, 
    xtrPrice: "0 XTR",
    features: [
      "<FaBrain className='text-brand-cyan mr-2 align-middle text-xl'/> Доступ к CyberDev OS (Lvl 0-1)",
      "<FaBolt className='text-brand-yellow mr-2 align-middle text-xl'/> Базовый генератор KiloVibes",
      "<FaMicrochip className='text-brand-green mr-2 align-middle text-xl'/> Ограниченный банк промптов",
    ],
    color: "from-gray-700/50 to-gray-800/50 border-gray-600",
    iconString: "::FaBrain className='inline mr-2 text-brand-cyan'::", // Changed to VibeContentRenderer compatible string for header
    cta: "Текущий Уровень",
  },
  {
    id: "epu_tier",
    name: "Enhanced Processing Unit (EPU)",
    price: 13,
    xtrPrice: "13 XTR",
    features: [
      "<FaBrain className='text-brand-cyan mr-2 align-middle text-xl'/> Все из Basic Neural Net",
      "<FaRocket className='text-brand-orange mr-2 align-middle text-xl'/> Ускоренный генератор KiloVibes",
      "<FaInfinity className='text-brand-green mr-2 align-middle text-xl'/> Расширенный Prompt Matrix",
      "<FaUserNinja className='text-brand-pink mr-2 align-middle text-xl'/> Доступ к квестам CyberDev (Lvl 1-5)",
      "<FaShieldHalved className='text-brand-blue mr-2 align-middle text-xl'/> Стандартная AI-поддержка",
    ],
    color: "from-brand-blue/80 to-brand-cyan/80 border-brand-blue",
    iconString: "::FaMicrochip className='inline mr-2 text-brand-blue'::",
    cta: "Апгрейд до EPU"
  },
  {
    id: "qbi_tier",
    name: "Quantum Brain Interface (QBI)",
    price: 69,
    xtrPrice: "69 XTR",
    features: [
      "<FaBrain className='text-brand-cyan mr-2 align-middle text-xl'/> Все из EPU Tier",
      "<FaBolt className='text-brand-yellow mr-2 align-middle text-xl'/> Максимальный поток KiloVibes",
      "<FaUserNinja className='text-brand-pink mr-2 align-middle text-xl'/> Доступ ко всем уровням и квестам CyberDev",
      "<FaUsers className='text-brand-purple mr-2 align-middle text-xl'/> Приоритетный AI Co-Pilot Support",
      "<FaStar className='text-neon-lime mr-2 align-middle text-xl'/> Эксклюзивные Vibe Perks & Альфа-дропы",
    ],
    color: "from-brand-purple/80 to-brand-pink/80 border-brand-purple",
    iconString: "::FaBolt className='inline mr-2 text-brand-yellow'::",
    cta: "Активировать QBI"
  },
];

// Helper function to parse feature strings
const parseFeatureString = (feature: string): { iconVibeContent: string | null, textContent: string } => {
    // Regex to capture the HTML-like icon tag and the subsequent text
    // Example: "<FaBrain className='text-brand-cyan mr-2 align-middle text-xl'/> Доступ к CyberDev OS (Lvl 0-1)"
    const featureMatch = feature.match(/^(<Fa\w+(?:\s+[^>]*?)?\s*\/?>)(.*)$/);
    
    if (featureMatch) {
        const iconHtmlTag = featureMatch[1]; // e.g., "<FaBrain className='...text-xl'/>"
        const text = featureMatch[2].trim();   // e.g., "Доступ к CyberDev OS (Lvl 0-1)"

        // Convert HTML-like icon tag to VibeContentRenderer's ::...:: syntax
        // e.g., from "<FaBrain class='.../>" to "::FaBrain class='...'::"
        const iconTagParts = iconHtmlTag.match(/^<(Fa\w+)((?:\s+[^>]*?)?)\s*\/>$/);
        if (iconTagParts) {
            const iconName = iconTagParts[1];
            const attributes = iconTagParts[2] ? iconTagParts[2].trim() : '';
            return {
                iconVibeContent: `::${iconName}${attributes ? ' ' + attributes : ''}::`,
                textContent: text
            };
        }
    }
    // Fallback if no icon tag is found at the beginning, or if parsing fails
    return { iconVibeContent: null, textContent: feature };
};


export default function BuySubscriptionPage() {
  const { user, isInTelegramContext, dbUser } = useAppContext();
  const [selectedSubscription, setSelectedSubscription] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeSubscriptionId, setActiveSubscriptionId] = useState<string>("basic_neural_net"); 

  useEffect(() => {
    if (dbUser?.subscription_id && SUBSCRIPTION_PLANS.find(s => s.id === dbUser.subscription_id)) {
      setActiveSubscriptionId(dbUser.subscription_id as string);
    } else {
      setActiveSubscriptionId("basic_neural_net");
    }
  }, [dbUser]);

  const handlePurchase = async () => {
    if (!user?.id) return setError("Авторизуйтесь в Telegram"), toast.error("Авторизуйтесь в Telegram");
    if (!selectedSubscription || selectedSubscription.id === "basic_neural_net") return setError("Выберите платный план для апгрейда"), toast.error("Выберите платный план");
    if (activeSubscriptionId === selectedSubscription.id) return setError(`План "${selectedSubscription.name}" уже активен`), toast.error(`План "${selectedSubscription.name}" уже активен`);

    setLoading(true);
    setError(null);
    setSuccess(false);

    if (!isInTelegramContext && process.env.NODE_ENV === 'development') { 
      toast.success(`Демо-режим: Счет для "${selectedSubscription.name}" создан!`);
      setLoading(false);
      setSuccess(true);
      setActiveSubscriptionId(selectedSubscription.id); 
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
      
      const cleanFeaturesForInvoice = selectedSubscription.features.map((feature: string) => {
         const { textContent } = parseFeatureString(feature); // Use helper to get clean text
         return textContent;
      }).join(', ');


      const response = await sendTelegramInvoice(
        user.id.toString(),
        `Апгрейд CyberDev OS: ${selectedSubscription.name}`,
        `Разблокируй ${selectedSubscription.name} для доступа к: ${cleanFeaturesForInvoice}.`,
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
                <h3 className="text-3xl font-orbitron font-semibold text-light-text mb-3 flex items-center justify-center">
                  <VibeContentRenderer content={activePlan.iconString} /> {activePlan.name}
                </h3>
                <p className="text-xl font-bold text-white mb-3 font-mono">{activePlan.xtrPrice} / цикл</p>
                <ul className="space-y-1.5 mb-4 text-left max-w-md mx-auto text-sm">
                    {activePlan.features.map((featureString: string, i: number) => {
                      const { iconVibeContent, textContent } = parseFeatureString(featureString);
                      return (
                        <li key={i} className="text-gray-200 font-mono flex items-center">
                          {iconVibeContent && <VibeContentRenderer content={iconVibeContent} />}
                          <span className={iconVibeContent ? "ml-0" : ""}>{/* Removed ml-2 as icon's own class handles margin */}
                            {textContent}
                          </span>
                        </li>
                      );
                    })}
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
                className={`p-5 md:p-6 rounded-xl border shadow-xl flex flex-col justify-between bg-gradient-to-br ${sub.color} ${sub.id === "basic_neural_net" ? 'opacity-70 cursor-not-allowed' : ''} transition-all duration-300`}
              >
                <div>
                  <h3 className="text-2xl font-orbitron font-semibold text-light-text mb-3 flex items-center">
                    <VibeContentRenderer content={sub.iconString} /> {sub.name}
                  </h3>
                  <p className="text-3xl font-bold text-white mb-4 font-mono">{sub.xtrPrice}</p>
                  <ul className="space-y-1.5 mb-6 text-xs">
                    {sub.features.map((featureString, i) => {
                      const { iconVibeContent, textContent } = parseFeatureString(featureString);
                      return (
                        <li key={i} className="text-gray-200 font-mono flex items-center">
                           {iconVibeContent && <VibeContentRenderer content={iconVibeContent} />}
                           <span className={iconVibeContent ? "ml-0" : ""}>{/* Removed ml-2, icon class handles margin */}
                             {textContent}
                           </span>
                        </li>
                      );
                    })}
                  </ul>
                </div>
                <Button
                  onClick={() => sub.id !== "basic_neural_net" && setSelectedSubscription(sub)}
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
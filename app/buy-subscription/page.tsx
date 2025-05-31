"use client";
import { useState, useEffect } from "react";
import { useAppContext } from "@/contexts/AppContext";
import { sendTelegramInvoice } from "@/app/actions";
import { createInvoice } from "@/hooks/supabase";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import VibeContentRenderer from "@/components/VibeContentRenderer"; // Ensure this is correctly imported

// Assuming parseFeatureString is defined elsewhere or you integrate its logic directly if simple
// For this example, I'll keep the call to parseFeatureString as it was in your original snippet.
// If it's not in this file, ensure it's imported or defined.
const parseFeatureString = (feature: string): { iconVibeContent: string | null, textContent: string } => {
    const featureMatch = feature.match(/^(<Fa\w+(?:\s+[^>]*?)?\s*\/?>)(.*)$/);
    if (featureMatch) {
        const iconHtmlTag = featureMatch[1];
        const text = featureMatch[2].trim();
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
    return { iconVibeContent: null, textContent: feature };
};


const UPDATED_SUBSCRIPTION_PLANS = [
  {
    id: "cyber_initiate_free_demo", // FREE TIER - The DEMO
    name: "КИБЕР-ДЕМО: Попробуй VIBE (0 XTR - Бесплатно!)",
    price: 0,
    xtrPrice: "0 XTR (Навсегда!)",
    iconString: "::FaGift className='inline mr-2 text-brand-lime'::",
    color: "from-gray-700/60 to-gray-800/60 border-gray-500",
    cta: "Это Твой VIBE!",
    main_description: "**Никаких 'демо-версий' с обрезанным функционалом! Получи ПОЛНЫЙ доступ ко всей экосистеме CyberVibe СРАЗУ. Это не просто посмотреть – это НАЧАТЬ ДЕЛАТЬ.** Забудь про Сибирь – почувствуй мощь AI здесь и сейчас!",
    features: [
      "<FaPlayCircle className='text-brand-cyan mr-2 align-middle text-lg'/> **'ИСКРА ВАЙБА' – Твой Первый Успех:** Принеси идею или KWork-заказ. Я, как 'Призрачный Пилот', создам для тебя AI-прототип и оффер. Ты увидишь магию и, возможно, заработаешь первый кэш через 'Лобби Горячих Вайбов'!",
      "<FaToolbox className='text-brand-yellow mr-2 align-middle text-lg'/> **ВСЕ ИНСТРУМЕНТЫ ОТКРЫТЫ:** SUPERVIBE Studio, CyberDev OS, все 'GTA Vibe Миссии' (по мере прокачки!), 'Схемы Вайба', `GeneralPurposeScraper` – исследуй и экспериментируй.",
      "<FaBookReader className='text-brand-green mr-2 align-middle text-lg'/> **ПОЛНАЯ БАЗА ЗНАНИЙ:** От 'Цели и Прибыли' до 'Экспериментального Мышления' – весь контент для твоего апгрейда.",
      "<FaUsers className='text-brand-pink mr-2 align-middle text-lg'/> **VIBE TRIBE (Комьюнити):** Поддержка, обмен опытом, совместные штурмы (когда активно).",
    ],
    who_is_this_for: "Для каждого, кто хочет без риска ощутить VIBE, увидеть AI в действии, выполнить свою первую 'Миссию Огня' и понять – **ДА, Я ТОЖЕ ТАК МОГУ!** Это твой шанс убедиться, что CyberVibe – это не очередная сибирская сказка, а реальный инструмент для создания будущего."
  },
  {
    id: "vibe_launch_co_pilot_intro", // PAID TIER 1 - The INTRO
    name: "VIBE-ЗАПУСК: Штурман PRO (4200₽ / 42 XTR)",
    price: 4200,
    xtrPrice: "42 XTR",
    iconString: "::FaUserAstronaut className='inline mr-2 text-brand-orange'::",
    color: "from-brand-orange/90 to-brand-yellow/90 border-brand-orange shadow-yellow-glow",
    cta: "Активировать VIBE-ЗАПУСК",
    main_description: "**Хватит смотреть – ПОРА ДЕЛАТЬ ВМЕСТЕ! Это твой персональный AI-воркшоп. Ты даешь KWork-заказ, я – твой VIBE-штурман 24/7. ВМЕСТЕ мы проходим весь путь от идеи до рабочего демо и оффера клиенту. Ты – за рулем CyberVibe Studio, я – 'похлопываю по плечу'.**",
    features: [
      "<FaHandHoldingDollar className='text-brand-green mr-2 align-middle text-lg'/> **ГАРАНТИРОВАННЫЙ ПЕРВЫЙ КЛИЕНТ (почти!):** Мы вместе создадим убойное демо и оффер. Ты отправишь, ты получишь деньги (моя доля – эти 4200₽, остальное – твое!). **Это не теория, это практика с реальным кэшем.**",
      "<FaLaptopCode className='text-brand-cyan mr-2 align-middle text-lg'/> **ТЫ УПРАВЛЯЕШЬ AI:** Заходим в CyberVibe Studio. **Никакого Node.js, ES6, npm – просто кликай и смотри, как AI пишет код!** Я покажу, как делать 'свопы', менять дизайн, генерировать текст.",
      "<FaBrain className='text-neon-lime mr-2 align-middle text-lg'/> **МЕНТОРСТВО 'НА ЛЕТУ':** Забудь про нудные лекции. Все вопросы – по ходу реального проекта. Ты поймешь, как это работает, потому что СДЕЛАЕШЬ ЭТО САМ.",
      "<FaLevelUpAlt className='text-brand-pink mr-2 align-middle text-lg'/> **'НЕ-НЕ-IT' СТАНОВИТСЯ 'AI-МАГ':** Этот опыт покажет, что ты можешь создавать веб-приложения и ботов. Серьезно. Прямо сейчас.",
      "<FaTools className='text-brand-purple mr-2 align-middle text-lg'/> **ТВОЙ СТАРТОВЫЙ AI-АРСЕНАЛ:** После 'VIBE-Запуска' ты сможешь сам выполнять простые задачи в WebAnyBot/oneSitePlsBot."
    ],
    who_is_this_for: "Для тех, кто готов инвестировать в **опыт, который меняет правила игры.** Если 'бесплатное демо' зажгло искру, этот 'VIBE-Запуск' – твой первый шаг к реальным деньгам и навыкам AI-разработчика. **Платишь за результат и мое время – получаешь Vibegasm от первого успеха!**"
  },
  {
    id: "qbi_matrix_mastery_wowtro", // PAID TIER 2 - The WOWTRO
    name: "QBI: Матрица Твоя – КОМАНДУЙ! (6900₽ / 69 XTR)",
    price: 6900,
    xtrPrice: "69 XTR",
    iconString: "::FaBoltLightning className='inline mr-2 text-brand-yellow'::",
    color: "from-brand-purple/90 to-brand-pink/90 border-brand-purple shadow-pink-glow",
    cta: "Активировать QBI-Мастерство",
    main_description: "**Это WOW-трансформация! Хватит быть пассажиром – СТАНЬ АРХИТЕКТОРОМ своей AI-реальности. Мы вместе с тобой создаем TWA ЛЮБОЙ сложности, 'доим' клиентов на кастомные фичи, строим твою цифровую империю. Я делюсь ВСЕЙ магией CyberVibe, ты – командуешь парадом.**",
    features: [
      "<FaProjectDiagram className='text-brand-cyan mr-2 align-middle text-lg'/> **ТЫ – АРХИТЕКТОР, AI – ТВОЙ ЛЕГИОН:** Полный безлимит в SUPERVIBE Studio. Проектируй, генерируй, кастомизируй сложные многофайловые приложения и ботов.",
      "<FaDatabase className='text-brand-green mr-2 align-middle text-lg'/> **АЛХИМИЯ SUPABASE:** От проектирования схем до Realtime-магии и управления данными из бота – ты освоишь всё.",
      "<FaCogs className='text-brand-blue mr-2 align-middle text-lg'/> **АВТОПИЛОТЫ ДЛЯ ТВОЕГО VIBE'А (Supabase Edge Functions):** Автоматизируй парсинг, отчеты, уведомления – создай систему, которая работает на тебя.",
      "<FaCreativeCommonsZero className='text-neon-lime mr-2 align-middle text-lg'/> **XTR МОНЕТИЗАЦИЯ ИЛИ БЕСПЛАТНО – ТАКОВ VIBE!** Научись принимать оплату в Telegram Stars для своих проектов.",
      "<FaHatWizard className='text-brand-purple mr-2 align-middle text-lg'/> **ИСКУССТВО AI-ПРОМПТИНГА (УРОВЕНЬ: БОГ):** Создавай сложные 'чейны' промптов, кастомные AI-Оракулы для любых задач.",
      "<FaBuildingColumns className='text-brand-pink mr-2 align-middle text-lg'/> **ФРАНШИЗА ТВОЕГО VIBE'А (Основы):** Инструменты и знания для создания своей команды 'Полевых Агентов' и масштабирования успеха.",
      "<FaStarOfLife className='text-brand-yellow mr-2 align-middle text-lg'/> **VIP-ДОСТУП К БУДУЩЕМУ:** Эксклюзивные Vibe Perks, альфа-тесты, прямая связь с Кэрри (Павлом) для мозговых штурмов.",
    ],
    who_is_this_for: "Для Агентов, готовых к **полной VIBE-трансформации.** Если ты хочешь не просто использовать AI, а ИЗОБРЕТАТЬ с его помощью, создавать сложные системы, монетизировать свои уникальные 'AI-соусы' и, возможно, построить свою 'сосисочную империю' – это твой апгрейд. **Vibegasm от безграничных возможностей гарантирован!**"
  }
];

export default function BuySubscriptionPage() {
  const { user, isInTelegramContext, dbUser } = useAppContext();
  const [selectedSubscription, setSelectedSubscription] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeSubscriptionId, setActiveSubscriptionId] = useState<string>("cyber_initiate_free_demo");

  useEffect(() => {
    if (dbUser?.subscription_id && UPDATED_SUBSCRIPTION_PLANS.find(s => s.id === dbUser.subscription_id)) {
      setActiveSubscriptionId(dbUser.subscription_id as string);
    } else {
      setActiveSubscriptionId("cyber_initiate_free_demo");
    }
  }, [dbUser]);

  const handlePurchase = async () => {
    if (!user?.id) return setError("Авторизуйтесь в Telegram"), toast.error("Авторизуйтесь в Telegram");
    if (!selectedSubscription || selectedSubscription.id === "cyber_initiate_free_demo") return setError("Выберите платный план для апгрейда"), toast.error("Выберите платный план");
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
        type: "subscription_cyberfitness", // Ensure this type is handled in your webhook
        subscription_id: selectedSubscription.id,
        subscription_name: selectedSubscription.name,
        subscription_price_stars: selectedSubscription.price, // Assuming price is in XTR units
        userId: user.id.toString(),
      };
      const payload = `sub_cf_${user.id}_${selectedSubscription.id}_${Date.now()}`;

      const invoiceCreateResult = await createInvoice(
        "subscription_cyberfitness", // Corresponds to metadata.type
        payload,
        user.id.toString(),
        selectedSubscription.price, // Price in XTR for Telegram invoice
        selectedSubscription.id,
        metadata
      );

      if (!invoiceCreateResult.success || !invoiceCreateResult.data) {
        throw new Error(invoiceCreateResult.error || "Не удалось создать запись о счете в CyberVibe БД");
      }

      const cleanFeaturesForInvoice = selectedSubscription.features.map((feature: string) => {
         const { textContent } = parseFeatureString(feature);
         return textContent;
      }).slice(0, 3).join(', ') + "..."; // Keep it concise for invoice description

      const response = await sendTelegramInvoice(
        user.id.toString(),
        `Апгрейд CyberVibe OS: ${selectedSubscription.name}`,
        `Разблокируй ${selectedSubscription.name}, чтобы ${cleanFeaturesForInvoice}.`,
        payload,
        selectedSubscription.price // Price in XTR for Telegram invoice
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

  const activePlan = UPDATED_SUBSCRIPTION_PLANS.find(s => s.id === activeSubscriptionId) || UPDATED_SUBSCRIPTION_PLANS[0];

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
            {activeSubscriptionId !== "cyber_initiate_free_demo"
              ? `Поздравляем, Агент! Твоя ОС: "${activePlan.name}". Все системы в норме. Новые горизонты открыты!`
              : "Расширь свои возможности. Выбери свой путь к AI-Мастерству в CyberVibe."}
          </p>

          {activeSubscriptionId !== "cyber_initiate_free_demo" && (
            <div className={`mb-10 p-6 rounded-xl border ${activePlan.color.split(' ').pop()} shadow-inner bg-gradient-to-br ${activePlan.color} text-center`}>
                <h3 className="text-3xl font-orbitron font-semibold text-light-text mb-3 flex items-center justify-center">
                  <VibeContentRenderer content={activePlan.iconString} /> <span className="ml-2">{activePlan.name}</span>
                </h3>
                <p className="text-xl font-bold text-white mb-3 font-mono">{activePlan.xtrPrice} / цикл</p>
                 <p className="text-sm text-gray-200/90 font-sans mb-4 italic px-2 leading-relaxed">
                    <VibeContentRenderer content={activePlan.main_description} />
                </p>
                <ul className="space-y-1.5 mb-4 text-left max-w-md mx-auto text-sm">
                    {activePlan.features.map((featureString: string, i: number) => {
                      const { iconVibeContent, textContent } = parseFeatureString(featureString);
                      return (
                        <li key={i} className="text-gray-200 font-mono flex items-start">
                          {iconVibeContent && <VibeContentRenderer content={`${iconVibeContent} `} />}
                          <span>
                            {textContent}
                          </span>
                        </li>
                      );
                    })}
                </ul>
                <p className="text-xs text-brand-yellow bg-black/20 p-2 rounded-md mb-4 font-semibold font-mono">
                    <VibeContentRenderer content={`**Для кого:** ${activePlan.who_is_this_for || ''}`} />
                </p>
                <p className="text-sm text-gray-100 font-mono">Статус ОС: <span className="text-brand-green font-bold">ОПТИМАЛЬНЫЙ</span>. VIBE Активирован!</p>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8">
            {UPDATED_SUBSCRIPTION_PLANS.map((sub) => (
              <motion.div
                key={sub.id}
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: UPDATED_SUBSCRIPTION_PLANS.indexOf(sub) * 0.1 }}
                whileHover={{ scale: 1.03 }} // Removed direct hsla color from boxShadow for Tailwind JIT
                className={`p-5 md:p-6 rounded-xl border shadow-xl flex flex-col justify-between bg-gradient-to-br ${sub.color} ${sub.id === "cyber_initiate_free_demo" && activeSubscriptionId === "cyber_initiate_free_demo" ? 'opacity-70 cursor-not-allowed' : ''} transition-all duration-300`}
              >
                <div>
                  <h3 className="text-2xl font-orbitron font-semibold text-light-text mb-3 flex items-center">
                    <VibeContentRenderer content={sub.iconString} /> <span className="ml-2">{sub.name}</span>
                  </h3>
                  <p className="text-3xl font-bold text-white mb-4 font-mono">{sub.xtrPrice}</p>
                  <p className="text-sm text-gray-200/90 font-sans mb-4 italic px-1 leading-relaxed">
                    <VibeContentRenderer content={sub.main_description} />
                  </p>
                  <ul className="space-y-1.5 mb-6 text-xs">
                    {sub.features.map((featureString, i) => {
                      const { iconVibeContent, textContent } = parseFeatureString(featureString);
                      return (
                        <li key={i} className="text-gray-200 font-mono flex items-start">
                           {iconVibeContent && <VibeContentRenderer content={`${iconVibeContent} `} />}
                           <span>
                             {textContent}
                           </span>
                        </li>
                      );
                    })}
                  </ul>
                   <p className="text-xs text-brand-yellow bg-black/20 p-2 rounded-md mb-4 font-semibold font-mono">
                     <VibeContentRenderer content={`**Для кого:** ${sub.who_is_this_for || ''}`} />
                   </p>
                </div>
                <Button
                  onClick={() => sub.id !== "cyber_initiate_free_demo" && setSelectedSubscription(sub)}
                  disabled={loading || sub.id === activeSubscriptionId || sub.id === "cyber_initiate_free_demo"}
                  className={`w-full mt-auto py-2.5 rounded-lg font-orbitron text-md transition-all duration-200 ease-in-out
                    ${selectedSubscription?.id === sub.id && sub.id !== "cyber_initiate_free_demo" ? "bg-brand-green text-black ring-2 ring-offset-2 ring-offset-current ring-brand-yellow shadow-lg"
                    : sub.id === activeSubscriptionId ? "bg-gray-600 text-gray-400 cursor-not-allowed"
                    : sub.id === "cyber_initiate_free_demo" ? "bg-gray-500 text-gray-300 cursor-not-allowed"
                    : "bg-dark-bg text-light-text hover:bg-brand-green hover:text-black hover:shadow-brand-green/50 focus:bg-brand-green focus:text-black"}`}
                >
                  {sub.id === activeSubscriptionId ? "Это ТЫ!" : selectedSubscription?.id === sub.id ? "Выбран для Апгрейда" : sub.cta}
                </Button>
              </motion.div>
            ))}
          </div>

          {activeSubscriptionId === "cyber_initiate_free_demo" && ( // Only show purchase button if on free tier
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
              className="mt-10 text-center"
            >
              <Button
                onClick={handlePurchase}
                disabled={!selectedSubscription || selectedSubscription.id === "cyber_initiate_free_demo" || loading || success}
                className={`px-8 py-3 rounded-xl font-orbitron text-lg transition-all duration-300 ease-in-out transform hover:scale-105
                  ${loading || success || !selectedSubscription || selectedSubscription.id === "cyber_initiate_free_demo" ? "bg-muted text-muted-foreground cursor-not-allowed animate-pulse"
                  : "bg-gradient-to-r from-brand-green to-neon-lime text-black hover:shadow-[0_0_20px_theme(colors.brand-green)] text-glow"}`}
              >
                {loading ? "Запрос на Апгрейд..." : success ? "Счет Отправлен в Telegram!" : "ЗАПУСТИТЬ АПГРЕЙД!"}
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
           {success && activeSubscriptionId === "cyber_initiate_free_demo" && (
             <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-center text-brand-green font-mono mt-6 text-lg"
             >
                Отлично, Агент! Мы отправили счет на апгрейд в твой Telegram. После успешной транзакции ОС будет обновлена автоматически. Заряжай VIBE!
             </motion.p>
           )}
        </motion.div>
      </main>
    </div>
  );
}
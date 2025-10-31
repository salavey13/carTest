"use client";
import { useState, useEffect } from "react";
import { useAppContext } from "@/contexts/AppContext";
import { sendTelegramInvoice } from "@/app/actions";
import { createInvoice } from "@/hooks/supabase";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import VibeContentRenderer from "@/components/VibeContentRenderer";
import { cn } from "@/lib/utils";

const parseFeatureString = (feature: string): { iconVibeContent: string | null, textContent: string } => {
    const featureMatch = feature.match(/^(::Fa\w+\b(?:.*?)?::)(.*)$/s); 
    if (featureMatch) {
        const iconVibeSyntax = featureMatch[1];
        const text = featureMatch[2].trim();
        return {
            iconVibeContent: iconVibeSyntax,
            textContent: text
        };
    }
    return { iconVibeContent: null, textContent: feature };
};

const WAREHOUSE_SUBSCRIPTION_PLANS = [
  {
    id: "warehouse_free",
    name: "Бесплатный старт",
    price: 0,
    xtrPrice: "0 XTR",
    iconString: "::FaRocket className='inline mr-2.5 text-green-500 text-2xl md:text-3xl align-middle'::",
    color: "from-gray-100 to-gray-200 border-gray-300 hover:border-green-500",
    cta: "Начать бесплатно",
    main_description: "**Идеально для тестирования и небольших складов.** Получите полный доступ к основным функциям без ограничения по времени. Начните оптимизировать склад уже сегодня!",
    features: [
      "::FaBox className='text-green-500 mr-2 align-middle w-4 h-4':: До 100 артикулов",
      "::FaWarehouse className='text-green-500 mr-2 align-middle w-4 h-4':: 1 склад и 3 сотрудника",
      "::FaSync className='text-green-500 mr-2 align-middle w-4 h-4':: Базовая синхронизация с WB",
      "::FaTelegram className='text-green-500 mr-2 align-middle w-4 h-4':: Telegram-интерфейс",
      "::FaChartBar className='text-green-500 mr-2 align-middle w-4 h-4':: Отчеты в CSV",
      "::FaEnvelope className='text-green-500 mr-2 align-middle w-4 h-4':: Поддержка по email"
    ],
    who_is_this_for: "Для начинающих и небольших магазинов до 100 артикулов. Идеально чтобы протестировать систему без риска.",
    hormozi_easter_egg_title: "::FaInfoCircle className='text-green-500':: БЕСПЛАТНО - ЭТО СЕРЬЕЗНО?",
    hormozi_easter_egg_content: `
**Да, абсолютно бесплатно и без скрытых платежей!**

Почему мы предлагаем бесплатный тариф?
- Вы можете протестировать ВСЕ основные функции
- Убедиться, что система подходит именно вам
- Ощутить реальную экономию времени
- Принять взвешенное решение о переходе на платный тариф

Когда вы увидите, как легко управлять складом через Telegram и насколько сокращаются ошибки - вы сами захотите большего!

**Начните сегодня - никакого риска!**
    `
  },
  {
    id: "warehouse_pro",
    name: "Профессиональный",
    price: 4900,
    xtrPrice: "49 XTR",
    iconString: "::FaCrown className='inline mr-2.5 text-blue-500 text-2xl md:text-3xl align-middle'::",
    color: "from-blue-50 to-blue-100 border-blue-300 hover:border-blue-500 shadow-blue-glow",
    cta: "Выбрать профессионал",
    main_description: "**Для растущего бизнеса с 2-3 магазинами.** Полный набор инструментов для эффективного управления складом и командой. Все необходимое для масштабирования!",
    features: [
      "::FaBoxes className='text-blue-500 mr-2 align-middle w-4 h-4':: До 500 артикулов",
      "::FaWarehouse className='text-blue-500 mr-2 align-middle w-4 h-4':: 3 склада и 10 сотрудников",
      "::FaSyncAlt className='text-blue-500 mr-2 align-middle w-4 h-4':: Полная синхронизация WB/Ozon/YM",
      "::FaUsers className='text-blue-500 mr-2 align-middle w-4 h-4':: Управление сменами",
      "::FaChartLine className='text-blue-500 mr-2 align-middle w-4 h-4':: Расширенные отчеты",
      "::FaMap className='text-blue-500 mr-2 align-middle w-4 h-4':: Визуализация склада",
      "::FaHeadset className='text-blue-500 mr-2 align-middle w-4 h-4':: Приоритетная поддержка",
      "::FaGraduationCap className='text-blue-500 mr-2 align-middle w-4 h-4':: Обучение команды (1 час)"
    ],
    who_is_this_for: "Для бизнеса с 2-3 магазинами и 500+ артикулами. Когда нужен полный контроль над складом и командой.",
    hormozi_easter_egg_title: "::FaBolt className='text-blue-500':: ПОЧЕМУ ИМЕННО ПРОФЕССИОНАЛ?",
    hormozi_easter_egg_content: `
**Потому что время - деньги, а ошибки стоят дорого!**

За 4 900₽ в месяц вы получаете:
- **Экономию 20+ часов в месяц** на рутинных операциях
- **Снижение недостач на 50-70%** - это 15 000-30 000₽ ежемесячно
- **Мгновенное обновление остатков** - больше никаких штрафов за просрочки
- **Контроль команды** - знайте, что происходит на складе в реальном времени

**Окупаемость в первый же месяц!** А с нашей гарантией - вы ничем не рискуете.

Попробуйте 14 дней бесплатно!
    `
  },
  {
    id: "warehouse_enterprise",
    name: "Предприятие",
    price: 14900,
    xtrPrice: "149 XTR",
    iconString: "::FaGem className='inline mr-2.5 text-purple-500 text-2xl md:text-3xl align-middle animate-pulse-slow'::",
    color: "from-purple-50 to-purple-100 border-purple-300 hover:border-purple-500 shadow-purple-glow",
    cta: "Для предприятия",
    main_description: "**Максимальная автоматизация для крупных сетей.** Индивидуальный подход, кастомные интеграции и гарантированный результат. Все для бесперебойной работы вашего бизнеса!",
    features: [
      "::FaInfinity className='text-purple-500 mr-2 align-middle w-4 h-4':: Безлимитные артикулы",
      "::FaCity className='text-purple-500 mr-2 align-middle w-4 h-4':: Неограниченное количество складов",
      "::FaPlug className='text-purple-500 mr-2 align-middle w-4 h-4':: Все маркетплейсы + кастомные интеграции",
      "::FaBrain className='text-purple-500 mr-2 align-middle w-4 h-4':: AI-аналитика и прогнозирование",
      "::FaUserTie className='text-purple-500 mr-2 align-middle w-4 h-4':: Dedicated менеджер",
      "::FaTools className='text-purple-500 mr-2 align-middle w-4 h-4':: Индивидуальные доработки",
      "::FaChalkboardTeacher className='text-purple-500 mr-2 align-middle w-4 h-4':: Обучение команды (5 часов)",
      "::FaShieldAlt className='text-purple-500 mr-2 align-middle w-4 h-4':: Гарантия снижения недостач на 50%+"
    ],
    who_is_this_for: "Для крупных сетей и бизнесов с высокими оборотами. Когда нужны индивидуальные решения и гарантированный результат.",
    hormozi_easter_egg_title: "::FaChessKing className='text-purple-500':: ДЛЯ ТЕХ, КТО ИГРАЕТ В ДОЛГУЮ",
    hormozi_easter_egg_content: `
**14 900₽ в месяц - это инвестиция в стабильность и рост.**

Что вы получаете:
- **Полную автоматизацию** складских процессов
- **Индивидуальные решения** под ваш бизнес
- **Гарантированное снижение недостач** на 50%+ или возврат денег
- **Персонального менеджера** который знает ваш бизнес
- **AI-прогнозирование** для оптимизации запасов

**Для компаний с оборотом 1M+ в месяц** наша система окупается за счет:
- Снижения штрафов на 50 000+ ₽/месяц
- Экономии 60+ часов управленческого времени
- Увеличения оборачиваемости товара на 15-20%

**Готовы к следующему уровню?** Давайте обсудим индивидуальные условия!
    `
  }
];

export default function BuySubscriptionPage() {
  const { user, isInTelegramContext, dbUser } = useAppContext();
  const [selectedSubscription, setSelectedSubscription] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeSubscriptionId, setActiveSubscriptionId] = useState<string>("warehouse_free");

  useEffect(() => {
    if (dbUser?.subscription_id && WAREHOUSE_SUBSCRIPTION_PLANS.find(s => s.id === dbUser.subscription_id)) {
      setActiveSubscriptionId(dbUser.subscription_id as string);
    } else {
      setActiveSubscriptionId("warehouse_free");
    }
  }, [dbUser]);

  const handlePurchase = async () => {
    if (!user?.id) {
      toast.error("Сначала авторизуйтесь в Telegram!");
      setError("Авторизуйтесь в Telegram");
      return;
    }
    if (!selectedSubscription || selectedSubscription.id === "warehouse_free") {
      toast.error("Выберите платный план для разблокировки всех функций!");
      setError("Выберите платный план");
      return;
    }
    if (activeSubscriptionId === selectedSubscription.id) {
      toast.info(`План "${selectedSubscription.name}" уже активен!`);
      setError(`План "${selectedSubscription.name}" уже активен`);
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(false);

    if (!isInTelegramContext && process.env.NODE_ENV === 'development') {
      toast.success(`ДЕМО: Счет для "${selectedSubscription.name}" создан!`);
      setLoading(false);
      setSuccess(true);
      setActiveSubscriptionId(selectedSubscription.id); 
      return;
    }

    try {
      const metadata = {
        type: "subscription_warehouse", 
        subscription_id: selectedSubscription.id, 
        subscription_name: selectedSubscription.name,
        subscription_price_stars: selectedSubscription.price, 
        userId: user.id.toString(),
        username: user.username || "unknown_tg_user",
      };
      const payload = `sub_wh_${user.id}_${selectedSubscription.id}_${Date.now()}`;

      const invoiceCreateResult = await createInvoice(
        "subscription_warehouse", 
        payload,                    
        user.id.toString(),         
        selectedSubscription.price, 
        selectedSubscription.id,    
        metadata                    
      );

      if (!invoiceCreateResult.success || !invoiceCreateResult.data) {
        throw new Error(invoiceCreateResult.error || "Не удалось создать запись о счете.");
      }
      
      const featuresTextForInvoice = selectedSubscription.features
        .map((feature: string) => parseFeatureString(feature).textContent)
        .slice(0, 2) 
        .join(', ');
      
      let descriptionForTelegram = `Разблокируй ${selectedSubscription.name}: ${featuresTextForInvoice}... и многое другое!`;
      descriptionForTelegram = descriptionForTelegram
        .replace(/::Fa\w+\b(?:.*?)?::/g, '')
        .replace(/\s{2,}/g, ' ')
        .trim();

      const response = await sendTelegramInvoice(
        user.id.toString(),
        `Складская автоматизация: ${selectedSubscription.name}`,
        descriptionForTelegram,
        payload, 
        selectedSubscription.price 
      );

      if (!response.success) {
        throw new Error(response.error || "Не удалось отправить счёт в Telegram.");
      }

      setSuccess(true);
      toast.success("Счёт отправлен в ваш Telegram! После оплаты система обновится автоматически.");

    } catch (err) {
      const errMsg = err instanceof Error ? err.message : "Неизвестная ошибка.";
      setError("Ошибка: " + errMsg);
      toast.error("Ошибка: " + errMsg, { duration: 7000 });
    } finally {
      setLoading(false);
    }
  };

  const activePlan = WAREHOUSE_SUBSCRIPTION_PLANS.find(s => s.id === activeSubscriptionId) || WAREHOUSE_SUBSCRIPTION_PLANS[0];

  return (
    <div className="min-h-screen pt-20 md:pt-24 bg-gradient-to-br from-blue-50 to-gray-100 pb-10">
      <main className="container mx-auto pt-8 md:pt-10 px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-6xl mx-auto p-6 sm:p-8 bg-white rounded-2xl shadow-lg border border-gray-200"
        >
          <h1 className="text-3xl sm:text-4xl font-bold text-center mb-4 text-gray-900">
            Выберите свой план автоматизации склада
          </h1>
          <p className="text-lg text-center text-gray-600 mb-8 max-w-2xl mx-auto">
            От бесплатного старта до полной автоматизации предприятия
          </p>

          {activeSubscriptionId !== "warehouse_free" && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.2, duration: 0.5 }}
              className={`mb-8 p-6 rounded-2xl border-2 ${activePlan.color.split(' ').pop()} bg-gradient-to-br ${activePlan.color}`}
            >
              <h3 className="text-2xl font-bold mb-3 flex items-center justify-center">
                <VibeContentRenderer content={activePlan.iconString} /> 
                <span className="ml-2">{activePlan.name}</span>
              </h3>
              <p className="text-xl font-bold text-center mb-2">{activePlan.xtrPrice} / месяц</p>
              <p className="text-sm text-center text-gray-700 mb-4">
                <VibeContentRenderer content={activePlan.main_description} />
              </p>
              <p className="text-center text-green-600 font-semibold">
                ✅ Активный план
              </p>
            </motion.div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
            {WAREHOUSE_SUBSCRIPTION_PLANS.map((sub, index) => (
              <motion.div
                key={sub.id}
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.15 }}
                className={`p-6 rounded-xl border-2 ${sub.color} bg-white hover:shadow-lg transition-all duration-300 ${
                  activeSubscriptionId === sub.id ? 'ring-2 ring-blue-500 scale-105' : ''
                }`}
              >
                <div className="text-center mb-4">
                  <VibeContentRenderer content={sub.iconString} />
                  <h3 className="text-xl font-bold mt-2 text-gray-900">{sub.name}</h3>
                  <p className="text-2xl font-bold my-2">{sub.xtrPrice}</p>
                </div>

                <p className="text-sm text-gray-600 mb-4 text-center">
                  <VibeContentRenderer content={sub.main_description} />
                </p>

                <ul className="space-y-2 mb-6">
                  {sub.features.map((featureString, i) => {
                    const { iconVibeContent, textContent } = parseFeatureString(featureString);
                    return (
                      <li key={i} className="text-sm text-gray-700 flex items-start">
                        {iconVibeContent && <VibeContentRenderer content={iconVibeContent} />}
                        <VibeContentRenderer content={textContent} />
                      </li>
                    );
                  })}
                </ul>

                <div className="text-center">
                  <Button
                    onClick={() => sub.id !== "warehouse_free" && setSelectedSubscription(sub)}
                    disabled={sub.id === activeSubscriptionId || sub.id === "warehouse_free"}
                    className={`w-full ${
                      selectedSubscription?.id === sub.id && sub.id !== "warehouse_free" 
                        ? "bg-green-600 hover:bg-green-700" 
                        : sub.id === activeSubscriptionId 
                        ? "bg-gray-400 cursor-not-allowed"
                        : sub.id === "warehouse_free"
                        ? "bg-gray-500 cursor-not-allowed"
                        : "bg-blue-600 hover:bg-blue-700"
                    } text-white`}
                  >
                    {sub.id === activeSubscriptionId ? "Активный план"
                    : selectedSubscription?.id === sub.id ? "Выбрано для оплаты"
                    : sub.cta}
                  </Button>
                </div>
              </motion.div>
            ))}
          </div>

          {selectedSubscription && selectedSubscription.id !== activeSubscriptionId && selectedSubscription.id !== "warehouse_free" && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-center p-6 bg-blue-50 rounded-xl border border-blue-200"
            >
              <h3 className="text-xl font-bold mb-4 text-blue-800">
                Вы выбрали: {selectedSubscription.name}
              </h3>
              <Button
                onClick={handlePurchase}
                disabled={loading}
                className="bg-green-600 hover:bg-green-700 text-white px-8 py-3 text-lg"
              >
                {loading ? "Обработка..." : "Перейти к оплате"}
              </Button>
              {error && (
                <p className="text-red-600 mt-3 text-sm">
                  {error}
                </p>
              )}
            </motion.div>
          )}

          {/* Additional Services */}
          <div className="mt-12 p-6 bg-gray-50 rounded-xl border border-gray-200">
            <h3 className="text-2xl font-bold text-center mb-6 text-gray-900">Дополнительные услуги</h3>
            <div className="grid md:grid-cols-2 gap-6 max-w-2xl mx-auto">
              <div className="text-center p-4 border border-gray-300 rounded-lg bg-white">
                <h4 className="text-lg font-bold mb-2">🚀 Быстрая настройка</h4>
                <p className="text-2xl font-bold mb-1">20 000₽</p>
                <p className="text-sm text-gray-600 mb-3">единоразово</p>
                <Button variant="outline" className="w-full">
                  Заказать настройку
                </Button>
              </div>
              <div className="text-center p-4 border border-gray-300 rounded-lg bg-white">
                <h4 className="text-lg font-bold mb-2">👨‍🏫 Обучение команды</h4>
                <p className="text-2xl font-bold mb-1">10 000₽</p>
                <p className="text-sm text-gray-600 mb-3">единоразово</p>
                <Button variant="outline" className="w-full">
                  Заказать обучение
                </Button>
              </div>
            </div>
          </div>
        </motion.div>
      </main>
    </div>
  );
}
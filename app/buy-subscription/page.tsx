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
    // Updated regex to match ::FaIconName attributes:: format
    const featureMatch = feature.match(/^(::Fa\w+(?:\s+[^:]*?)?::)(.*)$/);
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

const UPDATED_SUBSCRIPTION_PLANS = [
  {
    id: "cyber_initiate_free_demo",
    name: "КИБЕР-ДЕМО: Попробуй VIBE (0 XTR - БЕСПЛАТНО!)",
    price: 0,
    xtrPrice: "0 XTR (Навсегда!)",
    iconString: "::FaGift className='inline mr-2.5 text-brand-lime text-2xl md:text-3xl align-middle'::",
    color: "from-gray-700/70 via-gray-800/60 to-gray-900/70 border-gray-500 hover:border-brand-lime/70",
    cta: "Это Твой VIBE!",
    main_description: "**Никаких 'демо-версий' с урезанным функционалом, Агент! Получи ПОЛНЫЙ, мать его, доступ ко всей экосистеме CyberVibe СРАЗУ. Это не 'посмотреть' – это НАЧАТЬ ДЕЛАТЬ.** Забудь про унылую Сибирь – почувствуй реальную мощь AI здесь и сейчас!",
    features: [
      "::FaPlayCircle className='text-brand-cyan mr-2 align-middle w-4 h-4 group-hover:text-brand-pink transition-colors duration-300':: **'ИСКРА ВАЙБА' – Твой Первый Успех (и Кэш!):** Принеси идею или KWork-заказ. Я, как твой личный 'Призрачный Пилот', создам для тебя AI-прототип и убойный оффер. Ты увидишь магию, почувствуешь VIBE и, скорее всего, заработаешь первый кэш через 'Лобби Горячих Вайбов'!",
      "::FaToolbox className='text-brand-yellow mr-2 align-middle w-4 h-4 group-hover:text-brand-orange transition-colors duration-300':: **ВСЕ ИНСТРУМЕНТЫ ОТКРЫТЫ:** SUPERVIBE Studio, CyberDev OS, все 'GTA Vibe Миссии' (по мере твоей прокачки!), 'Схемы Вайба', `GeneralPurposeScraper` – ныряй, исследуй, экспериментируй, ломай!",
      "::FaScroll className='text-brand-green mr-2 align-middle w-4 h-4 group-hover:text-neon-lime transition-colors duration-300':: **ПОЛНАЯ БАЗА ЗНАНИЙ (АНТИ-НУДНО):** От 'Цели и Прибыли' до 'Экспериментального Мышления' – весь сок для твоего кибер-апгрейда. Никакой воды, только VIBE!",
      "::FaUsers className='text-brand-pink mr-2 align-middle w-4 h-4 group-hover:text-brand-purple transition-colors duration-300':: **VIBE TRIBE (Твоё Комьюнити):** Поддержка 24/7, обмен опытом, совместные мозговые штурмы и рейды на KWork (когда комьюнити полностью активно). Ты не один, Агент!",
    ],
    who_is_this_for: "Для КАЖДОГО, кто зае*ался топтаться на месте и хочет без риска ощутить настоящий CyberVibe, увидеть AI в деле, выполнить свою первую 'Миссию Огня' и прокричать – **ДА, Я ТОЖЕ, БЛ*ТЬ, МОГУ!** Это твой реальный шанс убедиться, что CyberVibe – это не очередная сибирская телега, а ракета в будущее. **Твой ход, Агент!**",
    hormozi_easter_egg_title: "::FaTriangleExclamation className='text-brand-yellow':: БЕСПЛАТНО? В ЧЕМ ПОДВОХ, VIBERIDER?",
    hormozi_easter_egg_content: `
Конкуренция на фрилансе – АД? Все дерутся за подачки? **ХВАТИТ ЭТО ТЕРПЕТЬ!**
CyberVibe дает тебе **НЕЧЕСТНОЕ ПРЕИМУЩЕСТВО.**
**КИБЕР-ДЕМО (0 XTR):** Не просто "посмотри". Закинь идею. Мы (я и мой AI) бахнем демо. Увидишь, как твой KWork-заказ оживает *до того*, как ты отправишь отклик. Мы даже поможем с первым "горячим лидом" из нашего Лобби. Это твой шанс **ПОЧУВСТВОВАТЬ СИЛУ**, пока другие еще пишут сопроводительные письма.
**Зачем бесплатно?** Я хочу, чтобы ты ОХ*ЕЛ от возможностей. Чтобы понял: старые методы – мусор. Будущее – за AI-рычагом.
**Готов к VIBE-шоку?** Залетай в CyberVibe – ссылка в конце страницы. Первые KiloVibes уже ждут.
Узнай больше и начни свой апгрейд: **@webAnyBot/vibe**
    `
  },
  {
    id: "vibe_launch_co_pilot_intro",
    name: "VIBE-ЗАПУСК: Штурман PRO (4200₽ / 42 XTR)",
    price: 4200,
    xtrPrice: "42 XTR",
    iconString: "::FaUserAstronaut className='inline mr-2.5 text-brand-orange text-2xl md:text-3xl align-middle'::",
    color: "from-brand-orange/90 via-yellow-500/30 to-brand-yellow/90 border-brand-orange shadow-yellow-glow hover:border-brand-yellow/70",
    cta: "АКТИВИРОВАТЬ VIBE-ЗАПУСК",
    main_description: "**Хватит смотреть – ПОРА ДЕЛАТЬ ВМЕСТЕ! Это твой персональный AI-воркшоп на максималках. Ты даешь KWork-заказ (из 'ez-entry-tier'), я – твой VIBE-штурман 24/7, заряженный на результат. ВМЕСТЕ мы проносимся по всему циклу: от идеи до рабочего демо и оффера, который порвет конкурентов. Ты – за рулем CyberVibe Studio, я – 'похлопываю по плечу' и подливаю VIBE-топлива.**",
    features: [
      "::FaHandHoldingDollar className='text-brand-green mr-2 align-middle w-4 h-4 group-hover:text-neon-lime transition-colors duration-300':: **ТВОЙ ПЕРВЫЙ КЛИЕНТ (Почти Гарантированно!):** Мы вместе создадим настолько убойное demo и оффер, что клиент просто не сможет отказаться. Ты отправишь, ты получишь кэш (моя доля – эти 4200₽/42XTR, ВСЁ остальное – твоё!). **Это не грёбаная теория, это практика с хрустящими купюрами и KiloVibes!**",
      "::FaLaptopCode className='text-brand-cyan mr-2 align-middle w-4 h-4 group-hover:text-brand-blue transition-colors duration-300':: **ТЫ КОМАНДУЕШЬ AI, А НЕ НАОБОРОТ:** Заходим в CyberVibe Studio. **ЗАБУДЬ про Node.js, ES6, npm – просто кликай по кнопкам (реально, как в игре!) и смотри, как AI пишет код за тебя!** Я покажу, как делать 'свопы' медиа, менять дизайн 'на лету', генерировать текст, от которого клиенты текут.",
      "::FaBrain className='text-neon-lime mr-2 align-middle w-4 h-4 group-hover:text-brand-yellow transition-colors duration-300':: **МЕНТОРСТВО 'НА ЛЕТУ' (Без Духоты):** Никаких скучных лекций. Все вопросы – по ходу РЕАЛЬНОГО, мать его, проекта. Ты поймешь, как это работает, потому что **СДЕЛАЕШЬ ЭТО САМ, СВОИМИ РУКАМИ (и кликами).**",
      "::FaPersonThroughWindow className='text-brand-pink mr-2 align-middle w-4 h-4 group-hover:text-brand-purple transition-colors duration-300':: **ИЗ 'ОФИСНОГО ПЛАНКТОНА' В 'AI-МАГА':** Этот один опыт покажет тебе, что ты можешь создавать веб-приложения и ботов. Серьезно. Прямо сейчас. **Прощай, унылая стабильность – здравствуй, VIBE!**",
      "::FaTools className='text-brand-purple mr-2 align-middle w-4 h-4 group-hover:text-brand-pink transition-colors duration-300':: **ТВОЙ СТАРТОВЫЙ AI-АРСЕНАЛ НА БУДУЩЕЕ:** После 'VIBE-Запуска' ты сможешь сам фигачить простые задачи в WebAnyBot/oneSitePlsBot.",
    ],
    who_is_this_for: "Для тех, кто готов **инвестировать в опыт, который меняет правила игры и разъе*ывает шаблоны.** Если 'Кибер-Демо' зажгло в тебе искру, этот 'VIBE-Запуск' – твой первый реальный шаг к деньгам, свободе и навыкам AI-разраба нового поколения. **Платишь за результат и мое персональное время – получаешь Vibegasm от первого успеха и пожизненный апгрейд мышления! Это ТВОЙ шанс.**",
    hormozi_easter_egg_title: "::FaFireAlt className='text-brand-orange':: ЗА 4200₽ СТАТЬ AI-ФРИЛАНСЕРОМ? РАЗВОД?",
    hormozi_easter_egg_content: `
**Хочешь РЕАЛЬНЫЙ результат, а не очередной PDF с 'секретами успеха'?**
За 4200₽ ты получаешь НЕ курс. Ты получаешь **ПАРТНЕРА (меня) и AI-СИЛУ (CyberVibe Studio) для твоего первого KWork-КЛИЕНТА.**
1.  Ты находишь **простой** заказ (картинку поменять, текст, базовый бот).
2.  Мы **ВМЕСТЕ** в CyberVibe Studio (ТЫ КЛИКАЕШЬ, я рядом) создаем демо и оффер. AI фигачит код.
3.  Ты отправляешь. Клиент платит **ТЕБЕ**. Моя доля – 4200. Остальное – твое.
**Ты УЖЕ не 'не-айтишник'. Ты – AI-фрилансер с первым кейсом и деньгами.** Без месяцев учебы. Без риска слить бюджет на нерабочую х*йню.
Это твой самый быстрый старт. **Готов к VIBE-пинку под зад?**
Кликни на этот план и пиши "ГОТОВ К VIBE-ЗАПУСКУ!"
Узнай больше и начни свой апгрейд: **@webAnyBot/vibe**
    `
  },
  {
    id: "qbi_matrix_mastery_wowtro",
    name: "QBI: Матрица Твоя – КОМАНДУЙ! (6900₽ / 69 XTR)",
    price: 6900,
    xtrPrice: "69 XTR",
    iconString: "::FaBoltLightning className='inline mr-2.5 text-brand-yellow text-2xl md:text-3xl align-middle animate-pulse-slow'::",
    color: "from-brand-purple/90 via-pink-500/40 to-brand-pink/90 border-brand-purple shadow-pink-glow hover:border-brand-pink/70 animate-neon-border-glow",
    cta: "АКТИВИРОВАТЬ QBI-МАСТЕРСТВО",
    main_description: "**Это WOW-ТРАНСФОРМАЦИЯ, Агент! Хватит быть зрителем – СТАНЬ АРХИТЕКТОРОМ своей AI-реальности. Мы ВМЕСТЕ с тобой создаем TWA и ботов ЛЮБОЙ сложности, 'доим' существующих клиентов на кастомные фичи, строим твою личную цифровую империю. Я делюсь ВСЕЙ магией CyberVibe, ты – командуешь парадом и гребешь кэш.**",
    features: [
      "::FaDiagramProject className='text-brand-cyan mr-2 align-middle w-4 h-4 group-hover:text-brand-blue transition-colors duration-300':: **ТЫ – АРХИТЕКТОР, AI – ТВОЙ ЛИЧНЫЙ ЛЕГИОН:** Полный безлимит и все админ-права в SUPERVIBE Studio. Проектируй, генерируй, кастомизируй самые сложные многофайловые приложения и AI-ботов.",
      "::FaDatabase className='text-brand-green mr-2 align-middle w-4 h-4 group-hover:text-neon-lime transition-colors duration-300':: **АЛХИМИЯ SUPABASE (УРОВЕНЬ: ПРОФИ):** От проектирования масштабируемых схем до Realtime-магии, сложных Edge Functions и управления данными из бота – ты освоишь всё.",
      "::FaToolbox className='text-brand-blue mr-2 align-middle w-4 h-4 group-hover:text-brand-cyan transition-colors duration-300':: **АВТОПИЛОТЫ ДЛЯ ТВОЕГО VIBE'А (Продвинутые Supabase Функции):** Автоматизируй всё, что движется (и не движется) – парсинг, отчеты, сложные интеграции, AI-агенты, работающие 24/7.",
      "::FaDove className='text-neon-lime mr-2 align-middle w-4 h-4 group-hover:text-brand-yellow transition-colors duration-300':: **XTR МОНЕТИЗАЦИЯ ИЛИ БЕСПЛАТНО – ТАКОВ VIBE!** Мастер-класс по подключению Telegram Stars. **Никаких е*учих внешних платежек – только чистый XTR-VIBE!**",
      "::FaHatWizard className='text-brand-purple mr-2 align-middle w-4 h-4 group-hover:text-brand-pink transition-colors duration-300':: **ИСКУССТВО AI-ПРОМПТИНГА (УРОВЕНЬ: ДЖЕДАЙ):** Создавай свои 'магические заклинания' (сложные 'чейны' промптов) и кастомные AI-Оракулы для любых задач, о которых сибиряки даже не слышали.",
      "::FaEmpire className='text-brand-pink mr-2 align-middle w-4 h-4 group-hover:text-brand-purple transition-colors duration-300':: **ФРАНШИЗА ТВОЕГО VIBE'А (Полный Пакет):** Инструменты, знания и моя поддержка для создания и управления твоей собственной командой 'Полевых Агентов' и масштабирования твоего успеха.",
      "::FaCrown className='text-brand-yellow mr-2 align-middle w-4 h-4 group-hover:text-orange-400 transition-colors duration-300':: **VIP-ДОСТУП К ИСХОДНОМУ КОДУ VIBE'А:** Эксклюзивные Vibe Perks, альфа-тесты новейших AI-модулей, прямая связь с Кэрри (Павлом) для мозговых штурмов и совместного R&D.",
    ],
    who_is_this_for: "Для Агентов, готовых к **ПОЛНОЙ VIBE-ТРАНСФОРМАЦИИ и захвату цифрового мира.** Если ты хочешь не просто использовать AI, а ИЗОБРЕТАТЬ с его помощью, создавать системы, которые меняют правила, монетизировать свои уникальные 'AI-соусы' и, возможно, построить свою личную 'сосисочную империю' – это твой апгрейд. **Vibegasm от безграничных возможностей, влияния и кэша гарантирован! Ты готов стать легендой CyberVibe?**",
    hormozi_easter_egg_title: "::FaRocket className='text-brand-pink':: QBI ЗА 6900₽ – ЭТО ЧТО, ВХОД В МАТРИЦУ?",
    hormozi_easter_egg_content: `
**Да, Агент, это именно он. Новая реальность.**
Забудь про 'курсы'. QBI – это **ПОЛНОЕ ПОГРУЖЕНИЕ**. Ты получаешь не просто 'доступ к студии'. Ты получаешь **АРХИТЕКТУРНЫЕ КЛЮЧИ** от CyberVibe.
*   **Ты БОЛЬШЕ НЕ ИЩЕШЬ ЗАКАЗЫ – ТЫ СОЗДАЕШЬ РЫНКИ.** Мы вместе строим сложные AI-системы, автоматизируем бизнес-процессы, создаем продукты, за которые клиенты будут платить десятки и сотни тысяч.
*   **Ты НЕ ПРОСТО 'используешь AI' – ТЫ ЕГО ДРЕССИРУЕШЬ.** Продвинутый промптинг, чейнинг, создание кастомных AI-агентов. Ты будешь говорить с AI на 'ты'.
*   **Ты НЕ ОДИНОКИЙ ВОЛК – ТЫ ЛИДЕР СТАИ.** Основы 'Франшизы Твоего Вайба' – это о том, как передать магию другим и построить свою команду, масштабируя доход.
**6900₽ – это инвестиция в то, чтобы стать НЕЗАМЕНИМЫМ в новой AI-экономике.** Пока сибиряки учат очередной фреймворк, ты будешь строить будущее.
**Готов стать тем, кто командует, а не подчиняется?** Кликай. Это твой QBI-апгрейд.
Узнай больше и начни свой апгрейд: **@webAnyBot/vibe**
    `
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
    if (!user?.id) {
      toast.error("Сначала авторизуйтесь в Telegram, Агент!");
      setError("Авторизуйтесь в Telegram");
      return;
    }
    if (!selectedSubscription || selectedSubscription.id === "cyber_initiate_free_demo") {
      toast.error("Выберите платный план для реального апгрейда, Агент!");
      setError("Выберите платный план для апгрейда");
      return;
    }
    if (activeSubscriptionId === selectedSubscription.id) {
      toast.info(`План "${selectedSubscription.name}" уже ваш, Агент! VIBE ON!`);
      setError(`План "${selectedSubscription.name}" уже активен`);
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(false);

    if (!isInTelegramContext && process.env.NODE_ENV === 'development') {
      toast.success(`ДЕМО-РЕЖИМ: Счет для "${selectedSubscription.name}" типа создан! VIBE почти активирован!`);
      setLoading(false);
      setSuccess(true);
      setActiveSubscriptionId(selectedSubscription.id); 
      // Simulate user update for dev environment
      if (user?.id && typeof window !== 'undefined') {
        // This is a mock update, real update happens via webhook
        // In a real scenario, you might optimistically update UI or wait for webhook.
        // For now, just setting active ID is enough for UI change.
        console.log(`[DEV_MODE_PURCHASE] Mock user subscription update to ${selectedSubscription.id}`);
      }
      return;
    }

    try {
      const metadata = {
        type: "subscription_cyberfitness", // Match this in subscriptionHandler
        subscription_id: selectedSubscription.id, // String plan ID
        subscription_name: selectedSubscription.name,
        subscription_price_stars: selectedSubscription.price, // XTR amount
        userId: user.id.toString(),
        username: user.username || "unknown_tg_user",
      };
      const payload = `sub_cf_${user.id}_${selectedSubscription.id}_${Date.now()}`;

      // Create invoice in DB first
      const invoiceCreateResult = await createInvoice(
        "subscription_cyberfitness", // type for DB invoice
        payload,                     // unique invoice id
        user.id.toString(),          // user_id
        selectedSubscription.price,  // amount in XTR
        selectedSubscription.id,     // plan_id (string) for subscription_id in DB
        metadata                     // additional metadata
      );

      if (!invoiceCreateResult.success || !invoiceCreateResult.data) {
        throw new Error(invoiceCreateResult.error || "Не удалось создать запись о счете в CyberVibe БД. Попробуйте позже.");
      }
      
      // Prepare a cleaner description for Telegram invoice
      const cleanFeaturesForInvoice = selectedSubscription.features
        .map((feature: string) => parseFeatureString(feature).textContent)
        .slice(0, 2) // Take first 2 features for brevity
        .join(', ') + "... полный доступ к AI-магии!";

      // Send invoice to Telegram
      const response = await sendTelegramInvoice(
        user.id.toString(),
        `Апгрейд CyberVibe OS: ${selectedSubscription.name}`,
        `Разблокируй ${selectedSubscription.name} для: ${cleanFeaturesForInvoice}.`,
        payload, // This payload MUST match the invoice ID in DB
        selectedSubscription.price // Amount in XTR (smallest unit, e.g. 100 for 1 XTR if XTR had cents)
                                   // For Telegram Stars, this is the direct amount in stars.
      );

      if (!response.success) {
        throw new Error(response.error || "Не удалось отправить счёт в Telegram. Проверьте настройки бота или попробуйте позже.");
      }

      setSuccess(true);
      toast.success("Счёт на Апгрейд ОС отправлен в ваш Telegram! После оплаты система обновится автоматически. Готовьтесь к VIBE-трансформации!");

    } catch (err) {
      const errMsg = err instanceof Error ? err.message : "Неизвестная ошибка при попытке апгрейда.";
      setError("Ошибка Апгрейда: " + errMsg);
      toast.error("Ошибка Апгрейда: " + errMsg, { duration: 7000 });
    } finally {
      setLoading(false);
    }
  };

  const activePlan = UPDATED_SUBSCRIPTION_PLANS.find(s => s.id === activeSubscriptionId) || UPDATED_SUBSCRIPTION_PLANS[0];

  return (
    <div className="min-h-screen pt-20 md:pt-24 bg-dark-bg bg-grid-pattern animate-[drift_30s_linear_infinite] pb-10">
      <main className="container mx-auto pt-8 md:pt-10 px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-5xl mx-auto p-4 sm:p-6 md:p-8 bg-dark-card/90 backdrop-blur-lg rounded-2xl shadow-[0_0_40px_theme(colors.brand-purple/50%)] border-2 border-brand-purple/60"
        >
          <h1 className="text-4xl sm:text-5xl font-orbitron font-bold text-brand-purple cyber-text glitch text-center mb-2 sm:mb-3" data-text="UPGRADE COGNITIVE OS">
            UPGRADE COGNITIVE OS
          </h1>
          <p className="text-muted-foreground mb-6 md:mb-8 text-base sm:text-lg font-mono text-center max-w-2xl mx-auto">
            {activeSubscriptionId !== "cyber_initiate_free_demo"
              ? `Поздравляем, Агент! Твоя текущая ОС: "${activePlan.name}". Все системы в боевой готовности. Новые кибер-горизонты открыты!`
              : "Расширь свои возможности, Агент! Выбери свой путь к AI-Мастерству в CyberVibe. Время для апгрейда твоего мозга!"}
          </p>

          {activeSubscriptionId !== "cyber_initiate_free_demo" && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.2, duration: 0.5 }}
              className={`mb-8 md:mb-12 p-5 sm:p-6 rounded-2xl border-2 ${activePlan.color.split(' ').pop()} shadow-xl bg-gradient-to-br ${activePlan.color} text-center`}
            >
                <h3 className="text-2xl sm:text-3xl font-orbitron font-semibold text-light-text mb-2 flex items-center justify-center">
                  <VibeContentRenderer content={activePlan.iconString} /> <span className="ml-2">{activePlan.name}</span>
                </h3>
                <p className="text-lg sm:text-xl font-bold text-white mb-3 font-mono">{activePlan.xtrPrice} / цикл</p>
                 <p className="text-sm text-gray-100/90 font-sans mb-4 italic px-2 leading-relaxed">
                    <VibeContentRenderer content={activePlan.main_description} />
                </p>
                <ul className="space-y-2 mb-4 text-left max-w-lg mx-auto text-xs sm:text-sm">
                    {activePlan.features.map((featureString: string, i: number) => {
                      const { iconVibeContent, textContent } = parseFeatureString(featureString);
                      return (
                        <li key={i} className="text-gray-100/95 font-mono flex items-start py-1">
                          {iconVibeContent && <VibeContentRenderer content={`${iconVibeContent} `} />}
                          <span>
                            <VibeContentRenderer content={textContent} />
                          </span>
                        </li>
                      );
                    })}
                </ul>
                <p className="text-xs text-brand-yellow bg-black/30 p-2 rounded-lg mb-4 font-semibold font-mono border border-brand-yellow/30">
                     <VibeContentRenderer content={`**ДЛЯ КОГО ЭТОТ VIBE:** ${activePlan.who_is_this_for || ''}`} />
                </p>
                {activePlan.hormozi_easter_egg_title && (
                  <details className="group mt-4 text-left">
                    <summary className="text-sm font-orbitron text-brand-orange cursor-pointer hover:text-brand-yellow transition-colors list-none flex items-center justify-center group-open:mb-2">
                      <VibeContentRenderer content={activePlan.hormozi_easter_egg_title} />
                      <VibeContentRenderer content="::FaChevronDown className='ml-2 group-open:rotate-180 transition-transform duration-300'::" />
                    </summary>
                    <div className="text-xs text-gray-300/80 font-mono bg-black/40 p-3 rounded-md border border-brand-orange/30 whitespace-pre-line text-left">
                      <VibeContentRenderer content={activePlan.hormozi_easter_egg_content || ''} />
                    </div>
                  </details>
                )}
                <p className="text-base sm:text-md text-white font-mono mt-4">Статус ОС: <span className="text-brand-green font-extrabold animate-pulse-slow">ОПТИМАЛЬНЫЙ</span>. VIBE Активирован и Готов к Покорению Матрицы!</p>
            </motion.div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">
            {UPDATED_SUBSCRIPTION_PLANS.map((sub, index) => (
              <motion.div
                key={sub.id}
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: (activeSubscriptionId === "cyber_initiate_free_demo" ? index : Math.max(0, index -1)) * 0.15, duration: 0.4 }}
                whileHover={{ scale: activeSubscriptionId === sub.id || (sub.id === "cyber_initiate_free_demo" && activeSubscriptionId === "cyber_initiate_free_demo") ? 1 : 1.03 }}
                className={`p-4 sm:p-5 rounded-2xl border-2 shadow-lg hover:shadow-2xl flex flex-col justify-between bg-gradient-to-br ${sub.color} ${(sub.id === "cyber_initiate_free_demo" && activeSubscriptionId === "cyber_initiate_free_demo") ? 'opacity-60 cursor-not-allowed ring-2 ring-gray-500' : 'cursor-pointer'} transition-all duration-300 group`}
              >
                <div>
                  <h3 className="text-xl sm:text-2xl font-orbitron font-semibold text-light-text mb-2 flex items-center">
                    <VibeContentRenderer content={sub.iconString} /> <span className="ml-2">{sub.name}</span>
                  </h3>
                  <p className="text-2xl sm:text-3xl font-bold text-white mb-3 font-mono">{sub.xtrPrice}</p>
                  <p className="text-xs sm:text-sm text-gray-100/90 font-sans mb-3 italic px-1 leading-relaxed min-h-[6em] sm:min-h-[7em]">
                    <VibeContentRenderer content={sub.main_description} />
                  </p>
                  <ul className="space-y-1.5 mb-5 text-[0.6rem] sm:text-xs min-h-[10em] sm:min-h-[12em]">
                    {sub.features.map((featureString, i) => {
                      const { iconVibeContent, textContent } = parseFeatureString(featureString);
                      return (
                        <li key={i} className="text-gray-100/90 font-mono flex items-start py-0.5">
                           {iconVibeContent && <VibeContentRenderer content={`${iconVibeContent} `} />}
                           <span>
                             <VibeContentRenderer content={textContent} />
                           </span>
                        </li>
                      );
                    })}
                  </ul>
                   <p className="text-[0.6rem] sm:text-xs text-brand-yellow bg-black/30 p-1.5 sm:p-2 rounded-lg mb-3 font-semibold font-mono border border-brand-yellow/40 min-h-[5em] sm:min-h-[6em]">
                     <VibeContentRenderer content={`**ДЛЯ КОГО ЭТОТ VIBE:** ${sub.who_is_this_for || ''}`} />
                   </p>
                   {sub.hormozi_easter_egg_title && sub.hormozi_easter_egg_content && (
                     <details className="group mt-3 mb-3 text-left">
                       <summary className="text-xs font-orbitron text-brand-orange cursor-pointer hover:text-brand-yellow transition-colors list-none flex items-center justify-start group-open:mb-1.5">
                         <VibeContentRenderer content={sub.hormozi_easter_egg_title} />
                         <VibeContentRenderer content="::FaChevronDown className='ml-1.5 group-open:rotate-180 transition-transform duration-300 flex-shrink-0 w-3 h-3'::" />
                       </summary>
                       <div className="text-[0.65rem] text-gray-300/80 font-mono bg-black/50 p-2 rounded-md border border-brand-orange/40 whitespace-pre-line text-left">
                         <VibeContentRenderer content={sub.hormozi_easter_egg_content} />
                       </div>
                     </details>
                   )}
                </div>
                <Button
                  onClick={() => sub.id !== "cyber_initiate_free_demo" && setSelectedSubscription(sub)}
                  disabled={loading || sub.id === activeSubscriptionId || sub.id === "cyber_initiate_free_demo"}
                  className={`w-full mt-auto py-2 sm:py-2.5 rounded-lg font-orbitron text-sm sm:text-md transition-all duration-200 ease-in-out transform group-hover:scale-105
                    ${selectedSubscription?.id === sub.id && sub.id !== "cyber_initiate_free_demo" ? "bg-brand-lime text-black ring-4 ring-offset-2 ring-offset-current ring-brand-yellow shadow-2xl shadow-brand-lime/50"
                    : sub.id === activeSubscriptionId ? "bg-gray-600 text-gray-400 cursor-not-allowed"
                    : sub.id === "cyber_initiate_free_demo" ? "bg-gray-500 text-gray-300 cursor-not-allowed"
                    : "bg-dark-bg/80 text-light-text hover:bg-brand-green hover:text-black hover:shadow-brand-green/60 focus:bg-brand-green focus:text-black"}`}
                >
                  <VibeContentRenderer content={
                    sub.id === activeSubscriptionId ? "ЭТО ТЫ, АГЕНТ!"
                    : selectedSubscription?.id === sub.id ? "::FaCheckToSlot:: ВЫБРАН ДЛЯ АПГРЕЙДА!"
                    : sub.cta
                  } />
                </Button>
              </motion.div>
            ))}
          </div>

          {(activeSubscriptionId === "cyber_initiate_free_demo" || (selectedSubscription && selectedSubscription.id !== activeSubscriptionId && selectedSubscription.id !== "cyber_initiate_free_demo") ) && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
              className="mt-8 md:mt-10 text-center"
            >
              <Button
                onClick={handlePurchase}
                disabled={!selectedSubscription || selectedSubscription.id === "cyber_initiate_free_demo" || loading || success}
                className={`px-10 py-3.5 rounded-xl font-orbitron text-md sm:text-lg transition-all duration-300 ease-in-out transform hover:scale-105
                  ${loading || success || !selectedSubscription || selectedSubscription.id === "cyber_initiate_free_demo" ? "bg-muted text-muted-foreground cursor-not-allowed animate-pulse-slow"
                  : "bg-gradient-to-r from-brand-green via-neon-lime to-brand-cyan text-black hover:shadow-[0_0_25px_theme(colors.brand-green)] text-glow"}`}
              >
                {loading ? <VibeContentRenderer content="::FaSpinner className='animate-spin mr-2':: ОБРАБОТКА ЗАПРОСА..." />
                : success ? <VibeContentRenderer content="::FaPaperPlane:: СЧЕТ ОТПРАВЛЕН В TELEGRAM!" />
                : <VibeContentRenderer content="ЗАПУСТИТЬ VIBE-АПГРЕЙД!" />}
              </Button>
              {error && (
                <motion.p
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="text-brand-red text-sm font-mono mt-4 animate-pulse-fast"
                >
                  {error}
                </motion.p>
              )}
            </motion.div>
          )}
           {success && (activeSubscriptionId === "cyber_initiate_free_demo" || (selectedSubscription && selectedSubscription.id !== activeSubscriptionId) ) && (
             <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-center text-brand-green font-mono mt-6 text-md sm:text-lg"
             >
                Отлично, Агент! Мы отправили счет на апгрейд в твой Telegram. После успешной транзакции твоя ОС будет обновлена автоматически. Заряжай полный VIBE!
             </motion.p>
           )}
        </motion.div>
      </main>
    </div>
  );
}
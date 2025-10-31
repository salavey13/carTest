"use client";
import { useState, useEffect } from "react";
import { useAppContext } from "@/contexts/AppContext";
import { sendTelegramInvoice, sendServiceInvoice } from "@/app/actions";
import { createInvoice } from "@/hooks/supabase";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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

// CyberFitness Plans (Original)
const CYBERFITNESS_PLANS = [
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
      "::FaDiagramProject className='text-brand-cyan mr-2 align-middle w-4 h-4 group-hover:text-brand-blue transition-colors duration-300':: **ТЫ – АРХИТЕКТОР, AI – ТВОЙ ЛЕГИОН:** Полный безлимит и все админ-права в SUPERVIBE Studio. Проектируй, генерируй, кастомизируй самые сложные многофайловые приложения и AI-ботов.",
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

// Warehouse Management Plans
const WAREHOUSE_PLANS = [
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
    hormozi_easter_egg_content: `**Да, абсолютно бесплатно и без скрытых платежей!** Почему мы предлагаем бесплатный тариф? Вы можете протестировать ВСЕ основные функции и убедиться, что система подходит именно вам. Начните сегодня - никакого риска!`
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
    hormozi_easter_egg_content: `**Потому что время - деньги, а ошибки стоят дорого!** За 4 900₽ в месяц вы получаете экономию 20+ часов в месяц и снижение недостач на 50-70%. Окупаемость в первый же месяц! Попробуйте 14 дней бесплатно!`
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
    hormozi_easter_egg_content: `**14 900₽ в месяц - это инвестиция в стабильность и рост.** Полная автоматизация складских процессов, индивидуальные решения, гарантированное снижение недостач на 50%+ или возврат денег. Для компаний с оборотом 1M+ в месяц.`
  }
];

// Additional Services
const ADDITIONAL_SERVICES = [
  {
    id: "quick_setup",
    name: "🚀 Быстрая настройка",
    price: 20000,
    description: "Полная настройка системы под ваш склад",
    features: [
      "Установка и настройка на вашем складе",
      "Обучение вас работе с системой", 
      "Интеграция с вашими маркетплейсами",
      "Настройка визуализации склада",
      "Гарантия работы 30 дней"
    ]
  },
  {
    id: "team_training", 
    name: "👥 Обучение команды",
    price: 10000,
    description: "Подключение ваших сотрудников",
    features: [
      "Обучение менеджеров и кладовщиков",
      "Настройка ролевого доступа",
      "Инструкции для персонала", 
      "Контроль качества работы",
      "Чек-листы для сотрудников"
    ]
  }
];

export default function BuySubscriptionPage() {
  const { user, isInTelegramContext, dbUser } = useAppContext();
  const [selectedSubscription, setSelectedSubscription] = useState<any>(null);
  const [selectedService, setSelectedService] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("cyberfitness");
  const [activeSubscriptionId, setActiveSubscriptionId] = useState<string>("cyber_initiate_free_demo");

  useEffect(() => {
    if (dbUser?.subscription_id) {
      // Check if it's a warehouse or cyberfitness subscription
      const allPlans = [...CYBERFITNESS_PLANS, ...WAREHOUSE_PLANS];
      const activePlan = allPlans.find(s => s.id === dbUser.subscription_id);
      if (activePlan) {
        setActiveSubscriptionId(dbUser.subscription_id as string);
        // Set appropriate tab based on subscription type
        if (dbUser.subscription_id.startsWith('warehouse_')) {
          setActiveTab("warehouse");
        } else {
          setActiveTab("cyberfitness");
        }
      }
    }
  }, [dbUser]);

  const handlePurchase = async (subscriptionType: 'cyberfitness' | 'warehouse') => {
    if (!user?.id) {
      toast.error("Сначала авторизуйтесь в Telegram!");
      setError("Авторизуйтесь в Telegram");
      return;
    }
    if (!selectedSubscription || selectedSubscription.price === 0) {
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
        type: subscriptionType === 'cyberfitness' ? "subscription_cyberfitness" : "subscription_warehouse",
        subscription_id: selectedSubscription.id, 
        subscription_name: selectedSubscription.name,
        subscription_price_stars: selectedSubscription.price, 
        userId: user.id.toString(),
        username: user.username || "unknown_tg_user",
      };
      const payload = subscriptionType === 'cyberfitness' 
        ? `sub_cf_${user.id}_${selectedSubscription.id}_${Date.now()}`
        : `sub_wh_${user.id}_${selectedSubscription.id}_${Date.now()}`;

      const invoiceCreateResult = await createInvoice(
        subscriptionType === 'cyberfitness' ? "subscription_cyberfitness" : "subscription_warehouse",
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
        `${subscriptionType === 'cyberfitness' ? 'CyberVibe OS:' : 'Складская автоматизация:'} ${selectedSubscription.name}`,
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

  const handleServicePurchase = async (service: any) => {
    if (!user?.id) {
      toast.error("Сначала авторизуйтесь в Telegram!");
      return;
    }

    setLoading(true);
    
    try {
      const response = await sendServiceInvoice(
        user.id.toString(),
        service.id as 'quick_setup' | 'team_training',
        service.name,
        service.description,
        service.price,
        service.features.join(', ')
      );

      if (!response.success) {
        throw new Error(response.error || "Не удалось отправить счёт на услугу");
      }

      toast.success("Счёт на услугу отправлен в Telegram!");
      setSelectedService(null);
      
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : "Неизвестная ошибка";
      toast.error("Ошибка: " + errMsg);
    } finally {
      setLoading(false);
    }
  };

  const activePlan = [...CYBERFITNESS_PLANS, ...WAREHOUSE_PLANS].find(s => s.id === activeSubscriptionId) || CYBERFITNESS_PLANS[0];

  return (
    <div className="min-h-screen pt-20 md:pt-24 bg-gradient-to-br from-blue-50 to-gray-100 pb-10">
      <main className="container mx-auto pt-8 md:pt-10 px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-6xl mx-auto p-6 sm:p-8 bg-white rounded-2xl shadow-lg border border-gray-200"
        >
          <h1 className="text-3xl sm:text-4xl font-bold text-center mb-4 text-gray-900">
            Выберите свой план
          </h1>
          <p className="text-lg text-center text-gray-600 mb-8 max-w-2xl mx-auto">
            От AI-разработки до автоматизации склада - все в одном месте
          </p>

          {activeSubscriptionId !== "cyber_initiate_free_demo" && activeSubscriptionId !== "warehouse_free" && (
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

          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-2 mb-8">
              <TabsTrigger value="cyberfitness" className="text-lg py-3">
                🚀 CyberFitness AI
              </TabsTrigger>
              <TabsTrigger value="warehouse" className="text-lg py-3">
                📦 Управление складом
              </TabsTrigger>
            </TabsList>

            {/* CyberFitness Tab */}
            <TabsContent value="cyberfitness">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
                {CYBERFITNESS_PLANS.map((sub, index) => (
                  <PlanCard
                    key={sub.id}
                    sub={sub}
                    index={index}
                    activeSubscriptionId={activeSubscriptionId}
                    selectedSubscription={selectedSubscription}
                    onSelect={() => setSelectedSubscription(sub)}
                    parseFeatureString={parseFeatureString}
                  />
                ))}
              </div>

              {selectedSubscription && selectedSubscription.id !== activeSubscriptionId && selectedSubscription.price > 0 && (
                <PurchaseSection
                  loading={loading}
                  success={success}
                  error={error}
                  selectedSubscription={selectedSubscription}
                  onPurchase={() => handlePurchase('cyberfitness')}
                />
              )}
            </TabsContent>

            {/* Warehouse Tab */}
            <TabsContent value="warehouse">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
                {WAREHOUSE_PLANS.map((sub, index) => (
                  <PlanCard
                    key={sub.id}
                    sub={sub}
                    index={index}
                    activeSubscriptionId={activeSubscriptionId}
                    selectedSubscription={selectedSubscription}
                    onSelect={() => setSelectedSubscription(sub)}
                    parseFeatureString={parseFeatureString}
                  />
                ))}
              </div>

              {selectedSubscription && selectedSubscription.id !== activeSubscriptionId && selectedSubscription.price > 0 && (
                <PurchaseSection
                  loading={loading}
                  success={success}
                  error={error}
                  selectedSubscription={selectedSubscription}
                  onPurchase={() => handlePurchase('warehouse')}
                />
              )}

              {/* Additional Services for Warehouse */}
              <div className="mt-12 p-6 bg-gray-50 rounded-xl border border-gray-200">
                <h3 className="text-2xl font-bold text-center mb-6 text-gray-900">Дополнительные услуги</h3>
                <div className="grid md:grid-cols-2 gap-6 max-w-2xl mx-auto">
                  {ADDITIONAL_SERVICES.map((service) => (
                    <div key={service.id} className="text-center p-6 border border-gray-300 rounded-lg bg-white hover:shadow-md transition-shadow">
                      <h4 className="text-xl font-bold mb-3">{service.name}</h4>
                      <p className="text-2xl font-bold mb-2">{service.price.toLocaleString()}₽</p>
                      <p className="text-sm text-gray-600 mb-4">{service.description}</p>
                      <ul className="text-sm text-gray-600 mb-4 space-y-1">
                        {service.features.map((feature, idx) => (
                          <li key={idx}>• {feature}</li>
                        ))}
                      </ul>
                      <Button 
                        onClick={() => handleServicePurchase(service)}
                        disabled={loading}
                        className="w-full bg-orange-600 hover:bg-orange-700"
                      >
                        {loading ? "Обработка..." : "Заказать услугу"}
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </motion.div>
      </main>
    </div>
  );
}

// Plan Card Component
const PlanCard = ({ sub, index, activeSubscriptionId, selectedSubscription, onSelect, parseFeatureString }: any) => (
  <motion.div
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

    <ul className="space-y-2 mb-6 max-h-48 overflow-y-auto">
      {sub.features.map((featureString: string, i: number) => {
        const { iconVibeContent, textContent } = parseFeatureString(featureString);
        return (
          <li key={i} className="text-sm text-gray-700 flex items-start">
            {iconVibeContent && <VibeContentRenderer content={iconVibeContent} />}
            <span className="text-xs">
              <VibeContentRenderer content={textContent} />
            </span>
          </li>
        );
      })}
    </ul>

    {sub.hormozi_easter_egg_title && (
      <details className="group mb-4 text-left">
        <summary className="text-xs font-semibold text-blue-600 cursor-pointer hover:text-blue-800 transition-colors list-none flex items-center justify-start group-open:mb-2">
          <VibeContentRenderer content={sub.hormozi_easter_egg_title} />
          <VibeContentRenderer content="::FaChevronDown className='ml-1 group-open:rotate-180 transition-transform duration-300 flex-shrink-0 w-3 h-3'::" />
        </summary>
        <div className="text-xs text-gray-600 bg-gray-50 p-2 rounded-md border border-gray-200 whitespace-pre-line text-left">
          <VibeContentRenderer content={sub.hormozi_easter_egg_content} />
        </div>
      </details>
    )}

    <div className="text-center">
      <Button
        onClick={onSelect}
        disabled={sub.id === activeSubscriptionId || sub.price === 0}
        className={`w-full ${
          selectedSubscription?.id === sub.id && sub.price > 0 
            ? "bg-green-600 hover:bg-green-700" 
            : sub.id === activeSubscriptionId 
            ? "bg-gray-400 cursor-not-allowed"
            : sub.price === 0
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
);

// Purchase Section Component
const PurchaseSection = ({ loading, success, error, selectedSubscription, onPurchase }: any) => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    className="text-center p-6 bg-blue-50 rounded-xl border border-blue-200"
  >
    <h3 className="text-xl font-bold mb-4 text-blue-800">
      Вы выбрали: {selectedSubscription.name}
    </h3>
    <Button
      onClick={onPurchase}
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
    {success && (
      <p className="text-green-600 mt-3 text-sm">
        Счёт отправлен в Telegram! Проверьте ваши сообщения.
      </p>
    )}
  </motion.div>
);
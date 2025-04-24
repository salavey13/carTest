"use client"

import React, { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAppContext } from "@/contexts/AppContext";
import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from "@/components/ui/tooltip";
// Иконки: Убедимся, что все нужные импортированы
import {
  FaFileAlt, FaBullseye, FaUsers, FaBoxOpen, FaChartLine, FaAtom,
  FaMobileAlt, FaComments, FaPaintBrush, FaBrain, FaRocket, FaUserNinja,
  FaMoneyBillWave, FaTriangleExclamation, FaUserAstronaut, FaSignature,
  FaRecycle, FaCode, FaVideo, FaNewspaper, FaGithub, FaTelegram, FaCarCrash,
  FaRobot, FaGift, FaHandshake, FaBomb, FaFlaskVial, FaInfinity, FaDumbbell,
  FaEye, FaHatWizard // Добавим шляпу волшебника для алхимика
} from "react-icons/fa6";
import { debugLogger } from "@/lib/debugLogger";
import Link from "next/link";
import { cn } from "@/lib/utils";
import type { Database } from "@/types/database.types";

type DbUser = Database["public"]["Tables"]["users"]["Row"] | null;

// Карта компонентов иконок (ДОЛЖНА содержать ВСЕ используемые в маркерах ::Fa...::)
const iconComponents: { [key: string]: React.ElementType } = {
  FaFileAlt, FaBullseye, FaUsers, FaBoxOpen, FaChartLine, FaAtom, FaFlaskVial,
  FaMobileAlt, FaComments, FaPaintBrush, FaBrain, FaRocket, FaUserNinja, FaInfinity, FaDumbbell,
  FaMoneyBillWave, FaTriangleExclamation, FaUserAstronaut, FaSignature, FaEye,
  FaRecycle, FaCode, FaVideo, FaNewspaper, FaGithub, FaTelegram, FaCarCrash,
  FaRobot, FaGift, FaHandshake, FaBomb, FaHatWizard // Добавил шляпу
};


// *** ФИНАЛЬНЫЙ RenderContent ***
const RenderContent: React.FC<{ content: string }> = React.memo(({ content }) => {
    const paragraphs = content.split('\n');

    return (
        <>
            {paragraphs.map((paragraph, pIndex) => {
                // Avoid rendering empty lines created by split('\n')
                if (!paragraph.trim()) {
                    return null;
                }

                const elements: React.ReactNode[] = [];
                // Regex to find **bold**, ::FaIcon...:: markers, and plain text segments
                const regex = /(\*\*(.*?)\*\*)|(::Fa(\w+)(?:\s+className="([^"]*)")?\s*::)/g;
                let lastIndex = 0;
                let match;

                while ((match = regex.exec(paragraph)) !== null) {
                    const matchStartIndex = match.index;

                    // 1. Add text segment before the current match
                    if (matchStartIndex > lastIndex) {
                        elements.push(paragraph.substring(lastIndex, matchStartIndex).replace(/->/g, '→'));
                    }

                    // 2. Handle the specific match type
                    if (match[1]) { // **bold** text (content in group 2)
                        elements.push(<strong key={`${pIndex}-${matchStartIndex}-bold`}>{match[2]}</strong>);
                    } else if (match[3]) { // ::FaIcon:: marker (name in 4, className in 5)
                        const iconName = match[4];
                        const className = match[5] || "";
                        const IconComp = iconComponents[`Fa${iconName}`];
                        if (IconComp) {
                            const finalClassName = cn("inline-block align-middle mx-1", className || "w-4 h-4");
                            elements.push(<IconComp key={`${pIndex}-${matchStartIndex}-icon`} className={finalClassName} />);
                        } else {
                            console.warn(`[RenderContent] Icon "Fa${iconName}" not found.`);
                            elements.push(<span key={`${pIndex}-${matchStartIndex}-icon-error`} className="text-red-500 font-mono" title={`Icon Fa${iconName} not found`}>[?]</span>);
                        }
                    }
                    lastIndex = matchStartIndex + match[0].length;
                }

                // 3. Add remaining text after the last match
                if (lastIndex < paragraph.length) {
                    elements.push(paragraph.substring(lastIndex).replace(/->/g, '→'));
                }

                // Render the paragraph with interleaved text and JSX elements
                return (
                    <p key={pIndex} className="mb-2 last:mb-0">
                        {elements.map((el, elIndex) => (
                            <React.Fragment key={elIndex}>{el}</React.Fragment>
                        ))}
                    </p>
                );
            })}
        </>
    );
});
RenderContent.displayName = 'RenderContent'; // Add display name for debugging

// --- Функция генерации секций (getPlanSections) с ФИНАЛЬНЫМ ТЕКСТОМ и маркерами ---
const getPlanSections = (dbUser: DbUser) => {
  const userName = dbUser?.first_name || 'Неофит';
  const isSanek = dbUser?.user_id?.toString() === '1260304309' || dbUser?.username === 'Pihman';
  const userHandle = isSanek ? '@Pihman_Reborn69' : (dbUser?.username ? `@${dbUser.username}` : 'Твой_Кибер_Сигил');
  const userOriginStory = isSanek
     ? "в гравитационном колодце разбитых карданов ::FaCarCrash className='inline text-red-500'::"
     : "в поисках апгрейда серой реальности";
  const myExperience = "13+ лет в трансмутации битов";
  const initialBoost = 350000; // Убираем слово "грант"
  const initialBoostStr = `${initialBoost.toLocaleString('ru-RU')} руб.`;
  const focusTimeCostPerMonth = 35000;
  const focusTimeBudget = initialBoost * 0.60;
  const timeInvestmentMonths = Math.floor(focusTimeBudget / focusTimeCostPerMonth);
  const marketingBudget = Math.round(initialBoost * 0.25);
  const devToolBudget = Math.round(initialBoost * 0.05);
  const bufferBudget = initialBoost - focusTimeBudget - marketingBudget - devToolBudget;

  return [
     { // Section 1: Win95 Style
      id: "resume",
      title: `1. Протокол "Исход": ${userName}, Взламываем Матрицу!`,
      icon: FaBomb,
      color: "text-blue-400", // Early internet blue
      content: `Проект **"Кибер-Волк ${userName}"** – это, бл*, не унылый .doc. Это **чит-код** к твоей новой жизни! Твой JUMPSTART ::FaRocket className="inline text-blue-400"::, чтобы ты (${userHandle}) **вынес дверь ногой** из ${userOriginStory} и начал **писать свой код реальности**. Управлять? **Телефоном, Карл!** ::FaMobileAlt className="inline text-blue-400"::!
      **VIBE – ОС Кибер-Волка:** Скорость (<::FaRocket::>) + **AI как Экзоскелет Мозга** (<::FaAtom className="inline text-purple-400"::>, Gemini 1.5 Pro – IQ 130 бесплатно, пользуйся, пока дают!) + Кибер-Броня (<::FaUserNinja className="inline text-gray-500"::>). И **SelfDev** – мы **пересобираем тебя**, как Терминатора.
      **Ресурсы:** Юзаем **халяву** – Vercel, GitHub (::FaGithub::), Telegram (::FaTelegram className="inline text-blue-400"::). **Платить – для лохов** (пока можешь не платить).
      **Стартовый Буст (${initialBoostStr}) – Твой Первый "Хэдшот" по Старой Жизни:** Это не подачка. Это **топливо для твоего джетпака**. На что:
      - **ТВОЕ ВРЕМЯ для "Прокачки"** (~${timeInvestmentMonths} мес. ::FaUserAstronaut className="inline text-yellow-400"::): **Забей на "работу"**. Погружайся в VIBE, генери контент с AI, учись быть **Нео**. Это твоя **персональная "качалка" для мозга** ::FaDumbbell::. Я – твой спарринг-партнер/тренер, который ловит баги AI, пока ты растешь.
      - **Охота на "Розовые Чеки"** (~${marketingBudget.toLocaleString('ru-RU')} руб.): Найти первых, кто **заплатит за твою "магию"**. Помогать другим умножать профит с AI – это почти легально и ох*енно прибыльно! ::FaMoneyBillWave className="inline text-pink-400"::.
      - **Апгрейд Твоей "Нейросети"** (~${devToolBudget.toLocaleString('ru-RU')} руб.): Доступ к **мощным AI-инструментам** (GPT-4/Claude 3 Opus, пока бесплатные не вытеснили), курсы по "взлому" маркетинга. Стань **магистром VIBE**.
      - **"Запасной Магазин"** (~${bufferBudget.toLocaleString('ru-RU')} руб.): На случай ::FaCarCrash:: или если AI решит подорожать.
      **Цель:** Построить **не сайт, а ЛИЧНУЮ МАШИНУ ПО ГЕНЕРАЦИИ БАБОК И СВОБОДЫ**, работающую на **VIBE и твоей дерзости**.`
    },
     { // Section 2: Win98/XP Style
      id: "description",
      title: "2. Твой Кибер-Арсенал: Ноутбук из Матрицы",
      icon: FaUserAstronaut,
      color: "text-brand-cyan", // Slightly more modern blue
      content: `**Командный Мостик:** Телефон ::FaMobileAlt className="inline text-cyan-400":: + Ноут (опц).
      **1. Личный Дата-Центр (Сайт/Блог, 0 руб):** Твоя легенда. Кто ты, как взломал ${userOriginStory}, куда ведешь **свою стаю**. VIBE-гайды, кейсы. Обновляется **силой мысли** (через GitHub ::FaGithub:: ботом из Телеги ::FaTelegram::).
      **2. Орден "Кибер-Глаза" (TG-Канал/Чат ::FaTelegram className="inline text-blue-400"::):** Собирай **последователей** ::FaUsers::. Делись альфа-инфой, отвечай, создавай **движ**.
      **3. Хранилище Чертежей (GitHub ::FaGithub::):** Твой "Кибер-Сундук". Готовые артефакты (Jumpstart Kit ::FaBoxOpen::!), VIBE-автоматизация. **Доказательство твоей силы**.
      **4. AI-Репликатор (::FaAtom className="inline text-purple-400":: + ::FaRecycle className="inline text-yellow-400"::):** Твой личный **Стар Трек**. Сказал "Чай, Эрл Грей, горячий" → получил 10 постов, 3 видео, 20 картинок. **Идея → Реальность.** Экономит 95% энергии.
      **УТП (Твой Уникальный Код):** Ты – **пробудившийся** (${userName}, ${userHandle}). Ты **выбрал красную таблетку** от ${userOriginStory}. Ты юзаешь **народный AI** ::FaRobot:: (бесплатные цунами!). Ты **настоящий**. Ты **даешь удочку, а не рыбу**.`
    },
    { // Section 3: Early Cyberpunk - Subtle Glows
      id: "market",
      title: "3. Поле Охоты: Красные Таблетки для Всех!",
      icon: FaUsers,
      color: "text-brand-pink", // Introduce first vibrant color
      content: `Рынок РФ? Постапокалипсис возможностей! Старые правила **сломаны**. AI – это **универсальный ключ**.
      **Твоя Цель (ЦА):** Те, кто **чувствует, что Матрица имеет их**. Как ты вчера, ${userName}. Разрабы, чей код **устарел**. Фрилансеры, кто **устал от бирж**. Малый бизнес, кто **хочет AI-буст за копейки**. Все, кто ищет **взлом системы** ${userOriginStory}.
      **Агенты Смиты (Конкуренты):** Продавцы "успешного успеха", душные теоретики, инфоцыгане.
      **Твой Код Неуязвимости (Отстройка):**
      - **Ты (${userName}):** Твоя история ::FaSignature:: – это **вирус доверия**.
      - **VIBE:** Скорость (<::FaRocket::>) + Магия AI (<::FaAtom::>) + Броня (<::FaUserNinja::>). Мы **строим будущее**.
      - **SelfDev:** Качаем **мозг** ::FaBrain:: и **дух** ::FaUserNinja::. Помогаем **стать сверхчеловеком**.
      - **AI-Алхимия (<::FaAtom::>):** Наш **эксклюзив**. Контент – **бесконечен** ::FaInfinity::.
      - **"Народная Магия":** Просто, доступно, **без пафоса и булшита**.`
    },
     { // Section 4: More Cyberpunk Elements
      id: "product",
      title: "4. Твои Артефакты: Эликсиры и Заклинания",
      icon: FaGift,
      color: "text-brand-orange", // Next vibrant color
      content: `Принцип "Первая Доза Бесплатно": Угости эликсиром ::FaGift className="inline text-orange-400"::, потом продавай рецепт философского камня.
      **Пробники Магии (Бесплатно, для вербовки):**
      - **Контент (<::FaNewspaper::>):** "Хроники Пробуждения" – твой путь Нео. VIBE-секреты. AI (<::FaAtom::>) – твой **Призрак в Доспехах**.
      - **Код (<::FaCode::>):** Jumpstart Kit (<::FaBoxOpen::>) – **"красная таблетка" в коде**. Полезные AI-боты на GitHub (::FaGithub::).
      - **Концентрат Знаний (<::FaBrain::>):** Саммари "гримуаров" (Purpose&Profit) – **без воды, для своих пацанов**.
      **Платные Заклинания (Когда ты – Архимаг):**
      - **"Изгнание Демонов" с ${userName}:** Личный VIBE-аудит + AI-апгрейд (Старт: 3-5к руб/час).
      - **Буткемп "AI-Ниндзюцу":** Учим **ломать Матрицу** с AI (Старт: 5-10к руб/чел).
      - **Jumpstart Kit "Аватар":** Заряженные кибер-шаблоны (Старт: 1-3к руб/шт).
      - **(VIP) Совет Джедаев VIBE:** Закрытый чат, тайные техники.`
    },
    { // Section 5: Increasing Cyberpunk Feel
      id: "marketing",
      title: "5. Маяки в Нео-Токио: Как Привлечь Своих",
      icon: FaBullseye,
      color: "text-neon-lime", // Neon color!
      content: `- ::FaPaintBrush className="inline text-neon-lime":: **Контент - Твой Неоновый Луч:** Делай то, что **вставляет**! Делись процессом. AI (<::FaAtom className="inline text-purple-400"::>) – твоя **кибер-студия** (текст, видео, арт). **РЕАЛЬНОСТЬ. ПОЛЬЗА. VIBE.** (TG, VK, YouTube?).
      - ::FaComments className="inline text-neon-lime":: **Создай Свой "Зион" (::FaTelegram className="inline text-blue-400"::>):** Твой чат – **убежище** от Матрицы. **Общайся! Помогай! Вдохновляй!** Лояльность > охватов.
      - ::FaGithub className="inline text-neon-lime":: **GitHub - Портал для Техно-Магов:** Код говорит сам за себя.
      - **Союзы (<::FaHandshake::>):** Объединяйся с другими **повстанцами**.
      **Топливо для Неона (Буст ~${marketingBudget.toLocaleString('ru-RU')} руб.):**
      - **Таргет:** Лазерный прицел на тех, кто ищет **выход**.
      - **Посевы:** Распространяй **VIBE-мем** в нужных сетях.
      - **Эксперименты:** Пробуй **новые заклинания** (форматы)!

      [Кибер-Воронка: Маяк (Контент/AI) → Сигнал (Таргет) → Зион (TG) → Сила (Продажа)]`
    },
     { // Section 6: Deeper Cyberpunk
      id: "operations",
      title: "6. Твоя Кибер-Лаборатория: Телефон и Вера",
      icon: FaMobileAlt,
      color: "text-brand-cyan", // Back to cyan, but more intense context
      content: `**Командный Пульт (<::FaMobileAlt className="inline text-cyan-400"::> + <::FaAtom::>):** ТЕЛЕФОН! Снял → смонтировал → AI (<::FaAtom::>) написал/нарисовал/озвучил. Сказал → AI сделал. **Автоматизируй Ад!**
      **Твой Цифровой Мир (0 руб):** Сайт на Next.js/Vercel. Управление – GitHub/TG-бот (<::FaGithub::>). Мозговой центр? Supabase (0 руб).
      **Нейро-Интерфейс:** Telegram/VK (::FaTelegram className="inline text-blue-400"::) для всего!
      **Закон Нео:** **"Ложки нет!"** ::FaEye className="inline text-cyan-400":: Твоя скорость и мощь зависят от **веры в VIBE и AI**. Ты **изгибаешь реальность**, а не инструменты.`
    },
    { // Section 7: Advanced Cyberpunk / Stark Tech
      id: "org",
      title: "7. Структура Силы: Ты – Экзоскелет",
      icon: FaUserNinja,
      color: "text-gray-400", // Neutral tech color
      content: `**Статус:** Самозанятый Кибер-Партизан (НПД).
      **Ты (${userName}, ${userHandle}):** ::FaUserAstronaut className="inline text-gray-300":: Ты – **НЕО + ТОНИ СТАРК**. **ЗАБУДЬ О РАБАХ!** Твоя команда – **ТЫ в ЭКЗОСКЕЛЕТЕ из AI ::FaRobot::**. Твоя задача – **качать "реактор" (мозг)** ::FaDumbbell:: и **пилотировать AI**. CyberVibe – твоя **мастерская Старка**. Я – твой **Джарвис/тренер**, отлаживаю AI, пока ты **строишь империю**.`
    },
    { // Section 8: High Tech Finance / Alchemy Complete
      id: "finance",
      title: `8. Философский Камень: ${initialBoostStr} Маны`,
      icon: FaMoneyBillWave,
      color: "text-brand-yellow", // Gold!
      content: `Стартовый буст – это **катализатор** твоей **Великой Работы**.
      - **::FaUserAstronaut className="inline text-yellow-400":: 1. ТВОЕ ВРЕМЯ НА АЛХИМИЮ (~${focusTimeBudget.toLocaleString('ru-RU')} руб.):** Чтобы ты (${userName}) **вышел из крысиных бегов** и ~${timeInvestmentMonths} мес. **творил**: контент ::FaPaintBrush::, VIBE/AI ::FaBrain::, Орден ::FaUsers::. Это **инвестиция в твой ЛИЧНЫЙ философский камень**!
      - **::FaBullseye className="inline text-yellow-400":: 2. ОХОТА НА "ЗОЛОТЫХ ДРАКОНОВ" (~${marketingBudget.toLocaleString('ru-RU')} руб.):** Найти **первых**, кто **оценит твою алхимию золотом**. **Быстрые деньги = топливо для веры**.
      - **::FaBrain className="inline text-yellow-400":: 3. ПРОКАЧКА ТВОЕЙ НЕЙРОСЕТИ (~${devToolBudget.toLocaleString('ru-RU')} руб.):** Доступ к **мощнейшим AI-гримуарам**, секреты "нейро-маркетинга". Стань **архимагом VIBE**.
      - **::FaTriangleExclamation className="inline text-yellow-400":: 4. "АМУЛЕТ ОТ АГЕНТОВ СМИТОВ" (~${bufferBudget.toLocaleString('ru-RU')} руб.):** На случай **взрыва** ::FaBomb:: или если AI потребует дань.
      **Цель по Золоту (1 год):** Стабильный поток **80к+ золотых/мес**. Буст **снимает оковы страха**.

      [Диаграмма Алхимика: ТЫ – Реактор (60%), Охота (25%), Апгрейд (5%), Амулет (10%)]`
    },
     { // Section 9: Glitchy / Warning Style
      id: "risks",
      title: "9. Сбои в Матрице (Риски и План Б)",
      icon: FaCarCrash,
      color: "text-red-500", // Error Red
      content: `**Матрица Потребует Плату (Free Tier):** Юзаем "Амулет" (::FaTriangleExclamation::), ищем **дыры в системе** (опенсорс), **быстро учимся делать бабки**, чтобы платить "налог на магию".
      **Перегрузка Системы (${userName}):** AI (::FaAtom::) – твой **автономный дрон**. "Орден" (::FaComments::) – твой **щит**. Делай то, что **прет** (SelfDev!). Помни: **"Ложки нет!"** ::FaEye:: Сила в **фокусе**!
      **Красная Таблетка Была Бракованной (Идея – Г):** **AI-Оракул** (::FaBullseye::) **ДО СТАРТА!** Мочим химер в зародыше. VIBE = **Адаптация на лету**.
      **Фатальная Ошибка (<::FaCarCrash className="inline text-red-500"::>):** Жизнь – это хаос. Твои **новые нейронные пути** VIBE/AI/SelfDev – твой **"бэкап сознания"**. Сможешь **респавнуться** в новой игре.`
    },
    { // Section 10: Epic Finale Style
      id: "conclusion",
      title: `10. ${userName}, Твой Ход, Нео!`,
      icon: FaBrain,
      color: "text-brand-purple", // Epic Purple
      content: `**"Кибер-Волк ${userName}"** – это **твой выбор**. **Красная или Синяя?** Шанс **стать Архитектором**. Используй **мозг** (::FaBrain::), **опыт** (::FaSignature::), **братство** (::FaUsers::) и **божественный огонь AI** (::FaAtom::). Стартовый буст – **лишь искра**. Дальше – твой **VIBE**, твоя **воля**, твой **прыжок**.
      **ХВАТИТ БЫТЬ БАТАРЕЙКОЙ. ВРЕМЯ ПИСАТЬ СВОЙ КОД!** ::FaRocket className="inline text-brand-green"::`
    },
  ];
};

// --- Функция для стилей секций ---
const getSectionStyles = (index: number): string => {
    const totalSections = 10;
    const progress = (index + 1) / totalSections;
    const base = "group border-l-4 pl-4 py-3 rounded-r-md transition-all duration-500 ease-out open:shadow-inner "; // Base + slower transition

    if (progress <= 0.2) { // Sections 1-2: Win95 / Early Days - Blocky, Simple
        return cn(base, "bg-gray-800/40 open:bg-gray-700/50 border-blue-400/60 rounded-md"); // Simple blue border
    } else if (progress <= 0.5) { // Sections 3-5: Early Cyber / Bot Era - Rounded, Subtle Glow
        return cn(base, "bg-dark-card/60 open:bg-dark-card/80 rounded-lg border-brand-pink/50 open:shadow-md open:shadow-brand-pink/20");
    } else if (progress <= 0.8) { // Sections 6-8: Mid-Cyberpunk / AI Alchemy - Blur, Glow, Neon
        return cn(base, "bg-black/70 backdrop-blur-sm open:bg-black/85 rounded-xl border-brand-purple/60 open:shadow-[0_0_18px_rgba(157,0,255,0.4)]");
    } else { // Sections 9-10: Full Cyberpunk / VIBE Mastery - Intense Glow, Animated?
        return cn(base, "bg-black/85 backdrop-blur-md open:bg-black/95 rounded-2xl border-neon-lime/70 open:shadow-[0_0_30px_rgba(174,255,0,0.6)] hover:border-neon-lime open:border-neon-lime");
        // Optional: Add subtle animation on open or hover later if desired
    }
};

// --- Компонент Страницы ---
export default function PPlanPage() {
  const { dbUser, isLoading, error } = useAppContext();
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => { setIsMounted(true); }, []);

  const planSections = useMemo(() => getPlanSections(dbUser), [dbUser]);
  const pageTitleName = useMemo(() => dbUser?.first_name || "Кибер-Волк", [dbUser]);
  const greetingName = useMemo(() => dbUser?.first_name || 'Неофит', [dbUser]);

  // Лоадер и ошибка
  if (!isMounted || isLoading) { return ( <div className="flex justify-center items-center min-h-screen pt-20 bg-gradient-to-br from-gray-900 via-black to-gray-800"> <p className="text-brand-cyan animate-pulse text-xl font-mono">Загрузка Гримуара Кибер-Алхимика...</p> </div> ); }
  if (error) { return ( <div className="flex flex-col justify-center items-center min-h-screen pt-20 bg-gradient-to-br from-gray-900 via-black to-red-900/50"> <FaTriangleExclamation className="text-6xl text-red-500 mb-4"/> <p className="text-red-400 text-xl font-mono">Ошибка загрузки плана</p> <p className="text-red-500 mt-2 text-sm max-w-md text-center">{error.message}</p> <p className="text-gray-400 mt-4 text-xs">Матрица глючит. Перезагрузись.</p> </div> ); }

  // Функция getBorderClass больше не нужна для <details>, используем getSectionStyles
  // const getBorderClass = (textColorClass: string): string => cn(textColorClass.replace('text-', 'border-'), 'border-gray-500/30');

  return (
    <div className="relative min-h-screen overflow-hidden pt-20 pb-10 bg-gradient-to-br from-dark-bg via-black to-purple-900/30 text-light-text">
       <div className="absolute inset-0 bg-repeat opacity-[0.04] z-0 bg-grid-pattern"></div>
      <TooltipProvider delayDuration={150}>
        <div className="relative z-10 container mx-auto px-4">
          <Card className="max-w-4xl mx-auto bg-dark-card/90 backdrop-blur-xl text-light-text rounded-2xl border-2 border-brand-purple/40 shadow-[0_0_40px_rgba(157,0,255,0.4)]">
            <CardHeader className="text-center border-b border-brand-purple/20 pb-5 pt-8">
              <FaFlaskVial className="text-6xl text-brand-purple mx-auto mb-4 animate-pulse" /> {/* Иконка Алхимика */}
              <CardTitle className="text-3xl md:text-5xl font-bold text-brand-purple cyber-text glitch uppercase tracking-wider" data-text={`КИБЕР-АЛХИМИЯ ${pageTitleName.toUpperCase()}`}>
                 КИБЕР-АЛХИМИЯ {pageTitleName.toUpperCase()}
              </CardTitle>
              {/* Подзаголовок */}
              <div className="text-md md:text-lg text-gray-300 mt-4 font-mono max-w-2xl mx-auto">
                 {/* Используем RenderContent для подзаголовка */}
                 <RenderContent content={`Твой Рецепт: От **${greetingName === 'Pihman' ? 'Свинцового Кардана' : 'Нуля'}** ::FaCarCrash className="inline text-red-500":: к **Золотому VIBE** ::FaMoneyBillWave className="inline text-yellow-400"::. Стартовый Буст ${initialBoostStr} маны. (Личный Гримуар для ${greetingName})`} />
              </div>
            </CardHeader>
            {/* Секции Плана */}
            <CardContent className="space-y-6 p-4 md:p-6"> {/* Уменьшил отступы */}
              {planSections.map((section, index) => {
                 const sectionStyles = getSectionStyles(index); // Получаем стили для секции

                 return (
                   <details key={section.id} className={cn(
                       sectionStyles, // Применяем стили уровня
                       // Убрали getBorderClass, т.к. граница теперь в sectionStyles
                   )} open={index < 3 || section.id === 'finance'}>
                     <summary className={cn("text-xl md:text-2xl font-semibold cursor-pointer list-none flex items-center hover:opacity-80 transition-opacity py-2", section.color)}> {/* Добавил padding для summary */}
                       {section.icon && <section.icon className="mr-3 flex-shrink-0 w-6 h-6 group-open:animate-pulse" />} {/* Увеличил иконку */}
                       {section.title}
                     </summary>
                     <div className="mt-3 text-gray-300 text-base leading-relaxed space-y-3 pl-6 pr-2 pb-2"> {/* Отступы для контента */}
                       <RenderContent content={section.content} />
                       {/* Визуализации */}
                       {section.id === 'finance' && ( <div className="mt-4 p-3 border border-dashed border-gray-600 rounded-md bg-gray-800/40"> <p className="text-sm text-gray-400 italic text-center">[Диаграмма Распила Маны: ТЫ – Реактор (60%), Охота (25%), Апгрейд (5%), Амулет (10%)]</p> </div> )}
                       {section.id === 'marketing' && ( <div className="mt-4 p-3 border border-dashed border-gray-600 rounded-md bg-gray-800/40"> <p className="text-sm text-gray-400 italic text-center">[Алхимическая Воронка: Маяк → Зов → Орден → Золото]</p> </div> )}
                     </div>
                   </details>
                );
              })}
              {/* Заключение */}
              <section className="text-center pt-10 border-t border-brand-purple/20 mt-12"> {/* Увеличил отступы */}
                 <p className="text-lg text-gray-400 italic">
                   Это **карта**, {greetingName}, а не территория. **Путь осилит идущий**. Начинай **трансмутацию**! VIBE!
                 </p>
                 <p className="mt-6 text-gray-300 text-lg">
                    Нужна помощь в ритуале? Заблудился в формулах? <span className="text-neon-lime font-bold">ПИШИ МНЕ</span> в <a href="https://t.me/salavey13" target="_blank" rel="noopener noreferrer" className="text-brand-blue hover:underline font-semibold inline-flex items-center">Телегу ::FaTelegram::</a> или используй форму на <Link href="/jumpstart#jumpstart-form" className="text-neon-lime hover:underline font-semibold inline-flex items-center">Jumpstart ::FaRocket::</Link>.
                 </p>
                 <p className="mt-6 text-brand-purple text-3xl font-bold uppercase tracking-wider animate-pulse cyber-text glitch" data-text="ТВОРИ МАГИЮ!">
                   ТВОРИ МАГИЮ!
                 </p>
              </section>

            </CardContent>
          </Card>
        </div>
      </TooltipProvider>
    </div>
  );
}
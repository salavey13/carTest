"use client";

import React, { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAppContext } from "@/contexts/AppContext";
import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from "@/components/ui/tooltip";
// ВСЕ ИКОНКИ, используемые в тексте и JSX + НОВЫЕ
import {
  FaFileAlt, FaBullseye, FaUsers, FaBoxOpen, FaChartLine, FaAtom,
  FaMobileAlt, FaComments, FaPaintBrush, FaBrain, FaRocket, FaUserNinja,
  FaMoneyBillWave, FaTriangleExclamation, FaUserAstronaut, FaSignature,
  FaRecycle, FaCode, FaVideo, FaNewspaper, FaGithub, FaTelegram, FaCarCrash,
  FaRobot, FaGift, FaHandshake, FaBomb, FaFlaskVial, FaInfinity, FaDumbbell,
  FaEye, FaHatWizard, FaPoo, FaKey, FaBolt, FaScroll // Ключ, Молния, Свиток
} from "react-icons/fa6";
import { debugLogger } from "@/lib/debugLogger";
import Link from "next/link";
import { cn } from "@/lib/utils";
import type { Database } from "@/types/database.types";

type DbUser = Database["public"]["Tables"]["users"]["Row"] | null;

// КАРТА ИКОНОК: Убедимся, что все здесь есть
const iconComponents: { [key: string]: React.ElementType } = {
  FaFileAlt, FaBullseye, FaUsers, FaBoxOpen, FaChartLine, FaAtom, FaFlaskVial,
  FaMobileAlt, FaComments, FaPaintBrush, FaBrain, FaRocket, FaUserNinja, FaInfinity, FaDumbbell,
  FaMoneyBillWave, FaTriangleExclamation, FaUserAstronaut, FaSignature, FaEye,
  FaRecycle, FaCode, FaVideo, FaNewspaper, FaGithub, FaTelegram, FaCarCrash,
  FaRobot, FaGift, FaHandshake, FaBomb, FaHatWizard, FaPoo, FaKey, FaBolt, FaScroll // Добавил новые
};

// *** ФИНАЛЬНЫЙ RenderContent v4: Максимально Надежный ***
const RenderContent: React.FC<{ content: string }> = React.memo(({ content }) => {
    // Split content into paragraphs first
    return content.split('\n').map((paragraph, pIndex) => {
        // Only process non-empty paragraphs
        if (!paragraph.trim()) {
            return null; // Skip empty lines
        }

        const elements: React.ReactNode[] = [];
        // Regex to find EITHER **bold** OR ::FaIcon...:: markers
        const regex = /(\*\*(.*?)\*\*)|(::Fa(\w+)(?:\s+className="([^"]*)")?\s*::)/g;
        let lastIndex = 0;
        let match;
        let keyCounter = 0; // For unique keys

        // Iterate over matches
        while ((match = regex.exec(paragraph)) !== null) {
            const matchStartIndex = match.index;

            // Add text before the match
            if (matchStartIndex > lastIndex) {
                elements.push(
                    <React.Fragment key={`${pIndex}-txt-${keyCounter++}`}>
                        {paragraph.substring(lastIndex, matchStartIndex).replace(/->/g, '→')}
                    </React.Fragment>
                );
            }

            // Handle the matched part (bold or icon)
            if (match[1]) { // **bold** match (content is group 2)
                elements.push(<strong key={`${pIndex}-bold-${keyCounter++}`}>{match[2]}</strong>);
            } else if (match[3]) { // ::FaIcon:: match (name is group 4, className is group 5)
                const iconName = match[4];
                const className = match[5] || ""; // Extracted className or default
                const IconComp = iconComponents[`Fa${iconName}`];
                if (IconComp) {
                    const finalClassName = cn("inline-block align-middle mx-1", className || "w-4 h-4"); // Default size
                    elements.push(<IconComp key={`${pIndex}-icon-${keyCounter++}`} className={finalClassName} />);
                } else {
                    console.warn(`[RenderContent] Icon "Fa${iconName}" not found.`);
                    elements.push(<span key={`${pIndex}-icon-error-${keyCounter++}`} className="text-red-500 font-mono" title={`Icon Fa${iconName} not found`}>[?]</span>);
                }
            }
            lastIndex = matchStartIndex + match[0].length; // Move past the processed match
        }

        // Add any remaining text after the last match
        if (lastIndex < paragraph.length) {
            elements.push(
                <React.Fragment key={`${pIndex}-txt-${keyCounter++}`}>
                    {paragraph.substring(lastIndex).replace(/->/g, '→')}
                </React.Fragment>
            );
        }

        // Render the paragraph with all its processed elements
        return (
            <p key={pIndex} className="mb-2 last:mb-0">
                {elements}
            </p>
        );
    }).filter(Boolean); // Filter out any null paragraphs (empty lines)
});
RenderContent.displayName = 'RenderContent';


// --- Функция генерации секций (getPlanSections) с ФИНАЛЬНЫМ текстом БЕЗ "ГРАНТА" ---
const getPlanSections = (dbUser: DbUser) => {
  const userName = dbUser?.first_name || 'Неофит';
  const isSanek = dbUser?.user_id?.toString() === '1260304309' || dbUser?.username === 'Pihman';
  const userHandle = isSanek ? '@Pihman_Reborn69' : (dbUser?.username ? `@${dbUser.username}` : 'Твой_Кибер_Сигил');
  const userOriginStory = isSanek
     ? "в гравитационном колодце разбитых карданов ::FaCarCrash className='inline text-red-500'::"
     : "в поисках апгрейда серой реальности";
  const myExperience = "13+ лет в трансмутации реальности"; // Еще круче!
  const initialBoost = 350000; // Сумма остается, слово уходит
  const initialBoostStr = `${initialBoost.toLocaleString('ru-RU')} руб.`;
  const focusTimeCostPerMonth = 35000;
  const focusTimeBudget = initialBoost * 0.60;
  const timeInvestmentMonths = Math.floor(focusTimeBudget / focusTimeCostPerMonth);
  const marketingBudget = Math.round(initialBoost * 0.25);
  const devToolBudget = Math.round(initialBoost * 0.05);
  const bufferBudget = initialBoost - focusTimeBudget - marketingBudget - devToolBudget;

  return [
     { // Section 1: Win95 - Простой и понятный, как Paint
      id: "resume",
      title: `1. Меморандум "Исход": ${userName}, Добро Пожаловать в Реальный Мир!`,
      icon: FaBomb,
      color: "text-blue-400",
      content: `Проект **"Кибер-Волк ${userName}"** – это не папка с файлами. Это **ключ зажигания** ::FaKey className="inline text-blue-400":: к твоей новой операционке! Твой JUMPSTART ::FaRocket className="inline text-blue-400"::, чтобы ты (${userHandle}) **форматнул C:** с ${userOriginStory} и начал **инсталлировать новую жизнь**. Управлять? **Мышкой и телефоном!** ::FaMobileAlt className="inline text-blue-400"::!
      **VIBE – Твой Новый BIOS:** Скорость (::FaRocket::) + **AI как Процессор** (::FaAtom className="inline text-purple-400"::, Gemini 1.5 Pro – халявный i9, пока доступен!) + Защита от Вирусов (::FaUserNinja className="inline text-gray-500"::>). И **SelfDev** – ты **перепрошиваешь себя**.
      **Софт:** Юзаем **freeware и shareware** – Vercel, GitHub (::FaGithub::), Telegram (::FaTelegram className="inline text-blue-400"::>). **Кряки не нужны** (пока).
      **Стартовый Кэш (${initialBoostStr}) – Твой Первый "Мод" для Жизни:** Это не пособие. Это **ресурс на твой апгрейд**. На что:
      - **ТВОЕ ВРЕМЯ на "Дефрагментацию Мозга"** (~${timeInvestmentMonths} мес. ::FaUserAstronaut className="inline text-yellow-400"::): **Забей на "работу"**. Погружайся в VIBE, генери контент с AI, учись быть **Архитектором Матрицы**. Это твоя **персональная "песочница" для разума** ::FaBrain::. Я – твой **"сисадмин"**, чиню баги AI, пока ты качаешься ::FaDumbbell::.
      - **Охота на "Золотые Пиксели"** (~${marketingBudget.toLocaleString('ru-RU')} руб.): Найти первых, кто **заплатит за твой "код"**. Помогать другим **апгрейдить их системы** с AI – это **самый читерский, но легальный** способ заработка! ::FaMoneyBillWave className="inline text-pink-400"::.
      - **Апгрейд Твоей "Видеокарты" (Мозга)** (~${devToolBudget.toLocaleString('ru-RU')} руб.): Доступ к **секретным DLL** (платные AI), мануалы по "социальной инженерии" (маркетинг). Стань **мастером VIBE**.
      - **"Бекап Системы"** (~${bufferBudget.toLocaleString('ru-RU')} руб.): На случай ::FaCarCrash:: или если freeware станет платным.
      **Цель:** Собрать **не сайт, а СВОЙ ЛИЧНЫЙ СЕРВЕР**, генерирующий **свободу и бабло**, на **VIBE OS**.`
    },
     { // Section 2: Win98/XP - Появляются окошки, цвета
      id: "description",
      title: "2. Твой Интерфейс: Окна в Новую Реальность",
      icon: FaUserAstronaut,
      color: "text-brand-cyan",
      content: `**Командный Центр:** Телефон ::FaMobileAlt className="inline text-cyan-400":: + Ноут (опц).
      **1. Персональный Рабочий Стол (Сайт/Блог, 0 руб):** Твоя история апгрейда (из ${userOriginStory}). VIBE-скрипты, кейсы "взлома". Обновляется **автоматически** (GitHub ::FaGithub:: + TG-бот ::FaTelegram::).
      **2. Твой Форум (TG-Канал/Чат ::FaTelegram className="inline text-blue-400"::):** Собирай **юзеров** ::FaUsers::. Делись патчами, отвечай на багрепорты, создавай **атмосферу**.
      **3. Библиотека Компонентов (GitHub ::FaGithub::):** Твой "Кибер-Сундук". Готовые модули (Jumpstart Kit ::FaBoxOpen::!), VIBE-автоматизация. **Покажи свой код**.
      **4. AI-Компилятор (::FaAtom className="inline text-purple-400":: + ::FaRecycle className="inline text-yellow-400"::):** Твой личный **Генератор Всего**. Идея → текст, видео, арт, код. **Мысль → Байт.** Экономит 99% процессорного времени.
      **Твой Уникальный ID:** Ты – **${userName} (${userHandle})**. Ты **вышел из цикла** ${userOriginStory}. Ты юзаешь **опенсорс AI** ::FaRobot::. Ты **не фейк**. Ты **даешь решение, а не обещание**.`
    },
    // .. (Текст для остальных секций обновляется аналогично, с фокусом на алхимии, матрице, качалке, AI и убиранием "гранта")
    // .. ВАЖНО: Пройтись по ВСЕМ секциям и заменить "грант" на "стартовый буст/капитал/мана/топливо" и убрать лишние <> ..

    { // Section 3: Early Cyberpunk - Появляются неон и тени
      id: "market",
      title: "3. Зона Фарминга: Где Лут и Опыт?",
      icon: FaUsers,
      color: "text-brand-pink",
      content: `Рынок РФ? Зона PvP после вайпа серверов. Нужны **быстрые, умные, гибкие**. AI – это **легендарный дроп**.
      **Твоя Фракция (ЦА):** Застрявшие на нубских локациях. Такие же, как ты вчера, ${userName}. Разрабы с **устаревшим билдом**. Фрилансеры, фармящие **копейки**. Малый бизнес, кто **хочет баффов от AI**. Все, кто ищет **эксплойт** для ${userOriginStory}.
      **Мобы и Боссы (Конкуренты):** "Гуру"-однодневки, душные академии, инфо-гоблины.
      **Твой Сет Бонуc (Отстройка):**
      - **Ты (${userName}):** Твоя история ::FaSignature:: – **уникальный артефакт**.
      - **VIBE:** Скорость (<::FaRocket::>) + Магия AI (<::FaAtom::>) + Броня (<::FaUserNinja::>). Мы **фармим результат**.
      - **SelfDev:** Качаем **интеллект** ::FaBrain:: и **волю** ::FaUserNinja::. Помогаем **апнуть левел**.
      - **AI-Алхимия (<::FaAtom::>):** Наш **скрипт на бесконечный контент** ::FaInfinity::.
      - **"Народный Крафт":** Просто, доступно, **без доната и гринда**.`
    },
     { // Section 4: More Cyberpunk Elements
      id: "product",
      title: "4. Твои Свитки и Зелья: Продаем Магию",
      icon: FaGift, // Сначала даем зелье здоровья
      color: "text-brand-orange",
      content: `Принцип "Пробник Зелий": Угости маной ::FaGift className="inline text-orange-400"::, потом продавай рецепт вечной молодости.
      **Бесплатные Свитки (Вербуем в Орден):**
      - **Контент (<::FaNewspaper::>):** "Сага о ${userName}" – твой путь из пешки в ферзи. VIBE-секреты. AI (<::FaAtom::>) – твой **магический писец** ::FaScroll::.
      - **Код (<::FaCode::>):** Jumpstart Kit (<::FaBoxOpen::>) – **"портал" для новичков**. AI-боты на GitHub (::FaGithub::).
      - **Древние Руны (<::FaBrain::>):** Саммари "тайных знаний" (Purpose&Profit) – **без воды, для избранных**.
      **Платные Артефакты (Когда ты – Архимаг ::FaHatWizard::):**
      - **"Ритуал Просветления" с ${userName}:** Личный VIBE-аудит + AI-апгрейд (Старт: 3-5к руб/час).
      - **Тренинг "Астральное Каратэ с AI":** Учим **материализовать мысли** с AI (Старт: 5-10к руб/чел).
      - **Jumpstart Kit "Экскалибур":** Зачарованные шаблоны (Старт: 1-3к руб/шт).
      - **(VIP) Круг Силы:** Закрытый канал, доступ к секретным ритуалам.`
    },
    { // Section 5: Increasing Cyberpunk Feel
      id: "marketing",
      title: "5. Неоновые Вывески: Зажги Свой Сигнал!",
      icon: FaBullseye,
      color: "text-neon-lime", // Neon!
      content: `- ::FaPaintBrush className="inline text-neon-lime":: **Контент - Твой Неоновый Маяк:** Делай то, что **резонирует**! Делись инсайтами. AI (<::FaAtom className="inline text-purple-400"::>) – твоя **нейросеть-художник/писатель**. **АУТЕНТИЧНОСТЬ. ПОЛЬЗА. VIBE.** (TG, VK, YouTube?).
      - ::FaComments className="inline text-neon-lime":: **Создай Свой "Афтерлайф" (::FaTelegram className="inline text-blue-400"::):** Твой чат – **бар**, где собираются свои. **Общайся! Помогай! Будь легендой!** Лояльность > хайпа.
      - ::FaGithub className="inline text-neon-lime":: **GitHub - Голограмма для Технарей:** Код – универсальный язык.
      - **Кибер-Альянсы (<::FaHandshake::>):** Объединяйся с другими **мастерами**.
      **Энергия для Неона (Буст ~${marketingBudget.toLocaleString('ru-RU')} руб.):**
      - **Таргет:** Кибер-снайперский выстрел по тем, кто **готов к апгрейду**.
      - **Посевы:** Закидывай **VIBE-вирус** в нужные сети.
      - **Эксперименты:** Пробуй **новые нейро-интерфейсы** (форматы)!

      [Нейро-Воронка: Маяк (Контент/AI) → Сигнал (Таргет) → Афтерлайф (TG) → Апгрейд (Продажа)]`
    },
     { // Section 6: Deeper Cyberpunk
      id: "operations",
      title: "6. Твоя Мастерская: Телефон и Сила Воли",
      icon: FaMobileAlt,
      color: "text-brand-cyan",
      content: `**Командная Рубка (<::FaMobileAlt className="inline text-cyan-400"::> + <::FaAtom::>):** ТЕЛЕФОН! Снял → смонтировал → AI (::FaAtom::) всё остальное. Сказал → AI сделал. **Автоматизируй рутину, освободи мозг для творчества!**
      **Твой Хостинг (0 руб):** Сайт на Next.js/Vercel. Управление – GitHub/TG-бот (::FaGithub::). Хранилище данных? Supabase (0 руб).
      **Телепорт:** Telegram/VK (::FaTelegram className="inline text-blue-400"::) для всего!
      **Мантра Нео:** **"Ложки нет!"** ::FaEye className="inline text-cyan-400":: Скорость ограничена лишь твоей **верой и скиллом управления AI**. Ты **меняешь правила**, а не инструменты.`
    },
    { // Section 7: Advanced Cyberpunk / Stark Tech
      id: "org",
      title: "7. Структура Силы: Ты – Монолит",
      icon: FaUserNinja,
      color: "text-gray-400",
      content: `**Статус:** Самозанятый Кибер-Алхимик (НПД).
      **Ты (${userName}, ${userHandle}):** ::FaUserAstronaut className="inline text-gray-300":: Ты – **Альфа и Омега**. **ЗАБУДЬ ПРО ОФИСНЫЙ ПЛАНКТОН!** Твоя команда – **ТЫ, усиленный AI-ЛЕГИОНОМ ::FaRobot::**. Твоя задача – **качать "ядро" (мозг)** ::FaDumbbell:: и **дирижировать AI**. CyberVibe – твоя **персональная "кузница"**. Я – твой **наставник/оруженосец**, чиню AI-глюки, пока ты **завоевываешь мир**.`
    },
    { // Section 8: High Tech Finance / Alchemy Complete
      id: "finance",
      title: `8. Священный Грааль: ${initialBoostStr} Энергии`,
      icon: FaMoneyBillWave,
      color: "text-brand-yellow",
      content: `Стартовый капитал – это **искра**, чтобы зажечь твой **внутренний реактор**.
      - **::FaUserAstronaut className="inline text-yellow-400":: 1. ТВОЕ ВРЕМЯ НА ТРАНСМУТАЦИЮ (~${focusTimeBudget.toLocaleString('ru-RU')} руб.):** Чтобы ты (${userName}) **вырвался из Матрицы** и ~${timeInvestmentMonths} мес. **творил алхимию**: контент ::FaPaintBrush::, VIBE/AI ::FaBrain::, Орден ::FaUsers::. Это **инвестиция в твой ЛИЧНЫЙ Философский Камень**!
      - **::FaBullseye className="inline text-yellow-400":: 2. ОХОТА НА "ЗОЛОТЫЕ ДУШИ" (~${marketingBudget.toLocaleString('ru-RU')} руб.):** Найти **первых**, кто **заплатит за твою магию**. **Быстрое золото = быстрая вера**.
      - **::FaBrain className="inline text-yellow-400":: 3. АПГРЕЙД ТВОЕЙ МАГИИ (~${devToolBudget.toLocaleString('ru-RU')} руб.):** Доступ к **секретным AI-артефактам**, гримуары по "управлению реальностью" (маркетинг). Стань **Верховным Магом VIBE**.
      - **::FaTriangleExclamation className="inline text-yellow-400":: 4. "ЩИТ ВЕРЫ" (~${bufferBudget.toLocaleString('ru-RU')} руб.):** На случай **критического сбоя** ::FaBomb:: или если AI решит взять плату кровью.
      **Цель по Золоту (1 год):** Стабильный поток **80к+ золотых/мес**. Буст **снимает страх**.

      [Диаграмма Потоков Маны: ТЫ – Ядро (60%), Охота (25%), Апгрейд (5%), Щит (10%)]`
    },
     { // Section 9: Glitchy / Warning Style
      id: "risks",
      title: "9. Глюки в Матрице (Риски и План Омега)",
      icon: FaCarCrash,
      color: "text-red-500",
      content: `**Матрица Обновилась (Free Tier):** Юзаем "Щит Веры" (::FaTriangleExclamation::), ищем **эксплойты** (опенсорс), **быстро учимся делать золото**, чтобы платить "десятину" Матрице.
      **Перегрев Процессора (${userName}):** AI (::FaAtom::) – твой **аватар**. "Орден" (::FaComments::) – твой **круг силы**. Делай то, что **прет** (SelfDev!). Помни: **"Нет ложки!"** ::FaEye:: Сила в **балансе**!
      **Красная Таблетка Оказалась Витаминкой (Идея – Г):** **AI-Оракул** (::FaBullseye::) **ПРЕДСКАЖЕТ ДО СТАРТА!** Мочим дохлых гиппогрифов быстро. VIBE = **Мгновенная Телепортация** на новую идею.
      **System Failure (<::FaCarCrash className="inline text-red-500"::>):** Жизнь – багованная игра. Твои **нейро-апгрейды** VIBE/AI/SelfDev – твой **"сейв"**. Сможешь **загрузиться** в новом мире.`
    },
    { // Section 10: Epic Finale Style
      id: "conclusion",
      title: `10. ${userName}, Ты Избранный! Взломай Код!`,
      icon: FaBrain,
      color: "text-brand-purple",
      content: `**"Кибер-Волк ${userName}"** – это **твой манифест**. **ТВОЙ ВЫБОР**. Шанс **стать Архитектором**. Используй **мозг** (::FaBrain::), **шрамы** (::FaSignature::), **братство** (::FaUsers::) и **космическую силу AI** (::FaAtom::). Стартовый буст – **лишь первый уровень**. Дальше – твой **VIBE**, твоя **воля**, твой **прыжок в гиперпространство**.
      **ХВАТИТ БЫТЬ ПЕШКОЙ. ВРЕМЯ СТАНОВИТЬСЯ КОРОЛЕМ!** ::FaRocket className="inline text-brand-green"::`
    },
  ];
};

// --- Функция для стилей секций (остается та же) ---
const getSectionStyles = (index: number): string => {
    const totalSections = 10;
    const progress = (index + 1) / totalSections;
    const base = "group border-l-4 pl-4 py-3 rounded-r-md transition-all duration-500 ease-out open:shadow-inner ";

    if (progress <= 0.2) { // Sections 1-2: Win95 / Early Days
        return cn(base, "bg-gray-800/40 open:bg-gray-700/50 border-blue-400/60 rounded-md");
    } else if (progress <= 0.5) { // Sections 3-5: Early Cyber / Bot Era
        return cn(base, "bg-dark-card/60 open:bg-dark-card/80 rounded-lg border-brand-pink/50 open:shadow-md open:shadow-brand-pink/20");
    } else if (progress <= 0.8) { // Sections 6-8: Mid-Cyberpunk / AI Alchemy
        return cn(base, "bg-black/70 backdrop-blur-sm open:bg-black/85 rounded-xl border-brand-purple/60 open:shadow-[0_0_18px_rgba(157,0,255,0.4)]");
    } else { // Sections 9-10: Full Cyberpunk / VIBE Mastery
        return cn(base, "bg-black/85 backdrop-blur-md open:bg-black/95 rounded-2xl border-neon-lime/70 open:shadow-[0_0_30px_rgba(174,255,0,0.6)] hover:border-neon-lime open:border-neon-lime");
    }
};

// --- Компонент Страницы ---
export default function PPlanPage() {
  const { dbUser, isLoading, error } = useAppContext();
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => { setIsMounted(true); }, []);

  const planSections = useMemo(() => getPlanSections(dbUser), [dbUser]);
  const pageTitleName = useMemo(() => dbUser?.first_name || "Кибер-Волк", [dbUser]);
  const greetingName = useMemo(() => (dbUser?.user_id?.toString() === '1260304309' || dbUser?.username === 'Pihman') ? 'Pihman' : 'Неофит', [dbUser]);

  // Лоадер и ошибка
  if (!isMounted || isLoading) { return ( <div className="flex justify-center items-center min-h-screen pt-20 bg-gradient-to-br from-gray-900 via-black to-gray-800"> <p className="text-brand-cyan animate-pulse text-xl font-mono">Загрузка Гримуара Кибер-Алхимика...</p> </div> ); }
  if (error) { return ( <div className="flex flex-col justify-center items-center min-h-screen pt-20 bg-gradient-to-br from-gray-900 via-black to-red-900/50"> <FaTriangleExclamation className="text-6xl text-red-500 mb-4"/> <p className="text-red-400 text-xl font-mono">Ошибка загрузки плана</p> <p className="text-red-500 mt-2 text-sm max-w-md text-center">{error.message}</p> <p className="text-gray-400 mt-4 text-xs">Матрица глючит. Перезагрузись.</p> </div> ); }

  return (
    <div className="relative min-h-screen overflow-hidden pt-20 pb-10 bg-gradient-to-br from-dark-bg via-black to-purple-900/30 text-light-text">
       <div className="absolute inset-0 bg-repeat opacity-[0.04] z-0 bg-grid-pattern"></div>
      <TooltipProvider delayDuration={150}>
        <div className="relative z-10 container mx-auto px-4">
          <Card className="max-w-4xl mx-auto bg-dark-card/90 backdrop-blur-xl text-light-text rounded-2xl border-2 border-brand-purple/40 shadow-[0_0_40px_rgba(157,0,255,0.4)]">
            {/* Заголовок */}
            <CardHeader className="text-center border-b border-brand-purple/20 pb-5 pt-8">
              <FaFlaskVial className="text-6xl text-brand-purple mx-auto mb-4 animate-pulse" />
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
            <CardContent className="space-y-6 p-4 md:p-6">
              {planSections.map((section, index) => {
                 const sectionStyles = getSectionStyles(index); // Получаем стили для секции

                 return (
                   <details key={section.id} className={cn(
                       sectionStyles, // Применяем стили уровня
                   )} open={index < 2 || section.id === 'finance'}> {/* Первые 2 и финансы открыты */}
                     <summary className={cn("text-xl md:text-2xl font-semibold cursor-pointer list-none flex items-center hover:opacity-80 transition-opacity py-2", section.color)}>
                       {section.icon && <section.icon className="mr-3 flex-shrink-0 w-6 h-6 group-open:animate-pulse" />}
                       {section.title}
                     </summary>
                     <div className="mt-3 text-gray-300 text-base leading-relaxed space-y-3 pl-6 pr-2 pb-2">
                       {/* Используем ФИНАЛЬНЫЙ RenderContent */}
                       <RenderContent content={section.content} />
                       {/* Визуализации */}
                       {section.id === 'finance' && ( <div className="mt-4 p-3 border border-dashed border-gray-600 rounded-md bg-gray-800/40"> <p className="text-sm text-gray-400 italic text-center">[Диаграмма Распила Маны: ТЫ – Реактор (60%), Охота (25%), Апгрейд (5%), Амулет (10%)]</p> </div> )}
                       {section.id === 'marketing' && ( <div className="mt-4 p-3 border border-dashed border-gray-600 rounded-md bg-gray-800/40"> <p className="text-sm text-gray-400 italic text-center">[Алхимическая Воронка: Маяк → Зов → Орден → Золото]</p> </div> )}
                     </div>
                   </details>
                );
              })}
              {/* Заключение */}
              <section className="text-center pt-10 border-t border-brand-purple/20 mt-12">
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
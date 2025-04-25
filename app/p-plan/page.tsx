"use client";

// --- Полные Импорты ---
import React, { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAppContext } from "@/contexts/AppContext";
import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from "@/components/ui/tooltip";
// ВСЕ Иконки, используемые в тексте и JSX
import {
  FaFileAlt, FaBullseye, FaUsers, FaBoxOpen, FaChartLine, FaAtom,
  FaMobileAlt, FaComments, FaPaintBrush, FaBrain, FaRocket, FaUserNinja,
  FaMoneyBillWave, FaTriangleExclamation, FaUserAstronaut, FaSignature,
  FaRecycle, FaCode, FaVideo, FaNewspaper, FaGithub, FaTelegram, FaCarCrash,
  FaRobot, FaGift, FaHandshake, FaBomb, FaFlaskVial, FaInfinity, FaDumbbell,
  FaEye, FaHatWizard, FaPoo, FaKey, FaBolt, FaScroll, // Добавленные ранее
  FaHandPointer, FaUserSecret // Для Морфеуса/Донни
} from "react-icons/fa6";
import { debugLogger } from "@/lib/debugLogger";
import Link from "next/link";
import { cn } from "@/lib/utils";
import type { Database } from "@/types/database.types";

// --- Типы ---
type DbUser = Database["public"]["Tables"]["users"]["Row"] | null;

// --- Карта Компонентов Иконок (Для RenderContent) ---
// Убедимся, что ВСЕ иконки, используемые в маркерах, здесь есть
const iconComponents: { [key: string]: React.ElementType } = {
  FaFileAlt, FaBullseye, FaUsers, FaBoxOpen, FaChartLine, FaAtom, FaFlaskVial,
  FaMobileAlt, FaComments, FaPaintBrush, FaBrain, FaRocket, FaUserNinja, FaInfinity, FaDumbbell,
  FaMoneyBillWave, FaTriangleExclamation, FaUserAstronaut, FaSignature, FaEye,
  FaRecycle, FaCode, FaVideo, FaNewspaper, FaGithub, FaTelegram, FaCarCrash,
  FaRobot, FaGift, FaHandshake, FaBomb, FaHatWizard, FaPoo, FaKey, FaBolt, FaScroll,
  FaHandPointer, FaUserSecret // Добавил недостающие
};

// --- RenderContent v4.2: Упрощенный и проверенный ---
const RenderContent: React.FC<{ content: string }> = React.memo(({ content }) => {
    return content.split('\n').map((paragraph, pIndex) => {
        if (!paragraph.trim()) return null; // Пропускаем пустые строки

        const parts: React.ReactNode[] = [];
        // Находим все маркеры и текст между ними
        const regex = /(\*\*(.*?)\*\*)|(::Fa(\w+)(?:\s+className="([^"]*)")?\s*::)/g;
        let lastIndex = 0;
        let match;

        while ((match = regex.exec(paragraph)) !== null) {
            // Добавляем текст перед совпадением
            if (match.index > lastIndex) {
                parts.push(paragraph.substring(lastIndex, match.index).replace(/->/g, '→'));
            }
            // Обрабатываем совпадение (жирный или иконка)
            if (match[1]) { // **bold**
                parts.push(<strong key={lastIndex + '-bold'}>{match[2]}</strong>);
            } else if (match[3]) { // ::FaIcon::
                const iconName = match[4];
                const className = match[5] || "";
                const IconComp = iconComponents[`Fa${iconName}`];
                if (IconComp) {
                    const finalClassName = cn("inline-block align-middle mx-1", className || "w-4 h-4");
                    parts.push(<IconComp key={lastIndex + '-icon'} className={finalClassName} />);
                } else {
                    console.warn(`[RenderContent] Icon "Fa${iconName}" not found.`);
                    parts.push(<span key={lastIndex + '-icon-error'} className="text-red-500 font-mono" title={`Icon Fa${iconName} not found`}>[?]</span>);
                }
            }
            lastIndex = regex.lastIndex; // Обновляем индекс для следующего поиска
        }
        // Добавляем оставшийся текст
        if (lastIndex < paragraph.length) {
            parts.push(paragraph.substring(lastIndex).replace(/->/g, '→'));
        }

        // Рендерим параграф, только если он содержит что-то видимое
        return parts.some(part => (typeof part === 'string' && part.trim() !== '') || React.isValidElement(part))
            ? <p key={pIndex} className="mb-2 last:mb-0">{parts.map((part, partIndex) => <React.Fragment key={partIndex}>{part}</React.Fragment>)}</p>
            : null;

    }).filter(Boolean); // Убираем null параграфы
});
RenderContent.displayName = 'RenderContent';

// --- Функция генерации секций (getPlanSections) с ФИНАЛЬНЫМ ТЕКСТОМ БЕЗ "ГРАНТА" ---
const getPlanSections = (dbUser: DbUser) => {
  const userName = dbUser?.first_name || 'Неофит';
  const isSanek = dbUser?.user_id?.toString() === '1260304309' || dbUser?.username === 'Pihman';
  const userHandle = isSanek ? '@Pihman_Reborn69' : (dbUser?.username ? `@${dbUser.username}` : 'Твой_Кибер_Сигил');
  const userOriginStory = isSanek
     ? "в гравитационном колодце разбитых карданов ::FaCarCrash className='inline text-red-500'::"
     : "в поисках апгрейда серой реальности";
  const myExperience = "13+ лет в трансмутации реальности";
  const initialBoost = 350000;
  const initialBoostStr = `${initialBoost.toLocaleString('ru-RU')} руб.`;
  const focusTimeCostPerMonth = 35000;
  const focusTimeBudget = initialBoost * 0.60;
  const timeInvestmentMonths = Math.floor(focusTimeBudget / focusTimeCostPerMonth);
  const marketingBudget = Math.round(initialBoost * 0.25);
  const devToolBudget = Math.round(initialBoost * 0.05);
  const bufferBudget = initialBoost - focusTimeBudget - marketingBudget - devToolBudget;

  // Текст секций с новыми отсылками и без "гранта"
  return [
     { // Section 1: Win95 - Простой, базовый
      id: "resume",
      title: `1. Инициация: ${userName}, Проснись, Нео...`,
      icon: FaBomb, // Старая жизнь = бомба замедленного действия
      color: "text-blue-400",
      content: `Проект **"Кибер-Волк ${userName}"** – это не папка 'Мои Документы'. Это **Красная Таблетка** ::FaEye className="inline text-red-500"::. Твой JUMPSTART ::FaRocket className="inline text-blue-400"::, чтобы ты (${userHandle}) **вырвался нах*й** из ${userOriginStory} и начал **видеть код Матрицы**. Управлять? **Телефоном, Нео!** ::FaMobileAlt className="inline text-blue-400"::!
      **VIBE – Твой Новый Кодекс:** Скорость (::FaRocket::) + **AI как Нейроинтерфейс** (::FaAtom className="inline text-purple-400"::>, Gemini 1.5 Pro – халявный апгрейд мозга!) + Кибер-Защита (::FaUserNinja className="inline text-gray-500"::>). И **SelfDev** – ты **перезагружаешь себя**.
      **Инструменты Зиона:** Юзаем **халяву** – Vercel, GitHub (::FaGithub::), Telegram (::FaTelegram className="inline text-blue-400"::>). **Платить – выбор слабых** (пока есть лазейки).
      **Стартовый Ресурс (${initialBoostStr}) – Твоя "Ложка", Которой Нет:** Это не пособие. Это **энергия для твоего прыжка**. На что:
      - **ТВОЕ ВРЕМЯ для "Тренировки в Додзе"** (~${timeInvestmentMonths} мес. ::FaUserAstronaut className="inline text-yellow-400"::): **Забей на "работу"**. Изучай VIBE, генери контент с AI, **учись изгибать ложки**. Это твоя **персональная "качалка" для разума** ::FaDumbbell::. Я – твой **Морфеус/тренер** ::FaHandPointer className="inline text-blue-400"::, чиню Матрицу (баги AI), пока ты **становишься Избранным**.
      - **Охота на "Розовые Чеки" Волка** (~${marketingBudget.toLocaleString('ru-RU')} руб.): Найти первых **"Донни"** ::FaUserSecret className="inline text-pink-400":: – клиентов, кто **заплатит за твою "магию"**. Помогать другим **умножать их кэш** с AI – это **самый дерзкий и прибыльный "развод"**, который почти легален! ::FaMoneyBillWave className="inline text-pink-400"::.
      - **Апгрейд Твоего "Кода"** (~${devToolBudget.toLocaleString('ru-RU')} руб.): Доступ к **секретным AI-протоколам** (GPT-4/Claude 3), скрипты по "взлому" маркетинга. Стань **Архитектором своей Матрицы**.
      - **"Аварийный Телепорт"** (~${bufferBudget.toLocaleString('ru-RU')} руб.): На случай ::FaCarCrash:: или если Оракул (Google) потребует плату.
      **Цель:** Построить **не сайт, а ЛИЧНЫЙ ИСТОЧНИК СИЛЫ**, генерирующий **свободу и бабло**, на **VIBE OS**.`
    },
     { // Section 2: Win98/XP - Чуть сложнее, появляются иконки
      id: "description",
      title: "2. Твой Кибер-Арсенал: Интерфейс к Силе",
      icon: FaUserAstronaut,
      color: "text-brand-cyan",
      content: `**Командный Мостик:** Телефон ::FaMobileAlt className="inline text-cyan-400":: + Ноут (опц).
      **1. Личный Голодек (Сайт/Блог, 0 руб):** Твоя легенда. Путь из ${userOriginStory}. VIBE-мануалы, кейсы "искривления реальности". **Обновляется сам** (GitHub ::FaGithub:: + TG-бот ::FaTelegram::).
      **2. Твой Зион (TG-Канал/Чат ::FaTelegram className="inline text-blue-400"::):** Собирай **экипаж "Навуходоносора"** ::FaUsers::. Делись альфа-инфой, руби правду-матку, создавай **сопротивление**.
      **3. Библиотека Заклинаний (GitHub ::FaGithub::):** Твой "Кибер-Сундук". Готовые артефакты (Jumpstart Kit ::FaBoxOpen::!), VIBE-автоматизация. **Тут ты - Архимаг**.
      **4. AI-Репликатор (::FaAtom className="inline text-purple-400":: + ::FaRecycle className="inline text-yellow-400"::):** Твой **личный Джарвис**. Мысль → текст, видео, арт, код. **Идея → Воплощение.** Экономит 99% энергии ::FaBolt::.
      **УТП (Твой Уникальный "Глюк в Матрице"):** Ты – **${userName} (${userHandle})**, **выбравшийся** из ${userOriginStory}. Ты юзаешь **подпольный AI** ::FaRobot::. Ты **не Агент Смит**. Ты **даешь красную таблетку, а не синюю**.`
    },
    { // Section 3: Early Cyberpunk - Неон, тени
      id: "market",
      title: "3. Охотничьи Угодья: Ищем Тех, Кто Готов Проснуться",
      icon: FaUsers,
      color: "text-brand-pink",
      content: `Рынок РФ? Руины старого мира, где **прорастает киберпанк**. AI – это **универсальный отмычка** ::FaKey className="inline text-pink-400"::.
      **Твоя Цель (ЦА):** Заблудшие овцы, подключенные к Матрице. Как ты вчера, ${userName}. Разрабы со **старым софтом в голове**. Фрилансеры, **гриндившие репутацию**. Малый бизнес, кто **хочет AI-апгрейд за еду**. Все, кто ищет **Ctrl+Alt+Del** для ${userOriginStory}.
      **Агенты Смиты (Конкуренты):** Продавцы воздуха, теоретики без практики, инфоцыгане.
      **Твой Маскировочный Код (Отстройка):**
      - **Ты (${userName}):** Твоя история ::FaSignature:: – **неотразимый сигнал**.
      - **VIBE:** Скорость Нео (::FaRocket::) + Магия AI (::FaAtom::) + Броня Старка (::FaUserNinja::). Мы **пишем будущее**.
      - **SelfDev:** Качаем **мозг** ::FaBrain:: и **волю** ::FaUserNinja::. Помогаем **стать Избранным**.
      - **AI-Алхимия (::FaAtom::):** Наш **вечный двигатель** контента ::FaInfinity::.
      - **"Красная Таблетка для Всех":** Просто, доступно, **без пафоса**.`
    },
     { // Section 4: More Cyberpunk
      id: "product",
      title: "4. Твои Артефакты: Прошивки для Мозга",
      icon: FaGift,
      color: "text-brand-orange",
      content: `Принцип "Сначала Демо-Версия": Дай пощупать силу ::FaGift className="inline text-orange-400"::, потом продавай лицензию.
      **Бесплатные Чипы (Вербовка в Сопротивление):**
      - **Контент (::FaNewspaper::):** "Дневник Нео" – твой путь, VIBE-инсайты. AI (::FaAtom::) – твой **Оракул**.
      - **Код (::FaCode::):** Jumpstart Kit (::FaBoxOpen::) – **установка "Кунг-Фу"**. AI-боты на GitHub (::FaGithub::).
      - **Концентрат Мудрости (::FaBrain::):** Саммари "запретных текстов" (Purpose&Profit) – **для своих**.
      **Платные Прошивки (Когда ты – Архитектор ::FaHatWizard::):**
      - **"Дефрагментация Разума" с ${userName}:** Личный VIBE-тюнинг + AI-интеграция (Старт: 3-5к руб/час).
      - **Тренинг "Анти-Матрица с AI":** Учим **уклоняться от пуль** (проблем) с AI (Старт: 5-10к руб/чел).
      - **Jumpstart Kit "Избранный":** Заряженные кибер-шаблоны (Старт: 1-3к руб/шт).
      - **(VIP) Внутренний Круг Зиона:** Секретный канал, прямая связь.`
    },
    { // Section 5: Neon Glow
      id: "marketing",
      title: "5. Неоновые Сигналы: Призыв Пробужденных",
      icon: FaBullseye,
      color: "text-neon-lime",
      content: `- ::FaPaintBrush className="inline text-neon-lime":: **Контент - Твой Сигнал:** Делай то, что **вибрирует**! Делись процессом. AI (::FaAtom className="inline text-purple-400"::) – твоя **нейро-фабрика** (текст, видео, арт). **ПРАВДА. ПОЛЬЗА. VIBE.** (TG, VK, YouTube?).
      - ::FaComments className="inline text-neon-lime":: **Создай Свой "Зион" (::FaTelegram className="inline text-blue-400"::>):** Твой чат – **последний оплот свободы**. **Общайся! Помогай! Вдохновляй!** Лояльность > подписчиков.
      - ::FaGithub className="inline text-neon-lime":: **GitHub - Холодек для Гиков:** Код как искусство.
      - **Альянсы (::FaHandshake::):** Объединяйся с другими **хакерами реальности**.
      **Топливо для Сигнала (Буст ~${marketingBudget.toLocaleString('ru-RU')} руб.):**
      - **Таргет:** Найти тех, кто **уже ищет красную таблетку**.
      - **Посевы:** Распространяй **VIBE-вирус** по сети.
      - **Эксперименты:** Пробуй **новые частоты** (форматы)!

      [Воронка Пробуждения: Сигнал (Контент/AI) → Зов (Таргет) → Зион (TG) → Просветление (Продажа)]`
    },
     { // Section 6: Deeper Cyberpunk, Blur
      id: "operations",
      title: "6. Твоя Кибер-Лаборатория: Телефон и Сила Мысли",
      icon: FaMobileAlt,
      color: "text-brand-cyan",
      content: `**Пульт Управления (<::FaMobileAlt className="inline text-cyan-400"::> + <::FaAtom::>):** ТЕЛЕФОН! Снял → смонтировал → AI (::FaAtom::) всё остальное. Сказал → AI сделал. **Автоматизируй Матрицу!**
      **Твой Сервер (0 руб):** Сайт на Next.js/Vercel. Управление – GitHub/TG-бот (::FaGithub::). База знаний? Supabase (0 руб).
      **Нейролинк:** Telegram/VK (::FaTelegram className="inline text-blue-400"::) для всего!
      **Мантра Морфеуса:** **"Ты думаешь, это воздух?!"** ::FaEye className="inline text-cyan-400":: Твоя скорость – это **вера и навык управления AI**. Ты **пишешь правила**, а не следуешь им.`
    },
    { // Section 7: Advanced Cyberpunk / Stark Tech
      id: "org",
      title: "7. Структура Силы: Ты – Ядро Реактора",
      icon: FaUserNinja,
      color: "text-gray-400",
      content: `**Статус:** Самозанятый Кибер-Алхимик (НПД).
      **Ты (${userName}, ${userHandle}):** ::FaUserAstronaut className="inline text-gray-300":: Ты – **НЕО + СТАРК + МОРФЕУС в одном флаконе**. **ЗАБУДЬ ПРО ОФИСНЫЙ ПЛАНКТОН!** Твоя команда – **ТЫ, усиленный AI-ЛЕГИОНОМ ::FaRobot::**. Твоя задача – **прокачивать свой "Arc Reactor" (мозг)** ::FaDumbbell:: и **быть дирижером AI-симфонии**. CyberVibe – твоя **"пещера Старка"**. Я – твой **Джарвис/тренер**, ловлю глюки AI, пока ты **спасаешь мир (свой, для начала)**.`
    },
    { // Section 8: High Tech Finance / Alchemy Complete
      id: "finance",
      title: `8. Философский Камень: ${initialBoostStr} Энергии`,
      icon: FaMoneyBillWave,
      color: "text-brand-yellow",
      content: `Стартовый капитал – это **искра**, чтобы зажечь твой **внутренний огонь**.
      - **::FaUserAstronaut className="inline text-yellow-400":: 1. ТВОЕ ВРЕМЯ НА ТРАНСМУТАЦИЮ (~${focusTimeBudget.toLocaleString('ru-RU')} руб.):** Чтобы ты (${userName}) **вырвался из Матрицы** и ~${timeInvestmentMonths} мес. **творил**: контент ::FaPaintBrush::, VIBE/AI ::FaBrain::, Орден ::FaUsers::. Это **инвестиция в твой ЛИЧНЫЙ Философский Камень**!
      - **::FaBullseye className="inline text-yellow-400":: 2. ОХОТА НА "ЗОЛОТЫЕ ДУШИ" (~${marketingBudget.toLocaleString('ru-RU')} руб.):** Найти **первых**, кто **заплатит за твою магию**. **Быстрые деньги = топливо для веры**.
      - **::FaBrain className="inline text-yellow-400":: 3. АПГРЕЙД ТВОЕЙ СИЛЫ (~${devToolBudget.toLocaleString('ru-RU')} руб.):** Доступ к **мощнейшим AI-гримуарам** ::FaScroll::, секреты "нейро-маркетинга". Стань **Верховным Магом VIBE**.
      - **::FaTriangleExclamation className="inline text-yellow-400":: 4. "ЩИТ ВЕРЫ" (~${bufferBudget.toLocaleString('ru-RU')} руб.):** На случай **критического сбоя** ::FaBomb:: или если AI потребует дань.
      **Цель по Золоту (1 год):** Стабильный поток **80к+ золотых/мес**. Буст **снимает страх**.

      [Диаграмма Потоков Энергии: ТЫ – Ядро (60%), Охота (25%), Апгрейд (5%), Щит (10%)]`
    },
     { // Section 9: Glitchy / Warning Style
      id: "risks",
      title: "9. Глюки в Матрице (Риски и План \"Омега\")",
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
      content: `**"Кибер-Волк ${userName}"** – это **твой манифест**. **ТВОЙ ВЫБОР**. Шанс **стать Архитектором**. Используй **мозг** (::FaBrain::), **шрамы** (::FaSignature::), **братство** (::FaUsers::) и **космическую силу AI** (::FaAtom::). Стартовый буст – **лишь первый разряд** ::FaBolt className="inline text-yellow-400"::. Дальше – твой **VIBE**, твоя **воля**, твой **прыжок в неизвестность**.
      **ХВАТИТ БЫТЬ ПЕШКОЙ. ВРЕМЯ СТАНОВИТЬСЯ КОРОЛЕМ!** ::FaRocket className="inline text-brand-green"::`
    },
  ];
};

// --- Функция для стилей секций (остается та же) ---
const getSectionStyles = (index: number): string => {
    const totalSections = 10;
    const progress = (index + 1) / totalSections;
    // Base styles + Increased contrast and effects for later stages
    const base = "group border-l-4 pl-4 py-3 rounded-r-md transition-all duration-500 ease-in-out open:shadow-lg "; // Increased shadow on open

    if (progress <= 0.2) { // Sections 1-2: Win95/DOS - Simple, blocky, less intense
        return cn(base, "bg-gray-800/30 open:bg-gray-700/40 border-blue-500/50 rounded"); // Simpler rounding
    } else if (progress <= 0.5) { // Sections 3-5: Early Cyber - Darker, subtle glow, rounded corners
        return cn(base, "bg-dark-card/50 open:bg-dark-card/70 rounded-lg border-brand-pink/60 open:shadow-md open:shadow-brand-pink/30");
    } else if (progress <= 0.8) { // Sections 6-8: Mid-Cyberpunk - Black, blur, stronger glow, more rounded
        return cn(base, "bg-black/60 backdrop-blur-sm open:bg-black/75 rounded-xl border-brand-purple/70 open:shadow-[0_0_20px_rgba(157,0,255,0.5)]");
    } else { // Sections 9-10: Peak VIBE - Intense black, heavy blur, bright neon, max glow, full rounded
        return cn(base, "bg-black/80 backdrop-blur-md open:bg-black/90 rounded-2xl border-neon-lime/80 open:shadow-[0_0_35px_rgba(174,255,0,0.8)] hover:border-neon-lime open:border-neon-lime");
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

  // Определяем initialBoostStr ЗДЕСЬ, чтобы она была доступна для подзаголовка
  const initialBoost = 350000;
  const initialBoostStr = useMemo(() => `${initialBoost.toLocaleString('ru-RU')} руб.`, [initialBoost]);

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
                 <RenderContent content={`Твой Рецепт: От **${greetingName === 'Pihman' ? 'Свинцового Кардана' : 'Нуля'}** ::FaCarCrash className="inline text-red-500":: к **Золотому VIBE** ::FaMoneyBillWave className="inline text-yellow-400"::. Стартовый Буст ${initialBoostStr} маны. (Личный Гримуар для ${greetingName})`} />
              </div>
            </CardHeader>
            {/* Секции Плана */}
            <CardContent className="space-y-4 p-4 md:p-6"> {/* Уменьшил еще немного space-y */}
              {planSections.map((section, index) => {
                 const sectionStyles = getSectionStyles(index);

                 return (
                   <details key={section.id} className={cn(
                       sectionStyles,
                   )} open={index < 2 || section.id === 'finance'}> {/* Первые 2 и финансы */}
                     <summary className={cn("text-xl md:text-2xl font-semibold cursor-pointer list-none flex items-center hover:opacity-80 transition-opacity py-2", section.color)}>
                       {section.icon && <section.icon className="mr-3 flex-shrink-0 w-6 h-6 group-open:animate-pulse" />}
                       {section.title}
                     </summary>
                     <div className="mt-3 text-gray-300 text-base leading-relaxed space-y-3 pl-6 pr-2 pb-2">
                       <RenderContent content={section.content} />
                       {/* Визуализации */}
                       {section.id === 'finance' && ( <div className="mt-4 p-3 border border-dashed border-gray-600 rounded-md bg-gray-800/40"> <p className="text-sm text-gray-400 italic text-center">[Диаграмма Потоков Маны: ТЫ – Ядро (60%), Охота (25%), Апгрейд (5%), Щит (10%)]</p> </div> )}
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
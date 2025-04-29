"use client";

// --- Полные Импорты ---
import React, { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAppContext } from "@/contexts/AppContext";
import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from "@/components/ui/tooltip";
// ВСЕ Иконки, используемые в тексте и JSX + НОВЫЕ
import {
  FaFileAlt, FaBullseye, FaUsers, FaBoxOpen, FaChartLine, FaAtom,
  FaMobileAlt, FaComments, FaPaintBrush, FaBrain, FaRocket, FaUserNinja,
  FaMoneyBillWave, FaTriangleExclamation, FaUserAstronaut, FaSignature,
  FaRecycle, FaCode, FaVideo, FaNewspaper, FaGithub, FaTelegram, FaCarCrash,
  FaRobot, FaGift, FaHandshake, FaBomb, FaFlaskVial, FaInfinity, FaDumbbell,
  FaEye, FaHatWizard, FaPoo, FaKey, FaBolt, FaScroll, FaHandPointer, FaUserSecret
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
  FaHandPointer, FaUserSecret
};

// *** RenderContent v5: Используем iterative exec ***
const RenderContent: React.FC<{ content: string }> = React.memo(({ content }) => {
    // Split by paragraphs first
    return content.split('\n').map((paragraph, pIndex) => {
        if (!paragraph.trim()) return null; // Skip empty lines

        const elements: React.ReactNode[] = [];
        const regex = /(\*\*(.*?)\*\*)|(::Fa(\w+)(?:\s+className="([^"]*)")?\s*::)/g;
        let lastIndex = 0;
        let keyCounter = 0; // Use simple counter for keys within a paragraph
        let match;

        while ((match = regex.exec(paragraph)) !== null) {
            const matchStartIndex = match.index;
            // Add text before match
            if (matchStartIndex > lastIndex) {
                elements.push(
                    <React.Fragment key={`${pIndex}-txt-${keyCounter++}`}>
                        {paragraph.substring(lastIndex, matchStartIndex).replace(/->/g, '→')}
                    </React.Fragment>
                );
            }
            // Handle match
            if (match[1]) { // Bold (**bold**) -> match[2] is the content
                elements.push(<strong key={`${pIndex}-bold-${keyCounter++}`}>{match[2]}</strong>);
            } else if (match[3]) { // Icon (::FaIcon:: or ::FaIcon className="..." ::)
                const iconName = match[4]; // Icon name like 'Rocket'
                const className = match[5] || ""; // Optional className
                const IconComp = iconComponents[`Fa${iconName}`];
                if (IconComp) {
                    const finalClassName = cn("inline-block align-middle mx-1", className || "w-4 h-4"); // Default size if no class
                    elements.push(<IconComp key={`${pIndex}-icon-${keyCounter++}`} className={finalClassName} />);
                } else {
                    console.warn(`[RenderContent] Icon "Fa${iconName}" not found.`);
                    elements.push(<span key={`${pIndex}-icon-error-${keyCounter++}`} className="text-red-500 font-mono" title={`Icon Fa${iconName} not found`}>[?]</span>);
                }
            }
            lastIndex = regex.lastIndex;
        }
        // Add remaining text after the last match
        if (lastIndex < paragraph.length) {
           elements.push(
                <React.Fragment key={`${pIndex}-txt-${keyCounter++}`}>
                    {paragraph.substring(lastIndex).replace(/->/g, '→')}
                </React.Fragment>
            );
        }

        // Final check to render the paragraph
        return elements.length > 0 ? (
            <p key={pIndex} className="mb-2 last:mb-0">
                {elements}
            </p>
        ) : null;

    }).filter(Boolean); // Filter out nulls from empty lines
});
RenderContent.displayName = 'RenderContent';


// --- Функция генерации секций (getPlanSections) с ФИНАЛЬНЫМ ТЕКСТОМ И ЭКСПОНЕНТОЙ ---
const getPlanSections = (dbUser: DbUser) => {
  const userName = dbUser?.first_name || 'Неофит';
  const isSanek = dbUser?.user_id?.toString() === '1260304309' || dbUser?.username === 'Pihman';
  const userHandle = isSanek ? '@Pihman_Reborn69' : (dbUser?.username ? `@${dbUser.username}` : 'Твой_Кибер_Сигил');
  const userOriginStory = isSanek
     ? "в гравитационном колодце разбитых карданов ::FaCarCrash className='inline text-red-500'::"
     : "в поисках апгрейда серой реальности";
  const myExperience = "13+ лет в трансмутации реальности";

  return [
     { // Section 1: Win95 - Простой и понятный, как Paint
      id: "resume",
      title: `1. Протокол "Исход": ${userName}, Взламываем Матрицу!`,
      icon: FaBomb,
      color: "text-blue-400",
      // *** UPDATED Section 1 Content ***
      content: `Проект **"Кибер-Волк ${userName}"** – это не сраный PDF. Это **чит-код** ::FaKey className="inline text-blue-400":: к твоей новой жизни! Твой JUMPSTART ::FaRocket className="inline text-blue-400"::, чтобы ты (${userHandle}) **выбил дверь с ноги** из ${userOriginStory} и начал **писать СВОЙ код реальности**. Управлять? **Телефоном, сука!** ::FaMobileAlt className="inline text-blue-400"::!
      **VIBE – Твой Новый BIOS:** Скорость (::FaRocket::) + **AI как Нейроусилитель** (::FaAtom className="inline text-purple-400"::>, Gemini 2.5 Pro – халявный IQ-буст!) + Кибер-Броня (::FaUserNinja className="inline text-gray-500"::>). И **SelfDev** – ты **перепрошиваешь себя**, как киборга. **Ключевое Открытие:** Мы тут не +1 раба в год нанимаем. Это **"Один Клик → Экспонента!"** ::FaChartLine className="inline text-yellow-500 animate-pulse"::. Маленькое изменение в первом апгрейде L1→L2 (обучить **двух** вместо одного) запускает **ВЗРЫВНОЙ РОСТ** ::FaBolt::, удваивая команду почти каждый цикл! Это не линейный набор, это **самовоспроизводящийся VIBE-вирус**!
      **Ресурсы:** Юзаем **халяву** – Vercel, GitHub (::FaGithub::), Telegram (::FaTelegram className="inline text-blue-400"::>). **Платные фичи – для Агентов Смитов**.
      **Стартовый Буст – Твой Первый "Прыжок Веры":** Это не подачка. Это **топливо для твоего "Навуходоносора"**. На что (приоритеты):
      - **ТВОЕ ВРЕМЯ для "Прокачки в Додзе"** (Основная часть): **Забей на галеры**. Погружайся в VIBE, генери контент с AI, **учись видеть Матрицу**. Это твоя **"качалка" для мозга** ::FaDumbbell::. Я – твой **Морфеус/тренер** ::FaHandPointer className="inline text-blue-400"::, ловлю глюки AI, пока ты **уклоняешься от пуль**.
      - **Охота на "Донни"** (Значительная часть): Найти первых **клиентов-последователей** ::FaUserSecret className="inline text-pink-400"::, кто **заплатит за твою "ручку"** (методологию VIBE). Помогать им **умножать кэш** с AI – это наш **"почти легальный" бизнес**! ::FaMoneyBillWave className="inline text-pink-400"::.
      - **Апгрейд Твоей "Нейросети"** (Меньшая часть): Доступ к **продвинутым AI-заклинаниям**, курсы по "взлому" маркетинга. Стань **магистром VIBE**.
      - **"Аварийный Выход"** (Резерв): На случай ::FaCarCrash:: или если AI взбунтуется.
      **Цель:** Построить **не сайт, а ЛИЧНЫЙ ГЕНЕРАТОР СВОБОДЫ И БАБОК**, работающий на **VIBE, дерзости и экспоненциальном росте**.`
    },
    { // Section 2: Win98/XP - Чуть сложнее, появляются иконки
      id: "description",
      title: "2. Твой Кибер-Арсенал: Интерфейс к Силе",
      icon: FaUserAstronaut,
      color: "text-brand-cyan",
      content: `**Командный Мостик:** Телефон ::FaMobileAlt className="inline text-cyan-400":: + Ноут (опц).
      **1. Личный Голодек (Сайт/Блог, 0 руб):** Твоя легенда. Путь из ${userOriginStory}. VIBE-мануалы, кейсы "искривления реальности". **Обновляется сам** (GitHub ::FaGithub:: + TG-бот ::FaTelegram::). Здесь ты **сеешь зерна экспоненты**.
      **2. Твой Зион (TG-Канал/Чат ::FaTelegram className="inline text-blue-400"::):** Собирай **экипаж "Навуходоносора"** ::FaUsers::. Делись альфа-инфой, руби правду-матку, создавай **сопротивление**. Координируй **лавину новичков**.
      **3. Библиотека Заклинаний (GitHub ::FaGithub::):** Твой "Кибер-Сундук". Готовые артефакты (Jumpstart Kit ::FaBoxOpen::!), VIBE-автоматизация. **Тут ты - Архимаг**. Ключ к **масштабированию магии**.
      **4. AI-Репликатор (::FaAtom className="inline text-purple-400":: + ::FaRecycle className="inline text-yellow-400"::):** Твой **личный Джарвис**. Мысль → текст, видео, арт, код. **Идея → Воплощение.** Экономит 99% энергии ::FaBolt::. Движок, **питающий твой рост**.
      **УТП (Твой Уникальный "Глюк в Матрице"):** Ты – **${userName} (${userHandle})**, **выбравшийся** из ${userOriginStory}. Ты юзаешь **подпольный AI** ::FaRobot:: и **взламываешь законы роста**. Ты **не Агент Смит**. Ты **даешь красную таблетку, а не синюю**.`
    },
    { // Section 3: Early Cyberpunk - Неон, тени
      id: "market",
      title: "3. Охотничьи Угодья: Ищем Тех, Кто Готов Проснуться",
      icon: FaUsers,
      color: "text-brand-pink",
      content: `Рынок РФ? Дикий кибер-запад! Старые правила **сломаны**. AI – это **универсальный отмычка** ::FaKey className="inline text-pink-400"::.
      **Твоя Цель (ЦА):** Застрявшие в Матрице. Как ты вчера, ${userName}. Разрабы со **старым софтом в голове**. Фрилансеры, **гриндившие репутацию**. Малый бизнес, кто **хочет AI-апгрейд за еду**. Все, кто ищет **Ctrl+Alt+Del** для ${userOriginStory}.
      **Агенты Смиты (Конкуренты):** Продавцы воздуха, теоретики без практики, инфоцыгане.
      **Твой Код Неуязвимости (Отстройка):**
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
      content: `Принцип "Сначала Демо-Версия": Дай пощупать силу ::FaGift className="inline text-orange-400"::, потом продавай лицензию на "Кунг-Фу".
      **Бесплатные Чипы (Вербовка в Сопротивление):**
      - **Контент (::FaNewspaper::):** "Дневник Нео" – твой путь, VIBE-инсайты. AI (::FaAtom::) – твой **Оракул**.
      - **Код (::FaCode::):** Jumpstart Kit (::FaBoxOpen::) – **установка "Кунг-Фу"**. AI-боты на GitHub (::FaGithub::).
      - **Концентрат Мудрости (::FaBrain::):** Саммари "запретных текстов" (Purpose&Profit) – **для своих**.
      **Платные Прошивки (Когда ты – Архитектор ::FaHatWizard::):**
      - **"Дефрагментация Разума" с ${userName}:** Личный VIBE-тюнинг + AI-интеграция (Цену определяешь сам!).
      - **Тренинг "Анти-Матрица с AI":** Учим **уклоняться от пуль** (проблем) с AI (Формат и цену решаешь сам!).
      - **Jumpstart Kit "Избранный":** Заряженные кибер-шаблоны (Цену ставишь сам!).
      - **(VIP) Внутренний Круг Зиона:** Закрытый чат, тайные техники (По подписке?).`
    },
    { // Section 5: Neon Glow
      id: "marketing",
      title: "5. Неоновые Сигналы: Призыв Пробужденных",
      icon: FaBullseye,
      color: "text-neon-lime",
      content: `- ::FaPaintBrush className="inline text-neon-lime":: **Контент - Твой Сигнал:** Делай то, что **вибрирует**! Делись процессом. AI (::FaAtom className="inline text-purple-400"::) – твоя **нейро-фабрика** (текст, видео, арт). **ПРАВДА. ПОЛЬЗА. VIBE.** (TG, VK, YouTube?).
      - ::FaComments className="inline text-neon-lime":: **Создай Свой "Зион" (::FaTelegram className="inline text-blue-400"::):** Твой чат – **последний оплот свободы**. **Общайся! Помогай! Вдохновляй!** Лояльность > охватов.
      - ::FaGithub className="inline text-neon-lime":: **GitHub - Голодек для Гиков:** Код как искусство.
      - **Альянсы (::FaHandshake::):** Объединяйся с другими **хакерами реальности**.
      **Топливо для Сигнала (Стартовый Буст ~X% бюджета):**
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
      content: `**Пульт Управления (::FaMobileAlt className="inline text-cyan-400":: + ::FaAtom::):** ТЕЛЕФОН! Снял → смонтировал → AI (::FaAtom::) всё остальное. Сказал → AI сделал. **Автоматизируй Матрицу!**
      **Твой Сервер (0 руб):** Сайт на Next.js/Vercel. Управление – GitHub/TG-бот (::FaGithub::). База знаний? Supabase (0 руб).
      **Нейролинк:** Telegram/VK (::FaTelegram className="inline text-blue-400"::) для всего!
      **Мантра Морфеуса:** **"Ты думаешь, это воздух?!"** ::FaEye className="inline text-cyan-400":: Скорость ограничена лишь твоей **верой и скиллом управления AI**. Ты **пишешь правила**, а не следуешь им.`
    },
    { // Section 7: Advanced Cyberpunk / Stark Tech
      id: "org",
      title: "7. Структура Силы: Ты – Ядро Экспоненты", // Updated title
      icon: FaUserNinja,
      color: "text-gray-400",
      // *** UPDATED Section 7 Content + NOTE FOR LEVEL 0 DUDES ***
      content: `**Статус:** Самозанятый Кибер-Алхимик (НПД).
      **Ты (${userName}, ${userHandle}):** ::FaUserAstronaut className="inline text-gray-300":: Ты – **Альфа и Омега**. **ЗАБУДЬ ПРО ОФИСНЫЙ ПЛАНКТОН И ЛИНЕЙНЫЙ НАБОР!** ::FaPoo className="inline text-red-600":: Твоя команда – **ТЫ, УСИЛЕННЫЙ AI-ЛЕГИОНОМ ::FaRobot::**. Но главный трюк – в **механике роста**. Помнишь **"Один Клик → Экспонента"** ::FaChartLine::? Обычный рост: +1 сотрудник = +1 единица работы. VIBE-рост: +1 "пробужденный" L1, докачавшийся до L2, **ЗАПУСКАЕТ ВОЛНУ ИЗ ДВУХ НОВЫХ L1** ::FaUsers className="inline text-gray-300"::! Это **цепная реакция** ::FaBolt::, а не сложение.
      **Заметка для Нулевых (L1):** Каждый раз, когда один из вас апается на L2, вы **удваиваете армию таких же как вы** на старте (L1)! Это значит, что общее число "picture updaters" (и всей команды) растет не +1, +1, +1, а как **2 в степени (время+1) минус 1** (`2^(t+1) - 1`). Грубо говоря, **почти удваивается каждый цикл**! ::FaChartLine className="inline text-yellow-400"::. Готовьтесь к лавине новичков!
      Твоя задача – **качать "бицуху" мозга** ::FaDumbbell::, быть **дирижером AI-оркестра** и **нажимать ту самую "кнопку" L1→L2**, запуская **экспоненциальный каскад**. CyberVibe – твоя **персональная "качалка" и центр управления ростом**. Я – твой **тренер/спарринг-партнер**, ловлю баги AI и слежу, чтобы **экспонента не схлопнулась**. `
    },
    { // Section 8: High Tech Finance / Alchemy Complete
      id: "finance",
      title: `8. Философский Камень: Топливо для Экспоненты`, // Updated title
      icon: FaMoneyBillWave,
      color: "text-brand-yellow",
      content: `Стартовый капитал – это **искра**, чтобы зажечь твой **внутренний огонь** и **запустить первый цикл экспоненциального роста**. Приоритеты:
      - **::FaUserAstronaut className="inline text-yellow-400":: 1. ТВОЕ ВРЕМЯ НА ТРАНСМУТАЦИЮ (Приоритет #1):** Чтобы ты (${userName}) **вырвался из Матрицы** и мог **творить**: контент ::FaPaintBrush::, VIBE/AI ::FaBrain::, Орден ::FaUsers::. Это **инвестиция в твой ЛИЧНЫЙ Философский Камень** и **первый шаг к удвоению**!
      - **::FaBullseye className="inline text-yellow-400":: 2. ОХОТА НА "ЗОЛОТЫЕ ДУШИ" (Приоритет #2):** Найти **первых**, кто **заплатит за твою магию**. **Быстрые деньги = топливо для веры и следующего цикла роста**.
      - **::FaBrain className="inline text-yellow-400":: 3. АПГРЕЙД ТВОЕЙ СИЛЫ (Приоритет #3):** Доступ к **мощнейшим AI-гримуарам** ::FaScroll::, секреты "нейро-маркетинга". Стань **Верховным Магом VIBE**, способным **управлять лавиной**.
      - **::FaTriangleExclamation className="inline text-yellow-400":: 4. "ЩИТ ВЕРЫ" (Резерв):** На случай **критического сбоя** ::FaBomb:: или если AI потребует дань. **Экспонента требует страховки**.
      **Цель по Золоту:** Стабильный **денежный поток**, достаточный для **свободы и поддержания роста**. Буст **снимает страх** и **дает первый импульс**.

      [Диаграмма Потоков Энергии: ТЫ (Искра) → Запуск L1→L2 (+2) → Охота/Апгрейд (Подпитка Роста) → Щит]` // Updated diagram text
    },
     { // Section 9: Glitchy / Warning Style
      id: "risks",
      title: "9. Глюки в Матрице (Риски и План \"Омега\")",
      icon: FaCarCrash,
      color: "text-red-500",
      // *** UPDATED Section 9 Content ***
      content: `**Матрица Обновилась (Free Tier):** Юзаем "Щит Веры" (::FaTriangleExclamation::), ищем **эксплойты** (опенсорс), **быстро учимся делать золото**, чтобы платить "десятину" Матрице. **Экспоненциальный рост может потребовать платных ресурсов быстрее**.
      **Перегрев Процессора (${userName}):** AI (::FaAtom::) – твой **аватар**. "Орден" (::FaComments::) – твой **круг силы**. **Управлять экспонентой сложнее, чем линейным ростом**. Делай то, что **прет** (SelfDev!). Помни: **"Нет ложки!"** ::FaEye:: Сила в **балансе и делегировании AI**!
      **Красная Таблетка Оказалась Витаминкой (Идея – Г):** **AI-Оракул** (::FaBullseye::) **ПРЕДСКАЖЕТ ДО СТАРТА!** Мочим дохлых гиппогрифов быстро. VIBE = **Мгновенная Телепортация** на новую идею. **Неудачная экспонента = быстрый провал, быстрый рестарт**.
      **System Failure (<::FaCarCrash className="inline text-red-500"::>):** Жизнь – багованная игра. Твои **нейро-апгрейды** VIBE/AI/SelfDev – твой **"сейв"**. Сможешь **загрузиться** в новом мире. **Опыт управления быстрым ростом бесценен**. `
    },
    { // Section 10: Epic Finale Style
      id: "conclusion",
      title: `10. ${userName}, Ты Избранный! Жми на Газ Экспоненты!`, // Updated title
      icon: FaBrain,
      color: "text-brand-purple",
      // *** UPDATED Section 10 Content ***
      content: `**"Кибер-Волк ${userName}"** – это **твой манифест**. **ТВОЙ ВЫБОР**. Шанс **стать Архитектором своей реальности... и её экспоненциального расширения**. Используй **мозг** (::FaBrain::), **шрамы** (::FaSignature::), **братство** (::FaUsers::) и **космическую силу AI** (::FaAtom::). Стартовый буст – **лишь первый разряд** ::FaBolt className="inline text-yellow-400"::, **искра для детонации цепной реакции**. Дальше – твой **VIBE**, твоя **воля**, твой **прыжок в неизвестность**, где **один становится легионом** ::FaUsers className="inline text-purple-400 animate-ping"::!
      **ХВАТИТ БЫТЬ ПЕШКОЙ В ЛИНЕЙНОЙ ИГРЕ. ВРЕМЯ ЗАПУСКАТЬ СВОЮ ЭКСПОНЕНТУ!** ::FaRocket className="inline text-brand-green"::`
    },
  ];
};

// --- Функция для стилей секций (УСИЛЕННАЯ ГРАДАЦИЯ) ---
const getSectionStyles = (index: number): string => {
    const totalSections = 10;
    const progress = (index + 1) / totalSections;
    // Base styles + Increased contrast and effects for later stages
    const base = "group border-l-8 pl-4 py-4 rounded-r-lg transition-all duration-700 ease-out open:shadow-xl "; // Толще граница, медленнее переход, больше тень

    // Определяем цвета для градиентов и свечения по прогрессу
    let bgColor = "bg-gray-800/50 open:bg-gray-700/60";
    let borderColor = "border-blue-500/70"; // Начальный цвет границы
    let shadowColor = "open:shadow-blue-500/20"; // Тень при открытии
    let hoverBorderColor = "hover:border-blue-400";
    let openBorderColor = "open:border-blue-400";

    if (progress <= 0.2) { // Sections 1-2: Win95/DOS - Чуть живее
        bgColor = "bg-gray-700/40 open:bg-gray-600/50"; // Светлее
        borderColor = "border-blue-500/60";
        shadowColor = "open:shadow-md open:shadow-blue-500/20";
        hoverBorderColor = "hover:border-blue-400";
        openBorderColor = "open:border-blue-400";
        return cn(base, bgColor, borderColor, shadowColor, hoverBorderColor, openBorderColor, "rounded-md"); // Меньше скругление
    } else if (progress <= 0.5) { // Sections 3-5: Early Cyber - Темнее, неон, заметнее
        bgColor = "bg-dark-card/70 open:bg-dark-card/90"; // Темнее
        borderColor = "border-brand-pink/70"; // Ярче
        shadowColor = "open:shadow-lg open:shadow-brand-pink/40"; // Заметнее тень
        hoverBorderColor = "hover:border-brand-pink";
        openBorderColor = "open:border-brand-pink";
        return cn(base, bgColor, borderColor, shadowColor, hoverBorderColor, openBorderColor, "rounded-lg"); // Среднее скругление
    } else if (progress <= 0.8) { // Sections 6-8: Mid-Cyberpunk - Блюр, фиолет, сильное свечение
        bgColor = "bg-black/75 backdrop-blur-sm open:bg-black/90"; // Черный с блюром
        borderColor = "border-brand-purple/80"; // Насыщеннее
        shadowColor = "open:shadow-[0_0_25px_rgba(157,0,255,0.6)]"; // Сильное свечение
        hoverBorderColor = "hover:border-brand-purple/100";
        openBorderColor = "open:border-brand-purple/100";
        return cn(base, bgColor, borderColor, shadowColor, hoverBorderColor, openBorderColor, "rounded-xl"); // Больше скругление
    } else { // Sections 9-10: Peak VIBE - Макс киберпанк
        bgColor = "bg-black/90 backdrop-blur-lg open:bg-black/95"; // Глубокий черный, сильный блюр
        borderColor = "border-neon-lime"; // Ярчайший неон
        shadowColor = "open:shadow-[0_0_45px_rgba(174,255,0,0.9)]"; // Макс свечение
        hoverBorderColor = "hover:border-neon-lime/80"; // Может чуть приглушить при ховере для контраста
        openBorderColor = "open:border-neon-lime";
        return cn(base, bgColor, borderColor, shadowColor, hoverBorderColor, openBorderColor, "rounded-2xl"); // Макс скругление
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
  const initialBoost = 0;
  const initialBoostStr = useMemo(() => `${initialBoost.toLocaleString('ru-RU')} руб.`, [initialBoost]);

  // Лоадер и ошибка
  if (!isMounted || isLoading) { return ( <div className="flex justify-center items-center min-h-screen pt-20 bg-gradient-to-br from-gray-900 via-black to-gray-800"> <p className="text-brand-cyan animate-pulse text-xl font-mono">Загрузка Гримуара Кибер-Алхимика...</p> </div> ); }
  if (error) { return ( <div className="flex flex-col justify-center items-center min-h-screen pt-20 bg-gradient-to-br from-gray-900 via-black to-red-900/50"> <FaTriangleExclamation className="text-6xl text-red-500 mb-4"/> <p className="text-red-400 text-xl font-mono">Ошибка загрузки плана</p> <p className="text-red-500 mt-2 text-sm max-w-md text-center">{error.message}</p> <p className="text-gray-400 mt-4 text-xs">Матрица глючит. Перезагрузись.</p> </div> ); }

  return (
    <div className="relative min-h-screen overflow-hidden pt-20 pb-10 bg-gradient-to-br from-dark-bg via-black to-purple-900/30 text-light-text">
       <div className="absolute inset-0 bg-repeat opacity-[0.04] z-0 bg-grid-pattern"></div>
      <TooltipProvider delayDuration={150}>
        <div className="relative z-10 container mx-auto px-4">
          {/* --- Карточка теперь использует стили пикового киберпанка --- */}
          <Card className="max-w-4xl mx-auto bg-black/85 backdrop-blur-md text-light-text rounded-2xl border-2 border-neon-lime/70 shadow-[0_0_40px_rgba(174,255,0,0.7)]">
            {/* Заголовок */}
            <CardHeader className="text-center border-b border-brand-purple/30 pb-5 pt-8"> {/* Фиолетовая граница для контраста */}
              <FaFlaskVial className="text-6xl text-brand-purple mx-auto mb-4 animate-pulse" />
              <CardTitle className="text-3xl md:text-5xl font-bold text-brand-purple cyber-text glitch uppercase tracking-wider" data-text={`КИБЕР-АЛХИМИЯ ${pageTitleName.toUpperCase()}`}>
                 КИБЕР-АЛХИМИЯ {pageTitleName.toUpperCase()}
              </CardTitle>
              {/* Подзаголовок */}
              <div className="text-md md:text-lg text-gray-300 mt-4 font-mono max-w-2xl mx-auto">
                 <RenderContent content={`Твой Рецепт: От **${greetingName === 'Pihman' ? 'Свинцового Кардана' : 'Нуля'}** ::FaCarCrash className="inline text-red-500":: к **Золотому VIBE** ::FaMoneyBillWave className="inline text-yellow-400"::. Стартовый Буст ${initialBoostStr} Энергии. (Личный Гримуар для ${greetingName})`} />
              </div>
            </CardHeader>
            {/* Секции Плана */}
            <CardContent className="space-y-4 p-4 md:p-6"> {/* Уменьшил еще немного space-y */}
              {planSections.map((section, index) => {
                 const sectionStyles = getSectionStyles(index); // Получаем стили для секции

                 return (
                   // --- Обертка для Details с градиентным фоном для поздних стадий ---
                    <div key={section.id} className={cn(
                        sectionStyles, // Основные стили секции
                        index >= 8 && "bg-gradient-to-r from-gray-900 via-purple-900/30 to-neon-lime/10", // Градиент для последних секций
                        index >= 6 && "p-1" // Небольшой внутренний отступ для градиента на средних/поздних
                    )}>
                       <details className={cn(
                           // Убрали фон и скругление отсюда, они теперь на обертке
                           "open:bg-transparent" // Убираем фон при открытии, т.к. он на обертке
                        )} open={index < 2 || section.id === 'finance'}> {/* Первые 2 и финансы */}
                         <summary className={cn(
                             "text-xl md:text-2xl font-semibold cursor-pointer list-none flex items-center hover:opacity-80 transition-opacity py-2",
                             section.color,
                             index >= 6 && "px-3 py-3 bg-black/30 rounded-t-lg" // Доп стиль для summary на поздних стадиях
                         )}>
                           {section.icon && <section.icon className="mr-3 flex-shrink-0 w-6 h-6 group-open:animate-pulse" />}
                           {section.title}
                         </summary>
                         <div className={cn(
                             "mt-3 text-gray-300 text-base leading-relaxed space-y-3 pb-2",
                             index >= 6 ? "px-3" : "pl-6 pr-2" // Разные отступы
                          )}>
                           <RenderContent content={section.content} />
                           {/* Визуализации */}
                           {section.id === 'finance' && ( <div className="mt-4 p-3 border border-dashed border-gray-600 rounded-md bg-gray-800/40"> <p className="text-sm text-gray-400 italic text-center">[Диаграмма Потоков Энергии: ТЫ (Искра) → Запуск L1→L2 (+2) → Охота/Апгрейд (Подпитка Роста) → Щит]</p> </div> )}
                           {section.id === 'marketing' && ( <div className="mt-4 p-3 border border-dashed border-gray-600 rounded-md bg-gray-800/40"> <p className="text-sm text-gray-400 italic text-center">[Кибер-Воронка: Сигнал → Зов → Стая → Золото]</p> </div> )}
                         </div>
                       </details>
                    </div>
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
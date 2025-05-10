"use client";

// --- Полные Импорты ---
import React, { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAppContext } from "@/contexts/AppContext";
import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from "@/components/ui/tooltip"; // Kept from V1

// --- Иконки из fa6: Используем проверенный и исправленный список из V1 ---
// Включая FaChartLine, FaPoo для экспоненциальной темы, убирая FaVideo
import {
  FaFileLines, FaBullseye, FaUsers, FaBoxOpen, FaChartLine, FaAtom,
  FaMobile, FaComments, FaPaintbrush, FaBrain, FaRocket, FaUserNinja,
  FaMoneyBillWave, FaTriangleExclamation, FaUserAstronaut, FaSignature,
  FaRecycle, FaCode, FaNewspaper, FaGithub, FaTelegram, FaCarBurst,
  FaRobot, FaGift, FaHandshake, FaBomb, FaFlaskVial, FaInfinity, FaDumbbell,
  FaEye, FaHatWizard, FaPoo, FaKey, FaBolt, FaScroll,
  FaHandPointer, FaUserSecret, FaGamepad
} from "react-icons/fa6";

import { debugLogger } from "@/lib/debugLogger";
import Link from "next/link";
import { cn } from "@/lib/utils";
import type { Database } from "@/types/database.types";
import VibeContentRenderer from "@/components/VibeContentRenderer"; // Import the renderer

// --- Типы ---
type DbUser = Database["public"]["Tables"]["users"]["Row"] | null;

// --- Карта Компонентов Иконок (Соответствует импортам V1) ---
// (Map remains the same, ensure VibeContentRenderer is up-to-date if icons change)
const iconComponents: { [key: string]: React.ElementType } = {
  FaFileLines, FaBullseye, FaUsers, FaBoxOpen, FaChartLine, FaAtom, FaFlaskVial,
  FaMobile, FaComments, FaPaintbrush, FaBrain, FaRocket, FaUserNinja, FaInfinity, FaDumbbell,
  FaMoneyBillWave, FaTriangleExclamation, FaUserAstronaut, FaSignature, FaEye,
  FaRecycle, FaCode, FaNewspaper, FaGithub, FaTelegram, FaCarBurst,
  FaRobot, FaGift, FaHandshake, FaBomb, FaHatWizard, FaPoo, FaKey, FaBolt, FaScroll,
  FaHandPointer, FaUserSecret, FaGamepad
};

// --- Функция генерации секций (getPlanSections) ---
const getPlanSections = (dbUser: DbUser) => {
  const userName = dbUser?.first_name || 'Неофит';
  const isSanek = dbUser?.user_id?.toString() === '1260304309' || dbUser?.username === 'Pihman';
  const userHandle = isSanek ? '@Pihman_Reborn69' : (dbUser?.username ? `@${dbUser.username}` : 'Твой_Кибер_Сигил');
  const userOriginStory = isSanek
     ? "в гравитационном колодце разбитых карданов ::FaCarBurst className=\"inline text-red-500\"::" // Use double quotes
     : "в поисках апгрейда серой реальности";

  return [
     {
      id: "resume",
      title: `1. Протокол "Исход": ${userName}, Взламываем Матрицу!`,
      icon: FaBomb, // This is for the section header, not VibeContentRenderer
      color: "text-blue-400",
      content: `Проект **"Кибер-Волк ${userName}"** – это не сраный PDF. Это **чит-код** ::FaKey className="inline text-blue-400":: к твоей новой жизни! Твой JUMPSTART ::FaRocket className="inline text-blue-400"::, чтобы ты (${userHandle}) **выбил дверь с ноги** из ${userOriginStory} и начал **писать СВОЙ код реальности**. Управлять? **Телефоном, сука!** ::FaMobile className="inline text-blue-400"::!
      **VIBE – Твой Новый BIOS:** Скорость (::FaRocket::) + **AI как Нейроусилитель** (::FaAtom className="inline text-purple-400"::, Gemini 2.5 Pro – халявный IQ-буст!) + Кибер-Броня (::FaUserNinja className="inline text-gray-500"::). И **SelfDev** – ты **перепрошиваешь себя**, как киборга. **Ключевое Открытие:** Мы тут не +1 раба в год нанимаем. Это **"Один Клик → Экспонента!"** ::FaChartLine className="inline text-yellow-500 animate-pulse"::. Маленькое изменение в первом апгрейде L1→L2 (обучить **двух** вместо одного) запускает **ВЗРЫВНОЙ РОСТ** ::FaBolt::, удваивая команду почти каждый цикл! Это не линейный набор, это **самовоспроизводящийся VIBE-вирус**!
      **Ресурсы:** Юзаем **халяву** – Vercel, GitHub (::FaGithub::), Telegram (::FaTelegram className="inline text-blue-400"::). **Платные фичи – для Агентов Смитов**.
      **Стартовый Буст – Твой Первый "Прыжок Веры":** Это не подачка. Это **топливо для твоего "Навуходоносора"**. На что (приоритеты):
      - **ТВОЕ ВРЕМЯ для "Прокачки в Додзе"** (Основная часть): **Забей на галеры**. Погружайся в VIBE, генери контент с AI, **учись видеть Матрицу**. Это твоя **"качалка" для мозга** ::FaDumbbell::. Я – твой **Морфеус/тренер** ::FaHandPointer className="inline text-blue-400"::, ловлю глюки AI, пока ты **уклоняешься от пуль**.
      - **Охота на "Донни"** (Значительная часть): Найти первых **клиентов-последователей** ::FaUserSecret className="inline text-pink-400"::, кто **заплатит за твою "ручку"** (методологию VIBE). Помогать им **умножать кэш** с AI – это наш **"почти легальный" бизнес**! ::FaMoneyBillWave className="inline text-pink-400"::.
      - **Апгрейд Твоей "Нейросети"** (Меньшая часть): Доступ к **продвинутым AI-заклинаниям**, курсы по "взлому" маркетинга. Стань **магистром VIBE**.
      - **"Аварийный Выход"** (Резерв): На случай ::FaCarBurst:: или если AI взбунтуется.
      **Цель:** Построить **не сайт, а ЛИЧНЫЙ ГЕНЕРАТОР СВОБОДЫ И БАБОК**, работающий на **VIBE, дерзости и экспоненциальном росте**.`
    },
    {
      id: "description",
      title: "2. Твой Кибер-Арсенал: Интерфейс к Силе",
      icon: FaUserAstronaut,
      color: "text-brand-cyan",
      content: `**Командный Мостик:** Телефон ::FaMobile className="inline text-cyan-400":: + Ноут (опц).
      **1. Личный Голодек (Сайт/Блог, 0 руб):** Твоя легенда. Путь из ${userOriginStory}. VIBE-мануалы, кейсы "искривления реальности". **Обновляется сам** (GitHub ::FaGithub:: + TG-бот ::FaTelegram::). Здесь ты **сеешь зерна экспоненты**.
      **2. Твой Зион (TG-Канал/Чат ::FaTelegram className="inline text-blue-400"::):** Собирай **экипаж "Навуходоносора"** ::FaUsers::. Делись альфа-инфой, руби правду-матку, создавай **сопротивление**. Координируй **лавину новичков**.
      **3. Библиотека Заклинаний (GitHub ::FaGithub::):** Твой "Кибер-Сундук". Готовые артефакты (Jumpstart Kit ::FaBoxOpen::!), VIBE-автоматизация. **Тут ты - Архимаг**. Ключ к **масштабированию магии**.
      **4. AI-Репликатор (::FaAtom className="inline text-purple-400":: + ::FaRecycle className="inline text-yellow-400"::):** Твой **личный Джарвис**. Мысль → текст, видео, арт, код. **Идея → Воплощение.** Экономит 99% энергии ::FaBolt::. Движок, **питающий твой рост**.
      **УТП (Твой Уникальный "Глюк в Матрице"):** Ты – **${userName} (${userHandle})**, **выбравшийся** из ${userOriginStory}. Ты юзаешь **подпольный AI** ::FaRobot:: и **взламываешь законы роста**. Ты **не Агент Смит**. Ты **даешь красную таблетку, а не синюю**.`
    },
    {
      id: "market",
      title: "3. Охотничьи Угодья: Ищем Тех, Кто Готов Проснуться",
      icon: FaUsers,
      color: "text-brand-pink",
      content: `Рынок РФ? Дикий кибер-запад! Старые правила **сломаны**. AI – это **универсальный отмычка** ::FaKey className="inline text-pink-400"::.
      **Твоя Цель (ЦА):** Застрявшие в Матрице. Как ты вчера, ${userName}. Разрабы со **старым софтом в голове**. Фрилансеры, **гриндившие репутацию**. Малый бизнес, кто **хочет AI-апгрейд за еду**. Все, кто ищет **Ctrl+Alt+Del** для ${userOriginStory}. **И особенно те, кто чувствует, что линейный рост - это тупик.**
      **Агенты Смиты (Конкуренты):** Продавцы воздуха, теоретики без практики, инфоцыгане. **Те, кто продает старые карты.**
      **Твой Код Неуязвимости (Отстройка):**
      - **Ты (${userName}):** Твоя история ::FaSignature:: – **неотразимый сигнал**.
      - **VIBE:** Скорость Нео (::FaRocket::) + Магия AI (::FaAtom::) + Броня Старка (::FaUserNinja::). Мы **пишем будущее**.
      - **SelfDev:** Качаем **мозг** ::FaBrain:: и **волю** ::FaUserNinja::. Помогаем **стать Избранным**. Узнай как через <a href="/selfdev/gamified" class="text-brand-yellow hover:underline font-semibold">Геймификацию SelfDev ::FaGamepad::</a>!
      - **AI-Алхимия (::FaAtom::):** Наш **вечный двигатель** контента ::FaInfinity::.
      - **"Красная Таблетка для Всех":** Просто, доступно, **без пафоса**. **И с перспективой экспоненты.**`
    },
     {
      id: "product",
      title: "4. Твои Артефакты: Прошивки для Мозга",
      icon: FaGift,
      color: "text-brand-orange",
      content: `Принцип "Сначала Демо-Версия": Дай пощупать силу ::FaGift className="inline text-orange-400"::, потом продавай лицензию на "Кунг-Фу".
      **Бесплатные Чипы (Вербовка в Сопротивление и Запуск Роста L1):**
      - **Контент (::FaNewspaper::):** "Дневник Нео" – твой путь, VIBE-инсайты. AI (::FaAtom::) – твой **Оракул**.
      - **Код (::FaCode::):** Jumpstart Kit (::FaBoxOpen::) – **установка "Кунг-Фу"**. AI-боты на GitHub (::FaGithub::). **Покажи, как легко начать.**
      - **Концентрат Мудрости (::FaBrain::):** Саммари "запретных текстов" (<a href="/purpose-profit" class="text-brand-purple hover:underline font-semibold">Purpose&Profit</a>) – **для своих**.
      **Платные Прошивки (Когда ты – Архитектор ::FaHatWizard:: и Мастер Экспоненты):**
      - **"Дефрагментация Разума" с ${userName}:** Личный VIBE-тюнинг + AI-интеграция (Цену определяешь сам!).
      - **Тренинг "Анти-Матрица с AI":** Учим **уклоняться от пуль** (проблем) с AI (Формат и цену решаешь сам!).
      - **Jumpstart Kit "Избранный":** Заряженные кибер-шаблоны (Цену ставишь сам!).
      - **(VIP) Внутренний Круг Зиона:** Закрытый чат, тайные техники **управления экспонентой** (По подписке?).`
    },
    {
      id: "marketing",
      title: "5. Неоновые Сигналы: Призыв Пробужденных",
      icon: FaBullseye,
      color: "text-neon-lime",
      content: `- ::FaPaintbrush className="inline text-neon-lime":: **Контент - Твой Сигнал:** Делай то, что **вибрирует**! Делись процессом. AI (::FaAtom className="inline text-purple-400"::) – твоя **нейро-фабрика** (текст, видео, арт). **ПРАВДА. ПОЛЬЗА. VIBE.** (TG, VK, YouTube?).
      - ::FaComments className="inline text-neon-lime":: **Создай Свой "Зион" (::FaTelegram className="inline text-blue-400"::):** Твой чат – **последний оплот свободы**. **Общайся! Помогай! Вдохновляй!** Лояльность > охватов. **Готовь инфраструктуру к росту.**
      - ::FaGithub className="inline text-neon-lime":: **GitHub - Голодек для Гиков:** Код как искусство. **Инструменты для экспоненты.**
      - **Альянсы (::FaHandshake::):** Объединяйся с другими **хакерами реальности**. **Вместе рост еще быстрее.**
      **Топливо для Сигнала (Стартовый Буст ~X% бюджета):**
      - **Таргет:** Найти тех, кто **уже ищет красную таблетку и готов к нелинейному пути**.
      - **Посевы:** Распространяй **VIBE-вирус экспоненциального роста** по сети.
      - **Эксперименты:** Пробуй **новые частоты** (форматы)!

      [Кибер-Воронка: Сигнал (Контент/AI) → Зов (Таргет) → Зион (TG) → Просветление L1 (Jumpstart) → Трансмутация L2 (Запуск +2 L1) → Экспонента (Продажи/Масштаб)]`
    },
     {
      id: "operations",
      title: "6. Твоя Кибер-Лаборатория: Телефон и Сила Мысли",
      icon: FaMobile,
      color: "text-brand-cyan",
      content: `**Пульт Управления (::FaMobile className="inline text-cyan-400":: + ::FaAtom::):** ТЕЛЕФОН! Снял → смонтировал → AI (::FaAtom::) всё остальное. Сказал → AI сделал. **Автоматизируй Матрицу!**
      **Твой Сервер (0 руб):** Сайт на Next.js/Vercel. Управление – GitHub/TG-бот (::FaGithub::). База знаний? Supabase (0 руб). **Инфраструктура готова к взрывному росту.**
      **Нейролинк:** Telegram/VK (::FaTelegram className="inline text-blue-400"::) для всего! **Канал управления лавиной.**
      **Мантра Морфеуса:** **"Ты думаешь, это воздух?!"** ::FaEye className="inline text-cyan-400":: Скорость ограничена лишь твоей **верой и скиллом управления AI**. Ты **пишешь правила**, а не следуешь им. **Правила экспоненциального роста.**`
    },
    {
      id: "org",
      title: "7. Структура Силы: Ты – Ядро Экспоненты",
      icon: FaUserNinja,
      color: "text-gray-400",
      content: `**Статус:** Самозанятый Кибер-Алхимик (НПД).
      **Ты (${userName}, ${userHandle}):** ::FaUserAstronaut className="inline text-gray-300":: Ты – **Альфа и Омега**. **ЗАБУДЬ ПРО ОФИСНЫЙ ПЛАНКТОН И ЛИНЕЙНЫЙ НАБОР!** ::FaPoo className="inline text-red-600":: Твоя команда – **ТЫ, УСИЛЕННЫЙ AI-ЛЕГИОНОМ ::FaRobot::**. Но главный трюк – в **механике роста**. Помнишь **"Один Клик → Экспонента"** ::FaChartLine::? Обычный рост: +1 сотрудник = +1 единица работы. VIBE-рост: +1 "пробужденный" L1, докачавшийся до L2, **ЗАПУСКАЕТ ВОЛНУ ИЗ ДВУХ НОВЫХ L1** ::FaUsers className="inline text-gray-300"::! Это **цепная реакция** ::FaBolt::, а не сложение.
      **Заметка для Нулевых (L1):** Каждый раз, когда один из вас апается на L2, вы **удваиваете армию таких же как вы** на старте (L1)! Это значит, что общее число "picture updaters" (и всей команды) растет не +1, +1, +1, а как **2 в степени (время+1) минус 1** (по формуле \`2**(t+1) - 1\`). Грубо говоря, **почти удваивается каждый цикл**! ::FaChartLine className="inline text-yellow-400"::. Готовьтесь к лавине новичков!
      Твоя задача – **качать "бицуху" мозга** ::FaDumbbell::, быть **дирижером AI-оркестра** и **нажимать ту самую "кнопку" L1→L2**, запуская **экспоненциальный каскад**. <a href="/selfdev" class="text-brand-green hover:underline font-semibold">CyberVibe (SelfDev)</a> – твоя **персональная "качалка" и центр управления ростом**. Я – твой **тренер/спарринг-партнер**, ловлю баги AI и слежу, чтобы **экспонента не схлопнулась**. `
    },
    {
      id: "finance",
      title: `8. Философский Камень: Топливо для Экспоненты`,
      icon: FaMoneyBillWave,
      color: "text-brand-yellow",
      content: `Стартовый капитал – это **искра**, чтобы зажечь твой **внутренний огонь** и **запустить первый цикл экспоненциального роста**. Приоритеты:
      - **::FaUserAstronaut className="inline text-yellow-400":: 1. ТВОЕ ВРЕМЯ НА ТРАНСМУТАЦИЮ (Приоритет #1):** Чтобы ты (${userName}) **вырвался из Матрицы** и мог **творить**: контент ::FaPaintbrush::, VIBE/AI ::FaBrain::, Орден ::FaUsers::. Это **инвестиция в твой ЛИЧНЫЙ Философский Камень** и **первый шаг к удвоению**!
      - **::FaBullseye className="inline text-yellow-400":: 2. ОХОТА НА "ЗОЛОТЫЕ ДУШИ" (Приоритет #2):** Найти **первых**, кто **заплатит за твою магию**. **Быстрые деньги = топливо для веры и следующего цикла роста**.
      - **::FaBrain className="inline text-yellow-400":: 3. АПГРЕЙД ТВОЕЙ СИЛЫ (Приоритет #3):** Доступ к **мощнейшим AI-гримуарам** ::FaScroll::, секреты "нейро-маркетинга". Стань **Верховным Магом VIBE**, способным **управлять лавиной**.
      - **::FaTriangleExclamation className="inline text-yellow-400":: 4. "ЩИТ ВЕРЫ" (Резерв):** На случай **критического сбоя** ::FaBomb:: или если AI потребует дань. **Экспонента требует страховки**.
      **Цель по Золоту:** Стабильный **денежный поток**, достаточный для **свободы и поддержания роста**. Буст **снимает страх** и **дает первый импульс**.

      [Диаграмма Потоков Энергии: ТЫ (Искра) → Запуск L1→L2 (+2) → Охота/Апгрейд (Подпитка Роста) → Щит]`
    },
     {
      id: "risks",
      title: "9. Глюки в Матрице (Риски и План \"Омега\")",
      icon: FaCarBurst,
      color: "text-red-500",
      content: `**Матрица Обновилась (Free Tier):** Юзаем "Щит Веры" (::FaTriangleExclamation::), ищем **эксплойты** (опенсорс), **быстро учимся делать золото**, чтобы платить "десятину" Матрице. **Экспоненциальный рост может потребовать платных ресурсов быстрее**.
      **Перегрев Процессора (${userName}):** AI (::FaAtom::) – твой **аватар**. "Орден" (::FaComments::) – твой **круг силы**. **Управлять экспонентой сложнее, чем линейным ростом**. Делай то, что **прет** (<a href="/selfdev" class="text-brand-green hover:underline font-semibold">SelfDev</a>!). Помни: **"Нет ложки!"** ::FaEye:: Сила в **балансе и делегировании AI**!
      **Красная Таблетка Оказалась Витаминкой (Идея – Г):** **AI-Оракул** (::FaBullseye::) **ПРЕДСКАЖЕТ ДО СТАРТА!** Мочим дохлых гиппогрифов быстро. VIBE = **Мгновенная Телепортация** на новую идею. **Неудачная экспонента = быстрый провал, быстрый рестарт**.
      **System Failure (::FaCarBurst className="inline text-red-500"::):** Жизнь – багованная игра. Твои **нейро-апгрейды** VIBE/AI/SelfDev – твой **"сейв"**. Сможешь **загрузиться** в новом мире. **Опыт управления быстрым ростом бесценен**. `
    },
    {
      id: "conclusion",
      title: `10. ${userName}, Ты Избранный! Жми на Газ Экспоненты!`,
      icon: FaBrain,
      color: "text-brand-purple",
      content: `**"Кибер-Волк ${userName}"** – это **твой манифест**. **ТВОЙ ВЫБОР**. Шанс **стать Архитектором своей реальности... и её экспоненциального расширения**. Используй **мозг** (::FaBrain::), **шрамы** (::FaSignature::), **братство** (::FaUsers::) и **космическую силу AI** (::FaAtom::). Стартовый буст – **лишь первый разряд** ::FaBolt className="inline text-yellow-400"::, **искра для детонации цепной реакции**. Дальше – твой **VIBE**, твоя **воля**, твой **прыжок в неизвестность**, где **один становится легионом** ::FaUsers className="inline text-purple-400 animate-ping"::!
      **ХВАТИТ БЫТЬ ПЕШКОЙ В ЛИНЕЙНОЙ ИГРЕ. ВРЕМЯ ЗАПУСКАТЬ СВОЮ ЭКСПОНЕНТУ!** ::FaRocket className="inline text-brand-green"::`
    },
  ];
};

// --- Функция для стилей секций (УСИЛЕННАЯ ГРАДАЦИЯ из V1/V2) ---
const getSectionStyles = (index: number): string => {
    const totalSections = 10;
    const progress = (index + 1) / totalSections;
    const base = "group border-l-8 pl-4 py-4 rounded-r-lg transition-all duration-700 ease-out open:shadow-xl ";

    let bgColor = "bg-gray-800/50 open:bg-gray-700/60";
    let borderColor = "border-blue-500/70";
    let shadowColor = "open:shadow-blue-500/20";
    let hoverBorderColor = "hover:border-blue-400";
    let openBorderColor = "open:border-blue-400";

    if (progress <= 0.2) {
        bgColor = "bg-gray-700/40 open:bg-gray-600/50";
        borderColor = "border-blue-500/60";
        shadowColor = "open:shadow-md open:shadow-blue-500/20";
        hoverBorderColor = "hover:border-blue-400";
        openBorderColor = "open:border-blue-400";
        return cn(base, bgColor, borderColor, shadowColor, hoverBorderColor, openBorderColor, "rounded-md");
    } else if (progress <= 0.5) {
        bgColor = "bg-dark-card/70 open:bg-dark-card/90";
        borderColor = "border-brand-pink/70";
        shadowColor = "open:shadow-lg open:shadow-brand-pink/40";
        hoverBorderColor = "hover:border-brand-pink";
        openBorderColor = "open:border-brand-pink";
        return cn(base, bgColor, borderColor, shadowColor, hoverBorderColor, openBorderColor, "rounded-lg");
    } else if (progress <= 0.8) {
        bgColor = "bg-black/75 backdrop-blur-sm open:bg-black/90";
        borderColor = "border-brand-purple/80";
        shadowColor = "open:shadow-[0_0_25px_rgba(157,0,255,0.6)]";
        hoverBorderColor = "hover:border-brand-purple/100";
        openBorderColor = "open:border-brand-purple/100";
        return cn(base, bgColor, borderColor, shadowColor, hoverBorderColor, openBorderColor, "rounded-xl");
    } else {
        bgColor = "bg-black/90 backdrop-blur-lg open:bg-black/95";
        borderColor = "border-neon-lime";
        shadowColor = "open:shadow-[0_0_45px_rgba(174,255,0,0.9)]";
        hoverBorderColor = "hover:border-neon-lime/80";
        openBorderColor = "open:border-neon-lime";
        return cn(base, bgColor, borderColor, shadowColor, hoverBorderColor, openBorderColor, "rounded-2xl");
    }
};

// --- Компонент Страницы (Структура из V1) ---
export default function PPlanPage() {
  const { dbUser, isLoading, error } = useAppContext();
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => { setIsMounted(true); }, []);

  const planSections = useMemo(() => getPlanSections(dbUser), [dbUser]);
  const pageTitleName = useMemo(() => dbUser?.first_name || "Кибер-Волк", [dbUser]);
  const greetingName = useMemo(() => (dbUser?.user_id?.toString() === '1260304309' || dbUser?.username === 'Pihman') ? 'Pihman' : 'Неофит', [dbUser]);

  const initialBoost = 0;
  const initialBoostStr = useMemo(() => `${initialBoost.toLocaleString('ru-RU')} руб.`, [initialBoost]);

  if (!isMounted || isLoading) { return ( <div className="flex justify-center items-center min-h-screen pt-20 bg-gradient-to-br from-gray-900 via-black to-gray-800"> <p className="text-brand-cyan animate-pulse text-xl font-mono">Загрузка Гримуара Кибер-Алхимика...</p> </div> ); }
  if (error) { return ( <div className="flex flex-col justify-center items-center min-h-screen pt-20 bg-gradient-to-br from-gray-900 via-black to-red-900/50"> <FaTriangleExclamation className="text-6xl text-red-500 mb-4"/> <p className="text-red-400 text-xl font-mono">Ошибка загрузки плана</p> <p className="text-red-500 mt-2 text-sm max-w-md text-center">{error ? error.message : 'Unknown error'}</p> <p className="text-gray-400 mt-4 text-xs">Матрица глючит. Перезагрузись.</p> </div> ); }

  const conclusionText1 = `Это **карта**, ${greetingName}, а не территория. **Путь осилит идущий**. Начинай **трансмутацию**! VIBE!`;
  const conclusionText2 = `Нужна помощь в ритуале? Заблудился в формулах? <span class="text-neon-lime font-bold">ПИШИ МНЕ</span> в <a href="https://t.me/salavey13" target="_blank" rel="noopener noreferrer" class="text-brand-blue hover:underline font-semibold inline-flex items-center">Телегу ::FaTelegram::</a> или используй форму на <a href="/jumpstart#jumpstart-form" class="text-neon-lime hover:underline font-semibold inline-flex items-center">Jumpstart ::FaRocket::</a>.`;


  return (
    <div className="relative min-h-screen overflow-hidden pt-20 pb-10 bg-gradient-to-br from-dark-bg via-black to-purple-900/30 text-light-text">
       <div className="absolute inset-0 bg-repeat opacity-[0.04] z-0 bg-grid-pattern"></div>
       <TooltipProvider delayDuration={150}>
        <div className="relative z-10 container mx-auto px-4">
          <Card className="max-w-4xl mx-auto bg-black/85 backdrop-blur-md text-light-text rounded-2xl border-2 border-neon-lime/70 shadow-[0_0_40px_rgba(174,255,0,0.7)]">
            <CardHeader className="text-center border-b border-brand-purple/30 pb-5 pt-8">
              <FaFlaskVial className="text-6xl text-brand-purple mx-auto mb-4 animate-pulse" />
              <CardTitle className="text-3xl md:text-5xl font-bold text-brand-purple cyber-text glitch uppercase tracking-wider" data-text={`КИБЕР-АЛХИМИЯ ${pageTitleName.toUpperCase()}`}>
                 КИБЕР-АЛХИМИЯ {pageTitleName.toUpperCase()}
              </CardTitle>
              <div className="text-md md:text-lg text-gray-300 mt-4 font-mono max-w-2xl mx-auto">
                 <VibeContentRenderer content={`Твой Рецепт: От **${greetingName === 'Pihman' ? 'Свинцового Кардана' : 'Нуля'}** ::FaCarBurst className="inline text-red-500":: к **Золотому VIBE** ::FaMoneyBillWave className="inline text-yellow-400"::. Стартовый Буст ${initialBoostStr} Энергии. (Личный Гримуар для ${greetingName})`} />
              </div>
            </CardHeader>
            <CardContent className="space-y-4 p-4 md:p-6">
              {planSections.map((section, index) => {
                 const sectionStyles = getSectionStyles(index);
                 const IconComp = section.icon; // Icon name is already a component from iconComponents map

                 return (
                    <div key={section.id} className={cn(
                        sectionStyles,
                        index >= 8 && "bg-gradient-to-r from-gray-900 via-purple-900/30 to-neon-lime/10",
                        index >= 6 && "p-1"
                    )}>
                       <details className={cn(
                           "open:bg-transparent"
                        )} open={index < 2 || section.id === 'finance'}>
                         <summary className={cn(
                             "text-xl md:text-2xl font-semibold cursor-pointer list-none flex items-center hover:opacity-80 transition-opacity py-2",
                             section.color,
                             index >= 6 && "px-3 py-3 bg-black/30 rounded-t-lg"
                         )}>
                           {IconComp && <IconComp className="mr-3 flex-shrink-0 w-6 h-6 group-open:animate-pulse" />}
                           {section.title}
                         </summary>
                         <div className={cn(
                             "mt-3 text-gray-300 text-base leading-relaxed space-y-3 pb-2",
                             index >= 6 ? "px-3" : "pl-6 pr-2"
                          )}>
                           <VibeContentRenderer content={section.content} />
                           {section.id === 'finance' && ( <div className="mt-4 p-3 border border-dashed border-gray-600 rounded-md bg-gray-800/40"> <p className="text-sm text-gray-400 italic text-center">[Диаграмма Потоков Энергии: ТЫ (Искра) → Запуск L1→L2 (+2) → Охота/Апгрейд (Подпитка Роста) → Щит]</p> </div> )}
                           {section.id === 'marketing' && ( <div className="mt-4 p-3 border border-dashed border-gray-600 rounded-md bg-gray-800/40"> <p className="text-sm text-gray-400 italic text-center">[Кибер-Воронка: Сигнал → Зов → Зион L1 → Трансмутация L2 (+2 L1) → Экспонента]</p> </div> )}
                         </div>
                       </details>
                    </div>
                );
              })}
              <section className="text-center pt-10 border-t border-brand-purple/20 mt-12">
                 <VibeContentRenderer content={conclusionText1} className="text-lg text-gray-400 italic" />
                 <VibeContentRenderer content={conclusionText2} className="mt-6 text-gray-300 text-lg" />
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
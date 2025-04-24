"use client";

import React, { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAppContext } from "@/contexts/AppContext";
import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from "@/components/ui/tooltip";
// Иконки: добавим алхимию, матрицу, качалку
import {
  FaFileAlt, FaBullseye, FaUsers, FaBoxOpen, FaChartLine, FaAtom,
  FaMobileAlt, FaComments, FaPaintBrush, FaBrain, FaRocket, FaUserNinja,
  FaMoneyBillWave, FaTriangleExclamation, FaUserAstronaut, FaSignature,
  FaRecycle, FaCode, FaVideo, FaNewspaper, FaGithub, FaTelegram, FaCarCrash,
  FaRobot, FaGift, FaHandshake, FaBomb, FaFlaskVial, FaInfinity, FaDumbbell, // Алхимия, Бесконечность, Качалка
  FaEye // Глаз Морфеуса
} from "react-icons/fa6";
import { debugLogger } from "@/lib/debugLogger";
import Link from "next/link";
import { cn } from "@/lib/utils";
import type { Database } from "@/types/database.types";

type DbUser = Database["public"]["Tables"]["users"]["Row"] | null;

// Карта компонентов иконок (ДОЛЖНА содержать ВСЕ используемые в маркерах ::Fa...::)
const iconComponents: { [key: string]: React.ElementType } = {
  FaFileAlt, FaBullseye, FaUsers, FaBoxOpen, FaChartLine, FaAtom, FaFlaskVial, // Добавил алхимию
  FaMobileAlt, FaComments, FaPaintBrush, FaBrain, FaRocket, FaUserNinja, FaInfinity, FaDumbbell, // Добавил бесконечность, качалку
  FaMoneyBillWave, FaTriangleExclamation, FaUserAstronaut, FaSignature, FaEye, // Добавил глаз
  FaRecycle, FaCode, FaVideo, FaNewspaper, FaGithub, FaTelegram, FaCarCrash,
  FaRobot, FaGift, FaHandshake, FaBomb
};

// Компонент RenderContent (без изменений, он парсит маркеры)
const RenderContent: React.FC<{ content: string }> = ({ content }) => {
  const paragraphs = content.split('\n');
  return ( <> {paragraphs.map((paragraph, pIndex) => { const segments = paragraph.split(/(\*\*.*?\*\*)|(::Fa(\w+)(?:\s+className="([^"]*)")?\s*::)/g).filter(Boolean); return ( <p key={pIndex} className="mb-2 last:mb-0"> {segments.map((segment, sIndex) => { if (segment.startsWith('**') && segment.endsWith('**')) { return <strong key={sIndex}>{segment.slice(2, -2)}</strong>; } const iconMarkerMatch = segment.match(/^::Fa(\w+)(?:\s+className="([^"]*)")?\s*::$/); if (iconMarkerMatch) { const [, iconName, className = ""] = iconMarkerMatch; const IconComp = iconComponents[`Fa${iconName}`]; if (IconComp) { const finalClassName = cn("inline-block align-middle mx-1", className || "w-4 h-4"); return <IconComp key={sIndex} className={finalClassName} />; } else { console.warn(`[RenderContent] Icon "Fa${iconName}" not found.`); return <span key={sIndex} className="text-red-500 font-mono" title={`Icon Fa${iconName} not found`}>[?]</span>; } } const renderedSegment = segment.replace(/->/g, '→'); return <React.Fragment key={sIndex}>{renderedSegment}</React.Fragment>; })} </p> ); })} </> );
};


// --- Функция генерации секций с НОВЫМ, ЗАБОРИСТЫМ текстом и маркерами иконок ---
const getPlanSections = (dbUser: DbUser) => {
  // --- Персонализация ---
  const userName = dbUser?.first_name || 'Солдат Удачи';
  const isSanek = dbUser?.username === 'Sanek' || dbUser?.user_id === 'your_sanek_user_id_here'; // <-- Замени ID
  const userHandle = isSanek ? '@SanekTheShaftSlayer' : (dbUser?.username ? `@${dbUser.username}` : 'Твой_Кибер_Сигил'); // Убийца Карданов!
  const userOriginStory = isSanek
     ? "в Матрице разбитых карданов и дешевого пива ::FaCarCrash className='inline text-red-500'::"
     : "в поиске красной таблетки от серой жизни";
  const myExperience = "13+ лет варки кибер-зелий"; // Мой опыт
  const grantAmount = 350000;
  const grantAmountStr = `${grantAmount.toLocaleString('ru-RU')} руб.`;
  const focusTimeCostPerMonth = 35000;
  const focusTimeBudget = grantAmount * 0.60;
  const timeInvestmentMonths = Math.floor(focusTimeBudget / focusTimeCostPerMonth); // ~6 мес. "алхимических опытов"
  const marketingBudget = Math.round(grantAmount * 0.25); // ~87.5к на поиск "подопытных кроликов"... клиентов!
  const devToolBudget = Math.round(grantAmount * 0.05); // ~17.5к на "философский камень" (платные AI/API)
  const bufferBudget = grantAmount - focusTimeBudget - marketingBudget - devToolBudget; // ~35к "эликсир от похмелья и факапов"

  return [
     {
      id: "resume",
      title: `1. Манифест Кибер-Алхимика: ${userName}, Плавим Свинец в Золото!`,
      icon: FaFlaskVial, // Алхимия!
      color: "text-brand-green",
      content: `Проект **"Кибер-Волк ${userName}"** – это, бл*дь, не "дорожная карта". Это **рецепт твоего личного философского камня**! Твой JUMPSTART ::FaRocket className="inline text-green-400"::, чтобы ты (${userHandle}) **вырвался нах*й** из ${userOriginStory} и начал **трансмутировать реальность** под себя. Управлять будешь **силой мысли... и телефона** ::FaMobileAlt className="inline text-green-400"::!
      **Кодекс Алхимика (VIBE):** Скорость (<::FaRocket::>) + **AI-Магия** (<::FaAtom className="inline text-purple-400"::>) + Непробиваемая Защита (<::FaUserNinja className="inline text-gray-400"::>). Плюс **SelfDev** – ты не ищешь работу, ты **ПЕРЕПЛАВЛЯЕШЬ СЕБЯ** в новую версию.
      **Ингредиенты:** Берем **халяву** – Vercel, GitHub (<::FaGithub::>), Telegram (<::FaTelegram className="inline text-blue-400"::>). Дорогие артефакты? Только если без них никак.
      **Грант (${grantAmountStr}) – Эликсир Возможностей:** Это не бабки на бухло. Это **инвестиция в ТЕБЯ, Первый Ученик Алхимика**:
      - **ТВОЕ ВРЕМЯ на Варку Зелий** (~${timeInvestmentMonths} мес. ::FaUserAstronaut className="inline text-yellow-400"::): Забудь про "работу". **Погружайся в VIBE**, создавай контент, учись у AI. Стань мастером!
      - **Поиск "Золотых" Клиентов** (~${marketingBudget.toLocaleString('ru-RU')} руб.): Найти тех, кто **заплатит золотом** за твою магию. Те самые "розовые чеки" Волка ::FaMoneyBillWave className="inline text-pink-400"::.
      - **Апгрейд Твоей Лаборатории (Мозга)** (~${devToolBudget.toLocaleString('ru-RU')} руб.): Доступ к **секретным AI-гримуарам**, курсы по "ментальной алхимии" (маркетинг/продажи). Ты должен стать **архимагом**, а не подмастерьем.
      - **"Неразбиваемая Колба"** (~${bufferBudget.toLocaleString('ru-RU')} руб.): На случай ::FaCarCrash:: или если Гугл решит сделать свой AI платным (спойлер: скоро сделает, но появится новый халявный!).
      **Великая Цель:** Построить **не сайт, а МАШИНУ ПО ТРАНСМУТАЦИИ УСИЛИЙ В СВОБОДУ И БАБКИ**, где главный реактор – **ТВОЙ МОЗГ И VIBE**.`
    },
     {
      id: "description",
      title: "2. Твой Магический Арсенал: Сила в Кармане",
      icon: FaUserAstronaut, // Ты - властелин этого арсенала
      color: "text-brand-cyan",
      content: `**Центр Управления:** Телефон ::FaMobileAlt className="inline text-cyan-400":: + (Опц.) Ноут для "большой магии".
      **1. Личный Гримуар (Сайт/Блог, 0 руб):** Твоя история ("Как я сломал кардан и нашел Грааль"), твои заклинания (VIBE-инсайты), твоя философия. Быстро, стильно (Next.js/Vercel). **Обновляется силой слова** (через GitHub ::FaGithub:: ботом из Телеги ::FaTelegram::).
      **2. Тайное Общество (TG-Канал/Чат <::FaTelegram className="inline text-blue-400"::>):** Собирай адептов ::FaUsers::. Делись секретами, отвечай на вопросы, создавай **свою секту**... эээ, комьюнити.
      **3. Хранилище Артефактов (GitHub <::FaGithub::>):** Твой "Кибер-Сундук". Готовые заклинания (Jumpstart Kit ::FaBoxOpen::!), демонстрация VIBE-магии. Место, где **адепты учатся**, повторяя за тобой.
      **4. AI-Алхимик (<::FaAtom className="inline text-purple-400"::> + <::FaRecycle className="inline text-yellow-400"::>):** Твой личный Мерлин. Надиктовал идею -> получил 10 постов, 3 сценария, 20 картинок. **Из свинца -> золото. Из идеи -> контент.** Экономит 90% маны (времени).
      **УТП (Твоя Уникальная Магия):** Ты – **не копия**, ты – **ОРИГИНАЛ** (${userName}, ${userHandle}). Ты выбрался из ${userOriginStory}. Ты юзаешь **партизанский AI** ::FaRobot:: на **доступных артефактах**. Ты **честный**, ты **понятный**. Ты не продаешь воздух, ты **учишь летать**.`
    },
    {
      id: "market",
      title: "3. Охотничьи Угодья: Где Водятся Мамонты?",
      icon: FaUsers, // Твоя цель
      color: "text-brand-pink",
      content: `Рынок РФ? Выжженная земля, где **растут кибер-цветы**. Старые динозавры вымерли, новым нужна **скорость и магия**. AI – это эликсир роста.
      **Твоя Дичь (ЦА):** Заблудшие души в Матрице. Такие же, как ты вчера, ${userName}. Разрабы, кто "не знает Кунг-Фу" AI. Фрилансеры, кто хочет больше бабла за меньше гемора. Малый бизнес, кто хочет AI, но ссыт ::FaPoo::. Те, кто ищет **Красную Таблетку** от ${userOriginStory}.
      **Конкуренты (Серые Маги):** Скучные лекторы, инфоцыгане на метле, "эксперты" без реальной магии.
      **Твой Амулет (Отстройка):**
      - **ТЫ (${userName}):** Твоя история ::FaSignature:: – это заклинание доверия.
      - **VIBE:** Мы не колдуем, мы **инженерим магию**. Скорость, AI, безопасность.
      - **SelfDev:** Качаем не только скиллы, но и **дух воина** ::FaUserNinja::.
      - **AI-Алхимия (<::FaAtom::>):** Наше секретное оружие массового контента.
      - **"Магия для Народа":** Просто, доступно, без пафоса.`
    },
    {
      id: "product",
      title: "4. Твои Эликсиры: Знания, Скорость, Результат",
      icon: FaGift, // Сначала ценность
      color: "text-brand-orange",
      content: `Принцип Алхимика: Сначала преврати **свинец в золото** на глазах у всех ::FaGift className="inline text-orange-400"::, потом продавай рецепт.
      **Приманка (Халява для Адептов):**
      - **Контент (<::FaNewspaper::>):** Твой путь Воина Света. Кейсы, факапы ("Как AI чуть не сжег мой комп"). VIBE-лайфхаки. AI (<::FaAtom::>) генерит 80%.
      - **Код (<::FaCode::>):** Jumpstart Kit (<::FaBoxOpen::>), полезные AI-скрипты на GitHub (<::FaGithub::>). Дай пощупать магию.
      - **Переводы/Саммари (<::FaBrain::>):** Концентрат мудрости (Purpose&Profit, AI-тренды) – без воды, по-пацански.
      **Твой "Философский Камень" (Платно):**
      - **"Вправление Мозгов" с ${userName}:** Личный коучинг/менторство по VIBE, AI, SelfDev (Старт: 3-5к руб/час).
      - **Мастер-Класс "AI-Ниндзюцу":** Практика взлома реальности с AI (Старт: 5-10к руб/чел).
      - **Jumpstart Kit "Заряженный":** Готовые решения для быстрого запуска (Старт: 1-3к руб/шт).
      - **(VIP) Орден "Кибер-Волков":** Подписка на тайные знания и личную связь.`
    },
     {
      id: "marketing",
      title: "5. Маяки в Тумане: Как Призвать Своих",
      icon: FaBullseye, // Маяк светит
      color: "text-neon-lime",
      content: `- <::FaPaintBrush className="inline text-neon-lime"::> **Контент - Твой Маяк:** Забудь "продажи". Делай то, от чего **у самого мурашки**! Делись инсайтами, процессом. AI (<::FaAtom className="inline text-purple-400"::>) – твой личный Пикассо и Толстой. **ЧЕСТНОСТЬ. ПОЛЬЗА. РЕГУЛЯРНОСТЬ.** (TG, VK, YouTube).
      - <::FaComments className="inline text-neon-lime"::> **Создай Секту (<::FaTelegram className="inline text-blue-400"::>):** Общайся! Помогай! Будь **настоящим**. Лояльность > подписчиков. Люди идут за лидером, не за рекламой.
      - <::FaGithub className="inline text-neon-lime"::> **GitHub - Магнит для Умных:** Код – лучший язык для технарей.
      - **Союзы (<::FaHandshake::>):** Ищи других "алхимиков", мути совместные ритуалы.
      **Мана для Каста (Грант ~${marketingBudget.toLocaleString('ru-RU')} руб.):**
      - **Таргет:** Прицельный огонь по тем, кому нужна твоя магия.
      - **Посевы:** Распространяй слухи в нужных "тавернах".
      - **Эксперименты:** Пробуй разные заклинания (форматы), смотри, что работает!

      [Алхимическая Формула: Контент (Магия+AI) → Призыв (Таргет/Сарафан) → Секта (TG) → Золото (Доверие → Продажа)]`
    },
     {
      id: "operations",
      title: "6. Алхимия на Кухне: Телефон + AI",
      icon: FaMobileAlt, // Главный инструмент
      color: "text-brand-cyan",
      content: `**Твоя Лаборатория (<::FaMobileAlt className="inline text-cyan-400"::> + <::FaAtom::>):** Телефон – твой магический кристалл! Снял -> смонтировал (CapCut) -> AI (<::FaAtom::>) написал текст, нарисовал обложку. Сказал -> AI превратил в пост. **90% рутины – на AI!**
      **Твой Замок (0 руб):** Сайт на Next.js/Vercel. Управление – GitHub/TG-бот (<::FaGithub::>). Подвал с данными? Supabase (0 руб), если надо.
      **Связь с Миром:** Telegram/VK (<::FaTelegram className="inline text-blue-400"::>) для всего!
      **Закон Алхимика:** **НЕ УСЛОЖНЯЙ!** Фокус на **трансмутации**, а не на красоте колб.`
    },
    {
      id: "org",
      title: "7. Структура: Армия Одного Волка",
      icon: FaUserNinja, // Волк-одиночка
      color: "text-gray-400",
      content: `**Статус:** Самозанятый (НПД). Легально, просто, без геморроя.
      **Ты (${userName}, ${userHandle}):** <::FaUserAstronaut className="inline text-gray-300"::> Ты – **НЕО**. Ты – **АРХИТЕКТОР**. Ты – **ВОЛК**. Никаких сотрудников! Твоя команда – это **ТЫ + AI-ЛЕГИОН <::FaRobot::>** (они не спят, не едят, не просят зарплату!). Масштабируй **СВОИ** возможности через AI, а не чужие жопы.`
    },
    {
      id: "finance",
      title: `8. Золотой Запас: ${grantAmountStr} – Эликсир Роста`,
      icon: FaMoneyBillWave,
      color: "text-brand-yellow",
      content: `Грант – это **точка опоры**, чтобы перевернуть твой мир.
      - **<::FaUserAstronaut className="inline text-yellow-400"::> 1. ТВОЕ ВРЕМЯ (~${focusTimeBudget.toLocaleString('ru-RU')} руб.):** Главный ресурс Алхимика! Чтобы ты (${userName}) мог **забить на Матрицу** и ~${timeInvestmentMonths} мес. **творить магию**: создавать контент ::FaPaintBrush::, качать мозг ::FaBrain::, строить "секту". Это **инвестиция в твой артефакт – ТЕБЯ**!
      - **<::FaBullseye className="inline text-yellow-400"::> 2. Поиск "Золотых Руд" (~${marketingBudget.toLocaleString('ru-RU')} руб.):** Таргет, тесты, посевы. Найти **первых, кто заплатит золотом** за твой эликсир. Это **кровь** твоего будущего бизнеса.
      - **<::FaBrain className="inline text-yellow-400"::> 3. Апгрейд Твоей Силы (~${devToolBudget.toLocaleString('ru-RU')} руб.):** Доступ к **платным заклинаниям** (AI), гримуары по маркетингу/продажам. Ты должен быть **Морфеусом**, а не просто хакером.
      - **<::FaTriangleExclamation className="inline text-yellow-400"::> 4. "Несгораемый Сейф" (~${bufferBudget.toLocaleString('ru-RU')} руб.):** На случай, если эксперимент взорвется ::FaBomb:: или Google AI станет платным.
      **Цель по Золоту (1 год):** Выйти на **стабильный поток 80к+ золотых/мес** через полгода-год. Грант **снимает кандалы страха** и позволяет **колдовать смелее**.

      [Диаграмма Распила Гранта: ТЫ (60%), Охота (25%), Твой Апгрейд (5%), Сейф (10%)]`
    },
     {
      id: "risks",
      title: "9. Агенты Смиты и План Эвакуации",
      icon: FaCarCrash, // Неизбежное дерьмо
      color: "text-red-500",
      content: `**Магия Иссякнет (Free Tier):** Юзаем "Сейф" (<::FaTriangleExclamation::>), ищем опенсорс аналоги, **быстро учимся зарабатывать**, чтобы платить за силу.
      **Ты Выгорел (${userName}):** AI (<::FaAtom::>) – твой голем, делает рутину. "Секта" (<::FaComments::>) – твоя поддержка. Делай то, что **в кайф** (SelfDev!). Помни: **"Ложки нет"**, усталость – в голове. Но отдыхать надо.
      **Заклинание Не Сработало (Идея – Г):** **AI-Валидация** (<::FaBullseye::>) **ДО КАСТА!** Убиваем дохлых единорогов быстро. VIBE = Гибкость. Перепридумываем магию за день.
      **Матрица Наносит Ответный Удар (<::FaCarCrash className="inline text-red-500"::>):** Жизнь – сука. Твои новые скиллы VIBE/AI/SelfDev – это твой **экзоскелет**. Сможешь найти новый бой/проект, если этот проиграешь.`
    },
    {
      id: "conclusion",
      title: `10. ${userName}, Прими Красную Таблетку!`,
      icon: FaBrain, // Твой выбор
      color: "text-brand-purple",
      content: `Проект **"Кибер-Волк ${userName}"** – это твой **шанс стать Нео**. Перестать быть батарейкой для Матрицы. Используй свой **мозг** (<::FaBrain::>), свою **уникальность** (<::FaSignature::>), поддержку **стаи** (<::FaUsers::>) и **божественную силу AI** (<::FaAtom::>). Грант – это **стартовый импульс**. Дальше – твой **VIBE**, твоя **вера в себя** (помнишь? "Ты думаешь, это воздух, которым ты дышишь?" ::FaEye:: Скорость – это вера!).
      Хватит сомневаться, **ВРЕМЯ ИЗГИБАТЬ ЛОЖКИ!** ::FaRocket className="inline text-brand-green"::`
    },
  ];
};


// --- Компонент Страницы (с исправленным рендером иконки в .map) ---
export default function PPlanPage() {
  const { dbUser, isLoading, error } = useAppContext();
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => { setIsMounted(true); }, []);

  const planSections = useMemo(() => getPlanSections(dbUser), [dbUser]);
  const pageTitleName = useMemo(() => dbUser?.first_name || "Кибер-Волк", [dbUser]);
  const greetingName = useMemo(() => dbUser?.first_name || 'Боец', [dbUser]);

  // Лоадер и ошибка без изменений
  if (!isMounted || isLoading) { return ( <div className="flex justify-center items-center min-h-screen pt-20 bg-gradient-to-br from-gray-900 via-black to-gray-800"> <p className="text-brand-cyan animate-pulse text-xl font-mono">Загрузка Манифеста Кибер-Волка...</p> </div> ); }
  if (error) { return ( <div className="flex flex-col justify-center items-center min-h-screen pt-20 bg-gradient-to-br from-gray-900 via-black to-red-900/50"> <FaTriangleExclamation className="text-6xl text-red-500 mb-4"/> <p className="text-red-400 text-xl font-mono">Ошибка загрузки плана</p> <p className="text-red-500 mt-2 text-sm max-w-md text-center">{error.message}</p> <p className="text-gray-400 mt-4 text-xs">Перезагрузись.</p> </div> ); }

  const getBorderClass = (textColorClass: string): string => cn(textColorClass.replace('text-', 'border-'), 'border-gray-500/30');

  return (
    // Основной контейнер
    <div className="relative min-h-screen overflow-hidden pt-20 pb-10 bg-gradient-to-br from-dark-bg via-black to-purple-900/30 text-light-text">
       {/* Фон */}
       <div className="absolute inset-0 bg-repeat opacity-[0.04] z-0 bg-grid-pattern"></div>
      <TooltipProvider delayDuration={150}>
        <div className="relative z-10 container mx-auto px-4">
          <Card className="max-w-4xl mx-auto bg-dark-card/90 backdrop-blur-xl text-light-text rounded-2xl border-2 border-brand-purple/40 shadow-[0_0_40px_rgba(157,0,255,0.4)]">
            {/* Заголовок */}
            <CardHeader className="text-center border-b border-brand-purple/20 pb-5 pt-8">
              <FaUserNinja className="text-6xl text-brand-purple mx-auto mb-4 animate-pulse" /> {/* Можно заменить на FaHatWizard ? */}
              <CardTitle className="text-3xl md:text-5xl font-bold text-brand-purple cyber-text glitch uppercase tracking-wider" data-text={`КИБЕР-АЛХИМИЯ ${pageTitleName.toUpperCase()}`}>
                 КИБЕР-АЛХИМИЯ {pageTitleName.toUpperCase()}
              </CardTitle>
              {/* Подзаголовок */}
              <p className="text-md md:text-lg text-gray-300 mt-4 font-mono max-w-2xl mx-auto">
                 Твой Путь: От <span className="text-red-500">{greetingName === 'Санек' ? 'Свинцового Кардана' : 'Нуля'}</span> ::FaCarCrash className="inline text-red-500":: к <span className="text-yellow-400">Золотому Потоку</span> ::FaMoneyBillWave className="inline text-yellow-400"::. Грант {getPlanSections(dbUser)[7].content.includes('350 000') ? '350к' : 'XX к'} эликсира. <span className="text-xs opacity-70">(Персональный Гримуар для {greetingName})</span>
              </p>
            </CardHeader>
            {/* Секции Плана */}
            <CardContent className="space-y-8 p-4 md:p-8">
              {planSections.map((section, index) => (
                   <details key={section.id} className={cn(
                       "group border-l-4 pl-4 py-3 rounded-r-md transition-all duration-300 ease-in-out open:bg-purple-900/10 open:shadow-inner",
                       getBorderClass(section.color)
                   )} open={index < 3 || section.id === 'finance'}> {/* Первые 3 и финансы открыты */}
                     <summary className={cn("text-xl md:text-2xl font-semibold cursor-pointer list-none flex items-center hover:opacity-80 transition-opacity", section.color)}>
                       {/* *** ИСПРАВЛЕНИЕ ЗДЕСЬ *** */}
                       {/* Просто рендерим компонент иконки, если он есть */}
                       {section.icon && <section.icon className="mr-3 flex-shrink-0 w-5 h-5 group-open:animate-pulse" />}
                       {section.title}
                     </summary>
                     <div className="mt-3 text-gray-300 text-base leading-relaxed space-y-3 pl-2 pr-1">
                       <RenderContent content={section.content} />
                       {/* Визуализации */}
                       {section.id === 'finance' && ( <div className="mt-4 p-3 border border-dashed border-gray-600 rounded-md bg-gray-800/40"> <p className="text-sm text-gray-400 italic text-center">[Диаграмма Распила Гранта: ТЫ (60%), Охота (25%), Твой Апгрейд (5%), Сейф (10%)]</p> </div> )}
                       {section.id === 'marketing' && ( <div className="mt-4 p-3 border border-dashed border-gray-600 rounded-md bg-gray-800/40"> <p className="text-sm text-gray-400 italic text-center">[Алхимическая Воронка: Контент → Зов → Адепты → Золото]</p> </div> )}
                     </div>
                   </details>
                ))}
              {/* Заключение */}
              <section className="text-center pt-8 border-t border-brand-purple/20 mt-10">
                 <p className="text-lg text-gray-400 italic">
                   Это **карта**, {greetingName}, а не территория. **Путь осилит идущий**. Начинай **трансмутацию**! VIBE!
                 </p>
                 <p className="mt-6 text-gray-300 text-lg">
                   Нужна помощь в ритуале? Заблудился в формулах? <span className="text-neon-lime font-bold">Пиши в Телегу ::FaTelegram::</span> <a href="https://t.me/salavey13" target="_blank" rel="noopener noreferrer" className="text-brand-blue hover:underline font-semibold">@salavey13</a> или используй форму на <Link href="/jumpstart#jumpstart-form" className="text-neon-lime hover:underline font-semibold inline-flex items-center">Jumpstart ::FaRocket::</Link>.
                 </p>
                 <p className="mt-4 text-brand-purple text-2xl font-bold uppercase tracking-wider animate-pulse">
                   ВРЕМЯ СОЗДАВАТЬ ЗОЛОТО!
                 </p>
              </section>

            </CardContent>
          </Card>
        </div>
      </TooltipProvider>
    </div>
  );
}
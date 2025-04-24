"use client";

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

// *** ОКОНЧАТЕЛЬНО ИСПРАВЛЕННЫЙ RenderContent ***
const RenderContent: React.FC<{ content: string }> = ({ content }) => {
  const paragraphs = content.split('\n');

  return (
    <>
      {paragraphs.map((paragraph, pIndex) => {
        const elements: (string | JSX.Element)[] = [];
        // Regex to find **bold** and ::FaIcon...:: markers globally
        // Capturing groups: 1=bold content, 2=full icon marker, 3=icon name, 4=className content
        const regex = /(\*\*(.*?)\*\*)|(::Fa(\w+)(?:\s+className="([^"]*)")?\s*::)/g;
        let lastIndex = 0;
        let match;

        // Iterate through all matches in the paragraph
        while ((match = regex.exec(paragraph)) !== null) {
          const fullMatchedString = match[0]; // The entire matched string (bold or icon marker)
          const matchStartIndex = match.index;

          // 1. Add text segment before the current match
          if (matchStartIndex > lastIndex) {
            elements.push(paragraph.substring(lastIndex, matchStartIndex).replace(/->/g, '→'));
          }

          // 2. Handle the match itself
          if (match[1]) { // It's a **bold** match (captured in group 1, content in group 2)
            elements.push(<strong key={`${pIndex}-${matchStartIndex}-bold`}>{match[2]}</strong>);
          } else if (match[3]) { // It's an ::FaIcon...:: match (captured in group 3, name in 4, className in 5)
            const iconName = match[4];
            const className = match[5] || ""; // Extracted className or empty string
            const IconComp = iconComponents[`Fa${iconName}`];
            if (IconComp) {
              const finalClassName = cn("inline-block align-middle mx-1", className || "w-4 h-4"); // Default size
              elements.push(<IconComp key={`${pIndex}-${matchStartIndex}-icon`} className={finalClassName} />);
            } else {
              console.warn(`[RenderContent] Icon "Fa${iconName}" not found.`);
              elements.push(<span key={`${pIndex}-${matchStartIndex}-icon-error`} className="text-red-500 font-mono" title={`Icon Fa${iconName} not found`}>[?]</span>);
            }
          }

          // Update lastIndex to the end of the current match
          lastIndex = matchStartIndex + fullMatchedString.length;
        }

        // 3. Add any remaining text after the last match
        if (lastIndex < paragraph.length) {
          elements.push(paragraph.substring(lastIndex).replace(/->/g, '→'));
        }

        // Render the paragraph with interleaved text and JSX elements, only if it has actual content
        const hasVisibleContent = elements.some(el => (typeof el === 'string' && el.trim() !== '') || React.isValidElement(el));
        return hasVisibleContent ? (
          <p key={pIndex} className="mb-2 last:mb-0">
            {elements.map((el, elIndex) => (
              <React.Fragment key={elIndex}>{el}</React.Fragment>
            ))}
          </p>
        ) : null; // Skip rendering empty paragraphs
      })}
    </>
  );
};


// --- Функция генерации секций (getPlanSections) с ИСПРАВЛЕННЫМИ маркерами ---
const getPlanSections = (dbUser: DbUser) => {
  const userName = dbUser?.first_name || 'Неофит';
  // *** ИСПОЛЬЗУЕМ РЕАЛЬНЫЕ ДАННЫЕ САНЬКА ***
  const isSanek = dbUser?.user_id?.toString() === '1260304309' || dbUser?.username === 'Pihman';
  const userHandle = isSanek ? '@Pihman_Reborn' : (dbUser?.username ? `@${dbUser.username}` : 'Твой_Кибер_Сигил'); // Новый ник для перерожденного Санька
  const userOriginStory = isSanek
     ? "в Матрице разбитых карданов и дешевого пива ::FaCarCrash className='inline text-red-500'::"
     : "в поисках выхода из серой рутины";
  const myExperience = "13+ лет в кибер-алхимии";
  const grantAmount = 350000;
  const grantAmountStr = `${grantAmount.toLocaleString('ru-RU')} руб.`;
  const focusTimeCostPerMonth = 35000;
  const focusTimeBudget = grantAmount * 0.60;
  const timeInvestmentMonths = Math.floor(focusTimeBudget / focusTimeCostPerMonth);
  const marketingBudget = Math.round(grantAmount * 0.25);
  const devToolBudget = Math.round(grantAmount * 0.05);
  const bufferBudget = grantAmount - focusTimeBudget - marketingBudget - devToolBudget;

  return [
     {
      id: "resume",
      title: `1. Манифест Кибер-Алхимика: ${userName}, Плавим Свинец в Золото!`,
      icon: FaFlaskVial,
      color: "text-brand-green",
      // Убрал < > вокруг иконок в тексте, используем ::FaIconName::
      content: `Проект **"Кибер-Волк ${userName}"** – это, бл*дь, не "дорожная карта". Это **рецепт твоего личного философского камня**! Твой JUMPSTART ::FaRocket className="inline text-green-400"::, чтобы ты (${userHandle}) **вырвался нах*й** из ${userOriginStory} и начал **трансмутировать реальность** под себя. Управлять будешь **силой мысли... и телефона** ::FaMobileAlt className="inline text-green-400"::!
      **Кодекс Алхимика (VIBE):** Скорость ::FaRocket:: + **AI-Магия** ::FaAtom className="inline text-purple-400":: + Непробиваемая Защита ::FaUserNinja className="inline text-gray-400"::. Плюс **SelfDev** – ты не ищешь работу, ты **ПЕРЕПЛАВЛЯЕШЬ СЕБЯ** в новую версию.
      **Ингредиенты:** Берем **халяву** – Vercel, GitHub ::FaGithub::, Telegram ::FaTelegram className="inline text-blue-400"::. Дорогие артефакты? Только если без них никак.
      **Грант (${grantAmountStr}) – Эликсир Возможностей:** Это не бабки на бухло. Это **инвестиция в ТЕБЯ, Первый Ученик Алхимика**:
      - **ТВОЕ ВРЕМЯ на Варку Зелий** (~${timeInvestmentMonths} мес. ::FaUserAstronaut className="inline text-yellow-400"::): Забудь про "работу". **Погружайся в VIBE**, создавай контент, учись у AI. Стань мастером!
      - **Поиск "Золотых" Клиентов** (~${marketingBudget.toLocaleString('ru-RU')} руб.): Найти тех, кто **заплатит золотом** за твою магию. Те самые "розовые чеки" Волка ::FaMoneyBillWave className="inline text-pink-400"::.
      - **Апгрейд Твоей Лаборатории (Мозга)** (~${devToolBudget.toLocaleString('ru-RU')} руб.): Доступ к **секретным AI-гримуарам**, курсы по "ментальной алхимии" (маркетинг/продажи). Ты должен стать **архимагом**, а не подмастерьем.
      - **"Неразбиваемая Колба"** (~${bufferBudget.toLocaleString('ru-RU')} руб.): На случай ::FaCarCrash:: или если Гугл решит сделать свой AI платным (спойлер: скоро сделает, но появится новый халявный!).
      **Великая Цель:** Построить **не сайт, а МАШИНУ ПО ТРАНСМУТАЦИИ УСИЛИЙ В СВОБОДУ И БАБКИ**, где главный реактор – **ТВОЙ МОЗГ И VIBE**.`
    },
     {
      id: "description",
      title: "2. Твой Кибер-Арсенал: Сила в Кармане",
      icon: FaUserAstronaut,
      color: "text-brand-cyan",
      content: `**Твоя Панель Управления:** Телефон ::FaMobileAlt className="inline text-cyan-400":: + Ноут (опционально, для серьезных заклинаний).
      **1. Личный Портал (Сайт/Блог, 0 руб):** Твоя цифровая проекция. Кто ты, откуда вылез (${userOriginStory}), куда идешь. VIBE-инсайты, кейсы взлома реальности. Обновляется **через бота** в Телеге ::FaTelegram::, код на GitHub ::FaGithub::.
      **2. Тайное Братство (TG-Канал/Чат ::FaTelegram className="inline text-blue-400"::):** Собирай **последователей** ::FaUsers::. Делись запретными знаниями, отвечай на вопросы, создавай **культ... личности**.
      **3. Хранилище Силы (GitHub ::FaGithub::):** Твой "Кибер-Сундук". Готовые "заклинания" (Jumpstart Kit ::FaBoxOpen::!), примеры VIBE-алхимии. Место, где **ты показываешь класс**.
      **4. AI-Трансмутатор (::FaAtom className="inline text-purple-400":: + ::FaRecycle className="inline text-yellow-400"::):** Твой личный **Джинн из Лампы**. Нашептал идею → получил 10 постов, 3 сценария, 20 артов. **Мысль → Материя.** Экономит 90% времени/маны.
      **УТП (Твой Уникальный "Вайб"):** Ты – **выживший** (${userName}, ${userHandle}). Ты **взломал свою Матрицу** (${userOriginStory}). Ты юзаешь **подпольный AI** ::FaRobot:: на **халявных** инструментах. Ты **честный**, ты **свой**. Ты не торгуешь воздухом, ты **даешь ключ от всех дверей**.`
    },
    {
      id: "market",
      title: "3. Зона Охоты: Кому Нужна Красная Таблетка?",
      icon: FaUsers,
      color: "text-brand-pink",
      content: `Рынок РФ? Поле битвы после падения Титанов. Новые возможности **растут как грибы**. AI – это **новый Клондайк**.
      **Твоя Стая (ЦА):** Те, кто **застрял в Матрице**. Такие же, как ты вчера, ${userName}. Разрабы, которых **задолбал** старый код. Фрилансеры, ищущие **свободу и бабки**. Малый бизнес, кто хочет **дешевый AI-буст**. Все, кто ищет **выход** из ${userOriginStory}.
      **Агенты Смиты (Конкуренты):** "Гуру" с водой вместо знаний, душные курсы, инфоцыгане на Геликах.
      **Твой Плащ-Невидимка (Отстройка):**
      - **Аутентичность (${userName}):** Твоя история ::FaSignature:: – это магнит. Будь собой!
      - **VIBE:** Скорость Нео, магия AI, броня Старка. Мы **делаем быстро, умно и надежно**.
      - **SelfDev:** Мы не просто учим фичи, мы **меняем мышление** ::FaBrain::. Помогаем **взломать СЕБЯ**.
      - **AI-Алхимия (::FaAtom::):** Наш козырь. Контент льется рекой ::FaInfinity::.
      - **"Партизанский" Стиль:** Просто, доступно, без пафоса. Магия для всех!`
    },
     { // Остальные секции также проверяем на отсутствие <>, используем маркеры
      id: "product",
      title: "4. Твои Зелья: Контент, Код, Коучинг",
      icon: FaGift,
      color: "text-brand-orange",
      content: `Принцип "Сначала Угости": Дай попробовать эликсир ::FaGift className="inline text-orange-400"::, потом продавай рецепт.
      **Бесплатные НИШТЯКИ (Строим Доверие и Стаю):**
      - **Контент (::FaNewspaper::):** "Хроники Кибер-Волка" – твой путь, факапы, VIBE-хаки. AI (::FaAtom::) – твой летописец.
      - **Код (::FaCode::):** Jumpstart Kit (::FaBoxOpen::) – "красная таблетка" для новичков. Полезные AI-боты на GitHub (::FaGithub::).
      - **Мудрость Древних (::FaBrain::):** Переводы/саммари топовых идей (Purpose&Profit, AI-будущее) – **без воды, для своих**.
      **Платные Артефакты (Когда Тебе Верят):**
      - **"Пробуждение Силы" с ${userName}:** Личный разбор полетов, VIBE-настройка, AI-пинок (Старт: 3-5к руб/час).
      - **Интенсив "Кунг-Фу с AI":** Практика управления реальностью с AI (Старт: 5-10к руб/чел).
      - **Jumpstart Kit "Магнум":** Заряженные шаблоны (Старт: 1-3к руб/шт).
      - **(Элита) Орден "Джедаев VIBE":** Закрытый клуб, доступ к телу Мастера.`
    },
    {
      id: "marketing",
      title: "5. Сигнальные Огни: Как Найти Своих",
      icon: FaBullseye,
      color: "text-neon-lime",
      content: `- ::FaPaintBrush className="inline text-neon-lime":: **Контент - Твой Голос:** Забудь про "продажи". Говори о том, что **тебя зажигает**! Делись инсайтами, процессом, будь **человеком**. AI (::FaAtom className="inline text-purple-400"::) – твой личный хор, усиливающий твой голос в 100 раз. **РЕАЛЬНОСТЬ. ПОЛЬЗА. ЧАСТО.** (TG, VK, YouTube?).
      - ::FaComments className="inline text-neon-lime":: **Создай Убежище (::FaTelegram className="inline text-blue-400"::):** Твой чат/канал – место силы. **Общайся! Помогай! Отвечай!** Лояльность > подписчиков. Люди идут за **энергией**.
      - ::FaGithub className="inline text-neon-lime":: **GitHub - Маяк для Гиков:** Код привлекает код.
      - **Дипломатия (::FaHandshake::):** Мути коллабы с другими "пробужденными".
      **Топливо для Маяка (Грант ~${marketingBudget.toLocaleString('ru-RU')} руб.):**
      - **Таргет:** Точечный удар по тем, кто ищет "красную таблетку".
      - **Посевы:** Распространяй "вирус VIBE" в правильных местах.
      - **Эксперименты:** Пробуй разные "заклинания" (форматы), смотри, что заходит!

      [Магическая Воронка: Маяк (Контент/AI) → Зов (Таргет) → Орден (TG) → Золото (Доверие → Продажа)]`
    },
     {
      id: "operations",
      title: "6. Алхимическая Лаборатория: Телефон = Всё",
      icon: FaMobileAlt,
      color: "text-brand-cyan",
      content: `**Твоя Башня Мага (::FaMobileAlt className="inline text-cyan-400":: + ::FaAtom::):** ТЕЛЕФОН! Снял на коленке -> смонтировал в CapCut -> AI (::FaAtom::) написал текст, нарисовал арт. Наговорил -> AI сделал пост. **Автоматизируй ВСЁ, что можно!** Освободи время для **МЫСЛИ**.
      **Твой Холст (0 руб):** Сайт на Next.js/Vercel. Управление – GitHub/TG-бот (::FaGithub::). Хранилище знаний? Supabase (0 руб).
      **Связь с Адептами:** Telegram/VK (::FaTelegram className="inline text-blue-400"::) для всего!
      **Принцип Морфеуса:** **"Ты думаешь, это воздух?!"** ::FaEye className="inline text-cyan-400":: Скорость и результат зависят от твоей **веры и умения использовать AI**. Инструменты вторичны.`
    },
    {
      id: "org",
      title: "7. Структура Силы: Ты – Легион",
      icon: FaUserNinja,
      color: "text-gray-400",
      content: `**Статус:** Самозанятый (НПД). Легально и просто.
      **Ты (${userName}, ${userHandle}):** ::FaUserAstronaut className="inline text-gray-300":: Ты – **НЕО**. Ты – **ЕДИНСТВЕННЫЙ**. Не нужны рабы! Твоя команда – это **ТЫ + AI-АРМИЯ ::FaRobot::**. Твоя задача – **качать свой мозг** ::FaDumbbell:: и **направлять AI**. CyberVibe – твоя **тренажерка для разума**. Я – твой **тренер и водонос**, ловлю баги AI, пока ты качаешься.`
    },
    {
      id: "finance",
      title: `8. Золотой Запас: ${grantAmountStr} на Взлет`,
      icon: FaMoneyBillWave,
      color: "text-brand-yellow",
      content: `Грант – это **стартовый эликсир**, чтобы ты **взлетел**.
      - **::FaUserAstronaut className="inline text-yellow-400":: 1. ТВОЕ ВРЕМЯ – ГЛАВНЫЙ РЕСУРС (~${focusTimeBudget.toLocaleString('ru-RU')} руб.):** Чтобы ты (${userName}) мог **выйти из Матрицы найма** и ~${timeInvestmentMonths} мес. **посвятить себя АЛХИМИИ**: создавать контент ::FaPaintBrush::, осваивать VIBE/AI ::FaBrain::, строить "Орден" ::FaUsers::. Это **инвестиция в ТВОЙ будущий "лям зелени"**!
      - **::FaBullseye className="inline text-yellow-400":: 2. ОХОТА НА МАМОНТОВ (~${marketingBudget.toLocaleString('ru-RU')} руб.):** Таргет, тесты, посевы. Найти **первых фанатов**, готовых платить за твою магию. **Быстрые деньги = быстрая вера в себя**.
      - **::FaBrain className="inline text-yellow-400":: 3. ПРОКАЧКА ТВОЕГО "ПРОЦЕССОРА" (~${devToolBudget.toLocaleString('ru-RU')} руб.):** Доступ к **платным AI-заклинаниям**, гримуары по "магии влияния" (маркетинг). Стань **архимагом VIBE**.
      - **::FaTriangleExclamation className="inline text-yellow-400":: 4. "ЗАЩИТНЫЙ АМУЛЕТ" (~${bufferBudget.toLocaleString('ru-RU')} руб.):** На случай **факапа** ::FaBomb:: или если AI станет жадным.
      **Цель по Золоту (1 год):** Стабильный поток **80к+ золотых/мес**. Грант **убирает страх** и позволяет **рисковать**.

      [Диаграмма Эликсира: ТЫ (60%), Охота (25%), Апгрейд (5%), Амулет (10%)]`
    },
     {
      id: "risks",
      title: "9. Агенты Смиты и Запасной Выход",
      icon: FaCarCrash,
      color: "text-red-500",
      content: `**Матрица Отключит Халяву (Free Tier):** Юзаем "Амулет" (::FaTriangleExclamation::), ищем опенсорс, **быстро учимся делать золото**, чтобы платить за ману.
      **Ты Устал Быть Нео (${userName}):** AI (::FaAtom::) – твой **автопилот**. "Орден" (::FaComments::) – твоя **группа поддержки**. Делай то, что **прет** (SelfDev!). Помни: **"Нет ложки"** ::FaEye::! Сила – в голове!
      **Заклинание Пшикнуло (Идея – Г):** **AI-Валидация** (::FaBullseye::) **ДО СТАРТА!** Мочим дохлых драконов в зародыше. VIBE = **Мгновенная Трансформация**.
      **Сбой в Матрице (::FaCarCrash className="inline text-red-500"::):** Жизнь – непредсказуема. Твои **новые нейронные связи** VIBE/AI/SelfDev – это твой **телепорт**. Сможешь респавнуться в новом проекте/фрилансе.`
    },
    {
      id: "conclusion",
      title: `10. ${userName}, Взломай Матрицу!`,
      icon: FaBrain,
      color: "text-brand-purple",
      content: `**"Кибер-Волк ${userName}"** – это **красная таблетка**. Шанс **переписать правила игры**. Используй свой **ум** (::FaBrain::), свою **боль** (::FaSignature::), поддержку **братства** (::FaUsers::) и **безграничную силу AI** (::FaAtom::). Грант – **ключ зажигания**. Дальше – твой **VIBE**, твоя **воля к силе**, твой **прыжок веры**.
      **Хватит быть рабом Матрицы. ПОРА СТАНОВИТЬСЯ АРХИТЕКТОРОМ!** ::FaRocket className="inline text-brand-green"::`
    },
  ];
};


// --- Компонент Страницы (остается как в предыдущем ответе, использует новый RenderContent) ---
export default function PPlanPage() {
  const { dbUser, isLoading, error } = useAppContext();
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => { setIsMounted(true); }, []);

  const planSections = useMemo(() => getPlanSections(dbUser), [dbUser]);
  const pageTitleName = useMemo(() => dbUser?.first_name || "Кибер-Волк", [dbUser]);
  const greetingName = useMemo(() => dbUser?.first_name || 'Неофит', [dbUser]); // Изменил дефолт

  // Лоадер и ошибка без изменений
  if (!isMounted || isLoading) { return ( <div className="flex justify-center items-center min-h-screen pt-20 bg-gradient-to-br from-gray-900 via-black to-gray-800"> <p className="text-brand-cyan animate-pulse text-xl font-mono">Загрузка Гримуара Кибер-Алхимика...</p> </div> ); }
  if (error) { return ( <div className="flex flex-col justify-center items-center min-h-screen pt-20 bg-gradient-to-br from-gray-900 via-black to-red-900/50"> <FaTriangleExclamation className="text-6xl text-red-500 mb-4"/> <p className="text-red-400 text-xl font-mono">Ошибка загрузки плана</p> <p className="text-red-500 mt-2 text-sm max-w-md text-center">{error.message}</p> <p className="text-gray-400 mt-4 text-xs">Матрица глючит. Перезагрузись.</p> </div> ); }

  const getBorderClass = (textColorClass: string): string => cn(textColorClass.replace('text-', 'border-'), 'border-gray-500/30');

  return (
    <div className="relative min-h-screen overflow-hidden pt-20 pb-10 bg-gradient-to-br from-dark-bg via-black to-purple-900/30 text-light-text">
       <div className="absolute inset-0 bg-repeat opacity-[0.04] z-0 bg-grid-pattern"></div>
      <TooltipProvider delayDuration={150}>
        <div className="relative z-10 container mx-auto px-4">
          <Card className="max-w-4xl mx-auto bg-dark-card/90 backdrop-blur-xl text-light-text rounded-2xl border-2 border-brand-purple/40 shadow-[0_0_40px_rgba(157,0,255,0.4)]">
            <CardHeader className="text-center border-b border-brand-purple/20 pb-5 pt-8">
              <FaFlaskVial className="text-6xl text-brand-purple mx-auto mb-4 animate-pulse" /> {/* Можно заменить на FaHatWizard */}
              <CardTitle className="text-3xl md:text-5xl font-bold text-brand-purple cyber-text glitch uppercase tracking-wider" data-text={`КИБЕР-АЛХИМИЯ ${pageTitleName.toUpperCase()}`}>
                 КИБЕР-АЛХИМИЯ {pageTitleName.toUpperCase()}
              </CardTitle>
              {/* Используем RenderContent для подзаголовка тоже, чтобы иконки рендерились */}
              <div className="text-md md:text-lg text-gray-300 mt-4 font-mono max-w-2xl mx-auto">
                  <RenderContent content={`Твой Рецепт: От <span class="text-red-500">${greetingName === 'Pihman' ? 'Свинцового Кардана' : 'Нуля'}</span> ::FaCarCrash className="inline text-red-500":: к <span class="text-yellow-400">Золотому VIBE</span> ::FaMoneyBillWave className="inline text-yellow-400"::. Грант ${getPlanSections(dbUser)[7].content.includes('350 000') ? '350к' : 'XX к'} маны. <span class="text-xs opacity-70">(Личный Гримуар для ${greetingName})</span>`} />
              </div>
            </CardHeader>
            <CardContent className="space-y-8 p-4 md:p-8">
              {planSections.map((section, index) => (
                   <details key={section.id} className={cn(
                       "group border-l-4 pl-4 py-3 rounded-r-md transition-all duration-300 ease-in-out open:bg-purple-900/10 open:shadow-inner",
                       getBorderClass(section.color)
                   )} open={index < 3 || section.id === 'finance'}>
                     <summary className={cn("text-xl md:text-2xl font-semibold cursor-pointer list-none flex items-center hover:opacity-80 transition-opacity", section.color)}>
                       {section.icon && <section.icon className="mr-3 flex-shrink-0 w-5 h-5 group-open:animate-pulse" />}
                       {section.title}
                     </summary>
                     <div className="mt-3 text-gray-300 text-base leading-relaxed space-y-3 pl-2 pr-1">
                       {/* Используем НОВЫЙ RenderContent */}
                       <RenderContent content={section.content} />
                       {/* Визуализации */}
                       {section.id === 'finance' && ( <div className="mt-4 p-3 border border-dashed border-gray-600 rounded-md bg-gray-800/40"> <p className="text-sm text-gray-400 italic text-center">[Диаграмма Распила Маны: ТЫ – Реактор (60%), Охота (25%), Апгрейд (5%), Амулет (10%)]</p> </div> )}
                       {section.id === 'marketing' && ( <div className="mt-4 p-3 border border-dashed border-gray-600 rounded-md bg-gray-800/40"> <p className="text-sm text-gray-400 italic text-center">[Алхимическая Воронка: Маяк → Зов → Орден → Золото]</p> </div> )}
                     </div>
                   </details>
                ))}
              {/* Заключение */}
              <section className="text-center pt-8 border-t border-brand-purple/20 mt-10">
                 <p className="text-lg text-gray-400 italic">
                   Это **карта**, {greetingName}, а не территория. **Путь осилит идущий**. Начинай **трансмутацию**! VIBE!
                 </p>
                 <p className="mt-6 text-gray-300 text-lg">
                    Нужна помощь в ритуале? Заблудился в формулах? <span className="text-neon-lime font-bold">ПИШИ МНЕ</span> в <a href="https://t.me/salavey13" target="_blank" rel="noopener noreferrer" className="text-brand-blue hover:underline font-semibold inline-flex items-center">Телегу ::FaTelegram::</a> или используй форму на <Link href="/jumpstart#jumpstart-form" className="text-neon-lime hover:underline font-semibold inline-flex items-center">Jumpstart ::FaRocket::</Link>.
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
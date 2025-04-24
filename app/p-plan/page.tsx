"use client";

import React, { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAppContext } from "@/contexts/AppContext";
import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from "@/components/ui/tooltip";
// Иконки из fa6, проверенные по списку и использованию + добавим нужные
import {
  FaFileAlt, FaBullseye, FaUsers, FaBoxOpen, FaChartLine, FaAtom,
  FaMobileAlt, FaComments, FaPaintBrush, FaBrain, FaRocket, FaUserNinja,
  FaMoneyBillWave, FaTriangleExclamation, FaUserAstronaut, FaSignature, // Для "ты ниша"
  FaRecycle, FaCode, FaVideo, FaNewspaper, FaGithub, FaTelegram, FaCarCrash, // Кардан на месте
  FaRobot, FaGift, FaHandshake, FaBomb // Добавим еще огня
} from "react-icons/fa6";
import { debugLogger } from "@/lib/debugLogger";
import Link from "next/link";
import { cn } from "@/lib/utils";
import type { Database } from "@/types/database.types";

type DbUser = Database["public"]["Tables"]["users"]["Row"] | null;

// Карта компонентов иконок (проверить имена)
const iconComponents: { [key: string]: React.ElementType } = {
  FaFileAlt, FaBullseye, FaUsers, FaBoxOpen, FaChartLine, FaAtom,
  FaMobileAlt, FaComments, FaPaintBrush, FaBrain, FaRocket, FaUserNinja,
  FaMoneyBillWave, FaTriangleExclamation, FaUserAstronaut, FaSignature,
  FaRecycle, FaCode, FaVideo, FaNewspaper, FaGithub, FaTelegram, FaCarCrash,
  FaRobot, FaGift, FaHandshake, FaBomb
};

// Компонент RenderContent с исправленной логикой рендера иконок через маркеры
const RenderContent: React.FC<{ content: string }> = ({ content }) => {
  const paragraphs = content.split('\n');

  return (
    <>
      {paragraphs.map((paragraph, pIndex) => {
        // Regex to split by **bold** text and ::FaIconName className="..." :: markers
        const segments = paragraph.split(/(\*\*.*?\*\*)|(::Fa(\w+)(?:\s+className="([^"]*)")?\s*::)/g).filter(Boolean);

        return (
          <p key={pIndex} className="mb-2 last:mb-0">
            {segments.map((segment, sIndex) => {
              // Render **bold**
              if (segment.startsWith('**') && segment.endsWith('**')) {
                return <strong key={sIndex}>{segment.slice(2, -2)}</strong>;
              }
              // Render ::FaIconName className="..." :: marker
              const iconMarkerMatch = segment.match(/^::Fa(\w+)(?:\s+className="([^"]*)")?\s*::$/);
              if (iconMarkerMatch) {
                const [, iconName, className = ""] = iconMarkerMatch;
                const IconComp = iconComponents[`Fa${iconName}`];
                if (IconComp) {
                  const finalClassName = cn("inline-block align-middle mx-1", className || "w-4 h-4"); // Default size if not specified
                  return <IconComp key={sIndex} className={finalClassName} />;
                } else {
                  console.warn(`[RenderContent] Icon component "Fa${iconName}" not found.`);
                  // Return a placeholder or the raw marker text for debugging
                  return <span key={sIndex} className="text-red-500 font-mono" title={`Icon Fa${iconName} not found`}>[?]</span>;
                }
              }
              // Render plain text segment
              // Replace literal '->' with an arrow entity for potentially better rendering
              const renderedSegment = segment.replace(/->/g, '→');
              return <React.Fragment key={sIndex}>{renderedSegment}</React.Fragment>;
            })}
          </p>
        );
      })}
    </>
  );
};


// --- Функция генерации секций с учетом персонализации и НОВЫМ текстом ---
const getPlanSections = (dbUser: DbUser) => {
  // --- Персонализация (добавим больше деталей) ---
  const userName = dbUser?.first_name || 'Солдат'; // Более дерзкое обращение
  // Идентификация Санька (замени на реальный ID или username)
  const isSanek = dbUser?.username === 'Sanek' || dbUser?.user_id === 'your_sanek_user_id_here';
  const userHandle = isSanek ? '@SanekTheShaftWhisperer69' : (dbUser?.username ? `@${dbUser.username}` : 'Твой_Кибер_Ник'); // Сделаем ник Санька смешнее
  const userOriginStory = isSanek
     ? "наматывающий круги по Аду под названием 'Работа Водителем' ::FaCarCrash className='inline text-red-500'::"
     : "пытающийся взломать Матрицу стандартной жизни";
  const myExperience = "13+"; // Мой опыт
  const grantAmount = 350000;
  const grantAmountStr = `${grantAmount.toLocaleString('ru-RU')} руб.`;
  const focusTimeCostPerMonth = 35000; // Условная "стипендия" для фокуса
  const focusTimeBudget = grantAmount * 0.60;
  const timeInvestmentMonths = Math.floor(focusTimeBudget / focusTimeCostPerMonth); // ~6 месяцев фокуса
  const marketingBudget = Math.round(grantAmount * 0.25); // ~87.5к на поиск первых "лохов"... кхм, клиентов
  const devToolBudget = Math.round(grantAmount * 0.05); // ~17.5к на платные AI/хостинги, если прижмет
  const bufferBudget = grantAmount - focusTimeBudget - marketingBudget - devToolBudget; // ~35к "на пиво и непредвиденные жопы"

  return [
     {
      id: "resume",
      title: `1. Протокол "Кибер-Волк": Твой Личный Взлом, ${userName}!`, // Дерзкий заголовок
      icon: FaBomb, // Иконка бомбы - это взрыв!
      color: "text-brand-green",
      content: `Проект **"Кибер-Волк ${userName}"** – это не план, братан, это **детонатор**! Твой личный JUMPSTART ::FaRocket className="inline text-green-400"::, чтобы ты (${userHandle}) мог **свалить нах*й** с ${userOriginStory} и начать строить **свой собственный мир**. И да, управлять этим миром ты будешь **прямо с телефона** ::FaMobileAlt className="inline text-green-400"::!
      **Философия "Волка":** Скорость VIBE (<::FaRocket::>) + Мозги AI (<::FaAtom className="inline text-purple-400"::>) + Кибер-Броня (<::FaUserNinja className="inline text-gray-400"::>). Плюс **SelfDev** – мы не ищем работу, мы **СОЗДАЕМ СЕБЯ** и свою реальность.
      **Инструменты "Нищего Студента":** Юзаем **халяву** – Vercel, GitHub (<::FaGithub::>), Telegram (<::FaTelegram className="inline text-blue-400"::>). Платим только если ПРИЖМЕТ.
      **Грант (${grantAmountStr}) – Твой Стартовый Капитал от "Дяди Сэма" (меня):** Это не подачка. Это **инвестиция в ПЕРВОГО БОЙЦА моей стаи**. На что:
      - **ТВОЕ ВРЕМЯ** (~${timeInvestmentMonths} мес. фокуса ::FaUserAstronaut className="inline text-yellow-400"::): Чтобы ты мог **забить на всё** и погрузиться в VIBE, контент и обучение. Это твоя "зона безопасности".
      - **ПОИСК ПЕРВЫХ ДЕНЕГ** (~${marketingBudget.toLocaleString('ru-RU')} руб.): Найти тех, кто готов платить за твою новую суперсилу. Искать "розовые чеки" ::FaMoneyBillWave className="inline text-pink-400"::.
      - **ПРОКАЧКА ТВОИХ МОЗГОВ** (~${devToolBudget.toLocaleString('ru-RU')} руб.): Курсы, AI-инструменты. Ты должен стать Нео, а не Агентом Смитом.
      - **"ЗАПАСНОЙ КАРДАН"** (~${bufferBudget.toLocaleString('ru-RU')} руб.): На случай ::FaCarCrash:: или если халява кончится.
      **Суть:** Мы строим **не сайт, а МАШИНУ ПО ЗАРАБАТЫВАНИЮ ДЕНЕГ И СВОБОДЫ**, где главный мотор – **ТЫ**.`
    },
     {
      id: "description",
      title: "2. Твой Кибер-Арсенал: Управляй с Дивана",
      icon: FaUserAstronaut, // Ты - капитан корабля
      color: "text-brand-cyan",
      content: `**Центр Управления:** Твой Телефон ::FaMobileAlt className="inline text-cyan-400":: + Ноут (если есть).
      **1. Личный Сайт/Блог (Бесплатно):** Твоя витрина. Кто ты, что умеешь, чем можешь помочь. Истории про кардан? Залетают на ура! (Next.js/Vercel). Обновляется через GitHub ::FaGithub:: ботом из Телеги ::FaTelegram::.
      **2. Telegram-Канал/Чат (<::FaTelegram className="inline text-blue-400"::>):** Твой штаб. Сбор "стаи" ::FaUsers::, анонсы, общение без цензуры, прием заказов.
      **3. GitHub (<::FaGithub::>):** Твой "Кибер-Сундук". Код, шаблоны (Jumpstart Kit ::FaBoxOpen:: – подари другу!), автоматизация VIBE. Место, где ты **демонстрируешь силу**.
      **4. AI-Трансмутатор (<::FaAtom className="inline text-purple-400"::> + <::FaRecycle className="inline text-yellow-400"::>):** Твой личный алхимик. Записал голосовое -> получил 5 постов + идею для видео. Написал статью -> получил скрипт + картинки. **Экономит 90% времени** на контенте.
      **УТП (Чем ты круче других):** Ты – **ЖИВОЙ ПРИМЕР** (${userName}, ${userHandle}). Ты прошел путь из жопы ${userOriginStory}. Ты используешь **партизанский AI** ::FaRobot:: на **доступных** инструментах. Ты – **честный**, ты – **свой**. Ты не впариваешь, ты **помогаешь**.`
    },
    {
      id: "market",
      title: "3. Твоя Охота: Люди и Их \"Карданы\"",
      icon: FaUsers, // Люди - твоя цель
      color: "text-brand-pink",
      content: `Рынок РФ? Сейчас это поле чудес после ядерной войны. Старые игроки сдохли, новым нужны **быстрые и дешевые** решения. AI – это золотая лихорадка.
      **Твоя Добыча (ЦА):** Такие же, как ты вчера, ${userName}. Кто за*бался ::FaPoo::. Разрабы без AI, фрилансеры на подсосе, малый бизнес, который хочет автоматизацию, но боится Илона Маска. Те, кто ищет **выход из Матрицы** ${userOriginStory}.
      **Хищники (Конкуренты):** Скучные "эксперты", пыльные онлайн-школы, инфоцыгане с арендованными Ламбо.
      **Твоя Маскировка (Отстройка):**
      - **Личный Бренд (${userName}):** Ты – не безликий логотип. Твоя история ::FaSignature:: – твой главный козырь.
      - **VIBE:** Скорость х10, AI-фишки, безопасность по умолчанию. Мы не строим говно.
      - **SelfDev:** Мы качаем не только скиллы, но и **мозги** ::FaBrain::. Помогаем найти **СВОЙ** путь.
      - **AI-Трансмутатор (<::FaAtom::>):** Наш секретный соус. Делаем контент-шторм из ничего.
      - **Честность и Доступность:** Никаких "успешных успехов". Начинаем с малого, показываем всё как есть.`
    },
    {
      id: "product",
      title: "4. Твой Товар: Ценность Вместо Воздуха",
      icon: FaGift, // Подарок - сначала ценность
      color: "text-brand-orange",
      content: `Принцип Волка: Сначала покажи, что можешь принести **добычу** ::FaGift className="inline text-orange-400"::, потом говори о доле.
      **Приманка (Бесплатно, строим доверие):**
      - **Контент (<::FaNewspaper::>):** Как ты сам выбрался/выбираешься. Кейсы, ошибки ("Как я снова сломал кардан, но уже цифровой"). Лайфхаки VIBE/AI. AI (<::FaAtom::>) пишет 80% за тебя.
      - **Код (<::FaCode::>):** Jumpstart Kit (<::FaBoxOpen::>), полезные боты/скрипты на GitHub (<::FaGithub::>). Дай людям поиграться.
      - **Переводы/Саммари (<::FaBrain::>):** Умные мысли западных гуру (Purpose&Profit) – на понятном пацанском языке.
      **Твоя "Ручка" (Платно, когда доверяют):**
      - **"Разбор Полетов" с ${userName}:** Личная консультация/менторство. Помогаешь внедрить VIBE, AI, найти свой путь (Старт: 3-5к руб/час).
      - **Интенсив "AI-Коммандос":** 1-2 дня практики с AI на реальных задачах (Старт: 5-10к руб/чел).
      - **Jumpstart Kit "Турбо":** Твои улучшенные шаблоны (Старт: 1-3к руб/шт).
      - **(Мечта) Клуб "Кибер-Волков":** Закрытое сообщество, ранний доступ, личная поддержка.`
    },
    {
      id: "marketing",
      title: "5. Засветись: Вайб Н*хуй, Маркетинг Всё!",
      icon: FaBullseye, // Точно в аудиторию
      color: "text-neon-lime",
      content: `- <::FaPaintBrush className="inline text-neon-lime"::> **Контент Решает:** Забудь про "продающий контент". Делай то, что **тебя штырит**! Делись процессом, факапами, победами. AI (<::FaAtom className="inline text-purple-400"::>) сделает из этого 100500 постов/видео/картинок. Главное – **ЧЕСТНОСТЬ и ПОЛЬЗА**. (Платформы: TG, VK, YouTube?).
      - <::FaComments className="inline text-neon-lime"::> **Строй Свою Стаю (<::FaTelegram className="inline text-blue-400"::>):** Отвечай на комменты, помогай в чате, будь **своим парнем/девчонкой**. Лояльность важнее охватов. Люди покупают у тех, кому доверяют.
      - <::FaGithub className="inline text-neon-lime"::> **GitHub как Приманка:** Полезный код привлекает умных людей.
      - **Коллабы (<::FaHandshake::>):** Мути движ с другими "волками".
      **Ракетное Топливо (Грант ~${marketingBudget.toLocaleString('ru-RU')} руб.):**
      - **Таргет:** Найти тех, у кого "болит" прямо сейчас.
      - **Посевы:** Засветиться в правильных местах.
      - **Тесты:** Не бойся пробовать и сливать немного бабла на эксперименты!

      [Воронка Волка: Контент (Честно+AI) -> Охват (Таргет/Сарафан) -> Стая (TG) -> Бабки (Доверие -> Продажа)]`
    },
     {
      id: "operations",
      title: "6. Как Всё Делать: Телефон + AI = Магия",
      icon: FaMobileAlt, // Телефон - главный
      color: "text-brand-cyan",
      content: `**Контент (<::FaMobileAlt className="inline text-cyan-400"::> + <::FaAtom::>):** ТЕЛЕФОН! Снял видос -> CapCut смонтировал -> AI (<::FaAtom::>) написал текст, сделал обложку. Наговорил идею -> AI превратил в статью. Максимум автоматизации!
      **Платформа (0 руб):** Сайт на Next.js/Vercel. Обновления – через GitHub/TG-бот (<::FaGithub::>). База данных? Supabase (0 руб), если реально нужна.
      **Работа с Клиентами:** Telegram/VK (<::FaTelegram className="inline text-blue-400"::>) для всего! Звонки, переписка, оплата (через бота).
      **Принцип:** **НЕ УСЛОЖНЯЙ!** Фокус на создании ценности, а не на выборе идеального шрифта.`
    },
    {
      id: "org",
      title: "7. Твоя Роль: От Водилы до Кибер-Лидера",
      icon: FaUserNinja, // Из грязи в князи
      color: "text-gray-400",
      content: `**Статус:** Самозанятый (НПД). Просто и легально.
      **Ты (${userName}, ${userHandle}):** <::FaUserAstronaut className="inline text-gray-300"::> Ты – **альфа и омега**. Основатель, идеолог, первый продажник, главный по VIBE'у. **НИКАКИХ НАЕМНЫХ СОТРУДНИКОВ** на старте! Твоя команда – это **ТЫ + AI <::FaRobot::>** + пара фрилансеров на подхвате (если прижмет). **Масштабируй СЕБЯ**, а не штат.`
    },
    {
      id: "finance",
      title: `8. Бабки: ${grantAmountStr} – Твой Шанс Не Сдохнуть`,
      icon: FaMoneyBillWave,
      color: "text-brand-yellow",
      content: `Грант – это **подушка безопасности**, чтобы ты мог **прыгнуть**.
      - **<::FaUserAstronaut className="inline text-yellow-400"::> 1. Твое ВРЕМЯ (~${focusTimeBudget.toLocaleString('ru-RU')} руб.):** Самое ценное! Чтобы ты (${userName}) мог **забить на подработки** и ~${timeInvestmentMonths} мес. **вкалывать над проектом**: учиться VIBE, пилить контент, строить комьюнити. Это **инвестиция в твой мозг и твой бренд**!
      - **<::FaBullseye className="inline text-yellow-400"::> 2. Маркетинг & "Первая Кровь" (~${marketingBudget.toLocaleString('ru-RU')} руб.):** Тесты, таргет, посевы. Найти **первых платящих клиентов** – это критично для уверенности и кэшфлоу.
      - **<::FaBrain className="inline text-yellow-400"::> 3. Апгрейд Твоих Мозгов (~${devToolBudget.toLocaleString('ru-RU')} руб.):** Платные AI (если Free Tier мало), курсы по продажам/маркетингу. Ты должен быть **на шаг впереди**.
      - **<::FaTriangleExclamation className="inline text-yellow-400"::> 4. "Заначка" (~${bufferBudget.toLocaleString('ru-RU')} руб.):** На случай факапов или если Vercel решит стать платным.
      **Цель по Доходам (1 год):** Выйти на **стабильные 80к+ руб/мес** чистыми. Грант **убирает страх нищеты** и позволяет **действовать смелее**.

      [Диаграмма Гранта: ТЫ (60%), Маркетинг (25%), Твой Рост (5%), Заначка (10%)]`
    },
     {
      id: "risks",
      title: "9. Потенциальные Жопы (и План Б)",
      icon: FaCarCrash, // Символ жопы
      color: "text-red-500",
      content: `**Халява Кончится:** Юзаем "Заначку" (<::FaTriangleExclamation::>), ищем опенсорс, **быстро монетизируемся**, чтобы платить за инструменты.
      **Ты За*бался/Перегорел (${userName}):** AI (<::FaAtom::>) забирает рутину. Комьюнити (<::FaComments::>) поддерживает. Фокус на **драйве** (SelfDev!). Если совсем плохо – делаем паузу, VIBE позволяет.
      **Идея – Говно:** **AI-Валидация** (<::FaBullseye::>) ДО начала! Убиваем дохлых лошадей быстро. VIBE = Гибкость. Меняем нишу/продукт за неделю.
      **Форс-мажор ("Кардан 3.0" <::FaCarCrash className="inline text-red-500"::>):** Жизнь бьет ключом. Навыки VIBE/AI/SelfDev – это твой **несгораемый актив**. Сможешь быстро найти удаленку/фриланс, если все пойдет по п*зде.`
    },
    {
      id: "conclusion",
      title: `10. Финал: ${userName}, Время Стать Волком!`,
      icon: FaUserNinja, // Иконка волка/ниндзя
      color: "text-brand-purple",
      content: `Проект **"Кибер-Волк ${userName}"** – это твой **билет из Матрицы**. Используй свой **мозг** (<::FaBrain::>), свою **историю**, поддержку **стаи** (<::FaUsers::>) и **невъеб*нную силу AI** (<::FaAtom::>). Грант – это **первая ступень ракеты**. Дальше – твой **VIBE**, твоя **смелость**, твои **действия**.
      Хватит думать, братан. **Пора ХЕРАЧИТЬ!** ::FaRocket className="inline text-brand-green"::`
    },
  ];
};


// --- Компонент Страницы (с обновленными заголовками и RenderContent) ---
export default function PPlanPage() {
  const { dbUser, isLoading, error } = useAppContext();
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => { setIsMounted(true); }, []);

  const planSections = useMemo(() => getPlanSections(dbUser), [dbUser]);
  const pageTitleName = useMemo(() => dbUser?.first_name || "Кибер-Волк", [dbUser]);
  const greetingName = useMemo(() => dbUser?.first_name || 'Боец', [dbUser]); // Для приветствия

  // Лоадер и ошибка без изменений
  if (!isMounted || isLoading) { return ( <div className="flex justify-center items-center min-h-screen pt-20 bg-gradient-to-br from-gray-900 via-black to-gray-800"> <p className="text-brand-cyan animate-pulse text-xl font-mono">Загрузка плана Кибер-Волка...</p> </div> ); }
  if (error) { return ( <div className="flex flex-col justify-center items-center min-h-screen pt-20 bg-gradient-to-br from-gray-900 via-black to-red-900/50"> <FaTriangleExclamation className="text-6xl text-red-500 mb-4"/> <p className="text-red-400 text-xl font-mono">Ошибка загрузки плана</p> <p className="text-red-500 mt-2 text-sm max-w-md text-center">{error.message}</p> <p className="text-gray-400 mt-4 text-xs">Перезагрузись.</p> </div> ); }

  const getBorderClass = (textColorClass: string): string => cn(textColorClass.replace('text-', 'border-'), 'border-gray-500/30'); // Сделаем границу чуть менее заметной

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
              <FaUserNinja className="text-6xl text-brand-purple mx-auto mb-4 animate-pulse" />
              <CardTitle className="text-3xl md:text-5xl font-bold text-brand-purple cyber-text glitch uppercase tracking-wider" data-text={`КИБЕР-ВОЛК: ПЛАН ЗАХВАТА МИРА`}>
                 КИБЕР-ВОЛК: ПЛАН ЗАХВАТА МИРА
              </CardTitle>
              {/* Подзаголовок */}
              <p className="text-md md:text-lg text-gray-300 mt-4 font-mono max-w-2xl mx-auto">
                 Твой План: От <span className="text-red-500">{greetingName === 'Санек' ? 'Сломанного Кардана' : 'Нуля'}</span> ::FaCarCrash className="inline text-red-500":: к <span className="text-neon-lime">AI-Бабкам</span> ::FaMoneyBillWave className="inline text-neon-lime"::. Грант {getPlanSections(dbUser)[7].content.includes('350 000') ? '350к' : 'XX к'}. <span className="text-xs opacity-70">(Лично для {greetingName})</span>
              </p>
            </CardHeader>
            {/* Секции Плана */}
            <CardContent className="space-y-8 p-4 md:p-8"> {/* Уменьшил space-y */}
              {planSections.map((section, index) => (
                   <details key={section.id} className={cn(
                       "group border-l-4 pl-4 py-3 rounded-r-md transition-all duration-300 ease-in-out open:bg-purple-900/10 open:shadow-inner",
                       getBorderClass(section.color)
                   )} open={index < 3 || section.id === 'finance'}> {/* Первые 3 и финансы открыты */}
                     <summary className={cn("text-xl md:text-2xl font-semibold cursor-pointer list-none flex items-center hover:opacity-80 transition-opacity", section.color)}>
                       {/* Проверяем наличие иконки перед рендером */}
                       {iconComponents[section.icon.name] && <section.icon className="mr-3 flex-shrink-0 w-5 h-5 group-open:animate-pulse" />}
                       {section.title}
                     </summary>
                     <div className="mt-3 text-gray-300 text-base leading-relaxed space-y-3 pl-2 pr-1"> {/* Уменьшил отступ */}
                       <RenderContent content={section.content} />
                       {/* Визуализации */}
                       {section.id === 'finance' && ( <div className="mt-4 p-3 border border-dashed border-gray-600 rounded-md bg-gray-800/40"> <p className="text-sm text-gray-400 italic text-center">[Диаграмма Гранта: Ты (60%), Маркетинг (25%), Твой Рост (5%), Заначка (10%)]</p> </div> )}
                       {section.id === 'marketing' && ( <div className="mt-4 p-3 border border-dashed border-gray-600 rounded-md bg-gray-800/40"> <p className="text-sm text-gray-400 italic text-center">[Воронка Волка: Контент → Трафик → Стая → Бабки]</p> </div> )}
                     </div>
                   </details>
                ))}
              {/* Заключение */}
              <section className="text-center pt-8 border-t border-brand-purple/20 mt-10">
                 <p className="text-lg text-gray-400 italic">
                   Это твой **стартовый протокол**, {greetingName}. Не инструкция, а **карта сокровищ**. Дальше – импровизируй, адаптируй, **VIBE**!
                 </p>
                 <p className="mt-6 text-gray-300 text-lg">
                   Вопросы? Страхи? Идеи? <span className="text-neon-lime font-bold">ПИШИ МНЕ</span> в <a href="https://t.me/salavey13" target="_blank" rel="noopener noreferrer" className="text-brand-blue hover:underline font-semibold inline-flex items-center">Телегу ::FaTelegram::</a> или стучись через форму <Link href="/jumpstart#jumpstart-form" className="text-neon-lime hover:underline font-semibold inline-flex items-center">Jumpstart ::FaRocket::</Link>.
                 </p>
                 <p className="mt-4 text-brand-purple text-xl font-bold uppercase tracking-wider animate-pulse">
                   ПОГНАЛИ, НАХ*Й!
                 </p>
              </section>

            </CardContent>
          </Card>
        </div>
      </TooltipProvider>
    </div>
  );
}
"use client";

import React, { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAppContext } from "@/contexts/AppContext";
import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from "@/components/ui/tooltip";
// УБЕДИСЬ, ЧТО ВСЕ ЭТИ ИКОНКИ ДЕЙСТВИТЕЛЬНО ИСПОЛЬЗУЮТСЯ ВНУТРИ СТРОК content
import {
  FaFileAlt, FaBullseye, FaUsers, FaBoxOpen, FaChartLine, FaAtom,
  FaMobileAlt, FaComments, FaPaintBrush, FaBrain, FaRocket, FaUserNinja,
  FaMoneyBill, FaTriangleExclamation, FaRecycle,
  FaCode, FaVideo, FaNewspaper, FaGithub, FaTelegram
  // Добавь сюда ЛЮБЫЕ другие Fa иконки, если они есть в тексте!
} from "react-icons/fa6";
import { debugLogger } from "@/lib/debugLogger";
import Link from "next/link";
import { cn } from "@/lib/utils";
import type { Database } from "@/types/database.types";

type DbUser = Database["public"]["Tables"]["users"]["Row"] | null;

// Карта компонентов иконок - УБЕДИСЬ, что здесь ЕСТЬ ВСЕ импортированные выше иконки
const iconComponents: { [key: string]: React.ElementType } = {
  FaFileAlt, FaBullseye, FaUsers, FaBoxOpen, FaChartLine, FaAtom,
  FaMobileAlt, FaComments, FaPaintBrush, FaBrain, FaRocket, FaUserNinja,
  FaMoneyBill, FaTriangleExclamation, FaRecycle,
  FaCode, FaVideo, FaNewspaper, FaGithub, FaTelegram
  // Добавь сюда соответствия для ЛЮБЫХ других иконок
};

// Функция getPlanSections остается без изменений
const getPlanSections = (dbUser: DbUser) => {
  const userName = dbUser?.first_name || 'Viberider';
  const userHandle = dbUser?.username ? `@${dbUser.username}` : 'Самозанятый Эксперт';
  const userExperience = dbUser?.metadata?.experienceYears || "13+";

  // УБЕДИСЬ, что все строки <Fa...> здесь соответствуют импортам и карте iconComponents
  return [
     {
      id: "resume",
      title: "1. Резюме проекта",
      icon: FaFileAlt, // <-- Проверяем, что иконка валидна
      color: "text-brand-blue",
      content: `Проект **"Кибер-Наставник ${userName}"** – создание и развитие персонального бренда и образовательной онлайн-платформы (блога), управляемой преимущественно **с мобильных устройств**.
      Цель – предоставление уникального контента, менторских услуг и практических инструментов на базе методологии **VIBE** (AI-ассистированная разработка, быстрая валидация идей, безопасность) для IT-специалистов и начинающих предпринимателей в РФ.
      Проект использует **максимально доступные и бесплатные технологии** (Vercel, Telegram, free-tier AI), фокусируя инвестиции гранта на **нематериальных активах:** создании контента, построении сообщества, маркетинге и **твоем профессиональном развитии, ${userName}**.
      **Ключевая идея:** Ценность создается **экспертизой (${userExperience} лет у меня, твой путь уникален!), уникальным подходом (VIBE, SelfDev), скоростью и умением использовать доступные инструменты**, включая AI как **трансмутатор информации** (<FaAtom className="inline text-purple-400"/>). Грант позволит тебе (${userName}) полностью посвятить себя проекту.` // <-- Проверяем FaAtom
    },
     {
      id: "description",
      title: "2. Описание проекта",
      icon: FaRocket, // <-- Валидна
      color: "text-brand-green",
      content: `**Формат:** Мобильно-ориентированный блог/платформа:
      - **Сайт (Next.js/Vercel - Free):** Легковесный, быстрый, mobile-first. Статьи, гайды, VIBE/SelfDev. Управление через GitHub/телефон.
      - **Telegram:** Основной хаб (<FaTelegram className="inline text-blue-400"/>). Анонсы, инсайты, общение, комьюнити.
      - **GitHub (Free):** Демо-репы (<FaGithub className="inline"/>), шаблоны (Jumpstart), VIBE-воркфлоу.
      - **Видео (Телефон):** Короткие клипы (<FaVideo className="inline text-red-500"/>), прямые эфиры. Монтаж на телефоне (CapCut).
      - **AI-Трансмутация (<FaRecycle className="inline text-yellow-400"/>):** Основа! Одно видео/статья -> десятки постов, клипов, идей с помощью AI. <FaAtom className="inline text-purple-400"/> Превращаем любой контент в любой другой!
      **УТП:** Практический AI на доступных инструментах. VIBE (AI + Валидация + Безопасность). SelfDev & Purpose/Profit. Твой личный бренд (${userName}, ${userHandle}). Демонстрация эффективности **"партизанского" подхода**.` // <-- Проверяем FaTelegram, FaGithub, FaVideo, FaRecycle, FaAtom
    },
    {
      id: "market",
      title: "3. Анализ рынка и ЦА",
      icon: FaUsers, // <-- Валидна
      color: "text-brand-pink",
      content: `Рынок IT-образования в РФ растет. Спрос на AI, WebDev, VIBE – высокий. Импортозамещение = нужны кадры.
      **ЦА:** Разрабы (TS/React/Next), тимлиды, фрилансеры, соло-предприниматели, студенты IT. Те, кто хочет оседлать AI-волну.
      **Конкуренты:** Блогеры, школы. Отстройка: **VIBE**, **SelfDev**, **AI-трансмутация**, **личный опыт**, фокус на **практике** и **доступности**, **твоя аутентичность, ${userName}**.` // <-- Здесь нет <Fa...>
    },
    {
      id: "product",
      title: "4. Продукт/Услуга",
      icon: FaBoxOpen, // <-- Валидна
      color: "text-brand-orange",
      content: `**Бесплатно (Воронка):**
      - Контент (<FaNewspaper className="inline"/>): Статьи, видео, заметки (сайт, TG, VK). AI помогает генерить и адаптировать.
      - Код (<FaCode className="inline"/>): Примеры, шаблоны на GitHub (<FaGithub className="inline"/>).
      - Переводы/Адаптации (<FaBrain className="inline"/>): Ключевые идеи (Purpose&Profit, AI&Work).
      **Платно (Монетизация):**
      - Менторство/Консультации (${userName}): Внедрение VIBE, AI, SelfDev (Цена: X руб/час).
      - Воркшопы/Интенсивы: Практика AI, VIBE, безопасность (Цена: Y руб/участника).
      - Шаблоны/Jumpstart: Готовые стартеры проектов (Цена: Z руб/шаблон).
      - (Перспектива) Подписка: Эксклюзив, комьюнити, ранний доступ.` // <-- Проверяем FaNewspaper, FaCode, FaGithub, FaBrain
    },
    {
      id: "marketing",
      title: "5. Маркетинг и Продвижение",
      icon: FaBullseye, // <-- Валидна
      color: "text-neon-lime",
      content: `**Органика (Фундамент):**
      - <FaPaintBrush className="inline text-neon-lime"/> **Контент-Маркетинг:** Часто, ценно, вирусно (TG, VK, сайт). AI (<FaAtom className="inline"/>) помогает с трансмутацией и генерацией!
      - <FaComments className="inline text-neon-lime"/> **Комьюнити:** Лояльность в Telegram (<FaTelegram className="inline text-blue-400"/>) через общение.
      - <FaGithub className="inline text-neon-lime"/> **GitHub:** Привлечение разрабов кодом.
      - **Нетворкинг:** Коллабы, чаты.
      **Платное (Ускорение - Грант):**
      - **Таргет:** VK, Telegram Ads.
      - **Посевы:** Реклама в TG-каналах.
      - **Бустинг:** Продвижение топ-контента.

      [Здесь могла бы быть схема маркетинговой воронки: Контент (AI Трансмут.) -> Соцсети/SEO -> Комьюнити -> Платные Услуги]` // <-- Проверяем FaPaintBrush, FaAtom, FaComments, FaTelegram, FaGithub
    },
    {
      id: "operations",
      title: "6. План реализации",
      icon: FaMobileAlt, // <-- Валидна
      color: "text-brand-cyan",
      content: `**Создание Контента (<FaMobileAlt className="inline"/>):** Телефон - всё! Съемка, монтаж (CapCut), текст (голос/клава), AI для идей/черновиков/трансмутации (Free/Plus).
      **Платформа:** Сайт на Next.js/Vercel (Free). Управление с GitHub/телефона (<FaGithub className="inline"/>, <FaMobileAlt className="inline"/>). Supabase (Free) для бэка (если надо).
      **Услуги:** Консультации/воркшопы через TG/VK видеозвонки (<FaTelegram className="inline text-blue-400"/>).
      **Тех. Стек:** ТЕЛЕФОН, Next.js, Vercel, GitHub, Telegram, Supabase (Free), AI (Free/Plus), CapCut, Canva (Free/Pro).` // <-- Проверяем FaMobileAlt, FaGithub, FaTelegram
    },
    {
      id: "org",
      title: "7. Организационный план",
      icon: FaUserNinja, // <-- Валидна
      color: "text-gray-400",
      content: `**Форма:** Самозанятый (НПД). Регистрация через "Мой Налог".
      **Исполнитель:** ${userName} (${userHandle}) – все компетенции у тебя (или ты их быстро получишь по VIBE!). Ты - ядро проекта.` // <-- Нет <Fa...>
    },
    {
      id: "finance",
      title: "8. Финансовый план",
      icon: FaMoneyBill, // <-- Валидна
      color: "text-brand-yellow",
      content: `**Грант: 350 000 руб. Расходы:**
      - **<FaChartLine className="inline text-yellow-400"/> 1. Маркетинг и Рост (200 000 руб.):**
          - Таргет VK/TG Ads: 120 000 руб.
          - Посевы TG: 50 000 руб.
          - Бустинг/Эксперименты: 30 000 руб.
      - **<FaPaintBrush className="inline text-yellow-400"/> 2. Контент & Нематер. Активы (100 000 руб.):**
          - **Фокус-Время ${userName}**: Обеспечение твоей работы над проектом (~6-8 мес): 80 000 руб. (Инвестиция в твой контент и IP!).
          - Стоки (музыка/клипы, если надо): 10 000 руб.
          - Графика (лого/шаблоны, если надо): 10 000 руб.
      - **<FaBrain className="inline text-yellow-400"/> 3. Проф. Развитие ${userName} (30 000 руб.):**
          - Курсы/материалы (AI, Маркетинг): 20 000 руб.
          - Доступ к research/статьям: 5 000 руб.
          - Онлайн-конференции/воркшопы: 5 000 руб.
      - **<FaTriangleExclamation className="inline text-yellow-400"/> 4. Буфер (20 000 руб.):**
          - Резерв на платные AI-инструменты/сервисы при росте или смене Free Tier.
      **Доходы (Прогноз 12 мес.):** ~230 000 - 420 000 руб. (Менторство, воркшопы, шаблоны).
      **Рентабельность:** Выход на опер. прибыль за 6-9 мес. Грант = **ускорение роста** и **создание IP**.

      [Здесь могла бы быть круговая диаграмма распределения гранта: Маркетинг (~57%), Контент/Время (~29%), Развитие (~8.5%), Буфер (~5.5%)]` // <-- Проверяем FaChartLine, FaPaintBrush, FaBrain, FaTriangleExclamation
    },
    {
      id: "risks",
      title: "9. Анализ рисков",
      icon: FaTriangleExclamation, // <-- Валидна
      color: "text-red-500",
      content: `**Зависимость от Free Tiers:** Риск лимитов/смены условий AI/Хостинга. Митигация: Мониторинг, оптимизация, буфер (<FaTriangleExclamation className="inline"/>), готовность платить из дохода.
      **"Телефонное" качество:** Может уступать студии. Митигация: Фокус на **ценности контента**, мобильный монтаж, **аутентичность ${userName}**.
      **Выгорание ${userName}:** Работа соло. Митигация: Планирование, AI-автоматизация (<FaAtom className="inline"/>), отдых, комьюнити.
      **Конкуренция/Спрос:** Митигация: УТП (VIBE, AI-трансмут.), комьюнити (<FaComments className="inline"/>), сильный бренд ${userName}.` // <-- Проверяем FaTriangleExclamation, FaAtom, FaComments
    },
    {
      id: "conclusion",
      title: "10. Заключение",
      icon: FaBrain, // <-- Валидна
      color: "text-brand-purple",
      content: `Проект **"Кибер-Наставник ${userName}"** – это **инновационный и ресурсоэффективный VIBE**. Ставка на **твою экспертизу (${userName}), контент (<FaNewspaper className="inline"/>), комьюнити (<FaUsers className="inline"/>) и умный маркетинг (<FaBullseye className="inline"/>)**, а не на железо. Грант = **инвестиция в рост, контент и твое развитие**. Это пример доступного IT-предпринимательства в РФ, усиленного AI (<FaAtom className="inline"/>).` // <-- Проверяем FaNewspaper, FaUsers, FaBullseye, FaAtom
    },
  ];
};

// Компонент RenderContent остается без изменений - он уже должен быть устойчив к undefined иконкам
const RenderContent: React.FC<{ content: string }> = ({ content }) => {
  const paragraphs = content.split('\n');

  return (
    <>
      {paragraphs.map((paragraph, pIndex) => {
        const segments = paragraph.split(/(\*\*.*?\*\*|<Fa\w+\s*.*?\/?>)/g).filter(Boolean);

        return (
          <p key={pIndex} className="mb-2 last:mb-0">
            {segments.map((segment, sIndex) => {
              if (segment.startsWith('**') && segment.endsWith('**')) {
                return <strong key={sIndex}>{segment.slice(2, -2)}</strong>;
              }
              const iconMatch = segment.match(/<Fa(\w+)\s*(?:className="([^"]*)")?\s*\/?>/);
              if (iconMatch) {
                const [, iconName, className = ""] = iconMatch;
                const IconComp = iconComponents[`Fa${iconName}`]; // Поиск в карте
                if (IconComp) { // <-- Проверка на undefined
                  // Используем существующие стили Tailwind, align-middle для выравнивания
                  const finalClassName = cn("inline-block align-middle mx-1", className || "w-4 h-4");
                  return <IconComp key={sIndex} className={finalClassName} />;
                } else {
                  // Рендерим плейсхолдер, если иконка не найдена (НЕ должно вызывать ошибку undefined)
                  console.warn(`[RenderContent] Icon component "Fa${iconName}" not found in iconComponents map.`);
                  return <span key={sIndex} className="text-red-500 font-mono">[? Fa{iconName}]</span>;
                }
              }
              return <React.Fragment key={sIndex}>{segment}</React.Fragment>;
            })}
          </p>
        );
      })}
    </>
  );
};


// --- Компонент Страницы ---
export default function PPlanPage() {
  const { dbUser, isLoading, error } = useAppContext();
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  // useMemo для вычисления данных, зависящих от dbUser
  const planSections = useMemo(() => {
      debugLogger.log("[PPlanPage] Recalculating planSections, dbUser:", dbUser ? dbUser.user_id : 'null');
      return getPlanSections(dbUser);
  }, [dbUser]);

  const pageTitleName = useMemo(() => dbUser?.first_name || "Кибер-Наставник", [dbUser]);
  const greetingName = useMemo(() => dbUser?.first_name || 'Viberider', [dbUser]);

  // Основной рендер зависит от isMounted И !isLoading
  if (!isMounted || isLoading) {
    return (
      <div className="flex justify-center items-center min-h-screen pt-20 bg-gradient-to-br from-gray-900 via-black to-gray-800">
        <p className="text-brand-cyan animate-pulse text-xl font-mono">VIBE план загружается...</p>
      </div>
    );
  }

   // Показываем ошибку, если она есть
   if (error) {
     return (
       <div className="flex flex-col justify-center items-center min-h-screen pt-20 bg-gradient-to-br from-gray-900 via-black to-red-900/50">
         <FaTriangleExclamation className="text-6xl text-red-500 mb-4"/>
         <p className="text-red-400 text-xl font-mono">Ошибка загрузки плана</p>
         <p className="text-red-500 mt-2 text-sm max-w-md text-center">{error.message}</p>
         <p className="text-gray-400 mt-4 text-xs">Попробуйте перезагрузить приложение.</p>
       </div>
     );
   }

  // *** ИЗМЕНЕНИЕ: Определяем классы границы динамически ***
  const getBorderClass = (textColorClass: string): string => {
    // Просто заменяем 'text-' на 'border-'
    // Это сработает, если цвета ('brand-blue', 'brand-green'...) определены в tailwind.config.js
    // и Tailwind может автоматически применять их к border-color.
    const borderColor = textColorClass.replace('text-', 'border-');
    // Добавляем fallback на случай, если класс не сгенерируется
    return cn(borderColor, 'border-gray-500'); // fallback border
  };

  // Рендерим основной контент
  return (
    // Используем существующие классы градиента и текста из globals.css / tailwind config
    <div className="relative min-h-screen overflow-hidden pt-20 pb-10 bg-gradient-to-br from-dark-bg via-black to-purple-900/30 text-light-text">
       {/* Используем цвет из конфига для сетки */}
       <div
         className="absolute inset-0 bg-repeat opacity-[0.04] z-0"
         style={{
           backgroundImage: `linear-gradient(to right, hsl(var(--brand-purple-hsl, 278, 100%, 50%)) 1px, transparent 1px),
                             linear-gradient(to bottom, hsl(var(--brand-purple-hsl, 278, 100%, 50%)) 1px, transparent 1px)`, // Предполагая HSL переменную для brand-purple
           backgroundSize: '60px 60px',
         }}
       ></div>

      <TooltipProvider delayDuration={150}>
        <div className="relative z-10 container mx-auto px-4">
          {/* Используем существующие классы для карточки и текста */}
          <Card className="max-w-4xl mx-auto bg-dark-card/85 backdrop-blur-lg text-light-text rounded-2xl border-2 border-brand-purple/40 shadow-[0_0_30px_rgba(157,0,255,0.3)]">
            <CardHeader className="text-center border-b border-brand-purple/20 pb-5">
              {/* Убедимся, что иконка использует цвет Tailwind */}
              <FaUserNinja className="text-6xl text-brand-purple mx-auto mb-4 animate-pulse" />
              {/* Используем существующие классы cyber-text и glitch */}
              <CardTitle className="text-3xl md:text-5xl font-bold text-brand-purple cyber-text glitch uppercase tracking-wider" data-text={`Бизнес-План: ${pageTitleName}`}>
                Бизнес-План: {pageTitleName}
              </CardTitle>
              <p className="text-md md:text-lg text-gray-300 mt-4 font-mono max-w-2xl mx-auto">
                Версия "Кибер-Партизан": Рост через <span className="text-neon-lime">контент</span>, <span className="text-brand-cyan">комьюнити</span> и <span className="text-brand-purple">AI</span> на минималках. Грант 350к. <span className="text-xs opacity-70">(Адаптировано для {greetingName})</span>
              </p>
            </CardHeader>

            <CardContent className="space-y-10 p-4 md:p-8">
              {planSections.map((section) => {
                const IconComponent = section.icon;
                // *** ИЗМЕНЕНИЕ: Используем getBorderClass для установки Tailwind класса границы ***
                const borderClass = getBorderClass(section.color);

                return (
                   // Применяем класс границы динамически
                   <details key={section.id} className={cn(
                       "group border-l-4 pl-4 rounded-r-md transition-all duration-300 ease-in-out open:bg-purple-900/10 open:pb-4 open:shadow-inner",
                       borderClass // Добавляем вычисленный класс границы
                   )}>
                     {/* Используем Tailwind класс для цвета текста */}
                     <summary className={cn("text-2xl font-semibold cursor-pointer list-none flex items-center hover:opacity-80 transition-opacity", section.color)}>
                       {/* Убедимся, что иконка использует цвет Tailwind */}
                       <IconComponent className="mr-3 flex-shrink-0 group-open:animate-pulse" /> {section.title}
                     </summary>
                     <div className="mt-4 text-gray-300 text-base md:text-lg leading-relaxed space-y-3 pl-2 pr-1">
                       <RenderContent content={section.content} />
                        {/* Плейсхолдеры без изменений */}
                        {section.id === 'finance' && (
                            <div className="mt-4 p-3 border border-dashed border-gray-600 rounded-md bg-gray-800/40">
                                <p className="text-sm text-gray-400 italic text-center">[Визуализация: Круговая диаграмма гранта]</p>
                            </div>
                        )}
                         {section.id === 'marketing' && (
                            <div className="mt-4 p-3 border border-dashed border-gray-600 rounded-md bg-gray-800/40">
                                <p className="text-sm text-gray-400 italic text-center">[Визуализация: Маркетинговая воронка VIBE]</p>
                            </div>
                        )}
                     </div>
                   </details>
                );
              })}

              {/* Заключение без изменений */}
              <section className="text-center pt-8 border-t border-brand-purple/20 mt-10">
                 <p className="text-gray-400 italic">
                   Этот план – живой шаблон. Адаптируй под себя, {greetingName}. Главное – <span className="text-brand-purple font-bold">VIBE</span>!
                 </p>
                 <p className="mt-4 text-gray-300">
                   Хочешь обсудить свой путь? Свяжись со мной через{" "}
                   <Link href="/about" className="text-brand-blue hover:underline font-semibold">контакты</Link> или форму <Link href="/jumpstart#jumpstart-form" className="text-neon-lime hover:underline font-semibold">Jumpstart</Link>.
                 </p>
              </section>

            </CardContent>
          </Card>
        </div>
      </TooltipProvider>
        {/* Локальные стили удалены */}
    </div>
  );
}
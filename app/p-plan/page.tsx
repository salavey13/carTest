"use client";

import React, { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAppContext } from "@/contexts/AppContext";
import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from "@/components/ui/tooltip";
// Убедись, что ВСЕ ЭТИ ИКОНКИ ДЕЙСТВИТЕЛЬНО ИСПОЛЬЗУЮТСЯ ВНУТРИ СТРОК content и icon: свойств
import {
  FaFileAlt, FaBullseye, FaUsers, FaBoxOpen, FaChartLine, FaAtom,
  FaMobileAlt, FaComments, FaPaintBrush, FaBrain, FaRocket, FaUserNinja,
  FaMoneyBill, FaTriangleExclamation, FaRecycle,
  FaCode, FaVideo, FaNewspaper, FaGithub, FaTelegram
  // Добавь сюда ЛЮБЫЕ другие Fa иконки, если они есть в тексте или как section.icon!
} from "react-icons/fa6"; // <-- Используем fa6
import { debugLogger } from "@/lib/debugLogger";
import Link from "next/link";
import { cn } from "@/lib/utils";
import type { Database } from "@/types/database.types";

type DbUser = Database["public"]["Tables"]["users"]["Row"] | null;

// Карта компонентов иконок - УБЕДИСЬ, что здесь ЕСТЬ ВСЕ импортированные выше иконки
// Ключ должен ТОЧНО совпадать с именем компонента (FaИмя)
const iconComponents: { [key: string]: React.ElementType } = {
  FaFileAlt, FaBullseye, FaUsers, FaBoxOpen, FaChartLine, FaAtom,
  FaMobileAlt, FaComments, FaPaintBrush, FaBrain, FaRocket, FaUserNinja,
  FaMoneyBill, FaTriangleExclamation, FaRecycle,
  FaCode, FaVideo, FaNewspaper, FaGithub, FaTelegram
  // Добавь сюда соответствия для ЛЮБЫХ других иконок
};

// Функция getPlanSections остается без изменений - проверь строки <Fa...> внутри!
const getPlanSections = (dbUser: DbUser) => {
  const userName = dbUser?.first_name || 'Viberider';
  const userHandle = dbUser?.username ? `@${dbUser.username}` : 'Самозанятый Эксперт';
  const userExperience = dbUser?.metadata?.experienceYears || "13+";

  // УБЕДИСЬ, что все строки <Fa...> здесь соответствуют импортам и карте iconComponents
  // Также убедись, что все `icon:` свойства ссылаются на импортированные компоненты
  return [
     {
      id: "resume",
      title: "1. Резюме проекта",
      icon: FaFileAlt, // OK
      color: "text-brand-blue",
      content: `Проект **"Кибер-Наставник ${userName}"** .. **трансмутатор информации** (<FaAtom className="inline text-purple-400"/>). Грант ..` // FaAtom
    },
     {
      id: "description",
      title: "2. Описание проекта",
      icon: FaRocket, // OK
      color: "text-brand-green",
      content: `**Формат:** .. **Telegram:** Основной хаб (<FaTelegram className="inline text-blue-400"/>). .. **GitHub (Free):** Демо-репы (<FaGithub className="inline"/>), .. **Видео (Телефон):** Короткие клипы (<FaVideo className="inline text-red-500"/>), .. **AI-Трансмутация (<FaRecycle className="inline text-yellow-400"/>):** .. <FaAtom className="inline text-purple-400"/> Превращаем ..` // FaTelegram, FaGithub, FaVideo, FaRecycle, FaAtom
    },
    {
      id: "market",
      title: "3. Анализ рынка и ЦА",
      icon: FaUsers, // OK
      color: "text-brand-pink",
      content: `Рынок IT-образования .. **твоя аутентичность, ${userName}**.` // No <Fa...>
    },
    {
      id: "product",
      title: "4. Продукт/Услуга",
      icon: FaBoxOpen, // OK
      color: "text-brand-orange",
      content: `- Контент (<FaNewspaper className="inline"/>): Статьи, .. - Код (<FaCode className="inline"/>): Примеры, шаблоны на GitHub (<FaGithub className="inline"/>). .. - Переводы/Адаптации (<FaBrain className="inline"/>): Ключевые ..` // FaNewspaper, FaCode, FaGithub, FaBrain
    },
    {
      id: "marketing",
      title: "5. Маркетинг и Продвижение",
      icon: FaBullseye, // OK
      color: "text-neon-lime",
      content: `- <FaPaintBrush className="inline text-neon-lime"/> **Контент-Маркетинг:** .. AI (<FaAtom className="inline"/>) .. - <FaComments className="inline text-neon-lime"/> **Комьюнити:** .. Telegram (<FaTelegram className="inline text-blue-400"/>) .. - <FaGithub className="inline text-neon-lime"/> **GitHub:** .. [Здесь могла бы быть схема ..]` // FaPaintBrush, FaAtom, FaComments, FaTelegram, FaGithub
    },
    {
      id: "operations",
      title: "6. План реализации",
      icon: FaMobileAlt, // OK
      color: "text-brand-cyan",
      content: `**Создание Контента (<FaMobileAlt className="inline"/>):** .. GitHub/телефона (<FaGithub className="inline"/>, <FaMobileAlt className="inline"/>). .. видеозвонки (<FaTelegram className="inline text-blue-400"/>). ..` // FaMobileAlt, FaGithub, FaTelegram
    },
    {
      id: "org",
      title: "7. Организационный план",
      icon: FaUserNinja, // OK
      color: "text-gray-400",
      content: `**Форма:** .. Ты - ядро проекта.` // No <Fa...>
    },
    {
      id: "finance",
      title: "8. Финансовый план",
      icon: FaMoneyBill, // OK
      color: "text-brand-yellow",
      content: `- **<FaChartLine className="inline text-yellow-400"/> 1. Маркетинг .. - **<FaPaintBrush className="inline text-yellow-400"/> 2. Контент .. - **<FaBrain className="inline text-yellow-400"/> 3. Проф. Развитие .. - **<FaTriangleExclamation className="inline text-yellow-400"/> 4. Буфер .. [Здесь могла бы быть круговая ..]` // FaChartLine, FaPaintBrush, FaBrain, FaTriangleExclamation
    },
    {
      id: "risks",
      title: "9. Анализ рисков",
      icon: FaTriangleExclamation, // OK
      color: "text-red-500",
      content: `**Зависимость от Free Tiers:** .. буфер (<FaTriangleExclamation className="inline"/>), .. **Выгорание ${userName}:** .. AI-автоматизация (<FaAtom className="inline"/>), .. комьюнити (<FaComments className="inline"/>), сильный бренд ${userName}.` // FaTriangleExclamation, FaAtom, FaComments
    },
    {
      id: "conclusion",
      title: "10. Заключение",
      icon: FaBrain, // OK
      color: "text-brand-purple",
      content: `Проект .. контент (<FaNewspaper className="inline"/>), комьюнити (<FaUsers className="inline"/>) и умный маркетинг (<FaBullseye className="inline"/>)** .. усиленного AI (<FaAtom className="inline"/>).` // FaNewspaper, FaUsers, FaBullseye, FaAtom
    },
  ];
};

// Компонент RenderContent - проверка if (IconComp) уже есть
const RenderContent: React.FC<{ content: string }> = ({ content }) => {
  // .. (без изменений, он должен быть безопасен к undefined иконкам в карте)
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
              // Регулярное выражение уточнено для необязательного className
              const iconMatch = segment.match(/<Fa(\w+)\s*(?:className="([^"]*)")?\s*\/?>/);
              if (iconMatch) {
                const [, iconName, className = ""] = iconMatch;
                const IconComp = iconComponents[`Fa${iconName}`]; // Поиск в карте
                if (IconComp) { // <-- Проверка на undefined
                  const finalClassName = cn("inline-block align-middle mx-1", className || "w-4 h-4");
                  return <IconComp key={sIndex} className={finalClassName} />;
                } else {
                  // Это запасной вариант, НЕ должен вызывать ошибку undefined
                  console.warn(`[RenderContent] Icon component "Fa${iconName}" not found in iconComponents map.`);
                  // Рендерим текстовый плейсхолдер
                  return <span key={sIndex} className="text-red-500 font-mono">[? Fa{iconName}]</span>;
                }
              }
              // Обычный текст
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

  // useMemo для вычисления данных
  const planSections = useMemo(() => {
      debugLogger.log("[PPlanPage] Recalculating planSections, dbUser:", dbUser ? dbUser.user_id : 'null');
      return getPlanSections(dbUser);
  }, [dbUser]);

  const pageTitleName = useMemo(() => dbUser?.first_name || "Кибер-Наставник", [dbUser]);
  const greetingName = useMemo(() => dbUser?.first_name || 'Viberider', [dbUser]);

  // Основной рендер зависит от isMounted И !isLoading
  if (!isMounted || isLoading) {
    // .. (лоадер без изменений)
    return (
      <div className="flex justify-center items-center min-h-screen pt-20 bg-gradient-to-br from-gray-900 via-black to-gray-800">
        <p className="text-brand-cyan animate-pulse text-xl font-mono">VIBE план загружается...</p>
      </div>
    );
  }

   // Показываем ошибку, если она есть
   if (error) {
     // Используем иконку, которая точно есть (FaTriangleExclamation)
     return (
       <div className="flex flex-col justify-center items-center min-h-screen pt-20 bg-gradient-to-br from-gray-900 via-black to-red-900/50">
         <FaTriangleExclamation className="text-6xl text-red-500 mb-4"/>
         <p className="text-red-400 text-xl font-mono">Ошибка загрузки плана</p>
         <p className="text-red-500 mt-2 text-sm max-w-md text-center">{error.message}</p>
         <p className="text-gray-400 mt-4 text-xs">Попробуйте перезагрузить приложение.</p>
       </div>
     );
   }

  // Функция для получения Tailwind класса границы
  const getBorderClass = (textColorClass: string): string => {
    // .. (без изменений)
    const borderColor = textColorClass.replace('text-', 'border-');
    return cn(borderColor, 'border-gray-500'); // fallback border
  };

  // Рендерим основной контент
  return (
    // Используем существующие классы
    <div className="relative min-h-screen overflow-hidden pt-20 pb-10 bg-gradient-to-br from-dark-bg via-black to-purple-900/30 text-light-text">
       {/* Сетка */}
       <div
         className="absolute inset-0 bg-repeat opacity-[0.04] z-0 bg-grid-pattern" // Используем класс bg-grid-pattern если он подходит, или оставляем style
         style={{ /* Если bg-grid-pattern не подходит, используем HSL из globals.css */
           // backgroundImage: `linear-gradient(to right, hsl(var(--brand-purple-hsl, 278, 100%, 50%)) 1px, transparent 1px),
           //                  linear-gradient(to bottom, hsl(var(--brand-purple-hsl, 278, 100%, 50%)) 1px, transparent 1px)`,
           // backgroundSize: '60px 60px',
         }}
       ></div>

      <TooltipProvider delayDuration={150}>
        <div className="relative z-10 container mx-auto px-4">
          {/* Карточка */}
          <Card className="max-w-4xl mx-auto bg-dark-card/85 backdrop-blur-lg text-light-text rounded-2xl border-2 border-brand-purple/40 shadow-[0_0_30px_rgba(157,0,255,0.3)]">
            <CardHeader className="text-center border-b border-brand-purple/20 pb-5">
              {/* Иконка в заголовке */}
              <FaUserNinja className="text-6xl text-brand-purple mx-auto mb-4 animate-pulse" />
              {/* Заголовок */}
              <CardTitle className="text-3xl md:text-5xl font-bold text-brand-purple cyber-text glitch uppercase tracking-wider" data-text={`Бизнес-План: ${pageTitleName}`}>
                Бизнес-План: {pageTitleName}
              </CardTitle>
              <p className="text-md md:text-lg text-gray-300 mt-4 font-mono max-w-2xl mx-auto">
                Версия "Кибер-Партизан": Рост через <span className="text-neon-lime">контент</span>, <span className="text-brand-cyan">комьюнити</span> и <span className="text-brand-purple">AI</span> на минималках. Грант 350к. <span className="text-xs opacity-70">(Адаптировано для {greetingName})</span>
              </p>
            </CardHeader>

            <CardContent className="space-y-10 p-4 md:p-8">
              {planSections.map((section) => {
                // *** Добавлена проверка на section.icon ***
                const IconComponent = section.icon;
                if (!IconComponent) {
                  // Если у секции нет иконки, логируем и пропускаем рендер этой секции или рендерим без иконки
                  console.warn(`[PPlanPage] Section "${section.title}" (id: ${section.id}) is missing the 'icon' property.`);
                  // Можно вернуть null, чтобы пропустить секцию, или рендерить без иконки
                  // return null; // Пропустить секцию
                  // Или рендерить без IconComponent:
                  // return <details key={section.id} ... > <summary> {section.title} </summary> ... </details>;
                }

                const borderClass = getBorderClass(section.color);

                return (
                   <details key={section.id} className={cn(
                       "group border-l-4 pl-4 rounded-r-md transition-all duration-300 ease-in-out open:bg-purple-900/10 open:pb-4 open:shadow-inner",
                       borderClass
                   )}>
                     <summary className={cn("text-2xl font-semibold cursor-pointer list-none flex items-center hover:opacity-80 transition-opacity", section.color)}>
                       {/* Рендерим иконку только если она есть */}
                       {IconComponent && <IconComponent className="mr-3 flex-shrink-0 group-open:animate-pulse" />}
                       {section.title}
                     </summary>
                     <div className="mt-4 text-gray-300 text-base md:text-lg leading-relaxed space-y-3 pl-2 pr-1">
                       <RenderContent content={section.content} />
                        {/* Плейсхолдеры */}
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

              {/* Заключение */}
              <section className="text-center pt-8 border-t border-brand-purple/20 mt-10">
                 {/* .. (без изменений) */}
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
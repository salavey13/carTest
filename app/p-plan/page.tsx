"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAppContext } from "@/contexts/AppContext"; // Импорт контекста для данных юзера
import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from "@/components/ui/tooltip";
// Импортируем только разрешенные Fa6 иконки
import {
  FaFileAlt, FaBullseye, FaUsers, FaBoxOpen, FaChartLine, FaAtom,
  FaMobileAlt, FaComments, FaPaintBrush, FaBrain, FaRocket, FaUserNinja,
  FaMoneyBill, FaExclamationTriangle, FaRecycle,
  FaCode, FaVideo, FaNewspaper, FaGithub, FaTelegram
} from "react-icons/fa6";
import { debugLogger } from "@/lib/debugLogger";
import Link from "next/link";
import { cn } from "@/lib/utils";
import type { Database } from "@/types/database.types"; // Импорт типа базы

// --- Тип пользователя из базы ---
type DbUser = Database["public"]["Tables"]["users"]["Row"] | null;

// --- Текстовое наполнение (из "Кибер-Партизан" версии, доработано + динамика) ---
// Функция теперь принимает DbUser или null
const getPlanSections = (dbUser: DbUser) => {
  // Используем данные из dbUser, если они есть, иначе дефолтные значения
  const userName = dbUser?.first_name || 'Viberider';
  const userHandle = dbUser?.username ? `@${dbUser.username}` : 'Самозанятый Эксперт';
  // TODO: Потенциально добавить поле "опыт" в профиль или оставить общим/хардкодом
  const userExperience = dbUser?.metadata?.experienceYears || "13+"; // Пример: можно хранить в metadata

  return [
    {
      id: "resume",
      title: "1. Резюме проекта",
      icon: FaFileAlt,
      color: "text-brand-blue",
      // Вставляем userName и userExperience
      content: `Проект **"Кибер-Наставник ${userName}"** – создание и развитие персонального бренда и образовательной онлайн-платформы (блога), управляемой преимущественно **с мобильных устройств**.
      Цель – предоставление уникального контента, менторских услуг и практических инструментов на базе методологии **VIBE** (AI-ассистированная разработка, быстрая валидация идей, безопасность) для IT-специалистов и начинающих предпринимателей в РФ.
      Проект использует **максимально доступные и бесплатные технологии** (Vercel, Telegram, free-tier AI), фокусируя инвестиции гранта на **нематериальных активах:** создании контента, построении сообщества, маркетинге и **твоем профессиональном развитии, ${userName}**.
      **Ключевая идея:** Ценность создается **экспертизой (${userExperience} лет у меня, твой путь уникален!), уникальным подходом (VIBE, SelfDev), скоростью и умением использовать доступные инструменты**, включая AI как **трансмутатор информации** (<FaAtom className="inline text-purple-400"/>). Грант позволит тебе (${userName}) полностью посвятить себя проекту.`
    },
    {
      id: "description",
      title: "2. Описание проекта",
      icon: FaRocket,
      color: "text-brand-green",
       // Вставляем userName, userHandle, добавляем иконки TG, GH, Video, Recycle, Atom
      content: `**Формат:** Мобильно-ориентированный блог/платформа:
      - **Сайт (Next.js/Vercel - Free):** Легковесный, быстрый, mobile-first. Статьи, гайды, VIBE/SelfDev. Управление через GitHub/телефон.
      - **Telegram:** Основной хаб (<FaTelegram className="inline text-blue-400"/>). Анонсы, инсайты, общение, комьюнити.
      - **GitHub (Free):** Демо-репы (<FaGithub className="inline"/>), шаблоны (Jumpstart), VIBE-воркфлоу.
      - **Видео (Телефон):** Короткие клипы (<FaVideo className="inline text-red-500"/>), прямые эфиры. Монтаж на телефоне (CapCut).
      - **AI-Трансмутация (<FaRecycle className="inline text-yellow-400"/>):** Основа! Одно видео/статья -> десятки постов, клипов, идей с помощью AI. <FaAtom className="inline text-purple-400"/> Превращаем любой контент в любой другой!
      **УТП:** Практический AI на доступных инструментах. VIBE (AI + Валидация + Безопасность). SelfDev & Purpose/Profit. Твой личный бренд (${userName}, ${userHandle}). Демонстрация эффективности **"партизанского" подхода**.`
    },
    {
      id: "market",
      title: "3. Анализ рынка и ЦА",
      icon: FaUsers,
      color: "text-brand-pink",
      // Добавляем userName для акцента на аутентичности
      content: `Рынок IT-образования в РФ растет. Спрос на AI, WebDev, VIBE – высокий. Импортозамещение = нужны кадры.
      **ЦА:** Разрабы (TS/React/Next), тимлиды, фрилансеры, соло-предприниматели, студенты IT. Те, кто хочет оседлать AI-волну.
      **Конкуренты:** Блогеры, школы. Отстройка: **VIBE**, **SelfDev**, **AI-трансмутация**, **личный опыт**, фокус на **практике** и **доступности**, **твоя аутентичность, ${userName}**.`
    },
    {
      id: "product",
      title: "4. Продукт/Услуга",
      icon: FaBoxOpen,
      color: "text-brand-orange",
      // Вставляем userName, добавляем иконки Newspaper, Code, Brain
      content: `**Бесплатно (Воронка):**
      - Контент (<FaNewspaper className="inline"/>): Статьи, видео, заметки (сайт, TG, VK). AI помогает генерить и адаптировать.
      - Код (<FaCode className="inline"/>): Примеры, шаблоны на GitHub (<FaGithub className="inline"/>).
      - Переводы/Адаптации (<FaBrain className="inline"/>): Ключевые идеи (Purpose&Profit, AI&Work).
      **Платно (Монетизация):**
      - Менторство/Консультации (${userName}): Внедрение VIBE, AI, SelfDev (Цена: X руб/час).
      - Воркшопы/Интенсивы: Практика AI, VIBE, безопасность (Цена: Y руб/участника).
      - Шаблоны/Jumpstart: Готовые стартеры проектов (Цена: Z руб/шаблон).
      - (Перспектива) Подписка: Эксклюзив, комьюнити, ранний доступ.`
    },
    {
      id: "marketing",
      title: "5. Маркетинг и Продвижение",
      icon: FaBullseye,
      color: "text-neon-lime",
      // Добавляем иконки PaintBrush, Comments, Github
      content: `**Органика (Фундамент):**
      - <FaPaintBrush className="inline text-neon-lime"/> **Контент-Маркетинг:** Часто, ценно, вирусно (TG, VK, сайт). AI (<FaAtom className="inline"/>) помогает с трансмутацией и генерацией!
      - <FaComments className="inline text-neon-lime"/> **Комьюнити:** Лояльность в Telegram (<FaTelegram className="inline text-blue-400"/>) через общение.
      - <FaGithub className="inline text-neon-lime"/> **GitHub:** Привлечение разрабов кодом.
      - **Нетворкинг:** Коллабы, чаты.
      **Платное (Ускорение - Грант):**
      - **Таргет:** VK, Telegram Ads.
      - **Посевы:** Реклама в TG-каналах.
      - **Бустинг:** Продвижение топ-контента.

      [Здесь могла бы быть схема маркетинговой воронки: Контент (AI Трансмут.) -> Соцсети/SEO -> Комьюнити -> Платные Услуги]`
    },
    {
      id: "operations",
      title: "6. План реализации",
      icon: FaMobileAlt,
      color: "text-brand-cyan",
      // Добавляем иконку MobileAlt
      content: `**Создание Контента (<FaMobileAlt className="inline"/>):** Телефон - всё! Съемка, монтаж (CapCut), текст (голос/клава), AI для идей/черновиков/трансмутации (Free/Plus).
      **Платформа:** Сайт на Next.js/Vercel (Free). Управление с GitHub/телефона (<FaGithub className="inline"/>, <FaMobileAlt className="inline"/>). Supabase (Free) для бэка (если надо).
      **Услуги:** Консультации/воркшопы через TG/VK видеозвонки (<FaTelegram className="inline text-blue-400"/>).
      **Тех. Стек:** ТЕЛЕФОН, Next.js, Vercel, GitHub, Telegram, Supabase (Free), AI (Free/Plus), CapCut, Canva (Free/Pro).`
    },
    {
      id: "org",
      title: "7. Организационный план",
      icon: FaUserNinja,
      color: "text-gray-400",
       // Вставляем userName и userHandle
      content: `**Форма:** Самозанятый (НПД). Регистрация через "Мой Налог".
      **Исполнитель:** ${userName} (${userHandle}) – все компетенции у тебя (или ты их быстро получишь по VIBE!). Ты - ядро проекта.`
    },
    {
      id: "finance",
      title: "8. Финансовый план",
      icon: FaMoneyBill,
      color: "text-brand-yellow",
      // Вставляем userName, добавляем иконки ChartLine, PaintBrush, Brain, ExclamationTriangle
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
      - **<FaExclamationTriangle className="inline text-yellow-400"/> 4. Буфер (20 000 руб.):**
          - Резерв на платные AI-инструменты/сервисы при росте или смене Free Tier.
      **Доходы (Прогноз 12 мес.):** ~230 000 - 420 000 руб. (Менторство, воркшопы, шаблоны).
      **Рентабельность:** Выход на опер. прибыль за 6-9 мес. Грант = **ускорение роста** и **создание IP**.

      [Здесь могла бы быть круговая диаграмма распределения гранта: Маркетинг (~57%), Контент/Время (~29%), Развитие (~8.5%), Буфер (~5.5%)]`
    },
    {
      id: "risks",
      title: "9. Анализ рисков",
      icon: FaExclamationTriangle,
      color: "text-red-500",
      // Вставляем userName
      content: `**Зависимость от Free Tiers:** Риск лимитов/смены условий AI/Хостинга. Митигация: Мониторинг, оптимизация, буфер (<FaExclamationTriangle className="inline"/>), готовность платить из дохода.
      **"Телефонное" качество:** Может уступать студии. Митигация: Фокус на **ценности контента**, мобильный монтаж, **аутентичность ${userName}**.
      **Выгорание ${userName}:** Работа соло. Митигация: Планирование, AI-автоматизация (<FaAtom className="inline"/>), отдых, комьюнити.
      **Конкуренция/Спрос:** Митигация: УТП (VIBE, AI-трансмут.), комьюнити (<FaComments className="inline"/>), сильный бренд ${userName}.`
    },
    {
      id: "conclusion",
      title: "10. Заключение",
      icon: FaBrain,
      color: "text-brand-purple",
       // Вставляем userName дважды для акцента
      content: `Проект **"Кибер-Наставник ${userName}"** – это **инновационный и ресурсоэффективный VIBE**. Ставка на **твою экспертизу (${userName}), контент (<FaNewspaper className="inline"/>), комьюнити (<FaUsers className="inline"/>) и умный маркетинг (<FaBullseye className="inline"/>)**, а не на железо. Грант = **инвестиция в рост, контент и твое развитие**. Это пример доступного IT-предпринимательства в РФ, усиленного AI (<FaAtom className="inline"/>).`
    },
  ];
};

// --- Компонент Страницы ---
export default function PPlanPage() {
  // Получаем dbUser и isLoading из контекста
  const { dbUser, isLoading, error } = useAppContext();
  const [isMounted, setIsMounted] = useState(false);
  // Инициализируем с null, чтобы getPlanSections вызвалась с дефолтом сначала
  const [planSections, setPlanSections] = useState(getPlanSections(null));

  useEffect(() => {
    // Этот флаг все еще полезен, чтобы избежать рендеринга на сервере до гидратации
    setIsMounted(true);
  }, []);

  // Отдельный эффект для обновления секций, когда dbUser меняется
  useEffect(() => {
    // Обновляем секции, когда dbUser становится доступен ИЛИ если он уже был доступен при монтировании
    // А также сбрасываем к дефолту, если dbUser становится null (например, при ошибке или логауте)
    if (dbUser) {
        setPlanSections(getPlanSections(dbUser));
        debugLogger.log("[PPlanPage] Effect triggered, dbUser data applied:", {firstName: dbUser.first_name, username: dbUser.username});
    } else {
        // Если dbUser стал null/undefined (после того как был), используем дефолтные значения
        setPlanSections(getPlanSections(null));
        debugLogger.log("[PPlanPage] Effect triggered, using default data (dbUser is null).");
    }
  }, [dbUser]); // *** Зависимость теперь от dbUser ***

  // Используем isLoading из контекста и isMounted для прелоадера
  if (!isMounted || isLoading) {
    return (
      <div className="flex justify-center items-center min-h-screen pt-20 bg-gradient-to-br from-gray-900 via-black to-gray-800">
        <p className="text-brand-cyan animate-pulse text-xl font-mono">VIBE план загружается...</p>
        {/* Можно добавить отображение ошибки здесь, если она есть */}
        {/* {error && <p className="text-red-500 mt-4">Ошибка: {error.message}</p>} */}
      </div>
    );
  }

   // Если есть ошибка после загрузки
   if (error) {
     return (
       <div className="flex flex-col justify-center items-center min-h-screen pt-20 bg-gradient-to-br from-gray-900 via-black to-red-900/50">
         <FaExclamationTriangle className="text-6xl text-red-500 mb-4"/>
         <p className="text-red-400 text-xl font-mono">Ошибка загрузки плана</p>
         <p className="text-red-500 mt-2 text-sm max-w-md text-center">{error.message}</p>
         <p className="text-gray-400 mt-4 text-xs">Попробуйте перезагрузить приложение.</p>
       </div>
     );
   }

  // Определяем имя для заголовка (используем dbUser)
  const pageTitleName = dbUser?.first_name || "Кибер-Наставник";
  const greetingName = dbUser?.first_name || 'Viberider'; // Имя для приветствия в конце

  return (
    <div className="relative min-h-screen overflow-hidden pt-20 pb-10 bg-gradient-to-br from-gray-950 via-black to-purple-900/30 text-gray-200">
       {/* Background Grid */}
       <div
         className="absolute inset-0 bg-repeat opacity-[0.04] z-0"
         style={{
           backgroundImage: `linear-gradient(to right, rgba(157, 0, 255, 0.3) 1px, transparent 1px),
                             linear-gradient(to bottom, rgba(157, 0, 255, 0.3) 1px, transparent 1px)`,
           backgroundSize: '60px 60px',
         }}
       ></div>

      <TooltipProvider delayDuration={150}>
        <div className="relative z-10 container mx-auto px-4">
          <Card className="max-w-4xl mx-auto bg-black/85 backdrop-blur-lg text-white rounded-2xl border-2 border-brand-purple/40 shadow-[0_0_30px_rgba(157,0,255,0.3)]">
            <CardHeader className="text-center border-b border-brand-purple/20 pb-5">
              <FaUserNinja className="text-6xl text-brand-purple mx-auto mb-4 animate-pulse" />
              {/* Динамический заголовок */}
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
                // Определяем цвет границы через CSS переменную
                const borderColorVar = section.color.replace('text-', '--color-');

                return (
                   // Используем details/summary для аккордеона
                   <details key={section.id} className={`group border-l-4 pl-4 rounded-r-md transition-all duration-300 ease-in-out open:bg-purple-900/10 open:pb-4 open:shadow-inner`} style={{ borderColor: `var(${borderColorVar})` }}>
                     <summary className={cn("text-2xl font-semibold cursor-pointer list-none flex items-center hover:opacity-80 transition-opacity", section.color)}>
                       <IconComponent className="mr-3 flex-shrink-0 group-open:animate-pulse" /> {section.title}
                     </summary>
                     <div className="mt-4 text-gray-300 text-base md:text-lg leading-relaxed space-y-3 pl-2 pr-1">
                       {/* Используем dangerouslySetInnerHTML для рендера <strong> и простых inline-иконок (без изменений тут) */}
                       {section.content.split('\n').map((paragraph, index) => (
                         <p key={index} dangerouslySetInnerHTML={{ __html: paragraph.replace(/<Fa(\w+)\s*(.*?)\/>/g, (match) => {
                            // Упрощенный рендер иконки как текст с базовым цветом.
                            const iconName = match.match(/Fa(\w+)/)?.[1];
                            const classes = match.match(/className="([^"]*)"/)?.[1] || '';
                            const colorClass = classes.split(' ').find(cls => cls.startsWith('text-')) || 'text-gray-400';
                             // Отображаем имя иконки текстом, обернутое в span с цветом
                             // ВАЖНО: Это НЕ рендерит иконку, а только ее текстовое представление.
                            return `<span class="inline-block mx-1 ${colorClass}" title="${iconName}">[${iconName}]</span>`;
                          }).replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>') // Замена ** на <strong>
                         }} />
                       ))}
                        {/* Placeholder для визуализации */}
                        {section.id === 'finance' && (
                            <div className="mt-4 p-3 border border-dashed border-gray-600 rounded-md bg-gray-800/40">
                                <p className="text-sm text-gray-400 italic text-center">[Визуализация: Круговая диаграмма гранта: Маркетинг (~57%), Контент/Время (~29%), Развитие (~8.5%), Буфер (~5.5%)]</p>
                            </div>
                        )}
                         {section.id === 'marketing' && (
                            <div className="mt-4 p-3 border border-dashed border-gray-600 rounded-md bg-gray-800/40">
                                <p className="text-sm text-gray-400 italic text-center">[Визуализация: Маркетинговая воронка VIBE: Контент (AI Трансмут.) -> Комьюнити (TG) -> Валидация (AI) -> Продукт/Услуга]</p>
                            </div>
                        )}
                     </div>
                   </details>
                );
              })}

              {/* Conclusion/CTA */}
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
        {/* CSS Variables for border colors (без изменений тут) */}
        
    </div>
  );
}
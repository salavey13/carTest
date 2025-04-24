"use client";

import React, { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAppContext } from "@/contexts/AppContext";
import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from "@/components/ui/tooltip";
// Убедимся, что все иконки есть + новые для Санька
import {
  FaFileAlt, FaBullseye, FaUsers, FaBoxOpen, FaChartLine, FaAtom,
  FaMobileAlt, FaComments, FaPaintBrush, FaBrain, FaRocket, FaUserNinja,
  FaMoneyBillWave, FaTriangleExclamation, FaUserAstronaut, // Иконка для "Тебя"
  FaRecycle, FaCode, FaVideo, FaNewspaper, FaGithub, FaTelegram, FaCarCrash // Иконка для "Жопы"
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
  FaMoneyBillWave, FaTriangleExclamation, FaUserAstronaut,
  FaRecycle, FaCode, FaVideo, FaNewspaper, FaGithub, FaTelegram, FaCarCrash
};

// --- Функция генерации секций с учетом персонализации для Санька ---
const getPlanSections = (dbUser: DbUser) => {
  // --- Персонализация ---
  // Используем имя из dbUser, если оно есть, иначе "Боец"
  const userName = dbUser?.first_name || 'Боец';
  // Пытаемся создать забавный хэндл, если это Санёк (нужен способ идентификации, например, по ID или username, если он есть)
  // Для примера, пусть у Санька ID = 'sanya-id' или username = 'Sanek'
  const isSanek = dbUser?.username === 'Sanek' || dbUser?.user_id === 'your_sanek_user_id_here'; // <-- Замени 'your_sanek_user_id_here'
  const userHandle = isSanek ? '@SanekTheShaftWhisperer' : (dbUser?.username ? `@${dbUser.username}` : 'Твой_Кибер_Тег');
  const userOriginStory = isSanek
     ? "уставший от баранки и сломанных карданов <FaCarCrash className='inline text-red-400'/>"
     : "ищущий свой путь в цифровом мире";
  const myExperience = "13+"; // Мой опыт
  const grantAmount = 350000; // Сумма гранта
  const grantAmountStr = `${grantAmount.toLocaleString('ru-RU')} руб.`;
  // Примерный расчет: ~60% гранта на "фокус-время" при условной "стоимости" 30-40к/мес
  const focusTimeCostPerMonth = 35000; // Условная цифра для расчета
  const focusTimeBudget = grantAmount * 0.60;
  const timeInvestmentMonths = Math.floor(focusTimeBudget / focusTimeCostPerMonth); // ~6 месяцев
  const marketingBudget = Math.round(grantAmount * 0.25); // ~87.5к
  const devToolBudget = Math.round(grantAmount * 0.05); // ~17.5к (на платные AI/сервисы)
  const bufferBudget = grantAmount - focusTimeBudget - marketingBudget - devToolBudget; // ~35к

  return [
     {
      id: "resume",
      title: `1. План Захвата Мира: Твой Старт, ${userName}!`, // Персонализация
      icon: FaRocket, // Ракета!
      color: "text-brand-green",
      content: `Проект **"Кибер-Волк ${userName}"** – это не скучный бизнес-план. Это твой **личный JUMPSTART <FaRocket className="inline text-green-400"/>**. Мы строим твой бренд (${userHandle}) и платформу, чтобы ты мог **вырваться** из ${userOriginStory}. И всё это – управляемо **с телефона <FaMobileAlt className="inline text-green-400"/>**!
      **Философия:** VIBE = Скорость (<FaRocket className="inline"/>) + Ум (<FaAtom className="inline text-purple-400"/> AI) + Защита (<FaUserNinja className="inline text-gray-400"/>). Плюс **SelfDev** – строим бизнес вокруг **ТЕБЯ**.
      **Инструменты:** Никаких заводов-пароходов. Юзаем **бесплатные/дешёвые** технологии (Vercel, GitHub <FaGithub className="inline"/>, Telegram <FaTelegram className="inline text-blue-400"/>, Supabase Free, AI Free Tier).
      **Грант (${grantAmountStr}):** Это не на секретаршу и кожаное кресло. Это **инвестиция в ТЕБЯ, ${userName} <FaUserAstronaut className="inline text-yellow-400"/>**:
      - Твоё **Фокус-Время** (~${timeInvestmentMonths} мес.), чтобы ты не думал о подработке, а **фигачил контент и учился**.
      - **Маркетинг**, чтобы найти первых клиентов и "розовые чеки" <FaMoneyBillWave className="inline text-pink-400"/>.
      - Твоя **Прокачка** (курсы, инструменты).
      **Суть:** Мы строим **не сайт, а СИСТЕМУ**, которая работает на тебя.`
    },
     {
      id: "description",
      title: "2. Твоя Боевая Машина: Сайт + AI + Телефон",
      icon: FaUserAstronaut, // Ты - пилот этой машины
      color: "text-brand-cyan",
      content: `**Формат:** Твоя крепость, управляемая с ладони <FaMobileAlt className="inline text-cyan-400"/>:
      - **Сайт/Блог (0 руб):** Твоя история, кейсы, VIBE-заметки. Быстро, адаптивно (Next.js/Vercel). Обновления – через GitHub <FaGithub className="inline"/> командой боту в TG.
      - **Telegram (<FaTelegram className="inline text-blue-400"/>):** Твой командный центр. Анонсы, инсайты, сбор "братвы" <FaUsers className="inline"/>, приём заявок.
      - **GitHub (<FaGithub className="inline"/>):** Твой арсенал. Готовые шаблоны (Jumpstart Kit <FaBoxOpen className="inline"/>!), примеры VIBE-автоматизации. Место, где ты сам(а) будешь **учить новичков**.
      - **AI-Трансмутатор (<FaAtom className="inline text-purple-400"/>):** Твой личный Оптимус Прайм. Одна мысль -> пост, статья, скрипт для видео, картинка. <FaRecycle className="inline text-yellow-400"/> Перерабатываем всё во всё.
      **УТП:** Не "еще один эксперт". А **ТЫ** (${userName}, ${userHandle}), <0xF0><0x9F><0xAA><0xBD> усиленный **AI <FaRobot className="inline"/>**, решающий **твои же вчерашние проблемы** на **доступных инструментах**. Показываем **партизанский VIBE** в действии.`
    },
    {
      id: "market",
      title: "3. Поле Боя: Твои Люди и Их Боли",
      icon: FaUsers,
      color: "text-brand-pink",
      content: `Рынок РФ после исхода? Клондайк! Кадры нужны, AI хайпует, люди ищут **реальные** решения.
      **Твои Люди (ЦА):** Ребята, задолбавшиеся крутить гайки/баранку/код по-старому. ${userName}, это такие же как ты - ${userOriginStory}. Разрабы, фрилы, малый бизнес, кто хочет **НЕ ПРО*БАТЬ ВОЛНУ AI**.
      **Главные Враги:** Страх перемен, инфоцыганщина, сложность.
      **Твое Оружие (Отстройка):**
      - **ТЫ САМ (${userName}):** Твоя история, твоя честность. Люди покупают у людей.
      - **VIBE:** Скорость, AI-фишки, безопасность "из коробки".
      - **SelfDev:** Помогаем не просто кодить, а строить СВОЮ жизнь.
      - **AI-Трансмутация:** Делаем контент-пулемет из рогатки.
      - **Простота и Доступность:** Начинаем с телефона и бесплатных тулзов.`
    },
    {
      id: "product",
      title: "4. Твой Товар: Опыт, Контент, Решения",
      icon: FaBoxOpen, // Коробка с твоими продуктами
      color: "text-brand-orange",
      content: `Сначала даем пользу <FaGift className="inline text-orange-400"/>, потом говорим о деньгах <FaMoneyBillWave className="inline"/>.
      **Бесплатный Фундамент (Строим доверие):**
      - Контент (<FaNewspaper className="inline"/>): Делись путем, ошибками, инсайтами (Сайт, TG, VK). AI (<FaAtom className="inline"/>) превращает твои мысли в посты.
      - Код (<FaCode className="inline"/>): Полезные скрипты, Jumpstart Kit на GitHub (<FaGithub className="inline"/>).
      - Переводы/Саммари (<FaBrain className="inline"/>): Адаптируем западные идеи (Purpose&Profit, AI-фишки).
      **Монетизация (Твой Кэш):**
      - **"Менторский Пинок" (${userName}):** Часовые сессии по VIBE, AI, SelfDev (Старт: 3-5к руб/час).
      - **Практикум "AI-Партизан":** Показываем, как фигачить с AI на коленке (Старт: 5-10к руб/чел).
      - **Jumpstart Kit Pro:** Улучшенные шаблоны (Старт: 1-3к руб/шт).
      - **(Позже) Клуб "Кибер-Волков":** Подписка на эксклюзив/комьюнити.`
    },
     {
      id: "marketing",
      title: "5. Маркетинг: Громко и по Делу",
      icon: FaBullseye, // Точно в цель
      color: "text-neon-lime",
      content: `- <FaPaintBrush className="inline text-neon-lime"/> **Контент-Пулемёт:** Делай контент о том, что ТЕБЯ прет. AI (<FaAtom className="inline text-purple-400"/>) – твой арт-директор и копирайтер. Вали часто, честно, с пользой (TG, VK, YouTube Shorts?).
      - <FaComments className="inline text-neon-lime"/> **Банда в Telegram (<FaTelegram className="inline text-blue-400"/>):** Собирай своих. Не впаривай, а общайся, отвечай, будь полезным. Лояльность > Продаж в лоб.
      - <FaGithub className="inline text-neon-lime"/> **GitHub:** Приманка для технарей.
      - **Коллабы:** Дружи с другими "волками".
      **Бензин для Огня (Грант - ${marketingBudget.toLocaleString('ru-RU')} руб.):**
      - **Таргет (VK/TG Ads):** Найти тех, кому *уже* болит.
      - **Посевы:** Закинуть удочки в правильные паблики.
      - **Пробы:** Тестировать гипотезы, форматы. Не бояться сливать бюджет на тесты!

      [Воронка: Контент (AI x10) -> Трафик (Таргет/Посев) -> Банда (TG) -> Бабки (Продукты/Услуги)]`
    },
    {
      id: "operations",
      title: "6. Как Делать: Телефон, Мозги, AI",
      icon: FaMobileAlt, // Телефон - главный инструмент
      color: "text-brand-cyan",
      content: `**Контент (<FaMobileAlt className="inline text-cyan-400"/>):** Твой Смартфон – это ВСЁ! Съемка, монтаж (CapCut/VN), тексты (голосом!), AI (<FaAtom className="inline"/>) для идей, рерайта, картинок.
      **Платформа:** Сайт на Next.js/Vercel (0 руб). Управление? Через GitHub/TG-бот (<FaGithub className="inline"/>). База? Supabase (0 руб) если понадобится.
      **Услуги:** Видеозвонки в TG/VK (<FaTelegram className="inline text-blue-400"/>).
      **Тех. Стек МИНИМАЛИСТА:** ТЕЛЕФОН, Ноут (опц.), Next.js, Vercel, GitHub, Telegram, Supabase (Free), AI (Free/ChatGPT Plus), CapCut. Всё. Не усложняй!`
    },
    {
      id: "org",
      title: "7. Команда: Ты и Твои Кибер-Кореша",
      icon: FaUserNinja, // Ты - ниндзя-одиночка
      color: "text-gray-400",
      content: `**Статус:** Самозанятый (НПД). Налоги платим честно, но просто.
      **Ты (${userName}, ${userHandle}):** <FaUserAstronaut className="inline text-gray-300"/> Ты – **центр вселенной** этого проекта. Основатель, первый "волк", главный евангелист VIBE. Не знаешь чего-то? **Научишься по VIBE-методу** (как Нео!). Нанимать людей? Потом. Сначала **AI – твоя бесплатная команда** <FaRobot className="inline"/>. Масштабируй **СЕБЯ**.`
    },
    {
      id: "finance",
      title: `8. Финансы: Грант ${grantAmountStr} – Твой Кислород`,
      icon: FaMoneyBillWave,
      color: "text-brand-yellow",
      content: `Грант – это не халява, это **инвестиция в твой рывок**. Распределяем умно:
      - **<FaUserAstronaut className="inline text-yellow-400"/> 1. ТЫ (${userName}) – Главный Актив (~${focusTimeBudget.toLocaleString('ru-RU')} руб.):** Чтобы ты мог **НЕ РАБОТАТЬ НА ДЯДЮ**, а фулл-тайм фигачить этот проект ~${timeInvestmentMonths} мес. Создавать контент, учиться, строить – это и есть **создание твоего IP**!
      - **<FaBullseye className="inline text-yellow-400"/> 2. Маркетинг & Первые Клиенты (~${marketingBudget.toLocaleString('ru-RU')} руб.):** Таргет, посевы, тесты. Найти тех, кто заплатит за твою пользу. Цель – **быстро выйти на самоокупаемость**.
      - **<FaBrain className="inline text-yellow-400"/> 3. Твой Апгрейд Мозгов (~${devToolBudget.toLocaleString('ru-RU')} руб.):** Доступ к платным AI (если надо), курсы по маркетингу/продажам. Инвестируем в твои **будущие доходы**.
      - **<FaTriangleExclamation className="inline text-yellow-400"/> 4. "Аптечка" (~${bufferBudget.toLocaleString('ru-RU')} руб.):** На непредвиденные расходы или если бесплатный AI кончится.
      **Цель по Доходам (12 мес.):** Выйти на стабильные **50к-150к+ руб/мес** чистыми через 6-9 мес. Грант позволяет **не сдохнуть на старте** и **расти быстрее**.

      [Диаграмма Гранта: ТЫ (60%), Маркетинг (25%), Твой Рост (5%), Аптечка (10%)]`
    },
     {
      id: "risks",
      title: "9. Возможные Жопы (и как их подтереть)",
      icon: FaCarCrash, // Авария - символ риска
      color: "text-red-500",
      content: `**Закончится Free Tier:** Есть "Аптечка" (<FaTriangleExclamation className="inline"/>), ищем бесплатные аналоги, **быстро монетизируемся**.
      **Ты Перегоришь (${userName}):** **AI-автоматизация** (<FaAtom className="inline text-purple-400"/>) снимает рутину. **Комьюнити** (<FaComments className="inline"/>) дает поддержку. Фокус на том, что **реально прет** (SelfDev!). Делегируй задачи AI.
      **Идея Не Взлетит:** **Быстрая AI-Валидация** <FaBullseye className="inline"/> на старте! Не строим то, что не нужно. VIBE = Гибкость. Быстро меняем курс.
      **"Кардан Опять Сломается" (<FaCarCrash className="inline text-red-500"/>):** Жизнь – дерьмо, бывает. План B: навыки VIBE/AI востребованы, сможешь быстро найти проект/фриланс.`
    },
    {
      id: "conclusion",
      title: `10. Финал: ${userName}, Жми на Газ!`,
      icon: FaBrain, // Мозг - твой главный актив
      color: "text-brand-purple",
      content: `Проект **"Кибер-Волк ${userName}"** – это твой шанс **переписать свой код жизни**. Используй свой мозг <FaBrain className="inline"/>, свою историю, поддержку "братвы" <FaUsers className="inline"/> и безграничные возможности AI <FaAtom className="inline text-purple-400"/>. Грант дает **стартовый буст**. Дальше – только твой **VIBE** и твои действия. **Хватит ждать у моря погоды, пора делать волны!** <FaRocket className="inline text-brand-green"/>`
    },
  ];
};

// Компонент RenderContent (без изменений)
const RenderContent: React.FC<{ content: string }> = ({ content }) => {
  const paragraphs = content.split('\n');
  return ( <> {paragraphs.map((paragraph, pIndex) => { const segments = paragraph.split(/(\*\*.*?\*\*|<Fa\w+\s*.*?\/?>)/g).filter(Boolean); return ( <p key={pIndex} className="mb-2 last:mb-0"> {segments.map((segment, sIndex) => { if (segment.startsWith('**') && segment.endsWith('**')) { return <strong key={sIndex}>{segment.slice(2, -2)}</strong>; } const iconMatch = segment.match(/<Fa(\w+)\s*(?:className="([^"]*)")?\s*\/?>/); if (iconMatch) { const [, iconName, className = ""] = iconMatch; const IconComp = iconComponents[`Fa${iconName}`]; if (IconComp) { const finalClassName = cn("inline-block align-middle mx-1", className || "w-4 h-4"); return <IconComp key={sIndex} className={finalClassName} />; } else { console.warn(`[RenderContent] Icon "Fa${iconName}" not found.`); return <span key={sIndex} className="text-red-500 font-mono">[? Fa{iconName}]</span>; } } return <React.Fragment key={sIndex}>{segment}</React.Fragment>; })} </p> ); })} </> );
};

// --- Компонент Страницы (с обновленными заголовками) ---
export default function PPlanPage() {
  const { dbUser, isLoading, error } = useAppContext();
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => { setIsMounted(true); }, []);

  const planSections = useMemo(() => getPlanSections(dbUser), [dbUser]);
  // Используем имя пользователя в заголовке страницы, если оно есть
  const pageTitleName = useMemo(() => dbUser?.first_name || "Кибер-Волк", [dbUser]);
  const greetingName = useMemo(() => dbUser?.first_name || 'Боец', [dbUser]); // Для приветствия

  // Лоадер и ошибка без изменений
  if (!isMounted || isLoading) { return ( <div className="flex justify-center items-center min-h-screen pt-20 bg-gradient-to-br from-gray-900 via-black to-gray-800"> <p className="text-brand-cyan animate-pulse text-xl font-mono">Загрузка плана Кибер-Волка...</p> </div> ); }
   if (error) { return ( <div className="flex flex-col justify-center items-center min-h-screen pt-20 bg-gradient-to-br from-gray-900 via-black to-red-900/50"> <FaTriangleExclamation className="text-6xl text-red-500 mb-4"/> <p className="text-red-400 text-xl font-mono">Ошибка загрузки плана</p> <p className="text-red-500 mt-2 text-sm max-w-md text-center">{error.message}</p> <p className="text-gray-400 mt-4 text-xs">Перезагрузись.</p> </div> ); }

  const getBorderClass = (textColorClass: string): string => cn(textColorClass.replace('text-', 'border-'), 'border-gray-500');

  return (
    <div className="relative min-h-screen overflow-hidden pt-20 pb-10 bg-gradient-to-br from-dark-bg via-black to-purple-900/30 text-light-text">
       {/* Сетка фон */}
       <div className="absolute inset-0 bg-repeat opacity-[0.04] z-0 bg-grid-pattern"></div>
      <TooltipProvider delayDuration={150}>
        <div className="relative z-10 container mx-auto px-4">
          <Card className="max-w-4xl mx-auto bg-dark-card/85 backdrop-blur-lg text-light-text rounded-2xl border-2 border-brand-purple/40 shadow-[0_0_30px_rgba(157,0,255,0.3)]">
            <CardHeader className="text-center border-b border-brand-purple/20 pb-5">
              {/* Иконка Волка/Ниндзя */}
              <FaUserNinja className="text-6xl text-brand-purple mx-auto mb-4 animate-pulse" />
              {/* Адаптивный Заголовок */}
              <CardTitle className="text-3xl md:text-5xl font-bold text-brand-purple cyber-text glitch uppercase tracking-wider" data-text={`КИБЕР-ВОЛК: ${pageTitleName.toUpperCase()}`}>
                КИБЕР-ВОЛК: {pageTitleName.toUpperCase()}
              </CardTitle>
              {/* Обновленный подзаголовок */}
              <p className="text-md md:text-lg text-gray-300 mt-4 font-mono max-w-2xl mx-auto">
                 Твой План: От <span className="text-red-500">{greetingName === 'Санек' ? 'Сломанного Кардана' : 'Нуля'}</span> <FaCarCrash className="inline text-red-500"/> к <span className="text-neon-lime">AI-Бабкам</span> <FaMoneyBillWave className="inline text-neon-lime"/>. Грант {getPlanSections(dbUser)[7].content.includes('350 000') ? '350к' : 'XX к'}. <span className="text-xs opacity-70">(Версия для {greetingName})</span>
              </p>
            </CardHeader>
            <CardContent className="space-y-10 p-4 md:p-8">
              {planSections.map((section) => (
                   <details key={section.id} className={cn("group border-l-4 pl-4 rounded-r-md transition-all duration-300 ease-in-out open:bg-purple-900/10 open:pb-4 open:shadow-inner", getBorderClass(section.color))} open={['resume', 'finance', 'operations'].includes(section.id)}> {/* Открываем важные */}
                     <summary className={cn("text-2xl font-semibold cursor-pointer list-none flex items-center hover:opacity-80 transition-opacity", section.color)}>
                       {iconComponents[section.icon.name] && <section.icon className="mr-3 flex-shrink-0 group-open:animate-pulse" /> }
                       {section.title}
                     </summary>
                     <div className="mt-4 text-gray-300 text-base md:text-lg leading-relaxed space-y-3 pl-2 pr-1">
                       <RenderContent content={section.content} />
                       {/* Визуализации */}
                       {section.id === 'finance' && ( <div className="mt-4 p-3 border border-dashed border-gray-600 rounded-md bg-gray-800/40"> <p className="text-sm text-gray-400 italic text-center">[Диаграмма Гранта: ТЫ (60%), Маркетинг (25%), Твой Рост (5%), Аптечка (10%)]</p> </div> )}
                       {section.id === 'marketing' && ( <div className="mt-4 p-3 border border-dashed border-gray-600 rounded-md bg-gray-800/40"> <p className="text-sm text-gray-400 italic text-center">[Воронка: Контент (AI x10) -> Трафик -> Банда (TG) -> Бабки]</p> </div> )}
                     </div>
                   </details>
                ))}
              {/* Заключение */}
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
      
    </div>
  );
}
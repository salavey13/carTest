// /app/selfdev/page.tsx
"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import SupportForm from "@/components/SupportForm";
import { useAppContext } from "@/contexts/AppContext";
import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from "@/components/ui/tooltip";
import {
    FaLightbulb, FaRoad, FaUsers, FaRocket, FaCodeBranch,
    FaArrowsSpin, FaNetworkWired, FaBookOpen, FaComments, FaBrain, FaEye,
    FaFileCode, FaRobot, FaWandMagicSparkles, FaBullseye, FaEnvelopeOpenText,
    FaMagnifyingGlass, FaChartLine, FaRegLightbulb, FaListCheck, FaArrowUpRightFromSquare,
    FaSkullCrossbones, // Icon for negative framing
    FaShieldCat,      // Icon for protection/validation
    FaGamepad // Added for link
} from "react-icons/fa6";
import { debugLogger } from "@/lib/debugLogger";
import Link from "next/link";
import Image from "next/image";
import { cn } from "@/lib/utils"; // Import cn utility

// --- Component ---
export default function SelfDevLandingPage() {
  const { isAuthenticated, isLoading: isAuthLoading } = useAppContext();
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
    debugLogger.log("[SelfDevPage] Mounted. Auth loading:", isAuthLoading, "Is Authenticated:", isAuthenticated);
  }, [isAuthLoading, isAuthenticated]);

  // Tooltip descriptions (Refined for clarity and impact)
  const tooltipDescriptions: Record<string, string> = {
      's101.png': "Визуализация ловушки: Старый путь - поиск 'работы', следование чужим правилам, риск стать ненужным 'динозавром'. Новый путь (SelfDev) - создание жизни и дела вокруг ТЕБЯ.",
      's201.png': "Концепция 'Ты - Ниша': Как твои уникальные интересы, навыки, решенные проблемы и опыт становятся фундаментом аутентичного и осмысленного дела.",
      's301.png': "SelfDev Контент-Маркетинг: Регулярное создание ценного контента строит доверие и аудиторию органически, ведя к монетизации без агрессивных продаж.",
      's401.png': "Стратегия Роста: Начни с высокочековых услуг для узкой аудитории, затем, усиленный AI, создавай масштабируемые продукты (курсы, ПО) для широкого охвата.",
      's501.png': "Метод 'Интеллектуальной Имитации': Наблюдай -> Разбирай -> Имитируй элементы (не копируй!) -> Формируй свой уникальный стиль.",
      's601.png': "Фундамент Доверия: 'Контент Почему' (твоя история, философия) необходим, чтобы аудитория поняла твою ценность ДО покупки 'Контента Как' (продуктов/услуг).",
      's701.png': "AI - Твой Усилитель: Не замена, а симбиоз. Ты задаешь направление, AI многократно ускоряет процесс. Сила одного = сила команды.",
      's801.png': "AI Персонализация: Переход от безликих рассылок к созданию уникальных, релевантных сообщений для каждого, используя данные и автоматизацию. Ключ к Outbound.",
      // NEW Tooltips for Validation Framework (More benefit-focused)
      'validation-problem.png': "AI Находит Реальную Боль: Анализ форумов/соцсетей выявляет, действительно ли твоя идея решает чью-то проблему. Нет боли = сэкономленное время.",
      'validation-market.png': "AI Оценивает Рынок: Анализ трендов и запросов показывает, достаточно ли людей с этой болью. Маленький рынок = избегаешь пустой траты ресурсов.",
      'validation-competitors.png': "AI Ищет Преимущество: Изучение конкурентов помогает найти незакрытые ниши и 'голубые океаны'. Нет УТП = вовремя меняешь курс.",
      'validation-mvp.png': "AI-Тест Спроса (Fake Door): Быстро создай реалистичный лендинг для проверки интереса БЕЗ разработки продукта. Нет спроса = идея убита до затрат.",
  };

  if (!isMounted || isAuthLoading) {
    return (
      <div className="flex justify-center items-center min-h-screen pt-20 bg-gradient-to-br from-gray-900 via-black to-gray-800">
        <p className="text-brand-green animate-pulse text-xl font-mono">Загрузка философии VIBE...</p>
      </div>
    );
  }

  // --- Component Render ---
  return (
    <div className="relative min-h-screen overflow-hidden pt-20 pb-10 bg-gradient-to-br from-gray-900 via-black to-gray-800 text-gray-200">
      {/* Background Grid */}
      <div
        className="absolute inset-0 bg-repeat opacity-5 z-0"
        style={{
          backgroundImage: `linear-gradient(to right, rgba(0, 255, 157, 0.2) 1px, transparent 1px),
                            linear-gradient(to bottom, rgba(0, 255, 157, 0.2) 1px, transparent 1px)`,
          backgroundSize: '50px 50px',
        }}
      ></div>

      <TooltipProvider delayDuration={150}> {/* Slightly faster tooltips */}
          <div className="relative z-10 container mx-auto px-4">
            <Card className="max-w-5xl mx-auto bg-black/85 backdrop-blur-lg text-white rounded-2xl border border-brand-green/40 shadow-[0_0_30px_rgba(0,255,157,0.5)]">
              {/* Header - Stronger Identity Statement */}
              <CardHeader className="text-center border-b border-brand-green/25 pb-6">
                <CardTitle className="text-3xl md:text-5xl font-bold text-brand-green cyber-text glitch" data-text="SelfDev: Стань Бизнесом">
                  SelfDev: Стань Бизнесом
                </CardTitle>
                <p className="text-md md:text-lg text-gray-300 mt-4 font-mono tracking-wide">
                  Забудь модели. <strong className="text-brand-cyan font-semibold">ТЫ — лучшая бизнес-модель</strong>. Усиленная AI.
                </p>
                 {/* Added link to Gamified SelfDev */}
                 <p className="mt-3 text-sm text-gray-400">
                    Хочешь геймифицировать этот путь? Загляни сюда: <Link href="/selfdev/gamified" className="text-brand-yellow hover:underline font-semibold">Gamify Your Life <FaGamepad className="inline ml-1"/></Link>
                 </p>
              </CardHeader>

              <CardContent className="space-y-16 p-5 md:p-10"> {/* Increased spacing */}

                {/* Section 1: The Trap (Negative Dissociation) */}
                <section className="space-y-5">
                  <h2 className="flex items-center text-2xl md:text-3xl font-semibold text-brand-pink mb-5">
                    <FaSkullCrossbones className="mr-3 text-brand-pink/80" /> Ловушка Старой Парадигмы: Путь Динозавра
                  </h2>
                  <p className="text-gray-300 text-base md:text-lg leading-relaxed">
                    <strong className="text-brand-pink">Многие попадают в эту ловушку:</strong> ищут "лучшие" навыки, гонятся за чужими моделями, действуют из нужды. Они учатся по правилам системы, которая делает их <strong className="text-brand-pink font-semibold">заменяемыми специалистами, рискующими вымереть</strong>. Фокус только на деньгах <strong className="text-brand-pink">уводит от главного</strong> — от себя.
                  </p>
                  {/* Image with clearer negative framing */}
                  <div className="my-8 p-3 border border-brand-pink/40 rounded-xl bg-black/40">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span>
                          <div className="w-full overflow-hidden rounded-lg bg-gray-800/60 cursor-help shadow-inner shadow-pink-900/30">
                            <Image src="https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/about/s101.png" alt="Старый путь (ловушка) против Нового пути (свобода)" width={800} height={450} className="w-full h-auto object-contain" loading="lazy" />
                          </div>
                        </span>
                      </TooltipTrigger>
                      <TooltipContent side="bottom" className="max-w-[300px] text-center bg-gray-950 border border-brand-pink/60 text-white p-3 shadow-lg"> <p className="text-sm whitespace-pre-wrap">{tooltipDescriptions['s101.png']}</p> </TooltipContent>
                    </Tooltip>
                    <p className="text-xs text-center text-gray-400 mt-2 italic font-mono">Старый путь ведет в тупик. Есть другой.</p>
                  </div>
                </section>

                {/* Section 2: The Solution (Identity Framing - You are the Niche) */}
                <section className="space-y-5">
                  <h2 className="flex items-center text-2xl md:text-3xl font-semibold text-brand-blue mb-5">
                    <FaLightbulb className="mr-3 text-brand-blue/80" /> Новый Путь: Ты — Ниша (Путь Черепахи)
                  </h2>
                  <p className="text-gray-300 text-base md:text-lg leading-relaxed">
                    Настоящий вопрос: "Какую жизнь <strong className="text-brand-blue font-semibold">ТЫ</strong> хочешь?". Вместо поиска ниши, <strong className="text-brand-blue font-semibold">ТЫ становишься нишей</strong>. Ты решаешь <strong className="text-brand-blue font-semibold">СВОИ</strong> проблемы, помогаешь <strong className="text-brand-blue font-semibold">себе прошлому</strong>, строишь дело вокруг своей <strong className="text-brand-blue font-semibold">аутентичности</strong>. Это путь <strong className="text-brand-blue font-semibold">Черепахи</strong> — адаптивного генералиста, который <strong className="text-brand-blue">выживает и процветает</strong>. Деньги — <strong className="text-brand-blue font-semibold">ресурс</strong> для твоей жизни, не <strong className="text-brand-blue font-semibold">цель</strong>. <strong className="text-brand-blue">Адаптивность — твоя суперсила.</strong>
                  </p>
                   <div className="my-8 p-3 border border-brand-blue/40 rounded-xl bg-black/40">
                    <Tooltip>
                       <TooltipTrigger asChild>
                         <span>
                           <div className="w-full overflow-hidden rounded-lg bg-gray-800/60 cursor-help shadow-inner shadow-blue-900/30">
                             <Image src="https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/about/s201.png" alt="Майнд-карта: Построение бизнеса вокруг себя" width={800} height={450} className="w-full h-auto object-contain" loading="lazy" />
                           </div>
                         </span>
                       </TooltipTrigger>
                       <TooltipContent side="bottom" className="max-w-[300px] text-center bg-gray-950 border border-brand-blue/60 text-white p-3 shadow-lg"> <p className="text-sm whitespace-pre-wrap">{tooltipDescriptions['s201.png']}</p> </TooltipContent>
                    </Tooltip>
                     <p className="text-xs text-center text-gray-400 mt-2 italic font-mono">Твои интересы, навыки и решенные проблемы - твоя уникальная основа.</p>
                  </div>
                </section>

                {/* Section: AI as YOUR Amplifier */}
                 <section className="space-y-5">
                   <h2 className="flex items-center text-2xl md:text-3xl font-semibold text-brand-cyan mb-5">
                     <FaRobot className="mr-3 text-brand-cyan/80" /> AI — Твой Персональный Усилитель
                   </h2>
                   <p className="text-gray-300 text-base md:text-lg leading-relaxed">
                     Ключевая мысль: <strong className="text-brand-cyan font-semibold">AI не заменит ТЕБЯ</strong>. Тебя заменит <strong className="text-brand-cyan font-semibold">человек, использующий AI эффективнее</strong>. Представь AI как твоего ко-пилота, твой экзоскелет, позволяющий <strong className="text-brand-cyan">ТЕБЕ одному</strong> делать работу целой команды. Это <strong className="text-brand-cyan">освобождает твое время</strong> для главного — стратегии и творчества.
                   </p>
                   <div className="my-8 p-3 border border-brand-cyan/40 rounded-xl bg-black/40">
                     <Tooltip>
                       <TooltipTrigger asChild>
                         <span>
                           <div className="w-full overflow-hidden rounded-lg bg-gray-800/60 cursor-help shadow-inner shadow-cyan-900/30">
                             <Image src="https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/carpix/IMG_20250511_223650-b874485f-4d99-4c4e-973e-603cf8b6b78a.jpg" alt="AI как усилитель человеческих возможностей" width={800} height={450} className="w-full h-auto object-contain" loading="lazy" />
                           </div>
                         </span>
                       </TooltipTrigger>
                       <TooltipContent side="bottom" className="max-w-[300px] text-center bg-gray-950 border border-brand-cyan/60 text-white p-3 shadow-lg"> <p className="text-sm whitespace-pre-wrap">{tooltipDescriptions['s701.png']}</p> </TooltipContent>
                     </Tooltip>
                     <p className="text-xs text-center text-gray-400 mt-2 italic font-mono">AI - твой партнер в достижении ТВОИХ целей.</p>
                   </div>
                   <p className="text-gray-300 text-base md:text-lg leading-relaxed font-semibold text-brand-cyan mb-3">Вот как AI УСИЛИВАЕТ ТЕБЯ:</p>
                   {/* Updated list with stronger framing */}
                   <ul className="list-none space-y-3 text-gray-300 pl-2 text-base md:text-lg leading-relaxed">
                      <li className="flex items-start"><FaListCheck className="flex-shrink-0 mr-3 mt-1 text-cyan-400"/><strong className="text-brand-cyan font-semibold mr-2">Контент х50:</strong> Преврати одно интервью в 50+ активов (клипы, статьи, визуал) — OpusClip, Canva, Claude, CastMagic.</li>
                      <li className="flex items-start"><FaComments className="flex-shrink-0 mr-3 mt-1 text-cyan-400"/><strong className="text-brand-cyan font-semibold mr-2">Твоя Коммуникация:</strong> Создавай уникальные email (ChatGPT), адаптивные sales-цепочки, сохраняй твой голос бренда, автоматизируй документацию.</li>
                      <li className="flex items-start"><FaWandMagicSparkles className="flex-shrink-0 mr-3 mt-1 text-cyan-400"/><strong className="text-brand-cyan font-semibold mr-2">Визуал за Минуты:</strong> Получи 20 концептов за 20 минут (Midjourney) вместо дней ожидания дизайнера.</li>
                      <li className="flex items-start"><FaRocket className="flex-shrink-0 mr-3 mt-1 text-cyan-400"/><strong className="text-brand-cyan font-semibold mr-2">Твой E-commerce:</strong> Доверь AI описания, email-маркетинг, оптимизацию логистики (Shopify AI).</li>
                      <li className="flex items-start"><FaArrowsSpin className="flex-shrink-0 mr-3 mt-1 text-cyan-400"/><strong className="text-brand-cyan font-semibold mr-2">Автоматизация Рутины:</strong> Освободи время, связав приложения через AI (Zapier, Make).</li>
                      <li className="flex items-start"><FaRobot className="flex-shrink-0 mr-3 mt-1 text-cyan-400"/><strong className="text-brand-cyan font-semibold mr-2">AI-Агенты для Тебя:</strong> Поручи автономные задачи (research, email) умным агентам (Lindy, n8n).</li>
                      <li className="flex items-start"><FaBrain className="flex-shrink-0 mr-3 mt-1 text-cyan-400"/><strong className="text-brand-cyan font-semibold mr-2">Твой AI-Советник:</strong> Используй AI для критического анализа СВОИХ идей, получай второе мнение.</li>
                   </ul>
                 </section>

                 {/* Section: AI Validation (Framed as Protection/Control) */}
                <section id="validation" className="space-y-5 border-t border-yellow-500/40 pt-10 mt-12">
                  <h2 className="flex items-center text-2xl md:text-3xl font-semibold text-brand-yellow mb-5">
                    <FaShieldCat className="mr-3 text-brand-yellow/80" /> AI-Валидация: Убей Провальные Идеи ДО Старта
                  </h2>
                  <p className="text-gray-300 text-base md:text-lg leading-relaxed">
                     <strong className="text-brand-yellow">9 из 10 бизнесов проваливаются.</strong> Почему? Строят то, что <strong className="text-brand-yellow font-semibold">никому не нужно</strong>. Это слив времени и денег. <strong className="text-brand-yellow font-semibold">AI — твой щит от этого.</strong> Вместо месяцев слепой разработки — 72 часа на жесткую проверку реальности. <strong className="text-brand-yellow">Хватит гадать — пора знать.</strong>
                   </p>
                   <p className="text-gray-300 text-base md:text-lg leading-relaxed font-semibold text-brand-yellow mb-4">Твой 5-Шаговый AI-Фильтр (Метод Тома Билью):</p>
                   <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mt-6">
                     {/* Step 1 */}
                     <div className="p-5 bg-gray-800/60 border border-yellow-600/50 rounded-xl shadow-lg shadow-yellow-900/20">
                       <h3 className="flex items-center text-lg font-semibold text-yellow-400 mb-3"><span className="text-2xl mr-3">1</span><FaMagnifyingGlass className="mr-2"/> Проверка Реальной Боли</h3>
                       <p className="text-sm text-gray-300 mb-4">Скорми AI (Perplexity, ChatGPT) треды Reddit, форумы, отзывы по твоей теме. <strong className="text-yellow-300">Задача:</strong> найти повторяющиеся жалобы, неудовлетворенность. <strong className="text-brand-yellow">Вердикт:</strong> Нет четкой боли = УБИТЬ ИДЕЮ.</p>
                       <Tooltip> <TooltipTrigger asChild><span><div className="w-full overflow-hidden rounded-md bg-gray-700/40 cursor-help border border-yellow-700/30"><Image src="https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/about//IMG_20250516_051010-f752ec83-2b15-45cc-9769-2b68e4d8d1a5.jpg" alt="AI ищет боль пользователей" width={400} height={225} className="w-full h-auto object-cover opacity-60 hover:opacity-90 transition-opacity" loading="lazy"/></div></span></TooltipTrigger> <TooltipContent side="bottom" className="max-w-[250px] bg-gray-950 border border-yellow-600/60 text-white p-2"><p className="text-xs">{tooltipDescriptions['validation-problem.png']}</p></TooltipContent> </Tooltip>
                     </div>
                      {/* Step 2 */}
                     <div className="p-5 bg-gray-800/60 border border-yellow-600/50 rounded-xl shadow-lg shadow-yellow-900/20">
                       <h3 className="flex items-center text-lg font-semibold text-yellow-400 mb-3"><span className="text-2xl mr-3">2</span><FaChartLine className="mr-2"/> Оценка Объема Рынка</h3>
                       <p className="text-sm text-gray-300 mb-4">Боль есть? Отлично. Теперь: <strong className="text-yellow-300">достаточно ли людей</strong> готовы платить за решение? AI анализирует Google Trends, объем поиска, TAM. <strong className="text-brand-yellow">Вердикт:</strong> Рынок микроскопический = УБИТЬ ИДЕЮ.</p>
                       <Tooltip> <TooltipTrigger asChild><span><div className="w-full overflow-hidden rounded-md bg-gray-700/40 cursor-help border border-yellow-700/30"><Image src="/placeholders/validation-market.png" alt="AI анализирует размер рынка" width={400} height={225} className="w-full h-auto object-cover opacity-60 hover:opacity-90 transition-opacity" loading="lazy"/></div></span></TooltipTrigger> <TooltipContent side="bottom" className="max-w-[250px] bg-gray-950 border border-yellow-600/60 text-white p-2"><p className="text-xs">{tooltipDescriptions['validation-market.png']}</p></TooltipContent> </Tooltip>
                     </div>
                      {/* Step 3 */}
                     <div className="p-5 bg-gray-800/60 border border-yellow-600/50 rounded-xl shadow-lg shadow-yellow-900/20">
                       <h3 className="flex items-center text-lg font-semibold text-yellow-400 mb-3"><span className="text-2xl mr-3">3</span><FaEye className="mr-2"/> Анализ Конкурентов</h3>
                       <p className="text-sm text-gray-300 mb-4">Скорми AI сайты, цены, отзывы <strong className="text-yellow-300">топ-5 конкурентов</strong>. <strong className="text-yellow-300">Задача:</strong> найти их слабые места, неудовлетворенные потребности клиентов, возможности для тебя. <strong className="text-brand-yellow">Вердикт:</strong> Нет явного УТП = УБИТЬ ИДЕЮ.</p>
                       <Tooltip> <TooltipTrigger asChild><span><div className="w-full overflow-hidden rounded-md bg-gray-700/40 cursor-help border border-yellow-700/30"><Image src="/placeholders/validation-competitors.png" alt="AI анализирует конкурентов" width={400} height={225} className="w-full h-auto object-cover opacity-60 hover:opacity-90 transition-opacity" loading="lazy"/></div></span></TooltipTrigger> <TooltipContent side="bottom" className="max-w-[250px] bg-gray-950 border border-yellow-600/60 text-white p-2"><p className="text-xs">{tooltipDescriptions['validation-competitors.png']}</p></TooltipContent> </Tooltip>
                     </div>
                     {/* Step 4 */}
                     <div className="p-5 bg-gray-800/60 border border-yellow-600/50 rounded-xl shadow-lg shadow-yellow-900/20">
                       <h3 className="flex items-center text-lg font-semibold text-yellow-400 mb-3"><span className="text-2xl mr-3">4</span><FaRegLightbulb className="mr-2"/> MVP Тест ('Fake Door')</h3>
                       <p className="text-sm text-gray-300 mb-4"><strong className="text-brand-yellow">Не строй продукт!</strong> Используй AI, чтобы <strong className="text-yellow-300">за 1 час</strong> создать лендинг, описывающий твое решение как <strong className="text-yellow-300">уже готовое</strong>. Запусти трафик, собирай email/предоплаты. <strong className="text-brand-yellow">Вердикт:</strong> Нет интереса = УБИТЬ ИДЕЮ.</p>
                       <Tooltip> <TooltipTrigger asChild><span><div className="w-full overflow-hidden rounded-md bg-gray-700/40 cursor-help border border-yellow-700/30"><Image src="/placeholders/validation-mvp.png" alt="AI создает 'fake door' MVP" width={400} height={225} className="w-full h-auto object-cover opacity-60 hover:opacity-90 transition-opacity" loading="lazy"/></div></span></TooltipTrigger> <TooltipContent side="bottom" className="max-w-[250px] bg-gray-950 border border-yellow-600/60 text-white p-2"><p className="text-xs">{tooltipDescriptions['validation-mvp.png']}</p></TooltipContent> </Tooltip>
                     </div>
                   </div>
                   <p className="text-gray-300 text-base md:text-lg leading-relaxed mt-8 text-center">
                     <strong className="text-brand-yellow font-semibold text-xl">Шаг 5: Строй Только То, Что Прошло Фильтр.</strong><br />
                     Если идея выжила — <strong className="text-brand-yellow font-semibold">поздравляю, ты нашел то, что нужно людям</strong>. Теперь используй AI для ускорения разработки (см. <Link href="/repo-xml" className="text-brand-blue hover:underline">СуперВайб Студию</Link>).
                   </p>
                </section>

                {/* Section: AI Outbound */}
                <section className="space-y-5">
                  <h2 className="flex items-center text-2xl md:text-3xl font-semibold text-neon-lime mb-5">
                    <FaEnvelopeOpenText className="mr-3 text-neon-lime/80" /> Твой AI Outbound: Персонализация в Масштабе
                  </h2>
                  <p className="text-gray-300 text-base md:text-lg leading-relaxed">
                     Забудь безликие, раздражающие рассылки, которые никто не читает. AI позволяет тебе создавать <strong className="text-neon-lime font-semibold">глубоко персонализированные</strong>, релевантные сообщения для тысяч потенциальных клиентов, <strong className="text-neon-lime">многократно увеличивая конверсию</strong>. Это твой ключ к <strong className="text-neon-lime font-semibold">эффективному Outbound Sales</strong>, даже если ты работаешь один.
                   </p>
                   <div className="my-8 p-3 border border-neon-lime/40 rounded-xl bg-black/40">
                     <Tooltip>
                       <TooltipTrigger asChild>
                         <span>
                           <div className="w-full overflow-hidden rounded-lg bg-gray-800/60 cursor-help shadow-inner shadow-lime-900/30">
                             <Image src="https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/about/s801.png" alt="Персонализация аутрича с помощью AI" width={800} height={450} className="w-full h-auto object-contain" loading="lazy" />
                           </div>
                         </span>
                       </TooltipTrigger>
                       <TooltipContent side="bottom" className="max-w-[300px] text-center bg-gray-950 border border-neon-lime/60 text-white p-3 shadow-lg"> <p className="text-sm whitespace-pre-wrap">{tooltipDescriptions['s801.png']}</p> </TooltipContent>
                     </Tooltip>
                     <p className="text-xs text-center text-gray-400 mt-2 italic font-mono">От спама к точечным, ценным контактам.</p>
                   </div>
                   <p className="text-gray-300 text-base md:text-lg leading-relaxed font-semibold text-neon-lime mb-3">Как ТЫ это делаешь с AI:</p>
                   <ol className="list-decimal list-inside space-y-3 text-gray-300 pl-4 text-base md:text-lg leading-relaxed">
                      <li><strong className="text-neon-lime font-semibold">Находишь Лидов:</strong> AI помогает найти твоих идеальных клиентов.</li>
                      <li><strong className="text-neon-lime font-semibold">Обогащаешь Данные:</strong> AI (<strong className="text-neon-lime font-semibold">Clay</strong>) собирает контекст: посты, новости, технологии, которые они используют.</li>
                      <li><strong className="text-neon-lime font-semibold">AI Пишет за Тебя:</strong> ChatGPT/Claude создают <strong className="text-neon-lime font-semibold">уникальные, релевантные письма</strong> для КАЖДОГО ("Видел твой пост о...", "Заметил, вы внедрили...", "Поздравляю с...").</li>
                      <li><strong className="text-neon-lime font-semibold">Автоматизируешь Отправку:</strong> Инструменты (<strong className="text-neon-lime font-semibold">Outbond, HeyReach</strong>) отправляют эти персонализированные цепочки писем.</li>
                   </ol>
                 </section>

                {/* Section: Evolving Offers */}
                <section className="space-y-5">
                   <h2 className="flex items-center text-2xl md:text-3xl font-semibold text-brand-orange mb-5">
                     <FaArrowsSpin className="mr-3 text-brand-orange/80" /> Твоя Эволюция: От Услуг к Продуктам с AI
                   </h2>
                   <p className="text-gray-300 text-base md:text-lg leading-relaxed">
                     Твой бизнес <strong className="text-brand-orange">растет вместе с тобой</strong>. AI — твой катализатор масштабирования, позволяющий перейти от продажи времени к созданию активов.
                   </p>
                   <div className="my-8 p-3 border border-brand-orange/40 rounded-xl bg-black/40">
                     <Tooltip>
                       <TooltipTrigger asChild>
                         <span>
                           <div className="w-full overflow-hidden rounded-lg bg-gray-800/60 cursor-help shadow-inner shadow-orange-900/30">
                             <Image src="https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/about/4-9a800381-390b-4153-a1a8-dae1f8850088.png" alt="Эволюция предложений с ростом аудитории" width={800} height={450} className="w-full h-auto object-contain" loading="lazy" />
                           </div>
                         </span>
                       </TooltipTrigger>
                       <TooltipContent side="bottom" className="max-w-[300px] text-center bg-gray-950 border border-brand-orange/60 text-white p-3 shadow-lg"> <p className="text-sm whitespace-pre-wrap">{tooltipDescriptions['s401.png']}</p> </TooltipContent>
                     </Tooltip>
                     <p className="text-xs text-center text-gray-400 mt-2 italic font-mono">Твой путь: от индивидуальной работы к масштабируемым активам.</p>
                   </div>
                   <ul className="list-disc list-inside space-y-2 text-gray-300 pl-4 text-base md:text-lg leading-relaxed">
                      <li><strong className="text-brand-orange font-semibold">Старт:</strong> Фокусируйся на <strong className="text-brand-orange font-semibold">высокочековых услугах</strong> (фриланс, коучинг, консалтинг). Быстрый кэшфлоу, глубокое понимание рынка.</li>
                      <li><strong className="text-brand-orange font-semibold">Рост:</strong> Создавай <strong className="text-brand-orange font-semibold">масштабируемые продукты</strong>. Используй AI для <strong className="text-brand-orange">ускорения разработки</strong> курсов, ПО, шаблонов, сообществ.</li>
                   </ul>
                   <p className="text-gray-300 text-base md:text-lg leading-relaxed">
                     AI помогает <strong className="text-brand-orange font-semibold">сократить время</strong> на создание продуктов, <strong className="text-brand-orange font-semibold">увеличить доход</strong> и вернуть <strong className="text-brand-orange font-semibold">ТЕБЕ контроль</strong> над твоим временем.
                   </p>
                 </section>

                {/* Section 5: How to Start (Actionable & Identity-Based) */}
                <section className="space-y-5">
                   <h2 className="flex items-center text-2xl md:text-3xl font-semibold text-brand-purple mb-5">
                      <FaWandMagicSparkles className="mr-3 text-brand-purple/80" /> Как Тебе Начать: Стань Продакт-Менеджером Себя
                   </h2>
                   <p className="text-gray-300 text-base md:text-lg leading-relaxed">
                     Забудь о пассивном обучении. Учись как <strong className="text-brand-purple font-semibold">продвинутый практик</strong>: наблюдай за лучшими, <strong className="text-brand-purple font-semibold">разбирай их методологию</strong> (а не только результат), быстро экспериментируй с отдельными элементами. <strong className="text-brand-purple font-semibold">Ты — продакт-менеджер</strong> своего пути.
                   </p>
                   <div className="my-8 p-3 border border-brand-purple/40 rounded-xl bg-black/40">
                     <Tooltip>
                       <TooltipTrigger asChild>
                         <span>
                           <div className="w-full overflow-hidden rounded-lg bg-gray-800/60 cursor-help shadow-inner shadow-purple-900/30">
                             <Image src="https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/about/s501.png" alt="Процесс Интеллектуальной Имитации" width={800} height={450} className="w-full h-auto object-contain" loading="lazy" />
                           </div>
                         </span>
                       </TooltipTrigger>
                       <TooltipContent side="bottom" className="max-w-[300px] text-center bg-gray-950 border border-brand-purple/60 text-white p-3 shadow-lg"> <p className="text-sm whitespace-pre-wrap">{tooltipDescriptions['s501.png']}</p> </TooltipContent>
                     </Tooltip>
                      <p className="text-xs text-center text-gray-400 mt-2 italic font-mono">Учись через наблюдение, деконструкцию и быструю имитацию.</p>
                   </div>
                   <ol className="list-decimal list-inside space-y-4 text-gray-300 pl-4 text-base md:text-lg leading-relaxed">
                     <li><strong className="text-brand-purple font-semibold">Собери Референсы:</strong> <FaEye className="inline mr-1 mb-1 text-brand-purple/80"/> Найди 3-5 человек/продуктов, которые тебя <strong className="text-brand-purple">вдохновляют</strong> в твоей сфере.</li>
                     <li><strong className="text-brand-purple font-semibold">Разбери Их Систему:</strong> <FaFileCode className="inline mr-1 mb-1 text-brand-purple/80"/> Не просто смотри, а <strong className="text-brand-purple">анализируй</strong>: как они строят контент? Какая структура? Какой стиль? Какая <strong className="text-brand-purple font-semibold">методология</strong> за этим стоит?</li>
                     <li><strong className="text-brand-purple font-semibold">Имитируй Маленький Кусочек:</strong> <FaCodeBranch className="inline mr-1 mb-1 text-brand-purple/80"/> <strong className="text-brand-purple">Не копируй всё!</strong> Возьми <strong className="text-brand-purple font-semibold">один</strong> элемент (структуру поста, тип визуала, подход к заголовку) и <strong className="text-brand-purple">попробуй применить</strong> в своем контексте. Используй AI <Link href="/repo-xml" className="text-brand-blue hover:underline font-semibold inline-flex items-center">(СуперВайб Студию <FaArrowUpRightFromSquare className="inline h-3 w-3 ml-1"/>)</Link> для <strong className="text-brand-purple">мгновенной</strong> генерации вариантов.</li>
                     <li><strong className="text-brand-purple font-semibold">Повторяй и Комбинируй:</strong> <FaArrowsSpin className="inline mr-1 mb-1 text-brand-purple/80"/> Пробуй разные элементы от разных референсов. Постепенно ты <strong className="text-brand-purple font-semibold">сформируешь свой уникальный, аутентичный стиль</strong>.</li>
                     <li><strong className="text-brand-purple font-semibold">Углубляй Понимание:</strong> <FaBrain className="inline mr-1 mb-1 text-brand-purple/80"/> Параллельно изучай теорию (маркетинг, психология, дизайн), чтобы понимать <strong className="text-brand-purple font-semibold">"почему"</strong> это работает. Используй AI для быстрого поиска и суммирования информации.</li>
                   </ol>
                   {/* Subsections with stronger call to action */}
                   <h3 className="flex items-center text-xl font-semibold text-brand-purple mt-8 mb-3">
                     <FaNetworkWired className="mr-2 text-brand-purple/80" /> Стань Частью "Племени"
                   </h3>
                   <p className="text-gray-300 text-base md:text-lg leading-relaxed"> Найди 5-10 ключевых людей/сообществ в твоей нише. <strong className="text-brand-purple">Не будь невидимкой!</strong> Комментируй их контент <strong className="text-brand-purple font-semibold">осмысленно</strong> (AI поможет сформулировать), делись <strong className="text-brand-purple">своим</strong> релевантным контентом, пиши в ЛС <strong className="text-brand-purple">(цель - контакт, а не продажа!)</strong>. </p>
                   <h3 className="flex items-center text-xl font-semibold text-brand-purple mt-8 mb-3">
                      <FaComments className="mr-2 text-brand-purple/80" /> Пиши Комментарии, Которые Замечают
                   </h3>
                   <p className="text-gray-300 text-base md:text-lg leading-relaxed"> Забудь про "Классный пост!". Это шум. <strong className="text-brand-purple font-semibold">Чтобы тебя заметили,</strong> начни комментарий с <strong className="text-brand-purple font-semibold">"Я помню, когда..."</strong> или <strong className="text-brand-purple font-semibold">"Это напомнило мне..."</strong> и расскажи <strong className="text-brand-purple font-semibold">короткую, релевантную историю</strong> или поделись наблюдением. Это вызывает <strong className="text-brand-purple">любопытство и создает связь</strong>. AI может помочь найти такие истории в твоем опыте. </p>
                </section>

                {/* Section 6: Cornerstone Content (Framed as Foundation of Trust) */}
                <section className="space-y-5">
                   <h2 className="flex items-center text-2xl md:text-3xl font-semibold text-brand-green mb-5">
                     <FaBookOpen className="mr-3 text-brand-green/80" /> Твой Фундамент: Контент, Строящий Доверие
                   </h2>
                   <p className="text-gray-300 text-base md:text-lg leading-relaxed">
                     Прежде чем люди <strong className="text-brand-green">купят у тебя</strong>, они должны <strong className="text-brand-green font-semibold">понять тебя и довериться тебе</strong>. Создай <strong className="text-brand-green font-semibold">"Контент Почему"</strong> — твой информационный фундамент. AI поможет тебе его структурировать и написать.
                   </p>
                   <div className="my-8 p-3 border border-brand-green/40 rounded-xl bg-black/40">
                     <Tooltip>
                        <TooltipTrigger asChild>
                          <span>
                            <div className="w-full overflow-hidden rounded-lg bg-gray-800/60 cursor-help shadow-inner shadow-green-900/30">
                              <Image src="https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/about//6-f7ea171b-8d11-4ca0-bb81-1b4965ea03ad.png" alt="Фундаментальный контент как основа доверия" width={800} height={450} className="w-full h-auto object-contain" loading="lazy" />
                            </div>
                          </span>
                        </TooltipTrigger>
                        <TooltipContent side="bottom" className="max-w-[300px] text-center bg-gray-950 border border-brand-green/60 text-white p-3 shadow-lg"> <p className="text-sm whitespace-pre-wrap">{tooltipDescriptions['s601.png']}</p> </TooltipContent>
                     </Tooltip>
                      <p className="text-xs text-center text-gray-400 mt-2 italic font-mono">Сначала доверие и понимание, потом продажа.</p>
                   </div>
                   <p className="text-gray-300 text-base md:text-lg leading-relaxed">
                     <strong className="text-brand-green font-semibold">Контент "Почему" (Твой фундамент, ~80% усилий):</strong> Твоя <strong className="text-brand-green font-semibold">история</strong> (почему ты этим занимаешься?), <strong className="text-brand-green font-semibold">основы твоей темы</strong> (простыми словами), <strong className="text-brand-green font-semibold">важность</strong> проблемы, которую ты решаешь, <strong className="text-brand-green">связь</strong> с реальной жизнью твоей аудитории. Рассчитан на новичков и средний уровень. <strong className="text-brand-green">Цель:</strong> Построить доверие, показать твою экспертизу и уникальность. AI поможет с идеями, структурой, черновиками.
                   </p>
                   <p className="text-gray-300 text-base md:text-lg leading-relaxed">
                     <strong className="text-brand-green font-semibold">Продукты "Как" (Твои предложения, ~20%):</strong> Платные (или лид-магниты) <strong className="text-brand-green font-semibold">конкретные инструкции, инструменты, решения</strong>. Рассчитаны на тех, кто уже <strong className="text-brand-green">тебе доверяет</strong> и готов идти дальше (средний/продвинутый уровень). AI поможет с разработкой и структурированием.
                   </p>
                 </section>

                {/* Call to Action (More Engaging) */}
                <section className="space-y-6 border-t border-brand-green/30 pt-10 mt-12 text-center">
                   <h2 className="flex items-center justify-center text-2xl md:text-3xl font-semibold text-brand-green mb-5">
                     <FaRocket className="mr-3 text-brand-green/80" /> Твой Путь Начинается Сейчас.
                   </h2>
                   <p className="text-gray-300 text-base md:text-lg leading-relaxed max-w-3xl mx-auto">
                      Путь SelfDev — это марафон по созданию <strong className="text-brand-green font-semibold">твоей идеальной жизни и дела</strong>. Да, это требует усилий, но это <strong className="text-brand-green font-semibold">инвестиции в себя</strong>. Платформа <strong className="text-brand-green font-semibold">oneSitePls</strong> и инструменты вроде <Link href="/repo-xml" className="text-brand-blue hover:underline font-semibold inline-flex items-center">СуперВайб Студии <FaArrowUpRightFromSquare className="inline h-3 w-3 ml-1"/></Link> созданы, чтобы <strong className="text-brand-green font-semibold">драматически ускорить</strong> твой прогресс, используя AI как твоего личного помощника. Глубже понять философию можно на странице <Link href="/purpose-profit" className="text-brand-purple hover:underline font-semibold inline-flex items-center">Purpose & Profit <FaArrowUpRightFromSquare className="inline h-3 w-3 ml-1"/></Link>.
                   </p>
                    <p className="text-gray-300 text-base md:text-lg leading-relaxed max-w-3xl mx-auto mt-5">
                      Изучи <Link href="/about" className="text-brand-blue hover:underline font-semibold inline-flex items-center">мою историю <FaArrowUpRightFromSquare className="inline h-3 w-3 ml-1"/></Link> как пример SelfDev пути. Взгляни на <a href="https://github.com/salavey13/carTest" target="_blank" rel="noopener noreferrer" className="text-brand-blue hover:underline font-semibold inline-flex items-center">репозиторий oneSitePls <FaArrowUpRightFromSquare className="inline h-3 w-3 ml-1"/></a> как на пример VIBE-разработки. <strong className="text-brand-green">Если ты готов действовать и нужна помощь</strong> — свяжись для менторства или консультации через форму ниже.
                    </p>
                    {/* Support Form Section */}
                    <div className="mt-10 max-w-md mx-auto border border-brand-green/20 p-6 rounded-xl bg-black/50">
                       <h3 className="text-xl font-semibold text-brand-green mb-5">Нужна Помощь или Ускорение?</h3>
                       <SupportForm />
                    </div>
                 </section>

              </CardContent>
            </Card>
          </div>
      </TooltipProvider>
    </div>
  );
}
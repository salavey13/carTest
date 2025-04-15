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
    FaMagnifyingGlass, FaChartLine, FaRegLightbulb, FaListCheck, // Added icons for validation/amplification
} from "react-icons/fa6";
import { debugLogger } from "@/lib/debugLogger";
import Link from "next/link";
import Image from "next/image";

// --- Component ---
export default function SelfDevLandingPage() {
  const { isAuthenticated, isLoading: isAuthLoading } = useAppContext();
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
    debugLogger.log("[SelfDevPage] Mounted. Auth loading:", isAuthLoading, "Is Authenticated:", isAuthenticated);
  }, [isAuthLoading, isAuthenticated]);

  // Tooltip descriptions (kept existing, added new placeholders)
  const tooltipDescriptions: Record<string, string> = {
      's101.png': "Визуализация ловушки традиционного подхода к карьере (поиск 'работы', следование чужим правилам) в сравнении с путём SelfDev, ориентированным на создание жизни и бизнеса вокруг своей аутентичности и решения собственных проблем.",
      's201.png': "Майнд-карта, иллюстрирующая концепцию 'стать нишей': как ваши личные интересы, уникальные навыки, решенные проблемы и жизненный опыт становятся фундаментом для построения аутентичного и осмысленного бизнеса.",
      's301.png': "Схематическое изображение воронки контент-маркетинга в парадигме SelfDev: как регулярное создание ценного, резонирующего с вами контента приводит к органическому построению доверия, росту лояльной аудитории и, как следствие, к возможностям монетизации без агрессивных продаж.",
      's401.png': "Диаграмма, показывающая стратегию эволюции ваших предложений по мере роста вашей экспертизы и аудитории: начиная с высокочековых услуг (фриланс, консалтинг) для небольшой аудитории и постепенно переходя к созданию масштабируемых продуктов (курсы, ПО, шаблоны) для более широкого охвата.",
      's501.png': "Инфографика, описывающая практические шаги метода 'интеллектуальной имитации' для обучения и старта: наблюдение за успешными примерами в вашей сфере, деконструкция их ключевых элементов, имитация отдельных частей (не копирование!) и постепенное формирование собственного уникального стиля и подхода.",
      's601.png': "Визуальная метафора: создание основополагающего 'контента Почему' (ваша история, философия, основы темы) как прочного фундамента. Этот контент необходим для того, чтобы аудитория поняла вашу ценность и начала вам доверять, прежде чем покупать 'контент Как' (продукты/услуги).",
      's701.png': "Визуализация того, как AI-инструменты (чат-боты, код, автоматизация, анализ данных) усиливают возможности человека, а не заменяют его. Это симбиоз, где человек задает направление, а AI ускоряет процесс.",
      's801.png': "Инфографика показывает, как AI позволяет перейти от массовых рассылок к созданию уникальных, персонализированных сообщений для каждого потенциального клиента, используя обогащенные данные и автоматизацию.",
      // NEW Tooltips for Validation Framework
      'validation-problem.png': "AI (Perplexity, ChatGPT) анализирует форумы и соцсети, выявляя реальные 'боли' пользователей, связанные с вашей идеей. Нет боли = нет идеи.",
      'validation-market.png': "AI оценивает размер потенциального рынка, анализируя Google Trends, объем поисковых запросов и данные TAM. Слишком маленький рынок = не стоит усилий.",
      'validation-competitors.png': "AI изучает сайты и отзывы конкурентов, чтобы найти незакрытые потребности и 'голубые океаны' на рынке. Нет явного преимущества = подумай еще раз.",
      'validation-mvp.png': "Вместо долгой разработки, AI помогает быстро создать 'fake door' MVP - реалистичный лендинг для проверки спроса без реального продукта.",
  };

  if (!isMounted || isAuthLoading) {
    return (
      <div className="flex justify-center items-center min-h-screen pt-20 bg-gradient-to-br from-gray-900 via-black to-gray-800">
        <p className="text-brand-green animate-pulse text-xl font-mono">Загрузка философии VIBE...</p>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen overflow-hidden pt-20 pb-10 bg-gradient-to-br from-gray-900 via-black to-gray-800 text-gray-200">
      <div
        className="absolute inset-0 bg-repeat opacity-5 z-0"
        style={{
          backgroundImage: `linear-gradient(to right, rgba(0, 255, 157, 0.2) 1px, transparent 1px),
                            linear-gradient(to bottom, rgba(0, 255, 157, 0.2) 1px, transparent 1px)`,
          backgroundSize: '50px 50px',
        }}
      ></div>

      <TooltipProvider delayDuration={200}>
          <div className="relative z-10 container mx-auto px-4">
            <Card className="max-w-5xl mx-auto bg-black/80 backdrop-blur-md text-white rounded-2xl border border-brand-green/30 shadow-[0_0_25px_rgba(0,255,157,0.4)]">
              <CardHeader className="text-center border-b border-brand-green/20 pb-4">
                <CardTitle className="text-3xl md:text-5xl font-bold text-brand-green cyber-text glitch" data-text="SelfDev: Путь к Себе">
                  SelfDev: Путь к Себе
                </CardTitle>
                <p className="text-md md:text-lg text-gray-300 mt-3 font-mono">
                  Лучшая бизнес-модель — это не модель. Это ТЫ. Усиленный AI.
                </p>
              </CardHeader>

              <CardContent className="space-y-12 p-4 md:p-8">

                {/* .. Section 1: The Old Paradigm Trap */}
                <section className="space-y-4">
                  <h2 className="flex items-center text-2xl md:text-3xl font-semibold text-brand-pink mb-4">
                    <FaRoad className="mr-3 text-brand-pink/80" /> Ловушка Старой Парадигмы
                  </h2>
                  <p className="text-gray-300 text-base md:text-lg leading-relaxed">
                    Многие ищут "лучшие" навыки/модели, чтобы заработать. Они учатся по чужим правилам, действуя из нужды. Это путь <strong className="text-brand-pink font-semibold">Динозавра</strong> — специалиста, который рискует вымереть. Фокус только на деньгах уводит от главного.
                  </p>
                  <div className="my-6 p-2 border border-brand-pink/30 rounded-lg bg-black/30">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div className="aspect-square w-full h-auto overflow-hidden rounded-md bg-gray-800/50 cursor-help">
                           <Image src="https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/about/s101.png" alt="Инфографика: Старый путь (ловушка) против Нового пути (свобода)" width={800} height={800} className="w-full h-full object-cover" loading="lazy" />
                        </div>
                      </TooltipTrigger>
                      <TooltipContent side="bottom" className="max-w-[300px] text-center bg-gray-950 border border-brand-pink/60 text-white p-3 shadow-lg"> <p className="text-sm whitespace-pre-wrap">{tooltipDescriptions['s101.png']}</p> </TooltipContent>
                    </Tooltip>
                    <p className="text-xs text-center text-gray-400 mt-1 italic">Старый путь ведет в ловушку, Новый - к свободе.</p>
                  </div>
                </section>

                {/* .. Section 2: The New Paradigm - Life First */}
                <section className="space-y-4">
                  <h2 className="flex items-center text-2xl md:text-3xl font-semibold text-brand-blue mb-4">
                    <FaLightbulb className="mr-3 text-brand-blue/80" /> Новый Путь: Стань Нишей (Путь Черепахи)
                  </h2>
                  <p className="text-gray-300 text-base md:text-lg leading-relaxed">
                    Настоящий путь: "Какую жизнь я хочу?". Ты <strong className="text-brand-blue font-semibold">становишься нишей</strong>. Решаешь <strong className="text-brand-blue font-semibold">свои</strong> проблемы, помогаешь <strong className="text-brand-blue font-semibold">себе прошлому</strong>, строишь бизнес вокруг <strong className="text-brand-blue font-semibold">аутентичности</strong>. Это путь <strong className="text-brand-blue font-semibold">Черепахи</strong> — адаптивного генералиста. Деньги — <strong className="text-brand-blue font-semibold">ресурс</strong>, не <strong className="text-brand-blue font-semibold">цель</strong>. Адаптивность — ключ.
                  </p>
                   <div className="my-6 p-2 border border-brand-blue/30 rounded-lg bg-black/30">
                    <Tooltip>
                       <TooltipTrigger asChild> <div className="aspect-square w-full h-auto overflow-hidden rounded-md bg-gray-800/50 cursor-help"> <Image src="https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/about/s201.png" alt="Майнд-карта: Построение бизнеса вокруг себя" width={800} height={800} className="w-full h-full object-cover" loading="lazy" /> </div> </TooltipTrigger>
                       <TooltipContent side="bottom" className="max-w-[300px] text-center bg-gray-950 border border-brand-blue/60 text-white p-3 shadow-lg"> <p className="text-sm whitespace-pre-wrap">{tooltipDescriptions['s201.png']}</p> </TooltipContent>
                    </Tooltip>
                     <p className="text-xs text-center text-gray-400 mt-1 italic">Твои интересы, навыки и решенные проблемы - основа бизнеса.</p>
                  </div>
                </section>

                {/* .. Section: AI как Усилитель */}
                <section className="space-y-4">
                    <h2 className="flex items-center text-2xl md:text-3xl font-semibold text-brand-cyan mb-4">
                        <FaRobot className="mr-3 text-brand-cyan/80" /> AI как Усилитель: Соло-Основатель 2.0
                    </h2>
                    <p className="text-gray-300 text-base md:text-lg leading-relaxed">
                        <strong className="text-brand-cyan font-semibold">AI не заменит тебя</strong>. Тебя заменит <strong className="text-brand-cyan font-semibold">человек, использующий AI</strong>. Это твой ко-пилот, твой усилитель, позволяющий одному делать работу команды.
                    </p>
                    <div className="my-6 p-2 border border-brand-cyan/30 rounded-lg bg-black/30">
                      <Tooltip>
                         <TooltipTrigger asChild> <div className="aspect-square w-full h-auto overflow-hidden rounded-md bg-gray-800/50 cursor-help"> <Image src="https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/about/s701.png" alt="Инфографика: AI как усилитель человеческих возможностей" width={800} height={800} className="w-full h-full object-cover" loading="lazy" /> </div> </TooltipTrigger>
                         <TooltipContent side="bottom" className="max-w-[300px] text-center bg-gray-950 border border-brand-cyan/60 text-white p-3 shadow-lg"> <p className="text-sm whitespace-pre-wrap">{tooltipDescriptions['s701.png']}</p> </TooltipContent>
                      </Tooltip>
                       <p className="text-xs text-center text-gray-400 mt-1 italic">AI - твой партнер, а не конкурент.</p>
                    </div>
                    <p className="text-gray-300 text-base md:text-lg leading-relaxed font-semibold text-brand-cyan mb-2">Примеры AI-Усиления:</p>
                    <ul className="list-disc list-inside space-y-2 text-gray-300 pl-4 text-base md:text-lg leading-relaxed">
                       <li><FaListCheck className="inline mr-1 text-cyan-400"/> <strong className="text-brand-cyan font-semibold">Мультипликация Контента:</strong> Одно интервью -> 15 клипов (OpusClip), обложки (Canva), перевод (Claude), статьи (CastMagic). 1 контент = 50 ассетов.</li>
                       <li><FaComments className="inline mr-1 text-cyan-400"/> <strong className="text-brand-cyan font-semibold">Ускорение Коммуникаций:</strong> Персональные email (ChatGPT), адаптивные sales-цепочки, голос бренда, авто-документация.</li>
                       <li><FaWandMagicSparkles className="inline mr-1 text-cyan-400"/> <strong className="text-brand-cyan font-semibold">Визуальное Создание:</strong> 20 концептов за 20 минут (Midjourney, Leonardo), вместо 3 дней ожидания дизайнера.</li>
                       <li><FaRocket className="inline mr-1 text-cyan-400"/> <strong className="text-brand-cyan font-semibold">E-commerce Ускорение:</strong> AI пишет описания, email-маркетинг, оптимизирует логистику (Shopify AI).</li>
                       <li><FaArrowsSpin className="inline mr-1 text-cyan-400"/> <strong className="text-brand-cyan font-semibold">AI-Автоматизация (Zapier, Make):</strong> Связывай приложения, автоматизируй рутину.</li>
                       <li><FaRobot className="inline mr-1 text-cyan-400"/> <strong className="text-brand-cyan font-semibold">AI-Агенты (Lindy, n8n):</strong> Автономные задачи (research, email).</li>
                       <li><FaBrain className="inline mr-1 text-cyan-400"/> <strong className="text-brand-cyan font-semibold">Критическое Мышление с AI:</strong> Используй как советника для анализа идей.</li>
                    </ul>
                </section>

                {/* .. Section: AI Validation Framework */}
                <section id="validation" className="space-y-4 border-t border-yellow-500/30 pt-8 mt-10">
                  <h2 className="flex items-center text-2xl md:text-3xl font-semibold text-brand-yellow mb-4">
                    <FaBullseye className="mr-3 text-brand-yellow/80" /> AI-Валидация: Убей Плохие Идеи Быстро
                  </h2>
                   <p className="text-gray-300 text-base md:text-lg leading-relaxed">
                     90% бизнесов проваливаются, потому что основатели строят то, что никому не нужно. <strong className="text-brand-yellow font-semibold">AI меняет правила игры.</strong> Вместо месяцев разработки — 72 часа на валидацию. Хватит тратить время и деньги на мертвые идеи!
                   </p>
                  <p className="text-gray-300 text-base md:text-lg leading-relaxed font-semibold text-brand-yellow mb-2">5 Шагов AI-Валидации (Метод Тома Билью):</p>
                  {/* Grid for Validation Steps */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4">
                      {/* Step 1: Problem Verification */}
                      <div className="p-4 bg-gray-800/50 border border-yellow-600/40 rounded-lg">
                          <h3 className="flex items-center text-lg font-semibold text-yellow-400 mb-2"><FaMagnifyingGlass className="mr-2"/>1. Проверка Проблемы</h3>
                          <p className="text-sm text-gray-300 mb-3">Есть ли реальная боль? Скорми AI (Perplexity, ChatGPT) треды Reddit, форумы, отзывы. Пусть найдет паттерны жалоб. Нет боли = мертвая идея.</p>
                          <Tooltip>
                              <TooltipTrigger asChild><div className="aspect-video w-full h-auto overflow-hidden rounded bg-gray-700/30 cursor-help"><Image src="/placeholders/validation-problem.png" alt="AI ищет боль пользователей" width={400} height={225} className="w-full h-full object-cover opacity-50" loading="lazy"/></div></TooltipTrigger>
                              <TooltipContent side="bottom" className="max-w-[250px] bg-gray-950 border border-yellow-600/60 text-white p-2"><p className="text-xs">{tooltipDescriptions['validation-problem.png']}</p></TooltipContent>
                          </Tooltip>
                      </div>
                      {/* Step 2: Market Size */}
                      <div className="p-4 bg-gray-800/50 border border-yellow-600/40 rounded-lg">
                           <h3 className="flex items-center text-lg font-semibold text-yellow-400 mb-2"><FaChartLine className="mr-2"/>2. Анализ Рынка</h3>
                           <p className="text-sm text-gray-300 mb-3">Если боль есть, достаточно ли людей ее испытывают? Пусть AI проанализирует Google Trends, объем поиска, TAM. Создаст таблицы потенциальных юзеров. Слишком мало = мертвая идея.</p>
                           <Tooltip>
                              <TooltipTrigger asChild><div className="aspect-video w-full h-auto overflow-hidden rounded bg-gray-700/30 cursor-help"><Image src="/placeholders/validation-market.png" alt="AI анализирует размер рынка" width={400} height={225} className="w-full h-full object-cover opacity-50" loading="lazy"/></div></TooltipTrigger>
                              <TooltipContent side="bottom" className="max-w-[250px] bg-gray-950 border border-yellow-600/60 text-white p-2"><p className="text-xs">{tooltipDescriptions['validation-market.png']}</p></TooltipContent>
                          </Tooltip>
                      </div>
                      {/* Step 3: Competitor Assessment */}
                       <div className="p-4 bg-gray-800/50 border border-yellow-600/40 rounded-lg">
                           <h3 className="flex items-center text-lg font-semibold text-yellow-400 mb-2"><FaEye className="mr-2"/>3. Оценка Конкурентов</h3>
                           <p className="text-sm text-gray-300 mb-3">Скорми AI топ-5 сайтов конкурентов, прайсинг, отзывы. Попроси найти пробелы и перенасыщенность. Создай карту того, чего не хватает. Нет явного преимущества = мертвая идея.</p>
                            <Tooltip>
                              <TooltipTrigger asChild><div className="aspect-video w-full h-auto overflow-hidden rounded bg-gray-700/30 cursor-help"><Image src="/placeholders/validation-competitors.png" alt="AI анализирует конкурентов" width={400} height={225} className="w-full h-full object-cover opacity-50" loading="lazy"/></div></TooltipTrigger>
                              <TooltipContent side="bottom" className="max-w-[250px] bg-gray-950 border border-yellow-600/60 text-white p-2"><p className="text-xs">{tooltipDescriptions['validation-competitors.png']}</p></TooltipContent>
                           </Tooltip>
                      </div>
                      {/* Step 4: Zero-Cost MVP */}
                      <div className="p-4 bg-gray-800/50 border border-yellow-600/40 rounded-lg">
                          <h3 className="flex items-center text-lg font-semibold text-yellow-400 mb-2"><FaRegLightbulb className="mr-2"/>4. MVP за 0 Рублей</h3>
                          <p className="text-sm text-gray-300 mb-3">Не строй продукт до валидации! С AI создай "fake door" тест: лендинг, который выглядит реальным. Собирай email/предоплаты. Нет интереса = мертвая идея.</p>
                           <Tooltip>
                              <TooltipTrigger asChild><div className="aspect-video w-full h-auto overflow-hidden rounded bg-gray-700/30 cursor-help"><Image src="/placeholders/validation-mvp.png" alt="AI создает 'fake door' MVP" width={400} height={225} className="w-full h-full object-cover opacity-50" loading="lazy"/></div></TooltipTrigger>
                              <TooltipContent side="bottom" className="max-w-[250px] bg-gray-950 border border-yellow-600/60 text-white p-2"><p className="text-xs">{tooltipDescriptions['validation-mvp.png']}</p></TooltipContent>
                           </Tooltip>
                      </div>
                  </div>
                  {/* Step 5 (Mentioned Implicitly) */}
                  <p className="text-gray-300 text-base md:text-lg leading-relaxed mt-6">
                      <strong className="text-brand-yellow font-semibold">Шаг 5:</strong> Только если валидация пройдена — <strong className="text-brand-yellow font-semibold">строй то, что люди уже хотят</strong>. Используй AI для ускорения разработки (см. <Link href="/repo-xml" className="text-brand-blue hover:underline">СуперВайб Студию</Link>).
                  </p>
                </section>

                {/* .. Section: Персонализация в Масштабе */}
                <section className="space-y-4">
                    <h2 className="flex items-center text-2xl md:text-3xl font-semibold text-neon-lime mb-4">
                         <FaEnvelopeOpenText className="mr-3 text-neon-lime/80" /> Персонализация в Масштабе: AI Outbound
                    </h2>
                    <p className="text-gray-300 text-base md:text-lg leading-relaxed">
                      Забудь безликие рассылки. AI позволяет создавать <strong className="text-neon-lime font-semibold">глубоко персонализированный</strong> аутрич для тысяч людей, увеличивая конверсию в разы. Ключ к <strong className="text-neon-lime font-semibold">Outbound Sales</strong>.
                    </p>
                     <div className="my-6 p-2 border border-neon-lime/30 rounded-lg bg-black/30">
                       <Tooltip>
                          <TooltipTrigger asChild> <div className="aspect-square w-full h-auto overflow-hidden rounded-md bg-gray-800/50 cursor-help"> <Image src="https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/about/s801.png" alt="Инфографика: Персонализация аутрича с помощью AI" width={800} height={800} className="w-full h-full object-cover" loading="lazy" /> </div> </TooltipTrigger>
                          <TooltipContent side="bottom" className="max-w-[300px] text-center bg-gray-950 border border-neon-lime/60 text-white p-3 shadow-lg"> <p className="text-sm whitespace-pre-wrap">{tooltipDescriptions['s801.png']}</p> </TooltipContent>
                       </Tooltip>
                        <p className="text-xs text-center text-gray-400 mt-1 italic">От массовости к точному попаданию в цель.</p>
                     </div>
                    <p className="text-gray-300 text-base md:text-lg leading-relaxed font-semibold text-neon-lime mb-2">Как это работает:</p>
                    <ol className="list-decimal list-inside space-y-3 text-gray-300 pl-4 text-base md:text-lg leading-relaxed">
                        <li><strong className="text-neon-lime font-semibold">Сбор Лидов:</strong> AI ищет потенциальных клиентов.</li>
                        <li><strong className="text-neon-lime font-semibold">Обогащение Данных:</strong> AI (<strong className="text-neon-lime font-semibold">Clay</strong>) находит доп. инфу о каждом (посты, новости, tech stack).</li>
                        <li><strong className="text-neon-lime font-semibold">AI-Копирайтинг:</strong> AI (ChatGPT, Claude) пишет <strong className="text-neon-lime font-semibold">уникальные письма</strong>, ссылаясь на инфу ("Видел твой пост...", "Заметил, вы используете...").</li>
                        <li><strong className="text-neon-lime font-semibold">Авто-Отправка:</strong> Секвенсеры (<strong className="text-neon-lime font-semibold">Outbond, HeyReach</strong>) отправляют персонализированные цепочки.</li>
                    </ol>
                </section>

                {/* .. Section: Evolving Your Offers */}
                <section className="space-y-4">
                   <h2 className="flex items-center text-2xl md:text-3xl font-semibold text-brand-orange mb-4">
                     <FaArrowsSpin className="mr-3 text-brand-orange/80" /> Эволюция Предложений с AI
                   </h2>
                   <p className="text-gray-300 text-base md:text-lg leading-relaxed">
                     Твой бизнес растет с тобой. AI помогает масштабироваться.
                   </p>
                   <div className="my-6 p-2 border border-brand-orange/30 rounded-lg bg-black/30">
                    <Tooltip>
                      <TooltipTrigger asChild> <div className="aspect-square w-full h-auto overflow-hidden rounded-md bg-gray-800/50 cursor-help"> <Image src="https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/about/s401.png" alt="Схема: Эволюция предложений с ростом аудитории" width={800} height={800} className="w-full h-full object-cover" loading="lazy" /> </div> </TooltipTrigger>
                      <TooltipContent side="bottom" className="max-w-[300px] text-center bg-gray-950 border border-brand-orange/60 text-white p-3 shadow-lg"> <p className="text-sm whitespace-pre-wrap">{tooltipDescriptions['s401.png']}</p> </TooltipContent>
                    </Tooltip>
                      <p className="text-xs text-center text-gray-400 mt-1 italic">От услуг к продуктам по мере роста.</p>
                   </div>
                   <ul className="list-disc list-inside space-y-2 text-gray-300 pl-4 text-base md:text-lg leading-relaxed">
                     <li><strong className="text-brand-orange font-semibold">Начало:</strong> <strong className="text-brand-orange font-semibold">Высокочековые услуги</strong> (фриланс, коучинг).</li>
                     <li><strong className="text-brand-orange font-semibold">Рост:</strong> <strong className="text-brand-orange font-semibold">Масштабируемые продукты</strong>. Используй AI для разработки (курсы, ПО, шаблоны).</li>
                   </ul>
                   <p className="text-gray-300 text-base md:text-lg leading-relaxed">
                     AI позволяет <strong className="text-brand-orange font-semibold">уменьшать время</strong>, <strong className="text-brand-orange font-semibold">увеличивать доход</strong> и <strong className="text-brand-orange font-semibold">контроль</strong>.
                   </p>
                </section>


                {/* .. Section 5: How to Learn & Start */}
                <section className="space-y-4">
                  <h2 className="flex items-center text-2xl md:text-3xl font-semibold text-brand-purple mb-4">
                     <FaWandMagicSparkles className="mr-3 text-brand-purple/80" /> Как Начать: Изучай и Имитируй
                  </h2>
                  <p className="text-gray-300 text-base md:text-lg leading-relaxed">
                    Учись как художник: наблюдай, <strong className="text-brand-purple font-semibold">изучай методологию</strong>, экспериментируй. Будь <strong className="text-brand-purple font-semibold">продакт-менеджером</strong> своего пути.
                  </p>
                   <div className="my-6 p-2 border border-brand-purple/30 rounded-lg bg-black/30">
                    <Tooltip>
                      <TooltipTrigger asChild> <div className="aspect-square w-full h-auto overflow-hidden rounded-md bg-gray-800/50 cursor-help"> <Image src="https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/about/s501.png" alt="Инфографика: Процесс Интеллектуальной Имитации" width={800} height={800} className="w-full h-full object-cover" loading="lazy" /> </div> </TooltipTrigger>
                      <TooltipContent side="bottom" className="max-w-[300px] text-center bg-gray-950 border border-brand-purple/60 text-white p-3 shadow-lg"> <p className="text-sm whitespace-pre-wrap">{tooltipDescriptions['s501.png']}</p> </TooltipContent>
                    </Tooltip>
                     <p className="text-xs text-center text-gray-400 mt-1 italic">Учись, наблюдая, разбирая и пробуя.</p>
                   </div>
                  <ol className="list-decimal list-inside space-y-3 text-gray-300 pl-4 text-base md:text-lg leading-relaxed">
                    <li><strong className="text-brand-purple font-semibold">Собери Вдохновение:</strong> <FaEye className="inline mr-1 mb-1 text-brand-purple/80"/> Найди 3-5 примеров.</li>
                    <li><strong className="text-brand-purple font-semibold">Разбери на Части:</strong> <FaFileCode className="inline mr-1 mb-1 text-brand-purple/80"/> Проанализируй структуру, стиль. Изучи <strong className="text-brand-purple font-semibold">методологию</strong>.</li>
                    <li><strong className="text-brand-purple font-semibold">Имитируй Кусочек:</strong> <FaCodeBranch className="inline mr-1 mb-1 text-brand-purple/80"/> Возьми <strong className="text-brand-purple font-semibold">один</strong> элемент и примени. Используй AI (<Link href="/repo-xml" className="text-brand-blue hover:underline">СуперВайб Студию</Link>) для ускорения.</li>
                    <li><strong className="text-brand-purple font-semibold">Повторяй и Сочетай:</strong> <FaArrowsSpin className="inline mr-1 mb-1 text-brand-purple/80"/> Постепенно создашь <strong className="text-brand-purple font-semibold">свой стиль</strong>.</li>
                    <li><strong className="text-brand-purple font-semibold">Дополняй Знаниями:</strong> <FaBrain className="inline mr-1 mb-1 text-brand-purple/80"/> Изучай теорию, чтобы понимать <strong className="text-brand-purple font-semibold">"почему"</strong>. Используй AI для поиска.</li>
                  </ol>
                   <h3 className="flex items-center text-xl font-semibold text-brand-purple mt-6 mb-2">
                     <FaNetworkWired className="mr-2 text-brand-purple/80" /> Внедряйся в "Племя"
                   </h3>
                   <p className="text-gray-300 text-base md:text-lg leading-relaxed"> Найди 5-10 людей в нише. Комментируй осмысленно (AI поможет), вступай в сообщества, делись контентом, пиши в ЛС (без продаж!). </p>
                   <h3 className="flex items-center text-xl font-semibold text-brand-purple mt-6 mb-2">
                      <FaComments className="mr-2 text-brand-purple/80" /> Пиши Хорошие Комментарии
                   </h3>
                   <p className="text-gray-300 text-base md:text-lg leading-relaxed"> Забудь "Отличный пост!". Начни с <strong className="text-brand-purple font-semibold">"Я помню, когда..."</strong> и расскажи короткую <strong className="text-brand-purple font-semibold">релевантную</strong> историю. Это вызывает любопытство. AI поможет. </p>
                </section>

                 {/* .. Section 6: Cornerstone Content & Proof */}
                <section className="space-y-4">
                  <h2 className="flex items-center text-2xl md:text-3xl font-semibold text-brand-green mb-4">
                    <FaBookOpen className="mr-3 text-brand-green/80" /> Фундамент: Контент "Почему"
                  </h2>
                  <p className="text-gray-300 text-base md:text-lg leading-relaxed">
                    Создай <strong className="text-brand-green font-semibold">базовый уровень информации</strong> (кто ты, чем полезен), чтобы люди доверились <strong className="text-brand-green font-semibold">прежде чем</strong> покупать. AI помогает.
                  </p>
                   <div className="my-6 p-2 border border-brand-green/30 rounded-lg bg-black/30">
                    <Tooltip>
                       <TooltipTrigger asChild> <div className="aspect-square w-full h-auto overflow-hidden rounded-md bg-gray-800/50 cursor-help"> <Image src="https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/about/s601.png" alt="Визуализация: Фундаментальный контент как основа" width={800} height={800} className="w-full h-full object-cover" loading="lazy" /> </div> </TooltipTrigger>
                       <TooltipContent side="bottom" className="max-w-[300px] text-center bg-gray-950 border border-brand-green/60 text-white p-3 shadow-lg"> <p className="text-sm whitespace-pre-wrap">{tooltipDescriptions['s601.png']}</p> </TooltipContent>
                    </Tooltip>
                     <p className="text-xs text-center text-gray-400 mt-1 italic">Создай основу, на которую можно опереться.</p>
                   </div>
                  <p className="text-gray-300 text-base md:text-lg leading-relaxed">
                    <strong className="text-brand-green font-semibold">Контент "Почему" (80%):</strong> Твоя <strong className="text-brand-green font-semibold">история, основы темы, важность</strong>, связь с жизнью. Для новичков и среднего уровня. AI поможет с брейнштормом и черновиками.
                  </p>
                  <p className="text-gray-300 text-base md:text-lg leading-relaxed">
                    <strong className="text-brand-green font-semibold">Продукты "Как":</strong> Платные/бесплатные <strong className="text-brand-green font-semibold">конкретные инструкции</strong>. Для среднего/продвинутого уровня. AI поможет структурировать.
                  </p>
                </section>

                {/* .. Call to Action */}
                <section className="space-y-4 border-t border-brand-green/20 pt-8 mt-10">
                  <h2 className="flex items-center justify-center text-2xl md:text-3xl font-semibold text-brand-green mb-4">
                    <FaRocket className="mr-3 text-brand-green/80" /> Готов Начать Свой Путь?
                  </h2>
                  <p className="text-gray-300 text-base md:text-lg text-center leading-relaxed">
                     Этот путь — марафон. Платформа <strong className="text-brand-green font-semibold">oneSitePls</strong> и <Link href="/repo-xml" className="text-brand-blue hover:underline font-semibold">СуперВайб Студия</Link> созданы, чтобы <strong className="text-brand-green font-semibold">ускорить</strong> его, используя AI как помощника. Глубже — на <Link href="/purpose-profit" className="text-brand-purple hover:underline font-semibold">Purpose & Profit</Link>.
                  </p>
                   <p className="text-gray-300 text-base md:text-lg text-center leading-relaxed mt-4">
                     Изучи <Link href="/about" className="text-brand-blue hover:underline font-semibold">мою историю</Link>, <a href="https://github.com/salavey13/carTest" target="_blank" rel="noopener noreferrer" className="text-brand-blue hover:underline font-semibold">репозиторий</a> как пример, или свяжись для менторства/консультации:
                   </p>
                   <div className="mt-8 max-w-md mx-auto">
                      <h3 className="text-xl font-semibold text-brand-green mb-4 text-center">Нужна Помощь или Консультация?</h3>
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
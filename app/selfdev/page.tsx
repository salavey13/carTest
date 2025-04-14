"use client";


import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
// import { Button } from "@/components/ui/button"; // Button не используется напрямую здесь
import SupportForm from "@/components/SupportForm"; // Keep if consulting is still offered
import { useAppContext } from "@/contexts/AppContext";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"; // <-- Import Tooltip components
import {
  FaLightbulb, FaRoad, FaUsers, FaRocket, FaCodeBranch,
  FaArrowsSpin, FaNetworkWired, FaBookOpen, FaComments, FaBrain, FaEye, // fa6 icons (removed unused ones)
  FaFileCode, FaRobot, FaMagicWandSparkles, FaBullseye, FaEnvelopeOpenText, // Added new icons
} from "react-icons/fa6";
import { debugLogger } from "@/lib/debugLogger";
// import { logger } from "@/lib/logger"; // logger not used directly here, removed for cleanliness
import Link from "next/link";
import Image from "next/image"; // Import Next.js Image component

// --- Component ---
export default function SelfDevLandingPage() {
  const { isAuthenticated, isLoading: isAuthLoading } = useAppContext(); // user not used, removed
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
    // Any client-side specific logic can go here
    debugLogger.log("[SelfDevPage] Mounted. Auth loading:", isAuthLoading, "Is Authenticated:", isAuthenticated);
  }, [isAuthLoading, isAuthenticated]);

  // Define tooltip descriptions based on context and alt text
  const tooltipDescriptions: Record<string, string> = {
      's101.png': "Визуализация ловушки традиционного подхода к карьере (поиск 'работы', следование чужим правилам) в сравнении с путём SelfDev, ориентированным на создание жизни и бизнеса вокруг своей аутентичности и решения собственных проблем.",
      's201.png': "Майнд-карта, иллюстрирующая концепцию 'стать нишей': как ваши личные интересы, уникальные навыки, решенные проблемы и жизненный опыт становятся фундаментом для построения аутентичного и осмысленного бизнеса.",
      's301.png': "Схематическое изображение воронки контент-маркетинга в парадигме SelfDev: как регулярное создание ценного, резонирующего с вами контента приводит к органическому построению доверия, росту лояльной аудитории и, как следствие, к возможностям монетизации без агрессивных продаж.",
      's401.png': "Диаграмма, показывающая стратегию эволюции ваших предложений по мере роста вашей экспертизы и аудитории: начиная с высокочековых услуг (фриланс, консалтинг) для небольшой аудитории и постепенно переходя к созданию масштабируемых продуктов (курсы, ПО, шаблоны) для более широкого охвата.",
      's501.png': "Инфографика, описывающая практические шаги метода 'интеллектуальной имитации' для обучения и старта: наблюдение за успешными примерами в вашей сфере, деконструкция их ключевых элементов, имитация отдельных частей (не копирование!) и постепенное формирование собственного уникального стиля и подхода.",
      's601.png': "Визуальная метафора: создание основополагающего 'контента Почему' (ваша история, философия, основы темы) как прочного фундамента. Этот контент необходим для того, чтобы аудитория поняла вашу ценность и начала вам доверять, прежде чем покупать 'контент Как' (продукты/услуги).",
      // Tooltips for new images
      's701.png': "Визуализация того, как AI-инструменты (чат-боты, код, автоматизация, анализ данных) усиливают возможности человека, а не заменяют его. Это симбиоз, где человек задает направление, а AI ускоряет процесс.",
      's801.png': "Инфографика показывает, как AI позволяет перейти от массовых рассылок к созданию уникальных, персонализированных сообщений для каждого потенциального клиента, используя обогащенные данные и автоматизацию."
  };

  // Render loading state or placeholder if not mounted or auth loading
  if (!isMounted || isAuthLoading) {
    return (
      <div className="flex justify-center items-center min-h-screen pt-20 bg-gradient-to-br from-gray-900 via-black to-gray-800">
        <p className="text-brand-green animate-pulse text-xl font-mono">Загрузка философии VIBE...</p>
      </div>
    );
  }

  // Страница доступна всем, аутентификация нужна только для SupportForm
  // Поэтому нет необходимости в проверке !isAuthenticated здесь

  return (
    <div className="relative min-h-screen overflow-hidden pt-20 pb-10 bg-gradient-to-br from-gray-900 via-black to-gray-800 text-gray-200">
      {/* Subtle Background Grid */}
      <div
        className="absolute inset-0 bg-repeat opacity-5 z-0"
        style={{
          backgroundImage: `linear-gradient(to right, rgba(0, 255, 157, 0.2) 1px, transparent 1px),
                            linear-gradient(to bottom, rgba(0, 255, 157, 0.2) 1px, transparent 1px)`,
          backgroundSize: '50px 50px',
        }}
      ></div>

      {/* Wrap content potentially requiring tooltips with TooltipProvider */}
      <TooltipProvider delayDuration={200}>
          <div className="relative z-10 container mx-auto px-4">
            <Card className="max-w-5xl mx-auto bg-black/80 backdrop-blur-md text-white rounded-2xl border border-brand-green/30 shadow-[0_0_25px_rgba(0,255,157,0.4)]">
              <CardHeader className="text-center border-b border-brand-green/20 pb-4">
                <CardTitle className="text-3xl md:text-5xl font-bold text-brand-green cyber-text glitch" data-text="SelfDev: Путь к Себе">
                  SelfDev: Путь к Себе
                </CardTitle>
                <p className="text-md md:text-lg text-gray-300 mt-3 font-mono">
                  Лучшая бизнес-модель — это не модель. Это образ жизни.
                </p>
              </CardHeader>

              <CardContent className="space-y-12 p-4 md:p-8"> {/* Increased spacing */}

                {/* Section 1: The Old Paradigm Trap */}
                <section className="space-y-4">
                  <h2 className="flex items-center text-2xl md:text-3xl font-semibold text-brand-pink mb-4">
                    <FaRoad className="mr-3 text-brand-pink/80" /> Ловушка Старой Парадигмы
                  </h2>
                  <p className="text-gray-300 text-base md:text-lg leading-relaxed">
                    Многие новички слепо ищут "лучшие" навыки или бизнес-модели, чтобы заработать, уйти с работы, получить контроль. Они действуют из нужды, применяя школьный подход: найти "новую работу" (фриланс, агентство, eCom) и учиться по чужим правилам. Это путь <strong className="text-brand-pink font-semibold">Динозавра</strong> — специалиста, который рискует вымереть при изменении среды.
                  </p>
                  <div className="my-6 p-2 border border-brand-pink/30 rounded-lg bg-black/30">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div className="aspect-square w-full h-auto overflow-hidden rounded-md bg-gray-800/50 cursor-help">
                           <Image
                             src="https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/about/s101.png"
                             alt="Инфографика: Старый путь (ловушка) против Нового пути (свобода)"
                             width={800} height={800}
                             className="w-full h-full object-cover"
                             loading="lazy"
                           />
                        </div>
                      </TooltipTrigger>
                      <TooltipContent side="bottom" className="max-w-[300px] text-center bg-gray-950 border border-brand-pink/60 text-white p-3 shadow-lg">
                        <p className="text-sm whitespace-pre-wrap">{tooltipDescriptions['s101.png']}</p>
                      </TooltipContent>
                    </Tooltip>
                    <p className="text-xs text-center text-gray-400 mt-1 italic">Старый путь ведет в ловушку, Новый - к свободе.</p>
                  </div>
                  <p className="text-gray-300 text-base md:text-lg leading-relaxed">
                    В итоге они строят себе новую клетку 9-5, чувствуют себя зажатыми, без рычагов влияния. Их доход нестабилен, а работа не приносит радости, потому что она не связана с их истинными интересами или жизненными целями. Фокус только на деньгах уводит от главного.
                  </p>
                </section>

                {/* Section 2: The New Paradigm - Life First */}
                <section className="space-y-4">
                  <h2 className="flex items-center text-2xl md:text-3xl font-semibold text-brand-blue mb-4">
                    <FaLightbulb className="mr-3 text-brand-blue/80" /> Новый Путь: Жизнь Прежде Всего (Путь Черепахи)
                  </h2>
                  <p className="text-gray-300 text-base md:text-lg leading-relaxed">
                    Настоящий путь начинается с вопроса: "Какую жизнь я хочу жить?". Вместо того чтобы выбирать нишу или модель, ты <strong className="text-brand-blue font-semibold">становишься нишей</strong>. Ты решаешь <strong className="text-brand-blue font-semibold">свои</strong> проблемы, помогаешь <strong className="text-brand-blue font-semibold">своему прошлому "я"</strong>, и строишь бизнес вокруг <strong className="text-brand-blue font-semibold">своей аутентичности и экспертизы</strong>. Это путь <strong className="text-brand-blue font-semibold">Черепахи</strong> — адаптивного генералиста, который выживает и процветает в любых условиях.
                  </p>
                   <div className="my-6 p-2 border border-brand-blue/30 rounded-lg bg-black/30">
                    <Tooltip>
                       <TooltipTrigger asChild>
                         <div className="aspect-square w-full h-auto overflow-hidden rounded-md bg-gray-800/50 cursor-help">
                           <Image
                              src="https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/about/s201.png"
                              alt="Майнд-карта: Построение бизнеса вокруг себя"
                              width={800} height={800}
                              className="w-full h-full object-cover"
                              loading="lazy"
                            />
                          </div>
                       </TooltipTrigger>
                       <TooltipContent side="bottom" className="max-w-[300px] text-center bg-gray-950 border border-brand-blue/60 text-white p-3 shadow-lg">
                         <p className="text-sm whitespace-pre-wrap">{tooltipDescriptions['s201.png']}</p>
                       </TooltipContent>
                    </Tooltip>
                     <p className="text-xs text-center text-gray-400 mt-1 italic">Твои интересы, навыки и решенные проблемы - основа бизнеса.</p>
                  </div>
                  <p className="text-gray-300 text-base md:text-lg leading-relaxed">
                    Деньги — это важный <strong className="text-brand-blue font-semibold">ресурс</strong>, но не единственная <strong className="text-brand-blue font-semibold">цель</strong>. Цель — жить осмысленно, занимаясь тем, что важно для <strong className="text-brand-blue font-semibold">тебя</strong>. Твои ценности и интересы эволюционируют, и твой бизнес должен эволюционировать вместе с тобой. Адаптивность — ключ к выживанию и процветанию.
                  </p>
                </section>

                {/* Section 3: The Power of Audience & Content */}
                <section className="space-y-4">
                  <h2 className="flex items-center text-2xl md:text-3xl font-semibold text-neon-lime mb-4">
                    <FaUsers className="mr-3 text-neon-lime/80" /> Сила Аудитории и AI-Контента
                  </h2>
                  <p className="text-gray-300 text-base md:text-lg leading-relaxed">
                    Для новичка без капитала, самый <strong className="text-neon-lime font-semibold">высокорычажный</strong> старт — построение аудитории через контент. И AI здесь — твой турбо-ускоритель.
                  </p>
                  <ul className="list-disc list-inside space-y-2 text-gray-300 pl-4 text-base md:text-lg leading-relaxed">
                    <li><strong className="text-neon-lime font-semibold">AI-Обучение:</strong> Создавая контент <strong className="text-neon-lime font-semibold">с помощью AI</strong> (Claude, ChatGPT для текстов, Midjourney, Leonardo для визуала, Runway для видео), ты <strong className="text-neon-lime font-semibold">учишься</strong> быстрее и <strong className="text-neon-lime font-semibold">бесплатно</strong>, фокусируясь на стратегии и смысле.</li>
                    <li><strong className="text-neon-lime font-semibold">AI-Копирайтинг (Навык #3):</strong> Научись использовать AI (<strong className="text-neon-lime font-semibold">Промпт-Инжиниринг - Навык #1</strong>) для генерации идей, структуры, черновиков и улучшения текстов (Claude, Copy.ai). Это повышает конверсию и строит доверие.</li>
                    <li><strong className="text-neon-lime font-semibold">AI-Создание Контента (Навык #5):</strong> Генерируй уникальные изображения (Midjourney, Leonardo), видео (Runway), музыку (Suno), озвучку (ElevenLabs) с помощью AI. Это твой личный продакшн-студия за копейки.</li>
                    <li><strong className="text-neon-lime font-semibold">Рычаг Влияния:</strong> Аудитория, привлеченная твоим уникальным, усиленным AI контентом, доверяет тебе еще больше.</li>
                    <li><strong className="text-neon-lime font-semibold">Принцип T-Shaped:</strong> AI помогает генерировать идеи и контент как для глубокой (80%), так и для широкой (20%) части T-shape.</li>
                  </ul>
                  <div className="my-6 p-2 border border-neon-lime/30 rounded-lg bg-black/30">
                    <Tooltip>
                      <TooltipTrigger asChild>
                         <div className="aspect-square w-full h-auto overflow-hidden rounded-md bg-gray-800/50 cursor-help">
                            <Image
                              src="https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/about/s301.png"
                              alt="Диаграмма: Контент -> Доверие -> Аудитория -> Продажи"
                              width={800} height={800}
                              className="w-full h-full object-cover"
                              loading="lazy"
                            />
                          </div>
                      </TooltipTrigger>
                      <TooltipContent side="bottom" className="max-w-[300px] text-center bg-gray-950 border border-neon-lime/60 text-white p-3 shadow-lg">
                         <p className="text-sm whitespace-pre-wrap">{tooltipDescriptions['s301.png']}</p>
                      </TooltipContent>
                    </Tooltip>
                    <p className="text-xs text-center text-gray-400 mt-1 italic">Контент - двигатель доверия и роста.</p>
                  </div>
                  <p className="text-gray-300 text-base md:text-lg leading-relaxed">
                    Создание контента <strong className="text-neon-lime font-semibold">с AI</strong> — это <strong className="text-neon-lime font-semibold">необходимый элемент любого современного бизнеса</strong>. Это твой самый быстрый способ доказать свою ценность.
                  </p>
                </section>

                {/* Section 4: Evolving Your Offers */}
                <section className="space-y-4">
                   <h2 className="flex items-center text-2xl md:text-3xl font-semibold text-brand-orange mb-4">
                     <FaArrowsSpin className="mr-3 text-brand-orange/80" /> Эволюция Предложений с AI
                   </h2>
                   <p className="text-gray-300 text-base md:text-lg leading-relaxed">
                     Твой бизнес и твои предложения должны расти вместе с тобой и твоей аудиторией. AI помогает масштабироваться быстрее.
                   </p>
                   <div className="my-6 p-2 border border-brand-orange/30 rounded-lg bg-black/30">
                    <Tooltip>
                      <TooltipTrigger asChild>
                         <div className="aspect-square w-full h-auto overflow-hidden rounded-md bg-gray-800/50 cursor-help">
                            <Image
                              src="https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/about/s401.png"
                              alt="Схема: Эволюция предложений с ростом аудитории"
                              width={800} height={800}
                              className="w-full h-full object-cover"
                              loading="lazy"
                            />
                          </div>
                      </TooltipTrigger>
                      <TooltipContent side="bottom" className="max-w-[300px] text-center bg-gray-950 border border-brand-orange/60 text-white p-3 shadow-lg">
                         <p className="text-sm whitespace-pre-wrap">{tooltipDescriptions['s401.png']}</p>
                      </TooltipContent>
                    </Tooltip>
                      <p className="text-xs text-center text-gray-400 mt-1 italic">От услуг к продуктам по мере роста.</p>
                   </div>
                   <ul className="list-disc list-inside space-y-2 text-gray-300 pl-4 text-base md:text-lg leading-relaxed">
                     <li><strong className="text-brand-orange font-semibold">Начало (Маленькая аудитория):</strong> Предлагай <strong className="text-brand-orange font-semibold">высокочековые услуги</strong> (фриланс, коучинг, консалтинг). Тебе нужно всего 2-4 клиента в месяц, чтобы заменить зарплату. Это требует навыков продаж и прямого общения.</li>
                     <li><strong className="text-brand-orange font-semibold">Рост (Аудитория растет):</strong> Постепенно создавай <strong className="text-brand-orange font-semibold">масштабируемые продукты</strong>. Используй AI для разработки (цифровые продукты, шаблоны, курсы, ПО вроде <Link href="https://lovable.dev" target="_blank" rel="noopener noreferrer" className="text-brand-blue hover:underline">Lovable</Link>, <Link href="https://bolt.dev" target="_blank" rel="noopener noreferrer" className="text-brand-blue hover:underline">Bolt</Link>, <Link href="https://www.hostinger.com/ai-website-builder" target="_blank" rel="noopener noreferrer" className="text-brand-blue hover:underline">Horizons</Link>) и контента. Они могут продаваться, пока ты спишь, и требуют меньше твоего времени на каждого клиента.</li>
                   </ul>
                   <p className="text-gray-300 text-base md:text-lg leading-relaxed">
                     Эта эволюция позволяет тебе <strong className="text-brand-orange font-semibold">уменьшать время</strong>, затрачиваемое на выполнение работы, <strong className="text-brand-orange font-semibold">увеличивать доход</strong> и получать <strong className="text-brand-orange font-semibold">больше контроля</strong> над своим днем, используя растущую аудиторию и AI как рычаг.
                   </p>
                </section>

                {/* Section: AI как Усилитель (NEW) */}
                <section className="space-y-4">
                    <h2 className="flex items-center text-2xl md:text-3xl font-semibold text-brand-cyan mb-4">
                        <FaRobot className="mr-3 text-brand-cyan/80" /> AI как Усилитель: Твои Новые Суперсилы
                    </h2>
                    <p className="text-gray-300 text-base md:text-lg leading-relaxed">
                        Забудь страшилки про "AI заменит всех". Правда в том, что <strong className="text-brand-cyan font-semibold">AI не заменит тебя</strong>. Тебя заменит <strong className="text-brand-cyan font-semibold">человек, использующий AI</strong>. Это системный сдвиг, и твоя задача — оседлать эту волну.
                    </p>
                    <div className="my-6 p-2 border border-brand-cyan/30 rounded-lg bg-black/30">
                      <Tooltip>
                         <TooltipTrigger asChild>
                            <div className="aspect-square w-full h-auto overflow-hidden rounded-md bg-gray-800/50 cursor-help">
                              {/* <!-- IMG_PROMPT: Infographic illustrating AI augmentation: A central human figure/brain icon connected by glowing lines to various AI tool icons (chatbot, code symbol, automation gear, data analysis graph), symbolizing enhanced capabilities. Style: Abstract, tech, neon cyan glow effect. --> */}
                              <Image
                                src="/placeholders/s701.png" // Placeholder image
                                alt="Инфографика: AI как усилитель человеческих возможностей"
                                width={800} height={800}
                                className="w-full h-full object-cover opacity-50" // Indicate placeholder visually
                                loading="lazy"
                              />
                            </div>
                         </TooltipTrigger>
                         <TooltipContent side="bottom" className="max-w-[300px] text-center bg-gray-950 border border-brand-cyan/60 text-white p-3 shadow-lg">
                           <p className="text-sm whitespace-pre-wrap">{tooltipDescriptions['s701.png']}</p>
                         </TooltipContent>
                      </Tooltip>
                       <p className="text-xs text-center text-gray-400 mt-1 italic">AI - твой партнер, а не конкурент.</p>
                    </div>
                    <p className="text-gray-300 text-base md:text-lg leading-relaxed">
                      Ключевые AI-навыки для SelfDev пути:
                    </p>
                    <ul className="list-disc list-inside space-y-2 text-gray-300 pl-4 text-base md:text-lg leading-relaxed">
                       <li><strong className="text-brand-cyan font-semibold">Промпт-Инжиниринг (Навык #1):</strong> Основа основ. Умение <strong className="text-brand-cyan font-semibold">правильно общаться с AI</strong> (ставить роль, цель, давать четкие инструкции), чтобы получать нужный результат. Можно даже использовать AI (Claude, ChatGPT), чтобы он помог написать хороший промпт!</li>
                       <li><strong className="text-brand-cyan font-semibold">AI-Автоматизация (Навык #6):</strong> Освободи время от рутины. Инструменты типа <strong className="text-brand-cyan font-semibold">Zapier, Make, n8n</strong> позволяют связывать разные приложения и автоматизировать повторяющиеся задачи (например, отправка данных из формы в CRM).</li>
                       <li><strong className="text-brand-cyan font-semibold">AI-Агенты (Навык #7):</strong> Следующий уровень автоматизации. Агенты (например, созданные с <strong className="text-brand-cyan font-semibold">Lindy</strong> или <strong className="text-brand-cyan font-semibold">n8n</strong>) могут не просто выполнять шаги, но и <strong className="text-brand-cyan font-semibold">принимать решения, рассуждать, учиться</strong> и действовать автономно для достижения цели (например, research + написание + отправка email).</li>
                       <li><strong className="text-brand-cyan font-semibold">Критическое Мышление с AI (Навык #7 - часть):</strong> Используй AI как <strong className="text-brand-cyan font-semibold">стратегического советника</strong> (например, через кастомные промпты в ChatGPT). Проси его анализировать идеи, находить слабые места, предлагать альтернативы. Это поможет тебе принимать лучшие решения.</li>
                    </ul>
                </section>

                {/* Section: Персонализация в Масштабе (NEW) */}
                <section className="space-y-4">
                    <h2 className="flex items-center text-2xl md:text-3xl font-semibold text-brand-yellow mb-4">
                         <FaBullseye className="mr-3 text-brand-yellow/80" /> Персонализация в Масштабе: Достучись до Каждого
                    </h2>
                    <p className="text-gray-300 text-base md:text-lg leading-relaxed">
                      Забудь про безликие email-рассылки. AI позволяет создавать <strong className="text-brand-yellow font-semibold">глубоко персонализированный</strong> аутрич для сотен и тысяч людей, увеличивая конверсию в разы. Это ключ к <strong className="text-brand-yellow font-semibold">Outbound Sales (Навык #4)</strong> в эпоху AI.
                    </p>
                     <div className="my-6 p-2 border border-brand-yellow/30 rounded-lg bg-black/30">
                       <Tooltip>
                          <TooltipTrigger asChild>
                            <div className="aspect-square w-full h-auto overflow-hidden rounded-md bg-gray-800/50 cursor-help">
                              {/* <!-- IMG_PROMPT: Diagram showing personalization at scale: Starts with a large pool of generic icons representing leads, funnels down through data enrichment icons (database, magnifying glass), leading to individually targeted email/message icons directed at specific user profile icons. Style: Clean data visualization, funnel metaphor, bright yellow connecting lines. --> */}
                              <Image
                                src="/placeholders/s801.png" // Placeholder image
                                alt="Инфографика: Персонализация аутрича с помощью AI"
                                width={800} height={800}
                                className="w-full h-full object-cover opacity-50" // Indicate placeholder visually
                                loading="lazy"
                              />
                            </div>
                          </TooltipTrigger>
                          <TooltipContent side="bottom" className="max-w-[300px] text-center bg-gray-950 border border-brand-yellow/60 text-white p-3 shadow-lg">
                            <p className="text-sm whitespace-pre-wrap">{tooltipDescriptions['s801.png']}</p>
                          </TooltipContent>
                       </Tooltip>
                        <p className="text-xs text-center text-gray-400 mt-1 italic">От массовости к точному попаданию в цель.</p>
                     </div>
                    <p className="text-gray-300 text-base md:text-lg leading-relaxed">
                      Как это работает (упрощенно):
                    </p>
                    <ol className="list-decimal list-inside space-y-3 text-gray-300 pl-4 text-base md:text-lg leading-relaxed">
                        <li><strong className="text-brand-yellow font-semibold">Сбор Лидов:</strong> Используй инструменты (или AI-агентов) для поиска потенциальных клиентов (например, в LinkedIn Sales Navigator).</li>
                        <li><strong className="text-brand-yellow font-semibold">Обогащение Данных:</strong> Платформы типа <strong className="text-brand-yellow font-semibold">Clay</strong> или AI-агенты автоматически находят <strong className="text-brand-yellow font-semibold">дополнительную информацию</strong> о каждом лиде: их интересы, последние посты, новости компании, используемый tech stack и т.д.</li>
                        <li><strong className="text-brand-yellow font-semibold">AI-Копирайтинг:</strong> Используй AI (Claude, ChatGPT, Copy.ai) для написания <strong className="text-brand-yellow font-semibold">уникальных персонализированных сообщений</strong> для каждого лида, ссылаясь на найденную информацию ("Видел твой пост о...", "Поздравляю с недавним...", "Заметил, что вы используете...").</li>
                        <li><strong className="text-brand-yellow font-semibold">Автоматическая Отправка:</strong> Загрузи список лидов и персонализированные сообщения в секвенсеры (<strong className="text-brand-yellow font-semibold">Outbond, HeyReach, Instantly, Smartlead</strong>), которые автоматически отправят цепочки писем или сообщений в LinkedIn.</li>
                    </ol>
                    <p className="text-gray-300 text-base md:text-lg leading-relaxed">
                      Это позволяет <strong className="text-brand-yellow font-semibold">масштабировать</strong> личные касания, которые раньше были возможны только при ручной работе, и получать <strong className="text-brand-yellow font-semibold">значительно лучшие результаты</strong>.
                    </p>
                </section>

                {/* Section 5: How to Learn & Start (Intelligent Imitation) */}
                <section className="space-y-4">
                  <h2 className="flex items-center text-2xl md:text-3xl font-semibold text-brand-purple mb-4">
                     <FaMagicWandSparkles className="mr-3 text-brand-purple/80" /> Как Начать: Изучай Методологию и Имитируй
                  </h2>
                  <p className="text-gray-300 text-base md:text-lg leading-relaxed">
                    Тебе не нужна книга инструкций. Ты <strong className="text-brand-purple font-semibold">уже</strong> окружен информацией. Научись учиться как художник: наблюдай, <strong className="text-brand-purple font-semibold">изучай методологию (Навык #2)</strong> и экспериментируй. Будь как <strong className="text-brand-purple font-semibold">продакт-менеджер</strong> своего SelfDev пути.
                  </p>
                   <div className="my-6 p-2 border border-brand-purple/30 rounded-lg bg-black/30">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div className="aspect-square w-full h-auto overflow-hidden rounded-md bg-gray-800/50 cursor-help">
                          <Image
                            src="https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/about/s501.png"
                            alt="Инфографика: Процесс Интеллектуальной Имитации"
                            width={800} height={800}
                            className="w-full h-full object-cover"
                            loading="lazy"
                          />
                        </div>
                      </TooltipTrigger>
                      <TooltipContent side="bottom" className="max-w-[300px] text-center bg-gray-950 border border-brand-purple/60 text-white p-3 shadow-lg">
                        <p className="text-sm whitespace-pre-wrap">{tooltipDescriptions['s501.png']}</p>
                      </TooltipContent>
                    </Tooltip>
                     <p className="text-xs text-center text-gray-400 mt-1 italic">Учись, наблюдая, разбирая и пробуя.</p>
                   </div>
                  <ol className="list-decimal list-inside space-y-3 text-gray-300 pl-4 text-base md:text-lg leading-relaxed">
                    <li><strong className="text-brand-purple font-semibold">Собери Вдохновение:</strong> <FaEye className="inline mr-1 mb-1 text-brand-purple/80"/> Найди 3-5 брендов, авторов, продуктов, которые тебе нравятся и которые успешны.</li>
                    <li><strong className="text-brand-purple font-semibold">Разбери на Части:</strong> <FaFileCode className="inline mr-1 mb-1 text-brand-purple/80"/> Проанализируй их структуру, стиль, ключевые элементы (хуки, заголовки, формат контента, дизайн, УТП). Почему это работает? Изучи <strong className="text-brand-purple font-semibold">методологию</strong> за их успехом.</li>
                    <li><strong className="text-brand-purple font-semibold">Имитируй Маленький Кусочек:</strong> <FaCodeBranch className="inline mr-1 mb-1 text-brand-purple/80"/> Возьми <strong className="text-brand-purple font-semibold">один</strong> элемент (например, структуру поста, цветовую схему, тип заголовка) и попробуй применить его <strong className="text-brand-purple font-semibold">в своем</strong> контенте/продукте/профиле. Используй AI (например, <Link href="https://cursor.sh" target="_blank" rel="noopener noreferrer" className="text-brand-blue hover:underline">Cursor</Link>, <Link href="https://winsurf.ai/" target="_blank" rel="noopener noreferrer" className="text-brand-blue hover:underline">Winsurf</Link>, <Link href="https://github.com/features/copilot" target="_blank" rel="noopener noreferrer" className="text-brand-blue hover:underline">Copilot</Link>) для ускорения разработки, если нужно.</li>
                    <li><strong className="text-brand-purple font-semibold">Повторяй и Сочетай:</strong> <FaArrowsSpin className="inline mr-1 mb-1 text-brand-purple/80"/> Сделай это снова с другим элементом. И еще раз. Постепенно ты создашь <strong className="text-brand-purple font-semibold">свой уникальный стиль</strong>.</li>
                    <li><strong className="text-brand-purple font-semibold">Дополняй Знаниями:</strong> <FaBrain className="inline mr-1 mb-1 text-brand-purple/80"/> Параллельно изучай теорию (читай книги, смотри видео), чтобы понимать <strong className="text-brand-purple font-semibold">"почему"</strong> то, что ты делаешь, работает. Используй AI для поиска и суммирования информации.</li>
                  </ol>
                  <h3 className="flex items-center text-xl font-semibold text-brand-purple mt-6 mb-2">
                     <FaNetworkWired className="mr-2 text-brand-purple/80" /> Внедряйся в "Племя"
                  </h3>
                  <p className="text-gray-300 text-base md:text-lg leading-relaxed">
                    Найди 5-10 ключевых людей в своей нише. Сделай так, чтобы они тебя заметили:
                  </p>
                   <ul className="list-disc list-inside space-y-1 text-gray-300 pl-4 text-base md:text-lg leading-relaxed">
                     <li>Комментируй их посты (<strong className="text-brand-purple font-semibold">осмысленно!</strong> Используй AI для генерации идей).</li>
                     <li>Вступай в их сообщества.</li>
                     <li>Делись их контентом (если он ценен).</li>
                     <li>Напиши им в ЛС, чтобы начать диалог (без продаж!).</li>
                   </ul>
                   <h3 className="flex items-center text-xl font-semibold text-brand-purple mt-6 mb-2">
                      <FaComments className="mr-2 text-brand-purple/80" /> Пиши Хорошие Комментарии
                   </h3>
                   <p className="text-gray-300 text-base md:text-lg leading-relaxed">
                     Самый простой способ выделиться. Забудь про "Отличный пост!". Начни с <strong className="text-brand-purple font-semibold">"Я помню, когда..."</strong> и расскажи короткую <strong className="text-brand-purple font-semibold">релевантную</strong> историю из своей жизни. Это вызывает любопытство к <strong className="text-brand-purple font-semibold">тебе</strong>. AI может помочь тебе отточить эти истории.
                   </p>
                </section>

                 {/* Section 6: Cornerstone Content & Proof (Updated) */}
                <section className="space-y-4">
                  <h2 className="flex items-center text-2xl md:text-3xl font-semibold text-brand-green mb-4">
                    <FaBookOpen className="mr-3 text-brand-green/80" /> Фундамент: Контент "Почему" и Доказательство Ценности
                  </h2>
                  <p className="text-gray-300 text-base md:text-lg leading-relaxed">
                    Тебе нужно создать <strong className="text-brand-green font-semibold">базовый уровень информации</strong>, чтобы люди могли понять, кто ты и чем можешь быть полезен, <strong className="text-brand-green font-semibold">прежде чем</strong> они тебе доверятся. Несколько постов недостаточно. AI помогает создавать этот фундамент быстрее.
                  </p>
                   <div className="my-6 p-2 border border-brand-green/30 rounded-lg bg-black/30">
                    <Tooltip>
                       <TooltipTrigger asChild>
                         <div className="aspect-square w-full h-auto overflow-hidden rounded-md bg-gray-800/50 cursor-help">
                            <Image
                              src="https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/about/s601.png"
                              alt="Визуализация: Фундаментальный контент как основа"
                              width={800} height={800}
                              className="w-full h-full object-cover"
                              loading="lazy"
                            />
                          </div>
                       </TooltipTrigger>
                       <TooltipContent side="bottom" className="max-w-[300px] text-center bg-gray-950 border border-brand-green/60 text-white p-3 shadow-lg">
                         <p className="text-sm whitespace-pre-wrap">{tooltipDescriptions['s601.png']}</p>
                       </TooltipContent>
                    </Tooltip>
                     <p className="text-xs text-center text-gray-400 mt-1 italic">Создай основу, на которую можно опереться.</p>
                   </div>
                  <p className="text-gray-300 text-base md:text-lg leading-relaxed">
                    <strong className="text-brand-green font-semibold">Контент "Почему":</strong> Большая часть твоего контента (80%) должна объяснять <strong className="text-brand-green font-semibold">твою историю, основы твоей темы, почему это важно</strong>, и как это связано с твоей повседневной жизнью. Это контент для новичков и среднего уровня. Используй AI для брейншторма, структурирования и написания черновиков.
                  </p>
                  <p className="text-gray-300 text-base md:text-lg leading-relaxed">
                    <strong className="text-brand-green font-semibold">Продукты "Как":</strong> Твои платные продукты и услуги (или бесплатные лид-магниты) должны содержать <strong className="text-brand-green font-semibold">конкретные инструкции "как"</strong> что-то сделать. Это для среднего и продвинутого уровня. Не путай! AI может помочь структурировать и даже написать части этого контента.
                  </p>
                </section>

                {/* Call to Action */}
                <section className="space-y-4 border-t border-brand-green/20 pt-8 mt-10">
                  <h2 className="flex items-center justify-center text-2xl md:text-3xl font-semibold text-brand-green mb-4">
                    <FaRocket className="mr-3 text-brand-green/80" /> Готов Начать Свой Путь?
                  </h2>
                  <p className="text-gray-300 text-base md:text-lg text-center leading-relaxed">
                     Этот новый путь — это марафон, а не спринт. Он требует работы, но это работа над <strong className="text-brand-green font-semibold">собой</strong> и <strong className="text-brand-green font-semibold">своей жизнью</strong>. Платформа <strong className="text-brand-green font-semibold">oneSitePls</strong> и инструменты вроде <Link href="/repo-xml" className="text-brand-blue hover:underline font-semibold">/repo-xml</Link> созданы, чтобы <strong className="text-brand-green font-semibold">ускорить</strong> этот процесс, используя AI как помощника, владеющего всеми этими <strong className="text-brand-green font-semibold">7 навыками</strong>.
                  </p>
                   <p className="text-gray-300 text-base md:text-lg text-center leading-relaxed mt-4">
                     Изучи <Link href="/about" className="text-brand-blue hover:underline font-semibold">мою историю</Link>, посмотри на <a href="https://github.com/salavey13/oneSitePls" target="_blank" rel="noopener noreferrer" className="text-brand-blue hover:underline font-semibold">репозиторий oneSitePls</a> как на пример VIBE-разработки, или свяжись со мной для менторства или консультации через форму ниже.
                   </p>
                   <div className="mt-8 max-w-md mx-auto">
                      <h3 className="text-xl font-semibold text-brand-green mb-4 text-center">Нужна Помощь или Консультация?</h3>
                      {/* Проверка на isMounted уже выполнена выше, так что SupportForm можно рендерить */}
                      <SupportForm />
                   </div>
                </section>

              </CardContent>
            </Card>
          </div>
      </TooltipProvider> {/* Close TooltipProvider */}
    </div>
  );
}
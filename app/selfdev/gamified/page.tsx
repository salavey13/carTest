"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAppContext } from "@/contexts/AppContext";
import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  FaGlasses, FaMapSigns, FaBrain, FaExclamationTriangle, FaPlay, FaForward,
  FaPuzzlePiece, FaCogs, FaRoad, FaQuestionCircle, FaEye, FaBullseye, FaRulerCombined,
  FaArrowsSpin, FaDumbbell, FaGamepad, FaLightbulb, FaRobot, FaRocket, FaBookOpen
} from "react-icons/fa6"; // Use FaGlasses for the 'Sight' theme
import { debugLogger } from "@/lib/debugLogger";
import Image from "next/image";
import Link from "next/link";
import { cn } from "@/lib/utils";

type Language = 'en' | 'ru';

// Generic, small, transparent placeholder for image blur
const PLACEHOLDER_BLUR_URL = "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMSIgaGVpZ2h0PSIxIiB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciPjxyZWN0IHdpZHRoPSIxIiBoZWlnaHQ9IjEiIGZpbGw9IiMwMDAiIGZpbGwtb3BhY2l0eT0iMC4xIi8+PC9zdmc+";

// Image Placeholders & Prompts (as described in the markdown)
const imagePlaceholders = {
  placeholder1: {
    url: "https://placehold.co/600x338/0d0d1a/FFF?text=Clarity+Lenses",
    altEn: "Augmented reality glasses symbolizing clarity and vision",
    altRu: "Очки дополненной реальности, символизирующие ясность и видение",
    tooltipRu: "Визуализация 'линз ясности', помогающих преодолеть замешательство и обрести видение будущего.",
  },
  placeholder2: {
    url: "https://placehold.co/600x338/0d0d1a/FFF?text=Gamified+Path",
    altEn: "Life path transforming into a video game interface",
    altRu: "Жизненный путь, превращающийся в интерфейс видеоигры",
    tooltipRu: "Концепция геймификации жизни: уровни, цели, правила и обратная связь для направленного прогресса.",
  },
  placeholder3: {
    url: "https://placehold.co/600x338/0d0d1a/FFF?text=AI+Sparring+Partner",
    altEn: "AI assistant helping user navigate challenges",
    altRu: "ИИ-ассистент, помогающий пользователю преодолевать вызовы",
    tooltipRu: "ИИ как инструмент для самопознания, валидации идей и ускорения обучения на пути SelfDev.",
  },
};

// --- Section Data (Based on Video + Sight Theme) ---
const sections = [
  {
    id: "intro",
    icon: FaMapSigns,
    titleEn: "Lost in the Fog? Put On Your 'Sight' Lenses",
    titleRu: "Потерян в Тумане? Надень 'Линзы Ясности'",
    pointsEn: [
      "Feeling confused, lost, or on the verge of giving up is normal. It often takes <strong class='font-semibold text-brand-yellow'>1-2 months</strong> of this 'Limbo' phase for true vision to form.",
      "Like wearing new AR glasses, we need a <strong class='font-semibold text-brand-yellow'>new perspective</strong> to turn life into an engaging game instead of a confusing struggle.",
      "This isn't about finding a pre-made path, but <strong class='font-semibold text-brand-yellow'>designing YOUR game</strong> based on YOUR desired reality.",
    ],
    pointsRu: [
      "Чувство замешательства, потерянности или желание все бросить – это нормально. Часто требуется <strong class='font-semibold text-brand-yellow'>1-2 месяца</strong> этой фазы 'Лимбо', чтобы сформировалось истинное видение.",
      "Словно надевая новые AR-очки, нам нужна <strong class='font-semibold text-brand-yellow'>новая перспектива</strong>, чтобы превратить жизнь в увлекательную игру вместо запутанной борьбы.",
      "Речь не о поиске готового пути, а о <strong class='font-semibold text-brand-yellow'>создании ТВОЕЙ игры</strong>, основанной на ТВОЕЙ желаемой реальности.",
    ],
    imageUrlKey: "placeholder1",
  },
  {
    id: "phases",
    icon: FaArrowsSpin,
    titleEn: "The 4 Phases of Your Life's Game Levels",
    titleRu: "4 Фазы Уровней Твоей Жизненной Игры",
    pointsEn: [
      "<strong class='text-gray-400'>Level 1: Limbo <FaQuestionCircle className='inline mx-1'/></strong> - You don't know what to do or what you want. Feeling lost, stuck.",
      "<strong class='text-brand-cyan'>Level 2: Vision <FaEye className='inline mx-1'/></strong> - An image for the future forms. You start acting on a new path, momentum builds.",
      "<strong class='text-brand-green'>Level 3: Flow <FaPlay className='inline mx-1'/></strong> - You're deeply engaged, can't pull yourself away from the goal.",
      "<strong class='text-brand-orange'>Level 4: Resistance <FaExclamationTriangle className='inline mx-1'/></strong> - Exponential progress plateaus. You cling to past success, avoiding the next 'Limbo'.",
      "Most get trapped in Limbo because they're trained to follow scripts and wait for external certainty, interpreting 'feeling lost' as a bad sign instead of a <strong class='font-semibold text-brand-yellow'>necessary starting point</strong>.",
    ],
    pointsRu: [
      "<strong class='text-gray-400'>Уровень 1: Лимбо <FaQuestionCircle className='inline mx-1'/></strong> - Ты не знаешь, что делать или чего хочешь. Чувство потерянности, застоя.",
      "<strong class='text-brand-cyan'>Уровень 2: Видение <FaEye className='inline mx-1'/></strong> - Формируется образ будущего. Ты начинаешь действовать на новом пути, набирается импульс.",
      "<strong class='text-brand-green'>Уровень 3: Поток <FaPlay className='inline mx-1'/></strong> - Ты глубоко вовлечен, не можешь оторваться от цели.",
      "<strong class='text-brand-orange'>Уровень 4: Сопротивление <FaExclamationTriangle className='inline mx-1'/></strong> - Экспоненциальный прогресс замедляется. Ты цепляешься за прошлый успех, избегая следующего 'Лимбо'.",
      "Большинство застревают в Лимбо, потому что их научили следовать сценариям и ждать внешней уверенности, интерпретируя 'чувство потерянности' как плохой знак, а не как <strong class='font-semibold text-brand-yellow'>необходимую отправную точку</strong>.",
    ],
  },
  {
    id: "escape_limbo",
    icon: FaRoad,
    titleEn: "Step 1: Escape Limbo - Define Your Anti-Vision",
    titleRu: "Шаг 1: Побег из Лимбо - Определи Анти-Видение",
    pointsEn: [
      "Give yourself permission to <strong class='font-semibold text-brand-pink'>allow your life to get worse (temporarily)</strong>. This counterintuitive step breaks the fear of failure.",
      "You feel lost because you lack a clear goal. But goals don't appear magically; they emerge from <strong class='font-semibold text-brand-pink'>avoiding a negative outcome</strong>.",
      "Ask: 'If I keep doing the same things, where will my life end up?' Sit with this thought. Let it consume you.",
      "This <strong class='font-semibold text-brand-pink'>negative vision</strong> fuels the hunger to learn, experiment, and grow.",
      "You need a problem to solve, an enemy to attack (even if that enemy is your current trajectory).",
    ],
    pointsRu: [
      "Дай себе разрешение <strong class='font-semibold text-brand-pink'>позволить своей жизни стать хуже (временно)</strong>. Этот контринтуитивный шаг ломает страх неудачи.",
      "Ты чувствуешь себя потерянным из-за отсутствия ясной цели. Но цели не появляются волшебным образом; они рождаются из <strong class='font-semibold text-brand-pink'>желания избежать негативного исхода</strong>.",
      "Спроси: 'Если я продолжу делать то же самое, где окажется моя жизнь?' Поразмышляй над этим. Позволь этой мысли поглотить тебя.",
      "Это <strong class='font-semibold text-brand-pink'>негативное видение</strong> питает жажду учиться, экспериментировать и расти.",
      "Тебе нужна проблема для решения, враг для атаки (даже если этот враг — твоя текущая траектория).",
    ],
  },
  {
    id: "build_vision",
    icon: FaLightbulb,
    titleEn: "Step 2: Build Vision - Collect Puzzle Pieces",
    titleRu: "Шаг 2: Построй Видение - Собери Пазл",
    pointsEn: [
      "Your mind makes sense of the world through <strong class='font-semibold text-brand-cyan'>stories</strong>. Feeling lost means you don't know your story or you're living someone else's.",
      "Taking back control means collecting the <strong class='font-semibold text-brand-cyan'>right puzzle pieces</strong> (new information, experiences) until vision forms.",
      "Immerse yourself in <strong class='font-semibold text-brand-cyan'>new sources of information</strong>: read new books, talk to new people, follow new accounts, visit new places, listen to podcasts, take courses.",
      "Focus on information that has the potential to <strong class='font-semibold text-brand-cyan'>spark change</strong>.",
      "When your mind wants to avoid the negative trajectory (Step 1), <strong class='font-semibold text-brand-cyan'>true learning occurs</strong>. You'll feel dopamine when you find potential opportunities.",
      "Don't wait for absolute confidence; clarity comes from <strong class='font-semibold text-brand-cyan'>error correcting</strong> as you move forward.",
    ],
    pointsRu: [
      "Твой разум осмысливает мир через <strong class='font-semibold text-brand-cyan'>истории</strong>. Чувство потерянности означает, что ты не знаешь свою историю или живешь по чужому сценарию.",
      "Вернуть контроль – значит собирать <strong class='font-semibold text-brand-cyan'>правильные кусочки пазла</strong> (новую информацию, опыт) до тех пор, пока не сформируется видение.",
      "Погрузись в <strong class='font-semibold text-brand-cyan'>новые источники информации</strong>: читай новые книги, общайся с новыми людьми, подписывайся на новые аккаунты, посещай новые места, слушай подкасты, проходи курсы.",
      "Сфокусируйся на информации, которая может <strong class='font-semibold text-brand-cyan'>вызвать изменения</strong>.",
      "Когда твой разум хочет избежать негативной траектории (Шаг 1), происходит <strong class='font-semibold text-brand-cyan'>настоящее обучение</strong>. Ты почувствуешь дофамин, когда найдешь потенциальные возможности.",
      "Не жди абсолютной уверенности; ясность приходит через <strong class='font-semibold text-brand-cyan'>коррекцию ошибок</strong> по мере движения вперед.",
    ],
  },
  {
    id: "gamify",
    icon: FaGamepad,
    titleEn: "Step 3: Gamify Your Life - Design the Game",
    titleRu: "Шаг 3: Геймифицируй Жизнь - Спроектируй Игру",
    pointsEn: [
      "Your mind runs on a storyline. Games are pre-constructed stories with mechanisms that <strong class='font-semibold text-brand-green'>narrow focus and make progress enjoyable</strong>.",
      "Replicate game mechanics in your life:",
      "<strong class='text-brand-green'>1. Clear Hierarchy of Goals <FaBullseye className='inline mx-1'/>:</strong> Define your end goal (long-term vision), break it down into long-term (e.g., 1 year) and short-term (e.g., 1 month, 1 week) goals. These are directions, not rigid destinations.",
      "<strong class='text-brand-green'>2. Create the Rules <FaRulerCombined className='inline mx-1'/>:</strong> What are you *not* willing to sacrifice (health, relationships, ethics)? These constraints foster creativity.",
      "<strong class='text-brand-green'>3. Quantifiable Feedback Loops <FaListCheck className='inline mx-1'/>:</strong> Define daily/weekly priority tasks (e.g., write 1000 words, read 10 pages, reach out to 5 clients). Completing these provides direct feedback on progress.",
      "This structure turns vague aspirations into an actionable game.",
      "Start playing! You figure out the specifics by <strong class='font-semibold text-brand-green'>doing and error-correcting</strong>.",
    ],
    pointsRu: [
      "Твой разум работает по сюжетной линии. Игры – это заранее построенные истории с механизмами, которые <strong class='font-semibold text-brand-green'>сужают фокус и делают прогресс приятным</strong>.",
      "Воспроизведи игровые механики в своей жизни:",
      "<strong class='text-brand-green'>1. Четкая Иерархия Целей <FaBullseye className='inline mx-1'/>:</strong> Определи конечную цель (долгосрочное видение), разбей ее на долгосрочные (например, 1 год) и краткосрочные (например, 1 месяц, 1 неделя) цели. Это направления, а не жесткие пункты назначения.",
      "<strong class='text-brand-green'>2. Создай Правила <FaRulerCombined className='inline mx-1'/>:</strong> Чем ты *не* готов пожертвовать (здоровье, отношения, этика)? Эти ограничения стимулируют креативность.",
      "<strong class='text-brand-green'>3. Измеримые Петли Обратной Связи <FaListCheck className='inline mx-1'/>:</strong> Определи ежедневные/еженедельные приоритетные задачи (напр., написать 1000 слов, прочитать 10 страниц, связаться с 5 клиентами). Их выполнение дает прямую обратную связь о прогрессе.",
      "Эта структура превращает расплывчатые стремления в действенную игру.",
      "Начни играть! Ты разберешься в деталях <strong class='font-semibold text-brand-green'>в процессе делания и исправления ошибок</strong>.",
    ],
    imageUrlKey: "placeholder2",
  },
  {
    id: "stay_edge",
    icon: FaDumbbell,
    titleEn: "Bonus Level: Stay at the Edge (Flow & Growth)",
    titleRu: "Бонусный Уровень: Оставайся на Грани (Поток и Рост)",
    pointsEn: [
      "To stay in the flow state (optimal experience), you need to constantly balance challenge and skill.",
      "Stay at the <strong class='font-semibold text-brand-purple'>edge of the unknown</strong>. Slightly increase the challenge of what you do each week/month (like adding small weights in the gym).",
      "This doesn't mean *more* work, but slightly <strong class='font-semibold text-brand-purple'>harder or different</strong> work that stretches your current skills.",
      "Cultivate your skillset and consistently take on <strong class='font-semibold text-brand-purple'>higher challenges</strong>. This maximizes meaningful learning and keeps life engaging.",
      "This is how you avoid both anxiety (challenge >> skill) and boredom (skill >> challenge).",
    ],
    pointsRu: [
      "Чтобы оставаться в состоянии потока (оптимального опыта), нужно постоянно балансировать между вызовом и навыком.",
      "Держись на <strong class='font-semibold text-brand-purple'>грани неизвестного</strong>. Немного увеличивай сложность того, что ты делаешь, каждую неделю/месяц (как добавление малых весов в зале).",
      "Это не значит *больше* работы, а немного <strong class='font-semibold text-brand-purple'>сложнее или иначе</strong>, чтобы растянуть текущие навыки.",
      "Развивай свой набор навыков и последовательно берись за <strong class='font-semibold text-brand-purple'>более высокие вызовы</strong>. Это максимизирует осмысленное обучение и поддерживает интерес к жизни.",
      "Так ты избегаешь и тревоги (вызов >> навык), и скуки (навык >> вызов).",
    ],
  },
   {
    id: "tools",
    icon: FaRobot,
    titleEn: "Power-Ups: AI Coach & Resources",
    titleRu: "Усиления: AI-Коуч и Ресурсы",
    pointsEn: [
      "Dan Koe created an AI prompt designed to act as a <strong class='font-semibold text-brand-yellow'>LifeQuest AI coach</strong>.",
      "This prompt helps you identify your current life phase, discover potential directions, and structures your findings into a game format (Main Quest, Side Quests, Character Stats, Level System, Rules, Tutorial Phase, etc.).",
      "It acts as a <strong class='font-semibold text-brand-yellow'>creative sparring partner</strong>, helping you overcome blocks and clarify your thinking.",
      "You can use tools like ChatGPT, Claude, or specialized AI platforms to implement this.",
      "He also offers a mini-course on systematizing life with AI, potentially useful for integrating these concepts.",
    ],
    pointsRu: [
      "Дэн Ко создал AI-промпт, разработанный как <strong class='font-semibold text-brand-yellow'>LifeQuest AI коуч</strong>.",
      "Этот промпт помогает определить твою текущую жизненную фазу, найти потенциальные направления и структурирует твои находки в игровой формат (Главный Квест, Побочные Квесты, Характеристики Персонажа, Система Уровней, Правила, Обучающая Фаза и т.д.).",
      "Он действует как <strong class='font-semibold text-brand-yellow'>креативный спарринг-партнер</strong>, помогая преодолевать блоки и прояснять мышление.",
      "Ты можешь использовать инструменты вроде ChatGPT, Claude или специализированные AI-платформы для этого.",
      "Он также предлагает мини-курс по систематизации жизни с AI, который может быть полезен для интеграции этих концепций.",
    ],
    imageUrlKey: "placeholder3",
  },
  {
    id: "conclusion",
    icon: FaRocket,
    titleEn: "Launch Your Game!",
    titleRu: "Запусти Свою Игру!",
    pointsEn: [
      "Stop waiting for perfect clarity or external permission.",
      "Use these frameworks (Anti-Vision, Vision, Game Design) to <strong class='font-semibold text-neon-lime'>start now</strong>.",
      "Embrace the 'Limbo' as the start line, collect your vision pieces, design your initial game rules, and <strong class='font-semibold text-neon-lime'>start playing</strong>.",
      "Your path will become clearer as you move, learn, and adapt. The 'Sight' lenses get clearer with use.",
      "Explore related concepts in <Link href='/selfdev' class='text-brand-green hover:underline font-semibold'>SelfDev</Link> and <Link href='/p-plan' class='text-brand-purple hover:underline font-semibold'>P-Plan</Link> for practical application.",
    ],
    pointsRu: [
      "Перестань ждать идеальной ясности или внешнего разрешения.",
      "Используй эти фреймворки (Анти-Видение, Видение, Дизайн Игры), чтобы <strong class='font-semibold text-neon-lime'>начать сейчас</strong>.",
      "Прими 'Лимбо' как стартовую линию, собери кусочки своего видения, спроектируй начальные правила игры и <strong class='font-semibold text-neon-lime'>начни играть</strong>.",
      "Твой путь прояснится по мере движения, обучения и адаптации. 'Линзы Ясности' становятся четче с использованием.",
      "Изучи связанные концепции в <Link href='/selfdev' class='text-brand-green hover:underline font-semibold'>SelfDev</Link> и <Link href='/p-plan' class='text-brand-purple hover:underline font-semibold'>P-Plan</Link> для практического применения.",
    ],
  },
];

// --- Component ---
export default function GamifiedSelfDevPage() {
  const { user } = useAppContext();
  const [isMounted, setIsMounted] = useState(false);
  const [selectedLang, setSelectedLang] = useState<Language>('ru');

  useEffect(() => {
    setIsMounted(true);
    const browserLang = typeof navigator !== 'undefined' ? navigator.language.split('-')[0] : 'ru';
    const initialLang = user?.language_code === 'ru' || (!user?.language_code && browserLang === 'ru') ? 'ru' : 'en';
    setSelectedLang(initialLang);
    debugLogger.log(`[GamifiedSelfDevPage] Mounted. Browser lang: ${browserLang}, User lang: ${user?.language_code}, Initial selected: ${initialLang}`);
  }, [user?.language_code]);

  if (!isMounted) {
    return (
      <div className="flex justify-center items-center min-h-screen pt-20 bg-gradient-to-br from-gray-900 via-black to-gray-800">
        <p className="text-brand-yellow animate-pulse text-xl font-mono">Загрузка геймификации SelfDev...</p>
      </div>
    );
  }

  const pageThemeColor = "brand-yellow"; // Yellow theme for clarity/gamification
  const pageBorderColor = `border-${pageThemeColor}/30`;
  const pageTextColor = `text-${pageThemeColor}`;
  const pageShadowColor = `shadow-[0_0_30px_rgba(255,193,7,0.4)]`; // Yellow shadow

  return (
    <div className="relative min-h-screen overflow-hidden pt-20 pb-10 bg-gradient-to-br from-gray-900 via-black to-gray-800 text-gray-200">
      {/* .. Background Grid */}
      <div
        className="absolute inset-0 bg-repeat opacity-[0.03] z-0"
        style={{
          backgroundImage: `linear-gradient(to right, rgba(255, 193, 7, 0.4) 1px, transparent 1px),
                            linear-gradient(to bottom, rgba(255, 193, 7, 0.4) 1px, transparent 1px)`,
          backgroundSize: '60px 60px',
        }}
      ></div>

      <TooltipProvider delayDuration={150}>
        <div className="relative z-10 container mx-auto px-4">
          <Card className={cn(
              "max-w-4xl mx-auto bg-black/85 backdrop-blur-lg text-white rounded-2xl border",
              pageBorderColor,
              pageShadowColor
          )}>
            <CardHeader className={cn("text-center border-b pb-4", `border-${pageThemeColor}/20`)}>
              <FaGlasses className={`mx-auto text-5xl mb-4 ${pageTextColor} animate-pulse`} />
              <CardTitle className={cn("text-3xl md:text-5xl font-bold cyber-text glitch", pageTextColor)} data-text="Gamify Your Life: The 'Sight' Method">
                 Gamify Your Life: The 'Sight' Method
              </CardTitle>
              <p className="text-md md:text-lg text-gray-300 mt-3 font-mono">
                 {selectedLang === 'ru'
                    ? "Преврати замешательство в ясность и действие, используя игровую механику."
                    : "Turn confusion into clarity and action using game mechanics."}
              </p>
               <p className="text-sm text-gray-400 mt-1">
                 {selectedLang === 'ru' ? "По мотивам Дэна Ко и фильма 'Sight - Extended'" : "Inspired by Dan Koe & 'Sight - Extended'"}
               </p>
            </CardHeader>

            <CardContent className="space-y-12 p-4 md:p-8">
              {/* .. Language Toggle */}
              <div className="flex justify-center space-x-2 mb-8">
                 <Button
                   variant={selectedLang === 'ru' ? 'secondary' : 'outline'}
                   size="sm"
                   onClick={() => setSelectedLang('ru')}
                   className={cn(
                       `border-${pageThemeColor}/50`,
                       selectedLang === 'ru' ? `bg-${pageThemeColor}/20 ${pageTextColor} hover:bg-${pageThemeColor}/30` : 'text-gray-400 hover:bg-gray-800 hover:text-gray-200'
                   )}
                 >
                   🇷🇺 Русский
                 </Button>
                 <Button
                    variant={selectedLang === 'en' ? 'secondary' : 'outline'}
                    size="sm"
                    onClick={() => setSelectedLang('en')}
                    className={cn(
                       "border-brand-green/50",
                       selectedLang === 'en' ? 'bg-brand-green/20 text-brand-green hover:bg-brand-green/30' : 'text-gray-400 hover:bg-gray-800 hover:text-gray-200'
                    )}
                 >
                   🇬🇧 English
                 </Button>
              </div>

              {/* .. Sections Rendering */}
              {sections.map((section, index) => {
                const IconComponent = section.icon;
                // Cycle through a palette including the main theme color
                const themePalette = ["text-brand-yellow", "text-brand-cyan", "text-brand-pink", "text-brand-green", "text-brand-purple", "text-brand-orange"];
                const themeColor = themePalette[index % themePalette.length];
                const borderColor = themeColor.replace("text-", "border-");
                const currentTitle = selectedLang === 'en' ? section.titleEn : section.titleRu;
                const currentPoints = selectedLang === 'en' ? section.pointsEn : section.pointsRu;
                const imageInfo = section.imageUrlKey ? imagePlaceholders[section.imageUrlKey as keyof typeof imagePlaceholders] : null;
                const currentImageUrl = imageInfo?.url;
                const currentImageAlt = selectedLang === 'en' ? imageInfo?.altEn : imageInfo?.altRu;
                const currentTooltip = selectedLang === 'ru' ? imageInfo?.tooltipRu : null;

                return (
                  <section key={section.id} className={`space-y-4 border-l-4 pl-4 md:pl-6 ${borderColor}`}>
                    <h2 className={`flex items-center text-2xl md:text-3xl font-semibold ${themeColor} mb-4 font-orbitron`}>
                      <IconComponent className={`mr-3 ${themeColor}/80 flex-shrink-0`} /> {currentTitle}
                    </h2>

                    {currentPoints.length > 0 && (
                      <ul className="list-disc list-outside space-y-2 text-gray-300 pl-5 text-base md:text-lg leading-relaxed">
                        {currentPoints.map((point, i) => (
                          <li key={`${selectedLang}-${section.id}-${i}`} dangerouslySetInnerHTML={{ __html: point }}></li>
                        ))}
                      </ul>
                    )}

                    {currentImageUrl && currentImageAlt && (
                      <div className={`my-6 p-2 border ${borderColor}/30 rounded-lg bg-black/30 max-w-md mx-auto`}>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <div className="aspect-video w-full h-auto overflow-hidden rounded-md bg-gray-800/50 cursor-help relative">
                              <Image
                                src={currentImageUrl} alt={currentImageAlt} width={600} height={338}
                                className="w-full h-full object-contain opacity-90 hover:opacity-100 transition-opacity duration-300"
                                loading="lazy" placeholder="blur" blurDataURL={PLACEHOLDER_BLUR_URL}
                                onError={(e) => {
                                  debugLogger.error(`Failed to load image: ${currentImageUrl}`);
                                  e.currentTarget.style.display = 'none';
                                }}
                              />
                            </div>
                          </TooltipTrigger>
                          {currentTooltip && (
                            <TooltipContent side="bottom" className={`max-w-[300px] text-center bg-gray-950 ${borderColor}/60 text-white p-3 shadow-lg border`}>
                              <p className="text-sm whitespace-pre-wrap">{currentTooltip}</p>
                            </TooltipContent>
                          )}
                        </Tooltip>
                        <p className="text-xs text-center text-gray-400 mt-1 italic">{currentImageAlt}</p>
                      </div>
                    )}
                     {/* Specific links related to AI Coach */}
                     {section.id === 'tools' && (
                        <div className="mt-4 text-sm text-center">
                            <p className="text-gray-400">
                                {selectedLang === 'ru' ? 'Найди AI-промпт в ' : 'Find the AI prompt in the '}
                                <a href="https://docs.google.com/document/d/1n_8py56cYMLsv_QEgK7JjHjVp4Uep037cGwnsYdkQ7c/edit?usp=sharing" target="_blank" rel="noopener noreferrer" className={`font-semibold hover:underline ${pageTextColor}`}>
                                    Digital Economics Stack
                                </a>
                                {selectedLang === 'ru' ? ' (скоро будет локализован).' : '.'}
                            </p>
                             <p className="text-gray-400 mt-1">
                                {selectedLang === 'ru' ? 'Или изучи ' : 'Or explore the '}
                                <a href="https://thedankoe.com/ai-content-systems/" target="_blank" rel="noopener noreferrer" className={`font-semibold hover:underline ${pageTextColor}`}>
                                    AI Content Systems Mini-Course
                                </a>
                                {selectedLang === 'ru' ? '.' : '.'}
                            </p>
                        </div>
                    )}
                  </section>
                );
              })}

              {/* .. Concluding section */}
              <section className="text-center pt-8 border-t border-brand-yellow/20 mt-10">
                 <p className="text-gray-400 italic">
                   {selectedLang === 'ru' ? "Геймификация — мощный инструмент для SelfDev. Начни проектировать свою игру сегодня!" : "Gamification is a powerful tool for SelfDev. Start designing your game today!"}
                 </p>
                 <p className="mt-4 text-gray-300">
                   {selectedLang === 'ru' ? "Примени эти принципы к своему пути на" : "Apply these principles to your journey in"} <Link href="/selfdev" className="text-brand-green hover:underline font-semibold">SelfDev</Link>, {selectedLang === 'ru' ? "спланируй с помощью" : "plan with"} <Link href="/p-plan" className="text-brand-purple hover:underline font-semibold">P-Plan</Link>, {selectedLang === 'ru' ? "и начни быстро с" : "and"} <Link href="/jumpstart" className="text-neon-lime hover:underline font-semibold">Jumpstart</Link>.
                 </p>
              </section>

            </CardContent>
          </Card>
        </div>
      </TooltipProvider>
    </div>
  );
}
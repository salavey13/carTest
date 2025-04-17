"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAppContext } from "@/contexts/AppContext";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  FaBrain, FaUserAstronaut, FaLock, FaFlaskVial, FaClipboardList, FaChartLine,
  FaCheckDouble, FaRegLightbulb, FaRoute, FaBan, FaRocket, FaTools, FaBalanceScale, FaAward,
  FaSadTear, FaRunning, FaSearchDollar, FaExclamationTriangle, FaLowVision, FaQuestionCircle
} from "react-icons/fa"; // Diverse icons
import { LuActivity, LuEye, LuClipboardCheck, LuRotateCcw, LuPauseCircle, LuPlayCircle, LuThumbsUp, LuThumbsDown, LuZap } from "react-icons/lu"; // Lucide icons

import { debugLogger } from "@/lib/debugLogger";
import Image from "next/image";
import Link from "next/link";
import { cn } from "@/lib/utils";

type Language = 'en' | 'ru';

// Placeholder for image URLs - replace with actual URLs if available
const STORAGE_BASE_URL_EXP = "https://placehold.co"; // Placeholder URL base

const PLACEHOLDER_BLUR_URL = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII="; // Tiny transparent png

// --- Section Data ---
const sections = [
  {
    id: "intro-mindset",
    icon: FaBrain,
    titleEn: "Understanding Mindsets",
    titleRu: "Понимание Мышления",
    pointsEn: [
      "A mindset is your <strong class='font-semibold text-brand-green'>default way of seeing the world</strong>.",
      "It influences decisions, relationships, thoughts, and feelings.",
      "Unconscious mindsets act like <strong class='font-semibold text-brand-green'>autopilot</strong>, driving life direction.",
      "Awareness allows for conscious choices aligned with desires.",
      "Mindsets <strong class='font-semibold text-brand-green'>can change</strong>; the first step is making them conscious.",
    ],
    pointsRu: [
      "Мышление – это ваш <strong class='font-semibold text-brand-green'>стандартный способ видения мира</strong>.",
      "Оно влияет на решения, отношения, мысли и чувства.",
      "Неосознанные установки действуют как <strong class='font-semibold text-brand-green'>автопилот</strong>, управляя направлением жизни.",
      "Осознанность позволяет делать сознательный выбор в соответствии с желаниями.",
      "Мышление <strong class='font-semibold text-brand-green'>можно изменить</strong>; первый шаг – сделать неосознанное сознательным.",
    ],
    imageUrlEn: `${STORAGE_BASE_URL_EXP}/600x338/1a1a2e/00FF9D/png?text=Mindset+Lens`,
    imageUrlRu: `${STORAGE_BASE_URL_EXP}/600x338/1a1a2e/00FF9D/png?text=Линза+Мышления`,
    imageAltEn: "Conceptual image: A lens representing a mindset shaping perception",
    imageAltRu: "Концептуальное изображение: Линза, представляющая мышление, формирующее восприятие",
    tooltipRu: "Мышление как фильтр, через который мы воспринимаем реальность. Осознанность позволяет этот фильтр настроить.",
  },
  {
    id: "speaker-journey",
    icon: FaRoute, // Changed icon
    titleEn: "Speaker's Journey: Linear vs. Experimental",
    titleRu: "Путь Спикера: Линейный против Экспериментального",
    // Nested structure for the two paths
    subSections: [
        {
            titleEn: "Chapter 1: The Linear Path (Autopilot)",
            titleRu: "Глава 1: Линейный Путь (Автопилот)",
            borderColor: "border-red-500", // Use semantic color
            textColor: "text-red-400",
            icon: FaExclamationTriangle,
            pointsEn: [
                "Followed <strong class='font-semibold text-red-400'>traditional scripts</strong>: good grades -> Google -> corporate ladder.",
                "External success masked internal <strong class='font-semibold text-red-400'>emptiness, boredom, and burnout</strong>.",
                "Starting a startup was another script, still unfulfilling.",
                "Failure forced the question: \"What do *I* actually want?\""
            ],
            pointsRu: [
                "Следование <strong class='font-semibold text-red-400'>традиционным сценариям</strong>: хорошие оценки -> Google -> карьерная лестница.",
                "Внешний успех маскировал внутреннюю <strong class='font-semibold text-red-400'>пустоту, скуку и выгорание</strong>.",
                "Запуск стартапа был очередным сценарием, все еще не приносящим удовлетворения.",
                "Неудача заставила задать вопрос: \"Чего *я* на самом деле хочу?\""
            ],
             imageUrlEn: `${STORAGE_BASE_URL_EXP}/600x338/1a1a2e/FF6B6B/png?text=Linear+Path+Trap`,
             imageUrlRu: `${STORAGE_BASE_URL_EXP}/600x338/1a1a2e/FF6B6B/png?text=Ловушка+Линейности`,
             imageAltEn: "Illustration of a straight, rigid path leading to a dead end or burnout",
             imageAltRu: "Иллюстрация прямого, жесткого пути, ведущего в тупик или к выгоранию",
        },
        {
            titleEn: "Chapter 2: The Experimental Path (Conscious Choice)",
            titleRu: "Глава 2: Экспериментальный Путь (Сознательный Выбор)",
            borderColor: "border-green-500", // Use semantic color
            textColor: "text-green-400",
            icon: LuZap, // More dynamic icon
            pointsEn: [
                "Shifted focus to <strong class='font-semibold text-green-400'>genuine curiosity</strong>, independent of validation.",
                "Studied neuroscience (PhD) based on fascination with the brain.",
                "Embraced <strong class='font-semibold text-green-400'>\"learning in public\"</strong> via a newsletter.",
                "This \"tiny experiment\" sparked the exploration of the experimental mindset."
            ],
            pointsRu: [
                "Смещение фокуса на <strong class='font-semibold text-green-400'>подлинное любопытство</strong>, независимое от валидации.",
                "Изучение нейронаук (PhD) из-за увлечения мозгом.",
                "Принятие <strong class='font-semibold text-green-400'>\"обучения на публике\"</strong> через новостную рассылку.",
                "Этот \"крошечный эксперимент\" положил начало исследованию экспериментального мышления."
            ],
            imageUrlEn: `${STORAGE_BASE_URL_EXP}/600x338/1a1a2e/AEFF00/png?text=Experimental+Path`,
            imageUrlRu: `${STORAGE_BASE_URL_EXP}/600x338/1a1a2e/AEFF00/png?text=Путь+Эксперимента`,
            imageAltEn: "Illustration of a winding, adaptive path leading upwards with discovery points",
            imageAltRu: "Иллюстрация извилистого, адаптивного пути, ведущего вверх с точками открытий",
        }
    ],
    tooltipRu: "Сравнение двух подходов к жизни: следование внешним сценариям против пути, основанного на любопытстве и экспериментах.",
  },
  {
    id: "blocking-mindsets",
    icon: FaLock,
    titleEn: "Three Subconscious Traps",
    titleRu: "Три Подсознательные Ловушки",
    introEn: "These mindsets often operate unconsciously, preventing us from living fulfilling, conscious lives. They exist on a spectrum of Curiosity and Ambition:",
    introRu: "Эти установки часто действуют неосознанно, мешая нам жить полноценной, сознательной жизнью. Они существуют на спектре Любопытства и Амбиций:",
    // Grid layout for mindsets
    gridItems: [
        {
            titleEn: "Cynical Mindset", titleRu: "Циничное Мышление",
            icon: FaSadTear, color: "gray",
            pointsEn: ["Low Curiosity, Low Ambition.", "Lost drive, mocks earnestness.", "Stuck in survival mode."],
            pointsRu: ["Низкое Любопытство, Низкие Амбиции.", "Потерял(а) драйв, высмеивает искренность.", "Застрял(а) в режиме выживания."],
            leadsToEn: "Doomscrolling, negativity, 'what's the point?'", leadsToRu: "Думскроллинг, негатив, 'какой смысл?'"
        },
        {
            titleEn: "Escapist Mindset", titleRu: "Эскапистское Мышление",
            icon: FaRunning, color: "blue",
            pointsEn: ["High Curiosity, Low Ambition.", "Curious but avoids responsibility.", "Seeks escape."],
            pointsRu: ["Высокое Любопытство, Низкие Амбиции.", "Любопытен(на), но избегает ответственности.", "Ищет побега."],
            leadsToEn: "Binge-watching, retail therapy, endless dream planning.", leadsToRu: "Запойный просмотр, шопинг-терапия, бесконечное планирование мечты."
        },
        {
            titleEn: "Perfectionist Mindset", titleRu: "Перфекционистское Мышление",
            icon: FaSearchDollar, color: "red", // Changed icon
            pointsEn: ["Low Curiosity, High Ambition.", "Escapes uncertainty via work.", "Defers happiness for external goals."],
            pointsRu: ["Низкое Любопытство, Высокие Амбиции.", "Избегает неопределенности через работу.", "Откладывает счастье ради внешних целей."],
            leadsToEn: "Overworking, toxic productivity, burnout.", leadsToRu: "Переработки, токсичная продуктивность, выгорание."
        }
    ],
    outroEn: "Crucially, these mindsets are <strong class='font-semibold text-brand-yellow'>fluid</strong> and not fixed. Awareness is the first step to change.",
    outroRu: "Важно: эти установки <strong class='font-semibold text-brand-yellow'>гибки</strong> и не являются неизменными. Осознанность – первый шаг к изменению.",
    tooltipRu: "Три ловушки мышления, мешающие росту: Цинизм (апатия), Эскапизм (избегание) и Перфекционизм (страх ошибки).",
  },
  {
    id: "experimental-mindset",
    icon: FaFlaskVial,
    titleEn: "The Alternative: Experimental Mindset",
    titleRu: "Альтернатива: Экспериментальное Мышление",
    pointsEn: [
      "<strong class='font-semibold text-neon-lime'>High Curiosity, High Ambition</strong>.",
      "Embraces drive AND openness to learn.",
      "Sees uncertainty as an <strong class='font-semibold text-neon-lime'>opportunity</strong> to explore, grow, learn.",
      "Focuses on the <strong class='font-semibold text-neon-lime'>process of discovery</strong>, not just outcomes.",
      "Treats failures/mistakes as valuable <strong class='font-semibold text-neon-lime'>data points</strong>.",
      "Moves from rigid plans to iterative <strong class='font-semibold text-neon-lime'>experimentation</strong>.",
      "Turns 'not understanding' into curiosity, not fear.",
    ],
    pointsRu: [
      "<strong class='font-semibold text-neon-lime'>Высокое Любопытство, Высокие Амбиции</strong>.",
      "Сочетает стремление к цели И открытость обучению.",
      "Рассматривает неопределенность как <strong class='font-semibold text-neon-lime'>возможность</strong> исследовать, расти, учиться.",
      "Фокусируется на <strong class='font-semibold text-neon-lime'>процессе открытия</strong>, а не только на результатах.",
      "Воспринимает неудачи/ошибки как ценные <strong class='font-semibold text-neon-lime'>точки данных</strong>.",
      "Переходит от жестких планов к итеративным <strong class='font-semibold text-neon-lime'>экспериментам</strong>.",
      "Превращает 'непонимание' в любопытство, а не страх.",
    ],
    imageUrlEn: `${STORAGE_BASE_URL_EXP}/600x338/1a1a2e/AEFF00/png?text=Experimental+Mindset+Cycle`,
    imageUrlRu: `${STORAGE_BASE_URL_EXP}/600x338/1a1a2e/AEFF00/png?text=Цикл+Эксп.+Мышления`,
    imageAltEn: "Diagram showing a cycle: Curiosity -> Experiment -> Data/Learning -> Adapt -> Repeat",
    imageAltRu: "Диаграмма цикла: Любопытство -> Эксперимент -> Данные/Обучение -> Адаптация -> Повтор",
    tooltipRu: "Экспериментальное мышление как динамичный цикл обучения и адаптации, движимый любопытством и амбициями.",
  },
  {
    id: "pact-framework",
    icon: FaClipboardList,
    titleEn: "Designing Tiny Experiments: The PACT Framework",
    titleRu: "Дизайн Крошечных Экспериментов: Фреймворк PACT",
    introEn: "Based on the scientific method, use PACT to design your experiments:",
    introRu: "На основе научного метода, используйте PACT для дизайна экспериментов:",
    // PACT structure
    pactItems: [
        { letter: "P", titleEn: "Purposeful", titleRu: "Целенаправленный", descEn: "Driven by genuine curiosity; something you care about exploring.", descRu: "Движимый подлинным любопытством; то, что вам интересно исследовать.", color: "pink" },
        { letter: "A", titleEn: "Actionable", titleRu: "Действенный", descEn: "Start *now* with current resources; no complex prerequisites.", descRu: "Начать *сейчас* с текущими ресурсами; без сложных предварительных условий.", color: "blue" },
        { letter: "C", titleEn: "Continuous (Time-Bound)", titleRu: "Непрерывный (Ограниченный по времени)", descEn: "Commit to a specific, reasonable duration/trials upfront (e.g., 'for 3 weeks'). Not a vague resolution.", descRu: "Обязательство на конкретный, разумный срок/количество попыток (напр., 'на 3 недели'). Не расплывчатое обещание.", color: "orange" },
        { letter: "T", titleEn: "Trackable", titleRu: "Отслеживаемый", descEn: "Simple tracking: Did you do it? Yes/No. Focus on completion & observation, not complex metrics.", descRu: "Простое отслеживание: Сделал(а)? Да/Нет. Фокус на завершении и наблюдении, а не на сложных метриках.", color: "green" }
    ],
    outroEn: "Different from habits (assumed long-term good) & KPIs (outcome-focused). PACTs prioritize <strong class='font-semibold text-brand-yellow'>learning and exploration</strong> within a defined scope.",
    outroRu: "Отличается от привычек (предполагаемая долгосрочная польза) и KPI (фокус на результате). PACTы ставят в приоритет <strong class='font-semibold text-brand-yellow'>обучение и исследование</strong> в заданных рамках.",
    tooltipRu: "PACT: Целенаправленный, Действенный, Непрерывный (Ограниченный по времени), Отслеживаемый - структура для управляемых экспериментов.",
  },
  {
    id: "analyzing-data",
    icon: FaChartLine,
    titleEn: "Learning from Experiments: Internal & External Data",
    titleRu: "Обучение на Экспериментах: Внутренние и Внешние Данные",
    introEn: "After your PACT period, analyze the data considering both:",
    introRu: "После завершения периода PACT, проанализируйте данные, учитывая оба аспекта:",
    subSections: [ // Using subSections for structure
      {
        titleEn: "External Data", titleRu: "Внешние Данные",
        borderColor: "border-brand-cyan", textColor: "text-brand-cyan",
        icon: LuEye,
        pointsEn: ["Observable results: metrics, feedback, tangible outcomes.", "Did it achieve conventional success?"],
        pointsRu: ["Наблюдаемые результаты: метрики, обратная связь, ощутимые итоги.", "Достигнут ли конвенциональный успех?"],
      },
      {
        titleEn: "Internal Data", titleRu: "Внутренние Данные",
        borderColor: "border-brand-orange", textColor: "text-brand-orange",
        icon: LuActivity,
        pointsEn: ["How did it *feel*? Energized, anxious, bored?", "Did you enjoy the process? (Keep simple notes during PACT)."],
        pointsRu: ["Как это *ощущалось*? Энергия, тревога, скука?", "Понравился ли процесс? (Делайте простые заметки во время PACT)."],
      }
    ],
    outroEn: "Both are vital. External success isn't sustainable if the internal experience is negative. Enjoyment without viability may need adjustment.",
    outroRu: "Оба аспекта важны. Внешний успех не устойчив, если внутренний опыт негативен. Удовольствие без жизнеспособности может требовать корректировки.",
    exampleTitleEn: "Example (YouTube PACT):", exampleTitleRu: "Пример (PACT для YouTube):",
    examplePointsEn: [
        "<strong>External:</strong> <span class='text-green-400'>Positive</span> (subscribers, comments, offers).",
        "<strong>Internal:</strong> <span class='text-red-400'>Negative</span> (dreaded filming, anxious, procrastinated).",
        "<strong>Decision:</strong> Stop YouTube, focus on writing (better internal fit)."
    ],
    examplePointsRu: [
        "<strong>Внешние:</strong> <span class='text-green-400'>Позитивные</span> (подписчики, комментарии, предложения).",
        "<strong>Внутренние:</strong> <span class='text-red-400'>Негативные</span> (боязнь съемок, тревога, прокрастинация).",
        "<strong>Решение:</strong> Прекратить YouTube, сосредоточиться на письме (лучше внутренне подходит)."
    ],
    decisionTitleEn: "Based on analysis, decide:", decisionTitleRu: "На основе анализа, решите:",
    decisionPointsEn: [
        { icon: LuPlayCircle, color: "green", text: "<strong>Persist:</strong> Worked well internally & externally. Continue/make habit." },
        { icon: LuPauseCircle, color: "orange", text: "<strong>Pause:</strong> Not working now. Stop this experiment." },
        { icon: LuRotateCcw, color: "blue", text: "<strong>Pivot:</strong> Make a tweak based on data, run a new experiment." }
    ],
     decisionPointsRu: [
        { icon: LuPlayCircle, color: "green", text: "<strong>Продолжать:</strong> Сработало хорошо внутренне и внешне. Продолжить/сделать привычкой." },
        { icon: LuPauseCircle, color: "orange", text: "<strong>Пауза:</strong> Сейчас не работает. Остановить этот эксперимент." },
        { icon: LuRotateCcw, color: "blue", text: "<strong>Разворот:</strong> Внести небольшое изменение на основе данных, запустить новый эксперимент." }
    ],
    tooltipRu: "Анализ эксперимента: Учитывайте и внешние результаты (успех?), и внутренние ощущения (комфорт?). Решите: Продолжать, Пауза или Разворот.",
  },
  {
    id: "conclusion",
    icon: FaCheckDouble,
    titleEn: "Why Embrace the Experimental Mindset?",
    titleRu: "Зачем Принимать Экспериментальное Мышление?",
    pointsEn: [
      "Ensures you live an <strong class='font-semibold text-brand-purple'>intentional life</strong> – *your* life, not one dictated by others.",
      "Keeps you <strong class='font-semibold text-brand-purple'>adaptable and nimble</strong> in a changing world.",
      "Fosters <strong class='font-semibold text-brand-purple'>continuous learning</strong> and growth.",
      "Makes the journey genuinely more <strong class='font-semibold text-brand-purple'>engaging and fun</strong>.",
      "Neuroscience link: Our thirst for knowledge is real. Direct it consciously.",
    ],
    pointsRu: [
      "Обеспечивает <strong class='font-semibold text-brand-purple'>осознанную жизнь</strong> – *вашу* жизнь, а не продиктованную другими.",
      "Сохраняет вас <strong class='font-semibold text-brand-purple'>адаптивными и гибкими</strong> в меняющемся мире.",
      "Способствует <strong class='font-semibold text-brand-purple'>непрерывному обучению</strong> и росту.",
      "Делает путешествие по-настоящему более <strong class='font-semibold text-brand-purple'>увлекательным и веселым</strong>.",
      "Связь с нейронаукой: Наша жажда знаний реальна. Направляйте ее сознательно.",
    ],
    imageUrlEn: `${STORAGE_BASE_URL_EXP}/600x338/1a1a2e/9D00FF/png?text=Live+Intentionally`,
    imageUrlRu: `${STORAGE_BASE_URL_EXP}/600x338/1a1a2e/9D00FF/png?text=Живи+Осознанно`,
    imageAltEn: "Abstract image representing growth, adaptability, and intentional living",
    imageAltRu: "Абстрактное изображение, представляющее рост, адаптивность и осознанную жизнь",
    tooltipRu: "Экспериментальное мышление - ключ к осознанной, адаптивной и увлекательной жизни.",
  },
];


// --- Component ---
export default function ExperimentalMindsetPage() {
  const { user } = useAppContext();
  const [isMounted, setIsMounted] = useState(false);
  const [selectedLang, setSelectedLang] = useState<Language>('ru'); // Default to RU

  useEffect(() => {
    setIsMounted(true);
    // Basic language detection (can be refined)
    const browserLang = typeof navigator !== 'undefined' ? navigator.language.split('-')[0] : 'ru';
    const initialLang = browserLang === 'ru' ? 'ru' : 'en'; // Prioritize browser RU, default EN otherwise
    setSelectedLang(initialLang);
    debugLogger.log(`[ExpMindPage] Mounted. Browser lang: ${browserLang}, Initial selected: ${initialLang}`);
  }, []); // Run only once on mount

  if (!isMounted) {
    return (
      <div className="flex justify-center items-center min-h-screen pt-20 bg-gradient-to-br from-gray-900 via-black to-gray-800">
        <p className="text-brand-green animate-pulse text-xl font-mono">Загрузка мудрости Экспериментального Мышления...</p>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen overflow-hidden pt-20 pb-10 bg-gradient-to-br from-gray-900 via-black to-gray-800 text-gray-200">
      {/* Subtle Background Grid */}
      <div
        className="absolute inset-0 bg-repeat opacity-[0.03] z-0" // Reduced opacity further
        style={{
          backgroundImage: `linear-gradient(to right, rgba(0, 255, 157, 0.4) 1px, transparent 1px),
                            linear-gradient(to bottom, rgba(0, 255, 157, 0.4) 1px, transparent 1px)`,
          backgroundSize: '60px 60px', // Slightly larger grid
        }}
      ></div>

      <TooltipProvider delayDuration={200}>
        <div className="relative z-10 container mx-auto px-4">
          <Card className="max-w-4xl mx-auto bg-black/85 backdrop-blur-lg text-white rounded-2xl border border-brand-green/30 shadow-[0_0_30px_rgba(0,255,157,0.3)]">
            <CardHeader className="text-center border-b border-brand-green/20 pb-4">
              <CardTitle className="text-3xl md:text-5xl font-bold text-brand-green cyber-text glitch" data-text="The Experimental Mindset">
                The Experimental Mindset
              </CardTitle>
              <p className="text-md md:text-lg text-gray-300 mt-3 font-mono">
                 {selectedLang === 'ru'
                    ? "Жить осознанно через любопытство и эксперименты."
                    : "Living Consciously Through Curiosity & Experimentation."}
              </p>
               <p className="text-sm text-gray-400 mt-1">
                 {selectedLang === 'ru' ? "По мотивам видео с Anne-Laure Le Cunff" : "Based on insights from Anne-Laure Le Cunff"}
               </p>
            </CardHeader>

            <CardContent className="space-y-12 p-4 md:p-8">
              {/* Language Toggle */}
              <div className="flex justify-center space-x-2 mb-8">
                 <Button
                   variant={selectedLang === 'ru' ? 'secondary' : 'outline'}
                   size="sm"
                   onClick={() => setSelectedLang('ru')}
                   className={cn(
                       "border-brand-green/50", // Use main theme color
                       selectedLang === 'ru' ? 'bg-brand-green/20 text-brand-green hover:bg-brand-green/30' : 'text-gray-400 hover:bg-gray-800 hover:text-gray-200'
                   )}
                 >
                   🇷🇺 Русский
                 </Button>
                 <Button
                    variant={selectedLang === 'en' ? 'secondary' : 'outline'}
                    size="sm"
                    onClick={() => setSelectedLang('en')}
                    className={cn(
                       "border-brand-blue/50", // Keep contrast for EN
                       selectedLang === 'en' ? 'bg-brand-blue/20 text-brand-blue hover:bg-brand-blue/30' : 'text-gray-400 hover:bg-gray-800 hover:text-gray-200'
                    )}
                 >
                   🇬🇧 English
                 </Button>
              </div>

              {/* Sections */}
              {sections.map((section, index) => {
                const IconComponent = section.icon;
                // Simple color rotation or assign based on index/theme
                const themeColor = ["text-brand-green", "text-brand-pink", "text-brand-yellow", "text-neon-lime", "text-brand-blue", "text-brand-orange", "text-brand-purple"][index % 7];
                const borderColor = themeColor.replace("text-", "border-");
                const currentTitle = selectedLang === 'en' ? section.titleEn : section.titleRu;
                const currentPoints = section.pointsEn && section.pointsRu ? (selectedLang === 'en' ? section.pointsEn : section.pointsRu) : [];
                const currentImageAlt = section.imageAltEn && section.imageAltRu ? (selectedLang === 'en' ? section.imageAltEn : section.imageAltRu) : "";
                const currentImageUrl = section.imageUrlEn && section.imageUrlRu ? (selectedLang === 'en' ? section.imageUrlEn : section.imageUrlRu) : null;
                const currentIntro = section.introEn && section.introRu ? (selectedLang === 'en' ? section.introEn : section.introRu) : null;
                const currentOutro = section.outroEn && section.outroRu ? (selectedLang === 'en' ? section.outroEn : section.outroRu) : null;

                return (
                  <section key={section.id} className={`space-y-4 border-l-4 pl-4 md:pl-6 ${borderColor}`}>
                    {/* Title */}
                    <h2 className={`flex items-center text-2xl md:text-3xl font-semibold ${themeColor} mb-4 font-orbitron`}>
                      <IconComponent className={`mr-3 ${themeColor}/80`} /> {currentTitle}
                    </h2>

                    {/* Intro Paragraph */}
                    {currentIntro && <p className="text-gray-300 leading-relaxed mb-4">{currentIntro}</p>}

                     {/* SubSections (e.g., Speaker's Journey) */}
                     {section.subSections && section.subSections.map((sub, subIndex) => {
                       const SubIcon = sub.icon;
                       const subTitle = selectedLang === 'en' ? sub.titleEn : sub.titleRu;
                       const subPoints = selectedLang === 'en' ? sub.pointsEn : sub.pointsRu;
                       const subImgUrl = selectedLang === 'en' ? sub.imageUrlEn : sub.imageUrlRu;
                       const subImgAlt = selectedLang === 'en' ? sub.imageAltEn : sub.imageAltRu;

                       return (
                         <div key={`${section.id}-sub-${subIndex}`} className={`ml-4 pl-4 border-l-2 ${sub.borderColor} space-y-3 mb-6`}>
                           <h3 className={`flex items-center text-xl font-semibold ${sub.textColor}`}>
                             <SubIcon className="mr-2" /> {subTitle}
                           </h3>
                           <ul className="list-disc list-outside space-y-2 text-gray-300 pl-5 text-base md:text-lg leading-relaxed">
                             {subPoints.map((point, i) => (
                               <li key={`${selectedLang}-${section.id}-sub-${subIndex}-${i}`} dangerouslySetInnerHTML={{ __html: point }}></li>
                             ))}
                           </ul>
                           {subImgUrl && (
                             <div className={`my-4 p-1 border ${sub.borderColor}/30 rounded-md bg-black/20 max-w-sm mx-auto`}>
                               <Image
                                 src={subImgUrl} alt={subImgAlt} width={600} height={338}
                                 className="w-full h-auto object-cover rounded opacity-80" loading="lazy" placeholder="blur" blurDataURL={PLACEHOLDER_BLUR_URL}
                               />
                               <p className="text-xs text-center text-gray-400 mt-1 italic">{subImgAlt}</p>
                             </div>
                           )}
                         </div>
                       );
                     })}

                     {/* Grid Items (e.g., Blocking Mindsets) */}
                     {section.gridItems && (
                       <div className="grid md:grid-cols-3 gap-4 my-4">
                         {section.gridItems.map((item, itemIndex) => {
                           const ItemIcon = item.icon;
                           const itemTitle = selectedLang === 'en' ? item.titleEn : item.titleRu;
                           const itemPoints = selectedLang === 'en' ? item.pointsEn : item.pointsRu;
                           const itemLeadsTo = selectedLang === 'en' ? item.leadsToEn : item.leadsToRu;
                           const itemColorClass = `text-brand-${item.color}` // Assuming brand colors like brand-gray, brand-blue, brand-red exist
                           const itemBorderColorClass = `border-brand-${item.color}/40`

                           return (
                             <div key={`${section.id}-grid-${itemIndex}`} className={`bg-gray-950/50 p-4 rounded-lg border ${itemBorderColorClass}`}>
                               <h4 className={`flex items-center font-bold ${itemColorClass} mb-2 text-lg`}>
                                 <ItemIcon className="mr-2" /> {itemTitle}
                               </h4>
                               <ul className="list-disc list-inside space-y-1 text-sm text-gray-300 mb-2 pl-1">
                                {itemPoints.map((point, i) => <li key={`${selectedLang}-${section.id}-grid-${itemIndex}-p-${i}`}>{point}</li>)}
                               </ul>
                               <p className="text-xs italic text-gray-400">
                                {selectedLang === 'en' ? 'Leads to: ' : 'Ведет к: '} {itemLeadsTo}
                               </p>
                             </div>
                           );
                         })}
                       </div>
                     )}

                     {/* PACT Items */}
                     {section.pactItems && (
                        <div className="space-y-5 my-4">
                          {section.pactItems.map((item, itemIndex) => {
                             const itemColorClass = `text-brand-${item.color}`; // e.g., text-brand-pink
                             const itemBorderColorClass = `border-brand-${item.color}/50`;
                             const itemBgColorClass = `bg-brand-${item.color}/10`;
                             const itemTitle = selectedLang === 'en' ? item.titleEn : item.titleRu;
                             const itemDesc = selectedLang === 'en' ? item.descEn : item.descRu;

                             return (
                                <div key={`${section.id}-pact-${itemIndex}`} className={`flex items-start space-x-3 p-3 rounded-md ${itemBgColorClass} border-l-4 ${itemBorderColorClass}`}>
                                    <div className={`flex-shrink-0 font-bold text-2xl ${itemColorClass}`}>
                                        {item.letter}
                                    </div>
                                    <div>
                                        <h4 className={`font-semibold ${itemColorClass}`}>{itemTitle}</h4>
                                        <p className="text-sm text-gray-300">{itemDesc}</p>
                                    </div>
                                </div>
                             );
                          })}
                        </div>
                     )}

                    {/* Standard Points (only if no subSections or gridItems) */}
                    {!section.subSections && !section.gridItems && !section.pactItems && currentPoints.length > 0 && (
                      <ul className="list-disc list-outside space-y-2 text-gray-300 pl-5 text-base md:text-lg leading-relaxed">
                        {currentPoints.map((point, i) => (
                          <li key={`${selectedLang}-${section.id}-${i}`} dangerouslySetInnerHTML={{ __html: point }}></li>
                        ))}
                      </ul>
                    )}

                    {/* Example Block (for Analysis section) */}
                    {section.exampleTitleEn && (
                       <div className="mt-4 p-3 border border-gray-600/50 rounded-md bg-black/20">
                           <h4 className="font-semibold text-brand-yellow mb-2">{selectedLang === 'en' ? section.exampleTitleEn : section.exampleTitleRu}</h4>
                            <ul className="list-disc list-inside space-y-1 text-sm text-gray-300 pl-2">
                              {(selectedLang === 'en' ? section.examplePointsEn : section.examplePointsRu).map((point, i) => (
                                  <li key={`${selectedLang}-${section.id}-ex-${i}`} dangerouslySetInnerHTML={{ __html: point }}></li>
                              ))}
                            </ul>
                       </div>
                    )}

                    {/* Decision Block (for Analysis section) */}
                    {section.decisionTitleEn && (
                       <div className="mt-4">
                           <h4 className="font-semibold text-gray-300 mb-3">{selectedLang === 'en' ? section.decisionTitleEn : section.decisionTitleRu}</h4>
                            <div className="grid md:grid-cols-3 gap-3">
                                {(selectedLang === 'en' ? section.decisionPointsEn : section.decisionPointsRu).map((item, i) => {
                                    const DecisionIcon = item.icon;
                                    const decisionColorClass = `text-brand-${item.color}`; // Assuming brand colors map
                                    const decisionBorderColorClass = `border-brand-${item.color}/40`;
                                    return (
                                        <div key={`${selectedLang}-${section.id}-dec-${i}`} className={`flex items-center space-x-2 p-2 rounded border ${decisionBorderColorClass} bg-gray-950/60`}>
                                            <DecisionIcon className={`flex-shrink-0 h-5 w-5 ${decisionColorClass}`} />
                                            <p className="text-sm text-gray-300" dangerouslySetInnerHTML={{ __html: item.text }}></p>
                                        </div>
                                    );
                                })}
                            </div>
                       </div>
                    )}


                    {/* Image (if exists and no subsections/grid) */}
                    {currentImageUrl && !section.subSections && !section.gridItems && (
                      <div className={`my-6 p-2 border ${borderColor}/30 rounded-lg bg-black/30 max-w-md mx-auto`}>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <div className="aspect-video w-full h-auto overflow-hidden rounded-md bg-gray-800/50 cursor-help relative">
                              <Image
                                src={currentImageUrl} alt={currentImageAlt} width={600} height={338}
                                className="w-full h-full object-cover opacity-90 hover:opacity-100 transition-opacity duration-300"
                                loading="lazy" placeholder="blur" blurDataURL={PLACEHOLDER_BLUR_URL}
                                onError={(e) => { e.currentTarget.style.display = 'none'; }}
                              />
                            </div>
                          </TooltipTrigger>
                          {selectedLang === 'ru' && section.tooltipRu && (
                            <TooltipContent side="bottom" className={`max-w-[300px] text-center bg-gray-950 ${borderColor}/60 text-white p-3 shadow-lg border`}>
                              <p className="text-sm whitespace-pre-wrap">{section.tooltipRu}</p>
                            </TooltipContent>
                          )}
                        </Tooltip>
                        <p className="text-xs text-center text-gray-400 mt-1 italic">{currentImageAlt}</p>
                      </div>
                    )}

                     {/* Outro Paragraph */}
                    {currentOutro && <p className="text-gray-300 leading-relaxed mt-4 italic" dangerouslySetInnerHTML={{ __html: currentOutro }}></p>}

                  </section>
                );
              })}

              {/* Concluding section */}
              <section className="text-center pt-8 border-t border-brand-green/20 mt-10">
                 <p className="text-gray-400 italic">
                   {selectedLang === 'ru' ? "Резюме основано на видео. Применение требует практики и саморефлексии." : "Summary based on video insights. Application requires practice and self-reflection."}
                 </p>
                 {/* Optional link back to related concepts */}
                 {/* <p className="mt-4 text-gray-300">
                   Explore related concepts in <Link href="/purpose-profit" className="text-brand-purple hover:underline font-semibold">Purpose & Profit</Link>.
                 </p> */}
              </section>

            </CardContent>
          </Card>
        </div>
      </TooltipProvider>
    </div>
  );
}
"use client";

import React, { useState, useEffect, useId, useCallback, useRef } from "react";
import { motion, AnimatePresence, useScroll, useTransform, useSpring } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useAppContext } from "@/contexts/AppContext";
import { debugLogger as logger } from "@/lib/debugLogger";
import { VibeContentRenderer } from "@/components/VibeContentRenderer";
import { cn } from "@/lib/utils";
import { 
  Brain, 
  Route, 
  Lock, 
  FlaskConical, 
  ClipboardList, 
  TrendingUp, 
  CheckCircle2,
  ChevronRight,
  ChevronLeft,
  Languages,
  Sparkles,
  XCircle,
  HelpCircle,
  ArrowRight
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";

type Language = 'en' | 'ru';

const STORAGE_BASE_URL_EXP = "https://placehold.co"; 
const PLACEHOLDER_BLUR_URL = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";

const sections = [
  {
    id: "intro-mindset",
    icon: Brain,
    titleEn: "Understanding Mindsets",
    titleRu: "Понимание Мышления",
    pointsEn: [
      "A mindset is your <span class='text-cyan-400 font-medium'>default way of seeing the world</span>.",
      "It influences decisions, relationships, thoughts, and feelings.",
      "Unconscious mindsets act like <span class='text-cyan-400 font-medium'>autopilot</span>, driving life direction.",
      "Awareness allows for conscious choices aligned with desires.",
      "Mindsets <span class='text-cyan-400 font-medium'>can change</span>; the first step is making them conscious.",
    ],
    pointsRu: [
      "Мышление – это ваш <span class='text-cyan-400 font-medium'>стандартный способ видения мира</span>.",
      "Оно влияет на решения, отношения, мысли и чувства.",
      "Неосознанные установки действуют как <span class='text-cyan-400 font-medium'>автопилот</span>, управляя направлением жизни.",
      "Осознанность позволяет делать сознательный выбор в соответствии с желаниями.",
      "Мышление <span class='text-cyan-400 font-medium'>можно изменить</span>; первый шаг – сделать неосознанное сознательным.",
    ],
    imageUrlEn: `${STORAGE_BASE_URL_EXP}/800x450/0f172a/22d3ee/png?text=Mindset+Lens`,
    imageUrlRu: `${STORAGE_BASE_URL_EXP}/800x450/0f172a/22d3ee/png?text=Линза+Мышления`,
    imageAltEn: "Conceptual image: A lens representing a mindset shaping perception",
    imageAltRu: "Концептуальное изображение: Линза, представляющая мышление, формирующее восприятие",
    question: {
      textRu: "Мышление – это фиксированный набор убеждений, который нельзя изменить.",
      textEn: "A mindset is a fixed set of beliefs that cannot be changed.",
      correctAnswer: 'no',
      tipRu: "Мышление можно изменить! Первый шаг – сделать его осознанным.",
      tipEn: "Mindsets can be changed! The first step is to make them conscious.",
    },
  },
  {
    id: "speaker-journey",
    icon: Route,
    titleEn: "Speaker's Journey: Linear vs. Experimental",
    titleRu: "Путь Спикера: Линейный против Экспериментального",
    subSections: [
        {
            titleEn: "Chapter 1: The Linear Path (Autopilot)",
            titleRu: "Глава 1: Линейный Путь (Автопилот)",
            gradient: "from-rose-500/20 to-orange-500/20",
            borderColor: "border-rose-500/50",
            textColor: "text-rose-400",
            icon: "⚠️",
            pointsEn: [
                "Followed <span class='text-rose-400 font-medium'>traditional scripts</span>: good grades → Google → corporate ladder.",
                "External success masked internal <span class='text-rose-400 font-medium'>emptiness, boredom, and burnout</span>.",
                "Starting a startup was another script, still unfulfilling.",
                "Failure forced the question: \"What do *I* actually want?\""
            ],
            pointsRu: [
                "Следование <span class='text-rose-400 font-medium'>традиционным сценариям</span>: хорошие оценки → Google → карьерная лестница.",
                "Внешний успех маскировал внутреннюю <span class='text-rose-400 font-medium'>пустоту, скуку и выгорание</span>.",
                "Запуск стартапа был очередным сценарием, все еще не приносящим удовлетворения.",
                "Неудача заставила задать вопрос: \"Чего *я* на самом деле хочу?\""
            ],
             imageUrlEn: `${STORAGE_BASE_URL_EXP}/600x338/0f172a/f43f5e/png?text=Linear+Path+Trap`,
             imageUrlRu: `${STORAGE_BASE_URL_EXP}/600x338/0f172a/f43f5e/png?text=Ловушка+Линейности`,
             imageAltEn: "Illustration of a straight, rigid path leading to a dead end",
             imageAltRu: "Иллюстрация прямого, жесткого пути, ведущего в тупик",
        },
        {
            titleEn: "Chapter 2: The Experimental Path",
            titleRu: "Глава 2: Экспериментальный Путь",
            gradient: "from-emerald-500/20 to-cyan-500/20",
            borderColor: "border-emerald-500/50",
            textColor: "text-emerald-400",
            icon: "⚡",
            pointsEn: [
                "Shifted focus to <span class='text-emerald-400 font-medium'>genuine curiosity</span>, independent of validation.",
                "Studied neuroscience (PhD) based on fascination with the brain.",
                "Embraced <span class='text-emerald-400 font-medium'>\"learning in public\"</span> via a newsletter.",
                "This \"tiny experiment\" sparked the exploration of the experimental mindset."
            ],
            pointsRu: [
                "Смещение фокуса на <span class='text-emerald-400 font-medium'>подлинное любопытство</span>, независимое от валидации.",
                "Изучение нейронаук (PhD) из-за увлечения мозгом.",
                "Принятие <span class='text-emerald-400 font-medium'>\"обучения на публике\"</span> через новостную рассылку.",
                "Этот \"крошечный эксперимент\" положил начало исследованию экспериментального мышления."
            ],
            imageUrlEn: `${STORAGE_BASE_URL_EXP}/600x338/0f172a/34d399/png?text=Experimental+Path`,
            imageUrlRu: `${STORAGE_BASE_URL_EXP}/600x338/0f172a/34d399/png?text=Путь+Эксперимента`,
            imageAltEn: "Illustration of a winding, adaptive path leading upwards",
            imageAltRu: "Иллюстрация извилистого пути, ведущего вверх с точками открытий",
        }
    ],
    question: {
      textRu: "Линейный путь всегда ведет к успеху и удовлетворению, если следовать традиционным сценариям.",
      textEn: "The linear path always leads to success and satisfaction if traditional scripts are followed.",
      correctAnswer: 'no',
      tipRu: "Наоборот, линейный путь часто ведет к пустоте и выгоранию. Экспериментальный путь основан на любопытстве и сознательном выборе.",
      tipEn: "On the contrary, the linear path often leads to emptiness and burnout. The experimental path is based on curiosity and conscious choice.",
    },
  },
  {
    id: "blocking-mindsets",
    icon: Lock,
    titleEn: "Three Subconscious Traps",
    titleRu: "Три Подсознательные Ловушки",
    introEn: "These mindsets often operate unconsciously, preventing us from living fulfilling, conscious lives. They exist on a spectrum of Curiosity and Ambition:",
    introRu: "Эти установки часто действуют неосознанно, мешая нам жить полноценной, сознательной жизнью. Они существуют на спектре Любопытства и Амбиций:",
    gridItems: [
        {
            titleEn: "Cynical", titleRu: "Циничное",
            icon: "😔", color: "slate", gradient: "from-slate-500/20 to-gray-500/20",
            pointsEn: ["Low Curiosity, Low Ambition.", "Lost drive, mocks earnestness.", "Stuck in survival mode."],
            pointsRu: ["Низкое Любопытство, Низкие Амбиции.", "Потерял(а) драйв, высмеивает искренность.", "Застрял(а) в режиме выживания."],
            leadsToEn: "Doomscrolling, negativity", leadsToRu: "Думскроллинг, негатив"
        },
        {
            titleEn: "Escapist", titleRu: "Эскапистское",
            icon: "🏃", color: "blue", gradient: "from-blue-500/20 to-indigo-500/20",
            pointsEn: ["High Curiosity, Low Ambition.", "Curious but avoids responsibility.", "Seeks escape."],
            pointsRu: ["Высокое Любопытство, Низкие Амбиции.", "Любопытен(на), но избегает ответственности.", "Ищет побега."],
            leadsToEn: "Binge-watching, retail therapy", leadsToRu: "Запойный просмотр, шопинг-терапия"
        },
        {
            titleEn: "Perfectionist", titleRu: "Перфекционистское",
            icon: "🔍", color: "rose", gradient: "from-rose-500/20 to-pink-500/20",
            pointsEn: ["Low Curiosity, High Ambition.", "Escapes uncertainty via work.", "Defers happiness for external goals."],
            pointsRu: ["Низкое Любопытство, Высокие Амбиции.", "Избегает неопределенности через работу.", "Откладывает счастье ради внешних целей."],
            leadsToEn: "Overworking, burnout", leadsToRu: "Переработки, выгорание"
        }
    ],
    outroEn: "Crucially, these mindsets are <span class='text-amber-400 font-medium'>fluid</span> and not fixed. Awareness is the first step to change.",
    outroRu: "Важно: эти установки <span class='text-amber-400 font-medium'>гибки</span> и не являются неизменными. Осознанность – первый шаг к изменению.",
    question: {
      textRu: "Циничное мышление характеризуется высоким любопытством и низкими амбициями.",
      textEn: "A cynical mindset is characterized by high curiosity and low ambition.",
      correctAnswer: 'no',
      tipRu: "Циничное мышление – это низкое любопытство и низкие амбиции. Это 'что толку?'",
      tipEn: "Cynical mindset means low curiosity and low ambition. It's the 'what's the point?' mentality.",
    },
  },
  {
    id: "experimental-mindset",
    icon: FlaskConical,
    titleEn: "The Alternative: Experimental Mindset",
    titleRu: "Альтернатива: Экспериментальное Мышление",
    pointsEn: [
      "<span class='text-emerald-400 font-medium'>High Curiosity, High Ambition</span>.",
      "Embraces drive AND openness to learn.",
      "Sees uncertainty as an <span class='text-emerald-400 font-medium'>opportunity</span> to explore, grow, learn.",
      "Focuses on the <span class='text-emerald-400 font-medium'>process of discovery</span>, not just outcomes.",
      "Treats failures/mistakes as valuable <span class='text-emerald-400 font-medium'>data points</span>.",
      "Moves from rigid plans to iterative <span class='text-emerald-400 font-medium'>experimentation</span>.",
    ],
    pointsRu: [
      "<span class='text-emerald-400 font-medium'>Высокое Любопытство, Высокие Амбиции</span>.",
      "Сочетает стремление к цели И открытость обучению.",
      "Рассматривает неопределенность как <span class='text-emerald-400 font-medium'>возможность</span> исследовать, расти, учиться.",
      "Фокусируется на <span class='text-emerald-400 font-medium'>процессе открытия</span>, а не только на результатах.",
      "Воспринимает неудачи/ошибки как ценные <span class='text-emerald-400 font-medium'>точки данных</span>.",
      "Переходит от жестких планов к итеративным <span class='text-emerald-400 font-medium'>экспериментам</span>.",
    ],
    imageUrlEn: `${STORAGE_BASE_URL_EXP}/800x450/0f172a/34d399/png?text=Experimental+Cycle`,
    imageUrlRu: `${STORAGE_BASE_URL_EXP}/800x450/0f172a/34d399/png?text=Цикл+Эксперимента`,
    imageAltEn: "Diagram: Curiosity → Experiment → Data → Adapt → Repeat",
    imageAltRu: "Диаграмма: Любопытство → Эксперимент → Данные → Адаптация → Повтор",
    question: {
      textRu: "Экспериментальное мышление означает избегание неопределенности и фокусировку только на конечных результатах.",
      textEn: "An experimental mindset means avoiding uncertainty and focusing only on final outcomes.",
      correctAnswer: 'no',
      tipRu: "Экспериментальное мышление видит в неопределенности возможность и фокусируется на процессе открытия.",
      tipEn: "An experimental mindset sees uncertainty as an opportunity and focuses on the process of discovery.",
    },
  },
  {
    id: "pact-framework",
    icon: ClipboardList,
    titleEn: "Designing Tiny Experiments: The PACT Framework",
    titleRu: "Дизайн Крошечных Экспериментов: Фреймворк PACT",
    introEn: "Based on the scientific method, use PACT to design your experiments:",
    introRu: "На основе научного метода, используйте PACT для дизайна экспериментов:",
    pactItems: [
        { letter: "P", titleEn: "Purposeful", titleRu: "Целенаправленный", descEn: "Driven by genuine curiosity; something you care about exploring.", descRu: "Движимый подлинным любопытством; то, что вам интересно исследовать.", color: "pink", icon: "🎯" },
        { letter: "A", titleEn: "Actionable", titleRu: "Действенный", descEn: "Start *now* with current resources; no complex prerequisites.", descRu: "Начать *сейчас* с текущими ресурсами; без сложных предварительных условий.", color: "blue", icon: "⚡" },
        { letter: "C", titleEn: "Continuous", titleRu: "Непрерывный", descEn: "Commit to a specific, reasonable duration upfront (e.g., 'for 3 weeks').", descRu: "Обязательство на конкретный, разумный срок (напр., 'на 3 недели').", color: "amber", icon: "⏱️" },
        { letter: "T", titleEn: "Trackable", titleRu: "Отслеживаемый", descEn: "Simple tracking: Did you do it? Yes/No. Focus on completion & observation.", descRu: "Простое отслеживание: Сделал(а)? Да/Нет. Фокус на завершении и наблюдении.", color: "emerald", icon: "📊" }
    ],
    outroEn: "Different from habits & KPIs. PACTs prioritize <span class='text-amber-400 font-medium'>learning and exploration</span> within a defined scope.",
    outroRu: "Отличается от привычек и KPI. PACTы ставят в приоритет <span class='text-amber-400 font-medium'>обучение и исследование</span> в заданных рамках.",
    question: {
      textRu: "Эксперименты PACT не требуют конкретных сроков или отслеживания, главное – начать.",
      textEn: "PACT experiments do not require specific deadlines or tracking; the main thing is to just start.",
      correctAnswer: 'no',
      tipRu: "PACT – это Целенаправленный, Действенный, Непрерывный (ограниченный по времени) и Отслеживаемый эксперимент.",
      tipEn: "PACT stands for Purposeful, Actionable, Continuous (Time-Bound), and Trackable. All aspects are important.",
    },
  },
  {
    id: "analyzing-data",
    icon: TrendingUp,
    titleEn: "Learning from Experiments",
    titleRu: "Обучение на Экспериментах",
    introEn: "After your PACT period, analyze both external and internal data:",
    introRu: "После завершения периода PACT, проанализируйте внешние и внутренние данные:",
    subSections: [ 
      {
        titleEn: "External Data", titleRu: "Внешние Данные",
        gradient: "from-cyan-500/20 to-blue-500/20",
        borderColor: "border-cyan-500/50",
        textColor: "text-cyan-400",
        icon: "👁️",
        pointsEn: ["Observable results: metrics, feedback, tangible outcomes.", "Did it achieve conventional success?"],
        pointsRu: ["Наблюдаемые результаты: метрики, обратная связь.", "Достигнут ли конвенциональный успех?"],
      },
      {
        titleEn: "Internal Data", titleRu: "Внутренние Данные",
        gradient: "from-orange-500/20 to-amber-500/20",
        borderColor: "border-orange-500/50",
        textColor: "text-orange-400",
        icon: "❤️",
        pointsEn: ["How did it *feel*? Energized, anxious, bored?", "Did you enjoy the process?"],
        pointsRu: ["Как это *ощущалось*? Энергия, тревога, скука?", "Понравился ли процесс?"],
      }
    ],
    outroEn: "Both are vital. External success isn't sustainable if the internal experience is negative.",
    outroRu: "Оба аспекта важны. Внешний успех не устойчив, если внутренний опыт негативен.",
    exampleTitleEn: "Example (YouTube PACT):", exampleTitleRu: "Пример (PACT для YouTube):",
    examplePointsEn: [
        "<span class='text-cyan-400'>External:</span> Positive (subscribers, comments).",
        "<span class='text-orange-400'>Internal:</span> Negative (dreaded filming, anxious).",
        "<span class='text-emerald-400'>Decision:</span> Stop YouTube, focus on writing."
    ],
    examplePointsRu: [
        "<span class='text-cyan-400'>Внешние:</span> Позитивные (подписчики, комментарии).",
        "<span class='text-orange-400'>Внутренние:</span> Негативные (боязнь съемок, тревога).",
        "<span class='text-emerald-400'>Решение:</span> Прекратить YouTube, сосредоточиться на письме."
    ],
    decisionTitleEn: "Based on analysis, decide:", decisionTitleRu: "На основе анализа, решите:",
    decisionPointsEn: [
        { color: "emerald", text: "<strong>Persist:</strong> Worked well. Continue/make habit." },
        { color: "amber", text: "<strong>Pause:</strong> Not working now. Stop this experiment." },
        { color: "blue", text: "<strong>Pivot:</strong> Make a tweak, run a new experiment." }
    ],
     decisionPointsRu: [
        { color: "emerald", text: "<strong>Продолжать:</strong> Сработало хорошо. Продолжить/сделать привычкой." },
        { color: "amber", text: "<strong>Пауза:</strong> Сейчас не работает. Остановить эксперимент." },
        { color: "blue", text: "<strong>Разворот:</strong> Внести изменение, запустить новый эксперимент." }
    ],
    question: {
      textRu: "Для оценки успеха эксперимента достаточно анализировать только внешние результаты (метрики).",
      textEn: "To evaluate success, it's enough to analyze only external results (metrics).",
      correctAnswer: 'no',
      tipRu: "Оба типа данных – внешние и внутренние (ваши ощущения) – жизненно важны.",
      tipEn: "Both types of data – external and internal (your feelings) – are vital.",
    },
  },
  {
    id: "conclusion",
    icon: CheckCircle2,
    titleEn: "Why Embrace the Experimental Mindset?",
    titleRu: "Зачем Принимать Экспериментальное Мышление?",
    pointsEn: [
      "Ensures you live an <span class='text-violet-400 font-medium'>intentional life</span> – *your* life, not dictated by others.",
      "Keeps you <span class='text-violet-400 font-medium'>adaptable and nimble</span> in a changing world.",
      "Fosters <span class='text-violet-400 font-medium'>continuous learning</span> and growth.",
      "Makes the journey genuinely more <span class='text-violet-400 font-medium'>engaging and fun</span>.",
    ],
    pointsRu: [
      "Обеспечивает <span class='text-violet-400 font-medium'>осознанную жизнь</span> – *вашу* жизнь, а не продиктованную другими.",
      "Сохраняет вас <span class='text-violet-400 font-medium'>адаптивными и гибкими</span> в меняющемся мире.",
      "Способствует <span class='text-violet-400 font-medium'>непрерывному обучению</span> и росту.",
      "Делает путешествие по-настоящему более <span class='text-violet-400 font-medium'>увлекательным и веселым</span>.",
    ],
    imageUrlEn: `${STORAGE_BASE_URL_EXP}/800x450/0f172a/a78bfa/png?text=Live+Intentionally`,
    imageUrlRu: `${STORAGE_BASE_URL_EXP}/800x450/0f172a/a78bfa/png?text=Живи+Осознанно`,
    imageAltEn: "Abstract image representing growth and intentional living",
    imageAltRu: "Абстрактное изображение, представляющее рост и осознанную жизнь",
    question: {
      textRu: "Экспериментальное мышление помогает жить более осознанной жизнью и адаптироваться к изменениям.",
      textEn: "An experimental mindset helps live a more intentional life and adapt to changes.",
      correctAnswer: 'yes',
      tipRu: "Именно так! Это мышление развивает любопытство, гибкость и способствует постоянному росту.",
      tipEn: "Exactly! This mindset fosters curiosity, adaptability, and continuous growth.",
    },
  },
];

export default function ExperimentalMindsetPage() {
  const { user } = useAppContext();
  const [isMounted, setIsMounted] = useState(false);
  const [selectedLang, setSelectedLang] = useState<Language>('ru');
  const [activeSection, setActiveSection] = useState(0);
  const [completedSections, setCompletedSections] = useState<Set<number>>(new Set());
  const [answers, setAnswers] = useState<Record<number, { answer: 'yes' | 'no'; correct: boolean }>>({});
  const [showTip, setShowTip] = useState<number | null>(null);
  
  const containerRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll();
  const scaleX = useSpring(scrollYProgress, {
    stiffness: 100,
    damping: 30,
    restDelta: 0.001
  });

  useEffect(() => {
    setIsMounted(true);
    const browserLang = typeof navigator !== 'undefined' ? navigator.language.split('-')[0] : 'ru';
    const initialLang = user?.language_code === 'ru' || (!user?.language_code && browserLang === 'ru') ? 'ru' : 'en';
    setSelectedLang(initialLang);
  }, [user?.language_code]);

  const t = {
    sections: sections.map(section => ({
      ...section,
      title: selectedLang === 'en' ? section.titleEn : section.titleRu,
      points: section.pointsEn && section.pointsRu ? (selectedLang === 'en' ? section.pointsEn : section.pointsRu) : [],
      imageUrl: section.imageUrlEn && section.imageUrlRu ? (selectedLang === 'en' ? section.imageUrlEn : section.imageUrlRu) : null,
      imageAlt: section.imageAltEn && section.imageAltRu ? (selectedLang === 'en' ? section.imageAltEn : section.imageAltRu) : "",
      intro: section.introEn && section.introRu ? (selectedLang === 'en' ? section.introEn : section.introRu) : null,
      outro: section.outroEn && section.outroRu ? (selectedLang === 'en' ? section.outroEn : section.outroRu) : null,
      subSections: section.subSections ? section.subSections.map(sub => ({
        ...sub,
        title: selectedLang === 'en' ? sub.titleEn : sub.titleRu,
        points: selectedLang === 'en' ? sub.pointsEn : sub.pointsRu,
        imageUrl: selectedLang === 'en' ? sub.imageUrlEn : sub.imageUrlRu,
        imageAlt: selectedLang === 'en' ? sub.imageAltEn : sub.imageAltRu,
      })) : undefined,
      gridItems: section.gridItems ? section.gridItems.map(item => ({
        ...item,
        title: selectedLang === 'en' ? item.titleEn : item.titleRu,
        points: selectedLang === 'en' ? item.pointsEn : item.pointsRu,
        leadsTo: selectedLang === 'en' ? item.leadsToEn : item.leadsToRu,
      })) : undefined,
      pactItems: section.pactItems ? section.pactItems.map(item => ({
        ...item,
        title: selectedLang === 'en' ? item.titleEn : item.titleRu,
        desc: selectedLang === 'en' ? item.descEn : item.descRu,
      })) : undefined,
      exampleTitle: section.exampleTitleEn && section.exampleTitleRu ? (selectedLang === 'en' ? section.exampleTitleEn : section.exampleTitleRu) : null,
      examplePoints: section.examplePointsEn && section.examplePointsRu ? (selectedLang === 'en' ? section.examplePointsEn : section.examplePointsRu) : undefined,
      decisionTitle: section.decisionTitleEn && section.decisionTitleRu ? (selectedLang === 'en' ? section.decisionTitleEn : section.decisionTitleRu) : null,
      decisionPoints: section.decisionPointsEn && section.decisionPointsRu ? (selectedLang === 'en' ? section.decisionPointsEn : section.decisionPointsRu) : undefined,
    }))
  };

  const handleAnswer = (sectionIndex: number, answer: 'yes' | 'no') => {
    const section = sections[sectionIndex];
    const isCorrect = answer === section.question.correctAnswer;
    
    setAnswers(prev => ({ ...prev, [sectionIndex]: { answer, correct: isCorrect } }));
    
    if (!isCorrect) {
      setShowTip(sectionIndex);
    } else {
      setShowTip(null);
      setCompletedSections(prev => new Set(prev).add(sectionIndex));
      if (sectionIndex < sections.length - 1) {
        setTimeout(() => setActiveSection(sectionIndex + 1), 800);
      }
    }
  };

  const handleContinue = () => {
    setShowTip(null);
    setCompletedSections(prev => new Set(prev).add(activeSection));
    if (activeSection < sections.length - 1) {
      setActiveSection(prev => prev + 1);
    }
  };

  const progress = ((completedSections.size) / sections.length) * 100;

  if (!isMounted) return null;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 selection:bg-cyan-500/30 selection:text-cyan-200">
      {/* Progress Bar */}
      <motion.div
        className="fixed top-0 left-0 right-0 h-1 bg-gradient-to-r from-cyan-500 via-violet-500 to-fuchsia-500 origin-left z-50"
        style={{ scaleX }}
      />
      
      {/* Background Effects */}
      <div className="fixed inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-slate-900 via-slate-950 to-black pointer-events-none" />
      <div className="fixed inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 pointer-events-none" />

      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-40 bg-slate-950/80 backdrop-blur-xl border-b border-slate-800/50">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FlaskConical className="w-6 h-6 text-cyan-400" />
            <span className="font-bold bg-gradient-to-r from-cyan-400 to-violet-400 bg-clip-text text-transparent">
              {selectedLang === 'ru' ? 'Экспериментальное Мышление' : 'Experimental Mindset'}
            </span>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="hidden sm:flex items-center gap-2 text-sm text-slate-400">
              <span>{Math.round(progress)}%</span>
              <div className="w-24 h-2 bg-slate-800 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-gradient-to-r from-cyan-500 to-violet-500 transition-all duration-500"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
            
            <button
              onClick={() => setSelectedLang(selectedLang === 'ru' ? 'en' : 'ru')}
              className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-800/50 hover:bg-slate-800 border border-slate-700/50 transition-colors text-sm"
            >
              <Languages className="w-4 h-4" />
              <span>{selectedLang === 'ru' ? 'EN' : 'RU'}</span>
            </button>
          </div>
        </div>
      </header>

      <main className="relative z-10 pt-24 pb-32 px-4">
        <div className="max-w-5xl mx-auto">
          {/* Hero */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center mb-16 space-y-4"
          >
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 text-sm mb-4">
              <Sparkles className="w-4 h-4" />
              <span>{selectedLang === 'ru' ? 'Интерактивный курс' : 'Interactive Course'}</span>
            </div>
            <h1 className="text-4xl md:text-6xl font-bold bg-gradient-to-b from-white to-slate-400 bg-clip-text text-transparent">
              {selectedLang === 'ru' ? 'Экспериментальное Мышление' : 'The Experimental Mindset'}
            </h1>
            <p className="text-lg text-slate-400 max-w-2xl mx-auto">
              {selectedLang === 'ru' 
                ? 'Жить осознанно через любопытство и эксперименты. Основано на идеях Anne-Laure Le Cunff.' 
                : 'Living consciously through curiosity and experimentation. Based on insights from Anne-Laure Le Cunff.'}
            </p>
          </motion.div>

          {/* Sections */}
          <div className="space-y-8">
            {t.sections.map((section, index) => {
              const isActive = index === activeSection;
              const isCompleted = completedSections.has(index);
              const isLocked = index > activeSection && !completedSections.has(index - 1);
              const Icon = section.icon;
              const currentAnswer = answers[index];
              const showTipForThis = showTip === index;

              return (
                <motion.div
                  key={section.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ 
                    opacity: isLocked ? 0.3 : 1, 
                    y: 0,
                    scale: isActive ? 1 : 0.98,
                    filter: isLocked ? 'blur(2px)' : 'blur(0px)'
                  }}
                  transition={{ duration: 0.4, delay: index * 0.05 }}
                  className={cn(
                    "relative group",
                    isLocked && "pointer-events-none"
                  )}
                >
                  <Card className={cn(
                    "border-0 bg-slate-900/50 backdrop-blur-xl overflow-hidden transition-all duration-500",
                    isActive && "ring-1 ring-cyan-500/50 shadow-2xl shadow-cyan-500/10",
                    isCompleted && "ring-1 ring-emerald-500/30"
                  )}>
                    {/* Status Indicator */}
                    <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-transparent via-slate-700 to-transparent">
                      <motion.div
                        className={cn(
                          "w-full transition-all duration-500",
                          isCompleted ? "bg-emerald-500 h-full" : isActive ? "bg-cyan-500 h-full" : "bg-slate-700 h-0"
                        )}
                      />
                    </div>

                    <CardContent className="p-6 md:p-8 pl-8 md:pl-10">
                      {/* Section Header */}
                      <div className="flex items-start gap-4 mb-6">
                        <div className={cn(
                          "p-3 rounded-xl transition-colors duration-300",
                          isActive ? "bg-cyan-500/20 text-cyan-400" : 
                          isCompleted ? "bg-emerald-500/20 text-emerald-400" : 
                          "bg-slate-800 text-slate-500"
                        )}>
                          <Icon className="w-6 h-6" />
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-1">
                            <span className="text-xs font-mono text-slate-500 uppercase tracking-wider">
                              {selectedLang === 'ru' ? 'Раздел' : 'Section'} {index + 1}/{sections.length}
                            </span>
                            {isCompleted && (
                              <span className="flex items-center gap-1 text-xs text-emerald-400">
                                <CheckCircle2 className="w-3 h-3" />
                                {selectedLang === 'ru' ? 'Завершено' : 'Completed'}
                              </span>
                            )}
                          </div>
                          <h2 className="text-2xl font-bold text-white">
                            {section.title}
                          </h2>
                        </div>
                      </div>

                      {/* Content */}
                      <div className="space-y-6 text-slate-300 leading-relaxed">
                        {section.intro && (
                          <p className="text-lg text-slate-400" dangerouslySetInnerHTML={{ __html: section.intro }} />
                        )}

                        {/* Subsections (Journey) */}
                        {section.subSections && (
                          <div className="grid md:grid-cols-2 gap-4">
                            {section.subSections.map((sub, subIdx) => (
                              <div key={subIdx} className={cn(
                                "p-5 rounded-xl border bg-gradient-to-br",
                                sub.gradient,
                                sub.borderColor
                              )}>
                                <h3 className={cn("font-semibold mb-3 flex items-center gap-2", sub.textColor)}>
                                  <span>{sub.icon}</span>
                                  {sub.title}
                                </h3>
                                <ul className="space-y-2 text-sm">
                                  {sub.points.map((point, i) => (
                                    <li key={i} className="flex gap-2">
                                      <span className="text-slate-500">•</span>
                                      <span dangerouslySetInnerHTML={{ __html: point }} />
                                    </li>
                                  ))}
                                </ul>
                                {sub.imageUrl && (
                                  <div className="mt-4 aspect-video rounded-lg overflow-hidden bg-black/20">
                                    <Image 
                                      src={sub.imageUrl} 
                                      alt={sub.imageAlt} 
                                      width={400} 
                                      height={225}
                                      className="w-full h-full object-cover opacity-80 hover:opacity-100 transition-opacity"
                                    />
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Grid Items (Blocking Mindsets) */}
                        {section.gridItems && (
                          <div className="grid sm:grid-cols-3 gap-4">
                            {section.gridItems.map((item, itemIdx) => (
                              <div key={itemIdx} className={cn(
                                "p-4 rounded-xl border bg-gradient-to-br",
                                item.gradient,
                                "border-slate-700/50 hover:border-slate-600/50 transition-colors"
                              )}>
                                <div className="flex items-center gap-2 mb-3">
                                  <span className="text-2xl">{item.icon}</span>
                                  <h4 className="font-semibold text-white">{item.title}</h4>
                                </div>
                                <ul className="space-y-1 text-sm text-slate-400 mb-3">
                                  {item.points.map((p, i) => (
                                    <li key={i}>• {p}</li>
                                  ))}
                                </ul>
                                <p className="text-xs text-slate-500 italic">
                                  → {item.leadsTo}
                                </p>
                              </div>
                            ))}
                          </div>
                        )}

                        {/* PACT Items */}
                        {section.pactItems && (
                          <div className="space-y-3">
                            {section.pactItems.map((item, itemIdx) => (
                              <div key={itemIdx} className="flex gap-4 p-4 rounded-lg bg-slate-800/50 border border-slate-700/50 hover:border-slate-600/50 transition-colors group/item">
                                <div className="flex-shrink-0 w-12 h-12 rounded-lg bg-slate-800 flex items-center justify-center text-2xl border border-slate-700 group-hover/item:border-slate-600 transition-colors">
                                  {item.icon}
                                </div>
                                <div>
                                  <div className="flex items-baseline gap-2 mb-1">
                                    <span className={cn(
                                      "text-lg font-bold",
                                      item.color === 'pink' && "text-pink-400",
                                      item.color === 'blue' && "text-blue-400",
                                      item.color === 'amber' && "text-amber-400",
                                      item.color === 'emerald' && "text-emerald-400",
                                    )}>{item.letter}</span>
                                    <span className="font-semibold text-white">{item.title}</span>
                                  </div>
                                  <p className="text-sm text-slate-400">{item.desc}</p>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Standard Points */}
                        {!section.subSections && !section.gridItems && !section.pactItems && section.points.length > 0 && (
                          <ul className="space-y-3">
                            {section.points.map((point, i) => (
                              <li key={i} className="flex gap-3 items-start p-3 rounded-lg hover:bg-slate-800/30 transition-colors">
                                <span className="text-cyan-500 mt-1">▸</span>
                                <span dangerouslySetInnerHTML={{ __html: point }} />
                              </li>
                            ))}
                          </ul>
                        )}

                        {/* Analysis Section */}
                        {section.subSections && section.id === 'analyzing-data' && (
                          <div className="mt-6 space-y-4">
                            {section.exampleTitle && (
                              <div className="p-4 rounded-lg bg-slate-800/30 border border-slate-700/50">
                                <h4 className="font-semibold text-amber-400 mb-2">{section.exampleTitle}</h4>
                                <ul className="space-y-1 text-sm">
                                  {section.examplePoints?.map((p, i) => (
                                    <li key={i} dangerouslySetInnerHTML={{ __html: p }} />
                                  ))}
                                </ul>
                              </div>
                            )}
                            
                            {section.decisionTitle && (
                              <div>
                                <h4 className="font-semibold text-white mb-3">{section.decisionTitle}</h4>
                                <div className="grid sm:grid-cols-3 gap-3">
                                  {section.decisionPoints?.map((item, i) => (
                                    <div key={i} className={cn(
                                      "p-3 rounded-lg border text-sm",
                                      item.color === 'emerald' && "bg-emerald-500/10 border-emerald-500/30 text-emerald-300",
                                      item.color === 'amber' && "bg-amber-500/10 border-amber-500/30 text-amber-300",
                                      item.color === 'blue' && "bg-blue-500/10 border-blue-500/30 text-blue-300",
                                    )} dangerouslySetInnerHTML={{ __html: item.text }} />
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        )}

                        {/* Main Image */}
                        {section.imageUrl && !section.subSections && (
                          <div className="relative aspect-video rounded-xl overflow-hidden bg-slate-800 border border-slate-700/50 group/image">
                            <Image
                              src={section.imageUrl}
                              alt={section.imageAlt}
                              fill
                              className="object-cover opacity-80 group-hover/image:opacity-100 transition-opacity duration-500"
                              placeholder="blur"
                              blurDataURL={PLACEHOLDER_BLUR_URL}
                            />
                            <div className="absolute inset-0 bg-gradient-to-t from-slate-900/60 to-transparent" />
                            <p className="absolute bottom-4 left-4 text-sm text-slate-300 italic">
                              {section.imageAlt}
                            </p>
                          </div>
                        )}

                        {section.outro && (
                          <p className="text-lg italic text-slate-400 border-l-2 border-amber-500/50 pl-4" dangerouslySetInnerHTML={{ __html: section.outro }} />
                        )}

                        {/* Interactive Question */}
                        {isActive && !isCompleted && (
                          <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            className="mt-8 p-6 rounded-xl bg-gradient-to-br from-slate-800/80 to-slate-900/80 border border-slate-700"
                          >
                            <div className="flex items-start gap-3 mb-4">
                              <HelpCircle className="w-6 h-6 text-amber-400 flex-shrink-0" />
                              <h3 className="text-lg font-semibold text-white">
                                {selectedLang === 'ru' ? 'Проверьте понимание' : 'Check Your Understanding'}
                              </h3>
                            </div>
                            
                            <p className="text-slate-300 mb-6 text-lg">
                              {selectedLang === 'ru' ? sections[index].question.textRu : sections[index].question.textEn}
                            </p>

                            {!currentAnswer ? (
                              <div className="flex gap-3">
                                <Button
                                  onClick={() => handleAnswer(index, 'yes')}
                                  className="flex-1 bg-slate-800 hover:bg-emerald-600/20 hover:text-emerald-400 hover:border-emerald-500/50 border border-slate-700 transition-all"
                                >
                                  {selectedLang === 'ru' ? 'Да' : 'Yes'}
                                </Button>
                                <Button
                                  onClick={() => handleAnswer(index, 'no')}
                                  className="flex-1 bg-slate-800 hover:bg-rose-600/20 hover:text-rose-400 hover:border-rose-500/50 border border-slate-700 transition-all"
                                >
                                  {selectedLang === 'ru' ? 'Нет' : 'No'}
                                </Button>
                              </div>
                            ) : (
                              <div className="space-y-4">
                                <div className={cn(
                                  "flex items-center gap-2 p-4 rounded-lg",
                                  currentAnswer.correct ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30" : "bg-rose-500/20 text-rose-400 border border-rose-500/30"
                                )}>
                                  {currentAnswer.correct ? <CheckCircle2 className="w-5 h-5" /> : <XCircle className="w-5 h-5" />}
                                  <span className="font-medium">
                                    {currentAnswer.correct 
                                      ? (selectedLang === 'ru' ? 'Правильно!' : 'Correct!') 
                                      : (selectedLang === 'ru' ? 'Неверно' : 'Incorrect')}
                                  </span>
                                </div>

                                {showTipForThis && (
                                  <motion.div
                                    initial={{ opacity: 0, height: 0 }}
                                    animate={{ opacity: 1, height: 'auto' }}
                                    className="p-4 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-200 text-sm"
                                  >
                                    <span className="font-semibold">{selectedLang === 'ru' ? 'Подсказка: ' : 'Tip: '}</span>
                                    {selectedLang === 'ru' ? sections[index].question.tipRu : sections[index].question.tipEn}
                                  </motion.div>
                                )}

                                <Button
                                  onClick={handleContinue}
                                  className="w-full bg-gradient-to-r from-cyan-600 to-violet-600 hover:from-cyan-500 hover:to-violet-500 text-white border-0"
                                >
                                  {index === sections.length - 1 
                                    ? (selectedLang === 'ru' ? 'Завершить курс' : 'Complete Course')
                                    : (selectedLang === 'ru' ? 'Продолжить' : 'Continue')}
                                  <ArrowRight className="w-4 h-4 ml-2" />
                                </Button>
                              </div>
                            )}
                          </motion.div>
                        )}

                        {/* Completed State */}
                        {isCompleted && (
                          <div className="mt-6 flex items-center justify-center p-4 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
                            <CheckCircle2 className="w-5 h-5 mr-2" />
                            <span>{selectedLang === 'ru' ? 'Раздел завершен' : 'Section completed'}</span>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              );
            })}
          </div>

          {/* Footer Navigation */}
          <div className="mt-12 flex justify-between items-center">
            <Button
              variant="ghost"
              onClick={() => setActiveSection(Math.max(0, activeSection - 1))}
              disabled={activeSection === 0}
              className="text-slate-400 hover:text-white"
            >
              <ChevronLeft className="w-4 h-4 mr-2" />
              {selectedLang === 'ru' ? 'Назад' : 'Back'}
            </Button>
            
            <div className="flex gap-2">
              {sections.map((_, idx) => (
                <button
                  key={idx}
                  onClick={() => {
                    if (completedSections.has(idx) || idx <= activeSection) {
                      setActiveSection(idx);
                    }
                  }}
                  className={cn(
                    "w-2 h-2 rounded-full transition-all",
                    idx === activeSection ? "w-8 bg-cyan-500" : 
                    completedSections.has(idx) ? "bg-emerald-500" : 
                    "bg-slate-700"
                  )}
                />
              ))}
            </div>

            <Button
              variant="ghost"
              onClick={() => setActiveSection(Math.min(sections.length - 1, activeSection + 1))}
              disabled={activeSection === sections.length - 1 || !completedSections.has(activeSection)}
              className="text-slate-400 hover:text-white"
            >
              {selectedLang === 'ru' ? 'Вперед' : 'Forward'}
              <ChevronRight className="w-4 h-4 ml-2" />
            </Button>
          </div>

          {/* Final CTA */}
          {completedSections.size === sections.length && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-12 text-center p-8 rounded-2xl bg-gradient-to-br from-emerald-500/20 via-cyan-500/20 to-violet-500/20 border border-emerald-500/30"
            >
              <h3 className="text-2xl font-bold text-white mb-2">
                {selectedLang === 'ru' ? '🎉 Поздравляем!' : '🎉 Congratulations!'}
              </h3>
              <p className="text-slate-300 mb-6">
                {selectedLang === 'ru' 
                  ? 'Вы успешно завершили курс по экспериментальному мышлению.' 
                  : 'You have successfully completed the Experimental Mindset course.'}
              </p>
              <div className="flex justify-center gap-4">
                <Link href="/purpose-profit">
                  <Button className="bg-slate-800 hover:bg-slate-700 border border-slate-600">
                    Purpose & Profit
                  </Button>
                </Link>
                <Link href="/cybervibe">
                  <Button className="bg-gradient-to-r from-cyan-600 to-violet-600 hover:from-cyan-500 hover:to-violet-500">
                    КиберВайб
                  </Button>
                </Link>
              </div>
            </motion.div>
          )}
        </div>
      </main>
    </div>
  );
}
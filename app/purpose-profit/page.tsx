"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button"; // Added Button for toggle
import { useAppContext } from "@/contexts/AppContext";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  FaBookOpen, FaBriefcase, FaPersonRunning, FaMoneyBillWave, FaBrain,
  FaLayerGroup, FaMagnifyingGlassChart, FaMapLocation, FaHandHoldingDollar,
  FaKeyboard, FaBullseye, FaPaintbrush, FaCircleUser, // Using user's provided icons
} from "react-icons/fa6";
import { debugLogger } from "@/lib/debugLogger";
import Image from "next/image";
import Link from "next/link";
import { cn } from "@/lib/utils";

type Language = 'en' | 'ru';

// --- Chapter Data Update ---
const chapters = [
  {
    id: "intro",
    icon: FaBookOpen,
    titleEn: "Introduction",
    titleRu: "Введение",
    pointsEn: [
      "Provides mental frameworks, focusing on mindset over specific instructions.",
      "Emphasizes integrating purpose and profit, acknowledging money's importance.",
      "Aimed at creatives, unfulfilled workers, and those fearing job replacement.",
      "Presents raw thoughts, encouraging reading twice for better understanding.",
    ],
    pointsRu: [
      "Эта книга предлагает ментальные модели и идеи, а не конкретные шаги, фокусируясь на мышлении.",
      "Подчеркивается интеграция цели и прибыли, признавая важность денег без их прославления.",
      "Предназначена для творческих людей, нереализованных работников и тех, кто боится потерять работу.",
      "Представляет сырые мысли, призывая читать дважды для лучшего понимания.",
    ],
    imagePlaceholder: "/placeholders/pp/pp_intro.png",
    imageAltEn: "Infographic: Mindset vs Instructions for Purpose & Profit",
    imageAltRu: "Инфографика: Мышление против Инструкций для Цели и Прибыли",
    tooltipRu: "Визуализация сравнения: жесткие инструкции против гибких ментальных моделей как путь к интеграции цели и прибыли.",
  },
  {
    id: "jobs",
    icon: FaBriefcase,
    titleEn: "The Truth About Jobs",
    titleRu: "Правда о Работе",
    pointsEn: [
      "Society conditions people for 'jobs' (assigned work for survival), hindering dreams.",
      "Distinguishes: Job (survival), Career (development), Calling (passionate, self-driven work).",
      "Assigned work often leads to misery; meaningful work involves solving chosen problems.",
      "Superficial pursuit of money can be a gateway to skill development and finding one's calling.",
    ],
    pointsRu: [
      "Общество приучает к 'работе' (назначенный труд для выживания), мешая мечтам.",
      "Различает: Работа (выживание), Карьера (развитие), Призвание (страстный, самонаправленный труд).",
      "Назначенная работа часто ведет к несчастью; осмысленная работа – решение выбранных проблем.",
      "Поверхностное стремление к деньгам может стать путем к развитию навыков и призванию.",
    ],
    imagePlaceholder: "/placeholders/pp/pp_jobs.png",
    imageAltEn: "Infographic: Job vs Career vs Calling comparison",
    imageAltRu: "Инфографика: Сравнение Работы, Карьеры и Призвания",
    tooltipRu: "Инфографика, иллюстрирующая различие между работой (выживание), карьерой (развитие) и призванием (страсть и самореализация).",
  },
  {
      id: "employment_vs_entrepreneurship",
      icon: FaPersonRunning,
      titleEn: "Employment vs Entrepreneurship",
      titleRu: "Наемный Труд против Предпринимательства",
      pointsEn: [
          "Future work demands entrepreneurial traits (high agency, self-direction) even within employment.",
          "Entrepreneurship redefined as a high-agency mindset: creating goals, taking responsibility, continuous self-development via problem-solving.",
          "Standard employment can foster complacency; entrepreneurship embraces uncertainty and personal evolution.",
          "Entrepreneurship as 'other-development': solve your problems, share solutions to help others evolve.",
      ],
      pointsRu: [
          "Будущее работы потребует предпринимательских качеств (высокая самостоятельность, самонаправленность) даже в найме.",
          "Предпринимательство как склад ума: создание целей, ответственность, саморазвитие через решение проблем.",
          "Найм может вести к самоуспокоенности; предпринимательство принимает неопределенность и способствует эволюции.",
          "Предпринимательство как 'развитие других': реши свои проблемы, поделись решениями, чтобы помочь другим.",
      ],
      imagePlaceholder: "/placeholders/pp/pp_entrepreneurship.png",
      imageAltEn: "Infographic: Complacent Employee vs High-Agency Entrepreneur",
      imageAltRu: "Инфографика: Самодовольный Работник против Предпринимателя с высокой самостоятельностью",
      tooltipRu: "Сравнение: зона комфорта стандартного найма против зоны роста и неопределенности предпринимательского подхода, основанного на высокой самостоятельности.",
  },
  {
      id: "money",
      icon: FaMoneyBillWave,
      titleEn: "The Unignorability of Money",
      titleRu: "Неотвратимость Денег",
      pointsEn: [
          "Demonizing money hinders growth; it's a neutral tool, value depends on problems/goals.",
          "Negative views on money are often conditioned; address underlying personal issues.",
          "Money linked to survival, influences actions; can tool problem-solving, development, consciousness expansion.",
          "Rejects labor theory of value; income correlates with value created (problems solved, results achieved).",
          "Entrepreneurship as the path to ethically generate/use money for purpose.",
      ],
      pointsRu: [
          "Демонизация денег мешает росту; это нейтральный инструмент, ценность зависит от проблем/целей.",
          "Негативные взгляды часто обусловлены воспитанием; решайте глубинные проблемы.",
          "Деньги связаны с выживанием; могут быть инструментом для решения проблем, развития, расширения сознания.",
          "Отвергает трудовую теорию стоимости; доход коррелирует с созданной ценностью (решенные проблемы, результаты).",
          "Предпринимательство – путь к этичному созданию/использованию денег для цели.",
      ],
      imagePlaceholder: "/placeholders/pp/pp_money.png",
      imageAltEn: "Infographic: Money as a Neutral Tool vs Demonized Concept",
      imageAltRu: "Инфографика: Деньги как Нейтральный Инструмент против Демонизированной Концепции",
      tooltipRu: "Визуализация денег как нейтрального инструмента для достижения целей (выживание, развитие) в противовес их демонизации, мешающей росту.",
  },
  {
      id: "generalism",
      icon: FaBrain,
      titleEn: "Deep Generalism",
      titleRu: "Глубокий Генерализм",
      pointsEn: [
          "Humans are naturally creators and deep generalists, capable of mastering multiple domains.",
          "Specialists are like tools, susceptible to replacement; generalists adapt.",
          "Traditional education hinders adaptability, creativity, agency by producing specialists.",
          "True education is discovery, learning how to learn, adapting, applying tools.",
          "Cultivate 'self-governance' (self-experimentation, awareness, reliance, mastery).",
          "Self-actualization (solving own problems) is prerequisite for helping others.",
      ],
      pointsRu: [
          "Люди – творцы и глубокие генералисты, способные осваивать множество областей.",
          "Специалисты уязвимы для замены; генералисты адаптируются.",
          "Традиционное образование мешает адаптивности, креативности, самостоятельности.",
          "Истинное образование – открытие, умение учиться, адаптация, применение инструментов.",
          "Развивайте 'самоуправление' (самоэкспериментирование, осознанность, опора на себя, мастерство).",
          "Самоактуализация (решение своих проблем) – предпосылка помощи другим.",
      ],
      imagePlaceholder: "/placeholders/pp/pp_generalism.png",
      imageAltEn: "Infographic: T-shaped Generalist vs I-shaped Specialist",
      imageAltRu: "Инфографика: T-образный Генералист против I-образного Специалиста",
      tooltipRu: "Сравнение 'I'-образного специалиста (узкая экспертиза, уязвимость) и 'T'-образного глубокого генералиста (широкий кругозор, глубокая экспертиза, адаптивность).",
  },
   {
      id: "purpose_levels",
      icon: FaLayerGroup,
      titleEn: "Levels of Purpose",
      titleRu: "Уровни Цели / Предназначения",
      pointsEn: [
          "Purpose stems from understanding interconnected reality and progressing through levels of development (expanding circles of care).",
          "Problems are limits on potential; solving them drives growth and higher purpose.",
          "Four main levels: Survival, Status, Creativity, Contribution.",
          "Each level involves overcoming specific problems/mindsets, moving from basic needs/external validation to self-directed creation and contribution.",
          "Entrepreneurship can facilitate development through these levels.",
      ],
      pointsRu: [
          "Цель проистекает из понимания взаимосвязанной реальности и прогресса через уровни развития (расширяющиеся круги заботы).",
          "Проблемы – ограничения потенциала; их решение стимулирует рост и высшую цель.",
          "Четыре уровня: Выживание, Статус, Креативность, Вклад.",
          "Каждый уровень включает преодоление проблем/установок, движение от базовых нужд/внешней валидации к самонаправленному созданию и вкладу.",
          "Предпринимательство может способствовать развитию на этих уровнях.",
      ],
      imagePlaceholder: "/placeholders/pp/pp_purpose_levels.png",
      imageAltEn: "Infographic: Concentric Circles of Purpose Levels",
      imageAltRu: "Инфографика: Концентрические Круги Уровней Цели",
      tooltipRu: "Визуализация четырех уровней цели/предназначения в виде концентрических кругов, от базового выживания до вклада в мир.",
  },
  {
      id: "progress_knowledge",
      icon: FaMagnifyingGlassChart,
      titleEn: "Progress and Knowledge",
      titleRu: "Прогресс и Знание",
      pointsEn: [
          "Progress requires knowledge, created via trial and error (conjecture and criticism).",
          "Humans are 'universal explainers', capable of infinite knowledge creation; tech extends this.",
          "Problems are infinite but soluble; engaging with them prevents entropy and generates purpose/flow.",
          "Progress follows 'Nature's Compass' cycle: lost -> interested -> obsessed -> deeper understanding -> new challenges.",
          "Requires constant experimentation (inward, outward, deep-diving, iterating upwards).",
      ],
      pointsRu: [
          "Прогресс требует знаний, создаваемых через пробы и ошибки (гипотезы и критика).",
          "Люди – 'универсальные объяснители', способные создавать бесконечное знание; технологии расширяют это.",
          "Проблемы бесконечны, но разрешимы; взаимодействие с ними предотвращает энтропию, порождает цель/поток.",
          "Прогресс следует циклу 'Компаса Природы': потерянность -> интерес -> одержимость -> понимание -> новые вызовы.",
          "Требует постоянного экспериментирования (внутреннего, внешнего, глубокого погружения, итераций вверх).",
      ],
      imagePlaceholder: "/placeholders/pp/pp_progress.png",
      imageAltEn: "Infographic: Cycle of Progress - Nature's Compass",
      imageAltRu: "Инфографика: Цикл Прогресса - Компас Природы",
      tooltipRu: "Циклическая диаграмма 'Компаса Природы', иллюстрирующая процесс прогресса и создания знаний через экспериментирование и решение проблем.",
  },
  {
      id: "lifes_work",
      icon: FaMapLocation, // Using user's provided icon
      titleEn: "Your Life's Work",
      titleRu: "Дело Вашей Жизни",
      pointsEn: [
          "Life's work is reaching potential, integrating purpose/profit ('getting paid to be yourself'), becoming a source of value.",
          "Not a fixed destination, but a direction discovered via effort and course correction.",
          "Create an evolving personal plan/blueprint, not search for a predefined 'work'.",
          "Plan components: Anti-Vision, Vision, Mission, Standards, Goals, Projects, Constraints, Levers, Challenge, Curiosity.",
      ],
      pointsRu: [
          "Дело жизни – раскрытие потенциала, интеграция цели/прибыли ('получать плату за то, чтобы быть собой'), становление источником ценности.",
          "Не пункт назначения, а направление, открываемое через усилия и коррекцию курса.",
          "Создавайте развивающийся личный план/чертеж, а не ищите предопределенную 'работу'.",
          "Компоненты плана: Анти-видение, Видение, Миссия, Стандарты, Цели, Проекты, Ограничения, Рычаги, Вызов, Любопытство.",
      ],
      imagePlaceholder: "/placeholders/pp/pp_lifes_work.png",
      imageAltEn: "Infographic: Personal Blueprint Components for Life's Work",
      imageAltRu: "Инфографика: Компоненты Личного Плана для Дела Жизни",
      tooltipRu: "Майнд-карта или чертеж, показывающий ключевые компоненты личного плана для навигации к 'Делу Вашей Жизни'.",
  },
  {
      id: "value_creation",
      icon: FaHandHoldingDollar,
      titleEn: "Value Creation",
      titleRu: "Создание Ценности",
      pointsEn: [
          "Tech democratizes creation; challenge shifts from *making* to *making people care*.",
          "Creating value requires ethical persuasion and media (online) to build audience/connect.",
          "Value is perceptual; shape perception by answering: Who, What problem, Where (result), When, Why (pains/benefits).",
          "Your solution is your unique *process* for solving the problem, often found via self-experimentation.",
      ],
      pointsRu: [
          "Технологии демократизируют создание; вызов смещается от *создания* к *пробуждению интереса*.",
          "Создание ценности требует этичного убеждения и медиа (онлайн) для построения аудитории/связи.",
          "Ценность субъективна; формируйте восприятие, отвечая: Кому, Какую проблему, Куда (результат), Когда, Почему (боли/выгоды).",
          "Ваше решение – уникальный *процесс* решения проблемы, часто найденный через самоэкспериментирование.",
      ],
      imagePlaceholder: "/placeholders/pp/pp_value.png",
      imageAltEn: "Infographic: Shaping Value Perception Questions",
      imageAltRu: "Инфографика: Вопросы для Формирования Восприятия Ценности",
      tooltipRu: "Инфографика, иллюстрирующая, что ценность субъективна и формируется путем ответа на ключевые вопросы (Кто, Что, Куда, Когда, Почему).",
  },
   {
      id: "meta_skill",
      icon: FaKeyboard,
      titleEn: "The Meta Skill",
      titleRu: "Мета-Навык",
      pointsEn: [
          "Information is foundational; accessibility evolved dramatically (internet).",
          "Writing identified as the fundamental 'meta-skill': clarifies thinking, solidifies learning, enables earning.",
          "Writing in public creates feedback loops and teaches related skills (psychology, marketing).",
          "In AI age, human value lies in vision, taste, coherence, storytelling – practiced via writing.",
          "Writing is accessible, foundational (even for code via natural language), provides permissionless leverage.",
      ],
      pointsRu: [
          "Информация – основа; доступность кардинально эволюционировала (интернет).",
          "Письмо – фундаментальный 'мета-навык': проясняет мышление, закрепляет обучение, позволяет зарабатывать.",
          "Письмо 'в публичном пространстве' создает обратную связь и обучает смежным навыкам.",
          "В эпоху ИИ ценность человека – в видении, вкусе, связности, сторителлинге – практикуемых через письмо.",
          "Письмо доступно, фундаментально (даже для кода), дает рычаги без разрешения.",
      ],
      imagePlaceholder: "/placeholders/pp/pp_metaskill.png",
      imageAltEn: "Infographic: Writing as the Core Meta-Skill",
      imageAltRu: "Инфографика: Письмо как Ключевой Мета-Навык",
      tooltipRu: "Визуализация письма как центрального мета-навыка, соединяющего ясное мышление, обучение, заработок и развитие ключевых качеств.",
  },
  {
      id: "self_monetization",
      icon: FaBullseye,
      titleEn: "Self-Monetization",
      titleRu: "Самомонетизация",
      pointsEn: [
          "Control income/life by creating and selling a 'product' (value offering).",
          "Rejects 'choose a niche'; advocates 'You *are* the niche'.",
          "Self-Monetization: Solve own problems via self-experimentation, package and sell the solution to others like you (authentic niche).",
          "Leverages unique experience, creates hard-to-replicate value, fosters self/other-improvement.",
          "Enables high-leverage one-person businesses (info products, goods, services).",
      ],
      pointsRu: [
          "Контролируйте доход/жизнь, создавая и продавая 'продукт'.",
          "Отвергает 'выбор ниши'; продвигает 'Ты *и есть* ниша'.",
          "Самомонетизация: Реши свои проблемы через самоэкспериментирование, упакуй и продай решение таким же, как ты (аутентичная ниша).",
          "Использует уникальный опыт, создает труднокопируемую ценность, способствует само-/друго-совершенствованию.",
          "Позволяет создавать бизнесы одного человека с высоким рычагом (инфопродукты, товары, услуги).",
      ],
      imagePlaceholder: "/placeholders/pp/pp_selfmonetization.png",
      imageAltEn: "Infographic: 'You are the Niche' Self-Monetization Model",
      imageAltRu: "Инфографика: Модель Самомонетизации 'Ты - это Ниша'",
      tooltipRu: "Диаграмма цикла самомонетизации: решение собственных проблем -> упаковка решения -> предложение аутентичной нише.",
  },
  {
      id: "creator",
      icon: FaPaintbrush, // Using user's provided icon
      titleEn: "Become a Creator",
      titleRu: "Станьте Творцом",
      pointsEn: [
          "Humans are naturally creators but many become passive employees.",
          "Fundamental path forward: Embrace creativity, become a creator (identify problems, explore solutions, create/share value, intersect purpose/profit).",
          "We are in a 'Second Renaissance' (internet-driven); creators are new sense-makers.",
          "Future-proofing key: Shift from consumer to creator mindset (solve own problems, publish solutions, build audience, become a generalist orchestrator).",
      ],
      pointsRu: [
          "Люди – творцы по природе, но многие стали пассивными работниками.",
          "Фундаментальный путь: Принять креативность, стать творцом (выявлять проблемы, исследовать решения, создавать/делиться ценностью, пересекать цель/прибыль).",
          "Мы во 'Втором Ренессансе' (интернет); творцы – новые создатели смыслов.",
          "Ключ к будущему: Перейти от мышления потребителя к мышлению творца (решать свои проблемы, публиковать решения, строить аудиторию, стать генералистом-оркестратором).",
      ],
      imagePlaceholder: "/placeholders/pp/pp_creator.png",
      imageAltEn: "Infographic: Shifting from Consumer to Creator Mindset",
      imageAltRu: "Инфографика: Переход от Мышления Потребителя к Мышлению Творца",
      tooltipRu: "Сравнение пассивного потребителя и активного творца. Призыв к созданию, решению проблем и построению аудитории.",
  },
  {
      id: "author",
      icon: FaCircleUser, // Using user's provided icon
      titleEn: "About the Author",
      titleRu: "Об Авторе",
      pointsEn: [
          "Call to action: Leave review, visit website (thedankoe.com), check previous book 'The Art of Focus'.",
      ],
      pointsRu: [
          "Призыв к действию: Оставить отзыв, посетить веб-сайт (thedankoe.com), ознакомиться с книгой 'The Art of Focus'.",
      ],
      imagePlaceholder: null,
      imageAltEn: "",
      imageAltRu: "",
      tooltipRu: "",
  },
];


// --- Component ---
export default function PurposeProfitPage() {
  const { user } = useAppContext(); // Get user for language detection
  const [isMounted, setIsMounted] = useState(false);
  const [selectedLang, setSelectedLang] = useState<Language>('ru'); // Default to Russian

  useEffect(() => {
    setIsMounted(true);
    // Detect initial language
    const browserLang = typeof navigator !== 'undefined' ? navigator.language.split('-')[0] : 'ru';
    const telegramLang = user?.language_code;
    const initialLang = telegramLang === 'ru' || (!telegramLang && browserLang === 'ru') ? 'ru' : 'en';
    setSelectedLang(initialLang);
    debugLogger.log(`[PurposeProfitPage] Mounted. Browser lang: ${browserLang}, TG lang: ${telegramLang}, Initial selected: ${initialLang}`);
  }, [user]); // Rerun if user context updates

  // Basic loading state until mounted
  if (!isMounted) {
    return (
      <div className="flex justify-center items-center min-h-screen pt-20 bg-gradient-to-br from-gray-900 via-black to-gray-800">
        <p className="text-brand-green animate-pulse text-xl font-mono">Загрузка мудрости Purpose & Profit...</p>
      </div>
    );
  }

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

      <TooltipProvider delayDuration={200}>
        <div className="relative z-10 container mx-auto px-4">
          <Card className="max-w-4xl mx-auto bg-black/80 backdrop-blur-md text-white rounded-2xl border border-brand-purple/30 shadow-[0_0_25px_rgba(168,85,247,0.4)]">
            <CardHeader className="text-center border-b border-brand-purple/20 pb-4">
              <CardTitle className="text-3xl md:text-5xl font-bold text-brand-purple cyber-text glitch" data-text="Purpose & Profit Summary">
                Purpose & Profit Summary
              </CardTitle>
              <p className="text-md md:text-lg text-gray-300 mt-3 font-mono">
                {selectedLang === 'ru'
                    ? "Ключевые идеи и ментальные модели из книги Дэна Ко."
                    : "Key Ideas and Mental Models from Dan Koe's Book."}
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
                        "border-brand-purple/50",
                        selectedLang === 'ru' ? 'bg-brand-purple/20 text-brand-purple hover:bg-brand-purple/30' : 'text-gray-400 hover:bg-gray-800 hover:text-gray-200'
                    )}
                  >
                    🇷🇺 Русский
                  </Button>
                  <Button
                     variant={selectedLang === 'en' ? 'secondary' : 'outline'}
                     size="sm"
                     onClick={() => setSelectedLang('en')}
                     className={cn(
                        "border-brand-blue/50", // Different color for EN?
                        selectedLang === 'en' ? 'bg-brand-blue/20 text-brand-blue hover:bg-brand-blue/30' : 'text-gray-400 hover:bg-gray-800 hover:text-gray-200'
                     )}
                  >
                    🇬🇧 English
                  </Button>
              </div>

              {/* Chapters */}
              {chapters.map((chapter, index) => {
                const IconComponent = chapter.icon;
                const themeColor = ["text-brand-pink", "text-brand-blue", "text-neon-lime", "text-brand-orange", "text-brand-cyan", "text-brand-yellow", "text-brand-purple", "text-brand-green"][index % 8];
                const borderColor = themeColor.replace("text-", "border-");
                const currentTitle = selectedLang === 'en' ? chapter.titleEn : chapter.titleRu;
                const currentPoints = selectedLang === 'en' ? chapter.pointsEn : chapter.pointsRu;
                const currentImageAlt = selectedLang === 'en' ? chapter.imageAltEn : chapter.imageAltRu;

                return (
                  <section key={chapter.id} className={`space-y-4 border-l-4 pl-4 md:pl-6 ${borderColor}`}>
                    {/* Title */}
                    <h2 className={`flex items-center text-2xl md:text-3xl font-semibold ${themeColor} mb-4`}>
                      <IconComponent className={`mr-3 ${themeColor}/80`} /> {currentTitle}
                    </h2>

                    {/* Points for selected language */}
                    <ul className="list-disc list-outside space-y-2 text-gray-300 pl-5 text-base md:text-lg leading-relaxed">
                      {currentPoints.map((point, i) => (
                        <li key={`${selectedLang}-${i}`}>{point}</li>
                      ))}
                    </ul>

                    {/* Image Placeholder & Tooltip (Tooltip only for RU) */}
                    {chapter.imagePlaceholder && (
                      <div className={`my-6 p-2 border ${borderColor}/30 rounded-lg bg-black/30 max-w-md mx-auto`}>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <div className="aspect-video w-full h-auto overflow-hidden rounded-md bg-gray-800/50 cursor-help">
                              <Image
                                src={chapter.imagePlaceholder}
                                alt={currentImageAlt} // Use dynamic alt text
                                width={600} height={338}
                                className="w-full h-full object-cover opacity-70 hover:opacity-100 transition-opacity"
                                loading="lazy"
                              />
                            </div>
                          </TooltipTrigger>
                          {/* Only show Russian tooltip if RU is selected */}
                          {selectedLang === 'ru' && chapter.tooltipRu && (
                            <TooltipContent side="bottom" className={`max-w-[300px] text-center bg-gray-950 ${borderColor}/60 text-white p-3 shadow-lg border`}>
                              <p className="text-sm whitespace-pre-wrap">{chapter.tooltipRu}</p>
                            </TooltipContent>
                          )}
                        </Tooltip>
                        {/* Dynamic Image Caption */}
                        <p className="text-xs text-center text-gray-400 mt-1 italic">{currentImageAlt}</p>
                      </div>
                    )}

                     {/* Separator for clarity, remove if not needed */}
                     {/* <hr className={`${borderColor}/20 my-6`} /> */}

                  </section>
                );
              })}

              {/* Concluding section */}
              <section className="text-center pt-8 border-t border-brand-purple/20 mt-10">
                 <p className="text-gray-400 italic">
                   {selectedLang === 'ru' ? "Это краткий конспект. Для полного понимания рекомендуется прочесть книгу." : "This is a summary. Reading the full book is recommended for complete understanding."}
                 </p>
                 <p className="mt-4 text-gray-300">
                   {selectedLang === 'ru' ? "Узнайте больше о применении этих идей на практике в разделе" : "Learn more about applying these ideas in the"} <Link href="/selfdev" className="text-brand-blue hover:underline font-semibold">SelfDev</Link> {selectedLang === 'ru' ? "" : "section."}
                 </p>
              </section>

            </CardContent>
          </Card>
        </div>
      </TooltipProvider>
    </div>
  );
}
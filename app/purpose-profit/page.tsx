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
  FaBookOpen, FaBriefcase, FaPersonRunning, FaMoneyBillWave, FaBrain,
  FaLayerGroup, FaMagnifyingGlassChart, FaMapLocation, FaHandHoldingDollar,
  FaKeyboard, FaBullseye, FaPaintbrush, FaCircleUser,
} from "react-icons/fa6";
import { debugLogger } from "@/lib/debugLogger";
import Image from "next/image";
import Link from "next/link";
import { cn } from "@/lib/utils";

type Language = 'en' | 'ru';

const STORAGE_BASE_URL = "https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/about";

// Generic, small, transparent placeholder for image blur
const PLACEHOLDER_BLUR_URL = "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMSIgaGVpZ2h0PSIxIiB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciPjxyZWN0IHdpZHRoPSIxIiBoZWlnaHQ9IjEiIGZpbGw9IiMwMDAiIGZpbGwtb3BhY2l0eT0iMC4xIi8+PC9zdmc+";

// --- Chapter Data with Full Text ---
const chapters = [
  {
    id: "intro", // Chapter 1
    icon: FaBookOpen,
    titleEn: "Introduction",
    titleRu: "Введение",
    pointsEn: [
      "Provides mental frameworks and ideas, not actionable steps, focusing on mindset over specific instructions.",
      "Emphasizes integrating purpose and profit, acknowledging money's importance without glorifying it.",
      "Aimed at creatives, unfulfilled workers, and those fearing job replacement.",
      "Presents raw, minimally edited thoughts, encouraging readers to read it twice for better understanding.",
    ],
    pointsRu: [
      "Эта книга предлагает ментальные модели и идеи, а не конкретные шаги, фокусируясь на мышлении, а не на инструкциях.",
      "Подчеркивается интеграция цели (предназначения) и прибыли, признавая важность денег без их прославления.",
      "Книга предназначена для творческих людей, нереализованных работников и тех, кто боится потерять работу (быть замененным).",
      "Представляет сырые, минимально отредактированные мысли, призывая читателей прочитать дважды для лучшего понимания.",
    ],
    imageUrlEn: `${STORAGE_BASE_URL}/pp01en.png`,
    imageUrlRu: `${STORAGE_BASE_URL}/pp01ru.png`,
    imageAltEn: "Infographic: Mindset vs Instructions for Purpose & Profit",
    imageAltRu: "Инфографика: Мышление против Инструкций для Цели и Прибыли",
    tooltipRu: "Визуализация сравнения: жесткие инструкции против гибких ментальных моделей как путь к интеграции цели и прибыли.",
  },
  {
    id: "jobs", // Chapter 2
    icon: FaBriefcase,
    titleEn: "The Truth About Jobs",
    titleRu: "Правда о Работе",
    pointsEn: [
      "Society conditions people for jobs (assigned work for survival), hindering personal dreams.",
      "Distinguishes between a job (survival), a career (development), and a calling (passionate, self-driven work you can't pull away from).",
      "Argues that assigned work often leads to misery, while meaningful work involves solving chosen problems.",
      "The pursuit of money or material things, while often starting superficially, can be a gateway to deeper understanding, skill development, and finding one's calling (moving from creating to make money, to making money to create).",
    ],
    pointsRu: [
      "Общество приучает людей к работе (назначенному труду для выживания), мешая осуществлению личных мечт.",
      "Различает работу (выживание), карьеру (развитие) и призвание (страстный, самостоятельный труд, от которого невозможно оторваться).",
      "Утверждает, что назначенная работа часто ведет к несчастью, тогда как осмысленная работа включает решение выбранных проблем.",
      "Стремление к деньгам или материальным благам, часто начинаясь поверхностно, может стать путем к более глубокому пониманию, развитию навыков и нахождению своего призвания (переход от \"создавать, чтобы заработать\" к \"зарабатывать, чтобы создавать\").",
    ],
    imageUrlEn: `${STORAGE_BASE_URL}/pp02en.png`,
    imageUrlRu: `${STORAGE_BASE_URL}/pp02ru.png`,
    imageAltEn: "Infographic: Job vs Career vs Calling comparison",
    imageAltRu: "Инфографика: Сравнение Работы, Карьеры и Призвания",
    tooltipRu: "Инфографика, иллюстрирующая различие между работой (выживание), карьерой (развитие) и призванием (страсть и самореализация).",
  },
  {
    id: "employment_vs_entrepreneurship", // Chapter 3
    icon: FaPersonRunning,
    titleEn: "Employment vs Entrepreneurship",
    titleRu: "Наемный Труд против Предпринимательства",
    pointsEn: [
      "Predicts the future of work will demand entrepreneurial traits (high agency, self-direction, problem-solving) even within employment, with traditional entry-level roles declining.",
      "Redefines entrepreneurship as a high-agency mindset focused on creating goals, taking responsibility, and continuous self-development through solving problems.",
      "Argues that standard employment often leads to complacency by removing necessary challenges, while entrepreneurship embraces uncertainty and fosters personal evolution.",
      "Views entrepreneurship as \"other-development\" – solving your own problems and then sharing solutions to help others evolve, thus integrating survival needs with a meaningful life.",
    ],
    pointsRu: [
      "Прогнозирует, что будущее работы потребует предпринимательских качеств (высокая степень самостоятельности, самонаправленность, решение проблем) даже в найме, а традиционные начальные позиции будут исчезать.",
      "Переосмысливает предпринимательство как склад ума с высокой степенью самостоятельности, сфокусированный на создании целей, принятии ответственности и постоянном саморазвитии через решение проблем.",
      "Утверждает, что стандартная занятость часто ведет к самоуспокоенности, устраняя необходимые вызовы, тогда как предпринимательство принимает неопределенность и способствует личной эволюции.",
      "Рассматривает предпринимательство как \"развитие других\" – решение собственных проблем и последующее распространение решений для помощи в эволюции другим, тем самым интегрируя потребности выживания с осмысленной жизнью.",
    ],
    imageUrlEn: `${STORAGE_BASE_URL}/pp03en.png`,
    imageUrlRu: `${STORAGE_BASE_URL}/pp03ru.png`,
    imageAltEn: "Infographic: Complacent Employee vs High-Agency Entrepreneur",
    imageAltRu: "Инфографика: Работник в зоне комфорта против Предпринимателя в зоне роста",
    tooltipRu: "Сравнение: зона комфорта стандартного найма против зоны роста и неопределенности предпринимательского подхода.",
  },
  {
    id: "money", // Chapter 4
    icon: FaMoneyBillWave,
    titleEn: "The Unignorability of Money",
    titleRu: "Неотвратимость Денег",
    pointsEn: [
      "Demonizing money hinders personal growth; money is a neutral tool for exchange, and its perceived value depends on individual problems and goals.",
      "Negative views on money are often conditioned or projections; instead, focus on solving the underlying personal issues.",
      "Money is deeply linked to survival and influences most actions; it can be a tool to solve problems, enable development (personal, spiritual), and expand consciousness beyond egocentrism.",
      "Rejects the labor theory of value (payment for hours worked), arguing that income correlates with the value created: the significance of problems solved and the results achieved.",
      "Entrepreneurship is presented as the path to ethically generate and use money for purpose, contributing value regardless of how the form of \"money\" might evolve.",
    ],
    pointsRu: [
      "Демонизация денег мешает личностному росту; деньги – это нейтральный инструмент обмена, и их воспринимаемая ценность зависит от индивидуальных проблем и целей.",
      "Негативные взгляды на деньги часто обусловлены воспитанием или являются проекциями; вместо этого следует сосредоточиться на решении глубинных личных проблем.",
      "Деньги тесно связаны с выживанием и влияют на большинство действий; они могут быть инструментом для решения проблем, обеспечения развития (личного, духовного) и расширения сознания за пределы эгоцентризма.",
      "Отвергает трудовую теорию стоимости (оплата за отработанные часы), утверждая, что доход коррелирует с созданной ценностью: значимостью решенных проблем и достигнутыми результатами.",
      "Предпринимательство представлено как путь к этичному созданию и использованию денег для достижения цели (предназначения), создавая ценность независимо от того, как может эволюционировать форма \"денег\".",
    ],
    imageUrlEn: `${STORAGE_BASE_URL}/pp04en.png`,
    imageUrlRu: `${STORAGE_BASE_URL}/pp04ru.png`,
    imageAltEn: "Infographic: Money as a Neutral Tool vs Demonized Concept",
    imageAltRu: "Инфографика: Деньги как Нейтральный Инструмент против Демонизации",
    tooltipRu: "Визуализация денег как нейтрального инструмента для достижения целей в противовес их демонизации.",
  },
  {
    id: "generalism", // Chapter 5
    icon: FaBrain,
    titleEn: "Deep Generalism",
    titleRu: "Глубокий Генерализм",
    pointsEn: [
      "Humans are naturally creators and deep generalists, capable of mastering multiple domains, unlike specialists who become like tools susceptible to replacement.",
      "Criticizes the traditional education system (based on the Prussian model) for producing compliant specialists and hindering adaptability, creativity, and agency.",
      "True education is about discovery, learning how to learn, adapting, and applying tools across different situations.",
      "Advocates for cultivating \"self-governance\" – traits like self-experimentation, self-awareness, self-reliance, and self-mastery – to navigate the future effectively.",
      "Argues that self-actualization (solving your own problems first) is a necessary prerequisite for genuinely contributing to others (solving their problems).",
    ],
    pointsRu: [
      "Люди по своей природе являются творцами и глубокими универсалами (генералистами), способными осваивать множество областей, в отличие от специалистов, которые становятся подобны инструментам, уязвимым для замены.",
      "Критикует традиционную систему образования (основанную на прусской модели) за производство послушных специалистов и подавление адаптивности, креативности и самостоятельности.",
      "Истинное образование – это открытие, обучение тому, как учиться, адаптация и применение инструментов в различных ситуациях.",
      "Призывает развивать \"самоуправление\" – качества, такие как самоэкспериментирование, самосознание, самодостаточность и самомастерство – для эффективной навигации в будущем.",
      "Утверждает, что самоактуализация (решение сначала собственных проблем) является необходимой предпосылкой для подлинного вклада в других (решение их проблем).",
    ],
    imageUrlEn: `${STORAGE_BASE_URL}/pp05en.png`,
    imageUrlRu: `${STORAGE_BASE_URL}/pp05ru.png`,
    imageAltEn: "Infographic: T-shaped Generalist vs I-shaped Specialist",
    imageAltRu: "Инфографика: T-образный Генералист против I-образного Специалиста",
    tooltipRu: "Сравнение 'I'-образного специалиста (уязвимость) и 'T'-образного генералиста (адаптивность).",
  },
  {
    id: "purpose_levels", // Chapter 6
    icon: FaLayerGroup,
    titleEn: "Levels of Purpose",
    titleRu: "Уровни Цели / Предназначения",
    pointsEn: [
      "Purpose stems from understanding reality as interconnected (Kosmos, holons) and progressing through levels of development (expanding circles of care).",
      "Problems are limits on potential; solving them drives growth, complexity, and higher levels of purpose.",
      "Identifies four main levels of purpose, often reflected in one's relationship with work and money: Survival, Status, Creativity, and Contribution.",
      "Each level involves overcoming specific problems and mindsets, moving from basic needs and external validation towards self-directed creation, mastery, and ultimately contributing value back to the world.",
      "Entrepreneurship is presented as a path that can facilitate development through all these levels.",
    ],
    pointsRu: [
      "Цель (предназначение) проистекает из понимания реальности как взаимосвязанной (Космос, холоны) и продвижения через уровни развития (расширяющиеся круги заботы).",
      "Проблемы – это ограничения потенциала; их решение стимулирует рост, усложнение и достижение более высоких уровней цели (предназначения).",
      "Выделяет четыре основных уровня цели (предназначения), часто отражающихся в отношении человека к работе и деньгам: Выживание, Статус, Креативность и Вклад (Содействие).",
      "Каждый уровень включает преодоление специфических проблем и установок, двигаясь от базовых потребностей и внешней валидации к самостоятельному творчеству, мастерству и, в конечном счете, возвращению ценности миру.",
      "Предпринимательство представлено как путь, который может способствовать развитию на всех этих уровнях.",
    ],
    imageUrlEn: `${STORAGE_BASE_URL}/pp06en.png`,
    imageUrlRu: `${STORAGE_BASE_URL}/pp06ru.png`,
    imageAltEn: "Infographic: Concentric Circles of Purpose Levels",
    imageAltRu: "Инфографика: Концентрические Круги Уровней Цели",
    tooltipRu: "Визуализация четырех уровней цели/предназначения в виде концентрических кругов.",
  },
  {
    id: "progress_knowledge", // Chapter 7
    icon: FaMagnifyingGlassChart,
    titleEn: "Progress and Knowledge",
    titleRu: "Прогресс и Знание",
    pointsEn: [
      "Progress requires acquiring knowledge, which is created through a process of trial and error (conjecture and criticism), akin to cybernetic feedback loops.",
      "Humans are \"universal explainers\" capable of understanding anything understandable and creating infinite knowledge; technology (like AI) extends this capability.",
      "Problems are infinite but soluble, and actively engaging with them (especially those just beyond current skill level) prevents entropy (descent into chaos) and generates purpose and flow.",
      "Progress follows a cycle (\"Nature's Compass\"): feeling lost, becoming interested in solving a problem, and then becoming obsessed with the process, leading to deeper understanding and new challenges.",
      "This requires constant experimentation (inward, outward, deep-diving, and iterating upwards) to navigate the unknown and build one's life's work.",
    ],
    pointsRu: [
      "Прогресс требует приобретения знаний, которые создаются через процесс проб и ошибок (гипотезы и критика), подобно кибернетическим петлям обратной связи.",
      "Люди – \"универсальные объяснители\", способные понять все постижимое и создавать бесконечное знание; технологии (подобные ИИ) расширяют эту способность.",
      "Проблемы бесконечны, но разрешимы, и активное взаимодействие с ними (особенно с теми, что немного превосходят текущий уровень навыков) предотвращает энтропию (скатывание в хаос) и порождает цель (предназначение) и состояние потока.",
      "Прогресс следует циклу (\"Компас Природы\"): чувство потерянности, появление интереса к решению проблемы, а затем одержимость процессом, ведущая к более глубокому пониманию и новым вызовам.",
      "Это требует постоянного экспериментирования (внутреннего, внешнего, глубокого погружения и итеративного движения вверх) для навигации в неизвестном и построения дела своей жизни.",
    ],
    imageUrlEn: `${STORAGE_BASE_URL}/pp07en.png`,
    imageUrlRu: `${STORAGE_BASE_URL}/pp07ru.png`,
    imageAltEn: "Infographic: Cycle of Progress - Nature's Compass",
    imageAltRu: "Инфографика: Цикл Прогресса - Компас Природы",
    tooltipRu: "Циклическая диаграмма 'Компаса Природы', иллюстрирующая процесс прогресса и создания знаний.",
  },
  {
    id: "lifes_work", // Chapter 8
    icon: FaMapLocation,
    titleEn: "Your Life's Work",
    titleRu: "Дело Вашей Жизни",
    pointsEn: [
      "Your life's work is about reaching your potential, integrating purpose and profit (\"getting paid to be yourself\"), and becoming a source of value for others.",
      "It's not a fixed destination but a direction (\"which way do I go?\") discovered through continuous effort and course correction.",
      "Instead of searching for a predefined \"work,\" create an evolving personal plan or blueprint to navigate towards your potential and avoid undesired outcomes (entropy).",
      "Key components of this plan include: Anti-Vision (what to avoid), Vision (desired future), Mission (the path), Standards (conscious values), Goals (milestones), Projects (actions), Constraints (focusing creativity), Levers (priority actions), Challenge (engagement), and Curiosity (learning).",
    ],
    pointsRu: [
      "Дело вашей жизни – это раскрытие вашего потенциала, интеграция цели (предназначения) и прибыли (\"получать плату за то, чтобы быть собой\") и становление источником ценности для других.",
      "Это не фиксированный пункт назначения, а направление (\"каким путем мне идти?\"), открываемое через постоянные усилия и корректировку курса.",
      "Вместо поиска предопределенной \"работы\", создайте развивающийся личный план или \"чертеж\" для навигации к своему потенциалу и избежания нежелательных исходов (энтропии).",
      "Ключевые компоненты этого плана включают: Анти-видение (чего избегать), Видение (желаемое будущее), Миссию (путь), Стандарты (осознанные ценности), Цели (вехи), Проекты (действия), Ограничения (фокусировка креативности), Рычаги (приоритетные действия), Вызов (вовлеченность) и Любопытство (обучение).",
    ],
    imageUrlEn: `${STORAGE_BASE_URL}/pp08en.png`,
    imageUrlRu: `${STORAGE_BASE_URL}/pp08ru.png`,
    imageAltEn: "Infographic: Personal Blueprint Components for Life's Work",
    imageAltRu: "Инфографика: Компоненты Личного Плана для Дела Жизни",
    tooltipRu: "Майнд-карта или чертеж, показывающий ключевые компоненты личного плана для навигации к 'Делу Вашей Жизни'.",
  },
  {
    id: "value_creation", // Chapter 9
    icon: FaHandHoldingDollar,
    titleEn: "Value Creation",
    titleRu: "Создание Ценности",
    pointsEn: [
      "Technology (Internet, AI) democratizes creation, shifting the challenge from *making* things to *making people care* about them.",
      "Creating value requires ethical persuasion and using media (especially online) to build an audience and connect with the right people.",
      "Value is perceptual; to make your creations valuable, you must shape perception by clearly answering: Who you help, What problem you solve, Where you help them get to, When they can expect results, and Why they should care (pains/benefits).",
      "The solution you offer is your unique *process* for solving that problem, often discovered through self-experimentation (tying into Self-Monetization).",
    ],
    pointsRu: [
      "Технологии (Интернет, ИИ) демократизируют создание, смещая вызов от *создания* вещей к *пробуждению интереса* к ним у людей.",
      "Создание ценности требует этичного убеждения и использования медиа (особенно онлайн) для построения аудитории и связи с нужными людьми.",
      "Ценность субъективна (основана на восприятии); чтобы сделать ваши творения ценными, вы должны формировать восприятие, четко отвечая: Кому вы помогаете, Какую проблему решаете, Куда вы помогаете им прийти, Когда они могут ожидать результатов и Почему им это должно быть важно (боли/выгоды).",
      "Решение, которое вы предлагаете, – это ваш уникальный *процесс* решения этой проблемы, часто открытый через самоэкспериментирование (связь с Самомонетизацией).",
    ],
    imageUrlEn: `${STORAGE_BASE_URL}/pp09en.png`,
    imageUrlRu: `${STORAGE_BASE_URL}/pp09ru.png`,
    imageAltEn: "Infographic: Shaping Value Perception Questions",
    imageAltRu: "Инфографика: Вопросы для Формирования Восприятия Ценности",
    tooltipRu: "Инфографика, иллюстрирующая, что ценность субъективна и формируется путем ответа на ключевые вопросы.",
  },
  {
    id: "meta_skill", // Chapter 10
    icon: FaKeyboard,
    titleEn: "The Meta Skill",
    titleRu: "Мета-Навык",
    pointsEn: [
      "Information is the foundation of progress and the \"code\" for our mental operating system; its accessibility has evolved dramatically (culminating in the internet).",
      "Writing is identified as the fundamental \"meta-skill\" for the modern era because it clarifies thinking, solidifies learning, and enables earning.",
      "Writing in public creates a feedback loop for improvement and inadvertently teaches related skills (psychology, marketing, persuasion).",
      "In an age of AI, human value lies in vision, taste, coherence, and storytelling – all practiced and conveyed through writing.",
      "Writing is accessible, foundational to other media (and even code via natural language), and provides permissionless leverage; it's the key to future-proofing oneself.",
    ],
    pointsRu: [
      "Информация – это основа прогресса и \"код\" для нашей ментальной операционной системы; ее доступность кардинально эволюционировала (кульминацией стал интернет).",
      "Письмо определяется как фундаментальный \"мета-навык\" для современной эры, поскольку оно проясняет мышление, закрепляет обучение и позволяет зарабатывать.",
      "Письмо \"в публичном пространстве\" создает петлю обратной связи для улучшения и непреднамеренно обучает смежным навыкам (психологии, маркетингу, убеждению).",
      "В эпоху ИИ ценность человека заключается в видении, вкусе, связности и сторителлинге – все это практикуется и передается через письмо.",
      "Письмо доступно, является основой для других медиа (и даже кода через естественный язык) и предоставляет рычаги воздействия без необходимости разрешения; это ключ к обеспечению своей актуальности в будущем.",
    ],
    imageUrlEn: `${STORAGE_BASE_URL}/pp10en.png`,
    imageUrlRu: `${STORAGE_BASE_URL}/pp10ru.png`,
    imageAltEn: "Infographic: Writing as the Core Meta-Skill",
    imageAltRu: "Инфографика: Письмо как Ключевой Мета-Навык",
    tooltipRu: "Визуализация письма как центрального мета-навыка, соединяющего ясное мышление, обучение, заработок и развитие ключевых качеств.",
  },
  {
    id: "self_monetization", // Chapter 11
    icon: FaBullseye,
    titleEn: "Self-Monetization",
    titleRu: "Самомонетизация",
    pointsEn: [
      "To control your income and life, you must create and sell a \"product\" (value offering).",
      "Rejects the traditional advice to \"choose a niche\" as static and limiting; instead, advocates \"You *are* the niche.\"",
      "Self-Monetization involves solving your own problems through self-experimentation and then packaging and selling that solution to others like you (your authentic niche).",
      "This leverages your unique experience and perspective, creating value that is difficult to replicate and fosters both self-improvement and other-improvement.",
      "This model enables one-person (or small) businesses with high leverage and can apply to info products, physical goods, or services, positioning creators as orchestrators of tools and resources.",
    ],
    pointsRu: [
      "Чтобы контролировать свой доход и жизнь, вы должны создавать и продавать \"продукт\" (ценностное предложение).",
      "Отвергает традиционный совет \"выбрать нишу\" как статичный и ограничивающий; вместо этого продвигает идею \"Ты *и есть* ниша\".",
      "Самомонетизация включает решение собственных проблем через самоэкспериментирование, а затем упаковку и продажу этого решения другим, похожим на вас (ваша аутентичная ниша).",
      "Это использует ваш уникальный опыт и точку зрения, создавая ценность, которую трудно скопировать, и способствует как самосовершенствованию, так и совершенствованию других.",
      "Эта модель позволяет создавать бизнесы одного человека (или небольшие) с высоким рычагом воздействия и может применяться к инфопродуктам, физическим товарам или услугам, позиционируя создателей как организаторов (\"оркестраторов\") инструментов и ресурсов.",
    ],
    imageUrlEn: `${STORAGE_BASE_URL}/pp11en.png`,
    imageUrlRu: `${STORAGE_BASE_URL}/pp11ru.png`,
    imageAltEn: "Infographic: 'You are the Niche' Self-Monetization Model",
    imageAltRu: "Инфографика: Модель Самомонетизации 'Ты - это Ниша'",
    tooltipRu: "Диаграмма цикла самомонетизации: решение собственных проблем -> упаковка решения -> предложение аутентичной нише.",
  },
  {
    id: "creator", // Chapter 12
    icon: FaPaintbrush,
    titleEn: "Become a Creator",
    titleRu: "Станьте Творцом",
    pointsEn: [
      "Humans have taken on the role of creators, transforming the world, but many have lost this inherent nature by becoming passive employees instead of active entrepreneurs/generalists.",
      "The fundamental path forward, regardless of technological change, is to embrace creativity by becoming a creator – someone who identifies problems, explores solutions, creates value, and shares it, finding the intersection of purpose and profit.",
      "We are in a \"Second Renaissance\" driven by the internet, where creators are becoming the new sense-makers and forming a decentralized education system and economy.",
      "The key to future-proofing is shifting from a consumer mindset to a creator mindset: solve your own problems, publish the solutions, build an audience, and become a generalist who orchestrates ideas and tools.",
    ],
    pointsRu: [
      "Люди взяли на себя роль творцов, преобразуя мир, но многие утратили эту врожденную природу, став пассивными наемными работниками вместо активных предпринимателей/универсалов.",
      "Фундаментальный путь вперед, независимо от технологических изменений, – это принять креативность, став творцом – тем, кто выявляет проблемы, исследует решения, создает ценность и делится ею, находя пересечение цели (предназначения) и прибыли.",
      "Мы находимся во \"Втором Ренессансе\", движимом интернетом, где творцы становятся новыми создателями смыслов и формируют децентрализованную систему образования и экономику.",
      "Ключ к обеспечению актуальности в будущем – это переход от мышления потребителя к мышлению творца: решайте собственные проблемы, публикуйте решения, стройте аудиторию и становитесь универсалом, который организует (\"оркестрирует\") идеи и инструменты.",
    ],
    imageUrlEn: `${STORAGE_BASE_URL}/pp12en.png`,
    imageUrlRu: `${STORAGE_BASE_URL}/pp12ru.png`,
    imageAltEn: "Infographic: Shifting from Consumer to Creator Mindset",
    imageAltRu: "Инфографика: Переход от Мышления Потребителя к Мышлению Творца",
    tooltipRu: "Сравнение пассивного потребителя и активного творца. Призыв к созданию, решению проблем и построению аудитории.",
  },
  {
    id: "author", // Chapter 13
    icon: FaCircleUser,
    titleEn: "About the Author",
    titleRu: "Об Авторе",
    pointsEn: [
      "Call to action: Leave review, visit website (thedankoe.com), check previous book \"The Art of Focus\".",
    ],
    pointsRu: [
      "Призыв к действию: Оставить отзыв, посетить веб-сайт (thedankoe.com), ознакомиться с книгой \"The Art of Focus\".",
    ],
    imageUrlEn: null,
    imageUrlRu: null,
    imageAltEn: "",
    imageAltRu: "",
    tooltipRu: "",
  },
];


// --- Component ---
export default function PurposeProfitPage() {
  const { user } = useAppContext();
  const [isMounted, setIsMounted] = useState(false);
  const [selectedLang, setSelectedLang] = useState<Language>('ru');

  useEffect(() => {
    setIsMounted(true);
    const browserLang = typeof navigator !== 'undefined' ? navigator.language.split('-')[0] : 'ru';
    const telegramLang = user?.language_code;
    const initialLang = telegramLang === 'ru' || (!telegramLang && browserLang === 'ru') ? 'ru' : 'en';
    setSelectedLang(initialLang);
    debugLogger.log(`[PurposeProfitPage] Mounted. Browser lang: ${browserLang}, TG lang: ${telegramLang}, Initial selected: ${initialLang}`);
  }, [user]);

  if (!isMounted) {
    return (
      <div className="flex justify-center items-center min-h-screen pt-20 bg-gradient-to-br from-gray-900 via-black to-gray-800">
        <p className="text-brand-green animate-pulse text-xl font-mono">Загрузка мудрости Purpose & Profit...</p>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen overflow-hidden pt-20 pb-10 bg-gradient-to-br from-gray-900 via-black to-gray-800 text-gray-200">
      {/* .. Subtle Background Grid */}
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
              {/* .. Language Toggle */}
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
                        "border-brand-blue/50",
                        selectedLang === 'en' ? 'bg-brand-blue/20 text-brand-blue hover:bg-brand-blue/30' : 'text-gray-400 hover:bg-gray-800 hover:text-gray-200'
                     )}
                  >
                    🇬🇧 English
                  </Button>
              </div>

              {/* .. Chapters */}
              {chapters.map((chapter, index) => {
                const IconComponent = chapter.icon;
                const themeColor = ["text-brand-pink", "text-brand-blue", "text-neon-lime", "text-brand-orange", "text-brand-cyan", "text-brand-yellow", "text-brand-purple", "text-brand-green"][index % 8];
                const borderColor = themeColor.replace("text-", "border-");
                const currentTitle = selectedLang === 'en' ? chapter.titleEn : chapter.titleRu;
                const currentPoints = selectedLang === 'en' ? chapter.pointsEn : chapter.pointsRu;
                const currentImageAlt = selectedLang === 'en' ? chapter.imageAltEn : chapter.imageAltRu;
                const currentImageUrl = selectedLang === 'en' ? chapter.imageUrlEn : chapter.imageUrlRu;

                // Skip rendering if no points or image for the chapter (e.g., Author section without image)
                if (currentPoints.length === 0 && !currentImageUrl) return null;

                return (
                  <section key={chapter.id} className={`space-y-4 border-l-4 pl-4 md:pl-6 ${borderColor}`}>
                    {/* .. Title */}
                    <h2 className={`flex items-center text-2xl md:text-3xl font-semibold ${themeColor} mb-4`}>
                      <IconComponent className={`mr-3 ${themeColor}/80`} /> {currentTitle}
                    </h2>

                    {/* .. Points for selected language (only if they exist) */}
                    {currentPoints.length > 0 && (
                        <ul className="list-disc list-outside space-y-2 text-gray-300 pl-5 text-base md:text-lg leading-relaxed">
                        {currentPoints.map((point, i) => (
                            <li key={`${selectedLang}-${chapter.id}-${i}`}>{point}</li>
                        ))}
                        </ul>
                    )}


                    {/* .. Image Placeholder & Tooltip */}
                    {currentImageUrl && (
                      <div className={`my-6 p-2 border ${borderColor}/30 rounded-lg bg-black/30 max-w-md mx-auto`}>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <div className="aspect-video w-full h-auto overflow-hidden rounded-md bg-gray-800/50 cursor-help relative">
                              <Image
                                src={currentImageUrl}
                                alt={currentImageAlt}
                                width={600} height={338}
                                className="w-full h-full object-cover opacity-90 hover:opacity-100 transition-opacity duration-300"
                                loading="lazy"
                                placeholder="blur" // Enable blur placeholder
                                blurDataURL={PLACEHOLDER_BLUR_URL} // Use generic blur URL
                                onError={(e) => {
                                    debugLogger.error(`Failed to load image: ${currentImageUrl}`);
                                    // Simple fallback: hide the broken image element
                                    e.currentTarget.style.display = 'none';
                                    // Optionally, could show a placeholder text/icon here instead
                                }}
                              />
                            </div>
                          </TooltipTrigger>
                          {/* .. Only show Russian tooltip if RU is selected */}
                          {selectedLang === 'ru' && chapter.tooltipRu && (
                            <TooltipContent side="bottom" className={`max-w-[300px] text-center bg-gray-950 ${borderColor}/60 text-white p-3 shadow-lg border`}>
                              <p className="text-sm whitespace-pre-wrap">{chapter.tooltipRu}</p>
                            </TooltipContent>
                          )}
                        </Tooltip>
                        {/* .. Dynamic Image Caption */}
                        <p className="text-xs text-center text-gray-400 mt-1 italic">{currentImageAlt}</p>
                      </div>
                    )}
                    {/* .. Optional separator */}
                    {/* <hr className={`${borderColor}/20 my-6`} /> */}
                  </section>
                );
              })}

              {/* .. Concluding section */}
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
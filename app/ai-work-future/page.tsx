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
} from "@/components/ui/tooltip"; // Added Tooltip components

import {
  FaBrain, FaTriangleExclamation, FaChartLine, FaScaleBalanced, FaBriefcase,
  FaToolbox, FaUsers, FaUserGear, FaCubes, FaUserGraduate, FaBullseye, // FaTools -> FaToolbox, FaBalanceScale -> FaScaleBalanced, FaExclamationTriangle -> FaTriangleExclamation, FaUserCog -> FaUserGear
  FaLightbulb, FaRoad, FaNetworkWired, FaComments, FaRecycle, FaUsersCog,
  FaDiagramProject, FaHistory, FaQuestionCircle, FaWind, FaGamepad // FaProjectDiagram -> FaDiagramProject, Added FaGamepad for link
} from "react-icons/fa6"; // Using FontAwesome 6 icons

import { debugLogger } from "@/lib/debugLogger";
import Image from "next/image";
import Link from "next/link";
import { cn } from "@/lib/utils";

type Language = 'en' | 'ru';

// .. Placeholder for image URLs - replace with actual URLs if available
const STORAGE_BASE_URL_AIWORK = "https://placehold.co"; // Placeholder URL base

const PLACEHOLDER_BLUR_URL = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII="; // Tiny transparent png

// --- Section Data (Generated from Transcript with CORRECTED Icons) ---
const sections = [
  {
    id: "intro-threat",
    icon: FaTriangleExclamation, // Corrected Icon
    titleEn: "AI Risk vs. Leadership & Systems",
    titleRu: "Риск ИИ против Лидерства и Систем",
    pointsEn: [
      "People often see AI as the main threat because it visibly automates tasks, potentially reducing individual value.",
      "However, <strong class='font-semibold text-brand-pink'>poor leadership, adherence to old systems, and rigid mindsets</strong> are bigger risks to organizations.",
      "Applying old metrics and processes to new tech doesn't work and leads to organizational demise.",
      "Leaders fixed on past methods fail to adapt to the <strong class='font-semibold text-brand-pink'>new paradigm</strong> AI introduces.",
    ],
    pointsRu: [
      "Люди часто видят ИИ как главную угрозу, потому что он заметно автоматизирует задачи, потенциально снижая ценность индивида.",
      "Однако <strong class='font-semibold text-brand-pink'>плохое лидерство, приверженность старым системам и ригидное мышление</strong> представляют больший риск для организаций.",
      "Применение старых метрик и процессов к новым технологиям не работает и ведет к упадку организации.",
      "Лидеры, зацикленные на прошлых методах, не могут адаптироваться к <strong class='font-semibold text-brand-pink'>новой парадигме</strong>, которую вводит ИИ.",
    ],
    imageUrlEn: `${STORAGE_BASE_URL_AIWORK}/600x338/1a1a2e/FF007A/png?text=Old+Systems+vs+AI`,
    imageUrlRu: `${STORAGE_BASE_URL_AIWORK}/600x338/1a1a2e/FF007A/png?text=Старые+Системы+против+ИИ`,
    imageAltEn: "Conceptual image: A rigid old gear grinding against a fluid AI network",
    imageAltRu: "Концептуальное изображение: Жесткая старая шестерня, скрежещущая о гибкую сеть ИИ",
    tooltipRu: "Не ИИ сам по себе, а неспособность лидеров и систем адаптироваться - вот главная угроза.",
  },
  {
    id: "efficiency-trap",
    icon: FaScaleBalanced, // Corrected Icon
    titleEn: "The Efficiency Trap",
    titleRu: "Ловушка Эффективности",
    pointsEn: [
      "Focusing solely on efficiency (often code for layoffs) is <strong class='font-semibold text-brand-orange'>shortsighted</strong>.",
      "AI doesn't just scale individual efficiency; it changes the <strong class='font-semibold text-brand-orange'>fundamental boundaries</strong> of jobs and tasks.",
      "Work is shifting from defined job roles to skill-based and task-based approaches.",
      "AI allows access to adjacent skills, pressuring traditional role boundaries.",
      "Organizations are often too <strong class='font-semibold text-brand-orange'>rigid</strong> to harness the fluidity and new capabilities AI enables.",
    ],
    pointsRu: [
      "Фокусировка исключительно на эффективности (часто синоним увольнений) <strong class='font-semibold text-brand-orange'>недальновидна</strong>.",
      "ИИ не просто масштабирует индивидуальную эффективность; он меняет <strong class='font-semibold text-brand-orange'>фундаментальные границы</strong> должностей и задач.",
      "Работа смещается от определенных должностных ролей к подходам, основанным на навыках и задачах.",
      "ИИ открывает доступ к смежным навыкам, оказывая давление на традиционные границы ролей.",
      "Организации часто слишком <strong class='font-semibold text-brand-orange'>негибки</strong>, чтобы использовать текучесть и новые возможности, предоставляемые ИИ.",
    ],
    imageUrlEn: `${STORAGE_BASE_URL_AIWORK}/600x338/1a1a2e/FF6B00/png?text=Efficiency+vs+Adaptability`,
    imageUrlRu: `${STORAGE_BASE_URL_AIWORK}/600x338/1a1a2e/FF6B00/png?text=Эффективность+против+Адаптивности`,
    imageAltEn: "Illustration: A straight, narrow path (efficiency) diverging from a winding, adaptive path (new possibilities)",
    imageAltRu: "Иллюстрация: Прямой, узкий путь (эффективность), расходящийся с извилистым, адаптивным путем (новые возможности)",
    tooltipRu: "Погоня только за эффективностью мешает увидеть, как ИИ фундаментально меняет саму природу работы.",
  },
  {
    id: "leadership-approach",
    icon: FaBrain, // OK
    titleEn: "New Leadership Approach Needed",
    titleRu: "Необходим Новый Подход к Лидерству",
    pointsEn: [
      "Leaders need <strong class='font-semibold text-neon-lime'>experiential learning</strong> with AI, not just theoretical knowledge.",
      "Reading articles or basic ChatGPT use isn't enough to lead transformation.",
      "Effective programs involve using AI tools (like Copilot, integrated APIs) to solve real organizational problems <strong class='font-semibold text-neon-lime'>collaboratively</strong>.",
      "Focus should shift from long consulting decks/seminars to <strong class='font-semibold text-neon-lime'>learning by doing</strong>.",
      "Goal: Achieve <strong class='font-semibold text-neon-lime'>alignment</strong> (not just agreement) on AI vision, maturity, and roadmap quickly, using AI itself.",
      "Condensed, facilitated sessions using AI can achieve in hours what used to take weeks/months.",
    ],
    pointsRu: [
      "Лидерам необходимо <strong class='font-semibold text-neon-lime'>обучение через опыт</strong> с ИИ, а не только теоретические знания.",
      "Чтения статей или базового использования ChatGPT недостаточно для руководства трансформацией.",
      "Эффективные программы включают использование инструментов ИИ (Copilot, интегрированные API) для <strong class='font-semibold text-neon-lime'>совместного</strong> решения реальных организационных проблем.",
      "Фокус должен сместиться с длинных консультационных презентаций/семинаров на <strong class='font-semibold text-neon-lime'>обучение в процессе делания</strong>.",
      "Цель: Достичь <strong class='font-semibold text-neon-lime'>согласованности</strong> (а не просто согласия) по видению ИИ, зрелости и дорожной карте быстро, используя сам ИИ.",
      "Сжатые, фасилитируемые сессии с использованием ИИ могут достичь за часы того, что раньше занимало недели/месяцы.",
    ],
    imageUrlEn: `${STORAGE_BASE_URL_AIWORK}/600x338/1a1a2e/AEFF00/png?text=Experiential+AI+Learning`,
    imageUrlRu: `${STORAGE_BASE_URL_AIWORK}/600x338/1a1a2e/AEFF00/png?text=Опытное+ИИ+Обучение`,
    imageAltEn: "Diagram: Cycle of Learn -> Apply AI -> Align -> Strategize, happening rapidly",
    imageAltRu: "Диаграмма: Цикл Изучай -> Применяй ИИ -> Согласовывай -> Разрабатывай стратегию, происходящий быстро",
    tooltipRu: "Лидерам нужно не просто знать об ИИ, а использовать его на практике для выработки стратегии и достижения единства.",
  },
  {
    id: "tools-implementation",
    icon: FaToolbox, // Corrected Icon (Replaced FaTools)
    titleEn: "Beyond Basic Tools: Integration & Adoption",
    titleRu: "Больше Чем Базовые Инструменты: Интеграция и Внедрение",
    pointsEn: [
      "Basic chatbots (ChatGPT, Copilot) are just the <strong class='font-semibold text-brand-blue'>starting point</strong> (getting socks on).",
      "Enterprise success involves weaving AI into <strong class='font-semibold text-brand-blue'>basic infrastructure</strong> and workflows.",
      "Simply providing tools isn't enough; usage often crashes after initial excitement due to lack of training, context, and integration into overloaded workflows.",
      "Effective adoption requires clear relevance to individuals ('How does this change *my* life?'), robust training, and infrastructure support.",
      "AI implementation is not just IT; it's an <strong class='font-semibold text-brand-blue'>HR, Strategy, Finance issue requiring C-suite lockstep</strong>.",
      "Push use case identification <strong class='font-semibold text-brand-blue'>down and out</strong> to those doing the work.",
    ],
    pointsRu: [
      "Базовые чат-боты (ChatGPT, Copilot) – это лишь <strong class='font-semibold text-brand-blue'>отправная точка</strong> (надевание носков).",
      "Успех на уровне предприятия включает вплетение ИИ в <strong class='font-semibold text-brand-blue'>базовую инфраструктуру</strong> и рабочие процессы.",
      "Просто предоставить инструменты недостаточно; использование часто падает после первоначального восторга из-за отсутствия обучения, контекста и интеграции в перегруженные рабочие процессы.",
      "Эффективное внедрение требует четкой релевантности для индивидов ('Как это изменит *мою* жизнь?'), надежного обучения и поддержки инфраструктуры.",
      "Внедрение ИИ – это не только IT; это <strong class='font-semibold text-brand-blue'>вопрос HR, Стратегии, Финансов, требующий единства высшего руководства</strong>.",
      "Смещайте идентификацию сценариев использования <strong class='font-semibold text-brand-blue'>вниз и вовне</strong> – к тем, кто выполняет работу.",
    ],
    imageUrlEn: `${STORAGE_BASE_URL_AIWORK}/600x338/1a1a2e/00C2FF/png?text=AI+Integration+Web`,
    imageUrlRu: `${STORAGE_BASE_URL_AIWORK}/600x338/1a1a2e/00C2FF/png?text=Паутина+ИИ+Интеграции`,
    imageAltEn: "Network diagram showing AI tools connecting deeply into various company departments and workflows",
    imageAltRu: "Сетевая диаграмма, показывающая, как инструменты ИИ глубоко соединяются с различными отделами и рабочими процессами компании",
    tooltipRu: "Успешное внедрение ИИ требует глубокой интеграции в процессы и культуру, а не просто раздачи инструментов.",
  },
   {
    id: "jobs-vs-work",
    icon: FaBriefcase, // OK
    titleEn: "Jobs are Dead, Long Live Work",
    titleRu: "Должности Мертвы, Да Здравствует Работа",
    pointsEn: [
      "The idea isn't necessarily mass job loss, but the loss of rigid <strong class='font-semibold text-brand-green'>job descriptions</strong> and boundaries.",
      "Some specific jobs *will* be lost, causing pain, but individuals won't become permanently irrelevant.",
      "AI abstracts the need for years of experience for proficiency in adjacent skills ('good enough is good enough').",
      "This shifts focus from <strong class='font-semibold text-brand-green'>role-based relationships to skill-based and task-based relationships</strong>.",
      "We need to focus on the necessary 'work' of the future, not cling to outdated 'job' structures.",
      "The 'Creative Generalist' who can leverage AI across domains becomes more valuable than the narrow specialist.",
    ],
    pointsRu: [
      "Идея не обязательно в массовой потере рабочих мест, а в потере жестких <strong class='font-semibold text-brand-green'>должностных инструкций</strong> и границ.",
      "Некоторые конкретные должности *будут* потеряны, причиняя боль, но люди не станут навсегда нерелевантными.",
      "ИИ абстрагирует необходимость многолетнего опыта для достижения достаточного уровня в смежных навыках ('достаточно хорошо - это достаточно хорошо').",
      "Это смещает фокус с <strong class='font-semibold text-brand-green'>отношений, основанных на роли, на отношения, основанные на навыках и задачах</strong>.",
      "Нам нужно сосредоточиться на необходимой 'работе' будущего, а не цепляться за устаревшие 'должностные' структуры.",
      "'Креативный Генералист', способный использовать ИИ в разных областях, становится ценнее узкого специалиста.",
    ],
    imageUrlEn: `${STORAGE_BASE_URL_AIWORK}/600x338/1a1a2e/00FF9D/png?text=Skills+Over+Roles`,
    imageUrlRu: `${STORAGE_BASE_URL_AIWORK}/600x338/1a1a2e/00FF9D/png?text=Навыки+Важнее+Ролей`,
    imageAltEn: "Illustration: Rigid job boxes dissolving into a fluid network of skills and tasks",
    imageAltRu: "Иллюстрация: Жесткие рамки должностей растворяются в гибкой сети навыков и задач",
    tooltipRu: "ИИ размывает границы должностей. Фокус смещается на гибкие навыки и выполняемую работу, а не на статичные описания.",
  },
  {
    id: "risk-levels",
    icon: FaUsers, // OK
    titleEn: "Who's Most at Risk?",
    titleRu: "Кто в Наибольшей Зоне Риска?",
    pointsEn: [
      "<strong class='font-semibold text-brand-purple'>Junior roles</strong> are currently at high risk as AI can replace entry-level tasks and the traditional 'apprenticeship' model weakens.",
      "Juniors lack the experience/frameworks to effectively leverage AI for complex tasks without guidance.",
      "<strong class='font-semibold text-brand-purple'>Middle management</strong> focused on operational efficiency, alignment checks, and basic supervision ('boss' tasks) is also directly threatened.",
      "AI can automate facilitation, progress tracking, and reduce the need for alignment meetings.",
      "This may flatten organizations, creating more direct contact between leadership and execution, emphasizing <strong class='font-semibold text-brand-purple'>true leadership over 'boss' functions</strong>.",
    ],
    pointsRu: [
      "<strong class='font-semibold text-brand-purple'>Начальные позиции</strong> в настоящее время подвержены высокому риску, поскольку ИИ может заменить задачи начального уровня, а традиционная модель 'ученичества' ослабевает.",
      "Новичкам не хватает опыта/фреймворков для эффективного использования ИИ для сложных задач без руководства.",
      "<strong class='font-semibold text-brand-purple'>Среднее звено управления</strong>, сосредоточенное на операционной эффективности, проверке согласованности и базовом надзоре (задачи 'босса'), также находится под прямой угрозой.",
      "ИИ может автоматизировать фасилитацию, отслеживание прогресса и снизить потребность в совещаниях по согласованию.",
      "Это может сделать организации более 'плоскими', создавая более прямой контакт между руководством и исполнителями, подчеркивая <strong class='font-semibold text-brand-purple'>истинное лидерство над функциями 'босса'</strong>.",
    ],
    imageUrlEn: `${STORAGE_BASE_URL_AIWORK}/600x338/1a1a2e/9D00FF/png?text=Junior+&+Middle+Management+Risk`,
    imageUrlRu: `${STORAGE_BASE_URL_AIWORK}/600x338/1a1a2e/9D00FF/png?text=Риск+для+Новичков+и+Середины`,
    imageAltEn: "Diagram showing AI pressure impacting lower and middle layers of a traditional hierarchy",
    imageAltRu: "Диаграмма, показывающая давление ИИ, влияющее на нижние и средние уровни традиционной иерархии",
    tooltipRu: "Наибольшему риску автоматизации подвержены начальные роли и функции операционного менеджмента.",
  },
  {
    id: "augmented-teams",
    icon: FaUserGear, // Corrected Icon
    titleEn: "Augmented Teams & Digital Twins",
    titleRu: "Дополненные Команды и Цифровые Двойники",
    pointsEn: [
      "Augmentation starts with learning tools, but progresses to <strong class='font-semibold text-brand-pink'>encoding individual and team knowledge</strong>.",
      "Creating 'digital twins' by training models on personal/team briefs, emails, content creates filters for prompting and output (style, tone, strategic understanding).",
      "This significantly expands capabilities and reduces friction (e.g., onboarding, addressing brain drain).",
      "Crucially, <strong class='font-semibold text-brand-pink'>individual data must remain owned by the individual</strong>, not the organization, to avoid antagonism.",
      "This concept (individual AI likenesses) is nascent; organizational/cultural limitations (Martech's Law) hinder rapid adoption despite technological possibility.",
    ],
    pointsRu: [
      "Дополнение начинается с изучения инструментов, но прогрессирует до <strong class='font-semibold text-brand-pink'>кодирования индивидуальных и командных знаний</strong>.",
      "Создание 'цифровых двойников' путем обучения моделей на личных/командных брифах, письмах, контенте создает фильтры для промптинга и вывода (стиль, тон, стратегическое понимание).",
      "Это значительно расширяет возможности и снижает трение (например, при онбординге, решении проблемы 'утечки мозгов').",
      "Критически важно: <strong class='font-semibold text-brand-pink'>индивидуальные данные должны оставаться собственностью индивида</strong>, а не организации, чтобы избежать антагонизма.",
      "Эта концепция (индивидуальные ИИ-образы) нова; организационные/культурные ограничения (Закон Мартека) препятствуют быстрому внедрению, несмотря на технологическую возможность.",
    ],
    imageUrlEn: `${STORAGE_BASE_URL_AIWORK}/600x338/1a1a2e/FF007A/png?text=AI+Digital+Twin`,
    imageUrlRu: `${STORAGE_BASE_URL_AIWORK}/600x338/1a1a2e/FF007A/png?text=ИИ+Цифровой+Двойник`,
    imageAltEn: "Abstract concept: A person's knowledge feeding into an AI model that acts as their assistant/filter",
    imageAltRu: "Абстрактная концепция: Знания человека передаются в модель ИИ, которая действует как его ассистент/фильтр",
    tooltipRu: "ИИ может стать 'цифровым двойником', кодируя наши знания, но право собственности на эти данные должно оставаться у человека.",
  },
  {
    id: "winners-losers",
    icon: FaDiagramProject, // Corrected Icon
    titleEn: "Winners & Losers: It's Complicated",
    titleRu: "Победители и Проигравшие: Все Сложно",
    pointsEn: [
      "It's not simply 'small startups beat large incumbents'.",
      "Large companies have entrenched structures, physical assets, and geopolitical advantages beyond just size or speed.",
      "However, companies <strong class='font-semibold text-brand-orange'>will likely get smaller</strong>.",
      "Expect a <strong class='font-semibold text-brand-orange'>massive explosion</strong> in new businesses and freelancing, as AI lowers entry barriers.",
      "The ability to form specialized entities (even temporary ones, potentially agent-driven) will increase dramatically.",
      "The overall economic and geopolitical landscape shaped by this is still uncertain.",
    ],
    pointsRu: [
      "Это не просто 'маленькие стартапы побеждают крупных игроков'.",
      "Крупные компании имеют устоявшиеся структуры, физические активы и геополитические преимущества помимо размера или скорости.",
      "Однако компании, <strong class='font-semibold text-brand-orange'>вероятно, станут меньше</strong>.",
      "Ожидайте <strong class='font-semibold text-brand-orange'>массового взрыва</strong> новых бизнесов и фриланса, поскольку ИИ снижает барьеры для входа.",
      "Возможность формировать специализированные структуры (даже временные, потенциально управляемые агентами) резко возрастет.",
      "Общий экономический и геополитический ландшафт, формируемый этим, все еще неопределенен.",
    ],
    imageUrlEn: `${STORAGE_BASE_URL_AIWORK}/600x338/1a1a2e/FF6B00/png?text=Shifting+Business+Landscape`,
    imageUrlRu: `${STORAGE_BASE_URL_AIWORK}/600x338/1a1a2e/FF6B00/png?text=Меняющийся+Бизнес-Ландшафт`,
    imageAltEn: "Image: A large, rigid building contrasted with many small, agile structures popping up around it",
    imageAltRu: "Изображение: Большое, жесткое здание в контрасте со множеством маленьких, гибких структур, возникающих вокруг него",
    tooltipRu: "Будущее не за простым вытеснением крупных фирм, а за сосуществованием и взрывным ростом новых, более мелких и гибких форм бизнеса.",
  },
  {
    id: "transformation-approach",
    icon: FaRecycle, // OK
    titleEn: "Approach to Transformation: Radical & Practical",
    titleRu: "Подход к Трансформации: Радикально и Практично",
    pointsEn: [
      "Think <strong class='font-semibold text-neon-lime'>radically</strong> about potential disruptions (tech, application, industry levels).",
      "Act <strong class='font-semibold text-neon-lime'>practically</strong> in implementation (no enterprise wants to burn everything down).",
      "Move from <strong class='font-semibold text-neon-lime'>insight (understanding the present) to foresight (avoiding future disruption)</strong>.",
      "Incubate disruptive ideas internally (tiger teams, skunkworks) using passionate self-selectors.",
      "Find internal 'tinkerers' experimenting with AI.",
      "Crucial: Build infrastructure to <strong class='font-semibold text-neon-lime'>diffuse knowledge</strong> learned from experiments across the organization, preventing compartmentalization.",
    ],
    pointsRu: [
      "Мыслите <strong class='font-semibold text-neon-lime'>радикально</strong> о потенциальных прорывах (на уровне технологий, приложений, индустрии).",
      "Действуйте <strong class='font-semibold text-neon-lime'>практично</strong> при внедрении (ни одно предприятие не хочет сжигать все дотла).",
      "Переходите от <strong class='font-semibold text-neon-lime'>инсайта (понимание настоящего) к форсайту (предотвращение будущих сбоев)</strong>.",
      "Инкубируйте прорывные идеи внутри компании (тигровые команды, 'skunkworks') с участием энтузиастов-добровольцев.",
      "Найдите внутренних 'умельцев', экспериментирующих с ИИ.",
      "Критически важно: Создайте инфраструктуру для <strong class='font-semibold text-neon-lime'>распространения знаний</strong>, полученных в ходе экспериментов, по всей организации, предотвращая их изоляцию.",
    ],
    imageUrlEn: `${STORAGE_BASE_URL_AIWORK}/600x338/1a1a2e/AEFF00/png?text=Radical+Thinking+Practical+Steps`,
    imageUrlRu: `${STORAGE_BASE_URL_AIWORK}/600x338/1a1a2e/AEFF00/png?text=Радикальное+Мышление+Практ.+Шаги`,
    imageAltEn: "Illustration: A brain generating wild ideas connected to hands taking measured steps",
    imageAltRu: "Иллюстрация: Мозг, генерирующий смелые идеи, соединенный с руками, предпринимающими взвешенные шаги",
    tooltipRu: "Думайте смело о будущем, но внедряйте изменения практично, создавая культуру эксперимента и распространения знаний.",
  },
  {
    id: "foresight-agency",
    icon: FaLightbulb, // OK
    titleEn: "Foresight & Human Agency",
    titleRu: "Форсайт и Человеческая Активность",
    pointsEn: [
      "AI tools can <strong class='font-semibold text-brand-blue'>accelerate and scale</strong> the search for signals of change (foresight data gathering).",
      "However, <strong class='font-semibold text-brand-blue'>human agency</strong> is still crucial for interpreting signals, understanding context, relating to strategy, and deciding how to react.",
      "Foresight isn't prediction; it's about understanding potential scenarios ('What if?') to adapt proactively, not reactively.",
      "Everyone has a responsibility for foresight regarding their own role and future.",
      "Encoding organizational knowledge helps contextualize external signals identified by AI.",
    ],
    pointsRu: [
      "Инструменты ИИ могут <strong class='font-semibold text-brand-blue'>ускорять и масштабировать</strong> поиск сигналов изменений (сбор данных для форсайта).",
      "Однако <strong class='font-semibold text-brand-blue'>человеческая активность</strong> все еще критически важна для интерпретации сигналов, понимания контекста, связи со стратегией и принятия решений о реакции.",
      "Форсайт – это не предсказание; это понимание потенциальных сценариев ('Что если?'), чтобы адаптироваться проактивно, а не реактивно.",
      "Каждый несет ответственность за форсайт в отношении своей роли и будущего.",
      "Кодирование организационных знаний помогает контекстуализировать внешние сигналы, выявленные ИИ.",
    ],
    imageUrlEn: `${STORAGE_BASE_URL_AIWORK}/600x338/1a1a2e/00C2FF/png?text=AI+Assisted+Foresight`,
    imageUrlRu: `${STORAGE_BASE_URL_AIWORK}/600x338/1a1a2e/00C2FF/png?text=Форсайт+с+Помощью+ИИ`,
    imageAltEn: "Diagram: AI finding signals, feeding them to a human brain for interpretation and strategic decision",
    imageAltRu: "Диаграмма: ИИ находит сигналы, передает их человеческому мозгу для интерпретации и стратегического решения",
    tooltipRu: "ИИ помогает находить сигналы будущего, но смысл им придает и решения принимает человек.",
  },
  {
    id: "skill-flux",
    icon: FaUserGraduate, // OK
    titleEn: "Skill Flux & The Future of Learning",
    titleRu: "Текучесть Навыков и Будущее Обучения",
    pointsEn: [
      "The shelf-life of technical skills is rapidly decreasing (e.g., ~2.5 years now, potentially shrinking further).",
      "Skills like prompt engineering might have a short lifespan before being automated or superseded.",
      "This necessitates continuous learning: <strong class='font-semibold text-brand-green'>lifelong learning, micro-credentialing, 'surge skilling'</strong> (rapid deep dives).",
      "Competitive advantage comes from being a fast mover with new skills before they become obsolete.",
      "Traditional front-loaded education models are increasingly outdated.",
      "Education needs massive reinvestment; L&D budgets should rival technology budgets to keep humans relevant.",
      "Culture must support <strong class='font-semibold text-brand-green'>on-the-job learning</strong>, potentially guided by the evolving tools themselves.",
    ],
    pointsRu: [
      "Срок годности технических навыков быстро сокращается (например, ~2,5 года сейчас, возможно дальнейшее сокращение).",
      "Навыки вроде промпт-инжиниринга могут иметь короткий жизненный цикл до автоматизации или замены.",
      "Это требует непрерывного обучения: <strong class='font-semibold text-brand-green'>обучение в течение всей жизни, микро-квалификации, 'surge skilling'</strong> (быстрые глубокие погружения).",
      "Конкурентное преимущество достигается за счет быстрого освоения новых навыков до того, как они устареют.",
      "Традиционные модели образования, сосредоточенные в начале жизни, все более устаревают.",
      "Образование нуждается в массивных реинвестициях; бюджеты на ОиР должны конкурировать с бюджетами на технологии, чтобы сохранить релевантность людей.",
      "Культура должна поддерживать <strong class='font-semibold text-brand-green'>обучение на рабочем месте</strong>, возможно, направляемое самими развивающимися инструментами.",
    ],
    imageUrlEn: `${STORAGE_BASE_URL_AIWORK}/600x338/1a1a2e/00FF9D/png?text=Rapid+Skill+Cycling`,
    imageUrlRu: `${STORAGE_BASE_URL_AIWORK}/600x338/1a1a2e/00FF9D/png?text=Быстрая+Смена+Навыков`,
    imageAltEn: "Illustration: A fast-spinning cycle showing skills appearing, peaking, and declining rapidly",
    imageAltRu: "Иллюстрация: Быстро вращающийся цикл, показывающий быстрое появление, пик и угасание навыков",
    tooltipRu: "Навыки устаревают все быстрее. Необходимо постоянное, быстрое обучение и адаптация.",
  },
   {
    id: "hype-vs-reality",
    icon: FaWind, // OK
    titleEn: "Hype vs. Reality: Agents",
    titleRu: "Хайп против Реальности: Агенты",
    pointsEn: [
      "The current conversation around autonomous AI agents is <strong class='font-semibold text-brand-purple'>overhyped</strong>.",
      "While transformative, no organization will realistically let autonomous agents run critical systems without oversight yet.",
      "Experiments show letting agents run freely can be <strong class='font-semibold text-brand-purple'>frightening</strong> due to unpredictable outcomes.",
      "Effective agent use currently is narrow, specific, structured, with strong guardrails.",
      "The necessary infrastructure for safe, broad autonomous operation isn't there yet.",
      "Expect a crash into the 'trough of disillusionment' for agents, which is healthy for filtering out hype and allowing real development.",
    ],
    pointsRu: [
      "Текущие разговоры об автономных ИИ-агентах <strong class='font-semibold text-brand-purple'>чрезмерно раздуты</strong>.",
      "Хотя они и трансформационны, ни одна организация пока реалистично не позволит автономным агентам управлять критическими системами без надзора.",
      "Эксперименты показывают, что предоставление агентам полной свободы может быть <strong class='font-semibold text-brand-purple'>пугающим</strong> из-за непредсказуемых результатов.",
      "Эффективное использование агентов в настоящее время узкоспециализировано, структурировано и имеет строгие ограничения.",
      "Необходимая инфраструктура для безопасной, широкой автономной работы еще не создана.",
      "Ожидайте падения в 'пропасть разочарования' для агентов, что полезно для отсеивания хайпа и обеспечения реальной разработки.",
    ],
    imageUrlEn: `${STORAGE_BASE_URL_AIWORK}/600x338/1a1a2e/9D00FF/png?text=Agent+Hype+Cycle`,
    imageUrlRu: `${STORAGE_BASE_URL_AIWORK}/600x338/1a1a2e/9D00FF/png?text=Цикл+Хайпа+Агентов`,
    imageAltEn: "Graph showing the typical Gartner hype cycle curve with 'Agents' at the peak",
    imageAltRu: "График, показывающий типичную кривую цикла хайпа Гартнера с 'Агентами' на пике",
    tooltipRu: "Автономные ИИ-агенты - мощная технология будущего, но текущий хайп опережает реальные возможности и безопасность.",
  },
  {
    id: "metrics-matter",
    icon: FaChartLine, // OK
    titleEn: "Metrics Must Evolve",
    titleRu: "Метрики Должны Эволюционировать",
    pointsEn: [
      "Current metrics heavily favor <strong class='font-semibold text-brand-pink'>optimizing the known</strong> (legacy of industrial era).",
      "When what matters changes (due to AI), but metrics and incentives don't, organizations run into trouble.",
      "Need to shift towards metrics measuring <strong class='font-semibold text-brand-pink'>exploration of the unknown</strong>: innovation quotient, knowledge diffusion, resilience building.",
      "Applying ROI or immediate efficiency metrics to exploratory/innovative work (like initial AI adoption) stifles progress.",
      "Start by dedicating a portion of work/teams to forward-facing goals measured by these new, flexible metrics.",
    ],
    pointsRu: [
      "Текущие метрики в значительной степени ориентированы на <strong class='font-semibold text-brand-pink'>оптимизацию известного</strong> (наследие индустриальной эры).",
      "Когда то, что имеет значение, меняется (из-за ИИ), а метрики и стимулы - нет, организации сталкиваются с проблемами.",
      "Необходимо перейти к метрикам, измеряющим <strong class='font-semibold text-brand-pink'>исследование неизвестного</strong>: коэффициент инноваций, распространение знаний, построение устойчивости.",
      "Применение ROI или метрик немедленной эффективности к исследовательской/инновационной работе (например, к начальному внедрению ИИ) душит прогресс.",
      "Начните с выделения части работы/команд на цели, ориентированные на будущее, измеряемые этими новыми, гибкими метриками.",
    ],
    imageUrlEn: `${STORAGE_BASE_URL_AIWORK}/600x338/1a1a2e/FF007A/png?text=Old+vs+New+Metrics`,
    imageUrlRu: `${STORAGE_BASE_URL_AIWORK}/600x338/1a1a2e/FF007A/png?text=Старые+против+Новых+Метрик`,
    imageAltEn: "Illustration: A rigid ruler measuring efficiency contrasted with a compass exploring new territory",
    imageAltRu: "Иллюстрация: Жесткая линейка, измеряющая эффективность, в контрасте с компасом, исследующим новую территорию",
    tooltipRu: "Старые метрики эффективности тормозят инновации. Нужны новые показатели, измеряющие исследование и адаптацию.",
  },
   {
    id: "conclusion-pioneers",
    icon: FaRoad, // OK
    titleEn: "Conclusion: We Are All Pioneers",
    titleRu: "Заключение: Мы Все Первопроходцы",
    pointsEn: [
      "The current transformation is overwhelming, even for experts.",
      "Net long-term outlook is optimistic, but the transition involves <strong class='font-semibold text-brand-orange'>tough growing pains</strong>.",
      "We are all pioneers navigating uncharted territory with incomplete tools and infrastructure.",
      "Requires resilience, adaptation, and constructing new ways forward.",
      "<strong class='font-semibold text-brand-orange'>Culture is paramount</strong>: willingness to change, collective ownership, and moving forward together are key.",
    ],
    pointsRu: [
      "Текущая трансформация ошеломляет, даже экспертов.",
      "Чистый долгосрочный прогноз оптимистичен, но переходный период включает <strong class='font-semibold text-brand-orange'>тяжелые болезни роста</strong>.",
      "Мы все – первопроходцы, исследующие неизведанную территорию с неполными инструментами и инфраструктурой.",
      "Требуются устойчивость, адаптация и построение новых путей вперед.",
      "<strong class='font-semibold text-brand-orange'>Культура имеет первостепенное значение</strong>: готовность к изменениям, коллективная ответственность и совместное движение вперед – ключ к успеху.",
    ],
    imageUrlEn: `${STORAGE_BASE_URL_AIWORK}/600x338/1a1a2e/FF6B00/png?text=Pioneering+the+Future`,
    imageUrlRu: `${STORAGE_BASE_URL_AIWORK}/600x338/1a1a2e/FF6B00/png?text=Прокладывая+Путь+в+Будущее`,
    imageAltEn: "Image: Footprints leading into an unknown, misty landscape",
    imageAltRu: "Изображение: Следы, ведущие в неизвестный, туманный пейзаж",
    tooltipRu: "Мы вступаем в новую эру. Это будет сложно, но совместными усилиями и адаптацией мы проложим путь.",
  },
];

// --- Component ---
export default function AiWorkFuturePage() {
  const { user } = useAppContext();
  const [isMounted, setIsMounted] = useState(false);
  const [selectedLang, setSelectedLang] = useState<Language>('ru');

  useEffect(() => {
    setIsMounted(true);
    const browserLang = typeof navigator !== 'undefined' ? navigator.language.split('-')[0] : 'ru';
    const initialLang = user?.language_code === 'ru' || (!user?.language_code && browserLang === 'ru') ? 'ru' : 'en';
    setSelectedLang(initialLang);
    debugLogger.log(`[AiWorkFuturePage] Mounted. Browser lang: ${browserLang}, User lang: ${user?.language_code}, Initial selected: ${initialLang}`);
  }, [user?.language_code]);

  if (!isMounted) {
    return (
      <div className="flex justify-center items-center min-h-screen pt-20 bg-gradient-to-br from-gray-900 via-black to-gray-800">
        <p className="text-brand-cyan animate-pulse text-xl font-mono">Загрузка мудрости о Будущем Работы с ИИ...</p>
      </div>
    );
  }

  const pageThemeColor = "brand-cyan";
  const pageBorderColor = `border-${pageThemeColor}/30`;
  const pageTextColor = `text-${pageThemeColor}`;
  const pageShadowColor = `shadow-[0_0_30px_rgba(0,194,255,0.4)]`;

  return (
    <div className="relative min-h-screen overflow-hidden pt-20 pb-10 bg-gradient-to-br from-gray-900 via-black to-gray-800 text-gray-200">
      {/* .. Background Grid */}
      <div
        className="absolute inset-0 bg-repeat opacity-[0.03] z-0"
        style={{
          backgroundImage: `linear-gradient(to right, rgba(0, 255, 157, 0.4) 1px, transparent 1px),
                            linear-gradient(to bottom, rgba(0, 255, 157, 0.4) 1px, transparent 1px)`,
          backgroundSize: '60px 60px',
        }}
      ></div>

      <TooltipProvider delayDuration={150}> {/* Added TooltipProvider */}
        <div className="relative z-10 container mx-auto px-4">
          <Card className={cn(
              "max-w-4xl mx-auto bg-black/85 backdrop-blur-lg text-white rounded-2xl border",
              pageBorderColor,
              pageShadowColor
          )}>
            <CardHeader className={cn("text-center border-b pb-4", `border-${pageThemeColor}/20`)}>
              <CardTitle className={cn("text-3xl md:text-5xl font-bold cyber-text glitch", pageTextColor)} data-text="AI & The Future of Work">
                AI & The Future of Work
              </CardTitle>
              <p className="text-md md:text-lg text-gray-300 mt-3 font-mono">
                 {selectedLang === 'ru'
                    ? "Ключевые идеи о том, как ИИ переписывает правила."
                    : "Key insights on how AI is rewriting the rules."}
              </p>
               <p className="text-sm text-gray-400 mt-1">
                 {selectedLang === 'ru' ? "По мотивам беседы с футуристом Иэном Бикрафтом" : "Based on insights from Futurist Ian Beacraft"}
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
                const themeColor = ["text-brand-pink", "text-brand-orange", "text-neon-lime", "text-brand-blue", "text-brand-green", "text-brand-purple"][index % 6];
                const borderColor = themeColor.replace("text-", "border-");
                const currentTitle = selectedLang === 'en' ? section.titleEn : section.titleRu;
                const currentPoints = selectedLang === 'en' ? section.pointsEn : section.pointsRu; // Fixed points logic
                const currentImageAlt = selectedLang === 'en' ? section.imageAltEn : section.imageAltRu; // Fixed alt logic
                const currentImageUrl = selectedLang === 'en' ? section.imageUrlEn : section.imageUrlRu; // Fixed URL logic
                const currentTooltip = selectedLang === 'ru' ? section.tooltipRu : null;

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

                    {currentImageUrl && (
                      <div className={`my-6 p-2 border ${borderColor}/30 rounded-lg bg-black/30 max-w-md mx-auto`}>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <div className="aspect-video w-full h-auto overflow-hidden rounded-md bg-gray-800/50 cursor-help relative">
                              <Image
                                src={currentImageUrl} alt={currentImageAlt} width={600} height={338}
                                className="w-full h-full object-cover opacity-90 hover:opacity-100 transition-opacity duration-300"
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
                  </section>
                );
              })}

              {/* .. Concluding section */}
              <section className="text-center pt-8 border-t border-brand-cyan/20 mt-10">
                 <p className="text-gray-400 italic">
                   {selectedLang === 'ru' ? "Резюме основано на беседе с Иэном Бикрафтом. Будущее требует адаптации и смелости." : "Summary based on the conversation with Ian Beacraft. The future requires adaptation and courage."}
                 </p>
                 <p className="mt-4 text-gray-300">
                   Explore related concepts in <Link href="/selfdev" className="text-brand-green hover:underline font-semibold">Experimental Mindset</Link>, <Link href="/purpose-profit" className="text-brand-purple hover:underline font-semibold">Purpose & Profit</Link>, {selectedLang === 'ru' ? 'и геймифицируй свой путь на' : 'and gamify your path at'} <Link href="/selfdev/gamified" className="text-brand-yellow hover:underline font-semibold">Gamified SelfDev <FaGamepad className="inline ml-1"/></Link>.
                 </p>
              </section>

            </CardContent>
          </Card>
        </div>
      </TooltipProvider> {/* Added TooltipProvider */}
    </div>
  );
}
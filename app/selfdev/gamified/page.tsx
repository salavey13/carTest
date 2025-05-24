"use client";

import React, { useState, useEffect, useId, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAppContext } from "@/contexts/AppContext";
import { VibeContentRenderer } from "@/components/VibeContentRenderer";
import { debugLogger as logger } from "@/lib/debugLogger";
import Image from "next/image";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import RockstarHeroSection from "../../tutorials/RockstarHeroSection";
import { Textarea } from "@/components/ui/textarea";
import { FaCircleInfo } from "react-icons/fa6"; // Explicitly import FaCircleInfo
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"; // Import Dialog components


type Language = 'en' | 'ru';

interface SectionQuestion {
  type: 'yes_no' | 'multiple_choice' | 'reflection';
  textRu: string;
  textEn: string;
  correctAnswer?: 'yes' | 'no' | string;
  optionsRu?: string[];
  optionsEn?: string[];
  tipRu?: string;
  tipEn?: string;
}

interface InfoDetail {
  titleRu: string;
  titleEn: string;
  contentRu: string;
  contentEn: string;
}

interface SectionContent {
  id: string;
  icon: string;
  titleEn: string;
  titleRu: string;
  pointsEn?: string[];
  pointsRu?: string[];
  imageUrlEn?: string;
  imageUrlRu?: string;
  imageAltEn?: string;
  imageAltRu?: string;
  question: SectionQuestion;
  notablePhrase?: {
    textRu: string;
    textEn: string;
  };
  infoDetails?: InfoDetail;
  subSections?: {
    titleEn: string;
    titleRu: string;
    icon: string;
    pointsEn: string[];
    pointsRu: string[];
    borderColor: string;
    textColor: string;
    imageUrlEn?: string;
    imageUrlRu?: string;
    imageAltEn?: string;
    imageAltRu?: string;
    infoDetails?: InfoDetail;
  }[];
}

const STORAGE_BASE_URL_GAMIFIED = "https://placehold.co"; 
const PLACEHOLDER_BLUR_URL_GAMIFIED = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII="; 

const sectionsData: SectionContent[] = [
  {
    id: "intro-ai-os",
    icon: "::FaRobot::",
    titleEn: "Welcome to CyberDev OS: Your AI-Powered Future",
    titleRu: "Добро пожаловать в CyberDev OS: Ваше AI-Будущее",
    pointsEn: [
      "Your personal operating system for accelerated self-development.",
      "Leverage the power of AI to transform your growth into an exciting, strategic game.",
      "Go beyond theory: this platform helps you apply, automate, and amplify your potential.",
      "It's about achieving <strong class='text-brand-cyan'>infinite possibilities</strong> in your personal and professional life.",
    ],
    pointsRu: [
      "Ваша персональная операционная система для ускоренного саморазвития.",
      "Используйте мощь ИИ, чтобы превратить свой рост в увлекательную стратегическую игру.",
      "Выйдите за рамки теории: эта платформа поможет вам применять, автоматизировать и усиливать свой потенциал.",
      "Речь идет о достижении <strong class='text-brand-cyan'>безграничных возможностей</strong> в вашей личной и профессиональной жизни.",
    ],
    imageUrlEn: `${STORAGE_BASE_URL_GAMIFIED}/600x338/1a1a2e/00FFEE/png?text=AI+OS+Intro`,
    imageUrlRu: `${STORAGE_BASE_URL_GAMIFIED}/600x338/1a1a2e/00FFEE/png?text=AI+OS+Введение`,
    imageAltEn: "Abstract representation of an AI-powered operating system interface",
    imageAltRu: "Абстрактное изображение интерфейса операционной системы, управляемой ИИ",
    question: {
      type: 'yes_no',
      textRu: "CyberDev OS использует ИИ только для предоставления информации, а не для активного ускорения вашего саморазвития.",
      textEn: "CyberDev OS uses AI only for providing information, not for actively accelerating your self-development.",
      correctAnswer: 'no',
      tipRu: "На самом деле, CyberDev OS использует ИИ для активного ускорения вашего роста, помогая вам применять, автоматизировать и усиливать потенциал.",
      tipEn: "Actually, CyberDev OS uses AI to actively accelerate your growth by helping you apply, automate, and amplify your potential.",
    },
    notablePhrase: {
      textRu: "AI-Powered CyberDev OS: Безграничные возможности для Вашего развития.",
      textEn: "AI-Powered CyberDev OS: Infinite possibilities for your growth.",
    },
  },
  {
    id: "ai-agent",
    icon: "::FaUserSecret::",
    titleEn: "Module 1: AI Agent - Expanding Your Potential",
    titleRu: "Модуль 1: AI-Агент - Расширение Вашего Потенциала",
    pointsEn: [
      "Imagine AI as your personal agent, handling complex tasks behind the scenes.",
      "Just like `Project Mariner` automates browser tasks, your AI agent can manage your self-development pipeline.",
      "From scheduling learning sessions to researching new skills, your agent frees up your System 2 for deep work.",
      "It's about getting things done *for* you, so you can focus on *being* productive and creative.",
    ],
    pointsRu: [
      "Представьте ИИ как вашего личного агента, который выполняет сложные задачи за кулисами.",
      "Подобно тому, как `Project Mariner` автоматизирует задачи в браузере, ваш AI-агент может управлять вашим конвейером саморазвития.",
      "От планирования обучающих сессий до исследования новых навыков, ваш агент освобождает вашу Систему 2 для глубокой работы.",
      "Цель – выполнение задач *за вас*, чтобы вы могли сосредоточиться на *быть* продуктивным и творческим.",
    ],
    imageUrlEn: `${STORAGE_BASE_URL_GAMIFIED}/600x338/1a1a2e/FF4500/png?text=AI+Agent+Mode`,
    imageUrlRu: `${STORAGE_BASE_URL_GAMIFIED}/600x338/1a1a2e/FF4500/png?text=AI-Агент+Мод`,
    imageAltEn: "Illustration of a digital agent automating tasks",
    imageAltRu: "Иллюстрация цифрового агента, автоматизирующего задачи",
    question: {
      type: 'yes_no',
      textRu: "AI-агент предназначен для замены вашего мышления, а не для автоматизации рутинных задач.",
      textEn: "The AI agent is designed to replace your thinking, not to automate routine tasks.",
      correctAnswer: 'no',
      tipRu: "Неверно. AI-агент автоматизирует рутину, чтобы вы могли сосредоточиться на более сложных и творческих задачах.",
      tipEn: "Incorrect. The AI agent automates routine tasks so you can focus on more complex and creative endeavors.",
    },
    infoDetails: {
      titleRu: "Agent Mode (Project Mariner)",
      titleEn: "Agent Mode (Project Mariner)",
      contentRu: "В видео показано, как AI-агент может выполнять сложные многошаговые задачи в браузере (например, найти рецепт и купить ингредиенты). В CyberDev OS ваш AI-агент действует аналогично, упрощая процессы планирования, исследования и организации вашего пути саморазвития, позволяя вам сосредоточиться на самом обучении и применении знаний.",
      contentEn: "The video demonstrates how an AI agent can perform complex multi-step tasks in the browser (e.g., finding a recipe and buying ingredients). In CyberDev OS, your AI agent acts similarly, simplifying the processes of planning, researching, and organizing your self-development journey, allowing you to focus on the learning and application itself."
    }
  },
  {
    id: "dynamic-learning",
    icon: "::FaChartSimple::",
    titleEn: "Module 2: Dynamic Learning Paths - Entering the Flow",
    titleRu: "Модуль 2: Динамические Пути Обучения - Вход в Поток",
    pointsEn: [
      "Experience learning that adapts to you, dynamically. Just like `Flow` AI generates stunning visuals, our system creates personalized learning flows.",
      "It understands your progress, identifies knowledge gaps, and suggests the next optimal step.",
      "Forget rigid curricula; embrace a fluid, engaging learning experience tailored to your unique pace and style.",
      "Achieve the 'flow state' where learning feels effortless and deeply engaging.",
    ],
    pointsRu: [
      "Обучение, которое динамически адаптируется к вам. Подобно тому, как AI `Flow` генерирует потрясающие визуальные эффекты, наша система создает персонализированные потоки обучения.",
      "Она понимает ваш прогресс, выявляет пробелы в знаниях и предлагает следующий оптимальный шаг.",
      "Забудьте о жестких учебных планах; примите гибкий, увлекательный процесс обучения, адаптированный к вашему уникальному темпу и стилю.",
      "Достигните 'состояния потока', когда обучение кажется легким и глубоко увлекательным.",
    ],
    imageUrlEn: `${STORAGE_BASE_URL_GAMIFIED}/600x338/1a1a2e/00AAFF/png?text=Learning+Flow`,
    imageUrlRu: `${STORAGE_BASE_URL_GAMIFIED}/600x338/1a1a2e/00AAFF/png?text=Поток+Обучения`,
    imageAltEn: "Abstract representation of data flow and personalized learning paths",
    imageAltRu: "Абстрактное представление потока данных и персонализированных путей обучения",
    question: {
      type: 'multiple_choice',
      textRu: "Что такое 'состояние потока' в контексте обучения?",
      textEn: "What is the 'flow state' in the context of learning?",
      optionsRu: ["Когда вы чувствуете себя перегруженным", "Когда обучение кажется легким и глубоко увлекательным", "Когда вы следуете строгому учебному плану", "Когда ИИ заменяет учителя полностью"],
      optionsEn: ["When you feel overwhelmed", "When learning feels effortless and deeply engaging", "When you follow a rigid curriculum", "When AI completely replaces the teacher"],
      correctAnswer: "Когда обучение кажется легким и глубоко увлекательным",
      tipRu: "Именно так! Состояние потока – это идеальное состояние для эффективного и приятного обучения.",
      tipEn: "Exactly! The flow state is an ideal condition for effective and enjoyable learning.",
    },
    infoDetails: {
      titleRu: "Flow AI",
      titleEn: "Flow AI",
      contentRu: "В видео показана способность Flow AI генерировать видео на основе текстовых запросов, создавая 'бесконечные возможности'. В CyberDev OS, 'поток' (Flow) применяется к обучению – ИИ помогает вам достичь оптимального состояния, где информация усваивается легко и эффективно, а ваш путь саморазвития становится интуитивным и адаптируемым.",
      contentEn: "The video demonstrates Flow AI's ability to generate videos from text prompts, creating 'infinite possibilities'. In CyberDev OS, 'flow' is applied to learning – AI helps you achieve an optimal state where information is absorbed easily and effectively, and your self-development path becomes intuitive and adaptable."
    }
  },
  {
    id: "creative-generation",
    icon: "::FaPalette::",
    titleEn: "Module 3: Idea & Creativity Generation - AI as Your Muse",
    titleRu: "Модуль 3: Генерация Идей и Творчества - AI как Муза",
    pointsEn: [
      "Unleash your inner creator. Generative AI expands the boundaries of creativity, helping you brainstorm, outline, and even prototype ideas.",
      "Whether it's writing a project proposal, designing a personal branding element, or simply overcoming creative blocks, AI can be your muse.",
      "Just as AI generates stunning images, it can generate prompts, concepts, and structures for your self-development projects.",
      "Transform 'I can't draw' into 'AI, make a picture of...'",
    ],
    pointsRu: [
      "Раскройте свой внутренний творец. Генеративный ИИ расширяет границы творчества, помогая вам в мозговом штурме, создании планов и даже прототипировании идей.",
      "Будь то написание предложения по проекту, разработка элемента личного бренда или просто преодоление творческого кризиса, ИИ может стать вашей музой.",
      "Подобно тому, как ИИ генерирует потрясающие изображения, он может генерировать подсказки, концепции и структуры для ваших проектов саморазвития.",
      "Превратите 'Я не умею рисовать' в 'ИИ, сделай картинку...'",
    ],
    imageUrlEn: `${STORAGE_BASE_URL_GAMIFIED}/600x338/1a1a2e/FF00FF/png?text=Generative+Creativity`,
    imageUrlRu: `${STORAGE_BASE_URL_GAMIFIED}/600x338/1a1a2e/FF00FF/png?text=Генеративное+Творчество`,
    imageAltEn: "Illustration of AI assisting in creative design",
    imageAltRu: "Иллюстрация ИИ, помогающего в творческом дизайне",
    question: {
      type: 'reflection',
      textRu: "Опишите, как вы могли бы использовать генеративный ИИ для решения творческой задачи в вашей личной или профессиональной жизни (например, для написания текста, создания идеи или дизайна).",
      textEn: "Describe how you could use generative AI to solve a creative task in your personal or professional life (e.g., for writing, idea generation, or design).",
      tipRu: "Отличные идеи! Генеративный ИИ – мощный инструмент для расширения ваших творческих возможностей.",
      tipEn: "Great ideas! Generative AI is a powerful tool for expanding your creative capabilities.",
    },
    infoDetails: {
      titleRu: "Генеративные медиа",
      titleEn: "Generative Media",
      contentRu: "В видео демонстрируются примеры генерации изображений и видео по текстовым запросам. Генеративный ИИ может создавать что угодно — от текстов и кодов до изображений и концептов. В контексте саморазвития это означает, что вы можете быстро 'прототипировать' идеи, получать вдохновение и преодолевать творческие барьеры, превращая абстрактные мысли в конкретные формы.",
      contentEn: "The video demonstrates examples of generating images and videos from text prompts. Generative AI can create anything from texts and codes to images and concepts. In the context of self-development, this means you can quickly 'prototype' ideas, gain inspiration, and overcome creative barriers, transforming abstract thoughts into concrete forms."
    }
  },
  {
    id: "progress-analysis",
    icon: "::FaChartLine::",
    titleEn: "Module 4: Progress Analysis & Feedback - Precise Insights",
    titleRu: "Модуль 4: Анализ Прогресса и Обратная Связь - Точные Инсайты",
    pointsEn: [
      "Gain unparalleled clarity on your self-development journey. AI can analyze your progress data, providing insights previously impossible.",
      "Like an `infrared heatmap` revealing fire hotspots, AI pinpoints your strengths, weaknesses, and areas needing focus.",
      "Receive timely, actionable feedback that helps you refine your strategies and accelerate mastery.",
      "This isn't just about 'knowing where you are,' but 'knowing exactly what to do next' to optimize your growth.",
    ],
    pointsRu: [
      "Получите беспрецедентную ясность на вашем пути саморазвития. ИИ может анализировать данные о вашем прогрессе, предоставляя ранее невозможные инсайты.",
      "Подобно `инфракрасной тепловой карте`, выявляющей очаги возгорания, ИИ точно определяет ваши сильные и слабые стороны, а также области, требующие внимания.",
      "Получайте своевременную, действенную обратную связь, которая поможет вам отточить свои стратегии и ускорить освоение навыков.",
      "Это не просто 'знать, где вы находитесь', а 'точно знать, что делать дальше', чтобы оптимизировать свой рост.",
    ],
    imageUrlEn: `${STORAGE_BASE_URL_GAMIFIED}/600x338/1a1a2e/9D00FF/png?text=Progress+Analysis`,
    imageUrlRu: `${STORAGE_BASE_URL_GAMIFIED}/600x338/1a1a2e/9D00FF/png?text=Анализ+Прогресса`,
    imageAltEn: "Data visualization of personal growth metrics",
    imageAltRu: "Визуализация данных метрик личного роста",
    question: {
      type: 'yes_no',
      textRu: "ИИ в CyberDev OS лишь собирает данные о вашем прогрессе, но не может предложить конкретные действия для улучшения.",
      textEn: "AI in CyberDev OS only collects data on your progress but cannot suggest specific actions for improvement.",
      correctAnswer: 'no',
      tipRu: "Неверно. ИИ не только анализирует, но и предлагает точные, действенные рекомендации для оптимизации вашего роста.",
      tipEn: "Incorrect. AI not only analyzes but also offers precise, actionable recommendations to optimize your growth.",
    },
    infoDetails: {
      titleRu: "Инфракрасная тепловая карта (Борьба с пожарами)",
      titleEn: "Infrared Heatmap (Firefighting)",
      contentRu: "В видео показано, как ИИ использует инфракрасные данные для создания тепловых карт, помогая пожарным видеть очаги возгорания сквозь дым и точно направлять свои усилия. В CyberDev OS эта аналогия применяется к вашему саморазвитию: ИИ 'видит' ваш 'тепловой след' в обучении, выявляя области, где вам нужна наибольшая поддержка или где вы демонстрируете наибольший потенциал, чтобы вы могли сфокусироваться на самом важном.",
      contentEn: "The video shows how AI uses infrared data to create heatmaps, helping firefighters see hotspots through smoke and precisely direct their efforts. In CyberDev OS, this analogy applies to your self-development: AI 'sees' your 'heat signature' in learning, identifying areas where you need the most support or where you show the most potential, so you can focus on what matters most."
    }
  },
  {
    id: "coding-reality",
    icon: "::FaCode::",
    titleEn: "Module 5: Coding Your Reality - Building the Future",
    titleRu: "Модуль 5: Кодирование Вашей Реальности - Строим Будущее",
    pointsEn: [
      "The ultimate superpower: `coding` your own future. With AI assistance like `Gemini Pro`, you don't need to be a developer to build.",
      "Create custom tools, automate personal workflows, or even build small applications to support your self-development goals.",
      "AI provides scaffolding, suggestions, and even direct code generation, making complex 'building' accessible to everyone.",
      "This module empowers you to truly become the architect of your digital and personal life, with AI as your co-pilot.",
    ],
    pointsRu: [
      "Высшая суперсила: `кодирование` собственного будущего. С помощью ИИ, такого как `Gemini Pro`, вам не нужно быть разработчиком, чтобы создавать.",
      "Создавайте пользовательские инструменты, автоматизируйте персональные рабочие процессы или даже создавайте небольшие приложения для поддержки ваших целей саморазвития.",
      "ИИ предоставляет поддержку, предложения и даже прямую генерацию кода, делая сложное 'строительство' доступным для всех.",
      "Этот модуль позволяет вам по-настоящему стать архитектором своей цифровой и личной жизни, с ИИ в качестве вашего второго пилота.",
    ],
    imageUrlEn: `${STORAGE_BASE_URL_GAMIFIED}/600x338/1a1a2e/AEFF00/png?text=Coding+Future`,
    imageUrlRu: `${STORAGE_BASE_URL_GAMIFIED}/600x338/1a1a2e/AEFF00/png?text=Кодируем+Будущее`,
    imageAltEn: "Abstract image of AI-assisted coding environment",
    imageAltRu: "Абстрактное изображение среды кодирования с помощью ИИ",
    question: {
      type: 'reflection',
      textRu: "Представьте, что у вас есть AI-помощник для 'кодирования' вашей реальности. Какую одну небольшую 'фичу' или инструмент вы бы создали для улучшения своей жизни или работы?",
      textEn: "Imagine you have an AI assistant for 'coding' your reality. What one small 'feature' or tool would you create to improve your life or work?",
      tipRu: "Замечательная идея! ИИ делает создание собственных решений доступным для каждого.",
      tipEn: "Wonderful idea! AI makes creating your own solutions accessible to everyone.",
    },
    infoDetails: {
      titleRu: "Gemini Pro (Кодирование) & NotebookLM (Mind Maps)",
      titleEn: "Gemini Pro (Coding) & NotebookLM (Mind Maps)",
      contentRu: "В видео показаны возможности Gemini Pro по написанию кода и NotebookLM по созданию интеллектуальных карт. Эти инструменты демонстрируют, как ИИ может не только автоматизировать, но и помогать в создании нового. В CyberDev OS это означает, что вы можете 'кодировать' новые навыки, создавать персонализированные системы обучения или даже формировать свою 'ментальную архитектуру' с помощью ИИ, делая сложные задачи доступными без глубоких технических знаний.",
      contentEn: "The video demonstrates Gemini Pro's coding capabilities and NotebookLM's mind-mapping features. These tools show how AI can not only automate but also assist in creating new things. In CyberDev OS, this means you can 'code' new skills, build personalized learning systems, or even shape your 'mental architecture' with AI, making complex tasks accessible without deep technical knowledge."
    }
  },
];

export default function GamifiedSelfDevPage() {
  const { user, tg, isInTelegramContext } = useAppContext();
  const [isMounted, setIsMounted] = useState(false);
  const [selectedLang, setSelectedLang] = useState<Language>('ru'); 
  const heroTriggerId = useId().replace(/:/g, "-") + "-gamified-hero-trigger"; 

  // Interactive content state
  const [visibleSectionIds, setVisibleSectionIds] = useState<Set<string>>(new Set());
  const [answeredQuestions, setAnsweredQuestions] = useState<Record<string, { answered: boolean; correct?: boolean }>>({});
  const [currentActiveQuestionId, setCurrentActiveQuestionId] = useState<string | null>(null);
  const [showTipFor, setShowTipFor] = useState<string | null>(null);
  const [reflectionText, setReflectionText] = useState<string>("");
  const [savedNotes, setSavedNotes] = useState<string[]>([]);
  const [noteSavedFeedback, setNoteSavedFeedback] = useState<Record<string, boolean>>({});

  const [isInfoModalOpen, setIsInfoModalOpen] = useState(false);
  const [currentInfoModalContent, setCurrentInfoModalContent] = useState<InfoDetail | null>(null);

  useEffect(() => {
    setIsMounted(true);
    const browserLang = typeof navigator !== 'undefined' ? navigator.language.split('-')[0] : 'ru';
    const initialLang = user?.language_code === 'ru' || (!user?.language_code && browserLang === 'ru') ? 'ru' : 'en'; 
    setSelectedLang(initialLang);
    logger.log(`[GamifiedSelfDevPage] Mounted. Browser lang: ${browserLang}, Initial selected: ${initialLang}`);
  }, [user?.language_code]); 

  // Helper to get translated content
  const t = useCallback((key: keyof SectionContent | string, section: SectionContent | InfoDetail | undefined) => {
    if (!section) return '';
    const langKey = selectedLang === 'en' ? `${key}En` : `${key}Ru`;
    // @ts-ignore
    return section[langKey] || section[key] || '';
  }, [selectedLang]);

  // Map sections data for rendering
  const sections = sectionsData.map(section => ({
    ...section,
    title: t('title', section),
    points: t('points', section),
    imageUrl: t('imageUrl', section),
    imageAlt: t('imageAlt', section),
    question: {
      ...section.question,
      text: t('text', section.question),
      options: selectedLang === 'en' ? section.question.optionsEn : section.question.optionsRu,
      tip: t('tip', section.question),
    },
    notablePhrase: section.notablePhrase ? {
      text: t('text', section.notablePhrase),
    } : undefined,
    infoDetails: section.infoDetails ? {
      title: t('title', section.infoDetails),
      content: t('content', section.infoDetails),
    } : undefined,
    subSections: section.subSections ? section.subSections.map(sub => ({
      ...sub,
      title: t('title', sub),
      points: t('points', sub),
      imageUrl: t('imageUrl', sub),
      imageAlt: t('imageAlt', sub),
      infoDetails: sub.infoDetails ? {
        title: t('title', sub.infoDetails),
        content: t('content', sub.infoDetails),
      } : undefined,
    })) : undefined,
  }));

  useEffect(() => {
    if (isMounted && sections.length > 0 && visibleSectionIds.size === 0) {
        setVisibleSectionIds(new Set([sections[0].id]));
        setCurrentActiveQuestionId(sections[0].id);
    }
  }, [isMounted, sections, visibleSectionIds.size]);

  const handleAnswer = useCallback((sectionId: string, userAnswer: 'yes' | 'no' | string, questionType: SectionQuestion['type'], nextSectionId?: string) => {
    const section = sectionsData.find(s => s.id === sectionId); // Use original data for correct answer
    if (!section || !section.question) return;

    let isCorrect: boolean | undefined;

    if (questionType === 'yes_no' || questionType === 'multiple_choice') {
        isCorrect = userAnswer === section.question.correctAnswer;
    } else if (questionType === 'reflection') {
        isCorrect = true; 
        setReflectionText(""); 
    }

    setAnsweredQuestions(prev => ({
        ...prev,
        [sectionId]: { answered: true, correct: isCorrect }
    }));

    if (isCorrect === false) { 
        setShowTipFor(sectionId);
    } else {
        setShowTipFor(null); 
    }

    if (nextSectionId) {
        setVisibleSectionIds(prev => new Set(prev.add(nextSectionId)));
        setCurrentActiveQuestionId(nextSectionId);
    } else {
        setCurrentActiveQuestionId(null); 
    }
  }, [sectionsData]);

  const handleSaveNote = useCallback((noteText: string, sectionId: string) => {
    if (!savedNotes.includes(noteText)) {
      setSavedNotes(prevNotes => [...prevNotes, noteText]);
      setNoteSavedFeedback(prev => ({ ...prev, [sectionId]: true }));
      setTimeout(() => setNoteSavedFeedback(prev => ({ ...prev, [sectionId]: false })), 2000); 
    }
  }, [savedNotes]);

  const handleSendNotesToTelegram = useCallback(() => {
    if (savedNotes.length === 0) return;

    const notesHeader = selectedLang === 'ru' ? "📝 Ваши заметки из CyberDev OS:\n\n" : "📝 Your notes from CyberDev OS:\n\n";
    const formattedNotes = savedNotes.map((note, index) => `${index + 1}. ${note}`).join('\n');
    const message = encodeURIComponent(notesHeader + formattedNotes + "\n\n#CyberDevOS #oneSitePls");

    const shareUrl = `https://t.me/share/url?url=${encodeURIComponent("https://t.me/oneSitePlsBot/app")}&text=${message}`;

    if (isInTelegramContext && tg) {
      tg.openLink(shareUrl);
    } else {
      window.open(shareUrl, "_blank");
    }
  }, [savedNotes, selectedLang, isInTelegramContext, tg]);

  const openInfoModal = useCallback((content: InfoDetail) => {
    setCurrentInfoModalContent(content);
    setIsInfoModalOpen(true);
  }, []);

  const closeInfoModal = useCallback(() => {
    setIsInfoModalOpen(false);
    setCurrentInfoModalContent(null);
  }, []);

  if (!isMounted) {
    return (
      <div className="flex justify-center items-center min-h-screen pt-20 bg-gradient-to-br from-gray-900 via-black to-gray-800">
        <p className="text-brand-green animate-pulse text-xl font-mono">{selectedLang === 'ru' ? "Загрузка CyberDev OS..." : "Loading CyberDev OS..."}</p>
      </div>
    );
  }
  
  const themePalette = ["brand-cyan", "brand-blue", "brand-pink", "neon-lime", "brand-purple"];

  return (
    <div className="relative min-h-screen bg-background text-foreground overflow-x-hidden">
      <RockstarHeroSection
        title={selectedLang === 'ru' ? "CyberDev OS: Ваше AI-Будущее" : "CyberDev OS: Your AI-Powered Future"}
        subtitle={selectedLang === 'ru' ? "Превратите свой рост в увлекательную игру с безграничными возможностями." : "Transform your growth into an exciting game of infinite possibilities."}
        triggerElementSelector={`#${heroTriggerId}`}
        backgroundImageObjectUrl="https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/carpix/brain_ai.jpg" // AI-themed background
      >
        <div className="flex space-x-2">
          <Button
            variant={selectedLang === 'ru' ? 'secondary' : 'outline'}
            size="sm"
            onClick={() => setSelectedLang('ru')}
            className={cn(
              "border-brand-cyan/50 font-orbitron text-xs backdrop-blur-sm",
              selectedLang === 'ru' ? 'bg-brand-cyan/20 text-brand-cyan hover:bg-brand-cyan/30' : 'bg-black/30 text-gray-300 hover:bg-gray-700 hover:text-gray-100'
            )}
          >
            🇷🇺 Русский
          </Button>
          <Button
            variant={selectedLang === 'en' ? 'secondary' : 'outline'}
            size="sm"
            onClick={() => setSelectedLang('en')}
            className={cn(
              "border-brand-blue/50 font-orbitron text-xs backdrop-blur-sm",
              selectedLang === 'en' ? 'bg-brand-blue/20 text-brand-blue hover:bg-brand-blue/30' : 'bg-black/30 text-gray-300 hover:bg-gray-700 hover:text-gray-100'
            )}
          >
            🇬🇧 English
          </Button>
        </div>
      </RockstarHeroSection>
      
      <div id={heroTriggerId} style={{ height: '150vh' }} aria-hidden="true" />

      <div className="relative z-10 container mx-auto px-4 pt-10 pb-10">
        <Card className="max-w-4xl mx-auto bg-black/85 backdrop-blur-xl text-white rounded-2xl border-2 border-brand-cyan/50 shadow-[0_0_35px_theme(colors.brand-cyan/0.5)]">
          <CardContent className="space-y-12 p-4 md:p-8 pt-8">

            {sections.map((section, index) => {
              const currentThemeColor = themePalette[index % themePalette.length];
              const textColorClass = `text-${currentThemeColor}`;
              const borderColorClass = `border-${currentThemeColor}/60`;
              const shadowColorClass = `hover:shadow-${currentThemeColor}/30`;
              const isSectionVisible = visibleSectionIds.has(section.id);
              const isQuestionAnswered = answeredQuestions[section.id]?.answered;
              const isCorrectAnswer = answeredQuestions[section.id]?.correct; 
              const nextSection = sections[index + 1];

              return (
                <motion.section 
                  key={section.id} 
                  id={section.id} 
                  className={cn(
                    `space-y-4 border-l-4 pl-4 md:pl-6 py-4 rounded-r-lg bg-dark-card/50 transition-shadow duration-300`,
                     borderColorClass,
                     shadowColorClass,
                     !isSectionVisible && 'opacity-30 pointer-events-none' 
                  )}
                  initial={{ opacity: 0, x: -30 }}
                  animate={{ opacity: isSectionVisible ? 1 : 0.3, x: isSectionVisible ? 0 : -30 }}
                  transition={{ duration: 0.5, delay: index * 0.1 }}
                >
                  <h2 className={cn(`flex items-center text-2xl md:text-3xl font-semibold mb-3 font-orbitron`, textColorClass)}>
                    <span className={cn(`mr-3 text-current/80`)}>
                      <VibeContentRenderer content={section.icon} />
                    </span>
                    <VibeContentRenderer content={section.title} />
                    {section.infoDetails && (
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="p-1 h-auto text-current/70 hover:text-current hover:bg-transparent ml-2"
                        onClick={() => openInfoModal(section.infoDetails!)}
                        aria-label={selectedLang === 'ru' ? "Подробнее" : "More info"}
                      >
                        <FaCircleInfo className="w-5 h-5" />
                      </Button>
                    )}
                  </h2>

                  {section.points && section.points.map((point, i) => (
                    <div key={i} className="text-gray-300 text-base md:text-lg leading-relaxed prose prose-sm md:prose-base prose-invert max-w-none prose-strong:font-orbitron prose-a:text-brand-blue hover:prose-a:text-brand-cyan prose-li:marker:text-current">
                        <VibeContentRenderer content={`• ${point}`} />
                    </div>
                  ))}
                  
                  {section.subSections && section.subSections.map((sub, subIndex) => (
                       <div key={`${section.id}-sub-${subIndex}`} className={`ml-4 pl-4 border-l-2 ${sub.borderColor} space-y-3 mb-6`}>
                         <h3 className={`flex items-center text-xl font-semibold ${sub.textColor}`}>
                           <span className="mr-2">
                             <VibeContentRenderer content={sub.icon} />
                           </span>
                           <VibeContentRenderer content={sub.title} />
                           {sub.infoDetails && (
                              <Button 
                                variant="ghost" 
                                size="sm" 
                                className="p-1 h-auto text-current/70 hover:text-current hover:bg-transparent ml-2"
                                onClick={() => openInfoModal(sub.infoDetails!)}
                                aria-label={selectedLang === 'ru' ? "Подробнее" : "More info"}
                              >
                                <FaCircleInfo className="w-5 h-5" />
                              </Button>
                            )}
                         </h3>
                         <ul className="list-disc list-outside space-y-2 text-gray-300 pl-5 text-base md:text-lg leading-relaxed prose prose-sm md:prose-base prose-invert max-w-none prose-strong:font-orbitron prose-a:text-brand-blue hover:prose-a:text-brand-cyan prose-li:marker:text-current">
                           {sub.points.map((point, i) => (
                             <li key={`${section.id}-sub-${subIndex}-${i}`} dangerouslySetInnerHTML={{ __html: point }}></li>
                           ))}
                         </ul>
                         {sub.imageUrl && (
                           <div className={`my-4 p-1 border ${sub.borderColor}/30 rounded-md bg-black/20 max-w-sm mx-auto`}>
                             <Image
                               src={sub.imageUrl} alt={sub.imageAlt} width={600} height={338}
                               className="w-full h-auto object-cover rounded opacity-80" loading="lazy" placeholder="blur" blurDataURL={PLACEHOLDER_BLUR_URL_GAMIFIED}
                             />
                             <p className="text-xs text-center text-gray-400 mt-1 italic">{sub.imageAlt}</p>
                           </div>
                         )}
                       </div>
                   ))}
                  
                  {section.imageUrl && !section.subSections && (
                    <div className={cn(`my-5 p-1 border rounded-md bg-black/20 max-w-sm mx-auto`, borderColorClass.replace('/60','/30'))}>
                       <div className="aspect-video w-full h-auto overflow-hidden rounded bg-gray-800/40 relative">
                        <Image
                            src={section.imageUrl} alt={section.imageAlt} width={600} height={338}
                            className="w-full h-full object-cover opacity-80 hover:opacity-100 transition-opacity duration-300"
                            loading="lazy" placeholder="blur" blurDataURL={PLACEHOLDER_BLUR_URL_GAMIFIED}
                            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                        />
                       </div>
                      <p className="text-xs text-center text-gray-400 mt-1 italic">{section.imageAlt}</p>
                    </div>
                  )}

                  {section.notablePhrase && (
                    <motion.div
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.5, delay: 0.2 }}
                      className="my-6 p-4 rounded-lg bg-black/40 border border-brand-cyan/40 text-brand-cyan text-base md:text-lg italic font-semibold relative"
                    >
                      <p>{section.notablePhrase.text}</p>
                      <Button
                        onClick={() => handleSaveNote(section.notablePhrase!.text, section.id)}
                        className={cn(
                          "absolute bottom-2 right-2 p-1.5 text-xs rounded-md font-mono",
                          noteSavedFeedback[section.id] ? "bg-brand-green/80 text-white" : "bg-brand-blue/30 text-brand-blue hover:bg-brand-blue/50"
                        )}
                        size="sm"
                      >
                        {noteSavedFeedback[section.id] ? (selectedLang === 'ru' ? "Сохранено! " : "Saved! ") : (selectedLang === 'ru' ? "Сохранить заметку " : "Save Note ")}
                        <VibeContentRenderer 
                          content={noteSavedFeedback[section.id] ? "::FaCircleCheck::" : "::FaBookmark::"} 
                          className="ml-1" 
                        />
                      </Button>
                    </motion.div>
                  )}

                  {section.question && !isQuestionAnswered && currentActiveQuestionId === section.id && (
                      <motion.div
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ duration: 0.3 }}
                          className={cn("mt-6 p-4 rounded-lg border", "border-brand-yellow/50 bg-brand-yellow/10")}
                      >
                          <p className="text-lg font-semibold text-brand-yellow mb-4">
                              {section.question.text}
                          </p>
                          {section.question.type === 'yes_no' && (
                              <div className="flex gap-4">
                                  <Button 
                                      onClick={() => handleAnswer(section.id, 'yes', 'yes_no', nextSection?.id)}
                                      className="bg-brand-green hover:bg-brand-green/80 text-white flex-1"
                                  >
                                      {selectedLang === 'ru' ? "Да" : "Yes"}
                                  </Button>
                                  <Button 
                                      onClick={() => handleAnswer(section.id, 'no', 'yes_no', nextSection?.id)}
                                      className="bg-brand-red hover:bg-brand-red/80 text-white flex-1"
                                  >
                                      {selectedLang === 'ru' ? "Нет" : "No"}
                                  </Button>
                              </div>
                          )}
                          {section.question.type === 'multiple_choice' && (
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                  {section.question.options?.map((option, i) => (
                                      <Button
                                          key={i}
                                          onClick={() => handleAnswer(section.id, option, 'multiple_choice', nextSection?.id)}
                                          className="bg-brand-blue hover:bg-brand-blue/80 text-white"
                                      >
                                          {option}
                                      </Button>
                                  ))}
                              </div>
                          )}
                          {section.question.type === 'reflection' && (
                              <div className="flex flex-col gap-3">
                                  <Textarea 
                                      placeholder={selectedLang === 'ru' ? "Напишите здесь..." : "Write here..."}
                                      value={reflectionText}
                                      onChange={(e) => setReflectionText(e.target.value)}
                                      className="min-h-[80px] bg-black/30 border-brand-yellow/30 text-white placeholder-gray-500"
                                  />
                                  <Button 
                                      onClick={() => handleAnswer(section.id, reflectionText, 'reflection', nextSection?.id)}
                                      className="bg-brand-purple hover:bg-brand-purple/80 text-white font-orbitron"
                                      disabled={!reflectionText.trim()} 
                                  >
                                      {selectedLang === 'ru' ? "Готово" : "Done"}
                                  </Button>
                              </div>
                          )}
                      </motion.div>
                  )}

                  {section.question && isQuestionAnswered && (
                      <motion.div
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ duration: 0.3, delay: 0.1 }}
                          className="mt-6 p-4 rounded-lg border border-gray-700 bg-gray-900/50"
                      >
                          {section.question.type !== 'reflection' && ( 
                              <p className={cn("font-bold text-lg", isCorrectAnswer ? "text-brand-green" : "text-brand-red")}>
                                  {isCorrectAnswer ? (selectedLang === 'ru' ? "Верно!" : "Correct!") : (selectedLang === 'ru' ? "Неверно." : "Incorrect.")}
                              </p>
                          )}
                          {(showTipFor === section.id || section.question.type === 'reflection' || isCorrectAnswer) && ( 
                              <p className="text-sm text-gray-400 mt-2">
                                  {section.question.tip}
                              </p>
                          )}
                          {nextSection && (
                              <Button 
                                  onClick={() => {
                                      document.getElementById(nextSection.id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                                      setShowTipFor(null); 
                                  }}
                                  className="mt-4 bg-brand-blue hover:bg-brand-blue/80 text-white font-orbitron"
                              >
                                  {selectedLang === 'ru' ? "Продолжить" : "Continue"}
                              </Button>
                          )}
                          {!nextSection && (
                              <p className="mt-4 text-sm text-gray-400">
                                  {selectedLang === 'ru' ? "Вы успешно завершили интерактивный курс!" : "You have successfully completed the interactive course!"}
                              </p>
                          )}
                      </motion.div>
                  )}
                </motion.section>
              );
            })}

            {savedNotes.length > 0 && (
                <motion.section
                    initial={{ opacity: 0, y: 50 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5, delay: 0.3 }}
                    className="mt-12 p-6 rounded-lg border border-brand-green/50 bg-brand-green/10 shadow-lg space-y-4"
                >
                    <h3 className="text-2xl font-orbitron font-semibold text-brand-green">
                        {selectedLang === 'ru' ? "📝 Ваши Заметки" : "📝 Your Notes"}
                    </h3>
                    <ul className="list-disc list-inside space-y-2 text-gray-300">
                        {savedNotes.map((note, idx) => (
                            <li key={idx} className="text-base">
                                <VibeContentRenderer content={note} />
                            </li>
                        ))}
                    </ul>
                    <Button
                        onClick={handleSendNotesToTelegram}
                        className="w-full bg-brand-purple hover:bg-brand-purple/80 text-white font-orbitron mt-4 flex items-center justify-center gap-2"
                    >
                        <VibeContentRenderer content="::FaPaperPlane::" className="h-5 w-5" />
                        {selectedLang === 'ru' ? "Отправить в Telegram" : "Send to Telegram"}
                    </Button>
                </motion.section>
            )}

            <section className="text-center pt-10 border-t border-brand-cyan/20 mt-10">
               <VibeContentRenderer 
                  content={selectedLang === 'ru' 
                    ? "Добро пожаловать в будущее саморазвития. С CyberDev OS вы не просто учитесь, вы создаёте свою новую реальность. <strong class='text-brand-cyan'>Ваш потенциал безграничен.</strong>"
                    : "Welcome to the future of self-development. With CyberDev OS, you're not just learning; you're building your new reality. <strong class='text-brand-cyan'>Your potential is infinite.</strong>"
                  } 
                  className="text-lg text-gray-300 italic prose prose-invert max-w-none prose-strong:text-brand-cyan"
                />
                <div className="mt-8 flex flex-wrap justify-center gap-3">
                    <Button asChild variant="outline" className="border-brand-blue text-brand-blue hover:bg-brand-blue/10 font-orbitron">
                        <Link href="/expmind">Мышление Экспериментатора</Link>
                    </Button>
                     <Button asChild variant="outline" className="border-brand-green text-brand-green hover:bg-brand-green/10 font-orbitron">
                        <Link href="/cybervibe">КиберВайб Апгрейд</Link>
                    </Button>
                     <Button asChild variant="outline" className="border-brand-pink text-brand-pink hover:bg-brand-pink/10 font-orbitron">
                        <Link href="/purpose-profit">Цель и Прибыль</Link>
                    </Button>
                </div>
            </section>

          </CardContent>
        </Card>
      </div>

      <Dialog open={isInfoModalOpen} onOpenChange={setIsInfoModalOpen}>
        <DialogContent className="sm:max-w-[425px] md:max-w-xl bg-dark-card border-brand-cyan/50 text-white shadow-[0_0_20px_rgba(0,255,255,0.4)]">
          <DialogHeader>
            <DialogTitle className="text-brand-cyan font-orbitron text-2xl">
              {currentInfoModalContent ? (selectedLang === 'ru' ? currentInfoModalContent.titleRu : currentInfoModalContent.titleEn) : ""}
            </DialogTitle>
          </DialogHeader>
          <div className="py-4 text-gray-300 text-base leading-relaxed">
            {currentInfoModalContent ? (selectedLang === 'ru' ? currentInfoModalContent.contentRu : currentInfoModalContent.contentEn) : ""}
          </div>
          <Button onClick={closeInfoModal} className="mt-4 bg-brand-blue hover:bg-brand-blue/80 text-white font-orbitron">
            {selectedLang === 'ru' ? "Закрыть" : "Close"}
          </Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}
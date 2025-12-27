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
import { motion, AnimatePresence } from "framer-motion"; // Import AnimatePresence
import RockstarHeroSection from "../tutorials/RockstarHeroSection"; 
import { Textarea } from "@/components/ui/textarea"; // Import Textarea

type Language = 'en' | 'ru';

// Define a more flexible question type
interface SectionQuestion {
  type: 'yes_no' | 'multiple_choice' | 'reflection';
  textRu: string;
  textEn: string;
  correctAnswer?: 'yes' | 'no' | string; // For yes_no or multiple_choice (text of correct option)
  optionsRu?: string[]; // For multiple_choice
  optionsEn?: string[]; // For multiple_choice
  tipRu?: string;
  tipEn?: string;
}

interface SectionContent {
  id: string;
  icon: string;
  title: string;
  points: string[];
  imageUrl?: string;
  imageAlt: string;
  question: SectionQuestion;
  notablePhrase?: {
    textRu: string;
    textEn: string;
  };
}

const STORAGE_BASE_URL_CV = "https://placehold.co"; 
const PLACEHOLDER_BLUR_URL_CV = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII="; 

const pageTranslations = {
  ru: {
    pageTitle: "КиберВайб Апгрейд",
    pageSubtitle: "Главный ключ к твоему лучшему будущему – ЭТО ТЫ. Пришло время стать больше, чем ты есть, по заветам Джима Рона.",
    sections: [
      {
        id: "personal-development",
        icon: "::FaUserAstronaut::",
        title: "Фундамент: Ты – Главный Актив",
        points: [
          "Джим Рон говорил: <strong class='text-brand-yellow'>\"Работай над собой усерднее, чем над своей работой.\"</strong> Это ядро КиберВайба. Твоё личное развитие – это главный рычаг.",
          "Твой доход и успех редко превышают уровень твоего личного развития. Хочешь больше? Становись больше!",
          "Инвестируй в свои знания, навыки и мышление. Это самые ценные активы в быстро меняющемся кибер-мире.",
          "Здесь не просто платформа, это твоя <Link href='/selfdev' class='text-brand-blue hover:underline font-semibold'>SelfDev Лаборатория</Link> для прокачки.",
        ],
        imageUrl: `${STORAGE_BASE_URL_CV}/600x338/1a1a2e/FFEE00/png?text=ТЫ+-+Актив`,
        imageAlt: "Концептуальное изображение личного развития как основного актива",
        question: {
          type: 'yes_no',
          textRu: "Обучение – это в первую очередь инвестиция в себя, а не просто способ получить работу.",
          textEn: "Learning is primarily an investment in yourself, not just a way to get a job.",
          correctAnswer: 'yes',
          tipRu: "Именно так! Джим Рон подчеркивал, что работа над собой важнее работы.",
          tipEn: "That's right! Jim Rohn emphasized that working on yourself is more important than working on your job.",
        },
        notablePhrase: {
          textRu: "Твой доход и успех редко превышают уровень твоего личного развития. Хочешь больше? Становись больше!",
          textEn: "Your income and success rarely exceed your personal development. Want more? Become more!",
        }
      },
      {
        id: "goal-setting",
        icon: "::FaBullseye::",
        title: "Карта Сокровищ: Сила Целей",
        points: [
          "Рон утверждал: <strong class='text-brand-yellow'>\"Если у тебя нет списка целей, я могу угадать твой банковский баланс с точностью до нескольких сотен долларов.\"</strong>",
          "Запиши свои цели: экономические, материальные, личное развитие. Сделай их конкретными, измеримыми, достижимыми, релевантными и ограниченными по времени (SMART).",
          "<strong class='text-brand-yellow'>Причины важнее ответов.</strong> Найди свои 'почему' – личные, семейные, даже мелкие 'nitty-gritty' причины, которые зажгут в тебе огонь.",
          "Твой <Link href='/game-plan' class='text-brand-blue hover:underline font-semibold'>Game Plan</Link> – это твоя стратегия, а <Link href='/p-plan' class='text-brand-blue hover:underline font-semibold'>P-Plan</Link> – твой тактический дневник для её воплощения.",
        ],
        imageUrl: `${STORAGE_BASE_URL_CV}/600x338/1a1a2e/00FFEE/png?text=Карта+Целей`,
        imageAlt: "Визуализация карты целей и пути к ним",
        question: {
          type: 'multiple_choice',
          textRu: "Представьте, что вы поставили цель 'хочу стать успешным'. Какой ключевой элемент SMART-цели вы упустили в этой формулировке?",
          textEn: "Imagine you set a goal 'I want to be successful'. Which key SMART goal element did you miss in this wording?",
          optionsRu: ["Конкретность", "Измеримость", "Ограничение по времени", "Все вышеперечисленное"],
          optionsEn: ["Specific", "Measurable", "Time-bound", "All of the above"],
          correctAnswer: "Все вышеперечисленное",
          tipRu: "Верно! Цель должна быть конкретной, измеримой, достижимой, релевантной и ограниченной по времени (SMART).",
          tipEn: "Correct! Goals should be Specific, Measurable, Achievable, Relevant, and Time-bound (SMART).",
        },
        notablePhrase: {
          textRu: "Если у тебя нет списка целей, я могу угадать твой банковский баланс с точностью до нескольких сотен долларов.",
          textEn: "If you don't have a list of your goals, I can guess your bank balance to within a few hundred dollars.",
        }
      },
      {
        id: "life-laws",
        icon: "::FaCanadianMapleLeaf::",
        title: "Законы Вселенной КиберВайба (Времена Года)",
        points: [
          "<strong class='text-brand-red'>Зима (Трудности):</strong> Неизбежны. Не желай, чтобы было легче; желай, чтобы ты был лучше. Учись справляться, становись сильнее.",
          "<strong class='text-brand-green'>Весна (Возможности):</strong> Всегда приходит после зимы. Используй её! 'Сей весной или проси осенью.' Запускай новые проекты, учись новому.",
          "<strong class='text-brand-orange'>Лето (Защита):</strong> Всё хорошее будет атаковано. Защищай свои достижения, идеи, ценности. Будь бдителен.",
          "<strong class='text-brand-yellow'>Осень (Жатва):</strong> Собирай урожай без жалоб (если он мал) и без извинений (если он велик). Принимай полную ответственность за свои результаты.",
          "Прокачай свое <Link href='/expmind' class='text-brand-blue hover:underline font-semibold'>Мышление Экспериментатора</Link> для навигации по этим сезонам.",
        ],
        imageUrl: `${STORAGE_BASE_URL_CV}/600x338/1a1a2e/FF9900/png?text=Сезоны+Жизни`,
        imageAlt: "Иллюстрация четырех времен года как метафоры жизненных циклов",
        question: {
          type: 'yes_no',
          textRu: "Зима (трудности) в жизни неизбежна, и нужно просто переждать её, не пытаясь измениться.",
          textEn: "Winter (difficulties) in life is inevitable, and you just need to wait it out without trying to change.",
          correctAnswer: 'no',
          tipRu: "Не совсем! Трудности неизбежны, но важно не просто ждать, а становиться лучше и сильнее в процессе.",
          tipEn: "Not quite! Difficulties are inevitable, but it's important not just to wait, but to get better and stronger in the process.",
        },
        notablePhrase: {
          textRu: "Ты не можешь изменить времена года, но можешь изменить себя.",
          textEn: "You cannot change the seasons, but you can change yourself.",
        }
      },
      {
        id: "action-discipline",
        icon: "::FaBolt::",
        title: "Двигатель Прогресса: Действие и Дисциплина",
        points: [
          "<strong class='text-brand-yellow'>\"Не то, что случается, определяет твою жизнь, а то, что ТЫ ДЕЛАЕШЬ с тем, что случается.\"</strong>",
          "Дисциплина – мост между целями и их достижением. Начни с малых шагов, вырабатывай привычку действовать.",
          "Самомотивация – твой внутренний огонь. Не жди, что кто-то придёт и 'включит' тебя. Найди свои причины и действуй.",
          "Начни действовать прямо сейчас в <Link href='/repo-xml' class='text-brand-blue hover:underline font-semibold'>SuperVibe Studio</Link>, применяя новые знания.",
        ],
        imageUrl: `${STORAGE_BASE_URL_CV}/600x338/1a1a2e/FF00FF/png?text=Действие!`,
        imageAlt: "Символ молнии, представляющий действие и энергию",
        question: {
          type: 'reflection',
          textRu: "Опишите один маленький шаг, который вы можете сделать прямо сейчас, чтобы начать двигаться к одной из ваших целей.",
          textEn: "Describe one tiny step you can take right now to start moving towards one of your goals.",
          tipRu: "Отличная идея! Главное – начать и поддерживать дисциплину, даже с маленьких шагов.",
          tipEn: "Great idea! The main thing is to start and maintain discipline, even with small steps.",
        },
        notablePhrase: {
          textRu: "Не то, что случается, определяет твою жизнь, а то, что ТЫ ДЕЛАЕШЬ с тем, что случается.",
          textEn: "It's not what happens that determines your life, but what YOU DO with what happens.",
        }
      },
      {
        id: "attitude-diseases",
        icon: "::FaHeadSideVirus::",
        title: "Антивирус для Разума: Болезни Отношения",
        points: [
          "<strong class='text-brand-yellow'>Излишняя Осторожность:</strong> Жизнь рискованна по своей сути. 'Если думаешь, что пытаться рискованно, подожди, пока тебе выставят счет за то, что ты не пытался.'",
          "<strong class='text-brand-yellow'>Пессимизм:</strong> Ищи хорошее, а не плохое. Стакан всегда наполовину полон для того, кто хочет видеть возможности.",
          "<strong class='text-brand-yellow'>Жалобы:</strong> 'Потрать пять минут на жалобы, и ты впустую потратил пять минут.' Сосредоточься на решениях, а не на проблемах.",
          "Твоё <Link href='/expmind' class='text-brand-blue hover:underline font-semibold'>Мышление</Link> – это твоя операционная система. Обновляй её регулярно.",
        ],
        imageUrl: `${STORAGE_BASE_URL_CV}/600x338/1a1a2e/FF4500/png?text=Позитивный+Настрой`,
        imageAlt: "Щит, отражающий негативные мысли, символизирующий сильное мышление",
        question: {
          type: 'yes_no',
          textRu: "Пессимизм – это лишь реалистичный взгляд на мир, и он не мешает личному развитию.",
          textEn: "Pessimism is just a realistic view of the world, and it doesn't hinder personal development.",
          correctAnswer: 'no',
          tipRu: "На самом деле, пессимизм может быть одним из 'вирусов' мышления. Позитивный настрой открывает больше возможностей.",
          tipEn: "Actually, pessimism can be one of the 'mind viruses.' A positive attitude opens up more opportunities.",
        },
        notablePhrase: {
          textRu: "Потрать пять минут на жалобы, и ты впустую потратил пять минут.",
          textEn: "Spend five minutes complaining, and you've wasted five minutes.",
        }
      },
      {
        id: "emotions-for-change",
        icon: "::FaFire::",
        title: "Эмоциональный Реактор: Топливо для Перемен",
        points: [
          "Джим Рон выделял эмоции, способные изменить жизнь за один день:",
          "<strong class='text-brand-red'>Отвращение:</strong> Сказать 'С меня хватит!' текущей ситуации.",
          "<strong class='text-brand-cyan'>Решение:</strong> Принять твердое решение измениться, действовать.",
          "<strong class='text-brand-yellow'>Желание:</strong> Зажечь сильное, страстное желание достичь цели.",
          "<strong class='text-brand-purple'>Решимость:</strong> Сказать 'Я сделаю это!' и не отступать.",
        ],
        imageUrl: `${STORAGE_BASE_URL_CV}/600x338/1a1a2e/9400D3/png?text=Эмоции+Перемен`,
        imageAlt: "Яркое пламя, символизирующее силу эмоций",
        question: {
          type: 'multiple_choice',
          textRu: "Какая эмоция, по Джиму Рону, является первым шагом к радикальным изменениям в жизни?",
          textEn: "Which emotion, according to Jim Rohn, is the first step toward radical life changes?",
          optionsRu: ["Желание", "Решимость", "Отвращение", "Радость"],
          optionsEn: ["Desire", "Resolve", "Disgust", "Joy"],
          correctAnswer: "Отвращение",
          tipRu: "Верно! 'Отвращение' к текущей ситуации – мощный катализатор для начала перемен.",
          tipEn: "Correct! 'Disgust' with the current situation is a powerful catalyst for initiating change.",
        },
        notablePhrase: {
          textRu: "Четыре эмоции, способные изменить жизнь за один день: отвращение, решение, желание, решимость.",
          textEn: "Four emotions that can change your life in one day: Disgust, Decision, Desire, Resolve.",
        }
      },
      {
        id: "sowing-reaping",
        icon: "::FaSeedling::",
        title: "Вселенский Принцип: Посев и Жатва",
        points: [
          "<strong class='text-brand-yellow'>Что посеешь, то и пожнёшь.</strong> И часто пожнёшь гораздо больше, чем посеял.",
          "Этот закон работает во всех сферах: знания, усилия, отношения, финансы.",
          "Сей щедро и с умом. Твои действия сегодня формируют твою завтрашнюю жатву.",
          "Создавая ценность (<Link href='/purpose-profit' class='text-brand-blue hover:underline font-semibold'>Purpose</Link>), ты обеспечиваешь себе богатый урожай (<Link href='/purpose-profit' class='text-brand-blue hover:underline font-semibold'>Profit</Link>).",
        ],
        imageUrl: `${STORAGE_BASE_URL_CV}/600x338/1a1a2e/32CD32/png?text=Посев+и+Жатва`,
        imageAlt: "Росток, пробивающийся из земли, и зрелые колосья",
        question: {
          type: 'yes_no',
          textRu: "Принцип 'Что посеешь, то и пожнёшь' применим только к финансам и не относится к знаниям или отношениям.",
          textEn: "The 'What you sow, you will reap' principle only applies to finances and not to knowledge or relationships.",
          correctAnswer: 'no',
          tipRu: "Этот принцип универсален! Он работает во всех сферах жизни: в знаниях, усилиях, отношениях и финансах.",
          tipEn: "This principle is universal! It works in all areas of life: knowledge, effort, relationships, and finances.",
        },
        notablePhrase: {
          textRu: "Что посеешь, то и пожнёшь. И часто пожнёшь гораздо больше, чем посеял.",
          textEn: "What you sow, you will reap. And often, you will reap much more than you sowed.",
        }
      },
      {
        id: "law-of-use",
        icon: "::FaDumbbell::",
        title: "Закон Активации: Используй или Потеряешь",
        points: [
          "<strong class='text-brand-yellow'>Любой талант, не используемый, угасает. Любые знания, не применяемые, забываются.</strong>",
          "Активно используй свои навыки, идеи, связи. Не давай им 'заржаветь'.",
          "Притча о талантах: тот, кто не использовал свой талант, потерял его.",
          "Постоянная практика и применение – ключ к сохранению и приумножению твоего потенциала.",
        ],
        imageUrl: `${STORAGE_BASE_URL_CV}/600x338/1a1a2e/4682B4/png?text=Используй+или+Потеряешь`,
        imageAlt: "Сильная рука, держащая инструмент, символизирующая активное использование",
        question: {
          type: 'yes_no',
          textRu: "Если у вас есть талант или знания, они останутся с вами, даже если вы не будете их активно использовать.",
          textEn: "If you have a talent or knowledge, it will stay with you even if you don't actively use it.",
          correctAnswer: 'no',
          tipRu: "К сожалению, нет. Закон активации гласит: 'Используй или потеряешь'. Таланты и знания угасают без применения.",
          tipEn: "Unfortunately, no. The Law of Use states: 'Use it or lose it.' Talents and knowledge fade without application.",
        },
        notablePhrase: {
          textRu: "Любой талант, не используемый, угасает. Любые знания, не применяемые, забываются.",
          textEn: "Any talent not used, fades. Any knowledge not applied, is forgotten.",
        }
      },
      {
        id: "reading-learning",
        icon: "::FaBookOpenReader::",
        title: "Топливо для Роста: Чтение и Обучение",
        points: [
          "<strong class='text-brand-yellow'>Все успешные люди – ненасытные читатели и ученики.</strong>",
          "Одна книга может сэкономить тебе пять лет жизни, предостерегая от ошибок или открывая новые пути.",
          "Не оставляй свой успех и развитие на волю случая. Сделай их предметом изучения.",
          "Погружайся в <Link href='/selfdev' class='text-brand-blue hover:underline font-semibold'>SelfDev</Link>, читай, анализируй, применяй. Это твой путь к мастерству в КиберВайбе.",
        ],
        imageUrl: `${STORAGE_BASE_URL_CV}/600x338/1a1a2e/8B4513/png?text=Чтение+-+Сила`,
        imageAlt: "Открытая книга, из которой исходит свет знания",
        question: {
          type: 'reflection',
          textRu: "Назовите одну тему или навык, который вы хотели бы изучить в ближайшее время, и как это поможет вам расти в КиберВайбе.",
          textEn: "Name one topic or skill you'd like to learn soon, and how it will help you grow within CyberVibe.",
          tipRu: "Отличный выбор! Продолжайте учиться и применять новые знания – это бесконечное топливо для роста.",
          tipEn: "Great choice! Keep learning and applying new knowledge – it's endless fuel for growth.",
        },
        notablePhrase: {
          textRu: "Одна книга может сэкономить тебе пять лет жизни, предостерегая от ошибок или открывая новые пути.",
          textEn: "One book can save you five years of life, warning against mistakes or opening new paths.",
        }
      },
    ] as SectionContent[] // Explicitly type the sections array
  },
  en: {
    pageTitle: "CyberVibe Upgrade",
    pageSubtitle: "The major key to your better future is YOU. It's time to become more than you are, inspired by Jim Rohn.",
    sections: [
      {
        id: "personal-development",
        icon: "::FaUserAstronaut::",
        title: "Foundation: You Are The Main Asset",
        points: [
          "Jim Rohn said: <strong class='text-brand-yellow'>\"Work harder on yourself than you do on your job.\"</strong> This is the core of CyberVibe. Your personal development is the main lever.",
          "Your income and success rarely exceed your personal development. Want more? Become more!",
          "Invest in your knowledge, skills, and mindset. These are the most valuable assets in the rapidly changing cyber-world.",
          "This isn't just a platform; it's your <Link href='/selfdev' class='text-brand-blue hover:underline font-semibold'>SelfDev Laboratory</Link> for leveling up.",
        ],
        imageUrl: `${STORAGE_BASE_URL_CV}/600x338/1a1a2e/FFEE00/png?text=YOU+-+Asset`,
        imageAlt: "Conceptual image of personal development as the main asset",
        question: {
          type: 'yes_no',
          textRu: "Обучение – это в первую очередь инвестиция в себя, а не просто способ получить работу.",
          textEn: "Learning is primarily an investment in yourself, not just a way to get a job.",
          correctAnswer: 'yes',
          tipRu: "Именно так! Джим Рон подчеркивал, что работа над собой важнее работы.",
          tipEn: "That's right! Jim Rohn emphasized that working on yourself is more important than working on your job.",
        },
        notablePhrase: {
          textRu: "Твой доход и успех редко превышают уровень твоего личного развития. Хочешь больше? Становись больше!",
          textEn: "Your income and success rarely exceed your personal development. Want more? Become more!",
        }
      },
      {
        id: "goal-setting",
        icon: "::FaBullseye::",
        title: "Treasure Map: The Power of Goals",
        points: [
          "Rohn stated: <strong class='text-brand-yellow'>\"If you don't have a list of your goals, I can guess your bank balance to within a few hundred dollars.\"</strong>",
          "Write down your goals: economic, material, personal development. Make them specific, measurable, achievable, relevant, and time-bound (SMART).",
          "<strong class='text-brand-yellow'>Reasons come first, answers second.</strong> Find your 'whys' – personal, family, even small 'nitty-gritty' reasons that will ignite your fire.",
          "Your <Link href='/game-plan' class='text-brand-blue hover:underline font-semibold'>Game Plan</Link> is your strategy, and your <Link href='/p-plan' class='text-brand-blue hover:underline font-semibold'>P-Plan</Link> – your tactical journal for its execution.",
        ],
        imageUrl: `${STORAGE_BASE_URL_CV}/600x338/1a1a2e/00FFEE/png?text=Goal+Map`,
        imageAlt: "Visualization of a goal map and the path to achieve them",
        question: {
          type: 'multiple_choice',
          textRu: "Представьте, что вы поставили цель 'хочу стать успешным'. Какой ключевой элемент SMART-цели вы упустили в этой формулировке?",
          textEn: "Imagine you set a goal 'I want to be successful'. Which key SMART goal element did you miss in this wording?",
          optionsRu: ["Конкретность", "Измеримость", "Ограничение по времени", "Все вышеперечисленное"],
          optionsEn: ["Specific", "Measurable", "Time-bound", "All of the above"],
          correctAnswer: "All of the above",
          tipRu: "Верно! Цель должна быть конкретной, измеримой, достижимой, релевантной и ограниченной по времени (SMART).",
          tipEn: "Correct! Goals should be Specific, Measurable, Achievable, Relevant, and Time-bound (SMART).",
        },
        notablePhrase: {
          textRu: "Если у тебя нет списка целей, я могу угадать твой банковский баланс с точностью до нескольких сотен долларов.",
          textEn: "If you don't have a list of your goals, I can guess your bank balance to within a few hundred dollars.",
        }
      },
      {
        id: "life-laws",
        icon: "::FaCanadianMapleLeaf::",
        title: "Laws of the CyberVibe Universe (The Seasons)",
        points: [
          "<strong class='text-brand-red'>Winter (Difficulties):</strong> They are inevitable. Don't wish it were easier; wish you were better. Learn to cope, become stronger.",
          "<strong class='text-brand-green'>Spring (Opportunities):</strong> Always comes after winter. Use it! 'Sow in the spring or beg in the fall.' Launch new projects, learn new things.",
          "<strong class='text-brand-orange'>Summer (Protection):</strong> All good things will be attacked. Protect your achievements, ideas, values. Be vigilant.",
          "<strong class='text-brand-yellow'>Autumn (Harvest):</strong> Reap without complaint (if it's small) and without apology (if it's large). Take full responsibility for your results.",
          "Upgrade your <Link href='/expmind' class='text-brand-blue hover:underline font-semibold'>Experimental Mindset</Link> to navigate these seasons.",
        ],
        imageUrl: `${STORAGE_BASE_URL_CV}/600x338/1a1a2e/FF9900/png?text=Seasons+of+Life`,
        imageAlt: "Illustration of the four seasons as a metaphor for life cycles",
        question: {
          type: 'yes_no',
          textRu: "Зима (трудности) в жизни неизбежна, и нужно просто переждать её, не пытаясь измениться.",
          textEn: "Winter (difficulties) in life is inevitable, and you just need to wait it out without trying to change.",
          correctAnswer: 'no',
          tipRu: "Не совсем! Трудности неизбежны, но важно не просто ждать, а становиться лучше и сильнее в процессе.",
          tipEn: "Not quite! Difficulties are inevitable, but it's important not just to wait, but to get better and stronger in the process.",
        },
        notablePhrase: {
          textRu: "Ты не можешь изменить времена года, но можешь изменить себя.",
          textEn: "You cannot change the seasons, but you can change yourself.",
        }
      },
      {
        id: "action-discipline",
        icon: "::FaBolt::",
        title: "Engine of Progress: Action & Discipline",
        points: [
          "<strong class='text-brand-yellow'>\"It's not what happens that determines your life, but what YOU DO with what happens.\"</strong>",
          "Dicipline – bridge between goals and accomplishment. Start with small steps, build a habit of action.",
          "Self-motivation – your inner fire. Don't wait for someone to come and 'turn you on.' Find your reasons and act.",
          "Start acting now in the <Link href='/repo-xml' class='text-brand-blue hover:underline font-semibold'>SuperVibe Studio</Link>, applying new knowledge.",
        ],
        imageUrl: `${STORAGE_BASE_URL_CV}/600x338/1a1a2e/FF00FF/png?text=Action!`,
        imageAlt: "Lightning bolt symbol representing action and energy",
        question: {
          type: 'reflection',
          textRu: "Опишите один маленький шаг, который вы можете сделать прямо сейчас, чтобы начать двигаться к одной из ваших целей.",
          textEn: "Describe one tiny step you can take right now to start moving towards one of your goals.",
          tipRu: "Отличная идея! Главное – начать и поддерживать дисциплину, даже с маленьких шагов.",
          tipEn: "Great idea! The main thing is to start and maintain discipline, even with small steps.",
        },
        notablePhrase: {
          textRu: "Не то, что случается, определяет твою жизнь, а то, что ТЫ ДЕЛАЕШЬ с тем, что случается.",
          textEn: "It's not what happens that determines your life, but what YOU DO with what happens.",
        }
      },
      {
        id: "attitude-diseases",
        icon: "::FaHeadSideVirus::",
        title: "Mind Antivirus: Diseases of Attitude",
        points: [
          "<strong class='text-brand-yellow'>Over-Caution:</strong> Life is inherently risky. 'If you think trying is risky, wait till they hand you the bill for not trying.'",
          "<strong class='text-brand-yellow'>Pessimism:</strong> Look for the good, not the bad. The glass is always half full for those who want to see opportunities.",
          "<strong class='text-brand-yellow'>Complaining:</strong> 'Spend five minutes complaining, and you've wasted five minutes.' Focus on solutions, not problems.",
          "Your <Link href='/expmind' class='text-brand-blue hover:underline font-semibold'>Mindset</Link> is your operating system. Update it regularly.",
        ],
        imageUrl: `${STORAGE_BASE_URL_CV}/600x338/1a1a2e/FF4500/png?text=Positive+Mindset`,
        imageAlt: "A shield reflecting negative thoughts, symbolizing a strong mindset",
        question: {
          type: 'yes_no',
          textRu: "Пессимизм – это лишь реалистичный взгляд на мир, и он не мешает личному развитию.",
          textEn: "Pessimism is just a realistic view of the world, and it doesn't hinder personal development.",
          correctAnswer: 'no',
          tipRu: "На самом деле, пессимизм может быть одним из 'вирусов' мышления. Позитивный настрой открывает больше возможностей.",
          tipEn: "Actually, pessimism can be one of the 'mind viruses.' A positive attitude opens up more opportunities.",
        },
        notablePhrase: {
          textRu: "Потрать пять минут на жалобы, и ты впустую потратил пять минут.",
          textEn: "Spend five minutes complaining, and you've wasted five minutes.",
        }
      },
      {
        id: "emotions-for-change",
        icon: "::FaFire::",
        title: "Emotional Reactor: Fuel for Change",
        points: [
          "Jim Rohn highlighted emotions capable of changing life in a single day:",
          "<strong class='text-brand-red'>Disgust:</strong> Saying 'I've had enough!' with the current situation.",
          "<strong class='text-brand-cyan'>Decision:</strong> Making a firm decision to change, to act.",
          "<strong class='text-brand-yellow'>Desire:</b> Igniting a strong, passionate desire to achieve a goal.",
          "<strong class='text-brand-purple'>Resolve:</strong> Saying 'I will do it!' and not backing down.",
        ],
        imageUrl: `${STORAGE_BASE_URL_CV}/600x338/1a1a2e/9400D3/png?text=Emotions+of+Change`,
        imageAlt: "A bright flame symbolizing the power of emotions",
        question: {
          type: 'multiple_choice',
          textRu: "Какая эмоция, по Джиму Рону, является первым шагом к радикальным изменениям в жизни?",
          textEn: "Which emotion, according to Jim Rohn, is the first step toward radical life changes?",
          optionsRu: ["Желание", "Решимость", "Отвращение", "Радость"],
          optionsEn: ["Desire", "Resolve", "Disgust", "Joy"],
          correctAnswer: "Disgust",
          tipRu: "Верно! 'Отвращение' к текущей ситуации – мощный катализатор для начала перемен.",
          tipEn: "Correct! 'Disgust' with the current situation is a powerful catalyst for initiating change.",
        },
        notablePhrase: {
          textRu: "Четыре эмоции, способные изменить жизнь за один день: отвращение, решение, желание, решимость.",
          textEn: "Four emotions that can change your life in one day: Disgust, Decision, Desire, Resolve.",
        }
      },
      {
        id: "sowing-reaping",
        icon: "::FaSeedling::",
        title: "Universal Principle: Sowing & Reaping",
        points: [
          "<strong class='text-brand-yellow'>What you sow, you will reap.</strong> And often, you will reap much more than you sowed.",
          "This law works in all areas: knowledge, effort, relationships, finances.",
          "Sow generously and wisely. Your actions today shape your harvest tomorrow.",
          "By creating value (<Link href='/purpose-profit' class='text-brand-blue hover:underline font-semibold'>Purpose</Link>), you ensure a rich harvest (<Link href='/purpose-profit' class='text-brand-blue hover:underline font-semibold'>Profit</Link>).",
        ],
        imageUrl: `${STORAGE_BASE_URL_CV}/600x338/1a1a2e/32CD32/png?text=Посев+и+Жатва`,
        imageAlt: "Росток, пробивающийся из земли, и зрелые колосья",
        question: {
          type: 'yes_no',
          textRu: "Принцип 'Что посеешь, то и пожнёшь' применим только к финансам и не относится к знаниям или отношениям.",
          textEn: "The 'What you sow, you will reap' principle only applies to finances and not to knowledge or relationships.",
          correctAnswer: 'no',
          tipRu: "Этот принцип универсален! Он работает во всех сферах жизни: в знаниях, усилиях, отношениях и финансах.",
          tipEn: "This principle is universal! It works in all areas of life: knowledge, effort, relationships, and finances.",
        },
        notablePhrase: {
          textRu: "Что посеешь, то и пожнёшь. И часто пожнёшь гораздо больше, чем посеял.",
          textEn: "What you sow, you will reap. And often, you will reap much more than you sowed.",
        }
      },
      {
        id: "law-of-use",
        icon: "::FaDumbbell::",
        title: "Закон Активации: Используй или Потеряешь",
        points: [
          "<strong class='text-brand-yellow'>Any talent not used, uades. Any knowledge not applied, is forgotten.</strong>",
          "Actively use your skills, ideas, connections. Don't let them 'rust'.",
          "The parable of talents: he who did not use his talent, lost it.",
          "Constant practice and application are key to preserving and multiplying your potential.",
        ],
        imageUrl: `${STORAGE_BASE_URL_CV}/600x338/1a1a2e/4682B4/png?text=Используй+или+Потеряешь`,
        imageAlt: "Сильная рука, держащая инструмент, символизирующая активное использование",
        question: {
          type: 'yes_no',
          textRu: "Если у вас есть талант или знания, они останутся с вами, даже если вы не будете их активно использовать.",
          textEn: "If you have a talent or knowledge, it will stay with you even if you don't actively use it.",
          correctAnswer: 'no',
          tipRu: "К сожалению, нет. Закон активации гласит: 'Используй или потеряешь'. Таланты и знания угасают без применения.",
          tipEn: "Unfortunately, no. The Law of Use states: 'Use it or lose it.' Talents and knowledge fade without application.",
        },
        notablePhrase: {
          textRu: "Любой талант, не используемый, угасает. Любые знания, не применяемые, забываются.",
          textEn: "Any talent not used, fades. Any knowledge not applied, is forgotten.",
        }
      },
      {
        id: "reading-learning",
        icon: "::FaBookOpenReader::",
        title: "Топливо для Роста: Чтение и Обучение",
        points: [
          "<strong class='text-brand-yellow'>Все успешные люди – ненасытные читатели и ученики.</strong>",
          "Одна книга может сэкономить тебе пять лет жизни, предостерегая от ошибок или открывая новые пути.",
          "Не оставляй свой успех и развитие на волю случая. Сделай их предметом изучения.",
          "Погружайся в <Link href='/selfdev' class='text-brand-blue hover:underline font-semibold'>SelfDev</Link>, читай, анализируй, применяй. Это твой путь к мастерству в КиберВайбе.",
        ],
        imageUrl: `${STORAGE_BASE_URL_CV}/600x338/1a1a2e/8B4513/png?text=Чтение+-+Сила`,
        imageAlt: "Открытая книга, из которой исходит свет знания",
        question: {
          type: 'reflection',
          textRu: "Назовите одну тему или навык, который вы хотели бы изучить в ближайшее время, и как это поможет вам расти в КиберВайбе.",
          textEn: "Name one topic or skill you'd like to learn soon, and how it will help you grow within CyberVibe.",
          tipRu: "Отличный выбор! Продолжайте учиться и применять новые знания – это бесконечное топливо для роста.",
          tipEn: "Great choice! Keep learning and applying new knowledge – it's endless fuel for growth.",
        },
        notablePhrase: {
          textRu: "Одна книга может сэкономить тебе пять лет жизни, предостерегая от ошибок или открывая новые пути.",
          textEn: "One book can save you five years of life, warning against mistakes or opening new paths.",
        }
      },
    ] as SectionContent[] // Explicitly type the sections array
  }
};

export default function CyberVibePage() {
  const { user, tg, isInTelegramContext } = useAppContext();
  const [isMounted, setIsMounted] = useState(false);
  const [selectedLang, setSelectedLang] = useState<Language>('ru'); 
  const heroTriggerId = useId().replace(/:/g, "-") + "-hero-trigger"; 

  // Interactive content state
  const [visibleSectionIds, setVisibleSectionIds] = useState<Set<string>>(new Set());
  const [answeredQuestions, setAnsweredQuestions] = useState<Record<string, { answered: boolean; correct?: boolean }>>({}); // 'correct' is optional for reflection type
  const [currentActiveQuestionId, setCurrentActiveQuestionId] = useState<string | null>(null);
  const [showTipFor, setShowTipFor] = useState<string | null>(null);
  const [reflectionText, setReflectionText] = useState<string>("");
  const [savedNotes, setSavedNotes] = useState<string[]>([]);
  const [noteSavedFeedback, setNoteSavedFeedback] = useState<Record<string, boolean>>({});


  useEffect(() => {
    setIsMounted(true);
    const browserLang = typeof navigator !== 'undefined' ? navigator.language.split('-')[0] : 'ru';
    const initialLang = user?.language_code === 'ru' || (!user?.language_code && browserLang === 'ru') ? 'ru' : 'en'; 
    setSelectedLang(initialLang);
    logger.log(`[CyberVibePage] Mounted. Browser lang: ${browserLang}, Initial selected: ${initialLang}`);
  }, [user?.language_code]); 

  const t = pageTranslations[selectedLang];

  useEffect(() => {
    if (isMounted && t && t.sections.length > 0 && visibleSectionIds.size === 0) {
        setVisibleSectionIds(new Set([t.sections[0].id]));
        setCurrentActiveQuestionId(t.sections[0].id);
    }
  }, [isMounted, t, visibleSectionIds.size]);

  const handleAnswer = useCallback((sectionId: string, userAnswer: 'yes' | 'no' | string, questionType: SectionQuestion['type'], nextSectionId?: string) => {
    const section = t.sections.find(s => s.id === sectionId);
    if (!section || !section.question) return;

    let isCorrect: boolean | undefined;

    if (questionType === 'yes_no' || questionType === 'multiple_choice') {
        isCorrect = userAnswer === section.question.correctAnswer;
    } else if (questionType === 'reflection') {
        isCorrect = true; // Reflection answers are always "correct" in terms of completion
        setReflectionText(""); // Clear reflection text after submission
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
  }, [t.sections]);

  const handleSaveNote = useCallback((noteText: string, sectionId: string) => {
    if (!savedNotes.includes(noteText)) {
      setSavedNotes(prevNotes => [...prevNotes, noteText]);
      setNoteSavedFeedback(prev => ({ ...prev, [sectionId]: true }));
      setTimeout(() => setNoteSavedFeedback(prev => ({ ...prev, [sectionId]: false })), 2000); // Reset feedback
    }
  }, [savedNotes]);

  const handleSendNotesToTelegram = useCallback(() => {
    if (savedNotes.length === 0) return;

    const notesHeader = selectedLang === 'ru' ? "📝 Ваши заметки из КиберВайб Апгрейда:\n\n" : "📝 Your notes from CyberVibe Upgrade:\n\n";
    const formattedNotes = savedNotes.map((note, index) => `${index + 1}. ${note}`).join('\n');
    const message = encodeURIComponent(notesHeader + formattedNotes + "\n\n#CyberVibe #oneSitePls");

    const shareUrl = `https://t.me/share/url?url=${encodeURIComponent("https://t.me/oneSitePlsBot/app")}&text=${message}`;

    if (isInTelegramContext && tg) {
      tg.openLink(shareUrl);
    } else {
      window.open(shareUrl, "_blank");
    }
  }, [savedNotes, selectedLang, isInTelegramContext, tg]);

  if (!isMounted || !t) {
    return (
      <div className="flex justify-center items-center min-h-screen pt-20 bg-gradient-to-br from-gray-900 via-black to-gray-800">
        <p className="text-brand-yellow animate-pulse text-xl font-mono">Загрузка КиберВайб Матрицы...</p>
      </div>
    );
  }
  
  const themePalette = ["brand-yellow", "brand-cyan", "brand-orange", "brand-pink", "brand-red", "brand-purple", "brand-green", "brand-blue", "neon-lime"];

  return (
    <div className="relative min-h-screen bg-background text-foreground overflow-x-hidden">
      <RockstarHeroSection
        title={t.pageTitle}
        subtitle={t.pageSubtitle}
        triggerElementSelector={`#${heroTriggerId}`}
        backgroundImageObjectUrl="https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/appStore/oneSitePls_transparent_icon.png"
      >
        <div className="flex space-x-2">
          <Button
            variant={selectedLang === 'ru' ? 'secondary' : 'outline'}
            size="sm"
            onClick={() => setSelectedLang('ru')}
            className={cn(
              "border-brand-yellow/50 font-orbitron text-xs backdrop-blur-sm",
              selectedLang === 'ru' ? 'bg-brand-yellow/20 text-brand-yellow hover:bg-brand-yellow/30' : 'bg-black/30 text-gray-300 hover:bg-gray-700 hover:text-gray-100'
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
        <Card className="max-w-4xl mx-auto bg-black/85 backdrop-blur-xl text-white rounded-2xl border-2 border-brand-yellow/50 shadow-[0_0_35px_theme(colors.brand-yellow/0.5)]">
          <CardContent className="space-y-12 p-4 md:p-8 pt-8">

            {t.sections.map((section, index) => {
              const currentThemeColor = themePalette[index % themePalette.length];
              const textColorClass = `text-${currentThemeColor}`;
              const borderColorClass = `border-${currentThemeColor}/60`;
              const shadowColorClass = `hover:shadow-${currentThemeColor}/30`;
              const isSectionVisible = visibleSectionIds.has(section.id);
              const isQuestionAnswered = answeredQuestions[section.id]?.answered;
              const isCorrectAnswer = answeredQuestions[section.id]?.correct; 
              const nextSection = t.sections[index + 1];

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
                  </h2>

                  {section.points.map((point, i) => (
                    <div key={i} className="text-gray-300 text-base md:text-lg leading-relaxed prose prose-sm md:prose-base prose-invert max-w-none prose-strong:font-orbitron prose-a:text-brand-blue hover:prose-a:text-brand-cyan prose-li:marker:text-current">
                        <VibeContentRenderer content={`• ${point}`} />
                    </div>
                  ))}
                  
                  {section.imageUrl && (
                    <div className={cn(`my-5 p-1 border rounded-md bg-black/20 max-w-sm mx-auto`, borderColorClass.replace('/60','/30'))}>
                       <div className="aspect-video w-full h-auto overflow-hidden rounded bg-gray-800/40 relative">
                        <Image
                            src={section.imageUrl} alt={section.imageAlt} width={600} height={338}
                            className="w-full h-full object-cover opacity-80 hover:opacity-100 transition-opacity duration-300"
                            loading="lazy" placeholder="blur" blurDataURL={PLACEHOLDER_BLUR_URL_CV}
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
                      <p>{selectedLang === 'ru' ? section.notablePhrase.textRu : section.notablePhrase.textEn}</p>
                      <Button
                        onClick={() => handleSaveNote(selectedLang === 'ru' ? section.notablePhrase!.textRu : section.notablePhrase!.textEn, section.id)}
                        className={cn(
                          "absolute bottom-2 right-2 p-1.5 text-xs rounded-md font-mono",
                          noteSavedFeedback[section.id] ? "bg-brand-green/80 text-white" : "bg-brand-blue/30 text-brand-blue hover:bg-brand-blue/50"
                        )}
                        size="sm"
                      >
                        {noteSavedFeedback[section.id] ? (selectedLang === 'ru' ? "Сохранено! ::FaCheck::" : "Saved! ::FaCheck::") : (selectedLang === 'ru' ? "Сохранить заметку ::FaBookmark::" : "Save Note ::FaBookmark::")}
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
                              {selectedLang === 'ru' ? section.question.textRu : section.question.textEn}
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
                                  {(selectedLang === 'ru' ? section.question.optionsRu : section.question.optionsEn)?.map((option, i) => (
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
                                  {selectedLang === 'ru' ? section.question.tipRu : section.question.tipEn}
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
                        <VibeContentRenderer content="::FaTelegramPlane::" className="h-5 w-5" />
                        {selectedLang === 'ru' ? "Отправить в Telegram" : "Send to Telegram"}
                    </Button>
                </motion.section>
            )}

            <section className="text-center pt-10 border-t border-brand-yellow/20 mt-10">
               <VibeContentRenderer 
                  content="Джим Рон оставил наследие мудрости. Твоя задача – взять эти принципы, пропустить через фильтр своего КиберВайба и построить жизнь, достойную легенды. <strong class='text-brand-yellow'>Ты – архитектор своего будущего.</strong>" 
                  className="text-lg text-gray-300 italic prose prose-invert max-w-none prose-strong:text-brand-yellow"
                />
                <div className="mt-8 flex flex-wrap justify-center gap-3">
                    <Button asChild variant="outline" className="border-brand-blue text-brand-blue hover:bg-brand-blue/10 font-orbitron">
                        <Link href="/selfdev">SelfDev Лаборатория</Link>
                    </Button>
                     <Button asChild variant="outline" className="border-brand-green text-brand-green hover:bg-brand-green/10 font-orbitron">
                        <Link href="/purpose-profit">Цель и Прибыль</Link>
                    </Button>
                    <Button asChild variant="outline" className="border-brand-pink text-brand-pink hover:bg-brand-pink/10 font-orbitron">
                        <Link href="/expmind">Мышление Экспериментатора</Link>
                    </Button>
                </div>
            </section>

          </CardContent>
        </Card>
      </div>
    </div>
  );
}
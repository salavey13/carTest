"use client";

import { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAppContext } from "@/contexts/AppContext";
import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  FaGlasses, FaMapSigns, FaBrain, FaTriangleExclamation, FaPlay, FaForward,
  FaPuzzlePiece, FaGears, FaRoad, FaQuestionCircle, FaEye, FaBullseye, FaRulerCombined,
  FaArrowsSpin, FaDumbbell, FaGamepad, FaLightbulb, FaRobot, FaRocket, FaBookOpen,
  FaBolt, FaToolbox, FaCode, FaBug, FaLink, FaMicrophone, FaVideo, FaDatabase, FaServer,
  FaMagnifyingGlass, FaMemory, FaKeyboard, FaBriefcase, FaMagnifyingGlassChart,
  FaUserAstronaut, FaHeart, FaUpLong, FaGithub, FaArrowUpRightFromSquare
} from "react-icons/fa6";
import { debugLogger } from "@/lib/debugLogger";
import Image from "next/image";
import Link from "next/link";
import { cn } from "@/lib/utils";
import VibeContentRenderer from "@/components/VibeContentRenderer";

type Language = 'en' | 'ru';

const PLACEHOLDER_BLUR_URL = "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMSIgaGVpZ2h0PSIxIiB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciPjxyZWN0IHdpZHRoPSIxIiBoZWlnaHQ9IjEiIGZpbGw9IiMwMDAiIGZpbGwtb3BhY2l0eT0iMC4xIi8+PC9zdmc+";

const imagePlaceholders = {
  placeholder1: {
    url: "https://placehold.co/600x338/0D0221/FF00FF?text=CyberSight+AR", // Updated colors
    altEn: "Augmented reality glasses symbolizing clarity and cybernetic vision",
    altRu: "Очки дополненной реальности, символизирующие кибер-ясность и видение",
    tooltipRu: "Визуализация 'Кибер-Линз Ясности', помогающих взломать туман и спроектировать будущее.",
  },
  placeholder2: {
    url: "https://placehold.co/600x338/1A0A3D/00FFFF?text=LifeOS+Interface", // Updated colors
    altEn: "Life path transforming into a futuristic OS interface",
    altRu: "Жизненный путь, трансформирующийся в футуристический интерфейс ОС",
    tooltipRu: "Концепция LifeOS: уровни, квесты, перки и нейро-обратная связь для ускоренной эволюции.",
  },
  placeholder3: {
    url: "https://placehold.co/600x338/6A0DAD/FFA500?text=AI+Co-Pilot", // Updated colors
    altEn: "AI co-pilot assisting user in navigating digital challenges",
    altRu: "ИИ-второй пилот, помогающий пользователю навигировать цифровые вызовы",
    tooltipRu: "ИИ как твой нейро-усилитель для самопознания, валидации идей и экспоненциального обучения в CyberDev.",
  },
  fitnessAppBrain: {
    url: "https://user-images.githubusercontent.com/19603209/289173111-ccb3b3d6-c16d-44f0-b873-3217b674622e.png",
    altEn: "Fitness app interface for brain training and skill leveling",
    altRu: "Интерфейс фитнес-приложения для тренировки мозга и прокачки навыков",
    tooltipRu: "Концепт 'CyberFitness': твои скиллы - мышцы, задачи - упражнения, AI - персональный тренер.",
  }
};

// --- Level Up System Data (Aligned with repo-xml page) ---
const levelUpSystem = [
  { level: "0 → 1", icon: FaBolt, perk: "Instant Win / Image Swap", descriptionEn: "Fix a broken image. Copy URL -> Paste -> Upload new -> <strong>DONE</strong>. System auto-PRs. <strong>ANYONE</strong> can do this <em>NOW</em>. Your entry to the matrix.", descriptionRu: "Починить битую картинку. Скопируй URL -> Вставь -> Загрузи новую -> <strong>ГОТОВО</strong>. Система сама создаст PR! <strong>ЛЮБОЙ</strong> может это <em>ПРЯМО СЕЙЧАС</em>. Твой вход в матрицу.", color: "text-brand-green" },
  { level: "1 → 2", icon: FaToolbox, perk: "Simple Idea / Generic Idea Flow", descriptionEn: "Simple idea? Change text/button? Give AI the idea + 1 file context -> PR. <strong>DONE.</strong> You command, AI executes.", descriptionRu: "Простая идея? Текст/кнопку поменять? Дай AI идею + 1 файл контекста -> PR. <strong>ГОТОВО.</strong> Ты сказал - AI сделал.", color: "text-brand-cyan" },
  { level: "2 → 3", icon: FaCode, perk: "+Multi-File Context", descriptionEn: "Slightly complex? 2-5 files? Give AI idea + context -> Check AI's response in Assistant -> PR. <strong>DONE.</strong> You control more.", descriptionRu: "Чуть сложнее? 2-5 файлов? Дай AI идею + контекст -> Проверь ответ AI в Ассистенте -> PR. <strong>ГОТОВО.</strong> Ты контролируешь больше.", color: "text-brand-blue" },
  { level: "3 → 4", icon: FaBug, perk: "Log Debugging / Error Fix Flow", descriptionEn: "Build failed? Runtime error? Use Error Overlay (<FaBug /> icon top-right on error) to copy error + logs -> Feed to AI with <strong>file context</strong> -> <strong>FIXED.</strong> +1 Vibe Perk: Debugging.", descriptionRu: "Упала сборка? Ошибка в рантайме? Используй Оверлей Ошибки (<FaBug /> иконка вверху справа при ошибке), чтобы скопировать ошибку и логи -> Скорми AI + <strong>контекст файла</strong> -> <strong>ПОЧИНЕНО.</strong> +1 Вайб Перк: Дебаггинг.", color: "text-brand-orange" },
  { level: "4 → 5", icon: FaLink, perk: "Proactive Debug / Icon Hunt", descriptionEn: "Check Vercel logs (link in PR comment!) even *without* errors. Hunt for warnings. Tired of icon errors? Find the <em>perfect</em> Fa6 icon! Use <a href='https://fontawesome.com/search?o=r&m=free&f=brands%2Csolid%2Cregular' target='_blank' class='text-brand-pink hover:underline font-semibold px-1'>FontAwesome Search <FaArrowUpRightFromSquare class='inline h-3 w-3 ml-px align-baseline'/></a> -> Add to Quick Links -> Fix proactively. +1 Perk: Resourcefulness.", descriptionRu: "Проверяй логи Vercel (ссылка в комменте PR!) даже *без* ошибок. Ищи варнинги. Устал от ошибок иконок? Найди <em>идеальную</em> Fa6 иконку сам! Юзай <a href='https://fontawesome.com/search?o=r&m=free&f=brands%2Csolid%2Cregular' target='_blank' class='text-brand-pink hover:underline font-semibold px-1'>Поиск FontAwesome <FaArrowUpRightFromSquare class='inline h-3 w-3 ml-px align-baseline'/></a> -> Добавь в Быстрые Ссылки -> Фикси проактивно. +1 Перк: Находчивость.", color: "text-brand-yellow" },
  { level: "5 → 6", icon: FaMicrophone, perk: "+Multimedia Input", descriptionEn: "Use audio commands! Attach videos! Watch them turn into page content automatically. +1 Perk: Multi-modal Input.", descriptionRu: "Используй аудио-команды! Прикрепляй видосы! Смотри, как они автоматом становятся контентом страницы. +1 Перк: Мультимодальный Ввод.", color: "text-brand-purple" },
  { level: "6 → 7", icon: FaDatabase, perk: "+SQL/DB Interaction", descriptionEn: "Discover new file types! AI generates SQL -> Paste into Supabase (1 click) -> <strong>DONE.</strong> Same flow, different context. +1 Perk: Data Handling.", descriptionRu: "Открой новые типы файлов! AI генерит SQL -> Вставь в Supabase (1 клик) -> <strong>ГОТОВО.</strong> Тот же флоу, другой контекст. +1 Перк: Работа с Данными.", color: "text-neon-lime" },
  { level: "8-10+", icon: FaServer, perk: "+Independence / Full Stack Vibe", descriptionEn: "Deploy your OWN CyberVibe! Use/steal my Supabase! Set your own Bot Token! Build your own XTRs! <strong>UNLIMITED POWER!</strong>", descriptionRu: "Разверни свой CyberVibe! Юзай/спи*ди мою Supabase! Поставь свой Токен Бота! Строй свои XTR-ы! <strong>БЕЗГРАНИЧНАЯ МОЩЬ!</strong>", color: "text-brand-pink" },
  { level: "11", icon: FaMagnifyingGlass, perk: "Code Scanner Vision", descriptionEn: "Your eyes <FaEye /> become <em>code scanners</em>. Instantly spot missing imports, typos, or logic flaws just by scrolling. You see the matrix.", descriptionRu: "Твои глаза <FaEye /> становятся <em>сканерами кода</em>. Мгновенно видишь пропущенные импорты, опечатки, логические дыры, просто скролля. Ты видишь матрицу.", color: "text-brand-cyan" },
  { level: "12", icon: FaMemory, perk: "Context Commander", descriptionEn: "65k tokens? <em class='text-purple-400'>Pfft, child's play.</em> You effortlessly juggle massive code context, guiding the AI through complex refactors like a <FaUserAstronaut /> surfing a nebula.", descriptionRu: "65к токенов? <em class='text-purple-400'>Пфф, детский сад.</em> Ты легко жонглируешь гигантским контекстом кода, ведя AI через сложнейшие рефакторинги, как <FaUserAstronaut /> на серфе по небуле.", color: "text-brand-purple" },
  { level: "13", icon: FaKeyboard, perk: "Vibe Channeler", descriptionEn: "Forget typing; you <em>channel</em> the vibe <FaHeart className='text-pink-400' />. Detailed prompts, intricate edits, non-stop creation for 10+ minutes. You're not working; you're in <em>flow</em>, bending the digital world to your will.", descriptionRu: "Забудь про 'печатать', ты <em>ченнелишь</em> вайб <FaHeart className='text-pink-400' />. Детальные промпты, сложные правки, непрерывное творение >10 минут. Ты не работаешь, ты в <em>потоке</em>, изменяя цифровую реальность под себя.", color: "text-brand-pink" },
  { level: "14", icon: FaBriefcase, perk: "Efficiency Ninja", descriptionEn: "Why make two trips? You seamlessly weave small, unrelated tasks into larger AI requests. <em class='text-cyan-400'>Maximum efficiency, minimum context switching.</em> Your workflow is a finely tuned engine.", descriptionRu: "Зачем ходить дважды? Ты легко вплетаешь мелкие, несвязанные задачи в крупные запросы к AI. <em class='text-cyan-400'>Максимум эффективности, минимум переключений.</em> Твой воркфлоу - идеально настроенный движок.", color: "text-brand-blue" },
  { level: "15", icon: FaMagnifyingGlassChart, perk: "Log Whisperer <FaBrain/>", descriptionEn: "WITH AI! You don't just read logs; you <em class='text-yellow-400'>interrogate</em> them. Spotting the delta between the *plan* (HasBeenPlanter logs) and the *reality* becomes second nature. Root causes reveal themselves.", descriptionRu: "С ПОМОЩЬЮ AI! Ты не читаешь логи, ты их <em class='text-yellow-400'>допрашиваешь</em>. Увидеть разницу между *планом* (логи HasBeenPlanter) и *реальностью* становится второй натурой. Корневые причины сами себя выдают.", color: "text-brand-yellow" },
];

// --- Section Data ---
const sections = [
  {
    id: "intro",
    icon: FaMapSigns, // Valid Fa6 icon
    titleEn: "Lost in the Fog? Activate Your CyberSight OS",
    titleRu: "Потерян в Тумане? Активируй CyberSight OS",
    pointsEn: [
      "Feeling confused, lost, or on the verge of giving up is normal. It often takes <strong class='font-semibold text-brand-yellow'>1-2 months</strong> of this 'Limbo' phase for true vision to form.",
      "Like upgrading to CyberSight OS, we need a <strong class='font-semibold text-brand-yellow'>new perspective</strong> to turn life into an engaging game instead of a confusing struggle.",
      "This isn't about finding a pre-made path, but <strong class='font-semibold text-brand-yellow'>designing YOUR game</strong> based on YOUR desired reality. This is your CyberDev journey.",
    ],
    pointsRu: [
      "Чувство замешательства, потерянности или желание все бросить – это нормально. Часто требуется <strong class='font-semibold text-brand-yellow'>1-2 месяца</strong> этой фазы 'Лимбо', чтобы сформировалось истинное видение.",
      "Словно обновляясь до CyberSight OS, нам нужна <strong class='font-semibold text-brand-yellow'>новая перспектива</strong>, чтобы превратить жизнь в увлекательную игру вместо запутанной борьбы.",
      "Речь не о поиске готового пути, а о <strong class='font-semibold text-brand-yellow'>создании ТВОЕЙ игры</strong>, основанной на ТВОЕЙ желаемой реальности. Это твой CyberDev путь.",
    ],
    imageUrlKey: "placeholder1",
  },
  {
    id: "cyberstudio_intro",
    icon: FaGlasses,
    titleEn: "CyberStudio: Your Anti-Glasses for the Matrix",
    titleRu: "CyberStudio: Твои Анти-Очки для Матрицы",
    pointsEn: [
        "If the virtual world seems daunting, CyberStudio (this platform!) acts as your 'anti-glasses'.",
        "Instead of overlaying complexity, it <strong class='font-semibold text-brand-green'>simplifies interaction</strong>, making you fearless in the digital realm.",
        "Every 'small task', like registering on <FaGithub class='inline mx-1 text-gray-400 align-baseline'/>, isn't a hurdle but a <strong class='font-semibold text-brand-green'>micro-level-up</strong>. Each click is a skill gained.",
        "This studio is your <strong class='font-semibold text-brand-green'>training dojo</strong> to co-create with AI, remix knowledge, and transmute ideas into reality instantly.",
        "The Vibe Loop (<FaUpLong class='inline text-purple-400'/> <Link href='/repo-xml#cybervibe-section' class='text-brand-purple hover:underline'>see on RepoXML</Link>) is your compounding feedback engine: every action levels you up."
    ],
    pointsRu: [
        "Если виртуальный мир кажется пугающим, CyberStudio (эта платформа!) — твои 'анти-очки'.",
        "Вместо наложения сложности, она <strong class='font-semibold text-brand-green'>упрощает взаимодействие</strong>, делая тебя бесстрашным в цифровом мире.",
        "Каждая 'мелочь', типа регистрации на <FaGithub class='inline mx-1 text-gray-400 align-baseline'/>, — не преграда, а <strong class='font-semibold text-brand-green'>микро-level-up</strong>. Каждый клик — это полученный навык.",
        "Эта студия — твое <strong class='font-semibold text-brand-green'>тренировочное додзё</strong> для со-творчества с AI, ремикса знаний и мгновенной трансмутации идей в реальность.",
        "Петля Вайба (<FaUpLong class='inline text-purple-400'/> <Link href='/repo-xml#cybervibe-section' class='text-brand-purple hover:underline'>смотри на RepoXML</Link>) — твой накопительный движок обратной связи: каждое действие качает тебя."
    ],
  },
  { 
    id: "levelup_fitness",
    icon: FaDumbbell,
    titleEn: "CyberFitness: Level Up Your Brain OS",
    titleRu: "КиберФитнес: Прокачай ОС Своего Мозга",
    pointsEn: [
        "Think of this as your <strong class='font-semibold text-brand-cyan'>fitness app for the brain</strong>. Your skills are muscles, tasks are exercises, and AI is your personal trainer.",
        "The secret: <strong class='font-semibold text-brand-cyan'>You're not asking the bot for help, YOU are helping the BOT guide its power.</strong>",
        "Each level up is <strong class='font-semibold text-brand-cyan'>inevitable</strong> because you get too lazy for the old way. One extra click, one new skill, and you're automatically stronger. There's <strong>NO GOING BACK!</strong>",
        "Your 'Bandwidth' (context capacity, problem-solving speed) increases with each level. Aim to expand it!",
        "Instead of calorie tracking, you track <strong class='font-semibold text-brand-cyan'>'KiloVibes' or 'Context Tokens'</strong> processed. Instead of meal plans, you get <strong class='font-semibold text-brand-cyan'>AI Prompt Blueprints</strong>."
    ],
    pointsRu: [
        "Думай об этом как о <strong class='font-semibold text-brand-cyan'>фитнес-приложении для мозга</strong>. Твои навыки — мышцы, задачи — упражнения, а AI — твой персональный тренер.",
        "Секрет: <strong class='font-semibold text-brand-cyan'>Не ты просишь бота помочь, а ТЫ помогаешь БОТУ направлять его мощь.</strong>",
        "Каждый левел-ап <strong class='font-semibold text-brand-cyan'>неизбежен</strong>, потому что тебе становится лень делать по-старому. Один лишний клик, один новый скилл — и ты автоматом сильнее. И <strong>НАЗАД ДОРОГИ НЕТ!</strong>",
        "Твой 'Bandwidth' (объем контекста, скорость решения проблем) растет с каждым уровнем. Цель — расширять его!",
        "Вместо подсчета калорий ты отслеживаешь <strong class='font-semibold text-brand-cyan'>'КилоВайбы' или 'Токены Контекста'</strong>. Вместо планов питания — <strong class='font-semibold text-brand-cyan'>Чертежи AI Промптов</strong>."
    ],
    imageUrlKey: "fitnessAppBrain",
    levelSystem: levelUpSystem,
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
      "<strong class='text-brand-orange'>Level 4: Resistance <FaTriangleExclamation className='inline mx-1'/></strong> - Exponential progress plateaus. You cling to past success, avoiding the next 'Limbo'.", // Corrected Icon
      "Most get trapped in Limbo because they're trained to follow scripts and wait for external certainty, interpreting 'feeling lost' as a bad sign instead of a <strong class='font-semibold text-brand-yellow'>necessary starting point</strong>.",
    ],
    pointsRu: [
      "<strong class='text-gray-400'>Уровень 1: Лимбо <FaQuestionCircle className='inline mx-1'/></strong> - Ты не знаешь, что делать или чего хочешь. Чувство потерянности, застоя.",
      "<strong class='text-brand-cyan'>Уровень 2: Видение <FaEye className='inline mx-1'/></strong> - Формируется образ будущего. Ты начинаешь действовать на новом пути, набирается импульс.",
      "<strong class='text-brand-green'>Уровень 3: Поток <FaPlay className='inline mx-1'/></strong> - Ты глубоко вовлечен, не можешь оторваться от цели.",
      "<strong class='text-brand-orange'>Уровень 4: Сопротивление <FaTriangleExclamation className='inline mx-1'/></strong> - Экспоненциальный прогресс замедляется. Ты цепляешься за прошлый успех, избегая следующего 'Лимбо'.", // Corrected Icon
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
    icon: FaGamepad, // Original icon
    titleEn: "Step 3: Gamify Your Life - Design the Game",
    titleRu: "Шаг 3: Геймифицируй Жизнь - Спроектируй Игру",
    pointsEn: [
      "Your mind runs on a storyline. Games are pre-constructed stories with mechanisms that <strong class='font-semibold text-brand-green'>narrow focus and make progress enjoyable</strong>.",
      "Replicate game mechanics in your life:",
      "<strong class='text-brand-green'>1. Clear Hierarchy of Goals <FaBullseye className='inline mx-1'/>:</strong> Define your end goal (long-term vision), break it down into long-term (e.g., 1 year) and short-term (e.g., 1 month, 1 week) goals. These are directions, not rigid destinations.",
      "<strong class='text-brand-green'>2. Create the Rules <FaRulerCombined className='inline mx-1'/>:</strong> What are you *not* willing to sacrifice (health, relationships, ethics)? These constraints foster creativity.",
      "<strong class='text-brand-green'>3. Quantifiable Feedback Loops <FaGears className='inline mx-1'/>:</strong> Define daily/weekly priority tasks (e.g., write 1000 words, read 10 pages, reach out to 5 clients). Completing these provides direct feedback on progress.", // Changed FaCogs to FaGears
      "This structure turns vague aspirations into an actionable game.",
      "Start playing! You figure out the specifics by <strong class='font-semibold text-brand-green'>doing and error-correcting</strong>.",
    ],
    pointsRu: [
      "Твой разум работает по сюжетной линии. Игры – это заранее построенные истории с механизмами, которые <strong class='font-semibold text-brand-green'>сужают фокус и делают прогресс приятным</strong>.",
      "Воспроизведи игровые механики в своей жизни:",
      "<strong class='text-brand-green'>1. Четкая Иерархия Целей <FaBullseye className='inline mx-1'/>:</strong> Определи конечную цель (долгосрочное видение), разбей ее на долгосрочные (например, 1 год) и краткосрочные (например, 1 месяц, 1 неделя) цели. Это направления, а не жесткие пункты назначения.",
      "<strong class='text-brand-green'>2. Создай Правила <FaRulerCombined className='inline mx-1'/>:</strong> Чем ты *не* готов пожертвовать (здоровье, отношения, этика)? Эти ограничения стимулируют креативность.",
      "<strong class='text-brand-green'>3. Измеримые Петли Обратной Связи <FaGears className='inline mx-1'/>:</strong> Определи ежедневные/еженедельные приоритетные задачи (напр., написать 1000 слов, прочитать 10 страниц, связаться с 5 клиентами). Их выполнение дает прямую обратную связь о прогрессе.", // Changed FaCogs to FaGears
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
    titleEn: "Power-Ups: AI Co-Pilot & Resources",
    titleRu: "Усиления: AI-Второй Пилот и Ресурсы",
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
    titleEn: "Launch Your CyberLife Game!",
    titleRu: "Запусти Свою КиберЖизнь Игру!",
    pointsEn: [
      "Stop waiting for perfect clarity or external permission.",
      "Use these frameworks (Anti-Vision, Vision, Game Design, CyberStudio Levels) to <strong class='font-semibold text-neon-lime'>start now</strong>.",
      "Embrace 'Limbo' as the start line, collect your vision pieces, design your initial game rules, and <strong class='font-semibold text-neon-lime'>start playing and leveling up</strong>.",
      "Your path will become clearer as you move, learn, and adapt. The 'CyberSight OS' gets clearer with use.",
      "Explore related concepts in <Link href='/selfdev' class='text-brand-green hover:underline font-semibold'>SelfDev Intro</Link> and <Link href='/p-plan' class='text-brand-purple hover:underline font-semibold'>P-Plan (Cyber Alchemist's Grimoire)</Link> for practical application.",
    ],
    pointsRu: [
      "Перестань ждать идеальной ясности или внешнего разрешения.",
      "Используй эти фреймворки (Анти-Видение, Видение, Дизайн Игры, Уровни CyberStudio), чтобы <strong class='font-semibold text-neon-lime'>начать сейчас</strong>.",
      "Прими 'Лимбо' как стартовую линию, собери кусочки своего видения, спроектируй начальные правила игры и <strong class='font-semibold text-neon-lime'>начни играть и прокачиваться</strong>.",
      "Твой путь прояснится по мере движения, обучения и адаптации. 'CyberSight OS' становится четче с использованием.",
      "Изучи связанные концепции во <Link href='/selfdev' class='text-brand-green hover:underline font-semibold'>Введении в SelfDev</Link> и <Link href='/p-plan' class='text-brand-purple hover:underline font-semibold'>P-Plan (Гримуар Кибер-Алхимика)</Link> для практического применения.",
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
    debugLogger.log(`[GamifiedSelfDevPage] Mounted. Initial selected: ${initialLang}`);
  }, [user?.language_code]);

  const pageThemeColor = "brand-pink"; 
  const pageBorderColor = `border-${pageThemeColor}/40`; 
  const pageTextColor = `text-${pageThemeColor}`;
  const pageShadowColor = `shadow-[0_0_35px_theme(colors.brand-pink/0.5)]`;

  if (!isMounted) {
    return (
      <div className="flex justify-center items-center min-h-screen pt-20 bg-gradient-to-br from-dark-bg via-black to-dark-card">
        <p className={`${pageTextColor} animate-pulse text-xl font-orbitron`}>Загрузка CyberDev OS...</p>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen overflow-hidden pt-20 pb-10 bg-gradient-to-br from-dark-bg via-black to-dark-card text-light-text">
      <div
        className="absolute inset-0 bg-repeat opacity-[0.03] z-0"
        style={{
          backgroundImage: `linear-gradient(to right, theme(colors.brand-pink / 0.3) 1px, transparent 1px),
                            linear-gradient(to bottom, theme(colors.brand-pink / 0.3) 1px, transparent 1px)`,
          backgroundSize: '70px 70px',
        }}
      ></div>

      <TooltipProvider delayDuration={100}>
        <div className="relative z-10 container mx-auto px-4">
          <Card className={cn(
              "max-w-4xl mx-auto bg-black/90 backdrop-blur-xl text-white rounded-2xl border-2",
              pageBorderColor,
              pageShadowColor
          )}>
            <CardHeader className={cn("text-center border-b pb-6 pt-8", `border-${pageThemeColor}/30`)}>
              <FaGamepad className={`mx-auto text-6xl mb-4 ${pageTextColor} animate-neon-flicker`} />
              <CardTitle className={cn("text-4xl md:text-5xl font-bold font-orbitron glitch", pageTextColor)} data-text="CyberDev OS: Твой Level Up">
                 CyberDev OS: Твой Level Up
              </CardTitle>
              <div className="text-md md:text-lg text-gray-300 mt-4 font-mono">
                 <VibeContentRenderer content={selectedLang === 'ru'
                    ? "Преврати жизнь в игру с <strong class='text-brand-cyan'>CyberSight OS</strong>. Прокачивай <strong class='text-brand-green'>мозг</strong>, взламывай <strong class='text-brand-yellow'>реальность</strong>."
                    : "Turn life into a game with <strong class='text-brand-cyan'>CyberSight OS</strong>. Level up your <strong class='text-brand-green'>brain</strong>, hack <strong class='text-brand-yellow'>reality</strong>."} />
              </div>
               <div className="text-sm text-gray-400 mt-2 font-mono">
                 <VibeContentRenderer content={selectedLang === 'ru' ? "Вдохновлено: <strong class='text-gray-200'>Дэн Ко + Sight (фильм) + Твои Аудио-Промпты</strong>" : "Inspired by: <strong class='text-gray-200'>Dan Koe + Sight (movie) + Your Audio Prompts</strong>"} />
               </div>
            </CardHeader>

            <CardContent className="space-y-16 p-5 md:p-8">
              <div className="flex justify-center space-x-3 mb-10">
                 <Button
                   variant={selectedLang === 'ru' ? 'secondary' : 'outline'}
                   size="sm"
                   onClick={() => setSelectedLang('ru')}
                   className={cn(
                       `border-brand-pink/60 font-semibold font-orbitron text-xs py-2 px-4 rounded-md transition-all duration-200 hover:shadow-lg`,
                       selectedLang === 'ru' ? `bg-brand-pink/80 text-black hover:bg-brand-pink shadow-brand-pink/30` : `text-brand-pink hover:bg-brand-pink/20 hover:text-white`
                   )}
                 >
                   🇷🇺 Русский
                 </Button>
                 <Button
                    variant={selectedLang === 'en' ? 'secondary' : 'outline'}
                    size="sm"
                    onClick={() => setSelectedLang('en')}
                    className={cn(
                       "border-brand-cyan/60 font-semibold font-orbitron text-xs py-2 px-4 rounded-md transition-all duration-200 hover:shadow-lg",
                       selectedLang === 'en' ? 'bg-brand-cyan/80 text-black hover:bg-brand-cyan shadow-brand-cyan/30' : `text-brand-cyan hover:bg-brand-cyan/20 hover:text-white`
                    )}
                 >
                   🇬🇧 English
                 </Button>
              </div>

              {sections.map((section, index) => {
                const IconComponent = section.icon;
                const themePalette = ["text-brand-pink", "text-brand-cyan", "text-brand-green", "text-brand-yellow", "text-brand-purple", "text-brand-orange"];
                const currentThemeColor = themePalette[index % themePalette.length];
                const currentBorderColor = currentThemeColor.replace("text-", "border-");
                const currentTitle = selectedLang === 'en' ? section.titleEn : section.titleRu;
                const currentPoints = selectedLang === 'en' ? section.pointsEn : section.pointsRu;
                const imageInfo = section.imageUrlKey ? imagePlaceholders[section.imageUrlKey as keyof typeof imagePlaceholders] : null;
                const currentImageUrl = imageInfo?.url;
                const currentImageAlt = selectedLang === 'en' ? imageInfo?.altEn : imageInfo?.altRu;
                const currentTooltip = selectedLang === 'ru' ? imageInfo?.tooltipRu : null;

                return (
                  <section key={section.id} className={cn(`space-y-5 border-l-4 pl-4 md:pl-6 py-4 rounded-r-md bg-dark-card/30`, `${currentBorderColor}/70`, `hover:shadow-md hover:shadow-${currentBorderColor.split('-')[1]}/20 transition-shadow`)}>
                    <h2 className={`flex items-center text-2xl md:text-3xl font-semibold ${currentThemeColor} mb-3 font-orbitron`}>
                      <IconComponent className={`mr-3 ${currentThemeColor}/80 flex-shrink-0 text-2xl`} />
                       <VibeContentRenderer content={currentTitle} />
                    </h2>

                    {currentPoints.length > 0 && (
                      <div className="prose prose-sm md:prose-base prose-invert max-w-none prose-strong:font-orbitron prose-strong:tracking-wide prose-a:text-brand-blue hover:prose-a:text-brand-cyan prose-li:marker:text-currentThemeColor/70">
                        {currentPoints.map((point, i) => (
                          <VibeContentRenderer key={`${selectedLang}-${section.id}-point-${i}`} content={`<li>${point}</li>`} />
                        ))}
                      </div>
                    )}
                    
                    {section.id === "levelup_fitness" && section.levelSystem && (
                        <div className="mt-6 space-y-4">
                            <h3 className="text-xl font-orbitron text-center text-brand-yellow mb-4">
                                {selectedLang === 'ru' ? 'Система Прокачки CyberStudio:' : 'CyberStudio Level Up System:'}
                            </h3>
                            {section.levelSystem.map(lvl => {
                                const LvlIcon = lvl.icon;
                                return (
                                <div key={lvl.level} className={`p-3 border-l-4 ${lvl.color.replace('text-', 'border-')} bg-dark-bg/50 rounded-md shadow-sm`}>
                                    <h4 className={`font-orbitron ${lvl.color} flex items-center`}>
                                        <LvlIcon className="mr-2" />
                                        {selectedLang === 'ru' ? 'Лв.' : 'Lv.'}{lvl.level} - <VibeContentRenderer content={lvl.perk} />
                                    </h4>
                                    <div className="text-xs text-gray-400 mt-1 pl-6">
                                        <VibeContentRenderer content={selectedLang === 'ru' ? lvl.descriptionRu : lvl.descriptionEn} />
                                    </div>
                                </div>
                                );
                            })}
                             <p className="text-xs text-gray-500 text-center mt-4">
                               <VibeContentRenderer content={selectedLang === 'ru' ? "Детальное описание системы уровней и прогрессии смотри на <Link href='/repo-xml#philosophy-steps' class='text-brand-purple hover:underline'>SuperVibe Studio</Link>!" : "See detailed level system and progression on the <Link href='/repo-xml#philosophy-steps' class='text-brand-purple hover:underline'>SuperVibe Studio</Link> page!"} />
                             </p>
                        </div>
                    )}

                    {currentImageUrl && currentImageAlt && (
                      <div className={`my-6 p-2 border ${currentBorderColor}/30 rounded-lg bg-black/50 max-w-md mx-auto shadow-lg`}>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <div className="aspect-video w-full h-auto overflow-hidden rounded-md bg-gray-900/60 cursor-help relative">
                              <Image
                                src={currentImageUrl} alt={currentImageAlt} width={600} height={338}
                                className="w-full h-full object-contain opacity-80 hover:opacity-100 transition-all duration-300 ease-in-out transform hover:scale-105"
                                loading="lazy" placeholder="blur" blurDataURL={PLACEHOLDER_BLUR_URL}
                                onError={(e) => {
                                  debugLogger.error(`Failed to load image: ${currentImageUrl}`);
                                  (e.target as HTMLImageElement).style.display = 'none';
                                }}
                              />
                            </div>
                          </TooltipTrigger>
                          {currentTooltip && (
                            <TooltipContent side="bottom" className={`max-w-xs text-center bg-dark-bg ${currentBorderColor}/60 text-white p-3 shadow-2xl border`}>
                              <p className="text-sm whitespace-pre-wrap font-mono">{currentTooltip}</p>
                            </TooltipContent>
                          )}
                        </Tooltip>
                        <p className="text-xs text-center text-gray-500 mt-2 italic font-mono">{currentImageAlt}</p>
                      </div>
                    )}
                     {section.id === 'tools' && (
                        <div className="mt-6 text-sm text-center space-y-2">
                            <p className="text-gray-400">
                                <VibeContentRenderer content={selectedLang === 'ru' ? 'Найди AI-промпт (LifeQuest AI Coach от Dan Koe) в <a href="https://docs.google.com/document/d/1n_8py56cYMLsv_QEgK7JjHjVp4Uep037cGwnsYdkQ7c/edit?usp=sharing" target="_blank" rel="noopener noreferrer" class="font-semibold hover:underline text-brand-yellow">Digital Economics Stack</a> (скоро будет локализован).' : 'Find the AI prompt (LifeQuest AI Coach by Dan Koe) in the <a href="https://docs.google.com/document/d/1n_8py56cYMLsv_QEgK7JjHjVp4Uep037cGwnsYdkQ7c/edit?usp=sharing" target="_blank" rel="noopener noreferrer" class="font-semibold hover:underline text-brand-yellow">Digital Economics Stack</a>.'} />
                            </p>
                             <p className="text-gray-400">
                               <VibeContentRenderer content={selectedLang === 'ru' ? 'Или изучи <a href="https://thedankoe.com/ai-content-systems/" target="_blank" rel="noopener noreferrer" class="font-semibold hover:underline text-brand-yellow">AI Content Systems Mini-Course</a>.' : 'Or explore the <a href="https://thedankoe.com/ai-content-systems/" target="_blank" rel="noopener noreferrer" class="font-semibold hover:underline text-brand-yellow">AI Content Systems Mini-Course</a>.'} />
                            </p>
                        </div>
                    )}
                  </section>
                );
              })}

              <section className="text-center pt-10 border-t border-brand-pink/30 mt-16">
                 <div className="text-lg text-gray-300 prose prose-invert max-w-none prose-a:text-brand-blue">
                   <VibeContentRenderer content={selectedLang === 'ru' ? "Геймификация — мощный инструмент для CyberDev. Начни проектировать свою игру и <strong class='text-neon-lime'>прокачивать свой мозг</strong> сегодня!" : "Gamification is a powerful tool for CyberDev. Start designing your game and <strong class='text-neon-lime'>leveling up your brain</strong> today!"} />
                 </div>
                 <div className="mt-6 text-gray-300 prose prose-invert max-w-none prose-a:text-brand-blue">
                    <VibeContentRenderer content={selectedLang === 'ru' ? "Примени эти принципы к своему пути во <Link href='/selfdev' class='text-brand-green hover:underline font-semibold'>Введении в SelfDev</Link>, спланируй с помощью <Link href='/p-plan' class='text-brand-purple hover:underline font-semibold'>P-Plan</Link>, и начни быстро с <Link href='/jumpstart' class='text-neon-lime hover:underline font-semibold'>Jumpstart Kit</Link>." : "Apply these principles to your journey in the <Link href='/selfdev' class='text-brand-green hover:underline font-semibold'>SelfDev Intro</Link>, plan with the <Link href='/p-plan' class='text-brand-purple hover:underline font-semibold'>P-Plan</Link>, and get a quick start with the <Link href='/jumpstart' class='text-neon-lime hover:underline font-semibold'>Jumpstart Kit</Link>."} />
                 </div>
              </section>
            </CardContent>
          </Card>
        </div>
      </TooltipProvider>
    </div>
  );
}
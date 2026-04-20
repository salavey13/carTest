"use client";

import { useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  BookOpen,
  Languages,
  Clock,
  ArrowRight,
  ChevronDown,
  ChevronUp,
  Eye,
  MousePointerClick,
  MessageSquare,
  HelpCircle,
  Lightbulb,
  Volume2,
  PenTool,
} from "lucide-react";

// ============================================================
// DATA ARRAYS — Full 7th Grade English VPR Curriculum
// ============================================================

const tensesData = [
  {
    id: "present-simple",
    name: "Present Simple",
    russian: "Настоящее простое",
    color: "#22d3ee",
    formula: "V1 / V-s(es)",
    negative: "do/does + not + V1",
    question: "Do/Does + S + V1?",
    usage: "Регулярные действия, факты, рутина",
    examples: [
      "I play football every day.",
      "She goes to school at 8.",
      "Water boils at 100°C.",
    ],
    markers: ["always", "usually", "often", "sometimes", "never", "every day"],
  },
  {
    id: "present-continuous",
    name: "Present Continuous",
    russian: "Настоящее длительное",
    color: "#06b6d4",
    formula: "am/is/are + V-ing",
    negative: "am/is/are + not + V-ing",
    question: "Am/Is/Are + S + V-ing?",
    usage: "Действие происходит прямо сейчас",
    examples: [
      "I am reading a book now.",
      "She is watching TV at the moment.",
      "They are playing in the yard.",
    ],
    markers: ["now", "at the moment", "right now", "look!", "listen!"],
  },
  {
    id: "past-simple",
    name: "Past Simple",
    russian: "Прошедшее простое",
    color: "#0ea5e9",
    formula: "V2 / V-ed",
    negative: "did + not + V1",
    question: "Did + S + V1?",
    usage: "Завершённое действие в прошлом",
    examples: [
      "I visited London last year.",
      "She wrote a letter yesterday.",
      "We went to the park.",
    ],
    markers: ["yesterday", "last week", "ago", "in 2020", "last summer"],
  },
  {
    id: "future-simple",
    name: "Future Simple",
    russian: "Будущее простое",
    color: "#38bdf8",
    formula: "will + V1",
    negative: "will + not + V1",
    question: "Will + S + V1?",
    usage: "Решение, принятое в момент речи, прогноз",
    examples: [
      "I will help you tomorrow.",
      "It will rain next week.",
      "She will come to the party.",
    ],
    markers: ["tomorrow", "next week", "in the future", "I think", "probably"],
  },
  {
    id: "present-perfect",
    name: "Present Perfect",
    russian: "Настоящее совершённое",
    color: "#0284c7",
    formula: "have/has + V3",
    negative: "have/has + not + V3",
    question: "Have/Has + S + V3?",
    usage: "Результат к настоящему моменту",
    examples: [
      "I have finished my homework.",
      "She has already eaten lunch.",
      "We have never been to Paris.",
    ],
    markers: ["already", "yet", "just", "ever", "never", "recently"],
  },
];

const articlesRules = [
  {
    type: "a",
    title: "Артикль a (an)",
    russian: "Неопределённый артикль",
    rules: [
      "Первое упоминание: I saw a cat.",
      "Профессия: She is a doctor.",
      "Один из многих: Give me a pen.",
      "Перед согласным: a book, a table",
      "Перед гласным звуком: an apple, an hour",
    ],
    color: "#22d3ee",
  },
  {
    type: "the",
    title: "Артикль the",
    russian: "Определённый артикль",
    rules: [
      "Уже известно из контекста: The cat is black.",
      "Единственный в своём роде: The sun, the Earth",
      "С порядковыми числительными: the first",
      "С превосходной степенью: the best",
      "С суперлативом: the most beautiful",
    ],
    color: "#06b6d4",
  },
  {
    type: "zero",
    title: "Нулевой артикль (—)",
    russian: "Без артикля",
    rules: [
      "Исчисляемое множ. число во мн.: I like cats.",
      "Названия стран (без the): Russia, France",
      "Абстрактные понятия: Love, happiness, time",
      "Имена собственные: Moscow, Anna",
      "Приёмы пищи: breakfast, lunch, dinner",
    ],
    color: "#0ea5e9",
  },
];

const comparisonData = {
  short: {
    title: "Короткие прилагательные (1 слог)",
    rule: "adjective + -er / the ... -est",
    examples: [
      { pos: "tall", comp: "taller", sup: "the tallest" },
      { pos: "big", comp: "bigger", sup: "the biggest" },
      { pos: "nice", comp: "nicer", sup: "the nicest" },
      { pos: "hot", comp: "hotter", sup: "the hottest" },
    ],
  },
  long: {
    title: "Длинные прилагательные (2+ слогов)",
    rule: "more / the most + adjective",
    examples: [
      { pos: "beautiful", comp: "more beautiful", sup: "the most beautiful" },
      { pos: "expensive", comp: "more expensive", sup: "the most expensive" },
      { pos: "interesting", comp: "more interesting", sup: "the most interesting" },
      { pos: "important", comp: "more important", sup: "the most important" },
    ],
  },
  irregular: [
    { pos: "good", comp: "better", sup: "the best" },
    { pos: "bad", comp: "worse", sup: "the worst" },
    { pos: "far", comp: "farther", sup: "the farthest" },
    { pos: "little", comp: "less", sup: "the least" },
    { pos: "much/many", comp: "more", sup: "the most" },
  ],
};

const modalVerbsData = [
  {
    verb: "can",
    meaning: "Мочь, уметь",
    probability: 100,
    color: "#22d3ee",
    usage: "Способность, умение, разрешение, просьба",
    examples: [
      "I can swim very well.",
      "Can you help me?",
      "She can speak three languages.",
    ],
  },
  {
    verb: "could",
    meaning: "Мог бы",
    probability: 70,
    color: "#06b6d4",
    usage: "Вежливая просьба, прошедшая способность",
    examples: [
      "Could you open the door?",
      "I could run fast when I was young.",
    ],
  },
  {
    verb: "must",
    meaning: "Должен",
    probability: 95,
    color: "#0ea5e9",
    usage: "Обязанность, уверенность, запрет (mustn't)",
    examples: [
      "You must do your homework.",
      "She must be at home — the lights are on.",
      "You mustn't run here!",
    ],
  },
  {
    verb: "should",
    meaning: "Следует",
    probability: 60,
    color: "#38bdf8",
    usage: "Совет, рекомендация",
    examples: [
      "You should eat more vegetables.",
      "She should see a doctor.",
    ],
  },
  {
    verb: "may",
    meaning: "Может быть",
    probability: 50,
    color: "#0284c7",
    usage: "Разрешение, возможность",
    examples: [
      "May I come in?",
      "It may rain tomorrow.",
    ],
  },
  {
    verb: "might",
    meaning: "Возможно",
    probability: 30,
    color: "#0369a1",
    usage: "Малая вероятность, неуверённость",
    examples: [
      "I might go to the party.",
      "She might be late.",
    ],
  },
];

const questionWords = [
  { word: "Who", russian: "Кто", type: "Лицо", example: "Who is your friend?" },
  { word: "What", russian: "Что / Какой", type: "Вещь", example: "What is this?" },
  { word: "Where", russian: "Где / Куда", type: "Место", example: "Where do you live?" },
  { word: "When", russian: "Когда", type: "Время", example: "When is your birthday?" },
  { word: "Why", russian: "Почему", type: "Причина", example: "Why are you sad?" },
  { word: "How", russian: "Как", type: "Способ", example: "How do you get to school?" },
  { word: "How many", russian: "Сколько (исчисл.)", type: "Количество", example: "How many books do you have?" },
  { word: "How much", russian: "Сколько (неисчисл.)", type: "Количество", example: "How much water do you drink?" },
];

const conditionalsData = [
  {
    type: "Type 0",
    russian: "Нулевое условное",
    formula: "If + Present Simple, Present Simple",
    usage: "Законы природы, научные факты, 100% истинно",
    examples: [
      "If you heat water, it boils.",
      "If it rains, the grass gets wet.",
      "If you mix red and blue, you get purple.",
    ],
    color: "#22d3ee",
  },
  {
    type: "Type 1",
    russian: "Первое условное",
    formula: "If + Present Simple, Future Simple (will + V1)",
    usage: "Реальная возможная ситуация в будущем",
    examples: [
      "If it rains, I will take an umbrella.",
      "If you study hard, you will pass the exam.",
      "If she calls, I will tell her the news.",
    ],
    color: "#06b6d4",
  },
];

const irregularVerbs = [
  { v1: "be", v2: "was/were", v3: "been" },
  { v1: "become", v2: "became", v3: "become" },
  { v1: "begin", v2: "began", v3: "begun" },
  { v1: "break", v2: "broke", v3: "broken" },
  { v1: "bring", v2: "brought", v3: "brought" },
  { v1: "build", v2: "built", v3: "built" },
  { v1: "buy", v2: "bought", v3: "bought" },
  { v1: "catch", v2: "caught", v3: "caught" },
  { v1: "choose", v2: "chose", v3: "chosen" },
  { v1: "come", v2: "came", v3: "come" },
  { v1: "do", v2: "did", v3: "done" },
  { v1: "draw", v2: "drew", v3: "drawn" },
  { v1: "drink", v2: "drank", v3: "drunk" },
  { v1: "drive", v2: "drove", v3: "driven" },
  { v1: "eat", v2: "ate", v3: "eaten" },
  { v1: "fall", v2: "fell", v3: "fallen" },
  { v1: "feel", v2: "felt", v3: "felt" },
  { v1: "find", v2: "found", v3: "found" },
  { v1: "fly", v2: "flew", v3: "flown" },
  { v1: "forget", v2: "forgot", v3: "forgotten" },
  { v1: "get", v2: "got", v3: "got/gotten" },
  { v1: "give", v2: "gave", v3: "given" },
  { v1: "go", v2: "went", v3: "gone" },
  { v1: "grow", v2: "grew", v3: "grown" },
  { v1: "have", v2: "had", v3: "had" },
  { v1: "hear", v2: "heard", v3: "heard" },
  { v1: "hide", v2: "hid", v3: "hidden" },
  { v1: "hold", v2: "held", v3: "held" },
  { v1: "keep", v2: "kept", v3: "kept" },
  { v1: "know", v2: "knew", v3: "known" },
  { v1: "learn", v2: "learnt/learned", v3: "learnt/learned" },
  { v1: "leave", v2: "left", v3: "left" },
  { v1: "lend", v2: "lent", v3: "lent" },
  { v1: "lose", v2: "lost", v3: "lost" },
  { v1: "make", v2: "made", v3: "made" },
  { v1: "meet", v2: "met", v3: "met" },
  { v1: "pay", v2: "paid", v3: "paid" },
  { v1: "put", v2: "put", v3: "put" },
  { v1: "read", v2: "read", v3: "read" },
  { v1: "ride", v2: "rode", v3: "ridden" },
  { v1: "run", v2: "ran", v3: "run" },
  { v1: "say", v2: "said", v3: "said" },
  { v1: "see", v2: "saw", v3: "seen" },
  { v1: "sell", v2: "sold", v3: "sold" },
  { v1: "send", v2: "sent", v3: "sent" },
  { v1: "show", v2: "showed", v3: "shown" },
  { v1: "sing", v2: "sang", v3: "sung" },
  { v1: "sit", v2: "sat", v3: "sat" },
  { v1: "sleep", v2: "slept", v3: "slept" },
  { v1: "speak", v2: "spoke", v3: "spoken" },
  { v1: "spend", v2: "spent", v3: "spent" },
  { v1: "swim", v2: "swam", v3: "swum" },
  { v1: "take", v2: "took", v3: "taken" },
  { v1: "teach", v2: "taught", v3: "taught" },
  { v1: "tell", v2: "told", v3: "told" },
  { v1: "think", v2: "thought", v3: "thought" },
  { v1: "understand", v2: "understood", v3: "understood" },
  { v1: "wake up", v2: "woke up", v3: "woken up" },
  { v1: "wear", v2: "wore", v3: "worn" },
  { v1: "win", v2: "won", v3: "won" },
  { v1: "write", v2: "wrote", v3: "written" },
];

const prepositionsData = {
  time: [
    { prep: "in", russian: "В (период)", usage: "in the morning, in 2024, in winter, in January" },
    { prep: "on", russian: "В (день/дата)", usage: "on Monday, on 5th March, on my birthday" },
    { prep: "at", russian: "В (точное время)", usage: "at 5 o'clock, at night, at the weekend, at Christmas" },
  ],
  place: [
    { prep: "in", russian: "Внутри (пространство)", usage: "in the room, in London, in the box, in Russia" },
    { prep: "on", russian: "На поверхности", usage: "on the table, on the wall, on the floor, on the shelf" },
    { prep: "at", russian: "В точке", usage: "at the bus stop, at school, at home, at the door" },
  ],
};

// ============================================================
// CUSTOM SVG COMPONENTS
// ============================================================

function TimelineSVG({
  activeTense,
  onTenseHover,
}: {
  activeTense: string | null;
  onTenseHover: (id: string | null) => void;
}) {
  const tenses = [
    { id: "present-simple", label: "Present\nSimple", x: 80, color: "#22d3ee" },
    { id: "present-continuous", label: "Present\nContinuous", x: 230, color: "#06b6d4" },
    { id: "past-simple", label: "Past\nSimple", x: 380, color: "#0ea5e9" },
    { id: "future-simple", label: "Future\nSimple", x: 530, color: "#38bdf8" },
    { id: "present-perfect", label: "Present\nPerfect", x: 680, color: "#0284c7" },
  ];

  return (
    <svg viewBox="0 0 760 180" className="w-full max-w-4xl mx-auto">
      {/* Background glow line */}
      <defs>
        <linearGradient id="timeline-grad" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#0ea5e9" stopOpacity="0.1" />
          <stop offset="50%" stopColor="#22d3ee" stopOpacity="0.3" />
          <stop offset="100%" stopColor="#06b6d4" stopOpacity="0.1" />
        </linearGradient>
        <filter id="glow-sm">
          <feGaussianBlur stdDeviation="3" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <filter id="glow-lg">
          <feGaussianBlur stdDeviation="8" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* Main timeline track */}
      <motion.line
        x1="50"
        y1="90"
        x2="710"
        y2="90"
        stroke="url(#timeline-grad)"
        strokeWidth="3"
        initial={{ pathLength: 0 }}
        whileInView={{ pathLength: 1 }}
        transition={{ duration: 1.5, ease: "easeInOut" }}
        viewport={{ once: true }}
      />

      {/* Animated dashes on timeline */}
      <line x1="50" y1="90" x2="710" y2="90" stroke="#0ea5e9" strokeWidth="1" strokeDasharray="8 6" opacity="0.3">
        <animate attributeName="stroke-dashoffset" from="0" to="-28" dur="2s" repeatCount="indefinite" />
      </line>

      {/* Tense markers */}
      {tenses.map((t, i) => (
        <g
          key={t.id}
          onMouseEnter={() => onTenseHover(t.id)}
          onMouseLeave={() => onTenseHover(null)}
          className="cursor-pointer"
        >
          {/* Pulse ring on hover */}
          {activeTense === t.id && (
            <motion.circle
              cx={t.x}
              cy={90}
              r="22"
              fill="none"
              stroke={t.color}
              strokeWidth="2"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: [0.6, 0.2, 0.6], scale: [1, 1.3, 1] }}
              transition={{ duration: 1.5, repeat: Infinity }}
            />
          )}

          {/* Glow circle */}
          <motion.circle
            cx={t.x}
            cy={90}
            r={activeTense === t.id ? 16 : 12}
            fill={activeTense === t.id ? t.color : `${t.color}30`}
            stroke={t.color}
            strokeWidth="2"
            filter={activeTense === t.id ? "url(#glow-lg)" : "url(#glow-sm)"}
            initial={{ scale: 0, opacity: 0 }}
            whileInView={{ scale: 1, opacity: 1 }}
            transition={{ delay: i * 0.2, duration: 0.5, type: "spring" }}
            viewport={{ once: true }}
            whileHover={{ scale: 1.3 }}
          />

          {/* Inner dot */}
          <circle cx={t.x} cy={90} r="4" fill={t.color} />

          {/* Connection line to label */}
          <motion.line
            x1={t.x}
            y1={activeTense === t.id ? 60 : 70}
            x2={t.x}
            y2={75}
            stroke={t.color}
            strokeWidth="1"
            opacity="0.5"
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 0.5 }}
            transition={{ delay: i * 0.2 + 0.3 }}
            viewport={{ once: true }}
          />

          {/* Label */}
          <motion.text
            x={t.x}
            y={activeTense === t.id ? 48 : 55}
            textAnchor="middle"
            fill={activeTense === t.id ? t.color : "#94a3b8"}
            fontSize="13"
            fontWeight={activeTense === t.id ? "bold" : "normal"}
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: activeTense === t.id ? 48 : 55 }}
            transition={{ delay: i * 0.2 + 0.4 }}
            viewport={{ once: true }}
          >
            {t.label}
          </motion.text>

          {/* Time arrow below */}
          <motion.text
            x={t.x}
            y={130}
            textAnchor="middle"
            fill="#475569"
            fontSize="10"
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            transition={{ delay: i * 0.2 + 0.5 }}
            viewport={{ once: true }}
          >
            {i === 2 ? "← Прошлое" : i === 3 ? "Будущее →" : ""}
          </motion.text>
        </g>
      ))}

      {/* Direction arrow at the end */}
      <motion.polygon
        points="710,85 720,90 710,95"
        fill="#0ea5e9"
        opacity="0.5"
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 0.5 }}
        transition={{ delay: 1.2 }}
        viewport={{ once: true }}
      />
    </svg>
  );
}

function ArticlesSVG({ activeArticle }: { activeArticle: string | null }) {
  return (
    <svg viewBox="0 0 600 220" className="w-full max-w-3xl mx-auto">
      <defs>
        <filter id="art-glow">
          <feGaussianBlur stdDeviation="4" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* Left box — a/an */}
      <motion.rect
        x="20"
        y="40"
        width="250"
        height="140"
        rx="16"
        fill={activeArticle === "a" ? "#22d3ee15" : "#0a1520"}
        stroke={activeArticle === "a" ? "#22d3ee" : "#1e3a5f"}
        strokeWidth={activeArticle === "a" ? 2 : 1}
        initial={{ opacity: 0, x: -20 }}
        whileInView={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.6 }}
        viewport={{ once: true }}
      />
      <motion.text
        x="145"
        y="85"
        textAnchor="middle"
        fill={activeArticle === "a" ? "#22d3ee" : "#64748b"}
        fontSize="28"
        fontWeight="bold"
        filter={activeArticle === "a" ? "url(#art-glow)" : undefined}
      >
        a / an
      </motion.text>
      <text x="145" y="115" textAnchor="middle" fill="#94a3b8" fontSize="13">
        Первое упоминание
      </text>
      <text x="145" y="135" textAnchor="middle" fill="#64748b" fontSize="12">
        «Один из многих»
      </text>
      <text x="145" y="160" textAnchor="middle" fill="#475569" fontSize="11">
        I saw 🐱 a cat.
      </text>

      {/* Right box — the */}
      <motion.rect
        x="330"
        y="40"
        width="250"
        height="140"
        rx="16"
        fill={activeArticle === "the" ? "#06b6d415" : "#0a1520"}
        stroke={activeArticle === "the" ? "#06b6d4" : "#1e3a5f"}
        strokeWidth={activeArticle === "the" ? 2 : 1}
        initial={{ opacity: 0, x: 20 }}
        whileInView={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.6 }}
        viewport={{ once: true }}
      />
      <motion.text
        x="455"
        y="85"
        textAnchor="middle"
        fill={activeArticle === "the" ? "#06b6d4" : "#64748b"}
        fontSize="28"
        fontWeight="bold"
        filter={activeArticle === "the" ? "url(#art-glow)" : undefined}
      >
        the
      </motion.text>
      <text x="455" y="115" textAnchor="middle" fill="#94a3b8" fontSize="13">
        Уже известно
      </text>
      <text x="455" y="135" textAnchor="middle" fill="#64748b" fontSize="12">
        «Конкретный, определённый»
      </text>
      <text x="455" y="160" textAnchor="middle" fill="#475569" fontSize="11">
        🐱 The cat is black.
      </text>

      {/* Arrow between boxes */}
      <motion.g
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        transition={{ delay: 0.6 }}
        viewport={{ once: true }}
      >
        <line x1="270" y1="110" x2="330" y2="110" stroke="#475569" strokeWidth="1.5" strokeDasharray="4 3" />
        <polygon points="328,106 336,110 328,114" fill="#475569" />
        <text x="300" y="98" textAnchor="middle" fill="#64748b" fontSize="10">потом</text>
      </motion.g>
    </svg>
  );
}

function ComparisonLadderSVG({ activeComparison }: { activeComparison: number | null }) {
  const steps = [
    { label: "good", y: 170, color: "#0ea5e9", rank: "positive" },
    { label: "better", y: 115, color: "#22d3ee", rank: "comparative" },
    { label: "the best", y: 60, color: "#06b6d4", rank: "superlative" },
  ];

  const steps2 = [
    { label: "bad", y: 170, color: "#0ea5e9" },
    { label: "worse", y: 115, color: "#22d3ee" },
    { label: "the worst", y: 60, color: "#06b6d4" },
  ];

  return (
    <svg viewBox="0 0 700 220" className="w-full max-w-4xl mx-auto">
      <defs>
        <linearGradient id="ladder-grad" x1="0%" y1="100%" x2="0%" y2="0%">
          <stop offset="0%" stopColor="#0ea5e9" stopOpacity="0.2" />
          <stop offset="100%" stopColor="#22d3ee" stopOpacity="0.6" />
        </linearGradient>
        <filter id="ladder-glow">
          <feGaussianBlur stdDeviation="3" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* Left ladder — good/better/best */}
      <text x="155" y="20" textAnchor="middle" fill="#94a3b8" fontSize="12" fontWeight="bold">
        СТЕПЕНИ СРАВНЕНИЯ
      </text>

      {steps.map((step, i) => (
        <g key={i}>
          {/* Ladder rung */}
          <motion.rect
            x="60"
            y={step.y - 18}
            width="190"
            height="36"
            rx="8"
            fill={activeComparison === i ? `${step.color}20` : "#0a1520"}
            stroke={activeComparison === i ? step.color : "#1e3a5f"}
            strokeWidth={activeComparison === i ? 2 : 1}
            filter={activeComparison === i ? "url(#ladder-glow)" : undefined}
            initial={{ opacity: 0, x: -30 }}
            whileInView={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.15, duration: 0.5 }}
            viewport={{ once: true }}
          />

          {/* Up arrow between steps */}
          {i > 0 && (
            <motion.g
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              transition={{ delay: i * 0.15 + 0.2 }}
              viewport={{ once: true }}
            >
              <line x1="155" y1={step.y + 22} x2="155" y2={steps[i - 1].y - 22} stroke="#1e3a5f" strokeWidth="1" />
              <polygon points="151, {steps[i - 1].y - 18} 155, {steps[i - 1].y - 24} 159, {steps[i - 1].y - 18}" fill="#22d3ee" opacity="0.5" />
            </motion.g>
          )}

          {/* Label */}
          <text x="155" y={step.y + 5} textAnchor="middle" fill={activeComparison === i ? step.color : "#94a3b8"} fontSize="16" fontWeight="bold">
            {step.label}
          </text>

          {/* Degree label */}
          <text x="275" y={step.y + 5} fill="#64748b" fontSize="11">
            {i === 0 ? "(полож.)" : i === 1 ? "(сравн.)" : "(превосх.)"}
          </text>
        </g>
      ))}

      {/* Right ladder — bad/worse/worst */}
      {steps2.map((step, i) => (
        <g key={`bad-${i}`}>
          <motion.rect
            x="400"
            y={step.y - 18}
            width="190"
            height="36"
            rx="8"
            fill={activeComparison === i ? `${step.color}20` : "#0a1520"}
            stroke={activeComparison === i ? step.color : "#1e3a5f"}
            strokeWidth={activeComparison === i ? 2 : 1}
            initial={{ opacity: 0, x: 30 }}
            whileInView={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.15 + 0.1, duration: 0.5 }}
            viewport={{ once: true }}
          />

          {i > 0 && (
            <motion.g
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              transition={{ delay: i * 0.15 + 0.3 }}
              viewport={{ once: true }}
            >
              <line x1="495" y1={step.y + 22} x2="495" y2={steps2[i - 1].y - 22} stroke="#1e3a5f" strokeWidth="1" />
            </motion.g>
          )}

          <text x="495" y={step.y + 5} textAnchor="middle" fill={activeComparison === i ? step.color : "#94a3b8"} fontSize="16" fontWeight="bold">
            {step.label}
          </text>

          <text x="615" y={step.y + 5} fill="#64748b" fontSize="11">
            {i === 0 ? "(полож.)" : i === 1 ? "(сравн.)" : "(превосх.)"}
          </text>
        </g>
      ))}

      {/* Decorative glow */}
      <motion.ellipse
        cx="350"
        cy="110"
        rx="80"
        ry="100"
        fill="url(#ladder-grad)"
        opacity="0.08"
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 0.08 }}
        transition={{ delay: 0.8 }}
        viewport={{ once: true }}
      />
    </svg>
  );
}

function ModalMeterSVG({
  activeModal,
  onModalHover,
}: {
  activeModal: string | null;
  onModalHover: (id: string | null) => void;
}) {
  return (
    <svg viewBox="0 0 700 200" className="w-full max-w-4xl mx-auto">
      <defs>
        <linearGradient id="meter-bg" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#0369a1" />
          <stop offset="33%" stopColor="#0ea5e9" />
          <stop offset="66%" stopColor="#22d3ee" />
          <stop offset="100%" stopColor="#06b6d4" />
        </linearGradient>
        <filter id="meter-glow">
          <feGaussianBlur stdDeviation="4" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* Background track */}
      <rect x="80" y="90" width="540" height="20" rx="10" fill="#0f172a" stroke="#1e3a5f" strokeWidth="1" />

      {/* Gradient fill — animated */}
      <motion.rect
        x="80"
        y="90"
        width={activeModal ? (modalVerbsData.find((m) => m.verb === activeModal)?.probability ?? 0) * 5.4 : 0}
        height="20"
        rx="10"
        fill="url(#meter-bg)"
        initial={{ width: 0 }}
        animate={{
          width: activeModal ? (modalVerbsData.find((m) => m.verb === activeModal)?.probability ?? 0) * 5.4 : 0,
        }}
        transition={{ duration: 0.6, ease: "easeOut" }}
      />

      {/* Tick marks */}
      {[0, 25, 50, 75, 100].map((pct) => (
        <g key={pct}>
          <line x1={80 + pct * 5.4} y1="85" x2={80 + pct * 5.4} y2="115" stroke="#1e3a5f" strokeWidth="1" />
          <text x={80 + pct * 5.4} y="130" textAnchor="middle" fill="#475569" fontSize="10">
            {pct}%
          </text>
        </g>
      ))}

      {/* Scale labels */}
      <text x="80" y="150" fill="#64748b" fontSize="11">Неуверенность</text>
      <text x="540" y="150" textAnchor="end" fill="#64748b" fontSize="11">Уверенность</text>

      {/* Modal verb markers */}
      {modalVerbsData.map((modal, i) => {
        const x = 80 + modal.probability * 5.4;
        return (
          <g
            key={modal.verb}
            onMouseEnter={() => onModalHover(modal.verb)}
            onMouseLeave={() => onModalHover(null)}
            className="cursor-pointer"
          >
            {/* Marker triangle */}
            <motion.polygon
              points={`${x - 6},85 ${x + 6},85 ${x},78`}
              fill={activeModal === modal.verb ? modal.color : "#475569"}
              initial={{ opacity: 0, y: 10 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1, duration: 0.4 }}
              viewport={{ once: true }}
            />

            {/* Label above */}
            <motion.text
              x={x}
              y={68}
              textAnchor="middle"
              fill={activeModal === modal.verb ? modal.color : "#94a3b8"}
              fontSize="12"
              fontWeight={activeModal === modal.verb ? "bold" : "normal"}
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              transition={{ delay: i * 0.1 + 0.2 }}
              viewport={{ once: true }}
            >
              {modal.verb}
            </motion.text>

            {/* Active glow dot */}
            {activeModal === modal.verb && (
              <motion.circle
                cx={x}
                cy={100}
                r="6"
                fill={modal.color}
                filter="url(#meter-glow)"
                initial={{ scale: 0 }}
                animate={{ scale: [0.8, 1.2, 0.8] }}
                transition={{ duration: 1.5, repeat: Infinity }}
              />
            )}
          </g>
        );
      })}
    </svg>
  );
}

function SentenceStructureSVG() {
  return (
    <svg viewBox="0 0 700 200" className="w-full max-w-4xl mx-auto">
      <defs>
        <filter id="struct-glow">
          <feGaussianBlur stdDeviation="3" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* Declarative sentence */}
      <text x="350" y="25" textAnchor="middle" fill="#94a3b8" fontSize="12" fontWeight="bold">
        УТВЕРДИТЕЛЬНОЕ ПРЕДЛОЖЕНИЕ
      </text>

      {/* S box */}
      <motion.rect
        x="80"
        y="40"
        width="130"
        height="50"
        rx="10"
        fill="#0a1520"
        stroke="#22d3ee"
        strokeWidth="1.5"
        initial={{ opacity: 0, y: -20 }}
        whileInView={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        viewport={{ once: true }}
      />
      <text x="145" y="62" textAnchor="middle" fill="#22d3ee" fontSize="14" fontWeight="bold">Subject</text>
      <text x="145" y="80" textAnchor="middle" fill="#64748b" fontSize="11">Кто? Что?</text>

      {/* V box */}
      <motion.rect
        x="245"
        y="40"
        width="130"
        height="50"
        rx="10"
        fill="#0a1520"
        stroke="#06b6d4"
        strokeWidth="1.5"
        initial={{ opacity: 0, y: -20 }}
        whileInView={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        viewport={{ once: true }}
      />
      <text x="310" y="62" textAnchor="middle" fill="#06b6d4" fontSize="14" fontWeight="bold">Verb</text>
      <text x="310" y="80" textAnchor="middle" fill="#64748b" fontSize="11">Что делает?</text>

      {/* O box */}
      <motion.rect
        x="410"
        y="40"
        width="130"
        height="50"
        rx="10"
        fill="#0a1520"
        stroke="#0ea5e9"
        strokeWidth="1.5"
        initial={{ opacity: 0, y: -20 }}
        whileInView={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        viewport={{ once: true }}
      />
      <text x="475" y="62" textAnchor="middle" fill="#0ea5e9" fontSize="14" fontWeight="bold">Object</text>
      <text x="475" y="80" textAnchor="middle" fill="#64748b" fontSize="11">Кого? Что?</text>

      {/* Arrows */}
      <motion.g
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        transition={{ delay: 0.4 }}
        viewport={{ once: true }}
      >
        <line x1="210" y1="65" x2="245" y2="65" stroke="#1e3a5f" strokeWidth="1.5" />
        <polygon points="243,62 249,65 243,68" fill="#22d3ee" />
        <line x1="375" y1="65" x2="410" y2="65" stroke="#1e3a5f" strokeWidth="1.5" />
        <polygon points="408,62 414,65 408,68" fill="#06b6d4" />
      </motion.g>

      {/* Example */}
      <motion.g
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        transition={{ delay: 0.5 }}
        viewport={{ once: true }}
      >
        <text x="145" y="108" textAnchor="middle" fill="#22d3ee" fontSize="13">I</text>
        <text x="310" y="108" textAnchor="middle" fill="#06b6d4" fontSize="13">read</text>
        <text x="475" y="108" textAnchor="middle" fill="#0ea5e9" fontSize="13">books</text>
        <text x="145" y="124" textAnchor="middle" fill="#475569" fontSize="11">(Я)</text>
        <text x="310" y="124" textAnchor="middle" fill="#475569" fontSize="11">(читаю)</text>
        <text x="475" y="124" textAnchor="middle" fill="#475569" fontSize="11">(книги)</text>
      </motion.g>

      {/* Question transformation */}
      <text x="350" y="155" textAnchor="middle" fill="#94a3b8" fontSize="12" fontWeight="bold">
        ВОПРОСИТЕЛЬНОЕ ПРЕДЛОЖЕНИЕ
      </text>

      {/* Question word */}
      <motion.rect
        x="40"
        y="168"
        width="110"
        height="28"
        rx="6"
        fill="#22d3ee15"
        stroke="#22d3ee"
        strokeWidth="1"
        initial={{ opacity: 0, x: -20 }}
        whileInView={{ opacity: 1, x: 0 }}
        transition={{ delay: 0.6 }}
        viewport={{ once: true }}
      />
      <text x="95" y="186" textAnchor="middle" fill="#22d3ee" fontSize="12">? Word</text>

      {/* Aux */}
      <motion.rect
        x="165"
        y="168"
        width="110"
        height="28"
        rx="6"
        fill="#06b6d415"
        stroke="#06b6d4"
        strokeWidth="1"
        initial={{ opacity: 0, x: -20 }}
        whileInView={{ opacity: 1, x: 0 }}
        transition={{ delay: 0.7 }}
        viewport={{ once: true }}
      />
      <text x="220" y="186" textAnchor="middle" fill="#06b6d4" fontSize="12">Auxiliary</text>

      {/* S */}
      <motion.rect
        x="290"
        y="168"
        width="110"
        height="28"
        rx="6"
        fill="#0ea5e915"
        stroke="#0ea5e9"
        strokeWidth="1"
        initial={{ opacity: 0, x: -20 }}
        whileInView={{ opacity: 1, x: 0 }}
        transition={{ delay: 0.8 }}
        viewport={{ once: true }}
      />
      <text x="345" y="186" textAnchor="middle" fill="#0ea5e9" fontSize="12">Subject</text>

      {/* V */}
      <motion.rect
        x="415"
        y="168"
        width="110"
        height="28"
        rx="6"
        fill="#38bdf815"
        stroke="#38bdf8"
        strokeWidth="1"
        initial={{ opacity: 0, x: -20 }}
        whileInView={{ opacity: 1, x: 0 }}
        transition={{ delay: 0.9 }}
        viewport={{ once: true }}
      />
      <text x="470" y="186" textAnchor="middle" fill="#38bdf8" fontSize="12">Verb</text>

      {/* O */}
      <motion.rect
        x="540"
        y="168"
        width="110"
        height="28"
        rx="6"
        fill="#0284c715"
        stroke="#0284c7"
        strokeWidth="1"
        initial={{ opacity: 0, x: -20 }}
        whileInView={{ opacity: 1, x: 0 }}
        transition={{ delay: 1.0 }}
        viewport={{ once: true }}
      />
      <text x="595" y="186" textAnchor="middle" fill="#0284c7" fontSize="12">Object?</text>

      {/* Example question */}
      <motion.text
        x="350"
        y="212"
        textAnchor="middle"
        fill="#94a3b8"
        fontSize="12"
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        transition={{ delay: 1.1 }}
        viewport={{ once: true }}
      >
        What do you read?
      </motion.text>
    </svg>
  );
}

function ConditionalsFlowSVG({ activeConditional }: { activeConditional: number | null }) {
  return (
    <svg viewBox="0 0 700 240" className="w-full max-w-4xl mx-auto">
      <defs>
        <filter id="flow-glow">
          <feGaussianBlur stdDeviation="3" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* Type 0 Flow */}
      <motion.g
        initial={{ opacity: 0, y: 10 }}
        whileInView={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        viewport={{ once: true }}
      >
        <text x="170" y="22" textAnchor="middle" fill="#22d3ee" fontSize="13" fontWeight="bold">
          Type 0 — Закон / Факт
        </text>

        {/* IF box */}
        <rect
          x="30"
          y="32"
          width="120"
          height="40"
          rx="8"
          fill={activeConditional === 0 ? "#22d3ee15" : "#0a1520"}
          stroke={activeConditional === 0 ? "#22d3ee" : "#1e3a5f"}
          strokeWidth={activeConditional === 0 ? 2 : 1}
        />
        <text x="90" y="57" textAnchor="middle" fill="#22d3ee" fontSize="14" fontWeight="bold">IF</text>

        {/* Arrow */}
        <line x1="150" y1="52" x2="180" y2="52" stroke="#22d3ee" strokeWidth="1.5" strokeDasharray="4 3">
          <animate attributeName="stroke-dashoffset" from="0" to="-14" dur="1s" repeatCount="indefinite" />
        </line>
        <polygon points="178,49 184,52 178,55" fill="#22d3ee" />

        {/* Condition box */}
        <rect
          x="184"
          y="32"
          width="160"
          height="40"
          rx="8"
          fill={activeConditional === 0 ? "#22d3ee10" : "#0a1520"}
          stroke={activeConditional === 0 ? "#22d3ee" : "#1e3a5f"}
          strokeWidth={activeConditional === 0 ? 1.5 : 1}
        />
        <text x="264" y="50" textAnchor="middle" fill="#94a3b8" fontSize="12">Present Simple</text>
        <text x="264" y="65" textAnchor="middle" fill="#64748b" fontSize="10">условие (условие)</text>

        {/* THEN arrow */}
        <line x1="344" y1="52" x2="374" y2="52" stroke="#22d3ee" strokeWidth="1.5">
          <animate attributeName="stroke-dashoffset" from="0" to="-14" dur="1s" repeatCount="indefinite" />
        </line>
        <polygon points="372,49 378,52 372,55" fill="#22d3ee" />
        <text x="359" y="45" textAnchor="middle" fill="#22d3ee" fontSize="9">then</text>

        {/* Result box */}
        <rect
          x="378"
          y="32"
          width="160"
          height="40"
          rx="8"
          fill={activeConditional === 0 ? "#22d3ee10" : "#0a1520"}
          stroke={activeConditional === 0 ? "#22d3ee" : "#1e3a5f"}
          strokeWidth={activeConditional === 0 ? 1.5 : 1}
        />
        <text x="458" y="50" textAnchor="middle" fill="#94a3b8" fontSize="12">Present Simple</text>
        <text x="458" y="65" textAnchor="middle" fill="#64748b" fontSize="10">результат (всегда)</text>
      </motion.g>

      {/* Type 1 Flow */}
      <motion.g
        initial={{ opacity: 0, y: 10 }}
        whileInView={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        viewport={{ once: true }}
      >
        <text x="170" y="112" textAnchor="middle" fill="#06b6d4" fontSize="13" fontWeight="bold">
          Type 1 — Возможная ситуация
        </text>

        {/* IF box */}
        <rect
          x="30"
          y="122"
          width="120"
          height="40"
          rx="8"
          fill={activeConditional === 1 ? "#06b6d415" : "#0a1520"}
          stroke={activeConditional === 1 ? "#06b6d4" : "#1e3a5f"}
          strokeWidth={activeConditional === 1 ? 2 : 1}
        />
        <text x="90" y="147" textAnchor="middle" fill="#06b6d4" fontSize="14" fontWeight="bold">IF</text>

        {/* Arrow */}
        <line x1="150" y1="142" x2="180" y2="142" stroke="#06b6d4" strokeWidth="1.5" strokeDasharray="4 3">
          <animate attributeName="stroke-dashoffset" from="0" to="-14" dur="1s" repeatCount="indefinite" />
        </line>
        <polygon points="178,139 184,142 178,145" fill="#06b6d4" />

        {/* Condition box */}
        <rect
          x="184"
          y="122"
          width="160"
          height="40"
          rx="8"
          fill={activeConditional === 1 ? "#06b6d410" : "#0a1520"}
          stroke={activeConditional === 1 ? "#06b6d4" : "#1e3a5f"}
          strokeWidth={activeConditional === 1 ? 1.5 : 1}
        />
        <text x="264" y="140" textAnchor="middle" fill="#94a3b8" fontSize="12">Present Simple</text>
        <text x="264" y="155" textAnchor="middle" fill="#64748b" fontSize="10">условие (реальное)</text>

        {/* THEN arrow */}
        <line x1="344" y1="142" x2="374" y2="142" stroke="#06b6d4" strokeWidth="1.5">
          <animate attributeName="stroke-dashoffset" from="0" to="-14" dur="1s" repeatCount="indefinite" />
        </line>
        <polygon points="372,139 378,142 372,145" fill="#06b6d4" />
        <text x="359" y="135" textAnchor="middle" fill="#06b6d4" fontSize="9">will</text>

        {/* Result box */}
        <rect
          x="378"
          y="122"
          width="160"
          height="40"
          rx="8"
          fill={activeConditional === 1 ? "#06b6d410" : "#0a1520"}
          stroke={activeConditional === 1 ? "#06b6d4" : "#1e3a5f"}
          strokeWidth={activeConditional === 1 ? 1.5 : 1}
        />
        <text x="458" y="140" textAnchor="middle" fill="#94a3b8" fontSize="12">Future Simple</text>
        <text x="458" y="155" textAnchor="middle" fill="#64748b" fontSize="10">результат (возможен)</text>
      </motion.g>

      {/* Visual separator with glow */}
      <motion.line
        x1="50"
        y1="90"
        x2="650"
        y2="90"
        stroke="#1e3a5f"
        strokeWidth="0.5"
        strokeDasharray="6 4"
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 0.5 }}
        viewport={{ once: true }}
      />

      {/* 100% certainty badge for Type 0 */}
      <motion.g
        initial={{ opacity: 0, scale: 0.8 }}
        whileInView={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.5 }}
        viewport={{ once: true }}
      >
        <circle cx="610" cy="52" r="18" fill="#22d3ee15" stroke="#22d3ee" strokeWidth="1" />
        <text x="610" y="56" textAnchor="middle" fill="#22d3ee" fontSize="10" fontWeight="bold">100%</text>
      </motion.g>

      {/* Possible badge for Type 1 */}
      <motion.g
        initial={{ opacity: 0, scale: 0.8 }}
        whileInView={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.7 }}
        viewport={{ once: true }}
      >
        <circle cx="610" cy="142" r="18" fill="#06b6d415" stroke="#06b6d4" strokeWidth="1" />
        <text x="610" y="146" textAnchor="middle" fill="#06b6d4" fontSize="9" fontWeight="bold">~50%</text>
      </motion.g>

      {/* Decorative bottom text */}
      <text x="350" y="192" textAnchor="middle" fill="#475569" fontSize="11">
        💡 Если условие истинно → следует результат
      </text>
    </svg>
  );
}

// ============================================================
// MAIN COMPONENT
// ============================================================

export default function English7Cheatsheet() {
  const [activeTense, setActiveTense] = useState<string | null>(null);
  const [activeArticle, setActiveArticle] = useState<string | null>(null);
  const [activeComparison, setActiveComparison] = useState<number | null>(null);
  const [activeModal, setActiveModal] = useState<string | null>(null);
  const [activeConditional, setActiveConditional] = useState<number | null>(null);
  const [expandedSection, setExpandedSection] = useState<string | null>("irregular");
  const [irregularSearch, setIrregularSearch] = useState("");
  const [verbsTab, setVerbsTab] = useState<"short" | "long" | "irregular">("short");
  const [prepTab, setPrepTab] = useState<"time" | "place">("time");

  const filteredVerbs = irregularVerbs.filter(
    (v) =>
      v.v1.toLowerCase().includes(irregularSearch.toLowerCase()) ||
      v.v2.toLowerCase().includes(irregularSearch.toLowerCase()) ||
      v.v3.toLowerCase().includes(irregularSearch.toLowerCase())
  );

  return (
    <main className="relative min-h-screen bg-[#060e18] text-white overflow-hidden">
      {/* Background Pattern — Matrix-like dots */}
      <div className="fixed inset-0 z-0 pointer-events-none">
        <svg width="100%" height="100%" className="opacity-[0.03]">
          <defs>
            <pattern id="matrix-dots" x="0" y="0" width="30" height="30" patternUnits="userSpaceOnUse">
              <circle cx="2" cy="2" r="1" fill="#22d3ee" />
              <circle cx="17" cy="17" r="0.5" fill="#0ea5e9" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#matrix-dots)" />
        </svg>
      </div>

      {/* Blur glow orbs */}
      <div className="fixed top-20 left-1/4 w-[500px] h-[500px] bg-cyan-500/5 rounded-full blur-[150px] pointer-events-none" />
      <div className="fixed bottom-40 right-1/4 w-[400px] h-[400px] bg-sky-500/5 rounded-full blur-[120px] pointer-events-none" />
      <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-cyan-400/3 rounded-full blur-[180px] pointer-events-none" />

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* =================== HEADER =================== */}
        <motion.header
          className="text-center mb-16 pt-8"
          initial={{ opacity: 0, y: -30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
        >
          {/* Back link */}
          <motion.div
            className="mb-6"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
          >
            <Link
              href="/vpr-tests"
              className="inline-flex items-center gap-2 text-cyan-400/70 hover:text-cyan-300 transition-colors text-sm"
            >
              <ArrowRight className="w-4 h-4 rotate-180" />
              Назад к тестам ВПР
            </Link>
          </motion.div>

          {/* Badge */}
          <motion.div
            className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-cyan-900/20 border border-cyan-700/30 text-cyan-400 text-sm mb-6"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.3 }}
          >
            <BookOpen className="w-4 h-4" />
            7 класс • Английский язык • ВПР
          </motion.div>

          {/* Title */}
          <motion.h1
            className="text-4xl sm:text-5xl md:text-6xl font-extrabold mb-4 bg-gradient-to-r from-cyan-300 via-sky-400 to-cyan-500 bg-clip-text text-transparent leading-tight"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
          >
            English Shitsheet
          </motion.h1>

          {/* Subtitle */}
          <motion.p
            className="text-lg text-slate-400 max-w-2xl mx-auto"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.6 }}
          >
            Полный шпаргалка по грамматике английского языка для подготовки к ВПР в 7 классе.
            Все темы, формулы и примеры в одном месте.
          </motion.p>

          {/* Stats */}
          <motion.div
            className="flex flex-wrap justify-center gap-6 mt-8"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.8 }}
          >
            {[
              { icon: Clock, label: "5 времён", color: "text-cyan-400" },
              { icon: PenTool, label: "60+ глаголов", color: "text-sky-400" },
              { icon: HelpCircle, label: "8 разделов", color: "text-cyan-300" },
              { icon: Lightbulb, label: "100+ примеров", color: "text-sky-300" },
            ].map((stat, i) => (
              <div key={i} className="flex items-center gap-2 text-sm text-slate-500">
                <stat.icon className={`w-4 h-4 ${stat.color}`} />
                <span>{stat.label}</span>
              </div>
            ))}
          </motion.div>
        </motion.header>

        {/* =================== SECTION 1: TENSES TIMELINE =================== */}
        <motion.section
          className="mb-20"
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          transition={{ duration: 0.6 }}
          viewport={{ once: true }}
        >
          <div className="flex items-center gap-3 mb-8">
            <div className="p-3 bg-cyan-900/30 rounded-xl border border-cyan-700/40">
              <Clock className="text-cyan-400 w-7 h-7" />
            </div>
            <div>
              <h2 className="text-3xl md:text-4xl font-bold text-white">Времена</h2>
              <p className="text-cyan-500/60 text-sm">5 основных времён с формулами и примерами</p>
            </div>
          </div>

          <motion.div
            className="bg-[#0a1520] rounded-xl border border-cyan-800/40 p-6 mb-6"
            whileHover={{ borderColor: "rgba(6, 182, 212, 0.4)" }}
            transition={{ duration: 0.3 }}
          >
            <div className="flex items-center gap-2 mb-4 text-sm text-slate-400">
              <MousePointerClick className="w-4 h-4 text-cyan-500" />
              Наведите на маркер на таймлайне, чтобы увидеть детали
            </div>
            <TimelineSVG activeTense={activeTense} onTenseHover={setActiveTense} />
          </motion.div>

          <AnimatePresence mode="wait">
            {activeTense && (
              <motion.div
                key={activeTense}
                initial={{ opacity: 0, y: 20, height: 0 }}
                animate={{ opacity: 1, y: 0, height: "auto" }}
                exit={{ opacity: 0, y: -10, height: 0 }}
                transition={{ duration: 0.4 }}
                className="bg-[#0a1520] rounded-xl border border-cyan-800/40 p-6 overflow-hidden"
              >
                {(() => {
                  const tense = tensesData.find((t) => t.id === activeTense);
                  if (!tense) return null;
                  return (
                    <div>
                      <div className="flex items-center gap-3 mb-4">
                        <div
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: tense.color }}
                        />
                        <h3 className="text-xl font-bold text-white">{tense.name}</h3>
                        <span className="text-slate-400 text-sm">— {tense.russian}</span>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                        <div className="bg-cyan-900/10 rounded-lg p-4 border border-cyan-800/20">
                          <p className="text-cyan-400 text-xs font-semibold mb-1">✅ Утверждение</p>
                          <p className="text-white text-sm font-mono">{tense.formula}</p>
                        </div>
                        <div className="bg-red-900/10 rounded-lg p-4 border border-red-800/20">
                          <p className="text-red-400 text-xs font-semibold mb-1">❌ Отрицание</p>
                          <p className="text-white text-sm font-mono">{tense.negative}</p>
                        </div>
                        <div className="bg-amber-900/10 rounded-lg p-4 border border-amber-800/20">
                          <p className="text-amber-400 text-xs font-semibold mb-1">❓ Вопрос</p>
                          <p className="text-white text-sm font-mono">{tense.question}</p>
                        </div>
                      </div>

                      <div className="mb-4">
                        <p className="text-slate-300 text-sm mb-2">
                          <span className="text-cyan-400 font-semibold">Когда используется:</span> {tense.usage}
                        </p>
                      </div>

                      <div className="space-y-2 mb-4">
                        <p className="text-slate-400 text-xs font-semibold">Примеры:</p>
                        {tense.examples.map((ex, i) => (
                          <motion.div
                            key={i}
                            className="flex items-start gap-2 bg-[#060e18] rounded-lg px-4 py-2"
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: i * 0.1 }}
                          >
                            <span className="text-cyan-500 text-xs mt-1">•</span>
                            <p className="text-slate-200 text-sm italic">{ex}</p>
                          </motion.div>
                        ))}
                      </div>

                      <div className="flex flex-wrap gap-2">
                        {tense.markers.map((m) => (
                          <span
                            key={m}
                            className="px-2 py-1 text-xs rounded-full bg-cyan-900/20 border border-cyan-800/30 text-cyan-400"
                          >
                            {m}
                          </span>
                        ))}
                      </div>
                    </div>
                  );
                })()}
              </motion.div>
            )}
          </AnimatePresence>
        </motion.section>

        {/* =================== SECTION 2: ARTICLES =================== */}
        <motion.section
          className="mb-20"
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          transition={{ duration: 0.6 }}
          viewport={{ once: true }}
        >
          <div className="flex items-center gap-3 mb-8">
            <div className="p-3 bg-cyan-900/30 rounded-xl border border-cyan-700/40">
              <PenTool className="text-cyan-400 w-7 h-7" />
            </div>
            <div>
              <h2 className="text-3xl md:text-4xl font-bold text-white">Артикли</h2>
              <p className="text-cyan-500/60 text-sm">Правила использования a/an, the и нулевого артикля</p>
            </div>
          </div>

          <motion.div
            className="bg-[#0a1520] rounded-xl border border-cyan-800/40 p-6 mb-6"
            whileHover={{ borderColor: "rgba(6, 182, 212, 0.4)" }}
            transition={{ duration: 0.3 }}
          >
            <ArticlesSVG activeArticle={activeArticle} />
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {articlesRules.map((article) => (
              <motion.div
                key={article.type}
                className="bg-[#0a1520] rounded-xl border border-cyan-800/40 p-5 cursor-pointer"
                onMouseEnter={() => setActiveArticle(article.type)}
                onMouseLeave={() => setActiveArticle(null)}
                whileHover={{
                  borderColor: `${article.color}80`,
                  backgroundColor: `${article.color}08`,
                }}
                transition={{ duration: 0.3 }}
              >
                <h3
                  className="text-lg font-bold mb-1"
                  style={{ color: article.color }}
                >
                  {article.title}
                </h3>
                <p className="text-slate-500 text-xs mb-3">{article.russian}</p>
                <ul className="space-y-2">
                  {article.rules.map((rule, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-slate-300">
                      <span className="text-cyan-500 mt-0.5 shrink-0">•</span>
                      {rule}
                    </li>
                  ))}
                </ul>
              </motion.div>
            ))}
          </div>
        </motion.section>

        {/* =================== SECTION 3: COMPARATIVES & SUPERLATIVES =================== */}
        <motion.section
          className="mb-20"
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          transition={{ duration: 0.6 }}
          viewport={{ once: true }}
        >
          <div className="flex items-center gap-3 mb-8">
            <div className="p-3 bg-cyan-900/30 rounded-xl border border-cyan-700/40">
              <Languages className="text-cyan-400 w-7 h-7" />
            </div>
            <div>
              <h2 className="text-3xl md:text-4xl font-bold text-white">Степени сравнения</h2>
              <p className="text-cyan-500/60 text-sm">Правила образования сравнительной и превосходной степени</p>
            </div>
          </div>

          <motion.div
            className="bg-[#0a1520] rounded-xl border border-cyan-800/40 p-6 mb-6"
            whileHover={{ borderColor: "rgba(6, 182, 212, 0.4)" }}
            transition={{ duration: 0.3 }}
          >
            <div className="flex items-center gap-2 mb-4 text-sm text-slate-400">
              <MousePointerClick className="w-4 h-4 text-cyan-500" />
              Наведите на ступень, чтобы подсветить
            </div>
            <ComparisonLadderSVG activeComparison={activeComparison} />
          </motion.div>

          {/* Tabs */}
          <div className="flex gap-2 mb-4">
            {(["short", "long", "irregular"] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setVerbsTab(tab)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  verbsTab === tab
                    ? "bg-cyan-900/30 border border-cyan-600/40 text-cyan-300"
                    : "bg-[#0a1520] border border-cyan-800/20 text-slate-400 hover:text-slate-300"
                }`}
              >
                {tab === "short"
                  ? "Короткие"
                  : tab === "long"
                  ? "Длинные"
                  : "Исключения"}
              </button>
            ))}
          </div>

          <AnimatePresence mode="wait">
            <motion.div
              key={verbsTab}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.3 }}
              className="bg-[#0a1520] rounded-xl border border-cyan-800/40 p-5"
              onMouseEnter={() => setActiveComparison(0)}
              onMouseLeave={() => setActiveComparison(null)}
            >
              {verbsTab === "short" && (
                <div>
                  <p className="text-cyan-400 text-sm font-semibold mb-1">{comparisonData.short.title}</p>
                  <p className="text-slate-400 text-xs mb-4 font-mono">{comparisonData.short.rule}</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                    {comparisonData.short.examples.map((ex, i) => (
                      <div key={i} className="bg-[#060e18] rounded-lg p-3 space-y-1">
                        <p className="text-slate-200 text-sm">🟢 {ex.pos}</p>
                        <p className="text-cyan-400 text-sm">🔵 {ex.comp}</p>
                        <p className="text-sky-400 text-sm">⭐ {ex.sup}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {verbsTab === "long" && (
                <div>
                  <p className="text-cyan-400 text-sm font-semibold mb-1">{comparisonData.long.title}</p>
                  <p className="text-slate-400 text-xs mb-4 font-mono">{comparisonData.long.rule}</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                    {comparisonData.long.examples.map((ex, i) => (
                      <div key={i} className="bg-[#060e18] rounded-lg p-3 space-y-1">
                        <p className="text-slate-200 text-sm">🟢 {ex.pos}</p>
                        <p className="text-cyan-400 text-sm">🔵 {ex.comp}</p>
                        <p className="text-sky-400 text-sm">⭐ {ex.sup}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {verbsTab === "irregular" && (
                <div>
                  <p className="text-cyan-400 text-sm font-semibold mb-4">Неправильные формы</p>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-cyan-800/30">
                          <th className="text-left py-2 px-3 text-cyan-400 font-semibold">Положительная</th>
                          <th className="text-left py-2 px-3 text-cyan-400 font-semibold">Сравнительная</th>
                          <th className="text-left py-2 px-3 text-cyan-400 font-semibold">Превосходная</th>
                        </tr>
                      </thead>
                      <tbody>
                        {comparisonData.irregular.map((ex, i) => (
                          <motion.tr
                            key={i}
                            className="border-b border-cyan-900/20"
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: i * 0.05 }}
                          >
                            <td className="py-2 px-3 text-slate-200">{ex.pos}</td>
                            <td className="py-2 px-3 text-cyan-400">{ex.comp}</td>
                            <td className="py-2 px-3 text-sky-400">{ex.sup}</td>
                          </motion.tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </motion.section>

        {/* =================== SECTION 4: MODAL VERBS =================== */}
        <motion.section
          className="mb-20"
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          transition={{ duration: 0.6 }}
          viewport={{ once: true }}
        >
          <div className="flex items-center gap-3 mb-8">
            <div className="p-3 bg-cyan-900/30 rounded-xl border border-cyan-700/40">
              <MessageSquare className="text-cyan-400 w-7 h-7" />
            </div>
            <div>
              <h2 className="text-3xl md:text-4xl font-bold text-white">Модальные глаголы</h2>
              <p className="text-cyan-500/60 text-sm">Can, could, must, should, may, might — шкала уверенности</p>
            </div>
          </div>

          <motion.div
            className="bg-[#0a1520] rounded-xl border border-cyan-800/40 p-6 mb-6"
            whileHover={{ borderColor: "rgba(6, 182, 212, 0.4)" }}
            transition={{ duration: 0.3 }}
          >
            <div className="flex items-center gap-2 mb-4 text-sm text-slate-400">
              <MousePointerClick className="w-4 h-4 text-cyan-500" />
              Наведите на глагол, чтобы увидеть уровень уверенности
            </div>
            <ModalMeterSVG activeModal={activeModal} onModalHover={setActiveModal} />
          </motion.div>

          {/* Modal detail cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {modalVerbsData.map((modal, i) => (
              <motion.div
                key={modal.verb}
                className={`bg-[#0a1520] rounded-xl border p-5 transition-all cursor-pointer ${
                  activeModal === modal.verb
                    ? "border-opacity-60"
                    : "border-cyan-800/40"
                }`}
                style={{
                  borderColor: activeModal === modal.verb ? modal.color : undefined,
                  backgroundColor: activeModal === modal.verb ? `${modal.color}08` : undefined,
                }}
                onMouseEnter={() => setActiveModal(modal.verb)}
                onMouseLeave={() => setActiveModal(null)}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.1 }}
                viewport={{ once: true }}
                whileHover={{ y: -4 }}
              >
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-lg font-bold" style={{ color: modal.color }}>
                    {modal.verb}
                  </h3>
                  <span className="text-xs text-slate-500 bg-[#060e18] px-2 py-1 rounded-full">
                    {modal.probability}%
                  </span>
                </div>

                <p className="text-slate-300 text-sm mb-2">{modal.meaning}</p>
                <p className="text-slate-500 text-xs mb-3">{modal.usage}</p>

                {/* Animated probability bar */}
                <div className="w-full h-2 rounded-full bg-[#060e18] mb-3 overflow-hidden">
                  <motion.div
                    className="h-full rounded-full"
                    style={{ backgroundColor: modal.color }}
                    initial={{ width: 0 }}
                    whileInView={{ width: `${modal.probability}%` }}
                    transition={{ delay: i * 0.1 + 0.3, duration: 0.8, ease: "easeOut" }}
                    viewport={{ once: true }}
                  />
                </div>

                <div className="space-y-1">
                  {modal.examples.map((ex, j) => (
                    <p key={j} className="text-xs text-slate-400 italic">
                      {ex}
                    </p>
                  ))}
                </div>
              </motion.div>
            ))}
          </div>
        </motion.section>

        {/* =================== SECTION 5: QUESTION WORDS & WORD ORDER =================== */}
        <motion.section
          className="mb-20"
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          transition={{ duration: 0.6 }}
          viewport={{ once: true }}
        >
          <div className="flex items-center gap-3 mb-8">
            <div className="p-3 bg-cyan-900/30 rounded-xl border border-cyan-700/40">
              <HelpCircle className="text-cyan-400 w-7 h-7" />
            </div>
            <div>
              <h2 className="text-3xl md:text-4xl font-bold text-white">Вопросительные слова</h2>
              <p className="text-cyan-500/60 text-sm">Порядок слов и специальные вопросы</p>
            </div>
          </div>

          <motion.div
            className="bg-[#0a1520] rounded-xl border border-cyan-800/40 p-6 mb-6"
            whileHover={{ borderColor: "rgba(6, 182, 212, 0.4)" }}
            transition={{ duration: 0.3 }}
          >
            <SentenceStructureSVG />
          </motion.div>

          {/* Question words grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {questionWords.map((qw, i) => (
              <motion.div
                key={qw.word}
                className="bg-[#0a1520] rounded-xl border border-cyan-800/40 p-4 hover:border-cyan-600/40 transition-all"
                whileHover={{ y: -4, borderColor: "rgba(6, 182, 212, 0.5)" }}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.06 }}
                viewport={{ once: true }}
              >
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-lg font-bold text-cyan-400">{qw.word}</h3>
                  <span className="text-xs text-slate-500 bg-[#060e18] px-2 py-0.5 rounded-full">
                    {qw.type}
                  </span>
                </div>
                <p className="text-slate-300 text-sm mb-2">{qw.russian}</p>
                <p className="text-xs text-slate-500 italic bg-[#060e18] rounded px-2 py-1">{qw.example}</p>
              </motion.div>
            ))}
          </div>
        </motion.section>

        {/* =================== SECTION 6: CONDITIONALS =================== */}
        <motion.section
          className="mb-20"
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          transition={{ duration: 0.6 }}
          viewport={{ once: true }}
        >
          <div className="flex items-center gap-3 mb-8">
            <div className="p-3 bg-cyan-900/30 rounded-xl border border-cyan-700/40">
              <Lightbulb className="text-cyan-400 w-7 h-7" />
            </div>
            <div>
              <h2 className="text-3xl md:text-4xl font-bold text-white">Условные предложения</h2>
              <p className="text-cyan-500/60 text-sm">Conditionals Type 0 и Type 1 — блок-схемы и примеры</p>
            </div>
          </div>

          <motion.div
            className="bg-[#0a1520] rounded-xl border border-cyan-800/40 p-6 mb-6"
            whileHover={{ borderColor: "rgba(6, 182, 212, 0.4)" }}
            transition={{ duration: 0.3 }}
          >
            <ConditionalsFlowSVG activeConditional={activeConditional} />
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {conditionalsData.map((cond, i) => (
              <motion.div
                key={cond.type}
                className="bg-[#0a1520] rounded-xl border border-cyan-800/40 p-5 cursor-pointer"
                onMouseEnter={() => setActiveConditional(i)}
                onMouseLeave={() => setActiveConditional(null)}
                whileHover={{
                  borderColor: `${cond.color}80`,
                  backgroundColor: `${cond.color}08`,
                }}
                style={{
                  borderColor: activeConditional === i ? cond.color : undefined,
                  backgroundColor: activeConditional === i ? `${cond.color}08` : undefined,
                }}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.15 }}
                viewport={{ once: true }}
              >
                <div className="flex items-center gap-2 mb-3">
                  <span
                    className="px-2 py-1 rounded-md text-xs font-bold"
                    style={{ backgroundColor: `${cond.color}20`, color: cond.color }}
                  >
                    {cond.type}
                  </span>
                  <span className="text-slate-400 text-sm">{cond.russian}</span>
                </div>

                <p className="text-slate-200 text-sm font-mono bg-[#060e18] rounded-lg px-4 py-2 mb-3">
                  {cond.formula}
                </p>

                <p className="text-slate-400 text-xs mb-3">{cond.usage}</p>

                <div className="space-y-2">
                  {cond.examples.map((ex, j) => (
                    <motion.div
                      key={j}
                      className="flex items-start gap-2 bg-[#060e18] rounded-lg px-3 py-2"
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: j * 0.1 }}
                    >
                      <span style={{ color: cond.color }} className="text-xs mt-0.5">•</span>
                      <p className="text-slate-300 text-sm italic">{ex}</p>
                    </motion.div>
                  ))}
                </div>
              </motion.div>
            ))}
          </div>
        </motion.section>

        {/* =================== SECTION 7: IRREGULAR VERBS =================== */}
        <motion.section
          className="mb-20"
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          transition={{ duration: 0.6 }}
          viewport={{ once: true }}
        >
          <div className="flex items-center gap-3 mb-8">
            <div className="p-3 bg-cyan-900/30 rounded-xl border border-cyan-700/40">
              <Volume2 className="text-cyan-400 w-7 h-7" />
            </div>
            <div>
              <h2 className="text-3xl md:text-4xl font-bold text-white">Неправильные глаголы</h2>
              <p className="text-cyan-500/60 text-sm">60+ неправильных глаголов — три формы</p>
            </div>
          </div>

          {/* Expandable section */}
          <motion.div
            className="bg-[#0a1520] rounded-xl border border-cyan-800/40 overflow-hidden"
            whileHover={{ borderColor: "rgba(6, 182, 212, 0.4)" }}
            transition={{ duration: 0.3 }}
          >
            <button
              onClick={() =>
                setExpandedSection(expandedSection === "irregular" ? null : "irregular")
              }
              className="w-full flex items-center justify-between p-5 text-left hover:bg-cyan-900/5 transition-colors"
            >
              <div className="flex items-center gap-3">
                <Eye className="text-cyan-400 w-5 h-5" />
                <span className="text-white font-semibold">
                  Список неправильных глаголов ({filteredVerbs.length})
                </span>
              </div>
              {expandedSection === "irregular" ? (
                <ChevronUp className="w-5 h-5 text-slate-400" />
              ) : (
                <ChevronDown className="w-5 h-5 text-slate-400" />
              )}
            </button>

            <AnimatePresence>
              {expandedSection === "irregular" && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.4 }}
                  className="overflow-hidden"
                >
                  <div className="px-5 pb-5">
                    {/* Search */}
                    <div className="relative mb-4">
                      <input
                        type="text"
                        placeholder="Поиск глагола..."
                        value={irregularSearch}
                        onChange={(e) => setIrregularSearch(e.target.value)}
                        className="w-full bg-[#060e18] border border-cyan-800/30 rounded-lg px-4 py-2.5 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-cyan-600/50 transition-colors"
                      />
                    </div>

                    {/* Table */}
                    <div className="max-h-96 overflow-y-auto custom-scrollbar rounded-lg border border-cyan-900/20">
                      <table className="w-full text-sm">
                        <thead className="sticky top-0 bg-[#0a1520] z-10">
                          <tr className="border-b border-cyan-800/30">
                            <th className="text-left py-3 px-4 text-cyan-400 font-semibold w-12">#</th>
                            <th className="text-left py-3 px-4 text-cyan-400 font-semibold">V1 (Infinitive)</th>
                            <th className="text-left py-3 px-4 text-cyan-400 font-semibold">V2 (Past Simple)</th>
                            <th className="text-left py-3 px-4 text-cyan-400 font-semibold">V3 (Past Participle)</th>
                          </tr>
                        </thead>
                        <tbody>
                          {filteredVerbs.map((verb, i) => (
                            <motion.tr
                              key={verb.v1}
                              className="border-b border-cyan-900/15 hover:bg-cyan-900/10 transition-colors"
                              initial={{ opacity: 0 }}
                              whileInView={{ opacity: 1 }}
                              transition={{ delay: Math.min(i * 0.02, 0.8) }}
                              viewport={{ once: true }}
                            >
                              <td className="py-2.5 px-4 text-slate-500 text-xs">{i + 1}</td>
                              <td className="py-2.5 px-4 text-white font-medium">{verb.v1}</td>
                              <td className="py-2.5 px-4 text-cyan-400">{verb.v2}</td>
                              <td className="py-2.5 px-4 text-sky-400">{verb.v3}</td>
                            </motion.tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        </motion.section>

        {/* =================== SECTION 8: PREPOSITIONS =================== */}
        <motion.section
          className="mb-20"
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          transition={{ duration: 0.6 }}
          viewport={{ once: true }}
        >
          <div className="flex items-center gap-3 mb-8">
            <div className="p-3 bg-cyan-900/30 rounded-xl border border-cyan-700/40">
              <Eye className="text-cyan-400 w-7 h-7" />
            </div>
            <div>
              <h2 className="text-3xl md:text-4xl font-bold text-white">Предлоги in / on / at</h2>
              <p className="text-cyan-500/60 text-sm">Использование предлогов для времени и места</p>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex gap-2 mb-4">
            {(["time", "place"] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setPrepTab(tab)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  prepTab === tab
                    ? "bg-cyan-900/30 border border-cyan-600/40 text-cyan-300"
                    : "bg-[#0a1520] border border-cyan-800/20 text-slate-400 hover:text-slate-300"
                }`}
              >
                {tab === "time" ? "⏰ Время" : "📍 Место"}
              </button>
            ))}
          </div>

          <AnimatePresence mode="wait">
            <motion.div
              key={prepTab}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.3 }}
            >
              {(prepTab === "time" ? prepositionsData.time : prepositionsData.place).map(
                (prep, i) => (
                  <motion.div
                    key={prep.prep}
                    className="bg-[#0a1520] rounded-xl border border-cyan-800/40 p-5 mb-3 last:mb-0"
                    whileHover={{ borderColor: "rgba(6, 182, 212, 0.5)", x: 4 }}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.1 }}
                  >
                    <div className="flex items-start gap-4">
                      <div className="shrink-0 w-16 h-16 rounded-xl bg-cyan-900/20 border border-cyan-700/30 flex items-center justify-center">
                        <span className="text-2xl font-bold text-cyan-400">{prep.prep}</span>
                      </div>
                      <div>
                        <h3 className="text-white font-semibold mb-1">{prep.russian}</h3>
                        <p className="text-slate-400 text-sm">{prep.usage}</p>
                      </div>
                    </div>
                  </motion.div>
                )
              )}
            </motion.div>
          </AnimatePresence>

          {/* Visual summary */}
          <motion.div
            className="mt-6 bg-[#0a1520] rounded-xl border border-cyan-800/40 p-6"
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
            viewport={{ once: true }}
          >
            <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
              <Lightbulb className="w-5 h-5 text-cyan-400" />
              Запомни!
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="bg-[#060e18] rounded-lg p-4 text-center">
                <p className="text-3xl mb-2">🎯</p>
                <p className="text-cyan-400 font-bold text-lg">IN</p>
                <p className="text-slate-400 text-xs mt-1">Большой → Маленький</p>
                <p className="text-slate-500 text-xs">in 2024, in January, in London</p>
              </div>
              <div className="bg-[#060e18] rounded-lg p-4 text-center">
                <p className="text-3xl mb-2">📅</p>
                <p className="text-sky-400 font-bold text-lg">ON</p>
                <p className="text-slate-400 text-xs mt-1">Конкретный день / поверхность</p>
                <p className="text-slate-500 text-xs">on Monday, on the table</p>
              </div>
              <div className="bg-[#060e18] rounded-lg p-4 text-center">
                <p className="text-3xl mb-2">📍</p>
                <p className="text-cyan-300 font-bold text-lg">AT</p>
                <p className="text-slate-400 text-xs mt-1">Точная точка / время</p>
                <p className="text-slate-500 text-xs">at 5 o'clock, at school</p>
              </div>
            </div>
          </motion.div>
        </motion.section>

        {/* =================== FOOTER =================== */}
        <motion.footer
          className="text-center py-10 border-t border-cyan-900/20"
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          transition={{ duration: 0.6 }}
          viewport={{ once: true }}
        >
          <div className="flex items-center justify-center gap-2 mb-3">
            <BookOpen className="w-5 h-5 text-cyan-500" />
            <span className="text-slate-400 text-sm">English Shitsheet — 7 класс ВПР</span>
          </div>
          <p className="text-slate-600 text-xs mb-4">
            Все примеры основаны на школьной программе по английскому языку
          </p>
          <Link
            href="/vpr-tests"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-cyan-900/20 border border-cyan-700/30 text-cyan-400 text-sm hover:bg-cyan-900/30 hover:border-cyan-600/40 transition-all"
          >
            <ArrowRight className="w-4 h-4 rotate-180" />
            Назад к тестам ВПР
          </Link>
        </motion.footer>
      </div>

      {/* Global styles for scrollbar */}
      <style jsx global>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: #060e18;
          border-radius: 3px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #1e3a5f;
          border-radius: 3px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #22d3ee40;
        }
      `}</style>
    </main>
  );
}

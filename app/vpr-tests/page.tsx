"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { motion, AnimatePresence, useScroll, useTransform } from "framer-motion";
import { getVprTestsBootstrapAction } from "./actions";
import { debugLogger } from "@/lib/debugLogger";
import {
  Loader2, Trophy, BookOpen, Terminal, Calculator,
  Cpu, Zap, Activity,
  Map as MapIcon, Leaf, Bug, Atom, Ruler,
  Globe, Landmark, ChevronRight, ChevronDown,
  Languages, Hash, ArrowRight, Radar, Shield, Flame, Star, Users, Lock
} from "lucide-react";
import { VibeContentRenderer } from "@/components/VibeContentRenderer";
import type { Database } from "@/types/database.types";
import { AdBreak } from "@/components/AdBreak";

/* ================================================================
   TYPES
   ================================================================ */

type Subject = Database['public']['Tables']['subjects']['Row'] & {
  grade_level?: number | null;
};
type LeaderboardEntry = {
  user_id: string;
  username: string | null;
  avatar_url: string | null;
  total_score: number | null;
};

type CheatData = {
  href: string;
  title: string;
  subtitle: string;
  desc: string;
  color: string;
  glowColor: string;
  borderColor: string;
  bgAccent: string;
  icon: 'globe' | 'languages' | 'terminal' | 'bug' | 'hash' | 'atom' | 'landmark' | 'leaf' | 'calculator' | 'ruler';
  tag: string;
  tagColor: string;
};

/* ================================================================
   CHEAT DATA PER GRADE
   ================================================================ */

const gradeCheats: Record<number, CheatData[]> = {
  7: [
    {
      href: "/vpr/geography/7/cheatsheet",
      title: "Geo_Grid",
      subtitle: "Planet Protocol",
      desc: "Картография и координаты. Масштабирование, градусная сеть, климатические пояса — полный атлас знаний.",
      color: "#14b8a6",
      glowColor: "rgba(20, 184, 166, 0.3)",
      borderColor: "border-teal-500/30",
      bgAccent: "bg-teal-500/5",
      icon: "globe",
      tag: "Geography",
      tagColor: "text-teal-300 bg-teal-900/40 border-teal-500/20",
    },
    {
      href: "/vpr/english/7/cheatsheet",
      title: "Lingua_Code",
      subtitle: "English Protocol",
      desc: "Grammar engine: Tenses, Articles, Modals, Conditionals. Декодирование английской грамматики.",
      color: "#22d3ee",
      glowColor: "rgba(34, 211, 238, 0.3)",
      borderColor: "border-cyan-500/30",
      bgAccent: "bg-cyan-500/5",
      icon: "languages",
      tag: "English",
      tagColor: "text-cyan-300 bg-cyan-900/40 border-cyan-500/20",
    },
    {
      href: "/vpr/informatics/7/cheatsheet",
      title: "Net_Architect",
      subtitle: "Matrix Protocol",
      desc: "Маршрутизация пакетов, логические круги Эйлера. Вход в цифровую реальность.",
      color: "#22c55e",
      glowColor: "rgba(34, 197, 94, 0.3)",
      borderColor: "border-green-500/30",
      bgAccent: "bg-green-500/5",
      icon: "terminal",
      tag: "Informatics",
      tagColor: "text-green-300 bg-green-900/40 border-green-500/20",
    },
    {
      href: "/vpr/biology/7/cheatsheet",
      title: "Bio_Scanner",
      subtitle: "Zoology Matrix",
      desc: "Анализ многоклеточных систем. Эволюция, от Амёбы до Млекопитающих. Реестр видов.",
      color: "#10b981",
      glowColor: "rgba(16, 185, 129, 0.3)",
      borderColor: "border-emerald-500/30",
      bgAccent: "bg-emerald-500/5",
      icon: "bug",
      tag: "Biology",
      tagColor: "text-emerald-300 bg-emerald-900/40 border-emerald-500/20",
    },
    {
      href: "/vpr/algebra/7/cheatsheet",
      title: "Algebra_Core",
      subtitle: "Function Engine",
      desc: "Линейные зависимости, уравнения, графический синтаксис. Математические протоколы 7 уровня.",
      color: "#3b82f6",
      glowColor: "rgba(59, 130, 246, 0.3)",
      borderColor: "border-blue-500/30",
      bgAccent: "bg-blue-500/5",
      icon: "hash",
      tag: "Algebra",
      tagColor: "text-blue-300 bg-blue-900/40 border-blue-500/20",
    },
    {
      href: "/vpr/physics/7/cheatsheet",
      title: "Gravity_Lab",
      subtitle: "Physics Engine",
      desc: "Законы механики, плотность, давление, сила Архимеда. Лаборатория физических законов.",
      color: "#f97316",
      glowColor: "rgba(249, 115, 22, 0.3)",
      borderColor: "border-orange-500/30",
      bgAccent: "bg-orange-500/5",
      icon: "atom",
      tag: "Physics",
      tagColor: "text-orange-300 bg-orange-900/40 border-orange-500/20",
    },
    {
      href: "/vpr/history/7/cheatsheet",
      title: "Chrono_Archive",
      subtitle: "History Protocol",
      desc: "XX век. Анализ пропаганды и исторических цепочек. Декодирование прошлого.",
      color: "#eab308",
      glowColor: "rgba(234, 179, 8, 0.3)",
      borderColor: "border-yellow-500/30",
      bgAccent: "bg-yellow-500/5",
      icon: "landmark",
      tag: "History",
      tagColor: "text-yellow-300 bg-yellow-900/40 border-yellow-500/20",
    },
    {
      href: "/vpr/russian/7/cheatsheet",
      title: "Русский_Код",
      subtitle: "Morpheme Engine",
      desc: "Морфемика, орфография, синтаксис. Полное декодирование русского языка.",
      color: "#a855f7",
      glowColor: "rgba(168, 85, 247, 0.3)",
      borderColor: "border-violet-500/30",
      bgAccent: "bg-violet-500/5",
      icon: "languages",
      tag: "Russian",
      tagColor: "text-violet-300 bg-violet-900/40 border-violet-500/20",
    },
  ],
  6: [
    {
      href: "/vpr/history/6/cheatsheet",
      title: "Chrono_Archive",
      subtitle: "Medieval Protocol",
      desc: "Средневековые протоколы. Хроники государств и цивилизаций. Рыцари, крестовые походы, торговые пути.",
      color: "#3b82f6",
      glowColor: "rgba(59, 130, 246, 0.3)",
      borderColor: "border-blue-500/30",
      bgAccent: "bg-blue-500/5",
      icon: "landmark",
      tag: "History",
      tagColor: "text-blue-300 bg-blue-900/40 border-blue-500/20",
    },
    {
      href: "/vpr/geography/6/cheatsheet",
      title: "Geo_Grid",
      subtitle: "Planet Protocol",
      desc: "Картография. Масштабирование и координаты. Градусная сеть и планеты Земля.",
      color: "#14b8a6",
      glowColor: "rgba(20, 184, 166, 0.3)",
      borderColor: "border-teal-500/30",
      bgAccent: "bg-teal-500/5",
      icon: "globe",
      tag: "Geography",
      tagColor: "text-teal-300 bg-teal-900/40 border-teal-500/20",
    },
    {
      href: "/vpr/biology/6/cheatsheet",
      title: "Bio_Scanner",
      subtitle: "Flora Protocol",
      desc: "Ботанический код. Системы жизнеобеспечения растений. От водорослей до покрытосеменных.",
      color: "#22c55e",
      glowColor: "rgba(34, 197, 94, 0.3)",
      borderColor: "border-green-500/30",
      bgAccent: "bg-green-500/5",
      icon: "leaf",
      tag: "Biology",
      tagColor: "text-green-300 bg-green-900/40 border-green-500/20",
    },
  ],
  8: [
    {
      href: "/vpr/algebra/8/cheatsheet",
      title: "Algebra_Core",
      subtitle: "Root Extraction",
      desc: "Дешифровка дискриминанта. Протокол извлечения квадратных корней. Полный арсенал.",
      color: "#22d3ee",
      glowColor: "rgba(34, 211, 238, 0.3)",
      borderColor: "border-cyan-500/30",
      bgAccent: "bg-cyan-500/5",
      icon: "calculator",
      tag: "Algebra",
      tagColor: "text-cyan-300 bg-cyan-900/40 border-cyan-500/20",
    },
  ],
};

/* ================================================================
   SVG COMPONENTS
   ================================================================ */

/* --- 1. NeuralNetworkHeroSVG: Animated network background for hero --- */
function NeuralNetworkHeroSVG() {
  const nodes = [
    { cx: 50, cy: 40, r: 3, color: "#00c2ff" },
    { cx: 150, cy: 25, r: 4, color: "#22c55e" },
    { cx: 250, cy: 55, r: 3, color: "#f97316" },
    { cx: 350, cy: 30, r: 5, color: "#a855f7" },
    { cx: 450, cy: 50, r: 3, color: "#14b8a6" },
    { cx: 80, cy: 80, r: 4, color: "#eab308" },
    { cx: 180, cy: 70, r: 3, color: "#00c2ff" },
    { cx: 300, cy: 85, r: 4, color: "#f97316" },
    { cx: 420, cy: 75, r: 3, color: "#22c55e" },
    { cx: 120, cy: 110, r: 5, color: "#a855f7" },
    { cx: 240, cy: 105, r: 3, color: "#14b8a6" },
    { cx: 360, cy: 115, r: 4, color: "#eab308" },
    { cx: 60, cy: 140, r: 3, color: "#22c55e" },
    { cx: 170, cy: 135, r: 4, color: "#00c2ff" },
    { cx: 280, cy: 150, r: 3, color: "#f97316" },
    { cx: 400, cy: 140, r: 5, color: "#a855f7" },
    { cx: 100, cy: 170, r: 3, color: "#14b8a6" },
    { cx: 220, cy: 175, r: 4, color: "#eab308" },
    { cx: 340, cy: 180, r: 3, color: "#22c55e" },
    { cx: 460, cy: 110, r: 4, color: "#00c2ff" },
  ];

  const connections = [
    [0, 1], [1, 2], [2, 3], [3, 4], [0, 5], [1, 6], [2, 7], [3, 8],
    [5, 6], [6, 7], [7, 8], [5, 9], [6, 10], [7, 11], [8, 19],
    [9, 10], [10, 11], [9, 13], [10, 14], [11, 15], [12, 13], [13, 14], [14, 15],
    [12, 16], [13, 17], [14, 18], [15, 19], [16, 17], [17, 18], [18, 19],
  ];

  return (
    <svg viewBox="0 0 500 200" className="w-full h-48 sm:h-56 md:h-64" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <filter id="nodeGlow">
          <feGaussianBlur stdDeviation="3" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <linearGradient id="connGrad" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#00c2ff" stopOpacity="0.15" />
          <stop offset="50%" stopColor="#a855f7" stopOpacity="0.15" />
          <stop offset="100%" stopColor="#22c55e" stopOpacity="0.15" />
        </linearGradient>
      </defs>

      {/* Connections */}
      {connections.map(([from, to], i) => (
        <motion.line
          key={`conn-${i}`}
          x1={nodes[from].cx} y1={nodes[from].cy}
          x2={nodes[to].cx} y2={nodes[to].cy}
          stroke="url(#connGrad)" strokeWidth="0.8"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: i * 0.04, duration: 0.5 }}
        />
      ))}

      {/* Animated pulse along some connections */}
      {connections.slice(0, 10).map(([from, to], i) => (
        <circle key={`pulse-${i}`} r="2" fill={nodes[from].color} opacity="0.6">
          <animateMotion
            dur={`${2.5 + i * 0.3}s`}
            repeatCount="indefinite"
            begin={`${i * 0.5}s`}
            path={`M${nodes[from].cx},${nodes[from].cy} L${nodes[to].cx},${nodes[to].cy}`}
          />
        </circle>
      ))}

      {/* Nodes */}
      {nodes.map((node, i) => (
        <g key={`node-${i}`}>
          <motion.circle
            cx={node.cx} cy={node.cy} r={node.r}
            fill={node.color} opacity="0.8" filter="url(#nodeGlow)"
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: i * 0.06, type: "spring", stiffness: 200 }}
          />
          {/* Outer ring pulse */}
          <circle cx={node.cx} cy={node.cy} r={node.r + 4} fill="none" stroke={node.color} strokeWidth="0.5" opacity="0">
            <animate attributeName="r" values={`${node.r + 4};${node.r + 12};${node.r + 4}`} dur={`${3 + (i % 4)}s`} repeatCount="indefinite" />
            <animate attributeName="opacity" values="0.3;0;0.3" dur={`${3 + (i % 4)}s`} repeatCount="indefinite" />
          </circle>
        </g>
      ))}
    </svg>
  );
}

/* --- 2. CheatIconSVG: Custom icon per subject type --- */
function CheatIconSVG({ type, color, size = 40 }: { type: string; color: string; size?: number }) {
  const s = size;

  switch (type) {
    case 'globe':
      return (
        <svg viewBox="0 0 40 40" width={s} height={s} xmlns="http://www.w3.org/2000/svg">
          <circle cx="20" cy="20" r="16" fill="none" stroke={color} strokeWidth="1.5" opacity="0.6" />
          <ellipse cx="20" cy="20" rx="8" ry="16" fill="none" stroke={color} strokeWidth="1" opacity="0.4" />
          <line x1="4" y1="20" x2="36" y2="20" stroke={color} strokeWidth="1" opacity="0.4" />
          <line x1="6" y1="12" x2="34" y2="12" stroke={color} strokeWidth="0.6" opacity="0.25" />
          <line x1="6" y1="28" x2="34" y2="28" stroke={color} strokeWidth="0.6" opacity="0.25" />
          <circle cx="20" cy="20" r="4" fill={color} opacity="0.15" />
          <circle cx="20" cy="20" r="2" fill={color} opacity="0.5">
            <animate attributeName="r" values="2;3;2" dur="3s" repeatCount="indefinite" />
          </circle>
        </svg>
      );
    case 'languages':
      return (
        <svg viewBox="0 0 40 40" width={s} height={s} xmlns="http://www.w3.org/2000/svg">
          <text x="10" y="20" fill={color} fontSize="11" fontWeight="bold" opacity="0.7">A</text>
          <text x="16" y="28" fill={color} fontSize="11" fontWeight="bold" opacity="0.5">Б</text>
          <line x1="6" y1="32" x2="34" y2="32" stroke={color} strokeWidth="1" opacity="0.3" />
          <text x="22" y="18" fill={color} fontSize="9" opacity="0.3">aбв</text>
        </svg>
      );
    case 'terminal':
      return (
        <svg viewBox="0 0 40 40" width={s} height={s} xmlns="http://www.w3.org/2000/svg">
          <rect x="4" y="6" width="32" height="28" rx="3" fill="none" stroke={color} strokeWidth="1.5" opacity="0.5" />
          <text x="10" y="18" fill={color} fontSize="10" fontFamily="monospace" opacity="0.8">&gt;_</text>
          <line x1="10" y1="24" x2="28" y2="24" stroke={color} strokeWidth="1" opacity="0.25" />
          <line x1="10" y1="28" x2="22" y2="28" stroke={color} strokeWidth="1" opacity="0.15" />
          <rect x="10" y="30" width="4" height="2" fill={color} opacity="0.5">
            <animate attributeName="opacity" values="0.5;0;0.5" dur="1s" repeatCount="indefinite" />
          </rect>
        </svg>
      );
    case 'bug':
      return (
        <svg viewBox="0 0 40 40" width={s} height={s} xmlns="http://www.w3.org/2000/svg">
          <ellipse cx="20" cy="20" rx="12" ry="8" fill="none" stroke={color} strokeWidth="1.5" opacity="0.5" />
          <line x1="8" y1="12" x2="20" y2="18" stroke={color} strokeWidth="1" opacity="0.4" />
          <line x1="32" y1="12" x2="20" y2="18" stroke={color} strokeWidth="1" opacity="0.4" />
          <line x1="8" y1="28" x2="20" y2="22" stroke={color} strokeWidth="1" opacity="0.4" />
          <line x1="32" y1="28" x2="20" y2="22" stroke={color} strokeWidth="1" opacity="0.4" />
          <line x1="14" y1="16" x2="14" y2="6" stroke={color} strokeWidth="0.8" opacity="0.3" />
          <line x1="26" y1="16" x2="26" y2="6" stroke={color} strokeWidth="0.8" opacity="0.3" />
          <circle cx="16" cy="18" r="1.5" fill={color} opacity="0.6" />
          <circle cx="24" cy="18" r="1.5" fill={color} opacity="0.6" />
        </svg>
      );
    case 'hash':
      return (
        <svg viewBox="0 0 40 40" width={s} height={s} xmlns="http://www.w3.org/2000/svg">
          <line x1="14" y1="6" x2="10" y2="34" stroke={color} strokeWidth="2.5" opacity="0.5" />
          <line x1="26" y1="6" x2="22" y2="34" stroke={color} strokeWidth="2.5" opacity="0.5" />
          <line x1="6" y1="14" x2="34" y2="14" stroke={color} strokeWidth="2.5" opacity="0.5" />
          <line x1="6" y1="26" x2="34" y2="26" stroke={color} strokeWidth="2.5" opacity="0.5" />
          <circle cx="20" cy="20" r="6" fill={color} opacity="0.08" />
        </svg>
      );
    case 'atom':
      return (
        <svg viewBox="0 0 40 40" width={s} height={s} xmlns="http://www.w3.org/2000/svg">
          <ellipse cx="20" cy="20" rx="14" ry="6" fill="none" stroke={color} strokeWidth="1" opacity="0.35" transform="rotate(0 20 20)" />
          <ellipse cx="20" cy="20" rx="14" ry="6" fill="none" stroke={color} strokeWidth="1" opacity="0.35" transform="rotate(60 20 20)" />
          <ellipse cx="20" cy="20" rx="14" ry="6" fill="none" stroke={color} strokeWidth="1" opacity="0.35" transform="rotate(120 20 20)" />
          <circle cx="20" cy="20" r="3" fill={color} opacity="0.6">
            <animate attributeName="r" values="3;4;3" dur="2s" repeatCount="indefinite" />
          </circle>
          <circle cx="20" cy="20" r="2" fill={color} opacity="0.9" />
        </svg>
      );
    case 'landmark':
      return (
        <svg viewBox="0 0 40 40" width={s} height={s} xmlns="http://www.w3.org/2000/svg">
          <polygon points="20,6 6,18 10,18 10,34 16,34 16,26 24,26 24,34 30,34 30,18 34,18" fill="none" stroke={color} strokeWidth="1.5" opacity="0.5" />
          <line x1="20" y1="6" x2="20" y2="14" stroke={color} strokeWidth="1" opacity="0.3" />
          <rect x="17" y="10" width="6" height="6" fill="none" stroke={color} strokeWidth="0.8" opacity="0.3" />
          <rect x="13" y="20" width="4" height="4" fill="none" stroke={color} strokeWidth="0.8" opacity="0.2" />
          <rect x="23" y="20" width="4" height="4" fill="none" stroke={color} strokeWidth="0.8" opacity="0.2" />
        </svg>
      );
    case 'leaf':
      return (
        <svg viewBox="0 0 40 40" width={s} height={s} xmlns="http://www.w3.org/2000/svg">
          <path d="M20,6 Q34,12 30,28 Q20,34 10,28 Q6,12 20,6" fill={color} opacity="0.08" stroke={color} strokeWidth="1.5" />
          <path d="M20,6 Q20,20 20,34" fill="none" stroke={color} strokeWidth="1" opacity="0.4" />
          <path d="M20,14 Q26,16 28,20" fill="none" stroke={color} strokeWidth="0.7" opacity="0.25" />
          <path d="M20,18 Q14,22 12,26" fill="none" stroke={color} strokeWidth="0.7" opacity="0.25" />
          <path d="M20,22 Q24,24 26,28" fill="none" stroke={color} strokeWidth="0.7" opacity="0.25" />
        </svg>
      );
    case 'calculator':
      return (
        <svg viewBox="0 0 40 40" width={s} height={s} xmlns="http://www.w3.org/2000/svg">
          <rect x="8" y="4" width="24" height="32" rx="3" fill="none" stroke={color} strokeWidth="1.5" opacity="0.5" />
          <rect x="12" y="8" width="16" height="8" rx="1" fill={color} opacity="0.15" stroke={color} strokeWidth="0.8" opacity="0.3" />
          <circle cx="14" cy="22" r="2" fill={color} opacity="0.3" />
          <circle cx="20" cy="22" r="2" fill={color} opacity="0.3" />
          <circle cx="26" cy="22" r="2" fill={color} opacity="0.3" />
          <circle cx="14" cy="28" r="2" fill={color} opacity="0.2" />
          <circle cx="20" cy="28" r="2" fill={color} opacity="0.2" />
          <circle cx="26" cy="28" r="2" fill={color} opacity="0.2" />
          <rect x="12" y="8" width="16" height="8" rx="1" fill={color} opacity="0.05" />
        </svg>
      );
    case 'ruler':
      return (
        <svg viewBox="0 0 40 40" width={s} height={s} xmlns="http://www.w3.org/2000/svg">
          <line x1="6" y1="30" x2="34" y2="10" stroke={color} strokeWidth="2" opacity="0.5" />
          <line x1="6" y1="30" x2="8" y2="28" stroke={color} strokeWidth="1" opacity="0.4" />
          <line x1="12" y1="25" x2="14" y2="23" stroke={color} strokeWidth="1" opacity="0.4" />
          <line x1="18" y1="20" x2="20" y2="18" stroke={color} strokeWidth="1" opacity="0.4" />
          <line x1="24" y1="15" x2="26" y2="13" stroke={color} strokeWidth="1" opacity="0.4" />
          <line x1="30" y1="10" x2="32" y2="8" stroke={color} strokeWidth="1" opacity="0.4" />
          <circle cx="34" cy="10" r="2" fill={color} opacity="0.3" />
        </svg>
      );
    default:
      return (
        <svg viewBox="0 0 40 40" width={s} height={s} xmlns="http://www.w3.org/2000/svg">
          <circle cx="20" cy="20" r="12" fill="none" stroke={color} strokeWidth="1.5" opacity="0.4" />
        </svg>
      );
  }
}

/* --- 3. RadarSVG: Animated radar sweep for leaderboard --- */
function RadarSVG() {
  return (
    <svg viewBox="0 0 100 100" className="w-20 h-20 sm:w-24 sm:h-24" xmlns="http://www.w3.org/2000/svg">
      <circle cx="50" cy="50" r="40" fill="none" stroke="#00c2ff" strokeWidth="0.5" opacity="0.2" />
      <circle cx="50" cy="50" r="28" fill="none" stroke="#00c2ff" strokeWidth="0.5" opacity="0.15" />
      <circle cx="50" cy="50" r="16" fill="none" stroke="#00c2ff" strokeWidth="0.5" opacity="0.1" />
      <line x1="50" y1="10" x2="50" y2="90" stroke="#00c2ff" strokeWidth="0.3" opacity="0.1" />
      <line x1="10" y1="50" x2="90" y2="50" stroke="#00c2ff" strokeWidth="0.3" opacity="0.1" />
      {/* Sweep line */}
      <line x1="50" y1="50" x2="50" y2="10" stroke="#00c2ff" strokeWidth="1.5" opacity="0.6">
        <animateTransform attributeName="transform" type="rotate" from="0 50 50" to="360 50 50" dur="3s" repeatCount="indefinite" />
      </line>
      {/* Sweep trail */}
      <path d="M50,50 L50,10 A40,40 0 0,1 88,28 Z" fill="#00c2ff" opacity="0.08">
        <animateTransform attributeName="transform" type="rotate" from="0 50 50" to="360 50 50" dur="3s" repeatCount="indefinite" />
      </path>
      {/* Blips */}
      <circle cx="30" cy="35" r="2" fill="#22c55e" opacity="0">
        <animate attributeName="opacity" values="0;0.8;0" dur="3s" repeatCount="indefinite" />
      </circle>
      <circle cx="65" cy="55" r="2" fill="#f97316" opacity="0">
        <animate attributeName="opacity" values="0;0.8;0" dur="3s" repeatCount="indefinite" begin="1s" />
      </circle>
      <circle cx="45" cy="70" r="1.5" fill="#a855f7" opacity="0">
        <animate attributeName="opacity" values="0;0.8;0" dur="3s" repeatCount="indefinite" begin="2s" />
      </circle>
      {/* Center dot */}
      <circle cx="50" cy="50" r="2" fill="#00c2ff" opacity="0.8" />
    </svg>
  );
}

/* --- 4. HexPatternSVG: Background hex grid --- */
function HexPatternSVG() {
  const hexes = [];
  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 12; col++) {
      const cx = col * 60 + (row % 2 ? 30 : 0);
      const cy = row * 52;
      hexes.push({ cx, cy });
    }
  }

  return (
    <svg viewBox="0 0 720 416" className="w-full h-full" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid slice">
      {hexes.map((hex, i) => (
        <polygon
          key={i}
          points={`${hex.cx},${hex.cy - 24} ${hex.cx + 21},${hex.cy - 12} ${hex.cx + 21},${hex.cy + 12} ${hex.cx},${hex.cy + 24} ${hex.cx - 21},${hex.cy + 12} ${hex.cx - 21},${hex.cy - 12}`}
          fill="none"
          stroke="#00c2ff"
          strokeWidth="0.3"
          opacity={0.04 + (i % 5) * 0.01}
        />
      ))}
    </svg>
  );
}

/* ================================================================
   BACKGROUND PATTERN
   ================================================================ */

function BackgroundPattern() {
  const particles = Array.from({ length: 40 }, (_, i) => ({
    cx: (i * 73 + 20) % 100,
    cy: (i * 47 + 15) % 100,
    r: 0.3 + (i % 3) * 0.3,
    opacity: 0.04 + (i % 4) * 0.02,
    duration: 3 + (i % 5),
    color: i % 3 === 0 ? "#00c2ff" : i % 3 === 1 ? "#a855f7" : "#22c55e",
  }));

  return (
    <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
      <svg className="absolute inset-0 w-full h-full" xmlns="http://www.w3.org/2000/svg">
        {particles.map((p, i) => (
          <circle key={i} cx={`${p.cx}%`} cy={`${p.cy}%`} r={p.r} fill={p.color} opacity={p.opacity}>
            <animate attributeName="opacity" values={`${p.opacity};${p.opacity * 2.5};${p.opacity}`} dur={`${p.duration}s`} repeatCount="indefinite" />
          </circle>
        ))}
      </svg>
      {/* Glow orbs */}
      <div className="absolute top-10 -left-40 w-96 h-96 bg-cyan-500/8 rounded-full blur-[150px]" />
      <div className="absolute top-1/3 -right-40 w-96 h-96 bg-purple-500/6 rounded-full blur-[160px]" />
      <div className="absolute bottom-20 left-1/4 w-80 h-80 bg-green-500/5 rounded-full blur-[140px]" />
      <div className="absolute top-2/3 right-1/3 w-72 h-72 bg-orange-500/4 rounded-full blur-[130px]" />
      {/* Hex grid overlay */}
      <div className="absolute inset-0 opacity-30">
        <HexPatternSVG />
      </div>
    </div>
  );
}

/* ================================================================
   ANIMATED COUNTER
   ================================================================ */

function AnimatedCounter({ target, label, color, icon }: { target: number; label: string; color: string; icon: React.ReactNode }) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    let start = 0;
    const duration = 1500;
    const increment = target / (duration / 16);
    const timer = setInterval(() => {
      start += increment;
      if (start >= target) {
        setCount(target);
        clearInterval(timer);
      } else {
        setCount(Math.floor(start));
      }
    }, 16);
    return () => clearInterval(timer);
  }, [target]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.5 }}
      className="relative group"
    >
      <div className="text-center p-6 rounded-xl border border-zinc-800/60 bg-zinc-950/50 backdrop-blur-sm hover:border-zinc-700/60 transition-all duration-300">
        <div className="flex justify-center mb-3 text-zinc-600 group-hover:text-zinc-400 transition-colors">
          {icon}
        </div>
        <div className="text-3xl sm:text-4xl font-black tabular-nums" style={{ color }}>
          {count}
        </div>
        <div className="text-[10px] text-zinc-600 uppercase tracking-[0.2em] mt-2 font-medium">
          {label}
        </div>
      </div>
    </motion.div>
  );
}

/* ================================================================
   SECTION HEADER
   ================================================================ */

function SectionHeader({ icon, title, subtitle, accent }: {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  accent?: string;
}) {
  return (
    <div className="flex items-center gap-4 mb-8">
      <div className={cn(
        "flex items-center justify-center w-12 h-12 rounded-xl border shrink-0",
        accent
          ? "bg-gradient-to-br from-cyan-500/20 to-blue-600/10 border-cyan-500/30 text-cyan-400"
          : "bg-gradient-to-br from-cyan-500/15 to-purple-500/10 border-cyan-500/20 text-cyan-400"
      )}>
        {icon}
      </div>
      <div>
        <h2 className="text-xl sm:text-2xl font-bold text-zinc-100 tracking-tight">{title}</h2>
        <p className="text-zinc-500 text-xs sm:text-sm mt-0.5">{subtitle}</p>
      </div>
    </div>
  );
}

/* ================================================================
   CHEAT CARD — completely redesigned
   ================================================================ */

function CheatCard({ data, index }: { data: CheatData; index: number }) {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-30px" }}
      transition={{ duration: 0.4, delay: index * 0.08 }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className="relative"
    >
      <Link href={data.href} className="block group">
        {/* Glow effect behind card */}
        <div
          className="absolute -inset-px rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 blur-md"
          style={{ backgroundColor: data.color, opacity: isHovered ? 0.15 : 0 }}
        />

        <div className={cn(
          "relative h-full p-5 sm:p-6 rounded-2xl border bg-zinc-950/80 backdrop-blur-sm transition-all duration-500 overflow-hidden",
          "border-zinc-800/60 hover:border-zinc-700/80"
        )}>
          {/* Animated corner accent */}
          <div className="absolute top-0 right-0 w-24 h-24 opacity-0 group-hover:opacity-100 transition-opacity duration-500">
            <svg viewBox="0 0 100 100" className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
              <path d="M100,0 L100,40 L60,0 Z" fill={data.color} opacity="0.06" />
              <path d="M100,0 L100,20 L80,0 Z" fill={data.color} opacity="0.1" />
            </svg>
          </div>

          {/* Top row: icon + tag */}
          <div className="flex items-start justify-between mb-4">
            <div
              className="w-12 h-12 rounded-xl flex items-center justify-center transition-all duration-500 border"
              style={{
                backgroundColor: `${data.color}10`,
                borderColor: `${data.color}25`,
              }}
            >
              <CheatIconSVG type={data.icon} color={data.color} size={36} />
            </div>
            <span className={cn(
              "px-2.5 py-1 rounded-md text-[9px] font-bold uppercase tracking-wider border",
              data.tagColor
            )}>
              {data.tag}
            </span>
          </div>

          {/* Title + Subtitle */}
          <h3
            className="text-lg font-black tracking-tight mb-0.5 transition-colors duration-300"
            style={{ color: isHovered ? data.color : '#f4f4f5' }}
          >
            {data.title}
          </h3>
          <p className="text-[11px] font-medium tracking-wider uppercase mb-3" style={{ color: `${data.color}99` }}>
            {data.subtitle}
          </p>

          {/* Description */}
          <AnimatePresence mode="wait">
            {isHovered && (
              <motion.p
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.3 }}
                className="text-[11px] text-zinc-500 leading-relaxed overflow-hidden"
              >
                {data.desc}
              </motion.p>
            )}
          </AnimatePresence>

          {/* Bottom: status indicator */}
          <div className="flex items-center justify-between mt-4 pt-3 border-t border-zinc-800/50">
            <div className="flex items-center gap-1.5">
              <div className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ backgroundColor: data.color }} />
              <span className="text-[9px] text-zinc-600 font-mono uppercase tracking-wider">Online</span>
            </div>
            <ArrowRight
              className="w-4 h-4 transition-all duration-300"
              style={{
                color: data.color,
                opacity: isHovered ? 1 : 0.3,
                transform: isHovered ? "translateX(4px)" : "translateX(0)",
              }}
            />
          </div>

          {/* Scanning line animation on hover */}
          {isHovered && (
            <motion.div
              initial={{ top: "0%" }}
              animate={{ top: "100%" }}
              transition={{ duration: 1.5, ease: "linear" }}
              className="absolute left-0 right-0 h-px pointer-events-none"
              style={{ backgroundColor: `${data.color}40` }}
            />
          )}
        </div>
      </Link>
    </motion.div>
  );
}

/* ================================================================
   SUBJECT MISSION CARD — redesigned
   ================================================================ */

function SubjectMissionCard({ subject, index }: { subject: Subject; index: number }) {
  return (
    <Link href={`/vpr-test/${subject.id}`} passHref legacyBehavior>
      <motion.a
        className="block relative group"
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ delay: index * 0.06 }}
        whileHover={{ y: -4 }}
      >
        {/* Hover glow */}
        <div className="absolute -inset-px rounded-xl bg-gradient-to-r from-cyan-500/0 via-cyan-500/20 to-cyan-500/0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 blur-sm" />

        <div className="relative bg-zinc-950/80 border border-zinc-800/60 rounded-xl p-5 hover:border-cyan-500/30 transition-all duration-300 backdrop-blur-sm overflow-hidden">
          {/* Scan line */}
          <div className="absolute inset-0 overflow-hidden rounded-xl pointer-events-none">
            <motion.div
              className="absolute left-0 right-0 h-px bg-cyan-500/20"
              initial={{ top: "-10%" }}
              animate={{ top: "110%" }}
              transition={{ duration: 4, repeat: Infinity, ease: "linear", delay: index * 0.8 }}
            />
          </div>

          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-zinc-800 to-zinc-900 border border-zinc-700/50 flex items-center justify-center group-hover:border-cyan-500/40 group-hover:shadow-[0_0_20px_rgba(0,194,255,0.15)] transition-all duration-300">
              <BookOpen className="w-5 h-5 text-zinc-500 group-hover:text-cyan-400 transition-colors duration-300" />
            </div>
            <div className="text-left flex-1 min-w-0">
              <h3 className="text-base font-bold text-zinc-300 group-hover:text-white transition-colors duration-300 truncate">
                {subject.name}
              </h3>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-[9px] font-mono text-zinc-600 uppercase tracking-wider">
                  LVL {subject.grade_level || 'X'}
                </span>
                <div className="w-1 h-1 rounded-full bg-zinc-700" />
                <span className="text-[9px] font-mono text-green-500/60 uppercase tracking-wider">Active</span>
              </div>
            </div>
            <ChevronRight className="w-5 h-5 text-zinc-700 group-hover:text-cyan-400 group-hover:translate-x-1 transition-all duration-300 shrink-0" />
          </div>
        </div>
      </motion.a>
    </Link>
  );
}

/* ================================================================
   LEADERBOARD CARD — redesigned
   ================================================================ */

function LeaderboardCard({ entry, index }: { entry: LeaderboardEntry; index: number }) {
  const rankColors = ["#eab308", "#94a3b8", "#cd7f32"];
  const isTopThree = index < 3;

  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      whileInView={{ opacity: 1, x: 0 }}
      viewport={{ once: true }}
      transition={{ delay: index * 0.08 }}
      whileHover={{ x: 4 }}
      className="relative group"
    >
      <div className={cn(
        "flex items-center justify-between p-4 sm:p-5 border rounded-xl transition-all duration-300 bg-zinc-950/80 backdrop-blur-sm",
        isTopThree
          ? "border-zinc-700/50 hover:border-yellow-500/30"
          : "border-zinc-800/60 hover:border-cyan-500/20"
      )}>
        {/* Rank */}
        <div className="flex items-center gap-4 sm:gap-5 flex-1 min-w-0">
          <div className="relative shrink-0">
            {isTopThree ? (
              <div
                className="w-10 h-10 rounded-lg flex items-center justify-center font-black text-lg"
                style={{
                  color: rankColors[index],
                  backgroundColor: `${rankColors[index]}15`,
                  border: `1px solid ${rankColors[index]}30`,
                }}
              >
                {index + 1}
              </div>
            ) : (
              <div className="w-10 h-10 rounded-lg flex items-center justify-center font-black text-lg text-zinc-700 bg-zinc-900/50 border border-zinc-800">
                {index + 1}
              </div>
            )}
          </div>

          {/* Avatar */}
          <div className="w-11 h-11 rounded-lg bg-zinc-900 border border-zinc-800 flex items-center justify-center overflow-hidden grayscale group-hover:grayscale-0 transition-all duration-500 shrink-0">
            {entry.avatar_url ? (
              <img src={entry.avatar_url} alt="" className="w-full h-full object-cover" />
            ) : (
              <Terminal className="w-5 h-5 text-zinc-700 group-hover:text-zinc-400 transition-colors" />
            )}
          </div>

          {/* Name */}
          <div className="text-left min-w-0">
            <div className="text-sm font-bold text-zinc-400 group-hover:text-white transition-colors truncate">
              {entry.username || 'ANON_OPERATOR'}
            </div>
            <div className="text-[9px] text-zinc-700 font-mono uppercase tracking-wider flex items-center gap-1.5">
              <div className="w-1 h-1 rounded-full bg-green-500/60" />
              Sector_Active
            </div>
          </div>
        </div>

        {/* Score */}
        <div className="flex items-center gap-2 shrink-0 ml-4">
          <div className="text-right">
            <div className={cn(
              "font-black text-lg sm:text-xl tabular-nums",
              isTopThree ? "" : "text-cyan-400"
            )} style={isTopThree ? { color: rankColors[index] } : {}}>
              {entry.total_score}
            </div>
            <div className="text-[9px] text-zinc-600 font-mono uppercase tracking-wider text-right">XP</div>
          </div>
          {isTopThree && (
            <Star
              className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity"
              style={{ color: rankColors[index] }}
              fill={rankColors[index]}
            />
          )}
        </div>
      </div>
    </motion.div>
  );
}

/* ================================================================
   MAIN PAGE COMPONENT
   ================================================================ */

export default function VprTestsListPage() {
  const [allSubjects, setAllSubjects] = useState<Subject[]>([]);
  const [selectedGrade, setSelectedGrade] = useState<number>(7);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showAllSubjects, setShowAllSubjects] = useState(false);

  const { scrollYProgress } = useScroll();
  const heroOpacity = useTransform(scrollYProgress, [0, 0.15], [1, 0]);
  const heroScale = useTransform(scrollYProgress, [0, 0.15], [1, 0.95]);

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      try {
        const data = await getVprTestsBootstrapAction();
        if (!data.success) {
          debugLogger.warn("VPR bootstrap warning:", data.error);
        }
        setAllSubjects(data.subjects as Subject[] || []);
        setLeaderboard((data.leaderboard as LeaderboardEntry[]) || []);
      } catch (err) {
        debugLogger.error("Uplink Error:", err);
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, []);

  const displayedSubjects = useMemo(() => {
    return allSubjects.filter(subject => subject.grade_level === selectedGrade);
  }, [allSubjects, selectedGrade]);

  const visibleSubjects = showAllSubjects ? displayedSubjects : displayedSubjects.slice(0, 6);

  const currentCheats = gradeCheats[selectedGrade] || [];
  const totalCheats = Object.values(gradeCheats).reduce((sum, arr) => sum + arr.length, 0);

  /* ---- LOADING STATE ---- */
  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#030712] flex flex-col items-center justify-center font-mono relative overflow-hidden">
        {/* Animated loading background */}
        <div className="absolute inset-0 pointer-events-none">
          {Array.from({ length: 20 }).map((_, i) => (
            <motion.div
              key={i}
              className="absolute w-px bg-cyan-500/20"
              initial={{ height: 0, y: "100%" }}
              animate={{ height: ["0%", "100%", "0%"], y: ["0%", "0%", "100%"] }}
              transition={{ duration: 2, repeat: Infinity, delay: i * 0.15, ease: "easeInOut" }}
              style={{
                left: `${(i * 5) + 2.5}%`,
                top: 0,
                bottom: 0,
              }}
            />
          ))}
        </div>
        <div className="relative z-10 flex flex-col items-center">
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.5 }}
          >
            <svg viewBox="0 0 60 60" className="w-16 h-16 mb-6" xmlns="http://www.w3.org/2000/svg">
              <polygon
                points="30,4 56,20 56,44 30,56 4,44 4,20"
                fill="none"
                stroke="#00c2ff"
                strokeWidth="1.5"
                opacity="0.4"
              >
                <animateTransform
                  attributeName="transform"
                  type="rotate"
                  from="0 30 30"
                  to="360 30 30"
                  dur="4s"
                  repeatCount="indefinite"
                />
              </polygon>
              <polygon
                points="30,14 46,24 46,40 30,48 14,40 14,24"
                fill="none"
                stroke="#00c2ff"
                strokeWidth="1"
                opacity="0.25"
              >
                <animateTransform
                  attributeName="transform"
                  type="rotate"
                  from="360 30 30"
                  to="0 30 30"
                  dur="3s"
                  repeatCount="indefinite"
                />
              </polygon>
              <circle cx="30" cy="30" r="4" fill="#00c2ff" opacity="0.6">
                <animate attributeName="r" values="4;6;4" dur="2s" repeatCount="indefinite" />
              </circle>
            </svg>
          </motion.div>
          <span className="text-[10px] text-zinc-600 tracking-[0.5em] animate-pulse uppercase">
            Initializing_Cognitive_Grid
          </span>
          <div className="mt-4 flex gap-1">
            {[0, 1, 2, 3, 4].map((i) => (
              <motion.div
                key={i}
                className="w-1.5 h-1.5 bg-cyan-500 rounded-full"
                animate={{ opacity: [0.2, 1, 0.2], scale: [0.8, 1.2, 0.8] }}
                transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.2 }}
              />
            ))}
          </div>
        </div>
      </div>
    );
  }

  /* ---- MAIN RENDER ---- */
  return (
    <div className="min-h-screen bg-[#030712] text-zinc-300 font-mono selection:bg-cyan-500/30 relative overflow-hidden">
      <BackgroundPattern />

      <main className="relative z-10">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">

          {/* ============================================
              HERO SECTION
              ============================================ */}
          <motion.header
            style={{ opacity: heroOpacity, scale: heroScale }}
            className="text-center mb-16 sm:mb-20 pt-4 sm:pt-8"
          >
            {/* Status line */}
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="flex items-center justify-center gap-2 mb-6"
            >
              <Lock className="w-3 h-3 text-green-500" />
              <span className="text-[9px] text-zinc-600 font-bold tracking-[0.35em] uppercase">
                Access_Level: Granted // VPR_Protocol_v4.5
              </span>
              <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
            </motion.div>

            {/* Neural network SVG */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3, duration: 1 }}
              className="mb-8 max-w-2xl mx-auto"
            >
              <NeuralNetworkHeroSVG />
            </motion.div>

            {/* Title */}
            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5, duration: 0.7 }}
              className="text-5xl sm:text-7xl md:text-8xl lg:text-9xl font-black tracking-tighter italic mb-4 relative"
            >
              <span className="text-white">VPR</span>
              <span className="text-cyan-400">_</span>
              <span className="bg-gradient-to-r from-cyan-400 via-blue-400 to-purple-400 bg-clip-text text-transparent">
                CORE
              </span>
              {/* Underline accent */}
              <motion.div
                initial={{ scaleX: 0 }}
                animate={{ scaleX: 1 }}
                transition={{ delay: 0.8, duration: 0.8, ease: "easeOut" }}
                className="h-1 mt-2 mx-auto bg-gradient-to-r from-transparent via-cyan-500 to-transparent origin-center"
                style={{ width: "60%" }}
              />
            </motion.h1>

            {/* Subtitle */}
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.9 }}
              className="text-zinc-500 text-sm sm:text-base max-w-lg mx-auto uppercase tracking-tighter leading-relaxed"
            >
              Тренажеры когнитивной подготовки.
              <br />
              Прошивка знаний для успешного деплоя в класс.
            </motion.p>

            {/* Tags */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 1.1 }}
              className="flex flex-wrap justify-center gap-2 mt-6"
            >
              {['ВПР', '7 класс', 'Шпаргалки', 'Тренажеры'].map((tag) => (
                <span
                  key={tag}
                  className="px-3 py-1 bg-zinc-900/50 border border-zinc-800/50 rounded-full text-[10px] text-zinc-500 uppercase tracking-wider"
                >
                  {tag}
                </span>
              ))}
            </motion.div>
          </motion.header>

          {/* ============================================
              STATS DASHBOARD
              ============================================ */}
          <motion.section
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="mb-16 sm:mb-20"
          >
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
              <AnimatedCounter target={totalCheats} label="Шпаргалок" color="#00c2ff" icon={<Cpu className="w-5 h-5" />} />
              <AnimatedCounter target={allSubjects.length} label="Предметов" color="#a855f7" icon={<BookOpen className="w-5 h-5" />} />
              <AnimatedCounter target={leaderboard.length} label="Операторов" color="#22c55e" icon={<Users className="w-5 h-5" />} />
              <AnimatedCounter target={3} label="Уровней" color="#f97316" icon={<Shield className="w-5 h-5" />} />
            </div>
          </motion.section>

          {/* ============================================
              GRADE SELECTOR
              ============================================ */}
          <motion.section
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="mb-12 sm:mb-16"
          >
            <div className="flex justify-center">
              <div className="relative inline-flex bg-zinc-900/50 border border-zinc-800/60 rounded-2xl p-1.5 backdrop-blur-sm">
                {/* Animated background indicator */}
                <AnimatePresence mode="wait">
                  <motion.div
                    key={selectedGrade}
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    transition={{ duration: 0.2 }}
                    className="absolute top-1.5 bottom-1.5 bg-cyan-500/10 border border-cyan-500/30 rounded-xl shadow-[0_0_20px_rgba(0,194,255,0.15)]"
                    style={{
                      left: `${(selectedGrade - 6) * 33.33 + 1}%`,
                      width: '31%',
                    }}
                  />
                </AnimatePresence>

                {[6, 7, 8].map((grade) => {
                  const count = (gradeCheats[grade] || []).length;
                  return (
                    <button
                      key={grade}
                      onClick={() => setSelectedGrade(grade)}
                      className={cn(
                        "relative z-10 px-8 sm:px-12 py-3 sm:py-3.5 font-black text-xs tracking-widest transition-all duration-300 rounded-xl",
                        selectedGrade === grade
                          ? "text-cyan-400"
                          : "text-zinc-600 hover:text-zinc-400"
                      )}
                    >
                      <span className="block">LVL_{grade}</span>
                      <span className={cn(
                        "block text-[8px] mt-0.5 tracking-wider",
                        selectedGrade === grade ? "text-cyan-500/60" : "text-zinc-700"
                      )}>
                        {count} modules
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </motion.section>

          {/* ============================================
              CHEATSHEETS GRID
              ============================================ */}
          <AnimatePresence mode="wait">
            <motion.section
              key={`cheats-${selectedGrade}`}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.4 }}
              className="mb-16 sm:mb-24"
            >
              {/* Section header */}
              <SectionHeader
                icon={<Terminal className="w-6 h-6" />}
                title={`Intelligence_Drops // Level_${selectedGrade}`}
                subtitle={`${currentCheats.length} активных модулей шифрования`}
              />

              {/* Encryption status bar */}
              <div className="flex items-center justify-between mb-6 px-1">
                <div className="flex items-center gap-2">
                  <Shield className="w-3.5 h-3.5 text-green-500/60" />
                  <span className="text-[9px] text-zinc-600 font-mono uppercase tracking-wider">
                    Encryption: <span className="text-green-500 font-bold">ACTIVE</span>
                  </span>
                </div>
                <span className="text-[9px] text-zinc-700 font-mono">
                  v4.5.{selectedGrade}.0
                </span>
              </div>

              {/* Grid */}
              {currentCheats.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-5">
                  {currentCheats.map((cheat, i) => (
                    <CheatCard key={cheat.href} data={cheat} index={i} />
                  ))}
                </div>
              ) : (
                <div className="py-20 text-center border-2 border-dashed border-zinc-800/60 rounded-2xl">
                  <Shield className="w-10 h-10 text-zinc-800 mx-auto mb-4" />
                  <p className="text-zinc-600 text-sm font-mono uppercase tracking-widest">
                    NO_MODULES_FOR_LVL_{selectedGrade}
                  </p>
                  <p className="text-zinc-700 text-[10px] mt-2">
                    Модули шифрования находятся в разработке
                  </p>
                </div>
              )}

              {/* Studio conversion / VibeCode teaser */}
              <motion.div
                initial={{ opacity: 0 }}
                whileInView={{ opacity: 1 }}
                viewport={{ once: true }}
                transition={{ delay: 0.3 }}
                className="mt-12 sm:mt-16"
              >
                <div className="relative rounded-2xl overflow-hidden">
                  {/* Gradient border */}
                  <div className="absolute inset-0 bg-gradient-to-r from-zinc-800/50 via-cyan-500/20 to-zinc-800/50 p-px rounded-2xl">
                    <div className="w-full h-full bg-[#030712] rounded-2xl" />
                  </div>

                  <div className="relative bg-[#030712] p-6 sm:p-8 rounded-2xl">
                    <div className="flex flex-col lg:flex-row items-center justify-between gap-8">
                      <div className="text-center lg:text-left">
                        <div className="flex items-center justify-center lg:justify-start gap-2 mb-3">
                          <Zap className="w-4 h-4 text-cyan-400" />
                          <span className="text-[9px] text-zinc-600 font-bold uppercase tracking-[0.3em]">
                            Engineering_Origin
                          </span>
                        </div>
                        <h3 className="text-xl sm:text-2xl font-black text-white mb-2 tracking-tight">
                          SuperVibe_<span className="text-cyan-400">Studio</span>
                        </h3>
                        <p className="text-zinc-500 text-xs sm:text-sm max-w-xl leading-relaxed">
                          Все эти протоколы были сгенерированы AI-Ассистентом на обычном смартфоне.
                          Мы не тратили месяцы на разработку — мы просто &quot;Вайбили&quot;.
                          Твоя математика — это база для такого софта.
                        </p>
                      </div>
                      <Link href="/repo-xml">
                        <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                          <Button className="bg-white text-black font-black uppercase italic px-10 sm:px-12 py-6 sm:py-7 rounded-xl hover:bg-cyan-400 transition-all duration-300 shadow-[6px_6px_0_rgba(0,194,255,0.3)] hover:shadow-[2px_2px_0_rgba(0,194,255,0.3)] hover:translate-x-1 hover:translate-y-1 text-sm sm:text-base">
                            Start_Vibe_Coding <ChevronRight className="ml-2 w-4 h-4" />
                          </Button>
                        </motion.div>
                      </Link>
                    </div>
                  </div>
                </div>
              </motion.div>
            </motion.section>
          </AnimatePresence>

          {/* ============================================
              SUBJECT MISSIONS GRID
              ============================================ */}
          <motion.section
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="mb-16 sm:mb-24"
          >
            <SectionHeader
              icon={<Radar className="w-6 h-6" />}
              title={`Миссии // Level_${selectedGrade}`}
              subtitle={`${displayedSubjects.length} активных тестовых протоколов`}
            />

            {displayedSubjects.length > 0 ? (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {visibleSubjects.map((subject, i) => (
                    <SubjectMissionCard key={subject.id} subject={subject} index={i} />
                  ))}
                </div>
                {displayedSubjects.length > 6 && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    whileInView={{ opacity: 1 }}
                    viewport={{ once: true }}
                    className="text-center mt-8"
                  >
                    <button
                      onClick={() => setShowAllSubjects(!showAllSubjects)}
                      className="px-6 py-3 border border-zinc-800/60 rounded-xl text-zinc-500 text-xs font-bold uppercase tracking-wider hover:border-zinc-600 hover:text-zinc-300 transition-all duration-300 bg-zinc-950/50 backdrop-blur-sm"
                    >
                      {showAllSubjects ? (
                        <span className="flex items-center gap-2">
                          <ChevronDown className="w-4 h-4" />
                          Свернуть
                        </span>
                      ) : (
                        <span className="flex items-center gap-2">
                          Показать все ({displayedSubjects.length})
                          <ChevronRight className="w-4 h-4" />
                        </span>
                      )}
                    </button>
                  </motion.div>
                )}
              </>
            ) : (
              <div className="py-20 text-center border-2 border-dashed border-zinc-800/60 rounded-2xl">
                <Radar className="w-10 h-10 text-zinc-800 mx-auto mb-4" />
                <p className="text-zinc-600 text-sm font-mono uppercase tracking-widest">
                  NO_ACTIVE_MISSIONS_FOR_LVL_{selectedGrade}
                </p>
                <p className="text-zinc-700 text-[10px] mt-2">
                  Миссии ещё не загружены в систему
                </p>
              </div>
            )}
          </motion.section>

          <AdBreak />

          {/* ============================================
              LEADERBOARD
              ============================================ */}
          <motion.section
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="mb-16 sm:mb-24"
          >
            {/* Header */}
            <div className="flex items-center justify-between mb-8">
              <SectionHeader
                icon={<Trophy className="w-6 h-6" />}
                title="Operator_Leaderboard"
                subtitle="Top XP — лучшие когнитивные операторы"
              />
              <div className="hidden sm:block">
                <RadarSVG />
              </div>
            </div>

            {leaderboard.length > 0 ? (
              <>
                {/* Podium: Top 3 */}
                {leaderboard.length >= 3 && (
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.6, delay: 0.2 }}
                    className="grid grid-cols-3 gap-3 sm:gap-4 mb-6"
                  >
                    {/* 2nd place */}
                    <div className="flex flex-col items-center pt-6">
                      <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-xl overflow-hidden border-2 border-zinc-500/30 mb-3 grayscale hover:grayscale-0 transition-all">
                        {leaderboard[1].avatar_url
                          ? <img src={leaderboard[1].avatar_url} alt="" className="w-full h-full object-cover" />
                          : <div className="w-full h-full bg-zinc-900 flex items-center justify-center"><Terminal className="w-6 h-6 text-zinc-600" /></div>
                        }
                      </div>
                      <p className="text-xs font-bold text-zinc-400 text-center truncate w-full">{leaderboard[1].username || 'ANON'}</p>
                      <p className="text-lg font-black text-zinc-400 tabular-nums mt-1">{leaderboard[1].total_score}</p>
                      <p className="text-[8px] text-zinc-600 uppercase tracking-wider">XP</p>
                      {/* Podium block */}
                      <div className="w-full mt-3 bg-gradient-to-t from-zinc-800/40 to-zinc-800/20 rounded-t-lg flex items-end justify-center pb-2" style={{ height: "60px" }}>
                        <span className="text-2xl font-black text-zinc-600/60">2</span>
                      </div>
                    </div>

                    {/* 1st place */}
                    <div className="flex flex-col items-center">
                      <div className="relative">
                        {/* Crown glow */}
                        <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                          <svg viewBox="0 0 30 16" className="w-8 h-5" xmlns="http://www.w3.org/2000/svg">
                            <polygon points="3,14 8,4 15,10 22,4 27,14" fill="none" stroke="#eab308" strokeWidth="1.5" opacity="0.6" />
                          </svg>
                        </div>
                        <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-xl overflow-hidden border-2 border-yellow-500/40 mb-3 grayscale hover:grayscale-0 transition-all shadow-[0_0_20px_rgba(234,179,8,0.15)]">
                          {leaderboard[0].avatar_url
                            ? <img src={leaderboard[0].avatar_url} alt="" className="w-full h-full object-cover" />
                            : <div className="w-full h-full bg-zinc-900 flex items-center justify-center"><Terminal className="w-7 h-7 text-zinc-600" /></div>
                          }
                        </div>
                      </div>
                      <p className="text-sm font-bold text-yellow-300 text-center truncate w-full">{leaderboard[0].username || 'ANON'}</p>
                      <p className="text-xl font-black text-yellow-400 tabular-nums mt-1">{leaderboard[0].total_score}</p>
                      <p className="text-[8px] text-zinc-600 uppercase tracking-wider">XP</p>
                      {/* Tallest podium block */}
                      <div className="w-full mt-3 bg-gradient-to-t from-yellow-900/20 to-yellow-800/10 rounded-t-lg flex items-end justify-center pb-2 border border-yellow-500/10 border-b-0" style={{ height: "80px" }}>
                        <span className="text-3xl font-black text-yellow-500/40">1</span>
                      </div>
                    </div>

                    {/* 3rd place */}
                    <div className="flex flex-col items-center pt-8">
                      <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-xl overflow-hidden border-2 border-orange-700/30 mb-3 grayscale hover:grayscale-0 transition-all">
                        {leaderboard[2].avatar_url
                          ? <img src={leaderboard[2].avatar_url} alt="" className="w-full h-full object-cover" />
                          : <div className="w-full h-full bg-zinc-900 flex items-center justify-center"><Terminal className="w-5 h-5 text-zinc-600" /></div>
                        }
                      </div>
                      <p className="text-xs font-bold text-zinc-400 text-center truncate w-full">{leaderboard[2].username || 'ANON'}</p>
                      <p className="text-lg font-black text-orange-500/80 tabular-nums mt-1">{leaderboard[2].total_score}</p>
                      <p className="text-[8px] text-zinc-600 uppercase tracking-wider">XP</p>
                      {/* Shortest podium block */}
                      <div className="w-full mt-3 bg-gradient-to-t from-orange-900/20 to-orange-800/10 rounded-t-lg flex items-end justify-center pb-2" style={{ height: "45px" }}>
                        <span className="text-2xl font-black text-orange-600/40">3</span>
                      </div>
                    </div>
                  </motion.div>
                )}

                {/* Remaining entries */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
                  {leaderboard.slice(leaderboard.length >= 3 ? 3 : 0).map((entry, index) => (
                    <LeaderboardCard
                      key={entry.user_id}
                      entry={entry}
                      index={index + (leaderboard.length >= 3 ? 3 : 0)}
                    />
                  ))}
                </div>
              </>
            ) : (
              <div className="py-20 text-center border-2 border-dashed border-zinc-800/60 rounded-2xl">
                <Trophy className="w-10 h-10 text-zinc-800 mx-auto mb-4" />
                <p className="text-zinc-600 text-sm font-mono uppercase tracking-widest">
                  NO_OPERATOR_DATA_FOUND
                </p>
              </div>
            )}
          </motion.section>

          {/* ============================================
              FOOTER
              ============================================ */}
          <motion.footer
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            className="border-t border-zinc-900 pt-8 pb-12 text-center"
          >
            <div className="flex items-center justify-center gap-2 mb-4">
              <Activity className="w-3 h-3 text-green-500/60" />
              <span className="text-[9px] text-zinc-700 font-mono uppercase tracking-[0.3em]">
                System_Status: <span className="text-green-500/60">Operational</span>
              </span>
            </div>
            <p className="text-[10px] text-zinc-800 font-mono tracking-wider">
              VPR_CORE v4.5 // SuperVibe_Studio // {new Date().getFullYear()}
            </p>
          </motion.footer>

        </div>
      </main>
    </div>
  );
}

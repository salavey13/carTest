"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import Link from "next/link";
import {
  Globe2,
  Mountain,
  Thermometer,
  Compass,
  Droplets,
  Wind,
  Map,
  TreePine,
  ArrowLeft,
  Eye,
  MousePointerClick,
  Layers,
  Sun,
  Snowflake,
  CloudRain,
  Waves,
  Info,
  ChevronDown,
  ChevronUp,
} from "lucide-react";

/* ═══════════════════════════════════════════════════════════
   SVG COMPONENTS — Rich, animated geographic visualizations
   ═══════════════════════════════════════════════════════════ */

const GlobeSVG = () => (
  <svg viewBox="0 0 300 300" className="w-full h-full" style={{ fontFamily: "sans-serif" }}>
    <defs>
      <radialGradient id="globeGrad" cx="40%" cy="35%" r="60%">
        <stop offset="0%" stopColor="#1a6b4a" />
        <stop offset="60%" stopColor="#0f4a33" />
        <stop offset="100%" stopColor="#0a2e20" />
      </radialGradient>
      <clipPath id="globeClip">
        <circle cx="150" cy="150" r="120" />
      </clipPath>
      <filter id="glow">
        <feGaussianBlur stdDeviation="3" result="coloredBlur" />
        <feMerge>
          <feMergeNode in="coloredBlur" />
          <feMergeNode in="SourceGraphic" />
        </feMerge>
      </filter>
    </defs>

    {/* Outer glow */}
    <circle cx="150" cy="150" r="130" fill="none" stroke="#10b981" strokeWidth="1" opacity="0.3" filter="url(#glow)" />

    {/* Globe body */}
    <circle cx="150" cy="150" r="120" fill="url(#globeGrad)" stroke="#10b981" strokeWidth="2" />

    {/* Continents (simplified shapes) */}
    <g clipPath="url(#globeClip)" opacity="0.6">
      {/* Eurasia */}
      <path d="M 100 80 Q 120 70 160 75 Q 200 80 220 90 Q 230 95 240 100 L 230 110 Q 200 100 180 105 Q 160 100 140 110 Q 120 115 100 105 Z" fill="#22c55e" opacity="0.5" />
      {/* Africa */}
      <path d="M 140 120 Q 155 115 165 125 Q 170 140 165 160 Q 160 175 150 180 Q 140 175 135 160 Q 130 140 135 125 Z" fill="#22c55e" opacity="0.5" />
      {/* South America */}
      <path d="M 80 140 Q 90 130 95 145 Q 100 165 95 185 Q 85 195 75 185 Q 70 170 75 155 Z" fill="#22c55e" opacity="0.5" />
      {/* North America */}
      <path d="M 60 70 Q 80 55 95 65 Q 100 80 95 100 Q 85 110 70 105 Q 55 95 55 80 Z" fill="#22c55e" opacity="0.5" />
      {/* Australia */}
      <ellipse cx="220" cy="175" rx="20" ry="15" fill="#22c55e" opacity="0.5" />
    </g>

    {/* Latitude lines */}
    <g clipPath="url(#globeClip)" opacity="0.25">
      <ellipse cx="150" cy="150" rx="120" ry="120" fill="none" stroke="#6ee7b7" strokeWidth="0.5" /> {/* equator */}
      <ellipse cx="150" cy="110" rx="108" ry="108" fill="none" stroke="#6ee7b7" strokeWidth="0.5" />
      <ellipse cx="150" cy="190" rx="108" ry="108" fill="none" stroke="#6ee7b7" strokeWidth="0.5" />
      <ellipse cx="150" cy="70" rx="80" ry="80" fill="none" stroke="#6ee7b7" strokeWidth="0.5" />
      <ellipse cx="150" cy="230" rx="80" ry="80" fill="none" stroke="#6ee7b7" strokeWidth="0.5" />
    </g>

    {/* Longitude lines */}
    <g clipPath="url(#globeClip)" opacity="0.2">
      <ellipse cx="150" cy="150" rx="60" ry="120" fill="none" stroke="#6ee7b7" strokeWidth="0.5" />
      <ellipse cx="150" cy="150" rx="110" ry="120" fill="none" stroke="#6ee7b7" strokeWidth="0.5" />
      <line x1="150" y1="30" x2="150" y2="270" stroke="#6ee7b7" strokeWidth="0.5" />
    </g>

    {/* Equator highlight */}
    <ellipse cx="150" cy="150" rx="120" ry="4" fill="none" stroke="#fbbf24" strokeWidth="1.5" opacity="0.6" filter="url(#glow)" />

    {/* Labels */}
    <text x="155" y="148" fill="#fbbf24" fontSize="8" fontWeight="bold" opacity="0.8">0°</text>
    <text x="248" y="95" fill="#6ee7b7" fontSize="7" opacity="0.6">60°N</text>
    <text x="248" y="210" fill="#6ee7b7" fontSize="7" opacity="0.6">60°S</text>
    <text x="150" y="22" fill="#94a3b8" fontSize="9" textAnchor="middle" fontWeight="bold">С</text>
    <text x="150" y="285" fill="#94a3b8" fontSize="9" textAnchor="middle" fontWeight="bold">Ю</text>

    {/* Animated pulse on equator */}
    <circle cx="150" cy="150" r="4" fill="#fbbf24" opacity="0.8">
      <animate attributeName="r" values="3;6;3" dur="2s" repeatCount="indefinite" />
      <animate attributeName="opacity" values="0.8;0.3;0.8" dur="2s" repeatCount="indefinite" />
    </circle>
  </svg>
);

const EarthLayersSVG = ({ activeLayer, setActiveLayer }: { activeLayer: number | null; setActiveLayer: (n: number | null) => void }) => {
  const layers = [
    { r: 120, color: "#92400e", label: "Земная кора", depth: "0-70 км", temp: "до 800°C", idx: 0 },
    { r: 100, color: "#b45309", label: "Мантия", depth: "70-2900 км", temp: "до 3700°C", idx: 1 },
    { r: 70, color: "#dc2626", label: "Внешнее ядро", depth: "2900-5100 км", temp: "до 4500°C", idx: 2 },
    { r: 40, color: "#fbbf24", label: "Внутреннее ядро", depth: "5100-6371 км", temp: "до 6000°C", idx: 3 },
  ];

  return (
    <svg viewBox="0 0 320 320" className="w-full h-full cursor-pointer" style={{ fontFamily: "sans-serif" }}>
      <defs>
        <radialGradient id="coreGrad" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#fef08a" />
          <stop offset="100%" stopColor="#f59e0b" />
        </radialGradient>
        <filter id="layerGlow">
          <feGaussianBlur stdDeviation="4" result="blur" />
          <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
      </defs>

      {layers.map((layer) => (
        <g key={layer.idx} onMouseEnter={() => setActiveLayer(layer.idx)} onMouseLeave={() => setActiveLayer(null)}>
          <circle cx="160" cy="160" r={layer.r} fill={layer.color} opacity={activeLayer === null || activeLayer === layer.idx ? 0.7 : 0.2} stroke={activeLayer === layer.idx ? "#fff" : "none"} strokeWidth="2" style={{ transition: "all 0.3s ease" }} />
        </g>
      ))}

      {/* Inner core special */}
      <circle cx="160" cy="160" r="40" fill="url(#coreGrad)" opacity={activeLayer === null || activeLayer === 3 ? 1 : 0.3} style={{ transition: "opacity 0.3s" }} />

      {/* Active layer info */}
      {activeLayer !== null && (
        <g>
          <rect x="10" y="10" width="140" height="60" rx="8" fill="rgba(0,0,0,0.8)" stroke="#10b981" strokeWidth="1" />
          <text x="20" y="30" fill="#fff" fontSize="11" fontWeight="bold">{layers[activeLayer].label}</text>
          <text x="20" y="45" fill="#6ee7b7" fontSize="9">{layers[activeLayer].depth}</text>
          <text x="20" y="60" fill="#fca5a5" fontSize="9">{layers[activeLayer].temp}</text>
        </g>
      )}

      {activeLayer === null && (
        <text x="160" y="300" fill="#94a3b8" fontSize="10" textAnchor="middle" opacity="0.6">Наведи на слой — увидишь детали</text>
      )}
    </svg>
  );
};

const ClimateZonesSVG = () => (
  <svg viewBox="0 0 700 200" className="w-full h-full" style={{ fontFamily: "sans-serif" }}>
    <defs>
      <linearGradient id="tropical" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#dc2626" />
        <stop offset="100%" stopColor="#ef4444" />
      </linearGradient>
      <linearGradient id="subtropical" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#f97316" />
        <stop offset="100%" stopColor="#fb923c" />
      </linearGradient>
      <linearGradient id="temperate" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#22c55e" />
        <stop offset="100%" stopColor="#4ade80" />
      </linearGradient>
      <linearGradient id="subarctic" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#3b82f6" />
        <stop offset="100%" stopColor="#60a5fa" />
      </linearGradient>
      <linearGradient id="arctic" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#a5b4fc" />
        <stop offset="100%" stopColor="#c7d2fe" />
      </linearGradient>
    </defs>

    <rect width="700" height="200" fill="#0a1a14" rx="12" />

    {/* Temperature bar */}
    <rect x="20" y="130" width="660" height="30" rx="6" fill="#1a2e24" />

    {/* Zone blocks - mirror layout for north/south */}
    {[
      { x: 20, w: 90, label: "Арктический", grad: "url(#arctic)", temp: "до -40°C", icon: "❄️" },
      { x: 115, w: 120, label: "Субарктический", grad: "url(#subarctic)", temp: "до -20°C", icon: "🧊" },
      { x: 240, w: 140, label: "Умеренный", grad: "url(#temperate)", temp: "0-25°C", icon: "🌿" },
      { x: 385, w: 120, label: "Субтропический", grad: "url(#subtropical)", temp: "15-35°C", icon: "☀️" },
      { x: 510, w: 170, label: "Тропический", grad: "url(#tropical)", temp: "25-35°C", icon: "🌴" },
    ].map((zone, i) => (
      <g key={i}>
        {/* North */}
        <rect x={zone.x} y={20} width={zone.w} height={50} rx="6" fill={zone.grad} opacity="0.8" />
        <text x={zone.x + zone.w / 2} y={42} fill="#fff" fontSize="9" fontWeight="bold" textAnchor="middle">{zone.icon}</text>
        <text x={zone.x + zone.w / 2} y={58} fill="rgba(255,255,255,0.8)" fontSize="8" textAnchor="middle">{zone.label}</text>
        {/* South (mirror) */}
        <rect x={zone.x} y={75} width={zone.w} height={30} rx="4" fill={zone.grad} opacity="0.4" />

        {/* Temperature bar fill */}
        <rect x={zone.x} y={133} width={zone.w} height={24} rx="4" fill={zone.grad} opacity="0.7" />
        <text x={zone.x + zone.w / 2} y={150} fill="#fff" fontSize="8" fontWeight="bold" textAnchor="middle">{zone.temp}</text>
      </g>
    ))}

    {/* Equator line */}
    <line x1="20" y1="170" x2="680" y2="170" stroke="#fbbf24" strokeWidth="2" strokeDasharray="6 3" />
    <text x="350" y="185" fill="#fbbf24" fontSize="10" textAnchor="middle" fontWeight="bold">ЭКВАТОР (0°)</text>

    {/* Labels */}
    <text x="350" y="12" fill="#94a3b8" fontSize="8" textAnchor="middle">СЕВЕРНОЕ ПОЛУШАРИЕ</text>
  </svg>
);

const WaterCycleSVG = () => (
  <svg viewBox="0 0 600 280" className="w-full h-full" style={{ fontFamily: "sans-serif" }}>
    <defs>
      <linearGradient id="skyGrad" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#0c1e2e" />
        <stop offset="100%" stopColor="#0a1a14" />
      </linearGradient>
      <linearGradient id="waterGrad" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#0ea5e9" />
        <stop offset="100%" stopColor="#0369a1" />
      </linearGradient>
      <marker id="arrowGreen2" markerWidth="8" markerHeight="8" refX="7" refY="3" orient="auto">
        <path d="M0,0 L0,6 L7,3 z" fill="#22c55e" />
      </marker>
      <marker id="arrowCyan" markerWidth="8" markerHeight="8" refX="7" refY="3" orient="auto">
        <path d="M0,0 L0,6 L7,3 z" fill="#22d3ee" />
      </marker>
      <marker id="arrowBlue" markerWidth="8" markerHeight="8" refX="7" refY="3" orient="auto">
        <path d="M0,0 L0,6 L7,3 z" fill="#3b82f6" />
      </marker>
    </defs>

    <rect width="600" height="280" fill="url(#skyGrad)" rx="12" />

    {/* Sun */}
    <circle cx="520" cy="50" r="25" fill="#fbbf24" opacity="0.3" />
    <circle cx="520" cy="50" r="15" fill="#fbbf24" opacity="0.8">
      <animate attributeName="r" values="15;17;15" dur="3s" repeatCount="indefinite" />
    </circle>

    {/* Mountain */}
    <polygon points="80,220 160,100 240,220" fill="#1a3a2a" stroke="#22c55e" strokeWidth="1" opacity="0.6" />
    <polygon points="160,100 165,95 155,95" fill="#e2e8f0" opacity="0.5" /> {/* snow cap */}

    {/* Ocean */}
    <rect x="280" y="200" width="280" height="60" fill="url(#waterGrad)" opacity="0.4" rx="0 0 12 12" />
    <path d="M 280 200 Q 310 195 340 200 Q 370 205 400 200 Q 430 195 460 200 Q 490 205 520 200 Q 540 195 560 200" fill="none" stroke="#22d3ee" strokeWidth="2" opacity="0.6">
      <animate attributeName="d" values="M 280 200 Q 310 195 340 200 Q 370 205 400 200 Q 430 195 460 200 Q 490 205 520 200 Q 540 195 560 200;M 280 200 Q 310 205 340 200 Q 370 195 400 200 Q 430 205 460 200 Q 490 195 520 200 Q 540 205 560 200;M 280 200 Q 310 195 340 200 Q 370 205 400 200 Q 430 195 460 200 Q 490 205 520 200 Q 540 195 560 200" dur="4s" repeatCount="indefinite" />
    </path>

    {/* Cloud */}
    <g opacity="0.7">
      <ellipse cx="200" cy="55" rx="40" ry="20" fill="#475569" />
      <ellipse cx="230" cy="50" rx="35" ry="22" fill="#64748b" />
      <ellipse cx="180" cy="50" rx="30" ry="18" fill="#64748b" />
    </g>

    {/* Rain drops */}
    {[190, 210, 225, 240].map((x, i) => (
      <line key={i} x1={x} y1={75} x2={x - 3} y2={95} stroke="#60a5fa" strokeWidth="1.5" opacity="0.6">
        <animate attributeName="y1" values="75;95;75" dur={`${1 + i * 0.3}s`} repeatCount="indefinite" />
        <animate attributeName="y2" values="95;115;95" dur={`${1 + i * 0.3}s`} repeatCount="indefinite" />
      </line>
    ))}

    {/* Evaporation arrows */}
    <path d="M 380 190 Q 375 150 360 110" fill="none" stroke="#22d3ee" strokeWidth="2" markerEnd="url(#arrowCyan)" strokeDasharray="4 3" />
    <path d="M 440 190 Q 445 150 460 110" fill="none" stroke="#22d3ee" strokeWidth="2" markerEnd="url(#arrowCyan)" strokeDasharray="4 3" />

    {/* Condensation arrow to cloud */}
    <path d="M 360 110 Q 300 70 240 60" fill="none" stroke="#94a3b8" strokeWidth="1.5" strokeDasharray="3 3" />

    {/* Runoff arrow */}
    <path d="M 160 220 Q 220 230 280 215" fill="none" stroke="#3b82f6" strokeWidth="2" markerEnd="url(#arrowBlue)" />

    {/* Labels */}
    <text x="395" y="100" fill="#22d3ee" fontSize="9" fontWeight="bold" textAnchor="middle">ИСПАРЕНИЕ</text>
    <text x="195" y="120" fill="#60a5fa" fontSize="9" fontWeight="bold" textAnchor="middle">ОСАДКИ</text>
    <text x="220" y="245" fill="#3b82f6" fontSize="9" fontWeight="bold" textAnchor="middle">СТОК</text>
    <text x="530" y="40" fill="#fbbf24" fontSize="9" fontWeight="bold">СОЛНЦЕ</text>

    {/* Infiltration */}
    <path d="M 130 220 L 130 260" fill="none" stroke="#22c55e" strokeWidth="1.5" strokeDasharray="3 2" markerEnd="url(#arrowGreen2)" />
    <text x="115" y="275" fill="#22c55e" fontSize="7">Инфильтрация</text>
  </svg>
);

const CoordinateSVG = () => (
  <svg viewBox="0 0 400 240" className="w-full h-full" style={{ fontFamily: "sans-serif" }}>
    <rect width="400" height="240" fill="#0a1a14" rx="10" />

    {/* Grid */}
    <g opacity="0.15">
      {[40, 80, 120, 160, 200, 240, 280, 320, 360].map((x) => (
        <line key={x} x1={x} y1="10" x2={x} y2="230" stroke="#6ee7b7" strokeWidth="0.5" />
      ))}
      {[20, 50, 80, 110, 140, 170, 200, 230].map((y) => (
        <line key={y} x1="10" y1={y} x2="390" y2={y} stroke="#6ee7b7" strokeWidth="0.5" />
      ))}
    </g>

    {/* Equator */}
    <line x1="10" y1="120" x2="390" y2="120" stroke="#fbbf24" strokeWidth="1.5" opacity="0.6" />
    <text x="392" y="124" fill="#fbbf24" fontSize="8">0°</text>

    {/* Prime Meridian */}
    <line x1="200" y1="10" x2="200" y2="230" stroke="#f472b6" strokeWidth="1.5" opacity="0.6" />
    <text x="195" y="8" fill="#f472b6" fontSize="8">0°</text>

    {/* Latitude label */}
    <text x="20" y="20" fill="#6ee7b7" fontSize="9" fontWeight="bold">ШИРОТА</text>
    <text x="20" y="32" fill="#94a3b8" fontSize="7">(север-юг)</text>

    {/* Longitude label */}
    <text x="320" y="225" fill="#f472b6" fontSize="9" fontWeight="bold">ДОЛГОТА</text>
    <text x="320" y="237" fill="#94a3b8" fontSize="7">(запад-восток)</text>

    {/* Moscow point */}
    <circle cx="240" cy="75" r="5" fill="#ef4444" stroke="#fff" strokeWidth="1">
      <animate attributeName="r" values="4;6;4" dur="2s" repeatCount="indefinite" />
    </circle>
    <line x1="240" y1="75" x2="240" y2="120" stroke="#ef4444" strokeWidth="1" strokeDasharray="3 2" opacity="0.5" />
    <line x1="240" y1="75" x2="200" y2="75" stroke="#ef4444" strokeWidth="1" strokeDasharray="3 2" opacity="0.5" />

    <rect x="248" y="60" width="120" height="30" rx="4" fill="rgba(239,68,68,0.15)" stroke="#ef4444" strokeWidth="1" />
    <text x="308" y="73" fill="#fff" fontSize="8" fontWeight="bold" textAnchor="middle">Москва</text>
    <text x="308" y="84" fill="#fca5a5" fontSize="7" textAnchor="middle">56°N  37°E</text>

    {/* Direction labels */}
    <text x="200" y="18" fill="#94a3b8" fontSize="8" textAnchor="middle">СЕВЕР (+)</text>
    <text x="200" y="238" fill="#94a3b8" fontSize="8" textAnchor="middle">ЮГ (-)</text>
    <text x="15" y="124" fill="#94a3b8" fontSize="8">ЗАПАД</text>
    <text x="355" y="124" fill="#94a3b8" fontSize="8">ВОСТОК</text>
  </svg>
);


/* ═══════════════════════════════════════════════════════════
   DATA
   ═══════════════════════════════════════════════════════════ */

const continents = [
  { name: "Евразия", area: 54.6, population: "5.3 млрд", highest: "Эверест 8848м", color: "#22c55e" },
  { name: "Африка", area: 30.3, population: "1.4 млрд", highest: "Килиманджаро 5895м", color: "#f59e0b" },
  { name: "Сев. Америка", area: 24.4, population: "580 млн", highest: "Макинли 6190м", color: "#3b82f6" },
  { name: "Юж. Америка", area: 17.8, population: "430 млн", highest: "Аконкагуа 6962м", color: "#ef4444" },
  { name: "Антарктида", area: 14.1, population: "~1000 (н.-п.)", highest: "Винсон 4892м", color: "#a5b4fc" },
  { name: "Австралия", area: 7.7, population: "43 млн", highest: "Косцюшко 2228м", color: "#f472b6" },
];

const mapTypes = [
  { name: "Физическая", desc: "Рельеф, реки, горы, моря", icon: Mountain, color: "border-emerald-500", textColor: "text-emerald-400" },
  { name: "Политическая", desc: "Страны, границы, столицы", icon: Globe2, color: "border-amber-500", textColor: "text-amber-400" },
  { name: "Тематическая", desc: "Климат, население, ресурсы", icon: Map, color: "border-sky-500", textColor: "text-sky-400" },
];

const atmosphereLayers = [
  { name: "Тропосфера", height: "0-12 км", fact: "Здесь мы живём! Вся погода тут.", color: "#22c55e", pct: 100 },
  { name: "Стратосфера", height: "12-50 км", fact: "Озоновый слой — наш щит от УФ.", color: "#3b82f6", pct: 75 },
  { name: "Мезосфера", height: "50-80 км", fact: "Метеоры сгорают здесь.", color: "#8b5cf6", pct: 50 },
  { name: "Термосфера", height: "80-700 км", fact: "МКС летает тут. Очень жарко!", color: "#f59e0b", pct: 35 },
  { name: "Экзосфера", height: "700+ км", fact: "Переход в космос. Почти вакуум.", color: "#94a3b8", pct: 20 },
];

const oceanFacts = [
  { name: "Тихий", area: "165.3 млн км²", depth: "10 994 м (Марианская впадина)", color: "#0ea5e9" },
  { name: "Атлантический", area: "91.7 млн км²", depth: "8 742 м", color: "#3b82f6" },
  { name: "Индийский", area: "73.6 млн км²", depth: "7 258 м", color: "#6366f1" },
  { name: "Северный Ледовитый", area: "14.8 млн км²", depth: "5 527 м", color: "#a5b4fc" },
];


/* ═══════════════════════════════════════════════════════════
   MAIN PAGE COMPONENT
   ═══════════════════════════════════════════════════════════ */

export default function Geography7Cheatsheet() {
  const [activeEarthLayer, setActiveEarthLayer] = useState<number | null>(null);
  const [expandedOcean, setExpandedOcean] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<"maps" | "coords">("maps");

  return (
    <div className="min-h-screen bg-[#070f0b] text-emerald-50 p-4 md:p-8 font-sans relative overflow-x-hidden selection:bg-emerald-500/30">
      {/* Topographic background */}
      <div
        className="absolute inset-0 z-0 opacity-[0.04] pointer-events-none"
        style={{
          backgroundImage: `
            radial-gradient(circle at 20% 50%, #10b981 1px, transparent 1px),
            radial-gradient(circle at 80% 20%, #10b981 1px, transparent 1px),
            linear-gradient(to right, #064e3b 1px, transparent 1px),
            linear-gradient(to bottom, #064e3b 1px, transparent 1px)
          `,
          backgroundSize: "40px 40px, 60px 60px, 80px 80px, 80px 80px",
        }}
      />

      {/* Glow orbs */}
      <div className="absolute top-[-200px] left-[-100px] w-[700px] h-[700px] bg-emerald-700/8 blur-[200px] rounded-full pointer-events-none" />
      <div className="absolute bottom-[-300px] right-[-200px] w-[600px] h-[600px] bg-teal-700/6 blur-[180px] rounded-full pointer-events-none" />

      <div className="max-w-6xl mx-auto relative z-10">

        {/* ════════ HEADER ════════ */}
        <motion.header
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7 }}
          className="mb-16 relative"
        >
          <div className="flex flex-col md:flex-row items-center gap-8">
            <div className="w-48 h-48 md:w-56 md:h-56 flex-shrink-0">
              <GlobeSVG />
            </div>
            <div className="text-center md:text-left flex-1">
              <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-emerald-900/30 border border-emerald-500/40 text-emerald-300 text-xs mb-4 uppercase tracking-[0.2em] font-bold">
                <Compass className="w-3.5 h-3.5" /> Expedition_Initiated
              </div>
              <h1 className="text-5xl md:text-7xl font-black tracking-tighter mb-3">
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-300 via-teal-200 to-green-400">
                  TERRA
                </span>{" "}
                <span className="text-white">EXPLORER</span>
              </h1>
              <p className="text-emerald-400/70 text-lg md:text-xl">
                7 класс // Литосфера, Гидросфера, Атмосфера, Географическая карта
              </p>
              <div className="flex items-center gap-4 mt-4 justify-center md:justify-start text-xs text-emerald-500/60">
                <span className="flex items-center gap-1"><MousePointerClick className="w-3 h-3" /> Интерактивно</span>
                <span className="flex items-center gap-1"><Eye className="w-3 h-3" /> Наведи и узнаешь</span>
              </div>
            </div>
          </div>
        </motion.header>

        {/* ════════ SECTION 1: EARTH STRUCTURE ════════ */}
        <motion.section
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-50px" }}
          transition={{ duration: 0.6 }}
          className="mb-20"
        >
          <div className="flex items-center gap-3 mb-8">
            <div className="p-3 bg-emerald-900/30 rounded-xl border border-emerald-700/40">
              <Layers className="text-amber-400 w-7 h-7" />
            </div>
            <div>
              <h2 className="text-3xl md:text-4xl font-bold text-white">Строение Земли</h2>
              <p className="text-emerald-500/60 text-sm">Что у нас под ногами? Наведи на слои!</p>
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-8 items-center">
            <motion.div
              whileHover={{ scale: 1.02 }}
              className="bg-[#0a1a14] rounded-2xl border border-emerald-800/40 p-4 h-72 md:h-80"
            >
              <EarthLayersSVG activeLayer={activeEarthLayer} setActiveLayer={setActiveEarthLayer} />
            </motion.div>

            <div className="space-y-3">
              {[
                { name: "Земная кора", detail: "Тонкая оболочка. Континентальная (30-70 км), океаническая (5-10 км).", color: "border-l-amber-700", bg: "bg-amber-950/20" },
                { name: "Мантия", detail: "Самый толстый слой (~2900 км). Текучее вещество — магма.", color: "border-l-orange-600", bg: "bg-orange-950/20" },
                { name: "Внешнее ядро", detail: "Жидкое! Из железа и никеля. Создаёт магнитное поле Земли.", color: "border-l-red-500", bg: "bg-red-950/20" },
                { name: "Внутреннее ядро", detail: "Твёрдое! Давление такое огромное, что железо не плавится.", color: "border-l-yellow-400", bg: "bg-yellow-950/20" },
              ].map((item, i) => (
                <motion.div
                  key={i}
                  whileHover={{ x: 4 }}
                  className={`${item.bg} p-4 rounded-lg border-l-4 ${item.color} cursor-pointer transition-all hover:shadow-lg`}
                  onMouseEnter={() => setActiveEarthLayer(i)}
                  onMouseLeave={() => setActiveEarthLayer(null)}
                >
                  <h4 className="font-bold text-white text-sm">{item.name}</h4>
                  <p className="text-xs text-gray-400 mt-1">{item.detail}</p>
                </motion.div>
              ))}
            </div>
          </div>
        </motion.section>

        {/* ════════ SECTION 2: CLIMATE ZONES ════════ */}
        <motion.section
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-50px" }}
          transition={{ duration: 0.6 }}
          className="mb-20"
        >
          <div className="flex items-center gap-3 mb-8">
            <div className="p-3 bg-emerald-900/30 rounded-xl border border-emerald-700/40">
              <Thermometer className="text-red-400 w-7 h-7" />
            </div>
            <div>
              <h2 className="text-3xl md:text-4xl font-bold text-white">Климатические Пояса</h2>
              <p className="text-emerald-500/60 text-sm">От жары до вечной мерзлоты</p>
            </div>
          </div>

          <div className="bg-[#0a1a14] rounded-2xl border border-emerald-800/40 overflow-hidden">
            <ClimateZonesSVG />
          </div>

          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mt-6">
            {[
              { name: "Арктический", desc: "Ледяная пустыня. Полярная ночь.", icon: Snowflake, color: "text-indigo-300", bg: "bg-indigo-950/30", border: "border-indigo-500/30" },
              { name: "Субарктический", desc: "Тундра. Мхи, лишайники, олени.", icon: CloudRain, color: "text-blue-300", bg: "bg-blue-950/30", border: "border-blue-500/30" },
              { name: "Умеренный", desc: "Россия тут! 4 сезона, леса, поля.", icon: TreePine, color: "text-emerald-300", bg: "bg-emerald-950/30", border: "border-emerald-500/30" },
              { name: "Субтропический", desc: "Средиземноморье. Оливки, вино.", icon: Sun, color: "text-orange-300", bg: "bg-orange-950/30", border: "border-orange-500/30" },
              { name: "Тропический", desc: "Вечное лето. Джунгли, саванна.", icon: Sun, color: "text-red-300", bg: "bg-red-950/30", border: "border-red-500/30" },
            ].map((zone, i) => {
              const Icon = zone.icon;
              return (
                <motion.div
                  key={i}
                  whileHover={{ y: -4, scale: 1.03 }}
                  className={`${zone.bg} p-4 rounded-xl border ${zone.border} cursor-pointer transition-shadow hover:shadow-lg`}
                >
                  <Icon className={`w-5 h-5 ${zone.color} mb-2`} />
                  <h4 className={`font-bold text-sm ${zone.color}`}>{zone.name}</h4>
                  <p className="text-[11px] text-gray-500 mt-1 leading-relaxed">{zone.desc}</p>
                </motion.div>
              );
            })}
          </div>
        </motion.section>

        {/* ════════ SECTION 3: MAPS & COORDINATES (TABBED) ════════ */}
        <motion.section
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-50px" }}
          transition={{ duration: 0.6 }}
          className="mb-20"
        >
          <div className="flex items-center gap-3 mb-8">
            <div className="p-3 bg-emerald-900/30 rounded-xl border border-emerald-700/40">
              <Compass className="text-emerald-400 w-7 h-7" />
            </div>
            <div>
              <h2 className="text-3xl md:text-4xl font-bold text-white">Карты и Координаты</h2>
              <p className="text-emerald-500/60 text-sm">Как не заблудиться на планете</p>
            </div>
          </div>

          {/* Tab switcher */}
          <div className="flex gap-2 mb-6">
            <button
              onClick={() => setActiveTab("maps")}
              className={`px-5 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === "maps" ? "bg-emerald-600 text-white shadow-lg shadow-emerald-900/50" : "bg-emerald-950/30 text-emerald-500 hover:bg-emerald-900/30"}`}
            >
              <Map className="w-4 h-4 inline mr-1.5" />Типы Карт
            </button>
            <button
              onClick={() => setActiveTab("coords")}
              className={`px-5 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === "coords" ? "bg-emerald-600 text-white shadow-lg shadow-emerald-900/50" : "bg-emerald-950/30 text-emerald-500 hover:bg-emerald-900/30"}`}
            >
              <Globe2 className="w-4 h-4 inline mr-1.5" />Координаты
            </button>
          </div>

          <AnimatePresence mode="wait">
            {activeTab === "maps" ? (
              <motion.div
                key="maps"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                transition={{ duration: 0.3 }}
              >
                <div className="grid md:grid-cols-3 gap-6">
                  {mapTypes.map((type, i) => {
                    const Icon = type.icon;
                    return (
                      <motion.div
                        key={i}
                        whileHover={{ y: -6 }}
                        className="bg-[#0a1a14] rounded-2xl border border-emerald-800/40 p-6 hover:shadow-2xl hover:shadow-emerald-900/20 transition-all"
                      >
                        <div className={`w-14 h-14 rounded-xl ${type.color} border-2 flex items-center justify-center mb-4 bg-black/30`}>
                          <Icon className={`w-7 h-7 ${type.textColor}`} />
                        </div>
                        <h3 className="font-bold text-white text-lg mb-2">{type.name}</h3>
                        <p className="text-sm text-gray-400">{type.desc}</p>
                        <div className="mt-4 pt-3 border-t border-emerald-900/30">
                          <p className="text-xs text-emerald-500/50">
                            {type.name === "Физическая" && "Масштаб 1:1000000 — в 1 см 10 км"}
                            {type.name === "Политическая" && "Столицы — красные точки ★"}
                            {type.name === "Тематическая" && "Изолинии показывают одинаковые значения"}
                          </p>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>

                {/* Scale explanation */}
                <div className="mt-6 bg-[#0a1a14] p-5 rounded-xl border border-emerald-800/30">
                  <h4 className="font-bold text-white mb-3 flex items-center gap-2">
                    <Info className="w-4 h-4 text-emerald-400" /> Масштаб
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                    <div className="bg-black/20 p-3 rounded-lg border border-emerald-900/30">
                      <div className="text-emerald-400 font-bold font-mono">1:10000</div>
                      <div className="text-gray-400 text-xs">Крупный. 1 см = 100 м</div>
                      <div className="text-gray-500 text-[10px] mt-1">Детали зданий видны</div>
                    </div>
                    <div className="bg-black/20 p-3 rounded-lg border border-emerald-900/30">
                      <div className="text-emerald-400 font-bold font-mono">1:100000</div>
                      <div className="text-gray-400 text-xs">Средний. 1 см = 1 км</div>
                      <div className="text-gray-500 text-[10px] mt-1">Города и дороги</div>
                    </div>
                    <div className="bg-black/20 p-3 rounded-lg border border-emerald-900/30">
                      <div className="text-emerald-400 font-bold font-mono">1:1000000</div>
                      <div className="text-gray-400 text-xs">Мелкий. 1 см = 10 км</div>
                      <div className="text-gray-500 text-[10px] mt-1">Обзор областей</div>
                    </div>
                  </div>
                </div>
              </motion.div>
            ) : (
              <motion.div
                key="coords"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.3 }}
              >
                <div className="grid md:grid-cols-2 gap-8 items-center">
                  <div className="bg-[#0a1a14] rounded-2xl border border-emerald-800/40 overflow-hidden h-64">
                    <CoordinateSVG />
                  </div>
                  <div className="space-y-4">
                    <div className="bg-[#0a1a14] p-5 rounded-xl border border-pink-500/20">
                      <h4 className="font-bold text-pink-400 mb-2">Долгота (λ)</h4>
                      <p className="text-sm text-gray-300">От Гринвича (0°) на запад или восток (до 180°).</p>
                      <div className="mt-2 flex gap-2 text-xs">
                        <span className="bg-pink-900/30 text-pink-300 px-2 py-1 rounded">W (запад)</span>
                        <span className="bg-pink-900/30 text-pink-300 px-2 py-1 rounded">E (восток)</span>
                      </div>
                    </div>
                    <div className="bg-[#0a1a14] p-5 rounded-xl border border-yellow-500/20">
                      <h4 className="font-bold text-yellow-400 mb-2">Широта (φ)</h4>
                      <p className="text-sm text-gray-300">От экватора (0°) к полюсам (до 90°).</p>
                      <div className="mt-2 flex gap-2 text-xs">
                        <span className="bg-yellow-900/30 text-yellow-300 px-2 py-1 rounded">N (север)</span>
                        <span className="bg-yellow-900/30 text-yellow-300 px-2 py-1 rounded">S (юг)</span>
                      </div>
                    </div>
                    <div className="bg-emerald-950/30 p-4 rounded-lg border border-emerald-700/30">
                      <p className="text-xs text-emerald-300">
                        <strong>Лайфхак:</strong> Широта — горизонтальные линии (как ступеньки лестницы), долгота — вертикальные (как столбы забора). Сначала широта, потом долгота!
                      </p>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.section>

        {/* ════════ SECTION 4: CONTINENTS ════════ */}
        <motion.section
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-50px" }}
          transition={{ duration: 0.6 }}
          className="mb-20"
        >
          <div className="flex items-center gap-3 mb-8">
            <div className="p-3 bg-emerald-900/30 rounded-xl border border-emerald-700/40">
              <Mountain className="text-emerald-300 w-7 h-7" />
            </div>
            <div>
              <h2 className="text-3xl md:text-4xl font-bold text-white">Материки</h2>
              <p className="text-emerald-500/60 text-sm">6 кусков суши — главные факты</p>
            </div>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {continents.map((c, i) => (
              <motion.div
                key={i}
                whileHover={{ y: -5, scale: 1.02 }}
                className="bg-[#0a1a14] rounded-xl border border-emerald-800/40 p-5 hover:shadow-xl hover:shadow-emerald-900/10 transition-all group"
              >
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-bold text-white text-lg group-hover:text-emerald-300 transition-colors">{c.name}</h3>
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: c.color }} />
                </div>

                {/* Area bar */}
                <div className="mb-3">
                  <div className="flex justify-between text-xs text-gray-500 mb-1">
                    <span>Площадь</span>
                    <span>{c.area} млн км²</span>
                  </div>
                  <div className="h-2 bg-emerald-950/50 rounded-full overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      whileInView={{ width: `${(c.area / 55) * 100}%` }}
                      viewport={{ once: true }}
                      transition={{ duration: 1, delay: i * 0.1 }}
                      className="h-full rounded-full"
                      style={{ backgroundColor: c.color }}
                    />
                  </div>
                </div>

                <div className="space-y-1 text-xs">
                  <div className="flex justify-between">
                    <span className="text-gray-500">Население</span>
                    <span className="text-gray-300">{c.population}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Высшая точка</span>
                    <span className="text-gray-300">{c.highest}</span>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </motion.section>

        {/* ════════ SECTION 5: OCEANS ════════ */}
        <motion.section
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-50px" }}
          transition={{ duration: 0.6 }}
          className="mb-20"
        >
          <div className="flex items-center gap-3 mb-8">
            <div className="p-3 bg-emerald-900/30 rounded-xl border border-emerald-700/40">
              <Waves className="text-sky-400 w-7 h-7" />
            </div>
            <div>
              <h2 className="text-3xl md:text-4xl font-bold text-white">Океаны</h2>
              <p className="text-emerald-500/60 text-sm">70% планеты — вода. Кликни для деталей!</p>
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            {oceanFacts.map((ocean, i) => (
              <motion.div
                key={i}
                layout
                onClick={() => setExpandedOcean(expandedOcean === i ? null : i)}
                className="bg-[#0a1a14] rounded-xl border border-sky-800/30 p-5 cursor-pointer hover:border-sky-600/50 transition-all"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${ocean.color}20` }}>
                      <Droplets className="w-5 h-5" style={{ color: ocean.color }} />
                    </div>
                    <div>
                      <h3 className="font-bold text-white">{ocean.name} океан</h3>
                      <p className="text-xs text-gray-500">{ocean.area}</p>
                    </div>
                  </div>
                  {expandedOcean === i ? (
                    <ChevronUp className="w-4 h-4 text-gray-500" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-gray-500" />
                  )}
                </div>

                <AnimatePresence>
                  {expandedOcean === i && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      className="overflow-hidden"
                    >
                      <div className="mt-4 pt-3 border-t border-sky-900/30 space-y-2">
                        <div className="flex items-start gap-2">
                          <span className="text-xs text-sky-400 font-bold min-w-[70px]">Глубина:</span>
                          <span className="text-xs text-gray-300">{ocean.depth}</span>
                        </div>
                        <div className="flex items-start gap-2">
                          <span className="text-xs text-sky-400 font-bold min-w-[70px]">Факт:</span>
                          <span className="text-xs text-gray-300">
                            {i === 0 && "Самый большой и глубокий. В нём больше воды, чем во всех остальных вместе взятых!"}
                            {i === 1 && "Второй по величине. Через него проходил знаменитый маршрут Колумба."}
                            {i === 2 && "Самый тёплый океан. Муссонные ветра меняют направление по сезонам."}
                            {i === 3 && "Самый маленький и мелкий. Почти полностью покрыт льдом."}
                          </span>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            ))}
          </div>
        </motion.section>

        {/* ════════ SECTION 6: WATER CYCLE ════════ */}
        <motion.section
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-50px" }}
          transition={{ duration: 0.6 }}
          className="mb-20"
        >
          <div className="flex items-center gap-3 mb-8">
            <div className="p-3 bg-emerald-900/30 rounded-xl border border-emerald-700/40">
              <Droplets className="text-sky-300 w-7 h-7" />
            </div>
            <div>
              <h2 className="text-3xl md:text-4xl font-bold text-white">Круговорот Воды</h2>
              <p className="text-emerald-500/60 text-sm">Вода никогда не исчезает — она путешествует</p>
            </div>
          </div>

          <div className="bg-[#0a1a14] rounded-2xl border border-emerald-800/40 overflow-hidden h-64 md:h-72">
            <WaterCycleSVG />
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-6">
            {[
              { name: "Испарение", desc: "Солнце греет воду → пар поднимается", icon: Sun, color: "text-yellow-400", bg: "bg-yellow-950/20" },
              { name: "Конденсация", desc: "Пар остывает → облака", icon: CloudRain, color: "text-gray-300", bg: "bg-gray-900/30" },
              { name: "Осадки", desc: "Облака тяжелеют → дождь/снег", icon: Droplets, color: "text-blue-400", bg: "bg-blue-950/20" },
              { name: "Сток", desc: "Вода возвращается в океан по рекам", icon: Waves, color: "text-cyan-400", bg: "bg-cyan-950/20" },
            ].map((step, i) => {
              const Icon = step.icon;
              return (
                <motion.div
                  key={i}
                  whileHover={{ y: -3 }}
                  className={`${step.bg} p-4 rounded-xl border border-emerald-800/20 text-center`}
                >
                  <Icon className={`w-6 h-6 ${step.color} mx-auto mb-2`} />
                  <h4 className="font-bold text-white text-sm">{step.name}</h4>
                  <p className="text-[10px] text-gray-500 mt-1">{step.desc}</p>
                </motion.div>
              );
            })}
          </div>
        </motion.section>

        {/* ════════ SECTION 7: ATMOSPHERE ════════ */}
        <motion.section
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-50px" }}
          transition={{ duration: 0.6 }}
          className="mb-20"
        >
          <div className="flex items-center gap-3 mb-8">
            <div className="p-3 bg-emerald-900/30 rounded-xl border border-emerald-700/40">
              <Wind className="text-teal-400 w-7 h-7" />
            </div>
            <div>
              <h2 className="text-3xl md:text-4xl font-bold text-white">Слои Атмосферы</h2>
              <p className="text-emerald-500/60 text-sm">Воздух вокруг нас — не просто воздух</p>
            </div>
          </div>

          <div className="max-w-2xl mx-auto">
            <div className="space-y-2">
              {atmosphereLayers.map((layer, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: -30 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.1, duration: 0.4 }}
                  whileHover={{ x: 8 }}
                  className="bg-[#0a1a14] rounded-lg border border-emerald-800/20 overflow-hidden cursor-pointer group"
                >
                  <div className="flex items-center gap-4 p-4">
                    {/* Height bar */}
                    <div className="flex flex-col items-center min-w-[70px]">
                      <span className="text-[10px] text-gray-500">Высота</span>
                      <span className="text-xs font-mono font-bold text-white">{layer.height}</span>
                    </div>
                    {/* Color bar */}
                    <div className="h-10 rounded-lg flex items-center px-4 flex-1 transition-all" style={{ backgroundColor: `${layer.color}15`, borderLeft: `3px solid ${layer.color}` }}>
                      <div>
                        <h4 className="font-bold text-sm" style={{ color: layer.color }}>{layer.name}</h4>
                        <p className="text-[10px] text-gray-400 group-hover:text-gray-300 transition-colors">{layer.fact}</p>
                      </div>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>

            {/* Key atmosphere fact */}
            <div className="mt-6 bg-emerald-950/20 p-4 rounded-xl border border-emerald-700/30">
              <p className="text-xs text-emerald-300">
                <strong>Запомни:</strong> Атмосферное давление на уровне моря = 760 мм рт. ст. С высотой давление падает! На вершине Эвереста оно в 3 раза меньше.
              </p>
            </div>
          </div>
        </motion.section>

        {/* ════════ SECTION 8: KEY FORMULAS & FACTS ════════ */}
        <motion.section
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-50px" }}
          transition={{ duration: 0.6 }}
          className="mb-16"
        >
          <div className="flex items-center gap-3 mb-8">
            <div className="p-3 bg-emerald-900/30 rounded-xl border border-emerald-700/40">
              <Info className="text-yellow-400 w-7 h-7" />
            </div>
            <div>
              <h2 className="text-3xl md:text-4xl font-bold text-white">Формулы и Факты</h2>
              <p className="text-emerald-500/60 text-sm">Шпаргалка в шпаргалке — мета-уровень</p>
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            {/* Formulas */}
            <div className="bg-[#0a1a14] p-6 rounded-2xl border border-emerald-800/30">
              <h3 className="font-bold text-white mb-4 flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-emerald-400" />Формулы
              </h3>
              <div className="space-y-3">
                {[
                  { formula: "L = λ × t", desc: "Длина дуги меридиана", detail: "λ — длина 1° дуги (≈111 км), t — разность широт" },
                  { formula: "h = t × 6°C", desc: "Падение температуры с высотой", detail: "На каждый 1 км вверх → -6°C" },
                  { formula: "P = P₀ - Δh × 1мм", desc: "Давление с высотой", detail: "На каждые 10,5 м вверх → -1 мм рт. ст." },
                  { formula: "Абс. высота = Отн. высота + h подножия", desc: "Абсолютная высота вершины", detail: "От подножия до вершины + высота подножия над уровнем моря" },
                ].map((f, i) => (
                  <div key={i} className="bg-black/30 p-3 rounded-lg border border-emerald-900/20">
                    <div className="font-mono text-emerald-400 font-bold text-lg">{f.formula}</div>
                    <div className="text-sm text-gray-300 mt-1">{f.desc}</div>
                    <div className="text-[10px] text-gray-500 mt-1">{f.detail}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Quick Facts */}
            <div className="bg-[#0a1a14] p-6 rounded-2xl border border-emerald-800/30">
              <h3 className="font-bold text-white mb-4 flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-amber-400" />Быстрые Факты
              </h3>
              <div className="space-y-3">
                {[
                  { label: "Радиус Земли", value: "6 371 км" },
                  { label: "Длина экватора", value: "40 075 км" },
                  { label: "Длина меридиана", value: "20 004 км" },
                  { label: "1° меридиана", value: "≈ 111 км" },
                  { label: "1° экватора", value: "≈ 111,3 км" },
                  { label: "Макс. высота суши", value: "8 848 м (Эверест)" },
                  { label: "Макс. глубина океана", value: "10 994 м (Марианская)" },
                  { label: "Доля воды на Земле", value: "71% поверхности" },
                  { label: "Доля пресной воды", value: "~2.5% от всей воды" },
                ].map((fact, i) => (
                  <div key={i} className="flex justify-between items-center py-2 border-b border-emerald-900/20 last:border-0">
                    <span className="text-sm text-gray-400">{fact.label}</span>
                    <span className="text-sm font-bold text-amber-300">{fact.value}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </motion.section>

        {/* ════════ FOOTER ════════ */}
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          className="flex justify-center pb-8"
        >
          <Link href="/vpr-tests">
            <motion.div
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="group flex items-center gap-3 bg-emerald-700 hover:bg-emerald-600 text-white font-bold py-4 px-10 rounded-full shadow-[0_0_25px_rgba(16,185,129,0.3)] transition-all"
            >
              <ArrowLeft className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
              <span>НАЗАД</span>
            </motion.div>
          </Link>
        </motion.div>
      </div>
    </div>
  );
}

'use client';

import { useState, useMemo, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { motion, AnimatePresence } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import type { PointOfInterest, GeoBounds } from '@/lib/map-utils';
import {
  MapPin, CheckCircle, XCircle, ArrowRight, ArrowLeft, Target, Layers,
  Thermometer, Globe, Mountain, Users, Info, Lightbulb, RotateCcw,
  Compass, Droplets, Wind, Snowflake, Sun, CloudRain, Waves, TreePine,
  BookOpen, Crosshair, Ruler, BarChart3, ChevronDown, ChevronUp, Trophy,
  Timer, Eye
} from 'lucide-react';

import {
  type Question, type QuestionType, type TerrainProfile,
  QUESTIONS, CLIMATE_ZONES, CONTINENTS, OCEANS, EARTH_LAYERS,
  ATMOSPHERE_LAYERS, RIVERS_OF_RUSSIA, QUICK_FACTS, FORMULAS, KEY_GEOGRAPHIC_FEATURES,
} from './questions-data';

/* ═══════════════════════════════════════════════════════════════════════════════════
   RACING MAP — Dynamic import (SSR disabled for Leaflet)
   ═══════════════════════════════════════════════════════════════════════════════════ */

const RacingMap = dynamic(() => import('@/components/maps/RacingMap').then((m) => m.RacingMap), {
  ssr: false,
  loading: () => (
    <div className="h-[450px] bg-emerald-950/20 rounded-xl animate-pulse flex items-center justify-center">
      <span className="text-emerald-500/50 text-sm animate-pulse">Загрузка карты...</span>
    </div>
  ),
});

/* ═══════════════════════════════════════════════════════════════════════════════════
   SVG COMPONENTS — Rich animated geographic visualizations
   ═══════════════════════════════════════════════════════════════════════════════════ */

const GlobeSVG = () => (
  <svg viewBox="0 0 300 300" className="w-full h-full" style={{ fontFamily: 'sans-serif' }}>
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
        <feMerge><feMergeNode in="coloredBlur" /><feMergeNode in="SourceGraphic" /></feMerge>
      </filter>
    </defs>
    <circle cx="150" cy="150" r="130" fill="none" stroke="#10b981" strokeWidth="1" opacity="0.3" filter="url(#glow)" />
    <circle cx="150" cy="150" r="120" fill="url(#globeGrad)" stroke="#10b981" strokeWidth="2" />
    <g clipPath="url(#globeClip)" opacity="0.6">
      <path d="M 100 80 Q 120 70 160 75 Q 200 80 220 90 Q 230 95 240 100 L 230 110 Q 200 100 180 105 Q 160 100 140 110 Q 120 115 100 105 Z" fill="#22c55e" opacity="0.5" />
      <path d="M 140 120 Q 155 115 165 125 Q 170 140 165 160 Q 160 175 150 180 Q 140 175 135 160 Q 130 140 135 125 Z" fill="#22c55e" opacity="0.5" />
      <path d="M 80 140 Q 90 130 95 145 Q 100 165 95 185 Q 85 195 75 185 Q 70 170 75 155 Z" fill="#22c55e" opacity="0.5" />
      <path d="M 60 70 Q 80 55 95 65 Q 100 80 95 100 Q 85 110 70 105 Q 55 95 55 80 Z" fill="#22c55e" opacity="0.5" />
      <ellipse cx="220" cy="175" rx="20" ry="15" fill="#22c55e" opacity="0.5" />
    </g>
    <g clipPath="url(#globeClip)" opacity="0.25">
      <ellipse cx="150" cy="150" rx="120" ry="120" fill="none" stroke="#6ee7b7" strokeWidth="0.5" />
      <ellipse cx="150" cy="110" rx="108" ry="108" fill="none" stroke="#6ee7b7" strokeWidth="0.5" />
      <ellipse cx="150" cy="190" rx="108" ry="108" fill="none" stroke="#6ee7b7" strokeWidth="0.5" />
    </g>
    <g clipPath="url(#globeClip)" opacity="0.2">
      <ellipse cx="150" cy="150" rx="60" ry="120" fill="none" stroke="#6ee7b7" strokeWidth="0.5" />
      <ellipse cx="150" cy="150" rx="110" ry="120" fill="none" stroke="#6ee7b7" strokeWidth="0.5" />
      <line x1="150" y1="30" x2="150" y2="270" stroke="#6ee7b7" strokeWidth="0.5" />
    </g>
    <ellipse cx="150" cy="150" rx="120" ry="4" fill="none" stroke="#fbbf24" strokeWidth="1.5" opacity="0.6" filter="url(#glow)" />
    <text x="155" y="148" fill="#fbbf24" fontSize="8" fontWeight="bold" opacity="0.8">0°</text>
    <text x="248" y="95" fill="#6ee7b7" fontSize="7" opacity="0.6">60°N</text>
    <text x="248" y="210" fill="#6ee7b7" fontSize="7" opacity="0.6">60°S</text>
    <text x="150" y="22" fill="#94a3b8" fontSize="9" textAnchor="middle" fontWeight="bold">С</text>
    <text x="150" y="285" fill="#94a3b8" fontSize="9" textAnchor="middle" fontWeight="bold">Ю</text>
    <circle cx="150" cy="150" r="4" fill="#fbbf24" opacity="0.8">
      <animate attributeName="r" values="3;6;3" dur="2s" repeatCount="indefinite" />
      <animate attributeName="opacity" values="0.8;0.3;0.8" dur="2s" repeatCount="indefinite" />
    </circle>
  </svg>
);

const WaterCycleSVG = () => (
  <svg viewBox="0 0 600 280" className="w-full h-full" style={{ fontFamily: 'sans-serif' }}>
    <defs>
      <linearGradient id="skyGrad2" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#0c1e2e" />
        <stop offset="100%" stopColor="#0a1a14" />
      </linearGradient>
      <linearGradient id="waterGrad2" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#0ea5e9" />
        <stop offset="100%" stopColor="#0369a1" />
      </linearGradient>
      <marker id="arrowCyan2" markerWidth="8" markerHeight="8" refX="7" refY="3" orient="auto">
        <path d="M0,0 L0,6 L7,3 z" fill="#22d3ee" />
      </marker>
      <marker id="arrowBlue2" markerWidth="8" markerHeight="8" refX="7" refY="3" orient="auto">
        <path d="M0,0 L0,6 L7,3 z" fill="#3b82f6" />
      </marker>
      <marker id="arrowGreen2b" markerWidth="8" markerHeight="8" refX="7" refY="3" orient="auto">
        <path d="M0,0 L0,6 L7,3 z" fill="#22c55e" />
      </marker>
    </defs>
    <rect width="600" height="280" fill="url(#skyGrad2)" rx="12" />
    <circle cx="520" cy="50" r="25" fill="#fbbf24" opacity="0.3" />
    <circle cx="520" cy="50" r="15" fill="#fbbf24" opacity="0.8">
      <animate attributeName="r" values="15;17;15" dur="3s" repeatCount="indefinite" />
    </circle>
    <polygon points="80,220 160,100 240,220" fill="#1a3a2a" stroke="#22c55e" strokeWidth="1" opacity="0.6" />
    <polygon points="160,100 165,95 155,95" fill="#e2e8f0" opacity="0.5" />
    <rect x="280" y="200" width="280" height="60" fill="url(#waterGrad2)" opacity="0.4" rx="0 0 12 12" />
    <path d="M 280 200 Q 310 195 340 200 Q 370 205 400 200 Q 430 195 460 200 Q 490 205 520 200 Q 540 195 560 200" fill="none" stroke="#22d3ee" strokeWidth="2" opacity="0.6">
      <animate attributeName="d" values="M 280 200 Q 310 195 340 200 Q 370 205 400 200 Q 430 195 460 200 Q 490 205 520 200 Q 540 195 560 200;M 280 200 Q 310 205 340 200 Q 370 195 400 200 Q 430 205 460 200 Q 490 195 520 200 Q 540 205 560 200;M 280 200 Q 310 195 340 200 Q 370 205 400 200 Q 430 195 460 200 Q 490 205 520 200 Q 540 195 560 200" dur="4s" repeatCount="indefinite" />
    </path>
    <g opacity="0.7">
      <ellipse cx="200" cy="55" rx="40" ry="20" fill="#475569" />
      <ellipse cx="230" cy="50" rx="35" ry="22" fill="#64748b" />
      <ellipse cx="180" cy="50" rx="30" ry="18" fill="#64748b" />
    </g>
    {[190, 210, 225, 240].map((x, i) => (
      <line key={i} x1={x} y1={75} x2={x - 3} y2={95} stroke="#60a5fa" strokeWidth="1.5" opacity="0.6">
        <animate attributeName="y1" values="75;95;75" dur={`${1 + i * 0.3}s`} repeatCount="indefinite" />
        <animate attributeName="y2" values="95;115;95" dur={`${1 + i * 0.3}s`} repeatCount="indefinite" />
      </line>
    ))}
    <path d="M 380 190 Q 375 150 360 110" fill="none" stroke="#22d3ee" strokeWidth="2" markerEnd="url(#arrowCyan2)" strokeDasharray="4 3" />
    <path d="M 440 190 Q 445 150 460 110" fill="none" stroke="#22d3ee" strokeWidth="2" markerEnd="url(#arrowCyan2)" strokeDasharray="4 3" />
    <path d="M 360 110 Q 300 70 240 60" fill="none" stroke="#94a3b8" strokeWidth="1.5" strokeDasharray="3 3" />
    <path d="M 160 220 Q 220 230 280 215" fill="none" stroke="#3b82f6" strokeWidth="2" markerEnd="url(#arrowBlue2)" />
    <text x="395" y="100" fill="#22d3ee" fontSize="9" fontWeight="bold" textAnchor="middle">ИСПАРЕНИЕ</text>
    <text x="195" y="120" fill="#60a5fa" fontSize="9" fontWeight="bold" textAnchor="middle">ОСАДКИ</text>
    <text x="220" y="245" fill="#3b82f6" fontSize="9" fontWeight="bold" textAnchor="middle">СТОК</text>
    <text x="530" y="40" fill="#fbbf24" fontSize="9" fontWeight="bold">СОЛНЦЕ</text>
    <path d="M 130 220 L 130 260" fill="none" stroke="#22c55e" strokeWidth="1.5" strokeDasharray="3 2" markerEnd="url(#arrowGreen2b)" />
    <text x="115" y="275" fill="#22c55e" fontSize="7">Инфильтрация</text>
  </svg>
);

const EarthLayersSVG = ({ activeLayer, setActiveLayer }: { activeLayer: number | null; setActiveLayer: (n: number | null) => void }) => {
  const layers = [
    { r: 120, color: '#92400e', idx: 0 },
    { r: 100, color: '#b45309', idx: 1 },
    { r: 70, color: '#dc2626', idx: 2 },
    { r: 40, color: '#fbbf24', idx: 3 },
  ];
  return (
    <svg viewBox="0 0 320 320" className="w-full h-full cursor-pointer" style={{ fontFamily: 'sans-serif' }}>
      <defs>
        <radialGradient id="coreGrad2" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#fef08a" />
          <stop offset="100%" stopColor="#f59e0b" />
        </radialGradient>
      </defs>
      {layers.map((layer) => (
        <g key={layer.idx} onMouseEnter={() => setActiveLayer(layer.idx)} onMouseLeave={() => setActiveLayer(null)}>
          <circle cx="160" cy="160" r={layer.r} fill={layer.color} opacity={activeLayer === null || activeLayer === layer.idx ? 0.7 : 0.2} stroke={activeLayer === layer.idx ? '#fff' : 'none'} strokeWidth="2" style={{ transition: 'all 0.3s ease' }} />
        </g>
      ))}
      <circle cx="160" cy="160" r="40" fill="url(#coreGrad2)" opacity={activeLayer === null || activeLayer === 3 ? 1 : 0.3} style={{ transition: 'opacity 0.3s' }} />
      {activeLayer !== null && (
        <g>
          <rect x="10" y="10" width="160" height="65" rx="8" fill="rgba(0,0,0,0.85)" stroke="#10b981" strokeWidth="1" />
          <text x="20" y="30" fill="#fff" fontSize="12" fontWeight="bold">{EARTH_LAYERS[activeLayer].name}</text>
          <text x="20" y="46" fill="#6ee7b7" fontSize="9">{EARTH_LAYERS[activeLayer].depth}</text>
          <text x="20" y="62" fill="#fca5a5" fontSize="9">{EARTH_LAYERS[activeLayer].temp}</text>
        </g>
      )}
      {activeLayer === null && (
        <text x="160" y="305" fill="#94a3b8" fontSize="10" textAnchor="middle" opacity="0.6">Наведи на слой — увидишь детали</text>
      )}
    </svg>
  );
};

/* ═══════════════════════════════════════════════════════════════════════════════════
   HELPER COMPONENTS — Reusable UI building blocks
   ═══════════════════════════════════════════════════════════════════════════════════ */

function ClimateGraph({ type }: { type: 'equatorial' | 'tropical' | 'temperate' }) {
  const datasets: Record<string, { temps: number[]; rain: number[] }> = {
    equatorial: { temps: [26, 26, 26, 26, 26, 26, 25, 25, 25, 25, 26, 26], rain: [250, 220, 280, 300, 290, 200, 180, 190, 220, 260, 280, 270] },
    tropical: { temps: [20, 21, 23, 25, 27, 28, 28, 27, 26, 24, 22, 20], rain: [10, 5, 5, 2, 1, 0, 0, 2, 8, 15, 20, 12] },
    temperate: { temps: [-10, -8, 0, 8, 15, 20, 22, 20, 14, 6, -2, -8], rain: [40, 35, 35, 40, 50, 60, 70, 65, 50, 45, 40, 40] },
  };
  const data = datasets[type];
  const maxRain = Math.max(...data.rain);
  const maxTemp = 35;
  const w = 300, h = 170;

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-auto bg-[#0a1a14] rounded-lg border border-emerald-800/30 p-2">
      {[0, 1, 2, 3, 4].map(i => <line key={`gy${i}`} x1="35" y1={20 + i * 30} x2={w - 10} y2={20 + i * 30} stroke="#1e293b" strokeWidth="0.5" />)}
      {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map(i => <line key={`gx${i}`} x1={35 + i * 20} y1="20" x2={35 + i * 20} y2={h - 20} stroke="#1e293b" strokeWidth="0.5" />)}
      {data.rain.map((r, i) => (
        <rect key={`r${i}`} x={37 + i * 20} y={h - 20 - (r / maxRain) * 100} width="16" height={(r / maxRain) * 100} fill="#3b82f6" opacity="0.5" rx="2" />
      ))}
      <polyline
        points={data.temps.map((t, i) => `${35 + i * 20 + 10},${20 + ((maxTemp - t) / maxTemp) * 100}`).join(' ')}
        fill="none" stroke="#ef4444" strokeWidth="2" strokeLinejoin="round"
      />
      {data.temps.map((t, i) => (
        <circle key={`t${i}`} cx={35 + i * 20 + 10} cy={20 + ((maxTemp - t) / maxTemp) * 100} r="3" fill="#ef4444" />
      ))}
      <text x="8" y="14" fill="#94a3b8" fontSize="8">°C / мм</text>
      {['Я', 'Ф', 'М', 'А', 'М', 'И', 'И', 'А', 'С', 'О', 'Н', 'Д'].map((m, i) => (
        <text key={m} x={35 + i * 20 + 10} y={h - 5} fill="#64748b" fontSize="7" textAnchor="middle">{m}</text>
      ))}
      <rect x={w - 100} y={h - 18} width="8" height="8" fill="#ef4444" rx="1" />
      <text x={w - 88} y={h - 10} fill="#94a3b8" fontSize="7">Температура</text>
      <rect x={w - 100} y={h - 9} width="8" height="8" fill="#3b82f6" opacity="0.5" rx="1" />
      <text x={w - 88} y={h - 1} fill="#94a3b8" fontSize="7">Осадки</text>
    </svg>
  );
}

function TerrainProfileSVG({ profile }: { profile: TerrainProfile }) {
  const w = 500, h = 200;
  const pad = { top: 15, right: 15, bottom: 30, left: 45 };
  const plotW = w - pad.left - pad.right;
  const plotH = h - pad.top - pad.bottom;

  const toSvg = (nx: number, ny: number) => [pad.left + (nx / 100) * plotW, pad.top + ((100 - ny) / 100) * plotH] as [number, number];

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-auto bg-[#0a1a14] rounded-lg border border-emerald-800/30 p-1">
      {/* Grid lines */}
      {[0, 25, 50, 75, 100].map(pct => {
        const y = pad.top + ((100 - pct) / 100) * plotH;
        return <line key={`h${pct}`} x1={pad.left} y1={y} x2={w - pad.right} y2={y} stroke="#1e293b" strokeWidth="0.5" />;
      })}
      {[0, 25, 50, 75, 100].map(pct => {
        const x = pad.left + (pct / 100) * plotW;
        return <line key={`v${pct}`} x1={x} y1={pad.top} x2={x} y2={h - pad.bottom} stroke="#1e293b" strokeWidth="0.5" />;
      })}

      {/* Fill under terrain */}
      <polygon
        points={[toSvg(profile.path[0][0], 0), ...profile.path.map(([x, y]) => toSvg(x, y)), toSvg(profile.path[profile.path.length - 1][0], 0)].map(([x, y]) => `${x},${y}`).join(' ')}
        fill="#22c55e" opacity="0.08"
      />

      {/* Terrain line */}
      <polyline
        points={profile.path.map(([x, y]) => toSvg(x, y)).map(([x, y]) => `${x},${y}`).join(' ')}
        fill="none" stroke="#22c55e" strokeWidth="2.5" strokeLinejoin="round"
      />

      {/* Y-axis labels (height) */}
      {profile.yTicks.map((tick, i) => {
        const pct = (tick / profile.yTicks[profile.yTicks.length - 1]) * 100;
        const y = pad.top + ((100 - pct) / 100) * plotH;
        return (
          <text key={tick} x={pad.left - 5} y={y + 3} fill="#6ee7b7" fontSize="8" textAnchor="end">{tick}</text>
        );
      })}

      {/* X-axis labels (distance) */}
      {profile.xTicks.map((tick, i) => {
        const pct = (i / (profile.xTicks.length - 1)) * 100;
        const x = pad.left + (pct / 100) * plotW;
        return (
          <text key={tick} x={x} y={h - 8} fill="#6ee7b7" fontSize="8" textAnchor="middle">{tick}</text>
        );
      })}

      {/* Axis titles */}
      <text x={w / 2} y={h - 1} fill="#94a3b8" fontSize="8" textAnchor="middle">{profile.xLabel}</text>
      <text x="5" y={h / 2} fill="#94a3b8" fontSize="7" textAnchor="middle" transform={`rotate(-90, 5, ${h / 2})`}>{profile.yLabel}</text>

      {/* Feature markers */}
      {profile.features.map((f) => {
        const [x, y] = toSvg(f.x, f.y);
        return (
          <g key={f.letter}>
            <line x1={x} y1={y} x2={x} y2={pad.top} stroke="#fbbf24" strokeWidth="1" strokeDasharray="2 2" opacity="0.5" />
            <circle cx={x} cy={y} r="5" fill="#fbbf24" stroke="#fff" strokeWidth="1.5" />
            <text x={x} y={y - 10} fill="#fbbf24" fontSize="11" fontWeight="bold" textAnchor="middle">{f.letter}</text>
          </g>
        );
      })}
    </svg>
  );
}

function ScaleCalculator({ scaleInfo, onAnswer }: { scaleInfo: Question['scaleInfo']; onAnswer: (km: number) => void }) {
  if (!scaleInfo) return null;
  const [input, setInput] = useState('');
  const [submitted, setSubmitted] = useState<number | null>(null);

  const handleSubmit = () => {
    const val = parseFloat(input.replace(',', '.'));
    if (isNaN(val) || val <= 0) return;
    setSubmitted(val);
    onAnswer(val);
  };

  const isCorrect = submitted !== null && Math.abs(submitted - scaleInfo.correctKm) <= scaleInfo.correctKm * 0.15;

  return (
    <div className="space-y-3 p-4 bg-black/20 rounded-xl border border-emerald-900/30">
      <div className="flex items-center gap-2 mb-2">
        <Ruler className="w-4 h-4 text-emerald-400" />
        <span className="text-sm font-bold text-white">Расчёт расстояния по масштабу</span>
      </div>
      <div className="grid grid-cols-2 gap-2 text-xs">
        <div className="bg-emerald-950/30 p-2 rounded-lg">
          <span className="text-emerald-400 font-bold">Масштаб:</span>{' '}
          <span className="text-gray-300">{scaleInfo.namedScale}</span>
        </div>
        <div className="bg-emerald-950/30 p-2 rounded-lg">
          <span className="text-emerald-400 font-bold">Численный:</span>{' '}
          <span className="text-gray-300 font-mono">1:{(scaleInfo.numericalScale / 1_000_000).toFixed(0)} млн</span>
        </div>
        <div className="bg-emerald-950/30 p-2 rounded-lg">
          <span className="text-emerald-400 font-bold">От:</span>{' '}
          <span className="text-gray-300">{scaleInfo.cityA.name}</span>
        </div>
        <div className="bg-emerald-950/30 p-2 rounded-lg">
          <span className="text-emerald-400 font-bold">До:</span>{' '}
          <span className="text-gray-300">{scaleInfo.cityB.name}</span>
        </div>
      </div>
      <div className="flex gap-2">
        <Input
          type="text"
          placeholder="Введите расстояние (км)"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          disabled={submitted !== null}
          className="bg-black/30 border-emerald-800/40 text-white text-sm"
        />
        <Button size="sm" onClick={handleSubmit} disabled={submitted !== null || !input} className="bg-emerald-700 hover:bg-emerald-600 shrink-0">
          Проверить
        </Button>
      </div>
      {submitted !== null && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
          className={`p-3 rounded-lg border text-sm ${isCorrect ? 'bg-emerald-900/40 border-emerald-500/50 text-emerald-300' : 'bg-red-900/40 border-red-500/50 text-red-300'}`}
        >
          <div className="flex items-center gap-2">
            {isCorrect ? <CheckCircle className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
            <span>{isCorrect ? `Верно! Расстояние ≈ ${scaleInfo.correctKm} км` : `Не совсем. Правильный ответ: ≈ ${scaleInfo.correctKm} км. Ваш ответ: ${submitted} км.`}</span>
          </div>
        </motion.div>
      )}
      <p className="text-[10px] text-gray-500">
        <strong>Формула:</strong> d = d_map (см) × M (км/см). Допуск: ±15%.
      </p>
    </div>
  );
}

function PopulationTable({ tableInfo }: { tableInfo: Question['tableInfo'] }) {
  if (!tableInfo) return null;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs border-collapse">
        <thead>
          <tr className="border-b border-emerald-800/40">
            {tableInfo.headers.map((h, i) => (
              <th key={h} className={`p-2 text-left font-bold ${i === 0 ? 'text-gray-400' : 'text-emerald-400'}`}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {tableInfo.rows.map((row, ri) => (
            <tr key={ri} className="border-b border-emerald-900/20">
              <td className="p-2 text-gray-400">{row.country}</td>
              <td className="p-2 text-white font-mono">{row.area}</td>
              <td className="p-2 text-white font-mono">{row.population}</td>
              <td className="p-2 text-white font-mono">{ri === 0 ? '—' : ''}</td>
              <td className="p-2 text-white font-mono">{ri === 0 ? '—' : ''}</td>
            </tr>
          ))}
          {/* Computed row: density */}
          <tr className="bg-emerald-950/20">
            <td className="p-2 text-amber-400 font-bold">Плотность (чел/км²)</td>
            {tableInfo.rows.map((row, ri) => {
              const density = ri < 2 ? (row.population / row.area).toFixed(1) : '—';
              return (
                <td key={ri} className="p-2 text-amber-300 font-mono font-bold">{density}</td>
              );
            })}
          </tr>
        </tbody>
      </table>
      <p className="text-[10px] text-gray-500 mt-2 italic">{tableInfo.explanation}</p>
    </div>
  );
}

function FeedbackBadge({ status, text }: { status: 'success' | 'error' | 'hint'; text: string }) {
  const styles = {
    success: 'bg-emerald-900/40 border-emerald-500/50 text-emerald-300',
    error: 'bg-red-900/40 border-red-500/50 text-red-300',
    hint: 'bg-amber-900/40 border-amber-500/50 text-amber-300',
  };
  const Icon = status === 'success' ? CheckCircle : status === 'error' ? XCircle : Lightbulb;
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className={`flex items-start gap-2 p-3 rounded-lg border text-sm ${styles[status]}`}>
      <Icon className="w-4 h-4 mt-0.5 flex-shrink-0" />
      <span>{text}</span>
    </motion.div>
  );
}

function QuestionTypeBadge({ type }: { type: QuestionType }) {
  const map: Record<QuestionType, { label: string; color: string }> = {
    locate: { label: 'Кликни на карте', color: 'bg-sky-900/40 text-sky-300 border-sky-500/40' },
    identify: { label: 'Узнай зону', color: 'bg-emerald-900/40 text-emerald-300 border-emerald-500/40' },
    choice: { label: 'Выбери ответ', color: 'bg-violet-900/40 text-violet-300 border-violet-500/40' },
    climate: { label: 'Климатограмма', color: 'bg-orange-900/40 text-orange-300 border-orange-500/40' },
    profile: { label: 'Профиль рельефа', color: 'bg-amber-900/40 text-amber-300 border-amber-500/40' },
    scale: { label: 'Масштаб', color: 'bg-teal-900/40 text-teal-300 border-teal-500/40' },
    table: { label: 'Таблица', color: 'bg-pink-900/40 text-pink-300 border-pink-500/40' },
  };
  const cfg = map[type];
  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold border ${cfg.color}`}>
      {type === 'locate' && <Crosshair className="w-3 h-3" />}
      {type === 'identify' && <Eye className="w-3 h-3" />}
      {type === 'choice' && <BookOpen className="w-3 h-3" />}
      {type === 'climate' && <Thermometer className="w-3 h-3" />}
      {type === 'profile' && <Mountain className="w-3 h-3" />}
      {type === 'scale' && <Ruler className="w-3 h-3" />}
      {type === 'table' && <BarChart3 className="w-3 h-3" />}
      {cfg.label}
    </span>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════════════
   REFERENCE SIDEBAR — Geographic cheat cards
   ═══════════════════════════════════════════════════════════════════════════════════ */

function ReferenceSidebar({ activeRefTab, setActiveRefTab }: { activeRefTab: string; setActiveRefTab: (t: string) => void }) {
  const tabs = [
    { id: 'climate', label: 'Климат', icon: Thermometer },
    { id: 'rivers', label: 'Реки РФ', icon: Droplets },
    { id: 'features', label: 'Объекты', icon: Globe },
    { id: 'formulas', label: 'Формулы', icon: Info },
    { id: 'facts', label: 'Факты', icon: BookOpen },
  ];

  return (
    <Card className="bg-[#0a1a14] border-emerald-800/30 overflow-hidden">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <BookOpen className="w-4 h-4 text-emerald-400" /> Справочник
        </CardTitle>
      </CardHeader>
      <CardContent className="p-3 space-y-3">
        {/* Tab bar */}
        <div className="flex gap-1 flex-wrap">
          {tabs.map((t) => {
            const Icon = t.icon;
            return (
              <button key={t.id} onClick={() => setActiveRefTab(t.id)}
                className={`flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-bold transition-all ${activeRefTab === t.id ? 'bg-emerald-700 text-white' : 'bg-black/20 text-emerald-500/60 hover:bg-emerald-900/30'}`}
              >
                <Icon className="w-3 h-3" />{t.label}
              </button>
            );
          })}
        </div>

        <AnimatePresence mode="wait">
          {activeRefTab === 'climate' && (
            <motion.div key="climate" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-2">
              {CLIMATE_ZONES.map((z) => (
                <div key={z.name} className="flex items-center gap-2 p-2 bg-black/20 rounded-lg border-l-2" style={{ borderLeftColor: z.color }}>
                  <div className="flex-1">
                    <div className="text-xs font-bold text-white">{z.name}</div>
                    <div className="text-[10px] text-gray-500">{z.latRange} | {z.tempRange}</div>
                  </div>
                  <div className="text-[9px] text-gray-500 text-right">
                    <div>{z.precip}</div>
                    <div className="truncate max-w-[80px]">{z.vegetation}</div>
                  </div>
                </div>
              ))}
            </motion.div>
          )}

          {activeRefTab === 'rivers' && (
            <motion.div key="rivers" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-1.5">
              {RIVERS_OF_RUSSIA.map((r) => (
                <div key={r.name} className="flex items-center gap-2 p-2 bg-black/20 rounded-lg">
                  <Droplets className="w-3 h-3 shrink-0" style={{ color: r.color }} />
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-bold text-white">{r.name} <span className="text-gray-500 font-normal">({r.length})</span></div>
                    <div className="text-[10px] text-gray-500 truncate">{r.destination}</div>
                  </div>
                  <span className="text-[9px] text-sky-400 shrink-0">{r.ocean || '—'}</span>
                </div>
              ))}
            </motion.div>
          )}

          {activeRefTab === 'features' && (
            <motion.div key="features" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-3">
              {KEY_GEOGRAPHIC_FEATURES.map((group) => (
                <div key={group.type}>
                  <div className="text-xs font-bold text-emerald-400 mb-1">{group.type}</div>
                  <div className="flex flex-wrap gap-1">
                    {group.items.map((item) => (
                      <span key={item} className="text-[9px] px-1.5 py-0.5 bg-black/20 rounded text-gray-400">{item}</span>
                    ))}
                  </div>
                </div>
              ))}
            </motion.div>
          )}

          {activeRefTab === 'formulas' && (
            <motion.div key="formulas" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-2">
              {FORMULAS.map((f) => (
                <div key={f.formula} className="p-2 bg-black/20 rounded-lg">
                  <div className="font-mono text-emerald-400 font-bold text-sm">{f.formula}</div>
                  <div className="text-[10px] text-gray-400 mt-0.5">{f.desc}</div>
                  <div className="text-[9px] text-gray-600">{f.detail}</div>
                </div>
              ))}
            </motion.div>
          )}

          {activeRefTab === 'facts' && (
            <motion.div key="facts" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              {QUICK_FACTS.map((f, i) => (
                <div key={f.label} className={`flex justify-between items-center py-1.5 ${i < QUICK_FACTS.length - 1 ? 'border-b border-emerald-900/20' : ''}`}>
                  <span className="text-[11px] text-gray-400">{f.label}</span>
                  <span className="text-[11px] font-bold text-amber-300">{f.value}</span>
                </div>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </CardContent>
    </Card>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════════════
   RESULTS SUMMARY — Final scorecard
   ═══════════════════════════════════════════════════════════════════════════════════ */

function ResultsSummary({ answers, questions }: { answers: Record<number, string | number | [number, number] | null>; questions: Question[] }) {
  const answered = Object.keys(answers).length;
  const correct = questions.reduce((acc, q) => {
    const ans = answers[q.id];
    if (ans === undefined || ans === null) return acc;
    if (typeof ans === 'string' && ans.startsWith('miss:')) return acc;
    if (typeof q.correctAnswer === 'number') {
      if (typeof ans === 'number') {
        return acc + (Math.abs(ans - q.correctAnswer) <= q.correctAnswer * 0.15 ? 1 : 0);
      }
      return acc;
    }
    return acc + (ans === q.correctAnswer ? 1 : 0);
  }, 0);
  const pct = answered > 0 ? Math.round((correct / answered) * 100) : 0;

  const grade = pct >= 90 ? { label: 'Отлично!', color: 'text-emerald-400', bg: 'bg-emerald-900/20', border: 'border-emerald-500/40' }
    : pct >= 70 ? { label: 'Хорошо', color: 'text-sky-400', bg: 'bg-sky-900/20', border: 'border-sky-500/40' }
    : pct >= 50 ? { label: 'Удовлетворительно', color: 'text-amber-400', bg: 'bg-amber-900/20', border: 'border-amber-500/40' }
    : { label: 'Нужно подтянуть', color: 'text-red-400', bg: 'bg-red-900/20', border: 'border-red-500/40' };

  const byType = questions.reduce<Record<string, { total: number; correct: number }>>((acc, q) => {
    if (!acc[q.type]) acc[q.type] = { total: 0, correct: 0 };
    acc[q.type].total++;
    const ans = answers[q.id];
    if (ans === undefined || ans === null) return acc;
    if (typeof ans === 'string' && ans.startsWith('miss:')) return acc;
    if (typeof q.correctAnswer === 'number' && typeof ans === 'number') {
      if (Math.abs(ans - q.correctAnswer) <= q.correctAnswer * 0.15) acc[q.type].correct++;
    } else if (ans === q.correctAnswer) {
      acc[q.type].correct++;
    }
    return acc;
  }, {});

  return (
    <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="space-y-4">
      <Card className={`${grade.bg} border ${grade.border}`}>
        <CardContent className="p-6 text-center">
          <Trophy className={`w-12 h-12 mx-auto mb-3 ${grade.color}`} />
          <div className={`text-2xl font-black ${grade.color}`}>{grade.label}</div>
          <div className="text-4xl font-black text-white mt-1">{correct} / {questions.length}</div>
          <div className="text-sm text-gray-400 mt-1">{answered} из {questions.length} отвечено · {pct}% точность</div>
          <Progress value={(answered / questions.length) * 100} className="mt-3 h-2 bg-black/30" />
        </CardContent>
      </Card>

      <Card className="bg-[#0a1a14] border-emerald-800/30">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Результаты по типам</CardTitle>
        </CardHeader>
        <CardContent className="p-3 space-y-2">
          {Object.entries(byType).map(([type, stats]) => (
            <div key={type} className="flex items-center gap-2">
              <QuestionTypeBadge type={type as QuestionType} />
              <div className="flex-1">
                <div className="h-1.5 bg-emerald-950/50 rounded-full overflow-hidden">
                  <motion.div initial={{ width: 0 }} animate={{ width: `${(stats.correct / stats.total) * 100}%` }} transition={{ duration: 0.5 }} className="h-full bg-emerald-500 rounded-full" />
                </div>
              </div>
              <span className="text-xs text-gray-400 font-mono min-w-[40px] text-right">{stats.correct}/{stats.total}</span>
            </div>
          ))}
        </CardContent>
      </Card>
    </motion.div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════════════
   MAIN PAGE COMPONENT
   ═══════════════════════════════════════════════════════════════════════════════════ */

export default function Geography7Practice() {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<number, string | number | [number, number] | null>>({});
  const [userClick, setUserClick] = useState<[number, number] | null>(null);
  const [showHint, setShowHint] = useState(false);
  const [showExplanation, setShowExplanation] = useState(false);
  const [activeRefTab, setActiveRefTab] = useState('climate');
  const [activeEarthLayer, setActiveEarthLayer] = useState<number | null>(null);
  const [expandedOcean, setExpandedOcean] = useState<number | null>(null);
  const [showReference, setShowReference] = useState(false);
  const [showFinish, setShowFinish] = useState(false);

  const currentQ = QUESTIONS[currentIndex];
  const hasAnswered = answers[currentQ.id] !== undefined && answers[currentQ.id] !== null;
  const isCorrect = useMemo(() => {
    const ans = answers[currentQ.id];
    if (ans === undefined || ans === null) return false;
    if (typeof ans === 'string' && ans.startsWith('miss:')) return false;
    if (typeof currentQ.correctAnswer === 'number' && typeof ans === 'number') {
      return Math.abs(ans - currentQ.correctAnswer) <= currentQ.correctAnswer * 0.15;
    }
    return ans === currentQ.correctAnswer;
  }, [answers, currentQ]);

  const progress = useMemo(() => {
    const answered = Object.keys(answers).filter(k => {
      const v = answers[Number(k)];
      return v !== undefined && v !== null;
    }).length;
    return (answered / QUESTIONS.length) * 100;
  }, [answers]);

  const score = useMemo(() => {
    return QUESTIONS.reduce((acc, q) => {
      const ans = answers[q.id];
      if (ans === undefined || ans === null) return acc;
      if (typeof ans === 'string' && ans.startsWith('miss:')) return acc;
      if (typeof q.correctAnswer === 'number' && typeof ans === 'number') {
        return acc + (Math.abs(ans - q.correctAnswer) <= q.correctAnswer * 0.15 ? 1 : 0);
      }
      return acc + (ans === q.correctAnswer ? 1 : 0);
    }, 0);
  }, [answers]);

  const mapPoints = useMemo<PointOfInterest[]>(() => {
    const base = currentQ.mapConfig.points || [];
    const points: PointOfInterest[] = [...base];

    if (userClick && currentQ.type === 'locate') {
      points.push({
        id: 'user-click', name: 'Ваш выбор', type: 'point', icon: '::FaMapMarkerAlt::',
        color: isCorrect ? '#22c55e' : '#ef4444', coords: [userClick],
      });
    }

    if (showHint && currentQ.type === 'locate') {
      const correct = currentQ.correctAnswer as [number, number];
      points.push({
        id: 'hint-zone', name: 'Подсказка', type: 'point', icon: '::FaBullseye::',
        color: '#f59e0b', coords: [correct],
      });
    }

    return points;
  }, [currentQ, userClick, isCorrect, showHint]);

  const validateLocate = useCallback((click: [number, number]) => {
    if (currentQ.type !== 'locate') return false;
    const target = currentQ.correctAnswer as [number, number];
    const tol = currentQ.tolerance || 2;
    return Math.abs(click[0] - target[0]) <= tol && Math.abs(click[1] - target[1]) <= tol;
  }, [currentQ]);

  const handleMapClick = useCallback((coords: [number, number]) => {
    if (hasAnswered) return;
    if (currentQ.type !== 'locate') return;
    setUserClick(coords);
    const correct = validateLocate(coords);
    setAnswers(prev => ({ ...prev, [currentQ.id]: correct ? currentQ.correctAnswer : `miss:${coords.join(',')}` }));
    setShowExplanation(true);
  }, [currentQ, hasAnswered, validateLocate]);

  const handleChoiceAnswer = useCallback((option: string) => {
    if (hasAnswered) return;
    setAnswers(prev => ({ ...prev, [currentQ.id]: option }));
    setShowExplanation(true);
  }, [currentQ, hasAnswered]);

  const handleScaleAnswer = useCallback((km: number) => {
    if (hasAnswered) return;
    const correct = currentQ.scaleInfo?.correctKm ?? 0;
    const isKmCorrect = Math.abs(km - correct) <= correct * 0.15;
    setAnswers(prev => ({ ...prev, [currentQ.id]: isKmCorrect ? correct : km }));
    setShowExplanation(true);
  }, [currentQ, hasAnswered]);

  const nextQuestion = () => {
    if (currentIndex < QUESTIONS.length - 1) {
      setCurrentIndex(prev => prev + 1);
      setUserClick(null);
      setShowHint(false);
      setShowExplanation(false);
    } else {
      setShowFinish(true);
    }
  };

  const prevQuestion = () => {
    if (currentIndex > 0) {
      setCurrentIndex(prev => prev - 1);
      setUserClick(null);
      setShowHint(false);
      setShowExplanation(false);
    }
    setShowFinish(false);
  };

  const resetPractice = () => {
    setAnswers({});
    setCurrentIndex(0);
    setUserClick(null);
    setShowHint(false);
    setShowExplanation(false);
    setShowFinish(false);
  };

  return (
    <div className="min-h-screen bg-[#070f0b] text-emerald-50 p-4 md:p-6 font-sans selection:bg-emerald-500/30 relative overflow-x-hidden">
      {/* Background texture */}
      <div
        className="absolute inset-0 z-0 opacity-[0.04] pointer-events-none"
        style={{
          backgroundImage: `
            radial-gradient(circle at 20% 50%, #10b981 1px, transparent 1px),
            radial-gradient(circle at 80% 20%, #10b981 1px, transparent 1px),
            linear-gradient(to right, #064e3b 1px, transparent 1px),
            linear-gradient(to bottom, #064e3b 1px, transparent 1px)
          `,
          backgroundSize: '40px 40px, 60px 60px, 80px 80px, 80px 80px',
        }}
      />
      {/* Glow orbs */}
      <div className="absolute top-[-200px] left-[-100px] w-[700px] h-[700px] bg-emerald-700/8 blur-[200px] rounded-full pointer-events-none" />
      <div className="absolute bottom-[-300px] right-[-200px] w-[600px] h-[600px] bg-teal-700/6 blur-[180px] rounded-full pointer-events-none" />

      <div className="max-w-7xl mx-auto relative z-10">

        {/* ════════ HEADER ════════ */}
        <motion.header initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7 }} className="mb-6">
          <div className="flex flex-col md:flex-row items-center gap-6">
            <div className="w-32 h-32 md:w-40 md:h-40 flex-shrink-0">
              <GlobeSVG />
            </div>
            <div className="text-center md:text-left flex-1">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-900/30 border border-emerald-500/40 text-emerald-300 text-xs mb-3 uppercase tracking-[0.15em] font-bold">
                <Target className="w-3.5 h-3.5" /> VPR_GEO_7 // INTERACTIVE
              </div>
              <h1 className="text-3xl md:text-5xl font-black tracking-tight text-white">
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-300 via-teal-200 to-green-400">TERRA</span>{' '}
                <span className="text-white">EXPLORER</span>
              </h1>
              <p className="text-emerald-400/60 text-sm md:text-base mt-1">7 класс — Литосфера, Гидросфера, Атмосфера, Географическая карта</p>
              <div className="flex items-center gap-4 mt-3 justify-center md:justify-start text-xs text-emerald-500/60">
                <span className="flex items-center gap-1"><MapPin className="w-3 h-3" /> Интерактивные карты</span>
                <span className="flex items-center gap-1"><Eye className="w-3 h-3" /> Наведи и узнай</span>
                <span className="flex items-center gap-1"><Crosshair className="w-3 h-3" /> 24 вопроса</span>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Badge variant="outline" className="bg-black/30 text-emerald-300 border-emerald-700/50 text-sm">
                <Trophy className="w-3.5 h-3.5 mr-1" />{score} / {QUESTIONS.length}
              </Badge>
              <Button variant="outline" size="sm" onClick={resetPractice} className="gap-1.5">
                <RotateCcw className="w-3.5 h-3.5" /> Сброс
              </Button>
            </div>
          </div>
          <Progress value={progress} className="mt-4 h-1.5 bg-emerald-950/50" />
        </motion.header>

        {/* ════════ EARTH STRUCTURE + WATER CYCLE (reference panels) ════════ */}
        <div className="grid md:grid-cols-2 gap-6 mb-8">
          <motion.section initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="bg-[#0a1a14] rounded-2xl border border-emerald-800/40 p-4">
            <div className="flex items-center gap-2 mb-3">
              <Layers className="text-amber-400 w-5 h-5" />
              <h2 className="text-lg font-bold text-white">Строение Земли</h2>
            </div>
            <div className="h-56">
              <EarthLayersSVG activeLayer={activeEarthLayer} setActiveLayer={setActiveEarthLayer} />
            </div>
            <div className="grid grid-cols-2 gap-2 mt-3">
              {EARTH_LAYERS.map((layer, i) => (
                <div
                  key={i}
                  className="p-2 rounded-lg border-l-2 cursor-pointer transition-all hover:translate-x-1"
                  style={{ borderLeftColor: layer.color, backgroundColor: `${layer.color}10` }}
                  onMouseEnter={() => setActiveEarthLayer(i)} onMouseLeave={() => setActiveEarthLayer(null)}
                >
                  <div className="text-xs font-bold text-white">{layer.name}</div>
                  <div className="text-[10px] text-gray-500">{layer.depth} · {layer.temp}</div>
                </div>
              ))}
            </div>
          </motion.section>

          <motion.section initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="bg-[#0a1a14] rounded-2xl border border-emerald-800/40 p-4">
            <div className="flex items-center gap-2 mb-3">
              <Droplets className="text-sky-400 w-5 h-5" />
              <h2 className="text-lg font-bold text-white">Круговорот Воды</h2>
            </div>
            <div className="h-52">
              <WaterCycleSVG />
            </div>
            <div className="grid grid-cols-4 gap-2 mt-3">
              {[
                { name: 'Испарение', icon: Sun, color: 'text-yellow-400' },
                { name: 'Конденсация', icon: CloudRain, color: 'text-gray-300' },
                { name: 'Осадки', icon: Droplets, color: 'text-blue-400' },
                { name: 'Сток', icon: Waves, color: 'text-cyan-400' },
              ].map((step) => {
                const Icon = step.icon;
                return (
                  <div key={step.name} className="text-center p-2 bg-black/20 rounded-lg">
                    <Icon className={`w-4 h-4 ${step.color} mx-auto mb-1`} />
                    <div className="text-[10px] text-gray-400">{step.name}</div>
                  </div>
                );
              })}
            </div>
          </motion.section>
        </div>

        {/* ════════ ATMOSPHERE LAYERS ════════ */}
        <motion.section initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="mb-8">
          <div className="flex items-center gap-2 mb-4">
            <Wind className="text-teal-400 w-5 h-5" />
            <h2 className="text-lg font-bold text-white">Слои Атмосферы</h2>
          </div>
          <div className="max-w-2xl mx-auto space-y-1.5">
            {ATMOSPHERE_LAYERS.map((layer, i) => (
              <motion.div key={i} initial={{ opacity: 0, x: -20 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.08 }}
                className="bg-[#0a1a14] rounded-lg border border-emerald-800/20 p-3 cursor-pointer group hover:translate-x-1 transition-all"
                style={{ borderLeft: `3px solid ${layer.color}` }}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <span className="font-bold text-sm" style={{ color: layer.color }}>{layer.name}</span>
                    <span className="text-xs text-gray-500 ml-2 font-mono">{layer.height}</span>
                  </div>
                </div>
                <p className="text-[10px] text-gray-400 mt-0.5 group-hover:text-gray-300 transition-colors">{layer.fact}</p>
              </motion.div>
            ))}
          </div>
          <div className="max-w-2xl mx-auto mt-3 bg-emerald-950/20 p-3 rounded-xl border border-emerald-700/30">
            <p className="text-xs text-emerald-300">
              <strong>Запомни:</strong> Атмосферное давление на уровне моря = 760 мм рт. ст. С высотой давление падает!
              На каждые 10,5 м вверх → −1 мм рт. ст.
            </p>
          </div>
        </motion.section>

        {/* ════════ CONTINENTS + OCEANS ════════ */}
        <div className="grid md:grid-cols-2 gap-6 mb-8">
          <motion.section initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
            <div className="flex items-center gap-2 mb-4">
              <Mountain className="text-emerald-300 w-5 h-5" />
              <h2 className="text-lg font-bold text-white">Материки</h2>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {CONTINENTS.map((c) => (
                <motion.div key={c.name} whileHover={{ y: -3, scale: 1.02 }}
                  className="bg-[#0a1a14] rounded-xl border border-emerald-800/40 p-3 cursor-pointer hover:shadow-xl transition-all"
                >
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: c.color }} />
                    <h3 className="font-bold text-white text-sm">{c.name}</h3>
                  </div>
                  <div className="space-y-0.5 text-[10px]">
                    <div className="flex justify-between"><span className="text-gray-500">Площадь</span><span className="text-gray-300">{c.area} млн км²</span></div>
                    <div className="flex justify-between"><span className="text-gray-500">Население</span><span className="text-gray-300">{c.population}</span></div>
                    <div className="flex justify-between"><span className="text-gray-500">Высшая точка</span><span className="text-gray-300">{c.highest}</span></div>
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.section>

          <motion.section initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
            <div className="flex items-center gap-2 mb-4">
              <Waves className="text-sky-400 w-5 h-5" />
              <h2 className="text-lg font-bold text-white">Океаны</h2>
            </div>
            <div className="space-y-2">
              {OCEANS.map((ocean, i) => (
                <motion.div key={ocean.name} layout onClick={() => setExpandedOcean(expandedOcean === i ? null : i)}
                  className="bg-[#0a1a14] rounded-xl border border-sky-800/30 p-4 cursor-pointer hover:border-sky-600/50 transition-all"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Droplets className="w-4 h-4 text-sky-400" />
                      <div>
                        <h3 className="font-bold text-white text-sm">{ocean.name} океан</h3>
                        <p className="text-[10px] text-gray-500">{ocean.area}</p>
                      </div>
                    </div>
                    {expandedOcean === i ? <ChevronUp className="w-4 h-4 text-gray-500" /> : <ChevronDown className="w-4 h-4 text-gray-500" />}
                  </div>
                  <AnimatePresence>
                    {expandedOcean === i && (
                      <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
                        <div className="mt-3 pt-3 border-t border-sky-900/30 space-y-1">
                          <div className="flex items-start gap-2">
                            <span className="text-[10px] text-sky-400 font-bold min-w-[50px]">Глубина:</span>
                            <span className="text-[10px] text-gray-300">{ocean.depth}</span>
                          </div>
                          <div className="flex items-start gap-2">
                            <span className="text-[10px] text-sky-400 font-bold min-w-[50px]">Факт:</span>
                            <span className="text-[10px] text-gray-300">{ocean.fact}</span>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              ))}
            </div>
          </motion.section>
        </div>

        {/* ════════ MAIN QUIZ ENGINE ════════ */}
        <motion.section initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Compass className="text-emerald-400 w-5 h-5" />
              <h2 className="text-lg font-bold text-white">Практика по картам</h2>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="bg-black/30 text-emerald-300 border-emerald-700/50 text-xs">
                {score} / {QUESTIONS.length} правильно
              </Badge>
              <Button variant="ghost" size="sm" onClick={() => setShowReference(!showReference)} className="text-xs gap-1 text-emerald-400">
                <BookOpen className="w-3 h-3" /> Справочник
              </Button>
            </div>
          </div>

          <AnimatePresence mode="wait">
            {showFinish ? (
              <motion.div key="results" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <ResultsSummary answers={answers} questions={QUESTIONS} />
                <div className="flex justify-center gap-3 mt-6">
                  <Button variant="outline" onClick={() => { setShowFinish(false); setCurrentIndex(0); setUserClick(null); setShowHint(false); setShowExplanation(false); }} className="gap-1.5">
                    <ArrowLeft className="w-3.5 h-3.5" /> К вопросам
                  </Button>
                  <Button onClick={resetPractice} className="gap-1.5 bg-emerald-700 hover:bg-emerald-600">
                    <RotateCcw className="w-3.5 h-3.5" /> Пройти заново
                  </Button>
                </div>
              </motion.div>
            ) : (
              <motion.div key={currentQ.id} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.3 }}>
                <div className="grid lg:grid-cols-5 gap-6">
                  {/* Map Panel */}
                  <div className="lg:col-span-3">
                    <Card className="bg-[#0a1a14] border-emerald-800/40 overflow-hidden">
                      <CardHeader className="pb-2">
                        <div className="flex items-center justify-between">
                          <CardTitle className="text-base flex items-center gap-2">
                            <Globe className="w-4 h-4 text-emerald-400" />
                            {currentQ.vprType}
                          </CardTitle>
                          <QuestionTypeBadge type={currentQ.type} />
                        </div>
                        <CardDescription className="text-emerald-500/60 text-xs">{currentQ.mapConfig.interactionHint}</CardDescription>
                      </CardHeader>
                      <CardContent className="p-0">
                        <div className="h-[40vh] md:h-[50vh] w-full relative">
                          <RacingMap
                            points={mapPoints}
                            bounds={currentQ.mapConfig.bounds}
                            tileLayer={currentQ.mapConfig.tileLayer || 'cartodb-dark'}
                            className="h-full w-full"
                            onMapClick={handleMapClick}
                            onPointClick={(poi) => {
                              if (currentQ.type === 'climate' && poi.id.startsWith('climate')) {
                                setShowExplanation(true);
                              }
                            }}
                          />
                          {currentQ.type === 'locate' && !hasAnswered && (
                            <div className="absolute top-3 left-3 bg-black/60 backdrop-blur-sm px-3 py-1.5 rounded-lg text-xs text-emerald-300 border border-emerald-700/40 flex items-center gap-1.5">
                              <MapPin className="w-3.5 h-3.5" /> Кликните по карте
                            </div>
                          )}
                          {hasAnswered && (
                            <div className={`absolute top-3 right-3 px-3 py-1.5 rounded-lg text-xs font-bold border flex items-center gap-1.5 ${isCorrect ? 'bg-emerald-900/80 border-emerald-500/50 text-emerald-300' : 'bg-red-900/80 border-red-500/50 text-red-300'}`}>
                              {isCorrect ? <><CheckCircle className="w-3.5 h-3.5" /> Верно!</> : <><XCircle className="w-3.5 h-3.5" /> Неверно</>}
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  </div>

                  {/* Question Panel */}
                  <div className="lg:col-span-2 space-y-4">
                    <Card className="bg-[#0a1a14] border-emerald-800/40">
                      <CardHeader>
                        <CardTitle className="text-sm leading-relaxed">{currentQ.text}</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        {/* Climate graph for climate questions */}
                        {currentQ.type === 'climate' && (
                          <div>
                            <ClimateGraph type={currentQ.id === 3 ? 'equatorial' : 'temperate'} />
                            <p className="text-[10px] text-gray-500 mt-1">
                              Красная линия — температура (°C), синие столбики — осадки (мм). Нажмите на маркер на карте.
                            </p>
                          </div>
                        )}

                        {/* Terrain profile for profile questions */}
                        {currentQ.type === 'profile' && currentQ.profile && (
                          <div>
                            <TerrainProfileSVG profile={currentQ.profile} />
                            <p className="text-[10px] text-gray-500 mt-1">
                              Буквы на профиле: {currentQ.profile.features.map(f => `${f.letter} — ${f.label}`).join(', ')}
                            </p>
                          </div>
                        )}

                        {/* Scale calculator for scale questions */}
                        {currentQ.type === 'scale' && currentQ.scaleInfo && (
                          <ScaleCalculator scaleInfo={currentQ.scaleInfo} onAnswer={handleScaleAnswer} />
                        )}

                        {/* Population table for table questions */}
                        {currentQ.type === 'table' && currentQ.tableInfo && (
                          <PopulationTable tableInfo={currentQ.tableInfo} />
                        )}

                        {/* Multiple choice options */}
                        {currentQ.options && currentQ.type !== 'table' && (
                          <div className="space-y-2">
                            {currentQ.options.map((opt) => {
                              const isSelected = answers[currentQ.id] === opt;
                              const isCorrectOpt = opt === currentQ.correctAnswer;
                              const showResult = hasAnswered;
                              let btnClass = 'w-full justify-start text-left p-3 rounded-lg border transition-all ';
                              if (showResult) {
                                if (isCorrectOpt) btnClass += 'bg-emerald-900/40 border-emerald-500/50 text-emerald-300';
                                else if (isSelected) btnClass += 'bg-red-900/40 border-red-500/50 text-red-300';
                                else btnClass += 'bg-black/20 border-emerald-900/30 text-gray-500';
                              } else {
                                btnClass += 'bg-black/20 border-emerald-900/30 hover:bg-emerald-900/20 hover:border-emerald-700/50 text-gray-300';
                              }
                              return (
                                <Button key={opt} variant="outline" className={btnClass} onClick={() => handleChoiceAnswer(opt)} disabled={showResult}>
                                  <span className="flex-1">{opt}</span>
                                  {showResult && isCorrectOpt && <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />}
                                  {showResult && isSelected && !isCorrectOpt && <XCircle className="w-4 h-4 text-red-400 shrink-0" />}
                                </Button>
                              );
                            })}
                          </div>
                        )}

                        {/* Hint & Explanation */}
                        <div className="space-y-2">
                          {!hasAnswered && currentQ.hint && (
                            <Button variant="ghost" size="sm" onClick={() => setShowHint(true)} className="text-amber-400 hover:text-amber-300 hover:bg-amber-900/20 gap-1.5">
                              <Lightbulb className="w-3.5 h-3.5" /> Подсказка
                            </Button>
                          )}
                          {showHint && currentQ.hint && <FeedbackBadge status="hint" text={currentQ.hint} />}
                          {showExplanation && <FeedbackBadge status={isCorrect ? 'success' : 'error'} text={currentQ.explanation} />}
                        </div>
                      </CardContent>
                    </Card>

                    {/* Navigation */}
                    <div className="flex items-center justify-between gap-2">
                      <Button variant="outline" size="sm" onClick={prevQuestion} disabled={currentIndex === 0} className="gap-1.5">
                        <ArrowLeft className="w-3.5 h-3.5" /> Назад
                      </Button>
                      <span className="text-xs text-emerald-500/60 font-mono">
                        {currentIndex + 1} / {QUESTIONS.length}
                      </span>
                      {currentIndex < QUESTIONS.length - 1 ? (
                        <Button size="sm" onClick={nextQuestion} className="gap-1.5 bg-emerald-700 hover:bg-emerald-600">
                          Далее <ArrowRight className="w-3.5 h-3.5" />
                        </Button>
                      ) : (
                        <Button size="sm" onClick={() => setShowFinish(true)} className="gap-1.5 bg-amber-700 hover:bg-amber-600">
                          <Trophy className="w-3.5 h-3.5" /> Итоги
                        </Button>
                      )}
                    </div>

                    {/* Quick Stats */}
                    <Card className="bg-[#0a1a14] border-emerald-800/30">
                      <CardContent className="p-3 grid grid-cols-4 gap-2 text-center">
                        <div className="bg-black/20 p-2 rounded-lg">
                          <div className="text-lg font-bold text-emerald-400">{score}</div>
                          <div className="text-[9px] text-gray-500">Верно</div>
                        </div>
                        <div className="bg-black/20 p-2 rounded-lg">
                          <div className="text-lg font-bold text-red-400">
                            {Object.keys(answers).filter(k => {
                              const v = answers[Number(k)];
                              return v !== undefined && v !== null && v !== (QUESTIONS.find(q => q.id === Number(k))?.correctAnswer);
                            }).length}
                          </div>
                          <div className="text-[9px] text-gray-500">Ошибки</div>
                        </div>
                        <div className="bg-black/20 p-2 rounded-lg">
                          <div className="text-lg font-bold text-amber-400">{QUESTIONS.length - Object.keys(answers).filter(k => answers[Number(k)] !== undefined && answers[Number(k)] !== null).length}</div>
                          <div className="text-[9px] text-gray-500">Осталось</div>
                        </div>
                        <div className="bg-black/20 p-2 rounded-lg">
                          <div className="text-lg font-bold text-sky-400">
                            {Math.round((score / Math.max(1, Object.keys(answers).filter(k => answers[Number(k)] !== undefined && answers[Number(k)] !== null).length)) * 100)}%
                          </div>
                          <div className="text-[9px] text-gray-500">Точность</div>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                </div>

                {/* Reference sidebar (toggleable) */}
                <AnimatePresence>
                  {showReference && (
                    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="mt-6 overflow-hidden">
                      <ReferenceSidebar activeRefTab={activeRefTab} setActiveRefTab={setActiveRefTab} />
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.section>

        {/* ════════ FOOTER ════════ */}
        <motion.div initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }} className="flex justify-center pb-8">
          <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
            className="group flex items-center gap-3 bg-emerald-700 hover:bg-emerald-600 text-white font-bold py-4 px-10 rounded-full shadow-[0_0_25px_rgba(16,185,129,0.3)] transition-all cursor-pointer"
          >
            <ArrowLeft className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
            <span>НАЗАД</span>
          </motion.div>
        </motion.div>
      </div>
    </div>
  );
}

'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';
import {
  Ruler, Triangle, Maximize2, MoveDiagonal, CheckCircle2, Circle,
  Square, Compass, Eye, MousePointerClick, ChevronDown, ChevronUp,
  Lightbulb, BookOpen, ArrowLeft,
} from 'lucide-react';

/* ================================================================
   TYPES
   ================================================================ */

type TabKey = 'angles' | 'triangles' | 'parallel' | 'circles' | 'area' | 'tips';
type AngleType = 'vertical' | 'adjacent' | 'complementary' | 'supplementary' | 'perpendicular';
type TriangleRule = 'sus' | 'usu' | 'sss';
type CirclePart = 'radius' | 'diameter' | 'chord' | 'tangent' | 'central' | 'arc';
type AreaShape = 'triangle' | 'rectangle' | 'parallelogram' | 'trapezoid';

/* ================================================================
   DATA
   ================================================================ */

const angleTypesData: { key: AngleType; label: string; description: string; formula: string; color: string; badge: string }[] = [
  {
    key: 'adjacent',
    label: 'Смежные углы',
    description: 'Соседи на одной прямой. У них одна сторона общая, а пол — прямая линия.',
    formula: '∠1 + ∠2 = 180°',
    color: '#facc15',
    badge: '180°',
  },
  {
    key: 'vertical',
    label: 'Вертикальные углы',
    description: 'Как раскрытые ножницы. Смотрят друг на друга и всегда равны.',
    formula: '∠1 = ∠3',
    color: '#22d3ee',
    badge: '=',
  },
  {
    key: 'complementary',
    label: 'Дополнительные углы',
    description: 'Два угла, сумма которых равна 90°. Вместе образуют прямой угол.',
    formula: '∠1 + ∠2 = 90°',
    color: '#4ade80',
    badge: '90°',
  },
  {
    key: 'supplementary',
    label: 'Односторонние углы',
    description: 'При параллельных прямых и секущей. Сумма всегда 180°.',
    formula: '∠1 + ∠2 = 180°',
    color: '#fb923c',
    badge: '180°',
  },
  {
    key: 'perpendicular',
    label: 'Перпендикуляр',
    description: 'Две прямые пересекаются под прямым углом (90°).',
    formula: '∠ = 90°',
    color: '#f472b6',
    badge: '90°',
  },
];

const triangleRulesData: { key: TriangleRule; label: string; shortLabel: string; description: string; example: string; color: string; border: string }[] = [
  {
    key: 'sus',
    label: 'I. СУС',
    shortLabel: 'СУС',
    description: 'Две Стороны и Угол между ними. Как клешня краба — хватает фигуру и не даёт ей измениться.',
    example: 'Если AB = A₁B₁, AC = A₁C₁ и ∠A = ∠A₁, то △ABC = △A₁B₁C₁',
    color: '#facc15',
    border: 'border-yellow-400/30',
  },
  {
    key: 'usu',
    label: 'II. УСУ',
    shortLabel: 'УСУ',
    description: 'Сторона и два прилежащих Угла. Основание с двумя углами полностью фиксирует треугольник.',
    example: 'Если AC = A₁C₁, ∠A = ∠A₁ и ∠C = ∠C₁, то △ABC = △A₁B₁C₁',
    color: '#22d3ee',
    border: 'border-cyan-400/30',
  },
  {
    key: 'sss',
    label: 'III. ССС',
    shortLabel: 'ССС',
    description: 'Три Стороны. Жёсткий каркас — три длины однозначно определяют треугольник.',
    example: 'Если AB = A₁B₁, BC = B₁C₁ и AC = A₁C₁, то △ABC = △A₁B₁C₁',
    color: '#f472b6',
    border: 'border-pink-400/30',
  },
];

const circlePartsData: { key: CirclePart; label: string; description: string; formula: string; color: string }[] = [
  { key: 'radius', label: 'Радиус', description: 'Отрезок от центра до любой точки окружности.', formula: 'R = d / 2', color: '#22d3ee' },
  { key: 'diameter', label: 'Диаметр', description: 'Отрезок через центр, соединяющий две точки окружности.', formula: 'd = 2R', color: '#facc15' },
  { key: 'chord', label: 'Хорда', description: 'Отрезок, соединяющий две точки окружности (не через центр).', formula: '—', color: '#4ade80' },
  { key: 'tangent', label: 'Касательная', description: 'Прямая, имеющая с окружностью ровно одну общую точку. Перпендикулярна радиусу.', formula: 'R ⊥ t', color: '#f472b6' },
  { key: 'central', label: 'Центральный угол', description: 'Угол с вершиной в центре окружности. Равен градусной мере дуги.', formula: '∠ = ° дуги', color: '#fb923c' },
  { key: 'arc', label: 'Дуга', description: 'Часть окружности между двумя точками.', formula: 'L = πRα/180', color: '#a78bfa' },
];

const areaFormulasData: { key: AreaShape; label: string; formula: string; description: string; color: string }[] = [
  { key: 'triangle', label: 'Треугольник', formula: 'S = ½ · a · h', description: 'Половина произведения стороны на высоту к ней.', color: '#facc15' },
  { key: 'rectangle', label: 'Прямоугольник', formula: 'S = a · b', description: 'Произведение длины на ширину.', color: '#22d3ee' },
  { key: 'parallelogram', label: 'Параллелограмм', formula: 'S = a · h', description: 'Сторона умножить на высоту.', color: '#4ade80' },
  { key: 'trapezoid', label: 'Трапеция', formula: 'S = ½(a+b) · h', description: 'Полусумма оснований на высоту.', color: '#f472b6' },
];

const vprTips = [
  { tip: 'При доказательстве равенства треугольников сначала найдите общую сторону — это «бесплатная» пара для любого признака.', tag: 'Треугольники' },
  { tip: 'Вертикальные углы всегда равны — используйте это как первый шаг в доказательствах.', tag: 'Углы' },
  { tip: 'Если даны два угла и сторона между ними — это признак СУС. Между углами — УСУ.', tag: 'Распознавание' },
  { tip: 'Площадь треугольника через основание и высоту: S = ½ah. Не забудьте делить на 2!', tag: 'Площадь' },
  { tip: 'Если секущая образует равные накрест лежащие углы — прямые параллельны.', tag: 'Параллельность' },
  { tip: 'Сумма углов треугольника всегда 180°. Если даны два угла, третий = 180° − ∠1 − ∠2.', tag: 'Углы' },
  { tip: 'Диаметр — самая длинная хорда окружности. D = 2R.', tag: 'Окружности' },
  { tip: 'Касательная к окружности перпендикулярна радиусу в точке касания. Это ключ к задачам с касательными.', tag: 'Окружности' },
];

const tabsConfig: { key: TabKey; label: string; icon: React.ReactNode }[] = [
  { key: 'angles', label: 'Углы', icon: <Maximize2 className="w-4 h-4" /> },
  { key: 'triangles', label: 'Треугольники', icon: <Triangle className="w-4 h-4" /> },
  { key: 'parallel', label: 'Параллельные', icon: <MoveDiagonal className="w-4 h-4" /> },
  { key: 'circles', label: 'Окружности', icon: <Circle className="w-4 h-4" /> },
  { key: 'area', label: 'Площади', icon: <Square className="w-4 h-4" /> },
  { key: 'tips', label: 'Советы', icon: <Lightbulb className="w-4 h-4" /> },
];

/* ================================================================
   SVG COMPONENTS
   ================================================================ */

/* --- 1. AnglesBlueprintSVG: Interactive angle diagram --- */
function AnglesBlueprintSVG({ activeAngle, onHover }: { activeAngle: AngleType | null; onHover: (a: AngleType | null) => void }) {
  const isHighlighted = (key: AngleType) => activeAngle === null || activeAngle === key;
  const angleOpacity = (key: AngleType) => (activeAngle === null ? 0.9 : activeAngle === key ? 1 : 0.15);

  return (
    <svg viewBox="0 0 400 280" className="w-full h-full" style={{ fontFamily: 'monospace' }}>
      <defs>
        <pattern id="gridA" width="20" height="20" patternUnits="userSpaceOnUse">
          <path d="M 20 0 L 0 0 0 20" fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth="1" />
        </pattern>
        <filter id="angleGlow">
          <feGaussianBlur stdDeviation="3" result="blur" />
          <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
      </defs>
      <rect width="100%" height="100%" fill="#001a33" />
      <rect width="100%" height="100%" fill="url(#gridA)" />

      {/* Vertical / Adjacent angle diagram */}
      <g onMouseEnter={() => onHover('vertical')} onMouseLeave={() => onHover(null)} className="cursor-pointer">
        <text x="20" y="25" fill={isHighlighted('vertical') ? '#22d3ee' : '#555'} fontSize="11" fontWeight="bold">ВЕРТИКАЛЬНЫЕ / СМЕЖНЫЕ</text>
        <line x1="80" y1="180" x2="200" y2="60" stroke="#fff" strokeWidth="2" strokeLinecap="round" opacity={angleOpacity('vertical')} />
        <line x1="80" y1="60" x2="200" y2="180" stroke="#fff" strokeWidth="2" strokeLinecap="round" opacity={angleOpacity('vertical')} />
        {/* Vertical angles (cyan) */}
        <motion.path d="M 120 120 Q 110 120 115 110" fill="none" stroke="#22d3ee" strokeWidth="2.5" opacity={angleOpacity('vertical')} filter={isHighlighted('vertical') ? 'url(#angleGlow)' : undefined}>
          <animate attributeName="stroke-dashoffset" from="20" to="0" dur="2s" repeatCount="indefinite" />
        </motion.path>
        <motion.path d="M 160 120 Q 170 120 165 130" fill="none" stroke="#22d3ee" strokeWidth="2.5" opacity={angleOpacity('vertical')} filter={isHighlighted('vertical') ? 'url(#angleGlow)' : undefined}>
          <animate attributeName="stroke-dashoffset" from="20" to="0" dur="2s" repeatCount="indefinite" />
        </motion.path>
        <text x="95" y="128" fill="#22d3ee" fontSize="13" opacity={angleOpacity('vertical')}>∠1</text>
        <text x="168" y="128" fill="#22d3ee" fontSize="13" opacity={angleOpacity('vertical')}>∠1</text>
        {/* Adjacent angles (yellow) */}
        <motion.path d="M 140 80 Q 140 68 152 74" fill="none" stroke="#facc15" strokeWidth="2.5" opacity={angleOpacity('adjacent')} filter={isHighlighted('adjacent') ? 'url(#angleGlow)' : undefined}>
          <animate attributeName="stroke-dashoffset" from="20" to="0" dur="2s" repeatCount="indefinite" />
        </motion.path>
        <text x="140" y="62" fill="#facc15" fontSize="13" opacity={angleOpacity('adjacent')}>∠2</text>
        {/* Labels */}
        {activeAngle === 'vertical' && (
          <motion.text initial={{ opacity: 0 }} animate={{ opacity: 1 }} x="80" y="260" fill="#22d3ee" fontSize="10">∠1 = ∠1 (вертикальные → всегда равны)</motion.text>
        )}
        {activeAngle === 'adjacent' && (
          <motion.text initial={{ opacity: 0 }} animate={{ opacity: 1 }} x="80" y="260" fill="#facc15" fontSize="10">∠1 + ∠2 = 180° (смежные → сумма 180°)</motion.text>
        )}
      </g>

      {/* Complementary angle diagram */}
      <g onMouseEnter={() => onHover('complementary')} onMouseLeave={() => onHover(null)} className="cursor-pointer">
        <text x="230" y="25" fill={isHighlighted('complementary') ? '#4ade80' : '#555'} fontSize="11" fontWeight="bold">ДОПОЛНИТЕЛЬНЫЕ</text>
        {/* Right angle mark */}
        <line x1="280" y1="160" x2="380" y2="160" stroke="#fff" strokeWidth="2" opacity={angleOpacity('complementary')} />
        <line x1="280" y1="160" x2="280" y2="60" stroke="#fff" strokeWidth="2" opacity={angleOpacity('complementary')} />
        <rect x="280" y="140" width="20" height="20" fill="none" stroke="#4ade80" strokeWidth="2" opacity={angleOpacity('complementary')} />
        {/* Angles */}
        <motion.path d="M 295 160 Q 310 148 320 158" fill="none" stroke="#4ade80" strokeWidth="2.5" opacity={angleOpacity('complementary')} />
        <text x="298" y="148" fill="#4ade80" fontSize="12" opacity={angleOpacity('complementary')}>α</text>
        <motion.path d="M 280 145 Q 268 130 278 118" fill="none" stroke="#22d3ee" strokeWidth="2.5" opacity={angleOpacity('complementary')} />
        <text x="260" y="130" fill="#22d3ee" fontSize="12" opacity={angleOpacity('complementary')}>β</text>
        {activeAngle === 'complementary' && (
          <motion.text initial={{ opacity: 0 }} animate={{ opacity: 1 }} x="250" y="195" fill="#4ade80" fontSize="10">α + β = 90° (дополнительные)</motion.text>
        )}
      </g>

      {/* Perpendicular lines */}
      <g onMouseEnter={() => onHover('perpendicular')} onMouseLeave={() => onHover(null)} className="cursor-pointer">
        <text x="250" y="220" fill={isHighlighted('perpendicular') ? '#f472b6' : '#555'} fontSize="11" fontWeight="bold">ПЕРПЕНДИКУЛЯР</text>
        <line x1="260" y1="250" x2="380" y2="250" stroke="#fff" strokeWidth="2" opacity={angleOpacity('perpendicular')} />
        <line x1="320" y1="250" x2="320" y2="210" stroke="#fff" strokeWidth="2" opacity={angleOpacity('perpendicular')} />
        <rect x="320" y="238" width="12" height="12" fill="none" stroke="#f472b6" strokeWidth="2" opacity={angleOpacity('perpendicular')} />
        <text x="336" y="248" fill="#f472b6" fontSize="11" opacity={angleOpacity('perpendicular')}>90°</text>
      </g>
    </svg>
  );
}

/* --- 2. TrianglesBlueprintSVG: Enhanced with animated dashed lines --- */
function TrianglesBlueprintSVG({ activeRule, onHover }: { activeRule: TriangleRule | null; onHover: (r: TriangleRule | null) => void }) {
  const ruleOpacity = (key: TriangleRule) => (activeRule === null ? 1 : activeRule === key ? 1 : 0.2);
  const dashAnim = 'stroke-dashoffset: 0;';

  return (
    <svg viewBox="0 0 440 220" className="w-full h-full">
      <defs>
        <pattern id="gridT" width="20" height="20" patternUnits="userSpaceOnUse">
          <path d="M 20 0 L 0 0 0 20" fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth="1" />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="#001a33" />
      <rect width="100%" height="100%" fill="url(#gridT)" />

      {/* Triangle 1 — СУС */}
      <g transform="translate(20, 30)" onMouseEnter={() => onHover('sus')} onMouseLeave={() => onHover(null)} className="cursor-pointer">
        <polygon points="0,100 50,0 100,100" fill="rgba(255,255,255,0.05)" stroke="#facc15" strokeWidth="2" opacity={ruleOpacity('sus')} />
        {/* Sides */}
        <line x1="0" y1="100" x2="50" y2="0" stroke="#facc15" strokeWidth="3" opacity={ruleOpacity('sus')} strokeLinecap="round" />
        <line x1="50" y1="0" x2="100" y2="100" stroke="#facc15" strokeWidth="3" opacity={ruleOpacity('sus')} strokeLinecap="round" />
        <line x1="0" y1="100" x2="100" y2="100" stroke="#fff" strokeWidth="1.5" opacity={ruleOpacity('sus')} strokeDasharray="4,3">
          <animate attributeName="stroke-dashoffset" from="14" to="0" dur="2s" repeatCount="indefinite" />
        </line>
        {/* Angle marking at top */}
        <path d="M 35 15 Q 50 5 65 15" fill="none" stroke="#22d3ee" strokeWidth="2" opacity={ruleOpacity('sus')} />
        {/* Side tick marks */}
        <line x1="22" y1="54" x2="28" y2="48" stroke="#facc15" strokeWidth="2.5" opacity={ruleOpacity('sus')} />
        <line x1="22" y1="52" x2="28" y2="46" stroke="#facc15" strokeWidth="2.5" opacity={ruleOpacity('sus')} />
        <line x1="72" y1="48" x2="78" y2="54" stroke="#facc15" strokeWidth="2.5" opacity={ruleOpacity('sus')} />
        <line x1="72" y1="46" x2="78" y2="52" stroke="#facc15" strokeWidth="2.5" opacity={ruleOpacity('sus')} />
        <text x="30" y="130" fill="#facc15" fontSize="14" fontWeight="bold" opacity={ruleOpacity('sus')}>I. СУС</text>
        <text x="5" y="148" fill="#aaa" fontSize="10" opacity={ruleOpacity('sus')}>2 стороны + угол</text>
      </g>

      {/* Triangle 2 — УСУ */}
      <g transform="translate(160, 30)" onMouseEnter={() => onHover('usu')} onMouseLeave={() => onHover(null)} className="cursor-pointer">
        <polygon points="0,100 50,0 100,100" fill="rgba(255,255,255,0.05)" stroke="#22d3ee" strokeWidth="2" opacity={ruleOpacity('usu')} />
        <line x1="0" y1="100" x2="50" y2="0" stroke="#22d3ee" strokeWidth="3" opacity={ruleOpacity('usu')} strokeLinecap="round" />
        <line x1="50" y1="0" x2="100" y2="100" stroke="#fff" strokeWidth="1.5" opacity={ruleOpacity('usu')} strokeDasharray="4,3">
          <animate attributeName="stroke-dashoffset" from="14" to="0" dur="2s" repeatCount="indefinite" />
        </line>
        <line x1="0" y1="100" x2="100" y2="100" stroke="#fff" strokeWidth="1.5" opacity={ruleOpacity('usu')} strokeDasharray="4,3">
          <animate attributeName="stroke-dashoffset" from="14" to="0" dur="2s" repeatCount="indefinite" />
        </line>
        {/* Angle markings */}
        <path d="M 10 90 Q 20 80 30 100" fill="none" stroke="#22d3ee" strokeWidth="2" opacity={ruleOpacity('usu')} />
        <path d="M 70 100 Q 80 80 90 90" fill="none" stroke="#22d3ee" strokeWidth="2" opacity={ruleOpacity('usu')} />
        {/* Side tick */}
        <line x1="45" y1="98" x2="55" y2="102" stroke="#22d3ee" strokeWidth="2.5" opacity={ruleOpacity('usu')} />
        <text x="22" y="130" fill="#22d3ee" fontSize="14" fontWeight="bold" opacity={ruleOpacity('usu')}>II. УСУ</text>
        <text x="2" y="148" fill="#aaa" fontSize="10" opacity={ruleOpacity('usu')}>Сторона + 2 угла</text>
      </g>

      {/* Triangle 3 — ССС */}
      <g transform="translate(300, 30)" onMouseEnter={() => onHover('sss')} onMouseLeave={() => onHover(null)} className="cursor-pointer">
        <polygon points="0,100 50,0 100,100" fill="rgba(255,255,255,0.05)" stroke="#f472b6" strokeWidth="2" opacity={ruleOpacity('sss')} />
        <line x1="0" y1="100" x2="50" y2="0" stroke="#f472b6" strokeWidth="3" opacity={ruleOpacity('sss')} strokeLinecap="round" />
        <line x1="50" y1="0" x2="100" y2="100" stroke="#f472b6" strokeWidth="3" opacity={ruleOpacity('sss')} strokeLinecap="round" />
        <line x1="0" y1="100" x2="100" y2="100" stroke="#f472b6" strokeWidth="3" opacity={ruleOpacity('sss')} strokeLinecap="round" />
        {/* Side ticks */}
        <line x1="22" y1="54" x2="28" y2="48" stroke="#f472b6" strokeWidth="2.5" opacity={ruleOpacity('sss')} />
        <line x1="72" y1="48" x2="78" y2="54" stroke="#f472b6" strokeWidth="2.5" opacity={ruleOpacity('sss')} />
        <line x1="48" y1="104" x2="52" y2="96" stroke="#f472b6" strokeWidth="2.5" opacity={ruleOpacity('sss')} />
        <text x="15" y="130" fill="#f472b6" fontSize="14" fontWeight="bold" opacity={ruleOpacity('sss')}>III. ССС</text>
        <text x="2" y="148" fill="#aaa" fontSize="10" opacity={ruleOpacity('sss')}>3 стороны</text>
      </g>

      {/* Bottom formula */}
      <text x="220" y="210" textAnchor="middle" fill="#fff" fontSize="12" opacity="0.5">
        {activeRule === null ? 'Наведите на треугольник для подробностей' :
          activeRule === 'sus' ? 'СУС: сторона, угол, сторона' :
          activeRule === 'usu' ? 'УСУ: угол, сторона, угол' :
          'ССС: сторона, сторона, сторона'}
      </text>
    </svg>
  );
}

/* --- 3. ParallelBlueprintSVG: Animated parallel lines --- */
function ParallelBlueprintSVG() {
  return (
    <svg viewBox="0 0 380 260" className="w-full h-full">
      <defs>
        <pattern id="gridP" width="20" height="20" patternUnits="userSpaceOnUse">
          <path d="M 20 0 L 0 0 0 20" fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth="1" />
        </pattern>
        <marker id="arrowB" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
          <path d="M0,0 L8,3 L0,6 Z" fill="#f87171" />
        </marker>
      </defs>
      <rect width="100%" height="100%" fill="#001a33" />
      <rect width="100%" height="100%" fill="url(#gridP)" />

      {/* Animated parallel indicator arrows */}
      <motion.g animate={{ x: [0, 8, 0] }} transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}>
        <line x1="20" y1="80" x2="340" y2="80" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" />
        <text x="345" y="85" fill="#fff" fontSize="13" fontWeight="bold">a</text>
      </motion.g>
      <motion.g animate={{ x: [0, 8, 0] }} transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}>
        <line x1="20" y1="180" x2="340" y2="180" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" />
        <text x="345" y="185" fill="#fff" fontSize="13" fontWeight="bold">b</text>
      </motion.g>

      {/* Parallel marks */}
      <text x="12" y="85" fill="#4ade80" fontSize="14" fontWeight="bold">›</text>
      <text x="12" y="185" fill="#4ade80" fontSize="14" fontWeight="bold">›</text>

      {/* Transversal c */}
      <line x1="100" y1="30" x2="280" y2="230" stroke="#f87171" strokeWidth="2.5" strokeLinecap="round" markerEnd="url(#arrowB)" />
      <text x="285" y="240" fill="#f87171" fontSize="13" fontWeight="bold">c</text>

      {/* Alternate (Z) angles — green */}
      <motion.path d="M 170 80 Q 182 80 176 92" fill="none" stroke="#4ade80" strokeWidth="2.5" opacity={0.9}>
        <animate attributeName="opacity" values="0.5;1;0.5" dur="2s" repeatCount="indefinite" />
      </motion.path>
      <motion.path d="M 210 180 Q 198 180 204 168" fill="none" stroke="#4ade80" strokeWidth="2.5" opacity={0.9}>
        <animate attributeName="opacity" values="0.5;1;0.5" dur="2s" repeatCount="indefinite" />
      </motion.path>
      <text x="10" y="45" fill="#4ade80" fontSize="12" fontWeight="bold">● Накрест лежащие (Z) =</text>

      {/* Corresponding angles — yellow */}
      <motion.circle cx="150" cy="72" r="4" fill="#facc15">
        <animate attributeName="r" values="3;5;3" dur="1.5s" repeatCount="indefinite" />
      </motion.circle>
      <motion.circle cx="230" cy="172" r="4" fill="#facc15">
        <animate attributeName="r" values="3;5;3" dur="1.5s" repeatCount="indefinite" />
      </motion.circle>
      <text x="120" y="45" fill="#facc15" fontSize="12" fontWeight="bold">● Соответственные (F) =</text>

      {/* Same-side angles — orange */}
      <motion.path d="M 195 80 Q 210 90 200 95" fill="none" stroke="#fb923c" strokeWidth="2" strokeDasharray="3,2">
        <animate attributeName="opacity" values="0.4;1;0.4" dur="2s" repeatCount="indefinite" />
      </motion.path>
      <motion.path d="M 240 180 Q 225 170 235 165" fill="none" stroke="#fb923c" strokeWidth="2" strokeDasharray="3,2">
        <animate attributeName="opacity" values="0.4;1;0.4" dur="2s" repeatCount="indefinite" />
      </motion.path>
      <text x="220" y="45" fill="#fb923c" fontSize="12" fontWeight="bold">● Односторонние = 180°</text>

      {/* a ∥ b label */}
      <text x="180" y="255" textAnchor="middle" fill="#fff" fontSize="11" opacity="0.4">a ∥ b, если накрест лежащие равны или соответственные равны или сумма односторонних = 180°</text>
    </svg>
  );
}

/* --- 4. CircleTheoremsSVG: Interactive circle parts --- */
function CircleTheoremsSVG({ activePart, onHover }: { activePart: CirclePart | null; onHover: (p: CirclePart | null) => void }) {
  const isHighlighted = (key: CirclePart) => activePart === null || activePart === key;
  const partOpacity = (key: CirclePart) => (activePart === null ? 0.9 : activePart === key ? 1 : 0.12);

  return (
    <svg viewBox="0 0 400 320" className="w-full h-full">
      <defs>
        <pattern id="gridC" width="20" height="20" patternUnits="userSpaceOnUse">
          <path d="M 20 0 L 0 0 0 20" fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth="1" />
        </pattern>
        <filter id="circleGlow">
          <feGaussianBlur stdDeviation="4" result="blur" />
          <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
      </defs>
      <rect width="100%" height="100%" fill="#001a33" />
      <rect width="100%" height="100%" fill="url(#gridC)" />

      {/* Main circle */}
      <circle cx="180" cy="155" r="110" fill="none" stroke="#fff" strokeWidth="2" opacity="0.5" />
      {/* Center point */}
      <circle cx="180" cy="155" r="4" fill="#fff" opacity="0.8">
        <animate attributeName="r" values="3;5;3" dur="2s" repeatCount="indefinite" />
      </circle>
      <text x="188" y="162" fill="#fff" fontSize="10" opacity="0.6">O</text>

      {/* Radius — cyan */}
      <g onMouseEnter={() => onHover('radius')} onMouseLeave={() => onHover(null)} className="cursor-pointer">
        <line x1="180" y1="155" x2="280" y2="100" stroke="#22d3ee" strokeWidth="2.5" opacity={partOpacity('radius')} filter={isHighlighted('radius') ? 'url(#circleGlow)' : undefined} />
        <circle cx="280" cy="100" r="3" fill="#22d3ee" opacity={partOpacity('radius')} />
        <text x="225" y="118" fill="#22d3ee" fontSize="11" fontWeight="bold" opacity={partOpacity('radius')}>R</text>
      </g>

      {/* Diameter — yellow */}
      <g onMouseEnter={() => onHover('diameter')} onMouseLeave={() => onHover(null)} className="cursor-pointer">
        <line x1="70" y1="155" x2="290" y2="155" stroke="#facc15" strokeWidth="3" opacity={partOpacity('diameter')} filter={isHighlighted('diameter') ? 'url(#circleGlow)' : undefined} />
        <circle cx="70" cy="155" r="3" fill="#facc15" opacity={partOpacity('diameter')} />
        <circle cx="290" cy="155" r="3" fill="#facc15" opacity={partOpacity('diameter')} />
        <text x="172" y="172" fill="#facc15" fontSize="11" fontWeight="bold" opacity={partOpacity('diameter')}>d = 2R</text>
      </g>

      {/* Chord — green */}
      <g onMouseEnter={() => onHover('chord')} onMouseLeave={() => onHover(null)} className="cursor-pointer">
        <line x1="110" y1="230" x2="260" y2="230" stroke="#4ade80" strokeWidth="2.5" opacity={partOpacity('chord')} filter={isHighlighted('chord') ? 'url(#circleGlow)' : undefined} />
        <circle cx="110" cy="230" r="3" fill="#4ade80" opacity={partOpacity('chord')} />
        <circle cx="260" cy="230" r="3" fill="#4ade80" opacity={partOpacity('chord')} />
        <text x="178" y="250" fill="#4ade80" fontSize="10" fontWeight="bold" opacity={partOpacity('chord')}>хорда</text>
      </g>

      {/* Tangent — pink */}
      <g onMouseEnter={() => onHover('tangent')} onMouseLeave={() => onHover(null)} className="cursor-pointer">
        <line x1="290" y1="80" x2="290" y2="190" stroke="#f472b6" strokeWidth="2.5" opacity={partOpacity('tangent')} filter={isHighlighted('tangent') ? 'url(#circleGlow)' : undefined} />
        <circle cx="290" cy="120" r="3" fill="#f472b6" opacity={partOpacity('tangent')} />
        <text x="298" y="135" fill="#f472b6" fontSize="10" fontWeight="bold" opacity={partOpacity('tangent')}>t</text>
        {/* Perpendicular mark at tangent point */}
        <rect x="284" y="114" width="6" height="6" fill="none" stroke="#f472b6" strokeWidth="1.5" opacity={partOpacity('tangent')} />
      </g>

      {/* Central angle — orange */}
      <g onMouseEnter={() => onHover('central')} onMouseLeave={() => onHover(null)} className="cursor-pointer">
        <line x1="180" y1="155" x2="80" y2="100" stroke="#fb923c" strokeWidth="2" opacity={partOpacity('central')} />
        <line x1="180" y1="155" x2="180" y2="45" stroke="#fb923c" strokeWidth="2" opacity={partOpacity('central')} />
        <path d="M 180 130 A 25 25 0 0 1 165 143" fill="rgba(251,146,60,0.2)" stroke="#fb923c" strokeWidth="2" opacity={partOpacity('central')} />
        <text x="155" y="120" fill="#fb923c" fontSize="10" fontWeight="bold" opacity={partOpacity('central')}>∠α</text>
      </g>

      {/* Arc — purple */}
      <g onMouseEnter={() => onHover('arc')} onMouseLeave={() => onHover(null)} className="cursor-pointer">
        <path d="M 80 100 A 110 110 0 0 1 180 45" fill="none" stroke="#a78bfa" strokeWidth="3" strokeDasharray="6,3" opacity={partOpacity('arc')} filter={isHighlighted('arc') ? 'url(#circleGlow)' : undefined}>
          <animate attributeName="stroke-dashoffset" from="18" to="0" dur="2s" repeatCount="indefinite" />
        </path>
        <text x="115" y="55" fill="#a78bfa" fontSize="10" fontWeight="bold" opacity={partOpacity('arc')}>дуга</text>
      </g>

      {/* Active part info */}
      {activePart && (
        <motion.g initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
          <rect x="5" y="275" width="390" height="35" rx="8" fill="rgba(0,0,0,0.5)" stroke={circlePartsData.find((p) => p.key === activePart)?.color} strokeWidth="1" />
          <text x="200" y="296" textAnchor="middle" fill={circlePartsData.find((p) => p.key === activePart)?.color} fontSize="11" fontWeight="bold">
            {circlePartsData.find((p) => p.key === activePart)?.label}: {circlePartsData.find((p) => p.key === activePart)?.description}
          </text>
        </motion.g>
      )}
      {!activePart && (
        <text x="200" y="305" textAnchor="middle" fill="#fff" fontSize="11" opacity="0.4">
          Наведите на элемент для описания
        </text>
      )}
    </svg>
  );
}

/* --- 5. AreaFormulasSVG: Visual formulas with animated fill --- */
function AreaFormulasSVG({ activeShape }: { activeShape: AreaShape | null }) {
  const isActive = (key: AreaShape) => activeShape === null || activeShape === key;
  const shapeOpacity = (key: AreaShape) => (activeShape === null ? 0.9 : activeShape === key ? 1 : 0.15);

  return (
    <svg viewBox="0 0 440 280" className="w-full h-full">
      <defs>
        <pattern id="gridAr" width="20" height="20" patternUnits="userSpaceOnUse">
          <path d="M 20 0 L 0 0 0 20" fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth="1" />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="#001a33" />
      <rect width="100%" height="100%" fill="url(#gridAr)" />

      {/* Triangle */}
      <g transform="translate(20, 30)" opacity={shapeOpacity('triangle')}>
        <text x="50" y="0" textAnchor="middle" fill="#facc15" fontSize="10" fontWeight="bold">ТРЕУГОЛЬНИК</text>
        <polygon points="50,20 10,120 90,120" fill="rgba(250,204,21,0.1)" stroke="#facc15" strokeWidth="2">
          <animate attributeName="fill-opacity" values="0.05;0.2;0.05" dur="3s" repeatCount="indefinite" />
        </polygon>
        {/* Height dashed */}
        <line x1="50" y1="20" x2="50" y2="120" stroke="#facc15" strokeWidth="1.5" strokeDasharray="4,3" />
        <text x="56" y="75" fill="#facc15" fontSize="9">h</text>
        {/* Base label */}
        <text x="50" y="135" textAnchor="middle" fill="#facc15" fontSize="9">a</text>
        <text x="50" y="155" textAnchor="middle" fill="#fff" fontSize="10" fontWeight="bold">S = ½·a·h</text>
      </g>

      {/* Rectangle */}
      <g transform="translate(130, 30)" opacity={shapeOpacity('rectangle')}>
        <text x="45" y="0" textAnchor="middle" fill="#22d3ee" fontSize="10" fontWeight="bold">ПРЯМОУГОЛЬНИК</text>
        <rect x="5" y="20" width="80" height="50" fill="rgba(34,211,238,0.1)" stroke="#22d3ee" strokeWidth="2">
          <animate attributeName="fill-opacity" values="0.05;0.2;0.05" dur="3s" repeatCount="indefinite" begin="0.5s" />
        </rect>
        <text x="45" y="50" textAnchor="middle" fill="#22d3ee" fontSize="9">b</text>
        <text x="-2" y="50" textAnchor="end" fill="#22d3ee" fontSize="9">a</text>
        <text x="45" y="95" textAnchor="middle" fill="#fff" fontSize="10" fontWeight="bold">S = a·b</text>
      </g>

      {/* Parallelogram */}
      <g transform="translate(240, 30)" opacity={shapeOpacity('parallelogram')}>
        <text x="50" y="0" textAnchor="middle" fill="#4ade80" fontSize="10" fontWeight="bold">ПАРАЛЛЕЛОГРАММ</text>
        <polygon points="25,20 95,20 75,70 5,70" fill="rgba(74,222,128,0.1)" stroke="#4ade80" strokeWidth="2">
          <animate attributeName="fill-opacity" values="0.05;0.2;0.05" dur="3s" repeatCount="indefinite" begin="1s" />
        </polygon>
        {/* Height */}
        <line x1="25" y1="20" x2="25" y2="70" stroke="#4ade80" strokeWidth="1.5" strokeDasharray="4,3" />
        <text x="10" y="50" textAnchor="end" fill="#4ade80" fontSize="9">h</text>
        <text x="50" y="90" textAnchor="middle" fill="#fff" fontSize="10" fontWeight="bold">S = a·h</text>
      </g>

      {/* Trapezoid */}
      <g transform="translate(350, 30)" opacity={shapeOpacity('trapezoid')}>
        <text x="40" y="0" textAnchor="middle" fill="#f472b6" fontSize="10" fontWeight="bold">ТРАПЕЦИЯ</text>
        <polygon points="15,20 65,20 80,70 0,70" fill="rgba(244,114,182,0.1)" stroke="#f472b6" strokeWidth="2">
          <animate attributeName="fill-opacity" values="0.05;0.2;0.05" dur="3s" repeatCount="indefinite" begin="1.5s" />
        </polygon>
        {/* Height */}
        <line x1="15" y1="20" x2="15" y2="70" stroke="#f472b6" strokeWidth="1.5" strokeDasharray="4,3" />
        <text x="5" y="50" textAnchor="end" fill="#f472b6" fontSize="9">h</text>
        <text x="40" y="90" textAnchor="middle" fill="#fff" fontSize="10" fontWeight="bold">S = ½(a+b)·h</text>
      </g>

      {/* Key formulas at bottom */}
      <rect x="20" y="160" width="400" height="110" rx="8" fill="rgba(0,0,0,0.3)" stroke="rgba(255,255,255,0.1)" strokeWidth="1" />
      <text x="220" y="182" textAnchor="middle" fill="#fff" fontSize="11" fontWeight="bold" opacity="0.7">КЛЮЧЕВЫЕ ФОРМУЛЫ ПЛОЩАДЕЙ</text>

      {areaFormulasData.map((f, i) => (
        <g key={f.key} transform={`translate(${40 + i * 100}, 195)`}>
          <rect x="0" y="0" width="85" height="60" rx="6" fill={f.color + '15'} stroke={f.color + '40'} strokeWidth="1" />
          <text x="42" y="18" textAnchor="middle" fill={f.color} fontSize="9" fontWeight="bold">{f.label}</text>
          <text x="42" y="38" textAnchor="middle" fill="#fff" fontSize="12" fontWeight="bold">{f.formula}</text>
          <text x="42" y="52" textAnchor="middle" fill="#aaa" fontSize="8">{f.description}</text>
        </g>
      ))}
    </svg>
  );
}

/* ================================================================
   BACKGROUND PATTERN
   ================================================================ */

function BackgroundPattern() {
  return (
    <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
      {/* Grid */}
      <div className="absolute inset-0 opacity-[0.03]" style={{
        backgroundImage: 'linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)',
        backgroundSize: '20px 20px',
      }} />
      {/* Blur glow orbs */}
      <div className="absolute top-20 -left-32 w-96 h-96 bg-cyan-600/10 rounded-full blur-[120px]" />
      <div className="absolute bottom-40 -right-32 w-80 h-80 bg-blue-500/8 rounded-full blur-[140px]" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-blue-900/5 rounded-full blur-[200px]" />
    </div>
  );
}

/* ================================================================
   SECTION HEADER COMPONENT
   ================================================================ */

function SectionHeader({ number, title, subtitle }: { number: number; title: string; subtitle: string }) {
  return (
    <div className="flex items-center gap-4 mb-8">
      <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-gradient-to-br from-cyan-500/20 to-blue-600/10 border border-cyan-500/30 text-cyan-400 shrink-0 font-bold text-lg">
        {String(number).padStart(2, '0')}
      </div>
      <div>
        <h2 className="text-2xl sm:text-3xl font-bold text-cyan-100">{title}</h2>
        <p className="text-cyan-300/60 text-sm mt-0.5">{subtitle}</p>
      </div>
    </div>
  );
}

/* ================================================================
   EXPANDABLE CARD COMPONENT
   ================================================================ */

function ExpandableCard({ title, children, defaultOpen = false }: { title: string; children: React.ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="bg-[#001a33] rounded-xl border border-cyan-400/20 overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between p-4 sm:p-5 text-left hover:bg-cyan-900/10 transition-colors"
      >
        <span className="text-cyan-100 font-semibold text-base sm:text-lg">{title}</span>
        <motion.div animate={{ rotate: open ? 180 : 0 }} transition={{ duration: 0.2 }}>
          {open ? <ChevronUp className="w-5 h-5 text-cyan-400" /> : <ChevronDown className="w-5 h-5 text-cyan-400" />}
        </motion.div>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: 'easeInOut' }}
            className="overflow-hidden"
          >
            <div className="px-4 sm:px-5 pb-4 sm:pb-5 pt-1">
              {children}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ================================================================
   FORMULA BOX COMPONENT
   ================================================================ */

function FormulaBox({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-black/30 p-3 sm:p-4 rounded-lg border border-cyan-500/30 font-mono text-cyan-300 text-lg sm:text-xl text-center">
      {children}
    </div>
  );
}

/* ================================================================
   MAIN COMPONENT
   ================================================================ */

export default function Geometry7Cheatsheet() {
  /* Interactive states */
  const [activeTab, setActiveTab] = useState<TabKey>('angles');
  const [activeAngle, setActiveAngle] = useState<AngleType | null>(null);
  const [activeTriangle, setActiveTriangle] = useState<TriangleRule | null>(null);
  const [activeCirclePart, setActiveCirclePart] = useState<CirclePart | null>(null);
  const [activeAreaShape, setActiveAreaShape] = useState<AreaShape | null>(null);
  const [expandedFormula, setExpandedFormula] = useState<string | null>(null);

  const sectionVariants = {
    hidden: { opacity: 0, y: 40 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: 'easeOut' } },
  };

  return (
    <div className="min-h-screen bg-[#001a33] text-white relative overflow-hidden">
      <BackgroundPattern />

      <div className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
        {/* ===== BACK LINK ===== */}
        <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.4 }}>
          <Link
            href="/vpr-tests"
            className="inline-flex items-center gap-2 text-cyan-300/70 hover:text-cyan-200 transition-colors mb-8 group"
          >
            <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
            Назад к тестам ВПР
          </Link>
        </motion.div>

        {/* ===== HERO HEADER ===== */}
        <motion.header
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7 }}
          className="text-center mb-12"
        >
          {/* Hero SVG — compass icon */}
          <div className="flex justify-center mb-6">
            <motion.svg viewBox="0 0 200 120" className="w-48 sm:w-64 h-auto" initial={{ scale: 0, rotate: -180 }} animate={{ scale: 1, rotate: 0 }} transition={{ type: 'spring', delay: 0.3 }}>
              <defs>
                <linearGradient id="heroGrad" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stopColor="#22d3ee" />
                  <stop offset="100%" stopColor="#0284c7" />
                </linearGradient>
              </defs>
              {/* Outer ring */}
              <circle cx="100" cy="60" r="50" fill="none" stroke="url(#heroGrad)" strokeWidth="2" opacity="0.4">
                <animateTransform attributeName="transform" type="rotate" from="0 100 60" to="360 100 60" dur="30s" repeatCount="indefinite" />
              </circle>
              <circle cx="100" cy="60" r="40" fill="none" stroke="#22d3ee" strokeWidth="1" opacity="0.2">
                <animateTransform attributeName="transform" type="rotate" from="360 100 60" to="0 100 60" dur="25s" repeatCount="indefinite" />
              </circle>
              {/* Compass needle */}
              <motion.polygon
                animate={{ rotate: [0, 10, -10, 0] }}
                transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
                points="100,15 95,65 100,60 105,65"
                fill="#22d3ee" opacity="0.8"
                style={{ transformOrigin: '100px 60px' }}
              />
              <motion.polygon
                animate={{ rotate: [0, -10, 10, 0] }}
                transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
                points="100,105 95,55 100,60 105,55"
                fill="#facc15" opacity="0.6"
                style={{ transformOrigin: '100px 60px' }}
              />
              {/* Center dot */}
              <circle cx="100" cy="60" r="4" fill="#22d3ee" />
              <circle cx="100" cy="60" r="2" fill="#fff" />
              {/* Degree marks */}
              {[0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330].map((deg, i) => (
                <line
                  key={i}
                  x1={100 + 38 * Math.cos((deg * Math.PI) / 180)}
                  y1={60 + 38 * Math.sin((deg * Math.PI) / 180)}
                  x2={100 + 42 * Math.cos((deg * Math.PI) / 180)}
                  y2={60 + 42 * Math.sin((deg * Math.PI) / 180)}
                  stroke="#22d3ee" strokeWidth="1" opacity="0.3"
                />
              ))}
            </motion.svg>
          </div>

          <div className="inline-block mb-4 px-4 py-1.5 rounded-full bg-gradient-to-r from-cyan-500/20 to-blue-500/20 border border-cyan-500/30 text-cyan-300 text-sm font-medium">
            PROJECT: VPR-7
          </div>

          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
            className="text-4xl sm:text-5xl lg:text-6xl font-black bg-gradient-to-r from-cyan-300 via-blue-400 to-cyan-500 bg-clip-text text-transparent mb-4 leading-tight tracking-widest font-mono"
          >
            BLUEPRINT GEO
          </motion.h1>

          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.8 }}
            className="text-cyan-200/50 text-base sm:text-lg max-w-2xl mx-auto font-mono"
          >
            Инженерная шпаргалка // Геометрия 7 класс
          </motion.p>

          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1 }}
            className="flex flex-wrap justify-center gap-3 mt-6"
          >
            {['Геометрия', '7 класс', 'ВПР', 'Чертежи'].map((tag) => (
              <span key={tag} className="px-3 py-1 bg-cyan-950/50 border border-cyan-800/30 rounded-full text-xs text-cyan-500 font-mono">
                {tag}
              </span>
            ))}
          </motion.div>
        </motion.header>

        {/* ===== SECTION NAVIGATION TABS ===== */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.2 }}
          className="mb-12"
        >
          <div className="flex gap-2 flex-wrap justify-center">
            {tabsConfig.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${
                  activeTab === tab.key
                    ? 'bg-cyan-500 text-white shadow-lg shadow-cyan-500/25'
                    : 'bg-[#002244] border border-cyan-400/20 text-cyan-300/70 hover:text-cyan-200 hover:border-cyan-500/40'
                }`}
              >
                {tab.icon}
                <span className="hidden sm:inline">{tab.label}</span>
              </button>
            ))}
          </div>
        </motion.section>

        {/* ===== TAB CONTENT ===== */}
        <AnimatePresence mode="wait">
          {/* TAB: ANGLES */}
          {activeTab === 'angles' && (
            <motion.section
              key="angles"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.3 }}
              className="mb-16"
            >
              <SectionHeader number={1} title="Базовые углы" subtitle="Вертикальные, смежные и другие типы углов" />

              <div className="grid md:grid-cols-2 gap-6 mb-8">
                {/* Interactive SVG */}
                <div className="border-2 border-cyan-400/20 rounded-xl overflow-hidden h-72 sm:h-80 bg-[#001a33]">
                  <AnglesBlueprintSVG activeAngle={activeAngle} onHover={setActiveAngle} />
                </div>

                {/* Angle type cards */}
                <div className="space-y-3 max-h-[320px] overflow-y-auto pr-2" style={{ scrollbarWidth: 'thin', scrollbarColor: '#0e7490 transparent' }}>
                  {angleTypesData.map((angle, i) => (
                    <motion.div
                      key={angle.key}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.08 }}
                      whileHover={{ scale: 1.02 }}
                      onMouseEnter={() => setActiveAngle(angle.key)}
                      onMouseLeave={() => setActiveAngle(null)}
                      className={`bg-[#002244] rounded-xl border p-4 cursor-pointer transition-all ${
                        activeAngle === angle.key
                          ? 'border-opacity-60 shadow-lg'
                          : 'border-white/10 hover:border-white/20'
                      }`}
                      style={{ borderColor: activeAngle === angle.key ? angle.color + '80' : undefined }}
                    >
                      <div className="flex items-center gap-3 mb-2">
                        <span className="text-xs font-bold px-2 py-0.5 rounded" style={{ backgroundColor: angle.color + '20', color: angle.color }}>
                          {angle.badge}
                        </span>
                        <h3 className="font-bold text-base" style={{ color: angle.color }}>{angle.label}</h3>
                      </div>
                      <p className="text-cyan-100/70 text-sm mb-2">{angle.description}</p>
                      <div className="font-mono text-sm bg-black/30 px-3 py-1.5 rounded-lg text-center border" style={{ borderColor: angle.color + '30', color: angle.color }}>
                        {angle.formula}
                      </div>
                    </motion.div>
                  ))}
                </div>
              </div>

              <ExpandableCard title="Полная справка по углам" defaultOpen>
                <div className="grid sm:grid-cols-2 gap-4">
                  <div className="border-l-4 border-yellow-400 pl-4 py-2 bg-white/5 rounded-r-lg">
                    <h3 className="text-lg font-bold text-yellow-400 mb-2 flex items-center gap-2">
                      Смежные углы <span className="text-xs bg-yellow-400 text-black px-1.5 rounded font-mono">180°</span>
                    </h3>
                    <p className="text-cyan-100/80 text-sm mb-2">Соседи на одной прямой. У них одна стена общая, а пол — прямая линия.</p>
                    <div className="font-mono text-lg bg-black/30 p-2 rounded text-center border border-yellow-400/30">∠1 + ∠2 = 180°</div>
                  </div>
                  <div className="border-l-4 border-cyan-400 pl-4 py-2 bg-white/5 rounded-r-lg">
                    <h3 className="text-lg font-bold text-cyan-400 mb-2 flex items-center gap-2">
                      Вертикальные углы <span className="text-xs bg-cyan-400 text-black px-1.5 rounded font-mono">=</span>
                    </h3>
                    <p className="text-cyan-100/80 text-sm mb-2">Как раскрытые ножницы. Смотрят друг на друга и всегда равны.</p>
                    <div className="font-mono text-lg bg-black/30 p-2 rounded text-center border border-cyan-400/30">∠1 = ∠3</div>
                  </div>
                </div>
              </ExpandableCard>
            </motion.section>
          )}

          {/* TAB: TRIANGLES */}
          {activeTab === 'triangles' && (
            <motion.section
              key="triangles"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.3 }}
              className="mb-16"
            >
              <SectionHeader number={2} title="Равенство треугольников" subtitle="Три признака равенства треугольников" />

              {/* Interactive Triangle SVG */}
              <div className="border-2 border-cyan-400/20 rounded-xl overflow-hidden h-64 sm:h-72 mb-8 bg-[#001a33]">
                <TrianglesBlueprintSVG activeRule={activeTriangle} onHover={setActiveTriangle} />
              </div>

              {/* Rule cards */}
              <div className="grid md:grid-cols-3 gap-4 mb-8">
                {triangleRulesData.map((rule, i) => (
                  <motion.div
                    key={rule.key}
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: i * 0.15 }}
                    whileHover={{ scale: 1.03, y: -4 }}
                    onMouseEnter={() => setActiveTriangle(rule.key)}
                    onMouseLeave={() => setActiveTriangle(null)}
                    className={`bg-[#002244] rounded-xl border p-5 cursor-pointer transition-all ${
                      activeTriangle === rule.key
                        ? 'border-opacity-60 shadow-lg'
                        : 'border-white/10 hover:border-white/20'
                    }`}
                    style={{ borderColor: activeTriangle === rule.key ? rule.color + '80' : undefined }}
                  >
                    <div className="text-xl font-bold mb-2" style={{ color: rule.color }}>{rule.label}</div>
                    <div className="h-0.5 w-10 mb-3 rounded" style={{ backgroundColor: rule.color }} />
                    <p className="text-sm text-cyan-100/70 mb-3">{rule.description}</p>
                    <div className="text-xs text-cyan-200/50 font-mono bg-black/20 p-2 rounded-lg border border-white/5">
                      {rule.example}
                    </div>
                  </motion.div>
                ))}
              </div>

              <ExpandableCard title="Примеры решения задач">
                <div className="space-y-4">
                  <div className="p-3 bg-black/20 rounded-lg border border-cyan-900/30">
                    <p className="text-cyan-200 font-semibold text-sm mb-1">Задача: Дано △ABC и △A₁B₁C₁. AB = A₁B₁, ∠A = ∠A₁, AC = A₁C₁. Доказать: △ABC = △A₁B₁C₁</p>
                    <p className="text-cyan-100/60 text-sm">Решение: По I признаку (СУС) — две стороны и угол между ними равны. Следовательно, △ABC = △A₁B₁C₁.</p>
                  </div>
                  <div className="p-3 bg-black/20 rounded-lg border border-cyan-900/30">
                    <p className="text-cyan-200 font-semibold text-sm mb-1">Сумма углов треугольника</p>
                    <p className="text-cyan-100/60 text-sm">∠A + ∠B + ∠C = 180° — для любого треугольника. Если даны два угла, третий можно найти вычитанием.</p>
                  </div>
                </div>
              </ExpandableCard>
            </motion.section>
          )}

          {/* TAB: PARALLEL LINES */}
          {activeTab === 'parallel' && (
            <motion.section
              key="parallel"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.3 }}
              className="mb-16"
            >
              <SectionHeader number={3} title="Параллельные прямые" subtitle="Признаки и свойства параллельности" />

              <div className="grid md:grid-cols-2 gap-6 mb-8">
                {/* Parallel lines SVG */}
                <div className="border-2 border-cyan-400/20 rounded-xl overflow-hidden h-72 sm:h-80 bg-[#001a33]">
                  <ParallelBlueprintSVG />
                </div>

                {/* Signs of parallelism */}
                <div className="space-y-3">
                  <h3 className="text-lg font-bold text-white mb-4 border-b border-white/10 pb-2">Признаки параллельности:</h3>

                  <motion.div whileHover={{ x: 4 }} className="flex items-center gap-3 p-4 bg-[#002244] rounded-xl border border-green-400/20">
                    <div className="w-10 h-10 rounded-lg bg-green-400/10 flex items-center justify-center shrink-0">
                      <Maximize2 className="w-5 h-5 text-green-400" />
                    </div>
                    <div>
                      <span className="text-green-300 font-bold block">Накрест лежащие</span>
                      <span className="text-cyan-200/70 text-sm">Должны быть РАВНЫ (∠Z)</span>
                    </div>
                  </motion.div>

                  <motion.div whileHover={{ x: 4 }} className="flex items-center gap-3 p-4 bg-[#002244] rounded-xl border border-yellow-400/20">
                    <div className="w-10 h-10 rounded-lg bg-yellow-400/10 flex items-center justify-center shrink-0">
                      <CheckCircle2 className="w-5 h-5 text-yellow-400" />
                    </div>
                    <div>
                      <span className="text-yellow-300 font-bold block">Соответственные</span>
                      <span className="text-cyan-200/70 text-sm">Должны быть РАВНЫ (∠F)</span>
                    </div>
                  </motion.div>

                  <motion.div whileHover={{ x: 4 }} className="flex items-center gap-3 p-4 bg-[#002244] rounded-xl border border-orange-400/20">
                    <div className="w-10 h-10 rounded-lg bg-orange-400/10 flex items-center justify-center shrink-0">
                      <span className="font-bold text-orange-400 text-lg">∑</span>
                    </div>
                    <div>
                      <span className="text-orange-300 font-bold block">Односторонние</span>
                      <span className="text-cyan-200/70 text-sm">Сумма = 180° (∠C)</span>
                    </div>
                  </motion.div>
                </div>
              </div>

              <FormulaBox>
                Если ∠накрест лежащие = или ∠соответственные = или ∠односторонние = 180° → a ∥ b
              </FormulaBox>

              <ExpandableCard title="Свойства параллельных прямых">
                <div className="space-y-3">
                  <div className="p-3 bg-black/20 rounded-lg border border-cyan-900/30">
                    <p className="text-cyan-200 font-semibold text-sm">Если a ∥ b и секущая c, то:</p>
                    <ul className="text-cyan-100/60 text-sm mt-2 space-y-1">
                      <li>• Накрест лежащие углы равны</li>
                      <li>• Соответственные углы равны</li>
                      <li>• Сумма односторонних углов = 180°</li>
                    </ul>
                  </div>
                  <div className="p-3 bg-black/20 rounded-lg border border-cyan-900/30">
                    <p className="text-cyan-200 font-semibold text-sm">Аксиома параллельности</p>
                    <p className="text-cyan-100/60 text-sm mt-1">Через точку, не лежащую на данной прямой, можно провести не более одной прямой, параллельной данной.</p>
                  </div>
                </div>
              </ExpandableCard>
            </motion.section>
          )}

          {/* TAB: CIRCLES */}
          {activeTab === 'circles' && (
            <motion.section
              key="circles"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.3 }}
              className="mb-16"
            >
              <SectionHeader number={4} title="Окружность" subtitle="Радиус, диаметр, хорда, касательная и дуга" />

              <div className="grid md:grid-cols-2 gap-6 mb-8">
                {/* Circle SVG */}
                <div className="border-2 border-cyan-400/20 rounded-xl overflow-hidden h-72 sm:h-80 bg-[#001a33]">
                  <CircleTheoremsSVG activePart={activeCirclePart} onHover={setActiveCirclePart} />
                </div>

                {/* Circle parts cards */}
                <div className="space-y-3 max-h-[320px] overflow-y-auto pr-2" style={{ scrollbarWidth: 'thin', scrollbarColor: '#0e7490 transparent' }}>
                  {circlePartsData.map((part, i) => (
                    <motion.div
                      key={part.key}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.08 }}
                      whileHover={{ scale: 1.02 }}
                      onMouseEnter={() => setActiveCirclePart(part.key)}
                      onMouseLeave={() => setActiveCirclePart(null)}
                      className={`bg-[#002244] rounded-xl border p-4 cursor-pointer transition-all ${
                        activeCirclePart === part.key
                          ? 'border-opacity-60 shadow-lg'
                          : 'border-white/10 hover:border-white/20'
                      }`}
                      style={{ borderColor: activeCirclePart === part.key ? part.color + '80' : undefined }}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <h3 className="font-bold text-base" style={{ color: part.color }}>{part.label}</h3>
                        <span className="font-mono text-xs px-2 py-0.5 rounded" style={{ backgroundColor: part.color + '20', color: part.color }}>
                          {part.formula}
                        </span>
                      </div>
                      <p className="text-cyan-100/70 text-sm">{part.description}</p>
                    </motion.div>
                  ))}
                </div>
              </div>

              <ExpandableCard title="Формулы окружности и круга">
                <div className="grid sm:grid-cols-2 gap-4">
                  <div className="p-3 bg-black/20 rounded-lg border border-cyan-900/30">
                    <p className="text-cyan-200 font-semibold text-sm mb-1">Длина окружности</p>
                    <div className="font-mono text-lg text-cyan-300 text-center bg-black/30 p-2 rounded border border-cyan-500/30">C = 2πR = πD</div>
                  </div>
                  <div className="p-3 bg-black/20 rounded-lg border border-cyan-900/30">
                    <p className="text-cyan-200 font-semibold text-sm mb-1">Площадь круга</p>
                    <div className="font-mono text-lg text-cyan-300 text-center bg-black/30 p-2 rounded border border-cyan-500/30">S = πR²</div>
                  </div>
                  <div className="p-3 bg-black/20 rounded-lg border border-cyan-900/30">
                    <p className="text-cyan-200 font-semibold text-sm mb-1">Длина дуги</p>
                    <div className="font-mono text-lg text-cyan-300 text-center bg-black/30 p-2 rounded border border-cyan-500/30">L = πRα/180</div>
                  </div>
                  <div className="p-3 bg-black/20 rounded-lg border border-cyan-900/30">
                    <p className="text-cyan-200 font-semibold text-sm mb-1">Значение π</p>
                    <div className="font-mono text-lg text-cyan-300 text-center bg-black/30 p-2 rounded border border-cyan-500/30">π ≈ 3,14159...</div>
                  </div>
                </div>
              </ExpandableCard>
            </motion.section>
          )}

          {/* TAB: AREA FORMULAS */}
          {activeTab === 'area' && (
            <motion.section
              key="area"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.3 }}
              className="mb-16"
            >
              <SectionHeader number={5} title="Площади фигур" subtitle="Формулы для вычисления площадей основных фигур" />

              <div className="border-2 border-cyan-400/20 rounded-xl overflow-hidden h-72 sm:h-80 mb-8 bg-[#001a33]">
                <AreaFormulasSVG activeShape={activeAreaShape} />
              </div>

              <div className="grid sm:grid-cols-2 gap-4 mb-6">
                {areaFormulasData.map((shape, i) => (
                  <motion.div
                    key={shape.key}
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: i * 0.15 }}
                    whileHover={{ scale: 1.02 }}
                    onMouseEnter={() => setActiveAreaShape(shape.key)}
                    onMouseLeave={() => setActiveAreaShape(null)}
                    onClick={() => setExpandedFormula(expandedFormula === shape.key ? null : shape.key)}
                    className={`bg-[#002244] rounded-xl border p-5 cursor-pointer transition-all ${
                      activeAreaShape === shape.key
                        ? 'border-opacity-60 shadow-lg'
                        : 'border-white/10 hover:border-white/20'
                    }`}
                    style={{ borderColor: activeAreaShape === shape.key ? shape.color + '80' : undefined }}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="font-bold text-lg" style={{ color: shape.color }}>{shape.label}</h3>
                      <motion.div animate={{ rotate: expandedFormula === shape.key ? 180 : 0 }}>
                        {expandedFormula === shape.key
                          ? <ChevronUp className="w-4 h-4 text-cyan-400" />
                          : <ChevronDown className="w-4 h-4 text-cyan-400" />}
                      </motion.div>
                    </div>
                    <div className="font-mono text-2xl font-bold mb-2" style={{ color: shape.color }}>{shape.formula}</div>
                    <p className="text-cyan-100/70 text-sm">{shape.description}</p>
                  </motion.div>
                ))}
              </div>

              <FormulaBox>
                S<sub>тр</sub> = ½ah &nbsp;&nbsp;|&nbsp;&nbsp; S<sub>пр</sub> = ab &nbsp;&nbsp;|&nbsp;&nbsp; S<sub>пар</sub> = ah &nbsp;&nbsp;|&nbsp;&nbsp; S<sub>трп</sub> = ½(a+b)h
              </FormulaBox>
            </motion.section>
          )}

          {/* TAB: VPR TIPS */}
          {activeTab === 'tips' && (
            <motion.section
              key="tips"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.3 }}
              className="mb-16"
            >
              <SectionHeader number={6} title="Советы к ВПР" subtitle="Лайфхаки и стратегии для решения задач" />

              <div className="grid gap-4">
                {vprTips.map((tip, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: i * 0.1 }}
                    whileHover={{ scale: 1.01, x: 4 }}
                    className="bg-[#002244] rounded-xl border border-cyan-400/20 p-5"
                  >
                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 rounded-lg bg-cyan-400/10 flex items-center justify-center shrink-0 mt-0.5">
                        <Lightbulb className="w-4 h-4 text-cyan-400" />
                      </div>
                      <div className="flex-1">
                        <span className="inline-block px-2 py-0.5 bg-cyan-400/10 rounded text-xs text-cyan-400 font-medium mb-2">
                          {tip.tag}
                        </span>
                        <p className="text-cyan-100/80 text-sm leading-relaxed">{tip.tip}</p>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>

              <ExpandableCard title="Частые ошибки на ВПР" className="mt-6">
                <div className="space-y-3">
                  <div className="flex items-start gap-2">
                    <span className="text-red-400 font-bold mt-0.5">✗</span>
                    <p className="text-cyan-100/70 text-sm">Забывают, что вертикальные углы — это пара, а не отдельный угол. Нужно указывать обе пары.</p>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="text-red-400 font-bold mt-0.5">✗</span>
                    <p className="text-cyan-100/70 text-sm">Путают признаки параллельности (для доказательства) со свойствами (для следствий).</p>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="text-red-400 font-bold mt-0.5">✗</span>
                    <p className="text-cyan-100/70 text-sm">При признаке СУС угол должен находиться МЕЖДУ равными сторонами. УСУ — сторона МЕЖДУ углами.</p>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="text-red-400 font-bold mt-0.5">✗</span>
                    <p className="text-cyan-100/70 text-sm">Забывают делить на 2 в формуле площади треугольника (S = ½·a·h, а не S = a·h).</p>
                  </div>
                </div>
              </ExpandableCard>
            </motion.section>
          )}
        </AnimatePresence>

        {/* ===== FULL OVERVIEW: All sections in scroll ===== */}
        <motion.section
          variants={sectionVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          className="mb-16 pt-8 border-t border-white/10"
        >
          <SectionHeader number={7} title="Полный чертёж" subtitle="Все ключевые схемы на одной странице" />

          <div className="grid md:grid-cols-2 gap-6">
            {/* Angles compact */}
            <motion.div whileHover={{ scale: 1.01 }} className="bg-[#002244] rounded-xl border border-cyan-400/20 overflow-hidden">
              <div className="px-4 py-3 border-b border-white/10 flex items-center gap-2">
                <Maximize2 className="w-4 h-4 text-yellow-400" />
                <span className="text-sm font-bold text-cyan-200">Углы</span>
              </div>
              <div className="h-48 bg-[#001a33]">
                <AnglesBlueprintSVG activeAngle={null} onHover={() => {}} />
              </div>
            </motion.div>

            {/* Triangles compact */}
            <motion.div whileHover={{ scale: 1.01 }} className="bg-[#002244] rounded-xl border border-cyan-400/20 overflow-hidden">
              <div className="px-4 py-3 border-b border-white/10 flex items-center gap-2">
                <Triangle className="w-4 h-4 text-cyan-400" />
                <span className="text-sm font-bold text-cyan-200">Треугольники</span>
              </div>
              <div className="h-48 bg-[#001a33]">
                <TrianglesBlueprintSVG activeRule={null} onHover={() => {}} />
              </div>
            </motion.div>

            {/* Parallel compact */}
            <motion.div whileHover={{ scale: 1.01 }} className="bg-[#002244] rounded-xl border border-cyan-400/20 overflow-hidden">
              <div className="px-4 py-3 border-b border-white/10 flex items-center gap-2">
                <MoveDiagonal className="w-4 h-4 text-green-400" />
                <span className="text-sm font-bold text-cyan-200">Параллельные</span>
              </div>
              <div className="h-48 bg-[#001a33]">
                <ParallelBlueprintSVG />
              </div>
            </motion.div>

            {/* Circle compact */}
            <motion.div whileHover={{ scale: 1.01 }} className="bg-[#002244] rounded-xl border border-cyan-400/20 overflow-hidden">
              <div className="px-4 py-3 border-b border-white/10 flex items-center gap-2">
                <Circle className="w-4 h-4 text-pink-400" />
                <span className="text-sm font-bold text-cyan-200">Окружность</span>
              </div>
              <div className="h-48 bg-[#001a33]">
                <CircleTheoremsSVG activePart={null} onHover={() => {}} />
              </div>
            </motion.div>
          </div>
        </motion.section>

        {/* ===== FOOTER ===== */}
        <motion.footer
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          className="mt-12 pt-8 border-t-2 border-white/10 text-center pb-8"
        >
          <motion.div whileHover={{ scale: 1.05 }} className="inline-block">
            <Link
              href="/vpr-tests"
              className="inline-flex items-center gap-2 border-2 border-cyan-400/40 text-cyan-300 hover:bg-cyan-500 hover:text-white hover:border-cyan-500 font-bold py-3 px-8 rounded-xl transition-all uppercase tracking-widest text-sm shadow-lg shadow-cyan-500/10"
            >
              <Ruler className="w-4 h-4" />
              Свернуть чертёж (В меню)
            </Link>
          </motion.div>

          <div className="mt-6 flex items-center justify-center gap-4 text-cyan-500/30 text-xs font-mono">
            <BookOpen className="w-3 h-3" />
            <span>BLUEPRINT GEO // VPR-7 // Geometry Cheatsheet</span>
          </div>
        </motion.footer>
      </div>
    </div>
  );
}

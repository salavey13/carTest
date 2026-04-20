'use client';

import { useState } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Atom, Zap, ArrowDown, Gauge, Weight, Mountain, Waves,
  Cog, Calculator, Eye, MousePointerClick, ChevronDown,
  ChevronUp, Thermometer,
} from 'lucide-react';

/* ================================================================
   TYPES
   ================================================================ */

type MatterState = 'solid' | 'liquid' | 'gas';
type ForceType = 'gravity' | 'friction' | 'elastic' | 'weight';
type LeverClass = 1 | 2 | 3;

interface DensityItem {
  name: string;
  value: number;
  color: string;
}

/* ================================================================
   DATA
   ================================================================ */

const matterStates: { key: MatterState; label: string; description: string }[] = [
  {
    key: 'solid',
    label: 'Твёрдое тело',
    description: 'Частицы колеблются около своих положений равновесия, образуя кристаллическую решётку. Сохраняют форму и объём.',
  },
  {
    key: 'liquid',
    label: 'Жидкость',
    description: 'Частицы могут свободно перемещаться, но остаются на близком расстоянии друг от друга. Сохраняют объём, но принимают форму сосуда.',
  },
  {
    key: 'gas',
    label: 'Газ',
    description: 'Частицы движутся хаотично и заполняют весь предоставленный объём. Не сохраняют ни форму, ни объём.',
  },
];

const densityData: DensityItem[] = [
  { name: 'Воздух', value: 1.29, color: '#94a3b8' },
  { name: 'Дерево', value: 600, color: '#a3763d' },
  { name: 'Вода', value: 1000, color: '#38bdf8' },
  { name: 'Железо', value: 7874, color: '#9ca3af' },
  { name: 'Золото', value: 19300, color: '#fbbf24' },
];

const forcesData: { key: ForceType; label: string; formula: string; unit: string; description: string; icon: React.ReactNode }[] = [
  {
    key: 'gravity',
    label: 'Сила тяжести',
    formula: 'F = m · g',
    unit: 'Н (ньютон)',
    description: 'Сила, с которой Земля притягивает тело. Направлена вертикально вниз к центру Земли. g ≈ 9,8 Н/кг.',
    icon: <ArrowDown className="w-5 h-5" />,
  },
  {
    key: 'friction',
    label: 'Сила трения',
    formula: 'Fтр = μ · N',
    unit: 'Н (ньютон)',
    description: 'Сила, возникающая при движении одного тела по поверхности другого. Зависит от коэффициента трения и силы нормального давления.',
    icon: <Gauge className="w-5 h-5" />,
  },
  {
    key: 'elastic',
    label: 'Сила упругости',
    formula: 'Fупр = k · Δx',
    unit: 'Н (ньютон)',
    description: 'Сила, возникающая при деформации тела и стремящаяся вернуть его в исходное состояние. k — жёсткость пружины, Δx — удлинение.',
    icon: <Zap className="w-5 h-5" />,
  },
  {
    key: 'weight',
    label: 'Вес тела',
    formula: 'P = m · g',
    unit: 'Н (ньютон)',
    description: 'Сила, с которой тело действует на опору или подвес. Равен силе тяжести в покое. Приложен к опоре, а не к телу!',
    icon: <Weight className="w-5 h-5" />,
  },
];

const leverClasses: { cls: LeverClass; label: string; description: string; positions: { fulcrum: number; effort: number; load: number } }[] = [
  {
    cls: 1,
    label: 'Рычаг I рода',
    description: 'Точка опоры расположена между силой и нагрузкой. Пример: качели, ножницы.',
    positions: { fulcrum: 50, effort: 15, load: 85 },
  },
  {
    cls: 2,
    label: 'Рычаг II рода',
    description: 'Нагрузка расположена между точкой опоры и силой. Даёт выигрыш в силе. Пример: тачка, орехокол.',
    positions: { fulcrum: 15, effort: 85, load: 60 },
  },
  {
    cls: 3,
    label: 'Рычаг III рода',
    description: 'Сила приложена между точкой опоры и нагрузкой. Даёт выигрыш в расстоянии. Пример: пинцет, предплечье.',
    positions: { fulcrum: 85, effort: 50, load: 15 },
  },
];

const powerData = [
  { name: 'Лампочка (60 Вт)', value: 60, color: '#fbbf24' },
  { name: 'Человек (покой)', value: 80, color: '#fb923c' },
  { name: 'Телевизор', value: 200, color: '#f97316' },
  { name: 'Человек (бег)', value: 1000, color: '#ef4444' },
  { name: 'Автомобиль', value: 75000, color: '#dc2626' },
];

/* ================================================================
   SVG COMPONENTS
   ================================================================ */

/* --- 1. MoleculeSVG: Brownian motion particles --- */
function MoleculeSVG({ state }: { state: MatterState }) {
  const particleCount = state === 'gas' ? 18 : state === 'liquid' ? 12 : 24;
  const particleRadius = state === 'gas' ? 3 : state === 'liquid' ? 4 : 5;
  const strokeColor = state === 'gas' ? '#fb923c' : state === 'liquid' ? '#38bdf8' : '#a3763d';
  const pathLen = state === 'gas' ? 90 : state === 'liquid' ? 40 : 8;

  const particles = Array.from({ length: particleCount }, (_, i) => ({
    cx: 10 + Math.random() * 80,
    cy: 10 + Math.random() * 80,
    r: particleRadius + Math.random() * 2,
    dur: 2 + Math.random() * 4,
    dx: (Math.random() - 0.5) * pathLen,
    dy: (Math.random() - 0.5) * pathLen,
    hue: i % 2 === 0 ? '#fb923c' : '#fbbf24',
  }));

  return (
    <svg viewBox="0 0 100 100" className="w-full h-64 sm:h-72">
      <rect width="100" height="100" fill="none" stroke={strokeColor} strokeWidth="0.5" rx="4" opacity="0.3" />
      {particles.map((p, i) => (
        <g key={i}>
          <circle cx={p.cx} cy={p.cy} r={p.r} fill={p.hue} opacity="0.8">
            {state === 'solid' ? (
              <animate attributeName="cx" values={`${p.cx};${p.cx + p.dx};${p.cx - p.dx};${p.cx}`} dur={p.dur}s repeatCount="indefinite" />
            ) : null}
            {state === 'solid' ? (
              <animate attributeName="cy" values={`${p.cy};${p.cy + p.dy};${p.cy - p.dy};${p.cy}`} dur={p.dur}s repeatCount="indefinite" />
            ) : null}
            {state !== 'solid' ? (
              <animateMotion dur={p.dur}s repeatCount="indefinite" path={`M0,0 L${p.dx},${p.dy} L${-p.dx},${-p.dy} L${p.dx * 0.5},${-p.dy * 0.5} Z`} />
            ) : null}
          </circle>
          {state === 'solid' && i < particles.length - 1 && (
            <line
              x1={p.cx} y1={p.cy}
              x2={particles[i + 1].cx} y2={particles[i + 1].cy}
              stroke={strokeColor} strokeWidth="0.3" opacity="0.2"
            />
          )}
        </g>
      ))}
      <text x="50" y="97" textAnchor="middle" fill={strokeColor} fontSize="4" opacity="0.5">
        {state === 'solid' ? 'Кристаллическая решётка' : state === 'liquid' ? 'Свободное перемещение' : 'Хаотичное движение'}
      </text>
    </svg>
  );
}

/* --- 2. MotionGraphSVG: Distance-time graph --- */
function MotionGraphSVG({ hoveredPoint, onHover }: { hoveredPoint: number | null; onHover: (idx: number | null) => void }) {
  const uniformPoints = [
    { x: 60, y: 240, label: '0 с, 0 м' },
    { x: 120, y: 200, label: '2 с, 2 м' },
    { x: 180, y: 160, label: '4 с, 4 м' },
    { x: 240, y: 120, label: '6 с, 6 м' },
    { x: 300, y: 80, label: '8 с, 8 м' },
    { x: 360, y: 40, label: '10 с, 10 м' },
  ];

  const nonUniformPoints = [
    { x: 60, y: 240 },
    { x: 120, y: 220 },
    { x: 180, y: 170 },
    { x: 240, y: 160 },
    { x: 300, y: 110 },
    { x: 360, y: 40 },
  ];

  const uniformPath = uniformPoints.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ');
  const nonUniformPath = nonUniformPoints.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ');

  return (
    <svg viewBox="0 0 420 290" className="w-full h-64 sm:h-80">
      {/* Grid */}
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <line key={`hg${i}`} x1={60 + i * 60} y1="30" x2={60 + i * 60} y2="250" stroke="#f97316" strokeWidth="0.2" opacity="0.15" />
      ))}
      {[0, 1, 2, 3, 4].map((i) => (
        <line key={`vg${i}`} x1="60" y1={250 - i * 50} x2="380" y2={250 - i * 50} stroke="#f97316" strokeWidth="0.2" opacity="0.15" />
      ))}

      {/* Axes */}
      <line x1="60" y1="250" x2="390" y2="250" stroke="#fb923c" strokeWidth="1.5" markerEnd="url(#arrowO)" />
      <line x1="60" y1="260" x2="60" y2="20" stroke="#fb923c" strokeWidth="1.5" markerEnd="url(#arrowO)" />

      {/* Labels */}
      <text x="390" y="268" fill="#fb923c" fontSize="11" fontWeight="bold">t, с</text>
      <text x="35" y="25" fill="#fb923c" fontSize="11" fontWeight="bold">s, м</text>

      {/* Axis ticks */}
      {[0, 2, 4, 6, 8, 10].map((t, i) => (
        <text key={`tx${i}`} x={60 + i * 30} y="266" textAnchor="middle" fill="#a8a29e" fontSize="8">{t}</text>
      ))}
      {[0, 2, 4, 6, 8, 10].map((s, i) => (
        <text key={`sy${i}`} x="52" y={254 - i * 21} textAnchor="end" fill="#a8a29e" fontSize="8">{s}</text>
      ))}

      {/* Uniform line */}
      <path d={uniformPath} fill="none" stroke="#f97316" strokeWidth="2.5" />
      <text x="200" y="140" fill="#f97316" fontSize="10" fontWeight="bold" transform="rotate(-33,200,140)">Равномерное</text>

      {/* Non-uniform line */}
      <path d={nonUniformPath} fill="none" stroke="#fb923c" strokeWidth="2" strokeDasharray="6,4" />
      <text x="280" y="85" fill="#fb923c" fontSize="10" fontWeight="bold" transform="rotate(-28,280,85)">Неравномерное</text>

      {/* Data points */}
      {uniformPoints.map((p, i) => (
        <g key={i} onMouseEnter={() => onHover(i)} onMouseLeave={() => onHover(null)} style={{ cursor: 'pointer' }}>
          <circle cx={p.x} cy={p.y} r={hoveredPoint === i ? 7 : 4} fill="#f97316" opacity="0.9">
            <animate attributeName="r" values="4;5;4" dur="2s" repeatCount="indefinite" begin={`${i * 0.3}s`} />
          </circle>
          {hoveredPoint === i && (
            <motion.rect
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              x={p.x - 30} y={p.y - 30} width="60" height="18" rx="4"
              fill="#140e05" stroke="#f97316" strokeWidth="0.8"
            />
          )}
          {hoveredPoint === i && (
            <motion.text
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              x={p.x} y={p.y - 17} textAnchor="middle" fill="#fbbf24" fontSize="8" fontWeight="bold"
            >
              {p.label}
            </motion.text>
          )}
        </g>
      ))}

      {/* Arrow marker */}
      <defs>
        <marker id="arrowO" markerWidth="8" markerHeight="8" refX="8" refY="4" orient="auto">
          <path d="M0,0 L8,4 L0,8" fill="#fb923c" />
        </marker>
      </defs>
    </svg>
  );
}

/* --- 3. DensityBarSVG: Horizontal comparison bars --- */
function DensityBarSVG() {
  const maxVal = 19300;
  return (
    <div className="space-y-4">
      {densityData.map((item, i) => {
        const widthPercent = Math.max(4, (item.value / maxVal) * 100);
        return (
          <div key={item.name} className="flex items-center gap-3">
            <div className="w-16 sm:w-24 text-right text-sm text-orange-200/80 font-medium shrink-0">{item.name}</div>
            <div className="flex-1 bg-black/30 rounded-full h-7 relative overflow-hidden border border-orange-900/30">
              <motion.div
                initial={{ width: 0 }}
                whileInView={{ width: `${widthPercent}%` }}
                viewport={{ once: true }}
                transition={{ duration: 1, delay: i * 0.15, ease: 'easeOut' }}
                className="h-full rounded-full"
                style={{ background: `linear-gradient(90deg, ${item.color}88, ${item.color})` }}
              />
              <motion.span
                initial={{ opacity: 0 }}
                whileInView={{ opacity: 1 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.15 + 0.5 }}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-xs font-bold text-white/90 mix-blend-difference"
              >
                {item.value.toLocaleString()} кг/м³
              </motion.span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* --- 4. ForcesDiagramSVG: Free body diagram --- */
function ForcesDiagramSVG({ activeForce }: { activeForce: ForceType | null }) {
  const arrowColor = (key: ForceType) =>
    activeForce === null || activeForce === key ? '#f97316' : '#44403c';
  const arrowWidth = (key: ForceType) =>
    activeForce === null || activeForce === key ? 2.5 : 1;

  return (
    <svg viewBox="0 0 200 220" className="w-full h-56 sm:h-64">
      {/* Surface */}
      <rect x="20" y="170" width="160" height="6" rx="2" fill="#78350f" opacity="0.6" />
      <line x1="20" y1="176" x2="180" y2="176" stroke="#92400e" strokeWidth="1" strokeDasharray="4,3" />

      {/* Block */}
      <rect x="70" y="110" width="60" height="60" rx="4" fill="#1c1917" stroke="#f97316" strokeWidth="1.5" />
      <text x="100" y="145" textAnchor="middle" fill="#fb923c" fontSize="11" fontWeight="bold">m</text>

      {/* Gravity (mg) - down */}
      <motion.g animate={{ opacity: 1 }}>
        <line x1="100" y1="170" x2="100" y2="210" stroke={arrowColor('gravity')} strokeWidth={arrowWidth('gravity')} />
        <polygon points="100,215 95,205 105,205" fill={arrowColor('gravity')} />
        <text x="115" y="210" fill={arrowColor('gravity')} fontSize="10" fontWeight="bold">mg</text>
      </motion.g>

      {/* Normal force (N) - up */}
      <motion.g animate={{ opacity: 1 }}>
        <line x1="100" y1="110" x2="100" y2="65" stroke={arrowColor('weight')} strokeWidth={arrowWidth('weight')} />
        <polygon points="100,60 95,70 105,70" fill={arrowColor('weight')} />
        <text x="115" y="78" fill={arrowColor('weight')} fontSize="10" fontWeight="bold">N</text>
      </motion.g>

      {/* Friction (Fтр) - left */}
      <motion.g animate={{ opacity: 1 }}>
        <line x1="70" y1="140" x2="35" y2="140" stroke={arrowColor('friction')} strokeWidth={arrowWidth('friction')} />
        <polygon points="30,140 40,135 40,145" fill={arrowColor('friction')} />
        <text x="32" y="132" fill={arrowColor('friction')} fontSize="9" fontWeight="bold">Fтр</text>
      </motion.g>

      {/* Applied force (F) - right */}
      <motion.g animate={{ opacity: 1 }}>
        <line x1="130" y1="140" x2="170" y2="140" stroke={arrowColor('elastic')} strokeWidth={arrowWidth('elastic')} />
        <polygon points="175,140 165,135 165,145" fill={arrowColor('elastic')} />
        <text x="148" y="132" fill={arrowColor('elastic')} fontSize="9" fontWeight="bold">F</text>
      </motion.g>

      {/* Animated pulse on block */}
      <circle cx="100" cy="140" r="35" fill="none" stroke="#f97316" strokeWidth="0.5" opacity="0.3">
        <animate attributeName="r" values="35;45;35" dur="3s" repeatCount="indefinite" />
        <animate attributeName="opacity" values="0.3;0;0.3" dur="3s" repeatCount="indefinite" />
      </circle>
    </svg>
  );
}

/* --- 5. LeverSVG: Interactive lever classes --- */
function LeverSVG({ leverClass }: { leverClass: LeverClass }) {
  const data = leverClasses.find((l) => l.cls === leverClass)!;

  return (
    <svg viewBox="0 0 200 160" className="w-full h-48 sm:h-56">
      {/* Ground */}
      <line x1="10" y1="130" x2="190" y2="130" stroke="#78350f" strokeWidth="1" strokeDasharray="4,3" />

      {/* Lever beam */}
      <motion.line
        key={`beam-${leverClass}`}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        x1="10" y1="95" x2="190" y2="95"
        stroke="#a3763d" strokeWidth="3" strokeLinecap="round"
      />

      {/* Fulcrum (triangle) */}
      <motion.polygon
        key={`fulcrum-${leverClass}`}
        initial={{ opacity: 0, scale: 0.5 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.2 }}
        points={`${data.positions.fulcrum},130 ${data.positions.fulcrum - 8},95 ${data.positions.fulcrum + 8},95`}
        fill="#f97316" stroke="#fb923c" strokeWidth="1"
      />

      {/* Effort arrow (downward on effort position) */}
      <motion.g
        key={`effort-${leverClass}`}
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
      >
        <line x1={data.positions.effort} y1="40" x2={data.positions.effort} y2="85" stroke="#38bdf8" strokeWidth="2" />
        <polygon points={`${data.positions.effort},35 ${data.positions.effort - 5},45 ${data.positions.effort + 5},45`} fill="#38bdf8" />
        <text x={data.positions.effort} y="55" textAnchor="middle" fill="#38bdf8" fontSize="9" fontWeight="bold">F₁</text>
      </motion.g>

      {/* Load (box + downward arrow) */}
      <motion.g
        key={`load-${leverClass}`}
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
      >
        <rect
          x={data.positions.load - 12} y="75"
          width="24" height="20" rx="2"
          fill="#1c1917" stroke="#ef4444" strokeWidth="1.5"
        />
        <text x={data.positions.load} y="89" textAnchor="middle" fill="#ef4444" fontSize="8" fontWeight="bold">mg</text>
        <line x1={data.positions.load} y1="95" x2={data.positions.load} y2="120" stroke="#ef4444" strokeWidth="1.5" />
        <polygon points={`${data.positions.load},125 ${data.positions.load - 4},117 ${data.positions.load + 4},117`} fill="#ef4444" />
      </motion.g>

      {/* Distance markers */}
      <motion.g
        key={`dist-${leverClass}`}
        initial={{ opacity: 0 }}
        animate={{ opacity: 0.6 }}
        transition={{ delay: 0.5 }}
      >
        <line x1={data.positions.fulcrum} y1="108" x2={data.positions.effort} y2="108" stroke="#38bdf8" strokeWidth="1" strokeDasharray="2,2" />
        <text x={(data.positions.fulcrum + data.positions.effort) / 2} y="117" textAnchor="middle" fill="#38bdf8" fontSize="7">d₁</text>
        <line x1={data.positions.fulcrum} y1="108" x2={data.positions.load} y2="108" stroke="#ef4444" strokeWidth="1" strokeDasharray="2,2" />
        <text x={(data.positions.fulcrum + data.positions.load) / 2} y="117" textAnchor="middle" fill="#ef4444" fontSize="7">d₂</text>
      </motion.g>

      {/* Label */}
      <text x="100" y="150" textAnchor="middle" fill="#fb923c" fontSize="9" fontWeight="bold">
        {data.label}
      </text>
    </svg>
  );
}

/* --- 6. ArchimedesSVG: Buoyancy force on submerged object --- */
function ArchimedesSVG({ showDetail }: { showDetail: boolean }) {
  return (
    <svg viewBox="0 0 240 200" className="w-full h-56 sm:h-64">
      {/* Water */}
      <rect x="20" y="70" width="200" height="110" rx="4" fill="#0c4a6e" opacity="0.4" />
      {/* Water waves */}
      <path d="M20,75 Q60,65 100,75 Q140,85 180,75 Q210,68 220,75" fill="none" stroke="#38bdf8" strokeWidth="1.5" opacity="0.6">
        <animate attributeName="d" values="M20,75 Q60,65 100,75 Q140,85 180,75 Q210,68 220,75;M20,75 Q60,85 100,75 Q140,65 180,75 Q210,82 220,75;M20,75 Q60,65 100,75 Q140,85 180,75 Q210,68 220,75" dur="4s" repeatCount="indefinite" />
      </path>

      {/* Submerged block */}
      <motion.rect
        x="95" y="90" width="50" height="50" rx="3"
        fill="#1c1917" stroke="#f97316" strokeWidth="1.5"
        animate={{ y: showDetail ? 82 : 90 }}
      />
      <text x="120" y="120" textAnchor="middle" fill="#fb923c" fontSize="10" fontWeight="bold">V погр</text>

      {/* Buoyancy arrow (up) */}
      <motion.g animate={{ y: showDetail ? [-2, 2, -2] : 0 }} transition={{ duration: 1.5, repeat: Infinity }}>
        <line x1="120" y1="85" x2="120" y2="30" stroke="#38bdf8" strokeWidth="2.5" />
        <polygon points="120,25 115,35 125,35" fill="#38bdf8" />
        <text x="138" y="45" fill="#38bdf8" fontSize="10" fontWeight="bold">Fₐ</text>
      </motion.g>

      {/* Gravity arrow (down) */}
      <line x1="120" y1="145" x2="120" y2="185" stroke="#ef4444" strokeWidth="2" />
      <polygon points="120,190 115,180 125,180" fill="#ef4444" />
      <text x="138" y="178" fill="#ef4444" fontSize="10" fontWeight="bold">mg</text>

      {/* Waterline label */}
      <text x="12" y="73" fill="#38bdf8" fontSize="8" opacity="0.7">Уровень воды</text>

      {/* Animated bubbles */}
      {[30, 50, 70].map((x, i) => (
        <circle key={i} cx={x} cy={150} r="2" fill="#38bdf8" opacity="0.5">
          <animate attributeName="cy" values="150;75" dur={`${2 + i * 0.5}s`} repeatCount="indefinite" />
          <animate attributeName="opacity" values="0.5;0" dur={`${2 + i * 0.5}s`} repeatCount="indefinite" />
        </circle>
      ))}

      {showDetail && (
        <motion.g initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          <text x="200" y="120" textAnchor="end" fill="#fbbf24" fontSize="8">
            Fₐ = ρж · g · V погр
          </text>
        </motion.g>
      )}
    </svg>
  );
}

/* --- 7. PressureSVG: Sharp vs wide object --- */
function PressureSVG() {
  return (
    <svg viewBox="0 0 280 180" className="w-full h-48 sm:h-56">
      {/* Surface */}
      <rect x="20" y="130" width="240" height="8" rx="2" fill="#78350f" opacity="0.5" />

      {/* Left: sharp object (small area, high pressure) */}
      <g>
        <polygon points="70,50 60,130 80,130" fill="#1c1917" stroke="#ef4444" strokeWidth="1.5" />
        <line x1="70" y1="50" x2="70" y2="10" stroke="#f97316" strokeWidth="2" />
        <polygon points="70,5 66,15 74,15" fill="#f97316" />
        <text x="70" y="3" textAnchor="middle" fill="#f97316" fontSize="9" fontWeight="bold">F</text>

        {/* Small contact area indicator */}
        <motion.rect
          x="63" y="130" width="14" height="4" rx="1"
          fill="#ef4444" opacity="0.8"
          animate={{ opacity: [0.5, 1, 0.5] }}
          transition={{ duration: 1.5, repeat: Infinity }}
        />

        {/* Pressure lines (dense) */}
        {[0, 2, 4, 6, 8].map((offset) => (
          <line key={`sl${offset}`} x1={65 + offset} y1="138" x2={65 + offset} y2="165" stroke="#ef4444" strokeWidth="0.5" opacity="0.6" />
        ))}

        <text x="70" y="178" textAnchor="middle" fill="#ef4444" fontSize="9" fontWeight="bold">Малая S → Большое p</text>
      </g>

      {/* Divider */}
      <line x1="140" y1="20" x2="140" y2="170" stroke="#44403c" strokeWidth="0.5" strokeDasharray="4,4" />

      {/* Right: wide object (large area, low pressure) */}
      <g>
        <rect x="175" y="90" width="70" height="40" rx="3" fill="#1c1917" stroke="#38bdf8" strokeWidth="1.5" />
        <line x1="210" y1="90" x2="210" y2="50" stroke="#f97316" strokeWidth="2" />
        <polygon points="210,45 206,55 214,55" fill="#f97316" />
        <text x="210" y="43" textAnchor="middle" fill="#f97316" fontSize="9" fontWeight="bold">F</text>

        {/* Large contact area indicator */}
        <motion.rect
          x="175" y="130" width="70" height="4" rx="1"
          fill="#38bdf8" opacity="0.8"
          animate={{ opacity: [0.5, 1, 0.5] }}
          transition={{ duration: 1.5, repeat: Infinity, delay: 0.5 }}
        />

        {/* Pressure lines (sparse) */}
        {[0, 15, 30, 45, 60].map((offset) => (
          <line key={`sr${offset}`} x1={180 + offset} y1="138" x2={180 + offset} y2="155" stroke="#38bdf8" strokeWidth="0.3" opacity="0.4" />
        ))}

        <text x="210" y="178" textAnchor="middle" fill="#38bdf8" fontSize="9" fontWeight="bold">Большая S → Малое p</text>
      </g>
    </svg>
  );
}

/* --- 8. WorkSVG: Force × distance visualization --- */
function WorkSVG() {
  return (
    <svg viewBox="0 0 300 140" className="w-full h-40 sm:h-48">
      {/* Surface */}
      <rect x="10" y="100" width="280" height="5" rx="2" fill="#78350f" opacity="0.5" />

      {/* Block */}
      <rect x="40" y="60" width="50" height="40" rx="3" fill="#1c1917" stroke="#f97316" strokeWidth="1.5" />

      {/* Force arrow */}
      <line x1="92" y1="80" x2="170" y2="80" stroke="#f97316" strokeWidth="2.5" />
      <polygon points="175,80 165,74 165,86" fill="#f97316" />
      <text x="130" y="72" textAnchor="middle" fill="#fb923c" fontSize="11" fontWeight="bold">F</text>

      {/* Distance bracket */}
      <line x1="65" y1="112" x2="65" y2="125" stroke="#fbbf24" strokeWidth="1" />
      <line x1="165" y1="112" x2="165" y2="125" stroke="#fbbf24" strokeWidth="1" />
      <line x1="65" y1="120" x2="165" y2="120" stroke="#fbbf24" strokeWidth="1" />
      <text x="115" y="137" textAnchor="middle" fill="#fbbf24" fontSize="11" fontWeight="bold">s</text>

      {/* Animated moving block */}
      <motion.g animate={{ x: [0, 80, 0] }} transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}>
        <rect x="185" y="60" width="50" height="40" rx="3" fill="#f97316" opacity="0.15" stroke="#f97316" strokeWidth="1" strokeDasharray="4,3" />
      </motion.g>

      {/* Formula */}
      <text x="265" y="82" textAnchor="middle" fill="#fb923c" fontSize="12" fontWeight="bold">A = F · s</text>
      <text x="265" y="98" textAnchor="middle" fill="#a8a29e" fontSize="8">[Дж]</text>
    </svg>
  );
}

/* ================================================================
   BACKGROUND PATTERN: Atom-like energy dots
   ================================================================ */

function BackgroundPattern() {
  const dots = Array.from({ length: 40 }, (_, i) => ({
    cx: (i * 73 + 20) % 100,
    cy: (i * 47 + 15) % 100,
    r: 0.3 + (i % 3) * 0.3,
    opacity: 0.08 + (i % 4) * 0.04,
  }));

  return (
    <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
      <svg className="absolute inset-0 w-full h-full" xmlns="http://www.w3.org/2000/svg">
        {dots.map((d, i) => (
          <circle key={i} cx={`${d.cx}%`} cy={`${d.cy}%`} r={d.r} fill="#f97316" opacity={d.opacity}>
            <animate attributeName="opacity" values={`${d.opacity};${d.opacity * 2};${d.opacity}`} dur={`${3 + (i % 5)}s`} repeatCount="indefinite" />
          </circle>
        ))}
      </svg>
      {/* Blur glow orbs */}
      <div className="absolute top-20 -left-32 w-80 h-80 bg-orange-600/10 rounded-full blur-[120px]" />
      <div className="absolute bottom-40 -right-32 w-96 h-96 bg-amber-500/8 rounded-full blur-[140px]" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-orange-900/5 rounded-full blur-[200px]" />
    </div>
  );
}

/* ================================================================
   SECTION HEADER COMPONENT
   ================================================================ */

function SectionHeader({ icon, title, subtitle }: { icon: React.ReactNode; title: string; subtitle: string }) {
  return (
    <div className="flex items-center gap-4 mb-8">
      <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-gradient-to-br from-orange-500/20 to-amber-600/10 border border-orange-500/30 text-orange-400 shrink-0">
        {icon}
      </div>
      <div>
        <h2 className="text-2xl sm:text-3xl font-bold text-orange-100">{title}</h2>
        <p className="text-orange-300/60 text-sm mt-0.5">{subtitle}</p>
      </div>
    </div>
  );
}

/* ================================================================
   FORMULA BOX COMPONENT
   ================================================================ */

function FormulaBox({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-black/30 p-3 sm:p-4 rounded-lg border border-orange-500/30 font-mono text-orange-300 text-lg sm:text-xl text-center">
      {children}
    </div>
  );
}

/* ================================================================
   EXPANDABLE CARD COMPONENT
   ================================================================ */

function ExpandableCard({ title, children, defaultOpen = false }: { title: string; children: React.ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="bg-[#140e05] rounded-xl border border-orange-800/40 overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between p-4 sm:p-5 text-left hover:bg-orange-900/10 transition-colors"
      >
        <span className="text-orange-100 font-semibold text-base sm:text-lg">{title}</span>
        <motion.div animate={{ rotate: open ? 180 : 0 }} transition={{ duration: 0.2 }}>
          {open ? <ChevronUp className="w-5 h-5 text-orange-400" /> : <ChevronDown className="w-5 h-5 text-orange-400" />}
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
   MAIN COMPONENT
   ================================================================ */

export default function Physics7Cheatsheet() {
  /* Interactive states */
  const [matterState, setMatterState] = useState<MatterState>('solid');
  const [hoveredGraphPoint, setHoveredGraphPoint] = useState<number | null>(null);
  const [activeForce, setActiveForce] = useState<ForceType | null>(null);
  const [leverClass, setLeverClass] = useState<LeverClass>(1);
  const [showArchimedesDetail, setShowArchimedesDetail] = useState(false);

  return (
    <div className="min-h-screen bg-[#0f0a04] text-orange-50 relative">
      <BackgroundPattern />

      <div className="relative z-10 max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
        {/* ===== BACK LINK ===== */}
        <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.4 }}>
          <Link
            href="/vpr-tests"
            className="inline-flex items-center gap-2 text-orange-300/70 hover:text-orange-200 transition-colors mb-8 group"
          >
            <svg className="w-4 h-4 group-hover:-translate-x-1 transition-transform" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M19 12H5M12 19l-7-7 7-7" />
            </svg>
            Назад к тестам ВПР
          </Link>
        </motion.div>

        {/* ===== HERO HEADER ===== */}
        <motion.header
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7 }}
          className="text-center mb-16"
        >
          {/* Hero SVG */}
          <div className="flex justify-center mb-6">
            <svg viewBox="0 0 200 120" className="w-48 sm:w-64 h-auto">
              {/* Atom orbits */}
              <ellipse cx="100" cy="60" rx="60" ry="25" fill="none" stroke="#f97316" strokeWidth="1" opacity="0.3" transform="rotate(-30,100,60)">
                <animateTransform attributeName="transform" type="rotate" from="-30 100 60" to="330 100 60" dur="20s" repeatCount="indefinite" />
              </ellipse>
              <ellipse cx="100" cy="60" rx="60" ry="25" fill="none" stroke="#fb923c" strokeWidth="1" opacity="0.3" transform="rotate(30,100,60)">
                <animateTransform attributeName="transform" type="rotate" from="30 100 60" to="-330 100 60" dur="25s" repeatCount="indefinite" />
              </ellipse>
              <ellipse cx="100" cy="60" rx="60" ry="25" fill="none" stroke="#fbbf24" strokeWidth="1" opacity="0.3" transform="rotate(90,100,60)">
                <animateTransform attributeName="transform" type="rotate" from="90 100 60" to="450 100 60" dur="18s" repeatCount="indefinite" />
              </ellipse>
              {/* Nucleus */}
              <circle cx="100" cy="60" r="10" fill="#f97316" opacity="0.8">
                <animate attributeName="r" values="10;12;10" dur="2s" repeatCount="indefinite" />
              </circle>
              <circle cx="100" cy="60" r="5" fill="#fbbf24" />
              {/* Electrons */}
              <circle cx="160" cy="60" r="3" fill="#38bdf8">
                <animateMotion dur="3s" repeatCount="indefinite">
                  <mpath href="#orbit1" />
                </animateMotion>
              </circle>
              <path id="orbit1" d="M40,60 A60,25 -30 1,1 160,60" fill="none" />
              <circle cx="40" cy="35" r="3" fill="#f472b6">
                <animateMotion dur="4s" repeatCount="indefinite">
                  <mpath href="#orbit2" />
                </animateMotion>
              </circle>
              <path id="orbit2" d="M160,60 A60,25 30 1,1 40,60" fill="none" />
            </svg>
          </div>

          <div className="inline-block mb-4 px-4 py-1.5 rounded-full bg-gradient-to-r from-orange-500/20 to-amber-500/20 border border-orange-500/30 text-orange-300 text-sm font-medium">
            7 класс • Подготовка к ВПР
          </div>
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black bg-gradient-to-r from-orange-300 via-amber-400 to-orange-500 bg-clip-text text-transparent mb-4 leading-tight">
            Физика — Шпаргалка
          </h1>
          <p className="text-orange-200/50 text-base sm:text-lg max-w-2xl mx-auto">
            Полный справочник по всем темам 7 класса для подготовки к Всероссийской проверочной работе. Формулы, определения и наглядные иллюстрации.
          </p>
        </motion.header>

        {/* ===== SECTION 1: STRUCTURE OF MATTER ===== */}
        <motion.section
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-50px' }}
          transition={{ duration: 0.6 }}
          className="mb-20"
        >
          <SectionHeader
            icon={<Atom className="w-6 h-6" />}
            title="Строение вещества"
            subtitle="Молекулы, атомы и их движение"
          />

          <ExpandableCard title="Что такое молекулы и атомы?" defaultOpen>
            <p className="text-orange-100/80 leading-relaxed mb-3">
              <strong className="text-orange-300">Молекула</strong> — мельчайшая частица вещества, сохраняющая его свойства.
              Молекулы состоят из <strong className="text-orange-300">атомов</strong>. Молекулы всех веществ находятся в непрерывном хаотичном движении.
            </p>
            <p className="text-orange-100/80 leading-relaxed mb-4">
              <strong className="text-orange-300">Броуновское движение</strong> — хаотичное движение мелких частиц, взвешенных в жидкости или газе,
              вызываемое ударами молекул окружающего вещества.
            </p>
            <div className="flex items-center gap-2 text-sm text-orange-300/60">
              <MousePointerClick className="w-4 h-4" />
              <span>Наведите на точки графика для просмотра значений</span>
            </div>
          </ExpandableCard>

          <ExpandableCard title="Диффузия">
            <p className="text-orange-100/80 leading-relaxed">
              <strong className="text-orange-300">Диффузия</strong> — взаимное проникновение молекул одного вещества в промежутки между молекулами другого.
              Протекает быстрее при нагревании, так как скорость движения молекул увеличивается.
            </p>
            <div className="mt-3 bg-black/20 p-3 rounded-lg border border-orange-900/30 text-sm text-orange-200/70">
              💡 Пример: запах духов распространяется по комнате. Соль растворяется в воде.
            </div>
          </ExpandableCard>

          {/* Matter states tabs */}
          <div className="mt-6">
            <div className="flex gap-2 mb-4 flex-wrap">
              {matterStates.map((ms) => (
                <button
                  key={ms.key}
                  onClick={() => setMatterState(ms.key)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                    matterState === ms.key
                      ? 'bg-orange-500 text-white shadow-lg shadow-orange-500/25'
                      : 'bg-[#140e05] border border-orange-800/40 text-orange-300/70 hover:text-orange-200 hover:border-orange-700/50'
                  }`}
                >
                  {ms.label}
                </button>
              ))}
            </div>

            <AnimatePresence mode="wait">
              <motion.div
                key={matterState}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.3 }}
                className="bg-[#140e05] rounded-xl border border-orange-800/40 p-4 sm:p-6"
              >
                <MoleculeSVG state={matterState} />
                <p className="text-orange-100/80 mt-4 leading-relaxed text-sm sm:text-base">
                  {matterStates.find((ms) => ms.key === matterState)!.description}
                </p>
              </motion.div>
            </AnimatePresence>
          </div>
        </motion.section>

        {/* ===== SECTION 2: MECHANICAL MOTION ===== */}
        <motion.section
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-50px' }}
          transition={{ duration: 0.6 }}
          className="mb-20"
        >
          <SectionHeader
            icon={<Zap className="w-6 h-6" />}
            title="Механическое движение"
            subtitle="Равномерное и неравномерное движение"
          />

          <div className="grid md:grid-cols-2 gap-6 mb-6">
            <div className="bg-[#140e05] rounded-xl border border-orange-800/40 p-4 sm:p-6">
              <h3 className="text-orange-200 font-semibold mb-2 text-lg">Траектория и путь</h3>
              <p className="text-orange-100/70 text-sm leading-relaxed">
                <strong className="text-orange-300">Траектория</strong> — линия, вдоль которой движется тело.
                <br />
                <strong className="text-orange-300">Путь (s)</strong> — длина траектории. Измеряется в метрах (м).
              </p>
            </div>
            <div className="bg-[#140e05] rounded-xl border border-orange-800/40 p-4 sm:p-6">
              <h3 className="text-orange-200 font-semibold mb-2 text-lg">Скорость</h3>
              <p className="text-orange-100/70 text-sm leading-relaxed">
                <strong className="text-orange-300">Скорость (v)</strong> — величина, показывающая какой путь проходит тело за единицу времени.
                Единица: м/с (метр в секунду).
              </p>
            </div>
          </div>

          <FormulaBox>
            v = s / t &nbsp;&nbsp;→&nbsp;&nbsp; s = v · t &nbsp;&nbsp;→&nbsp;&nbsp; t = s / v
          </FormulaBox>

          <div className="mt-6 bg-[#140e05] rounded-xl border border-orange-800/40 p-4 sm:p-6">
            <h3 className="text-orange-200 font-semibold mb-3 text-lg">График зависимости пути от времени</h3>
            <div className="flex items-center gap-2 mb-3 text-sm text-orange-300/60">
              <Eye className="w-4 h-4" />
              <span>Наведите на точки для просмотра значений</span>
            </div>
            <MotionGraphSVG hoveredPoint={hoveredGraphPoint} onHover={setHoveredGraphPoint} />
          </div>

          <ExpandableCard title="Равномерное vs неравномерное движение" className="mt-6">
            <div className="space-y-3">
              <div className="p-3 bg-black/20 rounded-lg border border-orange-900/20">
                <p className="text-orange-200 font-semibold text-sm"> Равномерное движение</p>
                <p className="text-orange-100/70 text-sm mt-1">Тело проходит одинаковые пути за одинаковые промежутки времени. График — прямая линия. Скорость постоянна.</p>
              </div>
              <div className="p-3 bg-black/20 rounded-lg border border-orange-900/20">
                <p className="text-orange-200 font-semibold text-sm"> Неравномерное движение</p>
                <p className="text-orange-100/70 text-sm mt-1">Тело проходит разные пути за одинаковые промежутки времени. График — кривая. Вводится средняя скорость: v_ср = s / t.</p>
              </div>
            </div>
          </ExpandableCard>
        </motion.section>

        {/* ===== SECTION 3: DENSITY ===== */}
        <motion.section
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-50px' }}
          transition={{ duration: 0.6 }}
          className="mb-20"
        >
          <SectionHeader
            icon={<Gauge className="w-6 h-6" />}
            title="Плотность вещества"
            subtitle="Масса единицы объёма"
          />

          <p className="text-orange-100/70 mb-6 leading-relaxed">
            <strong className="text-orange-300">Плотность (ρ)</strong> — физическая величина, равная отношению массы тела к его объёму.
            Показывает, чему равна масса 1 м³ вещества.
          </p>

          <FormulaBox>
            ρ = m / V &nbsp;&nbsp;→&nbsp;&nbsp; m = ρ · V &nbsp;&nbsp;→&nbsp;&nbsp; V = m / ρ
          </FormulaBox>

          <div className="mt-3 text-center text-sm text-orange-300/50 mb-6">
            Единица плотности: кг/м³ (килограмм на кубический метр)
          </div>

          <div className="bg-[#140e05] rounded-xl border border-orange-800/40 p-4 sm:p-6">
            <h3 className="text-orange-200 font-semibold mb-4 text-lg">Сравнение плотностей веществ</h3>
            <DensityBarSVG />
            <p className="text-orange-300/40 text-xs mt-4">⚠ Масштаб логарифмический. Плотность золота в ~15000 раз больше плотности воздуха.</p>
          </div>

          <ExpandableCard title="Плотность воды и интересные факты" className="mt-6">
            <div className="space-y-2 text-sm text-orange-100/70">
              <p>• Плотность воды: <strong className="text-orange-300">1000 кг/м³</strong></p>
              <p>• Плотность льда: <strong className="text-orange-300">900 кг/м³</strong> — поэтому лёд плавает на воде</p>
              <p>• Самое лёгкое вещество — водород (0,09 кг/м³)</p>
              <p>• Самое плотное при нормальных условиях — осмий (22600 кг/м³)</p>
              <p>• Для определения плотности тела неправильной формы используйте мензурку</p>
            </div>
          </ExpandableCard>
        </motion.section>

        {/* ===== SECTION 4: FORCES ===== */}
        <motion.section
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-50px' }}
          transition={{ duration: 0.6 }}
          className="mb-20"
        >
          <SectionHeader
            icon={<ArrowDown className="w-6 h-6" />}
            title="Силы в природе"
            subtitle="Гравитация, трение, упругость и вес"
          />

          <p className="text-orange-100/70 mb-6 leading-relaxed">
            <strong className="text-orange-300">Сила (F)</strong> — мера взаимодействия тел. Единица: Ньютон (Н).
            1 Н — сила, которая за 1 с изменяет скорость тела массой 1 кг на 1 м/с.
          </p>

          {/* Force diagram */}
          <div className="bg-[#140e05] rounded-xl border border-orange-800/40 p-4 sm:p-6 mb-6">
            <h3 className="text-orange-200 font-semibold mb-3 text-lg">Силы, действующие на тело на поверхности</h3>
            <div className="flex items-center gap-2 mb-3 text-sm text-orange-300/60">
              <MousePointerClick className="w-4 h-4" />
              <span>Выберите силу для подсветки на диаграмме</span>
            </div>
            <ForcesDiagramSVG activeForce={activeForce} />
          </div>

          {/* Force cards with interactive hover sync */}
          <div className="grid sm:grid-cols-2 gap-4">
            {forcesData.map((force) => (
              <motion.div
                key={force.key}
                onHoverStart={() => setActiveForce(force.key)}
                onHoverEnd={() => setActiveForce(null)}
                onClick={() => setActiveForce(activeForce === force.key ? null : force.key)}
                whileHover={{ scale: 1.02 }}
                className={`bg-[#140e05] rounded-xl border p-4 sm:p-5 cursor-pointer transition-all ${
                  activeForce === force.key ? 'border-orange-500/60 shadow-lg shadow-orange-500/10' : 'border-orange-800/40 hover:border-orange-700/50'
                }`}
              >
                <div className="flex items-center gap-3 mb-3">
                  <div className={`flex items-center justify-center w-9 h-9 rounded-lg ${activeForce === force.key ? 'bg-orange-500/20 text-orange-400' : 'bg-black/30 text-orange-300/60'}`}>
                    {force.icon}
                  </div>
                  <h3 className="text-orange-100 font-semibold">{force.label}</h3>
                </div>
                <FormulaBox className="mb-2 text-base">{force.formula}</FormulaBox>
                <p className="text-xs text-orange-300/40 mb-2">{force.unit}</p>
                <p className="text-orange-100/60 text-sm leading-relaxed">{force.description}</p>
              </motion.div>
            ))}
          </div>

          {/* Newton's 3rd law */}
          <ExpandableCard title="Третий закон Ньютона" className="mt-6">
            <FormulaBox className="mb-3">F₁ = −F₂</FormulaBox>
            <p className="text-orange-100/70 leading-relaxed text-sm">
              Тела действуют друг на друга с силами, направленными вдоль одной прямой, равными по модулю и противоположными по направлению.
              <br /><br />
              <strong className="text-orange-300">Пример:</strong> когда вы стоите на полу, вы давите на пол с силой P, а пол давит на вас с такой же силой N.
              Эти силы приложены к разным телам!
            </p>
          </ExpandableCard>

          {/* Dynamometer */}
          <ExpandableCard title="Динамометр">
            <p className="text-orange-100/70 text-sm leading-relaxed">
              <strong className="text-orange-300">Динамометр</strong> — прибор для измерения силы.
              Основан на зависимости силы упругости пружины от её удлинения (закон Гука).
              <br /><br />
              Предел измерения: максимальная сила, которую может измерить динамометр. Цена деления: расстояние между ближайшими штрихами шкалы.
            </p>
          </ExpandableCard>
        </motion.section>

        {/* ===== SECTION 5: PRESSURE ===== */}
        <motion.section
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-50px' }}
          transition={{ duration: 0.6 }}
          className="mb-20"
        >
          <SectionHeader
            icon={<Weight className="w-6 h-6" />}
            title="Давление"
            subtitle="Сила, действующая на единицу площади"
          />

          <p className="text-orange-100/70 mb-6 leading-relaxed">
            <strong className="text-orange-300">Давление (p)</strong> — физическая величина, равная отношению силы, действующей перпендикулярно поверхности, к площади этой поверхности.
          </p>

          <FormulaBox>
            p = F / S
          </FormulaBox>
          <div className="mt-2 text-center text-sm text-orange-300/50 mb-6">
            Единица: Паскаль (Па). 1 Па = 1 Н/м². 1 кПа = 1000 Па.
          </div>

          <div className="bg-[#140e05] rounded-xl border border-orange-800/40 p-4 sm:p-6 mb-6">
            <h3 className="text-orange-200 font-semibold mb-4 text-lg">Зависимость давления от площади опоры</h3>
            <PressureSVG />
          </div>

          <div className="grid sm:grid-cols-2 gap-4 mb-6">
            <ExpandableCard title="Закон Паскаля">
              <p className="text-orange-100/70 text-sm leading-relaxed">
                Давление, производимое на жидкость или газ, передаётся без изменения в любую точку жидкости или газа во всех направлениях.
                <br /><br />
                <strong className="text-orange-300">Пример:</strong> гидравлический пресс. Малая сила на малом поршне создаёт большую силу на большом поршне.
              </p>
            </ExpandableCard>

            <ExpandableCard title="Атмосферное давление">
              <p className="text-orange-100/70 text-sm leading-relaxed">
                Атмосферное давление создаётся весом воздушного столба.
                <br /><br />
                <strong className="text-orange-300">Нормальное атмосферное давление:</strong> 760 мм рт. ст. ≈ 101 300 Па ≈ 101,3 кПа.
                <br /><br />
                Прибор для измерения: <strong className="text-orange-300">барометр</strong>. С увеличением высоты давление уменьшается (примерно на 12 мм рт. ст. при подъёме на каждые 100 м).
              </p>
            </ExpandableCard>
          </div>

          <ExpandableCard title="Давление в жидкости и газе" defaultOpen>
            <FormulaBox className="mb-3">p = ρ · g · h</FormulaBox>
            <p className="text-orange-100/70 text-sm leading-relaxed">
              Давление на дне сосуда зависит от плотности жидкости (ρ) и высоты столба жидкости (h).
              <br />
              <strong className="text-orange-300">g ≈ 9,8 Н/кг</strong>
              <br /><br />
              В сообщающихся сосудах уровни однородной жидкости устанавливаются на одной высоте.
              Гидравлический пресс работает по этому принципу: F₂ / F₁ = S₂ / S₁.
            </p>
          </ExpandableCard>
        </motion.section>

        {/* ===== SECTION 6: ARCHIMEDES' PRINCIPLE ===== */}
        <motion.section
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-50px' }}
          transition={{ duration: 0.6 }}
          className="mb-20"
        >
          <SectionHeader
            icon={<Waves className="w-6 h-6" />}
            title="Сила Архимеда"
            subtitle="Выталкивающая сила в жидкости и газе"
          />

          <p className="text-orange-100/70 mb-6 leading-relaxed">
            На тело, погружённое в жидкость или газ, действует <strong className="text-orange-300">выталкивающая сила (сила Архимеда)</strong>,
            равная весу жидкости (или газа) в объёме погружённой части тела.
          </p>

          <FormulaBox>
            Fₐ = ρ_ж · g · V_погр
          </FormulaBox>

          <div
            className="mt-6 bg-[#140e05] rounded-xl border border-orange-800/40 p-4 sm:p-6 cursor-pointer mb-6"
            onMouseEnter={() => setShowArchimedesDetail(true)}
            onMouseLeave={() => setShowArchimedesDetail(false)}
          >
            <div className="flex items-center gap-2 mb-3 text-sm text-orange-300/60">
              <MousePointerClick className="w-4 h-4" />
              <span>Наведите для просмотра формулы и деталей</span>
            </div>
            <ArchimedesSVG showDetail={showArchimedesDetail} />
          </div>

          <ExpandableCard title="Условия плавания тел" defaultOpen>
            <div className="space-y-3">
              <div className="p-3 bg-black/20 rounded-lg border border-green-900/30">
                <p className="text-green-300 font-semibold text-sm">▲ Тело всплывает (плавает на поверхности)</p>
                <p className="text-orange-100/60 text-sm mt-1">Fₐ &gt; mg → если ρ_тела &lt; ρ_жидкости</p>
              </div>
              <div className="p-3 bg-black/20 rounded-lg border border-blue-900/30">
                <p className="text-blue-300 font-semibold text-sm">● Тело находится в равновесии</p>
                <p className="text-orange-100/60 text-sm mt-1">Fₐ = mg → если ρ_тела = ρ_жидкости</p>
              </div>
              <div className="p-3 bg-black/20 rounded-lg border border-red-900/30">
                <p className="text-red-300 font-semibold text-sm">▼ Тело тонет</p>
                <p className="text-orange-100/60 text-sm mt-1">Fₐ &lt; mg → если ρ_тела &gt; ρ_жидкости</p>
              </div>
            </div>
          </ExpandableCard>

          <ExpandableCard title="Почему корабли плавают?">
            <p className="text-orange-100/70 text-sm leading-relaxed">
              Корабль из стали (ρ = 7800 кг/м³) плавает, потому что его форма создаёт большой объём.
              Средняя плотность корабля вместе с воздухом внутри меньше плотности воды.
              <br /><br />
              <strong className="text-orange-300">Водоподъёмность</strong> — вес воды, который может принять судно до допустимой ватерлинии.
            </p>
          </ExpandableCard>
        </motion.section>

        {/* ===== SECTION 7: WORK & POWER ===== */}
        <motion.section
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-50px' }}
          transition={{ duration: 0.6 }}
          className="mb-20"
        >
          <SectionHeader
            icon={<Cog className="w-6 h-6" />}
            title="Работа и мощность"
            subtitle="Энергия, работа силы и мощность"
          />

          <div className="grid sm:grid-cols-2 gap-6 mb-6">
            <div>
              <h3 className="text-orange-200 font-semibold mb-3 text-lg">Механическая работа</h3>
              <p className="text-orange-100/70 text-sm leading-relaxed mb-3">
                <strong className="text-orange-300">Работа (A)</strong> — физическая величина, равная произведению силы на путь,
                пройденный в направлении действия силы.
              </p>
              <FormulaBox>A = F · s</FormulaBox>
              <p className="text-center text-sm text-orange-300/50 mt-2">Единица: Джоуль (Дж). 1 Дж = 1 Н · м</p>
              <p className="text-orange-100/50 text-xs mt-2 text-center">
                Если F ⊥ s, то A = 0. Работа может быть положительной и отрицательной.
              </p>
            </div>
            <div>
              <h3 className="text-orange-200 font-semibold mb-3 text-lg">Мощность</h3>
              <p className="text-orange-100/70 text-sm leading-relaxed mb-3">
                <strong className="text-orange-300">Мощность (N)</strong> — величина, показывающая, какая работа совершается за единицу времени.
              </p>
              <FormulaBox>N = A / t</FormulaBox>
              <p className="text-center text-sm text-orange-300/50 mt-2">Единица: Ватт (Вт). 1 Вт = 1 Дж/с</p>
              <p className="text-orange-100/50 text-xs mt-2 text-center">
                1 кВт = 1000 Вт, 1 МВт = 1 000 000 Вт, 1 л.с. ≈ 736 Вт
              </p>
            </div>
          </div>

          <div className="bg-[#140e05] rounded-xl border border-orange-800/40 p-4 sm:p-6 mb-6">
            <h3 className="text-orange-200 font-semibold mb-4 text-lg">Визуализация работы</h3>
            <WorkSVG />
          </div>

          <div className="bg-[#140e05] rounded-xl border border-orange-800/40 p-4 sm:p-6">
            <h3 className="text-orange-200 font-semibold mb-4 text-lg">Сравнение мощностей</h3>
            <div className="space-y-3">
              {powerData.map((item, i) => {
                const maxPower = 75000;
                const widthPercent = Math.max(4, (Math.log10(item.value) / Math.log10(maxPower)) * 100);
                return (
                  <div key={item.name} className="flex items-center gap-3">
                    <div className="w-28 sm:w-40 text-right text-sm text-orange-200/70 font-medium shrink-0">{item.name}</div>
                    <div className="flex-1 bg-black/30 rounded-full h-6 relative overflow-hidden border border-orange-900/30">
                      <motion.div
                        initial={{ width: 0 }}
                        whileInView={{ width: `${widthPercent}%` }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.8, delay: i * 0.1, ease: 'easeOut' }}
                        className="h-full rounded-full"
                        style={{ background: `linear-gradient(90deg, ${item.color}66, ${item.color})` }}
                      />
                      <motion.span
                        initial={{ opacity: 0 }}
                        whileInView={{ opacity: 1 }}
                        viewport={{ once: true }}
                        transition={{ delay: i * 0.1 + 0.4 }}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-xs font-bold text-white/80"
                      >
                        {item.value >= 1000 ? `${item.value / 1000} кВт` : `${item.value} Вт`}
                      </motion.span>
                    </div>
                  </div>
                );
              })}
            </div>
            <p className="text-orange-300/40 text-xs mt-3">⚠ Шкала логарифмическая</p>
          </div>
        </motion.section>

        {/* ===== SECTION 8: SIMPLE MACHINES ===== */}
        <motion.section
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-50px' }}
          transition={{ duration: 0.6 }}
          className="mb-20"
        >
          <SectionHeader
            icon={<Mountain className="w-6 h-6" />}
            title="Простые механизмы"
            subtitle="Рычаги, блоки и КПД"
          />

          <p className="text-orange-100/70 mb-6 leading-relaxed">
            <strong className="text-orange-300">Простые механизмы</strong> — устройства, позволяющие изменить силу (увеличить или уменьшить).
            К ним относятся: рычаг, блок, наклонная плоскость, клин, винт, ворот.
          </p>

          {/* Lever rule */}
          <FormulaBox className="mb-3">M = F · d &nbsp;→&nbsp; F₁ · d₁ = F₂ · d₂</FormulaBox>
          <p className="text-center text-sm text-orange-300/50 mb-6">
            Момент силы (M) = сила (F) × плечо силы (d). Правило рычага: моменты сил равны.
          </p>

          {/* Lever class tabs */}
          <div className="mb-6">
            <div className="flex gap-2 mb-4 flex-wrap">
              {leverClasses.map((lc) => (
                <button
                  key={lc.cls}
                  onClick={() => setLeverClass(lc.cls)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                    leverClass === lc.cls
                      ? 'bg-orange-500 text-white shadow-lg shadow-orange-500/25'
                      : 'bg-[#140e05] border border-orange-800/40 text-orange-300/70 hover:text-orange-200 hover:border-orange-700/50'
                  }`}
                >
                  {lc.label}
                </button>
              ))}
            </div>

            <AnimatePresence mode="wait">
              <motion.div
                key={leverClass}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.3 }}
                className="bg-[#140e05] rounded-xl border border-orange-800/40 p-4 sm:p-6"
              >
                <LeverSVG leverClass={leverClass} />
                <p className="text-orange-100/80 mt-4 leading-relaxed text-sm sm:text-base">
                  {leverClasses.find((lc) => lc.cls === leverClass)!.description}
                </p>
              </motion.div>
            </AnimatePresence>
          </div>

          {/* Pulleys and blocks */}
          <div className="grid sm:grid-cols-2 gap-4 mb-6">
            <ExpandableCard title="Неподвижный блок">
              <svg viewBox="0 0 160 100" className="w-full h-24 mb-3">
                {/* Support */}
                <line x1="80" y1="10" x2="80" y2="0" stroke="#78350f" strokeWidth="3" />
                <rect x="60" y="0" width="40" height="6" fill="#78350f" opacity="0.6" />
                {/* Wheel */}
                <circle cx="80" cy="35" r="15" fill="none" stroke="#f97316" strokeWidth="2" />
                <circle cx="80" cy="35" r="2" fill="#fb923c" />
                {/* Rope */}
                <line x1="95" y1="35" x2="140" y2="35" stroke="#a8a29e" strokeWidth="1" />
                <line x1="65" y1="35" x2="20" y2="90" stroke="#a8a29e" strokeWidth="1" />
                {/* Weight */}
                <rect x="10" y="85" width="20" height="15" fill="#1c1917" stroke="#ef4444" strokeWidth="1" />
                {/* Arrow up */}
                <line x1="140" y1="35" x2="140" y2="10" stroke="#38bdf8" strokeWidth="1.5" />
                <polygon points="140,5 137,12 143,12" fill="#38bdf8" />
              </svg>
              <p className="text-orange-100/70 text-sm">
                Не даёт выигрыша в силе. <strong className="text-orange-300">F = mg</strong>.
                Изменяет направление действия силы. Ось вращения закреплена.
              </p>
            </ExpandableCard>

            <ExpandableCard title="Подвижный блок">
              <svg viewBox="0 0 160 100" className="w-full h-24 mb-3">
                {/* Support */}
                <line x1="30" y1="10" x2="30" y2="0" stroke="#78350f" strokeWidth="3" />
                <rect x="10" y="0" width="40" height="6" fill="#78350f" opacity="0.6" />
                {/* Upper wheel (fixed) */}
                <circle cx="30" cy="30" r="12" fill="none" stroke="#a8a29e" strokeWidth="1.5" />
                <circle cx="30" cy="30" r="2" fill="#78716c" />
                {/* Lower wheel (movable) */}
                <circle cx="90" cy="60" r="12" fill="none" stroke="#f97316" strokeWidth="2" />
                <circle cx="90" cy="60" r="2" fill="#fb923c" />
                {/* Rope */}
                <line x1="18" y1="30" x2="18" y2="75" stroke="#a8a29e" strokeWidth="1" />
                <line x1="78" y1="60" x2="42" y2="30" stroke="#a8a29e" strokeWidth="1" />
                <line x1="102" y1="60" x2="140" y2="10" stroke="#a8a29e" strokeWidth="1" />
                {/* Weight */}
                <rect x="80" y="72" width="20" height="15" fill="#1c1917" stroke="#ef4444" strokeWidth="1" />
                {/* Arrow up */}
                <line x1="140" y1="10" x2="140" y2="-5" stroke="#38bdf8" strokeWidth="1.5" />
                <polygon points="140,-8 137,-2 143,-2" fill="#38bdf8" />
              </svg>
              <p className="text-orange-100/70 text-sm">
                Даёт выигрыш в силе в <strong className="text-orange-300">2 раза</strong>.
                <strong className="text-orange-300"> F = mg / 2</strong>.
                Ось вращения подвижна. Но проигрыш в расстоянии в 2 раза!
              </p>
            </ExpandableCard>
          </div>

          {/* Efficiency */}
          <ExpandableCard title="Коэффициент полезного действия (КПД)" defaultOpen>
            <FormulaBox className="mb-3">η = (А_полезная / А_затраченная) · 100%</FormulaBox>
            <p className="text-orange-100/70 text-sm leading-relaxed mb-3">
              <strong className="text-orange-300">КПД (η)</strong> — отношение полезной работы к полной затраченной работе.
              Выражается в процентах. Всегда ≤ 100%.
            </p>
            <div className="bg-black/20 p-3 rounded-lg border border-orange-900/30 text-sm text-orange-200/60">
              💡 Полезная работа — работа, ради которой совершается действие.<br />
              Затраченная работа — вся работа, выполненная механизмом (включая работу против трения).
            </div>
          </ExpandableCard>

          <ExpandableCard title="Золотое правило механики">
            <div className="bg-black/30 p-4 rounded-lg border border-amber-500/30 text-center text-amber-300 font-semibold text-base mb-3">
              Ни один простой механизм не даёт выигрыша в работе.
            </div>
            <p className="text-orange-100/70 text-sm leading-relaxed">
              Во сколько раз мы выигрываем в силе, во столько же раз проигрываем в расстоянии.
              Это связано с законом сохранения энергии: полный путь, проходимый силой, обратно пропорционален величине этой силы.
            </p>
          </ExpandableCard>
        </motion.section>

        {/* ===== SECTION 9: ENERGY ===== */}
        <motion.section
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-50px' }}
          transition={{ duration: 0.6 }}
          className="mb-20"
        >
          <SectionHeader
            icon={<Zap className="w-6 h-6" />}
            title="Энергия"
            subtitle="Кинетическая и потенциальная энергия"
          />

          <div className="grid sm:grid-cols-2 gap-4 mb-6">
            <div className="bg-[#140e05] rounded-xl border border-orange-800/40 p-4 sm:p-5">
              <h3 className="text-orange-200 font-semibold mb-2 text-lg">Кинетическая энергия</h3>
              <FormulaBox className="mb-3 text-base">Eк = m · v² / 2</FormulaBox>
              <p className="text-orange-100/70 text-sm leading-relaxed">
                Энергия движущегося тела. Зависит от массы и квадрата скорости. Чем больше скорость, тем больше кинетическая энергия.
                У неподвижного тела Eк = 0.
              </p>
            </div>
            <div className="bg-[#140e05] rounded-xl border border-orange-800/40 p-4 sm:p-5">
              <h3 className="text-orange-200 font-semibold mb-2 text-lg">Потенциальная энергия</h3>
              <FormulaBox className="mb-3 text-base">Eп = m · g · h</FormulaBox>
              <p className="text-orange-100/70 text-sm leading-relaxed">
                Энергия, которой обладает тело вследствие своего положения относительно Земли. Зависит от массы и высоты.
                На поверхности Земли (h = 0): Eп = 0.
              </p>
            </div>
          </div>

          <FormulaBox>Закон сохранения энергии: Eк₁ + Eп₁ = Eк₂ + Eп₂</FormulaBox>

          <ExpandableCard title="Переход энергии" className="mt-6">
            <p className="text-orange-100/70 text-sm leading-relaxed mb-3">
              Кинетическая и потенциальная энергия могут переходить друг в друга.
            </p>
            <div className="bg-black/20 p-3 rounded-lg border border-orange-900/30 text-sm text-orange-200/60">
              💡 Пример маятника: в крайней верхней точке Eк = 0, Eп = max. В нижней точке Eп = 0, Eк = max.
              Полная механическая энергия остаётся постоянной (без учёта трения).
            </div>
          </ExpandableCard>
        </motion.section>

        {/* ===== FOOTER ===== */}
        <motion.footer
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          className="border-t border-orange-900/30 pt-8 pb-4 text-center"
        >
          <div className="flex justify-center mb-4">
            <svg viewBox="0 0 120 40" className="w-24 h-8 opacity-30">
              <ellipse cx="60" cy="20" rx="40" ry="12" fill="none" stroke="#f97316" strokeWidth="0.8" opacity="0.5">
                <animateTransform attributeName="transform" type="rotate" from="0 60 20" to="360 60 20" dur="15s" repeatCount="indefinite" />
              </ellipse>
              <circle cx="60" cy="20" r="4" fill="#f97316" opacity="0.5" />
            </svg>
          </div>
          <p className="text-orange-300/30 text-sm mb-2">Физика 7 класс — Шпаргалка для подготовки к ВПР</p>
          <p className="text-orange-300/20 text-xs">Все формулы и определения по курсу физики 7 класса</p>
          <div className="mt-4">
            <Link
              href="/vpr-tests"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-orange-500/10 border border-orange-500/30 text-orange-300 hover:bg-orange-500/20 hover:border-orange-500/50 transition-all text-sm"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M19 12H5M12 19l-7-7 7-7" />
              </svg>
              Вернуться к тестам ВПР
            </Link>
          </div>
        </motion.footer>
      </div>
    </div>
  );
}

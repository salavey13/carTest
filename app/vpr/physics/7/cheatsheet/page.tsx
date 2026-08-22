'use client';

import { useState, useMemo, useCallback, useRef } from 'react';
import dynamic from 'next/dynamic';
import { motion, AnimatePresence } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import {
  Atom, Zap, ArrowDown, ArrowLeft, ArrowRight, Gauge, Weight, Mountain, Waves,
  Cog, Calculator, Eye, MousePointerClick, ChevronDown,
  ChevronUp, Thermometer, BookOpen, Trophy, RotateCcw,
  Target, Ruler, Beaker, Compass, FlaskConical, Lightbulb,
} from 'lucide-react';

import {
  type PhysicsQuestion, type PhysicsQuestionType,
  QUESTIONS, FORMULAS, DENSITY_TABLE, QUICK_FACTS,
  FRICTION_COEFFICIENTS, SI_PREFIXES,
} from './questions-data';

/* ═══════════════════════════════════════════════════════════════════════════════════
   SVG COMPONENTS — Physics visualizations (preserved from original)
   ═══════════════════════════════════════════════════════════════════════════════════ */

/* --- 1. MoleculeSVG: Brownian motion particles --- */
function MoleculeSVG({ state }: { state: 'solid' | 'liquid' | 'gas' }) {
  const particleCount = state === 'gas' ? 18 : state === 'liquid' ? 12 : 24;
  const particleRadius = state === 'gas' ? 3 : state === 'liquid' ? 4 : 5;
  const strokeColor = state === 'gas' ? '#fb923c' : state === 'liquid' ? '#38bdf8' : '#a3763d';
  const pathLen = state === 'gas' ? 90 : state === 'liquid' ? 40 : 8;

  const particles = Array.from({ length: particleCount }, (_, i) => ({
    cx: 10 + Math.random() * 80, cy: 10 + Math.random() * 80, r: particleRadius + Math.random() * 2,
    dur: 2 + Math.random() * 4, dx: (Math.random() - 0.5) * pathLen, dy: (Math.random() - 0.5) * pathLen,
    hue: i % 2 === 0 ? '#fb923c' : '#fbbf24',
  }));

  return (
    <svg viewBox="0 0 100 100" className="w-full h-64 sm:h-72">
      <rect width="100" height="100" fill="none" stroke={strokeColor} strokeWidth="0.5" rx="4" opacity="0.3" />
      {particles.map((p, i) => (
        <g key={i}>
          <circle cx={p.cx} cy={p.cy} r={p.r} fill={p.hue} opacity="0.8">
            {state === 'solid' ? (
              <><animate attributeName="cx" values={`${p.cx};${p.cx + p.dx};${p.cx - p.dx};${p.cx}`} dur={p.dur}s repeatCount="indefinite" />
              <animate attributeName="cy" values={`${p.cy};${p.cy + p.dy};${p.cy - p.dy};${p.cy}`} dur={p.dur}s repeatCount="indefinite" /></>
            ) : null}
            {state !== 'solid' ? (
              <animateMotion dur={p.dur}s repeatCount="indefinite" path={`M0,0 L${p.dx},${p.dy} L${-p.dx},${-p.dy} L${p.dx * 0.5},${-p.dy * 0.5} Z`} />
            ) : null}
          </circle>
          {state === 'solid' && i < particles.length - 1 && (
            <line x1={p.cx} y1={p.cy} x2={particles[i + 1].cx} y2={particles[i + 1].cy} stroke={strokeColor} strokeWidth="0.3" opacity="0.2" />
          )}
        </g>
      ))}
      <text x="50" y="97" textAnchor="middle" fill={strokeColor} fontSize="4" opacity="0.5">
        {state === 'solid' ? 'Кристаллическая решётка' : state === 'liquid' ? 'Свободное перемещение' : 'Хаотичное движение'}
      </text>
    </svg>
  );
}

/* --- 2. MotionGraphSVG: Speed-time graph --- */
function MotionGraphSVG({ hoveredPoint, onHover }: { hoveredPoint: number | null; onHover: (i: number | null) => void }) {
  const uniformPoints = [
    { x: 60, y: 240, label: '0 с, 0 м/с' },
    { x: 120, y: 200, label: '2 с, 2 м/с' },
    { x: 180, y: 160, label: '4 с, 4 м/с' },
    { x: 240, y: 120, label: '6 с, 6 м/с' },
    { x: 300, y: 80, label: '8 с, 8 м/с' },
    { x: 360, y: 40, label: '10 с, 10 м/с' },
  ];
  return (
    <svg viewBox="0 0 420 290" className="w-full h-64 sm:h-80">
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <line key={`hg${i}`} x1={60 + i * 60} y1="30" x2={60 + i * 60} y2="250" stroke="#f97316" strokeWidth="0.2" opacity="0.15" />
      ))}
      {[0, 1, 2, 3, 4].map((i) => (
        <line key={`vg${i}`} x1="60" y1={250 - i * 50} x2="380" y2={250 - i * 50} stroke="#f97316" strokeWidth="0.2" opacity="0.15" />
      ))}
      <line x1="60" y1="250" x2="390" y2="250" stroke="#fb923c" strokeWidth="1.5" markerEnd="url(#arrowPhys)" />
      <line x1="60" y1="260" x2="60" y2="20" stroke="#fb923c" strokeWidth="1.5" markerEnd="url(#arrowPhys)" />
      <text x="390" y="268" fill="#fb923c" fontSize="11" fontWeight="bold">t, с</text>
      <text x="35" y="25" fill="#fb923c" fontSize="11" fontWeight="bold">v, м/с</text>
      {[0, 2, 4, 6, 8, 10].map((t, i) => (
        <text key={`tx${i}`} x={60 + i * 30} y="266" textAnchor="middle" fill="#a8a29e" fontSize="8">{t}</text>
      ))}
      {[0, 2, 4, 6, 8, 10].map((s, i) => (
        <text key={`sy${i}`} x="52" y={254 - i * 21} textAnchor="end" fill="#a8a29e" fontSize="8">{s}</text>
      ))}
      <path d={uniformPoints.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ')} fill="none" stroke="#f97316" strokeWidth="2.5" />
      <text x="200" y="140" fill="#f97316" fontSize="10" fontWeight="bold" transform="rotate(-33,200,140)">Равномерное</text>
      {uniformPoints.map((p, i) => (
        <g key={i} onMouseEnter={() => onHover(i)} onMouseLeave={() => onHover(null)} style={{ cursor: 'pointer' }}>
          <circle cx={p.x} cy={p.y} r={hoveredPoint === i ? 7 : 4} fill="#f97316" opacity="0.9">
            <animate attributeName="r" values="4;5;4" dur="2s" repeatCount="indefinite" begin={`${i * 0.3}s`} />
          </circle>
          {hoveredPoint === i && (
            <>
              <rect x={p.x - 30} y={p.y - 30} width="60" height="18" rx="4" fill="#140e05" stroke="#f97316" strokeWidth="0.8" />
              <text x={p.x} y={p.y - 17} textAnchor="middle" fill="#fbbf24" fontSize="8" fontWeight="bold">{p.label}</text>
            </>
          )}
        </g>
      ))}
      <defs>
        <marker id="arrowPhys" markerWidth="8" markerHeight="8" refX="8" refY="4" orient="auto">
          <path d="M0,0 L8,4 L0,8" fill="#fb923c" />
        </marker>
      </defs>
    </svg>
  );
}

/* --- 3. DensityBarSVG --- */
function DensityBarSVG() {
  const maxVal = 19300;
  return (
    <div className="space-y-4">
      {DENSITY_TABLE.slice(0, 8).map((item, i) => {
        const widthPercent = Math.max(4, (item.density / maxVal) * 100);
        return (
          <div key={item.substance} className="flex items-center gap-3">
            <div className="w-20 sm:w-28 text-right text-sm text-orange-200/80 font-medium shrink-0">{item.substance}</div>
            <div className="flex-1 bg-black/30 rounded-full h-7 relative overflow-hidden border border-orange-900/30">
              <motion.div
                initial={{ width: 0 }} whileInView={{ width: `${widthPercent}%` }} viewport={{ once: true }}
                transition={{ duration: 1, delay: i * 0.12, ease: 'easeOut' }}
                className="h-full rounded-full"
                style={{ background: `linear-gradient(90deg, ${item.color}88, ${item.color})` }}
              />
              <motion.span
                initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }}
                transition={{ delay: i * 0.12 + 0.5 }}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-xs font-bold text-white/90 mix-blend-difference"
              >
                {item.density.toLocaleString()} кг/м³
              </motion.span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* --- 4. ForcesDiagramSVG --- */
function ForcesDiagramSVG({ activeForce }: { activeForce: string | null }) {
  const arrowColor = (key: string) => activeForce === null || activeForce === key ? '#f97316' : '#44403c';
  const arrowWidth = (key: string) => activeForce === null || activeForce === key ? 2.5 : 1;
  return (
    <svg viewBox="0 0 200 220" className="w-full h-56 sm:h-64">
      <rect x="20" y="170" width="160" height="6" rx="2" fill="#78350f" opacity="0.6" />
      <line x1="20" y1="176" x2="180" y2="176" stroke="#92400e" strokeWidth="1" strokeDasharray="4,3" />
      <rect x="70" y="110" width="60" height="60" rx="4" fill="#1c1917" stroke="#f97316" strokeWidth="1.5" />
      <text x="100" y="145" textAnchor="middle" fill="#fb923c" fontSize="11" fontWeight="bold">m</text>
      <line x1="100" y1="170" x2="100" y2="210" stroke={arrowColor('gravity')} strokeWidth={arrowWidth('gravity')} />
      <polygon points="100,215 95,205 105,205" fill={arrowColor('gravity')} />
      <text x="115" y="210" fill={arrowColor('gravity')} fontSize="10" fontWeight="bold">mg</text>
      <line x1="100" y1="110" x2="100" y2="65" stroke={arrowColor('weight')} strokeWidth={arrowWidth('weight')} />
      <polygon points="100,60 95,70 105,70" fill={arrowColor('weight')} />
      <text x="115" y="78" fill={arrowColor('weight')} fontSize="10" fontWeight="bold">N</text>
      <line x1="70" y1="140" x2="35" y2="140" stroke={arrowColor('friction')} strokeWidth={arrowWidth('friction')} />
      <polygon points="30,140 40,135 40,145" fill={arrowColor('friction')} />
      <text x="32" y="132" fill={arrowColor('friction')} fontSize="9" fontWeight="bold">Fтр</text>
      <line x1="130" y1="140" x2="170" y2="140" stroke={arrowColor('elastic')} strokeWidth={arrowWidth('elastic')} />
      <polygon points="175,140 165,135 165,145" fill={arrowColor('elastic')} />
      <text x="148" y="132" fill={arrowColor('elastic')} fontSize="9" fontWeight="bold">F</text>
      <circle cx="100" cy="140" r="35" fill="none" stroke="#f97316" strokeWidth="0.5" opacity="0.3">
        <animate attributeName="r" values="35;45;35" dur="3s" repeatCount="indefinite" />
        <animate attributeName="opacity" values="0.3;0;0.3" dur="3s" repeatCount="indefinite" />
      </circle>
    </svg>
  );
}

/* --- 5. ArchimedesSVG --- */
function ArchimedesSVG({ showDetail }: { showDetail: boolean }) {
  return (
    <svg viewBox="0 0 240 200" className="w-full h-56 sm:h-64">
      <rect x="20" y="70" width="200" height="110" rx="4" fill="#0c4a6e" opacity="0.4" />
      <path d="M20,75 Q60,65 100,75 Q140,85 180,75 Q210,68 220,75" fill="none" stroke="#38bdf8" strokeWidth="1.5" opacity="0.6">
        <animate attributeName="d" values="M20,75 Q60,65 100,75 Q140,85 180,75 Q210,68 220,75;M20,75 Q60,85 100,75 Q140,65 180,75 Q210,82 220,75;M20,75 Q60,65 100,75 Q140,85 180,75 Q210,68 220,75" dur="4s" repeatCount="indefinite" />
      </path>
      <rect x="95" y={showDetail ? 82 : 90} width="50" height="50" rx="3" fill="#1c1917" stroke="#f97316" strokeWidth="1.5" />
      <text x="120" y="120" textAnchor="middle" fill="#fb923c" fontSize="10" fontWeight="bold">V погр</text>
      <motion.g animate={{ y: showDetail ? [-2, 2, -2] : 0 }} transition={{ duration: 1.5, repeat: Infinity }}>
        <line x1="120" y1="85" x2="120" y2="30" stroke="#38bdf8" strokeWidth="2.5" />
        <polygon points="120,25 115,35 125,35" fill="#38bdf8" />
        <text x="138" y="45" fill="#38bdf8" fontSize="10" fontWeight="bold">Fₐ</text>
      </motion.g>
      <line x1="120" y1="145" x2="120" y2="185" stroke="#ef4444" strokeWidth="2" />
      <polygon points="120,190 115,180 125,180" fill="#ef4444" />
      <text x="138" y="178" fill="#ef4444" fontSize="10" fontWeight="bold">mg</text>
      <text x="12" y="73" fill="#38bdf8" fontSize="8" opacity="0.7">Уровень воды</text>
      {[30, 50, 70].map((x, i) => (
        <circle key={i} cx={x} cy={150} r="2" fill="#38bdf8" opacity="0.5">
          <animate attributeName="cy" values="150;75" dur={`${2 + i * 0.5}s`} repeatCount="indefinite" />
          <animate attributeName="opacity" values="0.5;0" dur={`${2 + i * 0.5}s`} repeatCount="indefinite" />
        </circle>
      ))}
      {showDetail && (
        <text x="200" y="120" textAnchor="end" fill="#fbbf24" fontSize="8">Fₐ = ρ_ж · g · V_погр</text>
      )}
    </svg>
  );
}

/* --- 6. PressureSVG --- */
function PressureSVG() {
  return (
    <svg viewBox="0 0 280 180" className="w-full h-48 sm:h-56">
      <rect x="20" y="130" width="240" height="8" rx="2" fill="#78350f" opacity="0.5" />
      <g>
        <polygon points="70,50 60,130 80,130" fill="#1c1917" stroke="#ef4444" strokeWidth="1.5" />
        <line x1="70" y1="50" x2="70" y2="10" stroke="#f97316" strokeWidth="2" />
        <polygon points="70,5 66,15 74,15" fill="#f97316" />
        <text x="70" y="3" textAnchor="middle" fill="#f97316" fontSize="9" fontWeight="bold">F</text>
        <motion.rect x="63" y="130" width="14" height="4" rx="1" fill="#ef4444" opacity="0.8" animate={{ opacity: [0.5, 1, 0.5] }} transition={{ duration: 1.5, repeat: Infinity }} />
        {[0, 2, 4, 6, 8].map((o) => <line key={o} x1={65 + o} y1="138" x2={65 + o} y2="165" stroke="#ef4444" strokeWidth="0.5" opacity="0.6" />)}
        <text x="70" y="178" textAnchor="middle" fill="#ef4444" fontSize="9" fontWeight="bold">Малая S → Большое p</text>
      </g>
      <line x1="140" y1="20" x2="140" y2="170" stroke="#44403c" strokeWidth="0.5" strokeDasharray="4,4" />
      <g>
        <rect x="175" y="90" width="70" height="40" rx="3" fill="#1c1917" stroke="#38bdf8" strokeWidth="1.5" />
        <line x1="210" y1="90" x2="210" y2="50" stroke="#f97316" strokeWidth="2" />
        <polygon points="210,45 206,55 214,55" fill="#f97316" />
        <text x="210" y="43" textAnchor="middle" fill="#f97316" fontSize="9" fontWeight="bold">F</text>
        <motion.rect x="175" y="130" width="70" height="4" rx="1" fill="#38bdf8" opacity="0.8" animate={{ opacity: [0.5, 1, 0.5] }} transition={{ duration: 1.5, repeat: Infinity, delay: 0.5 }} />
        {[0, 15, 30, 45, 60].map((o) => <line key={o} x1={180 + o} y1="138" x2={180 + o} y2="155" stroke="#38bdf8" strokeWidth="0.3" opacity="0.4" />)}
        <text x="210" y="178" textAnchor="middle" fill="#38bdf8" fontSize="9" fontWeight="bold">Большая S → Малое p</text>
      </g>
    </svg>
  );
}

/* --- 7. SpeedGraphSVG for Q2 --- */
function SpeedGraphSVG({ data }: { data: NonNullable<PhysicsQuestion['graphData']> }) {
  if (!data) return null;
  const maxT = Math.max(...data.points.map(p => p.x));
  const maxV = Math.max(...data.points.map(p => p.y)) * 1.1;
  const w = 360, h = 200, pad = { t: 30, r: 15, b: 35, l: 50 };
  const plotW = w - pad.l - pad.r;
  const plotH = h - pad.t - pad.b;
  const toX = (t: number) => pad.l + (t / maxT) * plotW;
  const toY = (v: number) => pad.t + plotH - (v / maxV) * plotH;

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-auto bg-[#140e05] rounded-lg border border-orange-800/30 p-2">
      <line x1={pad.l} y1={pad.t} x2={w - pad.r} y2={h - pad.b} stroke="#f97316" strokeWidth="1" markerEnd="url(#arrowV)" />
      <line x1={pad.l} y1={h - pad.b} x2={w - pad.r} y2={pad.b - 10} stroke="#f97316" strokeWidth="1" />
      <line x1={pad.l} y1={h - pad.b} x2={pad.l} y2={pad.t} stroke="#f97316" strokeWidth="0.5" />
      <line x1={pad.l} y1={pad.t} x2={w - pad.r} y2={pad.t} stroke="#f97316" strokeWidth="0.5" />
      <text x={w / 2} y={h - 5} fill="#fb923c" fontSize="10" textAnchor="middle">{data.xLabel}</text>
      <text x="12" y={h / 2 - 20} fill="#fb923c" fontSize="9" textAnchor="middle" transform={`rotate(-90,12,${h / 2})`}>{data.yLabel}</text>
      {data.points.map((p, i) => (
        <g key={i}>
          {i < data.points.length - 1 && (
            <line x1={toX(p.x)} y1={toY(p.y)} x2={toX(data.points[i + 1].x)} y2={toY(data.points[i + 1].y)} stroke="#f97316" strokeWidth="2" />
          )}
          <circle cx={toX(p.x)} cy={toY(p.y)} r="5" fill="#f97316" stroke="#fb923c" strokeWidth="1.5">
            <animate attributeName="r" values="5;7;5" dur="2s" repeatCount="indefinite" />
          </circle>
        </g>
      ))}
      <text x={w - pad.r + 5} y={h - pad.b - 3} fill="#a8a29e" fontSize="8">{data.question}</text>
      <defs>
        <marker id="arrowV" markerWidth="8" markerHeight="8" refX="8" refY="4" orient="auto">
          <path d="M0,0 L8,4 L0,8" fill="#fb923c" />
        </marker>
      </defs>
    </svg>
  );
}

/* ═══════════════════════════════════════════════════════════════════════
   HELPER COMPONENTS
   ═══════════════════════════════════════════════════════════════════════ */

function FeedbackBadge({ status, text }: { status: 'success' | 'error' | 'hint'; text: string }) {
  const styles = {
    success: 'bg-orange-900/40 border-orange-500/50 text-orange-300',
    error: 'bg-red-900/40 border-red-500/50 text-red-300',
    hint: 'bg-amber-900/40 border-amber-500/50 text-amber-300',
  };
  const Icon = status === 'success' ? <CheckCircle className="w-4 h-4 mt-0.5 shrink-0" />
    : status === 'error' ? <XCircle className="w-4 h-4 mt-0.5 shrink-0" />
    : <Lightbulb className="w-4 h-4 mt-0.5 shrink-0" />;
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className={`flex items-start gap-2 p-3 rounded-lg border text-sm ${styles[status]}`}>
      {Icon}<span>{text}</span>
    </motion.div>
  );
}

function CheckCircle({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><path d="m9 11 3 3L22 4" />
    </svg>
  );
}

function XCircle({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <circle cx="12" cy="12" r="10" /><path d="m15 9-6 6 6M9 9 6 6" />
    </svg>
  );
}

function PhysicsTypeBadge({ type }: { type: PhysicsQuestionType }) {
  const map: Record<string, { label: string; color: string }> = {
    'speed-calc': { label: 'Скорость', color: 'bg-sky-900/40 text-sky-300 border-sky-500/40' },
    'graph-read': { label: 'График', color: 'bg-violet-900/40 text-violet-300 border-violet-500/40' },
    friction: { label: 'Трение', color: 'bg-amber-900/40 text-amber-300 border-amber-500/40' },
    'pressure-hydro': { label: 'Давление', color: 'bg-teal-900/40 text-teal-300 border-teal-500/40' },
    buoyancy: { label: 'Архимед', color: 'bg-blue-900/40 text-blue-300 border-blue-500/40' },
    'pressure-units': { label: 'Ед. давления', color: 'bg-cyan-900/40 text-cyan-300 border-cyan-500/40' },
    'volume-displace': { label: 'Объём', color: 'bg-emerald-900/40 text-emerald-300 border-emerald-500/40' },
    'matter-states': { label: 'В-во', color: 'bg-rose-900/40 text-rose-300 border-rose-500/40' },
    'flow-rate': { label: 'Расход', color: 'bg-indigo-900/40 text-indigo-300 border-indigo-500/40' },
    'balance-scale': { label: 'Весы', color: 'bg-orange-900/40 text-orange-300 border-orange-500/40' },
    'density-calc': { label: 'Плотность', color: 'bg-lime-900/40 text-lime-300 border-lime-500/40' },
    'lever-rule': { label: 'Рычаг', color: 'bg-fuchsia-900/40 text-fuchsia-300 border-fuchsia-500/40' },
    'work-energy': { label: 'Работа', color: 'bg-yellow-900/40 text-yellow-300 border-yellow-500/40' },
  };
  const cfg = map[type] || map['speed-calc'];
  return <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold border ${cfg.color}`}>{cfg.label}</span>;
}

/* ═══════════════════════════════════════════════════════════════════════
   REFERENCE SIDEBAR
   ═══════════════════════════════════════════════════════════════════════ */

function ReferenceSidebar({ activeRefTab, setActiveRefTab }: { activeRefTab: string; setActiveRefTab: (t: string) => void }) {
  const tabs = [
    { id: 'formulas', label: 'Формулы', icon: Calculator },
    { id: 'density', label: 'Плотности', icon: Beaker },
    { id: 'friction', label: 'Трение', icon: Gauge },
    { id: 'facts', label: 'Факты', icon: BookOpen },
    { id: 'si', label: 'Приставки', icon: Ruler },
  ];
  return (
    <Card className="bg-[#140e05] border-orange-800/30 overflow-hidden">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2"><BookOpen className="w-4 h-4 text-orange-400" /> Справочник</CardTitle>
      </CardHeader>
      <CardContent className="p-3 space-y-3">
        <div className="flex gap-1 flex-wrap">
          {tabs.map((t) => {
            const Icon = t.icon;
            return (
              <button key={t.id} onClick={() => setActiveRefTab(t.id)}
                className={`flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-bold transition-all ${activeRefTab === t.id ? 'bg-orange-600 text-white' : 'bg-black/20 text-orange-500/60 hover:bg-orange-900/30'}`}
              ><Icon className="w-3 h-3" />{t.label}</button>
            );
          })}
        </div>
        <AnimatePresence mode="wait">
          {activeRefTab === 'formulas' && (
            <motion.div key="f" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-2">
              {FORMULAS.map((f) => (
                <div key={f.formula} className="p-2 bg-black/20 rounded-lg"><div className="font-mono text-orange-400 font-bold text-sm">{f.formula}</div><div className="text-[10px] text-gray-400 mt-0.5">{f.desc}</div><div className="text-[9px] text-gray-600">{f.detail}</div></div>
              ))}
            </motion.div>
          )}
          {activeRefTab === 'density' && (
            <motion.div key="d" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <DensityBarSVG />
            </motion.div>
          )}
          {activeRefTab === 'friction' && (
            <motion.div key="fr" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-1.5">
              {FRICTION_COEFFICIENTS.map((r) => (
                <div key={r.surface} className="flex items-center gap-2 p-1.5 bg-black/20 rounded-lg">
                  <div className="flex-1 text-[10px] text-gray-400">{r.surface}</div>
                  <div className="w-14 text-right text-[10px] font-mono text-orange-400 font-bold">{r.coeff}</div>
                </div>
              ))}
            </motion.div>
          )}
          {activeRefTab === 'facts' && (
            <motion.div key="fa" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              {QUICK_FACTS.map((f, i) => (
                <div key={f.label} className={`flex justify-between items-center py-1.5 ${i < QUICK_FACTS.length - 1 ? 'border-b border-orange-900/20' : ''}`}><span className="text-[11px] text-gray-400">{f.label}</span><span className="text-[11px] font-bold text-amber-300">{f.value}</span></div>
              ))}
            </motion.div>
          )}
          {activeRefTab === 'si' && (
            <motion.div key="si" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-1.5">
              {SI_PREFIXES.map((p) => (
                <div key={p.prefix} className="p-2 bg-black/20 rounded-lg"><div className="text-xs font-bold text-orange-300">{p.prefix} (×{p.factor})</div><div className="text-[10px] text-gray-400">{p.example}</div></div>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </CardContent>
    </Card>
  );
}

/* ═══════════════════════════════════════════════════════════════════════
   RESULTS SUMMARY
   ═══════════════════════════════════════════════════════════════════════ */

function ResultsSummary({ answers, questions }: { answers: Record<number, string | number | null>; questions: PhysicsQuestion[] }) {
  const answered = Object.keys(answers).length;
  const correct = questions.reduce((acc, q) => {
    const ans = answers[q.id];
    if (ans === undefined || ans === null) return acc;
    if (typeof q.correctAnswer === 'number' && typeof ans === 'number') {
      return acc + (Math.abs(ans - q.correctAnswer) <= (q.tolerance || q.correctAnswer * 0.1) ? 1 : 0);
    }
    return acc + (String(ans) === String(q.correctAnswer) ? 1 : 0);
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
    if (typeof q.correctAnswer === 'number' && typeof ans === 'number') {
      if (Math.abs(ans - q.correctAnswer) <= (q.tolerance || q.correctAnswer * 0.1)) acc[q.type].correct++;
    } else if (String(ans) === String(q.correctAnswer)) acc[q.type].correct++;
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
      <Card className="bg-[#140e05] border-orange-800/30">
        <CardHeader className="pb-2"><CardTitle className="text-sm">Результаты по типам</CardTitle></CardHeader>
        <CardContent className="p-3 space-y-2">
          {Object.entries(byType).map(([type, stats]) => (
            <div key={type} className="flex items-center gap-2">
              <PhysicsTypeBadge type={type as PhysicsQuestionType} />
              <div className="flex-1"><div className="h-1.5 bg-orange-950/50 rounded-full overflow-hidden"><motion.div initial={{ width: 0 }} animate={{ width: `${(stats.correct / stats.total) * 100}%` }} transition={{ duration: 0.5 }} className="h-full bg-orange-500 rounded-full" /></div></div>
              <span className="text-xs text-gray-400 font-mono min-w-[40px] text-right">{stats.correct}/{stats.total}</span>
            </div>
          ))}
        </CardContent>
      </Card>
    </motion.div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════════════
   BACKGROUND
   ═══════════════════════════════════════════════════════════════════════ */

function BackgroundPattern() {
  const dots = Array.from({ length: 40 }, (_, i) => ({
    cx: (i * 73 + 20) % 100, cy: (i * 47 + 15) % 100, r: 0.3 + (i % 3) * 0.3,
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
      <div className="absolute top-20 -left-32 w-80 h-80 bg-orange-600/10 rounded-full blur-[120px]" />
      <div className="absolute bottom-40 -right-32 w-96 h-96 bg-amber-500/8 rounded-full blur-[140px]" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-orange-900/5 rounded-full blur-[200px]" />
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════
   MAIN PAGE COMPONENT
   ═══════════════════════════════════════════════════════════════════════ */

export default function Physics7Practice() {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<number, string | number | null>>({});
  const [showHint, setShowHint] = useState(false);
  const [showExplanation, setShowExplanation] = useState(false);
  const [showReference, setShowReference] = useState(false);
  const [showFinish, setShowFinish] = useState(false);
  const [showArchimedesDetail, setShowArchimedesDetail] = useState(false);
  const [activeForce, setActiveForce] = useState<string | null>(null);
  const [matterState, setMatterState] = useState<'solid' | 'liquid' | 'gas'>('solid');
  const [activeRefTab, setActiveRefTab] = useState('formulas');
  const [inputValue, setInputValue] = useState('');
  const referencePanelRef = useRef<HTMLDivElement | null>(null);
  const [inputSubmitted, setInputSubmitted] = useState<number | null>(null);

  const currentQ = QUESTIONS[currentIndex];
  const hasAnswered = answers[currentQ.id] !== undefined && answers[currentQ.id] !== null;

  const isCorrect = useMemo(() => {
    const ans = answers[currentQ.id];
    if (ans === undefined || ans === null) return false;
    if (typeof currentQ.correctAnswer === 'number' && typeof ans === 'number') {
      const tol = currentQ.tolerance ?? currentQ.correctAnswer * 0.1;
      return Math.abs(ans - currentQ.correctAnswer) <= tol;
    }
    return String(ans) === String(currentQ.correctAnswer);
  }, [answers, currentQ]);

  const progress = useMemo(() => {
    const a = Object.keys(answers).filter(k => answers[Number(k)] !== undefined && answers[Number(k)] !== null).length;
    return (a / QUESTIONS.length) * 100;
  }, [answers]);

  const score = useMemo(() => {
    return QUESTIONS.reduce((acc, q) => {
      const ans = answers[q.id];
      if (ans === undefined || ans === null) return acc;
      if (typeof q.correctAnswer === 'number' && typeof ans === 'number') {
        const tol = q.tolerance ?? q.correctAnswer * 0.1;
        return acc + (Math.abs(ans - q.correctAnswer) <= tol ? 1 : 0);
      }
      return acc + (String(ans) === String(q.correctAnswer) ? 1 : 0);
    }, 0);
  }, [answers]);

  const handleSubmitAnswer = useCallback(() => {
    if (hasAnswered || !inputValue) return;
    const val = parseFloat(inputValue.replace(',', '.'));
    if (isNaN(val) || val <= 0) return;
    setInputSubmitted(val);
    setAnswers(prev => ({ ...prev, [currentQ.id]: val }));
    setShowExplanation(true);
  }, [hasAnswered, inputValue, currentQ.id]);

  const nextQuestion = () => {
    if (currentIndex < QUESTIONS.length - 1) {
      setCurrentIndex(prev => prev + 1);
      resetQuestionState();
    } else { setShowFinish(true); }
  };
  const prevQuestion = () => { if (currentIndex > 0) { setCurrentIndex(prev => prev - 1); resetQuestionState(); setShowFinish(false); } };

  const resetQuestionState = () => { setShowHint(false); setShowExplanation(false); setInputValue(''); setInputSubmitted(null); };
  const resetAll = () => { setAnswers({}); setCurrentIndex(0); resetQuestionState(); setShowFinish(false); };

  const isNumericQuestion = !currentQ.options;

  return (
    <div className="min-h-screen bg-[#0f0a04] text-orange-50 relative">
      <BackgroundPattern />
      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

        {/* ════════ HEADER ════════ */}
        <motion.header initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7 }} className="mb-8">
          <div className="flex flex-col md:flex-row items-center gap-6">
            <div className="w-36 h-36 md:w-44 md:h-44 flex-shrink-0">
              <svg viewBox="0 0 200 120" className="w-full h-full">
                <ellipse cx="100" cy="60" rx="60" ry="25" fill="none" stroke="#f97316" strokeWidth="1" opacity="0.3" transform="rotate(-30,100,60)">
                  <animateTransform attributeName="transform" type="rotate" from="-30 100 60" to="330 100 60" dur="20s" repeatCount="indefinite" />
                </ellipse>
                <ellipse cx="100" cy="60" rx="60" ry="25" fill="none" stroke="#fb923c" strokeWidth="1" opacity="0.3" transform="rotate(30,100,60)">
                  <animateTransform attributeName="transform" type="rotate" from="30 100 60" to="-330 100 60" dur="25s" repeatCount="indefinite" />
                </ellipse>
                <ellipse cx="100" cy="60" rx="60" ry="25" fill="none" stroke="#fbbf24" strokeWidth="1" opacity="0.3" transform="rotate(90,100,60)">
                  <animateTransform attributeName="transform" type="rotate" from="90 100 60" to="450 100 60" dur="18s" repeatCount="indefinite" />
                </ellipse>
                <circle cx="100" cy="60" r="10" fill="#f97316" opacity="0.8"><animate attributeName="r" values="10;12;10" dur="2s" repeatCount="indefinite" /></circle>
                <circle cx="100" cy="60" r="5" fill="#fbbf24" />
              </svg>
            </div>
            <div className="text-center md:text-left flex-1">
              <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-gradient-to-r from-orange-500/20 to-amber-500/20 border border-orange-500/30 text-orange-300 text-sm mb-3 uppercase tracking-[0.15em] font-bold">
                <Atom className="w-3.5 h-3.5" /> VPR_PHYS_7 // INTERACTIVE
              </div>
              <h1 className="text-4xl md:text-5xl font-black tracking-tight text-white">
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-300 via-amber-400 to-orange-500">PHYSICS</span>{' '}
                <span className="text-white">LAB</span>
              </h1>
              <p className="text-orange-400/60 text-sm md:text-base mt-1">7 класс — Механика, Давление, Плотность, Архимед</p>
              <div className="flex items-center gap-4 mt-3 justify-center md:justify-start text-xs text-orange-500/60">
                <span className="flex items-center gap-1"><Calculator className="w-3 h-3" /> 20 вопросов</span>
                <span className="flex items-center gap-1"><MousePointerClick className="w-3 h-3" /> Интерактивно</span>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Badge variant="outline" className="bg-black/30 text-orange-300 border-orange-700/50 text-sm"><Trophy className="w-3.5 h-3.5 mr-1" />{score}/{QUESTIONS.length}</Badge>
              <Button variant="outline" size="sm" onClick={resetAll} className="gap-1.5"><RotateCcw className="w-3.5 h-3.5" /> Сброс</Button>
            </div>
          </div>
          <Progress value={progress} className="mt-4 h-1.5 bg-orange-950/50" />
        </motion.header>

        {/* ════════ REFERENCE PANELS (collapsible) ════════ */}
        <div className="grid md:grid-cols-2 gap-6 mb-8">
          {/* Matter states */}
          <motion.section initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="bg-[#140e05] rounded-xl border border-orange-800/40 p-4">
            <div className="flex items-center gap-2 mb-3"><Atom className="text-orange-400 w-5 h-5" /><h2 className="text-lg font-bold text-white">Строение вещества</h2></div>
            <div className="flex gap-2 mb-3 flex-wrap">
              {[{ key: 'solid', label: 'Твёрдое' }, { key: 'liquid', label: 'Жидкость' }, { key: 'gas', label: 'Газ' }].map((ms) => (
                <button key={ms.key} onClick={() => setMatterState(ms.key as 'solid' | 'liquid' | 'gas')}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${matterState === ms.key ? 'bg-orange-500 text-white shadow-lg shadow-orange-500/25' : 'bg-[#140e05] border border-orange-800/40 text-orange-300/70 hover:text-orange-200'}`}
                >{ms.label}</button>
              ))}
            </div>
            <AnimatePresence mode="wait">
              <motion.div key={matterState} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.3 }} className="bg-black/20 rounded-xl border border-orange-800/40 p-4">
                <MoleculeSVG state={matterState} />
              </motion.div>
            </AnimatePresence>
          </motion.section>

          {/* Forces */}
          <motion.section initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="bg-[#140e05] rounded-xl border border-orange-800/40 p-4">
            <div className="flex items-center gap-2 mb-3"><Zap className="text-orange-400 w-5 h-5" /><h2 className="text-lg font-bold text-white">Силы и давление</h2></div>
            <div className="bg-black/20 rounded-xl border border-orange-800/40 p-3 mb-3">
              <ForcesDiagramSVG activeForce={activeForce} />
            </div>
            <PressureSVG />
          </motion.section>

          {/* Archimedes */}
          <motion.section initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="bg-[#140e05] rounded-xl border border-orange-800/40 p-4">
            <div className="flex items-center gap-2 mb-3"><Waves className="text-sky-400 w-5 h-5" /><h2 className="text-lg font-bold text-white">Закон Архимеда</h2></div>
            <div className="flex items-center gap-2 mb-2">
              <button onClick={() => setShowArchimedesDetail(!showArchimedesDetail)} className="text-xs px-3 py-1 rounded-lg bg-black/20 border border-orange-800/40 text-orange-300 hover:bg-orange-900/20 transition-all">
                <Eye className="w-3 h-3 inline mr-1" />{showArchimedesDetail ? 'Скрыть формулу' : 'Показать формулу'}
              </button>
            </div>
            <ArchimedesSVG showDetail={showArchimedesDetail} />
          </motion.section>
        </div>

        {/* ════════ MAIN QUIZ ENGINE ════════ */}
        <motion.section initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2"><Compass className="text-orange-400 w-5 h-5" /><h2 className="text-lg font-bold text-white">Практика по задачам</h2></div>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="bg-black/30 text-orange-300 border-orange-700/50 text-xs">{score}/{QUESTIONS.length}</Badge>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setShowReference((prev) => {
                    const next = !prev;
                    if (next) {
                      requestAnimationFrame(() => {
                        referencePanelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                      });
                    }
                    return next;
                  });
                }}
                className="text-xs gap-1 text-orange-400"
              >
                <BookOpen className="w-3 h-3" /> {showReference ? 'Скрыть справочник' : 'Справочник'} {showReference ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
              </Button>
            </div>
          </div>

          <AnimatePresence mode="wait">
            {showFinish ? (
              <motion.div key="results" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <ResultsSummary answers={answers} questions={QUESTIONS} />
                <div className="flex justify-center gap-3 mt-6">
                  <Button variant="outline" onClick={() => { setShowFinish(false); setCurrentIndex(0); resetQuestionState(); }} className="gap-1.5">← К вопросам</Button>
                  <Button onClick={resetAll} className="gap-1.5 bg-orange-600 hover:bg-orange-500"><RotateCcw className="w-3.5 h-3.5" /> Заново</Button>
                </div>
              </motion.div>
            ) : (
              <motion.div key={currentQ.id} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.3 }} className="space-y-4">
                <Card className="bg-[#140e05] border-orange-800/40">
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <CardTitle className="text-sm flex items-center gap-2"><Target className="w-4 h-4 text-orange-400" />{currentQ.vprType}</CardTitle>
                      <PhysicsTypeBadge type={currentQ.type} />
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <CardTitle className="text-sm leading-relaxed">{currentQ.text}</CardTitle>

                    {/* Graph visual for graph-read questions */}
                    {currentQ.type === 'graph-read' && currentQ.graphData && <SpeedGraphSVG data={currentQ.graphData} />}

                    {/* Friction table */}
                    {currentQ.type === 'friction' && currentQ.frictionTable && (
                      <div className="overflow-x-auto mt-2">
                        <table className="w-full text-xs border-collapse"><thead><tr className="border-b border-orange-800/40"><th className="p-2 text-left text-orange-400">Поверхность</th><th className="p-2 text-right text-orange-400">μ (коэфф.)</th></tr></thead>
                          <tbody>{currentQ.frictionTable.map((r) => <tr key={r.surface} className="border-b border-orange-900/20"><td className="p-2 text-gray-300">{r.surface}</td><td className="p-2 text-right font-mono text-orange-300 font-bold">{r.coeff}</td></tr>)}</tbody></table>
                      </div>
                    )}

                    {/* Solution steps (for multi-step questions) */}
                    {currentQ.solution && showExplanation && (
                      <div className="space-y-1 mt-2 p-3 bg-black/20 rounded-lg border border-orange-900/20">
                        {currentQ.solution.map((step, i) => (
                          <div key={i} className="flex gap-2 items-start"><span className="text-orange-400 font-bold text-xs min-w-[20px]">{i + 1}.</span><span className="text-xs text-gray-300">{step}</span></div>
                        ))}
                      </div>
                    )}

                    {/* Multiple choice options */}
                    {!isNumericQuestion && currentQ.options && (
                      <div className="space-y-2">
                        {currentQ.options.map((opt) => {
                          const isSelected = answers[currentQ.id] === opt;
                          const isCorrectOpt = opt === currentQ.correctAnswer;
                          const showResult = hasAnswered;
                          let btnClass = 'w-full justify-start text-left p-3 rounded-lg border transition-all ';
                          if (showResult) {
                            if (isCorrectOpt) btnClass += 'bg-orange-900/40 border-orange-500/50 text-orange-300';
                            else if (isSelected) btnClass += 'bg-red-900/40 border-red-500/50 text-red-300';
                            else btnClass += 'bg-black/20 border-orange-900/30 text-gray-500';
                          } else { btnClass += 'bg-black/20 border-orange-900/30 hover:bg-orange-900/20 hover:border-orange-700/50 text-gray-300'; }
                          return (
                            <Button key={opt} variant="outline" className={btnClass} onClick={() => { if (!showResult) { setAnswers(prev => ({ ...prev, [currentQ.id]: opt })); setShowExplanation(true); } }} disabled={showResult}>
                              <span className="flex-1">{opt}</span>
                              {showResult && isCorrectOpt && <CheckCircle className="w-4 h-4 ml-auto text-orange-400" />}
                              {showResult && isSelected && !isCorrectOpt && <XCircle className="w-4 h-4 ml-auto text-red-400" />}
                            </Button>
                          );
                        })}
                      </div>
                    )}

                    {/* Numeric input for calculation questions */}
                    {isNumericQuestion && (
                      <div className="space-y-3">
                        {currentQ.correctAnswer === '1) 1950 Н; 2) 0,125 м³; 3) Утонет' || currentQ.correctAnswer === '1) 30 г; 2) 120 г; 3) 215 г' ? (
                          /* Multi-part answer — just show solution, no input */
                          null
                        ) : (
                          <div>
                            <div className="flex gap-2">
                              <Input type="text" placeholder={currentQ.inputUnit ? `Ответ (${currentQ.inputUnit})` : 'Ответ'} value={inputValue} onChange={(e) => setInputValue(e.target.value)} disabled={inputSubmitted !== null} className="bg-black/30 border-orange-800/40 text-white text-sm" />
                              <Button size="sm" onClick={handleSubmitAnswer} disabled={inputSubmitted !== null || !inputValue} className="bg-orange-700 hover:bg-orange-600 shrink-0">Проверить</Button>
                            </div>
                            {inputSubmitted !== null && (
                              <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                                className={`p-3 rounded-lg border text-sm ${isCorrect ? 'bg-orange-900/40 border-orange-500/50 text-orange-300' : 'bg-red-900/40 border-red-500/50 text-red-300'}`}
                              >
                                <div className="flex items-center gap-2">
                                  {isCorrect ? <CheckCircle className="w-4 h-4 shrink-0" /> : <XCircle className="w-4 h-4 shrink-0" />}
                                  <span>{isCorrect ? `Верно! Ответ: ${inputSubmitted} ${currentQ.inputUnit}` : `Не совсем. Правильный ответ: ${currentQ.correctAnswer} ${currentQ.inputUnit}. Ваш: ${inputSubmitted}`}</span>
                                </div>
                              </motion.div>
                            )}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Hint & Explanation */}
                    <div className="space-y-2">
                      {!hasAnswered && currentQ.hint && (
                        <Button variant="ghost" size="sm" onClick={() => setShowHint(true)} className="text-amber-400 hover:text-amber-300 hover:bg-amber-900/20 gap-1.5"><Lightbulb className="w-3.5 h-3.5" /> Подсказка</Button>
                      )}
                      {showHint && currentQ.hint && <FeedbackBadge status="hint" text={currentQ.hint} />}
                      {showExplanation && <FeedbackBadge status={isCorrect ? 'success' : 'error'} text={currentQ.explanation} />}
                    </div>
                  </CardContent>
                </Card>

                {/* Navigation */}
                <div className="flex items-center justify-between gap-2">
                  <Button variant="outline" size="sm" onClick={prevQuestion} disabled={currentIndex === 0} className="gap-1.5"><ArrowLeft className="w-3.5 h-3.5" /> Назад</Button>
                  <span className="text-xs text-orange-500/60 font-mono">{currentIndex + 1} / {QUESTIONS.length}</span>
                  {currentIndex < QUESTIONS.length - 1 ? (
                    <Button size="sm" onClick={nextQuestion} className="gap-1.5 bg-orange-700 hover:bg-orange-600">Далее <ArrowRight className="w-3.5 h-3.5" /></Button>
                  ) : (
                    <Button size="sm" onClick={() => setShowFinish(true)} className="gap-1.5 bg-amber-700 hover:bg-amber-600"><Trophy className="w-3.5 h-3.5" /> Итоги</Button>
                  )}
                </div>

                {/* Quick Stats */}
                <Card className="bg-[#140e05] border-orange-800/30">
                  <CardContent className="p-3 grid grid-cols-4 gap-2 text-center">
                    <div className="bg-black/20 p-2 rounded-lg"><div className="text-lg font-bold text-orange-400">{score}</div><div className="text-[9px] text-gray-500">Верно</div></div>
                    <div className="bg-black/20 p-2 rounded-lg"><div className="text-lg font-bold text-red-400">{Object.keys(answers).filter(k => answers[Number(k)] !== undefined && answers[Number(k)] !== null).length - score}</div><div className="text-[9px] text-gray-500">Ошибки</div></div>
                    <div className="bg-black/20 p-2 rounded-lg"><div className="text-lg font-bold text-amber-400">{QUESTIONS.length - Object.keys(answers).filter(k => answers[Number(k)] !== undefined && answers[Number(k)] !== null).length}</div><div className="text-[9px] text-gray-500">Осталось</div></div>
                    <div className="bg-black/20 p-2 rounded-lg"><div className="text-lg font-bold text-sky-400">{Math.round((score / Math.max(1, Object.keys(answers).filter(k => answers[Number(k)] !== undefined && answers[Number(k)] !== null).length)) * 100)}%</div><div className="text-[9px] text-gray-500">Точность</div></div>
                  </CardContent>
                </Card>

                {/* Reference sidebar */}
                <AnimatePresence>
                  {showReference && (
                    <motion.div ref={referencePanelRef} initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="mt-4 overflow-hidden">
                      <ReferenceSidebar activeRefTab={activeRefTab} setActiveRefTab={setActiveRefTab} />
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.section>
      </div>
    </div>
  );
}
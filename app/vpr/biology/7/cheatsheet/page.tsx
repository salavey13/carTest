'use client';

import React, { useState, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import {
  Leaf, Flower2, Microscope, TreePine, Sprout, ShieldAlert,
  Activity, MousePointerClick, ChevronDown, ChevronUp, ArrowLeft,
  Eye, Zap, Droplets, Sun, Wind, Bug, Dna, Layers,
  Apple, CheckCircle2, AlertTriangle, RotateCcw, TreeDeciduous, Shrub,
} from "lucide-react";

// ─── Floating Leaf Background ─────────────────────────────────────
function FloatingLeafBg() {
  const leaves = useMemo(() => {
    const items = [];
    for (let i = 0; i < 45; i++) {
      items.push({
        left: `${(i * 37 + 10) % 100}%`,
        size: 6 + (i % 4) * 4,
        dur: 12 + (i % 7) * 5,
        delay: (i * -3.7) % 20,
        opacity: 0.04 + (i % 5) * 0.02,
        rot: (i * 73) % 360,
      });
    }
    return items;
  }, []);

  return (
    <div className="fixed inset-0 overflow-hidden pointer-events-none z-0" aria-hidden="true">
      <style>{`
        @keyframes leafFloat {
          0% { transform: translateY(100vh) rotate(0deg); opacity: 0; }
          10% { opacity: var(--lo); }
          90% { opacity: var(--lo); }
          100% { transform: translateY(-10vh) rotate(var(--lr)); opacity: 0; }
        }
        .lfloat { animation: leafFloat var(--ld) linear infinite; animation-delay: var(--ldel); }
      `}</style>
      {leaves.map((l, i) => (
        <svg key={i} className="lfloat absolute" style={{
          left: l.left, width: l.size, height: l.size,
          "--ld": `${l.dur}s`, "--ldel": `${l.delay}s`, "--lo": l.opacity, "--lr": `${l.rot}deg`,
        } as React.CSSProperties} viewBox="0 0 20 20" fill="none">
          <path d="M10 2 Q16 6 14 14 Q10 18 6 14 Q4 6 10 2Z" fill="#10b981" opacity="0.6" />
          <line x1="10" y1="3" x2="10" y2="17" stroke="#059669" strokeWidth="0.5" />
        </svg>
      ))}
      <div className="absolute top-20 -left-32 w-80 h-80 bg-emerald-600/10 rounded-full blur-[120px]" />
      <div className="absolute bottom-40 -right-32 w-96 h-96 bg-green-500/8 rounded-full blur-[140px]" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-emerald-900/5 rounded-full blur-[200px]" />
    </div>
  );
}

// ─── Panel with corner decorations ─────────────────────────────────
function Panel({ children, className = "", glow = false }: { children: React.ReactNode; className?: string; glow?: boolean }) {
  return (
    <div className={`relative rounded-xl border border-emerald-800/40 bg-[#040f0a] overflow-hidden ${glow ? "shadow-[0_0_40px_rgba(16,185,129,0.15)]" : ""} ${className}`}>
      <div className="absolute -top-px -left-px w-4 h-4 border-t-2 border-l-2 border-emerald-500/60" />
      <div className="absolute -top-px -right-px w-4 h-4 border-t-2 border-r-2 border-emerald-500/60" />
      <div className="absolute -bottom-px -left-px w-4 h-4 border-b-2 border-l-2 border-emerald-500/60" />
      <div className="absolute -bottom-px -right-px w-4 h-4 border-b-2 border-r-2 border-emerald-500/60" />
      <div className="absolute top-0 left-4 right-4 h-px bg-gradient-to-r from-transparent via-emerald-500/30 to-transparent" />
      {children}
    </div>
  );
}

// ─── InfoCard ──────────────────────────────────────────────────────
function InfoCard({ title, children, icon: Icon, className = "" }: { title: string; children: React.ReactNode; icon: React.ElementType; className?: string }) {
  return (
    <motion.div
      whileHover={{ scale: 1.02, boxShadow: "0 0 30px rgba(16,185,129,0.15)" }}
      transition={{ type: "spring", stiffness: 400, damping: 20 }}
      className={`rounded-xl border border-emerald-800/40 bg-[#040f0a] p-5 transition-all hover:border-emerald-500/50 ${className}`}
    >
      <div className="flex items-center gap-3 mb-3">
        <div className="p-2 rounded-lg bg-emerald-900/30 border border-emerald-700/30">
          <Icon className="w-5 h-5 text-emerald-400" />
        </div>
        <h3 className="text-emerald-200 font-bold text-sm">{title}</h3>
      </div>
      {children}
    </motion.div>
  );
}

// ─── Section Header ────────────────────────────────────────────────
function SectionHeader({ icon: Icon, title, subtitle }: { icon: React.ElementType; title: string; subtitle: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, x: -30 }}
      whileInView={{ opacity: 1, x: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.5 }}
      className="flex items-center gap-3 mb-8"
    >
      <div className="p-3 bg-emerald-900/30 rounded-xl border border-emerald-700/40">
        <Icon className="text-emerald-400 w-7 h-7" />
      </div>
      <div>
        <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-white">{title}</h2>
        <p className="text-emerald-500/60 text-sm">{subtitle}</p>
      </div>
    </motion.div>
  );
}

// ─── Expandable ────────────────────────────────────────────────────
function Expandable({ title, children, defaultOpen = false }: { title: string; children: React.ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="bg-[#0a1a14] rounded-xl border border-emerald-800/40 overflow-hidden">
      <button onClick={() => setOpen(!open)} className="w-full flex items-center justify-between p-4 sm:p-5 text-left hover:bg-emerald-900/10 transition-colors cursor-pointer">
        <span className="text-emerald-100 font-semibold text-base sm:text-lg">{title}</span>
        <motion.div animate={{ rotate: open ? 180 : 0 }} transition={{ duration: 0.2 }}>
          {open ? <ChevronUp className="w-5 h-5 text-emerald-400" /> : <ChevronDown className="w-5 h-5 text-emerald-400" />}
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
            <div className="px-4 sm:px-5 pb-4 sm:pb-5 pt-1">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Correct Answer Badge ──────────────────────────────────────────
function AnswerBadge({ answer, label }: { answer: string; label?: string }) {
  return (
    <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-emerald-500/10 border border-emerald-500/30 rounded-lg mt-2">
      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
      <span className="text-emerald-300 font-bold text-sm">{label ? `${label}: ` : ""}{answer}</span>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
//  SVG 1: PlantCellSVG — Interactive Plant Cell
// ═══════════════════════════════════════════════════════════════════
type Organelle = 'wall' | 'membrane' | 'chloroplast' | 'vacuole' | 'nucleus' | 'mitochondria' | 'er' | 'ribosome' | null;

const organelleInfo: Record<string, { label: string; desc: string; color: string }> = {
  wall: { label: 'Клеточная стенка', desc: 'Жёсткая оболочка из целлюлозы. Придаёт форму клетке, защищает от механических повреждений. Присутствует только у растений и грибов.', color: '#34d399' },
  membrane: { label: 'Клеточная мембрана', desc: 'Тонкая плёнка под клеточной стенкой. Контролирует транспорт веществ в клетку и из неё. Полупроницаема — пропускает одни вещества и задерживает другие.', color: '#6ee7b7' },
  chloroplast: { label: 'Хлоропласт (хроматофор)', desc: 'Содержит хлорофилл — зелёный пигмент. Место фотосинтеза: из CO₂ и воды образуются органические вещества и кислород. Есть только у растений!', color: '#22c55e' },
  vacuole: { label: 'Вакуоль', desc: 'Крупный резервуар с клеточным соком. Хранит воду, питательные вещества и отходы. У растительных клеток vacuole занимает большую часть объёма. Поддерживает тургор.', color: '#38bdf8' },
  nucleus: { label: 'Ядро', desc: 'Хранит ДНК и управляет жизнедеятельностью клетки. Содержит ядрышко, где синтезируется РНК. Признак эукариотической клетки (в отличие от бактерий!).', color: '#a78bfa' },
  mitochondria: { label: 'Митохондрии', desc: '«Электростанции» клетки. Вырабатывают энергию (АТФ) в процессе клеточного дыхания. Есть и у растений, и у животных.', color: '#f59e0b' },
  er: { label: 'Эндоплазматическая сеть', desc: 'Транспортная система клетки. Перемещает вещества. Бывает гладкой (липиды) и шероховатой (с рибосомами — белки).', color: '#06b6d4' },
  ribosome: { label: 'Рибосомы', desc: 'Мельчайшие органеллы — «фабрики белка». Синтезируют белки по инструкции от ДНК. Встречаются в цитоплазме и на шероховатой ЭПС.', color: '#f472b6' },
};

function PlantCellSVG({ active, onHover }: { active: Organelle; onHover: (o: Organelle) => void }) {
  const op = (key: string) => active ? (active === key ? 1 : 0.15) : 0.7;
  return (
    <svg viewBox="0 0 320 280" className="w-full h-64 sm:h-72" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <radialGradient id="cytoGrad" cx="50%" cy="50%" r="50%"><stop offset="0%" stopColor="#0a2e1f" /><stop offset="100%" stopColor="#061a10" /></radialGradient>
        <filter id="cGlow"><feGaussianBlur stdDeviation="3" result="b" /><feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
      </defs>
      {/* Cell Wall */}
      <g onMouseEnter={() => onHover('wall')} onMouseLeave={() => onHover(null)} className="cursor-pointer">
        <rect x="15" y="15" width="290" height="250" rx="20" fill="none" stroke="#34d399" strokeWidth="4" opacity={op('wall')} strokeDasharray={active === 'wall' ? '0' : '0'} />
        {active === 'wall' && <text x="160" y="10" textAnchor="middle" fill="#34d399" fontSize="10" fontWeight="bold">Клеточная стенка</text>}
      </g>
      {/* Cell Membrane */}
      <g onMouseEnter={() => onHover('membrane')} onMouseLeave={() => onHover(null)} className="cursor-pointer">
        <rect x="22" y="22" width="276" height="236" rx="17" fill="none" stroke="#6ee7b7" strokeWidth="1.5" opacity={op('membrane')} strokeDasharray="4 3" />
        {active === 'membrane' && <text x="160" y="270" textAnchor="middle" fill="#6ee7b7" fontSize="9">Мембрана</text>}
      </g>
      {/* Cytoplasm */}
      <rect x="25" y="25" width="270" height="230" rx="15" fill="url(#cytoGrad)" opacity="0.8" />
      {/* Vacuole */}
      <g onMouseEnter={() => onHover('vacuole')} onMouseLeave={() => onHover(null)} className="cursor-pointer">
        <ellipse cx="160" cy="140" rx="95" ry="75" fill="#38bdf8" opacity={op('vacuole') * 0.15} stroke="#38bdf8" strokeWidth="1.5" />
        {active === 'vacuole' && <text x="160" y="145" textAnchor="middle" fill="#38bdf8" fontSize="11" fontWeight="bold">Вакуоль</text>}
        <text x="160" y="155" textAnchor="middle" fill="#38bdf8" fontSize="8" opacity="0.5">клеточный сок</text>
      </g>
      {/* Chloroplasts */}
      {[[70, 70], [230, 90], [90, 200], [220, 190]].map(([cx, cy], i) => (
        <g key={`ch-${i}`} onMouseEnter={() => onHover('chloroplast')} onMouseLeave={() => onHover(null)} className="cursor-pointer">
          <ellipse cx={cx} cy={cy} rx="18" ry="10" fill="#22c55e" opacity={op('chloroplast') * 0.35} stroke="#22c55e" strokeWidth="1" transform={`rotate(${30 + i * 20}, ${cx}, ${cy})`} />
          <line x1={cx - 10} y1={cy} x2={cx + 10} y2={cy} stroke="#16a34a" strokeWidth="0.5" opacity={op('chloroplast') * 0.5} transform={`rotate(${30 + i * 20}, ${cx}, ${cy})`} />
        </g>
      ))}
      {active === 'chloroplast' && <text x="160" y="45" textAnchor="middle" fill="#22c55e" fontSize="10" fontWeight="bold">Хлоропласты</text>}
      {/* ER */}
      <g onMouseEnter={() => onHover('er')} onMouseLeave={() => onHover(null)} className="cursor-pointer">
        <path d="M50,100 Q80,85 110,100 Q140,115 170,100 Q200,85 230,100" fill="none" stroke="#06b6d4" strokeWidth="1" opacity={op('er')} strokeDasharray="3 2" />
        <path d="M55,170 Q85,155 115,170 Q145,185 175,170 Q205,155 235,170" fill="none" stroke="#06b6d4" strokeWidth="1" opacity={op('er')} strokeDasharray="3 2" />
        {active === 'er' && <text x="50" y="135" fill="#06b6d4" fontSize="9" fontWeight="bold">ЭПС</text>}
      </g>
      {/* Mitochondria */}
      {[[110, 120], [200, 160]].map(([cx, cy], i) => (
        <g key={`m-${i}`} onMouseEnter={() => onHover('mitochondria')} onMouseLeave={() => onHover(null)} className="cursor-pointer">
          <ellipse cx={cx} cy={cy} rx="14" ry="8" fill="#f59e0b" opacity={op('mitochondria') * 0.3} stroke="#f59e0b" strokeWidth="1" />
          <path d={`M${cx - 6},${cy - 2} Q${cx},${cy + 3} ${cx + 6},${cy - 1}`} fill="none" stroke="#fbbf24" strokeWidth="0.5" opacity={op('mitochondria') * 0.5} />
        </g>
      ))}
      {active === 'mitochondria' && <text x="250" y="115" fill="#f59e0b" fontSize="9" fontWeight="bold">Митохондрии</text>}
      {/* Ribosomes */}
      <g onMouseEnter={() => onHover('ribosome')} onMouseLeave={() => onHover(null)} className="cursor-pointer">
        {[[130, 85], [180, 105], [150, 195], [190, 210], [100, 140], [250, 130]].map(([cx, cy], i) => (
          <circle key={`r-${i}`} cx={cx} cy={cy} r="2" fill="#f472b6" opacity={op('ribosome')}>
            <animate attributeName="opacity" values={`${op('ribosome')};${op('ribosome') * 0.3};${op('ribosome')}`} dur={`${2 + i * 0.3}s`} repeatCount="indefinite" />
          </circle>
        ))}
        {active === 'ribosome' && <text x="260" y="200" fill="#f472b6" fontSize="9" fontWeight="bold">Рибосомы</text>}
      </g>
      {/* Nucleus */}
      <g onMouseEnter={() => onHover('nucleus')} onMouseLeave={() => onHover(null)} className="cursor-pointer">
        <ellipse cx="160" cy="140" rx="30" ry="28" fill="#1e1b4b" opacity={op('nucleus') * 0.7} stroke="#a78bfa" strokeWidth="1.5" />
        <circle cx="155" cy="135" r="8" fill="#a78bfa" opacity={op('nucleus') * 0.3} />
        <text x="155" y="138" textAnchor="middle" fill="#c4b5fd" fontSize="7" opacity={op('nucleus')}>ядрышко</text>
        {active === 'nucleus' && <text x="160" y="140" textAnchor="middle" fill="#a78bfa" fontSize="10" fontWeight="bold">Ядро</text>}
      </g>
      {/* Pulse ring */}
      {active && (
        <circle cx="160" cy="140" r="30" fill="none" stroke={organelleInfo[active]?.color || '#10b981'} strokeWidth="0.5" opacity="0.3">
          <animate attributeName="r" values="30;80;30" dur="2.5s" repeatCount="indefinite" />
          <animate attributeName="opacity" values="0.3;0;0.3" dur="2.5s" repeatCount="indefinite" />
        </circle>
      )}
    </svg>
  );
}

// ═══════════════════════════════════════════════════════════════════
//  SVG 2: EvolutionTimelineSVG
// ═══════════════════════════════════════════════════════════════════
const evoChain = [
  { name: 'Зелёные водоросли', num: '1', x: 40, y: 310, color: '#4ade80', desc: 'Хлорелла, Хламидомонада. Нет тканей и органов.' },
  { name: 'Красные водоросли', num: '2', x: 40, y: 275, color: '#f87171', desc: 'Порфира. На большой глубине.' },
  { name: 'Бурые водоросли', num: '3', x: 40, y: 240, color: '#d97706', desc: 'Ламинария. В морях.' },
  { name: 'Мхи', num: '4', x: 40, y: 205, color: '#10b981', desc: 'Кукушкин лён, Сфагнум. Нет корней — ризоиды.' },
  { name: 'Плауны', num: '5', x: 40, y: 170, color: '#14b8a6', desc: 'Споры в колосках.' },
  { name: 'Папоротники', num: '6', x: 40, y: 135, color: '#06b6d4', desc: 'Вайи. Споровые.' },
  { name: 'Хвощи', num: '7', x: 40, y: 100, color: '#22d3ee', desc: 'Членистые стебли.' },
  { name: 'Голосеменные', num: '8', x: 40, y: 65, color: '#a3e635', desc: 'Хвойные. Семена в шишках.' },
  { name: 'Однодольные', num: '9', x: 40, y: 30, color: '#f472b6', desc: 'Злаковые, Лилейные.' },
  { name: 'Двудольные', num: '10', x: 40, y: -5, color: '#fb923c', desc: 'Розоцветные, Бобовые...' },
];

function EvolutionTimelineSVG() {
  return (
    <svg viewBox="-10 -20 500 360" className="w-full h-80 sm:h-96" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="evoG" x1="0" y1="1" x2="0" y2="0"><stop offset="0%" stopColor="#4ade80" /><stop offset="50%" stopColor="#06b6d4" /><stop offset="100%" stopColor="#fb923c" /></linearGradient>
        <filter id="eGlow"><feGaussianBlur stdDeviation="2.5" result="b" /><feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
      </defs>
      {/* Main trunk */}
      <line x1="40" y1="330" x2="40" y2="-10" stroke="url(#evoG)" strokeWidth="3" strokeLinecap="round" opacity="0.4" />
      {/* Branches */}
      {evoChain.map((item, i) => {
        const branchLen = 60 + i * 20;
        return (
          <g key={i}>
            <motion.line initial={{ x2: 40 }} whileInView={{ x2: 40 + branchLen }} viewport={{ once: true }} transition={{ duration: 0.6, delay: i * 0.1, ease: 'easeOut' }} x1="40" y1={item.y} x2={40 + branchLen} y2={item.y} stroke={item.color} strokeWidth="2" strokeLinecap="round" filter="url(#eGlow)" />
            <motion.circle initial={{ scale: 0 }} whileInView={{ scale: 1 }} viewport={{ once: true }} transition={{ delay: i * 0.1 + 0.3, type: 'spring' }} cx="40" cy={item.y} r="5" fill={item.color} />
            <motion.g initial={{ opacity: 0, x: 10 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.1 + 0.4 }}>
              <text x={55 + branchLen} y={item.y - 4} fill={item.color} fontSize="11" fontWeight="bold">{item.name}</text>
              <text x={55 + branchLen} y={item.y + 10} fill={item.color} fontSize="8" opacity="0.5">{item.desc}</text>
            </motion.g>
            <circle r="2.5" fill={item.color} opacity="0.5">
              <animateMotion dur={`${2 + i * 0.4}s`} repeatCount="indefinite" path={`M40,${item.y} L${40 + branchLen},${item.y}`} />
            </circle>
          </g>
        );
      })}
      {/* Complexity arrow */}
      <motion.g initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }} transition={{ delay: 1.5 }}>
        <line x1="470" y1="320" x2="470" y2="0" stroke="#10b981" strokeWidth="1" opacity="0.3" />
        <polygon points="470,-5 465,10 475,10" fill="#10b981" opacity="0.4" />
        <text x="470" y="345" textAnchor="middle" fill="#10b981" fontSize="9" opacity="0.4">Сложность</text>
      </motion.g>
    </svg>
  );
}

// ═══════════════════════════════════════════════════════════════════
//  SVG 3: FlowerFormulaSVG
// ═══════════════════════════════════════════════════════════════════
function FlowerFormulaSVG() {
  const [hovered, setHovered] = useState<string | null>();
  const parts = [
    { id: 'sepal', label: 'Чашелистик', color: '#22c55e', angle: -90, count: 5 },
    { id: 'petal', label: 'Лепесток', color: '#f472b6', angle: -45, count: 5 },
    { id: 'stamen', label: 'Тычинка', color: '#fbbf24', angle: 0, count: '∞' },
    { id: 'pistil', label: 'Пестик', color: '#a78bfa', angle: 20, count: '∞' },
  ];
  const cx = 140, cy = 140;
  return (
    <div className="flex flex-col items-center gap-4">
      <svg viewBox="0 0 280 280" className="w-56 h-56" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <filter id="fGlow"><feGaussianBlur stdDeviation="2" result="b" /><feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
        </defs>
        {/* Peduncle */}
        <line x1={cx} y1={cy + 60} x2={cx} y2={270} stroke="#22c55e" strokeWidth="3" />
        {/* Sepals */}
        {Array.from({ length: 5 }).map((_, i) => {
          const a = (i / 5) * Math.PI * 2 - Math.PI / 2;
          const x = cx + Math.cos(a) * 50;
          const y = cy + Math.sin(a) * 50;
          return (
            <g key={`s-${i}`} onMouseEnter={() => setHovered('sepal')} onMouseLeave={() => setHovered(null)} className="cursor-pointer" filter={hovered === 'sepal' ? 'url(#fGlow)' : undefined}>
              <ellipse cx={x} cy={y} rx="12" ry="22" fill="#22c55e" opacity={hovered === 'sepal' || !hovered ? 0.35 : 0.15} stroke="#22c55e" strokeWidth="1" transform={`rotate(${(i / 5) * 360},${x},${y})`} />
            </g>
          );
        })}
        {/* Petals */}
        {Array.from({ length: 5 }).map((_, i) => {
          const a = (i / 5) * Math.PI * 2 - Math.PI / 2 + 0.3;
          const x = cx + Math.cos(a) * 38;
          const y = cy + Math.sin(a) * 38;
          return (
            <g key={`p-${i}`} onMouseEnter={() => setHovered('petal')} onMouseLeave={() => setHovered(null)} className="cursor-pointer" filter={hovered === 'petal' ? 'url(#fGlow)' : undefined}>
              <ellipse cx={x} cy={y} rx="15" ry="28" fill="#f472b6" opacity={hovered === 'petal' || !hovered ? 0.4 : 0.15} stroke="#f472b6" strokeWidth="1" transform={`rotate(${(i / 5) * 360},${x},${y})`} />
            </g>
          );
        })}
        {/* Stamens */}
        {Array.from({ length: 8 }).map((_, i) => {
          const a = (i / 8) * Math.PI * 2;
          const x = cx + Math.cos(a) * 22;
          const y = cy + Math.sin(a) * 22;
          return (
            <g key={`st-${i}`} onMouseEnter={() => setHovered('stamen')} onMouseLeave={() => setHovered(null)} className="cursor-pointer">
              <line x1={cx} y1={cy} x2={x} y2={y} stroke="#fbbf24" strokeWidth="1" opacity={hovered === 'stamen' || !hovered ? 0.6 : 0.2} />
              <circle cx={x} cy={y} r="3" fill="#fbbf24" opacity={hovered === 'stamen' || !hovered ? 0.8 : 0.3} />
            </g>
          );
        })}
        {/* Pistil */}
        <g onMouseEnter={() => setHovered('pistil')} onMouseLeave={() => setHovered(null)} className="cursor-pointer">
          <circle cx={cx} cy={cy} r="8" fill="#a78bfa" opacity={hovered === 'pistil' || !hovered ? 0.5 : 0.2} stroke="#a78bfa" strokeWidth="1.5" />
          <circle cx={cx} cy={cy - 4} r="4" fill="#c4b5fd" opacity={hovered === 'pistil' || !hovered ? 0.7 : 0.3} />
        </g>
        {/* Label */}
        {hovered && (() => {
          const p = parts.find(x => x.id === hovered);
          return p && <text x={cx} y={20} textAnchor="middle" fill={p.color} fontSize="11" fontWeight="bold">{p.label}</text>;
        })()}
      </svg>
      {/* Formula legend */}
      <div className="grid grid-cols-2 gap-2 w-full max-w-sm">
        {parts.map(p => (
          <motion.div key={p.id} whileHover={{ scale: 1.05 }} onMouseEnter={() => setHovered(p.id)} onMouseLeave={() => setHovered(null)} className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border cursor-pointer transition-all ${hovered === p.id ? 'bg-white/5 border-white/20' : 'border-emerald-800/30'}`}>
            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: p.color }} />
            <span className="text-sm text-emerald-100">{p.label}: <strong className="text-white">{String(p.count)}</strong></span>
          </motion.div>
        ))}
      </div>
      {/* Formula output */}
      <div className="text-center px-4 py-2 bg-emerald-500/10 border border-emerald-500/20 rounded-lg">
        <p className="text-emerald-300 text-xs mb-1">Формула цветка (Земляника лесная):</p>
        <p className="text-white font-bold text-lg">♂♀ * Ч5 Л5 Т∞ П∞</p>
        <p className="text-emerald-400/60 text-xs mt-1">обоеполый · правильный · чашечка 5 · венчик 5 · тычинки ∞ · пестик ∞</p>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
//  SVG 4: FruitTreeSVG
// ═══════════════════════════════════════════════════════════════════
function FruitTreeSVG() {
  const [active, setActive] = useState<string | null>();
  const fruits = [
    { id: 'berry', label: 'Ягода', examples: 'Виноград, Томат, Смородина', color: '#ef4444', seeds: 'Много семян' },
    { id: 'drupe', label: 'Костянка', examples: 'Вишня, Слива, Персик', color: '#a855f7', seeds: '1 косточка' },
    { id: 'apple', label: 'Яблоко', examples: 'Яблоня, Рябина, Груша', color: '#f59e0b', seeds: 'Много семян' },
    { id: 'bean', label: 'Боб', examples: 'Горох, Акация, Фасоль', color: '#22c55e', seeds: 'Много семян' },
    { id: 'box', label: 'Коробочка', examples: 'Лилия, Мак, Лён', color: '#06b6d4', seeds: 'Много семян' },
    { id: 'grain', label: 'Зерновка', examples: 'Пшеница, Рис, Кукуруза', color: '#eab308', seeds: '1 семя' },
    { id: 'achene', label: 'Семечка', examples: 'Подсолнух, Одуванчик', color: '#f97316', seeds: '1 семя' },
  ];
  return (
    <div className="space-y-4">
      {/* Main tree */}
      <svg viewBox="0 0 500 180" className="w-full" xmlns="http://www.w3.org/2000/svg">
        {/* Root node */}
        <rect x="200" y="70" width="100" height="40" rx="8" fill="#040f0a" stroke="#10b981" strokeWidth="2" />
        <text x="250" y="95" textAnchor="middle" fill="#10b981" fontSize="12" fontWeight="bold">Плоды</text>
        {/* Level 1 branches */}
        <line x1="250" y1="70" x2="100" y2="40" stroke="#10b981" strokeWidth="1.5" />
        <line x1="250" y1="70" x2="400" y2="40" stroke="#10b981" strokeWidth="1.5" />
        {/* Сочные */}
        <rect x="30" y="15" width="140" height="40" rx="8" fill="#040f0a" stroke="#ef4444" strokeWidth="1.5" />
        <text x="100" y="40" textAnchor="middle" fill="#ef4444" fontSize="11" fontWeight="bold">Сочные</text>
        {/* Сухие */}
        <rect x="330" y="15" width="140" height="40" rx="8" fill="#040f0a" stroke="#eab308" strokeWidth="1.5" />
        <text x="400" y="40" textAnchor="middle" fill="#eab308" fontSize="11" fontWeight="bold">Сухие</text>
        {/* Level 2 — Сочные subtypes */}
        <line x1="70" y1="15" x2="30" y2="-15" stroke="#ef444460" strokeWidth="1" />
        <line x1="100" y1="15" x2="100" y2="-15" stroke="#ef444460" strokeWidth="1" />
        <line x1="130" y1="15" x2="170" y2="-15" stroke="#ef444460" strokeWidth="1" />
        <text x="30" y="-20" textAnchor="middle" fill="#ef4444" fontSize="9">ягода</text>
        <text x="100" y="-20" textAnchor="middle" fill="#a855f7" fontSize="9">костянка</text>
        <text x="170" y="-20" textAnchor="middle" fill="#f59e0b" fontSize="9">яблоко</text>
        {/* Level 2 — Сухие subtypes */}
        <line x1="370" y1="15" x2="330" y2="-15" stroke="#eab30860" strokeWidth="1" />
        <line x1="400" y1="15" x2="400" y2="-15" stroke="#eab30860" strokeWidth="1" />
        <line x1="430" y1="15" x2="470" y2="-15" stroke="#eab30860" strokeWidth="1" />
        <text x="330" y="-20" textAnchor="middle" fill="#22c55e" fontSize="9">боб</text>
        <text x="400" y="-20" textAnchor="middle" fill="#06b6d4" fontSize="9">коробочка</text>
        <text x="470" y="-20" textAnchor="middle" fill="#eab308" fontSize="9">зерновка</text>
        {/* Seed count labels */}
        <text x="100" y="135" textAnchor="middle" fill="#ef444490" fontSize="9">Многосемянные / Односемянные</text>
      </svg>
      {/* Detail cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
        {fruits.map(f => (
          <motion.div key={f.id} whileHover={{ scale: 1.03 }} onMouseEnter={() => setActive(f.id)} onMouseLeave={() => setActive(null)} className={`p-3 rounded-lg border cursor-pointer transition-all ${active === f.id ? 'bg-white/5 border-white/20' : 'border-emerald-800/30 bg-[#0a1a14]'}`}>
            <div className="flex items-center gap-2 mb-1">
              <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: f.color }} />
              <span className="font-bold text-white text-sm">{f.label}</span>
            </div>
            <p className="text-xs text-emerald-200/60">{f.examples}</p>
            <p className="text-xs text-emerald-400/50 mt-1">{f.seeds}</p>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
//  SVG 5: ChlamydomonasCycleSVG
// ═══════════════════════════════════════════════════════════════════
function ChlamydomonasCycleSVG() {
  const [hovered, setHovered] = useState<'A' | 'B' | null>();
  return (
    <svg viewBox="0 0 400 250" className="w-full max-w-lg mx-auto" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <filter id="chGlow"><feGaussianBlur stdDeviation="2" result="b" /><feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
      </defs>
      {/* Large chlamydomonas (parent) */}
      <g onMouseEnter={() => setHovered('B')} onMouseLeave={() => setHovered(null)} className="cursor-pointer">
        <ellipse cx="200" cy="70" rx="45" ry="35" fill="#22c55e" opacity={hovered === 'B' || !hovered ? 0.3 : 0.1} stroke="#22c55e" strokeWidth="2" />
        <circle cx="200" cy="65" r="15" fill="#16a34a" opacity="0.4" />
        <line x1="245" y1="70" x2="270" y2="55" stroke="#4ade80" strokeWidth="1.5" />
        <circle cx="200" cy="50" r="3" fill="#fbbf24" />
        {hovered === 'B' && <text x="200" y="25" textAnchor="middle" fill="#fbbf24" fontSize="11" fontWeight="bold">Вегетативная клетка</text>}
      </g>
      {/* Arrow down to zoospores (A path — sexual) */}
      <g onMouseEnter={() => setHovered('A')} onMouseLeave={() => setHovered(null)} className="cursor-pointer">
        <motion.path d="M200,105 L200,155" stroke={hovered === 'A' ? '#f472b6' : '#f472b680'} strokeWidth="2" markerEnd="url(#arrowP)" />
        <text x="160" y="135" fill="#f472b6" fontSize="14" fontWeight="bold">А</text>
        <text x="140" y="150" fill="#f472b680" fontSize="9">Половое размножение</text>
        <text x="120" y="163" fill="#f472b660" fontSize="8">(неблагоприятные условия)</text>
      </g>
      {/* Gametes */}
      <g onMouseEnter={() => setHovered('A')} onMouseLeave={() => setHovered(null)} className="cursor-pointer">
        {[-30, 0, 30].map((dx, i) => (
          <g key={`g-${i}`}>
            <ellipse cx={170 + dx} cy={175} rx="10" ry="8" fill="#f472b6" opacity={hovered === 'A' || !hovered ? 0.3 : 0.1} stroke="#f472b6" strokeWidth="1" />
            <line x1={170 + dx + 10} y1={175} x2={170 + dx + 18} y2={170} stroke="#f9a8d4" strokeWidth="1" />
          </g>
        ))}
        {hovered === 'A' && <text x="200" y="200" textAnchor="middle" fill="#f472b6" fontSize="9">Гаметы (слияние)</text>}
      </g>
      {/* Zygote / cyst */}
      <g onMouseEnter={() => setHovered('A')} onMouseLeave={() => setHovered(null)} className="cursor-pointer">
        <circle cx="200" cy="225" r="18" fill="#a855f7" opacity={hovered === 'A' || !hovered ? 0.3 : 0.1} stroke="#a855f7" strokeWidth="1.5" strokeDasharray="3 2" />
        <text x="200" y="229" textAnchor="middle" fill="#a855f7" fontSize="8">Зигота</text>
      </g>
      {/* Arrow back up (B path — vegetative, to the right) */}
      <g onMouseEnter={() => setHovered('B')} onMouseLeave={() => setHovered(null)} className="cursor-pointer">
        <motion.path d="M350,70 Q380,160 270,175" stroke={hovered === 'B' ? "#4ade80" : "#4ade8060"} strokeWidth="1.5" fill="none" strokeDasharray="4 3" />
        <text x="365" y="120" fill="#4ade80" fontSize="14" fontWeight="bold">Б</text>
        <text x="340" y="135" fill="#4ade8080" fontSize="8">Деление</text>
        <text x="330" y="148" fill="#4ade8060" fontSize="7">(благоприятные условия)</text>
      </g>
      {/* Zoospores (vegetative) */}
      <g onMouseEnter={() => setHovered('B')} onMouseLeave={() => setHovered(null)} className="cursor-pointer">
        {[320, 340].map((x, i) => (
          <ellipse key={`z-${i}`} cx={x} cy={i === 0 ? 55 : 85} rx="8" ry="6" fill="#4ade80" opacity={hovered === 'B' || !hovered ? 0.3 : 0.1} stroke="#4ade80" strokeWidth="1" />
        ))}
        {hovered === 'B' && <text x="340" y="40" fill="#4ade80" fontSize="9">Зооспоры</text>}
      </g>
      {/* Animated dots */}
      <circle r="3" fill="#f472b6" opacity="0.6">
        <animateMotion dur="3s" repeatCount="indefinite" path="M200,105 L200,155 L170,175 L200,225" />
      </circle>
      <circle r="3" fill="#4ade80" opacity="0.6">
        <animateMotion dur="3.5s" repeatCount="indefinite" path="M350,70 Q380,160 270,175" />
      </circle>
      {/* Arrow marker */}
      <defs><marker id="arrowP" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto"><path d="M0,0 L8,3 L0,6 Z" fill="#f472b6" /></marker></defs>
    </svg>
  );
}

// ═══════════════════════════════════════════════════════════════════
//  SVG 6: LeafTypesSVG
// ═══════════════════════════════════════════════════════════════════
const leafTypes = [
  { id: 'linear', label: 'Линейные', color: '#22c55e', desc: 'Параллельное жилкование. Злаки, Лилейные.', veins: 'parallel' },
  { id: 'lobed', label: 'Рассечённые', color: '#f59e0b', desc: 'Глубокие лопасти. Дуб, Клён.', veins: 'net' },
  { id: 'needle', label: 'Игловидные', color: '#06b6d4', desc: 'Хвоинки. Хвойные.', veins: 'parallel' },
  { id: 'entire', label: 'Цельные', color: '#a78bfa', desc: 'Гладкий край, сетчатое жилкование. Лилейные, Берёза.', veins: 'net' },
];

function LeafTypesSVG() {
  const [active, setActive] = useState<string | null>();
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      {leafTypes.map((lt, idx) => (
        <motion.div key={lt.id} whileHover={{ scale: 1.05, y: -4 }} onMouseEnter={() => setActive(lt.id)} onMouseLeave={() => setActive(null)} className={`p-4 rounded-xl border text-center cursor-pointer transition-all ${active === lt.id ? 'bg-white/5 border-white/20' : 'border-emerald-800/30 bg-[#0a1a14]'}`}>
          <svg viewBox="0 0 80 100" className="w-16 h-20 mx-auto mb-2" xmlns="http://www.w3.org/2000/svg">
            {lt.id === 'linear' && (
              <g>
                <path d="M40,10 L35,90 M40,10 L45,90 M40,10 Q38,50 36,90 M40,10 Q42,50 44,90" stroke={lt.color} strokeWidth="0.8" opacity="0.5" fill="none" />
                <path d="M40,10 Q25,30 28,50 Q30,70 35,90 L40,90 Q45,70 52,50 Q55,30 40,10Z" fill={lt.color} opacity="0.3" stroke={lt.color} strokeWidth="1" />
              </g>
            )}
            {lt.id === 'lobed' && (
              <g>
                <path d="M40,10 L25,25 Q15,40 25,55 L40,45 L55,55 Q65,40 55,25 Z" fill={lt.color} opacity="0.3" stroke={lt.color} strokeWidth="1" />
                <path d="M40,45 L30,65 Q25,80 35,90 L40,85 L45,90 Q55,80 50,65 Z" fill={lt.color} opacity="0.3" stroke={lt.color} strokeWidth="1" />
                <line x1="40" y1="10" x2="40" y2="90" stroke={lt.color} strokeWidth="0.6" opacity="0.4" />
              </g>
            )}
            {lt.id === 'needle' && (
              <g>
                <path d="M40,10 L38,85 M40,10 L42,85" stroke={lt.color} strokeWidth="0.5" opacity="0.4" />
                <path d="M40,10 Q36,50 38,85 L42,85 Q44,50 40,10Z" fill={lt.color} opacity="0.3" stroke={lt.color} strokeWidth="1" />
              </g>
            )}
            {lt.id === 'entire' && (
              <g>
                <path d="M40,10 Q20,30 22,60 Q25,80 40,90 Q55,80 58,60 Q60,30 40,10Z" fill={lt.color} opacity="0.3" stroke={lt.color} strokeWidth="1" />
                <line x1="40" y1="10" x2="40" y2="90" stroke={lt.color} strokeWidth="0.8" opacity="0.5" />
                <path d="M40,30 L25,45 M40,30 L55,45 M40,50 L22,65 M40,50 L58,65 M40,65 L28,80 M40,65 L52,80" stroke={lt.color} strokeWidth="0.5" opacity="0.3" fill="none" />
              </g>
            )}
          </svg>
          <h4 className="font-bold text-white text-sm">{lt.label}</h4>
          <p className="text-xs text-emerald-200/50 mt-1">{lt.desc}</p>
        </motion.div>
      ))}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
//  SVG 7: LifeFormsSVG
// ═══════════════════════════════════════════════════════════════════
function LifeFormsSVG() {
  const [active, setActive] = useState<'tree' | 'shrub' | 'herb' | null>();
  const forms = [
    { id: 'tree', label: 'Дерево', examples: 'Яблоня, Рябина, Дуб', color: '#22c55e', features: 'Один мощный ствол (ствол). Крона — ветви с листьями. Древесина.' },
    { id: 'shrub', label: 'Кустарник', examples: 'Малина, Шиповник, Смородина', color: '#f59e0b', features: 'Несколько стволов от корня. Нет главного ствола. Ниже деревьев.' },
    { id: 'herb', label: 'Трава', examples: 'Лапчатка, Гравилат, Подорожник', color: '#a78bfa', features: 'Мягкий зелёный стебель. Нет одревесневших частей. Низкорослые.' },
  ];
  return (
    <div className="grid grid-cols-3 gap-4">
      {forms.map(f => (
        <motion.div key={f.id} whileHover={{ scale: 1.03, y: -4 }} onMouseEnter={() => setActive(f.id)} onMouseLeave={() => setActive(null)} className={`p-4 rounded-xl border cursor-pointer transition-all ${active === f.id ? 'bg-white/5 border-white/20 shadow-lg' : 'border-emerald-800/30 bg-[#0a1a14]'}`}>
          <svg viewBox="0 0 80 100" className="w-14 h-18 mx-auto mb-2" xmlns="http://www.w3.org/2000/svg">
            {f.id === 'tree' && (
              <g>
                <rect x="36" y="55" width="8" height="40" fill="#92400e" opacity="0.6" rx="2" />
                <circle cx="40" cy="40" r="28" fill={f.color} opacity={active === f.id || !active ? 0.35 : 0.15} />
                <circle cx="40" cy="30" r="18" fill={f.color} opacity={active === f.id || !active ? 0.25 : 0.1} />
              </g>
            )}
            {f.id === 'shrub' && (
              <g>
                <rect x="32" y="60" width="4" height="35" fill="#92400e" opacity="0.5" rx="1" />
                <rect x="44" y="55" width="4" height="40" fill="#92400e" opacity="0.5" rx="1" />
                <ellipse cx="40" cy="45" rx="25" ry="22" fill={f.color} opacity={active === f.id || !active ? 0.3 : 0.12} />
              </g>
            )}
            {f.id === 'herb' && (
              <g>
                <path d="M40,90 Q38,60 35,40 Q33,25 40,10" stroke={f.color} strokeWidth="2.5" fill="none" opacity={active === f.id || !active ? 0.6 : 0.2} />
                <ellipse cx="33" cy="30" rx="10" ry="6" fill={f.color} opacity={active === f.id || !active ? 0.3 : 0.1} transform="rotate(-30,33,30)" />
                <ellipse cx="47" cy="35" rx="10" ry="6" fill={f.color} opacity={active === f.id || !active ? 0.3 : 0.1} transform="rotate(25,47,35)" />
                <ellipse cx="38" cy="55" rx="8" ry="5" fill={f.color} opacity={active === f.id || !active ? 0.25 : 0.08} transform="rotate(-20,38,55)" />
              </g>
            )}
          </svg>
          <h4 className="font-bold text-white text-sm text-center">{f.label}</h4>
          <p className="text-xs text-emerald-200/50 mt-2 leading-relaxed">{f.features}</p>
          <p className="text-xs text-emerald-400/40 mt-1">{f.examples}</p>
        </motion.div>
      ))}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
//  GAME 1: ClassificationChainGame
// ═══════════════════════════════════════════════════════════════════
const CLASS_FRAGMENTS = [
  { id: 'c5', label: 'Растения', order: 0, level: 'Царство' },
  { id: 'c2', label: 'Покрытосеменные', order: 1, level: 'Отдел' },
  { id: 'c3', label: 'Двудольные', order: 2, level: 'Класс' },
  { id: 'c1', label: 'Акация', order: 3, level: 'Род' },
  { id: 'c4', label: 'Акация нильская', order: 4, level: 'Вид' },
];

function ClassificationChainGame() {
  const [selected, setSelected] = useState<string[]>([]);
  const [status, setStatus] = useState<'playing' | 'success' | 'error'>('playing');
  const [shuffled] = useState(() => [...CLASS_FRAGMENTS].sort(() => Math.random() - 0.5));
  const correctOrder = CLASS_FRAGMENTS.map(f => f.id);

  const handleClick = useCallback((id: string) => {
    if (status !== 'playing') return;
    if (selected.includes(id)) { setSelected(prev => prev.filter(s => s !== id)); setStatus('playing'); return; }
    const next = [...selected, id];
    setSelected(next);
    const idx = next.length - 1;
    if (next[idx] !== correctOrder[idx]) {
      setStatus('error');
      setTimeout(() => { setSelected([]); setStatus('playing'); }, 1000);
    } else if (next.length === correctOrder.length) {
      setStatus('success');
    }
  }, [selected, status, correctOrder]);

  const remaining = shuffled.filter(f => !selected.includes(f.id));
  const reset = () => { setSelected([]); setStatus('playing'); };

  return (
    <Panel glow={status === 'success'} className="p-5 space-y-4">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-emerald-200 font-bold text-sm flex items-center gap-2"><Layers className="w-4 h-4" /> Собери «паспорт» растения</h3>
        <div className="flex items-center gap-2">
          <span className="text-xs text-emerald-600">{selected.length}/{correctOrder.length}</span>
          <button onClick={reset} className="p-1 rounded hover:bg-emerald-900/30 text-emerald-600 hover:text-emerald-400 transition-colors cursor-pointer"><RotateCcw className="w-4 h-4" /></button>
        </div>
      </div>
      <div className={`min-h-[44px] rounded-lg border-2 border-dashed p-3 break-all transition-all ${status === 'success' ? 'border-emerald-500 bg-emerald-500/10 text-emerald-300 shadow-[0_0_20px_rgba(16,185,129,0.3)]' : status === 'error' ? 'border-red-500 bg-red-500/10 text-red-400' : 'border-emerald-800/40 bg-[#020c02] text-emerald-300'}`}>
        {selected.length === 0 ? <span className="text-emerald-800 text-sm">// нажми на фрагменты ниже...</span> : selected.map(id => { const f = CLASS_FRAGMENTS.find(f => f.id === id)!; return <span key={id} className="mr-3">{f.level}: <strong>{f.label}</strong></span>; })}
      </div>
      <div className="flex flex-wrap gap-2">
        <AnimatePresence mode="popLayout">
          {remaining.map(frag => (
            <motion.button key={frag.id} layout initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.8 }} whileHover={{ scale: 1.08 }} whileTap={{ scale: 0.9 }} onClick={() => handleClick(frag.id)} className="px-3 py-1.5 rounded-lg bg-emerald-900/20 border border-emerald-700/40 text-xs text-emerald-300 hover:border-emerald-400 hover:text-white transition-all cursor-pointer">
              {frag.label}
            </motion.button>
          ))}
        </AnimatePresence>
      </div>
      <AnimatePresence>
        {status === 'success' && <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="flex items-center gap-2 text-emerald-400 text-sm"><CheckCircle2 className="w-5 h-5" /> Паспорт составлен верно! Ответ: 52314</motion.div>}
        {status === 'error' && <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex items-center gap-2 text-red-400 text-sm"><AlertTriangle className="w-5 h-5" /> Неправильный порядок!</motion.div>}
      </AnimatePresence>
    </Panel>
  );
}

// ═══════════════════════════════════════════════════════════════════
//  GAME 2: PlantGroupingGame
// ═══════════════════════════════════════════════════════════════════
const GROUP_PLANTS = [
  { id: 'rice', label: 'Рис', group: 'aquatic' },
  { id: 'waterlily', label: 'Кувшинка', group: 'aquatic' },
  { id: 'duckweed', label: 'Ряска', group: 'aquatic' },
  { id: 'plane', label: 'Платан', group: 'terrestrial' },
  { id: 'horsetail', label: 'Хвощ', group: 'terrestrial' },
  { id: 'rose', label: 'Роза', group: 'terrestrial' },
];

function PlantGroupingGame() {
  const [grouped, setGrouped] = useState<{ group: string; plants: string[] }[]>([]);
  const [status, setStatus] = useState<'playing' | 'success'>('playing');
  const remaining = GROUP_PLANTS.filter(p => !grouped.some(g => g.plants.includes(p.id)));

  const handlePlace = useCallback((plant: typeof GROUP_PLANTS[0], zone: string) => {
    if (status !== 'playing') return;
    if (plant.group !== zone) return;
    setGrouped(prev => {
      const existing = prev.find(g => g.group === zone);
      if (existing) return prev.map(g => g.group === zone ? { ...g, plants: [...g.plants, plant.id] } : g);
      return [...prev, { group: zone, plants: [plant.id] }];
    });
    const willBeDone = remaining.length <= 1;
    if (willBeDone) setTimeout(() => setStatus('success'), 300);
  }, [status, remaining.length]);

  const reset = () => { setGrouped([]); setStatus('playing'); };
  const groupLabels: Record<string, string> = { aquatic: 'Водные растения', terrestrial: 'Наземные растения' };

  return (
    <Panel glow={status === 'success'} className="p-5 space-y-4">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-emerald-200 font-bold text-sm flex items-center gap-2"><Droplets className="w-4 h-4" /> Группировка растений</h3>
        <button onClick={reset} className="p-1 rounded hover:bg-emerald-900/30 text-emerald-600 hover:text-emerald-400 transition-colors cursor-pointer"><RotateCcw className="w-4 h-4" /></button>
      </div>
      <p className="text-xs text-emerald-300/50">Основание: среда обитания. Распределите растения на 2 группы.</p>
      <div className="grid grid-cols-2 gap-3">
        {(['aquatic', 'terrestrial'] as const).map(zone => (
          <div key={zone} className="min-h-[80px] rounded-lg border-2 border-dashed p-3 border-emerald-800/30 bg-[#020c02]">
            <div className="text-xs font-bold text-emerald-400 mb-2">{groupLabels[zone]}</div>
            <AnimatePresence>
              {grouped.find(g => g.group === zone)?.plants.map(id => {
                const plant = GROUP_PLANTS.find(p => p.id === id)!;
                return <motion.div key={id} initial={{ opacity: 0, scale: 0.5 }} animate={{ opacity: 1, scale: 1 }} className="text-xs text-emerald-200 mb-1">• {plant.label}</motion.div>;
              })}
            </AnimatePresence>
          </div>
        ))}
      </div>
      <div className="flex flex-wrap gap-2 justify-center">
        <AnimatePresence mode="popLayout">
          {remaining.map(plant => (
            <motion.div key={plant.id} layout initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, scale: 0.5 }} className="flex gap-1 items-center">
              {(['aquatic', 'terrestrial'] as const).map(zone => (
                <motion.button key={zone} whileHover={{ scale: 1.08 }} whileTap={{ scale: 0.9 }} onClick={() => handlePlace(plant, zone)} className="px-2 py-1 rounded bg-emerald-900/20 border border-emerald-700/30 text-[10px] text-emerald-500 hover:border-emerald-400 transition-all cursor-pointer">
                  {zone === 'aquatic' ? '💧' : '🌱'}
                </motion.button>
              ))}
              <span className="px-2 py-1 text-xs text-emerald-300">{plant.label}</span>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
      <AnimatePresence>
        {status === 'success' && <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="text-emerald-400 text-sm flex items-center gap-2"><CheckCircle2 className="w-5 h-5" /> Отлично! Все растения распределены верно!</motion.div>}
      </AnimatePresence>
    </Panel>
  );
}

// ═══════════════════════════════════════════════════════════════════
//  MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════
export default function Biology7Cheatsheet() {
  const [activeOrganelle, setActiveOrganelle] = useState<Organelle>(null);
  const sv = { hidden: { opacity: 0, y: 40 }, visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: 'easeOut' } } };

  return (
    <div className="min-h-screen bg-[#040f0a] text-emerald-50 relative overflow-hidden">
      <FloatingLeafBg />
      <main className="relative z-10 max-w-5xl mx-auto px-4 py-8 sm:px-6 lg:px-8">

        {/* BACK LINK */}
        <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.4 }}>
          <Link href="/vpr-tests" className="inline-flex items-center gap-2 text-emerald-300/70 hover:text-emerald-200 transition-colors mb-8 group">
            <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />Назад к тестам ВПР
          </Link>
        </motion.div>

        {/* ===== HERO ===== */}
        <motion.header initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7 }} className="text-center mb-16">
          <div className="flex justify-center mb-6">
            <svg viewBox="0 0 200 120" className="w-48 sm:w-64 h-auto">
              <defs><linearGradient id="leafGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#10b981" /><stop offset="100%" stopColor="#059669" /></linearGradient></defs>
              <motion.path d="M100,15 Q140,30 145,65 Q148,90 100,110 Q52,90 55,65 Q60,30 100,15Z" fill="url(#leafGrad)" opacity="0.4" initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ duration: 0.8, ease: 'easeOut' }} />
              <motion.path d="M100,25 Q100,60 100,100" stroke="#34d399" strokeWidth="2" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 1.2, delay: 0.3 }} />
              {[35, 55, 75].map((y, i) => (
                <motion.path key={i} d={`M100,${y} Q${80 + i * 5},${y + 12} ${70 + i * 5},${y + 20}`} stroke="#34d399" strokeWidth="1" fill="none" opacity="0.4" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.6, delay: 0.5 + i * 0.15 }} />
              ))}
              {[35, 55, 75].map((y, i) => (
                <motion.path key={`r-${i}`} d={`M100,${y} Q${120 - i * 5},${y + 12} ${130 - i * 5},${y + 20}`} stroke="#34d399" strokeWidth="1" fill="none" opacity="0.4" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.6, delay: 0.6 + i * 0.15 }} />
              ))}
              <circle r="3" fill="#6ee7b7"><animateMotion dur="4s" repeatCount="indefinite" path="M100,25 Q100,60 100,100" /></circle>
            </svg>
          </div>
          <div className="inline-block mb-4 px-4 py-1.5 rounded-full bg-gradient-to-r from-emerald-500/20 to-teal-500/20 border border-emerald-500/30 text-emerald-300 text-sm font-medium">
            7 класс • Ботаника • Подготовка к ВПР
          </div>
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black bg-gradient-to-r from-emerald-300 via-teal-200 to-lime-400 bg-clip-text text-transparent mb-4 leading-tight">
            МИР РАСТЕНИЙ
          </h1>
          <p className="text-emerald-200/50 text-base sm:text-lg max-w-2xl mx-auto">
            От водорослей до покрытосеменных: вся ботаника 7 класса.
            <br /><span className="text-emerald-400 font-bold">Цель:</span> Разобрать все 27 типов заданий ВПР по биологии с реальными ответами.
          </p>
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1 }} className="flex flex-wrap justify-center gap-3 mt-6">
            {['Ботаника', '7 класс', 'ВПР', 'Водоросли', 'Мхи', 'Грибы', 'Цветковые'].map(tag => (
              <span key={tag} className="px-3 py-1 bg-emerald-950/50 border border-emerald-800/30 rounded-full text-xs text-emerald-500">{tag}</span>
            ))}
          </motion.div>
        </motion.header>

        {/* ===== 01: KEY FACTS ===== */}
        <motion.section variants={sv} initial="hidden" whileInView="visible" viewport={{ once: true, margin: '-50px' }} className="mb-20">
          <SectionHeader icon={Zap} title="01 — Ключевые факты ВПР" subtitle="Числа и правила, которые нужно запомнить" />
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { n: '~350 000', l: 'видов растений на Земле', i: '🌍' },
              { n: '10', l: 'отделов в системе растений', i: '📊' },
              { n: 'Цветковые', l: 'самая большая группа', i: '🌸' },
              { n: 'Хлорофилл', l: 'зелёный пигмент фотосинтеза', i: '☀️' },
              { n: 'Целлюлоза', l: 'клеточная стенка растений', i: '🧱' },
              { n: 'Торф', l: 'из сфагновых болот (НЕ нефть!)', i: '🏗️' },
              { n: '2', l: 'способа размножения хламидомонады', i: '🧬' },
              { n: 'Ризоиды', l: 'у мхов вместо корней', i: '🌿' },
            ].map((f, i) => (
              <motion.div key={i} variants={sv} whileHover={{ scale: 1.05, y: -4 }} className="bg-[#0a1a14] rounded-xl border border-emerald-800/40 p-4 text-center cursor-default">
                <div className="text-2xl mb-2">{f.i}</div>
                <div className="text-xl sm:text-2xl font-bold text-emerald-300 mb-1">{f.n}</div>
                <div className="text-xs text-emerald-200/50 leading-tight">{f.l}</div>
              </motion.div>
            ))}
          </div>
        </motion.section>

        {/* ===== 02: PLANT CELL ===== */}
        <motion.section variants={sv} initial="hidden" whileInView="visible" viewport={{ once: true, margin: '-50px' }} className="mb-20">
          <SectionHeader icon={Microscope} title="02 — Строение растительной клетки" subtitle="Интерактивная схема — наведите на органеллу" />
          <div className="bg-[#0a1a14] rounded-xl border border-emerald-800/40 p-4 sm:p-6">
            <div className="flex items-center gap-2 mb-4 text-sm text-emerald-300/60">
              <MousePointerClick className="w-4 h-4" /><span>Наведите на часть клетки для подробностей</span>
            </div>
            <PlantCellSVG active={activeOrganelle} onHover={setActiveOrganelle} />
            <AnimatePresence mode="wait">
              {activeOrganelle && (
                <motion.div key={activeOrganelle} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="mt-4 p-4 rounded-lg border" style={{ backgroundColor: `${organelleInfo[activeOrganelle].color}10`, borderColor: `${organelleInfo[activeOrganelle].color}40` }}>
                  <h4 className="font-bold mb-1" style={{ color: organelleInfo[activeOrganelle].color }}>{organelleInfo[activeOrganelle].label}</h4>
                  <p className="text-emerald-100/70 text-sm leading-relaxed">{organelleInfo[activeOrganelle].desc}</p>
                </motion.div>
              )}
            </AnimatePresence>
            {!activeOrganelle && <p className="text-emerald-200/40 text-sm text-center mt-4">Наведите курсор на клетку</p>}
          </div>
          {/* Comparison table */}
          <div className="mt-6 grid md:grid-cols-2 gap-4">
            <Expandable title="Растительная клетка vs Животная клетка" defaultOpen>
              <div className="space-y-2 text-sm text-emerald-100/70">
                <p><strong className="text-emerald-300">Клеточная стенка</strong> — есть у растений (целлюлоза), нет у животных. Придаёт жёсткую форму.</p>
                <p><strong className="text-emerald-300">Хлоропласты</strong> — есть у растений (фотосинтез), нет у животных. Содержат хлорофилл.</p>
                <p><strong className="text-emerald-300">Вакуоль</strong> — крупная центральная у растений (до 90% объёма), мелкие у животных.</p>
                <p><strong className="text-emerald-300">Запасное вещество</strong> — крахмал у растений, гликоген у животных и грибов.</p>
              </div>
            </Expandable>
            <Expandable title="Хлорелла vs Бактерия (Q3 ВПР)">
              <div className="space-y-2 text-sm text-emerald-100/70">
                <p><strong className="text-emerald-300">Ядро:</strong> У хлореллы есть оформленное ядро (эукариот), у бактерии — нет (прокариот).</p>
                <p><strong className="text-emerald-300">Хроматофор (хлоропласт):</strong> У хлореллы есть хроматофор для фотосинтеза, у бактерии — нет.</p>
                <p><strong className="text-emerald-300">ДНК:</strong> У хлореллы ДНК в ядре (в оболочке), у бактерии — «голая» в цитоплазме.</p>
                <AnswerBadge answer="У хлореллы есть ядро ИЛИ хроматофор" label="Ответ" />
              </div>
            </Expandable>
          </div>
        </motion.section>

        {/* ===== 03: CLASSIFICATION ===== */}
        <motion.section variants={sv} initial="hidden" whileInView="visible" viewport={{ once: true, margin: '-50px' }} className="mb-20">
          <SectionHeader icon={Layers} title="03 — Систематика растений" subtitle="Царство → Отдел → Класс → Семейство → Род → Вид" />
          <ClassificationChainGame />
          <div className="mt-6">
            <Expandable title="Как составлять «паспорт» растения (Q4 ВПР)">
              <div className="space-y-3 text-sm text-emerald-100/70">
                <p>Вам дают список слов в случайном порядке и таблицу с уровнями классификации. Нужно распределить слова от крупного к мелкому.</p>
                <div className="bg-emerald-900/20 p-4 rounded-lg border border-emerald-800/30">
                  <p className="font-bold text-emerald-300 mb-2">Пример (Акация нильская):</p>
                  <p>1) Акация → <strong>Род</strong></p>
                  <p>2) Покрытосеменные → <strong>Отдел</strong></p>
                  <p>3) Двудольные → <strong>Класс</strong></p>
                  <p>4) Акация нильская → <strong>Вид</strong></p>
                  <p>5) Растения → <strong>Царство</strong></p>
                  <AnswerBadge answer="52314 (Растения→Покрытосеменные→Двудольные→Акация→Акация нильская)" label="Ответ" />
                </div>
                <p><strong className="text-yellow-300">Лайфхак:</strong> Сначала найди «Царство» (Растения) и «Вид» (двойное название с двумя словами), затем «Отдел» (Покрытосеменные или Голосеменные), «Класс» (Однодольные/Двудольные), «Род» (одно слово).</p>
              </div>
            </Expandable>
          </div>
        </motion.section>

        {/* ===== 04: EVOLUTION TIMELINE ===== */}
        <motion.section variants={sv} initial="hidden" whileInView="visible" viewport={{ once: true, margin: '-50px' }} className="mb-20">
          <SectionHeader icon={TreePine} title="04 — Многообразие растений" subtitle="Эволюция растительного мира от водорослей до цветковых" />
          <div className="bg-[#0a1a14] rounded-xl border border-emerald-800/40 p-4 sm:p-6 mb-6">
            <EvolutionTimelineSVG />
          </div>
          {/* Detailed group cards */}
          <div className="space-y-3">
            <Expandable title="Водоросли — первые организмы на Земле" defaultOpen>
              <div className="grid md:grid-cols-3 gap-4 text-sm text-emerald-100/70">
                <div className="p-3 rounded-lg bg-green-900/20 border border-green-800/30">
                  <h4 className="font-bold text-green-400 mb-2">Зелёные водоросли (1)</h4>
                  <p>Хлорелла, Хламидомонада. Обитают в пресных водоёмах. Не имеют тканей и органов. Хлорелла — одноклеточная, используется для очистки воды. Хламидомонада — имеет жгутики, может размножаться половым и бесполым путём.</p>
                </div>
                <div className="p-3 rounded-lg bg-red-900/20 border border-red-800/30">
                  <h4 className="font-bold text-red-400 mb-2">Красные водоросли (2)</h4>
                  <p>Порфира. Обитают на значительной глубине (до 200 м), где другие водоросли не выживают. Содержат дополнительный красный пигмент фикоэритрин, позволяющий улавливать синий свет.</p>
                </div>
                <div className="p-3 rounded-lg bg-amber-900/20 border border-amber-800/30">
                  <h4 className="font-bold text-amber-400 mb-2">Бурые водоросли (3)</h4>
                  <p>Ламинария (морская капуста). Обитают в морях. Достигают гигантских размеров (до 60 м). Являются важнейшим источником йода. На схеме эволюции — группа №3.</p>
                </div>
              </div>
              <AnswerBadge answer="Ламинария → 3 (Бурые водоросли)" label="Q14 ВПР" />
            </Expandable>

            <Expandable title="Моховидные — первопоселенцы суши">
              <div className="text-sm text-emerald-100/70 space-y-3">
                <p>Мхи — первые растения, вышедшие на сушу. Но они ещё не вполне приспособлены к наземной жизни. У них <strong className="text-emerald-300">НЕТ настоящих корней</strong> — вместо них ризоиды (выросты стебля для закрепления). Размножаются спорами (не имеют семян).</p>
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="p-3 rounded-lg bg-emerald-900/20 border border-emerald-800/30">
                    <h4 className="font-bold text-emerald-400 mb-1">Кукушкин лён (4)</h4>
                    <p>Листостебельный мох. На рисунке обозначен цифрой 4 в схеме развития растительного мира. Среда обитания — наземно-воздушная. Имеет спорангий на ножке для размножения спорами.</p>
                  </div>
                  <div className="p-3 rounded-lg bg-teal-900/20 border border-teal-800/30">
                    <h4 className="font-bold text-teal-400 mb-1">Сфагнум</h4>
                    <p>Торфяной мох. Образует сфагновые болота. Отмершие части сфагнума накапливаются и образуют <strong className="text-yellow-300">торф</strong> (НЕ нефть!). Сфагнум способен впитывать огромное количество воды — в 20 раз больше собственной массы.</p>
                  </div>
                </div>
                <div className="bg-red-900/10 p-3 rounded-lg border border-red-800/20">
                  <h4 className="font-bold text-red-400 mb-1">⚠️ Ловушка Q11 ВПР:</h4>
                  <p>А. «Имеют примитивный корень» — <strong className="text-red-400">НЕВЕРНО</strong>. У мхов НЕТ корней, только ризоиды!</p>
                  <p>Б. «Сфагновые болота → нефть» — <strong className="text-red-400">НЕВЕРНО</strong>. Торф, не нефть!</p>
                  <AnswerBadge answer="4 (оба суждения неверны)" />
                </div>
              </div>
            </Expandable>

            <Expandable title="Плауны, Хвощи, Папоротники — высшие споровые">
              <div className="text-sm text-emerald-100/70 space-y-3">
                <p>В отличие от мхов, у этих групп есть настоящие ткани, органы (стебель, листья, корни), но они по-прежнему размножаются <strong className="text-emerald-300">спорами</strong>, а не семенами. Поэтому их называют «высшими споровыми растениями».</p>
                <div className="grid md:grid-cols-3 gap-4">
                  <div className="p-3 rounded-lg bg-cyan-900/20 border border-cyan-800/30">
                    <h4 className="font-bold text-cyan-400 mb-1">Плауны (5)</h4>
                    <p>Споры собраны в колоски (спорангии на верхушке стебля). Древние плауны были деревьями, образовывали каменный уголь. Современные — небольшие травянистые растения.</p>
                  </div>
                  <div className="p-3 rounded-lg bg-sky-900/20 border border-sky-800/30">
                    <h4 className="font-bold text-sky-400 mb-1">Папоротники (6)</h4>
                    <p>Крупные рассечённые листья — «вайи» (не настоящие листья, а сложные системы ветвления). Встречаются от тропиков до тундры. Ископаемые папоротники — часть каменного угля.</p>
                  </div>
                  <div className="p-3 rounded-lg bg-teal-900/20 border border-teal-800/30">
                    <h4 className="font-bold text-teal-400 mb-1">Хвощи (7)</h4>
                    <p>Членистые (узловатые) стебли, похожие на бамбук. Листья редуцированы до чешуек. Содержат кремнезём — используются как чистящее средство (как наждачка).</p>
                  </div>
                </div>
              </div>
            </Expandable>

            <Expandable title="Голосеменные — первые растения с семенами">
              <div className="text-sm text-emerald-100/70 space-y-3">
                <p>Революция в эволюции растений: появились <strong className="text-emerald-300">семена</strong>! В отличие от спор, семя содержит запас питательных веществ, что значительно повышает шансы на выживание потомства.</p>
                <p>Хвойные (8) — самая известная группа голосеменных. Семена открыто лежат на чешуйках шишек (отсюда название — «голосеменные», семена «голые», не скрыты в завязи). Листья — хвоинки (игловидные). Примеры: сосна, ель, пихта, лиственница. Лиственница — хвойное дерево, которое сбрасывает хвою на зиму!</p>
              </div>
            </Expandable>

            <Expandable title="Покрытосеменные (Цветковые) — высшая ступень эволюции">
              <div className="text-sm text-emerald-100/70 space-y-3">
                <p>Самая многочисленная и господствующая группа растений. Главная инновация — <strong className="text-emerald-300">цветок</strong> (орган размножения) и <strong className="text-emerald-300">плод</strong> (семена защищены стенкой завязи, т.е. «покрыты»).</p>
                <p>Два класса: <strong className="text-pink-300">Однодольные (9)</strong> и <strong className="text-orange-300">Двудольные (10)</strong>. Различаются по количеству семядолей, типу жилкования, корневой системе, строению стебля и цветка.</p>
                <div className="bg-emerald-900/20 p-3 rounded-lg border border-emerald-800/30">
                  <p className="font-bold text-emerald-300 mb-1">Q1 ВПР — Классификация по фото:</p>
                  <p>А — листостебельные мхи (споровые, нет семян, ризоиды)</p>
                  <p>Б — однодольные (параллельное жилкование, мочковатая корневая система)</p>
                  <p>В — двудольные (сетчатое жилкование, стержневая корневая система)</p>
                  <p>Г — хвойные (голосеменные, хвоинки, шишки)</p>
                </div>
                <div className="bg-yellow-900/10 p-3 rounded-lg border border-yellow-800/20">
                  <p className="font-bold text-yellow-400 mb-1">Q2 ВПР — Выпадающий объект:</p>
                  <p>Ответ: <strong>Листостебельные мхи (А)</strong> — это споровые растения, у них нет семян. Остальные (Б, В, Г) — семенные растения.</p>
                </div>
              </div>
            </Expandable>
          </div>
        </motion.section>

        {/* ===== 05: MONOCOTS vs DICOTS ===== */}
        <motion.section variants={sv} initial="hidden" whileInView="visible" viewport={{ once: true, margin: '-50px' }} className="mb-20">
          <SectionHeader icon={Sprout} title="05 — Однодольные vs Двудольные" subtitle="Главные отличительные признаки" />
          <div className="bg-[#0a1a14] rounded-xl border border-emerald-800/40 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="border-b border-emerald-800/40">
                  <th className="p-3 text-left text-emerald-400 font-bold">Признак</th>
                  <th className="p-3 text-center text-pink-400 font-bold">Однодольные</th>
                  <th className="p-3 text-center text-orange-400 font-bold">Двудольные</th>
                </tr></thead>
                <tbody className="text-emerald-100/70">
                  {[
                    ['Семядоли', '1', '2'],
                    ['Жилкование листа', 'Параллельное / Дуговое', 'Сетчатое (перистое)'],
                    ['Корневая система', 'Мочковатая (нет главного корня)', 'Стержневая (главный корень)'],
                    ['Камбий в стебле', 'НЕТ (не растут в толщину)', 'ЕСТЬ (растут в толщину)'],
                    ['Число членов цветка', 'По 3 (3, 6, 9...)', 'По 4-5 (4, 5, 8, 10...)'],
                    ['Примеры', 'Пшеница, Рис, Лилия, Кукуруза', 'Роза, Горох, Яблоня, Клевер'],
                  ].map(([feature, mono, di], i) => (
                    <tr key={i} className="border-b border-emerald-800/20">
                      <td className="p-3 font-medium text-emerald-200">{feature}</td>
                      <td className="p-3 text-center text-pink-200/80">{mono}</td>
                      <td className="p-3 text-center text-orange-200/80">{di}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <div className="mt-6">
            <Expandable title="Как определить класс растения на рисунке (Q15-17 ВПР)">
              <div className="text-sm text-emerald-100/70 space-y-3">
                <p><strong className="text-emerald-300">Шаг 1: Определи отдел.</strong> Если есть цветок и плод → Покрытосеменные (4). Если есть шишки, хвоя, но нет цветка → Голосеменные (3). Если нет ни того, ни другого → смотри на спорангии/рилзоиды.</p>
                <p><strong className="text-emerald-300">Шаг 2: Определи класс.</strong> Считай части цветка. Если кратно 3 (3, 6, 9) → Однодольные. Если кратно 4-5 → Двудольные. Также посмотри на жилкование листа: параллельное → однодольные, сетчатое → двудольные.</p>
                <p><strong className="text-emerald-300">Шаг 3: Определи семейство.</strong> По строению цветка, типу плода, форме листьев.</p>
                <div className="bg-emerald-900/20 p-3 rounded-lg border border-emerald-800/30">
                  <p className="font-bold text-emerald-300 mb-1">Пример: Чина луговая</p>
                  <p>Отдел: Покрытосеменные (есть цветок и плод) → <strong>4</strong></p>
                  <p>Класс: Двудольные (цветок из 5 частей) → <strong>4</strong></p>
                  <p>Семейство: Мотыльковые/Бобовые (мотыльковый цветок, плод — боб) → <strong>2</strong></p>
                </div>
              </div>
            </Expandable>
          </div>
        </motion.section>

        {/* ===== 06: FLOWER STRUCTURE ===== */}
        <motion.section variants={sv} initial="hidden" whileInView="visible" viewport={{ once: true, margin: '-50px' }} className="mb-20">
          <SectionHeader icon={Flower2} title="06 — Строение цветка" subtitle="Формула цветка и её чтение" />
          <div className="grid md:grid-cols-2 gap-6 items-start">
            <div className="bg-[#0a1a14] rounded-xl border border-emerald-800/40 p-4 sm:p-6">
              <FlowerFormulaSVG />
            </div>
            <div className="space-y-4">
              <div className="bg-[#0a1a14] rounded-xl border border-emerald-800/40 p-4">
                <h4 className="font-bold text-emerald-300 mb-3">Как читать формулу цветка</h4>
                <div className="space-y-2 text-sm text-emerald-100/70">
                  <p><strong className="text-pink-300">♂</strong> — мужской цветок (только тычинки)</p>
                  <p><strong className="text-purple-300">♀</strong> — женский цветок (только пестик)</p>
                  <p><strong className="text-green-300">♂♀</strong> — обоеполый (есть и тычинки, и пестик)</p>
                  <p><strong className="text-cyan-300">*</strong> — правильная симметрия (лепестки одинаковые)</p>
                  <p><strong className="text-yellow-300">↑</strong> — неправильная симметрия (лепестки разные)</p>
                  <p><strong className="text-emerald-300">Ч5</strong> — чашечка из 5 чашелистиков</p>
                  <p><strong className="text-pink-300">Л5</strong> — венчик из 5 лепестков</p>
                  <p><strong className="text-yellow-300">(Ч5)</strong> — сросшиеся чашелистики (скобки = сросшиеся)</p>
                  <p><strong className="text-emerald-300">Т∞</strong> — множество тычинок</p>
                  <p><strong className="text-purple-300">П1</strong> — один пестик</p>
                  <p><strong className="text-cyan-300">+</strong> — элементы расположены кругами (многоярусный цветок)</p>
                </div>
              </div>
              <div className="bg-emerald-900/20 p-4 rounded-lg border border-emerald-800/30">
                <h4 className="font-bold text-emerald-300 mb-2">Q19 ВПР — Земляника лесная</h4>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div><span className="text-emerald-400/60">Пол:</span> <strong className="text-white">Б (обоеполый)</strong></div>
                  <div><span className="text-emerald-400/60">Симметрия:</span> <strong className="text-white">Б (правильный)</strong></div>
                  <div><span className="text-emerald-400/60">Чашечка:</span> <strong className="text-white">5</strong> <span className="text-emerald-400/40">(сросшиеся)</span></div>
                  <div><span className="text-emerald-400/60">Венчик:</span> <strong className="text-white">5</strong></div>
                  <div><span className="text-emerald-400/60">Тычинки:</span> <strong className="text-white">∞</strong></div>
                  <div><span className="text-emerald-400/60">Пестик:</span> <strong className="text-white">∞</strong></div>
                </div>
                <AnswerBadge answer="Б, Б, 5, 5, ∞, ∞" />
              </div>
            </div>
          </div>
        </motion.section>

        {/* ===== 07: PLANT FAMILIES ===== */}
        <motion.section variants={sv} initial="hidden" whileInView="visible" viewport={{ once: true, margin: '-50px' }} className="mb-20">
          <SectionHeader icon={Sun} title="07 — Семейства покрытосеменных" subtitle="7 главных семейств, которые встречаются в ВПР" />
          <div className="space-y-3">
            {[
              { name: 'Крестоцветные (Капустные)', formula: 'Ч4 Л4 Т2+4 П1', fruit: 'Стручок / Стручочек', color: '#fbbf24', examples: 'Капуста, Редис, Горчица, Левкой', sign: '4 чашелистика, 4 лепестка расположены крест-накрест (отсюда название)' },
              { name: 'Мотыльковые (Бобовые)', formula: 'Ч(5) Л1+2+(2) Т(9)+1 П1', fruit: 'Боб', color: '#22c55e', examples: 'Горох, Акация, Клевер, Люпин, Чина', sign: 'Мотыльковый цветок: парус (1 большой лепесток) + вёсла (2 боковых) + лодочка (2 сросшихся). Плод — боб.' },
              { name: 'Розоцветные', formula: 'Ч5 Л5 Т∞ П∞', fruit: 'Разнообразные', color: '#f472b6', examples: 'Роза, Яблоня, Малина, Земляника, Шиповник', sign: '5 лепестков, 5 чашелистиков, много тычинок. Плоды разнообразны: яблоко, многокостянка, многоорешек.' },
              { name: 'Паслёновые', formula: 'Ч(5) Л(5) Т5 П1', fruit: 'Ягода / Коробочка', color: '#a855f7', examples: 'Картофель, Томат, Паслён, Баклажан, Физалис', sign: 'Сросшиеся чашелистики и лепестки (по 5). Плод чаще всего — ягода или коробочка.' },
              { name: 'Сложноцветные (Астровые)', formula: 'Цветки в корзинке', fruit: 'Семянка', color: '#f97316', examples: 'Подсолнечник, Одуванчик, Ромашка, Бодяк, Осот', sign: 'Соцветие — корзинка (много мелких цветков на общем ложе). Плод — семянка. Часто с летучками (анемохория).' },
              { name: 'Злаковые (Мятликовые)', formula: 'Цветки в колосе/метёлке', fruit: 'Зерновка', color: '#eab308', examples: 'Пшеница, Рис, Кукуруза, Ёж, Мятлик', sign: 'Стебель — соломина (полый с узлами). Соцветия: колос, метёлка, початок. Плод — зерновка (семя срослось с околоплодником).' },
              { name: 'Лилейные', formula: 'Ч3 Л3 Т6 П1', fruit: 'Коробочка / Ягода', color: '#06b6d4', examples: 'Лилия, Тюльпан, Ландыш, Алоэ, Чеснок', sign: 'Части цветка по 3. Листья линейные или цельные. Заметные переходы в строении вегетативных органов.' },
            ].map((fam, i) => (
              <Expandable key={i} title={fam.name}>
                <div className="text-sm text-emerald-100/70 space-y-3">
                  <div className="grid sm:grid-cols-3 gap-3">
                    <div className="p-3 rounded-lg bg-emerald-900/20 border border-emerald-800/20">
                      <span className="text-xs text-emerald-400/60">Формула</span>
                      <p className="font-mono font-bold text-white mt-1">{fam.formula}</p>
                    </div>
                    <div className="p-3 rounded-lg bg-emerald-900/20 border border-emerald-800/20">
                      <span className="text-xs text-emerald-400/60">Плод</span>
                      <p className="font-bold text-white mt-1">{fam.fruit}</p>
                    </div>
                    <div className="p-3 rounded-lg bg-emerald-900/20 border border-emerald-800/20">
                      <span className="text-xs text-emerald-400/60">Примеры</span>
                      <p className="text-emerald-200/80 mt-1">{fam.examples}</p>
                    </div>
                  </div>
                  <p><strong className="text-emerald-300">Отличительный признак:</strong> {fam.sign}</p>
                </div>
              </Expandable>
            ))}
          </div>
        </motion.section>

        {/* ===== 08: FRUIT TYPES ===== */}
        <motion.section variants={sv} initial="hidden" whileInView="visible" viewport={{ once: true, margin: '-50px' }} className="mb-20">
          <SectionHeader icon={Apple /* fallback to Leaf */} title="08 — Типы плодов" subtitle="Классификация плодов: сочные и сухие" />
          <div className="bg-[#0a1a14] rounded-xl border border-emerald-800/40 p-4 sm:p-6 mb-6">
            <FruitTreeSVG />
          </div>
          <div className="space-y-3">
            <Expandable title="Сочные плоды (мясистые)">
              <div className="text-sm text-emerald-100/70 space-y-2">
                <p><strong className="text-red-300">Ягода</strong> — тонкая кожица, сочная мякоть, много семян внутри. Примеры: виноград, смородина, крыжовник, томат.</p>
                <p><strong className="text-purple-300">Костянка</strong> — мясистый околоплодник и одна твёрдая косточка внутри. Примеры: вишня, слива, абрикос, персик, маслина.</p>
                <p><strong className="text-yellow-300">Яблоко</strong> — многосемянный плод с хрящеватой оболочкой. Примеры: яблоко, рябина, груша, айва.</p>
                <p><strong className="text-pink-300">Многокостянка</strong> — сборный плод из множества маленьких костянок. Пример: малина.</p>
                <p><strong className="text-green-300">Многоорешек</strong> — сборный плод на разрастающемся цветоложе. Примеры: земляника, шиповник.</p>
                <p><strong className="text-cyan-300">Тыквина</strong> — крупный плод с твёрдой наружной оболочкой. Примеры: огурец, тыква, арбуз, кабачок.</p>
              </div>
            </Expandable>
            <Expandable title="Сухие плоды">
              <div className="text-sm text-emerald-100/70 space-y-2">
                <p><strong className="text-green-300">Боб</strong> — вскрывается по двум швам (створкам). Семена прикреплены к стенкам. Характерен для Бобовых. Примеры: горох, фасоль, акация, чина луговая.</p>
                <p><strong className="text-cyan-300">Коробочка</strong> — сухой плод, открывается крышечкой или дырочками. Много семян. Примеры: лён, мак, лилия саранка, табак.</p>
                <p><strong className="text-yellow-300">Зерновка</strong> — семя срослось с околоплодником (не отделимо). Характерна для Злаковых. Примеры: пшеница, рис, кукуруза, овёс.</p>
                <p><strong className="text-orange-300">Семечка</strong> — сухой невскрывающийся односемянный плод с плёнчатым околоплодником. Примеры: подсолнечник, одуванчик (семянка с летучкой).</p>
                <p><strong className="text-emerald-300">Жёлудь</strong> — сухой односемянный плод с твёрдым околоплодником, заключённый в плюску. Пример: дуб.</p>
              </div>
            </Expandable>
            <div className="bg-emerald-900/20 p-4 rounded-lg border border-emerald-800/30">
              <h4 className="font-bold text-emerald-300 mb-2">Q23 ВПР — Плод Лилии саранки</h4>
              <p className="text-sm text-emerald-100/70 mb-2">Плод лилии — <strong className="text-white">коробочка</strong>. Она сухая и содержит много семян. Следовательно, это сухой многосемянный плод.</p>
              <AnswerBadge answer="2 (сухой многосемянный — коробочка)" />
            </div>
          </div>
        </motion.section>

        {/* ===== 09: LIFE FORMS ===== */}
        <motion.section variants={sv} initial="hidden" whileInView="visible" viewport={{ once: true, margin: '-50px' }} className="mb-20">
          <SectionHeader icon={TreeDeciduous} title="09 — Жизненные формы растений" subtitle="Деревья, кустарники и травы" />
          <div className="mb-6"><LifeFormsSVG /></div>
          <div className="bg-emerald-900/20 p-4 rounded-lg border border-emerald-800/30">
            <h4 className="font-bold text-emerald-300 mb-2">Q25 ВПР — Соответствие</h4>
            <p className="text-sm text-emerald-100/70 mb-2">А) Яблоня → 1 (дерево) | Б) Лапчатка → 3 (трава) | В) Малина → 2 (кустарник) | Г) Рябина → 1 (дерево) | Д) Шиповник → 2 (кустарник) | Е) Гравилат → 3 (трава)</p>
            <AnswerBadge answer="132123" />
          </div>
        </motion.section>

        {/* ===== 10: FUNGI ===== */}
        <motion.section variants={sv} initial="hidden" whileInView="visible" viewport={{ once: true, margin: '-50px' }} className="mb-20">
          <SectionHeader icon={ShieldAlert} title="10 — Грибы" subtitle="Особое царство живой природы" />
          <div className="grid md:grid-cols-2 gap-4 mb-6">
            <InfoCard icon={ShieldAlert} title="Q5 — Съедобные шляпочные грибы">
              <div className="text-sm text-emerald-100/70 space-y-2">
                <p>Шляпочные грибы — это грибы, у которых есть шляпка и ножка (пlok). Съедобные: рыжик (1), опёнок летний (3).</p>
                <p className="text-red-300 font-bold">Мухомор — ЯДОВИТЫЙ, хотя и шляпочный!</p>
                <p className="text-yellow-300">Мукор и пеницилл — НЕ шляпочные (плесневые грибы-микроорганизмы).</p>
                <AnswerBadge answer="13 (рыжик, опёнок летний)" />
              </div>
            </InfoCard>
            <InfoCard icon={Bug} title="Q6 — Особенности грибов">
              <div className="text-sm text-emerald-100/70 space-y-2">
                <p>Грибы совмещают признаки растений и животных.</p>
                <p>С животными сходны: в клетках <strong className="text-white">НЕ запасается крахмал (А=5)</strong> (запасают гликоген), питаются готовыми органическими веществами (гетеротрофы).</p>
                <p>Клеточная стенка содержит <strong className="text-white">хитин (Б=3)</strong> — как у членистоногих!</p>
                <p>В отличие от животных: постоянно растут и <strong className="text-white">неподвижны (В=6)</strong>.</p>
                <AnswerBadge answer="А=5, Б=3, В=6" />
              </div>
            </InfoCard>
          </div>
        </motion.section>

        {/* ===== 11: CHLAMYDOMONAS LIFE CYCLE ===== */}
        <motion.section variants={sv} initial="hidden" whileInView="visible" viewport={{ once: true, margin: '-50px' }} className="mb-20">
          <SectionHeader icon={Dna} title="11 — Жизненный цикл Хламидомонады" subtitle="Два способа размножения" />
          <div className="bg-[#0a1a14] rounded-xl border border-emerald-800/40 p-4 sm:p-6 mb-6">
            <ChlamydomonasCycleSVG />
          </div>
          <div className="grid md:grid-cols-2 gap-4">
            <div className="bg-pink-900/10 p-4 rounded-lg border border-pink-800/30">
              <h4 className="font-bold text-pink-400 mb-2">А — Половое размножение</h4>
              <p className="text-sm text-emerald-100/70 mb-2">Происходит <strong className="text-white">слияние гамет</strong> (специальных половых клеток). В результате образуется зигота с толстой оболочкой — циста, которая переживает неблагоприятные условия.</p>
              <p className="text-sm text-emerald-100/70"><strong className="text-pink-300">Условия:</strong> неблагоприятные (похолодание, осень, высыхание водоёма).</p>
              <AnswerBadge answer="Половое (слияние гамет)" label="Q9" />
              <AnswerBadge answer="Неблагоприятные условия" label="Q10" />
            </div>
            <div className="bg-green-900/10 p-4 rounded-lg border border-green-800/30">
              <h4 className="font-bold text-green-400 mb-2">Б — Вегетативное (бесполое) размножение</h4>
              <p className="text-sm text-emerald-100/70 mb-2">Клетка делится надвое, образуя зооспоры (дочерние клетки с жгутиками). Быстрый способ размножения при хороших условиях.</p>
              <p className="text-sm text-emerald-100/70"><strong className="text-green-300">Условия:</strong> благоприятные (тёплая вода, много света, достаточное питание).</p>
            </div>
          </div>
          <div className="mt-4 bg-red-900/10 p-4 rounded-lg border border-red-800/20">
            <h4 className="font-bold text-red-400 mb-2">⚠️ Частая ошибка на ВПР!</h4>
            <p className="text-sm text-emerald-100/70">Многие ученики думают, что «А = вегетативное» (потому что вегетативное простое). На самом деле <strong className="text-white">А = половое</strong> (слияние гамет), а вегетативное — это деление на зооспоры! А происходит при <strong className="text-white">НЕБЛАГОПРИЯТНЫХ</strong> условиях (когда нужно пережить зиму).</p>
          </div>
        </motion.section>

        {/* ===== 12: LEAF TYPES ===== */}
        <motion.section variants={sv} initial="hidden" whileInView="visible" viewport={{ once: true, margin: '-50px' }} className="mb-20">
          <SectionHeader icon={Leaf} title="12 — Типы листьев" subtitle="4 основных типа" />
          <LeafTypesSVG />
          <div className="mt-4 bg-emerald-900/20 p-4 rounded-lg border border-emerald-800/30">
            <h4 className="font-bold text-emerald-300 mb-2">Q18 ВПР — Лилейные</h4>
            <p className="text-sm text-emerald-100/70 mb-2">У растений семейства Лилейные встречаются <strong className="text-white">линейные</strong> (1) и <strong className="text-white">цельные</strong> (4) листья. Рассечённые и игловидные не характерны для лилейных.</p>
            <AnswerBadge answer="14 (линейные, цельные)" />
          </div>
        </motion.section>

        {/* ===== 13: INFLORESCENCES ===== */}
        <motion.section variants={sv} initial="hidden" whileInView="visible" viewport={{ once: true, margin: '-50px' }} className="mb-20">
          <SectionHeader icon={Flower2} title="13 — Соцветия и плоды семейств" subtitle="Q20-22: Бобовые и Паслёновые" />
          <div className="grid md:grid-cols-2 gap-4">
            <div className="bg-emerald-900/20 p-4 rounded-lg border border-emerald-800/30">
              <h4 className="font-bold text-emerald-300 mb-2">Q20 — Соцветия Бобовых</h4>
              <p className="text-sm text-emerald-100/70 mb-2">У растений семейства Бобовые (Мотыльковые) встречаются соцветия:</p>
              <ul className="text-sm text-emerald-100/70 space-y-1 ml-4">
                <li>• <strong className="text-white">Кисть (2)</strong> — цветы на длинных цветоножках, прикреплённых к удлинённой оси. Пример: люпин, акация, горох.</li>
                <li>• <strong className="text-white">Головка (5)</strong> — укороченная ось с сидячими цветками, собранными в головку. Пример: клевер.</li>
              </ul>
              <p className="text-sm text-red-300 mt-2">❌ Колос (7) — НЕ характерен для бобовых! Колос — это признак злаковых.</p>
              <AnswerBadge answer="25 (кисть, головка)" />
            </div>
            <div className="bg-emerald-900/20 p-4 rounded-lg border border-emerald-800/30">
              <h4 className="font-bold text-emerald-300 mb-2">Q21-22 — Плод Чины луговой</h4>
              <p className="text-sm text-emerald-100/70 mb-2">Плод бобовых — это <strong className="text-white">боб</strong>. Он обозначен на рисунке цифрой 1. Боб — сухой многосемянный плод, который вскрывается по двум швам (как стручок гороха).</p>
              <AnswerBadge answer="1 → боб" />
            </div>
          </div>
        </motion.section>

        {/* ===== 14: ENVIRONMENT & EVOLUTION MATCHING ===== */}
        <motion.section variants={sv} initial="hidden" whileInView="visible" viewport={{ once: true, margin: '-50px' }} className="mb-20">
          <SectionHeader icon={Droplets} title="14 — Среда обитания" subtitle="Водные и наземные растения" />
          <PlantGroupingGame />
          <div className="mt-4 grid md:grid-cols-2 gap-4">
            <div className="bg-emerald-900/20 p-4 rounded-lg border border-emerald-800/30">
              <h4 className="font-bold text-emerald-300 mb-2">Q13 — Среда обитания</h4>
              <div className="text-sm text-emerald-100/70 space-y-1">
                <p>Кукушкин лён → <strong className="text-white">наземно-воздушная</strong></p>
                <p>Ламинария → <strong className="text-white">водная</strong></p>
                <p>Баклажан → <strong className="text-white">наземно-воздушная</strong></p>
              </div>
            </div>
            <div className="bg-emerald-900/20 p-4 rounded-lg border border-emerald-800/30">
              <h4 className="font-bold text-emerald-300 mb-2">Q14 — Группы на схеме эволюции</h4>
              <div className="text-sm text-emerald-100/70 space-y-1">
                <p>Кукушкин лён → <strong className="text-white">4 (Мхи)</strong></p>
                <p>Ламинария → <strong className="text-white">3 (Бурые водоросли)</strong></p>
                <p>Баклажан → <strong className="text-white">10 (Двудольные)</strong></p>
              </div>
              <AnswerBadge answer="4310" />
            </div>
          </div>
        </motion.section>

        {/* ===== 15: PASLENOVY FAMILY ===== */}
        <motion.section variants={sv} initial="hidden" whileInView="visible" viewport={{ once: true, margin: '-50px' }} className="mb-20">
          <SectionHeader icon={ShieldAlert} title="15 — Семейство Паслёновые" subtitle="Q24: дикорастущие и культурные" />
          <div className="bg-emerald-900/20 p-4 rounded-lg border border-emerald-800/30">
            <p className="text-sm text-emerald-100/70 mb-3">Из списка: 1) паслён чёрный, 2) ландыш, 3) паслён красный, 4) картофель, 5) мать-и-мачеха, 6) томат.</p>
            <p className="text-sm text-emerald-100/70 mb-2"><strong className="text-emerald-300">Представители Паслёновых:</strong> паслён чёрный (1), паслён красный (3), картофель (4), томат (6).</p>
            <p className="text-sm text-emerald-100/70 mb-1"><strong className="text-green-300">Дикорастущие:</strong> паслён чёрный (1), паслён красный (3).</p>
            <p className="text-sm text-emerald-100/70 mb-2"><strong className="text-yellow-300">Культурные:</strong> картофель (4), томат (6).</p>
            <p className="text-sm text-red-300">❌ Ландыш (2) — Лилейные, Мать-и-мачеха (5) — Сложноцветные.</p>
            <AnswerBadge answer="Представители: 1346 | Дикорастущие: 13 | Культурные: 46" />
          </div>
        </motion.section>

        {/* ===== 16: SEED DISPERSAL ===== */}
        <motion.section variants={sv} initial="hidden" whileInView="visible" viewport={{ once: true, margin: '-50px' }} className="mb-20">
          <SectionHeader icon={Wind} title="16 — Распространение плодов" subtitle="Q26-27: Сложноцветные" />
          <div className="grid md:grid-cols-2 gap-4">
            <div className="bg-emerald-900/20 p-4 rounded-lg border border-emerald-800/30">
              <h4 className="font-bold text-emerald-300 mb-2">Q26 — Семянки с летучками</h4>
              <p className="text-sm text-emerald-100/70 mb-2">У многих сложноцветных семянки имеют летучки (хохолки) — специальные выросты из околоплодника, работающие как «парашюты». Они позволяют распространяться <strong className="text-white">ветром</strong> (анемохория) на большие расстояния.</p>
              <p className="text-sm text-emerald-100/70">Примеры: одуванчик, бодяк, осот — их семена разлетаются на километры!</p>
              <AnswerBadge answer="Ветром (анемохория)" />
            </div>
            <div className="bg-emerald-900/20 p-4 rounded-lg border border-emerald-800/30">
              <h4 className="font-bold text-emerald-300 mb-2">Q27 — Сорняки Сложноцветные</h4>
              <p className="text-sm text-emerald-100/70 mb-2">Три примера сорных растений семейства Сложноцветные:</p>
              <ul className="text-sm text-emerald-100/70 space-y-1 ml-4">
                <li>• <strong className="text-white">Бодяк полевой</strong> — с колючками, семена с летучками</li>
                <li>• <strong className="text-white">Амброзия полыннолистная</strong> — сильный аллерген</li>
                <li>• <strong className="text-white">Осот (полевой)</strong> — распространяется семянками с летучками</li>
              </ul>
            </div>
          </div>
        </motion.section>

        {/* ===== 17: ORGANELLES Q7-8 ===== */}
        <motion.section variants={sv} initial="hidden" whileInView="visible" viewport={{ once: true, margin: '-50px' }} className="mb-20">
          <SectionHeader icon={Microscope} title="17 — Органоиды на рисунке" subtitle="Q7-8: Определение и функция" />
          <div className="grid md:grid-cols-2 gap-4">
            <div className="bg-emerald-900/20 p-4 rounded-lg border border-emerald-800/30">
              <h4 className="font-bold text-emerald-300 mb-2">Q7 — Органоид №4</h4>
              <p className="text-sm text-emerald-100/70 mb-2">На рисунке хламидомонады цифрой 4 обозначена <strong className="text-white">пластида</strong> — хроматофор (это то же самое, что хлоропласт у высших растений).</p>
              <p className="text-sm text-emerald-100/70">У водорослей пластида называется хроматофор — она содержит хлорофилл и обеспечивает фотосинтез.</p>
              <AnswerBadge answer="Хлоропласт (хроматофор)" />
            </div>
            <div className="bg-emerald-900/20 p-4 rounded-lg border border-emerald-800/30">
              <h4 className="font-bold text-emerald-300 mb-2">Q8 — Функция</h4>
              <p className="text-sm text-emerald-100/70 mb-2">Хроматофор (хлоропласт) выполняет функцию <strong className="text-white">фотосинтеза</strong> — процесса образования органических веществ из углекислого газа и воды с использованием энергии солнечного света.</p>
              <AnswerBadge answer="Фотосинтез" />
            </div>
          </div>
        </motion.section>

        {/* ===== BACK TO TESTS ===== */}
        <motion.section initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.5 }} className="text-center pb-12">
          <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.98 }}>
            <Link href="/vpr-tests" className="inline-flex items-center justify-center gap-2 px-8 py-4 font-bold text-white bg-emerald-600 hover:bg-emerald-500 transition-colors rounded-full shadow-lg shadow-emerald-900/50">
              <span>ВЕРНУТЬСЯ К ТЕСТАМ</span>
              <Leaf className="w-5 h-5" />
            </Link>
          </motion.div>
        </motion.section>
      </main>
    </div>
  );
}

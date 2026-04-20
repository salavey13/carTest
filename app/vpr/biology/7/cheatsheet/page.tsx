'use client';

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import Image from "next/image";
import {
  Bug, Dna, Microscope, Waves, Skull, ShieldAlert, Activity,
  Fish, Bird, Dog, Eye, ChevronDown, ChevronUp,
  MousePointerClick, ArrowLeft,
} from "lucide-react";

/* ================================================================
   IMAGE URLs (preserved from original)
   ================================================================ */

const imageUrls: Record<string, string> = {
  'bio7-protozoa': 'https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/vprtests/IMG_20251126_214900-cb9221fd-8197-4c43-9a49-232a287f880b.jpg',
  'bio7-hydra': 'https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/vprtests/IMG_20251126_215159-943d4b87-c2a8-45ca-b4e9-0518881e3b71.jpg',
  'bio7-worms': 'https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/vprtests/IMG_20251126_215325-84ebcac3-91e9-49a1-b816-4c2f4c6bd8f1.jpg',
  'bio7-arthropods': 'https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/vprtests/2a29d09b-61f7-4006-a442-5bbb505200b3-d206ca8c-f707-43a5-ba69-bcc30d277a06.png',
};

/* ================================================================
   DATA
   ================================================================ */

type Organelle = 'membrane' | 'nucleus' | 'mitochondria' | 'cytoplasm' | 'ribosome' | 'er' | null;

const organelleData: Record<string, { label: string; description: string; color: string }> = {
  membrane: {
    label: 'Оболочка (мембрана)',
    description: 'Защитный слой клетки. Контролирует что входит и выходит. Состоит из двойного слоя липидов.',
    color: '#34d399',
  },
  nucleus: {
    label: 'Ядро',
    description: '«Мозг» клетки. Хранит ДНК и управляет всеми процессами. Есть не у всех (эритроциты — без ядра).',
    color: '#6ee7b7',
  },
  mitochondria: {
    label: 'Митохондрии',
    description: '«Электростанции» клетки. Вырабатывают энергию (АТФ) в процессе клеточного дыхания.',
    color: '#f59e0b',
  },
  cytoplasm: {
    label: 'Цитоплазма',
    description: 'Внутренняя среда клетки (желе). Все органеллы плавают в ней. Здесь проходят химические реакции.',
    color: '#10b981',
  },
  ribosome: {
    label: 'Рибосомы',
    description: '«Фабрики белка». Синтезируют белки по инструкции от ДНК. Мельчайшие органеллы.',
    color: '#a78bfa',
  },
  er: {
    label: 'Эндоплазматическая сеть',
    description: 'Транспортная система клетки. Перемещает вещества внутри клетки. Бывает гладкой и шероховатой.',
    color: '#38bdf8',
  },
};

const evolutionChain = [
  { name: 'Простейшие', sub: 'Амёба, Эвглена', x: 10, y: 250, color: '#6ee7b7' },
  { name: 'Кишечнополостные', sub: 'Гидра, Медуза', x: 10, y: 200, color: '#22d3ee' },
  { name: 'Черви', sub: 'Плоские, Круглые, Кольчатые', x: 10, y: 150, color: '#f472b6' },
  { name: 'Членистоногие', sub: 'Насекомые, Пауки, Раки', x: 10, y: 100, color: '#fbbf24' },
  { name: 'Хордовые', sub: 'Рыбы → Земноводные → Рептилии → Птицы → Млекопитающие', x: 10, y: 50, color: '#ef4444' },
];

type VertebrateType = 'fish' | 'amphibian' | 'bird_mammal';

const heartData: Record<VertebrateType, { label: string; chambers: number; description: string; color: string; features: string[] }> = {
  fish: {
    label: 'Рыбы — 2 камеры',
    chambers: 2,
    description: 'Сердце состоит из предсердия и желудочка. Кровь проходит только один круг кровообращения. Кровь всегда венозная.',
    color: '#38bdf8',
    features: ['1 круг кровообращения', 'Только венозная кровь', 'Жаберное дыхание'],
  },
  amphibian: {
    label: 'Земноводные — 3 камеры',
    chambers: 3,
    description: 'Два предсердия + один желудочек. Кровь смешивается в желудочке. 2 круга кровообращения.',
    color: '#4ade80',
    features: ['2 круга кровообращения', 'Кровь частично смешивается', 'Кожное + лёгочное дыхание'],
  },
  bird_mammal: {
    label: 'Птицы и Млекопитающие — 4 камеры',
    chambers: 4,
    description: 'Два предсердия + два желудочка. Кровь НЕ смешивается. Полное разделение артериальной и венозной крови. Самая эффективная система.',
    color: '#ef4444',
    features: ['2 круга кровообращения', 'Кровь НЕ смешивается', 'Теплокровность', 'Высокая активность'],
  },
};

const vprFacts = [
  { number: '~1,5 млн', label: 'видов животных на Земле', icon: '🌍' },
  { number: '~1 млн', label: 'видов насекомых (большинство животных)', icon: '🐞' },
  { number: '46', label: 'хромосом у человека', icon: '🧬' },
  { number: '78', label: 'хромосом у собаки', icon: '🐕' },
  { number: '2', label: 'ядра у инфузории-туфельки', icon: '🔬' },
  { number: '3', label: 'отдела тела у насекомых (голова, грудь, брюшко)', icon: '🦗' },
  { number: '5', label: 'классов позвоночных животных', icon: '🦴' },
  { number: '4', label: 'типа членистоногих (насекомые, пауки, раки, многоножки)', icon: '🦂' },
];

/* ================================================================
   SVG COMPONENTS
   ================================================================ */

/* --- 1. CellSVG: Interactive animal cell with hoverable organelles --- */
function CellSVG({ activeOrganelle, onHover }: { activeOrganelle: Organelle; onHover: (org: Organelle) => void }) {
  const getOpacity = (key: string) => {
    if (!activeOrganelle) return 0.8;
    return activeOrganelle === key ? 1 : 0.2;
  };

  return (
    <svg viewBox="0 0 300 300" className="w-full h-72 sm:h-80" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <radialGradient id="cellGrad" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#0a2e1f" />
          <stop offset="100%" stopColor="#061a10" />
        </radialGradient>
        <filter id="orgGlow">
          <feGaussianBlur stdDeviation="4" result="blur" />
          <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
      </defs>

      {/* Cell membrane (outer boundary) */}
      <g
        onMouseEnter={() => onHover('membrane')}
        onMouseLeave={() => onHover(null)}
        className="cursor-pointer"
      >
        <ellipse cx="150" cy="150" rx="130" ry="120" fill="url(#cellGrad)"
          stroke="#34d399" strokeWidth="3" opacity={getOpacity('membrane')}
          strokeDasharray={activeOrganelle === 'membrane' ? '0' : '8 4'}
        />
        {activeOrganelle === 'membrane' && (
          <text x="150" y="24" textAnchor="middle" fill="#34d399" fontSize="11" fontWeight="bold">Оболочка</text>
        )}
      </g>

      {/* Cytoplasm (background fill already from gradient, clickable area) */}
      <g
        onMouseEnter={() => onHover('cytoplasm')}
        onMouseLeave={() => onHover(null)}
        className="cursor-pointer"
      >
        <ellipse cx="150" cy="150" rx="110" ry="100" fill="#10b981" opacity={activeOrganelle === 'cytoplasm' ? 0.12 : 0.04}
          stroke="none"
        />
        {activeOrganelle === 'cytoplasm' && (
          <text x="150" y="272" textAnchor="middle" fill="#10b981" fontSize="11" fontWeight="bold">Цитоплазма</text>
        )}
      </g>

      {/* Endoplasmic Reticulum (wavy lines around nucleus) */}
      <g
        onMouseEnter={() => onHover('er')}
        onMouseLeave={() => onHover(null)}
        className="cursor-pointer"
      >
        <path d="M80,110 Q100,90 120,110 Q140,130 160,110 Q180,90 200,110 Q220,130 240,110"
          fill="none" stroke="#38bdf8" strokeWidth="1.5" opacity={getOpacity('er')}
          strokeDasharray="4 3"
        />
        <path d="M80,180 Q100,160 120,180 Q140,200 160,180 Q180,160 200,180 Q220,200 240,180"
          fill="none" stroke="#38bdf8" strokeWidth="1.5" opacity={getOpacity('er')}
          strokeDasharray="4 3"
        />
        {activeOrganelle === 'er' && (
          <text x="60" y="148" textAnchor="middle" fill="#38bdf8" fontSize="10" fontWeight="bold">ЭПС</text>
        )}
      </g>

      {/* Mitochondria (bean-shaped, 2 of them) */}
      {[
        { cx: 85, cy: 130, r: 18 },
        { cx: 210, cy: 175, r: 16 },
      ].map((m, i) => (
        <g
          key={`mito-${i}`}
          onMouseEnter={() => onHover('mitochondria')}
          onMouseLeave={() => onHover(null)}
          className="cursor-pointer"
        >
          <ellipse cx={m.cx} cy={m.cy} rx={m.r} ry={m.r * 0.6}
            fill="#f59e0b" opacity={getOpacity('mitochondria') * 0.3}
            stroke="#f59e0b" strokeWidth="1.5"
          />
          {/* Inner folds */}
          <path d={`M${m.cx - 8},${m.cy - 5} Q${m.cx},${m.cy + 5} ${m.cx + 8},${m.cy - 3}`}
            fill="none" stroke="#fbbf24" strokeWidth="0.8" opacity={getOpacity('mitochondria') * 0.6}
          />
        </g>
      ))}
      {activeOrganelle === 'mitochondria' && (
        <text x="85" y="160" textAnchor="middle" fill="#f59e0b" fontSize="10" fontWeight="bold">Митохондрия</text>
      )}

      {/* Ribosomes (tiny dots scattered) */}
      <g
        onMouseEnter={() => onHover('ribosome')}
        onMouseLeave={() => onHover(null)}
        className="cursor-pointer"
      >
        {[
          { cx: 100, cy: 90 }, { cx: 125, cy: 200 }, { cx: 175, cy: 85 },
          { cx: 195, cy: 210 }, { cx: 140, cy: 220 }, { cx: 110, cy: 170 },
        ].map((r, i) => (
          <circle key={`ribo-${i}`} cx={r.cx} cy={r.cy} r="2.5"
            fill="#a78bfa" opacity={getOpacity('ribosome')}
          >
            <animate attributeName="opacity" values={`${getOpacity('ribosome')};${getOpacity('ribosome') * 0.4};${getOpacity('ribosome')}`}
              dur={`${2 + i * 0.3}s`} repeatCount="indefinite" />
          </circle>
        ))}
        {activeOrganelle === 'ribosome' && (
          <text x="230" y="85" textAnchor="middle" fill="#a78bfa" fontSize="10" fontWeight="bold">Рибосомы</text>
        )}
      </g>

      {/* Nucleus */}
      <g
        onMouseEnter={() => onHover('nucleus')}
        onMouseLeave={() => onHover(null)}
        className="cursor-pointer"
      >
        <ellipse cx="150" cy="150" rx="38" ry="35" fill="#064e3b" opacity={getOpacity('nucleus') * 0.6}
          stroke="#6ee7b7" strokeWidth="2"
        />
        {/* Nucleolus */}
        <circle cx="145" cy="145" r="10" fill="#6ee7b7" opacity={getOpacity('nucleus') * 0.4} />
        {/* DNA strands hint */}
        <path d="M135,155 Q150,145 165,155 Q150,165 135,155" fill="none" stroke="#34d399"
          strokeWidth="0.8" opacity={getOpacity('nucleus') * 0.5}
        />
        <animate attributeName="opacity" values={`${getOpacity('nucleus') * 0.5};${getOpacity('nucleus') * 0.2};${getOpacity('nucleus') * 0.5}`}
          dur="3s" repeatCount="indefinite"
        />
        {activeOrganelle === 'nucleus' && (
          <text x="150" y="155" textAnchor="middle" fill="#6ee7b7" fontSize="10" fontWeight="bold">Ядро</text>
        )}
      </g>

      {/* Animated pulse ring on active */}
      {activeOrganelle && (
        <circle cx="150" cy="150" r="40" fill="none" stroke={organelleData[activeOrganelle]?.color || '#10b981'}
          strokeWidth="0.5" opacity="0.3"
        >
          <animate attributeName="r" values="40;90;40" dur="2.5s" repeatCount="indefinite" />
          <animate attributeName="opacity" values="0.3;0;0.3" dur="2.5s" repeatCount="indefinite" />
        </circle>
      )}
    </svg>
  );
}

/* --- 2. EvolutionTreeSVG: Animated evolution branches --- */
function EvolutionTreeSVG() {
  return (
    <svg viewBox="0 0 500 320" className="w-full h-64 sm:h-80" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="evoGrad" x1="0" y1="1" x2="0" y2="0">
          <stop offset="0%" stopColor="#6ee7b7" />
          <stop offset="50%" stopColor="#22d3ee" />
          <stop offset="100%" stopColor="#ef4444" />
        </linearGradient>
        <filter id="evoGlow">
          <feGaussianBlur stdDeviation="3" result="blur" />
          <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
      </defs>

      {/* Main trunk line */}
      <motion.line
        initial={{ y2: 310 }}
        animate={{ y2: 310 }}
        x1="60" y1="310" x2="60" y2="40"
        stroke="url(#evoGrad)" strokeWidth="3" strokeLinecap="round"
        opacity="0.4"
      />

      {/* Branches with growing animation */}
      {evolutionChain.map((item, i) => {
        const y = 280 - i * 55;
        const branchLen = 80 + i * 30;
        return (
          <g key={i}>
            {/* Branch */}
            <motion.line
              initial={{ x2: 60 }}
              whileInView={{ x2: 60 + branchLen }}
              viewport={{ once: true }}
              transition={{ duration: 0.8, delay: i * 0.2, ease: 'easeOut' }}
              x1="60" y1={y} x2={60 + branchLen} y2={y}
              stroke={item.color} strokeWidth="2.5" strokeLinecap="round"
              filter="url(#evoGlow)"
            />
            {/* Node dot on trunk */}
            <motion.circle
              initial={{ scale: 0 }}
              whileInView={{ scale: 1 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.2 + 0.4, type: 'spring' }}
              cx="60" cy={y} r="6" fill={item.color}
            />
            {/* Label */}
            <motion.g
              initial={{ opacity: 0, x: 10 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.2 + 0.5 }}
            >
              <text
                x={70 + branchLen} y={y - 6}
                fill={item.color} fontSize="13" fontWeight="bold"
              >
                {item.name}
              </text>
              <text
                x={70 + branchLen} y={y + 10}
                fill={item.color} fontSize="9" opacity="0.6"
              >
                {item.sub}
              </text>
            </motion.g>

            {/* Animated particle along branch */}
            <circle r="3" fill={item.color} opacity="0.6">
              <animateMotion
                dur={`${2 + i * 0.5}s`}
                repeatCount="indefinite"
                path={`M60,${y} L${60 + branchLen},${y}`}
              />
            </circle>
          </g>
        );
      })}

      {/* Complexity arrow on right */}
      <motion.g
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true }}
        transition={{ delay: 1.2 }}
      >
        <line x1="470" y1="280" x2="470" y2="40" stroke="#10b981" strokeWidth="1" opacity="0.3" />
        <polygon points="470,35 465,50 475,50" fill="#10b981" opacity="0.5" />
        <text x="470" y="300" textAnchor="middle" fill="#10b981" fontSize="9" opacity="0.5">Сложность</text>
      </motion.g>
    </svg>
  );
}

/* --- 3. HeartSVG: Vertebrate heart comparison --- */
function HeartSVG({ type }: { type: VertebrateType }) {
  const data = heartData[type];

  return (
    <svg viewBox="0 0 300 220" className="w-full h-56 sm:h-64" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <filter id="heartGlow">
          <feGaussianBlur stdDeviation="4" result="blur" />
          <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
      </defs>

      {/* Blood vessels */}
      <motion.g
        key={`vessels-${type}`}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3 }}
      >
        {/* Arterial (red, going up) */}
        <line x1="150" y1="30" x2="150" y2="65" stroke="#ef4444" strokeWidth="3" />
        <polygon points="150,25 145,38 155,38" fill="#ef4444" />
        <text x="165" y="50" fill="#ef4444" fontSize="9" fontWeight="bold">Арт. кровь</text>

        {/* Venous (blue, coming in) */}
        <line x1="80" y1="30" x2="80" y2="65" stroke="#3b82f6" strokeWidth="3" />
        <polygon points="80,25 75,38 85,38" fill="#3b82f6" />
        <text x="35" y="50" fill="#3b82f6" fontSize="9" fontWeight="bold">Вен. кровь</text>
      </motion.g>

      {/* Heart body */}
      <motion.g
        key={`heart-${type}`}
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 200 }}
      >
        {/* Heart shape */}
        <motion.path
          d="M150,200 C90,180 50,140 60,100 C70,60 110,55 150,85 C190,55 230,60 240,100 C250,140 210,180 150,200 Z"
          fill={data.color} opacity="0.15"
          stroke={data.color} strokeWidth="2"
          filter="url(#heartGlow)"
          animate={{
            scale: [1, 1.03, 1],
          }}
          transition={{ duration: 0.8, repeat: Infinity, ease: 'easeInOut' }}
          style={{ transformOrigin: '150px 140px' }}
        />

        {/* Chambers */}
        {type === 'fish' && (
          <>
            {/* Atrium (1) */}
            <motion.ellipse cx="120" cy="130" rx="30" ry="35"
              fill="#3b82f6" opacity="0.4" stroke="#3b82f6" strokeWidth="1"
              initial={{ rx: 0 }} animate={{ rx: 30 }} transition={{ delay: 0.4 }}
            />
            <text x="120" y="135" textAnchor="middle" fill="white" fontSize="11" fontWeight="bold">П</text>
            {/* Ventricle (1) */}
            <motion.ellipse cx="180" cy="130" rx="30" ry="35"
              fill="#3b82f6" opacity="0.6" stroke="#3b82f6" strokeWidth="1"
              initial={{ rx: 0 }} animate={{ rx: 30 }} transition={{ delay: 0.6 }}
            />
            <text x="180" y="135" textAnchor="middle" fill="white" fontSize="11" fontWeight="bold">Ж</text>
            {/* Arrow between */}
            <path d="M150,125 L150,135" stroke="white" strokeWidth="1.5" markerEnd="url(#arrowHeart)" />
          </>
        )}

        {type === 'amphibian' && (
          <>
            {/* Left atrium */}
            <motion.ellipse cx="90" cy="120" rx="25" ry="28"
              fill="#ef4444" opacity="0.3" stroke="#ef4444" strokeWidth="1"
              initial={{ rx: 0 }} animate={{ rx: 25 }} transition={{ delay: 0.4 }}
            />
            <text x="90" y="125" textAnchor="middle" fill="white" fontSize="9" fontWeight="bold">ЛП</text>
            {/* Right atrium */}
            <motion.ellipse cx="90" cy="165" rx="25" ry="28"
              fill="#3b82f6" opacity="0.3" stroke="#3b82f6" strokeWidth="1"
              initial={{ rx: 0 }} animate={{ rx: 25 }} transition={{ delay: 0.5 }}
            />
            <text x="90" y="170" textAnchor="middle" fill="white" fontSize="9" fontWeight="bold">ПП</text>
            {/* Ventricle (shared) */}
            <motion.ellipse cx="190" cy="142" rx="35" ry="50"
              fill="#a855f7" opacity="0.3" stroke="#a855f7" strokeWidth="1.5"
              initial={{ rx: 0 }} animate={{ rx: 35 }} transition={{ delay: 0.6 }}
            />
            <text x="190" y="140" textAnchor="middle" fill="white" fontSize="11" fontWeight="bold">Ж</text>
            <text x="190" y="155" textAnchor="middle" fill="#a855f7" fontSize="8">(смеш.)</text>
          </>
        )}

        {type === 'bird_mammal' && (
          <>
            {/* Left atrium */}
            <motion.ellipse cx="80" cy="110" rx="25" ry="25"
              fill="#ef4444" opacity="0.3" stroke="#ef4444" strokeWidth="1"
              initial={{ rx: 0 }} animate={{ rx: 25 }} transition={{ delay: 0.4 }}
            />
            <text x="80" y="115" textAnchor="middle" fill="white" fontSize="9" fontWeight="bold">ЛП</text>
            {/* Right atrium */}
            <motion.ellipse cx="80" cy="165" rx="25" ry="25"
              fill="#3b82f6" opacity="0.3" stroke="#3b82f6" strokeWidth="1"
              initial={{ rx: 0 }} animate={{ rx: 25 }} transition={{ delay: 0.5 }}
            />
            <text x="80" y="170" textAnchor="middle" fill="white" fontSize="9" fontWeight="bold">ПП</text>
            {/* Left ventricle */}
            <motion.ellipse cx="195" cy="110" rx="30" ry="28"
              fill="#ef4444" opacity="0.5" stroke="#ef4444" strokeWidth="1.5"
              initial={{ rx: 0 }} animate={{ rx: 30 }} transition={{ delay: 0.6 }}
            />
            <text x="195" y="115" textAnchor="middle" fill="white" fontSize="9" fontWeight="bold">ЛЖ</text>
            {/* Right ventricle */}
            <motion.ellipse cx="195" cy="165" rx="30" ry="28"
              fill="#3b82f6" opacity="0.5" stroke="#3b82f6" strokeWidth="1.5"
              initial={{ rx: 0 }} animate={{ rx: 30 }} transition={{ delay: 0.7 }}
            />
            <text x="195" y="170" textAnchor="middle" fill="white" fontSize="9" fontWeight="bold">ПЖ</text>
            {/* Separation wall */}
            <motion.line
              x1="140" y1="80" x2="140" y2="200"
              stroke="#fbbf24" strokeWidth="2" strokeDasharray="4 3"
              initial={{ opacity: 0 }} animate={{ opacity: 0.7 }}
              transition={{ delay: 0.8 }}
            />
            <text x="140" y="215" textAnchor="middle" fill="#fbbf24" fontSize="8">Перегородка</text>
          </>
        )}

        {/* Heart label */}
        <text x="150" y="22" textAnchor="middle" fill={data.color} fontSize="12" fontWeight="bold">
          {data.label}
        </text>
      </motion.g>

      {/* Arrow marker */}
      <defs>
        <marker id="arrowHeart" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
          <path d="M0,0 L8,3 L0,6 Z" fill="white" />
        </marker>
      </defs>
    </svg>
  );
}

/* ================================================================
   BACKGROUND PATTERN: Cell-like dots
   ================================================================ */

function BackgroundPattern() {
  const dots = Array.from({ length: 50 }, (_, i) => ({
    cx: (i * 73 + 20) % 100,
    cy: (i * 47 + 15) % 100,
    r: 0.3 + (i % 3) * 0.3,
    opacity: 0.06 + (i % 4) * 0.03,
  }));

  return (
    <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
      <svg className="absolute inset-0 w-full h-full" xmlns="http://www.w3.org/2000/svg">
        {dots.map((d, i) => (
          <circle key={i} cx={`${d.cx}%`} cy={`${d.cy}%`} r={d.r} fill="#10b981" opacity={d.opacity}>
            <animate attributeName="opacity" values={`${d.opacity};${d.opacity * 2};${d.opacity}`} dur={`${3 + (i % 5)}s`} repeatCount="indefinite" />
          </circle>
        ))}
      </svg>
      {/* Blur glow orbs */}
      <div className="absolute top-20 -left-32 w-80 h-80 bg-emerald-600/10 rounded-full blur-[120px]" />
      <div className="absolute bottom-40 -right-32 w-96 h-96 bg-green-500/8 rounded-full blur-[140px]" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-emerald-900/5 rounded-full blur-[200px]" />
    </div>
  );
}

/* ================================================================
   SECTION HEADER COMPONENT
   ================================================================ */

function SectionHeader({ icon, title, subtitle }: { icon: React.ReactNode; title: string; subtitle: string }) {
  return (
    <div className="flex items-center gap-4 mb-8">
      <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-500/20 to-teal-600/10 border border-emerald-500/30 text-emerald-400 shrink-0">
        {icon}
      </div>
      <div>
        <h2 className="text-2xl sm:text-3xl font-bold text-emerald-100">{title}</h2>
        <p className="text-emerald-300/60 text-sm mt-0.5">{subtitle}</p>
      </div>
    </div>
  );
}

/* ================================================================
   EXPANDABLE CARD COMPONENT
   ================================================================ */

function ExpandableCard({ title, children, defaultOpen = false, className = '' }: {
  title: string; children: React.ReactNode; defaultOpen?: boolean; className?: string;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className={`bg-[#0a1a14] rounded-xl border border-emerald-800/40 overflow-hidden ${className}`}>
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between p-4 sm:p-5 text-left hover:bg-emerald-900/10 transition-colors"
      >
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
   WORM DETAIL CARD COMPONENT
   ================================================================ */

const wormDetails = [
  {
    key: 'flat',
    title: 'Плоские черви',
    tag: 'Паразиты',
    tagColor: 'text-pink-300 bg-pink-900/30 border-pink-500/20',
    borderColor: 'hover:border-pink-500/50',
    items: [
      { bold: 'Тело:', text: 'Плоское как лента.' },
      { bold: 'Полость тела:', text: 'НЕТ (забито паренхимой).' },
      { bold: 'Пищеварение:', text: 'Тупик. Едят ртом, выбрасывают остатки... тоже ртом.' },
      { bold: 'Опасность:', text: 'Многие — опасные паразиты! Мойте руки!' },
    ],
    examples: 'Планария, Бычий цепень',
    icon: '🪱',
  },
  {
    key: 'round',
    title: 'Круглые черви',
    tag: 'Upgrade',
    tagColor: 'text-orange-300 bg-orange-900/30 border-orange-500/20',
    borderColor: 'hover:border-orange-500/50',
    items: [
      { bold: 'Тело:', text: 'Круглое в разрезе, веретено.' },
      { bold: 'Полость тела:', text: 'Первичная (жидкость под давлением — гидроскелет).' },
      { bold: 'Пищеварение:', text: 'Сквозное! Есть анальное отверстие (революция!).' },
    ],
    examples: 'Аскарида, Острица',
    icon: '🐛',
  },
  {
    key: 'annelid',
    title: 'Кольчатые черви',
    tag: 'Элита',
    tagColor: 'text-purple-300 bg-purple-900/30 border-purple-500/20',
    borderColor: 'hover:border-purple-500/50',
    items: [
      { bold: 'Тело:', text: 'Сегменты (колечки).' },
      { bold: 'Полость тела:', text: 'Вторичная (Целом).' },
      { bold: 'Кровь:', text: 'Замкнутая система (есть сосуды и «сердца»).' },
      { bold: 'Роль:', text: 'Рыхлят землю, создают гумус.' },
    ],
    examples: 'Дождевой червь, Пиявка',
    icon: '🔴',
  },
];

/* ================================================================
   MAIN COMPONENT
   ================================================================ */

export default function Biology7Cheatsheet() {
  /* Interactive states */
  const [activeOrganelle, setActiveOrganelle] = useState<Organelle>(null);
  const [activeVertebrate, setActiveVertebrate] = useState<VertebrateType>('fish');
  const [expandedWorm, setExpandedWorm] = useState<string | null>(null);

  const sectionVariants = {
    hidden: { opacity: 0, y: 40 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: 'easeOut' } },
  };

  const cardVariants = {
    hidden: { opacity: 0, scale: 0.95 },
    visible: { opacity: 1, scale: 1, transition: { duration: 0.4 } },
  };

  return (
    <div className="min-h-screen bg-[#040f0a] text-emerald-50 relative overflow-hidden">
      <BackgroundPattern />

      <main className="relative z-10 max-w-5xl mx-auto px-4 py-8 sm:px-6 lg:px-8">

        {/* ===== BACK LINK ===== */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.4 }}
        >
          <Link
            href="/vpr-tests"
            className="inline-flex items-center gap-2 text-emerald-300/70 hover:text-emerald-200 transition-colors mb-8 group"
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
          className="text-center mb-16"
        >
          {/* Hero SVG — DNA helix / Microscope icon */}
          <div className="flex justify-center mb-6">
            <svg viewBox="0 0 200 120" className="w-48 sm:w-64 h-auto">
              {/* DNA double helix */}
              <motion.path
                d="M80,10 Q140,35 80,60 Q20,85 80,110"
                fill="none" stroke="#10b981" strokeWidth="2.5" opacity="0.6"
                initial={{ pathLength: 0 }}
                animate={{ pathLength: 1 }}
                transition={{ duration: 2, ease: 'easeInOut' }}
              />
              <motion.path
                d="M120,10 Q60,35 120,60 Q180,85 120,110"
                fill="none" stroke="#34d399" strokeWidth="2.5" opacity="0.6"
                initial={{ pathLength: 0 }}
                animate={{ pathLength: 1 }}
                transition={{ duration: 2, ease: 'easeInOut', delay: 0.3 }}
              />
              {/* Cross-links */}
              {[20, 40, 60, 80, 100].map((y, i) => (
                <motion.line
                  key={i}
                  x1={85 + (i % 2 === 0 ? -10 : 10)}
                  y1={y}
                  x2={115 + (i % 2 === 0 ? 10 : -10)}
                  y2={y}
                  stroke="#6ee7b7" strokeWidth="1" opacity="0.3"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 0.3 }}
                  transition={{ delay: 0.5 + i * 0.15 }}
                />
              ))}
              {/* Animated particles */}
              <circle r="3" fill="#6ee7b7">
                <animateMotion dur="3s" repeatCount="indefinite" path="M80,10 Q140,35 80,60 Q20,85 80,110" />
              </circle>
              <circle r="3" fill="#34d399">
                <animateMotion dur="3.5s" repeatCount="indefinite" path="M120,10 Q60,35 120,60 Q180,85 120,110" />
              </circle>
            </svg>
          </div>

          <div className="inline-block mb-4 px-4 py-1.5 rounded-full bg-gradient-to-r from-emerald-500/20 to-teal-500/20 border border-emerald-500/30 text-emerald-300 text-sm font-medium">
            7 класс • Зоология • Подготовка к ВПР
          </div>

          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black bg-gradient-to-r from-emerald-300 via-teal-200 to-lime-400 bg-clip-text text-transparent mb-4 leading-tight">
            БАЗА ЗНАНИЙ
          </h1>

          <p className="text-emerald-200/50 text-base sm:text-lg max-w-2xl mx-auto">
            Вся эволюция животного мира: от Амёбы до Шимпанзе.
            <br />
            <span className="text-emerald-400 font-bold">Цель:</span> Сдать ВПР и отличить жабу от лягушки по таблице.
          </p>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1 }}
            className="flex flex-wrap justify-center gap-3 mt-6"
          >
            {['Зоология', '7 класс', 'ВПР', 'Эволюция'].map((tag) => (
              <span key={tag} className="px-3 py-1 bg-emerald-950/50 border border-emerald-800/30 rounded-full text-xs text-emerald-500">
                {tag}
              </span>
            ))}
          </motion.div>
        </motion.header>

        {/* ===== KEY VPR FACTS ===== */}
        <motion.section
          variants={sectionVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-50px' }}
          className="mb-20"
        >
          <SectionHeader
            icon={<Dna className="w-6 h-6" />}
            title="Ключевые факты ВПР"
            subtitle="Числа, которые нужно запомнить"
          />

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {vprFacts.map((fact, i) => (
              <motion.div
                key={i}
                variants={cardVariants}
                whileHover={{ scale: 1.05, y: -4 }}
                className="bg-[#0a1a14] rounded-xl border border-emerald-800/40 p-4 text-center cursor-default"
              >
                <div className="text-2xl mb-2">{fact.icon}</div>
                <div className="text-xl sm:text-2xl font-bold text-emerald-300 mb-1">{fact.number}</div>
                <div className="text-xs text-emerald-200/50 leading-tight">{fact.label}</div>
              </motion.div>
            ))}
          </div>
        </motion.section>

        {/* ===== INTERACTIVE CELL ORGANELLE SECTION ===== */}
        <motion.section
          variants={sectionVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-50px' }}
          className="mb-20"
        >
          <SectionHeader
            icon={<Microscope className="w-6 h-6" />}
            title="Строение животной клетки"
            subtitle="Интерактивная схема — наведите на органеллу"
          />

          <div className="bg-[#0a1a14] rounded-xl border border-emerald-800/40 p-4 sm:p-6">
            <div className="flex items-center gap-2 mb-4 text-sm text-emerald-300/60">
              <MousePointerClick className="w-4 h-4" />
              <span>Наведите на часть клетки для подробностей</span>
            </div>

            <CellSVG activeOrganelle={activeOrganelle} onHover={setActiveOrganelle} />

            <AnimatePresence mode="wait">
              {activeOrganelle && (
                <motion.div
                  key={activeOrganelle}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.25 }}
                  className="mt-4 p-4 rounded-lg border"
                  style={{
                    backgroundColor: `${organelleData[activeOrganelle].color}10`,
                    borderColor: `${organelleData[activeOrganelle].color}40`,
                  }}
                >
                  <h4 className="font-bold text-base mb-1" style={{ color: organelleData[activeOrganelle].color }}>
                    {organelleData[activeOrganelle].label}
                  </h4>
                  <p className="text-emerald-100/70 text-sm leading-relaxed">
                    {organelleData[activeOrganelle].description}
                  </p>
                </motion.div>
              )}
            </AnimatePresence>

            {!activeOrganelle && (
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-emerald-200/40 text-sm text-center mt-4"
              >
                Наведите курсор на клетку, чтобы узнать об органеллах
              </motion.p>
            )}
          </div>
        </motion.section>

        {/* ===== EVOLUTION TREE SVG ===== */}
        <motion.section
          variants={sectionVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-50px' }}
          className="mb-20"
        >
          <SectionHeader
            icon={<Bug className="w-6 h-6" />}
            title="Древо эволюции"
            subtitle="От простейших к хордовым"
          />

          <div className="bg-[#0a1a14] rounded-xl border border-emerald-800/40 p-4 sm:p-6">
            <EvolutionTreeSVG />
          </div>
        </motion.section>

        {/* ===== SECTION 1: PROTOZOA ===== */}
        <motion.section
          variants={sectionVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-50px' }}
          className="mb-20"
        >
          <SectionHeader
            icon={<Microscope className="w-6 h-6" />}
            title="01 — Простейшие (Соло-игроки)"
            subtitle="Одноклеточные организмы: Амёба, Эвглена, Инфузория"
          />

          <ExpandableCard title="Общая характеристика" defaultOpen>
            <div className="bg-[#040f0a] p-4 rounded-lg border-l-4 border-emerald-500 mb-4">
              <p className="italic text-emerald-100/80">
                &quot;Весь организм — это всего <strong className="text-emerald-300">одна клетка</strong>. Но она умеет всё: охотиться, дышать и даже убегать от проблем.&quot;
              </p>
            </div>
          </ExpandableCard>

          <div className="mt-4 grid md:grid-cols-2 gap-6">
            {/* Protozoa list */}
            <div className="space-y-3">
              {/* Amoeba */}
              <motion.div
                whileHover={{ x: 4, scale: 1.01 }}
                className="bg-[#0a1a14] p-4 rounded-xl border border-emerald-800/40 hover:border-emerald-500/50 transition-colors"
              >
                <div className="flex justify-between items-center mb-2">
                  <strong className="text-emerald-300 text-xl">Амёба</strong>
                  <span className="text-xs bg-[#040f0a] px-2 py-0.5 rounded text-emerald-300/60 border border-emerald-800/30">Слизень 1 lvl</span>
                </div>
                <p className="text-sm text-emerald-100/70 leading-relaxed">
                  Формы нет (течет как желе). Движется <strong className="text-emerald-300">ложноножками</strong>. Захватывает еду всем телом (фагоцитоз).
                </p>
              </motion.div>

              {/* Euglena */}
              <motion.div
                whileHover={{ x: 4, scale: 1.01 }}
                className="bg-[#0a1a14] p-4 rounded-xl border border-emerald-800/40 hover:border-green-500/50 transition-colors"
              >
                <div className="flex justify-between items-center mb-2">
                  <strong className="text-green-300 text-xl">Эвглена</strong>
                  <span className="text-xs bg-[#040f0a] px-2 py-0.5 rounded text-green-300/60 border border-green-800/30">Гибрид</span>
                </div>
                <p className="text-sm text-emerald-100/70 leading-relaxed">
                  Днем — растение (фотосинтез, зеленая), ночью — хищник. Двигатель: <strong className="text-green-300">жгутик</strong>. Есть &quot;глазок&quot; (стигма).
                </p>
              </motion.div>

              {/* Paramecium */}
              <motion.div
                whileHover={{ x: 4, scale: 1.01 }}
                className="bg-[#0a1a14] p-4 rounded-xl border border-emerald-800/40 hover:border-teal-500/50 transition-colors"
              >
                <div className="flex justify-between items-center mb-2">
                  <strong className="text-teal-300 text-xl">Инфузория</strong>
                  <span className="text-xs bg-[#040f0a] px-2 py-0.5 rounded text-teal-300/60 border border-teal-800/30">Танк</span>
                </div>
                <p className="text-sm text-emerald-100/70 leading-relaxed">
                  Самая сложная. <strong className="text-teal-300">2 ядра</strong> (База данных + Размножение). Покрыта ресничками (турбо-скорость).
                </p>
              </motion.div>
            </div>

            {/* Image */}
            <motion.div
              whileHover={{ scale: 1.02 }}
              className="relative rounded-xl overflow-hidden border-2 border-emerald-500/20 shadow-2xl h-full min-h-[300px]"
            >
              <Image
                src={imageUrls['bio7-protozoa']}
                alt="Микроскопический мир"
                fill
                className="object-cover"
              />
              <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/90 to-transparent p-4">
                <p className="text-emerald-200 text-xs font-mono">BIO-SCAN: AMOEBA &amp; EUGLENA</p>
              </div>
            </motion.div>
          </div>
        </motion.section>

        {/* ===== SECTION 2: COELENTERATES ===== */}
        <motion.section
          variants={sectionVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-50px' }}
          className="mb-20"
        >
          <SectionHeader
            icon={<Waves className="w-6 h-6" />}
            title="02 — Кишечнополостные (Гидра & Медузы)"
            subtitle="Первые многоклеточные с лучевой симметрией"
          />

          <div className="grid md:grid-cols-2 gap-6 items-center">
            {/* Image */}
            <motion.div
              whileHover={{ scale: 1.02 }}
              className="relative rounded-xl overflow-hidden border-2 border-cyan-500/20 shadow-2xl h-full min-h-[300px] order-2 md:order-1"
            >
              <Image
                src={imageUrls['bio7-hydra']}
                alt="Анатомия Гидры"
                fill
                className="object-cover"
              />
              <div className="absolute top-3 left-3 bg-black/60 backdrop-blur-md px-3 py-1 rounded border border-cyan-500/30 text-xs text-cyan-300 font-mono">
                SCAN: HYDRA
              </div>
            </motion.div>

            {/* Info */}
            <div className="order-1 md:order-2 space-y-4">
              <motion.div
                whileHover={{ x: 4 }}
                className="flex items-start gap-4 bg-[#0a1a14] p-4 rounded-xl border border-emerald-800/40"
              >
                <div className="bg-cyan-900/50 p-3 rounded-full shrink-0">
                  <Waves className="w-6 h-6 text-cyan-400" />
                </div>
                <div>
                  <h4 className="text-lg font-bold text-white mb-1">Двухслойный мешок</h4>
                  <p className="text-sm text-emerald-100/70 leading-relaxed">
                    Первые многоклеточные. Тело состоит всего из двух слоев:
                    <strong className="text-cyan-300"> Эктодерма</strong> (броня снаружи) и
                    <strong className="text-cyan-300"> Энтодерма</strong> (пищеварение внутри).
                  </p>
                </div>
              </motion.div>

              <motion.div
                whileHover={{ x: 4 }}
                className="bg-[#0a1a14] p-5 rounded-xl border border-cyan-500/20 relative overflow-hidden"
              >
                <div className="absolute -right-4 -top-4 opacity-10">
                  <ShieldAlert size={100} />
                </div>
                <h4 className="font-bold text-cyan-300 mb-2 flex items-center gap-2">
                  <Activity className="w-4 h-4" /> Супер-способность: ЯД
                </h4>
                <p className="text-sm mb-3 text-emerald-100/70 leading-relaxed">
                  В эктодерме есть <strong className="text-cyan-300">стрекательные клетки</strong>.
                  Они выстреливают гарпуном с ядом. Ожог медузы — это работа миллионов таких микро-пушек.
                </p>
                <div className="inline-block bg-cyan-500/20 px-3 py-1 rounded text-xs text-cyan-200 font-mono border border-cyan-500/30">
                  + Регенерация (Бессмертие?)
                </div>
              </motion.div>
            </div>
          </div>
        </motion.section>

        {/* ===== SECTION 3: WORMS ===== */}
        <motion.section
          variants={sectionVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-50px' }}
          className="mb-20"
        >
          <SectionHeader
            icon={<Skull className="w-6 h-6" />}
            title="03 — Эволюция червей"
            subtitle="От плоских паразитов до продвинутых кольчатых инженеров почвы"
          />

          {/* Visual Analysis Card */}
          <motion.div
            whileHover={{ scale: 1.01 }}
            className="bg-[#0a1a14] rounded-xl border border-emerald-800/40 overflow-hidden mb-6"
          >
            <div className="relative h-56 md:h-72 w-full">
              <Image
                src={imageUrls['bio7-worms']}
                alt="Сравнение типов червей"
                fill
                className="object-cover opacity-90 hover:opacity-100 transition-opacity duration-500"
              />
              <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-[#040f0a] via-[#040f0a]/80 to-transparent p-6 pt-16">
                <h3 className="text-xl font-bold text-white">Сравнительный анализ</h3>
                <p className="text-emerald-200/50 text-sm">От плоских паразитов до продвинутых кольчатых инженеров почвы.</p>
              </div>
            </div>
          </motion.div>

          {/* Expandable Worm Cards */}
          <div className="space-y-3">
            {wormDetails.map((worm) => (
              <motion.div
                key={worm.key}
                whileHover={{ scale: 1.01 }}
                className={`bg-[#0a1a14] rounded-xl border border-emerald-800/40 ${worm.borderColor} transition-all overflow-hidden cursor-pointer`}
                onClick={() => setExpandedWorm(expandedWorm === worm.key ? null : worm.key)}
              >
                <div className="flex items-center justify-between p-4 sm:p-5">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{worm.icon}</span>
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="font-bold text-lg text-white">{worm.title}</h4>
                        <span className={`text-xs px-2 py-0.5 rounded border ${worm.tagColor}`}>{worm.tag}</span>
                      </div>
                      <p className="text-xs text-emerald-300/50 font-mono mt-0.5">Примеры: {worm.examples}</p>
                    </div>
                  </div>
                  <motion.div animate={{ rotate: expandedWorm === worm.key ? 180 : 0 }} transition={{ duration: 0.2 }}>
                    <ChevronDown className="w-5 h-5 text-emerald-400" />
                  </motion.div>
                </div>

                <AnimatePresence initial={false}>
                  {expandedWorm === worm.key && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.3, ease: 'easeInOut' }}
                      className="overflow-hidden"
                    >
                      <div className="px-4 sm:px-5 pb-4 sm:pb-5 pt-1">
                        <ul className="space-y-2 text-sm text-emerald-100/70">
                          {worm.items.map((item, idx) => (
                            <li key={idx} className="flex gap-2">
                              <span className="text-emerald-500 mt-0.5 shrink-0">•</span>
                              <span><strong className="text-emerald-300">{item.bold}</strong> {item.text}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            ))}
          </div>
        </motion.section>

        {/* ===== SECTION 4: ARTHROPODS ===== */}
        <motion.section
          variants={sectionVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-50px' }}
          className="mb-20"
        >
          <SectionHeader
            icon={<Dna className="w-6 h-6" />}
            title="04 — Членистоногие (Владыки мира)"
            subtitle="Самая успешная группа животных на планете"
          />

          <div className="grid lg:grid-cols-2 gap-6 mb-6">
            {/* Image */}
            <motion.div
              whileHover={{ scale: 1.02 }}
              className="relative rounded-xl overflow-hidden border border-yellow-500/20 h-64 lg:h-auto min-h-[250px]"
            >
              <Image
                src={imageUrls['bio7-arthropods']}
                alt="Строение рака и паука"
                fill
                className="object-contain bg-[#040f0a]/50 p-2"
              />
              <div className="absolute top-2 right-2 bg-yellow-500/20 text-yellow-200 px-2 py-1 rounded text-xs font-bold border border-yellow-500/30">
                EXOSKELETON: ACTIVE
              </div>
            </motion.div>

            {/* Info cards */}
            <div className="space-y-4">
              <motion.div
                whileHover={{ x: 4 }}
                className="bg-[#0a1a14] p-4 rounded-xl border-l-4 border-yellow-500"
              >
                <h4 className="text-yellow-400 font-bold mb-2 text-lg">Секрет успеха: Броня</h4>
                <p className="text-sm text-emerald-100/70 leading-relaxed">
                  У них есть наружный скелет из <strong className="text-yellow-300">хитина</strong>. Это броня от врагов и защита от высыхания.
                  <br />Минус: Он не растет. Приходится <strong className="text-yellow-300">линять</strong> (сбрасывать старую броню и быстро расти, пока новая мягкая).
                </p>
              </motion.div>

              <div className="grid grid-cols-2 gap-3">
                <motion.div
                  whileHover={{ scale: 1.05 }}
                  className="bg-[#0a1a14] p-3 rounded-lg text-center border border-emerald-800/40"
                >
                  <div className="text-2xl font-bold text-white mb-1">3</div>
                  <div className="text-xs text-emerald-200/50 uppercase">Отдела тела у насекомых</div>
                </motion.div>
                <motion.div
                  whileHover={{ scale: 1.05 }}
                  className="bg-[#0a1a14] p-3 rounded-lg text-center border border-emerald-800/40"
                >
                  <div className="text-2xl font-bold text-white mb-1">∞</div>
                  <div className="text-xs text-emerald-200/50 uppercase">Разнообразие</div>
                </motion.div>
              </div>
            </div>
          </div>

          {/* Comparative Table */}
          <div className="grid md:grid-cols-3 gap-0 border border-emerald-800/40 rounded-xl overflow-hidden divide-y md:divide-y-0 md:divide-x divide-emerald-800/40 bg-[#0a1a14]">
            {/* Crustaceans */}
            <motion.div
              whileHover={{ backgroundColor: 'rgba(16, 185, 129, 0.05)' }}
              className="p-6 transition-colors"
            >
              <motion.div
                whileHover={{ scale: 1.1 }}
                className="text-4xl mb-3 w-fit cursor-default"
              >
                🦞
              </motion.div>
              <h4 className="font-bold text-xl text-white mb-3">Ракообразные</h4>
              <div className="space-y-2 text-sm text-emerald-100/70">
                <p><span className="text-emerald-300/40">База:</span> Вода</p>
                <p><span className="text-emerald-300/40">Усики:</span> <span className="text-yellow-200 font-bold">2 пары</span></p>
                <p><span className="text-emerald-300/40">Ноги:</span> 5 пар (клешни!)</p>
                <p><span className="text-emerald-300/40">Дыхание:</span> Жабры</p>
              </div>
            </motion.div>

            {/* Arachnids */}
            <motion.div
              whileHover={{ backgroundColor: 'rgba(16, 185, 129, 0.05)' }}
              className="p-6 transition-colors"
            >
              <motion.div
                whileHover={{ scale: 1.1 }}
                className="text-4xl mb-3 w-fit cursor-default"
              >
                🕷️
              </motion.div>
              <h4 className="font-bold text-xl text-white mb-3">Паукообразные</h4>
              <div className="space-y-2 text-sm text-emerald-100/70">
                <p><span className="text-emerald-300/40">База:</span> Суша</p>
                <p><span className="text-emerald-300/40">Усики:</span> <span className="text-red-400 font-bold">НЕТ</span></p>
                <p><span className="text-emerald-300/40">Ноги:</span> 4 пары (8 шт)</p>
                <p><span className="text-emerald-300/40">Фишка:</span> Паутина и внекишечное пищеварение</p>
              </div>
            </motion.div>

            {/* Insects */}
            <motion.div
              whileHover={{ backgroundColor: 'rgba(16, 185, 129, 0.05)' }}
              className="p-6 transition-colors relative overflow-hidden"
            >
              <div className="absolute top-0 right-0 p-10 bg-yellow-500/5 rounded-full blur-2xl" />
              <motion.div
                whileHover={{ scale: 1.1 }}
                className="text-4xl mb-3 w-fit cursor-default"
              >
                🐞
              </motion.div>
              <h4 className="font-bold text-xl text-white mb-3">Насекомые</h4>
              <div className="space-y-2 text-sm text-emerald-100/70">
                <p><span className="text-emerald-300/40">База:</span> Везде</p>
                <p><span className="text-emerald-300/40">Усики:</span> 1 пара</p>
                <p><span className="text-emerald-300/40">Ноги:</span> 3 пары (6 шт)</p>
                <p><span className="text-emerald-300/40">Ультимейт:</span> <span className="text-green-400 font-bold">КРЫЛЬЯ</span> ✈️</p>
              </div>
            </motion.div>
          </div>
        </motion.section>

        {/* ===== SECTION 5: CHORDATES (VERTEBRATES) ===== */}
        <motion.section
          variants={sectionVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-50px' }}
          className="mb-20"
        >
          <SectionHeader
            icon={<Fish className="w-6 h-6" />}
            title="05 — Хордовые (Высшая Лига)"
            subtitle="Позвоночные животные: от рыб до млекопитающих"
          />

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            {/* Fish */}
            <motion.div
              whileHover={{ y: -6, scale: 1.03 }}
              className="bg-[#0a1a14] rounded-xl border border-blue-500/30 p-4 text-center"
            >
              <div className="text-3xl mb-2">🐟</div>
              <h4 className="font-bold text-blue-400 mb-2 text-sm">Рыбы</h4>
              <ul className="text-xs text-emerald-100/60 space-y-1 text-left">
                <li>• Жабры, Плавники</li>
                <li>• 2 камеры сердца</li>
                <li>• 1 круг кровообращения</li>
                <li>• Боковая линия</li>
              </ul>
            </motion.div>

            {/* Amphibians */}
            <motion.div
              whileHover={{ y: -6, scale: 1.03 }}
              className="bg-[#0a1a14] rounded-xl border border-green-500/30 p-4 text-center"
            >
              <div className="text-3xl mb-2">🐸</div>
              <h4 className="font-bold text-green-400 mb-2 text-sm">Земноводные</h4>
              <ul className="text-xs text-emerald-100/60 space-y-1 text-left">
                <li>• Голая слизистая кожа</li>
                <li>• 3 камеры сердца</li>
                <li>• Развитие в воде</li>
                <li>• Лягушки, Жабы</li>
              </ul>
            </motion.div>

            {/* Reptiles */}
            <motion.div
              whileHover={{ y: -6, scale: 1.03 }}
              className="bg-[#0a1a14] rounded-xl border border-yellow-500/30 p-4 text-center"
            >
              <div className="text-3xl mb-2">🦎</div>
              <h4 className="font-bold text-yellow-400 mb-2 text-sm">Пресмыкающиеся</h4>
              <ul className="text-xs text-emerald-100/60 space-y-1 text-left">
                <li>• Сухая кожа, чешуя</li>
                <li>• 3 камеры сердца</li>
                <li>• Яйца в скорлупе</li>
                <li>• Змеи, Ящерицы</li>
              </ul>
            </motion.div>

            {/* Birds */}
            <motion.div
              whileHover={{ y: -6, scale: 1.03 }}
              className="bg-[#0a1a14] rounded-xl border border-sky-500/30 p-4 text-center"
            >
              <div className="text-3xl mb-2">🦅</div>
              <h4 className="font-bold text-sky-400 mb-2 text-sm">Птицы</h4>
              <ul className="text-xs text-emerald-100/60 space-y-1 text-left">
                <li>• Перья, Крылья</li>
                <li>• 4 камеры сердца</li>
                <li>• Двойное дыхание</li>
                <li>• Кости полые</li>
              </ul>
            </motion.div>

            {/* Mammals */}
            <motion.div
              whileHover={{ y: -6, scale: 1.03 }}
              className="bg-[#0a1a14] rounded-xl border border-pink-500/30 p-4 text-center col-span-2 sm:col-span-1"
            >
              <div className="text-3xl mb-2">🦍</div>
              <h4 className="font-bold text-pink-400 mb-2 text-sm">Млекопитающие</h4>
              <ul className="text-xs text-emerald-100/60 space-y-1 text-left">
                <li>• Шерсть, Молоко</li>
                <li>• 4 камеры сердца</li>
                <li>• Альвеолярные лёгкие</li>
                <li>• Развитый мозг</li>
              </ul>
            </motion.div>
          </div>
        </motion.section>

        {/* ===== SECTION 6: HEART COMPARISON (Interactive SVG) ===== */}
        <motion.section
          variants={sectionVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-50px' }}
          className="mb-20"
        >
          <SectionHeader
            icon={<Activity className="w-6 h-6" />}
            title="06 — Сравнение сердец позвоночных"
            subtitle="От 2 камер у рыб до 4 у птиц и млекопитающих"
          />

          {/* Tabs */}
          <div className="flex gap-2 mb-4 flex-wrap">
            {(Object.keys(heartData) as VertebrateType[]).map((key) => (
              <button
                key={key}
                onClick={() => setActiveVertebrate(key)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  activeVertebrate === key
                    ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/25'
                    : 'bg-[#0a1a14] border border-emerald-800/40 text-emerald-300/70 hover:text-emerald-200 hover:border-emerald-700/50'
                }`}
              >
                {heartData[key].label.split('—')[0].trim()}
              </button>
            ))}
          </div>

          <AnimatePresence mode="wait">
            <motion.div
              key={activeVertebrate}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.3 }}
              className="bg-[#0a1a14] rounded-xl border border-emerald-800/40 p-4 sm:p-6"
            >
              <HeartSVG type={activeVertebrate} />

              <div className="mt-4">
                <h4 className="font-bold text-base mb-2" style={{ color: heartData[activeVertebrate].color }}>
                  {heartData[activeVertebrate].label}
                </h4>
                <p className="text-sm text-emerald-100/70 leading-relaxed mb-3">
                  {heartData[activeVertebrate].description}
                </p>
                <div className="flex flex-wrap gap-2">
                  {heartData[activeVertebrate].features.map((feature, i) => (
                    <motion.span
                      key={feature}
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: i * 0.1 }}
                      className="px-2 py-1 bg-emerald-950/50 border border-emerald-800/30 rounded text-xs text-emerald-300"
                    >
                      {feature}
                    </motion.span>
                  ))}
                </div>
              </div>
            </motion.div>
          </AnimatePresence>
        </motion.section>

        {/* ===== SECTION 7: VPR SURVIVAL SKILLS ===== */}
        <motion.section
          variants={sectionVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-50px' }}
          className="mb-20"
        >
          <SectionHeader
            icon={<Eye className="w-6 h-6" />}
            title="07 — Секреты ВПР: Работа с фото"
            subtitle="Практические задания: собаки, лошади и таблицы"
          />

          <div className="grid md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <motion.div
                whileHover={{ x: 4, scale: 1.01 }}
                className="bg-[#0a1a14] p-4 rounded-xl border border-emerald-800/40 flex items-start gap-3"
              >
                <Dog className="w-8 h-8 text-emerald-300/60 shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-bold text-white">Собаки (Задание 4)</h4>
                  <p className="text-sm text-emerald-100/70 mt-1 leading-relaxed">
                    1. <strong className="text-emerald-300">Уши:</strong> Стоячие (как у овчарки), Висячие (как у спаниеля), Полустоячие (кончики висят).<br />
                    2. <strong className="text-emerald-300">Хвост:</strong> Кольцом (лайка), Поленом (толстый), Прутом (тонкий), Купирован (обрубок).
                  </p>
                </div>
              </motion.div>

              <motion.div
                whileHover={{ x: 4, scale: 1.01 }}
                className="bg-[#0a1a14] p-4 rounded-xl border border-emerald-800/40 flex items-start gap-3"
              >
                <Bird className="w-8 h-8 text-emerald-300/60 shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-bold text-white">Лошадь (Задание 4)</h4>
                  <p className="text-sm text-emerald-100/70 mt-1 leading-relaxed">
                    1. <strong className="text-emerald-300">Масть:</strong> Гнедая (коричневая + черная грива), Рыжая (вся рыжая), Вороная (черная), Серая (белая), Пегая (пятнами).<br />
                    2. <strong className="text-emerald-300">Голова:</strong> Прямая или Горбоносая (выпуклая).
                  </p>
                </div>
              </motion.div>
            </div>

            <motion.div
              whileHover={{ scale: 1.01 }}
              className="bg-[#040f0a] p-5 rounded-xl border border-white/10"
            >
              <h4 className="font-bold text-white mb-2 flex items-center gap-2">
                <Activity className="w-4 h-4 text-red-400" /> Анализ Таблиц (Задание 8)
              </h4>
              <p className="text-sm text-emerald-200/40 italic mb-4">
                &quot;У кого пульс 100?&quot; или &quot;У кого сердце бьётся чаще?&quot;
              </p>
              <div className="space-y-3 text-sm text-emerald-100/70">
                <div className="bg-[#0a1a14] p-3 rounded-lg border border-emerald-800/20">
                  <p>
                    🔹 Чем <strong className="text-emerald-300">меньше</strong> животное, тем <strong className="text-emerald-300">чаще</strong> пульс.
                  </p>
                  <div className="mt-2 space-y-1">
                    {/* Animated progress bars for heart rate comparison */}
                    {[
                      { name: 'Хомяк', bpm: 400, max: 500 },
                      { name: 'Кошка', bpm: 130, max: 500 },
                      { name: 'Человек', bpm: 70, max: 500 },
                      { name: 'Слон', bpm: 30, max: 500 },
                    ].map((animal, i) => (
                      <div key={animal.name} className="flex items-center gap-2">
                        <span className="text-xs text-emerald-300/60 w-16 shrink-0">{animal.name}</span>
                        <div className="flex-1 bg-black/30 rounded-full h-3 relative overflow-hidden">
                          <motion.div
                            initial={{ width: 0 }}
                            whileInView={{ width: `${(animal.bpm / animal.max) * 100}%` }}
                            viewport={{ once: true }}
                            transition={{ duration: 0.8, delay: i * 0.15, ease: 'easeOut' }}
                            className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-400"
                          />
                        </div>
                        <span className="text-xs text-emerald-300/80 w-12 text-right font-mono">{animal.bpm}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <p>🔹 Внимательно смотри на диапазоны: если 70-120, то 100 входит!</p>
              </div>
            </motion.div>
          </div>
        </motion.section>

        {/* ===== BACK TO TESTS ===== */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="text-center pb-12"
        >
          <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.98 }}>
            <Link
              href="/vpr-tests"
              className="inline-flex items-center justify-center gap-2 px-8 py-4 font-bold text-white bg-emerald-600 hover:bg-emerald-500 transition-colors font-mono rounded-full shadow-lg shadow-emerald-900/50"
            >
              <span>ВЕРНУТЬСЯ К ТЕСТАМ</span>
              <Dna className="w-5 h-5" />
            </Link>
          </motion.div>
        </motion.section>

      </main>
    </div>
  );
}

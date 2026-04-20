"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { cn } from "@/lib/utils";
import {
  Globe, Lock, Server, FileText, RotateCcw, CheckCircle2, AlertTriangle,
  Terminal, Wifi, Search, Circle, MoveDown, Rocket, Zap, ShieldCheck,
  Network, Cpu, HardDrive, Database, Key, Binary, GitBranch,
  Monitor, MousePointerClick, ChevronDown, ChevronUp, Eye,
  Code2, Shield, Activity, Layers, ArrowRight
} from "lucide-react";

// ─── Matrix Digital Rain Background ─────────────────────────────────────
function MatrixRainBg() {
  const columns = useMemo(() => {
    const cols = [];
    const chars = "アイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘホマミムメモヤユヨラリルレロワヲン0123456789ABCDEF";
    for (let i = 0; i < 60; i++) {
      const len = 8 + Math.floor(Math.random() * 18);
      const str = Array.from({ length: len }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
      cols.push({
        left: `${(i / 60) * 100}%`,
        duration: 6 + Math.random() * 14,
        delay: Math.random() * -20,
        fontSize: 10 + Math.random() * 6,
        opacity: 0.04 + Math.random() * 0.08,
        str,
      });
    }
    return cols;
  }, []);

  return (
    <div className="fixed inset-0 overflow-hidden pointer-events-none z-0" aria-hidden="true">
      <style>{`
        @keyframes mfall {
          0% { transform: translateY(-100%); }
          100% { transform: translateY(100vh); }
        }
        .mcol { animation: mfall var(--dur) linear infinite; animation-delay: var(--del); }
      `}</style>
      {columns.map((c, i) => (
        <div
          key={i}
          className="mcol absolute top-0 font-mono text-[#00ff41] whitespace-pre leading-tight select-none"
          style={{
            left: c.left,
            fontSize: c.fontSize,
            opacity: c.opacity,
            "--dur": `${c.duration}s`,
            "--del": `${c.delay}s`,
          } as React.CSSProperties}
        >
          {c.str.split("").join("\n")}
        </div>
      ))}
    </div>
  );
}

// ─── HUD Corner Decorations ─────────────────────────────────────────────
function HUDPanel({ children, className = "", glow = false }: { children: React.ReactNode; className?: string; glow?: boolean }) {
  return (
    <div className={cn("relative rounded-xl border border-green-800/40 bg-[#030f03] overflow-hidden", glow && "shadow-[0_0_40px_rgba(0,255,65,0.12)]", className)}>
      <div className="absolute -top-px -left-px w-4 h-4 border-t-2 border-l-2 border-green-500/70" />
      <div className="absolute -top-px -right-px w-4 h-4 border-t-2 border-r-2 border-green-500/70" />
      <div className="absolute -bottom-px -left-px w-4 h-4 border-b-2 border-l-2 border-green-500/70" />
      <div className="absolute -bottom-px -right-px w-4 h-4 border-b-2 border-r-2 border-green-500/70" />
      <div className="absolute top-0 left-4 right-4 h-px bg-gradient-to-r from-transparent via-green-500/30 to-transparent" />
      {children}
    </div>
  );
}

// ─── InfoCard ────────────────────────────────────────────────────────────
function InfoCard({ title, children, icon: Icon, className = "" }: { title: string; children: React.ReactNode; icon: React.ElementType; className?: string }) {
  return (
    <motion.div
      whileHover={{ scale: 1.02, boxShadow: "0 0 30px rgba(0,255,65,0.15)" }}
      transition={{ type: "spring", stiffness: 400, damping: 20 }}
      className={cn("rounded-xl border border-green-800/40 bg-[#030f03] p-5 transition-all hover:border-green-500/50", className)}
    >
      <div className="flex items-center gap-3 mb-3">
        <div className="p-2 rounded-lg bg-green-900/30 border border-green-700/30">
          <Icon className="w-5 h-5 text-green-400" />
        </div>
        <h3 className="text-green-200 font-mono font-bold text-sm">{title}</h3>
      </div>
      {children}
    </motion.div>
  );
}

// ─── Section Header ──────────────────────────────────────────────────────
function SectionHeader({ icon: Icon, title, subtitle }: { icon: React.ElementType; title: string; subtitle: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, x: -30 }}
      whileInView={{ opacity: 1, x: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.5 }}
      className="flex items-center gap-3 mb-8"
    >
      <div className="p-3 bg-green-900/30 rounded-xl border border-green-700/40">
        <Icon className="text-green-400 w-7 h-7" />
      </div>
      <div>
        <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-white font-mono">{title}</h2>
        <p className="text-green-500/60 text-sm font-mono">&gt; system.scan() — {subtitle}</p>
      </div>
    </motion.div>
  );
}

// ═══════════════════════════════════════════════════════════════════════
//  SVG 1: MatrixRainSVG (Header animation)
// ═══════════════════════════════════════════════════════════════════════
function MatrixRainSVG() {
  const chars = "アイウエオカキクケコ0123456789ABCDEF";
  const cols = 14;
  const rows = 12;
  const cellW = 18;
  const cellH = 16;
  const w = cols * cellW;
  const h = rows * cellH;

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="mg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#00ff41" stopOpacity="0" />
          <stop offset="40%" stopColor="#00ff41" stopOpacity="0.9" />
          <stop offset="100%" stopColor="#00ff41" stopOpacity="0.1" />
        </linearGradient>
        <filter id="glow1">
          <feGaussianBlur stdDeviation="1.5" result="blur" />
          <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
      </defs>
      <rect width={w} height={h} fill="#020c02" rx="8" />
      {Array.from({ length: cols }).map((_, ci) => {
        const chars2 = Array.from({ length: rows }, () => chars[Math.floor(Math.random() * chars.length)]);
        const dur = 2 + Math.random() * 3;
        const delay = Math.random() * -5;
        const len = 4 + Math.floor(Math.random() * 5);
        return (
          <g key={ci} filter="url(#glow1)">
            <text
              fontFamily="monospace"
              fontSize="11"
              fill="url(#mg)"
              textAnchor="middle"
              x={ci * cellW + cellW / 2}
            >
              {chars2.slice(0, len).join("")}
              <animate attributeName="y" from={`-${h}`} to={`${h}`} dur={`${dur}s`} begin={`${delay}s`} repeatCount="indefinite" />
            </text>
          </g>
        );
      })}
      {/* Flickering overlay */}
      <rect width={w} height={h} fill="none" stroke="#00ff41" strokeWidth="0.5" strokeOpacity="0.3" rx="8">
        <animate attributeName="stroke-opacity" values="0.1;0.4;0.1" dur="2s" repeatCount="indefinite" />
      </rect>
    </svg>
  );
}

// ═══════════════════════════════════════════════════════════════════════
//  SVG 2: BinaryConverterSVG
// ═══════════════════════════════════════════════════════════════════════
function BinaryConverterSVG({ activeBits, onBitToggle }: { activeBits: number[]; onBitToggle: (i: number) => void }) {
  const decimal = activeBits.reduce((sum, bit, i) => sum + bit * Math.pow(2, 7 - i), 0);
  const weights = [128, 64, 32, 16, 8, 4, 2, 1];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap justify-center gap-2">
        {activeBits.map((bit, i) => (
          <motion.button
            key={i}
            whileHover={{ scale: 1.15 }}
            whileTap={{ scale: 0.9 }}
            onClick={() => onBitToggle(i)}
            className={cn(
              "w-11 h-11 rounded-lg font-mono font-bold text-lg border-2 transition-all cursor-pointer select-none",
              bit
                ? "bg-green-500/20 border-green-400 text-[#00ff41] shadow-[0_0_12px_rgba(0,255,65,0.4)]"
                : "bg-black/40 border-green-900/40 text-green-800"
            )}
          >
            {bit}
          </motion.button>
        ))}
      </div>
      <div className="flex flex-wrap justify-center gap-1 text-[10px] text-green-600 font-mono">
        {weights.map((w, i) => (
          <span key={i} className="w-11 text-center">{w}</span>
        ))}
      </div>
      <motion.div
        key={decimal}
        initial={{ scale: 1.2, color: "#00ff41" }}
        animate={{ scale: 1, color: "#e2e8f0" }}
        className="text-center font-mono text-2xl font-bold"
      >
        = {decimal}
      </motion.div>
      <div className="text-center font-mono text-xs text-green-600/80">
        {activeBits.map((b, i) => b ? `${b}×${weights[i]}` : null).filter(Boolean).join(" + ")} = {decimal}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════
//  SVG 3: LogicGatesSVG
// ═══════════════════════════════════════════════════════════════════════
function LogicGatesSVG() {
  const gates = [
    { name: "AND", symbol: "&", fn: (a: boolean, b: boolean) => a && b },
    { name: "OR", symbol: "|", fn: (a: boolean, b: boolean) => a || b },
    { name: "NOT", symbol: "!", fn: (_a: boolean, _b: boolean) => !_a },
    { name: "XOR", symbol: "^", fn: (a: boolean, b: boolean) => a !== b },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {gates.map((gate) => (
        <LogicGateCard key={gate.name} gate={gate} />
      ))}
    </div>
  );
}

function LogicGateCard({ gate }: { gate: { name: string; symbol: string; fn: (a: boolean, b: boolean) => boolean } }) {
  const [inputA, setInputA] = useState(false);
  const [inputB, setInputB] = useState(false);
  const output = gate.fn(inputA, inputB);

  const combos = gate.name === "NOT"
    ? [[true, false], [false, true]]
    : [[false, false], [false, true], [true, false], [true, true]];

  return (
    <motion.div
      whileHover={{ boxShadow: "0 0 25px rgba(0,255,65,0.15)" }}
      className="bg-[#020c02] border border-green-800/40 rounded-xl p-4 text-center"
    >
      <div className="font-mono font-bold text-green-300 text-lg mb-3">{gate.symbol} {gate.name}</div>
      <div className="flex justify-center gap-3 mb-3">
        {gate.name !== "NOT" ? (
          <>
            <button onClick={() => setInputA(!inputA)} className={cn("px-3 py-1 rounded font-mono text-sm border", inputA ? "bg-green-500/20 border-green-400 text-[#00ff41]" : "bg-black border-green-900/40 text-green-800")}>A:{inputA?1:0}</button>
            <button onClick={() => setInputB(!inputB)} className={cn("px-3 py-1 rounded font-mono text-sm border", inputB ? "bg-green-500/20 border-green-400 text-[#00ff41]" : "bg-black border-green-900/40 text-green-800")}>B:{inputB?1:0}</button>
          </>
        ) : (
          <button onClick={() => setInputA(!inputA)} className={cn("px-3 py-1 rounded font-mono text-sm border", inputA ? "bg-green-500/20 border-green-400 text-[#00ff41]" : "bg-black border-green-900/40 text-green-800")}>A:{inputA?1:0}</button>
        )}
      </div>
      <motion.div
        key={String(output)}
        initial={{ scale: 1.3 }}
        animate={{ scale: 1 }}
        className={cn("font-mono text-2xl font-bold mb-2", output ? "text-[#00ff41] shadow-[0_0_15px_rgba(0,255,65,0.5)]" : "text-green-900")}
      >
        → {output ? 1 : 0}
      </motion.div>
      {/* Mini truth table */}
      <div className="mt-3 pt-3 border-t border-green-900/30">
        <div className="text-[10px] text-green-700 font-mono mb-1">Таблица истинности:</div>
        <div className="space-y-0.5 text-[10px] font-mono text-green-500/70">
          {gate.name === "NOT" ? (
            <>
              <div>A=0 → {gate.fn(false, false) ? 1 : 0}</div>
              <div>A=1 → {gate.fn(true, false) ? 1 : 0}</div>
            </>
          ) : (
            combos.map(([a, b], i) => (
              <div key={i}>{a?1:0} {gate.symbol} {b?1:0} = {gate.fn(a, b) ? 1 : 0}</div>
            ))
          )}
        </div>
      </div>
    </motion.div>
  );
}

// ═══════════════════════════════════════════════════════════════════════
//  SVG 4: FlowchartSVG
// ═══════════════════════════════════════════════════════════════════════
function FlowchartSVG() {
  const nodes = [
    { id: "start", label: "НАЧАЛО", x: 180, y: 30, type: "oval" },
    { id: "input", label: "Ввести N", x: 180, y: 90, type: "rect" },
    { id: "check", label: "N четное?", x: 180, y: 160, type: "diamond" },
    { id: "yes", label: "Вывод «Да»", x: 70, y: 250, type: "rect" },
    { id: "no", label: "Вывод «Нет»", x: 290, y: 250, type: "rect" },
    { id: "end", label: "КОНЕЦ", x: 180, y: 330, type: "oval" },
  ];
  const edges = [
    { from: "start", to: "input" },
    { from: "input", to: "check" },
    { from: "check", to: "yes", label: "Да" },
    { from: "check", to: "no", label: "Нет" },
    { from: "yes", to: "end" },
    { from: "no", to: "end" },
  ];

  return (
    <svg viewBox="0 0 360 380" className="w-full max-w-sm mx-auto" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <filter id="glowDot">
          <feGaussianBlur stdDeviation="3" result="blur" />
          <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
      </defs>
      {/* Edges */}
      {edges.map((e, i) => {
        const from = nodes.find(n => n.id === e.from)!;
        const to = nodes.find(n => n.id === e.to)!;
        const isBranch = e.label;
        return (
          <g key={i}>
            <line x1={from.x} y1={from.y + 15} x2={to.x} y2={to.y - 15} stroke="#00ff4130" strokeWidth="1.5" />
            {e.label && (
              <text x={(from.x + to.x) / 2 + (e.label === "Да" ? -20 : 10)} y={(from.y + to.y) / 2 - 5} fill="#22c55e" fontSize="11" fontFamily="monospace">{e.label}</text>
            )}
          </g>
        );
      })}
      {/* Nodes */}
      {nodes.map((n) => {
        const shape = n.type === "oval"
          ? <ellipse cx={n.x} cy={n.y} rx="55" ry="18" fill="#030f03" stroke="#00ff41" strokeWidth="1.5" />
          : n.type === "diamond"
            ? <polygon points={`${n.x},${n.y-25} ${n.x+55},${n.y} ${n.x},${n.y+25} ${n.x-55},${n.y}`} fill="#030f03" stroke="#22c55e" strokeWidth="1.5" />
            : <rect x={n.x - 50} y={n.y - 15} width="100" height="30" rx="4" fill="#030f03" stroke="#10b981" strokeWidth="1.5" />;
        return (
          <g key={n.id}>
            {shape}
            <text x={n.x} y={n.y + 4} textAnchor="middle" fill="#e2e8f0" fontSize="10" fontFamily="monospace">{n.label}</text>
          </g>
        );
      })}
      {/* Animated tracing dot */}
      <circle r="4" fill="#00ff41" filter="url(#glowDot)">
        <animateMotion dur="5s" repeatCount="indefinite" path="M180,30 L180,90 L180,160 L70,250 L180,330 L180,30" />
      </circle>
      <circle r="4" fill="#06b6d4" filter="url(#glowDot)" opacity="0.7">
        <animateMotion dur="5s" repeatCount="indefinite" path="M180,30 L180,90 L180,160 L290,250 L180,330 L180,30" begin="2.5s" />
      </circle>
    </svg>
  );
}

// ═══════════════════════════════════════════════════════════════════════
//  SVG 5: VonNeumannSVG
// ═══════════════════════════════════════════════════════════════════════
function VonNeumannSVG() {
  const [hovered, setHovered] = useState<string | null>(null);
  const parts = [
    { id: "cu", label: "УУ", full: "Устройство управления", x: 140, y: 20, w: 100, h: 45, desc: "Координирует работу всех устройств компьютера" },
    { id: "alu", label: "АЛУ", full: "Арифметико-логическое устройство", x: 140, y: 75, w: 100, h: 45, desc: "Выполняет арифметические и логические операции" },
    { id: "ram", label: "ОЗУ", full: "Оперативная память", x: 20, y: 150, w: 100, h: 45, desc: "Временное хранение данных во время работы программы" },
    { id: "input", label: "Ввод", full: "Устройства ввода", x: 20, y: 20, w: 100, h: 45, desc: "Клавиатура, мышь, сканер, микрофон" },
    { id: "output", label: "Вывод", full: "Устройства вывода", x: 260, y: 20, w: 100, h: 45, desc: "Монитор, принтер, колонки" },
    { id: "storage", label: "Память", full: "Долговременная память", x: 260, y: 150, w: 100, h: 45, desc: "Жёсткий диск, SSD, флешка — хранение данных после выключения" },
  ];

  return (
    <div className="relative">
      <svg viewBox="0 0 380 220" className="w-full max-w-lg mx-auto" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <filter id="vg">
            <feGaussianBlur stdDeviation="2" result="blur" />
            <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
        </defs>
        {/* CPU box */}
        <rect x="130" y="5" width="120" height="120" rx="6" fill="none" stroke="#00ff4140" strokeWidth="1" strokeDasharray="4,3" />
        <text x="190" y="130" textAnchor="middle" fill="#00ff4180" fontSize="9" fontFamily="monospace">ПРОЦЕССОР</text>
        {/* Buses */}
        <line x1="190" y1="125" x2="70" y2="150" stroke="#22c55e40" strokeWidth="1.5" />
        <line x1="190" y1="125" x2="310" y2="150" stroke="#22c55e40" strokeWidth="1.5" />
        <line x1="70" y1="65" x2="130" y2="50" stroke="#06b6d440" strokeWidth="1" />
        <line x1="310" y1="65" x2="250" y2="50" stroke="#06b6d440" strokeWidth="1" />
        {/* Components */}
        {parts.map((p) => (
          <g
            key={p.id}
            onMouseEnter={() => setHovered(p.id)}
            onMouseLeave={() => setHovered(null)}
            className="cursor-pointer"
            filter={hovered === p.id ? "url(#vg)" : undefined}
          >
            <rect x={p.x} y={p.y} width={p.w} height={p.h} rx="6"
              fill={hovered === p.id ? "#00ff4110" : "#030f03"}
              stroke={hovered === p.id ? "#00ff41" : "#10b98160"} strokeWidth={hovered === p.id ? 2 : 1}
            />
            <text x={p.x + p.w / 2} y={p.y + 22} textAnchor="middle" fill={hovered === p.id ? "#00ff41" : "#e2e8f0"} fontSize="13" fontFamily="monospace" fontWeight="bold">{p.label}</text>
            <text x={p.x + p.w / 2} y={p.y + 37} textAnchor="middle" fill="#22c55e80" fontSize="8" fontFamily="monospace">{p.full}</text>
          </g>
        ))}
        {/* Bus labels */}
        <text x="115" y="143" fill="#06b6d4" fontSize="8" fontFamily="monospace" opacity="0.7">Шина данных</text>
        <text x="240" y="143" fill="#06b6d4" fontSize="8" fontFamily="monospace" opacity="0.7">Шина адреса</text>
      </svg>
      <AnimatePresence>
        {hovered && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="absolute bottom-0 left-1/2 -translate-x-1/2 bg-[#030f03] border border-green-500/40 rounded-lg px-4 py-2 text-center text-xs text-green-300 font-mono whitespace-nowrap"
          >
            {parts.find(p => p.id === hovered)?.desc}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════
//  SVG 6: NetworkTopologySVG
// ═══════════════════════════════════════════════════════════════════════
function NetworkTopologySVG() {
  const [active, setActive] = useState<"star" | "bus" | "ring">("star");

  const topologies = {
    star: {
      label: "Звезда",
      desc: "Все устройства подключены к центральному узлу (коммутатору/маршрутизатору)",
      render: (hw: number, hh: number) => {
        const cx = hw / 2, cy = hh / 2;
        const pts = 6;
        const nodes = Array.from({ length: pts }, (_, i) => {
          const angle = (i / pts) * Math.PI * 2 - Math.PI / 2;
          return { x: cx + Math.cos(angle) * 80, y: cy + Math.sin(angle) * 80 };
        });
        return (
          <g>
            {nodes.map((n, i) => (
              <React.Fragment key={i}>
                <line x1={cx} y1={cy} x2={n.x} y2={n.y} stroke="#00ff4130" strokeWidth="1.5" />
                <circle cx={n.x} cy={n.y} r="14" fill="#030f03" stroke="#22c55e" strokeWidth="1.5" />
                <text x={n.x} y={n.y + 4} textAnchor="middle" fill="#e2e8f0" fontSize="9" fontFamily="monospace">PC{i + 1}</text>
              </React.Fragment>
            ))}
            <circle cx={cx} cy={cy} r="20" fill="#00ff4115" stroke="#00ff41" strokeWidth="2" />
            <text x={cx} y={cy + 4} textAnchor="middle" fill="#00ff41" fontSize="9" fontFamily="monospace" fontWeight="bold">Hub</text>
          </g>
        );
      }
    },
    bus: {
      label: "Шина",
      desc: "Все устройства подключены к общему каналу передачи данных",
      render: (hw: number, hh: number) => {
        const cy = hh / 2;
        const nodes = 6;
        const spacing = (hw - 80) / (nodes - 1);
        return (
          <g>
            <line x1="30" y1={cy} x2={hw - 30} y2={cy} stroke="#22c55e" strokeWidth="2.5" />
            <line x1="30" y1={cy - 8} x2="30" y2={cy + 8} stroke="#22c55e" strokeWidth="2" />
            <line x1={hw - 30} y1={cy - 8} x2={hw - 30} y2={cy + 8} stroke="#22c55e" strokeWidth="2" />
            {Array.from({ length: nodes }, (_, i) => {
              const x = 40 + spacing * i;
              return (
                <g key={i}>
                  <line x1={x} y1={cy} x2={x} y2={cy - 40} stroke="#00ff4130" strokeWidth="1" />
                  <circle cx={x} cy={cy - 50} r="14" fill="#030f03" stroke="#22c55e" strokeWidth="1.5" />
                  <text x={x} y={cy - 46} textAnchor="middle" fill="#e2e8f0" fontSize="9" fontFamily="monospace">PC{i + 1}</text>
                </g>
              );
            })}
          </g>
        );
      }
    },
    ring: {
      label: "Кольцо",
      desc: "Устройства соединены в замкнутое кольцо, данные передаются по кругу",
      render: (hw: number, hh: number) => {
        const cx = hw / 2, cy = hh / 2, r = 70;
        const pts = 6;
        const nodes = Array.from({ length: pts }, (_, i) => {
          const angle = (i / pts) * Math.PI * 2 - Math.PI / 2;
          return { x: cx + Math.cos(angle) * r, y: cy + Math.sin(angle) * r };
        });
        return (
          <g>
            <circle cx={cx} cy={cy} r={r} fill="none" stroke="#00ff4130" strokeWidth="1.5" />
            {nodes.map((n, i) => (
              <g key={i}>
                <circle cx={n.x} cy={n.y} r="14" fill="#030f03" stroke="#22c55e" strokeWidth="1.5" />
                <text x={n.x} y={n.y + 4} textAnchor="middle" fill="#e2e8f0" fontSize="9" fontFamily="monospace">PC{i + 1}</text>
              </g>
            ))}
          </g>
        );
      }
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-center gap-2">
        {(["star", "bus", "ring"] as const).map((t) => (
          <motion.button
            key={t}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setActive(t)}
            className={cn(
              "px-4 py-1.5 rounded-lg font-mono text-sm border transition-all cursor-pointer",
              active === t ? "bg-green-500/20 border-green-400 text-[#00ff41]" : "bg-black/40 border-green-900/40 text-green-700"
            )}
          >
            {topologies[t].label}
          </motion.button>
        ))}
      </div>
      <AnimatePresence mode="wait">
        <motion.div
          key={active}
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.9 }}
          transition={{ duration: 0.3 }}
        >
          <svg viewBox="0 0 300 200" className="w-full max-w-sm mx-auto" xmlns="http://www.w3.org/2000/svg">
            {topologies[active].render(300, 200)}
          </svg>
        </motion.div>
      </AnimatePresence>
      <p className="text-center text-xs text-green-500/60 font-mono">{topologies[active].desc}</p>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════
//  SVG 7: CaesarCipherSVG
// ═══════════════════════════════════════════════════════════════════════
function CaesarCipherSVG() {
  const [shift, setShift] = useState(3);
  const [hoveredChar, setHoveredChar] = useState<string | null>(null);
  const alphabet = "АБВГДЕЁЖЗИЙКЛМНОПРСТУФХЦЧШЩЪЫЬЭЮЯ";
  const outerR = 100;
  const innerR = 70;
  const cx = 130, cy = 130;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-center gap-3">
        <span className="font-mono text-sm text-green-500">Сдвиг:</span>
        {[1, 3, 5, 7].map((s) => (
          <motion.button
            key={s}
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            onClick={() => setShift(s)}
            className={cn(
              "w-8 h-8 rounded font-mono text-sm border cursor-pointer",
              shift === s ? "bg-green-500/20 border-green-400 text-[#00ff41]" : "bg-black border-green-900/40 text-green-700"
            )}
          >
            {s}
          </motion.button>
        ))}
      </div>
      <svg viewBox="0 0 260 260" className="w-full max-w-[260px] mx-auto" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <filter id="cg">
            <feGaussianBlur stdDeviation="2" result="blur" />
            <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
        </defs>
        {[...alphabet].map((ch, i) => {
          const angle = (i / 33) * Math.PI * 2 - Math.PI / 2;
          const ox = cx + Math.cos(angle) * outerR;
          const oy = cy + Math.sin(angle) * outerR;
          const shiftedIdx = (i + shift) % 33;
          const innerAngle = (shiftedIdx / 33) * Math.PI * 2 - Math.PI / 2;
          const ix = cx + Math.cos(innerAngle) * innerR;
          const iy = cy + Math.sin(innerAngle) * innerR;
          const isHovered = hoveredChar === ch;
          return (
            <g key={i}>
              <line x1={ox} y1={oy} x2={ix} y2={iy} stroke={isHovered ? "#00ff41" : "#10b98120"} strokeWidth={isHovered ? 1 : 0.3} />
              <text
                x={ox} y={oy + 4}
                textAnchor="middle"
                fill={isHovered ? "#00ff41" : "#e2e8f080"}
                fontSize="8" fontFamily="monospace" fontWeight="bold"
                onMouseEnter={() => setHoveredChar(ch)}
                onMouseLeave={() => setHoveredChar(null)}
                className="cursor-pointer"
                filter={isHovered ? "url(#cg)" : undefined}
              >{ch}</text>
              <text
                x={ix} y={iy + 4}
                textAnchor="middle"
                fill={isHovered ? "#06b6d4" : "#e2e8f040"}
                fontSize="7" fontFamily="monospace"
              >{alphabet[shiftedIdx]}</text>
            </g>
          );
        })}
        {/* Rotation indicator */}
        <circle cx={cx} cy={cy} r={outerR + 8} fill="none" stroke="#00ff4110" strokeWidth="0.5" />
        <circle cx={cx} cy={cy} r={innerR - 8} fill="none" stroke="#06b6d410" strokeWidth="0.5" />
      </svg>
      {hoveredChar && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-center font-mono text-sm text-green-300"
        >
          {hoveredChar} → {alphabet[(alphabet.indexOf(hoveredChar) + shift) % 33]}
          <span className="text-green-700 ml-2">(сдвиг {shift})</span>
        </motion.div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════
//  GAME 1: URL Routing Game
// ═══════════════════════════════════════════════════════════════════════
const TASK_FRAGMENTS = [
  { id: "proto", label: "https://", order: 0 },
  { id: "sub", label: "www.", order: 1 },
  { id: "domain", label: "школа.рф", order: 2 },
  { id: "path1", label: "/учеба", order: 3 },
  { id: "path2", label: "/информатика", order: 4 },
  { id: "query", label: "?класс=7", order: 5 },
];

const CORRECT_SEQUENCE = ["proto", "sub", "domain", "path1", "path2", "query"];

function URLRoutingGame() {
  const [selected, setSelected] = useState<string[]>([]);
  const [status, setStatus] = useState<"playing" | "success" | "error">("playing");
  const [shuffled] = useState(() => [...TASK_FRAGMENTS].sort(() => Math.random() - 0.5));

  const handleClick = useCallback((id: string) => {
    if (status !== "playing") return;
    if (selected.includes(id)) {
      setSelected(prev => prev.filter(s => s !== id));
      setStatus("playing");
      return;
    }
    const newSeq = [...selected, id];
    setSelected(newSeq);
    const idx = newSeq.length - 1;
    if (newSeq[idx] !== CORRECT_SEQUENCE[idx]) {
      setStatus("error");
      setTimeout(() => {
        setSelected([]);
        setStatus("playing");
      }, 1200);
    } else if (newSeq.length === CORRECT_SEQUENCE.length) {
      setStatus("success");
    }
  }, [selected, status]);

  const remaining = shuffled.filter(f => !selected.includes(f.id));

  const reset = () => { setSelected([]); setStatus("playing"); };

  return (
    <HUDPanel glow={status === "success"} className="p-5 space-y-4">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-green-200 font-mono font-bold text-sm flex items-center gap-2">
          <Globe className="w-4 h-4" /> Собери URL-адрес
        </h3>
        <div className="flex items-center gap-2">
          <span className="font-mono text-xs text-green-600">{selected.length}/{CORRECT_SEQUENCE.length}</span>
          <button onClick={reset} className="p-1 rounded hover:bg-green-900/30 text-green-600 hover:text-green-400 transition-colors cursor-pointer">
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* URL display */}
      <div className={cn(
        "min-h-[44px] rounded-lg border-2 border-dashed p-3 font-mono text-sm break-all transition-all",
        status === "success" ? "border-[#00ff41] bg-green-500/10 text-[#00ff41] shadow-[0_0_20px_rgba(0,255,65,0.3)]" :
        status === "error" ? "border-red-500 bg-red-500/10 text-red-400" :
        "border-green-800/40 bg-[#020c02] text-green-300"
      )}>
        {selected.length === 0 ? (
          <span className="text-green-800">{'// нажми на фрагменты ниже...'}</span>
        ) : (
          selected.map(id => {
            const frag = TASK_FRAGMENTS.find(f => f.id === id)!;
            return <span key={id}>{frag.label}</span>;
          })
        )}
      </div>

      {/* Fragments */}
      <div className="flex flex-wrap gap-2">
        <AnimatePresence mode="popLayout">
          {remaining.map((frag) => (
            <motion.button
              key={frag.id}
              layout
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              whileHover={{ scale: 1.08, boxShadow: "0 0 15px rgba(0,255,65,0.3)" }}
              whileTap={{ scale: 0.92 }}
              onClick={() => handleClick(frag.id)}
              className="px-3 py-1.5 rounded-lg bg-green-900/20 border border-green-700/40 font-mono text-xs text-green-300 hover:border-green-400 hover:text-[#00ff41] transition-all cursor-pointer"
            >
              {frag.label}
            </motion.button>
          ))}
        </AnimatePresence>
      </div>

      <AnimatePresence>
        {status === "success" && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="flex items-center gap-2 text-green-400 font-mono text-sm"
          >
            <CheckCircle2 className="w-5 h-5" /> access_granted // URL верный!
          </motion.div>
        )}
        {status === "error" && (
          <motion.div
            initial={{ opacity: 0, x: [-5, 5, -5, 5, 0] }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex items-center gap-2 text-red-400 font-mono text-sm"
          >
            <AlertTriangle className="w-5 h-5" /> error // неверный порядок!
          </motion.div>
        )}
      </AnimatePresence>
    </HUDPanel>
  );
}

// ═══════════════════════════════════════════════════════════════════════
//  GAME 2: Euler Circles Sorting Game
// ═══════════════════════════════════════════════════════════════════════
const EULER_ITEMS = [
  { id: "apple", label: "🍎 Яблоко", cat: "fruit" },
  { id: "carrot", label: "🥕 Морковь", cat: "vegetable" },
  { id: "banana", label: "🍌 Банан", cat: "fruit" },
  { id: "tomato", label: "🍅 Томат", cat: "both" },
  { id: "cucumber", label: "🥒 Огурец", cat: "vegetable" },
  { id: "avocado", label: "🥑 Авокадо", cat: "both" },
];

const EULER_CORRECT_SEQUENCE = ["fruit", "vegetable", "both"];

function EulerCirclesGame() {
  const [sorted, setSorted] = useState<{ cat: string; items: string[] }[]>([]);
  const [status, setStatus] = useState<"playing" | "success" | "error">("playing");
  const remaining = EULER_ITEMS.filter(it => !sorted.some(s => s.items.includes(it.id)));

  const handlePlace = useCallback((item: typeof EULER_ITEMS[0], zone: string) => {
    if (status !== "playing") return;
    if (item.cat !== zone) {
      setStatus("error");
      setTimeout(() => setStatus("playing"), 800);
      return;
    }
    setSorted(prev => {
      const newSorted = prev.map(s => s.cat === zone ? { ...s, items: [...s.items, item.id] } : s);
      const existing = prev.find(s => s.cat === zone);
      if (!existing) newSorted.push({ cat: zone, items: [item.id] });
      return newSorted;
    });
    if (remaining.length <= 1) {
      setTimeout(() => setStatus("success"), 300);
    }
  }, [status, remaining.length]);

  const reset = () => { setSorted([]); setStatus("playing"); };

  const zoneLabels: Record<string, string> = { fruit: "Фрукты", vegetable: "Овощи", both: "Пересечение" };

  return (
    <HUDPanel glow={status === "success"} className="p-5 space-y-4">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-green-200 font-mono font-bold text-sm flex items-center gap-2">
          <Search className="w-4 h-4" /> Круги Эйлера
        </h3>
        <button onClick={reset} className="p-1 rounded hover:bg-green-900/30 text-green-600 hover:text-green-400 transition-colors cursor-pointer">
          <RotateCcw className="w-4 h-4" />
        </button>
      </div>

      {/* Zones */}
      <div className="grid grid-cols-3 gap-2">
        {EULER_CORRECT_SEQUENCE.map(zone => (
          <motion.div
            key={zone}
            whileHover={{ borderColor: "rgba(0,255,65,0.5)" }}
            className={cn(
              "min-h-[60px] rounded-lg border-2 border-dashed p-2 text-center transition-all",
              sorted.find(s => s.cat === zone) ? "border-green-500/50 bg-green-500/5" : "border-green-800/30"
            )}
          >
            <div className="text-[10px] font-mono text-green-600 mb-1">{zoneLabels[zone]}</div>
            <AnimatePresence>
              {sorted.find(s => s.cat === zone)?.items.map(id => {
                const item = EULER_ITEMS.find(i => i.id === id)!;
                return (
                  <motion.div
                    key={id}
                    initial={{ opacity: 0, scale: 0.5 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="text-xs font-mono text-green-300 mb-0.5"
                  >
                    {item.label}
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </motion.div>
        ))}
      </div>

      {/* Items */}
      <div className="flex flex-wrap gap-2 justify-center">
        <AnimatePresence mode="popLayout">
          {remaining.map(item => (
            <motion.div
              key={item.id}
              layout
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0, scale: 0.5 }}
              className="flex gap-1"
            >
              {EULER_CORRECT_SEQUENCE.map(zone => (
                <motion.button
                  key={zone}
                  whileHover={{ scale: 1.08 }}
                  whileTap={{ scale: 0.9 }}
                  onClick={() => handlePlace(item, zone)}
                  className="px-2 py-1 rounded bg-green-900/20 border border-green-700/30 font-mono text-[10px] text-green-500 hover:border-green-400 hover:text-[#00ff41] transition-all cursor-pointer"
                >
                  {zoneLabels[zone]}
                </motion.button>
              ))}
              <span className="px-2 py-1 text-xs font-mono text-green-300">{item.label}</span>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      <AnimatePresence>
        {status === "success" && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="text-green-400 font-mono text-sm flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5" /> classification_complete!
          </motion.div>
        )}
        {status === "error" && (
          <motion.div initial={{ opacity: 0, x: [-5, 5, -5, 5, 0] }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="text-red-400 font-mono text-sm flex items-center gap-2">
            <AlertTriangle className="w-5 h-5" /> mismatch_error!
          </motion.div>
        )}
      </AnimatePresence>
    </HUDPanel>
  );
}

// ═══════════════════════════════════════════════════════════════════════
//  Expandable Section
// ═══════════════════════════════════════════════════════════════════════
function Expandable({ title, children, defaultOpen = false }: { title: string; children: React.ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <motion.div
      layout
      className="border border-green-800/30 rounded-lg overflow-hidden bg-[#020c02]"
    >
      <motion.button
        layout="position"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between p-4 text-left hover:bg-green-900/10 transition-colors cursor-pointer"
      >
        <span className="font-mono text-sm text-green-300">{title}</span>
        <motion.div animate={{ rotate: open ? 180 : 0 }} transition={{ duration: 0.2 }}>
          <ChevronDown className="w-4 h-4 text-green-500" />
        </motion.div>
      </motion.button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 text-sm text-green-200/80 font-mono leading-relaxed">
              {children}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ─── ASCII Interactive Table ────────────────────────────────────────────
function AsciiTable() {
  const [selected, setSelected] = useState<string | null>("A");
  const chars = [
    { ch: "A", code: 65 }, { ch: "B", code: 66 }, { ch: "Z", code: 90 },
    { ch: "a", code: 97 }, { ch: "b", code: 98 }, { ch: "z", code: 122 },
    { ch: "0", code: 48 }, { ch: "9", code: 57 }, { ch: " ", code: 32 },
    { ch: "!", code: 33 }, { ch: "@", code: 64 }, { ch: "~", code: 126 },
  ];
  const toBin = (n: number) => n.toString(2).padStart(8, "0");

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-4 sm:grid-cols-6 gap-1.5">
        {chars.map(c => (
          <motion.button
            key={c.ch}
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            onClick={() => setSelected(c.ch)}
            className={cn(
              "p-2 rounded border font-mono text-sm transition-all cursor-pointer text-center",
              selected === c.ch ? "bg-green-500/20 border-green-400 text-[#00ff41] shadow-[0_0_10px_rgba(0,255,65,0.3)]" : "bg-black border-green-900/30 text-green-600"
            )}
          >
            <span className="text-lg">{c.ch === " " ? "␣" : c.ch}</span>
            <div className="text-[9px] mt-0.5">{c.code}</div>
          </motion.button>
        ))}
      </div>
      {selected && (
        <AnimatePresence mode="wait">
          <motion.div
            key={selected}
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="bg-[#020c02] rounded-lg border border-green-800/30 p-3 font-mono text-xs text-center"
          >
            <span className="text-green-400">'{selected === " " ? "PROBEL" : selected}'</span>
            <span className="text-green-700"> → код: </span>
            <span className="text-[#00ff41]">{chars.find(c => c.ch === selected)?.code}</span>
            <span className="text-green-700"> → бинарно: </span>
            <span className="text-cyan-400">{toBin(chars.find(c => c.ch === selected)?.code || 0)}</span>
          </motion.div>
        </AnimatePresence>
      )}
    </div>
  );
}

// ─── Main Component ────────────────────────────────────────────────────
export default function Informatics7Cheatsheet() {
  const [activeBits, setActiveBits] = useState([0, 0, 0, 0, 0, 0, 0, 0]);
  const [systemMsg, setSystemMsg] = useState("> system.boot() — Инициализация...");
  const [score, setScore] = useState(0);

  useEffect(() => {
    const msgs = [
      "> scan complete // все разделы загружены",
      "> access granted // уровень доступа: МАКСИМАЛЬНЫЙ",
      "> data decoded // 9 разделов активности",
      "> hack_the_exam.exe — готов к запуску",
    ];
    let idx = 0;
    const interval = setInterval(() => {
      idx++;
      if (idx < msgs.length) setSystemMsg(msgs[idx]);
      else clearInterval(interval);
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  const toggleBit = (i: number) => {
    setActiveBits(prev => {
      const next = [...prev];
      next[i] = next[i] ? 0 : 1;
      return next;
    });
    setScore(s => s + 1);
  };

  return (
    <div className="min-h-screen bg-[#020c02] text-white relative">
      <MatrixRainBg />
      <div className="relative z-10">
        <style>{`
          .glow-text { text-shadow: 0 0 10px rgba(0,255,65,0.5), 0 0 40px rgba(0,255,65,0.15); }
          .glow-text-sm { text-shadow: 0 0 6px rgba(0,255,65,0.3); }
          .hud-border { border: 1px solid rgba(0,255,65,0.15); }
          .hud-border::before, .hud-border::after { content:''; position:absolute; width:8px; height:8px; }
          ::-webkit-scrollbar { width: 6px; }
          ::-webkit-scrollbar-track { background: #020c02; }
          ::-webkit-scrollbar-thumb { background: #00ff4130; border-radius: 3px; }
          ::-webkit-scrollbar-thumb:hover { background: #00ff4150; }
        `}</style>

        <div className="max-w-6xl mx-auto px-4 py-8 sm:py-12">
          {/* ══════ HEADER ══════ */}
          <motion.header
            initial={{ opacity: 0, y: -30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7 }}
            className="mb-16"
          >
            <div className="flex flex-col md:flex-row items-center gap-8">
              <div className="w-64 h-48 md:w-80 md:h-56 flex-shrink-0">
                <MatrixRainSVG />
              </div>
              <div className="text-center md:text-left">
                <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-green-900/30 border border-green-500/40 text-green-300 text-xs mb-4 uppercase tracking-[0.2em] font-bold">
                  <Terminal className="w-3.5 h-3.5" /> Protocol_Initiated // v7.0
                </div>
                <h1 className="text-5xl md:text-7xl font-black tracking-tighter mb-3 font-mono">
                  <span className="text-transparent bg-clip-text bg-gradient-to-r from-green-300 via-emerald-200 to-[#00ff41] glow-text">
                    NET
                  </span>{" "}
                  <span className="text-white">ARCHITECT</span>
                </h1>
                <p className="text-green-400/70 text-lg">
                  7 класс // Информатика, Алгоритмы, Логика, Архитектура
                </p>
                <div className="mt-3 font-mono text-xs text-green-600/80">
                  {systemMsg}
                </div>
                {/* Score */}
                <div className="mt-3 inline-flex items-center gap-2 px-3 py-1 rounded-lg bg-green-900/20 border border-green-800/30">
                  <Zap className="w-3.5 h-3.5 text-amber-400" />
                  <span className="font-mono text-xs text-amber-400">XP: {score}</span>
                </div>
              </div>
            </div>
          </motion.header>

          {/* ══════ SECTION 1: СИСТЕМЫ СЧИСЛЕНИЯ ══════ */}
          <motion.section
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true, margin: "-50px" }}
            className="mb-20"
          >
            <SectionHeader icon={Binary} title="СИСТЕМЫ СЧИСЛЕНИЯ" subtitle="number_systems.scan()" />
            <div className="grid md:grid-cols-2 gap-6">
              <HUDPanel className="p-6" glow>
                <h3 className="font-mono text-sm text-green-300 mb-4 glow-text-sm">{'>'} binary_converter.exe</h3>
                <BinaryConverterSVG activeBits={activeBits} onBitToggle={toggleBit} />
              </HUDPanel>
              <div className="space-y-4">
                {[
                  { base: "10", name: "Десятичная", digits: "0–9", example: "42₁₀ = 4×10 + 2×1", color: "green" },
                  { base: "2", name: "Двоичная", digits: "0–1", example: "42₁₀ = 101010₂", color: "emerald" },
                  { base: "8", name: "Восьмеричная", digits: "0–7", example: "42₁₀ = 52₈", color: "cyan" },
                  { base: "16", name: "Шестнадцатеричная", digits: "0–9, A–F", example: "42₁₀ = 2A₁₆", color: "amber" },
                ].map((s, i) => (
                  <motion.div
                    key={s.base}
                    initial={{ opacity: 0, x: 20 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: i * 0.1 }}
                    className="bg-[#030f03] rounded-xl border border-green-800/30 p-4 hover:border-green-500/40 transition-all"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-mono font-bold text-sm text-white">Основание {s.base}</span>
                      <span className={cn(
                        "font-mono text-[10px] px-2 py-0.5 rounded-full",
                        s.color === "green" && "bg-green-900/30 text-green-400",
                        s.color === "emerald" && "bg-emerald-900/30 text-emerald-400",
                        s.color === "cyan" && "bg-cyan-900/30 text-cyan-400",
                        s.color === "amber" && "bg-amber-900/30 text-amber-400",
                      )}>
                        {s.name}
                      </span>
                    </div>
                    <p className="font-mono text-xs text-green-600 mb-1">Цифры: {s.digits}</p>
                    <p className="font-mono text-sm text-green-300">{s.example}</p>
                  </motion.div>
                ))}
              </div>
            </div>
          </motion.section>

          {/* ══════ SECTION 2: ЛОГИЧЕСКИЕ ОПЕРАЦИИ ══════ */}
          <motion.section
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true, margin: "-50px" }}
            className="mb-20"
          >
            <SectionHeader icon={GitBranch} title="ЛОГИЧЕСКИЕ ОПЕРАЦИИ" subtitle="logic_gates.scan()" />
            <LogicGatesSVG />
            <div className="mt-6 grid sm:grid-cols-2 gap-4">
              <Expandable title="> Булева алгебра — основы">
                <p className="mb-2"><strong className="text-[#00ff41]">Логическое И (AND / &amp;)</strong> — истинно, когда оба операнда истинны.</p>
                <p className="mb-2"><strong className="text-[#00ff41]">Логическое ИЛИ (OR / |)</strong> — истинно, когда хотя бы один операнд истинен.</p>
                <p className="mb-2"><strong className="text-[#00ff41]">Логическое НЕ (NOT / !)</strong> — инвертирует значение.</p>
                <p><strong className="text-[#00ff41]">Исключающее ИЛИ (XOR / ^)</strong> — истинно, когда операнды различны.</p>
              </Expandable>
              <Expandable title="> Примеры применения">
                <p className="mb-2">Проверка пароля: <span className="text-cyan-400">if (login &amp;&amp; password)</span></p>
                <p className="mb-2">Поиск: <span className="text-cyan-400">if (hasKeyword || hasTag)</span></p>
                <p>Инверсия: <span className="text-cyan-400">if (!isBlocked)</span></p>
              </Expandable>
            </div>
          </motion.section>

          {/* ══════ SECTION 3: КОДИРОВАНИЕ ИНФОРМАЦИИ ══════ */}
          <motion.section
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true, margin: "-50px" }}
            className="mb-20"
          >
            <SectionHeader icon={Code2} title="КОДИРОВАНИЕ ИНФОРМАЦИИ" subtitle="encoding.scan()" />
            <div className="grid md:grid-cols-2 gap-6">
              <HUDPanel className="p-6">
                <h3 className="font-mono text-sm text-green-300 mb-4 glow-text-sm">{'>'} ascii_table.decoder()</h3>
                <AsciiTable />
              </HUDPanel>
              <div className="space-y-4">
                <h3 className="font-mono text-sm text-green-300 glow-text-sm">{'>'} data_units.measure()</h3>
                {[
                  { unit: "1 Бит", desc: "Минимальная единица: 0 или 1", bar: 2 },
                  { unit: "1 Байт", desc: "8 бит = 1 символ ASCII", bar: 8 },
                  { unit: "1 КБ", desc: "1024 байта ≈ страничка текста", bar: 25 },
                  { unit: "1 МБ", desc: "1024 КБ ≈ 1 фотография", bar: 40 },
                  { unit: "1 ГБ", desc: "1024 МБ ≈ 1 фильм", bar: 60 },
                  { unit: "1 ТБ", desc: "1024 ГБ ≈ 500 фильмов", bar: 80 },
                ].map((u, i) => (
                  <motion.div
                    key={u.unit}
                    initial={{ opacity: 0, x: 20 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: i * 0.05 }}
                    className="flex items-center gap-3"
                  >
                    <span className="font-mono text-xs text-green-300 w-14 text-right shrink-0">{u.unit}</span>
                    <div className="flex-1 h-4 bg-[#020c02] rounded-full overflow-hidden border border-green-900/30">
                      <motion.div
                        initial={{ width: 0 }}
                        whileInView={{ width: `${u.bar}%` }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.8, delay: i * 0.05 }}
                        className="h-full bg-gradient-to-r from-green-600 to-[#00ff41] rounded-full"
                      />
                    </div>
                    <span className="text-[10px] text-green-600 font-mono hidden sm:block w-48 shrink-0">{u.desc}</span>
                  </motion.div>
                ))}
                <Expandable title="> Unicode и кодировка">
                  <p className="mb-1">ASCII: 128 символов (0–127)</p>
                  <p className="mb-1">Unicode: 149 000+ символов, включая кириллицу</p>
                  <p className="mb-1">UTF-8: переменная длина 1–4 байта</p>
                  <p>Кириллица «А» в Unicode: U+0410 = 1040</p>
                </Expandable>
              </div>
            </div>
          </motion.section>

          {/* ══════ SECTION 4: АЛГОРИТМЫ ══════ */}
          <motion.section
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true, margin: "-50px" }}
            className="mb-20"
          >
            <SectionHeader icon={Activity} title="АЛГОРИТМЫ" subtitle="algorithms.scan()" />
            <div className="grid md:grid-cols-2 gap-6">
              <HUDPanel className="p-6" glow>
                <h3 className="font-mono text-sm text-green-300 mb-4 glow-text-sm">{'>'}flowchart.render() — Проверка чётности</h3>
                <FlowchartSVG />
              </HUDPanel>
              <div className="space-y-4">
                <h3 className="font-mono text-sm text-green-300 glow-text-sm mb-2">{'>'} algorithm_types.list()</h3>
                {[
                  { type: "Линейный", desc: "Команды выполняются последовательно", icon: ArrowRight },
                  { type: "Ветвление", desc: "Выбор пути в зависимости от условия", icon: GitBranch },
                  { type: "Цикл", desc: "Повторение блока команд", icon: RotateCcw },
                ].map((a, i) => (
                  <motion.div
                    key={a.type}
                    initial={{ opacity: 0, y: 15 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: i * 0.1 }}
                    className="flex items-start gap-3 bg-[#030f03] rounded-xl border border-green-800/30 p-4"
                  >
                    <a.icon className="w-5 h-5 text-green-400 mt-0.5 shrink-0" />
                    <div>
                      <p className="font-mono font-bold text-sm text-white">{a.type}</p>
                      <p className="font-mono text-xs text-green-600">{a.desc}</p>
                    </div>
                  </motion.div>
                ))}
                <Expandable title="> Свойства алгоритмов" defaultOpen>
                  <p className="mb-1">• <strong className="text-[#00ff41]">Дискретность</strong> — разделён на шаги</p>
                  <p className="mb-1">• <strong className="text-[#00ff41]">Детерминированность</strong> — каждый шаг определён однозначно</p>
                  <p className="mb-1">• <strong className="text-[#00ff41]">Конечность</strong> — завершается за конечное время</p>
                  <p className="mb-1">• <strong className="text-[#00ff41]">Массовость</strong> — подходит для набора входных данных</p>
                  <p>• <strong className="text-[#00ff41]">Результативность</strong> — приводит к результату</p>
                </Expandable>
                <Expandable title="> Пример псевдокода">
                  <pre className="bg-[#020c02] rounded-lg p-3 text-xs overflow-x-auto text-cyan-300 border border-green-900/20">{`Алг Чётность
  нач
    ввод N
    если N mod 2 = 0
      то вывод "Чётное"
    иначе вывод "Нечётное"
    всё
  кон`}</pre>
                </Expandable>
              </div>
            </div>
          </motion.section>

          {/* ══════ SECTION 5: АРХИТЕКТУРА КОМПЬЮТЕРА ══════ */}
          <motion.section
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true, margin: "-50px" }}
            className="mb-20"
          >
            <SectionHeader icon={Cpu} title="АРХИТЕКТУРА КОМПЬЮТЕРА" subtitle="architecture.scan()" />
            <div className="grid md:grid-cols-2 gap-6">
              <HUDPanel className="p-6" glow>
                <h3 className="font-mono text-sm text-green-300 mb-4 glow-text-sm">{'>'}von_neumann.arch()</h3>
                <VonNeumannSVG />
              </HUDPanel>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { name: "Процессор (CPU)", icon: Cpu, desc: "Мозг компьютера. Выполняет команды программы." },
                  { name: "ОЗУ (RAM)", icon: Server, desc: "Оперативная память. Быстро, но исчезает при выключении." },
                  { name: "ПЗУ (ROM)", icon: HardDrive, desc: "Постоянная память. Хранит BIOS для загрузки." },
                  { name: "HDD / SSD", icon: Database, desc: "Долговременное хранение данных. Жёсткий диск или твердотельный." },
                  { name: "Ввод", icon: MousePointerClick, desc: "Клавиатура, мышь, сканер, микрофон, веб-камера." },
                  { name: "Вывод", icon: Monitor, desc: "Монитор, принтер, колонки, наушники." },
                ].map((comp, i) => (
                  <InfoCard key={comp.name} icon={comp.icon} title={comp.name}>
                    <p className="text-xs text-green-500/70 font-mono">{comp.desc}</p>
                  </InfoCard>
                ))}
              </div>
              <div className="col-span-full">
                <HUDPanel className="p-5">
                  <h3 className="font-mono text-sm text-amber-400 mb-2 flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4" /> Принцип фон Неймана
                  </h3>
                  <p className="text-sm text-green-300/80 font-mono leading-relaxed">
                    Программа и данные хранятся в одной и той же памяти. Процессор последовательно читает и выполняет команды из памяти.
                    Данные обрабатываются в АЛУ, а управление координируется устройством управления (УУ).
                  </p>
                </HUDPanel>
              </div>
            </div>
          </motion.section>

          {/* ══════ SECTION 6: СЕТИ И ИНТЕРНЕТ ══════ */}
          <motion.section
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true, margin: "-50px" }}
            className="mb-20"
          >
            <SectionHeader icon={Wifi} title="СЕТИ И ИНТЕРНЕТ" subtitle="networks.scan()" />
            <div className="grid md:grid-cols-2 gap-6">
              <HUDPanel className="p-6" glow>
                <h3 className="font-mono text-sm text-green-300 mb-4 glow-text-sm">{'>'}topology.visualizer()</h3>
                <NetworkTopologySVG />
              </HUDPanel>
              <div className="space-y-4">
                {[
                  { type: "LAN", name: "Локальная сеть", desc: "Ограниченная область (школа, офис). Скорость высокая, радиус до сотен метров." },
                  { type: "WAN", name: "Глобальная сеть", desc: "Охватывает большие территории. Интернет — крупнейшая WAN." },
                  { type: "PAN", name: "Персональная сеть", desc: "Расстояние до 10 метров. Bluetooth, ИК-порт." },
                ].map((net, i) => (
                  <motion.div
                    key={net.type}
                    initial={{ opacity: 0, x: 15 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: i * 0.1 }}
                    className="bg-[#030f03] rounded-xl border border-green-800/30 p-4"
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-mono font-bold text-[#00ff41] text-sm">{net.type}</span>
                      <span className="text-green-600 font-mono text-xs">— {net.name}</span>
                    </div>
                    <p className="font-mono text-xs text-green-500/70">{net.desc}</p>
                  </motion.div>
                ))}
                <Expandable title="> TCP/IP и DNS">
                  <p className="mb-1"><strong className="text-cyan-400">TCP/IP</strong> — протокол передачи данных. TCP гарантирует доставку, IP — адресацию.</p>
                  <p className="mb-1"><strong className="text-cyan-400">IP-адрес</strong> — уникальный адрес устройства в сети (например, 192.168.1.1)</p>
                  <p><strong className="text-cyan-400">DNS</strong> — Domain Name System, переводит доменные имена в IP-адреса (школа.рф → 93.184.216.34)</p>
                </Expandable>
                <URLRoutingGame />
              </div>
            </div>
          </motion.section>

          {/* ══════ SECTION 7: ЛОГИКА ПОИСКА ══════ */}
          <motion.section
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true, margin: "-50px" }}
            className="mb-20"
          >
            <SectionHeader icon={Search} title="ЛОГИКА ПОИСКА" subtitle="search_logic.scan()" />
            <div className="grid md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <HUDPanel className="p-6" glow>
                  <h3 className="font-mono text-sm text-green-300 mb-4 glow-text-sm">{'>'}euler_circles.classify()</h3>
                  {/* Visual Euler Circles SVG */}
                  <svg viewBox="0 0 280 160" className="w-full max-w-sm mx-auto mb-4" xmlns="http://www.w3.org/2000/svg">
                    <defs>
                      <filter id="eg"><feGaussianBlur stdDeviation="3" result="b" /><feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
                    </defs>
                    {/* Left circle */}
                    <circle cx="115" cy="80" r="65" fill="#00ff4108" stroke="#00ff4140" strokeWidth="1.5">
                      <animate attributeName="stroke-opacity" values="0.2;0.5;0.2" dur="3s" repeatCount="indefinite" />
                    </circle>
                    {/* Right circle */}
                    <circle cx="165" cy="80" r="65" fill="#06b6d408" stroke="#06b6d440" strokeWidth="1.5">
                      <animate attributeName="stroke-opacity" values="0.2;0.5;0.2" dur="3s" begin="1.5s" repeatCount="indefinite" />
                    </circle>
                    {/* Labels */}
                    <text x="75" y="70" textAnchor="middle" fill="#00ff4180" fontSize="11" fontFamily="monospace">Фрукты</text>
                    <text x="205" y="70" textAnchor="middle" fill="#06b6d480" fontSize="11" fontFamily="monospace">Овощи</text>
                    <text x="140" y="85" textAnchor="middle" fill="#f59e0b80" fontSize="9" fontFamily="monospace">Оба?</text>
                    {/* Animated overlap glow */}
                    <circle cx="140" cy="80" r="20" fill="#f59e0b05">
                      <animate attributeName="r" values="15;25;15" dur="2s" repeatCount="indefinite" />
                    </circle>
                  </svg>
                  <p className="text-center text-xs text-green-600 font-mono mb-4">
                    Круги Эйлера — визуализация логических операций над множествами
                  </p>
                </HUDPanel>
                <Expandable title="> Операторы поиска">
                  <p className="mb-1"><strong className="text-[#00ff41]">&amp;</strong> (И) — оба условия: <span className="text-cyan-400">фрукты &amp; красные</span></p>
                  <p className="mb-1"><strong className="text-[#00ff41]">|</strong> (ИЛИ) — хотя бы одно: <span className="text-cyan-400">фрукты | овощи</span></p>
                  <p><strong className="text-[#00ff41]">~</strong> (НЕ) — исключение: <span className="text-cyan-400">~зелёные</span></p>
                </Expandable>
              </div>
              <div className="space-y-4">
                <EulerCirclesGame />
                <HUDPanel className="p-5">
                  <h3 className="font-mono text-sm text-green-300 mb-3 glow-text-sm">{'>'}search_queries.examples()</h3>
                  {[
                    { query: "информатика & 7 класс", logic: "Найти страницы, где есть ОБА слова", op: "AND" },
                    { query: "клавиатура | мышь", logic: "Найти страницы, где есть ЛЮБОЕ из слов", op: "OR" },
                    { query: "игры ~ онлайн", logic: "Найти «игры», но БЕЗ слова «онлайн»", op: "NOT" },
                  ].map((q, i) => (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, y: 10 }}
                      whileInView={{ opacity: 1, y: 0 }}
                      viewport={{ once: true }}
                      transition={{ delay: i * 0.1 }}
                      className="mb-3 bg-[#020c02] rounded-lg border border-green-900/20 p-3"
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <span className={cn(
                          "font-mono text-[10px] px-1.5 py-0.5 rounded",
                          q.op === "AND" && "bg-green-900/30 text-green-400",
                          q.op === "OR" && "bg-cyan-900/30 text-cyan-400",
                          q.op === "NOT" && "bg-amber-900/30 text-amber-400",
                        )}>{q.op}</span>
                        <code className="font-mono text-xs text-green-300">{q.query}</code>
                      </div>
                      <p className="font-mono text-[10px] text-green-600">{q.logic}</p>
                    </motion.div>
                  ))}
                </HUDPanel>
              </div>
            </div>
          </motion.section>

          {/* ══════ SECTION 8: БЕЗОПАСНОСТЬ И ШИФРОВАНИЕ ══════ */}
          <motion.section
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true, margin: "-50px" }}
            className="mb-20"
          >
            <SectionHeader icon={Lock} title="БЕЗОПАСНОСТЬ И ШИФРОВАНИЕ" subtitle="security.scan()" />
            <div className="grid md:grid-cols-2 gap-6">
              <HUDPanel className="p-6" glow>
                <h3 className="font-mono text-sm text-green-300 mb-4 glow-text-sm">{'>'}caesar_cipher.decrypt()</h3>
                <CaesarCipherSVG />
              </HUDPanel>
              <div className="space-y-4">
                {[
                  { title: "Вирусы", icon: Shield, desc: "Вредоносные программы, размножающиеся и наносящие ущерб. Антивирус — защита.", color: "red" },
                  { title: "Фишинг", icon: Eye, desc: "Мошеннические письма/сайты, крадущие пароли и данные.", color: "amber" },
                  { title: "Троян", icon: Lock, desc: "Программа под видом полезной, но выполняющая вредоносные действия.", color: "orange" },
                ].map((t, i) => (
                  <motion.div
                    key={t.title}
                    initial={{ opacity: 0, x: 15 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: i * 0.1 }}
                    className="bg-[#030f03] rounded-xl border border-red-900/30 p-4 flex items-start gap-3"
                  >
                    <div className="p-2 rounded-lg bg-red-900/20 border border-red-800/30 shrink-0">
                      <t.icon className="w-5 h-5 text-red-400" />
                    </div>
                    <div>
                      <p className="font-mono font-bold text-sm text-white">{t.title}</p>
                      <p className="font-mono text-xs text-green-500/70 mt-1">{t.desc}</p>
                    </div>
                  </motion.div>
                ))}
                <Expandable title="> Правила парольной безопасности" defaultOpen>
                  <p className="mb-1">✓ Минимум 8 символов</p>
                  <p className="mb-1">✓ Буквы + цифры + спецсимволы</p>
                  <p className="mb-1">✓ Не использовать личные данные</p>
                  <p className="mb-1">✓ Разные пароли для разных сайтов</p>
                  <p>✓ Использовать менеджер паролей</p>
                </Expandable>
                <Expandable title="> Симметричное vs Асимметричное шифрование">
                  <p className="mb-2"><strong className="text-cyan-400">Симметричное:</strong> один ключ для шифрования и расшифровки. Быстрое, но нужно передавать ключ.</p>
                  <p><strong className="text-cyan-400">Асимметричное:</strong> два ключа — открытый и закрытый. Отправитель шифрует открытым, получатель расшифровывает закрытым.</p>
                </Expandable>
              </div>
            </div>
          </motion.section>

          {/* ══════ SECTION 9: БАЗЫ ДАННЫХ ══════ */}
          <motion.section
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true, margin: "-50px" }}
            className="mb-20"
          >
            <SectionHeader icon={Database} title="БАЗЫ ДАННЫХ" subtitle="databases.scan()" />
            <div className="grid md:grid-cols-2 gap-6">
              <HUDPanel className="p-6" glow>
                <h3 className="font-mono text-sm text-green-300 mb-4 glow-text-sm">{'>'}db.schema.visualize()</h3>
                {/* Visual table */}
                <div className="overflow-x-auto">
                  <table className="w-full font-mono text-xs">
                    <thead>
                      <tr className="border-b border-green-500/30">
                        <th className="p-2 text-left text-amber-400">id 🔑</th>
                        <th className="p-2 text-left text-green-400">имя</th>
                        <th className="p-2 text-left text-cyan-400">класс</th>
                        <th className="p-2 text-left text-green-400">оценка</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[
                        ["1", "Иванов А.", "7А", "5"],
                        ["2", "Петрова М.", "7Б", "4"],
                        ["3", "Сидоров К.", "7А", "5"],
                        ["4", "Козлова Е.", "7В", "3"],
                      ].map((row, ri) => (
                        <motion.tr
                          key={ri}
                          initial={{ opacity: 0, x: -10 }}
                          whileInView={{ opacity: 1, x: 0 }}
                          viewport={{ once: true }}
                          transition={{ delay: ri * 0.1 }}
                          className="border-b border-green-900/20 hover:bg-green-500/5 transition-colors"
                        >
                          {row.map((cell, ci) => (
                            <td key={ci} className={cn("p-2", ci === 0 ? "text-amber-400/70" : "text-green-200/70")}>
                              {cell}
                            </td>
                          ))}
                        </motion.tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="mt-3 text-[10px] font-mono text-green-600">
                  Запись = строка | Поле = столбец | Ключ = уникальный идентификатор
                </div>
              </HUDPanel>
              <div className="space-y-4">
                <InfoCard icon={Layers} title="Понятия">
                  <div className="space-y-1.5 text-xs text-green-400/80 font-mono">
                    <p><strong className="text-[#00ff41]">БД</strong> — организованная коллекция данных</p>
                    <p><strong className="text-[#00ff41]">Таблица</strong> — объект БД с строками и столбцами</p>
                    <p><strong className="text-[#00ff41]">Запись</strong> — строка таблицы (один объект)</p>
                    <p><strong className="text-[#00ff41]">Поле</strong> — столбец таблицы (свойство)</p>
                    <p><strong className="text-[#00ff41]">Ключ</strong> — уникальный идентификатор записи</p>
                  </div>
                </InfoCard>
                <Expandable title="> SQL — основы">
                  <pre className="bg-[#020c02] rounded-lg p-3 text-xs overflow-x-auto text-cyan-300 border border-green-900/20 mb-2">{`-- Получить все записи
SELECT * FROM Учащиеся;

-- Фильтрация
SELECT * FROM Учащиеся
  WHERE класс = '7А';

-- Добавление записи
INSERT INTO Учащиеся (имя, класс, оценка)
  VALUES ('Новиков Д.', '7А', 4);`}</pre>
                </Expandable>
                <Expandable title="> Реляционные базы данных">
                  <p className="mb-1">Данные хранятся в таблицах, связанных между собой через <strong className="text-cyan-400">ключи</strong>.</p>
                  <p className="mb-1">Пример: таблица «Учащиеся» связана с таблицей «Оценки» через поле id ученика.</p>
                  <p>Типы связей: один-к-одному, один-ко-многим, многие-ко-многим.</p>
                </Expandable>
              </div>
            </div>
          </motion.section>

          {/* ══════ CYBER ACADEMY TEASER ══════ */}
          <motion.section
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="mb-12"
          >
            <HUDPanel glow className="p-8 text-center">
              <motion.div
                animate={{ boxShadow: ["0 0 20px rgba(0,255,65,0.1)", "0 0 40px rgba(0,255,65,0.2)", "0 0 20px rgba(0,255,65,0.1)"] }}
                transition={{ duration: 3, repeat: Infinity }}
                className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-green-900/30 border border-green-500/40 text-green-300 text-xs mb-4 uppercase tracking-[0.2em] font-bold"
              >
                <Rocket className="w-3.5 h-3.5" /> Level_Up_Protocol
              </motion.div>
              <h2 className="text-3xl md:text-4xl font-bold font-mono mb-3">
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-green-300 via-emerald-200 to-[#00ff41] glow-text">
                  CYBER ACADEMY
                </span>
              </h2>
              <p className="text-green-400/60 text-sm font-mono mb-6 max-w-md mx-auto">
                Готов к следующему уровню? Полный курс информатики с интерактивными заданиями, тестами и персональным ИИ-наставником.
              </p>
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: 0.3 }}
              >
                <Link
                  href="/"
                  className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-green-600 to-emerald-600 text-white font-mono font-bold text-sm hover:shadow-[0_0_30px_rgba(0,255,65,0.4)] hover:scale-105 transition-all"
                >
                  <Rocket className="w-4 h-4" />
                  НАЧАТЬ ОБУЧЕНИЕ
                  <ArrowRight className="w-4 h-4" />
                </Link>
              </motion.div>
              <div className="mt-6 flex justify-center gap-6">
                {[
                  { icon: ShieldCheck, label: "Сертификат" },
                  { icon: FileText, label: "150+ заданий" },
                  { icon: Network, label: "Сообщество" },
                ].map(item => (
                  <div key={item.label} className="flex items-center gap-1.5 text-green-500/50">
                    <item.icon className="w-4 h-4" />
                    <span className="text-xs font-mono">{item.label}</span>
                  </div>
                ))}
              </div>
            </HUDPanel>
          </motion.section>

          {/* ══════ FOOTER ══════ */}
          <footer className="mt-auto pt-8 pb-6 border-t border-green-900/20">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 text-green-700 font-mono text-xs">
              <div className="flex items-center gap-2">
                <Terminal className="w-3.5 h-3.5" />
                <span>NET_ARCHITECT // v7.0 // ВПР 2025</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-green-900">system.shutdown()</span>
                <motion.div
                  animate={{ opacity: [0.3, 1, 0.3] }}
                  transition={{ duration: 2, repeat: Infinity }}
                  className="w-2 h-2 rounded-full bg-[#00ff41]"
                />
              </div>
            </div>
          </footer>
        </div>
      </div>
    </div>
  );
}

"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import {
  BookOpen,
  PenTool,
  SpellCheck,
  Quote,
  TreePine,
  Branches,
  Lightbulb,
  Eye,
  MousePointerClick,
  ChevronDown,
  ChevronUp,
  Hash,
  Type,
  MessageSquare,
  ScrollText,
  ArrowLeft,
} from "lucide-react";

/* ═══════════════════════════════════════════════════════════════════
   SVG COMPONENT 1: SpeechTreeSVG — Parts of Speech hierarchy
   ═══════════════════════════════════════════════════════════════════ */
const SpeechTreeSVG = ({
  hovered,
  setHovered,
}: {
  hovered: string | null;
  setHovered: (v: string | null) => void;
}) => {
  const independent = [
    { id: "suschestvitelnoe", label: "Сущ.", full: "Существительное", color: "#c084fc", x: 40, y: 90 },
    { id: "prilagatelnoe", label: "Прил.", full: "Прилагательное", color: "#a78bfa", x: 90, y: 90 },
    { id: "chislitelnoe", label: "Числит.", full: "Числительное", color: "#8b5cf6", x: 145, y: 90 },
    { id: "mestoimenie", label: "Мест.", full: "Местоимение", color: "#c084fc", x: 40, y: 150 },
    { id: "glagol", label: "Глагол", full: "Глагол", color: "#a78bfa", x: 90, y: 150 },
    { id: "narechie", label: "Нареч.", full: "Наречие", color: "#8b5cf6", x: 145, y: 150 },
    { id: "prichastie", label: "Прич.", full: "Причастие", color: "#c084fc", x: 40, y: 210 },
    { id: "deechprichastie", label: "Деепр.", full: "Деепричастие", color: "#a78bfa", x: 110, y: 210 },
  ];

  const auxiliary = [
    { id: "predlog", label: "Предлог", full: "Предлог", color: "#60a5fa", x: 280, y: 110 },
    { id: "soyuz", label: "Союз", full: "Союз", color: "#38bdf8", x: 280, y: 165 },
    { id: "chastitsa", label: "Частица", full: "Частица", color: "#7dd3fc", x: 280, y: 220 },
  ];

  return (
    <svg viewBox="0 0 360 270" className="w-full h-full" style={{ fontFamily: "sans-serif" }}>
      <defs>
        <filter id="svgGlow">
          <feGaussianBlur stdDeviation="3" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* Root node */}
      <g>
        <rect x="100" y="10" width="160" height="36" rx="18" fill="#7c3aed" opacity="0.9" />
        <text x="180" y="33" fill="#fff" fontSize="13" fontWeight="bold" textAnchor="middle">
          ЧАСТИ РЕЧИ
        </text>
      </g>

      {/* Branch: Самостоятельные */}
      <line x1="140" y1="46" x2="95" y2="65" stroke="#a855f7" strokeWidth="2" opacity="0.6" />
      <rect x="15" y="60" width="160" height="28" rx="14" fill="#7c3aed" opacity="0.5" />
      <text x="95" y="79" fill="#e9d5ff" fontSize="11" fontWeight="bold" textAnchor="middle">
        Самостоятельные
      </text>

      {/* Lines to independent */}
      {[90, 150, 210].map((y) => (
        <line key={y} x1="95" y1={y - 5} x2="95" y2={y + 5} stroke="#a855f7" strokeWidth="1.5" opacity="0.4" />
      ))}

      {/* Independent items */}
      {independent.map((item) => (
        <g
          key={item.id}
          onMouseEnter={() => setHovered(item.id)}
          onMouseLeave={() => setHovered(null)}
          className="cursor-pointer"
        >
          <rect
            x={item.x - 2}
            y={item.y - 16}
            width={item.id === "deechprichastie" ? 70 : 55}
            height={32}
            rx="10"
            fill={hovered === item.id ? item.color : `${item.color}33`}
            stroke={hovered === item.id ? "#fff" : item.color}
            strokeWidth={hovered === item.id ? 2 : 1}
            style={{ transition: "all 0.2s ease" }}
          />
          <text
            x={item.x + (item.id === "deechprichastie" ? 33 : 25)}
            y={item.y + 4}
            fill={hovered === item.id ? "#fff" : "#e9d5ff"}
            fontSize="10"
            fontWeight="bold"
            textAnchor="middle"
          >
            {item.label}
          </text>
        </g>
      ))}

      {/* Branch: Служебные */}
      <line x1="220" y1="46" x2="290" y2="80" stroke="#60a5fa" strokeWidth="2" opacity="0.6" />
      <rect x="230" y="72" width="120" height="28" rx="14" fill="#3b82f6" opacity="0.5" />
      <text x="290" y="91" fill="#bfdbfe" fontSize="11" fontWeight="bold" textAnchor="middle">
        Служебные
      </text>

      {/* Auxiliary items */}
      {auxiliary.map((item) => (
        <g
          key={item.id}
          onMouseEnter={() => setHovered(item.id)}
          onMouseLeave={() => setHovered(null)}
          className="cursor-pointer"
        >
          <rect
            x={item.x - 2}
            y={item.y - 16}
            width={80}
            height={32}
            rx="10"
            fill={hovered === item.id ? item.color : `${item.color}33`}
            stroke={hovered === item.id ? "#fff" : item.color}
            strokeWidth={hovered === item.id ? 2 : 1}
            style={{ transition: "all 0.2s ease" }}
          />
          <text
            x={item.x + 38}
            y={item.y + 4}
            fill={hovered === item.id ? "#fff" : "#bfdbfe"}
            fontSize="10"
            fontWeight="bold"
            textAnchor="middle"
          >
            {item.label}
          </text>
        </g>
      ))}

      {/* Tooltip on hover */}
      {hovered && (
        <g>
          <rect x="5" y="240" width="350" height="28" rx="6" fill="rgba(0,0,0,0.85)" stroke="#a855f7" strokeWidth="1" />
          {[...independent, ...auxiliary].find((i) => i.id === hovered) && (
            <text x="180" y="258" fill="#e9d5ff" fontSize="10" textAnchor="middle" fontWeight="bold">
              {(() => {
                const part = [...independent, ...auxiliary].find((i) => i.id === hovered);
                const defs: Record<string, string> = {
                  suschestvitelnoe: "Существительное — предмет, живое существо, явление (Кто? Что?)",
                  prilagatelnoe: "Прилагательное — признак предмета (Какой? Какая? Какие?)",
                  chislitelnoe: "Числительное — количество, порядок (Сколько? Который?)",
                  mestoimenie: "Местоимение — указывает на предмет, не называя (Кто? Что?)",
                  glagol: "Глагол — действие, состояние (Что делать? Что сделать?)",
                  narechie: "Наречие — признак действия (Как? Где? Когда? Куда?)",
                  prichastie: "Причастие — признак предмета по действию (Какой?)",
                  deechprichastie: "Деепричастие — добавочное действие (Что делая? Что сделав?)",
                  predlog: "Предлог — связь слов в словосочетании (без, в, к, на, о)",
                  soyuz: "Союз — связь однородных членов и предложений (и, а, но, потому что)",
                  chastitsa: "Частица — оттенок значения (не, ни, же, ли, ведь, даже)",
                };
                return part ? defs[part.id] || part.full : "";
              })()}
            </text>
          )}
        </g>
      )}
    </svg>
  );
};

/* ═══════════════════════════════════════════════════════════════════
   SVG COMPONENT 2: MorphemeSVG — Word structure breakdown
   ═══════════════════════════════════════════════════════════════════ */
const MorphemeSVG = ({
  activePart,
  setActivePart,
  wordParts,
}: {
  activePart: string | null;
  setActivePart: (v: string | null) => void;
  wordParts: { part: string; label: string; text: string; color: string; width: number }[];
}) => {
  const partDefs: Record<string, string> = {
    Приставка: "Стоит перед корнем. Указывает на направление или завершённость действия. (пере-, за-, на-, под-, от-, при-)",
    Корень: "Главная значимая часть слова. Общий для родственных слов. (вод- / -вод- / -вожд-)",
    Суффикс: "Стоит после корня. Образует новое слово или форму. (-ок, -ек, -н-, -тель, -ск-)",
    Окончание: "Изменяемая часть. Выражает грамм. значение (падеж, число, род). Выделяется!",
    Основа: "Всё слово без окончания. Несёт основное лексическое значение.",
  };

  const colors: Record<string, string> = {
    Приставка: "#f472b6",
    Корень: "#a855f7",
    Суффикс: "#38bdf8",
    Окончание: "#fbbf24",
    Основа: "#34d399",
  };

  return (
    <svg viewBox="0 0 600 260" className="w-full h-full" style={{ fontFamily: "sans-serif" }}>
      <defs>
        <marker id="arrPurple" markerWidth="8" markerHeight="8" refX="7" refY="3" orient="auto">
          <path d="M0,0 L0,6 L7,3 z" fill="#a855f7" />
        </marker>
      </defs>

      {/* Word blocks */}
      {(() => {
        let xPos = 60;
        return wordParts.map((wp, i) => {
          const w = wp.width;
          const currentX = xPos;
          xPos += w + 4;
          return (
            <g
              key={i}
              onMouseEnter={() => setActivePart(wp.part)}
              onMouseLeave={() => setActivePart(null)}
              className="cursor-pointer"
            >
              <rect
                x={currentX}
                y={40}
                width={w}
                height={60}
                rx="8"
                fill={activePart === wp.part ? wp.color : `${wp.color}44`}
                stroke={activePart === wp.part ? "#fff" : wp.color}
                strokeWidth={activePart === wp.part ? 2 : 1}
                style={{ transition: "all 0.2s ease" }}
              />
              <text
                x={currentX + w / 2}
                y={76}
                fill={activePart === wp.part ? "#fff" : "#e2e8f0"}
                fontSize="22"
                fontWeight="bold"
                textAnchor="middle"
              >
                {wp.text}
              </text>
              <text
                x={currentX + w / 2}
                y={120}
                fill={wp.color}
                fontSize="11"
                fontWeight="bold"
                textAnchor="middle"
              >
                {wp.label}
              </text>
              {/* Bracket lines */}
              <line x1={currentX + w / 2} y1={125} x2={currentX + w / 2} y2={135} stroke={wp.color} strokeWidth="1" />
            </g>
          );
        });
      })()}

      {/* Основа bracket */}
      {(() => {
        let startX = 60;
        let endX = 60;
        wordParts.forEach((wp) => {
          if (wp.part !== "Окончание") {
            endX = startX + wp.width + 4;
          }
          startX += wp.width + 4;
        });
        const adjustedEnd = endX - 4;
        return (
          <g>
            <line x1={60} y1={145} x2={adjustedEnd} y2={145} stroke="#34d399" strokeWidth="2" />
            <line x1={60} y1={140} x2={60} y2={145} stroke="#34d399" strokeWidth="2" />
            <line x1={adjustedEnd} y1={140} x2={adjustedEnd} y2={145} stroke="#34d399" strokeWidth="2" />
            <text x={(60 + adjustedEnd) / 2} y={162} fill="#34d399" fontSize="12" fontWeight="bold" textAnchor="middle">
              основа
            </text>
          </g>
        );
      })()}

      {/* Explanation box */}
      {activePart && partDefs[activePart] && (
        <g>
          <rect x="30" y="180" width="540" height="60" rx="10" fill="rgba(0,0,0,0.85)" stroke={colors[activePart]} strokeWidth="1.5" />
          <circle cx="55" cy="200" r="8" fill={colors[activePart]} />
          <text x="70" y="204" fill="#fff" fontSize="12" fontWeight="bold">
            {activePart}
          </text>
          <text x="70" y="224" fill="#cbd5e1" fontSize="10">
            {partDefs[activePart]}
          </text>
        </g>
      )}
    </svg>
  );
};

/* ═══════════════════════════════════════════════════════════════════
   SVG COMPONENT 3: SentenceTreeSVG — Syntax tree
   ═══════════════════════════════════════════════════════════════════ */
const SentenceTreeSVG = ({
  hovered,
  setHovered,
}: {
  hovered: string | null;
  setHovered: (v: string | null) => void;
}) => {
  const nodes = [
    { id: "podlezhaschee", label: "Подлежащее", question: "Кто? Что?", color: "#c084fc", x: 80, y: 30 },
    { id: "skazuemoe", label: "Сказуемое", question: "Что делает?", color: "#a855f7", x: 240, y: 30 },
    { id: "dopolnenie", label: "Дополнение", question: "Кого? Что? Кому? Чему?", color: "#60a5fa", x: 400, y: 30 },
    { id: "opredelenie", label: "Определение", question: "Какой? Чей?", color: "#f472b6", x: 80, y: 120 },
    { id: "obstoyatelstvo", label: "Обстоятельство", question: "Где? Когда? Как? Куда?", color: "#34d399", x: 260, y: 120 },
  ];

  return (
    <svg viewBox="0 0 520 230" className="w-full h-full" style={{ fontFamily: "sans-serif" }}>
      <defs>
        <filter id="nodeGlow">
          <feGaussianBlur stdDeviation="4" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* Central label */}
      <text x="260" y="205" fill="#7c3aed" fontSize="12" fontWeight="bold" textAnchor="middle" opacity="0.7">
        ГЛАВНЫЕ ЧЛЕНЫ + ВТОРОСТЕПЕННЫЕ
      </text>

      {/* Lines connecting */}
      <line x1="80" y1="55" x2="80" y2="115" stroke="#a855f7" strokeWidth="1" opacity="0.3" strokeDasharray="4 3" />
      <line x1="260" y1="55" x2="260" y2="115" stroke="#a855f7" strokeWidth="1" opacity="0.3" strokeDasharray="4 3" />
      <line x1="80" y1="48" x2="240" y2="48" stroke="#a855f7" strokeWidth="1.5" opacity="0.4" />
      <line x1="240" y1="48" x2="400" y2="48" stroke="#60a5fa" strokeWidth="1" opacity="0.3" strokeDasharray="4 3" />

      {/* Nodes */}
      {nodes.map((node) => (
        <g
          key={node.id}
          onMouseEnter={() => setHovered(node.id)}
          onMouseLeave={() => setHovered(null)}
          className="cursor-pointer"
        >
          <rect
            x={node.x - 5}
            y={node.y}
            width={node.id === "obstoyatelstvo" ? 180 : node.id === "dopolnenie" ? 140 : 130}
            height={45}
            rx="12"
            fill={hovered === node.id ? node.color : `${node.color}22`}
            stroke={hovered === node.id ? "#fff" : node.color}
            strokeWidth={hovered === node.id ? 2 : 1}
            filter={hovered === node.id ? "url(#nodeGlow)" : undefined}
            style={{ transition: "all 0.25s ease" }}
          />
          <text
            x={node.x + (node.id === "obstoyatelstvo" ? 85 : node.id === "dopolnenie" ? 65 : 60)}
            y={node.y + 20}
            fill={hovered === node.id ? "#fff" : node.color}
            fontSize="13"
            fontWeight="bold"
            textAnchor="middle"
          >
            {node.label}
          </text>
          <text
            x={node.x + (node.id === "obstoyatelstvo" ? 85 : node.id === "dopolnenie" ? 65 : 60)}
            y={node.y + 38}
            fill={hovered === node.id ? "#e2e8f0" : "#94a3b8"}
            fontSize="10"
            textAnchor="middle"
          >
            {node.question}
          </text>
        </g>
      ))}

      {/* Legend */}
      <g>
        <rect x="5" y="170" width="8" height="8" rx="2" fill="#a855f7" />
        <text x="18" y="178" fill="#94a3b8" fontSize="8">Главные</text>
        <rect x="70" y="170" width="8" height="8" rx="2" fill="#60a5fa" />
        <text x="83" y="178" fill="#94a3b8" fontSize="8">Второстепенные</text>
      </g>
    </svg>
  );
};

/* ═══════════════════════════════════════════════════════════════════
   SVG COMPONENT 4: PunctuationRuleSVG — Animated sentence with commas
   ═══════════════════════════════════════════════════════════════════ */
const PunctuationRuleSVG = ({
  activeRule,
  setActiveRule,
}: {
  activeRule: string | null;
  setActiveRule: (v: string | null) => void;
}) => {
  const rules = [
    { id: "odnorodnye", label: "Запятая при однородных", color: "#f472b6" },
    { id: "prichastnyj", label: "Причастный оборот", color: "#a855f7" },
    { id: "slozhnoe", label: "Сложное предложение", color: "#38bdf8" },
    { id: "pryamaya-rech", label: "Прямая речь", color: "#fbbf24" },
  ];

  return (
    <svg viewBox="0 0 700 250" className="w-full h-full" style={{ fontFamily: "sans-serif" }}>
      {/* Rule buttons */}
      {rules.map((rule, i) => (
        <g
          key={rule.id}
          onMouseEnter={() => setActiveRule(rule.id)}
          onMouseLeave={() => setActiveRule(null)}
          className="cursor-pointer"
        >
          <rect
            x={10}
            y={10 + i * 34}
            width={220}
            height={30}
            rx="8"
            fill={activeRule === rule.id ? rule.color : `${rule.color}22`}
            stroke={activeRule === rule.id ? "#fff" : rule.color}
            strokeWidth={activeRule === rule.id ? 1.5 : 1}
            style={{ transition: "all 0.2s ease" }}
          />
          <text x="120" y={30 + i * 34} fill={activeRule === rule.id ? "#fff" : "#cbd5e1"} fontSize="11" fontWeight="bold" textAnchor="middle">
            {rule.label}
          </text>
        </g>
      ))}

      {/* Example sentences */}
      {activeRule === "odnorodnye" && (
        <g>
          <rect x="250" y="15" width="440" height="55" rx="10" fill="rgba(244,114,182,0.08)" stroke="#f472b6" strokeWidth="1" />
          <text x="265" y="38" fill="#e2e8f0" fontSize="13">
            Ветер{" "}
            <tspan fill="#f472b6" fontSize="20" fontWeight="bold">,</tspan>{" "}
            дождь и туман мешали путникам.
          </text>
          <text x="265" y="58" fill="#f472b6" fontSize="10" opacity="0.8">
            → Однородные определения: ветер, дождь, туман (не последнее — запятая!)
          </text>
        </g>
      )}

      {activeRule === "prichastnyj" && (
        <g>
          <rect x="250" y="15" width="440" height="55" rx="10" fill="rgba(168,85,247,0.08)" stroke="#a855f7" strokeWidth="1" />
          <text x="265" y="38" fill="#e2e8f0" fontSize="13">
            Книга{" "}
            <tspan fill="#a855f7" fontWeight="bold">, лежащая на столе, </tspan>
            была старой.
          </text>
          <text x="265" y="58" fill="#a855f7" fontSize="10" opacity="0.8">
            → Причастный оборот после определяемого слова: выделяется запятыми
          </text>
        </g>
      )}

      {activeRule === "slozhnoe" && (
        <g>
          <rect x="250" y="15" width="440" height="55" rx="10" fill="rgba(56,189,248,0.08)" stroke="#38bdf8" strokeWidth="1" />
          <text x="265" y="38" fill="#e2e8f0" fontSize="13">
            Солнце село{" "}
            <tspan fill="#38bdf8" fontSize="20" fontWeight="bold">,</tspan>{" "}
            и на улице стало темно.
          </text>
          <text x="265" y="58" fill="#38bdf8" fontSize="10" opacity="0.8">
            → ССП: две грамматические основы, разделённые запятой (и, а, но)
          </text>
        </g>
      )}

      {activeRule === "pryamaya-rech" && (
        <g>
          <rect x="250" y="15" width="440" height="70" rx="10" fill="rgba(251,191,36,0.08)" stroke="#fbbf24" strokeWidth="1" />
          <text x="265" y="38" fill="#e2e8f0" fontSize="13">
            <tspan fill="#fbbf24" fontWeight="bold">А: «</tspan>
            Привет!{" "}
            <tspan fill="#fbbf24" fontWeight="bold">»</tspan>
          </text>
          <text x="265" y="58" fill="#fbbf24" fontSize="10" opacity="0.8">
            → Слова автора «перед» прямой речью: А: «П» или А: «П!»
          </text>
          <text x="265" y="74" fill="#94a3b8" fontSize="10" opacity="0.6">
            «П», — а. → Прямая речь «перед» словами автора
          </text>
        </g>
      )}

      {!activeRule && (
        <g>
          <rect x="250" y="50" width="440" height="40" rx="10" fill="rgba(255,255,255,0.03)" stroke="#334155" strokeWidth="1" strokeDasharray="4 3" />
          <text x="470" y="75" fill="#64748b" fontSize="12" textAnchor="middle">
            Наведи на правило слева ←
          </text>
        </g>
      )}

      {/* Comma animation */}
      <circle cx="233" cy="155" r="4" fill="#f472b6" opacity="0.6">
        <animate attributeName="opacity" values="0.3;1;0.3" dur="2s" repeatCount="indefinite" />
      </circle>
      <text x="210" y="180" fill="#f472b6" fontSize="30" fontWeight="bold" opacity="0.15">
        ,
      </text>
      <text x="280" y="180" fill="#a855f7" fontSize="30" fontWeight="bold" opacity="0.15">
        ,
      </text>
      <text x="350" y="180" fill="#38bdf8" fontSize="30" fontWeight="bold" opacity="0.15">
        ,
      </text>
      <text x="420" y="180" fill="#fbbf24" fontSize="30" fontWeight="bold" opacity="0.15">
        «»
      </text>

      {/* Formula bar */}
      <rect x="250" y="195" width="440" height="40" rx="8" fill="rgba(168,85,247,0.06)" />
      <text x="470" y="215" fill="#a78bfa" fontSize="10" textAnchor="middle" fontWeight="bold">
        ПУНКТУАЦИЯ — НАБОР ПРАВИЛ ДЛЯ РАЗДЕЛИТЕЛЬНЫХ ЗНАКОВ
      </text>
      <text x="470" y="228" fill="#7c3aed" fontSize="9" textAnchor="middle">
        Запятая | Точка | Тире | Двоеточие | Точка с запятой
      </text>
    </svg>
  );
};

/* ═══════════════════════════════════════════════════════════════════
   SVG COMPONENT 5: NounDeclensionSVG — 6 cases table
   ═══════════════════════════════════════════════════════════════════ */
const NounDeclensionSVG = () => (
  <svg viewBox="0 0 680 310" className="w-full h-full" style={{ fontFamily: "sans-serif" }}>
    {/* Header row */}
    <rect x="0" y="0" width="680" height="40" rx="10" fill="#7c3aed" opacity="0.3" />
    <text x="60" y="26" fill="#e9d5ff" fontSize="12" fontWeight="bold" textAnchor="middle">Падеж</text>
    <text x="180" y="26" fill="#e9d5ff" fontSize="12" fontWeight="bold" textAnchor="middle">Вопрос</text>
    <text x="320" y="26" fill="#e9d5ff" fontSize="12" fontWeight="bold" textAnchor="middle">1 скл.</text>
    <text x="440" y="26" fill="#e9d5ff" fontSize="12" fontWeight="bold" textAnchor="middle">2 скл.</text>
    <text x="570" y="26" fill="#e9d5ff" fontSize="12" fontWeight="bold" textAnchor="middle">3 скл.</text>

    {/* Case rows */}
    {[
      { name: "Именительный", q: "Кто? Что?", e1: "земля, стол", e2: "конь, поле", e3: "ночь", color: "#c084fc" },
      { name: "Родительный", q: "Кого? Чего?", e1: "земли, стола", e2: "коня, поля", e3: "ночи", color: "#a78bfa" },
      { name: "Дательный", q: "Кому? Чему?", e1: "земле, столу", e2: "коню, полю", e3: "ночи", color: "#8b5cf6" },
      { name: "Винительный", q: "Кого? Что?", e1: "землю, стол", e2: "коня, поле", e3: "ночь", color: "#7c3aed" },
      { name: "Творительный", q: "Кем? Чем?", e1: "землёй, столом", e2: "конём, полем", e3: "ночью", color: "#6d28d9" },
      { name: "Предложный", q: "О ком? О чём?", e1: "о земле, о столе", e2: "о коне, о поле", e3: "о ночи", color: "#5b21b6" },
    ].map((row, i) => (
      <g key={i}>
        <rect x="0" y={45 + i * 42} width="680" height="40" rx="6" fill={i % 2 === 0 ? "rgba(168,85,247,0.05)" : "rgba(0,0,0,0)"} />
        <text x="60" y={70 + i * 42} fill={row.color} fontSize="12" fontWeight="bold" textAnchor="middle">{row.name}</text>
        <text x="180" y={70 + i * 42} fill="#e2e8f0" fontSize="11" textAnchor="middle">{row.q}</text>
        <text x="320" y={70 + i * 42} fill="#c084fc" fontSize="11" textAnchor="middle">{row.e1}</text>
        <text x="440" y={70 + i * 42} fill="#60a5fa" fontSize="11" textAnchor="middle">{row.e2}</text>
        <text x="570" y={70 + i * 42} fill="#34d399" fontSize="11" textAnchor="middle">{row.e3}</text>
      </g>
    ))}

    {/* Footer labels */}
    <text x="320" y="305" fill="#c084fc" fontSize="9" textAnchor="middle" opacity="0.6">ж.р., м.р. + -а/-я</text>
    <text x="440" y="305" fill="#60a5fa" fontSize="9" textAnchor="middle" opacity="0.6">м.р. с твёрд. осн., ср.р.</text>
    <text x="570" y="305" fill="#34d399" fontSize="9" textAnchor="middle" opacity="0.6">ж.р. + мягкий знак</text>
  </svg>
);

/* ═══════════════════════════════════════════════════════════════════
   DATA ARRAYS
   ═══════════════════════════════════════════════════════════════════ */

const spellingRules = [
  {
    rule: "жи-ши → И",
    examples: ["жизнь", "шишка", "живот", "ширина"],
    note: "Ж и Ш под ударением пишутся с И, несмотря на произношение [ы].",
    color: "#f472b6",
  },
  {
    rule: "ча-ща → А",
    examples: ["часы", "щука", "чаща", "площадь"],
    note: "Ч и Щ под ударением пишутся с А, несмотря на произношение [и].",
    color: "#a855f7",
  },
  {
    rule: "чу-щу → У",
    examples: ["чудо", "щука", "чувство", "ищу"],
    note: "Ч и Щ под ударением пишутся с У, несмотря на произношение [у] — но правило!",
    color: "#38bdf8",
  },
  {
    rule: "Приставки на -З/-С",
    examples: ["безвкусный", "бесполезный", "расписать", "расписка"],
    note: "З перед звонкими, С перед глухими. Исключения: раз-, роз-, без-, бес- (твёрдый/мягкий знак!).",
    color: "#fbbf24",
  },
  {
    rule: "Корни с чередованием: -раст-/-ращ-/-рост-",
    examples: ["расти", "выращивать", "росток", "исключение: Ростов"],
    note: "РАСТ/РАЩ — перед СТ, Щ. РОСТ — без СТ, Щ. Исключение: Ростов, Ростислав.",
    color: "#34d399",
  },
  {
    rule: "Корни: -лаг-/-лог-",
    examples: ["полагать", "излагать", "положить", "предложить"],
    note: "-ЛАГ- перед -А-, -ЛОГ- перед -О-.",
    color: "#fb923c",
  },
  {
    rule: "Корни: -гор-/-гар-",
    examples: ["загорелый", "загорать", "исключение: пригарь"],
    note: "-ГАР- под ударением, -ГОР- без ударения. Исключение: выгарки, пригарь.",
    color: "#e879f9",
  },
  {
    rule: "НЕ с глаголами",
    examples: ["не знал", "не мог", "не делал"],
    note: "НЕ с глаголами пишется РАЗДЕЛЬНО всегда! (не видел, не хочет, не пробовал)",
    color: "#f43f5e",
  },
  {
    rule: "-тся / -ться",
    examples: ["он смеётся", "он хочет смеяться"],
    note: "Отвечай на вопрос: Что делает? (что делаеТ) → -тся. Что делать? (что дела ТЬ) → -ться.",
    color: "#22d3ee",
  },
];

const phraseologisms = [
  { phrase: "Бить баклуши", meaning: "Бездельничать, ничего не делать", color: "#f472b6" },
  { phrase: "Водить за нос", meaning: "Обманывать кого-либо", color: "#a855f7" },
  { phrase: "Зарубить на носу", meaning: "Точно запомнить", color: "#38bdf8" },
  { phrase: "Капля в море", meaning: "Очень малая часть чего-либо", color: "#fbbf24" },
  { phrase: "Небо и земля", meaning: "Вполне разные, несхожие вещи", color: "#34d399" },
  { phrase: "Семь пятниц на неделе", meaning: "Человек часто меняет решения", color: "#fb923c" },
  { phrase: "Как с гуся вода", meaning: "Всё проходит бесследно, не заботит", color: "#e879f9" },
  { phrase: "Хлопот полон рот", meaning: "Много забот и дел", color: "#f43f5e" },
];

const textStyles = [
  {
    name: "Разговорный",
    icon: MessageSquare,
    features: ["Непринуждённый тон", "Оборот «неужели», «да и»", "Простые предложения", "Разговорная лексика"],
    example: "Слушай, а ты пойдёшь завтра в кино?",
    color: "#f472b6",
    bg: "bg-pink-950/20",
    border: "border-pink-500/30",
  },
  {
    name: "Художественный",
    icon: BookOpen,
    features: ["Образность, метафоры", "Эпитеты, сравнения", "Прямая речь", "Эмоциональность"],
    example: "Золотая осень укрыла землю ковром из листьев.",
    color: "#a855f7",
    bg: "bg-purple-950/20",
    border: "border-purple-500/30",
  },
  {
    name: "Научный",
    icon: Type,
    features: ["Точность, логичность", "Термины, определения", "Сложные предложения", "Объективность"],
    example: "Фотосинтез — процесс превращения световой энергии в химическую.",
    color: "#38bdf8",
    bg: "bg-sky-950/20",
    border: "border-sky-500/30",
  },
  {
    name: "Официально-деловой",
    icon: ScrollText,
    features: ["Стандартные формулировки", "Канцеляризмы", "Прямой порядок слов", "Точность"],
    example: "Настоящим уведомляем, что в связи с... принято решение.",
    color: "#fbbf24",
    bg: "bg-amber-950/20",
    border: "border-amber-500/30",
  },
  {
    name: "Публицистический",
    icon: PenTool,
    features: ["Яркость, эмоциональность", "Риторические вопросы", "Общественная тематика", "Призыв к действию"],
    example: "Неужели мы останемся равнодушными к судьбе нашей планеты?",
    color: "#34d399",
    bg: "bg-emerald-950/20",
    border: "border-emerald-500/30",
  },
];

const wordBreakdowns = [
  {
    word: "ПЕРЕХОДИТЬ",
    parts: [
      { part: "Приставка", label: "пере-", text: "пере", color: "#f472b6", width: 70 },
      { part: "Корень", label: "-ход-", text: "ход", color: "#a855f7", width: 60 },
      { part: "Суффикс", label: "-и-", text: "и", color: "#38bdf8", width: 30 },
      { part: "Окончание", label: "-ть", text: "ть", color: "#fbbf24", width: 40 },
    ],
  },
  {
    word: "ПОДОБНЫЙ",
    parts: [
      { part: "Приставка", label: "под-", text: "под", color: "#f472b6", width: 55 },
      { part: "Корень", label: "-обн-", text: "обн", color: "#a855f7", width: 55 },
      { part: "Суффикс", label: "-ый", text: "ый", color: "#38bdf8", width: 45 },
    ],
  },
  {
    word: "БЕЗДОМНЫЙ",
    parts: [
      { part: "Приставка", label: "без-", text: "без", color: "#f472b6", width: 55 },
      { part: "Корень", label: "-дом-", text: "дом", color: "#a855f7", width: 60 },
      { part: "Суффикс", label: "-н-", text: "н", color: "#38bdf8", width: 30 },
      { part: "Суффикс", label: "-ый", text: "ый", color: "#22d3ee", width: 45 },
    ],
  },
];

const verbConjugations = [
  { ending: "-ешь, -ет", questions: "Что делаешь? Что делает?", examples: "пишешь, пишет", conj: "I спряжение" },
  { ending: "-ишь, -ит", questions: "Что делаешь? Что делает?", examples: "слышишь, слышит", conj: "II спряжение" },
];

const adjDegrees = [
  { type: "Положительная", example: "высокий — добрый — умный", note: "Исходная форма", color: "#c084fc" },
  { type: "Сравнительная", example: "выше — добрее — умнее", note: "Сравнение: -ее, -е, -ше или «более + adj»", color: "#a78bfa" },
  { type: "Превосходная", example: "высочайший — добрейший — умнейший", note: "Наивысшая степень: -ейш-, -айш- или «самый + adj»", color: "#8b5cf6" },
];

/* ═══════════════════════════════════════════════════════════════════
   MAIN COMPONENT
   ═══════════════════════════════════════════════════════════════════ */

export default function Russian7Cheatsheet() {
  const [hoveredSpeech, setHoveredSpeech] = useState<string | null>(null);
  const [activeMorpheme, setActiveMorpheme] = useState<string | null>(null);
  const [selectedWordIdx, setSelectedWordIdx] = useState(0);
  const [expandedRule, setExpandedRule] = useState<number | null>(null);
  const [hoveredSyntax, setHoveredSyntax] = useState<string | null>(null);
  const [activePunctRule, setActivePunctRule] = useState<string | null>(null);
  const [expandedPhrase, setExpandedPhrase] = useState<number | null>(null);
  const [morphTab, setMorphTab] = useState<"nouns" | "adjectives" | "verbs">("nouns");
  const [expandedStyle, setExpandedStyle] = useState<number | null>(null);

  return (
    <div className="min-h-screen bg-[#0a0612] text-purple-50 p-4 md:p-8 font-sans relative overflow-x-hidden selection:bg-purple-500/30">
      {/* Background pattern — manuscript dots */}
      <div
        className="absolute inset-0 z-0 opacity-[0.03] pointer-events-none"
        style={{
          backgroundImage: `
            radial-gradient(circle at 15% 25%, #a855f7 1px, transparent 1px),
            radial-gradient(circle at 85% 75%, #a855f7 1px, transparent 1px),
            radial-gradient(circle at 50% 50%, #7c3aed 0.5px, transparent 0.5px),
            radial-gradient(circle at 30% 80%, #8b5cf6 0.5px, transparent 0.5px)
          `,
          backgroundSize: "30px 30px, 50px 50px, 20px 20px, 45px 45px",
        }}
      />

      {/* Glow orbs */}
      <div className="absolute top-[-250px] left-[-150px] w-[700px] h-[700px] bg-purple-800/8 blur-[200px] rounded-full pointer-events-none" />
      <div className="absolute bottom-[-300px] right-[-200px] w-[600px] h-[600px] bg-violet-900/6 blur-[180px] rounded-full pointer-events-none" />
      <div className="absolute top-[40%] left-[60%] w-[400px] h-[400px] bg-fuchsia-900/4 blur-[150px] rounded-full pointer-events-none" />

      <div className="max-w-6xl mx-auto relative z-10">

        {/* ════════ BACK LINK ════════ */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.4 }}
          className="mb-8"
        >
          <Link
            href="/vpr-tests"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-purple-900/20 border border-purple-700/30 text-purple-300 text-sm hover:bg-purple-800/30 hover:border-purple-600/50 transition-all group"
          >
            <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
            Назад к тестам ВПР
          </Link>
        </motion.div>

        {/* ════════ HEADER ════════ */}
        <motion.header
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7 }}
          className="mb-16 relative"
        >
          <div className="flex flex-col md:flex-row items-center gap-8">
            {/* Title SVG */}
            <div className="w-48 h-48 md:w-56 md:h-56 flex-shrink-0">
              <svg viewBox="0 0 200 200" className="w-full h-full" style={{ fontFamily: "sans-serif" }}>
                <defs>
                  <radialGradient id="headerGrad" cx="40%" cy="35%" r="60%">
                    <stop offset="0%" stopColor="#7c3aed" />
                    <stop offset="60%" stopColor="#5b21b6" />
                    <stop offset="100%" stopColor="#3b0764" />
                  </radialGradient>
                  <filter id="headerGlow">
                    <feGaussianBlur stdDeviation="4" result="blur" />
                    <feMerge>
                      <feMergeNode in="blur" />
                      <feMergeNode in="SourceGraphic" />
                    </feMerge>
                  </filter>
                </defs>

                {/* Outer ring */}
                <circle cx="100" cy="100" r="90" fill="none" stroke="#a855f7" strokeWidth="1" opacity="0.3" strokeDasharray="4 6" />
                <circle cx="100" cy="100" r="75" fill="url(#headerGrad)" stroke="#a855f7" strokeWidth="2" />

                {/* Letter А */}
                <text x="100" y="95" fill="#e9d5ff" fontSize="50" fontWeight="900" textAnchor="middle" filter="url(#headerGlow)">А</text>
                <text x="100" y="120" fill="#c084fc" fontSize="14" textAnchor="middle" fontWeight="bold">Я З Ы К</text>

                {/* Orbiting dots */}
                {[0, 72, 144, 216, 288].map((deg, i) => (
                  <circle
                    key={i}
                    cx={100 + 60 * Math.cos((deg * Math.PI) / 180)}
                    cy={100 + 60 * Math.sin((deg * Math.PI) / 180)}
                    r={2.5}
                    fill="#c084fc"
                    opacity="0.6"
                  >
                    <animateTransform
                      attributeName="transform"
                      type="rotate"
                      from={`0 100 100`}
                      to={`${360} 100 100`}
                      dur={`${8 + i * 2}s`}
                      repeatCount="indefinite"
                    />
                  </circle>
                ))}

                {/* Corner accents */}
                <line x1="30" y1="30" x2="50" y2="30" stroke="#a855f7" strokeWidth="2" opacity="0.5" />
                <line x1="30" y1="30" x2="30" y2="50" stroke="#a855f7" strokeWidth="2" opacity="0.5" />
                <line x1="170" y1="170" x2="150" y2="170" stroke="#a855f7" strokeWidth="2" opacity="0.5" />
                <line x1="170" y1="170" x2="170" y2="150" stroke="#a855f7" strokeWidth="2" opacity="0.5" />
              </svg>
            </div>

            <div className="text-center md:text-left flex-1">
              <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-purple-900/30 border border-purple-500/40 text-purple-300 text-xs mb-4 uppercase tracking-[0.2em] font-bold">
                <Hash className="w-3.5 h-3.5" /> Language_Protocol_7.0
              </div>
              <h1 className="text-5xl md:text-7xl font-black tracking-tighter mb-3">
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-300 via-violet-200 to-fuchsia-400">
                  РУССКИЙ
                </span>{" "}
                <span className="text-white">КОД</span>
              </h1>
              <p className="text-purple-400/70 text-lg md:text-xl">
                7 класс // Морфология, Орфография, Пунктуация, Синтаксис
              </p>
              <div className="flex items-center gap-4 mt-4 justify-center md:justify-start text-xs text-purple-500/60">
                <span className="flex items-center gap-1"><MousePointerClick className="w-3 h-3" /> Интерактивно</span>
                <span className="flex items-center gap-1"><Eye className="w-3 h-3" /> Наведи и узнаешь</span>
                <span className="flex items-center gap-1"><Lightbulb className="w-3 h-3" /> Шпаргалка ВПР</span>
              </div>
            </div>
          </div>
        </motion.header>

        {/* ════════ SECTION 1: PARTS OF SPEECH ════════ */}
        <motion.section
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-50px" }}
          transition={{ duration: 0.6 }}
          className="mb-20"
        >
          <div className="flex items-center gap-3 mb-8">
            <div className="p-3 bg-purple-900/30 rounded-xl border border-purple-700/40">
              <Branches className="text-purple-400 w-7 h-7" />
            </div>
            <div>
              <h2 className="text-3xl md:text-4xl font-bold text-white">Части Речи</h2>
              <p className="text-purple-500/60 text-sm">Самостоятельные и служебные — наведи на ветку!</p>
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-8 items-start">
            <motion.div
              whileHover={{ scale: 1.01 }}
              className="bg-[#0f0a1a] rounded-2xl border border-violet-800/40 p-4"
            >
              <SpeechTreeSVG hovered={hoveredSpeech} setHovered={setHoveredSpeech} />
            </motion.div>

            <div className="space-y-3">
              {/* Independent card */}
              <motion.div
                whileHover={{ x: 4 }}
                className="bg-purple-950/20 p-4 rounded-xl border border-purple-700/30"
              >
                <h4 className="font-bold text-purple-300 text-sm mb-2">Самостоятельные (8 частей)</h4>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  {["Существительное", "Прилагательное", "Числительное", "Местоимение", "Глагол", "Наречие", "Причастие", "Деепричастие"].map(
                    (name, i) => (
                      <span
                        key={i}
                        className="px-2 py-1 rounded bg-purple-900/20 text-purple-200"
                        onMouseEnter={() => {
                          const ids = ["suschestvitelnoe", "prilagatelnoe", "chislitelnoe", "mestoimenie", "glagol", "narechie", "prichastie", "deechprichastie"];
                          setHoveredSpeech(ids[i]);
                        }}
                        onMouseLeave={() => setHoveredSpeech(null)}
                        style={{ cursor: "pointer", transition: "all 0.2s" }}
                      >
                        {name}
                      </span>
                    )
                  )}
                </div>
              </motion.div>

              {/* Auxiliary card */}
              <motion.div
                whileHover={{ x: 4 }}
                className="bg-sky-950/15 p-4 rounded-xl border border-sky-700/30"
              >
                <h4 className="font-bold text-sky-300 text-sm mb-2">Служебные (3 части)</h4>
                <div className="flex gap-2 text-xs">
                  {["Предлог", "Союз", "Частица"].map((name, i) => (
                    <span
                      key={i}
                      className="px-3 py-1 rounded bg-sky-900/20 text-sky-200"
                      onMouseEnter={() => {
                        const ids = ["predlog", "soyuz", "chastitsa"];
                        setHoveredSpeech(ids[i]);
                      }}
                      onMouseLeave={() => setHoveredSpeech(null)}
                      style={{ cursor: "pointer", transition: "all 0.2s" }}
                    >
                      {name}
                    </span>
                  ))}
                </div>
                <p className="text-[11px] text-gray-500 mt-2">Служебные части речи не являются членами предложения.</p>
              </motion.div>

              {/* Special note */}
              <motion.div
                whileHover={{ x: 4 }}
                className="bg-amber-950/15 p-4 rounded-xl border border-amber-700/30"
              >
                <h4 className="font-bold text-amber-300 text-sm mb-1 flex items-center gap-2">
                  <Lightbulb className="w-4 h-4" /> Запомни!
                </h4>
                <p className="text-xs text-gray-400">Причастие и деепричастие — особые формы глагола. Они сочетают признаки глагола и прилагательного / наречия.</p>
              </motion.div>
            </div>
          </div>
        </motion.section>

        {/* ════════ SECTION 2: MORPHEMES ════════ */}
        <motion.section
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-50px" }}
          transition={{ duration: 0.6 }}
          className="mb-20"
        >
          <div className="flex items-center gap-3 mb-8">
            <div className="p-3 bg-purple-900/30 rounded-xl border border-purple-700/40">
              <Type className="text-pink-400 w-7 h-7" />
            </div>
            <div>
              <h2 className="text-3xl md:text-4xl font-bold text-white">Состав Слова (Морфемы)</h2>
              <p className="text-purple-500/60 text-sm">Приставка, корень, суффикс, окончание — кликай на части!</p>
            </div>
          </div>

          {/* Word selector */}
          <div className="flex flex-wrap gap-2 mb-6">
            {wordBreakdowns.map((wb, i) => (
              <button
                key={i}
                onClick={() => {
                  setSelectedWordIdx(i);
                  setActiveMorpheme(null);
                }}
                className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${
                  selectedWordIdx === i
                    ? "bg-purple-600 text-white shadow-lg shadow-purple-900/50"
                    : "bg-purple-950/30 text-purple-400 hover:bg-purple-900/30 border border-purple-800/30"
                }`}
              >
                {wb.word}
              </button>
            ))}
          </div>

          <motion.div
            key={selectedWordIdx}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="bg-[#0f0a1a] rounded-2xl border border-violet-800/40 p-4"
          >
            <MorphemeSVG
              activePart={activeMorpheme}
              setActivePart={setActiveMorpheme}
              wordParts={wordBreakdowns[selectedWordIdx].parts}
            />
          </motion.div>

          {/* Part legend synced */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mt-6">
            {[
              { label: "Приставка", color: "#f472b6" },
              { label: "Корень", color: "#a855f7" },
              { label: "Суффикс", color: "#38bdf8" },
              { label: "Окончание", color: "#fbbf24" },
              { label: "Основа", color: "#34d399" },
            ].map((item, i) => (
              <motion.div
                key={i}
                whileHover={{ scale: 1.05 }}
                onMouseEnter={() => setActiveMorpheme(item.label)}
                onMouseLeave={() => setActiveMorpheme(null)}
                className={`p-3 rounded-lg border cursor-pointer transition-all ${
                  activeMorpheme === item.label
                    ? "bg-purple-900/30 border-purple-500"
                    : "bg-[#0f0a1a] border-violet-800/30 hover:border-violet-600/40"
                }`}
              >
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }} />
                  <span className="text-sm font-bold text-gray-300">{item.label}</span>
                </div>
              </motion.div>
            ))}
          </div>
        </motion.section>

        {/* ════════ SECTION 3: SPELLING RULES ════════ */}
        <motion.section
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-50px" }}
          transition={{ duration: 0.6 }}
          className="mb-20"
        >
          <div className="flex items-center gap-3 mb-8">
            <div className="p-3 bg-purple-900/30 rounded-xl border border-purple-700/40">
              <SpellCheck className="text-cyan-400 w-7 h-7" />
            </div>
            <div>
              <h2 className="text-3xl md:text-4xl font-bold text-white">Орфография</h2>
              <p className="text-purple-500/60 text-sm">Ключевые правила — раскрой карточку для деталей</p>
            </div>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {spellingRules.map((rule, i) => (
              <motion.div
                key={i}
                layout
                onClick={() => setExpandedRule(expandedRule === i ? null : i)}
                className="bg-[#0f0a1a] rounded-xl border border-violet-800/40 p-4 cursor-pointer hover:border-violet-600/50 transition-all group"
              >
                <div className="flex items-center justify-between mb-2">
                  <div
                    className="w-3 h-3 rounded-full flex-shrink-0"
                    style={{ backgroundColor: rule.color }}
                  />
                  <h4 className="font-bold text-white text-sm ml-2 flex-1">{rule.rule}</h4>
                  {expandedRule === i ? (
                    <ChevronUp className="w-4 h-4 text-gray-500 flex-shrink-0" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-gray-500 flex-shrink-0" />
                  )}
                </div>

                <div className="flex flex-wrap gap-1.5 mb-1">
                  {rule.examples.map((ex, j) => (
                    <span key={j} className="text-[11px] px-2 py-0.5 rounded bg-purple-900/20 text-purple-200">
                      {ex}
                    </span>
                  ))}
                </div>

                <AnimatePresence>
                  {expandedRule === i && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      className="overflow-hidden"
                    >
                      <div className="mt-3 pt-3 border-t border-violet-800/20">
                        <p className="text-xs text-gray-400 leading-relaxed">{rule.note}</p>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            ))}
          </div>
        </motion.section>

        {/* ════════ SECTION 4: PUNCTUATION ════════ */}
        <motion.section
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-50px" }}
          transition={{ duration: 0.6 }}
          className="mb-20"
        >
          <div className="flex items-center gap-3 mb-8">
            <div className="p-3 bg-purple-900/30 rounded-xl border border-purple-700/40">
              <Quote className="text-amber-400 w-7 h-7" />
            </div>
            <div>
              <h2 className="text-3xl md:text-4xl font-bold text-white">Пунктуация</h2>
              <p className="text-purple-500/60 text-sm">Запятые, тире, кавычки — наведи на правило!</p>
            </div>
          </div>

          <motion.div
            whileHover={{ scale: 1.005 }}
            className="bg-[#0f0a1a] rounded-2xl border border-violet-800/40 p-4"
          >
            <PunctuationRuleSVG activeRule={activePunctRule} setActiveRule={setActivePunctRule} />
          </motion.div>
        </motion.section>

        {/* ════════ SECTION 5: SYNTAX & SENTENCE TYPES ════════ */}
        <motion.section
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-50px" }}
          transition={{ duration: 0.6 }}
          className="mb-20"
        >
          <div className="flex items-center gap-3 mb-8">
            <div className="p-3 bg-purple-900/30 rounded-xl border border-purple-700/40">
              <TreePine className="text-emerald-400 w-7 h-7" />
            </div>
            <div>
              <h2 className="text-3xl md:text-4xl font-bold text-white">Синтаксис и Типы Предложений</h2>
              <p className="text-purple-500/60 text-sm">Структура предложения — наведи на член!</p>
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-8 items-start">
            <motion.div
              whileHover={{ scale: 1.01 }}
              className="bg-[#0f0a1a] rounded-2xl border border-violet-800/40 p-4"
            >
              <SentenceTreeSVG hovered={hoveredSyntax} setHovered={setHoveredSyntax} />
            </motion.div>

            <div className="space-y-4">
              {/* Sentence types */}
              <div className="bg-purple-950/20 p-5 rounded-xl border border-purple-700/30">
                <h4 className="font-bold text-purple-300 mb-3 text-sm">По количеству грамматических основ</h4>
                <div className="space-y-2">
                  <div className="flex items-center gap-3 p-2 rounded-lg bg-purple-900/15">
                    <div className="w-2 h-2 rounded-full bg-purple-400" />
                    <span className="text-sm text-gray-300"><strong className="text-white">Простое</strong> — одна грамм. основа</span>
                  </div>
                  <div className="flex items-center gap-3 p-2 rounded-lg bg-purple-900/15">
                    <div className="w-2 h-2 rounded-full bg-fuchsia-400" />
                    <span className="text-sm text-gray-300"><strong className="text-white">Сложное</strong> — две и более основ</span>
                  </div>
                </div>
              </div>

              <div className="bg-purple-950/20 p-5 rounded-xl border border-purple-700/30">
                <h4 className="font-bold text-purple-300 mb-3 text-sm">По составу грамматической основы</h4>
                <div className="space-y-2">
                  <div className="flex items-center gap-3 p-2 rounded-lg bg-purple-900/15">
                    <div className="w-2 h-2 rounded-full bg-cyan-400" />
                    <span className="text-sm text-gray-300"><strong className="text-white">Двусоставное</strong> — подлежащее + сказуемое</span>
                  </div>
                  <div className="flex items-center gap-3 p-2 rounded-lg bg-purple-900/15">
                    <div className="w-2 h-2 rounded-full bg-emerald-400" />
                    <span className="text-sm text-gray-300"><strong className="text-white">Односоставное</strong> — только один главный член</span>
                  </div>
                </div>
              </div>

              <div className="bg-purple-950/20 p-5 rounded-xl border border-purple-700/30">
                <h4 className="font-bold text-purple-300 mb-3 text-sm">Односоставные предложения</h4>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <span className="px-2 py-1 rounded bg-violet-900/20 text-violet-200">Определённо-личное</span>
                  <span className="px-2 py-1 rounded bg-violet-900/20 text-violet-200">Неопределённо-личное</span>
                  <span className="px-2 py-1 rounded bg-violet-900/20 text-violet-200">Безличное</span>
                  <span className="px-2 py-1 rounded bg-violet-900/20 text-violet-200">Назывное</span>
                </div>
                <p className="text-[11px] text-gray-500 mt-2">Пример: «Мне холодно.» (безличное) — нет и не может быть подлежащего.</p>
              </div>
            </div>
          </div>
        </motion.section>

        {/* ════════ SECTION 6: PHRASEOLOGISMS ════════ */}
        <motion.section
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-50px" }}
          transition={{ duration: 0.6 }}
          className="mb-20"
        >
          <div className="flex items-center gap-3 mb-8">
            <div className="p-3 bg-purple-900/30 rounded-xl border border-purple-700/40">
              <Lightbulb className="text-yellow-400 w-7 h-7" />
            </div>
            <div>
              <h2 className="text-3xl md:text-4xl font-bold text-white">Фразеологизмы</h2>
              <p className="text-purple-500/60 text-sm">Устойчивые выражения — раскрой, чтобы увидеть смысл!</p>
            </div>
          </div>

          {/* Key SVG */}
          <div className="mb-8 flex justify-center">
            <svg viewBox="0 0 200 80" className="w-48 h-auto" style={{ fontFamily: "sans-serif" }}>
              <defs>
                <filter id="keyGlow">
                  <feGaussianBlur stdDeviation="2" result="blur" />
                  <feMerge>
                    <feMergeNode in="blur" />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>
              </defs>
              <circle cx="55" cy="40" r="22" fill="none" stroke="#fbbf24" strokeWidth="3" filter="url(#keyGlow)" />
              <circle cx="55" cy="40" r="10" fill="#fbbf24" opacity="0.2" />
              <rect x="75" y="35" width="110" height="10" rx="3" fill="#fbbf24" opacity="0.8" />
              <rect x="155" y="35" width="8" height="18" rx="2" fill="#fbbf24" opacity="0.6" />
              <rect x="140" y="35" width="8" height="14" rx="2" fill="#fbbf24" opacity="0.6" />
              <text x="100" y="20" fill="#fbbf24" fontSize="9" textAnchor="middle" opacity="0.7">КЛЮЧ К СМЫСЛУ</text>
            </svg>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {phraseologisms.map((phrase, i) => (
              <motion.div
                key={i}
                layout
                onClick={() => setExpandedPhrase(expandedPhrase === i ? null : i)}
                whileHover={{ y: -4 }}
                className="bg-[#0f0a1a] rounded-xl border border-violet-800/40 p-4 cursor-pointer hover:border-violet-600/50 transition-all"
              >
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-bold text-white text-sm">{phrase.phrase}</h4>
                  <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: phrase.color }} />
                </div>

                <AnimatePresence>
                  {expandedPhrase === i ? (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      className="overflow-hidden"
                    >
                      <div className="pt-2 border-t border-violet-800/20">
                        <p className="text-xs text-gray-400">{phrase.meaning}</p>
                      </div>
                    </motion.div>
                  ) : (
                    <motion.div initial={{ opacity: 0.4 }} className="text-[10px] text-purple-500/50">
                      Нажми, чтобы раскрыть...
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            ))}
          </div>
        </motion.section>

        {/* ════════ SECTION 7: MORPHOLOGY DEEP DIVE (TABBED) ════════ */}
        <motion.section
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-50px" }}
          transition={{ duration: 0.6 }}
          className="mb-20"
        >
          <div className="flex items-center gap-3 mb-8">
            <div className="p-3 bg-purple-900/30 rounded-xl border border-purple-700/40">
              <BookOpen className="text-violet-400 w-7 h-7" />
            </div>
            <div>
              <h2 className="text-3xl md:text-4xl font-bold text-white">Морфология: Глубокое Погружение</h2>
              <p className="text-purple-500/60 text-sm">Существительное, прилагательное, глагол — выбери вкладку!</p>
            </div>
          </div>

          {/* Tab switcher */}
          <div className="flex flex-wrap gap-2 mb-6">
            {[
              { id: "nouns" as const, label: "Существительное", icon: Type },
              { id: "adjectives" as const, label: "Прилагательное", icon: Branches },
              { id: "verbs" as const, label: "Глагол", icon: PenTool },
            ].map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setMorphTab(tab.id)}
                  className={`px-5 py-2 rounded-lg text-sm font-bold transition-all flex items-center gap-2 ${
                    morphTab === tab.id
                      ? "bg-purple-600 text-white shadow-lg shadow-purple-900/50"
                      : "bg-purple-950/30 text-purple-400 hover:bg-purple-900/30 border border-purple-800/30"
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {tab.label}
                </button>
              );
            })}
          </div>

          <AnimatePresence mode="wait">
            {/* TAB: NOUNS */}
            {morphTab === "nouns" && (
              <motion.div
                key="nouns"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                transition={{ duration: 0.3 }}
                className="space-y-6"
              >
                <div className="bg-[#0f0a1a] rounded-2xl border border-violet-800/40 p-4 overflow-x-auto">
                  <NounDeclensionSVG />
                </div>

                <div className="grid sm:grid-cols-3 gap-4">
                  <div className="bg-purple-950/20 p-4 rounded-xl border border-purple-700/30">
                    <h4 className="font-bold text-purple-300 text-sm mb-2">1 скл.</h4>
                    <p className="text-xs text-gray-400">Ж.р., М.р. на -а/-я. (земля, дедушка, мама)</p>
                  </div>
                  <div className="bg-sky-950/15 p-4 rounded-xl border border-sky-700/30">
                    <h4 className="font-bold text-sky-300 text-sm mb-2">2 скл.</h4>
                    <p className="text-xs text-gray-400">М.р. с твёрд. основой, ср.р. на -о/-е. (стол, конь, поле)</p>
                  </div>
                  <div className="bg-emerald-950/15 p-4 rounded-xl border border-emerald-700/30">
                    <h4 className="font-bold text-emerald-300 text-sm mb-2">3 скл.</h4>
                    <p className="text-xs text-gray-400">Ж.р. на мягкий знак. (ночь, мышь, рожь)</p>
                  </div>
                </div>
              </motion.div>
            )}

            {/* TAB: ADJECTIVES */}
            {morphTab === "adjectives" && (
              <motion.div
                key="adjectives"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                transition={{ duration: 0.3 }}
                className="space-y-6"
              >
                {/* Degrees of comparison */}
                <div className="bg-[#0f0a1a] rounded-2xl border border-violet-800/40 p-6">
                  <h4 className="font-bold text-purple-300 mb-4 text-lg">Степени сравнения прилагательных</h4>
                  <div className="space-y-4">
                    {adjDegrees.map((deg, i) => (
                      <motion.div
                        key={i}
                        whileHover={{ x: 6 }}
                        className="p-4 rounded-xl border transition-all"
                        style={{ borderColor: `${deg.color}40`, backgroundColor: `${deg.color}08` }}
                      >
                        <div className="flex items-center gap-3 mb-2">
                          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: deg.color }} />
                          <h5 className="font-bold text-sm" style={{ color: deg.color }}>{deg.type}</h5>
                        </div>
                        <p className="text-sm text-gray-300 mb-1">{deg.example}</p>
                        <p className="text-xs text-gray-500">{deg.note}</p>
                      </motion.div>
                    ))}
                  </div>
                </div>

                {/* Разряды прилагательных */}
                <div className="grid sm:grid-cols-3 gap-4">
                  <div className="bg-purple-950/20 p-4 rounded-xl border border-purple-700/30">
                    <h4 className="font-bold text-purple-300 text-sm mb-2">Качественные</h4>
                    <p className="text-xs text-gray-400 mb-2">Можно сравнить, имеют степени. (красивый, добрый, умный)</p>
                    <div className="flex flex-wrap gap-1">
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-900/30 text-purple-200">+-ее/-ей</span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-900/30 text-purple-200">+-е</span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-900/30 text-purple-200">+-ше</span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-900/30 text-purple-200">более/наиболее</span>
                    </div>
                  </div>
                  <div className="bg-sky-950/15 p-4 rounded-xl border border-sky-700/30">
                    <h4 className="font-bold text-sky-300 text-sm mb-2">Относительные</h4>
                    <p className="text-xs text-gray-400">Материал, место, время. (деревянный, городской, утренний)</p>
                    <p className="text-[10px] text-gray-500 mt-2">Не имеют степеней сравнения!</p>
                  </div>
                  <div className="bg-amber-950/15 p-4 rounded-xl border border-amber-700/30">
                    <h4 className="font-bold text-amber-300 text-sm mb-2">Притяжательные</h4>
                    <p className="text-xs text-gray-400">Принадлежность кому-то. (мамин, лисий, отцов)</p>
                    <p className="text-[10px] text-gray-500 mt-2">Отвечают на вопрос «Чей?»</p>
                  </div>
                </div>
              </motion.div>
            )}

            {/* TAB: VERBS */}
            {morphTab === "verbs" && (
              <motion.div
                key="verbs"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                transition={{ duration: 0.3 }}
                className="space-y-6"
              >
                {/* Вид глагола */}
                <div className="bg-[#0f0a1a] rounded-2xl border border-violet-800/40 p-6">
                  <h4 className="font-bold text-purple-300 mb-4 text-lg">Виды глагола</h4>
                  <div className="grid sm:grid-cols-2 gap-6">
                    <motion.div whileHover={{ x: 4 }} className="p-4 rounded-xl bg-purple-950/20 border border-purple-700/30">
                      <h5 className="font-bold text-purple-300 text-sm mb-2">Совершенный вид (СВ)</h5>
                      <p className="text-sm text-gray-300 mb-1">Что <strong>сделать</strong>? Результат.</p>
                      <div className="flex flex-wrap gap-1 mt-2">
                        {["написать", "прочитать", "построить", "решить"].map((v, i) => (
                          <span key={i} className="text-[11px] px-2 py-0.5 rounded bg-purple-900/20 text-purple-200">{v}</span>
                        ))}
                      </div>
                      <p className="text-[10px] text-gray-500 mt-2">Ответ на вопрос: Что сделать?</p>
                    </motion.div>
                    <motion.div whileHover={{ x: 4 }} className="p-4 rounded-xl bg-sky-950/15 border border-sky-700/30">
                      <h5 className="font-bold text-sky-300 text-sm mb-2">Несовершенный вид (НСВ)</h5>
                      <p className="text-sm text-gray-300 mb-1">Что <strong>делать</strong>? Процесс.</p>
                      <div className="flex flex-wrap gap-1 mt-2">
                        {["писать", "читать", "строить", "решать"].map((v, i) => (
                          <span key={i} className="text-[11px] px-2 py-0.5 rounded bg-sky-900/20 text-sky-200">{v}</span>
                        ))}
                      </div>
                      <p className="text-[10px] text-gray-500 mt-2">Ответ на вопрос: Что делать?</p>
                    </motion.div>
                  </div>
                </div>

                {/* Спряжения */}
                <div className="bg-[#0f0a1a] rounded-2xl border border-violet-800/40 p-6">
                  <h4 className="font-bold text-purple-300 mb-4 text-lg">Спряжения глагола</h4>
                  <div className="space-y-4">
                    {verbConjugations.map((conj, i) => (
                      <motion.div
                        key={i}
                        whileHover={{ x: 6 }}
                        className="p-4 rounded-xl border border-violet-800/30 bg-purple-950/10"
                      >
                        <div className="flex items-center gap-3 mb-2">
                          <span className="text-xs font-bold px-2 py-1 rounded bg-purple-600/20 text-purple-300">{conj.conj}</span>
                          <span className="text-sm text-gray-300">{conj.ending}</span>
                        </div>
                        <p className="text-xs text-gray-500">{conj.questions}</p>
                        <p className="text-sm text-gray-300 mt-1">{conj.examples}</p>
                      </motion.div>
                    ))}
                  </div>

                  <div className="mt-4 p-4 rounded-xl bg-amber-950/15 border border-amber-700/30">
                    <h5 className="font-bold text-amber-300 text-sm mb-2 flex items-center gap-2">
                      <Lightbulb className="w-4 h-4" /> Глаголы-исключения
                    </h5>
                    <div className="grid sm:grid-cols-2 gap-2 text-xs">
                      <div>
                        <span className="text-purple-300 font-bold">I спр. на -ить:</span>
                        <span className="text-gray-400 ml-1">брить, стелить, зиждиться, зыбиться</span>
                      </div>
                      <div>
                        <span className="text-sky-300 font-bold">II спр. на -еть/-ать:</span>
                        <span className="text-gray-400 ml-1">гнать, держать, дышать, смотреть, видеть, слышать, ненавидеть, обидеть, терпеть, зависеть, вертеть</span>
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.section>

        {/* ════════ SECTION 8: TEXT TYPES & STYLES ════════ */}
        <motion.section
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-50px" }}
          transition={{ duration: 0.6 }}
          className="mb-20"
        >
          <div className="flex items-center gap-3 mb-8">
            <div className="p-3 bg-purple-900/30 rounded-xl border border-purple-700/40">
              <ScrollText className="text-emerald-400 w-7 h-7" />
            </div>
            <div>
              <h2 className="text-3xl md:text-4xl font-bold text-white">Стили и Типы Текстов</h2>
              <p className="text-purple-500/60 text-sm">Функциональные стили русского языка</p>
            </div>
          </div>

          {/* Text structure SVG */}
          <div className="mb-8 flex justify-center">
            <svg viewBox="0 0 500 70" className="w-full max-w-lg h-auto" style={{ fontFamily: "sans-serif" }}>
              <rect x="10" y="10" width="480" height="50" rx="10" fill="rgba(168,85,247,0.06)" stroke="#7c3aed" strokeWidth="1" />
              <text x="40" y="30" fill="#7c3aed" fontSize="10" fontWeight="bold">Вступление</text>
              <text x="40" y="48" fill="#94a3b8" fontSize="8">Тезис, вступление в тему</text>
              <line x1="160" y1="15" x2="160" y2="55" stroke="#7c3aed" strokeWidth="1" opacity="0.3" strokeDasharray="3 3" />
              <text x="185" y="30" fill="#a855f7" fontSize="10" fontWeight="bold">Основная часть</text>
              <text x="185" y="48" fill="#94a3b8" fontSize="8">Аргументы, примеры</text>
              <line x1="350" y1="15" x2="350" y2="55" stroke="#7c3aed" strokeWidth="1" opacity="0.3" strokeDasharray="3 3" />
              <text x="370" y="30" fill="#c084fc" fontSize="10" fontWeight="bold">Заключение</text>
              <text x="370" y="48" fill="#94a3b8" fontSize="8">Вывод, итог</text>

              {/* Animated cursor */}
              <rect x="14" y="14" width="6" height="42" rx="3" fill="#a855f7" opacity="0.15">
                <animate attributeName="x" values="14;350;14" dur="6s" repeatCount="indefinite" />
                <animate attributeName="opacity" values="0.15;0.3;0.15" dur="6s" repeatCount="indefinite" />
              </rect>
            </svg>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {textStyles.map((style, i) => {
              const Icon = style.icon;
              return (
                <motion.div
                  key={i}
                  layout
                  onClick={() => setExpandedStyle(expandedStyle === i ? null : i)}
                  whileHover={{ y: -4 }}
                  className={`${style.bg} rounded-xl border ${style.border} p-5 cursor-pointer transition-all group`}
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <Icon className={`w-5 h-5 ${style.color}`} />
                      <h4 className="font-bold text-white text-sm">{style.name}</h4>
                    </div>
                    {expandedStyle === i ? (
                      <ChevronUp className="w-4 h-4 text-gray-500" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-gray-500" />
                    )}
                  </div>

                  <AnimatePresence>
                    {expandedStyle === i ? (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        className="overflow-hidden"
                      >
                        <ul className="space-y-1.5 mb-3">
                          {style.features.map((feat, j) => (
                            <li key={j} className="text-xs text-gray-400 flex items-start gap-2">
                              <div className="w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0" style={{ backgroundColor: style.color }} />
                              {feat}
                            </li>
                          ))}
                        </ul>
                        <div className="pt-3 border-t border-white/5">
                          <p className="text-xs italic text-gray-500">«{style.example}»</p>
                        </div>
                      </motion.div>
                    ) : (
                      <motion.div initial={{ opacity: 0.4 }} className="text-[10px] text-purple-500/40">
                        Нажми для деталей...
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              );
            })}
          </div>
        </motion.section>

        {/* ════════ FOOTER ════════ */}
        <motion.footer
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          className="mt-auto pt-12 pb-8 border-t border-violet-800/20"
        >
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="text-center sm:text-left">
              <p className="text-purple-400/50 text-sm">РУССКИЙ КОД // Шпаргалка для ВПР 7 класс</p>
              <p className="text-purple-500/30 text-xs mt-1">Language_Protocol_7.0 — Все разделы охвачены</p>
            </div>
            <Link
              href="/vpr-tests"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-purple-900/20 border border-purple-700/30 text-purple-300 text-sm hover:bg-purple-800/30 hover:border-purple-600/50 transition-all group"
            >
              <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
              Назад к тестам ВПР
            </Link>
          </div>
        </motion.footer>
      </div>
    </div>
  );
}

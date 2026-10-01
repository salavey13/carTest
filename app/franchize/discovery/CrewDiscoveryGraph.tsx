"use client";

// app/franchize/discovery/CrewDiscoveryGraph.tsx
//
// The beautiful-circles social graph (boss: «create global crew discovery
// page, kinda social graph :) with beautiful circles for ux/ui :)»).
//
//   · circle = a crew, radius = its people (crewCircleRadius, sqrt scale);
//   · curve between circles = shared people (crew_members ONLY — the model
//     arrives precomputed from the lib, this file is pure presentation);
//   · layout = the deterministic force simulation from crew-network.ts
//     (no d3, no randomness — SSR and CSR render the same picture);
//   · tap a circle → glass panel with services, people, links. Tap empty
//     space / ✕ / Esc → back to the whole network.

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ArrowRight, Snowflake, Users, X } from "lucide-react";
import {
  crewCircleRadius,
  layoutCrewGraph,
  pluralRu,
  type CrewNetworkLink,
  type CrewNetworkNode,
} from "../lib/crew-network";

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts.map((p) => p[0]?.toUpperCase() ?? "").join("") || "?";
}

function truncate(name: string, max = 18): string {
  return name.length > max ? `${name.slice(0, max - 1).trimEnd()}…` : name;
}

/** Perceived luminance → pick readable ink over an accent. */
function inkFor(hexColor: string): string {
  const hex = hexColor.replace("#", "");
  if (hex.length < 6) return "#0b1220";
  const r = parseInt(hex.slice(0, 2), 16);
  const g = parseInt(hex.slice(2, 4), 16);
  const b = parseInt(hex.slice(4, 6), 16);
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return lum > 0.62 ? "#0b1220" : "#ffffff";
}

export function CrewDiscoveryGraph({
  nodes,
  links,
}: {
  nodes: CrewNetworkNode[];
  links: CrewNetworkLink[];
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);

  const radii = useMemo(() => {
    const map: Record<string, number> = {};
    for (const node of nodes) map[node.crewId] = crewCircleRadius(node.memberCount);
    return map;
  }, [nodes]);

  const positions = useMemo(
    () =>
      layoutCrewGraph(
        nodes.map((n) => n.crewId),
        links,
        { width: 1000, height: 1000, radii },
      ),
    [nodes, links, radii],
  );

  const selected = nodes.find((n) => n.crewId === selectedId) ?? null;

  useEffect(() => {
    if (!selectedId) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setSelectedId(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selectedId]);

  useEffect(() => {
    if (selectedId) panelRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [selectedId]);

  const selectedSet = useMemo(() => {
    if (!selectedId) return null;
    const incident = new Set<string>([selectedId]);
    for (const link of links) {
      if (link.source === selectedId) incident.add(link.target);
      if (link.target === selectedId) incident.add(link.source);
    }
    return incident;
  }, [links, selectedId]);

  return (
    <div className="mt-6">
      {/* ── the graph ─────────────────────────────────────────────────────── */}
      <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-white/[0.04] shadow-[0_30px_80px_-40px_rgba(2,8,23,0.9)]">
        <svg
          viewBox="0 0 1000 1000"
          className="h-auto w-full select-none"
          role="group"
          aria-label="Социальный граф сети: круги — экипажи, линии — общие люди"
        >
          <defs>
            {nodes.map((node, index) => (
              <radialGradient key={node.crewId} id={`cg-${index}`} cx="35%" cy="30%" r="75%">
                <stop offset="0%" stopColor={node.accent} stopOpacity="0.92" />
                <stop offset="58%" stopColor={node.accent} stopOpacity="0.55" />
                <stop offset="100%" stopColor={node.accent} stopOpacity="0.18" />
              </radialGradient>
            ))}
            {nodes.map((node, index) => {
              const r = radii[node.crewId] ?? 60;
              return <clipPath key={node.crewId} id={`cp-${index}`}>
                <circle cx="0" cy="0" r={r * 0.66} />
              </clipPath>;
            })}
          </defs>

          {/* tap-outside-to-deselect surface */}
          <rect x="0" y="0" width="1000" height="1000" fill="transparent" onClick={() => setSelectedId(null)} />

          {/* links (curves) */}
          <g>
            {links.map((link, index) => {
              const a = positions[link.source];
              const b = positions[link.target];
              if (!a || !b) return null;
              const ra = radii[link.source] ?? 60;
              const rb = radii[link.target] ?? 60;
              const dx = b.x - a.x;
              const dy = b.y - a.y;
              const dist = Math.max(1, Math.hypot(dx, dy));
              const ux = dx / dist;
              const uy = dy / dist;
              const x1 = a.x + ux * ra;
              const y1 = a.y + uy * ra;
              const x2 = b.x - ux * rb;
              const y2 = b.y - uy * rb;
              // one consistent bend direction keeps the weave calm
              const mx = (x1 + x2) / 2 - uy * dist * 0.08;
              const my = (y1 + y2) / 2 + ux * dist * 0.08;
              const active = selectedSet ? selectedSet.has(link.source) && selectedSet.has(link.target) : false;
              const dimmed = selectedSet !== null && !active;
              return (
                <path
                  key={`${link.source}-${link.target}`}
                  d={`M ${x1.toFixed(1)} ${y1.toFixed(1)} Q ${mx.toFixed(1)} ${my.toFixed(1)} ${x2.toFixed(1)} ${y2.toFixed(1)}`}
                  fill="none"
                  stroke={active ? "#7dd3fc" : "#ffffff"}
                  strokeWidth={active ? 2.6 : Math.min(4, 1.3 + link.weight * 0.7)}
                  strokeLinecap="round"
                  opacity={active ? 0.85 : dimmed ? 0.05 : Math.min(0.4, 0.14 + link.weight * 0.09)}
                  style={{ transition: "opacity 240ms ease, stroke-width 240ms ease" }}
                  // index keeps keys unique even if a duplicate pair ever appears
                  data-edge-index={index}
                />
              );
            })}
          </g>

          {/* crew circles */}
          <g>
            {nodes.map((node, index) => {
              const point = positions[node.crewId];
              if (!point) return null;
              const r = radii[node.crewId] ?? 60;
              const isSelected = node.crewId === selectedId;
              const dimmed = selectedSet !== null && !selectedSet.has(node.crewId);
              const ink = inkFor(node.accent);
              const labelColor = isSelected ? "#ffffff" : "rgba(255,255,255,0.82)";
              return (
                <g
                  key={node.crewId}
                  role="button"
                  tabIndex={0}
                  aria-label={`Экипаж ${node.name}: ${node.memberCount} чел., услуги: ${node.services.map((s) => s.label).join(", ") || "каталог"}`}
                  transform={`translate(${point.x.toFixed(1)} ${point.y.toFixed(1)})`}
                  onClick={(event) => {
                    event.stopPropagation();
                    setSelectedId(isSelected ? null : node.crewId);
                  }}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      setSelectedId(isSelected ? null : node.crewId);
                    }
                  }}
                  style={{
                    cursor: "pointer",
                    opacity: dimmed ? 0.3 : 1,
                    transition: "opacity 240ms ease",
                  }}
                >
                  {/* soft glow pad */}
                  <circle r={r + (isSelected ? 22 : 12)} fill={node.accent} opacity={isSelected ? 0.28 : 0.14} style={{ transition: "r 240ms ease, opacity 240ms ease" }} />
                  {/* selection ring */}
                  {isSelected && <circle r={r + 9} fill="none" stroke="#ffffff" strokeWidth="2" strokeDasharray="6 7" opacity="0.85" />}
                  {/* the circle itself */}
                  <circle r={r} fill={`url(#cg-${index})`} stroke={node.accent} strokeWidth="2.5" />
                  {/* logo (falls through to initials when absent/broken) */}
                  {node.logoUrl && (
                    <g clipPath={`url(#cp-${index})`}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <image
                        href={node.logoUrl}
                        x={-r * 0.66}
                        y={-r * 0.66}
                        width={r * 1.32}
                        height={r * 1.32}
                        preserveAspectRatio="xMidYMid slice"
                      />
                    </g>
                  )}
                  {!node.logoUrl && (
                    <text
                      textAnchor="middle"
                      y={r * 0.12}
                      fontSize={Math.max(20, r * 0.44)}
                      fontWeight="900"
                      fill={ink}
                      opacity="0.95"
                      style={{ pointerEvents: "none", userSelect: "none" }}
                    >
                      {initialsOf(node.name)}
                    </text>
                  )}
                  {/* member count inside the circle bottom */}
                  <text
                    textAnchor="middle"
                    y={r * 0.62}
                    fontSize={Math.max(13, r * 0.16)}
                    fontWeight="800"
                    fill={ink}
                    opacity="0.85"
                    style={{ pointerEvents: "none", userSelect: "none" }}
                  >
                    {node.memberCount} чел.
                  </text>
                  {/* name label under the circle */}
                  <text
                    textAnchor="middle"
                    y={r + 34}
                    fontSize="26"
                    fontWeight="800"
                    fill={labelColor}
                    style={{ pointerEvents: "none", userSelect: "none" }}
                  >
                    {truncate(node.name)}
                  </text>
                </g>
              );
            })}
          </g>
        </svg>

        {!selected && (
          <p className="pointer-events-none absolute inset-x-0 bottom-3 text-center text-xs font-semibold text-white/45">
            Нажми на круг — внутри люди и услуги экипажа
          </p>
        )}
      </div>

      {/* ── detail panel ──────────────────────────────────────────────────── */}
      <div ref={panelRef}>
        {selected ? (
          <section
            aria-label={`Экипаж ${selected.name}`}
            className="mt-4 rounded-3xl border border-white/12 bg-white/[0.07] p-5 backdrop-blur-md md:p-6"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex min-w-0 items-center gap-3">
                {selected.logoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={selected.logoUrl}
                    alt=""
                    width={52}
                    height={52}
                    className="rounded-2xl object-cover"
                    style={{ height: 52, width: 52, boxShadow: `0 0 0 2px ${selected.accent}66` }}
                  />
                ) : (
                  <span
                    className="flex items-center justify-center rounded-2xl text-lg font-black"
                    style={{ height: 52, width: 52, backgroundColor: `${selected.accent}26`, color: selected.accent }}
                  >
                    {initialsOf(selected.name)}
                  </span>
                )}
                <div className="min-w-0">
                  <h2 className="truncate text-xl font-black">{selected.name}</h2>
                  <p className="text-xs font-semibold text-white/60">
                    {selected.memberCount} {pluralRu(selected.memberCount, ["человек", "человека", "человек"])} в
                    экипаже
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedId(null)}
                aria-label="Закрыть карточку экипажа"
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/15 text-white/70 transition hover:border-white/40 hover:text-white"
              >
                <X className="h-4 w-4" aria-hidden />
              </button>
            </div>

            {selected.description && (
              <p className="mt-3 text-sm leading-relaxed text-white/70">{selected.description}</p>
            )}

            {/* services — the whole point of the network */}
            {selected.services.length > 0 && (
              <div className="mt-4 flex flex-wrap gap-2">
                {selected.services.map((service) => (
                  <Link
                    key={service.key}
                    href={service.href}
                    className="inline-flex min-h-11 items-center gap-2 rounded-full border px-4 py-2 text-sm font-bold transition hover:brightness-125"
                    style={{
                      borderColor: `${selected.accent}66`,
                      color: selected.accent,
                      backgroundColor: `${selected.accent}14`,
                    }}
                  >
                    {service.key === "storage" ? <Snowflake className="h-4 w-4" aria-hidden /> : null}
                    {service.label}
                    {service.sub && <span className="font-medium opacity-75">· {service.sub}</span>}
                  </Link>
                ))}
              </div>
            )}

            {/* people */}
            {selected.members.length > 0 && (
              <div className="mt-4">
                <p className="flex items-center gap-1.5 text-xs font-black uppercase tracking-wide text-white/55">
                  <Users className="h-3.5 w-3.5" aria-hidden /> Люди экипажа
                </p>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  {selected.members.slice(0, 8).map((member) => (
                    <span
                      key={member.userId}
                      className="inline-flex items-center gap-1.5 rounded-full border border-white/12 bg-white/[0.06] py-1 pl-1 pr-2.5 text-xs font-semibold text-white/80"
                    >
                      {member.avatarUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={member.avatarUrl} alt="" width={22} height={22} className="h-[22px] w-[22px] rounded-full object-cover" />
                      ) : (
                        <span className="flex h-[22px] w-[22px] items-center justify-center rounded-full bg-white/12 text-[9px] font-black">
                          {initialsOf(member.name)}
                        </span>
                      )}
                      {truncate(member.name, 20)}
                    </span>
                  ))}
                  {selected.memberCount > 8 && (
                    <span className="text-xs font-semibold text-white/55">и ещё {selected.memberCount - 8}</span>
                  )}
                </div>
              </div>
            )}

            {/* links row */}
            <div className="mt-5 flex flex-wrap gap-2">
              <Link
                href={`/franchize/${selected.slug}`}
                className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-full px-5 py-2.5 text-sm font-black transition hover:brightness-110 sm:flex-none"
                style={{ backgroundColor: selected.accent, color: inkFor(selected.accent) }}
              >
                Открыть экипаж <ArrowRight className="h-4 w-4" aria-hidden />
              </Link>
              <Link
                href={`/franchize/${selected.slug}/community`}
                className="inline-flex min-h-11 items-center justify-center rounded-full border border-white/15 px-5 py-2.5 text-sm font-bold text-white/85 transition hover:border-white/40"
              >
                Стена
              </Link>
              <Link
                href={`/franchize/${selected.slug}/map-riders`}
                className="inline-flex min-h-11 items-center justify-center rounded-full border border-white/15 px-5 py-2.5 text-sm font-bold text-white/85 transition hover:border-white/40"
              >
                Live-карта
              </Link>
            </div>
          </section>
        ) : (
          <p className="mt-3 text-center text-xs text-white/40" aria-hidden>
            Круг — экипаж · размер — люди · линия — общие люди
          </p>
        )}
      </div>
    </div>
  );
}

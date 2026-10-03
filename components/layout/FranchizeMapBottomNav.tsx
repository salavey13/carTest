"use client";

// /components/layout/FranchizeMapBottomNav.tsx
// Franchise-scoped bottom tab navigation for map-riders routes.
// Task 60 (2026-10-02): the map surface used to have TWO stacked sliding
// bottom sheets — the main sheet (the wall feed) AND a second vaul drawer
// (RidersDrawer) that slid over it when «Топ»/«Лист» were tapped. Overkill.
// Now there is ONE command-deck sheet with segments, and EVERY action tab
// here maps 1:1 to a segment of that single deck:
// - "Топ"  → segment "top"  (эфир-пульт + недельный зал славы)
// - "Лист" → segment "list" (райдеры / точки встреч / журнал заездов)
// - "Стена"→ segment "wall" (the wall feed — the deck's default content)
//   (on non-map routes — e.g. /leaderboard — it falls back to a plain Link:
//   the sheet-controlling actions don't exist there).
// Tapping the tab of the ALREADY-active expanded segment collapses the deck
// (toggle), and the deck broadcasts mapriders-sheet-state so the active tab
// highlights. Event names (mapriders-open-riders-drawer / -expand-sheet) are
// preserved — their semantics changed from "open second drawer" to "select
// segment" on the client side.
// - "Сеть" (2026-10-02) joined the deck (2026-10-04, boss: «polish network
//   tab in sliding on map-riders»): on the map page it selects the "network"
//   segment (crew-discovery graph INSIDE the sheet, model loaded by the
//   page); off the map it stays a plain Link to /franchize/discovery —
//   a Link never depends on the sheet controller.
// z-30 sits behind the vaul Drawer (z-40), so it's visible
// when the drawer is collapsed but hidden when expanded.

import Link from "next/link";
import { Network, Trophy, Users, List } from "lucide-react";
import { useEffect, useState } from "react";

// nav tab key → deck segment broadcast in mapriders-sheet-state.detail
const SEGMENT_BY_KEY: Record<string, string> = {
  leaderboard: "top",
  drawer: "list",
  crew: "wall",
  network: "network",
};

interface FranchizeMapBottomNavProps {
  pathname: string;
}

export default function FranchizeMapBottomNav({ pathname }: FranchizeMapBottomNavProps) {
  const slug = pathname.match(/^\/franchize\/([^/]+)\//)?.[1] || "vip-bike";
  const [canControl, setCanControl] = useState(false);
  // Deck state mirror for the active-tab highlight (snap ≤ 0.2 = collapsed
  // deck → nothing is "open", no highlight).
  const [deckSegment, setDeckSegment] = useState<string | null>(null);

  // Check if we're on map-riders page (where we can control the sheet)
  useEffect(() => {
    setCanControl(pathname.includes("/map-riders"));
  }, [pathname]);

  // The single sheet broadcasts its segment + snap; highlight the matching tab.
  useEffect(() => {
    const handleSheetState = (event: Event) => {
      const detail = (event as CustomEvent<{ segment?: string; snap?: number }>).detail;
      if (!detail || typeof detail !== "object") {
        setDeckSegment(null);
        return;
      }
      setDeckSegment((detail.snap ?? 0) > 0.2 ? detail.segment ?? null : null);
    };
    window.addEventListener("mapriders-sheet-state", handleSheetState);
    return () => window.removeEventListener("mapriders-sheet-state", handleSheetState);
  }, []);

  const items = [
    {
      key: "leaderboard",
      label: "Топ",
      icon: Trophy,
      isLink: false,
      action: () => {
        // Deck segment «Топ» — эфир-пульт + зал славы (зал славы живёт там).
        window.dispatchEvent(new CustomEvent("mapriders-open-riders-drawer", { detail: { tab: "ride" } }));
      },
    },
    {
      key: "drawer",
      label: "Лист",
      icon: List,
      isLink: false,
      action: () => {
        // Deck segment «Лист» — райдеры / точки встреч / журнал заездов.
        window.dispatchEvent(new CustomEvent("mapriders-open-riders-drawer"));
      },
    },
    {
      key: "crew",
      label: "Стена",
      icon: Users,
      isLink: false,
      action: () => {
        // Стена = контент шита: повторный тап сворачивает деку.
        window.dispatchEvent(new CustomEvent("mapriders-expand-sheet"));
      },
    },
  ] as const;

  return (
    <nav
      className="pointer-events-none fixed inset-x-0 bottom-0 z-30 border-t px-4 pb-[max(env(safe-area-inset-bottom),0.7rem)] pt-2 backdrop-blur-xl md:hidden"
      style={{
        borderColor: "color-mix(in srgb, var(--fr-map-nav-accent, #facc15) 28%, transparent)",
        backgroundColor: "color-mix(in srgb, var(--fr-map-nav-bg, #030712) 82%, black)",
      }}
    >
      <div className="pointer-events-auto mx-auto grid w-full max-w-lg grid-cols-4 gap-1">
        {items.map((item) => {
          const Icon = item.icon;
          const isActive = canControl && deckSegment !== null && SEGMENT_BY_KEY[item.key] === deckSegment;
          // Off the map page the sheet/drawer actions don't exist — «Стена»
          // degrades to a plain link to the standalone wall (old «Экипаж»
          // behavior), Топ/Лист stay disabled.
          if (!canControl && item.key === "crew") {
            return (
              <Link
                key={item.key}
                href={`/franchize/${slug}/community`}
                className="flex flex-col items-center justify-center rounded-xl px-1 py-2 text-[11px] transition"
                style={{ color: "color-mix(in srgb, var(--fr-map-nav-text, #fff) 80%, transparent)" }}
              >
                <Icon className="mb-1 h-4 w-4" />
                Стена
              </Link>
            );
          }
          return (
            <button
              key={item.key}
              type="button"
              onClick={canControl ? item.action : undefined}
              disabled={!canControl}
              aria-pressed={isActive}
              className="relative flex flex-col items-center justify-center rounded-xl px-1 py-2 text-[11px] transition disabled:opacity-40"
              style={{
                color: !canControl
                  ? "color-mix(in srgb, var(--fr-map-nav-text, #fff) 40%, transparent)"
                  : isActive
                    ? "var(--fr-map-nav-accent, #facc15)"
                    : "color-mix(in srgb, var(--fr-map-nav-text, #fff) 80%, transparent)",
              }}
            >
              <Icon className="mb-1 h-4 w-4" />
              {item.label}
              {/* active-deck dot: the deck is open on THIS tab's segment */}
              <span
                aria-hidden
                className={`absolute bottom-0.5 h-1 w-1 rounded-full transition-opacity ${isActive ? "opacity-100" : "opacity-0"}`}
                style={{ backgroundColor: "var(--fr-map-nav-accent, #facc15)" }}
              />
            </button>
          );
        })}
        {/* «Сеть» — 2026-10-04: on the map page it selects the deck's
            "network" segment (the crew-discovery graph rides inside the
            sheet); off the map it degrades to a plain Link to the global
            discovery page (same fallback contract as «Стена»). Inline
            template literal keeps it under the franchize-scoped href audit. */}
        {!canControl ? (
          <Link
            href={`/franchize/discovery`}
            className="flex flex-col items-center justify-center rounded-xl px-1 py-2 text-[11px] transition"
            style={{ color: "color-mix(in srgb, var(--fr-map-nav-text, #fff) 80%, transparent)" }}
          >
            <Network className="mb-1 h-4 w-4" />
            Сеть
          </Link>
        ) : (
          <button
            type="button"
            onClick={() => {
              // Сеть = сегмент деки: повторный тап сворачивает её (toggle
              // живёт в selectSegment, как у Топ/Лист).
              window.dispatchEvent(new CustomEvent("mapriders-open-riders-drawer", { detail: { tab: "network" } }));
            }}
            aria-pressed={deckSegment !== null && SEGMENT_BY_KEY.network === deckSegment}
            className="relative flex flex-col items-center justify-center rounded-xl px-1 py-2 text-[11px] transition"
            style={{
              color:
                deckSegment !== null && SEGMENT_BY_KEY.network === deckSegment
                  ? "var(--fr-map-nav-accent, #facc15)"
                  : "color-mix(in srgb, var(--fr-map-nav-text, #fff) 80%, transparent)",
            }}
          >
            <Network className="mb-1 h-4 w-4" />
            Сеть
            <span
              aria-hidden
              className={`absolute bottom-0.5 h-1 w-1 rounded-full transition-opacity ${
                deckSegment !== null && SEGMENT_BY_KEY.network === deckSegment ? "opacity-100" : "opacity-0"
              }`}
              style={{ backgroundColor: "var(--fr-map-nav-accent, #facc15)" }}
            />
          </button>
        )}
      </div>
    </nav>
  );
}

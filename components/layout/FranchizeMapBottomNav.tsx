"use client";

// /components/layout/FranchizeMapBottomNav.tsx
// Franchise-scoped bottom tab navigation for map-riders routes.
// Refactored to control the sliding sheet instead of navigating away.
// - "Топ" opens the RidersDrawer on the ride tab (зал славы живёт там)
// - "Лист" opens the RidersDrawer (riders/meetups/history)
// - "Стена" expands the sheet — the community wall IS the sheet content now
//   (on non-map routes — e.g. /leaderboard — it falls back to a plain Link:
//   the sheet-controlling actions don't exist there).
// z-30 sits behind the vaul Drawer (z-40), so it's visible
// when the drawer is collapsed but hidden when expanded.

import Link from "next/link";
import { Trophy, Users, List } from "lucide-react";
import { useEffect, useState } from "react";

interface FranchizeMapBottomNavProps {
  pathname: string;
}

export default function FranchizeMapBottomNav({ pathname }: FranchizeMapBottomNavProps) {
  const slug = pathname.match(/^\/franchize\/([^/]+)\//)?.[1] || "vip-bike";
  const [canControl, setCanControl] = useState(false);

  // Check if we're on map-riders page (where we can control the sheet)
  useEffect(() => {
    setCanControl(pathname.includes("/map-riders"));
  }, [pathname]);

  const items = [
    {
      key: "leaderboard",
      label: "Топ",
      icon: Trophy,
      isLink: false,
      action: () => {
        // RidersDrawer on the ride tab — the riding leaderboard lives there now.
        window.dispatchEvent(new CustomEvent("mapriders-open-riders-drawer", { detail: { tab: "ride" } }));
      },
    },
    {
      key: "drawer",
      label: "Лист",
      icon: List,
      isLink: false,
      action: () => {
        // Dispatch custom event for MapRidersClientRefactored to handle
        window.dispatchEvent(new CustomEvent("mapriders-open-riders-drawer"));
      },
    },
    {
      key: "crew",
      label: "Стена",
      icon: Users,
      isLink: false,
      action: () => {
        // Стена = контент шита: просто раскрываем его (без перехода).
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
      <div className="pointer-events-auto mx-auto grid w-full max-w-lg grid-cols-3 gap-2">
        {items.map((item) => {
          const Icon = item.icon;
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
              className="flex flex-col items-center justify-center rounded-xl px-1 py-2 text-[11px] transition disabled:opacity-40"
              style={{
                color: canControl ? "color-mix(in srgb, var(--fr-map-nav-text, #fff) 80%, transparent)" : "color-mix(in srgb, var(--fr-map-nav-text, #fff) 40%, transparent)",
              }}
            >
              <Icon className="mb-1 h-4 w-4" />
              {item.label}
            </button>
          );
        })}
      </div>
    </nav>
  );
}

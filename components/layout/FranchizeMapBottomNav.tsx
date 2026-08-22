"use client";

// /components/layout/FranchizeMapBottomNav.tsx
// Franchise-scoped bottom tab navigation for map-riders routes.
// Refactored to control the sliding sheet instead of navigating away.
// - "Топ" scrolls to the leaderboard section in the sheet
// - "Лист" opens the RidersDrawer (riders/meetups/history)
// - "Экипаж" navigates to community page
// z-30 sits behind the vaul Drawer (z-40), so it's visible
// when the drawer is collapsed but hidden when expanded.

import Link from "next/link";
import { Trophy, Users, List } from "lucide-react";
import { useEffect, useState } from "react";

interface FranchizeMapBottomNavProps {
  pathname: string;
}

export default function FranchizeMapBottomNav({ pathname }: FranchizeMapBottomNavProps) {
  const slugMatch = pathname.match(/^\/franchize\/([^/]+)\//);
  const slug = slugMatch?.[1] || "vip-bike";
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
        // Dispatch custom event for MapRidersClientRefactored to handle
        window.dispatchEvent(new CustomEvent("mapriders-scroll-to-leaderboard"));
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
      label: "Экипаж",
      href: `/franchize/${slug}/community`,
      icon: Users,
      isLink: true,
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
          const isLink = "href" in item && item.isLink;
          const isActive = isLink && pathname === item.href;

          if (isLink) {
            return (
              <Link
                key={item.key}
                href={item.href}
                className="flex flex-col items-center justify-center rounded-xl px-1 py-2 text-[11px] transition"
                style={{
                  color: isActive ? "var(--fr-map-nav-accent, #facc15)" : "color-mix(in srgb, var(--fr-map-nav-text, #fff) 80%, transparent)",
                  backgroundColor: isActive ? "color-mix(in srgb, var(--fr-map-nav-accent, #facc15) 12%, transparent)" : "transparent",
                }}
              >
                <Icon className="mb-1 h-4 w-4" />
                {item.label}
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

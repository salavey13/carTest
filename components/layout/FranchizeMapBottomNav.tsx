"use client";

// /components/layout/FranchizeMapBottomNav.tsx
// Franchise-scoped bottom tab navigation for map-riders routes.
// z-30 sits behind the vaul Drawer (z-40), so it's visible
// when the drawer is collapsed but hidden when expanded.

import Link from "next/link";
import { MapPin, Trophy, Users, User } from "lucide-react";

interface FranchizeMapBottomNavProps {
  pathname: string;
}

export default function FranchizeMapBottomNav({ pathname }: FranchizeMapBottomNavProps) {
  const slugMatch = pathname.match(/^\/franchize\/([^/]+)\//);
  const slug = slugMatch?.[1] || "vip-bike";

  const items = [
    { key: "leaderboard", label: "Топ", href: `/franchize/${slug}/leaderboard`, icon: Trophy },
    { key: "map", label: "Карта", href: `/franchize/${slug}/map-riders`, icon: MapPin },
    { key: "crew", label: "Экипаж", href: `/franchize/${slug}/community`, icon: Users },
    { key: "profile", label: "Профиль", href: `/franchize/${slug}/profile`, icon: User },
  ] as const;

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-30 border-t px-4 pb-[max(env(safe-area-inset-bottom),0.7rem)] pt-2 backdrop-blur-xl md:hidden"
      style={{
        borderColor: "color-mix(in srgb, var(--fr-map-nav-accent, #facc15) 28%, transparent)",
        backgroundColor: "color-mix(in srgb, var(--fr-map-nav-bg, #030712) 82%, black)",
      }}
    >
      <div className="mx-auto grid w-full max-w-3xl grid-cols-4 gap-2">
        {items.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
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
        })}
      </div>
    </nav>
  );
}

"use client";

import Link from "next/link";
import { MapPin, Trophy, Users, User } from "lucide-react";

interface FranchizeMapBottomNavProps {
  pathname: string;
}

export default function FranchizeMapBottomNav({ pathname }: FranchizeMapBottomNavProps) {
  const slugMatch = pathname.match(/^\/franchize\/([^/]+)\//);
  const slug = slugMatch?.[1] || "vip-bike";

  const items = [
    { key: "leaderboard", label: "Топ", href: "/leaderboard", icon: Trophy },
    { key: "map", label: "Карта", href: `/franchize/${slug}/map-riders`, icon: MapPin },
    { key: "crew", label: "Экипаж", href: `/franchize/${slug}/community`, icon: Users },
    { key: "profile", label: "Профиль", href: `/franchize/${slug}/profile`, icon: User },
  ] as const;

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-white/15 bg-black/70 px-4 pb-[max(env(safe-area-inset-bottom),0.7rem)] pt-2 backdrop-blur-xl md:hidden">
      <div className="mx-auto grid w-full max-w-3xl grid-cols-4 gap-2">
        {items.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <Link
              key={item.key}
              href={item.href}
              className="flex flex-col items-center justify-center rounded-xl px-1 py-2 text-[11px] transition"
              style={{ color: isActive ? "#facc15" : "rgba(255,255,255,0.8)", backgroundColor: isActive ? "rgba(250,204,21,0.12)" : "transparent" }}
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

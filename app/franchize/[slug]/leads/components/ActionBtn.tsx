"use client";

import { type LucideIcon } from "lucide-react";
import type { ThemeTokens } from "@/app/franchize/[slug]/leads/hooks/useTheme";

interface ActionBtnProps {
  href: string;
  icon: LucideIcon;
  label: string;
  T: ThemeTokens;
  external?: boolean;
}

export function ActionBtn({ href, icon: Icon, label, T, external }: ActionBtnProps) {
  return (
    <a
      href={href}
      target={external ? "_blank" : undefined}
      rel={external ? "noreferrer" : undefined}
      className="group flex min-h-[44px] flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-xl border px-2 py-2 text-[11px] font-medium transition hover:brightness-110"
      style={{
        borderColor: T.border,
        backgroundColor: T.bgElevated,
        color: T.text,
      }}
    >
      <Icon
        className="h-3.5 w-3.5 transition group-hover:scale-110"
        style={{ color: T.accent }}
        aria-hidden
      />
      {label}
    </a>
  );
}

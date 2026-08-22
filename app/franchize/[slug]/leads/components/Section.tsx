"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight, type LucideIcon } from "lucide-react";
import type { ThemeTokens } from "@/app/franchize/[slug]/leads/hooks/useTheme";

interface SectionProps {
  title: string;
  icon: LucideIcon;
  children: React.ReactNode;
  T: ThemeTokens;
  defaultOpen?: boolean;
}

export function Section({ title, icon: Icon, children, T, defaultOpen = false }: SectionProps) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div
      className="overflow-hidden rounded-2xl border"
      style={{ borderColor: T.border, backgroundColor: T.bgElevated }}
    >
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        className="flex min-h-[44px] w-full cursor-pointer items-center justify-between px-3 py-2.5 text-left"
        style={{ backgroundColor: T.bgElevated }}
      >
        <div
          className="flex items-center gap-2 text-xs font-bold"
          style={{ color: T.text }}
        >
          <Icon className="h-3.5 w-3.5" style={{ color: T.accent }} aria-hidden />
          {title}
        </div>
        {open ? (
          <ChevronDown className="h-3.5 w-3.5" style={{ color: T.textFaint }} aria-hidden />
        ) : (
          <ChevronRight className="h-3.5 w-3.5" style={{ color: T.textFaint }} aria-hidden />
        )}
      </button>
      <div
        className="border-t px-3 py-3"
        style={{ borderColor: T.border, display: open ? "" : "none" }}
      >
        {children}
      </div>
    </div>
  );
}

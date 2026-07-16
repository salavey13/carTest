"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight, LucideIcon } from "lucide-react";

interface SectionProps {
  title: string;
  icon: LucideIcon;
  children: React.ReactNode;
  T: any;
  defaultOpen?: boolean;
}

export function Section({ title, icon: Icon, children, T, defaultOpen = false }: SectionProps) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="rounded-2xl border overflow-hidden" style={{ borderColor: T.border, backgroundColor: T.bgElevated }}>
      <button
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between px-3 py-2.5 text-left"
        style={{ backgroundColor: T.bgElevated }}
      >
        <div className="flex items-center gap-2 text-xs font-bold" style={{ color: T.text }}>
          <Icon className="h-3.5 w-3.5" style={{ color: T.accent }} />
          {title}
        </div>
        {open ? <ChevronDown className="h-3.5 w-3.5" style={{ color: T.textFaint }} /> : <ChevronRight className="h-3.5 w-3.5" style={{ color: T.textFaint }} />}
      </button>
      {open && <div className="border-t px-3 py-3" style={{ borderColor: T.border }}>{children}</div>}
    </div>
  );
}